// @ts-check
// js/app/intelControls.js
// Intel helpers for metadata, governance, and controlled recommendation application.
import { resolveAuditRequirementStatus } from "./intelAudit.js";
import { resolveTemplateRecord } from "./templateResolver.js";
import {
  benchmarkScopeLabel,
  benchmarkProfileKeyFromRaceType,
  getBenchmarkProfilePreset,
  normalizeKnownBenchmarkProfileKey,
} from "../core/benchmarkProfiles.js";
import { buildScenarioInputChangeRows } from "../core/scenarioView.js";
import { valuesEqualWithTolerance } from "../core/valueCompare.js";
import {
  clampFiniteNumber,
  coerceFiniteNumber,
  formatFixedNumber,
  formatPercentFromPct,
  formatPercentFromUnit,
  roundToDigits,
  roundWholeNumberByMode,
  safeNum,
} from "../core/utils.js";

const REF_LABELS = {
  "core.universeSize": "Universe size",
  "core.persuasionUniversePct": "Persuasion % of universe",
  "core.supportRatePct": "Support rate %",
  "core.contactRatePct": "Contact rate %",
  "core.turnoutCycleA": "Turnout cycle A %",
  "core.turnoutCycleB": "Turnout cycle B %",
  "core.turnoutBandWidth": "Turnout band width",
  "core.turnoutBaselinePct": "Turnout baseline %",
  "core.gotvLiftPP": "GOTV lift (pp)",
  "core.gotvLiftCeilingPP": "GOTV lift ceiling (pp)",
  "core.orgCount": "Organizer count",
  "core.orgHoursPerWeek": "Organizer hours/week",
  "core.volunteerMultiplier": "Volunteer multiplier",
  "core.channelDoorPct": "Door share %",
  "core.doorsPerHour": "Doors/hour",
  "core.callsPerHour": "Calls/hour",
};

const BRIEF_KIND_LABELS = {
  calibrationSources: "Calibration source",
  scenarioSummary: "Scenario summary",
  scenarioDiff: "Scenario diff",
  driftExplanation: "Drift explanation",
  sensitivityInterpretation: "Sensitivity interpretation",
};

const BRIEF_KIND_LIST = Object.keys(BRIEF_KIND_LABELS);
const AUTO_DRIFT_RECOMMENDATION_SOURCE = "auto.realityDrift.v1";
const DEFAULT_RECOMMENDATION_PRIORITY = 99;

function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function cleanString(v){
  if (v == null) return "";
  return String(v).trim();
}

function toNumOrNull(v){
  return safeNum(v);
}

function normalizeRaceType(v){
  const s = cleanString(v).toLowerCase();
  return s || "all";
}

function recommendationPriorityValue(row){
  const n = Number(row?.priority);
  return Number.isFinite(n) ? n : DEFAULT_RECOMMENDATION_PRIORITY;
}

function listAutoDriftRecommendationsFromIntel(intel, { limit = Infinity } = {}){
  const rows = ensureArray(intel, "recommendations")
    .filter((row) => cleanString(row?.source) === AUTO_DRIFT_RECOMMENDATION_SOURCE)
    .slice()
    .sort((a, b) => recommendationPriorityValue(a) - recommendationPriorityValue(b));
  const cap = Number(limit);
  if (Number.isFinite(cap) && cap > 0){
    const normalizedCap = roundWholeNumberByMode(cap, { mode: "floor", fallback: 0 }) ?? 0;
    return rows.slice(0, normalizedCap);
  }
  return rows;
}

function nowIso(){
  return new Date().toISOString();
}

