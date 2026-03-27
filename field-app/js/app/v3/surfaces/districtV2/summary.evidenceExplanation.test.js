// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveDistrictEvidenceExplanation } from "./summary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const summarySource = fs.readFileSync(path.join(__dirname, "summary.js"), "utf8");

function buildInput(overrides = {}) {
  return {
    snapshot: {
      baselineSupport: "52.0%",
      turnoutExpected: "49.0%",
      turnoutBand: "52.0% / 46.0%",
      projectedVotes: "24,500",
      persuasionNeed: "2,200",
    },
    electionDataSummary: {
      normalizedRowCount: 140,
      qualityScore: 0.78,
      confidenceBand: "medium",
      benchmarkSuggestionCount: 3,
    },
    formSnapshot: {
      turnoutA: 50.2,
      turnoutB: 47.6,
      bandWidth: 3.2,
    },
    templateSnapshot: {
      candidateHistoryCoverageBand: "high",
      candidateHistoryConfidenceBand: "high",
      candidateHistoryRecordCount: 3,
    },
    ballotSnapshot: {
      yourCandidateId: "cand_a",
      candidates: [
        { id: "cand_a", name: "Alex Alpha" },
      ],
      candidateHistorySummaryText: "History rows: 3 · matched: 3 · coverage: high · confidence: high",
      candidateHistoryRecords: [
        { candidateName: "Alex Alpha", voteShare: 49.2 },
        { candidateName: "Alex Alpha", voteShare: 50.4 },
        { candidateName: "Alex Alpha", voteShare: 51.1 },
      ],
    },
    turnoutBenchmarkAdvisory: {
      hasTurnoutAnchors: true,
      turnoutAnchorA: 49.8,
      turnoutAnchorB: 47.2,
      turnoutAnchorText: "A 49.8% · B 47.2%",
      hasBandSuggestion: true,
      bandSuggestion: 3.0,
      bandSuggestionText: "±3.0%",
    },
    electionDataCanonicalSnapshot: {
      benchmarks: {
        comparableRacePools: [{ poolKey: "state_house_medium" }],
      },
    },
    ...overrides,
  };
}

test("district evidence explanation emits grounded lines and aligned range posture when supported", () => {
  const explanation = deriveDistrictEvidenceExplanation(buildInput());
  assert.equal(explanation.ready, true);
  assert.match(explanation.groundedText, /Turnout anchors are benchmark-backed/i);
  assert.match(explanation.groundedText, /Comparable benchmark pools are available/i);
  assert.equal(explanation.divergenceText, "");
  assert.equal(explanation.confidenceLimitedText, "");
  assert.equal(explanation.rangePostureText, "Historically aligned.");
});

test("district evidence explanation renders benchmark divergence only when thresholds are crossed", () => {
  const noDivergence = deriveDistrictEvidenceExplanation(buildInput({
    formSnapshot: {
      turnoutA: 49.9,
      turnoutB: 47.4,
      bandWidth: 3.1,
    },
    snapshot: {
      baselineSupport: "50.0%",
      turnoutExpected: "49.0%",
      turnoutBand: "50.0% / 47.0%",
      projectedVotes: "24,500",
      persuasionNeed: "2,200",
    },
  }));
  assert.equal(noDivergence.divergenceText, "");

  const divergence = deriveDistrictEvidenceExplanation(buildInput({
    formSnapshot: {
      turnoutA: 53.4,
      turnoutB: 44.6,
      bandWidth: 6.1,
    },
  }));
  assert.match(divergence.divergenceText, /Turnout anchors are/i);
  assert.match(divergence.divergenceText, /Historical benchmark is calibration context/i);
});

test("district evidence explanation distinguishes thin evidence from ambitious assumptions when both apply", () => {
  const explanation = deriveDistrictEvidenceExplanation(buildInput({
    electionDataSummary: {
      normalizedRowCount: 0,
      qualityScore: 0.42,
      confidenceBand: "low",
      benchmarkSuggestionCount: 0,
    },
    templateSnapshot: {
      candidateHistoryCoverageBand: "low",
      candidateHistoryConfidenceBand: "low",
      candidateHistoryRecordCount: 2,
    },
    ballotSnapshot: {
      yourCandidateId: "cand_a",
      candidates: [{ id: "cand_a", name: "Alex Alpha" }],
      candidateHistorySummaryText: "History rows: 2 · matched: 0 · coverage: low · confidence: low · unmatched candidate rows: 2",
      candidateHistoryRecords: [
        { candidateName: "Alex Alpha", voteShare: 43.0 },
        { candidateName: "Alex Alpha", voteShare: 44.2 },
      ],
    },
    formSnapshot: {
      turnoutA: 55.0,
      turnoutB: 42.1,
      bandWidth: 6.0,
    },
    turnoutBenchmarkAdvisory: {
      hasTurnoutAnchors: true,
      turnoutAnchorA: 49.8,
      turnoutAnchorB: 47.2,
      turnoutAnchorText: "A 49.8% · B 47.2%",
      hasBandSuggestion: true,
      bandSuggestion: 3.0,
      bandSuggestionText: "±3.0%",
    },
    electionDataCanonicalSnapshot: {
      benchmarks: {
        comparableRacePools: [],
      },
    },
  }));

  assert.match(explanation.confidenceLimitedText, /thin evidence/i);
  assert.match(explanation.confidenceLimitedText, /ambitious assumptions/i);
  assert.equal(explanation.rangePostureText, "Highly assumption-dependent.");
});

test("district evidence explanation reports limited context when evidence inputs are missing", () => {
  const explanation = deriveDistrictEvidenceExplanation({
    snapshot: {
      baselineSupport: "-",
      turnoutExpected: "-",
      turnoutBand: "-",
      projectedVotes: "-",
      persuasionNeed: "-",
    },
    electionDataSummary: {
      normalizedRowCount: 0,
      qualityScore: null,
      confidenceBand: "unknown",
      benchmarkSuggestionCount: 0,
    },
    formSnapshot: {},
    templateSnapshot: {
      candidateHistoryCoverageBand: "none",
      candidateHistoryConfidenceBand: "missing",
      candidateHistoryRecordCount: 0,
    },
    ballotSnapshot: {
      candidateHistorySummaryText: "No candidate history rows.",
      candidateHistoryRecords: [],
      candidates: [],
    },
    turnoutBenchmarkAdvisory: null,
    electionDataCanonicalSnapshot: {
      benchmarks: {
        comparableRacePools: [],
      },
    },
  });

  assert.equal(explanation.ready, false);
  assert.match(explanation.statusText, /Limited evidence context/i);
  assert.equal(explanation.groundedText, "");
  assert.equal(explanation.divergenceText, "");
});

test("district summary explanation module remains read-only and introduces no write/apply calls", () => {
  assert.doesNotMatch(summarySource, /setDistrictFormField|updateDistrictCandidate|updateDistrictCandidateHistory|setDistrictTargetingField|applyDistrictTemplateDefaults/);
});

