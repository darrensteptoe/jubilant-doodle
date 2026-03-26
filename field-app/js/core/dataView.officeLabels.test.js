// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDataArchiveOfficeWinnerText,
  buildDataArchiveSelectedSnapshotView,
} from "./dataView.js";

test("data view: template summary preserves raw applied template id text", () => {
  const view = buildDataArchiveSelectedSnapshotView({
    templateMeta: {
      appliedTemplateId: "statewide_executive",
      appliedVersion: "2026.03.25",
    },
  });
  assert.equal(view.templateSummary, "statewide_executive (v2026.03.25)");
});

test("data view: template summary does not infer context when applied template id is missing", () => {
  const view = buildDataArchiveSelectedSnapshotView({
    raceType: "state_leg",
    templateMeta: {
      officeLevel: "state_legislative_lower",
    },
  });
  assert.equal(view.templateSummary, "—");
});

test("data view: office winner helper preserves office+channel text deterministically", () => {
  assert.equal(
    buildDataArchiveOfficeWinnerText("statewide_executive", "door"),
    "statewide_executive · top door",
  );
  assert.equal(buildDataArchiveOfficeWinnerText("", "door"), "—");
});

test("data view: selected snapshot office winner fields preserve raw office tokens", () => {
  const view = buildDataArchiveSelectedSnapshotView({
    execution: {
      officePaths: {
        bestByDollarOfficeId: "statewide_executive",
        bestByDollarTopChannel: "door",
      },
    },
  });
  assert.equal(view.officeBestByDollar, "statewide_executive · top door");
});
