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
} from "./storage.js";
import { APP_VERSION, BUILD_ID } from "./build.js";
import { computeSnapshotHash } from "./hash.js";
import { makeRng, triSample } from "./core/rng.js";
import { renderRiskFramingPanel } from "./app/render/riskFraming.js";
import { renderAssumptionDriftPanel } from "./app/render/assumptionDrift.js";
import { renderBottleneckAttributionPanel, renderConversionPanel, renderSensitivitySnapshotPanel, runSensitivitySnapshotPanel } from "./app/render/executionAnalysis.js";
import { renderWeeklyOpsInsightsPanel, renderWeeklyOpsFreshnessPanel } from "./app/render/weeklyOpsInsights.js";
import { renderDecisionConfidencePanel, renderDecisionIntelligencePanelView } from "./app/render/decisionPanels.js";
import { renderImpactTracePanel } from "./app/render/impactTrace.js";
import { getMcStaleness } from "./app/mcStaleness.js";
import {
  renderMcFreshnessModule,
} from "./app/mcFreshness.js";
import {
  buildAdvancedSpecsModule,
  buildBasicSpecsModule,
  quantileSortedModule,
} from "./app/mcSpecBuilders.js";
import { hashMcInputsModule } from "./app/mcHash.js";
import { runMonteCarloNowModule } from "./app/monteCarloRun.js";
import {
  fmtSignedModule,
  renderMcResultsAdapterModule,
  renderMcVisualsAdapterModule,
} from "./app/mcRenderAdapters.js";
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
import {
  OBJECTIVE_TEMPLATES,
  RISK_POSTURES,
  makeDecisionSessionIdCore,
  makeDecisionOptionIdCore,
  ensureDecisionOptionShapeCore,
  ensureDecisionSessionShapeCore,
} from "./app/decisionScaffold.js";
import {
  ensureDecisionScaffoldCore,
  getActiveDecisionSessionCore,
  listDecisionSessionsCore,
  decisionScenarioLabelCore,
} from "./app/decisionScaffoldState.js";
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
  renderDecisionSessionPanelCore,
  renderDecisionOptionsPanelCore,
} from "./app/decisionSessionRender.js";
import { renderDecisionSummaryPanelCore } from "./app/decisionSummaryRender.js";
import {
  surfaceLeverSpecCore,
  surfaceClampCore,
  surfaceBaselineValueCore,
  applySurfaceDefaultsCore,
  renderSurfaceStubCore,
  renderSurfaceResultCore,
} from "./app/sensitivitySurfaceUi.js";
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
  hashOpsEnvelopeInputsModule,
  computeOpsEnvelopeD2Module,
  renderOpsEnvelopeD2Module,
  hashFinishEnvelopeInputsModule,
  computeFinishEnvelopeD3Module,
  renderFinishEnvelopeD3Module,
  hashMissRiskInputsModule,
  computeMissRiskD4Module,
  renderMissRiskD4Module
} from "./app/mcEnvelopePanels.js";
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
import { wireDecisionSessionBindings } from "./app/decisionSessionBindings.js";
import { createDecisionSessionActions } from "./app/decisionSessionActions.js";
import {
  computeDecisionKeyOutCore,
  decisionOptionDisplayCore,
  buildDecisionSummaryTextCore,
  copyTextToClipboardCore,
  decisionSummaryPlainTextCore,
  decisionSessionExportObjectCore,
  downloadJsonObjectCore,
} from "./app/decisionSessionSummary.js";
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
} from "./app/intelControls.js";
import { renderIntelChecksModule } from "./app/renderIntelChecks.js";
import { applyWeeklyLeverScenarioModule } from "./app/weeklyLeverScenarioAction.js";
import {
  wireSafetyAndDiagnosticsEvents,
  wirePrimaryPlannerEvents,
  wireBudgetTimelineEvents,
  wireIntelChecksEvents,
  wireTabAndExportEvents,
  wireResetImportAndUiToggles
} from "./app/wireEvents.js";
import { wireEventsOrchestratorModule } from "./app/wireEventsOrchestrator.js";
import { createCandidateUiController } from "./app/candidateUi.js";
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

