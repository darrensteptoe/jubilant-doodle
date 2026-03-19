// @ts-check
import { NULL_BASE_RATE_DEFAULTS, resolveStateBaseRates } from "./baseRates.js";
import { coerceFiniteNumber, formatWholeNumberByMode, roundWholeNumberByMode } from "./utils.js";

const safeNum = coerceFiniteNumber;

/**
 * @param {{
 *   goalVotes?: unknown,
 *   turnoutReliability?: unknown,
 *   supportRate?: unknown,
 *   contactRate?: unknown,
 *   weeks?: unknown,
 * }=} input
 * @returns {{
 *   supportsNeeded: number|null,
 *   convosNeeded: number|null,
 *   attemptsNeeded: number|null,
 *   supportsPerWeek: number|null,
 *   convosPerWeek: number|null,
 *   attemptsPerWeek: number|null,
 * }}
 */
export function computeNeedVotePaceRequirements({
  goalVotes,
  turnoutReliability = 1,
  supportRate,
  contactRate,
  weeks,
} = {}){
  const goal = safeNum(goalVotes);
  const tr = safeNum(turnoutReliability);
  const sr = safeNum(supportRate);
  const cr = safeNum(contactRate);
  const w = safeNum(weeks);

  const supportsNeeded = (goal != null && goal > 0 && tr != null && tr > 0)
    ? (goal / tr)
    : null;
  const convosNeeded = (supportsNeeded != null && sr != null && sr > 0)
    ? (supportsNeeded / sr)
    : null;
  const attemptsNeeded = (convosNeeded != null && cr != null && cr > 0)
    ? (convosNeeded / cr)
    : null;
  const supportsPerWeek = (supportsNeeded != null && w != null && w > 0)
    ? (supportsNeeded / w)
    : null;
  const convosPerWeek = (convosNeeded != null && w != null && w > 0)
    ? (convosNeeded / w)
    : null;
  const attemptsPerWeek = (attemptsNeeded != null && w != null && w > 0)
    ? (attemptsNeeded / w)
    : null;

  return {
    supportsNeeded,
    convosNeeded,
    attemptsNeeded,
    supportsPerWeek,
    convosPerWeek,
    attemptsPerWeek,
  };
}

/**
 * @param {{
 *   attemptsNeeded?: unknown,
 *   attemptsCompleted?: unknown,
 * }=} input
 * @returns {number|null}
 */
export function computeRemainingAttempts({
  attemptsNeeded,
  attemptsCompleted,
} = {}){
  const need = safeNum(attemptsNeeded);
  if (need == null || !Number.isFinite(need)) return null;
  const done = safeNum(attemptsCompleted);
  const completed = (done != null && Number.isFinite(done)) ? done : 0;
  return Math.max(0, need - completed);
}

/**
 * @param {{
 *   remainingAttempts?: unknown,
 *   attemptsPerWeek?: unknown,
 * }=} input
 * @returns {number|null}
 */
export function computeWeeksToFinishAtPace({
  remainingAttempts,
  attemptsPerWeek,
} = {}){
  const remaining = safeNum(remainingAttempts);
  const pace = safeNum(attemptsPerWeek);
  if (remaining == null || !Number.isFinite(remaining) || remaining < 0) return null;
  if (pace == null || !Number.isFinite(pace) || pace <= 0) return null;
  return remaining / pace;
}

/**
 * @param {{
 *   totalAttempts?: unknown,
 *   attemptsPerDay?: unknown,
 *   nowDate?: Date,
 * }=} input
 * @returns {Date|null}
 */
export function computeFinishDateFromDailyPace({
  totalAttempts,
  attemptsPerDay,
  nowDate = new Date(),
} = {}){
  const total = safeNum(totalAttempts);
  const pace = safeNum(attemptsPerDay);
  if (total == null || !Number.isFinite(total) || total <= 0) return null;
  if (pace == null || !Number.isFinite(pace) || pace <= 0) return null;
  const daysNeeded = roundWholeNumberByMode(total / pace, { mode: "ceil", fallback: 0 }) ?? 0;
  const dt = new Date(nowDate);
  if (!Number.isFinite(dt.getTime())) return null;
  dt.setHours(12, 0, 0, 0);
  dt.setDate(dt.getDate() + daysNeeded);
  return dt;
}

