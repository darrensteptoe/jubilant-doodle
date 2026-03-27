// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { validateCampaignContext } from "../core/campaignContextManager.js";
import { resolveActiveContext } from "./activeContext.js";
import { createShellBridgeRuntime } from "./shellBridgeRuntime.js";

function createHarness(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  let state = opts.initialState || {
    campaignId: "default",
    campaignName: "Default Campaign",
    officeId: "",
    ui: { activeScenarioId: "" },
  };
  const calls = {
    loadState: 0,
    normalizeLoadedScenarioRuntime: [],
  };

  const runtime = createShellBridgeRuntime({
    getState: () => state,
    replaceState: (nextState) => { state = nextState; },
    resolveActiveContext: typeof opts.resolveActiveContext === "function"
      ? opts.resolveActiveContext
      : (input) => resolveActiveContext(input),
    validateCampaignContext,
    loadState: (...args) => {
      calls.loadState += 1;
      if (typeof opts.loadState === "function") {
        return opts.loadState(...args);
      }
      return null;
    },
    normalizeLoadedScenarioRuntime: (loaded, normalizeOptions) => {
      calls.normalizeLoadedScenarioRuntime.push({
        loaded,
        normalizeOptions,
      });
      if (typeof opts.normalizeLoadedScenarioRuntime === "function") {
        return opts.normalizeLoadedScenarioRuntime(loaded, normalizeOptions);
      }
      return loaded;
    },
    makeDefaultStateModule: ({ activeContext } = {}) => ({
      campaignId: String(activeContext?.campaignId || "default"),
      campaignName: String(activeContext?.campaignName || ""),
      officeId: String(activeContext?.officeId || ""),
      ui: { activeScenarioId: String(activeContext?.scenarioId || "") },
    }),
    refreshModelAuditFromArchive: () => {},
    ensureScenarioRegistry: () => {},
    ensureDecisionScaffold: () => {},
    scenarioInputsFromState: () => ({}),
    scenarioOutputsFromState: () => ({}),
    applyStateToUI: () => {},
    rebuildCandidateTable: () => {},
    render: () => {},
    safeCall: (fn) => { if (typeof fn === "function") fn(); },
    renderScenarioManagerC1: () => {},
    renderDecisionSessionD1: () => {},
    persist: () => {},
    schedulePersist: () => {},
    notifyBridgeSync: () => {},
    observeContractEvent: () => {},
    getLastResultsSnapshot: () => ({ snapshotHash: "" }),
    setText: () => {},
    clearState: () => {},
    makeDefaultState: () => ({
      campaignId: "default",
      campaignName: "",
      officeId: "",
      ui: { activeScenarioId: "" },
    }),
    applyThemeFromState: () => {},
    openDiagnostics: () => {},
  });

  return {
    runtime,
    calls,
    getState: () => state,
  };
}

test("shell bridge context row: scope change preserves requested campaign/office during rehydrate", () => {
  const harness = createHarness({
    initialState: {
      campaignId: "default",
      campaignName: "Default Campaign",
      officeId: "",
      ui: { activeScenarioId: "" },
    },
    loadState: () => ({
      campaignId: "loaded-default",
      campaignName: "Loaded Default",
      officeId: "",
      ui: { activeScenarioId: "" },
    }),
    normalizeLoadedScenarioRuntime: (loaded, normalizeOptions) => {
      const out = { ...(loaded || {}), ui: { ...(loaded?.ui || {}) } };
      const context = normalizeOptions?.context && typeof normalizeOptions.context === "object"
        ? normalizeOptions.context
        : null;
      if (!context) {
        out.campaignId = "default";
        out.officeId = "";
        return out;
      }
      out.campaignId = String(context.campaignId || "default");
      out.campaignName = String(context.campaignName || "");
      out.officeId = String(context.officeId || "");
      return out;
    },
  });

  const result = harness.runtime.setContext({
    campaignId: "il-hd-21",
    campaignName: "IL HD 21",
    officeId: "west-field",
  });

  assert.equal(result?.ok, true);
  assert.equal(result?.changed, true);
  assert.equal(harness.calls.loadState, 1);
  assert.equal(
    harness.calls.normalizeLoadedScenarioRuntime[0]?.normalizeOptions?.context?.campaignId,
    "il-hd-21",
  );
  assert.equal(
    harness.calls.normalizeLoadedScenarioRuntime[0]?.normalizeOptions?.context?.officeId,
    "west-field",
  );
  assert.equal(harness.getState().campaignId, "il-hd-21");
  assert.equal(harness.getState().officeId, "west-field");
  assert.equal(harness.getState().campaignName, "IL HD 21");
});

test("shell bridge context row: campaign name update does not force scope rehydrate", () => {
  const harness = createHarness({
    initialState: {
      campaignId: "il-hd-21",
      campaignName: "Old Name",
      officeId: "west-field",
      ui: { activeScenarioId: "" },
    },
  });

  const result = harness.runtime.setContext({
    campaignId: "il-hd-21",
    campaignName: "New Label",
    officeId: "west-field",
  });

  assert.equal(result?.ok, true);
  assert.equal(result?.changed, false);
  assert.equal(harness.calls.loadState, 0);
  assert.equal(harness.getState().campaignId, "il-hd-21");
  assert.equal(harness.getState().officeId, "west-field");
  assert.equal(harness.getState().campaignName, "New Label");
});

test("shell bridge context row: url-locked campaign rejects attempted scope change", () => {
  const resolveWithCampaignLock = (input = {}) => resolveActiveContext({
    ...(input && typeof input === "object" ? input : {}),
    search: "?campaign=locked-campaign",
  });
  const harness = createHarness({
    initialState: {
      campaignId: "locked-campaign",
      campaignName: "Locked Campaign",
      officeId: "west-field",
      ui: { activeScenarioId: "" },
    },
    resolveActiveContext: resolveWithCampaignLock,
  });

  const result = harness.runtime.setContext({
    campaignId: "new-campaign",
    campaignName: "Attempted Change",
    officeId: "west-field",
  });

  assert.equal(result?.ok, false);
  assert.equal(result?.code, "campaign_locked");
  assert.equal(harness.getState().campaignId, "locked-campaign");
});

test("shell bridge context row: view mirrors canonical scoped state after import-shaped hydrate", () => {
  const harness = createHarness({
    initialState: {
      campaignId: "il-hd-21",
      campaignName: "IL HD 21",
      officeId: "west-field",
      scenarioId: "",
      ui: { activeScenarioId: "plan_general" },
    },
  });

  const view = harness.runtime.stateView();
  assert.equal(view?.campaignId, "il-hd-21");
  assert.equal(view?.campaignName, "IL HD 21");
  assert.equal(view?.officeId, "west-field");
  assert.equal(view?.scenarioId, "plan_general");
});
