// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { createDistrictV2TargetingModule } from "./targetingConfig.js";
import {
  applyTargetModelPreset,
  listTargetModelOptions,
  makeDefaultTargetingState,
  normalizeTargetingState,
} from "../../../targetingRuntime.js";

function installMinimalDom(t) {
  const previousDocument = globalThis.document;
  const previousHTMLElement = globalThis.HTMLElement;
  class HTMLElementMock {}
  globalThis.document = {
    getElementById: () => null,
  };
  globalThis.HTMLElement = HTMLElementMock;
  t.after(() => {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
    if (previousHTMLElement === undefined) {
      delete globalThis.HTMLElement;
    } else {
      globalThis.HTMLElement = previousHTMLElement;
    }
  });
}

function captureModelSelectSync(configSnapshot, t) {
  installMinimalDom(t);
  const selectCalls = [];
  const module = createDistrictV2TargetingModule({
    syncSelectOptions: (id, options, selected) => {
      selectCalls.push({ id, options, selected });
    },
    syncInputValueFromRaw: () => {},
    syncCheckboxCheckedFromRaw: () => {},
    setText: () => {},
    applyDisabled: () => {},
    setInnerHtmlWithTrace: () => {},
    escapeHtml: (value) => String(value == null ? "" : value),
    setDistrictTargetingField: () => ({ ok: true }),
    applyDistrictTargetingPreset: () => ({ ok: true }),
    resetDistrictTargetingWeights: () => ({ ok: true }),
    runDistrictTargeting: () => ({ ok: true }),
    exportDistrictTargetingCsv: () => ({ ok: true }),
    exportDistrictTargetingJson: () => ({ ok: true }),
  });
  module.sync(configSnapshot, { rows: [] }, {});
  const modelCall = selectCalls.find((call) => call.id === "v3DistrictV2TargetingModelId");
  assert.ok(modelCall, "targeting sync should populate target-model select");
  return modelCall;
}

test("targeting model select keeps core preset selection on rerender", (t) => {
  const modelCall = captureModelSelectSync(
    {
      presetId: "turnout_opportunity",
      modelId: "turnout_opportunity",
    },
    t,
  );
  assert.equal(modelCall.selected, "turnout_opportunity");
});

test("targeting model select keeps valid non-core preset selection on rerender", (t) => {
  const optionIds = new Set(listTargetModelOptions().map((row) => String(row?.id || "").trim()));
  assert.ok(optionIds.has("obama_persuasion"), "non-core preset must exist in model option list");

  const modelCall = captureModelSelectSync(
    {
      presetId: "obama_persuasion",
      modelId: "persuasion_first",
    },
    t,
  );
  assert.equal(modelCall.selected, "obama_persuasion");
});

test("targeting non-core preset survives normalize + reload snapshots", (t) => {
  const targeting = makeDefaultTargetingState();
  applyTargetModelPreset(targeting, "obama_persuasion");

  const reopened = normalizeTargetingState(JSON.parse(JSON.stringify(targeting)));
  assert.equal(reopened.presetId, "obama_persuasion");
  assert.equal(reopened.modelId, "persuasion_first");

  const modelCall = captureModelSelectSync(
    {
      presetId: reopened.presetId,
      modelId: reopened.modelId,
    },
    t,
  );
  assert.equal(modelCall.selected, "obama_persuasion");
});

test("targeting model normalization falls back safely for invalid ids", () => {
  const normalized = normalizeTargetingState({
    presetId: "not_a_valid_model",
    modelId: "also_not_valid",
  });
  assert.equal(normalized.presetId, "turnout_opportunity");
  assert.equal(normalized.modelId, "turnout_opportunity");
});

