// @ts-check
// Resolve district-evidence input rows deterministically from scenario state + active dataRefs.
// Pure utility: no DOM, no network, no planning-math mutation.
import { normalizeAreaSelection, buildAreaResolverCacheKey } from "./areaResolver.js";

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
 * @returns {unknown[]}
 */
function arr(v){
  return Array.isArray(v) ? v : [];
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function digits(v){
  return str(v).replace(/\D+/g, "");
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normState(v){
  const d = digits(v);
  if (!d) return "";
  return d.slice(0, 2).padStart(2, "0");
}

/**
 * @param {unknown} stateFips
 * @param {unknown} countyFips
 * @returns {string}
 */
function normCounty(stateFips, countyFips){
  const state = normState(stateFips);
  const c = digits(countyFips);
  if (!c) return "";
  if (c.length >= 5){
    if (state && c.slice(0, 2) === state) return c.slice(2, 5);
    return c.slice(-3);
  }
  if (c.length >= 3) return c.slice(0, 3);
  return "";
}

/**
 * @param {unknown} geoidLike
 * @param {{ stateFips: string, countyFips: string }} area
 * @returns {boolean}
 */
function geoidMatchesArea(geoidLike, area){
  const geoid = digits(geoidLike);
  if (geoid.length < 5) return false;
  const state = normState(area?.stateFips);
  if (state && geoid.slice(0, 2) !== state) return false;
  const county = normCounty(state, area?.countyFips);
  if (county && geoid.slice(2, 5) !== county) return false;
  return true;
}

/**
 * @param {Record<string, any>} bucket
 * @param {string[]} keys
 * @param {string} id
 * @returns {{ rows: unknown[], meta: Record<string, any> | null }}
 */
function pickRowsById(bucket, keys, id){
  if (!id) return { rows: [], meta: null };
  for (const key of keys){
    const node = bucket[key];
    if (!isObject(node)) continue;
    const row = node[id];
    if (Array.isArray(row)) return { rows: row, meta: null };
    if (isObject(row) && Array.isArray(row.rows)){
      const meta = isObject(row.meta) ? row.meta : null;
      return { rows: row.rows, meta };
    }
  }
  return { rows: [], meta: null };
}

/**
 * @param {Record<string, any>} bucket
 * @param {string[]} keys
 * @returns {{ rows: unknown[], meta: Record<string, any> | null, id: string }}
 */
function pickFirstRows(bucket, keys){
  for (const key of keys){
    const node = bucket[key];
    if (!isObject(node)) continue;
    const ids = Object.keys(node).sort((a, b) => a.localeCompare(b));
    for (const id of ids){
      const row = node[id];
      if (Array.isArray(row)) return { rows: row, meta: null, id: str(id) };
      if (isObject(row) && Array.isArray(row.rows)){
        const meta = isObject(row.meta) ? row.meta : null;
        return { rows: row.rows, meta, id: str(id) };
      }
    }
  }
  return { rows: [], meta: null, id: "" };
}

/**
 * @param {unknown} state
 * @returns {{
 *   area: ReturnType<typeof normalizeAreaSelection>,
 *   areaFingerprint: string
 * }}
 */
function deriveAreaContext(state){
  const s = isObject(state) ? state : {};
  const geo = isObject(s.geoPack) ? s.geoPack : {};
  const areaIn = isObject(geo.area) ? geo.area : {};
  const area = normalizeAreaSelection({
    ...areaIn,
    resolution: geo.resolution,
    boundarySetId: geo.boundarySetId ?? areaIn.boundarySetId,
    boundaryVintage: geo.boundaryVintage ?? areaIn.boundaryVintage ?? areaIn.vintage,
  });
  const areaFingerprint = buildAreaResolverCacheKey({ area });
  return { area, areaFingerprint };
}

/**
 * @param {unknown[]} rows
 * @returns {number}
 */
function countRowsWithGeoid(rows){
  let total = 0;
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list){
    if (!isObject(row)) continue;
    const geoid = digits(row.geoid);
    if (geoid.length >= 5) total += 1;
  }
  return total;
}

/**
 * @param {unknown[]} rows
 * @param {{ stateFips: string, countyFips: string }} area
 * @returns {number}
 */
function countRowsMatchingArea(rows, area){
  let total = 0;
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list){
    if (!isObject(row)) continue;
    if (geoidMatchesArea(row.geoid, area)) total += 1;
  }
  return total;
}

