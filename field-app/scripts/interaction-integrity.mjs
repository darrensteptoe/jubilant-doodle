#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INTERACTION_DIR = path.join(ROOT, "interaction");
const INVENTORY_PATH = path.join(INTERACTION_DIR, "interaction-inventory.csv");
const RESULTS_PATH = path.join(INTERACTION_DIR, "interaction-results.json");

const REQUIRED_COLUMNS = [
  "interaction_id",
  "label",
  "control_type",
  "module",
  "screen_or_stage",
  "component_or_file",
  "option_source",
  "canonical_state_path",
  "handler_name",
  "recompute_required",
  "recompute_path",
  "render_consumers",
  "export_consumers",
  "legacy_dependency",
  "status",
  "notes",
  "tier",
  "surface",
  "persistence_contract",
];

const HIGH_PRIORITY_IDS = [
  "campaign_selector",
  "office_selector",
  "scenario_selector",
  "template_archetype_dropdown",
  "targeting_model_dropdown",
  "support_turnout_threshold_controls",
  "workforce_role_selector",
  "budget_channel_selector",
  "weather_zip_selector",
  "weather_mode_toggle",
  "event_category_selector",
  "event_apply_to_model_toggle",
  "report_type_selector",
  "manual_intelligence_selector",
  "known_live_update_control_plan_mode",
];

const FAILURE_CODES = new Set([
  "NO_OPTIONS",
  "WRONG_OPTIONS",
  "WRONG_STATE_PATH",
  "NO_STATE_WRITE",
  "DUPLICATE_STATE_WRITE",
  "NO_RECOMPUTE",
  "STALE_RENDER",
  "OUTPUT_MISMATCH",
  "LEGACY_DEPENDENCY",
  "NO_PERSISTENCE",
  "WRONG_PERSISTENCE_SCOPE",
  "INVALID_EMPTY_STATE",
  "HIDDEN_SIDE_EFFECT",
]);

const ROOT_CAUSE_BY_CODE = {
  NO_OPTIONS: "state-related",
  WRONG_OPTIONS: "state-related",
  WRONG_STATE_PATH: "state-related",
  NO_STATE_WRITE: "state-related",
  DUPLICATE_STATE_WRITE: "state-related",
  NO_RECOMPUTE: "recompute-related",
  STALE_RENDER: "render-related",
  OUTPUT_MISMATCH: "render-related",
  LEGACY_DEPENDENCY: "legacy-related",
  NO_PERSISTENCE: "persistence-related",
  WRONG_PERSISTENCE_SCOPE: "persistence-related",
  INVALID_EMPTY_STATE: "state-related",
  HIDDEN_SIDE_EFFECT: "state-related",
};

const fileCache = new Map();

function readFileSafe(filePath) {
  if (!filePath) return "";
  const key = path.resolve(filePath);
  if (fileCache.has(key)) return fileCache.get(key);
  try {
    const text = fs.readFileSync(key, "utf8");
    fileCache.set(key, text);
    return text;
  } catch {
    fileCache.set(key, "");
    return "";
  }
}

function parseCsv(text) {
  const rows = [];
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return rows;

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuote = !inQuote;
        }
        continue;
      }
      if (ch === "," && !inQuote) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((value) => String(value || "").trim());
  };

  const header = parseLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return { header, rows };
}

function looksMissing(value) {
  const text = String(value || "").trim().toLowerCase();
  return !text || text === "missing" || text.startsWith("missing") || text === "m/a" || text === "n/a";
}

function normalizeBool(value) {
  return String(value || "").trim().toLowerCase() === "yes";
}

