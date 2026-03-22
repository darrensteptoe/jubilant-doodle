import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody,
} from "../../componentFactory.js";
import { createFieldGrid, setText } from "../../surfaceUtils.js";
import {
  addDistrictCandidate,
  addDistrictCandidateHistory,
  applyDistrictTemplateDefaults,
  applyDistrictTargetingPreset,
  exportDistrictTargetingCsv,
  exportDistrictTargetingJson,
  readDistrictBallotSnapshot,
  readDistrictCensusConfigSnapshot,
  readDistrictCensusResultsSnapshot,
  readDistrictControlSnapshot,
  readDistrictElectionDataSummarySnapshot,
  readDistrictFormSnapshot,
  readDistrictSummarySnapshot,
  readDistrictTargetingConfigSnapshot,
  readDistrictTargetingResultsSnapshot,
  readDistrictTemplateSnapshot,
  readRuntimeDiagnosticsSnapshot,
  removeDistrictCandidate,
  removeDistrictCandidateHistory,
  resetDistrictTargetingWeights,
  runDistrictTargeting,
  setDistrictCensusFile,
  setDistrictCensusField,
  setDistrictCensusGeoSelection,
  setDistrictFormField,
  setDistrictTargetingField,
  setDistrictUserSplit,
  triggerDistrictCensusAction,
  updateDistrictCandidate,
  updateDistrictCandidateHistory,
} from "../../stateBridge.js";
import {
  classifyDistrictStatusTone,
  deriveDistrictBaselineCardStatus,
  deriveDistrictCensusCardStatus,
  deriveDistrictElectorateCardStatus,
  deriveDistrictRaceCardStatus,
  deriveDistrictSummaryCardStatus,
  deriveDistrictTargetingCardStatus,
} from "../../../../core/districtView.js";
import {
  listDistrictModeOptions,
  listDistrictRaceTypeOptions,
  listDistrictUndecidedModeOptions,
  listDistrictUniverseBasisOptions,
} from "../../../districtOptionRegistry.js";
import { listTemplateDimensionOptions } from "../../../templateRegistry.js";
import {
  listTargetGeoLevels,
  listTargetModelOptions,
} from "../../../targetingRuntime.js";
import {
  listAcsYears,
  listMetricSetOptions,
  listResolutionOptions,
} from "../../../../core/censusModule.js";
import { renderDistrictV2RaceContextCard } from "./raceContext.js";
import { renderDistrictV2ElectorateCard } from "./electorate.js";
import { renderDistrictV2TurnoutBaselineCard } from "./turnoutBaseline.js";
import { renderDistrictV2BallotCard } from "./ballot.js";
import { renderDistrictV2CandidateHistoryCard } from "./candidateHistory.js";
import { renderDistrictV2TargetingCard } from "./targetingConfig.js";
import { renderDistrictV2CensusCard } from "./censusConfig.js";
import {
  renderDistrictV2SummaryCard,
  syncDistrictV2Summary,
} from "./summary.js";

const TARGETING_DENSITY_OPTIONS = Object.freeze([
  { value: "none", label: "None" },
  { value: "medium", label: "Medium+" },
  { value: "high", label: "High" },
]);

const DISTRICT_V2_BRIDGE_STATUS_ID = "v3DistrictV2BridgeStatus";
const DISTRICT_V2_RUNTIME_DEBUG_ID = "v3DistrictV2RuntimeDebug";
const DISTRICT_V2_RUNTIME_DEBUG_BODY_ID = "v3DistrictV2RuntimeDebugBody";
const DISTRICT_V2_TRACE_PREFIX = "[district_v2_dom_trace]";
const DISTRICT_V2_TRACE_FLAG_KEY = "__FPE_DISTRICT_V2_TRACE_ENABLED__";
const DISTRICT_V2_BINDER_AUDIT_PREFIX = "[district_v2_binder_audit]";
const DISTRICT_V2_BINDER_AUDIT_PARAM = "districtBinderAudit";
const DISTRICT_V2_BINDER_AUDIT_TARGET_IDS = Object.freeze([
  "v3DistrictV2RaceType",
  "v3DistrictV2ElectionDate",
  "v3DistrictV2UniverseSize",
]);
const DISTRICT_V2_RUNTIME_DEBUG_QUERY_PARAM = "districtRuntimeDebug";
const DISTRICT_V2_TRACE_AUTO_MAX_ATTEMPTS = 12;
const DISTRICT_V2_TRACE_AUTO_RETRY_MS = 60;
const DISTRICT_V2_CARD_ID_BY_SCOPE = Object.freeze({
  raceContext: "v3DistrictV2RaceCard",
  electorate: "v3DistrictV2ElectorateCard",
  turnoutBaseline: "v3DistrictV2TurnoutBaselineCard",
  ballot: "v3DistrictV2BallotCard",
  candidateHistory: "v3DistrictV2CandidateHistoryCard",
  targeting: "v3DistrictV2TargetingCard",
  census: "v3DistrictV2CensusCard",
});
let districtV2NodeSequence = 0;
let districtV2TraceObservers = [];
const districtV2NodeTokens = new WeakMap();
let districtV2TraceInstalled = false;
let districtV2TraceRaceRoot = null;
let districtV2TraceElectorateRoot = null;
let districtV2TraceTurnoutRoot = null;
let districtV2TraceBallotRoot = null;
let districtV2TraceCandidateHistoryRoot = null;
let districtV2TraceTargetingRoot = null;
let districtV2TraceCensusRoot = null;
let districtV2TraceAutoRan = false;
let districtV2TraceAutoAttempts = 0;
const districtV2BinderAttachCounts = new WeakMap();

function isDistrictV2RuntimeDebugVisible() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get(DISTRICT_V2_RUNTIME_DEBUG_QUERY_PARAM) || "").trim().toLowerCase();
    return token === "1" || token === "true" || token === "yes";
  } catch {
    return false;
  }
}

export function renderDistrictV2Surface(mount) {
  console.info("[district_v2] mounted");

  const frame = createCenterStackFrame();
  frame.dataset.districtSurface = "district_v2";
  const center = createCenterStackColumn();

  const raceCard = createCenterModuleCard({
    title: "Race context",
    description: "Race template, election date, weeks remaining, and operating mode.",
    status: "Awaiting context",
  });
  raceCard.id = DISTRICT_V2_CARD_ID_BY_SCOPE.raceContext;
  assignCardStatusId(raceCard, "v3DistrictV2RaceCardStatus");

  const electorateCard = createCenterModuleCard({
    title: "Electorate",
    description: "Universe definition, basis, and weighted composition.",
    status: "Awaiting universe",
  });
  electorateCard.id = DISTRICT_V2_CARD_ID_BY_SCOPE.electorate;
  assignCardStatusId(electorateCard, "v3DistrictV2ElectorateCardStatus");

  const turnoutBaselineCard = createCenterModuleCard({
    title: "Turnout baseline",
    description: "Two-cycle turnout anchors and confidence band width.",
    status: "Awaiting turnout anchors",
  });
  turnoutBaselineCard.id = DISTRICT_V2_CARD_ID_BY_SCOPE.turnoutBaseline;
  assignCardStatusId(turnoutBaselineCard, "v3DistrictV2TurnoutBaselineCardStatus");

  const ballotCard = createCenterModuleCard({
    title: "Ballot",
    description: "Candidate support baseline, undecided handling, and user split.",
    status: "Awaiting ballot",
  });
  ballotCard.id = DISTRICT_V2_CARD_ID_BY_SCOPE.ballot;
  assignCardStatusId(ballotCard, "v3DistrictV2BallotCardStatus");

  const candidateHistoryCard = createCenterModuleCard({
    title: "Candidate history",
    description: "Historical office-cycle records feeding baseline confidence.",
    status: "No rows",
  });
  candidateHistoryCard.id = DISTRICT_V2_CARD_ID_BY_SCOPE.candidateHistory;
  assignCardStatusId(candidateHistoryCard, "v3DistrictV2CandidateHistoryCardStatus");

  const targetingCard = createCenterModuleCard({
    title: "Targeting config",
    description: "Canonical targeting filters, weights, and ranking output.",
    status: "Run targeting",
  });
  targetingCard.id = DISTRICT_V2_CARD_ID_BY_SCOPE.targeting;
  assignCardStatusId(targetingCard, "v3DistrictV2TargetingCardStatus");

  const censusCard = createCenterModuleCard({
    title: "Census assumptions",
    description: "Canonical Census inputs with derived GEO/row status.",
    status: "Awaiting GEOs",
  });
  censusCard.id = DISTRICT_V2_CARD_ID_BY_SCOPE.census;
  assignCardStatusId(censusCard, "v3DistrictV2CensusCardStatus");

  const summaryCard = createCenterModuleCard({
    title: "District summary",
    description: "Canonical baseline output snapshot for this district.",
    status: "Awaiting baseline",
  });
  assignCardStatusId(summaryCard, "v3DistrictV2SummaryCardStatus");

  const bridgeStatus = document.createElement("div");
  bridgeStatus.id = DISTRICT_V2_BRIDGE_STATUS_ID;
  bridgeStatus.className = "fpe-alert fpe-alert--warn";
  bridgeStatus.hidden = true;

  const runtimeDebug = document.createElement("details");
  runtimeDebug.id = DISTRICT_V2_RUNTIME_DEBUG_ID;
  runtimeDebug.className = "fpe-runtime-debug-panel";
  runtimeDebug.hidden = !isDistrictV2RuntimeDebugVisible();
  runtimeDebug.innerHTML = `
    <summary>Runtime parity debug</summary>
    <pre id="${DISTRICT_V2_RUNTIME_DEBUG_BODY_ID}">Waiting for District parity diagnostics.</pre>
  `;

  renderDistrictV2RaceContextCard({ raceCard, createFieldGrid, getCardBody });
  renderDistrictV2ElectorateCard({ electorateCard, createFieldGrid, getCardBody });
  renderDistrictV2TurnoutBaselineCard({ turnoutBaselineCard, createFieldGrid, getCardBody });
  renderDistrictV2BallotCard({ ballotCard, createFieldGrid, getCardBody });
  renderDistrictV2CandidateHistoryCard({ candidateHistoryCard, getCardBody });
  renderDistrictV2TargetingCard({ targetingCard, getCardBody });
  renderDistrictV2CensusCard({ censusCard, getCardBody });
  renderDistrictV2SummaryCard({ summaryCard, getCardBody });

  center.append(
    bridgeStatus,
    runtimeDebug,
    createWhyPanel([
      "District V2 uses canonical snapshots for inputs and derived snapshots for outputs.",
      "All writes dispatch through bridge action methods; no District-only pending-write hold path is used.",
      "Modules follow one full-width center stack contract with no mixed card widths.",
    ]),
    summaryCard,
    raceCard,
    electorateCard,
    turnoutBaselineCard,
    ballotCard,
    candidateHistoryCard,
    targetingCard,
    censusCard,
  );

  frame.append(center);
  mount.innerHTML = "";
  mount.append(frame);

  bindDistrictV2RaceContextHandlers();
  bindDistrictV2ElectorateHandlers();
  bindDistrictV2TurnoutBaselineHandlers();
  bindDistrictV2BallotHandlers();
  bindDistrictV2CandidateHistoryHandlers();
  bindDistrictV2TargetingHandlers();
  bindDistrictV2CensusHandlers();
  try {
    window.__FPE_DISTRICT_V2_TRACE__ = {
      enable: () => {
        window[DISTRICT_V2_TRACE_FLAG_KEY] = true;
        installDistrictV2DomLifecycleTrace();
      },
      disable: () => {
        window[DISTRICT_V2_TRACE_FLAG_KEY] = false;
        installDistrictV2DomLifecycleTrace();
      },
      readControlSnapshot: (controlId) => readDistrictV2TraceSnapshot(controlId),
    };
  } catch {}
  installDistrictV2DomLifecycleTrace();
  runDistrictV2BinderAuditSnapshot();

  refreshDistrictV2Surface();
  return refreshDistrictV2Surface;
}

