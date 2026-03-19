// @ts-check
import {
  coerceFiniteNumber,
  formatFixedNumber,
  formatPercentFromUnit,
  formatWholeNumberByMode,
  roundWholeNumberByMode,
} from "./utils.js";

export const DISTRICT_STATUS_AWAITING_INPUTS = "Awaiting inputs";

/**
 * @param {{ raceType?: string, electionDate?: string, mode?: string }=} input
 * @returns {string}
 */
export function deriveDistrictRaceCardStatus(input = {}){
  const raceType = String(input.raceType || "").trim();
  const electionDate = String(input.electionDate || "").trim();
  const mode = String(input.mode || "").trim();
  if (raceType && electionDate && mode){
    return "Configured";
  }
  if (raceType || electionDate || mode){
    return "Needs date";
  }
  return "Awaiting context";
}

/**
 * @param {{ universe?: string, basis?: string, sourceNote?: string }=} input
 * @returns {string}
 */
export function deriveDistrictElectorateCardStatus(input = {}){
  const universe = String(input.universe || "").trim();
  const basis = String(input.basis || "").trim();
  const sourceNote = String(input.sourceNote || "").trim();
  if (universe && basis){
    return sourceNote ? "Sourced" : "Universe set";
  }
  return "Awaiting universe";
}

/**
 * @param {{ warning?: string, supportTotal?: string }=} input
 * @returns {string}
 */
export function deriveDistrictBaselineCardStatus(input = {}){
  const warning = String(input.warning || "").trim();
  const supportTotal = String(input.supportTotal || "").trim();
  if (warning){
    return "Check totals";
  }
  if (supportTotal === "100.0%" || supportTotal === "100%" || supportTotal === "100.00%"){
    return "Balanced";
  }
  if (supportTotal && supportTotal !== "—" && supportTotal !== "-"){
    return "Ballot set";
  }
  return "Awaiting ballot";
}

/**
 * @param {{ turnoutExpected?: string, turnoutA?: string, turnoutB?: string }=} input
 * @returns {string}
 */
export function deriveDistrictTurnoutCardStatus(input = {}){
  const turnoutExpected = String(input.turnoutExpected || "").trim();
  const turnoutA = String(input.turnoutA || "").trim();
  const turnoutB = String(input.turnoutB || "").trim();
  if (turnoutA && turnoutB && turnoutExpected && turnoutExpected !== "—"){
    return "2 cycles set";
  }
  if (turnoutA || turnoutB){
    return "Incomplete";
  }
  return "Awaiting turnout";
}

/**
 * @param {{ enabled?: boolean, warning?: string }=} input
 * @returns {string}
 */
export function deriveDistrictStructureCardStatus(input = {}){
  const enabled = !!input.enabled;
  const warning = String(input.warning || "").trim();
  if (!enabled){
    return "Weighting off";
  }
  if (warning){
    return "Check shares";
  }
  return "Weighted";
}

/**
 * @param {{ persuasionNeed?: string, projectedVotes?: string, universe?: string }=} snapshot
 * @returns {string}
 */
export function deriveDistrictSummaryCardStatus(snapshot = {}){
  const need = String(snapshot?.persuasionNeed || "").trim();
  const projected = String(snapshot?.projectedVotes || "").trim();
  const universe = String(snapshot?.universe || "").trim();
  if (!universe || universe === "—"){
    return "Awaiting baseline";
  }
  if (need && need !== "0" && need !== "—"){
    return "Need path";
  }
  if (projected && projected !== "—"){
    return "Baseline ready";
  }
  return "Awaiting baseline";
}

/**
 * @param {{ status?: string, geoStats?: string }=} input
 * @returns {string}
 */
export function deriveDistrictCensusCardStatus(input = {}){
  const status = String(input.status || "").toLowerCase();
  const geoStats = String(input.geoStats || "").toLowerCase();
  if (status.includes("error") || status.includes("failed")){
    return "Attention";
  }
  if (geoStats.includes("rows loaded") && !geoStats.includes("0 rows loaded")){
    return "Rows loaded";
  }
  if (status.includes("ready")){
    return "Ready";
  }
  if (status || geoStats){
    return "In progress";
  }
  return "Awaiting GEOs";
}

/**
 * @param {{ status?: string, rowCount?: number }=} input
 * @returns {string}
 */
export function deriveDistrictTargetingCardStatus(input = {}){
  const status = String(input.status || "").toLowerCase();
  const rowCount = Number(input.rowCount || 0);
  if (rowCount > 0){
    return "Ranks ready";
  }
  if (status.includes("run targeting")){
    return "Run targeting";
  }
  if (status.includes("unavailable") || status.includes("failed")){
    return "Unavailable";
  }
  if (status){
    return "Awaiting run";
  }
  return "Run targeting";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyDistrictStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(configured|sourced|universe set|balanced|2 cycles set|weighted|baseline ready|rows loaded|ready|ranks ready)/.test(lower)){
    return "ok";
  }
  if (/(attention|unavailable|failed|check totals|check shares)/.test(lower)){
    return "bad";
  }
  if (/(awaiting|needs date|incomplete|weighting off|need path|in progress|run targeting|awaiting run)/.test(lower)){
    return "warn";
  }
  return "neutral";
}

