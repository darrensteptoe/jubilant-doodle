export function runMonteCarloNowModule(args){
  const {
    state,
    computeElectionSnapshot,
    computeExecutionSnapshot,
    computeWeeklyOpsContext,
    derivedWeeksRemaining,
    buildModelInputFromState,
    safeNum,
    engine,
    deriveNeedVotes,
    setLastRenderCtx,
    hashMcInputs,
    runMonteCarloSim,
    computeDailyLogHash,
    persist,
    clearMcStale,
    renderMcResults,
    renderMcFreshness,
    renderRiskFramingE2,
    renderSensitivitySnapshotE4,
  } = args || {};

  let planningSnapshot = null;
  try{
    planningSnapshot = (typeof computeElectionSnapshot === "function")
      ? computeElectionSnapshot({ state, nowDate: new Date(), toNum: safeNum })
      : null;
  } catch {
    planningSnapshot = null;
  }

  const weeks = planningSnapshot?.weeks ?? derivedWeeksRemaining();
  const modelInput = planningSnapshot?.modelInput || buildModelInputFromState(state, safeNum);
  const res = planningSnapshot?.res || engine.computeAll(modelInput);
  const w = (weeks != null && weeks >= 0) ? weeks : null;
  const needVotes = (planningSnapshot?.needVotes != null)
    ? planningSnapshot.needVotes
    : deriveNeedVotes(res);

  const weeklyContext = (typeof computeWeeklyOpsContext === "function")
    ? (computeWeeklyOpsContext(res, w) || null)
    : null;
  const expectedAPH = (
    weeklyContext?.doorShare != null &&
    weeklyContext?.doorsPerHour != null &&
    weeklyContext?.callsPerHour != null
  )
    ? (weeklyContext.doorShare * weeklyContext.doorsPerHour + (1 - weeklyContext.doorShare) * weeklyContext.callsPerHour)
    : null;
  let executionSnapshot = null;
  try{
    executionSnapshot = (typeof computeExecutionSnapshot === "function")
      ? computeExecutionSnapshot({
          planningSnapshot: planningSnapshot || { weeks: w },
          weeklyContext,
          dailyLog: state?.ui?.dailyLog || [],
          assumedCR: weeklyContext?.cr ?? null,
          assumedSR: weeklyContext?.sr ?? null,
          expectedAPH,
          windowN: 7,
          safeNumFn: safeNum,
        })
      : null;
  } catch {
    executionSnapshot = null;
  }

  if (typeof setLastRenderCtx === "function"){
    setLastRenderCtx({ res, weeks: w, needVotes, modelInput, planningSnapshot, weeklyContext, executionSnapshot });
  }

  const h = hashMcInputs(res, w);
  const sim = runMonteCarloSim({ res, weeks: w, needVotes, runs: 10000, seed: state.mcSeed || "" });

  state.mcLast = sim;
  state.mcLastHash = h;

  if (!state.ui) state.ui = {};
  state.ui.mcMeta = {
    lastRunAt: new Date().toISOString(),
    inputsHash: h,
    dailyLogHash: computeDailyLogHash(),
  };

  persist();
  clearMcStale();
  renderMcResults(sim);
  renderMcFreshness(res, w, { weeklyContext, executionSnapshot });
  renderRiskFramingE2();
  renderSensitivitySnapshotE4();
}
