// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../..");

function readProjectFile(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

test("module spacing contract: controls bridge roots use module stack wrapper", () => {
  const source = readProjectFile("js/app/v3/surfaces/controls.js");
  assert.match(source, /class="fpe-module-stack"\s+id="v3ControlsWorkflowBridgeRoot"/, "workflow root must use module stack contract");
  assert.match(source, /class="fpe-module-stack"\s+id="v3ControlsEvidenceBridgeRoot"/, "evidence root must use module stack contract");
  assert.match(source, /class="fpe-module-stack"\s+id="v3ControlsBenchmarkBridgeRoot"/, "benchmark root must use module stack contract");
  assert.match(source, /class="fpe-module-stack"\s+id="v3ControlsCalibrationBridgeRoot"/, "calibration root must use module stack contract");
  assert.match(source, /class="fpe-module-stack"\s+id="v3ControlsFeedbackBridgeRoot"/, "review root must use module stack contract");
});

test("module spacing contract: calendar and census roots use module stack wrapper", () => {
  const planSource = readProjectFile("js/app/v3/surfaces/plan.js");
  const censusSource = readProjectFile("js/app/v3/surfaces/districtV2/censusConfig.js");
  assert.match(planSource, /class="fpe-module-stack"\s+id="v3PlanEventCalendarRoot"/, "calendar/events root must use module stack contract");
  assert.match(censusSource, /class="fpe-census-card fpe-module-stack"\s+id="v3DistrictV2CensusShell"/, "census assumptions root must use module stack contract");
});

test("module spacing contract: scenarios workspace and compare roots use module stack wrapper", () => {
  const scenariosSource = readProjectFile("js/app/v3/surfaces/scenarios.js");
  assert.match(scenariosSource, /class="fpe-module-stack"\s+id="v3ScenarioBridgeRoot"/, "scenario list & actions root must use module stack contract");
  assert.match(scenariosSource, /class="fpe-module-stack"\s+id="v3ScenarioCompareRoot"/, "compare actions & differences root must use module stack contract");
});
