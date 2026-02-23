// js/migrate.js
// Phase 10 — Schema Versioning + Migration Guard
// Pure module: no DOM, no imports from app/optimizer, no state mutation.

export const CURRENT_SCHEMA_VERSION = "1.1.0";

const SCENARIO_DEFAULTS = {
  // Phase 16 — Universe composition + retention (aggregate)
  universeLayerEnabled: false,
  universeDemPct: 100,
  universeRepPct: 0,
  universeNpaPct: 0,
  universeOtherPct: 0,
  retentionFactor: 0.80,
};

function applyScenarioDefaults(scen){
  if (!isPlainObject(scen)) return scen;
  for (const k of Object.keys(SCENARIO_DEFAULTS)){
    if (scen[k] == null) scen[k] = SCENARIO_DEFAULTS[k];
  }
  return scen;
}

function isPlainObject(v){
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function deepClone(v){
  // structuredClone is available in modern browsers; fall back to JSON for safety.
  try{
    if (typeof structuredClone === "function") return structuredClone(v);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(v));
}

function parseSemver(ver){
  const s = String(ver || "").trim();
  const parts = s.split(".");
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  const c = Number(parts[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
  return { a, b, c, raw: s };
}

function cmpSemver(a, b){
  // returns -1, 0, 1; non-parseable treated as 0.0.0
  const pa = parseSemver(a) || { a:0, b:0, c:0 };
  const pb = parseSemver(b) || { a:0, b:0, c:0 };
  if (pa.a !== pb.a) return pa.a < pb.a ? -1 : 1;
  if (pa.b !== pb.b) return pa.b < pb.b ? -1 : 1;
  if (pa.c !== pb.c) return pa.c < pb.c ? -1 : 1;
  return 0;
}

const KNOWN_TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "appVersion",
  "modelVersion",
  "snapshotHash",
  "exportedAt",
  "scenario",
]);

// migrateSnapshot(rawExportObject) -> { snapshot, warnings }
// - snapshot is a normalized export payload suitable for validateScenarioExport()
// - warnings is a human-readable array
export function migrateSnapshot(rawExportObject){
  const warnings = [];

  const raw = isPlainObject(rawExportObject) ? deepClone(rawExportObject) : {};
  const out = {};

  // Collect unknown top-level keys (consistent policy: store under _unknown)
  if (isPlainObject(raw)){
    const unknown = {};
    for (const k of Object.keys(raw)){
      if (!KNOWN_TOP_LEVEL_KEYS.has(k)){
        unknown[k] = raw[k];
        warnings.push(`Unknown field '${k}' ignored.`);
      }
    }
    if (Object.keys(unknown).length) out._unknown = unknown;
  }

  // Scenario field normalization (support legacy "scenarioState")
  if (raw.scenario == null && raw.scenarioState != null){
    out.scenario = raw.scenarioState;
    warnings.push("Migrated legacy field 'scenarioState' → 'scenario'.");
  } else {
    out.scenario = raw.scenario;
  }

  // Ensure newly introduced scenario fields exist so imports from older snapshots
  // are reproducible and won't silently change behavior.
  out.scenario = applyScenarioDefaults(out.scenario);

  out.modelVersion = raw.modelVersion;
  out.snapshotHash = raw.snapshotHash;
  out.exportedAt = raw.exportedAt;

  // Schema version handling
  const sv = raw.schemaVersion;
  if (sv == null || sv === ""){
    out.schemaVersion = CURRENT_SCHEMA_VERSION;
    warnings.push(`Missing schemaVersion; assuming ${CURRENT_SCHEMA_VERSION} defaults.`);
  } else {
    out.schemaVersion = String(sv);
  }

  // Optional app version (display-only)
  if (raw.appVersion != null && raw.appVersion !== "") out.appVersion = String(raw.appVersion);

  // Newer schema warning (do not block)
  if (cmpSemver(out.schemaVersion, CURRENT_SCHEMA_VERSION) > 0){
    warnings.push("Snapshot schema version is newer than this app. Import attempted with best-effort defaults.");
  }

  // Structured path for future migrations (placeholder)
  if (out.schemaVersion !== CURRENT_SCHEMA_VERSION && cmpSemver(out.schemaVersion, CURRENT_SCHEMA_VERSION) < 0){
    warnings.push(`Migrated schema ${out.schemaVersion} → ${CURRENT_SCHEMA_VERSION}`);
    // For Phase 10: no actual field transforms besides defaults.
    out.schemaVersion = CURRENT_SCHEMA_VERSION;
  }

  return { snapshot: out, warnings };
}
