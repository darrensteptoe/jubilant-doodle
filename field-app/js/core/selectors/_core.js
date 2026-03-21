// @ts-check

import { CANONICAL_SCHEMA_VERSION, migrateLegacyStateToCanonical } from "../state/schema.js";

export function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function ensureCanonicalState(state, { nowDate = new Date() } = {}) {
  if (
    state
    && typeof state === "object"
    && Number(state.schemaVersion) === CANONICAL_SCHEMA_VERSION
    && state.domains
    && typeof state.domains === "object"
  ) {
    return state;
  }
  return migrateLegacyStateToCanonical(state, { nowDate });
}

export function toIsoDateValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function safeRatio(numerator, denominator) {
  const n = toFinite(numerator, null);
  const d = toFinite(denominator, null);
  if (n == null || d == null || d <= 0) return null;
  return n / d;
}

