// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../../..");

function readFromRepo(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("map phase10 contract: map surface exposes reporting hooks for selected area and metric snapshots", () => {
  const mapSource = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(mapSource, /function buildMapReportingSnapshot\(/, "map surface should build a reporting snapshot");
  assert.match(mapSource, /globalThis\.__FPE_MAP_REPORTING__/, "map surface should publish reporting hooks");
  assert.match(mapSource, /getSelectedAreaSummary:/, "reporting hooks should expose selected area summary accessor");
  assert.match(mapSource, /getModeScopeSummary:/, "reporting hooks should expose mode/scope summary accessor");
  assert.match(mapSource, /getOrganizerWorkedScopeSummary:/, "reporting hooks should expose organizer worked scope summary accessor");
  assert.match(mapSource, /getOfficeWorkedScopeSummary:/, "reporting hooks should expose office worked scope summary accessor");
  assert.match(mapSource, /getMetricSummary:/, "reporting hooks should expose metric summary accessor");
  assert.match(mapSource, /getOfficeGeographySnapshot:/, "reporting hooks should expose office geography snapshot accessor");
  assert.match(mapSource, /copySelectedAreaSummary:/, "reporting hooks should expose copy helper");
  assert.match(mapSource, /copyModeScopeSummary:/, "reporting hooks should expose mode/scope copy helper");
});

test("map phase10 contract: diagnostics report map reporting-hook availability", () => {
  const diagnostics = readFromRepo("js/app/diagnosticsBuilders.js");
  assert.match(diagnostics, /reportingHook=/, "diagnostics should include map reporting-hook availability line");
  assert.match(diagnostics, /reportingSummaries:/, "diagnostics should include map reporting summary availability line");
});

test("map phase10 contract: map quick actions have dedicated responsive polish class", () => {
  const mapSource = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(mapSource, /fpe-map-quick-actions/, "map surface should mark quick-action row for map-specific polish");

  const css = readFromRepo("styles-fpe-v3.css");
  assert.match(css, /\.fpe-map-quick-actions/, "map quick actions class should be styled");
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*\.fpe-map-quick-actions \.fpe-btn[\s\S]*flex:\s*1 1 180px;/m, "map quick actions should include iPad breakpoint behavior");
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.fpe-map-quick-actions \.fpe-btn[\s\S]*flex:\s*1 1 220px;/m);
  assert.match(css, /\.fpe-map-legend[\s\S]*padding:\s*8px 10px;/m, "legend should include bounded panel polish padding");
  assert.match(css, /\.fpe-map-inspect-guide[\s\S]*line-height:\s*1\.45;/m, "inspect guide copy should include readability polish");
});

test("map phase10 contract: no secret-style token exposure in client-facing map/reporting sources", () => {
  const sources = [
    readFromRepo("index.html"),
    readFromRepo("js/app/runtimeConfig.js"),
    readFromRepo("js/app/v3/surfaces/map/index.js"),
    readFromRepo("js/app/v3/surfaces/controls.js"),
  ].join("\n");
  assert.doesNotMatch(sources, /\bsk\.[A-Za-z0-9_-]{10,}/, "client-facing map/reporting sources must not include secret-style Mapbox tokens");
});

test("map phase10 contract: defensive runtime handling covers token, style/assets, geometry, and metric gaps", () => {
  const mapSource = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(mapSource, /MAP_STATUS_TOKEN_INVALID/, "map runtime should include invalid-token status handling");
  assert.match(mapSource, /MAP_STATUS_BOOT_NETWORK_FAILED/, "map runtime should include network/assets failure handling");
  assert.match(mapSource, /MAP_STATUS_BOOT_STYLE_FAILED/, "map runtime should include style-load failure handling");
  assert.match(mapSource, /MAP_STATUS_GEOGRAPHY_UNAVAILABLE/, "map runtime should include missing-geometry handling");
  assert.match(mapSource, /MAP_STATUS_METRIC_UNAVAILABLE/, "map runtime should include missing-metric handling");
  assert.match(mapSource, /bootFailure === "style"/, "map boot error handling should branch style failures explicitly");
});

test("map phase10 contract: reporting snapshot includes selected area, metric, and office geography summaries", () => {
  const mapSource = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(mapSource, /selectedAreaSummary:/, "reporting snapshot should include selected area summary");
  assert.match(mapSource, /modeScopeSummary\b/, "reporting snapshot should include mode/scope summary");
  assert.match(mapSource, /organizerWorkedScopeSummary\b/, "reporting snapshot should include organizer worked scope summary");
  assert.match(mapSource, /officeWorkedScopeSummary\b/, "reporting snapshot should include office worked scope summary");
  assert.match(mapSource, /metricSummary:/, "reporting snapshot should include selected metric summary");
  assert.match(mapSource, /officeGeographySnapshot:/, "reporting snapshot should include office geography snapshot");
  assert.match(mapSource, /Map mode\/scope:/, "selected area summary copy should include mode/scope truth");
  assert.match(mapSource, /runtime\.reportingSnapshot = buildMapReportingSnapshot\(runtime\);/, "runtime should retain reporting snapshot for diagnostics/export hooks");
});

test("map phase10 contract: app-level mapbox token persistence remains outside scenario canon schema", () => {
  const runtimeConfig = readFromRepo("js/app/runtimeConfig.js");
  const schema = readFromRepo("js/core/state/schema.js");
  assert.match(runtimeConfig, /MAPBOX_PUBLIC_TOKEN_STORAGE_KEY/, "runtime config should define app-level map token storage key");
  assert.match(runtimeConfig, /function saveMapboxPublicToken\(/, "runtime config should support saving app-level map token");
  assert.match(runtimeConfig, /function clearSavedMapboxPublicToken\(/, "runtime config should support clearing app-level map token");
  assert.doesNotMatch(schema, /MAPBOX_PUBLIC_TOKEN|vice\.mapbox\.publicToken/i, "scenario schema must not persist app-level map token state");
});
