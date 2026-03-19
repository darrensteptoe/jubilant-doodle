// @ts-check
// Phase 4 — Budget + ROI (deterministic cost layer)
// Design rule: this module NEVER mutates Phase 1–3 outcomes. It only computes cost lenses.
import {
  computeTargetUniverseSize,
  computeTacticVoteProduction,
  pctOverrideToDecimal,
  resolveTurnoutContext,
} from "./voteProduction.js";
import {
  CHANNEL_COST_ORDER,
  computeChannelCostMetrics,
  resolveChannelCostAssumption,
} from "./channelCosts.js";
import { computeOptimizationUpliftPlan } from "./upliftModel.js";
import { normalizeUpliftSource, UPLIFT_SOURCE_BASE_RATES } from "./upliftSource.js";
import { roundWholeNumberByMode } from "./utils.js";

/**
 * @typedef {object} ChannelTactic
 * @property {boolean=} enabled
 * @property {number=} cpa
 * @property {number=} crPct
 * @property {number=} srPct
 * @property {string=} kind
 */

/**
 * @typedef {object} BudgetTactics
 * @property {ChannelTactic=} doors
 * @property {ChannelTactic=} phones
 * @property {ChannelTactic=} texts
 * @property {ChannelTactic=} litDrop
 * @property {ChannelTactic=} mail
 */

/**
 * @typedef {object} RoiInput
 * @property {number | null | undefined} goalObjectiveValue
 * @property {number | null | undefined} goalNetVotes
 * @property {{ cr?: number | null, sr?: number | null, tr?: number | null }=} baseRates
 * @property {BudgetTactics=} tactics
 * @property {number=} overheadAmount
 * @property {boolean=} includeOverhead
 * @property {Record<string, number> | null=} caps
 * @property {{ median?: number | null, needVotes?: number | null } | null=} mcLast
 * @property {Record<string, any> | null=} turnoutModel
 * @property {Record<string, any> | null=} workforce
 */

/**
 * @param {{
 *   tactic?: ChannelTactic | null,
 *   baseRates?: { cr?: number | null, sr?: number | null, tr?: number | null } | null,
 *   fallbackContactRate?: number | null,
 * }} args
 * @returns {{ cr: number|null, sr: number|null, tr: number|null }}
 */
function resolveTacticBaseRates({ tactic = null, baseRates = null, fallbackContactRate = null } = {}){
  const baseCr = baseRates?.cr ?? null;
  const baseSr = baseRates?.sr ?? null;
  const baseTr = baseRates?.tr ?? null;
  const crFallback = (baseCr != null) ? baseCr : fallbackContactRate;
  return {
    cr: pctOverrideToDecimal(tactic?.crPct, crFallback),
    sr: pctOverrideToDecimal(tactic?.srPct, baseSr),
    tr: baseTr,
  };
}

/**
 * @param {RoiInput} input
 */