export function refreshDistrictV2Surface() {
  const controlSnapshot = readDistrictControlSnapshot();
  const templateSnapshot = readDistrictTemplateSnapshot();
  const formSnapshot = readDistrictFormSnapshot();
  const ballotSnapshot = readDistrictBallotSnapshot();
  const targetingConfigSnapshot = readDistrictTargetingConfigSnapshot();
  const targetingResultsSnapshot = readDistrictTargetingResultsSnapshot();
  const censusConfigSnapshot = readDistrictCensusConfigSnapshot();
  const censusResultsSnapshot = readDistrictCensusResultsSnapshot();
  const electionDataSummarySnapshot = readDistrictElectionDataSummarySnapshot();
  const snapshot = readDistrictSummarySnapshot();

  const hasBridgeView = !!(
    templateSnapshot
    || formSnapshot
    || ballotSnapshot
    || targetingConfigSnapshot
    || targetingResultsSnapshot
    || censusConfigSnapshot
    || censusResultsSnapshot
    || electionDataSummarySnapshot
    || snapshot
  );

  syncDistrictV2BridgeAvailability(hasBridgeView);
  installDistrictV2DomLifecycleTrace();
  if (!hasBridgeView) {
    return;
  }

  syncDistrictV2RaceContext(templateSnapshot, formSnapshot, controlSnapshot);
  syncDistrictV2Electorate(formSnapshot, controlSnapshot);
  syncDistrictV2TurnoutBaseline(formSnapshot, controlSnapshot);
  syncDistrictV2Ballot(ballotSnapshot, controlSnapshot);
  syncDistrictV2CandidateHistory(ballotSnapshot, controlSnapshot);
  syncDistrictV2Targeting(targetingConfigSnapshot, targetingResultsSnapshot);
  syncDistrictV2Census(censusConfigSnapshot, censusResultsSnapshot);
  syncDistrictV2Summary(snapshot, electionDataSummarySnapshot);
  syncDistrictV2RuntimeDebug(templateSnapshot, formSnapshot);

  syncDistrictV2CardStatus("v3DistrictV2RaceCardStatus", deriveDistrictRaceCardStatus({
    raceType: templateSnapshot?.raceType,
    electionDate: formSnapshot?.electionDate,
    mode: formSnapshot?.mode,
  }));

  syncDistrictV2CardStatus("v3DistrictV2ElectorateCardStatus", deriveDistrictElectorateCardStatus({
    universe: formSnapshot?.universeSize,
    basis: formSnapshot?.universeBasis,
    sourceNote: formSnapshot?.sourceNote,
  }));

  syncDistrictV2CardStatus("v3DistrictV2TurnoutBaselineCardStatus", deriveDistrictTurnoutBaselineCardStatus({
    turnoutA: formSnapshot?.turnoutA,
    turnoutB: formSnapshot?.turnoutB,
    bandWidth: formSnapshot?.bandWidth,
  }));

  syncDistrictV2CardStatus("v3DistrictV2BallotCardStatus", deriveDistrictBaselineCardStatus({
    warning: ballotSnapshot?.warningText,
    supportTotal: ballotSnapshot?.supportTotalText,
  }));

  const historyCount = Array.isArray(ballotSnapshot?.candidateHistoryRecords)
    ? ballotSnapshot.candidateHistoryRecords.length
    : 0;
  syncDistrictV2CardStatus("v3DistrictV2CandidateHistoryCardStatus", historyCount > 0 ? `${historyCount} row${historyCount === 1 ? "" : "s"}` : "No rows");

  const targetRows = Array.isArray(targetingResultsSnapshot?.rows)
    ? targetingResultsSnapshot.rows.length
    : 0;
  syncDistrictV2CardStatus("v3DistrictV2TargetingCardStatus", deriveDistrictTargetingCardStatus({
    status: targetingResultsSnapshot?.statusText,
    rowCount: targetRows,
  }));

  syncDistrictV2CardStatus("v3DistrictV2CensusCardStatus", deriveDistrictCensusCardStatus({
    status: censusResultsSnapshot?.statusText,
    geoStats: censusResultsSnapshot?.geoStatsText,
  }));

  syncDistrictV2CardStatus("v3DistrictV2SummaryCardStatus", deriveDistrictSummaryCardStatus(snapshot || {}));
  runDistrictV2BinderAuditSnapshot();
}

function handleDistrictV2MutationResult(result, source) {
  if (result && typeof result === "object" && result.ok === false) {
    const code = String(result.code || "unknown").trim();
    console.warn(`[district_v2] mutation rejected (${source}): ${code}`, result);
  }
  refreshDistrictV2Surface();
}

function syncDistrictV2BridgeAvailability(hasBridgeView) {
  const status = document.getElementById(DISTRICT_V2_BRIDGE_STATUS_ID);
  if (!(status instanceof HTMLElement)) {
    return;
  }
  status.hidden = hasBridgeView;
  status.textContent = hasBridgeView
    ? ""
    : "District bridge unavailable. District V2 controls are disabled until runtime bridge is ready.";
}

function isDistrictV2TraceEnabled() {
  try {
    const root = typeof window === "object" ? window : {};
    if (root && root[DISTRICT_V2_TRACE_FLAG_KEY] === false) {
      return false;
    }
    if (root && root[DISTRICT_V2_TRACE_FLAG_KEY] === true) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get("districtDomTrace") || "").trim().toLowerCase();
    if (token === "0" || token === "false" || token === "no") {
      return false;
    }
    if (token === "1" || token === "true" || token === "yes") {
      return true;
    }
    return true;
  } catch {
    return true;
  }
}

function districtV2NodeToken(node) {
  if (!(node instanceof HTMLElement)) {
    return "(missing)";
  }
  const cached = districtV2NodeTokens.get(node);
  if (typeof cached === "string" && cached.trim()) {
    return cached.trim();
  }
  districtV2NodeSequence += 1;
  const token = `node_${districtV2NodeSequence}`;
  districtV2NodeTokens.set(node, token);
  return token;
}

function readDistrictV2TraceSnapshot(controlId) {
  const control = document.getElementById(controlId);
  const templateSnapshot = readDistrictTemplateSnapshot();
  const formSnapshot = readDistrictFormSnapshot();
  const runtimeDiagnostics = readRuntimeDiagnosticsSnapshot();
  const canonicalRace = String(templateSnapshot?.raceType || "").trim();
  const canonicalElectionDate = String(formSnapshot?.electionDate || "").trim();
  const canonicalUniverse = Number.isFinite(Number(formSnapshot?.universeSize))
    ? Number(formSnapshot.universeSize)
    : null;
  const canonicalTurnoutA = Number.isFinite(Number(formSnapshot?.turnoutA))
    ? Number(formSnapshot.turnoutA)
    : null;
  const canonicalTurnoutB = Number.isFinite(Number(formSnapshot?.turnoutB))
    ? Number(formSnapshot.turnoutB)
    : null;
  const canonicalBandWidth = Number.isFinite(Number(formSnapshot?.bandWidth))
    ? Number(formSnapshot.bandWidth)
    : null;
  const canonicalC3 = readDistrictV2C3CanonicalByControlId(controlId);
  return {
    control,
    controlId,
    domValue: control instanceof HTMLInputElement || control instanceof HTMLSelectElement
      ? String(control.value || "").trim()
      : "",
    canonicalValue:
      controlId === "v3DistrictV2RaceType" ? canonicalRace
      : controlId === "v3DistrictV2ElectionDate" ? canonicalElectionDate
      : controlId === "v3DistrictV2UniverseSize" ? canonicalUniverse
      : controlId === "v3DistrictV2TurnoutA" ? canonicalTurnoutA
      : controlId === "v3DistrictV2TurnoutB" ? canonicalTurnoutB
      : controlId === "v3DistrictV2BandWidth" ? canonicalBandWidth
      : canonicalC3,
    persistedValue:
      controlId === "v3DistrictV2RaceType"
        ? String(runtimeDiagnostics?.district?.persisted?.raceTemplate || "").trim()
        : controlId === "v3DistrictV2UniverseSize"
          ? runtimeDiagnostics?.district?.persisted?.universeSize
          : null,
  };
}

function emitDistrictV2Trace(level, payload) {
  const row = payload && typeof payload === "object" ? payload : {};
  const line = `${DISTRICT_V2_TRACE_PREFIX} ${JSON.stringify(row)}`;
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

function isDistrictV2TraceAutoProbeEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get("districtDomTraceAuto") || "").trim().toLowerCase();
    return token === "1" || token === "true" || token === "yes";
  } catch {
    return false;
  }
}

function isDistrictV2BinderAuditEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get(DISTRICT_V2_BINDER_AUDIT_PARAM) || "").trim().toLowerCase();
    return token === "1" || token === "true" || token === "yes";
  } catch {
    return false;
  }
}

function isDistrictV2BinderAuditTarget(controlId) {
  return DISTRICT_V2_BINDER_AUDIT_TARGET_IDS.includes(String(controlId || "").trim());
}

function emitDistrictV2BinderAudit(payload) {
  if (!isDistrictV2BinderAuditEnabled()) {
    return;
  }
  const row = payload && typeof payload === "object" ? payload : {};
  const line = `${DISTRICT_V2_BINDER_AUDIT_PREFIX} ${JSON.stringify(row)}`;
  console.info(line);
}

function districtV2IdSelector(id) {
  const value = String(id || "").trim();
  if (!value) {
    return "";
  }
  try {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return `[id="${CSS.escape(value)}"]`;
    }
  } catch {}
  return `[id="${value.replace(/"/g, "\\\"")}"]`;
}

function findDistrictV2NodesById(id) {
  const selector = districtV2IdSelector(id);
  if (!selector) {
    return [];
  }
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function isDistrictV2NodeVisible(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  if (node.hidden || node.getAttribute("aria-hidden") === "true") {
    return false;
  }
  const hiddenAncestor = node.closest("[hidden],[aria-hidden='true']");
  return !(hiddenAncestor instanceof HTMLElement);
}

function readDistrictV2BinderCanonicalSnapshot(controlId) {
  const templateSnapshot = readDistrictTemplateSnapshot();
  const formSnapshot = readDistrictFormSnapshot();
  const canonicalRace = String(templateSnapshot?.raceType || "").trim();
  const canonicalFormRace = String(formSnapshot?.raceType || "").trim();
  if (controlId === "v3DistrictV2RaceType") {
    return {
      templateRaceType: canonicalRace,
      formRaceType: canonicalFormRace,
      effectiveRaceType: canonicalRace || canonicalFormRace,
    };
  }
  if (controlId === "v3DistrictV2ElectionDate") {
    return {
      electionDate: String(formSnapshot?.electionDate || "").trim(),
    };
  }
  if (controlId === "v3DistrictV2UniverseSize") {
    return {
      universeSize: Number.isFinite(Number(formSnapshot?.universeSize))
        ? Number(formSnapshot.universeSize)
        : null,
    };
  }
  return {};
}

function districtV2AttrSelector(attrName, attrValue) {
  const key = String(attrName || "").trim();
  const value = String(attrValue || "").trim();
  if (!key || !value) {
    return "";
  }
  try {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return `[${key}="${CSS.escape(value)}"]`;
    }
  } catch {}
  return `[${key}="${value.replace(/"/g, "\\\"")}"]`;
}

function readDistrictV2CandidateSupportCanonicalValue(candidateId) {
  const id = String(candidateId || "").trim();
  if (!id) {
    return null;
  }
  const ballot = readDistrictBallotSnapshot();
  const rows = Array.isArray(ballot?.candidates) ? ballot.candidates : [];
  const target = rows.find((row) => String(row?.id || "").trim() === id);
  return Number.isFinite(Number(target?.supportPct)) ? Number(target.supportPct) : null;
}

function readDistrictV2CandidateHistoryMarginCanonicalValue(recordId) {
  const id = String(recordId || "").trim();
  if (!id) {
    return null;
  }
  const ballot = readDistrictBallotSnapshot();
  const rows = Array.isArray(ballot?.candidateHistoryRecords) ? ballot.candidateHistoryRecords : [];
  const target = rows.find((row) => String(row?.recordId || "").trim() === id);
  return Number.isFinite(Number(target?.margin)) ? Number(target.margin) : null;
}

function readDistrictV2TargetingCanonicalValue(field) {
  const key = String(field || "").trim();
  if (!key) {
    return null;
  }
  const snapshot = readDistrictTargetingConfigSnapshot();
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  if (key in snapshot) {
    return snapshot[key];
  }
  return null;
}

function readDistrictV2CensusCanonicalValue(field) {
  const key = String(field || "").trim();
  if (!key) {
    return null;
  }
  const snapshot = readDistrictCensusConfigSnapshot();
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  if (key in snapshot) {
    return snapshot[key];
  }
  return null;
}

function readDistrictV2C3CanonicalByControlId(controlId) {
  const key = String(controlId || "").trim();
  if (key === "v3DistrictV2TargetingGeoLevel") {
    return readDistrictV2TargetingCanonicalValue("geoLevel");
  }
  if (key === "v3DistrictV2TargetingTopN") {
    return readDistrictV2TargetingCanonicalValue("topN");
  }
  if (key === "v3DistrictV2CensusResolution") {
    return readDistrictV2CensusCanonicalValue("resolution");
  }
  if (key === "v3DistrictV2CensusGeoSearch") {
    return readDistrictV2CensusCanonicalValue("geoSearch");
  }
  if (key === "v3DistrictV2TurnoutA") {
    return readDistrictFormSnapshot()?.turnoutA ?? null;
  }
  if (key === "v3DistrictV2TurnoutB") {
    return readDistrictFormSnapshot()?.turnoutB ?? null;
  }
  if (key === "v3DistrictV2BandWidth") {
    return readDistrictFormSnapshot()?.bandWidth ?? null;
  }
  return null;
}

function emitDistrictV2BinderLookup(controlId, field, control, status) {
  if (!isDistrictV2BinderAuditEnabled() || !isDistrictV2BinderAuditTarget(controlId)) {
    return;
  }
  const matches = findDistrictV2NodesById(controlId);
  const visibleMatches = matches.filter((node) => isDistrictV2NodeVisible(node));
  const matchedNodeTokens = matches.slice(0, 6).map((node) => districtV2NodeToken(node));
  const visibleNodeTokens = visibleMatches.slice(0, 6).map((node) => districtV2NodeToken(node));
  const currentNode = control instanceof HTMLElement ? control : null;
  const currentNodeIndex = currentNode ? matches.indexOf(currentNode) : -1;
  const attachCount = currentNode ? Number(districtV2BinderAttachCounts.get(currentNode) || 0) : 0;
  emitDistrictV2BinderAudit({
    eventType: "binder.lookup",
    status,
    controlId,
    field,
    lookupCount: matches.length,
    visibleCount: visibleMatches.length,
    hasDuplicateId: matches.length > 1,
    currentNodeToken: districtV2NodeToken(currentNode),
    currentNodeIndex,
    matchedNodeTokens,
    visibleNodeTokens,
    attachCount,
  });
}

function runDistrictV2BinderAuditSnapshot() {
  if (!isDistrictV2BinderAuditEnabled()) {
    return;
  }
  DISTRICT_V2_BINDER_AUDIT_TARGET_IDS.forEach((controlId) => {
    const control = document.getElementById(controlId);
    const matches = findDistrictV2NodesById(controlId);
    const visibleMatches = matches.filter((node) => isDistrictV2NodeVisible(node));
    emitDistrictV2BinderAudit({
      eventType: "binder.snapshot",
      controlId,
      getElementByIdToken: districtV2NodeToken(control),
      lookupCount: matches.length,
      visibleCount: visibleMatches.length,
      hasDuplicateId: matches.length > 1,
      canonical: readDistrictV2BinderCanonicalSnapshot(controlId),
    });
  });
}

