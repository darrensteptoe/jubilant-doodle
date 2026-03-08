// @ts-check
// Deterministic district evidence compiler for MIT precinct + Census layer.
// Pure utilities only: no DOM, no network, no planning-math mutation.

import {
  allocatePrecinctVotesToGeo,
  normalizeCrosswalkRows,
  normalizePrecinctResults,
} from "./precinctCensusJoin.js";

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function numOrNull(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(n, min, max){
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {unknown[]} rows
 * @returns {Array<{ geoid: string, w: number }>}
 */
export function normalizeGeoUnitsForEvidence(rows){
  const list = Array.isArray(rows) ? rows : [];
  const byGeoid = new Map();
  for (const row of list){
    if (!isObject(row)) continue;
    const geoid = str(row.geoid || row.tract || row.blockGroup);
    const wRaw = numOrNull(row.w ?? row.weight);
    if (!geoid || wRaw == null || wRaw <= 0) continue;
    byGeoid.set(geoid, (byGeoid.get(geoid) || 0) + wRaw);
  }
  const out = Array.from(byGeoid.entries())
    .map(([geoid, w]) => ({ geoid, w }))
    .sort((a, b) => a.geoid.localeCompare(b.geoid));
  return out;
}

/**
 * @param {unknown[]} rows
 * @returns {Array<{ geoid: string, values: Record<string, number> }>}
 */
export function normalizeCensusGeoRows(rows){
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const row of list){
    if (!isObject(row)) continue;
    const geoid = str(row.geoid || row.tract || row.blockGroup);
    if (!geoid) continue;
    const valuesIn = isObject(row.values) ? row.values : (isObject(row.metrics) ? row.metrics : row);
    const values = {};
    for (const key of Object.keys(valuesIn)){
      if (key === "geoid" || key === "tract" || key === "blockGroup" || key === "values" || key === "metrics") continue;
      const n = numOrNull(valuesIn[key]);
      if (n == null) continue;
      values[key] = n;
    }
    out.push({ geoid, values });
  }
  out.sort((a, b) => a.geoid.localeCompare(b.geoid));
  return out;
}

/**
 * @param {{
 *   candidateTotals: Array<{ candidateId: string, votes: number, sharePct: number }>
 *   min?: number,
 *   max?: number
 * }} args
 * @returns {{
 *   index: number,
 *   totalVotes: number,
 *   leaderCandidateId: string | null,
 *   runnerUpCandidateId: string | null,
 *   marginVotes: number,
 *   marginPct: number | null,
 *   competitivenessPct: number | null,
 *   note: string
 * }}
 */
export function derivePersuasionSignalFromElection(args){
  const min = clamp(numOrNull(args?.min) ?? 0.7, 0.1, 5);
  const max = Math.max(min, clamp(numOrNull(args?.max) ?? 1.3, min, 5));
  const totals = Array.isArray(args?.candidateTotals) ? args.candidateTotals : [];
  const ranked = totals
    .map((row) => ({
      candidateId: str(row?.candidateId),
      votes: Number(row?.votes) || 0,
      sharePct: Number(row?.sharePct) || 0,
    }))
    .filter((row) => row.candidateId && row.votes > 0)
    .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));

  const totalVotes = ranked.reduce((sum, row) => sum + row.votes, 0);
  if (totalVotes <= 0 || ranked.length < 2){
    return {
      index: 1,
      totalVotes: 0,
      leaderCandidateId: ranked[0]?.candidateId || null,
      runnerUpCandidateId: ranked[1]?.candidateId || null,
      marginVotes: 0,
      marginPct: null,
      competitivenessPct: null,
      note: "Insufficient election vote history to score persuasion environment.",
    };
  }

  const leader = ranked[0];
  const runnerUp = ranked[1];
  const marginVotes = Math.max(0, leader.votes - runnerUp.votes);
  const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
  const competitivenessPct = marginPct == null ? null : clamp(100 - marginPct, 0, 100);
  const indexRaw = marginPct == null ? 1 : 1 + ((12 - marginPct) / 100);
  const index = clamp(indexRaw, min, max);
  const note = marginPct == null
    ? "No margin available."
    : marginPct <= 3
      ? "Very competitive prior result."
      : marginPct <= 8
        ? "Moderately competitive prior result."
        : "Low competitiveness prior result.";

  return {
    index,
    totalVotes,
    leaderCandidateId: leader.candidateId,
    runnerUpCandidateId: runnerUp.candidateId,
    marginVotes,
    marginPct,
    competitivenessPct,
    note,
  };
}

