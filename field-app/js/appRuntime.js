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
  CANDIDATE_HISTORY_OFFICE_OPTIONS,
  canonicalizeCandidateHistoryOffice,
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
  makeStateStorageKey,
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
import { createElectionDataBridge } from "./app/v3/bridges/electionDataBridge.js";
import { createMetricProvenanceTracker } from "./core/state/metricProvenance.js";
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
  listVoterAdapterOptions,
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
  runTargetRanking as runTargetRankingRuntime,
  resetTargetingWeightsToPreset,
  TARGETING_STATUS_LOAD_ROWS_FIRST,
} from "./app/targetingRuntime.js";
import * as targetingRuntimeModule from "./app/targetingRuntime.js";
import {
  updateDistrictFormField as updateDistrictFormFieldAction,
  updateDistrictTemplateField as updateDistrictTemplateFieldAction,
  updateDistrictUniverseField as updateDistrictUniverseFieldAction,
} from "./core/actions/district.js";
import {
  addBallotCandidate as addBallotCandidateAction,
  removeBallotCandidate as removeBallotCandidateAction,
  setBallotUndecided as setBallotUndecidedAction,
  setBallotYourCandidate as setBallotYourCandidateAction,
  updateBallotCandidate as updateBallotCandidateAction,
  updateBallotUserSplit as updateBallotUserSplitAction,
} from "./core/actions/ballot.js";
import {
  addCandidateHistoryRecord as addCandidateHistoryRecordAction,
  removeCandidateHistoryRecord as removeCandidateHistoryRecordAction,
  updateCandidateHistoryRecord as updateCandidateHistoryRecordAction,
} from "./core/actions/candidateHistory.js";
import {
  applyTargetingRunResult as applyTargetingRunResultAction,
  updateTargetingConfig as updateTargetingConfigAction,
  updateTargetingCriteria as updateTargetingCriteriaAction,
  updateTargetingWeights as updateTargetingWeightsAction,
} from "./core/actions/targeting.js";
import {
  updateCensusConfig as updateCensusConfigAction,
  updateCensusSelection as updateCensusSelectionAction,
} from "./core/actions/census.js";
import { selectDistrictCanonicalView } from "./core/selectors/districtCanonical.js";
import { selectTargetingCanonicalView } from "./core/selectors/targetingCanonical.js";
import { selectCensusCanonicalView } from "./core/selectors/censusCanonical.js";
import { selectElectionDataCanonicalView } from "./core/selectors/electionDataCanonical.js";
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
import { createDataBridgeRuntime } from "./app/dataBridgeRuntime.js";
import { createDecisionBridgeRuntime } from "./app/decisionBridgeRuntime.js";
import { createDistrictBridgeActionsRuntime } from "./app/districtBridgeActionsRuntime.js";
import { createDistrictBridgeHelpersRuntime } from "./app/districtBridgeHelpersRuntime.js";
import { createOutcomeBridgeRuntime } from "./app/outcomeBridgeRuntime.js";
import { createPlanBridgeRuntime } from "./app/planBridgeRuntime.js";
import { createReachBridgeRuntime } from "./app/reachBridgeRuntime.js";
import { createScenarioBridgeRuntime } from "./app/scenarioBridgeRuntime.js";
import { createShellBridgeRuntime } from "./app/shellBridgeRuntime.js";
import { createTurnoutBridgeRuntime } from "./app/turnoutBridgeRuntime.js";
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

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

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
const ELECTION_DATA_BRIDGE_KEY = "__FPE_ELECTION_DATA_API__";
const REACH_BRIDGE_KEY = "__FPE_REACH_API__";
const TURNOUT_BRIDGE_KEY = "__FPE_TURNOUT_API__";
const PLAN_BRIDGE_KEY = "__FPE_PLAN_API__";
const OUTCOME_BRIDGE_KEY = "__FPE_OUTCOME_API__";
const DECISION_BRIDGE_KEY = "__FPE_DECISION_API__";
const METRIC_PROVENANCE_BRIDGE_KEY = "__FPE_METRIC_PROVENANCE_API__";
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

let shellBridgeController = null;

function getShellBridgeController(){
  if (!shellBridgeController){
    shellBridgeController = createShellBridgeRuntime({
      shellBridgeKey: SHELL_BRIDGE_KEY,
      getState: () => state,
      replaceState: (nextState) => { state = nextState; },
      getLastResultsSnapshot: () => lastResultsSnapshot,
      setText,
      els,
      resolveActiveContext,
      applyActiveContextToLinks,
      validateCampaignContext,
      observeContractEvent,
      loadState,
      normalizeLoadedScenarioRuntime,
      makeDefaultStateModule,
      uid,
      refreshModelAuditFromArchive,
      ensureScenarioRegistry,
      ensureDecisionScaffold,
      SCENARIO_BASELINE_ID,
      scenarioInputsFromState,
      scenarioOutputsFromState,
      applyStateToUI,
      rebuildCandidateTable,
      render,
      safeCall,
      renderScenarioManagerC1,
      renderDecisionSessionD1,
      persist,
      schedulePersist,
      notifyBridgeSync,
      clearState,
      makeDefaultState,
      applyThemeFromState,
      openDiagnostics,
      makeStateStorageKey,
      APP_VERSION,
      BUILD_ID,
      getRuntimeSchemaVersion: () => Number(engine?.snapshot?.CURRENT_SCHEMA_VERSION || 0) || 0,
      selectDistrictCanonicalView,
      cleanText,
      safeNum,
      windowRef: typeof window !== "undefined" ? window : null,
      documentRef: typeof document !== "undefined" ? document : null,
      confirmFn: typeof confirm === "function" ? confirm.bind(globalThis) : null,
    });
  }
  return shellBridgeController;
}

function shellBridgeStateView(){
  return getShellBridgeController().stateView();
}

function shellBridgeRuntimeDiagnostics(){
  return getShellBridgeController().runtimeDiagnostics();
}

function shellBridgeSetScenarioName(rawValue){
  return getShellBridgeController().setScenarioName(rawValue);
}

function shellBridgeSetContext(rawPatch){
  return getShellBridgeController().setContext(rawPatch);
}

function shellBridgeSetTrainingEnabled(enabled){
  return getShellBridgeController().setTrainingEnabled(enabled);
}

function shellBridgeSetPlaybookEnabled(enabled){
  return getShellBridgeController().setPlaybookEnabled(enabled);
}

function shellBridgeOpenDiagnostics(){
  return getShellBridgeController().openDiagnostics();
}

function shellBridgeResetScenario(){
  return getShellBridgeController().resetScenario();
}

function shellBridgeSyncContextLinks(){
  return getShellBridgeController().syncContextLinks();
}

function shellBridgeSyncPlaybookUiState(){
  return getShellBridgeController().syncPlaybookUiState();
}

function installShellBridge(){
  getShellBridgeController().install();
}

let dataBridgeController = null;

function getDataBridgeController(){
  if (!dataBridgeController){
    dataBridgeController = createDataBridgeRuntime({
      dataBridgeKey: DATA_BRIDGE_KEY,
      getState: () => state,
      replaceState: (nextState) => { state = nextState; },
      getLastRenderCtx: () => lastRenderCtx,
      getLastResultsSnapshot: () => lastResultsSnapshot,
      setLastExportHash: (nextValue) => { lastExportHash = nextValue; },
      els,
      readBackups,
      readForecastArchive,
      buildForecastArchiveOptions,
      forecastArchiveContextFromState,
      summarizeForecastArchive,
      resolveActiveContext,
      resolveForecastArchiveSelectedHash,
      buildForecastArchiveSelectedEntryView,
      buildModelLearningFromArchive,
      buildForecastArchiveTableRows,
      buildVoterLayerStatusSnapshot,
      listVoterAdapterOptions,
      normalizeBridgeSelectValue,
      listReportTypeOptions,
      normalizeReportType,
      buildReportPlainText,
      getUsbStorageController,
      engine,
      APP_VERSION,
      BUILD_ID,
      downloadText,
      readJsonFile,
      requiredScenarioKeysMissing,
      normalizeLoadedScenarioRuntime,
      observeContractEvent,
      diagnosticContextFromState,
      refreshModelAuditFromArchive,
      ensureScenarioRegistry,
      ensureDecisionScaffold,
      SCENARIO_BASELINE_ID,
      scenarioInputsFromState,
      scenarioOutputsFromState,
      applyStateToUI,
      rebuildCandidateTable,
      shellBridgeSyncPlaybookUiState,
      applyThemeFromState,
      render,
      safeCall,
      renderDecisionSessionD1,
      persist,
      notifyBridgeSync,
      setState,
      mutateState,
      schedulePersist,
      restoreBackupByIndex,
      parseVoterRowsInput,
      normalizeVoterRows,
      normalizeVoterDataState,
      buildVoterImportOutcomeView,
      normalizeForecastArchiveActual,
      updateForecastArchiveActual,
      composeReportPayload,
      exportReportPdf,
      windowRef: typeof window !== "undefined" ? window : null,
      documentRef: typeof document !== "undefined" ? document : null,
    });
  }
  return dataBridgeController;
}

function dataBridgeBuildBackupOptions(){
  return getDataBridgeController().dataBridgeBuildBackupOptions();
}

function dataBridgeBuildArchiveRows(){
  return getDataBridgeController().dataBridgeBuildArchiveRows();
}

function dataBridgeBuildArchiveOptions(entries = []){
  return getDataBridgeController().dataBridgeBuildArchiveOptions(entries);
}

function dataBridgeEnsureVoterImportDraftState(){
  return getDataBridgeController().dataBridgeEnsureVoterImportDraftState();
}

function dataBridgeEnsureReportingState(){
  return getDataBridgeController().dataBridgeEnsureReportingState();
}

function dataBridgeHasFsSupport(){
  return getDataBridgeController().dataBridgeHasFsSupport();
}

function dataBridgeNormalizeWarnings(list){
  return getDataBridgeController().dataBridgeNormalizeWarnings(list);
}

function dataBridgeSetHashBannerText(text){
  return getDataBridgeController().dataBridgeSetHashBannerText(text);
}

function dataBridgeSetWarnBannerText(text){
  return getDataBridgeController().dataBridgeSetWarnBannerText(text);
}

function dataBridgeSetImportFileName(name){
  return getDataBridgeController().dataBridgeSetImportFileName(name);
}

function dataBridgeSetUsbStatusText(text){
  return getDataBridgeController().dataBridgeSetUsbStatusText(text);
}

function dataBridgeSetVoterImportStatusText(text){
  return getDataBridgeController().dataBridgeSetVoterImportStatusText(text);
}

function dataBridgeApplyUsbResultStatus(result){
  return getDataBridgeController().dataBridgeApplyUsbResultStatus(result);
}

function dataBridgeApplyImportedScenario(nextScenario){
  return getDataBridgeController().dataBridgeApplyImportedScenario(nextScenario);
}

