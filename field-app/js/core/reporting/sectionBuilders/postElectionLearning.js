// @ts-check

import {
  createActionOwnerBlock,
  createAppendixBlock,
  createHeadlineBlock,
  createRecommendationBlock,
  createStatusBlock,
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

export function buildPostElectionLearningSections(context) {
  const baselineDelta = firstMetricDelta(context, "baselineSupport");
  const turnoutDelta = firstMetricDelta(context, "turnoutExpected");
  const confidenceDelta = firstMetricDelta(context, "outcomeConfidence");
  const election = context?.electionDataInfluence || {};
  const governance = context?.assurance?.governance || {};

  return [
    makeSection("outcome_vs_forecast", "Outcome vs Forecast Deltas", [
      createHeadlineBlock({
        headline: "Post-Election Learning",
        subheadline: "Compare forecasted posture to realized signals and log calibration actions.",
        tone: "learning",
      }),
      createTrendBlock({
        label: "Core forecast deltas",
        rows: [
          { metric: "Baseline support", delta: fmtSignedDelta(baselineDelta?.delta, 2, "%"), direction: cleanText(baselineDelta?.direction || "flat") },
          { metric: "Turnout expected", delta: fmtSignedDelta(turnoutDelta?.delta, 2, "%"), direction: cleanText(turnoutDelta?.direction || "flat") },
          { metric: "Outcome confidence", delta: fmtSignedDelta(confidenceDelta?.delta, 3), direction: cleanText(confidenceDelta?.direction || "flat") },
        ],
      }),
      createStatusBlock({
        label: "Election data confidence",
        value: cleanText(election?.confidenceBand || "unknown"),
        note: `Quality ${fmtMetric(election?.qualityScore, 2)} with ${fmtWhole(election?.comparablePoolCount)} comparable pools.`,
      }),
    ]),
    makeSection("learning_recommendations", "Learning Recommendations", [
      createRecommendationBlock({
        priority: "High",
        text: "Promote confirmed over/underperformance patterns into candidate-history assumptions.",
        rationale: "Post-election evidence should refine repeat-candidate and volatility priors.",
      }),
      createRecommendationBlock({
        priority: "High",
        text: "Adjust targeting priors where turnout baseline deltas persist across similar geographies.",
        rationale: "Persistent turnout drift should feed next-cycle target prioritization.",
      }),
      createActionOwnerBlock({
        action: "Archive final actuals + confidence notes",
        owner: "Data Operations",
        due: "Within 7 days",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Publish calibration memo for governance review",
        owner: "Model Lead",
        due: "Within 10 days",
        status: "pending",
      }),
    ]),
    makeSection("archive_metadata", "Archive & Provenance Metadata", [
      createAppendixBlock({
        title: "Source references",
        rows: [
          { label: "Snapshot hash", value: cleanText(context?.sourceReferences?.snapshotHash || "") || "—" },
          { label: "Archive selected hash", value: cleanText(context?.archive?.selectedHash || "") || "—" },
          { label: "Archive entry count", value: fmtWhole(context?.archive?.entryCount) },
          { label: "Governance confidence", value: cleanText(governance?.confidenceBand || "unknown") },
          { label: "Governance warning", value: cleanText(governance?.topWarning || "—") || "—" },
        ],
      }),
    ]),
  ];
}
