// @ts-check
import { roundWholeNumberByMode, safeNum, formatWholeNumberByMode } from "./utils.js";
import { classifyUnifiedStatusTone } from "./statusTone.js";

export const TURNOUT_STATUS_AWAITING_SETUP = "Awaiting setup";
export const TURNOUT_STATUS_BANNER_FALLBACK = "Set turnout assumptions and refresh ROI to evaluate realized-vote impact.";
export const TURNOUT_ROI_BANNER_FALLBACK = "Refresh ROI to compute efficiency comparison.";

/**
 * @param {unknown} value
 * @param {number=} decimals
 * @returns {string}
 */
export function formatTurnoutCurrency(value, decimals = 0){
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }
  const digitsRaw = roundWholeNumberByMode(decimals, { mode: "floor", fallback: 0 }) ?? 0;
  const digits = Math.max(0, digitsRaw);
  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toFiniteNumberOrNaN(value){
  const text = String(value ?? "").trim();
  if (!text){
    return NaN;
  }
  const n = safeNum(text);
  return n == null ? NaN : n;
}

/**
 * @param {string} summary
 * @param {string} turnoutVotes
 * @param {string} needVotes
 * @returns {string}
 */
export function buildTurnoutStatusBanner(summary, turnoutVotes, needVotes){
  if (summary){
    return summary;
  }
  if (turnoutVotes || needVotes){
    return `Expected turnout votes ${turnoutVotes || "—"} vs persuasion need ${needVotes || "—"}.`;
  }
  return TURNOUT_STATUS_BANNER_FALLBACK;
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function buildRoiStatusBanner(view){
  const text = String(view?.roiBannerText || "").trim();
  if (text){
    return text;
  }
  const hasRows = Array.isArray(view?.roiRows) && view.roiRows.length > 0;
  if (!hasRows){
    return TURNOUT_ROI_BANNER_FALLBACK;
  }
  return "ROI comparison reflects current tactic settings.";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveTurnoutAssumptionsCardStatus(view){
  const enabled = !!view?.inputs?.turnoutEnabled;
  if (!enabled){
    return "Module off";
  }
  const baseline = toFiniteNumberOrNaN(view?.inputs?.turnoutBaselinePct);
  if (!Number.isFinite(baseline)){
    return TURNOUT_STATUS_AWAITING_SETUP;
  }
  return "Active";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveTurnoutLiftCardStatus(view){
  const enabled = !!view?.inputs?.turnoutEnabled;
  if (!enabled){
    return "Module off";
  }
  if (!Number.isFinite(toFiniteNumberOrNaN(view?.inputs?.gotvLiftPP))){
    return TURNOUT_STATUS_AWAITING_SETUP;
  }
  return view?.inputs?.gotvDiminishing ? "Diminishing on" : "Linear";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveTurnoutCostCardStatus(view){
  const inputs = view?.inputs || {};
  const enabledCount = [
    inputs.roiDoorsEnabled,
    inputs.roiPhonesEnabled,
    inputs.roiTextsEnabled,
    inputs.roiLitDropEnabled,
    inputs.roiMailEnabled,
  ].filter(Boolean).length;
  if (!enabledCount){
    return "No tactics";
  }
  if (enabledCount === 1){
    return "1 tactic";
  }
  return `${enabledCount} tactics`;
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @param {string} roiBanner
 * @returns {string}
 */
export function deriveTurnoutEfficiencyCardStatus(view, roiBanner){
  const rows = Array.isArray(view?.roiRows) ? view.roiRows : [];
  const banner = String(roiBanner || "").trim().toLowerCase();
  if (!rows.length){
    return "Awaiting refresh";
  }
  if (banner.includes("feasible") || banner.includes("best")){
    return "Compared";
  }
  return "Current";
}

/**
 * @param {string} statusBanner
 * @param {string} winProb
 * @returns {string}
 */
export function deriveTurnoutImpactCardStatus(statusBanner, winProb){
  const banner = String(statusBanner || "").trim().toLowerCase();
  const win = String(winProb || "").trim();
  if (!banner || banner.includes("set turnout assumptions")){
    return TURNOUT_STATUS_AWAITING_SETUP;
  }
  if (banner.includes("exceeds") || banner.includes("covers")){
    return "Helpful";
  }
  if (win && win !== "—"){
    return "In context";
  }
  return "Current";
}

/**
 * @param {string} summary
 * @param {string} turnoutVotes
 * @param {string} needVotes
 * @returns {string}
 */
export function deriveTurnoutSummaryCardStatus(summary, turnoutVotes, needVotes){
  const text = String(summary || "").trim();
  if (text){
    return text.length > 22 ? "Current" : text;
  }
  if (turnoutVotes || needVotes){
    return "Current";
  }
  return TURNOUT_STATUS_AWAITING_SETUP;
}

/**
 * @param {{
 *   capContacts?: unknown,
 *   requiredContacts?: unknown,
 *   formatInt?: ((value: number) => string) | null,
 * }} input
 * @returns {{
 *   capContactsText: string,
 *   gapContactsText: string,
 *   gapNoteText: string,
 * }}
 */
export function buildTurnoutPhase3CapacityGapView(input = {}){
  const capContacts = safeNum(input?.capContacts);
  const requiredContacts = safeNum(input?.requiredContacts);
  const formatInt = typeof input?.formatInt === "function"
    ? input.formatInt
    : (value) => formatWholeNumberByMode(value, { mode: "round", fallback: "0" });
  const toText = (value, mode) => {
    const rounded = roundWholeNumberByMode(value, { mode, fallback: 0 }) ?? 0;
    return String(formatInt(rounded));
  };

  const capContactsText = Number.isFinite(capContacts)
    ? toText(capContacts, "floor")
    : "—";

  if (!Number.isFinite(capContacts) || !Number.isFinite(requiredContacts)){
    return {
      capContactsText,
      gapContactsText: "—",
      gapNoteText: "Enter Phase 2 rates + Phase 3 capacity to compute.",
    };
  }

  const gap = capContacts - requiredContacts;
  const sign = gap >= 0 ? "+" : "−";
  return {
    capContactsText,
    gapContactsText: `${sign}${toText(Math.abs(gap), "ceil")}`,
    gapNoteText: gap >= 0
      ? "Capacity ≥ requirement (base rates)."
      : "Shortfall vs requirement (base rates).",
  };
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyTurnoutStatusTone(text){
  return classifyUnifiedStatusTone(text);
}
