// @ts-check
import { engine } from "./engine.js";
import {
  computeCapacityContacts as coreComputeCapacityContacts,
  computeCapacityBreakdown as coreComputeCapacityBreakdown,
  deriveNeedVotesOrZero as coreDeriveNeedVotesOrZero,
  deriveWeeksRemainingCeil as coreDeriveWeeksRemainingCeil
} from "./core/model.js";
import { UNIVERSE_DEFAULTS, computeUniverseAdjustedRates } from "./core/universeLayer.js";
import {
  computeAvgLiftPP,
  getOptimizationObjectiveCopy,
  normalizeOptimizationObjective,
  OPTIMIZATION_OBJECTIVES,
} from "./core/turnout.js";
import { computeElectionSnapshot } from "./core/electionSnapshot.js";
import { computeExecutionSnapshot } from "./core/executionSnapshot.js";
import { getTimelineFeasibilityObjectiveMeta } from "./core/timeline.js";
import { getTimelineObjectiveMeta } from "./core/timelineOptimizer.js";
import {
  buildPlanSummaryView as buildCanonicalPlanSummaryView,
  formatPlanCurrency,
  formatPlanPercentUnit,
  formatPlanWhole,
  normalizePlanOptimizerRows,
} from "./core/planView.js";
import { buildReachFreshnessView, buildReachLeversAndActionsView, buildReachWeeklyConstraintView, buildReachWeeklyExecutionView } from "./core/reachView.js";
import { buildGovernanceSnapshotView, computeModelGovernance } from "./core/modelGovernance.js";
import {
  appendForecastArchiveEntry,
  buildForecastArchiveOptions,
  buildForecastArchiveContext,
  buildForecastArchiveEntry,
  resolveForecastArchiveSelectedHash,
  buildForecastArchiveSelectedEntryView,
  buildForecastArchiveTableRows,
  normalizeForecastArchiveActual,
  readForecastArchive,
  summarizeForecastArchive,
  updateForecastArchiveActual,
} from "./core/forecastArchive.js";
import { buildModelLearningFromArchive } from "./core/modelAudit.js";
import {
  buildDecisionDiagnosticsSnapshotView,
  buildWarRoomChangeClassificationView,
  buildWarRoomDecisionLogRowsView,
  buildWarRoomReviewBaselineView,
  computeDecisionSensitivityMiniSurfaceCache,
  DECISION_DIVERGENCE_KEY_ORDER,
} from "./core/decisionView.js";
import { buildOutcomeSurfaceSummaryText } from "./core/outcomeView.js";
import { buildScenarioWorkspaceSummaryView } from "./core/scenarioView.js";
import {
  buildDistrictApplyAdjustmentsStatus,
  buildDistrictAssumptionProvenanceStatus,
  buildDistrictCensusContextHint,
  buildDistrictFootprintCapacityStatus,
  buildDistrictGeoStatsText,
  buildDistrictLastFetchText,
  buildDistrictRaceFootprintStatus,
  buildDistrictSelectionSetStatus,
  buildDistrictSelectionSummaryText,
  buildDistrictTurnoutFallbackView,
  computeDistrictSupportTotalPctFromState,
} from "./core/districtView.js";
import {
  normalizeCensusState,
  resolutionNeedsCounty,
} from "./core/censusModule.js";
import {
  CANDIDATE_HISTORY_ELECTION_TYPE_OPTIONS,
  CANDIDATE_HISTORY_INCUMBENCY_OPTIONS,
  normalizeCandidateHistoryRecords,
} from "./core/candidateHistoryBaseline.js";
import {
  clamp,
  fmtInt,
  formatFixedNumber,
  formatPercentFromPct,
  formatPercentFromUnit,
  formatWholeNumberByMode,
  readJsonFile,
  roundWholeNumberByMode,
  safeNum,
} from "./utils.js";
import {
  loadState,
  clearState,
  readBackups,
  persistStateSnapshot,
  appendBackupEntry,
  serializeStateForPersistence,
} from "./storage.js";
import { APP_VERSION, BUILD_ID } from "./build.js";
import { computeSnapshotHash } from "./core/hash.js";
import { makeRng, triSample } from "./core/rng.js";
import { renderRiskFramingPanel } from "./app/render/riskFraming.js";
import { renderAssumptionDriftPanel } from "./app/render/assumptionDrift.js";
import * as executionAnalysisModule from "./app/render/executionAnalysis.js";
import { renderWeeklyOpsInsightsPanel, renderWeeklyOpsFreshnessPanel } from "./app/render/weeklyOpsInsights.js";
import { renderDecisionConfidencePanel, renderDecisionIntelligencePanelView } from "./app/render/decisionPanels.js";
import { renderImpactTracePanel } from "./app/render/impactTrace.js";
import {
  getMcStaleness,
  hashMcInputsModule,
  fmtSignedModule,
  renderMcResultsAdapterModule,
  renderMcVisualsAdapterModule,
} from "./app/monteCarloApp.js";
import {
  OBJECTIVE_TEMPLATES,
  RISK_POSTURES,
  makeDecisionSessionIdCore,
  makeDecisionOptionIdCore,
  ensureDecisionOptionShapeCore,
  ensureDecisionSessionShapeCore,
  ensureDecisionScaffoldCore,
  getActiveDecisionSessionCore,
  listDecisionSessionsCore,
  decisionScenarioLabelCore,
  renderDecisionSessionPanelCore,
  renderDecisionOptionsPanelCore,
  renderDecisionSummaryPanelCore,
  wireDecisionSessionBindings,
  createDecisionSessionActions,
  computeDecisionKeyOutCore,
  decisionOptionDisplayCore,
  buildDecisionSummaryTextCore,
  copyTextToClipboardCore,
  decisionSummaryPlainTextCore,
  decisionSessionExportObjectCore,
  downloadJsonObjectCore,
} from "./app/decisionSessionApp.js";
import {
  WEATHER_MODE_OBSERVE_ONLY,
  WEATHER_MODE_TODAY_ONLY,
  normalizeZip,
  resolveSelectedZip,
} from "./app/weatherRiskRules.js";
import {
  applyWeatherModeToState,
  applyWeatherObservationToState,
  buildWarRoomWeatherView,
  ensureWarRoomStateShape,
  fetchWarRoomWeatherByZip,
} from "./app/warRoomWeather.js";
import { ensureEventCalendarStateShape } from "./app/eventCalendarState.js";
import {
  clearEventDraft as clearEventCalendarDraft,
  deleteEventRecord as deleteEventCalendarRecord,
  loadEventIntoDraft as loadEventCalendarDraft,
  saveEventDraftAsEvent as saveEventCalendarDraftAsEvent,
  setEventDraftField as setEventCalendarDraftField,
  setEventFilter as setEventCalendarFilter,
  setEventStatus as setEventCalendarStatus,
  updateEventApplyToModel as updateEventCalendarApplyToModel,
} from "./app/eventCalendarStore.js";
import { buildEventCalendarView } from "./app/eventCalendarRenderer.js";
import { renderMain } from "./app/renderMain.js";
import { initDevToolsModule } from "./app/initDevTools.js";
import { buildModelInputFromState } from "./app/modelInput.js";
import { targetFinishDateFromSnapCore, paceFinishDateCore } from "./app/forecastDates.js";
import {
  scenarioCloneCore,
  scenarioInputsFromStateCore,
  scenarioOutputsFromStateCore
} from "./app/scenarioState.js";
import {
  normalizeDailyLogEntryCore,
  mergeDailyLogIntoStateCore,
  exportDailyLogCore
} from "./app/dailyLog.js";
import { createDiagnosticsRuntimeController } from "./app/diagnosticsRuntime.js";
import * as debugBundleModule from "./app/debugBundle.js";
import { createBackupRecoveryController } from "./app/backupRecovery.js";
import { renderScenarioManagerPanel } from "./app/renderScenarioManager.js";
import {
  ensureScenarioRegistryCore,
  listScenarioRecordsCore,
} from "./app/scenarioRegistry.js";
import {
  getUniverseLayerConfigFromSnapCore,
  getEffectiveBaseRatesFromSnapCore,
  computeWeeklyOpsContextFromSnapCore,
} from "./app/scenarioCompareHelpers.js";
import { createScenarioDecisionController } from "./app/scenarioDecisionController.js";
import {
  surfaceLeverSpecCore,
  surfaceClampCore,
  surfaceBaselineValueCore,
  applySurfaceDefaultsCore,
  renderSurfaceStubCore,
  renderSurfaceResultCore,
} from "./app/sensitivitySurfaceUi.js";
import { createSensitivitySurfaceController } from "./app/sensitivitySurfaceController.js";
import { normalizeStageLayoutModule } from "./app/normalizeStageLayout.js";
import { runInitPostBootModule } from "./app/initPostBoot.js";
import { runInitScenarioDecisionWiringModule } from "./app/initScenarioDecisionWiring.js";
import { preflightElsModule } from "./app/preflightEls.js";
import { initTabsModule, initExplainCardModule, isDevModeModule } from "./app/initUiStateHelpers.js";
import {
  bootProbeError,
  bootProbeMark,
  bootProbeSetStatus,
  getBootProbeStatus,
} from "./app/bootProbe.js";
import { createUiUpdateQueue } from "./app/uiUpdateQueue.js";
import { isScenarioLockedForEditsModule, applyScenarioLockUiModule } from "./app/scenarioLockUi.js";
import { setText, setHidden, setTextPair } from "./app/uiText.js";
import { makeDefaultStateModule } from "./app/defaultState.js";
import { normalizeLoadedStateModule } from "./app/normalizeLoadedState.js";
import { renderUniverse16CardModule } from "./app/renderUniverse16Card.js";
import { safeCallModule, switchToStageModule } from "./app/uiStageHelpers.js";
import { renderWeeklyOpsModule, renderWeeklyExecutionStatusModule } from "./app/weeklyOpsPanels.js";
import { renderRoiModule } from "./app/renderRoi.js";
import { renderOptimizationModule } from "./app/renderOptimization.js";
import { renderTimelineModule } from "./app/renderTimeline.js";
import { renderPhase3Module } from "./app/renderPhase3.js";
import { renderValidationModule } from "./app/renderValidation.js";
import { renderStressModule } from "./app/renderStress.js";
import { renderAssumptionsModule } from "./app/renderAssumptions.js";
import { renderGuardrailsModule } from "./app/renderGuardrails.js";
import { renderMcVisualsModule } from "./app/renderMcVisuals.js";
import { renderMcResultsModule } from "./app/renderMcResults.js";
import {
  blockModule,
  kvModule,
  labelTemplateModule,
  labelUndecidedModeModule,
  getYourNameFromStateModule
} from "./app/assumptionsViewHelpers.js";
import {
  canonicalCallsPerHourFromSnapModule,
  canonicalDoorsPerHourFromSnapModule,
  setCanonicalCallsPerHourModule,
  setCanonicalDoorsPerHourModule,
  requiredScenarioKeysMissingModule
} from "./app/stateNormalizationHelpers.js";
import { withPatchedStateModule } from "./app/statePatch.js";
import { syncFeatureFlagsFromState } from "./app/featureFlags.js";
import {
  twCapTextModule,
  twCapNumModule,
  twCapFmtIntModule,
  twCapFmt1Module,
  twCapFmt2Module,
  twCapFmtSignedModule,
  twCapRatioTextModule,
  twCapFmtPct01Module,
  twCapMedianModule,
  twCapCleanModule,
  twCapTransitionKeyModule,
  twCapParseDateModule,
  twCapWeekStartModule,
  twCapIsoUTCModule,
  twCapLatestRecordByPersonModule,
  twCapBuildReadinessStatsModule,
  twCapNormalizeForecastConfigModule,
  twCapPerOrganizerAttemptsPerWeekModule,
  twCapBaselineAttemptsPerWeekModule,
} from "./app/twCapHelpers.js";
import {
  buildVoterImportOutcomeView,
  buildVoterLayerStatusSnapshot,
  deriveVoterModelSignals,
  extractCensusAgeDistribution,
  normalizeVoterDataState,
  normalizeVoterRows,
  parseVoterRowsInput,
} from "./core/voterDataLayer.js";
import { createOperationsCapacityOutlookController } from "./app/operationsCapacityOutlook.js";
import { createEffectiveInputsController } from "./app/effectiveInputs.js";
import { createMcStateController } from "./app/mcState.js";
import { createMcEnvelopeController } from "./app/mcEnvelopeController.js";
import { createMcRuntimeController } from "./app/mcRuntimeController.js";
import { createPlanningRuntimeController } from "./app/planningRuntimeController.js";
import { createExecutionWeeklyController } from "./app/executionWeeklyController.js";
import { createExecutionRiskController } from "./app/executionRiskController.js";
import { createSummaryRenderController } from "./app/summaryRenderController.js";
import {
  updatePersistenceStatusChipModule,
  reportPersistenceFailureModule,
  clearPersistenceFailureModule
} from "./app/persistenceStatus.js";
import {
  applyTemplateDefaultsForRaceModule,
  deriveAssumptionsProfileFromStateModule,
  refreshAssumptionsProfileModule,
  assumptionsProfileLabelModule
} from "./app/assumptionsProfile.js";
import {
  systemPrefersDarkModule,
  normalizeThemeModeModule,
  computeThemeIsDarkModule,
  applyThemeFromStateModule,
  initThemeSystemListenerModule
} from "./app/themeMode.js";
import { applyStateToUIView } from "./app/applyStateToUI.js";
import { wireScenarioManagerBindings } from "./app/scenarioManagerBindings.js";
import { renderScenarioComparisonPanel } from "./app/render/scenarioComparison.js";
import {
  computeRealityDriftModule,
  applyRollingRateToAssumptionModule,
  applyAllRollingCalibrationsModule
} from "./app/realityDriftCalibrations.js";
import { runRealismEngine } from "./app/realismEngine.js";
import { composeReportPayload, buildReportPlainText } from "./app/reportComposer.js";
import { exportReportPdf } from "./app/pdfExport.js";
import { listReportTypeOptions, normalizeReportType } from "./app/reportRegistry.js";
import {
  buildCriticalAuditSnapshot,
  captureCriticalAssumptionAudit,
  computeEvidenceWarnings
} from "./app/intelAudit.js";
import {
  applyTargetingRunResult,
  applyTargetModelPreset,
  applyTargetingFieldPatch,
  buildTargetRankingPayloadConfig,
  buildTargetRankingExportFilename,
  buildTargetRankingCsv,
  buildTargetRankingPayload,
  normalizeTargetingState,
  resetTargetingWeightsToPreset,
  TARGETING_STATUS_LOAD_ROWS_FIRST,
} from "./app/targetingRuntime.js";
import {
  computeIntelIntegrityScore,
  ensureIntelCollections,
  listMissingEvidenceAudit,
  listMissingNoteAudit,
  upsertBenchmarkEntry,
  removeBenchmarkEntry,
  loadDefaultBenchmarksForRaceType,
  attachEvidenceRecord,
  generateCalibrationSourceBrief,
  generateScenarioSummaryBrief,
  generateScenarioDiffBrief,
  generateDriftExplanationBrief,
  generateSensitivityInterpretationBrief,
  addDefaultCorrelationModel,
  importCorrelationModelsJson,
  addDefaultShockScenario,
  importShockScenariosJson,
  captureObservedMetricsFromDrift,
  captureObservedAndRefreshDriftRecommendations,
  createWhatIfIntelRequest,
  applyTopDriftRecommendation,
} from "./app/intelControlsRuntime.js";
import { renderIntelChecksModule } from "./app/renderIntelChecks.js";
import { applyWeeklyLeverScenarioModule } from "./app/weeklyLeverScenarioAction.js";
import {
  wireSafetyAndDiagnosticsEvents,
  wirePrimaryPlannerEvents,
  wireBudgetTimelineEvents,
  wireIntelChecksEvents,
  wireTabAndExportEvents,
  wireResetImportAndUiToggles
} from "./app/wireEventsRuntime.js";
import { applyActiveContextToLinks, resolveActiveContext } from "./app/activeContext.js";
import { validateCampaignContext } from "./core/campaignContextManager.js";
import { getDiagnosticEngine } from "../diagnostics/diagnosticEngine.js";
import { getCensusRowsForState } from "./app/censusRowsRuntimeStore.js";
import { wireEventsOrchestratorModule } from "./app/wireEventsOrchestrator.js";
import { createCandidateUiController } from "./app/candidateUi.js";
import { createUsbStorageController } from "./app/usbStorage.js";
import {
  getUniverseLayerConfig as getUniverseLayerConfigFromStateSelector,
  getEffectiveBaseRates as getEffectiveBaseRatesFromStateSelector,
  computeWeeklyOpsContextFromState as computeWeeklyOpsContextFromStateSelector
} from "./app/selectors.js";
import * as operationsMetricsCacheModule from "./features/operations/metricsCache.js";
import { PIPELINE_STAGES, DEFAULT_FORECAST_CONFIG } from "./features/operations/schema.js";
import { els } from "./ui/els.js";

const renderBottleneckAttributionPanel =
  executionAnalysisModule?.renderBottleneckAttributionPanel || (() => {});
const renderConversionPanel =
  executionAnalysisModule?.renderConversionPanel || (() => {});
const renderSensitivitySnapshotPanel =
  executionAnalysisModule?.renderSensitivitySnapshotPanel || (() => {});
const runSensitivitySnapshotPanel =
  executionAnalysisModule?.runSensitivitySnapshotPanel || (async () => ({ ok: false, code: "missing_module" }));

const copyDebugBundleModule =
  debugBundleModule?.copyDebugBundleModule || (async () => null);

const getOperationsMetricsSnapshot =
  operationsMetricsCacheModule?.getOperationsMetricsSnapshot ||
  (async () => ({
    revision: -1,
    loadedAt: new Date().toISOString(),
    stores: {},
    counts: {},
    rollups: null,
  }));

function downloadText(text, filename, mime){
  try{
    const blob = new Blob([String(text ?? "")], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

function normalizeDailyLogEntry(raw){
  return normalizeDailyLogEntryCore(raw, { safeNum });
}

function mergeDailyLogIntoState(imported){
  return mergeDailyLogIntoStateCore(imported, {
    state,
    setState,
    markMcStale,
    normalizeDailyLogEntry,
  });
}

function exportDailyLog(){
  exportDailyLogCore({
    state,
    APP_VERSION,
    BUILD_ID,
    downloadText,
  });
}

let diagnosticsRuntimeController = null;

function getDiagnosticsRuntimeController(){
  if (diagnosticsRuntimeController) return diagnosticsRuntimeController;
  diagnosticsRuntimeController = createDiagnosticsRuntimeController({
    els,
    engine,
    buildId: BUILD_ID,
    getState: () => state,
    computeRealityDrift,
    recentErrors,
    maxErrors: MAX_ERRORS,
  });
  return diagnosticsRuntimeController;
}

function recordError(kind, message, extra){
  return getDiagnosticsRuntimeController().recordError(kind, message, extra);
}

function installGlobalErrorCapture(){
  return getDiagnosticsRuntimeController().installGlobalErrorCapture();
}

function updateBuildStamp(){
  return getDiagnosticsRuntimeController().updateBuildStamp();
}

function updateSelfTestGateBadge(){
  return getDiagnosticsRuntimeController().updateSelfTestGateBadge(selfTestGateStatus);
}

function openDiagnostics(){
  return getDiagnosticsRuntimeController().openDiagnostics();
}

function closeDiagnostics(){
  return getDiagnosticsRuntimeController().closeDiagnostics();
}

async function getOperationsDiagnosticsSnapshot(){
  return getDiagnosticsRuntimeController().getOperationsDiagnosticsSnapshot();
}

function updateDiagnosticsUI(){
  return getDiagnosticsRuntimeController().updateDiagnosticsUI();
}

const TW_CAP_DAY_MS = 86400000;
const TW_CAP_WEEK_MS = 7 * TW_CAP_DAY_MS;

const TW_CAP_ADAPTERS = {
  twCapText: twCapTextModule,
  twCapNum: twCapNumModule,
  twCapFmtInt: (v) => twCapFmtIntModule(v, { fmtInt }),
  twCapFmt1: twCapFmt1Module,
  twCapFmt2: twCapFmt2Module,
  twCapFmtSigned: (v) => twCapFmtSignedModule(v, { fmtInt }),
  twCapRatioText: twCapRatioTextModule,
  twCapFmtPct01: twCapFmtPct01Module,
  twCapClean: twCapCleanModule,
  twCapTransitionKey: twCapTransitionKeyModule,
  twCapParseDate: twCapParseDateModule,
  twCapWeekStart: twCapWeekStartModule,
  twCapIsoUTC: twCapIsoUTCModule,
  twCapBaselineAttemptsPerWeek: (effective) => twCapBaselineAttemptsPerWeekModule(effective, {
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    twCapNum: twCapNumModule,
    clamp,
  }),
  twCapPerOrganizerAttemptsPerWeek: (effective) => twCapPerOrganizerAttemptsPerWeekModule(effective, {
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    twCapNum: twCapNumModule,
    clamp,
  }),
  twCapNormalizeForecastConfig: (raw) => twCapNormalizeForecastConfigModule(raw, {
    defaultForecastConfig: DEFAULT_FORECAST_CONFIG,
    pipelineStages: PIPELINE_STAGES,
    twCapTransitionKey: twCapTransitionKeyModule,
    clamp,
    twCapNum: twCapNumModule,
  }),
  twCapBuildReadinessStats: (onboardingRecords, trainingRecords) => twCapBuildReadinessStatsModule(onboardingRecords, trainingRecords, {
    twCapLatestRecordByPerson: (rows) => twCapLatestRecordByPersonModule(rows, {
      twCapClean: twCapCleanModule,
      twCapParseDate: twCapParseDateModule,
    }),
    twCapClean: twCapCleanModule,
    twCapParseDate: twCapParseDateModule,
    twCapMedian: twCapMedianModule,
    twCapDayMs: TW_CAP_DAY_MS,
  }),
};

let operationsCapacityOutlookController = null;

function getOperationsCapacityOutlookController(){
  if (operationsCapacityOutlookController) return operationsCapacityOutlookController;
  operationsCapacityOutlookController = createOperationsCapacityOutlookController({
    els,
    getState: () => state,
    safeNum,
    clamp,
    getOperationsMetricsSnapshot,
    compileEffectiveInputs,
    ...TW_CAP_ADAPTERS,
    pipelineStages: PIPELINE_STAGES,
    twCapDayMs: TW_CAP_DAY_MS,
    twCapWeekMs: TW_CAP_WEEK_MS,
    markMcStale,
    scheduleRender,
  });
  return operationsCapacityOutlookController;
}

function twCapOverrideModeFromState(srcState = state){
  return getOperationsCapacityOutlookController().getOverrideMode(srcState);
}

function twCapResolveOverrideAttempts(srcState = state){
  return getOperationsCapacityOutlookController().resolveOverrideAttempts(srcState);
}

function scheduleOperationsCapacityOutlookRender(weeks){
  getOperationsCapacityOutlookController().schedule(weeks);
}

let backupRecoveryController = null;
let usbStorageController = null;

function getBackupRecoveryController(){
  if (backupRecoveryController) return backupRecoveryController;
  backupRecoveryController = createBackupRecoveryController({
    els,
    readBackups,
    appendBackupEntry,
    safeCall,
    getState: () => state,
    setState: (next) => { state = next; },
    engine,
    APP_VERSION,
    BUILD_ID,
    setLastExportHash: (next) => { lastExportHash = next || null; },
    clearPersistenceFailure,
    reportPersistenceFailure,
    normalizeLoadedScenarioRuntime,
    buildCriticalAuditSnapshot,
    setLastCriticalAuditSnapshot: (next) => { lastCriticalAuditSnapshot = next; },
    ensureDecisionScaffold,
    persist,
    render,
    renderDecisionSessionD1,
  });
  return backupRecoveryController;
}

function getUsbStorageController(){
  if (usbStorageController) return usbStorageController;
  usbStorageController = createUsbStorageController({
    els,
    getState: () => state,
    replaceState: (next) => { state = next; },
    normalizeLoadedState: normalizeLoadedScenarioRuntime,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    applyStateToUI,
    rebuildCandidateTable,
    applyThemeFromState,
    render,
    safeCall,
    renderScenarioManagerC1,
    renderDecisionSessionD1,
    persist,
    serializeStateForPersistence,
    reportPersistenceFailure,
    clearPersistenceFailure,
  });
  return usbStorageController;
}

function wireUsbStorageEvents(){
  if (els.btnUsbStorageConnect){
    els.btnUsbStorageConnect.addEventListener("click", async () => {
      const controller = getUsbStorageController();
      const result = await controller.connect();
      if (result?.ok){
        clearPersistenceFailure("state");
        clearPersistenceFailure("backup");
      }
    });
  }
  if (els.btnUsbStorageLoad){
    els.btnUsbStorageLoad.addEventListener("click", async () => {
      await getUsbStorageController().loadFromFolder();
    });
  }
  if (els.btnUsbStorageSave){
    els.btnUsbStorageSave.addEventListener("click", async () => {
      await getUsbStorageController().saveNow({ requestPermission: true });
    });
  }
  if (els.btnUsbStorageDisconnect){
    els.btnUsbStorageDisconnect.addEventListener("click", async () => {
      await getUsbStorageController().disconnect();
    });
  }
}

async function copyDebugBundle(){
  return copyDebugBundleModule({
    getOperationsDiagnosticsSnapshot,
    engine,
    state,
    APP_VERSION,
    BUILD_ID,
    getLastExportHash: () => lastExportHash,
    recentErrors,
    maxErrors: MAX_ERRORS,
    computeRealityDrift,
    listMissingEvidenceAudit,
    listMissingNoteAudit,
    computeIntelIntegrityScore,
    downloadText,
  });
}

function scheduleBackupWrite(){
  return getBackupRecoveryController().scheduleBackupWrite();
}

function refreshBackupDropdown(){
  return getBackupRecoveryController().refreshBackupDropdown();
}

function restoreBackupByIndex(idx){
  return getBackupRecoveryController().restoreBackupByIndex(idx);
}

// Module-level constants
const SCENARIO_BASELINE_ID = "baseline";
const SCENARIO_MAX = 20;
const DATA_BRIDGE_KEY = "__FPE_DATA_API__";
const SCENARIO_BRIDGE_KEY = "__FPE_SCENARIO_API__";
const SHELL_BRIDGE_KEY = "__FPE_SHELL_API__";
const DISTRICT_BRIDGE_KEY = "__FPE_DISTRICT_API__";
const REACH_BRIDGE_KEY = "__FPE_REACH_API__";
const TURNOUT_BRIDGE_KEY = "__FPE_TURNOUT_API__";
const PLAN_BRIDGE_KEY = "__FPE_PLAN_API__";
const OUTCOME_BRIDGE_KEY = "__FPE_OUTCOME_API__";
const DECISION_BRIDGE_KEY = "__FPE_DECISION_API__";
const BRIDGE_SYNC_EVENT = "fpe:bridge-sync";
let bridgeSyncRevision = 0;
let bridgeSyncAfterRenderPending = null;

function normalizeBridgeSelectOptions(options){
  const rows = Array.isArray(options) ? options : [];
  /** @type {Array<{ value: string, label: string }>} */
  const out = [];
  const seen = new Set();
  for (const row of rows){
    const value = String(row?.value ?? "").trim();
    const label = String(row?.label ?? value).trim() || value;
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label });
  }
  return out;
}

function normalizeBridgeSelectValue(value, options, fallbackValue = ""){
  const normalizedOptions = normalizeBridgeSelectOptions(options);
  const fallback = String(fallbackValue ?? "").trim();
  const raw = String(value ?? "").trim();
  if (raw && normalizedOptions.some((row) => row.value === raw)){
    return raw;
  }
  if (fallback && normalizedOptions.some((row) => row.value === fallback)){
    return fallback;
  }
  return normalizedOptions[0]?.value || "";
}

function bridgeSelectOptionsWithSelected(options, selectedValue){
  const normalized = normalizeBridgeSelectOptions(options);
  const selected = String(selectedValue ?? "").trim();
  if (selected && !normalized.some((row) => row.value === selected)){
    normalized.push({ value: selected, label: selected });
  }
  return normalized;
}

function notifyBridgeSync({ source = "runtime", reason = "state_changed" } = {}){
  bridgeSyncRevision += 1;
  const payload = {
    revision: bridgeSyncRevision,
    source: String(source || "runtime"),
    reason: String(reason || "state_changed"),
    at: Date.now(),
  };
  try{
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function"){
      window.dispatchEvent(new CustomEvent(BRIDGE_SYNC_EVENT, { detail: payload }));
    }
  } catch {
    // No-op if bridge sync events cannot be dispatched.
  }
  observeContractEvent({
    type: "bridge_sync",
    action_name: "notify_bridge_sync",
    source: payload.source,
    reason: payload.reason,
    bridgeRevision: payload.revision,
    observed_behavior: `bridge sync dispatched (${payload.source}/${payload.reason})`,
  });
  return payload;
}

function queueBridgeSyncAfterRender({ source = "runtime", reason = "state_changed" } = {}){
  bridgeSyncAfterRenderPending = {
    source: String(source || "runtime"),
    reason: String(reason || "state_changed"),
  };
}

function flushQueuedBridgeSyncAfterRender(){
  if (!bridgeSyncAfterRenderPending){
    return;
  }
  const payload = bridgeSyncAfterRenderPending;
  bridgeSyncAfterRenderPending = null;
  notifyBridgeSync({
    source: payload.source,
    reason: payload.reason,
  });
}

function forecastArchiveContextFromState(){
  return buildForecastArchiveContext(state, {
    scenarioId: state?.ui?.activeScenarioId,
  });
}

function forecastArchiveScopeKey(context = null){
  const ctx = context && typeof context === "object"
    ? context
    : forecastArchiveContextFromState();
  const campaignId = String(ctx?.campaignId || "").trim();
  const officeId = String(ctx?.officeId || "").trim() || "all";
  return `${campaignId}::${officeId}`;
}

function dataBridgeBuildBackupOptions(){
  const selectEl = els?.restoreBackup;
  if (selectEl instanceof HTMLSelectElement) {
    return Array.from(selectEl.options || [])
      .filter((opt) => opt && String(opt.value || "").trim())
      .map((opt) => ({
        value: String(opt.value || ""),
        label: String(opt.textContent || "").trim() || String(opt.value || "")
      }));
  }
  const backups = readBackups();
  return backups.map((entry, idx) => {
    const when = entry?.ts ? String(entry.ts).replace("T", " ").replace("Z", "") : "";
    const name = String(entry?.scenarioName || "").trim();
    const label = `${when}${name ? ` — ${name}` : ""}`.trim() || `Backup ${idx + 1}`;
    return { value: String(idx), label };
  });
}

function dataBridgeBuildArchiveRows(){
  const entries = readForecastArchive(forecastArchiveContextFromState());
  return Array.isArray(entries) ? entries : [];
}

function dataBridgeBuildArchiveOptions(entries = []){
  return buildForecastArchiveOptions(entries);
}

let dataBridgeSelectedBackup = "";
let dataBridgeImportFileName = "";
let dataBridgeHashBannerText = "";
let dataBridgeWarnBannerText = "";
let dataBridgeUsbStatusText = "";
let dataBridgeSelectedArchiveHash = "";
let dataBridgeVoterImportStatusText = "";

function dataBridgeEnsureReportingState(){
  if (!state.ui || typeof state.ui !== "object"){
    state.ui = {};
  }
  if (!state.ui.reporting || typeof state.ui.reporting !== "object"){
    state.ui.reporting = {};
  }
  const reporting = state.ui.reporting;
  if (!reporting.request || typeof reporting.request !== "object"){
    reporting.request = {};
  }
  reporting.request.type = normalizeReportType(reporting.request.type);
  if (typeof reporting.previewText !== "string"){
    reporting.previewText = "";
  }
  if (typeof reporting.lastStatus !== "string"){
    reporting.lastStatus = "";
  }
  if (typeof reporting.lastGeneratedAt !== "string"){
    reporting.lastGeneratedAt = "";
  }
  if (!reporting.lastPayload || typeof reporting.lastPayload !== "object"){
    reporting.lastPayload = null;
  }
  return reporting;
}

function shellBridgeResolvedContext(){
  return resolveActiveContext({
    fallback: {
      campaignId: state?.campaignId,
      campaignName: state?.campaignName,
      officeId: state?.officeId,
      scenarioId: state?.ui?.activeScenarioId || state?.scenarioId,
    },
  });
}

function shellBridgeSyncContextLinks(){
  const ctx = shellBridgeResolvedContext();
  applyActiveContextToLinks(ctx, ".nav-item-new[href]");
  applyActiveContextToLinks(ctx, ".fpe-nav__item[href]");
}

function shellBridgeClean(value){
  return String(value == null ? "" : value).trim();
}

