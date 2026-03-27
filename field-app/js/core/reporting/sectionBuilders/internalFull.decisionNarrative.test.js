// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInternalFullSections,
  deriveInternalDecisionNarrative,
} from "./internalFull.js";

function buildNarrativeContext(overrides = {}) {
  return {
    context: {
      campaignId: "demo-campaign",
      campaignName: "Demo Campaign",
      officeId: "statewide_executive",
      scenarioId: "baseline",
    },
    metrics: {
      metrics: {
        baselineSupport: { value: 42 },
        turnoutExpected: { value: 49 },
        persuasionNeed: { value: 4200 },
        targetingScore: { value: 0.51 },
        outcomeConfidence: { value: 0.49 },
        electionBenchmarkQuality: { value: 0.44 },
      },
      comparison: {
        trendRows: [
          { metricId: "targetingScore", delta: 0.08, direction: "up" },
          { metricId: "outcomeConfidence", delta: -0.03, direction: "down" },
          { metricId: "electionBenchmarkQuality", delta: -0.02, direction: "down" },
        ],
      },
    },
    selectors: {
      districtCanonical: { templateProfile: { raceType: "statewide_executive", officeLevel: "statewide_executive" } },
      districtDerived: {
        turnoutSnapshot: { hasTurnoutAnchors: true },
      },
      outcomeDerived: {
        mcSummary: {
          winProb: 0.46,
          expectedMargin: 0.4,
          marginBandWidth: 6.1,
        },
        sensitivitySummary: {
          topDriver: "Turnout reliability",
        },
      },
      targetingDerived: {
        status: {
          staleSinceUpstreamChange: true,
        },
        electionInfluence: {
          turnoutBoostCoverageRatio: 0.14,
        },
      },
    },
    electionDataInfluence: {
      confidenceBand: "low",
      qualityScore: 0.42,
      comparablePoolCount: 1,
      turnoutBaselineCount: 1,
      historicalBenchmarkCount: 1,
      recommendationTargets: { district: 1, targeting: 1, outcome: 1 },
      rowCount: 12,
      importStatus: "imported",
      downstreamRecommendations: {
        district: { baselineSupport: 47 },
        outcome: { confidenceFloor: 0.66 },
      },
    },
    operations: {
      weatherRisk: {},
      eventCalendar: {},
    },
    assurance: {
      governance: {
        confidenceBand: "low",
        topWarning: "Confidence is thin.",
      },
      audit: {},
      recovery: {},
    },
    archive: {},
    sourceReferences: {},
    ...overrides,
  };
}

test("reporting decision narrative derives deterministic binding/fragile/divergence lines from existing signals", () => {
  const context = buildNarrativeContext();
  const narrative = deriveInternalDecisionNarrative(context);

  assert.match(narrative.binding, /Targeting is stale/i);
  assert.match(narrative.fragile, /outcome spread is wide/i);
  assert.match(narrative.benchmarkDivergence, /Treat this as calibration tension/i);
  assert.ok(Array.isArray(narrative.nextSteps));
  assert.ok(narrative.nextSteps.length > 0);
});

