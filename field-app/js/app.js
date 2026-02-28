import { engine } from "./engine.js";
import { computeCapacityContacts as coreComputeCapacityContacts, computeCapacityBreakdown as coreComputeCapacityBreakdown } from "./core/model.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS, computeUniverseAdjustedRates } from "./core/universeLayer.js";
import { computeAvgLiftPP } from "./core/turnout.js";
import { fmtInt, clamp, safeNum, daysBetween, readJsonFile } from "./utils.js";
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
import { wireBudgetTimelineEvents } from "./app/wireEvents.js";
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
        const merged = appendOperationsDiagnostics(lines, tw);
        if (els.diagErrors) els.diagErrors.textContent = merged.join("\n");
      })
      .catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

async function copyDebugBundle(){
  const tw = await getOperationsDiagnosticsSnapshot();
  const bundle = {
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    scenarioName: state?.scenarioName || "",
    lastExportHash: lastExportHash || null,
    recentErrors: recentErrors.slice(0, MAX_ERRORS),
    operationsDiagnostics: tw,
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
  try{
    const required = [
      "scenarioName",
      "buildStamp",
      "selfTestGate",
      "btnDiagnostics",
      "diagModal",
      "diagErrors",
      "btnDiagClose",
      "btnCopyDebug",
      "raceType",
      "electionDate",
      "weeksRemaining",
      "mode",
      "universeSize",
      "turnoutA",
      "turnoutB",
      "bandWidth",
      "btnAddCandidate",
      "yourCandidate",
      "candTbody",
      "undecidedPct",
      "undecidedMode",
      "persuasionPct",
      "earlyVoteExp",
    ];
    const missing = required.filter((k) => els[k] == null);
    if (missing.length) recordError("dom-preflight", `Missing required element(s): ${missing.join(", ")}`);
  } catch { /* ignore */ }
}


const DEFAULTS_BY_TEMPLATE = {
  federal: { bandWidth: 4, persuasionPct: 28, earlyVoteExp: 45 },
  state_leg: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 38 },
  municipal: { bandWidth: 5, persuasionPct: 35, earlyVoteExp: 35 },
  county: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 40 },
};

function approxEq(a, b, eps = 1e-6){
  return Math.abs(a - b) <= eps;
}

function applyTemplateDefaultsForRace(targetState, raceType, { force = false } = {}){
  if (!targetState || typeof targetState !== "object") return;
  const key = String(raceType || targetState.raceType || "state_leg");
  const defs = DEFAULTS_BY_TEMPLATE[key] || DEFAULTS_BY_TEMPLATE.state_leg;

  if (force || (targetState.bandWidth == null || targetState.bandWidth === "")){
    targetState.bandWidth = defs.bandWidth;
  }
  if (force || (targetState.persuasionPct == null || targetState.persuasionPct === "")){
    targetState.persuasionPct = defs.persuasionPct;
  }
  if (force || (targetState.earlyVoteExp == null || targetState.earlyVoteExp === "")){
    targetState.earlyVoteExp = defs.earlyVoteExp;
  }
}

function deriveAssumptionsProfileFromState(snap){
  const s = snap || {};
  const raceKey = String(s.raceType || "state_leg");
  const defs = DEFAULTS_BY_TEMPLATE[raceKey] || DEFAULTS_BY_TEMPLATE.state_leg;
  const bw = safeNum(s.bandWidth);
  const pp = safeNum(s.persuasionPct);
  const ev = safeNum(s.earlyVoteExp);

  const isTemplateLike =
    bw != null && pp != null && ev != null &&
    approxEq(bw, defs.bandWidth) &&
    approxEq(pp, defs.persuasionPct) &&
    approxEq(ev, defs.earlyVoteExp);

  const explicit = s?.ui?.assumptionsProfile;
  if (explicit === "template" || explicit === "custom"){
    if (explicit === "template" && !isTemplateLike) return "custom";
    return explicit;
  }
  return isTemplateLike ? "template" : "custom";
}

function refreshAssumptionsProfile(){
  if (!state.ui) state.ui = {};
  state.ui.assumptionsProfile = deriveAssumptionsProfileFromState(state);
}

function assumptionsProfileLabel(src = state){
  const s = src || {};
  const profile = (s?.ui?.assumptionsProfile === "template") ? "template" : "custom";
  if (profile === "template"){
    return `Template (${labelTemplate(s.raceType)})`;
  }
  return "Custom overrides";
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
  try{
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch {
    return false;
  }
}

function normalizeThemeMode(){
  if (!state.ui) state.ui = {};
  if (state.ui.themeMode !== "system" && state.ui.themeMode !== "dark" && state.ui.themeMode !== "light"){
    // migrate legacy boolean to new mode
    state.ui.themeMode = (state.ui.dark === true) ? "dark" : "system";
  }
}

function computeThemeIsDark(){
  const mode = state.ui?.themeMode || "system";
  if (mode === "dark") return true;
  if (mode === "light") return false; // legacy/compat if ever present
  return systemPrefersDark();
}

function applyThemeFromState(){
  normalizeThemeMode();
  const isDark = computeThemeIsDark();

  document.body.classList.toggle("dark", !!isDark);

  // The hidden checkbox is treated as an override control (checked => force dark).
  // We keep it in sync so code that expects it doesn't break.
  if (els.toggleDark){
    els.toggleDark.checked = (state.ui.themeMode === "dark");
  }

  // Legacy flag remains updated for older code paths (represents the *effective* theme).
  state.ui.dark = !!isDark;
}

function initThemeSystemListener(){
  try{
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((state.ui?.themeMode || "system") === "system"){
        applyThemeFromState();
        // do NOT persist on OS changes; keeps exports/diffs stable
      }
    };
    if (mq && mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq && mq.addListener) mq.addListener(handler);
  } catch {}
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
  if (!els.persistenceStatus) return;
  const stateIssue = !persistenceState.stateSaveOk;
  const backupIssue = !persistenceState.backupSaveOk;
  if (!stateIssue && !backupIssue){
    els.persistenceStatus.hidden = true;
    els.persistenceStatus.textContent = "Save issue";
    els.persistenceStatus.title = "";
    return;
  }
  els.persistenceStatus.hidden = false;
  if (stateIssue){
    els.persistenceStatus.textContent = "State save issue";
    els.persistenceStatus.title = persistenceState.stateError || "Could not save planner state.";
    return;
  }
  els.persistenceStatus.textContent = "Backup save issue";
  els.persistenceStatus.title = persistenceState.backupError || "Could not save backup snapshot.";
}

function reportPersistenceFailure(scope, result){
  const msg = String(result?.error || "Unknown persistence error");
  if (scope === "state"){
    persistenceState.stateSaveOk = false;
    persistenceState.stateError = msg;
  } else {
    persistenceState.backupSaveOk = false;
    persistenceState.backupError = msg;
  }
  const sig = `${scope}:${result?.code || "unknown"}:${msg}`;
  if (sig !== persistenceErrorSig){
    persistenceErrorSig = sig;
    recordError("persistence", `${scope} save failed: ${msg}`, { code: result?.code || "unknown" });
  }
  updatePersistenceStatusChip();
}

function clearPersistenceFailure(scope){
  if (scope === "state"){
    persistenceState.stateSaveOk = true;
    persistenceState.stateError = "";
  } else {
    persistenceState.backupSaveOk = true;
    persistenceState.backupError = "";
  }
  if (persistenceState.stateSaveOk && persistenceState.backupSaveOk){
    persistenceErrorSig = "";
  }
  updatePersistenceStatusChip();
}

const PERSIST_DEBOUNCE_MS = 220;
let renderQueued = false;
let persistQueuedTimer = null;

function scheduleRender(){
  if (renderQueued) return;
  renderQueued = true;
  const flush = () => {
    renderQueued = false;
    render();
  };
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"){
    window.requestAnimationFrame(flush);
    return;
  }
  setTimeout(flush, 0);
}

function schedulePersist({ immediate = false } = {}){
  if (immediate){
    if (persistQueuedTimer){
      clearTimeout(persistQueuedTimer);
      persistQueuedTimer = null;
    }
    persist();
    return;
  }
  if (persistQueuedTimer) clearTimeout(persistQueuedTimer);
  persistQueuedTimer = setTimeout(() => {
    persistQueuedTimer = null;
    persist();
  }, PERSIST_DEBOUNCE_MS);
}

function commitUIUpdate({ render: doRender = true, persist: doPersist = true, immediatePersist = false } = {}){
  if (doRender) scheduleRender();
  if (doPersist) schedulePersist({ immediate: immediatePersist });
}


function makeDefaultState(){
  return {
    scenarioName: "",
    raceType: "state_leg",
    electionDate: "",
    weeksRemaining: "",
    mode: "persuasion",
    universeBasis: "registered",
    universeSize: "",
    sourceNote: "",
    turnoutA: "",
    turnoutB: "",
    bandWidth: DEFAULTS_BY_TEMPLATE["state_leg"].bandWidth,
    candidates: [
      { id: uid(), name: "Candidate A", supportPct: 35 },
      { id: uid(), name: "Candidate B", supportPct: 35 },
    ],
    undecidedPct: 30,
    yourCandidateId: null,
    undecidedMode: "proportional",
    userSplit: {},
    persuasionPct: DEFAULTS_BY_TEMPLATE["state_leg"].persuasionPct,
    earlyVoteExp: DEFAULTS_BY_TEMPLATE["state_leg"].earlyVoteExp,

    // Phase 2 — conversion + contact math
    goalSupportIds: "",
    supportRatePct: 55,
    contactRatePct: 22,
    doorsPerHour: 30, // legacy mirror; canonical source is doorsPerHour3
    hoursPerShift: 3,
    shiftsPerVolunteerPerWeek: 2,

    // Phase 3 — execution + risk (capacity + Monte Carlo)
    orgCount: 2,
    orgHoursPerWeek: 40,
    volunteerMultBase: 1.0,
    channelDoorPct: 70,
    doorsPerHour3: 30,
    callsPerHour3: 20,
    turnoutReliabilityPct: 80,

    // Phase 6 — turnout / GOTV
    turnoutEnabled: false,
    turnoutBaselinePct: 55,
    turnoutTargetOverridePct: "",
    gotvMode: "basic",
    gotvLiftPP: 1.0,
    gotvMaxLiftPP: 10,
    gotvDiminishing: false,
    gotvLiftMin: 0.5,
    gotvLiftMode: 1.0,
    gotvLiftMax: 2.0,
    gotvMaxLiftPP2: 10,
    gotvDiminishing2: false,

    // Phase 7 — timeline / production (feasibility layer)
    timelineEnabled: false,
    timelineActiveWeeks: "",
    timelineGotvWeeks: 2,
    timelineStaffCount: 0,
    timelineStaffHours: 40,
    timelineVolCount: 0,
    timelineVolHours: 4,
    timelineRampEnabled: false,
    timelineRampMode: "linear",
    timelineDoorsPerHour: 30,
    timelineCallsPerHour: 20,
    timelineTextsPerHour: 120,

    // Phase 17 — operations feature flags (default OFF; no behavior change yet)
    crmEnabled: false,
    scheduleEnabled: false,
    twCapOverrideEnabled: false,
    twCapOverrideMode: "baseline",
    twCapOverrideHorizonWeeks: 12,


    mcMode: "basic",
    mcVolatility: "med",
    mcSeed: "",

        // Phase 4 — budget + ROI (attempt-based; Phase 4A: shared CR/SR across tactics)
        budget: {
          overheadAmount: 0,
          includeOverhead: false,
          tactics: {
            doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
            phones: { enabled: true, cpa: 0.03, kind: "persuasion" },
            texts: { enabled: false, cpa: 0.02, kind: "persuasion" },
          },
          optimize: {
            mode: "budget",
            budgetAmount: 10000,
            capacityAttempts: "",
            step: 25,
            useDecay: false,
            objective: "net",
            tlConstrainedEnabled: false,
            tlConstrainedObjective: "max_net",
          }
        },

    mcContactMin: "",
    mcContactMode: "",
    mcContactMax: "",
    mcPersMin: "",
    mcPersMode: "",
    mcPersMax: "",
    mcReliMin: "",
    mcReliMode: "",
    mcReliMax: "",
    mcDphMin: "",
    mcDphMode: "",
    mcDphMax: "",
    mcCphMin: "",
    mcCphMode: "",
    mcCphMax: "",
    mcVolMin: "",
    mcVolMode: "",
    mcVolMax: "",

    mcLast: null,
    mcLastHash: "",
    ui: {
      training: false,
      dark: false,
      advDiag: false,
      activeTab: "win",
      assumptionsProfile: "template",
      decision: { sessions: {}, activeSessionId: null },
    mcMeta: null,
    }
  };
}

function uid(){
  return Math.random().toString(16).slice(2,10);
}

