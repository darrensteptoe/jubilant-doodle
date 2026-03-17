// @ts-check
import { buildForecastArchiveMarginSummary } from "./forecastArchive.js";

function safeNum(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max){
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function cleanText(value){
  return String(value == null ? "" : value).trim();
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
  const mid = Math.floor(sortedAbs.length / 2);
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
