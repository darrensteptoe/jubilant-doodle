// js/core/model.js
// Deterministic model + shared derived helpers (pure).
// This module must not touch DOM/window/document.

import { safeNum, daysBetween, clamp } from "./utils.js";
export * from "./winMath.js";
export { computeAll as computeDeterministic } from "./winMath.js";

const DEFAULT_CAPACITY_DECAY = Object.freeze({
  enabled: false,
  type: "linear",
  weeklyDecayPct: 0.03,
  floorPctOfBaseline: 0.70,
});

// Derived helper: votes still needed to hit goal (used by MC + sensitivity + UI)
export function deriveNeedVotes(res, goalSupportIdsOverride){
  const rawGoal = safeNum(goalSupportIdsOverride);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : autoGoal;
  return (goal != null && goal >= 0) ? goal : null;
}

// Canonical helper for UI/planner layers that require a usable non-negative value.
export function deriveNeedVotesOrZero(res, goalSupportIdsOverride){
  const goal = deriveNeedVotes(res, goalSupportIdsOverride);
  return (goal != null && goal > 0) ? goal : 0;
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

// Canonical helper for displays/weekly planning that use whole-week buckets.
export function deriveWeeksRemainingCeil({ weeksRemainingOverride, electionDateISO, nowDate = new Date() } = {}){
  const weeks = derivedWeeksRemaining({ weeksRemainingOverride, electionDateISO, nowDate });
  if (weeks == null || !Number.isFinite(weeks)) return null;
  return Math.max(0, Math.ceil(weeks));
}

export function resolveCapacityDecayConfig(input){
  const raw = (input && typeof input === "object") ? input : {};
  const type = (String(raw.type || DEFAULT_CAPACITY_DECAY.type).toLowerCase() === "linear")
    ? "linear"
    : DEFAULT_CAPACITY_DECAY.type;

  return {
    enabled: !!raw.enabled,
    type,
    weeklyDecayPct: clamp(
      safeNum(raw.weeklyDecayPct) ?? DEFAULT_CAPACITY_DECAY.weeklyDecayPct,
      0,
      0.50
    ),
    floorPctOfBaseline: clamp(
      safeNum(raw.floorPctOfBaseline) ?? DEFAULT_CAPACITY_DECAY.floorPctOfBaseline,
      0,
      1
    ),
  };
}

function decayWeekFactor(weekIndex, decay){
  if (!decay.enabled) return 1;
  if (decay.type !== "linear") return 1;
  const raw = 1 - (decay.weeklyDecayPct * weekIndex);
  return clamp(raw, decay.floorPctOfBaseline, 1);
}

function capacityDecayMultiplier(weeks, decay){
  const w = safeNum(weeks);
  if (w == null || w <= 0) return 0;
  if (!decay.enabled) return 1;

  const fullWeeks = Math.max(0, Math.floor(w));
  const partial = clamp(w - fullWeeks, 0, 1);
  let weighted = 0;

  for (let i = 0; i < fullWeeks; i += 1){
    weighted += decayWeekFactor(i, decay);
  }
  if (partial > 0){
    weighted += partial * decayWeekFactor(fullWeeks, decay);
  }

  return (weighted > 0) ? (weighted / w) : 0;
}

// Capacity ceiling in attempt units (doors knocked + calls dialed)
export function computeCapacityContacts({ weeks, orgCount, orgHoursPerWeek, volunteerMult, doorShare, doorsPerHour, callsPerHour, capacityDecay }){
  const w = safeNum(weeks);
  if (w == null || w <= 0) return null;
  if (orgCount == null || orgCount <= 0) return null;
  if (orgHoursPerWeek == null || orgHoursPerWeek <= 0) return null;
  if (doorsPerHour == null || doorsPerHour <= 0) return null;
  if (callsPerHour == null || callsPerHour <= 0) return null;

  const vm = (volunteerMult == null || volunteerMult <= 0) ? 1 : volunteerMult;
  const ds = (doorShare == null) ? 0.5 : clamp(doorShare, 0, 1);
  const decay = resolveCapacityDecayConfig(capacityDecay);
  const decayMult = capacityDecayMultiplier(w, decay);

  const totalDoor = w * orgCount * orgHoursPerWeek * doorsPerHour * vm * ds * decayMult;
  const totalPhone = w * orgCount * orgHoursPerWeek * callsPerHour * vm * (1 - ds) * decayMult;
  const total = totalDoor + totalPhone;

  return (isFinite(total) && total >= 0) ? total : null;
}

export function computeCapacityBreakdown({ weeks, orgCount, orgHoursPerWeek, volunteerMult, doorShare, doorsPerHour, callsPerHour, capacityDecay }){
  const w = safeNum(weeks);
  const total = computeCapacityContacts({
    weeks: w,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour,
    capacityDecay
  });
  if (total == null) return null;

  const vm = (volunteerMult == null || volunteerMult <= 0) ? 1 : volunteerMult;
  const ds = (doorShare == null) ? 0.5 : clamp(doorShare, 0, 1);
  const decay = resolveCapacityDecayConfig(capacityDecay);
  const decayMult = capacityDecayMultiplier(w, decay);

  const doorsCap = w * orgCount * orgHoursPerWeek * doorsPerHour * vm * ds * decayMult;
  const phonesCap = w * orgCount * orgHoursPerWeek * callsPerHour * vm * (1 - ds) * decayMult;

  return {
    total,
    doors: (isFinite(doorsCap) && doorsCap >= 0) ? doorsCap : null,
    phones: (isFinite(phonesCap) && phonesCap >= 0) ? phonesCap : null,
  };
}