function runDistrictV2TraceAutoProbe() {
  if (!isDistrictV2TraceEnabled() || !isDistrictV2TraceAutoProbeEnabled()) {
    return;
  }
  if (districtV2TraceAutoRan) {
    return;
  }
  const controls = [
    { id: "v3DistrictV2RaceType", type: "select" },
    { id: "v3DistrictV2ElectionDate", type: "date" },
    { id: "v3DistrictV2UniverseSize", type: "number" },
  ];
  const controlsReady = controls.every((entry) => {
    const node = document.getElementById(entry.id);
    if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) {
      return false;
    }
    if (entry.type === "select" && node instanceof HTMLSelectElement) {
      return node.options.length > 1;
    }
    return true;
  });
  if (!controlsReady) {
    if (districtV2TraceAutoAttempts >= DISTRICT_V2_TRACE_AUTO_MAX_ATTEMPTS) {
      emitDistrictV2Trace("warn", {
        eventType: "trace.auto.skipped",
        reason: "controls-not-ready",
        attempts: districtV2TraceAutoAttempts,
      });
      districtV2TraceAutoRan = true;
      return;
    }
    districtV2TraceAutoAttempts += 1;
    window.setTimeout(() => {
      runDistrictV2TraceAutoProbe();
    }, DISTRICT_V2_TRACE_AUTO_RETRY_MS);
    return;
  }
  districtV2TraceAutoRan = true;
  emitDistrictV2Trace("info", {
    eventType: "trace.auto.start",
    attempts: districtV2TraceAutoAttempts,
  });
  controls.forEach((entry) => {
    const node = document.getElementById(entry.id);
    if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) {
      return;
    }
    const beforeValue = String(node.value || "");
    let probeValue = beforeValue;
    if (entry.type === "select" && node instanceof HTMLSelectElement) {
      const choices = Array.from(node.options)
        .map((option) => String(option?.value || "").trim())
        .filter((value) => value.length > 0);
      const nextOption = choices.find((value) => value !== beforeValue) || beforeValue;
      probeValue = nextOption;
      node.value = probeValue;
    } else if (entry.type === "date" && node instanceof HTMLInputElement) {
      probeValue = beforeValue === "2030-11-05" ? "2032-11-02" : "2030-11-05";
      node.value = probeValue;
    } else if (entry.type === "number" && node instanceof HTMLInputElement) {
      const baseline = Number(node.value || 0);
      probeValue = String(Number.isFinite(baseline) ? baseline + 111 : 111);
      node.value = probeValue;
    }
    emitDistrictV2Trace("info", {
      eventType: "trace.auto.set",
      controlId: entry.id,
      beforeValue,
      probeValue,
    });
    if (typeof node.focus === "function") {
      node.focus();
    } else {
      node.dispatchEvent(new Event("focus", { bubbles: true }));
    }
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof node.blur === "function") {
      node.blur();
    } else {
      node.dispatchEvent(new Event("blur", { bubbles: true }));
    }
    window.setTimeout(() => {
      logDistrictV2ControlTrace("probe.post.120ms", entry.id, node);
    }, 120);
  });
  window.setTimeout(() => {
    runDistrictV2TraceAutoProbeC2();
  }, 80);
}

function runDistrictV2TraceAutoProbeC2(attempt = 0) {
  if (!isDistrictV2TraceEnabled() || !isDistrictV2TraceAutoProbeEnabled()) {
    return;
  }
  let candidateSupport = document.querySelector(
    '#v3DistrictV2CandTbody input[data-v3d2-candidate-field="supportPct"]',
  );
  let historyMargin = document.querySelector(
    '#v3DistrictV2CandidateHistoryTbody input[data-v3d2-history-field="margin"]',
  );

  if (!(candidateSupport instanceof HTMLInputElement)) {
    const addCandidateBtn = document.getElementById("v3BtnDistrictV2AddCandidate");
    if (
      addCandidateBtn instanceof HTMLButtonElement
      && !addCandidateBtn.disabled
      && addCandidateBtn.dataset.v3d2AutoTraceClick !== "1"
    ) {
      addCandidateBtn.dataset.v3d2AutoTraceClick = "1";
      addCandidateBtn.click();
      emitDistrictV2Trace("info", {
        eventType: "trace.auto.c2.add-candidate",
      });
      candidateSupport = document.querySelector(
        '#v3DistrictV2CandTbody input[data-v3d2-candidate-field="supportPct"]',
      );
    }
  }

  if (!(historyMargin instanceof HTMLInputElement)) {
    const addHistoryBtn = document.getElementById("v3BtnDistrictV2AddCandidateHistory");
    if (
      addHistoryBtn instanceof HTMLButtonElement
      && !addHistoryBtn.disabled
      && addHistoryBtn.dataset.v3d2AutoTraceClick !== "1"
    ) {
      addHistoryBtn.dataset.v3d2AutoTraceClick = "1";
      addHistoryBtn.click();
      emitDistrictV2Trace("info", {
        eventType: "trace.auto.c2.add-history",
      });
      historyMargin = document.querySelector(
        '#v3DistrictV2CandidateHistoryTbody input[data-v3d2-history-field="margin"]',
      );
    }
  }

  if (!(candidateSupport instanceof HTMLInputElement) || !(historyMargin instanceof HTMLInputElement)) {
    if (attempt >= DISTRICT_V2_TRACE_AUTO_MAX_ATTEMPTS) {
      emitDistrictV2Trace("warn", {
        eventType: "trace.auto.c2.skipped",
        reason: "controls-not-ready",
        attempts: attempt,
      });
      return;
    }
    window.setTimeout(() => {
      runDistrictV2TraceAutoProbeC2(attempt + 1);
    }, DISTRICT_V2_TRACE_AUTO_RETRY_MS);
    return;
  }

  probeDistrictV2CandidateSupportControl(candidateSupport);
  probeDistrictV2CandidateHistoryMarginControl(historyMargin);
  window.setTimeout(() => {
    runDistrictV2TraceAutoProbeC3();
  }, 80);
}

function runDistrictV2TraceAutoProbeC3(attempt = 0) {
  if (!isDistrictV2TraceEnabled() || !isDistrictV2TraceAutoProbeEnabled()) {
    return;
  }
  const controls = [
    { id: "v3DistrictV2CensusResolution", type: "select" },
    { id: "v3DistrictV2CensusGeoSearch", type: "text" },
    { id: "v3DistrictV2TargetingGeoLevel", type: "select" },
    { id: "v3DistrictV2TargetingTopN", type: "number" },
  ];
  const nodes = controls.map((entry) => {
    const control = document.getElementById(entry.id);
    return { ...entry, control };
  });
  const ready = nodes.every((entry) => {
    if (!(entry.control instanceof HTMLInputElement || entry.control instanceof HTMLSelectElement)) {
      return false;
    }
    if (entry.type !== "select" || !(entry.control instanceof HTMLSelectElement)) {
      return true;
    }
    const selectable = Array.from(entry.control.options).some((option) => String(option?.value || "").trim());
    return selectable;
  });
  if (!ready) {
    if (attempt >= DISTRICT_V2_TRACE_AUTO_MAX_ATTEMPTS) {
      emitDistrictV2Trace("warn", {
        eventType: "trace.auto.c3.skipped",
        reason: "controls-not-ready",
        attempts: attempt,
      });
      return;
    }
    window.setTimeout(() => {
      runDistrictV2TraceAutoProbeC3(attempt + 1);
    }, DISTRICT_V2_TRACE_AUTO_RETRY_MS);
    return;
  }
  nodes.forEach((entry) => {
    probeDistrictV2C3Control(entry.id, entry.type, entry.control);
  });
  window.setTimeout(() => {
    runDistrictV2TraceAutoProbeC8();
  }, 80);
}

function runDistrictV2TraceAutoProbeC8() {
  if (!isDistrictV2TraceEnabled() || !isDistrictV2TraceAutoProbeEnabled()) {
    return;
  }
  const controls = [
    { id: "v3DistrictV2TurnoutA", type: "number" },
    { id: "v3DistrictV2TurnoutB", type: "number" },
    { id: "v3DistrictV2BandWidth", type: "number" },
  ];
  controls.forEach((entry) => {
    const control = document.getElementById(entry.id);
    probeDistrictV2C3Control(entry.id, entry.type, control);
  });
}

function probeDistrictV2C3Control(controlId, type, control) {
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
    return;
  }
  const beforeDomValue = String(control.value || "");
  let probeValue = beforeDomValue;
  if (type === "select" && control instanceof HTMLSelectElement) {
    const choices = Array.from(control.options)
      .map((option) => String(option?.value || "").trim())
      .filter((value) => value.length > 0);
    probeValue = choices.find((value) => value !== beforeDomValue) || beforeDomValue;
  } else if (type === "number" && control instanceof HTMLInputElement) {
    const baseline = Number(control.value || 0);
    const nextValue = Number.isFinite(baseline) ? baseline + 3 : 3;
    probeValue = String(nextValue);
  } else if (type === "text" && control instanceof HTMLInputElement) {
    const baseText = String(control.value || "").trim();
    probeValue = baseText ? `${baseText}-c3` : "c3-geo-probe";
  }
  const referenceNode = control;
  emitDistrictV2Trace("info", {
    eventType: "trace.auto.c3.set",
    controlId,
    beforeDomValue,
    probeValue,
    canonicalBefore: readDistrictV2C3CanonicalByControlId(controlId),
  });
  if (typeof control.focus === "function") {
    control.focus();
  }
  control.value = probeValue;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  if (typeof control.blur === "function") {
    control.blur();
  }
  window.setTimeout(() => {
    const currentNode = document.getElementById(controlId);
    const currentControl = currentNode instanceof HTMLInputElement || currentNode instanceof HTMLSelectElement
      ? currentNode
      : null;
    emitDistrictV2Trace("info", {
      eventType: "trace.auto.c3.post",
      controlId,
      referenceNodeToken: districtV2NodeToken(referenceNode),
      nodeToken: districtV2NodeToken(currentControl),
      replacedSinceReference: currentControl !== referenceNode,
      domValue: currentControl ? String(currentControl.value || "") : "",
      canonicalValue: readDistrictV2C3CanonicalByControlId(controlId),
    });
  }, 140);
}

function probeDistrictV2CandidateSupportControl(control) {
  if (!(control instanceof HTMLInputElement)) {
    return;
  }
  const candidateId = String(control.dataset.v3d2CandidateId || "").trim();
  if (!candidateId) {
    return;
  }
  const baseline = Number(control.value || 0);
  const probeValue = String(Number.isFinite(baseline) ? baseline + 7.5 : 7.5);
  const referenceNode = control;
  const beforeCanonical = readDistrictV2CandidateSupportCanonicalValue(candidateId);
  emitDistrictV2Trace("info", {
    eventType: "trace.auto.c2.set",
    controlType: "ballot.supportPct",
    candidateId,
    beforeDomValue: String(control.value || ""),
    probeValue,
    beforeCanonical,
  });
  if (typeof control.focus === "function") {
    control.focus();
  }
  control.value = probeValue;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  if (typeof control.blur === "function") {
    control.blur();
  }
  window.setTimeout(() => {
    const selectorA = districtV2AttrSelector("data-v3d2-candidate-id", candidateId);
    const selectorB = districtV2AttrSelector("data-v3d2-candidate-field", "supportPct");
    const selector = selectorA && selectorB ? `#v3DistrictV2CandTbody input${selectorA}${selectorB}` : "";
    const currentNode = selector ? document.querySelector(selector) : null;
    const currentInput = currentNode instanceof HTMLInputElement ? currentNode : null;
    emitDistrictV2Trace("info", {
      eventType: "trace.auto.c2.post",
      controlType: "ballot.supportPct",
      candidateId,
      referenceNodeToken: districtV2NodeToken(referenceNode),
      nodeToken: districtV2NodeToken(currentInput),
      replacedSinceReference: currentInput !== referenceNode,
      domValue: currentInput ? String(currentInput.value || "") : "",
      canonicalValue: readDistrictV2CandidateSupportCanonicalValue(candidateId),
    });
  }, 140);
}

function probeDistrictV2CandidateHistoryMarginControl(control) {
  if (!(control instanceof HTMLInputElement)) {
    return;
  }
  const recordId = String(control.dataset.v3d2HistoryId || "").trim();
  if (!recordId) {
    return;
  }
  const baseline = Number(control.value || 0);
  const probeValue = String(Number.isFinite(baseline) ? baseline + 2.4 : 2.4);
  const referenceNode = control;
  const beforeCanonical = readDistrictV2CandidateHistoryMarginCanonicalValue(recordId);
  emitDistrictV2Trace("info", {
    eventType: "trace.auto.c2.set",
    controlType: "candidateHistory.margin",
    recordId,
    beforeDomValue: String(control.value || ""),
    probeValue,
    beforeCanonical,
  });
  if (typeof control.focus === "function") {
    control.focus();
  }
  control.value = probeValue;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  if (typeof control.blur === "function") {
    control.blur();
  }
  window.setTimeout(() => {
    const selectorA = districtV2AttrSelector("data-v3d2-history-id", recordId);
    const selectorB = districtV2AttrSelector("data-v3d2-history-field", "margin");
    const selector = selectorA && selectorB ? `#v3DistrictV2CandidateHistoryTbody input${selectorA}${selectorB}` : "";
    const currentNode = selector ? document.querySelector(selector) : null;
    const currentInput = currentNode instanceof HTMLInputElement ? currentNode : null;
    emitDistrictV2Trace("info", {
      eventType: "trace.auto.c2.post",
      controlType: "candidateHistory.margin",
      recordId,
      referenceNodeToken: districtV2NodeToken(referenceNode),
      nodeToken: districtV2NodeToken(currentInput),
      replacedSinceReference: currentInput !== referenceNode,
      domValue: currentInput ? String(currentInput.value || "") : "",
      canonicalValue: readDistrictV2CandidateHistoryMarginCanonicalValue(recordId),
    });
  }, 140);
}

