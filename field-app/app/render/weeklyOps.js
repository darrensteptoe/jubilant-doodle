export function renderWeeklyOpsPanel({
  els,
  state,
  res,
  weeks,
  safeNum,
  fmtInt,
  clamp,
  getEffectiveBaseRates,
  computeCapacityBreakdown,
  computeWeeklyOpsContext,
  renderWeeklyExecutionStatus
}){
  if (!els.wkGoal) return;

  const rawGoal = safeNum(state.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

  const eff = getEffectiveBaseRates();
  const sr = eff.sr;
  const cr = eff.cr;

  const fmtMaybeInt = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtMaybe = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.round(v));

  els.wkGoal.textContent = (goal == null) ? "—" : fmtInt(Math.round(goal));

  let convosNeeded = null;
  let attemptsNeeded = null;
  let convosPerWeek = null;
  let attemptsPerWeek = null;

  if (goal > 0 && sr && sr > 0) convosNeeded = goal / sr;
  if (convosNeeded != null && cr && cr > 0) attemptsNeeded = convosNeeded / cr;
  if (weeks != null && weeks > 0){
    if (convosNeeded != null) convosPerWeek = convosNeeded / weeks;
    if (attemptsNeeded != null) attemptsPerWeek = attemptsNeeded / weeks;
  }

  els.wkConvosPerWeek.textContent = fmtMaybeInt(convosPerWeek);
  els.wkAttemptsPerWeek.textContent = fmtMaybeInt(attemptsPerWeek);

  const orgCount = safeNum(state.orgCount);
  const orgHoursPerWeek = safeNum(state.orgHoursPerWeek);
  const volunteerMult = safeNum(state.volunteerMultBase);
  const doorShare = safeNum(state.channelDoorPct);
  const doorsPerHour = safeNum(state.doorsPerHour3);
  const callsPerHour = safeNum(state.callsPerHour3);

  const cap = computeCapacityBreakdown({
    weeks: 1,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare: (doorShare == null) ? null : clamp(doorShare / 100, 0, 1),
    doorsPerHour,
    callsPerHour
  });

  const capTotal = cap?.total ?? null;
  els.wkCapacityPerWeek.textContent = fmtMaybeInt(capTotal);
  if (els.wkCapacityBreakdown){
    if (cap && cap.doors != null && cap.phones != null){
      els.wkCapacityBreakdown.textContent = `${fmtMaybe(cap.doors)} doors + ${fmtMaybe(cap.phones)} calls`;
    } else {
      els.wkCapacityBreakdown.textContent = "—";
    }
  }

  let gap = null;
  if (attemptsPerWeek != null && capTotal != null) gap = attemptsPerWeek - capTotal;

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
    constraint = "Capacity";
    const g = Math.ceil(gap);
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

  const ctx = computeWeeklyOpsContext(res, weeks);
  renderWeeklyExecutionStatus(ctx);
}
