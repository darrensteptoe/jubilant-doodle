// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveElectionDataBenchmarkTrustExplanation } from "./benchmarks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const benchmarksSource = fs.readFileSync(path.join(__dirname, "benchmarks.js"), "utf8");

function buildCanonical(overrides = {}) {
  return {
    quality: {
      confidenceBand: "high",
      score: 0.86,
    },
    benchmarks: {
      historicalRaceBenchmarks: [
        { cycleYear: 2022, office: "state_house", electionType: "general" },
        { cycleYear: 2020, office: "state_house", electionType: "general" },
        { cycleYear: 2018, office: "state_house", electionType: "general" },
        { cycleYear: 2022, office: "state_senate", electionType: "general" },
      ],
      turnoutBaselines: [
        { cycleYear: 2022, turnoutRate: 0.61 },
        { cycleYear: 2020, turnoutRate: 0.64 },
      ],
      comparableRacePools: [
        { poolKey: "state_house|general", office: "state_house", electionType: "general", cycleCount: 3, raceCount: 12 },
      ],
      benchmarkSuggestions: [{ id: "turnout_baseline" }, { id: "volatility_guardrail" }],
      downstreamRecommendations: {
        district: { turnoutBaselinePct: 0.61 },
        targeting: { priorityGeographyIds: ["17031"] },
        outcome: { confidenceFloor: 0.62 },
      },
    },
    ...overrides,
  };
}

function buildDerived(overrides = {}) {
  return {
    qualitySummary: {
      confidenceBand: "high",
      score: 0.86,
    },
    benchmarkSummary: {
      turnoutBaselineCount: 2,
      historicalBenchmarkCount: 4,
      comparablePoolCount: 1,
      recommendationTargets: {
        district: 1,
        targeting: 1,
        outcome: 1,
      },
    },
    ...overrides,
  };
}

test("election data provenance/trust explanation renders when benchmark signals are sufficient", () => {
  const explanation = deriveElectionDataBenchmarkTrustExplanation(buildCanonical(), buildDerived());
  assert.equal(explanation.ready, true);
  assert.match(explanation.drivingText, /historical benchmark row\(s\)/i);
  assert.match(explanation.qualityText, /Strong benchmark grounding/i);
  assert.match(explanation.comparableText, /Comparable coverage/i);
  assert.match(explanation.readinessText, /Ready for downstream advisory use/i);
});

test("election data provenance/trust quality interpretation handles weak confidence safely", () => {
  const explanation = deriveElectionDataBenchmarkTrustExplanation(
    buildCanonical({
      quality: { confidenceBand: "low", score: 0.49 },
      benchmarks: {
        historicalRaceBenchmarks: [
          { cycleYear: 2022, office: "state_house", electionType: "general" },
        ],
        turnoutBaselines: [{ cycleYear: 2022, turnoutRate: 0.59 }],
        comparableRacePools: [],
        benchmarkSuggestions: [{ id: "turnout_baseline" }],
      },
    }),
    buildDerived({
      qualitySummary: { confidenceBand: "low", score: 0.49 },
      benchmarkSummary: {
        turnoutBaselineCount: 1,
        historicalBenchmarkCount: 1,
        comparablePoolCount: 0,
        recommendationTargets: {
          district: 0,
          targeting: 0,
          outcome: 0,
        },
      },
    }),
  );
  assert.equal(explanation.ready, true);
  assert.match(explanation.qualityText, /Weak benchmark support/i);
  assert.match(explanation.comparableText, /coverage is thin/i);
  assert.match(explanation.readinessText, /Limited downstream readiness/i);
});

test("election data provenance/trust readiness is omitted when evidence support is absent", () => {
  const explanation = deriveElectionDataBenchmarkTrustExplanation(
    {
      quality: { confidenceBand: "unknown", score: null },
      benchmarks: {
        historicalRaceBenchmarks: [],
        turnoutBaselines: [],
        comparableRacePools: [],
        benchmarkSuggestions: [],
      },
    },
    {
      qualitySummary: { confidenceBand: "unknown", score: null },
      benchmarkSummary: {
        turnoutBaselineCount: 0,
        historicalBenchmarkCount: 0,
        comparablePoolCount: 0,
        recommendationTargets: {
          district: 0,
          targeting: 0,
          outcome: 0,
        },
      },
    },
  );
  assert.equal(explanation.ready, false);
  assert.match(explanation.statusText, /details appear after benchmark rows are available/i);
  assert.equal(explanation.readinessText, "");
});

test("election data provenance/trust explains benchmark scope boundaries deterministically", () => {
  const explanation = deriveElectionDataBenchmarkTrustExplanation(buildCanonical(), buildDerived());
  assert.match(explanation.scopeText, /calibration context/i);
  assert.match(explanation.scopeText, /does not represent current campaign truth/i);
  assert.match(explanation.scopeText, /does not silently override live assumptions/i);
});

test("election data provenance/trust layer remains read-only", () => {
  assert.doesNotMatch(
    benchmarksSource,
    /applyElectionDataBenchmarksBridge|importElectionDataFileBridge|mapElectionDataColumnsBridge|reconcileElectionDataCandidatesBridge|reconcileElectionDataGeographiesBridge/,
  );
});