let state = normalizeLoadedScenarioRuntime(loadState() || makeDefaultState());
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

function safeCall(fn){
  safeCallModule(fn);
}

function switchToStage(stageId){
  switchToStageModule(stageId);
}

function persist(){
  const result = persistStateSnapshot(state);
  if (result?.ok){
    clearPersistenceFailure("state");
  } else {
    reportPersistenceFailure("state", result);
  }
  // Phase 11 — auto-backup (fail-soft)
  scheduleBackupWrite();
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

function computeLastNLogSums(n){
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  if (!log || !log.length) return { hasLog:false, n:0, days:null, sumAttempts:0, sumConvos:0, lastDate:null };

  const sorted = [...log].filter(x => x && x.date).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const lastN = sorted.slice(-Math.max(1, n|0));

  let sumAttempts = 0;
  let sumConvos = 0;

  for (const x of lastN){
    const doors = safeNum(x?.doors) || 0;
    const calls = safeNum(x?.calls) || 0;
    const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
    const convos = safeNum(x?.convos) || 0;
    sumAttempts += attempts;
    sumConvos += convos;
  }

  const firstDate = lastN[0]?.date ? new Date(String(lastN[0].date)) : null;
  const lastDate = lastN[lastN.length - 1]?.date ? new Date(String(lastN[lastN.length - 1].date)) : null;
  const days = (firstDate && lastDate && isFinite(firstDate) && isFinite(lastDate))
    ? Math.max(1, Math.round((lastDate - firstDate) / (24*3600*1000)) + 1)
    : lastN.length;

  return {
    hasLog:true,
    n:lastN.length,
    days,
    sumAttempts,
    sumConvos,
    lastDate: lastN[lastN.length - 1]?.date || null
  };
}

function setTag(el, kind, text){
  if (!el) return;
  el.classList.remove("ok","warn","bad");
  if (kind) el.classList.add(kind);
  el.textContent = text;
}

function fmtISODate(d){
  try{
    const dt = (d instanceof Date) ? d : new Date(d);
    if (!isFinite(dt)) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2,"0");
    const da = String(dt.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  } catch {
    return "—";
  }
}

function renderWeeklyExecutionStatus(ctx){
  renderWeeklyExecutionStatusModule({
    els,
    ctx,
    fmtInt,
    computeLastNLogSums,
    setTag,
    fmtISODate,
    clamp,
  });
}

function computeWeeklyOpsContext(res, weeks){
  return computeWeeklyOpsContextFromStateSelector(state, {
    res,
    weeks,
    getEffectiveBaseRatesForState: (s) => getEffectiveBaseRatesFromStateSelector(s, { computeUniverseAdjustedRates }),
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    compileEffectiveInputsForState: (s) => compileEffectiveInputs(s),
    computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic
  });
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

function computeRealityDrift(){
  return computeRealityDriftModule({ state, safeNum, windowN: 7 });
}

function applyRollingRateToAssumption(kind){
  return applyRollingRateToAssumptionModule({
    kind,
    computeRealityDrift,
    state,
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
    state,
    els,
    safeNum,
    clamp,
    setCanonicalDoorsPerHour,
    markMcStale,
    commitUIUpdate,
    setLastAppliedWeeklyAction: (next) => { lastAppliedWeeklyAction = next; },
    syncWeeklyUndoUI,
  });
}


function applyWeeklyLeverScenario(lever, ctx){
  return applyWeeklyLeverScenarioModule({
    lever,
    ctx,
    state,
    clamp,
    setLastAppliedWeeklyAction: (next) => { lastAppliedWeeklyAction = next; },
    replaceState: (nextState) => { state = nextState; },
    applyStateToUI,
    commitUIUpdate,
    syncWeeklyUndoUI,
  });
}



function renderRiskFramingE2(){
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
    state,
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
    state,
    res,
    weeks,
    ctx: weeklyContext,
    executionSnapshot,
    computeWeeklyOpsContext,
    fmtInt,
    clamp,
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    syncWeeklyUndoUI,
    safeCall,
    applyWeeklyLeverScenario,
    computeRealityDrift
  });
}

