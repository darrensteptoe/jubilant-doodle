// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeCanonicalState } from "../state/schema.js";
import { updateDistrictFormField, updateDistrictTemplateField } from "../actions/district.js";
import { selectDistrictCanonicalView } from "./districtCanonical.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRuntimePath = path.resolve(__dirname, "../../appRuntime.js");

test("district race context canonical selector prefers domains over legacy top-level fallback fields", () => {
  const state = makeCanonicalState({ nowDate: new Date("2026-03-21T10:00:00.000Z") });
  state.domains.district.templateProfile.raceType = "congressional_district";
  state.domains.district.templateProfile.officeLevel = "federal";
  state.domains.district.form.electionDate = "2026-11-03";
  state.domains.district.form.universeSize = 145000;

  // Simulate stale legacy top-level defaults still present in mixed runtime objects.
  state.raceType = "state_leg";
  state.electionDate = "";
  state.universeSize = 0;
  state.templateMeta = {
    officeLevel: "",
  };

  const canonical = selectDistrictCanonicalView(state);
  assert.equal(canonical.templateProfile.raceType, "congressional_district");
  assert.equal(canonical.templateProfile.officeLevel, "federal");
  assert.equal(canonical.form.electionDate, "2026-11-03");
  assert.equal(canonical.form.universeSize, 145000);
});

test("district race context values persist after updates and refresh/reopen serialization", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T10:15:00.000Z") });

  state = updateDistrictTemplateField(state, { field: "raceType", value: "city_council" }).state;
  state = updateDistrictTemplateField(state, { field: "officeLevel", value: "local" }).state;
  state = updateDistrictFormField(state, { field: "electionDate", value: "2026-05-05" }).state;
  state = updateDistrictFormField(state, { field: "universeSize", value: "87500" }).state;

  const afterEdit = selectDistrictCanonicalView(state);
  assert.equal(afterEdit.templateProfile.raceType, "city_council");
  assert.equal(afterEdit.templateProfile.officeLevel, "local");
  assert.equal(afterEdit.form.electionDate, "2026-05-05");
  assert.equal(afterEdit.form.universeSize, 87500);

  const reopened = JSON.parse(JSON.stringify(state));
  const afterReopen = selectDistrictCanonicalView(reopened);
  assert.equal(afterReopen.templateProfile.raceType, "city_council");
  assert.equal(afterReopen.templateProfile.officeLevel, "local");
  assert.equal(afterReopen.form.electionDate, "2026-05-05");
  assert.equal(afterReopen.form.universeSize, 87500);
});

test("district runtime bridge canonical lane is selector-driven and does not read legacy top-level race fields", () => {
  const source = fs.readFileSync(appRuntimePath, "utf8");
  const match = source.match(
    /function districtBridgeCanonicalView\(\)\{([\s\S]*?)\nfunction districtBridgeDerivedView\(\)\{/,
  );
  assert.ok(match, "districtBridgeCanonicalView segment missing");
  const segment = String(match[1] || "");

  assert.match(segment, /selectDistrictCanonicalView\(currentState\)/, "canonical lane must call selectDistrictCanonicalView");
  assert.doesNotMatch(segment, /currentState\?\.raceType/, "canonical lane must not read legacy currentState.raceType");
  assert.doesNotMatch(segment, /currentState\?\.electionDate/, "canonical lane must not read legacy currentState.electionDate");
  assert.doesNotMatch(segment, /currentState\?\.universeSize/, "canonical lane must not read legacy currentState.universeSize");
  assert.doesNotMatch(segment, /currentState\?\.templateMeta/, "canonical lane must not read legacy currentState.templateMeta");
  assert.doesNotMatch(segment, /currentState\?\.candidates/, "canonical lane must not read legacy currentState.candidates");
  assert.doesNotMatch(segment, /currentState\?\.userSplit/, "canonical lane must not read legacy currentState.userSplit");
});