function logDistrictV2ControlTrace(eventType, controlId, referenceNode = null) {
  if (!isDistrictV2TraceEnabled()) {
    return;
  }
  const snapshot = readDistrictV2TraceSnapshot(controlId);
  const currentNode = snapshot.control;
  const replaced = referenceNode instanceof HTMLElement
    ? currentNode !== referenceNode
    : false;
  emitDistrictV2Trace("info", {
    eventType,
    controlId,
    nodeToken: districtV2NodeToken(currentNode),
    replacedSinceReference: replaced,
    referenceNodeToken: referenceNode instanceof HTMLElement ? districtV2NodeToken(referenceNode) : "",
    domValue: snapshot.domValue,
    canonicalValue: snapshot.canonicalValue,
    persistedValue: snapshot.persistedValue,
  });
}

function bindDistrictV2ControlLifecycleTrace(controlId) {
  const control = document.getElementById(controlId);
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
    return;
  }
  if (control.dataset.v3DistrictV2DomTraceBound === "1") {
    return;
  }
  control.dataset.v3DistrictV2DomTraceBound = "1";

  control.addEventListener("focus", () => {
    logDistrictV2ControlTrace("focus", controlId);
  });
  control.addEventListener("input", () => {
    logDistrictV2ControlTrace("input", controlId);
  });
  control.addEventListener("change", () => {
    logDistrictV2ControlTrace("change", controlId);
  });
  control.addEventListener("blur", (event) => {
    const target = event?.target;
    const beforeNode = target instanceof HTMLElement ? target : null;
    logDistrictV2ControlTrace("blur.before", controlId, beforeNode);
    queueMicrotask(() => {
      logDistrictV2ControlTrace("blur.after.microtask", controlId, beforeNode);
    });
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        logDistrictV2ControlTrace("blur.after.raf", controlId, beforeNode);
      });
    }
  });
}

function clearDistrictV2TraceObservers() {
  if (!districtV2TraceObservers.length) {
    return;
  }
  districtV2TraceObservers.forEach((observer) => {
    try {
      observer.disconnect();
    } catch {}
  });
  districtV2TraceObservers = [];
}

function installDistrictV2MutationTrace(scope, rootId) {
  const root = document.getElementById(rootId);
  if (!(root instanceof HTMLElement)) {
    return;
  }
  const observer = new MutationObserver((mutations) => {
    if (!isDistrictV2TraceEnabled()) {
      return;
    }
    mutations.forEach((mutation) => {
      const added = Array.from(mutation.addedNodes || [])
        .filter((node) => node instanceof HTMLElement)
        .map((node) => node.id || node.nodeName);
      const removed = Array.from(mutation.removedNodes || [])
        .filter((node) => node instanceof HTMLElement)
        .map((node) => node.id || node.nodeName);
      if (!added.length && !removed.length) {
        return;
      }
      emitDistrictV2Trace("warn", {
        eventType: "mutation",
        scope,
        rootId,
        targetId: mutation.target instanceof HTMLElement ? mutation.target.id : "",
        added,
        removed,
      });
    });
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
  });
  districtV2TraceObservers.push(observer);
}

function installDistrictV2DomLifecycleTrace() {
  if (!isDistrictV2TraceEnabled()) {
    clearDistrictV2TraceObservers();
    districtV2TraceInstalled = false;
    districtV2TraceRaceRoot = null;
    districtV2TraceElectorateRoot = null;
    districtV2TraceTurnoutRoot = null;
    districtV2TraceBallotRoot = null;
    districtV2TraceCandidateHistoryRoot = null;
    districtV2TraceTargetingRoot = null;
    districtV2TraceCensusRoot = null;
    return;
  }
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2RaceType");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2ElectionDate");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2UniverseSize");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2TurnoutA");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2TurnoutB");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2BandWidth");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2UndecidedPct");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2CensusResolution");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2CensusGeoSearch");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2TargetingGeoLevel");
  bindDistrictV2ControlLifecycleTrace("v3DistrictV2TargetingTopN");
  const raceRoot = document.getElementById(DISTRICT_V2_CARD_ID_BY_SCOPE.raceContext);
  const electorateRoot = document.getElementById(DISTRICT_V2_CARD_ID_BY_SCOPE.electorate);
  const turnoutRoot = document.getElementById(DISTRICT_V2_CARD_ID_BY_SCOPE.turnoutBaseline);
  const ballotRoot = document.getElementById(DISTRICT_V2_CARD_ID_BY_SCOPE.ballot);
  const candidateHistoryRoot = document.getElementById(DISTRICT_V2_CARD_ID_BY_SCOPE.candidateHistory);
  const targetingRoot = document.getElementById(DISTRICT_V2_CARD_ID_BY_SCOPE.targeting);
  const censusRoot = document.getElementById(DISTRICT_V2_CARD_ID_BY_SCOPE.census);
  const shouldReinstallObservers = !districtV2TraceInstalled
    || raceRoot !== districtV2TraceRaceRoot
    || electorateRoot !== districtV2TraceElectorateRoot
    || turnoutRoot !== districtV2TraceTurnoutRoot
    || ballotRoot !== districtV2TraceBallotRoot
    || candidateHistoryRoot !== districtV2TraceCandidateHistoryRoot
    || targetingRoot !== districtV2TraceTargetingRoot
    || censusRoot !== districtV2TraceCensusRoot;
  if (!shouldReinstallObservers) {
    return;
  }
  clearDistrictV2TraceObservers();
  installDistrictV2MutationTrace("raceContext", DISTRICT_V2_CARD_ID_BY_SCOPE.raceContext);
  installDistrictV2MutationTrace("electorate", DISTRICT_V2_CARD_ID_BY_SCOPE.electorate);
  installDistrictV2MutationTrace("turnoutBaseline", DISTRICT_V2_CARD_ID_BY_SCOPE.turnoutBaseline);
  installDistrictV2MutationTrace("ballot", DISTRICT_V2_CARD_ID_BY_SCOPE.ballot);
  installDistrictV2MutationTrace("candidateHistory", DISTRICT_V2_CARD_ID_BY_SCOPE.candidateHistory);
  installDistrictV2MutationTrace("targeting", DISTRICT_V2_CARD_ID_BY_SCOPE.targeting);
  installDistrictV2MutationTrace("census", DISTRICT_V2_CARD_ID_BY_SCOPE.census);
  districtV2TraceInstalled = true;
  districtV2TraceRaceRoot = raceRoot instanceof HTMLElement ? raceRoot : null;
  districtV2TraceElectorateRoot = electorateRoot instanceof HTMLElement ? electorateRoot : null;
  districtV2TraceTurnoutRoot = turnoutRoot instanceof HTMLElement ? turnoutRoot : null;
  districtV2TraceBallotRoot = ballotRoot instanceof HTMLElement ? ballotRoot : null;
  districtV2TraceCandidateHistoryRoot = candidateHistoryRoot instanceof HTMLElement ? candidateHistoryRoot : null;
  districtV2TraceTargetingRoot = targetingRoot instanceof HTMLElement ? targetingRoot : null;
  districtV2TraceCensusRoot = censusRoot instanceof HTMLElement ? censusRoot : null;
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2RaceType");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2ElectionDate");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2UniverseSize");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2TurnoutA");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2TurnoutB");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2BandWidth");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2UndecidedPct");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2CensusResolution");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2CensusGeoSearch");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2TargetingGeoLevel");
  logDistrictV2ControlTrace("trace.init", "v3DistrictV2TargetingTopN");
  runDistrictV2TraceAutoProbe();
}

function setInnerHtmlWithTrace(node, html, source) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (isDistrictV2TraceEnabled()) {
    emitDistrictV2Trace("warn", {
      eventType: "innerHTML.replace",
      source,
      targetId: node.id || "",
      nodeToken: districtV2NodeToken(node),
    });
  }
  node.innerHTML = html;
}

function syncDistrictV2RuntimeDebug(templateSnapshot, formSnapshot) {
  const pre = document.getElementById(DISTRICT_V2_RUNTIME_DEBUG_BODY_ID);
  if (!(pre instanceof HTMLElement)) {
    return;
  }
  const raceDomControl = document.getElementById("v3DistrictV2RaceType");
  const universeDomControl = document.getElementById("v3DistrictV2UniverseSize");
  const raceDomValue = raceDomControl instanceof HTMLSelectElement || raceDomControl instanceof HTMLInputElement
    ? String(raceDomControl.value || "").trim()
    : "";
  const universeDomValue = universeDomControl instanceof HTMLInputElement
    ? String(universeDomControl.value || "").trim()
    : "";
  const runtimeDiagnostics = readRuntimeDiagnosticsSnapshot();
  const persistedRaceTemplate = String(runtimeDiagnostics?.district?.persisted?.raceTemplate || "").trim();
  const persistedUniverseSize = runtimeDiagnostics?.district?.persisted?.universeSize;
  const persistedSchemaVersion = runtimeDiagnostics?.persisted?.schemaVersion;
  const canonicalRaceTemplate = String(templateSnapshot?.raceType || "").trim();
  const canonicalUniverseSize = Number.isFinite(Number(formSnapshot?.universeSize))
    ? Number(formSnapshot.universeSize)
    : null;
  const lines = [
    `raceTemplate dom=${raceDomValue || "(empty)"} canonical=${canonicalRaceTemplate || "(empty)"} persisted=${persistedRaceTemplate || "(empty)"}`,
    `universeSize dom=${universeDomValue || "(empty)"} canonical=${canonicalUniverseSize == null ? "(empty)" : String(canonicalUniverseSize)} persisted=${persistedUniverseSize == null ? "(empty)" : String(persistedUniverseSize)}`,
    `persistedSchemaVersion=${persistedSchemaVersion == null ? "(empty)" : String(persistedSchemaVersion)}`,
    `runtimeBuild=${String(runtimeDiagnostics?.buildId || "").trim() || "unknown"}`,
  ];
  pre.textContent = lines.join("\n");
}

function syncDistrictV2RaceContext(templateSnapshot, formSnapshot, controlSnapshot) {
  const template = templateSnapshot && typeof templateSnapshot === "object" ? templateSnapshot : {};
  const form = formSnapshot && typeof formSnapshot === "object" ? formSnapshot : {};

  syncSelectOptions("v3DistrictV2RaceType", listDistrictRaceTypeOptions(), template.raceType || form.raceType || "");
  syncInputValueFromRaw("v3DistrictV2ElectionDate", form.electionDate);
  syncInputValueFromRaw("v3DistrictV2WeeksRemaining", form.weeksRemaining);
  syncSelectOptions("v3DistrictV2Mode", listDistrictModeOptions(), form.mode);

  syncSelectOptions("v3DistrictV2OfficeLevel", listTemplateDimensionOptions("officeLevel"), template.officeLevel);
  syncSelectOptions("v3DistrictV2ElectionType", listTemplateDimensionOptions("electionType"), template.electionType);
  syncSelectOptions("v3DistrictV2SeatContext", listTemplateDimensionOptions("seatContext"), template.seatContext);
  syncSelectOptions("v3DistrictV2PartisanshipMode", listTemplateDimensionOptions("partisanshipMode"), template.partisanshipMode);
  syncSelectOptions("v3DistrictV2SalienceLevel", listTemplateDimensionOptions("salienceLevel"), template.salienceLevel);

  const templateMeta = [
    template.appliedTemplateId ? `template ${template.appliedTemplateId}` : "",
    template.appliedVersion ? `v${template.appliedVersion}` : "",
    template.assumptionsProfile ? `profile ${template.assumptionsProfile}` : "",
  ].filter(Boolean).join(" · ");
  setText("v3DistrictV2TemplateMeta", templateMeta || "Template profile unavailable.");

  const locked = !!controlSnapshot?.locked;
  const disabledMap = controlSnapshot?.disabledMap && typeof controlSnapshot.disabledMap === "object"
    ? controlSnapshot.disabledMap
    : {};

  applyDisabled("v3DistrictV2RaceType", locked || !!disabledMap.raceType);
  applyDisabled("v3DistrictV2ElectionDate", locked || !!disabledMap.electionDate);
  applyDisabled("v3DistrictV2WeeksRemaining", locked || !!disabledMap.weeksRemaining);
  applyDisabled("v3DistrictV2Mode", locked || !!disabledMap.mode);
  applyDisabled("v3DistrictV2OfficeLevel", locked || !!disabledMap.officeLevel);
  applyDisabled("v3DistrictV2ElectionType", locked || !!disabledMap.electionType);
  applyDisabled("v3DistrictV2SeatContext", locked || !!disabledMap.seatContext);
  applyDisabled("v3DistrictV2PartisanshipMode", locked || !!disabledMap.partisanshipMode);
  applyDisabled("v3DistrictV2SalienceLevel", locked || !!disabledMap.salienceLevel);
  applyDisabled("v3BtnDistrictV2ApplyTemplateDefaults", locked);
}

function syncDistrictV2Electorate(formSnapshot, controlSnapshot) {
  const form = formSnapshot && typeof formSnapshot === "object" ? formSnapshot : {};

  syncInputValueFromRaw("v3DistrictV2UniverseSize", form.universeSize);
  syncSelectOptions("v3DistrictV2UniverseBasis", listDistrictUniverseBasisOptions(), form.universeBasis);
  syncInputValueFromRaw("v3DistrictV2SourceNote", form.sourceNote);
  syncCheckboxCheckedFromRaw("v3DistrictV2Universe16Enabled", form.universe16Enabled);
  syncInputValueFromRaw("v3DistrictV2UniverseDemPct", form.universe16DemPct);
  syncInputValueFromRaw("v3DistrictV2UniverseRepPct", form.universe16RepPct);
  syncInputValueFromRaw("v3DistrictV2UniverseNpaPct", form.universe16NpaPct);
  syncInputValueFromRaw("v3DistrictV2UniverseOtherPct", form.universe16OtherPct);
  syncInputValueFromRaw("v3DistrictV2RetentionFactor", form.retentionFactor);

  const locked = !!controlSnapshot?.locked;
  const disabledMap = controlSnapshot?.disabledMap && typeof controlSnapshot.disabledMap === "object"
    ? controlSnapshot.disabledMap
    : {};
  applyDisabled("v3DistrictV2UniverseSize", locked || !!disabledMap.universeSize);
  applyDisabled("v3DistrictV2UniverseBasis", locked || !!disabledMap.universeBasis);
  applyDisabled("v3DistrictV2SourceNote", locked || !!disabledMap.sourceNote);
  applyDisabled("v3DistrictV2Universe16Enabled", locked || !!disabledMap.universe16Enabled);
  applyDisabled("v3DistrictV2UniverseDemPct", locked || !!disabledMap.universe16DemPct);
  applyDisabled("v3DistrictV2UniverseRepPct", locked || !!disabledMap.universe16RepPct);
  applyDisabled("v3DistrictV2UniverseNpaPct", locked || !!disabledMap.universe16NpaPct);
  applyDisabled("v3DistrictV2UniverseOtherPct", locked || !!disabledMap.universe16OtherPct);
  applyDisabled("v3DistrictV2RetentionFactor", locked || !!disabledMap.retentionFactor);
}

