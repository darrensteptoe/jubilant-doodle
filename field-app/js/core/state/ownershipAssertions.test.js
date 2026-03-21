// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { updateDistrictFormField } from "../actions/district.js";
import {
  CANONICAL_DOMAINS,
  FIELD_OWNERSHIP_REGISTRY,
  makeCanonicalState,
} from "./schema.js";
import {
  assertActionMutationOwnership,
  assertBridgeCanonicalLane,
  assertBridgeDerivedLane,
  assertDerivedViewDoesNotExposeEditableFields,
  assertUniqueFieldOwnership,
} from "./ownershipAssertions.js";

function seededState() {
  return makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
}

test("ownership assertions: canonical field ownership registry remains unique", () => {
  const summary = assertUniqueFieldOwnership({
    registry: FIELD_OWNERSHIP_REGISTRY,
    canonicalDomains: CANONICAL_DOMAINS,
  });
  assert.equal(Array.isArray(summary.duplicateFields), true);
  assert.equal(summary.duplicateFields.length, 0);
  assert.ok(summary.fieldOwners["district.form.mode"]);
});

test("ownership assertions: duplicate field ownership throws loudly", () => {
  const badRegistry = [
    { field: "district.form.mode", domain: "district" },
    { field: "district.form.mode", domain: "targeting" },
  ];
  assert.throws(
    () => assertUniqueFieldOwnership({ registry: badRegistry, canonicalDomains: CANONICAL_DOMAINS }),
    /duplicate canonical owners detected/,
  );
});

test("ownership assertions: action write-lane accepts intended domain mutations", () => {
  const before = seededState();
  const outcome = updateDistrictFormField(before, { field: "mode", value: "turnout" });
  assert.equal(outcome.changed, true);

  const ownership = assertActionMutationOwnership({
    beforeState: before,
    afterState: outcome.state,
    allowedDomains: ["district"],
    actionName: "updateDistrictFormField",
    canonicalDomains: CANONICAL_DOMAINS,
  });
  assert.deepEqual(ownership.changedDomains, ["district"]);
});

test("ownership assertions: action write-lane rejects cross-domain drift", () => {
  const before = seededState();
  const after = structuredClone(before);
  after.domains.district.form.mode = "turnout";
  after.domains.targeting.config.topN = 88;

  assert.throws(
    () => assertActionMutationOwnership({
      beforeState: before,
      afterState: after,
      allowedDomains: ["district"],
      actionName: "intentional_cross_domain_violation",
      canonicalDomains: CANONICAL_DOMAINS,
    }),
    /unauthorized domain writes -> targeting/,
  );
});

test("ownership assertions: canonical bridge lane rejects derived status keys", () => {
  assert.throws(
    () => assertBridgeCanonicalLane({
      bridgeName: "districtBridge",
      canonicalView: {
        form: { mode: "persuasion" },
        controls: { locked: false },
        statusText: "should-not-be-canonical",
      },
      derivedOnlyKeys: ["statusText", "summary.bannerText"],
    }),
    /canonical payload includes derived keys/,
  );
});

test("ownership assertions: derived bridge lane rejects canonical input keys", () => {
  assert.throws(
    () => assertBridgeDerivedLane({
      bridgeName: "outcomeBridge",
      derivedView: {
        forecast: { winProb: 0.58 },
        controls: { mcMode: "advanced" },
      },
      canonicalOnlyKeys: ["controls.mcMode", "form.mode"],
    }),
    /derived payload includes canonical keys/,
  );
});

test("ownership assertions: derived payload cannot expose editable controls", () => {
  assert.throws(
    () => assertDerivedViewDoesNotExposeEditableFields({
      moduleName: "districtDerived",
      derivedView: {
        summary: { turnoutExpectedText: "46.0%" },
        ballot: { candidates: [] },
        form: { mode: "turnout" },
      },
      editablePaths: ["form.mode", "template.raceType", "controls.locked"],
    }),
    /derived payload exposes editable control fields/,
  );
});

