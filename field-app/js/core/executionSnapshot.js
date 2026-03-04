// js/core/executionSnapshot.js
// Canonical execution snapshot compiler (pure).
// Consumes planning snapshot + observed logs to produce pace and drift context.

import { safeNum } from "./utils.js";

function toNum(v, safeNumFn){
  const n = (typeof safeNumFn === "function") ? safeNumFn(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function attemptsFromLogEntry(entry, safeNumFn){
  const doors = toNum(entry?.doors, safeNumFn);
  const calls = toNum(entry?.calls, safeNumFn);
  const explicit = entry?.attempts;
  if (explicit != null && explicit !== ""){
    return toNum(explicit, safeNumFn);
  }
  return doors + calls;
}

function convosFromLogEntry(entry, safeNumFn){
  return toNum(entry?.convos, safeNumFn);
}

function supportIdsFromLogEntry(entry, safeNumFn){
  return toNum(entry?.supportIds, safeNumFn);
}

function orgHoursFromLogEntry(entry, safeNumFn){
  return toNum(entry?.orgHours, safeNumFn);
}

function normalizeIsoDate(dateRaw){
  const s = String(dateRaw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

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
    days = Math.max(1, Math.ceil(ms / 86400000) + 1);
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

  const rollingCR = log.sumAttemptsWindow > 0 ? (log.sumConvosWindow / log.sumAttemptsWindow) : null;
  const rollingSR = log.sumConvosWindow > 0 ? (log.sumSupportIdsWindow / log.sumConvosWindow) : null;
  const rollingAPH = log.sumOrgHoursWindow > 0 ? (log.sumAttemptsWindow / log.sumOrgHoursWindow) : null;

  const requiredAttemptsPerWeek = weeklyContext?.attemptsPerWeek ?? null;
  const attemptsNeeded = weeklyContext?.attemptsNeeded ?? null;
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

  let projectedSlipDays = null;
  if (attemptsNeeded != null && Number.isFinite(attemptsNeeded) && attemptsNeeded > 0 && log.sumAttemptsWindow > 0){
    const remaining = Math.max(0, attemptsNeeded - log.sumAttemptsAll);
    const weeksRemaining = planningSnapshot?.weeks;
    if (weeksRemaining != null && Number.isFinite(weeksRemaining) && weeksRemaining > 0){
      const projectedWeeks = remaining / log.sumAttemptsWindow;
      projectedSlipDays = Math.max(0, Math.round((projectedWeeks - weeksRemaining) * 7));
    }
  }

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

