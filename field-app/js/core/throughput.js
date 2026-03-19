// @ts-check
import { computeBlendedAttemptsPerHour } from "./model.js";
import { safeNum } from "./utils.js";
import { pctOverrideToDecimal } from "./voteProduction.js";

/**
 * @param {Record<string, any> | null | undefined} state
 * @param {{
 *   canonicalKey: string,
 *   legacyKey: string,
 *   toNumber?: ((value: unknown) => number | null) | null,
 * }} options
 * @returns {number | null}
 */
function resolveCanonicalThroughputValue(state, { canonicalKey, legacyKey, toNumber }){
  const src = state && typeof state === "object" ? state : {};
  const toNum = typeof toNumber === "function" ? toNumber : safeNum;
  const canonical = toNum(src?.[canonicalKey]);
  if (canonical != null && Number.isFinite(canonical)){
    return canonical;
  }
  const legacy = toNum(src?.[legacyKey]);
  if (legacy != null && Number.isFinite(legacy)){
    return legacy;
  }
  return null;
}

/**
 * @param {Record<string, any> | null | undefined} target
 * @param {unknown} value
 * @param {{
 *   canonicalKey: string,
 *   legacyKey: string,
 *   toNumber?: ((value: unknown) => number | null) | null,
 *   emptyValue?: unknown,
 * }} options
 * @returns {void}
 */
function setCanonicalThroughputValue(target, value, options = {}){
  if (!target || typeof target !== "object"){
    return;
  }
  const {
    canonicalKey,
    legacyKey,
    toNumber,
    emptyValue,
  } = options;
  const toNum = typeof toNumber === "function" ? toNumber : safeNum;
  const nextEmpty = Object.prototype.hasOwnProperty.call(options, "emptyValue")
    ? emptyValue
    : "";
  const nextNumber = toNum(value);
  const next = (nextNumber != null && Number.isFinite(nextNumber)) ? nextNumber : nextEmpty;
  target[canonicalKey] = next;
  target[legacyKey] = next;
}

/**
 * @param {unknown} value
 * @param {{
 *   toNumber?: ((value: unknown) => number | null) | null,
 *   fallback?: unknown,
 *   minExclusive?: number,
 * }} options
 * @returns {number | null}
 */
function resolvePositiveThroughputValue(value, options = {}){
  const toNumber = typeof options?.toNumber === "function" ? options.toNumber : safeNum;
  const minExclusive = Number.isFinite(Number(options?.minExclusive)) ? Number(options.minExclusive) : 0;
  const parsed = toNumber(value);
  if (parsed != null && Number.isFinite(parsed) && parsed > minExclusive){
    return parsed;
  }
  const fallback = toNumber(options?.fallback);
  if (fallback != null && Number.isFinite(fallback)){
    return fallback;
  }
  return null;
}

/**
 * Resolve door-share unit from a percent-style value.
 *
 * @param {unknown} doorSharePct
 * @param {{
 *   toUnit?: ((value: unknown, fallback?: number | null) => number | null) | null,
 *   fallback?: number | null,
 * }} options
 * @returns {number | null}
 */
export function resolveDoorShareUnitFromPct(doorSharePct, options = {}){
  const toUnit = typeof options?.toUnit === "function" ? options.toUnit : pctOverrideToDecimal;
  const hasFallback = Object.prototype.hasOwnProperty.call(options || {}, "fallback");
  const fallback = hasFallback ? options.fallback : null;
  const resolved = toUnit(doorSharePct, fallback);
  return (resolved != null && Number.isFinite(resolved)) ? resolved : null;
}

/**
 * Resolve canonical door-share unit from state.
 *
 * @param {Record<string, any> | null | undefined} state
 * @param {{
 *   toUnit?: ((value: unknown, fallback?: number | null) => number | null) | null,
  *   fallback?: number | null,
 * }} options
 * @returns {number | null}
 */
export function resolveCanonicalDoorShareUnit(state, options = {}){
  const src = state && typeof state === "object" ? state : {};
  const toUnit = typeof options?.toUnit === "function" ? options.toUnit : pctOverrideToDecimal;
  const canonical = resolveDoorShareUnitFromPct(src?.channelDoorPct, {
    toUnit,
    fallback: null,
  });
  if (canonical != null && Number.isFinite(canonical)){
    return canonical;
  }
  // Legacy fallback for snapshots/tests that still populate doorKnockShare
  // as a unit ratio (0..1) instead of percentage points.
  const legacyRaw = safeNum(src?.doorKnockShare);
  if (legacyRaw != null && legacyRaw >= 0 && legacyRaw <= 1){
    return legacyRaw;
  }
  const legacyPct = resolveDoorShareUnitFromPct(src?.doorKnockShare, {
    toUnit,
    fallback: null,
  });
  if (legacyPct != null && Number.isFinite(legacyPct)){
    return legacyPct;
  }
  const hasFallback = Object.prototype.hasOwnProperty.call(options || {}, "fallback");
  return hasFallback ? options.fallback ?? null : null;
}

