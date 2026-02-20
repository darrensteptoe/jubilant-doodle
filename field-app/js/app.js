import { engine } from "./engine.js";
import { computeCapacityContacts as coreComputeCapacityContacts, computeCapacityBreakdown as coreComputeCapacityBreakdown } from "./core/model.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS } from "./core/universeLayer.js";
import { computeAvgLiftPP } from "./core/turnout.js";
import { fmtInt, clamp, safeNum, daysBetween, downloadJson, readJsonFile } from "./utils.js";
import { loadState, saveState, clearState, readBackups, writeBackupEntry } from "./storage.js";
import { createScenarioManager } from "./scenarioManager.js";
import { APP_VERSION, BUILD_ID } from "./build.js";

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
  persist();
  render();
}



const els = {
  scenarioName: document.getElementById("scenarioName"),
  buildStamp: document.getElementById("buildStamp"),
  selfTestGate: document.getElementById("selfTestGate"),
  restoreBackup: document.getElementById("restoreBackup"),
  toggleStrictImport: document.getElementById("toggleStrictImport"),
  btnDiagnostics: document.getElementById("btnDiagnostics"),
  btnSaveScenario: document.getElementById("btnSaveScenario"),
  scCompareTbody: document.getElementById("scCompareTbody"),
  scOverall: document.getElementById("scOverall"),
  scWarn: document.getElementById("scWarn"),
  diagModal: document.getElementById("diagModal"),
  diagErrors: document.getElementById("diagErrors"),
  btnDiagClose: document.getElementById("btnDiagClose"),
  btnCopyDebug: document.getElementById("btnCopyDebug"),
  raceType: document.getElementById("raceType"),
  electionDate: document.getElementById("electionDate"),
  weeksRemaining: document.getElementById("weeksRemaining"),
  mode: document.getElementById("mode"),

  universeBasis: document.getElementById("universeBasis"),
  universeSize: document.getElementById("universeSize"),
  sourceNote: document.getElementById("sourceNote"),

  turnoutA: document.getElementById("turnoutA"),
  turnoutB: document.getElementById("turnoutB"),
  bandWidth: document.getElementById("bandWidth"),
  turnoutExpected: document.getElementById("turnoutExpected"),
  turnoutBand: document.getElementById("turnoutBand"),
  votesPer1pct: document.getElementById("votesPer1pct"),

  btnAddCandidate: document.getElementById("btnAddCandidate"),
  yourCandidate: document.getElementById("yourCandidate"),
  candTbody: document.getElementById("candTbody"),
  undecidedPct: document.getElementById("undecidedPct"),
  supportTotal: document.getElementById("supportTotal"),
  undecidedMode: document.getElementById("undecidedMode"),
  userSplitWrap: document.getElementById("userSplitWrap"),
  userSplitList: document.getElementById("userSplitList"),
  candWarn: document.getElementById("candWarn"),

  persuasionPct: document.getElementById("persuasionPct"),
  earlyVoteExp: document.getElementById("earlyVoteExp"),
    // Phase 2 — conversion + capacity
    goalSupportIds: "",
    supportRatePct: 55,
    contactRatePct: 22,
    doorsPerHour: 30,
    hoursPerShift: 3,
    shiftsPerVolunteerPerWeek: 2,

    // Phase 16 — universe composition + retention (OFF by default)
    universeLayerEnabled: UNIVERSE_DEFAULTS.enabled,
    universeDemPct: UNIVERSE_DEFAULTS.demPct,
    universeRepPct: UNIVERSE_DEFAULTS.repPct,
    universeNpaPct: UNIVERSE_DEFAULTS.npaPct,
    universeOtherPct: UNIVERSE_DEFAULTS.otherPct,
    retentionFactor: UNIVERSE_DEFAULTS.retentionFactor,


  // Phase 2 — conversion + capacity
  goalSupportIds: document.getElementById("goalSupportIds"),
  supportRatePct: document.getElementById("supportRatePct"),
  contactRatePct: document.getElementById("contactRatePct"),
  doorsPerHour: document.getElementById("doorsPerHour"),
  hoursPerShift: document.getElementById("hoursPerShift"),
  shiftsPerVolunteerPerWeek: document.getElementById("shiftsPerVolunteerPerWeek"),

  // Phase 16 — universe composition + retention
  universe16Enabled: document.getElementById("universe16Enabled"),
  universe16DemPct: document.getElementById("universe16DemPct"),
  universe16RepPct: document.getElementById("universe16RepPct"),
  universe16NpaPct: document.getElementById("universe16NpaPct"),
  universe16OtherPct: document.getElementById("universe16OtherPct"),
  retentionFactor: document.getElementById("retentionFactor"),
  universe16Derived: document.getElementById("universe16Derived"),
  universe16Warn: document.getElementById("universe16Warn"),

  outConversationsNeeded: document.getElementById("outConversationsNeeded"),
  outDoorsNeeded: document.getElementById("outDoorsNeeded"),
  outDoorsPerShift: document.getElementById("outDoorsPerShift"),
  outTotalShifts: document.getElementById("outTotalShifts"),
  outShiftsPerWeek: document.getElementById("outShiftsPerWeek"),
  outVolunteersNeeded: document.getElementById("outVolunteersNeeded"),
  convFeasBanner: document.getElementById("convFeasBanner"),

  // Phase 3 — execution + risk
  orgCount: document.getElementById("orgCount"),
  orgHoursPerWeek: document.getElementById("orgHoursPerWeek"),
  volunteerMultBase: document.getElementById("volunteerMultBase"),
  channelDoorPct: document.getElementById("channelDoorPct"),
  doorsPerHour3: document.getElementById("doorsPerHour3"),
  callsPerHour3: document.getElementById("callsPerHour3"),

  p3Weeks: document.getElementById("p3Weeks"),
  p3CapContacts: document.getElementById("p3CapContacts"),
  p3GapContacts: document.getElementById("p3GapContacts"),
  p3GapNote: document.getElementById("p3GapNote"),

  mcMode: document.getElementById("mcMode"),
  mcSeed: document.getElementById("mcSeed"),
  mcRun: document.getElementById("mcRun"),
  mcStale: document.getElementById("mcStale"),
  mcBasic: document.getElementById("mcBasic"),
  mcAdvanced: document.getElementById("mcAdvanced"),
  mcVolatility: document.getElementById("mcVolatility"),
  turnoutReliabilityPct: document.getElementById("turnoutReliabilityPct"),

  turnoutEnabled: document.getElementById("turnoutEnabled"),
  turnoutBaselinePct: document.getElementById("turnoutBaselinePct"),
  turnoutTargetOverridePct: document.getElementById("turnoutTargetOverridePct"),
  gotvMode: document.getElementById("gotvMode"),
  gotvBasic: document.getElementById("gotvBasic"),
  gotvAdvanced: document.getElementById("gotvAdvanced"),
  gotvLiftPP: document.getElementById("gotvLiftPP"),
  gotvMaxLiftPP: document.getElementById("gotvMaxLiftPP"),
  gotvDiminishing: document.getElementById("gotvDiminishing"),
  gotvLiftMin: document.getElementById("gotvLiftMin"),
  gotvLiftMode: document.getElementById("gotvLiftMode"),
  gotvLiftMax: document.getElementById("gotvLiftMax"),
  gotvMaxLiftPP2: document.getElementById("gotvMaxLiftPP2"),
  gotvDiminishing2: document.getElementById("gotvDiminishing2"),
  turnoutSummary: document.getElementById("turnoutSummary"),

  mcContactMin: document.getElementById("mcContactMin"),
  mcContactMode: document.getElementById("mcContactMode"),
  mcContactMax: document.getElementById("mcContactMax"),
  mcPersMin: document.getElementById("mcPersMin"),
  mcPersMode: document.getElementById("mcPersMode"),
  mcPersMax: document.getElementById("mcPersMax"),
  mcReliMin: document.getElementById("mcReliMin"),
  mcReliMode: document.getElementById("mcReliMode"),
  mcReliMax: document.getElementById("mcReliMax"),
  mcDphMin: document.getElementById("mcDphMin"),
  mcDphMode: document.getElementById("mcDphMode"),
  mcDphMax: document.getElementById("mcDphMax"),
  mcCphMin: document.getElementById("mcCphMin"),
  mcCphMode: document.getElementById("mcCphMode"),
  mcCphMax: document.getElementById("mcCphMax"),
  mcVolMin: document.getElementById("mcVolMin"),
  mcVolMode: document.getElementById("mcVolMode"),
  mcVolMax: document.getElementById("mcVolMax"),

  mcWinProb: document.getElementById("mcWinProb"),
  mcMedian: document.getElementById("mcMedian"),
  mcP5: document.getElementById("mcP5"),
  mcP95: document.getElementById("mcP95"),
  // Phase 14 — confidence envelope
  mcP10: document.getElementById("mcP10"),
  mcP50: document.getElementById("mcP50"),
  mcP90: document.getElementById("mcP90"),
  mcMoS: document.getElementById("mcMoS"),
  mcDownside: document.getElementById("mcDownside"),
  mcES10: document.getElementById("mcES10"),
  mcShiftP50: document.getElementById("mcShiftP50"),
  mcShiftP10: document.getElementById("mcShiftP10"),
  mcFragility: document.getElementById("mcFragility"),
  mcCliff: document.getElementById("mcCliff"),
  // Phase 14.1 — advisor completion
  mcRiskGrade: document.getElementById("mcRiskGrade"),
  mcShift60: document.getElementById("mcShift60"),
  mcShift70: document.getElementById("mcShift70"),
  mcShift80: document.getElementById("mcShift80"),
  mcShock10: document.getElementById("mcShock10"),
  mcShock25: document.getElementById("mcShock25"),
  mcShock50: document.getElementById("mcShock50"),
  mcRiskLabel: document.getElementById("mcRiskLabel"),
  mcSensitivity: document.getElementById("mcSensitivity"),

  // Lightweight visuals (SVG)
  svgWinProb: document.getElementById("svgWinProb"),
  svgWinProbMarker: document.getElementById("svgWinProbMarker"),
  vizWinProbNote: document.getElementById("vizWinProbNote"),
  svgMargin: document.getElementById("svgMargin"),
  svgMarginBars: document.getElementById("svgMarginBars"),
  svgMarginWinShade: document.getElementById("svgMarginWinShade"),
  svgMarginZero: document.getElementById("svgMarginZero"),
  svgMarginMin: document.getElementById("svgMarginMin"),
  svgMarginMax: document.getElementById("svgMarginMax"),
    // Phase 4 — budget + ROI
    roiDoorsEnabled: document.getElementById("roiDoorsEnabled"),
    roiDoorsCpa: document.getElementById("roiDoorsCpa"),
    roiDoorsKind: document.getElementById("roiDoorsKind"),
    roiDoorsCr: document.getElementById("roiDoorsCr"),
    roiDoorsSr: document.getElementById("roiDoorsSr"),
    roiPhonesEnabled: document.getElementById("roiPhonesEnabled"),
    roiPhonesCpa: document.getElementById("roiPhonesCpa"),
    roiPhonesKind: document.getElementById("roiPhonesKind"),
    roiPhonesCr: document.getElementById("roiPhonesCr"),
    roiPhonesSr: document.getElementById("roiPhonesSr"),
    roiTextsEnabled: document.getElementById("roiTextsEnabled"),
    roiTextsCpa: document.getElementById("roiTextsCpa"),
    roiTextsKind: document.getElementById("roiTextsKind"),
    roiTextsCr: document.getElementById("roiTextsCr"),
    roiTextsSr: document.getElementById("roiTextsSr"),
    roiOverheadAmount: document.getElementById("roiOverheadAmount"),
    roiIncludeOverhead: document.getElementById("roiIncludeOverhead"),
    roiRefresh: document.getElementById("roiRefresh"),
    roiTbody: document.getElementById("roiTbody"),
    roiBanner: document.getElementById("roiBanner"),

  // Phase 5 — optimization
  optMode: document.getElementById("optMode"),
    optObjective: document.getElementById("optObjective"),
  tlOptEnabled: document.getElementById("tlOptEnabled"),
  tlOptObjective: document.getElementById("tlOptObjective"),
  tlOptResults: document.getElementById("tlOptResults"),
  tlOptGoalFeasible: document.getElementById("tlOptGoalFeasible"),
  tlOptMaxNetVotes: document.getElementById("tlOptMaxNetVotes"),
  tlOptRemainingGap: document.getElementById("tlOptRemainingGap"),
  tlOptBinding: document.getElementById("tlOptBinding"),
  tlMvPrimary: document.getElementById("tlMvPrimary"),
  tlMvSecondary: document.getElementById("tlMvSecondary"),
  tlMvTbody: document.getElementById("tlMvTbody"),
  optBudget: document.getElementById("optBudget"),
  optCapacity: document.getElementById("optCapacity"),
  optStep: document.getElementById("optStep"),
  optUseDecay: document.getElementById("optUseDecay"),
  optRun: document.getElementById("optRun"),
  optTbody: document.getElementById("optTbody"),
  optBanner: document.getElementById("optBanner"),
  optTotalAttempts: document.getElementById("optTotalAttempts"),
  optTotalCost: document.getElementById("optTotalCost"),
  optTotalVotes: document.getElementById("optTotalVotes"),
  optBinding: document.getElementById("optBinding"),
  optGapContext: document.getElementById("optGapContext"),

  // Phase 7 — timeline / production
  timelineEnabled: document.getElementById("timelineEnabled"),
  timelineWeeksAuto: document.getElementById("timelineWeeksAuto"),
  timelineActiveWeeks: document.getElementById("timelineActiveWeeks"),
  timelineGotvWeeks: document.getElementById("timelineGotvWeeks"),
  timelineStaffCount: document.getElementById("timelineStaffCount"),
  timelineStaffHours: document.getElementById("timelineStaffHours"),
  timelineVolCount: document.getElementById("timelineVolCount"),
  timelineVolHours: document.getElementById("timelineVolHours"),
  timelineRampEnabled: document.getElementById("timelineRampEnabled"),
  timelineRampMode: document.getElementById("timelineRampMode"),
  timelineDoorsPerHour: document.getElementById("timelineDoorsPerHour"),
  timelineCallsPerHour: document.getElementById("timelineCallsPerHour"),
  timelineTextsPerHour: document.getElementById("timelineTextsPerHour"),
  tlPercent: document.getElementById("tlPercent"),
  tlCompletionWeek: document.getElementById("tlCompletionWeek"),
  tlShortfallAttempts: document.getElementById("tlShortfallAttempts"),
  tlConstraint: document.getElementById("tlConstraint"),
  tlShortfallVotes: document.getElementById("tlShortfallVotes"),
  tlWeekList: document.getElementById("tlWeekList"),
  tlBanner: document.getElementById("tlBanner"),

  validationList: document.getElementById("validationList"),

  kpiTurnoutVotes: document.getElementById("kpiTurnoutVotes"),
  kpiTurnoutBand: document.getElementById("kpiTurnoutBand"),
  kpiWinThreshold: document.getElementById("kpiWinThreshold"),
  kpiYourVotes: document.getElementById("kpiYourVotes"),
  kpiYourVotesShare: document.getElementById("kpiYourVotesShare"),
  kpiPersuasionNeed: document.getElementById("kpiPersuasionNeed"),
  kpiPersuasionStatus: document.getElementById("kpiPersuasionStatus"),

  miniEarlyVotes: document.getElementById("miniEarlyVotes"),
  miniEarlyNote: document.getElementById("miniEarlyNote"),
  miniEDVotes: document.getElementById("miniEDVotes"),
  miniPersUniverse: document.getElementById("miniPersUniverse"),
  miniPersCheck: document.getElementById("miniPersCheck"),

  stressBox: document.getElementById("stressBox"),
  explainCard: document.getElementById("explainCard"),

  assumptionsSnapshot: document.getElementById("assumptionsSnapshot"),
  guardrails: document.getElementById("guardrails"),

  btnSaveJson: document.getElementById("btnSaveJson"),
  loadJson: document.getElementById("loadJson"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnCopySummary: document.getElementById("btnCopySummary"),
  btnResetAll: document.getElementById("btnResetAll"),

  toggleTraining: document.getElementById("toggleTraining"),
  toggleDark: document.getElementById("toggleDark"),
  toggleAdvDiag: document.getElementById("toggleAdvDiag"),
  advDiagBox: document.getElementById("advDiagBox"),
  snapshotHash: document.getElementById("snapshotHash"),
  importHashBanner: document.getElementById("importHashBanner"),
  importWarnBanner: document.getElementById("importWarnBanner"),

  // Phase 12 — Decision Intelligence
  diWarn: document.getElementById("diWarn"),
  diPrimary: document.getElementById("diPrimary"),
  diSecondary: document.getElementById("diSecondary"),
  diNotBinding: document.getElementById("diNotBinding"),
  diRecVol: document.getElementById("diRecVol"),
  diRecCost: document.getElementById("diRecCost"),
  diRecProb: document.getElementById("diRecProb"),
  diVolTbody: document.getElementById("diVolTbody"),
  diCostTbody: document.getElementById("diCostTbody"),
  diProbTbody: document.getElementById("diProbTbody"),

  // Phase 15 — Sensitivity Surface
  surfaceLever: document.getElementById("surfaceLever"),
  surfaceMode: document.getElementById("surfaceMode"),
  surfaceMin: document.getElementById("surfaceMin"),
  surfaceMax: document.getElementById("surfaceMax"),
  surfaceSteps: document.getElementById("surfaceSteps"),
  surfaceTarget: document.getElementById("surfaceTarget"),
  btnComputeSurface: document.getElementById("btnComputeSurface"),
  surfaceStatus: document.getElementById("surfaceStatus"),
  surfaceTbody: document.getElementById("surfaceTbody"),
  surfaceSummary: document.getElementById("surfaceSummary"),
};

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

function wireEvents(){
  // Phase 11 — safety rails controls (fail-soft)
  safeCall(() => {
    if (els.toggleStrictImport){
      els.toggleStrictImport.checked = !!state?.ui?.strictImport;
      els.toggleStrictImport.addEventListener("change", () => {
        state.ui.strictImport = !!els.toggleStrictImport.checked;
        persist();
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
  });


  els.scenarioName.addEventListener("input", () => { state.scenarioName = els.scenarioName.value; persist(); });

  els.raceType.addEventListener("change", () => {
    state.raceType = els.raceType.value;
    const defs = DEFAULTS_BY_TEMPLATE[state.raceType] || DEFAULTS_BY_TEMPLATE.state_leg;
    if (!state.bandWidth && state.bandWidth !== 0) state.bandWidth = defs.bandWidth;
    state.bandWidth = state.bandWidth || defs.bandWidth;
    state.persuasionPct = state.persuasionPct || defs.persuasionPct;
    state.earlyVoteExp = state.earlyVoteExp || defs.earlyVoteExp;
    applyStateToUI();
  applyThemeFromState();
  initThemeSystemListener();
    render();
    persist();
  });

  els.electionDate.addEventListener("change", () => { state.electionDate = els.electionDate.value; render(); persist(); });
  els.weeksRemaining.addEventListener("input", () => { state.weeksRemaining = els.weeksRemaining.value; render(); persist(); });
  els.mode.addEventListener("change", () => { state.mode = els.mode.value; persist(); });

  els.universeBasis.addEventListener("change", () => { state.universeBasis = els.universeBasis.value; render(); persist(); });
  els.universeSize.addEventListener("input", () => { state.universeSize = safeNum(els.universeSize.value); render(); persist(); });
  els.sourceNote.addEventListener("input", () => { state.sourceNote = els.sourceNote.value; persist(); });

  els.turnoutA.addEventListener("input", () => { state.turnoutA = safeNum(els.turnoutA.value); render(); persist(); });
  els.turnoutB.addEventListener("input", () => { state.turnoutB = safeNum(els.turnoutB.value); render(); persist(); });
  els.bandWidth.addEventListener("input", () => { state.bandWidth = safeNum(els.bandWidth.value); render(); persist(); });

  els.btnAddCandidate.addEventListener("click", () => {
    state.candidates.push({ id: uid(), name: `Candidate ${String.fromCharCode(65 + state.candidates.length)}`, supportPct: 0 });
    rebuildCandidateTable();
    render();
    persist();
  });

  els.yourCandidate.addEventListener("change", () => { state.yourCandidateId = els.yourCandidate.value; render(); persist(); });
  els.undecidedPct.addEventListener("input", () => { state.undecidedPct = safeNum(els.undecidedPct.value); render(); persist(); });

  els.undecidedMode.addEventListener("change", () => {
    state.undecidedMode = els.undecidedMode.value;
    rebuildUserSplitInputs();
    render();
    persist();
  });

  els.persuasionPct.addEventListener("input", () => { state.persuasionPct = safeNum(els.persuasionPct.value); render(); persist(); });
  els.earlyVoteExp.addEventListener("input", () => { state.earlyVoteExp = safeNum(els.earlyVoteExp.value); render(); persist(); });

  // Phase 2 — conversion + capacity
  if (els.goalSupportIds) els.goalSupportIds.addEventListener("input", () => { state.goalSupportIds = els.goalSupportIds.value; markMcStale(); render(); persist(); });
  if (els.supportRatePct) els.supportRatePct.addEventListener("input", () => { state.supportRatePct = safeNum(els.supportRatePct.value); markMcStale(); render(); persist(); });
  if (els.contactRatePct) els.contactRatePct.addEventListener("input", () => { state.contactRatePct = safeNum(els.contactRatePct.value); markMcStale(); render(); persist(); });
  if (els.doorsPerHour) els.doorsPerHour.addEventListener("input", () => { state.doorsPerHour = safeNum(els.doorsPerHour.value); render(); persist(); });
  if (els.hoursPerShift) els.hoursPerShift.addEventListener("input", () => { state.hoursPerShift = safeNum(els.hoursPerShift.value); render(); persist(); });
  if (els.shiftsPerVolunteerPerWeek) els.shiftsPerVolunteerPerWeek.addEventListener("input", () => { state.shiftsPerVolunteerPerWeek = safeNum(els.shiftsPerVolunteerPerWeek.value); render(); persist(); });

  // Phase 16 — universe composition + retention
  if (els.universe16Enabled) els.universe16Enabled.addEventListener("change", () => { state.universeLayerEnabled = !!els.universe16Enabled.checked; markMcStale(); render(); persist(); });
  if (els.universe16DemPct) els.universe16DemPct.addEventListener("input", () => { state.universeDemPct = safeNum(els.universe16DemPct.value); markMcStale(); render(); persist(); });
  if (els.universe16RepPct) els.universe16RepPct.addEventListener("input", () => { state.universeRepPct = safeNum(els.universe16RepPct.value); markMcStale(); render(); persist(); });
  if (els.universe16NpaPct) els.universe16NpaPct.addEventListener("input", () => { state.universeNpaPct = safeNum(els.universe16NpaPct.value); markMcStale(); render(); persist(); });
  if (els.universe16OtherPct) els.universe16OtherPct.addEventListener("input", () => { state.universeOtherPct = safeNum(els.universe16OtherPct.value); markMcStale(); render(); persist(); });
  if (els.retentionFactor) els.retentionFactor.addEventListener("input", () => { state.retentionFactor = safeNum(els.retentionFactor.value); markMcStale(); render(); persist(); });

  // Phase 3 — execution + risk
  if (els.orgCount) els.orgCount.addEventListener("input", () => { state.orgCount = safeNum(els.orgCount.value); markMcStale(); render(); persist(); });
  if (els.orgHoursPerWeek) els.orgHoursPerWeek.addEventListener("input", () => { state.orgHoursPerWeek = safeNum(els.orgHoursPerWeek.value); markMcStale(); render(); persist(); });
  if (els.volunteerMultBase) els.volunteerMultBase.addEventListener("input", () => { state.volunteerMultBase = safeNum(els.volunteerMultBase.value); markMcStale(); render(); persist(); });
  if (els.channelDoorPct) els.channelDoorPct.addEventListener("input", () => { state.channelDoorPct = safeNum(els.channelDoorPct.value); markMcStale(); render(); persist(); });
  if (els.doorsPerHour3) els.doorsPerHour3.addEventListener("input", () => { state.doorsPerHour3 = safeNum(els.doorsPerHour3.value); markMcStale(); render(); persist(); });
  if (els.callsPerHour3) els.callsPerHour3.addEventListener("input", () => { state.callsPerHour3 = safeNum(els.callsPerHour3.value); markMcStale(); render(); persist(); });
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.addEventListener("input", () => { state.turnoutReliabilityPct = safeNum(els.turnoutReliabilityPct.value); markMcStale(); render(); persist(); });

  // Phase 6 — turnout / GOTV inputs
  if (els.turnoutEnabled) els.turnoutEnabled.addEventListener("change", () => { state.turnoutEnabled = !!els.turnoutEnabled.checked; markMcStale(); render(); persist(); });
  if (els.turnoutBaselinePct) els.turnoutBaselinePct.addEventListener("input", () => { state.turnoutBaselinePct = safeNum(els.turnoutBaselinePct.value); markMcStale(); render(); persist(); });
  if (els.turnoutTargetOverridePct) els.turnoutTargetOverridePct.addEventListener("input", () => { state.turnoutTargetOverridePct = els.turnoutTargetOverridePct.value; markMcStale(); render(); persist(); });

  if (els.gotvMode) els.gotvMode.addEventListener("change", () => { state.gotvMode = els.gotvMode.value; syncGotvModeUI(); markMcStale(); render(); persist(); });

  if (els.gotvLiftPP) els.gotvLiftPP.addEventListener("input", () => { state.gotvLiftPP = safeNum(els.gotvLiftPP.value); markMcStale(); render(); persist(); });
  if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.addEventListener("input", () => { state.gotvMaxLiftPP = safeNum(els.gotvMaxLiftPP.value); markMcStale(); render(); persist(); });
  if (els.gotvDiminishing) els.gotvDiminishing.addEventListener("change", () => { state.gotvDiminishing = !!els.gotvDiminishing.checked; markMcStale(); render(); persist(); });

  if (els.gotvLiftMin) els.gotvLiftMin.addEventListener("input", () => { state.gotvLiftMin = safeNum(els.gotvLiftMin.value); markMcStale(); render(); persist(); });
  if (els.gotvLiftMode) els.gotvLiftMode.addEventListener("input", () => { state.gotvLiftMode = safeNum(els.gotvLiftMode.value); markMcStale(); render(); persist(); });
  if (els.gotvLiftMax) els.gotvLiftMax.addEventListener("input", () => { state.gotvLiftMax = safeNum(els.gotvLiftMax.value); markMcStale(); render(); persist(); });
  if (els.gotvMaxLiftPP2) els.gotvMaxLiftPP2.addEventListener("input", () => { state.gotvMaxLiftPP2 = safeNum(els.gotvMaxLiftPP2.value); markMcStale(); render(); persist(); });
  if (els.gotvDiminishing2) els.gotvDiminishing2.addEventListener("change", () => { state.gotvDiminishing2 = !!els.gotvDiminishing2.checked; markMcStale(); render(); persist(); });


  if (els.mcMode) els.mcMode.addEventListener("change", () => { state.mcMode = els.mcMode.value; syncMcModeUI(); markMcStale(); persist(); });
  if (els.mcVolatility) els.mcVolatility.addEventListener("change", () => { state.mcVolatility = els.mcVolatility.value; markMcStale(); persist(); });
  if (els.mcSeed) els.mcSeed.addEventListener("input", () => { state.mcSeed = els.mcSeed.value; markMcStale(); persist(); });

  const advWatch = (el, key) => {
    if (!el) return;
    el.addEventListener("input", () => {
      state[key] = safeNum(el.value);
      markMcStale();
      persist();
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
  advWatch(els.mcVolMin, "mcVolMin");
  advWatch(els.mcVolMode, "mcVolMode");
  advWatch(els.mcVolMax, "mcVolMax");

  if (els.mcRun) els.mcRun.addEventListener("click", () => runMonteCarloNow());


    // Phase 4 — ROI inputs
    const ensureBudget = () => {
      if (!state.budget) state.budget = { overheadAmount: 0, includeOverhead: false, tactics: { doors:{enabled:true,cpa:0,crPct:null,srPct:null,kind:"persuasion"}, phones:{enabled:true,cpa:0,crPct:null,srPct:null,kind:"persuasion"}, texts:{enabled:false,cpa:0,crPct:null,srPct:null,kind:"persuasion"} }, optimize: { mode:"budget", budgetAmount:10000, capacityAttempts:"", step:25, useDecay:false, objective:"net", tlConstrainedEnabled:false, tlConstrainedObjective:"max_net" } };
      if (!state.budget.tactics) state.budget.tactics = { doors:{enabled:true,cpa:0,crPct:null,srPct:null}, phones:{enabled:true,cpa:0,crPct:null,srPct:null}, texts:{enabled:false,cpa:0,crPct:null,srPct:null} };
      if (!state.budget.optimize) state.budget.optimize = { mode:"budget", budgetAmount:10000, capacityAttempts:"", step:25, useDecay:false, objective:"net", tlConstrainedEnabled:false, tlConstrainedObjective:"max_net" };
      if (!state.budget.tactics.doors) state.budget.tactics.doors = { enabled:true, cpa:0, crPct:null, srPct:null };
      if (!state.budget.tactics.phones) state.budget.tactics.phones = { enabled:true, cpa:0, crPct:null, srPct:null };
      if (!state.budget.tactics.texts) state.budget.tactics.texts = { enabled:false, cpa:0, crPct:null, srPct:null };
    };

    const watchBool = (el, fn) => {
      if (!el) return;
      el.addEventListener("change", () => { ensureBudget(); fn(); render(); persist(); });
    };
    const watchNum = (el, fn) => {
      if (!el) return;
      el.addEventListener("input", () => { ensureBudget(); fn(); render(); persist(); });
    };

    watchBool(els.roiDoorsEnabled, () => state.budget.tactics.doors.enabled = !!els.roiDoorsEnabled.checked);
    watchNum(els.roiDoorsCpa, () => state.budget.tactics.doors.cpa = safeNum(els.roiDoorsCpa.value) ?? 0);
    watchNum(els.roiDoorsCr, () => state.budget.tactics.doors.crPct = safeNum(els.roiDoorsCr.value));
    watchNum(els.roiDoorsSr, () => state.budget.tactics.doors.srPct = safeNum(els.roiDoorsSr.value));


    watchBool(els.roiPhonesEnabled, () => state.budget.tactics.phones.enabled = !!els.roiPhonesEnabled.checked);
    watchNum(els.roiPhonesCpa, () => state.budget.tactics.phones.cpa = safeNum(els.roiPhonesCpa.value) ?? 0);
    watchNum(els.roiPhonesCr, () => state.budget.tactics.phones.crPct = safeNum(els.roiPhonesCr.value));
    watchNum(els.roiPhonesSr, () => state.budget.tactics.phones.srPct = safeNum(els.roiPhonesSr.value));


    watchBool(els.roiTextsEnabled, () => state.budget.tactics.texts.enabled = !!els.roiTextsEnabled.checked);
    watchNum(els.roiTextsCpa, () => state.budget.tactics.texts.cpa = safeNum(els.roiTextsCpa.value) ?? 0);
    watchNum(els.roiTextsCr, () => state.budget.tactics.texts.crPct = safeNum(els.roiTextsCr.value));
    watchNum(els.roiTextsSr, () => state.budget.tactics.texts.srPct = safeNum(els.roiTextsSr.value));


    watchNum(els.roiOverheadAmount, () => state.budget.overheadAmount = safeNum(els.roiOverheadAmount.value) ?? 0);
    watchBool(els.roiIncludeOverhead, () => state.budget.includeOverhead = !!els.roiIncludeOverhead.checked);

    
// Phase 5 — optimization controls (top-layer only; does not change Phase 1–4 math)
const watchOpt = (el, fn, evt="input") => {
  if (!el) return;
  el.addEventListener(evt, () => { ensureBudget(); fn(); render(); persist(); });
};

watchOpt(els.optMode, () => state.budget.optimize.mode = els.optMode.value, "change");
watchOpt(els.optObjective, () => state.budget.optimize.objective = els.optObjective.value, "change");
watchOpt(els.tlOptEnabled, () => state.budget.optimize.tlConstrainedEnabled = !!els.tlOptEnabled.checked, "change");
watchOpt(els.tlOptObjective, () => state.budget.optimize.tlConstrainedObjective = els.tlOptObjective.value || "max_net", "change");
watchOpt(els.optBudget, () => state.budget.optimize.budgetAmount = safeNum(els.optBudget.value) ?? 0);
watchOpt(els.optCapacity, () => state.budget.optimize.capacityAttempts = els.optCapacity.value ?? "");
watchOpt(els.optStep, () => state.budget.optimize.step = safeNum(els.optStep.value) ?? 25);
watchOpt(els.optUseDecay, () => state.budget.optimize.useDecay = !!els.optUseDecay.checked, "change");

// Phase 7 — timeline / production (feasibility only; never re-optimizes)
const watchTL = (el, fn, evt="input") => {
  if (!el) return;
  el.addEventListener(evt, () => { fn(); render(); persist(); });
};

watchTL(els.timelineEnabled, () => state.timelineEnabled = !!els.timelineEnabled.checked, "change");
watchTL(els.timelineActiveWeeks, () => state.timelineActiveWeeks = els.timelineActiveWeeks.value ?? "");
watchTL(els.timelineGotvWeeks, () => state.timelineGotvWeeks = safeNum(els.timelineGotvWeeks.value));
watchTL(els.timelineStaffCount, () => state.timelineStaffCount = safeNum(els.timelineStaffCount.value) ?? 0);
watchTL(els.timelineStaffHours, () => state.timelineStaffHours = safeNum(els.timelineStaffHours.value) ?? 0);
watchTL(els.timelineVolCount, () => state.timelineVolCount = safeNum(els.timelineVolCount.value) ?? 0);
watchTL(els.timelineVolHours, () => state.timelineVolHours = safeNum(els.timelineVolHours.value) ?? 0);
watchTL(els.timelineRampEnabled, () => state.timelineRampEnabled = !!els.timelineRampEnabled.checked, "change");
watchTL(els.timelineRampMode, () => state.timelineRampMode = els.timelineRampMode.value || "linear", "change");
watchTL(els.timelineDoorsPerHour, () => state.timelineDoorsPerHour = safeNum(els.timelineDoorsPerHour.value) ?? 0);
watchTL(els.timelineCallsPerHour, () => state.timelineCallsPerHour = safeNum(els.timelineCallsPerHour.value) ?? 0);
watchTL(els.timelineTextsPerHour, () => state.timelineTextsPerHour = safeNum(els.timelineTextsPerHour.value) ?? 0);

if (els.optRun) els.optRun.addEventListener("click", () => { render(); });
if (els.roiRefresh) els.roiRefresh.addEventListener("click", () => { render(); });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      state.ui.activeTab = tab;

      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      document.getElementById(`tab-${tab}`).classList.add("active");

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
    clearState();
    applyStateToUI();
    rebuildCandidateTable();
    document.body.classList.toggle("training", !!state.ui.training);
    document.body.classList.toggle("dark", !!state.ui.dark);
    if (els.explainCard) els.explainCard.hidden = !state.ui.training;
    render();
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
    applyStateToUI();
    rebuildCandidateTable();
    document.body.classList.toggle("training", !!state.ui.training);
    document.body.classList.toggle("dark", !!state.ui.dark);
    if (els.explainCard) els.explainCard.hidden = !state.ui.training;
    render();
    persist();
    els.loadJson.value = "";
  });

  if (els.toggleTraining) els.toggleTraining.addEventListener("change", () => {
    state.ui.training = els.toggleTraining.checked;
    document.body.classList.toggle("training", !!state.ui.training);
    if (els.snapshotHash) els.snapshotHash.textContent = lastResultsSnapshot?.snapshotHash || "—";
  if (els.importHashBanner && els.importHashBanner.hidden === false){ /* keep until next import clears */ }
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
  wireScenarioComparePanel();
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

  // Stale indicator
  if (state.mcLast && els.mcStale){
    const h = hashMcInputs(res, w);
    const stale = (state.mcLastHash && state.mcLastHash !== h);
    els.mcStale.hidden = !stale;
  }

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

  persist();
  clearMcStale();
  renderMcResults(sim);
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
    els.mcWinProb.textContent = `${(summary.winProb * 100).toFixed(1)}% (TA: ${(summary.winProbTurnoutAdjusted * 100).toFixed(1)}%)`;
  } else {
    els.mcWinProb.textContent = `${(summary.winProb * 100).toFixed(1)}%`;
  }
  els.mcMedian.textContent = fmtSigned(summary.median);
  els.mcP5.textContent = fmtSigned(summary.p5);
  els.mcP95.textContent = fmtSigned(summary.p95);

  // Phase 14 — Confidence Envelope
  if (summary.confidenceEnvelope){
    const ce = summary.confidenceEnvelope;
    if (els.mcP10) els.mcP10.textContent = fmtSigned(ce.percentiles?.p10);
    if (els.mcP50) els.mcP50.textContent = fmtSigned(ce.percentiles?.p50);
    if (els.mcP90) els.mcP90.textContent = fmtSigned(ce.percentiles?.p90);
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

function triSample(min, mode, max, rng){
  // Triangular distribution sampling
  const u = rng();
  const c = (mode - min) / (max - min || 1);
  if (u < c){
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function makeRng(seedStr){
  if (!seedStr) return Math.random;
  const seed = xmur3(seedStr)();
  return mulberry32(seed);
}

// Hash function for seed strings
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}

function mulberry32(a){
  return function(){
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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