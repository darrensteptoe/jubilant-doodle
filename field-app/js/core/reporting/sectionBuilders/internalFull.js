// @ts-check

import {
  buildMetricRow,
  createActionOwnerBlock,
  createAppendixBlock,
  createBenchmarkBlock,
  createConfidenceMethodologyBlock,
  createHeadlineBlock,
  createMetricGridBlock,
  createRecommendationBlock,
  createRiskBlock,
  createStatusBlock,
  createTrendBlock,
  firstMetricDelta,
  fmtMetric,
  fmtPercentFromUnit,
  fmtSignedDelta,
  fmtWhole,
  makeSection,
} from "./common.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function buildInternalFullSections(context) {
  const campaignName = cleanText(context?.context?.campaignName || context?.context?.campaignId || "Campaign");
  const officeId = cleanText(context?.context?.officeId || "office");
  const scenarioId = cleanText(context?.context?.scenarioId || "scenario");
  const metrics = context?.metrics?.metrics || {};

  const baselineSupport = metrics?.baselineSupport?.value;
  const turnoutExpected = metrics?.turnoutExpected?.value;
  const persuasionNeed = metrics?.persuasionNeed?.value;
  const targetingScore = metrics?.targetingScore?.value;
  const outcomeConfidence = metrics?.outcomeConfidence?.value;
  const benchmarkQuality = metrics?.electionBenchmarkQuality?.value;

  const targetingDelta = firstMetricDelta(context, "targetingScore");
  const confidenceDelta = firstMetricDelta(context, "outcomeConfidence");
  const qualityDelta = firstMetricDelta(context, "electionBenchmarkQuality");

  const election = context?.electionDataInfluence || {};
  const weather = context?.operations?.weatherRisk || {};
  const events = context?.operations?.eventCalendar || {};
  const governance = context?.assurance?.governance || {};
  const audit = context?.assurance?.audit || {};

  const sections = [];

  sections.push(
    makeSection("situation_snapshot", "Situation Snapshot", [
      createHeadlineBlock({
        headline: `${campaignName} · ${officeId}`,
        subheadline: `Scenario ${scenarioId} · Internal operating view`,
        tone: "operational",
      }),
      createMetricGridBlock({
        title: "Strategic metrics",
        metrics: [
          buildMetricRow("Baseline support", fmtMetric(baselineSupport, 1, "%")),
          buildMetricRow("Turnout expected", fmtMetric(turnoutExpected, 1, "%")),
          buildMetricRow("Persuasion need", fmtWhole(persuasionNeed)),
          buildMetricRow("Targeting score", fmtMetric(targetingScore, 2)),
          buildMetricRow("Outcome confidence", fmtMetric(outcomeConfidence, 2)),
          buildMetricRow("Election benchmark quality", fmtMetric(benchmarkQuality, 2)),
        ],
      }),
      createTrendBlock({
        label: "Change since prior report",
        rows: [
          {
            metric: "Targeting score",
            delta: fmtSignedDelta(targetingDelta?.delta, 3),
            direction: cleanText(targetingDelta?.direction || "flat"),
          },
          {
            metric: "Outcome confidence",
            delta: fmtSignedDelta(confidenceDelta?.delta, 3),
            direction: cleanText(confidenceDelta?.direction || "flat"),
          },
          {
            metric: "Election benchmark quality",
            delta: fmtSignedDelta(qualityDelta?.delta, 3),
            direction: cleanText(qualityDelta?.direction || "flat"),
          },
        ],
      }),
    ]),
  );

  sections.push(
    makeSection("operational_risk", "Operational Risk & Diagnostics", [
      createStatusBlock({
        label: "Governance confidence",
        value: cleanText(governance?.confidenceBand || "unknown"),
        note: cleanText(governance?.topWarning || "No top warning recorded."),
      }),
      createRiskBlock({
        level: cleanText(weather?.fieldExecutionRisk || "unknown"),
        summary: `Weather execution risk in ${cleanText(weather?.selectedZip || "unset ZIP")}`,
        mitigation: cleanText(weather?.recommendedAction || "Set and refresh weather context before next deployment."),
      }),
      createRiskBlock({
        level: audit?.hasValidationSnapshot ? "tracked" : "missing",
        summary: audit?.hasValidationSnapshot
          ? "Validation snapshot present."
          : "Validation snapshot missing.",
        mitigation: audit?.hasValidationSnapshot
          ? "Keep readiness diagnostics updated on each model commit."
          : "Run validation and readiness diagnostics before external delivery.",
      }),
      createRiskBlock({
        level: cleanText(election?.confidenceBand || "unknown"),
        summary: `Election data quality score ${fmtMetric(election?.qualityScore, 2)}`,
        mitigation: cleanText(election?.importStatus) === "imported"
          ? "Maintain mapping/reconciliation QA for each import cycle."
          : "Import and reconcile election rows before downstream calibration.",
      }),
      createStatusBlock({
        label: "War room operations",
        value: `${fmtWhole(events?.totalEvents)} event(s), ${fmtWhole(events?.openFollowUps)} open follow-up(s)`,
        note: `${fmtWhole(events?.appliedEvents)} event(s) currently applied to model context.`,
      }),
    ]),
  );

  sections.push(
    makeSection("election_benchmark_intelligence", "Election Data Benchmark Intelligence", [
      createBenchmarkBlock({
        label: "Election import status",
        value: cleanText(election?.importStatus || "unknown"),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.rowCount)} normalized row(s) from latest import.`,
      }),
      createBenchmarkBlock({
        label: "Comparable race pools",
        value: fmtWhole(election?.comparablePoolCount),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.historicalBenchmarkCount)} historical benchmark row(s) and ${fmtWhole(election?.turnoutBaselineCount)} turnout baseline row(s).`,
      }),
      createBenchmarkBlock({
        label: "Downstream recommendation coverage",
        value: `${fmtWhole(election?.recommendationTargets?.district)} district / ${fmtWhole(election?.recommendationTargets?.targeting)} targeting / ${fmtWhole(election?.recommendationTargets?.outcome)} outcome`,
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Election data recommendations are wired for district baselines, targeting priors, and outcome confidence.",
      }),
    ]),
  );

  sections.push(
    makeSection("recommended_actions", "Recommended Actions", [
      createRecommendationBlock({
        priority: "P1",
        text: cleanText(governance?.topWarning)
          ? `Resolve governance warning: ${cleanText(governance?.topWarning)}`
          : "Maintain governance confidence by preserving selector/action contract discipline.",
        rationale: "Governance warnings directly affect confidence framing for decisions and external reporting.",
      }),
      createRecommendationBlock({
        priority: "P1",
        text: cleanText(election?.confidenceBand) === "high"
          ? "Apply election-data benchmark suggestions to targeting and outcome refresh cadence."
          : "Increase election-data import quality and reconciliation coverage before relying on benchmark priors.",
        rationale: "Election data quality and benchmark breadth materially influence targeting score and confidence outputs.",
      }),
      createActionOwnerBlock({
        action: "Run weekly targeting refresh with election/census upstream checks",
        owner: "Targeting Lead",
        due: "Next 7 days",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Review weather + event model application before next field launch",
        owner: "War Room Director",
        due: "Before next deployment",
        status: "in_progress",
      }),
    ]),
  );

  sections.push(
    makeSection("confidence_methodology", "Confidence & Methodology", [
      createConfidenceMethodologyBlock({
        confidenceBand: cleanText(governance?.confidenceBand || election?.confidenceBand || "unknown"),
        score: fmtMetric(outcomeConfidence, 2),
        methodologyNotes: [
          "All report values are selected from canonical state domains through canonical/derived selector contracts.",
          "No page-local render cache is used as control truth in reporting context assembly.",
          "Metric provenance tracks canonical slices, selector source, and recompute timestamps.",
        ],
        caveats: [
          cleanText(governance?.topWarning || "No governance caveat recorded."),
          audit?.hasRealismSnapshot ? "Realism snapshot present." : "Realism snapshot unavailable.",
        ],
      }),
      createAppendixBlock({
        title: "Archive & recovery metadata",
        rows: [
          { label: "Archive selected hash", value: cleanText(context?.archive?.selectedHash || "") || "—" },
          { label: "Archive entry count", value: fmtWhole(context?.archive?.entryCount) },
          { label: "Strict import mode", value: context?.assurance?.recovery?.strictImport ? "enabled" : "disabled" },
          { label: "USB connected", value: context?.assurance?.recovery?.usbConnected ? "yes" : "no" },
          { label: "Snapshot reference", value: cleanText(context?.sourceReferences?.snapshotHash || "") || "—" },
        ],
      }),
    ]),
  );

  return sections;
}