/**
 * @param {{
 *   geoRows?: Array<{
 *     geoid?: unknown,
 *     totalVotes?: unknown,
 *     candidateVotes?: Record<string, unknown>,
 *     sourcePrecincts?: unknown,
 *     hasElection?: unknown,
 *     hasCensus?: unknown
 *   }>,
 *   maxRows?: unknown,
 * }} args
 * @returns {Array<{
 *   geoid: string,
 *   totalVotes: number,
 *   sourcePrecincts: number,
 *   hasElection: boolean,
 *   hasCensus: boolean,
 *   leaderCandidateId: string | null,
 *   leaderVotes: number,
 *   leaderSharePct: number | null,
 *   runnerUpCandidateId: string | null,
 *   runnerUpVotes: number,
 *   marginVotes: number,
 *   marginPct: number | null,
 *   candidateCount: number
 * }>}
 */
export function summarizeGeoEvidenceLayers(args){
  const rows = Array.isArray(args?.geoRows) ? args.geoRows : [];
  const maxRowsRaw = Math.floor(numOrNull(args?.maxRows) ?? 20);
  const maxRows = clamp(maxRowsRaw, 1, 500);
  const out = [];
  for (const row of rows){
    if (!isObject(row)) continue;
    const geoid = str(row.geoid);
    if (!geoid) continue;
    const totalVotes = Math.max(0, numOrNull(row.totalVotes) ?? 0);
    const sourcePrecincts = Math.max(0, Math.floor(numOrNull(row.sourcePrecincts) ?? 0));
    const hasElection = !!row.hasElection;
    const hasCensus = !!row.hasCensus;
    const candidateVotesIn = isObject(row.candidateVotes) ? row.candidateVotes : {};
    const ranked = Object.keys(candidateVotesIn)
      .map((candidateId) => ({
        candidateId: str(candidateId),
        votes: Math.max(0, numOrNull(candidateVotesIn[candidateId]) ?? 0),
      }))
      .filter((x) => x.candidateId && x.votes > 0)
      .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));

    const leader = ranked[0] || null;
    const runnerUp = ranked[1] || null;
    const leaderVotes = leader ? leader.votes : 0;
    const runnerUpVotes = runnerUp ? runnerUp.votes : 0;
    const marginVotes = Math.max(0, leaderVotes - runnerUpVotes);
    const leaderSharePct = totalVotes > 0 ? (leaderVotes / totalVotes) * 100 : null;
    const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;

    out.push({
      geoid,
      totalVotes,
      sourcePrecincts,
      hasElection,
      hasCensus,
      leaderCandidateId: leader ? leader.candidateId : null,
      leaderVotes,
      leaderSharePct,
      runnerUpCandidateId: runnerUp ? runnerUp.candidateId : null,
      runnerUpVotes,
      marginVotes,
      marginPct,
      candidateCount: ranked.length,
    });
  }
  out.sort((a, b) => (b.totalVotes - a.totalVotes) || a.geoid.localeCompare(b.geoid));
  return out.slice(0, maxRows);
}

/**
 * @param {{
 *   geoRows?: Array<{
 *     geoid?: unknown,
 *     totalVotes?: unknown,
 *     candidateVotes?: Record<string, unknown>,
 *     sourcePrecincts?: unknown,
 *     hasElection?: unknown,
 *     hasCensus?: unknown,
 *     census?: Record<string, unknown>
 *   }>,
 *   maxRows?: unknown,
 * }} args
 * @returns {Array<{
 *   geoid: string,
 *   opportunityScore: number,
 *   competitiveness: number,
 *   voteMassNorm: number,
 *   densityNorm: number,
 *   totalVotes: number,
 *   sourcePrecincts: number,
 *   leaderCandidateId: string | null,
 *   marginPct: number | null,
 *   hasElection: boolean,
 *   hasCensus: boolean,
 *   reasons: string[],
 * }>}
 */
