/* js/marginalValue.js
   Phase 8B — Bottlenecks + Marginal Value (diagnostic)

   ✅ Pure + deterministic
   ✅ No Monte Carlo
   ✅ Reuses Phase 8A optimizer (timelineOptimizer.optimizeTimelineConstrained)
   ✅ No global state / no side effects
*/

import { computeMaxAttemptsByTactic, optimizeTimelineConstrained } from "./timelineOptimizer.js";

function clampNumber(v, lo = 0){
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n;
}

function safeNullNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asText(v){
  return (v == null) ? "—" : String(v);
}

function pickPrimaryTimelineBottleneck({ bindingObj, plan, maxAttemptsByTactic }){
  const timeline = Array.isArray(bindingObj?.timeline) ? bindingObj.timeline : [];
  if (!timeline.length) return { primary: null, secondaryNotes: null, saturation: {} };

  const alloc = plan?.allocation || {};
  const sat = {};
  for (const t of timeline){
    const cap = clampNumber(maxAttemptsByTactic?.[t] ?? 0, 0);
    const a = clampNumber(alloc?.[t] ?? 0, 0);
    sat[t] = (cap > 0) ? (a / cap) : 0;
  }

  // Pick most saturated among binding timeline tactics.
  let best = null;
  let bestV = -1;
  for (const [k, v] of Object.entries(sat)){
    if (v > bestV){ bestV = v; best = k; }
  }

  // Secondary notes: any other tactic within 2% absolute saturation.
  const near = [];
  if (best != null){
    for (const [k, v] of Object.entries(sat)){
      if (k === best) continue;
      if (Math.abs(v - bestV) <= 0.02) near.push(k);
    }
  }
  const secondaryNotes = near.length ? `near-binding: ${near.join(", ")}` : null;

  return { primary: best, secondaryNotes, saturation: sat };
}

function detectPrimaryBottleneck({ baselineResult, maxAttemptsByTactic }){
  const bindingObj = baselineResult?.meta?.bindingObj || {};

  const tl = pickPrimaryTimelineBottleneck({
    bindingObj,
    plan: baselineResult?.plan,
    maxAttemptsByTactic
  });

  if (tl.primary){
    return {
      primaryBottleneck: `timeline: ${tl.primary}`,
      secondaryNotes: tl.secondaryNotes
    };
  }
  if (bindingObj?.budget) return { primaryBottleneck: "budget", secondaryNotes: null };
  if (bindingObj?.capacity) return { primaryBottleneck: "capacity", secondaryNotes: null };
  return { primaryBottleneck: "none/unknown", secondaryNotes: null };
}

function computeInterventionNotes({ baseline, perturbed, baselineMaxAttempts, perturbedMaxAttempts }){
  // Keep notes short: highlight binding shift or the eased tactic.
  const baseB = baseline?.meta?.bindingObj || {};
  const newB = perturbed?.meta?.bindingObj || {};

  const baseTL = Array.isArray(baseB.timeline) ? baseB.timeline : [];
  const newTL = Array.isArray(newB.timeline) ? newB.timeline : [];

  const pickPrimary = (bObj, plan, maxA) => pickPrimaryTimelineBottleneck({ bindingObj: bObj, plan, maxAttemptsByTactic: maxA }).primary;
  const basePrimary = pickPrimary(baseB, baseline?.plan, baselineMaxAttempts);
  const newPrimary = pickPrimary(newB, perturbed?.plan, perturbedMaxAttempts);

  if (basePrimary && newPrimary && basePrimary !== newPrimary){
    return `binding shifts: ${basePrimary} → ${newPrimary}`;
  }
  if (basePrimary){
    return `eases: ${basePrimary}`;
  }
  if (baseB?.budget && !newB?.budget) return "eases: budget";
  if (baseB?.capacity && !newB?.capacity) return "eases: capacity";

  // Fall back: mention timeline binding set change if any.
  const removed = baseTL.filter(x => !newTL.includes(x));
  if (removed.length) return `eases: ${removed[0]}`;
  return "—";
}

function stableSortInterventions(items, mode){
  const out = (items || []).slice();
  if (mode === "min_cost_feasible"){
    // Lower cost is better. Use deltaCost asc. Tie-break by deltaMaxNetVotes desc.
    out.sort((a, b) => {
      const ac = (a.deltaCost == null) ? Infinity : a.deltaCost;
      const bc = (b.deltaCost == null) ? Infinity : b.deltaCost;
      if (ac !== bc) return ac - bc;
      const an = clampNumber(a.deltaMaxNetVotes ?? 0, 0);
      const bn = clampNumber(b.deltaMaxNetVotes ?? 0, 0);
      if (an !== bn) return bn - an;
      return String(a.intervention).localeCompare(String(b.intervention));
    });
    return out;
  }

  // Max-net (or infeasible): larger deltaNetVotes is better.
  out.sort((a, b) => {
    const an = clampNumber(a.deltaMaxNetVotes ?? 0, 0);
    const bn = clampNumber(b.deltaMaxNetVotes ?? 0, 0);
    if (an !== bn) return bn - an;
    return String(a.intervention).localeCompare(String(b.intervention));
  });
  return out;
}

