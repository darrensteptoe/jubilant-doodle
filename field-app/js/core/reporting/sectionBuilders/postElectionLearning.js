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
        subheadline:
          "Use realized results to separate what was signal from what was noise, then convert that learning into next-cycle calibration decisions.",
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
        label: "Election-data confidence",
        value: cleanText(election?.confidenceBand || "unknown"),
        note: `Quality ${fmtMetric(election?.qualityScore, 2)} with ${fmtWhole(election?.comparablePoolCount)} comparable pool(s).`,
      }),
    ]),
    makeSection("learning_recommendations", "Learning Recommendations", [
      createRecommendationBlock({
        priority: "P1",
        text: "Promote confirmed over/underperformance patterns into candidate-history and turnout assumptions.",
        rationale: "Post-election evidence should directly update next-cycle priors rather than remain anecdotal.",
      }),
      createRecommendationBlock({
        priority: "P2",
        text: "Adjust targeting priors where turnout or persuasion drift repeats across similar geographies.",
        rationale: "Persistent drift is a calibration signal, not a one-off exception.",
      }),
      createRecommendationBlock({
        priority: "P3",
        text: "Document where confidence was well-calibrated versus overstated before the next strategy cycle begins.",
        rationale: "Learning quality depends on explicit review of both model accuracy and confidence discipline.",
      }),
      createActionOwnerBlock({
        action: "Archive final actuals with confidence caveats and scenario context.",
        owner: "Data Operations",
        due: "Within 7 days",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Publish calibration memo and review with governance owners.",
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