export function summarizeGeoOpportunityLayers(args){
  const rows = Array.isArray(args?.geoRows) ? args.geoRows : [];
  const maxRowsRaw = Math.floor(numOrNull(args?.maxRows) ?? 20);
  const maxRows = clamp(maxRowsRaw, 1, 500);
  const normalized = [];

  for (const row of rows){
    if (!isObject(row)) continue;
    const geoid = str(row.geoid);
    if (!geoid) continue;
    const totalVotes = Math.max(0, numOrNull(row.totalVotes) ?? 0);
    const sourcePrecincts = Math.max(0, Math.floor(numOrNull(row.sourcePrecincts) ?? 0));
    const hasElection = !!row.hasElection;
    const hasCensus = !!row.hasCensus;
    const census = isObject(row.census) ? row.census : {};
    const housingUnits = Math.max(0, numOrNull(census.housing_units ?? census.housingUnits ?? census.housing) ?? 0);
    const pop = Math.max(0, numOrNull(census.pop ?? census.population ?? census.total_population) ?? 0);
    const densityBase = housingUnits > 0
      ? housingUnits
      : (pop > 0 ? pop : totalVotes);

    const candidateVotesIn = isObject(row.candidateVotes) ? row.candidateVotes : {};
    const ranked = Object.keys(candidateVotesIn)
      .map((candidateId) => ({
        candidateId: str(candidateId),
        votes: Math.max(0, numOrNull(candidateVotesIn[candidateId]) ?? 0),
      }))
      .filter((x) => x.candidateId && x.votes > 0)
      .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));
    const leader = ranked[0] || null;
    const runnerUp = ranked[1] || null;
    const leaderVotes = leader ? leader.votes : 0;
    const runnerVotes = runnerUp ? runnerUp.votes : 0;
    const marginVotes = Math.max(0, leaderVotes - runnerVotes);
    const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
    const competitiveness = marginPct == null ? 0.5 : (1 - clamp(marginPct / 35, 0, 1));

    normalized.push({
      geoid,
      totalVotes,
      sourcePrecincts,
      hasElection,
      hasCensus,
      leaderCandidateId: leader ? leader.candidateId : null,
      marginPct,
      competitiveness,
      densityBase,
    });
  }

  if (!normalized.length) return [];
  let maxVotes = 0;
  let maxDensity = 0;
  for (const row of normalized){
    if (row.totalVotes > maxVotes) maxVotes = row.totalVotes;
    if (row.densityBase > maxDensity) maxDensity = row.densityBase;
  }

  const out = [];
  for (const row of normalized){
    const voteMassNorm = maxVotes > 0 ? clamp(row.totalVotes / maxVotes, 0, 1) : 0;
    const densityNorm = maxDensity > 0 ? clamp(row.densityBase / maxDensity, 0, 1) : 0;
    const opportunityScoreRaw = (row.competitiveness * 0.5) + (voteMassNorm * 0.3) + (densityNorm * 0.2);
    const opportunityScore = clamp(opportunityScoreRaw * 100, 0, 100);
    const reasons = [];
    if (row.competitiveness >= 0.7) reasons.push("tight prior margin");
    if (voteMassNorm >= 0.7) reasons.push("high vote mass");
    if (densityNorm >= 0.7) reasons.push("high density proxy");
    if (!row.hasElection) reasons.push("no election layer");
    if (!row.hasCensus) reasons.push("no census layer");
    if (!reasons.length) reasons.push("balanced profile");
    out.push({
      geoid: row.geoid,
      opportunityScore,
      competitiveness: row.competitiveness,
      voteMassNorm,
      densityNorm,
      totalVotes: row.totalVotes,
      sourcePrecincts: row.sourcePrecincts,
      leaderCandidateId: row.leaderCandidateId,
      marginPct: row.marginPct,
      hasElection: row.hasElection,
      hasCensus: row.hasCensus,
      reasons,
    });
  }

  out.sort((a, b) => (b.opportunityScore - a.opportunityScore) || a.geoid.localeCompare(b.geoid));
  return out.slice(0, maxRows);
}

const CENSUS_LAT_KEYS = [
  "centroidLat",
  "centroid_lat",
  "lat",
  "latitude",
  "INTPTLAT",
  "intptlat",
  "INTPTLAT20",
  "geoLat",
  "y",
  "Y",
];