function syncDistrictV2TurnoutBaseline(formSnapshot, controlSnapshot) {
  const form = formSnapshot && typeof formSnapshot === "object" ? formSnapshot : {};
  syncInputValueFromRaw("v3DistrictV2TurnoutA", form.turnoutA);
  syncInputValueFromRaw("v3DistrictV2TurnoutB", form.turnoutB);
  syncInputValueFromRaw("v3DistrictV2BandWidth", form.bandWidth);

  const locked = !!controlSnapshot?.locked;
  const disabledMap = controlSnapshot?.disabledMap && typeof controlSnapshot.disabledMap === "object"
    ? controlSnapshot.disabledMap
    : {};
  const turnoutADisabled = locked || !!disabledMap.turnoutA || !!disabledMap.v3DistrictTurnoutA;
  const turnoutBDisabled = locked || !!disabledMap.turnoutB || !!disabledMap.v3DistrictTurnoutB;
  const bandWidthDisabled = locked || !!disabledMap.bandWidth || !!disabledMap.v3DistrictBandWidth;
  applyDisabled("v3DistrictV2TurnoutA", turnoutADisabled);
  applyDisabled("v3DistrictV2TurnoutB", turnoutBDisabled);
  applyDisabled("v3DistrictV2BandWidth", bandWidthDisabled);
}

function syncDistrictV2Ballot(ballotSnapshot, controlSnapshot) {
  const ballot = ballotSnapshot && typeof ballotSnapshot === "object" ? ballotSnapshot : {};
  const candidates = Array.isArray(ballot.candidates) ? ballot.candidates : [];

  syncSelectOptions(
    "v3DistrictV2YourCandidate",
    candidates.map((row) => ({ value: String(row.id || ""), label: String(row.name || row.id || "").trim() || String(row.id || "") })),
    ballot.yourCandidateId,
    { placeholder: "Select candidate" },
  );
  syncInputValueFromRaw("v3DistrictV2UndecidedPct", ballot.undecidedPct);
  syncSelectOptions("v3DistrictV2UndecidedMode", listDistrictUndecidedModeOptions(), ballot.undecidedMode);

  setText("v3DistrictV2SupportTotal", String(ballot.supportTotalText || "—") || "—");

  const warning = String(ballot.warningText || "").trim();
  const warningEl = document.getElementById("v3DistrictV2CandWarn");
  if (warningEl instanceof HTMLElement) {
    warningEl.hidden = !warning;
    warningEl.textContent = warning;
  }

  syncDistrictV2CandidateTable(ballot, controlSnapshot);
  syncDistrictV2UserSplitTable(ballot, controlSnapshot);

  const locked = !!controlSnapshot?.locked;
  applyDisabled("v3DistrictV2YourCandidate", locked);
  applyDisabled("v3DistrictV2UndecidedPct", locked);
  applyDisabled("v3DistrictV2UndecidedMode", locked);
  applyDisabled("v3BtnDistrictV2AddCandidate", locked);
}

function syncDistrictV2CandidateTable(ballotSnapshot, controlSnapshot) {
  const tbody = document.getElementById("v3DistrictV2CandTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  const candidates = Array.isArray(ballotSnapshot?.candidates) ? ballotSnapshot.candidates : [];
  const locked = !!controlSnapshot?.locked;
  const structureSignature = candidates
    .map((row) => String(row?.id || "").trim())
    .filter(Boolean)
    .join("|");
  const previousSignature = String(tbody.dataset.v3d2StructureSignature || "");

  if (!candidates.length) {
    if (previousSignature !== "") {
      setInnerHtmlWithTrace(tbody, `<tr><td class="muted" colspan="3">No candidates yet.</td></tr>`, "syncDistrictV2CandidateTable:empty");
      tbody.dataset.v3d2StructureSignature = "";
    }
    return;
  }

  if (previousSignature !== structureSignature) {
    // Structural rerender is allowed only when row membership changes.
    setInnerHtmlWithTrace(tbody, candidates.map((row) => {
      const candidateId = escapeHtml(String(row?.id || ""));
      const name = escapeHtml(String(row?.name || ""));
      const support = row?.supportPct == null ? "" : escapeHtml(String(row.supportPct));
      const canRemove = !locked && !!row?.canRemove;
      return `
        <tr data-candidate-id="${candidateId}">
          <td>
            <input class="fpe-input" data-v3d2-candidate-id="${candidateId}" data-v3d2-candidate-field="name" type="text" value="${name}" ${locked ? "disabled" : ""}/>
          </td>
          <td class="num">
            <input class="fpe-input" data-v3d2-candidate-id="${candidateId}" data-v3d2-candidate-field="supportPct" max="100" min="0" step="0.1" type="number" value="${support}" ${locked ? "disabled" : ""}/>
          </td>
          <td>
            ${canRemove ? `<button class="fpe-btn fpe-btn--ghost" data-v3d2-remove-candidate="${candidateId}" type="button">Remove</button>` : ""}
          </td>
        </tr>
      `;
    }).join(""), "syncDistrictV2CandidateTable:rows");
    tbody.dataset.v3d2StructureSignature = structureSignature;
    return;
  }

  const rowMap = new Map();
  Array.from(tbody.querySelectorAll("tr[data-candidate-id]")).forEach((row) => {
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const candidateId = String(row.dataset.candidateId || "").trim();
    if (!candidateId) {
      return;
    }
    rowMap.set(candidateId, row);
  });

  candidates.forEach((row) => {
    const candidateId = String(row?.id || "").trim();
    if (!candidateId) {
      return;
    }
    const tr = rowMap.get(candidateId);
    if (!(tr instanceof HTMLTableRowElement)) {
      return;
    }
    syncInputControlInPlace(tr.querySelector('input[data-v3d2-candidate-field="name"]'), row?.name);
    syncInputControlInPlace(tr.querySelector('input[data-v3d2-candidate-field="supportPct"]'), row?.supportPct);
    applyDisabledToControl(tr.querySelector('input[data-v3d2-candidate-field="name"]'), locked);
    applyDisabledToControl(tr.querySelector('input[data-v3d2-candidate-field="supportPct"]'), locked);

    const actionCell = tr.cells[2];
    if (!(actionCell instanceof HTMLElement)) {
      return;
    }
    const canRemove = !locked && !!row?.canRemove;
    const existingButton = actionCell.querySelector("button[data-v3d2-remove-candidate]");
    if (!canRemove) {
      if (existingButton instanceof HTMLButtonElement) {
        existingButton.remove();
      }
      return;
    }
    if (existingButton instanceof HTMLButtonElement) {
      existingButton.disabled = false;
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fpe-btn fpe-btn--ghost";
    button.dataset.v3d2RemoveCandidate = candidateId;
    button.textContent = "Remove";
    actionCell.append(button);
  });
}

function syncDistrictV2UserSplitTable(ballotSnapshot, controlSnapshot) {
  const wrap = document.getElementById("v3DistrictV2UserSplitWrap");
  const list = document.getElementById("v3DistrictV2UserSplitList");
  if (!(wrap instanceof HTMLElement) || !(list instanceof HTMLElement)) {
    return;
  }

  const rows = Array.isArray(ballotSnapshot?.userSplitRows) ? ballotSnapshot.userSplitRows : [];
  const visible = !!ballotSnapshot?.userSplitVisible;
  wrap.hidden = !visible;
  if (!visible) {
    if ((list.dataset.v3d2StructureSignature || "") !== "") {
      setInnerHtmlWithTrace(list, "", "syncDistrictV2UserSplitTable:clear");
      list.dataset.v3d2StructureSignature = "";
    }
    return;
  }

  const structureSignature = rows
    .map((row) => String(row?.id || "").trim())
    .filter(Boolean)
    .join("|");
  const previousSignature = String(list.dataset.v3d2StructureSignature || "");
  const locked = !!controlSnapshot?.locked;
  if (previousSignature !== structureSignature) {
    // Structural rerender is allowed only when row membership changes.
    setInnerHtmlWithTrace(list, rows.map((row) => {
      const candidateId = escapeHtml(String(row?.id || ""));
      const label = escapeHtml(String(row?.name || row?.id || ""));
      const value = row?.value == null ? "" : escapeHtml(String(row.value));
      return `
        <div class="field" data-v3d2-user-split-row="${candidateId}">
          <label class="fpe-control-label" for="v3DistrictV2UserSplit_${candidateId}">${label}</label>
          <input class="fpe-input" data-v3d2-user-split-id="${candidateId}" id="v3DistrictV2UserSplit_${candidateId}" max="100" min="0" step="0.1" type="number" value="${value}" ${locked ? "disabled" : ""}/>
        </div>
      `;
    }).join(""), "syncDistrictV2UserSplitTable:rows");
    list.dataset.v3d2StructureSignature = structureSignature;
    return;
  }

  const rowMap = new Map();
  Array.from(list.querySelectorAll("[data-v3d2-user-split-row]")).forEach((rowEl) => {
    if (!(rowEl instanceof HTMLElement)) {
      return;
    }
    const candidateId = String(rowEl.dataset.v3d2UserSplitRow || "").trim();
    if (!candidateId) {
      return;
    }
    rowMap.set(candidateId, rowEl);
  });
  rows.forEach((row) => {
    const candidateId = String(row?.id || "").trim();
    if (!candidateId) {
      return;
    }
    const rowEl = rowMap.get(candidateId);
    if (!(rowEl instanceof HTMLElement)) {
      return;
    }
    const label = rowEl.querySelector("label");
    if (label instanceof HTMLElement) {
      label.textContent = String(row?.name || row?.id || "");
    }
    const input = rowEl.querySelector('input[data-v3d2-user-split-id]');
    syncInputControlInPlace(input, row?.value);
    applyDisabledToControl(input, locked);
  });
}

function syncDistrictV2CandidateHistory(ballotSnapshot, controlSnapshot) {
  const tbody = document.getElementById("v3DistrictV2CandidateHistoryTbody");
  const summary = document.getElementById("v3DistrictV2CandidateHistorySummary");
  const warn = document.getElementById("v3DistrictV2CandidateHistoryWarn");

  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  const rows = Array.isArray(ballotSnapshot?.candidateHistoryRecords)
    ? ballotSnapshot.candidateHistoryRecords
    : [];
  const electionTypeOptions = normalizeSnapshotOptions(ballotSnapshot?.candidateHistoryOptions?.electionType);
  const incumbencyOptions = normalizeSnapshotOptions(ballotSnapshot?.candidateHistoryOptions?.incumbencyStatus);
  const locked = !!controlSnapshot?.locked;
  const structureSignature = rows
    .map((row) => String(row?.recordId || "").trim())
    .filter(Boolean)
    .join("|");
  const previousSignature = String(tbody.dataset.v3d2StructureSignature || "");

  if (!rows.length) {
    if (previousSignature !== "") {
      setInnerHtmlWithTrace(tbody, `<tr><td class="muted" colspan="12">No candidate history rows.</td></tr>`, "syncDistrictV2CandidateHistory:empty");
      tbody.dataset.v3d2StructureSignature = "";
    }
  } else {
    if (previousSignature !== structureSignature) {
      // Structural rerender is allowed only when row membership changes.
      setInnerHtmlWithTrace(tbody, rows.map((row) => {
        const recordId = escapeHtml(String(row?.recordId || ""));
        return `
          <tr data-record-id="${recordId}">
            <td><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="office" type="text" value="${escapeHtml(String(row?.office || ""))}" ${locked ? "disabled" : ""}/></td>
            <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="cycleYear" min="1900" step="1" type="number" value="${row?.cycleYear == null ? "" : escapeHtml(String(row.cycleYear))}" ${locked ? "disabled" : ""}/></td>
            <td>${buildSelect("history-election", recordId, "electionType", electionTypeOptions, row?.electionType, locked)}</td>
            <td><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="candidateName" type="text" value="${escapeHtml(String(row?.candidateName || ""))}" ${locked ? "disabled" : ""}/></td>
            <td><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="party" type="text" value="${escapeHtml(String(row?.party || ""))}" ${locked ? "disabled" : ""}/></td>
            <td>${buildSelect("history-incumbency", recordId, "incumbencyStatus", incumbencyOptions, row?.incumbencyStatus, locked)}</td>
            <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="voteShare" max="100" min="0" step="0.1" type="number" value="${row?.voteShare == null ? "" : escapeHtml(String(row.voteShare))}" ${locked ? "disabled" : ""}/></td>
            <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="margin" step="0.1" type="number" value="${row?.margin == null ? "" : escapeHtml(String(row.margin))}" ${locked ? "disabled" : ""}/></td>
            <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="turnoutContext" max="100" min="0" step="0.1" type="number" value="${row?.turnoutContext == null ? "" : escapeHtml(String(row.turnoutContext))}" ${locked ? "disabled" : ""}/></td>
            <td class="num"><input data-v3d2-history-id="${recordId}" data-v3d2-history-field="repeatCandidate" type="checkbox" ${row?.repeatCandidate ? "checked" : ""} ${locked ? "disabled" : ""}/></td>
            <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="overUnderPerformancePct" step="0.1" type="number" value="${row?.overUnderPerformancePct == null ? "" : escapeHtml(String(row.overUnderPerformancePct))}" ${locked ? "disabled" : ""}/></td>
            <td>${locked ? "" : `<button class="fpe-btn fpe-btn--ghost" data-v3d2-remove-history="${recordId}" type="button">Remove</button>`}</td>
          </tr>
        `;
      }).join(""), "syncDistrictV2CandidateHistory:rows");
      tbody.dataset.v3d2StructureSignature = structureSignature;
    } else {
      const rowMap = new Map();
      Array.from(tbody.querySelectorAll("tr[data-record-id]")).forEach((tr) => {
        if (!(tr instanceof HTMLTableRowElement)) {
          return;
        }
        const recordId = String(tr.dataset.recordId || "").trim();
        if (!recordId) {
          return;
        }
        rowMap.set(recordId, tr);
      });
      rows.forEach((row) => {
        const recordId = String(row?.recordId || "").trim();
        if (!recordId) {
          return;
        }
        const tr = rowMap.get(recordId);
        if (!(tr instanceof HTMLTableRowElement)) {
          return;
        }
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="office"]'), row?.office);
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="cycleYear"]'), row?.cycleYear);
        syncSelectControlInPlace(
          tr.querySelector('select[data-v3d2-history-field="electionType"]'),
          electionTypeOptions,
          row?.electionType,
        );
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="candidateName"]'), row?.candidateName);
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="party"]'), row?.party);
        syncSelectControlInPlace(
          tr.querySelector('select[data-v3d2-history-field="incumbencyStatus"]'),
          incumbencyOptions,
          row?.incumbencyStatus,
        );
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="voteShare"]'), row?.voteShare);
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="margin"]'), row?.margin);
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="turnoutContext"]'), row?.turnoutContext);
        syncCheckboxControlInPlace(tr.querySelector('input[data-v3d2-history-field="repeatCandidate"]'), row?.repeatCandidate);
        syncInputControlInPlace(tr.querySelector('input[data-v3d2-history-field="overUnderPerformancePct"]'), row?.overUnderPerformancePct);

        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="office"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="cycleYear"]'), locked);
        applyDisabledToControl(tr.querySelector('select[data-v3d2-history-field="electionType"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="candidateName"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="party"]'), locked);
        applyDisabledToControl(tr.querySelector('select[data-v3d2-history-field="incumbencyStatus"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="voteShare"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="margin"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="turnoutContext"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="repeatCandidate"]'), locked);
        applyDisabledToControl(tr.querySelector('input[data-v3d2-history-field="overUnderPerformancePct"]'), locked);

        const actionCell = tr.cells[11];
        if (!(actionCell instanceof HTMLElement)) {
          return;
        }
        const existingButton = actionCell.querySelector("button[data-v3d2-remove-history]");
        if (locked) {
          if (existingButton instanceof HTMLButtonElement) {
            existingButton.remove();
          }
          return;
        }
        if (existingButton instanceof HTMLButtonElement) {
          existingButton.disabled = false;
          return;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fpe-btn fpe-btn--ghost";
        button.dataset.v3d2RemoveHistory = recordId;
        button.textContent = "Remove";
        actionCell.append(button);
      });
    }
  }

  if (summary instanceof HTMLElement) {
    summary.textContent = String(ballotSnapshot?.candidateHistorySummaryText || "No candidate history rows.") || "No candidate history rows.";
  }
  if (warn instanceof HTMLElement) {
    const warningText = String(ballotSnapshot?.candidateHistoryWarningText || "").trim();
    warn.hidden = !warningText;
    warn.textContent = warningText;
  }

  applyDisabled("v3BtnDistrictV2AddCandidateHistory", locked);
}

