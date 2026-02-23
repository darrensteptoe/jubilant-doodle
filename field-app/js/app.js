import { engine } from "./engine.js";
import { computeCapacityContacts as coreComputeCapacityContacts, computeCapacityBreakdown as coreComputeCapacityBreakdown } from "./core/model.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS, computeUniverseAdjustedRates } from "./core/universeLayer.js";
import { computeAvgLiftPP } from "./core/turnout.js";
import { fmtInt, clamp, safeNum, downloadJson, readJsonFile } from "./utils.js";
import { loadState, saveState, clearState, readBackups, writeBackupEntry } from "./storage.js";
import { createScenarioManager } from "./scenarioManager.js";
import { APP_VERSION, BUILD_ID } from "./build.js";
import { computeSnapshotHash } from "./hash.js";
import { makeRng, triSample } from "./core/rng.js";
import { DEFAULTS_BY_TEMPLATE, makeDefaultState, normalizeLoadedState, requiredScenarioKeysMissing, applyUiStatePatch, cloneStateSnapshot } from "./app/state.js";
import { derivedWeeksRemainingFromState, getUniverseLayerConfig as getUniverseLayerConfigForState, getEffectiveBaseRates as getEffectiveBaseRatesForState, computeWeeklyOpsContextFromState } from "./app/selectors.js";
import { renderTimelinePanel } from "./app/render/timeline.js";
import { renderWeeklyExecutionStatusPanel } from "./app/render/weeklyExecution.js";
import { renderWeeklyOpsPanel } from "./app/render/weeklyOps.js";
import { renderWeeklyOpsInsightsPanel, renderWeeklyOpsFreshnessPanel } from "./app/render/weeklyOpsInsights.js";
import { renderRiskFramingPanel } from "./app/render/riskFraming.js";
import { renderAssumptionDriftPanel } from "./app/render/assumptionDrift.js";
import { renderDecisionConfidencePanel, renderDecisionIntelligencePanelView, renderScenarioComparePanelView } from "./app/render/decisionPanels.js";
import { renderRoiPanel, renderOptimizationPanel } from "./app/render/optimization.js";
import { renderPhase3Panel, renderMcResultsPanel, renderMcVisualsPanel } from "./app/render/monteCarlo.js";
import { renderBottleneckAttributionPanel, renderConversionPanel, renderSensitivitySnapshotPanel, runSensitivitySnapshotPanel } from "./app/render/executionAnalysis.js";
import { renderScenarioComparisonPanel } from "./app/render/scenarioComparison.js";
import { wireEventsApp } from "./app/wireEvents.js";
import { initDevToolsPanel } from "./app/devtools.js";
import { applyStateToUiBindings } from "./app/uiBindings.js";
import { wireDecisionSessionBindings } from "./app/decisionSessionBindings.js";

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

function updateDiagnosticsUI(){
  try{
    if (!els.diagErrors) return;
    if (!recentErrors.length){
      els.diagErrors.textContent = "(none)";
      return;
    }
    const lines = recentErrors.map((e) => {
      const head = `[${e.t}] ${e.kind}: ${e.msg}`;
      return head;
    });
    els.diagErrors.textContent = lines.join("\n");
  } catch { /* ignore */ }
}

async function copyDebugBundle(){
  const bundle = {
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    scenarioName: state?.scenarioName || "",
    lastExportHash: lastExportHash || null,
    recentErrors: recentErrors.slice(0, MAX_ERRORS),
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
        writeBackupEntry({ ts: new Date().toISOString(), scenarioName: scenarioClone?.scenarioName || "", payload });
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
  if (!entry || !entry.payload) return;
  const ok = confirm("Restore this backup? This will overwrite current scenario inputs.");
  if (!ok) return;

  const migrated = engine.snapshot.migrateSnapshot(entry.payload);
  if (!migrated || !migrated.ok){
    alert("Backup restore failed: could not migrate snapshot.");
    return;
  }
  state = migrated.scenario;
  ensureDecisionScaffold();
  persist();
  render();
  safeCall(() => { renderDecisionSessionD1(); });
}



import { els } from "./ui/els.js";

function setText(el, text){ if(el) el.textContent = String(text ?? ""); }
function setValue(el, val){ if(el) el.value = String(val ?? ""); }
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


let state = loadState() || makeDefaultState();
let lastStorageWarnAt = 0;

// setState(patchFn) — controlled state mutation for UI-only writes.
// Shallow-clones state, deep-clones only state.ui (where all setState writes live).
// Engine/scenario fields are never mutated here so reference copies are safe.
function setState(patchFn){
  state = applyUiStatePatch(state, patchFn);
  render();
  persist();
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
const scenarioMgr = createScenarioManager({ max: 5 });

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
  const createdId = lastAppliedWeeklyAction.createdScenarioId;
  lastAppliedWeeklyAction = null;
  if (createdId) scenarioMgr.remove(createdId);
  state = prev;
  ensureDecisionScaffold();
  applyStateToUI();
  render();
  persist();
  syncWeeklyUndoUI();
  safeCall(() => { renderDecisionSessionD1(); });
}

const recentErrors = [];
const MAX_ERRORS = 20;
let backupTimer = null;

function uid(){
  return Math.random().toString(16).slice(2,10);
}

function applyStateToUI(){
  applyStateToUiBindings({
    els,
    state,
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
      render();
      persist();
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
      render();
      persist();
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
      render();
      persist();
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
      render();
      persist();
    });

    row.appendChild(name);
    row.appendChild(inp);
    els.userSplitList.appendChild(row);
  }
}