/**
 * @param {string} layerName
 * @param {unknown[]} rows
 * @param {Record<string, any> | null} meta
 * @param {{ area: ReturnType<typeof normalizeAreaSelection>, areaFingerprint: string }} areaContext
 * @returns {{
 *   layerName: string,
 *   status: "aligned" | "external" | "partial" | "unknown",
 *   mismatch: boolean,
 *   rowCount: number,
 *   geoidRowCount: number,
 *   matchedGeoidRows: number,
 *   areaFingerprint: string | null,
 *   message: string | null
 * }}
 */
function evaluateLayerAlignment(layerName, rows, meta, areaContext){
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  const geoidRowCount = countRowsWithGeoid(rows);
  const matchedGeoidRows = countRowsMatchingArea(rows, areaContext.area);
  const fpRaw = str(meta?.areaFingerprint || meta?.areaResolverKey || meta?.areaKey);
  const areaFingerprint = fpRaw || null;
  const validationStatus = str(meta?.validationStatus).toLowerCase();
  const flaggedExternal = validationStatus === "external";
  const flaggedPartial = validationStatus === "partial";
  const mismatchByFingerprint = !!(areaFingerprint && areaContext.areaFingerprint && areaFingerprint !== areaContext.areaFingerprint);
  const mismatchByMissingFingerprint = rowCount > 0 && !areaFingerprint;
  const mismatchByRows = geoidRowCount > 0 && matchedGeoidRows < geoidRowCount;
  const mismatchByFlag = !!((flaggedExternal || flaggedPartial) && !areaFingerprint && geoidRowCount === 0);
  const mismatch = mismatchByFingerprint || mismatchByMissingFingerprint || mismatchByRows || mismatchByFlag;
  let status = "unknown";
  if (mismatchByRows || mismatchByFingerprint || mismatchByMissingFingerprint || flaggedExternal){
    status = geoidRowCount > 0 && matchedGeoidRows > 0 && matchedGeoidRows < geoidRowCount
      ? "partial"
      : "external";
  } else if (flaggedPartial){
    status = "partial";
  } else if (geoidRowCount > 0 && matchedGeoidRows === geoidRowCount){
    status = "aligned";
  }
  let message = null;
  if (mismatchByFingerprint){
    message = `${layerName} area fingerprint does not match selected area.`;
  } else if (mismatchByMissingFingerprint){
    message = `${layerName} is missing area fingerprint metadata for selected area checks.`;
  } else if (mismatchByRows && matchedGeoidRows > 0){
    message = `${layerName} contains mixed-area rows.`;
  } else if (mismatchByRows){
    message = `${layerName} rows do not match selected area.`;
  } else if (mismatchByFlag){
    message = `${layerName} is marked external to selected area.`;
  }
  return {
    layerName,
    status: /** @type {"aligned" | "external" | "partial" | "unknown"} */ (status),
    mismatch,
    rowCount,
    geoidRowCount,
    matchedGeoidRows,
    areaFingerprint,
    message,
  };
}

/**
 * @param {unknown} state
 * @returns {{
 *   sourceMode: "inline" | "refs" | "none",
 *   precinctResults: unknown[],
 *   crosswalkRows: unknown[],
 *   censusGeoRows: unknown[],
 *   notes: string[],
 *   refs: {
 *     censusDatasetId: string,
 *     electionDatasetId: string,
 *     crosswalkVersionId: string
 *   },
 *   alignment: {
 *     areaFingerprint: string,
 *     allAligned: boolean,
 *     mismatches: string[],
 *     layers: {
 *       precinctResults: ReturnType<typeof evaluateLayerAlignment>,
 *       crosswalkRows: ReturnType<typeof evaluateLayerAlignment>,
 *       censusGeoRows: ReturnType<typeof evaluateLayerAlignment>
 *     }
 *   }
 * }}
 */