const CENSUS_LON_KEYS = [
  "centroidLon",
  "centroid_lon",
  "lon",
  "lng",
  "longitude",
  "INTPTLON",
  "intptlon",
  "INTPTLON20",
  "geoLon",
  "x",
  "X",
];

/**
 * @param {Record<string, any>} values
 * @param {string[]} keys
 * @returns {number | null}
 */
function firstFiniteByKeys(values, keys){
  for (const key of keys){
    const n = numOrNull(values[key]);
    if (n != null) return n;
  }
  return null;
}

/**
 * @param {{
 *   census?: Record<string, any>,
 * }} row
 * @returns {{ lat: number, lon: number } | null}
 */
export function extractGeoEvidenceCentroid(row){
  const census = isObject(row?.census) ? row.census : {};
  const lat = firstFiniteByKeys(census, CENSUS_LAT_KEYS);
  const lon = firstFiniteByKeys(census, CENSUS_LON_KEYS);
  if (lat == null || lon == null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * @param {{
 *   geoRows?: Array<{
 *     geoid?: unknown,
 *     totalVotes?: unknown,
 *     candidateVotes?: Record<string, unknown>,
 *     sourcePrecincts?: unknown,
 *     hasElection?: unknown,
 *     hasCensus?: unknown,
 *     census?: Record<string, unknown>
 *   }>,
 *   maxPoints?: unknown,
 * }} args
 * @returns {{
 *   available: boolean,
 *   reason: string,
 *   bounds: { minLat: number, maxLat: number, minLon: number, maxLon: number } | null,
 *   points: Array<{
 *     geoid: string,
 *     lat: number,
 *     lon: number,
 *     totalVotes: number,
 *     sourcePrecincts: number,
 *     hasElection: boolean,
 *     hasCensus: boolean,
 *     leaderCandidateId: string | null,
 *     marginPct: number | null,
 *     population?: number | null,
 *     housingUnits?: number | null
 *   }>
 * }}
 */
export function buildGeoEvidenceMapLayer(args){
  const rows = Array.isArray(args?.geoRows) ? args.geoRows : [];
  const maxPointsRaw = Math.floor(numOrNull(args?.maxPoints) ?? 300);
  const maxPoints = clamp(maxPointsRaw, 1, 2000);
  const points = [];

  for (const row of rows){
    if (!isObject(row)) continue;
    const geoid = str(row.geoid);
    if (!geoid) continue;
    const centroid = extractGeoEvidenceCentroid(row);
    if (!centroid) continue;
    const totalVotes = Math.max(0, numOrNull(row.totalVotes) ?? 0);
    const sourcePrecincts = Math.max(0, Math.floor(numOrNull(row.sourcePrecincts) ?? 0));
    const hasElection = !!row.hasElection;
    const hasCensus = !!row.hasCensus;
    const candidateVotesIn = isObject(row.candidateVotes) ? row.candidateVotes : {};
    const ranked = Object.keys(candidateVotesIn)
      .map((candidateId) => ({
        candidateId: str(candidateId),
        votes: Math.max(0, numOrNull(candidateVotesIn[candidateId]) ?? 0),
      }))
      .filter((x) => x.candidateId && x.votes > 0)
      .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));
    const leader = ranked[0] || null;
    const runnerUp = ranked[1] || null;
    const marginVotes = leader ? Math.max(0, leader.votes - (runnerUp ? runnerUp.votes : 0)) : 0;
    const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
    const census = isObject(row.census) ? row.census : {};
    const population = numOrNull(census.pop) ?? numOrNull(census.B01003_001E) ?? numOrNull(census.total_population);
    const housingUnits = numOrNull(census.housing_units) ?? numOrNull(census.B25001_001E) ?? numOrNull(census.total_housing_units);
    points.push({
      geoid,
      lat: centroid.lat,
      lon: centroid.lon,
      totalVotes,
      sourcePrecincts,
      hasElection,
      hasCensus,
      leaderCandidateId: leader ? leader.candidateId : null,
      marginPct,
      population,
      housingUnits,
    });
  }

  points.sort((a, b) => (b.totalVotes - a.totalVotes) || a.geoid.localeCompare(b.geoid));
  const limited = points.slice(0, maxPoints);
  if (!limited.length){
    return {
      available: false,
      reason: "Map unavailable: no centroid coordinates found in census GEO rows.",
      bounds: null,
      points: [],
    };
  }

  let minLat = limited[0].lat;
  let maxLat = limited[0].lat;
  let minLon = limited[0].lon;
  let maxLon = limited[0].lon;
  for (const row of limited){
    if (row.lat < minLat) minLat = row.lat;
    if (row.lat > maxLat) maxLat = row.lat;
    if (row.lon < minLon) minLon = row.lon;
    if (row.lon > maxLon) maxLon = row.lon;
  }

  return {
    available: true,
    reason: "ok",
    bounds: { minLat, maxLat, minLon, maxLon },
    points: limited,
  };
}