function applyStateToUI(){
  els.scenarioName.value = state.scenarioName || "";
  els.raceType.value = state.raceType || "state_leg";
  els.electionDate.value = state.electionDate || "";
  els.weeksRemaining.value = state.weeksRemaining || "";
  els.mode.value = state.mode || "persuasion";

  els.universeBasis.value = state.universeBasis || "registered";
  els.universeSize.value = state.universeSize ?? "";
  els.sourceNote.value = state.sourceNote || "";
  if (els.toggleStrictImport) els.toggleStrictImport.checked = !!state?.ui?.strictImport;
  document.body.classList.toggle("strict-import", !!state?.ui?.strictImport);

  els.turnoutA.value = state.turnoutA ?? "";
  els.turnoutB.value = state.turnoutB ?? "";
  els.bandWidth.value = state.bandWidth ?? "";

  els.undecidedPct.value = state.undecidedPct ?? "";
  els.undecidedMode.value = state.undecidedMode || "proportional";

  els.persuasionPct.value = state.persuasionPct ?? "";
  els.earlyVoteExp.value = state.earlyVoteExp ?? "";

  // Phase 2 — conversion + capacity
  if (els.goalSupportIds) els.goalSupportIds.value = state.goalSupportIds ?? "";
  if (els.supportRatePct) els.supportRatePct.value = state.supportRatePct ?? "";
  if (els.contactRatePct) els.contactRatePct.value = state.contactRatePct ?? "";
  const canonicalDph = canonicalDoorsPerHourFromSnap(state);
  if (els.doorsPerHour){
    els.doorsPerHour.value = canonicalDph ?? "";
    els.doorsPerHour.disabled = true;
    els.doorsPerHour.title = "Read-only mirror. Edit Doors per hour in Field capacity (Execution & uncertainty).";
  }
  if (els.hoursPerShift) els.hoursPerShift.value = state.hoursPerShift ?? "";
  if (els.shiftsPerVolunteerPerWeek) els.shiftsPerVolunteerPerWeek.value = state.shiftsPerVolunteerPerWeek ?? "";

  // Phase 16 — universe composition + retention
  if (els.universe16Enabled) els.universe16Enabled.checked = !!state.universeLayerEnabled;
  if (els.universe16DemPct) els.universe16DemPct.value = state.universeDemPct ?? "";
  if (els.universe16RepPct) els.universe16RepPct.value = state.universeRepPct ?? "";
  if (els.universe16NpaPct) els.universe16NpaPct.value = state.universeNpaPct ?? "";
  if (els.universe16OtherPct) els.universe16OtherPct.value = state.universeOtherPct ?? "";
  if (els.retentionFactor) els.retentionFactor.value = state.retentionFactor ?? "";

  // Phase 3 — execution + risk
  if (els.orgCount) els.orgCount.value = state.orgCount ?? "";
  if (els.orgHoursPerWeek) els.orgHoursPerWeek.value = state.orgHoursPerWeek ?? "";
  if (els.volunteerMultBase) els.volunteerMultBase.value = state.volunteerMultBase ?? "";
  if (els.channelDoorPct) els.channelDoorPct.value = state.channelDoorPct ?? "";
  if (els.doorsPerHour3) els.doorsPerHour3.value = canonicalDph ?? "";
  if (els.callsPerHour3) els.callsPerHour3.value = state.callsPerHour3 ?? "";
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.value = state.turnoutReliabilityPct ?? "";
  if (els.twCapOverrideEnabled) els.twCapOverrideEnabled.checked = !!state.twCapOverrideEnabled;
  if (els.twCapOverrideMode) els.twCapOverrideMode.value = state.twCapOverrideMode || "baseline";
  if (els.twCapOverrideHorizonWeeks) els.twCapOverrideHorizonWeeks.value = state.twCapOverrideHorizonWeeks ?? 12;

  // Phase 6 — turnout / GOTV
  if (els.turnoutEnabled) els.turnoutEnabled.checked = !!state.turnoutEnabled;
  if (els.turnoutBaselinePct) els.turnoutBaselinePct.value = state.turnoutBaselinePct ?? "";
  if (els.turnoutTargetOverridePct) els.turnoutTargetOverridePct.value = state.turnoutTargetOverridePct ?? "";
  if (els.gotvMode) els.gotvMode.value = state.gotvMode || "basic";
  if (els.gotvLiftPP) els.gotvLiftPP.value = state.gotvLiftPP ?? "";
  if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.value = state.gotvMaxLiftPP ?? "";
  if (els.gotvDiminishing) els.gotvDiminishing.checked = !!state.gotvDiminishing;
  if (els.gotvLiftMin) els.gotvLiftMin.value = state.gotvLiftMin ?? "";
  if (els.gotvLiftMode) els.gotvLiftMode.value = state.gotvLiftMode ?? "";
  if (els.gotvLiftMax) els.gotvLiftMax.value = state.gotvLiftMax ?? "";
  if (els.gotvMaxLiftPP2) els.gotvMaxLiftPP2.value = state.gotvMaxLiftPP2 ?? "";
  if (els.gotvDiminishing2) els.gotvDiminishing2.checked = !!state.gotvDiminishing2;

  if (els.mcMode) els.mcMode.value = state.mcMode || "basic";
  if (els.mcVolatility) els.mcVolatility.value = state.mcVolatility || "med";
  if (els.mcSeed) els.mcSeed.value = state.mcSeed || "";

  // Advanced ranges
  const setIf = (el, v) => { if (el) el.value = v ?? ""; };
  setIf(els.mcContactMin, state.mcContactMin);
  setIf(els.mcContactMode, state.mcContactMode);
  setIf(els.mcContactMax, state.mcContactMax);
  setIf(els.mcPersMin, state.mcPersMin);
  setIf(els.mcPersMode, state.mcPersMode);
  setIf(els.mcPersMax, state.mcPersMax);
  setIf(els.mcReliMin, state.mcReliMin);
  setIf(els.mcReliMode, state.mcReliMode);
  setIf(els.mcReliMax, state.mcReliMax);
  setIf(els.mcDphMin, state.mcDphMin);
  setIf(els.mcDphMode, state.mcDphMode);
  setIf(els.mcDphMax, state.mcDphMax);
  setIf(els.mcCphMin, state.mcCphMin);
  setIf(els.mcCphMode, state.mcCphMode);
  setIf(els.mcCphMax, state.mcCphMax);
  setIf(els.mcVolMin, state.mcVolMin);
  setIf(els.mcVolMode, state.mcVolMode);
  setIf(els.mcVolMax, state.mcVolMax);

  syncMcModeUI();
  syncGotvModeUI();


    // Phase 4 — budget + ROI
    if (els.roiDoorsEnabled) els.roiDoorsEnabled.checked = !!state.budget?.tactics?.doors?.enabled;
    if (els.roiDoorsCpa) els.roiDoorsCpa.value = state.budget?.tactics?.doors?.cpa ?? "";
    if (els.roiDoorsKind) els.roiDoorsKind.value = state.budget?.tactics?.doors?.kind || "persuasion";
    if (els.roiDoorsCr) els.roiDoorsCr.value = state.budget?.tactics?.doors?.crPct ?? "";
    if (els.roiDoorsSr) els.roiDoorsSr.value = state.budget?.tactics?.doors?.srPct ?? "";
    if (els.roiPhonesEnabled) els.roiPhonesEnabled.checked = !!state.budget?.tactics?.phones?.enabled;
    if (els.roiPhonesCpa) els.roiPhonesCpa.value = state.budget?.tactics?.phones?.cpa ?? "";
    if (els.roiPhonesKind) els.roiPhonesKind.value = state.budget?.tactics?.phones?.kind || "persuasion";
    if (els.roiPhonesCr) els.roiPhonesCr.value = state.budget?.tactics?.phones?.crPct ?? "";
    if (els.roiPhonesSr) els.roiPhonesSr.value = state.budget?.tactics?.phones?.srPct ?? "";
    if (els.roiTextsEnabled) els.roiTextsEnabled.checked = !!state.budget?.tactics?.texts?.enabled;
    if (els.roiTextsCpa) els.roiTextsCpa.value = state.budget?.tactics?.texts?.cpa ?? "";
    if (els.roiTextsKind) els.roiTextsKind.value = state.budget?.tactics?.texts?.kind || "persuasion";
    if (els.roiTextsCr) els.roiTextsCr.value = state.budget?.tactics?.texts?.crPct ?? "";
    if (els.roiTextsSr) els.roiTextsSr.value = state.budget?.tactics?.texts?.srPct ?? "";
    if (els.roiOverheadAmount) els.roiOverheadAmount.value = state.budget?.overheadAmount ?? "";
    if (els.roiIncludeOverhead) els.roiIncludeOverhead.checked = !!state.budget?.includeOverhead;

  // Phase 5 — optimization
  if (els.optMode) els.optMode.value = state.budget?.optimize?.mode || "budget";
  if (els.optObjective) els.optObjective.value = state.budget?.optimize?.objective || "net";
  if (els.tlOptEnabled) els.tlOptEnabled.checked = !!state.budget?.optimize?.tlConstrainedEnabled;
  if (els.tlOptObjective) els.tlOptObjective.value = state.budget?.optimize?.tlConstrainedObjective || "max_net";
  if (els.optBudget) els.optBudget.value = state.budget?.optimize?.budgetAmount ?? "";
  if (els.optCapacity) els.optCapacity.value = state.budget?.optimize?.capacityAttempts ?? "";
  if (els.optStep) els.optStep.value = state.budget?.optimize?.step ?? 25;
  if (els.optUseDecay) els.optUseDecay.checked = !!state.budget?.optimize?.useDecay;

  // Phase 7 — timeline / production
  if (els.timelineEnabled) els.timelineEnabled.checked = !!state.timelineEnabled;
  if (els.timelineActiveWeeks) els.timelineActiveWeeks.value = state.timelineActiveWeeks ?? "";
  if (els.timelineGotvWeeks) els.timelineGotvWeeks.value = state.timelineGotvWeeks ?? "";
  if (els.timelineStaffCount) els.timelineStaffCount.value = state.timelineStaffCount ?? "";
  if (els.timelineStaffHours) els.timelineStaffHours.value = state.timelineStaffHours ?? "";
  if (els.timelineVolCount) els.timelineVolCount.value = state.timelineVolCount ?? "";
  if (els.timelineVolHours) els.timelineVolHours.value = state.timelineVolHours ?? "";
  if (els.timelineRampEnabled) els.timelineRampEnabled.checked = !!state.timelineRampEnabled;
  if (els.timelineRampMode) els.timelineRampMode.value = state.timelineRampMode || "linear";
  if (els.timelineDoorsPerHour) els.timelineDoorsPerHour.value = state.timelineDoorsPerHour ?? "";
  if (els.timelineCallsPerHour) els.timelineCallsPerHour.value = state.timelineCallsPerHour ?? "";
  if (els.timelineTextsPerHour) els.timelineTextsPerHour.value = state.timelineTextsPerHour ?? "";

  if (els.toggleAdvDiag) els.toggleAdvDiag.checked = !!state.ui?.advDiag;
  if (els.advDiagBox) els.advDiagBox.hidden = !state.ui?.advDiag;
  if (els.toggleTraining) els.toggleTraining.checked = !!state.ui?.training;

  document.body.classList.toggle("training", !!state.ui?.training);
  applyThemeFromState();
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
  // Phase 11 — safety rails controls (fail-soft)
  safeCall(() => {
    if (els.toggleStrictImport){
      els.toggleStrictImport.checked = !!state?.ui?.strictImport;
      document.body.classList.toggle("strict-import", !!state?.ui?.strictImport);
      els.toggleStrictImport.addEventListener("change", () => {
        document.body.classList.toggle("strict-import", !!els.toggleStrictImport.checked);
        setState(s => { s.ui.strictImport = !!els.toggleStrictImport.checked; });
      });
    }
    if (els.restoreBackup){
      refreshBackupDropdown();
      els.restoreBackup.addEventListener("change", () => {
        const v = els.restoreBackup.value;
        if (!v) return;
        restoreBackupByIndex(v);
        els.restoreBackup.value = "";
      });
    }
    if (els.btnDiagnostics) els.btnDiagnostics.addEventListener("click", openDiagnostics);
    if (els.btnDiagClose) els.btnDiagClose.addEventListener("click", closeDiagnostics);
    if (els.diagModal){
      els.diagModal.addEventListener("click", (e) => {
        const t = e?.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeDiagnostics();
      });
    }
    if (els.btnCopyDebug) els.btnCopyDebug.addEventListener("click", () => { safeCall(() => { copyDebugBundle(); }); });

    // Daily log import/export
    if (els.dailyLogExportBtn) els.dailyLogExportBtn.addEventListener("click", () => { safeCall(() => { exportDailyLog(); }); });
    if (els.dailyLogImportBtn) els.dailyLogImportBtn.addEventListener("click", () => {
      safeCall(() => {
        const raw = String(els.dailyLogImportText?.value || "").trim();
        if (!raw){
          if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Paste JSON first";
          return;
        }
        let parsed = null;
        try{ parsed = JSON.parse(raw); } catch {
          if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Invalid JSON";
          return;
        }
        const r = mergeDailyLogIntoState(parsed);
        if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = r.msg;
      });
    });

    // Analyst tools: align assumptions to rolling actuals
    if (els.applyRollingCRBtn) els.applyRollingCRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("contact"); }); });
    if (els.applyRollingSRBtn) els.applyRollingSRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("support"); }); });
    if (els.wkUndoActionBtn) els.wkUndoActionBtn.addEventListener("click", () => { safeCall(() => { undoLastWeeklyAction(); }); });
  });


  els.scenarioName.addEventListener("input", () => { state.scenarioName = els.scenarioName.value; schedulePersist(); });

  els.raceType.addEventListener("change", () => {
    state.raceType = els.raceType.value;
    applyTemplateDefaultsForRace(state, state.raceType, { force: true });
    if (!state.ui) state.ui = {};
    state.ui.assumptionsProfile = "template";
    applyStateToUI();
    commitUIUpdate();
  });

  els.electionDate.addEventListener("change", () => { state.electionDate = els.electionDate.value; commitUIUpdate(); });
  els.weeksRemaining.addEventListener("input", () => { state.weeksRemaining = els.weeksRemaining.value; commitUIUpdate(); });
  els.mode.addEventListener("change", () => { state.mode = els.mode.value; schedulePersist(); });

  els.universeBasis.addEventListener("change", () => { state.universeBasis = els.universeBasis.value; commitUIUpdate(); });
  els.universeSize.addEventListener("input", () => { state.universeSize = safeNum(els.universeSize.value); commitUIUpdate(); });
  els.sourceNote.addEventListener("input", () => { state.sourceNote = els.sourceNote.value; schedulePersist(); });

  els.turnoutA.addEventListener("input", () => { state.turnoutA = safeNum(els.turnoutA.value); commitUIUpdate(); });
  els.turnoutB.addEventListener("input", () => { state.turnoutB = safeNum(els.turnoutB.value); commitUIUpdate(); });
  els.bandWidth.addEventListener("input", () => { state.bandWidth = safeNum(els.bandWidth.value); refreshAssumptionsProfile(); commitUIUpdate(); });

  els.btnAddCandidate.addEventListener("click", () => {
    state.candidates.push({ id: uid(), name: `Candidate ${String.fromCharCode(65 + state.candidates.length)}`, supportPct: 0 });
    rebuildCandidateTable();
    commitUIUpdate();
  });

  els.yourCandidate.addEventListener("change", () => { state.yourCandidateId = els.yourCandidate.value; commitUIUpdate(); });
  els.undecidedPct.addEventListener("input", () => { state.undecidedPct = safeNum(els.undecidedPct.value); commitUIUpdate(); });

  els.undecidedMode.addEventListener("change", () => {
    state.undecidedMode = els.undecidedMode.value;
    rebuildUserSplitInputs();
    commitUIUpdate();
  });

  els.persuasionPct.addEventListener("input", () => { state.persuasionPct = safeNum(els.persuasionPct.value); refreshAssumptionsProfile(); commitUIUpdate(); });
  els.earlyVoteExp.addEventListener("input", () => { state.earlyVoteExp = safeNum(els.earlyVoteExp.value); refreshAssumptionsProfile(); commitUIUpdate(); });

  // Phase 2 — conversion + capacity
  if (els.goalSupportIds) els.goalSupportIds.addEventListener("input", () => { state.goalSupportIds = els.goalSupportIds.value; markMcStale(); commitUIUpdate(); });
  if (els.supportRatePct) els.supportRatePct.addEventListener("input", () => { state.supportRatePct = safeNum(els.supportRatePct.value); markMcStale(); commitUIUpdate(); });
  if (els.contactRatePct) els.contactRatePct.addEventListener("input", () => { state.contactRatePct = safeNum(els.contactRatePct.value); markMcStale(); commitUIUpdate(); });
  // doorsPerHour (Stage 5) is read-only mirror; canonical writer is doorsPerHour3 in Field capacity.
  if (els.hoursPerShift) els.hoursPerShift.addEventListener("input", () => { state.hoursPerShift = safeNum(els.hoursPerShift.value); commitUIUpdate(); });
  if (els.shiftsPerVolunteerPerWeek) els.shiftsPerVolunteerPerWeek.addEventListener("input", () => { state.shiftsPerVolunteerPerWeek = safeNum(els.shiftsPerVolunteerPerWeek.value); commitUIUpdate(); });
  if (els.btnGotoTurnoutSettings) els.btnGotoTurnoutSettings.addEventListener("click", () => { switchToStage("roi"); });

  // Phase 16 — universe composition + retention
  if (els.universe16Enabled) els.universe16Enabled.addEventListener("change", () => { state.universeLayerEnabled = !!els.universe16Enabled.checked; markMcStale(); commitUIUpdate(); });
  if (els.universe16DemPct) els.universe16DemPct.addEventListener("input", () => { state.universeDemPct = safeNum(els.universe16DemPct.value); markMcStale(); commitUIUpdate(); });
  if (els.universe16RepPct) els.universe16RepPct.addEventListener("input", () => { state.universeRepPct = safeNum(els.universe16RepPct.value); markMcStale(); commitUIUpdate(); });
  if (els.universe16NpaPct) els.universe16NpaPct.addEventListener("input", () => { state.universeNpaPct = safeNum(els.universe16NpaPct.value); markMcStale(); commitUIUpdate(); });
  if (els.universe16OtherPct) els.universe16OtherPct.addEventListener("input", () => { state.universeOtherPct = safeNum(els.universe16OtherPct.value); markMcStale(); commitUIUpdate(); });
  if (els.retentionFactor) els.retentionFactor.addEventListener("input", () => { state.retentionFactor = safeNum(els.retentionFactor.value); markMcStale(); commitUIUpdate(); });

  // Phase 3 — execution + risk
  if (els.orgCount) els.orgCount.addEventListener("input", () => { state.orgCount = safeNum(els.orgCount.value); markMcStale(); commitUIUpdate(); });
  if (els.orgHoursPerWeek) els.orgHoursPerWeek.addEventListener("input", () => { state.orgHoursPerWeek = safeNum(els.orgHoursPerWeek.value); markMcStale(); commitUIUpdate(); });
  if (els.volunteerMultBase) els.volunteerMultBase.addEventListener("input", () => { state.volunteerMultBase = safeNum(els.volunteerMultBase.value); markMcStale(); commitUIUpdate(); });
  if (els.channelDoorPct) els.channelDoorPct.addEventListener("input", () => { state.channelDoorPct = safeNum(els.channelDoorPct.value); markMcStale(); commitUIUpdate(); });
  if (els.doorsPerHour3) els.doorsPerHour3.addEventListener("input", () => {
    setCanonicalDoorsPerHour(state, els.doorsPerHour3.value);
    if (els.doorsPerHour) els.doorsPerHour.value = canonicalDoorsPerHourFromSnap(state) ?? "";
    markMcStale();
    commitUIUpdate();
  });
  if (els.callsPerHour3) els.callsPerHour3.addEventListener("input", () => { state.callsPerHour3 = safeNum(els.callsPerHour3.value); markMcStale(); commitUIUpdate(); });
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.addEventListener("input", () => { state.turnoutReliabilityPct = safeNum(els.turnoutReliabilityPct.value); markMcStale(); commitUIUpdate(); });
  if (els.twCapOverrideEnabled) els.twCapOverrideEnabled.addEventListener("change", () => { state.twCapOverrideEnabled = !!els.twCapOverrideEnabled.checked; markMcStale(); commitUIUpdate(); });
  if (els.twCapOverrideMode) els.twCapOverrideMode.addEventListener("change", () => {
    const mode = String(els.twCapOverrideMode.value || "baseline");
    state.twCapOverrideMode = ["baseline", "ramp", "scheduled", "max"].includes(mode) ? mode : "baseline";
    markMcStale();
    commitUIUpdate();
  });
  if (els.twCapOverrideHorizonWeeks) els.twCapOverrideHorizonWeeks.addEventListener("input", () => {
    const n = safeNum(els.twCapOverrideHorizonWeeks.value);
    state.twCapOverrideHorizonWeeks = (n != null && isFinite(n)) ? clamp(n, 4, 52) : 12;
    commitUIUpdate();
  });

  // Phase 6 — turnout / GOTV inputs
  if (els.turnoutEnabled) els.turnoutEnabled.addEventListener("change", () => { state.turnoutEnabled = !!els.turnoutEnabled.checked; markMcStale(); commitUIUpdate(); });
  if (els.turnoutBaselinePct) els.turnoutBaselinePct.addEventListener("input", () => { state.turnoutBaselinePct = safeNum(els.turnoutBaselinePct.value); markMcStale(); commitUIUpdate(); });
  if (els.turnoutTargetOverridePct) els.turnoutTargetOverridePct.addEventListener("input", () => { state.turnoutTargetOverridePct = els.turnoutTargetOverridePct.value; markMcStale(); commitUIUpdate(); });

  if (els.gotvMode) els.gotvMode.addEventListener("change", () => { state.gotvMode = els.gotvMode.value; syncGotvModeUI(); markMcStale(); commitUIUpdate(); });

  if (els.gotvLiftPP) els.gotvLiftPP.addEventListener("input", () => { state.gotvLiftPP = safeNum(els.gotvLiftPP.value); markMcStale(); commitUIUpdate(); });
  if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.addEventListener("input", () => { state.gotvMaxLiftPP = safeNum(els.gotvMaxLiftPP.value); markMcStale(); commitUIUpdate(); });
  if (els.gotvDiminishing) els.gotvDiminishing.addEventListener("change", () => { state.gotvDiminishing = !!els.gotvDiminishing.checked; markMcStale(); commitUIUpdate(); });

  if (els.gotvLiftMin) els.gotvLiftMin.addEventListener("input", () => { state.gotvLiftMin = safeNum(els.gotvLiftMin.value); markMcStale(); commitUIUpdate(); });
  if (els.gotvLiftMode) els.gotvLiftMode.addEventListener("input", () => { state.gotvLiftMode = safeNum(els.gotvLiftMode.value); markMcStale(); commitUIUpdate(); });
  if (els.gotvLiftMax) els.gotvLiftMax.addEventListener("input", () => { state.gotvLiftMax = safeNum(els.gotvLiftMax.value); markMcStale(); commitUIUpdate(); });
  if (els.gotvMaxLiftPP2) els.gotvMaxLiftPP2.addEventListener("input", () => { state.gotvMaxLiftPP2 = safeNum(els.gotvMaxLiftPP2.value); markMcStale(); commitUIUpdate(); });
  if (els.gotvDiminishing2) els.gotvDiminishing2.addEventListener("change", () => { state.gotvDiminishing2 = !!els.gotvDiminishing2.checked; markMcStale(); commitUIUpdate(); });


  if (els.mcMode) els.mcMode.addEventListener("change", () => { state.mcMode = els.mcMode.value; syncMcModeUI(); markMcStale(); schedulePersist(); });
  if (els.mcVolatility) els.mcVolatility.addEventListener("change", () => { state.mcVolatility = els.mcVolatility.value; markMcStale(); schedulePersist(); });
  if (els.mcSeed) els.mcSeed.addEventListener("input", () => { state.mcSeed = els.mcSeed.value; markMcStale(); schedulePersist(); });

  const advWatch = (el, key) => {
    if (!el) return;
    el.addEventListener("input", () => {
      state[key] = safeNum(el.value);
      markMcStale();
      schedulePersist();
    });
  };
  advWatch(els.mcContactMin, "mcContactMin");
  advWatch(els.mcContactMode, "mcContactMode");
  advWatch(els.mcContactMax, "mcContactMax");
  advWatch(els.mcPersMin, "mcPersMin");
  advWatch(els.mcPersMode, "mcPersMode");
  advWatch(els.mcPersMax, "mcPersMax");
  advWatch(els.mcReliMin, "mcReliMin");
  advWatch(els.mcReliMode, "mcReliMode");
  advWatch(els.mcReliMax, "mcReliMax");
  advWatch(els.mcDphMin, "mcDphMin");
  advWatch(els.mcDphMode, "mcDphMode");
  advWatch(els.mcDphMax, "mcDphMax");
  advWatch(els.mcCphMin, "mcCphMin");
  advWatch(els.mcCphMode, "mcCphMode");
  advWatch(els.mcCphMax, "mcCphMax");

  // Phase 15 — always wire sensitivity surface independent of scenario-compare panel presence.
  safeCall(() => { wireSensitivitySurface(); });
  advWatch(els.mcVolMin, "mcVolMin");
  advWatch(els.mcVolMode, "mcVolMode");
  advWatch(els.mcVolMax, "mcVolMax");

  if (els.mcRun) els.mcRun.addEventListener("click", () => runMonteCarloNow());
  if (els.mcRunSidebar) els.mcRunSidebar.addEventListener("click", () => runMonteCarloNow());
  if (els.mcRerun) els.mcRerun.addEventListener("click", () => runMonteCarloNow());

  wireBudgetTimelineEvents({
    els,
    state,
    safeNum,
    commitUIUpdate,
    render
  });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      const panel = document.getElementById(`tab-${tab}`);

      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      if (panel){
        state.ui.activeTab = tab;
        panel.classList.add("active");
      } else {
        state.ui.activeTab = "win";
        document.getElementById("tab-win")?.classList.add("active");
      }

      persist();
    });
  });

  if (els.btnSaveJson) els.btnSaveJson.addEventListener("click", () => {
    const scenarioClone = structuredClone(state);
    const snapshot = { modelVersion: engine.snapshot.MODEL_VERSION, schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION, scenarioState: scenarioClone, appVersion: APP_VERSION, buildId: BUILD_ID };
    snapshot.snapshotHash = engine.snapshot.computeSnapshotHash(snapshot);
    lastExportHash = snapshot.snapshotHash;
    const payload = engine.snapshot.makeScenarioExport(snapshot);
    if (engine.snapshot.hasNonFiniteNumbers(payload)){
      alert("Export blocked: scenario contains NaN/Infinity.");
      return;
    }
    const filename = engine.snapshot.makeTimestampedFilename("field-path-scenario", "json");
    const text = engine.snapshot.deterministicStringify(payload, 2);
    downloadText(text, filename, "application/json");
  });

  if (els.btnExportCsv) els.btnExportCsv.addEventListener("click", () => {
    if (!lastResultsSnapshot){
      alert("Nothing to export yet. Run a scenario first.");
      return;
    }
    const csv = engine.snapshot.planRowsToCsv(lastResultsSnapshot);
    if (/NaN|Infinity/.test(csv)){
      alert("CSV export blocked: contains NaN/Infinity.");
      return;
    }
    const filename = engine.snapshot.makeTimestampedFilename("field-path-plan", "csv");
    downloadText(csv, filename, "text/csv");
  });

  if (els.btnCopySummary) els.btnCopySummary.addEventListener("click", async () => {
    if (!lastResultsSnapshot){
      alert("Nothing to copy yet. Run a scenario first.");
      return;
    }
    const text = engine.snapshot.formatSummaryText(lastResultsSnapshot);
    const r = await engine.snapshot.copyTextToClipboard(text);
    if (!r.ok) alert(r.reason || "Copy failed.");
  });

  if (els.btnResetAll) els.btnResetAll.addEventListener("click", () => {
    const ok = confirm("Reset all fields to defaults? This will clear the saved scenario in this browser.");
    if (!ok) return;
    state = makeDefaultState();
    ensureScenarioRegistry();
    ensureDecisionScaffold();
    try{
      const b = state.ui.scenarios?.[SCENARIO_BASELINE_ID];
      if (b){
        b.inputs = scenarioInputsFromState(state);
        b.outputs = scenarioOutputsFromState(state);
      }
    } catch {}
    clearState();
    applyStateToUI();
    rebuildCandidateTable();
    document.body.classList.toggle("training", !!state.ui.training);
    applyThemeFromState();
    if (els.explainCard) els.explainCard.hidden = !state.ui.training;
    render();
    safeCall(() => { renderScenarioManagerC1(); });
    safeCall(() => { renderDecisionSessionD1(); });
    persist();
  });

  els.loadJson.addEventListener("change", async () => {
    const file = els.loadJson.files?.[0];
    if (!file) return;

    const loaded = await readJsonFile(file);
    if (!loaded || typeof loaded !== "object"){
      alert("Import failed: invalid JSON.");
      els.loadJson.value = "";
      return;

    // Phase 11 — strict import: block newer schema before migration (optional)
    const prePolicy = engine.snapshot.checkStrictImportPolicy({
      strictMode: !!state?.ui?.strictImport,
      importedSchemaVersion: loaded.schemaVersion || null,
      currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
      hashMismatch: false
    });
    if (!prePolicy.ok){
      alert(prePolicy.issues.join(" "));
      els.loadJson.value = "";
      return;
    }

    }

    const mig = engine.snapshot.migrateSnapshot(loaded);
    if (els.importWarnBanner){
      if (mig.warnings && mig.warnings.length){
        els.importWarnBanner.hidden = false;
        els.importWarnBanner.textContent = mig.warnings.join(" ");
      } else {
        els.importWarnBanner.hidden = true;
        els.importWarnBanner.textContent = "";
      }
    }

    const v = engine.snapshot.validateScenarioExport(mig.snapshot, engine.snapshot.MODEL_VERSION);
    if (!v.ok){
      alert(`Import failed: ${v.reason}`);
      els.loadJson.value = "";
      return;
    }

    const missing = requiredScenarioKeysMissing(v.scenario);
    if (missing.length){
      alert("Import failed: scenario is missing required fields: " + missing.join(", "));
      els.loadJson.value = "";
      return;
    }

    // Phase 9B — snapshot integrity verification (+ Phase 11 strict option)
    let hashMismatch = false;
    try{
      const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
      // Hash must be tied to the normalized snapshot used by the engine (after migration).
      const recomputed = engine.snapshot.computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
      hashMismatch = !!(exportedHash && exportedHash !== recomputed);

      if (hashMismatch){
        if (els.importHashBanner){
          els.importHashBanner.hidden = false;
          els.importHashBanner.textContent = "Snapshot hash differs from exported hash.";
        }
        console.warn("Snapshot hash mismatch", { exportedHash, recomputed });
      } else {
        if (els.importHashBanner) els.importHashBanner.hidden = true;
      }

      const policy = engine.snapshot.checkStrictImportPolicy({
        strictMode: !!state?.ui?.strictImport,
        importedSchemaVersion: (mig?.snapshot?.schemaVersion || loaded.schemaVersion || null),
        currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
        hashMismatch
      });
      if (!policy.ok){
        alert(policy.issues.join(" "));
        els.loadJson.value = "";
        return;
      }
    } catch {
      // If hashing fails for any reason, do not block import unless strict explicitly requires it.
      if (state?.ui?.strictImport){
        alert("Import blocked: could not verify integrity hash in strict mode.");
        els.loadJson.value = "";
        return;
      }
    }


    // Replace entire state safely (no partial merge with current state)
    state = normalizeLoadedState(v.scenario);
    ensureScenarioRegistry();
    ensureDecisionScaffold();
    try{
      const b = state.ui.scenarios?.[SCENARIO_BASELINE_ID];
      if (b){
        b.inputs = scenarioInputsFromState(state);
        b.outputs = scenarioOutputsFromState(state);
      }
    } catch {}
    applyStateToUI();
    rebuildCandidateTable();
    document.body.classList.toggle("training", !!state.ui.training);
    applyThemeFromState();
    if (els.explainCard) els.explainCard.hidden = !state.ui.training;
    render();
    safeCall(() => { renderDecisionSessionD1(); });
    persist();
    els.loadJson.value = "";
  });

  if (els.toggleTraining) els.toggleTraining.addEventListener("change", () => {
    state.ui.training = els.toggleTraining.checked;
    document.body.classList.toggle("training", !!state.ui.training);
    setText(els.snapshotHash, lastResultsSnapshot?.snapshotHash || "—");
    setText(els.snapshotHashSidebar, lastResultsSnapshot?.snapshotHash || "—");
    els.explainCard.hidden = !state.ui.training;
    persist();
  });

  if (els.toggleDark) els.toggleDark.addEventListener("change", () => {
  // checked => force dark, unchecked => follow system
  if (!state.ui) state.ui = {};
  state.ui.themeMode = els.toggleDark.checked ? "dark" : "system";
  applyThemeFromState();
  persist();
});

  if (els.toggleAdvDiag) els.toggleAdvDiag.addEventListener("change", () => {
    state.ui.advDiag = els.toggleAdvDiag.checked;
    if (els.advDiagBox) els.advDiagBox.hidden = !state.ui.advDiag;
    persist();
  });

}

