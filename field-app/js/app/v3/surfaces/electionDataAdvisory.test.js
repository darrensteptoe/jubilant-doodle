// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveDistrictElectionBenchmarkAdvisory,
  deriveReachElectionBenchmarkAdvisory,
  deriveOutcomeElectionBenchmarkAdvisory,
} from "./electionDataAdvisory.js";

function makeSnapshot() {
  return {
    import: {
      fileName: "county_history.csv",
      importedAt: "2026-03-20T18:00:00.000Z",
    },
    quality: {
      confidenceBand: "high",
    },
    benchmarks: {
      turnoutBaselines: [
        { turnoutRate: 0.62 },
        { turnoutRate: 0.58 },
      ],
      benchmarkSuggestions: [{ type: "turnout" }],
      comparableRacePools: [{ poolKey: "il_statewide_exec" }],
      downstreamRecommendations: {
        district: {
          turnoutBaselinePct: 0.61,
          volatilityBandWidth: 0.045,
          confidenceBand: "high",
          benchmarkCount: 3,
        },
        targeting: {
          priorityGeographyIds: ["17031", "17043"],
          turnoutBoostGeoids: ["17031010100", "17043020100"],
          comparablePoolKey: "il_statewide_exec",
          volatilityFocus: "suburban_ring",
        },
        outcome: {
          confidenceFloor: 0.64,
          calibrationWindowPct: 0.61,
          volatilityBandWidth: 0.045,
          recommendationCount: 2,
        },
      },
    },
  };
}

test("district advisory derives explicit turnout and band suggestions", () => {
  const advisory = deriveDistrictElectionBenchmarkAdvisory(makeSnapshot());
  assert.ok(advisory);
  assert.equal(advisory.hasTurnoutAnchors, true);
  assert.equal(advisory.turnoutAnchorA, 62);
  assert.equal(advisory.turnoutAnchorB, 58);
  assert.equal(advisory.hasBandSuggestion, true);
  assert.equal(advisory.bandSuggestion, 4.5);
  assert.match(advisory.provenanceText, /county_history\.csv/);
});

test("district advisory stays hidden when no usable recommendations exist", () => {
  const advisory = deriveDistrictElectionBenchmarkAdvisory({
    import: {},
    quality: {},
    benchmarks: {
      turnoutBaselines: [],
      downstreamRecommendations: {
        district: {},
      },
    },
  });
  assert.equal(advisory, null);
});

test("reach advisory derives downstream recommendation context safely", () => {
  const advisory = deriveReachElectionBenchmarkAdvisory(
    makeSnapshot(),
    { currentGeographyIds: ["17-031", "17031010100", "99999"] },
  );
  assert.ok(advisory);
  assert.deepEqual(advisory.priorityGeographyIds, ["17031", "17043"]);
  assert.deepEqual(advisory.turnoutBoostGeoids, ["17031010100", "17043020100"]);
  assert.equal(advisory.comparablePoolKey, "il_statewide_exec");
  assert.equal(advisory.volatilityFocus, "suburban_ring");
  assert.equal(advisory.priorityOverlapCount, 1);
  assert.equal(advisory.turnoutOverlapCount, 1);
  assert.equal(advisory.priorityCoverageRatio, 0.333333);
  assert.equal(advisory.turnoutCoverageRatio, 0.333333);
  assert.match(advisory.qualityText, /HIGH/);
});

test("outcome advisory derives confidence framing from benchmark recommendations", () => {
  const advisory = deriveOutcomeElectionBenchmarkAdvisory(makeSnapshot());
  assert.ok(advisory);
  assert.equal(advisory.confidenceFloor, 0.64);
  assert.equal(advisory.calibrationWindowPct, 0.61);
  assert.equal(advisory.volatilityBandWidth, 4.5);
  assert.equal(advisory.comparablePoolKey, "il_statewide_exec");
});

test("district advisory preserves already-point volatility width inputs", () => {
  const advisory = deriveDistrictElectionBenchmarkAdvisory({
    import: {},
    quality: {},
    benchmarks: {
      downstreamRecommendations: {
        district: {
          turnoutBaselinePct: 55,
          volatilityBandWidth: 6,
        },
      },
    },
  });
  assert.ok(advisory);
  assert.equal(advisory.turnoutAnchorA, 55);
  assert.equal(advisory.turnoutAnchorB, 55);
  assert.equal(advisory.bandSuggestion, 6);
});
