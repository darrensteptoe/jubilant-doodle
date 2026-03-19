// @ts-check
import { getTemplateLabelForRaceType, getTemplateLabelForState } from "./templateResolver.js";
import { formatFixedNumber } from "../core/utils.js";

/**
 * @param {string} title
 * @param {HTMLElement[]} kvs
 * @returns {HTMLDivElement}
 */
export function blockModule(title, kvs){
  const div = document.createElement("div");
  div.className = "assump-block";
  const t = document.createElement("div");
  t.className = "assump-title";
  t.textContent = title;
  const body = document.createElement("div");
  body.className = "assump-body";
  for (const row of kvs) body.appendChild(row);
  div.appendChild(t);
  div.appendChild(body);
  return div;
}

/**
 * @param {string} k
 * @param {string} v
 * @returns {HTMLDivElement}
 */
export function kvModule(k, v){
  const row = document.createElement("div");
  row.className = "kv";
  const dk = document.createElement("div");
  dk.className = "k";
  dk.textContent = k;
  const dv = document.createElement("div");
  dv.className = "v";
  dv.textContent = v;
  row.appendChild(dk);
  row.appendChild(dv);
  return row;
}

/**
 * @param {string | Record<string, any>} v
 * @returns {string}
 */
export function labelTemplateModule(v){
  if (v && typeof v === "object"){
    return getTemplateLabelForState(v, { detailed: true });
  }
  return getTemplateLabelForRaceType(v);
}

/**
 * @param {string} v
 * @returns {string}
 */
export function labelUndecidedModeModule(v){
  if (v === "user_defined") return "User-defined split";
  if (v === "against") return "Conservative against you";
  if (v === "toward") return "Conservative toward you";
  return "Proportional";
}

/**
 * @param {Record<string, any>} state
 * @returns {string | null}
 */
export function getYourNameFromStateModule(state){
  const c = state.candidates.find(x => x.id === state.yourCandidateId);
  return c?.name || null;
}

/**
 * @param {unknown} value
 * @param {string=} fallback
 * @returns {string}
 */
export function formatAssumptionsOneDecimal(value, fallback = "—"){
  return formatFixedNumber(value, 1, fallback);
}

/**
 * @param {unknown} value
 * @param {string=} fallback
 * @returns {string}
 */
export function formatAssumptionsPercent(value, fallback = "—"){
  const text = formatAssumptionsOneDecimal(value, "");
  return text ? `${text}%` : fallback;
}

/**
 * @param {{ low?: unknown, mid?: unknown, high?: unknown } | null | undefined} band
 * @param {string=} fallback
 * @returns {string}
 */
export function formatAssumptionsBand(band, fallback = "—"){
  const low = formatAssumptionsOneDecimal(band?.low, "");
  const mid = formatAssumptionsOneDecimal(band?.mid, "");
  const high = formatAssumptionsOneDecimal(band?.high, "");
  if (!low || !mid || !high){
    return fallback;
  }
  return `${low} / ${mid} / ${high}`;
}

/**
 * @param {unknown} reason
 * @returns {string}
 */
export function buildAssumptionsApplyModeReasonLabel(reason){
  const code = String(reason || "").trim();
  if (!code || code === "toggle_off") return "OFF";
  if (code === "ready") return "ON";
  if (code === "rows_not_ready") return "Blocked (rows not ready)";
  if (code === "advisory_not_ready") return "Blocked (advisory not ready)";
  if (code === "selection_mismatch") return "Blocked (selection mismatch)";
  if (code.startsWith("provenance_")) return "Blocked (provenance stale)";
  if (code === "alignment_not_ready") return "Blocked (alignment)";
  return `Blocked (${code})`;
}

/**
 * @param {{ applyGate?: { reason?: unknown }, applyMultipliers?: { doorsPerHour?: unknown, contactRate?: unknown, persuasion?: unknown, turnoutLift?: unknown, organizerLoad?: unknown } | null }} input
 * @returns {string}
 */
export function buildAssumptionsApplyModeText(input){
  const multipliers = input?.applyMultipliers;
  if (multipliers && typeof multipliers === "object"){
    const dph = Number(multipliers.doorsPerHour);
    const cr = Number(multipliers.contactRate);
    const sr = Number(multipliers.persuasion);
    const tr = Number(multipliers.turnoutLift);
    const load = Number(multipliers.organizerLoad);
    if ([dph, cr, sr, tr, load].every((n) => Number.isFinite(n))){
      return `ON (${formatFixedNumber(dph, 2)}x DPH, ${formatFixedNumber(cr, 2)}x CR, ${formatFixedNumber(sr, 2)}x SR, ${formatFixedNumber(tr, 2)}x TR, ${formatFixedNumber(load, 2)}x load)`;
    }
  }
  return buildAssumptionsApplyModeReasonLabel(input?.applyGate?.reason);
}

/**
 * @param {{ ready?: boolean, severity?: string } | null | undefined} pace
 * @returns {string}
 */
export function buildAssumptionsFeasibilityText(pace){
  if (!pace?.ready) return "—";
  if (pace.severity === "bad") return "Above plausible range";
  if (pace.severity === "warn") return "Near top of achievable range";
  return "Inside achievable range";
}

/**
 * @param {{ ready?: boolean, coverage?: { availableSignals?: unknown, totalSignals?: unknown } } | null | undefined} advisory
 * @returns {string}
 */
export function buildAssumptionsSignalCoverageText(advisory){
  if (!advisory?.ready){
    return "—";
  }
  const available = Number(advisory?.coverage?.availableSignals);
  const total = Number(advisory?.coverage?.totalSignals);
  if (!Number.isFinite(available) || !Number.isFinite(total)){
    return "—";
  }
  return `${available}/${total}`;
}

/**
 * @param {unknown} turnoutA
 * @param {unknown} turnoutB
 * @returns {string}
 */
export function buildAssumptionsTurnoutCyclesText(turnoutA, turnoutB){
  const a = formatAssumptionsPercent(turnoutA, "");
  const b = formatAssumptionsPercent(turnoutB, "");
  if (!a || !b){
    return "—";
  }
  return `${a} & ${b}`;
}

/**
 * @param {unknown} bandWidth
 * @returns {string}
 */
export function buildAssumptionsBandWidthText(bandWidth){
  const pct = formatAssumptionsOneDecimal(bandWidth, "");
  return pct ? `±${pct}%` : "—";
}

/**
 * @param {unknown} weeks
 * @returns {string}
 */
export function buildAssumptionsWeeksText(weeks){
  if (weeks == null){
    return "—";
  }
  const n = Number(weeks);
  if (!Number.isFinite(n)){
    return "—";
  }
  return String(weeks);
}
