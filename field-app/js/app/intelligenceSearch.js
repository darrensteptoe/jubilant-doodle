// @ts-check
import { buildIntelligenceSearchIndex } from "./intelligenceIndices.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function tokens(input){
  const text = clean(input).toLowerCase();
  if (!text) return [];
  return text.split(/[^a-z0-9._-]+/g).filter(Boolean);
}

function scoreRow(queryTokens, row){
  const hay = String(row?.text || "").toLowerCase();
  const title = String(row?.title || "").toLowerCase();
  if (!hay) return 0;
  let score = 0;
  for (const token of queryTokens){
    if (!token) continue;
    if (title === token) score += 20;
    else if (title.startsWith(token)) score += 14;
    else if (title.includes(token)) score += 10;
    if (hay.includes(token)) score += 4;
  }
  return score;
}

let CACHED_INDEX = null;

function getIndex(){
  if (!CACHED_INDEX) CACHED_INDEX = buildIntelligenceSearchIndex();
  return CACHED_INDEX;
}

/**
 * @param {string=} query
 * @param {{ limit?: number }=} options
 */
export function searchIntelligence(query = "", options = {}){
  const q = clean(query);
  if (!q) return [];
  const tks = tokens(q);
  if (!tks.length) return [];
  const limit = Math.max(1, Number(options?.limit || 20) || 20);

  const scored = [];
  for (const row of getIndex()){
    const score = scoreRow(tks, row);
    if (score <= 0) continue;
    scored.push({ ...row, score });
  }
  scored.sort((a, b) => Number(b.score) - Number(a.score) || String(a.title).localeCompare(String(b.title)));
  return scored.slice(0, limit);
}

export function clearIntelligenceSearchCache(){
  CACHED_INDEX = null;
}

