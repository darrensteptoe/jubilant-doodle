// @ts-check
import { buildForecastArchiveMarginSummary } from "./forecastArchive.js";
import { computeLearningLoop } from "./learningLoop.js";
import { clampFiniteNumber, coerceFiniteNumber, roundWholeNumberByMode } from "./utils.js";

const safeNum = coerceFiniteNumber;
const clamp = clampFiniteNumber;

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function weightedAverage(rows, pickValue, pickWeight){
  let weightedTotal = 0;
  let weightTotal = 0;
  for (const row of rows){
    const value = safeNum(pickValue(row));
    if (value == null) continue;
    const weightRaw = safeNum(pickWeight(row));
    const weight = (weightRaw != null && weightRaw > 0) ? weightRaw : 1;
    weightedTotal += (value * weight);
    weightTotal += weight;
  }
  if (weightTotal <= 0){
    return null;
  }
  return weightedTotal / weightTotal;
}

export function buildModelAuditRecord(entry){
  const row = entry && typeof entry === "object" ? entry : null;
  if (!row) return null;
  const marginSummary = buildForecastArchiveMarginSummary(row);
  const forecastMargin = marginSummary.forecastMargin;
  const actualMargin = marginSummary.actualMargin;
  if (forecastMargin == null || actualMargin == null){
    return null;
  }
  return {
    archiveId: cleanText(row.archiveId),
    snapshotHash: cleanText(row.snapshotHash),
    campaignId: cleanText(row.campaignId),
    officeId: cleanText(row.officeId),
    scenarioId: cleanText(row.scenarioId),
    recordedAt: cleanText(row.recordedAt),
    forecastMargin,
    actualMargin,
    errorMargin: actualMargin - forecastMargin,
  };
}

export function summarizeModelAudit(records){
  const rows = (Array.isArray(records) ? records : [])
    .map((row) => row && typeof row === "object" ? row : null)
    .filter(Boolean);
  if (!rows.length){
    return {
      sampleSize: 0,
      meanErrorMargin: null,
      meanAbsErrorMargin: null,
      medianAbsErrorMargin: null,
      within1ptPct: null,
      within2ptPct: null,
      biasDirection: "none",
    };
  }
  const errors = rows
    .map((row) => safeNum(row.errorMargin))
    .filter((value) => value != null);
  if (!errors.length){
    return {
      sampleSize: 0,
      meanErrorMargin: null,
      meanAbsErrorMargin: null,
      medianAbsErrorMargin: null,
      within1ptPct: null,
      within2ptPct: null,
      biasDirection: "none",
    };
  }

  const absErrors = errors.map((value) => Math.abs(value));
  const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  const meanAbsError = absErrors.reduce((sum, value) => sum + value, 0) / absErrors.length;
  const sortedAbs = absErrors.slice().sort((a, b) => a - b);
  const mid = roundWholeNumberByMode(sortedAbs.length / 2, { mode: "floor", fallback: 0 }) ?? 0;
  const medianAbs = (sortedAbs.length % 2 === 0)
    ? (sortedAbs[mid - 1] + sortedAbs[mid]) / 2
    : sortedAbs[mid];
  const within1 = absErrors.filter((value) => value <= 1).length;
  const within2 = absErrors.filter((value) => value <= 2).length;
  const within1ptPct = clamp((within1 / errors.length) * 100, 0, 100);
  const within2ptPct = clamp((within2 / errors.length) * 100, 0, 100);
  const biasDirection = meanError > 0.1
    ? "underestimate"
    : (meanError < -0.1 ? "overestimate" : "neutral");

  return {
    sampleSize: errors.length,
    meanErrorMargin: meanError,
    meanAbsErrorMargin: meanAbsError,
    medianAbsErrorMargin: medianAbs,
    within1ptPct,
    within2ptPct,
    biasDirection,
  };
}

export function summarizeModelAuditFromArchive(entries){
  const records = (Array.isArray(entries) ? entries : [])
    .map((entry) => buildModelAuditRecord(entry))
    .filter(Boolean);
  return summarizeModelAudit(records);
}

/**
 * Canonical archive-signal projection for learning-loop calibration context.
 * @param {unknown[]} entries
 */
export function buildArchiveLearningSignals(entries){
  const rows = (Array.isArray(entries) ? entries : [])
    .map((entry) => entry && typeof entry === "object" ? entry : null)
    .filter(Boolean);
  const voterRowsMax = rows.reduce((max, row) => {
    const rowCount = safeNum(row?.voter?.rowCount);
    if (rowCount == null) return max;
    return Math.max(max, Math.max(0, rowCount));
  }, 0);
  return {
    voterRows: voterRowsMax > 0 ? voterRowsMax : null,
    voterGeoCoverageRate: weightedAverage(
      rows,
      (row) => row?.voter?.geoCoverageRate,
      (row) => row?.voter?.rowCount,
    ),
    voterContactableRate: weightedAverage(
      rows,
      (row) => row?.voter?.contactableRate,
      (row) => row?.voter?.rowCount,
    ),
    governanceConfidenceScore: weightedAverage(
      rows,
      (row) => row?.governance?.confidenceScore,
      (row) => row?.voter?.rowCount,
    ),
    governanceDataQualityScore: weightedAverage(
      rows,
      (row) => row?.governance?.dataQualityScore,
      (row) => row?.voter?.rowCount,
    ),
    governanceExecutionScore: weightedAverage(
      rows,
      (row) => row?.governance?.executionScore,
      (row) => row?.voter?.rowCount,
    ),
  };
}

/**
 * Canonical model-audit + learning summary bundle from archive rows.
 * Keeps archive learning composition out of runtime glue/render modules.
 *
 * @param {unknown[]} entries
 * @param {{ minSampleSize?: number }=} options
 * @returns {{
 *   modelAudit: ReturnType<typeof summarizeModelAuditFromArchive>,
 *   learning: ReturnType<typeof computeLearningLoop>,
 *   signals: ReturnType<typeof buildArchiveLearningSignals>,
 * }}
 */
export function buildModelLearningFromArchive(entries, options = {}){
  const modelAudit = summarizeModelAuditFromArchive(entries);
  const signals = buildArchiveLearningSignals(entries);
  const minSampleSize = Number.isFinite(Number(options?.minSampleSize))
    ? Math.max(1, roundWholeNumberByMode(options.minSampleSize, { mode: "floor", fallback: 3 }) ?? 3)
    : 3;
  const learning = computeLearningLoop({
    modelAudit,
    minSampleSize,
    signals,
  });
  return {
    modelAudit,
    learning,
    signals,
  };
}
