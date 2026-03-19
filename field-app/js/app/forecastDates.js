// @ts-check
import { computeFinishDateFromDailyPace } from "../core/executionPlanner.js";
import { roundWholeNumberByMode } from "../core/utils.js";
/**
 * @param {Record<string, any>} snap
 * @param {number | null | undefined} weeks
 * @returns {Date | null}
 */
export function targetFinishDateFromSnapCore(snap, weeks){
  const d = String(snap?.electionDate || "").trim();
  if (d){
    const dt = new Date(d + "T00:00:00");
    if (isFinite(dt)) return dt;
  }
  if (weeks != null && isFinite(weeks) && weeks > 0){
    const days = roundWholeNumberByMode(weeks * 7, { mode: "ceil", fallback: 0 }) ?? 0;
    const dt = new Date();
    dt.setHours(12, 0, 0, 0);
    dt.setDate(dt.getDate() + days);
    return dt;
  }
  return null;
}

/**
 * @param {number | null | undefined} total
 * @param {number | null | undefined} pacePerDay
 * @returns {Date | null}
 */
export function paceFinishDateCore(total, pacePerDay){
  return computeFinishDateFromDailyPace({
    totalAttempts: total,
    attemptsPerDay: pacePerDay,
  });
}
