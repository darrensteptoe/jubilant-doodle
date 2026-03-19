// @ts-check
// js/core/timeline.js
// Phase 7 — Timeline / Production feasibility (pure, deterministic)

import { computeMaxAttemptsByTactic } from "./timelineOptimizer.js";
import { computeTimelineCapsSummary } from "./timelineCapsInput.js";
import { clampFiniteNumber, formatPercentFromUnit, formatWholeNumberByMode, safeNum } from "./utils.js";

/**
 * @param {unknown} v
 * @param {number | null} [fb]
 * @returns {number | null}
 */
function num(v, fb = null){
  const n = safeNum(v);
  return n == null ? fb : n;
}

/**
 * @param {Record<string, any> | null | undefined} args
 * @returns {number}
 */
function resolveObjectiveValuePerAttempt(args){
  return clampFiniteNumber(num(args?.objectiveValuePerAttempt, num(args?.netVotesPerAttempt, 0)), 0, Number.POSITIVE_INFINITY);
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
 * Resolve canonical objective-value-per-attempt from optimizer totals.
 * @param {Record<string, any> | null | undefined} totals
 * @returns {number | null}
 */
export function resolveTimelineObjectiveValuePerAttemptFromTotals(totals){
  const src = totals && typeof totals === "object" ? totals : {};
  const attempts = num(src?.attempts, null);
  const objectiveTotal = num(src?.objectiveValue, num(src?.netVotes, null));
  if (attempts == null || objectiveTotal == null || attempts <= 0){
    return null;
  }
  return objectiveTotal / attempts;
}

/**
 * Normalize timeline weekly plan rows for state/render consumers.
 * @param {unknown[]} weeklyRows
 * @returns {Array<{ week: number | null, attempts: number | null }>}
 */
export function normalizeTimelineWeeklyPlanRows(weeklyRows){
  const rows = Array.isArray(weeklyRows) ? weeklyRows : [];
  return rows.map((row) => ({
    week: num(row?.week, null),
    attempts: num(row?.attempts, null),
  }));
}

/**
 * Canonical timeline snapshot object for state persistence.
 * @param {{
 *   timelineResult?: Record<string, any> | null,
 *   objectiveMeta?: Record<string, any> | null,
 *   weeklyPlan?: Array<{ week: number | null, attempts: number | null }> | null,
 * }} input
 * @returns {{
 *   percentPlanExecutable: number | null,
 *   projectedCompletionWeek: number | null,
 *   shortfallAttempts: number | null,
 *   shortfallObjectiveValue: number | null,
 *   shortfallNetVotes: number | null,
 *   constraintType: string | null,
 *   weeklyPlan: Array<{ week: number | null, attempts: number | null }>,
 * }}
 */
export function buildTimelineStateSnapshot({
  timelineResult = null,
  objectiveMeta = null,
  weeklyPlan = null,
} = {}){
  const tl = timelineResult && typeof timelineResult === "object" ? timelineResult : {};
  const objective = objectiveMeta && typeof objectiveMeta === "object"
    ? objectiveMeta
    : getTimelineFeasibilityObjectiveMeta(tl);
  const normalizedWeeklyPlan = normalizeTimelineWeeklyPlanRows(weeklyPlan ?? tl?.weekly);
  return {
    percentPlanExecutable: num(tl?.percentPlanExecutable, null),
    projectedCompletionWeek: num(tl?.projectedCompletionWeek, null),
    shortfallAttempts: num(tl?.shortfallAttempts, null),
    shortfallObjectiveValue: num(objective?.shortfallObjectiveValue, num(tl?.shortfallObjectiveValue, num(tl?.shortfallNetVotes, null))),
    shortfallNetVotes: num(objective?.shortfallObjectiveValue, num(tl?.shortfallObjectiveValue, num(tl?.shortfallNetVotes, null))),
    constraintType: tl?.constraintType ? String(tl.constraintType) : null,
    weeklyPlan: normalizedWeeklyPlan,
  };
}

/**
 * Canonical timeline display projection for UI surfaces.
 * Keeps text/banner derivation out of render modules.
 * @param {{
 *   timelineResult?: Record<string, any> | null,
 *   objectiveMeta?: Record<string, any> | null,
 *   weeklyPlan?: Array<{ week: number | null, attempts: number | null }> | null,
 *   formatWhole?: ((value: number) => string) | null,
 *   formatPercent?: ((value: number) => string) | null,
 *   buildWeekPreviewText?: ((rows: Array<{ week: number | null, attempts: number | null }>) => string) | null,
 * }} input
 * @returns {{
 *   executableText: string,
 *   projectedCompletionWeekText: string,
 *   shortfallAttemptsText: string,
 *   constraintText: string,
 *   shortfallObjectiveText: string,
 *   weekPreviewText: string,
 *   bannerKind: string,
 *   bannerText: string,
 * }}
 */
export function buildTimelineFeasibilityDisplayView({
  timelineResult = null,
  objectiveMeta = null,
  weeklyPlan = null,
  formatWhole = null,
  formatPercent = null,
  buildWeekPreviewText = null,
} = {}){
  const tl = timelineResult && typeof timelineResult === "object" ? timelineResult : {};
  const objective = objectiveMeta && typeof objectiveMeta === "object"
    ? objectiveMeta
    : getTimelineFeasibilityObjectiveMeta(tl);
  const normalizedWeeklyPlan = normalizeTimelineWeeklyPlanRows(weeklyPlan ?? tl?.weekly);
  const formatWholeText = typeof formatWhole === "function"
    ? formatWhole
    : (value) => formatWholeNumberByMode(value, { mode: "round", fallback: "0" });
  const formatPercentText = typeof formatPercent === "function"
    ? formatPercent
    : (value) => formatPercentFromUnit(clampFiniteNumber(value, 0, 1), 0);
  const previewText = typeof buildWeekPreviewText === "function"
    ? buildWeekPreviewText(normalizedWeeklyPlan)
    : "—";

  const percentPlanExecutable = num(tl?.percentPlanExecutable, null);
  const projectedCompletionWeek = num(tl?.projectedCompletionWeek, null);
  const shortfallAttempts = num(tl?.shortfallAttempts, null);
  const shortfallObjectiveValue = num(objective?.shortfallObjectiveValue, num(tl?.shortfallObjectiveValue, num(tl?.shortfallNetVotes, null)));

  const executableText = percentPlanExecutable == null ? "—" : formatPercentText(percentPlanExecutable);
  const projectedCompletionWeekText = projectedCompletionWeek == null ? "—" : String(projectedCompletionWeek);
  const shortfallAttemptsText = shortfallAttempts == null ? "—" : formatWholeText(shortfallAttempts);
  const constraintText = tl?.constraintType ? String(tl.constraintType) : "—";
  const shortfallObjectiveText = shortfallObjectiveValue == null ? "—" : formatWholeText(shortfallObjectiveValue);

  const hasShortfall = percentPlanExecutable != null && percentPlanExecutable < 1;
  const bannerText = hasShortfall
    ? `Timeline feasibility: ${executableText} executable · shortfall ${shortfallAttemptsText} attempts.`
    : "";

  return {
    executableText,
    projectedCompletionWeekText,
    shortfallAttemptsText,
    constraintText,
    shortfallObjectiveText,
    weekPreviewText: previewText || "—",
    bannerKind: hasShortfall ? "warn" : "",
    bannerText,
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
    const requiredAttemptsTotal = clampFiniteNumber(args?.requiredAttemptsTotal ?? 0, 0, Number.POSITIVE_INFINITY);
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
    requiredTotal += clampFiniteNumber(required[k], 0, Number.POSITIVE_INFINITY);
  }

  const capsSummary = computeTimelineCapsSummary({
    capsInput: args,
    computeMaxAttemptsByTactic,
    requireEnabled: false,
  });
  const caps = capsSummary.capsByTactic || {};
  let executableTotal = 0;
  for (const k of Object.keys(required)){
    const need = clampFiniteNumber(required[k], 0, Number.POSITIVE_INFINITY);
    const cap = clampFiniteNumber(caps[k] ?? 0, 0, Number.POSITIVE_INFINITY);
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