test("reporting decision narrative omits benchmark divergence when no supported divergence signal exists", () => {
  const context = buildNarrativeContext({
    metrics: {
      metrics: {
        baselineSupport: { value: 46.5 },
        turnoutExpected: { value: 49 },
        persuasionNeed: { value: 1800 },
        targetingScore: { value: 0.61 },
        outcomeConfidence: { value: 0.61 },
        electionBenchmarkQuality: { value: 0.71 },
      },
      comparison: {
        trendRows: [
          { metricId: "targetingScore", delta: 0.02, direction: "up" },
          { metricId: "outcomeConfidence", delta: 0.01, direction: "up" },
          { metricId: "electionBenchmarkQuality", delta: 0.01, direction: "up" },
        ],
      },
    },
    selectors: {
      districtCanonical: { templateProfile: { raceType: "state_leg", officeLevel: "state_legislative_lower" } },
      districtDerived: {
        turnoutSnapshot: { hasTurnoutAnchors: true },
      },
      outcomeDerived: {
        mcSummary: {
          winProb: 0.64,
          expectedMargin: 2.2,
          marginBandWidth: 2.8,
        },
        sensitivitySummary: {
          topDriver: "Contact rate",
        },
      },
      targetingDerived: {
        status: {
          staleSinceUpstreamChange: false,
        },
        electionInfluence: {
          turnoutBoostCoverageRatio: 0.41,
        },
      },
    },
    electionDataInfluence: {
      confidenceBand: "high",
      qualityScore: 0.73,
      comparablePoolCount: 4,
      turnoutBaselineCount: 2,
      historicalBenchmarkCount: 3,
      recommendationTargets: { district: 1, targeting: 1, outcome: 1 },
      rowCount: 18,
      importStatus: "imported",
      downstreamRecommendations: {
        district: { baselineSupport: 46.9 },
        outcome: { confidenceFloor: 0.61 },
      },
    },
    assurance: {
      governance: {
        confidenceBand: "medium",
        topWarning: "",
      },
      audit: {},
      recovery: {},
    },
  });
  const narrative = deriveInternalDecisionNarrative(context);
  assert.equal(narrative.benchmarkDivergence, "");
});

test("reporting decision narrative next steps are deterministic and read-only", () => {
  const context = buildNarrativeContext();
  const inputSnapshot = JSON.parse(JSON.stringify(context));
  const first = deriveInternalDecisionNarrative(context);
  const second = deriveInternalDecisionNarrative(context);

  assert.deepEqual(second, first);
  assert.deepEqual(context, inputSnapshot);
});

test("internal full report includes compact decision narrative rows with benchmark divergence gating", () => {
  const withDivergence = buildInternalFullSections(buildNarrativeContext());
  const situationSection = withDivergence.find((section) => section.id === "situation_snapshot");
  const narrativeBlock = situationSection?.blocks?.find((block) => block.type === "appendix" && block.title === "Decision Narrative Layer");
  const narrativeRows = Array.isArray(narrativeBlock?.rows) ? narrativeBlock.rows : [];
  const labels = narrativeRows.map((row) => String(row?.label || ""));

  assert.ok(labels.includes("What is binding"));
  assert.ok(labels.includes("What is fragile"));
  assert.ok(labels.includes("Benchmark divergence"));
  assert.ok(labels.includes("What to do next"));

  const withoutDivergence = buildInternalFullSections(buildNarrativeContext({
    electionDataInfluence: {
      confidenceBand: "high",
      qualityScore: 0.74,
      comparablePoolCount: 3,
      turnoutBaselineCount: 2,
      historicalBenchmarkCount: 2,
      recommendationTargets: { district: 1, targeting: 1, outcome: 1 },
      rowCount: 20,
      importStatus: "imported",
      downstreamRecommendations: {
        district: { baselineSupport: 42.3 },
        outcome: { confidenceFloor: 0.47 },
      },
    },
    selectors: {
      districtCanonical: { templateProfile: { raceType: "state_leg", officeLevel: "state_legislative_lower" } },
      districtDerived: {
        turnoutSnapshot: { hasTurnoutAnchors: true },
      },
      outcomeDerived: {
        mcSummary: {
          winProb: 0.48,
          expectedMargin: 0.4,
          marginBandWidth: 5.4,
        },
        sensitivitySummary: {
          topDriver: "Turnout reliability",
        },
      },
      targetingDerived: {
        status: {
          staleSinceUpstreamChange: true,
        },
        electionInfluence: {
          turnoutBoostCoverageRatio: 0.15,
        },
      },
    },
  }));
  const situationSectionNoDiv = withoutDivergence.find((section) => section.id === "situation_snapshot");
  const narrativeBlockNoDiv = situationSectionNoDiv?.blocks?.find((block) => block.type === "appendix" && block.title === "Decision Narrative Layer");
  const labelsNoDiv = (Array.isArray(narrativeBlockNoDiv?.rows) ? narrativeBlockNoDiv.rows : []).map((row) => String(row?.label || ""));
  assert.ok(!labelsNoDiv.includes("Benchmark divergence"));
});