function formatWhole(value, formatInt){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return "0";
  }
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0;
  if (typeof formatInt === "function"){
    return String(formatInt(rounded));
  }
  return formatWholeNumberByMode(rounded, { mode: "round", fallback: "0" });
}

const toFiniteNumber = coerceFiniteNumber;

function formatPercent(value, digits = 1, formatter = null){
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  if (typeof formatter === "function"){
    return String(formatter(n, digits));
  }
  return `${formatFixedNumber(n, digits, "—")}%`;
}

function districtResolutionLabel(resolution){
  const key = String(resolution || "").trim();
  if (!key) return "—";
  const labels = {
    place: "Place",
    tract: "Tract",
    block_group: "Block group",
    congressional_district: "Congressional district",
    state_senate_district: "State senate district",
    state_house_district: "State house district",
  };
  return labels[key] || key.replace(/_/g, " ");
}

/**
 * @param {Record<string, any> | null | undefined} censusState
 * @returns {string}
 */
export function buildDistrictCensusContextHint(censusState){
  const census = censusState && typeof censusState === "object" ? censusState : {};
  const resolution = String(census.resolution || "").trim();
  const stateFips = String(census.stateFips || "").trim();
  const countyFips = String(census.countyFips || "").trim();
  const placeFips = String(census.placeFips || "").trim();
  if (!stateFips){
    return "Set state and resolution to define Census context.";
  }
  const label = districtResolutionLabel(resolution);
  if (resolution === "place"){
    if (!placeFips){
      return `${label} context: state ${stateFips}. Select place for bounded fetches.`;
    }
    return `${label} context: state ${stateFips}, place ${placeFips}.`;
  }
  if (resolution === "tract" || resolution === "block_group"){
    if (!countyFips){
      return `${label} context: state ${stateFips}. Select county for this resolution.`;
    }
    return `${label} context: state ${stateFips}, county ${countyFips}.`;
  }
  return `${label} context: state ${stateFips}.`;
}

/**
 * @param {Record<string, any> | null | undefined} censusState
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {string}
 */
export function buildDistrictSelectionSetStatus(censusState, options = {}){
  const census = censusState && typeof censusState === "object" ? censusState : {};
  const sets = Array.isArray(census.selectionSets) ? census.selectionSets : [];
  if (!sets.length){
    return "No saved selection sets.";
  }
  const active = String(census.selectedSelectionSetKey || "").trim();
  if (active){
    return `Loaded selection set: ${active}.`;
  }
  return `${formatWhole(sets.length, options?.formatInt || null)} saved selection set(s).`;
}

/**
 * @param {Record<string, any> | null | undefined} censusState
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {string}
 */
export function buildDistrictGeoStatsText(censusState, options = {}){
  const census = censusState && typeof censusState === "object" ? censusState : {};
  const selected = Array.isArray(census.selectedGeoids) ? census.selectedGeoids.length : 0;
  const rows = Number.isFinite(Number(census.loadedRowCount))
    ? Math.max(0, roundWholeNumberByMode(census.loadedRowCount, { mode: "floor", fallback: 0 }) ?? 0)
    : 0;
  return `${formatWhole(selected, options?.formatInt || null)} selected. ${formatWhole(rows, options?.formatInt || null)} rows loaded.`;
}

/**
 * @param {Record<string, any> | null | undefined} censusState
 * @returns {string}
 */
export function buildDistrictSelectionSummaryText(censusState){
  const census = censusState && typeof censusState === "object" ? censusState : {};
  const selected = Array.isArray(census.selectedGeoids)
    ? census.selectedGeoids.map((id) => String(id || "").trim()).filter((id) => !!id)
    : [];
  if (!selected.length){
    return "No GEO selected.";
  }
  const preview = selected.slice(0, 2).join(", ");
  const extra = selected.length > 2 ? ` +${selected.length - 2} more` : "";
  return `${preview}${extra}`;
}

/**
 * @param {Record<string, any> | null | undefined} currentState
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {string}
 */
export function buildDistrictRaceFootprintStatus(currentState, options = {}){
  const fp = currentState?.raceFootprint && typeof currentState.raceFootprint === "object"
    ? currentState.raceFootprint
    : null;
  const count = Array.isArray(fp?.geoids) ? fp.geoids.length : 0;
  if (!count){
    return "Race footprint not set. Use Census card to set canonical race boundary.";
  }
  const label = districtResolutionLabel(String(fp?.resolution || "").trim());
  return `Race footprint set: ${formatWhole(count, options?.formatInt || null)} GEO(s) (${label}).`;
}