function normalizeLoadedState(s){
  const base = makeDefaultState();
  const out = { ...base, ...s };
  out.candidates = Array.isArray(s.candidates) ? s.candidates : base.candidates;
  out.userSplit = (s.userSplit && typeof s.userSplit === "object") ? s.userSplit : {};
  out.ui = { ...base.ui, ...(s.ui || {}) };

  out.budget = (s.budget && typeof s.budget === "object")
    ? { ...base.budget, ...s.budget,
        tactics: { ...base.budget.tactics, ...(s.budget.tactics||{}) },
        optimize: { ...base.budget.optimize, ...(s.budget.optimize||{}) }
      }
    : structuredClone(base.budget);

  if (!out.yourCandidateId && out.candidates[0]) out.yourCandidateId = out.candidates[0].id;
  out.crmEnabled = !!out.crmEnabled;
  out.scheduleEnabled = !!out.scheduleEnabled;
  out.twCapOverrideEnabled = !!out.twCapOverrideEnabled;
  out.twCapOverrideMode = ["baseline", "ramp", "scheduled", "max"].includes(String(out.twCapOverrideMode || ""))
    ? String(out.twCapOverrideMode)
    : "baseline";
  const horizon = safeNum(out.twCapOverrideHorizonWeeks);
  out.twCapOverrideHorizonWeeks = (horizon != null && isFinite(horizon)) ? clamp(horizon, 4, 52) : 12;
  // Canonicalize doors/hour onto doorsPerHour3 while keeping legacy mirror synced.
  const canonDph = canonicalDoorsPerHourFromSnap(out);
  setCanonicalDoorsPerHour(out, (canonDph != null && isFinite(canonDph)) ? canonDph : safeNum(base.doorsPerHour3));
  out.ui.assumptionsProfile = deriveAssumptionsProfileFromState(out);
  out.ui.themeMode = "system";
  out.ui.dark = false;
  return out;
}

function canonicalDoorsPerHourFromSnap(snap){
  const s = snap || {};
  const canonical = safeNum(s.doorsPerHour3);
  if (canonical != null && isFinite(canonical)) return canonical;
  const legacy = safeNum(s.doorsPerHour);
  if (legacy != null && isFinite(legacy)) return legacy;
  return null;
}

function setCanonicalDoorsPerHour(target, value){
  if (!target || typeof target !== "object") return;
  const n = safeNum(value);
  const next = (n != null && isFinite(n)) ? n : "";
  target.doorsPerHour3 = next;
  target.doorsPerHour = next; // legacy compatibility mirror
}

function requiredScenarioKeysMissing(scen){
  const required = [
    "scenarioName","raceType","electionDate","weeksRemaining","mode",
    "universeBasis","universeSize","turnoutA","turnoutB","bandWidth",
    "candidates","undecidedPct","yourCandidateId","undecidedMode","persuasionPct",
    "earlyVoteExp","supportRatePct","contactRatePct","turnoutReliabilityPct",
    "universeLayerEnabled","universeDemPct","universeRepPct","universeNpaPct","universeOtherPct","retentionFactor",
    "mcMode","mcVolatility","mcSeed","budget","timelineEnabled","ui"
  ];
  const missing = [];
  if (!scen || typeof scen !== "object") return required.slice();
  for (const k of required){
    if (!(k in scen)) missing.push(k);
  }
  return missing;
}

function derivedWeeksRemaining(){
  const override = safeNum(state.weeksRemaining);
  if (override != null && override >= 0) return override;

  const d = state.electionDate;
  if (!d) return null;
  const now = new Date();
  const election = new Date(d + "T00:00:00");
  const days = daysBetween(now, election);
  if (days == null) return null;
  return Math.max(0, Math.ceil(days / 7));
}

function getUniverseLayerConfig(){
  const enabled = !!state.universeLayerEnabled;
  const demPct = safeNum(state.universeDemPct);
  const repPct = safeNum(state.universeRepPct);
  const npaPct = safeNum(state.universeNpaPct);
  const otherPct = safeNum(state.universeOtherPct);
  const retentionFactor = safeNum(state.retentionFactor);

  const norm = normalizeUniversePercents({ demPct, repPct, npaPct, otherPct });
  return {
    enabled,
    percents: norm.percents,
    shares: norm.shares,
    retentionFactor: (retentionFactor != null) ? clamp(retentionFactor, 0.60, 0.95) : UNIVERSE_DEFAULTS.retentionFactor,
    warning: norm.warning || "",
    wasNormalized: !!norm.normalized,
  };
}

function getEffectiveBaseRates(){
  const cr = (safeNum(state.contactRatePct) != null) ? clamp(safeNum(state.contactRatePct), 0, 100) / 100 : null;
  const sr = (safeNum(state.supportRatePct) != null) ? clamp(safeNum(state.supportRatePct), 0, 100) / 100 : null;
  const tr = (safeNum(state.turnoutReliabilityPct) != null) ? clamp(safeNum(state.turnoutReliabilityPct), 0, 100) / 100 : null;

  const cfg = getUniverseLayerConfig();
  const adj = computeUniverseAdjustedRates({
    enabled: cfg.enabled,
    universePercents: cfg.percents,
    retentionFactor: cfg.retentionFactor,
    supportRate: sr,
    turnoutReliability: tr,
  });

  return {
    cr,
    sr: adj.srAdj,
    tr: adj.trAdj,
    cfg,
    meta: adj.meta,
    volatilityBoost: adj.volatilityBoost || 0,
  };
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
  if (!els.retentionFactor && !els.universe16Enabled) return;
  const cfg = getUniverseLayerConfig();

  // UI fields
  if (els.universe16Enabled) els.universe16Enabled.checked = !!state.universeLayerEnabled;
  const setIf = (el, v) => { if (el) el.value = (v == null || !isFinite(v)) ? "" : String(Number(v).toFixed(1)); };
  setIf(els.universe16DemPct, cfg.percents.demPct);
  setIf(els.universe16RepPct, cfg.percents.repPct);
  setIf(els.universe16NpaPct, cfg.percents.npaPct);
  setIf(els.universe16OtherPct, cfg.percents.otherPct);
  if (els.retentionFactor) els.retentionFactor.value = String((cfg.retentionFactor ?? UNIVERSE_DEFAULTS.retentionFactor).toFixed(2));

  // Disable inputs when OFF
  const disabled = !cfg.enabled;
  for (const el of [els.universe16DemPct, els.universe16RepPct, els.universe16NpaPct, els.universe16OtherPct, els.retentionFactor]){
    if (el) el.disabled = disabled;
  }

  // Derived display
  const eff = getEffectiveBaseRates();
  if (els.universe16Derived){
    if (!cfg.enabled){
      els.universe16Derived.textContent = "Disabled (baseline behavior).";
    } else {
      const pm = eff?.meta?.persuasionMultiplier;
      const tm = eff?.meta?.turnoutMultiplier;
      const tb = eff?.meta?.turnoutBoostApplied;
      const parts = [];
      parts.push(`Persuasion multiplier: ${(pm != null && isFinite(pm)) ? pm.toFixed(2) : "—"}`);
      parts.push(`Turnout multiplier: ${(tm != null && isFinite(tm)) ? tm.toFixed(2) : "—"}`);
      parts.push(`Turnout boost: ${(tb != null && isFinite(tb)) ? (100*tb).toFixed(1) + "%" : "—"}`);
      parts.push(`Effective support rate: ${(eff.sr != null && isFinite(eff.sr)) ? (100*eff.sr).toFixed(1) + "%" : "—"}`);
      parts.push(`Effective turnout reliability: ${(eff.tr != null && isFinite(eff.tr)) ? (100*eff.tr).toFixed(1) + "%" : "—"}`);
      els.universe16Derived.textContent = parts.join(" · ");
    }
  }

  // Warning banner
  if (els.universe16Warn){
    if (cfg.enabled && cfg.wasNormalized && cfg.warning){
      els.universe16Warn.hidden = false;
      els.universe16Warn.textContent = cfg.warning;
    } else {
      els.universe16Warn.hidden = true;
      els.universe16Warn.textContent = "";
    }
  }
}

function safeCall(fn){
  try{ fn(); } catch(e){ /* keep UI alive */ }
}

function switchToStage(stageId){
  const id = String(stageId || "").trim();
  if (!id) return;
  const btn = document.querySelector(`.nav-item-new[data-stage="${id}"]`);
  if (btn && typeof window.switchStage === "function"){
    window.switchStage(btn, id);
    return;
  }
  document.querySelectorAll(".nav-item-new").forEach((el) => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".stage-new").forEach((el) => el.classList.remove("active-stage"));
  const target = document.getElementById(`stage-${id}`);
  if (target) target.classList.add("active-stage");
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
  const weeks = derivedWeeksRemaining();

  const modelInput = {
    universeSize: safeNum(state.universeSize),
    turnoutA: safeNum(state.turnoutA),
    turnoutB: safeNum(state.turnoutB),
    bandWidth: safeNum(state.bandWidth),
    candidates: state.candidates.map(c => ({ id: c.id, name: c.name, supportPct: safeNum(c.supportPct) })),
    undecidedPct: safeNum(state.undecidedPct),
    yourCandidateId: state.yourCandidateId,
    undecidedMode: state.undecidedMode,
    userSplit: state.userSplit,
    persuasionPct: safeNum(state.persuasionPct),
    earlyVoteExp: safeNum(state.earlyVoteExp),
  };

  const res = engine.computeAll(modelInput);

  const needVotes = deriveNeedVotes(res);
  lastRenderCtx = { res, weeks, needVotes, modelInput };

  els.turnoutExpected.textContent = res.turnout.expectedPct == null ? "—" : `${res.turnout.expectedPct.toFixed(1)}%`;
  els.turnoutBand.textContent = res.turnout.bestPct == null ? "—" : `${res.turnout.bestPct.toFixed(1)}% / ${res.turnout.worstPct.toFixed(1)}%`;
  els.votesPer1pct.textContent = (res.turnout.votesPer1pct == null) ? "—" : fmtInt(res.turnout.votesPer1pct);

  els.supportTotal.textContent = res.validation.supportTotalPct == null ? "—" : `${res.validation.supportTotalPct.toFixed(1)}%`;

  els.candWarn.hidden = res.validation.candidateTableOk;
  els.candWarn.textContent = res.validation.candidateTableOk ? "" : res.validation.candidateTableMsg;

  setText(els.kpiTurnoutVotesSidebar, res.expected.turnoutVotes == null ? "—" : fmtInt(res.expected.turnoutVotes));
  setText(els.kpiTurnoutBandSidebar, res.turnout.bandVotesText || "—");

  setText(els.kpiWinThresholdSidebar, res.expected.winThreshold == null ? "—" : fmtInt(res.expected.winThreshold));
  setText(els.kpiYourVotesSidebar, res.expected.yourVotes == null ? "—" : fmtInt(res.expected.yourVotes));
  setText(els.kpiYourVotesShareSidebar, res.expected.yourShareText || "—");

  setText(els.kpiPersuasionNeedSidebar, res.expected.persuasionNeed == null ? "—" : fmtInt(res.expected.persuasionNeed));
  setText(els.kpiPersuasionStatusSidebar, res.expected.persuasionStatus || "—");

  setText(els.miniEarlyVotesSidebar, res.expected.earlyVotes == null ? "—" : fmtInt(res.expected.earlyVotes));
  setText(els.miniEDVotesSidebar, res.expected.edVotes == null ? "—" : fmtInt(res.expected.edVotes));
  setText(els.miniEarlyNoteSidebar, res.expected.earlyNote || "—");

  setText(els.miniPersUniverseSidebar, res.expected.persuasionUniverse == null ? "—" : fmtInt(res.expected.persuasionUniverse));
  setText(els.miniPersCheckSidebar, res.expected.persuasionUniverseCheck || "—");
  setText(els.metaUniverseBasis, state.universeBasis || "—");
  setText(els.metaSourceNote, state.sourceNote || "—");

  safeCall(() => renderStress(res));
  safeCall(() => renderValidation(res, weeks));
  safeCall(() => renderAssumptions(res, weeks));
  safeCall(() => renderGuardrails(res));
  safeCall(() => renderConversion(res, weeks));
  safeCall(() => renderPhase3(res, weeks));
  safeCall(() => renderWeeklyOps(res, weeks));
  safeCall(() => renderWeeklyOpsInsights(res, weeks));
  safeCall(() => renderWeeklyOpsFreshness(res, weeks));
  safeCall(() => scheduleOperationsCapacityOutlookRender(weeks));
  safeCall(() => renderAssumptionDriftE1(res, weeks));
  safeCall(() => renderRiskFramingE2());
  safeCall(() => renderBottleneckAttributionE3(res, weeks));
  safeCall(() => renderSensitivitySnapshotE4());
  safeCall(() => renderDecisionConfidenceE5(res, weeks));
  safeCall(() => renderImpactTraceE6(res, weeks));

  safeCall(() => renderUniverse16Card());

  safeCall(() => renderRoi(res, weeks));
  safeCall(() => renderOptimization(res, weeks));
  safeCall(() => renderTimeline(res, weeks));
  safeCall(() => renderDecisionIntelligencePanel({ res, weeks }));

  // Phase 9A — build immutable results snapshot for export.js (pure serialization layer)
  try {
    lastResultsSnapshot = {
      schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
      appVersion: engine.snapshot.MODEL_VERSION,
      modelVersion: engine.snapshot.MODEL_VERSION,
      scenarioState: structuredClone(state),
      planRows: structuredClone(state.ui?.lastPlanRows || []),
      planMeta: structuredClone(state.ui?.lastPlanMeta || {}),
      summary: structuredClone(state.ui?.lastSummary || {})
    };
    lastResultsSnapshot.snapshotHash = engine.snapshot.computeSnapshotHash({ modelVersion: engine.snapshot.MODEL_VERSION, scenarioState: lastResultsSnapshot.scenarioState });
  } catch {
    lastResultsSnapshot = null;
  }

  setText(els.snapshotHash, lastResultsSnapshot?.snapshotHash || "—");
  setText(els.snapshotHashSidebar, lastResultsSnapshot?.snapshotHash || "—");
  els.explainCard.hidden = !state.ui.training;
}

