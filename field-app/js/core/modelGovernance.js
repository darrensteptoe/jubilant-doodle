// @ts-check
import { evaluateAssumptionRealism } from "./assumptionBaselines.js";
import { computeConfidenceProfile } from "./confidence.js";
import { computeLearningLoop } from "./learningLoop.js";

export const MODEL_GOVERNANCE_VERSION = "1.0.0";

function toFiniteNumber(value){
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, lo, hi){
  const n = Number(value);
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

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

function deriveDataQuality({ benchmarkWarnings = [], evidenceWarnings = [], driftSummary = null } = {}){
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

  const score = clamp(100 - penalty, 0, 100);
  const status = score < 55 ? "bad" : (score < 75 ? "warn" : "ok");
  return {
    score,
    status,
    issues,
    benchmarkCount,
    evidenceCount,
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
    return Math.round((0.6 * s1 + 0.4 * s2) * 10) / 10;
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

  const timelineExecutablePctRaw = toFiniteNumber(timeline?.percentPlanExecutable);
  const timelineExecutablePct = timelineExecutablePctRaw == null
    ? null
    : clamp(timelineExecutablePctRaw, 0, 1);
  const shortfallAttempts = Math.max(0, toFiniteNumber(timeline?.shortfallAttempts) ?? 0);
  const uncertaintyBand = String(uplift?.uncertaintyBand || "").trim().toLowerCase();
  const saturationPressure = String(uplift?.saturationPressure || "").trim().toLowerCase();
  const expectedMarginalGain = toFiniteNumber(uplift?.weightedExpectedMarginalGain);
  const lowMarginalGain = toFiniteNumber(uplift?.weightedLowMarginalGain);

  const issues = [];
  let penalty = 0;

  if (timelineExecutablePct != null){
    if (timelineExecutablePct < 0.95){
      const pctShortfall = 1 - timelineExecutablePct;
      penalty += Math.min(44, pctShortfall * 50);
      issues.push(`timeline executable at ${(timelineExecutablePct * 100).toFixed(0)}%`);
    }
  } else {
    penalty += 6;
    issues.push("timeline executable % unavailable");
  }

  if (shortfallAttempts > 0){
    if (shortfallAttempts >= 1000) penalty += 20;
    else if (shortfallAttempts >= 250) penalty += 14;
    else penalty += 8;
    issues.push(`${Math.round(shortfallAttempts)} attempt shortfall`);
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

  const score = clamp(100 - penalty, 0, 100);
  const status = score < 55 ? "bad" : (score < 75 ? "warn" : "ok");
  return {
    score,
    status,
    timelineExecutablePct,
    shortfallAttempts,
    uplift: {
      uncertaintyBand: uncertaintyBand || "unknown",
      saturationPressure: saturationPressure || "unknown",
      expectedMarginalGain,
      lowMarginalGain,
    },
    issues,
  };
}

export function computeModelGovernance({
  state = {},
  res = {},
  benchmarkWarnings = [],
  evidenceWarnings = [],
  driftSummary = null,
} = {}){
  const realism = evaluateAssumptionRealism(state);
  const dataQuality = deriveDataQuality({ benchmarkWarnings, evidenceWarnings, driftSummary });
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
  });

  const sensitivityDrivers = deriveSensitivityDrivers(state);
  const warnings = [];
  for (const flag of realism.flags.slice(0, 4)){
    warnings.push(`${flag.label}: ${flag.value.toFixed(1)} outside ${flag.severity === "bad" ? "hard" : "typical"} range.`);
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
          { k: "Realism", v: `${realism.status.toUpperCase()} (${realism.score.toFixed(0)}/100)` },
          { k: "Data quality", v: `${dataQuality.status.toUpperCase()} (${dataQuality.score.toFixed(0)}/100)` },
          { k: "Confidence", v: `${confidence.band.toUpperCase()} (${confidence.score.toFixed(1)}/100)` },
        ],
      },
      {
        title: "Sensitivity drivers",
        lines: sensitivityDrivers.length
          ? sensitivityDrivers.map((row) => ({
              k: row.label,
              v: `${row.deltaWinPct > 0 ? "+" : ""}${Number(row.deltaWinPct).toFixed(1)} pts`,
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
          { k: "Execution", v: `${execution.status.toUpperCase()} (${execution.score.toFixed(0)}/100)` },
          {
            k: "Timeline executable",
            v: execution.timelineExecutablePct == null ? "—" : `${Math.round(execution.timelineExecutablePct * 100)}%`,
          },
          {
            k: "Uplift uncertainty",
            v: String(execution?.uplift?.uncertaintyBand || "unknown").toUpperCase(),
          },
          {
            k: "Saturation pressure",
            v: String(execution?.uplift?.saturationPressure || "unknown").toUpperCase(),
          },
        ],
      },
    ],
    diagnostics: {
      benchmarkWarningCount: Array.isArray(benchmarkWarnings) ? benchmarkWarnings.length : 0,
      evidenceWarningCount: Array.isArray(evidenceWarnings) ? evidenceWarnings.length : 0,
      turnoutExpectedPct: toFiniteNumber(res?.turnout?.expectedPct),
      winProb: toFiniteNumber(state?.mcLast?.winProb),
    },
  };
}
