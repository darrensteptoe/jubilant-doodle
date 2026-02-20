/* js/timelineOptimizer.js
   Phase 8A — Timeline-Constrained Optimization (pure helper)

   Design goals:
   - Keep existing optimizer unchanged
   - No circular deps
   - Deterministic + testable
*/

import { optimizeMixBudget, optimizeMixCapacity } from "./optimize.js";

// ---------- helpers ----------
function clampNumber(v, lo = 0){
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n;
}

function minLimit(a, b){
  // null means "no cap"
  const A = (a == null) ? null : clampNumber(a, 0);
  const B = (b == null) ? null : clampNumber(b, 0);
  if (A == null) return B;
  if (B == null) return A;
  return Math.min(A, B);
}

function isFinitePos(v){ return Number.isFinite(v) && v > 0; }

function computeMaxCost(tactics, maxAttemptsByTactic){
  let cost = 0;
  for (const t of tactics || []){
    const cap = maxAttemptsByTactic?.[t.id];
    const a = (cap == null) ? 0 : clampNumber(cap, 0);
    cost += a * clampNumber(t.costPerAttempt, 0);
  }
  return cost;
}

function buildCappedTactics(tactics, maxAttemptsByTactic){
  return (tactics || []).map(t => {
    const cap = (maxAttemptsByTactic && Object.prototype.hasOwnProperty.call(maxAttemptsByTactic, t.id))
      ? maxAttemptsByTactic[t.id]
      : null;
    const newMax = minLimit(t.maxAttempts, cap);
    return { ...t, maxAttempts: newMax };
  });
}

function pickBindingConstraints({ plan, maxAttemptsByTactic, budgetLimit, capacityLimit, eps = 1e-6 }){
  const binding = {
    timeline: [],
    budget: false,
    capacity: false
  };

  const alloc = plan?.allocation || {};
  if (maxAttemptsByTactic){
    for (const [k, capRaw] of Object.entries(maxAttemptsByTactic)){
      const cap = clampNumber(capRaw, 0);
      if (!isFinitePos(cap)) continue;
      const a = clampNumber(alloc[k] ?? 0, 0);
      if (Math.abs(a - cap) <= Math.max(1, cap * 0.001) + eps) binding.timeline.push(k);
    }
  }

  const cost = clampNumber(plan?.totals?.cost ?? 0, 0);
  const att = clampNumber(plan?.totals?.attempts ?? 0, 0);

  if (budgetLimit != null){
    const B = clampNumber(budgetLimit, 0);
    if (B > 0 && (B - cost) <= Math.max(1, B * 0.001) + eps) binding.budget = true;
  }
  if (capacityLimit != null){
    const C = clampNumber(capacityLimit, 0);
    if (C > 0 && (C - att) <= Math.max(1, C * 0.001) + eps) binding.capacity = true;
  }

  return binding;
}

function bindingToText(binding){
  const parts = [];
  if (binding?.timeline?.length) parts.push(`timeline: ${binding.timeline.join(", ")}`);
  if (binding?.budget) parts.push("budget");
  if (binding?.capacity) parts.push("capacity");
  return parts.length ? parts.join("; ") : "none";
}

// ---------- public: compute timeline caps (pure) ----------
export function computeMaxAttemptsByTactic({
  enabled,
  weeksRemaining,
  activeWeeksOverride,
  gotvWindowWeeks,
  staffing,
  throughput,
  tacticKinds
}){
  const out = { enabled: !!enabled, activeWeeks: 0, maxAttemptsByTactic: {} };
  if (!out.enabled) return out;

  const weeks = Math.max(0, Math.floor(clampNumber(weeksRemaining, 0)));
  const activeOverride = (activeWeeksOverride == null || activeWeeksOverride === "") ? null : clampNumber(activeWeeksOverride, 0);
  const activeWeeks = Math.max(0, Math.min(weeks, Math.floor(activeOverride == null ? weeks : activeOverride)));
  out.activeWeeks = activeWeeks;

  const gotvW = (gotvWindowWeeks == null || gotvWindowWeeks === "") ? null : clampNumber(gotvWindowWeeks, 0);
  const gotvWeeks = (gotvW == null) ? null : Math.max(0, Math.min(weeks, Math.floor(gotvW)));

  const staffN = clampNumber(staffing?.staff ?? 0, 0);
  const volN = clampNumber(staffing?.volunteers ?? 0, 0);
  const staffH = clampNumber(staffing?.staffHours ?? 0, 0);
  const volH = clampNumber(staffing?.volunteerHours ?? 0, 0);

  const keys = new Set([
    ...Object.keys(throughput || {}),
    ...Object.keys(tacticKinds || {})
  ]);

  const hoursPerWeek = (staffN * staffH) + (volN * volH);

  for (const id of keys){
    const aph = clampNumber(throughput?.[id] ?? 0, 0);
    const wkCap = hoursPerWeek * aph;

    const kind = (tacticKinds && tacticKinds[id]) ? String(tacticKinds[id]) : "persuasion";
    const useWeeks = (kind === "turnout" && gotvWeeks != null) ? Math.min(activeWeeks, gotvWeeks) : activeWeeks;

    const cap = wkCap * useWeeks;
    out.maxAttemptsByTactic[id] = (Number.isFinite(cap) && cap > 0) ? cap : 0;
  }

  return out;
}

