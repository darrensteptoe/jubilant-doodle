import { engine } from "./engine.js";
import {
  computeCapacityContacts as coreComputeCapacityContacts,
  computeCapacityBreakdown as coreComputeCapacityBreakdown,
  deriveNeedVotesOrZero as coreDeriveNeedVotesOrZero,
  deriveWeeksRemainingCeil as coreDeriveWeeksRemainingCeil
} from "./core/model.js";
import { UNIVERSE_DEFAULTS, computeUniverseAdjustedRates } from "./core/universeLayer.js";
import { computeAvgLiftPP } from "./core/turnout.js";
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
  computeDailyLogHashModule,
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
import {
  appendOperationsDiagnosticsCore,
  appendModelDiagnosticsCore,
} from "./app/diagnosticsBuilders.js";
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
} from "./app/twCapHelpers.js";
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
  wireSafetyAndDiagnosticsEvents,
  wirePrimaryPlannerEvents,
  wireBudgetTimelineEvents,
  wireTabAndExportEvents,
  wireResetImportAndUiToggles
} from "./app/wireEvents.js";
import { wireEventsOrchestratorModule } from "./app/wireEventsOrchestrator.js";
import {
  getUniverseLayerConfig as getUniverseLayerConfigFromStateSelector,
  getEffectiveBaseRates as getEffectiveBaseRatesFromStateSelector,
  computeWeeklyOpsContextFromState as computeWeeklyOpsContextFromStateSelector
} from "./app/selectors.js";
import { getOperationsMetricsSnapshot } from "./features/operations/metricsCache.js";
import { PIPELINE_STAGES, DEFAULT_FORECAST_CONFIG } from "./features/operations/schema.js";

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

// Phase 11 — error capture (fail-soft)
function recordError(kind, message, extra){
  try{
    const item = {
      t: new Date().toISOString(),
      kind: String(kind || "error"),
      msg: String(message || ""),
      extra: extra && typeof extra === "object" ? extra : undefined
    };
    recentErrors.unshift(item);
    if (recentErrors.length > MAX_ERRORS) recentErrors.length = MAX_ERRORS;
    updateDiagnosticsUI();
  } catch { /* ignore */ }
}

function installGlobalErrorCapture(){
  try{
    window.addEventListener("error", (e) => {
      recordError("error", e?.message || "Unhandled error", { filename: e?.filename, lineno: e?.lineno, colno: e?.colno });
    });
    window.addEventListener("unhandledrejection", (e) => {
      const r = e?.reason;
      recordError("unhandledrejection", r?.message || String(r || "Unhandled rejection"));
    });
  } catch { /* ignore */ }
}

function updateBuildStamp(){
  try{
    if (els.buildStamp) els.buildStamp.textContent = `build ${BUILD_ID}`;
  } catch { /* ignore */ }
}

function updateSelfTestGateBadge(){
  try{
    if (!els.selfTestGate) return;
    els.selfTestGate.textContent = selfTestGateStatus;
    els.selfTestGate.classList.remove("badge-unverified","badge-verified","badge-failed");
    if (selfTestGateStatus === engine.selfTest.SELFTEST_GATE.VERIFIED) els.selfTestGate.classList.add("badge-verified");
    else if (selfTestGateStatus === engine.selfTest.SELFTEST_GATE.FAILED) els.selfTestGate.classList.add("badge-failed");
    else els.selfTestGate.classList.add("badge-unverified");
  } catch { /* ignore */ }
}

function openDiagnostics(){
  try{
    if (!els.diagModal) return;
    els.diagModal.hidden = false;
    updateDiagnosticsUI();
  } catch { /* ignore */ }
}
function closeDiagnostics(){
  try{ if (els.diagModal) els.diagModal.hidden = true; } catch { /* ignore */ }
}

let diagRenderSeq = 0;

async function getOperationsDiagnosticsSnapshot(){
  try{
    const snapshot = await getOperationsMetricsSnapshot();
    const counts = snapshot?.counts || {};
    const rollups = snapshot?.rollups || {};

    return {
      available: true,
      counts,
      rollups: {
        production: {
          source: rollups?.production?.source || "—",
          attempts: Number(rollups?.production?.attempts || 0),
          convos: Number(rollups?.production?.convos || 0),
          supportIds: Number(rollups?.production?.supportIds || 0),
          hours: Number(rollups?.production?.hours || 0),
        },
        dedupe: {
          rule: rollups?.dedupe?.rule || "—",
          excludedTurfAttemptRecords: Number(rollups?.dedupe?.excludedTurfAttemptRecords || 0),
          excludedTurfAttempts: Number(rollups?.dedupe?.excludedTurfAttempts || 0),
          includedFallbackAttempts: Number(rollups?.dedupe?.includedFallbackAttempts || 0),
        }
      }
    };
  } catch (e){
    return { available: false, error: e?.message ? String(e.message) : String(e || "unknown") };
  }
}

function appendOperationsDiagnostics(lines, tw){
  return appendOperationsDiagnosticsCore(lines, tw);
}

function appendModelDiagnostics(lines){
  return appendModelDiagnosticsCore(lines, {
    engine,
    state,
    computeRealityDrift,
  });
}

let twCapOutlookTimer = null;
let twCapOutlookSeq = 0;
let twCapOutlookLastRunMs = 0;
let twCapOverrideSig = "";
let twCapOverrideCache = {
  ready: false,
  week0: { baseline: null, ramp: null, scheduled: null, max: null },
  horizonWeeks: 0,
  updatedAt: null,
};
const TW_CAP_DAY_MS = 86400000;
const TW_CAP_WEEK_MS = 7 * TW_CAP_DAY_MS;

function twCapText(el, text){
  return twCapTextModule(el, text);
}

function twCapNum(v, fallback = 0){
  return twCapNumModule(v, fallback);
}

function twCapFmtInt(v){
  return twCapFmtIntModule(v, { fmtInt });
}

function twCapFmt1(v){
  return twCapFmt1Module(v);
}

function twCapFmtSigned(v){
  return twCapFmtSignedModule(v, { fmtInt });
}

function twCapRatioText(numerator, denominator){
  return twCapRatioTextModule(numerator, denominator);
}

function twCapFmtPct01(v){
  return twCapFmtPct01Module(v);
}

function twCapMedian(values){
  return twCapMedianModule(values);
}

function twCapClean(v){
  return twCapCleanModule(v);
}

function twCapOverrideModeFromState(srcState = state){
  const raw = twCapClean(srcState?.twCapOverrideMode || "baseline");
  return ["baseline", "ramp", "scheduled", "max"].includes(raw) ? raw : "baseline";
}

function twCapResolveOverrideAttempts(srcState = state){
  if (!srcState?.twCapOverrideEnabled) return null;
  const mode = twCapOverrideModeFromState(srcState);
  if (mode === "baseline"){
    return twCapNum(twCapOverrideCache?.week0?.baseline, null);
  }
  if (!twCapOverrideCache?.ready) return null;
  const target = twCapNum(twCapOverrideCache.week0?.[mode], null);
  return (target == null || !Number.isFinite(target)) ? null : Math.max(0, target);
}

function twCapTransitionKey(from, to){
  return twCapTransitionKeyModule(from, to);
}

function twCapParseDate(value){
  return twCapParseDateModule(value);
}

function twCapWeekStart(dt){
  return twCapWeekStartModule(dt);
}

function twCapIsoUTC(dt){
  return twCapIsoUTCModule(dt);
}

