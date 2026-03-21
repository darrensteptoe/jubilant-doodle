// @ts-check

import {
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
} from "../blocks/index.js";

export {
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
};

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function fmtMetric(value, digits = 1, suffix = "") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}

export function fmtPercentFromUnit(value, digits = 1) {
  const n = toFinite(value, null);
  if (n == null) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtWhole(value) {
  const n = toFinite(value, null);
  if (n == null) return "—";
  return `${Math.round(n)}`;
}

export function fmtSignedDelta(value, digits = 2, suffix = "") {
  const n = toFinite(value, null);
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}${suffix}`;
}

export function buildMetricRow(label, value, { delta = null, trend = "flat", note = "" } = {}) {
  return {
    label: cleanText(label),
    value,
    delta,
    trend,
    note: cleanText(note),
  };
}

export function makeSection(id, title, blocks = []) {
  return {
    id: cleanText(id),
    title: cleanText(title),
    blocks: Array.isArray(blocks) ? blocks : [],
  };
}

export function firstMetricDelta(context, metricId) {
  const rows = context?.metrics?.comparison?.trendRows;
  if (!Array.isArray(rows)) return null;
  const hit = rows.find((row) => String(row?.metricId || "") === String(metricId || ""));
  if (!hit || typeof hit !== "object") return null;
  return {
    current: toFinite(hit.current, null),
    previous: toFinite(hit.previous, null),
    delta: toFinite(hit.delta, null),
    direction: cleanText(hit.direction) || "flat",
  };
}
