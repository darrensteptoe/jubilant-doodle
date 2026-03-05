// js/app/intelControls.js
// Intel metadata helpers (benchmarks + evidence). Must not alter deterministic math.
import { resolveAuditRequirementStatus } from "./intelAudit.js";

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

function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function cleanString(v){
  if (v == null) return "";
  return String(v).trim();
}

function toNumOrNull(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRaceType(v){
  const s = cleanString(v).toLowerCase();
  return s || "all";
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

function ensureArray(obj, key){
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key];
}

export function benchmarkRefLabel(ref){
  return REF_LABELS[cleanString(ref)] || cleanString(ref) || "Unknown ref";
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
  if (!isObject(intel.simToggles)) intel.simToggles = {};
  if (!isObject(intel.expertToggles)) intel.expertToggles = {};
  return intel;
}

export function listIntelBenchmarks(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return [];
  return intel.benchmarks.slice();
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
  return rows.slice(0, Math.max(0, Number(limit) || 0));
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
  return rows.slice(0, Math.max(0, Number(limit) || 0));
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

  const raceType = normalizeRaceType(payload.raceType);
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
  const findIndex = intel.benchmarks.findIndex((x) =>
    cleanString(x?.ref) === ref && normalizeRaceType(x?.raceType) === raceType
  );

  const existing = findIndex >= 0 ? intel.benchmarks[findIndex] : null;
  const row = {
    id: cleanString(existing?.id) || makeId("bm"),
    ref,
    raceType,
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

const BENCHMARK_PRESET_BY_RACE = {
  federal: { contactMin: 8, contactMax: 45, supportMin: 25, supportMax: 80, turnoutMin: 30, turnoutMax: 80, persuasionMin: 8, persuasionMax: 55 },
  state_leg: { contactMin: 5, contactMax: 50, supportMin: 20, supportMax: 85, turnoutMin: 20, turnoutMax: 85, persuasionMin: 5, persuasionMax: 65 },
  municipal: { contactMin: 6, contactMax: 55, supportMin: 20, supportMax: 85, turnoutMin: 10, turnoutMax: 70, persuasionMin: 8, persuasionMax: 70 },
  county: { contactMin: 6, contactMax: 50, supportMin: 20, supportMax: 85, turnoutMin: 20, turnoutMax: 80, persuasionMin: 6, persuasionMax: 65 },
  all: { contactMin: 5, contactMax: 60, supportMin: 20, supportMax: 85, turnoutMin: 20, turnoutMax: 90, persuasionMin: 5, persuasionMax: 70 },
};

function mid(min, max){
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return Math.round(((min + max) / 2) * 10) / 10;
}

export function loadDefaultBenchmarksForRaceType(state, raceTypeInput = "all"){
  const raceType = normalizeRaceType(raceTypeInput);
  const preset = BENCHMARK_PRESET_BY_RACE[raceType] || BENCHMARK_PRESET_BY_RACE.all;
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
      sourceTitle: "Built-in benchmark preset",
      sourceNotes: `Preset loaded for race type '${raceType}'.`,
    });
    if (!res.ok){
      return { ok: false, error: res.error || `Failed to load benchmark for ${row.ref}.`, created, updated };
    }
    if (res.mode === "created") created += 1;
    else updated += 1;
  }
  return { ok: true, raceType, created, updated, totalApplied: rows.length };
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
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function fmtNum(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function fmtRatioPct(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function clamp01(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function pct1(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 10;
}

function num1(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
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
  const confidence = clamp01(entries / 10);

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
  const source = "auto.realityDrift.v1";
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
    const severityRatio = clamp01((def.assumed - def.actual) / def.assumed);
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

export function generateCalibrationSourceBrief(state){
  const intel = ensureIntelCollections(state);
  if (!intel) return { ok: false, error: "Intel state unavailable." };

  const now = nowIso();
  const raceType = cleanString(state?.raceType) || "unknown";
  const scenarioName = cleanString(state?.scenarioName) || "Unnamed scenario";
  const benchmarks = listIntelBenchmarks(state);
  const missingEvidence = listMissingEvidenceAudit(state, { limit: 500 }).length;
  const evidenceCount = ensureArray(intel, "evidence").length;
  const shockScenarioCount = ensureArray(intel, "shockScenarios").length;

  const benchmarkLines = benchmarks.length
    ? benchmarks.slice(0, 12).map((b) => {
      const ref = benchmarkRefLabel(b?.ref);
      const scope = cleanString(b?.raceType) || "all";
      const min = fmtNum(b?.range?.min);
      const max = fmtNum(b?.range?.max);
      const warn = fmtNum(b?.severityBands?.warnAbove);
      const hard = fmtNum(b?.severityBands?.hardAbove);
      const source = cleanString(b?.source?.title) || cleanString(b?.source?.type) || "manual";
      return `- ${ref} [${scope}] range ${min}..${max}; warn/hard ${warn}/${hard}; source: ${source}`;
    }).join("\n")
    : "- No benchmark entries configured.";

  const content = [
    `# Model calibration sources`,
    ``,
    `Generated: ${now}`,
    `Scenario: ${scenarioName}`,
    `Race type: ${raceType}`,
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
    `- Weekly decay %: ${fmtPct(Number(intel?.expertToggles?.decayModel?.weeklyDecayPct) * 100)}`,
    `- Floor % of baseline: ${fmtPct(Number(intel?.expertToggles?.decayModel?.floorPctOfBaseline) * 100)}`,
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

  const brief = {
    id: makeId("brief"),
    kind: "calibrationSources",
    content,
    promptId: "manual.calibrationSources.v1",
    model: "manual",
    createdAt: now,
  };

  ensureArray(intel, "briefs").push(brief);
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