function shellBridgeToFiniteOrNull(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function shellBridgeResolveDecisionSession(){
  const decision = state?.ui?.decision;
  const sessions = (decision?.sessions && typeof decision.sessions === "object")
    ? decision.sessions
    : {};
  const activeId = shellBridgeClean(decision?.activeSessionId);
  if (activeId && sessions[activeId] && typeof sessions[activeId] === "object"){
    return sessions[activeId];
  }
  const ids = Object.keys(sessions);
  if (!ids.length){
    return null;
  }
  const first = sessions[ids[0]];
  return first && typeof first === "object" ? first : null;
}

function shellBridgeBuildPlaybookSignals(){
  const validation = state?.ui?.lastValidationSnapshot && typeof state.ui.lastValidationSnapshot === "object"
    ? state.ui.lastValidationSnapshot
    : {};
  const validationReadiness = validation?.readiness && typeof validation.readiness === "object"
    ? validation.readiness
    : {};
  const readinessBand = shellBridgeClean(validation?.readinessBand || validationReadiness?.band).toLowerCase();
  const readinessScore = shellBridgeToFiniteOrNull(validation?.readinessScore ?? validationReadiness?.score);
  const realism = state?.ui?.lastRealismSnapshot && typeof state.ui.lastRealismSnapshot === "object"
    ? state.ui.lastRealismSnapshot
    : {};
  const realismClassification = shellBridgeClean(realism?.classification).toLowerCase();
  const realismStatus = shellBridgeClean(realism?.status).toLowerCase();
  const capacitySeverity = shellBridgeClean(realism?.capacity?.severity).toLowerCase();
  const capacityRatioRequiredToAvailable = shellBridgeToFiniteOrNull(realism?.capacity?.ratioRequiredToAvailable);
  const governance = state?.ui?.lastGovernanceSnapshot && typeof state.ui.lastGovernanceSnapshot === "object"
    ? state.ui.lastGovernanceSnapshot
    : {};
  const governanceConfidenceBand = shellBridgeClean(governance?.confidenceBand).toLowerCase();
  const saturationPressure = shellBridgeClean(governance?.executionSaturationPressure).toLowerCase();
  const governanceTopWarning = shellBridgeClean(governance?.topWarning);
  const learningTopSuggestion = shellBridgeClean(governance?.learningTopSuggestion);
  const learningRecommendation = shellBridgeClean(governance?.learningRecommendation);
  const assumptionDriftDetected = /assumption/i.test(governanceTopWarning)
    || /assumption/i.test(learningTopSuggestion)
    || /assumption/i.test(learningRecommendation);

  const weather = state?.warRoom?.weather && typeof state.warRoom.weather === "object"
    ? state.warRoom.weather
    : {};
  const weatherAdjustment = state?.warRoom?.weatherAdjustment && typeof state.warRoom.weatherAdjustment === "object"
    ? state.warRoom.weatherAdjustment
    : {};
  const weatherFieldExecutionRisk = shellBridgeClean(weather?.fieldExecutionRisk).toLowerCase();
  const weatherElectionDayTurnoutRisk = shellBridgeClean(weather?.electionDayTurnoutRisk).toLowerCase();
  const weatherMode = weatherAdjustment?.enabled && shellBridgeClean(weatherAdjustment?.mode).toLowerCase() === "today_only"
    ? "today_only"
    : "observe_only";

  const eventCalendar = state?.warRoom?.eventCalendar && typeof state.warRoom.eventCalendar === "object"
    ? state.warRoom.eventCalendar
    : {};
  const events = Array.isArray(eventCalendar?.events) ? eventCalendar.events : [];
  const todayIso = new Date().toISOString().slice(0, 10);
  let appliedCampaignEvents = 0;
  let todayCampaignEvents = 0;
  let todayExpectedVolunteers = 0;
  for (const eventRow of events){
    if (shellBridgeClean(eventRow?.category).toLowerCase() !== "campaign") continue;
    if (!eventRow?.applyToModel) continue;
    appliedCampaignEvents += 1;
    if (shellBridgeClean(eventRow?.date) === todayIso){
      todayCampaignEvents += 1;
      const expectedVolunteers = shellBridgeToFiniteOrNull(eventRow?.expectedVolunteers);
      if (expectedVolunteers != null && expectedVolunteers > 0){
        todayExpectedVolunteers += expectedVolunteers;
      }
    }
  }

  const decisionSession = shellBridgeResolveDecisionSession();
  const decisionWarRoom = decisionSession?.warRoom && typeof decisionSession.warRoom === "object"
    ? decisionSession.warRoom
    : {};
  const decisionItemsCount = Array.isArray(decisionWarRoom?.decisionItems) ? decisionWarRoom.decisionItems.length : 0;
  const watchItemsCount = Array.isArray(decisionWarRoom?.watchItems) ? decisionWarRoom.watchItems.length : 0;
  const decisionPressureLevel = decisionItemsCount >= 3
    ? "high"
    : (decisionItemsCount > 0 ? "medium" : "low");

  const persuasionPct = shellBridgeToFiniteOrNull(state?.persuasionPct);
  const workforceRoleTypingCoverage = shellBridgeToFiniteOrNull(state?.ui?.twCapOutlookLatest?.workforce?.roleTypingCoveragePct);
  const volunteerScale = shellBridgeToFiniteOrNull(state?.volunteerMultBase);

  const tacticRows = state?.budget?.tactics && typeof state.budget.tactics === "object"
    ? Object.entries(state.budget.tactics)
      .map(([id, tactic]) => ({
        id: shellBridgeClean(id).toLowerCase(),
        enabled: !!tactic?.enabled,
        cpa: shellBridgeToFiniteOrNull(tactic?.cpa),
      }))
      .filter((row) => row.enabled && row.cpa != null && row.cpa > 0)
    : [];
  let optimizerCheapChannelRisk = false;
  if (tacticRows.length >= 2){
    const sortedByCpa = tacticRows.slice().sort((a, b) => Number(a.cpa) - Number(b.cpa));
    const cheapest = shellBridgeToFiniteOrNull(sortedByCpa[0]?.cpa);
    const second = shellBridgeToFiniteOrNull(sortedByCpa[1]?.cpa);
    if (cheapest != null && second != null && cheapest > 0){
      optimizerCheapChannelRisk = (second / cheapest) >= 2.2;
    }
  }

  const planRows = Array.isArray(state?.ui?.lastPlanRows) ? state.ui.lastPlanRows : [];
  let optimizerTopChannelShare = null;
  if (planRows.length){
    let totalAttempts = 0;
    let topAttempts = 0;
    for (const row of planRows){
      const attempts = shellBridgeToFiniteOrNull(row?.attempts);
      if (attempts == null || attempts <= 0) continue;
      totalAttempts += attempts;
      if (attempts > topAttempts){
        topAttempts = attempts;
      }
    }
    if (totalAttempts > 0){
      optimizerTopChannelShare = topAttempts / totalAttempts;
    }
  }

  return {
    readinessBand,
    readinessScore,
    realismClassification,
    realismStatus,
    governanceConfidenceBand,
    governanceTopWarning,
    assumptionDriftDetected,
    saturationPressure,
    decisionPressureLevel,
    decisionItemsCount,
    watchItemsCount,
    optimizerCheapChannelRisk,
    optimizerTopChannelShare,
    persuasionPct,
    roleTypingCoveragePct: workforceRoleTypingCoverage,
    volunteerScale,
    capacitySeverity,
    capacityRatioRequiredToAvailable,
    weatherFieldExecutionRisk,
    weatherElectionDayTurnoutRisk,
    weatherMode,
    appliedCampaignEvents,
    todayCampaignEvents,
    todayExpectedVolunteers,
  };
}

function shellBridgeReadPlaybookEnabled(srcState = state){
  const ui = (srcState?.ui && typeof srcState.ui === "object") ? srcState.ui : {};
  if (Object.prototype.hasOwnProperty.call(ui, "playbook")){
    return !!ui.playbook;
  }
  return !!ui.training;
}

function shellBridgeApplyPlaybookUiState(enabled){
  const value = !!enabled;
  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  state.ui.playbook = value;
  state.ui.training = value;
  if (els.toggleTraining) els.toggleTraining.checked = value;
  document.body.classList.toggle("training", value);
  document.body.classList.toggle("playbook", value);
  if (els.explainCard) els.explainCard.hidden = !value;
}

function shellBridgeStateView(){
  const ctx = shellBridgeResolvedContext();
  const contextValidation = validateCampaignContext(ctx, { requireOffice: false });
  const playbookEnabled = shellBridgeReadPlaybookEnabled();
  return {
    scenarioName: String(state?.scenarioName || ""),
    playbookEnabled,
    trainingEnabled: playbookEnabled,
    campaignId: String(ctx?.campaignId || ""),
    campaignName: String(state?.campaignName || ctx?.campaignName || ""),
    officeId: String(ctx?.officeId || ""),
    scenarioId: String(ctx?.scenarioId || ""),
    isCampaignLocked: !!ctx?.isCampaignLocked,
    isOfficeLocked: !!ctx?.isOfficeLocked,
    isScenarioLocked: !!ctx?.isScenarioLocked,
    contextReady: !!contextValidation?.ok,
    contextMissing: Array.isArray(contextValidation?.missing) ? contextValidation.missing.slice() : [],
    playbookSignals: shellBridgeBuildPlaybookSignals(),
  };
}

function shellBridgeSetScenarioName(rawValue){
  const nextValue = String(rawValue == null ? "" : rawValue);
  state.scenarioName = nextValue;
  if (els.scenarioName && els.scenarioName.value !== nextValue){
    els.scenarioName.value = nextValue;
  }
  schedulePersist();
  notifyBridgeSync({ source: "bridge.shell", reason: "scenario_name_changed" });
  return { ok: true, view: shellBridgeStateView() };
}

function shellBridgeSetContext(rawPatch){
  const patch = (rawPatch && typeof rawPatch === "object") ? rawPatch : {};
  const current = shellBridgeResolvedContext();
  const requestedCampaignId = String(patch.campaignId == null ? "" : patch.campaignId).trim();
  const requestedCampaignName = String(patch.campaignName == null ? "" : patch.campaignName).trim();
  const requestedOfficeId = String(patch.officeId == null ? "" : patch.officeId).trim();
  const requestedScenarioId = String(patch.scenarioId == null ? "" : patch.scenarioId).trim();

  const next = resolveActiveContext({
    campaignId: current.isCampaignLocked ? current.campaignId : requestedCampaignId,
    campaignName: current.isCampaignLocked ? current.campaignName : requestedCampaignName,
    officeId: current.isOfficeLocked ? current.officeId : requestedOfficeId,
    scenarioId: current.isScenarioLocked ? current.scenarioId : requestedScenarioId,
    fallback: {
      campaignId: state?.campaignId || current.campaignId,
      campaignName: state?.campaignName || current.campaignName,
      officeId: state?.officeId || current.officeId,
      scenarioId: state?.ui?.activeScenarioId || state?.scenarioId || current.scenarioId,
    },
  });
  const nextContextValidation = validateCampaignContext(next, { requireOffice: false });
  observeContractEvent({
    type: "context_update",
    action_name: "shellBridgeSetContext",
    handler_name: "shellBridgeSetContext",
    context: {
      campaignId: next?.campaignId,
      officeId: next?.officeId,
      scenarioId: next?.scenarioId,
    },
    contextReady: !!nextContextValidation?.ok,
    contextMissing: Array.isArray(nextContextValidation?.missing) ? nextContextValidation.missing.slice() : [],
    observed_behavior: nextContextValidation?.ok
      ? "context update resolved campaign/office scope"
      : `context update missing: ${(nextContextValidation?.missing || []).join(", ")}`,
  });

  if (current.isCampaignLocked && requestedCampaignId && requestedCampaignId !== current.campaignId){
    return { ok: false, code: "campaign_locked", view: shellBridgeStateView() };
  }
  if (current.isOfficeLocked && requestedOfficeId && requestedOfficeId !== current.officeId){
    return { ok: false, code: "office_locked", view: shellBridgeStateView() };
  }
  if (current.isScenarioLocked && requestedScenarioId && requestedScenarioId !== current.scenarioId){
    return { ok: false, code: "scenario_locked", view: shellBridgeStateView() };
  }

  const scopeChanged = (
    String(current?.campaignId || "") !== String(next?.campaignId || "")
    || String(current?.officeId || "") !== String(next?.officeId || "")
  );

  if (!scopeChanged){
    state.campaignId = String(next?.campaignId || state?.campaignId || "");
    state.officeId = String(next?.officeId || state?.officeId || "");
    if (requestedCampaignName && !current.isCampaignLocked){
      state.campaignName = requestedCampaignName;
    } else if (!state.campaignName){
      state.campaignName = String(next?.campaignName || "");
    }
    shellBridgeSyncContextLinks();
    schedulePersist();
    notifyBridgeSync({ source: "bridge.shell", reason: "context_updated" });
    return { ok: true, changed: false, view: shellBridgeStateView() };
  }

  persist();
  const loaded = loadState({
    campaignId: next.campaignId,
    campaignName: requestedCampaignName || next.campaignName,
    officeId: next.officeId,
    scenarioId: next.scenarioId,
  });

  state = normalizeLoadedScenarioRuntime(loaded || makeDefaultStateModule({
    uid,
    activeContext: {
      campaignId: next.campaignId,
      campaignName: requestedCampaignName || next.campaignName,
      officeId: next.officeId,
      scenarioId: next.scenarioId,
    },
  }));
  observeContractEvent({
    type: "state_rehydrated",
    action_name: "shellBridgeSetContext.scope_change",
    handler_name: "shellBridgeSetContext",
    context: {
      campaignId: state?.campaignId,
      officeId: state?.officeId,
      scenarioId: state?.ui?.activeScenarioId || state?.scenarioId,
    },
    observed_behavior: "state rehydrated for context scope change",
  });
  if (requestedCampaignName && !current.isCampaignLocked){
    state.campaignName = requestedCampaignName;
  }

  refreshModelAuditFromArchive();
  ensureScenarioRegistry();
  ensureDecisionScaffold();
  try{
    const baseline = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
    if (baseline){
      baseline.inputs = scenarioInputsFromState(state);
      baseline.outputs = scenarioOutputsFromState(state);
    }
  } catch {}
  applyStateToUI();
  rebuildCandidateTable();
  render();
  safeCall(() => { renderScenarioManagerC1(); });
  safeCall(() => { renderDecisionSessionD1(); });
  shellBridgeSyncContextLinks();
  persist();
  notifyBridgeSync({ source: "bridge.shell", reason: "context_scope_changed" });
  return { ok: true, changed: true, view: shellBridgeStateView() };
}

function shellBridgeSetTrainingEnabled(enabled){
  shellBridgeApplyPlaybookUiState(enabled);
  setText(els.snapshotHash, lastResultsSnapshot?.snapshotHash || "—");
  setText(els.snapshotHashSidebar, lastResultsSnapshot?.snapshotHash || "—");
  persist();
  notifyBridgeSync({ source: "bridge.shell", reason: "playbook_toggled" });
  return { ok: true, view: shellBridgeStateView() };
}

function shellBridgeSetPlaybookEnabled(enabled){
  return shellBridgeSetTrainingEnabled(enabled);
}

function shellBridgeSyncPlaybookUiState(){
  shellBridgeApplyPlaybookUiState(shellBridgeReadPlaybookEnabled());
  return { ok: true, view: shellBridgeStateView() };
}

function shellBridgeOpenDiagnostics(){
  openDiagnostics();
  return { ok: true, view: shellBridgeStateView() };
}

function shellBridgeResetScenario(){
  const ok = confirm("Reset all fields to defaults? This will clear the saved scenario in this browser.");
  if (!ok){
    return { ok: false, code: "canceled", view: shellBridgeStateView() };
  }
  state = makeDefaultState();
  refreshModelAuditFromArchive();
  ensureScenarioRegistry();
  ensureDecisionScaffold();
  try{
    const baseline = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
    if (baseline){
      baseline.inputs = scenarioInputsFromState(state);
      baseline.outputs = scenarioOutputsFromState(state);
    }
  } catch {}
  clearState();
  applyStateToUI();
  rebuildCandidateTable();
  shellBridgeSyncPlaybookUiState();
  applyThemeFromState();
  render();
  safeCall(() => { renderScenarioManagerC1(); });
  safeCall(() => { renderDecisionSessionD1(); });
  shellBridgeSyncContextLinks();
  persist();
  notifyBridgeSync({ source: "bridge.shell", reason: "scenario_reset" });
  return { ok: true, view: shellBridgeStateView() };
}

function installShellBridge(){
  window[SHELL_BRIDGE_KEY] = {
    getView: () => shellBridgeStateView(),
    setScenarioName: (value) => shellBridgeSetScenarioName(value),
    setContext: (patch) => shellBridgeSetContext(patch),
    setPlaybookEnabled: (enabled) => shellBridgeSetPlaybookEnabled(enabled),
    setTrainingEnabled: (enabled) => shellBridgeSetTrainingEnabled(enabled),
    openDiagnostics: () => shellBridgeOpenDiagnostics(),
    resetScenario: () => shellBridgeResetScenario(),
  };
  window.__FPE_RESET_SCENARIO__ = () => shellBridgeResetScenario();
}

function dataBridgeHasFsSupport(){
  return typeof window !== "undefined"
    && !!window.isSecureContext
    && typeof window.showDirectoryPicker === "function";
}

function dataBridgeNormalizeWarnings(list){
  const arr = Array.isArray(list) ? list : [];
  const benignUnknownFields = new Set(["buildId", "appVersion", "timestamp"]);
  const seen = new Set();
  const out = [];
  for (const item of arr){
    const text = String(item == null ? "" : item).trim();
    if (!text) continue;
    const m = text.match(/^Unknown field '([^']+)' ignored\.?$/i);
    if (m && benignUnknownFields.has(String(m[1] || "").trim())) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function dataBridgeSetHashBannerText(text){
  dataBridgeHashBannerText = String(text || "").trim();
}

function dataBridgeSetWarnBannerText(text){
  dataBridgeWarnBannerText = String(text || "").trim();
}

function dataBridgeSetImportFileName(name){
  dataBridgeImportFileName = String(name || "").trim();
}

function dataBridgeSetUsbStatusText(text){
  dataBridgeUsbStatusText = String(text || "").trim();
}

function dataBridgeSetVoterImportStatusText(text){
  dataBridgeVoterImportStatusText = String(text || "").trim();
}

function dataBridgeApplyUsbResultStatus(result){
  if (result?.ok){
    dataBridgeSetUsbStatusText("");
    return;
  }
  if (result?.canceled){
    dataBridgeSetUsbStatusText("Folder connect canceled.");
    return;
  }
  const code = String(result?.error || "").trim();
  switch (code){
    case "unsupported":
      dataBridgeSetUsbStatusText("External folder storage requires HTTPS and File System Access browser support.");
      break;
    case "permission_denied":
      dataBridgeSetUsbStatusText("Folder permission denied.");
      break;
    case "not_connected":
      dataBridgeSetUsbStatusText("Connect folder before running this action.");
      break;
    case "missing_state_file":
      dataBridgeSetUsbStatusText("No state file found in connected folder.");
      break;
    case "load_failed":
      dataBridgeSetUsbStatusText("USB load failed.");
      break;
    case "serialize_failed":
    case "parse_failed":
    case "write_failed":
      dataBridgeSetUsbStatusText("USB save failed.");
      break;
    default:
      dataBridgeSetUsbStatusText("Using browser storage only.");
      break;
  }
}

function dataBridgeApplyImportedScenario(nextScenario){
  const normalized = normalizeLoadedScenarioRuntime(nextScenario);
  state = normalized;
  observeContractEvent({
    type: "state_rehydrated",
    action_name: "dataBridgeApplyImportedScenario",
    handler_name: "dataBridgeApplyImportedScenario",
    context: diagnosticContextFromState(state),
    observed_behavior: "state rehydrated from imported scenario snapshot",
  });
  refreshModelAuditFromArchive();
  ensureScenarioRegistry();
  ensureDecisionScaffold();
  try{
    const baseline = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
    if (baseline){
      baseline.inputs = scenarioInputsFromState(state);
      baseline.outputs = scenarioOutputsFromState(state);
    }
  } catch {}
  applyStateToUI();
  rebuildCandidateTable();
  shellBridgeSyncPlaybookUiState();
  applyThemeFromState();
  render();
  safeCall(() => { renderDecisionSessionD1(); });
  persist();
  notifyBridgeSync({ source: "bridge.data", reason: "scenario_imported" });
}

function dataBridgeRunSaveJson(){
  const scenarioClone = structuredClone(state);
  const snapshot = {
    modelVersion: engine.snapshot.MODEL_VERSION,
    schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
    scenarioState: scenarioClone,
    appVersion: APP_VERSION,
    buildId: BUILD_ID
  };
  const payload = engine.snapshot.makeScenarioExport(snapshot);
  if (engine.snapshot.hasNonFiniteNumbers(payload)){
    dataBridgeSetWarnBannerText("Export blocked: scenario contains NaN/Infinity.");
    return { ok: false, code: "non_finite" };
  }
  lastExportHash = String(payload?.snapshotHash || "") || null;
  const filename = engine.snapshot.makeTimestampedFilename("field-path-scenario", "json");
  const text = engine.snapshot.deterministicStringify(payload, 2);
  downloadText(text, filename, "application/json");
  return { ok: true };
}

function dataBridgeRunExportCsv(){
  if (!lastResultsSnapshot){
    dataBridgeSetWarnBannerText("Nothing to export yet. Run a scenario first.");
    return { ok: false, code: "missing_snapshot" };
  }
  const csv = engine.snapshot.planRowsToCsv(lastResultsSnapshot);
  if (/NaN|Infinity/.test(csv)){
    dataBridgeSetWarnBannerText("CSV export blocked: contains NaN/Infinity.");
    return { ok: false, code: "non_finite" };
  }
  const filename = engine.snapshot.makeTimestampedFilename("field-path-plan", "csv");
  downloadText(csv, filename, "text/csv");
  return { ok: true };
}

async function dataBridgeRunCopySummary(){
  if (!lastResultsSnapshot){
    dataBridgeSetWarnBannerText("Nothing to copy yet. Run a scenario first.");
    return { ok: false, code: "missing_snapshot" };
  }
  const text = engine.snapshot.formatSummaryText(lastResultsSnapshot);
  const result = await engine.snapshot.copyTextToClipboard(text);
  if (!result?.ok){
    dataBridgeSetWarnBannerText(result?.reason || "Copy failed.");
    return { ok: false, code: "copy_failed" };
  }
  return { ok: true };
}

function dataBridgePickJsonFile(){
  return new Promise((resolve) => {
    try{
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.hidden = true;
      input.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        input.remove();
        resolve(file);
      }, { once: true });
      document.body.appendChild(input);
      input.click();
    } catch {
      resolve(null);
    }
  });
}

async function dataBridgeImportJsonFile(file){
  const nextFile = file || null;
  if (!nextFile){
    return { ok: false, code: "missing_file" };
  }
  dataBridgeSetImportFileName(nextFile.name || "");
  dataBridgeSetWarnBannerText("");
  dataBridgeSetHashBannerText("");

  const loaded = await readJsonFile(nextFile);
  if (!loaded || typeof loaded !== "object"){
    dataBridgeSetWarnBannerText("Import failed: invalid JSON.");
    return { ok: false, code: "invalid_json" };
  }

  const prePolicy = engine.snapshot.checkStrictImportPolicy({
    strictMode: !!state?.ui?.strictImport,
    importedSchemaVersion: loaded.schemaVersion || null,
    currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
    hashMismatch: false
  });
  if (!prePolicy.ok){
    dataBridgeSetWarnBannerText(prePolicy.issues.join(" "));
    return { ok: false, code: "policy_blocked" };
  }

  const migrated = engine.snapshot.migrateSnapshot(loaded);
  const warnings = [];
  if (Array.isArray(migrated?.warnings)) warnings.push(...migrated.warnings);

  const validated = engine.snapshot.validateScenarioExport(migrated?.snapshot, engine.snapshot.MODEL_VERSION);
  if (!validated?.ok){
    dataBridgeSetWarnBannerText(`Import failed: ${validated?.reason || "invalid snapshot"}.`);
    return { ok: false, code: "validate_failed" };
  }

  const missing = requiredScenarioKeysMissing(validated.scenario);
  if (missing.length){
    dataBridgeSetWarnBannerText(`Import failed: missing fields: ${missing.join(", ")}`);
    return { ok: false, code: "missing_fields" };
  }

  const quality = engine.snapshot.validateImportedScenarioData(validated.scenario);
  if (!quality.ok){
    const detail = Array.isArray(quality.errors) && quality.errors.length
      ? ` ${quality.errors[0]}`
      : "";
    dataBridgeSetWarnBannerText(`Import failed: quality checks failed.${detail}`);
    return { ok: false, code: "quality_failed" };
  }
  if (Array.isArray(quality?.warnings)) warnings.push(...quality.warnings);

  const normalizedWarnings = dataBridgeNormalizeWarnings(warnings);
  if (normalizedWarnings.length){
    const shown = normalizedWarnings.slice(0, 3).join(" • ");
    const extra = normalizedWarnings.length > 3 ? ` (+${normalizedWarnings.length - 3} more)` : "";
    dataBridgeSetWarnBannerText(`${shown}${extra}`.trim());
  } else {
    dataBridgeSetWarnBannerText("");
  }

  try{
    const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
    const recomputed = engine.snapshot.computeSnapshotHash({
      modelVersion: validated.modelVersion,
      scenarioState: validated.scenario
    });
    const hashMismatch = !!(exportedHash && exportedHash !== recomputed);
    if (hashMismatch){
      dataBridgeSetHashBannerText("Snapshot hash differs from exported hash.");
      console.warn("Snapshot hash mismatch", { exportedHash, recomputed });
    } else {
      dataBridgeSetHashBannerText("");
    }

    const policy = engine.snapshot.checkStrictImportPolicy({
      strictMode: !!state?.ui?.strictImport,
      importedSchemaVersion: (migrated?.snapshot?.schemaVersion || loaded.schemaVersion || null),
      currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
      hashMismatch
    });
    if (!policy.ok){
      dataBridgeSetWarnBannerText(policy.issues.join(" "));
      return { ok: false, code: "policy_blocked" };
    }
  } catch {
    if (state?.ui?.strictImport){
      dataBridgeSetWarnBannerText("Import blocked: could not verify integrity hash in strict mode.");
      return { ok: false, code: "hash_verify_failed" };
    }
  }

  dataBridgeApplyImportedScenario(validated.scenario);
  return { ok: true };
}

function dataBridgeStateView(){
  const strictToggle = els?.toggleStrictImport;
  const restoreSelect = els?.restoreBackup;
  const loadJsonInput = els?.loadJson;
  const usb = getUsbStorageController();
  const usbConnected = !!usb?.isConnected?.();
  const strictImport =
    strictToggle instanceof HTMLInputElement
      ? !!strictToggle.checked
      : !!state?.ui?.strictImport;
  const importFileName = dataBridgeImportFileName
    || (loadJsonInput instanceof HTMLInputElement && loadJsonInput.files && loadJsonInput.files.length
      ? String(loadJsonInput.files[0]?.name || "")
      : "");
  const hashBannerText = dataBridgeHashBannerText
    || (els?.importHashBanner instanceof HTMLElement && !els.importHashBanner.hidden
      ? String(els.importHashBanner.textContent || "").trim()
      : "");
  const warnBannerText = dataBridgeWarnBannerText
    || (els?.importWarnBanner instanceof HTMLElement && !els.importWarnBanner.hidden
      ? String(els.importWarnBanner.textContent || "").trim()
      : "");
  const usbStatusText = dataBridgeUsbStatusText;
  const backupOptions = dataBridgeBuildBackupOptions();
  const canFs = dataBridgeHasFsSupport();
  const canUseSnapshot = !!lastResultsSnapshot;
  const archiveRows = dataBridgeBuildArchiveRows();
  const archiveSummary = summarizeForecastArchive(archiveRows);
  const archiveContext = forecastArchiveContextFromState();
  const activeContext = resolveActiveContext({ fallback: archiveContext });
  const archiveOptions = dataBridgeBuildArchiveOptions(archiveRows);
  const archiveLookup = new Map(archiveRows.map((row) => [String(row?.snapshotHash || "").trim(), row]));
  const selectedArchiveHash = resolveForecastArchiveSelectedHash({
    preferredHash: dataBridgeSelectedArchiveHash,
    options: archiveOptions,
    lookup: archiveLookup,
  });
  dataBridgeSelectedArchiveHash = selectedArchiveHash;
  const selectedArchive = archiveLookup.get(selectedArchiveHash) || null;
  const selectedEntryView = buildForecastArchiveSelectedEntryView(selectedArchive);
  const archiveLearning = buildModelLearningFromArchive(archiveRows);
  const modelAuditSummary = archiveLearning.modelAudit;
  const learningSummary = archiveLearning.learning;
  const archiveTableRows = buildForecastArchiveTableRows(archiveRows, { limit: 40 });
  const voterLayer = buildVoterLayerStatusSnapshot(state?.voterData);
  const reporting = dataBridgeEnsureReportingState();
  const reportTypeOptions = listReportTypeOptions().map((row) => ({
    value: String(row?.id || "").trim(),
    label: String(row?.label || row?.id || "").trim() || String(row?.id || ""),
  }));
  const selectedReportType = normalizeBridgeSelectValue(
    reporting?.request?.type,
    reportTypeOptions,
    "internal"
  );
  reporting.request.type = selectedReportType;
  const hasReportPayload = !!(reporting?.lastPayload && typeof reporting.lastPayload === "object");
  const previewText = String(
    reporting?.previewText
      || (hasReportPayload ? buildReportPlainText(reporting.lastPayload) : "")
      || ""
  );
  reporting.previewText = previewText;
  const reportStatus = String(reporting?.lastStatus || "").trim()
    || (hasReportPayload ? "Report composed." : "Choose report type and compose.");

  return {
    context: {
      campaignId: String(activeContext?.campaignId || "").trim(),
      campaignName: String(activeContext?.campaignName || archiveContext?.campaignName || "").trim(),
      officeId: String(activeContext?.officeId || "").trim(),
      scenarioId: String(activeContext?.scenarioId || archiveContext?.scenarioId || "").trim(),
      isCampaignLocked: !!activeContext?.isCampaignLocked,
      isOfficeLocked: !!activeContext?.isOfficeLocked,
      isScenarioLocked: !!activeContext?.isScenarioLocked,
    },
    strictImport,
    backupOptions,
    selectedBackup: dataBridgeSelectedBackup || (restoreSelect instanceof HTMLSelectElement ? String(restoreSelect.value || "") : ""),
    importFileName,
    voterImportStatus: dataBridgeVoterImportStatusText,
    hashBannerText,
    warnBannerText,
    usbConnected,
    usbStatus: usbStatusText || (usbConnected ? "External folder connected." : "Using browser storage only."),
    forecastArchive: {
      summary: archiveSummary,
      options: archiveOptions,
      selectedHash: selectedArchiveHash,
      selectedEntry: selectedEntryView,
      rows: archiveTableRows,
      modelAudit: modelAuditSummary,
      learning: learningSummary,
    },
    reporting: {
      options: reportTypeOptions,
      selectedType: selectedReportType,
      status: reportStatus,
      previewText,
      generatedAt: String(reporting?.lastGeneratedAt || "").trim(),
      hasPayload: hasReportPayload,
    },
    voterLayer,
    controls: {
      strictToggleDisabled: false,
      restoreDisabled: !backupOptions.length,
      saveJsonDisabled: false,
      loadJsonDisabled: false,
      copySummaryDisabled: !canUseSnapshot,
      exportCsvDisabled: !canUseSnapshot,
      usbConnectDisabled: !canFs,
      usbLoadDisabled: !(canFs && usbConnected),
      usbSaveDisabled: !(canFs && usbConnected),
      usbDisconnectDisabled: !canFs,
      voterImportDisabled: false,
      archiveSelectionDisabled: !archiveOptions.length,
      archiveSaveDisabled: !selectedArchiveHash,
      archiveRefreshDisabled: false,
      reportTypeDisabled: false,
      reportComposeDisabled: false,
      reportExportPdfDisabled: !hasReportPayload,
    }
  };
}

function dataBridgeSetStrictImport(enabled){
  const next = !!enabled;
  setState((s) => {
    if (!s.ui || typeof s.ui !== "object") s.ui = {};
    s.ui.strictImport = next;
  });
  try{
    document.body.classList.toggle("strict-import", next);
  } catch {}
  if (els?.toggleStrictImport instanceof HTMLInputElement){
    els.toggleStrictImport.checked = next;
  }
  return { ok: true, view: dataBridgeStateView() };
}

function dataBridgeRestoreBackup(index){
  const value = String(index ?? "").trim();
  if (!value){
    return { ok: false, code: "missing_index", view: dataBridgeStateView() };
  }
  dataBridgeSelectedBackup = value;
  restoreBackupByIndex(value);
  refreshModelAuditFromArchive();
  dataBridgeSelectedBackup = "";
  if (els?.restoreBackup instanceof HTMLSelectElement){
    els.restoreBackup.value = "";
  }
  notifyBridgeSync({ source: "bridge.data", reason: "backup_restored" });
  return { ok: true, view: dataBridgeStateView() };
}

function dataBridgeSetArchiveSelection(snapshotHash){
  const hash = String(snapshotHash || "").trim();
  dataBridgeSelectedArchiveHash = hash;
  return { ok: true, view: dataBridgeStateView() };
}

function dataBridgeSaveArchiveActual(payload = {}){
  const src = payload && typeof payload === "object" ? payload : {};
  const snapshotHash = String(src.snapshotHash || dataBridgeSelectedArchiveHash || "").trim();
  if (!snapshotHash){
    return { ok: false, code: "missing_snapshot_hash", view: dataBridgeStateView() };
  }
  const actual = normalizeForecastArchiveActual(src.actual);
  const notes = String(src.notes || "").trim();
  const result = updateForecastArchiveActual({
    snapshotHash,
    actual,
    notes,
  }, forecastArchiveContextFromState());
  if (!result?.ok){
    return { ok: false, code: String(result?.error || "archive_update_failed"), view: dataBridgeStateView() };
  }
  refreshModelAuditFromArchive();
  schedulePersist();
  notifyBridgeSync({ source: "bridge.data", reason: "archive_actual_saved" });
  return { ok: true, view: dataBridgeStateView() };
}

function dataBridgeRefreshArchive(){
  refreshModelAuditFromArchive();
  return { ok: true, view: dataBridgeStateView() };
}

function dataBridgeImportVoterRows(payload = {}){
  const src = payload && typeof payload === "object" ? payload : {};
  const parsed = parseVoterRowsInput(src.rows ?? src.text ?? src.input, {
    format: src.format,
    maxRows: src.maxRows,
  });
  if (!parsed.ok){
    const msg = parsed.errors[0] || "Voter import failed.";
    dataBridgeSetVoterImportStatusText(msg);
    dataBridgeSetWarnBannerText(msg);
    return { ok: false, code: "voter_import_invalid", errors: parsed.errors, view: dataBridgeStateView() };
  }

  const activeContext = resolveActiveContext({ fallback: forecastArchiveContextFromState() });
  const campaignId = String(
    activeContext?.isCampaignLocked
      ? (activeContext?.campaignId || "")
      : (src.campaignId || activeContext?.campaignId || "")
  ).trim();
  const officeId = String(
    activeContext?.isOfficeLocked
      ? (activeContext?.officeId || "")
      : (src.officeId || activeContext?.officeId || "")
  ).trim();
  const adapterId = String(src.adapterId || "").trim();
  const sourceId = String(src.sourceId || src.fileName || "").trim() || `voter_import_${new Date().toISOString()}`;
  const normalizedRows = normalizeVoterRows(parsed.rows, {
    adapterId,
    campaignId,
    officeId,
    sourceId,
    headerMap: src.headerMap,
    manifest: src.manifest,
  });
  const nextVoterData = normalizeVoterDataState({
    manifest: normalizedRows.manifest,
    rows: normalizedRows.rows,
  });
  mutateState((s) => {
    s.voterData = nextVoterData;
  });
  const importOutcome = buildVoterImportOutcomeView({
    voterDataState: nextVoterData,
    warnings: parsed.warnings,
  });
  dataBridgeSetVoterImportStatusText(importOutcome.statusText);
  if (importOutcome.warningText){
    dataBridgeSetWarnBannerText(importOutcome.warningText);
  } else {
    dataBridgeSetWarnBannerText("");
  }
  schedulePersist();
  return { ok: true, importedRows: importOutcome.rowCount, warnings: parsed.warnings, view: dataBridgeStateView() };
}

function dataBridgeComposeReport(payload = {}){
  const src = payload && typeof payload === "object" ? payload : {};
  const reporting = dataBridgeEnsureReportingState();
  const requestedType = normalizeReportType(src.reportType || reporting.request.type);
  reporting.request.type = requestedType;
  const report = composeReportPayload({
    reportType: requestedType,
    state,
    renderCtx: lastRenderCtx,
    resultsSnapshot: lastResultsSnapshot,
    nowDate: new Date(),
  });
  reporting.lastPayload = report;
  reporting.previewText = buildReportPlainText(report);
  reporting.lastGeneratedAt = String(report?.generatedAt || new Date().toISOString());
  reporting.lastStatus = `Composed ${String(report?.reportLabel || requestedType)} at ${reporting.lastGeneratedAt}.`;
  const reportContext = report?.context && typeof report.context === "object" ? report.context : {};
  observeContractEvent({
    type: "report_composed",
    action_name: "dataBridgeComposeReport",
    handler_name: "dataBridgeComposeReport",
    reportType: requestedType,
    reportContext: {
      campaignId: String(reportContext?.campaignId || "").trim(),
      officeId: String(reportContext?.officeId || "").trim(),
      scenarioId: String(reportContext?.scenarioId || "").trim(),
    },
    reportHasCanonicalSnapshot: !!lastResultsSnapshot,
    reportHasValidation: !!state?.ui?.lastValidationSnapshot,
    reportHasRealism: !!state?.ui?.lastRealismSnapshot,
    reportHasGovernance: !!state?.ui?.lastGovernanceSnapshot,
    requiresValidation: true,
    validationReady: !!state?.ui?.lastValidationSnapshot,
    observed_behavior: `report composed (${requestedType})`,
  });
  dataBridgeSetWarnBannerText("");
  schedulePersist();
  notifyBridgeSync({ source: "bridge.data", reason: "report_composed" });
  return { ok: true, report, view: dataBridgeStateView() };
}

function dataBridgeSetReportType(reportType){
  const reporting = dataBridgeEnsureReportingState();
  const nextType = normalizeReportType(reportType || reporting.request.type);
  reporting.request.type = nextType;
  const composed = dataBridgeComposeReport({ reportType: nextType });
  return {
    ok: !!composed?.ok,
    reportType: nextType,
    view: composed?.view || dataBridgeStateView(),
  };
}

function dataBridgeExportReportPdf(payload = {}){
  const src = payload && typeof payload === "object" ? payload : {};
  const reporting = dataBridgeEnsureReportingState();
  const requestedType = normalizeReportType(src.reportType || reporting.request.type);
  let report = reporting.lastPayload;
  if (!report || normalizeReportType(report?.reportType) !== requestedType){
    const composed = dataBridgeComposeReport({ reportType: requestedType });
    if (!composed?.ok){
      return { ok: false, code: "report_compose_failed", view: dataBridgeStateView() };
    }
    report = composed.report;
  }
  const context = report?.context && typeof report.context === "object" ? report.context : {};
  const fileBase = [
    normalizeReportType(report?.reportType || requestedType),
    String(context?.campaignId || context?.campaignName || "campaign").trim(),
    String(context?.officeId || "office").trim(),
    String(context?.scenarioId || "scenario").trim(),
  ].map((part) => String(part || "").replace(/\s+/g, "-")).filter(Boolean).join("-");
  const result = exportReportPdf(report, { filenameBase: fileBase || "report" });
  if (!result?.ok){
    dataBridgeSetWarnBannerText("Report PDF export failed.");
    return { ok: false, code: "report_export_failed", view: dataBridgeStateView() };
  }
  reporting.lastStatus = result.code === "print_dialog_opened"
    ? "Print dialog opened. Choose Save as PDF to complete export."
    : `Report exported via ${result.code}.`;
  observeContractEvent({
    type: "report_exported",
    action_name: "dataBridgeExportReportPdf",
    handler_name: "dataBridgeExportReportPdf",
    reportType: requestedType,
    reportContext: {
      campaignId: String(context?.campaignId || "").trim(),
      officeId: String(context?.officeId || "").trim(),
      scenarioId: String(context?.scenarioId || "").trim(),
    },
    reportHasCanonicalSnapshot: !!lastResultsSnapshot,
    reportHasValidation: !!state?.ui?.lastValidationSnapshot,
    reportHasRealism: !!state?.ui?.lastRealismSnapshot,
    reportHasGovernance: !!state?.ui?.lastGovernanceSnapshot,
    requiresValidation: true,
    validationReady: !!state?.ui?.lastValidationSnapshot,
    observed_behavior: `report exported (${requestedType}) via ${String(result.code || "unknown")}`,
  });
  dataBridgeSetWarnBannerText("");
  schedulePersist();
  notifyBridgeSync({ source: "bridge.data", reason: "report_pdf_exported" });
  return { ok: true, code: String(result.code || "ok"), view: dataBridgeStateView() };
}

function dataBridgeTrigger(action){
  const key = String(action || "").trim();
  switch (key){
    case "save_json":
      return { ...dataBridgeRunSaveJson(), view: dataBridgeStateView() };
    case "export_csv":
      return { ...dataBridgeRunExportCsv(), view: dataBridgeStateView() };
    case "copy_summary":
      return dataBridgeRunCopySummary()
        .then((result) => ({ ...(result || { ok: false, code: "copy_failed" }), view: dataBridgeStateView() }))
        .catch(() => ({ ok: false, code: "copy_failed", view: dataBridgeStateView() }));
    case "load_json":
      return dataBridgePickJsonFile()
        .then((file) => dataBridgeImportJsonFile(file))
        .then((result) => ({ ...(result || { ok: false, code: "import_failed" }), view: dataBridgeStateView() }))
        .catch(() => {
          dataBridgeSetWarnBannerText("Import failed.");
          return { ok: false, code: "import_failed", view: dataBridgeStateView() };
        });
    case "usb_connect":
      return getUsbStorageController().connect()
        .then((result) => {
          if (result?.ok){
            dataBridgeSetWarnBannerText("");
          }
          dataBridgeApplyUsbResultStatus(result);
          return { ...(result || { ok: false, code: "usb_connect_failed" }), view: dataBridgeStateView() };
        })
        .catch(() => ({ ok: false, code: "usb_connect_failed", view: dataBridgeStateView() }));
    case "usb_load":
      return getUsbStorageController().loadFromFolder()
        .then((result) => {
          dataBridgeApplyUsbResultStatus(result);
          return { ...(result || { ok: false, code: "usb_load_failed" }), view: dataBridgeStateView() };
        })
        .catch(() => ({ ok: false, code: "usb_load_failed", view: dataBridgeStateView() }));
    case "usb_save":
      return getUsbStorageController().saveNow({ requestPermission: true })
        .then((result) => {
          dataBridgeApplyUsbResultStatus(result);
          return { ...(result || { ok: false, code: "usb_save_failed" }), view: dataBridgeStateView() };
        })
        .catch(() => ({ ok: false, code: "usb_save_failed", view: dataBridgeStateView() }));
    case "usb_disconnect":
      return getUsbStorageController().disconnect()
        .then((result) => {
          dataBridgeApplyUsbResultStatus(result);
          return { ...(result || { ok: false, code: "usb_disconnect_failed" }), view: dataBridgeStateView() };
        })
        .catch(() => ({ ok: false, code: "usb_disconnect_failed", view: dataBridgeStateView() }));
    case "compose_report":
      return dataBridgeComposeReport();
    case "export_report_pdf":
      return dataBridgeExportReportPdf();
    default:
      return { ok: false, code: "not_available", view: dataBridgeStateView() };
  }
}

function installDataBridge(){
  window[DATA_BRIDGE_KEY] = {
    getView: () => dataBridgeStateView(),
    setStrictImport: (enabled) => dataBridgeSetStrictImport(enabled),
    restoreBackup: (index) => dataBridgeRestoreBackup(index),
    setArchiveSelection: (snapshotHash) => dataBridgeSetArchiveSelection(snapshotHash),
    setReportType: (reportType) => dataBridgeSetReportType(reportType),
    composeReport: (payload) => dataBridgeComposeReport(payload),
    exportReportPdf: (payload) => dataBridgeExportReportPdf(payload),
    saveArchiveActual: (payload) => dataBridgeSaveArchiveActual(payload),
    refreshArchive: () => dataBridgeRefreshArchive(),
    importVoterRows: (payload) => dataBridgeImportVoterRows(payload),
    trigger: (action) => dataBridgeTrigger(action),
  };
}

// Phase 13 — DOM preflight (prevents silent boot failures)
function preflightEls(){
  preflightElsModule({ els, recordError });
}

function applyTemplateDefaultsForRace(targetState, raceType, options = {}){
  return applyTemplateDefaultsForRaceModule(targetState, raceType, options);
}

function deriveAssumptionsProfileFromState(snap){
  return deriveAssumptionsProfileFromStateModule(snap);
}

