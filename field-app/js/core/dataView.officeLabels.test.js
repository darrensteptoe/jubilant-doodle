// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { buildDataArchiveSelectedSnapshotView } from "./dataView.js";

test("data view: template summary uses canonical office label for applied template id", () => {
  const view = buildDataArchiveSelectedSnapshotView({
    templateMeta: {
      appliedTemplateId: "statewide_executive",
      appliedVersion: "2026.03.25",
    },
  });
  assert.equal(view.templateSummary, "Statewide Executive (v2026.03.25)");
});

test("data view: legacy race token does not leak into template summary when office level resolves modern context", () => {
  const view = buildDataArchiveSelectedSnapshotView({
    raceType: "state_leg",
    templateMeta: {
      officeLevel: "state_legislative_lower",
    },
  });
  assert.equal(view.templateSummary, "State House");
  assert.equal(view.templateSummary.includes("state_leg"), false);
});

test("data view: office winner text uses human office label", () => {
  const view = buildDataArchiveSelectedSnapshotView({
    execution: {
      officePaths: {
        bestByDollarOfficeId: "statewide_executive",
        bestByDollarTopChannel: "door",
      },
    },
  });
  assert.equal(view.officeBestByDollar, "Statewide Executive · top door");
});

test("data view: unresolved office tokens render a safe fallback label", () => {
  const view = buildDataArchiveSelectedSnapshotView({
    templateMeta: {
      appliedTemplateId: "###",
    },
  });
  assert.equal(view.templateSummary, "Unmapped Office Context");
});