export function resolveDistrictEvidenceInputs(state){
  const s = isObject(state) ? state : {};
  const areaContext = deriveAreaContext(state);
  const refs = isObject(s.dataRefs) ? s.dataRefs : {};
  const censusDatasetId = str(refs.censusDatasetId);
  const electionDatasetId = str(refs.electionDatasetId);
  const crosswalkVersionId = str(refs.crosswalkVersionId);
  const notes = [];

  const district = isObject(s.geoPack) && isObject(s.geoPack.district) ? s.geoPack.district : {};
  const inline = isObject(district.evidenceInputs) ? district.evidenceInputs : {};
  const inlineMeta = isObject(district.evidenceInputMeta) ? district.evidenceInputMeta : {};
  const directCensusGeoRows = arr(district.censusRowsV2);
  const directCensusMeta = isObject(district.censusRowsV2Meta) ? district.censusRowsV2Meta : null;
  const inlinePrecinctResults = arr(inline.precinctResults);
  const inlineCrosswalkRows = arr(inline.crosswalkRows);
  const inlineCensusGeoRowsRaw = arr(inline.censusGeoRows);
  const inlineCensusGeoRows = inlineCensusGeoRowsRaw.length ? inlineCensusGeoRowsRaw : directCensusGeoRows;
  const inlinePrecinctMeta = isObject(inlineMeta.precinctResults) ? inlineMeta.precinctResults : null;
  const inlineCrosswalkMeta = isObject(inlineMeta.crosswalkRows) ? inlineMeta.crosswalkRows : null;
  const inlineCensusMeta = isObject(inlineMeta.censusGeoRows) ? inlineMeta.censusGeoRows : directCensusMeta;

  const store = isObject(district.evidenceStore)
    ? district.evidenceStore
    : (isObject(district.datasetRows) ? district.datasetRows : {});
  const hasStore = isObject(store) && Object.keys(store).length > 0;
  let pickedPrecinct = hasStore
    ? pickRowsById(store, ["electionByDatasetId", "election", "electionDatasets"], electionDatasetId)
    : { rows: [], meta: null };
  let pickedCrosswalk = hasStore
    ? pickRowsById(store, ["crosswalkByVersionId", "crosswalk", "crosswalks"], crosswalkVersionId)
    : { rows: [], meta: null };
  let pickedCensus = hasStore
    ? pickRowsById(store, ["censusByDatasetId", "census", "censusDatasets"], censusDatasetId)
    : { rows: [], meta: null };
  if (hasStore && (!electionDatasetId || !pickedPrecinct.rows.length)){
    const fallback = pickFirstRows(store, ["electionByDatasetId", "election", "electionDatasets"]);
    if (fallback.rows.length){
      pickedPrecinct = { rows: fallback.rows, meta: fallback.meta };
    }
  }
  if (hasStore && (!crosswalkVersionId || !pickedCrosswalk.rows.length)){
    const fallback = pickFirstRows(store, ["crosswalkByVersionId", "crosswalk", "crosswalks"]);
    if (fallback.rows.length){
      pickedCrosswalk = { rows: fallback.rows, meta: fallback.meta };
    }
  }
  if (hasStore && (!censusDatasetId || !pickedCensus.rows.length)){
    const fallback = pickFirstRows(store, ["censusByDatasetId", "census", "censusDatasets"]);
    if (fallback.rows.length){
      pickedCensus = { rows: fallback.rows, meta: fallback.meta };
    }
  }

  const useInlinePrecinct = inlinePrecinctResults.length > 0;
  const useInlineCrosswalk = inlineCrosswalkRows.length > 0;
  const useInlineCensus = inlineCensusGeoRows.length > 0;
  const usingInlineAny = useInlinePrecinct || useInlineCrosswalk || useInlineCensus;

  const precinctRowsIn = useInlinePrecinct ? inlinePrecinctResults : pickedPrecinct.rows;
  const crosswalkRowsIn = useInlineCrosswalk ? inlineCrosswalkRows : pickedCrosswalk.rows;
  const censusGeoRowsIn = useInlineCensus ? inlineCensusGeoRows : pickedCensus.rows;
  const precinctMetaIn = useInlinePrecinct ? inlinePrecinctMeta : pickedPrecinct.meta;
  const crosswalkMetaIn = useInlineCrosswalk ? inlineCrosswalkMeta : pickedCrosswalk.meta;
  const censusMetaIn = useInlineCensus ? inlineCensusMeta : pickedCensus.meta;

  const precinctAlignment = evaluateLayerAlignment("Precinct results", precinctRowsIn, precinctMetaIn, areaContext);
  const crosswalkAlignment = evaluateLayerAlignment("Crosswalk rows", crosswalkRowsIn, crosswalkMetaIn, areaContext);
  const censusAlignment = evaluateLayerAlignment("Census GEO rows", censusGeoRowsIn, censusMetaIn, areaContext);
  const mismatches = [
    precinctAlignment.message,
    crosswalkAlignment.message,
    censusAlignment.message,
  ].filter(Boolean);
  if (mismatches.length){
    notes.push(...mismatches);
  }
  const precinctResults = precinctAlignment.mismatch ? [] : precinctRowsIn;
  const crosswalkRows = crosswalkAlignment.mismatch ? [] : crosswalkRowsIn;
  const censusGeoRows = censusAlignment.mismatch ? [] : censusGeoRowsIn;

  if (!hasStore && !usingInlineAny){
    notes.push("No district evidence store found.");
  }
  if (!censusDatasetId && !useInlineCensus) notes.push("dataRefs.censusDatasetId is not set.");
  if (electionDatasetId && !precinctResults.length && !useInlinePrecinct){
    notes.push(`No precinct results rows found for election dataset '${electionDatasetId}'.`);
  }
  if (censusDatasetId && !censusGeoRows.length && !useInlineCensus){
    notes.push(`No census geo rows found for census dataset '${censusDatasetId}'.`);
  }
  if (crosswalkVersionId && !crosswalkRows.length && !useInlineCrosswalk){
    notes.push(`No crosswalk rows found for crosswalk '${crosswalkVersionId}'.`);
  }

  const sourceMode = (precinctResults.length || crosswalkRows.length || censusGeoRows.length)
    ? (usingInlineAny ? "inline" : "refs")
    : (usingInlineAny ? "inline" : (hasStore ? "refs" : "none"));

  return {
    sourceMode,
    precinctResults,
    crosswalkRows,
    censusGeoRows,
    notes,
    refs: {
      censusDatasetId,
      electionDatasetId,
      crosswalkVersionId,
    },
    alignment: {
      areaFingerprint: areaContext.areaFingerprint,
      allAligned: !mismatches.length,
      mismatches,
      layers: {
        precinctResults: precinctAlignment,
        crosswalkRows: crosswalkAlignment,
        censusGeoRows: censusAlignment,
      },
    },
  };
}

