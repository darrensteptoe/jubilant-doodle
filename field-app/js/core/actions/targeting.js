// @ts-check

import { clone, makeActionResult, mutateDomain, toBool, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

const CONFIG_FIELDS = new Set([
  "presetId",
  "geoLevel",
  "modelId",
  "topN",
  "minHousingUnits",
  "minPopulation",
  "minScore",
  "onlyRaceFootprint",
  "controlsLocked",
]);

const CRITERIA_FIELDS = new Set([
  "prioritizeYoung",
  "prioritizeRenters",
  "avoidHighMultiUnit",
  "densityFloor",
]);

const WEIGHT_FIELDS = new Set([
  "votePotential",
  "turnoutOpportunity",
  "persuasionIndex",
  "fieldEfficiency",
]);

function normalizeConfigValue(field, value) {
  if (field === "topN" || field === "minHousingUnits" || field === "minPopulation") {
    return Math.max(0, Math.trunc(toFinite(value, 0) || 0));
  }
  if (field === "minScore") return toFinite(value, 0);
  if (field === "onlyRaceFootprint" || field === "controlsLocked") return toBool(value);
  return cleanText(value);
}

function normalizeCriteriaValue(field, value) {
  if (field === "densityFloor") return cleanText(value) || "medium";
  return toBool(value);
}

function normalizeWeightValue(value, fallback = 0) {
  const n = toFinite(value, fallback);
  return Math.max(0, n == null ? fallback : n);
}

export function updateTargetingConfig(state, payload, options = {}) {
  const field = cleanText(payload?.field);
  if (!CONFIG_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "targeting",
    (draft) => {
      const nextValue = normalizeConfigValue(field, payload?.value);
      if (draft.config[field] === nextValue) return false;
      draft.config[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `targeting.config.${field}` },
  );
  return makeActionResult(result, { field });
}

export function updateTargetingCriteria(state, payload, options = {}) {
  const field = cleanText(payload?.field);
  if (!CRITERIA_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "targeting",
    (draft) => {
      const nextValue = normalizeCriteriaValue(field, payload?.value);
      if (draft.criteria[field] === nextValue) return false;
      draft.criteria[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `targeting.criteria.${field}` },
  );
  return makeActionResult(result, { field });
}

export function updateTargetingWeights(state, payload, options = {}) {
  const field = cleanText(payload?.field);
  if (!WEIGHT_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "targeting",
    (draft) => {
      const nextValue = normalizeWeightValue(payload?.value, draft.weights[field]);
      if (draft.weights[field] === nextValue) return false;
      draft.weights[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `targeting.weights.${field}` },
  );
  return makeActionResult(result, { field });
}

export function applyTargetingRunResult(state, payload, options = {}) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const statusText = cleanText(payload?.statusText) || "Targeting run completed.";
  const meta = payload?.meta && typeof payload.meta === "object" ? payload.meta : {};
  const lastRunAt = cleanText(payload?.lastRunAt) || new Date().toISOString();

  const result = mutateDomain(
    state,
    "targeting",
    (draft) => {
      draft.runtime.rows = rows.map((row) => clone(row));
      draft.runtime.statusText = statusText;
      draft.runtime.meta = clone(meta);
      draft.runtime.lastRunAt = lastRunAt;
      return true;
    },
    { ...options, revisionReason: "targeting.runtime.applyResult" },
  );
  return makeActionResult(result);
}

