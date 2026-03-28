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

test("map phase9 contract: diagnostics include map runtime geometry and metric provenance", () => {
  const diagnostics = readFromRepo("js/app/diagnosticsBuilders.js");
  assert.match(diagnostics, /function readMapRuntimeDiagnostics\(/, "diagnostics should read map runtime diagnostics snapshot");
  assert.match(diagnostics, /out\.push\("map runtime:"\)/, "diagnostics should include map runtime section");
  assert.match(diagnostics, /geometry: resolution=/, "diagnostics should report geometry availability");
  assert.match(diagnostics, /selectedMetric:/, "diagnostics should report selected metric details");
  assert.match(diagnostics, /provenance:/, "diagnostics should report metric provenance/context");
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

