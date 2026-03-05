// js/app/intelAudit.js
// Phase 3 scaffolding: audit trail for critical assumption edits.
// This module is metadata-only and must not affect deterministic/MC math.

const CRITICAL_REF_SPECS = [
  { key: "universeSize", ref: "core.universeSize", label: "Universe size" },
  { key: "persuasionPct", ref: "core.persuasionUniversePct", label: "Persuasion % of universe" },
  { key: "supportRatePct", ref: "core.supportRatePct", label: "Support rate %" },
  { key: "contactRatePct", ref: "core.contactRatePct", label: "Contact rate %" },
  { key: "turnoutA", ref: "core.turnoutCycleA", label: "Turnout cycle A %" },
  { key: "turnoutB", ref: "core.turnoutCycleB", label: "Turnout cycle B %" },
  { key: "bandWidth", ref: "core.turnoutBandWidth", label: "Turnout band width" },
  { key: "turnoutEnabled", ref: "core.turnoutModelingEnabled", label: "Turnout modeling enabled" },
  { key: "turnoutBaselinePct", ref: "core.turnoutBaselinePct", label: "Turnout baseline %" },
  { key: "gotvLiftPP", ref: "core.gotvLiftPP", label: "GOTV lift (pp)" },
  { key: "gotvMaxLiftPP", ref: "core.gotvLiftCeilingPP", label: "GOTV max lift (pp)" },
  { key: "orgCount", ref: "core.orgCount", label: "Organizer count" },
  { key: "orgHoursPerWeek", ref: "core.orgHoursPerWeek", label: "Organizer hours/week" },
  { key: "volunteerMultBase", ref: "core.volunteerMultiplier", label: "Volunteer multiplier" },
  { key: "channelDoorPct", ref: "core.channelDoorPct", label: "Door share %" },
  { key: "doorsPerHour3", ref: "core.doorsPerHour", label: "Doors/hour" },
  { key: "callsPerHour3", ref: "core.callsPerHour", label: "Calls/hour" },
];

function toNumOrNull(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeValue(v){
  if (typeof v === "boolean") return v;
  const n = toNumOrNull(v);
  if (n != null) return n;
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function valuesEqual(a, b){
  if (typeof a === "number" && typeof b === "number"){
    return Math.abs(a - b) < 1e-9;
  }
  return Object.is(a, b);
}

function ensureIntelAuditArray(state){
  if (!state || typeof state !== "object") return [];
  if (!state.intelState || typeof state.intelState !== "object"){
    state.intelState = { version: "1.0.0", audit: [] };
  }
  if (!Array.isArray(state.intelState.audit)){
    state.intelState.audit = [];
  }
  return state.intelState.audit;
}

function newAuditId(){
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function resolveAuditRequirementStatus(entry){
  if (!entry || typeof entry !== "object") return "logged";
  const requiresNote = entry.requiresNote === true;
  const hasNote = !!String(entry.note || "").trim();
  if (requiresNote && !hasNote) return "missingNote";

  const requiresEvidence = entry.requiresEvidence === true;
  const hasEvidence = !!String(entry.evidenceId || "").trim();
  if (requiresEvidence && !hasEvidence) return "missingEvidence";

  if (!requiresNote && !requiresEvidence) return "logged";
  return "resolved";
}

function parseDateMaybe(v){
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function buildCriticalAuditSnapshot(state){
  const out = {};
  for (const spec of CRITICAL_REF_SPECS){
    out[spec.key] = normalizeValue(state?.[spec.key]);
  }
  return out;
}

export function captureCriticalAssumptionAudit({
  state,
  previousSnapshot,
  source = "ui",
  maxEntries = 300,
  requireNote = false,
  requireEvidence = true,
  note = "",
} = {}){
  const nextSnapshot = buildCriticalAuditSnapshot(state);
  const prev = (previousSnapshot && typeof previousSnapshot === "object") ? previousSnapshot : null;
  if (!prev) return { nextSnapshot, changes: [], wroteAudit: false };

  const changes = [];
  for (const spec of CRITICAL_REF_SPECS){
    const before = prev[spec.key];
    const after = nextSnapshot[spec.key];
    if (valuesEqual(before, after)) continue;
    changes.push({
      key: spec.key,
      ref: spec.ref,
      label: spec.label,
      before,
      after,
    });
  }
  if (!changes.length) return { nextSnapshot, changes, wroteAudit: false };

  const audit = ensureIntelAuditArray(state);
  const ts = new Date().toISOString();

  if (changes.length >= 5){
    const entry = {
      id: newAuditId(),
      ts,
      source,
      kind: "critical_ref_change_batch",
      refs: changes.map((c) => c.ref),
      keys: changes.map((c) => c.key),
      requiresEvidence: !!requireEvidence,
      requiresNote: !!requireNote,
      note: String(note || "").trim(),
      evidenceId: null,
    };
    entry.status = resolveAuditRequirementStatus(entry);
    audit.push({
      ...entry,
    });
  } else {
    for (const c of changes){
      const entry = {
        id: newAuditId(),
        ts,
        source,
        kind: "critical_ref_change",
        ref: c.ref,
        key: c.key,
        label: c.label,
        before: c.before,
        after: c.after,
        requiresEvidence: !!requireEvidence,
        requiresNote: !!requireNote,
        note: String(note || "").trim(),
        evidenceId: null,
      };
      entry.status = resolveAuditRequirementStatus(entry);
      audit.push(entry);
    }
  }

  if (audit.length > maxEntries){
    state.intelState.audit = audit.slice(audit.length - maxEntries);
  }

  return { nextSnapshot, changes, wroteAudit: true };
}

export function computeEvidenceWarnings(state, { limit = 2, staleDays = 30 } = {}){
  const intel = state?.intelState || {};
  const audit = Array.isArray(intel.audit) ? intel.audit : [];
  const evidence = Array.isArray(intel.evidence) ? intel.evidence : [];
  const out = [];

  const missing = audit.filter((x) =>
    x &&
    x.requiresEvidence === true &&
    !x.evidenceId &&
    String(x.status || "").toLowerCase() !== "resolved"
  );
  if (missing.length){
    out.push(`Evidence gap: ${missing.length} critical assumption edit(s) missing evidence.`);
  }

  const missingNote = audit.filter((x) =>
    x &&
    x.requiresNote === true &&
    !String(x.note || "").trim() &&
    String(x.status || "").toLowerCase() !== "resolved"
  );
  if (missingNote.length){
    out.push(`Documentation gap: ${missingNote.length} critical assumption edit(s) missing note.`);
  }

  if (staleDays > 0 && evidence.length){
    const cutoffMs = Date.now() - (staleDays * 86400000);
    const staleCount = evidence.filter((e) => {
      const d = parseDateMaybe(e?.updatedAt || e?.capturedAt || e?.ts || e?.timestamp);
      return d ? d.getTime() < cutoffMs : false;
    }).length;
    if (staleCount > 0){
      out.push(`Evidence stale: ${staleCount} evidence record(s) older than ${staleDays} days.`);
    }
  }

  return out.slice(0, Math.max(0, Number(limit) || 0));
}