function renderWeeklyOpsFreshness(res, weeks, { weeklyContext = null, executionSnapshot = null } = {}){
  return renderWeeklyOpsFreshnessPanel({
    els,
    state,
    res,
    weeks,
    ctx: weeklyContext,
    executionSnapshot,
    safeNum,
    computeWeeklyOpsContext
  });
}

function addBullet(listEl, text){
  if (!listEl) return;
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}


function renderConversion(res, weeks){
  return renderConversionPanel({
    els,
    state,
    res,
    weeks,
    deriveNeedVotes,
    safeNum,
    fmtInt,
    getEffectiveBaseRates,
    setText,
    renderPhase3
  });
}


function renderSensitivitySnapshotE4(){
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
    state,
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
    state,
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
  if (!els.diPrimary || !els.diVolTbody || !els.diCostTbody || !els.diProbTbody) return;

  const clearTable = (tbody) => { if (tbody) tbody.innerHTML = ""; };
  const stubRow = (tbody) => {
    if (!tbody) return;
    const tr = document.createElement("tr");
    const td0 = document.createElement("td"); td0.className = "muted"; td0.textContent = "—";
    const td1 = document.createElement("td"); td1.className = "num muted"; td1.textContent = "—";
    tr.appendChild(td0); tr.appendChild(td1);
    tbody.appendChild(tr);
  };

  const setWarn = (msg) => {
    if (!els.diWarn) return;
    if (!msg){
      els.diWarn.hidden = true;
      els.diWarn.textContent = "";
      return;
    }
    els.diWarn.hidden = false;
    els.diWarn.textContent = msg;
  };

  try{
    // Build a stable snapshot for analysis (no mutation)
    const snap = getStateSnapshot();

    const accessors = {
      getStateSnapshot,
      withPatchedState,
      computeAll: (mi, options) => engine.computeAll(mi, options),
      derivedWeeksRemaining,
      deriveNeedVotes,
      runMonteCarloSim,
      computeRoiRows: engine.computeRoiRows,
      buildOptimizationTactics: engine.buildOptimizationTactics,
      computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
    };

    const di = engine.computeDecisionIntelligence({ engine: accessors, snap, baseline: { res, weeks } });

    setWarn(di?.warning || null);

    if (els.diPrimary) els.diPrimary.textContent = di?.bottlenecks?.primary || "—";
    if (els.diSecondary) els.diSecondary.textContent = di?.bottlenecks?.secondary || "—";
    if (els.diNotBinding){
      const nb = Array.isArray(di?.bottlenecks?.notBinding) ? di.bottlenecks.notBinding : [];
      els.diNotBinding.textContent = nb.length ? nb.join(", ") : "—";
    }

    if (els.diRecVol) els.diRecVol.textContent = di?.recs?.volunteers || "—";
    if (els.diRecCost) els.diRecCost.textContent = di?.recs?.cost || "—";
    if (els.diRecProb) els.diRecProb.textContent = di?.recs?.probability || "—";

    const fill = (tbody, rows, fmt) => {
      clearTable(tbody);
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length){ stubRow(tbody); return; }
      for (const r of list){
        const tr = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = r?.lever || "—";
        const td1 = document.createElement("td");
        td1.className = "num";
        td1.textContent = fmt(r?.value);
        tr.appendChild(td0); tr.appendChild(td1);
        tbody.appendChild(tr);
      }
    };

    const fmtSigned = (v, kind) => {
      if (v == null || !Number.isFinite(v)) return "—";
      const sign = (v > 0) ? "+" : "";
      if (kind === "vol"){
        return sign + v.toFixed(2);
      }
      if (kind === "cost"){
        return sign + "$" + fmtInt(Math.round(v));
      }
      if (kind === "prob"){
        return sign + (v*100).toFixed(2) + " pp";
      }
      return sign + String(v);
    };

    fill(els.diVolTbody, di?.rankings?.volunteers, (v)=>fmtSigned(v, "vol"));
    fill(els.diCostTbody, di?.rankings?.cost, (v)=>fmtSigned(v, "cost"));
    fill(els.diProbTbody, di?.rankings?.probability, (v)=>fmtSigned(v, "prob"));

  } catch (e){
    setWarn("Decision Intelligence failed (panel render error).");
    if (els.diPrimary) els.diPrimary.textContent = "—";
    if (els.diSecondary) els.diSecondary.textContent = "—";
    if (els.diNotBinding) els.diNotBinding.textContent = "—";
    if (els.diRecVol) els.diRecVol.textContent = "—";
    if (els.diRecCost) els.diRecCost.textContent = "—";
    if (els.diRecProb) els.diRecProb.textContent = "—";
    clearTable(els.diVolTbody); stubRow(els.diVolTbody);
    clearTable(els.diCostTbody); stubRow(els.diCostTbody);
    clearTable(els.diProbTbody); stubRow(els.diProbTbody);
  }
}




