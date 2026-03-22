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
        subheadline:
          "This is the campaign working plan for the next seven days: what moved, what it means, what is blocked, and what must be owned.",
        tone: "operational",
      }),
      createTrendBlock({
        label: "What moved this week",
        rows: [
          { metric: "Targeting score", delta: fmtSignedDelta(targetingDelta?.delta, 3), direction: cleanText(targetingDelta?.direction || "flat") },
          { metric: "Outcome confidence", delta: fmtSignedDelta(confidenceDelta?.delta, 3), direction: cleanText(confidenceDelta?.direction || "flat") },
          { metric: "Election quality", delta: fmtSignedDelta(qualityDelta?.delta, 3), direction: cleanText(qualityDelta?.direction || "flat") },
        ],
      }),
      createRecommendationBlock({
        priority: "Interpretation",
        text: "Treat movement as decision-relevant only when governance and upstream data quality remain coherent.",
        rationale: "Direction without evidence quality can lead to noisy weekly pivots.",
      }),
    ]),
    makeSection("priority_workplan", "Priority Workplan", [
      createActionOwnerBlock({
        action: "Run targeting refresh after election/census upstream verification and publish concentration-vs-breadth readout.",
        owner: "Targeting Lead",
        due: "This week",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Refresh war-room weather and event assumptions before field launch timing is finalized.",
        owner: "War Room Director",
        due: "This week",
        status: "in_progress",
      }),
      createActionOwnerBlock({
        action: "Clear governance warning-linked assumption items before external confidence language is approved.",
        owner: "Model QA Lead",
        due: "Before weekly close",
        status: "pending",
      }),
    ]),
    makeSection("blockers_and_mitigations", "Blockers & Mitigations", [
      createRiskBlock({
        level: cleanText(governance?.confidenceBand || "unknown"),
        summary: cleanText(governance?.topWarning || "No governance blocker recorded."),
        mitigation: "Close warning-linked assumptions and rerun diagnostics before the weekly readout is finalized.",
      }),
      createRiskBlock({
        level: cleanText(weather?.fieldExecutionRisk || "unknown"),
        summary: "Weather may compress planned field throughput during this cycle.",
        mitigation: cleanText(weather?.recommendedAction || "Prepare channel fallback and timing contingency for high-risk windows."),
      }),
      createRecommendationBlock({
        priority: "High",
        text: "Do not treat unresolved blockers as background noise; either close them or explicitly downgrade claim strength.",
        rationale: "Weekly plans fail when blockers are acknowledged but not operationally resolved.",
      }),
    ]),
  ];
}

