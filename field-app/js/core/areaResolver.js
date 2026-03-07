// @ts-check
// Area resolver contract utilities (pure, deterministic, cache-key focused).
// No network fetches and no planning-math side effects.

const ALLOWED_AREA_TYPES = new Set(["CD", "SLDU", "SLDL", "COUNTY", "PLACE", "CUSTOM"]);
const ALLOWED_RESOLUTIONS = new Set(["tract", "block_group"]);

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function digits(v){
  return str(v).replace(/\D+/g, "");
}

/**
 * @param {string} s
 * @param {number} len
 * @returns {string}
 */
function padDigits(s, len){
  if (!/^\d+$/.test(s)) return s;
  return s.padStart(len, "0");
}

/**
 * @param {unknown} v
 * @returns {"CD"|"SLDU"|"SLDL"|"COUNTY"|"PLACE"|"CUSTOM"|""}
 */
function normalizeAreaType(v){
  const t = str(v).toUpperCase();
  return ALLOWED_AREA_TYPES.has(t) ? /** @type {any} */ (t) : "";
}

/**
 * @param {unknown} v
 * @returns {"tract"|"block_group"}
 */
function normalizeResolution(v){
  const s = str(v).toLowerCase();
  return ALLOWED_RESOLUTIONS.has(s) ? /** @type {any} */ (s) : "tract";
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeStateFips(v){
  const d = digits(v);
  return d ? padDigits(d, 2) : "";
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeCountyFips(v){
  const d = digits(v);
  if (!d) return "";
  if (d.length <= 3) return padDigits(d, 3);
  return padDigits(d, 5);
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizePlaceFips(v){
  const d = digits(v);
  return d ? padDigits(d, 5) : "";
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeDistrict(v){
  const raw = str(v);
  const d = digits(raw);
  if (!d) return raw.toUpperCase();
  return padDigits(d, 3);
}

/**
 * @param {unknown} raw
 * @returns {{
 *   type: "CD"|"SLDU"|"SLDL"|"COUNTY"|"PLACE"|"CUSTOM"|"",
 *   stateFips: string,
 *   district: string,
 *   countyFips: string,
 *   placeFips: string,
 *   label: string,
 *   boundarySetId: string | null,
 *   boundaryVintage: string | null,
 *   resolution: "tract" | "block_group"
 * }}
 */
export function normalizeAreaSelection(raw){
  const inObj = (raw && typeof raw === "object" && !Array.isArray(raw)) ? /** @type {Record<string, any>} */ (raw) : {};
  const type = normalizeAreaType(inObj.type);
  const boundarySetId = str(inObj.boundarySetId) || null;
  const vintageRaw = str(inObj.boundaryVintage || inObj.vintage);
  return {
    type,
    stateFips: normalizeStateFips(inObj.stateFips),
    district: normalizeDistrict(inObj.district),
    countyFips: normalizeCountyFips(inObj.countyFips),
    placeFips: normalizePlaceFips(inObj.placeFips),
    label: str(inObj.label),
    boundarySetId,
    boundaryVintage: vintageRaw || null,
    resolution: normalizeResolution(inObj.resolution),
  };
}

/**
 * @param {ReturnType<typeof normalizeAreaSelection>} a
 * @returns {string}
 */
export function buildAreaIdentityToken(a){
  if (a.type === "COUNTY"){
    const c = a.countyFips || (a.stateFips && a.district ? `${a.stateFips}${a.district}` : "");
    return c || "-";
  }
  if (a.type === "PLACE"){
    const p = a.placeFips || (a.stateFips && a.district ? `${a.stateFips}${a.district}` : "");
    return p || "-";
  }
  if (a.type === "CD" || a.type === "SLDU" || a.type === "SLDL"){
    return `${a.stateFips || "--"}:${a.district || "---"}`;
  }
  if (a.type === "CUSTOM"){
    const bits = [a.stateFips, a.countyFips, a.placeFips, a.district].filter(Boolean);
    return bits.length ? bits.join(":") : "-";
  }
  return "-";
}

/**
 * @param {{
 *   area: unknown,
 *   resolution?: unknown,
 *   boundarySetId?: unknown,
 *   boundaryVintage?: unknown
 * }} args
 * @returns {string}
 */
export function buildAreaResolverCacheKey(args){
  const areaIn = (args && typeof args === "object" && !Array.isArray(args))
    ? /** @type {Record<string, any>} */ (args)
    : {};
  const a = normalizeAreaSelection({
    ...(areaIn.area || {}),
    resolution: areaIn.resolution ?? areaIn.area?.resolution,
    boundarySetId: areaIn.boundarySetId ?? areaIn.area?.boundarySetId,
    boundaryVintage: areaIn.boundaryVintage ?? areaIn.area?.boundaryVintage ?? areaIn.area?.vintage,
  });
  const id = buildAreaIdentityToken(a);
  return [
    "area:v1",
    `type=${a.type || "-"}`,
    `id=${id}`,
    `boundary=${a.boundarySetId || "-"}`,
    `vintage=${a.boundaryVintage || "-"}`,
    `resolution=${a.resolution}`,
  ].join("|");
}

/**
 * @param {{
 *   scenario: unknown,
 *   registry?: unknown
 * }} args
 * @returns {{
 *   area: ReturnType<typeof normalizeAreaSelection>,
 *   cacheKey: string,
 *   notes: string[]
 * }}
 */
export function deriveAreaResolverContext(args){
  const scen = (args?.scenario && typeof args.scenario === "object" && !Array.isArray(args.scenario))
    ? /** @type {Record<string, any>} */ (args.scenario)
    : {};
  const geo = (scen.geoPack && typeof scen.geoPack === "object" && !Array.isArray(scen.geoPack))
    ? /** @type {Record<string, any>} */ (scen.geoPack)
    : {};
  const refs = (scen.dataRefs && typeof scen.dataRefs === "object" && !Array.isArray(scen.dataRefs))
    ? /** @type {Record<string, any>} */ (scen.dataRefs)
    : {};
  const registry = (args?.registry && typeof args.registry === "object" && !Array.isArray(args.registry))
    ? /** @type {Record<string, any>} */ (args.registry)
    : {};
  const byBoundary = (registry.byId && typeof registry.byId === "object" && registry.byId.boundarySets && typeof registry.byId.boundarySets === "object")
    ? /** @type {Record<string, any>} */ (registry.byId.boundarySets)
    : {};

  const notes = [];
  const boundarySetId = str(geo.boundarySetId || refs.boundarySetId) || null;
  let boundaryVintage = null;
  if (boundarySetId && byBoundary[boundarySetId]){
    boundaryVintage = str(byBoundary[boundarySetId].vintage) || null;
  } else if (boundarySetId){
    notes.push(`Boundary set '${boundarySetId}' missing from registry for vintage lookup.`);
  }

  const area = normalizeAreaSelection({
    ...(geo.area || {}),
    resolution: geo.resolution,
    boundarySetId,
    boundaryVintage,
  });
  const cacheKey = buildAreaResolverCacheKey({ area });
  return { area, cacheKey, notes };
}

