// @ts-check
// MIT precinct + Census ingest scaffolding (contract + normalization only).
// This module does not fetch network data and does not mutate planning math.

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
 * @returns {number | null}
 */
function yearOrNull(v){
  const n = numOrNull(v);
  if (n != null){
    const y = Math.trunc(n);
    if (y >= 1900 && y <= 2100) return y;
  }
  const s = str(v);
  if (!s) return null;
  const m = s.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const y = Number(m[0]);
  return Number.isFinite(y) ? y : null;
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function isoOrNull(v){
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

const CENSUS_GRANULARITY = new Set(["tract", "block_group"]);
const ELECTION_GRANULARITY = new Set(["precinct", "vtd"]);

/**
 * @returns {{
 *   id: string,
 *   label: string,
 *   source: string,
 *   manifestUrl: string | null,
 *   rowsUrl: string | null,
 *   vintage: string,
 *   boundarySetId: string | null,
 *   granularity: "tract" | "block_group",
 *   refreshedAt: string | null,
 *   hash: string | null,
 *   quality: { coveragePct: number | null, isVerified: boolean },
 *   variableRefs: string[],
 *   rowCount: number
 * }}
 */
export function makeDefaultCensusManifest(){
  return {
    id: "",
    label: "",
    source: "census_acs5",
    manifestUrl: null,
    rowsUrl: null,
    vintage: "",
    boundarySetId: null,
    granularity: "tract",
    refreshedAt: null,
    hash: null,
    quality: { coveragePct: null, isVerified: false },
    variableRefs: [],
    rowCount: 0,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof makeDefaultCensusManifest>}
 */
export function normalizeCensusManifest(raw){
  const base = makeDefaultCensusManifest();
  if (!isObject(raw)) return base;
  const qualityIn = isObject(raw.quality) ? raw.quality : {};
  const varsIn = Array.isArray(raw.variableRefs) ? raw.variableRefs : [];
  const granRaw = str(raw.granularity).toLowerCase();
  const granularity = CENSUS_GRANULARITY.has(granRaw) ? granRaw : base.granularity;
  const variableRefs = [];
  const seen = new Set();
  for (const v of varsIn){
    const next = str(v);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    variableRefs.push(next);
  }
  variableRefs.sort((a, b) => a.localeCompare(b));

  const rowCountRaw = numOrNull(raw.rowCount);
  const rowCount = (rowCountRaw != null && rowCountRaw >= 0) ? Math.trunc(rowCountRaw) : 0;
  const coverageRaw = numOrNull(qualityIn.coveragePct);

  return {
    ...base,
    ...raw,
    id: str(raw.id),
    label: str(raw.label),
    source: str(raw.source) || base.source,
    manifestUrl: strOrNull(raw.manifestUrl ?? raw.manifest_url ?? raw.sourceManifestUrl ?? raw.source_manifest_url),
    rowsUrl: strOrNull(raw.rowsUrl ?? raw.rows_url ?? raw.dataUrl ?? raw.data_url ?? raw.sourceRowsUrl ?? raw.source_rows_url),
    vintage: str(raw.vintage),
    boundarySetId: strOrNull(raw.boundarySetId),
    granularity,
    refreshedAt: isoOrNull(raw.refreshedAt),
    hash: strOrNull(raw.hash),
    quality: {
      coveragePct: coverageRaw,
      isVerified: !!qualityIn.isVerified,
    },
    variableRefs,
    rowCount,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCensusManifest(raw){
  const m = normalizeCensusManifest(raw);
  const errors = [];
  if (!m.id) errors.push("census manifest id is required.");
  if (!m.vintage) errors.push("census manifest vintage is required.");
  if (!m.granularity) errors.push("census manifest granularity is required.");
  if (!m.variableRefs.length) errors.push("census manifest variableRefs must include at least one variable.");
  if (m.rowCount <= 0) errors.push("census manifest rowCount must be > 0.");
  const coverage = m.quality.coveragePct;
  if (coverage != null && (coverage < 0 || coverage > 100)){
    errors.push("census manifest quality.coveragePct must be in [0,100] when provided.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @returns {{
 *   id: string,
 *   label: string,
 *   source: string,
 *   manifestUrl: string | null,
 *   rowsUrl: string | null,
 *   vintage: string,
 *   electionDate: string | null,
 *   officeType: string,
 *   raceType: string,
 *   cycleYear: number | null,
 *   boundarySetId: string | null,
 *   granularity: "precinct" | "vtd",
 *   refreshedAt: string | null,
 *   hash: string | null,
 *   quality: { coveragePct: number | null, isVerified: boolean },
 *   candidateIds: string[],
 *   rowCount: number
 * }}
 */
export function makeDefaultElectionManifest(){
  return {
    id: "",
    label: "",
    source: "mit_electionlab",
    manifestUrl: null,
    rowsUrl: null,
    vintage: "",
    electionDate: null,
    officeType: "",
    raceType: "",
    cycleYear: null,
    boundarySetId: null,
    granularity: "precinct",
    refreshedAt: null,
    hash: null,
    quality: { coveragePct: null, isVerified: false },
    candidateIds: [],
    rowCount: 0,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof makeDefaultElectionManifest>}
 */
export function normalizeElectionManifest(raw){
  const base = makeDefaultElectionManifest();
  if (!isObject(raw)) return base;
  const qualityIn = isObject(raw.quality) ? raw.quality : {};
  const candsIn = Array.isArray(raw.candidateIds) ? raw.candidateIds : [];
  const granRaw = str(raw.granularity).toLowerCase();
  const granularity = ELECTION_GRANULARITY.has(granRaw) ? granRaw : base.granularity;
  const candidateIds = [];
  const seen = new Set();
  for (const v of candsIn){
    const next = str(v);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    candidateIds.push(next);
  }
  candidateIds.sort((a, b) => a.localeCompare(b));

  const rowCountRaw = numOrNull(raw.rowCount);
  const rowCount = (rowCountRaw != null && rowCountRaw >= 0) ? Math.trunc(rowCountRaw) : 0;
  const coverageRaw = numOrNull(qualityIn.coveragePct);
  const electionDate = isoOrNull(raw.electionDate);
  const cycleYear = yearOrNull(raw.cycleYear) ?? yearOrNull(electionDate) ?? yearOrNull(raw.vintage);

  return {
    ...base,
    ...raw,
    id: str(raw.id),
    label: str(raw.label),
    source: str(raw.source) || base.source,
    manifestUrl: strOrNull(raw.manifestUrl ?? raw.manifest_url ?? raw.sourceManifestUrl ?? raw.source_manifest_url),
    rowsUrl: strOrNull(raw.rowsUrl ?? raw.rows_url ?? raw.dataUrl ?? raw.data_url ?? raw.sourceRowsUrl ?? raw.source_rows_url),
    vintage: str(raw.vintage),
    electionDate,
    officeType: str(raw.officeType),
    raceType: str(raw.raceType || raw.race_template || raw.raceCategory),
    cycleYear,
    boundarySetId: strOrNull(raw.boundarySetId),
    granularity,
    refreshedAt: isoOrNull(raw.refreshedAt),
    hash: strOrNull(raw.hash),
    quality: {
      coveragePct: coverageRaw,
      isVerified: !!qualityIn.isVerified,
    },
    candidateIds,
    rowCount,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateElectionManifest(raw){
  const m = normalizeElectionManifest(raw);
  const errors = [];
  if (!m.id) errors.push("election manifest id is required.");
  if (!m.vintage) errors.push("election manifest vintage is required.");
  if (!m.officeType) errors.push("election manifest officeType is required.");
  if (!m.granularity) errors.push("election manifest granularity is required.");
  if (!m.candidateIds.length) errors.push("election manifest candidateIds must include at least one candidate.");
  if (m.rowCount <= 0) errors.push("election manifest rowCount must be > 0.");
  const coverage = m.quality.coveragePct;
  if (coverage != null && (coverage < 0 || coverage > 100)){
    errors.push("election manifest quality.coveragePct must be in [0,100] when provided.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {ReturnType<typeof normalizeCensusManifest>} manifest
 * @returns {{
 *   id: string,
 *   kind: "census",
 *   label: string,
 *   source: string | null,
 *   manifestUrl?: string | null,
 *   rowsUrl?: string | null,
 *   vintage: string | null,
 *   boundarySetId: string | null,
 *   granularity: string,
 *   refreshedAt: string | null,
 *   hash: string | null,
 *   quality: {
 *     coveragePct: number | null,
 *     isVerified: boolean
 *   }
 * }}
 */
export function censusManifestToCatalogEntry(manifest){
  const m = normalizeCensusManifest(manifest);
  return {
    id: m.id,
    kind: "census",
    label: m.label,
    source: strOrNull(m.source),
    manifestUrl: strOrNull(m.manifestUrl),
    rowsUrl: strOrNull(m.rowsUrl),
    vintage: strOrNull(m.vintage),
    boundarySetId: strOrNull(m.boundarySetId),
    granularity: str(m.granularity),
    refreshedAt: isoOrNull(m.refreshedAt),
    hash: strOrNull(m.hash),
    quality: {
      coveragePct: numOrNull(m.quality.coveragePct),
      isVerified: !!m.quality.isVerified,
    },
  };
}

/**
 * @param {ReturnType<typeof normalizeElectionManifest>} manifest
 * @returns {{
 *   id: string,
 *   kind: "election",
 *   label: string,
 *   source: string | null,
 *   manifestUrl?: string | null,
 *   rowsUrl?: string | null,
 *   vintage: string | null,
 *   electionDate: string | null,
 *   officeType: string | null,
 *   raceType: string | null,
 *   cycleYear: number | null,
 *   boundarySetId: string | null,
 *   granularity: string,
 *   refreshedAt: string | null,
 *   hash: string | null,
 *   quality: {
 *     coveragePct: number | null,
 *     isVerified: boolean
 *   }
 * }}
 */
export function electionManifestToCatalogEntry(manifest){
  const m = normalizeElectionManifest(manifest);
  return {
    id: m.id,
    kind: "election",
    label: m.label,
    source: strOrNull(m.source),
    manifestUrl: strOrNull(m.manifestUrl),
    rowsUrl: strOrNull(m.rowsUrl),
    vintage: strOrNull(m.vintage),
    electionDate: isoOrNull(m.electionDate),
    officeType: strOrNull(m.officeType),
    raceType: strOrNull(m.raceType),
    cycleYear: yearOrNull(m.cycleYear) ?? yearOrNull(m.electionDate) ?? yearOrNull(m.vintage),
    boundarySetId: strOrNull(m.boundarySetId),
    granularity: str(m.granularity),
    refreshedAt: isoOrNull(m.refreshedAt),
    hash: strOrNull(m.hash),
    quality: {
      coveragePct: numOrNull(m.quality.coveragePct),
      isVerified: !!m.quality.isVerified,
    },
  };
}
