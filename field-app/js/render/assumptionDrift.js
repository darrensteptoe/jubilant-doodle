// @ts-check
export function renderAssumptionDriftPanel({
  els,
  state,
  res,
  weeks,
  safeNum,
  computeWeeklyOpsContext,
  ctx,
  executionSnapshot
}){
  const driftStatusTagEl = els?.driftStatusTag;
  const driftReqEl = els?.driftReq;
  const driftActualEl = els?.driftActual;
  const driftDeltaEl = els?.driftDelta;
  const driftSlipBannerEl = els?.driftSlipBanner;
  if (!driftStatusTagEl && !driftReqEl && !driftActualEl && !driftDeltaEl && !driftSlipBannerEl) return;

  const fInt = (v) => (v == null || !isFinite(v)) ? "—" : (String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  const fPct1 = (v) => (v == null || !isFinite(v)) ? "—" : ((v * 100).toFixed(1) + "%");

  const opsCtx = ctx || computeWeeklyOpsContext(res, weeks);
  const req = executionSnapshot?.pace?.requiredAttemptsPerWeek ?? opsCtx?.attemptsPerWeek;
  if (driftReqEl) driftReqEl.textContent = (req == null || !isFinite(req)) ? "—" : fInt(Math.ceil(req));

  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  const hasLog = executionSnapshot ? !!executionSnapshot?.log?.hasLog : !!(log && log.length);
  if (!hasLog){
    if (driftStatusTagEl){
      driftStatusTagEl.className = "tag";
      driftStatusTagEl.textContent = "Not tracking";
    }
    if (driftActualEl) driftActualEl.textContent = "—";
    if (driftDeltaEl) driftDeltaEl.textContent = "—";
    if (driftSlipBannerEl){
      driftSlipBannerEl.className = "banner";
      driftSlipBannerEl.textContent = "Add daily log entries in organizer.html to activate drift detection.";
    }
    return;
  }

  let sumAttempts7 = executionSnapshot?.log?.sumAttemptsWindow;
  let sumAttemptsAll = executionSnapshot?.log?.sumAttemptsAll;

  if (!(sumAttempts7 != null && isFinite(sumAttempts7) && sumAttemptsAll != null && isFinite(sumAttemptsAll))){
    const sorted = [...log].filter(x => x && x.date).sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const lastN = sorted.slice(-7);
    sumAttempts7 = 0;
    sumAttemptsAll = 0;
    for (const x of sorted){
      const doors = safeNum(x?.doors) || 0;
      const calls = safeNum(x?.calls) || 0;
      const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
      sumAttemptsAll += attempts;
    }
    for (const x of lastN){
      const doors = safeNum(x?.doors) || 0;
      const calls = safeNum(x?.calls) || 0;
      const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
      sumAttempts7 += attempts;
    }
  }

  if (driftActualEl) driftActualEl.textContent = fInt(sumAttempts7);

  let deltaPct = executionSnapshot?.pace?.ratio;
  if (deltaPct != null && isFinite(deltaPct)) deltaPct = deltaPct - 1;
  if (!(deltaPct != null && isFinite(deltaPct))){
    deltaPct = null;
    if (req != null && isFinite(req) && req > 0) deltaPct = (sumAttempts7 - req) / req;
  }

  const abs = (deltaPct == null || !isFinite(deltaPct)) ? null : Math.abs(deltaPct);
  const cls = (abs == null) ? "" : (abs <= 0.05 ? "ok" : (abs <= 0.15 ? "warn" : "bad"));

  if (driftStatusTagEl){
    driftStatusTagEl.className = cls ? `tag ${cls}` : "tag";
    driftStatusTagEl.textContent = cls === "ok" ? "Green" : (cls === "warn" ? "Yellow" : (cls === "bad" ? "Red" : "—"));
  }

  if (driftDeltaEl){
    if (deltaPct == null || !isFinite(deltaPct)) driftDeltaEl.textContent = "—";
    else driftDeltaEl.textContent = `${deltaPct >= 0 ? "+" : ""}${fPct1(deltaPct)}`;
  }

  let slipDays = executionSnapshot?.pace?.projectedSlipDays;
  if (!(slipDays != null && isFinite(slipDays))){
    slipDays = null;
    const totalNeed = opsCtx?.attemptsNeeded;
    const remaining = (totalNeed != null && isFinite(totalNeed)) ? Math.max(0, totalNeed - sumAttemptsAll) : null;
    if (remaining != null && isFinite(remaining) && weeks != null && isFinite(weeks) && weeks > 0 && sumAttempts7 > 0){
      const projWeeks = remaining / sumAttempts7;
      const d = (projWeeks - weeks) * 7;
      slipDays = Math.max(0, Math.round(d));
    }
  }

  if (driftSlipBannerEl){
    const bCls = cls ? cls : "";
    driftSlipBannerEl.className = bCls ? `banner ${bCls}` : "banner";
    if (slipDays == null){
      driftSlipBannerEl.textContent = "At current pace, projected slip unavailable under current inputs.";
    } else {
      driftSlipBannerEl.textContent = slipDays === 0
        ? "At current pace, target completion stays on schedule."
        : `At current pace, target completion shifts by +${slipDays} days.`;
    }
  }
}
