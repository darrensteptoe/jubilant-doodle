// @ts-check
/** @param {import("./types").WireEventsOrchestratorArgs} args */
export function wireEventsOrchestratorModule(args){
  const {
    els,
    state,
    setState,
    safeNum,
    commitUIUpdate,
    schedulePersist,
    applyTemplateDefaultsForRace,
    applyStateToUI,
    refreshAssumptionsProfile,
    uid,
    rebuildCandidateTable,
    rebuildUserSplitInputs,
    markMcStale,
    switchToStage,
    setCanonicalDoorsPerHour,
    canonicalDoorsPerHourFromSnap,
    clamp,
    syncGotvModeUI,
    syncMcModeUI,
    wireSensitivitySurface,
    safeCall,
    runMonteCarloNow,
    render,
    applyThemeFromState,
    persist,
    engine,
    APP_VERSION,
    BUILD_ID,
    getLastResultsSnapshot,
    setLastExportHash,
    downloadText,
    replaceState,
    makeDefaultState,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    clearState,
    readJsonFile,
    requiredScenarioKeysMissing,
    normalizeLoadedState,
    setText,
    refreshBackupDropdown,
    restoreBackupByIndex,
    openDiagnostics,
    closeDiagnostics,
    copyDebugBundle,
    exportDailyLog,
    mergeDailyLogIntoState,
    applyRollingRateToAssumption,
    applyAllRollingCalibrations,
    undoLastWeeklyAction,
    renderScenarioManagerC1,
    renderDecisionSessionD1,
    wireSafetyAndDiagnosticsEvents,
    wirePrimaryPlannerEvents,
    wireBudgetTimelineEvents,
    wireIntelChecksEvents,
    wireTabAndExportEvents,
    wireResetImportAndUiToggles,
    computeRealityDrift,
  } = args || {};

  const runWire = (label, fn) => {
    if (typeof safeCall === "function") {
      safeCall(fn, { label: `wire.${label}` });
      return;
    }
    try {
      fn();
    } catch (err) {
      console.error(`[wireEvents] ${label} failed`, err);
    }
  };

  runWire("safetyAndDiagnostics", () => {
    wireSafetyAndDiagnosticsEvents({
      els,
      getState: () => state(),
      setState,
      refreshBackupDropdown,
      restoreBackupByIndex,
      openDiagnostics,
      closeDiagnostics,
      copyDebugBundle,
      exportDailyLog,
      mergeDailyLogIntoState,
      applyRollingRateToAssumption,
      applyAllRollingCalibrations,
      undoLastWeeklyAction,
      safeCall,
    });
  });

  runWire("primaryPlanner", () => {
    wirePrimaryPlannerEvents({
      els,
      getState: () => state(),
      safeNum,
      commitUIUpdate,
      schedulePersist,
      applyTemplateDefaultsForRace,
      applyStateToUI,
      refreshAssumptionsProfile,
      uid,
      rebuildCandidateTable,
      rebuildUserSplitInputs,
      markMcStale,
      switchToStage,
      setCanonicalDoorsPerHour,
      canonicalDoorsPerHourFromSnap,
      clamp,
      syncGotvModeUI,
      syncMcModeUI,
      wireSensitivitySurface,
      safeCall,
      runMonteCarloNow,
    });
  });

  runWire("budgetTimeline", () => {
    wireBudgetTimelineEvents({
      els,
      getState: () => state(),
      safeNum,
      commitUIUpdate,
      render,
    });
  });

  runWire("intelChecks", () => {
    wireIntelChecksEvents({
      els,
      getState: () => state(),
      engine,
      commitUIUpdate,
      safeNum,
      computeRealityDrift,
      markMcStale,
    });
  });

  runWire("tabAndExport", () => {
    wireTabAndExportEvents({
      els,
      getState: () => state(),
      persist,
      engine,
      APP_VERSION,
      BUILD_ID,
      getLastResultsSnapshot,
      setLastExportHash,
      downloadText,
    });
  });

  runWire("resetImportAndUiToggles", () => {
    wireResetImportAndUiToggles({
      els,
      getState: () => state(),
      replaceState,
      makeDefaultState,
      ensureScenarioRegistry,
      ensureDecisionScaffold,
      SCENARIO_BASELINE_ID,
      scenarioInputsFromState,
      scenarioOutputsFromState,
      clearState,
      applyStateToUI,
      rebuildCandidateTable,
      applyThemeFromState,
      render,
      safeCall,
      renderScenarioManagerC1,
      renderDecisionSessionD1,
      persist,
      readJsonFile,
      engine,
      requiredScenarioKeysMissing,
      normalizeLoadedState,
      setText,
      getLastResultsSnapshot,
    });
  });
}
