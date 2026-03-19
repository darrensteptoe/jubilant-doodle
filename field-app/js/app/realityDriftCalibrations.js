// @ts-check
import { NULL_BASE_RATE_DEFAULTS, resolveStateBaseRates } from "../core/baseRates.js";
import {
  computeRollingExecutionRates,
  summarizeExecutionDailyLog,
} from "../core/executionSnapshot.js";
import {
  computeBlendedAttemptsPerHourFromState,
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorsPerHour,
  setCanonicalCallsPerHour,
  setCanonicalDoorsPerHour as setCanonicalDoorsPerHourCore,
} from "../core/throughput.js";
import { roundToDigits } from "../core/utils.js";

export function computeRealityDriftModule({ state, safeNum, windowN = 7 } = {}){
  const summary = summarizeExecutionDailyLog({
    dailyLog: Array.isArray(state?.ui?.dailyLog) ? state.ui.dailyLog : [],
    windowN,
    safeNumFn: safeNum,
  });
  if (!summary.hasLog){
    return {
      hasLog: false,
      flags: [],
      primary: null,
      windowEntries: 0,
      windowStart: null,
      windowEnd: null,
      firstDate: null,
      lastDate: null,
    };
  }
  const rolling = computeRollingExecutionRates({
    sumAttempts: summary.sumAttemptsWindow,
    sumConvos: summary.sumConvosWindow,
    sumSupportIds: summary.sumSupportIdsWindow,
    sumOrgHours: summary.sumOrgHoursWindow,
    safeNumFn: safeNum,
  });
  const actualCR = rolling.cr;
  const actualSR = rolling.sr;
  const actualAPH = rolling.aph;

  const baseRates = resolveStateBaseRates(state, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  const assumedCR = baseRates.cr;
  const assumedSR = baseRates.sr;

  const expectedAPH = computeBlendedAttemptsPerHourFromState(state, { toNumber: safeNum });

  const flags = [];
  const tol = 0.90; // 10% below assumed => flag
  const gaps = [];

  if (assumedCR != null && actualCR != null && isFinite(actualCR) && assumedCR > 0 && actualCR < assumedCR * tol){
    flags.push("contact rate below assumed");
    gaps.push({ k: "contact", r: (assumedCR - actualCR) / assumedCR });
  }
  if (assumedSR != null && actualSR != null && isFinite(actualSR) && assumedSR > 0 && actualSR < assumedSR * tol){
    flags.push("support rate below assumed");
    gaps.push({ k: "support", r: (assumedSR - actualSR) / assumedSR });
  }
  if (expectedAPH != null && actualAPH != null && isFinite(actualAPH) && expectedAPH > 0 && actualAPH < expectedAPH * tol){
    flags.push("productivity below assumed");
    gaps.push({ k: "productivity", r: (expectedAPH - actualAPH) / expectedAPH });
  }

  let primary = null;
  if (gaps.length){
    gaps.sort((a, b) => (b.r - a.r));
    primary = gaps[0].k;
  }

  return {
    hasLog: true,
    flags,
    primary,
    windowEntries: summary.window.length,
    windowStart: summary.window[0]?.date || null,
    windowEnd: summary.window[summary.window.length - 1]?.date || null,
    firstDate: summary.sorted[0]?.date || null,
    lastDate: summary.sorted[summary.sorted.length - 1]?.date || null,
    actualCR, actualSR, actualAPH,
    assumedCR, assumedSR, expectedAPH
  };
}

export function applyRollingRateToAssumptionModule({
  kind,
  computeRealityDrift,
  state,
  els,
  safeNum,
  clamp,
  setCanonicalDoorsPerHour,
  markMcStale,
  commitUIUpdate,
} = {}){
  const drift = (typeof computeRealityDrift === "function") ? computeRealityDrift() : null;
  if (!drift?.hasLog){
    if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "No daily log yet";
    return;
  }

  const pct1 = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? roundToDigits(n * 100, 1, null) : null;
  };
  const num1 = (x) => roundToDigits(x, 1, null);
  let changed = false;
  const writeDoorsPerHour = (typeof setCanonicalDoorsPerHour === "function")
    ? setCanonicalDoorsPerHour
    : setCanonicalDoorsPerHourCore;

  if (kind === "contact"){
    const v = pct1(drift.actualCR);
    if (v == null){
      if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling contact rate is unavailable";
      return;
    }
    state.contactRatePct = v;
    if (els?.contactRatePct) els.contactRatePct.value = String(v);
    if (els?.applyRollingMsg) els.applyRollingMsg.textContent = `Set assumed contact rate to ${v}%`;
    changed = true;
  } else if (kind === "support"){
    const v = pct1(drift.actualSR);
    if (v == null){
      if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling support rate is unavailable";
      return;
    }
    state.supportRatePct = v;
    if (els?.supportRatePct) els.supportRatePct.value = String(v);
    if (els?.applyRollingMsg) els.applyRollingMsg.textContent = `Set assumed support rate to ${v}%`;
    changed = true;
  } else if (kind === "productivity"){
    const actualAPH = num1(drift.actualAPH);
    const expectedAPH = num1(drift.expectedAPH);
    if (actualAPH == null || actualAPH <= 0){
      if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling productivity is unavailable";
      return;
    }
    if (expectedAPH == null || expectedAPH <= 0){
      if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "Expected productivity baseline is unavailable";
      return;
    }

    const curDoors = resolveCanonicalDoorsPerHour(state, { toNumber: safeNum });
    const curCalls = resolveCanonicalCallsPerHour(state, { toNumber: safeNum });
    if (curDoors == null || curDoors <= 0 || curCalls == null || curCalls <= 0){
      if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "Current productivity assumptions are invalid";
      return;
    }

    const ratioRaw = actualAPH / expectedAPH;
    const ratio = clamp(ratioRaw, 0.5, 1.5);
    const nextDoors = num1(Math.max(1, curDoors * ratio));
    const nextCalls = num1(Math.max(1, curCalls * ratio));

    writeDoorsPerHour(state, nextDoors);
    setCanonicalCallsPerHour(state, nextCalls, { toNumber: safeNum });

    if (els?.doorsPerHour3) els.doorsPerHour3.value = String(nextDoors);
    if (els?.callsPerHour3) els.callsPerHour3.value = String(nextCalls);
    if (els?.applyRollingMsg){
      const pct = roundToDigits((ratio - 1) * 100, 1, 0);
      const adj = (ratio !== ratioRaw) ? " (clamped)" : "";
      const sign = pct >= 0 ? "+" : "";
      els.applyRollingMsg.textContent = `Scaled productivity ${sign}${pct}%${adj}: doors/hr ${nextDoors}, calls/hr ${nextCalls}`;
    }
    changed = true;
  }

  if (changed){
    markMcStale();
    commitUIUpdate();
  }
}

