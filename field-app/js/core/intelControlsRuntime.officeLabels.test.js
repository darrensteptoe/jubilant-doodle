// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  generateCalibrationSourceBrief,
  generateScenarioSummaryBrief,
} from "./intelControlsRuntime.js";

function makeState(overrides = {}){
  return {
    scenarioName: "Baseline",
    raceType: "state_leg",
    templateMeta: {
      appliedTemplateId: "state_house",
      officeLevel: "state_legislative_lower",
    },
    ui: {
      activeScenarioId: "baseline",
    },
    intelState: {},
    ...overrides,
  };
}

test("intel briefs: calibration source brief uses human office/race label", () => {
  const result = generateCalibrationSourceBrief(makeState());
  assert.equal(result?.ok, true);
  const content = String(result?.brief?.content || "");
  assert.match(content, /Race type: State House/);
  assert.doesNotMatch(content, /Race type: state_leg/);
});

test("intel briefs: scenario summary uses human office/race label", () => {
  const result = generateScenarioSummaryBrief(makeState());
  assert.equal(result?.ok, true);
  const content = String(result?.brief?.content || "");
  assert.match(content, /Race type: State House/);
  assert.doesNotMatch(content, /Race type: state_leg/);
});