function syncDistrictV2Targeting(configSnapshot, resultsSnapshot) {
  const config = configSnapshot && typeof configSnapshot === "object" ? configSnapshot : {};
  const results = resultsSnapshot && typeof resultsSnapshot === "object" ? resultsSnapshot : {};

  syncSelectOptions("v3DistrictV2TargetingGeoLevel", normalizeTargetingOptions(listTargetGeoLevels()), config.geoLevel);
  syncSelectOptions("v3DistrictV2TargetingModelId", normalizeTargetingOptions(listTargetModelOptions()), config.modelId || config.presetId);
  syncInputValueFromRaw("v3DistrictV2TargetingTopN", config.topN);
  syncInputValueFromRaw("v3DistrictV2TargetingMinHousingUnits", config.minHousingUnits);
  syncInputValueFromRaw("v3DistrictV2TargetingMinPopulation", config.minPopulation);
  syncInputValueFromRaw("v3DistrictV2TargetingMinScore", config.minScore);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingOnlyRaceFootprint", config.onlyRaceFootprint);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingPrioritizeYoung", config.prioritizeYoung);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingPrioritizeRenters", config.prioritizeRenters);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingAvoidHighMultiUnit", config.avoidHighMultiUnit);
  syncSelectOptions("v3DistrictV2TargetingDensityFloor", TARGETING_DENSITY_OPTIONS, config.densityFloor, { placeholder: "none" });
  syncInputValueFromRaw("v3DistrictV2TargetingWeightVotePotential", config.weightVotePotential);
  syncInputValueFromRaw("v3DistrictV2TargetingWeightTurnoutOpportunity", config.weightTurnoutOpportunity);
  syncInputValueFromRaw("v3DistrictV2TargetingWeightPersuasionIndex", config.weightPersuasionIndex);
  syncInputValueFromRaw("v3DistrictV2TargetingWeightFieldEfficiency", config.weightFieldEfficiency);

  setText("v3DistrictV2TargetingStatus", String(results.statusText || "Run targeting.") || "Run targeting.");
  setText("v3DistrictV2TargetingMeta", String(results.metaText || "") || "-");
  renderDistrictV2TargetingRows(results.rows);

  const locked = !!config.controlsLocked;
  applyDisabled("v3DistrictV2TargetingGeoLevel", locked);
  applyDisabled("v3DistrictV2TargetingModelId", locked);
  applyDisabled("v3DistrictV2TargetingTopN", locked);
  applyDisabled("v3DistrictV2TargetingMinHousingUnits", locked);
  applyDisabled("v3DistrictV2TargetingMinPopulation", locked);
  applyDisabled("v3DistrictV2TargetingMinScore", locked);
  applyDisabled("v3DistrictV2TargetingOnlyRaceFootprint", locked);
  applyDisabled("v3DistrictV2TargetingPrioritizeYoung", locked);
  applyDisabled("v3DistrictV2TargetingPrioritizeRenters", locked);
  applyDisabled("v3DistrictV2TargetingAvoidHighMultiUnit", locked);
  applyDisabled("v3DistrictV2TargetingDensityFloor", locked);
  applyDisabled("v3DistrictV2TargetingWeightVotePotential", locked);
  applyDisabled("v3DistrictV2TargetingWeightTurnoutOpportunity", locked);
  applyDisabled("v3DistrictV2TargetingWeightPersuasionIndex", locked);
  applyDisabled("v3DistrictV2TargetingWeightFieldEfficiency", locked);
  applyDisabled("v3BtnDistrictV2TargetingResetWeights", locked || !config.canResetWeights);
  applyDisabled("v3BtnDistrictV2RunTargeting", locked);
  applyDisabled("v3BtnDistrictV2ExportTargetingCsv", locked || !config.canExport);
  applyDisabled("v3BtnDistrictV2ExportTargetingJson", locked || !config.canExport);
}

function syncDistrictV2Census(configSnapshot, resultsSnapshot) {
  const config = configSnapshot && typeof configSnapshot === "object" ? configSnapshot : {};
  const results = resultsSnapshot && typeof resultsSnapshot === "object" ? resultsSnapshot : {};

  syncInputValueFromRaw("v3DistrictV2CensusApiKey", config.apiKey);
  syncSelectOptions("v3DistrictV2CensusAcsYear", normalizeIdOptions(listAcsYears()), config.year);
  syncSelectOptions("v3DistrictV2CensusResolution", normalizeIdOptions(listResolutionOptions()), config.resolution);
  syncSelectOptions("v3DistrictV2CensusStateFips", normalizeSnapshotOptions(config.stateOptions), config.stateFips, { placeholder: "Select state" });
  syncSelectOptions("v3DistrictV2CensusCountyFips", normalizeSnapshotOptions(config.countyOptions), config.countyFips, { placeholder: "Select county" });
  syncSelectOptions("v3DistrictV2CensusPlaceFips", normalizeSnapshotOptions(config.placeOptions), config.placeFips, { placeholder: "Select place" });
  syncSelectOptions("v3DistrictV2CensusMetricSet", normalizeIdOptions(listMetricSetOptions()), config.metricSet);
  syncSelectOptions("v3DistrictV2CensusTractFilter", normalizeSnapshotOptions(config.tractFilterOptions), config.tractFilter, { placeholder: "All tracts" });
  syncInputValueFromRaw("v3DistrictV2CensusGeoSearch", config.geoSearch);
  syncInputValueFromRaw("v3DistrictV2CensusGeoPaste", config.geoPaste);
  syncMultiSelectOptions("v3DistrictV2CensusGeoSelect", normalizeSnapshotOptions(config.geoSelectOptions), config.geoSelectOptions);
  syncCheckboxCheckedFromRaw("v3DistrictV2CensusApplyAdjustments", config.applyAdjustedAssumptions);
  syncCheckboxCheckedFromRaw("v3DistrictV2CensusMapQaVtdOverlay", config.mapQaVtdOverlay);

  setText("v3DistrictV2CensusContextHint", String(results.contextHint || "Set state and resolution to define Census context.") || "Set state and resolution to define Census context.");
  setText("v3DistrictV2CensusStatus", String(results.statusText || "Ready.") || "Ready.");
  setText("v3DistrictV2CensusGeoStats", String(results.geoStatsText || "0 selected of 0 GEOs. 0 rows loaded.") || "0 selected of 0 GEOs. 0 rows loaded.");
  setText("v3DistrictV2CensusLastFetch", String(results.lastFetchText || "No fetch yet.") || "No fetch yet.");
  setText("v3DistrictV2CensusSelectionSummary", String(results.selectionSummaryText || "No GEO selected.") || "No GEO selected.");
  setText("v3DistrictV2CensusMapStatus", String(results.mapStatusText || "Map idle. Select GEO units and click Load boundaries.") || "Map idle. Select GEO units and click Load boundaries.");
  setText("v3DistrictV2CensusMapQaVtdZipStatus", String(results.mapQaVtdZipStatusText || "No VTD ZIP loaded.") || "No VTD ZIP loaded.");
  const selectedGeoLabels = Array.isArray(config.geoSelectOptions)
    ? config.geoSelectOptions
      .filter((row) => !!row?.selected)
      .map((row) => {
        const label = String(row?.label || "").trim();
        const geoid = String(row?.value || "").trim();
        if (!label && !geoid) return "";
        if (!label) return geoid;
        if (!geoid || geoid === label) return label;
        return `${label} (${geoid})`;
      })
      .filter(Boolean)
    : [];
  const geoLabelPreview = selectedGeoLabels.slice(0, 8);
  const geoLabelOverflow = selectedGeoLabels.length > geoLabelPreview.length
    ? ` +${selectedGeoLabels.length - geoLabelPreview.length} more`
    : "";
  setText(
    "v3DistrictV2CensusMapLabels",
    geoLabelPreview.length
      ? `Geography labels: ${geoLabelPreview.join(" · ")}${geoLabelOverflow}`
      : "No geography labels loaded.",
  );

  renderDistrictV2CensusAggregateRows(results.aggregateRows);

  const mapShell = document.getElementById("v3DistrictV2CensusMapShell");
  if (mapShell instanceof HTMLElement) {
    const mapStatusText = String(results.mapStatusText || "").toLowerCase();
    const hasActiveMap =
      (mapStatusText && !mapStatusText.includes("idle"))
      || mapStatusText.includes("loaded")
      || mapStatusText.includes("overlay")
      || mapStatusText.includes("qa");
    mapShell.classList.toggle("is-active", hasActiveMap);
    mapShell.classList.toggle("is-idle", !hasActiveMap);
  }
  const mapOverlay = document.getElementById("v3DistrictV2CensusMapOverlay");
  if (mapOverlay instanceof HTMLElement) {
    mapOverlay.textContent = String(results.mapStatusText || "Map shell restored. Load boundaries to refresh geometry status.");
  }

  const controlsLocked = !!config.controlsLocked;
  const disabledMap = config.disabledMap && typeof config.disabledMap === "object"
    ? config.disabledMap
    : {};
  const readDisabled = (...keys) => keys.some((key) => !!disabledMap?.[key]);

  applyDisabled("v3DistrictV2CensusApiKey", controlsLocked || !!disabledMap.apiKey);
  applyDisabled("v3DistrictV2CensusAcsYear", controlsLocked || !!disabledMap.year);
  applyDisabled("v3DistrictV2CensusResolution", controlsLocked || !!disabledMap.resolution);
  applyDisabled("v3DistrictV2CensusStateFips", controlsLocked || !!disabledMap.stateFips);
  applyDisabled("v3DistrictV2CensusCountyFips", controlsLocked || !!disabledMap.countyFips);
  applyDisabled("v3DistrictV2CensusPlaceFips", controlsLocked || !!disabledMap.placeFips);
  applyDisabled("v3DistrictV2CensusMetricSet", controlsLocked || !!disabledMap.metricSet);
  applyDisabled("v3DistrictV2CensusTractFilter", controlsLocked || !!disabledMap.tractFilter);
  applyDisabled("v3DistrictV2CensusGeoSearch", controlsLocked || !!disabledMap.geoSearch);
  applyDisabled("v3DistrictV2CensusGeoPaste", controlsLocked || !!disabledMap.geoPaste);
  applyDisabled("v3DistrictV2CensusGeoSelect", controlsLocked || !!disabledMap.geoSelect);
  applyDisabled("v3DistrictV2CensusApplyAdjustments", controlsLocked || !!disabledMap.applyAdjustedAssumptions);
  applyDisabled(
    "v3DistrictV2CensusMapQaVtdOverlay",
    controlsLocked || !!disabledMap.mapQaVtdOverlay || readDisabled("v3CensusMapQaVtdToggle"),
  );
  applyDisabled("v3BtnDistrictV2CensusLoadGeo", controlsLocked || !!disabledMap.loadGeo);
  applyDisabled("v3BtnDistrictV2CensusApplyGeoPaste", controlsLocked || !!disabledMap.applyGeoPaste);
  applyDisabled(
    "v3BtnDistrictV2CensusSelectAll",
    controlsLocked || readDisabled("selectAll", "selectAllGeo", "v3BtnCensusSelectAll"),
  );
  applyDisabled(
    "v3BtnDistrictV2CensusClearSelection",
    controlsLocked || readDisabled("clearSelection", "clearGeoSelection", "v3BtnCensusClearSelection"),
  );
  applyDisabled("v3BtnDistrictV2CensusFetchRows", controlsLocked || !!disabledMap.fetchRows);
  applyDisabled(
    "v3BtnDistrictV2CensusLoadMap",
    controlsLocked || readDisabled("loadMap", "v3BtnCensusLoadMap"),
  );
  applyDisabled(
    "v3BtnDistrictV2CensusClearMap",
    controlsLocked || readDisabled("clearMap", "v3BtnCensusClearMap"),
  );
  applyDisabled(
    "v3DistrictV2CensusMapQaVtdZip",
    controlsLocked || readDisabled("mapQaVtdZip", "v3CensusMapQaVtdZip"),
  );
  applyDisabled(
    "v3BtnDistrictV2CensusClearVtdZip",
    controlsLocked || readDisabled("clearVtdZip", "v3BtnCensusMapQaVtdZipClear"),
  );
}

