// js/core/model.js
// Deterministic model + shared derived helpers (pure).
// This module must not touch DOM/window/document.

import { safeNum, daysBetween, clamp } from "./utils.js";
export * from "./winMath.js";
export { computeAll as computeDeterministic } from "./winMath.js";

// Derived helper: votes still needed to hit goal (used by MC + sensitivity + UI)
export function deriveNeedVotes(res, goalSupportIdsOverride){
  const rawGoal = safeNum(goalSupportIdsOverride);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : autoGoal;
  return (goal != null && goal >= 0) ? goal : null;
}

// Derived helper: weeks remaining (used by MC + optimizer timeline caps)
export function derivedWeeksRemaining({ weeksRemainingOverride, electionDateISO, nowDate = new Date() } = {}){
  const override = safeNum(weeksRemainingOverride);
  if (override != null && override >= 0) return override;

  const d = electionDateISO;
  if (!d) return null;

  const ed = new Date(d);
  if (!(ed instanceof Date) || !isFinite(ed)) return null;

  const deltaDays = daysBetween(nowDate, ed);
  if (deltaDays == null) return null;

  const w = Math.max(0, deltaDays / 7);
  return w;
}

// Capacity ceiling in attempt units (doors knocked + calls dialed)
export function computeCapacityContacts({ weeks, orgCount, orgHoursPerWeek, volunteerMult, doorShare, doorsPerHour, callsPerHour }){
  if (weeks == null || weeks <= 0) return null;
  if (orgCount == null || orgCount <= 0) return null;
  if (orgHoursPerWeek == null || orgHoursPerWeek <= 0) return null;
  if (doorsPerHour == null || doorsPerHour <= 0) return null;
  if (callsPerHour == null || callsPerHour <= 0) return null;

  const vm = (volunteerMult == null || volunteerMult <= 0) ? 1 : volunteerMult;
  const ds = (doorShare == null) ? 0.5 : clamp(doorShare, 0, 1);

  const totalDoor = weeks * orgCount * orgHoursPerWeek * doorsPerHour * vm * ds;
  const totalPhone = weeks * orgCount * orgHoursPerWeek * callsPerHour * vm * (1 - ds);
  const total = totalDoor + totalPhone;

  return (isFinite(total) && total >= 0) ? total : null;
}

export function computeCapacityBreakdown({ weeks, orgCount, orgHoursPerWeek, volunteerMult, doorShare, doorsPerHour, callsPerHour }){
  const total = computeCapacityContacts({ weeks, orgCount, orgHoursPerWeek, volunteerMult, doorShare, doorsPerHour, callsPerHour });
  if (total == null) return null;

  const vm = (volunteerMult == null || volunteerMult <= 0) ? 1 : volunteerMult;
  const ds = (doorShare == null) ? 0.5 : clamp(doorShare, 0, 1);

  const doorsCap = weeks * orgCount * orgHoursPerWeek * doorsPerHour * vm * ds;
  const phonesCap = weeks * orgCount * orgHoursPerWeek * callsPerHour * vm * (1 - ds);

  return {
    total,
    doors: (isFinite(doorsCap) && doorsCap >= 0) ? doorsCap : null,
    phones: (isFinite(phonesCap) && phonesCap >= 0) ? phonesCap : null,
  };
}