export function computeRoiRows({
  goalObjectiveValue,
  goalNetVotes,
  baseRates,
  tactics,
  overheadAmount = 0,
  includeOverhead = false,
  caps = null,
  mcLast = null,
  turnoutModel = null,
  workforce = null,
}){
  const rows = [];

  const goal = (goalObjectiveValue != null && isFinite(goalObjectiveValue))
    ? goalObjectiveValue
    : goalNetVotes;
  const need = (goal != null && isFinite(goal)) ? Math.max(0, goal) : null;

  const resolvedBaseRates = {
    cr: baseRates?.cr ?? null,
    sr: baseRates?.sr ?? null,
    tr: baseRates?.tr ?? null,
  };
  const baseCr = resolvedBaseRates.cr;
  const baseSr = resolvedBaseRates.sr;
  const baseTr = resolvedBaseRates.tr;

  const turnoutCtx = resolveTurnoutContext(turnoutModel);
  const turnoutEnabled = turnoutCtx.enabled;


  const ratesOkBase = (need != null) && (need > 0) && (baseCr != null && baseCr > 0) && (baseSr != null && baseSr > 0) && (baseTr != null && baseTr > 0);

  const addRow = (key) => {
    const t = tactics?.[key];
    if (!t?.enabled) return;

    const channelAssumption = resolveChannelCostAssumption(key, { tactic: t, workforce });
    const label = String(channelAssumption?.label || key || "Channel");

    const tacticRates = resolveTacticBaseRates({
      tactic: t,
      baseRates: resolvedBaseRates,
      fallbackContactRate: channelAssumption.contactRate,
    });
    const tCr = tacticRates.cr;
    const tSr = tacticRates.sr;
    const tTr = tacticRates.tr;

    const ratesOk = (need != null) && (need > 0) && (tCr != null && tCr > 0) && (tSr != null && tSr > 0) && (tTr != null && tTr > 0);

    const production = computeTacticVoteProduction({
      cr: tCr,
      sr: tSr,
      tr: tTr,
      kind: t?.kind || "persuasion",
      turnoutContext: turnoutCtx,
      requirePositiveBase: false,
      requirePositiveGotvCr: false,
      gotvSaturationCap: false,
      clampHybridTr: true,
    });
    const kind = production.kind;
    const baseNetVotesPerAttempt = production.baseNetVotesPerAttempt;
    const turnoutAdjustedNetVotesPerAttempt = production.turnoutAdjustedNetVotesPerAttempt;
    const hybridEffectiveTr = production.hybridEffectiveTr;

    let requiredAttempts = null;
    let requiredAttemptsTA = null;
    if (ratesOk && isFinite(baseNetVotesPerAttempt) && baseNetVotesPerAttempt > 0){
      requiredAttempts = need / baseNetVotesPerAttempt;
      if (!isFinite(requiredAttempts) || requiredAttempts <= 0) requiredAttempts = null;
    }

    if (turnoutAdjustedNetVotesPerAttempt != null && isFinite(turnoutAdjustedNetVotesPerAttempt) && turnoutAdjustedNetVotesPerAttempt > 0 && need != null && need > 0){
      requiredAttemptsTA = need / turnoutAdjustedNetVotesPerAttempt;
      if (!isFinite(requiredAttemptsTA) || requiredAttemptsTA <= 0) requiredAttemptsTA = null;
    }

    const overheadPerAttempt = (includeOverhead && overheadAmount > 0 && requiredAttempts != null)
      ? (overheadAmount / requiredAttempts)
      : 0;

    const baseCpa = Math.max(0, Number(channelAssumption?.costPerAttempt || 0));
    const cpa = baseCpa + overheadPerAttempt;
    const assumptionWithOverhead = { ...channelAssumption, costPerAttempt: cpa };

    const costMetrics = computeChannelCostMetrics({
      channelId: key,
      assumption: assumptionWithOverhead,
      netVotesPerAttempt: baseNetVotesPerAttempt,
      turnoutAdjustedNetVotesPerAttempt,
    });

    const costPerNetVote = (ratesOk && cpa > 0 && requiredAttempts != null)
      ? (Number.isFinite(Number(costMetrics?.costPerExpectedVote)) ? Number(costMetrics.costPerExpectedVote) : null)
      : null;
    const costPerTurnoutAdjustedNetVote = (turnoutEnabled && cpa > 0 && requiredAttemptsTA != null)
      ? (Number.isFinite(Number(costMetrics?.costPerExpectedNetVote)) ? Number(costMetrics.costPerExpectedNetVote) : null)
      : null;
    const totalCost = (ratesOk && cpa > 0 && requiredAttempts != null)
      ? (requiredAttempts * cpa)
      : null;

    // Capacity feasibility: compare required attempts (to close gap) vs cap ceiling.
    let feasibilityText = "—";
    const capForTactic = (caps && typeof caps === "object")
      ? (caps[key] ?? caps.total ?? null)
      : null;

    if (requiredAttempts == null){
      feasibilityText = (need === 0) ? "No gap" : "Missing rates";
    } else if (capForTactic == null){
      feasibilityText = "Ceiling unknown";
    } else {
      feasibilityText = (requiredAttempts <= capForTactic) ? "Feasible (base)" : "Capacity shortfall";
    }

    rows.push({
      key,
      label,
      cpa: (cpa > 0) ? cpa : null,
      costPerAttempt: costMetrics.costPerAttempt,
      costPerContact: costMetrics.costPerContact,
      costPerExpectedVote: costMetrics.costPerExpectedVote,
      costPerExpectedNetVote: costMetrics.costPerExpectedNetVote,
      costPerNetVote,
      totalCost,
      turnoutAdjustedNetVotesPerAttempt,
      costPerTurnoutAdjustedNetVote,
      feasibilityText,
      channel: {
        id: channelAssumption.channelId,
        liftType: channelAssumption.expectedLiftType,
        laborDependency: channelAssumption.laborDependency,
        laborMultiplier: channelAssumption.laborMultiplier,
      },
      // surface which rates were used (optional for future tooltips)
      used: { cr: tCr, sr: tSr, tr: tTr },
      production: {
        base: {
          netVotesPerAttempt: baseNetVotesPerAttempt,
        },
        effects: {
          turnout: {
            enabled: turnoutEnabled,
            kind,
            gotvLiftPP: turnoutCtx.gotvLiftPP,
            gotvMaxLiftPP: turnoutCtx.gotvMaxLiftPP,
            liftAppliedPP: turnoutCtx.liftAppliedPP,
            maxAdditionalPP: turnoutCtx.maxAdditionalPP,
            baselineTurnoutPct: turnoutCtx.baselineTurnoutPct,
            hybridEffectiveTr,
          },
        },
        adjusted: {
          turnoutAdjustedNetVotesPerAttempt,
        },
      },
    });
  };

  for (const channelId of CHANNEL_COST_ORDER){
    addRow(channelId);
  }

  // Sort by cost per net vote (ascending), pushing nulls to bottom
  rows.sort((a,b) => {
    const av = (a.costPerNetVote == null) ? Infinity : a.costPerNetVote;
    const bv = (b.costPerNetVote == null) ? Infinity : b.costPerNetVote;
    return av - bv;
  });

  const banner = buildBanner({ need, ratesOkBase, overheadAmount, includeOverhead, mcLast });

  return { rows, banner };
}

