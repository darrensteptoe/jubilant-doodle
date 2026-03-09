export const CENSUS_LOCAL_KEY = "fpe.census.apiKey";

const YEARS_FLOOR = 2016;

const RESOLUTION_OPTIONS = [
  { id: "place", label: "Place" },
  { id: "tract", label: "Tract" },
  { id: "block_group", label: "Block group" },
];

const METRIC_SET_OPTIONS = [
  { id: "core", label: "Core" },
  { id: "demographics", label: "Demographics" },
  { id: "housing", label: "Housing" },
  { id: "income", label: "Income" },
  { id: "education", label: "Education" },
  { id: "language", label: "Language" },
  { id: "all", label: "All bundles" },
];

const METRICS = {
  population_total: {
    id: "population_total",
    label: "Population",
    kind: "sum",
    vars: ["B01003_001E"],
    sumVars: ["B01003_001E"],
    format: "int",
  },
  households_total: {
    id: "households_total",
    label: "Households",
    kind: "sum",
    vars: ["B11001_001E"],
    sumVars: ["B11001_001E"],
    format: "int",
  },
  housing_units_total: {
    id: "housing_units_total",
    label: "Housing units",
    kind: "sum",
    vars: ["B25001_001E"],
    sumVars: ["B25001_001E"],
    format: "int",
  },
  owner_occupied_share: {
    id: "owner_occupied_share",
    label: "Owner-occupied share",
    kind: "ratio",
    vars: ["B25003_002E", "B25003_001E"],
    numeratorVars: ["B25003_002E"],
    denominatorVars: ["B25003_001E"],
    format: "pct1",
  },
  renter_share: {
    id: "renter_share",
    label: "Renter share",
    kind: "ratio",
    vars: ["B25003_003E", "B25003_001E"],
    numeratorVars: ["B25003_003E"],
    denominatorVars: ["B25003_001E"],
    format: "pct1",
  },
  median_household_income_est: {
    id: "median_household_income_est",
    label: "Median HH income (est.)",
    kind: "weighted_mean",
    vars: ["B19013_001E", "B11001_001E"],
    valueVar: "B19013_001E",
    weightVar: "B11001_001E",
    format: "currency0",
  },
  white_share: {
    id: "white_share",
    label: "White share",
    kind: "ratio",
    vars: ["B02001_002E", "B02001_001E"],
    numeratorVars: ["B02001_002E"],
    denominatorVars: ["B02001_001E"],
    format: "pct1",
  },
  black_share: {
    id: "black_share",
    label: "Black share",
    kind: "ratio",
    vars: ["B02001_003E", "B02001_001E"],
    numeratorVars: ["B02001_003E"],
    denominatorVars: ["B02001_001E"],
    format: "pct1",
  },
  hispanic_share: {
    id: "hispanic_share",
    label: "Hispanic share",
    kind: "ratio",
    vars: ["B03003_003E", "B03003_001E"],
    numeratorVars: ["B03003_003E"],
    denominatorVars: ["B03003_001E"],
    format: "pct1",
  },
  ba_plus_share: {
    id: "ba_plus_share",
    label: "BA+ share",
    kind: "ratio",
    vars: [
      "B15003_022E",
      "B15003_023E",
      "B15003_024E",
      "B15003_025E",
      "B15003_001E",
    ],
    numeratorVars: ["B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E"],
    denominatorVars: ["B15003_001E"],
    format: "pct1",
  },
  limited_english_share: {
    id: "limited_english_share",
    label: "Limited-English share",
    kind: "ratio",
    vars: ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E", "C16002_001E"],
    numeratorVars: ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E"],
    denominatorVars: ["C16002_001E"],
    format: "pct1",
  },
  multi_unit_share: {
    id: "multi_unit_share",
    label: "Multi-unit share",
    kind: "ratio",
    vars: [
      "B25024_003E",
      "B25024_004E",
      "B25024_005E",
      "B25024_006E",
      "B25024_007E",
      "B25024_008E",
      "B25024_009E",
      "B25024_010E",
      "B25024_011E",
      "B25024_001E",
    ],
    numeratorVars: [
      "B25024_003E",
      "B25024_004E",
      "B25024_005E",
      "B25024_006E",
      "B25024_007E",
      "B25024_008E",
      "B25024_009E",
      "B25024_010E",
      "B25024_011E",
    ],
    denominatorVars: ["B25024_001E"],
    format: "pct1",
  },
};

