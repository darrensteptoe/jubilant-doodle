// @ts-check
import { evaluateAssumptionRealism } from "./assumptionBaselines.js";
import { computeConfidenceProfile } from "./confidence.js";
import { computeLearningLoop } from "./learningLoop.js";
import { deriveOptimizationUpliftSignals } from "./optimize.js";
import { deriveUpliftSourceGovernanceSignal, formatUpliftSourceLabel, normalizeUpliftSource } from "./upliftSource.js";
import { deriveVoterModelSignals, extractCensusAgeDistribution } from "./voterDataLayer.js";
import {
  clampFiniteNumber,
  formatFixedNumber,
  formatPercentFromUnit,
  formatStatusWithScoreOutOfHundred,
  roundToDigits,
  roundWholeNumberByMode,
  safeNum,
} from "./utils.js";

export const MODEL_GOVERNANCE_VERSION = "1.0.0";

const toFiniteNumber = safeNum;
const clamp = clampFiniteNumber;

function parseDeltaWinPct(text){
  const raw = String(text == null ? "" : text).trim();
  const m = raw.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function deriveSensitivityDrivers(state){
  const rows = Array.isArray(state?.ui?.e4Sensitivity?.rows) ? state.ui.e4Sensitivity.rows : [];
  const parsed = rows
    .map((row) => {
      const deltaWinPct = parseDeltaWinPct(row?.dWin);
      return {
        label: String(row?.label || "Driver"),
        deltaWinPct,
        absDeltaWinPct: deltaWinPct == null ? null : Math.abs(deltaWinPct),
      };
    })
    .filter((row) => row.absDeltaWinPct != null)
    .sort((a, b) => (Number(b.absDeltaWinPct) - Number(a.absDeltaWinPct)))
    .slice(0, 3);
  return parsed;
}

function deriveDataQuality({
  benchmarkWarnings = [],
  evidenceWarnings = [],
  driftSummary = null,
  voterSignals = null,
  candidateHistory = null,
} = {}){
  const benchmarkCount = Array.isArray(benchmarkWarnings) ? benchmarkWarnings.length : 0;
  const evidenceCount = Array.isArray(evidenceWarnings) ? evidenceWarnings.length : 0;
  const issues = [];
  let penalty = 0;

  if (benchmarkCount > 0){
    penalty += Math.min(36, benchmarkCount * 9);
    issues.push(`${benchmarkCount} benchmark warning${benchmarkCount === 1 ? "" : "s"}`);
  }
  if (evidenceCount > 0){
    penalty += Math.min(36, evidenceCount * 12);
    issues.push(`${evidenceCount} evidence warning${evidenceCount === 1 ? "" : "s"}`);
  }

  const hasDrift = !!(driftSummary && driftSummary.hasLog);
  if (hasDrift){
    const checks = [
      { key: "CR", actual: toFiniteNumber(driftSummary.actualCR), assumed: toFiniteNumber(driftSummary.assumedCR) },
      { key: "SR", actual: toFiniteNumber(driftSummary.actualSR), assumed: toFiniteNumber(driftSummary.assumedSR) },
      { key: "APH", actual: toFiniteNumber(driftSummary.actualAPH), assumed: toFiniteNumber(driftSummary.expectedAPH) },
    ];
    for (const row of checks){
      if (row.actual == null || row.assumed == null || row.assumed <= 0) continue;
      if (row.actual < (row.assumed * 0.9)){
        penalty += 8;
        issues.push(`rolling ${row.key} below assumptions`);
      }
    }
  }

  const hasVoterRows = !!voterSignals?.hasRows;
  const voterRows = Math.max(0, toFiniteNumber(voterSignals?.totalRows) ?? 0);
  const voterGeoCoverage = clamp(toFiniteNumber(voterSignals?.coverage?.geoCoverageRate) ?? 0, 0, 1);
  const voterContactableRate = clamp(toFiniteNumber(voterSignals?.coverage?.contactableRate) ?? 0, 0, 1);
  const voterAgeCoverage = clamp(toFiniteNumber(voterSignals?.ageSegmentation?.knownAgeCoverageRate) ?? 0, 0, 1);
  const voterAgeSource = String(voterSignals?.ageSegmentation?.source || "unknown").trim().toLowerCase();

  if (!hasVoterRows){
    penalty += 18;
    issues.push("no canonical voter intelligence rows imported");
  } else {
    if (voterGeoCoverage < 0.5){
      penalty += 14;
      issues.push(`voter geography linkage coverage at ${formatPercentFromUnit(voterGeoCoverage, 0)}`);
    } else if (voterGeoCoverage < 0.7){
      penalty += 8;
      issues.push(`voter geography linkage coverage at ${formatPercentFromUnit(voterGeoCoverage, 0)}`);
    }
    if (voterContactableRate < 0.45){
      penalty += 12;
      issues.push(`contactable voter coverage at ${formatPercentFromUnit(voterContactableRate, 0)}`);
    } else if (voterContactableRate < 0.6){
      penalty += 6;
      issues.push(`contactable voter coverage at ${formatPercentFromUnit(voterContactableRate, 0)}`);
    }
    if (voterAgeSource === "unknown"){
      penalty += 10;
      issues.push("age segmentation unavailable (no DOB/age rows and no census fallback)");
    } else if (voterAgeCoverage < 0.45){
      penalty += 8;
      issues.push(`age cohort coverage at ${formatPercentFromUnit(voterAgeCoverage, 0)}`);
    } else if (voterAgeCoverage < 0.65){
      penalty += 4;
      issues.push(`age cohort coverage at ${formatPercentFromUnit(voterAgeCoverage, 0)}`);
    }
  }

  const history = candidateHistory && typeof candidateHistory === "object" ? candidateHistory : null;
  const historyRecordCount = Math.max(0, toFiniteNumber(history?.recordCount) ?? 0);
  const historyIncompleteCount = Math.max(0, toFiniteNumber(history?.incompleteRecordCount) ?? 0);
  const historyCoverageBand = String(history?.coverageBand || "").trim().toLowerCase();
  const historyConfidenceBand = String(history?.confidenceBand || "").trim().toLowerCase();

  if (historyRecordCount <= 0){
    penalty += 12;
    issues.push("candidate history baseline missing");
  } else {
    if (historyConfidenceBand === "low"){
      penalty += 10;
      issues.push(`candidate history confidence is low (${historyCoverageBand || "unknown"} coverage)`);
    } else if (historyConfidenceBand === "medium"){
      penalty += 5;
      issues.push(`candidate history confidence is medium (${historyCoverageBand || "unknown"} coverage)`);
    }
    if (historyIncompleteCount > 0){
      penalty += Math.min(8, historyIncompleteCount * 2);
      issues.push(`${historyIncompleteCount} candidate history row(s) incomplete`);
    }
  }

  const score = clamp(100 - penalty, 0, 100);
  const status = score < 55 ? "bad" : (score < 75 ? "warn" : "ok");
  return {
    score,
    status,
    issues,
    benchmarkCount,
    evidenceCount,
    voterRows,
    voterGeoCoverage,
    voterContactableRate,
    voterAgeCoverage,
    voterAgeSource,
  };
}

function deriveHistoricalAccuracyScore(state){
  const hist = state?.ui?.modelAudit;
  const within1 = toFiniteNumber(hist?.within1ptPct);
  const within2 = toFiniteNumber(hist?.within2ptPct);
  if (within1 == null && within2 == null) return 60;
  const s1 = within1 == null ? null : clamp(within1, 0, 100);
  const s2 = within2 == null ? null : clamp(within2, 0, 100);
  if (s1 != null && s2 != null){
    return roundToDigits((0.6 * s1 + 0.4 * s2), 1, 60);
  }
  return s1 != null ? s1 : s2;
}

function deriveExecutionReadiness(state){
  const timeline = state?.ui?.lastTimeline && typeof state.ui.lastTimeline === "object"
    ? state.ui.lastTimeline
    : {};
  const uplift = state?.ui?.lastSummary?.upliftSummary && typeof state.ui.lastSummary.upliftSummary === "object"
    ? state.ui.lastSummary.upliftSummary
    : {};
  const upliftSignals = deriveOptimizationUpliftSignals(uplift);

  const timelineExecutablePctRaw = toFiniteNumber(timeline?.percentPlanExecutable);
  const timelineExecutablePct = timelineExecutablePctRaw == null
    ? null
    : clamp(timelineExecutablePctRaw, 0, 1);
  const shortfallAttempts = Math.max(0, toFiniteNumber(timeline?.shortfallAttempts) ?? 0);
  const uncertaintyBand = String(upliftSignals?.uncertaintyBand || "").trim().toLowerCase();
  const saturationPressure = String(upliftSignals?.saturationPressure || "").trim().toLowerCase();
  const upliftSourceSignal = deriveUpliftSourceGovernanceSignal(upliftSignals?.source);
  const expectedMarginalGain = toFiniteNumber(upliftSignals?.expectedMarginalGain);
  const lowMarginalGain = toFiniteNumber(upliftSignals?.lowMarginalGain);

  const issues = [];
  let penalty = 0;

  if (timelineExecutablePct != null){
    if (timelineExecutablePct < 0.95){
      const pctShortfall = 1 - timelineExecutablePct;
      penalty += Math.min(44, pctShortfall * 50);
      issues.push(`timeline executable at ${formatPercentFromUnit(timelineExecutablePct, 0)}`);
    }
  } else {
    penalty += 6;
    issues.push("timeline executable % unavailable");
  }

  if (shortfallAttempts > 0){
    const roundedShortfall = roundWholeNumberByMode(shortfallAttempts, { mode: "round", fallback: 0 }) ?? 0;
    if (shortfallAttempts >= 1000) penalty += 20;
    else if (shortfallAttempts >= 250) penalty += 14;
    else penalty += 8;
    issues.push(`${roundedShortfall} attempt shortfall`);
  }

  if (uncertaintyBand === "high"){
    penalty += 18;
    issues.push("uplift uncertainty is high");
  } else if (uncertaintyBand === "medium"){
    penalty += 10;
    issues.push("uplift uncertainty is medium");
  } else if (uncertaintyBand === "low"){
    penalty += 2;
  } else {
    penalty += 5;
  }

  if (saturationPressure === "high"){
    penalty += 16;
    issues.push("channel saturation pressure is high");
  } else if (saturationPressure === "medium"){
    penalty += 8;
    issues.push("channel saturation pressure is medium");
  } else if (saturationPressure === "low"){
    penalty += 0;
  } else {
    penalty += 4;
  }

  if (upliftSourceSignal.penalty > 0){
    penalty += upliftSourceSignal.penalty;
    if (upliftSourceSignal.issue){
      issues.push(upliftSourceSignal.issue);
    }
  }

  const score = clamp(100 - penalty, 0, 100);
  const status = score < 55 ? "bad" : (score < 75 ? "warn" : "ok");
  return {
    score,
    status,
    timelineExecutablePct,
    shortfallAttempts,
    uplift: {
      source: upliftSourceSignal.source,
      uncertaintyBand: uncertaintyBand || "unknown",
      saturationPressure: saturationPressure || "unknown",
      expectedMarginalGain,
      lowMarginalGain,
    },
    issues,
  };
}

/**
 * Canonical compact governance projection for runtime bridges and archive snapshots.
 * Keeps governance field-shaping out of UI modules.
 *
 * @param {unknown} governance
 * @returns {{
 *   realismStatus: string,
 *   realismScore: number | null,
 *   dataQualityStatus: string,
 *   dataQualityScore: number | null,
 *   executionStatus: string,
 *   executionScore: number | null,
 *   executionTimelineExecutablePct: number | null,
 *   executionShortfallAttempts: number | null,
 *   executionUpliftUncertaintyBand: string,
 *   executionSaturationPressure: string,
 *   executionUpliftSource: string,
 *   executionTopIssue: string,
 *   confidenceBand: string,
 *   confidenceScore: number | null,
 *   topWarning: string,
 *   topSensitivityDriver: string,
 *   topSensitivityDeltaWinPct: number | null,
 *   learningSampleSize: number | null,
 *   learningTopSuggestion: string,
 *   learningRecommendation: string,
 * }}
 */
export function buildGovernanceSnapshotView(governance){
  const full = governance && typeof governance === "object" ? governance : {};
  const topDriver = Array.isArray(full?.sensitivity?.topDrivers) ? full.sensitivity.topDrivers[0] : null;
  return {
    realismStatus: String(full?.realism?.status || "").trim(),
    realismScore: toFiniteNumber(full?.realism?.score),
    dataQualityStatus: String(full?.dataQuality?.status || "").trim(),
    dataQualityScore: toFiniteNumber(full?.dataQuality?.score),
    executionStatus: String(full?.execution?.status || "").trim(),
    executionScore: toFiniteNumber(full?.execution?.score),
    executionTimelineExecutablePct: toFiniteNumber(full?.execution?.timelineExecutablePct),
    executionShortfallAttempts: toFiniteNumber(full?.execution?.shortfallAttempts),
    executionUpliftSource: normalizeUpliftSource(full?.execution?.uplift?.source),
    executionUpliftUncertaintyBand: String(full?.execution?.uplift?.uncertaintyBand || "").trim(),
    executionSaturationPressure: String(full?.execution?.uplift?.saturationPressure || "").trim(),
    executionTopIssue: Array.isArray(full?.execution?.issues) ? String(full.execution.issues[0] || "").trim() : "",
    confidenceBand: String(full?.confidence?.band || "").trim(),
    confidenceScore: toFiniteNumber(full?.confidence?.score),
    topWarning: Array.isArray(full?.warnings) ? String(full.warnings[0] || "").trim() : "",
    topSensitivityDriver: String(topDriver?.label || "").trim(),
    topSensitivityDeltaWinPct: toFiniteNumber(topDriver?.deltaWinPct),
    learningSampleSize: toFiniteNumber(full?.learning?.sampleSize),
    learningTopSuggestion: String(full?.learning?.topSuggestion?.label || "").trim(),
    learningRecommendation: String(full?.learning?.topSuggestion?.recommendation || "").trim(),
  };
}

function governanceStatusToKind(status, { warn = "warn", bad = "bad" } = {}){
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === bad) return "bad";
  if (normalized === warn) return "warn";
  return "ok";
}