function makeId(prefix){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseIsoMs(v){
  const s = cleanString(v);
  if (!s) return null;
  const d = new Date(s);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function deriveLegacyGovernanceBaselineIso(auditRows){
  if (!Array.isArray(auditRows) || !auditRows.length) return null;
  let maxMs = null;
  for (const row of auditRows){
    const ms = parseIsoMs(row?.ts || row?.createdAt || row?.updatedAt);
    if (ms == null) continue;
    if (maxMs == null || ms > maxMs) maxMs = ms;
  }
  return maxMs == null ? null : new Date(maxMs).toISOString();
}

function governanceBaselineMs(intel){
  const ms = parseIsoMs(intel?.workflow?.governanceBaselineAt);
  return ms == null ? null : ms;
}

function auditEntryInGovernanceScope(intel, row){
  if (!row || typeof row !== "object") return false;
  if (row.governanceTracked === true) return true;
  const cutoffMs = governanceBaselineMs(intel);
  if (cutoffMs == null) return true;
  const rowMs = parseIsoMs(row?.ts || row?.createdAt || row?.updatedAt);
  if (rowMs == null) return false;
  return rowMs > cutoffMs;
}

function auditCoalesceKey(row){
  if (!row || typeof row !== "object") return "";
  return [
    String(row.kind || ""),
    String(row.source || ""),
    String(row.ref || ""),
    String(row.key || ""),
    row.requiresEvidence === true ? "e1" : "e0",
    row.requiresNote === true ? "n1" : "n0",
  ].join("|");
}

function auditRowMs(row){
  return parseIsoMs(row?.updatedAt || row?.ts || row?.createdAt) ?? -1;
}

function dedupeAuditRows(rows){
  const map = new Map();
  for (const row of (Array.isArray(rows) ? rows : [])){
    const key = auditCoalesceKey(row);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev){
      map.set(key, row);
      continue;
    }
    if (auditRowMs(row) >= auditRowMs(prev)){
      map.set(key, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => auditRowMs(b) - auditRowMs(a));
}

function ensureArray(obj, key){
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key];
}

export function benchmarkRefLabel(ref){
  return REF_LABELS[cleanString(ref)] || cleanString(ref) || "Unknown ref";
}

export function listBenchmarkRefs(){
  return Object.keys(REF_LABELS);
}

export function listIntelBriefKinds(){
  return BRIEF_KIND_LIST.slice();
}

export function intelBriefKindLabel(kind){
  const key = cleanString(kind);
  return BRIEF_KIND_LABELS[key] || key || "Brief";
}

export function ensureIntelCollections(state){
  if (!isObject(state)) return null;
  if (!isObject(state.intelState)){
    state.intelState = { version: "1.0.0" };
  }
  const intel = state.intelState;
  ensureArray(intel, "benchmarks");
  ensureArray(intel, "evidence");
  ensureArray(intel, "audit");
  ensureArray(intel, "briefs");
  ensureArray(intel, "recommendations");
  ensureArray(intel, "observedMetrics");
  ensureArray(intel, "intelRequests");
  ensureArray(intel, "correlationModels");
  ensureArray(intel, "shockScenarios");
  if (!isObject(intel.workflow)){
    intel.workflow = {
      scenarioLocked: false,
      lockReason: "",
      lockedAt: null,
      lockedBy: "",
      governanceBaselineAt: null,
      requireCriticalNote: true,
      requireCriticalEvidence: true,
    };
  } else {
    if (intel.workflow.requireCriticalNote == null) intel.workflow.requireCriticalNote = true;
    if (intel.workflow.requireCriticalEvidence == null) intel.workflow.requireCriticalEvidence = true;
    if (typeof intel.workflow.scenarioLocked !== "boolean") intel.workflow.scenarioLocked = !!intel.workflow.scenarioLocked;
    if (!("lockReason" in intel.workflow)) intel.workflow.lockReason = "";
    if (!("lockedAt" in intel.workflow)) intel.workflow.lockedAt = null;
    if (!("lockedBy" in intel.workflow)) intel.workflow.lockedBy = "";
    if (!("governanceBaselineAt" in intel.workflow)) intel.workflow.governanceBaselineAt = null;
  }
  const hasGovernanceTrackedRows = intel.audit.some((x) => x && x.governanceTracked === true);
  if (!cleanString(intel.workflow.governanceBaselineAt) && !hasGovernanceTrackedRows && intel.audit.length){
    intel.workflow.governanceBaselineAt = deriveLegacyGovernanceBaselineIso(intel.audit);
  }
  if (!isObject(intel.simToggles)){
    intel.simToggles = {
      mcDistribution: "triangular",
      correlatedShocks: false,
      correlationMatrixId: null,
      shockScenariosEnabled: true,
    };
  } else {
    if (!("mcDistribution" in intel.simToggles)) intel.simToggles.mcDistribution = "triangular";
    if (!("correlatedShocks" in intel.simToggles)) intel.simToggles.correlatedShocks = false;
    if (!("correlationMatrixId" in intel.simToggles)) intel.simToggles.correlationMatrixId = null;
    if (!("shockScenariosEnabled" in intel.simToggles)) intel.simToggles.shockScenariosEnabled = true;
  }

  if (!isObject(intel.expertToggles)){
    intel.expertToggles = {
      capacityDecayEnabled: false,
      decayModel: {
        type: "linear",
        weeklyDecayPct: 0.03,
        floorPctOfBaseline: 0.70,
      },
    };
  } else {
    if (!("capacityDecayEnabled" in intel.expertToggles)) intel.expertToggles.capacityDecayEnabled = false;
    if (!isObject(intel.expertToggles.decayModel)){
      intel.expertToggles.decayModel = {
        type: "linear",
        weeklyDecayPct: 0.03,
        floorPctOfBaseline: 0.70,
      };
    } else {
      if (!("type" in intel.expertToggles.decayModel)) intel.expertToggles.decayModel.type = "linear";
      if (!("weeklyDecayPct" in intel.expertToggles.decayModel)) intel.expertToggles.decayModel.weeklyDecayPct = 0.03;
      if (!("floorPctOfBaseline" in intel.expertToggles.decayModel)) intel.expertToggles.decayModel.floorPctOfBaseline = 0.70;
    }
  }
  return intel;
}

export function listIntelBenchmarks(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  return intel.benchmarks.slice();
}

export function listAutoDriftRecommendations(state, { limit = Infinity } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  return listAutoDriftRecommendationsFromIntel(intel, { limit });
}

export function listMissingEvidenceAudit(state, { limit = 200 } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  const rows = intel.audit.filter((x) =>
    auditEntryInGovernanceScope(intel, x) &&
    x &&
    x.requiresEvidence === true &&
    !x.evidenceId &&
    String(x.status || "").toLowerCase() !== "resolved"
  );
  return dedupeAuditRows(rows).slice(0, Math.max(0, Number(limit) || 0));
}

export function listMissingNoteAudit(state, { limit = 200 } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  const rows = intel.audit.filter((x) =>
    auditEntryInGovernanceScope(intel, x) &&
    x &&
    x.requiresNote === true &&
    !cleanString(x.note) &&
    String(x.status || "").toLowerCase() !== "resolved"
  );
  return dedupeAuditRows(rows).slice(0, Math.max(0, Number(limit) || 0));
}

function scoreGrade(score){
  const n = Number(score);
  if (!Number.isFinite(n)) return "F";
  if (n >= 90) return "A";
  if (n >= 80) return "B";
  if (n >= 70) return "C";
  if (n >= 60) return "D";
  return "F";
}

export function computeIntelIntegrityScore(state, {
  benchmarkWarnings = [],
  driftFlags = [],
  staleDays = 30,
} = {}){
  const intel = ensureIntelCollections(state);
  if (!intel){
    return {
      score: 0,
      grade: "F",
      components: {
        missingEvidence: 0,
        missingNote: 0,
        benchmarkWarnings: 0,
        staleEvidence: 0,
        driftFlags: 0,
      },
      penalties: {
        missingEvidence: 0,
        missingNote: 0,
        benchmarkWarnings: 0,
        staleEvidence: 0,
        driftFlags: 0,
      },
      totalPenalty: 100,
    };
  }

  const missingEvidence = listMissingEvidenceAudit(state, { limit: 5000 }).length;
  const missingNote = listMissingNoteAudit(state, { limit: 5000 }).length;
  const benchmarkWarningCount = Array.isArray(benchmarkWarnings) ? benchmarkWarnings.length : 0;
  const driftFlagCount = Array.isArray(driftFlags) ? driftFlags.length : 0;

  let staleEvidence = 0;
  const staleWindowDays = Number(staleDays);
  if (staleWindowDays > 0){
    const cutoffMs = Date.now() - (staleWindowDays * 86400000);
    for (const row of intel.evidence){
      const rowMs = parseIsoMs(row?.updatedAt || row?.capturedAt || row?.ts || row?.timestamp);
      if (rowMs != null && rowMs < cutoffMs) staleEvidence += 1;
    }
  }

  const penalties = {
    missingEvidence: Math.min(40, missingEvidence * 8),
    missingNote: Math.min(24, missingNote * 6),
    benchmarkWarnings: Math.min(20, benchmarkWarningCount * 5),
    staleEvidence: Math.min(10, staleEvidence * 2),
    driftFlags: Math.min(12, driftFlagCount * 3),
  };
  const totalPenalty = Object.values(penalties).reduce((sum, v) => sum + Number(v || 0), 0);
  const roundedScore = roundWholeNumberByMode(100 - totalPenalty, { mode: "round", fallback: 0 }) ?? 0;
  const score = Math.max(0, Math.min(100, roundedScore));

  return {
    score,
    grade: scoreGrade(score),
    components: {
      missingEvidence,
      missingNote,
      benchmarkWarnings: benchmarkWarningCount,
      staleEvidence,
      driftFlags: driftFlagCount,
    },
    penalties,
    totalPenalty,
  };
}

export function getIntelWorkflow(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return null;
  return intel.workflow;
}

export function listIntelEvidence(state, { limit = 12 } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  const rows = intel.evidence.slice();
  rows.sort((a, b) => {
    const at = cleanString(a?.updatedAt || a?.capturedAt);
    const bt = cleanString(b?.updatedAt || b?.capturedAt);
    return bt.localeCompare(at);
  });
  return rows.slice(0, Math.max(0, Number(limit) || 0));
}

export function removeBenchmarkEntry(state, benchmarkId){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };
  const id = cleanString(benchmarkId);
  if (!id) return { ok: false, error: "Benchmark id is required." };

  const idx = intel.benchmarks.findIndex((x) => cleanString(x?.id) === id);
  if (idx < 0) return { ok: false, error: "Benchmark not found." };

  intel.benchmarks.splice(idx, 1);
  return { ok: true };
}

export function upsertBenchmarkEntry(state, payload = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const ref = cleanString(payload.ref);
  if (!ref) return { ok: false, error: "Reference is required." };

  const scope = resolveBenchmarkScope(state, {
    raceTypeInput: payload.raceType,
    benchmarkKeyInput: payload.benchmarkKey || payload.templateBenchmarkKey,
  });
  const raceType = scope.raceType;
  const benchmarkKey = scope.benchmarkKey;
  const min = toNumOrNull(payload.min);
  const max = toNumOrNull(payload.max);
  if (min == null || max == null){
    return { ok: false, error: "Set both range min and range max." };
  }
  if (min != null && max != null && min > max){
    return { ok: false, error: "Range min cannot exceed max." };
  }

  const warnAbove = toNumOrNull(payload.warnAbove);
  const hardAbove = toNumOrNull(payload.hardAbove);
  if (warnAbove != null && hardAbove != null && warnAbove > hardAbove){
    return { ok: false, error: "warnAbove cannot exceed hardAbove." };
  }

  const defaultValue = toNumOrNull(payload.defaultValue);
  const sourceTitle = cleanString(payload.sourceTitle);
  const sourceNotes = cleanString(payload.sourceNotes);

  const now = nowIso();
  const scopeToken = benchmarkScopeToken({ raceType, benchmarkKey });
  const findIndex = intel.benchmarks.findIndex((x) =>
    cleanString(x?.ref) === ref && benchmarkScopeToken(x) === scopeToken
  );

  const existing = findIndex >= 0 ? intel.benchmarks[findIndex] : null;
  const row = {
    id: cleanString(existing?.id) || makeId("bm"),
    ref,
    raceType,
    benchmarkKey,
    range: {
      min,
      max,
    },
    severityBands: {
      warnAbove,
      hardAbove,
    },
    createdAt: cleanString(existing?.createdAt) || now,
    updatedAt: now,
  };

  if (defaultValue != null){
    row.default = defaultValue;
  }

  if (warnAbove != null || hardAbove != null){
    row.severityBands = {};
    if (warnAbove != null) row.severityBands.warnAbove = warnAbove;
    if (hardAbove != null) row.severityBands.hardAbove = hardAbove;
  } else {
    delete row.severityBands;
  }

  if (sourceTitle || sourceNotes){
    row.source = {
      type: "manual",
      title: sourceTitle,
      notes: sourceNotes,
    };
  }

  if (findIndex >= 0){
    intel.benchmarks[findIndex] = row;
    return { ok: true, mode: "updated", row };
  }
  intel.benchmarks.push(row);
  return { ok: true, mode: "created", row };
}

function benchmarkScopeToken(scopeLike){
  const benchmarkKey = normalizeKnownBenchmarkProfileKey(scopeLike?.benchmarkKey || scopeLike?.templateBenchmarkKey);
  if (benchmarkKey) return `key:${benchmarkKey}`;
  return `key:${benchmarkProfileKeyFromRaceType(scopeLike?.raceType)}`;
}

function resolveBenchmarkScope(state, { raceTypeInput = "all", benchmarkKeyInput = "" } = {}){
  const explicitBenchmarkKey = normalizeKnownBenchmarkProfileKey(benchmarkKeyInput);
  if (explicitBenchmarkKey){
    return {
      raceType: normalizeRaceType(raceTypeInput),
      benchmarkKey: explicitBenchmarkKey,
    };
  }

  const raceType = normalizeRaceType(raceTypeInput);
  const raceBenchmarkKey = normalizeKnownBenchmarkProfileKey(raceType);
  if (raceBenchmarkKey){
    return {
      raceType,
      benchmarkKey: raceBenchmarkKey,
    };
  }
  if (raceType !== "all"){
    return {
      raceType,
      benchmarkKey: benchmarkProfileKeyFromRaceType(raceType),
    };
  }

  const stateObj = isObject(state) ? state : {};
  const metaBenchmarkKey = normalizeKnownBenchmarkProfileKey(stateObj?.templateMeta?.benchmarkKey);
  if (metaBenchmarkKey){
    return {
      raceType,
      benchmarkKey: metaBenchmarkKey,
    };
  }

  try{
    const resolved = resolveTemplateRecord(stateObj);
    const templateBenchmarkKey = normalizeKnownBenchmarkProfileKey(resolved?.template?.benchmarkKey);
    if (templateBenchmarkKey){
      return {
        raceType,
        benchmarkKey: templateBenchmarkKey,
      };
    }
  } catch {
    // fall through to legacy race fallback.
  }

  return {
    raceType,
    benchmarkKey: benchmarkProfileKeyFromRaceType(stateObj?.raceType),
  };
}

function mid(min, max){
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return roundToDigits((min + max) / 2, 1, null);
}

function normalizeBenchmarkScopeInput(scopeInput = "all"){
  if (isObject(scopeInput)){
    const scopeValue = cleanString(scopeInput.scope || scopeInput.value);
    return {
      raceTypeInput: cleanString(scopeInput.raceType || scopeValue || "all"),
      benchmarkKeyInput: cleanString(scopeInput.benchmarkKey || scopeInput.templateBenchmarkKey || scopeValue),
    };
  }
  const value = cleanString(scopeInput || "all");
  return {
    raceTypeInput: value || "all",
    benchmarkKeyInput: value,
  };
}

export function loadDefaultBenchmarksForRaceType(state, scopeInput = "all"){
  const scope = resolveBenchmarkScope(state, normalizeBenchmarkScopeInput(scopeInput));
  const raceType = scope.raceType;
  const benchmarkKey = scope.benchmarkKey;
  const preset = getBenchmarkProfilePreset(benchmarkKey);
  if (!preset) return { ok: false, error: "No benchmark preset available." };

  const rows = [
    { ref: "core.contactRatePct", min: preset.contactMin, max: preset.contactMax, defaultValue: mid(preset.contactMin, preset.contactMax), warnAbove: preset.contactMax - 2, hardAbove: preset.contactMax },
    { ref: "core.supportRatePct", min: preset.supportMin, max: preset.supportMax, defaultValue: mid(preset.supportMin, preset.supportMax), warnAbove: preset.supportMax - 3, hardAbove: preset.supportMax },
    { ref: "core.turnoutCycleA", min: preset.turnoutMin, max: preset.turnoutMax, defaultValue: mid(preset.turnoutMin, preset.turnoutMax) },
    { ref: "core.turnoutCycleB", min: preset.turnoutMin, max: preset.turnoutMax, defaultValue: mid(preset.turnoutMin, preset.turnoutMax) },
    { ref: "core.persuasionUniversePct", min: preset.persuasionMin, max: preset.persuasionMax, defaultValue: mid(preset.persuasionMin, preset.persuasionMax) },
  ];

  let created = 0;
  let updated = 0;
  for (const row of rows){
    const res = upsertBenchmarkEntry(state, {
      ...row,
      raceType,
      benchmarkKey,
      sourceTitle: "Built-in benchmark preset",
      sourceNotes: `Preset loaded for benchmark scope '${benchmarkKey}' (legacy race scope '${raceType}').`,
    });
    if (!res.ok){
      return { ok: false, error: res.error || `Failed to load benchmark for ${row.ref}.`, created, updated };
    }
    if (res.mode === "created") created += 1;
    else updated += 1;
  }
  return { ok: true, raceType, benchmarkKey, created, updated, totalApplied: rows.length };
}

export function attachEvidenceRecord(state, payload = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const auditId = cleanString(payload.auditId);
  const title = cleanString(payload.title);
  const source = cleanString(payload.source);
  const notes = cleanString(payload.notes);
  const url = cleanString(payload.url);
  const capturedInput = cleanString(payload.capturedAt);

  let auditEntry = null;
  if (auditId){
    auditEntry = intel.audit.find((x) => cleanString(x?.id) === auditId) || null;
    if (!auditEntry){
      return { ok: false, error: "Selected audit item was not found." };
    }
  }

  const inferredTitle = title || cleanString(auditEntry?.label) || cleanString(auditEntry?.ref) || "Supporting evidence";
  const inferredSource = source || "operator";

  let capturedAt = nowIso();
  if (capturedInput){
    const d = new Date(capturedInput);
    if (Number.isFinite(d.getTime())){
      capturedAt = d.toISOString();
    }
  }

  const evidence = {
    id: makeId("ev"),
    ref: cleanString(auditEntry?.ref),
    title: inferredTitle,
    sourceType: "manual",
    source: inferredSource,
    url: url || null,
    notes: notes || "",
    capturedAt,
    updatedAt: nowIso(),
  };

  intel.evidence.push(evidence);

  if (auditEntry){
    auditEntry.evidenceId = evidence.id;
    const noteFromPayload = cleanString(payload.notes);
    if (auditEntry.requiresNote === true && noteFromPayload){
      auditEntry.note = noteFromPayload;
    }
    auditEntry.status = resolveAuditRequirementStatus(auditEntry);
    auditEntry.resolvedAt = nowIso();
  }

  return { ok: true, evidence, resolvedAuditId: auditEntry?.id || null };
}

function fmtPct(value){
  return formatPercentFromPct(value, 1);
}

function fmtNum(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : formatFixedNumber(n, 2);
}

function fmtRatioPct(value){
  return formatPercentFromUnit(value, 1);
}

function pct1(value){
  const n = coerceFiniteNumber(value);
  if (n == null) return null;
  return roundToDigits(n * 100, 1, null);
}

function num1(value){
  const n = coerceFiniteNumber(value);
  if (n == null) return null;
  return roundToDigits(n, 1, null);
}

function approxEq(a, b, eps = 1e-9){
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= eps;
}

function sanitizeIdPart(v){
  return String(v == null ? "" : v).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isoDateOnly(v){
  if (!v) return "";
  if (v instanceof Date){
    if (!Number.isFinite(v.getTime())) return "";
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function compareObservedMetricRows(a, b){
  if (!a || !b) return false;
  if (cleanString(a.metric) !== cleanString(b.metric)) return false;
  if (cleanString(a.ref) !== cleanString(b.ref)) return false;
  if (cleanString(a.source) !== cleanString(b.source)) return false;
  if (cleanString(a.period?.start) !== cleanString(b.period?.start)) return false;
  if (cleanString(a.period?.end) !== cleanString(b.period?.end)) return false;
  if (!approxEq(a.observed, b.observed)) return false;
  const aa = toNumOrNull(a.assumed);
  const bb = toNumOrNull(b.assumed);
  if (aa == null && bb != null) return false;
  if (aa != null && bb == null) return false;
  if (aa != null && bb != null && !approxEq(aa, bb)) return false;
  const ad = toNumOrNull(a.delta);
  const bd = toNumOrNull(b.delta);
  if (ad == null && bd != null) return false;
  if (ad != null && bd == null) return false;
  if (ad != null && bd != null && !approxEq(ad, bd)) return false;
  const ac = toNumOrNull(a.confidence);
  const bc = toNumOrNull(b.confidence);
  if (ac == null && bc != null) return false;
  if (ac != null && bc == null) return false;
  if (ac != null && bc != null && !approxEq(ac, bc)) return false;
  return cleanString(a.notes) === cleanString(b.notes);
}

function compareRecommendationRows(a, b){
  if (!a || !b) return false;
  if (cleanString(a.id) !== cleanString(b.id)) return false;
  if (cleanString(a.title) !== cleanString(b.title)) return false;
  if (cleanString(a.detail) !== cleanString(b.detail)) return false;
  if (cleanString(a.ref) !== cleanString(b.ref)) return false;
  if (Number(a.priority) !== Number(b.priority)) return false;
  return JSON.stringify(a.draftPatch || null) === JSON.stringify(b.draftPatch || null);
}

function compareFlagRows(a, b){
  if (!a || !b) return false;
  return cleanString(a.id) === cleanString(b.id)
    && cleanString(a.kind) === cleanString(b.kind)
    && cleanString(a.severity) === cleanString(b.severity)
    && cleanString(a.message) === cleanString(b.message)
    && cleanString(a.ref) === cleanString(b.ref);
}

function normalizePatchValue(raw){
  if (typeof raw === "boolean") return raw;
  const n = toNumOrNull(raw);
  if (n != null) return n;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

export function patchValuesEqual(a, b){
  return valuesEqualWithTolerance(a, b, 1e-9);
}

function collectDraftPatchTargets(draftPatch){
  if (!isObject(draftPatch)) return [];
  const out = [];
  const add = (row) => {
    if (!isObject(row)) return;
    const key = cleanString(row.key || row.target);
    if (!key) return;
    const hasSuggested = Object.prototype.hasOwnProperty.call(row, "suggestedValue");
    const hasValue = Object.prototype.hasOwnProperty.call(row, "value");
    const valueRaw = hasSuggested ? row.suggestedValue : (hasValue ? row.value : null);
    const value = normalizePatchValue(valueRaw);
    if (value == null) return;
    out.push({ key, value });
  };

  const type = cleanString(draftPatch.type).toLowerCase();
  if (type === "setinput" || type === "set_input"){
    add(draftPatch);
  } else if (type === "setinputs" || type === "set_inputs"){
    const rows = Array.isArray(draftPatch.targets) ? draftPatch.targets : [];
    for (const row of rows) add(row);
  }
  return out;
}

function pickRecommendationRow(intel, recommendationId = ""){
  const rows = ensureArray(intel, "recommendations");
  const wanted = cleanString(recommendationId);
  if (wanted){
    return rows.find((row) => cleanString(row?.id) === wanted) || null;
  }
  return listAutoDriftRecommendationsFromIntel(intel, { limit: 1 })[0] || null;
}

export function resolveRecommendationForApply(state, recommendationId = ""){
  const intel = ensureIntelCollections(state);
  if (!intel) return null;
  return pickRecommendationRow(intel, recommendationId);
}

export function applyRecommendationDraftPatch(state, {
  recommendationId = "",
  setPendingNoteMarker = true,
} = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const rec = pickRecommendationRow(intel, recommendationId);
  if (!rec){
    return { ok: false, error: "No recommendation is available to apply." };
  }

  const targets = collectDraftPatchTargets(rec.draftPatch);
  if (!targets.length){
    return { ok: false, error: "Recommendation draft patch has no supported targets.", recommendationId: cleanString(rec.id) };
  }

  const now = nowIso();
  const changes = [];
  const unknownKeys = [];

  for (const target of targets){
    const key = cleanString(target?.key);
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(state, key)){
      unknownKeys.push(key);
      continue;
    }
    const before = state[key];
    const after = target.value;
    if (patchValuesEqual(before, after)) continue;
    state[key] = after;
    changes.push({ key, before, after });
  }

  if (!changes.length){
    rec.updatedAt = now;
    rec.lastAppliedAt = now;
    rec.status = "alreadyApplied";
    if (!Array.isArray(rec.appliedAuditIds)) rec.appliedAuditIds = [];
    return {
      ok: true,
      noop: true,
      recommendationId: cleanString(rec.id),
      recommendationTitle: cleanString(rec.title),
      changes: [],
      unknownKeys,
      noteMarker: "",
    };
  }

  let noteMarker = "";
  const workflow = getIntelWorkflow(state) || {};
  if (setPendingNoteMarker && workflow.requireCriticalNote !== false){
    noteMarker = `[rec:${cleanString(rec.id) || "unknown"}] ${cleanString(rec.title) || "Applied recommendation"}`;
    if (!isObject(state.ui)) state.ui = {};
    const prevNote = cleanString(state.ui.pendingCriticalNote);
    if (!prevNote.includes(noteMarker)){
      state.ui.pendingCriticalNote = prevNote ? `${prevNote}\n${noteMarker}` : noteMarker;
    }
  }

  rec.updatedAt = now;
  rec.lastAppliedAt = now;
  rec.applyCount = Math.max(0, Number(rec.applyCount) || 0) + 1;
  rec.status = "applied";
  rec.lastAppliedChanges = changes.map((row) => ({
    key: row.key,
    before: row.before,
    after: row.after,
  }));
  if (!Array.isArray(rec.appliedAuditIds)) rec.appliedAuditIds = [];

  return {
    ok: true,
    noop: false,
    recommendationId: cleanString(rec.id),
    recommendationTitle: cleanString(rec.title),
    changes,
    unknownKeys,
    noteMarker,
  };
}

function recommendationAuditRowMatchesChange(row, change){
  return (
    row &&
    row.kind === "critical_ref_change" &&
    cleanString(row.source) === "ui" &&
    cleanString(row.key) === cleanString(change?.key) &&
    patchValuesEqual(row.after, change?.after)
  );
}

export function applyTopDriftRecommendation(state){
  const top = resolveRecommendationForApply(state, "");
  if (!top){
    return {
      ok: false,
      code: "missing_recommendation",
      error: "No active drift recommendation to apply.",
    };
  }

  const result = applyRecommendationDraftPatch(state, { recommendationId: cleanString(top.id) });
  if (!result?.ok){
    return {
      ok: false,
      code: "apply_recommendation_failed",
      error: String(result?.error || "Failed to apply recommendation patch."),
    };
  }

  const linkedAuditIds = [];
  const auditRows = Array.isArray(state?.intelState?.audit) ? state.intelState.audit.slice().reverse() : [];
  if (result.noteMarker){
    for (const row of auditRows){
      if (!row || typeof row !== "object") continue;
      if (!cleanString(row.note).includes(result.noteMarker)) continue;
      const id = cleanString(row.id);
      if (id && !linkedAuditIds.includes(id)) linkedAuditIds.push(id);
    }
  }
  if (!linkedAuditIds.length && Array.isArray(result.changes) && result.changes.length){
    for (const change of result.changes){
      const match = auditRows.find((row) => recommendationAuditRowMatchesChange(row, change));
      const id = cleanString(match?.id);
      if (id && !linkedAuditIds.includes(id)) linkedAuditIds.push(id);
    }
  }

  const recommendationId = cleanString(result.recommendationId);
  const recRow = Array.isArray(state?.intelState?.recommendations)
    ? state.intelState.recommendations.find((row) => cleanString(row?.id) === recommendationId)
    : null;
  let needsGovernance = false;
  if (recRow){
    recRow.appliedAuditIds = linkedAuditIds.slice();
    recRow.updatedAt = nowIso();
    const unresolved = (Array.isArray(state?.intelState?.audit) ? state.intelState.audit : [])
      .filter((row) => recRow.appliedAuditIds.includes(cleanString(row?.id)))
      .filter((row) => cleanString(row?.status).toLowerCase() !== "resolved");
    needsGovernance = unresolved.length > 0;
    recRow.status = needsGovernance ? "appliedNeedsGovernance" : (result.noop ? "alreadyApplied" : "applied");
  }

  const changes = Array.isArray(result.changes) ? result.changes.slice() : [];
  return {
    ok: true,
    recommendationId,
    recommendationTitle: cleanString(result.recommendationTitle),
    changes,
    changesCount: changes.length,
    noop: !!result.noop,
    needsGovernance,
    linkedAuditIds,
    noteMarker: cleanString(result.noteMarker),
  };
}

const WHAT_IF_FIELD_SPECS = [
  { key: "supportRatePct", ref: "core.supportRatePct", label: "Support rate %", unit: "pct", patterns: [/\bsupport\s*rate\b/i, /\bsr\b/i] },
  { key: "contactRatePct", ref: "core.contactRatePct", label: "Contact rate %", unit: "pct", patterns: [/\bcontact\s*rate\b/i, /\bcr\b/i] },
  { key: "turnoutBaselinePct", ref: "core.turnoutBaselinePct", label: "Turnout baseline %", unit: "pct", patterns: [/\bturnout\s*baseline\b/i, /\bbaseline\s*turnout\b/i] },
  { key: "gotvLiftPP", ref: "core.gotvLiftPP", label: "GOTV lift (pp)", unit: "pp", patterns: [/\bgotv\s*lift\b/i, /\blift\s*per\s*contact\b/i] },
  { key: "gotvMaxLiftPP", ref: "core.gotvLiftCeilingPP", label: "Max lift ceiling (pp)", unit: "pp", patterns: [/\bmax\s*lift\b/i, /\blift\s*ceiling\b/i] },
  { key: "doorsPerHour3", ref: "core.doorsPerHour", label: "Doors/hour", unit: "attempts_per_hour", patterns: [/\bdoors?\s*per\s*hour\b/i, /\bdph\b/i] },
  { key: "callsPerHour3", ref: "core.callsPerHour", label: "Calls/hour", unit: "attempts_per_hour", patterns: [/\bcalls?\s*per\s*hour\b/i, /\bcph\b/i] },
  { key: "orgCount", ref: "core.orgCount", label: "Organizer count", unit: "count", patterns: [/\borganizers?\b/i, /\borganizer\s*count\b/i] },
  { key: "orgHoursPerWeek", ref: "core.orgHoursPerWeek", label: "Organizer hours/week", unit: "hours_per_week", patterns: [/\borganizer\s*hours?\b/i, /\bhours?\s*per\s*week\b/i] },
  { key: "volunteerMultBase", ref: "core.volunteerMultiplier", label: "Volunteer multiplier", unit: "multiplier", patterns: [/\bvolunteer\s*multiplier\b/i, /\bvol\s*mult\b/i] },
  { key: "persuasionPct", ref: "core.persuasionUniversePct", label: "Persuasion % of universe", unit: "pct", patterns: [/\bpersuasion\s*(?:pct|percent|%)\b/i, /\bpersuasion\s*of\s*universe\b/i] },
  { key: "universeSize", ref: "core.universeSize", label: "Universe size", unit: "count", patterns: [/\buniverse\s*size\b/i] },
  { key: "weeksRemaining", ref: "core.weeksRemaining", label: "Weeks remaining", unit: "weeks", patterns: [/\bweeks?\s*remaining\b/i] },
];

function splitWhatIfSegments(text){
  return String(text || "")
    .split(/[\n,;]+|\s+\band\b\s+/i)
    .map((s) => cleanString(s))
    .filter(Boolean);
}

function pickWhatIfField(segment){
  for (const spec of WHAT_IF_FIELD_SPECS){
    for (const pattern of spec.patterns){
      if (pattern.test(segment)) return spec;
    }
  }
  return null;
}

function detectDeltaDirection(segment){
  const s = String(segment || "").toLowerCase();
  if (/\b(decrease|lower|reduce|drop|minus|down)\b/.test(s)) return -1;
  if (/\b(increase|raise|add|plus|up)\b/.test(s)) return 1;
  return 0;
}

function parseWhatIfSegment(segment, state){
  const spec = pickWhatIfField(segment);
  if (!spec) return { ok: false, reason: "unknown_field", segment };
  const match = String(segment).match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return { ok: false, reason: "missing_value", segment, field: spec.key };
  let n = Number(match[0]);
  if (!Number.isFinite(n)) return { ok: false, reason: "invalid_value", segment, field: spec.key };
  const matchToken = String(match[0] || "");
  const dir = detectDeltaDirection(segment);
  let isDelta = /^[+-]/.test(matchToken) || dir !== 0;
  if (dir < 0 && n > 0) n = -Math.abs(n);
  if (dir > 0 && n < 0) n = Math.abs(n);

  let value = n;
  let scaledFromDecimal = false;
  if (!isDelta && spec.unit === "pct"){
    const hasPctMarker = /%|percent|pct/i.test(segment);
    if (!hasPctMarker && value > 0 && value <= 1){
      value = value * 100;
      scaledFromDecimal = true;
    }
  }

  const target = {
    key: spec.key,
    ref: spec.ref,
    label: spec.label,
    unit: spec.unit,
    op: isDelta ? "delta" : "set",
    raw: cleanString(segment),
    value,
  };
  if (scaledFromDecimal) target.scaledFromDecimal = true;
  if (isDelta){
    target.delta = value;
    const base = toNumOrNull(state?.[spec.key]);
    if (base != null){
      target.baseValue = base;
      target.suggestedValue = base + value;
    }
  } else {
    target.suggestedValue = value;
  }
  return { ok: true, target };
}

function summarizeParsedRequest(parsed){
  const targets = Array.isArray(parsed?.targets) ? parsed.targets : [];
  if (!targets.length) return "No recognized fields.";
  const first = targets[0];
  const action = first?.op === "delta"
    ? `${first.label}: ${fmtSignedNum(first.delta, 2)}`
    : `${first.label}: ${fmtAny(first.suggestedValue)}`;
  const extra = targets.length > 1 ? ` (+${targets.length - 1} more)` : "";
  return `${action}${extra}`;
}

export function createWhatIfIntelRequest(state, requestText = "", { source = "user.whatIf.v1", maxEntries = 120 } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const text = cleanString(requestText);
  if (!text) return { ok: false, error: "Enter a what-if request first." };

  const segments = splitWhatIfSegments(text);
  if (!segments.length) return { ok: false, error: "Could not parse request text." };

  const targets = [];
  const unresolvedSegments = [];
  for (const seg of segments){
    const parsed = parseWhatIfSegment(seg, state);
    if (parsed.ok){
      targets.push(parsed.target);
    } else {
      unresolvedSegments.push({
        segment: cleanString(seg),
        reason: cleanString(parsed.reason) || "unresolved",
        field: cleanString(parsed.field),
      });
    }
  }

  if (!targets.length){
    return { ok: false, error: "No recognized assumptions in request. Try support rate, contact rate, turnout baseline, GOTV lift, doors/hour.", unresolvedSegments };
  }

  const now = nowIso();
  const row = {
    id: makeId("ireq"),
    source: cleanString(source) || "user.whatIf.v1",
    status: unresolvedSegments.length ? "partial" : "parsed",
    prompt: text,
    summary: "",
    parsed: {
      action: "what_if",
      parserVersion: "manual.rules.v1",
      targets,
      unresolvedSegments,
      targetCount: targets.length,
      unresolvedCount: unresolvedSegments.length,
    },
    createdAt: now,
    updatedAt: now,
  };
  row.summary = summarizeParsedRequest(row.parsed);

  ensureArray(intel, "intelRequests").push(row);
  if (intel.intelRequests.length > maxEntries){
    intel.intelRequests = intel.intelRequests.slice(-Math.max(1, Number(maxEntries) || 120));
  }

  return {
    ok: true,
    row,
    parsedTargets: targets.length,
    unresolved: unresolvedSegments.length,
  };
}

export function listIntelRequests(state, { limit = 20 } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  const rows = ensureArray(intel, "intelRequests").slice();
  rows.sort((a, b) => cleanString(b?.createdAt).localeCompare(cleanString(a?.createdAt)));
  return rows.slice(0, Math.max(0, Number(limit) || 0));
}

export function getLatestBriefByKind(state, kind){
  const intel = ensureIntelCollections(state);
  if (!intel) return null;
  const targetKind = cleanString(kind);
  if (!targetKind) return null;
  const rows = intel.briefs
    .filter((x) => cleanString(x?.kind) === targetKind)
    .slice()
    .sort((a, b) => cleanString(b?.createdAt).localeCompare(cleanString(a?.createdAt)));
  return rows[0] || null;
}

function pushBriefRow(intel, { kind, content, promptId = "", model = "manual" } = {}){
  const brief = {
    id: makeId("brief"),
    kind: cleanString(kind) || "calibrationSources",
    content: String(content || "").trim(),
    promptId: cleanString(promptId),
    model: cleanString(model) || "manual",
    createdAt: nowIso(),
  };
  ensureArray(intel, "briefs").push(brief);
  return brief;
}

function fmtSignedNum(value, digits = 0){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = formatFixedNumber(Math.abs(n), Math.max(0, digits | 0), "0");
  const compact = abs.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${n >= 0 ? "+" : "-"}${compact}`;
}

function fmtAny(value){
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return fmtNum(value);
  return String(value);
}

function fmtIsoDate(value){
  const s = cleanString(value);
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

function pickScenarioRecord(state, scenarioId){
  const reg = state?.ui?.scenarios;
  if (!isObject(reg)) return null;
  const sid = cleanString(scenarioId);
  if (!sid) return null;
  return isObject(reg[sid]) ? reg[sid] : null;
}

function currentScenarioRecord(state){
  const activeId = cleanString(state?.ui?.activeScenarioId);
  return pickScenarioRecord(state, activeId) || null;
}

function baselineScenarioRecord(state){
  return pickScenarioRecord(state, "baseline") || null;
}

function summarizeScenarioOutputs(record, fallbackSummary = null){
  const recSummary = record?.outputs?.summary;
  if (isObject(recSummary) && Object.keys(recSummary).length){
    return recSummary;
  }
  if (isObject(fallbackSummary) && Object.keys(fallbackSummary).length){
    return fallbackSummary;
  }
  return {};
}

export function captureObservedMetricsFromDrift(state, drift = null, { source = "dailyLog.rolling7", maxEntries = 180 } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };
  if (!drift?.hasLog){
    return { ok: false, error: "No daily log data available yet." };
  }

  const start = isoDateOnly(drift?.windowStart || drift?.firstDate) || isoDateOnly(new Date());
  const end = isoDateOnly(drift?.windowEnd || drift?.lastDate) || start;
  const stamp = `${end}T00:00:00.000Z`;
  const entries = Math.max(0, Number(drift?.windowEntries) || 0);
  const confidence = clampFiniteNumber(entries / 10, 0, 1);

  const rows = [
    {
      metric: "contactRate",
      ref: "core.contactRatePct",
      observed: toNumOrNull(drift?.actualCR),
      assumed: toNumOrNull(drift?.assumedCR),
      notes: "Rolling contact rate from organizer daily log window.",
    },
    {
      metric: "supportRate",
      ref: "core.supportRatePct",
      observed: toNumOrNull(drift?.actualSR),
      assumed: toNumOrNull(drift?.assumedSR),
      notes: "Rolling support conversion from organizer daily log window.",
    },
    {
      metric: "attemptsPerOrgHour",
      ref: "core.productivityAttemptsPerHour",
      observed: toNumOrNull(drift?.actualAPH),
      assumed: toNumOrNull(drift?.expectedAPH),
      notes: "Rolling organizer productivity (attempts per organizer hour).",
    },
  ].filter((x) => x.observed != null);

  if (!rows.length){
    return { ok: false, error: "No observed drift metrics are available yet." };
  }

  if (!Array.isArray(intel.observedMetrics)) intel.observedMetrics = [];
  let created = 0;
  let updated = 0;

  for (const row of rows){
    const id = `obs_${sanitizeIdPart(row.metric)}_${sanitizeIdPart(start)}_${sanitizeIdPart(end)}`;
    const delta = (row.assumed != null) ? (row.observed - row.assumed) : null;
    const next = {
      id,
      metric: row.metric,
      ref: row.ref,
      period: { start, end },
      observed: row.observed,
      source,
      notes: row.notes,
      confidence,
      assumed: row.assumed,
      delta,
      createdAt: stamp,
      updatedAt: stamp,
    };

    const idx = intel.observedMetrics.findIndex((x) => cleanString(x?.id) === id);
    if (idx < 0){
      intel.observedMetrics.push(next);
      created += 1;
      continue;
    }

    const prev = intel.observedMetrics[idx];
    const merged = {
      ...prev,
      ...next,
      createdAt: cleanString(prev?.createdAt) || next.createdAt,
      updatedAt: compareObservedMetricRows(prev, next)
        ? (cleanString(prev?.updatedAt) || next.updatedAt)
        : stamp,
    };
    if (!compareObservedMetricRows(prev, merged)){
      intel.observedMetrics[idx] = merged;
      updated += 1;
    }
  }

  if (intel.observedMetrics.length > maxEntries){
    intel.observedMetrics.sort((a, b) => {
      const ae = cleanString(a?.period?.end);
      const be = cleanString(b?.period?.end);
      if (ae !== be) return be.localeCompare(ae);
      return cleanString(b?.id).localeCompare(cleanString(a?.id));
    });
    intel.observedMetrics = intel.observedMetrics.slice(0, Math.max(1, Number(maxEntries) || 180));
  }

  return { ok: true, created, updated, total: intel.observedMetrics.length, period: { start, end } };
}

export function refreshDriftRecommendationsFromDrift(state, drift = null, { maxEntries = 60 } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const now = nowIso();
  const source = AUTO_DRIFT_RECOMMENDATION_SOURCE;
  const manualRecs = ensureArray(intel, "recommendations").filter((x) => cleanString(x?.source) !== source);
  const existingAutoRec = ensureArray(intel, "recommendations").filter((x) => cleanString(x?.source) === source);
  const manualFlags = ensureArray(intel, "flags").filter((x) => cleanString(x?.source) !== source);
  const existingAutoFlags = ensureArray(intel, "flags").filter((x) => cleanString(x?.source) === source);

  if (!drift?.hasLog){
    intel.recommendations = manualRecs.slice(0, Math.max(1, Number(maxEntries) || 60));
    intel.flags = manualFlags;
    return { ok: true, created: 0, updated: 0, total: intel.recommendations.length, cleared: existingAutoRec.length };
  }

  const defs = [
    {
      key: "contact",
      metric: "contactRate",
      ref: "core.contactRatePct",
      actual: toNumOrNull(drift.actualCR),
      assumed: toNumOrNull(drift.assumedCR),
      title: "Contact rate is below plan",
      detail: "Improve list quality/script/time slot, or align assumption to rolling CR.",
      makePatch: () => ({
        type: "setInput",
        target: "contactRatePct",
        suggestedValue: pct1(drift.actualCR),
        unit: "pct",
      }),
    },
    {
      key: "support",
      metric: "supportRate",
      ref: "core.supportRatePct",
      actual: toNumOrNull(drift.actualSR),
      assumed: toNumOrNull(drift.assumedSR),
      title: "Support conversion is below plan",
      detail: "Improve persuasion quality/script targeting, or align assumption to rolling SR.",
      makePatch: () => ({
        type: "setInput",
        target: "supportRatePct",
        suggestedValue: pct1(drift.actualSR),
        unit: "pct",
      }),
    },
    {
      key: "productivity",
      metric: "attemptsPerOrgHour",
      ref: "core.productivityAttemptsPerHour",
      actual: toNumOrNull(drift.actualAPH),
      assumed: toNumOrNull(drift.expectedAPH),
      title: "Organizer productivity is below plan",
      detail: "Adjust doors/calls per hour assumptions or increase execution capacity.",
      makePatch: () => {
        const curDoors = toNumOrNull(state?.doorsPerHour3);
        const curCalls = toNumOrNull(state?.callsPerHour3);
        const ratioRaw = (drift?.actualAPH != null && drift?.expectedAPH != null && drift.expectedAPH > 0)
          ? (drift.actualAPH / drift.expectedAPH)
          : null;
        const ratio = ratioRaw == null ? null : Math.min(1.5, Math.max(0.5, ratioRaw));
        const nextDoors = (ratio != null && curDoors != null) ? num1(Math.max(1, curDoors * ratio)) : null;
        const nextCalls = (ratio != null && curCalls != null) ? num1(Math.max(1, curCalls * ratio)) : null;
        return {
          type: "setInputs",
          targets: [
            { key: "doorsPerHour3", suggestedValue: nextDoors, unit: "attempts_per_hour" },
            { key: "callsPerHour3", suggestedValue: nextCalls, unit: "attempts_per_hour" },
          ].filter((x) => x.suggestedValue != null),
          ratioApplied: ratio,
        };
      },
    },
  ];

  const nextAutoRecs = [];
  const nextAutoFlags = [];

  for (const def of defs){
    if (def.actual == null || def.assumed == null || def.assumed <= 0) continue;
    const ratio = def.actual / def.assumed;
    if (!(ratio < 0.90)) continue;
    const severityRatio = clampFiniteNumber((def.assumed - def.actual) / def.assumed, 0, 1);
    const severity = severityRatio >= 0.25 ? "bad" : "warn";
    const priority = severityRatio >= 0.30 ? 1 : (severityRatio >= 0.15 ? 2 : 3);
    const id = `rec_drift_${def.key}`;
    const actualText = (def.metric === "attemptsPerOrgHour") ? fmtNum(def.actual) : fmtRatioPct(def.actual);
    const assumedText = (def.metric === "attemptsPerOrgHour") ? fmtNum(def.assumed) : fmtRatioPct(def.assumed);
    const detail = `${def.detail} Rolling observed ${actualText} vs assumed ${assumedText}.`;

    const previous = existingAutoRec.find((x) => cleanString(x?.id) === id);
    const nextRec = {
      id,
      title: def.title,
      detail,
      priority,
      ref: def.ref,
      metric: def.metric,
      source,
      createdAt: cleanString(previous?.createdAt) || now,
      updatedAt: now,
      draftPatch: def.makePatch(),
    };
    if (previous && compareRecommendationRows(previous, nextRec)){
      nextRec.updatedAt = cleanString(previous?.updatedAt) || nextRec.updatedAt;
    }
    nextAutoRecs.push(nextRec);

    const flagId = `flag_drift_${def.key}`;
    const previousFlag = existingAutoFlags.find((x) => cleanString(x?.id) === flagId);
    const nextFlag = {
      id: flagId,
      kind: "realityDrift",
      severity,
      message: `${def.title}: rolling ${actualText} vs assumed ${assumedText}.`,
      ref: def.ref,
      source,
      createdAt: cleanString(previousFlag?.createdAt) || now,
      updatedAt: now,
      metric: def.metric,
      primary: cleanString(drift?.primary) === def.key,
    };
    if (previousFlag && compareFlagRows(previousFlag, nextFlag)){
      nextFlag.updatedAt = cleanString(previousFlag?.updatedAt) || nextFlag.updatedAt;
    }
    nextAutoFlags.push(nextFlag);
  }

  nextAutoRecs.sort((a, b) => Number(a.priority) - Number(b.priority));
  const nextRecommendations = [...manualRecs, ...nextAutoRecs].slice(0, Math.max(1, Number(maxEntries) || 60));
  const nextFlags = [...manualFlags, ...nextAutoFlags];

  const created = nextAutoRecs.filter((x) => !existingAutoRec.some((e) => cleanString(e?.id) === cleanString(x?.id))).length;
  const updated = nextAutoRecs.length - created;
  const cleared = Math.max(0, existingAutoRec.length - nextAutoRecs.length);

  intel.recommendations = nextRecommendations;
  intel.flags = nextFlags;
  return {
    ok: true,
    created,
    updated,
    cleared,
    total: intel.recommendations.length,
    autoTotal: nextAutoRecs.length,
  };
}

export function captureObservedAndRefreshDriftRecommendations(state, {
  drift = null,
  observedSource = "dailyLog.rolling7",
  observedMaxEntries = 180,
  recommendationMaxEntries = 60,
} = {}){
  const metricsResult = captureObservedMetricsFromDrift(state, drift, {
    source: observedSource,
    maxEntries: observedMaxEntries,
  });
  const recommendationResult = refreshDriftRecommendationsFromDrift(state, drift, {
    maxEntries: recommendationMaxEntries,
  });
  return {
    ok: !!recommendationResult?.ok,
    metricsResult,
    recommendationResult,
  };
}

export function generateCalibrationSourceBrief(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const now = nowIso();
  const raceType = cleanString(state?.raceType) || "unknown";
  const benchmarkScope = resolveBenchmarkScope(state, { raceTypeInput: "all" });
  const scenarioName = cleanString(state?.scenarioName) || "Unnamed scenario";
  const benchmarks = listIntelBenchmarks(state);
  const missingEvidence = listMissingEvidenceAudit(state, { limit: 500 }).length;
  const evidenceCount = ensureArray(intel, "evidence").length;
  const shockScenarioCount = ensureArray(intel, "shockScenarios").length;

  const benchmarkLines = benchmarks.length
    ? benchmarks.slice(0, 12).map((b) => {
      const ref = benchmarkRefLabel(b?.ref);
      const scope = cleanString(b?.benchmarkKey || b?.templateBenchmarkKey || b?.raceType) || "all";
      const scopeLabel = benchmarkScopeLabel(scope);
      const min = fmtNum(b?.range?.min);
      const max = fmtNum(b?.range?.max);
      const warn = fmtNum(b?.severityBands?.warnAbove);
      const hard = fmtNum(b?.severityBands?.hardAbove);
      const source = cleanString(b?.source?.title) || cleanString(b?.source?.type) || "manual";
      return `- ${ref} [${scopeLabel}] range ${min}..${max}; warn/hard ${warn}/${hard}; source: ${source}`;
    }).join("\n")
    : "- No benchmark entries configured.";

  const content = [
    `# Model calibration sources`,
    ``,
    `Generated: ${now}`,
    `Scenario: ${scenarioName}`,
    `Race type: ${raceType}`,
    `Template benchmark scope: ${cleanString(benchmarkScope?.benchmarkKey) || "default"}`,
    ``,
    `## Benchmark catalog`,
    benchmarkLines,
    ``,
    `## Evidence coverage`,
    `- Evidence records: ${evidenceCount}`,
    `- Critical edits missing evidence: ${missingEvidence}`,
    ``,
    `## Monte Carlo calibration toggles`,
    `- Distribution: ${cleanString(intel?.simToggles?.mcDistribution) || "triangular"}`,
    `- Correlated shocks: ${intel?.simToggles?.correlatedShocks ? "ON" : "OFF"}`,
    `- Correlation model id: ${cleanString(intel?.simToggles?.correlationMatrixId) || "none"}`,
    `- Shock scenarios enabled: ${intel?.simToggles?.shockScenariosEnabled ? "ON" : "OFF"}`,
    `- Shock scenarios configured: ${shockScenarioCount}`,
    ``,
    `## Capacity realism`,
    `- Capacity decay enabled: ${intel?.expertToggles?.capacityDecayEnabled ? "ON" : "OFF"}`,
    `- Decay model: ${cleanString(intel?.expertToggles?.decayModel?.type) || "linear"}`,
    `- Weekly decay %: ${fmtRatioPct(intel?.expertToggles?.decayModel?.weeklyDecayPct)}`,
    `- Floor % of baseline: ${fmtRatioPct(intel?.expertToggles?.decayModel?.floorPctOfBaseline)}`,
    ``,
    `## Current planner assumptions (selected)`,
    `- Support rate: ${fmtPct(state?.supportRatePct)}`,
    `- Contact rate: ${fmtPct(state?.contactRatePct)}`,
    `- Turnout baseline: ${fmtPct(state?.turnoutBaselinePct)}`,
    `- GOTV lift per contact: ${fmtNum(state?.gotvLiftPP)} pp`,
    `- GOTV max lift ceiling: ${fmtNum(state?.gotvMaxLiftPP)} pp`,
    ``,
    `## Notes`,
    `- This brief documents calibration inputs and evidence status.`,
    `- It does not alter deterministic or Monte Carlo outputs.`,
  ].join("\n");
  const brief = pushBriefRow(intel, {
    kind: "calibrationSources",
    content,
    promptId: "manual.calibrationSources.v1",
    model: "manual",
  });
  return { ok: true, brief };
}

export function generateScenarioSummaryBrief(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const rec = currentScenarioRecord(state);
  const scenarioId = cleanString(state?.ui?.activeScenarioId) || cleanString(rec?.id) || "baseline";
  const scenarioName = cleanString(rec?.name) || cleanString(state?.scenarioName) || scenarioId;
  const benchmarkScope = resolveBenchmarkScope(state, { raceTypeInput: "all" });
  const summary = summarizeScenarioOutputs(rec, state?.ui?.lastSummary);
  const mc = state?.mcLast;
  const missingEvidence = listMissingEvidenceAudit(state, { limit: 500 }).length;
  const missingNote = listMissingNoteAudit(state, { limit: 500 }).length;
  const benchmarkCount = ensureArray(intel, "benchmarks").length;
  const evidenceCount = ensureArray(intel, "evidence").length;

  const lines = [
    `# Scenario summary`,
    ``,
    `Generated: ${nowIso()}`,
    `Scenario: ${scenarioName} (${scenarioId})`,
    `Race type: ${cleanString(state?.raceType) || "—"}`,
    `Template benchmark scope: ${cleanString(benchmarkScope?.benchmarkKey) || "default"}`,
    `Mode: ${cleanString(state?.mode) || "—"}`,
    `Election date: ${cleanString(state?.electionDate) || "—"}`,
    ``,
    `## Core assumptions`,
    `- Universe size: ${fmtNum(state?.universeSize)}`,
    `- Persuasion % of universe: ${fmtNum(state?.persuasionPct)}`,
    `- Contact rate: ${fmtPct(state?.contactRatePct)}`,
    `- Support rate: ${fmtPct(state?.supportRatePct)}`,
    `- Organizers: ${fmtNum(state?.orgCount)}`,
    `- Organizer hours/week: ${fmtNum(state?.orgHoursPerWeek)}`,
    `- Volunteer multiplier: ${fmtNum(state?.volunteerMultBase)}`,
    ``,
    `## Latest plan summary`,
    `- Objective: ${cleanString(summary?.objective) || "—"}`,
    `- Expected net votes: ${fmtNum(summary?.expectedNetVotes)}`,
    `- Total cost: ${fmtNum(summary?.totalCost)}`,
    `- Feasibility: ${summary?.feasibility === true ? "true" : summary?.feasibility === false ? "false" : "—"}`,
    `- Primary bottleneck: ${cleanString(summary?.primaryBottleneck) || "—"}`,
    `- Snapshot hash: ${cleanString(summary?.snapshotHash) || "—"}`,
    ``,
    `## Monte Carlo snapshot`,
    `- Runs: ${fmtNum(mc?.runs)}`,
    `- Win probability: ${fmtRatioPct(mc?.winProb)}`,
    `- Median margin: ${fmtSignedNum(mc?.median, 0)}`,
    `- P10 / P90: ${fmtSignedNum(mc?.p10, 0)} / ${fmtSignedNum(mc?.p90, 0)}`,
    ``,
    `## Governance status`,
    `- Benchmarks configured: ${benchmarkCount}`,
    `- Evidence records: ${evidenceCount}`,
    `- Missing evidence items: ${missingEvidence}`,
    `- Missing note items: ${missingNote}`,
  ];

  const brief = pushBriefRow(intel, {
    kind: "scenarioSummary",
    content: lines.join("\n"),
    promptId: "manual.scenarioSummary.v1",
    model: "manual",
  });
  return { ok: true, brief };
}

export function generateScenarioDiffBrief(state, { baselineId = "baseline" } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const activeRec = currentScenarioRecord(state);
  const baseRec = pickScenarioRecord(state, baselineId) || baselineScenarioRecord(state);
  if (!baseRec || !activeRec){
    return { ok: false, error: "Baseline or active scenario record is unavailable." };
  }
  if (cleanString(activeRec.id) === cleanString(baseRec.id)){
    return { ok: false, error: "Active scenario is baseline. Create or load another scenario to diff." };
  }

  const baseInputs = isObject(baseRec?.inputs) ? baseRec.inputs : {};
  const activeInputs = isObject(activeRec?.inputs) ? activeRec.inputs : {};
  const labels = {
    raceType: "Race type",
    mode: "Mode",
    electionDate: "Election date",
    weeksRemaining: "Weeks remaining override",
    universeBasis: "Universe basis",
    universeSize: "Universe size",
    persuasionPct: "Persuasion % of universe",
    supportRatePct: "Support rate %",
    contactRatePct: "Contact rate %",
    turnoutCycleA: "Turnout cycle A %",
    turnoutCycleB: "Turnout cycle B %",
    bandWidth: "Turnout band width",
    orgCount: "Organizers",
    orgHoursPerWeek: "Organizer hours/week",
    volunteerMultBase: "Volunteer multiplier",
    channelDoorPct: "Door share %",
    doorsPerHour3: "Doors/hour",
    callsPerHour3: "Calls/hour",
  };
  const changed = buildScenarioInputChangeRows({
    baselineInputs: baseInputs,
    activeInputs,
    labels,
    ignoreKeys: ["ui", "mcLast", "mcLastHash"],
  });

  const baseSummary = summarizeScenarioOutputs(baseRec);
  const activeSummary = summarizeScenarioOutputs(activeRec, state?.ui?.lastSummary);
  const compareLine = (label, key) => {
    const b = baseSummary?.[key];
    const a = activeSummary?.[key];
    if (key === "feasibility"){
      const bv = b === true ? "true" : b === false ? "false" : "—";
      const av = a === true ? "true" : a === false ? "false" : "—";
      return `- ${label}: ${bv} -> ${av}`;
    }
    return `- ${label}: ${fmtNum(b)} -> ${fmtNum(a)}`;
  };

  const lines = [
    `# Scenario diff`,
    ``,
    `Generated: ${nowIso()}`,
    `Baseline: ${cleanString(baseRec?.name) || baseRec?.id || baselineId}`,
    `Active: ${cleanString(activeRec?.name) || activeRec?.id || "active"}`,
    `Changed inputs: ${changed.length}`,
    ``,
    `## Key changed inputs`,
    ...(changed.length
      ? changed.slice(0, 20).map((row) => `- ${row.label}: ${fmtAny(row.base)} -> ${fmtAny(row.active)}`)
      : ["- No input differences detected."]),
    ...(changed.length > 20 ? [`- ...${changed.length - 20} additional input changes not shown.`] : []),
    ``,
    `## Output comparison (latest stored summaries)`,
    compareLine("Expected net votes", "expectedNetVotes"),
    compareLine("Total cost", "totalCost"),
    compareLine("Feasibility", "feasibility"),
    `- Primary bottleneck: ${cleanString(baseSummary?.primaryBottleneck) || "—"} -> ${cleanString(activeSummary?.primaryBottleneck) || "—"}`,
  ];

  const brief = pushBriefRow(intel, {
    kind: "scenarioDiff",
    content: lines.join("\n"),
    promptId: "manual.scenarioDiff.v1",
    model: "manual",
  });
  return { ok: true, brief };
}

export function generateDriftExplanationBrief(state, { drift = null } = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };
  const d = isObject(drift) ? drift : null;
  if (!d?.hasLog){
    return { ok: false, error: "No daily log data available for drift explanation." };
  }

  const autoRecs = listAutoDriftRecommendationsFromIntel(intel);

  const lines = [
    `# Drift explanation`,
    ``,
    `Generated: ${nowIso()}`,
    `Window: ${fmtIsoDate(d?.windowStart)} to ${fmtIsoDate(d?.windowEnd)} (${fmtNum(d?.windowEntries)} entries)`,
    `Primary drift axis: ${cleanString(d?.primary) || "none"}`,
    ``,
    `## Observed vs assumed`,
    `- Contact rate: ${fmtRatioPct(d?.actualCR)} vs ${fmtRatioPct(d?.assumedCR)}`,
    `- Support rate: ${fmtRatioPct(d?.actualSR)} vs ${fmtRatioPct(d?.assumedSR)}`,
    `- Attempts/org hour: ${fmtNum(d?.actualAPH)} vs ${fmtNum(d?.expectedAPH)}`,
    ``,
    `## Active drift flags`,
    ...(Array.isArray(d?.flags) && d.flags.length
      ? d.flags.map((x) => `- ${x}`)
      : ["- No drift flags triggered (within tolerance)."]),
    ``,
    `## Recommendation summary`,
    ...(autoRecs.length
      ? autoRecs.slice(0, 5).map((row, idx) => `- [P${fmtNum(row?.priority)}] ${cleanString(row?.title) || `Recommendation ${idx + 1}`}: ${cleanString(row?.detail) || "—"}`)
      : ["- No auto-generated drift recommendations."]),
  ];

  const brief = pushBriefRow(intel, {
    kind: "driftExplanation",
    content: lines.join("\n"),
    promptId: "manual.driftExplanation.v1",
    model: "manual",
  });
  return { ok: true, brief };
}

export function generateSensitivityInterpretationBrief(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };
  const mc = state?.mcLast;
  const rows = Array.isArray(mc?.sensitivity) ? mc.sensitivity.slice() : [];
  if (!rows.length){
    return { ok: false, error: "Run Monte Carlo first to generate sensitivity interpretation." };
  }

  rows.sort((a, b) => Math.abs(Number(b?.impact || 0)) - Math.abs(Number(a?.impact || 0)));
  const top = rows.slice(0, 8);
  const ce = mc?.confidenceEnvelope;

  const lines = [
    `# Sensitivity interpretation`,
    ``,
    `Generated: ${nowIso()}`,
    `Monte Carlo runs: ${fmtNum(mc?.runs)}`,
    `Win probability: ${fmtRatioPct(mc?.winProb)}`,
    `Median margin: ${fmtSignedNum(mc?.median, 0)}`,
    `P10 / P50 / P90 margin: ${fmtSignedNum(ce?.percentiles?.p10, 0)} / ${fmtSignedNum(ce?.percentiles?.p50, 0)} / ${fmtSignedNum(ce?.percentiles?.p90, 0)}`,
    ``,
    `## Top sensitivity drivers (absolute impact)`,
    ...top.map((row, idx) => `- ${idx + 1}. ${cleanString(row?.label) || "Unnamed driver"}: impact ${fmtNum(row?.impact)}`),
    ``,
    `## Interpretation notes`,
    `- Higher absolute impact means win probability is more sensitive to that variable in the current scenario.`,
    `- Use this ranking to prioritize evidence collection and assumption hardening on the top drivers.`,
    `- Re-run Monte Carlo after major input changes to refresh this ranking.`,
  ];

  const brief = pushBriefRow(intel, {
    kind: "sensitivityInterpretation",
    content: lines.join("\n"),
    promptId: "manual.sensitivityInterpretation.v1",
    model: "manual",
  });
  return { ok: true, brief };
}

function normalizeCorrelationRow(raw, fallbackLabel = ""){
  if (!isObject(raw)) return { ok: false, error: "Correlation model must be an object." };
  const refs = Array.isArray(raw.refs) ? raw.refs.map((x) => cleanString(x)).filter(Boolean) : [];
  if (refs.length < 2) return { ok: false, error: "Correlation model requires at least 2 refs." };

  const matrix = Array.isArray(raw.matrix) ? raw.matrix : null;
  if (!matrix || matrix.length !== refs.length){
    return { ok: false, error: "Matrix dimensions must match refs length." };
  }
  const normalized = [];
  for (let i = 0; i < matrix.length; i++){
    const row = matrix[i];
    if (!Array.isArray(row) || row.length !== refs.length){
      return { ok: false, error: "Matrix must be square and match refs length." };
    }
    const outRow = [];
    for (let j = 0; j < row.length; j++){
      const n = toNumOrNull(row[j]);
      if (n == null) return { ok: false, error: `Matrix value at [${i + 1},${j + 1}] is not numeric.` };
      if (n < -1 || n > 1) return { ok: false, error: `Matrix value at [${i + 1},${j + 1}] must be between -1 and 1.` };
      outRow.push(n);
    }
    normalized.push(outRow);
  }
  const id = cleanString(raw.id) || makeId("corr");
  const label = cleanString(raw.label) || cleanString(fallbackLabel) || id;
  return {
    ok: true,
    row: {
      id,
      label,
      refs,
      matrix: normalized,
      notes: cleanString(raw.notes),
      createdAt: cleanString(raw.createdAt) || nowIso(),
      updatedAt: nowIso(),
    }
  };
}

export function listCorrelationModels(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  if (!Array.isArray(intel.correlationModels)) intel.correlationModels = [];
  return intel.correlationModels.slice();
}

export function upsertCorrelationModel(state, payload = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };
  if (!Array.isArray(intel.correlationModels)) intel.correlationModels = [];

  const normalized = normalizeCorrelationRow(payload, payload?.label);
  if (!normalized.ok) return normalized;
  const row = normalized.row;

  const idx = intel.correlationModels.findIndex((x) => cleanString(x?.id) === cleanString(row.id));
  if (idx >= 0){
    row.createdAt = cleanString(intel.correlationModels[idx]?.createdAt) || row.createdAt;
    intel.correlationModels[idx] = row;
    return { ok: true, mode: "updated", row };
  }

  const byLabel = intel.correlationModels.findIndex((x) => cleanString(x?.label).toLowerCase() === cleanString(row.label).toLowerCase());
  if (byLabel >= 0){
    row.createdAt = cleanString(intel.correlationModels[byLabel]?.createdAt) || row.createdAt;
    row.id = cleanString(intel.correlationModels[byLabel]?.id) || row.id;
    intel.correlationModels[byLabel] = row;
    return { ok: true, mode: "updated", row };
  }

  intel.correlationModels.push(row);
  return { ok: true, mode: "created", row };
}

