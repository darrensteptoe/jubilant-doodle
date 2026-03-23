// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const forecastSource = fs.readFileSync(path.join(__dirname, "forecast.js"), "utf8");
const governanceSource = fs.readFileSync(path.join(__dirname, "governance.js"), "utf8");
const sensitivitySource = fs.readFileSync(path.join(__dirname, "sensitivity.js"), "utf8");
const surfaceSource = fs.readFileSync(path.join(__dirname, "surface.js"), "utf8");
const stageMountSource = fs.readFileSync(path.resolve(__dirname, "../../stageMount.js"), "utf8");

function expect(pattern, message) {
  assert.match(indexSource, pattern, message);
}

test("outcome phase10: surface is decomposed into module files", () => {
  expect(/from "\.\/forecast\.js"/, "outcome index must import forecast module");
  expect(/from "\.\/governance\.js"/, "outcome index must import governance module");
  expect(/from "\.\/sensitivity\.js"/, "outcome index must import sensitivity module");
  expect(/from "\.\/surface\.js"/, "outcome index must import surface module");
});

test("outcome phase10: canonical controls and derived outputs are lane-split", () => {
  expect(/const canonicalView = readOutcomeCanonicalBridgeView\(\);/, "controls must read canonical bridge snapshot");
  expect(/const derivedView = readOutcomeDerivedBridgeView\(\);/, "outputs must read derived bridge snapshot");
  expect(/const outcomeControlView = canonicalView;/, "controls lane must be sourced from canonical bridge");
  expect(/const outcomeDerivedView = derivedView;/, "outputs lane must be sourced from derived bridge");
  assert.doesNotMatch(indexSource, /readOutcomeBridgeView\(/, "outcome surface must not read compatibility aggregate outcome view");
  expect(/syncOutcomeForecastCanonicalSnapshot\(/, "canonical controls sync must route through forecast module");
  expect(/const bridgeMc = outcomeDerivedView\?\.mc \|\| null;/, "forecast outputs must read derived MC payload");
});

test("outcome phase10: forecast wiring preserves input persistence and rerun actions", () => {
  assert.match(forecastSource, /bindOutcomeInputField\("v3OutcomeOrgCount", "orgCount"\)/);
  assert.match(forecastSource, /bindOutcomeSelectField\("v3OutcomeMcMode", "mcMode"\)/);
  assert.match(forecastSource, /bindOutcomeAction\("v3BtnOutcomeRun", "runMc"\)/);
  assert.match(forecastSource, /bindOutcomeAction\("v3BtnOutcomeRerun", "rerunMc"\)/);
  assert.match(forecastSource, /bindOutcomeAction\("v3BtnComputeSurface", "computeSurface"\)/);
  expect(/if \(document\.activeElement === input\) \{\s*return;\s*\}/, "active field edits must not be overwritten on blur-sensitive sync");
});

test("outcome phase10: governance, sensitivity, and surface refresh through module orchestrators", () => {
  expect(/syncOutcomeGovernanceSnapshot\(/, "governance panel must refresh through governance module");
  expect(/renderOutcomeSensitivityRows\(/, "sensitivity panel must refresh through sensitivity module");
  expect(/renderOutcomeSurfaceRows\(/, "surface panel must refresh through surface module");
  expect(/syncOutcomeImpactTraceFallback\(/, "surface\/stress explanation must refresh through surface module");
});

test("outcome phase10: module ownership boundaries remain split", () => {
  assert.doesNotMatch(governanceSource, /v3OutcomeOrgCount|v3OutcomeMcMode|v3OutcomeSurfaceLever/, "governance module must not own editable forecast controls");
  assert.doesNotMatch(sensitivitySource, /v3OutcomeRiskFlagGovernance|v3OutcomeOrgCount/, "sensitivity module must not own governance or input controls");
  assert.doesNotMatch(surfaceSource, /v3OutcomeRiskFlagGovernance|v3OutcomeOrgCount/, "surface module must not own governance or input controls");
});

test("outcome phase10: stage mount imports decomposed outcome surface index directly", () => {
  assert.match(
    stageMountSource,
    /from "\.\/surfaces\/outcome\/index\.js"/,
    "stage mount must import outcome surface directly from ./surfaces/outcome/index.js",
  );
});

test("outcome phase10: full-width center-shell layout contract is enforced", () => {
  expect(/createCenterStackFrame\(/, "outcome surface must use center stack frame");
  expect(/createCenterStackColumn\(/, "outcome surface must use center stack column");
  expect(/createCenterModuleCard\(/, "outcome surface must use center module cards");
  assert.doesNotMatch(indexSource, /createSurfaceFrame\("two-col"\)/, "outcome surface must not use two-col frame");
  assert.doesNotMatch(indexSource, /createSurfaceFrame\("three-col"\)/, "outcome surface must not use three-col frame");
});
