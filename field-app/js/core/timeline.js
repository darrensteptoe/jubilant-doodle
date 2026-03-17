// @ts-check
// js/core/timeline.js
// Phase 7 — Timeline / Production feasibility (pure, deterministic)

import { computeMaxAttemptsByTactic } from "./timelineOptimizer.js";

/**
 * @param {unknown} v
 * @param {number | null} [fb]
 * @returns {number | null}
 */
function num(v, fb = null){
  if (v === null || v === undefined || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function clamp0(v){
  const n = num(v, 0);
  return n < 0 ? 0 : n;
}

/**
 * @param {Record<string, any> | null | undefined} args
 * @returns {number}
 */
function resolveObjectiveValuePerAttempt(args){
  return clamp0(num(args?.objectiveValuePerAttempt, num(args?.netVotesPerAttempt, 0)));
}

/**
 * Resolve canonical timeline-feasibility objective fields with compatibility fallbacks.
 *
 * @param {Record<string, any> | null | undefined} timeline
 * @returns {{
 *   objectiveValuePerAttempt: number,
 *   shortfallObjectiveValue: number | null,
 * }}
 */
export function getTimelineFeasibilityObjectiveMeta(timeline){
  const src = timeline && typeof timeline === "object" ? timeline : {};
  return {
    objectiveValuePerAttempt: resolveObjectiveValuePerAttempt(src),
    shortfallObjectiveValue: num(src.shortfallObjectiveValue, num(src.shortfallNetVotes, null)),
  };
}

/**
 * @param {{
 *   enabled?: boolean,
 *   requiredAttemptsTotal?: number,
 *   required?: Record<string, number>
 * } & Record<string, any>} args
 */
export function computeTimelineFeasibility(args){
  const enabled = !!args?.enabled;
  const objectiveValuePerAttempt = resolveObjectiveValuePerAttempt(args);
  if (!enabled){
    const requiredAttemptsTotal = clamp0(args?.requiredAttemptsTotal ?? 0);
    const executableAttemptsTotal = requiredAttemptsTotal;
    const shortfallAttempts = 0;
    const shortfallObjectiveValue = 0;
    return {
      enabled: false,
      objectiveValuePerAttempt,
      requiredAttemptsTotal,
      executableAttemptsTotal,
      percentPlanExecutable: 1,
      shortfallAttempts,
      shortfallObjectiveValue,
      shortfallNetVotes: shortfallObjectiveValue,
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
  const shortfallObjectiveValue = shortfall * objectiveValuePerAttempt;

  return {
    enabled: true,
    objectiveValuePerAttempt,
    requiredAttemptsTotal: requiredTotal,
    executableAttemptsTotal: executableTotal,
    percentPlanExecutable: percent,
    shortfallAttempts: shortfall,
    shortfallObjectiveValue,
    shortfallNetVotes: shortfallObjectiveValue,
    constraintType: shortfall > 0 ? "Timeline-limited" : null,
    weekly: [] // UI can build a detailed schedule later; R0/R1 don’t need it
  };
}
