// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function readFromRepo(relPath){
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("operations training deep links: stable training subsection anchors exist", () => {
  const html = readFromRepo("operations.html");
  assert.match(html, /id="overview-dashboard"/, "training overview anchor should exist");
  assert.match(html, /id="daily-entry"/, "training daily-entry anchor should exist");
  assert.match(html, /id="organizer-performance"/, "training organizer-performance anchor should exist");
  assert.match(html, /id="office-performance"/, "training office-performance anchor should exist");
  assert.match(html, /id="volunteer-tracking"/, "training volunteer-tracking anchor should exist");
  assert.match(html, /id="ballot-vbm"/, "training ballot-vbm anchor should exist");
});

test("operations training deep links: operations pages include contextual View Training links", () => {
  const hub = readFromRepo("operations.html");
  const shifts = readFromRepo("operations-shifts.html");
  const turf = readFromRepo("operations-turf.html");
  assert.match(hub, /href="operations\.html#operations_training:overview-dashboard"[^>]*>View Training</, "overview should link to overview training section");
  assert.match(hub, /href="operations\.html#operations_training:organizer-performance"[^>]*>View Training</, "organizer context should link to organizer training section");
  assert.match(hub, /href="operations\.html#operations_training:office-performance"[^>]*>View Training</, "office context should link to office training section");
  assert.match(hub, /href="operations\.html#operations_training:volunteer-tracking"[^>]*>View Training</, "volunteer context should link to volunteer training section");
  assert.match(shifts, /href="operations\.html#operations_training:daily-entry"[^>]*>View Training</, "daily entry page should link to daily-entry training section");
  assert.match(turf, /href="operations\.html#operations_training:ballot-vbm"[^>]*>View Training</, "ballot\/vbm context should link to ballot training section");
});

test("operations training deep links: hash route parsing and anchor scroll behavior are wired", () => {
  const js = readFromRepo("js/operations.js");
  assert.match(js, /function parseModuleHash\(/, "operations runtime should parse deep-link hash state");
  assert.match(js, /operations_training/, "operations runtime should recognize operations_training module token");
  assert.match(js, /const nextHash = activeTrainingAnchor\s*\? `#\$\{active\}:\$\{activeTrainingAnchor\}`\s*: `#\$\{active\}`;/m, "module activation should preserve training anchor in hash");
  assert.match(js, /function scrollToOperationsTrainingAnchor\(/, "operations runtime should support anchored scroll targeting");
  assert.match(js, /window\.addEventListener\("hashchange", \(\) => \{[\s\S]*trainingAnchor: route\.trainingAnchor/m, "hashchange handler should route with training anchor context");
  assert.match(js, /wireOperationsTrainingAnchors\(\)/, "operations runtime should wire in-page training jumps");
});