function twCapLatestRecordByPerson(rows){
  const out = new Map();
  for (const rec of (Array.isArray(rows) ? rows : [])){
    const personId = twCapClean(rec?.personId);
    if (!personId) continue;
    const ts = twCapParseDate(rec?.updatedAt)?.getTime() || twCapParseDate(rec?.createdAt)?.getTime() || 0;
    const prev = out.get(personId);
    const prevTs = prev ? (twCapParseDate(prev?.updatedAt)?.getTime() || twCapParseDate(prev?.createdAt)?.getTime() || 0) : -1;
    if (!prev || ts >= prevTs) out.set(personId, rec);
  }
  return out;
}

function twCapBuildReadinessStats(onboardingRecords, trainingRecords){
  const onbByPerson = twCapLatestRecordByPerson(onboardingRecords);
  const trnByPerson = twCapLatestRecordByPerson(trainingRecords);
  const personIds = new Set([...onbByPerson.keys(), ...trnByPerson.keys()]);

  const nowMs = Date.now();
  const twoWeeksMs = 14 * TW_CAP_DAY_MS;
  let readyNow = 0;
  let recentReadyCount = 0;
  const cycleDays = [];

  for (const personId of personIds){
    const onb = onbByPerson.get(personId);
    const trn = trnByPerson.get(personId);
    const onbDone = twCapClean(onb?.onboardingStatus) === "completed";
    const trnDone = twCapClean(trn?.completionStatus) === "completed";
    if (!(onbDone && trnDone)) continue;

    readyNow += 1;

    const readyCandidates = [
      twCapParseDate(onb?.completedAt)?.getTime(),
      twCapParseDate(trn?.completedAt)?.getTime(),
    ].filter((v) => Number.isFinite(v));
    const readyMs = readyCandidates.length ? Math.max(...readyCandidates) : NaN;

    if (Number.isFinite(readyMs) && readyMs >= (nowMs - twoWeeksMs)){
      recentReadyCount += 1;
    }

    const docsMs = twCapParseDate(onb?.docsSubmittedAt)?.getTime();
    if (Number.isFinite(docsMs) && Number.isFinite(readyMs) && readyMs >= docsMs){
      cycleDays.push((readyMs - docsMs) / TW_CAP_DAY_MS);
    }
  }

  const recentReadyPerWeek = recentReadyCount / 2;
  const projectedReady14d = readyNow + (recentReadyPerWeek * 2);
  return {
    readyNow,
    recentReadyPerWeek,
    projectedReady14d,
    medianReadyDays: twCapMedian(cycleDays),
  };
}

function twCapNormalizeForecastConfig(raw){
  const src = (raw && typeof raw === "object") ? raw : {};
  const conv = { ...(DEFAULT_FORECAST_CONFIG.stageConversionDefaults || {}), ...(src.stageConversionDefaults || {}) };
  const dur = { ...(DEFAULT_FORECAST_CONFIG.stageDurationDefaultsDays || {}), ...(src.stageDurationDefaultsDays || {}) };
  for (let i = 0; i < PIPELINE_STAGES.length - 1; i++){
    const key = twCapTransitionKey(PIPELINE_STAGES[i], PIPELINE_STAGES[i + 1]);
    conv[key] = clamp(twCapNum(conv[key], 1), 0, 1);
    dur[key] = Math.max(0, twCapNum(dur[key], 0));
  }
  return { stageConversionDefaults: conv, stageDurationDefaultsDays: dur };
}

function twCapPerOrganizerAttemptsPerWeek(effective){
  const c = effective?.capacity || {};
  const one = coreComputeCapacityBreakdown({
    weeks: 1,
    orgCount: 1,
    orgHoursPerWeek: twCapNum(c.orgHoursPerWeek, 0),
    volunteerMult: twCapNum(c.volunteerMult, 0),
    doorShare: (c.doorShare == null) ? null : clamp(twCapNum(c.doorShare, 0), 0, 1),
    doorsPerHour: twCapNum(c.doorsPerHour, 0),
    callsPerHour: twCapNum(c.callsPerHour, 0),
  });
  return Math.max(0, twCapNum(one?.total, 0));
}

function twCapBaselineAttemptsPerWeek(effective){
  const c = effective?.capacity || {};
  const baseline = coreComputeCapacityBreakdown({
    weeks: 1,
    orgCount: twCapNum(c.orgCount, 0),
    orgHoursPerWeek: twCapNum(c.orgHoursPerWeek, 0),
    volunteerMult: twCapNum(c.volunteerMult, 0),
    doorShare: (c.doorShare == null) ? null : clamp(twCapNum(c.doorShare, 0), 0, 1),
    doorsPerHour: twCapNum(c.doorsPerHour, 0),
    callsPerHour: twCapNum(c.callsPerHour, 0),
  });
  return Math.max(0, twCapNum(baseline?.total, 0));
}

function twCapEmptyOutlook(message){
  twCapOverrideSig = "";
  twCapOverrideCache = {
    ready: false,
    week0: { baseline: null, ramp: null, scheduled: null, max: null },
    horizonWeeks: 0,
    updatedAt: new Date().toISOString(),
  };
  twCapText(els.twCapOutlookStatus, message || "No Operations data.");
  twCapText(els.twCapOutlookActiveSource, state?.twCapOverrideEnabled ? "Override ON (data unavailable; fallback baseline)" : "Override OFF");
  twCapText(els.twCapOutlookBaseline, "—");
  twCapText(els.twCapOutlookRampTotal, "—");
  twCapText(els.twCapOutlookScheduledTotal, "—");
  twCapText(els.twCapOutlookHorizon, "—");
  twCapText(els.twDiagInterviewPass, "—");
  twCapText(els.twDiagOfferAccept, "—");
  twCapText(els.twDiagOnboardingCompletion, "—");
  twCapText(els.twDiagTrainingCompletion, "—");
  twCapText(els.twDiagCompositeSignal, "—");
  twCapText(els.twDiagReadyNow, "—");
  twCapText(els.twDiagReadyPerWeek, "—");
  twCapText(els.twDiagReadyIn14d, "—");
  twCapText(els.twDiagMedianReadyDays, "—");
  twCapText(els.twDiagHintNote, "Display-only diagnostics. Add interview/onboarding/training records to unlock hints.");
  if (els.twCapOutlookTbody){
    els.twCapOutlookTbody.innerHTML = '<tr><td class="muted" colspan="5">No outlook data.</td></tr>';
  }
}

function scheduleOperationsCapacityOutlookRender(weeks){
  if (!els.twCapOutlookTbody) return;
  const seq = ++twCapOutlookSeq;
  if (twCapOutlookTimer) clearTimeout(twCapOutlookTimer);

  const w = (weeks != null && Number.isFinite(Number(weeks))) ? Number(weeks) : 12;
  const explicitHorizon = safeNum(state?.twCapOverrideHorizonWeeks);
  const rawHorizon = (explicitHorizon != null && isFinite(explicitHorizon)) ? explicitHorizon : (w || 12);
  const horizonWeeks = Math.max(4, Math.min(52, Math.floor(rawHorizon)));
  const nowMs = Date.now();
  const throttleMs = Math.max(0, 700 - (nowMs - twCapOutlookLastRunMs));
  const delayMs = Math.max(180, throttleMs);

  twCapOutlookTimer = setTimeout(() => {
    renderOperationsCapacityOutlook(seq, horizonWeeks).catch((e) => {
      if (seq !== twCapOutlookSeq) return;
      twCapEmptyOutlook(e?.message ? String(e.message) : "Could not compute Operations outlook.");
    });
  }, delayMs);
}

