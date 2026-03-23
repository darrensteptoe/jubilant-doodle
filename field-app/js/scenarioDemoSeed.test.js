// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPastElectionDemoScenarios,
  buildFakeTeamOperationsData,
  buildScenarioDemoPackage,
} from "./scenarioDemoSeed.js";

test("scenarioDemoSeed: builds deterministic past-election scenarios with patched inputs", () => {
  const baselineInputs = {
    scenarioName: "Baseline",
    supportRatePct: 51,
    turnoutA: 43,
    turnoutB: 49,
    contactRatePct: 25,
    templateMeta: { electionType: "general" },
  };
  const baselineOutputs = {
    summary: { projectedVotes: 12345 },
  };

  const scenarios = buildPastElectionDemoScenarios({
    baselineInputs,
    baselineOutputs,
    nowIso: "2026-03-23T00:00:00.000Z",
  });

  assert.equal(scenarios.length, 3);
  assert.deepEqual(
    scenarios.map((row) => row.id),
    ["demo_past_2020_presidential", "demo_past_2022_midterm", "demo_past_2024_presidential"],
  );
  assert.equal(scenarios[0].inputs.electionDate, "2020-11-03");
  assert.equal(scenarios[1].inputs.mode, "turnout");
  assert.equal(scenarios[2].inputs.supportRatePct, 51.8);
  assert.equal(baselineInputs.scenarioName, "Baseline", "baseline inputs must remain unchanged");
  assert.equal(scenarios[0].outputs.summary.projectedVotes, 12345);
});

test("scenarioDemoSeed: builds fake team operations data scoped to context", () => {
  const data = buildFakeTeamOperationsData({
    campaignId: "demo_campaign",
    officeId: "il_hd_07",
    nowIso: "2026-03-23T00:00:00.000Z",
  });

  assert.equal(data.persons.length, 6);
  assert.equal(data.pipelineRecords.length, 4);
  assert.equal(data.shiftRecords.length, 4);
  assert.equal(data.turfEvents.length, 4);
  assert.ok(data.persons.every((row) => row.campaignId === "demo_campaign"));
  assert.ok(data.persons.every((row) => row.officeId === "il_hd_07"));
});

test("scenarioDemoSeed: package summary matches seeded content", () => {
  const pkg = buildScenarioDemoPackage({
    baselineInputs: { supportRatePct: 50 },
    baselineOutputs: {},
    campaignId: "default",
    officeId: "",
    nowIso: "2026-03-23T00:00:00.000Z",
  });

  assert.equal(pkg.summary.scenarioCount, 3);
  assert.equal(pkg.summary.teamHeadcount, 6);
  assert.equal(pkg.summary.shiftCount, 4);
  assert.equal(pkg.summary.turfEventCount, 4);
});
