// @ts-check
import { CHANNEL_COST_ORDER, resolveChannelCostAssumption } from "./channelCosts.js";
import { computeChannelUplift } from "./upliftScoring.js";
import { buildUpliftFeatures } from "./upliftFeatures.js";
import { BASE_RATE_DEFAULTS, resolveBaseRatesWithStateFallback } from "./baseRates.js";
import { clampFiniteNumber, coerceFiniteNumber } from "./utils.js";
import { deriveVoterModelSignals } from "./voterDataLayer.js";
import { UPLIFT_SOURCE_BASE_RATES, UPLIFT_SOURCE_TARGETING_ROWS } from "./upliftSource.js";
import { selectTopTargetingRows, targetRowScoreValue } from "./targetingRows.js";

const safeNum = coerceFiniteNumber;
const clamp = clampFiniteNumber;

const DEFAULT_CHANNELS = Object.freeze(CHANNEL_COST_ORDER.slice());

function resolveVoterUpliftDefaults(voterSignals){
  return {
    contactProbabilityMultiplier: clamp(
      Number(voterSignals?.targeting?.contactProbabilityMultiplier ?? 1),
      0.5,
      1.5,
    ),
    saturationMultiplier: clamp(
      Number(voterSignals?.targeting?.saturationMultiplierDefault ?? 1),
      0.5,
      1.1,
    ),
    geoCoverageRate: clamp(
      Number(voterSignals?.coverage?.geoCoverageRate ?? 0),
      0,
      1,
    ),
  };
}

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
  const score = clamp(Number(targetRowScoreValue(row) ?? 0), 0, 200);
  return memberCount * (1 + (score / 100));
}

function buildOptimizationFeaturesFromTargetingRows({ rows, state }){
  const selected = selectTopTargetingRows(rows, state?.targeting?.topN, { fallbackTopN: 25 });
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

function buildOptimizationFeaturesFromBaseRates({ baseRates, state, voterSignals = null }){
  const resolvedBaseRates = resolveBaseRatesWithStateFallback({
    baseRates,
    state,
    defaults: BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  const sr = clamp(Number(resolvedBaseRates?.sr ?? BASE_RATE_DEFAULTS.sr), 0, 1);
  const tr = clamp(Number(resolvedBaseRates?.tr ?? BASE_RATE_DEFAULTS.tr), 0, 1);
  const cr = clamp(Number(resolvedBaseRates?.cr ?? BASE_RATE_DEFAULTS.cr), 0, 1);
  const voterDefaults = resolveVoterUpliftDefaults(voterSignals);
  const contactProbability = clamp(
    cr * voterDefaults.contactProbabilityMultiplier * voterDefaults.saturationMultiplier,
    0,
    1,
  );
  const geographicMultiplier = clamp(
    0.75 + (voterDefaults.geoCoverageRate * 0.5),
    0.75,
    1.25,
  );

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
      contactProbability,
      geographicMultiplier,
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
  const voterSignals = deriveVoterModelSignals(state?.voterData);
  const rows = Array.isArray(targetingRows)
    ? targetingRows
    : (Array.isArray(state?.targeting?.lastRows) ? state.targeting.lastRows : []);
  const featuresFromRows = buildOptimizationFeaturesFromTargetingRows({ rows, state });
  const source = featuresFromRows ? UPLIFT_SOURCE_TARGETING_ROWS : UPLIFT_SOURCE_BASE_RATES;
  const features = featuresFromRows || buildOptimizationFeaturesFromBaseRates({ baseRates, state, voterSignals });
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