function refreshAssumptionsProfile(){
  refreshAssumptionsProfileModule(state, deriveAssumptionsProfileFromState);
}

function assumptionsProfileLabel(src = state){
  return assumptionsProfileLabelModule(src, labelTemplate);
}

const initialStoredState = loadState();
let state = normalizeLoadedScenarioRuntime(initialStoredState || makeDefaultState());
const bootHadLocalState = !!initialStoredState;
bootProbeMark("appRuntime.state.ready", {
  bootHadLocalState,
  campaignId: String(state?.campaignId || ""),
  officeId: String(state?.officeId || ""),
});
let lastModelAuditScopeKey = forecastArchiveScopeKey();
refreshModelAuditFromArchive();
let lastCriticalAuditSnapshot = buildCriticalAuditSnapshot(state);
const contractDiagnosticEngine = getDiagnosticEngine();

function diagnosticContextFromState(srcState = state){
  const snap = srcState && typeof srcState === "object" ? srcState : {};
  return {
    campaignId: String(snap?.campaignId || "").trim(),
    officeId: String(snap?.officeId || "").trim(),
    scenarioId: String(snap?.ui?.activeScenarioId || snap?.scenarioId || "").trim(),
  };
}

function observeContractEvent(rawEvent){
  try{
    const src = rawEvent && typeof rawEvent === "object" ? rawEvent : {};
    const context = src.context && typeof src.context === "object"
      ? src.context
      : diagnosticContextFromState(state);
    contractDiagnosticEngine.observe({
      module: "appRuntime",
      ...src,
      context,
    });
  } catch (err){
    const msg = err?.message ? String(err.message) : String(err || "contract-diagnostic-observe-failed");
    console.warn("[contracts] observe failed:", msg);
  }
}

