// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { getDistrictRaceTypeLabel, listDistrictRaceTypeOptions } from "./districtOptionRegistry.js";

test("district option registry: race template selector exposes canonical modern values only", () => {
  const options = listDistrictRaceTypeOptions();
  const values = options.map((row) => row.value);
  assert.equal(values.includes("statewide_executive"), true);
  assert.equal(values.includes("statewide_federal"), true);
  assert.equal(values.includes("state_house"), true);
  assert.equal(values.includes("state_senate"), true);
  assert.equal(values.includes("federal"), false);
  assert.equal(values.includes("state_leg"), false);
  assert.equal(values.includes("municipal"), false);
  assert.equal(values.includes("county"), false);
  assert.equal(options.find((row) => row.value === "statewide_executive")?.label, "Statewide Executive");
});

test("district option registry: legacy race tokens resolve to modern human labels", () => {
  assert.equal(getDistrictRaceTypeLabel("federal"), "Congressional District");
  assert.equal(getDistrictRaceTypeLabel("state_leg"), "State House");
  assert.equal(getDistrictRaceTypeLabel("municipal"), "Municipal Legislative");
  assert.equal(getDistrictRaceTypeLabel("county"), "Countywide");
});
