// @ts-check

import {
  CANONICAL_SCHEMA_VERSION,
  makeCanonicalState,
  migrateLegacyStateToCanonical,
} from "./schema.js";

export const STATE_MIGRATION_TARGET_VERSION = CANONICAL_SCHEMA_VERSION;

export const STATE_MIGRATION_PLAN = Object.freeze([
  Object.freeze({
    from: 0,
    to: CANONICAL_SCHEMA_VERSION,
    id: "legacy_to_canonical_v1",
    description: "Promote legacy mixed state into canonical domain-owned schema.",
  }),
]);

function asDate(value) {
  const next = value instanceof Date ? value : new Date(value || Date.now());
  if (!Number.isFinite(next.getTime())) return new Date();
  return next;
}

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isObject(value) {
  return !!value && typeof value === "object";
}

export function readStateVersion(state) {
  if (!isObject(state)) return 0;
  return toFinite(state.schemaVersion, 0);
}

export function isCanonicalStateVersion(state, version = CANONICAL_SCHEMA_VERSION) {
  return readStateVersion(state) === toFinite(version, CANONICAL_SCHEMA_VERSION)
    && isObject(state?.domains);
}

export function migrateStateToCanonical(state, { nowDate = new Date(), targetVersion = CANONICAL_SCHEMA_VERSION } = {}) {
  const resolvedTarget = toFinite(targetVersion, CANONICAL_SCHEMA_VERSION);
  if (resolvedTarget !== CANONICAL_SCHEMA_VERSION) {
    throw new Error(
      `unsupported migration target version: ${resolvedTarget} (supported: ${CANONICAL_SCHEMA_VERSION})`,
    );
  }
  return migrateLegacyStateToCanonical(state, { nowDate: asDate(nowDate) });
}

export function migrateState(state, options = {}) {
  return migrateStateToCanonical(state, options);
}

export function ensureCanonicalStateVersion(state, options = {}) {
  const nowDate = asDate(options?.nowDate);
  if (isCanonicalStateVersion(state, options?.targetVersion || CANONICAL_SCHEMA_VERSION)) {
    return state;
  }
  return migrateStateToCanonical(state, { ...options, nowDate });
}

export function createCanonicalStateSeed({ nowDate = new Date() } = {}) {
  return makeCanonicalState({ nowDate: asDate(nowDate) });
}

