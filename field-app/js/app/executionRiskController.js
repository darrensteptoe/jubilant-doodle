// @ts-check
export function createExecutionRiskController({
  els,
  getState,
  setState,
  getLastRenderCtx,
  setLastAppliedWeeklyAction,
  safeNum,
  clamp,
  fmtInt,
  setTextPair,
  setText,
  safeCall,
  getEffectiveBaseRates,
  computeWeeklyOpsContext,
  computeCapacityBreakdown,
  deriveNeedVotes,
  normalizeDailyLogEntry,
  ensureScenarioRegistry,
  SCENARIO_BASELINE_ID,
  scenarioClone,
  scenarioInputsFromState,
  renderPhase3,
  applyStateToUI,
  commitUIUpdate,
  syncWeeklyUndoUI,
  setCanonicalDoorsPerHour,
  markMcStale,
  hashMcInputs,
  computeDailyLogHash,
  runMonteCarloSim,
  persist,
  getStateSnapshot,
  withPatchedState,
  computeElectionSnapshot,
  derivedWeeksRemaining,
  engine,
  computeRealityDriftModule,
  applyRollingRateToAssumptionModule,
  applyAllRollingCalibrationsModule,
  applyWeeklyLeverScenarioModule,
  renderAssumptionDriftPanel,
  renderRiskFramingPanel,
  renderBottleneckAttributionPanel,
  renderWeeklyOpsInsightsPanel,
  renderWeeklyOpsFreshnessPanel,
  renderConversionPanel,
  renderSensitivitySnapshotPanel,
  runSensitivitySnapshotPanel,
  renderDecisionConfidencePanel,
  renderImpactTracePanel,
  renderDecisionIntelligencePanelView,
  getMcStaleness,
  fmtSigned,
} = {}){
  function computeRealityDrift(){
    return computeRealityDriftModule({ state: getState(), safeNum, windowN: 7 });
  }

  function applyRollingRateToAssumption(kind){
    return applyRollingRateToAssumptionModule({
      kind,
      computeRealityDrift,
      state: getState(),
      els,
      safeNum,
      clamp,
      setCanonicalDoorsPerHour,
      markMcStale,
      commitUIUpdate,
    });
  }

  function applyAllRollingCalibrations(){
    return applyAllRollingCalibrationsModule({
      computeRealityDrift,
      state: getState(),
      els,
      safeNum,
      clamp,
      setCanonicalDoorsPerHour,
      markMcStale,
      commitUIUpdate,
      setLastAppliedWeeklyAction,
      syncWeeklyUndoUI,
    });
  }

  function applyWeeklyLeverScenario(lever, ctx){
    return applyWeeklyLeverScenarioModule({
      lever,
      ctx,
      state: getState(),
      clamp,
      setLastAppliedWeeklyAction,
      replaceState: (nextState) => { setState(nextState); },
      applyStateToUI,
      commitUIUpdate,
      syncWeeklyUndoUI,
    });
  }

  function renderAssumptionDriftE1(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
    return renderAssumptionDriftPanel({
      els,
      state: getState(),
      res,
      weeks,
      safeNum,
      computeWeeklyOpsContext,
      ctx: weeklyContext,
      executionSnapshot,
    });
  }

  function renderRiskFramingE2(){
    const state = getState();
    const lastRenderCtx = getLastRenderCtx();
    const stale = (lastRenderCtx && lastRenderCtx.res)
      ? getMcStaleness({
          state,
          res: lastRenderCtx.res,
          weeks: lastRenderCtx.weeks,
          hashMcInputs,
          computeDailyLogHash,
        })
      : null;
    return renderRiskFramingPanel({ els, state, setTextPair, fmtSigned, clamp, mcStaleness: stale });
  }

  function renderBottleneckAttributionE3(res, weeks){
    return renderBottleneckAttributionPanel({
      els,
      state: getState(),
      res,
      weeks,
      safeNum,
      fmtInt,
      clamp,
      engine,
      getEffectiveBaseRates,
      deriveNeedVotes
    });
  }

  function renderWeeklyOpsInsights(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
    return renderWeeklyOpsInsightsPanel({
      els,
      state: getState(),
      res,
      weeks,
      ctx: weeklyContext,
      executionSnapshot,
      computeWeeklyOpsContext,
      fmtInt,
      clamp,
      computeCapacityBreakdown,
      syncWeeklyUndoUI,
      safeCall,
      applyWeeklyLeverScenario,
      computeRealityDrift
    });
  }

  function renderWeeklyOpsFreshness(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
    return renderWeeklyOpsFreshnessPanel({
      els,
      state: getState(),
      res,
      weeks,
      ctx: weeklyContext,
      executionSnapshot,
      safeNum,
      computeWeeklyOpsContext
    });
  }

  function renderConversion(res, weeks){
    return renderConversionPanel({
      els,
      state: getState(),
      res,
      weeks,
      deriveNeedVotes,
      safeNum,
      fmtInt,
      getEffectiveBaseRates,
      setText,
      renderPhase3,
    });
  }

  function renderSensitivitySnapshotE4(){
    const state = getState();
    const lastRenderCtx = getLastRenderCtx();
    const stale = (lastRenderCtx && lastRenderCtx.res)
      ? getMcStaleness({
          state,
          res: lastRenderCtx.res,
          weeks: lastRenderCtx.weeks,
          hashMcInputs,
          computeDailyLogHash,
        })
      : null;
    return renderSensitivitySnapshotPanel({ els, state, mcStaleness: stale });
  }

  async function runSensitivitySnapshotE4(){
    const state = getState();
    const lastRenderCtx = getLastRenderCtx();
    return runSensitivitySnapshotPanel({
      els,
      state,
      lastRenderCtx,
      clamp,
      runMonteCarloSim,
      persist,
      renderSensitivitySnapshotE4,
      getMcStaleness: () => {
        if (!lastRenderCtx || !lastRenderCtx.res) return null;
        return getMcStaleness({
          state,
          res: lastRenderCtx.res,
          weeks: lastRenderCtx.weeks,
          hashMcInputs,
          computeDailyLogHash,
        });
      }
    });
  }

  function renderDecisionConfidenceE5(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
    return renderDecisionConfidencePanel({
      els,
      state: getState(),
      res,
      weeks,
      weeklyContext,
      executionSnapshot,
      deriveNeedVotes,
      normalizeDailyLogEntry,
      safeNum,
      getEffectiveBaseRates,
      clamp,
      ensureScenarioRegistry,
      SCENARIO_BASELINE_ID,
      scenarioClone,
      scenarioInputsFromState,
      fmtInt
    });
  }

  function renderImpactTraceE6(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
    return renderImpactTracePanel({
      els,
      state: getState(),
      res,
      weeks,
      fmtInt,
      weeklyContext,
      executionSnapshot,
    });
  }

  function renderDecisionIntelligencePanel({ res, weeks }){
    return renderDecisionIntelligencePanelView({
      els,
      engine,
      res,
      weeks,
      getStateSnapshot,
      withPatchedState,
      computeElectionSnapshot,
      derivedWeeksRemaining,
      deriveNeedVotes,
      runMonteCarloSim,
      fmtInt
    });
  }

  return {
    computeRealityDrift,
    applyRollingRateToAssumption,
    applyAllRollingCalibrations,
    applyWeeklyLeverScenario,
    renderAssumptionDriftE1,
    renderRiskFramingE2,
    renderBottleneckAttributionE3,
    renderWeeklyOpsInsights,
    renderWeeklyOpsFreshness,
    renderConversion,
    renderSensitivitySnapshotE4,
    runSensitivitySnapshotE4,
    renderDecisionConfidenceE5,
    renderImpactTraceE6,
    renderDecisionIntelligencePanel,
  };
}