export function importCorrelationModelsJson(state, jsonText = ""){
  const text = cleanString(jsonText);
  if (!text) return { ok: false, error: "Paste correlation model JSON first." };

  let parsed;
  try{
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Correlation model JSON is invalid." };
  }

  const items = Array.isArray(parsed)
    ? parsed
    : (isObject(parsed) && Array.isArray(parsed?.correlationModels))
      ? parsed.correlationModels
      : [parsed];

  if (!items.length) return { ok: false, error: "No correlation model entries found." };

  let created = 0;
  let updated = 0;
  for (const item of items){
    const r = upsertCorrelationModel(state, item);
    if (!r.ok){
      return { ok: false, error: r.error || "Failed to import correlation model." };
    }
    if (r.mode === "created") created += 1;
    else updated += 1;
  }

  return { ok: true, created, updated };
}

export function addDefaultCorrelationModel(state){
  return upsertCorrelationModel(state, {
    label: "Field throughput coupling (default)",
    refs: [
      "core.contactRatePct",
      "core.supportRatePct",
      "core.doorsPerHour",
      "core.callsPerHour",
    ],
    matrix: [
      [1.0, 0.35, 0.25, 0.20],
      [0.35, 1.0, 0.30, 0.25],
      [0.25, 0.30, 1.0, 0.45],
      [0.20, 0.25, 0.45, 1.0],
    ],
    notes: "Default coupled performance model for field contact/support/productivity.",
  });
}

