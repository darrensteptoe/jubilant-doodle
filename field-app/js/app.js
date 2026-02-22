import { engine } from "/js/engine.js";
import { computeCapacityContacts as coreComputeCapacityContacts, computeCapacityBreakdown as coreComputeCapacityBreakdown } from "/js/core/model.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS } from "/js/core/universeLayer.js";
import { computeAvgLiftPP } from "/js/core/turnout.js";
import { fmtInt, clamp, safeNum, daysBetween, downloadJson, readJsonFile } from "/js/utils.js";
import { makeRng } from "/js/core/rng.js";
import { wireInput, wireSelect, wireCheckbox } from "/js/ui/wireInput.js";
import { getEls, wireUI } from "/js/ui/ui.js";
import { bindRender, setRenderState, renderAssumptionDriftE1, renderRiskFramingE2, renderBottleneckAttributionE3, renderSensitivitySnapshotE4, renderDecisionConfidenceE5, renderMcFreshness, renderOpsEnvelopeD2, renderFinishEnvelopeD3, renderMissRiskD4, renderDecisionSessionD1, renderDecisionOptionsD3, renderDecisionSummaryD4, renderMcResults, renderMcVisuals } from "/js/ui/render.js";
import { loadState, saveState, clearState, readBackups, writeBackupEntry } from "/js/storage.js";
import { createScenarioManager } from "/js/scenarioManager.js";
import { APP_VERSION, BUILD_ID } from "/js/build.js";
import { computeSnapshotHash } from "/js/hash.js";

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
  state.ui.dailyLog = merged;
  // daily log changes should mark plan/MC as stale
  markMcStale();
  render();
  persist();

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
  try{
    bindRender({
      state,
      els,
      helpers: {
        setUI,
        computeWeeklyOpsContext,
        computeDailyLogHash,
        hashMcInputs,
        formatMcTimestamp,
        hashOpsEnvelopeInputs,
        computeOpsEnvelopeD2,
        hashFinishEnvelopeInputs,
        computeFinishEnvelopeD3,
        hashMissRiskInputs,
        computeMissRiskD4,
        fmtISODate,
        deriveNeedVotes,
        getEffectiveBaseRates,
        optimizeTimelineConstrained,
        ensureScenarioRegistry,
        scenarioClone,
        scenarioInputsFromState,
        ensureDecisionScaffold,
        ensureDecisionSessionShape,
        listDecisionSessions,
        getActiveDecisionSession,
        listDecisionOptions,
        getActiveDecisionOption,
        decisionScenarioLabel: (sid) => decisionScenarioLabel(sid),
        decisionOptionDisplay,
        buildDecisionSummaryText,
        getLastRenderCtx: () => lastRenderCtx
      }
    });
  } catch {}
  persist();
  render();
  safeCall(() => { renderDecisionSessionD1(); });
}



const els = getEls();

// Phase 13 — DOM preflight (prevents silent boot failures)
function preflightEls(){
  try{
    const missing = [];
    for (const [k,v] of Object.entries(els)){
      if (v == null) missing.push(k);
    }
    if (missing.length){
      recordError("dom-preflight", `Missing bound element(s): ${missing.join(", ")}`);
    }
  } catch { /* ignore */ }
}


const DEFAULTS_BY_TEMPLATE = {
  federal: { bandWidth: 4, persuasionPct: 28, earlyVoteExp: 45 },
  state_leg: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 38 },
  municipal: { bandWidth: 5, persuasionPct: 35, earlyVoteExp: 35 },
  county: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 40 },
};

let state = loadState() || makeDefaultState();

let lastRenderCtx = null;


function cloneStateForUi(prev){
  const next = { ...prev };
  next.ui = { ...(prev && prev.ui ? prev.ui : {}) };
  return next;
}

function setState(patchFn, opts){
  const o = opts || {};
  const doPersist = (o.persist !== false);
  const doRender = (o.render !== false);
  const next = cloneStateForUi(state);
  patchFn(next);
  state = next;
  try{ setRenderState(state); } catch {}
  if (doPersist) persist();
  if (doRender) render();
}

