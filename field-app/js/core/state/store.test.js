// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { updateDistrictFormField } from "../actions/district.js";
import { CANONICAL_SCHEMA_VERSION } from "./schema.js";
import { createCanonicalStateStore } from "./store.js";

test("state store: bootstraps legacy input into canonical state", () => {
  const store = createCanonicalStateStore({
    initialState: {
      campaignId: "cmp_legacy",
      officeId: "west",
      raceType: "municipal",
      weeksRemaining: "18",
    },
    nowDate: new Date("2026-03-21T12:00:00.000Z"),
  });

  const state = store.getState();
  assert.equal(state.schemaVersion, CANONICAL_SCHEMA_VERSION);
  assert.equal(state.domains.campaign.campaignId, "cmp_legacy");
  assert.equal(state.domains.district.form.weeksRemaining, "18");
});

test("state store: subscribe receives metadata on setState commit", () => {
  const store = createCanonicalStateStore({
    nowDate: new Date("2026-03-21T12:00:00.000Z"),
  });
  /** @type {Array<Record<string, any>>} */
  const events = [];
  const unsubscribe = store.subscribe((state, meta) => {
    events.push({
      revision: Number(state?.revision || 0),
      source: String(meta?.source || ""),
      reason: String(meta?.reason || ""),
      changed: !!meta?.changed,
    });
  });

  const result = store.setState((current) => ({
    ...current,
    domains: {
      ...current.domains,
      campaign: {
        ...current.domains.campaign,
        campaignId: "cmp_42",
      },
    },
    revision: Number(current.revision || 0) + 1,
  }));
  unsubscribe();

  assert.equal(result.changed, true);
  assert.equal(store.getState().domains.campaign.campaignId, "cmp_42");
  assert.equal(events.length, 1);
  assert.equal(events[0].source, "store.setState");
  assert.equal(events[0].reason, "state_set");
  assert.equal(events[0].changed, true);
});

test("state store: dispatchAction applies canonical action result", () => {
  const store = createCanonicalStateStore({
    nowDate: new Date("2026-03-21T12:00:00.000Z"),
  });

  const result = store.dispatchAction(
    updateDistrictFormField,
    { field: "weeksRemaining", value: "26" },
    { actionName: "updateDistrictFormField" },
  );

  assert.equal(result.changed, true);
  assert.equal(result.blocked, false);
  assert.equal(store.getState().domains.district.form.weeksRemaining, "26");
});

