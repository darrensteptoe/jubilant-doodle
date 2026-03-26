// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { buildModelInputFromSnapshot } from "./modelInput.js";

test("model input office context prefers canonical template id over legacy race bucket", () => {
  const out = buildModelInputFromSnapshot({
    officeId: "",
    raceType: "federal",
    templateMeta: {
      appliedTemplateId: "statewide_executive",
      officeLevel: "statewide_executive",
      electionType: "general",
    },
    candidates: [],
    candidateHistory: [],
  });

  assert.equal(out.office, "statewide_executive");
});

test("model input office context maps legacy federal race bucket to modern canonical office context", () => {
  const out = buildModelInputFromSnapshot({
    raceType: "federal",
    templateMeta: {},
    candidates: [],
    candidateHistory: [],
  });

  assert.equal(out.office, "congressional_district");
});

test("model input office context maps legacy state_leg race bucket to modern canonical office context", () => {
  const out = buildModelInputFromSnapshot({
    raceType: "state_leg",
    templateMeta: {},
    candidates: [],
    candidateHistory: [],
  });

  assert.equal(out.office, "state_house");
});
