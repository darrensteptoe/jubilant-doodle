// @ts-check
import {
  clampFiniteNumber,
  formatFixedNumber,
  formatPercentFromUnit,
  roundWholeNumberByMode,
  safeNum,
} from "./utils.js";

export const LEARNING_LOOP_VERSION = "1.0.0";

const toFiniteNumber = safeNum;
const clamp = clampFiniteNumber;

function buildSuggestion({
  id,
  severity = "warn",
  label = "",
  reason = "",
  recommendation = "",
  calibrationPct = null,
} = {}){
  return {
    id: String(id || "").trim(),
    severity: String(severity || "warn").trim(),
    label: String(label || "").trim(),
    reason: String(reason || "").trim(),
    recommendation: String(recommendation || "").trim(),
    calibrationPct: toFiniteNumber(calibrationPct),
  };
}

function normalizeLearningSignals(signals){
  const src = signals && typeof signals === "object" ? signals : {};
  const voterRowsRaw = toFiniteNumber(src?.voterRows);
  const voterGeoCoverageRateRaw = toFiniteNumber(src?.voterGeoCoverageRate);
  const voterContactableRateRaw = toFiniteNumber(src?.voterContactableRate);
  const governanceConfidenceScoreRaw = toFiniteNumber(src?.governanceConfidenceScore);
  const governanceDataQualityScoreRaw = toFiniteNumber(src?.governanceDataQualityScore);
  const governanceExecutionScoreRaw = toFiniteNumber(src?.governanceExecutionScore);
  return {
    voterRows: voterRowsRaw == null
      ? null
      : Math.max(0, roundWholeNumberByMode(voterRowsRaw, { mode: "floor", fallback: 0 }) ?? 0),
    voterGeoCoverageRate: voterGeoCoverageRateRaw == null ? null : clamp(voterGeoCoverageRateRaw, 0, 1),
    voterContactableRate: voterContactableRateRaw == null ? null : clamp(voterContactableRateRaw, 0, 1),
    governanceConfidenceScore: governanceConfidenceScoreRaw == null ? null : clamp(governanceConfidenceScoreRaw, 0, 100),
    governanceDataQualityScore: governanceDataQualityScoreRaw == null ? null : clamp(governanceDataQualityScoreRaw, 0, 100),
    governanceExecutionScore: governanceExecutionScoreRaw == null ? null : clamp(governanceExecutionScoreRaw, 0, 100),
  };
}

function buildSignalSuggestions(signals){
  const src = normalizeLearningSignals(signals);
  const suggestions = [];

  if (src.voterRows != null){
    if (src.voterRows <= 0){
      suggestions.push(buildSuggestion({
        id: "voter_rows_missing",
        severity: "warn",
        label: "Load canonical voter data",
        reason: "No canonical voter rows are attached to archived forecasts.",
        recommendation: "Import canonical voter rows before calibrating targeting and uplift assumptions.",
      }));
    } else {
      if (src.voterGeoCoverageRate != null && src.voterGeoCoverageRate < 0.7){
        suggestions.push(buildSuggestion({
          id: "voter_geo_coverage_low",
          severity: "warn",
          label: "Improve voter geography linkage",
          reason: `Archived voter geography coverage is ${formatPercentFromUnit(src.voterGeoCoverageRate, 0)}.`,
          recommendation: "Strengthen precinct/tract/block-group mapping before applying aggressive turf-level optimization.",
        }));
      }
      if (src.voterContactableRate != null && src.voterContactableRate < 0.5){
        suggestions.push(buildSuggestion({
          id: "voter_contactable_low",
          severity: "warn",
          label: "Expand contactable voter coverage",
          reason: `Archived contactable voter coverage is ${formatPercentFromUnit(src.voterContactableRate, 0)}.`,
          recommendation: "Backfill core contact fields or adjust channel plans to avoid overestimating reachable universes.",
        }));
      }
    }
  }

  if (src.governanceDataQualityScore != null && src.governanceDataQualityScore < 60){
    suggestions.push(buildSuggestion({
      id: "governance_data_quality_low",
      severity: "warn",
      label: "Data-quality posture is weak",
      reason: `Archived governance data-quality score is ${formatFixedNumber(src.governanceDataQualityScore, 0)}.`,
      recommendation: "Prioritize data completeness fixes before tightening confidence bands.",
    }));
  }

  if (src.governanceConfidenceScore != null && src.governanceConfidenceScore < 60){
    suggestions.push(buildSuggestion({
      id: "governance_confidence_low",
      severity: "warn",
      label: "Forecast confidence is low",
      reason: `Archived governance confidence score is ${formatFixedNumber(src.governanceConfidenceScore, 0)}.`,
      recommendation: "Treat deterministic outputs as directional and favor wider planning ranges.",
    }));
  }

  if (src.governanceExecutionScore != null && src.governanceExecutionScore < 55){
    suggestions.push(buildSuggestion({
      id: "governance_execution_low",
      severity: "warn",
      label: "Execution readiness is constrained",
      reason: `Archived execution-readiness score is ${formatFixedNumber(src.governanceExecutionScore, 0)}.`,
      recommendation: "Close timeline/capacity gaps before relying on high-uplift plans.",
    }));
  }

  return suggestions;
}

