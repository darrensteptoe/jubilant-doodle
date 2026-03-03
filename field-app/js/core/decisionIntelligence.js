// js/decisionIntelligence.js
// Phase 12 — Decision Intelligence (bottleneck clarity + marginal leverage)
// Design goals:
// - Sidecar: does not alter core math/optimizer logic
// - Deterministic ranking for deterministic outputs
// - Monte Carlo deltas use existing runMonteCarloSim via accessors (same seed + run count)
// - Fail-soft: never throw to caller

import { computeVolunteerNeedFromGoal } from "./executionPlanner.js";
import { buildModelInputFromSnapshot } from "./modelInput.js";

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(v, lo, hi){
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

function pctToUnit(pct, fallback){
  const n = safeNum(pct);
  if (n == null) return fallback;
  return clamp(n, 0, 100) / 100;
}

function buildBaseRatesFromSnap(snap){
  const s = snap || {};
  return {
    cr: pctToUnit(s.contactRatePct, 0),
    sr: pctToUnit(s.supportRatePct, 0),
    tr: pctToUnit(s.turnoutReliabilityPct, 0),
  };
}

function buildTimelineCapsInputFromSnap({ snap, weeks, tactics }){
  const s = snap || {};
  return {
    enabled: !!s.timelineEnabled,
    weeksRemaining: weeks,
    activeWeeksOverride: safeNum(s.timelineActiveWeeks),
    gotvWindowWeeks: safeNum(s.timelineGotvWeeks) ?? 2,
    staffing: {
      staff: safeNum(s.timelineStaffCount) ?? 0,
      staffHours: safeNum(s.timelineStaffHours) ?? 40,
      volunteers: safeNum(s.timelineVolCount) ?? 0,
      volunteerHours: safeNum(s.timelineVolHours) ?? 4,
    },
    throughput: {
      doors: safeNum(s.timelineDoorsPerHour) ?? 0,
      phones: safeNum(s.timelineCallsPerHour) ?? 0,
      texts: safeNum(s.timelineTextsPerHour) ?? 0,
    },
    tacticKinds: tactics?.map(t => ({ id: t.id, kind: t.kind })) || []
  };
}

function computeMinCostToCloseGap({ computeRoiRows, snap, baseRates, tactics, goalNetVotes, caps, mcLast, turnoutModel }){
  try{
    const overheadAmount = safeNum(snap.budget?.overheadAmount) ?? 0;
    const includeOverhead = !!snap.budget?.includeOverhead;
    const out = computeRoiRows({
      goalNetVotes,
      baseRates,
      tactics,
      overheadAmount,
      includeOverhead,
      caps,
      mcLast,
      turnoutModel
    }) || {};
    const rows = Array.isArray(out?.rows) ? out.rows : [];
    let best = null;
    for (const r of rows){
      const v = safeNum(r?.totalCost);
      if (v == null) continue;
      if (best == null || v < best) best = v;
    }
    return best;
  } catch {
    return null;
  }
}

function stableSort(items, key, dir = 1){
  const out = (items || []).slice();
  out.sort((a,b) => {
    const av = (a && Number.isFinite(a[key])) ? a[key] : (dir === 1 ? Infinity : -Infinity);
    const bv = (b && Number.isFinite(b[key])) ? b[key] : (dir === 1 ? Infinity : -Infinity);
    if (av !== bv) return dir * (av - bv);
    return String(a?.lever || "").localeCompare(String(b?.lever || ""));
  });
  return out;
}

function detectBottlenecks({ snap, maxAttemptsByTactic }){
  const bindingObj = snap?.ui?.lastTlMeta?.bindingObj || {};
  const alloc = snap?.ui?.lastOpt?.allocation || {};

  // Collect binding candidates
  const bindingTimeline = Array.isArray(bindingObj?.timeline) ? bindingObj.timeline : [];
  const bindingBudget = !!bindingObj?.budget;
  const bindingCapacity = !!bindingObj?.capacity;

  // Timeline saturation ranking (if available)
  const sat = [];
  for (const t of bindingTimeline){
    const cap = safeNum(maxAttemptsByTactic?.[t]);
    const a = safeNum(alloc?.[t]);
    const s = (cap != null && cap > 0 && a != null) ? (a / cap) : null;
    if (s != null) sat.push({ t, s });
  }
  sat.sort((a,b) => b.s - a.s || String(a.t).localeCompare(String(b.t)));

  let primary = null;
  let secondary = null;

  if (sat.length){
    primary = `timeline: ${sat[0].t}`;
    if (sat.length > 1) secondary = `timeline: ${sat[1].t}`;
  } else if (bindingTimeline.length){
    primary = `timeline: ${bindingTimeline[0]}`;
    if (bindingTimeline.length > 1) secondary = `timeline: ${bindingTimeline[1]}`;
  }

  // If no timeline binding, consider budget/capacity as primary/secondary.
  const others = [];
  if (bindingBudget) others.push("budget");
  if (bindingCapacity) others.push("capacity");

  if (!primary && others.length){
    primary = others[0];
    secondary = others[1] || null;
  } else if (primary && !secondary && others.length){
    secondary = others[0];
  }

  const notBinding = [];
  if (!bindingTimeline.length) notBinding.push("timeline");
  if (!bindingBudget) notBinding.push("budget");
  if (!bindingCapacity) notBinding.push("capacity");

  return {
    primary: primary || "none/unknown",
    secondary: secondary || "—",
    notBinding
  };
}

function buildLevers({ snap }){
  const levers = [];

  // +1pp rates
  levers.push({
    lever: "Contact rate (+1pp)",
    patch: { contactRatePct: (safeNum(snap.contactRatePct) ?? 0) + 1 }
  });

  levers.push({
    lever: "Support/convert rate (+1pp)",
    patch: { supportRatePct: (safeNum(snap.supportRatePct) ?? 0) + 1 }
  });

  // +1 throughput
  levers.push({
    lever: "Doors per hour (+1)",
    patch: {
      doorsPerHour: (safeNum(snap.doorsPerHour3) ?? safeNum(snap.doorsPerHour) ?? 0) + 1,
      doorsPerHour3: (safeNum(snap.doorsPerHour3) ?? safeNum(snap.doorsPerHour) ?? 0) + 1,
    }
  });

  // Volunteers +1 (timeline only — uses existing field)
  levers.push({
    lever: "Volunteers (+1)",
    patch: { timelineVolCount: (safeNum(snap.timelineVolCount) ?? 0) + 1 }
  });

  // Shifts/week +1
  levers.push({
    lever: "Shifts/week (+1)",
    patch: { shiftsPerVolunteerPerWeek: (safeNum(snap.shiftsPerVolunteerPerWeek) ?? 0) + 1 }
  });

  // Turnout +1pp (only meaningful when turnout module active)
  if (!!snap.turnoutEnabled){
    const useOverride = (safeNum(snap.turnoutTargetOverridePct) != null);
    if (useOverride){
      levers.push({
        lever: "Turnout (+1pp)",
        patch: { turnoutTargetOverridePct: (safeNum(snap.turnoutTargetOverridePct) ?? 0) + 1 }
      });
    } else {
      levers.push({
        lever: "Turnout (+1pp)",
        patch: { turnoutBaselinePct: (safeNum(snap.turnoutBaselinePct) ?? 0) + 1 }
      });
    }
  }

  // Cost per attempt -1% (optional)
  const tactics = snap?.budget?.tactics;
  if (tactics && typeof tactics === "object"){
    const patchTactics = {};
    let any = false;
    for (const [k, v] of Object.entries(tactics)){
      const cpa = safeNum(v?.cpa);
      if (cpa == null) continue;
      patchTactics[k] = { ...v, cpa: cpa * 0.99 };
      any = true;
    }
    if (any){
      levers.push({
        lever: "Cost per attempt (-1%)",
        patch: { budget: { ...snap.budget, tactics: patchTactics } }
      });
    }
  }

  return levers;
}

const DI_FALLBACK_SEED = "__di_deterministic_seed__";

export function computeDecisionIntelligence({ engine, snap, baseline }){
  // engine: { withPatchedState, computeAll, derivedWeeksRemaining, deriveNeedVotes, runMonteCarloSim, computeRoiRows, buildOptimizationTactics, computeMaxAttemptsByTactic, computeTimelineFeasibility }
  // snap: deep-cloned snapshot (must not be mutated)
  // baseline: optional precomputed { res, weeks, needVotes, winProb, volsNeeded, minCostToCloseGap, maxAttemptsByTactic }
  const safeStub = {
    ok: false,
    warning: "Decision Intelligence unavailable (missing context).",
    bottlenecks: { primary: "—", secondary: "—", notBinding: [] },
    rankings: { volunteers: [], cost: [], probability: [] },
    recs: { volunteers: "—", cost: "—", probability: "—" }
  };

  try{
    if (!engine || !snap || typeof snap !== "object") return safeStub;

    const computeBaseline = () => {
      const weeks = baseline?.weeks ?? engine.derivedWeeksRemaining({
        weeksRemainingOverride: snap?.weeksRemaining,
        electionDateISO: snap?.electionDate ? `${snap.electionDate}T00:00:00` : ""
      });
      const modelInput = buildModelInputFromSnapshot(snap, safeNum);
      const res = baseline?.res ?? engine.computeAll(modelInput);
      const needVotes = baseline?.needVotes ?? engine.deriveNeedVotes(res, snap?.goalSupportIds);
      const volsNeeded = baseline?.volsNeeded ?? computeVolunteerNeedFromGoal({
        goalVotes: needVotes,
        supportRatePct: snap.supportRatePct,
        contactRatePct: snap.contactRatePct,
        doorsPerHour: (safeNum(snap.doorsPerHour3) ?? safeNum(snap.doorsPerHour)),
        hoursPerShift: snap.hoursPerShift,
        shiftsPerVolunteerPerWeek: snap.shiftsPerVolunteerPerWeek,
        weeks
      });
      const seed = (snap.mcSeed != null && String(snap.mcSeed).trim() !== "") ? String(snap.mcSeed) : DI_FALLBACK_SEED;
      const sim = engine.runMonteCarloSim({ res, weeks, needVotes, runs: 10000, seed });
      const s = sim?.summary || sim || {};
      const winProb = (!!snap.turnoutEnabled && Number.isFinite(s.winProbTurnoutAdjusted)) ? s.winProbTurnoutAdjusted : s.winProb;

      // ROI cost lens
      const baseRates = buildBaseRatesFromSnap(snap);
      const tactics = engine.buildOptimizationTactics({ baseRates, tactics: snap.budget?.tactics || {} });

      // Timeline caps for feasibility (optional)
      const capsInput = buildTimelineCapsInputFromSnap({ snap, weeks, tactics });

      const caps = engine.computeMaxAttemptsByTactic(capsInput);
      const maxAttemptsByTactic = (caps && caps.enabled) ? caps.maxAttemptsByTactic : null;

      const minCostToCloseGap = computeMinCostToCloseGap({
        computeRoiRows: engine.computeRoiRows,
        snap,
        baseRates,
        tactics,
        goalNetVotes: needVotes,
        caps: (caps && caps.enabled) ? caps : null,
        mcLast: sim,
        turnoutModel: null
      });

      return { res, weeks, needVotes, winProb, volsNeeded, minCostToCloseGap, maxAttemptsByTactic };
    };

    const baseComputed = computeBaseline();
    const base = { ...baseComputed, ...(baseline || {}) };

    // Bottlenecks (deterministic)
    const bottlenecks = detectBottlenecks({ snap, maxAttemptsByTactic: base.maxAttemptsByTactic });

    // Levers + deltas
    const levers = buildLevers({ snap });

    const results = [];
    for (const lv of levers){
      const out = engine.withPatchedState(lv.patch, () => {
        const nextSnap = engine.getStateSnapshot ? engine.getStateSnapshot() : null;

        const weeks = engine.derivedWeeksRemaining({
          weeksRemainingOverride: nextSnap?.weeksRemaining,
          electionDateISO: nextSnap?.electionDate ? `${nextSnap.electionDate}T00:00:00` : ""
        });
        const modelInput = buildModelInputFromSnapshot(nextSnap, safeNum);
        const res = engine.computeAll(modelInput);
        const needVotes = engine.deriveNeedVotes(res, nextSnap?.goalSupportIds);

        const volsNeeded = computeVolunteerNeedFromGoal({
          goalVotes: needVotes,
          supportRatePct: nextSnap.supportRatePct,
          contactRatePct: nextSnap.contactRatePct,
          doorsPerHour: (safeNum(nextSnap.doorsPerHour3) ?? safeNum(nextSnap.doorsPerHour)),
          hoursPerShift: nextSnap.hoursPerShift,
          shiftsPerVolunteerPerWeek: nextSnap.shiftsPerVolunteerPerWeek,
          weeks
        });

        const seed = (nextSnap.mcSeed != null && String(nextSnap.mcSeed).trim() !== "") ? String(nextSnap.mcSeed) : DI_FALLBACK_SEED;
        const sim = engine.runMonteCarloSim({ res, weeks, needVotes, runs: 10000, seed });
        const s = sim?.summary || sim || {};
        const winProb = (!!nextSnap.turnoutEnabled && Number.isFinite(s.winProbTurnoutAdjusted)) ? s.winProbTurnoutAdjusted : s.winProb;

        const baseRates = buildBaseRatesFromSnap(nextSnap);
        const tactics = engine.buildOptimizationTactics({ baseRates, tactics: nextSnap.budget?.tactics || {} });

        const capsInput = buildTimelineCapsInputFromSnap({ snap: nextSnap, weeks, tactics });

        const caps = engine.computeMaxAttemptsByTactic(capsInput);

        const minCostToCloseGap = computeMinCostToCloseGap({
          computeRoiRows: engine.computeRoiRows,
          snap: nextSnap,
          baseRates,
          tactics,
          goalNetVotes: needVotes,
          caps: (caps && caps.enabled) ? caps : null,
          mcLast: sim,
          turnoutModel: null
        });

        return { weeks, res, needVotes, volsNeeded, minCostToCloseGap, winProb };
      });

      // Deltas (baseline -> lever)
      const dVol = (out?.volsNeeded != null && base.volsNeeded != null) ? (out.volsNeeded - base.volsNeeded) : null;
      const dCost = (out?.minCostToCloseGap != null && base.minCostToCloseGap != null) ? (out.minCostToCloseGap - base.minCostToCloseGap) : null;
      const dProb = (out?.winProb != null && base.winProb != null) ? (out.winProb - base.winProb) : null;

      results.push({
        lever: lv.lever,
        dVolunteers: dVol,
        dCost: dCost,
        dProb: dProb
      });
    }

    // Rankings:
    // Volunteers: want most negative dVolunteers
    const rVol = stableSort(results.map(r => ({ lever: r.lever, value: r.dVolunteers })), "value", 1).slice(0,5);
    // But stableSort above sorts asc; value null -> Infinity. Works: most negative at top.
    // Cost: most negative dCost
    const rCost = stableSort(results.map(r => ({ lever: r.lever, value: r.dCost })), "value", 1).slice(0,5);
    // Probability: most positive dProb (desc)
    const rProb = stableSort(results.map(r => ({ lever: r.lever, value: r.dProb })), "value", -1).slice(0,5);

    const pick = (arr) => (arr && arr.length && arr[0]?.lever) ? arr[0].lever : "—";

    return {
      ok: true,
      warning: null,
      bottlenecks,
      rankings: {
        volunteers: rVol,
        cost: rCost,
        probability: rProb
      },
      recs: {
        volunteers: `Best lever for lowering volunteer load: ${pick(rVol)}`,
        cost: `Best lever for lowering cost: ${pick(rCost)}`,
        probability: `Best lever for raising win probability: ${pick(rProb)}`
      }
    };
  } catch (e){
    return {
      ...safeStub,
      ok: false,
      warning: `Decision Intelligence failed (analysis error): ${e?.message ? String(e.message) : "unknown error"}.`
    };
  }
}
