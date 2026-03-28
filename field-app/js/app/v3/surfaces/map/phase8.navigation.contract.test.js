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

test("map phase8 contract: map surface includes search and quick navigation controls", () => {
  const source = readSource();
  assert.match(source, /Find geography/, "map surface should include geography search label");
  assert.match(source, /Find area/, "map surface should include search action button");
  assert.match(source, /Campaign view/, "map surface should include campaign view quick action");
  assert.match(source, /Selected area view/, "map surface should include selected area quick action");
  assert.match(source, /Copy area summary/, "map surface should include copy summary action");
  assert.match(source, /Clear selection/, "map surface should include clear selection action");
});

test("map phase8 contract: runtime includes bounded search and selection helpers", () => {
  const source = readSource();
  assert.match(source, /function findFeatureForQuery\(/, "map runtime should include search matcher");
  assert.match(source, /function selectRuntimeGeoid\(/, "map runtime should include selection helper");
  assert.match(source, /function clearRuntimeSelection\(/, "map runtime should include clear-selection helper");
  assert.match(source, /function buildSelectedAreaSummaryText\(/, "map runtime should include copy-summary helper");
  assert.match(source, /function syncMapNavigationState\(/, "map runtime should include nav-state sync helper");
});

test("map phase8 contract: cleared selection state is preserved across refresh cycles", () => {
  const source = readSource();
  assert.match(source, /selectionCleared:\s*false/, "runtime should track cleared-selection state");
  assert.match(source, /if \(runtime\.selectionCleared\)\s*\{\s*runtime\.selectedGeoid = \"\";/m, "refresh logic should preserve explicit selection clear");
});

