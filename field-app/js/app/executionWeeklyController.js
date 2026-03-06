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
    const lastN = logs
      .filter((x) => x && x.date)
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(-Math.max(1, n | 0));

    if (!lastN.length){
      return {
        hasLog: false,
        n: 0,
        days: null,
        sumAttempts: 0,
        sumConvos: 0,
        lastDate: null
      };
    }

    let sumAttempts = 0;
    let sumConvos = 0;

    for (const x of lastN){
      const doors = safeNum(x?.doors) || 0;
      const calls = safeNum(x?.calls) || 0;
      const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
      const convos = safeNum(x?.convos) || 0;
      sumAttempts += attempts;
      sumConvos += convos;
    }

    const firstDate = lastN[0]?.date ? new Date(String(lastN[0].date)) : null;
    const lastDate = lastN[lastN.length - 1]?.date ? new Date(String(lastN[lastN.length - 1].date)) : null;
    const days = (firstDate && lastDate && isFinite(firstDate) && isFinite(lastDate))
      ? Math.max(1, Math.round((lastDate - firstDate) / (24 * 3600 * 1000)) + 1)
      : lastN.length;

    return {
      hasLog: true,
      n: lastN.length,
      days,
      sumAttempts,
      sumConvos,
      lastDate: lastN[lastN.length - 1]?.date || null
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
