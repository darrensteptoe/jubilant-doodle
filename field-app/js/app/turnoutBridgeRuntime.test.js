// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import { createTurnoutBridgeRuntime } from "./turnoutBridgeRuntime.js";

function createHarness(initialState = {}){
  const state = structuredClone(initialState);
  const runtime = createTurnoutBridgeRuntime({
    turnoutBridgeKey: "__TEST_TURNOUT__",
    getState: () => state,
    mutateState: (patchFn) => patchFn(state),
    render: () => {},
    isScenarioLockedForEdits: () => false,
    normalizeBridgeSelectValue: (value, options, fallback) => {
      const text = String(value ?? "").trim();
      if (Array.isArray(options) && options.some((row) => String(row?.value ?? "") === text)) return text;
      return String(fallback ?? "");
    },
    normalizeBridgeSelectOptions: (options) => Array.isArray(options) ? options : [],
    bridgeSelectOptionsWithSelected: (options) => Array.isArray(options) ? options : [],
    reachBridgeClampNumber: (rawValue, rules = {}) => {
      const text = String(rawValue ?? "").trim();
      if (text === "") return rules.allowBlank ? "" : 0;
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) return null;
      const min = Number.isFinite(Number(rules.min)) ? Number(rules.min) : null;
      const max = Number.isFinite(Number(rules.max)) ? Number(rules.max) : null;
      let next = parsed;
      if (min != null && next < min) next = min;
      if (max != null && next > max) next = max;
      return next;
    },
    safeNum: (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    },
    syncGotvModeUI: () => {},
    markMcStale: () => {},
  });
  return { state, runtime };
}

test("turnoutBridgeRuntime: state view exposes litDrop/mail fields", () => {
  const { runtime } = createHarness({
    budget: { tactics: {} },
  });
  const view = runtime.turnoutBridgeStateView();
  assert.equal(typeof view?.inputs?.roiLitDropEnabled, "boolean");
  assert.equal(typeof view?.inputs?.roiMailEnabled, "boolean");
  assert.ok(Object.prototype.hasOwnProperty.call(view?.inputs || {}, "roiLitDropCpa"));
  assert.ok(Object.prototype.hasOwnProperty.call(view?.inputs || {}, "roiMailCpa"));
});

test("turnoutBridgeRuntime: setField updates canonical litDrop/mail tactic state", () => {
  const { state, runtime } = createHarness({
    budget: {
      tactics: {
        litDrop: { enabled: false, cpa: 0.11, kind: "persuasion" },
        mail: { enabled: false, cpa: 0.65, kind: "persuasion" },
      },
    },
  });

  const enableLitDrop = runtime.turnoutBridgeSetField("roiLitDropEnabled", true);
  assert.equal(enableLitDrop.ok, true);
  assert.equal(state.budget.tactics.litDrop.enabled, true);

  const litDropCpa = runtime.turnoutBridgeSetField("roiLitDropCpa", "0.42");
  assert.equal(litDropCpa.ok, true);
  assert.equal(state.budget.tactics.litDrop.cpa, 0.42);

  const mailKind = runtime.turnoutBridgeSetField("roiMailKind", "gotv");
  assert.equal(mailKind.ok, true);
  assert.equal(state.budget.tactics.mail.kind, "gotv");

  const mailSr = runtime.turnoutBridgeSetField("roiMailSr", "31");
  assert.equal(mailSr.ok, true);
  assert.equal(state.budget.tactics.mail.srPct, 31);
});