/**
 * @param {{
 *   need: number | null,
 *   ratesOkBase: boolean,
 *   overheadAmount: number,
 *   includeOverhead: boolean,
 *   mcLast: { median?: number | null, needVotes?: number | null } | null
 * }} input
 */
function buildBanner({ need, ratesOkBase, overheadAmount, includeOverhead, mcLast }){
  if (need == null){
    return { kind: "warn", text: "ROI: Enter a valid universe + support inputs so the model can compute persuasion need." };
  }
  if (need === 0){
    return { kind: "ok", text: "ROI: Under current assumptions, no net persuasion votes are required (gap = 0)." };
  }
  if (!ratesOkBase){
    return { kind: "warn", text: "ROI: Enter Phase 2 Contact rate + Support rate and Phase 3 Turnout reliability to compute ROI." };
  }
  if (includeOverhead && overheadAmount > 0){
    return { kind: "ok", text: "ROI: Overhead allocation is ON (spread deterministically across the gap-closure plan for each tactic)." };
  }
  if (mcLast && mcLast.median != null && mcLast.needVotes != null){
    const deliveredMedian = mcLast.needVotes + mcLast.median;
    if (isFinite(deliveredMedian) && deliveredMedian > 0){
      return { kind: "warn", text: "ROI: Monte Carlo results exist — interpret ROI alongside risk (median and downside outcomes can change delivered net votes)." };
    }
  }
  return { kind: "ok", text: "ROI: Deterministic cost lens using Attempts → Conversations → Support IDs → Net Votes. You can override CR/SR per channel in Phase 4B." };
}