export function computeLearningLoop({
  modelAudit = {},
  minSampleSize = 3,
  signals = null,
} = {}){
  const audit = modelAudit && typeof modelAudit === "object" ? modelAudit : {};
  const normalizedSignals = normalizeLearningSignals(signals);
  const sampleSize = Math.max(0, roundWholeNumberByMode(toFiniteNumber(audit.sampleSize) ?? 0, { mode: "floor", fallback: 0 }) ?? 0);
  const within1ptPct = toFiniteNumber(audit.within1ptPct);
  const within2ptPct = toFiniteNumber(audit.within2ptPct);
  const meanErrorMargin = toFiniteNumber(audit.meanErrorMargin);
  const meanAbsErrorMargin = toFiniteNumber(audit.meanAbsErrorMargin);
  const biasDirection = String(audit.biasDirection || "none").trim().toLowerCase() || "none";
  const minSample = Math.max(1, roundWholeNumberByMode(toFiniteNumber(minSampleSize) ?? 3, { mode: "floor", fallback: 3 }) ?? 3);
  const hasHistory = sampleSize >= minSample;

  const suggestions = [];
  const signalSuggestions = buildSignalSuggestions(normalizedSignals);
  if (!hasHistory){
    suggestions.push(buildSuggestion({
      id: "insufficient_history",
      severity: "warn",
      label: "Collect more closeouts",
      reason: `Only ${sampleSize} historical result${sampleSize === 1 ? "" : "s"} available.`,
      recommendation: "Record certified actual outcomes for additional campaigns before applying automatic calibration.",
      calibrationPct: null,
    }));
    suggestions.push(...signalSuggestions);
    return {
      version: LEARNING_LOOP_VERSION,
      sampleSize,
      hasHistory,
      biasDirection,
      meanErrorMargin,
      meanAbsErrorMargin,
      within1ptPct,
      within2ptPct,
      signals: normalizedSignals,
      suggestions,
      topSuggestion: suggestions[0] || null,
    };
  }

  if (meanErrorMargin != null && biasDirection === "overestimate"){
    const calibrationPct = clamp(Math.abs(meanErrorMargin) * 0.6, 0.5, 4.0);
    suggestions.push(buildSuggestion({
      id: "bias_overestimate",
      severity: "warn",
      label: "Forecasts are systematically high",
      reason: `Average historical error is ${formatFixedNumber(meanErrorMargin, 2)} margin points (actual below forecast).`,
      recommendation: `Reduce aggressive baseline assumptions by about ${formatFixedNumber(calibrationPct, 1)}% and re-check sensitivity drivers.`,
      calibrationPct,
    }));
  } else if (meanErrorMargin != null && biasDirection === "underestimate"){
    const calibrationPct = clamp(Math.abs(meanErrorMargin) * 0.6, 0.5, 4.0);
    suggestions.push(buildSuggestion({
      id: "bias_underestimate",
      severity: "ok",
      label: "Forecasts are systematically low",
      reason: `Average historical error is +${formatFixedNumber(Math.abs(meanErrorMargin), 2)} margin points (actual above forecast).`,
      recommendation: `Consider increasing baseline confidence assumptions by about ${formatFixedNumber(calibrationPct, 1)}% only where field evidence supports it.`,
      calibrationPct,
    }));
  }

  if (meanAbsErrorMargin != null && meanAbsErrorMargin > 2){
    suggestions.push(buildSuggestion({
      id: "high_mae",
      severity: "warn",
      label: "Prediction volatility is high",
      reason: `Mean absolute error is ${formatFixedNumber(meanAbsErrorMargin, 2)} margin points.`,
      recommendation: "Widen confidence communication and prioritize high-impact assumption validation before committing final budget.",
      calibrationPct: null,
    }));
  }

  if (within1ptPct != null && within1ptPct < 55){
    suggestions.push(buildSuggestion({
      id: "low_within1",
      severity: "warn",
      label: "Within-1pt reliability is weak",
      reason: `${formatFixedNumber(within1ptPct, 1)}% of historical forecasts landed within 1 point.`,
      recommendation: "Use wider planning bands and treat deterministic outputs as directional until reliability improves.",
      calibrationPct: null,
    }));
  }

  suggestions.push(...signalSuggestions);

  if (!suggestions.length){
    suggestions.push(buildSuggestion({
      id: "stable",
      severity: "ok",
      label: "Learning posture stable",
      reason: "Historical error signals are within acceptable tolerance.",
      recommendation: "Continue recording closeouts and monitor for drift before changing baselines.",
      calibrationPct: null,
    }));
  }

  return {
    version: LEARNING_LOOP_VERSION,
    sampleSize,
    hasHistory,
    biasDirection,
    meanErrorMargin,
    meanAbsErrorMargin,
    within1ptPct,
    within2ptPct,
    signals: normalizedSignals,
    suggestions,
    topSuggestion: suggestions[0] || null,
  };
}