/**
 * Canonical governance checklist rows for validation surfaces.
 * Keeps governance interpretation logic out of render-layer modules.
 *
 * @param {unknown} governance
 * @returns {Array<{ kind: "ok" | "warn" | "bad", text: string }>}
 */
export function buildGovernanceValidationChecklist(governance){
  const snapshot = buildGovernanceSnapshotView(governance);
  const list = [];
  const realismStatus = String(snapshot?.realismStatus || "ok");
  const dataStatus = String(snapshot?.dataQualityStatus || "ok");
  const confidenceBand = String(snapshot?.confidenceBand || "low");
  const executionStatus = String(snapshot?.executionStatus || "ok");
  const executionTimelineExecutable = toFiniteNumber(snapshot?.executionTimelineExecutablePct);
  const executionUncertaintyBand = String(snapshot?.executionUpliftUncertaintyBand || "").trim();
  const executionSaturationPressure = String(snapshot?.executionSaturationPressure || "").trim();
  const topDriverLabel = String(snapshot?.topSensitivityDriver || "").trim();
  const topDriverDelta = toFiniteNumber(snapshot?.topSensitivityDeltaWinPct);

  list.push({
    kind: governanceStatusToKind(realismStatus),
    text: `Governance realism: ${formatStatusWithScoreOutOfHundred(realismStatus, snapshot?.realismScore, 0)}.`,
  });
  list.push({
    kind: governanceStatusToKind(dataStatus),
    text: `Governance data quality: ${formatStatusWithScoreOutOfHundred(dataStatus, snapshot?.dataQualityScore, 0)}.`,
  });
  list.push({
    kind: confidenceBand === "low" ? "warn" : "ok",
    text: `Governance confidence: ${formatStatusWithScoreOutOfHundred(confidenceBand, snapshot?.confidenceScore, 1)}.`,
  });
  list.push({
    kind: governanceStatusToKind(executionStatus),
    text: `Governance execution realism: ${formatStatusWithScoreOutOfHundred(executionStatus, snapshot?.executionScore, 0)}.`,
  });
  if (Number.isFinite(executionTimelineExecutable)){
    list.push({
      kind: executionTimelineExecutable < 0.95 ? "warn" : "ok",
      text: `Timeline executable: ${formatPercentFromUnit(executionTimelineExecutable, 0)} (from canonical timeline snapshot).`,
    });
  }
  if (executionUncertaintyBand){
    const uncertainty = executionUncertaintyBand.toLowerCase();
    list.push({
      kind: uncertainty === "high" ? "warn" : "ok",
      text: `Uplift uncertainty band: ${executionUncertaintyBand.toUpperCase()} (canonical execution summary).`,
    });
  }
  if (executionSaturationPressure){
    const saturation = executionSaturationPressure.toLowerCase();
    list.push({
      kind: saturation === "high" ? "warn" : "ok",
      text: `Saturation pressure: ${executionSaturationPressure.toUpperCase()} (canonical execution summary).`,
    });
  }
  if (topDriverLabel && Number.isFinite(topDriverDelta)){
    const deltaText = formatFixedNumber(topDriverDelta, 1, "0.0");
    list.push({
      kind: "ok",
      text: `Top sensitivity driver: ${topDriverLabel} (${topDriverDelta > 0 ? "+" : ""}${deltaText} pts win-prob delta).`,
    });
  }

  const warnings = Array.isArray(governance?.warnings) ? governance.warnings : [];
  let hasCalibrationRow = false;
  for (const msg of warnings.slice(0, 3)){
    const text = String(msg || "").trim();
    if (!text) continue;
    if (text.includes("Calibration:")) hasCalibrationRow = true;
    list.push({
      kind: "warn",
      text,
    });
  }
  if (!hasCalibrationRow){
    const calibrationLabel = String(snapshot?.learningTopSuggestion || "").trim()
      || "Collect historical closeouts to refine calibration.";
    list.push({
      kind: "warn",
      text: `Calibration: ${calibrationLabel}.`,
    });
  }
  return list;
}

