// @ts-check
import { engine } from "./engine.js";
import {
  computeCapacityContacts as coreComputeCapacityContacts,
  computeCapacityBreakdown as coreComputeCapacityBreakdown,
  deriveNeedVotesOrZero as coreDeriveNeedVotesOrZero,
  deriveWeeksRemainingCeil as coreDeriveWeeksRemainingCeil
} from "./core/model.js";
import { UNIVERSE_DEFAULTS, computeUniverseAdjustedRates } from "./core/universeLayer.js";
import { computeAvgLiftPP } from "./core/turnout.js";
import { computeElectionSnapshot } from "./core/electionSnapshot.js";
import { computeExecutionSnapshot } from "./core/executionSnapshot.js";
import { fmtInt, clamp, safeNum, readJsonFile } from "./utils.js";
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
import { composeSetupStageModule } from "./app/composeSetupStage.js";
import { normalizeStageLayoutModule } from "./app/normalizeStageLayout.js";
import { runInitPostBootModule } from "./app/initPostBoot.js";
import { runInitScenarioDecisionWiringModule } from "./app/initScenarioDecisionWiring.js";
import { preflightElsModule } from "./app/preflightEls.js";
import { initTabsModule, initExplainCardModule, isDevModeModule } from "./app/initUiStateHelpers.js";
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
  canonicalDoorsPerHourFromSnapModule,
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
  approxEqModule,
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
import {
  buildCriticalAuditSnapshot,
  captureCriticalAssumptionAudit,
  computeEvidenceWarnings
} from "./app/intelAudit.js";
import {
  computeIntelIntegrityScore,
  listMissingEvidenceAudit,
  listMissingNoteAudit
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
const computeSensitivitySnapshotCache =
  executionAnalysisModule?.computeSensitivitySnapshotCache || (() => ({ ok: false, code: "missing_module" }));

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
const REACH_BRIDGE_KEY = "__FPE_REACH_API__";
const TURNOUT_BRIDGE_KEY = "__FPE_TURNOUT_API__";
const PLAN_BRIDGE_KEY = "__FPE_PLAN_API__";
const DECISION_BRIDGE_KEY = "__FPE_DECISION_API__";

function dataBridgeBuildBackupOptions(){
  const selectEl = els?.restoreBackup;
  if (!(selectEl instanceof HTMLSelectElement)) {
    return [];
  }
  return Array.from(selectEl.options || [])
    .filter((opt) => opt && String(opt.value || "").trim())
    .map((opt) => ({
      value: String(opt.value || ""),
      label: String(opt.textContent || "").trim() || String(opt.value || "")
    }));
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
  const importFileName =
    loadJsonInput instanceof HTMLInputElement &&
    loadJsonInput.files &&
    loadJsonInput.files.length
      ? String(loadJsonInput.files[0]?.name || "")
      : "";
  const hashBannerText =
    els?.importHashBanner instanceof HTMLElement && !els.importHashBanner.hidden
      ? String(els.importHashBanner.textContent || "").trim()
      : "";
  const warnBannerText =
    els?.importWarnBanner instanceof HTMLElement && !els.importWarnBanner.hidden
      ? String(els.importWarnBanner.textContent || "").trim()
      : "";
  const usbStatusText = String(els?.usbStorageStatus?.textContent || "").trim();

  return {
    strictImport,
    backupOptions: dataBridgeBuildBackupOptions(),
    selectedBackup: restoreSelect instanceof HTMLSelectElement ? String(restoreSelect.value || "") : "",
    importFileName,
    hashBannerText,
    warnBannerText,
    usbConnected,
    usbStatus: usbStatusText || (usbConnected ? "External folder connected." : "Using browser storage only."),
    controls: {
      strictToggleDisabled: strictToggle instanceof HTMLInputElement ? !!strictToggle.disabled : true,
      restoreDisabled: restoreSelect instanceof HTMLSelectElement ? !!restoreSelect.disabled : true,
      saveJsonDisabled: els?.btnSaveJson instanceof HTMLButtonElement ? !!els.btnSaveJson.disabled : true,
      loadJsonDisabled: loadJsonInput instanceof HTMLInputElement ? !!loadJsonInput.disabled : true,
      copySummaryDisabled: els?.btnCopySummary instanceof HTMLButtonElement ? !!els.btnCopySummary.disabled : true,
      exportCsvDisabled: els?.btnExportCsv instanceof HTMLButtonElement ? !!els.btnExportCsv.disabled : true,
      usbConnectDisabled: els?.btnUsbStorageConnect instanceof HTMLButtonElement ? !!els.btnUsbStorageConnect.disabled : true,
      usbLoadDisabled: els?.btnUsbStorageLoad instanceof HTMLButtonElement ? !!els.btnUsbStorageLoad.disabled : true,
      usbSaveDisabled: els?.btnUsbStorageSave instanceof HTMLButtonElement ? !!els.btnUsbStorageSave.disabled : true,
      usbDisconnectDisabled: els?.btnUsbStorageDisconnect instanceof HTMLButtonElement ? !!els.btnUsbStorageDisconnect.disabled : true,
    }
  };
}

function dataBridgeSetStrictImport(enabled){
  const next = !!enabled;
  if (els?.toggleStrictImport instanceof HTMLInputElement){
    els.toggleStrictImport.checked = next;
    try{
      document.body.classList.toggle("strict-import", next);
    } catch {}
    els.toggleStrictImport.dispatchEvent(new Event("input", { bubbles: true }));
    els.toggleStrictImport.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, view: dataBridgeStateView() };
  }
  setState((s) => {
    if (!s.ui || typeof s.ui !== "object") s.ui = {};
    s.ui.strictImport = next;
  });
  return { ok: true, view: dataBridgeStateView() };
}

function dataBridgeRestoreBackup(index){
  const value = String(index ?? "").trim();
  if (!value){
    return { ok: false, code: "missing_index", view: dataBridgeStateView() };
  }
  restoreBackupByIndex(value);
  if (els?.restoreBackup instanceof HTMLSelectElement){
    els.restoreBackup.value = "";
  }
  return { ok: true, view: dataBridgeStateView() };
}

function dataBridgeTrigger(action){
  const key = String(action || "").trim();
  const handlers = {
    save_json: els?.btnSaveJson,
    load_json: els?.loadJson,
    copy_summary: els?.btnCopySummary,
    export_csv: els?.btnExportCsv,
    usb_connect: els?.btnUsbStorageConnect,
    usb_load: els?.btnUsbStorageLoad,
    usb_save: els?.btnUsbStorageSave,
    usb_disconnect: els?.btnUsbStorageDisconnect,
  };
  const target = handlers[key];
  if (!(target instanceof HTMLElement) || typeof target.click !== "function"){
    return { ok: false, code: "not_available", view: dataBridgeStateView() };
  }
  target.click();
  return { ok: true, view: dataBridgeStateView() };
}

function installDataBridge(){
  window[DATA_BRIDGE_KEY] = {
    getView: () => dataBridgeStateView(),
    setStrictImport: (enabled) => dataBridgeSetStrictImport(enabled),
    restoreBackup: (index) => dataBridgeRestoreBackup(index),
    trigger: (action) => dataBridgeTrigger(action),
  };
}

