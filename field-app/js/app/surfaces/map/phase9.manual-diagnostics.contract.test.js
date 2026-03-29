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

test("map phase9 contract: manual helper includes canon-vs-display and planning-vs-execution guidance", () => {
  const resolver = readFromRepo("js/app/intelligenceResolver.js");
  assert.match(resolver, /moduleId === "mapOperationsGuide"/, "map module helper panel should be present");
  assert.match(resolver, /Canon vs display-only trust boundary/, "map helper should include canon/display trust section");
  assert.match(resolver, /Planning context/, "map helper should include planning context guidance");
  assert.match(resolver, /Execution context/, "map helper should include execution context guidance");
});

test("map phase9 contract: map helper includes token setup and diagnostics interpretation guidance", () => {
  const resolver = readFromRepo("js/app/intelligenceResolver.js");
  assert.match(resolver, /Mapbox token and diagnostics/, "map helper should include token/diagnostics panel");
  assert.match(resolver, /Controls > Map configuration/, "map helper should direct operators to controls-based token setup");
  assert.match(resolver, /public token beginning with pk\./, "map helper should require public pk token");
  assert.match(resolver, /secret-style Mapbox tokens \(sk\.\)/, "map helper should explicitly forbid client-side sk token usage");
  assert.match(resolver, /selected metric provenance/, "map helper should guide diagnostics reading for metric provenance");
});

test("map phase9 contract: diagnostics include map runtime geometry and metric provenance", () => {
  const diagnostics = readFromRepo("js/app/diagnosticsBuilders.js");
  assert.match(diagnostics, /function readMapRuntimeDiagnostics\(/, "diagnostics should read map runtime diagnostics snapshot");
  assert.match(diagnostics, /out\.push\("map runtime:"\)/, "diagnostics should include map runtime section");
  assert.match(diagnostics, /geometry: resolution=/, "diagnostics should report geometry availability");
  assert.match(diagnostics, /selectedMetric:/, "diagnostics should report selected metric details");
  assert.match(diagnostics, /provenance:/, "diagnostics should report metric provenance/context");
});

test("map phase9 contract: diagnostics include explicit map config token-status reporting", () => {
  const diagnostics = readFromRepo("js/app/diagnosticsBuilders.js");
  assert.match(diagnostics, /function mapConfigDiagnosticStatus\(/, "diagnostics should include map config status classifier");
  assert.match(diagnostics, /Mapbox browser token ready/, "diagnostics should include mapbox-ready summary");
  assert.match(diagnostics, /Mapbox token config is invalid/, "diagnostics should include invalid-token summary");
  assert.match(diagnostics, /Mapbox token is not configured/, "diagnostics should include missing-token summary");
  assert.match(diagnostics, /out\.push\("map config:"\)/, "diagnostics should print map config section");
  assert.match(diagnostics, /storageKey=/, "diagnostics should include map token storage-key visibility");
  assert.match(diagnostics, /invalidConfigValue=/, "diagnostics should include invalid-config flag");
});

test("map phase9 contract: map doctrine includes app-level token configuration path", () => {
  const doctrine = readFromRepo("js/app/moduleDoctrineRegistry.js");
  assert.match(doctrine, /id:\s*"mapOperationsGuide"/, "map doctrine entry should exist");
  assert.match(doctrine, /Controls > Map configuration/, "map doctrine should direct token setup to controls");
  assert.match(doctrine, /public token starting with pk\./, "map doctrine should enforce public pk token requirement");
  assert.match(doctrine, /Do not store Mapbox token in scenario data\./, "map doctrine should preserve app-level token boundary");
});

test("map phase9 contract: map surface publishes runtime diagnostics and legend context trust copy", () => {
  const mapSource = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(mapSource, /globalThis\.__FPE_MAP_RUNTIME_DIAGNOSTICS__/, "map surface should publish runtime diagnostics snapshot");
  assert.match(mapSource, /Context: \$\{metricContextText\(metricSetId\)\}/, "legend provenance should include context trust copy");
  assert.match(mapSource, /METRIC_SET_CONTEXT_MAP/, "map surface should map metric families to explicit context labels");
});

test("map phase9 contract: runtime diagnostics line includes map runtime status token", () => {
  const v3Index = readFromRepo("js/app/v3/index.js");
  assert.match(v3Index, /function readMapRuntimeDiagnosticsSnapshot\(/, "v3 diagnostics should read map runtime snapshot");
  assert.match(v3Index, /map:\s*\{/, "v3 runtime snapshot should include map diagnostics block");
  assert.match(v3Index, /`map \$\{mapRuntimeText\}`/, "runtime diagnostics line should include map runtime token");
});