/**
 * Canonical drift checklist rows for validation surfaces.
 * Keeps rolling-vs-assumed threshold logic out of UI modules.
 *
 * @param {unknown} driftSummary
 * @param {{ toleranceRatio?: number }} options
 * @returns {Array<{ kind: "ok" | "warn", text: string }>}
 */
export function buildDriftValidationChecklist(driftSummary, options = {}){
  const summary = driftSummary && typeof driftSummary === "object" ? driftSummary : null;
  if (!summary?.hasLog){
    return [];
  }
  const toleranceRatioRaw = Number(options?.toleranceRatio);
  const toleranceRatio = Number.isFinite(toleranceRatioRaw)
    ? Math.min(0.95, Math.max(0, toleranceRatioRaw))
    : 0.1;

  const checks = [
    {
      key: "CR",
      actual: toFiniteNumber(summary.actualCR),
      assumed: toFiniteNumber(summary.assumedCR),
      format: (value) => formatPercentFromUnit(value, 1),
    },
    {
      key: "SR",
      actual: toFiniteNumber(summary.actualSR),
      assumed: toFiniteNumber(summary.assumedSR),
      format: (value) => formatPercentFromUnit(value, 1),
    },
    {
      key: "APH",
      actual: toFiniteNumber(summary.actualAPH),
      assumed: toFiniteNumber(summary.expectedAPH),
      format: (value) => formatFixedNumber(value, 1, "—"),
    },
  ];

  const rows = [];
  for (const check of checks){
    if (check.actual == null) continue;
    const assumed = check.assumed;
    const low = assumed != null && assumed > 0 && check.actual < (assumed * (1 - toleranceRatio));
    rows.push({
      kind: low ? "warn" : "ok",
      text: `Rolling ${check.key} ${check.format(check.actual)} vs assumed ${check.format(assumed)}.`,
    });
  }
  return rows;
}