const METRIC_SET_MAP = {
  core: ["population_total", "households_total", "housing_units_total", "owner_occupied_share", "renter_share"],
  demographics: ["population_total", "white_share", "black_share", "hispanic_share"],
  housing: ["housing_units_total", "owner_occupied_share", "renter_share", "multi_unit_share"],
  income: ["median_household_income_est"],
  education: ["ba_plus_share"],
  language: ["limited_english_share"],
  all: Object.keys(METRICS),
};

const TIGER_BOUNDARY_LAYERS = {
  tract: [{ service: "Tracts_Blocks", layer: 10, field: "GEOID" }],
  block_group: [{ service: "Tracts_Blocks", layer: 11, field: "GEOID" }],
  place: [
    { service: "Places_CouSub_ConCity_SubMCD", layer: 4, field: "GEOID" },
    { service: "Places_CouSub_ConCity_SubMCD", layer: 5, field: "GEOID" },
  ],
};

export function listResolutionOptions(){
  return RESOLUTION_OPTIONS.map((x) => ({ ...x }));
}

export function listMetricSetOptions(){
  return METRIC_SET_OPTIONS.map((x) => ({ ...x }));
}

export function listAcsYears(nowYear = new Date().getFullYear()){
  const max = Math.max(YEARS_FLOOR, Number(nowYear) - 2);
  const out = [];
  for (let y = max; y >= YEARS_FLOOR; y -= 1){
    out.push(String(y));
  }
  return out;
}

export function getMetricIdsForSet(metricSetId){
  const id = String(metricSetId || "core").trim();
  return Array.isArray(METRIC_SET_MAP[id]) ? METRIC_SET_MAP[id].slice() : METRIC_SET_MAP.core.slice();
}

export function getMetricsForSet(metricSetId){
  return getMetricIdsForSet(metricSetId)
    .map((id) => METRICS[id])
    .filter((row) => !!row)
    .map((row) => ({ ...row }));
}

export function getVariablesForMetricSet(metricSetId){
  const ids = getMetricIdsForSet(metricSetId);
  const uniq = new Set();
  for (const id of ids){
    const spec = METRICS[id];
    if (!spec) continue;
    for (const v of spec.vars || []) uniq.add(String(v));
  }
  return Array.from(uniq);
}

function cleanText(v){
  return String(v == null ? "" : v).trim();
}

function fips(v, len){
  const digits = cleanText(v).replace(/\D+/g, "");
  if (!digits) return "";
  return digits.padStart(len, "0").slice(-len);
}

function defaultYear(){
  const years = listAcsYears();
  return years[0] || "2024";
}

export function makeDefaultCensusState(){
  return {
    year: defaultYear(),
    resolution: "tract",
    metricSet: "core",
    stateFips: "",
    countyFips: "",
    placeFips: "",
    geoSearch: "",
    tractFilter: "",
    geoOptions: [],
    selectedGeoids: [],
    rowsByGeoid: {},
    activeRowsKey: "",
    loadedRowCount: 0,
    loadingGeo: false,
    loadingRows: false,
    status: "Ready.",
    error: "",
    lastFetchAt: "",
    variableCatalogYear: "",
    variableCatalogCount: 0,
    requestSeq: 0,
  };
}

