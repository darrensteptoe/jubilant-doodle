// @ts-check
// Phase 4 — Budget + ROI (deterministic cost layer)
// Design rule: this module NEVER mutates Phase 1–3 outcomes. It only computes cost lenses.
import {
  computeTacticVoteProduction,
  pctOverrideToDecimal,
  resolveTurnoutContext,
} from "./voteProduction.js";

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
 */

/**
 * @typedef {object} RoiInput
 * @property {number | null | undefined} goalNetVotes
 * @property {{ cr?: number | null, sr?: number | null, tr?: number | null }=} baseRates
 * @property {BudgetTactics=} tactics
 * @property {number=} overheadAmount
 * @property {boolean=} includeOverhead
 * @property {Record<string, number> | null=} caps
 * @property {{ median?: number | null, needVotes?: number | null } | null=} mcLast
 * @property {Record<string, any> | null=} turnoutModel
 */

/**
 * @param {RoiInput} input
 */
export function computeRoiRows({
  goalNetVotes,
  baseRates,
  tactics,
  overheadAmount = 0,
  includeOverhead = false,
  caps = null,
  mcLast = null,
  turnoutModel = null,
}){
  const rows = [];

  const need = (goalNetVotes != null && isFinite(goalNetVotes)) ? Math.max(0, goalNetVotes) : null;

  const baseCr = baseRates?.cr ?? null;
  const baseSr = baseRates?.sr ?? null;
  const baseTr = baseRates?.tr ?? null;

  const turnoutCtx = resolveTurnoutContext(turnoutModel);
  const turnoutEnabled = turnoutCtx.enabled;


  const ratesOkBase = (need != null) && (need > 0) && (baseCr != null && baseCr > 0) && (baseSr != null && baseSr > 0) && (baseTr != null && baseTr > 0);

  const addRow = (key, label) => {
    const t = tactics?.[key];
    if (!t?.enabled) return;

    const tCr = pctOverrideToDecimal(t?.crPct, baseCr);
    const tSr = pctOverrideToDecimal(t?.srPct, baseSr);
    const tTr = baseTr;

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

    const baseCpa = (t.cpa != null && isFinite(t.cpa)) ? Math.max(0, t.cpa) : 0;
    const cpa = baseCpa + overheadPerAttempt;

    let costPerNetVote = null;
    let totalCost = null;
    let costPerTurnoutAdjustedNetVote = null;

    if (ratesOk && cpa > 0 && requiredAttempts != null && isFinite(baseNetVotesPerAttempt) && baseNetVotesPerAttempt > 0){
      costPerNetVote = cpa / baseNetVotesPerAttempt;
      totalCost = requiredAttempts * cpa;
    }

    if (turnoutEnabled && cpa > 0 && requiredAttemptsTA != null && turnoutAdjustedNetVotesPerAttempt != null && turnoutAdjustedNetVotesPerAttempt > 0){
      costPerTurnoutAdjustedNetVote = cpa / turnoutAdjustedNetVotesPerAttempt;
    }

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
      costPerNetVote,
      totalCost,
      turnoutAdjustedNetVotesPerAttempt,
      costPerTurnoutAdjustedNetVote,
      feasibilityText,
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

  addRow("doors", "Doors");
  addRow("phones", "Phones");
  addRow("texts", "Texts");

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
  const n = Math.round(v);
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
 *   targetUniversePct?: number | null
 * }} input
 */
export function buildOptimizationTactics({ baseRates, tactics, turnoutModel, universeSize, targetUniversePct }){
  const baseCr = baseRates?.cr ?? null;
  const baseSr = baseRates?.sr ?? null;
  const baseTr = baseRates?.tr ?? null;

  const turnoutCtx = resolveTurnoutContext(turnoutModel);
  const turnoutEnabled = turnoutCtx.enabled;

  const U = (universeSize != null && isFinite(universeSize) && universeSize > 0) ? Number(universeSize) : null;
  const tuPct = (targetUniversePct != null && isFinite(targetUniversePct)) ? Math.max(0, Math.min(100, Number(targetUniversePct))) : null;
  const targetUniverseSize = (U != null && tuPct != null) ? Math.round(U * (tuPct / 100)) : null;


  const out = [];

  const add = (key, label) => {
    const t = tactics?.[key];
    if (!t?.enabled) return;

    const cr = pctOverrideToDecimal(t?.crPct, baseCr);
    const sr = pctOverrideToDecimal(t?.srPct, baseSr);
    const tr = baseTr;

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

    const costPerAttempt = (t?.cpa != null && isFinite(t.cpa)) ? Math.max(0, Number(t.cpa)) : 0;

    out.push({
      id: key,
      label,
      kind,
      costPerAttempt,
      netVotesPerAttempt,
      turnoutAdjustedNetVotesPerAttempt,
      maxAttempts,
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
        },
        adjusted: {
          turnoutAdjustedNetVotesPerAttempt,
        },
      },
    });
  };

  add("doors", "Doors");
  add("phones", "Phones");
  add("texts", "Texts");

  return out;
}
