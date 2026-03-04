export function renderWeeklyExecutionStatusModule(args){
  const {
    els,
    ctx,
    fmtInt,
    computeLastNLogSums,
    setTag,
    fmtISODate,
    clamp,
  } = args || {};

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

export function renderWeeklyOpsModule(args){
  const {
    els,
    res,
    weeks,
    ctx,
    fmtInt,
    computeWeeklyOpsContext,
    renderWeeklyExecutionStatus,
  } = args || {};

  if (!els.wkGoal) return;

  const context = ctx || computeWeeklyOpsContext(res, weeks) || {};
  const goal = context.goal ?? 0;
  const sr = context.sr;
  const cr = context.cr;
  const convosPerWeek = context.convosPerWeek;
  const attemptsPerWeek = context.attemptsPerWeek;
  const cap = context.cap;
  const capTotal = context.capTotal;
  const gap = context.gap;

  const fmtMaybeInt = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtMaybe = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.round(v));

  els.wkGoal.textContent = (goal == null) ? "—" : fmtInt(Math.round(goal));

  els.wkConvosPerWeek.textContent = fmtMaybeInt(convosPerWeek);
  els.wkAttemptsPerWeek.textContent = fmtMaybeInt(attemptsPerWeek);

  els.wkCapacityPerWeek.textContent = fmtMaybeInt(capTotal);
  if (els.wkCapacityBreakdown){
    if (cap && cap.doors != null && cap.phones != null){
      els.wkCapacityBreakdown.textContent = `${fmtMaybe(cap.doors)} doors + ${fmtMaybe(cap.phones)} calls`;
    } else {
      els.wkCapacityBreakdown.textContent = "—";
    }
  }

  if (els.wkGapPerWeek){
    if (gap == null) els.wkGapPerWeek.textContent = "—";
    else {
      const g = Math.ceil(gap);
      els.wkGapPerWeek.textContent = (g <= 0) ? "0" : fmtInt(g);
    }
  }

  let constraint = "—";
  let note = "—";
  let bannerMsg = "";
  let bannerKind = "warn";
  let bannerShow = false;

  if (goal <= 0){
    constraint = "None";
    note = "Goal is 0 under current inputs.";
  } else if (weeks == null || weeks <= 0){
    constraint = "Timeline";
    note = "Set election date or weeks remaining.";
    bannerMsg = "This week plan needs weeks remaining. Set an election date or enter weeks remaining to compute per-week targets.";
    bannerShow = true;
  } else if (sr == null || sr <= 0 || cr == null || cr <= 0){
    constraint = "Rates";
    note = "Enter support rate + contact rate.";
    bannerMsg = "This week plan needs Support rate and Contact rate (Phase 2).";
    bannerShow = true;
  } else if (capTotal == null){
    constraint = "Capacity";
    note = "Enter organizers/hours + speeds (Phase 3).";
    bannerMsg = "Capacity/week is missing. Fill Phase 3 execution inputs (organizers, hours/week, doors/hr, calls/hr, channel split).";
    bannerShow = true;
  } else if (gap != null && gap <= 0){
    constraint = "Feasible";
    note = "Capacity covers required attempts/week.";
    bannerMsg = "Feasible: capacity covers the per-week requirement under current rates.";
    bannerKind = "ok";
    bannerShow = true;
  } else if (gap != null){
    const g = Math.ceil(gap);
    constraint = "Capacity";
    note = `Short by ~${fmtInt(g)} attempts/week.`;
    bannerMsg = `Gap: you are short by ~${fmtInt(g)} attempts per week. Options: increase organizers/hours, improve speeds, shift channel mix, or raise rates.`;
    bannerKind = (g <= 500) ? "warn" : "bad";
    bannerShow = true;
  }

  if (els.wkConstraint) els.wkConstraint.textContent = constraint;
  if (els.wkConstraintNote) els.wkConstraintNote.textContent = note;

  if (els.wkBanner){
    els.wkBanner.hidden = !bannerShow;
    if (bannerShow){
      els.wkBanner.classList.remove("ok", "warn", "bad");
      els.wkBanner.classList.add(bannerKind);
      els.wkBanner.textContent = bannerMsg;
    }
  }

  renderWeeklyExecutionStatus(context);
}