/**
 * @param {{
 *   attemptsNeeded?: unknown,
 *   attemptsCompleted?: unknown,
 *   attemptsPerWeek?: unknown,
 *   weeksRemaining?: unknown,
 * }=} input
 * @returns {number|null}
 */
export function computeProjectedSlipDays({
  attemptsNeeded,
  attemptsCompleted,
  attemptsPerWeek,
  weeksRemaining,
} = {}){
  const remaining = computeRemainingAttempts({
    attemptsNeeded,
    attemptsCompleted,
  });
  const projectedWeeks = computeWeeksToFinishAtPace({
    remainingAttempts: remaining,
    attemptsPerWeek,
  });
  const weeksLeft = safeNum(weeksRemaining);
  if (projectedWeeks == null || weeksLeft == null || !Number.isFinite(weeksLeft) || weeksLeft <= 0){
    return null;
  }
  return Math.max(
    0,
    roundWholeNumberByMode((projectedWeeks - weeksLeft) * 7, { mode: "round", fallback: 0 }) ?? 0
  );
}

/**
 * @param {{
 *   goalVotes?: unknown,
 *   supportRate?: unknown,
 *   contactRate?: unknown,
 *   weeks?: unknown,
 * }=} input
 * @returns {{
 *   convosNeeded: number|null,
 *   attemptsNeeded: number|null,
 *   convosPerWeek: number|null,
 *   attemptsPerWeek: number|null,
 * }}
 */
export function computeGoalPaceRequirements({
  goalVotes,
  supportRate,
  contactRate,
  weeks,
} = {}){
  const pace = computeNeedVotePaceRequirements({
    goalVotes,
    turnoutReliability: 1,
    supportRate,
    contactRate,
    weeks,
  });

  return {
    convosNeeded: pace.convosNeeded,
    attemptsNeeded: pace.attemptsNeeded,
    convosPerWeek: pace.convosPerWeek,
    attemptsPerWeek: pace.attemptsPerWeek,
  };
}

/**
 * @param {{
 *   goalVotes?: number,
 *   supportRate?: number,
 *   contactRate?: number,
 *   supportRatePct?: number,
 *   contactRatePct?: number,
 *   doorsPerHour?: number,
 *   hoursPerShift?: number,
 *   shiftsPerVolunteerPerWeek?: number,
 *   weeks?: number
 * }=} input
 * @returns {{
 *   convosNeeded: number|null,
 *   attemptsNeeded: number|null,
 *   doorsPerShift: number|null,
 *   totalShifts: number|null,
 *   shiftsPerWeek: number|null,
 *   volunteersNeeded: number|null,
 * }}
 */
