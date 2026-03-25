// @ts-check

import {
  buildMetricRow,
  createAppendixBlock,
  createBenchmarkBlock,
  createConfidenceMethodologyBlock,
  createHeadlineBlock,
  createMetricGridBlock,
  createRecommendationBlock,
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

export function buildClientStandardSections(context) {
  const campaignName = cleanText(context?.context?.campaignName || context?.context?.campaignId || "Campaign");
  const metrics = context?.metrics?.metrics || {};
  const election = context?.electionDataInfluence || {};
  const governance = context?.assurance?.governance || {};
  const officeAwareLines = listOfficeAwareReportLines(context);

  const winConfidence = metrics?.outcomeConfidence?.value;
  const baselineSupport = metrics?.baselineSupport?.value;
  const turnoutExpected = metrics?.turnoutExpected?.value;
  const targetingScore = metrics?.targetingScore?.value;

  const confidenceDelta = firstMetricDelta(context, "outcomeConfidence");
  const targetingDelta = firstMetricDelta(context, "targetingScore");

  const confidenceFrameBlocks = [
    createConfidenceMethodologyBlock({
      confidenceBand: cleanText(governance?.confidenceBand || election?.confidenceBand || "unknown"),
      score: fmtMetric(winConfidence, 2),
      methodologyNotes: [
        "Confidence reflects how strongly major evidence streams point in the same direction.",
        "Confidence is a guide to decision quality, not a guarantee of outcome.",
        "Where confidence is lower, the right posture is narrower claims, stronger verification, and disciplined execution.",
      ],
      caveats: [
        cleanText(governance?.topWarning || "No active confidence caveat."),
      ],
    }),
  ];
  if (officeAwareLines.length){
    confidenceFrameBlocks.push(
      createAppendixBlock({
        title: "Office context framing",
        rows: officeAwareLines.map((line, index) => ({
          label: `Context ${index + 1}`,
          value: line,
        })),
      }),
    );
  }

  return [
    makeSection("what_matters_now", "What Matters Now", [
      createHeadlineBlock({
        headline: `${campaignName} strategic update`,
        subheadline:
          "This brief summarizes current position, what changed since the last review, and where leadership attention should focus next.",
        tone: "strategic",
      }),
      createMetricGridBlock({
        title: "Current strategic position",
        metrics: [
          buildMetricRow("Baseline support", fmtMetric(baselineSupport, 1, "%"), {
            note: "Current standing.",
          }),
          buildMetricRow("Turnout expected", fmtMetric(turnoutExpected, 1, "%"), {
            note: "Expected participation environment.",
          }),
          buildMetricRow("Targeting score", fmtMetric(targetingScore, 2), {
            note: "Efficiency of current targeting posture.",
          }),
          buildMetricRow("Confidence", fmtMetric(winConfidence, 2), {
            note: "Confidence in the current strategic path.",
          }),
        ],
      }),
      createTrendBlock({
        label: "Change since prior update",
        rows: [
          {
            metric: "Confidence",
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
    makeSection("strategic_position", "Strategic Position", [
      createBenchmarkBlock({
        label: "Election benchmark quality",
        value: fmtMetric(election?.qualityScore, 2),
        confidence: cleanText(election?.confidenceBand || "unknown"),
        note: `${fmtWhole(election?.comparablePoolCount)} comparable pools and ${fmtWhole(election?.turnoutBaselineCount)} turnout baseline rows are informing this read.`,
      }),
      createBenchmarkBlock({
        label: "Primary caution",
        value: cleanText(governance?.topWarning || "No active caution."),
        confidence: cleanText(governance?.confidenceBand || "unknown"),
        note:
          "Current standing should be interpreted together with evidence quality. Where evidence is weaker, strategy should remain disciplined and provisional.",
      }),
    ]),
    makeSection("top_recommendations", "Top Recommendations", [
      createRecommendationBlock({
        priority: "High",
        text: "Concentrate effort where the campaign has the clearest path to incremental gain.",
        rationale: "Current targeting posture and turnout environment favor disciplined concentration over broad expansion.",
      }),
      createRecommendationBlock({
        priority: "High",
        text:
          cleanText(election?.confidenceBand) === "high"
            ? "Use benchmark-calibrated assumptions in the next planning cycle while preserving execution discipline in priority geographies."
            : "Avoid broad expansion until benchmark quality improves and the next refresh confirms movement is holding.",
        rationale: "Benchmark confidence determines how strongly historical priors should shape near-term strategy.",
      }),
      createRecommendationBlock({
        priority: "Medium",
        text: "Preserve follow-through in highest-priority geographies before adding new universes.",
        rationale: "Execution continuity often outperforms rapid expansion when confidence is mixed.",
      }),
    ]),
    makeSection("confidence_frame", "Confidence Frame", [
      ...confidenceFrameBlocks,
    ]),
  ];
}
