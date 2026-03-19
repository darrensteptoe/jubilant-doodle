// js/core/executionSnapshot.js
// Canonical execution snapshot compiler (pure).
// Consumes planning snapshot + observed logs to produce pace and drift context.
// @ts-check

import { roundWholeNumberByMode, safeNum } from "./utils.js";
import { computeProjectedSlipDays } from "./executionPlanner.js";
import { computeBlendedAttemptsPerHour } from "./model.js";

/**
 * @param {unknown} v
 * @param {(v: unknown) => number|null} safeNumFn
 * @returns {number}
 */
function toNum(v, safeNumFn){
  const n = (typeof safeNumFn === "function") ? safeNumFn(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {Record<string, any>} entry
 * @param {(v: unknown) => number|null} safeNumFn
 * @returns {number}
 */
function attemptsFromLogEntry(entry, safeNumFn){
  const doors = toNum(entry?.doors, safeNumFn);
  const calls = toNum(entry?.calls, safeNumFn);
  const explicit = entry?.attempts;
  if (explicit != null && explicit !== ""){
    return toNum(explicit, safeNumFn);
  }
  return doors + calls;
}

/**
 * Canonical attempts resolver for daily-log rows.
 * @param {Record<string, any> | null | undefined} entry
 * @param {(v: unknown) => number|null} [safeNumFn]
 * @returns {number}
 */
export function deriveExecutionAttemptsFromLogEntry(entry, safeNumFn = safeNum){
  const row = entry && typeof entry === "object" ? entry : {};
  return attemptsFromLogEntry(row, safeNumFn);
}

/**
 * @param {Record<string, any>} entry
 * @param {(v: unknown) => number|null} safeNumFn
 * @returns {number}
 */
function convosFromLogEntry(entry, safeNumFn){
  return toNum(entry?.convos, safeNumFn);
}

/**
 * @param {Record<string, any>} entry
 * @param {(v: unknown) => number|null} safeNumFn
 * @returns {number}
 */
function supportIdsFromLogEntry(entry, safeNumFn){
  return toNum(entry?.supportIds, safeNumFn);
}

/**
 * @param {Record<string, any>} entry
 * @param {(v: unknown) => number|null} safeNumFn
 * @returns {number}
 */
function orgHoursFromLogEntry(entry, safeNumFn){
  return toNum(entry?.orgHours, safeNumFn);
}

/**
 * @param {unknown} dateRaw
 * @returns {Date|null}
 */
function normalizeIsoDate(dateRaw){
  const s = String(dateRaw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

/**
 * @param {{
 *   dailyLog?: Array<Record<string, any>>,
 *   windowN?: number,
 *   safeNumFn?: (v: unknown) => number|null
 * }} args
 * @returns {{
 *   hasLog:boolean,
 *   sorted:Array<Record<string, any>>,
 *   window:Array<Record<string, any>>,
 *   windowN:number,
 *   entries:number,
 *   firstDate:Date|null,
 *   lastDate:Date|null,
 *   days:number|null,
 *   sumAttemptsWindow:number,
 *   sumConvosWindow:number,
 *   sumSupportIdsWindow:number,
 *   sumOrgHoursWindow:number,
 *   sumAttemptsAll:number
 * }}
 */
function summarizeDailyLog({ dailyLog, windowN = 7, safeNumFn = safeNum } = {}){
  const raw = Array.isArray(dailyLog) ? dailyLog : [];
  const sorted = raw
    .filter((x) => x && x.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (!sorted.length){
    return {
      hasLog: false,
      sorted: [],
      window: [],
      windowN: Math.max(1, windowN | 0),
      entries: 0,
      firstDate: null,
      lastDate: null,
      days: null,
      sumAttemptsWindow: 0,
      sumConvosWindow: 0,
      sumSupportIdsWindow: 0,
      sumOrgHoursWindow: 0,
      sumAttemptsAll: 0,
    };
  }

  const useWindowN = Math.max(1, windowN | 0);
  const window = sorted.slice(-useWindowN);

  let sumAttemptsWindow = 0;
  let sumConvosWindow = 0;
  let sumSupportIdsWindow = 0;
  let sumOrgHoursWindow = 0;
  let sumAttemptsAll = 0;

  for (const row of sorted){
    sumAttemptsAll += attemptsFromLogEntry(row, safeNumFn);
  }
  for (const row of window){
    sumAttemptsWindow += attemptsFromLogEntry(row, safeNumFn);
    sumConvosWindow += convosFromLogEntry(row, safeNumFn);
    sumSupportIdsWindow += supportIdsFromLogEntry(row, safeNumFn);
    sumOrgHoursWindow += orgHoursFromLogEntry(row, safeNumFn);
  }

  const firstDate = normalizeIsoDate(window[0]?.date);
  const lastDate = normalizeIsoDate(window[window.length - 1]?.date);
  let days = null;
  if (firstDate && lastDate){
    const ms = lastDate.getTime() - firstDate.getTime();
    const daySpan = roundWholeNumberByMode(ms / 86400000, { mode: "ceil", fallback: 0 }) ?? 0;
    days = Math.max(1, daySpan + 1);
  }

  return {
    hasLog: true,
    sorted,
    window,
    windowN: useWindowN,
    entries: window.length,
    firstDate,
    lastDate,
    days,
    sumAttemptsWindow,
    sumConvosWindow,
    sumSupportIdsWindow,
    sumOrgHoursWindow,
    sumAttemptsAll,
  };
}

/**
 * @param {{
 *   dailyLog?: Array<Record<string, any>>,
 *   windowN?: number,
 *   safeNumFn?: (v: unknown) => number|null
 * }} args
 * @returns {{
 *   hasLog:boolean,
 *   sorted:Array<Record<string, any>>,
 *   window:Array<Record<string, any>>,
 *   windowN:number,
 *   entries:number,
 *   firstDate:Date|null,
 *   lastDate:Date|null,
 *   days:number|null,
 *   sumAttemptsWindow:number,
 *   sumConvosWindow:number,
 *   sumSupportIdsWindow:number,
 *   sumOrgHoursWindow:number,
 *   sumAttemptsAll:number
 * }}
 */
export function summarizeExecutionDailyLog(args = {}){
  return summarizeDailyLog(args);
}

/**
 * @param {{
 *   sumAttempts?: unknown,
 *   sumConvos?: unknown,
 *   sumSupportIds?: unknown,
 *   sumOrgHours?: unknown,
 *   safeNumFn?: (v: unknown) => number|null
 * }} args
 * @returns {{ cr:number|null, sr:number|null, aph:number|null }}
 */
export function computeRollingExecutionRates({
  sumAttempts = 0,
  sumConvos = 0,
  sumSupportIds = 0,
  sumOrgHours = 0,
  safeNumFn = safeNum,
} = {}){
  const attempts = toNum(sumAttempts, safeNumFn);
  const convos = toNum(sumConvos, safeNumFn);
  const supportIds = toNum(sumSupportIds, safeNumFn);
  const orgHours = toNum(sumOrgHours, safeNumFn);
  return {
    cr: attempts > 0 ? (convos / attempts) : null,
    sr: convos > 0 ? (supportIds / convos) : null,
    aph: orgHours > 0 ? (attempts / orgHours) : null,
  };
}

/**
 * @param {Record<string, any> | null | undefined} weeklyContext
 * @returns {number | null}
 */
export function computeExpectedAphFromWeeklyContext(weeklyContext){
  const ctx = weeklyContext && typeof weeklyContext === "object" ? weeklyContext : {};
  return computeBlendedAttemptsPerHour({
    doorShare: ctx?.doorShare,
    doorsPerHour: ctx?.doorsPerHour,
    callsPerHour: ctx?.callsPerHour,
  });
}

/**
 * @param {{
 *   planningSnapshot?: Record<string, any>|null,
 *   weeklyContext?: Record<string, any>|null,
 *   dailyLog?: Array<Record<string, any>>,
 *   assumedCR?: number|null,
 *   assumedSR?: number|null,
 *   expectedAPH?: number|null,
 *   windowN?: number,
 *   safeNumFn?: (v: unknown) => number|null
 * }} args
 * @returns {Record<string, any>}
 */
export function computeExecutionSnapshot({
  planningSnapshot = null,
  weeklyContext = null,
  dailyLog = [],
  assumedCR = null,
  assumedSR = null,
  expectedAPH = null,
  windowN = 7,
  safeNumFn = safeNum,
} = {}){
  const log = summarizeDailyLog({ dailyLog, windowN, safeNumFn });
  const rolling = computeRollingExecutionRates({
    sumAttempts: log.sumAttemptsWindow,
    sumConvos: log.sumConvosWindow,
    sumSupportIds: log.sumSupportIdsWindow,
    sumOrgHours: log.sumOrgHoursWindow,
    safeNumFn,
  });
  const rollingCR = rolling.cr;
  const rollingSR = rolling.sr;
  const rollingAPH = rolling.aph;

  const requiredAttemptsPerWeek = weeklyContext?.attemptsPerWeek ?? null;
  const capacityAttemptsPerWeek = weeklyContext?.capTotal ?? null;
  const attemptsNeeded = weeklyContext?.attemptsNeeded ?? null;
  const gapAttemptsPerWeek = (weeklyContext?.gap != null)
    ? weeklyContext.gap
    : (
        requiredAttemptsPerWeek != null &&
        Number.isFinite(requiredAttemptsPerWeek) &&
        capacityAttemptsPerWeek != null &&
        Number.isFinite(capacityAttemptsPerWeek)
      )
      ? (requiredAttemptsPerWeek - capacityAttemptsPerWeek)
      : null;
  const ratio = (requiredAttemptsPerWeek != null && Number.isFinite(requiredAttemptsPerWeek) && requiredAttemptsPerWeek > 0)
    ? (log.sumAttemptsWindow / requiredAttemptsPerWeek)
    : null;

  const flags = [];
  const tol = 0.90;
  if (assumedCR != null && Number.isFinite(assumedCR) && rollingCR != null && Number.isFinite(rollingCR) && rollingCR < assumedCR * tol){
    flags.push("contact rate below assumed");
  }
  if (assumedSR != null && Number.isFinite(assumedSR) && rollingSR != null && Number.isFinite(rollingSR) && rollingSR < assumedSR * tol){
    flags.push("support rate below assumed");
  }
  if (expectedAPH != null && Number.isFinite(expectedAPH) && rollingAPH != null && Number.isFinite(rollingAPH) && rollingAPH < expectedAPH * tol){
    flags.push("productivity below assumed");
  }

  let status = "Needs inputs";
  if (!log.hasLog){
    status = "Not tracking";
  } else if (ratio == null || !Number.isFinite(ratio)){
    status = flags.length ? "Assumptions drifting" : "Needs inputs";
  } else if (ratio >= 1.0 && flags.length === 0){
    status = "On pace";
  } else if (ratio >= 1.0 && flags.length){
    status = "On pace (assumptions off)";
  } else if (ratio >= 0.85 && flags.length === 0){
    status = "Slightly behind";
  } else if (ratio >= 0.85 && flags.length){
    status = "Behind (rates/capacity off)";
  } else {
    status = "Behind";
  }

  const projectedSlipDays = computeProjectedSlipDays({
    attemptsNeeded,
    attemptsCompleted: log.sumAttemptsAll,
    attemptsPerWeek: log.sumAttemptsWindow,
    weeksRemaining: planningSnapshot?.weeks,
  });

  return {
    weeklyContext,
    log,
    rolling: {
      cr: rollingCR,
      sr: rollingSR,
      aph: rollingAPH,
    },
    assumptions: {
      cr: assumedCR,
      sr: assumedSR,
      aph: expectedAPH,
    },
    pace: {
      requiredAttemptsPerWeek,
      capacityAttemptsPerWeek,
      gapAttemptsPerWeek,
      ratio,
      status,
      projectedSlipDays,
    },
    drift: {
      flags,
      hasDrift: flags.length > 0,
      primary: flags[0] || null,
    },
  };
}