function diffTopLevelStateKeys(prevState, nextState){
  const prev = prevState && typeof prevState === "object" ? prevState : {};
  const next = nextState && typeof nextState === "object" ? nextState : {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed = [];
  for (const key of keys){
    if (prev[key] !== next[key]){
      changed.push(key);
    }
  }
  return changed.sort();
}

// setState(patchFn) — controlled state mutation for UI-only writes.
// Shallow-clones state, deep-clones only state.ui (where setState writes should live).
// Engine/scenario fields are never mutated here so reference copies are safe.
// Rendering/persistence are queued through commitUIUpdate to avoid input-event thrash.
function setState(patchFn, { actionName = "setState" } = {}){
  const prevState = state;
  const next = { ...state, ui: structuredClone(state.ui) };
  patchFn(next);
  const changedTopLevel = diffTopLevelStateKeys(prevState, next);
  state = next;
  observeContractEvent({
    type: "state_write",
    action_name: String(actionName || "setState"),
    handler_name: typeof patchFn === "function" && patchFn.name ? patchFn.name : "anonymous_patch",
    changedTopLevel,
    changedPaths: changedTopLevel.map((key) => `state.${key}`),
    observed_behavior: changedTopLevel.length
      ? `${String(actionName || "setState")} changed ${changedTopLevel.join(", ")}`
      : `${String(actionName || "setState")} produced no top-level changes`,
  });
  commitUIUpdate();
}

function mutateState(patchFn){
  setState(patchFn, { actionName: "mutateState" });
}

let lastRenderCtx = null;


// =========================
// Theme (System-first, with optional "force dark" override via hidden toggleDark)
// - Default: follow OS (prefers-color-scheme)
// - If user/other UI triggers #toggleDark, checked => force dark, unchecked => follow system
// - Keeps legacy state.ui.dark for backward compatibility but does NOT treat it as the source of truth
// =========================
function systemPrefersDark(){
  return systemPrefersDarkModule();
}

function normalizeThemeMode(){
  normalizeThemeModeModule(state);
}

function computeThemeIsDark(){
  return computeThemeIsDarkModule(state, systemPrefersDark);
}

function applyThemeFromState(){
  applyThemeFromStateModule(state, els, normalizeThemeMode, computeThemeIsDark);
}

function initThemeSystemListener(){
  initThemeSystemListenerModule(state, applyThemeFromState);
}


// Phase 9A — export snapshot cache (pure read by export.js)
let lastResultsSnapshot = null;
let lastArchivedForecastKey = "";

// Phase 11 — session-only safety rails
let selfTestGateStatus = engine.selfTest.SELFTEST_GATE.UNVERIFIED;
let lastExportHash = null;

let lastAppliedWeeklyAction = null;

function archiveForecastSnapshot(snapshot){
  const hash = String(snapshot?.snapshotHash || "").trim();
  const archiveContext = forecastArchiveContextFromState();
  const archiveKey = `${forecastArchiveScopeKey(archiveContext)}::${String(archiveContext?.scenarioId || "")}::${hash}`;
  if (!hash || archiveKey === lastArchivedForecastKey) return;
  const entry = buildForecastArchiveEntry({
    state,
    renderCtx: lastRenderCtx,
    snapshot,
  });
  if (!entry) return;
  const result = appendForecastArchiveEntry(entry, {
    ...archiveContext,
  });
  if (result?.ok){
    lastArchivedForecastKey = archiveKey;
    refreshModelAuditFromArchive();
  }
}

function refreshModelAuditFromArchive(){
  const context = forecastArchiveContextFromState();
  lastModelAuditScopeKey = forecastArchiveScopeKey(context);
  const rows = readForecastArchive(context);
  const archiveLearning = buildModelLearningFromArchive(rows);
  if (!state.ui || typeof state.ui !== "object"){
    state.ui = {};
  }
  state.ui.modelAudit = archiveLearning.modelAudit;
  state.ui.learningLoop = archiveLearning.learning;
  return archiveLearning.modelAudit;
}

function ensureModelAuditCampaignSync(){
  const currentScopeKey = forecastArchiveScopeKey();
  if (currentScopeKey === lastModelAuditScopeKey) return;
  refreshModelAuditFromArchive();
}

function syncWeeklyUndoUI(){
  const wkUndoActionBtnEl = els?.wkUndoActionBtn || null;
  if (!wkUndoActionBtnEl) return;
  const has = !!lastAppliedWeeklyAction;
  wkUndoActionBtnEl.disabled = !has;
  if (els.wkUndoActionMsg) els.wkUndoActionMsg.textContent = has ? (lastAppliedWeeklyAction.label || "") : "";
}

function undoLastWeeklyAction(){
  if (!lastAppliedWeeklyAction) return;
  const prev = lastAppliedWeeklyAction.prevState;
  lastAppliedWeeklyAction = null;
  state = prev;
  ensureDecisionScaffold();
  applyStateToUI();
  commitUIUpdate();
  syncWeeklyUndoUI();
  safeCall(() => { renderDecisionSessionD1(); });
}

const recentErrors = [];
const MAX_ERRORS = 20;
let persistenceErrorSig = "";
const persistenceState = {
  stateSaveOk: true,
  backupSaveOk: true,
  stateError: "",
  backupError: "",
};

function updatePersistenceStatusChip(){
  updatePersistenceStatusChipModule(els, persistenceState);
}

function reportPersistenceFailure(scope, result){
  reportPersistenceFailureModule({
    scope,
    result,
    persistenceState,
    getPersistenceErrorSig: () => persistenceErrorSig,
    setPersistenceErrorSig: (next) => { persistenceErrorSig = String(next ?? ""); },
    recordError,
    updatePersistenceStatusChip,
  });
}

function clearPersistenceFailure(scope){
  clearPersistenceFailureModule({
    scope,
    persistenceState,
    setPersistenceErrorSig: (next) => { persistenceErrorSig = String(next ?? ""); },
    updatePersistenceStatusChip,
  });
}

const uiUpdateQueue = createUiUpdateQueue({
  render: () => render(),
  persist: () => persist(),
  debounceMs: 220,
});

function scheduleRender(){
  uiUpdateQueue.scheduleRender();
}

function schedulePersist({ immediate = false } = {}){
  uiUpdateQueue.schedulePersist({ immediate });
}

function isScenarioLockedForEdits(srcState = state){
  return isScenarioLockedForEditsModule(srcState);
}

function applyScenarioLockUi(){
  applyScenarioLockUiModule({
    state,
    root: document.querySelector(".stage-main-new"),
  });
}

function commitUIUpdate({
  render: doRender = true,
  persist: doPersist = true,
  immediatePersist = false,
  allowScenarioLockBypass = false
} = {}){
  observeContractEvent({
    type: "commit_ui_update",
    action_name: "commitUIUpdate",
    handler_name: "commitUIUpdate",
    doRender,
    doPersist,
    immediatePersist,
    observed_behavior: `commitUIUpdate render=${doRender ? "on" : "off"} persist=${doPersist ? "on" : "off"}`,
  });
  try{
    syncFeatureFlagsFromState(state, { preferFeatures: false });
  } catch {
    // fail-soft: feature sync is compatibility wiring only
  }

  if (doPersist && isScenarioLockedForEdits(state) && !allowScenarioLockBypass){
    if (doRender) scheduleRender();
    return;
  }

  if (doPersist){
    try{
      const workflow = state?.intelState?.workflow || {};
      const pendingCriticalNote = String(state?.ui?.pendingCriticalNote || "").trim();
      const auditResult = captureCriticalAssumptionAudit({
        state,
        previousSnapshot: lastCriticalAuditSnapshot,
        source: "ui",
        requireNote: workflow.requireCriticalNote !== false,
        requireEvidence: workflow.requireCriticalEvidence !== false,
        note: pendingCriticalNote,
      });
      lastCriticalAuditSnapshot = auditResult?.nextSnapshot || buildCriticalAuditSnapshot(state);
      if (auditResult?.wroteAudit && pendingCriticalNote){
        if (!state.ui || typeof state.ui !== "object") state.ui = {};
        state.ui.pendingCriticalNote = "";
        if (els.intelCriticalChangeNote && document.activeElement !== els.intelCriticalChangeNote){
          els.intelCriticalChangeNote.value = "";
        }
      }
    } catch {
      lastCriticalAuditSnapshot = buildCriticalAuditSnapshot(state);
    }
  } else {
    lastCriticalAuditSnapshot = buildCriticalAuditSnapshot(state);
  }
  uiUpdateQueue.commitUIUpdate({ render: doRender, persist: doPersist, immediatePersist });
  if (doRender){
    queueBridgeSyncAfterRender({
      source: "runtime",
      reason: "commit_ui_update",
    });
  } else {
    notifyBridgeSync({
      source: "runtime",
      reason: "state_updated",
    });
  }
}


function makeDefaultState(){
  const activeContext = resolveActiveContext();
  return makeDefaultStateModule({
    uid,
    activeContext,
  });
}

function uid(){
  return Math.random().toString(16).slice(2,10);
}

let candidateUiController = null;

function getCandidateUiController(){
  if (candidateUiController) return candidateUiController;
  candidateUiController = createCandidateUiController({
    els,
    getState: () => state,
    safeNum,
    commitUIUpdate,
  });
  return candidateUiController;
}

function applyStateToUI(){
  applyStateToUIView({
    els,
    state,
    canonicalDoorsPerHourFromSnap,
    syncMcModeUI,
    syncGotvModeUI,
    applyThemeFromState,
  });
  applyScenarioLockUi();
}

function rebuildCandidateTable(){
  return getCandidateUiController().rebuildCandidateTable();
}

function rebuildYourCandidateSelect(){
  return getCandidateUiController().rebuildYourCandidateSelect();
}

function rebuildUserSplitInputs(){
  return getCandidateUiController().rebuildUserSplitInputs();
}

function wireEvents(){
  return wireEventsOrchestratorModule({
    els,
    state: () => state,
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
    getLastResultsSnapshot: () => lastResultsSnapshot,
    setLastExportHash: (next) => { lastExportHash = next; },
    downloadText,
    replaceState: (next) => { state = next; },
    makeDefaultState,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    clearState,
    readJsonFile,
    requiredScenarioKeysMissing,
    normalizeLoadedState: normalizeLoadedScenarioRuntime,
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
  });
}

function normalizeLoadedScenarioRuntime(s){
  const activeContext = resolveActiveContext();
  return normalizeLoadedStateModule(s, {
    makeDefaultState,
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap,
    setCanonicalDoorsPerHour,
    deriveAssumptionsProfileFromState,
    activeContext,
  });
}

function canonicalDoorsPerHourFromSnap(snap){
  return canonicalDoorsPerHourFromSnapModule(snap, safeNum);
}

function setCanonicalDoorsPerHour(target, value){
  setCanonicalDoorsPerHourModule(target, value, safeNum);
}

function canonicalCallsPerHourFromSnap(snap){
  return canonicalCallsPerHourFromSnapModule(snap, safeNum);
}

function setCanonicalCallsPerHour(target, value){
  setCanonicalCallsPerHourModule(target, value, safeNum);
}

function requiredScenarioKeysMissing(scen){
  return requiredScenarioKeysMissingModule(scen);
}

function derivedWeeksRemaining(args){
  const hasArgs = !!(args && typeof args === "object");
  return coreDeriveWeeksRemainingCeil({
    weeksRemainingOverride: hasArgs ? args.weeksRemainingOverride : state?.weeksRemaining,
    electionDateISO: hasArgs ? args.electionDateISO : state?.electionDate,
    nowDate: hasArgs ? args.nowDate : undefined,
  });
}

function getUniverseLayerConfig(){
  return getUniverseLayerConfigFromStateSelector(state);
}

function getEffectiveBaseRates(){
  return getEffectiveBaseRatesFromStateSelector(state, { computeUniverseAdjustedRates });
}

let effectiveInputsController = null;

function getEffectiveInputsController(){
  if (effectiveInputsController) return effectiveInputsController;
  effectiveInputsController = createEffectiveInputsController({
    getState: () => state,
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap,
    getEffectiveBaseRates,
    getEffectiveBaseRatesFromSnap,
    twCapOverrideModeFromState,
    twCapResolveOverrideAttempts,
    twCapPerOrganizerAttemptsPerWeek: TW_CAP_ADAPTERS.twCapPerOrganizerAttemptsPerWeek,
  });
  return effectiveInputsController;
}

function getCapacityDecayConfigFromState(srcState = state){
  return getEffectiveInputsController().getCapacityDecayConfigFromState(srcState);
}

// Step-3 seam: single compiler for effective inputs.
// Operations override is explicit opt-in and falls back to baseline when unavailable.
function compileEffectiveInputs(srcState = state){
  return getEffectiveInputsController().compileEffectiveInputs(srcState);
}

function renderUniverse16Card(){
  renderUniverse16CardModule({
    els,
    state,
    getUniverseLayerConfig,
    getEffectiveBaseRates,
    universeDefaults: UNIVERSE_DEFAULTS,
  });
}

function safeCall(fn, meta){
  const label = typeof meta === "string"
    ? meta
    : String(meta?.label || "");
  safeCallModule(fn, {
    label,
    onError: (err, callLabel) => {
      const msg = err?.message ? String(err.message) : String(err || "Unknown safe-call error");
      recordError("safe-call", callLabel ? `${callLabel}: ${msg}` : msg, {
        label: callLabel || "",
      });
    },
  });
}

function switchToStage(stageId){
  switchToStageModule(stageId);
}

function persist(){
  const usbController = getUsbStorageController();
  if (usbController.isConnected()){
    clearPersistenceFailure("state");
    clearPersistenceFailure("backup");
    usbController.scheduleSave();
    return;
  }
  const result = persistStateSnapshot(state);
  if (result?.ok){
    clearPersistenceFailure("state");
  } else {
    reportPersistenceFailure("state", result);
  }
  scheduleBackupWrite();
  usbController.scheduleSave();
}

function render(){
  ensureModelAuditCampaignSync();
  renderMain({
    state,
    els,
    safeNum,
    engine,
    derivedWeeksRemaining,
    deriveNeedVotes,
    computeElectionSnapshot,
    computeExecutionSnapshot,
    computeWeeklyOpsContext,
    setLastRenderCtx: (next) => { lastRenderCtx = next; },
    setLastResultsSnapshot: (next) => {
      lastResultsSnapshot = next;
      archiveForecastSnapshot(next);
    },
    fmtInt,
    setText,
    safeCall,
    renderStress,
    renderValidation,
    renderAssumptions,
    renderGuardrails,
    renderConversion,
    renderPhase3,
    renderWeeklyOps,
    renderWeeklyOpsInsights,
    renderWeeklyOpsFreshness,
    scheduleOperationsCapacityOutlookRender,
    renderAssumptionDriftE1,
    renderRiskFramingE2,
    renderBottleneckAttributionE3,
    renderSensitivitySnapshotE4,
    renderDecisionConfidenceE5,
    renderImpactTraceE6,
    renderUniverse16Card,
    renderRoi,
    renderOptimization,
    renderTimeline,
    renderDecisionIntelligencePanel,
  });
  applyScenarioLockUi();
  observeContractEvent({
    type: "render_complete",
    action_name: "render",
    handler_name: "render",
    observed_behavior: "render cycle completed",
  });
  flushQueuedBridgeSyncAfterRender();
}

function renderWeeklyOps(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
  renderWeeklyOpsModule({
    els,
    state,
    res,
    weeks,
    safeNum,
    getEffectiveBaseRates,
    fmtInt,
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    clamp,
    computeWeeklyOpsContext,
    ctx: weeklyContext,
    executionSnapshot,
    renderWeeklyExecutionStatus,
  });
}

let executionWeeklyController = null;

function getExecutionWeeklyController(){
  if (executionWeeklyController) return executionWeeklyController;
  executionWeeklyController = createExecutionWeeklyController({
    els,
    getState: () => state,
    safeNum,
    fmtInt,
    clamp,
    renderWeeklyExecutionStatusModule,
    computeWeeklyOpsContextFromStateSelector,
    getEffectiveBaseRatesFromStateSelector,
    computeUniverseAdjustedRates,
    coreComputeCapacityBreakdown,
    compileEffectiveInputs,
    computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
  });
  return executionWeeklyController;
}

function computeLastNLogSums(n){
  return getExecutionWeeklyController().computeLastNLogSums(n);
}

function setTag(el, kind, text){
  return getExecutionWeeklyController().setTag(el, kind, text);
}

function fmtISODate(d){
  return getExecutionWeeklyController().fmtISODate(d);
}

function renderWeeklyExecutionStatus(ctx){
  return getExecutionWeeklyController().renderWeeklyExecutionStatus(ctx);
}

function computeWeeklyOpsContext(res, weeks){
  return getExecutionWeeklyController().computeWeeklyOpsContext(res, weeks);
}

function renderAssumptionDriftE1(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
  return renderAssumptionDriftPanel({
    els,
    state,
    res,
    weeks,
    safeNum,
    computeWeeklyOpsContext,
    ctx: weeklyContext,
    executionSnapshot,
  });
}

let executionRiskController = null;

function getExecutionRiskController(){
  if (executionRiskController) return executionRiskController;
  executionRiskController = createExecutionRiskController({
    els,
    getState: () => state,
    setState: (next) => { state = next; },
    getLastRenderCtx: () => lastRenderCtx,
    setLastAppliedWeeklyAction: (next) => { lastAppliedWeeklyAction = next; },
    safeNum,
    clamp,
    fmtInt,
    setTextPair,
    setText,
    safeCall,
    getEffectiveBaseRates,
    computeWeeklyOpsContext,
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
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
  });
  return executionRiskController;
}

function computeRealityDrift(){
  return getExecutionRiskController().computeRealityDrift();
}

function applyRollingRateToAssumption(kind){
  return getExecutionRiskController().applyRollingRateToAssumption(kind);
}

function applyAllRollingCalibrations(){
  return getExecutionRiskController().applyAllRollingCalibrations();
}

function applyWeeklyLeverScenario(lever, ctx){
  return getExecutionRiskController().applyWeeklyLeverScenario(lever, ctx);
}

function renderRiskFramingE2(){
  return getExecutionRiskController().renderRiskFramingE2();
}

function renderBottleneckAttributionE3(res, weeks){
  return getExecutionRiskController().renderBottleneckAttributionE3(res, weeks);
}

function renderWeeklyOpsInsights(res, weeks, opts = {}){
  return getExecutionRiskController().renderWeeklyOpsInsights(res, weeks, opts);
}

function renderWeeklyOpsFreshness(res, weeks, opts = {}){
  return getExecutionRiskController().renderWeeklyOpsFreshness(res, weeks, opts);
}

function addBullet(listEl, text){
  if (!listEl) return;
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}


function renderConversion(res, weeks){
  return getExecutionRiskController().renderConversion(res, weeks);
}

function renderSensitivitySnapshotE4(){
  return getExecutionRiskController().renderSensitivitySnapshotE4();
}

async function runSensitivitySnapshotE4(){
  return getExecutionRiskController().runSensitivitySnapshotE4();
}

function renderDecisionConfidenceE5(res, weeks, opts = {}){
  return getExecutionRiskController().renderDecisionConfidenceE5(res, weeks, opts);
}

function renderImpactTraceE6(res, weeks, opts = {}){
  return getExecutionRiskController().renderImpactTraceE6(res, weeks, opts);
}

function renderDecisionIntelligencePanel({ res, weeks }){
  return getExecutionRiskController().renderDecisionIntelligencePanel({ res, weeks });
}

let summaryRenderController = null;

function getSummaryRenderController(){
  if (summaryRenderController) return summaryRenderController;
  summaryRenderController = createSummaryRenderController({
    els,
    getState: () => state,
    engine,
    computeRealityDrift,
    computeEvidenceWarnings,
    computeModelGovernance,
    renderStressModule,
    renderValidationModule,
    renderIntelChecksModule,
    renderAssumptionsModule,
    renderGuardrailsModule,
    assumptionsProfileLabel,
    getYourNameFromState: getYourNameFromStateModule,
    fmtInt,
    blockModule,
    kvModule,
    labelTemplateModule,
    labelUndecidedModeModule,
  });
  return summaryRenderController;
}

function renderStress(res){
  return getSummaryRenderController().renderStress(res);
}

function renderValidation(res, weeks){
  return getSummaryRenderController().renderValidation(res, weeks);
}

function renderAssumptions(res, weeks){
  return getSummaryRenderController().renderAssumptions(res, weeks);
}

function renderGuardrails(res){
  return getSummaryRenderController().renderGuardrails(res);
}

function block(title, kvs){
  return getSummaryRenderController().block(title, kvs);
}

function kv(k, v){
  return getSummaryRenderController().kv(k, v);
}

function labelTemplate(v){
  return getSummaryRenderController().labelTemplate(v);
}

function labelUndecidedMode(v){
  return getSummaryRenderController().labelUndecidedMode(v);
}

function getYourName(){
  return getSummaryRenderController().getYourName();
}


// =========================
// Phase C1 — Scenario Stack (registry)
// =========================

let scenarioDecisionController = null;

function getScenarioDecisionController(){
  if (scenarioDecisionController) return scenarioDecisionController;
  scenarioDecisionController = createScenarioDecisionController({
    els,
    getState: () => state,
    scenarioBaselineId: SCENARIO_BASELINE_ID,
    scenarioMax: SCENARIO_MAX,
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
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    compileEffectiveInputs,
    computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
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
    objectiveTemplates: OBJECTIVE_TEMPLATES,
    riskPostures: RISK_POSTURES,
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
  });
  return scenarioDecisionController;
}

function scenarioClone(obj){
  return getScenarioDecisionController().scenarioClone(obj);
}

function scenarioInputsFromState(src){
  return getScenarioDecisionController().scenarioInputsFromState(src);
}

function scenarioOutputsFromState(src){
  return getScenarioDecisionController().scenarioOutputsFromState(src);
}

function ensureScenarioRegistry(){
  return getScenarioDecisionController().ensureScenarioRegistry();
}

function setScenarioWarn(msg){
  return getScenarioDecisionController().setScenarioWarn(msg);
}

function listScenarioRecords(){
  return getScenarioDecisionController().listScenarioRecords();
}

function getUniverseLayerConfigFromSnap(snap){
  return getScenarioDecisionController().getUniverseLayerConfigFromSnap(snap);
}

function getEffectiveBaseRatesFromSnap(snap){
  return getScenarioDecisionController().getEffectiveBaseRatesFromSnap(snap);
}

function computeWeeklyOpsContextFromSnap(snap, res, weeks){
  return getScenarioDecisionController().computeWeeklyOpsContextFromSnap(snap, res, weeks);
}

function targetFinishDateFromSnap(snap, weeks){
  return getScenarioDecisionController().targetFinishDateFromSnap(snap, weeks);
}

function paceFinishDate(total, pacePerDay){
  return getScenarioDecisionController().paceFinishDate(total, pacePerDay);
}

function renderScenarioComparisonC3(){
  return getScenarioDecisionController().renderScenarioComparisonC3();
}

function renderScenarioManagerC1(){
  return getScenarioDecisionController().renderScenarioManagerC1();
}

function hasLegacyScenarioManagerDom(){
  return !!(
    document.getElementById("scenarioSelect") ||
    document.getElementById("activeScenarioLabel")
  );
}

function refreshLegacyScenarioManagerIfMounted(){
  if (!hasLegacyScenarioManagerDom()){
    return;
  }
  safeCall(() => { renderScenarioManagerC1(); });
}

function scenarioBridgeStateView(){
  ensureScenarioRegistry();
  const reg = state?.ui?.scenarios || {};
  const activeId = state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID;
  const selectedId = state?.ui?.scenarioUiSelectedId || activeId;
  const active = reg[activeId] || null;
  const baseline = reg[SCENARIO_BASELINE_ID] || null;
  const records = listScenarioRecords().map((rec) => ({
    id: rec?.id || "",
    name: rec?.name || rec?.id || "",
    createdAt: rec?.createdAt || ""
  }));
  const count = Object.keys(reg).length;
  const summary = buildScenarioWorkspaceSummaryView({
    activeScenario: active,
    activeScenarioId: activeId,
    count,
    max: SCENARIO_MAX,
  });

  return {
    baselineId: SCENARIO_BASELINE_ID,
    max: SCENARIO_MAX,
    count,
    activeScenarioId: activeId,
    selectedScenarioId: selectedId,
    activeLabel: summary.activeLabel,
    warning: summary.warning,
    storageStatus: summary.storageStatus,
    scenarios: records,
    baseline: baseline
      ? {
          id: baseline.id,
          name: baseline.name || baseline.id,
          inputs: scenarioClone(baseline.inputs || {}),
          outputs: scenarioClone(baseline.outputs || {})
        }
      : null,
    active: active
      ? {
          id: active.id,
          name: active.name || active.id,
          inputs: scenarioClone(active.inputs || {}),
          outputs: scenarioClone(active.outputs || {})
        }
      : null
  };
}

function scenarioBridgeSelect(id){
  ensureScenarioRegistry();
  const nextId = String(id || "").trim();
  const reg = state?.ui?.scenarios || {};
  if (!nextId || !reg[nextId]) {
    return { ok: false, code: "not_found", view: scenarioBridgeStateView() };
  }

  state.ui.scenarioUiSelectedId = nextId;
  persist();
  notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_selected" });
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeSaveNew(name){
  ensureScenarioRegistry();
  const reg = state?.ui?.scenarios || {};
  const count = Object.keys(reg).length;
  if (count >= SCENARIO_MAX){
    setScenarioWarn(`Max scenarios reached (${SCENARIO_MAX}). Delete one to save a new scenario.`);
    refreshLegacyScenarioManagerIfMounted();
    return { ok: false, code: "max_reached", view: scenarioBridgeStateView() };
  }

  const id = "scn_" + uid() + Date.now().toString(16);
  const nm = String(name || "").trim() || `Scenario ${count}`;
  reg[id] = {
    id,
    name: nm,
    inputs: scenarioClone(scenarioInputsFromState(state) || {}),
    outputs: scenarioClone(scenarioOutputsFromState(state) || {}),
    createdAt: new Date().toISOString()
  };
  state.ui.scenarioUiSelectedId = id;
  persist();
  notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_saved" });
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeCloneBaseline(name){
  ensureScenarioRegistry();
  const reg = state?.ui?.scenarios || {};
  const count = Object.keys(reg).length;
  if (count >= SCENARIO_MAX){
    setScenarioWarn(`Max scenarios reached (${SCENARIO_MAX}). Delete one to clone baseline.`);
    refreshLegacyScenarioManagerIfMounted();
    return { ok: false, code: "max_reached", view: scenarioBridgeStateView() };
  }

  const base = reg[SCENARIO_BASELINE_ID];
  const id = "scn_" + uid() + Date.now().toString(16);
  const nm = String(name || "").trim() || "Baseline clone";
  reg[id] = {
    id,
    name: nm,
    inputs: scenarioClone(base?.inputs || {}),
    outputs: scenarioClone(base?.outputs || {}),
    createdAt: new Date().toISOString()
  };
  state.ui.scenarioUiSelectedId = id;
  persist();
  notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_cloned" });
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeLoad(id){
  ensureScenarioRegistry();
  const targetId = String(id || "").trim();
  const reg = state?.ui?.scenarios || {};
  const rec = reg[targetId];
  if (!rec) {
    return { ok: false, code: "not_found", view: scenarioBridgeStateView() };
  }

  const uiKeep = state.ui || {};
  const next = scenarioClone(rec.inputs || {});
  next.ui = uiKeep;
  state = next;

  ensureScenarioRegistry();
  state.ui.activeScenarioId = targetId;
  state.ui.scenarioUiSelectedId = targetId;

  markMcStale();
  applyStateToUI();
  persist();
  render();
  notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_loaded" });
  refreshLegacyScenarioManagerIfMounted();
  safeCall(() => { renderDecisionSessionD1(); });
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeDeleteSelected(){
  ensureScenarioRegistry();
  const selectedId = String(state?.ui?.scenarioUiSelectedId || "").trim();
  if (!selectedId || selectedId === SCENARIO_BASELINE_ID){
    return { ok: false, code: "cannot_delete", view: scenarioBridgeStateView() };
  }

  delete state.ui.scenarios[selectedId];
  state.ui.scenarioUiSelectedId = SCENARIO_BASELINE_ID;
  persist();
  notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_deleted" });
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeEnsureIntelWorkflow(targetState){
  const intel = ensureIntelCollections(targetState);
  if (!intel?.workflow || typeof intel.workflow !== "object"){
    return {
      scenarioLocked: false,
      lockReason: "",
      lockedAt: null,
      lockedBy: "",
      governanceBaselineAt: null,
      requireCriticalNote: true,
      requireCriticalEvidence: true
    };
  }
  return intel.workflow;
}

function scenarioBridgeEnsureIntelToggles(targetState){
  const intel = ensureIntelCollections(targetState);
  return {
    simToggles: (intel && typeof intel.simToggles === "object") ? intel.simToggles : {
      mcDistribution: "triangular",
      correlatedShocks: false,
      correlationMatrixId: null,
      shockScenariosEnabled: true
    },
    expertToggles: (intel && typeof intel.expertToggles === "object") ? intel.expertToggles : {
      capacityDecayEnabled: false,
      decayModel: {
        type: "linear",
        weeklyDecayPct: 0.03,
        floorPctOfBaseline: 0.70
      }
    }
  };
}

function scenarioBridgeUpdateIntelWorkflow(patch){
  const nextPatch = (patch && typeof patch === "object") ? patch : {};
  const hasPatch = [
    "scenarioLocked",
    "lockReason",
    "requireCriticalNote",
    "requireCriticalEvidence"
  ].some((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
  if (!hasPatch){
    return { ok: false, code: "empty_patch", view: scenarioBridgeStateView() };
  }

  const workflow = scenarioBridgeEnsureIntelWorkflow(state);
  if (Object.prototype.hasOwnProperty.call(nextPatch, "scenarioLocked")){
    const locked = !!nextPatch.scenarioLocked;
    workflow.scenarioLocked = locked;
    workflow.lockedAt = locked ? new Date().toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, "lockReason")){
    workflow.lockReason = String(nextPatch.lockReason || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, "requireCriticalNote")){
    workflow.requireCriticalNote = !!nextPatch.requireCriticalNote;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, "requireCriticalEvidence")){
    workflow.requireCriticalEvidence = !!nextPatch.requireCriticalEvidence;
  }

  commitUIUpdate({ allowScenarioLockBypass: true });
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeUpdateIntelSimToggles(patch){
  const nextPatch = (patch && typeof patch === "object") ? patch : {};
  const hasPatch = [
    "mcDistribution",
    "correlatedShocks",
    "correlationMatrixId",
    "shockScenariosEnabled"
  ].some((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
  if (!hasPatch){
    return { ok: false, code: "empty_patch", view: scenarioBridgeStateView() };
  }

  const { simToggles } = scenarioBridgeEnsureIntelToggles(state);
  if (Object.prototype.hasOwnProperty.call(nextPatch, "mcDistribution")){
    const raw = String(nextPatch.mcDistribution || "").trim().toLowerCase();
    const allowed = raw === "triangular" || raw === "uniform" || raw === "normal";
    simToggles.mcDistribution = allowed ? raw : "triangular";
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, "correlatedShocks")){
    simToggles.correlatedShocks = !!nextPatch.correlatedShocks;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, "correlationMatrixId")){
    const raw = String(nextPatch.correlationMatrixId || "").trim();
    simToggles.correlationMatrixId = raw && raw.toLowerCase() !== "none" ? raw : null;
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, "shockScenariosEnabled")){
    simToggles.shockScenariosEnabled = !!nextPatch.shockScenariosEnabled;
  }

  markMcStale();
  commitUIUpdate({ allowScenarioLockBypass: true });
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeUpdateIntelExpertToggles(patch){
  const nextPatch = (patch && typeof patch === "object") ? patch : {};
  const hasPatch = [
    "capacityDecayEnabled",
    "decayModel"
  ].some((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
  if (!hasPatch){
    return { ok: false, code: "empty_patch", view: scenarioBridgeStateView() };
  }

  const { expertToggles } = scenarioBridgeEnsureIntelToggles(state);
  if (Object.prototype.hasOwnProperty.call(nextPatch, "capacityDecayEnabled")){
    expertToggles.capacityDecayEnabled = !!nextPatch.capacityDecayEnabled;
  }

  if (nextPatch.decayModel && typeof nextPatch.decayModel === "object"){
    const decay = expertToggles.decayModel || {};
    if (Object.prototype.hasOwnProperty.call(nextPatch.decayModel, "type")){
      const rawType = String(nextPatch.decayModel.type || "").trim().toLowerCase();
      decay.type = rawType === "linear" ? "linear" : "linear";
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch.decayModel, "weeklyDecayPct")){
      const n = Number(nextPatch.decayModel.weeklyDecayPct);
      if (Number.isFinite(n)) {
        decay.weeklyDecayPct = Math.min(1, Math.max(0, n));
      }
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch.decayModel, "floorPctOfBaseline")){
      const n = Number(nextPatch.decayModel.floorPctOfBaseline);
      if (Number.isFinite(n)) {
        decay.floorPctOfBaseline = Math.min(1, Math.max(0, n));
      }
    }
    expertToggles.decayModel = decay;
  }

  markMcStale();
  commitUIUpdate({ allowScenarioLockBypass: true });
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeSetPendingCriticalNote(note){
  if (!state.ui || typeof state.ui !== "object"){
    state.ui = {};
  }
  state.ui.pendingCriticalNote = String(note || "");
  commitUIUpdate({ allowScenarioLockBypass: true });
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeSaveBenchmark(payload){
  const result = upsertBenchmarkEntry(state, payload || {});
  if (!result?.ok){
    return { ok: false, code: "save_failed", error: String(result?.error || "Benchmark save failed."), view: scenarioBridgeStateView() };
  }
  commitUIUpdate({ allowScenarioLockBypass: true });
  return { ok: true, mode: result.mode || "updated", row: result.row || null, view: scenarioBridgeStateView() };
}

function scenarioBridgeLoadDefaultBenchmarks(scopeInput){
  const result = loadDefaultBenchmarksForRaceType(state, scopeInput || "default");
  if (!result?.ok){
    return { ok: false, code: "load_defaults_failed", error: String(result?.error || "Failed to load defaults."), view: scenarioBridgeStateView() };
  }
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    raceType: result.raceType || "all",
    benchmarkKey: result.benchmarkKey || "default",
    created: result.created || 0,
    updated: result.updated || 0,
    view: scenarioBridgeStateView(),
  };
}

function scenarioBridgeRemoveBenchmark(benchmarkId){
  const result = removeBenchmarkEntry(state, benchmarkId);
  if (!result?.ok){
    return { ok: false, code: "remove_failed", error: String(result?.error || "Failed to remove benchmark."), view: scenarioBridgeStateView() };
  }
  commitUIUpdate({ allowScenarioLockBypass: true });
  return { ok: true, view: scenarioBridgeStateView() };
}

function scenarioBridgeAttachEvidence(payload){
  const result = attachEvidenceRecord(state, payload || {});
  if (!result?.ok){
    return {
      ok: false,
      code: "attach_evidence_failed",
      error: String(result?.error || "Evidence attach failed."),
      view: scenarioBridgeStateView()
    };
  }
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    evidence: result.evidence || null,
    resolvedAuditId: result.resolvedAuditId || null,
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeGenerateIntelBrief(kind){
  const briefKind = String(kind || "calibrationSources").trim() || "calibrationSources";
  let result = null;
  if (briefKind === "scenarioSummary"){
    result = generateScenarioSummaryBrief(state);
  } else if (briefKind === "scenarioDiff"){
    result = generateScenarioDiffBrief(state, { baselineId: "baseline" });
  } else if (briefKind === "driftExplanation"){
    result = generateDriftExplanationBrief(state, { drift: computeRealityDrift() });
  } else if (briefKind === "sensitivityInterpretation"){
    result = generateSensitivityInterpretationBrief(state);
  } else {
    result = generateCalibrationSourceBrief(state);
  }
  if (!result?.ok){
    return {
      ok: false,
      code: "generate_brief_failed",
      error: String(result?.error || "Failed to generate brief."),
      kind: briefKind,
      view: scenarioBridgeStateView()
    };
  }
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    kind: briefKind,
    brief: result.brief || null,
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeAddDefaultCorrelation(){
  const result = addDefaultCorrelationModel(state);
  if (!result?.ok){
    return {
      ok: false,
      code: "add_correlation_failed",
      error: String(result?.error || "Failed to add default correlation model."),
      view: scenarioBridgeStateView()
    };
  }
  markMcStale();
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    mode: result.mode || "updated",
    row: result.row || null,
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeImportCorrelationModels(jsonText){
  const result = importCorrelationModelsJson(state, jsonText || "");
  if (!result?.ok){
    return {
      ok: false,
      code: "import_correlation_failed",
      error: String(result?.error || "Failed to import correlation models."),
      view: scenarioBridgeStateView()
    };
  }
  markMcStale();
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    created: Number(result.created || 0),
    updated: Number(result.updated || 0),
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeAddDefaultShock(){
  const result = addDefaultShockScenario(state);
  if (!result?.ok){
    return {
      ok: false,
      code: "add_shock_failed",
      error: String(result?.error || "Failed to add default shock scenario."),
      view: scenarioBridgeStateView()
    };
  }
  markMcStale();
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    mode: result.mode || "updated",
    row: result.row || null,
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeImportShockScenarios(jsonText){
  const result = importShockScenariosJson(state, jsonText || "");
  if (!result?.ok){
    return {
      ok: false,
      code: "import_shock_failed",
      error: String(result?.error || "Failed to import shock scenarios."),
      view: scenarioBridgeStateView()
    };
  }
  markMcStale();
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    created: Number(result.created || 0),
    updated: Number(result.updated || 0),
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeCaptureObservedMetrics(){
  const drift = computeRealityDrift();
  const result = captureObservedMetricsFromDrift(state, drift);
  if (!result?.ok){
    return {
      ok: false,
      code: "capture_observed_failed",
      error: String(result?.error || "Observed metrics capture failed."),
      view: scenarioBridgeStateView()
    };
  }
  commitUIUpdate();
  return {
    ok: true,
    created: Number(result.created || 0),
    updated: Number(result.updated || 0),
    total: Number(result.total || 0),
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeGenerateDriftRecommendations(){
  const drift = computeRealityDrift();
  const refresh = captureObservedAndRefreshDriftRecommendations(state, { drift });
  const metricsResult = refresh.metricsResult;
  const result = refresh.recommendationResult;
  if (!result?.ok){
    return {
      ok: false,
      code: "generate_recommendations_failed",
      error: String(result?.error || "Recommendation generation failed."),
      metricsOk: !!metricsResult?.ok,
      metricsError: metricsResult?.ok ? "" : String(metricsResult?.error || ""),
      view: scenarioBridgeStateView()
    };
  }
  commitUIUpdate();
  return {
    ok: true,
    autoTotal: Number(result.autoTotal || 0),
    created: Number(result.created || 0),
    updated: Number(result.updated || 0),
    cleared: Number(result.cleared || 0),
    metricsOk: !!metricsResult?.ok,
    metricsCreated: Number(metricsResult?.created || 0),
    metricsUpdated: Number(metricsResult?.updated || 0),
    metricsError: metricsResult?.ok ? "" : String(metricsResult?.error || ""),
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeParseWhatIf(requestText){
  const result = createWhatIfIntelRequest(state, String(requestText || ""), { source: "user.whatIf.v1", maxEntries: 120 });
  if (!result?.ok){
    return {
      ok: false,
      code: "parse_what_if_failed",
      error: String(result?.error || "Failed to parse what-if request."),
      view: scenarioBridgeStateView()
    };
  }
  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    parsedTargets: Number(result.parsedTargets || 0),
    unresolved: Number(result.unresolved || 0),
    row: result.row || null,
    view: scenarioBridgeStateView()
  };
}

function scenarioBridgeApplyTopRecommendation(){
  const result = applyTopDriftRecommendation(state);
  if (!result?.ok){
    return {
      ok: false,
      code: String(result?.code || "apply_recommendation_failed"),
      error: String(result?.error || "Failed to apply recommendation patch."),
      view: scenarioBridgeStateView()
    };
  }

  markMcStale();
  commitUIUpdate();

  commitUIUpdate({ allowScenarioLockBypass: true });
  return {
    ok: true,
    recommendationId: String(result.recommendationId || ""),
    recommendationTitle: String(result.recommendationTitle || ""),
    changesCount: Number(result.changesCount || 0),
    noop: !!result.noop,
    needsGovernance: !!result.needsGovernance,
    view: scenarioBridgeStateView()
  };
}

function installScenarioBridge(){
  window[SCENARIO_BRIDGE_KEY] = {
    getView: () => scenarioBridgeStateView(),
    getLiveInputs: () => scenarioClone(scenarioInputsFromState(state) || {}),
    getLiveOutputs: () => scenarioClone(scenarioOutputsFromState(state) || {}),
    selectScenario: (id) => scenarioBridgeSelect(id),
    saveNew: (name) => scenarioBridgeSaveNew(name),
    cloneBaseline: (name) => scenarioBridgeCloneBaseline(name),
    loadScenario: (id) => scenarioBridgeLoad(id),
    loadSelected: () => scenarioBridgeLoad(state?.ui?.scenarioUiSelectedId),
    returnBaseline: () => scenarioBridgeLoad(SCENARIO_BASELINE_ID),
    deleteSelected: () => scenarioBridgeDeleteSelected(),
    updateIntelWorkflow: (patch) => scenarioBridgeUpdateIntelWorkflow(patch),
    updateIntelSimToggles: (patch) => scenarioBridgeUpdateIntelSimToggles(patch),
    updateIntelExpertToggles: (patch) => scenarioBridgeUpdateIntelExpertToggles(patch),
    setPendingCriticalNote: (note) => scenarioBridgeSetPendingCriticalNote(note),
    saveBenchmark: (payload) => scenarioBridgeSaveBenchmark(payload),
    loadDefaultBenchmarks: (scopeInput) => scenarioBridgeLoadDefaultBenchmarks(scopeInput),
    removeBenchmark: (benchmarkId) => scenarioBridgeRemoveBenchmark(benchmarkId),
    attachEvidence: (payload) => scenarioBridgeAttachEvidence(payload),
    generateIntelBrief: (kind) => scenarioBridgeGenerateIntelBrief(kind),
    addDefaultCorrelationModel: () => scenarioBridgeAddDefaultCorrelation(),
    importCorrelationModels: (jsonText) => scenarioBridgeImportCorrelationModels(jsonText),
    addDefaultShockScenario: () => scenarioBridgeAddDefaultShock(),
    importShockScenarios: (jsonText) => scenarioBridgeImportShockScenarios(jsonText),
    captureObservedMetrics: () => scenarioBridgeCaptureObservedMetrics(),
    generateDriftRecommendations: () => scenarioBridgeGenerateDriftRecommendations(),
    parseWhatIf: (requestText) => scenarioBridgeParseWhatIf(requestText),
    applyTopRecommendation: () => scenarioBridgeApplyTopRecommendation()
  };
}

function districtBridgeFmtPct(value, digits = 1){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatPercentFromPct(n, digits, "—");
}

function districtBridgeFmtInt(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatWholeNumberByMode(n, { mode: "round", fallback: "—" });
}

function districtBridgeSupportTotalFromState(currentState){
  return computeDistrictSupportTotalPctFromState(currentState);
}

function districtBridgeFallbackTurnout(currentState){
  return buildDistrictTurnoutFallbackView(currentState, {
    formatPercent: (value, digits = 1) => districtBridgeFmtPct(value, digits),
    formatInt: (value) => districtBridgeFmtInt(value),
  });
}

function districtBridgeFmtTimestamp(ts){
  return buildDistrictLastFetchText(ts);
}

function districtBridgeBuildContextHint(censusState){
  return buildDistrictCensusContextHint(censusState);
}

function districtBridgeBuildSelectionSetStatus(censusState){
  return buildDistrictSelectionSetStatus(censusState, {
    formatInt: (value) => districtBridgeFmtInt(value),
  });
}

function districtBridgeBuildGeoStatsText(censusState){
  return buildDistrictGeoStatsText(censusState, {
    formatInt: (value) => districtBridgeFmtInt(value),
  });
}

function districtBridgeBuildSelectionSummary(censusState){
  return buildDistrictSelectionSummaryText(censusState);
}

function districtBridgeBuildRaceFootprintStatus(currentState){
  return buildDistrictRaceFootprintStatus(currentState, {
    formatInt: (value) => districtBridgeFmtInt(value),
  });
}

function districtBridgeBuildAssumptionProvenanceStatus(currentState){
  return buildDistrictAssumptionProvenanceStatus(currentState);
}

function districtBridgeBuildFootprintCapacityStatus(currentState){
  return buildDistrictFootprintCapacityStatus(currentState, {
    formatInt: (value) => districtBridgeFmtInt(value),
  });
}

function districtBridgeBuildApplyAdjustmentsStatus(censusState){
  return buildDistrictApplyAdjustmentsStatus(censusState);
}

function districtBridgeBuildSelectOptions(values, { selected = "", placeholder = "" } = {}){
  const rows = Array.isArray(values) ? values : [];
  const seen = new Set();
  const out = [];
  const selectedValue = String(selected || "").trim();

  if (placeholder) {
    out.push({ value: "", label: String(placeholder).trim() || "Select" });
    seen.add("");
  }

  for (const row of rows){
    const value = String(row?.value || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({
      value,
      label: String(row?.label || value).trim() || value,
    });
  }

  if (selectedValue && !seen.has(selectedValue)) {
    out.push({ value: selectedValue, label: selectedValue });
  }

  return out;
}

function districtBridgeBuildCensusConfigOptions(censusState){
  const census = censusState && typeof censusState === "object" ? censusState : {};
  const geoRowsRaw = Array.isArray(census.geoOptions) ? census.geoOptions : [];
  const geoRows = geoRowsRaw
    .map((row) => {
      const geoid = String(row?.geoid || "").trim();
      return {
        geoid,
        label: String(row?.label || row?.name || geoid).trim() || geoid,
        state: String(row?.state || "").trim(),
        county: String(row?.county || "").trim(),
        place: String(row?.place || "").trim(),
        tract: String(row?.tract || "").trim(),
      };
    })
    .filter((row) => !!row.geoid);

  const selectedGeoids = new Set(
    (Array.isArray(census.selectedGeoids) ? census.selectedGeoids : [])
      .map((id) => String(id || "").trim())
      .filter((id) => !!id),
  );

  const bridgeStateOptions = Array.isArray(census.bridgeStateOptions) ? census.bridgeStateOptions : [];
  const bridgeCountyOptions = Array.isArray(census.bridgeCountyOptions) ? census.bridgeCountyOptions : [];
  const bridgePlaceOptions = Array.isArray(census.bridgePlaceOptions) ? census.bridgePlaceOptions : [];
  const bridgeTractFilterOptions = Array.isArray(census.bridgeTractFilterOptions) ? census.bridgeTractFilterOptions : [];
  const bridgeSelectionSetOptions = Array.isArray(census.bridgeSelectionSetOptions) ? census.bridgeSelectionSetOptions : [];
  const bridgeGeoSelectOptions = Array.isArray(census.bridgeGeoSelectOptions) ? census.bridgeGeoSelectOptions : [];

  const stateOptions = districtBridgeBuildSelectOptions(
    bridgeStateOptions.length
      ? bridgeStateOptions
      : geoRows.map((row) => ({
        value: row.state,
        label: row.state,
      })),
    { selected: census.stateFips, placeholder: "Select state" },
  );
  const countyOptions = districtBridgeBuildSelectOptions(
    bridgeCountyOptions.length
      ? bridgeCountyOptions
      : geoRows
        .filter((row) => !census.stateFips || row.state === String(census.stateFips || "").trim())
        .map((row) => ({ value: row.county, label: row.county })),
    { selected: census.countyFips, placeholder: "Select county" },
  );
  const placeOptions = districtBridgeBuildSelectOptions(
    bridgePlaceOptions.length
      ? bridgePlaceOptions
      : geoRows
        .filter((row) => !census.stateFips || row.state === String(census.stateFips || "").trim())
        .map((row) => ({ value: row.place, label: row.place })),
    { selected: census.placeFips, placeholder: "Select place" },
  );
  const tractFilterOptions = districtBridgeBuildSelectOptions(
    bridgeTractFilterOptions.length
      ? bridgeTractFilterOptions
      : geoRows.map((row) => ({ value: row.tract, label: row.tract })),
    { selected: census.tractFilter, placeholder: "All tracts" },
  );
  const selectionSetOptions = districtBridgeBuildSelectOptions(
    bridgeSelectionSetOptions.length
      ? bridgeSelectionSetOptions
      : (Array.isArray(census.selectionSets) ? census.selectionSets : []).map((row, idx) => ({
        value: String(idx),
        label: `${String(row?.name || "").trim()} · ${String(row?.resolution || "").trim()} · ${Array.isArray(row?.geoids) ? row.geoids.length : 0} GEO`,
      })),
    { selected: census.selectedSelectionSetKey, placeholder: "Saved sets" },
  );

  const geoSelectOptions = (bridgeGeoSelectOptions.length
    ? bridgeGeoSelectOptions.map((row) => ({
      value: String(row?.value || "").trim(),
      label: String(row?.label || row?.value || "").trim(),
      selected: !!row?.selected,
    }))
    : geoRows.map((row) => ({
      value: row.geoid,
      label: row.label,
      selected: selectedGeoids.has(row.geoid),
    })))
    .filter((row) => !!row.value);

  for (const geoid of selectedGeoids) {
    if (!geoSelectOptions.some((row) => row.value === geoid)) {
      geoSelectOptions.push({ value: geoid, label: geoid, selected: true });
    }
  }

  return {
    stateOptions,
    countyOptions,
    placeOptions,
    tractFilterOptions,
    selectionSetOptions,
    geoSelectOptions,
  };
}

function districtBridgeBuildCensusDisabledMap(currentState, censusState){
  const census = censusState && typeof censusState === "object" ? censusState : {};
  const controlsLocked = isScenarioLockedForEdits(currentState);
  const resolution = String(census?.resolution || "").trim();
  const stateFips = String(census?.stateFips || "").trim();
  const countyFips = String(census?.countyFips || "").trim();
  const requiresCounty = resolution === "tract" || resolution === "block_group";
  const contextReadyForGeo = !!stateFips && (!requiresCounty || !!countyFips);
  const geoOptionsCount = Array.isArray(census?.geoOptions) ? census.geoOptions.length : 0;
  const hasGeoOptions = geoOptionsCount > 0;
  const selectedGeoCount = Array.isArray(census?.selectedGeoids) ? census.selectedGeoids.length : 0;
  const loadedRowCount = Number.isFinite(Number(census?.loadedRowCount))
    ? Math.max(0, roundWholeNumberByMode(Number(census.loadedRowCount), { mode: "floor", fallback: 0 }) || 0)
    : 0;
  const selectedSetKey = String(census?.selectedSelectionSetKey || "").trim();
  const draftName = String(census?.selectionSetDraftName || "").trim();
  const hasRaceFootprint = Array.isArray(currentState?.raceFootprint?.geoids)
    ? currentState.raceFootprint.geoids.length > 0
    : false;

  const map = {
    v3CensusCountyFips: controlsLocked || !stateFips || !requiresCounty,
    v3CensusPlaceFips: controlsLocked || !stateFips,
    v3CensusGeoSearch: controlsLocked || !hasGeoOptions,
    v3CensusTractFilter: controlsLocked || resolution !== "block_group" || !hasGeoOptions,
    v3BtnCensusLoadGeo: controlsLocked || !!census?.loadingGeo || !contextReadyForGeo,
    v3BtnCensusFetchRows: controlsLocked || !!census?.loadingRows || !contextReadyForGeo,
    v3BtnCensusSelectAll: controlsLocked || !hasGeoOptions,
    v3BtnCensusClearSelection: controlsLocked || !selectedGeoCount,
    v3BtnCensusApplyGeoPaste: controlsLocked || !hasGeoOptions,
    v3BtnCensusSetRaceFootprint: controlsLocked || !selectedGeoCount || !loadedRowCount,
    v3BtnCensusClearRaceFootprint: controlsLocked || !hasRaceFootprint,
    v3BtnCensusSaveSelectionSet: controlsLocked || !selectedGeoCount || !draftName,
    v3BtnCensusLoadSelectionSet: controlsLocked || !selectedSetKey || !hasGeoOptions,
    v3BtnCensusDeleteSelectionSet: controlsLocked || !selectedSetKey,
    v3BtnCensusExportAggregateCsv: controlsLocked || !loadedRowCount,
    v3BtnCensusExportAggregateJson: controlsLocked || !loadedRowCount,
    v3BtnCensusDownloadElectionCsvTemplate: controlsLocked || false,
    v3BtnCensusDownloadElectionCsvWideTemplate: controlsLocked || false,
    v3CensusApplyAdjustmentsToggle: controlsLocked || false,
    v3CensusMapQaVtdToggle: null,
    v3CensusMapQaVtdZip: null,
    v3BtnCensusMapQaVtdZipClear: null,
    v3BtnCensusLoadMap: null,
    v3BtnCensusClearMap: null,
    v3BtnCensusElectionCsvDryRun: controlsLocked ? true : null,
    v3BtnCensusElectionCsvClear: controlsLocked ? true : null,
    v3CensusElectionCsvFile: controlsLocked || false,
    v3CensusElectionCsvPrecinctFilter: controlsLocked || false,
    v3CensusApiKey: controlsLocked || false,
    v3CensusAcsYear: controlsLocked || false,
    v3CensusResolution: controlsLocked || false,
    v3CensusStateFips: controlsLocked || false,
    v3CensusMetricSet: controlsLocked || false,
    v3CensusGeoPaste: controlsLocked || false,
    v3CensusSelectionSetName: controlsLocked || false,
    v3CensusSelectionSetSelect: controlsLocked || false,
    v3CensusGeoSelect: controlsLocked || false,
  };
  const out = {};
  for (const [id, value] of Object.entries(map)){
    if (typeof value === "boolean"){
      out[id] = value;
    }
  }
  return out;
}

function districtBridgeNormalizeRows(rows, expectedCols = 0){
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const row of list){
    const cells = Array.isArray(row) ? row : [];
    const cols = cells.map((cell) => String(cell == null ? "" : cell).trim());
    if (!cols.some(Boolean)) continue;
    if (expectedCols > 0){
      while (cols.length < expectedCols) cols.push("");
      out.push(cols.slice(0, expectedCols));
    } else {
      out.push(cols);
    }
  }
  return out;
}

function districtBridgeStateView(){
  const currentState = state || {};
  const res = lastRenderCtx?.res || null;
  const censusState = currentState?.census && typeof currentState.census === "object"
    ? currentState.census
    : {};
  const universeSize = safeNum(currentState?.universeSize);
  const supportTotalFromState = districtBridgeSupportTotalFromState(currentState);
  const turnoutFallback = districtBridgeFallbackTurnout(currentState);
  const targetingState = normalizeTargetingState(currentState?.targeting);

  const supportTotalPct = safeNum(res?.validation?.supportTotalPct);
  const turnoutExpectedPct = safeNum(res?.turnout?.expectedPct);
  const turnoutBestPct = safeNum(res?.turnout?.bestPct);
  const turnoutWorstPct = safeNum(res?.turnout?.worstPct);
  const votesPer1pct = safeNum(res?.turnout?.votesPer1pct);
  const projectedVotes = safeNum(res?.expected?.yourVotes);
  const persuasionNeed = safeNum(res?.expected?.persuasionNeed);

  const summary = {
    universeText: universeSize == null ? "—" : districtBridgeFmtInt(universeSize),
    baselineSupportText: supportTotalPct == null
      ? (supportTotalFromState == null ? "—" : districtBridgeFmtPct(supportTotalFromState, 1))
      : districtBridgeFmtPct(supportTotalPct, 1),
    turnoutExpectedText: turnoutExpectedPct == null
      ? turnoutFallback.expectedText
      : districtBridgeFmtPct(turnoutExpectedPct, 1),
    turnoutBandText: (turnoutBestPct == null || turnoutWorstPct == null)
      ? turnoutFallback.bandText
      : `${formatPercentFromPct(turnoutBestPct, 1, "0.0%")} / ${formatPercentFromPct(turnoutWorstPct, 1, "0.0%")}`,
    votesPer1pctText: votesPer1pct == null
      ? turnoutFallback.votesPer1pctText
      : districtBridgeFmtInt(votesPer1pct),
    projectedVotesText: projectedVotes == null ? "—" : districtBridgeFmtInt(projectedVotes),
    persuasionNeedText: persuasionNeed == null ? "—" : districtBridgeFmtInt(persuasionNeed),
  };
  const ballotCandidates = Array.isArray(currentState?.candidates) ? currentState.candidates : [];
  const ballotUserSplit = currentState?.userSplit && typeof currentState.userSplit === "object"
    ? currentState.userSplit
    : {};
  const ballotUndecidedMode = String(currentState?.undecidedMode || "proportional").trim() || "proportional";
  const ballotSupportTotalText = supportTotalPct == null
    ? (supportTotalFromState == null ? "—" : districtBridgeFmtPct(supportTotalFromState, 1))
    : districtBridgeFmtPct(supportTotalPct, 1);
  const ballotWarningText = !res?.validation?.candidateTableOk
    ? String(res?.validation?.candidateTableMsg || "").trim()
    : (ballotUndecidedMode === "user_defined" && !res?.validation?.userSplitOk
      ? String(res?.validation?.userSplitMsg || "").trim()
      : "");
  const historyRecords = normalizeCandidateHistoryRecords(currentState?.candidateHistory);
  const historyValidation = res?.validation?.candidateHistory && typeof res.validation.candidateHistory === "object"
    ? res.validation.candidateHistory
    : {};
  const historyImpact = res?.expected?.candidateHistoryImpact && typeof res.expected.candidateHistoryImpact === "object"
    ? res.expected.candidateHistoryImpact
    : {};
  const historyRecordCount = Number(historyValidation.recordCount ?? historyImpact.recordCount ?? historyRecords.length ?? 0);
  const historyMatched = Number(historyValidation.matchedRecordCount ?? historyImpact.matchedRecordCount ?? 0);
  const historyCoverageBand = String(historyValidation.coverageBand || historyImpact.coverageBand || "none");
  const historyConfidenceBand = String(historyValidation.confidenceBand || historyImpact.confidenceBand || "missing");
  const historyVoteDelta = Number(historyImpact.yourVotesDelta || 0);
  const historySummaryText = historyRecordCount <= 0
    ? "No candidate history rows. Add candidate-cycle records to anchor ballot baseline realism."
    : `History rows: ${districtBridgeFmtInt(historyRecordCount)} · matched: ${districtBridgeFmtInt(historyMatched)} · coverage: ${historyCoverageBand} · confidence: ${historyConfidenceBand}${historyVoteDelta ? ` · vote delta ${historyVoteDelta > 0 ? "+" : ""}${districtBridgeFmtInt(historyVoteDelta)}` : ""}`;
  const historyWarningText = historyRecordCount > 0 && historyConfidenceBand === "low"
    ? "Candidate history is incomplete; baseline confidence is downgraded until required fields are filled."
    : "";
  const ballot = {
    yourCandidateId: String(currentState?.yourCandidateId || "").trim(),
    undecidedPct: safeNum(currentState?.undecidedPct),
    undecidedMode: ballotUndecidedMode,
    supportTotalText: ballotSupportTotalText,
    warningText: ballotWarningText,
    candidates: ballotCandidates.map((cand) => ({
      id: String(cand?.id || "").trim(),
      name: String(cand?.name ?? "").trim(),
      supportPct: safeNum(cand?.supportPct),
      canRemove: ballotCandidates.length > 2,
    })).filter((cand) => cand.id),
    userSplitVisible: ballotUndecidedMode === "user_defined",
    userSplitRows: ballotCandidates.map((cand) => ({
      id: String(cand?.id || "").trim(),
      name: String(cand?.name ?? "").trim(),
      value: safeNum(ballotUserSplit?.[cand?.id]),
    })).filter((cand) => cand.id),
    candidateHistorySummaryText: historySummaryText,
    candidateHistoryWarningText: historyWarningText,
    candidateHistoryOptions: {
      electionType: CANDIDATE_HISTORY_ELECTION_TYPE_OPTIONS.map((row) => ({
        value: String(row?.value || "").trim(),
        label: String(row?.label || row?.value || "").trim(),
      })).filter((row) => row.value),
      incumbencyStatus: CANDIDATE_HISTORY_INCUMBENCY_OPTIONS.map((row) => ({
        value: String(row?.value || "").trim(),
        label: String(row?.label || row?.value || "").trim(),
      })).filter((row) => row.value),
    },
    candidateHistoryRecords: historyRecords.map((record) => ({
      recordId: String(record?.recordId || "").trim(),
      office: String(record?.office || "").trim(),
      cycleYear: safeNum(record?.cycleYear),
      electionType: String(record?.electionType || "").trim(),
      candidateName: String(record?.candidateName || "").trim(),
      party: String(record?.party || "").trim(),
      incumbencyStatus: String(record?.incumbencyStatus || "").trim(),
      voteShare: safeNum(record?.voteShare),
      margin: safeNum(record?.margin),
      turnoutContext: safeNum(record?.turnoutContext),
      repeatCandidate: !!record?.repeatCandidate,
      overUnderPerformancePct: safeNum(record?.overUnderPerformancePct),
    })),
  };

  const targetingRowsRaw = Array.isArray(targetingState?.lastRows) ? targetingState.lastRows : [];
  const targetingRows = targetingRowsRaw.map((row, idx) => {
    const rankValue = safeNum(row?.rank);
    const scoreValue = safeNum(row?.score);
    const vphValue = safeNum(row?.votesPerOrganizerHour);
    const reason = String(row?.reasonText || (Array.isArray(row?.reasons) ? row.reasons[0] : "") || "").trim();
    const flags = String(row?.flagText || (Array.isArray(row?.flags) ? row.flags.join("; ") : "") || "").trim();
    const geoLabel = String(row?.label || row?.geoid || "").trim();
    return {
      rankText: rankValue == null
        ? String(idx + 1)
        : String(Math.max(1, roundWholeNumberByMode(rankValue, { mode: "floor", fallback: 1 }) || 1)),
      geoText: geoLabel || "—",
      scoreText: scoreValue == null ? "—" : formatFixedNumber(scoreValue, 3, "—"),
      votesPerHourText: vphValue == null ? "—" : formatFixedNumber(vphValue, 2, "—"),
      reasonText: reason || "—",
      flagsText: flags || "—",
    };
  });
  const targetingMeta = (targetingState?.lastMeta && typeof targetingState.lastMeta === "object")
    ? targetingState.lastMeta
    : {};
  const targetingPreset = String(targetingMeta?.presetLabel || targetingMeta?.presetId || targetingState?.presetId || "").trim();
  const targetingModel = String(targetingMeta?.modelLabel || targetingMeta?.modelId || targetingState?.modelId || "").trim();
  const targetingGeoLevel = String(targetingMeta?.geoLevel || targetingState?.geoLevel || "").trim();
  const targetingTopN = safeNum(targetingMeta?.topN) ?? safeNum(targetingState?.topN);
  const targetingRanAt = String(targetingMeta?.ranAt || targetingState?.lastRun || "").trim();
  const targetingMetaBits = [];
  if (targetingPreset) targetingMetaBits.push(targetingPreset);
  if (targetingModel && targetingModel !== targetingPreset) targetingMetaBits.push(`Base ${targetingModel}`);
  if (targetingGeoLevel) targetingMetaBits.push(targetingGeoLevel);
  if (targetingTopN != null){
    targetingMetaBits.push(`Top ${Math.max(1, roundWholeNumberByMode(targetingTopN, { mode: "floor", fallback: 1 }) || 1)}`);
  }
  if (targetingRanAt) targetingMetaBits.push(`Ran ${targetingRanAt}`);
  const targetingStatusText = targetingRows.length
    ? `Ranked ${districtBridgeFmtInt(targetingRows.length)} GEO rows.`
    : "Run targeting to generate ranked GEOs.";
  const targetingMetaText = targetingMetaBits.join(" · ") || "No targeting run yet.";
  const targetingTopNConfig = safeNum(targetingState?.topN);
  const targetingMinHousingUnitsConfig = safeNum(targetingState?.minHousingUnits);
  const targetingMinPopulationConfig = safeNum(targetingState?.minPopulation);
  const targetingMinScoreConfig = safeNum(targetingState?.minScore);
  const targetingWeightVotePotential = safeNum(targetingState?.weights?.votePotential);
  const targetingWeightTurnoutOpportunity = safeNum(targetingState?.weights?.turnoutOpportunity);
  const targetingWeightPersuasionIndex = safeNum(targetingState?.weights?.persuasionIndex);
  const targetingWeightFieldEfficiency = safeNum(targetingState?.weights?.fieldEfficiency);
  const targetingPresetId = String(targetingState?.presetId || "").trim();
  const targetingModelId = String(targetingState?.modelId || "").trim();
  const censusLoadedRowCount = safeNum(censusState?.loadedRowCount) ?? 0;
  const houseModelActive = targetingPresetId === "house_v1" || targetingModelId === "house_v1";
  const targetingConfig = {
    presetId: targetingPresetId,
    geoLevel: String(targetingState?.geoLevel || "").trim(),
    modelId: targetingModelId,
    topN: targetingTopNConfig,
    minHousingUnits: targetingMinHousingUnitsConfig,
    minPopulation: targetingMinPopulationConfig,
    minScore: targetingMinScoreConfig,
    onlyRaceFootprint: !!targetingState?.onlyRaceFootprint,
    prioritizeYoung: !!targetingState?.criteria?.prioritizeYoung,
    prioritizeRenters: !!targetingState?.criteria?.prioritizeRenters,
    avoidHighMultiUnit: !!targetingState?.criteria?.avoidHighMultiUnit,
    densityFloor: String(targetingState?.criteria?.densityFloor || "none").trim() || "none",
    weightVotePotential: targetingWeightVotePotential,
    weightTurnoutOpportunity: targetingWeightTurnoutOpportunity,
    weightPersuasionIndex: targetingWeightPersuasionIndex,
    weightFieldEfficiency: targetingWeightFieldEfficiency,
    controlsLocked: isScenarioLockedForEdits(currentState),
    canRun: censusLoadedRowCount > 0,
    canExport: targetingRows.length > 0,
    canResetWeights: houseModelActive,
  };
  const templateMeta = currentState?.templateMeta && typeof currentState.templateMeta === "object"
    ? currentState.templateMeta
    : {};
  const template = {
    raceType: String(currentState?.raceType || "").trim(),
    officeLevel: String(templateMeta?.officeLevel || "").trim(),
    electionType: String(templateMeta?.electionType || "").trim(),
    seatContext: String(templateMeta?.seatContext || "").trim(),
    partisanshipMode: String(templateMeta?.partisanshipMode || "").trim(),
    salienceLevel: String(templateMeta?.salienceLevel || "").trim(),
    appliedTemplateId: String(templateMeta?.appliedTemplateId || "").trim(),
    appliedVersion: String(templateMeta?.appliedVersion || "").trim(),
    benchmarkKey: String(templateMeta?.benchmarkKey || "").trim(),
    overriddenFields: Array.isArray(templateMeta?.overriddenFields)
      ? templateMeta.overriddenFields.map((field) => String(field || "").trim()).filter(Boolean)
      : [],
    assumptionsProfile: String(currentState?.ui?.assumptionsProfile || "").trim(),
    candidateHistoryCoverageBand: String(res?.validation?.candidateHistory?.coverageBand || "none").trim(),
    candidateHistoryConfidenceBand: String(res?.validation?.candidateHistory?.confidenceBand || "missing").trim(),
    candidateHistoryRecordCount: safeNum(res?.validation?.candidateHistory?.recordCount) ?? 0,
  };
  const form = {
    raceType: String(currentState?.raceType || "").trim(),
    electionDate: String(currentState?.electionDate || "").trim(),
    weeksRemaining: String(currentState?.weeksRemaining ?? "").trim(),
    mode: String(currentState?.mode || "").trim(),
    universeSize: safeNum(currentState?.universeSize),
    universeBasis: String(currentState?.universeBasis || "").trim(),
    sourceNote: String(currentState?.sourceNote || "").trim(),
    turnoutA: safeNum(currentState?.turnoutA),
    turnoutB: safeNum(currentState?.turnoutB),
    bandWidth: safeNum(currentState?.bandWidth),
    universe16Enabled: !!currentState?.universeLayerEnabled,
    universe16DemPct: safeNum(currentState?.universeDemPct),
    universe16RepPct: safeNum(currentState?.universeRepPct),
    universe16NpaPct: safeNum(currentState?.universeNpaPct),
    universe16OtherPct: safeNum(currentState?.universeOtherPct),
    retentionFactor: safeNum(currentState?.retentionFactor),
  };
  const bridgeAggregateRows = districtBridgeNormalizeRows(censusState?.bridgeAggregateRows, 2);
  const bridgeAdvisoryRows = districtBridgeNormalizeRows(censusState?.bridgeAdvisoryRows, 2);
  const bridgeElectionPreviewRows = districtBridgeNormalizeRows(censusState?.bridgeElectionPreviewRows, 4);
  const censusConfigOptions = districtBridgeBuildCensusConfigOptions(censusState);
  const censusDisabledMap = districtBridgeBuildCensusDisabledMap(currentState, censusState);
  const districtDisabledMap = districtBridgeBuildDistrictDisabledMap(currentState);
  const census = {
    contextHint: districtBridgeBuildContextHint(censusState) || "State-only context active for this resolution.",
    selectionSetStatus: districtBridgeBuildSelectionSetStatus(censusState) || "No saved selection sets.",
    statusText: String(censusState?.status || "").trim() || "Ready.",
    geoStatsText: districtBridgeBuildGeoStatsText(censusState) || "0 selected of 0 GEOs. 0 rows loaded.",
    lastFetchText: districtBridgeFmtTimestamp(censusState?.lastFetchAt),
    selectionSummaryText: districtBridgeBuildSelectionSummary(censusState) || "No GEO selected.",
    raceFootprintStatusText: districtBridgeBuildRaceFootprintStatus(currentState) || "Race footprint not set.",
    assumptionProvenanceStatusText: districtBridgeBuildAssumptionProvenanceStatus(currentState) || "Assumption provenance not set.",
    footprintCapacityStatusText: districtBridgeBuildFootprintCapacityStatus(currentState) || "Footprint capacity: not set.",
    applyAdjustmentsStatusText: districtBridgeBuildApplyAdjustmentsStatus(censusState) || "Census-adjusted assumptions are OFF.",
    advisoryStatusText: String(censusState?.bridgeAdvisoryStatusText || "").trim() || "Assumption advisory pending.",
    electionCsvGuideStatusText: String(censusState?.bridgeElectionCsvGuideStatusText || "").trim() || "Election CSV schema guide loading.",
    electionCsvDryRunStatusText: String(censusState?.bridgeElectionCsvDryRunStatusText || "").trim() || "No dry-run run yet.",
    electionCsvPreviewMetaText: String(censusState?.bridgeElectionCsvPreviewMetaText || "").trim() || "No normalized preview rows.",
    mapStatusText: String(censusState?.bridgeMapStatusText || "").trim() || "Map idle. Select GEO units and click Load boundaries.",
    mapQaVtdZipStatusText: String(censusState?.bridgeMapQaVtdZipStatusText || "").trim() || "No VTD ZIP loaded.",
    aggregateRows: bridgeAggregateRows,
    advisoryRows: bridgeAdvisoryRows,
    electionPreviewRows: bridgeElectionPreviewRows,
    config: {
      apiKey: String(censusState?.bridgeApiKey || "").trim(),
      year: String(censusState?.year || "").trim(),
      resolution: String(censusState?.resolution || "").trim(),
      stateFips: String(censusState?.stateFips || "").trim(),
      countyFips: String(censusState?.countyFips || "").trim(),
      placeFips: String(censusState?.placeFips || "").trim(),
      metricSet: String(censusState?.metricSet || "").trim(),
      geoSearch: String(censusState?.geoSearch || "").trim(),
      geoPaste: String(censusState?.bridgeGeoPaste || "").trim(),
      tractFilter: String(censusState?.tractFilter || "").trim(),
      selectionSetDraftName: String(censusState?.selectionSetDraftName || "").trim(),
      selectedSelectionSetKey: String(censusState?.selectedSelectionSetKey || "").trim(),
      electionCsvPrecinctFilter: String(censusState?.bridgeElectionCsvPrecinctFilter || "").trim(),
      applyAdjustedAssumptions: !!censusState?.applyAdjustedAssumptions,
      mapQaVtdOverlay: !!censusState?.mapQaVtdOverlay,
      controlsLocked: isScenarioLockedForEdits(currentState),
      disabledMap: censusDisabledMap,
      stateOptions: censusConfigOptions.stateOptions,
      countyOptions: censusConfigOptions.countyOptions,
      placeOptions: censusConfigOptions.placeOptions,
      tractFilterOptions: censusConfigOptions.tractFilterOptions,
      selectionSetOptions: censusConfigOptions.selectionSetOptions,
      geoSelectOptions: censusConfigOptions.geoSelectOptions,
    },
  };
  return {
    summary,
    template,
    form,
    ballot,
    targeting: {
      statusText: targetingStatusText,
      metaText: targetingMetaText,
      rows: targetingRows,
      config: targetingConfig,
    },
    census,
    controls: {
      locked: isScenarioLockedForEdits(currentState),
      disabledMap: districtDisabledMap,
    },
  };
}

function districtBridgeBuildDistrictDisabledMap(currentState){
  const controlsLocked = isScenarioLockedForEdits(currentState);
  return {
    v3DistrictYourCandidate: controlsLocked,
    v3DistrictUndecidedPct: controlsLocked,
    v3DistrictUndecidedMode: controlsLocked,
    v3BtnAddCandidate: controlsLocked,
    v3BtnAddCandidateHistory: controlsLocked,
    v3DistrictRaceType: controlsLocked,
    v3DistrictOfficeLevel: controlsLocked,
    v3DistrictElectionType: controlsLocked,
    v3DistrictSeatContext: controlsLocked,
    v3DistrictPartisanshipMode: controlsLocked,
    v3DistrictSalienceLevel: controlsLocked,
    v3BtnDistrictApplyTemplateDefaults: controlsLocked,
    v3DistrictElectionDate: controlsLocked,
    v3DistrictWeeksRemaining: controlsLocked,
    v3DistrictMode: controlsLocked,
    v3DistrictUniverseSize: controlsLocked,
    v3DistrictUniverseBasis: controlsLocked,
    v3DistrictSourceNote: controlsLocked,
    v3DistrictElectorateWeightingToggle: controlsLocked,
    v3DistrictTurnoutA: controlsLocked,
    v3DistrictTurnoutB: controlsLocked,
    v3DistrictBandWidth: controlsLocked,
    v3DistrictDemPct: controlsLocked,
    v3DistrictRepPct: controlsLocked,
    v3DistrictNpaPct: controlsLocked,
    v3DistrictOtherPct: controlsLocked,
    v3DistrictRetentionFactor: controlsLocked,
  };
}

function districtBridgeGetCensusRuntimeApi(){
  try {
    const api = window.__FPE_CENSUS_RUNTIME_API__;
    return (api && typeof api === "object") ? api : null;
  } catch {
    return null;
  }
}

function districtBridgeCallCensusRuntime(method, ...args){
  const api = districtBridgeGetCensusRuntimeApi();
  if (!api || typeof api[method] !== "function"){
    return null;
  }
  try {
    return api[method](...args);
  } catch {
    return null;
  }
}

function districtBridgePatchCensusBridgeField(field, rawValue){
  const key = cleanText(field);
  if (!key) return false;
  const resetGeoData = (census) => {
    census.geoSearch = "";
    census.tractFilter = "";
    census.geoOptions = [];
    census.selectedGeoids = [];
    census.rowsByGeoid = {};
    census.activeRowsKey = "";
    census.loadedRowCount = 0;
    census.loadingGeo = false;
    census.loadingRows = false;
    census.lastFetchAt = "";
  };
  const resetRowsOnly = (census) => {
    census.rowsByGeoid = {};
    census.activeRowsKey = "";
    census.loadedRowCount = 0;
    census.loadingRows = false;
    census.lastFetchAt = "";
  };
  let applied = false;
  mutateState((next) => {
    next.census = normalizeCensusState(next.census);
    const census = {
      ...next.census,
      geoOptions: Array.isArray(next.census?.geoOptions) ? next.census.geoOptions.slice() : [],
      selectedGeoids: Array.isArray(next.census?.selectedGeoids) ? next.census.selectedGeoids.slice() : [],
      rowsByGeoid: next.census?.rowsByGeoid && typeof next.census.rowsByGeoid === "object"
        ? { ...next.census.rowsByGeoid }
        : {},
      selectionSets: Array.isArray(next.census?.selectionSets) ? next.census.selectionSets.slice() : [],
      bridgeStateOptions: Array.isArray(next.census?.bridgeStateOptions) ? next.census.bridgeStateOptions.slice() : [],
      bridgeCountyOptions: Array.isArray(next.census?.bridgeCountyOptions) ? next.census.bridgeCountyOptions.slice() : [],
      bridgePlaceOptions: Array.isArray(next.census?.bridgePlaceOptions) ? next.census.bridgePlaceOptions.slice() : [],
      bridgeTractFilterOptions: Array.isArray(next.census?.bridgeTractFilterOptions) ? next.census.bridgeTractFilterOptions.slice() : [],
      bridgeSelectionSetOptions: Array.isArray(next.census?.bridgeSelectionSetOptions) ? next.census.bridgeSelectionSetOptions.slice() : [],
      bridgeGeoSelectOptions: Array.isArray(next.census?.bridgeGeoSelectOptions) ? next.census.bridgeGeoSelectOptions.slice() : [],
      bridgeAggregateRows: Array.isArray(next.census?.bridgeAggregateRows) ? next.census.bridgeAggregateRows.slice() : [],
      bridgeAdvisoryRows: Array.isArray(next.census?.bridgeAdvisoryRows) ? next.census.bridgeAdvisoryRows.slice() : [],
      bridgeElectionPreviewRows: Array.isArray(next.census?.bridgeElectionPreviewRows) ? next.census.bridgeElectionPreviewRows.slice() : [],
    };
    if (key === "apiKey"){
      census.bridgeApiKey = cleanText(rawValue);
      applied = true;
    } else if (key === "geoPaste"){
      census.bridgeGeoPaste = String(rawValue == null ? "" : rawValue);
      applied = true;
    } else if (key === "electionCsvPrecinctFilter"){
      census.bridgeElectionCsvPrecinctFilter = String(rawValue == null ? "" : rawValue);
      applied = true;
    } else if (key === "year"){
      census.year = cleanText(rawValue);
      resetRowsOnly(census);
      applied = true;
    } else if (key === "resolution"){
      const resolution = cleanText(rawValue) || census.resolution;
      census.resolution = resolution;
      if (!resolutionNeedsCounty(resolution)){
        census.countyFips = "";
      }
      if (resolution !== "block_group"){
        census.tractFilter = "";
      }
      resetGeoData(census);
      applied = true;
    } else if (key === "stateFips"){
      census.stateFips = cleanText(rawValue);
      census.countyFips = "";
      census.placeFips = "";
      resetGeoData(census);
      applied = true;
    } else if (key === "countyFips"){
      census.countyFips = cleanText(rawValue);
      resetGeoData(census);
      applied = true;
    } else if (key === "placeFips"){
      census.placeFips = cleanText(rawValue);
      if (cleanText(census.resolution) === "place"){
        resetGeoData(census);
      }
      applied = true;
    } else if (key === "metricSet"){
      census.metricSet = cleanText(rawValue) || census.metricSet;
      resetRowsOnly(census);
      applied = true;
    } else if (key === "geoSearch"){
      census.geoSearch = cleanText(rawValue);
      applied = true;
    } else if (key === "tractFilter"){
      census.tractFilter = cleanText(rawValue);
      applied = true;
    } else if (key === "selectionSetDraftName"){
      census.selectionSetDraftName = cleanText(rawValue);
      applied = true;
    } else if (key === "selectedSelectionSetKey"){
      census.selectedSelectionSetKey = cleanText(rawValue);
      applied = true;
    } else if (key === "applyAdjustedAssumptions"){
      census.applyAdjustedAssumptions = !!rawValue;
      applied = true;
    } else if (key === "mapQaVtdOverlay"){
      census.mapQaVtdOverlay = !!rawValue;
      applied = true;
    }

    if (applied){
      next.census = normalizeCensusState(census);
      const statusBase = cleanText(next.census.status) || "Ready.";
      next.census.status = statusBase;
      next.census.error = "";
    }
  });
  return applied;
}

function districtBridgePatchCensusGeoSelection(values){
  const nextValues = Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value == null ? "" : value).trim())
      .filter(Boolean),
  ));
  let applied = false;
  mutateState((next) => {
    next.census = normalizeCensusState(next.census);
    next.census = {
      ...next.census,
      selectedGeoids: nextValues,
    };
    applied = true;
  });
  return applied;
}

function installDistrictBridge(){
  window[DISTRICT_BRIDGE_KEY] = {
    getView: () => districtBridgeStateView(),
    setFormField: (field, value) => districtBridgeSetFormField(field, value),
    applyTemplateDefaults: (mode) => districtBridgeApplyTemplateDefaults(mode),
    addCandidate: () => districtBridgeAddCandidate(),
    updateCandidate: (candidateId, field, value) => districtBridgeUpdateCandidate(candidateId, field, value),
    removeCandidate: (candidateId) => districtBridgeRemoveCandidate(candidateId),
    setUserSplit: (candidateId, value) => districtBridgeSetUserSplit(candidateId, value),
    addCandidateHistory: () => districtBridgeAddCandidateHistoryRecord(),
    updateCandidateHistory: (recordId, field, value) => districtBridgeUpdateCandidateHistoryRecord(recordId, field, value),
    removeCandidateHistory: (recordId) => districtBridgeRemoveCandidateHistoryRecord(recordId),
    setTargetingField: (field, value) => districtBridgeSetTargetingField(field, value),
    applyTargetingPreset: (modelId) => districtBridgeApplyTargetingPreset(modelId),
    resetTargetingWeights: () => districtBridgeResetTargetingWeights(),
    runTargeting: () => districtBridgeRunTargeting(),
    exportTargetingCsv: () => districtBridgeExportTargetingCsv(),
    exportTargetingJson: () => districtBridgeExportTargetingJson(),
    setCensusField: (field, value) => districtBridgeSetCensusField(field, value),
    setCensusGeoSelection: (values) => districtBridgeSetCensusGeoSelection(values),
    setCensusFile: (field, files) => districtBridgeSetCensusFile(field, files),
    triggerCensusAction: (action) => districtBridgeTriggerCensusAction(action),
  };
}

function districtBridgeEnsureTargetingState(srcState = state){
  if (!srcState || typeof srcState !== "object"){
    return null;
  }
  srcState.targeting = normalizeTargetingState(srcState.targeting);
  return srcState.targeting;
}

function districtBridgeTemplateDimensionsFromState(srcState, overrides = {}){
  const meta = srcState?.templateMeta && typeof srcState.templateMeta === "object" ? srcState.templateMeta : {};
  const officeLevel = cleanText(overrides.officeLevel ?? meta.officeLevel);
  const electionType = cleanText(overrides.electionType ?? meta.electionType);
  const seatContext = cleanText(overrides.seatContext ?? meta.seatContext);
  const partisanshipMode = cleanText(overrides.partisanshipMode ?? meta.partisanshipMode);
  const salienceLevel = cleanText(overrides.salienceLevel ?? meta.salienceLevel);
  return {
    officeLevel,
    electionType,
    seatContext,
    partisanshipMode,
    salienceLevel,
  };
}

function districtBridgeApplyTemplateDefaults(mode = "all"){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const requestedMode = cleanText(mode);
  let applyResult = { ok: false, code: "unknown" };
  mutateState((next) => {
    const dims = districtBridgeTemplateDimensionsFromState(next);
    applyResult = applyTemplateDefaultsForRace(next, next.raceType, {
      mode: requestedMode || "all",
      ...dims,
    });
    if (!next.ui || typeof next.ui !== "object") next.ui = {};
    next.ui.assumptionsProfile = deriveAssumptionsProfileFromState(next);
  });
  if (!applyResult || applyResult.ok !== true){
    return {
      ok: false,
      code: String(applyResult?.code || "apply_failed"),
      view: districtBridgeStateView(),
    };
  }
  return {
    ok: true,
    code: "applied",
    mode: String(applyResult.mode || requestedMode || "untouched"),
    updatedFields: Array.isArray(applyResult.updatedFields) ? applyResult.updatedFields.slice() : [],
    skippedFields: Array.isArray(applyResult.skippedFields) ? applyResult.skippedFields.slice() : [],
    templateId: String(applyResult.templateId || "").trim(),
    view: districtBridgeStateView(),
  };
}

function districtBridgeSetFormField(field, rawValue){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const key = cleanText(field);
  if (!key){
    return { ok: false, code: "missing_field", view: districtBridgeStateView() };
  }

  let applied = false;
  mutateState((next) => {
    const templateDims = districtBridgeTemplateDimensionsFromState(next);
    const applyTemplateDimension = (overrides = {}) => {
      applyTemplateDefaultsForRace(next, next.raceType, {
        mode: "untouched",
        ...templateDims,
        ...overrides,
      });
      if (!next.ui || typeof next.ui !== "object") next.ui = {};
      next.ui.assumptionsProfile = deriveAssumptionsProfileFromState(next);
    };

    if (key === "raceType"){
      const value = cleanText(rawValue);
      if (!value) return;
      next.raceType = value;
      applyTemplateDefaultsForRace(next, value, { mode: "untouched" });
      if (!next.ui || typeof next.ui !== "object") next.ui = {};
      next.ui.assumptionsProfile = deriveAssumptionsProfileFromState(next);
      applied = true;
      return;
    }
    if (key === "officeLevel"){
      const value = cleanText(rawValue);
      if (!value) return;
      applyTemplateDimension({ officeLevel: value });
      applied = true;
      return;
    }
    if (key === "electionType"){
      const value = cleanText(rawValue);
      if (!value) return;
      applyTemplateDimension({ electionType: value });
      applied = true;
      return;
    }
    if (key === "seatContext"){
      const value = cleanText(rawValue);
      if (!value) return;
      applyTemplateDimension({ seatContext: value });
      applied = true;
      return;
    }
    if (key === "partisanshipMode"){
      const value = cleanText(rawValue);
      if (!value) return;
      applyTemplateDimension({ partisanshipMode: value });
      applied = true;
      return;
    }
    if (key === "salienceLevel"){
      const value = cleanText(rawValue);
      if (!value) return;
      applyTemplateDimension({ salienceLevel: value });
      applied = true;
      return;
    }
    if (key === "electionDate"){
      next.electionDate = String(rawValue == null ? "" : rawValue);
      applied = true;
      return;
    }
    if (key === "weeksRemaining"){
      next.weeksRemaining = String(rawValue == null ? "" : rawValue);
      applied = true;
      return;
    }
    if (key === "mode"){
      const value = cleanText(rawValue);
      if (!value) return;
      next.mode = value;
      applied = true;
      return;
    }
    if (key === "universeSize"){
      next.universeSize = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "universeBasis"){
      const value = cleanText(rawValue);
      if (!value) return;
      next.universeBasis = value;
      applied = true;
      return;
    }
    if (key === "sourceNote"){
      next.sourceNote = String(rawValue == null ? "" : rawValue);
      applied = true;
      return;
    }
    if (key === "yourCandidate"){
      next.yourCandidateId = String(rawValue == null ? "" : rawValue);
      applied = true;
      return;
    }
    if (key === "undecidedPct"){
      next.undecidedPct = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "undecidedMode"){
      next.undecidedMode = String(rawValue == null ? "" : rawValue) || "proportional";
      applied = true;
      return;
    }
    if (key === "turnoutA"){
      next.turnoutA = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "turnoutB"){
      next.turnoutB = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "bandWidth"){
      next.bandWidth = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "universe16Enabled"){
      next.universeLayerEnabled = !!rawValue;
      applied = true;
      return;
    }
    if (key === "universe16DemPct"){
      next.universeDemPct = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "universe16RepPct"){
      next.universeRepPct = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "universe16NpaPct"){
      next.universeNpaPct = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "universe16OtherPct"){
      next.universeOtherPct = safeNum(rawValue);
      applied = true;
      return;
    }
    if (key === "retentionFactor"){
      next.retentionFactor = safeNum(rawValue);
      applied = true;
    }
  });

  if (applied) {
    if (key === "bandWidth") {
      refreshAssumptionsProfile();
    }
    if (
      key === "universe16Enabled"
      || key === "universe16DemPct"
      || key === "universe16RepPct"
      || key === "universe16NpaPct"
      || key === "universe16OtherPct"
      || key === "retentionFactor"
    ) {
      markMcStale();
    }
  }

  return { ok: applied, view: districtBridgeStateView() };
}

function districtBridgeAddCandidate(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  mutateState((next) => {
    if (!Array.isArray(next.candidates)) next.candidates = [];
    const labelChar = String.fromCharCode(65 + next.candidates.length);
    next.candidates.push({ id: uid(), name: `Candidate ${labelChar}`, supportPct: 0 });
  });
  return { ok: true, view: districtBridgeStateView() };
}

function districtBridgeUpdateCandidate(candidateId, field, rawValue){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const id = cleanText(candidateId);
  const key = cleanText(field);
  if (!id || !key){
    return { ok: false, code: "missing_candidate_field", view: districtBridgeStateView() };
  }

  let applied = false;
  mutateState((next) => {
    if (!Array.isArray(next.candidates)) return;
    const candidate = next.candidates.find((row) => cleanText(row?.id) === id);
    if (!candidate) return;
    if (key === "name"){
      candidate.name = String(rawValue == null ? "" : rawValue);
      if (!next.userSplit || typeof next.userSplit !== "object") next.userSplit = {};
      if (next.userSplit[candidate.id] == null) next.userSplit[candidate.id] = 0;
      applied = true;
      return;
    }
    if (key === "supportPct"){
      candidate.supportPct = safeNum(rawValue);
      applied = true;
    }
  });

  return { ok: applied, view: districtBridgeStateView() };
}

function districtBridgeRemoveCandidate(candidateId){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const id = cleanText(candidateId);
  if (!id){
    return { ok: false, code: "missing_candidate", view: districtBridgeStateView() };
  }

  let applied = false;
  mutateState((next) => {
    if (!Array.isArray(next.candidates) || next.candidates.length <= 2) return;
    const remaining = next.candidates.filter((row) => cleanText(row?.id) !== id);
    if (remaining.length === next.candidates.length || remaining.length < 2) return;
    next.candidates = remaining;
    if (next.userSplit && typeof next.userSplit === "object") {
      delete next.userSplit[id];
    }
    if (cleanText(next.yourCandidateId) === id){
      next.yourCandidateId = next.candidates[0]?.id || null;
    }
    applied = true;
  });

  return { ok: applied, view: districtBridgeStateView() };
}

function districtBridgeSetUserSplit(candidateId, rawValue){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const id = cleanText(candidateId);
  if (!id){
    return { ok: false, code: "missing_candidate", view: districtBridgeStateView() };
  }

  let applied = false;
  mutateState((next) => {
    if (!next.userSplit || typeof next.userSplit !== "object") next.userSplit = {};
    next.userSplit[id] = safeNum(rawValue);
    applied = true;
  });

  return { ok: applied, view: districtBridgeStateView() };
}

function districtBridgeCandidateHistoryRecordPatch(record, key, rawValue){
  if (!record || typeof record !== "object") return false;
  const field = cleanText(key);
  if (!field) return false;
  if (field === "office"){
    record.office = String(rawValue == null ? "" : rawValue);
    return true;
  }
  if (field === "cycleYear"){
    record.cycleYear = safeNum(rawValue);
    return true;
  }
  if (field === "electionType"){
    record.electionType = cleanText(rawValue).toLowerCase();
    return true;
  }
  if (field === "candidateName"){
    record.candidateName = String(rawValue == null ? "" : rawValue);
    return true;
  }
  if (field === "party"){
    record.party = String(rawValue == null ? "" : rawValue);
    return true;
  }
  if (field === "incumbencyStatus"){
    record.incumbencyStatus = cleanText(rawValue).toLowerCase();
    return true;
  }
  if (field === "voteShare"){
    record.voteShare = safeNum(rawValue);
    return true;
  }
  if (field === "margin"){
    record.margin = safeNum(rawValue);
    return true;
  }
  if (field === "turnoutContext"){
    record.turnoutContext = safeNum(rawValue);
    return true;
  }
  if (field === "repeatCandidate"){
    record.repeatCandidate = !!rawValue;
    return true;
  }
  if (field === "overUnderPerformancePct"){
    record.overUnderPerformancePct = safeNum(rawValue);
    return true;
  }
  return false;
}

function districtBridgeAddCandidateHistoryRecord(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }

  mutateState((next) => {
    const current = normalizeCandidateHistoryRecords(next.candidateHistory, { uidFn: uid });
    current.push({
      recordId: `ch_${uid()}`,
      office: String(next?.officeId || next?.campaignName || next?.raceType || "").trim(),
      cycleYear: null,
      electionType: String(next?.templateMeta?.electionType || "general").trim().toLowerCase() || "general",
      candidateName: "",
      party: "",
      incumbencyStatus: "",
      voteShare: null,
      margin: null,
      turnoutContext: null,
      repeatCandidate: false,
      overUnderPerformancePct: null,
    });
    next.candidateHistory = normalizeCandidateHistoryRecords(current, { uidFn: uid });
  });
  return { ok: true, view: districtBridgeStateView() };
}

function districtBridgeUpdateCandidateHistoryRecord(recordId, field, rawValue){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const id = cleanText(recordId);
  const key = cleanText(field);
  if (!id || !key){
    return { ok: false, code: "missing_candidate_history_field", view: districtBridgeStateView() };
  }

  let applied = false;
  mutateState((next) => {
    const rows = normalizeCandidateHistoryRecords(next.candidateHistory, { uidFn: uid });
    const target = rows.find((row) => cleanText(row?.recordId) === id);
    if (!target) return;
    applied = districtBridgeCandidateHistoryRecordPatch(target, key, rawValue) || applied;
    next.candidateHistory = normalizeCandidateHistoryRecords(rows, { uidFn: uid });
  });
  return { ok: applied, view: districtBridgeStateView() };
}

function districtBridgeRemoveCandidateHistoryRecord(recordId){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const id = cleanText(recordId);
  if (!id){
    return { ok: false, code: "missing_candidate_history_id", view: districtBridgeStateView() };
  }

  let applied = false;
  mutateState((next) => {
    const rows = normalizeCandidateHistoryRecords(next.candidateHistory, { uidFn: uid });
    const remaining = rows.filter((row) => cleanText(row?.recordId) !== id);
    if (remaining.length === rows.length) return;
    next.candidateHistory = normalizeCandidateHistoryRecords(remaining, { uidFn: uid });
    applied = true;
  });
  return { ok: applied, view: districtBridgeStateView() };
}

function districtBridgeDownloadTextFile(text, filename, mime){
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined"){
    return false;
  }
  const blob = new Blob([String(text == null ? "" : text)], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

function districtBridgeSetTargetingField(field, rawValue){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const key = cleanText(field);
  if (!key){
    return { ok: false, code: "missing_field", view: districtBridgeStateView() };
  }

  let applied = false;
  mutateState((next) => {
    const targeting = districtBridgeEnsureTargetingState(next);
    if (!targeting){
      return;
    }
    applied = applyTargetingFieldPatch(targeting, key, rawValue) || applied;
  });

  if (!applied){
    return { ok: false, code: "ignored", view: districtBridgeStateView() };
  }
  return { ok: true, view: districtBridgeStateView() };
}

function districtBridgeApplyTargetingPreset(modelId){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const nextModelId = cleanText(modelId);
  if (!nextModelId){
    return { ok: false, code: "missing_model", view: districtBridgeStateView() };
  }

  mutateState((next) => {
    const targeting = districtBridgeEnsureTargetingState(next);
    if (!targeting){
      return;
    }
    applyTargetModelPreset(targeting, nextModelId);
  });
  return { ok: true, view: districtBridgeStateView() };
}

function districtBridgeResetTargetingWeights(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }

  mutateState((next) => {
    const targeting = districtBridgeEnsureTargetingState(next);
    if (!targeting){
      return;
    }
    resetTargetingWeightsToPreset(targeting, cleanText(targeting.presetId) || cleanText(targeting.modelId));
  });
  return { ok: true, view: districtBridgeStateView() };
}

function districtBridgeRunTargeting(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const runtimeRows = getCensusRowsForState(state?.census);
  const loadedCount = Object.keys(runtimeRows && typeof runtimeRows === "object" ? runtimeRows : {}).length;
  if (!loadedCount){
    mutateState((next) => {
      if (!next.census || typeof next.census !== "object") next.census = {};
      next.census.status = TARGETING_STATUS_LOAD_ROWS_FIRST;
      next.census.error = next.census.status;
    });
    return { ok: false, code: "no_rows", view: districtBridgeStateView() };
  }

  let runResult = null;
  let runError = null;
  mutateState((next) => {
    try {
      const targeting = districtBridgeEnsureTargetingState(next);
      if (!targeting){
        return;
      }
      if (!next.census || typeof next.census !== "object") next.census = {};
      runResult = runTargetRanking({
        state: next,
        censusState: next.census,
        rowsByGeoid: runtimeRows,
      });
      const applied = applyTargetingRunResult(targeting, runResult, { locale: "en-US" });
      if (!applied.hasRows){
        next.census.status = applied.statusText;
        next.census.error = "";
        return;
      }
      next.census.status = applied.statusText;
      next.census.error = "";
    } catch (err) {
      runError = err;
      if (!next.census || typeof next.census !== "object") next.census = {};
      next.census.status = cleanText(err?.message) || "Targeting run failed.";
      next.census.error = next.census.status;
    }
  });

  if (runError){
    return { ok: false, code: "run_failed", view: districtBridgeStateView() };
  }
  return { ok: true, view: districtBridgeStateView() };
}

function districtBridgeExportTargetingCsv(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const targeting = districtBridgeEnsureTargetingState(state);
  const rows = Array.isArray(targeting?.lastRows) ? targeting.lastRows : [];
  if (!rows.length){
    return { ok: false, code: "no_rows", view: districtBridgeStateView() };
  }
  const file = buildTargetRankingExportFilename({
    presetId: cleanText(targeting?.presetId),
    modelId: cleanText(targeting?.modelId),
    extension: "csv",
  });
  const csv = buildTargetRankingCsv(rows);
  const ok = districtBridgeDownloadTextFile(csv, file, "text/csv");
  return { ok, code: ok ? "exported" : "export_failed", view: districtBridgeStateView() };
}

function districtBridgeExportTargetingJson(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: districtBridgeStateView() };
  }
  const targeting = districtBridgeEnsureTargetingState(state);
  const rows = Array.isArray(targeting?.lastRows) ? targeting.lastRows : [];
  if (!rows.length){
    return { ok: false, code: "no_rows", view: districtBridgeStateView() };
  }
  const payload = buildTargetRankingPayload({
    rows,
    meta: targeting?.lastMeta,
    config: buildTargetRankingPayloadConfig(targeting),
  });
  const file = buildTargetRankingExportFilename({
    presetId: cleanText(targeting?.presetId),
    modelId: cleanText(targeting?.modelId),
    extension: "json",
  });
  const ok = districtBridgeDownloadTextFile(JSON.stringify(payload, null, 2), file, "application/json");
  return { ok, code: ok ? "exported" : "export_failed", view: districtBridgeStateView() };
}

function districtBridgeSetCensusField(field, rawValue){
  const key = cleanText(field);
  if (!key){
    return { ok: false, code: "missing_field", view: districtBridgeStateView() };
  }
  const runtimeResult = districtBridgeCallCensusRuntime("setField", key, rawValue);
  if (runtimeResult && typeof runtimeResult === "object"){
    if (runtimeResult.ok === true){
      return { ok: true, code: "updated_runtime", view: districtBridgeStateView() };
    }
    const bridgePatched = districtBridgePatchCensusBridgeField(key, rawValue);
    if (bridgePatched){
      return {
        ok: true,
        code: cleanText(runtimeResult.code) || "runtime_unavailable_fallback",
        view: districtBridgeStateView(),
      };
    }
    return {
      ok: false,
      code: cleanText(runtimeResult.code) || "runtime_unavailable",
      view: districtBridgeStateView(),
    };
  }
  const bridgePatched = districtBridgePatchCensusBridgeField(key, rawValue);
  if (bridgePatched){
    return { ok: true, code: "updated_bridge_state", view: districtBridgeStateView() };
  }
  return { ok: false, code: "runtime_unavailable", view: districtBridgeStateView() };
}

function districtBridgeSetCensusGeoSelection(values){
  const runtimeResult = districtBridgeCallCensusRuntime("setGeoSelection", values);
  if (runtimeResult && typeof runtimeResult === "object"){
    if (runtimeResult.ok === true){
      return { ok: true, code: "updated_runtime", view: districtBridgeStateView() };
    }
    const patched = districtBridgePatchCensusGeoSelection(values);
    if (patched){
      return {
        ok: true,
        code: cleanText(runtimeResult.code) || "runtime_unavailable_fallback",
        view: districtBridgeStateView(),
      };
    }
    return {
      ok: false,
      code: cleanText(runtimeResult.code) || "runtime_unavailable",
      view: districtBridgeStateView(),
    };
  }
  const patched = districtBridgePatchCensusGeoSelection(values);
  if (patched){
    return { ok: true, code: "updated_bridge_state", view: districtBridgeStateView() };
  }
  return { ok: false, code: "runtime_unavailable", view: districtBridgeStateView() };
}

function districtBridgeSetCensusFile(field, filesLike){
  const key = cleanText(field);
  if (!key){
    return { ok: false, code: "missing_field", view: districtBridgeStateView() };
  }
  const runtimeResult = districtBridgeCallCensusRuntime("setFile", key, filesLike);
  if (runtimeResult && typeof runtimeResult === "object"){
    if (runtimeResult.ok === true){
      return { ok: true, code: "updated_runtime", view: districtBridgeStateView() };
    }
    return {
      ok: false,
      code: cleanText(runtimeResult.code) || "runtime_unavailable",
      view: districtBridgeStateView(),
    };
  }
  return { ok: false, code: "runtime_unavailable", view: districtBridgeStateView() };
}

function districtBridgeTriggerCensusAction(action){
  const runtimeResult = districtBridgeCallCensusRuntime("triggerAction", action);
  if (runtimeResult && typeof runtimeResult === "object"){
    if (runtimeResult.ok === true){
      return { ok: true, code: "triggered_runtime", view: districtBridgeStateView() };
    }
    return {
      ok: false,
      code: cleanText(runtimeResult.code) || "runtime_unavailable",
      view: districtBridgeStateView(),
    };
  }
  return { ok: false, code: "runtime_unavailable", view: districtBridgeStateView() };
}

const REACH_OVERRIDE_MODE_OPTIONS = [
  { value: "baseline", label: "Baseline (manual)" },
  { value: "ramp", label: "Ramp projection" },
  { value: "scheduled", label: "Scheduled attempts" },
  { value: "max", label: "Max(ramp, scheduled)" },
];
const REACH_FIELD_RULES = {
  persuasionPct: { min: 0, max: 100, step: 0.1 },
  earlyVoteExp: { min: 0, max: 100, step: 0.1 },
  supportRatePct: { min: 0, max: 100, step: 0.1 },
  contactRatePct: { min: 0, max: 100, step: 0.1 },
  goalSupportIds: { min: 0, max: 10000000, step: 1 },
  hoursPerShift: { min: 0, max: 24, step: 0.5 },
  shiftsPerVolunteerPerWeek: { min: 0, max: 21, step: 0.5 },
};
const REACH_NUMERIC_FIELDS = new Set(Object.keys(REACH_FIELD_RULES));
let reachBridgeDailyLogImportMsg = "";
let reachBridgeApplyMsg = "";
let reachBridgeCachedLevers = [];
let reachBridgeCachedContext = null;

function reachBridgeFmtInt(value, { ceil = false } = {}){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatWholeNumberByMode(n, { mode: ceil ? "ceil" : "round", fallback: "—" });
}

function reachBridgeFmtSignedInt(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) || 0;
  if (rounded > 0) return `+${fmtInt(rounded)}`;
  return `${fmtInt(rounded)}`;
}

function reachBridgeFmtPctFromRatio(value, digits = 1){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatPercentFromUnit(n, digits, "—");
}

function reachBridgeFmtNum1(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatFixedNumber(n, 1, "—");
}

function reachBridgeFmtISODate(raw){
  try{
    const dt = (raw instanceof Date) ? raw : new Date(raw);
    if (!Number.isFinite(dt.getTime())) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return "—";
  }
}

function reachBridgeClampNumber(raw, { min = null, max = null, step = null } = {}){
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  let out = n;
  if (min != null) out = Math.max(min, out);
  if (max != null) out = Math.min(max, out);
  if (step != null && Number.isFinite(step) && step > 0){
    const stepRounded = roundWholeNumberByMode(out / step, { mode: "round", fallback: 0 }) || 0;
    out = stepRounded * step;
  }
  return out;
}

function reachBridgeResolveContext(){
  const renderCtx = lastRenderCtx || {};
  const currentState = state || {};
  const res = renderCtx?.res || null;
  const weeks = Number.isFinite(renderCtx?.weeks) ? renderCtx.weeks : null;
  const weeklyContext = renderCtx?.weeklyContext || ((res && Number.isFinite(weeks)) ? computeWeeklyOpsContext(res, weeks) : null);

  let executionSnapshot = renderCtx?.executionSnapshot || null;
  if (!executionSnapshot && weeklyContext){
    const expectedAPH = (
      weeklyContext?.doorShare != null &&
      weeklyContext?.doorsPerHour != null &&
      weeklyContext?.callsPerHour != null
    )
      ? (weeklyContext.doorShare * weeklyContext.doorsPerHour + (1 - weeklyContext.doorShare) * weeklyContext.callsPerHour)
      : null;
    try{
      executionSnapshot = computeExecutionSnapshot({
        planningSnapshot: { weeks },
        weeklyContext,
        dailyLog: currentState?.ui?.dailyLog || [],
        assumedCR: weeklyContext?.cr ?? null,
        assumedSR: weeklyContext?.sr ?? null,
        expectedAPH,
        windowN: 7,
        safeNumFn: safeNum,
      });
    } catch {
      executionSnapshot = null;
    }
  }

  return {
    state: currentState,
    res,
    weeks,
    weeklyContext,
    executionSnapshot,
  };
}

function reachBridgeComputeWeeklyView(weeklyContext, executionSnapshot){
  const ctx = weeklyContext || {};
  const formatInt = (value, options = {}) => {
    if (!Number.isFinite(Number(value))) return "—";
    const mode = options?.ceil ? "ceil" : (options?.floor ? "floor" : "round");
    const n = roundWholeNumberByMode(Number(value), { mode, fallback: 0 }) || 0;
    return reachBridgeFmtInt(n);
  };
  const constraintView = buildReachWeeklyConstraintView(ctx, { formatInt });
  const weeklyExecution = buildReachWeeklyExecutionView({
    ctx,
    logSummary: executionSnapshot?.log || null,
    rollingCR: executionSnapshot?.rolling?.cr,
    formatInt,
    formatDate: reachBridgeFmtISODate,
    clampFn: clamp,
    hideChannelBreakdownWithoutLog: false,
  });

  return {
    goal: reachBridgeFmtInt(ctx?.goal ?? null),
    requiredAttempts: weeklyExecution.requiredAttemptsText,
    requiredConvos: weeklyExecution.requiredConvosText,
    requiredDoors: weeklyExecution.requiredDoorAttemptsText,
    requiredCalls: weeklyExecution.requiredCallAttemptsText,
    impliedConvos: weeklyExecution.impliedConvosText,
    impliedConvosNote: weeklyExecution.impliedConvosNote,
    capacity: reachBridgeFmtInt(ctx?.capTotal, { ceil: true }),
    gap: constraintView.gapText,
    constraint: constraintView.constraint,
    constraintNote: constraintView.constraintNote,
    paceStatus: weeklyExecution.paceStatus,
    paceNote: weeklyExecution.paceNote,
    finishConvos: weeklyExecution.finishConvosText,
    finishAttempts: weeklyExecution.finishAttemptsText,
    actualConvosNote: weeklyExecution.actualConvosNote,
    wkBanner: constraintView.wkBanner,
    wkExecBanner: weeklyExecution.wkExecBanner,
  };
}

function reachBridgeComputeFreshnessView(currentState, weeklyContext, executionSnapshot){
  return buildReachFreshnessView({
    state: currentState,
    weeklyContext,
    executionSnapshot,
    safeNumFn: safeNum,
    formatInt: (value, options = {}) => {
      if (!Number.isFinite(Number(value))) return "—";
      const mode = options?.ceil ? "ceil" : (options?.floor ? "floor" : "round");
      const n = roundWholeNumberByMode(Number(value), { mode, fallback: 0 }) || 0;
      return reachBridgeFmtInt(n);
    },
    formatPct: (value) => reachBridgeFmtPctFromRatio(value),
    formatNum1: (value) => reachBridgeFmtNum1(value),
  });
}

function reachBridgeBuildLeversAndActions(weeklyContext, executionSnapshot){
  return buildReachLeversAndActionsView({
    weeklyContext: weeklyContext || {},
    executionSnapshot,
    computeCapacityBreakdownFn: (payload) => coreComputeCapacityBreakdown(payload),
    clampFn: clamp,
    computeRealityDriftFn: () => computeRealityDrift(),
    formatInt: (value, options = {}) => {
      if (!Number.isFinite(Number(value))) return "—";
      const mode = options?.ceil ? "ceil" : (options?.floor ? "floor" : "round");
      const n = roundWholeNumberByMode(Number(value), { mode, fallback: 0 }) || 0;
      return reachBridgeFmtInt(n);
    },
    formatNum1: (value) => reachBridgeFmtNum1(value),
  });
}

function reachBridgeStateView(){
  const { state: currentState, weeklyContext, executionSnapshot } = reachBridgeResolveContext();
  const weekly = reachBridgeComputeWeeklyView(weeklyContext, executionSnapshot);
  const freshness = reachBridgeComputeFreshnessView(currentState, weeklyContext, executionSnapshot);
  const leversAndActions = reachBridgeBuildLeversAndActions(weeklyContext, executionSnapshot);
  const outlookRaw = (currentState?.ui && typeof currentState.ui === "object")
    ? (currentState.ui.twCapOutlookLatest || null)
    : null;

  const locked = isScenarioLockedForEdits(currentState);
  const overrideEnabled = !!currentState?.twCapOverrideEnabled;
  const summary = {
    goal: weekly.goal,
    requiredAttempts: weekly.requiredAttempts,
    capacity: weekly.capacity,
    gap: weekly.gap,
    constraint: weekly.constraint,
    pace: weekly.paceStatus,
  };

  const leversById = [];
  leversAndActions.bestMoves.forEach((row) => {
    leversById.push({
      id: row.id,
      lever: row.lever,
    });
  });
  leversAndActions.rows.forEach((row) => {
    leversById.push({
      id: row.id,
      lever: row.lever,
    });
  });
  reachBridgeCachedLevers = leversById;
  reachBridgeCachedContext = weeklyContext || null;

  return {
    inputs: {
      persuasionPct: currentState?.persuasionPct ?? "",
      earlyVoteExp: currentState?.earlyVoteExp ?? "",
      supportRatePct: currentState?.supportRatePct ?? "",
      contactRatePct: currentState?.contactRatePct ?? "",
      goalSupportIds: currentState?.goalSupportIds ?? "",
      hoursPerShift: currentState?.hoursPerShift ?? "",
      shiftsPerVolunteerPerWeek: currentState?.shiftsPerVolunteerPerWeek ?? "",
      twCapOverrideEnabled: overrideEnabled,
      twCapOverrideMode: currentState?.twCapOverrideMode || "baseline",
      twCapOverrideHorizonWeeks: currentState?.twCapOverrideHorizonWeeks ?? "",
      dailyLogImportText: currentState?.ui?.dailyLogImportText || "",
    },
    controls: {
      locked,
      twCapOverrideModeDisabled: locked || !overrideEnabled,
      twCapOverrideHorizonWeeksDisabled: locked || !overrideEnabled,
      undoDisabled: !lastAppliedWeeklyAction,
    },
    options: {
      twCapOverrideMode: REACH_OVERRIDE_MODE_OPTIONS,
    },
    weekly,
    summary,
    freshness: {
      ...freshness,
      dailyLogImportMsg: reachBridgeDailyLogImportMsg || "",
      applyRollingMsg: reachBridgeApplyMsg || "",
      undoActionMsg: lastAppliedWeeklyAction?.label || "",
    },
    levers: {
      intro: leversAndActions.intro,
      foot: leversAndActions.foot,
      bestMovesIntro: leversAndActions.bestMovesIntro,
      showBestMoves: leversAndActions.showBestMoves,
      bestMoves: leversAndActions.bestMoves.map((row) => ({
        id: row.id,
        text: row.text,
      })),
      rows: leversAndActions.rows.map((row) => ({
        id: row.id,
        label: row.label,
        impact: row.impact,
        costUnit: row.costUnit,
        efficiency: row.efficiency,
      })),
    },
    actions: {
      list: leversAndActions.actions,
      note: leversAndActions.actionsNote,
    },
    outlook: {
      status: outlookRaw?.status || "No Operations data.",
      activeSource: outlookRaw?.activeSource || (overrideEnabled ? "Override ON · source unavailable" : "Override OFF"),
      baseline: outlookRaw?.baseline || "—",
      rampTotal: outlookRaw?.rampTotal || "—",
      scheduledTotal: outlookRaw?.scheduledTotal || "—",
      horizon: outlookRaw?.horizon || "—",
      interviewPass: outlookRaw?.interviewPass || "—",
      offerAccept: outlookRaw?.offerAccept || "—",
      onboardingCompletion: outlookRaw?.onboardingCompletion || "—",
      trainingCompletion: outlookRaw?.trainingCompletion || "—",
      compositeSignal: outlookRaw?.compositeSignal || "—",
      readyNow: outlookRaw?.readyNow || "—",
      readyPerWeek: outlookRaw?.readyPerWeek || "—",
      readyIn14d: outlookRaw?.readyIn14d || "—",
      medianReadyDays: outlookRaw?.medianReadyDays || "—",
      hintNote: outlookRaw?.hintNote || "Display-only diagnostics. Add interview/onboarding/training records to unlock hints.",
      basis: outlookRaw?.basis || "Override is OFF by default. When enabled, FPE capacity uses selected Operations source with automatic fallback to baseline if data is unavailable.",
      rows: Array.isArray(outlookRaw?.rows) ? outlookRaw.rows : [],
    },
  };
}

function reachBridgeSetField(field, rawValue){
  if (!field || !REACH_NUMERIC_FIELDS.has(field)){
    return { ok: false, code: "invalid_field", view: reachBridgeStateView() };
  }
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }

  const rules = REACH_FIELD_RULES[field] || {};
  const parsed = reachBridgeClampNumber(rawValue, rules);
  if (parsed === null){
    return { ok: false, code: "invalid_value", view: reachBridgeStateView() };
  }

  mutateState((next) => {
    next[field] = parsed;
  });
  markMcStale();
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeSetOverrideEnabled(enabled){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  mutateState((next) => {
    next.twCapOverrideEnabled = !!enabled;
  });
  markMcStale();
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeSetOverrideMode(mode){
  const nextMode = String(mode || "").trim().toLowerCase();
  if (!REACH_OVERRIDE_MODE_OPTIONS.some((opt) => opt.value === nextMode)){
    return { ok: false, code: "invalid_mode", view: reachBridgeStateView() };
  }
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  mutateState((next) => {
    next.twCapOverrideMode = nextMode;
  });
  markMcStale();
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeSetOverrideHorizon(rawValue){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  const parsed = reachBridgeClampNumber(rawValue, {
    min: 4,
    max: 52,
    step: 1,
  });
  if (parsed === null){
    return { ok: false, code: "invalid_value", view: reachBridgeStateView() };
  }
  mutateState((next) => {
    next.twCapOverrideHorizonWeeks = parsed;
  });
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeSetDailyLogImportText(value){
  const text = String(value ?? "");
  setState((next) => {
    if (!next.ui || typeof next.ui !== "object") next.ui = {};
    next.ui.dailyLogImportText = text;
  });
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeApplyRolling(kind){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  const drift = computeRealityDrift();
  if (!drift?.hasLog){
    reachBridgeApplyMsg = "No daily log yet";
    return { ok: false, code: "no_log", view: reachBridgeStateView() };
  }
  applyRollingRateToAssumption(kind);
  if (kind === "contact") reachBridgeApplyMsg = "Applied rolling contact-rate calibration.";
  else if (kind === "support") reachBridgeApplyMsg = "Applied rolling support-rate calibration.";
  else if (kind === "productivity") reachBridgeApplyMsg = "Applied rolling productivity calibration.";
  else reachBridgeApplyMsg = "Applied rolling calibration.";
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeApplyRollingAll(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  const drift = computeRealityDrift();
  if (!drift?.hasLog){
    reachBridgeApplyMsg = "No daily log yet";
    return { ok: false, code: "no_log", view: reachBridgeStateView() };
  }
  applyAllRollingCalibrations();
  reachBridgeApplyMsg = "Applied all rolling calibrations.";
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeImportDailyLog(raw){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  const text = String(raw ?? state?.ui?.dailyLogImportText ?? "").trim();
  if (!text){
    reachBridgeDailyLogImportMsg = "Paste JSON first";
    return { ok: false, code: "empty", view: reachBridgeStateView() };
  }
  let parsed = null;
  try{
    parsed = JSON.parse(text);
  } catch {
    reachBridgeDailyLogImportMsg = "Invalid JSON";
    return { ok: false, code: "invalid_json", view: reachBridgeStateView() };
  }
  const result = mergeDailyLogIntoState(parsed) || {};
  reachBridgeDailyLogImportMsg = String(result.msg || (result.ok ? "Imported." : "Import failed."));
  return { ok: !!result.ok, view: reachBridgeStateView() };
}

function reachBridgeExportDailyLog(){
  exportDailyLog();
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeUndoLastAction(){
  if (!lastAppliedWeeklyAction){
    reachBridgeApplyMsg = "No action to undo.";
    return { ok: false, code: "no_action", view: reachBridgeStateView() };
  }
  undoLastWeeklyAction();
  reachBridgeApplyMsg = "Undid last applied action.";
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeApplyLever(id){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  const targetId = String(id || "").trim();
  if (!targetId){
    return { ok: false, code: "missing_id", view: reachBridgeStateView() };
  }
  const match = reachBridgeCachedLevers.find((row) => row.id === targetId);
  if (!match?.lever){
    return { ok: false, code: "not_found", view: reachBridgeStateView() };
  }
  applyWeeklyLeverScenario(match.lever, reachBridgeCachedContext || null);
  reachBridgeApplyMsg = `Applied: ${match.lever.label}`;
  return { ok: true, view: reachBridgeStateView() };
}

function installReachBridge(){
  window[REACH_BRIDGE_KEY] = {
    getView: () => reachBridgeStateView(),
    setField: (field, value) => reachBridgeSetField(field, value),
    setOverrideEnabled: (enabled) => reachBridgeSetOverrideEnabled(enabled),
    setOverrideMode: (mode) => reachBridgeSetOverrideMode(mode),
    setOverrideHorizon: (value) => reachBridgeSetOverrideHorizon(value),
    setDailyLogImportText: (value) => reachBridgeSetDailyLogImportText(value),
    importDailyLog: (raw) => reachBridgeImportDailyLog(raw),
    exportDailyLog: () => reachBridgeExportDailyLog(),
    applyRolling: (kind) => reachBridgeApplyRolling(kind),
    applyRollingAll: () => reachBridgeApplyRollingAll(),
    undoLastAction: () => reachBridgeUndoLastAction(),
    applyLever: (id) => reachBridgeApplyLever(id),
  };
}

const TURNOUT_SELECT_OPTIONS = {
  gotvMode: [
    { value: "basic", label: "Basic (single lift)" },
    { value: "advanced", label: "Advanced (min/mode/max)" },
  ],
  tacticKind: [
    { value: "persuasion", label: "Persuasion" },
    { value: "gotv", label: "GOTV" },
    { value: "hybrid", label: "Hybrid" },
  ],
};

const TURNOUT_NUMERIC_RULES = {
  turnoutBaselinePct: { min: 0, max: 100, step: 0.5, allowBlank: true },
  turnoutTargetOverridePct: { min: 0, max: 100, step: 0.5, allowBlank: true },
  gotvLiftPP: { min: 0, max: 25, step: 0.1, allowBlank: true },
  gotvMaxLiftPP: { min: 0, max: 50, step: 0.5, allowBlank: true },
  gotvLiftMin: { min: 0, max: 25, step: 0.1, allowBlank: true },
  gotvLiftMode: { min: 0, max: 25, step: 0.1, allowBlank: true },
  gotvLiftMax: { min: 0, max: 25, step: 0.1, allowBlank: true },
  gotvMaxLiftPP2: { min: 0, max: 50, step: 0.5, allowBlank: true },
  roiDoorsCpa: { min: 0, max: 1000000, step: 0.01 },
  roiDoorsCr: { min: 0, max: 100, step: 0.1, allowBlank: true },
  roiDoorsSr: { min: 0, max: 100, step: 0.1, allowBlank: true },
  roiPhonesCpa: { min: 0, max: 1000000, step: 0.01 },
  roiPhonesCr: { min: 0, max: 100, step: 0.1, allowBlank: true },
  roiPhonesSr: { min: 0, max: 100, step: 0.1, allowBlank: true },
  roiTextsCpa: { min: 0, max: 1000000, step: 0.01 },
  roiTextsCr: { min: 0, max: 100, step: 0.1, allowBlank: true },
  roiTextsSr: { min: 0, max: 100, step: 0.1, allowBlank: true },
  roiOverheadAmount: { min: 0, max: 1000000000, step: 1 },
};

const TURNOUT_BOOLEAN_FIELDS = new Set([
  "turnoutEnabled",
  "gotvDiminishing",
  "roiDoorsEnabled",
  "roiPhonesEnabled",
  "roiTextsEnabled",
  "roiIncludeOverhead",
]);

const TURNOUT_SELECT_FIELDS = new Set([
  "gotvMode",
  "roiDoorsKind",
  "roiPhonesKind",
  "roiTextsKind",
]);

const TURNOUT_NUMERIC_FIELDS = new Set(Object.keys(TURNOUT_NUMERIC_RULES));

function ensureTurnoutBridgeShape(target){
  if (!target || typeof target !== "object"){
    return;
  }
  if (!target.budget || typeof target.budget !== "object"){
    target.budget = {};
  }
  if (!target.budget.tactics || typeof target.budget.tactics !== "object"){
    target.budget.tactics = {};
  }
  const tactics = target.budget.tactics;
  if (!tactics.doors || typeof tactics.doors !== "object"){
    tactics.doors = { enabled: true, cpa: 0.18, kind: "persuasion" };
  }
  if (!tactics.phones || typeof tactics.phones !== "object"){
    tactics.phones = { enabled: true, cpa: 0.03, kind: "persuasion" };
  }
  if (!tactics.texts || typeof tactics.texts !== "object"){
    tactics.texts = { enabled: false, cpa: 0.02, kind: "persuasion" };
  }
  if (typeof target.turnoutEnabled !== "boolean") target.turnoutEnabled = false;
  if (!Number.isFinite(Number(target.turnoutBaselinePct))) target.turnoutBaselinePct = 55;
  if (target.turnoutTargetOverridePct == null) target.turnoutTargetOverridePct = "";
  if (!target.gotvMode) target.gotvMode = "basic";
  if (!Number.isFinite(Number(target.gotvLiftPP))) target.gotvLiftPP = 1.0;
  if (!Number.isFinite(Number(target.gotvMaxLiftPP))) target.gotvMaxLiftPP = 10;
  if (typeof target.gotvDiminishing !== "boolean") target.gotvDiminishing = false;
  if (!Number.isFinite(Number(target.gotvLiftMin))) target.gotvLiftMin = 0.5;
  if (!Number.isFinite(Number(target.gotvLiftMode))) target.gotvLiftMode = 1.0;
  if (!Number.isFinite(Number(target.gotvLiftMax))) target.gotvLiftMax = 2.0;
  if (!Number.isFinite(Number(target.gotvMaxLiftPP2))) target.gotvMaxLiftPP2 = 10;
  if (typeof target.budget.includeOverhead !== "boolean") target.budget.includeOverhead = false;
  if (!Number.isFinite(Number(target.budget.overheadAmount))) target.budget.overheadAmount = 0;
  target.gotvMode = normalizeBridgeSelectValue(target.gotvMode, TURNOUT_SELECT_OPTIONS.gotvMode, "basic");
  tactics.doors.kind = normalizeBridgeSelectValue(tactics?.doors?.kind, TURNOUT_SELECT_OPTIONS.tacticKind, "persuasion");
  tactics.phones.kind = normalizeBridgeSelectValue(tactics?.phones?.kind, TURNOUT_SELECT_OPTIONS.tacticKind, "persuasion");
  tactics.texts.kind = normalizeBridgeSelectValue(tactics?.texts?.kind, TURNOUT_SELECT_OPTIONS.tacticKind, "persuasion");
}

function turnoutBridgeStateView(){
  ensureTurnoutBridgeShape(state);
  const tactics = state?.budget?.tactics || {};
  const doors = tactics?.doors || {};
  const phones = tactics?.phones || {};
  const texts = tactics?.texts || {};
  const roiRowsRaw = Array.isArray(state?.ui?.lastRoiRows) ? state.ui.lastRoiRows : [];
  const roiRows = roiRowsRaw.map((row) => ({
    label: String(row?.label || ""),
    cpa: safeNum(row?.cpa),
    costPerNetVote: safeNum(row?.costPerNetVote),
    costPerTurnoutAdjustedNetVote: safeNum(row?.costPerTurnoutAdjustedNetVote),
    totalCost: safeNum(row?.totalCost),
    feasibilityText: String(row?.feasibilityText || ""),
  }));
  const roiBannerText = String(state?.ui?.lastRoiBanner?.text || "").trim();
  const turnoutSummary = state?.ui?.lastTurnout && typeof state.ui.lastTurnout === "object"
    ? state.ui.lastTurnout
    : {};
  const locked = isScenarioLockedForEdits(state);
  const gotvModeOptions = normalizeBridgeSelectOptions(TURNOUT_SELECT_OPTIONS.gotvMode);
  const tacticKindOptions = normalizeBridgeSelectOptions(TURNOUT_SELECT_OPTIONS.tacticKind);
  const gotvMode = normalizeBridgeSelectValue(state?.gotvMode, gotvModeOptions, "basic");
  const roiDoorsKind = normalizeBridgeSelectValue(doors?.kind, tacticKindOptions, "persuasion");
  const roiPhonesKind = normalizeBridgeSelectValue(phones?.kind, tacticKindOptions, "persuasion");
  const roiTextsKind = normalizeBridgeSelectValue(texts?.kind, tacticKindOptions, "persuasion");
  return {
    inputs: {
      turnoutEnabled: !!state.turnoutEnabled,
      turnoutBaselinePct: state.turnoutBaselinePct ?? "",
      turnoutTargetOverridePct: state.turnoutTargetOverridePct ?? "",
      gotvMode,
      gotvDiminishing: !!state.gotvDiminishing,
      gotvLiftPP: state.gotvLiftPP ?? "",
      gotvMaxLiftPP: state.gotvMaxLiftPP ?? "",
      gotvLiftMin: state.gotvLiftMin ?? "",
      gotvLiftMode: state.gotvLiftMode ?? "",
      gotvLiftMax: state.gotvLiftMax ?? "",
      gotvMaxLiftPP2: state.gotvMaxLiftPP2 ?? "",
      roiDoorsEnabled: !!doors.enabled,
      roiDoorsCpa: doors.cpa ?? "",
      roiDoorsKind,
      roiDoorsCr: doors.crPct ?? "",
      roiDoorsSr: doors.srPct ?? "",
      roiPhonesEnabled: !!phones.enabled,
      roiPhonesCpa: phones.cpa ?? "",
      roiPhonesKind,
      roiPhonesCr: phones.crPct ?? "",
      roiPhonesSr: phones.srPct ?? "",
      roiTextsEnabled: !!texts.enabled,
      roiTextsCpa: texts.cpa ?? "",
      roiTextsKind,
      roiTextsCr: texts.crPct ?? "",
      roiTextsSr: texts.srPct ?? "",
      roiOverheadAmount: state?.budget?.overheadAmount ?? "",
      roiIncludeOverhead: !!state?.budget?.includeOverhead,
    },
    controls: {
      locked,
      refreshDisabled: false,
    },
    options: {
      gotvMode: bridgeSelectOptionsWithSelected(gotvModeOptions, gotvMode),
      tacticKind: bridgeSelectOptionsWithSelected(tacticKindOptions, roiDoorsKind),
    },
    roiRows,
    roiBannerText,
    summary: {
      turnoutSummaryText: String(turnoutSummary.summaryText || "").trim(),
      turnoutVotesText: String(turnoutSummary.turnoutVotesText || "").trim(),
      needVotesText: String(turnoutSummary.needVotesText || "").trim(),
    },
  };
}

function turnoutBridgeNormalizeSelect(field, rawValue){
  const text = String(rawValue ?? "").trim();
  if (!text){
    return { ok: false, value: "", code: "invalid_value" };
  }
  if (field === "gotvMode"){
    const ok = TURNOUT_SELECT_OPTIONS.gotvMode.some((opt) => String(opt?.value ?? "") === text);
    return ok ? { ok: true, value: text, code: "" } : { ok: false, value: "", code: "invalid_value" };
  }
  if (field === "roiDoorsKind" || field === "roiPhonesKind" || field === "roiTextsKind"){
    const ok = TURNOUT_SELECT_OPTIONS.tacticKind.some((opt) => String(opt?.value ?? "") === text);
    return ok ? { ok: true, value: text, code: "" } : { ok: false, value: "", code: "invalid_value" };
  }
  return { ok: false, value: "", code: "invalid_field" };
}

function turnoutBridgeNormalizeNumber(field, rawValue){
  const rules = TURNOUT_NUMERIC_RULES[field] || {};
  const parsed = reachBridgeClampNumber(rawValue, {
    min: rules.min,
    max: rules.max,
    step: rules.step,
  });
  if (parsed === null){
    return { ok: false, value: null, code: "invalid_value" };
  }
  if ((parsed === "" || parsed == null) && rules.allowBlank){
    return { ok: true, value: "", code: "" };
  }
  return { ok: true, value: parsed, code: "" };
}

function turnoutBridgeSetField(field, rawValue){
  const key = String(field || "").trim();
  if (!key){
    return { ok: false, code: "invalid_field", view: turnoutBridgeStateView() };
  }
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: turnoutBridgeStateView() };
  }

  let mode = "none";
  if (TURNOUT_BOOLEAN_FIELDS.has(key)) mode = "boolean";
  else if (TURNOUT_SELECT_FIELDS.has(key)) mode = "select";
  else if (TURNOUT_NUMERIC_FIELDS.has(key)) mode = "numeric";
  if (mode === "none"){
    return { ok: false, code: "invalid_field", view: turnoutBridgeStateView() };
  }

  if (mode === "select"){
    const normalized = turnoutBridgeNormalizeSelect(key, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: turnoutBridgeStateView() };
    }
    mutateState((next) => {
      ensureTurnoutBridgeShape(next);
      if (key === "gotvMode"){
        next.gotvMode = normalized.value;
      } else if (key === "roiDoorsKind"){
        next.budget.tactics.doors.kind = normalized.value;
      } else if (key === "roiPhonesKind"){
        next.budget.tactics.phones.kind = normalized.value;
      } else if (key === "roiTextsKind"){
        next.budget.tactics.texts.kind = normalized.value;
      }
    });
    if (key === "gotvMode"){
      syncGotvModeUI();
    }
    markMcStale();
    return { ok: true, view: turnoutBridgeStateView() };
  }

  if (mode === "boolean"){
    const checked = !!rawValue;
    mutateState((next) => {
      ensureTurnoutBridgeShape(next);
      if (key === "turnoutEnabled"){
        next.turnoutEnabled = checked;
      } else if (key === "gotvDiminishing"){
        next.gotvDiminishing = checked;
      } else if (key === "roiDoorsEnabled"){
        next.budget.tactics.doors.enabled = checked;
      } else if (key === "roiPhonesEnabled"){
        next.budget.tactics.phones.enabled = checked;
      } else if (key === "roiTextsEnabled"){
        next.budget.tactics.texts.enabled = checked;
      } else if (key === "roiIncludeOverhead"){
        next.budget.includeOverhead = checked;
      }
    });
    markMcStale();
    return { ok: true, view: turnoutBridgeStateView() };
  }

  const normalized = turnoutBridgeNormalizeNumber(key, rawValue);
  if (!normalized.ok){
    return { ok: false, code: normalized.code, view: turnoutBridgeStateView() };
  }
  mutateState((next) => {
    ensureTurnoutBridgeShape(next);
    const value = normalized.value;
    if (key === "turnoutBaselinePct"){
      next.turnoutBaselinePct = safeNum(value);
    } else if (key === "turnoutTargetOverridePct"){
      next.turnoutTargetOverridePct = value === "" ? "" : String(value);
    } else if (key === "gotvLiftPP"){
      next.gotvLiftPP = safeNum(value);
    } else if (key === "gotvMaxLiftPP"){
      next.gotvMaxLiftPP = safeNum(value);
    } else if (key === "gotvLiftMin"){
      next.gotvLiftMin = safeNum(value);
    } else if (key === "gotvLiftMode"){
      next.gotvLiftMode = safeNum(value);
    } else if (key === "gotvLiftMax"){
      next.gotvLiftMax = safeNum(value);
    } else if (key === "gotvMaxLiftPP2"){
      next.gotvMaxLiftPP2 = safeNum(value);
    } else if (key === "roiDoorsCpa"){
      next.budget.tactics.doors.cpa = safeNum(value) ?? 0;
    } else if (key === "roiDoorsCr"){
      next.budget.tactics.doors.crPct = safeNum(value);
    } else if (key === "roiDoorsSr"){
      next.budget.tactics.doors.srPct = safeNum(value);
    } else if (key === "roiPhonesCpa"){
      next.budget.tactics.phones.cpa = safeNum(value) ?? 0;
    } else if (key === "roiPhonesCr"){
      next.budget.tactics.phones.crPct = safeNum(value);
    } else if (key === "roiPhonesSr"){
      next.budget.tactics.phones.srPct = safeNum(value);
    } else if (key === "roiTextsCpa"){
      next.budget.tactics.texts.cpa = safeNum(value) ?? 0;
    } else if (key === "roiTextsCr"){
      next.budget.tactics.texts.crPct = safeNum(value);
    } else if (key === "roiTextsSr"){
      next.budget.tactics.texts.srPct = safeNum(value);
    } else if (key === "roiOverheadAmount"){
      next.budget.overheadAmount = safeNum(value) ?? 0;
    }
  });
  markMcStale();
  return { ok: true, view: turnoutBridgeStateView() };
}

function turnoutBridgeRefreshRoi(){
  render();
  return { ok: true, view: turnoutBridgeStateView() };
}

function installTurnoutBridge(){
  window[TURNOUT_BRIDGE_KEY] = {
    getView: () => turnoutBridgeStateView(),
    setField: (field, value) => turnoutBridgeSetField(field, value),
    refreshRoi: () => turnoutBridgeRefreshRoi(),
  };
}

const PLAN_SELECT_OPTIONS = {
  optMode: [
    { value: "budget", label: "Budget-constrained" },
    { value: "capacity", label: "Capacity-constrained" },
  ],
  optObjective: OPTIMIZATION_OBJECTIVES.map((row) => ({
    value: String(row.value),
    label: String(row.label),
  })),
  tlOptObjective: [
    { value: "max_net", label: "Maximize net votes by deadline" },
    { value: "min_cost_goal", label: "Minimize cost while meeting goal (if feasible)" },
  ],
  timelineRampMode: [
    { value: "linear", label: "Linear" },
    { value: "s", label: "S-curve" },
  ],
};

const PLAN_NUMERIC_RULES = {
  optBudget: { min: 0, max: 1000000000, step: 1 },
  optStep: { min: 1, max: 1000000, step: 1 },
  timelineActiveWeeks: { min: 0, max: 520, step: 1, allowBlank: true },
  timelineGotvWeeks: { min: 0, max: 52, step: 1, allowBlank: true },
  timelineStaffCount: { min: 0, max: 10000, step: 1 },
  timelineStaffHours: { min: 0, max: 168, step: 1 },
  timelineVolCount: { min: 0, max: 100000, step: 1 },
  timelineVolHours: { min: 0, max: 168, step: 1 },
  timelineDoorsPerHour: { min: 0, max: 1000, step: 1 },
  timelineCallsPerHour: { min: 0, max: 1000, step: 1 },
  timelineTextsPerHour: { min: 0, max: 5000, step: 1 },
};

const PLAN_BOOLEAN_FIELDS = new Set([
  "tlOptEnabled",
  "optUseDecay",
  "timelineEnabled",
  "timelineRampEnabled",
]);

const PLAN_SELECT_FIELDS = new Set([
  "optMode",
  "optObjective",
  "tlOptObjective",
  "timelineRampMode",
]);

const PLAN_NUMERIC_FIELDS = new Set(Object.keys(PLAN_NUMERIC_RULES));

function ensurePlanBridgeShape(target){
  if (!target || typeof target !== "object"){
    return;
  }
  if (!target.budget || typeof target.budget !== "object"){
    target.budget = {};
  }
  if (!target.budget.optimize || typeof target.budget.optimize !== "object"){
    target.budget.optimize = {};
  }
  const optimize = target.budget.optimize;
  optimize.mode = normalizeBridgeSelectValue(optimize.mode, PLAN_SELECT_OPTIONS.optMode, "budget");
  optimize.objective = normalizeBridgeSelectValue(
    normalizeOptimizationObjective(optimize.objective, "net"),
    PLAN_SELECT_OPTIONS.optObjective,
    "net",
  );
  if (typeof optimize.tlConstrainedEnabled !== "boolean") optimize.tlConstrainedEnabled = false;
  optimize.tlConstrainedObjective = normalizeBridgeSelectValue(
    optimize.tlConstrainedObjective,
    PLAN_SELECT_OPTIONS.tlOptObjective,
    "max_net",
  );
  if (!Number.isFinite(Number(optimize.budgetAmount))) optimize.budgetAmount = 10000;
  if (!Number.isFinite(Number(optimize.step))) optimize.step = 25;
  if (typeof optimize.useDecay !== "boolean") optimize.useDecay = false;
  if (typeof target.timelineEnabled !== "boolean") target.timelineEnabled = false;
  if (target.timelineActiveWeeks == null) target.timelineActiveWeeks = "";
  if (target.timelineGotvWeeks == null) target.timelineGotvWeeks = "";
  if (!Number.isFinite(Number(target.timelineStaffCount))) target.timelineStaffCount = 0;
  if (!Number.isFinite(Number(target.timelineStaffHours))) target.timelineStaffHours = 0;
  if (!Number.isFinite(Number(target.timelineVolCount))) target.timelineVolCount = 0;
  if (!Number.isFinite(Number(target.timelineVolHours))) target.timelineVolHours = 0;
  if (typeof target.timelineRampEnabled !== "boolean") target.timelineRampEnabled = false;
  target.timelineRampMode = normalizeBridgeSelectValue(target.timelineRampMode, PLAN_SELECT_OPTIONS.timelineRampMode, "linear");
  if (!Number.isFinite(Number(target.timelineDoorsPerHour))) target.timelineDoorsPerHour = 30;
  if (!Number.isFinite(Number(target.timelineCallsPerHour))) target.timelineCallsPerHour = 20;
  if (!Number.isFinite(Number(target.timelineTextsPerHour))) target.timelineTextsPerHour = 120;
}

function planBridgeBuildSummaryView(){
  const objectiveCopy = getOptimizationObjectiveCopy(state?.budget?.optimize?.objective, "net");
  const conversion = state?.ui?.lastConversion && typeof state.ui.lastConversion === "object"
    ? state.ui.lastConversion
    : {};
  const timeline = state?.ui?.lastTimeline && typeof state.ui.lastTimeline === "object"
    ? state.ui.lastTimeline
    : {};
  const timelineObjectiveMeta = getTimelineFeasibilityObjectiveMeta(timeline);
  const tlMeta = state?.ui?.lastTlMeta && typeof state.ui.lastTlMeta === "object"
    ? state.ui.lastTlMeta
    : {};
  const tlObjectiveMeta = getTimelineObjectiveMeta(tlMeta);
  const lastSummary = state?.ui?.lastSummary && typeof state.ui.lastSummary === "object"
    ? state.ui.lastSummary
    : {};
  const upliftSummary = lastSummary?.upliftSummary && typeof lastSummary.upliftSummary === "object"
    ? lastSummary.upliftSummary
    : {};
  const lastOptTotals = state?.ui?.lastOpt?.totals && typeof state.ui.lastOpt.totals === "object"
    ? state.ui.lastOpt.totals
    : {};
  const lastOpt = state?.ui?.lastOpt && typeof state.ui.lastOpt === "object"
    ? state.ui.lastOpt
    : {};
  const diagnostics = state?.ui?.lastDiagnostics && typeof state.ui.lastDiagnostics === "object"
    ? state.ui.lastDiagnostics
    : {};
  return buildCanonicalPlanSummaryView({
    objectiveCopy,
    conversion,
    timeline,
    timelineObjectiveMeta,
    tlMeta,
    tlObjectiveMeta,
    lastSummary,
    upliftSummary,
    lastOptTotals,
    lastOpt,
    diagnostics,
    formatInt: (value) => formatWholeNumberByMode(value, { mode: "round", fallback: "—" }),
    formatWhole: formatPlanWhole,
    formatCurrency: formatPlanCurrency,
    formatPercentUnit: formatPlanPercentUnit,
  });
}

function planBridgeStateView(){
  ensurePlanBridgeShape(state);
  const optimize = state?.budget?.optimize || {};
  const optimizerRowsRaw = Array.isArray(state?.ui?.lastPlanRows) ? state.ui.lastPlanRows : [];
  const optimizerRows = normalizePlanOptimizerRows(optimizerRowsRaw);
  const locked = isScenarioLockedForEdits(state);
  const optModeOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.optMode);
  const optObjectiveOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.optObjective);
  const tlOptObjectiveOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.tlOptObjective);
  const timelineRampModeOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.timelineRampMode);
  const optMode = normalizeBridgeSelectValue(optimize?.mode, optModeOptions, "budget");
  const optObjective = normalizeBridgeSelectValue(optimize?.objective, optObjectiveOptions, "net");
  const tlOptObjective = normalizeBridgeSelectValue(optimize?.tlConstrainedObjective, tlOptObjectiveOptions, "max_net");
  const timelineRampMode = normalizeBridgeSelectValue(state?.timelineRampMode, timelineRampModeOptions, "linear");
  return {
    inputs: {
      optMode,
      optObjective,
      tlOptEnabled: !!optimize.tlConstrainedEnabled,
      tlOptObjective,
      optBudget: optimize.budgetAmount ?? "",
      optStep: optimize.step ?? "",
      optUseDecay: !!optimize.useDecay,
      timelineEnabled: !!state.timelineEnabled,
      timelineActiveWeeks: state.timelineActiveWeeks ?? "",
      timelineGotvWeeks: state.timelineGotvWeeks ?? "",
      timelineStaffCount: state.timelineStaffCount ?? "",
      timelineStaffHours: state.timelineStaffHours ?? "",
      timelineVolCount: state.timelineVolCount ?? "",
      timelineVolHours: state.timelineVolHours ?? "",
      timelineRampEnabled: !!state.timelineRampEnabled,
      timelineRampMode,
      timelineDoorsPerHour: state.timelineDoorsPerHour ?? "",
      timelineCallsPerHour: state.timelineCallsPerHour ?? "",
      timelineTextsPerHour: state.timelineTextsPerHour ?? "",
    },
    controls: {
      locked,
      runDisabled: locked,
    },
    options: {
      optMode: bridgeSelectOptionsWithSelected(optModeOptions, optMode),
      optObjective: bridgeSelectOptionsWithSelected(optObjectiveOptions, optObjective),
      tlOptObjective: bridgeSelectOptionsWithSelected(tlOptObjectiveOptions, tlOptObjective),
      timelineRampMode: bridgeSelectOptionsWithSelected(timelineRampModeOptions, timelineRampMode),
    },
    optimizerRows,
    summary: planBridgeBuildSummaryView(),
  };
}

function planBridgeNormalizeSelect(field, rawValue){
  const options = PLAN_SELECT_OPTIONS[field];
  const text = String(rawValue ?? "").trim();
  if (!Array.isArray(options) || !options.length){
    return { ok: false, value: "", code: "invalid_field" };
  }
  if (options.some((opt) => String(opt?.value ?? "") === text)){
    return { ok: true, value: text, code: "" };
  }
  return { ok: false, value: "", code: "invalid_value" };
}

function planBridgeNormalizeNumber(field, rawValue){
  const rules = PLAN_NUMERIC_RULES[field] || {};
  const parsed = reachBridgeClampNumber(rawValue, {
    min: rules.min,
    max: rules.max,
    step: rules.step,
  });
  if (parsed === null){
    return { ok: false, value: null, code: "invalid_value" };
  }
  if ((parsed === "" || parsed == null) && rules.allowBlank){
    return { ok: true, value: "", code: "" };
  }
  return { ok: true, value: parsed, code: "" };
}

function planBridgeSetField(field, rawValue){
  const key = String(field || "").trim();
  if (!key){
    return { ok: false, code: "invalid_field", view: planBridgeStateView() };
  }
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: planBridgeStateView() };
  }

  let mode = "none";
  if (PLAN_BOOLEAN_FIELDS.has(key)) mode = "boolean";
  else if (PLAN_SELECT_FIELDS.has(key)) mode = "select";
  else if (PLAN_NUMERIC_FIELDS.has(key)) mode = "numeric";
  if (mode === "none"){
    return { ok: false, code: "invalid_field", view: planBridgeStateView() };
  }

  if (mode === "select"){
    const normalized = planBridgeNormalizeSelect(key, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: planBridgeStateView() };
    }
    mutateState((next) => {
      ensurePlanBridgeShape(next);
      if (key === "optMode"){
        next.budget.optimize.mode = normalized.value;
      } else if (key === "optObjective"){
        next.budget.optimize.objective = normalized.value;
      } else if (key === "tlOptObjective"){
        next.budget.optimize.tlConstrainedObjective = normalized.value;
      } else if (key === "timelineRampMode"){
        next.timelineRampMode = normalized.value;
      }
    });
    return { ok: true, view: planBridgeStateView() };
  }

  if (mode === "boolean"){
    const checked = !!rawValue;
    mutateState((next) => {
      ensurePlanBridgeShape(next);
      if (key === "tlOptEnabled"){
        next.budget.optimize.tlConstrainedEnabled = checked;
      } else if (key === "optUseDecay"){
        next.budget.optimize.useDecay = checked;
      } else if (key === "timelineEnabled"){
        next.timelineEnabled = checked;
      } else if (key === "timelineRampEnabled"){
        next.timelineRampEnabled = checked;
      }
    });
    return { ok: true, view: planBridgeStateView() };
  }

  const normalized = planBridgeNormalizeNumber(key, rawValue);
  if (!normalized.ok){
    return { ok: false, code: normalized.code, view: planBridgeStateView() };
  }
  mutateState((next) => {
    ensurePlanBridgeShape(next);
    const value = normalized.value;
    if (key === "optBudget"){
      next.budget.optimize.budgetAmount = safeNum(value) ?? 0;
    } else if (key === "optStep"){
      next.budget.optimize.step = safeNum(value) ?? 25;
    } else if (key === "timelineActiveWeeks"){
      next.timelineActiveWeeks = value === "" ? "" : String(value);
    } else if (key === "timelineGotvWeeks"){
      next.timelineGotvWeeks = safeNum(value);
    } else if (key === "timelineStaffCount"){
      next.timelineStaffCount = safeNum(value) ?? 0;
    } else if (key === "timelineStaffHours"){
      next.timelineStaffHours = safeNum(value) ?? 0;
    } else if (key === "timelineVolCount"){
      next.timelineVolCount = safeNum(value) ?? 0;
    } else if (key === "timelineVolHours"){
      next.timelineVolHours = safeNum(value) ?? 0;
    } else if (key === "timelineDoorsPerHour"){
      next.timelineDoorsPerHour = safeNum(value) ?? 0;
    } else if (key === "timelineCallsPerHour"){
      next.timelineCallsPerHour = safeNum(value) ?? 0;
    } else if (key === "timelineTextsPerHour"){
      next.timelineTextsPerHour = safeNum(value) ?? 0;
    }
  });
  return { ok: true, view: planBridgeStateView() };
}

function planBridgeRunOptimize(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: planBridgeStateView() };
  }
  render();
  return { ok: true, view: planBridgeStateView() };
}

function installPlanBridge(){
  window[PLAN_BRIDGE_KEY] = {
    getView: () => planBridgeStateView(),
    setField: (field, value) => planBridgeSetField(field, value),
    runOptimize: () => planBridgeRunOptimize(),
  };
}

const OUTCOME_SELECT_OPTIONS = {
  mcMode: [
    { value: "basic", label: "Basic (volatility slider)" },
    { value: "advanced", label: "Advanced (min / mode / max)" },
  ],
  mcVolatility: [
    { value: "low", label: "Low" },
    { value: "med", label: "Medium" },
    { value: "high", label: "High" },
  ],
  surfaceLever: [
    { value: "volunteerMultiplier", label: "Volunteer multiplier" },
    { value: "supportRate", label: "Support rate (%)" },
    { value: "contactRate", label: "Contact rate (%)" },
    { value: "turnoutReliability", label: "Turnout reliability (%)" },
  ],
  surfaceMode: [
    { value: "fast", label: "Fast (2k runs)" },
    { value: "full", label: "Full (10k runs)" },
  ],
};

const OUTCOME_NUMERIC_RULES = {
  orgCount: { min: 0, max: 10000, step: 1, allowBlank: true },
  orgHoursPerWeek: { min: 0, max: 168, step: 1, allowBlank: true },
  volunteerMultBase: { min: 0, max: 20, step: 0.05, allowBlank: true },
  channelDoorPct: { min: 0, max: 100, step: 1, allowBlank: true },
  doorsPerHour3: { min: 0, max: 1000, step: 1, allowBlank: true },
  callsPerHour3: { min: 0, max: 1000, step: 1, allowBlank: true },
  turnoutReliabilityPct: { min: 0, max: 100, step: 0.5, allowBlank: true },
  mcContactMin: { min: 0, max: 100, step: 0.1, allowBlank: true },
  mcContactMode: { min: 0, max: 100, step: 0.1, allowBlank: true },
  mcContactMax: { min: 0, max: 100, step: 0.1, allowBlank: true },
  mcPersMin: { min: 0, max: 100, step: 0.1, allowBlank: true },
  mcPersMode: { min: 0, max: 100, step: 0.1, allowBlank: true },
  mcPersMax: { min: 0, max: 100, step: 0.1, allowBlank: true },
  mcReliMin: { min: 0, max: 100, step: 0.5, allowBlank: true },
  mcReliMode: { min: 0, max: 100, step: 0.5, allowBlank: true },
  mcReliMax: { min: 0, max: 100, step: 0.5, allowBlank: true },
  mcDphMin: { min: 0, max: 1000, step: 1, allowBlank: true },
  mcDphMode: { min: 0, max: 1000, step: 1, allowBlank: true },
  mcDphMax: { min: 0, max: 1000, step: 1, allowBlank: true },
  mcCphMin: { min: 0, max: 1000, step: 1, allowBlank: true },
  mcCphMode: { min: 0, max: 1000, step: 1, allowBlank: true },
  mcCphMax: { min: 0, max: 1000, step: 1, allowBlank: true },
  mcVolMin: { min: 0, max: 20, step: 0.05, allowBlank: true },
  mcVolMode: { min: 0, max: 20, step: 0.05, allowBlank: true },
  mcVolMax: { min: 0, max: 20, step: 0.05, allowBlank: true },
  surfaceMin: { min: -1000, max: 1000, step: 0.01, allowBlank: true },
  surfaceMax: { min: -1000, max: 1000, step: 0.01, allowBlank: true },
  surfaceSteps: { min: 5, max: 51, step: 1, allowBlank: true },
  surfaceTarget: { min: 50, max: 99, step: 1, allowBlank: true },
};

const OUTCOME_MODEL_SELECT_FIELDS = new Set(["mcMode", "mcVolatility"]);
const OUTCOME_SURFACE_SELECT_FIELDS = new Set(["surfaceLever", "surfaceMode"]);
const OUTCOME_TEXT_FIELDS = new Set(["mcSeed"]);
const OUTCOME_MODEL_NUMERIC_FIELDS = new Set([
  "orgCount",
  "orgHoursPerWeek",
  "volunteerMultBase",
  "channelDoorPct",
  "doorsPerHour3",
  "callsPerHour3",
  "turnoutReliabilityPct",
  "mcContactMin",
  "mcContactMode",
  "mcContactMax",
  "mcPersMin",
  "mcPersMode",
  "mcPersMax",
  "mcReliMin",
  "mcReliMode",
  "mcReliMax",
  "mcDphMin",
  "mcDphMode",
  "mcDphMax",
  "mcCphMin",
  "mcCphMode",
  "mcCphMax",
  "mcVolMin",
  "mcVolMode",
  "mcVolMax",
]);
const OUTCOME_SURFACE_NUMERIC_FIELDS = new Set([
  "surfaceMin",
  "surfaceMax",
  "surfaceSteps",
  "surfaceTarget",
]);
const OUTCOME_SURFACE_DEFAULTS = {
  surfaceLever: "volunteerMultiplier",
  surfaceMode: "fast",
  surfaceSteps: "21",
  surfaceTarget: "70",
};

function outcomeBridgeSelectId(field){
  if (field === "mcMode") return "mcMode";
  if (field === "mcVolatility") return "mcVolatility";
  if (field === "surfaceLever") return "surfaceLever";
  if (field === "surfaceMode") return "surfaceMode";
  return "";
}

function outcomeBridgeControlId(field){
  if (field === "surfaceLever") return "surfaceLever";
  if (field === "surfaceMode") return "surfaceMode";
  if (field === "surfaceMin") return "surfaceMin";
  if (field === "surfaceMax") return "surfaceMax";
  if (field === "surfaceSteps") return "surfaceSteps";
  if (field === "surfaceTarget") return "surfaceTarget";
  return "";
}

function outcomeBridgeReadSelectOptions(field){
  return normalizeBridgeSelectOptions(OUTCOME_SELECT_OPTIONS[field] || []);
}

function outcomeBridgeReadLegacyControlValue(field){
  const id = outcomeBridgeControlId(field);
  if (!id){
    return "";
  }
  const control = document.getElementById(id);
  if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLSelectElement)){
    return "";
  }
  return String(control.value ?? "");
}

function outcomeBridgeDefaultSelectValue(field, preferredValue = ""){
  const options = outcomeBridgeReadSelectOptions(field);
  const preferred = String(preferredValue || "").trim();
  if (preferred && options.some((row) => String(row?.value ?? "") === preferred)){
    return preferred;
  }
  const fallback = String(OUTCOME_SURFACE_DEFAULTS[field] || "").trim();
  if (fallback && options.some((row) => String(row?.value ?? "") === fallback)){
    return fallback;
  }
  return options.length ? String(options[0]?.value ?? "") : "";
}

function outcomeBridgeResolvedSurfaceInputs(){
  const storedInputs = (state?.ui && typeof state.ui === "object" && state.ui.outcomeSurfaceInputs && typeof state.ui.outcomeSurfaceInputs === "object")
    ? state.ui.outcomeSurfaceInputs
    : {};

  const rawLever = String(
    storedInputs.surfaceLever ??
    ""
  );
  const surfaceLever = outcomeBridgeDefaultSelectValue("surfaceLever", rawLever);
  const spec = surfaceLeverSpec(surfaceLever) || surfaceLeverSpec(OUTCOME_SURFACE_DEFAULTS.surfaceLever);

  const rawMode = String(
    storedInputs.surfaceMode ??
    ""
  );
  const surfaceMode = outcomeBridgeDefaultSelectValue("surfaceMode", rawMode);

  const base = spec ? surfaceBaselineValue(spec) : null;
  const defaultMin = spec
    ? surfaceClamp((base != null ? Number(base) * 0.8 : spec.clampLo), spec.clampLo, spec.clampHi)
    : "";
  const defaultMax = spec
    ? surfaceClamp((base != null ? Number(base) * 1.2 : spec.clampHi), spec.clampLo, spec.clampHi)
    : "";

  const rawMin = storedInputs.surfaceMin ?? "";
  const minNum = Number(rawMin);
  const surfaceMin = Number.isFinite(minNum) && spec
    ? String(surfaceClamp(minNum, spec.clampLo, spec.clampHi))
    : (defaultMin === "" ? "" : String(defaultMin));

  const rawMax = storedInputs.surfaceMax ?? "";
  const maxNum = Number(rawMax);
  const surfaceMax = Number.isFinite(maxNum) && spec
    ? String(surfaceClamp(maxNum, spec.clampLo, spec.clampHi))
    : (defaultMax === "" ? "" : String(defaultMax));

  const rawSteps = storedInputs.surfaceSteps ?? "";
  const stepsNum = roundWholeNumberByMode(Number(rawSteps), { mode: "floor", fallback: null });
  const surfaceSteps = Number.isFinite(stepsNum)
    ? String(Math.max(5, Math.min(51, stepsNum)))
    : String(OUTCOME_SURFACE_DEFAULTS.surfaceSteps);

  const rawTarget = storedInputs.surfaceTarget ?? "";
  const targetNum = Number(rawTarget);
  const surfaceTarget = Number.isFinite(targetNum)
    ? String(Math.max(50, Math.min(99, roundWholeNumberByMode(targetNum, { mode: "round", fallback: 0 }) || 0)))
    : String(OUTCOME_SURFACE_DEFAULTS.surfaceTarget);

  return {
    surfaceLever,
    surfaceMode,
    surfaceMin,
    surfaceMax,
    surfaceSteps,
    surfaceTarget,
  };
}

function outcomeBridgeSyncLegacyControl(field, value){
  const id = outcomeBridgeControlId(field);
  const control = id ? document.getElementById(id) : null;
  if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLSelectElement)){
    return;
  }
  const nextValue = value == null ? "" : String(value);
  if (String(control.value ?? "") === nextValue){
    return;
  }
  control.value = nextValue;
  if (control instanceof HTMLInputElement){
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function outcomeBridgeWriteSurfaceInputs(nextState, surfaceInputs){
  if (!nextState.ui || typeof nextState.ui !== "object"){
    nextState.ui = {};
  }
  if (!nextState.ui.outcomeSurfaceInputs || typeof nextState.ui.outcomeSurfaceInputs !== "object"){
    nextState.ui.outcomeSurfaceInputs = {};
  }
  const target = nextState.ui.outcomeSurfaceInputs;
  target.surfaceLever = String(surfaceInputs?.surfaceLever ?? "");
  target.surfaceMode = String(surfaceInputs?.surfaceMode ?? "");
  target.surfaceMin = String(surfaceInputs?.surfaceMin ?? "");
  target.surfaceMax = String(surfaceInputs?.surfaceMax ?? "");
  target.surfaceSteps = String(surfaceInputs?.surfaceSteps ?? "");
  target.surfaceTarget = String(surfaceInputs?.surfaceTarget ?? "");
}

function outcomeBridgeWriteSurfaceCache(nextState, { rows, statusText, summaryText } = {}){
  if (!nextState.ui || typeof nextState.ui !== "object"){
    nextState.ui = {};
  }
  nextState.ui.lastOutcomeSurfaceRows = Array.isArray(rows)
    ? rows.map((row) => ({
        leverValue: row?.leverValue ?? "",
        winProb: Number.isFinite(Number(row?.winProb)) ? Number(row.winProb) : null,
        p10: Number.isFinite(Number(row?.p10)) ? Number(row.p10) : null,
        p50: Number.isFinite(Number(row?.p50)) ? Number(row.p50) : null,
        p90: Number.isFinite(Number(row?.p90)) ? Number(row.p90) : null,
      }))
    : [];
  nextState.ui.lastOutcomeSurfaceStatus = String(statusText || "").trim();
  nextState.ui.lastOutcomeSurfaceSummary = String(summaryText || "").trim();
}

function outcomeBridgeSetSurfaceComputing(nextState, enabled){
  if (!nextState.ui || typeof nextState.ui !== "object"){
    nextState.ui = {};
  }
  nextState.ui.outcomeSurfaceComputing = !!enabled;
}

function outcomeBridgeNormalizeSelect(field, rawValue){
  const value = String(rawValue ?? "").trim();
  const options = outcomeBridgeReadSelectOptions(field);
  if (!value){
    return { ok: false, code: "invalid_value", value: "" };
  }
  const valid = options.some((row) => String(row?.value ?? "") === value);
  if (!valid){
    return { ok: false, code: "invalid_value", value: "" };
  }
  return { ok: true, code: "", value };
}

function outcomeBridgeNormalizeNumber(field, rawValue){
  const rules = OUTCOME_NUMERIC_RULES[field] || {};
  const parsed = reachBridgeClampNumber(rawValue, {
    min: rules.min,
    max: rules.max,
    step: rules.step,
  });
  if (parsed === null){
    return { ok: false, code: "invalid_value", value: null };
  }
  if ((parsed === "" || parsed == null) && rules.allowBlank){
    return { ok: true, code: "", value: "" };
  }
  return { ok: true, code: "", value: parsed };
}

function outcomeBridgeApplySurfaceField(field, rawValue){
  const current = outcomeBridgeResolvedSurfaceInputs();
  const next = { ...current };

  if (OUTCOME_SURFACE_SELECT_FIELDS.has(field)){
    const normalized = outcomeBridgeNormalizeSelect(field, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: outcomeBridgeStateView() };
    }
    next[field] = normalized.value;
    if (field === "surfaceLever"){
      const spec = surfaceLeverSpec(next.surfaceLever) || surfaceLeverSpec(OUTCOME_SURFACE_DEFAULTS.surfaceLever);
      if (spec){
        const base = surfaceBaselineValue(spec);
        const lo = base != null ? Number(base) * 0.8 : spec.clampLo;
        const hi = base != null ? Number(base) * 1.2 : spec.clampHi;
        next.surfaceMin = String(surfaceClamp(lo, spec.clampLo, spec.clampHi));
        next.surfaceMax = String(surfaceClamp(hi, spec.clampLo, spec.clampHi));
      }
    }
    setState((target) => {
      outcomeBridgeWriteSurfaceInputs(target, next);
    });
    outcomeBridgeSyncLegacyControl(field, next[field]);
    if (field === "surfaceLever"){
      outcomeBridgeSyncLegacyControl("surfaceMin", next.surfaceMin);
      outcomeBridgeSyncLegacyControl("surfaceMax", next.surfaceMax);
    }
    return { ok: true, view: outcomeBridgeStateView() };
  }

  const normalized = outcomeBridgeNormalizeNumber(field, rawValue);
  if (!normalized.ok){
    return { ok: false, code: normalized.code, view: outcomeBridgeStateView() };
  }
  next[field] = normalized.value === "" ? "" : String(normalized.value);
  setState((target) => {
    outcomeBridgeWriteSurfaceInputs(target, next);
  });
  outcomeBridgeSyncLegacyControl(field, next[field]);
  return { ok: true, view: outcomeBridgeStateView() };
}

function outcomeBridgeStateView(){
  const locked = isScenarioLockedForEdits(state);
  const mc = state?.mcLast;
  const ce = mc?.confidenceEnvelope || null;
  const percentiles = ce?.percentiles || {};
  const risk = ce?.risk || {};
  const fragility = risk?.fragility || {};
  const advisor = risk?.advisor || {};
  const mcMeta = (state?.ui && typeof state.ui === "object" && state.ui.mcMeta && typeof state.ui.mcMeta === "object")
    ? state.ui.mcMeta
    : null;
  let governance = (state?.ui && typeof state.ui === "object" && state.ui.lastGovernanceSnapshot && typeof state.ui.lastGovernanceSnapshot === "object")
    ? { ...state.ui.lastGovernanceSnapshot }
    : null;
  try{
    const benchmarkWarnings = (engine?.snapshot?.computeAssumptionBenchmarkWarnings)
      ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
      : [];
    const driftSummary = computeRealityDrift();
    const realism = runRealismEngine({
      state,
      res: lastRenderCtx?.res || {},
      weeks: lastRenderCtx?.weeks,
      driftSummary,
    });
    const evidenceWarnings = computeEvidenceWarnings(state, { limit: 3, staleDays: 30 });
    const full = computeModelGovernance({
      state,
      res: lastRenderCtx?.res || {},
      benchmarkWarnings,
      evidenceWarnings,
      driftSummary,
      realism,
    });
    if (full && typeof full === "object"){
      governance = buildGovernanceSnapshotView(full);
      if (!state.ui || typeof state.ui !== "object"){
        state.ui = {};
      }
      state.ui.lastRealismSnapshot = realism;
      state.ui.lastGovernance = full;
      state.ui.lastGovernanceSnapshot = { ...governance };
    }
  } catch {
    governance = null;
  }

  let mcLastRun = "";
  if (mcMeta?.lastRunAt){
    try{
      mcLastRun = new Date(mcMeta.lastRunAt).toLocaleString();
    } catch {
      mcLastRun = String(mcMeta.lastRunAt || "");
    }
  }

  const mcFreshTag = !mc
    ? "MC pending"
    : (mcMeta?.isStale ? "Stale" : "Fresh");
  const mcStaleTag = !mc
    ? "No run yet"
    : (mcMeta?.isStale ? String(mcMeta.staleReason || "inputs changed") : "Current");

  const sensitivityRowsRaw = Array.isArray(state?.ui?.lastOutcomeSensitivityRows)
    ? state.ui.lastOutcomeSensitivityRows
    : [];
  const sensitivityRows = sensitivityRowsRaw.map((row) => ({
    label: String(row?.label || ""),
    impact: safeNum(row?.impact),
  }));

  const surfaceRowsRaw = Array.isArray(state?.ui?.lastOutcomeSurfaceRows)
    ? state.ui.lastOutcomeSurfaceRows
    : [];
  const surfaceRows = surfaceRowsRaw.map((row) => ({
    leverValue: row?.leverValue ?? "",
    winProb: safeNum(row?.winProb),
    p10: safeNum(row?.p10),
    p50: safeNum(row?.p50),
    p90: safeNum(row?.p90),
  }));

  const surfaceStatusText = String(state?.ui?.lastOutcomeSurfaceStatus || "").trim();
  const surfaceSummaryText = String(state?.ui?.lastOutcomeSurfaceSummary || "").trim();
  const mcModeOptions = outcomeBridgeReadSelectOptions("mcMode");
  const mcVolatilityOptions = outcomeBridgeReadSelectOptions("mcVolatility");
  const surfaceLeverOptions = outcomeBridgeReadSelectOptions("surfaceLever");
  const surfaceModeOptions = outcomeBridgeReadSelectOptions("surfaceMode");
  const mcMode = normalizeBridgeSelectValue(state?.mcMode, mcModeOptions, "basic");
  const mcVolatility = normalizeBridgeSelectValue(state?.mcVolatility, mcVolatilityOptions, "med");
  const surfaceInputsRaw = outcomeBridgeResolvedSurfaceInputs();
  const surfaceLever = normalizeBridgeSelectValue(
    surfaceInputsRaw?.surfaceLever,
    surfaceLeverOptions,
    OUTCOME_SURFACE_DEFAULTS.surfaceLever,
  );
  const surfaceMode = normalizeBridgeSelectValue(
    surfaceInputsRaw?.surfaceMode,
    surfaceModeOptions,
    OUTCOME_SURFACE_DEFAULTS.surfaceMode,
  );
  const surfaceInputs = {
    ...surfaceInputsRaw,
    surfaceLever,
    surfaceMode,
  };
  const surfaceComputing = !!(state?.ui && state.ui.outcomeSurfaceComputing);
  const runButton = els?.mcRun instanceof HTMLButtonElement ? els.mcRun : null;
  const rerunButton = els?.mcRerun instanceof HTMLButtonElement ? els.mcRerun : null;
  const surfaceButton = els?.btnComputeSurface instanceof HTMLButtonElement ? els.btnComputeSurface : null;
  const surfaceDisabled = surfaceComputing || !!surfaceButton?.disabled;

  return {
    inputs: {
      orgCount: state.orgCount ?? "",
      orgHoursPerWeek: state.orgHoursPerWeek ?? "",
      volunteerMultBase: state.volunteerMultBase ?? "",
      channelDoorPct: state.channelDoorPct ?? "",
      doorsPerHour3: canonicalDoorsPerHourFromSnap(state) ?? "",
      callsPerHour3: canonicalCallsPerHourFromSnap(state) ?? "",
      mcMode,
      mcSeed: state.mcSeed || "",
      mcVolatility,
      turnoutReliabilityPct: state.turnoutReliabilityPct ?? "",
      mcRuns: 10000,
      mcContactMin: state.mcContactMin ?? "",
      mcContactMode: state.mcContactMode ?? "",
      mcContactMax: state.mcContactMax ?? "",
      mcPersMin: state.mcPersMin ?? "",
      mcPersMode: state.mcPersMode ?? "",
      mcPersMax: state.mcPersMax ?? "",
      mcReliMin: state.mcReliMin ?? "",
      mcReliMode: state.mcReliMode ?? "",
      mcReliMax: state.mcReliMax ?? "",
      mcDphMin: state.mcDphMin ?? "",
      mcDphMode: state.mcDphMode ?? "",
      mcDphMax: state.mcDphMax ?? "",
      mcCphMin: state.mcCphMin ?? "",
      mcCphMode: state.mcCphMode ?? "",
      mcCphMax: state.mcCphMax ?? "",
      mcVolMin: state.mcVolMin ?? "",
      mcVolMode: state.mcVolMode ?? "",
      mcVolMax: state.mcVolMax ?? "",
      surfaceLever: surfaceInputs.surfaceLever,
      surfaceMode: surfaceInputs.surfaceMode,
      surfaceMin: surfaceInputs.surfaceMin,
      surfaceMax: surfaceInputs.surfaceMax,
      surfaceSteps: surfaceInputs.surfaceSteps,
      surfaceTarget: surfaceInputs.surfaceTarget,
    },
    options: {
      mcMode: bridgeSelectOptionsWithSelected(mcModeOptions, mcMode),
      mcVolatility: bridgeSelectOptionsWithSelected(mcVolatilityOptions, mcVolatility),
      surfaceLever: bridgeSelectOptionsWithSelected(surfaceLeverOptions, surfaceLever),
      surfaceMode: bridgeSelectOptionsWithSelected(surfaceModeOptions, surfaceMode),
    },
    controls: {
      locked,
      runDisabled: !!(runButton?.disabled || locked),
      rerunDisabled: !!(rerunButton?.disabled || locked),
      surfaceDisabled,
    },
    mc: {
      winProb: safeNum(mc?.winProb),
      p10: safeNum(percentiles?.p10),
      p50: safeNum(percentiles?.p50),
      p90: safeNum(percentiles?.p90),
      riskLabel: String(mc?.riskLabel || "").trim(),
      riskGrade: String(advisor?.grade || "").trim(),
      missRiskLabel: String(mc?.riskLabel || advisor?.grade || "").trim(),
      marginOfSafety: safeNum(risk?.marginOfSafety),
      downsideRiskMass: safeNum(risk?.downsideRiskMass),
      expectedShortfall10: safeNum(risk?.expectedShortfall10),
      requiredShiftP50: safeNum(risk?.breakEven?.requiredShiftP50),
      requiredShiftP10: safeNum(risk?.breakEven?.requiredShiftP10),
      shiftWin60: safeNum(risk?.targets?.shiftWin60),
      shiftWin70: safeNum(risk?.targets?.shiftWin70),
      shiftWin80: safeNum(risk?.targets?.shiftWin80),
      shockLoss10: safeNum(risk?.shocks?.lossProb10),
      shockLoss25: safeNum(risk?.shocks?.lossProb25),
      shockLoss50: safeNum(risk?.shocks?.lossProb50),
      fragilityIndex: safeNum(fragility?.fragilityIndex),
      cliffRisk: safeNum(fragility?.cliffRisk),
      freshTag: mcFreshTag,
      lastRun: mcLastRun,
      staleTag: mcStaleTag,
    },
    governance,
    sensitivityRows,
    surfaceRows,
    surfaceStatusText,
    surfaceSummaryText,
  };
}

function outcomeBridgeBuildSurfaceSummaryText({ spec, result, targetPercent } = {}){
  return buildOutcomeSurfaceSummaryText({
    spec,
    result,
    targetPercent,
  });
}

function outcomeBridgeSetField(field, rawValue){
  const key = String(field || "").trim();
  if (!key){
    return { ok: false, code: "invalid_field", view: outcomeBridgeStateView() };
  }

  if (OUTCOME_SURFACE_SELECT_FIELDS.has(key) || OUTCOME_SURFACE_NUMERIC_FIELDS.has(key)){
    return outcomeBridgeApplySurfaceField(key, rawValue);
  }

  if (!OUTCOME_MODEL_SELECT_FIELDS.has(key) && !OUTCOME_TEXT_FIELDS.has(key) && !OUTCOME_MODEL_NUMERIC_FIELDS.has(key)){
    return { ok: false, code: "invalid_field", view: outcomeBridgeStateView() };
  }

  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: outcomeBridgeStateView() };
  }

  if (OUTCOME_MODEL_SELECT_FIELDS.has(key)){
    const normalized = outcomeBridgeNormalizeSelect(key, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: outcomeBridgeStateView() };
    }
    mutateState((next) => {
      if (key === "mcMode"){
        next.mcMode = normalized.value;
      } else if (key === "mcVolatility"){
        next.mcVolatility = normalized.value;
      }
    });
    if (key === "mcMode"){
      syncMcModeUI();
    }
    markMcStale();
    return { ok: true, view: outcomeBridgeStateView() };
  }

  if (OUTCOME_TEXT_FIELDS.has(key)){
    const value = String(rawValue ?? "");
    mutateState((next) => {
      if (key === "mcSeed"){
        next.mcSeed = value;
      }
    });
    markMcStale();
    return { ok: true, view: outcomeBridgeStateView() };
  }

  const normalized = outcomeBridgeNormalizeNumber(key, rawValue);
  if (!normalized.ok){
    return { ok: false, code: normalized.code, view: outcomeBridgeStateView() };
  }
  mutateState((next) => {
    const value = normalized.value;
    if (key === "orgCount"){
      next.orgCount = safeNum(value);
    } else if (key === "orgHoursPerWeek"){
      next.orgHoursPerWeek = safeNum(value);
    } else if (key === "volunteerMultBase"){
      next.volunteerMultBase = safeNum(value);
    } else if (key === "channelDoorPct"){
      next.channelDoorPct = safeNum(value);
    } else if (key === "doorsPerHour3"){
      setCanonicalDoorsPerHour(next, value);
    } else if (key === "callsPerHour3"){
      setCanonicalCallsPerHour(next, value);
    } else if (key === "turnoutReliabilityPct"){
      next.turnoutReliabilityPct = safeNum(value);
    } else if (key === "mcContactMin"){
      next.mcContactMin = safeNum(value);
    } else if (key === "mcContactMode"){
      next.mcContactMode = safeNum(value);
    } else if (key === "mcContactMax"){
      next.mcContactMax = safeNum(value);
    } else if (key === "mcPersMin"){
      next.mcPersMin = safeNum(value);
    } else if (key === "mcPersMode"){
      next.mcPersMode = safeNum(value);
    } else if (key === "mcPersMax"){
      next.mcPersMax = safeNum(value);
    } else if (key === "mcReliMin"){
      next.mcReliMin = safeNum(value);
    } else if (key === "mcReliMode"){
      next.mcReliMode = safeNum(value);
    } else if (key === "mcReliMax"){
      next.mcReliMax = safeNum(value);
    } else if (key === "mcDphMin"){
      next.mcDphMin = safeNum(value);
    } else if (key === "mcDphMode"){
      next.mcDphMode = safeNum(value);
    } else if (key === "mcDphMax"){
      next.mcDphMax = safeNum(value);
    } else if (key === "mcCphMin"){
      next.mcCphMin = safeNum(value);
    } else if (key === "mcCphMode"){
      next.mcCphMode = safeNum(value);
    } else if (key === "mcCphMax"){
      next.mcCphMax = safeNum(value);
    } else if (key === "mcVolMin"){
      next.mcVolMin = safeNum(value);
    } else if (key === "mcVolMode"){
      next.mcVolMode = safeNum(value);
    } else if (key === "mcVolMax"){
      next.mcVolMax = safeNum(value);
    }
  });
  markMcStale();
  return { ok: true, view: outcomeBridgeStateView() };
}