function renderStress(res){
  renderStressModule({
    els,
    res,
  });
}

function renderValidation(res, weeks){
  const benchmarkWarnings = engine?.snapshot?.computeAssumptionBenchmarkWarnings
    ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
    : [];
  const driftSummary = computeRealityDrift();
  const evidenceWarnings = computeEvidenceWarnings(state, { limit: 2, staleDays: 30 });
  renderValidationModule({
    els,
    state,
    res,
    weeks,
    benchmarkWarnings,
    evidenceWarnings,
    driftSummary,
  });
  renderIntelChecksModule({ els, state, benchmarkWarnings, driftSummary });
}

function renderAssumptions(res, weeks){
  renderAssumptionsModule({
    els,
    state,
    res,
    weeks,
    block,
    kv,
    labelTemplate,
    assumptionsProfileLabel,
    labelUndecidedMode,
    getYourName,
    fmtInt,
  });
}

function renderGuardrails(res){
  renderGuardrailsModule({
    els,
    res,
    block,
    kv,
  });
}

function block(title, kvs){
  return blockModule(title, kvs);
}

function kv(k, v){
  return kvModule(k, v);
}

function labelTemplate(v){
  return labelTemplateModule(v);
}

function labelUndecidedMode(v){
  return labelUndecidedModeModule(v);
}

