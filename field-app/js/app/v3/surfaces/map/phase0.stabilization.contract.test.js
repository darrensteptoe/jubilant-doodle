// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readSource() {
  return fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
}

test("map phase0 contract: load-state status copy covers config, context, geometry, and boot states", () => {
  const source = readSource();
  assert.match(source, /MAP_STATUS_TOKEN_MISSING = "No Mapbox token configured\./, "missing-token state should be explicit");
  assert.match(source, /MAP_STATUS_TOKEN_INVALID = "Mapbox token is invalid for browser use\./, "invalid-token state should be explicit");
  assert.match(source, /MAP_STATUS_CONTEXT_REQUIRED = "Select campaign, office, and geography context to load the map\./, "context-required state should be explicit");
  assert.match(source, /MAP_STATUS_NO_GEOGRAPHY = "No geography matched the current selection\./, "no-geography state should be explicit");
  assert.match(source, /MAP_STATUS_GEOGRAPHY_UNAVAILABLE = "Campaign geography is unavailable/, "geography-unavailable state should be explicit");
  assert.match(source, /MAP_STATUS_BOOT_FAILED = "Map boot failed\./, "boot-failed state should be explicit");
});

test("map phase0 contract: runtime diagnostics emit deterministic lifecycle statuses", () => {
  const source = readSource();
  assert.match(source, /publishMapRuntimeDiagnostics\(runtime, "awaiting_context"\)/, "runtime should publish awaiting-context status");
  assert.match(source, /publishMapRuntimeDiagnostics\(runtime, "geometry_unavailable"\)/, "runtime should publish geometry-unavailable status");
  assert.match(source, /publishMapRuntimeDiagnostics\(runtime, "no_geography"\)/, "runtime should publish no-geography status");
  assert.match(source, /publishMapRuntimeDiagnostics\(runtime, "ready"\)/, "runtime should publish ready status");
});

test("map phase0 contract: selection state transitions are explicit and stable", () => {
  const source = readSource();
  assert.match(source, /function selectRuntimeGeoid\(/, "selection helper should exist");
  assert.match(source, /runtime\.selectedGeoid = id;/, "selection helper should set selected geoid");
  assert.match(source, /runtime\.selectionCleared = false;/, "selection helper should reset cleared flag");
  assert.match(source, /function clearRuntimeSelection\(/, "clear-selection helper should exist");
  assert.match(source, /runtime\.selectedGeoid = "";/, "clear-selection helper should clear selected geoid");
  assert.match(source, /runtime\.selectionCleared = true;/, "clear-selection helper should set cleared flag");
});

test("map phase0 contract: refit/reset controls are wired to bounded view helpers", () => {
  const source = readSource();
  assert.match(source, /function fitRuntimeBoundary\(/, "fit helper should exist");
  assert.match(source, /function resetRuntimeView\(/, "reset helper should exist");
  assert.match(source, /fitBtn\.addEventListener\("click", \(\) => \{\s*const runtime = mapRuntime;\s*const ok = fitRuntimeBoundary\(runtime\);/m, "fit button should call fit helper");
  assert.match(source, /resetBtn\.addEventListener\("click", \(\) => \{\s*const runtime = mapRuntime;\s*const ok = resetRuntimeView\(runtime\);/m, "reset button should call reset helper");
});

test("map phase0 contract: bookmark state is bounded to current map context", () => {
  const source = readSource();
  assert.match(source, /runtime\.bookmarkedGeoid = "";/, "bookmark should clear on context reset paths");
  assert.match(source, /runtime\.bookmarkedLabel = "";/, "bookmark label should clear on context reset paths");
  assert.match(source, /if \(cleanText\(runtime\.bookmarkedGeoid\) && !runtime\.featureByGeoid\.has\(runtime\.bookmarkedGeoid\)\)/, "stale bookmark should be dropped when geometry context changes");
});
