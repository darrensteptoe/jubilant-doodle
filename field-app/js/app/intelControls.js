// js/app/intelControls.js
// Intel metadata helpers (benchmarks + evidence). Must not alter deterministic math.

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
    x &&
    x.requiresEvidence === true &&
    !x.evidenceId &&
    String(x.status || "").toLowerCase() !== "resolved"
  );
  return rows.slice(0, Math.max(0, Number(limit) || 0));
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
    auditEntry.status = "resolved";
    auditEntry.resolvedAt = nowIso();
  }

  return { ok: true, evidence, resolvedAuditId: auditEntry?.id || null };
}