export function applyAllRollingCalibrationsModule({
  computeRealityDrift,
  state,
  els,
  safeNum,
  clamp,
  setCanonicalDoorsPerHour,
  markMcStale,
  commitUIUpdate,
  setLastAppliedWeeklyAction,
  syncWeeklyUndoUI,
} = {}){
  const drift = (typeof computeRealityDrift === "function") ? computeRealityDrift() : null;
  if (!drift?.hasLog){
    if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "No daily log yet";
    return;
  }

  const prevState = structuredClone(state);
  const pct1 = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? roundToDigits(n * 100, 1, null) : null;
  };
  const num1 = (x) => roundToDigits(x, 1, null);
  const applied = [];
  const writeDoorsPerHour = (typeof setCanonicalDoorsPerHour === "function")
    ? setCanonicalDoorsPerHour
    : setCanonicalDoorsPerHourCore;

  const cr = pct1(drift.actualCR);
  if (cr != null){
    state.contactRatePct = cr;
    if (els?.contactRatePct) els.contactRatePct.value = String(cr);
    applied.push(`CR ${cr}%`);
  }

  const sr = pct1(drift.actualSR);
  if (sr != null){
    state.supportRatePct = sr;
    if (els?.supportRatePct) els.supportRatePct.value = String(sr);
    applied.push(`SR ${sr}%`);
  }

  const actualAPH = num1(drift.actualAPH);
  const expectedAPH = num1(drift.expectedAPH);
  if (actualAPH != null && actualAPH > 0 && expectedAPH != null && expectedAPH > 0){
    const curDoors = resolveCanonicalDoorsPerHour(state, { toNumber: safeNum });
    const curCalls = resolveCanonicalCallsPerHour(state, { toNumber: safeNum });
    if (curDoors != null && curDoors > 0 && curCalls != null && curCalls > 0){
      const ratioRaw = actualAPH / expectedAPH;
      const ratio = clamp(ratioRaw, 0.5, 1.5);
      const nextDoors = num1(Math.max(1, curDoors * ratio));
      const nextCalls = num1(Math.max(1, curCalls * ratio));
      writeDoorsPerHour(state, nextDoors);
      setCanonicalCallsPerHour(state, nextCalls, { toNumber: safeNum });
      if (els?.doorsPerHour3) els.doorsPerHour3.value = String(nextDoors);
      if (els?.callsPerHour3) els.callsPerHour3.value = String(nextCalls);
      const pct = roundToDigits((ratio - 1) * 100, 1, 0);
      const sign = pct >= 0 ? "+" : "";
      const adj = (ratio !== ratioRaw) ? " (clamped)" : "";
      applied.push(`APH ${sign}${pct}%${adj}`);
    }
  }

  if (!applied.length){
    if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "No rolling calibration values are available";
    return;
  }

  if (typeof setLastAppliedWeeklyAction === "function"){
    setLastAppliedWeeklyAction({
      label: `Applied: rolling calibrations (${applied.join(", ")})`,
      prevState
    });
  }
  if (typeof syncWeeklyUndoUI === "function"){
    syncWeeklyUndoUI();
  }
  markMcStale();
  commitUIUpdate();

  if (els?.applyRollingMsg){
    els.applyRollingMsg.textContent = `Applied rolling calibrations: ${applied.join(" · ")}`;
  }
}