function renderWeeklyOps(res, weeks){
  if (!els.wkGoal) return;

  const rawGoal = safeNum(state.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

  const eff = getEffectiveBaseRates();
  const sr = eff.sr;
  const cr = eff.cr;

  const fmtMaybeInt = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtMaybe = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.round(v));

  els.wkGoal.textContent = (goal == null) ? "—" : fmtInt(Math.round(goal));

  // Requirements per week
  let convosNeeded = null;
  let attemptsNeeded = null;
  let convosPerWeek = null;
  let attemptsPerWeek = null;

  if (goal > 0 && sr && sr > 0) convosNeeded = goal / sr;
  if (convosNeeded != null && cr && cr > 0) attemptsNeeded = convosNeeded / cr;
  if (weeks != null && weeks > 0){
    if (convosNeeded != null) convosPerWeek = convosNeeded / weeks;
    if (attemptsNeeded != null) attemptsPerWeek = attemptsNeeded / weeks;
  }

  els.wkConvosPerWeek.textContent = fmtMaybeInt(convosPerWeek);
  els.wkAttemptsPerWeek.textContent = fmtMaybeInt(attemptsPerWeek);

  // Capacity per week (Phase 3 inputs)
  const orgCount = safeNum(state.orgCount);
  const orgHoursPerWeek = safeNum(state.orgHoursPerWeek);
  const volunteerMult = safeNum(state.volunteerMultBase);
  const doorShare = safeNum(state.channelDoorPct);
  const doorsPerHour = safeNum(state.doorsPerHour3);
  const callsPerHour = safeNum(state.callsPerHour3);

  const cap = coreComputeCapacityBreakdown({
    weeks: 1,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare: (doorShare == null) ? null : clamp(doorShare / 100, 0, 1),
    doorsPerHour,
    callsPerHour
  });

  const capTotal = cap?.total ?? null;
  els.wkCapacityPerWeek.textContent = fmtMaybeInt(capTotal);
  if (els.wkCapacityBreakdown){
    if (cap && cap.doors != null && cap.phones != null){
      els.wkCapacityBreakdown.textContent = `${fmtMaybe(cap.doors)} doors + ${fmtMaybe(cap.phones)} calls`;
    } else {
      els.wkCapacityBreakdown.textContent = "—";
    }
  }

  // Gap + constraint
  let gap = null;
  if (attemptsPerWeek != null && capTotal != null) gap = attemptsPerWeek - capTotal;

  if (els.wkGapPerWeek){
    if (gap == null) els.wkGapPerWeek.textContent = "—";
    else {
      const g = Math.ceil(gap);
      els.wkGapPerWeek.textContent = (g <= 0) ? "0" : fmtInt(g);
    }
  }

  let constraint = "—";
  let note = "—";
  let bannerMsg = "";
  let bannerKind = "warn";
  let bannerShow = false;

  if (goal <= 0){
    constraint = "None";
    note = "Goal is 0 under current inputs.";
  } else if (weeks == null || weeks <= 0){
    constraint = "Timeline";
    note = "Set election date or weeks remaining.";
    bannerMsg = "This week plan needs weeks remaining. Set an election date or enter weeks remaining to compute per-week targets.";
    bannerShow = true;
  } else if (sr == null || sr <= 0 || cr == null || cr <= 0){
    constraint = "Rates";
    note = "Enter support rate + contact rate.";
    bannerMsg = "This week plan needs Support rate and Contact rate (Phase 2).";
    bannerShow = true;
  } else if (capTotal == null){
    constraint = "Capacity";
    note = "Enter organizers/hours + speeds (Phase 3).";
    bannerMsg = "Capacity/week is missing. Fill Phase 3 execution inputs (organizers, hours/week, doors/hr, calls/hr, channel split).";
    bannerShow = true;
  } else if (gap != null && gap <= 0){
    constraint = "Feasible";
    note = "Capacity covers required attempts/week.";
    bannerMsg = `Feasible: capacity covers the per-week requirement under current rates.`;
    bannerKind = "ok";
    bannerShow = true;
  } else if (gap != null){
    constraint = "Capacity";
    const g = Math.ceil(gap);
    note = `Short by ~${fmtInt(g)} attempts/week.`;
    bannerMsg = `Gap: you are short by ~${fmtInt(g)} attempts per week. Options: increase organizers/hours, improve speeds, shift channel mix, or raise rates.`;
    bannerKind = (g <= 500) ? "warn" : "bad";
    bannerShow = true;
  }

  if (els.wkConstraint) els.wkConstraint.textContent = constraint;
  if (els.wkConstraintNote) els.wkConstraintNote.textContent = note;

  if (els.wkBanner){
    els.wkBanner.hidden = !bannerShow;
    if (bannerShow){
      els.wkBanner.classList.remove("ok","warn","bad");
      els.wkBanner.classList.add(bannerKind);
      els.wkBanner.textContent = bannerMsg;
    }
  }


  const ctx = computeWeeklyOpsContext(res, weeks);
  renderWeeklyExecutionStatus(ctx);
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
  const reqConvos = ctx?.convosPerWeek;
  const reqAttempts = ctx?.attemptsPerWeek;

  if (els.wkReqConvosWeek) els.wkReqConvosWeek.textContent = (reqConvos == null || !isFinite(reqConvos)) ? "—" : fmtInt(Math.ceil(reqConvos));
  if (els.wkReqAttemptsWeek) els.wkReqAttemptsWeek.textContent = (reqAttempts == null || !isFinite(reqAttempts)) ? "—" : fmtInt(Math.ceil(reqAttempts));

  const last7 = computeLastNLogSums(7);

  const clearAll = () => {
    if (els.wkActConvos7) els.wkActConvos7.textContent = "—";
    if (els.wkActAttempts7) els.wkActAttempts7.textContent = "—";
    if (els.wkGapConvos) els.wkGapConvos.textContent = "—";
    if (els.wkGapAttempts) els.wkGapAttempts.textContent = "—";
    if (els.wkActConvosNote) els.wkActConvosNote.textContent = "Insufficient field data.";
    if (els.wkActAttemptsNote) els.wkActAttemptsNote.textContent = "Insufficient field data.";
    setTag(els.wkConvosPaceTag, null, "—");
    setTag(els.wkAttemptsPaceTag, null, "—");
    if (els.wkReqDoorAttemptsWeek) els.wkReqDoorAttemptsWeek.textContent = "—";
    if (els.wkReqCallAttemptsWeek) els.wkReqCallAttemptsWeek.textContent = "—";
    if (els.wkImpliedConvosWeek) els.wkImpliedConvosWeek.textContent = "—";
    if (els.wkImpliedConvosNote) els.wkImpliedConvosNote.textContent = "Insufficient field data.";
    if (els.wkFinishConvos) els.wkFinishConvos.textContent = "—";
    if (els.wkFinishAttempts) els.wkFinishAttempts.textContent = "—";
    if (els.wkPaceStatus) els.wkPaceStatus.textContent = "—";
    if (els.wkPaceNote) els.wkPaceNote.textContent = "Insufficient field data.";
    if (els.wkExecBanner){
      els.wkExecBanner.hidden = true;
      els.wkExecBanner.classList.remove("ok","warn","bad");
      els.wkExecBanner.classList.add("warn");
      els.wkExecBanner.textContent = "";
    }
  };

  if (!last7.hasLog || last7.n === 0){
    clearAll();
    return;
  }

  const actualConvos = last7.sumConvos;
  const actualAttempts = last7.sumAttempts;

  if (els.wkActConvos7) els.wkActConvos7.textContent = fmtInt(Math.round(actualConvos));
  if (els.wkActAttempts7) els.wkActAttempts7.textContent = fmtInt(Math.round(actualAttempts));
  if (els.wkActConvosNote) els.wkActConvosNote.textContent = `${last7.n} entries over ~${last7.days} day(s) · last: ${last7.lastDate || "—"}`;
  if (els.wkActAttemptsNote) els.wkActAttemptsNote.textContent = `${last7.n} entries over ~${last7.days} day(s) · last: ${last7.lastDate || "—"}`;

  const paceKind = (req, actual) => {
    if (req == null || !isFinite(req) || req <= 0) return { kind:null, label:"—", gap:null };
    const gap = actual - req;
    if (actual >= req) return { kind:"ok", label:"On pace", gap };
    if (actual >= req * 0.9) return { kind:"warn", label:"Within 10%", gap };
    return { kind:"bad", label:"Behind", gap };
  };

  const convosPace = paceKind(reqConvos, actualConvos);
  const attemptsPace = paceKind(reqAttempts, actualAttempts);

  if (els.wkGapConvos){
    els.wkGapConvos.textContent = (convosPace.gap == null) ? "—" : ((convosPace.gap >= 0) ? `+${fmtInt(Math.round(convosPace.gap))}` : `${fmtInt(Math.round(convosPace.gap))}`);
  }
  if (els.wkGapAttempts){
    els.wkGapAttempts.textContent = (attemptsPace.gap == null) ? "—" : ((attemptsPace.gap >= 0) ? `+${fmtInt(Math.round(attemptsPace.gap))}` : `${fmtInt(Math.round(attemptsPace.gap))}`);
  }

  setTag(els.wkConvosPaceTag, convosPace.kind, convosPace.label);
  setTag(els.wkAttemptsPaceTag, attemptsPace.kind, attemptsPace.label);

  const doorShare = (ctx?.doorShare != null && isFinite(ctx.doorShare)) ? clamp(ctx.doorShare, 0, 1) : null;
  const reqDoorAttempts = (reqAttempts != null && isFinite(reqAttempts) && doorShare != null) ? (reqAttempts * doorShare) : null;
  const reqCallAttempts = (reqAttempts != null && isFinite(reqAttempts) && doorShare != null) ? (reqAttempts * (1 - doorShare)) : null;

  if (els.wkReqDoorAttemptsWeek) els.wkReqDoorAttemptsWeek.textContent = (reqDoorAttempts == null) ? "—" : fmtInt(Math.ceil(reqDoorAttempts));
  if (els.wkReqCallAttemptsWeek) els.wkReqCallAttemptsWeek.textContent = (reqCallAttempts == null) ? "—" : fmtInt(Math.ceil(reqCallAttempts));

  const rollingCR = (actualAttempts > 0) ? (actualConvos / actualAttempts) : null;
  if (els.wkImpliedConvosWeek){
    if (rollingCR == null || reqAttempts == null || !isFinite(reqAttempts)){
      els.wkImpliedConvosWeek.textContent = "—";
    } else {
      els.wkImpliedConvosWeek.textContent = fmtInt(Math.round(reqAttempts * rollingCR));
    }
  }
  if (els.wkImpliedConvosNote){
    if (rollingCR == null){
      els.wkImpliedConvosNote.textContent = "Insufficient field data.";
    } else {
      const pct = Math.round(rollingCR * 1000) / 10;
      els.wkImpliedConvosNote.textContent = `Uses rolling 7-entry contact rate (${pct}%)`;
    }
  }

  const paceAttemptsPerDay = (last7.days && last7.days > 0) ? (actualAttempts / last7.days) : null;
  const paceConvosPerDay = (last7.days && last7.days > 0) ? (actualConvos / last7.days) : null;

  const finishFrom = (total, pacePerDay) => {
    if (total == null || !isFinite(total) || total <= 0) return { date:null, note:"No target" };
    if (pacePerDay == null || !isFinite(pacePerDay) || pacePerDay <= 0) return { date:null, note:"No measurable pace" };
    const daysNeeded = Math.ceil(total / pacePerDay);
    const d = new Date();
    d.setHours(12,0,0,0);
    d.setDate(d.getDate() + daysNeeded);
    return { date:d, note:`~${fmtInt(daysNeeded)} day(s) at current pace` };
  };

  const convFinish = finishFrom(ctx?.convosNeeded ?? (ctx?.convosPerWeek != null && ctx?.weeks != null ? ctx.convosPerWeek * ctx.weeks : null), paceConvosPerDay);
  const attFinish = finishFrom(ctx?.attemptsNeeded ?? (ctx?.attemptsPerWeek != null && ctx?.weeks != null ? ctx.attemptsPerWeek * ctx.weeks : null), paceAttemptsPerDay);

  if (els.wkFinishConvos) els.wkFinishConvos.textContent = convFinish.date ? fmtISODate(convFinish.date) : (convFinish.note || "—");
  if (els.wkFinishAttempts) els.wkFinishAttempts.textContent = attFinish.date ? fmtISODate(attFinish.date) : (attFinish.note || "—");

  let paceStatus = "—";
  let paceNote = "";
  let bannerKind = null;

  const worst = (a,b) => {
    const rank = { ok:3, warn:2, bad:1, null:0, undefined:0 };
    return (rank[a] <= rank[b]) ? a : b;
  };

  bannerKind = worst(convosPace.kind, attemptsPace.kind);

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

  if (els.wkPaceStatus) els.wkPaceStatus.textContent = paceStatus;
  if (els.wkPaceNote) els.wkPaceNote.textContent = paceNote;

  if (els.wkExecBanner){
    const show = (bannerKind === "ok" || bannerKind === "warn" || bannerKind === "bad");
    els.wkExecBanner.hidden = !show;
    if (show){
      els.wkExecBanner.classList.remove("ok","warn","bad");
      els.wkExecBanner.classList.add(bannerKind);
      const a = (reqAttempts != null && isFinite(reqAttempts)) ? Math.ceil(reqAttempts) : null;
      const c = (reqConvos != null && isFinite(reqConvos)) ? Math.ceil(reqConvos) : null;
      const ar = Math.round(actualAttempts);
      const crn = Math.round(actualConvos);
      els.wkExecBanner.textContent = `Last 7: ${fmtInt(crn)} convos / ${fmtInt(ar)} attempts vs required ${c != null ? fmtInt(c) : "—"} convos / ${a != null ? fmtInt(a) : "—"} attempts per week.`;
    }
  }
}

