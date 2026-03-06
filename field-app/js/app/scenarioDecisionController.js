export function createScenarioDecisionController({
  els,
  getState,
  scenarioBaselineId,
  scenarioMax,
  scenarioCloneCore,
  scenarioInputsFromStateCore,
  scenarioOutputsFromStateCore,
  ensureScenarioRegistryCore,
  listScenarioRecordsCore,
  getUniverseLayerConfigFromSnapCore,
  getEffectiveBaseRatesFromSnapCore,
  computeWeeklyOpsContextFromSnapCore,
  getUniverseLayerConfigFromStateSelector,
  getEffectiveBaseRatesFromStateSelector,
  computeUniverseAdjustedRates,
  computeWeeklyOpsContextFromStateSelector,
  computeCapacityBreakdown,
  compileEffectiveInputs,
  computeMaxAttemptsByTactic,
  targetFinishDateFromSnapCore,
  paceFinishDateCore,
  renderScenarioComparisonPanel,
  computeDecisionKeyOutCore,
  computeElectionSnapshot,
  engine,
  derivedWeeksRemaining,
  computeLastNLogSums,
  safeNum,
  fmtInt,
  fmtISODate,
  renderScenarioManagerPanel,
  makeDecisionSessionIdCore,
  makeDecisionOptionIdCore,
  ensureDecisionOptionShapeCore,
  ensureDecisionSessionShapeCore,
  ensureDecisionScaffoldCore,
  getActiveDecisionSessionCore,
  listDecisionSessionsCore,
  decisionScenarioLabelCore,
  renderDecisionSessionPanelCore,
  objectiveTemplates,
  riskPostures,
  renderDecisionOptionsPanelCore,
  decisionOptionDisplayCore,
  buildDecisionSummaryTextCore,
  copyTextToClipboardCore,
  decisionSummaryPlainTextCore,
  decisionSessionExportObjectCore,
  downloadJsonObjectCore,
  renderDecisionSummaryPanelCore,
  uid,
  clamp,
} = {}){
  function scenarioClone(obj){
    return scenarioCloneCore(obj);
  }

  function scenarioInputsFromState(src){
    return scenarioInputsFromStateCore(src);
  }

  function scenarioOutputsFromState(src){
    return scenarioOutputsFromStateCore(src);
  }

  function ensureScenarioRegistry(){
    return ensureScenarioRegistryCore(getState(), {
      scenarioBaselineId,
      scenarioInputsFromState,
      scenarioOutputsFromState,
    });
  }

  function setScenarioWarn(msg){
    if (!els?.scWarn) return;
    if (msg){
      els.scWarn.hidden = false;
      els.scWarn.textContent = msg;
      return;
    }
    els.scWarn.hidden = true;
    els.scWarn.textContent = "";
  }

  function listScenarioRecords(){
    ensureScenarioRegistry();
    return listScenarioRecordsCore(getState(), { scenarioBaselineId });
  }

  function getUniverseLayerConfigFromSnap(snap){
    return getUniverseLayerConfigFromSnapCore(snap, {
      getUniverseLayerConfigFromStateSelector,
    });
  }

  function getEffectiveBaseRatesFromSnap(snap){
    return getEffectiveBaseRatesFromSnapCore(snap, {
      getEffectiveBaseRatesFromStateSelector,
      computeUniverseAdjustedRates,
    });
  }

  function computeWeeklyOpsContextFromSnap(snap, res, weeks){
    return computeWeeklyOpsContextFromSnapCore(snap, res, weeks, {
      computeWeeklyOpsContextFromStateSelector,
      getEffectiveBaseRatesFromSnap,
      computeCapacityBreakdown,
      compileEffectiveInputs,
      computeMaxAttemptsByTactic,
    });
  }

  function targetFinishDateFromSnap(snap, weeks){
    return targetFinishDateFromSnapCore(snap, weeks);
  }

  function paceFinishDate(total, pacePerDay){
    return paceFinishDateCore(total, pacePerDay);
  }

  function renderScenarioComparisonC3(){
    return renderScenarioComparisonPanel({
      els,
      state: getState(),
      ensureScenarioRegistry,
      SCENARIO_BASELINE_ID: scenarioBaselineId,
      scenarioClone,
      scenarioInputsFromState,
      computeDecisionKeyOutCore,
      computeElectionSnapshot,
      engine,
      derivedWeeksRemaining,
      computeWeeklyOpsContextFromSnap,
      targetFinishDateFromSnap,
      computeLastNLogSums,
      paceFinishDate,
      safeNum,
      fmtInt,
      fmtISODate
    });
  }

  function renderScenarioManagerC1(){
    return renderScenarioManagerPanel({
      els,
      state: getState(),
      ensureScenarioRegistry,
      listScenarioRecords,
      SCENARIO_BASELINE_ID: scenarioBaselineId,
      SCENARIO_MAX: scenarioMax,
      setScenarioWarn,
      renderScenarioComparison: renderScenarioComparisonC3,
    });
  }

  function makeDecisionSessionId(){
    return makeDecisionSessionIdCore(uid);
  }

  function makeDecisionOptionId(){
    return makeDecisionOptionIdCore(uid);
  }

  function ensureDecisionOptionShape(o){
    ensureDecisionOptionShapeCore(o);
  }

  function ensureDecisionSessionShape(s){
    ensureDecisionSessionShapeCore(s);
  }

  function ensureDecisionScaffold(){
    return ensureDecisionScaffoldCore(getState(), {
      ensureDecisionSessionShape,
      makeDecisionSessionId,
      objectiveTemplates,
      scenarioBaselineId,
    });
  }

  function getActiveDecisionSession(){
    ensureDecisionScaffold();
    return getActiveDecisionSessionCore(getState());
  }

  function listDecisionSessions(){
    ensureDecisionScaffold();
    return listDecisionSessionsCore(getState());
  }

  function decisionScenarioLabel(scenarioId){
    ensureScenarioRegistry();
    return decisionScenarioLabelCore(scenarioId, getState()?.ui?.scenarios || {});
  }

  function renderDecisionSessionD1(){
    return renderDecisionSessionPanelCore({
      els,
      state: getState(),
      ensureDecisionScaffold,
      listDecisionSessions,
      getActiveDecisionSession,
      ensureDecisionSessionShape,
      objectiveTemplates,
      riskPostures,
      decisionScenarioLabel,
      renderDecisionOptions: renderDecisionOptionsD3,
      renderDecisionSummary: renderDecisionSummaryD4,
    });
  }

  function listDecisionOptions(session){
    if (!session) return [];
    const opts = session.options || {};
    const arr = Object.values(opts);
    arr.sort((a,b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
    return arr;
  }

  function getActiveDecisionOption(session){
    if (!session) return null;
    const id = session.activeOptionId;
    const o = (id && session.options) ? session.options[id] : null;
    return o || null;
  }

  function renderDecisionOptionsD3(session){
    return renderDecisionOptionsPanelCore({
      els,
      session,
      ensureDecisionSessionShape,
      listDecisionOptions,
      getActiveDecisionOption,
      decisionScenarioLabel,
    });
  }

  function decisionOptionDisplay(o){
    return decisionOptionDisplayCore(o);
  }

  function buildDecisionSummaryText(session){
    return buildDecisionSummaryTextCore(session, {
      ensureScenarioRegistry,
      state: getState(),
      SCENARIO_BASELINE_ID: scenarioBaselineId,
      scenarioClone,
      engine,
      derivedWeeksRemaining,
      computeElectionSnapshot,
      computeWeeklyOpsContextFromSnap,
      targetFinishDateFromSnap,
      fmtISODate,
      OBJECTIVE_TEMPLATES: objectiveTemplates,
      fmtInt,
      safeNum,
      clamp,
    });
  }

  function copyTextToClipboard(text){
    return copyTextToClipboardCore(text);
  }

  function decisionSummaryPlainText(md){
    return decisionSummaryPlainTextCore(md);
  }

  function decisionSessionExportObject(session){
    return decisionSessionExportObjectCore(session, {
      activeScenarioId: getState()?.ui?.activeScenarioId || null,
      buildDecisionSummaryText,
    });
  }

  function downloadJsonObject(obj, filename){
    return downloadJsonObjectCore(obj, filename);
  }

  function renderDecisionSummaryD4(session){
    const s = session || getActiveDecisionSession();
    return renderDecisionSummaryPanelCore({
      els,
      session: s,
      decisionOptionDisplay,
      buildDecisionSummaryText,
    });
  }

  return {
    scenarioClone,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    ensureScenarioRegistry,
    setScenarioWarn,
    listScenarioRecords,
    getUniverseLayerConfigFromSnap,
    getEffectiveBaseRatesFromSnap,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
    paceFinishDate,
    renderScenarioComparisonC3,
    renderScenarioManagerC1,
    makeDecisionSessionId,
    makeDecisionOptionId,
    ensureDecisionOptionShape,
    ensureDecisionSessionShape,
    ensureDecisionScaffold,
    getActiveDecisionSession,
    listDecisionSessions,
    decisionScenarioLabel,
    renderDecisionSessionD1,
    listDecisionOptions,
    getActiveDecisionOption,
    renderDecisionOptionsD3,
    decisionOptionDisplay,
    buildDecisionSummaryText,
    copyTextToClipboard,
    decisionSummaryPlainText,
    decisionSessionExportObject,
    downloadJsonObject,
    renderDecisionSummaryD4,
  };
}

