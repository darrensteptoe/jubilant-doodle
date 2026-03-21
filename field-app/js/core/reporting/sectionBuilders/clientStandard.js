// @ts-check

import {
  buildMetricRow,
  createBenchmarkBlock,
  createConfidenceMethodologyBlock,
  createHeadlineBlock,
  createMetricGridBlock,
  createRecommendationBlock,
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

export function buildClientStandardSections(context) {
  const campaignName = cleanText(context?.context?.campaignName || context?.context?.campaignId || "Campaign");
  const metrics = context?.metrics?.metrics || {};
  const election = context?.electionDataInfluence || {};
  const governance = context?.assurance?.governance || {};

  const winConfidence = metrics?.outcomeConfidence?.value;
  const baselineSupport = metrics?.baselineSupport?.value;
  const turnoutExpected = metrics?.turnoutExpected?.value;
  const targetingScore = metrics?.targetingScore?.value;

  const confidenceDelta = firstMetricDelta(context, "outcomeConfidence");
  const targetingDelta = firstMetricDelta(context, "targetingScore");

  return [
    makeSection("what_matters_now", "What Matters Now", [
      createHeadlineBlock({
        headline: `${campaignName} strategic update`,
        subheadline: "Client-facing summary of current position and actionable next moves.",
        tone: "strategic",
      }),
      createMetricGridBlock({
        title: "Current position",
        metrics: [
          buildMetricRow("Baseline support", fmtMetric(baselineSupport, 1, "%")),
          buildMetricRow("Turnout expected", fmtMetric(turnoutExpected, 1, "%")),
          buildMetricRow("Targeting score", fmtMetric(targetingScore, 2)),
          buildMetricRow("Confidence", fmtMetric(winConfidence, 2)),
        ],
      }),
      createTrendBlock({
        label: "Since prior snapshot",
        rows: [
          {
            metric: "Confidence",
            delta: fmtSignedDelta(confidenceDelta?.delta, 3),
            direction: cleanText(confidenceDelta?.direction || "flat"),
          },
          {
            metric: "Targeting score",
            delta: fmtSignedDelta(targetingDelta?.delta, 3),
            direction: cleanText(targetingDelta?.direction || "flat"),
          },
        ],
      }),
    ]),
    makeSection("strategic_position", "Strategic Position", [
      createBenchmarkBlock({
        label: "Election benchmark quality",
        value: fmtMetric(election?.qualityScore, 2),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.comparablePoolCount)} comparable pools and ${fmtWhole(election?.turnoutBaselineCount)} turnout baselines inform this position.`,
      }),
      createBenchmarkBlock({
        label: "Primary caveat",
        value: cleanText(governance?.topWarning || "No active governance warning."),
        confidence: cleanText(governance?.confidenceBand || "unknown"),
        note: "Confidence framing reflects governance and election-data quality signals.",
      }),
    ]),
    makeSection("top_recommendations", "Top Recommendations", [
      createRecommendationBlock({
        priority: "High",
        text: "Focus resources on top-ranked geographies while preserving follow-through on turnout-prioritized segments.",
        rationale: "Targeting score momentum and turnout expected outputs indicate this path produces the clearest near-term gain.",
      }),
      createRecommendationBlock({
        priority: "High",
        text: cleanText(election?.confidenceBand) === "high"
          ? "Apply benchmark-calibrated turnout assumptions in weekly scenario refreshes."
          : "Treat benchmark-derived assumptions as provisional until import quality improves.",
        rationale: "Election data confidence determines how strongly benchmark priors should influence strategy.",
      }),
    ]),
    makeSection("confidence_frame", "Confidence Frame", [
      createConfidenceMethodologyBlock({
        confidenceBand: cleanText(governance?.confidenceBand || election?.confidenceBand || "unknown"),
        score: fmtMetric(winConfidence, 2),
        methodologyNotes: [
          "Values are produced from canonical state + selector outputs.",
          "Election data quality and comparable-race depth are incorporated into confidence framing.",
        ],
        caveats: [
          cleanText(governance?.topWarning || "No active governance caveat."),
        ],
      }),
    ]),
  ];
}
