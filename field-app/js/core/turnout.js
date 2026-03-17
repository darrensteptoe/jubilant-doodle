// @ts-check
// js/turnout.js
// Phase 6 — Turnout / GOTV modeling helpers (pure functions, deterministic)
// Design goals:
// - No impact when turnout modeling is disabled
// - No circular deps (depends only on utils-style primitives)
// - Defensible math: turnout affects realized votes; persuasion affects preference among voters

import { clamp, safeNum } from "./utils.js";

export const OPTIMIZATION_OBJECTIVES = Object.freeze([
  Object.freeze({
    value: "net",
    label: "Net Votes",
    description: "Maximize deterministic net vote yield per dollar or per attempt.",
  }),
  Object.freeze({
    value: "turnout",
    label: "Turnout-Adjusted Net Votes",
    description: "Use turnout-adjusted net vote yield for tactic ranking.",
  }),
  Object.freeze({
    value: "uplift",
    label: "Uplift-Adjusted Net Votes",
    description: "Use expected action-driven uplift multiplied by deterministic net votes.",
  }),
  Object.freeze({
    value: "uplift_turnout",
    label: "Uplift + Turnout Net Votes",
    description: "Use uplift-adjusted turnout-aware net vote yield.",
  }),
  Object.freeze({
    value: "uplift_robust",
    label: "Uplift (Risk-Adjusted) Net Votes",
    description: "Use uplift lower-bound estimates to avoid over-weighting uncertain channels.",
  }),
]);

const OPTIMIZATION_OBJECTIVE_SET = new Set(OPTIMIZATION_OBJECTIVES.map((row) => String(row.value)));

export function normalizeOptimizationObjective(value, fallback = "net"){
  const key = String(value || "").trim();
  if (OPTIMIZATION_OBJECTIVE_SET.has(key)) return key;
  return String(fallback || "net");
}

export function getOptimizationObjectiveLabel(value){
  const key = normalizeOptimizationObjective(value, "net");
  return OPTIMIZATION_OBJECTIVES.find((row) => row.value === key)?.label || "Net Votes";
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback]
 * @returns {{
 *   value: string,
 *   label: string,
 *   metricLabel: string,
 *   shortfallLabel: string,
 *   maxLabel: string,
 *   remainingGapLabel: string,
 * }}
 */
export function getOptimizationObjectiveCopy(value, fallback = "net"){
  const normalized = normalizeOptimizationObjective(value, fallback);
  const label = getOptimizationObjectiveLabel(normalized);
  const lower = String(label || "Net Votes").toLowerCase();
  return {
    value: normalized,
    label,
    metricLabel: `Expected ${lower}`,
    shortfallLabel: `Shortfall ${lower}`,
    maxLabel: `Max achievable ${lower}`,
    remainingGapLabel: `Remaining ${lower} gap`,
  };
}

/**
 * @typedef {object} AvgLiftInput
 * @property {number} baselineTurnoutPct
 * @property {number} liftPerContactPP
 * @property {number} maxLiftPP
 * @property {number} contacts
 * @property {number} universeSize
 * @property {boolean=} useDiminishing
 */

/**
 * @typedef {object} TurnoutAdjustedInput
 * @property {boolean} turnoutEnabled
 * @property {number} baseNetVotes
 * @property {number | null=} rrUnit
 * @property {number=} gotvAvgLiftPP
 * @property {boolean=} hybridAppliesToPersuasion
 * @property {number=} gotvAddedVotes
 */

/**
 * Compute average turnout lift (percentage points) applied to a target universe,
 * given total successful GOTV contacts.
 *
 * - baselineTurnoutPct: baseline turnout of target universe (0-100)
 * - liftPerContactPP: per successful contact lift in turnout probability (percentage points)
 * - maxLiftPP: ceiling on turnout lift above baseline (percentage points)
 * - contacts: successful contacts (count)
 * - universeSize: size of target universe (count)
 * - useDiminishing: if true, uses a smooth saturating curve; else linear to cap
 * @param {AvgLiftInput} input
 * @returns {number}
 */
export function computeAvgLiftPP({
  baselineTurnoutPct,
  liftPerContactPP,
  maxLiftPP,
  contacts,
  universeSize,
  useDiminishing = false,
}){
  const basePct = clamp(safeNum(baselineTurnoutPct) ?? 0, 0, 100);
  const liftPP = Math.max(0, safeNum(liftPerContactPP) ?? 0);
  const ceilingRaw = Math.max(0, safeNum(maxLiftPP) ?? 0);

  if (liftPP <= 0 || ceilingRaw <= 0) return 0;

  // Can't lift above 100%.
  const ceiling = Math.max(0, Math.min(ceilingRaw, 100 - basePct));
  if (ceiling <= 0) return 0;

  const U = Math.max(0, safeNum(universeSize) ?? 0);
  const c = Math.max(0, safeNum(contacts) ?? 0);
  if (U <= 0 || c <= 0) return 0;

  const perVoter = c / U; // successful contacts per voter in target universe

  if (!useDiminishing){
    // Linear to cap: avgLift = min(ceiling, perVoter * liftPP)
    return Math.min(ceiling, perVoter * liftPP);
  }

  // Smooth saturation:
  // Choose k so initial slope at 0 equals liftPP:
  // avgLift = ceiling * (1 - exp(-k * perVoter))
  // derivative at 0: ceiling * k = liftPP  => k = liftPP / ceiling
  const k = (ceiling > 0) ? (liftPP / ceiling) : 0;
  const avg = ceiling * (1 - Math.exp(-k * perVoter));
  return clamp(avg, 0, ceiling);
}

