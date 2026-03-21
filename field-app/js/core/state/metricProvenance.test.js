// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { makeCanonicalState, normalizeElectionDataSlice } from "./schema.js";
import { buildMetricProvenanceDiagnostics, createMetricProvenanceTracker } from "./metricProvenance.js";

function buildFixtureState() {
  const state = makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
  state.revision = 22;

  state.domains.district.revision = 4;
  state.domains.ballot.revision = 6;
  state.domains.candidateHistory.revision = 3;
  state.domains.targeting.revision = 7;
  state.domains.census.revision = 5;
  state.domains.outcome.revision = 2;
  state.domains.electionData.revision = 9;

  state.domains.district.form.turnoutA = 44;
  state.domains.district.form.turnoutB = 48;
  state.domains.district.form.weeksRemaining = "28";

  state.domains.ballot.candidateRefs = {
    byId: {
      cand_a: { id: "cand_a", name: "Alex Alpha", supportPct: 46 },
      cand_b: { id: "cand_b", name: "Blair Beta", supportPct: 42 },
    },
    order: ["cand_a", "cand_b"],
  };
  state.domains.ballot.undecidedPct = 12;

  state.domains.candidateHistory.records = [
    {
      recordId: "history_1",
      office: "US House",
      cycleYear: 2024,
      electionType: "general",
      candidateName: "Alex Alpha",
      party: "DEM",
      voteShare: 51.2,
      margin: 2.3,
      turnoutContext: 67.5,
      repeatCandidate: true,
      overUnderPerformancePct: 1.1,
    },
  ];

  state.domains.targeting.config.modelId = "house_v1";
  state.domains.targeting.config.geoLevel = "block_group";
  state.domains.targeting.config.minScore = 0.45;
  state.domains.targeting.runtime.rows = [
    { geoid: "170310101001", score: 0.81, isTopTarget: true, reachableVoters: 320, fieldEfficiency: 0.73 },
    { geoid: "170310101002", score: 0.64, isTopTarget: true, reachableVoters: 210, fieldEfficiency: 0.67 },
    { geoid: "170310101003", score: 0.31, isTopTarget: false, reachableVoters: 80, fieldEfficiency: 0.41 },
  ];

  state.domains.census.config.year = "2024";
  state.domains.census.config.resolution = "tract";
  state.domains.census.selection.selectedGeoids = ["17031010100", "17031010200"];
  state.domains.census.selection.loadedRowCount = 2;

  state.domains.electionData = normalizeElectionDataSlice(
    {
      revision: 9,
      import: {
        fileName: "election.csv",
        importedAt: "2026-03-20T10:00:00.000Z",
        status: "imported",
        statusText: "Imported rows.",
      },
      normalizedRows: [
        {
          state_fips: "17",
          county_fips: "031",
          election_date: "2024-11-05",
          office: "US House",
          district_id: "IL-07",
          precinct_id: "17-031-001A",
          candidate: "Alex Alpha",
          candidate_id: "cand_a",
          party: "DEM",
          party_id: "party_dem",
          votes: 1245,
          total_votes_precinct: 2100,
          registered_voters: 3000,
        },
      ],
      quality: {
        score: 0.78,
        confidenceBand: "high",
        completenessRatio: 0.95,
      },
      benchmarks: {
        turnoutBaselines: [{ cycleYear: 2024, turnoutRate: 0.7 }],
        historicalRaceBenchmarks: [{ cycleYear: 2022, margin: 1.8 }],
        comparableRacePools: [{ office: "US House", cycleYear: 2022, count: 14 }],
        downstreamRecommendations: {
          targeting: { turnoutBoostGeoids: ["17-031-001A"] },
          outcome: { confidenceFloor: 0.62 },
        },
      },
    },
    { nowDate: new Date("2026-03-20T12:00:00.000Z") },
  );

  state.domains.outcome.cache.mcLastHash = "mc_hash_1";
  state.domains.outcome.cache.mcLast = {
    winProb: 0.59,
    expectedMargin: 1.6,
    p05Margin: -1.8,
    p95Margin: 4.7,
  };

  return state;
}