function computeWeeklyOpsContext(res, weeks){
  const rawGoal = safeNum(state.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

  const effective = compileEffectiveInputs(state);
  const sr = effective.rates.sr;
  const cr = effective.rates.cr;

  let convosNeeded = null;
  let attemptsNeeded = null;
  let convosPerWeek = null;
  let attemptsPerWeek = null;

  if (goal > 0 && sr && sr > 0) convosNeeded = goal / sr;
  if (convosNeeded != null && cr && cr > 0) attemptsNeeded = convosNeeded / cr;
  if (weeks != null && weeks > 0){
    if (convosNeeded != null) convosPerWeek = convosNeeded / weeks;
    if (attemptsNeeded != null) attemptsPerWeek = attemptsNeeded / weeks;
  }

  const orgCount = effective.capacity.orgCount;
  const orgHoursPerWeek = effective.capacity.orgHoursPerWeek;
  const volunteerMult = effective.capacity.volunteerMult;
  const doorSharePct = effective.capacity.doorSharePct;
  const doorsPerHour = effective.capacity.doorsPerHour;
  const callsPerHour = effective.capacity.callsPerHour;

  const doorShare = effective.capacity.doorShare;

  const cap = coreComputeCapacityBreakdown({
    weeks: 1,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour
  });

  const capTotal = cap?.total ?? null;
  const gap = (attemptsPerWeek != null && capTotal != null) ? (attemptsPerWeek - capTotal) : null;

  return {
    goal,
    weeks,
    sr,
    cr,
    convosNeeded,
    attemptsNeeded,
    convosPerWeek,
    attemptsPerWeek,
    cap,
    capTotal,
    gap,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour
  };
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

  if (kind === "contact"){
    const v = pct1(drift.actualCR);
    if (v == null){
      if (els.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling contact rate is unavailable";
      return;
    }
    state.contactRatePct = v;
    if (els.contactRatePct) els.contactRatePct.value = String(v);
    if (els.applyRollingMsg) els.applyRollingMsg.textContent = `Set assumed contact rate to ${v}%`;
  } else if (kind === "support"){
    const v = pct1(drift.actualSR);
    if (v == null){
      if (els.applyRollingMsg) els.applyRollingMsg.textContent = "Rolling support rate is unavailable";
      return;
    }
    state.supportRatePct = v;
    if (els.supportRatePct) els.supportRatePct.value = String(v);
    if (els.applyRollingMsg) els.applyRollingMsg.textContent = `Set assumed support rate to %`;
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
  if (!els.stressBox) return;
  const lines = res.stressSummary || [];
  els.stressBox.innerHTML = "";
  if (!lines.length){
    const div = document.createElement("div");
    div.className = "stress-item";
    div.textContent = "—";
    els.stressBox.appendChild(div);
    return;
  }
  for (const s of lines){
    const div = document.createElement("div");
    div.className = "stress-item";
    div.textContent = s;
    els.stressBox.appendChild(div);
  }
}

function renderValidation(res, weeks){
  const list = els.validationList || els.validationListSidebar;
  if (!list) return;
  const items = [];

  const uOk = res.validation.universeOk;
  items.push({
    kind: uOk ? "ok" : "bad",
    text: uOk ? "Universe size set." : "Universe size missing or invalid."
  });

  const turnoutOk = res.validation.turnoutOk;
  items.push({
    kind: turnoutOk ? "ok" : "warn",
    text: turnoutOk ? "Turnout baseline set (2 cycles + band)." : "Turnout baseline incomplete. Add Cycle A and Cycle B turnout %."
  });

  const candOk = res.validation.candidateTableOk;
  items.push({
    kind: candOk ? "ok" : "bad",
    text: candOk ? "Candidate + undecided totals = 100%." : "Candidate + undecided totals must equal 100%."
  });

  const splitOk = res.validation.userSplitOk;
  if (state.undecidedMode === "user_defined"){
    items.push({
      kind: splitOk ? "ok" : "bad",
      text: splitOk ? "User-defined undecided split totals = 100%." : "User-defined undecided split must total 100% across candidates."
    });
  }

  const persOk = res.validation.persuasionOk;
  items.push({
    kind: persOk ? "ok" : "warn",
    text: persOk ? "Persuasion % set." : "Persuasion % missing."
  });

  if (weeks != null){
    items.push({
      kind: "ok",
      text: `Weeks remaining: ${weeks} (reference for later phases).`
    });
  }

  const seen = new Set();
  const deduped = [];
  for (const it of items){
    const key = `${it.kind}::${it.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  list.innerHTML = "";
  for (const it of deduped){
    const li = document.createElement("li");
    li.className = it.kind;
    li.textContent = it.text;
    list.appendChild(li);
  }
}

function renderAssumptions(res, weeks){
  const blocks = [];

  blocks.push(block("Race & scenario", [
    kv("Scenario", state.scenarioName || "—"),
    kv("Template", labelTemplate(state.raceType)),
    kv("Assumptions profile", assumptionsProfileLabel(state)),
    kv("Mode", state.mode === "late_start" ? "Late-start / turnout-heavy" : "Persuasion-first"),
    kv("Election date", state.electionDate || "—"),
    kv("Weeks remaining", weeks == null ? "—" : String(weeks)),
  ]));

  blocks.push(block("Universe & turnout", [
    kv("Universe basis", state.universeBasis === "active" ? "Active (advanced)" : "Registered"),
    kv("Universe size", res.raw.universeSize == null ? "—" : fmtInt(res.raw.universeSize)),
    kv("Turnout cycles", (res.raw.turnoutA == null || res.raw.turnoutB == null) ? "—" : `${res.raw.turnoutA.toFixed(1)}% & ${res.raw.turnoutB.toFixed(1)}%`),
    kv("Expected turnout", res.turnout.expectedPct == null ? "—" : `${res.turnout.expectedPct.toFixed(1)}%`),
    kv("Band width", res.raw.bandWidth == null ? "—" : `±${res.raw.bandWidth.toFixed(1)}%`),
    kv("Votes per 1% turnout", res.turnout.votesPer1pct == null ? "—" : fmtInt(res.turnout.votesPer1pct)),
    kv("Source note", state.sourceNote || "—"),
  ]));

  blocks.push(block("Vote landscape", [
    kv("Candidates", String(state.candidates.length)),
    kv("Undecided break", labelUndecidedMode(state.undecidedMode)),
    kv("You are", getYourName() || "—"),
  ]));

  blocks.push(block("Persuasion & early vote", [
    kv("Persuasion % of universe", res.raw.persuasionPct == null ? "—" : `${res.raw.persuasionPct.toFixed(1)}%`),
    kv("Early vote % (Expected)", res.raw.earlyVoteExp == null ? "—" : `${res.raw.earlyVoteExp.toFixed(1)}%`),
  ]));

  if (!els.assumptionsSnapshot) return;
  els.assumptionsSnapshot.innerHTML = "";
  for (const b of blocks) els.assumptionsSnapshot.appendChild(b);
}

function renderGuardrails(res){
  const gs = [];
  for (const g of res.guardrails){
    gs.push(block(g.title, g.lines.map(l => kv(l.k, l.v))));
  }
  if (!els.guardrails) return;
  els.guardrails.innerHTML = "";
  if (!gs.length){
    els.guardrails.textContent = "—";
    return;
  }
  for (const b of gs) els.guardrails.appendChild(b);
}

function block(title, kvs){
  const div = document.createElement("div");
  div.className = "assump-block";
  const t = document.createElement("div");
  t.className = "assump-title";
  t.textContent = title;
  const body = document.createElement("div");
  body.className = "assump-body";
  for (const row of kvs) body.appendChild(row);
  div.appendChild(t);
  div.appendChild(body);
  return div;
}

function kv(k, v){
  const row = document.createElement("div");
  row.className = "kv";
  const dk = document.createElement("div");
  dk.className = "k";
  dk.textContent = k;
  const dv = document.createElement("div");
  dv.className = "v";
  dv.textContent = v;
  row.appendChild(dk);
  row.appendChild(dv);
  return row;
}

function labelTemplate(v){
  if (v === "federal") return "Federal (US House)";
  if (v === "municipal") return "Municipal / ward";
  if (v === "county") return "County / regional";
  return "State legislative";
}

function labelUndecidedMode(v){
  if (v === "user_defined") return "User-defined split";
  if (v === "against") return "Conservative against you";
  if (v === "toward") return "Conservative toward you";
  return "Proportional";
}

function getYourName(){
  const c = state.candidates.find(x => x.id === state.yourCandidateId);
  return c?.name || null;
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
  const enabled = !!snap?.universeLayerEnabled;
  const demPct = safeNum(snap?.universeDemPct);
  const repPct = safeNum(snap?.universeRepPct);
  const npaPct = safeNum(snap?.universeNpaPct);
  const otherPct = safeNum(snap?.universeOtherPct);
  const retentionFactor = safeNum(snap?.retentionFactor);

  const norm = normalizeUniversePercents({ demPct, repPct, npaPct, otherPct });
  return {
    enabled,
    percents: norm.percents,
    shares: norm.shares,
    retentionFactor: (retentionFactor != null) ? clamp(retentionFactor, 0.60, 0.95) : UNIVERSE_DEFAULTS.retentionFactor,
    warning: norm.warning || "",
    wasNormalized: !!norm.normalized,
  };
}

function getEffectiveBaseRatesFromSnap(snap){
  const cr = (safeNum(snap?.contactRatePct) != null) ? clamp(safeNum(snap?.contactRatePct), 0, 100) / 100 : null;
  const sr = (safeNum(snap?.supportRatePct) != null) ? clamp(safeNum(snap?.supportRatePct), 0, 100) / 100 : null;
  const tr = (safeNum(snap?.turnoutReliabilityPct) != null) ? clamp(safeNum(snap?.turnoutReliabilityPct), 0, 100) / 100 : null;

  const cfg = getUniverseLayerConfigFromSnap(snap);
  const adj = computeUniverseAdjustedRates({
    enabled: cfg.enabled,
    universePercents: cfg.percents,
    retentionFactor: cfg.retentionFactor,
    supportRate: sr,
    turnoutReliability: tr,
  });

  return {
    cr,
    sr: adj.srAdj,
    tr: adj.trAdj,
    cfg,
    meta: adj.meta,
    volatilityBoost: adj.volatilityBoost || 0,
  };
}

function computeWeeklyOpsContextFromSnap(snap, res, weeks){
  const rawGoal = safeNum(snap?.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

  const eff = getEffectiveBaseRatesFromSnap(snap);
  const sr = eff.sr;
  const cr = eff.cr;

  let convosNeeded = null;
  let attemptsNeeded = null;
  let convosPerWeek = null;
  let attemptsPerWeek = null;

  if (goal > 0 && sr && sr > 0) convosNeeded = goal / sr;
  if (convosNeeded != null && cr && cr > 0) attemptsNeeded = convosNeeded / cr;
  if (weeks != null && weeks > 0){
    if (convosNeeded != null) convosPerWeek = convosNeeded / weeks;
    if (attemptsNeeded != null) attemptsPerWeek = attemptsNeeded / weeks;
  }

  const orgCount = safeNum(snap?.orgCount);
  const orgHoursPerWeek = safeNum(snap?.orgHoursPerWeek);
  const volunteerMult = safeNum(snap?.volunteerMultBase);
  const doorSharePct = safeNum(snap?.channelDoorPct);
  const doorsPerHour = safeNum(snap?.doorsPerHour3);
  const callsPerHour = safeNum(snap?.callsPerHour3);

  const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct / 100, 0, 1);

  const cap = coreComputeCapacityBreakdown({
    weeks: 1,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour
  });

  const capTotal = cap?.total ?? null;
  const gap = (attemptsPerWeek != null && capTotal != null) ? (attemptsPerWeek - capTotal) : null;

  return {
    goal,
    weeks,
    sr,
    cr,
    convosNeeded,
    attemptsNeeded,
    convosPerWeek,
    attemptsPerWeek,
    cap,
    capTotal,
    gap,
  };
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
      const weeks = engine.withPatchedState(snap, () => engine.derivedWeeksRemaining());
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

function createScenarioRecord({ name, fromInputs, fromOutputs }){
  const id = "scn_" + uid() + Date.now().toString(16);
  const nm = (name || "").trim() || `Scenario ${Object.keys(state.ui.scenarios || {}).length}`;
  return {
    id,
    name: nm,
    inputs: scenarioClone(fromInputs || {}),
    outputs: scenarioClone(fromOutputs || {}),
    createdAt: new Date().toISOString()
  };
}

function onScenarioSaveNew(){
  ensureScenarioRegistry();
  const reg = state.ui.scenarios;
  const count = Object.keys(reg).length;
  if (count >= SCENARIO_MAX){
    setScenarioWarn(`Max scenarios reached (${SCENARIO_MAX}). Delete one to save a new scenario.`);
    return;
  }

  const nm = els.scenarioNewName ? els.scenarioNewName.value : "";
  const rec = createScenarioRecord({
    name: nm,
    fromInputs: scenarioInputsFromState(state),
    fromOutputs: scenarioOutputsFromState(state)
  });
  reg[rec.id] = rec;
  state.ui.scenarioUiSelectedId = rec.id;
  if (els.scenarioNewName) els.scenarioNewName.value = "";
  persist();
  renderScenarioManagerC1();
}

function onScenarioCloneBaseline(){
  ensureScenarioRegistry();
  const reg = state.ui.scenarios;
  const count = Object.keys(reg).length;
  if (count >= SCENARIO_MAX){
    setScenarioWarn(`Max scenarios reached (${SCENARIO_MAX}). Delete one to clone baseline.`);
    return;
  }

  const base = reg[SCENARIO_BASELINE_ID];
  const nm = els.scenarioNewName ? els.scenarioNewName.value : "";
  const rec = createScenarioRecord({
    name: nm || "Baseline clone",
    fromInputs: base?.inputs || {},
    fromOutputs: base?.outputs || {}
  });
  reg[rec.id] = rec;
  state.ui.scenarioUiSelectedId = rec.id;
  if (els.scenarioNewName) els.scenarioNewName.value = "";
  persist();
  renderScenarioManagerC1();
}

function onScenarioDeleteSelected(){
  ensureScenarioRegistry();
  const id = state.ui.scenarioUiSelectedId;
  if (!id || id === SCENARIO_BASELINE_ID) return;
  const ok = confirm("Delete this scenario?");
  if (!ok) return;

  delete state.ui.scenarios[id];
  state.ui.scenarioUiSelectedId = SCENARIO_BASELINE_ID;
  persist();
  renderScenarioManagerC1();
}

function loadScenarioById(id){
  ensureScenarioRegistry();
  const reg = state.ui.scenarios;
  const rec = reg?.[id];
  if (!rec) return;

  const uiKeep = state.ui || {};
  const next = scenarioClone(rec.inputs || {});
  state = next;
  state.ui = uiKeep;

  ensureScenarioRegistry();
  state.ui.activeScenarioId = id;
  state.ui.scenarioUiSelectedId = id;

  markMcStale();
  applyStateToUI();
  persist();
  render();
  renderScenarioManagerC1();
  safeCall(() => { renderDecisionSessionD1(); });
}

function onScenarioLoadSelected(){
  ensureScenarioRegistry();
  const id = state.ui.scenarioUiSelectedId;
  const reg = state.ui.scenarios;
  const rec = reg?.[id];
  if (!rec) return;
  if (id === state.ui.activeScenarioId) return;

  const nm = String(rec?.name || rec?.id || "scenario");
  const ok = confirm(`Load scenario "${nm}"? This will replace current inputs.`);
  if (!ok) return;
  loadScenarioById(id);
}

function onScenarioReturnBaseline(){
  ensureScenarioRegistry();
  const reg = state.ui.scenarios;
  const rec = reg?.[SCENARIO_BASELINE_ID];
  if (!rec) return;
  if (state.ui.activeScenarioId === SCENARIO_BASELINE_ID) return;

  const ok = confirm("Return to baseline? This will replace current inputs.");
  if (!ok) return;
  loadScenarioById(SCENARIO_BASELINE_ID);
}

function wireScenarioManagerC1(){
  if (els.scenarioSelect){
    els.scenarioSelect.addEventListener("change", () => {
      ensureScenarioRegistry();
      const id = els.scenarioSelect.value;
      if (id && state.ui.scenarios[id]){
        state.ui.scenarioUiSelectedId = id;
        persist();
        renderScenarioManagerC1();
      }
    });
  }

  if (els.btnScenarioSaveNew) els.btnScenarioSaveNew.addEventListener("click", () => onScenarioSaveNew());
  if (els.btnScenarioCloneBaseline) els.btnScenarioCloneBaseline.addEventListener("click", () => onScenarioCloneBaseline());
  if (els.btnScenarioLoadSelected) els.btnScenarioLoadSelected.addEventListener("click", () => onScenarioLoadSelected());
  if (els.btnScenarioReturnBaseline) els.btnScenarioReturnBaseline.addEventListener("click", () => onScenarioReturnBaseline());
  if (els.btnScenarioDelete) els.btnScenarioDelete.addEventListener("click", () => onScenarioDeleteSelected());

  renderScenarioManagerC1();
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

function createNewDecisionSession(){
  ensureDecisionScaffold();
  const sessions = state.ui.decision.sessions;
  const id = makeDecisionSessionId();
  const n = Object.keys(sessions).length + 1;
  sessions[id] = {
    id,
    name: `Session ${n}`,
    createdAt: new Date().toISOString(),
    scenarioId: state.ui.activeScenarioId || SCENARIO_BASELINE_ID,
    objectiveKey: OBJECTIVE_TEMPLATES[0].key,
    notes: "",
    constraints: { budget: null, volunteerHrs: null, turfAccess: "", blackoutDates: "" },
    riskPosture: "balanced",
    nonNegotiables: [],
    options: {},
    activeOptionId: null,
  };
  state.ui.decision.activeSessionId = id;
  persist();
  renderDecisionSessionD1();
}

function renameActiveDecisionSession(){
  const s = getActiveDecisionSession();
  if (!s || !els.decisionRename) return;
  const nm = String(els.decisionRename.value || "").trim();
  if (!nm) return;
  s.name = nm;
  persist();
  renderDecisionSessionD1();
}

function deleteActiveDecisionSession(){
  ensureDecisionScaffold();
  const sessions = state.ui.decision.sessions;
  const ids = Object.keys(sessions);
  if (ids.length <= 1) return;
  const cur = state.ui.decision.activeSessionId;
  const s = sessions[cur];
  const nm = s ? (s.name || s.id) : "this session";
  const ok = confirm(`Delete "${nm}"?`);
  if (!ok) return;
  delete sessions[cur];
  const nextIds = Object.keys(sessions);
  state.ui.decision.activeSessionId = nextIds[0] || null;
  persist();
  renderDecisionSessionD1();
}

function linkDecisionSessionToActiveScenario(){
  const s = getActiveDecisionSession();
  if (!s) return;
  ensureScenarioRegistry();
  s.scenarioId = state.ui.activeScenarioId || SCENARIO_BASELINE_ID;
  persist();
  renderDecisionSessionD1();
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

function createNewDecisionOption(){
  const s = getActiveDecisionSession();
  if (!s) return;
  ensureDecisionSessionShape(s);

  const id = makeDecisionOptionId();
  const n = Object.keys(s.options || {}).length + 1;
  s.options[id] = {
    id,
    label: `Option ${n}`,
    createdAt: new Date().toISOString(),
    scenarioId: state.ui.activeScenarioId || SCENARIO_BASELINE_ID,
    tactics: { doors: false, phones: false, digital: false },
  };
  s.activeOptionId = id;
  persist();
  renderDecisionSessionD1();
}

function renameActiveDecisionOption(){
  const s = getActiveDecisionSession();
  if (!s) return;
  ensureDecisionSessionShape(s);
  const o = getActiveDecisionOption(s);
  if (!o || !els.decisionOptionRename) return;
  const nm = String(els.decisionOptionRename.value || "").trim();
  if (!nm) return;
  o.label = nm;
  persist();
  renderDecisionSessionD1();
}

function deleteActiveDecisionOption(){
  const s = getActiveDecisionSession();
  if (!s) return;
  ensureDecisionSessionShape(s);
  const options = s.options || {};
  const ids = Object.keys(options);
  if (ids.length <= 1) return;

  const o = getActiveDecisionOption(s);
  if (!o) return;
  const nm = o.label || o.id;
  const ok = confirm(`Delete "${nm}"?`);
  if (!ok) return;

  delete options[o.id];
  const nextIds = Object.keys(options);
  s.activeOptionId = nextIds[0] || null;
  persist();
  renderDecisionSessionD1();
}

function linkDecisionOptionToActiveScenario(){
  const s = getActiveDecisionSession();
  if (!s) return;
  ensureDecisionSessionShape(s);
  const o = getActiveDecisionOption(s);
  if (!o) return;
  ensureScenarioRegistry();
  o.scenarioId = state.ui.activeScenarioId || SCENARIO_BASELINE_ID;
  persist();
  renderDecisionSessionD1();
}

function computeDecisionKeyOut(inputs){
  try{
    const snap = scenarioClone(inputs || {});
    const res = engine.computeAll(snap);
    const weeks = engine.withPatchedState(snap, () => engine.derivedWeeksRemaining());
    const ctx = computeWeeklyOpsContextFromSnap(snap, res, weeks);
    const finish = targetFinishDateFromSnap(snap, weeks);
    return { weeks, ctx, finish };
  } catch {
    return { weeks:null, ctx:null, finish:null };
  }
}

function decisionOptionDisplay(o){
  if (!o) return "—";
  const label = o.label || o.id;
  const sid = o.scenarioId ? ` · ${o.scenarioId}` : "";
  return label + sid;
}

function buildDecisionSummaryText(session){
  ensureScenarioRegistry();
  const reg = state.ui.scenarios || {};
  const baseline = reg[SCENARIO_BASELINE_ID] || null;

  const s = session || null;
  if (!s || !baseline) return "—";

  const options = (s.options && typeof s.options === "object") ? s.options : {};
  const pickId = s.recommendedOptionId || s.activeOptionId || null;
  const opt = (pickId && options[pickId]) ? options[pickId] : null;

  const baseInputs = scenarioClone(baseline.inputs || {});
  const optScenarioId = opt?.scenarioId || s.scenarioId || state.ui.activeScenarioId || SCENARIO_BASELINE_ID;
  const optRec = reg[optScenarioId] || null;
  const optInputs = scenarioClone((optRec?.inputs) || {});

  const baseOut = computeDecisionKeyOut(baseInputs);
  const optOut = computeDecisionKeyOut(optInputs);

  const fmtNum = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtDate = (d) => d ? fmtISODate(d) : "—";
  const deltaNum = (a,b) => (a==null||b==null||!isFinite(a)||!isFinite(b)) ? null : (b-a);

  const bCtx = baseOut.ctx || {};
  const oCtx = optOut.ctx || {};

  const attemptsWBase = bCtx.attemptsPerWeek ?? null;
  const attemptsWOpt = oCtx.attemptsPerWeek ?? null;
  const convosWBase = bCtx.convosPerWeek ?? null;
  const convosWOpt = oCtx.convosPerWeek ?? null;

  const gap = oCtx.gap;
  const gapLine = (gap == null || !isFinite(gap)) ? "—" : (gap <= 0 ? "Executable at current capacity" : `Shortfall: ${fmtInt(Math.ceil(gap))} attempts/week`);

  const doorSharePct = safeNum(optInputs?.channelDoorPct);
  const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct / 100, 0, 1);
  const doorsHr = safeNum(optInputs?.doorsPerHour3);
  const callsHr = safeNum(optInputs?.callsPerHour3);
  const aph = (doorShare != null && doorsHr != null && callsHr != null) ? (doorShare * doorsHr + (1 - doorShare) * callsHr) : null;

  const attemptsPerDay = (attemptsWOpt != null && isFinite(attemptsWOpt)) ? (attemptsWOpt / 7) : null;
  const doorsPerDay = (attemptsPerDay != null && doorShare != null) ? (attemptsPerDay * doorShare) : null;
  const callsPerDay = (attemptsPerDay != null && doorShare != null) ? (attemptsPerDay * (1 - doorShare)) : null;
  const hrsPerWeek = (attemptsWOpt != null && aph != null && aph > 0) ? (attemptsWOpt / aph) : null;

  const tactics = opt?.tactics ? Object.keys(opt.tactics).filter(k => !!opt.tactics[k]) : [];
  const tacticsLine = tactics.length ? tactics.map(k => k.toUpperCase()).join(", ") : "—";

  const whatTrue = Array.isArray(s.whatNeedsTrue) ? s.whatNeedsTrue : [];
  const whatTrueLines = whatTrue.length ? whatTrue.map(x => `- [ ] ${x}`).join("\n") : "- [ ] —";

  const lines = [];
  lines.push(`# Decision Summary: ${s.name || s.id}`);
  lines.push(`Date: ${fmtISODate(new Date(s.createdAt || Date.now()))}`);
  lines.push(`Objective: ${(OBJECTIVE_TEMPLATES.find(x=>x.key===s.objectiveKey)?.label) || s.objectiveKey || "—"}`);
  lines.push("");
  lines.push(`## Recommendation`);
  lines.push(`Recommended option: ${opt ? (opt.label || opt.id) : "—"}`);
  lines.push(`Option scenario: ${optScenarioId}${optRec?.name ? ` (${optRec.name})` : ""}`);
  lines.push(`Tactics tags: ${tacticsLine}`);
  lines.push("");
  lines.push(`## Baseline vs Option (key deltas)`);
  lines.push(`Attempts/week: ${fmtNum(attemptsWBase)} → ${fmtNum(attemptsWOpt)}${(deltaNum(attemptsWBase, attemptsWOpt)==null||deltaNum(attemptsWBase, attemptsWOpt)===0) ? "" : ` (${(deltaNum(attemptsWBase, attemptsWOpt)>0?"+":"")}${fmtInt(Math.round(deltaNum(attemptsWBase, attemptsWOpt)))})`}`);
  lines.push(`Convos/week: ${fmtNum(convosWBase)} → ${fmtNum(convosWOpt)}${(deltaNum(convosWBase, convosWOpt)==null||deltaNum(convosWBase, convosWOpt)===0) ? "" : ` (${(deltaNum(convosWBase, convosWOpt)>0?"+":"")}${fmtInt(Math.round(deltaNum(convosWBase, convosWOpt)))})`}`);
  lines.push(`Finish date (target): ${fmtDate(baseOut.finish)} → ${fmtDate(optOut.finish)}`);
  lines.push(`Execution status (this week): ${gapLine}`);
  lines.push("");
  lines.push(`## What needs to be true`);
  lines.push(whatTrueLines);
  lines.push("");
  lines.push(`## Next 7 days (execution plan)`);
  if (attemptsWOpt == null || !isFinite(attemptsWOpt)){
    lines.push(`- Attempts/week: —`);
  } else {
    lines.push(`- Attempts/week: ${fmtInt(Math.ceil(attemptsWOpt))} (~${fmtInt(Math.ceil(attemptsWOpt/7))}/day)`);
  }
  if (doorsPerDay != null && callsPerDay != null){
    lines.push(`- Daily targets: ${fmtInt(Math.ceil(doorsPerDay))} doors/day · ${fmtInt(Math.ceil(callsPerDay))} calls/day`);
  } else {
    lines.push(`- Daily targets: —`);
  }
  if (hrsPerWeek != null && isFinite(hrsPerWeek)){
    lines.push(`- Estimated hours/week required: ${fmtInt(Math.ceil(hrsPerWeek))} hrs`);
  } else {
    lines.push(`- Estimated hours/week required: —`);
  }
  if (Array.isArray(s.nonNegotiables) && s.nonNegotiables.length){
    lines.push("");
    lines.push(`## Non-negotiables`);
    for (const x of s.nonNegotiables) lines.push(`- ${x}`);
  }

  return lines.join("\n");
}

function copyTextToClipboard(text){
  const s = String(text || "");
  if (!s) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(s).then(()=>true).catch(()=>false);
  }
  try{
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve(!!ok);
  }catch(e){
    return Promise.resolve(false);
  }
}

function decisionSummaryPlainText(md){
  const s = String(md || "");
  return s
    .replace(/^###\s+/gm, "")
    .replace(/^##\s+/gm, "")
    .replace(/^#\s+/gm, "")
    .replace(/^\-\s+/gm, "• ")
    .replace(/\*\*/g, "");
}

function decisionSessionExportObject(session){
  const s = session ? structuredClone(session) : null;
  if (!s) return null;
  return {
    type: "decision_session",
    exportedAt: new Date().toISOString(),
    activeScenarioId: state?.ui?.activeScenarioId || null,
    session: s,
    summaryMarkdown: buildDecisionSummaryText(s),
  };
}

function downloadJsonObject(obj, filename){
  try{
    const name = String(filename || "decision-session.json");
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }catch(e){}
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


// wireInput(el, patchFn, options)
// Binds a single input/select/textarea to state via setState.
// el        — DOM element; no-op if null/undefined
// patchFn   — function(next, parsedValue) that mutates the cloned state
// options:
//   parse    — transform raw string value before passing to patchFn (default: identity)
//   event    — event name to listen on (default: "change" for select/checkbox, "input" otherwise)
//   onCommit — optional extra function called after setState (e.g. to re-render a sub-panel)
function wireInput(el, patchFn, { parse = v => v, event, onCommit } = {}){
  if (!el) return;
  const ev = event || (el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input");
  el.addEventListener(ev, () => {
    const raw = el.type === "checkbox" ? el.checked : el.value;
    const val = parse(raw);
    setState(next => patchFn(next, val));
    if (onCommit) onCommit();
  });
}

function wireDecisionSessionD1(){
  ensureDecisionScaffold();

  if (els.decisionSessionSelect){
    els.decisionSessionSelect.addEventListener("change", () => {
      ensureDecisionScaffold();
      const id = els.decisionSessionSelect.value;
      if (id && state.ui.decision.sessions[id]){
        state.ui.decision.activeSessionId = id;
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.btnDecisionNew) els.btnDecisionNew.addEventListener("click", () => createNewDecisionSession());
  if (els.btnDecisionRenameSave) els.btnDecisionRenameSave.addEventListener("click", () => renameActiveDecisionSession());
  if (els.btnDecisionDelete) els.btnDecisionDelete.addEventListener("click", () => deleteActiveDecisionSession());
  if (els.btnDecisionLinkScenario) els.btnDecisionLinkScenario.addEventListener("click", () => linkDecisionSessionToActiveScenario());

  // D-layer input bindings — all go through wireInput → setState
  // Each patchFn looks up the session by id on the cloned state so we never mutate live references.
  wireInput(els.decisionNotes, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s) s.notes = val;
  });

  wireInput(els.decisionObjective, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s) s.objectiveKey = val;
  }, { onCommit: renderDecisionSessionD1 });

  wireInput(els.decisionBudget, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.budget = val; }
  }, { parse: raw => { const n = Number(String(raw).trim()); return (String(raw).trim() === "" || !Number.isFinite(n)) ? null : n; } });

  wireInput(els.decisionVolunteerHrs, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.volunteerHrs = val; }
  }, { parse: raw => { const n = Number(String(raw).trim()); return (String(raw).trim() === "" || !Number.isFinite(n)) ? null : n; } });

  wireInput(els.decisionTurfAccess, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.turfAccess = val; }
  });

  wireInput(els.decisionBlackoutDates, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.blackoutDates = val; }
  });

  wireInput(els.decisionRiskPosture, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.riskPosture = val || "balanced"; }
  }, { onCommit: renderDecisionSessionD1 });

  wireInput(els.decisionNonNegotiables, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){
      ensureDecisionSessionShape(s);
      s.nonNegotiables = val.split(/\r?\n|,/).map(x => String(x || "").trim()).filter(Boolean);
    }
  });

  if (els.decisionOptionSelect){
    els.decisionOptionSelect.addEventListener("change", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const id = String(els.decisionOptionSelect.value || "");
      if (id && s.options && s.options[id]){
        s.activeOptionId = id;
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.btnDecisionOptionNew) els.btnDecisionOptionNew.addEventListener("click", () => createNewDecisionOption());
  if (els.btnDecisionOptionRenameSave) els.btnDecisionOptionRenameSave.addEventListener("click", () => renameActiveDecisionOption());
  if (els.btnDecisionOptionDelete) els.btnDecisionOptionDelete.addEventListener("click", () => deleteActiveDecisionOption());
  if (els.btnDecisionOptionLinkScenario) els.btnDecisionOptionLinkScenario.addEventListener("click", () => linkDecisionOptionToActiveScenario());

  const tacticUpdate = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) return;
    ensureDecisionOptionShape(o);
    o.tactics.doors = !!els.decisionOptionTacticDoors?.checked;
    o.tactics.phones = !!els.decisionOptionTacticPhones?.checked;
    o.tactics.digital = !!els.decisionOptionTacticDigital?.checked;
    persist();
  };

  if (els.decisionOptionTacticDoors) els.decisionOptionTacticDoors.addEventListener("change", tacticUpdate);
  if (els.decisionOptionTacticPhones) els.decisionOptionTacticPhones.addEventListener("change", tacticUpdate);
  if (els.decisionOptionTacticDigital) els.decisionOptionTacticDigital.addEventListener("change", tacticUpdate);

  if (els.decisionRecommendSelect){
    els.decisionRecommendSelect.addEventListener("change", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const id = String(els.decisionRecommendSelect.value || "").trim();
      s.recommendedOptionId = id || null;
      persist();
      renderDecisionSummaryD4(s);
    });
  }

  if (els.decisionWhatTrue){
    els.decisionWhatTrue.addEventListener("input", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const raw = String(els.decisionWhatTrue.value || "");
      const arr = raw.split(/\r?\n/).map(x => String(x || "").trim()).filter(Boolean);
      s.whatNeedsTrue = arr;
      persist();
      renderDecisionSummaryD4(s);
    });
  }
  const setCopyStatus = (msg) => {
    if (els.decisionCopyStatus) els.decisionCopyStatus.textContent = String(msg || "");
  };

  if (els.btnDecisionCopyMd){
    els.btnDecisionCopyMd.addEventListener("click", async () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const md = buildDecisionSummaryText(s);
      const ok = await copyTextToClipboard(md);
      setCopyStatus(ok ? "Copied summary (markdown)." : "Copy failed.");
    });
  }

  if (els.btnDecisionCopyText){
    els.btnDecisionCopyText.addEventListener("click", async () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const md = buildDecisionSummaryText(s);
      const plain = decisionSummaryPlainText(md);
      const ok = await copyTextToClipboard(plain);
      setCopyStatus(ok ? "Copied summary (text)." : "Copy failed.");
    });
  }

  if (els.btnDecisionDownloadJson){
    els.btnDecisionDownloadJson.addEventListener("click", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const obj = decisionSessionExportObject(s);
      if (!obj) return;
      const safe = String((s.name || s.id || "decision-session")).toLowerCase().replace(/[^a-z0-9\-\_]+/g, "-").replace(/\-+/g, "-").replace(/^\-+|\-+$/g, "");
      const fn = (safe ? safe : "decision-session") + ".json";
      downloadJsonObject(obj, fn);
      setCopyStatus("Downloaded session JSON.");
    });
  }

  if (els.btnSensRun){
    els.btnSensRun.addEventListener("click", async () => {
      await runSensitivitySnapshotE4();
    });
  }

  renderDecisionSessionD1();
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
  const requested = state.ui?.activeTab || "win";
  const tab = document.getElementById(`tab-${requested}`) ? requested : "win";
  if (state.ui) state.ui.activeTab = tab;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
}

function initExplainCard(){
  els.explainCard.hidden = !state.ui?.training;
}


function isDevMode(){
  try{
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("dev") === "1") return true;
  } catch {}
  try{
    return localStorage.getItem("devMode") === "1";
  } catch {
    return false;
  }
}