// ---------- public: timeline-constrained optimization ----------
export function optimizeTimelineConstrained({
  // existing optimization inputs
  mode, // "budget" | "capacity"
  budgetLimit, // number | null (budget mode)
  capacityLimit, // number | null (capacity mode)
  capacityCeiling, // attempt ceiling (Phase 3) used in budget mode, optional
  tactics,
  step,
  useDecay,
  objective, // "net" | "turnout" (existing)
  // timeline
  maxAttemptsByTactic, // map tactic->max attempts
  // Phase 8A objective
  tlObjectiveMode, // "max_net" | "min_cost_goal"
  goalNetVotes // number
}){
  const cleanMode = (mode === "capacity") ? "capacity" : "budget";
  const S = Math.max(1, Math.floor(clampNumber(step, 25)));
  const goal = clampNumber(goalNetVotes ?? 0, 0);

  const cappedTactics = buildCappedTactics(tactics || [], maxAttemptsByTactic || null);

  // Helper to run "maximize net votes" given constraints
  const runMax = () => {
    if (cleanMode === "capacity"){
      return optimizeMixCapacity({
        capacity: clampNumber(capacityLimit ?? 0, 0),
        tactics: cappedTactics,
        step: S,
        useDecay: !!useDecay,
        objective
      });
    }

    return optimizeMixBudget({
      budget: clampNumber(budgetLimit ?? 0, 0),
      tactics: cappedTactics,
      step: S,
      capacityCeiling: (capacityCeiling == null ? null : clampNumber(capacityCeiling, 0)),
      useDecay: !!useDecay,
      objective
    });
  };

  const maxPlan = runMax();
  const maxAchievableNetVotes = clampNumber(maxPlan?.totals?.netVotes ?? 0, 0);

  const epsVotes = 1e-9;
  const goalFeasible = (maxAchievableNetVotes + epsVotes) >= goal;
  const remainingGapNetVotes = goalFeasible ? 0 : Math.max(0, goal - maxAchievableNetVotes);

  // Default: max net votes plan
  let plan = maxPlan;

  if (tlObjectiveMode === "min_cost_goal"){
    const targetVotes = goalFeasible ? goal : maxAchievableNetVotes;

    // Find the minimum budget that achieves targetVotes, respecting capacity + timeline caps.
    // We always use the budget optimizer because it maximizes votes per dollar (best for cost-min).
    const capCeil = (cleanMode === "capacity")
      ? clampNumber(capacityLimit ?? 0, 0)
      : (capacityCeiling == null ? null : clampNumber(capacityCeiling, 0));

    const upper = (cleanMode === "budget")
      ? clampNumber(budgetLimit ?? 0, 0)
      : clampNumber(computeMaxCost(cappedTactics, maxAttemptsByTactic), 0);

    const meets = (r) => clampNumber(r?.totals?.netVotes ?? 0, 0) + epsVotes >= targetVotes;

    // Early exit if already zero-goal or can't meet within computed upper.
    if (targetVotes <= 0){
      plan = optimizeMixBudget({
        budget: 0,
        tactics: cappedTactics,
        step: S,
        capacityCeiling: capCeil,
        useDecay: !!useDecay,
        objective
      });
    } else {
      const hiTry = optimizeMixBudget({
        budget: upper,
        tactics: cappedTactics,
        step: S,
        capacityCeiling: capCeil,
        useDecay: !!useDecay,
        objective
      });

      if (!meets(hiTry)){
        // Should only happen if targetVotes is maxAchievable and upper < needed due to rounding;
        // fall back to hiTry (best effort).
        plan = hiTry;
      } else {
        let lo = 0;
        let hi = Math.ceil(upper);

        // Binary search over integer dollars.
        for (let i = 0; i < 30 && lo < hi; i++){
          const mid = Math.floor((lo + hi) / 2);
          const r = optimizeMixBudget({
            budget: mid,
            tactics: cappedTactics,
            step: S,
            capacityCeiling: capCeil,
            useDecay: !!useDecay,
            objective
          });
          if (meets(r)){
            hi = mid;
            plan = r;
          } else {
            lo = mid + 1;
          }
        }

        // Ensure final plan meets if feasible.
        if (!meets(plan)){
          plan = optimizeMixBudget({
            budget: hi,
            tactics: cappedTactics,
            step: S,
            capacityCeiling: capCeil,
            useDecay: !!useDecay,
            objective
          });
        }
      }
    }

    // Normalize "mode" label back to original so UI text doesn't confuse.
    if (plan && cleanMode === "capacity"){
      plan = { ...plan, mode: "capacity", constraint: clampNumber(capacityLimit ?? 0, 0) };
    }
  }

  const bindingObj = pickBindingConstraints({
    plan,
    maxAttemptsByTactic,
    budgetLimit: (cleanMode === "budget") ? budgetLimit : null,
    capacityLimit: (cleanMode === "capacity") ? capacityLimit : (capacityCeiling == null ? null : capacityCeiling)
  });

  // Safety: no NaN/Infinity in new outputs
  const safeNum = (v) => (Number.isFinite(v) ? v : 0);

  return {
    plan,
    meta: {
      goalFeasible: !!goalFeasible,
      maxAchievableNetVotes: safeNum(maxAchievableNetVotes),
      remainingGapNetVotes: safeNum(remainingGapNetVotes),
      bindingConstraints: bindingToText(bindingObj),
      bindingObj
    }
  };
}
