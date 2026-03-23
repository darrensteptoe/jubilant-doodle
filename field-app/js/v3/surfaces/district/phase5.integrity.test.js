// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const districtV2Dir = path.join(__dirname, "../districtV2");
const source = fs.readFileSync(path.join(districtV2Dir, "index.js"), "utf8");

function expect(pattern, message) {
  assert.match(source, pattern, message);
}

test("district phase5: replacement surface is decomposed into districtV2 module files", () => {
  expect(/from "\.\/raceContext\.js"/, "districtV2 index must import raceContext module");
  expect(/from "\.\/electorate\.js"/, "districtV2 index must import electorate module");
  expect(/from "\.\/turnoutBaseline\.js"/, "districtV2 index must import turnoutBaseline module");
  expect(/from "\.\/ballot\.js"/, "districtV2 index must import ballot module");
  expect(/from "\.\/candidateHistory\.js"/, "districtV2 index must import candidateHistory module");
  expect(/from "\.\/targetingConfig\.js"/, "districtV2 index must import targetingConfig module");
  expect(/from "\.\/censusConfig\.js"/, "districtV2 index must import censusConfig module");
  expect(/from "\.\/summary\.js"/, "districtV2 index must import summary module");
});

test("district phase5: canonical and derived readers are lane-split", () => {
  expect(/const formSnapshot = readDistrictFormSnapshot\(\);/, "districtV2 canonical lane must read form snapshot");
  expect(/const targetingConfigSnapshot = readDistrictTargetingConfigSnapshot\(\);/, "districtV2 canonical lane must read targeting config snapshot");
  expect(/const censusConfigSnapshot = readDistrictCensusConfigSnapshot\(\);/, "districtV2 canonical lane must read census config snapshot");
  expect(/const snapshot = readDistrictSummarySnapshot\(\);/, "districtV2 derived lane must read summary snapshot");
  expect(/const targetingResultsSnapshot = readDistrictTargetingResultsSnapshot\(\);/, "districtV2 derived lane must read targeting results snapshot");
  expect(/const censusResultsSnapshot = readDistrictCensusResultsSnapshot\(\);/, "districtV2 derived lane must read census results snapshot");
  expect(/const electionDataSummarySnapshot = readDistrictElectionDataSummarySnapshot\(\);/, "districtV2 derived lane must read election data summary snapshot");
});

test("district phase5: replacement handlers are delegated and hold-free", () => {
  expect(/function bindDistrictV2BallotHandlers\(/, "districtV2 must define delegated ballot handlers");
  expect(/candidateBody\.addEventListener\("change"/, "districtV2 ballot must use delegated change handler");
  expect(/candidateBody\.addEventListener\("click"/, "districtV2 ballot must use delegated click handler");
  expect(/historyBody\.addEventListener\("change"/, "districtV2 candidate history must use delegated change handler");
  expect(/historyBody\.addEventListener\("click"/, "districtV2 candidate history must use delegated click handler");
  assert.doesNotMatch(source, /markDistrictPendingWrite\(/, "districtV2 must not use pending-write hold path");
  assert.doesNotMatch(source, /shouldHoldDistrictControlSync\(/, "districtV2 must not use hold-based control sync");
});

test("district phase5: district summary is top-of-page and election summary is compact-only", () => {
  assert.doesNotMatch(source, /title: "Election data summary"/, "districtV2 should not render election data summary as a standalone card");
  expect(/center\.append\([\s\S]*summaryCard,\s*raceCard,/m, "districtV2 should render district summary at the top of the module stack");
  expect(/createCenterStackFrame\(/, "districtV2 must use center stack frame");
  expect(/createCenterStackColumn\(/, "districtV2 must use center stack column");
  expect(/createCenterModuleCard\(/, "districtV2 must use center module cards");
});