function getYourName(){
  return getYourNameFromStateModule(state);
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

function wireSensitivitySurface(){
  if (!els.surfaceLever || !els.btnComputeSurface) return;
  if (els.btnComputeSurface.dataset.wiredSurface === "1") return;
  els.btnComputeSurface.dataset.wiredSurface = "1";

  // defaults (does not compute)
  applySurfaceDefaults();
  renderSurfaceStub();

  els.surfaceLever.addEventListener("change", () => {
    applySurfaceDefaults();
    renderSurfaceStub();
  });

  els.btnComputeSurface.addEventListener("click", async () => {
    try{
      if (els.btnComputeSurface) els.btnComputeSurface.disabled = true;
      if (els.surfaceStatus) els.surfaceStatus.textContent = "Computing…";

      const leverKey = els.surfaceLever.value;
      const spec = surfaceLeverSpec(leverKey);
      if (!spec){
        if (els.surfaceStatus) els.surfaceStatus.textContent = "Unknown lever.";
        return;
      }

      const minV = surfaceClamp(els.surfaceMin?.value, spec.clampLo, spec.clampHi);
      const maxV = surfaceClamp(els.surfaceMax?.value, spec.clampLo, spec.clampHi);
      const steps = Math.max(5, Math.floor(Number(els.surfaceSteps?.value) || 21));

      const mode = els.surfaceMode?.value || "fast";
      const runs = (mode === "full") ? 10000 : 2000;

      const tPct = Number(els.surfaceTarget?.value);
      const targetWinProb = Number.isFinite(tPct) ? surfaceClamp(tPct, 50, 99) / 100 : 0.70;

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

      // Keep seed behavior aligned with MC: user-provided seed (or empty)
      const seed = state.mcSeed || "";

      const surfaceAccessors = { withPatchedState, runMonteCarloSim };

      const result = engine.computeSensitivitySurface({
        engine: surfaceAccessors,
        baseline: { res, weeks, needVotes, scenario: snap },
        sweep: { leverKey, minValue: minV, maxValue: maxV, steps },
        options: { runs, seed, targetWinProb }
      });

      renderSurfaceResult({ spec, result });

      if (els.surfaceStatus){
        els.surfaceStatus.textContent = `Done (${runs.toLocaleString()} runs × ${steps} points)`;
      }
    } catch (err){
      renderSurfaceStub();
      if (els.surfaceStatus) els.surfaceStatus.textContent = err?.message ? err.message : String(err || "Error");
    } finally {
      if (els.btnComputeSurface) els.btnComputeSurface.disabled = false;
    }
  });
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
    loadSelfTests: () => import("./selfTest.js"),
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
  // Dev-only helper used by selfTest harness.
  const prev = getStateSnapshot();
  const patchHasFeatures = !!(patch && typeof patch === "object" && patch.features && typeof patch.features === "object" && !Array.isArray(patch.features));
  const merge = (target, src) => {
    if (!src || typeof src !== "object") return;
    for (const k of Object.keys(src)){
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v)){
        if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
        merge(target[k], v);
      } else {
        target[k] = v;
      }
    }
  };
  try{
    merge(state, patch || {});
    syncFeatureFlagsFromState(state, { preferFeatures: patchHasFeatures });
    return fn();
  } finally {
    // Restore
    state = prev;
  }
}


function clearMcStale(){
  return getMcStateController().clearMcStale();
}

function computeDailyLogHash(){
  return getMcStateController().computeDailyLogHash();
}

function renderMcFreshness(res, weeks, opts = {}){
  const renderOpsEnvelopeWithCtx = (nextRes, nextWeeks) => renderOpsEnvelopeD2(nextRes, nextWeeks, opts);
  const renderFinishEnvelopeWithCtx = (nextRes, nextWeeks) => renderFinishEnvelopeD3(nextRes, nextWeeks, opts);
  const renderMissRiskWithCtx = (nextRes, nextWeeks) => renderMissRiskD4(nextRes, nextWeeks, opts);
  return renderMcFreshnessModule({
    els,
    state,
    res,
    weeks,
    setTextPair,
    setHidden,
    hashMcInputs,
    getMcStaleness,
    computeDailyLogHash,
    renderOpsEnvelopeD2: renderOpsEnvelopeWithCtx,
    renderFinishEnvelopeD3: renderFinishEnvelopeWithCtx,
    renderMissRiskD4: renderMissRiskWithCtx,
  });
}


function hashOpsEnvelopeInputs(res, weeks){
  return hashOpsEnvelopeInputsModule({
    state,
    res,
    weeks,
    getEffectiveBaseRates,
    computeSnapshotHash,
    hashMcInputs,
    safeNum,
  });
}

function resolveMcEnvelopeContext(res, weeks, opts = {}){
  const fromOpts = {
    weeklyContext: opts.weeklyContext || null,
    executionSnapshot: opts.executionSnapshot || null,
  };
  if (fromOpts.weeklyContext || fromOpts.executionSnapshot) return fromOpts;
  if (lastRenderCtx && lastRenderCtx.res === res && lastRenderCtx.weeks === weeks){
    return {
      weeklyContext: lastRenderCtx.weeklyContext || null,
      executionSnapshot: lastRenderCtx.executionSnapshot || null,
    };
  }
  return { weeklyContext: null, executionSnapshot: null };
}