/**
 * @param {Record<string, any> | null | undefined} currentState
 * @returns {string}
 */
export function buildDistrictAssumptionProvenanceStatus(currentState){
  const prov = currentState?.assumptionsProvenance && typeof currentState.assumptionsProvenance === "object"
    ? currentState.assumptionsProvenance
    : null;
  const generatedAt = String(prov?.generatedAt || "").trim();
  if (!generatedAt){
    return "Assumption provenance not set.";
  }
  const year = String(prov?.acsYear || "").trim() || "—";
  const metricSet = String(prov?.metricSet || "").trim() || "—";
  return `Assumption provenance set (${year}, ${metricSet}).`;
}

/**
 * @param {Record<string, any> | null | undefined} currentState
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {string}
 */
export function buildDistrictFootprintCapacityStatus(currentState, options = {}){
  const capacity = currentState?.footprintCapacity && typeof currentState.footprintCapacity === "object"
    ? currentState.footprintCapacity
    : null;
  const population = Number(capacity?.population);
  if (!Number.isFinite(population) || population <= 0){
    return "Footprint capacity: not set.";
  }
  return `Footprint capacity: ${formatWhole(population, options?.formatInt || null)}.`;
}

/**
 * @param {Record<string, any> | null | undefined} censusState
 * @returns {string}
 */
