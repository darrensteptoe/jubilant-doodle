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
  fmtPercentFromUnit,
  fmtSignedDelta,
  fmtWhole,
  makeSection,
} from "./common.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

export function deriveInternalDecisionNarrative(context = {}) {
  const metrics = asObject(context?.metrics?.metrics);
  const targeting = asObject(context?.selectors?.targetingDerived);
  const outcome = asObject(context?.selectors?.outcomeDerived);
  const district = asObject(context?.selectors?.districtDerived);
  const election = asObject(context?.electionDataInfluence);
  const governance = asObject(context?.assurance?.governance);
  const electionRecommendations = asObject(election?.downstreamRecommendations);
  const districtRecommendation = asObject(electionRecommendations?.district);
  const outcomeRecommendation = asObject(electionRecommendations?.outcome);

  const winProb = toFinite(outcome?.mcSummary?.winProb, null);
  const marginBandWidth = toFinite(outcome?.mcSummary?.marginBandWidth, null);
  const expectedMargin = toFinite(outcome?.mcSummary?.expectedMargin, null);
  const topDriver = cleanText(outcome?.sensitivitySummary?.topDriver);
  const persuasionNeed = toFinite(metrics?.persuasionNeed?.value, null);
  const baselineSupport = toFinite(metrics?.baselineSupport?.value, null);
  const outcomeConfidence = toFinite(metrics?.outcomeConfidence?.value, null);
  const benchmarkQuality = toFinite(metrics?.electionBenchmarkQuality?.value, null);
  const targetingDelta = firstMetricDelta(context, "targetingScore");
  const confidenceDelta = firstMetricDelta(context, "outcomeConfidence");
  const benchmarkDelta = firstMetricDelta(context, "electionBenchmarkQuality");
  const staleTargeting = !!targeting?.status?.staleSinceUpstreamChange;
  const turnoutCoverage = toFinite(targeting?.electionInfluence?.turnoutBoostCoverageRatio, null);
  const confidenceBand = cleanText(election?.confidenceBand || governance?.confidenceBand || "unknown").toLowerCase();
  const comparablePoolCount = toFinite(election?.comparablePoolCount, null);
  const hasTurnoutAnchors = !!district?.turnoutSnapshot?.hasTurnoutAnchors;

  let binding = "";
  if (staleTargeting) {
    binding = "Targeting is stale relative to upstream district/census/election changes.";
  } else if (winProb != null && winProb < 0.5) {
    binding = `Outcome path is below coin-flip (${fmtPercentFromUnit(winProb, 1)} win probability).`;
  } else if (persuasionNeed != null && persuasionNeed >= 2500) {
    binding = `Persuasion requirement remains large (${fmtWhole(persuasionNeed)} net votes).`;
  } else if (confidenceBand === "low" || confidenceBand === "critical") {
    binding = `Historical grounding confidence is ${confidenceBand.toUpperCase()}.`;
  } else if (!hasTurnoutAnchors) {
    binding = "Turnout anchors are incomplete for this scenario.";
  } else {
    binding = "No single hard bottleneck is dominant in the current snapshot.";
  }

  const leverageSignals = [];
  if (toFinite(targetingDelta?.delta, null) != null && Number(targetingDelta.delta) > 0) {
    leverageSignals.push(`targeting score is improving (${fmtSignedDelta(targetingDelta.delta, 3)})`);
  }
  if (toFinite(confidenceDelta?.delta, null) != null && Number(confidenceDelta.delta) > 0) {
    leverageSignals.push(`outcome confidence is improving (${fmtSignedDelta(confidenceDelta.delta, 3)})`);
  }
  if (turnoutCoverage != null && turnoutCoverage >= 0.35) {
    leverageSignals.push(`turnout-opportunity overlap is usable (${fmtPercentFromUnit(turnoutCoverage, 0)} of current targeting rows)`);
  }
  if (topDriver) {
    leverageSignals.push(`top sensitivity driver is identified (${topDriver})`);
  }
  if (benchmarkQuality != null && benchmarkQuality >= 0.65 && (confidenceBand === "high" || confidenceBand === "medium")) {
    leverageSignals.push(`benchmark quality is decision-usable (${benchmarkQuality.toFixed(2)})`);
  }
  const improving = leverageSignals.length
    ? leverageSignals.slice(0, 2).join("; ")
    : "";

  const fragileSignals = [];
  if (marginBandWidth != null && marginBandWidth >= 4) {
    fragileSignals.push(`outcome spread is wide (${fmtMetric(marginBandWidth, 2)} margin band width)`);
  }
  if (outcomeConfidence != null && outcomeConfidence < 0.55) {
    fragileSignals.push(`outcome confidence is low (${fmtMetric(outcomeConfidence, 2)})`);
  }
  if (staleTargeting) {
    fragileSignals.push("targeting priorities may be stale against upstream revisions");
  }
  if (confidenceBand === "low" || confidenceBand === "critical") {
    fragileSignals.push(`benchmark confidence is ${confidenceBand.toUpperCase()}`);
  }
  if (comparablePoolCount != null && comparablePoolCount > 0 && comparablePoolCount < 2) {
    fragileSignals.push(`comparable pool depth is thin (${fmtWhole(comparablePoolCount)})`);
  }
  if (expectedMargin != null && expectedMargin >= -1 && expectedMargin <= 1) {
    fragileSignals.push("expected margin sits near zero");
  }
  const fragile = fragileSignals.length
    ? fragileSignals.slice(0, 2).join("; ")
    : "";

  const benchmarkSignals = [];
  const benchmarkBaselineSupport = toFinite(districtRecommendation?.baselineSupport, null);
  const benchmarkConfidenceFloor = toFinite(outcomeRecommendation?.confidenceFloor, null);
  if (baselineSupport != null && benchmarkBaselineSupport != null) {
    const baselineGap = baselineSupport - benchmarkBaselineSupport;
    if (Math.abs(baselineGap) >= 3) {
      benchmarkSignals.push(
        `baseline support is ${fmtMetric(baselineSupport, 1, "%")} vs benchmark ${fmtMetric(benchmarkBaselineSupport, 1, "%")}`,
      );
    }
  }
  if (winProb != null && benchmarkConfidenceFloor != null) {
    const confidenceGap = winProb - benchmarkConfidenceFloor;
    if (Math.abs(confidenceGap) >= 0.12) {
      benchmarkSignals.push(
        `modeled win probability is ${fmtPercentFromUnit(winProb, 1)} vs benchmark confidence floor ${fmtPercentFromUnit(benchmarkConfidenceFloor, 1)}`,
      );
    }
  }
  const benchmarkDivergence = benchmarkSignals.length
    ? `${benchmarkSignals.slice(0, 2).join("; ")}. Treat this as calibration tension, not current-voter truth.`
    : "";

  const nextSteps = [];
  if (winProb != null && winProb < 0.55) {
    nextSteps.push("Validate turnout and persuasion assumptions before external confidence framing.");
  }
  if (staleTargeting || (turnoutCoverage != null && turnoutCoverage < 0.2)) {
    nextSteps.push("Refresh targeting and tighten the slate around stable priority and turnout-opportunity geographies.");
  }
  if (benchmarkDivergence) {
    nextSteps.push("Reconcile benchmark-vs-live assumption gaps and document rationale before changing calibration.");
  }
  if (fragileSignals.length) {
    nextSteps.push("Stress-test the top driver and re-run MC before major reallocations.");
  }
  if (toFinite(benchmarkDelta?.delta, null) != null && Number(benchmarkDelta.delta) < 0) {
    nextSteps.push("Improve benchmark data quality before relying on historical comparisons for major decisions.");
  }
  if (!nextSteps.length) {
    nextSteps.push("Maintain current plan and continue weekly validation of key assumptions.");
  }

  return {
    binding,
    improving,
    fragile,
    benchmarkDivergence,
    nextSteps: nextSteps.slice(0, 3),
  };
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
  const decisionNarrative = deriveInternalDecisionNarrative(context);
  const decisionRows = [
    { label: "What is binding", value: decisionNarrative.binding || "No clear binding signal." },
  ];
  if (decisionNarrative.improving) {
    decisionRows.push({ label: "What is improving / leverage", value: decisionNarrative.improving });
  }
  if (decisionNarrative.fragile) {
    decisionRows.push({ label: "What is fragile", value: decisionNarrative.fragile });
  }
  if (decisionNarrative.benchmarkDivergence) {
    decisionRows.push({ label: "Benchmark divergence", value: decisionNarrative.benchmarkDivergence });
  }
  if (decisionNarrative.nextSteps.length) {
    decisionRows.push({ label: "What to do next", value: decisionNarrative.nextSteps.join(" ") });
  }

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
      title: "Decision Narrative Layer",
      rows: decisionRows,
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
