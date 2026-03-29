// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { loadState, persistStateSnapshot } from "./storage.js";

function makeMemoryStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key(index) {
      const keys = Array.from(map.keys());
      return keys[index] || null;
    },
    getItem(key) {
      return map.has(String(key)) ? String(map.get(String(key))) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
  };
}

test("storage context row: campaign/office scope persists and reloads with campaign name", () => {
  const storage = makeMemoryStorage();
  const state = {
    campaignId: "il-hd-21",
    campaignName: "Illinois House 21",
    officeId: "west-field",
    ui: { activeScenarioId: "" },
  };

  const persisted = persistStateSnapshot(state, storage, {
    campaignId: "il-hd-21",
    campaignName: "Illinois House 21",
    officeId: "west-field",
  });
  assert.equal(persisted.ok, true);

  const loadedSameScope = loadState({
    storageOverride: storage,
    campaignId: "il-hd-21",
    officeId: "west-field",
  });
  assert.equal(loadedSameScope?.campaignId, "il-hd-21");
  assert.equal(loadedSameScope?.officeId, "west-field");
  assert.equal(loadedSameScope?.campaignName, "Illinois House 21");

  const loadedDifferentOffice = loadState({
    storageOverride: storage,
    campaignId: "il-hd-21",
    officeId: "east-field",
  });
  assert.equal(loadedDifferentOffice, null);
});

test("storage context row: scenario-scoped snapshot round-trips without cross-scenario bleed", () => {
  const storage = makeMemoryStorage();
  const state = {
    campaignId: "il-hd-21",
    campaignName: "Illinois House 21",
    officeId: "west-field",
    scenarioId: "plan_a",
    ui: { activeScenarioId: "plan_a" },
  };

  const persisted = persistStateSnapshot(state, storage, {
    campaignId: "il-hd-21",
    campaignName: "Illinois House 21",
    officeId: "west-field",
    scenarioId: "plan_a",
  });
  assert.equal(persisted.ok, true);

  const loadedSameScenario = loadState({
    storageOverride: storage,
    campaignId: "il-hd-21",
    officeId: "west-field",
    scenarioId: "plan_a",
  });
  assert.equal(loadedSameScenario?.campaignId, "il-hd-21");
  assert.equal(loadedSameScenario?.officeId, "west-field");
  assert.equal(loadedSameScenario?.scenarioId, "plan_a");

  const loadedDifferentScenario = loadState({
    storageOverride: storage,
    campaignId: "il-hd-21",
    officeId: "west-field",
    scenarioId: "plan_b",
  });
  assert.equal(loadedDifferentScenario, null);
});
