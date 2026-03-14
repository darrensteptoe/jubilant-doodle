// @ts-check
// Precinct -> Census weighted allocation utilities (pure).
// This is the deterministic join layer used by MIT precinct + Census integration.

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
 * @param {unknown[]} rows
 * @returns {Array<{ precinctId: string, totalVotes: number, candidateVotes: Record<string, number> }>}
 */
export function normalizePrecinctResults(rows){
  const out = [];
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list){
    if (!isObject(row)) continue;
    const precinctId = str(row.precinctId || row.vtdId);
    if (!precinctId) continue;
    const candIn = isObject(row.candidateVotes) ? row.candidateVotes : {};
    const candidateVotes = {};
    let sumCand = 0;
    for (const key of Object.keys(candIn)){
      const n = numOrNull(candIn[key]);
      if (n == null || n < 0) continue;
      candidateVotes[key] = n;
      sumCand += n;
    }
    const totalRaw = numOrNull(row.totalVotes);
    const totalVotes = (totalRaw != null && totalRaw >= 0) ? totalRaw : sumCand;
    if (totalVotes <= 0 && sumCand <= 0) continue;
    out.push({
      precinctId,
      totalVotes: totalVotes > 0 ? totalVotes : sumCand,
      candidateVotes,
    });
  }
  out.sort((a, b) => a.precinctId.localeCompare(b.precinctId));
  return out;
}

/**
 * @param {unknown[]} rows
 * @returns {Array<{ precinctId: string, geoid: string, weight: number }>}
 */
export function normalizeCrosswalkRows(rows){
  const out = [];
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list){
    if (!isObject(row)) continue;
    const precinctId = str(row.precinctId || row.vtdId);
    const geoid = str(row.geoid || row.tract || row.blockGroup);
    const weightRaw = numOrNull(row.weight ?? row.w);
    if (!precinctId || !geoid || weightRaw == null) continue;
    if (weightRaw <= 0) continue;
    out.push({
      precinctId,
      geoid,
      weight: weightRaw,
    });
  }
  out.sort((a, b) => {
    const p = a.precinctId.localeCompare(b.precinctId);
    return p !== 0 ? p : a.geoid.localeCompare(b.geoid);
  });
  return out;
}

/**
 * @param {{
 *   precinctResults: unknown[],
 *   crosswalkRows: unknown[],
 *   normalizeWeights?: boolean
 * }} args
 * @returns {{
 *   perGeo: Array<{
 *     geoid: string,
 *     totalVotes: number,
 *     candidateVotes: Record<string, number>,
 *     sourcePrecincts: number
 *   }>,
 *   reconciliation: {
 *     inputVotes: number,
 *     allocatedVotes: number,
 *     unmatchedVotes: number,
 *     coveragePct: number,
 *     deltaVotes: number,
 *     deltaPct: number
 *   },
 *   perPrecinct: Array<{
 *     precinctId: string,
 *     inputVotes: number,
 *     allocatedVotes: number,
 *     matched: boolean,
 *     weightSum: number
 *   }>,
 *   warnings: string[]
 * }}
 */
export function allocatePrecinctVotesToGeo(args){
  const normalizeWeights = args?.normalizeWeights !== false;
  const precinctResults = normalizePrecinctResults(args?.precinctResults || []);
  const crosswalkRows = normalizeCrosswalkRows(args?.crosswalkRows || []);

  const byPrecinct = new Map();
  for (const row of crosswalkRows){
    const list = byPrecinct.get(row.precinctId) || [];
    list.push(row);
    byPrecinct.set(row.precinctId, list);
  }

  const geoMap = new Map();
  const perPrecinct = [];
  const warnings = [];
  let inputVotes = 0;
  let allocatedVotes = 0;
  let unmatchedVotes = 0;

  for (const row of precinctResults){
    const links = byPrecinct.get(row.precinctId) || [];
    inputVotes += row.totalVotes;

    if (!links.length){
      unmatchedVotes += row.totalVotes;
      perPrecinct.push({
        precinctId: row.precinctId,
        inputVotes: row.totalVotes,
        allocatedVotes: 0,
        matched: false,
        weightSum: 0,
      });
      warnings.push(`No crosswalk links found for precinct '${row.precinctId}'.`);
      continue;
    }

    let wSum = 0;
    for (const link of links){
      wSum += link.weight;
    }
    if (!(wSum > 0)){
      unmatchedVotes += row.totalVotes;
      perPrecinct.push({
        precinctId: row.precinctId,
        inputVotes: row.totalVotes,
        allocatedVotes: 0,
        matched: false,
        weightSum: wSum,
      });
      warnings.push(`Crosswalk weights for precinct '${row.precinctId}' do not sum above 0.`);
      continue;
    }

    const factor = normalizeWeights ? (1 / wSum) : 1;
    let rowAllocated = 0;
    const seenGeo = new Set();

    for (const link of links){
      const w = link.weight * factor;
      const allocTotal = row.totalVotes * w;
      rowAllocated += allocTotal;

      let geo = geoMap.get(link.geoid);
      if (!geo){
        geo = {
          geoid: link.geoid,
          totalVotes: 0,
          candidateVotes: {},
          sourcePrecincts: 0,
        };
        geoMap.set(link.geoid, geo);
      }
      geo.totalVotes += allocTotal;
      if (!seenGeo.has(link.geoid)){
        geo.sourcePrecincts += 1;
        seenGeo.add(link.geoid);
      }

      for (const candId of Object.keys(row.candidateVotes)){
        const candVotes = row.candidateVotes[candId] * w;
        geo.candidateVotes[candId] = (geo.candidateVotes[candId] || 0) + candVotes;
      }
    }

    allocatedVotes += rowAllocated;
    perPrecinct.push({
      precinctId: row.precinctId,
      inputVotes: row.totalVotes,
      allocatedVotes: rowAllocated,
      matched: true,
      weightSum: wSum,
    });
  }

  const perGeo = Array.from(geoMap.values())
    .map((row) => ({
      geoid: row.geoid,
      totalVotes: row.totalVotes,
      candidateVotes: row.candidateVotes,
      sourcePrecincts: row.sourcePrecincts,
    }))
    .sort((a, b) => a.geoid.localeCompare(b.geoid));

  const deltaVotes = allocatedVotes - inputVotes;
  const coveragePct = inputVotes > 0 ? ((inputVotes - unmatchedVotes) / inputVotes) * 100 : 0;
  const deltaPct = inputVotes > 0 ? (deltaVotes / inputVotes) * 100 : 0;

  return {
    perGeo,
    reconciliation: {
      inputVotes,
      allocatedVotes,
      unmatchedVotes,
      coveragePct,
      deltaVotes,
      deltaPct,
    },
    perPrecinct: perPrecinct.sort((a, b) => a.precinctId.localeCompare(b.precinctId)),
    warnings,
  };
}