export function normalizeCensusState(input, { resetRuntime = false } = {}){
  const base = makeDefaultCensusState();
  const src = input && typeof input === "object" ? input : {};
  const out = { ...base, ...src };
  const years = new Set(listAcsYears());
  out.year = years.has(String(out.year || "")) ? String(out.year) : base.year;
  const resolution = String(out.resolution || "");
  out.resolution = ["place", "tract", "block_group"].includes(resolution) ? resolution : "tract";
  out.metricSet = METRIC_SET_MAP[String(out.metricSet || "")] ? String(out.metricSet) : "core";
  out.stateFips = fips(out.stateFips, 2);
  out.countyFips = fips(out.countyFips, 3);
  out.placeFips = fips(out.placeFips, 5);
  out.geoSearch = cleanText(out.geoSearch);
  out.tractFilter = fips(out.tractFilter, 6);
  out.geoOptions = Array.isArray(out.geoOptions) ? out.geoOptions.map((row) => ({ ...row })) : [];
  out.selectedGeoids = Array.isArray(out.selectedGeoids)
    ? out.selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v)
    : [];
  out.rowsByGeoid = {};
  out.activeRowsKey = resetRuntime ? "" : cleanText(out.activeRowsKey);
  out.loadedRowCount = resetRuntime
    ? 0
    : (Number.isFinite(Number(out.loadedRowCount)) ? Math.max(0, Math.floor(Number(out.loadedRowCount))) : 0);
  out.loadingGeo = !!out.loadingGeo;
  out.loadingRows = !!out.loadingRows;
  out.status = cleanText(out.status) || "Ready.";
  out.error = cleanText(out.error);
  out.lastFetchAt = cleanText(out.lastFetchAt);
  out.variableCatalogYear = cleanText(out.variableCatalogYear);
  out.variableCatalogCount = Number.isFinite(Number(out.variableCatalogCount)) ? Number(out.variableCatalogCount) : 0;
  out.requestSeq = Number.isFinite(Number(out.requestSeq)) ? Number(out.requestSeq) : 0;
  if (out.resolution === "place"){
    out.countyFips = "";
    out.tractFilter = "";
  }
  if (!out.stateFips){
    out.countyFips = "";
    out.placeFips = "";
    out.geoSearch = "";
    out.tractFilter = "";
    out.geoOptions = [];
    out.selectedGeoids = [];
    out.rowsByGeoid = {};
  }
  return out;
}