/**
 * @param {TurnoutAdjustedInput} input
 * @returns {{
 *   turnoutAdjustedNetVotes: number,
 *   persuasionNetVotes: number,
 *   gotvAddedVotes: number,
 *   effectiveRrUnit: number | null
 * }}
 */
export function computeTurnoutAdjustedNetVotes({
  turnoutEnabled,
  baseNetVotes,
  // Persuasion realization (TR) is already embedded in baseNetVotes upstream.
  // We optionally allow GOTV to increase realization for HYBRID persuasion contacts by increasing rr.
  rrUnit, // 0..1
  gotvAvgLiftPP, // 0..100
  hybridAppliesToPersuasion = false,
  // GOTV added votes among target universe
  gotvAddedVotes = 0,
}){
  const base = safeNum(baseNetVotes) ?? 0;
  if (!turnoutEnabled) return {
    turnoutAdjustedNetVotes: base,
    persuasionNetVotes: base,
    gotvAddedVotes: 0,
    effectiveRrUnit: rrUnit ?? null,
  };

  let persuasionVotes = base;
  let effectiveRrUnit = rrUnit ?? null;

  if (hybridAppliesToPersuasion && rrUnit != null && isFinite(rrUnit)){
    const eff = clamp(rrUnit + (Math.max(0, safeNum(gotvAvgLiftPP) ?? 0) / 100), 0, 1);
    effectiveRrUnit = eff;

    // If caller provided baseNetVotes computed with rrUnit, rescale to eff.
    // This is optional and only used for hybrid modeling.
    if (rrUnit > 0){
      persuasionVotes = base * (eff / rrUnit);
    }
  }

  const added = Math.max(0, safeNum(gotvAddedVotes) ?? 0);
  const total = persuasionVotes + added;

  return {
    turnoutAdjustedNetVotes: total,
    persuasionNetVotes: persuasionVotes,
    gotvAddedVotes: added,
    effectiveRrUnit,
  };
}

/**
 * Compute tactic value-per-attempt for optimization under a given objective.
 *
 * objective:
 * - "net" => netVotesPerAttempt (existing)
 * - "turnout" => turnoutAdjustedNetVotesPerAttempt (new)
 * - "uplift" => upliftAdjustedNetVotesPerAttempt
 * - "uplift_turnout" => upliftAdjustedTurnoutNetVotesPerAttempt
 * - "uplift_robust" => upliftRiskAdjustedNetVotesPerAttempt
 */
/**
 * @param {{
 *   netVotesPerAttempt?: number,
 *   turnoutAdjustedNetVotesPerAttempt?: number,
  *   upliftAdjustedNetVotesPerAttempt?: number,
 *   upliftAdjustedTurnoutNetVotesPerAttempt?: number,
 *   upliftRiskAdjustedNetVotesPerAttempt?: number
 * } | null | undefined} tactic
 * @param {"net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string} objective
 * @returns {number}
 */
export function pickTacticValuePerAttempt(tactic, objective){
  if (!tactic) return 0;
  const normalized = normalizeOptimizationObjective(objective, "net");
  if (normalized === "turnout"){
    const v = safeNum(tactic.turnoutAdjustedNetVotesPerAttempt);
    return (v != null && isFinite(v)) ? v : 0;
  }
  if (normalized === "uplift"){
    const v = safeNum(tactic.upliftAdjustedNetVotesPerAttempt);
    if (v != null && isFinite(v)) return v;
    const fallback = safeNum(tactic.netVotesPerAttempt);
    return (fallback != null && isFinite(fallback)) ? fallback : 0;
  }
  if (normalized === "uplift_turnout"){
    const v = safeNum(tactic.upliftAdjustedTurnoutNetVotesPerAttempt);
    if (v != null && isFinite(v)) return v;
    const fallbackTurnout = safeNum(tactic.turnoutAdjustedNetVotesPerAttempt);
    if (fallbackTurnout != null && isFinite(fallbackTurnout)) return fallbackTurnout;
    const fallback = safeNum(tactic.netVotesPerAttempt);
    return (fallback != null && isFinite(fallback)) ? fallback : 0;
  }
  if (normalized === "uplift_robust"){
    const v = safeNum(tactic.upliftRiskAdjustedNetVotesPerAttempt);
    if (v != null && isFinite(v)) return v;
    const fallbackUplift = safeNum(tactic.upliftAdjustedNetVotesPerAttempt);
    if (fallbackUplift != null && isFinite(fallbackUplift)) return fallbackUplift;
    const fallback = safeNum(tactic.netVotesPerAttempt);
    return (fallback != null && isFinite(fallback)) ? fallback : 0;
  }
  const v = safeNum(tactic.netVotesPerAttempt);
  return (v != null && isFinite(v)) ? v : 0;
}
