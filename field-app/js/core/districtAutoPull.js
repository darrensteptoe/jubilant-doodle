// @ts-check
// Deterministic URL adapter for Stage 9 auto-pull.
// This module never fetches network data; it only resolves URL plans from data refs/catalog.

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} v
 * @returns {"manual" | "pinned_verified" | "latest_verified"}
 */
function normalizeMode(v){
  const m = str(v).toLowerCase();
  if (m === "manual" || m === "latest_verified" || m === "pinned_verified") return m;
  return "pinned_verified";
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function httpUrlOrNull(v){
  const s = str(v);
  if (!s) return null;
  try{
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * @param {unknown[]} rows
 * @param {string | null | undefined} id
 * @returns {Record<string, any> | null}
 */
function findById(rows, id){
  const list = Array.isArray(rows) ? rows : [];
  const key = str(id);
  if (!key) return null;
  return /** @type {Record<string, any> | null} */ (
    list.find((row) => str(row && typeof row === "object" ? row.id : "") === key) || null
  );
}

/**
 * @param {Record<string, any> | null} row
 * @returns {string | null}
 */
function pickManifestUrl(row){
  if (!row || typeof row !== "object") return null;
  return (
    httpUrlOrNull(row.manifestUrl) ||
    httpUrlOrNull(row.manifest_url) ||
    httpUrlOrNull(row.sourceManifestUrl) ||
    httpUrlOrNull(row.source_manifest_url) ||
    null
  );
}

/**
 * @param {Record<string, any> | null} row
 * @returns {string | null}
 */
function pickRowsUrl(row){
  if (!row || typeof row !== "object") return null;
  return (
    httpUrlOrNull(row.rowsUrl) ||
    httpUrlOrNull(row.rows_url) ||
    httpUrlOrNull(row.dataUrl) ||
    httpUrlOrNull(row.data_url) ||
    httpUrlOrNull(row.sourceRowsUrl) ||
    httpUrlOrNull(row.source_rows_url) ||
    null
  );
}

/**
 * @param {{
 *   dataRefs?: Record<string, any> | null,
 *   dataCatalog?: Record<string, any> | null,
 *   scenario?: Record<string, any> | null,
 *   resolveDataRefsByPolicy?: ((args: {
 *     dataRefs?: Record<string, any> | null,
 *     dataCatalog?: Record<string, any> | null,
 *     scenario?: Record<string, any> | null
 *   }) => any) | null
 * }} args
 * @returns {{
 *   mode: "manual" | "pinned_verified" | "latest_verified",
 *   policyLabel: string,
 *   selected: {
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null,
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null
 *   },
 *   urls: {
 *     censusManifestUrl: string | null,
 *     electionManifestUrl: string | null,
 *     crosswalkRowsUrl: string | null,
 *     precinctResultsUrl: string | null,
 *     censusGeoRowsUrl: string | null
 *   },
 *   availableCount: number,
 *   missingCount: number,
 *   notes: string[]
 * }}
 */
export function buildAutoPullUrlPlan(args = {}){
  const refs = (args && typeof args.dataRefs === "object" && args.dataRefs) || {};
  const catalog = (args && typeof args.dataCatalog === "object" && args.dataCatalog) || {};
  const mode = normalizeMode(refs.mode);
  const resolveByPolicy = typeof args.resolveDataRefsByPolicy === "function"
    ? args.resolveDataRefsByPolicy
    : null;
  const resolved = resolveByPolicy
    ? resolveByPolicy({
      dataRefs: refs,
      dataCatalog: catalog,
      scenario: args.scenario || null,
    })
    : null;
  const selected = {
    boundarySetId: str((resolved && resolved.selected && resolved.selected.boundarySetId) ?? refs.boundarySetId) || null,
    crosswalkVersionId: str((resolved && resolved.selected && resolved.selected.crosswalkVersionId) ?? refs.crosswalkVersionId) || null,
    censusDatasetId: str((resolved && resolved.selected && resolved.selected.censusDatasetId) ?? refs.censusDatasetId) || null,
    electionDatasetId: str((resolved && resolved.selected && resolved.selected.electionDatasetId) ?? refs.electionDatasetId) || null,
  };

  const censusDataset = findById(catalog.censusDatasets, selected.censusDatasetId);
  const electionDataset = findById(catalog.electionDatasets, selected.electionDatasetId);
  const crosswalk = findById(catalog.crosswalks, selected.crosswalkVersionId);

  const urls = {
    censusManifestUrl: pickManifestUrl(censusDataset),
    electionManifestUrl: pickManifestUrl(electionDataset),
    crosswalkRowsUrl: pickRowsUrl(crosswalk),
    precinctResultsUrl: pickRowsUrl(electionDataset),
    censusGeoRowsUrl: pickRowsUrl(censusDataset),
  };

  /** @type {string[]} */
  const notes = [];
  if (selected.censusDatasetId && !urls.censusManifestUrl){
    notes.push(`No census manifest URL on dataset '${selected.censusDatasetId}'.`);
  }
  if (selected.electionDatasetId && !urls.electionManifestUrl){
    notes.push(`No election manifest URL on dataset '${selected.electionDatasetId}'.`);
  }
  if (selected.crosswalkVersionId && !urls.crosswalkRowsUrl){
    notes.push(`No crosswalk rows URL on crosswalk '${selected.crosswalkVersionId}'.`);
  }
  if (selected.electionDatasetId && !urls.precinctResultsUrl){
    notes.push(`No precinct rows URL on election dataset '${selected.electionDatasetId}'.`);
  }
  if (selected.censusDatasetId && !urls.censusGeoRowsUrl){
    notes.push(`No census GEO rows URL on dataset '${selected.censusDatasetId}'.`);
  }

  const availableCount = Object.values(urls).filter(Boolean).length;
  const missingCount = 5 - availableCount;
  const policyLabel = mode === "latest_verified"
    ? "latest_verified (resolved at pull time)"
    : (mode === "manual" ? "manual (explicit refs)" : "pinned_verified (fixed refs)");

  return {
    mode,
    policyLabel,
    selected,
    urls,
    availableCount,
    missingCount,
    notes,
  };
}

