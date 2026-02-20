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

function clampNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function getTierMultiplier(tactic, currentAttempts) {
  const tiers = Array.isArray(tactic.decayTiers) ? tactic.decayTiers : null;
  if (!tiers || tiers.length === 0) return 1;

  for (const t of tiers) {
    const upto = clampNumber(t.upto, Infinity);
    if (currentAttempts < upto) return clampNumber(t.mult, 1);
  }
  return clampNumber(tiers[tiers.length - 1]?.mult, 1);
}

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

function initAllocation(tactics) {
  const allocation = {};
  for (const t of tactics) allocation[t.id] = 0;
  return allocation;
}

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

export function optimizeMixBudget({ budget, tactics, step = 25, capacityCeiling = null, useDecay = false, objective = "net" }) {
  const B = Math.max(0, clampNumber(budget, 0));
  const S = Math.max(1, Math.floor(clampNumber(step, 25)));

  const clean = validateTactics(tactics);

  const valuePerAttempt = (t) => {
    const v = (objective === "turnout") ? t?.turnoutAdjustedNetVotesPerAttempt : t?.netVotesPerAttempt;
    const n = clampNumber(v, 0);
    return n;
  };


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

export function optimizeMixCapacity({ capacity, tactics, step = 25, useDecay = false, objective = "net" }) {
  const A = Math.max(0, clampNumber(capacity, 0));
  const S = Math.max(1, Math.floor(clampNumber(step, 25)));

  const clean = validateTactics(tactics);

  const valuePerAttempt = (t) => {
    const v = (objective === "turnout") ? t?.turnoutAdjustedNetVotesPerAttempt : t?.netVotesPerAttempt;
    const n = clampNumber(v, 0);
    return n;
  };

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

export function makeDecayTiers({ first, second, third, mults }) {
  const m = Array.isArray(mults) ? mults : [1, 0.85, 0.7, 0.55];
  return [
    { upto: clampNumber(first, 0), mult: clampNumber(m[0], 1) },
    { upto: clampNumber(second, Infinity), mult: clampNumber(m[1], 1) },
    { upto: clampNumber(third, Infinity), mult: clampNumber(m[2], 1) },
    { upto: Infinity, mult: clampNumber(m[3], 1) },
  ].filter(t => Number.isFinite(t.upto) && t.upto > 0);
}
