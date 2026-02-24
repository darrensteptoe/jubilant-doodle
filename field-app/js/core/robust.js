// js/core/robust.js
// Phase R2 — Robust / risk-aware plan selection (wrapper only).
// This module does NOT change the optimizer; it only ranks candidate plans
// based on Monte Carlo evaluation + risk metrics.

import * as risk from "./risk.js";

const DEFAULT_LAMBDA_CVAR = 0.50;
const DEFAULT_CVAR_Q = 0.10;

function isFiniteNumber(x){
  return typeof x === "number" && Number.isFinite(x);
}

function scoreFromRiskSummary(riskSummary, objective){
  const rs = riskSummary || {};
  const obj = objective || "max_prob_win";
  if (obj === "max_prob_win") return isFiniteNumber(rs.probWin) ? rs.probWin : -Infinity;
  if (obj === "max_p25_margin") return isFiniteNumber(rs.p25) ? rs.p25 : -Infinity;
  if (obj === "max_expected_margin") return isFiniteNumber(rs.mean) ? rs.mean : -Infinity;
  if (obj === "max_expected_minus_lambda_cvar"){
    const mu = isFiniteNumber(rs.mean) ? rs.mean : -Infinity;
    const cvar = isFiniteNumber(rs.cvar10) ? rs.cvar10 : -Infinity;
    return mu - DEFAULT_LAMBDA_CVAR * cvar;
  }
  // Unknown objective: fall back to max_prob_win.
  return isFiniteNumber(rs.probWin) ? rs.probWin : -Infinity;
}

export function selectPlan({ candidates, evaluateFn, objective, seed } = {}){
  const arr = Array.isArray(candidates) ? candidates : [];
  const evalFn = evaluateFn;
  if (typeof evalFn !== "function"){
    return { best: null, ranked: [], diagnostics: { error: "evaluateFn required" } };
  }

  const ranked = [];
  for (let i=0;i<arr.length;i++){
    const plan = arr[i];
    const ev = evalFn(plan, seed);
    const margins = ev?.margins;

    const rs0 = ev?.riskSummary || (Array.isArray(margins) ? risk.summaryFromMargins(margins) : null);
    const rs = rs0 ? { ...rs0 } : null;
    if (rs && Array.isArray(margins)){
      rs.cvar10 = risk.conditionalValueAtRisk(margins, DEFAULT_CVAR_Q);
    }

    const score = scoreFromRiskSummary(rs, objective);
    ranked.push({ plan, score, evaluation: ev || null, riskSummary: rs });
  }

  ranked.sort((a,b)=>{
    if (a.score === b.score) return 0;
    return (a.score > b.score) ? -1 : 1;
  });

  return {
    best: ranked.length ? ranked[0] : null,
    ranked,
    diagnostics: { objective: objective || "max_prob_win", seed: seed ?? "" }
  };
}

// Optional helper: evaluate a plan by patching scenario state and running MC.
// This stays generic; the UI can decide how to construct candidate plans.
//
// Expected `state` fields:
// - scenario: base scenario object
// - res, weeks, needVotes, runs
// - runMonteCarloSim: function that calls core Monte Carlo (must accept includeMargins)
//
// Expected plan fields:
// - patchScenario: object merged into scenario
export function evaluatePlan(plan, state, seed){
  const st = state || {};
  const run = st.runMonteCarloSim;
  if (typeof run !== "function"){
    return { error: "state.runMonteCarloSim required" };
  }

  const baseScenario = st.scenario || {};
  const patch = plan?.patchScenario || {};

  const merge = (target, src) => {
    if (!src || typeof src !== "object") return;
    for (const k of Object.keys(src)){
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v)){
        if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
        merge(target[k], v);
      } else {
        target[k] = v;
      }
    }
  };

  const scenario = structuredClone(baseScenario);
  merge(scenario, patch);

  const sim = run({
    scenario,
    res: st.res,
    weeks: st.weeks,
    needVotes: st.needVotes,
    runs: st.runs,
    seed: seed ?? "",
    includeMargins: true,
  });

  const margins = sim?.margins;
  const rsBase = Array.isArray(margins) ? risk.summaryFromMargins(margins) : null;
  const rs = rsBase && Array.isArray(margins)
    ? { ...rsBase, cvar10: risk.conditionalValueAtRisk(margins, DEFAULT_CVAR_Q) }
    : rsBase;

  return { sim, margins, riskSummary: rs };
}
