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
        subheadline: "Ownership, diagnostics, and confidence checks before decision delivery.",
        tone: "assurance",
      }),
      createMetricGridBlock({
        title: "Audit indicators",
        metrics: [
          buildMetricRow("Outcome confidence", fmtMetric(metrics?.outcomeConfidence?.value, 2)),
          buildMetricRow("Election benchmark quality", fmtMetric(metrics?.electionBenchmarkQuality?.value, 2)),
          buildMetricRow("Contract findings", fmtWhole(audit?.contractFindingCount)),
          buildMetricRow("Archive entries", fmtWhole(context?.archive?.entryCount)),
        ],
      }),
      createStatusBlock({
        label: "Governance",
        value: cleanText(governance?.confidenceBand || "unknown"),
        note: cleanText(governance?.topWarning || "No governance warning recorded."),
      }),
    ]),
    makeSection("quality_gaps", "Quality / Governance Gaps", [
      createRiskBlock({
        level: audit?.hasValidationSnapshot ? "tracked" : "missing",
        summary: audit?.hasValidationSnapshot ? "Validation snapshot present" : "Validation snapshot missing",
        mitigation: "Keep validation artifacts current for each reporting cycle.",
      }),
      createRiskBlock({
        level: audit?.hasRealismSnapshot ? "tracked" : "missing",
        summary: audit?.hasRealismSnapshot ? "Realism snapshot present" : "Realism snapshot missing",
        mitigation: "Run realism diagnostics when assumptions change.",
      }),
      createRiskBlock({
        level: recovery?.strictImport ? "strict" : "lenient",
        summary: recovery?.strictImport ? "Strict import mode enabled" : "Strict import mode disabled",
        mitigation: "Use strict mode for client-facing milestone checkpoints.",
      }),
    ]),
    makeSection("corrective_actions", "Corrective Actions", [
      createRecommendationBlock({
        priority: "P1",
        text: "Close governance warnings before approving client-facing confidence language.",
        rationale: "Governance warnings indicate unresolved assumptions or data quality caveats.",
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
          "Audit report uses canonical ownership + selector-derived outputs only.",
          "Contract findings and diagnostics snapshots are surfaced without recomputing page-local state.",
        ],
        caveats: [
          cleanText(governance?.topWarning || "No governance caveat recorded."),
          recovery?.strictImport ? "Strict import is enabled." : "Strict import is disabled.",
        ],
      }),
    ]),
  ];
}
