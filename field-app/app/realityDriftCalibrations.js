export function computeRealityDriftModule({ state, safeNum, windowN = 7 } = {}){
  const log = Array.isArray(state?.ui?.dailyLog) ? state.ui.dailyLog : null;
  if (!log || log.length === 0) return { hasLog: false, flags: [], primary: null };

  const sorted = [...log]
    .filter((x) => x && x.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const lastN = sorted.slice(-Math.max(1, windowN | 0));

  let sumAttempts = 0;
  let sumConvos = 0;
  let sumSupportIds = 0;
  let sumOrgHours = 0;
  for (const x of lastN){
    const doors = safeNum(x?.doors) || 0;
    const calls = safeNum(x?.calls) || 0;
    const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
    const convos = safeNum(x?.convos) || 0;
    const sup = safeNum(x?.supportIds) || 0;
    const hrs = safeNum(x?.orgHours) || 0;

    sumAttempts += attempts;
    sumConvos += convos;
    sumSupportIds += sup;
    sumOrgHours += hrs;
  }

  const actualCR = (sumAttempts > 0) ? (sumConvos / sumAttempts) : null;
  const actualSR = (sumConvos > 0) ? (sumSupportIds / sumConvos) : null;
  const actualAPH = (sumOrgHours > 0) ? (sumAttempts / sumOrgHours) : null;

  const assumedCR = (state?.contactRatePct != null && state.contactRatePct !== "") ? ((safeNum(state.contactRatePct) || 0) / 100) : null;
  const assumedSR = (state?.supportRatePct != null && state.supportRatePct !== "") ? ((safeNum(state.supportRatePct) || 0) / 100) : null;

  const mixDoor = (state?.channelDoorPct != null && state.channelDoorPct !== "") ? ((safeNum(state.channelDoorPct) || 0) / 100) : null;
  const doorsHr = (state?.doorsPerHour3 != null && state.doorsPerHour3 !== "") ? (safeNum(state.doorsPerHour3) || 0) : null;
  const callsHr = (state?.callsPerHour3 != null && state.callsPerHour3 !== "") ? (safeNum(state.callsPerHour3) || 0) : null;
  const expectedAPH = (mixDoor != null && doorsHr != null && callsHr != null)
    ? (mixDoor * doorsHr + (1 - mixDoor) * callsHr)
    : null;

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

  const pct1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 1000) / 10; // 1 decimal
  const num1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 10) / 10;
  let changed = false;

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

    const curDoors = safeNum(state.doorsPerHour3);
    const curCalls = safeNum(state.callsPerHour3);
    if (curDoors == null || curDoors <= 0 || curCalls == null || curCalls <= 0){
      if (els?.applyRollingMsg) els.applyRollingMsg.textContent = "Current productivity assumptions are invalid";
      return;
    }

    const ratioRaw = actualAPH / expectedAPH;
    const ratio = clamp(ratioRaw, 0.5, 1.5);
    const nextDoors = num1(Math.max(1, curDoors * ratio));
    const nextCalls = num1(Math.max(1, curCalls * ratio));

    setCanonicalDoorsPerHour(state, nextDoors);
    state.callsPerHour3 = nextCalls;

    if (els?.doorsPerHour3) els.doorsPerHour3.value = String(nextDoors);
    if (els?.callsPerHour3) els.callsPerHour3.value = String(nextCalls);
    if (els?.applyRollingMsg){
      const pct = Math.round((ratio - 1) * 1000) / 10;
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
  const pct1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 1000) / 10; // 1 decimal
  const num1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 10) / 10;
  const applied = [];

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
    const curDoors = safeNum(state.doorsPerHour3);
    const curCalls = safeNum(state.callsPerHour3);
    if (curDoors != null && curDoors > 0 && curCalls != null && curCalls > 0){
      const ratioRaw = actualAPH / expectedAPH;
      const ratio = clamp(ratioRaw, 0.5, 1.5);
      const nextDoors = num1(Math.max(1, curDoors * ratio));
      const nextCalls = num1(Math.max(1, curCalls * ratio));
      setCanonicalDoorsPerHour(state, nextDoors);
      state.callsPerHour3 = nextCalls;
      if (els?.doorsPerHour3) els.doorsPerHour3.value = String(nextDoors);
      if (els?.callsPerHour3) els.callsPerHour3.value = String(nextCalls);
      const pct = Math.round((ratio - 1) * 1000) / 10;
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
