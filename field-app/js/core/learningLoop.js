// @ts-check

export const LEARNING_LOOP_VERSION = "1.0.0";

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

export function computeLearningLoop({
  modelAudit = {},
  minSampleSize = 3,
} = {}){
  const audit = modelAudit && typeof modelAudit === "object" ? modelAudit : {};
  const sampleSize = Math.max(0, Math.floor(toFiniteNumber(audit.sampleSize) ?? 0));
  const within1ptPct = toFiniteNumber(audit.within1ptPct);
  const within2ptPct = toFiniteNumber(audit.within2ptPct);
  const meanErrorMargin = toFiniteNumber(audit.meanErrorMargin);
  const meanAbsErrorMargin = toFiniteNumber(audit.meanAbsErrorMargin);
  const biasDirection = String(audit.biasDirection || "none").trim().toLowerCase() || "none";
  const hasHistory = sampleSize >= Math.max(1, Math.floor(toFiniteNumber(minSampleSize) ?? 3));

  const suggestions = [];
  if (!hasHistory){
    suggestions.push(buildSuggestion({
      id: "insufficient_history",
      severity: "warn",
      label: "Collect more closeouts",
      reason: `Only ${sampleSize} historical result${sampleSize === 1 ? "" : "s"} available.`,
      recommendation: "Record certified actual outcomes for additional campaigns before applying automatic calibration.",
      calibrationPct: null,
    }));
    return {
      version: LEARNING_LOOP_VERSION,
      sampleSize,
      hasHistory,
      biasDirection,
      meanErrorMargin,
      meanAbsErrorMargin,
      within1ptPct,
      within2ptPct,
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
      reason: `Average historical error is ${meanErrorMargin.toFixed(2)} margin points (actual below forecast).`,
      recommendation: `Reduce aggressive baseline assumptions by about ${calibrationPct.toFixed(1)}% and re-check sensitivity drivers.`,
      calibrationPct,
    }));
  } else if (meanErrorMargin != null && biasDirection === "underestimate"){
    const calibrationPct = clamp(Math.abs(meanErrorMargin) * 0.6, 0.5, 4.0);
    suggestions.push(buildSuggestion({
      id: "bias_underestimate",
      severity: "ok",
      label: "Forecasts are systematically low",
      reason: `Average historical error is +${Math.abs(meanErrorMargin).toFixed(2)} margin points (actual above forecast).`,
      recommendation: `Consider increasing baseline confidence assumptions by about ${calibrationPct.toFixed(1)}% only where field evidence supports it.`,
      calibrationPct,
    }));
  }

  if (meanAbsErrorMargin != null && meanAbsErrorMargin > 2){
    suggestions.push(buildSuggestion({
      id: "high_mae",
      severity: "warn",
      label: "Prediction volatility is high",
      reason: `Mean absolute error is ${meanAbsErrorMargin.toFixed(2)} margin points.`,
      recommendation: "Widen confidence communication and prioritize high-impact assumption validation before committing final budget.",
      calibrationPct: null,
    }));
  }

  if (within1ptPct != null && within1ptPct < 55){
    suggestions.push(buildSuggestion({
      id: "low_within1",
      severity: "warn",
      label: "Within-1pt reliability is weak",
      reason: `${within1ptPct.toFixed(1)}% of historical forecasts landed within 1 point.`,
      recommendation: "Use wider planning bands and treat deterministic outputs as directional until reliability improves.",
      calibrationPct: null,
    }));
  }

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
    suggestions,
    topSuggestion: suggestions[0] || null,
  };
}
