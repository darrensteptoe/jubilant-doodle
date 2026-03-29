// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  formatArchiveOfficeWinnerDisplayText,
  formatArchiveTemplateSummaryDisplayText,
} from "./forecastArchive.js";

test("forecast archive: office winner display text uses shared office labels", () => {
  assert.equal(
    formatArchiveOfficeWinnerDisplayText("statewide_executive · top door"),
    "Statewide Executive · top door",
  );
  assert.equal(
    formatArchiveOfficeWinnerDisplayText("state_legislative_lower · top phones"),
    "State House · top phones",
  );
  assert.equal(formatArchiveOfficeWinnerDisplayText("—"), "—");
});

test("forecast archive: template summary display text uses shared office labels", () => {
  assert.equal(
    formatArchiveTemplateSummaryDisplayText("state_house_general_open (v2.1.0)"),
    "State House General Open (v2.1.0)",
  );
  assert.equal(
    formatArchiveTemplateSummaryDisplayText("statewide_federal"),
    "Statewide Federal",
  );
  assert.equal(
    formatArchiveTemplateSummaryDisplayText("###"),
    "Unmapped Office Context",
  );
});
