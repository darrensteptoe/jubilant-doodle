// @ts-check
// Resolve district-evidence input rows deterministically from scenario state + active dataRefs.
// Pure utility: no DOM, no network, no planning-math mutation.

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
 * @param {Record<string, any>} bucket
 * @param {string[]} keys
 * @param {string} id
 * @returns {unknown[]}
 */
function pickRowsById(bucket, keys, id){
  if (!id) return [];
  for (const key of keys){
    const node = bucket[key];
    if (!isObject(node)) continue;
    const row = node[id];
    if (Array.isArray(row)) return row;
    if (isObject(row) && Array.isArray(row.rows)) return row.rows;
  }
  return [];
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
 *   }
 * }}
 */
export function resolveDistrictEvidenceInputs(state){
  const s = isObject(state) ? state : {};
  const refs = isObject(s.dataRefs) ? s.dataRefs : {};
  const censusDatasetId = str(refs.censusDatasetId);
  const electionDatasetId = str(refs.electionDatasetId);
  const crosswalkVersionId = str(refs.crosswalkVersionId);
  const notes = [];

  const district = isObject(s.geoPack) && isObject(s.geoPack.district) ? s.geoPack.district : {};
  const inline = isObject(district.evidenceInputs) ? district.evidenceInputs : {};
  const inlinePrecinctResults = arr(inline.precinctResults);
  const inlineCrosswalkRows = arr(inline.crosswalkRows);
  const inlineCensusGeoRows = arr(inline.censusGeoRows);

  if (inlinePrecinctResults.length || inlineCrosswalkRows.length || inlineCensusGeoRows.length){
    return {
      sourceMode: "inline",
      precinctResults: inlinePrecinctResults,
      crosswalkRows: inlineCrosswalkRows,
      censusGeoRows: inlineCensusGeoRows,
      notes,
      refs: {
        censusDatasetId,
        electionDatasetId,
        crosswalkVersionId,
      },
    };
  }

  const store = isObject(district.evidenceStore)
    ? district.evidenceStore
    : (isObject(district.datasetRows) ? district.datasetRows : {});

  if (!isObject(store) || !Object.keys(store).length){
    notes.push("No district evidence store found.");
    return {
      sourceMode: "none",
      precinctResults: [],
      crosswalkRows: [],
      censusGeoRows: [],
      notes,
      refs: {
        censusDatasetId,
        electionDatasetId,
        crosswalkVersionId,
      },
    };
  }

  const precinctResults = pickRowsById(store, ["electionByDatasetId", "election", "electionDatasets"], electionDatasetId);
  const crosswalkRows = pickRowsById(store, ["crosswalkByVersionId", "crosswalk", "crosswalks"], crosswalkVersionId);
  const censusGeoRows = pickRowsById(store, ["censusByDatasetId", "census", "censusDatasets"], censusDatasetId);

  if (!electionDatasetId) notes.push("dataRefs.electionDatasetId is not set.");
  if (!censusDatasetId) notes.push("dataRefs.censusDatasetId is not set.");
  if (!crosswalkVersionId) notes.push("dataRefs.crosswalkVersionId is not set.");
  if (electionDatasetId && !precinctResults.length){
    notes.push(`No precinct results rows found for election dataset '${electionDatasetId}'.`);
  }
  if (censusDatasetId && !censusGeoRows.length){
    notes.push(`No census geo rows found for census dataset '${censusDatasetId}'.`);
  }
  if (crosswalkVersionId && !crosswalkRows.length){
    notes.push(`No crosswalk rows found for crosswalk '${crosswalkVersionId}'.`);
  }

  return {
    sourceMode: (precinctResults.length || crosswalkRows.length || censusGeoRows.length) ? "refs" : "none",
    precinctResults,
    crosswalkRows,
    censusGeoRows,
    notes,
    refs: {
      censusDatasetId,
      electionDatasetId,
      crosswalkVersionId,
    },
  };
}