/**
 * @param {number | null | undefined} v
 * @returns {string}
 */
function fmtSignedLocal(v){
  if (v == null || !isFinite(v)) return "—";
  const n = roundWholeNumberByMode(v, { mode: "round", fallback: 0 }) ?? 0;
  if (n === 0) return "0";
  return (n > 0 ? "+" : "−") + Math.abs(n).toLocaleString();
}


// Phase 5 — Optimization helper (pure; does not change ROI math)
// Returns enabled tactics with per-attempt deterministic cost + net-vote yield,
// using the SAME CR/SR override logic as Phase 4B ROI.
/**
 * @param {{
 *   baseRates?: { cr?: number | null, sr?: number | null, tr?: number | null },
 *   tactics?: BudgetTactics,
 *   turnoutModel?: Record<string, any> | null,
 *   universeSize?: number | null,
 *   targetUniversePct?: number | null,
 *   workforce?: Record<string, any> | null,
 *   state?: Record<string, any> | null,
 *   targetingRows?: Array<Record<string, any>> | null
 * }} input
 */
export function buildOptimizationTactics({
  baseRates,
  tactics,
  turnoutModel,
  universeSize,
  targetUniversePct,
  workforce = null,
  state = null,
  targetingRows = null,
}){
  const resolvedBaseRates = {
    cr: baseRates?.cr ?? null,
    sr: baseRates?.sr ?? null,
    tr: baseRates?.tr ?? null,
  };
  const baseCr = resolvedBaseRates.cr;
  const baseSr = resolvedBaseRates.sr;
  const baseTr = resolvedBaseRates.tr;

  const turnoutCtx = resolveTurnoutContext(turnoutModel);
  const turnoutEnabled = turnoutCtx.enabled;

  const targetUniverseSize = computeTargetUniverseSize({
    universeSize,
    targetUniversePct,
  });

  const upliftState = state && typeof state === "object" ? state : {};
  const upliftPlan = computeOptimizationUpliftPlan({
    state: upliftState,
    baseRates: { cr: baseCr, sr: baseSr, tr: baseTr },
    targetingRows: Array.isArray(targetingRows) ? targetingRows : null,
    channels: CHANNEL_COST_ORDER,
  });
  const upliftByChannel = new Map(
    (Array.isArray(upliftPlan?.channels) ? upliftPlan.channels : [])
      .map((row) => [String(row?.channelId || ""), row]),
  );

  const out = [];

  const add = (key) => {
    const t = tactics?.[key];
    if (!t?.enabled) return;

    const channelAssumption = resolveChannelCostAssumption(key, { tactic: t, workforce });
    const label = String(channelAssumption?.label || key || "Channel");

    const { cr, sr, tr } = resolveTacticBaseRates({
      tactic: t,
      baseRates: resolvedBaseRates,
      fallbackContactRate: channelAssumption.contactRate,
    });

    const production = computeTacticVoteProduction({
      cr,
      sr,
      tr,
      kind: t?.kind || "persuasion",
      turnoutContext: turnoutCtx,
      targetUniverseSize,
      gotvSaturationCap: true,
      requirePositiveBase: true,
      requirePositiveGotvCr: true,
      clampHybridTr: true,
    });
    const kind = production.kind;
    const netVotesPerAttempt = production.baseNetVotesPerAttempt;
    const turnoutAdjustedNetVotesPerAttempt = production.turnoutAdjustedNetVotesPerAttempt;
    const maxAttempts = production.maxAttempts;
    const hybridEffectiveTr = production.hybridEffectiveTr;

    const costPerAttempt = Math.max(0, Number(channelAssumption?.costPerAttempt || 0));
    const costMetrics = computeChannelCostMetrics({
      channelId: key,
      assumption: channelAssumption,
      netVotesPerAttempt,
      turnoutAdjustedNetVotesPerAttempt,
    });
    const upliftRow = upliftByChannel.get(key) || null;
    const upliftExpectedMarginalGain = Math.max(0, Number(upliftRow?.expectedMarginalGain || 0));
    const upliftLowMarginalGain = Math.max(
      0,
      Number(
        upliftRow?.uncertaintyBand?.low != null
          ? upliftRow.uncertaintyBand.low
          : upliftExpectedMarginalGain,
      ),
    );
    const upliftAdjustedNetVotesPerAttempt = upliftExpectedMarginalGain * (Number.isFinite(netVotesPerAttempt) ? netVotesPerAttempt : 0);
    const upliftAdjustedTurnoutNetVotesPerAttempt =
      upliftExpectedMarginalGain * (Number.isFinite(turnoutAdjustedNetVotesPerAttempt) ? turnoutAdjustedNetVotesPerAttempt : 0);
    const upliftRiskAdjustedNetVotesPerAttempt =
      upliftLowMarginalGain * (Number.isFinite(netVotesPerAttempt) ? netVotesPerAttempt : 0);
    const upliftRiskAdjustedTurnoutNetVotesPerAttempt =
      upliftLowMarginalGain * (Number.isFinite(turnoutAdjustedNetVotesPerAttempt) ? turnoutAdjustedNetVotesPerAttempt : 0);

    out.push({
      id: key,
      label,
      kind,
      costPerAttempt,
      costPerContact: costMetrics.costPerContact,
      costPerExpectedVote: costMetrics.costPerExpectedVote,
      costPerExpectedNetVote: costMetrics.costPerExpectedNetVote,
      netVotesPerAttempt,
      turnoutAdjustedNetVotesPerAttempt,
      upliftAdjustedNetVotesPerAttempt,
      upliftAdjustedTurnoutNetVotesPerAttempt,
      upliftRiskAdjustedNetVotesPerAttempt,
      upliftRiskAdjustedTurnoutNetVotesPerAttempt,
      maxAttempts,
      channel: {
        id: channelAssumption.channelId,
        liftType: channelAssumption.expectedLiftType,
        laborDependency: channelAssumption.laborDependency,
        laborMultiplier: channelAssumption.laborMultiplier,
      },
      // keep debug parity with ROI layer
      used: { cr, sr, tr },
      production: {
        base: {
          netVotesPerAttempt,
        },
        effects: {
          turnout: {
            enabled: turnoutEnabled,
            kind,
            gotvLiftPP: turnoutCtx.gotvLiftPP,
            gotvMaxLiftPP: turnoutCtx.gotvMaxLiftPP,
            liftAppliedPP: turnoutCtx.liftAppliedPP,
            maxAdditionalPP: turnoutCtx.maxAdditionalPP,
            baselineTurnoutPct: turnoutCtx.baselineTurnoutPct,
            hybridEffectiveTr,
            saturationCapAttempts: maxAttempts,
          },
          uplift: {
            source: normalizeUpliftSource(upliftPlan?.source || UPLIFT_SOURCE_BASE_RATES),
            expectedMarginalGain: upliftExpectedMarginalGain,
            lowMarginalGain: upliftLowMarginalGain,
            uncertaintyBand: upliftRow?.uncertaintyBand || { low: 0, high: 0 },
            gainPerDollar: Number.isFinite(Number(upliftRow?.gainPerDollar)) ? Number(upliftRow.gainPerDollar) : 0,
            bestChannel: String(upliftPlan?.bestChannel || "") === key,
          },
        },
        adjusted: {
          turnoutAdjustedNetVotesPerAttempt,
          upliftAdjustedNetVotesPerAttempt,
          upliftAdjustedTurnoutNetVotesPerAttempt,
          upliftRiskAdjustedNetVotesPerAttempt,
          upliftRiskAdjustedTurnoutNetVotesPerAttempt,
        },
      },
    });
  };

  for (const channelId of CHANNEL_COST_ORDER){
    add(channelId);
  }

  return out;
}
