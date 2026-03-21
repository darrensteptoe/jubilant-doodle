// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeCanonicalState } from "../state/schema.js";
import { updateOutcomeControlField } from "../actions/outcome.js";
import { selectOutcomeCanonicalView } from "./outcomeCanonical.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outcomeSurfaceSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/v3/surfaces/outcome/index.js"),
  "utf8",
);

test("outcome c4: editable binders are hold-free", () => {
  assert.doesNotMatch(outcomeSurfaceSource, /markDistrictPendingWrite\(/);
  assert.doesNotMatch(outcomeSurfaceSource, /shouldHoldDistrictControlSync\(/);
  assert.doesNotMatch(outcomeSurfaceSource, /districtPendingWrites/);
  assert.match(outcomeSurfaceSource, /input\.dataset\.v3OutcomeBound = "1";/);
  assert.match(outcomeSurfaceSource, /select\.dataset\.v3OutcomeBound = "1";/);
});

test("outcome c4: select and numeric control values persist after reopen", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T16:00:00.000Z") });
  state = updateOutcomeControlField(state, { field: "mcMode", value: "extended" }).state;
  state = updateOutcomeControlField(state, { field: "mcContactMode", value: 42.5 }).state;
  state = updateOutcomeControlField(state, { field: "mcSeed", value: "seed-c4" }).state;

  const reopenedCanonical = selectOutcomeCanonicalView(JSON.parse(JSON.stringify(state)));
  assert.equal(reopenedCanonical.controls.mcMode, "extended");
  assert.equal(reopenedCanonical.controls.mcContactMode, 42.5);
  assert.equal(reopenedCanonical.controls.mcSeed, "seed-c4");
});

test("outcome c4: values survive navigation/refresh snapshots", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T16:10:00.000Z") });
  state = updateOutcomeControlField(state, { field: "mcVolatility", value: "high" }).state;
  state = updateOutcomeControlField(state, { field: "mcReliMode", value: 67 }).state;

  const before = selectOutcomeCanonicalView(state);
  const after = selectOutcomeCanonicalView(JSON.parse(JSON.stringify(state)));

  assert.equal(after.controls.mcVolatility, before.controls.mcVolatility);
  assert.equal(after.controls.mcReliMode, before.controls.mcReliMode);
});
