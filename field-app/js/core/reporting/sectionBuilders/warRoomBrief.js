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
        subheadline:
          "Use this brief for immediate 24-72 hour operating decisions. Items listed here should affect deployment timing, escalation, or follow-up ownership now.",
        tone: "operational",
      }),
      createMetricGridBlock({
        title: "Immediate decision signals",
        metrics: [
          { label: "Outcome confidence", value: fmtMetric(metrics?.outcomeConfidence?.value, 2) },
          { label: "Targeting score", value: fmtMetric(metrics?.targetingScore?.value, 2) },
          { label: "Open follow-ups", value: fmtWhole(events?.openFollowUps) },
          { label: "Applied events", value: fmtWhole(events?.appliedEvents) },
        ],
      }),
      createStatusBlock({
        label: "Weather execution status",
        value: `${cleanText(weather?.fieldExecutionRisk || "unknown")} risk (${cleanText(weather?.selectedZip || "zip unset")})`,
        note: cleanText(weather?.recommendedAction || "No weather recommendation recorded."),
      }),
    ]),
    makeSection("risks_next_7_days", "Risks Next 7 Days", [
      createRiskBlock({
        level: cleanText(weather?.fieldExecutionRisk || "unknown"),
        summary: "Field execution exposure in the next operating window.",
        mitigation: cleanText(weather?.recommendedAction || "Refresh weather context and align shift/channel fallback now."),
      }),
      createRiskBlock({
        level: cleanText(governance?.confidenceBand || "unknown"),
        summary: cleanText(governance?.topWarning || "No governance warning recorded."),
        mitigation: "Do not escalate confidence language until warning-linked assumptions are closed.",
      }),
      createRiskBlock({
        level: Number(events?.openFollowUps || 0) > 0 ? "watch" : "tracked",
        summary: `${fmtWhole(events?.openFollowUps)} open follow-up(s) can stale assumptions before the next run window.`,
        mitigation: "Close model-impacting follow-ups before approving deployment timing changes.",
      }),
      createRecommendationBlock({
        priority: "Immediate",
        text: "If assumptions are stale, hold aggressive pivots and run a fast verification cycle first.",
        rationale: "War-room speed is useful only when assumptions are current and trusted.",
      }),
    ]),
    makeSection("actions_owners", "Actions & Owners", [
      createActionOwnerBlock({
        action: "Execute weather contingency review and confirm fallback channels.",
        owner: "War Room Director",
        due: "24 hours",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Close open model-impacting follow-ups and confirm owners.",
        owner: "Operations Lead",
        due: "24 hours",
        status: "in_progress",
      }),
      createActionOwnerBlock({
        action: "Confirm any confidence-language restrictions for leadership update.",
        owner: "Model Lead",
        due: "Before next briefing",
        status: "pending",
      }),
    ]),
    makeSection("delta_since_prior", "Delta Since Prior Snapshot", [
      createTrendBlock({
        label: "What moved",
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

