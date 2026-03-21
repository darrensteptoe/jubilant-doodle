// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { applyElectionBenchmarks, importElectionDataFile } from "../actions/electionData.js";
import { updateCensusConfig, updateCensusSelection } from "../actions/census.js";
import { updateDistrictFormField } from "../actions/district.js";
import { applyTargetingRunResult, updateTargetingConfig } from "../actions/targeting.js";
import { makeCanonicalState } from "../state/schema.js";
import { selectTargetingCanonicalView } from "./targetingCanonical.js";
import { selectTargetingDerivedView } from "./targetingDerived.js";
import { selectCensusCanonicalView } from "./censusCanonical.js";

function seededState() {
  return makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
}

function withElectionData(state) {
  const csvText = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes,total_votes_precinct,registered_voters,party",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245,2100,3000,DEM",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Blair Beta,855,2100,3000,REP",
  ].join("\n");

  const imported = importElectionDataFile(state, {
    fileName: "phase7-election.csv",
    fileSize: csvText.length,
    fileHash: "phase7_hash_001",
    csvText,
  });
  assert.equal(imported.changed, true);
  assert.equal(imported.importOk, true);

  const withBenchmarks = applyElectionBenchmarks(imported.state, {
    benchmarks: {
      benchmarkSuggestions: [{ type: "turnout_calibration", value: 0.68 }],
      turnoutBaselines: [{ cycleYear: 2024, turnoutRate: 0.7 }],
    },
    downstreamRecommendations: {
      targeting: {
        turnoutBoostGeoids: ["17-031-001A"],
      },
      district: {
        baselineSupportHint: 0.51,
      },
      outcome: {
        confidenceFloor: 0.62,
      },
    },
  });
  assert.equal(withBenchmarks.changed, true);
  return withBenchmarks.state;
}

test("phase7: targeting config persistence remains canonical", () => {
  const base = seededState();
  const updated = updateTargetingConfig(base, { field: "topN", value: "75" });
  assert.equal(updated.changed, true);

  const canonical = selectTargetingCanonicalView(updated.state);
  assert.equal(canonical.config.topN, 75);
  assert.equal(canonical.config.modelId, updated.state.domains.targeting.config.modelId);
});

test("phase7: census config persistence remains canonical", () => {
  const base = seededState();
  const updated = updateCensusConfig(base, { field: "stateFips", value: "17" });
  assert.equal(updated.changed, true);

  const canonical = selectCensusCanonicalView(updated.state);
  assert.equal(canonical.config.stateFips, "17");
  assert.equal(canonical.selection.loadedRowCount, 0);
});

test("phase7: district + census + election canonical inputs propagate into targeting canonical view", () => {
  let state = seededState();
  state = updateDistrictFormField(state, { field: "weeksRemaining", value: "24" }).state;
  state = updateDistrictFormField(state, { field: "turnoutA", value: 44 }).state;
  state = updateDistrictFormField(state, { field: "turnoutB", value: 49 }).state;
  state = updateCensusConfig(state, { field: "stateFips", value: "17" }).state;
  state = updateCensusConfig(state, { field: "resolution", value: "tract" }).state;
  state = updateCensusSelection(state, {
    selectedGeoids: ["17-031-001A", "17-031-001B"],
    loadedRowCount: 2,
  }).state;
  state = withElectionData(state);

  const canonical = selectTargetingCanonicalView(state);
  assert.equal(canonical.upstreamInputs.district.weeksRemaining, "24");
  assert.equal(canonical.upstreamInputs.district.turnoutA, 44);
  assert.equal(canonical.upstreamInputs.census.stateFips, "17");
  assert.equal(canonical.upstreamInputs.census.selectedGeoidCount, 2);
  assert.equal(canonical.upstreamInputs.electionData.normalizedRowCount, 2);
  assert.equal(canonical.upstreamInputs.electionData.turnoutBoostGeoidCount, 1);
  assert.equal(canonical.upstreamInputs.electionData.hasDownstreamRecommendations, true);
});

test("phase7: targeting derived recomputes when upstream census/election inputs change", () => {
  let state = seededState();
  state = applyTargetingRunResult(state, {
    rows: [
      { geoid: "17-031-001A", score: 0.81, isTopTarget: true, reachableVoters: 320, fieldEfficiency: 0.73 },
      { geoid: "17-031-001B", score: 0.64, isTopTarget: true, reachableVoters: 210, fieldEfficiency: 0.67 },
    ],
    statusText: "Targeting run complete.",
    lastRunAt: "2026-03-20T12:05:00.000Z",
  }).state;

  const before = selectTargetingDerivedView(state);
  assert.equal(before.status.staleSinceUpstreamChange, false);
  assert.equal(before.upstream.electionInputReady, false);

  state = updateCensusSelection(state, {
    selectedGeoids: ["17-031-001A", "17-031-001B"],
    loadedRowCount: 2,
  }).state;
  state = withElectionData(state);

  const after = selectTargetingDerivedView(state);
  assert.equal(after.status.staleSinceUpstreamChange, true);
  assert.equal(after.upstream.censusInputReady, true);
  assert.equal(after.upstream.electionInputReady, true);
  assert.equal(after.electionInfluence.turnoutBoostCoverageCount, 1);
  assert.match(after.electionInfluence.explanationText, /Election priors:/);
  assert.match(after.electionInfluence.explanationText, /Census scope:/);
});