function initDevTools(){
  if (!isDevMode()) return;

  // Minimal, isolated UI elements (do not touch existing layout).
  const host = document.createElement("div");
  host.className = "devtools";
  host.setAttribute("data-devtools", "1");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "devtools-btn";
  btn.textContent = "Run Self-Test";

  const btnRisk = document.createElement("button");
  btnRisk.type = "button";
  btnRisk.className = "devtools-btn";
  btnRisk.textContent = "Risk Summary";

  const btnRobust = document.createElement("button");
  btnRobust.type = "button";
  btnRobust.className = "devtools-btn";
  btnRobust.textContent = "Robust (Smoke)";

  const panel = document.createElement("div");
  panel.className = "devtools-panel";
  panel.hidden = true;

  const FPE_LAST_GOOD_KEY = "fpe_lastGood";

  const safeJsonParse = (s) => {
    try{ return JSON.parse(s); } catch { return null; }
  };

  const formatWhen = (ts) => {
    try{
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return "";
    }
  };

  const diffFlat = (a, b, prefix="") => {
    const diffs = [];
    const isObj = (v) => (v && typeof v === "object" && !Array.isArray(v));
    if (Array.isArray(a) || Array.isArray(b)){
      const sa = JSON.stringify(a);
      const sb = JSON.stringify(b);
      if (sa !== sb) diffs.push({ path: prefix || "(root)", a: sa, b: sb });
      return diffs;
    }
    if (!isObj(a) || !isObj(b)){
      if (a !== b) diffs.push({ path: prefix || "(root)", a, b });
      return diffs;
    }
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    for (const k of keys){
      const p = prefix ? `${prefix}.${k}` : k;
      const va = a[k];
      const vb = b[k];
      if (isObj(va) && isObj(vb)){
        diffs.push(...diffFlat(va, vb, p));
      } else if (Array.isArray(va) || Array.isArray(vb)){
        diffs.push(...diffFlat(va, vb, p));
      } else if (va !== vb){
        diffs.push({ path: p, a: va, b: vb });
      }
      if (diffs.length >= 12) break;
    }
    return diffs;
  };


  const renderResult = (r) => {
    panel.hidden = false;
    panel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "devtools-head";
    const status = (r.failed && r.failed > 0) ? "FAIL" : "PASS";

    // Phase 11 — self-test gate badge (session-only)
    selfTestGateStatus = engine.selfTest.gateFromSelfTestResult(r);
    updateSelfTestGateBadge();
    head.textContent = `Self-Test: ${status} — ${r.passed}/${r.total} passed${r.durationMs != null ? ` (${r.durationMs}ms)` : ""}`;
    panel.appendChild(head);

    // Last good signature (saved only on PASS)
    let lastGood = null;
    try{ lastGood = safeJsonParse(localStorage.getItem(FPE_LAST_GOOD_KEY) || ""); } catch {}

    const hasSig = !!(r && r.signature && r.signatureHash);
    if (status === "PASS" && hasSig){
      try{
        localStorage.setItem(FPE_LAST_GOOD_KEY, JSON.stringify({ ts: Date.now(), signature: r.signature, hash: r.signatureHash }));
        lastGood = { ts: Date.now(), signature: r.signature, hash: r.signatureHash };
      } catch {}
    }

    if (hasSig || lastGood){
      const meta = document.createElement("div");
      meta.className = "devtools-meta";

      const currentHash = hasSig ? r.signatureHash : null;
      const lastHash = lastGood?.hash || null;

      let line = "";
      if (lastGood?.ts){
        line += `Last good: ${formatWhen(lastGood.ts)}`;
      } else {
        line += "Last good: (none)";
      }
      // Display full 16-hex snapshot hashes (unambiguous, monospace via CSS).
      if (lastHash){
        line += ` · fixture ${String(lastHash)}`;
      }
      if (currentHash){
        line += ` · current ${String(currentHash)}`;
      }
      if (lastHash && currentHash){
        line += (lastHash === currentHash) ? " · no drift" : " · DRIFT";
      }
      meta.textContent = line;

      // Also mirror summary into the fixed Status rail if present (UI-only).
      try{
        const stress = document.getElementById("stressSummaryBody");
        if (stress){
          const headline = `Self-Test: ${status} — ${r.passed}/${r.total} passed${r.durationMs != null ? ` (${r.durationMs}ms)` : ""}`;
          stress.innerHTML = `<div style="font-weight:700; margin-bottom:6px;">${headline}</div><div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px; opacity:0.9;">${line}</div>`;
        }
      } catch {}

      panel.appendChild(meta);

      if (lastGood?.signature && hasSig && lastHash && currentHash && lastHash !== currentHash){
        const diffs = diffFlat(lastGood.signature, r.signature);
        if (diffs.length){
          const dbox = document.createElement("div");
          dbox.className = "devtools-diff";
          const title = document.createElement("div");
          title.className = "devtools-diff-title";
          title.textContent = "Top drift diffs:";
          dbox.appendChild(title);
          const ul = document.createElement("ul");
          ul.className = "devtools-diff-list";
          for (const d of diffs){
            const li = document.createElement("li");
            li.textContent = `${d.path}: was ${String(d.a)} → now ${String(d.b)}`;
            ul.appendChild(li);
          }
          dbox.appendChild(ul);
          panel.appendChild(dbox);
        }
      }
    }

    if (r.failed && r.failures && r.failures.length){
      const ul = document.createElement("ul");
      ul.className = "devtools-failures";
      for (const f of r.failures){
        const li = document.createElement("li");
        li.textContent = `${f.name}: ${f.message}`;
        ul.appendChild(li);
      }
      panel.appendChild(ul);
    }
  };

  const renderRisk = (title, lines) => {
    panel.hidden = false;
    panel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "devtools-head";
    head.textContent = title || "Risk";
    panel.appendChild(head);

    const pre = document.createElement("div");
    pre.className = "mono";
    pre.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
    panel.appendChild(pre);
  };

  const buildCurrentMcContext = () => {
    const weeks = derivedWeeksRemaining();
    const modelInput = {
      universeSize: safeNum(state.universeSize),
      turnoutA: safeNum(state.turnoutA),
      turnoutB: safeNum(state.turnoutB),
      bandWidth: safeNum(state.bandWidth),
      candidates: state.candidates.map(c => ({ id: c.id, name: c.name, supportPct: safeNum(c.supportPct) })),
      undecidedPct: safeNum(state.undecidedPct),
      yourCandidateId: state.yourCandidateId,
      undecidedMode: state.undecidedMode,
      userSplit: state.userSplit,
      persuasionPct: safeNum(state.persuasionPct),
      earlyVoteExp: safeNum(state.earlyVoteExp),
    };
    const res = engine.computeAll(modelInput);
    const w = (weeks != null && weeks >= 0) ? weeks : null;
    const needVotes = deriveNeedVotes(res);
    return { res, weeks: w, needVotes };
  };

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Running…";
    try{
      const mod = await import("./selfTest.js");
      const runSelfTests = mod?.runSelfTests;
      if (typeof runSelfTests !== "function"){
        renderResult({ total: 1, passed: 0, failed: 1, failures:[{ name:"Loader", message:"runSelfTests() not found" }] });
      } else {
        const r = runSelfTests(getSelfTestAccessors());
        renderResult(r || { total: 1, passed: 0, failed: 1, failures:[{ name:"Runner", message:"No results returned" }] });
      }
    } catch (err){
      renderResult({ total: 1, passed: 0, failed: 1, failures:[{ name:"Exception", message: err?.message ? err.message : String(err) }] });
    } finally {
      btn.disabled = false;
      btn.textContent = "Run Self-Test";
    }
  });

  btnRisk.addEventListener("click", async () => {
    btnRisk.disabled = true;
    btnRisk.textContent = "Computing…";
    try{
      const { res, weeks, needVotes } = buildCurrentMcContext();
      const seed = state.mcSeed || "";
      const sim = engine.runMonteCarlo({ scenario: state, res, weeks, needVotes, runs: 10000, seed, includeMargins: true });
      const margins = sim?.margins || [];
      const s = engine.risk.summaryFromMargins(margins);
      const cvar10 = engine.risk.conditionalValueAtRisk(margins, 0.10);
      const var10 = engine.risk.valueAtRisk(margins, 0.10);

      const fmt = (x) => (typeof x === "number" && Number.isFinite(x)) ? x.toFixed(2) : "—";
      const pct = (x) => (typeof x === "number" && Number.isFinite(x)) ? (100*x).toFixed(1) + "%" : "—";

      renderRisk("Risk: margins (MC)", [
        `runs: ${s.runs}`,
        `probWin (margin>=0): ${pct(s.probWin)}`,
        `mean: ${fmt(s.mean)} · median: ${fmt(s.median)}`,
        `p10: ${fmt(s.p10)} · p25: ${fmt(s.p25)} · p75: ${fmt(s.p75)} · p90: ${fmt(s.p90)}`,
        `min: ${fmt(s.min)} · max: ${fmt(s.max)} · stdev: ${fmt(s.stdev)}`,
        `VaR10: ${fmt(var10)} · CVaR10: ${fmt(cvar10)}`,
      ]);
    } catch (err){
      renderRisk("Risk: error", err?.message ? err.message : String(err || "Error"));
    } finally {
      btnRisk.disabled = false;
      btnRisk.textContent = "Risk Summary";
    }
  });

  btnRobust.addEventListener("click", async () => {
    btnRobust.disabled = true;
    btnRobust.textContent = "Running…";
    try{
      // Smoke test: deterministic selector behavior on synthetic margins arrays.
      const seed = state.mcSeed || "";
      const candidates = [
        { id: "A", label: "Plan A" },
        { id: "B", label: "Plan B" },
        { id: "C", label: "Plan C" },
      ];
      const mkMargins = (bias) => {
        // Deterministic small synthetic distribution.
        const out = [];
        for (let i=0;i<200;i++) out.push((i - 100) * 0.1 + bias);
        return out;
      };
      const evaluateFn = (plan) => {
        const bias = (plan.id === "A") ? -2 : (plan.id === "B") ? 0 : 1;
        const margins = mkMargins(bias);
        return { margins, riskSummary: engine.risk.summaryFromMargins(margins) };
      };
      const picked = engine.robust.selectPlan({ candidates, evaluateFn, objective: "max_p25_margin", seed });
      const best = picked?.best;
      renderRisk("Robust: smoke", [
        `objective: max_p25_margin`,
        `best: ${best?.plan?.label || "(none)"}`,
        `score: ${best?.score != null ? String(best.score) : "—"}`,
      ]);
    } catch (err){
      renderRisk("Robust: error", err?.message ? err.message : String(err || "Error"));
    } finally {
      btnRobust.disabled = false;
      btnRobust.textContent = "Robust (Smoke)";
    }
  });

  host.appendChild(btn);
  host.appendChild(btnRisk);
  host.appendChild(btnRobust);
  host.appendChild(panel);
  document.body.appendChild(host);
}

function composeSetupStage(){
  const setupStage = document.getElementById("stage-setup");
  const setupBody = setupStage?.querySelector(":scope > .stage-body-new");
  if (!setupBody) return;

  const setupNavLabel = document.querySelector('.nav-item-new[data-stage="setup"] .nav-label-new');
  if (setupNavLabel) setupNavLabel.textContent = "Set up";
  const setupTitle = setupStage.querySelector(":scope > .stage-header-new .stage-title-new");
  if (setupTitle) setupTitle.textContent = "Set up";

  const ensureCard = (id) => {
    let card = document.getElementById(id);
    if (!card){
      card = document.createElement("div");
      card.className = "card card-section";
      card.id = id;
    }
    return card;
  };

  const makeHeader = (title, subtitle) => {
    const head = document.createElement("div");
    head.className = "card-head card-header";
    const h2 = document.createElement("h2");
    h2.className = "card-title";
    h2.textContent = title;
    head.appendChild(h2);
    if (subtitle){
      const text = document.createElement("div");
      text.className = "help-text";
      text.textContent = subtitle;
      head.appendChild(text);
    }
    return head;
  };

  const ensureSingleHeader = (card, sourceHeader, fallbackTitle, fallbackSubtitle) => {
    let header = sourceHeader || card.querySelector(":scope > .card-head.card-header");
    if (!header){
      header = makeHeader(fallbackTitle, fallbackSubtitle);
    } else if (fallbackSubtitle && !header.querySelector(".help-text")){
      const text = document.createElement("div");
      text.className = "help-text";
      text.textContent = fallbackSubtitle;
      header.appendChild(text);
    }

    const existing = Array.from(card.querySelectorAll(":scope > .card-head.card-header"));
    for (const h of existing){
      if (h !== header) h.remove();
    }
    if (card.firstElementChild !== header){
      card.insertBefore(header, card.firstChild);
    }
  };

  const ensureDivider = (id) => {
    let hr = document.getElementById(id);
    if (!hr){
      hr = document.createElement("hr");
      hr.id = id;
      hr.className = "setup-divider";
      hr.setAttribute("aria-hidden", "true");
    }
    return hr;
  };

  const raceCard = setupBody.querySelector(".phase-setup");
  const raceGrid = document.getElementById("raceType")?.closest(".grid2");
  if (raceCard){
    ensureSingleHeader(
      raceCard,
      raceCard.querySelector(":scope > .card-head.card-header"),
      "Race setup",
      "Set race context, timing, and operating mode. This frame drives downstream calculations."
    );
    if (raceGrid && raceGrid.parentElement !== raceCard){
      raceCard.appendChild(raceGrid);
    }
  }

  const universeCard = ensureCard("setupUniverseModule");
  const universeHeader = document.querySelector("#stage-universe > .stage-body-new > .card-head.card-header");
  const universeGrid = document.getElementById("universeSize")?.closest(".grid2");
  ensureSingleHeader(
    universeCard,
    universeHeader,
    "Universe",
    "Define electorate size and source basis; every vote, cost, and target scales from this."
  );
  if (universeGrid) universeCard.appendChild(universeGrid);

  const persuadableCard = ensureCard("setupPersuadableModule");
  const capacityBody = document.querySelector("#stage-capacity > .stage-body-new");
  const persuadableHeader = capacityBody?.querySelector(":scope > .card-head.card-header");
  const persuadableGrid = document.getElementById("persuasionPct")?.closest(".grid2");
  ensureSingleHeader(
    persuadableCard,
    persuadableHeader,
    "Persuadable universe (movable)",
    "Set the movable universe and expected early-vote share to size persuasion workload."
  );
  if (persuadableGrid) persuadableCard.appendChild(persuadableGrid);

  const electorateCard = ensureCard("setupElectorateModule");
  const structureBody = document.querySelector("#stage-structure > .stage-body-new");
  const electorateHeader = structureBody?.querySelector(":scope > .card-head.card-header");
  const electorateDetails = structureBody?.querySelector(":scope > details");
  const electorateNote = structureBody?.querySelector(":scope > .note");
  ensureSingleHeader(
    electorateCard,
    electorateHeader,
    "Electorate Weighting",
    "Optional realism layer: apply coalition weighting and support retention. OFF = baseline."
  );
  if (electorateDetails){
    electorateDetails.open = true;
    const summary = electorateDetails.querySelector("summary");
    if (summary) summary.remove();
    electorateDetails.classList.add("no-dropdown-details");
    electorateCard.appendChild(electorateDetails);
  }
  if (electorateNote) electorateCard.appendChild(electorateNote);

  const ballotCard = ensureCard("setupBallotModule");
  const ballotBody = document.querySelector("#stage-ballot > .stage-body-new");
  const ballotHeader = ballotBody?.querySelector(":scope > .card-head.card-header");
  const ballotWhoField = document.getElementById("yourCandidate")?.closest(".field");
  const ballotTable = document.getElementById("candTbody")?.closest(".table-wrap");
  const ballotModeGrid = document.getElementById("undecidedMode")?.closest(".grid2");
  const ballotWarn = document.getElementById("candWarn");
  ensureSingleHeader(
    ballotCard,
    ballotHeader,
    "Ballot & persuasion baseline",
    "Set candidate support and undecided allocation. This anchors persuasion math."
  );
  if (ballotWhoField) ballotCard.appendChild(ballotWhoField);
  if (ballotTable) ballotCard.appendChild(ballotTable);
  if (ballotModeGrid) ballotCard.appendChild(ballotModeGrid);
  if (ballotWarn) ballotCard.appendChild(ballotWarn);

  const turnoutCard = document.querySelector("#stage-ballot > .stage-body-new > .phase-p3")
    || document.getElementById("setupTurnoutBaselineModule");
  if (turnoutCard){
    if (!turnoutCard.id) turnoutCard.id = "setupTurnoutBaselineModule";
    ensureSingleHeader(
      turnoutCard,
      turnoutCard.querySelector(":scope > .card-head.card-header"),
      "Turnout baseline (recent comparable cycles)",
      "Use two comparable cycles to set expected turnout and uncertainty band."
    );
  }

  const hasBodyContent = (node) => {
    if (!node) return false;
    return node.childElementCount > 0;
  };

  const order = [
    raceCard,
    ensureDivider("setup-divider-1"),
    universeCard,
    persuadableCard,
    ensureDivider("setup-divider-2"),
    electorateCard,
    ensureDivider("setup-divider-3"),
    ballotCard,
    ensureDivider("setup-divider-4"),
    turnoutCard
  ];

  for (const node of order){
    if (!node) continue;
    const isDivider = node.classList?.contains("setup-divider");
    if (!isDivider && !hasBodyContent(node)) continue;
    setupBody.appendChild(node);
  }
}

function init(){
  try{
    const main = document.querySelector(".stage-main-new");
    if (main){
      const stages = Array.from(main.querySelectorAll(".stage-new"));
      for (const stage of stages){
        const header = stage.querySelector(":scope > .stage-header-new") || stage.querySelector(".stage-header-new");
        const body = stage.querySelector(":scope > .stage-body-new") || stage.querySelector(".stage-body-new");

        if (header && stage.firstElementChild !== header){
          stage.insertBefore(header, stage.firstChild);
        }
        if (header && body){
          if (header.nextElementSibling !== body){
            stage.insertBefore(body, header.nextSibling);
          }
        }

        if (body){
          const kids = Array.from(stage.children);
          for (const kid of kids){
            if (kid === header || kid === body) continue;
            body.appendChild(kid);
          }
        }
      }
    }
  } catch {}
  try { composeSetupStage(); } catch {}
  installGlobalErrorCapture();
  preflightEls();
  ensureScenarioRegistry();
  ensureDecisionScaffold();
  wireScenarioManagerC1();
  wireDecisionSessionD1();
  updateBuildStamp();
  updateSelfTestGateBadge();
  updatePersistenceStatusChip();
  refreshBackupDropdown();

  applyStateToUI();
  rebuildCandidateTable();
  initTabs();
  initExplainCard();
  safeCall(() => { wireSensitivitySurface(); });
  wireEvents();
  initDevTools();
  render();
  try{
    const b = state.ui.scenarios?.[SCENARIO_BASELINE_ID];
    if (b){
      b.inputs = scenarioInputsFromState(state);
      b.outputs = scenarioOutputsFromState(state);
    }
    renderScenarioManagerC1();
  } catch {}
  persist();
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
  const eff = getEffectiveBaseRates();
  return computeSnapshotHash({
    h: hashMcInputs(res, weeks),
    weeks,
    mcMode: state.mcMode || "basic",
    mcVolatility: state.mcVolatility || "med",
    mcSeed: state.mcSeed || "",
    // Advanced triangles
    mcContactMin: safeNum(state.mcContactMin),
    mcContactMode: safeNum(state.mcContactMode),
    mcContactMax: safeNum(state.mcContactMax),
    mcPersMin: safeNum(state.mcPersMin),
    mcPersMode: safeNum(state.mcPersMode),
    mcPersMax: safeNum(state.mcPersMax),
    // Universe-volatility widening
    volBoost: safeNum(eff.volatilityBoost) || 0,
  });
}

function computeOpsEnvelopeD2(res, weeks){
  const w = (weeks != null && isFinite(weeks) && weeks > 0) ? weeks : null;
  if (!w) return null;

  const ctx = computeWeeklyOpsContext(res, w);
  if (!ctx || !(ctx.goal > 0)) return null;

  const eff = getEffectiveBaseRates();
  const baseCr = eff.cr;
  const baseSr = eff.sr;
  if (!(baseCr > 0) || !(baseSr > 0)) return null;

  const baseRr = (eff.tr != null && isFinite(eff.tr) && eff.tr > 0) ? eff.tr : 0.75;
  const baseDph = (safeNum(state.doorsPerHour3) != null && safeNum(state.doorsPerHour3) > 0) ? safeNum(state.doorsPerHour3) : 30;
  const baseCph = (safeNum(state.callsPerHour3) != null && safeNum(state.callsPerHour3) > 0) ? safeNum(state.callsPerHour3) : 25;
  const baseVol = (safeNum(state.volunteerMultBase) != null && safeNum(state.volunteerMultBase) > 0) ? safeNum(state.volunteerMultBase) : 1;

  const volBoost = safeNum(eff.volatilityBoost) || 0;
  const specs = (String(state.mcMode || "basic") === "advanced")
    ? buildAdvancedSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost })
    : buildBasicSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost });

  const runs = 200;
  const seedStr = `${state.mcSeed || ""}|opsEnvelope|${hashMcInputs(res, w)}`;
  const rng = makeRng(seedStr);

  const convos = [];
  const attempts = [];

  for (let i = 0; i < runs; i++){
    const cr = clamp(triSample(specs.contactRate.min, specs.contactRate.mode, specs.contactRate.max, rng), 0.0001, 1);
    const sr = clamp(triSample(specs.persuasionRate.min, specs.persuasionRate.mode, specs.persuasionRate.max, rng), 0.0001, 1);

    const convosPerWeek = (ctx.goal / sr) / w;
    const attemptsPerWeek = convosPerWeek / cr;

    if (isFinite(convosPerWeek) && convosPerWeek > 0) convos.push(convosPerWeek);
    if (isFinite(attemptsPerWeek) && attemptsPerWeek > 0) attempts.push(attemptsPerWeek);
  }

  if (convos.length < 10 || attempts.length < 10) return null;
  convos.sort((a,b) => a - b);
  attempts.sort((a,b) => a - b);

  return {
    runs,
    attempts: {
      p10: quantileSorted(attempts, 0.10),
      p50: quantileSorted(attempts, 0.50),
      p90: quantileSorted(attempts, 0.90),
    },
    convos: {
      p10: quantileSorted(convos, 0.10),
      p50: quantileSorted(convos, 0.50),
      p90: quantileSorted(convos, 0.90),
    }
  };
}