function dataBridgeRunSaveJson(){
  return getDataBridgeController().dataBridgeRunSaveJson();
}

function dataBridgeRunExportCsv(){
  return getDataBridgeController().dataBridgeRunExportCsv();
}

function dataBridgeRunCopySummary(){
  return getDataBridgeController().dataBridgeRunCopySummary();
}

function dataBridgePickJsonFile(){
  return getDataBridgeController().dataBridgePickJsonFile();
}

function dataBridgeImportJsonFile(file){
  return getDataBridgeController().dataBridgeImportJsonFile(file);
}

function dataBridgeStateView(){
  return getDataBridgeController().dataBridgeStateView();
}

function dataBridgeSetStrictImport(enabled){
  return getDataBridgeController().dataBridgeSetStrictImport(enabled);
}

function dataBridgeRestoreBackup(index){
  return getDataBridgeController().dataBridgeRestoreBackup(index);
}

function dataBridgeSetArchiveSelection(snapshotHash){
  return getDataBridgeController().dataBridgeSetArchiveSelection(snapshotHash);
}

function dataBridgeSetVoterImportDraft(payload = {}){
  return getDataBridgeController().dataBridgeSetVoterImportDraft(payload);
}

function dataBridgeSaveArchiveActual(payload = {}){
  return getDataBridgeController().dataBridgeSaveArchiveActual(payload);
}

function dataBridgeRefreshArchive(){
  return getDataBridgeController().dataBridgeRefreshArchive();
}

function dataBridgeImportVoterRows(payload = {}){
  return getDataBridgeController().dataBridgeImportVoterRows(payload);
}

function dataBridgeComposeReport(payload = {}){
  return getDataBridgeController().dataBridgeComposeReport(payload);
}

function dataBridgeSetReportType(reportType){
  return getDataBridgeController().dataBridgeSetReportType(reportType);
}

function dataBridgeExportReportPdf(payload = {}){
  return getDataBridgeController().dataBridgeExportReportPdf(payload);
}

function dataBridgeTrigger(action){
  return getDataBridgeController().dataBridgeTrigger(action);
}

function installDataBridge(){
  return getDataBridgeController().installDataBridge();
}

let outcomeBridgeController = null;

function getOutcomeBridgeController(){
  if (!outcomeBridgeController){
    outcomeBridgeController = createOutcomeBridgeRuntime({
      outcomeBridgeKey: OUTCOME_BRIDGE_KEY,
      getState: () => state,
      setState,
      mutateState,
      getLastRenderCtx: () => lastRenderCtx,
      getStateSnapshot,
      isScenarioLockedForEdits,
      normalizeBridgeSelectOptions,
      normalizeBridgeSelectValue,
      bridgeSelectOptionsWithSelected,
      reachBridgeClampNumber,
      surfaceLeverSpec,
      surfaceBaselineValue,
      surfaceClamp,
      roundWholeNumberByMode,
      safeNum,
      canonicalDoorsPerHourFromSnap,
      canonicalCallsPerHourFromSnap,
      setCanonicalDoorsPerHour,
      setCanonicalCallsPerHour,
      syncMcModeUI,
      markMcStale,
      runMonteCarloNow,
      computeRealityDrift,
      runRealismEngine,
      computeEvidenceWarnings,
      computeModelGovernance,
      buildGovernanceSnapshotView,
      withPatchedState,
      runMonteCarloSim,
      computeElectionSnapshot,
      buildModelInputFromState,
      derivedWeeksRemaining,
      deriveNeedVotes,
      buildOutcomeSurfaceSummaryText,
      engine,
      windowRef: typeof window !== "undefined" ? window : null,
      documentRef: typeof document !== "undefined" ? document : null,
    });
  }
  return outcomeBridgeController;
}

function outcomeBridgeSelectId(field){
  return getOutcomeBridgeController().outcomeBridgeSelectId(field);
}

function outcomeBridgeControlId(field){
  return getOutcomeBridgeController().outcomeBridgeControlId(field);
}

function outcomeBridgeReadSelectOptions(field){
  return getOutcomeBridgeController().outcomeBridgeReadSelectOptions(field);
}

function outcomeBridgeReadLegacyControlValue(field){
  return getOutcomeBridgeController().outcomeBridgeReadLegacyControlValue(field);
}

function outcomeBridgeDefaultSelectValue(field, preferredValue = ""){
  return getOutcomeBridgeController().outcomeBridgeDefaultSelectValue(field, preferredValue);
}

function outcomeBridgeResolvedSurfaceInputs(){
  return getOutcomeBridgeController().outcomeBridgeResolvedSurfaceInputs();
}

function outcomeBridgeSyncLegacyControl(field, value){
  return getOutcomeBridgeController().outcomeBridgeSyncLegacyControl(field, value);
}

function outcomeBridgeWriteSurfaceInputs(nextState, surfaceInputs){
  return getOutcomeBridgeController().outcomeBridgeWriteSurfaceInputs(nextState, surfaceInputs);
}

function outcomeBridgeWriteSurfaceCache(nextState, payload = {}){
  return getOutcomeBridgeController().outcomeBridgeWriteSurfaceCache(nextState, payload);
}

function outcomeBridgeSetSurfaceComputing(nextState, enabled){
  return getOutcomeBridgeController().outcomeBridgeSetSurfaceComputing(nextState, enabled);
}

function outcomeBridgeNormalizeSelect(field, rawValue){
  return getOutcomeBridgeController().outcomeBridgeNormalizeSelect(field, rawValue);
}

function outcomeBridgeNormalizeNumber(field, rawValue){
  return getOutcomeBridgeController().outcomeBridgeNormalizeNumber(field, rawValue);
}

function outcomeBridgeApplySurfaceField(field, rawValue){
  return getOutcomeBridgeController().outcomeBridgeApplySurfaceField(field, rawValue);
}

function outcomeBridgeCanonicalView(){
  return getOutcomeBridgeController().outcomeBridgeCanonicalView();
}

function outcomeBridgeDerivedGovernanceView(){
  return getOutcomeBridgeController().outcomeBridgeDerivedGovernanceView();
}

function outcomeBridgeDerivedView(){
  return getOutcomeBridgeController().outcomeBridgeDerivedView();
}

function outcomeBridgeCombinedView(){
  return getOutcomeBridgeController().outcomeBridgeCombinedView();
}

function outcomeBridgeStateView(){
  return getOutcomeBridgeController().outcomeBridgeStateView();
}

function outcomeBridgeBuildSurfaceSummaryText(payload = {}){
  return getOutcomeBridgeController().outcomeBridgeBuildSurfaceSummaryText(payload);
}

function outcomeBridgeSetField(field, rawValue){
  return getOutcomeBridgeController().outcomeBridgeSetField(field, rawValue);
}

function outcomeBridgeRunMc(){
  return getOutcomeBridgeController().outcomeBridgeRunMc();
}

function outcomeBridgeRerunMc(){
  return getOutcomeBridgeController().outcomeBridgeRerunMc();
}

function outcomeBridgeComputeSurface(){
  return getOutcomeBridgeController().outcomeBridgeComputeSurface();
}

function installOutcomeBridge(){
  return getOutcomeBridgeController().installOutcomeBridge();
}

let planBridgeController = null;

function getPlanBridgeController(){
  if (!planBridgeController){
    planBridgeController = createPlanBridgeRuntime({
      planBridgeKey: PLAN_BRIDGE_KEY,
      getState: () => state,
      mutateState,
      render,
      isScenarioLockedForEdits,
      normalizeBridgeSelectOptions,
      normalizeBridgeSelectValue,
      bridgeSelectOptionsWithSelected,
      normalizeOptimizationObjective,
      getOptimizationObjectiveCopy,
      buildCanonicalPlanSummaryView,
      normalizePlanOptimizerRows,
      getTimelineFeasibilityObjectiveMeta,
      getTimelineObjectiveMeta,
      formatWholeNumberByMode,
      formatPlanWhole,
      formatPlanCurrency,
      formatPlanPercentUnit,
      reachBridgeClampNumber,
      safeNum,
      windowRef: typeof window !== "undefined" ? window : null,
    });
  }
  return planBridgeController;
}

function ensurePlanBridgeShape(target){
  return getPlanBridgeController().ensurePlanBridgeShape(target);
}

function planBridgeBuildSummaryView(){
  return getPlanBridgeController().planBridgeBuildSummaryView();
}

function planBridgeStateView(){
  return getPlanBridgeController().planBridgeStateView();
}

function planBridgeNormalizeSelect(field, rawValue){
  return getPlanBridgeController().planBridgeNormalizeSelect(field, rawValue);
}

function planBridgeNormalizeNumber(field, rawValue){
  return getPlanBridgeController().planBridgeNormalizeNumber(field, rawValue);
}

function planBridgeSetField(field, rawValue){
  return getPlanBridgeController().planBridgeSetField(field, rawValue);
}

function planBridgeRunOptimize(){
  return getPlanBridgeController().planBridgeRunOptimize();
}

function installPlanBridge(){
  return getPlanBridgeController().installPlanBridge();
}

let turnoutBridgeController = null;

function getTurnoutBridgeController(){
  if (!turnoutBridgeController){
    turnoutBridgeController = createTurnoutBridgeRuntime({
      turnoutBridgeKey: TURNOUT_BRIDGE_KEY,
      getState: () => state,
      mutateState,
      render,
      isScenarioLockedForEdits,
      normalizeBridgeSelectValue,
      normalizeBridgeSelectOptions,
      bridgeSelectOptionsWithSelected,
      reachBridgeClampNumber,
      safeNum,
      syncGotvModeUI,
      markMcStale,
      windowRef: typeof window !== "undefined" ? window : null,
    });
  }
  return turnoutBridgeController;
}

function ensureTurnoutBridgeShape(target){
  return getTurnoutBridgeController().ensureTurnoutBridgeShape(target);
}

function turnoutBridgeStateView(){
  return getTurnoutBridgeController().turnoutBridgeStateView();
}

function turnoutBridgeNormalizeSelect(field, rawValue){
  return getTurnoutBridgeController().turnoutBridgeNormalizeSelect(field, rawValue);
}

function turnoutBridgeNormalizeNumber(field, rawValue){
  return getTurnoutBridgeController().turnoutBridgeNormalizeNumber(field, rawValue);
}

function turnoutBridgeSetField(field, rawValue){
  return getTurnoutBridgeController().turnoutBridgeSetField(field, rawValue);
}

function turnoutBridgeRefreshRoi(){
  return getTurnoutBridgeController().turnoutBridgeRefreshRoi();
}

function installTurnoutBridge(){
  return getTurnoutBridgeController().installTurnoutBridge();
}

let decisionBridgeController = null;

