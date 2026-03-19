// @ts-check
import { summarizeExecutionDailyLog } from "../core/executionSnapshot.js";
export function createExecutionWeeklyController({
  els,
  getState,
  safeNum,
  fmtInt,
  clamp,
  renderWeeklyExecutionStatusModule,
  computeWeeklyOpsContextFromStateSelector,
  getEffectiveBaseRatesFromStateSelector,
  computeUniverseAdjustedRates,
  coreComputeCapacityBreakdown,
  compileEffectiveInputs,
  computeMaxAttemptsByTactic,
} = {}){
  function computeLastNLogSums(n){
    const state = getState();
    const logs = Array.isArray(state?.ui?.dailyLog) ? state.ui.dailyLog : [];
    const summary = summarizeExecutionDailyLog({
      dailyLog: logs,
      windowN: Math.max(1, n | 0),
      safeNumFn: safeNum,
    });

    if (!summary?.hasLog){
      return {
        hasLog: false,
        n: 0,
        days: null,
        sumAttempts: 0,
        sumConvos: 0,
        lastDate: null
      };
    }

    const days = (summary.days != null && Number.isFinite(summary.days) && summary.days > 0)
      ? summary.days
      : summary.entries;
    const lastDateRaw = summary.window[summary.window.length - 1]?.date;

    return {
      hasLog: true,
      n: summary.entries,
      days,
      sumAttempts: summary.sumAttemptsWindow,
      sumConvos: summary.sumConvosWindow,
      lastDate: lastDateRaw || null
    };
  }

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

  /** @param {import("./types").ExecutionWeeklyStatusCtx} ctx */
  function renderWeeklyExecutionStatus(ctx){
    renderWeeklyExecutionStatusModule({
      els,
      ctx,
      fmtInt,
      computeLastNLogSums,
      setTag,
      fmtISODate,
      clamp,
    });
  }

  function computeWeeklyOpsContext(res, weeks){
    const state = getState();
    return computeWeeklyOpsContextFromStateSelector(state, {
      res,
      weeks,
      getEffectiveBaseRatesForState: (s) => getEffectiveBaseRatesFromStateSelector(s, { computeUniverseAdjustedRates }),
      computeCapacityBreakdown: coreComputeCapacityBreakdown,
      compileEffectiveInputsForState: (s) => compileEffectiveInputs(s),
      computeMaxAttemptsByTactic
    });
  }

  return {
    computeLastNLogSums,
    setTag,
    fmtISODate,
    renderWeeklyExecutionStatus,
    computeWeeklyOpsContext,
  };
}
