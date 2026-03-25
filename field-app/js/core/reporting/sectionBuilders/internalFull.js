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
  listOfficeAwareReportLines,
  fmtMetric,
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
  const officeAwareLines = listOfficeAwareReportLines(context);

  const sections = [];
  const situationBlocks = [
    createHeadlineBlock({
      headline: `${campaignName} · ${officeId}`,
      subheadline:
        `Scenario ${scenarioId} · Internal operating brief. Use this section to establish current position, what moved, and where attention is required next.`,
      tone: "operational",
    }),
    createMetricGridBlock({
      title: "Operating position (current read)",
      metrics: [
        buildMetricRow("Baseline support", fmtMetric(baselineSupport, 1, "%")),
        buildMetricRow("Turnout expected", fmtMetric(turnoutExpected, 1, "%")),
        buildMetricRow("Persuasion need", fmtWhole(persuasionNeed)),
        buildMetricRow("Targeting score", fmtMetric(targetingScore, 2)),
        buildMetricRow("Outcome confidence", fmtMetric(outcomeConfidence, 2)),
        buildMetricRow("Election benchmark quality", fmtMetric(benchmarkQuality, 2)),
      ],
    }),
    createAppendixBlock({
      title: "How to read these numbers",
      rows: [
        { label: "Baseline support", value: "Current floor, not ceiling. Treat it as today’s operating base." },
        { label: "Turnout expected", value: "Participation environment estimate, not guaranteed turnout." },
        { label: "Persuasion need", value: "Remaining persuadable universe that still matters to the path." },
        { label: "Targeting score", value: "Quality of current target concentration, not full campaign health." },
        { label: "Outcome confidence", value: "Confidence in the current path, not certainty of victory." },
        { label: "Election benchmark quality", value: "Reliability of historical comparison inputs feeding assumptions." },
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
  ];
  if (officeAwareLines.length){
    situationBlocks.push(
      createAppendixBlock({
        title: "Office context framing",
        rows: officeAwareLines.map((line, index) => ({
          label: `Context ${index + 1}`,
          value: line,
        })),
      }),
    );
  }
  sections.push(makeSection("situation_snapshot", "Situation Snapshot", situationBlocks));

  sections.push(
    makeSection("operational_risk", "Operational Risk & Diagnostics", [
      createStatusBlock({
        label: "Risk framing rule",
        value: "Only elevate risks that can change deployment, assumptions, or decision confidence this cycle.",
        note: "Use this section to identify what can materially distort execution or interpretation in the near term.",
      }),
      createRiskBlock({
        level: cleanText(governance?.confidenceBand || "unknown"),
        summary: cleanText(governance?.topWarning || "No active governance warning in this snapshot."),
        mitigation:
          "Resolve warning-linked assumptions before using strong confidence language in leadership or client settings.",
      }),
      createRiskBlock({
        level: cleanText(weather?.fieldExecutionRisk || "unknown"),
        summary: `Field execution exposure for ${cleanText(weather?.selectedZip || "unset ZIP")}.`,
        mitigation: cleanText(weather?.recommendedAction || "Refresh weather context before finalizing field timing."),
      }),
      createRiskBlock({
        level: cleanText(election?.confidenceBand || "unknown"),
        summary: `Election-data quality ${fmtMetric(election?.qualityScore, 2)} with ${fmtWhole(election?.comparablePoolCount)} comparable pool(s).`,
        mitigation:
          cleanText(election?.importStatus) === "imported"
            ? "Keep reconciliation QA and benchmark comparability checks current on each import cycle."
            : "Import and reconcile election rows before calibration or targeting reallocation decisions.",
      }),
      createRiskBlock({
        level: Number(events?.openFollowUps || 0) > 0 ? "watch" : "tracked",
        summary: `${fmtWhole(events?.openFollowUps)} open follow-up(s) across ${fmtWhole(events?.totalEvents)} event(s).`,
        mitigation: "Close model-impacting follow-ups before the next operating window to avoid stale assumptions.",
      }),
      createStatusBlock({
        label: "Diagnostics coverage",
        value: audit?.hasValidationSnapshot ? "Validation snapshot present." : "Validation snapshot missing.",
        note: audit?.hasRealismSnapshot
          ? "Realism snapshot present."
          : "Realism snapshot missing. Run realism diagnostics before high-significance commits.",
      }),
    ]),
  );

  sections.push(
    makeSection("election_benchmark_intelligence", "Election Data Benchmark Intelligence", [
      createBenchmarkBlock({
        label: "Election import status",
        value: cleanText(election?.importStatus || "unknown"),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.rowCount)} normalized row(s). Historical data only helps when comparable and clean.`,
      }),
      createBenchmarkBlock({
        label: "Comparable depth",
        value: fmtWhole(election?.comparablePoolCount),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note:
          `${fmtWhole(election?.historicalBenchmarkCount)} historical benchmark row(s), ${fmtWhole(election?.turnoutBaselineCount)} turnout baseline row(s).`,
      }),
      createBenchmarkBlock({
        label: "Downstream recommendation coverage",
        value:
          `${fmtWhole(election?.recommendationTargets?.district)} district / ${fmtWhole(election?.recommendationTargets?.targeting)} targeting / ${fmtWhole(election?.recommendationTargets?.outcome)} outcome`,
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: "Coverage indicates how fully benchmark intelligence is informing district assumptions, targeting priors, and outcome framing.",
      }),
    ]),
  );

  sections.push(
    makeSection("recommended_actions", "Recommended Actions", [
      createRecommendationBlock({
        priority: "P1",
        text: cleanText(governance?.topWarning)
          ? `Resolve governance warning before external confidence framing: ${cleanText(governance?.topWarning)}`
          : "Preserve governance discipline so confidence claims remain evidence-backed.",
        rationale: "Governance gaps weaken trust in both internal decisions and external narrative quality.",
      }),
      createRecommendationBlock({
        priority: "P2",
        text:
          cleanText(election?.confidenceBand) === "high"
            ? "Apply benchmark-calibrated assumptions in the next targeting and scenario refresh cycle."
            : "Increase election-data reconciliation depth before relying on benchmark-driven reallocations.",
        rationale: "Benchmark quality directly affects targeting priors and outcome confidence posture.",
      }),
      createRecommendationBlock({
        priority: "P3",
        text:
          Number(events?.openFollowUps || 0) > 0
            ? "Close open model-impacting event follow-ups before the next deployment decision."
            : "Maintain event/follow-up hygiene so war-room assumptions stay current between runs.",
        rationale: "Unresolved event context can silently stale execution assumptions.",
      }),
      createActionOwnerBlock({
        action: "Run targeting refresh after election/census upstream checks and note whether movement is broadening or concentrating.",
        owner: "Targeting Lead",
        due: "Next 7 days",
        status: "pending",
      }),
      createActionOwnerBlock({
        action: "Review weather-sensitive field goals and set contingency posture for next launch window.",
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
          "Confidence is a decision aid, not a certainty claim.",
          "Higher confidence indicates stronger coherence across evidence, assumptions, and diagnostics; it does not guarantee outcome.",
          "Lower confidence means leadership should narrow claims, verify assumptions, and avoid over-reading point estimates.",
          "All report values are assembled from canonical state domains and selector outputs.",
        ],
        caveats: [
          cleanText(governance?.topWarning || "No governance caveat recorded."),
          audit?.hasRealismSnapshot
            ? "Realism snapshot present."
            : "Realism snapshot unavailable.",
        ],
      }),
      createAppendixBlock({
        title: "Reporting provenance",
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
