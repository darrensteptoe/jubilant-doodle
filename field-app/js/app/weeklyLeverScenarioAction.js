// @ts-check
export function applyWeeklyLeverScenarioModule({
  lever,
  ctx,
  state,
  clamp,
  setLastAppliedWeeklyAction,
  replaceState,
  applyStateToUI,
  commitUIUpdate,
  syncWeeklyUndoUI,
} = {}){
  if (!lever) return;
  const prevState = structuredClone(state);
  const next = structuredClone(state);

  const asNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  if (lever.key === "org"){
    const v = asNum(next.orgCount) ?? 0;
    next.orgCount = v + 1;
  } else if (lever.key === "orgHr"){
    const v = asNum(next.orgHoursPerWeek) ?? 0;
    next.orgHoursPerWeek = v + 1;
  } else if (lever.key === "volMult"){
    const v = asNum(next.volunteerMultBase) ?? 0;
    next.volunteerMultBase = Math.round((v + 0.10) * 100) / 100;
  } else if (lever.key === "dph"){
    const v = asNum(next.doorsPerHour3) ?? 0;
    next.doorsPerHour3 = v + 1;
  } else if (lever.key === "cph"){
    const v = asNum(next.callsPerHour3) ?? 0;
    next.callsPerHour3 = v + 1;
  } else if (lever.key === "mix"){
    const d = asNum(next.channelDoorPct);
    const cur = d == null ? (ctx?.doorShare != null ? ctx.doorShare * 100 : 50) : d;
    const doorIsFaster = (ctx?.doorsPerHour != null && ctx?.callsPerHour != null) ? (ctx.doorsPerHour >= ctx.callsPerHour) : true;
    const nextPct = clamp(cur + (doorIsFaster ? 10 : -10), 0, 100);
    next.channelDoorPct = Math.round(nextPct);
  } else if (lever.key === "sr"){
    const v = asNum(next.supportRatePct) ?? 0;
    next.supportRatePct = Math.round((v + 1) * 10) / 10;
  } else if (lever.key === "cr"){
    const v = asNum(next.contactRatePct) ?? 0;
    next.contactRatePct = Math.round((v + 1) * 10) / 10;
  } else if (lever.key === "weeks"){
    const v = asNum(next.weeksRemaining);
    if (v != null){
      next.weeksRemaining = Math.round((v + 1) * 10) / 10;
    } else if (ctx?.weeks != null){
      next.weeksRemaining = Math.round((ctx.weeks + 1) * 10) / 10;
    } else {
      next.weeksRemaining = 1;
    }
  }

  const baseName = String(state.scenarioName || "Scenario");
  const label = String(lever.label || "Action");
  next.scenarioName = baseName + " • " + label;

  if (typeof setLastAppliedWeeklyAction === "function"){
    setLastAppliedWeeklyAction({
      label: "Applied: " + label,
      prevState
    });
  }

  replaceState(next);
  applyStateToUI();
  commitUIUpdate();
  syncWeeklyUndoUI();
}
