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

test("map phase3 worked-geography contract: worked context mode is available and explicitly labeled", () => {
  const source = readSource();
  assert.match(source, /const CONTEXT_MODE_WORKED = "worked_activity_context";/, "worked context mode constant should exist");
  assert.match(source, /Worked activity geography/, "worked context mode option label should be rendered");
  assert.match(source, /if \(mode === CONTEXT_MODE_WORKED\) return CONTEXT_MODE_WORKED;/, "context mode normalization should support worked mode");
});

test("map phase3 worked-geography contract: ops context builds worked-geography index from turf events", () => {
  const source = readSource();
  assert.match(source, /buildWorkedGeographyActivityIndex\(/, "map ops context should build worked-geography index");
  assert.match(source, /workedByUnitKey:/, "ops context should expose worked unit map");
  assert.match(source, /workedByOrganizerAliasUnitKey:/, "ops context should expose organizer+unit worked map");
  assert.match(source, /workedByOfficeUnitKey:/, "ops context should expose office+unit worked map");
});

test("map phase3 worked-geography contract: worked overlay state is generated per mapped feature", () => {
  const source = readSource();
  assert.match(source, /function resolveWorkedActivityContext\(/, "worked activity resolver should exist");
  assert.match(source, /buildFeatureWorkedJoinKeys\(/, "feature join-key helper should exist");
  assert.match(source, /workedGeographyHasSignal:/, "feature properties should include worked signal flag");
  assert.match(source, /workedGeographyOfficeText:/, "feature properties should include office worked text");
  assert.match(source, /workedGeographyOrganizerText:/, "feature properties should include organizer worked text");
});

test("map phase3 worked-geography contract: context mode paint and status are wired for worked signals", () => {
  const source = readSource();
  assert.match(source, /contextMode === CONTEXT_MODE_WORKED/, "context fill helper should branch on worked mode");
  assert.match(source, /\["boolean", \["get", "workedGeographyHasSignal"\], false\]/, "worked mode paint should key off worked signal");
  assert.match(source, /Worked activity mode:/, "context-mode status copy should include worked activity messaging");
});
