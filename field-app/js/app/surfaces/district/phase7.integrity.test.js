// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "../districtV2/index.js"), "utf8");

function expect(pattern, message) {
  assert.match(source, pattern, message);
}

test("district phase7: census and targeting modules stay lane-split between canonical inputs and derived outputs", () => {
  expect(/const targetingConfigSnapshot = readDistrictTargetingConfigSnapshot\(\);/, "targeting controls must read canonical config snapshot");
  expect(/const targetingResultsSnapshot = readDistrictTargetingResultsSnapshot\(\);/, "targeting output must read derived results snapshot");
  expect(/const censusConfigSnapshot = readDistrictCensusConfigSnapshot\(\);/, "census controls must read canonical config snapshot");
  expect(/const censusResultsSnapshot = readDistrictCensusResultsSnapshot\(\);/, "census output must read derived results snapshot");
});

test("district phase7: census and targeting cards use full-width center module shell", () => {
  expect(/createCenterStackFrame\(/, "district must use center stack frame");
  expect(/createCenterStackColumn\(/, "district must use center stack column");
  expect(/createCenterModuleCard\(\{\s*title:\s*"Census assumptions"/, "district must render census card as center module");
  expect(/createCenterModuleCard\(\{\s*title:\s*"Targeting config"/, "district must render targeting card as center module");
  assert.doesNotMatch(source, /createSurfaceFrame\("two-col"\)/, "district must not use mixed two-col center layout");
  assert.doesNotMatch(source, /createSurfaceFrame\("three-col"\)/, "district must not use mixed three-col center layout");
});