/**
 * @param {{
 *   precinctResults?: unknown[],
 *   crosswalkRows?: unknown[],
 *   geoUnits?: unknown[],
 *   maxRows?: unknown,
 * }} args
 * @returns {Array<{
 *   precinctId: string,
 *   totalVotes: number,
 *   leaderCandidateId: string | null,
 *   leaderVotes: number,
 *   leaderSharePct: number | null,
 *   runnerUpCandidateId: string | null,
 *   runnerUpVotes: number,
 *   marginVotes: number,
 *   marginPct: number | null,
 *   candidateCount: number,
 *   mappedGeoCount: number,
 *   crosswalkWeightSum: number,
 *   effectiveWeightSum: number,
 *   districtWeightPct: number,
 *   topGeoLinks: Array<{ geoid: string, effectiveWeightPct: number }>
 * }>}
 */
export function summarizePrecinctEvidenceLayers(args){
  const precinctResults = normalizePrecinctResults(args?.precinctResults || []);
  const crosswalkRows = normalizeCrosswalkRows(args?.crosswalkRows || []);
  const geoUnits = normalizeGeoUnitsForEvidence(args?.geoUnits || []);
  const hasGeoUnits = geoUnits.length > 0;
  const maxRowsRaw = Math.floor(numOrNull(args?.maxRows) ?? 20);
  const maxRows = clamp(maxRowsRaw, 1, 2000);

  const unitMap = new Map(geoUnits.map((row) => [row.geoid, row.w]));
  const linksByPrecinct = new Map();
  for (const row of crosswalkRows){
    const districtWeight = hasGeoUnits ? (unitMap.get(row.geoid) || 0) : 1;
    const effectiveWeight = row.weight * districtWeight;
    const list = linksByPrecinct.get(row.precinctId) || [];
    list.push({
      geoid: row.geoid,
      crosswalkWeight: row.weight,
      effectiveWeight,
      included: effectiveWeight > 0,
    });
    linksByPrecinct.set(row.precinctId, list);
  }

  const out = [];
  for (const row of precinctResults){
    const links = linksByPrecinct.get(row.precinctId) || [];
    const ranked = Object.keys(row.candidateVotes || {})
      .map((candidateId) => ({
        candidateId: str(candidateId),
        votes: Math.max(0, numOrNull(row.candidateVotes[candidateId]) ?? 0),
      }))
      .filter((x) => x.candidateId && x.votes > 0)
      .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));

    const leader = ranked[0] || null;
    const runnerUp = ranked[1] || null;
    const leaderVotes = leader ? leader.votes : 0;
    const runnerUpVotes = runnerUp ? runnerUp.votes : 0;
    const marginVotes = Math.max(0, leaderVotes - runnerUpVotes);
    const totalVotes = Math.max(0, numOrNull(row.totalVotes) ?? 0);
    const leaderSharePct = totalVotes > 0 ? (leaderVotes / totalVotes) * 100 : null;
    const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
    const geoSet = new Set();
    let crosswalkWeightSum = 0;
    let effectiveWeightSum = 0;
    const topGeoLinksRaw = [];
    for (const link of links){
      crosswalkWeightSum += Math.max(0, numOrNull(link.crosswalkWeight) ?? 0);
      effectiveWeightSum += Math.max(0, numOrNull(link.effectiveWeight) ?? 0);
      if (link.included) geoSet.add(link.geoid);
      topGeoLinksRaw.push({
        geoid: link.geoid,
        effectiveWeight: Math.max(0, numOrNull(link.effectiveWeight) ?? 0),
      });
    }
    const districtWeightPct = clamp(effectiveWeightSum * 100, 0, 100);
    topGeoLinksRaw.sort((a, b) => (b.effectiveWeight - a.effectiveWeight) || a.geoid.localeCompare(b.geoid));
    const topGeoLinks = topGeoLinksRaw
      .filter((x) => x.effectiveWeight > 0 && x.geoid)
      .slice(0, 3)
      .map((x) => ({
        geoid: x.geoid,
        effectiveWeightPct: clamp(x.effectiveWeight * 100, 0, 100),
      }));
    out.push({
      precinctId: row.precinctId,
      totalVotes,
      leaderCandidateId: leader ? leader.candidateId : null,
      leaderVotes,
      leaderSharePct,
      runnerUpCandidateId: runnerUp ? runnerUp.candidateId : null,
      runnerUpVotes,
      marginVotes,
      marginPct,
      candidateCount: ranked.length,
      mappedGeoCount: geoSet.size,
      crosswalkWeightSum,
      effectiveWeightSum,
      districtWeightPct,
      topGeoLinks,
    });
  }

  out.sort((a, b) => (b.totalVotes - a.totalVotes) || a.precinctId.localeCompare(b.precinctId));
  return out.slice(0, maxRows);
}