/**
 * @param {unknown} state
 * @returns {{
 *   sourceMode: "inline" | "refs" | "none",
 *   refs: {
 *     censusDatasetId: string,
 *     electionDatasetId: string,
 *     crosswalkVersionId: string
 *   },
 *   counts: {
 *     precinctResults: number,
 *     crosswalkRows: number,
 *     censusGeoRows: number
  *   },
 *   alignment: {
 *     areaFingerprint: string,
 *     allAligned: boolean,
 *     mismatchCount: number
 *   },
 *   ready: boolean,
 *   notes: string[],
 *   summaryLine: string
 * }}
 */
export function summarizeDistrictEvidenceInputs(state){
  const resolved = resolveDistrictEvidenceInputs(state);
  const counts = {
    precinctResults: arr(resolved.precinctResults).length,
    crosswalkRows: arr(resolved.crosswalkRows).length,
    censusGeoRows: arr(resolved.censusGeoRows).length,
  };
  const mismatchCount = Array.isArray(resolved?.alignment?.mismatches) ? resolved.alignment.mismatches.length : 0;
  const allAligned = mismatchCount === 0;
  const ready = counts.precinctResults > 0 && counts.crosswalkRows > 0 && counts.censusGeoRows > 0 && allAligned;
  const modeLabel = resolved.sourceMode === "inline"
    ? "inline"
    : resolved.sourceMode === "refs"
      ? "refs"
      : "none";
  const summaryLine = [
    `Input mode: ${modeLabel}`,
    `Election rows: ${counts.precinctResults}`,
    `Crosswalk rows: ${counts.crosswalkRows}`,
    `Census rows: ${counts.censusGeoRows}`,
    allAligned ? "Area alignment: aligned" : `Area alignment: ${mismatchCount} mismatch`,
  ].join(" · ");
  return {
    sourceMode: resolved.sourceMode,
    refs: resolved.refs,
    counts,
    alignment: {
      areaFingerprint: String(resolved?.alignment?.areaFingerprint || ""),
      allAligned,
      mismatchCount,
    },
    ready,
    notes: arr(resolved.notes).map((x) => str(x)).filter(Boolean),
    summaryLine,
  };
}
