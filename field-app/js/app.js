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
import { renderMain } from "./app/renderMain.js";
import { initDevToolsModule } from "./app/initDevTools.js";
import { buildModelInputFromState } from "./app/modelInput.js";
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
  decisionOptionDisplayCore,
  buildDecisionSummaryTextCore,
  copyTextToClipboardCore,
  decisionSummaryPlainTextCore,
  decisionSessionExportObjectCore,
  downloadJsonObjectCore,
} from "./app/decisionSessionSummary.js";
import {
  wireSafetyAndDiagnosticsEvents,
  wirePrimaryPlannerEvents,
  wireBudgetTimelineEvents,
  wireTabAndExportEvents,
  wireResetImportAndUiToggles
} from "./app/wireEvents.js";
import {
  derivedWeeksRemainingFromState,
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
  if (!raw || typeof raw !== "object") return null;
  const date = String(raw.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const doors = safeNum(raw.doors) || 0;
  const calls = safeNum(raw.calls) || 0;
  const convos = safeNum(raw.convos) || 0;
  const supportIds = safeNum(raw.supportIds) || 0;
  const orgHours = safeNum(raw.orgHours) || 0;
  const volsActive = safeNum(raw.volsActive) || 0;
  const attempts = (raw.attempts != null && raw.attempts !== "") ? (safeNum(raw.attempts) || 0) : (doors + calls);
  const notes = (raw.notes == null) ? "" : String(raw.notes);
  const updatedAt = Number(raw.updatedAt || 0) || 0;

  return { date, doors, calls, attempts, convos, supportIds, orgHours, volsActive, notes, updatedAt };
}

function mergeDailyLogIntoState(imported){
  const arr = Array.isArray(imported)
    ? imported
    : (Array.isArray(imported?.dailyLog) ? imported.dailyLog
      : (Array.isArray(imported?.ui?.dailyLog) ? imported.ui.dailyLog : null));
  if (!arr) return { ok: false, msg: "No dailyLog array found in JSON" };

  if (!state.ui) state.ui = {};
  const existing = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];

  const byDate = new Map();
  for (const e of existing){
    const n = normalizeDailyLogEntry(e);
    if (!n) continue;
    byDate.set(n.date, n);
  }

  let added = 0;
  let replaced = 0;
  let ignored = 0;

  for (const e of arr){
    const n = normalizeDailyLogEntry(e);
    if (!n){ ignored++; continue; }
    const prev = byDate.get(n.date);
    if (!prev){
      byDate.set(n.date, n);
      added++;
      continue;
    }
    // Prefer the most recently updated. If neither has updatedAt, prefer imported.
    const prevTs = Number(prev.updatedAt || 0) || 0;
    const nextTs = Number(n.updatedAt || 0) || 0;
    const takeImported = (nextTs >= prevTs);
    if (takeImported){
      byDate.set(n.date, n);
      replaced++;
    } else {
      ignored++;
    }
  }

  const merged = Array.from(byDate.values()).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  // daily log changes should mark plan/MC as stale
  markMcStale();
  setState(s => { s.ui.dailyLog = merged; });

  return { ok: true, msg: `Merged daily log: ${added} new, ${replaced} updated, ${ignored} ignored` };
}

function exportDailyLog(){
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : [];
  const payload = {
    dailyLog: log,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
  };
  downloadText(JSON.stringify(payload, null, 2), "daily-log.json", "application/json");
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
  const out = Array.isArray(lines) ? lines.slice() : [];
  out.push("");
  out.push("[operations diagnostics]");
  if (!tw?.available){
    out.push(`status: unavailable (${tw?.error || "not initialized"})`);
    return out;
  }

  const c = tw.counts || {};
  const p = tw.rollups?.production || {};
  const d = tw.rollups?.dedupe || {};

  out.push(`records: persons=${Number(c.persons || 0)} pipeline=${Number(c.pipelineRecords || 0)} shifts=${Number(c.shiftRecords || 0)} turf=${Number(c.turfEvents || 0)}`);
  out.push(`productionSource: ${p.source || "—"}`);
  out.push(`productionTotals: attempts=${Math.round(Number(p.attempts || 0))} convos=${Math.round(Number(p.convos || 0))} supportIds=${Math.round(Number(p.supportIds || 0))} hours=${Number(p.hours || 0).toFixed(2)}`);
  out.push(`dedupeRule: ${d.rule || "—"}`);
  out.push(`dedupe: excludedTurfRecords=${Math.round(Number(d.excludedTurfAttemptRecords || 0))} excludedTurfAttempts=${Math.round(Number(d.excludedTurfAttempts || 0))} fallbackIncluded=${Math.round(Number(d.includedFallbackAttempts || 0))}`);
  return out;
}

function appendModelDiagnostics(lines){
  const out = Array.isArray(lines) ? lines.slice() : [];
  const fPct = (v) => (v == null || !isFinite(v)) ? "—" : `${(v * 100).toFixed(1)}%`;

  out.push("");
  out.push("[model diagnostics]");

  const benchmarkWarnings = engine?.snapshot?.computeAssumptionBenchmarkWarnings
    ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
    : [];
  out.push(`benchmarkWarnings: ${benchmarkWarnings.length}`);
  for (const msg of benchmarkWarnings.slice(0, 4)){
    out.push(`- ${msg}`);
  }

  const drift = computeRealityDrift();
  if (!drift?.hasLog){
    out.push("realityDrift: no daily log data");
    return out;
  }

  out.push(`rollingCR: actual=${fPct(drift.actualCR)} assumed=${fPct(drift.assumedCR)}`);
  out.push(`rollingSR: actual=${fPct(drift.actualSR)} assumed=${fPct(drift.assumedSR)}`);
  out.push(`rollingAPH: actual=${(drift.actualAPH == null || !isFinite(drift.actualAPH)) ? "—" : drift.actualAPH.toFixed(2)} assumed=${(drift.expectedAPH == null || !isFinite(drift.expectedAPH)) ? "—" : drift.expectedAPH.toFixed(2)}`);
  out.push(`driftFlags: ${drift.flags.length ? drift.flags.join(", ") : "none"}`);
  out.push(`primaryDrift: ${drift.primary || "none"}`);

  return out;
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
  if (el) el.textContent = String(text ?? "");
}