/**
 * @param {{
 *   geoUnits?: unknown[],
 *   precinctResults?: unknown[],
 *   crosswalkRows?: unknown[],
 *   censusGeoRows?: unknown[],
 *   normalizeCrosswalkWeights?: boolean
 * }} args
 * @returns {{
 *   summary: {
 *     selectedGeoCount: number,
 *     geoRowsCount: number,
 *     totalVotes: number,
 *     totalPrecincts: number,
 *     totalPrecinctLinks: number,
 *     districtWeightSum: number,
 *   },
 *   candidateTotals: Array<{ candidateId: string, votes: number, sharePct: number }>,
 *   persuasionSignal: ReturnType<typeof derivePersuasionSignalFromElection>,
 *   precinctToGeo: Array<{
 *     precinctId: string,
 *     geoid: string,
 *     crosswalkWeight: number,
 *     districtWeight: number,
 *     effectiveWeight: number
 *   }>,
 *   geoRows: Array<{
 *     geoid: string,
 *     districtWeight: number,
 *     totalVotes: number,
 *     candidateVotes: Record<string, number>,
 *     census: Record<string, number>,
 *     sourcePrecincts: number,
 *     hasElection: boolean,
 *     hasCensus: boolean
 *   }>,
 *   censusTotals: Record<string, number>,
 *   reconciliation: {
 *     inputVotes: number,
 *     allocatedVotes: number,
 *     unmatchedVotes: number,
 *     coveragePct: number,
 *     deltaVotes: number,
 *     deltaPct: number
 *   },
 *   warnings: string[]
 * }}
 */