/**
 * computeMarginalValueDiagnostics
 *
 * @param {Object} args
 * @param {Object} args.baselineInputs - same inputs used for optimizeTimelineConstrained (Phase 8A)
 * @param {Object} args.baselineResult - the optimizeTimelineConstrained output
 * @param {Object} args.timelineInputs - inputs used to compute timeline caps (Phase 8A computeMaxAttemptsByTactic)
 */
export function computeMarginalValueDiagnostics({ baselineInputs, baselineResult, timelineInputs }){
  // Defensive: if missing context, return safe stub.
  const stub = {
    primaryBottleneck: "none/unknown",
    secondaryNotes: null,
    interventions: []
  };

  if (!baselineInputs || !baselineResult || !timelineInputs) return stub;

  const baseCaps = computeMaxAttemptsByTactic({
    enabled: !!timelineInputs.enabled,
    weeksRemaining: timelineInputs.weeksRemaining,
    activeWeeksOverride: timelineInputs.activeWeeksOverride,
    gotvWindowWeeks: timelineInputs.gotvWindowWeeks,
    staffing: timelineInputs.staffing,
    throughput: timelineInputs.throughput,
    tacticKinds: timelineInputs.tacticKinds
  });

  const baselineMaxAttempts = (baseCaps && baseCaps.enabled)
    ? baseCaps.maxAttemptsByTactic
    : (baselineInputs.maxAttemptsByTactic || null);

  const { primaryBottleneck, secondaryNotes } = detectPrimaryBottleneck({ baselineResult, maxAttemptsByTactic: baselineMaxAttempts });

  const tlMode = String(baselineInputs.tlObjectiveMode || "max_net");
  const baselineGoalFeasible = baselineResult?.meta?.goalFeasible === true;
  const useMinCostFeasible = (tlMode === "min_cost_goal" && baselineGoalFeasible);

  const baseMax = clampNumber(baselineResult?.meta?.maxAchievableNetVotes ?? 0, 0);
  const baseCost = clampNumber(baselineResult?.plan?.totals?.cost ?? 0, 0);

  const baseActiveWeeks = clampNumber(baseCaps?.activeWeeks ?? timelineInputs.activeWeeksOverride ?? 0, 0);

  const buildPerturbed = (label, patchTimeline) => {
    const tIn = {
      enabled: !!timelineInputs.enabled,
      weeksRemaining: timelineInputs.weeksRemaining,
      activeWeeksOverride: timelineInputs.activeWeeksOverride,
      gotvWindowWeeks: timelineInputs.gotvWindowWeeks,
      staffing: { ...(timelineInputs.staffing || {}) },
      throughput: { ...(timelineInputs.throughput || {}) },
      tacticKinds: { ...(timelineInputs.tacticKinds || {}) }
    };
    if (patchTimeline) patchTimeline(tIn);

    const caps = computeMaxAttemptsByTactic(tIn);
    const maxAttemptsByTactic = (caps && caps.enabled) ? caps.maxAttemptsByTactic : null;

    const out = optimizeTimelineConstrained({
      ...baselineInputs,
      maxAttemptsByTactic
    });

    const newMax = clampNumber(out?.meta?.maxAchievableNetVotes ?? 0, 0);
    const newCost = clampNumber(out?.plan?.totals?.cost ?? 0, 0);

    let deltaMaxNetVotes = null;
    let deltaCost = null;
    if (useMinCostFeasible){
      // In min-cost feasible mode, we care about cost to meet the goal.
      deltaCost = newCost - baseCost;
      deltaMaxNetVotes = 0; // goal is met; extra headroom not required
    } else {
      deltaMaxNetVotes = newMax - baseMax;
      deltaCost = null;
    }

    // Safety: keep stable primitives
    if (deltaMaxNetVotes != null && !Number.isFinite(deltaMaxNetVotes)) deltaMaxNetVotes = 0;
    if (deltaCost != null && !Number.isFinite(deltaCost)) deltaCost = null;

    const notes = computeInterventionNotes({
      baseline: baselineResult,
      perturbed: out,
      baselineMaxAttempts,
      perturbedMaxAttempts: maxAttemptsByTactic
    });

    return {
      intervention: label,
      deltaMaxNetVotes: safeNullNum(deltaMaxNetVotes),
      deltaCost: (useMinCostFeasible ? safeNullNum(deltaCost) : null),
      notes: asText(notes)
    };
  };

  const interventions = [
    buildPerturbed("+1 active week", (tIn) => {
      tIn.activeWeeksOverride = baseActiveWeeks + 1;
    }),
    buildPerturbed("+1 staff hour/week", (tIn) => {
      const cur = clampNumber(tIn.staffing?.staffHours ?? 0, 0);
      tIn.staffing.staffHours = cur + 1;
    }),
    buildPerturbed("+1 volunteer hour/week", (tIn) => {
      const cur = clampNumber(tIn.staffing?.volunteerHours ?? 0, 0);
      tIn.staffing.volunteerHours = cur + 1;
    })
  ];

  // Optional: +1 paid staff headcount (cheap + deterministic)
  interventions.push(
    buildPerturbed("+1 staff headcount", (tIn) => {
      const cur = clampNumber(tIn.staffing?.staff ?? 0, 0);
      tIn.staffing.staff = cur + 1;
    })
  );

  // Rank and take top 3.
  const ranked = stableSortInterventions(interventions, useMinCostFeasible ? "min_cost_feasible" : "max_net").slice(0, 3);

  return {
    primaryBottleneck,
    secondaryNotes,
    interventions: ranked
  };
}
