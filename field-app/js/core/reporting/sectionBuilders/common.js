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

function normalizeOfficeContextKey(template = {}) {
  const officeLevel = cleanText(template?.officeLevel).toLowerCase();
  const raceType = cleanText(template?.raceType).toLowerCase();
  if (officeLevel === "statewide_executive" || raceType === "statewide_executive") return "statewide_executive";
  if (officeLevel === "statewide_federal" || raceType === "statewide_federal") return "statewide_federal";
  if (officeLevel === "state_legislative_lower" || raceType === "state_house" || raceType === "state_leg") return "state_house";
  if (officeLevel === "countywide" || raceType === "countywide" || raceType === "county") return "countywide";
  return "";
}

const OFFICE_AWARE_REPORT_LINES = Object.freeze({
  statewide_executive: Object.freeze([
    "This plan is being evaluated as a statewide executive race, where aggregate strength can conceal regional fragility. The risk read should be interpreted through coalition breadth, vote-mode mix, and execution consistency across the state.",
    "The default planning band for this office type is intentionally wider than a district race because statewide execution is less uniform and more exposed to geographic variance.",
    "Leadership should treat a narrow modeled path as provisional until the campaign proves consistent performance across major regions and vote modes.",
  ]),
  statewide_federal: Object.freeze([
    "This plan is being evaluated as a statewide federal race, where outside conditions and message environment can widen uncertainty faster than in lower-salience contests.",
    "A favorable topline should not be treated as settled if the middle path remains exposed to vote-mode weakness or narrative volatility.",
  ]),
  state_house: Object.freeze([
    "This plan is being evaluated as a lower-chamber legislative race, where disciplined field execution and district realism matter more than broad statewide-style storytelling.",
    "A strong district plan should remain legible under neighborhood-level scrutiny, not just in aggregate.",
  ]),
  countywide: Object.freeze([
    "This plan is being evaluated as a countywide race, where county-level toplines should be checked against meaningful sub-geographic variation before leadership assumes the path is stable.",
  ]),
});

export function listOfficeAwareReportLines(context) {
  const template = context?.selectors?.districtCanonical?.templateProfile || {};
  const key = normalizeOfficeContextKey(template);
  const lines = OFFICE_AWARE_REPORT_LINES[key];
  return Array.isArray(lines) ? lines.slice() : [];
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
