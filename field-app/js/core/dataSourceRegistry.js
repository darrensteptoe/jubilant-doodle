// @ts-check
// District data source registry helpers (pure, no DOM, no network).
// Purpose: normalize catalog records and resolve latest/verified selections deterministically.

import { normalizeDataCatalog, normalizeDataRefs } from "./districtData.js";

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
 * @returns {string | null}
 */
function strOrNull(v){
  const s = str(v);
  return s ? s : null;
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
 * @param {unknown} v
 * @returns {number}
 */
function boolRank(v){
  return v ? 1 : 0;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function dateRank(v){
  const s = str(v);
  if (!s) return -1;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : -1;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function vintageRank(v){
  const s = str(v);
  if (!s) return -1;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  const m = s.match(/\d{4}/);
  if (!m) return -1;
  const y = Number(m[0]);
  return Number.isFinite(y) ? y : -1;
}

/**
 * @param {Array<Record<string, any>>} rows
 * @param {(row: Record<string, any>) => string} groupKeyFn
 * @returns {Array<Record<string, any>>}
 */
function materializeLatestFlags(rows, groupKeyFn){
  const next = rows.map((r) => ({ ...r, isLatest: !!r.isLatest }));
  const byGroup = new Map();
  for (const row of next){
    const k = groupKeyFn(row);
    const bucket = byGroup.get(k) || [];
    bucket.push(row);
    byGroup.set(k, bucket);
  }
  for (const bucket of byGroup.values()){
    if (bucket.some((r) => !!r.isLatest)) continue;
    let winner = null;
    for (const row of bucket){
      if (!winner){
        winner = row;
        continue;
      }
      const scoreA = [
        boolRank(row.isVerified),
        dateRank(row.refreshedAt),
        vintageRank(row.vintage),
        str(row.id),
      ];
      const scoreB = [
        boolRank(winner.isVerified),
        dateRank(winner.refreshedAt),
        vintageRank(winner.vintage),
        str(winner.id),
      ];
      if (scoreA[0] > scoreB[0]) { winner = row; continue; }
      if (scoreA[0] < scoreB[0]) { continue; }
      if (scoreA[1] > scoreB[1]) { winner = row; continue; }
      if (scoreA[1] < scoreB[1]) { continue; }
      if (scoreA[2] > scoreB[2]) { winner = row; continue; }
      if (scoreA[2] < scoreB[2]) { continue; }
      if (scoreA[3] > scoreB[3]) { winner = row; }
    }
    if (winner) winner.isLatest = true;
  }
  return next;
}

/**
 * @param {Array<Record<string, any>>} rows
 * @returns {Record<string, Record<string, any>>}
 */
function toIdMap(rows){
  const out = Object.create(null);
  for (const row of rows){
    const id = str(row?.id);
    if (!id) continue;
    out[id] = row;
  }
  return out;
}

/**
 * @param {Array<Record<string, any>>} rows
 * @param {(row: Record<string, any>) => boolean=} predicate
 * @returns {Record<string, any> | null}
 */
function pickLatestVerified(rows, predicate){
  const filtered = rows.filter((r) => (!!r.isVerified) && (!predicate || predicate(r)));
  if (!filtered.length) return null;
  const latest = filtered.find((r) => !!r.isLatest);
  if (latest) return latest;
  const sorted = filtered.slice().sort((a, b) => {
    const da = dateRank(a.refreshedAt);
    const db = dateRank(b.refreshedAt);
    if (db !== da) return db - da;
    const va = vintageRank(a.vintage);
    const vb = vintageRank(b.vintage);
    if (vb !== va) return vb - va;
    return str(b.id).localeCompare(str(a.id));
  });
  return sorted[0] || null;
}

/**
 * @param {unknown} dataCatalog
 * @returns {{
 *   version: string,
 *   generatedAt: string,
 *   boundarySets: Array<{
 *     id: string,
 *     label: string,
 *     geographyType: string,
 *     source: string | null,
 *     vintage: string | null,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   crosswalks: Array<{
 *     id: string,
 *     fromBoundarySetId: string,
 *     toBoundarySetId: string,
 *     unit: string,
 *     method: string,
 *     source: string | null,
 *     vintage: string | null,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     coveragePct: number | null,
 *     unmatchedPct: number | null,
 *     weightDriftPct: number | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   censusDatasets: Array<{
 *     id: string,
 *     label: string,
 *     source: string | null,
 *     vintage: string | null,
 *     boundarySetId: string | null,
 *     granularity: string,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     coveragePct: number | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   electionDatasets: Array<{
 *     id: string,
 *     label: string,
 *     source: string | null,
 *     vintage: string | null,
 *     boundarySetId: string | null,
 *     granularity: string,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     coveragePct: number | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   byId: {
 *     boundarySets: Record<string, Record<string, any>>,
 *     crosswalks: Record<string, Record<string, any>>,
 *     censusDatasets: Record<string, Record<string, any>>,
 *     electionDatasets: Record<string, Record<string, any>>
 *   }
 * }}
 */
export function buildDataSourceRegistry(dataCatalog){
  const catalog = normalizeDataCatalog(dataCatalog);
  const boundarySets = materializeLatestFlags(
    catalog.boundarySets.map((r) => ({
      id: str(r.id),
      label: str(r.label),
      geographyType: str(r.geographyType),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      isVerified: r.isVerified == null ? true : !!r.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `b:${str(r.geographyType)}`
  );

  const crosswalks = materializeLatestFlags(
    catalog.crosswalks.map((r) => ({
      id: str(r.id),
      fromBoundarySetId: str(r.fromBoundarySetId),
      toBoundarySetId: str(r.toBoundarySetId),
      unit: str(r.unit),
      method: str(r.method),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      coveragePct: numOrNull(r.quality?.coveragePct),
      unmatchedPct: numOrNull(r.quality?.unmatchedPct),
      weightDriftPct: numOrNull(r.quality?.weightDriftPct),
      isVerified: !!r.quality?.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `x:${str(r.fromBoundarySetId)}>${str(r.toBoundarySetId)}:${str(r.unit)}:${str(r.method)}`
  );

  const censusDatasets = materializeLatestFlags(
    catalog.censusDatasets.map((r) => ({
      id: str(r.id),
      label: str(r.label),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      boundarySetId: strOrNull(r.boundarySetId),
      granularity: str(r.granularity),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      coveragePct: numOrNull(r.quality?.coveragePct),
      isVerified: !!r.quality?.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `c:${str(r.boundarySetId)}:${str(r.granularity)}`
  );

  const electionDatasets = materializeLatestFlags(
    catalog.electionDatasets.map((r) => ({
      id: str(r.id),
      label: str(r.label),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      boundarySetId: strOrNull(r.boundarySetId),
      granularity: str(r.granularity),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      coveragePct: numOrNull(r.quality?.coveragePct),
      isVerified: !!r.quality?.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `e:${str(r.boundarySetId)}:${str(r.granularity)}`
  );

  return {
    version: str(catalog.version) || "0.1.0",
    generatedAt: new Date().toISOString(),
    boundarySets,
    crosswalks,
    censusDatasets,
    electionDatasets,
    byId: {
      boundarySets: toIdMap(boundarySets),
      crosswalks: toIdMap(crosswalks),
      censusDatasets: toIdMap(censusDatasets),
      electionDatasets: toIdMap(electionDatasets),
    }
  };
}

/**
 * @param {{
 *   dataRefs: unknown,
 *   dataCatalog: unknown
 * }} args
 * @returns {{
 *   mode: "pinned_verified" | "latest_verified" | "manual",
 *   selected: {
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null,
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null
 *   },
 *   usedFallbacks: boolean,
 *   notes: string[]
 * }}
 */
export function resolveDataRefsByPolicy(args){
  const refs = normalizeDataRefs(args?.dataRefs);
  const registry = buildDataSourceRegistry(args?.dataCatalog);
  const notes = [];
  let usedFallbacks = false;
  const selected = {
    boundarySetId: refs.boundarySetId,
    crosswalkVersionId: refs.crosswalkVersionId,
    censusDatasetId: refs.censusDatasetId,
    electionDatasetId: refs.electionDatasetId,
  };

  const byId = registry.byId;

  /**
   * @param {"boundarySetId"|"crosswalkVersionId"|"censusDatasetId"|"electionDatasetId"} key
   * @param {Record<string, Record<string, any>>} map
   */
  const clearIfMissing = (key, map) => {
    const id = selected[key];
    if (!id) return;
    if (!map[id]){
      notes.push(`${key} '${id}' missing from registry; cleared.`);
      selected[key] = null;
      usedFallbacks = true;
    }
  };

  clearIfMissing("boundarySetId", byId.boundarySets);
  clearIfMissing("crosswalkVersionId", byId.crosswalks);
  clearIfMissing("censusDatasetId", byId.censusDatasets);
  clearIfMissing("electionDatasetId", byId.electionDatasets);

  if (refs.mode === "manual" || refs.mode === "pinned_verified"){
    return { mode: refs.mode, selected, usedFallbacks, notes };
  }

  // latest_verified: keep valid verified pins; otherwise fallback to latest verified.
  if (!selected.boundarySetId || !byId.boundarySets[selected.boundarySetId]?.isVerified){
    const nextBoundary = pickLatestVerified(registry.boundarySets);
    if (nextBoundary){
      if (selected.boundarySetId !== nextBoundary.id){
        notes.push(`boundarySetId resolved to latest verified '${nextBoundary.id}'.`);
        usedFallbacks = true;
      }
      selected.boundarySetId = nextBoundary.id;
    } else {
      selected.boundarySetId = null;
    }
  }

  const boundaryId = selected.boundarySetId;
  const boundaryFilter = boundaryId
    ? /** @param {Record<string, any>} row */ (row) => str(row.boundarySetId) === str(boundaryId)
    : undefined;
  const crosswalkFilter = boundaryId
    ? /** @param {Record<string, any>} row */ (row) => str(row.fromBoundarySetId) === str(boundaryId) || str(row.toBoundarySetId) === str(boundaryId)
    : undefined;

  if (!selected.censusDatasetId || !byId.censusDatasets[selected.censusDatasetId]?.isVerified){
    const picked = pickLatestVerified(registry.censusDatasets, boundaryFilter) || pickLatestVerified(registry.censusDatasets);
    if (picked){
      if (selected.censusDatasetId !== picked.id){
        notes.push(`censusDatasetId resolved to latest verified '${picked.id}'.`);
        usedFallbacks = true;
      }
      selected.censusDatasetId = picked.id;
    } else {
      selected.censusDatasetId = null;
    }
  }

  if (!selected.electionDatasetId || !byId.electionDatasets[selected.electionDatasetId]?.isVerified){
    const picked = pickLatestVerified(registry.electionDatasets, boundaryFilter) || pickLatestVerified(registry.electionDatasets);
    if (picked){
      if (selected.electionDatasetId !== picked.id){
        notes.push(`electionDatasetId resolved to latest verified '${picked.id}'.`);
        usedFallbacks = true;
      }
      selected.electionDatasetId = picked.id;
    } else {
      selected.electionDatasetId = null;
    }
  }

  if (!selected.crosswalkVersionId || !byId.crosswalks[selected.crosswalkVersionId]?.isVerified){
    const picked = pickLatestVerified(registry.crosswalks, crosswalkFilter) || pickLatestVerified(registry.crosswalks);
    if (picked){
      if (selected.crosswalkVersionId !== picked.id){
        notes.push(`crosswalkVersionId resolved to latest verified '${picked.id}'.`);
        usedFallbacks = true;
      }
      selected.crosswalkVersionId = picked.id;
    } else {
      selected.crosswalkVersionId = null;
    }
  }

  return { mode: refs.mode, selected, usedFallbacks, notes };
}

