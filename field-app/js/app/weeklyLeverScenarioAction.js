// @ts-check
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorsPerHour,
  setCanonicalCallsPerHour,
  setCanonicalDoorsPerHour,
} from "../core/throughput.js";
import { roundToDigits, roundWholeNumberByMode } from "../core/utils.js";

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
    next.volunteerMultBase = roundToDigits(v + 0.10, 2, v + 0.10);
  } else if (lever.key === "dph"){
    const v = resolveCanonicalDoorsPerHour(next, { toNumber: asNum }) ?? 0;
    setCanonicalDoorsPerHour(next, v + 1, { toNumber: asNum });
  } else if (lever.key === "cph"){
    const v = resolveCanonicalCallsPerHour(next, { toNumber: asNum }) ?? 0;
    setCanonicalCallsPerHour(next, v + 1, { toNumber: asNum });
  } else if (lever.key === "mix"){
    const d = asNum(next.channelDoorPct);
    const cur = d == null ? (ctx?.doorShare != null ? ctx.doorShare * 100 : 50) : d;
    const doorIsFaster = (ctx?.doorsPerHour != null && ctx?.callsPerHour != null) ? (ctx.doorsPerHour >= ctx.callsPerHour) : true;
    const nextPct = clamp(cur + (doorIsFaster ? 10 : -10), 0, 100);
    next.channelDoorPct = roundWholeNumberByMode(nextPct, { mode: "round", fallback: nextPct }) ?? nextPct;
  } else if (lever.key === "sr"){
    const v = asNum(next.supportRatePct) ?? 0;
    next.supportRatePct = roundToDigits(v + 1, 1, v + 1);
  } else if (lever.key === "cr"){
    const v = asNum(next.contactRatePct) ?? 0;
    next.contactRatePct = roundToDigits(v + 1, 1, v + 1);
  } else if (lever.key === "weeks"){
    const v = asNum(next.weeksRemaining);
    if (v != null){
      next.weeksRemaining = roundToDigits(v + 1, 1, v + 1);
    } else if (ctx?.weeks != null){
      const nextWeeks = Number(ctx.weeks) + 1;
      next.weeksRemaining = roundToDigits(nextWeeks, 1, nextWeeks);
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