function getDecisionBridgeController(){
  if (!decisionBridgeController){
    decisionBridgeController = createDecisionBridgeRuntime({
      decisionBridgeKey: DECISION_BRIDGE_KEY,
      getState: () => state,
      getLastRenderCtx: () => lastRenderCtx,
      safeCall,
      renderDecisionSessionD1,
      renderDecisionSummaryD4,
      ensureDecisionSessionShape,
      ensureDecisionOptionShape,
      ensureWarRoomStateShape,
      ensureEventCalendarStateShape,
      deriveVoterModelSignals,
      extractCensusAgeDistribution,
      safeNum,
      buildWarRoomReviewBaselineView,
      ensureScenarioRegistry,
      ensureDecisionScaffold,
      listDecisionSessions,
      getActiveDecisionSession,
      listDecisionOptions,
      getActiveDecisionOption,
      decisionOptionDisplay,
      decisionScenarioLabel,
      buildDecisionSummaryText,
      buildDecisionDiagnosticsSnapshotView,
      DECISION_DIVERGENCE_KEY_ORDER,
      clamp,
      fmtInt,
      buildWarRoomChangeClassificationView,
      buildWarRoomDecisionLogRowsView,
      buildWarRoomWeatherView,
      buildEventCalendarView,
      OBJECTIVE_TEMPLATES,
      RISK_POSTURES,
      SCENARIO_BASELINE_ID,
      persist,
      makeDecisionSessionId,
      makeDecisionOptionId,
      uid,
      normalizeZip,
      resolveSelectedZip,
      applyWeatherModeToState,
      fetchWarRoomWeatherByZip,
      applyWeatherObservationToState,
      WEATHER_MODE_TODAY_ONLY,
      WEATHER_MODE_OBSERVE_ONLY,
      setEventCalendarFilter,
      setEventCalendarDraftField,
      saveEventCalendarDraftAsEvent,
      loadEventCalendarDraft,
      clearEventCalendarDraft,
      deleteEventCalendarRecord,
      updateEventCalendarApplyToModel,
      setEventCalendarStatus,
      copyTextToClipboard,
      decisionSummaryPlainText,
      decisionSessionExportObject,
      downloadJsonObject,
      getMcStaleness,
      hashMcInputs,
      computeDailyLogHash,
      computeDecisionSensitivityMiniSurfaceCache,
      runMonteCarloSim,
      canonicalDoorsPerHourFromSnap,
      canonicalCallsPerHourFromSnap,
      setCanonicalDoorsPerHour,
      setCanonicalCallsPerHour,
      renderSensitivitySnapshotE4,
      windowRef: typeof window !== "undefined" ? window : null,
      documentRef: typeof document !== "undefined" ? document : null,
    });
  }
  return decisionBridgeController;
}

function decisionBridgeParseMaybeNumber(raw){
  return getDecisionBridgeController().decisionBridgeParseMaybeNumber(raw);
}

function decisionBridgeLineList(raw){
  return getDecisionBridgeController().decisionBridgeLineList(raw);
}

function decisionBridgeNormalizeWarRoomSession(session){
  return getDecisionBridgeController().decisionBridgeNormalizeWarRoomSession(session);
}

function decisionBridgeEnsureWarRoomState(){
  return getDecisionBridgeController().decisionBridgeEnsureWarRoomState();
}

function decisionBridgeWarRoomCurrentBaseline(session, diagnostics){
  return getDecisionBridgeController().decisionBridgeWarRoomCurrentBaseline(session, diagnostics);
}

function decisionBridgeCurrentSnapshot(){
  return getDecisionBridgeController().decisionBridgeCurrentSnapshot();
}

function decisionBridgeDiagnosticsSnapshot(){
  return getDecisionBridgeController().decisionBridgeDiagnosticsSnapshot();
}

function decisionBridgeStateView(){
  return getDecisionBridgeController().decisionBridgeStateView();
}

function decisionBridgeSelectSession(id){
  return getDecisionBridgeController().decisionBridgeSelectSession(id);
}

function decisionBridgeCreateSession(name){
  return getDecisionBridgeController().decisionBridgeCreateSession(name);
}

function decisionBridgeRenameSession(name){
  return getDecisionBridgeController().decisionBridgeRenameSession(name);
}

function decisionBridgeDeleteSession(){
  return getDecisionBridgeController().decisionBridgeDeleteSession();
}

function decisionBridgeLinkSessionToActiveScenario(){
  return getDecisionBridgeController().decisionBridgeLinkSessionToActiveScenario();
}

function decisionBridgeUpdateSessionField(field, value){
  return getDecisionBridgeController().decisionBridgeUpdateSessionField(field, value);
}

function decisionBridgeSelectOption(id){
  return getDecisionBridgeController().decisionBridgeSelectOption(id);
}

function decisionBridgeCreateOption(name){
  return getDecisionBridgeController().decisionBridgeCreateOption(name);
}

function decisionBridgeRenameOption(name){
  return getDecisionBridgeController().decisionBridgeRenameOption(name);
}

function decisionBridgeDeleteOption(){
  return getDecisionBridgeController().decisionBridgeDeleteOption();
}

function decisionBridgeLinkOptionToActiveScenario(){
  return getDecisionBridgeController().decisionBridgeLinkOptionToActiveScenario();
}

function decisionBridgeSetOptionTactic(kind, enabled){
  return getDecisionBridgeController().decisionBridgeSetOptionTactic(kind, enabled);
}

function decisionBridgeSetRecommendedOption(id){
  return getDecisionBridgeController().decisionBridgeSetRecommendedOption(id);
}

function decisionBridgeSetWhatNeedsTrue(raw){
  return getDecisionBridgeController().decisionBridgeSetWhatNeedsTrue(raw);
}

function decisionBridgeCaptureReviewBaseline(){
  return getDecisionBridgeController().decisionBridgeCaptureReviewBaseline();
}

function decisionBridgeLogDecision(){
  return getDecisionBridgeController().decisionBridgeLogDecision();
}

function decisionBridgeSetDecisionLogStatus(id, status){
  return getDecisionBridgeController().decisionBridgeSetDecisionLogStatus(id, status);
}

function decisionBridgeSetWeatherField(field, value){
  return getDecisionBridgeController().decisionBridgeSetWeatherField(field, value);
}

function decisionBridgeSetWeatherMode(mode){
  return getDecisionBridgeController().decisionBridgeSetWeatherMode(mode);
}

async function decisionBridgeRefreshWeather(){
  return getDecisionBridgeController().decisionBridgeRefreshWeather();
}

function decisionBridgeSetEventFilter(field, value){
  return getDecisionBridgeController().decisionBridgeSetEventFilter(field, value);
}

function decisionBridgeSetEventDraftField(field, value){
  return getDecisionBridgeController().decisionBridgeSetEventDraftField(field, value);
}

function decisionBridgeSaveEventDraft(){
  return getDecisionBridgeController().decisionBridgeSaveEventDraft();
}

function decisionBridgeLoadEventDraft(eventId){
  return getDecisionBridgeController().decisionBridgeLoadEventDraft(eventId);
}

function decisionBridgeClearEventDraft(){
  return getDecisionBridgeController().decisionBridgeClearEventDraft();
}

function decisionBridgeDeleteEvent(eventId){
  return getDecisionBridgeController().decisionBridgeDeleteEvent(eventId);
}

function decisionBridgeSetEventApplyToModel(eventId, enabled){
  return getDecisionBridgeController().decisionBridgeSetEventApplyToModel(eventId, enabled);
}

function decisionBridgeSetEventStatus(eventId, status){
  return getDecisionBridgeController().decisionBridgeSetEventStatus(eventId, status);
}

async function decisionBridgeCopySummary(kind = "markdown"){
  return getDecisionBridgeController().decisionBridgeCopySummary(kind);
}

function decisionBridgeDownloadSummaryJson(){
  return getDecisionBridgeController().decisionBridgeDownloadSummaryJson();
}

async function decisionBridgeRunSensitivitySnapshot(){
  return getDecisionBridgeController().decisionBridgeRunSensitivitySnapshot();
}

function installDecisionBridge(){
  return getDecisionBridgeController().installDecisionBridge();
}

