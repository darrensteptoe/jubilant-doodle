// @ts-check

import {
  createBenchmarkBlock,
  createConfidenceMethodologyBlock,
  createHeadlineBlock,
  createRecommendationBlock,
  createRiskBlock,
  createTrendBlock,
  firstMetricDelta,
  fmtMetric,
  fmtSignedDelta,
  fmtWhole,
  makeSection,
} from "./common.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function buildElectionDataBenchmarkSections(context) {
  const election = context?.electionDataInfluence || {};
  const qualityDelta = firstMetricDelta(context, "electionBenchmarkQuality");
  const governance = context?.assurance?.governance || {};

  return [
    makeSection("election_intake_quality", "Election Intake Quality", [
      createHeadlineBlock({
        headline: "Election Data Benchmark Report",
        subheadline: "Import quality, comparable depth, and downstream impact for calibration decisions.",
        tone: "analytics",
      }),
      createBenchmarkBlock({
        label: "Import status",
        value: cleanText(election?.importStatus || "unknown"),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.rowCount)} normalized row(s).`,
      }),
      createBenchmarkBlock({
        label: "Quality score",
        value: fmtMetric(election?.qualityScore, 2),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Quality score summarizes completeness and warning penalties.",
      }),
      createTrendBlock({
        label: "Quality delta",
        rows: [
          {
            metric: "Benchmark quality",
            delta: fmtSignedDelta(qualityDelta?.delta, 3),
            direction: cleanText(qualityDelta?.direction || "flat"),
          },
        ],
      }),
    ]),
    makeSection("comparable_turnout", "Comparable Pools & Turnout Baselines", [
      createBenchmarkBlock({
        label: "Comparable race pools",
        value: fmtWhole(election?.comparablePoolCount),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.historicalBenchmarkCount)} historical benchmark row(s).`,
      }),
      createBenchmarkBlock({
        label: "Turnout baseline rows",
        value: fmtWhole(election?.turnoutBaselineCount),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Turnout baselines feed district assumptions and targeting priors.",
      }),
      createBenchmarkBlock({
        label: "Downstream recommendation targets",
        value: `${fmtWhole(election?.recommendationTargets?.district)} / ${fmtWhole(election?.recommendationTargets?.targeting)} / ${fmtWhole(election?.recommendationTargets?.outcome)}`,
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Order: district / targeting / outcome.",
      }),
    ]),
    makeSection("downstream_impact", "Downstream Impact", [
      createRecommendationBlock({
        priority: "High",
        text: "Apply benchmark suggestions to district baseline support and turnout calibration.",
        rationale: "District and targeting outputs should reflect election-derived priors when quality is sufficient.",
      }),
      createRecommendationBlock({
        priority: "High",
        text: "Refresh outcome confidence/governance after election-data updates.",
        rationale: "Outcome confidence should explicitly incorporate benchmark quality and comparable depth.",
      }),
      createRiskBlock({
        level: cleanText(election?.confidenceBand || "unknown"),
        summary: cleanText(governance?.topWarning || "No governance warning recorded."),
        mitigation: "Document benchmark caveats in client-facing confidence framing.",
      }),
    ]),
    makeSection("methodology", "Confidence & Methodology", [
      createConfidenceMethodologyBlock({
        confidenceBand: cleanText(election?.confidenceBand || governance?.confidenceBand || "unknown"),
        score: fmtMetric(election?.qualityScore, 2),
        methodologyNotes: [
          "Election quality scoring is computed from canonical import/QA fields.",
          "Comparable pools and turnout baselines are consumed from canonical benchmark arrays.",
          "Downstream recommendation coverage is tracked for district, targeting, and outcome surfaces.",
        ],
        caveats: [
          cleanText(governance?.topWarning || "No governance caveat recorded."),
          cleanText(election?.importStatus) === "imported" ? "Latest import is available." : "No imported benchmark snapshot available.",
        ],
      }),
    ]),
  ];
}