export function buildDistrictApplyAdjustmentsStatus(censusState){
  const census = censusState && typeof censusState === "object" ? censusState : {};
  return census.applyAdjustedAssumptions
    ? "Census-adjusted assumptions are ON."
    : "Census-adjusted assumptions are OFF.";
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDistrictMultiplier(value, digits = 2, fallback = "—"){
  const n = toFiniteNumber(value);
  if (n == null){
    return fallback;
  }
  const places = Math.max(0, roundWholeNumberByMode(Number(digits), { mode: "floor", fallback: 0 }) ?? 0);
  return formatFixedNumber(n, places, fallback);
}

function formatDistrictInputValue(value, digits = 1, fallback = ""){
  if (value == null) return fallback;
  if (typeof value === "string" && String(value).trim() === "") return fallback;
  const n = toFiniteNumber(value);
  if (n == null){
    return fallback;
  }
  const places = Math.max(0, roundWholeNumberByMode(Number(digits), { mode: "floor", fallback: 0 }) ?? 0);
  return formatFixedNumber(n, places, fallback);
}

function toOptionalFiniteNumber(value){
  if (value == null) return null;
  if (typeof value === "string" && String(value).trim() === "") return null;
  const n = toFiniteNumber(value);
  return n == null ? null : n;
}

/**
 * Canonical view projection for district structure/universe input fields.
 * Keeps one-decimal share formatting and two-decimal retention formatting
 * out of render modules.
 *
 * @param {{
 *   enabled?: unknown,
 *   percents?: Record<string, unknown> | null,
 *   retentionFactor?: unknown,
 *   wasNormalized?: unknown,
 *   warning?: unknown,
 * } | null | undefined} config
 * @param {{ defaultRetentionFactor?: unknown }=} options
 * @returns {{
 *   enabled: boolean,
 *   demPctInput: string,
 *   repPctInput: string,
 *   npaPctInput: string,
 *   otherPctInput: string,
 *   retentionFactorInput: string,
 *   warningVisible: boolean,
 *   warningText: string,
 * }}
 */
export function buildDistrictStructureInputView(config, options = {}){
  const src = config && typeof config === "object" ? config : {};
  const percents = src?.percents && typeof src.percents === "object" ? src.percents : {};
  const defaultRetention = toOptionalFiniteNumber(options?.defaultRetentionFactor);
  const retention = toOptionalFiniteNumber(src?.retentionFactor);
  const resolvedRetention = retention == null ? defaultRetention : retention;
  const enabled = !!src?.enabled;
  const warningText = (enabled && src?.wasNormalized) ? String(src?.warning || "").trim() : "";
  return {
    enabled,
    demPctInput: formatDistrictInputValue(percents?.demPct, 1, ""),
    repPctInput: formatDistrictInputValue(percents?.repPct, 1, ""),
    npaPctInput: formatDistrictInputValue(percents?.npaPct, 1, ""),
    otherPctInput: formatDistrictInputValue(percents?.otherPct, 1, ""),
    retentionFactorInput: formatDistrictInputValue(resolvedRetention, 2, ""),
    warningVisible: !!warningText,
    warningText,
  };
}

/**
 * @param {{
 *   enabled?: boolean,
 *   adjusted?: Record<string, any> | null,
 *   formatMultiplier?: ((value: number) => string) | null,
 *   formatPercentFromRate?: ((value: number) => string) | null,
 * }=} input
 * @returns {string}
 */
export function buildDistrictStructureDerivedText(input = {}){
  const enabled = !!input?.enabled;
  if (!enabled){
    return "Disabled (baseline behavior).";
  }

  const adjusted = input?.adjusted && typeof input.adjusted === "object" ? input.adjusted : {};
  const formatMultiplier = typeof input?.formatMultiplier === "function"
    ? input.formatMultiplier
    : (value) => formatDistrictMultiplier(value, 2, "—");
  const formatPercentFromRate = typeof input?.formatPercentFromRate === "function"
    ? input.formatPercentFromRate
    : (value) => formatPercentFromUnit(value, 1);

  const pMult = toFiniteNumber(adjusted?.meta?.persuasionMultiplier);
  const tMult = toFiniteNumber(adjusted?.meta?.turnoutMultiplier);
  const turnoutBoost = toFiniteNumber(adjusted?.meta?.turnoutBoostApplied);
  const srAdj = toFiniteNumber(adjusted?.srAdj);
  const trAdj = toFiniteNumber(adjusted?.trAdj);
  const parts = [];
  parts.push(`Persuasion multiplier: ${pMult == null ? "—" : formatMultiplier(pMult)}`);
  parts.push(`Turnout multiplier: ${tMult == null ? "—" : formatMultiplier(tMult)}`);
  parts.push(`Turnout boost: ${turnoutBoost == null ? "—" : formatPercentFromRate(turnoutBoost)}`);
  parts.push(`Effective support rate: ${srAdj == null ? "—" : formatPercentFromRate(srAdj)}`);
  parts.push(`Effective turnout reliability: ${trAdj == null ? "—" : formatPercentFromRate(trAdj)}`);
  return parts.join(" · ");
}

/**
 * @param {unknown} ts
 * @returns {string}
 */
export function buildDistrictLastFetchText(ts){
  const raw = String(ts || "").trim();
  if (!raw) return "No fetch yet.";
  try{
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return `Last fetch: ${raw}`;
    return `Last fetch: ${d.toLocaleString()}`;
  } catch {
    return `Last fetch: ${raw}`;
  }
}

/**
 * @param {Record<string, any> | null | undefined} currentState
 * @returns {number | null}
 */
export function computeDistrictSupportTotalPctFromState(currentState){
  const candidates = Array.isArray(currentState?.candidates) ? currentState.candidates : [];
  const total = candidates.reduce((sum, cand) => {
    const pct = toFiniteNumber(cand?.supportPct);
    return pct == null ? sum : (sum + pct);
  }, 0);
  const undecided = toFiniteNumber(currentState?.undecidedPct);
  const withUndecided = undecided == null ? total : (total + undecided);
  if (candidates.length === 0 && undecided == null){
    return null;
  }
  if (!Number.isFinite(withUndecided)){
    return null;
  }
  return withUndecided;
}

/**
 * @param {Record<string, any> | null | undefined} currentState
 * @param {{ formatPercent?: ((value: number, digits?: number) => string) | null, formatInt?: ((value: number) => string) | null }=} options
 * @returns {{
 *   expectedText: string,
 *   bandText: string,
 *   votesPer1pctText: string,
 *   expectedPct: number | null,
 *   bestPct: number | null,
 *   worstPct: number | null,
 *   votesPer1pct: number | null,
 * }}
 */
export function buildDistrictTurnoutFallbackView(currentState, options = {}){
  const turnoutA = toFiniteNumber(currentState?.turnoutA);
  const turnoutB = toFiniteNumber(currentState?.turnoutB);
  const bandWidth = toFiniteNumber(currentState?.bandWidth);
  const expected = (turnoutA != null && turnoutB != null) ? (turnoutA + turnoutB) / 2 : null;
  const best = (expected != null && bandWidth != null) ? Math.min(100, expected + bandWidth) : null;
  const worst = (expected != null && bandWidth != null) ? Math.max(0, expected - bandWidth) : null;
  const universeSize = toFiniteNumber(currentState?.universeSize);
  const votesPer1pct = (universeSize != null)
    ? Math.max(0, roundWholeNumberByMode(universeSize * 0.01, { mode: "round", fallback: 0 }) ?? 0)
    : null;
  return {
    expectedText: formatPercent(expected, 1, options?.formatPercent || null),
    bandText: (best == null || worst == null)
      ? "—"
      : `${formatPercent(best, 1, options?.formatPercent || null)} / ${formatPercent(worst, 1, options?.formatPercent || null)}`,
    votesPer1pctText: votesPer1pct == null ? "—" : formatWhole(votesPer1pct, options?.formatInt || null),
    expectedPct: expected,
    bestPct: best,
    worstPct: worst,
    votesPer1pct,
  };
}