function normalizeShockScenarioRow(raw, fallbackLabel = ""){
  if (!isObject(raw)) return { ok: false, error: "Shock scenario must be an object." };
  const impactsRaw = Array.isArray(raw.impacts) ? raw.impacts : [];
  const impacts = [];
  for (const item of impactsRaw){
    if (!isObject(item)) continue;
    const ref = cleanString(item.ref);
    const delta = toNumOrNull(item.delta);
    if (!ref || delta == null) continue;
    impacts.push({ ref, delta });
  }
  if (!impacts.length) return { ok: false, error: "Shock scenario requires at least one valid impact." };

  const p = toNumOrNull(raw.probability);
  if (p == null) return { ok: false, error: "Shock scenario probability is required." };
  if (p < 0 || p > 1) return { ok: false, error: "Shock scenario probability must be between 0 and 1." };

  const id = cleanString(raw.id) || makeId("shock");
  const label = cleanString(raw.label) || cleanString(fallbackLabel) || id;
  return {
    ok: true,
    row: {
      id,
      label,
      impacts,
      probability: p,
      notes: cleanString(raw.notes),
      createdAt: cleanString(raw.createdAt) || nowIso(),
      updatedAt: nowIso(),
    }
  };
}

export function listShockScenarios(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  if (!Array.isArray(intel.shockScenarios)) intel.shockScenarios = [];
  return intel.shockScenarios.slice();
}

