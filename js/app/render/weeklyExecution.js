function setTag(el, kind, text){
  if (!el) return;
  el.classList.remove("ok", "warn", "bad");
  if (kind) el.classList.add(kind);
  el.textContent = text;
}

function fmtISODate(d){
  try{
    const dt = (d instanceof Date) ? d : new Date(d);
    if (!isFinite(dt)) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const da = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  } catch {
    return "—";
  }
}

export function renderWeeklyExecutionStatusPanel({ els, ctx, computeLastNLogSums, fmtInt, clamp }){
  const reqConvos = ctx?.convosPerWeek;
  const reqAttempts = ctx?.attemptsPerWeek;

  if (els.wkReqConvosWeek) els.wkReqConvosWeek.textContent = (reqConvos == null || !isFinite(reqConvos)) ? "—" : fmtInt(Math.ceil(reqConvos));
  if (els.wkReqAttemptsWeek) els.wkReqAttemptsWeek.textContent = (reqAttempts == null || !isFinite(reqAttempts)) ? "—" : fmtInt(Math.ceil(reqAttempts));

  const last7 = computeLastNLogSums(7);

  const clearAll = () => {
    if (els.wkActConvos7) els.wkActConvos7.textContent = "—";
    if (els.wkActAttempts7) els.wkActAttempts7.textContent = "—";
    if (els.wkGapConvos) els.wkGapConvos.textContent = "—";
    if (els.wkGapAttempts) els.wkGapAttempts.textContent = "—";
    if (els.wkActConvosNote) els.wkActConvosNote.textContent = "Insufficient field data.";
    if (els.wkActAttemptsNote) els.wkActAttemptsNote.textContent = "Insufficient field data.";
    setTag(els.wkConvosPaceTag, null, "—");
    setTag(els.wkAttemptsPaceTag, null, "—");
    if (els.wkReqDoorAttemptsWeek) els.wkReqDoorAttemptsWeek.textContent = "—";
    if (els.wkReqCallAttemptsWeek) els.wkReqCallAttemptsWeek.textContent = "—";
    if (els.wkImpliedConvosWeek) els.wkImpliedConvosWeek.textContent = "—";
    if (els.wkImpliedConvosNote) els.wkImpliedConvosNote.textContent = "Insufficient field data.";
    if (els.wkFinishConvos) els.wkFinishConvos.textContent = "—";
    if (els.wkFinishAttempts) els.wkFinishAttempts.textContent = "—";
    if (els.wkPaceStatus) els.wkPaceStatus.textContent = "—";
    if (els.wkPaceNote) els.wkPaceNote.textContent = "Insufficient field data.";
    if (els.wkExecBanner){
      els.wkExecBanner.hidden = true;
      els.wkExecBanner.classList.remove("ok", "warn", "bad");
      els.wkExecBanner.classList.add("warn");
      els.wkExecBanner.textContent = "";
    }
  };

  if (!last7.hasLog || last7.n === 0){
    clearAll();
    return;
  }

  const actualConvos = last7.sumConvos;
  const actualAttempts = last7.sumAttempts;

  if (els.wkActConvos7) els.wkActConvos7.textContent = fmtInt(Math.round(actualConvos));
  if (els.wkActAttempts7) els.wkActAttempts7.textContent = fmtInt(Math.round(actualAttempts));
  if (els.wkActConvosNote) els.wkActConvosNote.textContent = `${last7.n} entries over ~${last7.days} day(s) · last: ${last7.lastDate || "—"}`;
  if (els.wkActAttemptsNote) els.wkActAttemptsNote.textContent = `${last7.n} entries over ~${last7.days} day(s) · last: ${last7.lastDate || "—"}`;

  const paceKind = (req, actual) => {
    if (req == null || !isFinite(req) || req <= 0) return { kind: null, label: "—", gap: null };
    const gap = actual - req;
    if (actual >= req) return { kind: "ok", label: "On pace", gap };
    if (actual >= req * 0.9) return { kind: "warn", label: "Within 10%", gap };
    return { kind: "bad", label: "Behind", gap };
  };

  const convosPace = paceKind(reqConvos, actualConvos);
  const attemptsPace = paceKind(reqAttempts, actualAttempts);

  if (els.wkGapConvos){
    els.wkGapConvos.textContent = (convosPace.gap == null) ? "—" : ((convosPace.gap >= 0) ? `+${fmtInt(Math.round(convosPace.gap))}` : `${fmtInt(Math.round(convosPace.gap))}`);
  }
  if (els.wkGapAttempts){
    els.wkGapAttempts.textContent = (attemptsPace.gap == null) ? "—" : ((attemptsPace.gap >= 0) ? `+${fmtInt(Math.round(attemptsPace.gap))}` : `${fmtInt(Math.round(attemptsPace.gap))}`);
  }

  setTag(els.wkConvosPaceTag, convosPace.kind, convosPace.label);
  setTag(els.wkAttemptsPaceTag, attemptsPace.kind, attemptsPace.label);

  const doorShare = (ctx?.doorShare != null && isFinite(ctx.doorShare)) ? clamp(ctx.doorShare, 0, 1) : null;
  const reqDoorAttempts = (reqAttempts != null && isFinite(reqAttempts) && doorShare != null) ? (reqAttempts * doorShare) : null;
  const reqCallAttempts = (reqAttempts != null && isFinite(reqAttempts) && doorShare != null) ? (reqAttempts * (1 - doorShare)) : null;

  if (els.wkReqDoorAttemptsWeek) els.wkReqDoorAttemptsWeek.textContent = (reqDoorAttempts == null) ? "—" : fmtInt(Math.ceil(reqDoorAttempts));
  if (els.wkReqCallAttemptsWeek) els.wkReqCallAttemptsWeek.textContent = (reqCallAttempts == null) ? "—" : fmtInt(Math.ceil(reqCallAttempts));

  const rollingCR = (actualAttempts > 0) ? (actualConvos / actualAttempts) : null;
  if (els.wkImpliedConvosWeek){
    if (rollingCR == null || reqAttempts == null || !isFinite(reqAttempts)){
      els.wkImpliedConvosWeek.textContent = "—";
    } else {
      els.wkImpliedConvosWeek.textContent = fmtInt(Math.round(reqAttempts * rollingCR));
    }
  }
  if (els.wkImpliedConvosNote){
    if (rollingCR == null){
      els.wkImpliedConvosNote.textContent = "Insufficient field data.";
    } else {
      const pct = Math.round(rollingCR * 1000) / 10;
      els.wkImpliedConvosNote.textContent = `Uses rolling 7-entry contact rate (${pct}%)`;
    }
  }

  const paceAttemptsPerDay = (last7.days && last7.days > 0) ? (actualAttempts / last7.days) : null;
  const paceConvosPerDay = (last7.days && last7.days > 0) ? (actualConvos / last7.days) : null;

  const finishFrom = (total, pacePerDay) => {
    if (total == null || !isFinite(total) || total <= 0) return { date: null, note: "No target" };
    if (pacePerDay == null || !isFinite(pacePerDay) || pacePerDay <= 0) return { date: null, note: "No measurable pace" };
    const daysNeeded = Math.ceil(total / pacePerDay);
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + daysNeeded);
    return { date: d, note: `~${fmtInt(daysNeeded)} day(s) at current pace` };
  };

  const convFinish = finishFrom(ctx?.convosNeeded ?? (ctx?.convosPerWeek != null && ctx?.weeks != null ? ctx.convosPerWeek * ctx.weeks : null), paceConvosPerDay);
  const attFinish = finishFrom(ctx?.attemptsNeeded ?? (ctx?.attemptsPerWeek != null && ctx?.weeks != null ? ctx.attemptsPerWeek * ctx.weeks : null), paceAttemptsPerDay);

  if (els.wkFinishConvos) els.wkFinishConvos.textContent = convFinish.date ? fmtISODate(convFinish.date) : (convFinish.note || "—");
  if (els.wkFinishAttempts) els.wkFinishAttempts.textContent = attFinish.date ? fmtISODate(attFinish.date) : (attFinish.note || "—");

  let paceStatus = "—";
  let paceNote = "";
  let bannerKind = null;

  const worst = (a, b) => {
    const rank = { ok: 3, warn: 2, bad: 1, null: 0, undefined: 0 };
    return (rank[a] <= rank[b]) ? a : b;
  };

  bannerKind = worst(convosPace.kind, attemptsPace.kind);

  if (bannerKind === "ok"){
    paceStatus = "On pace";
    paceNote = "Last 7-entry pace meets or exceeds weekly requirement.";
  } else if (bannerKind === "warn"){
    paceStatus = "Tight";
    paceNote = "Within 10% of weekly requirement. Any slip risks missing timeline.";
  } else if (bannerKind === "bad"){
    paceStatus = "Behind";
    paceNote = "Behind weekly requirement by more than 10%.";
  } else {
    paceStatus = "—";
    paceNote = "Set goal + weeks remaining to compute requirement.";
  }

  if (els.wkPaceStatus) els.wkPaceStatus.textContent = paceStatus;
  if (els.wkPaceNote) els.wkPaceNote.textContent = paceNote;

  if (els.wkExecBanner){
    const show = (bannerKind === "ok" || bannerKind === "warn" || bannerKind === "bad");
    els.wkExecBanner.hidden = !show;
    if (show){
      els.wkExecBanner.classList.remove("ok", "warn", "bad");
      els.wkExecBanner.classList.add(bannerKind);
      const a = (reqAttempts != null && isFinite(reqAttempts)) ? Math.ceil(reqAttempts) : null;
      const c = (reqConvos != null && isFinite(reqConvos)) ? Math.ceil(reqConvos) : null;
      const ar = Math.round(actualAttempts);
      const crn = Math.round(actualConvos);
      els.wkExecBanner.textContent = `Last 7: ${fmtInt(crn)} convos / ${fmtInt(ar)} attempts vs required ${c != null ? fmtInt(c) : "—"} convos / ${a != null ? fmtInt(a) : "—"} attempts per week.`;
    }
  }
}
