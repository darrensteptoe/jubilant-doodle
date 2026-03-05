// js/export.js
// Phase 9A — Export Foundation (pure serialization + UI helpers)
// Rules:
// - Reads from a single snapshot object
// - Does not import optimizer / compute modules
// - Does not mutate app state

import { computeSnapshotHash } from "./hash.js";
import { CURRENT_SCHEMA_VERSION } from "./migrate.js";
import { APP_VERSION, BUILD_ID } from "./build.js";
import { UNIVERSE_DEFAULTS } from "./universeLayer.js";

export const MODEL_VERSION = "1.0.0";

function pad2(n){ return String(n).padStart(2, "0"); }

export function makeTimestampedFilename(prefix, ext, d = new Date()){
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}.${ext}`;
}

function isPlainObject(v){
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function cleanString(v){
  if (v == null) return "";
  return String(v).trim();
}

function parseIsoMs(v){
  const s = cleanString(v);
  if (!s) return null;
  const d = new Date(s);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
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

function buildGovernanceSummary(scenario){
  const intel = isPlainObject(scenario?.intelState) ? scenario.intelState : null;
  if (!intel){
    return {
      available: false,
      reason: "No intelState present in scenario export.",
    };
  }

  const audit = Array.isArray(intel.audit) ? intel.audit : [];
  const scopedAudit = audit.filter((row) => auditEntryInGovernanceScope(intel, row));
  const missingEvidence = scopedAudit.filter((row) =>
    row &&
    row.requiresEvidence === true &&
    !row.evidenceId &&
    cleanString(row.status).toLowerCase() !== "resolved"
  ).length;
  const missingNote = scopedAudit.filter((row) =>
    row &&
    row.requiresNote === true &&
    !cleanString(row.note) &&
    cleanString(row.status).toLowerCase() !== "resolved"
  ).length;

  const briefs = Array.isArray(intel.briefs) ? intel.briefs : [];
  const calibrationBrief = briefs
    .filter((row) => row && cleanString(row.kind) === "calibrationSources")
    .sort((a, b) => cleanString(b?.createdAt).localeCompare(cleanString(a?.createdAt)))[0] || null;

  const workflow = isPlainObject(intel.workflow) ? intel.workflow : {};
  return {
    available: true,
    workflow: {
      scenarioLocked: !!workflow.scenarioLocked,
      lockReason: workflow.lockReason || "",
      requireCriticalNote: workflow.requireCriticalNote !== false,
      requireCriticalEvidence: workflow.requireCriticalEvidence !== false,
      governanceBaselineAt: workflow.governanceBaselineAt || null,
    },
    counts: {
      evidence: Array.isArray(intel.evidence) ? intel.evidence.length : 0,
      benchmarks: Array.isArray(intel.benchmarks) ? intel.benchmarks.length : 0,
      flags: Array.isArray(intel.flags) ? intel.flags.length : 0,
      audit: audit.length,
      scopedAudit: scopedAudit.length,
      briefs: briefs.length,
      recommendations: Array.isArray(intel.recommendations) ? intel.recommendations.length : 0,
      observedMetrics: Array.isArray(intel.observedMetrics) ? intel.observedMetrics.length : 0,
      correlationModels: Array.isArray(intel.correlationModels) ? intel.correlationModels.length : 0,
      shockScenarios: Array.isArray(intel.shockScenarios) ? intel.shockScenarios.length : 0,
    },
    missing: {
      evidence: missingEvidence,
      note: missingNote,
    },
    calibrationBrief: calibrationBrief ? {
      id: calibrationBrief.id || null,
      createdAt: calibrationBrief.createdAt || null,
      promptId: calibrationBrief.promptId || null,
      model: calibrationBrief.model || null,
    } : null,
  };
}

export function hasNonFiniteNumbers(v){
  const seen = new Set();
  const walk = (x) => {
    if (typeof x === "number") return !Number.isFinite(x);
    if (x == null) return false;
    if (typeof x !== "object") return false;
    if (seen.has(x)) return false;
    seen.add(x);
    if (Array.isArray(x)){
      for (const it of x){ if (walk(it)) return true; }
      return false;
    }
    for (const k of Object.keys(x)){
      if (walk(x[k])) return true;
    }
    return false;
  };
  return walk(v);
}

export function canonicalize(v){
  if (Array.isArray(v)) return v.map(canonicalize);
  if (!isPlainObject(v)) return v;
  const out = {};
  const keys = Object.keys(v).sort();
  for (const k of keys){
    out[k] = canonicalize(v[k]);
  }
  return out;
}

export function deterministicStringify(obj, space = 2){
  return JSON.stringify(canonicalize(obj), null, space);
}

function parseMajor(ver){
  const s = String(ver || "");
  const m = s.split(".")[0];
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
}

function ensureUniverseDefaults(scen){
  // Export must be reproducible across versions.
  // Ensure Phase 16 fields are always present (even if imported from older schema).
  const s = scen && typeof scen === "object" ? scen : {};
  if (s.universeLayerEnabled == null) s.universeLayerEnabled = !!UNIVERSE_DEFAULTS.enabled;
  if (s.universeDemPct == null) s.universeDemPct = UNIVERSE_DEFAULTS.demPct;
  if (s.universeRepPct == null) s.universeRepPct = UNIVERSE_DEFAULTS.repPct;
  if (s.universeNpaPct == null) s.universeNpaPct = UNIVERSE_DEFAULTS.npaPct;
  if (s.universeOtherPct == null) s.universeOtherPct = UNIVERSE_DEFAULTS.otherPct;
  if (s.retentionFactor == null) s.retentionFactor = UNIVERSE_DEFAULTS.retentionFactor;
  return s;
}

export function makeScenarioExport(snapshot){
  // snapshot must include { scenarioState, modelVersion? }
  const mv = snapshot?.modelVersion || MODEL_VERSION;
  const sv = snapshot?.schemaVersion || CURRENT_SCHEMA_VERSION;
  const scenRaw = snapshot?.scenarioState ?? null;
  const scen = scenRaw ? ensureUniverseDefaults(structuredClone(scenRaw)) : null;

  // Display-only (does not control migration)
  const appVersion = snapshot?.appVersion || APP_VERSION;
  const buildId = snapshot?.buildId || BUILD_ID;

  // Deterministic integrity hash (Phase 9B)
  const snapshotHash = snapshot?.snapshotHash || computeSnapshotHash({ modelVersion: mv, scenarioState: scen });

  return {
    schemaVersion: sv,
    appVersion,
    buildId,
    modelVersion: mv,
    snapshotHash,
    exportedAt: new Date().toISOString(),
    scenario: scen,
    governance: buildGovernanceSummary(scen),
  };
}

export function validateScenarioExport(obj, currentModelVersion = MODEL_VERSION){
  if (!obj || typeof obj !== "object") return { ok:false, reason:"Invalid JSON (not an object)." };
  const mv = obj.modelVersion;
  if (!mv) return { ok:false, reason:"Missing required field: modelVersion." };
  const hash = obj.snapshotHash;
  if (hash != null && typeof hash !== "string") return { ok:false, reason:"snapshotHash must be a string when provided." };
  const scen = obj.scenario;
  if (!scen || typeof scen !== "object") return { ok:false, reason:"Missing required field: scenario." };

  const a = parseMajor(mv);
  const b = parseMajor(currentModelVersion);
  if (a == null || b == null) return { ok:false, reason:"modelVersion is not parseable." };
  if (a !== b) return { ok:false, reason:`Incompatible modelVersion. File=${mv} App=${currentModelVersion}` };

  return { ok:true, modelVersion: mv, scenario: scen, snapshotHash: (hash ?? null) };
}

function csvEscape(v){
  const s = (v == null) ? "" : String(v);
  if (/[\n\r,\"]/g.test(s)) return `"${s.replace(/\"/g,'""')}"`;
  return s;
}

export const PLAN_CSV_HEADERS = [
  "Tactic",
  "Attempts",
  "Expected contacts",
  "Expected net votes",
  "Cost",
  "Cost per net vote",
  "Weeks",
  "Staff",
  "Volunteers",
  "Objective",
  "Feasibility flag",
  "Universe weighting enabled",
  "Universe % Dem",
  "Universe % Rep",
  "Universe % NPA",
  "Universe % Other",
  "Retention factor",
];

export function planRowsToCsv(snapshot){
  const rows = Array.isArray(snapshot?.planRows) ? snapshot.planRows : [];
  const meta = snapshot?.planMeta || {};

  // Include key model assumptions so client-facing CSV is self-contained.
  // Prefer scenarioState (internal snapshot), but also accept exported scenario.
  const scen = snapshot?.scenarioState || snapshot?.scenario || {};
  const enabled = (scen?.universeLayerEnabled != null) ? !!scen.universeLayerEnabled : !!UNIVERSE_DEFAULTS.enabled;
  const demPct = (scen?.universeDemPct != null) ? scen.universeDemPct : UNIVERSE_DEFAULTS.demPct;
  const repPct = (scen?.universeRepPct != null) ? scen.universeRepPct : UNIVERSE_DEFAULTS.repPct;
  const npaPct = (scen?.universeNpaPct != null) ? scen.universeNpaPct : UNIVERSE_DEFAULTS.npaPct;
  const otherPct = (scen?.universeOtherPct != null) ? scen.universeOtherPct : UNIVERSE_DEFAULTS.otherPct;
  const retention = (scen?.retentionFactor != null) ? scen.retentionFactor : UNIVERSE_DEFAULTS.retentionFactor;

  const lines = [];
  lines.push(PLAN_CSV_HEADERS.map(csvEscape).join(","));

  for (const r of rows){
    const line = [
      r.tactic,
      r.attempts,
      r.expectedContacts,
      r.expectedNetVotes,
      r.cost,
      r.costPerNetVote,
      meta.weeks,
      meta.staff,
      meta.volunteers,
      meta.objective,
      meta.feasible,
      enabled,
      demPct,
      repPct,
      npaPct,
      otherPct,
      retention,
    ].map(csvEscape).join(",");
    lines.push(line);
  }

  return lines.join("\n") + "\n";
}

export function formatSummaryText(snapshot){
  const s = snapshot?.summary || {};
  const lines = [];
  if (snapshot?.schemaVersion){
    lines.push(`Schema version: ${snapshot.schemaVersion}`);
  }
  lines.push(`Objective: ${s.objective ?? "—"}`);
  lines.push(`Expected net votes: ${s.netVotes ?? "—"}`);
  lines.push(`Total cost: ${s.cost ?? "—"}`);
  lines.push(`Feasibility: ${s.feasible ?? "—"}`);
  if (snapshot?.snapshotHash){
    lines.push(`Snapshot hash: ${snapshot.snapshotHash}`);
  }
  lines.push(`Primary bottleneck: ${s.primaryBottleneck ?? "—"}`);
  lines.push("Top tactic allocations:");

  const top = Array.isArray(s.topAllocations) ? s.topAllocations : [];
  if (!top.length){
    lines.push("- —");
  } else {
    for (const t of top){
      lines.push(`- ${t}`);
    }
  }

  return lines.join("\n");
}

export async function copyTextToClipboard(text){
  const t = String(text ?? "");
  if (!t) return { ok:false, reason:"Nothing to copy." };

  try{
    if (navigator?.clipboard?.writeText){
      await navigator.clipboard.writeText(t);
      return { ok:true };
    }
  } catch {
    // fall through to execCommand
  }

  try{
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok ? { ok:true } : { ok:false, reason:"Copy failed." };
  } catch {
    return { ok:false, reason:"Copy failed." };
  }
}
