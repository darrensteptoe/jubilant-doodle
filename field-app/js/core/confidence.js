// @ts-check
import { clampFiniteNumber, roundToDigits, safeNum } from "./utils.js";

export const CONFIDENCE_VERSION = "1.0.0";

const toFiniteNumber = safeNum;
const clamp = clampFiniteNumber;

function scoreBand(score){
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

export function computeConfidenceProfile({
  p10 = null,
  p50 = null,
  p90 = null,
  realismScore = 60,
  dataQualityScore = 60,
  historicalAccuracyScore = 60,
  executionReadinessScore = null,
} = {}){
  const p10n = toFiniteNumber(p10);
  const p50n = toFiniteNumber(p50);
  const p90n = toFiniteNumber(p90);
  const width = (p10n != null && p90n != null) ? (p90n - p10n) : null;
  const stabilityScore = (width != null)
    ? clamp(100 - Math.max(0, width), 0, 100)
    : 55;

  const realism = clamp(toFiniteNumber(realismScore) ?? 60, 0, 100);
  const dataQuality = clamp(toFiniteNumber(dataQualityScore) ?? 60, 0, 100);
  const history = clamp(toFiniteNumber(historicalAccuracyScore) ?? 60, 0, 100);
  const execution = toFiniteNumber(executionReadinessScore);
  const scoreRaw = (execution == null)
    ? (
      (0.35 * realism) +
      (0.35 * dataQuality) +
      (0.20 * history) +
      (0.10 * stabilityScore)
    )
    : (
      (0.30 * realism) +
      (0.30 * dataQuality) +
      (0.20 * history) +
      (0.10 * stabilityScore) +
      (0.10 * clamp(execution, 0, 100))
    );
  const score = roundToDigits(clamp(scoreRaw, 0, 100), 1, 0) ?? 0;

  return {
    version: CONFIDENCE_VERSION,
    score,
    band: scoreBand(score),
    envelope: {
      p10: p10n,
      p50: p50n,
      p90: p90n,
      width,
    },
    influences: {
      realism,
      dataQuality,
      history,
      stability: stabilityScore,
      execution: execution == null ? null : clamp(execution, 0, 100),
    },
  };
}