function renderOpsEnvelopeD2(res, weeks){
  if (!els.opsAttP10 && !els.opsConP10) return;

  const clear = () => {
    if (els.opsAttP10) els.opsAttP10.textContent = "—";
    if (els.opsAttP50) els.opsAttP50.textContent = "—";
    if (els.opsAttP90) els.opsAttP90.textContent = "—";
    if (els.opsConP10) els.opsConP10.textContent = "—";
    if (els.opsConP50) els.opsConP50.textContent = "—";
    if (els.opsConP90) els.opsConP90.textContent = "—";
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashOpsEnvelopeInputs(res, weeks);
  const cached = (state.ui && state.ui.opsEnvelope && typeof state.ui.opsEnvelope === "object") ? state.ui.opsEnvelope : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeOpsEnvelopeD2(res, weeks);
    if (!env){
      clear();
      return;
    }
    if (!state.ui) state.ui = {};
    state.ui.opsEnvelope = { hash: h, env, computedAt: new Date().toISOString() };
    persist();
  }

  const fmt = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.round(v));

  if (els.opsAttP10) els.opsAttP10.textContent = fmt(env.attempts.p10);
  if (els.opsAttP50) els.opsAttP50.textContent = fmt(env.attempts.p50);
  if (els.opsAttP90) els.opsAttP90.textContent = fmt(env.attempts.p90);
  if (els.opsConP10) els.opsConP10.textContent = fmt(env.convos.p10);
  if (els.opsConP50) els.opsConP50.textContent = fmt(env.convos.p50);
  if (els.opsConP90) els.opsConP90.textContent = fmt(env.convos.p90);
}

function hashFinishEnvelopeInputs(res, weeks){
  const today = fmtISODate(new Date());
  return computeSnapshotHash({
    h: hashOpsEnvelopeInputs(res, weeks),
    dailyLogHash: computeDailyLogHash(),
    today,
  });
}

function computeFinishEnvelopeD3(res, weeks){
  const w = (weeks != null && isFinite(weeks) && weeks > 0) ? weeks : null;
  if (!w) return null;

  const ctx = computeWeeklyOpsContext(res, w);
  if (!ctx || !(ctx.goal > 0)) return null;

  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  if (!log || !log.length) return null;

  const last7 = computeLastNLogSums(7);
  if (!last7?.hasLog || !(last7.days > 0)) return null;
  const paceAttemptsWeek = (last7.sumAttempts / last7.days) * 7;
  if (!(paceAttemptsWeek > 0)) return null;

  let doneAttempts = 0;
  for (const x of log){
    if (!x || !x.date) continue;
    const doors = safeNum(x?.doors) || 0;
    const calls = safeNum(x?.calls) || 0;
    const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
    doneAttempts += attempts;
  }

  const eff = getEffectiveBaseRates();
  const baseCr = eff.cr;
  const baseSr = eff.sr;
  if (!(baseCr > 0) || !(baseSr > 0)) return null;

  const baseRr = (eff.tr != null && isFinite(eff.tr) && eff.tr > 0) ? eff.tr : 0.75;
  const baseDph = (safeNum(state.doorsPerHour3) != null && safeNum(state.doorsPerHour3) > 0) ? safeNum(state.doorsPerHour3) : 30;
  const baseCph = (safeNum(state.callsPerHour3) != null && safeNum(state.callsPerHour3) > 0) ? safeNum(state.callsPerHour3) : 25;
  const baseVol = (safeNum(state.volunteerMultBase) != null && safeNum(state.volunteerMultBase) > 0) ? safeNum(state.volunteerMultBase) : 1;
  const volBoost = safeNum(eff.volatilityBoost) || 0;

  const specs = (String(state.mcMode || "basic") === "advanced")
    ? buildAdvancedSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost })
    : buildBasicSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost });

  const runs = 200;
  const seedStr = `${state.mcSeed || ""}|finishEnvelope|${hashMcInputs(res, w)}`;
  const rng = makeRng(seedStr);

  const dayOffsets = [];
  for (let i = 0; i < runs; i++){
    const cr = clamp(triSample(specs.contactRate.min, specs.contactRate.mode, specs.contactRate.max, rng), 0.0001, 1);
    const sr = clamp(triSample(specs.persuasionRate.min, specs.persuasionRate.mode, specs.persuasionRate.max, rng), 0.0001, 1);

    const convosNeeded = ctx.goal / sr;
    const attemptsNeeded = convosNeeded / cr;
    const remaining = Math.max(0, attemptsNeeded - doneAttempts);
    const weeksToFinish = remaining / paceAttemptsWeek;
    const daysToFinish = weeksToFinish * 7;
    if (isFinite(daysToFinish) && daysToFinish >= 0) dayOffsets.push(daysToFinish);
  }

  if (dayOffsets.length < 10) return null;
  dayOffsets.sort((a,b) => a - b);

  return {
    runs,
    paceAttemptsWeek,
    p10Days: quantileSorted(dayOffsets, 0.10),
    p50Days: quantileSorted(dayOffsets, 0.50),
    p90Days: quantileSorted(dayOffsets, 0.90),
  };
}

function renderFinishEnvelopeD3(res, weeks){
  if (!els.opsFinishP10 && !els.opsFinishP50 && !els.opsFinishP90) return;

  const clear = () => {
    if (els.opsFinishP10) els.opsFinishP10.textContent = "—";
    if (els.opsFinishP50) els.opsFinishP50.textContent = "—";
    if (els.opsFinishP90) els.opsFinishP90.textContent = "—";
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashFinishEnvelopeInputs(res, weeks);
  const cached = (state.ui && state.ui.finishEnvelope && typeof state.ui.finishEnvelope === "object") ? state.ui.finishEnvelope : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeFinishEnvelopeD3(res, weeks);
    if (!env){
      clear();
      return;
    }
    if (!state.ui) state.ui = {};
    state.ui.finishEnvelope = { hash: h, env, computedAt: new Date().toISOString() };
    persist();
  }

  const base = new Date();
  const fmt = (days) => {
    if (days == null || !isFinite(days)) return "—";
    const dt = new Date(base.getTime() + Math.round(days) * 24*3600*1000);
    return fmtISODate(dt);
  };

  if (els.opsFinishP10) els.opsFinishP10.textContent = fmt(env.p10Days);
  if (els.opsFinishP50) els.opsFinishP50.textContent = fmt(env.p50Days);
  if (els.opsFinishP90) els.opsFinishP90.textContent = fmt(env.p90Days);
}

function hashMissRiskInputs(res, weeks){
  return computeSnapshotHash({
    h: hashOpsEnvelopeInputs(res, weeks),
    dailyLogHash: computeDailyLogHash(),
  });
}

function computeMissRiskD4(res, weeks){
  const w = (weeks != null && isFinite(weeks) && weeks > 0) ? weeks : null;
  if (!w) return null;

  const ctx = computeWeeklyOpsContext(res, w);
  if (!ctx || !(ctx.goal > 0)) return null;

  const last7 = computeLastNLogSums(7);
  if (!last7?.hasLog || !(last7.days > 0)) return null;
  const paceAttemptsWeek = (last7.sumAttempts / last7.days) * 7;
  if (!(paceAttemptsWeek > 0)) return null;

  const eff = getEffectiveBaseRates();
  const baseCr = eff.cr;
  const baseSr = eff.sr;
  if (!(baseCr > 0) || !(baseSr > 0)) return null;

  const baseRr = (eff.tr != null && isFinite(eff.tr) && eff.tr > 0) ? eff.tr : 0.75;
  const baseDph = (safeNum(state.doorsPerHour3) != null && safeNum(state.doorsPerHour3) > 0) ? safeNum(state.doorsPerHour3) : 30;
  const baseCph = (safeNum(state.callsPerHour3) != null && safeNum(state.callsPerHour3) > 0) ? safeNum(state.callsPerHour3) : 25;
  const baseVol = (safeNum(state.volunteerMultBase) != null && safeNum(state.volunteerMultBase) > 0) ? safeNum(state.volunteerMultBase) : 1;
  const volBoost = safeNum(eff.volatilityBoost) || 0;

  const specs = (String(state.mcMode || "basic") === "advanced")
    ? buildAdvancedSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost })
    : buildBasicSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost });

  const runs = 200;
  const seedStr = `${state.mcSeed || ""}|missRisk|${hashMcInputs(res, w)}`;
  const rng = makeRng(seedStr);

  let miss = 0;
  let n = 0;

  for (let i = 0; i < runs; i++){
    const cr = clamp(triSample(specs.contactRate.min, specs.contactRate.mode, specs.contactRate.max, rng), 0.0001, 1);
    const sr = clamp(triSample(specs.persuasionRate.min, specs.persuasionRate.mode, specs.persuasionRate.max, rng), 0.0001, 1);

    const convosPerWeek = (ctx.goal / sr) / w;
    const attemptsPerWeek = convosPerWeek / cr;

    if (!isFinite(attemptsPerWeek) || !(attemptsPerWeek > 0)) continue;
    n++;
    if (attemptsPerWeek > paceAttemptsWeek) miss++;
  }

  if (n < 25) return null;
  return {
    runs: n,
    prob: miss / n,
    paceAttemptsWeek
  };
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

function deriveNeedVotes(res){
  const rawGoal = safeNum(state.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);
  return goal;
}


function renderRoi(res, weeks){
  if (!els.roiTbody) return;

  const needVotes = deriveNeedVotes(res);
  const eff = getEffectiveBaseRates();
  const cr = eff.cr;
  const sr = eff.sr;
  const tr = eff.tr;

  // Capacity ceiling (attempts) from Phase 3 inputs (blended)
  const w = (weeks != null && weeks >= 0) ? weeks : null;
  const capBreakdown = computeCapacityBreakdown({
    weeks: w,
    orgCount: safeNum(state.orgCount),
    orgHoursPerWeek: safeNum(state.orgHoursPerWeek),
    volunteerMult: safeNum(state.volunteerMultBase),
    doorShare: (() => {
      const v = safeNum(state.channelDoorPct);
      return (v != null) ? clamp(v, 0, 100) / 100 : null;
    })(),
    doorsPerHour: canonicalDoorsPerHourFromSnap(state),
    callsPerHour: safeNum(state.callsPerHour3),
  });
  const capAttempts = capBreakdown?.total ?? null;

  const budget = state.budget || {};
  const tactics = budget.tactics || {};
  const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
  const includeOverhead = !!budget.includeOverhead;

  const mcLast = state.mcLast || null;

  const turnoutModel = {
    enabled: !!state.turnoutEnabled,
    baselineTurnoutPct: (safeNum(state.turnoutTargetOverridePct) != null) ? safeNum(state.turnoutTargetOverridePct) : safeNum(state.turnoutBaselinePct),
    liftPerContactPP: (state.gotvMode === "advanced") ? safeNum(state.gotvLiftMode) : safeNum(state.gotvLiftPP),
    maxLiftPP: (state.gotvMode === "advanced") ? safeNum(state.gotvMaxLiftPP2) : safeNum(state.gotvMaxLiftPP),
    useDiminishing: (state.gotvMode === "advanced") ? !!state.gotvDiminishing2 : !!state.gotvDiminishing,
  };

  const { rows, banner } = engine.computeRoiRows({
    goalNetVotes: needVotes,
    baseRates: { cr, sr, tr },
    tactics,
    overheadAmount,
    includeOverhead,
    caps: { total: capAttempts, doors: capBreakdown?.doors ?? null, phones: capBreakdown?.phones ?? null },
    mcLast,
    turnoutModel,
  });

  // banner
  if (els.roiBanner){
    if (banner){
      els.roiBanner.hidden = false;
      els.roiBanner.className = `banner ${banner.kind}`;
      els.roiBanner.textContent = banner.text;
    } else {
      els.roiBanner.hidden = true;
    }
  }

  
  // Phase 6 — turnout summary (deterministic lens)
  if (els.turnoutSummary){
    if (turnoutModel.enabled){
      const U = safeNum(state.universeSize);
      const tuPct = safeNum(state.persuasionPct);
      const targetUniverseSize = (U != null && tuPct != null) ? Math.round(U * (clamp(tuPct, 0, 100) / 100)) : null;

      // Use capacity ceiling as a conservative "plan" for total attempted contacts, and base CR to convert to successful contacts.
      const contacts = (capAttempts != null && cr != null) ? Math.max(0, capAttempts * cr) : 0;

      const avgLiftPP = computeAvgLiftPP({
        baselineTurnoutPct: turnoutModel.baselineTurnoutPct,
        liftPerContactPP: turnoutModel.liftPerContactPP,
        maxLiftPP: turnoutModel.maxLiftPP,
        contacts,
        universeSize: targetUniverseSize || 0,
        useDiminishing: turnoutModel.useDiminishing,
      });

      const gotvAddedVotes = (targetUniverseSize != null) ? Math.round(targetUniverseSize * (avgLiftPP / 100)) : 0;
      const baseTxt = (turnoutModel.baselineTurnoutPct != null && isFinite(turnoutModel.baselineTurnoutPct)) ? `${Number(turnoutModel.baselineTurnoutPct).toFixed(1)}%` : "—";

      els.turnoutSummary.hidden = false;
      els.turnoutSummary.className = "banner ok";
      els.turnoutSummary.textContent = `Turnout enabled: baseline ${baseTxt} · modeled avg lift ${avgLiftPP.toFixed(1)}pp · implied +${fmtInt(gotvAddedVotes)} votes (at capacity ceiling).`;
    } else {
      els.turnoutSummary.hidden = true;
    }
  }

// render table
  els.roiTbody.innerHTML = "";
  if (!rows.length){
    const trEl = document.createElement("tr");
    trEl.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td>';
    els.roiTbody.appendChild(trEl);
    return;
  }

  for (const r of rows){
    const trEl = document.createElement("tr");

    const td0 = document.createElement("td");
    td0.textContent = r.label;

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = r.cpa == null ? "—" : `$${r.cpa.toFixed(2)}`;

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = r.costPerNetVote == null ? "—" : `$${r.costPerNetVote.toFixed(2)}`;

    const td2b = document.createElement("td");
    td2b.className = "num";
    td2b.textContent = (!turnoutModel.enabled || r.costPerTurnoutAdjustedNetVote == null) ? "—" : `$${r.costPerTurnoutAdjustedNetVote.toFixed(2)}`;

    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = r.totalCost == null ? "—" : `$${fmtInt(Math.round(r.totalCost))}`;

    const td4 = document.createElement("td");
    td4.textContent = r.feasibilityText || "—";

    trEl.appendChild(td0);
    trEl.appendChild(td1);
    trEl.appendChild(td2);
    trEl.appendChild(td2b);
    trEl.appendChild(td3);
    trEl.appendChild(td4);

    els.roiTbody.appendChild(trEl);
  }
}