export function computeVolunteerWorkloadFromGoal({
  goalVotes,
  supportRate,
  contactRate,
  supportRatePct,
  contactRatePct,
  doorsPerHour,
  hoursPerShift,
  shiftsPerVolunteerPerWeek,
  weeks
} = {}){
  const goalRaw = safeNum(goalVotes);
  const goal = (goalRaw != null && goalRaw > 0) ? goalRaw : 0;

  const supportRateUnitRaw = safeNum(supportRate);
  const contactRateUnitRaw = safeNum(contactRate);
  const supportRateUnit = (supportRateUnitRaw != null)
    ? Math.max(0, Math.min(1, supportRateUnitRaw))
    : null;
  const contactRateUnit = (contactRateUnitRaw != null)
    ? Math.max(0, Math.min(1, contactRateUnitRaw))
    : null;
  const baseRates = resolveStateBaseRates({
    supportRatePct,
    contactRatePct,
  }, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  const sr = supportRateUnit == null ? baseRates.sr : supportRateUnit;
  const cr = contactRateUnit == null ? baseRates.cr : contactRateUnit;

  const dph = safeNum(doorsPerHour);
  const hps = safeNum(hoursPerShift);
  const spv = safeNum(shiftsPerVolunteerPerWeek);
  const weeksNum = safeNum(weeks);

  const doorsPerShift = (dph != null && hps != null) ? (dph * hps) : null;
  const requirements = computeGoalPaceRequirements({
    goalVotes: goal,
    supportRate: sr,
    contactRate: cr,
    weeks,
  });
  const convosNeeded = requirements.convosNeeded;
  const doorsNeeded = requirements.attemptsNeeded;
  const totalShifts = (doorsNeeded != null && doorsPerShift != null && doorsPerShift > 0) ? (doorsNeeded / doorsPerShift) : null;
  const shiftsPerWeek = (totalShifts != null && weeksNum != null && weeksNum > 0)
    ? (totalShifts / weeksNum)
    : null;
  const volsNeeded = (shiftsPerWeek != null && spv != null && spv > 0) ? (shiftsPerWeek / spv) : null;

  return {
    convosNeeded,
    attemptsNeeded: doorsNeeded,
    doorsPerShift,
    totalShifts,
    shiftsPerWeek,
    volunteersNeeded: volsNeeded,
  };
}

/**
 * @param {{
 *   goalVotes?: number,
 *   supportRatePct?: number,
 *   contactRatePct?: number,
 *   doorsPerHour?: number,
 *   hoursPerShift?: number,
 *   shiftsPerVolunteerPerWeek?: number,
 *   weeks?: number
 * }=} input
 * @returns {number | null}
 */
export function computeVolunteerNeedFromGoal(input = {}){
  const workload = computeVolunteerWorkloadFromGoal(input);
  const volsNeeded = workload.volunteersNeeded;
  return volsNeeded;
}

/**
 * Canonical volunteer-capacity feasibility classifier for conversion workload surfaces.
 * Keeps threshold + message rules out of render modules.
 *
 * @param {{
 *   goalVotes?: unknown,
 *   weeks?: unknown,
 *   supportRate?: unknown,
 *   contactRate?: unknown,
 *   doorsPerShift?: unknown,
 *   volunteersNeeded?: unknown,
 *   formatWhole?: ((value: number) => string) | null,
 * }} input
 * @returns {{
 *   kind: "ok" | "warn" | "bad",
 *   text: string,
 *   shown: boolean,
 * }}
 */
export function buildVolunteerCapacityFeasibility({
  goalVotes,
  weeks,
  supportRate,
  contactRate,
  doorsPerShift,
  volunteersNeeded,
  formatWhole = null,
} = {}){
  const goal = safeNum(goalVotes);
  const weeksNum = safeNum(weeks);
  const sr = safeNum(supportRate);
  const cr = safeNum(contactRate);
  const dps = safeNum(doorsPerShift);
  const vols = safeNum(volunteersNeeded);
  const formatInt = typeof formatWhole === "function"
    ? formatWhole
    : (value) => formatWholeNumberByMode(Number(value) || 0, { mode: "round", fallback: "0" });

  if ((goal ?? 0) <= 0){
    return {
      kind: "ok",
      text: "Capacity check: Under current assumptions, no additional support IDs are required (goal = 0).",
      shown: true,
    };
  }
  if (weeksNum == null || weeksNum <= 0){
    return {
      kind: "warn",
      text: "Capacity check: Set an election date (or weeks remaining) to compute per-week requirements.",
      shown: true,
    };
  }
  if (sr == null || sr <= 0 || cr == null || cr <= 0 || dps == null || dps <= 0){
    return {
      kind: "warn",
      text: "Capacity check: Enter Support rate, Contact rate, Doors/hour, and Hours/shift to compute workload.",
      shown: true,
    };
  }
  if (vols == null || !Number.isFinite(vols)){
    return {
      kind: "warn",
      text: "Capacity check: Enter Shifts per volunteer/week to estimate active volunteer requirement.",
      shown: true,
    };
  }

  const roundedVolunteers = roundWholeNumberByMode(vols, { mode: "ceil", fallback: 0 }) ?? 0;
  if (roundedVolunteers <= 25){
    return {
      kind: "ok",
      text: `Capacity check: Looks feasible (≈ ${formatInt(roundedVolunteers)} active volunteers at your stated cadence).`,
      shown: true,
    };
  }
  if (roundedVolunteers <= 60){
    return {
      kind: "warn",
      text: `Capacity check: Ambitious (≈ ${formatInt(roundedVolunteers)} active volunteers). Consider higher efficiency, longer shifts, or supplementing with paid/phones/texts.`,
      shown: true,
    };
  }
  return {
    kind: "bad",
    text: `Capacity check: High risk (≈ ${formatInt(roundedVolunteers)} active volunteers). You likely need multi-channel + paid volume, or revise assumptions.`,
    shown: true,
  };
}

/**
 * @param {{
 *   supportRate?: unknown,
 *   contactRate?: unknown,
 *   supportRatePct?: unknown,
 *   contactRatePct?: unknown,
 * }} input
 * @returns {{ supportRate: number | null, contactRate: number | null }}
 */
function resolveVolunteerRates({
  supportRate,
  contactRate,
  supportRatePct,
  contactRatePct,
} = {}){
  const supportRateUnitRaw = safeNum(supportRate);
  const contactRateUnitRaw = safeNum(contactRate);
  const supportRateUnit = (supportRateUnitRaw != null)
    ? Math.max(0, Math.min(1, supportRateUnitRaw))
    : null;
  const contactRateUnit = (contactRateUnitRaw != null)
    ? Math.max(0, Math.min(1, contactRateUnitRaw))
    : null;
  const baseRates = resolveStateBaseRates({
    supportRatePct,
    contactRatePct,
  }, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  return {
    supportRate: supportRateUnit == null ? baseRates.sr : supportRateUnit,
    contactRate: contactRateUnit == null ? baseRates.cr : contactRateUnit,
  };
}

/**
 * Canonical conversion-workload snapshot builder for Phase 3/Plan surfaces.
 * Keeps snapshot shape + feasibility derivation out of render modules.
 *
 * @param {{
 *   goalVotes?: unknown,
 *   supportRate?: unknown,
 *   contactRate?: unknown,
 *   supportRatePct?: unknown,
 *   contactRatePct?: unknown,
 *   doorsPerHour?: unknown,
 *   hoursPerShift?: unknown,
 *   shiftsPerVolunteerPerWeek?: unknown,
 *   weeks?: unknown,
 *   formatWhole?: ((value: number) => string) | null,
 * }} input
 * @returns {{
 *   goalObjectiveValue: number,
 *   goalNetVotes: number,
 *   conversationsNeeded: number | null,
 *   doorsNeeded: number | null,
 *   doorsPerShift: number | null,
 *   totalShifts: number | null,
 *   shiftsPerWeek: number | null,
 *   volunteersNeeded: number | null,
 *   feasibility: {
 *     kind: "ok" | "warn" | "bad",
 *     text: string,
 *     shown: boolean,
 *   },
 * }}
 */
export function buildVolunteerConversionSnapshot({
  goalVotes,
  supportRate,
  contactRate,
  supportRatePct,
  contactRatePct,
  doorsPerHour,
  hoursPerShift,
  shiftsPerVolunteerPerWeek,
  weeks,
  formatWhole = null,
} = {}){
  const goalRaw = safeNum(goalVotes);
  const goal = (goalRaw != null && goalRaw > 0) ? goalRaw : 0;
  const resolvedRates = resolveVolunteerRates({
    supportRate,
    contactRate,
    supportRatePct,
    contactRatePct,
  });

  const workload = computeVolunteerWorkloadFromGoal({
    goalVotes: goal,
    supportRate: resolvedRates.supportRate,
    contactRate: resolvedRates.contactRate,
    doorsPerHour,
    hoursPerShift,
    shiftsPerVolunteerPerWeek,
    weeks,
  });
  const feasibility = buildVolunteerCapacityFeasibility({
    goalVotes: goal,
    weeks,
    supportRate: resolvedRates.supportRate,
    contactRate: resolvedRates.contactRate,
    doorsPerShift: workload.doorsPerShift,
    volunteersNeeded: workload.volunteersNeeded,
    formatWhole,
  });

  return {
    goalObjectiveValue: goal,
    goalNetVotes: goal,
    conversationsNeeded: workload.convosNeeded,
    doorsNeeded: workload.attemptsNeeded,
    doorsPerShift: workload.doorsPerShift,
    totalShifts: workload.totalShifts,
    shiftsPerWeek: workload.shiftsPerWeek,
    volunteersNeeded: workload.volunteersNeeded,
    feasibility,
  };
}
