// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import { assumptionsProfileLabelModule } from "./assumptionsProfile.js";
import { listTemplateDimensionOptions } from "./templateRegistry.js";
import {
  applyTemplateDefaultsToState,
  getTemplateRecord,
  listOverriddenTemplateFields,
  normalizeTemplateMeta,
  resolveTemplateId,
} from "./templateResolver.js";

function makeState(overrides = {}) {
  return {
    raceType: "state_leg",
    templateMeta: null,
    bandWidth: 5,
    persuasionPct: 11,
    earlyVoteExp: 35,
    supportRatePct: 55,
    contactRatePct: 22,
    turnoutReliabilityPct: 80,
    gotvMaxLiftPP: 10,
    channelDoorPct: 70,
    doorsPerHour3: 30,
    callsPerHour3: 20,
    timelineGotvWeeks: 2,
    timelineRampMode: "linear",
    ui: {
      assumptionsProfile: "template",
    },
    ...overrides,
  };
}

test("template resolver: registry entries map templates to office levels", () => {
  assert.equal(getTemplateRecord("statewide_executive").dimensions.officeLevel, "statewide_executive");
  assert.equal(getTemplateRecord("statewide_federal").dimensions.officeLevel, "statewide_federal");
  assert.equal(getTemplateRecord("congressional_district").dimensions.officeLevel, "congressional_district");
  assert.equal(getTemplateRecord("state_house").dimensions.officeLevel, "state_legislative_lower");
  assert.equal(getTemplateRecord("countywide").dimensions.officeLevel, "countywide");
});

test("template registry: election type options include canonical general/primary/special", () => {
  assert.deepEqual(listTemplateDimensionOptions("electionType"), [
    { value: "general", label: "General" },
    { value: "primary", label: "Primary" },
    { value: "special", label: "Special" },
  ]);
});

test("template resolver: statewide executive selection applies office-specific default banding", () => {
  const state = makeState({ raceType: "federal" });
  const result = applyTemplateDefaultsToState(state, { templateId: "statewide_executive", mode: "all" });

  assert.equal(result.ok, true);
  assert.equal(result.templateId, "statewide_executive");
  assert.equal(state.raceType, "federal", "legacy raceType should remain federal-compatible");
  assert.equal(state.templateMeta?.officeLevel, "statewide_executive");
  assert.equal(state.bandWidth, 8);
  assert.equal(state.persuasionPct, 15);
  assert.equal(state.earlyVoteExp, 45);
});

test("template resolver: statewide federal selection applies statewide-federal defaults", () => {
  const state = makeState({ raceType: "federal" });
  const result = applyTemplateDefaultsToState(state, { templateId: "statewide_federal", mode: "all" });

  assert.equal(result.ok, true);
  assert.equal(result.templateId, "statewide_federal");
  assert.equal(state.templateMeta?.officeLevel, "statewide_federal");
  assert.equal(state.bandWidth, 8);
  assert.equal(state.persuasionPct, 15);
  assert.equal(state.earlyVoteExp, 50);
});

test("template resolver: legacy raceType migration chooses office-aware templates", () => {
  assert.equal(resolveTemplateId({ raceType: "federal" }), "congressional_district");
  assert.equal(resolveTemplateId({ raceType: "federal", officeLevel: "statewide_federal" }), "statewide_federal");
  assert.equal(resolveTemplateId({ raceType: "state_leg", officeLevel: "state_legislative_upper" }), "state_senate");
  assert.equal(resolveTemplateId({ raceType: "municipal", seatContext: "executive" }), "municipal_executive");
  assert.equal(resolveTemplateId({ raceType: "unknown_race_type" }), "custom_context");
});

test("template resolver: untouched apply mode preserves existing overrides", () => {
  const state = makeState({ bandWidth: 9 });
  const result = applyTemplateDefaultsToState(state, {
    templateId: "state_senate",
    mode: "untouched",
  });

  assert.equal(result.ok, true);
  assert.equal(state.bandWidth, 9, "manual band override should be preserved");
  assert.equal(state.persuasionPct, 12, "non-overridden fields should follow selected template defaults");
  assert.ok(result.skippedFields.includes("bandWidth"));
  assert.ok(result.updatedFields.includes("persuasionPct"));
  assert.ok(listOverriddenTemplateFields(state, "state_senate").includes("bandWidth"));
});

test("assumptions profile label: template vs custom override labeling is explicit", () => {
  const templateState = makeState();
  applyTemplateDefaultsToState(templateState, { templateId: "state_house", mode: "all" });
  assert.match(assumptionsProfileLabelModule(templateState, () => "fallback"), /^Template \(/);

  const customState = makeState();
  applyTemplateDefaultsToState(customState, { templateId: "state_house", mode: "all" });
  customState.bandWidth = 9;
  assert.equal(assumptionsProfileLabelModule(customState, () => "fallback"), "Custom overrides active");
});

test("template resolver: metadata-only template changes do not drift deterministic numeric fields", () => {
  const state = makeState();
  applyTemplateDefaultsToState(state, { templateId: "state_house", mode: "all" });
  const before = {
    bandWidth: state.bandWidth,
    persuasionPct: state.persuasionPct,
    earlyVoteExp: state.earlyVoteExp,
    supportRatePct: state.supportRatePct,
    contactRatePct: state.contactRatePct,
    turnoutReliabilityPct: state.turnoutReliabilityPct,
  };

  const result = applyTemplateDefaultsToState(state, { templateId: "custom_context", mode: "all" });
  const after = {
    bandWidth: state.bandWidth,
    persuasionPct: state.persuasionPct,
    earlyVoteExp: state.earlyVoteExp,
    supportRatePct: state.supportRatePct,
    contactRatePct: state.contactRatePct,
    turnoutReliabilityPct: state.turnoutReliabilityPct,
  };

  assert.equal(result.ok, true);
  assert.deepEqual(after, before);
});

test("template resolver: normalized template meta preserves canonical schema keys", () => {
  const meta = normalizeTemplateMeta({}, { raceType: "state_leg" });
  assert.deepEqual(Object.keys(meta).sort(), [
    "appliedTemplateId",
    "appliedVersion",
    "benchmarkKey",
    "electionType",
    "officeLevel",
    "overriddenFields",
    "partisanshipMode",
    "salienceLevel",
    "seatContext",
  ].sort());
});
