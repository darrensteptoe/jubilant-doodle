// @ts-check
import { formatFixedNumber, roundWholeNumberByMode } from "./utils.js";

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number} roundedValue
 * @param {((value: number) => string) | null} formatInt
 * @returns {string}
 */
function formatRoundedWhole(roundedValue, formatInt){
  if (typeof formatInt === "function"){
    return String(formatInt(roundedValue));
  }
  return roundedValue.toLocaleString("en-US");
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatRoiCurrencyFixed(value, digits = 2, fallback = "—"){
  const n = toFiniteNumber(value);
  if (n == null){
    return fallback;
  }
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return `$${formatFixedNumber(n, places, "0")}`;
}

/**
 * @param {unknown} value
 * @param {{ formatInt?: ((value: number) => string) | null, fallback?: string }=} options
 * @returns {string}
 */
export function formatRoiCurrencyWhole(value, options = {}){
  const n = toFiniteNumber(value);
  if (n == null){
    return String(options?.fallback || "—");
  }
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0;
  return `$${formatRoundedWhole(rounded, options?.formatInt || null)}`;
}

/**
 * @param {unknown} needVotes
 * @param {{ formatInt?: ((value: number) => string) | null, fallback?: string }=} options
 * @returns {string}
 */
export function formatRoiNeedVotesText(needVotes, options = {}){
  const n = toFiniteNumber(needVotes);
  if (n == null){
    return String(options?.fallback || "—");
  }
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0;
  return formatRoundedWhole(rounded, options?.formatInt || null);
}

/**
 * @param {unknown} capAttempts
 * @param {unknown} contactRate
 * @returns {number}
 */
export function computeRoiContactsAtCapacity(capAttempts, contactRate){
  const cap = toFiniteNumber(capAttempts);
  const cr = toFiniteNumber(contactRate);
  if (cap == null || cr == null){
    return 0;
  }
  return Math.max(0, cap * cr);
}

/**
 * @param {{
 *   baselineTurnoutPct?: unknown,
 *   avgLiftPP?: unknown,
 *   gotvAddedVotes?: unknown,
 *   needVotesText?: unknown,
 *   formatInt?: ((value: number) => string) | null,
 * }} input
 * @returns {{ summaryText: string, turnoutVotesText: string, needVotesText: string }}
 */
export function buildRoiTurnoutSummary(input = {}){
  const baseline = toFiniteNumber(input?.baselineTurnoutPct);
  const lift = toFiniteNumber(input?.avgLiftPP);
  const addedVotes = toFiniteNumber(input?.gotvAddedVotes);
  const needVotesText = String(input?.needVotesText || "—").trim() || "—";
  const formatInt = input?.formatInt || null;

  const baselineText = baseline == null ? "—" : `${formatFixedNumber(baseline, 1, "0.0")}%`;
  const liftText = lift == null ? "—" : `${formatFixedNumber(lift, 1, "0.0")}`;
  const turnoutVotesText = addedVotes == null
    ? "0"
    : formatRoundedWhole(roundWholeNumberByMode(addedVotes, { mode: "round", fallback: 0 }) ?? 0, formatInt);

  return {
    summaryText: `Turnout enabled: baseline ${baselineText} · modeled avg lift ${liftText}pp · implied +${turnoutVotesText} votes (at capacity ceiling).`,
    turnoutVotesText,
    needVotesText,
  };
}

/**
 * @param {unknown} needVotesText
 * @returns {{ summaryText: string, turnoutVotesText: string, needVotesText: string }}
 */
export function buildRoiTurnoutDisabledSummary(needVotesText){
  const needText = String(needVotesText || "—").trim() || "—";
  return {
    summaryText: "Turnout module disabled.",
    turnoutVotesText: "—",
    needVotesText: needText,
  };
}

/**
 * Canonical ROI row projection for table rendering.
 * Keeps turnout-aware cost formatting and fallback logic out of render modules.
 *
 * @param {unknown[]} rows
 * @param {{ turnoutEnabled?: unknown, formatInt?: ((value: number) => string) | null }=} options
 * @returns {Array<{
 *   label: string,
 *   cpaText: string,
 *   costPerNetVoteText: string,
 *   costPerTurnoutAdjustedNetVoteText: string,
 *   totalCostText: string,
 *   feasibilityText: string,
 * }>}
 */
export function buildRoiTableRowsView(rows = [], options = {}){
  const list = Array.isArray(rows) ? rows : [];
  const turnoutEnabled = !!options?.turnoutEnabled;
  const formatInt = typeof options?.formatInt === "function" ? options.formatInt : null;
  return list.map((row) => {
    const src = row && typeof row === "object" ? row : {};
    return {
      label: String(src?.label || "—").trim() || "—",
      cpaText: formatRoiCurrencyFixed(src?.cpa, 2),
      costPerNetVoteText: formatRoiCurrencyFixed(src?.costPerNetVote, 2),
      costPerTurnoutAdjustedNetVoteText: turnoutEnabled
        ? formatRoiCurrencyFixed(src?.costPerTurnoutAdjustedNetVote, 2)
        : "—",
      totalCostText: formatRoiCurrencyWhole(src?.totalCost, { formatInt }),
      feasibilityText: String(src?.feasibilityText || "—").trim() || "—",
    };
  });
}
