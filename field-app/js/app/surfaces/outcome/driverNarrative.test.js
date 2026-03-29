// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import { deriveOutcomeDriverNarrative } from "./surface.js";

test("outcome driver narrative stays gated until sufficient signals exist", () => {
  const view = deriveOutcomeDriverNarrative({});
  assert.equal(view.ready, false);
  assert.match(String(view.statusText || ""), /Run Monte Carlo/i);
  assert.deepEqual(view.lines, []);
});

test("outcome driver narrative emits deterministic binding/dominance/fragility/benchmark lines", () => {
  const view = deriveOutcomeDriverNarrative({
    bridgeMc: {
      winProb: 0.42,
      p10: -24,
      p50: 6,
      requiredShiftP50: 18,
      fragilityIndex: 0.66,
      cliffRisk: 0.23,
      shockLoss25: 0.17,
    },
    governanceView: {
      confidenceBand: "low",
    },
    bridgedSensitivityRows: [
      { label: "Turnout reliability", impact: 1.24 },
      { label: "Contact rate", impact: 0.75 },
    ],
    outcomeGapNote: "Contact shortfall remains at current pace.",
    benchmarkAdvisory: {
      confidenceFloor: 0.58,
      confidenceBand: "low",
    },
  });

  assert.equal(view.ready, true);
  assert.ok(Array.isArray(view.lines));
  assert.ok(view.lines.some((line) => line.startsWith("Binding factor: Capacity is binding")));
  assert.ok(view.lines.some((line) => line.startsWith("Dominant factor: Turnout reliability")));
  assert.ok(view.lines.some((line) => line.startsWith("Why fragile:")));
  assert.ok(view.lines.some((line) => line.startsWith("Benchmark realism tension:")));
});

test("outcome driver narrative emits stable rationale when downside and fragility are contained", () => {
  const view = deriveOutcomeDriverNarrative({
    bridgeMc: {
      winProb: 0.78,
      p10: 5,
      p50: 18,
      requiredShiftP50: 0,
      fragilityIndex: 0.2,
      cliffRisk: 0.04,
    },
    bridgedSensitivityRows: [
      { label: "Support retention", impact: 0.48 },
    ],
    outcomeGapNote: "On track at current pace.",
  });

  assert.equal(view.ready, true);
  assert.ok(view.lines.some((line) => line.startsWith("Why stable:")));
  assert.ok(!view.lines.some((line) => line.startsWith("Benchmark realism tension:")));
});