function outcomeBridgeRunMc(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: outcomeBridgeStateView() };
  }
  runMonteCarloNow();
  return { ok: true, view: outcomeBridgeStateView() };
}

function outcomeBridgeRerunMc(){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: outcomeBridgeStateView() };
  }
  runMonteCarloNow();
  return { ok: true, view: outcomeBridgeStateView() };
}

function outcomeBridgeComputeSurface(){
  const surfaceInputs = outcomeBridgeResolvedSurfaceInputs();
  const spec = surfaceLeverSpec(surfaceInputs.surfaceLever);
  if (!spec){
    setState((next) => {
      outcomeBridgeWriteSurfaceInputs(next, surfaceInputs);
      outcomeBridgeSetSurfaceComputing(next, false);
      outcomeBridgeWriteSurfaceCache(next, {
        rows: [],
        statusText: "Unknown lever.",
        summaryText: String(next?.ui?.lastOutcomeSurfaceSummary || "").trim(),
      });
    });
    return { ok: false, code: "invalid_value", view: outcomeBridgeStateView() };
  }

  const minV = surfaceClamp(surfaceInputs.surfaceMin, spec.clampLo, spec.clampHi);
  const maxV = surfaceClamp(surfaceInputs.surfaceMax, spec.clampLo, spec.clampHi);
  const lo = Math.min(minV, maxV);
  const hi = Math.max(minV, maxV);
  const steps = Math.max(5, roundWholeNumberByMode(Number(surfaceInputs.surfaceSteps) || 21, { mode: "floor", fallback: 21 }) || 21);
  const runs = surfaceInputs.surfaceMode === "full" ? 10000 : 2000;
  const targetPercent = Number(surfaceInputs.surfaceTarget);
  const targetWinProb = Number.isFinite(targetPercent)
    ? surfaceClamp(targetPercent, 50, 99) / 100
    : 0.70;

  setState((next) => {
    outcomeBridgeWriteSurfaceInputs(next, {
      ...surfaceInputs,
      surfaceMin: String(lo),
      surfaceMax: String(hi),
      surfaceSteps: String(steps),
      surfaceTarget: String(roundWholeNumberByMode(targetWinProb * 100, { mode: "round", fallback: 70 }) || 70),
    });
    outcomeBridgeSetSurfaceComputing(next, true);
    outcomeBridgeWriteSurfaceCache(next, {
      rows: [],
      statusText: "Computing…",
      summaryText: String(next?.ui?.lastOutcomeSurfaceSummary || "").trim(),
    });
  });
  outcomeBridgeSyncLegacyControl("surfaceLever", surfaceInputs.surfaceLever);
  outcomeBridgeSyncLegacyControl("surfaceMode", surfaceInputs.surfaceMode);
  outcomeBridgeSyncLegacyControl("surfaceMin", String(lo));
  outcomeBridgeSyncLegacyControl("surfaceMax", String(hi));
  outcomeBridgeSyncLegacyControl("surfaceSteps", String(steps));
  outcomeBridgeSyncLegacyControl("surfaceTarget", String(roundWholeNumberByMode(targetWinProb * 100, { mode: "round", fallback: 70 }) || 70));

  try{
    const snap = getStateSnapshot();
    let planningSnapshot = null;
    try{
      planningSnapshot = computeElectionSnapshot({ state: snap, nowDate: new Date(), toNum: safeNum });
    } catch {
      planningSnapshot = null;
    }
    const modelInput = buildModelInputFromState(snap, safeNum);
    const res = planningSnapshot?.res || engine.computeAll(modelInput);
    const weeks = planningSnapshot?.weeks ?? derivedWeeksRemaining();
    const needVotes = (planningSnapshot?.needVotes != null) ? planningSnapshot.needVotes : deriveNeedVotes(res);

    const seed = state?.mcSeed || "";
    const result = engine.computeSensitivitySurface({
      engine: { withPatchedState, runMonteCarloSim },
      baseline: { res, weeks, needVotes, scenario: snap },
      sweep: {
        leverKey: surfaceInputs.surfaceLever,
        minValue: lo,
        maxValue: hi,
        steps,
      },
      options: { runs, seed, targetWinProb },
    });

    const doneStatus = `Done (${runs.toLocaleString()} runs × ${steps} points)`;
    const summaryText = outcomeBridgeBuildSurfaceSummaryText({
      spec,
      result,
      targetPercent: roundWholeNumberByMode(targetWinProb * 100, { mode: "round", fallback: 70 }) || 70,
    });

    setState((next) => {
      outcomeBridgeSetSurfaceComputing(next, false);
      outcomeBridgeWriteSurfaceCache(next, {
        rows: Array.isArray(result?.points) ? result.points : [],
        statusText: doneStatus,
        summaryText,
      });
    });
    return { ok: true, view: outcomeBridgeStateView() };
  } catch (err){
    const errText = err?.message ? err.message : String(err || "Error");
    setState((next) => {
      outcomeBridgeSetSurfaceComputing(next, false);
      outcomeBridgeWriteSurfaceCache(next, {
        rows: [],
        statusText: errText,
        summaryText: String(next?.ui?.lastOutcomeSurfaceSummary || "").trim(),
      });
    });
    return { ok: false, code: "runtime_error", view: outcomeBridgeStateView() };
  }
}