// Phase 13 — DOM preflight (prevents silent boot failures)
function preflightEls(){
  preflightElsModule({ els, recordError });
}


const DEFAULTS_BY_TEMPLATE = {
  federal: { bandWidth: 4, persuasionPct: 28, earlyVoteExp: 45 },
  state_leg: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 38 },
  municipal: { bandWidth: 5, persuasionPct: 35, earlyVoteExp: 35 },
  county: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 40 },
};

function approxEq(a, b, eps = 1e-6){
  return approxEqModule(a, b, eps);
}

function applyTemplateDefaultsForRace(targetState, raceType, { force = false } = {}){
  applyTemplateDefaultsForRaceModule(targetState, raceType, { force }, DEFAULTS_BY_TEMPLATE);
}

function deriveAssumptionsProfileFromState(snap){
  return deriveAssumptionsProfileFromStateModule(snap, DEFAULTS_BY_TEMPLATE, safeNum, approxEq);
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
let lastCriticalAuditSnapshot = buildCriticalAuditSnapshot(state);

// setState(patchFn) — controlled state mutation for UI-only writes.
// Shallow-clones state, deep-clones only state.ui (where all setState writes live).
// Engine/scenario fields are never mutated here so reference copies are safe.
// Rendering/persistence are queued through commitUIUpdate to avoid input-event thrash.
function setState(patchFn){
  const next = { ...state, ui: structuredClone(state.ui) };
  patchFn(next);
  state = next;
  commitUIUpdate();
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

// Phase 11 — session-only safety rails
let selfTestGateStatus = engine.selfTest.SELFTEST_GATE.UNVERIFIED;
let lastExportHash = null;

let lastAppliedWeeklyAction = null;

function syncWeeklyUndoUI(){
  if (!els.wkUndoActionBtn) return;
  const has = !!lastAppliedWeeklyAction;
  els.wkUndoActionBtn.disabled = !has;
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
}


function makeDefaultState(){
  return makeDefaultStateModule({
    defaultsByTemplate: DEFAULTS_BY_TEMPLATE,
    uid,
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
  return normalizeLoadedStateModule(s, {
    makeDefaultState,
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap,
    setCanonicalDoorsPerHour,
    deriveAssumptionsProfileFromState,
  });
}

function canonicalDoorsPerHourFromSnap(snap){
  return canonicalDoorsPerHourFromSnapModule(snap, safeNum);
}

function setCanonicalDoorsPerHour(target, value){
  setCanonicalDoorsPerHourModule(target, value, safeNum);
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
    setLastResultsSnapshot: (next) => { lastResultsSnapshot = next; },
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

  return {
    baselineId: SCENARIO_BASELINE_ID,
    max: SCENARIO_MAX,
    count,
    activeScenarioId: activeId,
    selectedScenarioId: selectedId,
    activeLabel: active ? `Active Scenario: ${active.name || active.id}` : "Active Scenario: —",
    warning:
      count > SCENARIO_MAX
        ? `Scenario limit exceeded (${count}/${SCENARIO_MAX}). Delete scenarios to stay under the cap.`
        : "",
    storageStatus:
      "Scenario records are session-only (in-memory) and capped to keep comparisons fast and deterministic.",
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
  refreshLegacyScenarioManagerIfMounted();
  return { ok: true, view: scenarioBridgeStateView() };
}

function installScenarioBridge(){
  window[SCENARIO_BRIDGE_KEY] = {
    getView: () => scenarioBridgeStateView(),
    selectScenario: (id) => scenarioBridgeSelect(id),
    saveNew: (name) => scenarioBridgeSaveNew(name),
    cloneBaseline: (name) => scenarioBridgeCloneBaseline(name),
    loadScenario: (id) => scenarioBridgeLoad(id),
    loadSelected: () => scenarioBridgeLoad(state?.ui?.scenarioUiSelectedId),
    returnBaseline: () => scenarioBridgeLoad(SCENARIO_BASELINE_ID),
    deleteSelected: () => scenarioBridgeDeleteSelected()
  };
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
  return fmtInt(ceil ? Math.ceil(n) : Math.round(n));
}

function reachBridgeFmtSignedInt(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  if (rounded > 0) return `+${fmtInt(rounded)}`;
  return `${fmtInt(rounded)}`;
}

function reachBridgeFmtPctFromRatio(value, digits = 1){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function reachBridgeFmtNum1(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
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
    out = Math.round(out / step) * step;
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
  const reqConvos = ctx?.convosPerWeek;
  const reqAttempts = ctx?.attemptsPerWeek;

  let constraint = "—";
  let constraintNote = "—";
  let wkBannerText = "";
  let wkBannerKind = "warn";
  let wkBannerShow = false;

  if ((ctx?.goal ?? 0) <= 0){
    constraint = "None";
    constraintNote = "Goal is 0 under current inputs.";
  } else if (ctx?.weeks == null || ctx.weeks <= 0){
    constraint = "Timeline";
    constraintNote = "Set election date or weeks remaining.";
    wkBannerText = "This week plan needs weeks remaining. Set an election date or enter weeks remaining to compute per-week targets.";
    wkBannerShow = true;
  } else if (ctx?.sr == null || ctx.sr <= 0 || ctx?.cr == null || ctx.cr <= 0){
    constraint = "Rates";
    constraintNote = "Enter support rate + contact rate.";
    wkBannerText = "This week plan needs Support rate and Contact rate.";
    wkBannerShow = true;
  } else if (ctx?.capTotal == null){
    constraint = "Capacity";
    constraintNote = "Enter organizers/hours + speeds.";
    wkBannerText = "Capacity/week is missing. Fill execution inputs (organizers, hours/week, doors/hr, calls/hr, channel split).";
    wkBannerShow = true;
  } else if (ctx?.gap != null && ctx.gap <= 0){
    constraint = "Feasible";
    constraintNote = "Capacity covers required attempts/week.";
    wkBannerText = "Feasible: capacity covers the per-week requirement under current rates.";
    wkBannerKind = "ok";
    wkBannerShow = true;
  } else if (ctx?.gap != null){
    const g = Math.ceil(ctx.gap);
    constraint = "Capacity";
    constraintNote = `Short by ~${reachBridgeFmtInt(g)} attempts/week.`;
    wkBannerText = `Gap: you are short by ~${reachBridgeFmtInt(g)} attempts per week. Options: increase organizers/hours, improve speeds, shift channel mix, or raise rates.`;
    wkBannerKind = (g <= 500) ? "warn" : "bad";
    wkBannerShow = true;
  }

  const log = executionSnapshot?.log || null;
  const hasLog = !!log?.hasLog;
  const actualConvos = hasLog ? Number(log.sumConvosWindow || 0) : null;
  const actualAttempts = hasLog ? Number(log.sumAttemptsWindow || 0) : null;
  const logEntries = hasLog ? Number(log.entries || 0) : 0;
  const logDays = hasLog ? Number(log.days || 0) : 0;
  const logLast = hasLog ? (log.lastDate || null) : null;
  const rollingCR = executionSnapshot?.rolling?.cr;

  const paceKind = (req, actual) => {
    if (req == null || !Number.isFinite(req) || req <= 0) return { kind: null, label: "—", gap: null };
    if (actual == null || !Number.isFinite(actual)) return { kind: null, label: "—", gap: null };
    const gap = actual - req;
    if (actual >= req) return { kind: "ok", label: "On pace", gap };
    if (actual >= req * 0.9) return { kind: "warn", label: "Within 10%", gap };
    return { kind: "bad", label: "Behind", gap };
  };

  let finishConvos = "—";
  let finishAttempts = "—";
  let paceStatus = "—";
  let paceNote = "Insufficient field data.";
  let wkExecBannerShow = false;
  let wkExecBannerKind = "warn";
  let wkExecBannerText = "";

  if (hasLog){
    const convosPace = paceKind(reqConvos, actualConvos);
    const attemptsPace = paceKind(reqAttempts, actualAttempts);
    const rank = { ok: 3, warn: 2, bad: 1, null: 0, undefined: 0 };
    const bannerKind = (rank[convosPace.kind] <= rank[attemptsPace.kind]) ? convosPace.kind : attemptsPace.kind;

    const finishFrom = (total, pacePerDay) => {
      if (total == null || !Number.isFinite(total) || total <= 0) return { date: null, note: "No target" };
      if (pacePerDay == null || !Number.isFinite(pacePerDay) || pacePerDay <= 0) return { date: null, note: "No measurable pace" };
      const daysNeeded = Math.ceil(total / pacePerDay);
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + daysNeeded);
      return { date: d, note: `~${reachBridgeFmtInt(daysNeeded)} day(s) at current pace` };
    };

    const paceAttemptsPerDay = (logDays && logDays > 0 && Number.isFinite(actualAttempts)) ? (actualAttempts / logDays) : null;
    const paceConvosPerDay = (logDays && logDays > 0 && Number.isFinite(actualConvos)) ? (actualConvos / logDays) : null;
    const convFinish = finishFrom(ctx?.convosNeeded ?? (reqConvos != null && ctx?.weeks != null ? reqConvos * ctx.weeks : null), paceConvosPerDay);
    const attFinish = finishFrom(ctx?.attemptsNeeded ?? (reqAttempts != null && ctx?.weeks != null ? reqAttempts * ctx.weeks : null), paceAttemptsPerDay);
    finishConvos = convFinish.date ? reachBridgeFmtISODate(convFinish.date) : (convFinish.note || "—");
    finishAttempts = attFinish.date ? reachBridgeFmtISODate(attFinish.date) : (attFinish.note || "—");

    if (bannerKind === "ok"){
      paceStatus = "On pace";
      paceNote = "Last 7-entry pace meets or exceeds weekly requirement.";
    } else if (bannerKind === "warn"){
      paceStatus = "Tight";
      paceNote = "Within 10% of weekly requirement. Any slip risks missing timeline.";
    } else if (bannerKind === "bad"){
      paceStatus = "Behind";
      paceNote = "Behind weekly requirement by more than 10%.";
    } else {
      paceStatus = "—";
      paceNote = "Set goal + weeks remaining to compute requirement.";
    }

    wkExecBannerShow = (bannerKind === "ok" || bannerKind === "warn" || bannerKind === "bad");
    wkExecBannerKind = bannerKind || "warn";
    wkExecBannerText = wkExecBannerShow
      ? `Last 7: ${reachBridgeFmtInt(actualConvos)} convos / ${reachBridgeFmtInt(actualAttempts)} attempts vs required ${reachBridgeFmtInt(reqConvos, { ceil: true })} convos / ${reachBridgeFmtInt(reqAttempts, { ceil: true })} attempts per week.`
      : "";
  }

  const reqDoorAttempts = (
    reqAttempts != null &&
    Number.isFinite(reqAttempts) &&
    ctx?.doorShare != null &&
    Number.isFinite(ctx.doorShare)
  )
    ? (reqAttempts * clamp(ctx.doorShare, 0, 1))
    : null;
  const reqCallAttempts = (
    reqAttempts != null &&
    Number.isFinite(reqAttempts) &&
    ctx?.doorShare != null &&
    Number.isFinite(ctx.doorShare)
  )
    ? (reqAttempts * (1 - clamp(ctx.doorShare, 0, 1)))
    : null;

  const impliedConvos = (
    rollingCR != null &&
    Number.isFinite(rollingCR) &&
    reqAttempts != null &&
    Number.isFinite(reqAttempts)
  )
    ? (reqAttempts * rollingCR)
    : null;

  const gapText = (ctx?.gap == null || !Number.isFinite(ctx.gap))
    ? "—"
    : (ctx.gap <= 0 ? "0" : reachBridgeFmtInt(ctx.gap, { ceil: true }));

  const actualConvosNote = hasLog ? `${reachBridgeFmtInt(logEntries)} entries over ~${reachBridgeFmtInt(logDays)} day(s) · last: ${logLast || "—"}` : "Insufficient field data.";
  const impliedConvosNote = Number.isFinite(rollingCR) ? `Uses rolling 7-entry contact rate (${(rollingCR * 100).toFixed(1)}%)` : "Insufficient field data.";

  return {
    goal: reachBridgeFmtInt(ctx?.goal ?? null),
    requiredAttempts: reachBridgeFmtInt(reqAttempts, { ceil: true }),
    requiredConvos: reachBridgeFmtInt(reqConvos, { ceil: true }),
    requiredDoors: reachBridgeFmtInt(reqDoorAttempts, { ceil: true }),
    requiredCalls: reachBridgeFmtInt(reqCallAttempts, { ceil: true }),
    impliedConvos: reachBridgeFmtInt(impliedConvos),
    impliedConvosNote,
    capacity: reachBridgeFmtInt(ctx?.capTotal, { ceil: true }),
    gap: gapText,
    constraint,
    constraintNote,
    paceStatus,
    paceNote,
    finishConvos,
    finishAttempts,
    actualConvosNote,
    wkBanner: {
      show: wkBannerShow,
      kind: wkBannerKind,
      text: wkBannerText
    },
    wkExecBanner: {
      show: wkExecBannerShow,
      kind: wkExecBannerKind,
      text: wkExecBannerText
    }
  };
}

function reachBridgeComputeFreshnessView(currentState, weeklyContext, executionSnapshot){
  const snap = executionSnapshot || null;
  const log = Array.isArray(currentState?.ui?.dailyLog) ? currentState.ui.dailyLog : [];
  const hasLog = snap ? !!snap?.log?.hasLog : !!log.length;
  const empty = {
    lastUpdate: "—",
    freshNote: "No daily log configured yet",
    rollingAttempts: "—",
    rollingNote: "Add entries in organizer.html to activate reality checks",
    rollingCR: "—",
    rollingCRNote: "—",
    rollingSR: "—",
    rollingSRNote: "—",
    rollingAPH: "—",
    rollingAPHNote: "—",
    status: "Not tracking",
  };
  if (!hasLog){
    return empty;
  }

  const sorted = snap?.log?.sorted || [...log].filter((x) => x && x.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = sorted[sorted.length - 1];

  const sumAttempts = Number(snap?.log?.sumAttemptsWindow ?? 0);
  const sumConvos = Number(snap?.log?.sumConvosWindow ?? 0);
  const sumSupportIds = Number(snap?.log?.sumSupportIdsWindow ?? 0);
  const sumOrgHours = Number(snap?.log?.sumOrgHoursWindow ?? 0);

  const actualCR = snap?.rolling?.cr ?? (sumAttempts > 0 ? (sumConvos / sumAttempts) : null);
  const actualSR = snap?.rolling?.sr ?? (sumConvos > 0 ? (sumSupportIds / sumConvos) : null);
  const actualAPH = snap?.rolling?.aph ?? (sumOrgHours > 0 ? (sumAttempts / sumOrgHours) : null);

  const assumedCR = snap?.assumptions?.cr ?? (
    currentState?.contactRatePct != null && currentState.contactRatePct !== ""
      ? (safeNum(currentState.contactRatePct) || 0) / 100
      : null
  );
  const assumedSR = snap?.assumptions?.sr ?? (
    currentState?.supportRatePct != null && currentState.supportRatePct !== ""
      ? (safeNum(currentState.supportRatePct) || 0) / 100
      : null
  );
  const expectedAPH = snap?.assumptions?.aph ?? (() => {
    const mixDoor = (currentState?.channelDoorPct != null && currentState.channelDoorPct !== "")
      ? (safeNum(currentState.channelDoorPct) || 0) / 100
      : null;
    const doorsHr = (currentState?.doorsPerHour3 != null && currentState.doorsPerHour3 !== "")
      ? (safeNum(currentState.doorsPerHour3) || 0)
      : null;
    const callsHr = (currentState?.callsPerHour3 != null && currentState.callsPerHour3 !== "")
      ? (safeNum(currentState.callsPerHour3) || 0)
      : null;
    return (mixDoor != null && doorsHr != null && callsHr != null)
      ? (mixDoor * doorsHr + (1 - mixDoor) * callsHr)
      : null;
  })();

  const req = snap?.pace?.requiredAttemptsPerWeek ?? weeklyContext?.attemptsPerWeek ?? null;
  let ratio = snap?.pace?.ratio ?? null;
  if ((ratio == null || !Number.isFinite(ratio)) && req != null && Number.isFinite(req) && req > 0){
    ratio = sumAttempts / req;
  }

  const flags = [];
  const tol = 0.90;
  if (assumedCR != null && Number.isFinite(actualCR) && actualCR < assumedCR * tol) flags.push("contact rate below assumed");
  if (assumedSR != null && Number.isFinite(actualSR) && actualSR < assumedSR * tol) flags.push("support rate below assumed");
  if (expectedAPH != null && Number.isFinite(actualAPH) && actualAPH < expectedAPH * tol) flags.push("productivity below assumed");

  let status = "Needs inputs";
  if (ratio == null || !Number.isFinite(ratio)){
    status = flags.length ? "Assumptions drifting" : "Needs inputs";
  } else if (ratio >= 1.0 && flags.length === 0){
    status = "On pace";
  } else if (ratio >= 1.0 && flags.length){
    status = "On pace (assumptions off)";
  } else if (ratio >= 0.85 && flags.length === 0){
    status = "Slightly behind";
  } else if (ratio >= 0.85 && flags.length){
    status = "Behind (rates/capacity off)";
  } else {
    status = "Behind";
  }

  return {
    lastUpdate: last?.date || "—",
    freshNote: flags.length ? `Reality check: ${flags.join(", ")}` : "Using state.ui.dailyLog",
    rollingAttempts: reachBridgeFmtInt(sumAttempts),
    rollingNote: (req == null || !Number.isFinite(req))
      ? "Required attempts/week unavailable under current inputs"
      : `Required ≈ ${reachBridgeFmtInt(req, { ceil: true })} attempts/week`,
    rollingCR: reachBridgeFmtPctFromRatio(actualCR),
    rollingCRNote: (assumedCR == null) ? "Assumed: —" : `Assumed: ${reachBridgeFmtPctFromRatio(assumedCR)}`,
    rollingSR: reachBridgeFmtPctFromRatio(actualSR),
    rollingSRNote: (assumedSR == null) ? "Assumed: —" : `Assumed: ${reachBridgeFmtPctFromRatio(assumedSR)}`,
    rollingAPH: reachBridgeFmtNum1(actualAPH),
    rollingAPHNote: (expectedAPH == null) ? "Expected: —" : `Expected: ${reachBridgeFmtNum1(expectedAPH)} / hr`,
    status,
  };
}

function reachBridgeBuildLeversAndActions(weeklyContext, executionSnapshot){
  const opsCtx = weeklyContext || {};
  const fmtCeil = (v) => reachBridgeFmtInt(v, { ceil: true });
  const fmtNum1 = (v) => reachBridgeFmtNum1(v);
  const base = {
    intro: "",
    foot: "",
    bestMovesIntro: "Best 3 moves — impact per unit:",
    showBestMoves: true,
    bestMoves: [],
    rows: [],
    actions: [],
    actionsNote: "Recommendations are based on current model inputs.",
  };

  if ((opsCtx.goal ?? 0) <= 0){
    return {
      ...base,
      intro: "No operational gap to analyze (goal is 0 under current inputs).",
      showBestMoves: false,
      actions: ["Set a goal (Support IDs needed) or adjust win path assumptions to generate a real plan."],
      foot: ""
    };
  }
  if (opsCtx.weeks == null || opsCtx.weeks <= 0){
    return {
      ...base,
      intro: "Timeline is missing. Set election date or weeks remaining to compute weekly pressure.",
      showBestMoves: false,
      actions: ["Enter an election date (or weeks remaining) so the plan can compute per-week targets."],
      foot: ""
    };
  }
  if (opsCtx.sr == null || opsCtx.sr <= 0 || opsCtx.cr == null || opsCtx.cr <= 0){
    return {
      ...base,
      intro: "Rates are missing. Enter Support rate and Contact rate to estimate workload.",
      showBestMoves: false,
      actions: ["Fill Support rate (%) and Contact rate (%) to compute realistic workload."],
      foot: ""
    };
  }
  if (opsCtx.capTotal == null || !Number.isFinite(opsCtx.capTotal)){
    return {
      ...base,
      intro: "Capacity inputs are incomplete. Fill execution inputs to compute what is executable.",
      showBestMoves: false,
      actions: ["Enter organizers, hours/week, doors/hr, calls/hr, and channel split."],
      foot: ""
    };
  }

  const baseReq = opsCtx.attemptsPerWeek;
  const baseCap = opsCtx.capTotal;
  const gap = (baseReq != null && baseCap != null) ? Math.max(0, baseReq - baseCap) : null;
  const isGap = (gap != null && gap > 0);
  const intro = isGap
    ? `You are short by ~${fmtCeil(gap)} attempts/week. These levers estimate attempts/week relief in consistent units.`
    : "You are currently feasible (capacity covers attempts/week). These levers estimate buffer gained per unit.";

  const capTotal = (p) => {
    const out = coreComputeCapacityBreakdown(p);
    return out?.total;
  };

  const levers = [];
  const pushLever = (x) => {
    if (!x) return;
    if (x.impact == null || !Number.isFinite(x.impact) || x.impact <= 0) return;
    const impactUse = isGap ? Math.min(x.impact, gap) : x.impact;
    const eff = (x.costScalar != null && Number.isFinite(x.costScalar) && x.costScalar > 0) ? (impactUse / x.costScalar) : null;
    levers.push({ ...x, impactUse, eff });
  };

  const baseCapParams = {
    weeks: 1,
    orgCount: opsCtx.orgCount,
    orgHoursPerWeek: opsCtx.orgHoursPerWeek,
    volunteerMult: opsCtx.volunteerMult,
    doorShare: opsCtx.doorShare,
    doorsPerHour: opsCtx.doorsPerHour,
    callsPerHour: opsCtx.callsPerHour,
    capacityDecay: opsCtx.capacityDecay,
  };

  if (opsCtx.orgCount != null && opsCtx.orgHoursPerWeek != null && opsCtx.volunteerMult != null){
    const plusOrg = capTotal({ ...baseCapParams, orgCount: opsCtx.orgCount + 1 });
    if (plusOrg != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "org",
        label: "+1 organizer",
        impact: plusOrg - baseCap,
        costLabel: "1 organizer",
        costScalar: 1,
        effUnit: "per organizer",
      });
    }

    const plusHr = capTotal({ ...baseCapParams, orgHoursPerWeek: opsCtx.orgHoursPerWeek + 1 });
    if (plusHr != null && baseCap != null){
      const addedHours = Math.max(1, opsCtx.orgCount || 1);
      pushLever({
        kind: "capacity",
        key: "orgHr",
        label: "+1 hour/week per organizer",
        impact: plusHr - baseCap,
        costLabel: `+1 hr/org (= ${fmtCeil(addedHours)} org-hrs/wk)`,
        costScalar: addedHours,
        effUnit: "per org-hour",
      });
    }

    const plusVol = capTotal({ ...baseCapParams, volunteerMult: opsCtx.volunteerMult + 0.10 });
    if (plusVol != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "volMult",
        label: "+10% volunteer multiplier",
        impact: plusVol - baseCap,
        costLabel: "+10% volunteer mult",
        costScalar: 0.10,
        effUnit: "per +10% mult",
      });
    }
  }

  if (opsCtx.doorsPerHour != null){
    const plusDoorHr = capTotal({ ...baseCapParams, doorsPerHour: opsCtx.doorsPerHour + 1 });
    if (plusDoorHr != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "dph",
        label: "+1 door/hr",
        impact: plusDoorHr - baseCap,
        costLabel: "+1 door/hr",
        costScalar: 1,
        effUnit: "per +1 door/hr",
      });
    }
  }

  if (opsCtx.callsPerHour != null){
    const plusCallHr = capTotal({ ...baseCapParams, callsPerHour: opsCtx.callsPerHour + 1 });
    if (plusCallHr != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "cph",
        label: "+1 call/hr",
        impact: plusCallHr - baseCap,
        costLabel: "+1 call/hr",
        costScalar: 1,
        effUnit: "per +1 call/hr",
      });
    }
  }

  if (opsCtx.doorShare != null && opsCtx.doorsPerHour != null && opsCtx.callsPerHour != null){
    const doorIsFaster = opsCtx.doorsPerHour >= opsCtx.callsPerHour;
    const shift = 0.10;
    const newShare = clamp(opsCtx.doorShare + (doorIsFaster ? shift : -shift), 0, 1);
    const capShift = capTotal({ ...baseCapParams, doorShare: newShare });
    if (capShift != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "mix",
        label: `Shift mix +10 pts toward ${doorIsFaster ? "doors" : "calls"}`,
        impact: capShift - baseCap,
        costLabel: "10 pts mix shift",
        costScalar: 10,
        effUnit: "per 1 pt",
      });
    }
  }

  const pp = 0.01;
  if (baseReq != null && Number.isFinite(baseReq)){
    const srPlus = Math.min(0.99, opsCtx.sr + pp);
    const crPlus = Math.min(0.99, opsCtx.cr + pp);

    const reqSrPlus = (opsCtx.goal > 0 && srPlus > 0 && opsCtx.cr > 0 && opsCtx.weeks > 0)
      ? (opsCtx.goal / srPlus / opsCtx.cr / opsCtx.weeks)
      : null;
    if (reqSrPlus != null){
      pushLever({
        kind: "rates",
        key: "sr",
        label: "+1 pp support rate",
        impact: baseReq - reqSrPlus,
        costLabel: "+1 pp SR",
        costScalar: 1,
        effUnit: "per +1pp",
      });
    }

    const reqCrPlus = (opsCtx.goal > 0 && crPlus > 0 && opsCtx.sr > 0 && opsCtx.weeks > 0)
      ? (opsCtx.goal / opsCtx.sr / crPlus / opsCtx.weeks)
      : null;
    if (reqCrPlus != null){
      pushLever({
        kind: "rates",
        key: "cr",
        label: "+1 pp contact rate",
        impact: baseReq - reqCrPlus,
        costLabel: "+1 pp CR",
        costScalar: 1,
        effUnit: "per +1pp",
      });
    }

    const wPlus = opsCtx.weeks + 1;
    const reqWPlus = (opsCtx.goal > 0 && opsCtx.sr > 0 && opsCtx.cr > 0 && wPlus > 0)
      ? (opsCtx.goal / opsCtx.sr / opsCtx.cr / wPlus)
      : null;
    if (reqWPlus != null){
      pushLever({
        kind: "timeline",
        key: "weeks",
        label: "+1 week timeline",
        impact: baseReq - reqWPlus,
        costLabel: "+1 week",
        costScalar: 1,
        effUnit: "per week",
      });
    }
  }

  const usable = levers
    .filter((x) => x.impactUse != null && Number.isFinite(x.impactUse) && x.impactUse > 0)
    .sort((a, b) => (b.impactUse - a.impactUse));

  if (!usable.length){
    return {
      ...base,
      intro,
      showBestMoves: false,
      actions: ["No lever estimates available under current inputs."],
      foot: "",
    };
  }

  const bestByEff = [...usable]
    .filter((x) => x.eff != null && Number.isFinite(x.eff))
    .sort((a, b) => (b.eff - a.eff) || (b.impactUse - a.impactUse))
    .slice(0, 3);

  const rows = usable.slice(0, 10);
  const bestCap = usable.filter((x) => x.kind === "capacity").sort((a, b) => (b.impactUse - a.impactUse))[0] || null;
  const bestRate = usable.filter((x) => x.kind === "rates").sort((a, b) => (b.impactUse - a.impactUse))[0] || null;
  const bestCr = usable.find((x) => x.kind === "rates" && x.key === "cr") || null;
  const bestSr = usable.find((x) => x.kind === "rates" && x.key === "sr") || null;

  const drift = executionSnapshot
    ? {
        hasLog: !!executionSnapshot?.log?.hasLog,
        flags: Array.isArray(executionSnapshot?.drift?.flags) ? executionSnapshot.drift.flags : [],
        primary: executionSnapshot?.drift?.primary || null,
      }
    : computeRealityDrift();
  const hasDrift = !!(drift?.hasLog && drift?.flags?.length);
  const primary = drift?.primary || null;

  const actions = [];
  if (isGap){
    if (hasDrift){
      if (primary === "productivity"){
        if (bestCap) actions.push(`Reality check shows productivity below assumed. Close the gap by raising execution capacity first: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
        if (bestCr) actions.push(`Then reduce workload by improving contact rate: ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week relief).`);
        else if (bestRate) actions.push(`Then reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      } else if (primary === "contact"){
        if (bestCr) actions.push(`Reality check shows contact rate below assumed. Prioritize: ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week relief).`);
        if (bestCap) actions.push(`If rate lift is slow, backstop with more capacity: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      } else if (primary === "support"){
        if (bestSr) actions.push(`Reality check shows support rate below assumed. Prioritize: ${bestSr.label} (≈ ${fmtCeil(bestSr.impactUse)} attempts/week relief).`);
        if (bestCap) actions.push(`If persuasion lift is slow, backstop with more capacity: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      } else {
        if (bestCap) actions.push(`Close the gap by increasing execution capacity: start with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
        if (bestRate) actions.push(`Reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      }
      actions.push("If actual performance stays below assumptions, either align assumptions to reality (and re-plan) or change inputs to close the gap (capacity, speeds, mix, training).");
    } else {
      if (bestCap) actions.push(`Close the gap by increasing execution capacity: start with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      if (bestRate) actions.push(`Reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      actions.push("If neither is realistic, reduce weekly pressure by extending timeline assumptions (more weeks) or revising the goal (Support IDs needed).");
    }
  } else {
    if (hasDrift){
      if (primary === "productivity" && bestCap) actions.push(`You are feasible, but productivity is below assumed. Add buffer with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week).`);
      if (primary === "contact" && bestCr) actions.push(`You are feasible, but contact rate is below assumed. Improve efficiency with ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week).`);
      if (primary === "support" && bestSr) actions.push(`You are feasible, but support rate is below assumed. Improve efficiency with ${bestSr.label} (≈ ${fmtCeil(bestSr.impactUse)} attempts/week).`);
      if (!actions.length && bestRate) actions.push(`You are feasible, but assumptions are drifting. Consider ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week).`);
      actions.push("Use buffer to absorb volatility, and align assumptions to observed daily log so planning stays honest.");
    } else {
      if (bestCap) actions.push(`Build buffer: ${bestCap.label} adds ≈ ${fmtCeil(bestCap.impactUse)} attempts/week of slack.`);
      if (bestRate) actions.push(`Improve efficiency: ${bestRate.label} reduces required attempts by ≈ ${fmtCeil(bestRate.impactUse)} attempts/week.`);
      actions.push("Use the buffer to absorb volatility (bad weeks, weather, volunteer drop-off) or to front-load early vote chasing.");
    }
  }

  return {
    ...base,
    intro,
    foot: isGap
      ? "Impact estimates are local and directional; apply changes one at a time and verify updated weekly gap."
      : "Use this as a buffer-building guide; apply changes one at a time and keep assumptions auditable.",
    bestMoves: bestByEff.map((lever) => ({
      id: `${lever.kind}:${lever.key}`,
      text: `${lever.label}: ~${fmtCeil(lever.impactUse)} attempts/week (${fmtNum1(lever.eff)} ${lever.effUnit})`,
      lever,
    })),
    rows: rows.map((lever) => ({
      id: `${lever.kind}:${lever.key}`,
      label: lever.label,
      impact: `~${fmtCeil(lever.impactUse)}`,
      costUnit: lever.costLabel || "—",
      efficiency: (lever.eff == null || !Number.isFinite(lever.eff)) ? "—" : fmtNum1(lever.eff),
      lever,
    })),
    actions: actions.slice(0, 4),
    actionsNote: hasDrift
      ? "Recommendations include reality-drift signals from recent organizer logs."
      : "Recommendations are model-based. Add organizer logs to activate drift-aware recommendations.",
  };
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

  setState((next) => {
    next[field] = parsed;
  });
  markMcStale();
  return { ok: true, view: reachBridgeStateView() };
}

function reachBridgeSetOverrideEnabled(enabled){
  if (isScenarioLockedForEdits(state)){
    return { ok: false, code: "locked", view: reachBridgeStateView() };
  }
  setState((next) => {
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
  setState((next) => {
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
  setState((next) => {
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
  const locked = isScenarioLockedForEdits(state);
  return {
    inputs: {
      turnoutEnabled: !!state.turnoutEnabled,
      turnoutBaselinePct: state.turnoutBaselinePct ?? "",
      turnoutTargetOverridePct: state.turnoutTargetOverridePct ?? "",
      gotvMode: state.gotvMode || "basic",
      gotvDiminishing: !!state.gotvDiminishing,
      gotvLiftPP: state.gotvLiftPP ?? "",
      gotvMaxLiftPP: state.gotvMaxLiftPP ?? "",
      gotvLiftMin: state.gotvLiftMin ?? "",
      gotvLiftMode: state.gotvLiftMode ?? "",
      gotvLiftMax: state.gotvLiftMax ?? "",
      gotvMaxLiftPP2: state.gotvMaxLiftPP2 ?? "",
      roiDoorsEnabled: !!doors.enabled,
      roiDoorsCpa: doors.cpa ?? "",
      roiDoorsKind: doors.kind || "persuasion",
      roiDoorsCr: doors.crPct ?? "",
      roiDoorsSr: doors.srPct ?? "",
      roiPhonesEnabled: !!phones.enabled,
      roiPhonesCpa: phones.cpa ?? "",
      roiPhonesKind: phones.kind || "persuasion",
      roiPhonesCr: phones.crPct ?? "",
      roiPhonesSr: phones.srPct ?? "",
      roiTextsEnabled: !!texts.enabled,
      roiTextsCpa: texts.cpa ?? "",
      roiTextsKind: texts.kind || "persuasion",
      roiTextsCr: texts.crPct ?? "",
      roiTextsSr: texts.srPct ?? "",
      roiOverheadAmount: state?.budget?.overheadAmount ?? "",
      roiIncludeOverhead: !!state?.budget?.includeOverhead,
    },
    controls: {
      locked,
      refreshDisabled: false,
    },
    options: TURNOUT_SELECT_OPTIONS,
    roiRows,
    roiBannerText,
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
    setState((next) => {
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
    setState((next) => {
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
  setState((next) => {
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
  optObjective: [
    { value: "net", label: "Net Votes" },
    { value: "turnout", label: "Turnout-Adjusted Net Votes" },
  ],
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
  if (!optimize.mode) optimize.mode = "budget";
  if (!optimize.objective) optimize.objective = "net";
  if (typeof optimize.tlConstrainedEnabled !== "boolean") optimize.tlConstrainedEnabled = false;
  if (!optimize.tlConstrainedObjective) optimize.tlConstrainedObjective = "max_net";
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
  if (!target.timelineRampMode) target.timelineRampMode = "linear";
  if (!Number.isFinite(Number(target.timelineDoorsPerHour))) target.timelineDoorsPerHour = 30;
  if (!Number.isFinite(Number(target.timelineCallsPerHour))) target.timelineCallsPerHour = 20;
  if (!Number.isFinite(Number(target.timelineTextsPerHour))) target.timelineTextsPerHour = 120;
}

function planBridgeStateView(){
  ensurePlanBridgeShape(state);
  const optimize = state?.budget?.optimize || {};
  const optimizerRowsRaw = Array.isArray(state?.ui?.lastPlanRows) ? state.ui.lastPlanRows : [];
  const optimizerRows = optimizerRowsRaw.map((row) => ({
    tactic: String(row?.tactic || ""),
    attempts: safeNum(row?.attempts),
    cost: safeNum(row?.cost),
    expectedNetVotes: safeNum(row?.expectedNetVotes),
  }));
  const locked = isScenarioLockedForEdits(state);
  return {
    inputs: {
      optMode: optimize.mode || "budget",
      optObjective: optimize.objective || "net",
      tlOptEnabled: !!optimize.tlConstrainedEnabled,
      tlOptObjective: optimize.tlConstrainedObjective || "max_net",
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
      timelineRampMode: state.timelineRampMode || "linear",
      timelineDoorsPerHour: state.timelineDoorsPerHour ?? "",
      timelineCallsPerHour: state.timelineCallsPerHour ?? "",
      timelineTextsPerHour: state.timelineTextsPerHour ?? "",
    },
    controls: {
      locked,
      runDisabled: locked,
    },
    options: PLAN_SELECT_OPTIONS,
    optimizerRows,
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
    setState((next) => {
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
    setState((next) => {
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
  setState((next) => {
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

function decisionBridgeFmtInt(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return fmtInt(Math.round(n));
}

function decisionBridgeFmtPct(value, digits = 1){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function decisionBridgeFmtSignedPct(value, digits = 1){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

function decisionBridgeFmtSignedNum(value, digits = 1){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}`;
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

function decisionBridgeCurrentSnapshot(){
  ensureScenarioRegistry();
  ensureDecisionScaffold();

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
  };
}

function decisionBridgeDiagnosticsSnapshot(){
  const exec = decisionBridgeDriftSnapshot();
  const risk = decisionBridgeRiskSnapshot();
  const bottleneck = decisionBridgeBottleneckSnapshot();
  const sensitivity = decisionBridgeSensitivitySnapshot();
  const confidence = decisionBridgeConfidenceSnapshot({ exec, risk, bottleneck });
  return { exec, risk, bottleneck, sensitivity, confidence };
}

function decisionBridgeDriftSnapshot(){
  const executionSnapshot = lastRenderCtx?.executionSnapshot || null;
  const weeklyContext = lastRenderCtx?.weeklyContext || null;
  const req = executionSnapshot?.pace?.requiredAttemptsPerWeek ?? weeklyContext?.attemptsPerWeek ?? null;
  const hasLog = executionSnapshot ? !!executionSnapshot?.log?.hasLog : false;
  const actual = hasLog ? executionSnapshot?.log?.sumAttemptsWindow ?? null : null;
  let delta = executionSnapshot?.pace?.ratio;
  if (delta != null && Number.isFinite(delta)) {
    delta = delta - 1;
  } else if (Number.isFinite(req) && req > 0 && Number.isFinite(actual)) {
    delta = (actual - req) / req;
  } else {
    delta = null;
  }

  const abs = Number.isFinite(delta) ? Math.abs(delta) : null;
  const cls = abs == null ? "" : abs <= 0.05 ? "ok" : abs <= 0.15 ? "warn" : "bad";
  const tag = abs == null ? "Not tracking" : cls === "ok" ? "Green" : cls === "warn" ? "Yellow" : "Red";
  const slipDays = Number.isFinite(executionSnapshot?.pace?.projectedSlipDays)
    ? Math.max(0, Math.round(executionSnapshot.pace.projectedSlipDays))
    : null;
  const banner = !hasLog
    ? "Add daily log entries in organizer.html to activate drift detection."
    : slipDays == null
      ? "At current pace, projected slip unavailable under current inputs."
      : slipDays === 0
        ? "At current pace, target completion stays on schedule."
        : `At current pace, target completion shifts by +${decisionBridgeFmtInt(slipDays)} days.`;

  return {
    tag,
    cls,
    reqText: Number.isFinite(req) ? decisionBridgeFmtInt(req) : "—",
    actualText: Number.isFinite(actual) ? decisionBridgeFmtInt(actual) : "—",
    deltaText: Number.isFinite(delta) ? decisionBridgeFmtSignedPct(delta, 1) : "—",
    banner,
  };
}

function decisionBridgeRiskSnapshot(){
  const mc = state?.mcLast || null;
  if (!mc){
    return {
      tag: "—",
      cls: "",
      winProbText: "—",
      marginBandText: "—",
      volatilityText: "—",
      banner: "Run Monte Carlo to enable risk framing.",
    };
  }

  const winProb = Number(mc.winProb);
  const pct = Number.isFinite(winProb) ? clamp(winProb, 0, 1) : null;
  const envelope = mc?.confidenceEnvelope?.percentiles || null;
  const low = Number.isFinite(Number(envelope?.p10)) ? Number(envelope.p10)
    : Number.isFinite(Number(envelope?.p5)) ? Number(envelope.p5)
    : null;
  const high = Number.isFinite(Number(envelope?.p90)) ? Number(envelope.p90)
    : Number.isFinite(Number(envelope?.p95)) ? Number(envelope.p95)
    : null;
  const width = Number.isFinite(low) && Number.isFinite(high) ? (high - low) : null;
  const bandText = (Number.isFinite(low) && Number.isFinite(high))
    ? `${low.toFixed(1)} to ${high.toFixed(1)}`
    : "—";

  let tag = "Volatile";
  let cls = "bad";
  if (pct == null){
    tag = "—";
    cls = "";
  } else if (pct >= 0.70 && (!Number.isFinite(width) || width <= 8)){
    tag = "High confidence";
    cls = "ok";
  } else if (pct >= 0.55 && (!Number.isFinite(width) || width <= 14)){
    tag = "Lean";
    cls = "warn";
  }

  const banner = pct == null
    ? "Risk framing unavailable."
    : tag === "High confidence"
      ? "Model indicates a durable advantage under current assumptions."
      : tag === "Lean"
        ? "Outcome is favorable but still sensitive to execution drift."
        : "Outcome is fragile; small assumption shifts can change the forecast.";

  return {
    tag,
    cls,
    winProbText: pct == null ? "—" : decisionBridgeFmtPct(pct, 1),
    marginBandText: bandText,
    volatilityText: Number.isFinite(width) ? width.toFixed(1) : "—",
    banner,
  };
}

function decisionBridgeBottleneckSnapshot(){
  const bindingObj = state?.ui?.lastTlMeta?.bindingObj || {};
  const timeline = Array.isArray(bindingObj?.timeline) ? bindingObj.timeline : [];
  const hasBinding = !!bindingObj?.budget || !!bindingObj?.capacity || timeline.length > 0;
  const primary = state?.ui?.lastDiagnostics?.primaryBottleneck
    || (timeline[0] ? `timeline: ${timeline[0]}` : "none/unknown");
  const secondary = state?.ui?.lastDiagnostics?.secondaryNotes
    || (timeline[1] ? `timeline: ${timeline[1]}` : "—");

  return {
    tag: hasBinding ? "Binding" : "Clear",
    cls: hasBinding ? "warn" : "ok",
    primary,
    secondary,
    warn: hasBinding
      ? "Constraint stack is binding at current optimization settings."
      : "No active bottleneck constraints under current optimization settings.",
    rows: [],
  };
}

function decisionBridgeSensitivitySnapshot(){
  const cache = state?.ui?.e4Sensitivity || null;
  if (!cache || !Array.isArray(cache.rows) || !cache.rows.length){
    return {
      tag: "—",
      cls: "",
      banner: "No sensitivity rows. Run snapshot.",
      rows: [],
    };
  }
  return {
    tag: cache.tag || "Snapshot",
    cls: cache.cls || "",
    banner: cache.banner || "Sensitivity snapshot available.",
    rows: cache.rows.map((row) => ({
      perturbation: row?.label || "—",
      dWin: row?.dWin || "—",
      dP50: row?.dP50 || "—",
      notes: row?.note || "",
    })),
  };
}

function decisionBridgeConfidenceSnapshot({ exec, risk, bottleneck }){
  const scoreExec = exec?.cls === "ok" ? 25 : exec?.cls === "warn" ? 15 : exec?.cls === "bad" ? 5 : 10;
  const scoreRisk = risk?.cls === "ok" ? 25 : risk?.cls === "warn" ? 15 : risk?.cls === "bad" ? 5 : 10;
  const scoreBneck = bottleneck?.cls === "ok" ? 25 : 10;

  ensureScenarioRegistry();
  const reg = state?.ui?.scenarios || {};
  const activeId = state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID;
  const base = reg?.[SCENARIO_BASELINE_ID] || null;
  const active = reg?.[activeId] || null;
  let divergenceCount = 0;
  if (base && active && activeId !== SCENARIO_BASELINE_ID){
    const keyOrder = [
      "raceType","mode","electionDate","weeksRemaining",
      "universeBasis","universeSize","goalSupportIds",
      "supportRatePct","contactRatePct","turnoutReliabilityPct",
      "orgCount","orgHoursPerWeek","volunteerMultBase"
    ];
    const before = base.inputs || {};
    const after = active.inputs || {};
    keyOrder.forEach((key) => {
      const a = before?.[key];
      const b = after?.[key];
      const same = (a === b) || (String(a ?? "") === String(b ?? ""));
      if (!same) divergenceCount += 1;
    });
  }
  const divergenceLabel = divergenceCount <= 3 ? "Low" : divergenceCount <= 8 ? "Moderate" : "High";
  const scoreDiv = divergenceLabel === "Low" ? 25 : divergenceLabel === "Moderate" ? 15 : 5;

  const score = scoreExec + scoreRisk + scoreBneck + scoreDiv;
  const rating = score >= 80 ? "Strong" : score >= 50 ? "Moderate" : "Low";
  const cls = rating === "Strong" ? "ok" : rating === "Moderate" ? "warn" : "bad";

  return {
    tag: rating,
    cls,
    exec: exec?.cls === "ok" ? "On pace" : exec?.cls === "warn" ? "Drifting" : exec?.cls === "bad" ? "Off pace" : "—",
    risk: risk?.tag || "—",
    tight: bottleneck?.cls === "ok" ? "Clear" : "Binding",
    divergence: divergenceLabel,
    banner: rating === "Strong"
      ? "Confidence is strong across pace, risk, and constraint posture."
      : rating === "Moderate"
        ? "Confidence is moderate; review drift and risk before commitment."
        : "Confidence is low; assumptions and constraints need remediation before commitment.",
  };
}

function decisionBridgeStateView(){
  const snap = decisionBridgeCurrentSnapshot();
  const s = snap.activeSession || null;
  const activeOption = snap.activeOption || null;
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

  const computed = computeSensitivitySnapshotCache({
    state,
    lastRenderCtx,
    clamp,
    runMonteCarloSim,
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
  const loadSelfTestsModule = () =>
    import("./selfTest.js")
      .catch(() => import("./core/selfTest.js"));
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
    loadSelfTests: loadSelfTestsModule,
  });
}
function composeSetupStage(){
  composeSetupStageModule();
}
function init(){
  try { normalizeStageLayoutModule(); } catch {}
  try { composeSetupStage(); } catch {}
  installGlobalErrorCapture();
  safeCall(() => { preflightEls(); }, { label: "init.preflightEls" });
  safeCall(() => { wireUsbStorageEvents(); }, { label: "init.wireUsbStorageEvents" });
  safeCall(() => {
    const controller = getUsbStorageController();
    Promise.resolve(controller.init()).then(() => {
      if (controller.isConnected()){
        clearPersistenceFailure("state");
        clearPersistenceFailure("backup");
        if (!bootHadLocalState){
          return controller.loadFromFolder({ suppressMissingStatus: true });
        }
      }
      return null;
    }).catch(() => {});
  });
  safeCall(() => { ensureScenarioRegistry(); }, { label: "init.ensureScenarioRegistry" });
  safeCall(() => { installDataBridge(); }, { label: "init.installDataBridge" });
  safeCall(() => { installScenarioBridge(); }, { label: "init.installScenarioBridge" });
  safeCall(() => { installReachBridge(); }, { label: "init.installReachBridge" });
  safeCall(() => { installTurnoutBridge(); }, { label: "init.installTurnoutBridge" });
  safeCall(() => { installPlanBridge(); }, { label: "init.installPlanBridge" });
  safeCall(() => { ensureDecisionScaffold(); }, { label: "init.ensureDecisionScaffold" });
  safeCall(() => { installDecisionBridge(); }, { label: "init.installDecisionBridge" });
  safeCall(() => {
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
  }, { label: "init.runInitScenarioDecisionWiring" });
  safeCall(() => {
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
  }, { label: "init.runInitPostBoot" });
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
  if (!els.mcBasic || !els.mcAdvanced || !els.mcMode) return;
  const mode = els.mcMode.value || "basic";
  els.mcBasic.classList.toggle("active", mode === "basic");
  els.mcAdvanced.classList.toggle("active", mode === "advanced");
}


function syncGotvModeUI(){
  if (!els.gotvBasic || !els.gotvAdvanced || !els.gotvMode) return;
  const mode = els.gotvMode.value || "basic";
  els.gotvBasic.classList.toggle("active", mode === "basic");
  els.gotvAdvanced.classList.toggle("active", mode === "advanced");
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
