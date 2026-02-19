// js/core/timeline.js
// Phase 7 — Timeline / Production feasibility (pure, deterministic)

import { computeMaxAttemptsByTactic } from "./timelineOptimizer.js";

function num(v, fb = null){
  if (v === null || v === undefined || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function clamp0(v){
  const n = num(v, 0);
  return n < 0 ? 0 : n;
}

export function computeTimelineFeasibility(args){
  const enabled = !!args?.enabled;
  if (!enabled){
    return {
      enabled: false,
      requiredAttemptsTotal: clamp0(args?.requiredAttemptsTotal ?? 0),
      executableAttemptsTotal: clamp0(args?.requiredAttemptsTotal ?? 0),
      percentPlanExecutable: 1,
      shortfallAttempts: 0,
      constraintType: null,
      weekly: []
    };
  }

  const required = args?.required || {};
  let requiredTotal = 0;
  for (const k of Object.keys(required)){
    requiredTotal += clamp0(required[k]);
  }

  const capsWrap = computeMaxAttemptsByTactic(args) || { maxAttemptsByTactic: {} };
  const caps = capsWrap.maxAttemptsByTactic || {};
  let executableTotal = 0;
  for (const k of Object.keys(required)){
    const need = clamp0(required[k]);
    const cap = clamp0(caps[k] ?? 0);
    executableTotal += Math.min(need, cap);
  }

  const percent = (requiredTotal <= 0) ? 1 : Math.max(0, Math.min(1, executableTotal / requiredTotal));
  const shortfall = Math.max(0, requiredTotal - executableTotal);

  return {
    enabled: true,
    requiredAttemptsTotal: requiredTotal,
    executableAttemptsTotal: executableTotal,
    percentPlanExecutable: percent,
    shortfallAttempts: shortfall,
    constraintType: shortfall > 0 ? "Timeline-limited" : null,
    weekly: [] // UI can build a detailed schedule later; R0/R1 don’t need it
  };
}
