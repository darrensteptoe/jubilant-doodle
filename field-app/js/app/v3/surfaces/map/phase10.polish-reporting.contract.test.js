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
  assert.match(mapSource, /getMetricSummary:/, "reporting hooks should expose metric summary accessor");
  assert.match(mapSource, /getOfficeGeographySnapshot:/, "reporting hooks should expose office geography snapshot accessor");
  assert.match(mapSource, /copySelectedAreaSummary:/, "reporting hooks should expose copy helper");
});

test("map phase10 contract: diagnostics report map reporting-hook availability", () => {
  const diagnostics = readFromRepo("js/app/diagnosticsBuilders.js");
  assert.match(diagnostics, /reportingHook=/, "diagnostics should include map reporting-hook availability line");
});

test("map phase10 contract: map quick actions have dedicated responsive polish class", () => {
  const mapSource = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(mapSource, /fpe-map-quick-actions/, "map surface should mark quick-action row for map-specific polish");

  const css = readFromRepo("styles-fpe-v3.css");
  assert.match(css, /\.fpe-map-quick-actions/, "map quick actions class should be styled");
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.fpe-map-quick-actions \.fpe-btn[\s\S]*flex:\s*1 1 220px;/m);
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