function computeOpsEnvelopeD2(res, weeks, opts = {}){
  const { weeklyContext, executionSnapshot } = resolveMcEnvelopeContext(res, weeks, opts);
  return computeOpsEnvelopeD2Module({
    state,
    res,
    weeks,
    weeklyContext,
    executionSnapshot,
    computeWeeklyOpsContext,
    getEffectiveBaseRates,
    safeNum,
    buildAdvancedSpecs: (params) => buildAdvancedSpecsModule({ state, safeNum, clamp, ...params }),
    buildBasicSpecs: (params) => buildBasicSpecsModule({ state, clamp, ...params }),
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
    quantileSorted: quantileSortedModule,
  });
}

function renderOpsEnvelopeD2(res, weeks, opts = {}){
  const computeWithCtx = (nextRes, nextWeeks) => computeOpsEnvelopeD2(nextRes, nextWeeks, opts);
  renderOpsEnvelopeD2Module({
    els,
    state,
    res,
    weeks,
    hashOpsEnvelopeInputs,
    computeOpsEnvelopeD2: computeWithCtx,
    persist,
    fmtInt,
  });
}

function hashFinishEnvelopeInputs(res, weeks){
  return hashFinishEnvelopeInputsModule({
    res,
    weeks,
    hashOpsEnvelopeInputs,
    computeSnapshotHash,
    computeDailyLogHash,
    fmtISODate,
  });
}

function computeFinishEnvelopeD3(res, weeks, opts = {}){
  const { weeklyContext, executionSnapshot } = resolveMcEnvelopeContext(res, weeks, opts);
  return computeFinishEnvelopeD3Module({
    state,
    res,
    weeks,
    weeklyContext,
    executionSnapshot,
    computeWeeklyOpsContext,
    computeLastNLogSums,
    getEffectiveBaseRates,
    safeNum,
    buildAdvancedSpecs: (params) => buildAdvancedSpecsModule({ state, safeNum, clamp, ...params }),
    buildBasicSpecs: (params) => buildBasicSpecsModule({ state, clamp, ...params }),
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
    quantileSorted: quantileSortedModule,
  });
}

function renderFinishEnvelopeD3(res, weeks, opts = {}){
  const computeWithCtx = (nextRes, nextWeeks) => computeFinishEnvelopeD3(nextRes, nextWeeks, opts);
  renderFinishEnvelopeD3Module({
    els,
    state,
    res,
    weeks,
    hashFinishEnvelopeInputs,
    computeFinishEnvelopeD3: computeWithCtx,
    persist,
    fmtISODate,
  });
}

function hashMissRiskInputs(res, weeks){
  return hashMissRiskInputsModule({
    res,
    weeks,
    hashOpsEnvelopeInputs,
    computeSnapshotHash,
    computeDailyLogHash,
  });
}

function computeMissRiskD4(res, weeks, opts = {}){
  const { weeklyContext, executionSnapshot } = resolveMcEnvelopeContext(res, weeks, opts);
  return computeMissRiskD4Module({
    state,
    res,
    weeks,
    weeklyContext,
    executionSnapshot,
    computeWeeklyOpsContext,
    computeLastNLogSums,
    getEffectiveBaseRates,
    safeNum,
    buildAdvancedSpecs: (params) => buildAdvancedSpecsModule({ state, safeNum, clamp, ...params }),
    buildBasicSpecs: (params) => buildBasicSpecsModule({ state, clamp, ...params }),
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
  });
}

