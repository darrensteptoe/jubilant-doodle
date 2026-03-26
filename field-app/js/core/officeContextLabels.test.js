// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  OFFICE_CONTEXT_CANONICAL_VALUES,
  OFFICE_CONTEXT_UNMAPPED_LABEL,
  formatOfficeContextLabel,
  listCanonicalOfficeContextOptions,
  resolveOfficeContextDisplayLabel,
} from "./officeContextLabels.js";

test("office context labels: canonical ids map to required human labels", () => {
  assert.equal(formatOfficeContextLabel("municipal_executive"), "Municipal Executive");
  assert.equal(formatOfficeContextLabel("municipal_legislative"), "Municipal Legislative");
  assert.equal(formatOfficeContextLabel("countywide"), "Countywide");
  assert.equal(formatOfficeContextLabel("state_house"), "State House");
  assert.equal(formatOfficeContextLabel("state_senate"), "State Senate");
  assert.equal(formatOfficeContextLabel("congressional_district"), "Congressional District");
  assert.equal(formatOfficeContextLabel("statewide_executive"), "Statewide Executive");
  assert.equal(formatOfficeContextLabel("statewide_federal"), "Statewide Federal");
  assert.equal(formatOfficeContextLabel("judicial_other"), "Judicial / Other");
  assert.equal(formatOfficeContextLabel("custom_context"), "Custom Context");
});

test("office context labels: related dimension values map to state house and state senate labels", () => {
  assert.equal(formatOfficeContextLabel("state_legislative_lower"), "State House");
  assert.equal(formatOfficeContextLabel("state_legislative_upper"), "State Senate");
});

test("office context labels: legacy values use compatibility display aliases", () => {
  assert.equal(formatOfficeContextLabel("federal", { legacyIntent: "statewide_federal" }), "Statewide Federal");
  assert.equal(formatOfficeContextLabel("state_leg", { legacyIntent: "state_senate" }), "State Senate");
  assert.equal(formatOfficeContextLabel("state_leg"), "State Legislative");
  assert.equal(formatOfficeContextLabel("municipal"), "Municipal");
  assert.equal(formatOfficeContextLabel("county"), "County");
});

test("office context labels: unknown canonical-ish values title-case safely and unresolved values use fallback", () => {
  assert.equal(formatOfficeContextLabel("regional_special_context"), "Regional Special Context");
  assert.equal(formatOfficeContextLabel("!@#$"), OFFICE_CONTEXT_UNMAPPED_LABEL);
});

test("office context labels: resolve display label prefers template id then office level then race type", () => {
  assert.equal(
    resolveOfficeContextDisplayLabel({
      appliedTemplateId: "statewide_executive",
      officeLevel: "state_legislative_upper",
      raceType: "state_leg",
    }),
    "Statewide Executive",
  );
  assert.equal(
    resolveOfficeContextDisplayLabel({
      officeLevel: "state_legislative_upper",
      raceType: "state_leg",
    }),
    "State Senate",
  );
  assert.equal(
    resolveOfficeContextDisplayLabel({
      raceType: "state_leg",
    }),
    "State Legislative",
  );
});

test("office context labels: canonical selector options use canonical values only", () => {
  const options = listCanonicalOfficeContextOptions({ includeBlank: true, blankLabel: "All compatible offices" });
  assert.equal(options[0]?.value, "");
  assert.equal(options[0]?.label, "All compatible offices");
  assert.deepEqual(options.slice(1).map((row) => row.value), OFFICE_CONTEXT_CANONICAL_VALUES);
  assert.equal(options.find((row) => row.value === "statewide_executive")?.label, "Statewide Executive");
});
