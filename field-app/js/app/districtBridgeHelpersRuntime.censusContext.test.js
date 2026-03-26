// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { createDistrictBridgeHelpersRuntime } from "./districtBridgeHelpersRuntime.js";
import { resolutionNeedsCounty } from "../core/censusModule.js";
import { buildDistrictCensusContextHint } from "../core/districtView.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function roundWholeNumberByMode(value, { fallback = 0 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.floor(num);
}

function makeHelpers() {
  return createDistrictBridgeHelpersRuntime({
    cleanText,
    resolutionNeedsCounty,
    roundWholeNumberByMode,
    isScenarioLockedForEdits: () => false,
  });
}

test("census context: tract mode blocks geo/fetch actions without county", () => {
  const helpers = makeHelpers();
  const disabledMap = helpers.districtBridgeBuildCensusDisabledMap(
    {},
    {
      resolution: "tract",
      stateFips: "17",
      countyFips: "",
      loadingGeo: false,
      loadingRows: false,
    },
  );
  assert.equal(disabledMap.v3BtnCensusLoadGeo, true);
  assert.equal(disabledMap.v3BtnCensusFetchRows, true);
});

test("census context: tract mode enables geo/fetch actions with state + county", () => {
  const helpers = makeHelpers();
  const disabledMap = helpers.districtBridgeBuildCensusDisabledMap(
    {},
    {
      resolution: "tract",
      stateFips: "17",
      countyFips: "031",
      loadingGeo: false,
      loadingRows: false,
    },
  );
  assert.equal(disabledMap.v3BtnCensusLoadGeo, false);
  assert.equal(disabledMap.v3BtnCensusFetchRows, false);
});

test("census context: legacy county fallback is accepted for tract readiness", () => {
  const helpers = makeHelpers();
  const disabledMap = helpers.districtBridgeBuildCensusDisabledMap(
    {},
    {
      resolution: "tract",
      stateFips: "17",
      county: "031",
      countyFips: "",
      loadingGeo: false,
      loadingRows: false,
    },
  );
  assert.equal(disabledMap.v3BtnCensusLoadGeo, false);
  assert.equal(disabledMap.v3BtnCensusFetchRows, false);
  assert.equal(
    buildDistrictCensusContextHint({ resolution: "tract", stateFips: "17", county: "031" }),
    "Tract context: state 17, county 031.",
  );
});