function primaryToken(value) {
  const tokens = String(value || "")
    .split(/[^A-Za-z0-9_.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  return tokens[0] || "";
}

function resolveComponentPath(rawPath) {
  const text = String(rawPath || "").trim();
  if (!text || text.toLowerCase().startsWith("missing")) return "";
  return path.resolve(ROOT, text);
}

function hasTokenInRelevantSources(row, token) {
  if (!token) return false;
  const componentPath = resolveComponentPath(row.component_or_file);
  const candidatePaths = [componentPath, path.resolve(ROOT, "js/appRuntime.js")].filter(Boolean);
  for (const candidatePath of candidatePaths) {
    const src = readFileSafe(candidatePath);
    if (src && src.includes(token)) {
      return true;
    }
  }
  return false;
}

function makePassResult(category, details) {
  return {
    category,
    pass: true,
    classification: "",
    rootCause: "",
    details: String(details || "ok"),
  };
}

function makeFailResult(category, classification, details) {
  const code = FAILURE_CODES.has(classification) ? classification : "HIDDEN_SIDE_EFFECT";
  return {
    category,
    pass: false,
    classification: code,
    rootCause: ROOT_CAUSE_BY_CODE[code] || "state-related",
    details: String(details || ""),
  };
}

export function interactionPopulateCheck(row) {
  const controlType = String(row.control_type || "").trim().toLowerCase();
  const optionSource = String(row.option_source || "").trim();
  const requiresOptions = (
    controlType.includes("dropdown")
    || controlType.includes("selector")
    || controlType.includes("radio")
  );

  if (!requiresOptions) {
    return makePassResult("population", "control does not require option list");
  }
  if (looksMissing(optionSource)) {
    return makeFailResult("population", "NO_OPTIONS", "Option source missing or not implemented.");
  }
  if (optionSource.toLowerCase().includes("legacy_dom")) {
    return makeFailResult("population", "WRONG_OPTIONS", "Control still sources options from legacy DOM.");
  }
  const componentPath = resolveComponentPath(row.component_or_file);
  if (!componentPath || !fs.existsSync(componentPath)) {
    return makeFailResult("population", "NO_OPTIONS", "Component file missing for option population check.");
  }
  return makePassResult("population", `option source: ${optionSource}`);
}

export function interactionStateWriteCheck(row) {
  const statePath = String(row.canonical_state_path || "").trim();
  const handlerName = String(row.handler_name || "").trim();
  if (looksMissing(statePath)) {
    return makeFailResult("state_write", "NO_STATE_WRITE", "Canonical state path missing.");
  }
  if (statePath.toLowerCase().includes("derived")) {
    return makeFailResult("state_write", "HIDDEN_SIDE_EFFECT", "Control writes into derived path.");
  }
  if (looksMissing(handlerName)) {
    return makeFailResult("state_write", "NO_STATE_WRITE", "Handler name missing.");
  }
  const token = primaryToken(handlerName);
  if (!hasTokenInRelevantSources(row, token)) {
    return makeFailResult("state_write", "WRONG_STATE_PATH", `Handler token '${token || handlerName}' not found in canonical sources.`);
  }
  if (statePath.includes("||")) {
    return makeFailResult("state_write", "DUPLICATE_STATE_WRITE", "Ambiguous canonical path marker detected.");
  }
  return makePassResult("state_write", `writes to ${statePath}`);
}

export function interactionRecomputeCheck(row) {
  const recomputeRequired = normalizeBool(row.recompute_required);
  const recomputePath = String(row.recompute_path || "").trim();
  if (!recomputeRequired) {
    return makePassResult("recompute", "recompute not required");
  }
  if (looksMissing(recomputePath) || recomputePath === "no_recompute_required") {
    return makeFailResult("recompute", "NO_RECOMPUTE", "Recompute path missing for required control.");
  }
  const token = primaryToken(recomputePath);
  if (!hasTokenInRelevantSources(row, token)) {
    return makeFailResult("recompute", "NO_RECOMPUTE", `Recompute token '${token || recomputePath}' not found in canonical sources.`);
  }
  return makePassResult("recompute", recomputePath);
}

export function interactionRenderCheck(row) {
  const renderConsumers = String(row.render_consumers || "").trim();
  if (looksMissing(renderConsumers)) {
    return makeFailResult("render", "STALE_RENDER", "Render consumers missing.");
  }
  if (renderConsumers.toLowerCase().includes("stale_known")) {
    return makeFailResult("render", "STALE_RENDER", "Known stale render path still present.");
  }
  return makePassResult("render", renderConsumers);
}

export function interactionOutputCheck(row) {
  const outputs = String(row.export_consumers || "").trim();
  if (outputs.toLowerCase() === "none") {
    return makePassResult("output", "control does not feed export/report directly");
  }
  if (looksMissing(outputs)) {
    return makeFailResult("output", "OUTPUT_MISMATCH", "Export/report consumer path missing.");
  }
  return makePassResult("output", outputs);
}

export function interactionLegacyDependencyCheck(row) {
  const dependency = String(row.legacy_dependency || "").trim().toLowerCase();
  if (!dependency || dependency === "none") {
    return makePassResult("legacy", "no legacy dependency declared");
  }
  return makeFailResult("legacy", "LEGACY_DEPENDENCY", `legacy dependency: ${dependency}`);
}

export function interactionPersistenceCheck(row) {
  const controlType = String(row.control_type || "").trim().toLowerCase();
  const canonicalPath = String(row.canonical_state_path || "").trim();
  const contract = String(row.persistence_contract || "").trim();
  const contractLower = contract.toLowerCase();

  if (looksMissing(contract)) {
    return makeFailResult("persistence", "NO_PERSISTENCE", "Persistence contract missing.");
  }
  if (contractLower.startsWith("missing")) {
    return makeFailResult("persistence", "NO_PERSISTENCE", "Persistence contract unresolved.");
  }
  if (contractLower === "none") {
    return makePassResult("persistence", "persistence not required");
  }
  if (controlType.includes("file_input")) {
    if (contractLower.includes("session")) {
      return makePassResult("persistence", contract);
    }
    return makeFailResult("persistence", "WRONG_PERSISTENCE_SCOPE", "File input must be explicitly session-scoped.");
  }
  if (canonicalPath.toLowerCase().startsWith("runtime.")) {
    if (contractLower.includes("session")) {
      return makePassResult("persistence", contract);
    }
    return makeFailResult("persistence", "WRONG_PERSISTENCE_SCOPE", "Runtime path must be session-scoped.");
  }
  if (canonicalPath.toLowerCase().startsWith("localstorage:")) {
    if (contractLower.includes("localstorage")) {
      return makePassResult("persistence", contract);
    }
    return makeFailResult("persistence", "WRONG_PERSISTENCE_SCOPE", "localStorage path requires localStorage persistence contract.");
  }
  if (canonicalPath.toLowerCase().includes("state.")) {
    if (
      contractLower.includes("campaignid")
      || contractLower.includes("officeid")
      || contractLower.includes("scenarioid")
      || contractLower.includes("scoped")
      || contractLower.includes("state snapshot")
    ) {
      return makePassResult("persistence", contract);
    }
    return makeFailResult("persistence", "WRONG_PERSISTENCE_SCOPE", "State path missing scoped persistence contract.");
  }
  return makePassResult("persistence", contract);
}

function runChecksForRow(row) {
  const checks = {
    population: interactionPopulateCheck(row),
    state_write: interactionStateWriteCheck(row),
    recompute: interactionRecomputeCheck(row),
    render: interactionRenderCheck(row),
    persistence: interactionPersistenceCheck(row),
    output: interactionOutputCheck(row),
    legacy: interactionLegacyDependencyCheck(row),
  };
  const failures = Object.values(checks).filter((entry) => !entry.pass);
  const overallPass = failures.length === 0;
  return {
    interaction_id: row.interaction_id,
    label: row.label,
    module: row.module,
    tier: row.tier,
    surface: row.surface,
    canonical_owner: row.canonical_state_path,
    persistence_contract: row.persistence_contract,
    checks,
    failures: failures.map((entry) => ({
      category: entry.category,
      classification: entry.classification,
      rootCause: entry.rootCause,
      details: entry.details,
    })),
    overallPass,
  };
}

function loadInventory() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error(`missing inventory file: ${INVENTORY_PATH}`);
  }
  const raw = fs.readFileSync(INVENTORY_PATH, "utf8");
  const parsed = parseCsv(raw);
  const header = parsed.header || [];
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) {
      throw new Error(`inventory missing required column: ${col}`);
    }
  }
  return parsed.rows || [];
}

