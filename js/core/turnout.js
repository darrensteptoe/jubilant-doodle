// js/turnout.js
// Phase 6 — Turnout / GOTV modeling helpers (pure functions, deterministic)
// Design goals:
// - No impact when turnout modeling is disabled
// - No circular deps (depends only on utils-style primitives)
// - Defensible math: turnout affects realized votes; persuasion affects preference among voters

import { clamp, safeNum } from "./utils.js";

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
 */
export function pickTacticValuePerAttempt(tactic, objective){
  if (!tactic) return 0;
  if (objective === "turnout"){
    const v = safeNum(tactic.turnoutAdjustedNetVotesPerAttempt);
    return (v != null && isFinite(v)) ? v : 0;
  }
  const v = safeNum(tactic.netVotesPerAttempt);
  return (v != null && isFinite(v)) ? v : 0;
}