function setUI(patchFn, opts){
  setState((s) => {
    if (!s.ui) s.ui = {};
    patchFn(s.ui, s);
  }, opts);
}


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
    doorsPerHour: 30,
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
  if (els.doorsPerHour) els.doorsPerHour.value = state.doorsPerHour ?? "";
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
  if (els.doorsPerHour3) els.doorsPerHour3.value = state.doorsPerHour3 ?? "";
  if (els.callsPerHour3) els.callsPerHour3.value = state.callsPerHour3 ?? "";
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.value = state.turnoutReliabilityPct ?? "";

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
  return out;
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
  const adj = engine.computeUniverseAdjustedRates({
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

function persist(){
  saveState(state);
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

  els.kpiTurnoutVotes.textContent = res.expected.turnoutVotes == null ? "—" : fmtInt(res.expected.turnoutVotes);
  els.kpiTurnoutBand.textContent = res.turnout.bandVotesText || "—";

  els.kpiWinThreshold.textContent = res.expected.winThreshold == null ? "—" : fmtInt(res.expected.winThreshold);
  els.kpiYourVotes.textContent = res.expected.yourVotes == null ? "—" : fmtInt(res.expected.yourVotes);
  els.kpiYourVotesShare.textContent = res.expected.yourShareText || "—";

  els.kpiPersuasionNeed.textContent = res.expected.persuasionNeed == null ? "—" : fmtInt(res.expected.persuasionNeed);
  els.kpiPersuasionStatus.textContent = res.expected.persuasionStatus || "—";

  els.miniEarlyVotes.textContent = res.expected.earlyVotes == null ? "—" : fmtInt(res.expected.earlyVotes);
  els.miniEDVotes.textContent = res.expected.edVotes == null ? "—" : fmtInt(res.expected.edVotes);
  els.miniEarlyNote.textContent = res.expected.earlyNote || "—";

  els.miniPersUniverse.textContent = res.expected.persuasionUniverse == null ? "—" : fmtInt(res.expected.persuasionUniverse);
  els.miniPersCheck.textContent = res.expected.persuasionUniverseCheck || "—";

  safeCall(() => renderStress(res));
  safeCall(() => renderValidation(res, weeks));
  safeCall(() => renderAssumptions(res, weeks));
  safeCall(() => renderGuardrails(res));
  safeCall(() => renderConversion(res, weeks));
  safeCall(() => renderWeeklyOps(res, weeks));
  safeCall(() => renderWeeklyOpsInsights(res, weeks));
  safeCall(() => renderWeeklyOpsFreshness(res, weeks));
  safeCall(() => renderAssumptionDriftE1(res, weeks));
  safeCall(() => renderRiskFramingE2());
  safeCall(() => renderBottleneckAttributionE3(res, weeks));
  safeCall(() => renderSensitivitySnapshotE4());
  safeCall(() => renderDecisionConfidenceE5(res, weeks));

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

  if (els.snapshotHash) els.snapshotHash.textContent = lastResultsSnapshot?.snapshotHash || "—";
  if (els.importHashBanner && els.importHashBanner.hidden === false){ /* keep until next import clears */ }
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

  const eff = getEffectiveBaseRates();
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

  const orgCount = safeNum(state.orgCount);
  const orgHoursPerWeek = safeNum(state.orgHoursPerWeek);
  const volunteerMult = safeNum(state.volunteerMultBase);
  const doorSharePct = safeNum(state.channelDoorPct);
  const doorsPerHour = safeNum(state.doorsPerHour3);
  const callsPerHour = safeNum(state.callsPerHour3);

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
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour
  };
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







function renderWeeklyOpsInsights(res, weeks){
  if (!els.wkLeversIntro || !els.wkActionsList || !els.wkBestMovesList || !els.wkLeversTbody) return;

  const ctx = computeWeeklyOpsContext(res, weeks);
  const fmtCeil = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtNum1 = (v) => (v == null || !isFinite(v)) ? "—" : (Number(v).toFixed(1));

  els.wkBestMovesList.innerHTML = "";
  els.wkActionsList.innerHTML = "";
  els.wkLeversTbody.innerHTML = "";

  syncWeeklyUndoUI();

  if (els.wkLeversFoot) els.wkLeversFoot.hidden = false;
  if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = false;

  if (ctx.goal <= 0){
    els.wkLeversIntro.textContent = "No operational gap to analyze (goal is 0 under current inputs).";
    addBullet(els.wkActionsList, "Set a goal (Support IDs needed) or adjust win path assumptions to generate a real plan.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }
  if (ctx.weeks == null || ctx.weeks <= 0){
    els.wkLeversIntro.textContent = "Timeline is missing. Set election date or weeks remaining to compute weekly pressure.";
    addBullet(els.wkActionsList, "Enter an election date (or weeks remaining) so the plan can compute per-week targets.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }
  if (ctx.sr == null || ctx.sr <= 0 || ctx.cr == null || ctx.cr <= 0){
    els.wkLeversIntro.textContent = "Rates are missing. Enter Support rate and Contact rate to estimate workload.";
    addBullet(els.wkActionsList, "Fill Support rate (%) and Contact rate (%) in Phase 2.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }
  if (ctx.capTotal == null || !isFinite(ctx.capTotal)){
    els.wkLeversIntro.textContent = "Capacity inputs are incomplete. Fill Phase 3 execution inputs to compute what is executable.";
    addBullet(els.wkActionsList, "Enter organizers, hours/week, doors/hr, calls/hr, and channel split in Phase 3.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }

  const baseReq = ctx.attemptsPerWeek;
  const baseCap = ctx.capTotal;
  const gap = (baseReq != null && baseCap != null) ? Math.max(0, baseReq - baseCap) : null;
  const isGap = (gap != null && gap > 0);

  els.wkLeversIntro.textContent = isGap
    ? `You are short by ~${fmtCeil(gap)} attempts/week. These levers estimate attempts/week relief in consistent units.`
    : "You are currently feasible (capacity covers attempts/week). These levers estimate buffer gained per unit.";

  const capTotal = (p) => {
    const out = coreComputeCapacityBreakdown(p);
    return out?.total;
  };

  const levers = [];

  const push = (x) => {
    if (!x) return;
    if (x.impact == null || !isFinite(x.impact) || x.impact <= 0) return;
    const impactUse = isGap ? Math.min(x.impact, gap) : x.impact;
    const eff = (x.costScalar != null && isFinite(x.costScalar) && x.costScalar > 0) ? (impactUse / x.costScalar) : null;
    levers.push({ ...x, impactUse, eff });
  };

  const baseCapParams = {
    weeks: 1,
    orgCount: ctx.orgCount,
    orgHoursPerWeek: ctx.orgHoursPerWeek,
    volunteerMult: ctx.volunteerMult,
    doorShare: ctx.doorShare,
    doorsPerHour: ctx.doorsPerHour,
    callsPerHour: ctx.callsPerHour
  };

  if (ctx.orgCount != null && ctx.orgHoursPerWeek != null && ctx.volunteerMult != null){
    const plusOrg = capTotal({ ...baseCapParams, orgCount: ctx.orgCount + 1 });
    if (plusOrg != null && baseCap != null) push({
      kind: "capacity",
      key: "org",
      label: "+1 organizer",
      impact: plusOrg - baseCap,
      costLabel: "1 organizer",
      costScalar: 1,
      effUnit: "per organizer"
    });

    const plusHr = capTotal({ ...baseCapParams, orgHoursPerWeek: ctx.orgHoursPerWeek + 1 });
    if (plusHr != null && baseCap != null){
      const addedHours = Math.max(1, ctx.orgCount || 1);
      push({
        kind: "capacity",
        key: "orgHr",
        label: "+1 hour/week per organizer",
        impact: plusHr - baseCap,
        costLabel: `+1 hr/org (= ${fmtCeil(addedHours)} org-hrs/wk)`,
        costScalar: addedHours,
        effUnit: "per org-hour"
      });
    }

    const plusVol = capTotal({ ...baseCapParams, volunteerMult: ctx.volunteerMult + 0.10 });
    if (plusVol != null && baseCap != null) push({
      kind: "capacity",
      key: "volMult",
      label: "+10% volunteer multiplier",
      impact: plusVol - baseCap,
      costLabel: "+10% volunteer mult",
      costScalar: 0.10,
      effUnit: "per +10% mult"
    });
  }

  if (ctx.doorsPerHour != null){
    const plusDoorHr = capTotal({ ...baseCapParams, doorsPerHour: ctx.doorsPerHour + 1 });
    if (plusDoorHr != null && baseCap != null) push({
      kind: "capacity",
      key: "dph",
      label: "+1 door/hr",
      impact: plusDoorHr - baseCap,
      costLabel: "+1 door/hr",
      costScalar: 1,
      effUnit: "per +1 door/hr"
    });
  }

  if (ctx.callsPerHour != null){
    const plusCallHr = capTotal({ ...baseCapParams, callsPerHour: ctx.callsPerHour + 1 });
    if (plusCallHr != null && baseCap != null) push({
      kind: "capacity",
      key: "cph",
      label: "+1 call/hr",
      impact: plusCallHr - baseCap,
      costLabel: "+1 call/hr",
      costScalar: 1,
      effUnit: "per +1 call/hr"
    });
  }

  if (ctx.doorShare != null && ctx.doorsPerHour != null && ctx.callsPerHour != null){
    const doorIsFaster = ctx.doorsPerHour >= ctx.callsPerHour;
    const shift = 0.10;
    const newShare = clamp(ctx.doorShare + (doorIsFaster ? shift : -shift), 0, 1);
    const capShift = capTotal({ ...baseCapParams, doorShare: newShare });
    if (capShift != null && baseCap != null) push({
      kind: "capacity",
      key: "mix",
      label: `Shift mix +10 pts toward ${doorIsFaster ? "doors" : "calls"}`,
      impact: capShift - baseCap,
      costLabel: "10 pts mix shift",
      costScalar: 10,
      effUnit: "per 1 pt"
    });
  }

  const pp = 0.01;
  if (baseReq != null && isFinite(baseReq)){
    const srPlus = Math.min(0.99, ctx.sr + pp);
    const crPlus = Math.min(0.99, ctx.cr + pp);

    const reqSrPlus = (ctx.goal > 0 && srPlus > 0 && ctx.cr > 0 && ctx.weeks > 0) ? (ctx.goal / srPlus / ctx.cr / ctx.weeks) : null;
    if (reqSrPlus != null) push({
      kind: "rates",
      key: "sr",
      label: "+1 pp support rate",
      impact: baseReq - reqSrPlus,
      costLabel: "+1 pp SR",
      costScalar: 1,
      effUnit: "per +1pp"
    });

    const reqCrPlus = (ctx.goal > 0 && crPlus > 0 && ctx.sr > 0 && ctx.weeks > 0) ? (ctx.goal / ctx.sr / crPlus / ctx.weeks) : null;
    if (reqCrPlus != null) push({
      kind: "rates",
      key: "cr",
      label: "+1 pp contact rate",
      impact: baseReq - reqCrPlus,
      costLabel: "+1 pp CR",
      costScalar: 1,
      effUnit: "per +1pp"
    });

    const wPlus = ctx.weeks + 1;
    const reqWPlus = (ctx.goal > 0 && ctx.sr > 0 && ctx.cr > 0 && wPlus > 0) ? (ctx.goal / ctx.sr / ctx.cr / wPlus) : null;
    if (reqWPlus != null) push({
      kind: "timeline",
      key: "weeks",
      label: "+1 week timeline",
      impact: baseReq - reqWPlus,
      costLabel: "+1 week",
      costScalar: 1,
      effUnit: "per week"
    });
  }

  const usable = levers
    .filter(x => x.impactUse != null && isFinite(x.impactUse) && x.impactUse > 0)
    .sort((a,b) => (b.impactUse - a.impactUse));

  if (usable.length === 0){
    addBullet(els.wkActionsList, "No lever estimates available under current inputs.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    return;
  }

  const bestByEff = [...usable]
    .filter(x => x.eff != null && isFinite(x.eff))
    .sort((a,b) => (b.eff - a.eff) || (b.impactUse - a.impactUse))
    .slice(0, 3);

  for (const l of bestByEff){
    const li = document.createElement("li");
    li.className = "actionItem";
    const span = document.createElement("span");
    span.textContent = `${l.label}: ~${fmtCeil(l.impactUse)} attempts/week (${fmtNum1(l.eff)} ${l.effUnit})`;
    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.type = "button";
    btn.textContent = "Apply";
    btn.addEventListener("click", () => { safeCall(() => { applyWeeklyLeverScenario(l, ctx); }); });
    li.appendChild(span);
    li.appendChild(btn);
    els.wkBestMovesList.appendChild(li);
  }

  const rows = usable.slice(0, 10);
  for (const l of rows){
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    const td3 = document.createElement("td");
    const td4 = document.createElement("td");
    const td5 = document.createElement("td");
    td2.className = "num";
    td4.className = "num";
    td1.textContent = l.label;
    td2.textContent = `~${fmtCeil(l.impactUse)}`;
    td3.textContent = l.costLabel || "—";
    td4.textContent = (l.eff == null || !isFinite(l.eff)) ? "—" : `${fmtNum1(l.eff)}`;

    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.type = "button";
    btn.textContent = "Apply";
    btn.addEventListener("click", () => { safeCall(() => { applyWeeklyLeverScenario(l, ctx); }); });
    td5.appendChild(btn);

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    els.wkLeversTbody.appendChild(tr);
  }

  const bestCap = usable.filter(x => x.kind === "capacity").sort((a,b) => (b.impactUse - a.impactUse))[0] || null;
  const bestRate = usable.filter(x => x.kind === "rates").sort((a,b) => (b.impactUse - a.impactUse))[0] || null;
  const bestCr = usable.find(x => x.kind === "rates" && x.key === "cr") || null;
  const bestSr = usable.find(x => x.kind === "rates" && x.key === "sr") || null;

  const drift = computeRealityDrift();
  const hasDrift = drift?.hasLog && drift?.flags?.length;
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
      if (actions.length === 0 && bestRate) actions.push(`You are feasible, but assumptions are drifting. Consider ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week).`);
      actions.push("Use buffer to absorb volatility, and align assumptions to observed daily log so planning stays honest.");
    } else {
      if (bestCap) actions.push(`Build buffer: ${bestCap.label} adds ≈ ${fmtCeil(bestCap.impactUse)} attempts/week of slack.`);
      if (bestRate) actions.push(`Improve efficiency: ${bestRate.label} reduces required attempts by ≈ ${fmtCeil(bestRate.impactUse)} attempts/week.`);
      actions.push("Use the buffer to absorb volatility (bad weeks, weather, volunteer drop-off) or to front-load early vote chasing.");
    }
  }
  for (const a of actions.slice(0, 4)) addBullet(els.wkActionsList, a);
}

function renderWeeklyOpsFreshness(res, weeks){
  if (!els.wkLastUpdate || !els.wkFreshStatus) return;

  const fInt = (v) => (v == null || !isFinite(v)) ? "—" : (String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  const fPct = (v) => (v == null || !isFinite(v)) ? "—" : ((v * 100).toFixed(1) + "%");
  const fNum1 = (v) => (v == null || !isFinite(v)) ? "—" : (Number(v).toFixed(1));

  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  if (!log || log.length === 0){
    els.wkLastUpdate.textContent = "—";
    if (els.wkFreshNote) els.wkFreshNote.textContent = "No daily log configured yet";
    if (els.wkRollingAttempts) els.wkRollingAttempts.textContent = "—";
    if (els.wkRollingNote) els.wkRollingNote.textContent = "Add entries in organizer.html to activate reality checks";
    if (els.wkRollingCR) els.wkRollingCR.textContent = "—";
    if (els.wkRollingCRNote) els.wkRollingCRNote.textContent = "—";
    if (els.wkRollingSR) els.wkRollingSR.textContent = "—";
    if (els.wkRollingSRNote) els.wkRollingSRNote.textContent = "—";
    if (els.wkRollingAPH) els.wkRollingAPH.textContent = "—";
    if (els.wkRollingAPHNote) els.wkRollingAPHNote.textContent = "—";
    els.wkFreshStatus.textContent = "Not tracking";
    return;
  }

  const sorted = [...log].filter(x => x && x.date).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const last = sorted[sorted.length - 1];
  els.wkLastUpdate.textContent = last?.date || "—";
  if (els.wkFreshNote) els.wkFreshNote.textContent = "Using state.ui.dailyLog";

  // Rolling window: last 7 entries (not strictly calendar days)
  const windowN = 7;
  const lastN = sorted.slice(-windowN);

  let sumAttempts = 0, sumDoors = 0, sumCalls = 0, sumConvos = 0, sumSupportIds = 0, sumOrgHours = 0;
  for (const x of lastN){
    const doors = safeNum(x?.doors) || 0;
    const calls = safeNum(x?.calls) || 0;
    const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
    const convos = safeNum(x?.convos) || 0;
    const sup = safeNum(x?.supportIds) || 0;
    const hrs = safeNum(x?.orgHours) || 0;

    sumDoors += doors;
    sumCalls += calls;
    sumAttempts += attempts;
    sumConvos += convos;
    sumSupportIds += sup;
    sumOrgHours += hrs;
  }

  if (els.wkRollingAttempts) els.wkRollingAttempts.textContent = fInt(sumAttempts);

  const actualCR = (sumAttempts > 0) ? (sumConvos / sumAttempts) : null;
  const actualSR = (sumConvos > 0) ? (sumSupportIds / sumConvos) : null;
  const actualAPH = (sumOrgHours > 0) ? (sumAttempts / sumOrgHours) : null;

  if (els.wkRollingCR) els.wkRollingCR.textContent = fPct(actualCR);
  if (els.wkRollingSR) els.wkRollingSR.textContent = fPct(actualSR);
  if (els.wkRollingAPH) els.wkRollingAPH.textContent = fNum1(actualAPH);

  // Compare to assumptions
  const assumedCR = (state.contactRatePct != null && state.contactRatePct !== "") ? ((safeNum(state.contactRatePct) || 0) / 100) : null;
  const assumedSR = (state.supportRatePct != null && state.supportRatePct !== "") ? ((safeNum(state.supportRatePct) || 0) / 100) : null;

  const mixDoor = (state.channelDoorPct != null && state.channelDoorPct !== "") ? ((safeNum(state.channelDoorPct) || 0) / 100) : null;
  const doorsHr = (state.doorsPerHour3 != null && state.doorsPerHour3 !== "") ? (safeNum(state.doorsPerHour3) || 0) : null;
  const callsHr = (state.callsPerHour3 != null && state.callsPerHour3 !== "") ? (safeNum(state.callsPerHour3) || 0) : null;
  const expectedAPH = (mixDoor != null && doorsHr != null && callsHr != null)
    ? (mixDoor * doorsHr + (1 - mixDoor) * callsHr)
    : null;

  if (els.wkRollingCRNote){
    if (assumedCR == null) els.wkRollingCRNote.textContent = "Assumed: —";
    else els.wkRollingCRNote.textContent = `Assumed: ${fPct(assumedCR)}`;
  }
  if (els.wkRollingSRNote){
    if (assumedSR == null) els.wkRollingSRNote.textContent = "Assumed: —";
    else els.wkRollingSRNote.textContent = `Assumed: ${fPct(assumedSR)}`;
  }
  if (els.wkRollingAPHNote){
    if (expectedAPH == null) els.wkRollingAPHNote.textContent = "Expected: —";
    else els.wkRollingAPHNote.textContent = `Expected: ${fNum1(expectedAPH)} / hr`;
  }

  const ctx = computeWeeklyOpsContext(res, weeks);
  const req = ctx.attemptsPerWeek;
  if (els.wkRollingNote){
    if (req == null || !isFinite(req)) els.wkRollingNote.textContent = "Required attempts/week unavailable under current inputs";
    else els.wkRollingNote.textContent = `Required ≈ ${fInt(Math.ceil(req))} attempts/week`;
  }

  // Pace (last N entries represent roughly a week if you enter daily; treat as a comparable window)
  let ratio = null;
  if (req != null && isFinite(req) && req > 0) ratio = sumAttempts / req;

  const flags = [];
  const tol = 0.90; // 10% below assumed => flag
  if (assumedCR != null && actualCR != null && isFinite(actualCR) && actualCR < assumedCR * tol) flags.push("contact rate below assumed");
  if (assumedSR != null && actualSR != null && isFinite(actualSR) && actualSR < assumedSR * tol) flags.push("support rate below assumed");
  if (expectedAPH != null && actualAPH != null && isFinite(actualAPH) && actualAPH < expectedAPH * tol) flags.push("productivity below assumed");

  // Status label
  if (ratio == null || !isFinite(ratio)){
    els.wkFreshStatus.textContent = flags.length ? "Assumptions drifting" : "Needs inputs";
    return;
  }

  if (ratio >= 1.0 && flags.length === 0) els.wkFreshStatus.textContent = "On pace";
  else if (ratio >= 1.0 && flags.length) els.wkFreshStatus.textContent = "On pace (assumptions off)";
  else if (ratio >= 0.85 && flags.length === 0) els.wkFreshStatus.textContent = "Slightly behind";
  else if (ratio >= 0.85 && flags.length) els.wkFreshStatus.textContent = "Behind (rates/capacity off)";
  else if (flags.length) els.wkFreshStatus.textContent = "Behind";
  else els.wkFreshStatus.textContent = "Behind";

  // If there are flags, append a short hint into the freshness note
  if (flags.length && els.wkFreshNote){
    els.wkFreshNote.textContent = `Reality check: ${flags.join(", ")}`;
  }
}


function addBullet(listEl, text){
  if (!listEl) return;
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}


function renderConversion(res, weeks){
  // If Phase 2 panel isn't present, fail silently.
  if (!els.outConversationsNeeded) return;

  const rawGoal = safeNum(state.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

  const eff = getEffectiveBaseRates();
  const sr = eff.sr;
  const cr = eff.cr;

  const dph = safeNum(state.doorsPerHour);
  const hps = safeNum(state.hoursPerShift);
  const spv = safeNum(state.shiftsPerVolunteerPerWeek);

  const doorsPerShift = (dph != null && hps != null) ? dph * hps : null;

  const convosNeeded = (sr && sr > 0) ? goal / sr : null;
  const doorsNeeded = (convosNeeded != null && cr && cr > 0) ? convosNeeded / cr : null;

  const totalShifts = (doorsNeeded != null && doorsPerShift && doorsPerShift > 0) ? doorsNeeded / doorsPerShift : null;
  const shiftsPerWeek = (totalShifts != null && weeks && weeks > 0) ? totalShifts / weeks : null;
  const volsNeeded = (shiftsPerWeek != null && spv && spv > 0) ? shiftsPerWeek / spv : null;

  // Conservative rounding (ceil) for planning.
  const fmtMaybe = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  els.outConversationsNeeded.textContent = fmtMaybe(convosNeeded);
  els.outDoorsNeeded.textContent = fmtMaybe(doorsNeeded);
  els.outDoorsPerShift.textContent = (doorsPerShift == null || !isFinite(doorsPerShift)) ? "—" : fmtInt(Math.round(doorsPerShift));
  els.outTotalShifts.textContent = fmtMaybe(totalShifts);
  els.outShiftsPerWeek.textContent = fmtMaybe(shiftsPerWeek);
  els.outVolunteersNeeded.textContent = fmtMaybe(volsNeeded);

  // Feasibility banner
  if (!els.convFeasBanner) return;

  let msg = "";
  let cls = "";
  let show = true;

  if (goal <= 0){
    msg = "Capacity check: Under current assumptions, no additional support IDs are required (goal = 0).";
    cls = "ok";
  } else if (weeks == null || weeks <= 0){
    msg = "Capacity check: Set an election date (or weeks remaining) to compute per-week requirements.";
    cls = "warn";
  } else if (sr == null || sr <= 0 || cr == null || cr <= 0 || doorsPerShift == null || doorsPerShift <= 0){
    msg = "Capacity check: Enter Support rate, Contact rate, Doors/hour, and Hours/shift to compute workload.";
    cls = "warn";
  } else if (volsNeeded == null || !isFinite(volsNeeded)){
    msg = "Capacity check: Enter Shifts per volunteer/week to estimate active volunteer requirement.";
    cls = "warn";
  } else {
    const v = Math.ceil(volsNeeded);
    if (v <= 25){
      msg = `Capacity check: Looks feasible (≈ ${fmtInt(v)} active volunteers at your stated cadence).`;
      cls = "ok";
    } else if (v <= 60){
      msg = `Capacity check: Ambitious (≈ ${fmtInt(v)} active volunteers). Consider higher efficiency, longer shifts, or supplementing with paid/phones/texts.`;
      cls = "warn";
    } else {
      msg = `Capacity check: High risk (≈ ${fmtInt(v)} active volunteers). You likely need multi-channel + paid volume, or revise assumptions.`;
      cls = "bad";
    }
  }

  els.convFeasBanner.hidden = !show;
  els.convFeasBanner.className = `banner ${cls}`.trim();
  els.convFeasBanner.textContent = msg;
  renderPhase3(res, weeks);
}




async function runSensitivitySnapshotE4(){
  if (!els.sensTag || !els.sensTbody || !els.sensBanner || !els.btnSensRun) return;

  const base = state.mcLast;
  if (!base) return;

  const ctx = lastRenderCtx;
  if (!ctx || !ctx.res) return;

  const weeks = (ctx.weeks != null && ctx.weeks >= 0) ? ctx.weeks : null;
  const needVotes = (ctx.needVotes != null && ctx.needVotes >= 0) ? ctx.needVotes : null;
  const seed = state.mcSeed || "";

  const baseP = clamp(Number(base.winProb ?? 0), 0, 1);
  const baseP50 = (base.confidenceEnvelope?.percentiles?.p50 != null) ? Number(base.confidenceEnvelope.percentiles.p50)
    : (base.median != null ? Number(base.median) : null);

  const runs = 2000;

  const fmtWinDelta = (p) => {
    if (p == null || !isFinite(p)) return "—";
    const d = (p - baseP) * 100;
    const s = d > 0 ? "+" : "";
    return `${s}${d.toFixed(1)} pts`;
  };

  const fmtMarginDelta = (m) => {
    if (m == null || !isFinite(m) || baseP50 == null || !isFinite(baseP50)) return "—";
    const d = m - baseP50;
    const s = d > 0 ? "+" : "";
    return `${s}${d.toFixed(1)}`;
  };

  const simWin = (sim) => (sim && sim.winProb != null) ? clamp(Number(sim.winProb), 0, 1) : null;
  const simP50 = (sim) => {
    if (!sim) return null;
    const p50 = sim.confidenceEnvelope?.percentiles?.p50;
    if (p50 != null && isFinite(p50)) return Number(p50);
    const m = sim.median;
    if (m != null && isFinite(m)) return Number(m);
    return null;
  };

  const setBusy = (on) => {
    els.btnSensRun.disabled = !!on;
    els.btnSensRun.textContent = on ? "Running…" : "Run snapshot";
  };

  const mk = (label, nextState, note) => ({ label, nextState, note });

  const bump = (v, f, lo, hi) => {
    const n = Number(v);
    if (!isFinite(n)) return v;
    const x = n * f;
    if (lo != null || hi != null){
      const a = (lo == null) ? x : Math.max(lo, x);
      return (hi == null) ? a : Math.min(hi, a);
    }
    return x;
  };

  const s1 = structuredClone(state);
  s1.doorsPerHour3 = bump(s1.doorsPerHour3, 1.10, 0.01, null);

  const s2 = structuredClone(state);
  s2.callsPerHour3 = bump(s2.callsPerHour3, 1.10, 0.01, null);

  const s3 = structuredClone(state);
  s3.volunteerMultBase = bump(s3.volunteerMultBase, 1.10, 0.01, 10);

  const s4 = structuredClone(state);
  if (s4.gotvMode === "advanced"){
    const v = Number(s4.gotvLiftMode);
    s4.gotvLiftMode = (isFinite(v) ? v : 0) + 5;
  } else {
    const v = Number(s4.gotvLiftPP);
    s4.gotvLiftPP = (isFinite(v) ? v : 0) + 5;
  }

  const jobs = [
    mk("+10% doors", s1, "Doors/hr × 1.10"),
    mk("+10% phones", s2, "Calls/hr × 1.10"),
    mk("+10% volunteers", s3, "Volunteer multiplier × 1.10"),
    mk("+5pp turnout lift", s4, "GOTV lift + 5pp"),
  ];

  setBusy(true);
  try{
    const rows = [];
    for (const j of jobs){
      const sim = runMonteCarloSim({ scenario: j.nextState, res: ctx.res, weeks, needVotes, runs, seed });
      const p = simWin(sim);
      const m = simP50(sim);
      rows.push({
        label: j.label,
        dWin: fmtWinDelta(p),
        dP50: fmtMarginDelta(m),
        note: j.note,
      });
    }

    const best = rows.reduce((a,r) => {
      const m = parseFloat(String(r.dWin||"").replace(/[^0-9\-\.]+/g, ""));
      if (!isFinite(m)) return a;
      const abs = Math.abs(m);
      if (!a || abs > a.abs) return { abs, r };
      return a;
    }, null);

    const banner = best ? `Biggest movement in win probability: ${best.r.label} (${best.r.dWin}).` : "Snapshot complete.";
    const cls = best && best.abs >= 5 ? "warn" : "ok";

    if (!state.ui) state.ui = {};
    state.ui.e4Sensitivity = {
      baseHash: state.mcLastHash,
      computedAt: Date.now(),
      rows,
      banner,
      tag: "Mini surface",
      cls,
    };
    persist();
    renderSensitivitySnapshotE4();
  } finally {
    setBusy(false);
  }
}




function renderDecisionIntelligencePanel({ res, weeks }){
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
      compute: engine.compute,
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




function renderScenarioComparePanel({ res, weeks }){
  if (!els.scCompareTbody) return;

  const showWarn = (msg) => {
    if (!els.scWarn) return;
    if (msg){
      els.scWarn.hidden = false;
      els.scWarn.textContent = msg;
    } else {
      els.scWarn.hidden = true;
      els.scWarn.textContent = "";
    }
  };

  try{
    const cmp = scenarioMgr.compare();
    const rows = cmp.rows || [];
    const hi = cmp.highlights || {};

    if (!rows.length){
      els.scCompareTbody.innerHTML = '<tr><td colspan="7" class="muted">No scenarios saved yet.</td></tr>';
      if (els.scOverall) els.scOverall.textContent = 'Most efficient scenario overall: —';
      showWarn(null);
      return;
    }

    const fmtMaybeInt = (v) => (v == null || !isFinite(v)) ? "—" : String(Math.ceil(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fmtMoney = (v) => (v == null || !isFinite(v)) ? "—" : ('$' + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    const fmtPct = (v) => (v == null || !isFinite(v)) ? "—" : ((v * 100).toFixed(1) + "%");

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const makeBtn = (id) => `<button class="btn btn-sm btn-ghost" type="button" data-sc-del="${esc(id)}">Delete</button>`;
    const makeInput = (id, label) => `<input class="input input-sm input-inline" type="text" value="${esc(label)}" data-sc-label="${esc(id)}" />`;

    const tr = rows.map(r => {
      const bestVol = (hi.bestVol && r.id === hi.bestVol);
      const bestCost = (hi.bestCost && r.id === hi.bestCost);
      const bestWin = (hi.bestWin && r.id === hi.bestWin);

      return `<tr data-sc-row="${esc(r.id)}">
        <td>${esc(r.label)}</td>
        <td>${makeInput(r.id, r.label)}</td>
        <td class="${bestVol ? 'cell-best' : ''}">${fmtMaybeInt(r.volunteers)}</td>
        <td class="${bestCost ? 'cell-best' : ''}">${fmtMoney(r.cost)}</td>
        <td class="${bestWin ? 'cell-best' : ''}">${fmtPct(r.winProb)}</td>
        <td>${esc(r.primaryBottleneck || '—')}</td>
        <td class="sc-row-actions">${makeBtn(r.id)}</td>
      </tr>`;
    }).join("");

    els.scCompareTbody.innerHTML = tr;

    // Overall winner summary
    const overallId = cmp.overall;
    const overallRow = rows.find(r => r.id === overallId);
    if (els.scOverall){
      els.scOverall.textContent = `Most efficient scenario overall: ${overallRow ? overallRow.label : "—"}`;
    }

    showWarn(null);
  } catch {
    showWarn("Scenario compare unavailable (analysis error).");
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
  if (!els.validationList) return;
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

  els.validationList.innerHTML = "";
  for (const it of items){
    const li = document.createElement("li");
    li.className = it.kind;
    li.textContent = it.text;
    els.validationList.appendChild(li);
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
      compute: engineFacade.compute,
      derivedWeeksRemaining,
      deriveNeedVotes,
      runMonteCarloSim,
      computeMaxAttemptsByTactic: engineFacade.timeline.computeMaxAttemptsByTactic,
      computeTimelineFeasibility: engineFacade.timeline.computeTimelineFeasibility,
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

const SCENARIO_BASELINE_ID = "baseline";
const SCENARIO_MAX = 20;

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
  const adj = engine.computeUniverseAdjustedRates({
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

const DECISION_TACTICS = [
  { key: "doors", label: "Doors" },
  { key: "phones", label: "Phones" },
  { key: "digital", label: "Digital" },
];

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

  if (els.decisionNotes){
    wireInput(els.decisionNotes, {
      event: "input",
      get: (x) => String(x.value || ""),
      set: (v) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        s.notes = String(v || "");
        persist();
      }
    });
  }

  if (els.decisionObjective){
    wireSelect(els.decisionObjective, {
      set: (v) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        s.objectiveKey = String(v || "");
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.decisionBudget){
    wireInput(els.decisionBudget, {
      event: "input",
      get: (x) => String(x.value || "").trim(),
      parse: (raw) => {
        const n = Number(raw);
        return raw === "" || !Number.isFinite(n) ? null : n;
      },
      set: (v) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        ensureDecisionSessionShape(s);
        s.constraints.budget = v;
        persist();
      }
    });
  }

  if (els.decisionVolunteerHrs){
    wireInput(els.decisionVolunteerHrs, {
      event: "input",
      get: (x) => String(x.value || "").trim(),
      parse: (raw) => {
        const n = Number(raw);
        return raw === "" || !Number.isFinite(n) ? null : n;
      },
      set: (v) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        ensureDecisionSessionShape(s);
        s.constraints.volunteerHrs = v;
        persist();
      }
    });
  }

  if (els.decisionTurfAccess){
    wireSelect(els.decisionTurfAccess, {
      set: (v) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        ensureDecisionSessionShape(s);
        s.constraints.turfAccess = String(v || "");
        persist();
      }
    });
  }

  if (els.decisionBlackoutDates){
    wireInput(els.decisionBlackoutDates, {
      event: "input",
      get: (x) => String(x.value || ""),
      set: (v) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        ensureDecisionSessionShape(s);
        s.constraints.blackoutDates = String(v || "");
        persist();
      }
    });
  }

  if (els.decisionRiskPosture){
    wireSelect(els.decisionRiskPosture, {
      set: (v) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        ensureDecisionSessionShape(s);
        s.riskPosture = String(v || "balanced");
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.decisionNonNegotiables){
    wireInput(els.decisionNonNegotiables, {
      event: "input",
      get: (x) => String(x.value || ""),
      parse: (raw) => String(raw || "")
        .split(/\r?\n|,/)
        .map(x => String(x || "").trim())
        .filter(Boolean),
      set: (arr) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        ensureDecisionSessionShape(s);
        s.nonNegotiables = Array.isArray(arr) ? arr : [];
        persist();
      }
    });
  }

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
    wireInput(els.decisionWhatTrue, {
      event: "input",
      get: (x) => String(x.value || ""),
      parse: (raw) => String(raw || "")
        .split(/\r?\n/)
        .map(x => String(x || "").trim())
        .filter(Boolean),
      set: (arr) => {
        const s = getActiveDecisionSession();
        if (!s) return;
        ensureDecisionSessionShape(s);
        s.whatNeedsTrue = Array.isArray(arr) ? arr : [];
        persist();
        renderDecisionSummaryD4(s);
      }
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

      const engine = { withPatchedState, runMonteCarloSim };

      const result = engine.computeSensitivitySurface({
        engine,
        baseline: { res, weeks, needVotes },
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

function init(){
  installGlobalErrorCapture();
  preflightEls();
  ensureScenarioRegistry();
  ensureDecisionScaffold();
  wireScenarioManagerC1();
  wireDecisionSessionD1();
  updateBuildStamp();
  updateSelfTestGateBadge();
  refreshBackupDropdown();

  applyStateToUI();
  rebuildCandidateTable();
  initTabs();
  initExplainCard();
  wireUI(els, {
    state,
    setState,
    setUI,
    persist,
    render,
    markMcStale,
    safeCall,
    refreshBackupDropdown,
    restoreBackupByIndex,
    openDiagnostics,
    closeDiagnostics,
    copyDebugBundle,
    exportDailyLog,
    mergeDailyLogIntoState,
    applyRollingRateToAssumption,
    undoLastWeeklyAction,
    applyStateToUI,
    applyThemeFromState,
    initThemeSystemListener,
    DEFAULTS_BY_TEMPLATE,
    uid,
    rebuildCandidateTable,
    rebuildUserSplitInputs,
    rebuildYourCandidateSelect,
    syncGotvModeUI,
    syncMcModeUI,
    runMonteCarloNow,
    safeNum,
    fmtInt,
    clamp,
    downloadText,
  });
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
    els.mcStale.hidden = false;
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
  els.mcStale.hidden = true;
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
    doorsPerHour: (safeNum(state.doorsPerHour3) ?? safeNum(state.doorsPerHour)),
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

  const eff = getEffectiveBaseRates();
  const cr = eff.cr;
  const sr = eff.sr;
  const tr = eff.tr;

  // Phase 3 capacity ceiling (attempts)
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
    doorsPerHour: (safeNum(state.doorsPerHour3) ?? safeNum(state.doorsPerHour)),
    callsPerHour: safeNum(state.callsPerHour3),
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
    if (els.tlOptBinding) els.tlOptBinding.textContent = meta.bindingConstraints || "—";

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
  const eff = getEffectiveBaseRates();
  const cr = eff.cr;
  const pr = eff.sr;
  const rr = eff.tr;

  // Capacity inputs
  const orgCount = safeNum(state.orgCount);
  const orgHrs = safeNum(state.orgHoursPerWeek);
  const volMult = safeNum(state.volunteerMultBase);
  const doorSharePct = safeNum(state.channelDoorPct);
  const doorShare = (doorSharePct != null) ? clamp(doorSharePct, 0, 100) / 100 : null;

  const dph = safeNum(state.doorsPerHour3) ?? safeNum(state.doorsPerHour);
  const cph = safeNum(state.callsPerHour3);

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

  setUI((ui) => {
    ui.mcMeta = {
      lastRunAt: new Date().toISOString(),
      inputsHash: h,
      dailyLogHash: computeDailyLogHash(),
    };
  }, { render: false });
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

function triSample(min, mode, max, rng){
  // Triangular distribution sampling
  const u = rng();
  const c = (mode - min) / (max - min || 1);
  if (u < c){
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
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
