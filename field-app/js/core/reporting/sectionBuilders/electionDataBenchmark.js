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
        subheadline:
          "Historical data helps only when it is both comparable and clean. This report determines whether benchmark inputs are strong enough to shape assumptions.",
        tone: "analytics",
      }),
      createBenchmarkBlock({
        label: "Import status",
        value: cleanText(election?.importStatus || "unknown"),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.rowCount)} normalized row(s) in the latest benchmark snapshot.`,
      }),
      createBenchmarkBlock({
        label: "Quality score",
        value: fmtMetric(election?.qualityScore, 2),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Quality score summarizes completeness, mapping integrity, and warning penalties.",
      }),
      createTrendBlock({
        label: "Quality movement",
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
        note: `${fmtWhole(election?.historicalBenchmarkCount)} historical benchmark row(s) available for comparability checks.`,
      }),
      createBenchmarkBlock({
        label: "Turnout baseline rows",
        value: fmtWhole(election?.turnoutBaselineCount),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Turnout baseline depth controls how stable district and targeting priors can be.",
      }),
      createBenchmarkBlock({
        label: "Downstream recommendation coverage",
        value:
          `${fmtWhole(election?.recommendationTargets?.district)} district / ${fmtWhole(election?.recommendationTargets?.targeting)} targeting / ${fmtWhole(election?.recommendationTargets?.outcome)} outcome`,
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Coverage reflects how fully election intelligence is connected to active planning surfaces.",
      }),
    ]),
    makeSection("downstream_impact", "Downstream Impact", [
      createRecommendationBlock({
        priority: "P1",
        text: "Apply benchmark suggestions to district baseline support and turnout calibration where comparability is strong.",
        rationale: "High-quality benchmark alignment improves realism in district assumptions and field planning.",
      }),
      createRecommendationBlock({
        priority: "P2",
        text: "Refresh targeting and outcome confidence immediately after benchmark updates.",
        rationale: "Benchmark quality and pool depth materially affect both target prioritization and confidence framing.",
      }),
      createRiskBlock({
        level: cleanText(election?.confidenceBand || "unknown"),
        summary: cleanText(governance?.topWarning || "No governance warning recorded."),
        mitigation: "Document benchmark caveats explicitly when confidence is mixed or comparability is thin.",
      }),
    ]),
    makeSection("methodology", "Confidence & Methodology", [
      createConfidenceMethodologyBlock({
        confidenceBand: cleanText(election?.confidenceBand || governance?.confidenceBand || "unknown"),
        score: fmtMetric(election?.qualityScore, 2),
        methodologyNotes: [
          "Election quality scoring is built from canonical import, QA, and warning fields.",
          "Comparable pools and turnout baselines are consumed from canonical benchmark arrays.",
          "Recommendation coverage tracks district, targeting, and outcome integration points.",
        ],
        caveats: [
          cleanText(governance?.topWarning || "No governance caveat recorded."),
          cleanText(election?.importStatus) === "imported" ? "Latest benchmark import is available." : "No imported benchmark snapshot available.",
        ],
      }),
    ]),
  ];
}

