// @ts-check

import {
  createActionOwnerBlock,
  createHeadlineBlock,
  createRecommendationBlock,
  createRiskBlock,
  createTrendBlock,
  firstMetricDelta,
  fmtSignedDelta,
  makeSection,
} from "./common.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function buildWeeklyActionsSections(context) {
  const governance = context?.assurance?.governance || {};
  const weather = context?.operations?.weatherRisk || {};
  const targetingDelta = firstMetricDelta(context, "targetingScore");
  const confidenceDelta = firstMetricDelta(context, "outcomeConfidence");
  const qualityDelta = firstMetricDelta(context, "electionBenchmarkQuality");

  return [
    makeSection("weekly_delta_snapshot", "Weekly Delta Snapshot", [
      createHeadlineBlock({
        headline: "Weekly Actions",
        subheadline: "Operational deltas and owner-assigned work for the coming week.",
        tone: "operational",
      }),
      createTrendBlock({
        label: "Week-over-week movement",
        rows: [
          { metric: "Targeting score", delta: fmtSignedDelta(targetingDelta?.delta, 3), direction: cleanText(targetingDelta?.direction || "flat") },
          { metric: "Outcome confidence", delta: fmtSignedDelta(confidenceDelta?.delta, 3), direction: cleanText(confidenceDelta?.direction || "flat") },
          { metric: "Election quality", delta: fmtSignedDelta(qualityDelta?.delta, 3), direction: cleanText(qualityDelta?.direction || "flat") },
        ],
      }),
    ]),
    makeSection("priority_workplan", "Priority Workplan", [
      createActionOwnerBlock({
        action: "Refresh targeting run after election/census upstream verification",
        owner: "Targeting Lead",
        due: "This week",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Update war-room weather/event assumptions before field launch",
        owner: "War Room Director",
        due: "This week",
        status: "in_progress",
      }),
      createRecommendationBlock({
        priority: "High",
        text: "Treat unresolved governance warnings as blockers for client-facing confidence claims.",
        rationale: "Governance risk should be reduced before distribution to external audiences.",
      }),
    ]),
    makeSection("blockers_and_mitigations", "Blockers & Mitigations", [
      createRiskBlock({
        level: cleanText(governance?.confidenceBand || "unknown"),
        summary: cleanText(governance?.topWarning || "No governance blocker recorded."),
        mitigation: "Close warning-linked assumptions and rerun diagnostics before weekly close.",
      }),
      createRiskBlock({
        level: cleanText(weather?.fieldExecutionRisk || "unknown"),
        summary: "Weather may reduce planned field throughput.",
        mitigation: cleanText(weather?.recommendedAction || "Prepare channel fallback for high-precip windows."),
      }),
    ]),
  ];
}