export function computeModelGovernance({
  state = {},
  res = {},
  benchmarkWarnings = [],
  evidenceWarnings = [],
  driftSummary = null,
  realism: realismInput = null,
} = {}){
  const voterSignals = deriveVoterModelSignals(state?.voterData, {
    censusAgeDistribution: extractCensusAgeDistribution(state?.census),
    universeSize: toFiniteNumber(state?.universeSize),
  });
  const realism = (realismInput && typeof realismInput === "object")
    ? realismInput
    : (
      state?.ui?.lastRealismSnapshot && typeof state.ui.lastRealismSnapshot === "object"
        ? state.ui.lastRealismSnapshot
        : evaluateAssumptionRealism(state)
    );
  const dataQuality = deriveDataQuality({
    benchmarkWarnings,
    evidenceWarnings,
    driftSummary,
    voterSignals,
    candidateHistory: res?.validation?.candidateHistory || null,
  });
  const historicalAccuracyScore = deriveHistoricalAccuracyScore(state);
  const execution = deriveExecutionReadiness(state);
  const p10 = state?.mcLast?.confidenceEnvelope?.percentiles?.p10;
  const p50 = state?.mcLast?.confidenceEnvelope?.percentiles?.p50;
  const p90 = state?.mcLast?.confidenceEnvelope?.percentiles?.p90;

  const confidence = computeConfidenceProfile({
    p10,
    p50,
    p90,
    realismScore: realism.score,
    dataQualityScore: dataQuality.score,
    historicalAccuracyScore,
    executionReadinessScore: execution.score,
  });
  const learning = computeLearningLoop({
    modelAudit: state?.ui?.modelAudit || null,
    signals: {
      voterRows: dataQuality?.voterRows,
      voterGeoCoverageRate: dataQuality?.voterGeoCoverage,
      voterContactableRate: dataQuality?.voterContactableRate,
      voterAgeCoverageRate: dataQuality?.voterAgeCoverage,
      governanceConfidenceScore: confidence?.score,
      governanceDataQualityScore: dataQuality?.score,
      governanceExecutionScore: execution?.score,
    },
  });

  const sensitivityDrivers = deriveSensitivityDrivers(state);
  const warnings = [];
  const realismFlags = Array.isArray(realism?.flags) ? realism.flags : [];
  for (const flag of realismFlags.slice(0, 4)){
    const label = String(flag?.label || flag?.field || "Assumption").trim();
    const value = toFiniteNumber(flag?.value);
    const severity = String(flag?.severity || "").trim().toLowerCase() === "bad" ? "hard" : "typical";
    warnings.push(`${label}: ${formatFixedNumber(value, 1, "—")} outside ${severity} range.`);
  }
  for (const issue of dataQuality.issues.slice(0, 4)){
    warnings.push(`Data quality: ${issue}.`);
  }
  for (const issue of execution.issues.slice(0, 3)){
    warnings.push(`Execution realism: ${issue}.`);
  }
  const topLearning = learning?.topSuggestion;
  if (topLearning?.label){
    warnings.push(`Calibration: ${String(topLearning.label)}.`);
  }
  const ageOpportunity = String(voterSignals?.ageSegmentation?.opportunityBucketLabel || "").trim();
  const ageRisk = String(voterSignals?.ageSegmentation?.turnoutRiskBucketLabel || "").trim();
  if (ageOpportunity || ageRisk){
    warnings.push(`Age cohorts: opportunity ${ageOpportunity || "unknown"}; turnout risk ${ageRisk || "unknown"}.`);
  }

  return {
    version: MODEL_GOVERNANCE_VERSION,
    realism,
    dataQuality,
    execution,
    confidence,
    historicalAccuracyScore,
    learning,
    sensitivity: {
      topDrivers: sensitivityDrivers,
      hasSnapshot: sensitivityDrivers.length > 0,
    },
    warnings,
    guardrails: [
      {
        title: "Model governance",
        lines: [
          { k: "Realism", v: formatStatusWithScoreOutOfHundred(realism.status, realism.score, 0) },
          { k: "Data quality", v: formatStatusWithScoreOutOfHundred(dataQuality.status, dataQuality.score, 0) },
          { k: "Confidence", v: formatStatusWithScoreOutOfHundred(confidence.band, confidence.score, 1) },
        ],
      },
      {
        title: "Sensitivity drivers",
        lines: sensitivityDrivers.length
          ? sensitivityDrivers.map((row) => ({
              k: row.label,
              v: `${row.deltaWinPct > 0 ? "+" : ""}${formatFixedNumber(row.deltaWinPct, 1, "0.0")} pts`,
            }))
          : [{ k: "Snapshot", v: "Run sensitivity snapshot to populate driver ranking." }],
      },
      {
        title: "Learning loop",
        lines: [
          { k: "Sample size", v: String(learning?.sampleSize ?? 0) },
          { k: "Top guidance", v: String(learning?.topSuggestion?.label || "Collect historical closeouts to enable calibration.") },
          { k: "Recommendation", v: String(learning?.topSuggestion?.recommendation || "No recommendation available.") },
        ],
      },
      {
        title: "Execution realism",
        lines: [
          { k: "Execution", v: formatStatusWithScoreOutOfHundred(execution.status, execution.score, 0) },
          {
            k: "Timeline executable",
            v: execution.timelineExecutablePct == null ? "—" : formatPercentFromUnit(execution.timelineExecutablePct, 0),
          },
          {
            k: "Uplift uncertainty",
            v: String(execution?.uplift?.uncertaintyBand || "unknown").toUpperCase(),
          },
          {
            k: "Saturation pressure",
            v: String(execution?.uplift?.saturationPressure || "unknown").toUpperCase(),
          },
          {
            k: "Uplift source",
            v: formatUpliftSourceLabel(execution?.uplift?.source, { unknownLabel: "Unknown" }),
          },
        ],
      },
    ],
    diagnostics: {
      benchmarkWarningCount: Array.isArray(benchmarkWarnings) ? benchmarkWarnings.length : 0,
      evidenceWarningCount: Array.isArray(evidenceWarnings) ? evidenceWarnings.length : 0,
      voterRows: Math.max(0, toFiniteNumber(voterSignals?.totalRows) ?? 0),
      voterGeoCoverage: clamp(toFiniteNumber(voterSignals?.coverage?.geoCoverageRate) ?? 0, 0, 1),
      voterContactableRate: clamp(toFiniteNumber(voterSignals?.coverage?.contactableRate) ?? 0, 0, 1),
      voterAgeCoverage: clamp(toFiniteNumber(voterSignals?.ageSegmentation?.knownAgeCoverageRate) ?? 0, 0, 1),
      voterAgeSource: String(voterSignals?.ageSegmentation?.source || "unknown").trim(),
      voterAgeOpportunityCohort: String(voterSignals?.ageSegmentation?.opportunityBucketLabel || "").trim(),
      voterAgeTurnoutRiskCohort: String(voterSignals?.ageSegmentation?.turnoutRiskBucketLabel || "").trim(),
      turnoutExpectedPct: toFiniteNumber(res?.turnout?.expectedPct),
      winProb: toFiniteNumber(state?.mcLast?.winProb),
    },
  };
}