function renderDistrictV2TargetingRows(rows) {
  const tbody = document.getElementById("v3DistrictV2TargetingResultsTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    setInnerHtmlWithTrace(tbody, `<tr><td class="muted" colspan="6">Run targeting to generate ranked GEOs.</td></tr>`, "renderDistrictV2TargetingRows:empty");
    return;
  }
  setInnerHtmlWithTrace(tbody, list.map((row) => `
    <tr>
      <td>${escapeHtml(String(row?.rank || ""))}</td>
      <td>${escapeHtml(String(row?.geography || ""))}</td>
      <td class="num">${escapeHtml(String(row?.score || ""))}</td>
      <td class="num">${escapeHtml(String(row?.votesPerHour || ""))}</td>
      <td>${escapeHtml(String(row?.reason || ""))}</td>
      <td>${escapeHtml(String(row?.flags || ""))}</td>
    </tr>
  `).join(""), "renderDistrictV2TargetingRows:rows");
}

function renderDistrictV2CensusAggregateRows(rows) {
  const tbody = document.getElementById("v3DistrictV2CensusAggregateTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    setInnerHtmlWithTrace(tbody, `<tr><td class="muted" colspan="2">No ACS rows loaded.</td></tr>`, "renderDistrictV2CensusAggregateRows:empty");
    return;
  }
  setInnerHtmlWithTrace(tbody, list.map((row) => {
    const cells = Array.isArray(row) ? row : [];
    const label = escapeHtml(String(cells[0] || ""));
    const value = escapeHtml(String(cells[1] || ""));
    return `<tr><td>${label}</td><td class="num">${value}</td></tr>`;
  }).join(""), "renderDistrictV2CensusAggregateRows:rows");
}

function bindDistrictV2RaceContextHandlers() {
  bindDistrictV2FormSelect("v3DistrictV2RaceType", "raceType");
  bindDistrictV2FormField("v3DistrictV2ElectionDate", "electionDate");
  bindDistrictV2FormField("v3DistrictV2WeeksRemaining", "weeksRemaining");
  bindDistrictV2FormSelect("v3DistrictV2Mode", "mode");

  bindDistrictV2FormSelect("v3DistrictV2OfficeLevel", "officeLevel");
  bindDistrictV2FormSelect("v3DistrictV2ElectionType", "electionType");
  bindDistrictV2FormSelect("v3DistrictV2SeatContext", "seatContext");
  bindDistrictV2FormSelect("v3DistrictV2PartisanshipMode", "partisanshipMode");
  bindDistrictV2FormSelect("v3DistrictV2SalienceLevel", "salienceLevel");

  const applyBtn = document.getElementById("v3BtnDistrictV2ApplyTemplateDefaults");
  if (applyBtn instanceof HTMLButtonElement && applyBtn.dataset.v3DistrictV2Bound !== "1") {
    applyBtn.dataset.v3DistrictV2Bound = "1";
    applyBtn.addEventListener("click", () => {
      const result = applyDistrictTemplateDefaults("all");
      handleDistrictV2MutationResult(result, "applyTemplateDefaults");
    });
  }
}

function bindDistrictV2ElectorateHandlers() {
  bindDistrictV2FormField("v3DistrictV2UniverseSize", "universeSize");
  bindDistrictV2FormSelect("v3DistrictV2UniverseBasis", "universeBasis");
  bindDistrictV2FormField("v3DistrictV2SourceNote", "sourceNote");

  bindDistrictV2FormCheckbox("v3DistrictV2Universe16Enabled", "universe16Enabled");
  bindDistrictV2FormField("v3DistrictV2UniverseDemPct", "universe16DemPct");
  bindDistrictV2FormField("v3DistrictV2UniverseRepPct", "universe16RepPct");
  bindDistrictV2FormField("v3DistrictV2UniverseNpaPct", "universe16NpaPct");
  bindDistrictV2FormField("v3DistrictV2UniverseOtherPct", "universe16OtherPct");
  bindDistrictV2FormField("v3DistrictV2RetentionFactor", "retentionFactor");
}

function bindDistrictV2TurnoutBaselineHandlers() {
  bindDistrictV2FormField("v3DistrictV2TurnoutA", "turnoutA");
  bindDistrictV2FormField("v3DistrictV2TurnoutB", "turnoutB");
  bindDistrictV2FormField("v3DistrictV2BandWidth", "bandWidth");
}

function bindDistrictV2BallotHandlers() {
  bindDistrictV2FormSelect("v3DistrictV2YourCandidate", "yourCandidate");
  bindDistrictV2FormField("v3DistrictV2UndecidedPct", "undecidedPct");
  bindDistrictV2FormSelect("v3DistrictV2UndecidedMode", "undecidedMode");

  const addBtn = document.getElementById("v3BtnDistrictV2AddCandidate");
  if (addBtn instanceof HTMLButtonElement && addBtn.dataset.v3DistrictV2Bound !== "1") {
    addBtn.dataset.v3DistrictV2Bound = "1";
    addBtn.addEventListener("click", () => {
      const result = addDistrictCandidate();
      handleDistrictV2MutationResult(result, "addCandidate");
    });
  }

  const candidateBody = document.getElementById("v3DistrictV2CandTbody");
  if (candidateBody instanceof HTMLElement && candidateBody.dataset.v3DistrictV2Bound !== "1") {
    candidateBody.dataset.v3DistrictV2Bound = "1";

    candidateBody.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      const candidateId = String(target.dataset.v3d2CandidateId || "").trim();
      const field = String(target.dataset.v3d2CandidateField || "").trim();
      if (!candidateId || !field) {
        return;
      }
      const value = target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
      const result = updateDistrictCandidate(candidateId, field, value);
      handleDistrictV2MutationResult(result, `updateCandidate:${field}`);
    });

    candidateBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest("[data-v3d2-remove-candidate]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const candidateId = String(button.dataset.v3d2RemoveCandidate || "").trim();
      if (!candidateId) {
        return;
      }
      const result = removeDistrictCandidate(candidateId);
      handleDistrictV2MutationResult(result, "removeCandidate");
    });
  }

  const userSplitList = document.getElementById("v3DistrictV2UserSplitList");
  if (userSplitList instanceof HTMLElement && userSplitList.dataset.v3DistrictV2Bound !== "1") {
    userSplitList.dataset.v3DistrictV2Bound = "1";
    userSplitList.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const candidateId = String(target.dataset.v3d2UserSplitId || "").trim();
      if (!candidateId) {
        return;
      }
      const result = setDistrictUserSplit(candidateId, target.value);
      handleDistrictV2MutationResult(result, "setUserSplit");
    });
  }
}

function bindDistrictV2CandidateHistoryHandlers() {
  const addBtn = document.getElementById("v3BtnDistrictV2AddCandidateHistory");
  if (addBtn instanceof HTMLButtonElement && addBtn.dataset.v3DistrictV2Bound !== "1") {
    addBtn.dataset.v3DistrictV2Bound = "1";
    addBtn.addEventListener("click", () => {
      const result = addDistrictCandidateHistory();
      handleDistrictV2MutationResult(result, "addCandidateHistory");
    });
  }

  const historyBody = document.getElementById("v3DistrictV2CandidateHistoryTbody");
  if (historyBody instanceof HTMLElement && historyBody.dataset.v3DistrictV2Bound !== "1") {
    historyBody.dataset.v3DistrictV2Bound = "1";

    historyBody.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      const recordId = String(target.dataset.v3d2HistoryId || "").trim();
      const field = String(target.dataset.v3d2HistoryField || "").trim();
      if (!recordId || !field) {
        return;
      }
      const value = target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
      const result = updateDistrictCandidateHistory(recordId, field, value);
      handleDistrictV2MutationResult(result, `updateCandidateHistory:${field}`);
    });

    historyBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest("[data-v3d2-remove-history]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const recordId = String(button.dataset.v3d2RemoveHistory || "").trim();
      if (!recordId) {
        return;
      }
      const result = removeDistrictCandidateHistory(recordId);
      handleDistrictV2MutationResult(result, "removeCandidateHistory");
    });
  }
}

function bindDistrictV2TargetingHandlers() {
  bindDistrictV2TargetingSelect("v3DistrictV2TargetingGeoLevel", "geoLevel");
  bindDistrictV2TargetingModelSelect("v3DistrictV2TargetingModelId");
  bindDistrictV2TargetingField("v3DistrictV2TargetingTopN", "topN");
  bindDistrictV2TargetingField("v3DistrictV2TargetingMinHousingUnits", "minHousingUnits");
  bindDistrictV2TargetingField("v3DistrictV2TargetingMinPopulation", "minPopulation");
  bindDistrictV2TargetingField("v3DistrictV2TargetingMinScore", "minScore");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingOnlyRaceFootprint", "onlyRaceFootprint");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingPrioritizeYoung", "prioritizeYoung");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingPrioritizeRenters", "prioritizeRenters");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingAvoidHighMultiUnit", "avoidHighMultiUnit");
  bindDistrictV2TargetingSelect("v3DistrictV2TargetingDensityFloor", "densityFloor");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightVotePotential", "weightVotePotential");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightTurnoutOpportunity", "weightTurnoutOpportunity");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightPersuasionIndex", "weightPersuasionIndex");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightFieldEfficiency", "weightFieldEfficiency");

  bindDistrictV2TargetingAction("v3BtnDistrictV2TargetingResetWeights", () => resetDistrictTargetingWeights(), "resetTargetingWeights");
  bindDistrictV2TargetingAction("v3BtnDistrictV2RunTargeting", () => runDistrictTargeting(), "runTargeting");
  bindDistrictV2TargetingAction("v3BtnDistrictV2ExportTargetingCsv", () => exportDistrictTargetingCsv(), "exportTargetingCsv");
  bindDistrictV2TargetingAction("v3BtnDistrictV2ExportTargetingJson", () => exportDistrictTargetingJson(), "exportTargetingJson");
}

function bindDistrictV2CensusHandlers() {
  bindDistrictV2CensusField("v3DistrictV2CensusApiKey", "apiKey", "input");
  bindDistrictV2CensusField("v3DistrictV2CensusAcsYear", "year", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusResolution", "resolution", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusStateFips", "stateFips", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusCountyFips", "countyFips", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusPlaceFips", "placeFips", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusMetricSet", "metricSet", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusTractFilter", "tractFilter", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusGeoSearch", "geoSearch", "input");
  bindDistrictV2CensusField("v3DistrictV2CensusGeoPaste", "geoPaste", "input");

  bindDistrictV2CensusCheckbox("v3DistrictV2CensusApplyAdjustments", "applyAdjustedAssumptions");
  bindDistrictV2CensusCheckbox("v3DistrictV2CensusMapQaVtdOverlay", "mapQaVtdOverlay");
  bindDistrictV2CensusGeoSelection("v3DistrictV2CensusGeoSelect");
  bindDistrictV2CensusFile("v3DistrictV2CensusMapQaVtdZip", "mapQaVtdZip");

  bindDistrictV2CensusAction("v3BtnDistrictV2CensusLoadGeo", "loadGeo");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusApplyGeoPaste", "applyGeoPaste");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusSelectAll", "selectAll");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusClearSelection", "clearSelection");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusFetchRows", "fetchRows");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusLoadMap", "loadMap");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusClearMap", "clearMap");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusClearVtdZip", "clearVtdZip");
}

function emitDistrictV2FormDispatchAudit(controlId, field, control, eventName, rawValue, normalizedValue, result, canonicalBefore, canonicalAfter) {
  if (!isDistrictV2BinderAuditEnabled() || !isDistrictV2BinderAuditTarget(controlId)) {
    return;
  }
  const bridgeApi = window?.__FPE_DISTRICT_API__;
  emitDistrictV2BinderAudit({
    eventType: "binder.dispatch",
    controlId,
    field,
    eventName,
    nodeToken: districtV2NodeToken(control),
    rawValue,
    normalizedValue,
    resultType: result == null ? "nullish" : typeof result,
    resultIsNull: result == null,
    resultOk: !!result?.ok,
    resultCode: String(result?.code || "").trim(),
    bridgeHasSetFormField: !!(bridgeApi && typeof bridgeApi.setFormField === "function"),
    canonicalBefore,
    canonicalAfter,
  });
}