/**
 * Resolve canonical doors/hour value from state snapshots with legacy fallback.
 *
 * @param {Record<string, any> | null | undefined} state
 * @param {{ toNumber?: ((value: unknown) => number | null) | null }=} options
 * @returns {number | null}
 */
export function resolveCanonicalDoorsPerHour(state, options = {}){
  return resolveCanonicalThroughputValue(state, {
    canonicalKey: "doorsPerHour3",
    legacyKey: "doorsPerHour",
    toNumber: options?.toNumber,
  });
}

/**
 * Normalize and write canonical doors/hour values back to both canonical and legacy fields.
 *
 * @param {Record<string, any> | null | undefined} target
 * @param {unknown} value
 * @param {{
 *   toNumber?: ((value: unknown) => number | null) | null,
 *   emptyValue?: unknown,
 * }} options
 * @returns {void}
 */
export function setCanonicalDoorsPerHour(target, value, options = {}){
  return setCanonicalThroughputValue(target, value, {
    canonicalKey: "doorsPerHour3",
    legacyKey: "doorsPerHour",
    toNumber: options?.toNumber,
    emptyValue: options?.emptyValue,
  });
}

/**
 * Resolve canonical calls/hour value from state snapshots with legacy fallback.
 *
 * @param {Record<string, any> | null | undefined} state
 * @param {{ toNumber?: ((value: unknown) => number | null) | null }=} options
 * @returns {number | null}
 */
export function resolveCanonicalCallsPerHour(state, options = {}){
  return resolveCanonicalThroughputValue(state, {
    canonicalKey: "callsPerHour3",
    legacyKey: "callsPerHour",
    toNumber: options?.toNumber,
  });
}

/**
 * Normalize and write canonical calls/hour values back to both canonical and legacy fields.
 *
 * @param {Record<string, any> | null | undefined} target
 * @param {unknown} value
 * @param {{
 *   toNumber?: ((value: unknown) => number | null) | null,
 *   emptyValue?: unknown,
 * }} options
 * @returns {void}
 */
export function setCanonicalCallsPerHour(target, value, options = {}){
  return setCanonicalThroughputValue(target, value, {
    canonicalKey: "callsPerHour3",
    legacyKey: "callsPerHour",
    toNumber: options?.toNumber,
    emptyValue: options?.emptyValue,
  });
}

/**
 * Resolve positive canonical doors/hour value with fallback.
 *
 * @param {Record<string, any> | null | undefined} state
 * @param {{
 *   toNumber?: ((value: unknown) => number | null) | null,
 *   fallback?: unknown,
 *   minExclusive?: number,
 * }} options
 * @returns {number | null}
 */
export function resolveBaseDoorsPerHour(state, options = {}){
  return resolvePositiveThroughputValue(
    resolveCanonicalDoorsPerHour(state, { toNumber: options?.toNumber }),
    {
      toNumber: options?.toNumber,
      fallback: Object.prototype.hasOwnProperty.call(options || {}, "fallback")
        ? options.fallback
        : 30,
      minExclusive: options?.minExclusive,
    }
  );
}

/**
 * Resolve positive canonical calls/hour value with fallback.
 *
 * @param {Record<string, any> | null | undefined} state
 * @param {{
 *   toNumber?: ((value: unknown) => number | null) | null,
 *   fallback?: unknown,
 *   minExclusive?: number,
 * }} options
 * @returns {number | null}
 */
export function resolveBaseCallsPerHour(state, options = {}){
  return resolvePositiveThroughputValue(
    resolveCanonicalCallsPerHour(state, { toNumber: options?.toNumber }),
    {
      toNumber: options?.toNumber,
      fallback: Object.prototype.hasOwnProperty.call(options || {}, "fallback")
        ? options.fallback
        : 25,
      minExclusive: options?.minExclusive,
    }
  );
}

/**
 * Resolve blended attempts/hour directly from canonical throughput state fields.
 *
 * @param {Record<string, any> | null | undefined} state
 * @param {{
 *   toNumber?: ((value: unknown) => number | null) | null,
 *   toUnit?: ((value: unknown, fallback?: number | null) => number | null) | null,
 *   doorShareFallback?: number | null,
 * }} options
 * @returns {number | null}
 */
export function computeBlendedAttemptsPerHourFromState(state, options = {}){
  const hasDoorShareFallback = Object.prototype.hasOwnProperty.call(options || {}, "doorShareFallback");
  const doorShare = resolveCanonicalDoorShareUnit(state, {
    toUnit: options?.toUnit,
    fallback: hasDoorShareFallback ? options.doorShareFallback : null,
  });
  const doorsPerHour = resolveCanonicalDoorsPerHour(state, { toNumber: options?.toNumber });
  const callsPerHour = resolveCanonicalCallsPerHour(state, { toNumber: options?.toNumber });
  return computeBlendedAttemptsPerHour({
    doorShare,
    doorsPerHour,
    callsPerHour,
  });
}