function installMetricProvenanceBridge(){
  window[METRIC_PROVENANCE_BRIDGE_KEY] = {
    getView: () => metricProvenanceTracker.compute(state),
    getMetrics: () => {
      const view = metricProvenanceTracker.compute(state);
      return view?.metrics || {};
    },
    reset: () => {
      metricProvenanceTracker.reset();
      return { ok: true };
    },
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
const metricProvenanceTracker = createMetricProvenanceTracker();
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

function normalizeLoadedScenarioRuntime(s, options = {}){
  const opts = (options && typeof options === "object") ? options : {};
  const contextInput = opts.context && typeof opts.context === "object"
    ? opts.context
    : {};
  const activeContext = resolveActiveContext(contextInput);
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

let scenarioBridgeController = null;

function getScenarioBridgeController(){
  if (!scenarioBridgeController){
    scenarioBridgeController = createScenarioBridgeRuntime({
      scenarioBridgeKey: SCENARIO_BRIDGE_KEY,
      scenarioBaselineId: SCENARIO_BASELINE_ID,
      scenarioMax: SCENARIO_MAX,
      getState: () => state,
      replaceState: (next) => { state = next; },
      ensureScenarioRegistry,
      listScenarioRecords,
      buildScenarioWorkspaceSummaryView,
      scenarioClone,
      scenarioInputsFromState,
      scenarioOutputsFromState,
      setScenarioWarn,
      uid,
      persist,
      notifyBridgeSync,
      markMcStale,
      applyStateToUI,
      render,
      safeCall,
      renderScenarioManagerC1,
      renderDecisionSessionD1,
      ensureIntelCollections,
      commitUIUpdate,
      upsertBenchmarkEntry,
      loadDefaultBenchmarksForRaceType,
      removeBenchmarkEntry,
      attachEvidenceRecord,
      generateScenarioSummaryBrief,
      generateScenarioDiffBrief,
      generateDriftExplanationBrief,
      generateSensitivityInterpretationBrief,
      generateCalibrationSourceBrief,
      addDefaultCorrelationModel,
      importCorrelationModelsJson,
      addDefaultShockScenario,
      importShockScenariosJson,
      computeRealityDrift,
      captureObservedMetricsFromDrift,
      captureObservedAndRefreshDriftRecommendations,
      createWhatIfIntelRequest,
      applyTopDriftRecommendation,
      windowRef: typeof window !== "undefined" ? window : null,
      documentRef: typeof document !== "undefined" ? document : null,
    });
  }
  return scenarioBridgeController;
}

function hasLegacyScenarioManagerDom(){
  return getScenarioBridgeController().hasLegacyScenarioManagerDom();
}

function refreshLegacyScenarioManagerIfMounted(){
  return getScenarioBridgeController().refreshLegacyScenarioManagerIfMounted();
}

function scenarioBridgeStateView(){
  return getScenarioBridgeController().scenarioBridgeStateView();
}

function scenarioBridgeSelect(id){
  return getScenarioBridgeController().scenarioBridgeSelect(id);
}

function scenarioBridgeSaveNew(name){
  return getScenarioBridgeController().scenarioBridgeSaveNew(name);
}

function scenarioBridgeCloneBaseline(name){
  return getScenarioBridgeController().scenarioBridgeCloneBaseline(name);
}

function scenarioBridgeLoad(id){
  return getScenarioBridgeController().scenarioBridgeLoad(id);
}

function scenarioBridgeDeleteSelected(){
  return getScenarioBridgeController().scenarioBridgeDeleteSelected();
}

function scenarioBridgeEnsureIntelWorkflow(targetState){
  return getScenarioBridgeController().scenarioBridgeEnsureIntelWorkflow(targetState);
}

function scenarioBridgeEnsureIntelToggles(targetState){
  return getScenarioBridgeController().scenarioBridgeEnsureIntelToggles(targetState);
}

function scenarioBridgeUpdateIntelWorkflow(patch){
  return getScenarioBridgeController().scenarioBridgeUpdateIntelWorkflow(patch);
}

function scenarioBridgeUpdateIntelSimToggles(patch){
  return getScenarioBridgeController().scenarioBridgeUpdateIntelSimToggles(patch);
}

function scenarioBridgeUpdateIntelExpertToggles(patch){
  return getScenarioBridgeController().scenarioBridgeUpdateIntelExpertToggles(patch);
}

function scenarioBridgeSetPendingCriticalNote(note){
  return getScenarioBridgeController().scenarioBridgeSetPendingCriticalNote(note);
}

function scenarioBridgeSaveBenchmark(payload){
  return getScenarioBridgeController().scenarioBridgeSaveBenchmark(payload);
}

function scenarioBridgeLoadDefaultBenchmarks(scopeInput){
  return getScenarioBridgeController().scenarioBridgeLoadDefaultBenchmarks(scopeInput);
}

function scenarioBridgeRemoveBenchmark(benchmarkId){
  return getScenarioBridgeController().scenarioBridgeRemoveBenchmark(benchmarkId);
}

function scenarioBridgeAttachEvidence(payload){
  return getScenarioBridgeController().scenarioBridgeAttachEvidence(payload);
}

function scenarioBridgeGenerateIntelBrief(kind){
  return getScenarioBridgeController().scenarioBridgeGenerateIntelBrief(kind);
}

function scenarioBridgeAddDefaultCorrelation(){
  return getScenarioBridgeController().scenarioBridgeAddDefaultCorrelation();
}

function scenarioBridgeImportCorrelationModels(jsonText){
  return getScenarioBridgeController().scenarioBridgeImportCorrelationModels(jsonText);
}

function scenarioBridgeAddDefaultShock(){
  return getScenarioBridgeController().scenarioBridgeAddDefaultShock();
}

function scenarioBridgeImportShockScenarios(jsonText){
  return getScenarioBridgeController().scenarioBridgeImportShockScenarios(jsonText);
}

function scenarioBridgeCaptureObservedMetrics(){
  return getScenarioBridgeController().scenarioBridgeCaptureObservedMetrics();
}

function scenarioBridgeGenerateDriftRecommendations(){
  return getScenarioBridgeController().scenarioBridgeGenerateDriftRecommendations();
}

function scenarioBridgeParseWhatIf(requestText){
  return getScenarioBridgeController().scenarioBridgeParseWhatIf(requestText);
}

function scenarioBridgeApplyTopRecommendation(){
  return getScenarioBridgeController().scenarioBridgeApplyTopRecommendation();
}

function installScenarioBridge(){
  return getScenarioBridgeController().installScenarioBridge();
}

let districtBridgeHelpersController = null;

function getDistrictBridgeHelpersController(){
  if (!districtBridgeHelpersController){
    districtBridgeHelpersController = createDistrictBridgeHelpersRuntime({
      getState: () => state,
      mutateState,
      cleanText,
      safeNum,
      isScenarioLockedForEdits,
      formatPercentFromPct,
      formatWholeNumberByMode,
      roundWholeNumberByMode,
      computeDistrictSupportTotalPctFromState,
      buildDistrictTurnoutFallbackView,
      buildDistrictLastFetchText,
      buildDistrictCensusContextHint,
      buildDistrictSelectionSetStatus,
      buildDistrictGeoStatsText,
      buildDistrictSelectionSummaryText,
      buildDistrictRaceFootprintStatus,
      buildDistrictAssumptionProvenanceStatus,
      buildDistrictFootprintCapacityStatus,
      buildDistrictApplyAdjustmentsStatus,
      getCensusRowsForState,
      normalizeCensusState,
      resolutionNeedsCounty,
      windowRef: typeof window !== "undefined" ? window : null,
    });
  }
  return districtBridgeHelpersController;
}

function districtBridgeFmtPct(value, digits = 1){
  return getDistrictBridgeHelpersController().districtBridgeFmtPct(value, digits);
}

function districtBridgeFmtInt(value){
  return getDistrictBridgeHelpersController().districtBridgeFmtInt(value);
}

function districtBridgeSupportTotalFromState(currentState){
  return getDistrictBridgeHelpersController().districtBridgeSupportTotalFromState(currentState);
}

function districtBridgeFallbackTurnout(currentState){
  return getDistrictBridgeHelpersController().districtBridgeFallbackTurnout(currentState);
}

function districtBridgeFmtTimestamp(ts){
  return getDistrictBridgeHelpersController().districtBridgeFmtTimestamp(ts);
}

function districtBridgeBuildContextHint(censusState){
  return getDistrictBridgeHelpersController().districtBridgeBuildContextHint(censusState);
}

function districtBridgeBuildSelectionSetStatus(censusState){
  return getDistrictBridgeHelpersController().districtBridgeBuildSelectionSetStatus(censusState);
}

function districtBridgeBuildGeoStatsText(censusState){
  return getDistrictBridgeHelpersController().districtBridgeBuildGeoStatsText(censusState);
}

function districtBridgeBuildSelectionSummary(censusState){
  return getDistrictBridgeHelpersController().districtBridgeBuildSelectionSummary(censusState);
}

function districtBridgeBuildRaceFootprintStatus(currentState){
  return getDistrictBridgeHelpersController().districtBridgeBuildRaceFootprintStatus(currentState);
}

function districtBridgeBuildAssumptionProvenanceStatus(currentState){
  return getDistrictBridgeHelpersController().districtBridgeBuildAssumptionProvenanceStatus(currentState);
}

function districtBridgeBuildFootprintCapacityStatus(currentState){
  return getDistrictBridgeHelpersController().districtBridgeBuildFootprintCapacityStatus(currentState);
}

function districtBridgeBuildApplyAdjustmentsStatus(censusState){
  return getDistrictBridgeHelpersController().districtBridgeBuildApplyAdjustmentsStatus(censusState);
}

function districtBridgeBuildSelectOptions(values, options = {}){
  return getDistrictBridgeHelpersController().districtBridgeBuildSelectOptions(values, options);
}

function districtBridgeBuildCensusConfigOptions(censusState){
  return getDistrictBridgeHelpersController().districtBridgeBuildCensusConfigOptions(censusState);
}

function districtBridgeBuildCensusDisabledMap(currentState, censusState){
  return getDistrictBridgeHelpersController().districtBridgeBuildCensusDisabledMap(currentState, censusState);
}

function districtBridgeNormalizeRows(rows, expectedCols = 0){
  return getDistrictBridgeHelpersController().districtBridgeNormalizeRows(rows, expectedCols);
}

function districtBridgeApplyDomainAction(draft, actionFn, payload, actionName = "districtBridgeAction"){
  if (!draft || typeof draft !== "object" || typeof actionFn !== "function"){
    return null;
  }
  const outcome = actionFn(draft, payload, {
    actionName,
    sourceModule: "appRuntime.districtBridge",
    sourceSurface: "district",
  });
  const canonical = outcome?.state && typeof outcome.state === "object" ? outcome.state : null;
  if (canonical?.domains && typeof canonical.domains === "object"){
    draft.schemaVersion = canonical.schemaVersion;
    draft.revision = Number.isFinite(Number(canonical.revision))
      ? Number(canonical.revision)
      : Number.isFinite(Number(draft.revision))
        ? Number(draft.revision)
        : 0;
    draft.updatedAt = String(canonical.updatedAt || draft.updatedAt || "");
    draft.domains = canonical.domains;
  }
  return outcome;
}

function districtBridgeSyncTargetingCanonicalField(draft, key, targeting){
  const field = String(key || "").trim();
  if (!field || !targeting || typeof targeting !== "object"){
    return false;
  }
  const configFields = new Set([
    "presetId",
    "geoLevel",
    "modelId",
    "topN",
    "minHousingUnits",
    "minPopulation",
    "minScore",
    "onlyRaceFootprint",
    "controlsLocked",
  ]);
  const criteriaFields = new Set([
    "prioritizeYoung",
    "prioritizeRenters",
    "avoidHighMultiUnit",
    "densityFloor",
  ]);
  const weightFieldMap = {
    weightVotePotential: "votePotential",
    weightTurnoutOpportunity: "turnoutOpportunity",
    weightPersuasionIndex: "persuasionIndex",
    weightFieldEfficiency: "fieldEfficiency",
  };

  if (configFields.has(field)){
    districtBridgeApplyDomainAction(
      draft,
      updateTargetingConfigAction,
      { field, value: targeting[field] },
      `districtBridge.targeting.config.${field}`,
    );
    return true;
  }
  if (criteriaFields.has(field)){
    districtBridgeApplyDomainAction(
      draft,
      updateTargetingCriteriaAction,
      { field, value: targeting?.criteria?.[field] },
      `districtBridge.targeting.criteria.${field}`,
    );
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(weightFieldMap, field)){
    const canonicalField = weightFieldMap[field];
    districtBridgeApplyDomainAction(
      draft,
      updateTargetingWeightsAction,
      { field: canonicalField, value: targeting?.weights?.[canonicalField] },
      `districtBridge.targeting.weights.${canonicalField}`,
    );
    return true;
  }
  return false;
}

function districtBridgeSyncTargetingCanonicalState(draft, targeting){
  if (!targeting || typeof targeting !== "object"){
    return;
  }
  [
    "presetId",
    "geoLevel",
    "modelId",
    "topN",
    "minHousingUnits",
    "minPopulation",
    "minScore",
    "onlyRaceFootprint",
    "controlsLocked",
  ].forEach((field) => {
    districtBridgeSyncTargetingCanonicalField(draft, field, targeting);
  });
  [
    "prioritizeYoung",
    "prioritizeRenters",
    "avoidHighMultiUnit",
    "densityFloor",
  ].forEach((field) => {
    districtBridgeSyncTargetingCanonicalField(draft, field, targeting);
  });
  [
    "weightVotePotential",
    "weightTurnoutOpportunity",
    "weightPersuasionIndex",
    "weightFieldEfficiency",
  ].forEach((field) => {
    districtBridgeSyncTargetingCanonicalField(draft, field, targeting);
  });
}

function districtBridgeSyncCensusCanonicalField(draft, field, value){
  const key = String(field || "").trim();
  if (!key){
    return false;
  }
  const allowed = new Set([
    "year",
    "resolution",
    "metricSet",
    "stateFips",
    "countyFips",
    "placeFips",
    "geoSearch",
    "tractFilter",
    "selectionSetDraftName",
    "selectedSelectionSetKey",
    "applyAdjustedAssumptions",
    "mapQaVtdOverlay",
    "apiKey",
    "geoPaste",
  ]);
  if (!allowed.has(key)){
    return false;
  }
  districtBridgeApplyDomainAction(
    draft,
    updateCensusConfigAction,
    { field: key, value },
    `districtBridge.census.config.${key}`,
  );
  return true;
}

function districtBridgeSyncCensusSelectionCanonicalState(draft){
  if (!draft || typeof draft !== "object"){
    return false;
  }
  const census = draft.census && typeof draft.census === "object" ? draft.census : {};
  const runtimeRows = getCensusRowsForState(census);
  const selectedGeoids = Array.isArray(census.selectedGeoids)
    ? census.selectedGeoids.map((value) => cleanText(value)).filter(Boolean)
    : [];
  const activeRowsKey = cleanText(census.activeRowsKey);
  const loadedRowCount = Number.isFinite(Number(census.loadedRowCount))
    ? Math.max(0, roundWholeNumberByMode(Number(census.loadedRowCount), { mode: "floor", fallback: 0 }) || 0)
    : Object.keys(runtimeRows && typeof runtimeRows === "object" ? runtimeRows : {}).length;
  districtBridgeApplyDomainAction(
    draft,
    updateCensusSelectionAction,
    {
      selectedGeoids,
      activeRowsKey,
      rowsByGeoid: runtimeRows,
      loadedRowCount,
    },
    "districtBridge.census.selection.sync",
  );
  return true;
}

function districtBridgeStateView(){
  return districtBridgeCombinedView();
}

function districtBridgeCanonicalView(){
  const runtimeState = state || {};
  const districtCanonical = selectDistrictCanonicalView(runtimeState);
  const targetingCanonical = selectTargetingCanonicalView(runtimeState);
  const censusCanonical = selectCensusCanonicalView(runtimeState);
  const electionDataCanonical = selectElectionDataCanonicalView(runtimeState);
  const districtTemplate = districtCanonical?.templateProfile && typeof districtCanonical.templateProfile === "object"
    ? districtCanonical.templateProfile
    : {};
  const districtForm = districtCanonical?.form && typeof districtCanonical.form === "object"
    ? districtCanonical.form
    : {};
  const districtUniverse = districtCanonical?.universeComposition && typeof districtCanonical.universeComposition === "object"
    ? districtCanonical.universeComposition
    : {};
  const districtBallot = districtCanonical?.ballot && typeof districtCanonical.ballot === "object"
    ? districtCanonical.ballot
    : {};
  const ballotCandidateRefs = districtBallot?.candidateRefs && typeof districtBallot.candidateRefs === "object"
    ? districtBallot.candidateRefs
    : { byId: {}, order: [] };
  const ballotById = ballotCandidateRefs?.byId && typeof ballotCandidateRefs.byId === "object"
    ? ballotCandidateRefs.byId
    : {};
  const ballotOrder = Array.isArray(ballotCandidateRefs?.order) ? ballotCandidateRefs.order : [];
  const ballotCandidates = ballotOrder
    .map((candidateId) => ballotById[candidateId])
    .filter((row) => row && typeof row === "object");
  const ballotUserSplitById = districtBallot?.userSplitByCandidateId && typeof districtBallot.userSplitByCandidateId === "object"
    ? districtBallot.userSplitByCandidateId
    : {};
  const historyRecords = Array.isArray(districtCanonical?.candidateHistory?.records)
    ? districtCanonical.candidateHistory.records
    : [];
  const districtElectionDataMeta = districtCanonical?.electionDataMeta && typeof districtCanonical.electionDataMeta === "object"
    ? districtCanonical.electionDataMeta
    : {};
  const controlsLocked = isScenarioLockedForEdits(runtimeState);

  const censusRuntimeState = runtimeState?.census && typeof runtimeState.census === "object"
    ? runtimeState.census
    : {};
  const targetingState = normalizeTargetingState(runtimeState?.targeting);
  const targetingConfigCanonical = targetingCanonical?.config && typeof targetingCanonical.config === "object"
    ? targetingCanonical.config
    : {};
  const targetingCriteria = targetingCanonical?.criteria && typeof targetingCanonical.criteria === "object"
    ? targetingCanonical.criteria
    : {};
  const targetingWeights = targetingCanonical?.weights && typeof targetingCanonical.weights === "object"
    ? targetingCanonical.weights
    : {};
  const targetingPresetId = String(targetingConfigCanonical?.presetId || "").trim();
  const targetingModelId = String(targetingConfigCanonical?.modelId || "").trim();
  const runtimeCensusRows = getCensusRowsForState(censusRuntimeState);
  const runtimeCensusRowsCount = Object.keys(runtimeCensusRows && typeof runtimeCensusRows === "object" ? runtimeCensusRows : {}).length;
  const censusLoadedRowCountCanonical = safeNum(censusCanonical?.selection?.loadedRowCount);
  const censusLoadedRowCountRuntime = safeNum(censusRuntimeState?.loadedRowCount);
  const censusLoadedRowCount = censusLoadedRowCountCanonical
    ?? censusLoadedRowCountRuntime
    ?? runtimeCensusRowsCount
    ?? 0;
  const targetingCanRun = censusLoadedRowCount > 0 || runtimeCensusRowsCount > 0;
  const targetingRowsRaw = Array.isArray(targetingState?.lastRows) ? targetingState.lastRows : [];
  const houseModelActive = targetingPresetId === "house_v1" || targetingModelId === "house_v1";
  const censusConfigOptions = districtBridgeBuildCensusConfigOptions(censusRuntimeState);
  const censusDisabledMap = districtBridgeBuildCensusDisabledMap(runtimeState, censusRuntimeState);
  const censusCanonicalConfig = censusCanonical?.config && typeof censusCanonical.config === "object"
    ? censusCanonical.config
    : {};

  const electionDataImport = electionDataCanonical?.import && typeof electionDataCanonical.import === "object"
    ? electionDataCanonical.import
    : {};
  const electionDataQuality = electionDataCanonical?.quality && typeof electionDataCanonical.quality === "object"
    ? electionDataCanonical.quality
    : {};
  const electionDataBenchmarks = electionDataCanonical?.benchmarks && typeof electionDataCanonical.benchmarks === "object"
    ? electionDataCanonical.benchmarks
    : {};
  const canonicalElectionRows = Number.isFinite(Number(districtElectionDataMeta?.normalizedRowCount))
    ? Number(districtElectionDataMeta.normalizedRowCount)
    : 0;
  const ballotUndecidedMode = String(districtBallot?.undecidedMode || "proportional").trim() || "proportional";

  return {
    controls: {
      locked: controlsLocked,
      disabledMap: districtBridgeBuildDistrictDisabledMap(runtimeState),
    },
    template: {
      raceType: String(districtTemplate?.raceType || "").trim(),
      officeLevel: String(districtTemplate?.officeLevel || "").trim(),
      electionType: String(districtTemplate?.electionType || "").trim(),
      seatContext: String(districtTemplate?.seatContext || "").trim(),
      partisanshipMode: String(districtTemplate?.partisanshipMode || "").trim(),
      salienceLevel: String(districtTemplate?.salienceLevel || "").trim(),
      appliedTemplateId: String(districtTemplate?.appliedTemplateId || "").trim(),
      appliedVersion: String(districtTemplate?.appliedVersion || "").trim(),
      benchmarkKey: String(districtTemplate?.benchmarkKey || "").trim(),
      overriddenFields: Array.isArray(districtTemplate?.overriddenFields)
        ? districtTemplate.overriddenFields.map((field) => String(field || "").trim()).filter(Boolean)
        : [],
      assumptionsProfile: String(districtTemplate?.assumptionsProfile || "").trim(),
    },
    form: {
      raceType: String(districtTemplate?.raceType || "").trim(),
      electionDate: String(districtForm?.electionDate || "").trim(),
      weeksRemaining: String(districtForm?.weeksRemaining ?? "").trim(),
      mode: String(districtForm?.mode || "").trim(),
      universeSize: safeNum(districtForm?.universeSize),
      universeBasis: String(districtForm?.universeBasis || "").trim(),
      sourceNote: String(districtForm?.sourceNote || "").trim(),
      turnoutA: safeNum(districtForm?.turnoutA),
      turnoutB: safeNum(districtForm?.turnoutB),
      bandWidth: safeNum(districtForm?.bandWidth),
      universe16Enabled: !!districtUniverse?.enabled,
      universe16DemPct: safeNum(districtUniverse?.demPct),
      universe16RepPct: safeNum(districtUniverse?.repPct),
      universe16NpaPct: safeNum(districtUniverse?.npaPct),
      universe16OtherPct: safeNum(districtUniverse?.otherPct),
      retentionFactor: safeNum(districtUniverse?.retentionFactor),
    },
    ballot: {
      yourCandidateId: String(districtBallot?.yourCandidateId || "").trim(),
      undecidedPct: safeNum(districtBallot?.undecidedPct),
      undecidedMode: ballotUndecidedMode,
      userSplitVisible: ballotUndecidedMode === "user_defined",
      candidates: ballotCandidates.map((cand) => ({
        id: String(cand?.id || "").trim(),
        name: String(cand?.name ?? "").trim(),
        supportPct: safeNum(cand?.supportPct),
        canRemove: ballotCandidates.length > 2,
      })).filter((cand) => cand.id),
      userSplitRows: ballotCandidates.map((cand) => ({
        id: String(cand?.id || "").trim(),
        name: String(cand?.name ?? "").trim(),
        value: safeNum(ballotUserSplitById?.[cand?.id]),
      })).filter((cand) => cand.id),
      candidateHistoryOptions: {
        office: CANDIDATE_HISTORY_OFFICE_OPTIONS.map((row) => ({
          value: String(row?.value || "").trim(),
          label: String(row?.label || row?.value || "").trim(),
        })),
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
    },
    targeting: {
      config: {
        presetId: targetingPresetId,
        geoLevel: String(targetingConfigCanonical?.geoLevel || "").trim(),
        modelId: targetingModelId,
        topN: safeNum(targetingConfigCanonical?.topN),
        minHousingUnits: safeNum(targetingConfigCanonical?.minHousingUnits),
        minPopulation: safeNum(targetingConfigCanonical?.minPopulation),
        minScore: safeNum(targetingConfigCanonical?.minScore),
        onlyRaceFootprint: !!targetingConfigCanonical?.onlyRaceFootprint,
        prioritizeYoung: !!targetingCriteria?.prioritizeYoung,
        prioritizeRenters: !!targetingCriteria?.prioritizeRenters,
        avoidHighMultiUnit: !!targetingCriteria?.avoidHighMultiUnit,
        densityFloor: String(targetingCriteria?.densityFloor || "none").trim() || "none",
        weightVotePotential: safeNum(targetingWeights?.votePotential),
        weightTurnoutOpportunity: safeNum(targetingWeights?.turnoutOpportunity),
        weightPersuasionIndex: safeNum(targetingWeights?.persuasionIndex),
        weightFieldEfficiency: safeNum(targetingWeights?.fieldEfficiency),
        controlsLocked: !!targetingConfigCanonical?.controlsLocked,
        canRun: targetingCanRun,
        canExport: targetingRowsRaw.length > 0,
        canResetWeights: houseModelActive,
      },
    },
    census: {
      config: {
        apiKey: String(censusCanonicalConfig?.apiKey || censusRuntimeState?.bridgeApiKey || "").trim(),
        year: String(censusCanonicalConfig?.year || censusRuntimeState?.year || "").trim(),
        resolution: String(censusCanonicalConfig?.resolution || censusRuntimeState?.resolution || "").trim(),
        stateFips: String(censusCanonicalConfig?.stateFips || censusRuntimeState?.stateFips || "").trim(),
        countyFips: String(censusCanonicalConfig?.countyFips || censusRuntimeState?.countyFips || censusRuntimeState?.county || "").trim(),
        placeFips: String(censusCanonicalConfig?.placeFips || censusRuntimeState?.placeFips || "").trim(),
        metricSet: String(censusCanonicalConfig?.metricSet || censusRuntimeState?.metricSet || "").trim(),
        geoSearch: String(censusCanonicalConfig?.geoSearch || censusRuntimeState?.geoSearch || "").trim(),
        geoPaste: String(censusCanonicalConfig?.geoPaste || censusRuntimeState?.bridgeGeoPaste || "").trim(),
        tractFilter: String(censusCanonicalConfig?.tractFilter || censusRuntimeState?.tractFilter || "").trim(),
        selectionSetDraftName: String(censusCanonicalConfig?.selectionSetDraftName || censusRuntimeState?.selectionSetDraftName || "").trim(),
        selectedSelectionSetKey: String(censusCanonicalConfig?.selectedSelectionSetKey || censusRuntimeState?.selectedSelectionSetKey || "").trim(),
        electionCsvPrecinctFilter: String(censusRuntimeState?.bridgeElectionCsvPrecinctFilter || "").trim(),
        applyAdjustedAssumptions: !!(censusCanonicalConfig?.applyAdjustedAssumptions ?? censusRuntimeState?.applyAdjustedAssumptions),
        mapQaVtdOverlay: !!(censusCanonicalConfig?.mapQaVtdOverlay ?? censusRuntimeState?.mapQaVtdOverlay),
        controlsLocked,
        disabledMap: censusDisabledMap,
        stateOptions: censusConfigOptions.stateOptions,
        countyOptions: censusConfigOptions.countyOptions,
        placeOptions: censusConfigOptions.placeOptions,
        tractFilterOptions: censusConfigOptions.tractFilterOptions,
        selectionSetOptions: censusConfigOptions.selectionSetOptions,
        geoSelectOptions: censusConfigOptions.geoSelectOptions,
      },
    },
    electionData: {
      fileName: String(districtElectionDataMeta?.fileName || electionDataImport?.fileName || "").trim(),
      importedAt: String(districtElectionDataMeta?.importedAt || electionDataImport?.importedAt || "").trim(),
      importStatus: String(electionDataImport?.status || "").trim(),
      normalizedRowCount: canonicalElectionRows,
      qualityScore: safeNum(districtElectionDataMeta?.qualityScore ?? electionDataQuality?.score),
      confidenceBand: String(districtElectionDataMeta?.confidenceBand || electionDataQuality?.confidenceBand || "").trim() || "unknown",
      benchmarkSuggestionCount: Array.isArray(electionDataBenchmarks?.benchmarkSuggestions)
        ? electionDataBenchmarks.benchmarkSuggestions.length
        : 0,
      downstreamReady: !!electionDataBenchmarks?.downstreamRecommendations,
    },
  };
}

function districtBridgeDerivedView(){
  const currentState = state || {};
  const planningSnapshot = computeElectionSnapshot({
    state: currentState,
    nowDate: new Date(),
    toNum: safeNum,
  });
  const res = planningSnapshot?.res && typeof planningSnapshot.res === "object"
    ? planningSnapshot.res
    : null;
  const censusState = currentState?.census && typeof currentState.census === "object"
    ? currentState.census
    : {};
  const runtimeCensusRows = getCensusRowsForState(censusState);
  const runtimeCensusRowsCount = Object.keys(runtimeCensusRows && typeof runtimeCensusRows === "object" ? runtimeCensusRows : {}).length;
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
  const ballotUndecidedMode = String(currentState?.undecidedMode || "proportional").trim() || "proportional";
  const historyRecords = normalizeCandidateHistoryRecords(currentState?.candidateHistory);
  const historyValidation = res?.validation?.candidateHistory && typeof res.validation.candidateHistory === "object"
    ? res.validation.candidateHistory
    : {};
  const historyImpact = res?.expected?.candidateHistoryImpact && typeof res.expected.candidateHistoryImpact === "object"
    ? res.expected.candidateHistoryImpact
    : {};
  const historyRecordCount = Number(historyValidation.recordCount ?? historyImpact.recordCount ?? historyRecords.length ?? 0);
  const historyMatched = Number(historyValidation.matchedRecordCount ?? historyImpact.matchedRecordCount ?? 0);
  const historyUnmatchedCandidates = Number(historyValidation.unmatchedCandidateRecordCount ?? 0);
  const historyOfficeMismatchCount = Number(historyValidation.excludedByOfficeCount ?? 0);
  const historyElectionMismatchCount = Number(historyValidation.excludedByElectionTypeCount ?? 0);
  const historyCoverageBand = String(historyValidation.coverageBand || historyImpact.coverageBand || "none");
  const historyConfidenceBand = String(historyValidation.confidenceBand || historyImpact.confidenceBand || "missing");
  const historyVoteDelta = Number(historyImpact.yourVotesDelta || 0);
  const historyNotes = Array.isArray(historyValidation.notes)
    ? historyValidation.notes.map((note) => String(note || "").trim()).filter(Boolean)
    : [];
  const electionDataState = currentState?.electionData && typeof currentState.electionData === "object"
    ? currentState.electionData
    : {};
  const electionImport = electionDataState?.import && typeof electionDataState.import === "object"
    ? electionDataState.import
    : {};
  const electionQuality = electionDataState?.quality && typeof electionDataState.quality === "object"
    ? electionDataState.quality
    : {};
  const electionBenchmarks = electionDataState?.benchmarks && typeof electionDataState.benchmarks === "object"
    ? electionDataState.benchmarks
    : {};
  const electionRowCount = Array.isArray(electionDataState?.normalizedRows)
    ? electionDataState.normalizedRows.length
    : 0;
  const electionQualityScore = safeNum(electionQuality?.score);
  const electionConfidenceBand = String(electionQuality?.confidenceBand || "").trim() || "unknown";
  const electionBenchmarkCount = Array.isArray(electionBenchmarks?.benchmarkSuggestions)
    ? electionBenchmarks.benchmarkSuggestions.length
    : 0;

  const targetingRowsRaw = Array.isArray(targetingState?.lastRows) ? targetingState.lastRows : [];
  const targetingRows = targetingRowsRaw.map((row, idx) => {
    const rankValue = safeNum(row?.rank);
    const scoreValue = safeNum(row?.score);
    const vphValue = safeNum(row?.votesPerOrganizerHour);
    const geoidValue = String(row?.geoid || row?.geographyId || row?.id || "").trim();
    const reasons = Array.isArray(row?.reasons)
      ? row.reasons.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const targetLabel = String(row?.targetLabel || "").trim();
    const reasonBase = reasons.length ? reasons.join(" • ") : String(row?.reasonText || "").trim();
    const badges = [];
    if (row?.isTopTarget) badges.push("Top target");
    if (row?.isTurnoutPriority) badges.push("Turnout priority");
    if (row?.isPersuasionPriority) badges.push("Persuasion priority");
    if (row?.isEfficiencyPriority) badges.push("Efficiency priority");
    const headline = targetLabel ? `${targetLabel}: ${reasonBase || "—"}` : (reasonBase || "—");
    const reasonText = badges.length ? `[${badges.join(" | ")}] ${headline}` : headline;
    const flagsList = Array.isArray(row?.flags)
      ? row.flags.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const flagsText = flagsList.length ? flagsList.join(" • ") : String(row?.flagText || "").trim();
    const geoLabel = String(row?.label || row?.geoid || "").trim();
    return {
      rankText: rankValue == null
        ? String(idx + 1)
        : String(Math.max(1, roundWholeNumberByMode(rankValue, { mode: "floor", fallback: 1 }) || 1)),
      geoidText: geoidValue || "",
      geoText: geoLabel || "—",
      scoreText: scoreValue == null ? "—" : formatFixedNumber(scoreValue, 3, "—"),
      votesPerHourText: vphValue == null ? "—" : formatFixedNumber(vphValue, 2, "—"),
      reasonText: reasonText || "—",
      flagsText,
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

  return {
    summary: {
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
    },
    template: {
      candidateHistoryCoverageBand: String(historyCoverageBand || "none").trim(),
      candidateHistoryConfidenceBand: String(historyConfidenceBand || "missing").trim(),
      candidateHistoryRecordCount: historyRecordCount,
    },
    ballot: {
      supportTotalText: supportTotalPct == null
        ? (supportTotalFromState == null ? "—" : districtBridgeFmtPct(supportTotalFromState, 1))
        : districtBridgeFmtPct(supportTotalPct, 1),
      warningText: !res?.validation?.candidateTableOk
        ? String(res?.validation?.candidateTableMsg || "").trim()
        : (ballotUndecidedMode === "user_defined" && !res?.validation?.userSplitOk
          ? String(res?.validation?.userSplitMsg || "").trim()
          : ""),
      candidateHistorySummaryText: historyRecordCount <= 0
        ? "No candidate history rows. Add candidate-cycle records to anchor ballot baseline realism."
        : (() => {
            const mismatchBits = [];
            if (historyOfficeMismatchCount > 0){
              mismatchBits.push(`office ${districtBridgeFmtInt(historyOfficeMismatchCount)}`);
            }
            if (historyElectionMismatchCount > 0){
              mismatchBits.push(`election ${districtBridgeFmtInt(historyElectionMismatchCount)}`);
            }
            const unmatchedBit = historyUnmatchedCandidates > 0
              ? ` · unmatched candidate rows: ${districtBridgeFmtInt(historyUnmatchedCandidates)}`
              : "";
            const mismatchBit = mismatchBits.length
              ? ` · excluded: ${mismatchBits.join(", ")}`
              : "";
            const voteDeltaBit = historyVoteDelta
              ? ` · vote delta ${historyVoteDelta > 0 ? "+" : ""}${districtBridgeFmtInt(historyVoteDelta)}`
              : "";
            return `History rows: ${districtBridgeFmtInt(historyRecordCount)} · matched: ${districtBridgeFmtInt(historyMatched)} · coverage: ${historyCoverageBand} · confidence: ${historyConfidenceBand}${mismatchBit}${unmatchedBit}${voteDeltaBit}`;
          })(),
      candidateHistoryWarningText: (() => {
        const warnings = [];
        if (historyOfficeMismatchCount > 0){
          warnings.push(`Office mismatch excluded ${districtBridgeFmtInt(historyOfficeMismatchCount)} row(s); use canonical office labels (for governor use Statewide Executive / \`statewide_executive\`).`);
        }
        if (historyElectionMismatchCount > 0){
          warnings.push(`Election-type mismatch excluded ${districtBridgeFmtInt(historyElectionMismatchCount)} row(s).`);
        }
        if (historyRecordCount > 0 && historyConfidenceBand === "low"){
          warnings.push("Candidate history is incomplete; baseline confidence is downgraded until required fields are filled.");
        }
        if (warnings.length <= 0){
          const officeNote = historyNotes.find((note) => /office mismatch/i.test(note));
          return officeNote || "";
        }
        return warnings.join(" ");
      })(),
    },
    targeting: {
      statusText: targetingRows.length
        ? `Ranked ${districtBridgeFmtInt(targetingRows.length)} GEO rows.`
        : (runtimeCensusRowsCount > 0
          ? "Run targeting to generate ranked GEOs."
          : TARGETING_STATUS_LOAD_ROWS_FIRST),
      metaText: targetingMetaBits.join(" · ") || "No targeting run yet.",
      rows: targetingRows,
    },
    census: {
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
      aggregateRows: districtBridgeNormalizeRows(censusState?.bridgeAggregateRows, 2),
      advisoryRows: districtBridgeNormalizeRows(censusState?.bridgeAdvisoryRows, 2),
      electionPreviewRows: districtBridgeNormalizeRows(censusState?.bridgeElectionPreviewRows, 4),
    },
    electionData: {
      statusText: electionRowCount > 0
        ? `Normalized ${districtBridgeFmtInt(electionRowCount)} election rows.`
        : "No election data normalized yet.",
      qualityText: electionQualityScore == null
        ? "Quality score unavailable."
        : `Quality ${formatFixedNumber(electionQualityScore, 2, "0.00")} (${electionConfidenceBand}).`,
      benchmarkText: electionBenchmarkCount > 0
        ? `${districtBridgeFmtInt(electionBenchmarkCount)} benchmark suggestion(s) ready.`
        : "No benchmark suggestions yet.",
      importedAtText: String(electionImport?.importedAt || "").trim() || "Not imported",
    },
  };
}

function districtBridgeCombinedView(){
  const canonical = districtBridgeCanonicalView();
  const derived = districtBridgeDerivedView();
  return {
    summary: derived?.summary && typeof derived.summary === "object" ? derived.summary : {},
    template: {
      raceType: String(canonical?.template?.raceType || "").trim(),
      officeLevel: String(canonical?.template?.officeLevel || "").trim(),
      electionType: String(canonical?.template?.electionType || "").trim(),
      seatContext: String(canonical?.template?.seatContext || "").trim(),
      partisanshipMode: String(canonical?.template?.partisanshipMode || "").trim(),
      salienceLevel: String(canonical?.template?.salienceLevel || "").trim(),
      appliedTemplateId: String(canonical?.template?.appliedTemplateId || "").trim(),
      appliedVersion: String(canonical?.template?.appliedVersion || "").trim(),
      benchmarkKey: String(canonical?.template?.benchmarkKey || "").trim(),
      overriddenFields: Array.isArray(canonical?.template?.overriddenFields) ? canonical.template.overriddenFields.slice() : [],
      assumptionsProfile: String(canonical?.template?.assumptionsProfile || "").trim(),
      candidateHistoryCoverageBand: String(derived?.template?.candidateHistoryCoverageBand || "").trim(),
      candidateHistoryConfidenceBand: String(derived?.template?.candidateHistoryConfidenceBand || "").trim(),
      candidateHistoryRecordCount: Number.isFinite(Number(derived?.template?.candidateHistoryRecordCount))
        ? Number(derived.template.candidateHistoryRecordCount)
        : 0,
    },
    form: canonical?.form && typeof canonical.form === "object" ? canonical.form : {},
    ballot: {
      yourCandidateId: String(canonical?.ballot?.yourCandidateId || "").trim(),
      undecidedPct: safeNum(canonical?.ballot?.undecidedPct),
      undecidedMode: String(canonical?.ballot?.undecidedMode || "").trim(),
      supportTotalText: String(derived?.ballot?.supportTotalText || "").trim(),
      warningText: String(derived?.ballot?.warningText || "").trim(),
      candidates: Array.isArray(canonical?.ballot?.candidates) ? canonical.ballot.candidates : [],
      userSplitVisible: !!canonical?.ballot?.userSplitVisible,
      userSplitRows: Array.isArray(canonical?.ballot?.userSplitRows) ? canonical.ballot.userSplitRows : [],
      candidateHistorySummaryText: String(derived?.ballot?.candidateHistorySummaryText || "").trim(),
      candidateHistoryWarningText: String(derived?.ballot?.candidateHistoryWarningText || "").trim(),
      candidateHistoryOptions: canonical?.ballot?.candidateHistoryOptions && typeof canonical.ballot.candidateHistoryOptions === "object"
        ? canonical.ballot.candidateHistoryOptions
        : {},
      candidateHistoryRecords: Array.isArray(canonical?.ballot?.candidateHistoryRecords)
        ? canonical.ballot.candidateHistoryRecords
        : [],
    },
    targeting: {
      statusText: String(derived?.targeting?.statusText || "").trim(),
      metaText: String(derived?.targeting?.metaText || "").trim(),
      rows: Array.isArray(derived?.targeting?.rows) ? derived.targeting.rows : [],
      config: canonical?.targeting?.config && typeof canonical.targeting.config === "object"
        ? canonical.targeting.config
        : {},
    },
    census: {
      contextHint: String(derived?.census?.contextHint || "").trim(),
      selectionSetStatus: String(derived?.census?.selectionSetStatus || "").trim(),
      statusText: String(derived?.census?.statusText || "").trim(),
      geoStatsText: String(derived?.census?.geoStatsText || "").trim(),
      lastFetchText: String(derived?.census?.lastFetchText || "").trim(),
      selectionSummaryText: String(derived?.census?.selectionSummaryText || "").trim(),
      raceFootprintStatusText: String(derived?.census?.raceFootprintStatusText || "").trim(),
      assumptionProvenanceStatusText: String(derived?.census?.assumptionProvenanceStatusText || "").trim(),
      footprintCapacityStatusText: String(derived?.census?.footprintCapacityStatusText || "").trim(),
      applyAdjustmentsStatusText: String(derived?.census?.applyAdjustmentsStatusText || "").trim(),
      advisoryStatusText: String(derived?.census?.advisoryStatusText || "").trim(),
      electionCsvGuideStatusText: String(derived?.census?.electionCsvGuideStatusText || "").trim(),
      electionCsvDryRunStatusText: String(derived?.census?.electionCsvDryRunStatusText || "").trim(),
      electionCsvPreviewMetaText: String(derived?.census?.electionCsvPreviewMetaText || "").trim(),
      mapStatusText: String(derived?.census?.mapStatusText || "").trim(),
      mapQaVtdZipStatusText: String(derived?.census?.mapQaVtdZipStatusText || "").trim(),
      aggregateRows: Array.isArray(derived?.census?.aggregateRows) ? derived.census.aggregateRows : [],
      advisoryRows: Array.isArray(derived?.census?.advisoryRows) ? derived.census.advisoryRows : [],
      electionPreviewRows: Array.isArray(derived?.census?.electionPreviewRows) ? derived.census.electionPreviewRows : [],
      config: canonical?.census?.config && typeof canonical.census.config === "object"
        ? canonical.census.config
        : {},
    },
    electionData: {
      fileName: String(canonical?.electionData?.fileName || "").trim(),
      importedAt: String(canonical?.electionData?.importedAt || "").trim(),
      importStatus: String(canonical?.electionData?.importStatus || "").trim(),
      normalizedRowCount: Number.isFinite(Number(canonical?.electionData?.normalizedRowCount))
        ? Number(canonical.electionData.normalizedRowCount)
        : 0,
      qualityScore: safeNum(canonical?.electionData?.qualityScore),
      confidenceBand: String(canonical?.electionData?.confidenceBand || "").trim(),
      benchmarkSuggestionCount: Number.isFinite(Number(canonical?.electionData?.benchmarkSuggestionCount))
        ? Number(canonical.electionData.benchmarkSuggestionCount)
        : 0,
      downstreamReady: !!canonical?.electionData?.downstreamReady,
      statusText: String(derived?.electionData?.statusText || "").trim(),
      qualityText: String(derived?.electionData?.qualityText || "").trim(),
      benchmarkText: String(derived?.electionData?.benchmarkText || "").trim(),
      importedAtText: String(derived?.electionData?.importedAtText || "").trim(),
    },
    controls: canonical?.controls && typeof canonical.controls === "object"
      ? canonical.controls
      : { locked: false, disabledMap: {} },
    canonical,
    derived,
  };
}

function districtBridgeBuildDistrictDisabledMap(currentState){
  return getDistrictBridgeHelpersController().districtBridgeBuildDistrictDisabledMap(currentState);
}

function districtBridgeGetCensusRuntimeApi(){
  return getDistrictBridgeHelpersController().districtBridgeGetCensusRuntimeApi();
}

function districtBridgeCallCensusRuntime(method, ...args){
  return getDistrictBridgeHelpersController().districtBridgeCallCensusRuntime(method, ...args);
}

function districtBridgePatchCensusBridgeField(field, rawValue){
  return getDistrictBridgeHelpersController().districtBridgePatchCensusBridgeField(field, rawValue);
}

function districtBridgePatchCensusGeoSelection(values){
  return getDistrictBridgeHelpersController().districtBridgePatchCensusGeoSelection(values);
}

function installDistrictBridge(){
  window[DISTRICT_BRIDGE_KEY] = {
    getCanonicalView: () => districtBridgeCanonicalView(),
    getDerivedView: () => districtBridgeDerivedView(),
    getView: () => districtBridgeCombinedView(),
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

function installElectionDataBridge(){
  window[ELECTION_DATA_BRIDGE_KEY] = createElectionDataBridge({
    getState: () => state,
    mutateState: (patchFn) => mutateState(patchFn),
    isScenarioLocked: () => isScenarioLockedForEdits(state),
  });
}

let districtBridgeActionsController = null;

function getDistrictBridgeActionsController(){
  if (!districtBridgeActionsController){
    districtBridgeActionsController = createDistrictBridgeActionsRuntime({
      getState: () => state,
      mutateState,
      isScenarioLockedForEdits,
      districtBridgeCombinedView,
      districtBridgeApplyDomainAction,
      applyTemplateDefaultsForRace,
      deriveAssumptionsProfileFromState,
      updateDistrictTemplateFieldAction,
      updateDistrictFormFieldAction,
      updateDistrictUniverseFieldAction,
      setBallotUndecidedAction,
      setBallotYourCandidateAction,
      addBallotCandidateAction,
      updateBallotCandidateAction,
      updateBallotUserSplitAction,
      removeBallotCandidateAction,
      normalizeCandidateHistoryRecords,
      canonicalizeCandidateHistoryOffice,
      addCandidateHistoryRecordAction,
      updateCandidateHistoryRecordAction,
      removeCandidateHistoryRecordAction,
      uid,
      safeNum,
      cleanText,
      normalizeTargetingState,
      applyTargetingFieldPatch,
      applyTargetModelPreset,
      resetTargetingWeightsToPreset,
      getCensusRowsForState,
      targetingRuntimeModule,
      runTargetRankingRuntime,
      applyTargetingRunResult,
      applyTargetingRunResultAction,
      targetingStatusLoadRowsFirst: TARGETING_STATUS_LOAD_ROWS_FIRST,
      buildTargetRankingExportFilename,
      buildTargetRankingCsv,
      buildTargetRankingPayload,
      buildTargetRankingPayloadConfig,
      districtBridgeSyncTargetingCanonicalField,
      districtBridgeSyncTargetingCanonicalState,
      districtBridgeSyncCensusCanonicalField,
      districtBridgeSyncCensusSelectionCanonicalState,
      districtBridgeCallCensusRuntime,
      districtBridgePatchCensusBridgeField,
      districtBridgePatchCensusGeoSelection,
      refreshAssumptionsProfile,
      markMcStale,
      documentRef: typeof document !== "undefined" ? document : null,
      urlRef: typeof URL !== "undefined" ? URL : null,
      blobCtor: typeof Blob !== "undefined" ? Blob : null,
    });
  }
  return districtBridgeActionsController;
}

function districtBridgeEnsureTargetingState(srcState = state){
  return getDistrictBridgeActionsController().districtBridgeEnsureTargetingState(srcState);
}

function districtBridgeTemplateDimensionsFromState(srcState, overrides = {}){
  return getDistrictBridgeActionsController().districtBridgeTemplateDimensionsFromState(srcState, overrides);
}

function districtBridgeApplyTemplateDefaults(mode = "all"){
  return getDistrictBridgeActionsController().districtBridgeApplyTemplateDefaults(mode);
}

function districtBridgeSetFormField(field, rawValue){
  return getDistrictBridgeActionsController().districtBridgeSetFormField(field, rawValue);
}

function districtBridgeAddCandidate(){
  return getDistrictBridgeActionsController().districtBridgeAddCandidate();
}

function districtBridgeUpdateCandidate(candidateId, field, rawValue){
  return getDistrictBridgeActionsController().districtBridgeUpdateCandidate(candidateId, field, rawValue);
}

function districtBridgeRemoveCandidate(candidateId){
  return getDistrictBridgeActionsController().districtBridgeRemoveCandidate(candidateId);
}

function districtBridgeSetUserSplit(candidateId, rawValue){
  return getDistrictBridgeActionsController().districtBridgeSetUserSplit(candidateId, rawValue);
}

function districtBridgeCandidateHistoryRecordPatch(record, key, rawValue){
  return getDistrictBridgeActionsController().districtBridgeCandidateHistoryRecordPatch(record, key, rawValue);
}

function districtBridgeAddCandidateHistoryRecord(){
  return getDistrictBridgeActionsController().districtBridgeAddCandidateHistoryRecord();
}

function districtBridgeUpdateCandidateHistoryRecord(recordId, field, rawValue){
  return getDistrictBridgeActionsController().districtBridgeUpdateCandidateHistoryRecord(recordId, field, rawValue);
}

function districtBridgeRemoveCandidateHistoryRecord(recordId){
  return getDistrictBridgeActionsController().districtBridgeRemoveCandidateHistoryRecord(recordId);
}

function districtBridgeDownloadTextFile(text, filename, mime){
  return getDistrictBridgeActionsController().districtBridgeDownloadTextFile(text, filename, mime);
}

function districtBridgeSetTargetingField(field, rawValue){
  return getDistrictBridgeActionsController().districtBridgeSetTargetingField(field, rawValue);
}

function districtBridgeApplyTargetingPreset(modelId){
  return getDistrictBridgeActionsController().districtBridgeApplyTargetingPreset(modelId);
}

function districtBridgeResetTargetingWeights(){
  return getDistrictBridgeActionsController().districtBridgeResetTargetingWeights();
}

function districtBridgeRunTargeting(){
  return getDistrictBridgeActionsController().districtBridgeRunTargeting();
}

function districtBridgeExportTargetingCsv(){
  return getDistrictBridgeActionsController().districtBridgeExportTargetingCsv();
}

function districtBridgeExportTargetingJson(){
  return getDistrictBridgeActionsController().districtBridgeExportTargetingJson();
}

function districtBridgeSetCensusField(field, rawValue){
  return getDistrictBridgeActionsController().districtBridgeSetCensusField(field, rawValue);
}

function districtBridgeSetCensusGeoSelection(values){
  return getDistrictBridgeActionsController().districtBridgeSetCensusGeoSelection(values);
}

function districtBridgeSetCensusFile(field, filesLike){
  return getDistrictBridgeActionsController().districtBridgeSetCensusFile(field, filesLike);
}

function districtBridgeTriggerCensusAction(action){
  return getDistrictBridgeActionsController().districtBridgeTriggerCensusAction(action);
}

let reachBridgeController = null;

function getReachBridgeController(){
  if (!reachBridgeController){
    reachBridgeController = createReachBridgeRuntime({
      reachBridgeKey: REACH_BRIDGE_KEY,
      getState: () => state,
      getLastRenderCtx: () => lastRenderCtx,
      isScenarioLockedForEdits,
      computeWeeklyOpsContext,
      computeExecutionSnapshot,
      safeNum,
      buildReachWeeklyConstraintView,
      buildReachWeeklyExecutionView,
      buildReachFreshnessView,
      buildReachLeversAndActionsView,
      computeCapacityBreakdown: coreComputeCapacityBreakdown,
      clamp,
      computeRealityDrift,
      mutateState,
      setState,
      markMcStale,
      applyRollingRateToAssumption,
      applyAllRollingCalibrations,
      mergeDailyLogIntoState,
      exportDailyLog,
      getLastAppliedWeeklyAction: () => lastAppliedWeeklyAction,
      undoLastWeeklyAction,
      applyWeeklyLeverScenario,
      formatWholeNumberByMode,
      roundWholeNumberByMode,
      fmtInt,
      formatPercentFromUnit,
      formatFixedNumber,
      windowRef: typeof window !== "undefined" ? window : null,
    });
  }
  return reachBridgeController;
}

function reachBridgeFmtInt(value, options = {}){
  return getReachBridgeController().reachBridgeFmtInt(value, options);
}

function reachBridgeFmtSignedInt(value){
  return getReachBridgeController().reachBridgeFmtSignedInt(value);
}

function reachBridgeFmtPctFromRatio(value, digits = 1){
  return getReachBridgeController().reachBridgeFmtPctFromRatio(value, digits);
}

function reachBridgeFmtNum1(value){
  return getReachBridgeController().reachBridgeFmtNum1(value);
}

function reachBridgeFmtISODate(raw){
  return getReachBridgeController().reachBridgeFmtISODate(raw);
}

function reachBridgeClampNumber(raw, options = {}){
  return getReachBridgeController().reachBridgeClampNumber(raw, options);
}

function reachBridgeResolveContext(){
  return getReachBridgeController().reachBridgeResolveContext();
}

function reachBridgeComputeWeeklyView(weeklyContext, executionSnapshot){
  return getReachBridgeController().reachBridgeComputeWeeklyView(weeklyContext, executionSnapshot);
}

function reachBridgeComputeFreshnessView(currentState, weeklyContext, executionSnapshot){
  return getReachBridgeController().reachBridgeComputeFreshnessView(currentState, weeklyContext, executionSnapshot);
}

function reachBridgeBuildLeversAndActions(weeklyContext, executionSnapshot){
  return getReachBridgeController().reachBridgeBuildLeversAndActions(weeklyContext, executionSnapshot);
}

function reachBridgeStateView(){
  return getReachBridgeController().reachBridgeStateView();
}

function reachBridgeSetField(field, rawValue){
  return getReachBridgeController().reachBridgeSetField(field, rawValue);
}

function reachBridgeSetOverrideEnabled(enabled){
  return getReachBridgeController().reachBridgeSetOverrideEnabled(enabled);
}

function reachBridgeSetOverrideMode(mode){
  return getReachBridgeController().reachBridgeSetOverrideMode(mode);
}

function reachBridgeSetOverrideHorizon(rawValue){
  return getReachBridgeController().reachBridgeSetOverrideHorizon(rawValue);
}

function reachBridgeSetDailyLogImportText(value){
  return getReachBridgeController().reachBridgeSetDailyLogImportText(value);
}

function reachBridgeApplyRolling(kind){
  return getReachBridgeController().reachBridgeApplyRolling(kind);
}

function reachBridgeApplyRollingAll(){
  return getReachBridgeController().reachBridgeApplyRollingAll();
}

function reachBridgeImportDailyLog(raw){
  return getReachBridgeController().reachBridgeImportDailyLog(raw);
}

function reachBridgeExportDailyLog(){
  return getReachBridgeController().reachBridgeExportDailyLog();
}

function reachBridgeUndoLastAction(){
  return getReachBridgeController().reachBridgeUndoLastAction();
}

function reachBridgeApplyLever(id){
  return getReachBridgeController().reachBridgeApplyLever(id);
}

function installReachBridge(){
  return getReachBridgeController().installReachBridge();
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
  runInitStep("init.installElectionDataBridge", () => { installElectionDataBridge(); });
  runInitStep("init.installReachBridge", () => { installReachBridge(); });
  runInitStep("init.installTurnoutBridge", () => { installTurnoutBridge(); });
  runInitStep("init.installPlanBridge", () => { installPlanBridge(); });
  runInitStep("init.installOutcomeBridge", () => { installOutcomeBridge(); });
  runInitStep("init.installMetricProvenanceBridge", () => { installMetricProvenanceBridge(); });
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
