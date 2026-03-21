// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const ballotSource = fs.readFileSync(path.join(__dirname, "ballot.js"), "utf8");

function expect(pattern, message) {
  assert.match(source, pattern, message);
}

test("district phase5: surface is decomposed into module files", () => {
  expect(/from "\.\/raceSetup\.js"/, "district index must import raceSetup module");
  expect(/from "\.\/ballot\.js"/, "district index must import ballot module");
  assert.match(ballotSource, /from "\.\/candidateHistory\.js"/, "district ballot module must import candidateHistory module");
  expect(/from "\.\/targetingConfig\.js"/, "district index must import targetingConfig module");
  expect(/from "\.\/censusConfig\.js"/, "district index must import censusConfig module");
  expect(/from "\.\/summary\.js"/, "district index must import summary module");
  expect(/from "\.\/templateProfile\.js"/, "district index must import templateProfile module");
  expect(/from "\.\/electionDataSummary\.js"/, "district index must import electionDataSummary module");
});

test("district phase5: canonical and derived readers are lane-split", () => {
  expect(/const formSnapshot = readDistrictFormSnapshot\(\);/, "district canonical lane must read form snapshot");
  expect(/const targetingConfigSnapshot = readDistrictTargetingConfigSnapshot\(\);/, "district canonical lane must read targeting config snapshot");
  expect(/const censusConfigSnapshot = readDistrictCensusConfigSnapshot\(\);/, "district canonical lane must read census config snapshot");
  expect(/const snapshot = readDistrictSummarySnapshot\(\);/, "district derived lane must read summary snapshot");
  expect(/const targetingResultsSnapshot = readDistrictTargetingResultsSnapshot\(\);/, "district derived lane must read targeting results snapshot");
  expect(/const censusResultsSnapshot = readDistrictCensusResultsSnapshot\(\);/, "district derived lane must read census results snapshot");
  expect(/const electionDataSummarySnapshot = readDistrictElectionDataSummarySnapshot\(\);/, "district derived lane must read election data summary snapshot");
});

test("district phase5: table hydration preserves active row focus independently", () => {
  expect(/captureActiveControlState\(targetBody, "candidateId"\)/, "candidate table must capture active candidate row state");
  expect(/captureActiveControlState\(targetList, "candidateId"\)/, "user split must capture active candidate row state");
  expect(/captureActiveControlState\(targetBody, "recordId"\)/, "candidate history must capture active record row state");
  expect(/restoreActiveControlState\(targetBody, "candidateId", activeState\)/, "candidate table must restore row focus");
  expect(/restoreActiveControlState\(targetList, "candidateId", activeState\)/, "user split must restore row focus");
  expect(/restoreActiveControlState\(targetBody, "recordId", activeState\)/, "candidate history must restore row focus");
});

test("district phase5: election data summary card is present and full-width stack is used", () => {
  expect(/title: "Election data summary"/, "district must render election data summary card");
  expect(/createCenterStackFrame\(/, "district must use center stack frame");
  expect(/createCenterStackColumn\(/, "district must use center stack column");
  expect(/createCenterModuleCard\(/, "district must use center module cards");
});