function renderOptimization(res, weeks){
  if (!els.optTbody) return;

  // Reference context (not a constraint)
  const needVotes = deriveNeedVotes(res);
  if (els.optGapContext) els.optGapContext.textContent = (needVotes == null) ? "—" : fmtInt(Math.round(needVotes));

  const effective = compileEffectiveInputs(state);
  const cr = effective.rates.cr;
  const sr = effective.rates.sr;
  const tr = effective.rates.tr;

  // Phase 3 capacity ceiling (attempts)
  const w = (weeks != null && weeks >= 0) ? weeks : null;
  const capBreakdown = computeCapacityBreakdown({
    weeks: w,
    orgCount: effective.capacity.orgCount,
    orgHoursPerWeek: effective.capacity.orgHoursPerWeek,
    volunteerMult: effective.capacity.volunteerMult,
    doorShare: effective.capacity.doorShare,
    doorsPerHour: effective.capacity.doorsPerHour,
    callsPerHour: effective.capacity.callsPerHour,
  });
  const capAttempts = capBreakdown?.total ?? null;

  const budget = state.budget || {};
  const tacticsRaw = budget.tactics || {};
  const opt = budget.optimize || { mode:"budget", budgetAmount:0, capacityAttempts:"", step:25, useDecay:false };

  const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
  const includeOverhead = !!budget.includeOverhead;

  const tactics = engine.buildOptimizationTactics({
    baseRates: { cr, sr, tr },
    tactics: tacticsRaw
  });

  const bannerEl = els.optBanner;
  const showBanner = (kind, text) => {
    if (!bannerEl) return;
    bannerEl.hidden = false;
    bannerEl.className = `banner ${kind}`;
    bannerEl.textContent = text;
  };
  const hideBanner = () => {
    if (!bannerEl) return;
    bannerEl.hidden = true;
    bannerEl.textContent = "";
  };

  // Mode UI (budget vs capacity)
  if (els.optMode && els.optBudget && els.optCapacity){
    const m = opt.mode || "budget";
    const isBudget = m === "budget";
    const budgetField = els.optBudget.closest(".field");
    const capField = els.optCapacity.closest(".field");
    if (budgetField) budgetField.hidden = !isBudget;
    if (capField) capField.hidden = isBudget;
  }

  // Clear table
  els.optTbody.innerHTML = "";

  if (!tactics.length){
    hideBanner();
    showBanner("warn", "Optimization: Enable at least one tactic (Doors/Phones/Texts) in Phase 4 inputs.");
    setTotals(null);
    stubRow();
    return;
  }

  if (!(cr && cr > 0) || !(sr && sr > 0) || !(tr && tr > 0)){
    hideBanner();
    showBanner("warn", "Optimization: Enter Phase 2 Contact rate + Support rate and Phase 3 Turnout reliability to optimize.");
    setTotals(null);
    stubRow();
    return;
  }

  const step = safeNum(opt.step) ?? 25;
  const objective = opt.objective || "net";
  let result = null;

  if ((opt.mode || "budget") === "capacity"){
    const capUser = safeNum(opt.capacityAttempts);
    const cap = (capUser != null && capUser >= 0) ? capUser : (capAttempts != null ? capAttempts : 0);

    result = engine.optimizeMixBudget({
      capacity: cap,
      tactics,
      step,
      useDecay: !!opt.useDecay,
      objective
    });

    hideBanner();
    showBanner("ok", "Optimization: Capacity-constrained plan (maximize expected net persuasion votes under attempt ceiling).");

  } else {
    // Budget mode: overhead treated as fixed to avoid circular logic.
    const budgetIn = safeNum(opt.budgetAmount) ?? 0;
    const budgetAvail = Math.max(0, budgetIn - (includeOverhead ? overheadAmount : 0));

    result = engine.optimizeMixBudget({
      budget: budgetAvail,
      tactics,
      step,
      capacityCeiling: capAttempts,
      useDecay: !!opt.useDecay,
      objective
    });

    hideBanner();
    if (includeOverhead && overheadAmount > 0){
      showBanner("ok", `Optimization: Budget-constrained plan. Overhead ($${fmtInt(Math.round(overheadAmount))}) treated as fixed; remaining budget optimized.`);
    } else {
      showBanner("ok", "Optimization: Budget-constrained plan (maximize expected net persuasion votes under fixed budget).");
    }
  }

  if (!result){
    setTotals(null);
    stubRow();
    return;
  }

  
  // Phase 8A — Timeline-Constrained Optimization (optional)
  const tlConstrainedOn = !!opt.tlConstrainedEnabled;
  if (els.tlOptResults) els.tlOptResults.hidden = !tlConstrainedOn;

  if (tlConstrainedOn){
    const tacticKinds = {
      doors: state.budget?.tactics?.doors?.kind || "persuasion",
      phones: state.budget?.tactics?.phones?.kind || "persuasion",
      texts: state.budget?.tactics?.texts?.kind || "persuasion",
    };

    const capsInput = {
      enabled: !!state.timelineEnabled,
      weeksRemaining: weeks ?? 0,
      activeWeeksOverride: safeNum(state.timelineActiveWeeks),
      gotvWindowWeeks: safeNum(state.timelineGotvWeeks),
      staffing: {
        staff: safeNum(state.timelineStaffCount) ?? 0,
        volunteers: safeNum(state.timelineVolCount) ?? 0,
        staffHours: safeNum(state.timelineStaffHours) ?? 0,
        volunteerHours: safeNum(state.timelineVolHours) ?? 0,
      },
      throughput: {
        doors: safeNum(state.timelineDoorsPerHour) ?? 0,
        phones: safeNum(state.timelineCallsPerHour) ?? 0,
        texts: safeNum(state.timelineTextsPerHour) ?? 0,
      },
      tacticKinds
    };

    const caps = engine.computeMaxAttemptsByTactic(capsInput);

    const budgetIn = safeNum(opt.budgetAmount) ?? 0;
    const budgetAvail = Math.max(0, budgetIn - (includeOverhead ? overheadAmount : 0));

    const capUser = safeNum(opt.capacityAttempts);
    const capLimit = (capUser != null && capUser >= 0) ? capUser : (capAttempts != null ? capAttempts : 0);

    const tlObj = opt.tlConstrainedObjective || "max_net";
    const tlInputs = {
      mode: (opt.mode || "budget"),
      budgetLimit: (opt.mode === "capacity") ? null : budgetAvail,
      capacityLimit: (opt.mode === "capacity") ? capLimit : null,
      capacityCeiling: (opt.mode === "capacity") ? null : capAttempts,
      tactics,
      step,
      useDecay: !!opt.useDecay,
      objective,
      maxAttemptsByTactic: (caps && caps.enabled) ? caps.maxAttemptsByTactic : null,
      tlObjectiveMode: tlObj,
      goalNetVotes: needVotes
    };

    const tlOut = engine.optimizeTimelineConstrained(tlInputs);

    if (tlOut && tlOut.plan){
      result = tlOut.plan;
    }

    const meta = tlOut?.meta || {};
    if (els.tlOptGoalFeasible) els.tlOptGoalFeasible.textContent = (meta.goalFeasible === true) ? "true" : (meta.goalFeasible === false ? "false" : "—");
    if (els.tlOptMaxNetVotes) els.tlOptMaxNetVotes.textContent = fmtInt(Math.round(meta.maxAchievableNetVotes ?? 0));
    if (els.tlOptRemainingGap) els.tlOptRemainingGap.textContent = fmtInt(Math.round(meta.remainingGapNetVotes ?? 0));
    if (els.tlOptBinding){
      const b = meta.bindingObj || {};
      const parts = [];
      if (Array.isArray(b.timeline) && b.timeline.length) parts.push("timeline");
      if (b.budget) parts.push("budget");
      if (b.capacity) parts.push("capacity");
      els.tlOptBinding.textContent = parts.length ? parts.join(" / ") : "none";
    }

    // Cache TL optimization meta for exports (Phase 9A)
    state.ui.lastTlMeta = structuredClone(meta);

    // Phase 8B — Bottlenecks & Marginal Value (diagnostic)
    const mv = engine.computeMarginalValueDiagnostics({
      baselineInputs: tlInputs,
      baselineResult: tlOut,
      timelineInputs: capsInput
    });

    // Cache bottleneck diagnostics for exports (Phase 9A)
    state.ui.lastDiagnostics = {
      primaryBottleneck: mv?.primaryBottleneck || null,
      secondaryNotes: mv?.secondaryNotes || null
    };

    if (els.tlMvPrimary) els.tlMvPrimary.textContent = mv?.primaryBottleneck || "—";
    if (els.tlMvSecondary) els.tlMvSecondary.textContent = mv?.secondaryNotes || "—";

    if (els.tlMvTbody){
      els.tlMvTbody.innerHTML = "";
      const rows = Array.isArray(mv?.interventions) ? mv.interventions : [];
      for (const it of rows){
        const trEl = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = it?.intervention || "—";

        const td1 = document.createElement("td");
        td1.className = "num";
        const dv = (it && typeof it.deltaMaxNetVotes === "number") ? it.deltaMaxNetVotes : null;
        td1.textContent = (dv == null) ? "—" : fmtInt(Math.round(dv));

        const td2 = document.createElement("td");
        td2.className = "num";
        const dc = (it && typeof it.deltaCost === "number") ? it.deltaCost : null;
        td2.textContent = (dc == null) ? "—" : `$${fmtInt(Math.round(dc))}`;

        const td3 = document.createElement("td");
        td3.className = "muted";
        td3.textContent = it?.notes || "—";

        trEl.appendChild(td0);
        trEl.appendChild(td1);
        trEl.appendChild(td2);
        trEl.appendChild(td3);
        els.tlMvTbody.appendChild(trEl);
      }
      if (!rows.length){
        const tr = document.createElement("tr");
        tr.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td>';
        els.tlMvTbody.appendChild(tr);
      }
    }
  }
// Cache for Phase 7 feasibility (no backward coupling)
  state.ui.lastOpt = {
    allocation: structuredClone(result.allocation || {}),
    totals: structuredClone(result.totals || {}),
    binding: result.binding || "caps",
    objective
  };

  // Table rows
  let any = false;
  for (const t of tactics){
    const a = result.allocation?.[t.id] ?? 0;
    if (!a) continue;
    any = true;

    const trEl = document.createElement("tr");

    const td0 = document.createElement("td");
    td0.textContent = t.label;

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = fmtInt(Math.round(a));

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = `$${fmtInt(Math.round(a * t.costPerAttempt))}`;

    const td3 = document.createElement("td");
    td3.className = "num";
    const obj = (state.budget?.optimize?.objective || "net");
    const vpa = (obj === "turnout") ? (t.turnoutAdjustedNetVotesPerAttempt ?? t.netVotesPerAttempt) : t.netVotesPerAttempt;
    td3.textContent = fmtInt(Math.round(a * (Number.isFinite(vpa) ? vpa : 0)));

    trEl.appendChild(td0);
    trEl.appendChild(td1);
    trEl.appendChild(td2);
    trEl.appendChild(td3);
    els.optTbody.appendChild(trEl);
  }

  if (!any) stubRow();

  const totalAttempts = result.totals?.attempts ?? 0;
  let totalCost = result.totals?.cost ?? 0;
  if ((opt.mode || "budget") === "budget" && includeOverhead && overheadAmount > 0){
    totalCost += overheadAmount;
  }
  const totalVotes = result.totals?.netVotes ?? 0; // netVotes is objective-aligned in optimize.js

  setTotals({
    attempts: totalAttempts,
    cost: totalCost,
    votes: totalVotes,
    binding: result.binding || "—"
  });

  // Phase 9A — cache export-ready plan rows + meta + summary (pure formatting; no optimizer changes)
  try {
    const obj = (state.budget?.optimize?.objective || "net");
    const planRows = [];
    const alloc = result.allocation || {};
    for (const t of tactics){
      const a = alloc?.[t.id] ?? 0;
      if (!a) continue;
      const attempts = Number(a) || 0;
      const usedCr = (t.used && Number.isFinite(t.used.cr)) ? t.used.cr : 0;
      const expectedContacts = attempts * usedCr;
      const vpa = (obj === "turnout") ? (t.turnoutAdjustedNetVotesPerAttempt ?? t.netVotesPerAttempt) : t.netVotesPerAttempt;
      const expectedNetVotes = attempts * (Number.isFinite(vpa) ? vpa : 0);
      const cost = attempts * (Number.isFinite(t.costPerAttempt) ? t.costPerAttempt : 0);
      const costPerNetVote = (expectedNetVotes > 0) ? (cost / expectedNetVotes) : null;

      planRows.push({
        tactic: t.label,
        attempts: Math.round(attempts),
        expectedContacts,
        expectedNetVotes,
        cost,
        costPerNetVote
      });
    }

    const weeksMeta = (weeks != null && Number.isFinite(weeks)) ? Math.max(0, Math.floor(weeks)) : null;
    const staffMeta = safeNum(state.timelineStaffCount) ?? null;
    const volMeta = safeNum(state.timelineVolCount) ?? null;

    const tlPct = state.ui?.lastTimeline?.percentPlanExecutable;
    const tlGoalFeasible = state.ui?.lastTlMeta?.goalFeasible;
    const feasible = (state.timelineEnabled)
      ? (tlGoalFeasible === true ? true : (tlGoalFeasible === false ? false : (tlPct != null ? tlPct >= 0.999 : null)))
      : true;

    state.ui.lastPlanRows = structuredClone(planRows);
    state.ui.lastPlanMeta = {
      weeks: weeksMeta,
      staff: staffMeta,
      volunteers: volMeta,
      objective: obj,
      feasible
    };

    const topAllocations = planRows
      .slice()
      .sort((a,b) => (b.attempts||0) - (a.attempts||0))
      .slice(0,3)
      .map(r => `${r.tactic}: ${fmtInt(Math.round(r.attempts))} attempts`);

    state.ui.lastSummary = {
      objective: obj,
      netVotes: Math.round(totalVotes || 0),
      cost: Math.round(totalCost || 0),
      feasible,
      primaryBottleneck: state.ui?.lastDiagnostics?.primaryBottleneck || null,
      topAllocations
    };
  } catch {}

  function setTotals(t){
    if (els.optTotalAttempts) els.optTotalAttempts.textContent = t ? fmtInt(Math.round(t.attempts)) : "—";
    if (els.optTotalCost) els.optTotalCost.textContent = t ? `$${fmtInt(Math.round(t.cost))}` : "—";
    if (els.optTotalVotes) els.optTotalVotes.textContent = t ? fmtInt(Math.round(t.votes)) : "—";
    if (els.optBinding) els.optBinding.textContent = t ? (t.binding || "—") : "—";
  }

  function stubRow(){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td>';
    els.optTbody.appendChild(tr);
  }
}

function renderTimeline(res, weeks){
  if (!els.timelineEnabled || !els.tlPercent) return;

  // Weeks auto display
  if (els.timelineWeeksAuto) els.timelineWeeksAuto.value = (weeks == null) ? "" : String(Math.max(0, Math.floor(weeks)));

  const enabled = !!state.timelineEnabled;
  const banner = els.tlBanner;
  const setBanner = (kind, text) => {
    if (!banner) return;
    banner.hidden = false;
    banner.className = `banner ${kind}`;
    banner.textContent = text;
  };
  const hideBanner = () => {
    if (!banner) return;
    banner.hidden = true;
    banner.textContent = "";
  };

  if (!enabled){
    els.tlPercent.textContent = "—";
    els.tlCompletionWeek.textContent = "—";
    els.tlShortfallAttempts.textContent = "—";
    els.tlConstraint.textContent = "—";
    if (els.tlShortfallVotes) els.tlShortfallVotes.textContent = "—";
    if (els.tlWeekList) els.tlWeekList.textContent = "—";
    hideBanner();
    return;
  }

  const lastOpt = state.ui?.lastOpt || null;
  const required = (lastOpt && lastOpt.allocation && typeof lastOpt.allocation === "object") ? lastOpt.allocation : {};
  const bindingHint = lastOpt?.binding || "caps";

  const totals = lastOpt?.totals || {};
  const attemptsTotal = safeNum(totals.attempts) ?? null;
  const netVotesTotal = safeNum(totals.netVotes) ?? null;
  const netVotesPerAttempt = (attemptsTotal != null && attemptsTotal > 0 && netVotesTotal != null)
    ? (netVotesTotal / attemptsTotal)
    : null;

  const activeOverride = safeNum(state.timelineActiveWeeks);

  const tacticKinds = {
    doors: state.budget?.tactics?.doors?.kind || "persuasion",
    phones: state.budget?.tactics?.phones?.kind || "persuasion",
    texts: state.budget?.tactics?.texts?.kind || "persuasion",
  };

  const tl = engine.computeTimelineFeasibility({
    enabled: true,
    weeksRemaining: weeks ?? 0,
    activeWeeksOverride: (activeOverride == null ? null : activeOverride),
    gotvWindowWeeks: safeNum(state.timelineGotvWeeks),
    staffing: {
      staff: safeNum(state.timelineStaffCount) ?? 0,
      volunteers: safeNum(state.timelineVolCount) ?? 0,
      staffHours: safeNum(state.timelineStaffHours) ?? 0,
      volunteerHours: safeNum(state.timelineVolHours) ?? 0,
    },
    throughput: {
      doors: safeNum(state.timelineDoorsPerHour) ?? 0,
      phones: safeNum(state.timelineCallsPerHour) ?? 0,
      texts: safeNum(state.timelineTextsPerHour) ?? 0,
    },
    required,
    tacticKinds,
    netVotesPerAttempt,
    bindingHint,
    ramp: { enabled: !!state.timelineRampEnabled, mode: state.timelineRampMode || "linear" }
  });

  // Cache timeline feasibility snapshot for exports (Phase 9A)
  state.ui.lastTimeline = {
    percentPlanExecutable: tl.percentPlanExecutable ?? null,
    projectedCompletionWeek: tl.projectedCompletionWeek ?? null,
    shortfallAttempts: tl.shortfallAttempts ?? null,
    shortfallNetVotes: tl.shortfallNetVotes ?? null,
    constraintType: tl.constraintType || null
  };

  const pct = Math.round((tl.percentPlanExecutable ?? 0) * 100);
  els.tlPercent.textContent = `${pct}%`;
  els.tlCompletionWeek.textContent = (tl.projectedCompletionWeek == null) ? "—" : String(tl.projectedCompletionWeek);
  els.tlShortfallAttempts.textContent = fmtInt(Math.round(tl.shortfallAttempts ?? 0));
  els.tlConstraint.textContent = tl.constraintType || "—";

  if (els.tlShortfallVotes){
    els.tlShortfallVotes.textContent = (tl.shortfallNetVotes == null) ? "—" : fmtInt(Math.round(tl.shortfallNetVotes));
  }

  if (els.tlWeekList){
    if (!tl.weekly || !tl.weekly.length){
      els.tlWeekList.textContent = "—";
    } else {
      els.tlWeekList.textContent = tl.weekly.map(w => `Week ${w.week}: ${fmtInt(Math.round(w.attempts || 0))} attempts`).join("\n");
    }
  }

  if (tl.percentPlanExecutable < 1){
    setBanner("warn", `Timeline feasibility: ${pct}% executable · shortfall ${fmtInt(Math.round(tl.shortfallAttempts || 0))} attempts.`);
  } else {
    hideBanner();
  }
}

function renderPhase3(res, weeks){
  // Phase 3 panel isn't present, fail silently.
  if (!els.p3CapContacts) return;

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  els.p3Weeks.textContent = w == null ? "—" : fmtInt(w);

  // Base rates (Phase 2 + Phase 16 adjustments when enabled)
  const effective = compileEffectiveInputs(state);
  const cr = effective.rates.cr;
  const pr = effective.rates.sr;
  const rr = effective.rates.tr;

  // Capacity inputs
  const orgCount = effective.capacity.orgCount;
  const orgHrs = effective.capacity.orgHoursPerWeek;
  const volMult = effective.capacity.volunteerMult;
  const doorShare = effective.capacity.doorShare;

  const dph = effective.capacity.doorsPerHour;
  const cph = effective.capacity.callsPerHour;

  const capContacts = computeCapacityContacts({
    weeks: w,
    orgCount,
    orgHoursPerWeek: orgHrs,
    volunteerMult: volMult,
    doorShare,
    doorsPerHour: dph,
    callsPerHour: cph,
  });

  els.p3CapContacts.textContent = (capContacts == null) ? "—" : fmtInt(Math.floor(capContacts));

  // Required contacts under base rates (using persuasion need)
  const needVotes = deriveNeedVotes(res);

  let reqContacts = null;
  if (needVotes > 0 && cr && cr > 0 && pr && pr > 0 && rr && rr > 0){
    const reqSupports = needVotes / rr;
    const reqConvos = reqSupports / pr;
    reqContacts = reqConvos / cr;
  }

  // Gap
  if (capContacts == null || reqContacts == null){
    els.p3GapContacts.textContent = "—";
    els.p3GapNote.textContent = "Enter Phase 2 rates + Phase 3 capacity to compute.";
  } else {
    const gap = capContacts - reqContacts;
    const sign = gap >= 0 ? "+" : "−";
    els.p3GapContacts.textContent = `${sign}${fmtInt(Math.ceil(Math.abs(gap)))}`;
    if (gap >= 0){
      els.p3GapNote.textContent = `Capacity ≥ requirement (base rates).`;
    } else {
      els.p3GapNote.textContent = `Shortfall vs requirement (base rates).`;
    }
  }

  renderMcFreshness(res, w);

  // Render last MC results if present
  if (state.mcLast){
    renderMcResults(state.mcLast);
  }
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
  const modelInput = {
    universeSize: safeNum(state.universeSize),
    turnoutA: safeNum(state.turnoutA),
    turnoutB: safeNum(state.turnoutB),
    bandWidth: safeNum(state.bandWidth),
    candidates: state.candidates.map(c => ({ id: c.id, name: c.name, supportPct: safeNum(c.supportPct) })),
    undecidedPct: safeNum(state.undecidedPct),
    yourCandidateId: state.yourCandidateId,
    undecidedMode: state.undecidedMode,
    userSplit: state.userSplit,
    persuasionPct: safeNum(state.persuasionPct),
    earlyVoteExp: safeNum(state.earlyVoteExp),
  };
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
  if (!els.mcWinProb) return;

  if (summary.winProbTurnoutAdjusted != null && summary.winProbTurnoutAdjusted !== summary.winProb){
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}% (TA: ${(summary.winProbTurnoutAdjusted * 100).toFixed(1)}%)`);
  } else {
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}%`);
  }
  els.mcMedian.textContent = fmtSigned(summary.median);
  els.mcP5.textContent = fmtSigned(summary.p5);
  els.mcP95.textContent = fmtSigned(summary.p95);

  // Phase 14 — Confidence Envelope
  if (summary.confidenceEnvelope){
    const ce = summary.confidenceEnvelope;
    if (els.mcP10) setTextPair(els.mcP10, els.mcP10Sidebar, fmtSigned(ce.percentiles?.p10));
    if (els.mcP50) setTextPair(els.mcP50, els.mcP50Sidebar, fmtSigned(ce.percentiles?.p50));
    if (els.mcP90) setTextPair(els.mcP90, els.mcP90Sidebar, fmtSigned(ce.percentiles?.p90));
    if (els.mcMoS) els.mcMoS.textContent = fmtSigned(ce.risk?.marginOfSafety);
    if (els.mcDownside) els.mcDownside.textContent = `${((ce.risk?.downsideRiskMass ?? 0) * 100).toFixed(1)}%`;
    if (els.mcES10) els.mcES10.textContent = fmtSigned(ce.risk?.expectedShortfall10);
    if (els.mcShiftP50) els.mcShiftP50.textContent = fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP50 ?? 0));
    if (els.mcShiftP10) els.mcShiftP10.textContent = fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP10 ?? 0));
    if (els.mcFragility) els.mcFragility.textContent = (ce.risk?.fragility?.fragilityIndex ?? 0).toFixed(3);
    if (els.mcCliff) els.mcCliff.textContent = `${((ce.risk?.fragility?.cliffRisk ?? 0) * 100).toFixed(1)}%`;
    // Phase 14.1 extras
    if (els.mcRiskGrade) els.mcRiskGrade.textContent = ce.risk?.advisor?.grade || "—";
    if (els.mcShift60) els.mcShift60.textContent = fmtInt(Math.round(ce.risk?.targets?.shiftWin60 ?? 0));
    if (els.mcShift70) els.mcShift70.textContent = fmtInt(Math.round(ce.risk?.targets?.shiftWin70 ?? 0));
    if (els.mcShift80) els.mcShift80.textContent = fmtInt(Math.round(ce.risk?.targets?.shiftWin80 ?? 0));
    if (els.mcShock10) els.mcShock10.textContent = `${((ce.risk?.shocks?.lossProb10 ?? 0) * 100).toFixed(1)}%`;
    if (els.mcShock25) els.mcShock25.textContent = `${((ce.risk?.shocks?.lossProb25 ?? 0) * 100).toFixed(1)}%`;
    if (els.mcShock50) els.mcShock50.textContent = `${((ce.risk?.shocks?.lossProb50 ?? 0) * 100).toFixed(1)}%`;
  }


  if (els.mcRiskLabel){
    let extra = "";
    if (summary.turnoutAdjusted){
      extra = ` | TA votes (p50): ${fmtInt(Math.round(summary.turnoutAdjusted.p50))}`;
    }
        const ceNote = summary.confidenceEnvelope?.risk?.advisor?.narrative;
    const label = ceNote ? ceNote : summary.riskLabel;
    els.mcRiskLabel.textContent = `${label} — Need: ${fmtInt(Math.round(summary.needVotes))} net persuasion votes.${extra}`;
  }

  if (els.mcSensitivity){
    els.mcSensitivity.innerHTML = "";
    summary.sensitivity.forEach(row => {
      const tr = document.createElement("tr");
      const tdA = document.createElement("td");
      tdA.textContent = row.label;
      const tdB = document.createElement("td");
      tdB.className = "num";
      tdB.textContent = row.impact == null ? "—" : row.impact.toFixed(2);
      tr.appendChild(tdA);
      tr.appendChild(tdB);
      els.mcSensitivity.appendChild(tr);
    });
  }

  // Lightweight visuals
  renderMcVisuals(summary);
}

function renderMcVisuals(summary){
  // Win probability bar
  if (els.svgWinProbMarker && els.vizWinProbNote){
    const p = clamp(summary?.winProb ?? 0, 0, 1);
    const x = 300 * p;
    els.svgWinProbMarker.setAttribute("cx", x.toFixed(2));
    els.vizWinProbNote.textContent = `${(p * 100).toFixed(1)}% chance to win (model-based).`;
  }

  // Margin distribution histogram
  if (!els.svgMarginBars || !els.svgMarginZero || !els.svgMarginMin || !els.svgMarginMax || !els.svgMarginWinShade) return;
  const h = summary?.histogram;
  els.svgMarginBars.innerHTML = "";
  els.svgMarginWinShade.innerHTML = "";
  if (!h || !h.counts || !h.counts.length || !isFinite(h.min) || !isFinite(h.max)){
    els.svgMarginMin.textContent = "—";
    els.svgMarginMax.textContent = "—";
    els.svgMarginZero.setAttribute("x1", 150);
    els.svgMarginZero.setAttribute("x2", 150);
    return;
  }

  const W = 300;
  const baseY = 76;
  const topY = 12;
  const H = (baseY - topY);
  const counts = h.counts;
  const maxC = Math.max(1, ...counts);
  const n = counts.length;
  const bw = W / n;

  const span = (h.max - h.min) || 1;
  const x0 = clamp(((0 - h.min) / span) * W, 0, W);
  els.svgMarginZero.setAttribute("x1", x0.toFixed(2));
  els.svgMarginZero.setAttribute("x2", x0.toFixed(2));

  // Shade the win side (right of zero) when it falls inside the plotted range
  if (x0 > 0 && x0 < W){
    const shade = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shade.setAttribute("x", x0.toFixed(2));
    shade.setAttribute("y", topY);
    shade.setAttribute("width", (W - x0).toFixed(2));
    shade.setAttribute("height", H);
    shade.setAttribute("class", "viz-winshade");
    els.svgMarginWinShade.appendChild(shade);
  }

  for (let i=0;i<n;i++){
    const c = counts[i];
    const bh = (c / maxC) * H;
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", (i * bw + 0.6).toFixed(2));
    r.setAttribute("y", (baseY - bh).toFixed(2));
    r.setAttribute("width", Math.max(0.5, bw - 1.2).toFixed(2));
    r.setAttribute("height", bh.toFixed(2));
    r.setAttribute("class", "viz-bar");
    els.svgMarginBars.appendChild(r);
  }

  els.svgMarginMin.textContent = fmtSigned(h.min);
  els.svgMarginMax.textContent = fmtSigned(h.max);
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