function renderMissRiskD4(res, weeks, opts = {}){
  const computeWithCtx = (nextRes, nextWeeks) => computeMissRiskD4(nextRes, nextWeeks, opts);
  return renderMissRiskD4Module({
    els,
    state,
    res,
    weeks,
    hashMissRiskInputs,
    computeMissRiskD4: computeWithCtx,
    persist,
  });
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

function deriveNeedVotes(res, goalSupportIdsOverride = state.goalSupportIds){
  return coreDeriveNeedVotesOrZero(res, goalSupportIdsOverride);
}


function renderRoi(res, weeks){
  renderRoiModule({
    els,
    state,
    res,
    weeks,
    deriveNeedVotes,
    getEffectiveBaseRates,
    computeCapacityBreakdown,
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap,
    engine,
    computeAvgLiftPP,
    fmtInt,
  });
}



function renderOptimization(res, weeks){
  renderOptimizationModule({
    els,
    state,
    res,
    weeks,
    deriveNeedVotes,
    fmtInt,
    compileEffectiveInputs,
    computeCapacityBreakdown,
    safeNum,
    engine,
  });
}

function renderTimeline(res, weeks){
  renderTimelineModule({
    els,
    state,
    weeks,
    safeNum,
    fmtInt,
    engine,
  });
}

function renderPhase3(res, weeks){
  renderPhase3Module({
    els,
    state,
    res,
    weeks,
    fmtInt,
    compileEffectiveInputs,
    computeCapacityContacts,
    deriveNeedVotes,
    renderMcFreshness,
    renderMcResults,
  });
}


function computeCapacityBreakdown(args){
  const next = (args && typeof args === "object") ? { ...args } : {};
  if (!next.capacityDecay){
    next.capacityDecay = getCapacityDecayConfigFromState(state);
  }
  return coreComputeCapacityBreakdown(next);
}

function computeCapacityContacts(args){
  const next = (args && typeof args === "object") ? { ...args } : {};
  if (!next.capacityDecay){
    next.capacityDecay = getCapacityDecayConfigFromState(state);
  }
  return coreComputeCapacityContacts(next);
}

/* ---- Monte Carlo ---- */

function runMonteCarloNow(){
  return runMonteCarloNowModule({
    state,
    computeElectionSnapshot,
    computeExecutionSnapshot,
    computeWeeklyOpsContext,
    derivedWeeksRemaining,
    buildModelInputFromState,
    safeNum,
    engine,
    deriveNeedVotes,
    setLastRenderCtx: (next) => { lastRenderCtx = next; },
    hashMcInputs,
    runMonteCarloSim,
    computeDailyLogHash,
    persist,
    clearMcStale,
    renderMcResults,
    renderMcFreshness,
    renderRiskFramingE2,
    renderSensitivitySnapshotE4,
  });
}

function runMonteCarloSim(argsOrScenario, legacyRes, legacyWeeks, legacyNeedVotes, legacyRuns, legacySeed, legacyIncludeMargins){
  const looksObject = !!argsOrScenario && typeof argsOrScenario === "object" && !Array.isArray(argsOrScenario);
  const hasNamedShape = looksObject && (
    Object.prototype.hasOwnProperty.call(argsOrScenario, "scenario") ||
    Object.prototype.hasOwnProperty.call(argsOrScenario, "scenarioState") ||
    Object.prototype.hasOwnProperty.call(argsOrScenario, "res") ||
    Object.prototype.hasOwnProperty.call(argsOrScenario, "weeks") ||
    Object.prototype.hasOwnProperty.call(argsOrScenario, "needVotes") ||
    Object.prototype.hasOwnProperty.call(argsOrScenario, "seed") ||
    Object.prototype.hasOwnProperty.call(argsOrScenario, "includeMargins")
  );

  const payload = hasNamedShape
    ? {
      scenario: argsOrScenario.scenario || argsOrScenario.scenarioState || state,
      res: argsOrScenario.res,
      weeks: argsOrScenario.weeks,
      needVotes: argsOrScenario.needVotes,
      runs: argsOrScenario.runs,
      seed: argsOrScenario.seed,
      includeMargins: argsOrScenario.includeMargins,
    }
    : {
      scenario: looksObject ? argsOrScenario : state,
      res: legacyRes,
      weeks: legacyWeeks,
      needVotes: legacyNeedVotes,
      runs: legacyRuns,
      seed: legacySeed,
      includeMargins: legacyIncludeMargins,
    };

  // Delegated to core Monte Carlo via facade (no loops in UI).
  return engine.runMonteCarlo(payload);
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
