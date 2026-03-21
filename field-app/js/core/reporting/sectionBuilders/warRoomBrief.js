// @ts-check

import {
  createActionOwnerBlock,
  createHeadlineBlock,
  createMetricGridBlock,
  createRecommendationBlock,
  createRiskBlock,
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

export function buildWarRoomBriefSections(context) {
  const metrics = context?.metrics?.metrics || {};
  const weather = context?.operations?.weatherRisk || {};
  const events = context?.operations?.eventCalendar || {};
  const governance = context?.assurance?.governance || {};
  const confidenceDelta = firstMetricDelta(context, "outcomeConfidence");
  const targetingDelta = firstMetricDelta(context, "targetingScore");

  return [
    makeSection("immediate_picture", "Immediate Picture", [
      createHeadlineBlock({
        headline: "War Room Brief",
        subheadline: "Current risk, next actions, and confidence drift.",
        tone: "operational",
      }),
      createMetricGridBlock({
        title: "Immediate metrics",
        metrics: [
          { label: "Outcome confidence", value: fmtMetric(metrics?.outcomeConfidence?.value, 2) },
          { label: "Targeting score", value: fmtMetric(metrics?.targetingScore?.value, 2) },
          { label: "Open follow-ups", value: fmtWhole(events?.openFollowUps) },
          { label: "Applied events", value: fmtWhole(events?.appliedEvents) },
        ],
      }),
      createStatusBlock({
        label: "Weather status",
        value: `${cleanText(weather?.fieldExecutionRisk || "unknown")} risk (${cleanText(weather?.selectedZip || "zip unset")})`,
        note: cleanText(weather?.recommendedAction || "No weather recommendation recorded."),
      }),
    ]),
    makeSection("risks_next_7_days", "Risks Next 7 Days", [
      createRiskBlock({
        level: cleanText(weather?.fieldExecutionRisk || "unknown"),
        summary: "Field execution weather exposure",
        mitigation: cleanText(weather?.recommendedAction || "Run weather refresh and align event cadence."),
      }),
      createRiskBlock({
        level: cleanText(governance?.confidenceBand || "unknown"),
        summary: cleanText(governance?.topWarning || "No governance warning recorded."),
        mitigation: "Keep decision assumptions and follow-up owners current.",
      }),
      createRecommendationBlock({
        priority: "Immediate",
        text: "Close open follow-ups tied to applied model events before next run window.",
        rationale: "Unresolved follow-ups can invalidate short-cycle war-room assumptions.",
      }),
    ]),
    makeSection("actions_owners", "Actions & Owners", [
      createActionOwnerBlock({
        action: "Execute weather contingency adjustment review",
        owner: "War Room Director",
        due: "24 hours",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Confirm model-impacting events and owners",
        owner: "Operations Lead",
        due: "24 hours",
        status: "in_progress",
      }),
    ]),
    makeSection("delta_since_prior", "Delta Since Prior Snapshot", [
      createTrendBlock({
        label: "Momentum change",
        rows: [
          {
            metric: "Outcome confidence",
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
  ];
}
