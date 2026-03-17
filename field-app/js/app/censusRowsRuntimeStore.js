// @ts-check

const censusRowsByKey = new Map();

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function normalizeRowsByGeoid(input){
  return input && typeof input === "object" ? input : {};
}

/**
 * Cache active Census rows for a state/context key.
 * @param {string} rowsKey
 * @param {Record<string, any>} rowsByGeoid
 */
export function setCensusRowsForKey(rowsKey, rowsByGeoid){
  const key = cleanText(rowsKey);
  if (!key) return;
  censusRowsByKey.set(key, normalizeRowsByGeoid(rowsByGeoid));
}

/**
 * Resolve active Census rows for the current Census state.
 * @param {{ activeRowsKey?: string } | null | undefined} censusState
 * @returns {Record<string, any>}
 */
export function getCensusRowsForState(censusState){
  const key = cleanText(censusState?.activeRowsKey);
  if (!key) return {};
  const hit = censusRowsByKey.get(key);
  return normalizeRowsByGeoid(hit);
}

/**
 * Remove cached Census rows for a specific key.
 * @param {string} rowsKey
 */
export function clearCensusRowsForKey(rowsKey){
  const key = cleanText(rowsKey);
  if (!key) return;
  censusRowsByKey.delete(key);
}

export function clearAllCensusRows(){
  censusRowsByKey.clear();
}

