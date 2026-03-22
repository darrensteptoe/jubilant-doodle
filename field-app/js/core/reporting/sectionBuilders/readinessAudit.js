// @ts-check

import {
  buildMetricRow,
  createActionOwnerBlock,
  createConfidenceMethodologyBlock,
  createHeadlineBlock,
  createMetricGridBlock,
  createRecommendationBlock,
  createRiskBlock,
  createStatusBlock,
  fmtMetric,
  fmtWhole,
  makeSection,
} from "./common.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function buildReadinessAuditSections(context) {
  const metrics = context?.metrics?.metrics || {};
  const governance = context?.assurance?.governance || {};
  const audit = context?.assurance?.audit || {};
  const recovery = context?.assurance?.recovery || {};

  return [
    makeSection("readiness_status", "Readiness Status", [
      createHeadlineBlock({
        headline: "Readiness Audit",
        subheadline:
          "Readiness is about trust under pressure: ownership clarity, current diagnostics, and confidence that the campaign is acting on validated inputs.",
        tone: "assurance",
      }),
      createMetricGridBlock({
        title: "Readiness indicators",
        metrics: [
          buildMetricRow("Outcome confidence", fmtMetric(metrics?.outcomeConfidence?.value, 2)),
          buildMetricRow("Election benchmark quality", fmtMetric(metrics?.electionBenchmarkQuality?.value, 2)),
          buildMetricRow("Contract findings", fmtWhole(audit?.contractFindingCount)),
          buildMetricRow("Archive entries", fmtWhole(context?.archive?.entryCount)),
        ],
      }),
      createStatusBlock({
        label: "Governance posture",
        value: cleanText(governance?.confidenceBand || "unknown"),
        note: cleanText(governance?.topWarning || "No governance warning recorded."),
      }),
    ]),
    makeSection("quality_gaps", "Quality & Governance Gaps", [
      createRiskBlock({
        level: audit?.hasValidationSnapshot ? "tracked" : "missing",
        summary: audit?.hasValidationSnapshot ? "Validation snapshot is present." : "Validation snapshot is missing.",
        mitigation: "Keep validation artifacts current for every reporting cycle and assumption revision.",
      }),
      createRiskBlock({
        level: audit?.hasRealismSnapshot ? "tracked" : "missing",
        summary: audit?.hasRealismSnapshot ? "Realism snapshot is present." : "Realism snapshot is missing.",
        mitigation: "Run realism diagnostics whenever assumptions or operational constraints materially change.",
      }),
      createRiskBlock({
        level: recovery?.strictImport ? "strict" : "lenient",
        summary: recovery?.strictImport ? "Strict import mode is enabled." : "Strict import mode is disabled.",
        mitigation: "Use strict mode for client-facing checkpoints and high-significance decision windows.",
      }),
    ]),
    makeSection("corrective_actions", "Corrective Actions", [
      createRecommendationBlock({
        priority: "P1",
        text: "Close governance warnings before approving external confidence language.",
        rationale: "Unresolved governance issues weaken the credibility of strategic claims.",
      }),
      createRecommendationBlock({
        priority: "P2",
        text: "Treat missing validation/realism snapshots as blockers for high-risk strategy pivots.",
        rationale: "Execution and confidence claims should not outrun available diagnostics.",
      }),
      createActionOwnerBlock({
        action: "Refresh validation + realism snapshots",
        owner: "Model QA Lead",
        due: "Before next report cycle",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Confirm archive/recovery metadata completeness",
        owner: "Data Operations",
        due: "Before weekly freeze",
        status: "pending",
      }),
    ]),
    makeSection("methodology", "Methodology", [
      createConfidenceMethodologyBlock({
        confidenceBand: cleanText(governance?.confidenceBand || "unknown"),
        score: fmtMetric(metrics?.outcomeConfidence?.value, 2),
        methodologyNotes: [
          "Readiness scoring uses canonical ownership, diagnostics, and selector-derived outputs.",
          "Contract findings and snapshot coverage are surfaced directly; no page-local reporting cache is used as truth.",
          "Readiness should be interpreted as decision reliability, not output polish.",
        ],
        caveats: [
          cleanText(governance?.topWarning || "No governance caveat recorded."),
          recovery?.strictImport ? "Strict import is enabled." : "Strict import is disabled.",
        ],
      }),
    ]),
  ];
}

