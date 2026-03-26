// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetingSource = fs.readFileSync(path.join(__dirname, "targetingConfig.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

function extractFunctionBody(text, name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = text.match(pattern);
  assert.ok(match, `${name} must exist`);
  return String(match[1] || "");
}

test("district targeting advisory: benchmark block is present and advisory-only", () => {
  const syncBody = extractFunctionBody(targetingSource, "sync");
  const syncOnlyBody = String(syncBody.split("function handleMutationResult")[0] || syncBody);
  assert.match(targetingSource, /id="v3DistrictV2TargetingBenchmarkCard"/);
  assert.match(targetingSource, /id="v3DistrictV2TargetingBenchmarkPriorityOverlap"/);
  assert.match(targetingSource, /id="v3DistrictV2TargetingBenchmarkTurnoutOverlap"/);
  assert.match(targetingSource, /id="v3DistrictV2TargetingBenchmarkInterpretation"/);
  assert.match(syncOnlyBody, /context\?\.electionBenchmarkAdvisory/);
  assert.match(syncOnlyBody, /benchmarkCard\.hidden = !benchmarkAdvisory/);
  assert.match(syncOnlyBody, /Priority overlap:/);
  assert.match(syncOnlyBody, /Turnout overlap:/);
  assert.doesNotMatch(syncOnlyBody, /setDistrictTargetingField|runTargeting|applyTargetingPreset/);
});

test("district targeting advisory: surface wiring derives advisory from election snapshot + current rows", () => {
  const syncTargetingBody = extractFunctionBody(indexSource, "syncDistrictV2Targeting");
  assert.match(indexSource, /deriveReachElectionBenchmarkAdvisory/);
  assert.match(syncTargetingBody, /row\?\.geoid \|\| row\?\.geography/);
  assert.match(syncTargetingBody, /electionBenchmarkAdvisory/);
});