export function compileDistrictEvidence(args){
  const geoUnits = normalizeGeoUnitsForEvidence(args?.geoUnits || []);
  const hasGeoUnits = geoUnits.length > 0;
  const unitMap = new Map(geoUnits.map((u) => [u.geoid, u.w]));
  const districtWeightSum = geoUnits.reduce((sum, u) => sum + u.w, 0);

  const join = allocatePrecinctVotesToGeo({
    precinctResults: args?.precinctResults || [],
    crosswalkRows: args?.crosswalkRows || [],
    normalizeWeights: args?.normalizeCrosswalkWeights !== false,
  });
  const censusRows = normalizeCensusGeoRows(args?.censusGeoRows || []);
  const censusByGeoid = new Map(censusRows.map((row) => [row.geoid, row.values]));
  const electionByGeoid = new Map((join.perGeo || []).map((row) => [row.geoid, row]));

  const geoidSet = new Set();
  for (const row of join.perGeo || []) geoidSet.add(str(row?.geoid));
  for (const row of censusRows) geoidSet.add(row.geoid);
  for (const row of geoUnits) geoidSet.add(row.geoid);
  const geoids = Array.from(geoidSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const geoRows = [];
  const candidateTotalsMap = new Map();
  const censusTotalsMap = new Map();
  let totalVotes = 0;
  let missingElectionForSelected = 0;
  let missingCensusForSelected = 0;

  for (const geoid of geoids){
    const districtWeight = hasGeoUnits ? (unitMap.get(geoid) || 0) : 1;
    if (hasGeoUnits && !(districtWeight > 0)) continue;

    const election = electionByGeoid.get(geoid) || null;
    const census = censusByGeoid.get(geoid) || {};
    const candidateVotes = {};

    for (const candId of Object.keys(election?.candidateVotes || {})){
      const scaled = (Number(election?.candidateVotes?.[candId]) || 0) * districtWeight;
      if (!(scaled > 0)) continue;
      candidateVotes[candId] = scaled;
      candidateTotalsMap.set(candId, (candidateTotalsMap.get(candId) || 0) + scaled);
    }

    const scaledVotes = (Number(election?.totalVotes) || 0) * districtWeight;
    totalVotes += scaledVotes;

    const censusOut = {};
    for (const key of Object.keys(census)){
      const scaled = (Number(census[key]) || 0) * districtWeight;
      if (!Number.isFinite(scaled)) continue;
      censusOut[key] = scaled;
      censusTotalsMap.set(key, (censusTotalsMap.get(key) || 0) + scaled);
    }

    const hasElection = !!election;
    const hasCensus = Object.keys(censusOut).length > 0;
    if (hasGeoUnits){
      if (!hasElection) missingElectionForSelected += 1;
      if (!hasCensus) missingCensusForSelected += 1;
    }

    geoRows.push({
      geoid,
      districtWeight,
      totalVotes: scaledVotes,
      candidateVotes,
      census: censusOut,
      sourcePrecincts: Number(election?.sourcePrecincts) || 0,
      hasElection,
      hasCensus,
    });
  }

  geoRows.sort((a, b) => a.geoid.localeCompare(b.geoid));

  const candidateTotals = Array.from(candidateTotalsMap.entries())
    .map(([candidateId, votes]) => ({
      candidateId,
      votes,
      sharePct: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
    }))
    .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));

  const persuasionSignal = derivePersuasionSignalFromElection({ candidateTotals });

  const precinctLinks = normalizeCrosswalkRows(args?.crosswalkRows || [])
    .map((row) => {
      const districtWeight = hasGeoUnits ? (unitMap.get(row.geoid) || 0) : 1;
      return {
        precinctId: row.precinctId,
        geoid: row.geoid,
        crosswalkWeight: row.weight,
        districtWeight,
        effectiveWeight: row.weight * districtWeight,
      };
    })
    .filter((row) => !hasGeoUnits || row.districtWeight > 0)
    .sort((a, b) => {
      const p = a.precinctId.localeCompare(b.precinctId);
      return p !== 0 ? p : a.geoid.localeCompare(b.geoid);
    });

  const warnings = [];
  const joinWarnings = Array.isArray(join.warnings) ? join.warnings : [];
  for (const w of joinWarnings){
    const msg = str(w);
    if (msg) warnings.push(msg);
  }
  if (hasGeoUnits){
    if (missingElectionForSelected > 0){
      warnings.push(`Selected geo units without linked election history: ${missingElectionForSelected}.`);
    }
    if (missingCensusForSelected > 0){
      warnings.push(`Selected geo units without census rows: ${missingCensusForSelected}.`);
    }
    if (districtWeightSum > 0 && Math.abs(districtWeightSum - 1) > 0.01){
      warnings.push(`Geo unit weights sum to ${districtWeightSum.toFixed(4)} (expected near 1.0).`);
    }
    if (geoRows.length === 0 && (censusRows.length > 0 || (Array.isArray(join.perGeo) && join.perGeo.length > 0))){
      warnings.push("Selected geo units do not overlap imported GEO evidence rows.");
    }
  }

  /** @type {Record<string, number>} */
  const censusTotals = {};
  for (const [k, v] of Array.from(censusTotalsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))){
    censusTotals[k] = v;
  }

  const precinctsUsed = new Set(precinctLinks.map((row) => row.precinctId)).size;
  return {
    summary: {
      selectedGeoCount: hasGeoUnits ? geoUnits.length : 0,
      geoRowsCount: geoRows.length,
      totalVotes,
      totalPrecincts: precinctsUsed || normalizePrecinctResults(args?.precinctResults || []).length,
      totalPrecinctLinks: precinctLinks.length,
      districtWeightSum,
    },
    candidateTotals,
    persuasionSignal,
    precinctToGeo: precinctLinks,
    geoRows,
    censusTotals,
    reconciliation: join.reconciliation,
    warnings,
  };
}
