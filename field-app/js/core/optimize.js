// @ts-check
import { pickTacticValuePerAttempt } from "./turnout.js";
/* js/optimize.js
   Phase 5 — Tactic Mix Optimization (top-layer only)

   ✅ Does NOT modify persuasion math
   ✅ Does NOT touch Monte Carlo engine
   ✅ Deterministic only (no cost randomness)
   ✅ No circular budget/capacity logic
   ✅ Greedy allocator (defensible) with optional diminishing returns (OFF by default)

   Tactic shape:
   {
     id: "doors" | "phones" | "texts" | ...,
     label: "Doors",
     costPerAttempt: number,
     netVotesPerAttempt: number,
     maxAttempts: number | null,        // optional cap
     decayTiers?: [{ upto:number, mult:number }, ...] // optional (only used when useDecay=true)
   }
*/

/**
 * @param {unknown} x
 * @param {number} [fallback]
 * @returns {number}
 */
function clampNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteOrNull(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Canonical uplift-summary normalization for UI/reporting layers.
 * Keeps interpretation math out of render modules.
 * @param {unknown} rawSummary
 */
export function deriveOptimizationUpliftSignals(rawSummary){
  const summary = rawSummary && typeof rawSummary === "object"
    ? /** @type {Record<string, any>} */ (rawSummary)
    : {};
  const expectedMarginalGain = finiteOrNull(summary?.weightedExpectedMarginalGain);
  const lowMarginalGain = finiteOrNull(summary?.weightedLowMarginalGain);
  const bestChannel = String(summary?.bestChannel || "").trim();
  const uncertaintyBand = String(summary?.uncertaintyBand || "").trim().toLowerCase();
  const saturationPressure = String(summary?.saturationPressure || "").trim().toLowerCase();
  const hasExpected = expectedMarginalGain != null;
  const hasLow = lowMarginalGain != null;
  const hasRange = hasExpected && hasLow;
  const hasUncertainty = !!uncertaintyBand;
  const hasSaturation = !!saturationPressure && saturationPressure !== "unknown";
  return {
    expectedMarginalGain,
    lowMarginalGain,
    bestChannel,
    uncertaintyBand,
    saturationPressure,
    hasExpected,
    hasLow,
    hasRange,
    hasUncertainty,
    hasSaturation,
  };
}

/**
 * Canonical uplift summary text builder for reporting surfaces.
 * @param {unknown} rawSummary
 * @param {{
 *   formatPercent?: (value: number) => string,
 *   rangeJoiner?: string,
 *   saturationPrefix?: string,
 * }=} options
 * @returns {string}
 */
export function buildOptimizationUpliftSummaryText(rawSummary, options = {}){
  const uplift = deriveOptimizationUpliftSignals(rawSummary);
  const formatPercent = typeof options?.formatPercent === "function"
    ? options.formatPercent
    : (value) => `${Math.round(Number(value) * 100)}%`;
  const rangeJoiner = String(options?.rangeJoiner || "-");
  const saturationPrefix = String(options?.saturationPrefix || "saturation");

  const parts = [];
  if (uplift.hasExpected){
    if (uplift.hasLow){
      parts.push(`Uplift range ${formatPercent(Number(uplift.lowMarginalGain))}${rangeJoiner}${formatPercent(Number(uplift.expectedMarginalGain))}`);
    } else {
      parts.push(`Uplift ${formatPercent(Number(uplift.expectedMarginalGain))}`);
    }
  }
  if (uplift.bestChannel){
    parts.push(`best channel ${uplift.bestChannel}`);
  }
  if (uplift.hasUncertainty){
    parts.push(`uncertainty ${uplift.uncertaintyBand}`);
  }
  if (uplift.hasSaturation){
    parts.push(`${saturationPrefix} ${uplift.saturationPressure}`);
  }
  return parts.join("; ");
}

/**
 * @param {Record<string, any>} tactic
 * @param {number} currentAttempts
 * @returns {number}
 */
function getTierMultiplier(tactic, currentAttempts) {
  const tiers = Array.isArray(tactic.decayTiers) ? tactic.decayTiers : null;
  if (!tiers || tiers.length === 0) return 1;

  for (const t of tiers) {
    const upto = clampNumber(t.upto, Infinity);
    if (currentAttempts < upto) return clampNumber(t.mult, 1);
  }
  return clampNumber(tiers[tiers.length - 1]?.mult, 1);
}

/**
 * @param {Array<Record<string, any>> | null | undefined} tactics
 * @returns {Array<Record<string, any>>}
 */
function validateTactics(tactics) {
  if (!Array.isArray(tactics) || tactics.length === 0) return [];

  return tactics.map((t) => {
    const id = String(t.id ?? "").trim();
    const label = String(t.label ?? id);

    const costPerAttempt = clampNumber(t.costPerAttempt, NaN);
    const netVotesPerAttempt = clampNumber(t.netVotesPerAttempt, NaN);
    const turnoutAdjustedNetVotesPerAttempt = clampNumber(t.turnoutAdjustedNetVotesPerAttempt, NaN);

    if (!id) throw new Error("optimizeMix: tactic missing id.");
    if (!Number.isFinite(costPerAttempt) || costPerAttempt < 0) throw new Error(`optimizeMix: invalid costPerAttempt for ${id}.`);
    if (!Number.isFinite(netVotesPerAttempt)) throw new Error(`optimizeMix: invalid netVotesPerAttempt for ${id}.`);

    let maxAttempts = t.maxAttempts;
    maxAttempts = (maxAttempts === null || maxAttempts === undefined) ? null : clampNumber(maxAttempts, null);
    if (maxAttempts !== null && (!Number.isFinite(maxAttempts) || maxAttempts < 0)) {
      throw new Error(`optimizeMix: invalid maxAttempts for ${id}.`);
    }

    return { ...t, id, label, costPerAttempt, netVotesPerAttempt, turnoutAdjustedNetVotesPerAttempt, maxAttempts };
  });
}

/**
 * @param {Array<Record<string, any>>} tactics
 * @returns {Record<string, number>}
 */
function initAllocation(tactics) {
  const allocation = {};
  for (const t of tactics) allocation[t.id] = 0;
  return allocation;
}

/**
 * @param {Array<Record<string, any>>} tactics
 * @param {Record<string, number>} allocation
 * @param {(tactic: Record<string, any>) => number} valuePerAttempt
 * @returns {{attempts:number,cost:number,netVotes:number}}
 */
function computeTotals(tactics, allocation, valuePerAttempt) {
  let attempts = 0;
  let cost = 0;
  let netVotes = 0;
  for (const t of tactics) {
    const a = clampNumber(allocation[t.id], 0);
    attempts += a;
    cost += a * t.costPerAttempt;
    netVotes += a * valuePerAttempt(t);
  }
  return { attempts, cost, netVotes };
}

/**
 * @param {{
 *   tactics: Array<Record<string, any>>,
 *   step: number,
 *   budgetLimit: number | null,
 *   capacityLimit: number | null,
 *   useDecay: boolean,
 *   scoringFn: (input: { tactic: Record<string, any>, currentAllocatedAttempts: number, step: number, marginalNetVotes: number, marginalCost: number }) => number,
 *   valuePerAttempt: (tactic: Record<string, any>) => number
 * }} input
 */
function greedyAllocate({ tactics, step, budgetLimit, capacityLimit, useDecay, scoringFn, valuePerAttempt }) {
  const allocation = initAllocation(tactics);
  const trace = [];

  let usedBudget = 0;
  let usedCapacity = 0;
  let accumulatedNetVotes = 0;

  const canAddStep = (t) => {
    const cur = allocation[t.id];
    if (t.maxAttempts !== null && cur + step > t.maxAttempts) return false;
    if (capacityLimit !== null && usedCapacity + step > capacityLimit) return false;
    const stepCost = step * t.costPerAttempt;
    if (budgetLimit !== null && usedBudget + stepCost > budgetLimit) return false;
    return true;
  };

  while (true) {
    let best = null;
    let bestScore = -Infinity;

    for (const t of tactics) {
      if (!canAddStep(t)) continue;

      const cur = allocation[t.id];
      const mult = useDecay ? getTierMultiplier(t, cur) : 1;

      const mNetVotes = step * valuePerAttempt(t) * mult;
      const mCost = step * t.costPerAttempt;

      const score = scoringFn({ tactic: t, currentAllocatedAttempts: cur, step, marginalNetVotes: mNetVotes, marginalCost: mCost });
      if (score > bestScore) {
        bestScore = score;
        best = { t, mNetVotes, mCost, score };
      }
    }

    if (!best) break;

    allocation[best.t.id] += step;
    usedCapacity += step;
    usedBudget += best.mCost;
    if (useDecay) accumulatedNetVotes += best.mNetVotes;

    trace.push({ pick: best.t.id, add: step, mNetVotes: best.mNetVotes, mCost: best.mCost, score: best.score });
  }

  const totals = computeTotals(tactics, allocation, valuePerAttempt);
  if (useDecay) totals.netVotes = accumulatedNetVotes;

  let binding = "caps";
  if (budgetLimit !== null && (budgetLimit - usedBudget) < 1e-9) binding = "budget";
  if (capacityLimit !== null && (capacityLimit - usedCapacity) < 1e-9) binding = "capacity";

  return { allocation, totals, trace, binding };
}

/**
 * @param {{
 *   budget: number,
 *   tactics: Array<Record<string, any>>,
 *   step?: number,
 *   capacityCeiling?: number | null,
 *   useDecay?: boolean,
 *   objective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string
 * }} input
 */
export function optimizeMixBudget({ budget, tactics, step = 25, capacityCeiling = null, useDecay = false, objective = "net" }) {
  const B = Math.max(0, clampNumber(budget, 0));
  const S = Math.max(1, Math.floor(clampNumber(step, 25)));

  const clean = validateTactics(tactics);

  const valuePerAttempt = (t) => Math.max(0, clampNumber(pickTacticValuePerAttempt(t, objective), 0));


  const scoringFn = ({ marginalNetVotes, marginalCost }) => {
    if (marginalCost <= 0) return marginalNetVotes > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return marginalNetVotes / marginalCost;
  };

  const { allocation, totals, trace, binding } = greedyAllocate({
    tactics: clean,
    step: S,
    budgetLimit: B,
    capacityLimit: (capacityCeiling === null ? null : Math.max(0, clampNumber(capacityCeiling, 0))),
    useDecay,
    scoringFn,
    valuePerAttempt
  });

  return { mode: "budget", step: S, constraint: B, binding, allocation, totals, trace };
}

/**
 * @param {{
 *   capacity: number,
 *   tactics: Array<Record<string, any>>,
 *   step?: number,
 *   useDecay?: boolean,
 *   objective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string
 * }} input
 */
export function optimizeMixCapacity({ capacity, tactics, step = 25, useDecay = false, objective = "net" }) {
  const A = Math.max(0, clampNumber(capacity, 0));
  const S = Math.max(1, Math.floor(clampNumber(step, 25)));

  const clean = validateTactics(tactics);

  const valuePerAttempt = (t) => Math.max(0, clampNumber(pickTacticValuePerAttempt(t, objective), 0));

  const scoringFn = ({ marginalNetVotes }) => marginalNetVotes;

  const { allocation, totals, trace, binding } = greedyAllocate({
    tactics: clean,
    step: S,
    budgetLimit: null,
    capacityLimit: A,
    useDecay,
    scoringFn,
    valuePerAttempt
  });

  return { mode: "capacity", step: S, constraint: A, binding, allocation, totals, trace };
}

/**
 * Canonical allocation summary builder for Plan/reporting surfaces.
 * Keeps objective math and uplift aggregation out of UI render modules.
 * @param {{
 *   tactics?: Array<Record<string, any>> | null,
 *   allocation?: Record<string, number> | null,
 *   totals?: { attempts?: number, cost?: number, netVotes?: number } | null,
 *   objective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string,
 *   needObjectiveValue?: number | null,
 *   includeOverhead?: boolean,
 *   overheadAmount?: number | null,
 * }} input
 */
export function buildOptimizationExecutionSummary({
  tactics = [],
  allocation = null,
  totals = null,
  objective = "net",
  needObjectiveValue = null,
  includeOverhead = false,
  overheadAmount = 0,
} = {}){
  const clean = validateTactics(tactics);
  const alloc = allocation && typeof allocation === "object" ? allocation : {};
  const rows = [];

  let attemptsTotal = 0;
  let costTotal = 0;
  let objectiveTotal = 0;

  let upliftExpectedWeighted = 0;
  let upliftExpectedWeight = 0;
  let upliftLowWeighted = 0;
  let upliftLowWeight = 0;
  let saturationWeighted = 0;
  let saturationWeight = 0;
  let bestChannelByGainPerDollar = null;
  let bestGainPerDollar = Number.NEGATIVE_INFINITY;

  for (const tactic of clean){
    const attempts = Math.max(0, clampNumber(alloc[tactic.id], 0));
    if (!(attempts > 0)) continue;

    const usedCr = Math.max(0, clampNumber(tactic?.used?.cr, 0));
    const objectiveValuePerAttempt = Math.max(0, clampNumber(pickTacticValuePerAttempt(tactic, objective), 0));
    const expectedContacts = attempts * usedCr;
    const expectedObjectiveValue = attempts * objectiveValuePerAttempt;
    const cost = attempts * Math.max(0, clampNumber(tactic.costPerAttempt, 0));
    const costPerObjectiveValue = expectedObjectiveValue > 0 ? (cost / expectedObjectiveValue) : null;

    const upliftExpectedMarginalGain = finiteOrNull(tactic?.production?.effects?.uplift?.expectedMarginalGain);
    const upliftLowMarginalGain = finiteOrNull(tactic?.production?.effects?.uplift?.lowMarginalGain);
    const upliftGainPerDollar = finiteOrNull(tactic?.production?.effects?.uplift?.gainPerDollar);
    const upliftBestChannel = !!tactic?.production?.effects?.uplift?.bestChannel;

    if (upliftBestChannel){
      bestChannelByGainPerDollar = String(tactic.id);
    } else if (upliftGainPerDollar != null && upliftGainPerDollar > bestGainPerDollar){
      bestGainPerDollar = upliftGainPerDollar;
      if (!bestChannelByGainPerDollar){
        bestChannelByGainPerDollar = String(tactic.id);
      }
    }

    if (upliftExpectedMarginalGain != null){
      upliftExpectedWeighted += attempts * upliftExpectedMarginalGain;
      upliftExpectedWeight += attempts;
    }
    if (upliftLowMarginalGain != null){
      upliftLowWeighted += attempts * upliftLowMarginalGain;
      upliftLowWeight += attempts;
    }

    const saturationCapAttemptsRaw = finiteOrNull(tactic?.production?.effects?.turnout?.saturationCapAttempts);
    const saturationCapAttempts = (saturationCapAttemptsRaw != null && saturationCapAttemptsRaw > 0)
      ? saturationCapAttemptsRaw
      : (tactic.maxAttempts != null ? Math.max(0, clampNumber(tactic.maxAttempts, 0)) : null);
    const saturationUtilization = (saturationCapAttempts != null && saturationCapAttempts > 0)
      ? Math.max(0, attempts / saturationCapAttempts)
      : null;
    if (saturationUtilization != null){
      saturationWeighted += attempts * saturationUtilization;
      saturationWeight += attempts;
    }

    rows.push({
      id: String(tactic.id),
      tactic: String(tactic.label || tactic.id),
      attempts,
      expectedContacts,
      objectiveValuePerAttempt,
      expectedObjectiveValue,
      expectedNetVotes: expectedObjectiveValue,
      cost,
      costPerObjectiveValue,
      costPerNetVote: costPerObjectiveValue,
      upliftExpectedMarginalGain,
      upliftLowMarginalGain,
      upliftGainPerDollar,
      upliftBestChannel,
      saturationCapAttempts,
      saturationUtilization,
    });

    attemptsTotal += attempts;
    costTotal += cost;
    objectiveTotal += expectedObjectiveValue;
  }

  rows.sort((a, b) => Number(b.attempts) - Number(a.attempts));

  const totalsAttempts = finiteOrNull(totals?.attempts);
  const totalsCost = finiteOrNull(totals?.cost);
  const totalsObjective = finiteOrNull(totals?.netVotes);
  const overhead = Math.max(0, clampNumber(overheadAmount, 0));

  const finalAttempts = totalsAttempts != null ? totalsAttempts : attemptsTotal;
  const finalCost = (totalsCost != null ? totalsCost : costTotal) + ((includeOverhead && overhead > 0) ? overhead : 0);
  const finalObjectiveValue = totalsObjective != null ? totalsObjective : objectiveTotal;

  const need = finiteOrNull(needObjectiveValue);
  const gapObjectiveValue = (need != null) ? Math.max(0, need - finalObjectiveValue) : null;

  const weightedExpectedMarginalGain = upliftExpectedWeight > 0
    ? (upliftExpectedWeighted / upliftExpectedWeight)
    : null;
  const weightedLowMarginalGain = upliftLowWeight > 0
    ? (upliftLowWeighted / upliftLowWeight)
    : weightedExpectedMarginalGain;
  const uncertaintySpread = (weightedExpectedMarginalGain != null && weightedLowMarginalGain != null)
    ? Math.max(0, weightedExpectedMarginalGain - weightedLowMarginalGain)
    : null;
  const relativeUncertainty = (
    weightedExpectedMarginalGain != null &&
    weightedExpectedMarginalGain > 0 &&
    uncertaintySpread != null
  )
    ? (uncertaintySpread / weightedExpectedMarginalGain)
    : null;
  const weightedSaturationUtilization = saturationWeight > 0
    ? (saturationWeighted / saturationWeight)
    : null;

  let uncertaintyBand = "unknown";
  if (relativeUncertainty != null){
    if (relativeUncertainty <= 0.15) uncertaintyBand = "low";
    else if (relativeUncertainty <= 0.32) uncertaintyBand = "medium";
    else uncertaintyBand = "high";
  }

  let saturationPressure = "unknown";
  if (weightedSaturationUtilization != null){
    if (weightedSaturationUtilization >= 0.9) saturationPressure = "high";
    else if (weightedSaturationUtilization >= 0.7) saturationPressure = "medium";
    else saturationPressure = "low";
  }

  return {
    rows,
    totals: {
      attempts: finalAttempts,
      cost: finalCost,
      objectiveValue: finalObjectiveValue,
      gapObjectiveValue,
    },
    topAllocations: rows.slice(0, 3).map((row) => ({
      id: row.id,
      tactic: row.tactic,
      attempts: row.attempts,
    })),
    uplift: {
      bestChannel: bestChannelByGainPerDollar,
      weightedExpectedMarginalGain,
      weightedLowMarginalGain,
      uncertaintySpread,
      uncertaintyBand,
      weightedSaturationUtilization,
      saturationPressure,
    },
  };
}

/**
 * @param {{ first: number, second: number, third: number, mults?: number[] }} input
 * @returns {Array<{ upto: number, mult: number }>}
 */
export function makeDecayTiers({ first, second, third, mults }) {
  const m = Array.isArray(mults) ? mults : [1, 0.85, 0.7, 0.55];
  return [
    { upto: clampNumber(first, 0), mult: clampNumber(m[0], 1) },
    { upto: clampNumber(second, Infinity), mult: clampNumber(m[1], 1) },
    { upto: clampNumber(third, Infinity), mult: clampNumber(m[2], 1) },
    { upto: Infinity, mult: clampNumber(m[3], 1) },
  ].filter(t => Number.isFinite(t.upto) && t.upto > 0);
}