function summarize(results) {
  const summary = {
    total: results.length,
    pass: 0,
    fail: 0,
    failByClassification: {},
  };
  for (const row of results) {
    if (row.overallPass) {
      summary.pass += 1;
      continue;
    }
    summary.fail += 1;
    for (const failure of row.failures) {
      const key = failure.classification;
      summary.failByClassification[key] = Number(summary.failByClassification[key] || 0) + 1;
    }
  }
  return summary;
}

function run() {
  const strict = process.argv.includes("--strict");
  const rows = loadInventory();

  const byId = new Map(rows.map((row) => [String(row.interaction_id || "").trim(), row]));
  const missingHighPriority = HIGH_PRIORITY_IDS.filter((id) => !byId.has(id));

  const results = rows.map((row) => runChecksForRow(row));

  for (const missingId of missingHighPriority) {
    results.push({
      interaction_id: missingId,
      label: "MISSING_HIGH_PRIORITY_CONTROL",
      module: "unknown",
      canonical_owner: "",
      checks: {
        population: makeFailResult("population", "NO_OPTIONS", "High-priority control missing from inventory."),
        state_write: makeFailResult("state_write", "NO_STATE_WRITE", "High-priority control missing from inventory."),
        recompute: makeFailResult("recompute", "NO_RECOMPUTE", "High-priority control missing from inventory."),
        render: makeFailResult("render", "STALE_RENDER", "High-priority control missing from inventory."),
        persistence: makeFailResult("persistence", "NO_PERSISTENCE", "High-priority control missing from inventory."),
        output: makeFailResult("output", "OUTPUT_MISMATCH", "High-priority control missing from inventory."),
        legacy: makeFailResult("legacy", "LEGACY_DEPENDENCY", "High-priority control missing from inventory."),
      },
      failures: [{
        category: "inventory",
        classification: "NO_OPTIONS",
        rootCause: "state-related",
        details: "High-priority control missing from inventory.",
      }],
      overallPass: false,
    });
  }

  const summary = summarize(results);
  const highPriorityResults = HIGH_PRIORITY_IDS.map((id) => {
    const row = results.find((entry) => entry.interaction_id === id);
    return row || null;
  }).filter(Boolean);

  const payload = {
    generatedAt: new Date().toISOString(),
    inventoryPath: path.relative(ROOT, INVENTORY_PATH),
    strictMode: strict,
    requiredColumns: REQUIRED_COLUMNS,
    highPriorityIds: HIGH_PRIORITY_IDS,
    missingHighPriorityIds: missingHighPriority,
    summary,
    controls: results,
    highPriority: {
      total: HIGH_PRIORITY_IDS.length,
      represented: HIGH_PRIORITY_IDS.length - missingHighPriority.length,
      missing: missingHighPriority.length,
      pass: highPriorityResults.filter((row) => row.overallPass).length,
      fail: highPriorityResults.filter((row) => !row.overallPass).length,
    },
  };

  fs.mkdirSync(INTERACTION_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const failCodes = Object.entries(summary.failByClassification)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${code}:${count}`)
    .join(", ");

  process.stdout.write(
    `interaction-integrity: total=${summary.total} pass=${summary.pass} fail=${summary.fail} high_priority_missing=${missingHighPriority.length}${failCodes ? ` fail_codes=[${failCodes}]` : ""}\n`
  );

  if (strict && (summary.fail > 0 || missingHighPriority.length > 0)) {
    process.exit(1);
  }
}

try {
  run();
} catch (err) {
  const msg = err && err.message ? err.message : String(err);
  process.stderr.write(`interaction-integrity: FAIL (${msg})\n`);
  process.exit(1);
}
