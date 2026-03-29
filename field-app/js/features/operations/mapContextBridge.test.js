// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import {
  clearOperationsMapContext,
  normalizeOperationsMapContext,
  operationsMapContextAppliesToScope,
  readOperationsMapContext,
  writeOperationsMapContext,
  WORKED_ACTIVITY_MODE_ID,
} from "./mapContextBridge.js";

function withLocalStorageHarness(run){
  const store = new Map();
  const original = globalThis.localStorage;
  const mock = {
    getItem: (key) => (store.has(String(key)) ? String(store.get(String(key))) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: mock,
  });
  try{
    run();
  } finally {
    if (original === undefined){
      delete globalThis.localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: original,
      });
    }
  }
}

test("operations map context bridge: organizer focus writes/reads stable worked-mode context", () => {
  withLocalStorageHarness(() => {
    const written = writeOperationsMapContext({
      focusType: "organizer",
      organizerId: "org_1",
      organizerName: "Organizer One",
      officeId: "west-office",
      campaignId: "il-hd-21",
      source: "operations_hub",
    });
    assert.equal(written.focusType, "organizer");
    assert.equal(written.organizerId, "org_1");
    assert.equal(written.requestedMode, WORKED_ACTIVITY_MODE_ID);
    assert.ok(written.requestId);
    assert.ok(written.updatedAt);

    const loaded = readOperationsMapContext();
    assert.equal(loaded.focusType, "organizer");
    assert.equal(loaded.organizerId, "org_1");
    assert.equal(loaded.organizerName, "Organizer One");
    assert.equal(loaded.officeId, "west-office");
    assert.equal(loaded.campaignId, "il-hd-21");
    assert.equal(loaded.requestedMode, WORKED_ACTIVITY_MODE_ID);
  });
});

test("operations map context bridge: invalid focus payload normalizes to empty context", () => {
  const normalized = normalizeOperationsMapContext({
    focusType: "organizer",
    organizerId: "",
    officeId: "west-office",
    requestedMode: "campaign_footprint",
  });
  assert.equal(normalized.focusType, "");
  assert.equal(normalized.organizerId, "");
  assert.equal(normalized.requestedMode, "");
});

test("operations map context bridge: scope applicability is bounded by campaign and office", () => {
  const context = normalizeOperationsMapContext({
    focusType: "office",
    officeId: "west-office",
    campaignId: "il-hd-21",
  });
  assert.equal(
    operationsMapContextAppliesToScope(context, { campaignId: "il-hd-21", officeId: "west-office" }),
    true,
  );
  assert.equal(
    operationsMapContextAppliesToScope(context, { campaignId: "il-hd-99", officeId: "west-office" }),
    false,
  );
  assert.equal(
    operationsMapContextAppliesToScope(context, { campaignId: "il-hd-21", officeId: "south-office" }),
    false,
  );
});

test("operations map context bridge: clear removes active focus context", () => {
  withLocalStorageHarness(() => {
    writeOperationsMapContext({
      focusType: "office",
      officeId: "west-office",
      campaignId: "il-hd-21",
      source: "operations_hub",
    });
    const cleared = clearOperationsMapContext();
    assert.equal(cleared.focusType, "");
    const loaded = readOperationsMapContext();
    assert.equal(loaded.focusType, "");
    assert.equal(loaded.officeId, "");
  });
});
