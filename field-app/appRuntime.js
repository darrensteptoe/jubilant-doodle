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
import { renderBottleneckAttributionPanel, renderConversionPanel, renderSensitivitySnapshotPanel, runSensitivitySnapshotPanel } from "./app/render/executionAnalysis.js";
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
import { copyDebugBundleModule } from "./app/debugBundle.js";
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
import { getOperationsMetricsSnapshot } from "./features/operations/metricsCache.js";
import { PIPELINE_STAGES, DEFAULT_FORECAST_CONFIG } from "./features/operations/schema.js";
import { els } from "./ui/els.js";

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
  preflightEls();
  wireUsbStorageEvents();
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
  ensureScenarioRegistry();
  ensureDecisionScaffold();
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
}


init();


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