function encodeGetVars(vars){
  const deduped = [];
  const seen = new Set();
  for (const v of vars || []){
    const key = cleanText(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(key);
  }
  if (!deduped.includes("NAME")) deduped.unshift("NAME");
  return deduped.join(",");
}

export function buildAcsQueryUrl({ year, getVars, forClause, inClauses = [], key, dataset = "acs/acs5" }){
  const y = cleanText(year);
  const vars = encodeGetVars(getVars || []);
  const forPart = cleanText(forClause);
  const inParts = Array.isArray(inClauses)
    ? inClauses.map((v) => cleanText(v)).filter((v) => !!v)
    : [];
  const token = cleanText(key);
  const params = [];
  params.push(`get=${encodeURIComponent(vars)}`);
  params.push(`for=${encodeURIComponent(forPart)}`);
  for (const part of inParts){
    params.push(`in=${encodeURIComponent(part)}`);
  }
  if (token) params.push(`key=${encodeURIComponent(token)}`);
  return `https://api.census.gov/data/${encodeURIComponent(y)}/${dataset}?${params.join("&")}`;
}

export function buildGeoLookupUrl({ stateFips, scope, year = "2020", key }){
  const state = fips(stateFips, 2);
  const token = cleanText(key);
  const forClause = scope === "state" ? "state:*" : scope === "county" ? "county:*" : "place:*";
  const inClauses = scope === "state" ? [] : [`state:${state}`];
  const params = [];
  params.push(`get=${encodeURIComponent("NAME")}`);
  params.push(`for=${encodeURIComponent(forClause)}`);
  for (const part of inClauses){
    params.push(`in=${encodeURIComponent(part)}`);
  }
  if (token) params.push(`key=${encodeURIComponent(token)}`);
  return `https://api.census.gov/data/${encodeURIComponent(cleanText(year))}/dec/pl?${params.join("&")}`;
}

async function fetchJson(url, fetchImpl = globalThis.fetch){
  if (typeof fetchImpl !== "function"){
    throw new Error("Fetch is unavailable.");
  }
  const res = await fetchImpl(url);
  if (!res || !res.ok){
    const status = res?.status ?? "";
    const text = res?.statusText || "Request failed";
    throw new Error(`Census request failed (${status}): ${text}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)){
    throw new Error("Unexpected Census response format.");
  }
  return json;
}

async function fetchBlockGroupTable({ year, getVars, stateFips, countyFips, key, fetchImpl } = {}){
  const inClauses = [`state:${fips(stateFips, 2)}`, `county:${fips(countyFips, 3)}`, "tract:*"];
  const wildcardUrl = buildAcsQueryUrl({
    year,
    getVars,
    forClause: "block group:*",
    inClauses,
    key,
  });
  try{
    return await fetchJson(wildcardUrl, fetchImpl);
  } catch (wildcardErr){
    const tractUrl = buildAcsQueryUrl({
      year,
      getVars: ["NAME"],
      forClause: "tract:*",
      inClauses: [`state:${fips(stateFips, 2)}`, `county:${fips(countyFips, 3)}`],
      key,
    });
    const tractJson = await fetchJson(tractUrl, fetchImpl);
    const tracts = parseCensusTable(tractJson)
      .map((row) => fips(row?.tract, 6))
      .filter((v) => !!v);
    let headers = null;
    const bodyRows = [];
    for (const tract of tracts){
      const url = buildAcsQueryUrl({
        year,
        getVars,
        forClause: "block group:*",
        inClauses: [`state:${fips(stateFips, 2)}`, `county:${fips(countyFips, 3)}`, `tract:${tract}`],
        key,
      });
      const json = await fetchJson(url, fetchImpl);
      if (!Array.isArray(json) || !Array.isArray(json[0])) continue;
      if (!headers) headers = json[0].slice();
      for (let i = 1; i < json.length; i += 1){
        bodyRows.push(json[i]);
      }
    }
    if (!headers) throw wildcardErr;
    return [headers, ...bodyRows];
  }
}

export function parseCensusTable(table){
  if (!Array.isArray(table) || table.length < 1 || !Array.isArray(table[0])){
    return [];
  }
  const headers = table[0].map((v) => cleanText(v));
  const out = [];
  for (let i = 1; i < table.length; i += 1){
    const row = Array.isArray(table[i]) ? table[i] : [];
    const item = {};
    for (let j = 0; j < headers.length; j += 1){
      item[headers[j]] = row[j];
    }
    out.push(item);
  }
  return out;
}

function extractName(row){
  return cleanText(row?.NAME || row?.name || "");
}

function geoidFromRow(row, resolution){
  const state = fips(row?.state, 2);
  if (resolution === "place"){
    const place = fips(row?.place, 5);
    return state && place ? `${state}${place}` : "";
  }
  if (resolution === "tract"){
    const county = fips(row?.county, 3);
    const tract = fips(row?.tract, 6);
    return state && county && tract ? `${state}${county}${tract}` : "";
  }
  const county = fips(row?.county, 3);
  const tract = fips(row?.tract, 6);
  const blockGroup = fips(row?.["block group"], 1);
  return state && county && tract && blockGroup ? `${state}${county}${tract}${blockGroup}` : "";
}

function geoLabel(name, geoid){
  if (name && geoid) return `${name} (${geoid})`;
  if (name) return name;
  return geoid;
}

export function optionFromRow(row, resolution){
  const geoid = geoidFromRow(row, resolution);
  const name = extractName(row);
  return {
    geoid,
    label: geoLabel(name, geoid),
    name,
    state: fips(row?.state, 2),
    county: fips(row?.county, 3),
    place: fips(row?.place, 5),
    tract: fips(row?.tract, 6),
    blockGroup: fips(row?.["block group"], 1),
  };
}

export async function fetchStateOptions({ key, fetchImpl } = {}){
  const url = buildGeoLookupUrl({ scope: "state", key });
  const json = await fetchJson(url, fetchImpl);
  const rows = parseCensusTable(json).map((row) => ({
    fips: fips(row?.state, 2),
    name: extractName(row),
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export async function fetchCountyOptions({ stateFips, key, fetchImpl } = {}){
  const state = fips(stateFips, 2);
  if (!state) return [];
  const url = buildGeoLookupUrl({ scope: "county", stateFips: state, key });
  const json = await fetchJson(url, fetchImpl);
  const rows = parseCensusTable(json).map((row) => ({
    fips: fips(row?.county, 3),
    name: extractName(row),
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export async function fetchPlaceOptions({ stateFips, key, fetchImpl } = {}){
  const state = fips(stateFips, 2);
  if (!state) return [];
  const url = buildGeoLookupUrl({ scope: "place", stateFips: state, key });
  const json = await fetchJson(url, fetchImpl);
  const rows = parseCensusTable(json).map((row) => ({
    fips: fips(row?.place, 5),
    name: extractName(row),
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function geoForClause(resolution){
  if (resolution === "place") return "place:*";
  if (resolution === "tract") return "tract:*";
  return "block group:*";
}

function geoInClauses({ resolution, stateFips, countyFips }){
  const state = fips(stateFips, 2);
  const county = fips(countyFips, 3);
  if (resolution === "place"){
    return [`state:${state}`];
  }
  if (resolution === "tract"){
    return [`state:${state}`, `county:${county}`];
  }
  return [`state:${state}`, `county:${county}`, "tract:*"];
}

function requiredForResolution(resolution, stateFips, countyFips){
  const state = fips(stateFips, 2);
  const county = fips(countyFips, 3);
  if (!state) return false;
  if (resolution === "place") return true;
  return !!county;
}

export async function fetchGeoOptions({ year, resolution, stateFips, countyFips, key, fetchImpl } = {}){
  if (!requiredForResolution(resolution, stateFips, countyFips)) return [];
  const vars = ["NAME"];
  const json = resolution === "block_group"
    ? await fetchBlockGroupTable({ year, getVars: vars, stateFips, countyFips, key, fetchImpl })
    : await fetchJson(buildAcsQueryUrl({
      year,
      getVars: vars,
      forClause: geoForClause(resolution),
      inClauses: geoInClauses({ resolution, stateFips, countyFips }),
      key,
    }), fetchImpl);
  const rows = parseCensusTable(json)
    .map((row) => optionFromRow(row, resolution))
    .filter((row) => !!row.geoid)
    .sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

function parseEstimate(raw){
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function rowToData(row, resolution, variableIds){
  const option = optionFromRow(row, resolution);
  const values = {};
  for (const variableId of variableIds){
    values[variableId] = parseEstimate(row?.[variableId]);
  }
  return {
    ...option,
    values,
  };
}

export async function fetchAcsRows({ year, resolution, stateFips, countyFips, metricSet, key, fetchImpl } = {}){
  if (!requiredForResolution(resolution, stateFips, countyFips)) return {};
  const variableIds = getVariablesForMetricSet(metricSet);
  const json = resolution === "block_group"
    ? await fetchBlockGroupTable({ year, getVars: ["NAME", ...variableIds], stateFips, countyFips, key, fetchImpl })
    : await fetchJson(buildAcsQueryUrl({
      year,
      getVars: ["NAME", ...variableIds],
      forClause: geoForClause(resolution),
      inClauses: geoInClauses({ resolution, stateFips, countyFips }),
      key,
    }), fetchImpl);
  const rows = parseCensusTable(json)
    .map((row) => rowToData(row, resolution, variableIds))
    .filter((row) => !!row.geoid);
  const out = {};
  for (const row of rows){
    out[row.geoid] = row;
  }
  return out;
}

export async function fetchVariableCatalog({ year, key, fetchImpl } = {}){
  const token = cleanText(key);
  const url = `https://api.census.gov/data/${encodeURIComponent(cleanText(year))}/acs/acs5/variables.json${token ? `?key=${encodeURIComponent(token)}` : ""}`;
  const fetcher = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("Fetch is unavailable.");
  const res = await fetcher(url);
  if (!res || !res.ok){
    const status = res?.status ?? "";
    const text = res?.statusText || "Request failed";
    throw new Error(`Variable catalog request failed (${status}): ${text}`);
  }
  const json = await res.json();
  const vars = json?.variables && typeof json.variables === "object" ? Object.keys(json.variables) : [];
  return vars;
}

function geoidLengthForResolution(resolution){
  if (resolution === "place") return 7;
  if (resolution === "tract") return 11;
  return 12;
}

function normalizedGeoidsForResolution(geoids, resolution){
  const targetLen = geoidLengthForResolution(resolution);
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(geoids) ? geoids : []){
    const digits = cleanText(raw).replace(/\D+/g, "");
    if (digits.length !== targetLen || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

function chunk(values, size){
  const out = [];
  for (let i = 0; i < values.length; i += size){
    out.push(values.slice(i, i + size));
  }
  return out;
}

export function buildTigerBoundaryQueryUrls({ resolution, geoids, chunkSize = 60 } = {}){
  const type = String(resolution || "").trim();
  const layers = Array.isArray(TIGER_BOUNDARY_LAYERS[type]) ? TIGER_BOUNDARY_LAYERS[type] : [];
  if (!layers.length) return [];
  const normalizedGeoids = normalizedGeoidsForResolution(geoids, type);
  if (!normalizedGeoids.length) return [];
  const chunkLen = Number.isFinite(Number(chunkSize)) && Number(chunkSize) > 0 ? Number(chunkSize) : 60;
  const inChunks = chunk(normalizedGeoids, chunkLen);
  const urls = [];
  for (const layer of layers){
    for (const inChunk of inChunks){
      const where = `${layer.field} IN (${inChunk.map((id) => `'${id}'`).join(",")})`;
      const params = [];
      params.push(`where=${encodeURIComponent(where)}`);
      params.push(`outFields=${encodeURIComponent("GEOID,NAME")}`);
      params.push("returnGeometry=true");
      params.push(`outSR=${encodeURIComponent("4326")}`);
      params.push(`f=${encodeURIComponent("geojson")}`);
      urls.push(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/${layer.service}/MapServer/${layer.layer}/query?${params.join("&")}`);
    }
  }
  return urls;
}

async function fetchGeoJson(url, fetchImpl = globalThis.fetch){
  if (typeof fetchImpl !== "function"){
    throw new Error("Fetch is unavailable.");
  }
  const res = await fetchImpl(url);
  if (!res || !res.ok){
    const status = res?.status ?? "";
    const text = res?.statusText || "Request failed";
    throw new Error(`Boundary request failed (${status}): ${text}`);
  }
  const json = await res.json();
  if (!json || typeof json !== "object" || !Array.isArray(json.features)){
    throw new Error("Unexpected boundary response format.");
  }
  return json;
}

function featureGeoid(feature){
  const raw = feature?.properties?.GEOID ?? feature?.properties?.geoid ?? feature?.id;
  return cleanText(raw).replace(/\D+/g, "");
}

export async function fetchTigerBoundaryGeojson({ resolution, geoids, chunkSize = 60, fetchImpl } = {}){
  const type = String(resolution || "").trim();
  const normalizedGeoids = normalizedGeoidsForResolution(geoids, type);
  const urls = buildTigerBoundaryQueryUrls({ resolution: type, geoids: normalizedGeoids, chunkSize });
  if (!urls.length){
    return {
      featureCollection: { type: "FeatureCollection", features: [] },
      requestedGeoids: normalizedGeoids,
      matchedGeoids: [],
      missingGeoids: normalizedGeoids.slice(),
    };
  }
  const deduped = new Map();
  for (const url of urls){
    const geo = await fetchGeoJson(url, fetchImpl);
    for (const feature of geo.features){
      const geoid = featureGeoid(feature);
      const key = geoid || `${deduped.size + 1}`;
      if (!deduped.has(key)){
        deduped.set(key, feature);
      }
    }
  }
  const matched = new Set();
  for (const key of deduped.keys()){
    if (key) matched.add(key);
  }
  return {
    featureCollection: { type: "FeatureCollection", features: Array.from(deduped.values()) },
    requestedGeoids: normalizedGeoids,
    matchedGeoids: Array.from(matched),
    missingGeoids: normalizedGeoids.filter((id) => !matched.has(id)),
  };
}

function sumVars(rowValues, variableIds){
  let total = 0;
  let count = 0;
  for (const id of variableIds || []){
    const n = Number(rowValues?.[id]);
    if (!Number.isFinite(n)) continue;
    total += n;
    count += 1;
  }
  return { total, count };
}

export function aggregateRowsForSelection({ rowsByGeoid, selectedGeoids, metricSet } = {}){
  const rows = rowsByGeoid && typeof rowsByGeoid === "object" ? rowsByGeoid : {};
  const geos = Array.isArray(selectedGeoids) && selectedGeoids.length
    ? selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v)
    : [];
  const metricIds = getMetricIdsForSet(metricSet);
  const metrics = {};

  for (const metricId of metricIds){
    const spec = METRICS[metricId];
    if (!spec) continue;
    if (spec.kind === "sum"){
      let total = 0;
      for (const geoid of geos){
        const row = rows[geoid];
        if (!row) continue;
        const part = sumVars(row.values, spec.sumVars);
        total += part.total;
      }
      metrics[metricId] = {
        id: metricId,
        label: spec.label,
        format: spec.format,
        value: Number.isFinite(total) ? total : null,
      };
      continue;
    }

    if (spec.kind === "ratio"){
      let numerator = 0;
      let denominator = 0;
      for (const geoid of geos){
        const row = rows[geoid];
        if (!row) continue;
        numerator += sumVars(row.values, spec.numeratorVars).total;
        denominator += sumVars(row.values, spec.denominatorVars).total;
      }
      const value = denominator > 0 ? numerator / denominator : null;
      metrics[metricId] = {
        id: metricId,
        label: spec.label,
        format: spec.format,
        value,
        numerator,
        denominator,
      };
      continue;
    }

    if (spec.kind === "weighted_mean"){
      let weighted = 0;
      let weightSum = 0;
      for (const geoid of geos){
        const row = rows[geoid];
        if (!row) continue;
        const value = Number(row.values?.[spec.valueVar]);
        const weight = Number(row.values?.[spec.weightVar]);
        if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
        weighted += value * weight;
        weightSum += weight;
      }
      const value = weightSum > 0 ? weighted / weightSum : null;
      metrics[metricId] = {
        id: metricId,
        label: spec.label,
        format: spec.format,
        value,
        weight: weightSum,
      };
    }
  }

  return {
    selectedGeoCount: geos.length,
    selectedGeoids: geos,
    metrics,
  };
}

export function filterGeoOptions(options, { search = "", tractFilter = "" } = {}){
  const rows = Array.isArray(options) ? options : [];
  const term = cleanText(search).toLowerCase();
  const tract = fips(tractFilter, 6);
  return rows.filter((row) => {
    if (tract && cleanText(row?.tract) !== tract) return false;
    if (!term) return true;
    const label = cleanText(row?.label).toLowerCase();
    const geoid = cleanText(row?.geoid).toLowerCase();
    const name = cleanText(row?.name).toLowerCase();
    return label.includes(term) || geoid.includes(term) || name.includes(term);
  });
}

function formatInt(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("en-US");
}

function formatPct1(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function formatCurrency0(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatMetricValue(value, format){
  if (format === "pct1") return formatPct1(value);
  if (format === "currency0") return formatCurrency0(value);
  return formatInt(value);
}

export function buildAggregateTableRows(aggregate, metricSet){
  const metricIds = getMetricIdsForSet(metricSet);
  const metrics = aggregate?.metrics && typeof aggregate.metrics === "object" ? aggregate.metrics : {};
  return metricIds
    .map((id) => metrics[id])
    .filter((row) => !!row)
    .map((row) => ({
      id: row.id,
      label: row.label,
      value: row.value,
      valueText: formatMetricValue(row.value, row.format),
      format: row.format,
    }));
}

export function validateMetricSetWithCatalog(metricSet, variableNames){
  const vars = new Set(Array.isArray(variableNames) ? variableNames.map((v) => cleanText(v)) : []);
  const required = getVariablesForMetricSet(metricSet);
  const missing = required.filter((v) => !vars.has(v));
  return {
    ok: missing.length === 0,
    missing,
    required,
  };
}
