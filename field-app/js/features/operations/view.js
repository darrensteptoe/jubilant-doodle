// @ts-check
import { formatFixedNumber, formatPercentFromUnit, formatWholeNumber } from "../../core/utils.js";

/**
 * @param {unknown} value
 * @param {{ fallback?: string }=} options
 * @returns {string}
 */
export function formatOperationsWhole(value, options = {}){
  return formatWholeNumber(value, String(options?.fallback || "—"));
}

/**
 * @param {unknown} value
 * @param {{ digits?: number, fallback?: string }=} options
 * @returns {string}
 */
export function formatOperationsOneDecimal(value, options = {}){
  const digits = Math.max(0, Math.trunc(Number(options?.digits) || 1));
  return formatFixedNumber(value, digits, String(options?.fallback || "—"));
}

/**
 * @param {unknown} value
 * @param {{ digits?: number, fallback?: string }=} options
 * @returns {string}
 */
export function formatOperationsFixed(value, options = {}){
  const digits = Math.max(0, Math.trunc(Number(options?.digits) || 0));
  return formatFixedNumber(value, digits, String(options?.fallback || "—"));
}

/**
 * Formats a unit ratio (0-1) for numeric percent input controls without a `%` suffix.
 *
 * @param {unknown} value
 * @param {{ digits?: number, fallback?: string }=} options
 * @returns {string}
 */
export function formatOperationsPercentInputValue(value, options = {}){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return String(options?.fallback || "0.0");
  }
  const digits = Math.max(0, Math.trunc(Number(options?.digits) || 1));
  return formatFixedNumber(n * 100, digits, String(options?.fallback || "0.0"));
}

/**
 * @param {unknown} value
 * @param {{ digits?: number, fallback?: string }=} options
 * @returns {string}
 */
export function formatOperationsPercentFromUnit(value, options = {}){
  return formatPercentFromUnit(value, options?.digits ?? 1, options?.fallback ?? "—");
}

/**
 * @param {unknown} value
 * @param {{ fallback?: string }=} options
 * @returns {string}
 */
export function formatOperationsDateTime(value, options = {}){
  const ts = Date.parse(String(value == null ? "" : value).trim());
  if (!Number.isFinite(ts)){
    return String(options?.fallback || "—");
  }
  return new Date(ts).toLocaleString();
}
