export function runMonteCarloNowModule(args){
  const {
    state,
    computeElectionSnapshot,
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

  if (typeof setLastRenderCtx === "function"){
    setLastRenderCtx({ res, weeks: w, needVotes, modelInput, planningSnapshot });
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
  renderMcFreshness(res, w);
  renderRiskFramingE2();
  renderSensitivitySnapshotE4();
}
