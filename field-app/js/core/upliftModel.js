// @ts-check
import { CHANNEL_COST_ORDER, resolveChannelCostAssumption } from "./channelCosts.js";
import { computeChannelUplift } from "./upliftScoring.js";
import { buildUpliftFeatures } from "./upliftFeatures.js";

function safeNum(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max){
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

const DEFAULT_CHANNELS = Object.freeze(CHANNEL_COST_ORDER.slice());

function safeWeight(value, fallback = 0){
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function weightedAverage(rows, pickValue, pickWeight){
  let weightedTotal = 0;
  let weightTotal = 0;
  for (const row of rows){
    const value = Number(pickValue(row));
    const weight = safeWeight(pickWeight(row), 0);
    if (!Number.isFinite(value) || weight <= 0) continue;
    weightedTotal += (value * weight);
    weightTotal += weight;
  }
  if (weightTotal <= 0) return null;
  return weightedTotal / weightTotal;
}

function rowWeight(row){
  const memberCount = safeWeight(row?.memberCount, 1);
  const score = clamp(Number(row?.targetScore ?? row?.score ?? 0), 0, 200);
  return memberCount * (1 + (score / 100));
}

function topTargetingRows(rows, topN){
  const list = (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object")
    .slice()
    .sort((a, b) => {
      const ar = safeNum(a?.rank);
      const br = safeNum(b?.rank);
      if (ar != null && br != null) return ar - br;
      const as = safeNum(a?.targetScore ?? a?.score) ?? -Infinity;
      const bs = safeNum(b?.targetScore ?? b?.score) ?? -Infinity;
      return bs - as;
    });
  const limit = Math.max(1, Math.floor(safeNum(topN) ?? 25));
  return list.slice(0, limit);
}

function buildOptimizationFeaturesFromTargetingRows({ rows, state }){
  const selected = topTargetingRows(rows, state?.targeting?.topN);
  if (!selected.length) return null;

  const canonicalFeatures = {
    adjustedPersuasion: clamp(
      weightedAverage(
        selected,
        (row) => row?.componentScores?.adjustedPersuasion ?? row?.componentScores?.persuasionIndex,
        rowWeight,
      ) ?? 0,
      0,
      1,
    ),
    turnoutOpportunity: clamp(
      weightedAverage(selected, (row) => row?.componentScores?.turnoutOpportunity, rowWeight) ?? 0,
      0,
      1,
    ),
    contactProbability: clamp(
      weightedAverage(selected, (row) => row?.componentScores?.contactProbability, rowWeight) ?? 0,
      0,
      1,
    ),
    geographicMultiplier: clamp(
      weightedAverage(selected, (row) => row?.componentScores?.geographicMultiplier, rowWeight) ?? 1,
      0.75,
      1.25,
    ),
  };

  const densityMultiplier = clamp(
    weightedAverage(selected, (row) => row?.rawSignals?.densityBand?.multiplier, rowWeight) ?? 1,
    0.75,
    1.25,
  );

  return buildUpliftFeatures({
    rawSignals: {
      densityBand: { multiplier: densityMultiplier },
      multiUnitShare: clamp(
        weightedAverage(selected, (row) => row?.rawSignals?.multiUnitShare, rowWeight) ?? 0,
        0,
        1,
      ),
      longCommuteShare: clamp(
        weightedAverage(selected, (row) => row?.rawSignals?.longCommuteShare, rowWeight) ?? 0,
        0,
        1,
      ),
    },
    state,
    canonicalFeatures,
  });
}

function buildOptimizationFeaturesFromBaseRates({ baseRates, state }){
  const sr = clamp(safeNum(baseRates?.sr) ?? ((safeNum(state?.supportRatePct) ?? 55) / 100), 0, 1);
  const tr = clamp(safeNum(baseRates?.tr) ?? ((safeNum(state?.turnoutReliabilityPct) ?? 80) / 100), 0, 1);
  const cr = clamp(safeNum(baseRates?.cr) ?? ((safeNum(state?.contactRatePct) ?? 22) / 100), 0, 1);

  return buildUpliftFeatures({
    rawSignals: {
      densityBand: { multiplier: 1 },
      multiUnitShare: 0.2,
      longCommuteShare: 0.18,
    },
    state,
    canonicalFeatures: {
      adjustedPersuasion: sr,
      turnoutOpportunity: clamp(1 - tr, 0, 1),
      contactProbability: cr,
      geographicMultiplier: 1,
    },
  });
}

export function computeUpliftPlan({
  features = {},
  state = {},
  channels = DEFAULT_CHANNELS,
} = {}){
  const channelRows = [];
  for (const channelId of channels){
    const uplift = computeChannelUplift({ channelId, features });
    const cost = resolveChannelCostAssumption(channelId, {
      tactic: state?.budget?.tactics?.[channelId] || {},
      workforce: state?.ui?.twCapOutlookLatest?.workforce || null,
    });
    const cpa = safeNum(cost?.costPerAttempt);
    const gainPerDollar = (cpa != null && cpa > 0)
      ? (uplift.expectedMarginalGain / cpa)
      : 0;
    channelRows.push({
      channelId,
      expectedMarginalGain: uplift.expectedMarginalGain,
      uncertaintyBand: uplift.uncertaintyBand,
      costPerAttempt: cpa,
      gainPerDollar,
    });
  }

  channelRows.sort((a, b) => Number(b.gainPerDollar) - Number(a.gainPerDollar));
  const best = channelRows[0] || null;
  const expectedMarginalGain = best ? clamp(Number(best.expectedMarginalGain), 0, 1.25) : 0;
  return {
    expectedMarginalGain,
    bestChannel: best?.channelId || null,
    channels: channelRows,
    uncertaintyBand: best?.uncertaintyBand || { low: 0, high: 0 },
  };
}

export function computeOptimizationUpliftPlan({
  state = {},
  baseRates = {},
  targetingRows = null,
  channels = DEFAULT_CHANNELS,
} = {}){
  const rows = Array.isArray(targetingRows)
    ? targetingRows
    : (Array.isArray(state?.targeting?.lastRows) ? state.targeting.lastRows : []);
  const featuresFromRows = buildOptimizationFeaturesFromTargetingRows({ rows, state });
  const source = featuresFromRows ? "targeting_rows" : "base_rates";
  const features = featuresFromRows || buildOptimizationFeaturesFromBaseRates({ baseRates, state });
  const plan = computeUpliftPlan({
    features,
    state,
    channels,
  });
  return {
    ...plan,
    source,
    features,
  };
}
