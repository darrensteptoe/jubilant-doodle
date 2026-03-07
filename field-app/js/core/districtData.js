// @ts-check
// Scenario-scoped district intelligence data contract.
// This layer is metadata/input plumbing only; it must not run planning math.

export const DISTRICT_DATA_VERSION = "0.1.0";

const ALLOWED_DATA_REF_MODES = new Set(["pinned_verified", "latest_verified", "manual"]);
const ALLOWED_GEO_RESOLUTIONS = new Set(["tract", "block_group"]);

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
function toCleanString(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function toIdOrNull(v){
  const s = toCleanString(v);
  return s ? s : null;
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function toFiniteOrNull(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function toIsoOrNull(v){
  const s = toCleanString(v);
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
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
 * @param {unknown} v
 * @returns {any}
 */
function deepClone(v){
  try{
    if (typeof structuredClone === "function") return structuredClone(v);
  } catch {
    // ignore and fallback to JSON
  }
  try{
    return JSON.parse(JSON.stringify(v));
  } catch {
    return {};
  }
}

/**
 * @returns {{
 *   version: string,
 *   mode: "pinned_verified" | "latest_verified" | "manual",
 *   censusDatasetId: string | null,
 *   electionDatasetId: string | null,
 *   boundarySetId: string | null,
 *   crosswalkVersionId: string | null,
 *   pinnedAt: string | null,
 *   lastCheckedAt: string | null
 * }}
 */
export function makeDefaultDataRefs(){
  return {
    version: DISTRICT_DATA_VERSION,
    mode: "pinned_verified",
    censusDatasetId: null,
    electionDatasetId: null,
    boundarySetId: null,
    crosswalkVersionId: null,
    pinnedAt: null,
    lastCheckedAt: null,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof makeDefaultDataRefs>}
 */
export function normalizeDataRefs(raw){
  const base = makeDefaultDataRefs();
  if (!isObject(raw)) return base;

  const modeRaw = toCleanString(raw.mode).toLowerCase();
  const mode = ALLOWED_DATA_REF_MODES.has(modeRaw) ? modeRaw : base.mode;

  return {
    ...base,
    ...raw,
    version: toCleanString(raw.version) || base.version,
    mode,
    censusDatasetId: toIdOrNull(raw.censusDatasetId),
    electionDatasetId: toIdOrNull(raw.electionDatasetId),
    boundarySetId: toIdOrNull(raw.boundarySetId),
    crosswalkVersionId: toIdOrNull(raw.crosswalkVersionId),
    pinnedAt: toIsoOrNull(raw.pinnedAt),
    lastCheckedAt: toIsoOrNull(raw.lastCheckedAt),
  };
}

/**
 * @returns {{
 *   geoPackVersion: string,
 *   source: {
 *     dataset: string | null,
 *     vintage: string | null,
 *     refreshedAt: string | null
 *   },
 *   area: {
 *     type: string,
 *     stateFips: string,
 *     district: string,
 *     countyFips: string,
 *     placeFips: string,
 *     label: string
 *   },
 *   resolution: "tract" | "block_group",
 *   boundarySetId: string | null,
 *   units: Array<{ geoid: string, w: number }>,
 *   district: Record<string, any>,
 *   quality: {
 *     coveragePct: number | null,
 *     weightSum: number | null,
 *     unmatchedUnits: number,
 *     crosswalkMethod: string,
 *     crosswalkQuality: number | null
 *   },
 *   generatedAt: string | null
 * }}
 */
export function makeDefaultGeoPack(){
  return {
    geoPackVersion: "0.1",
    source: {
      dataset: null,
      vintage: null,
      refreshedAt: null,
    },
    area: {
      type: "",
      stateFips: "",
      district: "",
      countyFips: "",
      placeFips: "",
      label: "",
    },
    resolution: "tract",
    boundarySetId: null,
    units: [],
    district: {},
    quality: {
      coveragePct: null,
      weightSum: null,
      unmatchedUnits: 0,
      crosswalkMethod: "",
      crosswalkQuality: null,
    },
    generatedAt: null,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof makeDefaultGeoPack>}
 */
export function normalizeGeoPack(raw){
  const base = makeDefaultGeoPack();
  if (!isObject(raw)) return base;

  const sourceIn = isObject(raw.source) ? raw.source : {};
  const areaIn = isObject(raw.area) ? raw.area : {};
  const qualityIn = isObject(raw.quality) ? raw.quality : {};
  const rawUnits = Array.isArray(raw.units) ? raw.units : [];
  const units = [];

  for (const row of rawUnits){
    if (!isObject(row)) continue;
    const geoid = toCleanString(row.geoid);
    const wRaw = toFiniteOrNull(row.w);
    if (!geoid || wRaw == null) continue;
    units.push({ geoid, w: clamp(wRaw, 0, 1) });
  }

  units.sort((a, b) => a.geoid.localeCompare(b.geoid));

  const resolutionRaw = toCleanString(raw.resolution).toLowerCase();
  const resolution = ALLOWED_GEO_RESOLUTIONS.has(resolutionRaw) ? resolutionRaw : base.resolution;

  return {
    ...base,
    ...raw,
    geoPackVersion: toCleanString(raw.geoPackVersion) || base.geoPackVersion,
    source: {
      ...base.source,
      ...sourceIn,
      dataset: toIdOrNull(sourceIn.dataset),
      vintage: toIdOrNull(sourceIn.vintage),
      refreshedAt: toIsoOrNull(sourceIn.refreshedAt),
    },
    area: {
      ...base.area,
      ...areaIn,
      type: toCleanString(areaIn.type),
      stateFips: toCleanString(areaIn.stateFips),
      district: toCleanString(areaIn.district),
      countyFips: toCleanString(areaIn.countyFips),
      placeFips: toCleanString(areaIn.placeFips),
      label: toCleanString(areaIn.label),
    },
    resolution,
    boundarySetId: toIdOrNull(raw.boundarySetId),
    units,
    district: isObject(raw.district) ? deepClone(raw.district) : {},
    quality: {
      ...base.quality,
      ...qualityIn,
      coveragePct: toFiniteOrNull(qualityIn.coveragePct),
      weightSum: toFiniteOrNull(qualityIn.weightSum),
      unmatchedUnits: Math.max(0, Math.trunc(toFiniteOrNull(qualityIn.unmatchedUnits) || 0)),
      crosswalkMethod: toCleanString(qualityIn.crosswalkMethod),
      crosswalkQuality: toFiniteOrNull(qualityIn.crosswalkQuality),
    },
    generatedAt: toIsoOrNull(raw.generatedAt),
  };
}

/**
 * @returns {{
 *   version: string,
 *   ready: boolean,
 *   indices: {
 *     fieldSpeed: number,
 *     persuasionEnv: number,
 *     turnoutElasticity: number,
 *     fieldDifficulty: number
 *   },
 *   bounds: { min: number, max: number },
 *   derivedAssumptions: {
 *     doorsPerHour: { base: number | null, adjusted: number | null },
 *     persuasionRate: { base: number | null, adjusted: number | null },
 *     turnoutLift: { base: number | null, adjusted: number | null },
 *     organizerCapacity: { base: number | null, adjusted: number | null }
 *   },
 *   provenance: {
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null,
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null
 *   },
 *   generatedAt: string | null,
 *   warnings: string[]
 * }}
 */
export function makeDefaultDistrictIntelPack(){
  return {
    version: "0.1",
    ready: false,
    indices: {
      fieldSpeed: 1,
      persuasionEnv: 1,
      turnoutElasticity: 1,
      fieldDifficulty: 1,
    },
    bounds: { min: 0.6, max: 1.4 },
    derivedAssumptions: {
      doorsPerHour: { base: null, adjusted: null },
      persuasionRate: { base: null, adjusted: null },
      turnoutLift: { base: null, adjusted: null },
      organizerCapacity: { base: null, adjusted: null },
    },
    provenance: {
      censusDatasetId: null,
      electionDatasetId: null,
      boundarySetId: null,
      crosswalkVersionId: null,
    },
    generatedAt: null,
    warnings: [],
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof makeDefaultDistrictIntelPack>}
 */
export function normalizeDistrictIntelPack(raw){
  const base = makeDefaultDistrictIntelPack();
  if (!isObject(raw)) return base;

  const boundsIn = isObject(raw.bounds) ? raw.bounds : {};
  const minRaw = toFiniteOrNull(boundsIn.min);
  const maxRaw = toFiniteOrNull(boundsIn.max);
  const min = minRaw == null ? base.bounds.min : clamp(minRaw, 0.1, 5);
  const maxDefaulted = maxRaw == null ? base.bounds.max : clamp(maxRaw, min, 5);
  const max = Math.max(min, maxDefaulted);
  const bounds = { min, max };

  const indicesIn = isObject(raw.indices) ? raw.indices : {};
  const derivedIn = isObject(raw.derivedAssumptions) ? raw.derivedAssumptions : {};
  const provenanceIn = isObject(raw.provenance) ? raw.provenance : {};
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((x) => toCleanString(x)).filter(Boolean)
    : [];

  /**
   * @param {unknown} row
   * @returns {{ base: number | null, adjusted: number | null }}
   */
  const normalizeDerivedPair = (row) => {
    const inRow = isObject(row) ? row : {};
    return {
      base: toFiniteOrNull(inRow.base),
      adjusted: toFiniteOrNull(inRow.adjusted),
    };
  };

  /**
   * @param {unknown} rawValue
   * @returns {number}
   */
  const normalizeIndex = (rawValue) => {
    const n = toFiniteOrNull(rawValue);
    const baseValue = n == null ? 1 : n;
    return clamp(baseValue, bounds.min, bounds.max);
  };

  return {
    ...base,
    ...raw,
    version: toCleanString(raw.version) || base.version,
    ready: !!raw.ready,
    indices: {
      fieldSpeed: normalizeIndex(indicesIn.fieldSpeed),
      persuasionEnv: normalizeIndex(indicesIn.persuasionEnv),
      turnoutElasticity: normalizeIndex(indicesIn.turnoutElasticity),
      fieldDifficulty: normalizeIndex(indicesIn.fieldDifficulty),
    },
    bounds,
    derivedAssumptions: {
      doorsPerHour: normalizeDerivedPair(derivedIn.doorsPerHour),
      persuasionRate: normalizeDerivedPair(derivedIn.persuasionRate),
      turnoutLift: normalizeDerivedPair(derivedIn.turnoutLift),
      organizerCapacity: normalizeDerivedPair(derivedIn.organizerCapacity),
    },
    provenance: {
      censusDatasetId: toIdOrNull(provenanceIn.censusDatasetId),
      electionDatasetId: toIdOrNull(provenanceIn.electionDatasetId),
      boundarySetId: toIdOrNull(provenanceIn.boundarySetId),
      crosswalkVersionId: toIdOrNull(provenanceIn.crosswalkVersionId),
    },
    generatedAt: toIsoOrNull(raw.generatedAt),
    warnings,
  };
}

/**
 * @param {Record<string, any>} state
 * @returns {Record<string, any>}
 */
export function normalizeDistrictDataState(state){
  if (!isObject(state)) return state;
  state.useDistrictIntel = !!state.useDistrictIntel;
  state.dataRefs = normalizeDataRefs(state.dataRefs);
  state.geoPack = normalizeGeoPack(state.geoPack);
  state.districtIntelPack = normalizeDistrictIntelPack(state.districtIntelPack);
  return state;
}

/**
 * @param {unknown} scenario
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateDistrictDataContract(scenario){
  const errors = [];
  const warnings = [];
  if (!isObject(scenario)){
    return { ok: false, errors: ["Scenario must be an object."], warnings };
  }

  const refs = normalizeDataRefs(scenario.dataRefs);
  const geo = normalizeGeoPack(scenario.geoPack);
  const intel = normalizeDistrictIntelPack(scenario.districtIntelPack);
  const useIntel = !!scenario.useDistrictIntel;
  const districtDataInUse = !!(
    useIntel ||
    intel.ready ||
    refs.censusDatasetId ||
    refs.electionDatasetId ||
    refs.boundarySetId ||
    refs.crosswalkVersionId ||
    refs.pinnedAt ||
    refs.lastCheckedAt ||
    geo.generatedAt ||
    geo.units.length
  );

  if (refs.mode === "pinned_verified" && districtDataInUse){
    if (!refs.censusDatasetId) warnings.push("Pinned mode active but censusDatasetId is not set.");
    if (!refs.electionDatasetId) warnings.push("Pinned mode active but electionDatasetId is not set.");
    if (!refs.boundarySetId) warnings.push("Pinned mode active but boundarySetId is not set.");
    if (!refs.crosswalkVersionId) warnings.push("Pinned mode active but crosswalkVersionId is not set.");
  }

  if (geo.units.length){
    let sum = 0;
    for (const u of geo.units){
      sum += Number(u.w) || 0;
    }
    if (sum <= 0){
      errors.push("geoPack.units contains no positive weights.");
    } else if (Math.abs(sum - 1) > 0.05){
      warnings.push(`geoPack.units weights sum to ${sum.toFixed(4)} (expected near 1.0).`);
    }
  }

  if (useIntel && !intel.ready){
    warnings.push("useDistrictIntel is ON but districtIntelPack.ready is false.");
  }

  if (intel.ready){
    const prov = intel.provenance || {};
    if (refs.censusDatasetId && prov.censusDatasetId && refs.censusDatasetId !== prov.censusDatasetId){
      warnings.push("districtIntelPack provenance censusDatasetId differs from dataRefs.");
    }
    if (refs.electionDatasetId && prov.electionDatasetId && refs.electionDatasetId !== prov.electionDatasetId){
      warnings.push("districtIntelPack provenance electionDatasetId differs from dataRefs.");
    }
    if (refs.boundarySetId && prov.boundarySetId && refs.boundarySetId !== prov.boundarySetId){
      warnings.push("districtIntelPack provenance boundarySetId differs from dataRefs.");
    }
    if (refs.crosswalkVersionId && prov.crosswalkVersionId && refs.crosswalkVersionId !== prov.crosswalkVersionId){
      warnings.push("districtIntelPack provenance crosswalkVersionId differs from dataRefs.");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