export function upsertShockScenario(state, payload = {}){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };
  if (!Array.isArray(intel.shockScenarios)) intel.shockScenarios = [];

  const normalized = normalizeShockScenarioRow(payload, payload?.label);
  if (!normalized.ok) return normalized;
  const row = normalized.row;

  const idx = intel.shockScenarios.findIndex((x) => cleanString(x?.id) === cleanString(row.id));
  if (idx >= 0){
    row.createdAt = cleanString(intel.shockScenarios[idx]?.createdAt) || row.createdAt;
    intel.shockScenarios[idx] = row;
    return { ok: true, mode: "updated", row };
  }

  const byLabel = intel.shockScenarios.findIndex((x) => cleanString(x?.label).toLowerCase() === cleanString(row.label).toLowerCase());
  if (byLabel >= 0){
    row.createdAt = cleanString(intel.shockScenarios[byLabel]?.createdAt) || row.createdAt;
    row.id = cleanString(intel.shockScenarios[byLabel]?.id) || row.id;
    intel.shockScenarios[byLabel] = row;
    return { ok: true, mode: "updated", row };
  }

  intel.shockScenarios.push(row);
  return { ok: true, mode: "created", row };
}

export function importShockScenariosJson(state, jsonText = ""){
  const text = cleanString(jsonText);
  if (!text) return { ok: false, error: "Paste shock scenario JSON first." };

  let parsed;
  try{
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Shock scenario JSON is invalid." };
  }

  const items = Array.isArray(parsed)
    ? parsed
    : (isObject(parsed) && Array.isArray(parsed?.shockScenarios))
      ? parsed.shockScenarios
      : [parsed];

  if (!items.length) return { ok: false, error: "No shock scenario entries found." };

  let created = 0;
  let updated = 0;
  for (const item of items){
    const r = upsertShockScenario(state, item);
    if (!r.ok){
      return { ok: false, error: r.error || "Failed to import shock scenario." };
    }
    if (r.mode === "created") created += 1;
    else updated += 1;
  }

  return { ok: true, created, updated };
}

export function addDefaultShockScenario(state){
  return upsertShockScenario(state, {
    label: "Opponent surge week (default)",
    impacts: [
      { ref: "core.contactRatePct", delta: -2 },
      { ref: "core.supportRatePct", delta: -1 },
      { ref: "core.turnoutReliabilityPct", delta: -2 },
    ],
    probability: 0.15,
    notes: "Default downside shock: modest temporary conversion/turnout drag.",
  });
}
