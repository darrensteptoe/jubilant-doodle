// js/core/timelineOptimizer.js
// Phase 8A — Timeline-Constrained Optimization
// Pure core module: no DOM, deterministic.

import { optimizeMixBudget, optimizeMixCapacity } from "./optimize.js";

function num(v, fb = null){
  if (v === null || v === undefined || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function clamp0(v){
  const n = num(v, 0);
  return n < 0 ? 0 : n;
}

function min2(a, b){
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

export function computeMaxAttemptsByTactic(args){
  // Returns a stable wrapper:
  // {
  //   maxAttemptsByTactic: { [tacticId]: number },
  //   meta: { enabled, weeksRemaining, activeWeeks, totalHours, rampFactor }
  // }
  const enabled = !!args?.enabled;
  if (!enabled){
    return { maxAttemptsByTactic: {}, meta: { enabled:false, weeksRemaining: 0, activeWeeks: 0, totalHours: 0, rampFactor: 1 } };
  }

  const weeksRemaining = clamp0(args?.weeksRemaining);
  const activeWeeksOverride = num(args?.activeWeeksOverride, null);
  const activeWeeks = clamp0(activeWeeksOverride == null ? weeksRemaining : activeWeeksOverride);

  const staff = clamp0(args?.staffing?.staff);
  const volunteers = clamp0(args?.staffing?.volunteers);
  const staffHours = clamp0(args?.staffing?.staffHours);
  const volunteerHours = clamp0(args?.staffing?.volunteerHours);

  const hoursPerWeek = (staff * staffHours) + (volunteers * volunteerHours);
  const totalHours = hoursPerWeek * activeWeeks;

  // Ramp reduces effective average throughput early in the program (deterministic scalar)
  let rampFactor = 1;
  if (args?.ramp?.enabled){
    const mode = String(args?.ramp?.mode || "linear");
    if (mode === "linear") rampFactor = 0.5;     // avg of 0→1
    else if (mode === "s") rampFactor = 0.65;    // slightly less harsh than linear
    else rampFactor = 0.5;
  }

  const tp = args?.throughput || {};
  const maxAttemptsByTactic = {};
  for (const k of Object.keys(tp)){
    const perHour = clamp0(tp[k]);
    maxAttemptsByTactic[k] = totalHours * perHour * rampFactor;
  }

  return {
    maxAttemptsByTactic,
    meta: { enabled:true, weeksRemaining, activeWeeks, totalHours, rampFactor }
  };
}

function applyCapsToTactics(tactics, maxAttemptsByTactic){
  const caps = maxAttemptsByTactic || {};
  return (tactics || []).map(t => {
    const cap = num(caps[t.id], null);
    const maxAttempts = min2(t.maxAttempts ?? null, cap);
    return { ...t, maxAttempts };
  });
}

export function optimizeTimelineConstrained(opts){
  // opts:
  // {
  //   mode: "budget" | "capacity",
  //   budgetLimit, capacityLimit, capacityCeiling,
  //   tactics, step, useDecay, objective,
  //   maxAttemptsByTactic,
  //   tlObjectiveMode: "max_net" | "min_cost_goal",
  //   goalNetVotes
  // }

  const mode = String(opts?.mode || "budget");
  const tlObjectiveMode = String(opts?.tlObjectiveMode || "max_net");
  const goal = num(opts?.goalNetVotes, null);

  const cappedTactics = applyCapsToTactics(opts?.tactics, opts?.maxAttemptsByTactic);

  // Default: maximize net votes under constraints
  const runMaxNet = () => {
    if (mode === "capacity"){
      return optimizeMixCapacity({
        capacity: opts?.capacityLimit,
        tactics: cappedTactics,
        step: opts?.step,
        budgetCeiling: opts?.budgetLimit ?? null,
        useDecay: !!opts?.useDecay,
        objective: opts?.objective || "net",
      });
    }
    return optimizeMixBudget({
      budget: opts?.budgetLimit,
      tactics: cappedTactics,
      step: opts?.step,
      capacityCeiling: opts?.capacityCeiling ?? null,
      useDecay: !!opts?.useDecay,
      objective: opts?.objective || "net",
    });
  };

  let plan = runMaxNet();
  // Build binding object expected by Phase 8B diagnostics.
  const bindingObj = { budget: false, capacity: false, timeline: [] };

  // budget/capacity binding inferred from underlying optimizer
  if (plan && plan.binding === "budget") bindingObj.budget = true;
  if (plan && plan.binding === "capacity") bindingObj.capacity = true;

  // timeline binding inferred when caps are present and the allocator is cap-limited
  const capsMap = opts?.maxAttemptsByTactic || {};
  if (plan && plan.allocation && Object.keys(capsMap).length){
    const tl = [];
    for (const [tid, capRaw] of Object.entries(capsMap)){
      const cap = num(capRaw, null);
      if (cap == null) continue;
      const a = num(plan.allocation?.[tid], 0);
      // Binding if allocation reaches cap within tolerance.
      if (cap > 0 && Math.abs(a - cap) <= Math.max(1e-9, cap * 1e-9)){
        tl.push(tid);
      }
    }
    if (tl.length) bindingObj.timeline = tl;
  }

  // If requested: approximate “min cost to reach goal” by checking feasibility only.
  // (We keep this deterministic and fail-soft; if goal is impossible, meta will show it.)
  if (tlObjectiveMode === "min_cost_goal" && goal != null && Number.isFinite(goal)){
    // We do NOT change optimization math here; we simply report feasibility under given constraints.
    // (If you later want true min-cost search, we can add it in a dedicated phase with a baseline.)
    // plan remains the max-net plan under constraints.
  }

  const maxAchievable = num(plan?.totals?.netVotes, 0) ?? 0;
  const goalFeasible = (goal == null) ? true : (maxAchievable + 1e-9 >= goal);
  const remainingGapNetVotes = (goal == null) ? 0 : Math.max(0, goal - maxAchievable);

  return {
    plan,
    meta: {
      mode,
      tlObjectiveMode,
      bindingObj,
      goalNetVotes: goal,
      goalFeasible,
      maxAchievableNetVotes: maxAchievable,
      remainingGapNetVotes
    }
  };
}
