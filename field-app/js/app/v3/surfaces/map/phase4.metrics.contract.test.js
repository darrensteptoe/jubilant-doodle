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

test("map phase4 contract: legend container and provenance fields are rendered", () => {
  const source = readSource();
  assert.match(source, /const LEGEND_STATUS_ID = "v3MapLegendStatus";/, "legend status id should exist");
  assert.match(source, /const LEGEND_BODY_ID = "v3MapLegendBody";/, "legend body id should exist");
  assert.match(source, /const LEGEND_PROVENANCE_ID = "v3MapLegendProvenance";/, "legend provenance id should exist");
  assert.match(source, /<div class="fpe-control-label">Legend<\/div>/, "legend section should be rendered");
});

test("map phase4 contract: metric rendering uses legend-driven quantile bins", () => {
  const source = readSource();
  assert.match(source, /function buildLegendModel\(/, "legend model builder must exist");
  assert.match(source, /rangeMode: "quantile-5"/, "legend should expose quantile-5 mode when possible");
  assert.match(source, /fillExpressionForMetric\(metric, legend\)/, "fill expression should use legend model");
});

test("map phase4 contract: provenance mapping includes canonical metric bundles", () => {
  const source = readSource();
  assert.match(source, /const METRIC_SET_PROVENANCE_MAP = \{/, "metric provenance map should exist");
  assert.match(source, /field_efficiency:/, "field efficiency provenance entry should exist");
  assert.match(source, /turnout_potential:/, "turnout potential provenance entry should exist");
  assert.match(source, /Canonical Census ACS\/PL/, "provenance should reference canonical census source");
});

