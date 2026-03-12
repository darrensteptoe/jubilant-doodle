// @ts-check
/** @param {import("./types").InitPostBootCtx} ctx */
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
  safeCall(() => { wireSensitivitySurface(); }, { label: "postboot.wireSensitivitySurface" });
  safeCall(() => { wireEvents(); }, { label: "postboot.wireEvents" });
  safeCall(() => { initDevTools(); }, { label: "postboot.initDevTools" });
  safeCall(() => { render(); }, { label: "postboot.render" });
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