async function renderOperationsCapacityOutlook(seq, horizonWeeks){
  if (seq !== twCapOutlookSeq) return;
  if (!els.twCapOutlookTbody) return;
  twCapOutlookLastRunMs = Date.now();

  twCapText(els.twCapOutlookStatus, "Updating Operations outlook…");

  const opsSnapshot = await getOperationsMetricsSnapshot();
  const stores = opsSnapshot?.stores || {};
  const pipelineRecords = Array.isArray(stores.pipelineRecords) ? stores.pipelineRecords : [];
  const shiftRecords = Array.isArray(stores.shiftRecords) ? stores.shiftRecords : [];
  const forecastConfigs = Array.isArray(stores.forecastConfigs) ? stores.forecastConfigs : [];
  const interviews = Array.isArray(stores.interviews) ? stores.interviews : [];
  const onboardingRecords = Array.isArray(stores.onboardingRecords) ? stores.onboardingRecords : [];
  const trainingRecords = Array.isArray(stores.trainingRecords) ? stores.trainingRecords : [];
  if (seq !== twCapOutlookSeq) return;

  const effective = compileEffectiveInputs(state);
  const baselineAttempts = twCapBaselineAttemptsPerWeek(effective);
  const perOrganizerAttempts = twCapPerOrganizerAttemptsPerWeek(effective);
  const cfgRaw = (Array.isArray(forecastConfigs) ? forecastConfigs : []).find((x) => String(x?.id) === "default")
    || (Array.isArray(forecastConfigs) ? forecastConfigs[0] : null);
  const cfg = twCapNormalizeForecastConfig(cfgRaw);

  const week0 = twCapWeekStart(new Date());
  const rows = Array.from({ length: horizonWeeks }, (_, i) => ({
    weekStarting: twCapIsoUTC(new Date(week0.getTime() + (i * TW_CAP_WEEK_MS))),
    rampAdds: 0,
    scheduled: 0,
  }));

  let beyondHorizonAdds = 0;
  let openPipeline = 0;
  for (const rec of (Array.isArray(pipelineRecords) ? pipelineRecords : [])){
    const stage = twCapClean(rec?.stage);
    const stageIdx = PIPELINE_STAGES.indexOf(stage);
    if (stageIdx < 0) continue;
    if (stage === "Active") continue;
    if (twCapClean(rec?.dropoffReason)) continue;
    openPipeline += 1;

    let p = 1;
    let daysToActive = 0;
    for (let i = stageIdx; i < PIPELINE_STAGES.length - 1; i++){
      const key = twCapTransitionKey(PIPELINE_STAGES[i], PIPELINE_STAGES[i + 1]);
      p *= clamp(twCapNum(cfg.stageConversionDefaults[key], 1), 0, 1);
      daysToActive += Math.max(0, twCapNum(cfg.stageDurationDefaultsDays[key], 0));
    }

    const baseDate = twCapParseDate(rec?.stageDates?.[stage]) || twCapParseDate(rec?.updatedAt) || twCapParseDate(rec?.createdAt) || new Date();
    const projected = new Date(baseDate.getTime() + (daysToActive * TW_CAP_DAY_MS));
    const weekStart = twCapWeekStart(projected);
    let idx = Math.floor((weekStart.getTime() - week0.getTime()) / TW_CAP_WEEK_MS);
    if (!Number.isFinite(idx)) continue;
    if (idx < 0) idx = 0;

    if (idx >= rows.length){
      beyondHorizonAdds += p;
      continue;
    }
    rows[idx].rampAdds += p;
  }

  for (const rec of (Array.isArray(shiftRecords) ? shiftRecords : [])){
    const dt = twCapParseDate(rec?.date) || twCapParseDate(rec?.checkInAt) || twCapParseDate(rec?.startAt);
    if (!dt) continue;
    const weekStart = twCapWeekStart(dt);
    const idx = Math.floor((weekStart.getTime() - week0.getTime()) / TW_CAP_WEEK_MS);
    if (!Number.isFinite(idx) || idx < 0 || idx >= rows.length) continue;
    rows[idx].scheduled += Math.max(0, twCapNum(rec?.attempts, 0));
  }

  let cumulativeAdds = 0;
  let scheduledTotal = 0;
  for (const row of rows){
    cumulativeAdds += row.rampAdds;
    row.baseline = baselineAttempts;
    row.ramp = baselineAttempts + (cumulativeAdds * perOrganizerAttempts);
    row.delta = row.scheduled - row.ramp;
    scheduledTotal += row.scheduled;
  }

  const expectedByEnd = rows.length ? rows[rows.length - 1].ramp : baselineAttempts;
  const expectedAddedFte = rows.reduce((acc, r) => acc + (r.rampAdds || 0), 0);
  const pipelineCount = Array.isArray(pipelineRecords) ? pipelineRecords.length : 0;
  const shiftCount = Array.isArray(shiftRecords) ? shiftRecords.length : 0;
  const week0Row = rows[0] || { baseline: baselineAttempts, ramp: baselineAttempts, scheduled: 0 };

  const stageCounts = new Map(PIPELINE_STAGES.map((s) => [s, 0]));
  for (const rec of (Array.isArray(pipelineRecords) ? pipelineRecords : [])){
    const stage = twCapClean(rec?.stage);
    if (!stageCounts.has(stage)) continue;
    stageCounts.set(stage, Number(stageCounts.get(stage) || 0) + 1);
  }
  const offerExtendedCount = Number(stageCounts.get("Offer Extended") || 0);
  const offerAcceptedCount = Number(stageCounts.get("Offer Accepted") || 0);

  const interviewPassCount = (Array.isArray(interviews) ? interviews : []).filter((r) => twCapClean(r?.outcome) === "pass").length;
  const interviewCompleteCount = (Array.isArray(interviews) ? interviews : []).filter((r) => {
    const outcome = twCapClean(r?.outcome);
    return outcome && outcome !== "pending";
  }).length;

  const onboardingRows = Array.isArray(onboardingRecords) ? onboardingRecords : [];
  const trainingRows = Array.isArray(trainingRecords) ? trainingRecords : [];
  const onboardingCompleted = onboardingRows.filter((r) => twCapClean(r?.onboardingStatus) === "completed").length;
  const trainingCompleted = trainingRows.filter((r) => twCapClean(r?.completionStatus) === "completed").length;

  const interviewPassRate = interviewCompleteCount > 0 ? (interviewPassCount / interviewCompleteCount) : null;
  const offerAcceptRate = offerExtendedCount > 0 ? (offerAcceptedCount / offerExtendedCount) : null;
  const onboardingCompletionRate = onboardingRows.length > 0 ? (onboardingCompleted / onboardingRows.length) : null;
  const trainingCompletionRate = trainingRows.length > 0 ? (trainingCompleted / trainingRows.length) : null;
  const compositeSignals = [interviewPassRate, offerAcceptRate, onboardingCompletionRate, trainingCompletionRate].filter((v) => Number.isFinite(v));
  const compositeRampSignal = compositeSignals.length ? (compositeSignals.reduce((a, b) => a + b, 0) / compositeSignals.length) : null;
  const readiness = twCapBuildReadinessStats(onboardingRows, trainingRows);

  twCapOverrideCache = {
    ready: true,
    week0: {
      baseline: twCapNum(week0Row.baseline, baselineAttempts),
      ramp: twCapNum(week0Row.ramp, baselineAttempts),
      scheduled: twCapNum(week0Row.scheduled, 0),
      max: Math.max(twCapNum(week0Row.ramp, baselineAttempts), twCapNum(week0Row.scheduled, 0)),
    },
    horizonWeeks: rows.length,
    updatedAt: new Date().toISOString(),
  };

  const activeMode = twCapOverrideModeFromState(state);
  const activeSourceLabel = state?.twCapOverrideEnabled
    ? `Override ON · source: ${activeMode}`
    : "Override OFF";

  twCapText(els.twCapOutlookActiveSource, activeSourceLabel);
  twCapText(els.twCapOutlookBaseline, twCapFmtInt(baselineAttempts));
  twCapText(els.twCapOutlookRampTotal, twCapFmtInt(expectedByEnd));
  twCapText(els.twCapOutlookScheduledTotal, twCapFmtInt(scheduledTotal));
  twCapText(els.twCapOutlookHorizon, `${rows.length} weeks · +${expectedAddedFte.toFixed(2)} expected active`);
  twCapText(els.twDiagInterviewPass, twCapRatioText(interviewPassCount, interviewCompleteCount));
  twCapText(els.twDiagOfferAccept, twCapRatioText(offerAcceptedCount, offerExtendedCount));
  twCapText(els.twDiagOnboardingCompletion, twCapRatioText(onboardingCompleted, onboardingRows.length));
  twCapText(els.twDiagTrainingCompletion, twCapRatioText(trainingCompleted, trainingRows.length));
  twCapText(els.twDiagCompositeSignal, twCapFmtPct01(compositeRampSignal));
  twCapText(els.twDiagReadyNow, twCapFmtInt(readiness.readyNow));
  twCapText(els.twDiagReadyPerWeek, twCapFmt1(readiness.recentReadyPerWeek));
  twCapText(els.twDiagReadyIn14d, twCapFmt1(readiness.projectedReady14d));
  twCapText(els.twDiagMedianReadyDays, Number.isFinite(readiness.medianReadyDays) ? twCapFmt1(readiness.medianReadyDays) : "—");
  twCapText(
    els.twDiagHintNote,
    Number.isFinite(compositeRampSignal)
      ? `Display-only diagnostics. Composite ramp signal ${(100 * compositeRampSignal).toFixed(1)}% (no engine mutation).`
      : "Display-only diagnostics. Add interview/onboarding/training records to unlock hints."
  );
  twCapText(
    els.twCapOutlookStatus,
    `Source: baseline + pipeline + shifts · pipeline open ${openPipeline}/${pipelineCount} · shifts ${shiftCount} · beyond horizon +${beyondHorizonAdds.toFixed(2)} expected active`
  );
  twCapText(
    els.twCapOutlookBasis,
    "Override is OFF by default. When enabled, FPE capacity uses selected Operations source with automatic fallback to baseline if data is unavailable."
  );

  // If override is active, re-render once when cache materially changes so effective inputs pick up new values.
  if (state?.twCapOverrideEnabled && activeMode !== "baseline"){
    const sig = JSON.stringify({
      mode: activeMode,
      h: twCapOverrideCache.horizonWeeks,
      b: twCapOverrideCache.week0?.baseline,
      r: twCapOverrideCache.week0?.ramp,
      s: twCapOverrideCache.week0?.scheduled,
      m: twCapOverrideCache.week0?.max,
    });
    if (sig !== twCapOverrideSig){
      twCapOverrideSig = sig;
      markMcStale();
      scheduleRender();
    }
  } else {
    twCapOverrideSig = "";
  }

  if (!els.twCapOutlookTbody) return;
  els.twCapOutlookTbody.innerHTML = "";
  for (const row of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.weekStarting}</td>
      <td class="num">${twCapFmtInt(row.baseline)}</td>
      <td class="num">${twCapFmtInt(row.ramp)}</td>
      <td class="num">${twCapFmtInt(row.scheduled)}</td>
      <td class="num">${twCapFmtSigned(row.delta)}</td>
    `;
    els.twCapOutlookTbody.appendChild(tr);
  }
}

function updateDiagnosticsUI(){
  try{
    if (!els.diagErrors) return;
    const lines = recentErrors.map((e) => {
      const head = `[${e.t}] ${e.kind}: ${e.msg}`;
      return head;
    });
    if (!lines.length) lines.push("(none)");
    els.diagErrors.textContent = lines.join("\n");

    // Only resolve Operations diagnostics when modal is open to avoid background load.
    if (!els.diagModal || els.diagModal.hidden) return;
    const seq = ++diagRenderSeq;
    Promise.resolve()
      .then(() => getOperationsDiagnosticsSnapshot())
      .then((tw) => {
        if (seq !== diagRenderSeq) return;
        const withOps = appendOperationsDiagnostics(lines, tw);
        const merged = appendModelDiagnostics(withOps);
        if (els.diagErrors) els.diagErrors.textContent = merged.join("\n");
      })
      .catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

async function copyDebugBundle(){
  const tw = await getOperationsDiagnosticsSnapshot();
  const benchmarkWarnings = engine?.snapshot?.computeAssumptionBenchmarkWarnings
    ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
    : [];
  const drift = computeRealityDrift();
  const bundle = {
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    scenarioName: state?.scenarioName || "",
    lastExportHash: lastExportHash || null,
    recentErrors: recentErrors.slice(0, MAX_ERRORS),
    operationsDiagnostics: tw,
    modelDiagnostics: {
      benchmarkWarnings,
      realityDrift: drift?.hasLog ? {
        flags: Array.isArray(drift.flags) ? drift.flags.slice() : [],
        primary: drift.primary || null,
        actualCR: drift.actualCR ?? null,
        assumedCR: drift.assumedCR ?? null,
        actualSR: drift.actualSR ?? null,
        assumedSR: drift.assumedSR ?? null,
        actualAPH: drift.actualAPH ?? null,
        expectedAPH: drift.expectedAPH ?? null,
      } : {
        hasLog: false,
      },
    },
  };
  const text = JSON.stringify(bundle, null, 2);
  try{
    await engine.snapshot.copyTextToClipboard(text);
    alert("Debug bundle copied.");
  } catch {
    // fallback
    downloadText(text, "fpe-debug-bundle.json", "application/json");
  }
}

// Phase 11 — auto-backups (rolling 5)
function scheduleBackupWrite(){
  try{
    if (backupTimer) clearTimeout(backupTimer);
    backupTimer = setTimeout(() => {
      safeCall(() => {
        const scenarioClone = structuredClone(state);
        const snapshot = { modelVersion: engine.snapshot.MODEL_VERSION, schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION, scenarioState: scenarioClone, appVersion: APP_VERSION, buildId: BUILD_ID };
        snapshot.snapshotHash = engine.snapshot.computeSnapshotHash(snapshot);
        lastExportHash = snapshot.snapshotHash;
        const payload = engine.snapshot.makeScenarioExport(snapshot);
        const result = appendBackupEntry({ ts: new Date().toISOString(), scenarioName: scenarioClone?.scenarioName || "", payload });
        if (result?.ok){
          clearPersistenceFailure("backup");
        } else {
          reportPersistenceFailure("backup", result);
        }
        refreshBackupDropdown();
      });
    }, 800);
  } catch { /* ignore */ }
}

function refreshBackupDropdown(){
  try{
    if (!els.restoreBackup) return;
    const backups = readBackups();
    const cur = els.restoreBackup.value;
    els.restoreBackup.innerHTML = '<option value="">Restore backup…</option>';
    backups.forEach((b, i) => {
      const opt = document.createElement("option");
      const name = (b?.scenarioName || "").trim();
      const when = b?.ts ? String(b.ts).replace("T"," ").replace("Z","") : "";
      opt.value = String(i);
      opt.textContent = `${when}${name ? " — " + name : ""}`;
      els.restoreBackup.appendChild(opt);
    });
    els.restoreBackup.value = cur && cur !== "" ? cur : "";
  } catch { /* ignore */ }
}

function restoreBackupByIndex(idx){
  const backups = readBackups();
  const entry = backups[Number(idx)];
  if (!entry) return;
  const ok = confirm("Restore this backup? This will overwrite current scenario inputs.");
  if (!ok) return;

  const rawPayload = (entry && Object.prototype.hasOwnProperty.call(entry, "payload"))
    ? entry.payload
    : entry;

  let loaded = rawPayload;
  if (typeof loaded === "string"){
    try{
      loaded = JSON.parse(loaded);
    } catch {
      alert("Backup restore failed: invalid backup payload.");
      return;
    }
  }
  if (!loaded || typeof loaded !== "object"){
    alert("Backup restore failed: invalid backup payload.");
    return;
  }

  const migrated = engine.snapshot.migrateSnapshot(loaded);
  const validated = engine.snapshot.validateScenarioExport(migrated?.snapshot, engine.snapshot.MODEL_VERSION);
  if (!validated?.ok){
    alert(`Backup restore failed: ${validated?.reason || "could not migrate snapshot."}`);
    return;
  }

  const quality = engine.snapshot.validateImportedScenarioData(validated.scenario);
  if (!quality.ok){
    const details = quality.errors.map((x) => `- ${x}`).join("\n");
    alert(`Backup restore failed: quality checks failed.\n${details}`);
    return;
  }

  // Keep backup restore policy aligned with JSON import behavior.
  try{
    const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
    const recomputed = engine.snapshot.computeSnapshotHash({
      modelVersion: validated.modelVersion,
      scenarioState: validated.scenario
    });
    const hashMismatch = !!(exportedHash && exportedHash !== recomputed);
    if (hashMismatch){
      if (els.importHashBanner){
        els.importHashBanner.hidden = false;
        els.importHashBanner.textContent = "Snapshot hash differs from exported hash.";
      }
      console.warn("Backup snapshot hash mismatch", { exportedHash, recomputed });
    } else if (els.importHashBanner){
      els.importHashBanner.hidden = true;
    }

    const policy = engine.snapshot.checkStrictImportPolicy({
      strictMode: !!state?.ui?.strictImport,
      importedSchemaVersion: (migrated?.snapshot?.schemaVersion || loaded.schemaVersion || null),
      currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
      hashMismatch
    });
    if (!policy.ok){
      alert(policy.issues.join(" "));
      return;
    }
  } catch {
    if (state?.ui?.strictImport){
      alert("Backup restore blocked: could not verify integrity hash in strict mode.");
      return;
    }
  }

  const restoreWarnings = [];
  if (Array.isArray(migrated?.warnings)) restoreWarnings.push(...migrated.warnings);
  if (Array.isArray(quality?.warnings)) restoreWarnings.push(...quality.warnings);
  if (els.importWarnBanner){
    if (restoreWarnings.length){
      const shown = restoreWarnings.slice(0, 6).join(" ");
      const extra = restoreWarnings.length > 6 ? ` (+${restoreWarnings.length - 6} more)` : "";
      els.importWarnBanner.hidden = false;
      els.importWarnBanner.textContent = `${shown}${extra}`.trim();
    } else {
      els.importWarnBanner.hidden = true;
      els.importWarnBanner.textContent = "";
    }
  }

  state = normalizeLoadedState(validated.scenario);
  ensureDecisionScaffold();
  persist();
  render();
  safeCall(() => { renderDecisionSessionD1(); });
}



import { els } from "./ui/els.js";

function setText(el, text){ if(el) el.textContent = String(text ?? ""); }
function setHidden(el, hidden){ if(el) el.hidden = !!hidden; }
function setTextPair(a, b, text){ setText(a, text); setText(b, text); }

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

let state = normalizeLoadedState(loadState() || makeDefaultState());

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
let backupTimer = null;
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

function commitUIUpdate({ render: doRender = true, persist: doPersist = true, immediatePersist = false } = {}){
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

function applyStateToUI(){
  applyStateToUIView({
    els,
    state,
    canonicalDoorsPerHourFromSnap,
    syncMcModeUI,
    syncGotvModeUI,
    applyThemeFromState,
  });
}

function rebuildCandidateTable(){
  els.candTbody.innerHTML = "";

  for (const cand of state.candidates){
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.className = "input input-sm";
    nameInput.value = cand.name || "";
    nameInput.addEventListener("input", () => {
      cand.name = nameInput.value;
      if (!state.userSplit[cand.id]) state.userSplit[cand.id] = 0;
      rebuildYourCandidateSelect();
      rebuildUserSplitInputs();
      commitUIUpdate();
    });
    tdName.appendChild(nameInput);

    const tdPct = document.createElement("td");
    tdPct.className = "num";
    const pctInput = document.createElement("input");
    pctInput.className = "input input-sm num";
    pctInput.type = "number";
    pctInput.min = "0";
    pctInput.max = "100";
    pctInput.step = "0.1";
    pctInput.value = cand.supportPct ?? "";
    pctInput.addEventListener("input", () => {
      cand.supportPct = safeNum(pctInput.value);
      commitUIUpdate();
    });
    tdPct.appendChild(pctInput);

    const tdDel = document.createElement("td");
    tdDel.className = "num";
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-sm btn-ghost";
    delBtn.type = "button";
    delBtn.textContent = "Remove";
    delBtn.disabled = state.candidates.length <= 2;
    delBtn.addEventListener("click", () => {
      if (state.candidates.length <= 2) return;
      state.candidates = state.candidates.filter(c => c.id !== cand.id);
      delete state.userSplit[cand.id];
      if (state.yourCandidateId === cand.id){
        state.yourCandidateId = state.candidates[0]?.id || null;
      }
      rebuildCandidateTable();
      rebuildYourCandidateSelect();
      rebuildUserSplitInputs();
      commitUIUpdate();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdPct);
    tr.appendChild(tdDel);
    els.candTbody.appendChild(tr);
  }

  rebuildYourCandidateSelect();
  rebuildUserSplitInputs();
}

function rebuildYourCandidateSelect(){
  els.yourCandidate.innerHTML = "";
  for (const cand of state.candidates){
    const opt = document.createElement("option");
    opt.value = cand.id;
    opt.textContent = cand.name || "Candidate";
    els.yourCandidate.appendChild(opt);
  }
  if (!state.yourCandidateId){
    state.yourCandidateId = state.candidates[0]?.id || null;
  }
  els.yourCandidate.value = state.yourCandidateId || "";
}

function rebuildUserSplitInputs(){
  const isUser = state.undecidedMode === "user_defined";
  els.userSplitWrap.hidden = !isUser;
  if (!isUser) return;

  els.userSplitList.innerHTML = "";
  for (const cand of state.candidates){
    if (state.userSplit[cand.id] == null) state.userSplit[cand.id] = 0;
    const row = document.createElement("div");
    row.className = "grid2";
    row.style.gridTemplateColumns = "1fr 120px";

    const name = document.createElement("div");
    name.className = "label";
    name.style.alignSelf = "center";
    name.textContent = cand.name || "Candidate";

    const inp = document.createElement("input");
    inp.className = "input input-sm num";
    inp.type = "number";
    inp.min = "0";
    inp.max = "100";
    inp.step = "0.1";
    inp.value = state.userSplit[cand.id] ?? 0;
    inp.addEventListener("input", () => {
      state.userSplit[cand.id] = safeNum(inp.value);
      commitUIUpdate();
    });

    row.appendChild(name);
    row.appendChild(inp);
    els.userSplitList.appendChild(row);
  }
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
    wireTabAndExportEvents,
    wireResetImportAndUiToggles,
  });
}

function normalizeLoadedState(s){
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

// Step-3 seam: single compiler for effective inputs.
// Operations override is explicit opt-in and falls back to baseline when unavailable.
function compileEffectiveInputs(srcState = state){
  const s = srcState || {};
  const eff = (s === state) ? getEffectiveBaseRates() : getEffectiveBaseRatesFromSnap(s);

  let orgCount = safeNum(s.orgCount);
  const orgHoursPerWeek = safeNum(s.orgHoursPerWeek);
  const volunteerMult = safeNum(s.volunteerMultBase);
  const doorSharePct = safeNum(s.channelDoorPct);
  const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct, 0, 100) / 100;
  const doorsPerHour = canonicalDoorsPerHourFromSnap(s);
  const callsPerHour = safeNum(s.callsPerHour3);

  let source = "baseline-manual";
  let overrideTargetAttemptsPerWeek = null;
  const overrideEnabled = !!s.twCapOverrideEnabled;
  const overrideMode = twCapOverrideModeFromState(s);

  if (overrideEnabled){
    if (overrideMode === "baseline"){
      source = "baseline-manual (override-baseline)";
    } else {
      const targetAttempts = twCapResolveOverrideAttempts(s);
      const perOrganizerAttempts = twCapPerOrganizerAttemptsPerWeek({
        capacity: {
          orgCount: 1,
          orgHoursPerWeek,
          volunteerMult,
          doorShare,
          doorsPerHour,
          callsPerHour,
        }
      });
      if (targetAttempts != null && perOrganizerAttempts > 0){
        orgCount = targetAttempts / perOrganizerAttempts;
        overrideTargetAttemptsPerWeek = targetAttempts;
        source = `operations-${overrideMode}`;
      } else {
        source = `baseline-manual (override-${overrideMode}-fallback)`;
      }
    }
  }

  return {
    rates: {
      cr: eff.cr,
      sr: eff.sr,
      tr: eff.tr,
    },
    capacity: {
      orgCount,
      orgHoursPerWeek,
      volunteerMult,
      doorSharePct,
      doorShare,
      doorsPerHour,
      callsPerHour,
    },
    meta: {
      source,
      twCapOverrideEnabled: overrideEnabled,
      twCapOverrideMode: overrideMode,
      twCapOverrideTargetAttemptsPerWeek: overrideTargetAttemptsPerWeek,
    }
  };
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
}

function renderWeeklyOps(res, weeks){
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
    compileEffectiveInputsForState: (s) => compileEffectiveInputs(s)
  });
}

function renderAssumptionDriftE1(res, weeks){
  return renderAssumptionDriftPanel({ els, state, res, weeks, safeNum, computeWeeklyOpsContext });
}

function computeRealityDrift(){
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  if (!log || log.length === 0) return { hasLog:false, flags:[], primary:null };

  const sorted = [...log].filter(x => x && x.date).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const windowN = 7;
  const lastN = sorted.slice(-windowN);

  let sumAttempts = 0, sumConvos = 0, sumSupportIds = 0, sumOrgHours = 0;
  for (const x of lastN){
    const doors = safeNum(x?.doors) || 0;
    const calls = safeNum(x?.calls) || 0;
    const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
    const convos = safeNum(x?.convos) || 0;
    const sup = safeNum(x?.supportIds) || 0;
    const hrs = safeNum(x?.orgHours) || 0;

    sumAttempts += attempts;
    sumConvos += convos;
    sumSupportIds += sup;
    sumOrgHours += hrs;
  }

  const actualCR = (sumAttempts > 0) ? (sumConvos / sumAttempts) : null;
  const actualSR = (sumConvos > 0) ? (sumSupportIds / sumConvos) : null;
  const actualAPH = (sumOrgHours > 0) ? (sumAttempts / sumOrgHours) : null;

  const assumedCR = (state.contactRatePct != null && state.contactRatePct !== "") ? ((safeNum(state.contactRatePct) || 0) / 100) : null;
  const assumedSR = (state.supportRatePct != null && state.supportRatePct !== "") ? ((safeNum(state.supportRatePct) || 0) / 100) : null;

  const mixDoor = (state.channelDoorPct != null && state.channelDoorPct !== "") ? ((safeNum(state.channelDoorPct) || 0) / 100) : null;
  const doorsHr = (state.doorsPerHour3 != null && state.doorsPerHour3 !== "") ? (safeNum(state.doorsPerHour3) || 0) : null;
  const callsHr = (state.callsPerHour3 != null && state.callsPerHour3 !== "") ? (safeNum(state.callsPerHour3) || 0) : null;
  const expectedAPH = (mixDoor != null && doorsHr != null && callsHr != null)
    ? (mixDoor * doorsHr + (1 - mixDoor) * callsHr)
    : null;

  const flags = [];
  const tol = 0.90; // 10% below assumed => flag
  const gaps = [];

  if (assumedCR != null && actualCR != null && isFinite(actualCR) && assumedCR > 0 && actualCR < assumedCR * tol){
    flags.push("contact rate below assumed");
    gaps.push({k:"contact", r:(assumedCR - actualCR) / assumedCR});
  }
  if (assumedSR != null && actualSR != null && isFinite(actualSR) && assumedSR > 0 && actualSR < assumedSR * tol){
    flags.push("support rate below assumed");
    gaps.push({k:"support", r:(assumedSR - actualSR) / assumedSR});
  }
  if (expectedAPH != null && actualAPH != null && isFinite(actualAPH) && expectedAPH > 0 && actualAPH < expectedAPH * tol){
    flags.push("productivity below assumed");
    gaps.push({k:"productivity", r:(expectedAPH - actualAPH) / expectedAPH});
  }

  let primary = null;
  if (gaps.length){
    gaps.sort((a,b)=> (b.r - a.r));
    primary = gaps[0].k;
  }

  return {
    hasLog:true,
    flags,
    primary,
    actualCR, actualSR, actualAPH,
    assumedCR, assumedSR, expectedAPH
  };
}

function applyRollingRateToAssumption(kind){
  const drift = computeRealityDrift();
  if (!drift?.hasLog){
    if (els.applyRollingMsg) els.applyRollingMsg.textContent = "No daily log yet";
    return;
  }

  const pct1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 1000) / 10; // 1 decimal
  const num1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 10) / 10;
  let changed = false;

  if (kind === "contact"){
    const v = pct1(drift.actualCR);
    if (v == null){
      if (els.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling contact rate is unavailable";
      return;
    }
    state.contactRatePct = v;
    if (els.contactRatePct) els.contactRatePct.value = String(v);
    if (els.applyRollingMsg) els.applyRollingMsg.textContent = `Set assumed contact rate to ${v}%`;
    changed = true;
  } else if (kind === "support"){
    const v = pct1(drift.actualSR);
    if (v == null){
      if (els.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling support rate is unavailable";
      return;
    }
    state.supportRatePct = v;
    if (els.supportRatePct) els.supportRatePct.value = String(v);
    if (els.applyRollingMsg) els.applyRollingMsg.textContent = `Set assumed support rate to ${v}%`;
    changed = true;
  } else if (kind === "productivity"){
    const actualAPH = num1(drift.actualAPH);
    const expectedAPH = num1(drift.expectedAPH);
    if (actualAPH == null || actualAPH <= 0){
      if (els.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling productivity is unavailable";
      return;
    }
    if (expectedAPH == null || expectedAPH <= 0){
      if (els.applyRollingMsg) els.applyRollingMsg.textContent = "Expected productivity baseline is unavailable";
      return;
    }

    const curDoors = safeNum(state.doorsPerHour3);
    const curCalls = safeNum(state.callsPerHour3);
    if (curDoors == null || curDoors <= 0 || curCalls == null || curCalls <= 0){
      if (els.applyRollingMsg) els.applyRollingMsg.textContent = "Current productivity assumptions are invalid";
      return;
    }

    const ratioRaw = actualAPH / expectedAPH;
    const ratio = clamp(ratioRaw, 0.5, 1.5);
    const nextDoors = num1(Math.max(1, curDoors * ratio));
    const nextCalls = num1(Math.max(1, curCalls * ratio));

    setCanonicalDoorsPerHour(state, nextDoors);
    state.callsPerHour3 = nextCalls;

    if (els.doorsPerHour3) els.doorsPerHour3.value = String(nextDoors);
    if (els.callsPerHour3) els.callsPerHour3.value = String(nextCalls);
    if (els.applyRollingMsg){
      const pct = Math.round((ratio - 1) * 1000) / 10;
      const adj = (ratio !== ratioRaw) ? " (clamped)" : "";
      const sign = pct >= 0 ? "+" : "";
      els.applyRollingMsg.textContent = `Scaled productivity ${sign}${pct}%${adj}: doors/hr ${nextDoors}, calls/hr ${nextCalls}`;
    }
    changed = true;
  }

  if (changed){
    markMcStale();
    commitUIUpdate();
  }
}

function applyAllRollingCalibrations(){
  const drift = computeRealityDrift();
  if (!drift?.hasLog){
    if (els.applyRollingMsg) els.applyRollingMsg.textContent = "No daily log yet";
    return;
  }

  const prevState = structuredClone(state);
  const pct1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 1000) / 10; // 1 decimal
  const num1 = (x) => (x == null || !isFinite(x)) ? null : Math.round(x * 10) / 10;
  const applied = [];

  const cr = pct1(drift.actualCR);
  if (cr != null){
    state.contactRatePct = cr;
    if (els.contactRatePct) els.contactRatePct.value = String(cr);
    applied.push(`CR ${cr}%`);
  }

  const sr = pct1(drift.actualSR);
  if (sr != null){
    state.supportRatePct = sr;
    if (els.supportRatePct) els.supportRatePct.value = String(sr);
    applied.push(`SR ${sr}%`);
  }

  const actualAPH = num1(drift.actualAPH);
  const expectedAPH = num1(drift.expectedAPH);
  if (actualAPH != null && actualAPH > 0 && expectedAPH != null && expectedAPH > 0){
    const curDoors = safeNum(state.doorsPerHour3);
    const curCalls = safeNum(state.callsPerHour3);
    if (curDoors != null && curDoors > 0 && curCalls != null && curCalls > 0){
      const ratioRaw = actualAPH / expectedAPH;
      const ratio = clamp(ratioRaw, 0.5, 1.5);
      const nextDoors = num1(Math.max(1, curDoors * ratio));
      const nextCalls = num1(Math.max(1, curCalls * ratio));
      setCanonicalDoorsPerHour(state, nextDoors);
      state.callsPerHour3 = nextCalls;
      if (els.doorsPerHour3) els.doorsPerHour3.value = String(nextDoors);
      if (els.callsPerHour3) els.callsPerHour3.value = String(nextCalls);
      const pct = Math.round((ratio - 1) * 1000) / 10;
      const sign = pct >= 0 ? "+" : "";
      const adj = (ratio !== ratioRaw) ? " (clamped)" : "";
      applied.push(`APH ${sign}${pct}%${adj}`);
    }
  }

  if (!applied.length){
    if (els.applyRollingMsg) els.applyRollingMsg.textContent = "No rolling calibration values are available";
    return;
  }

  lastAppliedWeeklyAction = {
    label: `Applied: rolling calibrations (${applied.join(", ")})`,
    prevState
  };
  syncWeeklyUndoUI();
  markMcStale();
  commitUIUpdate();

  if (els.applyRollingMsg){
    els.applyRollingMsg.textContent = `Applied rolling calibrations: ${applied.join(" · ")}`;
  }
}


function applyWeeklyLeverScenario(lever, ctx){
  if (!lever) return;
  const prevState = structuredClone(state);
  const next = structuredClone(state);

  const asNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  if (lever.key === "org"){
    const v = asNum(next.orgCount) ?? 0;
    next.orgCount = v + 1;
  } else if (lever.key === "orgHr"){
    const v = asNum(next.orgHoursPerWeek) ?? 0;
    next.orgHoursPerWeek = v + 1;
  } else if (lever.key === "volMult"){
    const v = asNum(next.volunteerMultBase) ?? 0;
    next.volunteerMultBase = Math.round((v + 0.10) * 100) / 100;
  } else if (lever.key === "dph"){
    const v = asNum(next.doorsPerHour3) ?? 0;
    next.doorsPerHour3 = v + 1;
  } else if (lever.key === "cph"){
    const v = asNum(next.callsPerHour3) ?? 0;
    next.callsPerHour3 = v + 1;
  } else if (lever.key === "mix"){
    const d = asNum(next.channelDoorPct);
    const cur = d == null ? (ctx?.doorShare != null ? ctx.doorShare * 100 : 50) : d;
    const doorIsFaster = (ctx?.doorsPerHour != null && ctx?.callsPerHour != null) ? (ctx.doorsPerHour >= ctx.callsPerHour) : true;
    const nextPct = clamp(cur + (doorIsFaster ? 10 : -10), 0, 100);
    next.channelDoorPct = Math.round(nextPct);
  } else if (lever.key === "sr"){
    const v = asNum(next.supportRatePct) ?? 0;
    next.supportRatePct = Math.round((v + 1) * 10) / 10;
  } else if (lever.key === "cr"){
    const v = asNum(next.contactRatePct) ?? 0;
    next.contactRatePct = Math.round((v + 1) * 10) / 10;
  } else if (lever.key === "weeks"){
    const v = asNum(next.weeksRemaining);
    if (v != null){
      next.weeksRemaining = Math.round((v + 1) * 10) / 10;
    } else if (ctx?.weeks != null){
      next.weeksRemaining = Math.round((ctx.weeks + 1) * 10) / 10;
    } else {
      next.weeksRemaining = 1;
    }
  }

  const baseName = String(state.scenarioName || "Scenario");
  const label = String(lever.label || "Action");
  next.scenarioName = baseName + " • " + label;

  lastAppliedWeeklyAction = {
    label: "Applied: " + label,
    prevState
  };

  state = next;
  applyStateToUI();
  commitUIUpdate();
  syncWeeklyUndoUI();
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

function renderWeeklyOpsInsights(res, weeks){
  return renderWeeklyOpsInsightsPanel({
    els,
    state,
    res,
    weeks,
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

function renderWeeklyOpsFreshness(res, weeks){
  return renderWeeklyOpsFreshnessPanel({
    els,
    state,
    res,
    weeks,
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

function renderDecisionConfidenceE5(res, weeks){
  return renderDecisionConfidencePanel({
    els,
    state,
    res,
    weeks,
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

function renderImpactTraceE6(res, weeks){
  return renderImpactTracePanel({
    els,
    state,
    res,
    weeks,
    fmtInt
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
  renderValidationModule({
    els,
    state,
    res,
    weeks,
    benchmarkWarnings,
    driftSummary,
  });
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
  return ensureScenarioRegistryCore(state, {
    scenarioBaselineId: SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
  });
}

function setScenarioWarn(msg){
  if (!els.scWarn) return;
  if (msg){
    els.scWarn.hidden = false;
    els.scWarn.textContent = msg;
  } else {
    els.scWarn.hidden = true;
    els.scWarn.textContent = "";
  }
}

function listScenarioRecords(){
  ensureScenarioRegistry();
  return listScenarioRecordsCore(state, {
    scenarioBaselineId: SCENARIO_BASELINE_ID,
  });
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
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    compileEffectiveInputs,
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
    state,
    ensureScenarioRegistry,
    SCENARIO_BASELINE_ID,
    scenarioClone,
    scenarioInputsFromState,
    computeDecisionKeyOutCore,
    engine,
    derivedWeeksRemaining,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
    computeLastNLogSums,
    paceFinishDate,
    fmtInt,
    fmtISODate
  });
}

function renderScenarioManagerC1(){
  return renderScenarioManagerPanel({
    els,
    state,
    ensureScenarioRegistry,
    listScenarioRecords,
    SCENARIO_BASELINE_ID,
    SCENARIO_MAX,
    setScenarioWarn,
    renderScenarioComparison: renderScenarioComparisonC3,
  });
}

// =========================
// Phase D1 — Decision Session Scaffold (UI + state only)
// =========================

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
  return ensureDecisionScaffoldCore(state, {
    ensureDecisionSessionShape,
    makeDecisionSessionId,
    objectiveTemplates: OBJECTIVE_TEMPLATES,
    scenarioBaselineId: SCENARIO_BASELINE_ID,
  });
}

function getActiveDecisionSession(){
  ensureDecisionScaffold();
  return getActiveDecisionSessionCore(state);
}

function listDecisionSessions(){
  ensureDecisionScaffold();
  return listDecisionSessionsCore(state);
}

function decisionScenarioLabel(scenarioId){
  ensureScenarioRegistry();
  return decisionScenarioLabelCore(scenarioId, state.ui.scenarios || {});
}

function renderDecisionSessionD1(){
  return renderDecisionSessionPanelCore({
    els,
    state,
    ensureDecisionScaffold,
    listDecisionSessions,
    getActiveDecisionSession,
    ensureDecisionSessionShape,
    objectiveTemplates: OBJECTIVE_TEMPLATES,
    riskPostures: RISK_POSTURES,
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
    state,
    SCENARIO_BASELINE_ID,
    scenarioClone,
    engine,
    derivedWeeksRemaining,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
    fmtISODate,
    OBJECTIVE_TEMPLATES,
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
    activeScenarioId: state?.ui?.activeScenarioId || null,
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
      const res = engine.computeAll(snap);
      const weeks = derivedWeeksRemaining();
      const needVotes = deriveNeedVotes(res);

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


function markMcStale(){
  // Mark results stale if there is a prior run.
  if (!els.mcStale) return;
  if (state.mcLast){
    setHidden(els.mcStale, false); setHidden(els.mcStaleSidebar, false);
  }
}


function withPatchedState(patch, fn){
  // Dev-only helper used by selfTest harness.
  const prev = getStateSnapshot();
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
    return fn();
  } finally {
    // Restore
    state = prev;
  }
}


function clearMcStale(){
  if (!els.mcStale) return;
  setHidden(els.mcStale, true); setHidden(els.mcStaleSidebar, true);
  els.mcStale.classList.remove("warn","ok");
  els.mcStale.classList.add("warn");
}

function computeDailyLogHash(){
  return computeDailyLogHashModule({
    state,
    normalizeDailyLogEntry,
    computeSnapshotHash,
  });
}

function renderMcFreshness(res, weeks){
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
    renderOpsEnvelopeD2,
    renderFinishEnvelopeD3,
    renderMissRiskD4,
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

function computeOpsEnvelopeD2(res, weeks){
  return computeOpsEnvelopeD2Module({
    state,
    res,
    weeks,
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

function renderOpsEnvelopeD2(res, weeks){
  renderOpsEnvelopeD2Module({
    els,
    state,
    res,
    weeks,
    hashOpsEnvelopeInputs,
    computeOpsEnvelopeD2,
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

function computeFinishEnvelopeD3(res, weeks){
  return computeFinishEnvelopeD3Module({
    state,
    res,
    weeks,
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

function renderFinishEnvelopeD3(res, weeks){
  renderFinishEnvelopeD3Module({
    els,
    state,
    res,
    weeks,
    hashFinishEnvelopeInputs,
    computeFinishEnvelopeD3,
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

function computeMissRiskD4(res, weeks){
  return computeMissRiskD4Module({
    state,
    res,
    weeks,
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

function renderMissRiskD4(res, weeks){
  if (!els.opsMissProb && !els.opsMissTag) return;

  const clear = () => {
    if (els.opsMissProb) els.opsMissProb.textContent = "—";
    if (els.opsMissTag){
      els.opsMissTag.textContent = "—";
      els.opsMissTag.classList.remove("ok","warn","bad");
    }
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashMissRiskInputs(res, weeks);
  const cached = (state.ui && state.ui.missRiskD4 && typeof state.ui.missRiskD4 === "object") ? state.ui.missRiskD4 : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeMissRiskD4(res, weeks);
    if (!env){
      clear();
      return;
    }
    if (!state.ui) state.ui = {};
    state.ui.missRiskD4 = { hash: h, env, computedAt: new Date().toISOString() };
    persist();
  }

  const prob = env.prob;
  const pct = (prob == null || !isFinite(prob)) ? "—" : `${(prob * 100).toFixed(1)}%`;

  if (els.opsMissProb) els.opsMissProb.textContent = pct;

  if (els.opsMissTag){
    let label = "Low";
    let cls = "ok";
    if (prob >= 0.60){
      label = "High";
      cls = "bad";
    } else if (prob >= 0.30){
      label = "Moderate";
      cls = "warn";
    }
    els.opsMissTag.textContent = label;
    els.opsMissTag.classList.remove("ok","warn","bad");
    els.opsMissTag.classList.add(cls);
  }
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
  return coreComputeCapacityBreakdown(args);
}

function computeCapacityContacts(args){
  return coreComputeCapacityContacts(args);
}

/* ---- Monte Carlo ---- */

function runMonteCarloNow(){
  return runMonteCarloNowModule({
    state,
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

function runMonteCarloSim({ scenario, scenarioState, res, weeks, needVotes, runs, seed }){
  // Delegated to core Monte Carlo via facade (no loops in UI).
  return engine.runMonteCarlo({ scenario: scenario || scenarioState || state, res, weeks, needVotes, runs, seed });
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