function bindDistrictV2FormSelect(v3Id, field) {
  const control = document.getElementById(v3Id);
  emitDistrictV2BinderLookup(v3Id, field, control, "lookup");
  if (!(control instanceof HTMLSelectElement)) {
    emitDistrictV2BinderLookup(v3Id, field, control, "lookup.missing");
    return;
  }
  if (control.dataset.v3DistrictV2Bound === "1") {
    emitDistrictV2BinderLookup(v3Id, field, control, "attach.skip.alreadyBound");
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  const nextAttachCount = Number(districtV2BinderAttachCounts.get(control) || 0) + 1;
  districtV2BinderAttachCounts.set(control, nextAttachCount);
  emitDistrictV2BinderLookup(v3Id, field, control, "attach");
  emitDistrictV2BinderAudit({
    eventType: "binder.attach",
    controlId: v3Id,
    field,
    nodeToken: districtV2NodeToken(control),
    attachCount: nextAttachCount,
  });
  control.addEventListener("change", (event) => {
    const rawValue = control.value;
    const normalizedValue = String(rawValue == null ? "" : rawValue).trim();
    const canonicalBefore = readDistrictV2BinderCanonicalSnapshot(v3Id);
    emitDistrictV2BinderAudit({
      eventType: "binder.event",
      controlId: v3Id,
      field,
      eventName: String(event?.type || "change"),
      nodeToken: districtV2NodeToken(control),
      domValue: String(control.value || ""),
      canonicalBefore,
    });
    const result = setDistrictFormField(field, rawValue);
    const canonicalAfter = readDistrictV2BinderCanonicalSnapshot(v3Id);
    emitDistrictV2FormDispatchAudit(
      v3Id,
      field,
      control,
      String(event?.type || "change"),
      rawValue,
      normalizedValue,
      result,
      canonicalBefore,
      canonicalAfter,
    );
    handleDistrictV2MutationResult(result, `setFormField:${field}`);
  });
}

function bindDistrictV2FormField(v3Id, field) {
  const control = document.getElementById(v3Id);
  emitDistrictV2BinderLookup(v3Id, field, control, "lookup");
  if (
    !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
  ) {
    emitDistrictV2BinderLookup(v3Id, field, control, "lookup.missing");
    return;
  }
  if (control.dataset.v3DistrictV2Bound === "1") {
    emitDistrictV2BinderLookup(v3Id, field, control, "attach.skip.alreadyBound");
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  const nextAttachCount = Number(districtV2BinderAttachCounts.get(control) || 0) + 1;
  districtV2BinderAttachCounts.set(control, nextAttachCount);
  emitDistrictV2BinderLookup(v3Id, field, control, "attach");
  emitDistrictV2BinderAudit({
    eventType: "binder.attach",
    controlId: v3Id,
    field,
    nodeToken: districtV2NodeToken(control),
    attachCount: nextAttachCount,
  });
  const onCommit = (event) => {
    const rawValue = control.value;
    const normalizedValue = String(rawValue == null ? "" : rawValue).trim();
    const canonicalBefore = readDistrictV2BinderCanonicalSnapshot(v3Id);
    emitDistrictV2BinderAudit({
      eventType: "binder.event",
      controlId: v3Id,
      field,
      eventName: String(event?.type || "input"),
      nodeToken: districtV2NodeToken(control),
      domValue: String(control.value || ""),
      canonicalBefore,
    });
    const result = setDistrictFormField(field, rawValue);
    const canonicalAfter = readDistrictV2BinderCanonicalSnapshot(v3Id);
    emitDistrictV2FormDispatchAudit(
      v3Id,
      field,
      control,
      String(event?.type || "input"),
      rawValue,
      normalizedValue,
      result,
      canonicalBefore,
      canonicalAfter,
    );
    handleDistrictV2MutationResult(result, `setFormField:${field}`);
  };
  control.addEventListener("input", onCommit);
  control.addEventListener("change", onCommit);
}

function bindDistrictV2FormCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictFormField(field, control.checked);
    handleDistrictV2MutationResult(result, `setFormField:${field}`);
  });
}

function bindDistrictV2TargetingSelect(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictTargetingField(field, control.value);
    handleDistrictV2MutationResult(result, `setTargetingField:${field}`);
  });
}

function bindDistrictV2TargetingModelSelect(v3Id) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = applyDistrictTargetingPreset(control.value);
    handleDistrictV2MutationResult(result, "applyTargetingPreset");
  });
}

function bindDistrictV2TargetingField(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  const onCommit = () => {
    const result = setDistrictTargetingField(field, control.value);
    handleDistrictV2MutationResult(result, `setTargetingField:${field}`);
  };
  control.addEventListener("input", onCommit);
  control.addEventListener("change", onCommit);
}

function bindDistrictV2TargetingCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictTargetingField(field, control.checked);
    handleDistrictV2MutationResult(result, `setTargetingField:${field}`);
  });
}

function bindDistrictV2TargetingAction(v3Id, action, source) {
  const button = document.getElementById(v3Id);
  if (!(button instanceof HTMLButtonElement) || button.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  button.dataset.v3DistrictV2Bound = "1";
  button.addEventListener("click", () => {
    const result = action();
    handleDistrictV2MutationResult(result, source);
  });
}

function bindDistrictV2CensusField(v3Id, field, eventName = "input") {
  const control = document.getElementById(v3Id);
  if (
    !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)
    || control.dataset.v3DistrictV2Bound === "1"
  ) {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener(eventName, () => {
    const result = setDistrictCensusField(field, control.value);
    handleDistrictV2MutationResult(result, `setCensusField:${field}`);
  });
}

function bindDistrictV2CensusCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictCensusField(field, control.checked);
    handleDistrictV2MutationResult(result, `setCensusField:${field}`);
  });
}

function bindDistrictV2CensusGeoSelection(v3Id) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const values = Array.from(control.selectedOptions).map((option) => option.value);
    const result = setDistrictCensusGeoSelection(values);
    handleDistrictV2MutationResult(result, "setCensusGeoSelection");
  });
}

function bindDistrictV2CensusFile(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictCensusFile(field, control.files || []);
    handleDistrictV2MutationResult(result, `setCensusFile:${field}`);
  });
}

function bindDistrictV2CensusAction(v3Id, action) {
  const button = document.getElementById(v3Id);
  if (!(button instanceof HTMLButtonElement) || button.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  button.dataset.v3DistrictV2Bound = "1";
  button.addEventListener("click", () => {
    const result = triggerDistrictCensusAction(action);
    handleDistrictV2MutationResult(result, `triggerCensusAction:${action}`);
  });
}

function assignCardStatusId(card, id) {
  if (!(card instanceof HTMLElement)) {
    return;
  }
  const statusEl = card.querySelector(".fpe-card__status");
  if (statusEl instanceof HTMLElement) {
    statusEl.id = id;
  }
}

function syncDistrictV2CardStatus(id, value) {
  const status = document.getElementById(id);
  if (!(status instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || "Awaiting inputs";
  status.textContent = text;
  status.classList.remove("is-good", "is-warn", "is-bad");
  const tone = classifyDistrictStatusTone(text);
  if (tone === "ok") {
    status.classList.add("is-good");
  } else if (tone === "warn") {
    status.classList.add("is-warn");
  } else if (tone === "bad") {
    status.classList.add("is-bad");
  }
}

function deriveDistrictTurnoutBaselineCardStatus(snapshot) {
  const turnoutA = Number(snapshot?.turnoutA);
  const turnoutB = Number(snapshot?.turnoutB);
  const bandWidth = Number(snapshot?.bandWidth);
  const hasA = Number.isFinite(turnoutA);
  const hasB = Number.isFinite(turnoutB);
  const hasBand = Number.isFinite(bandWidth);
  if (hasA && hasB && hasBand) {
    return `Anchored · A ${turnoutA.toFixed(1)}% · B ${turnoutB.toFixed(1)}% · ±${bandWidth.toFixed(1)}%`;
  }
  if (hasA || hasB || hasBand) {
    return "Partial anchors";
  }
  return "Awaiting turnout anchors";
}

function syncSelectOptions(id, options, selectedValue, { placeholder = "" } = {}) {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  syncSelectControlInPlace(select, options, selectedValue, { placeholder });
}

function syncMultiSelectOptions(id, options, selectedOptions) {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  syncMultiSelectControlInPlace(select, options, selectedOptions);
}

function syncSelectControlInPlace(select, options, selectedValue, { placeholder = "" } = {}) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const normalized = normalizeSnapshotOptions(options);
  const wanted = String(selectedValue == null ? "" : selectedValue);
  const nextOptions = [];
  if (placeholder) {
    nextOptions.push({ value: "", label: String(placeholder) });
  }
  nextOptions.push(...normalized);
  const signature = nextOptions.map((option) => `${option.value}::${option.label}`).join("||");
  const previousSignature = String(select.dataset.v3d2OptionSignature || "");
  if (signature !== previousSignature) {
    replaceSelectOptionsInPlace(select, nextOptions);
    select.dataset.v3d2OptionSignature = signature;
  }
  if (document.activeElement !== select) {
    if (wanted && !Array.from(select.options).some((row) => row.value === wanted)) {
      const extra = document.createElement("option");
      extra.value = wanted;
      extra.textContent = wanted;
      select.append(extra);
      select.dataset.v3d2OptionSignature = `${signature}||${wanted}::${wanted}`;
    }
    select.value = wanted;
  }
}

function syncMultiSelectControlInPlace(select, options, selectedOptions) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const normalized = normalizeSnapshotOptions(options);
  const selectedSet = new Set(
    (Array.isArray(selectedOptions) ? selectedOptions : [])
      .filter((row) => row && typeof row === "object" && row.selected)
      .map((row) => String(row.value || "").trim())
      .filter(Boolean),
  );
  const signature = normalized.map((option) => `${option.value}::${option.label}`).join("||");
  const previousSignature = String(select.dataset.v3d2OptionSignature || "");
  if (signature !== previousSignature) {
    replaceSelectOptionsInPlace(select, normalized);
    select.dataset.v3d2OptionSignature = signature;
  }
  if (document.activeElement === select) {
    return;
  }
  Array.from(select.options).forEach((option) => {
    option.selected = selectedSet.has(option.value);
  });
}

function syncInputValueFromRaw(id, rawValue) {
  const input = document.getElementById(id);
  syncInputControlInPlace(input, rawValue);
}

function syncCheckboxCheckedFromRaw(id, rawValue) {
  const input = document.getElementById(id);
  syncCheckboxControlInPlace(input, rawValue);
}

function syncInputControlInPlace(control, rawValue) {
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
    return;
  }
  if (document.activeElement === control) {
    return;
  }
  const next = rawValue == null ? "" : String(rawValue);
  if (control.value !== next) {
    control.value = next;
  }
}

function syncCheckboxControlInPlace(control, rawValue) {
  if (!(control instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === control) {
    return;
  }
  const checked = !!rawValue;
  if (control.checked !== checked) {
    control.checked = checked;
  }
}

function applyDisabledToControl(control, disabled) {
  if (
    !(control instanceof HTMLInputElement)
    && !(control instanceof HTMLSelectElement)
    && !(control instanceof HTMLTextAreaElement)
    && !(control instanceof HTMLButtonElement)
  ) {
    return;
  }
  control.disabled = !!disabled;
}

function replaceSelectOptionsInPlace(select, nextOptions) {
  const normalized = Array.isArray(nextOptions) ? nextOptions : [];
  for (let index = 0; index < normalized.length; index += 1) {
    const option = normalized[index];
    let node = select.options[index];
    if (!(node instanceof HTMLOptionElement)) {
      node = document.createElement("option");
      select.add(node);
    }
    const nextValue = String(option?.value ?? "");
    const nextLabel = String(option?.label ?? nextValue);
    if (node.value !== nextValue) {
      node.value = nextValue;
    }
    if ((node.textContent || "") !== nextLabel) {
      node.textContent = nextLabel;
    }
  }
  while (select.options.length > normalized.length) {
    select.remove(select.options.length - 1);
  }
}

function applyDisabled(id, disabled) {
  const control = document.getElementById(id);
  if (
    !(control instanceof HTMLInputElement)
    && !(control instanceof HTMLSelectElement)
    && !(control instanceof HTMLTextAreaElement)
    && !(control instanceof HTMLButtonElement)
  ) {
    return;
  }
  control.disabled = !!disabled;
}

function normalizeSnapshotOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const value = String(row.value ?? row.id ?? "").trim();
      const label = String(row.label ?? row.value ?? row.id ?? "").trim() || value;
      if (!value && !label) {
        return null;
      }
      return { value, label };
    })
    .filter(Boolean);
}

function normalizeIdOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      const value = String(row?.id ?? row?.value ?? "").trim();
      const label = String(row?.label ?? row?.id ?? row?.value ?? "").trim() || value;
      if (!value && !label) {
        return null;
      }
      return { value, label };
    })
    .filter(Boolean);
}

function normalizeTargetingOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      const value = String(row?.id ?? row?.value ?? "").trim();
      const label = String(row?.label ?? row?.id ?? row?.value ?? "").trim() || value;
      if (!value) {
        return null;
      }
      return { value, label };
    })
    .filter(Boolean);
}

function buildSelect(prefix, recordId, field, options, selectedValue, disabled) {
  const selectId = `v3DistrictV2_${prefix}_${recordId}`;
  return `
    <select class="fpe-input" id="${escapeHtml(selectId)}" data-v3d2-history-id="${escapeHtml(recordId)}" data-v3d2-history-field="${escapeHtml(field)}" ${disabled ? "disabled" : ""}>
      ${buildOptionsHtml(options, selectedValue)}
    </select>
  `;
}

function buildOptionsHtml(options, selectedValue) {
  const selected = String(selectedValue || "").trim();
  return normalizeSnapshotOptions(options).map((row) => {
    const isSelected = row.value === selected;
    return `<option value="${escapeHtml(row.value)}"${isSelected ? " selected" : ""}>${escapeHtml(row.label)}</option>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
