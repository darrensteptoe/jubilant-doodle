export function runInitPostBootModule(ctx){
  const {
    updateBuildStamp,
    updateSelfTestGateBadge,
    updatePersistenceStatusChip,
    refreshBackupDropdown,
    applyStateToUI,
    rebuildCandidateTable,
    initTabs,
    initExplainCard,
    safeCall,
    wireSensitivitySurface,
    wireEvents,
    initDevTools,
    render,
    getState,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    renderScenarioManagerC1,
    persist,
  } = ctx || {};

  updateBuildStamp();
  updateSelfTestGateBadge();
  updatePersistenceStatusChip();
  refreshBackupDropdown();

  applyStateToUI();
  rebuildCandidateTable();
  initTabs();
  initExplainCard();
  safeCall(() => { wireSensitivitySurface(); });
  wireEvents();
  initDevTools();
  render();
  try{
    const state = getState();
    const b = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
    if (b){
      b.inputs = scenarioInputsFromState(state);
      b.outputs = scenarioOutputsFromState(state);
    }
    renderScenarioManagerC1();
  } catch {}
  persist();
}