function wireEvents(){
  wireEventsApp({
    els,
    state,
    safeCall,
    setState,
    refreshBackupDropdown,
    restoreBackupByIndex,
    openDiagnostics,
    closeDiagnostics,
    copyDebugBundle,
    exportDailyLog,
    mergeDailyLogIntoState,
    applyRollingRateToAssumption,
    undoLastWeeklyAction,
    DEFAULTS_BY_TEMPLATE,
    applyStateToUI,
    applyThemeFromState,
    initThemeSystemListener,
    render,
    persist,
    safeNum,
    uid,
    rebuildCandidateTable,
    rebuildUserSplitInputs,
    syncGotvModeUI,
    syncMcModeUI,
    markMcStale,
    runMonteCarloNow,
    APP_VERSION,
    BUILD_ID,
    engine,
    lastExportHashRef: () => lastExportHash,
    setLastExportHash: (v) => { lastExportHash = v; },
    downloadText,
    lastResultsSnapshotRef: () => lastResultsSnapshot,
    clearState,
    makeDefaultState,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    renderScenarioManagerC1,
    renderDecisionSessionD1,
    readJsonFile,
    normalizeLoadedState,
    requiredScenarioKeysMissing,
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
  return renderWeeklyExecutionStatusPanel({ els, ctx, computeLastNLogSums, fmtInt, clamp });
}

function computeWeeklyOpsContext(res, weeks){
  return computeWeeklyOpsContextFromState(state, {
    res,
    weeks,
    getEffectiveBaseRatesForState: (s) => getEffectiveBaseRatesForState(s, { computeUniverseAdjustedRates }),
    computeCapacityBreakdown: coreComputeCapacityBreakdown,
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

  const created = scenarioMgr.add({
    label: next.scenarioName,
    snapshot: next,
    engine,
    modelVersion: engine.snapshot.MODEL_VERSION
  });

  lastAppliedWeeklyAction = {
    label: "Applied: " + label,
    prevState,
    createdScenarioId: created?.id || null
  };

  state = next;
  applyStateToUI();
  render();
  persist();
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
}




function renderScenarioComparePanel(){
  return renderScenarioComparePanelView({ els, scenarioMgr });
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
  const lists = [els.validationList].filter(Boolean);
  if (!lists.length) return;
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

  for (const ul of lists) ul.innerHTML = "";
  for (const it of items){
    const li = document.createElement("li");
    li.className = it.kind;
    li.textContent = it.text;
    for (const ul of lists) ul.appendChild(li.cloneNode(true));
  }
}

function renderAssumptions(res, weeks){
  const blocks = [];

  blocks.push(block("Race & scenario", [
    kv("Scenario", state.scenarioName || "—"),
    kv("Template", labelTemplate(state.raceType)),
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

  els.assumptionsSnapshot.innerHTML = "";
  for (const b of blocks) els.assumptionsSnapshot.appendChild(b);
}

function renderGuardrails(res){
  const gs = [];
  for (const g of res.guardrails){
    gs.push(block(g.title, g.lines.map(l => kv(l.k, l.v))));
  }
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


function onSaveScenarioClick(){
  try{
    const snap = getStateSnapshot();
    const engineFacade = engine;
    const accessors = {
      getStateSnapshot,
      withPatchedState,
      computeAll: (mi, options) => engineFacade.computeAll(mi, options),
      derivedWeeksRemaining,
      deriveNeedVotes,
      runMonteCarloSim,
      computeMaxAttemptsByTactic: engineFacade.computeMaxAttemptsByTactic,
      computeTimelineFeasibility: engineFacade.computeTimelineFeasibility,
      snapshot: engineFacade.snapshot,
    };
    scenarioMgr.add({
      label: (snap.scenarioName || "").trim() || `Scenario ${scenarioMgr.list().length + 1}`,
      snapshot: snap,
      engine: accessors,
      modelVersion: engineFacade.snapshot.MODEL_VERSION,
    });
    // Re-render using current res/weeks if available
    try{
      const res = engine.computeAll(snap);
      const weeks = derivedWeeksRemaining();
      renderScenarioComparePanel({ res, weeks });
    } catch { /* ignore */ }
  } catch {
    // fail-soft
  }
}

function wireScenarioComparePanel(){
  if (!els.btnSaveScenario || !els.scCompareTbody) return;

  els.btnSaveScenario.addEventListener("click", () => onSaveScenarioClick());

  // delegate label edits + deletes
  els.scCompareTbody.addEventListener("input", (e) => {
    const t = e.target;
    const id = t?.getAttribute?.("data-sc-label");
    if (!id) return;
    scenarioMgr.setLabel(id, t.value);
    // Keep scenario name column in sync
    try{
      const row = els.scCompareTbody.querySelector(`tr[data-sc-row="${CSS.escape(id)}"] td:first-child`);
      if (row) row.textContent = t.value;
      if (els.scOverall && els.scOverall.textContent.includes(id)) { /* ignore */ }
    } catch { /* ignore */ }
  });

  els.scCompareTbody.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-sc-del]");
    const id = btn?.getAttribute?.("data-sc-del");
    if (!id) return;
    scenarioMgr.remove(id);
    try{
      const snap = getStateSnapshot();
      const res = engine.computeAll(snap);
      const weeks = derivedWeeksRemaining();
      renderScenarioComparePanel({ res, weeks });
    } catch { /* ignore */ }
  });

  // Phase 15 — Sensitivity Surface
  safeCall(() => { wireSensitivitySurface(); });
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
  renderScenarioComparisonPanel({
    els,
    state,
    ensureScenarioRegistry,
    SCENARIO_BASELINE_ID,
    scenarioClone,
    scenarioInputsFromState,
    engine,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
    computeLastNLogSums,
    paceFinishDate,
    fmtInt,
    fmtISODate,
  });
}

function wireDecisionSessionD1(){
  wireDecisionSessionBindings({
    els,
    state,
    ensureDecisionScaffold,
    persist,
    renderDecisionSessionD1,
    createNewDecisionSession,
    renameActiveDecisionSession,
    deleteActiveDecisionSession,
    linkDecisionSessionToActiveScenario,
    wireInput,
    getActiveDecisionSession,
    ensureDecisionSessionShape,
    getActiveDecisionOption,
    ensureDecisionOptionShape,
    createNewDecisionOption,
    renameActiveDecisionOption,
    deleteActiveDecisionOption,
    linkDecisionOptionToActiveScenario,
    renderDecisionSummaryD4,
    buildDecisionSummaryText,
    copyTextToClipboard,
    decisionSummaryPlainText,
    decisionSessionExportObject,
    downloadJsonObject,
    runSensitivitySnapshotE4,
  });
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

      const accessors = { withPatchedState, runMonteCarloSim };

      const result = engine.computeSensitivitySurface({
        engine: accessors,
        baseline: { scenario: snap, res, weeks, needVotes },
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
  const tab = state.ui?.activeTab || "win";
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
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
  initDevToolsPanel({
    state,
    engine,
    isDevMode,
    derivedWeeksRemaining,
    safeNum,
    deriveNeedVotes,
    getSelfTestAccessors,
    updateSelfTestGateStatus: (r) => updateSelfTestGateStatus(r),
    renderRiskSummaryIntoStress,
    fmtInt,
  });
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
  installGlobalErrorCapture();
  preflightEls();
  ensureScenarioRegistry();
  ensureDecisionScaffold();
  wireScenarioManagerC1();
  wireScenarioComparePanel();
  wireDecisionSessionD1();
  updateBuildStamp();
  updateSelfTestGateBadge();
  refreshBackupDropdown();

  applyStateToUI();
  rebuildCandidateTable();
  initTabs();
  initExplainCard();
  wireEvents();
  initDevTools();
  render();
  try{
    ensureScenarioRegistry();
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
  return cloneStateSnapshot(state);
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
    doorsPerHour3: safeNum(state.doorsPerHour3),
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
  return renderRoiPanel({
    els,
    state,
    res,
    weeks,
    deriveNeedVotes,
    getEffectiveBaseRates,
    computeCapacityBreakdown,
    safeNum,
    clamp,
    engine,
    computeAvgLiftPP,
    fmtInt
  });
}



function renderOptimization(res, weeks){
  return renderOptimizationPanel({
    els,
    state,
    res,
    weeks,
    deriveNeedVotes,
    getEffectiveBaseRates,
    computeCapacityBreakdown,
    safeNum,
    clamp,
    engine,
    fmtInt
  });
}

function renderTimeline(res, weeks){
  return renderTimelinePanel({ els, state, engine, safeNum, fmtInt, weeks });
}

function renderPhase3(res, weeks){
  return renderPhase3Panel({
    els,
    state,
    res,
    weeks,
    fmtInt,
    safeNum,
    clamp,
    getEffectiveBaseRates,
    computeCapacityContacts,
    deriveNeedVotes,
    renderMcFreshness,
    renderMcResults
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
  return renderMcResultsPanel({
    els,
    summary,
    fmtInt,
    fmtSigned,
    setTextPair,
    renderMcVisuals
  });
}

function renderMcVisuals(summary){
  return renderMcVisualsPanel({ els, summary, clamp, fmtSigned });
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
