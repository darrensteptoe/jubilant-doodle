// @ts-check

import { clone, makeActionResult, mutateDomain, toBool, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

const TARGETING_CONFIG_DEFAULTS = Object.freeze({
  presetId: "turnout_opportunity",
  geoLevel: "block_group",
  modelId: "turnout_opportunity",
  topN: 50,
  minHousingUnits: 50,
  minPopulation: 120,
  minScore: 0.35,
  onlyRaceFootprint: true,
  controlsLocked: false,
});

const TARGETING_CRITERIA_DEFAULTS = Object.freeze({
  prioritizeYoung: true,
  prioritizeRenters: true,
  avoidHighMultiUnit: false,
  densityFloor: "medium",
});

const TARGETING_WEIGHT_DEFAULTS = Object.freeze({
  votePotential: 0.3,
  turnoutOpportunity: 0.5,
  persuasionIndex: 0.1,
  fieldEfficiency: 0.1,
});

const TARGETING_RUNTIME_DEFAULTS = Object.freeze({
  statusText: "Run targeting to generate ranked GEOs.",
  meta: {},
  rows: [],
  lastRunAt: "",
});

function ensureObjectRecord(target, key, fallback) {
  const current = target?.[key];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current;
  }
  const seeded = { ...(fallback && typeof fallback === "object" ? fallback : {}) };
  target[key] = seeded;
  return seeded;
}

function ensureTargetingDraftShape(draft) {
  const target = draft && typeof draft === "object" ? draft : {};
  const config = ensureObjectRecord(target, "config", TARGETING_CONFIG_DEFAULTS);
  const criteria = ensureObjectRecord(target, "criteria", TARGETING_CRITERIA_DEFAULTS);
  const weights = ensureObjectRecord(target, "weights", TARGETING_WEIGHT_DEFAULTS);
  const runtime = ensureObjectRecord(target, "runtime", TARGETING_RUNTIME_DEFAULTS);

  for (const [key, value] of Object.entries(TARGETING_CONFIG_DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) {
      config[key] = value;
    }
  }
  for (const [key, value] of Object.entries(TARGETING_CRITERIA_DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(criteria, key)) {
      criteria[key] = value;
    }
  }
  for (const [key, value] of Object.entries(TARGETING_WEIGHT_DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(weights, key)) {
      weights[key] = value;
    }
  }
  for (const [key, value] of Object.entries(TARGETING_RUNTIME_DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(runtime, key)) {
      runtime[key] = clone(value);
    }
  }

  return { config, criteria, weights, runtime };
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
      const { config } = ensureTargetingDraftShape(draft);
      const nextValue = normalizeConfigValue(field, payload?.value);
      if (config[field] === nextValue) return false;
      config[field] = nextValue;
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
      const { criteria } = ensureTargetingDraftShape(draft);
      const nextValue = normalizeCriteriaValue(field, payload?.value);
      if (criteria[field] === nextValue) return false;
      criteria[field] = nextValue;
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
      const { weights } = ensureTargetingDraftShape(draft);
      const nextValue = normalizeWeightValue(payload?.value, weights[field]);
      if (weights[field] === nextValue) return false;
      weights[field] = nextValue;
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
      const { runtime } = ensureTargetingDraftShape(draft);
      runtime.rows = rows.map((row) => clone(row));
      runtime.statusText = statusText;
      runtime.meta = clone(meta);
      runtime.lastRunAt = lastRunAt;
      return true;
    },
    { ...options, revisionReason: "targeting.runtime.applyResult" },
  );
  return makeActionResult(result);
}
