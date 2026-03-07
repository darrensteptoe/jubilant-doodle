// @ts-check
/**
 * @param {unknown} v
 * @returns {number | null}
 */
function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(v, lo, hi){
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * @param {unknown} pct
 * @param {number | null} fallback
 * @returns {number | null}
 */
function pctToUnit(pct, fallback){
  const n = safeNum(pct);
  if (n == null) return fallback;
  return clamp(n, 0, 100) / 100;
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
export function computeVolunteerNeedFromGoal({
  goalVotes,
  supportRatePct,
  contactRatePct,
  doorsPerHour,
  hoursPerShift,
  shiftsPerVolunteerPerWeek,
  weeks
} = {}){
  const goalRaw = safeNum(goalVotes);
  const goal = (goalRaw != null && goalRaw > 0) ? goalRaw : 0;

  const sr = pctToUnit(supportRatePct, null);
  const cr = pctToUnit(contactRatePct, null);

  const dph = safeNum(doorsPerHour);
  const hps = safeNum(hoursPerShift);
  const spv = safeNum(shiftsPerVolunteerPerWeek);

  const doorsPerShift = (dph != null && hps != null) ? (dph * hps) : null;
  const convosNeeded = (sr != null && sr > 0) ? (goal / sr) : null;
  const doorsNeeded = (convosNeeded != null && cr != null && cr > 0) ? (convosNeeded / cr) : null;
  const totalShifts = (doorsNeeded != null && doorsPerShift != null && doorsPerShift > 0) ? (doorsNeeded / doorsPerShift) : null;
  const shiftsPerWeek = (totalShifts != null && weeks != null && weeks > 0) ? (totalShifts / weeks) : null;
  const volsNeeded = (shiftsPerWeek != null && spv != null && spv > 0) ? (shiftsPerWeek / spv) : null;

  return volsNeeded;
}
