// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GOLDEN_FULL_STATE_FIXTURES } from "./goldenFullStateFixtures.js";
import { buildGoldenSignatures } from "./goldenFullStateHarness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = resolve(__dirname, "goldenFullStateExpected.json");
const REQUIRED_FIXTURE_IDS = [
  "municipal_race",
  "county_race",
  "multi_candidate_primary",
  "low_data_race",
  "election_data_imported",
  "war_room_active",
  "archive_recovery_reporting_history",
];

function readExpectedSignatures() {
  const raw = readFileSync(EXPECTED_PATH, "utf8");
  return JSON.parse(raw);
}

test("golden full-state fixtures: required scenario coverage is present", () => {
  const ids = GOLDEN_FULL_STATE_FIXTURES.map((fixture) => fixture.id);
  assert.deepEqual(ids, REQUIRED_FIXTURE_IDS);
});

test("golden full-state fixtures: computed signatures match locked golden outputs", () => {
  const expected = readExpectedSignatures();
  const computed = buildGoldenSignatures(GOLDEN_FULL_STATE_FIXTURES);

  assert.deepEqual(Object.keys(computed), Object.keys(expected));
  assert.deepEqual(computed, expected);
});

test("golden full-state fixtures: signatures are deterministic across repeated runs", () => {
  const first = buildGoldenSignatures(GOLDEN_FULL_STATE_FIXTURES);
  const second = buildGoldenSignatures(GOLDEN_FULL_STATE_FIXTURES);
  assert.deepEqual(second, first);
});
