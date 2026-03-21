#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, "interaction", "interaction-inventory.csv");
const RESULTS_PATH = path.join(ROOT, "interaction", "interaction-results.json");
const RUNTIME_PATH = path.join(ROOT, "js", "appRuntime.js");
const STATE_BRIDGE_PATH = path.join(ROOT, "js", "app", "v3", "stateBridge.js");
const DISTRICT_SURFACE_PATH = path.join(ROOT, "js", "app", "v3", "surfaces", "districtV2", "index.js");

const REQUIRED_DISTRICT_INTERACTIONS = [
  "district_mode_selector",
  "district_office_level_selector",
  "district_election_type_selector",
  "district_your_candidate_selector",
  "district_undecided_mode_selector",
  "district_candidate_name_input",
  "district_user_split_input",
  "census_state_fips_selector",
  "census_county_fips_selector",
  "census_geo_select_multiselect",
];

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return { header: [], rows: [] };

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQuote && line[i + 1] === "\"") {
          cur += "\"";
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
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return { header, rows };
}

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

function run() {
  const errors = [];

  assert(fs.existsSync(INVENTORY_PATH), `missing inventory file: ${INVENTORY_PATH}`, errors);
  assert(fs.existsSync(RESULTS_PATH), `missing interaction results file: ${RESULTS_PATH}`, errors);
  assert(fs.existsSync(RUNTIME_PATH), `missing runtime file: ${RUNTIME_PATH}`, errors);
  assert(fs.existsSync(STATE_BRIDGE_PATH), `missing state bridge file: ${STATE_BRIDGE_PATH}`, errors);
  assert(fs.existsSync(DISTRICT_SURFACE_PATH), `missing district surface file: ${DISTRICT_SURFACE_PATH}`, errors);
  if (errors.length) {
    throw new Error(errors.join(" | "));
  }

  const inventory = parseCsv(fs.readFileSync(INVENTORY_PATH, "utf8")).rows;
  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
  const runtimeSrc = fs.readFileSync(RUNTIME_PATH, "utf8");
  const stateBridgeSrc = fs.readFileSync(STATE_BRIDGE_PATH, "utf8");
  const districtSurfaceSrc = fs.readFileSync(DISTRICT_SURFACE_PATH, "utf8");

  const districtInventory = inventory.filter((row) => String(row.surface || "").trim() === "district");
  const resultById = new Map((results?.controls || []).map((row) => [String(row?.interaction_id || "").trim(), row]));

  assert(districtInventory.length > 0, "district inventory is empty", errors);
  for (const id of REQUIRED_DISTRICT_INTERACTIONS) {
    assert(
      districtInventory.some((row) => String(row.interaction_id || "").trim() === id),
      `missing required district interaction in inventory: ${id}`,
      errors,
    );
  }

  for (const control of districtInventory) {
    const id = String(control.interaction_id || "").trim();
    const result = resultById.get(id);
    assert(!!result, `missing interaction result entry for district control: ${id}`, errors);
    const checks = result?.checks || {};
    const failingCategory = Object.entries(checks).find(([, value]) => !value?.pass);
    assert(!failingCategory, `district control failed ${failingCategory?.[0] || "unknown"}: ${id}`, errors);
  }

  assert(
    /function\s+districtBridgeCanonicalView\s*\(\)\s*\{[\s\S]*?return\s+districtBridgeStateView\(/.test(runtimeSrc) === false,
    "districtBridgeCanonicalView still delegates to districtBridgeStateView()",
    errors,
  );
  assert(
    /function\s+districtBridgeDerivedView\s*\(\)\s*\{[\s\S]*?return\s+districtBridgeStateView\(/.test(runtimeSrc) === false,
    "districtBridgeDerivedView still delegates to districtBridgeStateView()",
    errors,
  );
  assert(runtimeSrc.includes("getCanonicalView: () => districtBridgeCanonicalView()"), "district bridge API missing getCanonicalView()", errors);
  assert(runtimeSrc.includes("getDerivedView: () => districtBridgeDerivedView()"), "district bridge API missing getDerivedView()", errors);

  for (const token of [
    "readDistrictSummarySnapshot",
    "readDistrictTargetingConfigSnapshot",
    "readDistrictTargetingResultsSnapshot",
    "readDistrictCensusConfigSnapshot",
    "readDistrictCensusResultsSnapshot",
  ]) {
    assert(stateBridgeSrc.includes(`export function ${token}`), `stateBridge missing ${token}()`, errors);
  }

  assert(
    districtSurfaceSrc.includes("const snapshot = readDistrictSummarySnapshot();"),
    "district derived refresh is not using summary snapshot",
    errors,
  );
  assert(
    districtSurfaceSrc.includes("const targetingConfigSnapshot = readDistrictTargetingConfigSnapshot();"),
    "district canonical refresh is not using targeting config snapshot",
    errors,
  );
  assert(
    districtSurfaceSrc.includes("const censusConfigSnapshot = readDistrictCensusConfigSnapshot();"),
    "district canonical refresh is not using census config snapshot",
    errors,
  );
  assert(
    districtSurfaceSrc.includes("const targetingResultsSnapshot = readDistrictTargetingResultsSnapshot();"),
    "district derived refresh is not using targeting results snapshot",
    errors,
  );
  assert(
    districtSurfaceSrc.includes("const censusResultsSnapshot = readDistrictCensusResultsSnapshot();"),
    "district derived refresh is not using census results snapshot",
    errors,
  );
  assert(
    !districtSurfaceSrc.includes("readDistrictSnapshot("),
    "district surface still references legacy readDistrictSnapshot()",
    errors,
  );
  assert(
    !districtSurfaceSrc.includes("readDistrictTargetingSnapshot("),
    "district surface still references mixed readDistrictTargetingSnapshot()",
    errors,
  );
  assert(
    !districtSurfaceSrc.includes("readDistrictCensusSnapshot("),
    "district surface still references mixed readDistrictCensusSnapshot()",
    errors,
  );

  if (errors.length) {
    process.stderr.write(`district-integrity: FAIL (${errors.join(" | ")})\n`);
    process.exit(1);
  }

  process.stdout.write(
    `district-integrity: ok controls=${districtInventory.length} required=${REQUIRED_DISTRICT_INTERACTIONS.length} lane_split=verified\n`,
  );
}

try {
  run();
} catch (err) {
  process.stderr.write(`district-integrity: FAIL (${err instanceof Error ? err.message : String(err)})\n`);
  process.exit(1);
}