function installOutcomeBridge(){
  window[OUTCOME_BRIDGE_KEY] = {
    getView: () => outcomeBridgeStateView(),
    setField: (field, value) => outcomeBridgeSetField(field, value),
    runMc: () => outcomeBridgeRunMc(),
    rerunMc: () => outcomeBridgeRerunMc(),
    computeSurface: () => outcomeBridgeComputeSurface(),
  };
}

let decisionBridgeCopyStatus = "";

function hasLegacyDecisionManagerDom(){
  return !!(
    document.getElementById("stage-decisions") ||
    document.getElementById("decisionSessionSelect") ||
    document.getElementById("decisionActiveLabel")
  );
}

function hasLegacySensitivitySnapshotDom(){
  return !!(
    document.getElementById("sensTag") ||
    document.getElementById("sensTbody") ||
    document.getElementById("sensBanner") ||
    document.getElementById("btnSensRun")
  );
}

function refreshLegacyDecisionManagerIfMounted(){
  if (!hasLegacyDecisionManagerDom()){
    return;
  }
  safeCall(() => { renderDecisionSessionD1(); });
  safeCall(() => { renderDecisionSummaryD4(); });
}

function decisionBridgeParseMaybeNumber(raw){
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function decisionBridgeLineList(raw){
  return String(raw ?? "")
    .split(/\r?\n|,/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);
}

function decisionBridgeNormalizeWarRoomSession(session){
  if (!session || typeof session !== "object"){
    return null;
  }
  ensureDecisionSessionShape(session);
  if (!session.warRoom || typeof session.warRoom !== "object"){
    session.warRoom = {};
  }
  const warRoom = session.warRoom;
  if (!Array.isArray(warRoom.watchItems)) warRoom.watchItems = [];
  if (!Array.isArray(warRoom.decisionItems)) warRoom.decisionItems = [];
  if (!Array.isArray(warRoom.decisionLog)) warRoom.decisionLog = [];
  if (warRoom.owner == null) warRoom.owner = "";
  if (warRoom.followUpDate == null) warRoom.followUpDate = "";
  if (warRoom.decisionSummary == null) warRoom.decisionSummary = "";
  if (warRoom.lastReview == null || typeof warRoom.lastReview !== "object"){
    warRoom.lastReview = null;
  }
  return warRoom;
}

function decisionBridgeEnsureWarRoomState(){
  ensureWarRoomStateShape(state, { nowDate: new Date() });
  ensureEventCalendarStateShape(state, { nowDate: new Date() });
  return state?.warRoom || null;
}

function decisionBridgeWarRoomCurrentBaseline(session, diagnostics){
  const voterSignals = deriveVoterModelSignals(state?.voterData, {
    censusAgeDistribution: extractCensusAgeDistribution(state?.census),
    universeSize: safeNum(state?.universeSize),
  });
  return buildWarRoomReviewBaselineView({
    diagnostics,
    voterSignals,
    recommendedOptionId: session?.recommendedOptionId || "",
    scenarioId: state?.ui?.activeScenarioId || session?.scenarioId || SCENARIO_BASELINE_ID,
    reviewedAt: new Date().toISOString(),
  });
}

function decisionBridgeCurrentSnapshot(){
  ensureScenarioRegistry();
  ensureDecisionScaffold();
  decisionBridgeEnsureWarRoomState();

  const sessions = listDecisionSessions();
  const sessionMap = state?.ui?.decision?.sessions || {};
  const activeSession = getActiveDecisionSession();
  const activeSessionId = activeSession?.id || state?.ui?.decision?.activeSessionId || null;

  if (activeSession){
    ensureDecisionSessionShape(activeSession);
  }

  const options = activeSession ? listDecisionOptions(activeSession) : [];
  const activeOption = activeSession ? getActiveDecisionOption(activeSession) : null;
  if (activeOption){
    ensureDecisionOptionShape(activeOption);
  }

  const objectiveOptions = OBJECTIVE_TEMPLATES.map((row) => ({
    key: row.key,
    label: row.label
  }));
  const riskPostureOptions = RISK_POSTURES.map((row) => ({
    key: row.key,
    label: row.label
  }));
  const turfAccessOptions = [
    { key: "", label: "Unknown" },
    { key: "full", label: "Full" },
    { key: "limited", label: "Limited" },
    { key: "none", label: "None" },
  ];

  const objectiveLabel = objectiveOptions.find((row) => row.key === activeSession?.objectiveKey)?.label || "—";
  const selectedOptionLabel = decisionOptionDisplay(activeOption) || "—";
  const recommendedOption = activeSession?.recommendedOptionId
    ? (activeSession?.options?.[activeSession.recommendedOptionId] || null)
    : null;
  const recommendedOptionLabel = decisionOptionDisplay(recommendedOption) || "—";
  const scenarioLabel = decisionScenarioLabel(activeSession?.scenarioId || null);

  const summaryPreview = activeSession ? buildDecisionSummaryText(activeSession) : "";

  const diagnostics = decisionBridgeDiagnosticsSnapshot();
  const warRoomSession = decisionBridgeNormalizeWarRoomSession(activeSession);
  const warRoomCurrent = decisionBridgeWarRoomCurrentBaseline(activeSession, diagnostics);
  const warRoomPrevious = warRoomSession?.lastReview || null;
  const warRoomChange = buildWarRoomChangeClassificationView({
    previousBaseline: warRoomPrevious,
    currentBaseline: warRoomCurrent,
  });
  const warRoomDecisionLogRows = buildWarRoomDecisionLogRowsView(warRoomSession?.decisionLog || []);
  const weather = buildWarRoomWeatherView(state, { nowDate: new Date() });
  const eventCalendar = buildEventCalendarView(state, {
    nowDate: new Date(),
    scenarioId: state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID,
  });

  return {
    sessions,
    sessionMap,
    activeSessionId,
    activeSession,
    options,
    activeOption,
    objectiveOptions,
    riskPostureOptions,
    turfAccessOptions,
    objectiveLabel,
    selectedOptionLabel,
    recommendedOptionLabel,
    scenarioLabel,
    summaryPreview,
    diagnostics,
    warRoom: {
      current: warRoomCurrent,
      previous: warRoomPrevious,
      change: warRoomChange,
      watchItems: Array.isArray(warRoomSession?.watchItems) ? warRoomSession.watchItems.slice() : [],
      decisionItems: Array.isArray(warRoomSession?.decisionItems) ? warRoomSession.decisionItems.slice() : [],
      owner: String(warRoomSession?.owner || ""),
      followUpDate: String(warRoomSession?.followUpDate || ""),
      decisionSummary: String(warRoomSession?.decisionSummary || ""),
      decisionLogRows: warRoomDecisionLogRows,
      weather,
      eventCalendar,
    },
  };
}

function decisionBridgeDiagnosticsSnapshot(){
  ensureScenarioRegistry();
  const reg = state?.ui?.scenarios || {};
  const activeId = state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID;
  const baseInputs = reg?.[SCENARIO_BASELINE_ID]?.inputs || null;
  const activeInputs = reg?.[activeId]?.inputs || null;
  return buildDecisionDiagnosticsSnapshotView({
    executionSnapshot: lastRenderCtx?.executionSnapshot || null,
    weeklyContext: lastRenderCtx?.weeklyContext || null,
    mcResult: state?.mcLast || null,
    clampFn: clamp,
    bindingObj: state?.ui?.lastTlMeta?.bindingObj || null,
    primaryBottleneck: state?.ui?.lastDiagnostics?.primaryBottleneck || null,
    secondaryNotes: state?.ui?.lastDiagnostics?.secondaryNotes || null,
    sensitivityCache: state?.ui?.e4Sensitivity || null,
    baselineInputs: baseInputs,
    activeInputs,
    divergenceKeyOrder: DECISION_DIVERGENCE_KEY_ORDER,
    formatInt: (value) => fmtInt(value),
    weeksRemaining: lastRenderCtx?.weeks ?? null,
  });
}

function decisionBridgeStateView(){
  const snap = decisionBridgeCurrentSnapshot();
  const s = snap.activeSession || null;
  const activeOption = snap.activeOption || null;
  const warRoom = snap.warRoom && typeof snap.warRoom === "object" ? snap.warRoom : {};
  const recommendedOptionId = s?.recommendedOptionId || "";
  const whatNeedsTrueText = Array.isArray(s?.whatNeedsTrue) ? s.whatNeedsTrue.join("\n") : "";
  const nonNegotiablesText = Array.isArray(s?.nonNegotiables) ? s.nonNegotiables.join("\n") : "";

  const canDeleteSession = snap.sessions.length > 1;
  const canDeleteOption = snap.options.length > 1;

  return {
    sessions: snap.sessions.map((row) => ({
      id: row?.id || "",
      name: row?.name || row?.id || ""
    })),
    activeSessionId: snap.activeSessionId,
    activeSessionLabel: s ? `Active session: ${s.name || s.id}` : "Active session: —",
    objectiveOptions: snap.objectiveOptions,
    riskPostureOptions: snap.riskPostureOptions,
    turfAccessOptions: snap.turfAccessOptions,
    session: s ? {
      id: s.id,
      name: s.name || s.id,
      objectiveKey: s.objectiveKey || "",
      notes: s.notes || "",
      scenarioLabel: snap.scenarioLabel,
      constraints: {
        budget: s.constraints?.budget == null ? "" : String(s.constraints.budget),
        volunteerHrs: s.constraints?.volunteerHrs == null ? "" : String(s.constraints.volunteerHrs),
        turfAccess: s.constraints?.turfAccess || "",
        blackoutDates: s.constraints?.blackoutDates || "",
      },
      riskPosture: s.riskPosture || "balanced",
      nonNegotiablesText,
    } : null,
    options: snap.options.map((row) => ({
      id: row?.id || "",
      label: row?.label || row?.id || "",
      displayLabel: decisionOptionDisplay(row),
      scenarioLabel: decisionScenarioLabel(row?.scenarioId || null),
    })),
    activeOptionId: s?.activeOptionId || "",
    activeOption: activeOption ? {
      id: activeOption.id,
      label: activeOption.label || activeOption.id,
      scenarioLabel: decisionScenarioLabel(activeOption.scenarioId || null),
      tactics: {
        doors: !!activeOption?.tactics?.doors,
        phones: !!activeOption?.tactics?.phones,
        digital: !!activeOption?.tactics?.digital,
      },
    } : null,
    recommendedOptionId,
    whatNeedsTrueText,
    summaryPreview: snap.summaryPreview || "",
    copyStatus: decisionBridgeCopyStatus || "",
    canDeleteSession,
    canDeleteOption,
    diagnostics: snap.diagnostics,
    warRoom: {
      classification: String(warRoom?.change?.classification || "noise"),
      significance: String(warRoom?.change?.significance || "low"),
      actionability: String(warRoom?.change?.actionability || "watch"),
      score: Number.isFinite(Number(warRoom?.change?.score)) ? Number(warRoom.change.score) : 0,
      changedSinceReview: !!warRoom?.change?.changedSinceReview,
      summary: String(warRoom?.change?.summary || "—"),
      topDrivers: Array.isArray(warRoom?.change?.topDrivers) ? warRoom.change.topDrivers.slice() : [],
      deltas: warRoom?.change?.deltas || {},
      lastReviewAt: String(warRoom?.previous?.reviewedAt || ""),
      currentReviewAt: String(warRoom?.current?.reviewedAt || ""),
      watchItemsText: Array.isArray(warRoom?.watchItems) ? warRoom.watchItems.join("\n") : "",
      decisionItemsText: Array.isArray(warRoom?.decisionItems) ? warRoom.decisionItems.join("\n") : "",
      owner: String(warRoom?.owner || ""),
      followUpDate: String(warRoom?.followUpDate || ""),
      decisionSummary: String(warRoom?.decisionSummary || ""),
      recommendationLabel: snap.recommendedOptionLabel || "—",
      decisionLogRows: Array.isArray(warRoom?.decisionLogRows) ? warRoom.decisionLogRows : [],
      weather: warRoom?.weather || null,
      eventCalendar: warRoom?.eventCalendar || null,
    },
    summary: {
      objectiveLabel: snap.objectiveLabel || "—",
      selectedOptionLabel: snap.selectedOptionLabel || "—",
      recommendedOptionLabel: snap.recommendedOptionLabel || "—",
      confidenceTag: snap.diagnostics?.confidence?.tag || "—",
      riskTag: snap.diagnostics?.risk?.tag || "—",
      bottleneckTag: snap.diagnostics?.bottleneck?.tag || "—",
      scenarioLabel: snap.scenarioLabel || "—",
    },
  };
}

function decisionBridgeSelectSession(id){
  ensureDecisionScaffold();
  const nextId = String(id || "").trim();
  const sessions = state?.ui?.decision?.sessions || {};
  if (!nextId || !sessions[nextId]) {
    return { ok: false, code: "not_found", view: decisionBridgeStateView() };
  }
  state.ui.decision.activeSessionId = nextId;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeCreateSession(name){
  ensureDecisionScaffold();
  const sessions = state?.ui?.decision?.sessions || {};
  const id = makeDecisionSessionId();
  const defaultName = `Session ${Object.keys(sessions).length + 1}`;
  const nextName = String(name || "").trim() || defaultName;
  sessions[id] = {
    id,
    name: nextName,
    createdAt: new Date().toISOString(),
    scenarioId: state.ui.activeScenarioId || SCENARIO_BASELINE_ID,
    objectiveKey: OBJECTIVE_TEMPLATES[0]?.key || "win_prob",
    notes: "",
    constraints: { budget: null, volunteerHrs: null, turfAccess: "", blackoutDates: "" },
    riskPosture: "balanced",
    nonNegotiables: [],
    whatNeedsTrue: [],
    recommendedOptionId: null,
    options: {},
    activeOptionId: null,
    warRoom: {
      watchItems: [],
      decisionItems: [],
      owner: "",
      followUpDate: "",
      decisionSummary: "",
      lastReview: null,
      decisionLog: [],
    },
  };
  state.ui.decision.activeSessionId = id;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeRenameSession(name){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  const nextName = String(name || "").trim();
  if (!nextName) {
    return { ok: false, code: "invalid_name", view: decisionBridgeStateView() };
  }
  s.name = nextName;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeDeleteSession(){
  ensureDecisionScaffold();
  const sessions = state?.ui?.decision?.sessions || {};
  const ids = Object.keys(sessions);
  if (ids.length <= 1) {
    return { ok: false, code: "cannot_delete_last", view: decisionBridgeStateView() };
  }
  const cur = state?.ui?.decision?.activeSessionId || "";
  if (!cur || !sessions[cur]) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  delete sessions[cur];
  const nextIds = Object.keys(sessions);
  state.ui.decision.activeSessionId = nextIds[0] || null;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeLinkSessionToActiveScenario(){
  ensureScenarioRegistry();
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  s.scenarioId = state.ui.activeScenarioId || SCENARIO_BASELINE_ID;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeUpdateSessionField(field, value){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const warRoom = decisionBridgeNormalizeWarRoomSession(s);
  const key = String(field || "").trim();
  if (key === "objectiveKey"){
    s.objectiveKey = String(value || "").trim() || OBJECTIVE_TEMPLATES[0]?.key || "win_prob";
  } else if (key === "notes"){
    s.notes = String(value || "");
  } else if (key === "budget"){
    s.constraints.budget = decisionBridgeParseMaybeNumber(value);
  } else if (key === "volunteerHrs"){
    s.constraints.volunteerHrs = decisionBridgeParseMaybeNumber(value);
  } else if (key === "turfAccess"){
    s.constraints.turfAccess = String(value || "");
  } else if (key === "blackoutDates"){
    s.constraints.blackoutDates = String(value || "");
  } else if (key === "riskPosture"){
    s.riskPosture = String(value || "balanced");
  } else if (key === "nonNegotiables"){
    s.nonNegotiables = decisionBridgeLineList(value);
  } else if (key === "warRoomWatchItems"){
    warRoom.watchItems = decisionBridgeLineList(value);
  } else if (key === "warRoomDecisionItems"){
    warRoom.decisionItems = decisionBridgeLineList(value);
  } else if (key === "warRoomOwner"){
    warRoom.owner = String(value || "").trim();
  } else if (key === "warRoomFollowUpDate"){
    warRoom.followUpDate = String(value || "").trim();
  } else if (key === "warRoomDecisionSummary"){
    warRoom.decisionSummary = String(value || "");
  } else {
    return { ok: false, code: "unknown_field", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSelectOption(id){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const nextId = String(id || "").trim();
  if (!nextId || !s.options?.[nextId]){
    return { ok: false, code: "not_found", view: decisionBridgeStateView() };
  }
  s.activeOptionId = nextId;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeCreateOption(name){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const id = makeDecisionOptionId();
  const nextName = String(name || "").trim() || `Option ${Object.keys(s.options || {}).length + 1}`;
  s.options[id] = {
    id,
    label: nextName,
    createdAt: new Date().toISOString(),
    scenarioId: state.ui.activeScenarioId || SCENARIO_BASELINE_ID,
    tactics: { doors: false, phones: false, digital: false },
  };
  s.activeOptionId = id;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeRenameOption(name){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const o = getActiveDecisionOption(s);
  if (!o) {
    return { ok: false, code: "no_option", view: decisionBridgeStateView() };
  }
  const nextName = String(name || "").trim();
  if (!nextName) {
    return { ok: false, code: "invalid_name", view: decisionBridgeStateView() };
  }
  o.label = nextName;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeDeleteOption(){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const options = s.options || {};
  const ids = Object.keys(options);
  if (ids.length <= 1) {
    return { ok: false, code: "cannot_delete_last", view: decisionBridgeStateView() };
  }
  const o = getActiveDecisionOption(s);
  if (!o) {
    return { ok: false, code: "no_option", view: decisionBridgeStateView() };
  }
  delete options[o.id];
  const nextIds = Object.keys(options);
  s.activeOptionId = nextIds[0] || null;
  if (s.recommendedOptionId && !options[s.recommendedOptionId]){
    s.recommendedOptionId = null;
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeLinkOptionToActiveScenario(){
  ensureScenarioRegistry();
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const o = getActiveDecisionOption(s);
  if (!o) {
    return { ok: false, code: "no_option", view: decisionBridgeStateView() };
  }
  o.scenarioId = state.ui.activeScenarioId || SCENARIO_BASELINE_ID;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetOptionTactic(kind, enabled){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const o = getActiveDecisionOption(s);
  if (!o) {
    return { ok: false, code: "no_option", view: decisionBridgeStateView() };
  }
  ensureDecisionOptionShape(o);
  const key = String(kind || "").trim();
  if (!["doors", "phones", "digital"].includes(key)){
    return { ok: false, code: "unknown_tactic", view: decisionBridgeStateView() };
  }
  o.tactics[key] = !!enabled;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetRecommendedOption(id){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const nextId = String(id || "").trim();
  s.recommendedOptionId = nextId && s.options?.[nextId] ? nextId : null;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetWhatNeedsTrue(raw){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  s.whatNeedsTrue = decisionBridgeLineList(raw);
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeCaptureReviewBaseline(){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const warRoom = decisionBridgeNormalizeWarRoomSession(s);
  const diagnostics = decisionBridgeDiagnosticsSnapshot();
  warRoom.lastReview = decisionBridgeWarRoomCurrentBaseline(s, diagnostics);
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeLogDecision(){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const warRoom = decisionBridgeNormalizeWarRoomSession(s);
  const snap = decisionBridgeCurrentSnapshot();
  const change = snap?.warRoom?.change || buildWarRoomChangeClassificationView({
    previousBaseline: warRoom.lastReview || null,
    currentBaseline: decisionBridgeWarRoomCurrentBaseline(s, snap?.diagnostics || null),
  });
  const summary = String(warRoom.decisionSummary || "").trim()
    || `Decision checkpoint: ${String(snap?.recommendedOptionLabel || "No recommendation")}`;

  const row = {
    id: `wr_${uid()}${Date.now().toString(16)}`,
    recordedAt: new Date().toISOString(),
    scenarioId: state?.ui?.activeScenarioId || s?.scenarioId || SCENARIO_BASELINE_ID,
    classification: String(change?.classification || "noise"),
    significance: String(change?.significance || "low"),
    actionability: String(change?.actionability || "watch"),
    owner: String(warRoom.owner || "").trim(),
    followUpDate: String(warRoom.followUpDate || "").trim(),
    summary,
    status: "open",
    recommendationLabel: String(snap?.recommendedOptionLabel || "—"),
    topDrivers: Array.isArray(change?.topDrivers) ? change.topDrivers.slice(0, 6) : [],
    watchItems: Array.isArray(warRoom.watchItems) ? warRoom.watchItems.slice(0, 20) : [],
    decisionItems: Array.isArray(warRoom.decisionItems) ? warRoom.decisionItems.slice(0, 20) : [],
  };

  warRoom.decisionLog.unshift(row);
  if (warRoom.decisionLog.length > 120){
    warRoom.decisionLog.length = 120;
  }
  if (!warRoom.lastReview){
    warRoom.lastReview = decisionBridgeWarRoomCurrentBaseline(s, snap?.diagnostics || null);
  }

  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetDecisionLogStatus(id, status){
  const s = getActiveDecisionSession();
  if (!s) {
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  ensureDecisionSessionShape(s);
  const warRoom = decisionBridgeNormalizeWarRoomSession(s);
  const rowId = String(id || "").trim();
  const nextStatus = String(status || "").trim().toLowerCase();
  const allowed = new Set(["open", "in_progress", "closed"]);
  if (!rowId || !allowed.has(nextStatus)){
    return { ok: false, code: "invalid_status_request", view: decisionBridgeStateView() };
  }
  const row = warRoom.decisionLog.find((entry) => String(entry?.id || "").trim() === rowId);
  if (!row){
    return { ok: false, code: "log_row_not_found", view: decisionBridgeStateView() };
  }
  row.status = nextStatus;
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetWeatherField(field, value){
  const warRoom = decisionBridgeEnsureWarRoomState();
  const weather = warRoom?.weather || {};
  const key = String(field || "").trim();
  if (key === "officeZip"){
    weather.officeZip = normalizeZip(value);
  } else if (key === "overrideZip"){
    weather.overrideZip = normalizeZip(value);
  } else if (key === "useOverrideZip"){
    weather.useOverrideZip = !!value;
  } else {
    return { ok: false, code: "unknown_weather_field", view: decisionBridgeStateView() };
  }
  weather.selectedZip = resolveSelectedZip(weather);
  if (!weather.selectedZip){
    weather.status = "idle";
    weather.error = "Select an office ZIP or override ZIP for weather context.";
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetWeatherMode(mode){
  const warRoom = decisionBridgeEnsureWarRoomState();
  const requestedMode = String(mode || "").trim().toLowerCase();
  if (requestedMode === WEATHER_MODE_TODAY_ONLY){
    const selectedZip = resolveSelectedZip(warRoom?.weather || {});
    if (!selectedZip){
      warRoom.weather.status = "error";
      warRoom.weather.error = "Select a ZIP before enabling today-only weather adjustment.";
      persist();
      refreshLegacyDecisionManagerIfMounted();
      return { ok: false, code: "missing_zip", view: decisionBridgeStateView() };
    }
  }
  applyWeatherModeToState(state, mode, { nowDate: new Date() });
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

async function decisionBridgeRefreshWeather(){
  const warRoom = decisionBridgeEnsureWarRoomState();
  const weather = warRoom?.weather || {};
  const selectedZip = resolveSelectedZip(weather);
  if (!selectedZip){
    weather.status = "error";
    weather.error = "Select a ZIP before refreshing weather.";
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: false, code: "missing_zip", view: decisionBridgeStateView() };
  }

  weather.status = "loading";
  weather.error = "";
  refreshLegacyDecisionManagerIfMounted();

  try{
    const payload = await fetchWarRoomWeatherByZip(selectedZip);
    applyWeatherObservationToState(state, payload, { nowDate: new Date() });
    const mode = state?.warRoom?.weatherAdjustment?.mode || WEATHER_MODE_OBSERVE_ONLY;
    if (mode === WEATHER_MODE_TODAY_ONLY){
      applyWeatherModeToState(state, WEATHER_MODE_TODAY_ONLY, { nowDate: new Date() });
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: !!payload?.ok, code: payload?.ok ? "ok" : (payload?.code || "weather_error"), view: decisionBridgeStateView() };
  } catch (err){
    weather.status = "error";
    weather.error = err?.message ? String(err.message) : "Weather refresh failed.";
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: false, code: "weather_exception", view: decisionBridgeStateView() };
  }
}

function decisionBridgeSetEventFilter(field, value){
  decisionBridgeEnsureWarRoomState();
  const out = setEventCalendarFilter(state, field, value, { nowDate: new Date() });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_filter_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetEventDraftField(field, value){
  decisionBridgeEnsureWarRoomState();
  const out = setEventCalendarDraftField(state, field, value, { nowDate: new Date() });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_draft_field_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSaveEventDraft(){
  decisionBridgeEnsureWarRoomState();
  const out = saveEventCalendarDraftAsEvent(state, {
    uidFn: uid,
    nowDate: new Date(),
  });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_save_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeLoadEventDraft(eventId){
  decisionBridgeEnsureWarRoomState();
  const out = loadEventCalendarDraft(state, eventId, { nowDate: new Date() });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_load_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeClearEventDraft(){
  decisionBridgeEnsureWarRoomState();
  const out = clearEventCalendarDraft(state, { nowDate: new Date() });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_clear_draft_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeDeleteEvent(eventId){
  decisionBridgeEnsureWarRoomState();
  const out = deleteEventCalendarRecord(state, eventId, { nowDate: new Date() });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_delete_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetEventApplyToModel(eventId, enabled){
  decisionBridgeEnsureWarRoomState();
  const out = updateEventCalendarApplyToModel(state, eventId, enabled, { nowDate: new Date() });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_apply_toggle_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

function decisionBridgeSetEventStatus(eventId, status){
  decisionBridgeEnsureWarRoomState();
  const out = setEventCalendarStatus(state, eventId, status, { nowDate: new Date() });
  if (!out?.ok){
    return { ok: false, code: out?.code || "event_status_failed", view: decisionBridgeStateView() };
  }
  persist();
  refreshLegacyDecisionManagerIfMounted();
  return { ok: true, view: decisionBridgeStateView() };
}

async function decisionBridgeCopySummary(kind = "markdown"){
  const s = getActiveDecisionSession();
  if (!s) {
    decisionBridgeCopyStatus = "No active session.";
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  const md = buildDecisionSummaryText(s);
  const mode = String(kind || "markdown").trim();
  const text = mode === "text" ? decisionSummaryPlainText(md) : md;
  const ok = await copyTextToClipboard(text);
  decisionBridgeCopyStatus = ok
    ? (mode === "text" ? "Copied summary (text)." : "Copied summary (markdown).")
    : "Copy failed.";
  return { ok, code: ok ? "ok" : "copy_failed", view: decisionBridgeStateView() };
}

function decisionBridgeDownloadSummaryJson(){
  const s = getActiveDecisionSession();
  if (!s) {
    decisionBridgeCopyStatus = "No active session.";
    return { ok: false, code: "no_session", view: decisionBridgeStateView() };
  }
  const obj = decisionSessionExportObject(s);
  if (!obj) {
    decisionBridgeCopyStatus = "Export failed.";
    return { ok: false, code: "export_failed", view: decisionBridgeStateView() };
  }
  const safe = String((s.name || s.id || "decision-session"))
    .toLowerCase()
    .replace(/[^a-z0-9\-\_]+/g, "-")
    .replace(/\-+/g, "-")
    .replace(/^\-+|\-+$/g, "");
  const filename = `${safe || "decision-session"}.json`;
  downloadJsonObject(obj, filename);
  decisionBridgeCopyStatus = "Downloaded session JSON.";
  return { ok: true, view: decisionBridgeStateView() };
}

async function decisionBridgeRunSensitivitySnapshot(){
  const base = state.mcLast;
  if (!base){
    return { ok: false, code: "missing_base_mc", view: decisionBridgeStateView() };
  }

  const stale = (lastRenderCtx && lastRenderCtx.res)
    ? getMcStaleness({
        state,
        res: lastRenderCtx.res,
        weeks: lastRenderCtx.weeks,
        hashMcInputs,
        computeDailyLogHash,
      })
    : null;
  if (stale?.isStale){
    return {
      ok: false,
      code: "mc_stale",
      reason: stale.reasonText || "inputs changed",
      view: decisionBridgeStateView()
    };
  }

  const computed = computeDecisionSensitivityMiniSurfaceCache({
    state,
    lastRenderCtx,
    clampFn: clamp,
    runMonteCarloSim,
    resolveCanonicalDoorsPerHourFn: canonicalDoorsPerHourFromSnap,
    resolveCanonicalCallsPerHourFn: canonicalCallsPerHourFromSnap,
    setCanonicalDoorsPerHourFn: (target, value, options = {}) => setCanonicalDoorsPerHour(target, value, options),
    setCanonicalCallsPerHourFn: (target, value, options = {}) => setCanonicalCallsPerHour(target, value, options),
  });
  if (!computed.ok || !computed.cache){
    return { ok: false, code: computed.code || "failed", view: decisionBridgeStateView() };
  }

  if (!state.ui) state.ui = {};
  state.ui.e4Sensitivity = computed.cache;
  persist();
  if (hasLegacySensitivitySnapshotDom()){
    safeCall(() => { renderSensitivitySnapshotE4(); });
  }
  return { ok: true, view: decisionBridgeStateView() };
}

function installDecisionBridge(){
  window[DECISION_BRIDGE_KEY] = {
    getView: () => decisionBridgeStateView(),
    selectSession: (id) => decisionBridgeSelectSession(id),
    createSession: (name) => decisionBridgeCreateSession(name),
    renameSession: (name) => decisionBridgeRenameSession(name),
    deleteSession: () => decisionBridgeDeleteSession(),
    linkSessionToActiveScenario: () => decisionBridgeLinkSessionToActiveScenario(),
    updateSessionField: (field, value) => decisionBridgeUpdateSessionField(field, value),

    selectOption: (id) => decisionBridgeSelectOption(id),
    createOption: (name) => decisionBridgeCreateOption(name),
    renameOption: (name) => decisionBridgeRenameOption(name),
    deleteOption: () => decisionBridgeDeleteOption(),
    linkOptionToActiveScenario: () => decisionBridgeLinkOptionToActiveScenario(),
    setOptionTactic: (kind, enabled) => decisionBridgeSetOptionTactic(kind, enabled),

    setRecommendedOption: (id) => decisionBridgeSetRecommendedOption(id),
    setWhatNeedsTrue: (raw) => decisionBridgeSetWhatNeedsTrue(raw),
    captureReviewBaseline: () => decisionBridgeCaptureReviewBaseline(),
    logDecision: () => decisionBridgeLogDecision(),
    setDecisionLogStatus: (id, status) => decisionBridgeSetDecisionLogStatus(id, status),
    setWeatherField: (field, value) => decisionBridgeSetWeatherField(field, value),
    setWeatherMode: (mode) => decisionBridgeSetWeatherMode(mode),
    refreshWeather: () => decisionBridgeRefreshWeather(),
    setEventFilter: (field, value) => decisionBridgeSetEventFilter(field, value),
    setEventDraftField: (field, value) => decisionBridgeSetEventDraftField(field, value),
    saveEventDraft: () => decisionBridgeSaveEventDraft(),
    loadEventDraft: (eventId) => decisionBridgeLoadEventDraft(eventId),
    clearEventDraft: () => decisionBridgeClearEventDraft(),
    deleteEvent: (eventId) => decisionBridgeDeleteEvent(eventId),
    setEventApplyToModel: (eventId, enabled) => decisionBridgeSetEventApplyToModel(eventId, enabled),
    setEventStatus: (eventId, status) => decisionBridgeSetEventStatus(eventId, status),
    copySummary: (kind) => decisionBridgeCopySummary(kind),
    downloadSummaryJson: () => decisionBridgeDownloadSummaryJson(),
    runSensitivitySnapshot: () => decisionBridgeRunSensitivitySnapshot(),
  };
}

// =========================
// Phase D1 — Decision Session Scaffold (UI + state only)
// =========================

function makeDecisionSessionId(){
  return getScenarioDecisionController().makeDecisionSessionId();
}
function makeDecisionOptionId(){
  return getScenarioDecisionController().makeDecisionOptionId();
}

function ensureDecisionOptionShape(o){
  return getScenarioDecisionController().ensureDecisionOptionShape(o);
}

function ensureDecisionSessionShape(s){
  return getScenarioDecisionController().ensureDecisionSessionShape(s);
}


function ensureDecisionScaffold(){
  return getScenarioDecisionController().ensureDecisionScaffold();
}

function getActiveDecisionSession(){
  return getScenarioDecisionController().getActiveDecisionSession();
}

function listDecisionSessions(){
  return getScenarioDecisionController().listDecisionSessions();
}

function decisionScenarioLabel(scenarioId){
  return getScenarioDecisionController().decisionScenarioLabel(scenarioId);
}

function renderDecisionSessionD1(){
  return getScenarioDecisionController().renderDecisionSessionD1();
}

function listDecisionOptions(session){
  return getScenarioDecisionController().listDecisionOptions(session);
}

function getActiveDecisionOption(session){
  return getScenarioDecisionController().getActiveDecisionOption(session);
}

function renderDecisionOptionsD3(session){
  return getScenarioDecisionController().renderDecisionOptionsD3(session);
}

function decisionOptionDisplay(o){
  return getScenarioDecisionController().decisionOptionDisplay(o);
}

function buildDecisionSummaryText(session){
  return getScenarioDecisionController().buildDecisionSummaryText(session);
}

function copyTextToClipboard(text){
  return getScenarioDecisionController().copyTextToClipboard(text);
}

function decisionSummaryPlainText(md){
  return getScenarioDecisionController().decisionSummaryPlainText(md);
}

function decisionSessionExportObject(session){
  return getScenarioDecisionController().decisionSessionExportObject(session);
}

function downloadJsonObject(obj, filename){
  return getScenarioDecisionController().downloadJsonObject(obj, filename);
}

function renderDecisionSummaryD4(session){
  return getScenarioDecisionController().renderDecisionSummaryD4(session);
}


// =========================
// Phase 15 — Sensitivity Surface (on-demand)
// =========================

function surfaceLeverSpec(key){
  return surfaceLeverSpecCore(key);
}

function surfaceClamp(v, lo, hi){
  return surfaceClampCore(v, lo, hi);
}

function surfaceBaselineValue(spec){
  return surfaceBaselineValueCore(spec, state);
}

function applySurfaceDefaults(){
  return applySurfaceDefaultsCore({
    els,
    surfaceLeverSpec,
    surfaceBaselineValue,
    surfaceClamp,
  });
}

function renderSurfaceStub(){
  return renderSurfaceStubCore({ els });
}

function renderSurfaceResult({ spec, result }){
  return renderSurfaceResultCore({
    els,
    spec,
    result,
    fmtSigned,
  });
}

let sensitivitySurfaceController = null;

function getSensitivitySurfaceController(){
  if (sensitivitySurfaceController) return sensitivitySurfaceController;
  sensitivitySurfaceController = createSensitivitySurfaceController({
    els,
    getState: () => state,
    getStateSnapshot,
    computeElectionSnapshot,
    safeNum,
    buildModelInputFromState,
    engine,
    derivedWeeksRemaining,
    deriveNeedVotes,
    withPatchedState,
    runMonteCarloSim,
    surfaceLeverSpec,
    surfaceClamp,
    applySurfaceDefaults,
    renderSurfaceStub,
    renderSurfaceResult,
  });
  return sensitivitySurfaceController;
}

function wireSensitivitySurface(){
  return getSensitivitySurfaceController().wireSensitivitySurface();
}

function initTabs(){
  initTabsModule({ state });
}

function initExplainCard(){
  initExplainCardModule({ els, state });
}


function isDevMode(){
  return isDevModeModule();
}

function initDevTools(){
  initDevToolsModule({
    isDevMode,
    getState: () => state,
    derivedWeeksRemaining,
    safeNum,
    deriveNeedVotes,
    engine,
    getSelfTestAccessors,
    setSelfTestGateStatus: (next) => { selfTestGateStatus = next; },
    updateSelfTestGateBadge,
  });
}
function init(){
  bootProbeSetStatus("booting", { source: "appRuntime.init" });

  const runInitStep = (label, fn) => {
    bootProbeMark(label, { phase: "start" });
    safeCall(() => {
      const result = fn();
      bootProbeMark(label, { phase: "ok" });
      return result;
    }, { label });
  };

  try {
    bootProbeMark("init.normalizeStageLayout", { phase: "start" });
    normalizeStageLayoutModule();
    bootProbeMark("init.normalizeStageLayout", { phase: "ok" });
  } catch (err){
    bootProbeError("init.normalizeStageLayout", err);
  }

  runInitStep("init.applyActiveContextToLegacyNavLinks", () => {
    applyActiveContextToLinks(resolveActiveContext({ fallback: state }), ".nav-item-new[href]");
  });
  runInitStep("init.installGlobalErrorCapture", () => { installGlobalErrorCapture(); });
  runInitStep("init.preflightEls", () => { preflightEls(); });
  runInitStep("init.wireUsbStorageEvents", () => { wireUsbStorageEvents(); });
  runInitStep("init.usbStorageInit", () => {
    const controller = getUsbStorageController();
    bootProbeMark("init.usbStorageInit.controller", { phase: "ok" });
    Promise.resolve(controller.init())
      .then(() => {
        bootProbeMark("init.usbStorageInit.controllerInit", {
          phase: "ok",
          connected: controller.isConnected(),
        });
        if (controller.isConnected()){
          clearPersistenceFailure("state");
          clearPersistenceFailure("backup");
          if (!bootHadLocalState){
            return controller.loadFromFolder({ suppressMissingStatus: true });
          }
        }
        return null;
      })
      .then((loaded) => {
        if (loaded){
          bootProbeMark("init.usbStorageInit.loadFromFolder", { phase: "ok" });
        }
      })
      .catch((err) => {
        bootProbeError("init.usbStorageInit.async", err);
        recordError("init-usb-storage", err?.message ? String(err.message) : String(err || "USB storage init failed"));
      });
  });
  runInitStep("init.ensureScenarioRegistry", () => { ensureScenarioRegistry(); });
  runInitStep("init.installDataBridge", () => { installDataBridge(); });
  runInitStep("init.installScenarioBridge", () => { installScenarioBridge(); });
  runInitStep("init.installShellBridge", () => { installShellBridge(); });
  runInitStep("init.installDistrictBridge", () => { installDistrictBridge(); });
  runInitStep("init.installReachBridge", () => { installReachBridge(); });
  runInitStep("init.installTurnoutBridge", () => { installTurnoutBridge(); });
  runInitStep("init.installPlanBridge", () => { installPlanBridge(); });
  runInitStep("init.installOutcomeBridge", () => { installOutcomeBridge(); });
  runInitStep("init.ensureDecisionScaffold", () => { ensureDecisionScaffold(); });
  runInitStep("init.installDecisionBridge", () => { installDecisionBridge(); });
  runInitStep("init.runInitScenarioDecisionWiring", () => {
    runInitScenarioDecisionWiringModule({
      els,
      getState: () => state,
      replaceState: (next) => { state = next; },
      setState,
      ensureScenarioRegistry,
      ensureDecisionScaffold,
      SCENARIO_BASELINE_ID,
      SCENARIO_MAX,
      setScenarioWarn,
      uid,
      scenarioClone,
      scenarioInputsFromState,
      scenarioOutputsFromState,
      persist,
      renderScenarioManagerC1,
      markMcStale,
      applyStateToUI,
      render,
      safeCall,
      renderDecisionSessionD1,
      createDecisionSessionActions,
      wireScenarioManagerBindings,
      wireDecisionSessionBindings,
      makeDecisionSessionId,
      makeDecisionOptionId,
      OBJECTIVE_TEMPLATES,
      getActiveDecisionSession,
      ensureDecisionSessionShape,
      getActiveDecisionOption,
      ensureDecisionOptionShape,
      renderDecisionSummaryD4,
      buildDecisionSummaryText,
      copyTextToClipboard,
      decisionSummaryPlainText,
      decisionSessionExportObject,
      downloadJsonObject,
      runSensitivitySnapshotE4,
    });
  });
  runInitStep("init.runInitPostBoot", () => {
    runInitPostBootModule({
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
      getState: () => state,
      SCENARIO_BASELINE_ID,
      scenarioInputsFromState,
      scenarioOutputsFromState,
      renderScenarioManagerC1,
      persist,
    });
    bootProbeSetStatus("ready", { source: "appRuntime.init" });
  });

  try{
    window.setTimeout(() => {
      const status = getBootProbeStatus();
      if (String(status?.status || "") === "ready") return;
      bootProbeMark("init.readyTimeout", { status: String(status?.status || "unknown") });
      recordError("boot-probe", "Startup did not reach ready state within 6000ms.", {
        status: String(status?.status || "unknown"),
      });
    }, 6000);
  } catch {}
}


// =========================
// Phase 5.5 — Self-test accessors (dev-only)
// =========================
export function getStateSnapshot(){
  // Deep clone to prevent accidental mutation from dev tools.
  try{
    return JSON.parse(JSON.stringify(state));
  } catch {
    // Fallback shallow snapshot
    return { ...state };
  }
}

export function getSelfTestAccessors(){
  return {
    // state / context
    getStateSnapshot,
    withPatchedState,

    // deterministic (self-test expects computeAll accessor)
    computeAll: (mi, options) => engine.computeAll(mi, options),
    deriveNeedVotes,
    derivedWeeksRemaining,

    // ROI + optimization (via facade)
    computeRoiRows: (...args) => engine.computeRoiRows(...args),
    buildOptimizationTactics: (...args) => engine.buildOptimizationTactics(...args),

    // optimization shims (self-test expects these exact names)
    optimizeMixBudget: (args) => engine.optimizeMixBudget(args),
    optimizeMixCapacity: (args) => engine.optimizeMixCapacity(args),

    // timeline helpers (self-test expects these names)
    computeTimelineFeasibility: (args) => engine.computeTimelineFeasibility(args),
    computeMaxAttemptsByTactic: (args) => engine.computeMaxAttemptsByTactic(args),


    // capacity helpers
    computeCapacityBreakdown,
    computeCapacityContacts,

    // Monte Carlo
    runMonteCarloSim,
  };
}
/* =========================
   Phase 3 — Execution + Risk
   ========================= */

function syncMcModeUI(){
  const mcBasicEl = els?.mcBasic || null;
  const mcAdvancedEl = els?.mcAdvanced || null;
  const mcModeEl = els?.mcMode || null;
  if (!mcModeEl) return;
  const mode = mcModeEl.value || "basic";
  if (mcBasicEl) mcBasicEl.classList.toggle("active", mode === "basic");
  if (mcAdvancedEl) mcAdvancedEl.classList.toggle("active", mode === "advanced");
}


function syncGotvModeUI(){
  const gotvBasicEl = els?.gotvBasic || null;
  const gotvAdvancedEl = els?.gotvAdvanced || null;
  const gotvModeEl = els?.gotvMode || null;
  if (!gotvModeEl) return;
  const mode = gotvModeEl.value || "basic";
  if (gotvBasicEl) gotvBasicEl.classList.toggle("active", mode === "basic");
  if (gotvAdvancedEl) gotvAdvancedEl.classList.toggle("active", mode === "advanced");
}

let mcStateController = null;

function getMcStateController(){
  if (mcStateController) return mcStateController;
  mcStateController = createMcStateController({
    els,
    getState: () => state,
    setHidden,
    normalizeDailyLogEntry,
    computeSnapshotHash,
  });
  return mcStateController;
}

function markMcStale(){
  return getMcStateController().markMcStale();
}


function withPatchedState(patch, fn){
  return withPatchedStateModule({
    getStateSnapshot,
    getState: () => state,
    setState: (next) => { state = next; },
    syncFeatureFlagsFromState,
    patch,
    fn,
  });
}


function clearMcStale(){
  return getMcStateController().clearMcStale();
}

function computeDailyLogHash(){
  return getMcStateController().computeDailyLogHash();
}

let mcEnvelopeController = null;

function getMcEnvelopeController(){
  if (mcEnvelopeController) return mcEnvelopeController;
  mcEnvelopeController = createMcEnvelopeController({
    els,
    getState: () => state,
    getLastRenderCtx: () => lastRenderCtx,
    setTextPair,
    setHidden,
    hashMcInputs,
    getMcStaleness: (args) => getMcStaleness(args),
    computeDailyLogHash,
    computeWeeklyOpsContext,
    computeLastNLogSums,
    getEffectiveBaseRates,
    safeNum,
    makeRng,
    triSample,
    clamp,
    computeSnapshotHash,
    fmtISODate,
    persist,
    fmtInt,
  });
  return mcEnvelopeController;
}

function renderMcFreshness(res, weeks, opts = {}){
  return getMcEnvelopeController().renderMcFreshness(res, weeks, opts);
}

function hashOpsEnvelopeInputs(res, weeks){
  return getMcEnvelopeController().hashOpsEnvelopeInputs(res, weeks);
}

function computeOpsEnvelopeD2(res, weeks, opts = {}){
  return getMcEnvelopeController().computeOpsEnvelopeD2(res, weeks, opts);
}

function renderOpsEnvelopeD2(res, weeks, opts = {}){
  return getMcEnvelopeController().renderOpsEnvelopeD2(res, weeks, opts);
}

function hashFinishEnvelopeInputs(res, weeks){
  return getMcEnvelopeController().hashFinishEnvelopeInputs(res, weeks);
}

function computeFinishEnvelopeD3(res, weeks, opts = {}){
  return getMcEnvelopeController().computeFinishEnvelopeD3(res, weeks, opts);
}

function renderFinishEnvelopeD3(res, weeks, opts = {}){
  return getMcEnvelopeController().renderFinishEnvelopeD3(res, weeks, opts);
}

function hashMissRiskInputs(res, weeks){
  return getMcEnvelopeController().hashMissRiskInputs(res, weeks);
}

function computeMissRiskD4(res, weeks, opts = {}){
  return getMcEnvelopeController().computeMissRiskD4(res, weeks, opts);
}

function renderMissRiskD4(res, weeks, opts = {}){
  return getMcEnvelopeController().renderMissRiskD4(res, weeks, opts);
}

function hashMcInputs(res, weeks){
  return hashMcInputsModule({
    state,
    res,
    weeks,
    deriveNeedVotes,
    safeNum,
    canonicalDoorsPerHourFromSnap,
  });
}

let planningRuntimeController = null;

function getPlanningRuntimeController(){
  if (planningRuntimeController) return planningRuntimeController;
  planningRuntimeController = createPlanningRuntimeController({
    els,
    getState: () => state,
    coreDeriveNeedVotesOrZero,
    coreComputeCapacityBreakdown,
    coreComputeCapacityContacts,
    getCapacityDecayConfigFromState,
    renderRoiModule,
    renderOptimizationModule,
    renderTimelineModule,
    renderPhase3Module,
    getEffectiveBaseRates,
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap,
    engine,
    computeAvgLiftPP,
    fmtInt,
    compileEffectiveInputs,
    renderMcFreshness,
    renderMcResults,
  });
  return planningRuntimeController;
}

function deriveNeedVotes(res, goalSupportIdsOverride = state.goalSupportIds){
  return getPlanningRuntimeController().deriveNeedVotes(res, goalSupportIdsOverride);
}

function renderRoi(res, weeks){
  return getPlanningRuntimeController().renderRoi(res, weeks);
}

function renderOptimization(res, weeks){
  return getPlanningRuntimeController().renderOptimization(res, weeks);
}

function renderTimeline(res, weeks){
  return getPlanningRuntimeController().renderTimeline(res, weeks);
}

function renderPhase3(res, weeks){
  return getPlanningRuntimeController().renderPhase3(res, weeks);
}

function computeCapacityBreakdown(args){
  return getPlanningRuntimeController().computeCapacityBreakdown(args);
}

function computeCapacityContacts(args){
  return getPlanningRuntimeController().computeCapacityContacts(args);
}

/* ---- Monte Carlo ---- */

let mcRuntimeController = null;

function getMcRuntimeController(){
  if (mcRuntimeController) return mcRuntimeController;
  mcRuntimeController = createMcRuntimeController({
    getState: () => state,
    setLastRenderCtx: (next) => { lastRenderCtx = next; },
    computeElectionSnapshot,
    computeExecutionSnapshot,
    computeWeeklyOpsContext,
    derivedWeeksRemaining,
    buildModelInputFromState,
    safeNum,
    engine,
    deriveNeedVotes,
    hashMcInputs,
    computeDailyLogHash,
    persist,
    clearMcStale,
    renderMcResults,
    renderMcFreshness,
    renderRiskFramingE2,
    renderSensitivitySnapshotE4,
  });
  return mcRuntimeController;
}

function runMonteCarloNow(){
  return getMcRuntimeController().runMonteCarloNow();
}

function runMonteCarloSim(...args){
  return getMcRuntimeController().runMonteCarloSim(...args);
}

function renderMcResults(summary){
  return renderMcResultsAdapterModule({
    renderMcResultsModule,
    els,
    summary,
    state,
    setTextPair,
    fmtSigned,
    fmtInt,
    renderMcVisuals,
  });
}

function renderMcVisuals(summary){
  return renderMcVisualsAdapterModule({
    renderMcVisualsModule,
    els,
    summary,
    clamp,
    fmtSigned,
  });
}

function fmtSigned(v){
  return fmtSignedModule(v, fmtInt);
}

init();
