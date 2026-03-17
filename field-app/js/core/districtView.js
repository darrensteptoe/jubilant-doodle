// @ts-check

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