test("metric provenance: payload structure contains required metrics and metadata", () => {
  const state = buildFixtureState();
  const view = buildMetricProvenanceDiagnostics(state, {
    nowDate: new Date("2026-03-20T13:00:00.000Z"),
  });

  assert.equal(view.version, "metric-provenance-v1");
  assert.equal(view.generatedAt, "2026-03-20T13:00:00.000Z");
  assert.deepEqual(view.metricOrder, [
    "baselineSupport",
    "turnoutExpected",
    "persuasionNeed",
    "targetingScore",
    "outcomeConfidence",
    "electionBenchmarkQuality",
  ]);

  const keys = Object.keys(view.metrics || {});
  assert.deepEqual(keys, view.metricOrder);

  for (const key of keys) {
    const row = view.metrics[key];
    assert.ok(row.metricId, `${key} missing metricId`);
    assert.ok(Array.isArray(row.canonicalSlices), `${key} missing canonicalSlices`);
    assert.ok(row.selector, `${key} missing selector`);
    assert.ok(row.revisionToken, `${key} missing revisionToken`);
    assert.ok(row.lastRecomputedAt, `${key} missing lastRecomputedAt`);
    assert.equal(typeof row.influences?.electionData, "boolean", `${key} electionData influence must be boolean`);
    assert.equal(typeof row.influences?.census, "boolean", `${key} census influence must be boolean`);
    assert.equal(typeof row.influences?.candidateHistory, "boolean", `${key} candidateHistory influence must be boolean`);
  }
});

test("metric provenance: influence flags and key values reflect canonical upstream inputs", () => {
  const state = buildFixtureState();
  const view = buildMetricProvenanceDiagnostics(state, {
    nowDate: new Date("2026-03-20T13:00:00.000Z"),
  });
  const canonicalQualityScore = Number(state.domains.electionData.quality.score);

  assert.equal(view.metrics.baselineSupport.value, 88);
  assert.equal(view.metrics.turnoutExpected.value, 46);
  assert.equal(view.metrics.persuasionNeed.value, 0);

  assert.equal(view.metrics.baselineSupport.influences.electionData, true);
  assert.equal(view.metrics.baselineSupport.influences.candidateHistory, true);
  assert.equal(view.metrics.targetingScore.influences.electionData, true);
  assert.equal(view.metrics.targetingScore.influences.census, true);
  assert.equal(view.metrics.outcomeConfidence.influences.electionData, true);
  assert.equal(view.metrics.outcomeConfidence.influences.candidateHistory, true);
  assert.equal(view.metrics.electionBenchmarkQuality.value, canonicalQualityScore);
});

test("metric provenance tracker: lastRecomputedAt changes only when the metric revision token changes", () => {
  const tracker = createMetricProvenanceTracker();
  const state = buildFixtureState();

  const first = tracker.compute(state, { nowDate: new Date("2026-03-20T13:00:00.000Z") });
  const second = tracker.compute(state, { nowDate: new Date("2026-03-20T13:05:00.000Z") });

  assert.equal(
    second.metrics.targetingScore.lastRecomputedAt,
    first.metrics.targetingScore.lastRecomputedAt,
    "unchanged state should not move targetingScore recompute timestamp",
  );
  assert.equal(
    second.metrics.electionBenchmarkQuality.lastRecomputedAt,
    first.metrics.electionBenchmarkQuality.lastRecomputedAt,
    "unchanged state should not move electionBenchmarkQuality recompute timestamp",
  );

  const changed = structuredClone(state);
  changed.domains.targeting.revision += 1;
  changed.domains.targeting.runtime.rows = [
    ...changed.domains.targeting.runtime.rows,
    { geoid: "170310101004", score: 0.77, isTopTarget: true, reachableVoters: 155, fieldEfficiency: 0.69 },
  ];
  changed.revision += 1;

  const third = tracker.compute(changed, { nowDate: new Date("2026-03-20T13:10:00.000Z") });

  assert.equal(
    third.metrics.targetingScore.lastRecomputedAt,
    "2026-03-20T13:10:00.000Z",
    "targeting score should recompute when targeting revision changes",
  );
  assert.equal(
    third.metrics.electionBenchmarkQuality.lastRecomputedAt,
    first.metrics.electionBenchmarkQuality.lastRecomputedAt,
    "election benchmark quality should not recompute on targeting-only changes",
  );
});