function twCapNum(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function twCapFmtInt(v){
  return (v == null || !Number.isFinite(v)) ? "—" : fmtInt(Math.round(v));
}

function twCapFmt1(v){
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function twCapFmtSigned(v){
  if (v == null || !Number.isFinite(v)) return "—";
  const n = Math.round(v);
  if (n > 0) return `+${fmtInt(n)}`;
  if (n < 0) return `−${fmtInt(Math.abs(n))}`;
  return "0";
}

function twCapRatioText(numerator, denominator){
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "—";
  return `${(100 * num / den).toFixed(1)}%`;
}

function twCapFmtPct01(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(100 * n).toFixed(1)}%`;
}

function twCapMedian(values){
  const list = (Array.isArray(values) ? values : [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  if (list.length % 2 === 1) return list[mid];
  return (list[mid - 1] + list[mid]) / 2;
}

function twCapClean(v){
  return String(v == null ? "" : v).trim();
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
  const slug = (s) => twCapClean(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${slug(from)}_to_${slug(to)}`;
}

function twCapParseDate(value){
  const s = twCapClean(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const dt = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function twCapWeekStart(dt){
  const base = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const day = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - day);
  return base;
}

function twCapIsoUTC(dt){
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  wireSafetyAndDiagnosticsEvents({
    els,
    getState: () => state,
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

  wirePrimaryPlannerEvents({
    els,
    getState: () => state,
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

  wireBudgetTimelineEvents({
    els,
    getState: () => state,
    safeNum,
    commitUIUpdate,
    render
  });

  wireTabAndExportEvents({
    els,
    getState: () => state,
    persist,
    engine,
    APP_VERSION,
    BUILD_ID,
    getLastResultsSnapshot: () => lastResultsSnapshot,
    setLastExportHash: (next) => { lastExportHash = next; },
    downloadText,
  });

  wireResetImportAndUiToggles({
    els,
    getState: () => state,
    replaceState: (next) => { state = next; },
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
    getLastResultsSnapshot: () => lastResultsSnapshot,
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
  if (args && typeof args === "object"){
    return coreDeriveWeeksRemainingCeil({
      weeksRemainingOverride: args.weeksRemainingOverride,
      electionDateISO: args.electionDateISO,
      nowDate: args.nowDate
    });
  }
  return derivedWeeksRemainingFromState(state);
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
  return renderRiskFramingPanel({ els, state, setTextPair, fmtSigned, clamp });
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
  return renderSensitivitySnapshotPanel({ els, state });
}

async function runSensitivitySnapshotE4(){
  return runSensitivitySnapshotPanel({
    els,
    state,
    lastRenderCtx,
    clamp,
    runMonteCarloSim,
    persist,
    renderSensitivitySnapshotE4
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
  try{
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {}
  try{
    return JSON.parse(JSON.stringify(obj));
  } catch {
    if (obj && typeof obj === "object") return Array.isArray(obj) ? obj.slice() : { ...obj };
    return obj;
  }
}

function scenarioInputsFromState(src){
  const s = scenarioClone(src);
  if (s && typeof s === "object"){
    delete s.ui;
    delete s.mcLast;
    delete s.mcLastHash;
  }
  return s;
}

function scenarioOutputsFromState(src){
  const ui = src?.ui || {};
  return {
    planMeta: scenarioClone(ui.lastPlanMeta || {}),
    summary: scenarioClone(ui.lastSummary || {}),
    timeline: scenarioClone(ui.lastTimeline || {}),
    tlMeta: scenarioClone(ui.lastTlMeta || {}),
    diagnostics: scenarioClone(ui.lastDiagnostics || {}),
  };
}

function ensureScenarioRegistry(){
  if (!state.ui) state.ui = {};
  const cur = state.ui.scenarios;
  if (!cur || typeof cur !== "object" || Array.isArray(cur)) state.ui.scenarios = {};
  if (!state.ui.activeScenarioId || typeof state.ui.activeScenarioId !== "string") state.ui.activeScenarioId = SCENARIO_BASELINE_ID;
  if (!state.ui.scenarioUiSelectedId || typeof state.ui.scenarioUiSelectedId !== "string") state.ui.scenarioUiSelectedId = state.ui.activeScenarioId;

  const reg = state.ui.scenarios;
  if (!reg[SCENARIO_BASELINE_ID]){
    reg[SCENARIO_BASELINE_ID] = {
      id: SCENARIO_BASELINE_ID,
      name: "Baseline",
      inputs: scenarioInputsFromState(state),
      outputs: scenarioOutputsFromState(state),
      createdAt: new Date().toISOString()
    };
  }

  if (!reg[state.ui.activeScenarioId]) state.ui.activeScenarioId = SCENARIO_BASELINE_ID;
  if (!reg[state.ui.scenarioUiSelectedId]) state.ui.scenarioUiSelectedId = state.ui.activeScenarioId;
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
  const reg = state.ui.scenarios;
  const all = Object.values(reg);
  const baseline = all.find(s => s && s.id === SCENARIO_BASELINE_ID) || null;
  const rest = all.filter(s => s && s.id !== SCENARIO_BASELINE_ID);
  rest.sort((a,b) => String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
  return baseline ? [baseline, ...rest] : rest;
}

function getUniverseLayerConfigFromSnap(snap){
  return getUniverseLayerConfigFromStateSelector(snap);
}

function getEffectiveBaseRatesFromSnap(snap){
  return getEffectiveBaseRatesFromStateSelector(snap, { computeUniverseAdjustedRates });
}

function computeWeeklyOpsContextFromSnap(snap, res, weeks){
  return computeWeeklyOpsContextFromStateSelector(snap, {
    res,
    weeks,
    getEffectiveBaseRatesForState: (s) => getEffectiveBaseRatesFromSnap(s),
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
    compileEffectiveInputsForState: (s) => compileEffectiveInputs(s)
  });
}

function targetFinishDateFromSnap(snap, weeks){
  const d = String(snap?.electionDate || "").trim();
  if (d){
    const dt = new Date(d + "T00:00:00");
    if (isFinite(dt)) return dt;
  }
  if (weeks != null && isFinite(weeks) && weeks > 0){
    const days = Math.ceil(weeks * 7);
    const dt = new Date();
    dt.setHours(12,0,0,0);
    dt.setDate(dt.getDate() + days);
    return dt;
  }
  return null;
}

function paceFinishDate(total, pacePerDay){
  if (total == null || !isFinite(total) || total <= 0) return null;
  if (pacePerDay == null || !isFinite(pacePerDay) || pacePerDay <= 0) return null;
  const daysNeeded = Math.ceil(total / pacePerDay);
  const dt = new Date();
  dt.setHours(12,0,0,0);
  dt.setDate(dt.getDate() + daysNeeded);
  return dt;
}

function renderScenarioComparisonC3(){
  if (!els.scmCompareWrap) return;
  ensureScenarioRegistry();

  const reg = state.ui.scenarios;
  const activeId = state.ui.activeScenarioId;
  const baseRec = reg?.[SCENARIO_BASELINE_ID] || null;
  const activeRec = reg?.[activeId] || null;

  const isDiff = !!(baseRec && activeRec && activeId !== SCENARIO_BASELINE_ID);

  if (els.scmCompareEmpty) els.scmCompareEmpty.hidden = isDiff;
  if (els.scmCompareGrid) els.scmCompareGrid.hidden = !isDiff;

  if (!els.scmCompareTag) return;

  const setCompareTag = (kind, text) => {
    els.scmCompareTag.classList.remove("ok","warn","bad");
    if (kind) els.scmCompareTag.classList.add(kind);
    els.scmCompareTag.textContent = text || "—";
  };

  if (!isDiff){
    setCompareTag(null, "—");
    if (els.scmDiffInputs) els.scmDiffInputs.innerHTML = "";
    if (els.scmDiffOutputs) els.scmDiffOutputs.innerHTML = "";
    if (els.scmDiffInputsFoot) els.scmDiffInputsFoot.textContent = "";
    return;
  }

  const baseInputs = scenarioClone(baseRec.inputs || {});
  const actInputs = scenarioInputsFromState(state);

  const keyOrder = [
    "raceType","mode","electionDate","weeksRemaining",
    "universeBasis","universeSize",
    "goalSupportIds","supportRatePct","contactRatePct","turnoutReliabilityPct",
    "universeLayerEnabled","universeDemPct","universeRepPct","universeNpaPct","universeOtherPct","retentionFactor",
    "orgCount","orgHoursPerWeek","volunteerMultBase","channelDoorPct","doorsPerHour3","callsPerHour3",
    "timelineEnabled","timelineStaffCount","timelineVolCount","timelineStaffHours","timelineVolHours","timelineDoorsPerHour","timelineCallsPerHour","timelineTextsPerHour","timelineDoorSharePct","timelineActiveWeeks","timelineGotvWeeks"
  ];

  const labels = {
    raceType:"Race type",
    mode:"Mode",
    electionDate:"Election date",
    weeksRemaining:"Weeks remaining override",
    universeBasis:"Universe basis",
    universeSize:"Universe size",
    goalSupportIds:"Goal support IDs",
    supportRatePct:"Support rate (%)",
    contactRatePct:"Contact rate (%)",
    turnoutReliabilityPct:"Turnout reliability (%)",
    universeLayerEnabled:"Universe layer enabled",
    universeDemPct:"Universe Dem (%)",
    universeRepPct:"Universe Rep (%)",
    universeNpaPct:"Universe NPA (%)",
    universeOtherPct:"Universe Other (%)",
    retentionFactor:"Retention factor",
    orgCount:"Organizers",
    orgHoursPerWeek:"Org hours/week",
    volunteerMultBase:"Volunteer multiplier",
    channelDoorPct:"Door share (%)",
    doorsPerHour3:"Doors/hour",
    callsPerHour3:"Calls/hour",
    timelineEnabled:"Timeline enabled",
    timelineStaffCount:"Timeline staff",
    timelineVolCount:"Timeline volunteers",
    timelineStaffHours:"Staff hours/week",
    timelineVolHours:"Volunteer hours/week",
    timelineDoorsPerHour:"Timeline doors/hour",
    timelineCallsPerHour:"Timeline calls/hour",
    timelineTextsPerHour:"Timeline texts/hour",
    timelineDoorSharePct:"Timeline door share (%)",
    timelineActiveWeeks:"Timeline active weeks",
    timelineGotvWeeks:"GOTV window (weeks)",
  };

  const fmtV = (k, v) => {
    if (v == null) return "—";
    if (typeof v === "boolean") return v ? "On" : "Off";
    if (typeof v === "number" && isFinite(v)){
      if (k === "retentionFactor") return v.toFixed(2);
      if (k.endsWith("Pct")) return String(v);
      if (Math.abs(v) >= 1000) return fmtInt(Math.round(v));
      return String(v);
    }
    if (typeof v === "string") return v === "" ? "—" : v;
    return String(v);
  };

  const diffKeys = [];
  const seen = new Set();
  for (const k of keyOrder){
    seen.add(k);
    const a = baseInputs?.[k];
    const b = actInputs?.[k];
    const same = (a === b) || (String(a ?? "") === String(b ?? ""));
    if (!same) diffKeys.push(k);
  }
  const otherKeys = Array.from(new Set([...Object.keys(baseInputs||{}), ...Object.keys(actInputs||{})])).filter(k => !seen.has(k) && k !== "ui" && k !== "mcLast" && k !== "mcLastHash");
  const otherChanged = otherKeys.filter(k => {
    const a = baseInputs?.[k];
    const b = actInputs?.[k];
    return !((a === b) || (String(a ?? "") === String(b ?? "")));
  });

  if (els.scmDiffInputs){
    els.scmDiffInputs.innerHTML = "";
    const maxShow = 12;
    const showKeys = diffKeys.slice(0, maxShow);
    for (const k of showKeys){
      const li = document.createElement("li");
      li.className = "diff-item";
      const head = document.createElement("div");
      head.className = "diff-k";
      head.textContent = labels[k] || k;
      const line = document.createElement("div");
      line.className = "diff-v";
      line.textContent = `${fmtV(k, baseInputs?.[k])} → ${fmtV(k, actInputs?.[k])}`;
      li.appendChild(head);
      li.appendChild(line);
      els.scmDiffInputs.appendChild(li);
    }
    const remaining = (diffKeys.length - showKeys.length) + otherChanged.length;
    if (els.scmDiffInputsFoot){
      els.scmDiffInputsFoot.textContent = remaining > 0
        ? `${remaining} more changed input(s) not shown.`
        : "";
    }
  }

  const computeKeyOut = (inputs) => {
    try{
      const snap = scenarioClone(inputs || {});
      const res = engine.computeAll(snap);
      const weeks = derivedWeeksRemainingFromState(snap);
      const ctx = computeWeeklyOpsContextFromSnap(snap, res, weeks);
      const finish = targetFinishDateFromSnap(snap, weeks);

      const last7 = computeLastNLogSums(7);
      const paceAttemptsPerDay = (last7?.hasLog && last7?.days && last7.days > 0) ? (last7.sumAttempts / last7.days) : null;
      const paceFinish = paceFinishDate(ctx?.attemptsNeeded, paceAttemptsPerDay);

      return {
        attemptsPerWeek: ctx?.attemptsPerWeek ?? null,
        convosPerWeek: ctx?.convosPerWeek ?? null,
        finishDate: finish,
        paceFinishDate: paceFinish,
      };
    } catch {
      return { attemptsPerWeek:null, convosPerWeek:null, finishDate:null, paceFinishDate:null };
    }
  };

  const baseOut = computeKeyOut(baseInputs);
  const actOut = computeKeyOut(actInputs);

  const fmtOutNum = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtOutDate = (d) => d ? fmtISODate(d) : "—";
  const fmtDeltaNum = (d) => (d == null || !isFinite(d) || d === 0) ? "—" : ((d > 0) ? `+${fmtInt(Math.round(d))}` : `${fmtInt(Math.round(d))}`);

  const deltaKindNumLowerIsBetter = (d) => {
    if (d == null || !isFinite(d) || d === 0) return null;
    return d < 0 ? "ok" : "bad";
  };

  const deltaKindDateEarlierIsBetter = (a, b) => {
    if (!a || !b) return null;
    const da = a.getTime();
    const db = b.getTime();
    if (!isFinite(da) || !isFinite(db) || da === db) return null;
    return db < da ? "ok" : "bad";
  };

  const rows = [
    {
      label: "Attempts/week",
      base: baseOut.attemptsPerWeek,
      act: actOut.attemptsPerWeek,
      delta: (actOut.attemptsPerWeek != null && baseOut.attemptsPerWeek != null) ? (actOut.attemptsPerWeek - baseOut.attemptsPerWeek) : null,
      kind: deltaKindNumLowerIsBetter((actOut.attemptsPerWeek != null && baseOut.attemptsPerWeek != null) ? (actOut.attemptsPerWeek - baseOut.attemptsPerWeek) : null),
      fmtBase: () => fmtOutNum(baseOut.attemptsPerWeek),
      fmtAct: () => fmtOutNum(actOut.attemptsPerWeek),
      fmtDelta: (d) => fmtDeltaNum(d),
    },
    {
      label: "Convos/week",
      base: baseOut.convosPerWeek,
      act: actOut.convosPerWeek,
      delta: (actOut.convosPerWeek != null && baseOut.convosPerWeek != null) ? (actOut.convosPerWeek - baseOut.convosPerWeek) : null,
      kind: deltaKindNumLowerIsBetter((actOut.convosPerWeek != null && baseOut.convosPerWeek != null) ? (actOut.convosPerWeek - baseOut.convosPerWeek) : null),
      fmtBase: () => fmtOutNum(baseOut.convosPerWeek),
      fmtAct: () => fmtOutNum(actOut.convosPerWeek),
      fmtDelta: (d) => fmtDeltaNum(d),
    },
    {
      label: "Finish date",
      baseDate: baseOut.finishDate,
      actDate: actOut.finishDate,
      kind: deltaKindDateEarlierIsBetter(baseOut.finishDate, actOut.finishDate),
      fmtBase: () => fmtOutDate(baseOut.finishDate),
      fmtAct: () => fmtOutDate(actOut.finishDate),
      fmtDelta: () => {
        if (!baseOut.finishDate || !actOut.finishDate) return "—";
        const dd = Math.round((actOut.finishDate.getTime() - baseOut.finishDate.getTime()) / (24*3600*1000));
        if (!isFinite(dd) || dd === 0) return "—";
        return dd > 0 ? `+${fmtInt(dd)}d` : `${fmtInt(dd)}d`;
      }
    },
    {
      label: "Pace finish (attempts)",
      baseDate: baseOut.paceFinishDate,
      actDate: actOut.paceFinishDate,
      kind: deltaKindDateEarlierIsBetter(baseOut.paceFinishDate, actOut.paceFinishDate),
      fmtBase: () => fmtOutDate(baseOut.paceFinishDate),
      fmtAct: () => fmtOutDate(actOut.paceFinishDate),
      fmtDelta: () => {
        if (!baseOut.paceFinishDate || !actOut.paceFinishDate) return "—";
        const dd = Math.round((actOut.paceFinishDate.getTime() - baseOut.paceFinishDate.getTime()) / (24*3600*1000));
        if (!isFinite(dd) || dd === 0) return "—";
        return dd > 0 ? `+${fmtInt(dd)}d` : `${fmtInt(dd)}d`;
      }
    },
  ];

  if (els.scmDiffOutputs){
    els.scmDiffOutputs.innerHTML = "";
    for (const r of rows){
      const tr = document.createElement("tr");
      const kind = r.kind;
      const deltaText = (typeof r.fmtDelta === "function") ? r.fmtDelta(r.delta) : "—";
      tr.innerHTML = `
        <td>${r.label}</td>
        <td class="num">${r.fmtBase()}</td>
        <td class="num">${r.fmtAct()}</td>
        <td class="num"><span class="delta ${kind || ""}">${deltaText}</span></td>
      `;
      els.scmDiffOutputs.appendChild(tr);
    }
  }

  const totalChanged = diffKeys.length + otherChanged.length;
  const outDelta = rows[0]?.delta;
  const overallKind = (outDelta == null || !isFinite(outDelta) || outDelta === 0) ? null : (outDelta < 0 ? "ok" : "bad");
  const tagText = `${totalChanged} input change(s)`;
  setCompareTag(overallKind, tagText);
}

function renderScenarioManagerC1(){
  ensureScenarioRegistry();

  const reg = state.ui.scenarios;
  const activeId = state.ui.activeScenarioId;
  const selectedId = state.ui.scenarioUiSelectedId;

  if (els.activeScenarioLabel){
    const active = reg[activeId];
    els.activeScenarioLabel.textContent = `Active Scenario: ${active ? (active.name || active.id) : "—"}`;
  }

  if (els.scenarioSelect){
    const list = listScenarioRecords();
    els.scenarioSelect.innerHTML = "";
    for (const s of list){
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      els.scenarioSelect.appendChild(opt);
    }
    els.scenarioSelect.value = reg[selectedId] ? selectedId : activeId;
  }

  if (els.btnScenarioDelete){
    const canDel = selectedId && selectedId !== SCENARIO_BASELINE_ID && !!reg[selectedId];
    els.btnScenarioDelete.disabled = !canDel;
  }

  if (els.btnScenarioLoadSelected){
    const canLoad = selectedId && !!reg[selectedId] && selectedId !== activeId;
    els.btnScenarioLoadSelected.disabled = !canLoad;
  }

  if (els.btnScenarioReturnBaseline){
    els.btnScenarioReturnBaseline.disabled = (activeId === SCENARIO_BASELINE_ID);
  }

  const count = Object.keys(reg).length;
  if (count > SCENARIO_MAX){
    setScenarioWarn(`Scenario limit exceeded (${count}/${SCENARIO_MAX}). Delete scenarios to stay under the cap.`);
  } else {
    setScenarioWarn(null);
  }

  renderScenarioComparisonC3();
}

// =========================
// Phase D1 — Decision Session Scaffold (UI + state only)
// =========================

const OBJECTIVE_TEMPLATES = [
  { key: "win_prob", label: "Maximize win probability" },
  { key: "finish_date", label: "Finish earlier" },
  { key: "exec_feasible", label: "Maximize feasibility" },
  { key: "budget_eff", label: "Improve budget efficiency" },
  { key: "balanced", label: "Balanced (risk-aware)" },
];

const RISK_POSTURES = [
  { key: "cautious", label: "Cautious" },
  { key: "balanced", label: "Balanced" },
  { key: "aggressive", label: "Aggressive" },
];


function makeDecisionSessionId(){
  return "ds_" + uid() + Date.now().toString(16);
}
function makeDecisionOptionId(){
  return "do_" + uid() + Date.now().toString(16);
}

function ensureDecisionOptionShape(o){
  if (!o || typeof o !== "object") return;
  if (!o.tactics || typeof o.tactics !== "object") o.tactics = {};
  const t = o.tactics;
  if (t.doors === undefined) t.doors = false;
  if (t.phones === undefined) t.phones = false;
  if (t.digital === undefined) t.digital = false;
}

function ensureDecisionSessionShape(s){
  if (!s || typeof s !== "object") return;

  if (!s.constraints || typeof s.constraints !== "object") s.constraints = {};
  const c = s.constraints;
  if (c.budget === undefined) c.budget = null;
  if (c.volunteerHrs === undefined) c.volunteerHrs = null;
  if (c.turfAccess === undefined) c.turfAccess = "";
  if (c.blackoutDates === undefined) c.blackoutDates = "";

  if (s.riskPosture === undefined) s.riskPosture = "balanced";
  if (!Array.isArray(s.nonNegotiables)) s.nonNegotiables = [];
  if (!Array.isArray(s.whatNeedsTrue)) s.whatNeedsTrue = [];
  if (s.recommendedOptionId === undefined) s.recommendedOptionId = null;

  if (!s.options || typeof s.options !== "object") s.options = {};
  for (const k of Object.keys(s.options)){
    ensureDecisionOptionShape(s.options[k]);
  }
  if (s.activeOptionId && !s.options[s.activeOptionId]) s.activeOptionId = null;
}


function ensureDecisionScaffold(){
  if (!state) return;
  if (!state.ui) state.ui = {};
  const d = (state.ui.decision && typeof state.ui.decision === "object") ? state.ui.decision : null;
  if (!d){
    state.ui.decision = { sessions: {}, activeSessionId: null };
  }
  if (!state.ui.decision.sessions || typeof state.ui.decision.sessions !== "object"){
    state.ui.decision.sessions = {};
  }

  const ids = Object.keys(state.ui.decision.sessions);
  for (const k of ids){
    ensureDecisionSessionShape(state.ui.decision.sessions[k]);
  }
  if (!ids.length){
    const id = makeDecisionSessionId();
    state.ui.decision.sessions[id] = {
      id,
      name: "Decision Session",
      createdAt: new Date().toISOString(),
      scenarioId: state.ui.activeScenarioId || SCENARIO_BASELINE_ID,
      objectiveKey: OBJECTIVE_TEMPLATES[0].key,
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
    return;
  }

  const active = state.ui.decision.activeSessionId;
  if (!active || !state.ui.decision.sessions[active]){
    state.ui.decision.activeSessionId = ids[0];
  }
}

function getActiveDecisionSession(){
  ensureDecisionScaffold();
  const id = state.ui?.decision?.activeSessionId;
  const s = (id && state.ui?.decision?.sessions) ? state.ui.decision.sessions[id] : null;
  return s || null;
}

function listDecisionSessions(){
  ensureDecisionScaffold();
  const sessions = state.ui.decision.sessions || {};
  const arr = Object.values(sessions);
  arr.sort((a,b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
  return arr;
}

function decisionScenarioLabel(scenarioId){
  ensureScenarioRegistry();
  const reg = state.ui.scenarios || {};
  const rec = scenarioId ? reg[scenarioId] : null;
  if (!scenarioId) return "—";
  if (rec) return `${rec.name || rec.id} (${rec.id})`;
  return String(scenarioId);
}

function renderDecisionSessionD1(){
  if (!els.decisionSessionSelect && !els.decisionActiveLabel) return;
  ensureDecisionScaffold();
  const sessions = listDecisionSessions();
  const activeId = state.ui.decision.activeSessionId;
  const active = getActiveDecisionSession();
  ensureDecisionSessionShape(active);

  if (els.decisionSessionSelect){
    els.decisionSessionSelect.innerHTML = "";
    for (const s of sessions){
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      els.decisionSessionSelect.appendChild(opt);
    }
    els.decisionSessionSelect.value = activeId;
  }

  if (els.decisionActiveLabel){
    els.decisionActiveLabel.textContent = active ? `Active session: ${active.name || active.id}` : "Active session: —";
  }

  if (els.decisionRename){
    els.decisionRename.value = active?.name || "";
  }

  if (els.decisionObjective){
    els.decisionObjective.innerHTML = "";
    for (const o of OBJECTIVE_TEMPLATES){
      const opt = document.createElement("option");
      opt.value = o.key;
      opt.textContent = o.label;
      els.decisionObjective.appendChild(opt);
    }
    els.decisionObjective.value = active?.objectiveKey || OBJECTIVE_TEMPLATES[0].key;
  }

  if (els.decisionNotes){
    els.decisionNotes.value = active?.notes || "";
  }


  if (els.decisionBudget){
    const v = active?.constraints?.budget;
    els.decisionBudget.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionVolunteerHrs){
    const v = active?.constraints?.volunteerHrs;
    els.decisionVolunteerHrs.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionTurfAccess){
    els.decisionTurfAccess.value = String(active?.constraints?.turfAccess || "");
  }

  if (els.decisionBlackoutDates){
    els.decisionBlackoutDates.value = String(active?.constraints?.blackoutDates || "");
  }

  if (els.decisionRiskPosture){
    if (!els.decisionRiskPosture.options.length){
      for (const rp of RISK_POSTURES){
        const opt = document.createElement("option");
        opt.value = rp.key;
        opt.textContent = rp.label;
        els.decisionRiskPosture.appendChild(opt);
      }
    }
    els.decisionRiskPosture.value = String(active?.riskPosture || "balanced");
  }

  if (els.decisionNonNegotiables){
    const lines = Array.isArray(active?.nonNegotiables) ? active.nonNegotiables : [];
    els.decisionNonNegotiables.value = lines.join("\n");
  }

  if (els.decisionScenarioLabel){
    els.decisionScenarioLabel.textContent = decisionScenarioLabel(active?.scenarioId || null);
  }

  if (els.btnDecisionDelete){
    els.btnDecisionDelete.disabled = sessions.length <= 1;
  }


  renderDecisionOptionsD3(active);
  renderDecisionSummaryD4(active);
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
  if (!els.decisionOptionSelect) return;
  if (!session) return;

  ensureDecisionSessionShape(session);

  const options = listDecisionOptions(session);
  const active = getActiveDecisionOption(session);

  els.decisionOptionSelect.innerHTML = "";
  if (!options.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No options yet";
    els.decisionOptionSelect.appendChild(opt);
    els.decisionOptionSelect.value = "";
  } else {
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label || o.id;
      els.decisionOptionSelect.appendChild(opt);
    }
    els.decisionOptionSelect.value = session.activeOptionId || options[0].id;
    if (!session.activeOptionId) session.activeOptionId = els.decisionOptionSelect.value;
  }

  const has = !!active;

  if (els.decisionOptionRename){
    els.decisionOptionRename.value = has ? String(active.label || "") : "";
    els.decisionOptionRename.disabled = !has;
  }

  if (els.btnDecisionOptionRenameSave) els.btnDecisionOptionRenameSave.disabled = !has;
  if (els.btnDecisionOptionDelete) els.btnDecisionOptionDelete.disabled = options.length <= 1;
  if (els.btnDecisionOptionLinkScenario) els.btnDecisionOptionLinkScenario.disabled = !has;

  if (els.decisionOptionScenarioLabel){
    els.decisionOptionScenarioLabel.textContent = has ? decisionScenarioLabel(active.scenarioId || null) : "—";
  }

  const t = has ? (active.tactics || {}) : {};
  if (els.decisionOptionTacticDoors){
    els.decisionOptionTacticDoors.checked = !!t.doors;
    els.decisionOptionTacticDoors.disabled = !has;
  }
  if (els.decisionOptionTacticPhones){
    els.decisionOptionTacticPhones.checked = !!t.phones;
    els.decisionOptionTacticPhones.disabled = !has;
  }
  if (els.decisionOptionTacticDigital){
    els.decisionOptionTacticDigital.checked = !!t.digital;
    els.decisionOptionTacticDigital.disabled = !has;
  }
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
  if (!s) return;

  if (els.decisionRecommendSelect){
    els.decisionRecommendSelect.innerHTML = "";
    const options = (s.options && typeof s.options === "object") ? Object.values(s.options) : [];
    options.sort((a,b) => String(a?.createdAt||"").localeCompare(String(b?.createdAt||"")));
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "—";
    els.decisionRecommendSelect.appendChild(ph);
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = decisionOptionDisplay(o);
      els.decisionRecommendSelect.appendChild(opt);
    }
    els.decisionRecommendSelect.value = s.recommendedOptionId || "";
  }

  if (els.decisionWhatTrue){
    const lines = Array.isArray(s.whatNeedsTrue) ? s.whatNeedsTrue : [];
    els.decisionWhatTrue.value = lines.join("\n");
  }

  if (els.decisionSummaryPreview){
    els.decisionSummaryPreview.value = buildDecisionSummaryText(s);
  }
}


// =========================
// Phase 15 — Sensitivity Surface (on-demand)
// =========================

function surfaceLeverSpec(key){
  const k = String(key || "");
  const specs = {
    volunteerMultiplier: { label: "Volunteer multiplier", stateKey: "volunteerMultBase", clampLo: 0.1, clampHi: 6.0, step: 0.01, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(2) },
    supportRate: { label: "Support rate (%)", stateKey: "supportRatePct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(1) },
    contactRate: { label: "Contact rate (%)", stateKey: "contactRatePct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(1) },
    turnoutReliability: { label: "Turnout reliability (%)", stateKey: "turnoutReliabilityPct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(1) },
  };
  return specs[k] || null;
}

function surfaceClamp(v, lo, hi){
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function surfaceBaselineValue(spec){
  if (!spec) return null;
  const v = Number(state?.[spec.stateKey]);
  if (Number.isFinite(v)) return v;
  // fallbacks aligned with MC defaults
  if (spec.stateKey === "supportRatePct") return 55;
  if (spec.stateKey === "contactRatePct") return 22;
  if (spec.stateKey === "turnoutReliabilityPct") return 80;
  if (spec.stateKey === "volunteerMultBase") return 1.0;
  return null;
}

function applySurfaceDefaults(){
  if (!els.surfaceLever || !els.surfaceMin || !els.surfaceMax) return;
  const spec = surfaceLeverSpec(els.surfaceLever.value);
  if (!spec) return;

  const base = surfaceBaselineValue(spec);
  const lo = (base != null) ? (base * 0.8) : spec.clampLo;
  const hi = (base != null) ? (base * 1.2) : spec.clampHi;

  const minV = surfaceClamp(lo, spec.clampLo, spec.clampHi);
  const maxV = surfaceClamp(hi, spec.clampLo, spec.clampHi);

  els.surfaceMin.step = String(spec.step);
  els.surfaceMax.step = String(spec.step);

  els.surfaceMin.value = String(minV);
  els.surfaceMax.value = String(maxV);
}

function renderSurfaceStub(){
  if (!els.surfaceTbody) return;
  els.surfaceTbody.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td></tr>';
  if (els.surfaceSummary) els.surfaceSummary.textContent = "Compute to see safe zones, cliffs, and diminishing returns.";
  if (els.surfaceStatus) els.surfaceStatus.textContent = "";
}

function renderSurfaceResult({ spec, result }){
  if (!els.surfaceTbody) return;

  const pts = Array.isArray(result?.points) ? result.points : [];
  const analysis = result?.analysis || null;

  els.surfaceTbody.innerHTML = "";
  if (!pts.length){
    renderSurfaceStub();
    if (els.surfaceSummary) els.surfaceSummary.textContent = result?.warning ? String(result.warning) : "No points returned.";
    return;
  }

  for (const p of pts){
    const tr = document.createElement("tr");

    const td0 = document.createElement("td");
    td0.textContent = spec?.fmt ? spec.fmt(p.leverValue) : String(p.leverValue);

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = (p.winProb == null || !isFinite(p.winProb)) ? "—" : `${(p.winProb * 100).toFixed(1)}%`;

    const td2 = document.createElement("td"); td2.className = "num"; td2.textContent = fmtSigned(p.p10);
    const td3 = document.createElement("td"); td3.className = "num"; td3.textContent = fmtSigned(p.p50);
    const td4 = document.createElement("td"); td4.className = "num"; td4.textContent = fmtSigned(p.p90);

    tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    els.surfaceTbody.appendChild(tr);
  }

  const parts = [];
  const T = Number(els.surfaceTarget?.value);
  const target = (Number.isFinite(T) ? (T/100) : 0.70);

  if (analysis?.safeZone){
    const z = analysis.safeZone;
    parts.push(`Safe zone (≥ ${Math.round(target*100)}%): ${spec.fmt(z.min)} to ${spec.fmt(z.max)}`);
  } else {
    parts.push(`Safe zone (≥ ${Math.round(target*100)}%): none`);
  }

  const cliffs = Array.isArray(analysis?.cliffPoints) ? analysis.cliffPoints : [];
  if (cliffs.length){
    const xs = cliffs.slice(0, 3).map(c => spec.fmt(c.at)).join(", ");
    parts.push(`Cliff edges: ${xs}${cliffs.length > 3 ? "…" : ""}`);
  } else {
    parts.push("Cliff edges: none");
  }

  const dims = Array.isArray(analysis?.diminishingZones) ? analysis.diminishingZones : [];
  if (dims.length){
    const r = dims[0];
    parts.push(`Diminishing returns: ${spec.fmt(r.min)} to ${spec.fmt(r.max)}${dims.length > 1 ? "…" : ""}`);
  } else {
    parts.push("Diminishing returns: none");
  }

  const fr = Array.isArray(analysis?.fragilityPoints) ? analysis.fragilityPoints : [];
  if (fr.length){
    const xs = fr.slice(0, 3).map(c => spec.fmt(c.at)).join(", ");
    parts.push(`Fragility points: ${xs}${fr.length > 3 ? "…" : ""}`);
  } else {
    parts.push("Fragility points: none");
  }

  if (els.surfaceSummary) els.surfaceSummary.textContent = parts.join(" • ");
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

function formatMcTimestamp(ts){
  if (!ts) return "—";
  const d = new Date(ts);
  if (!isFinite(d.getTime())) return String(ts);
  try{
    return d.toLocaleString();
  } catch {
    return d.toISOString();
  }
}

function computeDailyLogHash(){
  const raw = (state && state.ui && Array.isArray(state.ui.dailyLog)) ? state.ui.dailyLog : [];
  const norm = raw.map(normalizeDailyLogEntry).filter(Boolean).map(e => ({
    date: e.date,
    doors: e.doors,
    calls: e.calls,
    attempts: e.attempts,
    convos: e.convos,
    supportIds: e.supportIds,
    orgHours: e.orgHours,
    volsActive: e.volsActive,
    notes: e.notes,
    updatedAt: e.updatedAt,
  }));
  norm.sort((a,b) => String(a.date).localeCompare(String(b.date)));
  return computeSnapshotHash({ modelVersion: "", scenarioState: { ui: { dailyLog: norm } } });
}

function renderMcFreshness(res, weeks){
  if (!els.mcFreshTag && !els.mcLastRun && !els.mcStale) return;

  const has = !!state.mcLast;
  const meta = (state.ui && state.ui.mcMeta && typeof state.ui.mcMeta === "object") ? state.ui.mcMeta : null;

  if (els.mcRerun) els.mcRerun.disabled = !has;
  if (els.mcRerunSidebar) els.mcRerunSidebar.disabled = !has;

  if (!has){
    if (els.mcFreshTag){
      setTextPair(els.mcFreshTag, els.mcFreshTagSidebar, "Not run");
      els.mcFreshTag.classList.remove("ok","warn","bad");
      els.mcFreshTag.classList.add("warn");
    }
    if (els.mcLastRun) setTextPair(els.mcLastRun, els.mcLastRunSidebar, "Last run: —");
    if (els.mcStale) setHidden(els.mcStale, true); setHidden(els.mcStaleSidebar, true);
    return;
  }

  const hNow = hashMcInputs(res, weeks);
  const inputsAtRun = meta && meta.inputsHash ? String(meta.inputsHash) : String(state.mcLastHash || "");
  const logAtRun = meta && meta.dailyLogHash ? String(meta.dailyLogHash) : "";
  const logNow = computeDailyLogHash();

  const staleInputs = !!inputsAtRun && inputsAtRun !== hNow;
  const staleLog = !!logAtRun && logAtRun !== logNow;

  let status = "Fresh";
  let cls = "ok";
  if (staleInputs){
    status = "Stale: inputs changed";
    cls = "warn";
  } else if (staleLog){
    status = "Stale: execution updated";
    cls = "warn";
  }

  if (els.mcFreshTag){
    setTextPair(els.mcFreshTag, els.mcFreshTagSidebar, status);
    els.mcFreshTag.classList.remove("ok","warn","bad");
    els.mcFreshTag.classList.add(cls);
  }

  if (els.mcLastRun){
    const ts = meta && meta.lastRunAt ? meta.lastRunAt : "";
    setTextPair(els.mcLastRun, els.mcLastRunSidebar, `Last run: ${formatMcTimestamp(ts)}`);
  }

  if (els.mcStale){
    setHidden(els.mcStale, !(staleInputs || staleLog)); setHidden(els.mcStaleSidebar, !(staleInputs || staleLog));
  }

  renderOpsEnvelopeD2(res, weeks);
  renderFinishEnvelopeD3(res, weeks);
  renderMissRiskD4(res, weeks);
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
    buildAdvancedSpecs,
    buildBasicSpecs,
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
    quantileSorted,
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
    buildAdvancedSpecs,
    buildBasicSpecs,
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
    quantileSorted,
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
    buildAdvancedSpecs,
    buildBasicSpecs,
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
  const needVotes = deriveNeedVotes(res);
  const payload = {
    weeks,
    needVotes,
    // Capacity
    orgCount: safeNum(state.orgCount),
    orgHoursPerWeek: safeNum(state.orgHoursPerWeek),
    volunteerMultBase: safeNum(state.volunteerMultBase),
    channelDoorPct: safeNum(state.channelDoorPct),
    doorsPerHour3: canonicalDoorsPerHourFromSnap(state),
    callsPerHour3: safeNum(state.callsPerHour3),
    // Base rates (Phase 2 + p3)
    contactRatePct: safeNum(state.contactRatePct),
    supportRatePct: safeNum(state.supportRatePct),
    turnoutReliabilityPct: safeNum(state.turnoutReliabilityPct),

    // Phase 16 — universe composition + retention
    universeLayerEnabled: !!state.universeLayerEnabled,
    universeDemPct: safeNum(state.universeDemPct),
    universeRepPct: safeNum(state.universeRepPct),
    universeNpaPct: safeNum(state.universeNpaPct),
    universeOtherPct: safeNum(state.universeOtherPct),
    retentionFactor: safeNum(state.retentionFactor),

    // Phase 6 — turnout / GOTV
    turnoutEnabled: !!state.turnoutEnabled,
    turnoutBaselinePct: safeNum(state.turnoutBaselinePct),
    turnoutTargetOverridePct: state.turnoutTargetOverridePct ?? "",
    gotvMode: state.gotvMode || "basic",
    gotvLiftPP: safeNum(state.gotvLiftPP),
    gotvMaxLiftPP: safeNum(state.gotvMaxLiftPP),
    gotvDiminishing: !!state.gotvDiminishing,
    gotvLiftMin: safeNum(state.gotvLiftMin),
    gotvLiftMode: safeNum(state.gotvLiftMode),
    gotvLiftMax: safeNum(state.gotvLiftMax),
    gotvMaxLiftPP2: safeNum(state.gotvMaxLiftPP2),
    gotvDiminishing2: !!state.gotvDiminishing2,
    // MC config
    mcMode: state.mcMode || "basic",
    mcVolatility: state.mcVolatility || "med",
    mcSeed: state.mcSeed || "",
    // Advanced ranges
    mcContactMin: safeNum(state.mcContactMin),
    mcContactMode: safeNum(state.mcContactMode),
    mcContactMax: safeNum(state.mcContactMax),
    mcPersMin: safeNum(state.mcPersMin),
    mcPersMode: safeNum(state.mcPersMode),
    mcPersMax: safeNum(state.mcPersMax),
    mcReliMin: safeNum(state.mcReliMin),
    mcReliMode: safeNum(state.mcReliMode),
    mcReliMax: safeNum(state.mcReliMax),
    mcDphMin: safeNum(state.mcDphMin),
    mcDphMode: safeNum(state.mcDphMode),
    mcDphMax: safeNum(state.mcDphMax),
    mcCphMin: safeNum(state.mcCphMin),
    mcCphMode: safeNum(state.mcCphMode),
    mcCphMax: safeNum(state.mcCphMax),
    mcVolMin: safeNum(state.mcVolMin),
    mcVolMode: safeNum(state.mcVolMode),
    mcVolMax: safeNum(state.mcVolMax),
  };
  return JSON.stringify(payload);
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
  // Need render context for persuasion need.
  const weeks = derivedWeeksRemaining();
  const modelInput = buildModelInputFromState(state, safeNum);
  const res = engine.computeAll(modelInput);

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  const needVotes = deriveNeedVotes(res);

  const h = hashMcInputs(res, w);

  const sim = runMonteCarloSim({ res, weeks: w, needVotes, runs: 10000, seed: state.mcSeed || "" });

  state.mcLast = sim;
  state.mcLastHash = h;

  if (!state.ui) state.ui = {};
  state.ui.mcMeta = {
    lastRunAt: new Date().toISOString(),
    inputsHash: h,
    dailyLogHash: computeDailyLogHash(),
  };

  persist();
  clearMcStale();
  renderMcResults(sim);
  renderMcFreshness(res, w);
}

function runMonteCarloSim({ scenario, scenarioState, res, weeks, needVotes, runs, seed }){
  // Delegated to core Monte Carlo via facade (no loops in UI).
  return engine.runMonteCarlo({ scenario: scenario || scenarioState || state, res, weeks, needVotes, runs, seed });
}

function buildBasicSpecs({ baseCr, basePr, baseRr, baseDph, baseCph, baseVol, volBoost = 0 }){
  const v = (state.mcVolatility || "med");
  const w = (v === "low") ? 0.10 : (v === "high") ? 0.30 : 0.20;

  return {
    contactRate: spread(baseCr, w, 0, 1),
    persuasionRate: spread(basePr, w + (volBoost || 0), 0, 1),
    turnoutReliability: spread(baseRr, w + (volBoost || 0), 0, 1),
    doorsPerHour: spread(baseDph, w, 0.01, Infinity),
    callsPerHour: spread(baseCph, w, 0.01, Infinity),
    volunteerMult: spread(baseVol, w, 0.01, Infinity),
  };
}

function buildAdvancedSpecs({ baseCr, basePr, baseRr, baseDph, baseCph, baseVol, volBoost = 0 }){
  // Inputs are in % for rates and raw for productivity/multiplier.
  const cr = triFromPctInputs(state.mcContactMin, state.mcContactMode, state.mcContactMax, baseCr);
  const pr0 = triFromPctInputs(state.mcPersMin, state.mcPersMode, state.mcPersMax, basePr);
  const rr0 = triFromPctInputs(state.mcReliMin, state.mcReliMode, state.mcReliMax, baseRr);

  // Phase 16 — widen triangle slightly when retention is low (tiny, capped)
  const widen = (tri, boost) => {
    if (!tri || tri.min == null || tri.mode == null || tri.max == null) return tri;
    const b = Math.max(0, Number(boost) || 0);
    if (b <= 0) return tri;
    const mid = tri.mode;
    const span = (tri.max - tri.min);
    const extra = span * b;
    return {
      min: Math.max(0, tri.min - extra),
      mode: Math.min(1, Math.max(0, mid)),
      max: Math.min(1, tri.max + extra)
    };
  };

  const pr = widen(pr0, volBoost);
  const rr = widen(rr0, volBoost);

  const dph = triFromNumInputs(state.mcDphMin, state.mcDphMode, state.mcDphMax, baseDph, 0.01);
  const cph = triFromNumInputs(state.mcCphMin, state.mcCphMode, state.mcCphMax, baseCph, 0.01);
  const vm = triFromNumInputs(state.mcVolMin, state.mcVolMode, state.mcVolMax, baseVol, 0.01);

  return {
    contactRate: cr,
    persuasionRate: pr,
    turnoutReliability: rr,
    doorsPerHour: dph,
    callsPerHour: cph,
    volunteerMult: vm,
  };
}

function renderMcResults(summary){
  renderMcResultsModule({
    els,
    summary,
    setTextPair,
    fmtSigned,
    fmtInt,
    renderMcVisuals,
  });
}

function renderMcVisuals(summary){
  renderMcVisualsModule({
    els,
    summary,
    clamp,
    fmtSigned,
  });
}

function riskLabelFromWinProb(p){
  if (p >= 0.85) return "Strong structural position";
  if (p >= 0.65) return "Favored but fragile";
  if (p >= 0.50) return "Toss-up";
  return "Structural underdog";
}

function pctToUnit(v, fallback){
  if (v == null || !isFinite(v)) return fallback;
  return clamp(v, 0, 100) / 100;
}

function spread(base, w, minClamp, maxClamp){
  const mode = base;
  const min = clamp(base * (1 - w), minClamp, maxClamp);
  const max = clamp(base * (1 + w), minClamp, maxClamp);
  return normalizeTri({ min, mode, max });
}

function triFromPctInputs(minIn, modeIn, maxIn, baseUnit){
  const fallbackMode = baseUnit;
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null) ? clamp(modeV, 0, 100) / 100 : fallbackMode;
  const min = (minV != null) ? clamp(minV, 0, 100) / 100 : clamp(mode * 0.8, 0, 1);
  const max = (maxV != null) ? clamp(maxV, 0, 100) / 100 : clamp(mode * 1.2, 0, 1);

  return normalizeTri({ min, mode, max });
}

function triFromNumInputs(minIn, modeIn, maxIn, base, floor){
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null && modeV > 0) ? modeV : base;
  const min = (minV != null && minV > 0) ? minV : Math.max(floor, mode * 0.8);
  const max = (maxV != null && maxV > 0) ? maxV : Math.max(min + floor, mode * 1.2);

  return normalizeTri({ min, mode, max });
}

function normalizeTri({ min, mode, max }){
  let a = min, b = mode, c = max;
  if (!isFinite(a)) a = 0;
  if (!isFinite(b)) b = 0;
  if (!isFinite(c)) c = 0;

  // Enforce ordering
  const lo = Math.min(a, b, c);
  const hi = Math.max(a, b, c);
  // keep mode inside
  b = clamp(b, lo, hi);
  return { min: lo, mode: b, max: hi };
}

function quantileSorted(sorted, q){
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] == null) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function sum(arr){
  let s = 0;
  for (let i=0;i<arr.length;i++) s += arr[i];
  return s;
}

function mean(arr){
  if (!arr || arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

function fmtSigned(v){
  if (v == null || !isFinite(v)) return "—";
  const n = Math.round(v);
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtInt(Math.abs(n))}`;
}

function computeSensitivity(samples, margins){
  // Pearson correlation between each variable and margin; return absolute impact.
  const out = [];

  const vars = [
    ["Turnout reliability", samples.turnoutReliability],
    ["Persuasion rate", samples.persuasionRate],
    ["Organizer productivity (doors/hr)", samples.doorsPerHour],
    ["Organizer productivity (calls/hr)", samples.callsPerHour],
    ["Contact rate", samples.contactRate],
    ["Volunteer multiplier", samples.volunteerMult],
  ];

  for (const [label, xs] of vars){
    const r = pearson(xs, margins);
    out.push({ label, impact: (r == null) ? null : Math.abs(r) });
  }

  out.sort((a,b) => (b.impact ?? -1) - (a.impact ?? -1));
  return out;
}

function pearson(xs, ys){
  const n = xs.length;
  if (!n || ys.length !== n) return null;

  let sumX=0, sumY=0;
  for (let i=0;i<n;i++){ sumX += xs[i]; sumY += ys[i]; }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num=0, denX=0, denY=0;
  for (let i=0;i<n;i++){
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (!isFinite(den) || den === 0) return null;
  return num / den;
}
