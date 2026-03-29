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

test("map phase2 contract: map status copy distinguishes token and runtime failures", () => {
  const source = readSource();
  assert.match(source, /No Mapbox token configured\./, "missing-token status must be explicit");
  assert.match(source, /Mapbox token is invalid for browser use\./, "invalid-token status must be explicit");
  assert.match(source, /Map boot failed\./, "map boot failure status must be explicit");
  assert.match(source, /Campaign geography is unavailable/, "geography unavailable status must be explicit");
});

test("map phase2 contract: controls handoff action exists for token setup", () => {
  const source = readSource();
  assert.match(source, /id="\$\{ACTION_BTN_ID\}"/, "map card should render Controls action button");
  assert.match(source, /Set Mapbox token in Controls/, "map action button label should direct operator to Controls");
  assert.match(source, /navigateStage\("controls"/, "map action should navigate to Controls stage");
});

test("map phase2 contract: metric selector is gated until map readiness", () => {
  const source = readSource();
  assert.match(source, /function setMetricSelectorDisabled/, "metric selector disable helper is required");
  assert.match(source, /function setMetricSelectorEnabled/, "metric selector enable helper is required");
  assert.match(source, /id="\$\{METRIC_SELECT_ID\}" disabled/, "metric selector should default to disabled in empty state");
});

test("map phase2 contract: map listens for app-level token config updates", () => {
  const source = readSource();
  assert.match(source, /vice:mapbox-config-updated/, "map stage should refresh after token save/clear");
});

