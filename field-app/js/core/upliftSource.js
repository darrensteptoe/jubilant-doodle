// @ts-check

export const UPLIFT_SOURCE_TARGETING_ROWS = "targeting_rows";
export const UPLIFT_SOURCE_BASE_RATES = "base_rates";
export const UPLIFT_SOURCE_UNKNOWN = "unknown";

/**
 * @param {unknown} value
 * @returns {"targeting_rows" | "base_rates" | "unknown"}
 */
export function normalizeUpliftSource(value){
  const raw = String(value == null ? "" : value).trim().toLowerCase();
  if (
    raw === UPLIFT_SOURCE_TARGETING_ROWS
    || raw === "targeting rows"
    || raw === "targeting-rows"
  ) return UPLIFT_SOURCE_TARGETING_ROWS;
  if (
    raw === UPLIFT_SOURCE_BASE_RATES
    || raw === "base rates"
    || raw === "base-rate fallback"
    || raw === "base rate fallback"
  ) return UPLIFT_SOURCE_BASE_RATES;
  return UPLIFT_SOURCE_UNKNOWN;
}

/**
 * @param {unknown} value
 * @param {{ unknownLabel?: string }=} options
 * @returns {string}
 */
export function formatUpliftSourceLabel(value, options = {}){
  const unknownLabel = String(options?.unknownLabel || "Unknown");
  const normalized = normalizeUpliftSource(value);
  if (normalized === UPLIFT_SOURCE_TARGETING_ROWS){
    return "Targeting rows";
  }
  if (normalized === UPLIFT_SOURCE_BASE_RATES){
    return "Base-rate fallback";
  }
  return unknownLabel;
}

/**
 * Canonical governance penalty + issue text for uplift-source quality.
 * @param {unknown} value
 * @returns {{ source: "targeting_rows" | "base_rates" | "unknown", penalty: number, issue: string }}
 */
export function deriveUpliftSourceGovernanceSignal(value){
  const source = normalizeUpliftSource(value);
  if (source === UPLIFT_SOURCE_TARGETING_ROWS){
    return { source, penalty: 0, issue: "" };
  }
  if (source === UPLIFT_SOURCE_BASE_RATES){
    return { source, penalty: 10, issue: "uplift source is base-rate fallback" };
  }
  return { source, penalty: 6, issue: "uplift source is unavailable" };
}
