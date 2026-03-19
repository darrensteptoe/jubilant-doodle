// @ts-check
import { clampFiniteNumber, safeNum } from "./utils.js";
import { pctOverrideToDecimal } from "./voteProduction.js";

const toFiniteNumber = safeNum;
const clamp = clampFiniteNumber;

export const BASE_RATE_DEFAULTS = Object.freeze({
  cr: 0.22,
  sr: 0.55,
  tr: 0.80,
});

export const ZERO_BASE_RATE_DEFAULTS = Object.freeze({
  cr: 0,
  sr: 0,
  tr: 0,
});

export const NULL_BASE_RATE_DEFAULTS = Object.freeze({
  cr: null,
  sr: null,
  tr: null,
});

function hasOwn(obj, key){
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveRateDefault(defaults, key, fallback){
  if (!hasOwn(defaults, key)) return fallback;
  const raw = defaults?.[key];
  const n = (raw == null || raw === "") ? null : toFiniteNumber(raw);
  return n == null ? null : n;
}

function resolveBounds({ clampMin = 0, clampMax = 1 } = {}){
  const minMaybe = toFiniteNumber(clampMin);
  const maxMaybe = toFiniteNumber(clampMax);
  const min = minMaybe == null ? 0 : minMaybe;
  const max = maxMaybe == null ? 1 : maxMaybe;
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
}

function clampUnitRate(value, { min, max }){
  const n = toFiniteNumber(value);
  if (n == null) return null;
  return clamp(n, min, max);
}

/**
 * @param {Record<string, any>|null|undefined} state
 * @param {{
 *   defaults?: { cr?: number|null, sr?: number|null, tr?: number|null },
 *   clampMin?: number,
 *   clampMax?: number,
 * }=} options
 * @returns {{ cr: number|null, sr: number|null, tr: number|null }}
 */
export function resolveStateBaseRates(state, options = {}){
  const src = state && typeof state === "object" ? state : {};
  const defaults = options?.defaults && typeof options.defaults === "object"
    ? options.defaults
    : BASE_RATE_DEFAULTS;
  const bounds = resolveBounds(options);
  const fallbackCr = resolveRateDefault(defaults, "cr", BASE_RATE_DEFAULTS.cr);
  const fallbackSr = resolveRateDefault(defaults, "sr", BASE_RATE_DEFAULTS.sr);
  const fallbackTr = resolveRateDefault(defaults, "tr", BASE_RATE_DEFAULTS.tr);

  return {
    cr: clampUnitRate(pctOverrideToDecimal(src.contactRatePct, fallbackCr), bounds),
    sr: clampUnitRate(pctOverrideToDecimal(src.supportRatePct, fallbackSr), bounds),
    tr: clampUnitRate(pctOverrideToDecimal(src.turnoutReliabilityPct, fallbackTr), bounds),
  };
}

/**
 * @param {{
 *   baseRates?: { cr?: number|null, sr?: number|null, tr?: number|null },
 *   state?: Record<string, any>|null,
 *   defaults?: { cr?: number|null, sr?: number|null, tr?: number|null },
 *   clampMin?: number,
 *   clampMax?: number,
 * }=} options
 * @returns {{ cr: number|null, sr: number|null, tr: number|null }}
 */
export function resolveBaseRatesWithStateFallback(options = {}){
  const bounds = resolveBounds(options);
  const resolved = resolveStateBaseRates(options?.state, {
    defaults: options?.defaults,
    clampMin: bounds.min,
    clampMax: bounds.max,
  });
  const baseRates = options?.baseRates && typeof options.baseRates === "object"
    ? options.baseRates
    : {};

  const overrideCr = clampUnitRate(baseRates.cr, bounds);
  const overrideSr = clampUnitRate(baseRates.sr, bounds);
  const overrideTr = clampUnitRate(baseRates.tr, bounds);

  return {
    cr: overrideCr == null ? resolved.cr : overrideCr,
    sr: overrideSr == null ? resolved.sr : overrideSr,
    tr: overrideTr == null ? resolved.tr : overrideTr,
  };
}
