import { buildAreaResolverCacheKey } from "../core/areaResolver.js";
import { buildGeoEvidenceMapLayer } from "../core/districtEvidence.js";
import { formatPercentFromUnit, formatWholeNumberByMode } from "../core/utils.js";
import { renderIntelGeoMap, resetIntelGeoBoundaryCache } from "./intelGeoMap.js";

const STATE_LABEL_BY_FIPS = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
  "72": "PR",
};

const DEFAULT_ACS_VARIABLES = [
  "B01003_001E",
  "B19013_001E",
  "B25003_001E", "B25003_003E",
  "B25024_001E", "B25024_006E", "B25024_007E", "B25024_008E", "B25024_009E",
  "B15003_001E", "B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E",
  "C16002_001E", "C16002_004E",
];

const ACS_VARIABLE_LIMIT = 60;
const ACS_CATALOG_DISPLAY_LIMIT = 500;
const DEFAULT_CENSUS_API_KEY = "a59d216d186bced9d252633906350432d2805c74";

function str(v){
  return String(v == null ? "" : v).trim();
}

function digits(v){
  return str(v).replace(/\D+/g, "");
}

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtInt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return formatWholeNumberByMode(n, { mode: "round", fallback: "—" });
}

function fmtPctFromRatio(v, digitsCount = 1){
  return formatPercentFromUnit(v, Math.max(0, digitsCount | 0));
}

function fmtCurrency(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${formatWholeNumberByMode(n, { mode: "round", fallback: "0" })}`;
}

function normalizeAreaTypeInput(v){
  const t = str(v).toUpperCase();
  if (t === "CD" || t === "SLDU" || t === "SLDL" || t === "COUNTY" || t === "PLACE" || t === "CUSTOM") return t;
  return "";
}

function normalizeAreaResolutionInput(v){
  return str(v).toLowerCase() === "block_group" ? "block_group" : "tract";
}

function normalizeStateFips(v){
  const d = digits(v).slice(0, 2);
  return d ? d.padStart(2, "0") : "";
}

function normalizeCounty3(stateFips, countyFips){
  const state = normalizeStateFips(stateFips);
  const raw = digits(countyFips);
  if (!raw) return "";
  if (raw.length >= 5){
    if (state && raw.slice(0, 2) === state) return raw.slice(2, 5);
    return raw.slice(-3);
  }
  if (raw.length >= 3) return raw.slice(0, 3);
  return "";
}

function normalizeCounty5(stateFips, countyFips){
  const state = normalizeStateFips(stateFips);
  const county3 = normalizeCounty3(state, countyFips);
  if (!state || !county3) return "";
  return `${state}${county3}`;
}

function normalizePlace5(v){
  const d = digits(v);
  if (!d) return "";
  if (d.length >= 7) return d.slice(-5);
  return d.slice(0, 5).padStart(5, "0");
}

function normalizeDistrictCodeForAreaType(areaType, districtRaw){
  const type = normalizeAreaTypeInput(areaType);
  const d = digits(districtRaw).slice(0, 16);
  const raw = str(districtRaw).toUpperCase();
  if (type === "CD"){
    if (d) return d.slice(-2).padStart(2, "0");
    return raw;
  }
  if (type === "SLDU" || type === "SLDL"){
    if (d) return d.slice(-3).padStart(3, "0");
    return raw;
  }
  return d || raw;
}

function normalizeAreaGeoId(geoidRaw, resolution){
  const d = digits(geoidRaw);
  const mode = normalizeAreaResolutionInput(resolution);
  if (mode === "block_group"){
    if (d.length >= 12) return d.slice(0, 12);
    return "";
  }
  if (d.length >= 11) return d.slice(0, 11);
  return "";
}

function areaIdentity(area){
  if (area.type === "COUNTY") return area.countyFips || "-";
  if (area.type === "PLACE") return area.placeFips || "-";
  if (area.type === "CD" || area.type === "SLDU" || area.type === "SLDL") return `${area.stateFips || "--"}:${area.district || "---"}`;
  if (area.type === "CUSTOM"){
    const bits = [area.stateFips, area.countyFips, area.placeFips, area.district].filter(Boolean);
    return bits.length ? bits.join(":") : "-";
  }
  return "-";
}

function areaToMapArea(area){
  return {
    type: area.type,
    stateFips: area.stateFips,
    countyFips: area.countyFips,
    placeFips: area.placeFips,
    district: area.district,
  };
}

function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeAcsVariableCode(v){
  const code = str(v).toUpperCase();
  if (!code) return "";
  if (!/^[A-Z0-9_]+[EM]$/.test(code)) return "";
  return code;
}

function normalizeAcsVariableList(list, fallback = []){
  const source = Array.isArray(list) ? list : fallback;
  const out = [];
  const seen = new Set();
  for (const raw of source){
    const code = normalizeAcsVariableCode(raw);
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
    if (out.length >= ACS_VARIABLE_LIMIT) break;
  }
  return out;
}

function normalizeAcsCatalog(payload){
  const vars = isObject(payload?.variables) ? payload.variables : {};
  const out = [];
  for (const key of Object.keys(vars)){
    const code = normalizeAcsVariableCode(key);
    if (!code || !code.endsWith("E")) continue;
    const row = isObject(vars[key]) ? vars[key] : {};
    const label = str(row.label).replace(/!!/g, " > ");
    const concept = str(row.concept);
    out.push({
      code,
      label: label || code,
      concept,
    });
  }
  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

function withApiKey(url, apiKey){
  const key = str(apiKey);
  if (!key) return url;
  const u = new URL(url);
  u.searchParams.set("key", key);
  return u.toString();
}

function ensureScenarioShape(state){
  if (!isObject(state.geoPack)) state.geoPack = {};
  const geo = state.geoPack;
  if (!isObject(geo.area)) geo.area = {};
  if (!isObject(geo.district)) geo.district = {};
  const area = geo.area;
  const district = geo.district;
  area.type = normalizeAreaTypeInput(area.type);
  area.stateFips = normalizeStateFips(area.stateFips);
  area.district = normalizeDistrictCodeForAreaType(area.type, area.district);
  area.countyFips = normalizeCounty5(area.stateFips, area.countyFips);
  area.placeFips = normalizePlace5(area.placeFips);
  area.label = str(area.label);
  geo.resolution = normalizeAreaResolutionInput(geo.resolution);
  if (!Array.isArray(district.censusRowsV2)) district.censusRowsV2 = [];
  if (!isObject(district.censusRowsV2Meta)) district.censusRowsV2Meta = null;
  if (!isObject(district.areaAssistLookup)) district.areaAssistLookup = {};
  if (!isObject(district.messages)) district.messages = {};
  if (!isObject(district.busy)) district.busy = {};
  district.busy.lookup = !!district.busy.lookup;
  district.busy.fetch = !!district.busy.fetch;
  district.busy.variables = !!district.busy.variables;
  district.selectedGeoId = str(district.selectedGeoId);
  district.acsYearPreference = str(district.acsYearPreference || "auto_latest") || "auto_latest";
  district.censusApiKey = str(district.censusApiKey || DEFAULT_CENSUS_API_KEY);
  district.acsVariableSearch = str(district.acsVariableSearch);
  if (!Array.isArray(district.acsVariableCatalog)) district.acsVariableCatalog = [];
  district.acsVariableCatalog = district.acsVariableCatalog
    .map((row) => ({
      code: normalizeAcsVariableCode(row?.code),
      label: str(row?.label),
      concept: str(row?.concept),
    }))
    .filter((row) => !!row.code);
  district.selectedAcsVariables = normalizeAcsVariableList(district.selectedAcsVariables, DEFAULT_ACS_VARIABLES);
  if (!isObject(state.dataRefs)) state.dataRefs = {};
  if (!isObject(state.dataCatalog)) state.dataCatalog = { boundarySets: [], crosswalks: [], censusDatasets: [], electionDatasets: [] };
  if (!Array.isArray(state.dataCatalog.censusDatasets)) state.dataCatalog.censusDatasets = [];
  if (!Array.isArray(state.dataCatalog.boundarySets)) state.dataCatalog.boundarySets = [];
  if (!Array.isArray(state.dataCatalog.crosswalks)) state.dataCatalog.crosswalks = [];
  if (!Array.isArray(state.dataCatalog.electionDatasets)) state.dataCatalog.electionDatasets = [];
  return { geo, area, district };
}

function setBusy(state, key, value){
  const { district } = ensureScenarioShape(state);
  district.busy[key] = !!value;
}

function isBusy(state, key){
  const { district } = ensureScenarioShape(state);
  return !!district.busy?.[key];
}

function clearCensusRowsForAreaChange(state){
  const { district } = ensureScenarioShape(state);
  const area = currentArea(state);
  district.censusRowsV2 = [];
  district.censusRowsV2Meta = null;
  district.selectedGeoId = "";
  if (isObject(district.areaAssistLookup)){
    const lookupState = normalizeStateFips(district.areaAssistLookup.stateFips);
    if (lookupState !== area.stateFips){
      district.areaAssistLookup = {};
    } else {
      district.areaAssistLookup = {
        ...district.areaAssistLookup,
        geoResolution: area.resolution,
        geoAreaType: area.type,
        geoCounty3: normalizeCounty3(area.stateFips, area.countyFips),
        geoPlaceFips: area.placeFips,
        geoDistrictCode: area.district,
        geos: [],
        geoSource: "",
      };
    }
  }
  setMessage(state, "fetch", "Area updated. Fetch Census GEO rows for this area.", "muted");
  resetIntelGeoBoundaryCache();
}

function setMessage(state, key, text, kind = "muted"){
  const { district } = ensureScenarioShape(state);
  district.messages[key] = {
    text: str(text),
    kind: str(kind) || "muted",
    ts: new Date().toISOString(),
  };
}

function getMessage(state, key){
  const { district } = ensureScenarioShape(state);
  const row = district.messages?.[key];
  if (!row || !isObject(row)) return { text: "", kind: "muted" };
  return {
    text: str(row.text),
    kind: str(row.kind) || "muted",
  };
}

function setStatus(el, msg, kind = "muted"){
  if (!el) return;
  el.classList.remove("ok", "warn", "bad", "muted");
  el.classList.add(kind);
  el.textContent = str(msg || "Ready.");
}

function setSelectValue(selectEl, value){
  if (!selectEl) return;
  const next = str(value);
  selectEl.value = next;
  if (selectEl.value !== next) selectEl.value = "";
}

function fillSelect(selectEl, options, selectedValue, placeholder){
  if (!selectEl) return;
  const selected = str(selectedValue);
  const list = Array.isArray(options) ? options : [];
  selectEl.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = str(placeholder || "Select");
  selectEl.appendChild(first);
  for (const row of list){
    const value = str(row?.value);
    if (!value) continue;
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = str(row?.label || value);
    selectEl.appendChild(opt);
  }
  setSelectValue(selectEl, selected);
}

function parseCensusJsonTable(payload){
  if (!Array.isArray(payload) || payload.length < 2) return [];
  const head = Array.isArray(payload[0]) ? payload[0].map((x) => str(x)) : [];
  if (!head.length) return [];
  const rows = [];
  for (let i = 1; i < payload.length; i += 1){
    const raw = Array.isArray(payload[i]) ? payload[i] : [];
    const row = {};
    for (let h = 0; h < head.length; h += 1){
      row[head[h]] = raw[h];
    }
    rows.push(row);
  }
  return rows;
}

function buildDistrictInClauses({ stateFips, areaType, districtCode, resolution }){
  const type = normalizeAreaTypeInput(areaType);
  const district = str(districtCode);
  const mode = normalizeAreaResolutionInput(resolution);
  if (!district) return [];
  const keys = type === "CD"
    ? ["congressional district"]
    : type === "SLDU"
      ? ["state legislative district (upper chamber)", "state legislative district (upper)", "state senate district"]
      : type === "SLDL"
        ? ["state legislative district (lower chamber)", "state legislative district (lower)", "state house district"]
        : [];
  if (!keys.length) return [];
  return keys.map((key) => ({
    label: `${type} ${district}`,
    inClause: mode === "block_group"
      ? `state:${stateFips} ${key}:${district} tract:*`
      : `state:${stateFips} ${key}:${district}`,
  }));
}

function buildLookupGeoRequests(area){
  const stateFips = normalizeStateFips(area.stateFips);
  const resolution = normalizeAreaResolutionInput(area.resolution);
  const type = normalizeAreaTypeInput(area.type);
  const county3 = normalizeCounty3(stateFips, area.countyFips);
  const placeFips = normalizePlace5(area.placeFips);
  const districtCode = normalizeDistrictCodeForAreaType(type, area.district);
  if (!stateFips) return [];
  const requests = [];
  const push = (url, label) => {
    if (!url) return;
    if (requests.some((x) => x.url === url)) return;
    requests.push({ url, label });
  };
  const forClause = resolution === "block_group" ? "block group:*" : "tract:*";
  if ((type === "CD" || type === "SLDU" || type === "SLDL") && districtCode){
    const clauses = buildDistrictInClauses({ stateFips, areaType: type, districtCode, resolution });
    for (const row of clauses){
      const params = new URLSearchParams({
        get: "NAME",
        for: forClause,
        in: row.inClause,
      });
      push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, row.label);
    }
    return requests;
  }
  if (type === "PLACE" && placeFips){
    const inClause = resolution === "block_group"
      ? `state:${stateFips} place:${placeFips} tract:*`
      : `state:${stateFips} place:${placeFips}`;
    const params = new URLSearchParams({
      get: "NAME",
      for: forClause,
      in: inClause,
    });
    push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `place ${placeFips}`);
  }
  if (county3){
    const inClause = resolution === "block_group"
      ? `state:${stateFips} county:${county3} tract:*`
      : `state:${stateFips} county:${county3}`;
    const params = new URLSearchParams({
      get: "NAME",
      for: forClause,
      in: inClause,
    });
    push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `county ${county3}`);
  }
  return requests;
}

function buildCensusGeoRequests(area){
  const stateFips = normalizeStateFips(area.stateFips);
  const resolution = normalizeAreaResolutionInput(area.resolution);
  const type = normalizeAreaTypeInput(area.type);
  const county3 = normalizeCounty3(stateFips, area.countyFips);
  const placeFips = normalizePlace5(area.placeFips);
  const districtCode = normalizeDistrictCodeForAreaType(type, area.district);
  if (!stateFips) return [];
  const requests = [];
  const push = (url, label) => {
    if (!url) return;
    if (requests.some((x) => x.url === url)) return;
    requests.push({ url, label });
  };
  const getFields = "NAME,P1_001N,H1_001N,INTPTLAT,INTPTLON";
  const forClause = resolution === "block_group" ? "block group:*" : "tract:*";
  if ((type === "CD" || type === "SLDU" || type === "SLDL") && districtCode){
    const clauses = buildDistrictInClauses({ stateFips, areaType: type, districtCode, resolution });
    for (const row of clauses){
      const params = new URLSearchParams({
        get: getFields,
        for: forClause,
        in: row.inClause,
      });
      push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, row.label);
    }
    return requests;
  }
  if (type === "PLACE" && placeFips){
    const inClause = resolution === "block_group"
      ? `state:${stateFips} place:${placeFips} tract:*`
      : `state:${stateFips} place:${placeFips}`;
    const params = new URLSearchParams({
      get: getFields,
      for: forClause,
      in: inClause,
    });
    push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `place ${placeFips}`);
  }
  if (county3){
    const inClause = resolution === "block_group"
      ? `state:${stateFips} county:${county3} tract:*`
      : `state:${stateFips} county:${county3}`;
    const params = new URLSearchParams({
      get: getFields,
      for: forClause,
      in: inClause,
    });
    push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `county ${county3}`);
  }
  return requests;
}

function parseLookupRows(rawRows, resolution){
  const out = [];
  for (const row of rawRows){
    const state = normalizeStateFips(row.state);
    const county = digits(row.county).slice(0, 3);
    const tract = digits(row.tract).slice(0, 6);
    const bg = digits(row["block group"] || row.block_group).slice(0, 1);
    let geoid = "";
    if (normalizeAreaResolutionInput(resolution) === "block_group"){
      if (state && county && tract && bg) geoid = `${state}${county}${tract}${bg}`;
    } else if (state && county && tract){
      geoid = `${state}${county}${tract}`;
    }
    if (!geoid) continue;
    out.push({ value: geoid, label: `${geoid} · ${str(row.NAME || row.name || "")}` });
  }
  out.sort((a, b) => a.value.localeCompare(b.value));
  return out;
}

function parseCountyRows(rawRows){
  const out = [];
  for (const row of rawRows){
    const state = normalizeStateFips(row.state);
    const county = digits(row.county).slice(0, 3);
    if (!state || !county) continue;
    const value = `${state}${county}`;
    out.push({ value, label: `${value} · ${str(row.NAME || row.name || "")}` });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

function parsePlaceRows(rawRows){
  const out = [];
  for (const row of rawRows){
    const state = normalizeStateFips(row.state);
    const place = digits(row.place).slice(0, 5);
    if (!state || !place) continue;
    const value = `${state}${place}`;
    out.push({ value, label: `${value} · ${str(row.NAME || row.name || "")}` });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

function parseDecGeoRows(rawRows, resolution){
  const mode = normalizeAreaResolutionInput(resolution);
  const out = [];
  for (const row of rawRows){
    const state = normalizeStateFips(row.state);
    const county = digits(row.county).slice(0, 3);
    const tract = digits(row.tract).slice(0, 6);
    const bg = digits(row["block group"] || row.block_group).slice(0, 1);
    let geoid = "";
    if (mode === "block_group"){
      if (state && county && tract && bg) geoid = `${state}${county}${tract}${bg}`;
    } else if (state && county && tract){
      geoid = `${state}${county}${tract}`;
    }
    if (!geoid) continue;
    out.push({
      geoid,
      name: str(row.NAME || row.name || ""),
      values: {
        pop: num(row.P1_001N),
        housing_units: num(row.H1_001N),
        INTPTLAT: num(row.INTPTLAT),
        INTPTLON: num(row.INTPTLON),
      },
    });
  }
  return out;
}

function computeCensusTotals(rows){
  const list = Array.isArray(rows) ? rows : [];
  const totals = {};
  for (const row of list){
    const values = isObject(row?.values) ? row.values : {};
    for (const key of Object.keys(values)){
      const n = num(values[key]);
      if (n == null) continue;
      totals[key] = (num(totals[key]) || 0) + n;
    }
  }
  return totals;
}

function pickMetric(totals, keys){
  for (const key of keys){
    const n = num(totals?.[key]);
    if (n != null) return n;
  }
  return null;
}

function share(numVal, denVal){
  const n = num(numVal);
  const d = num(denVal);
  if (n == null || d == null || d <= 0) return null;
  return n / d;
}

function weightedMedianIncome(rows){
  const list = Array.isArray(rows) ? rows : [];
  let weighted = 0;
  let households = 0;
  let simple = 0;
  let simpleN = 0;
  for (const row of list){
    const values = isObject(row?.values) ? row.values : {};
    const income = num(values.B19013_001E);
    if (income == null || income <= 0) continue;
    const hh = num(values.B25003_001E);
    if (hh != null && hh > 0){
      weighted += income * hh;
      households += hh;
    }
    simple += income;
    simpleN += 1;
  }
  if (households > 0) return weighted / households;
  if (simpleN > 0) return simple / simpleN;
  return null;
}

function normalizeRowsToArea(rows, area, lookup){
  const mode = normalizeAreaResolutionInput(area.resolution);
  const state = normalizeStateFips(area.stateFips);
  if (!state) return [];
  const allowSet = buildGeoAllowSet(area, lookup);
  const county3 = normalizeCounty3(state, area.countyFips);
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []){
    const geoid = normalizeAreaGeoId(row?.geoid, mode);
    if (!geoid) continue;
    if (geoid.slice(0, 2) !== state) continue;
    if (allowSet && !allowSet.has(geoid)) continue;
    if (!allowSet && area.type === "COUNTY" && county3 && geoid.slice(2, 5) !== county3) continue;
    out.push({
      geoid,
      name: str(row?.name),
      values: isObject(row?.values) ? row.values : {},
    });
  }
  out.sort((a, b) => a.geoid.localeCompare(b.geoid));
  return out;
}

function buildGeoAllowSet(area, lookup){
  const state = normalizeStateFips(area.stateFips);
  if (!state || !isObject(lookup)) return null;
  const lookupState = normalizeStateFips(lookup.stateFips);
  const areaType = normalizeAreaTypeInput(area.type);
  const lookupType = normalizeAreaTypeInput(lookup.geoAreaType);
  const lookupResolution = normalizeAreaResolutionInput(lookup.geoResolution);
  if (lookupState !== state) return null;
  if (lookupResolution !== normalizeAreaResolutionInput(area.resolution)) return null;
  if (areaType && lookupType && areaType !== lookupType) return null;
  const areaCounty3 = normalizeCounty3(state, area.countyFips);
  const lookupCounty3 = normalizeCounty3(state, lookup.geoCounty3);
  if (areaType === "COUNTY" && areaCounty3 && lookupCounty3 && areaCounty3 !== lookupCounty3) return null;
  const areaPlace5 = normalizePlace5(area.placeFips);
  const lookupPlace5 = normalizePlace5(lookup.geoPlaceFips);
  if (areaType === "PLACE" && areaPlace5 && lookupPlace5 && areaPlace5 !== lookupPlace5) return null;
  const areaDistrict = normalizeDistrictCodeForAreaType(areaType, area.district);
  const lookupDistrict = normalizeDistrictCodeForAreaType(areaType, lookup.geoDistrictCode);
  if ((areaType === "CD" || areaType === "SLDU" || areaType === "SLDL") && areaDistrict && lookupDistrict && areaDistrict !== lookupDistrict){
    return null;
  }
  const geos = Array.isArray(lookup.geos) ? lookup.geos : [];
  if (!geos.length) return null;
  const set = new Set();
  for (const row of geos){
    const id = normalizeAreaGeoId(row?.value || row?.geoid, area.resolution);
    if (!id) continue;
    if (id.slice(0, 2) !== state) continue;
    set.add(id);
  }
  return set.size ? set : null;
}

function isAreaReady(area){
  const type = normalizeAreaTypeInput(area.type);
  const state = normalizeStateFips(area.stateFips);
  if (!state || !type) return false;
  if (type === "COUNTY") return !!normalizeCounty5(state, area.countyFips);
  if (type === "PLACE") return !!normalizePlace5(area.placeFips);
  if (type === "CD" || type === "SLDU" || type === "SLDL") return !!normalizeDistrictCodeForAreaType(type, area.district);
  if (type === "CUSTOM") return !!(normalizeCounty5(state, area.countyFips) || normalizePlace5(area.placeFips) || normalizeDistrictCodeForAreaType(type, area.district));
  return false;
}

function acsYearOptions(){
  const now = new Date();
  const max = now.getUTCFullYear() - 1;
  const out = [{ value: "auto_latest", label: "Auto latest" }];
  for (let y = max; y >= 2009; y -= 1){
    out.push({ value: String(y), label: String(y) });
  }
  return out;
}

async function fetchJson(url, apiKey = ""){
  if (typeof fetch !== "function") throw new Error("Browser fetch API is unavailable.");
  const finalUrl = withApiKey(url, apiKey);
  const res = await fetch(finalUrl, { method: "GET", headers: { Accept: "application/json" } });
  if (!res?.ok) throw new Error(`Request failed (HTTP ${res?.status || "?"}).`);
  return res.json();
}

async function resolveAcsYear(preference, apiKey = ""){
  const pref = str(preference);
  if (/^\d{4}$/.test(pref)) return pref;
  const now = new Date();
  const max = now.getUTCFullYear() - 1;
  const min = Math.max(2009, max - 15);
  for (let year = max; year >= min; year -= 1){
    const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME&for=us:1`;
    try{
      await fetchJson(url, apiKey);
      return String(year);
    } catch {}
  }
  throw new Error("Unable to resolve an available ACS year.");
}

async function fetchLookupPayload(area, apiKey = ""){
  const stateFips = normalizeStateFips(area.stateFips);
  const resolution = normalizeAreaResolutionInput(area.resolution);
  const countyUrl = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateFips}`;
  const placeUrl = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=place:*&in=state:${stateFips}`;
  const [countyPayload, placePayload] = await Promise.all([fetchJson(countyUrl, apiKey), fetchJson(placeUrl, apiKey)]);
  const countyRows = parseCensusJsonTable(countyPayload);
  const placeRows = parseCensusJsonTable(placePayload);
  const geoRequests = buildLookupGeoRequests(area);
  const geoAttempts = [];
  let geoRows = [];
  let geoSource = "";
  for (const req of geoRequests){
    try{
      const payload = await fetchJson(req.url, apiKey);
      const parsed = parseCensusJsonTable(payload);
      geoAttempts.push({ label: req.label, ok: true, rowCount: parsed.length, error: "" });
      if (parsed.length){
        geoRows = parsed;
        geoSource = req.label;
        break;
      }
    } catch (err){
      geoAttempts.push({ label: req.label, ok: false, rowCount: 0, error: str(err?.message || err) });
    }
  }
  return {
    counties: parseCountyRows(countyRows),
    places: parsePlaceRows(placeRows),
    geos: parseLookupRows(geoRows, resolution),
    geoSource,
    geoAttempts,
  };
}

async function fetchDecRows(area, apiKey = ""){
  const requests = buildCensusGeoRequests(area);
  const byGeoid = new Map();
  const attempts = [];
  let source = "";
  for (const req of requests){
    try{
      const payload = await fetchJson(req.url, apiKey);
      const parsed = parseDecGeoRows(parseCensusJsonTable(payload), area.resolution);
      attempts.push({ label: req.label, ok: true, rowCount: parsed.length, error: "" });
      if (!parsed.length) continue;
      for (const row of parsed){
        byGeoid.set(row.geoid, row);
      }
      if (!source) source = req.label;
    } catch (err){
      attempts.push({ label: req.label, ok: false, rowCount: 0, error: str(err?.message || err) });
    }
  }
  return {
    rows: Array.from(byGeoid.values()).sort((a, b) => a.geoid.localeCompare(b.geoid)),
    source,
    attempts,
  };
}

async function fetchAcsRowsByCounty(stateFips, resolution, counties, acsYear, variableCodes, apiKey = ""){
  const mode = normalizeAreaResolutionInput(resolution);
  const countyList = Array.from(new Set((Array.isArray(counties) ? counties : []).map((x) => digits(x).slice(0, 3)).filter(Boolean)));
  const selectedVars = normalizeAcsVariableList(variableCodes, []);
  if (!selectedVars.length){
    return {
      byGeoid: new Map(),
      attempts: [],
      counties: countyList,
    };
  }
  const byGeoid = new Map();
  const attempts = [];
  const getVars = ["NAME", ...selectedVars].join(",");
  for (const county3 of countyList){
    const params = new URLSearchParams({
      get: getVars,
      for: mode === "block_group" ? "block group:*" : "tract:*",
      in: mode === "block_group"
        ? `state:${stateFips} county:${county3} tract:*`
        : `state:${stateFips} county:${county3}`,
    });
    const url = `https://api.census.gov/data/${acsYear}/acs/acs5?${params.toString()}`;
    let payload = null;
    try{
      payload = await fetchJson(url, apiKey);
    } catch (err){
      attempts.push({ county: county3, ok: false, rowCount: 0, error: str(err?.message || err) });
      continue;
    }
    const rows = parseCensusJsonTable(payload);
    attempts.push({ county: county3, ok: true, rowCount: rows.length, error: "" });
    for (const row of rows){
      const state = normalizeStateFips(row.state);
      const county = digits(row.county).slice(0, 3);
      const tract = digits(row.tract).slice(0, 6);
      const bg = digits(row["block group"] || row.block_group).slice(0, 1);
      let geoid = "";
      if (mode === "block_group"){
        if (state && county && tract && bg) geoid = `${state}${county}${tract}${bg}`;
      } else if (state && county && tract){
        geoid = `${state}${county}${tract}`;
      }
      if (!geoid) continue;
      const values = {};
      for (const key of selectedVars){
        const n = num(row[key]);
        if (n == null) continue;
        values[key] = n;
      }
      byGeoid.set(geoid, values);
    }
  }
  return {
    byGeoid,
    attempts,
    counties: countyList,
  };
}

function ensureCatalogDataset(state, area, acsYear){
  const fingerprint = buildAreaResolverCacheKey({ area });
  const datasetId = `census_api_acs5_${acsYear}_${fingerprint}`;
  const catalog = state.dataCatalog;
  const list = Array.isArray(catalog.censusDatasets) ? catalog.censusDatasets : [];
  const existing = list.find((x) => str(x?.id) === datasetId);
  const entry = {
    id: datasetId,
    kind: "census",
    label: `Census API ACS5 ${acsYear} (${area.type || "area"} ${areaIdentity(area)})`,
    source: "census_api",
    vintage: String(acsYear),
    boundarySetId: str(state?.dataRefs?.boundarySetId) || null,
    granularity: area.resolution,
    refreshedAt: new Date().toISOString(),
    quality: { coveragePct: null, isVerified: true },
    isLatest: true,
  };
  for (const row of list){
    if (!isObject(row)) continue;
    row.isLatest = false;
  }
  if (existing){
    Object.assign(existing, entry);
  } else {
    list.push(entry);
  }
  list.sort((a, b) => str(a?.id).localeCompare(str(b?.id)));
  catalog.censusDatasets = list;
  state.dataRefs.censusDatasetId = datasetId;
  state.dataRefs.electionDatasetId = null;
  state.dataRefs.crosswalkVersionId = null;
  state.dataRefs.lastCheckedAt = new Date().toISOString();
  return datasetId;
}

function fillDemographicsTable(tbody, rows, totals, acsYear){
  if (!tbody) return;
  tbody.innerHTML = "";
  const population = pickMetric(totals, ["pop", "population", "total_population", "B01003_001E", "B01003_001"]);
  const housing = pickMetric(totals, ["housing_units", "housing", "total_housing_units", "B25001_001E", "B25001_001"]);
  const renter = share(totals.B25003_003E, totals.B25003_001E);
  const baPlusNum = (num(totals.B15003_022E) || 0) + (num(totals.B15003_023E) || 0) + (num(totals.B15003_024E) || 0) + (num(totals.B15003_025E) || 0);
  const baPlus = share(baPlusNum, totals.B15003_001E);
  const lepNum = (num(totals.C16002_004E) || 0) + (num(totals.C16002_007E) || 0) + (num(totals.C16002_010E) || 0) + (num(totals.C16002_013E) || 0);
  const lep = share(lepNum, totals.C16002_001E);
  const multiNum = (num(totals.B25024_006E) || 0) + (num(totals.B25024_007E) || 0) + (num(totals.B25024_008E) || 0) + (num(totals.B25024_009E) || 0);
  const multi = share(multiNum, totals.B25024_001E);
  const income = weightedMedianIncome(rows);

  const metrics = [
    ["GEO rows", fmtInt(rows.length)],
    ["Population", population == null ? "—" : fmtInt(population)],
    ["Housing units", housing == null ? "—" : fmtInt(housing)],
    [acsYear ? `Median HH income (ACS ${acsYear})` : "Median HH income", income == null ? "—" : fmtCurrency(income)],
    ["Renter share", renter == null ? "—" : fmtPctFromRatio(renter, 1)],
    ["BA+ share", baPlus == null ? "—" : fmtPctFromRatio(baPlus, 1)],
    ["Limited-English share", lep == null ? "—" : fmtPctFromRatio(lep, 1)],
    ["Multi-unit share", multi == null ? "—" : fmtPctFromRatio(multi, 1)],
  ];

  for (const row of metrics){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row[0]}</td><td class="num">${row[1]}</td>`;
    tbody.appendChild(tr);
  }
}

function fillGeoInspectorSelect(selectEl, rows, selectedGeoId){
  if (!selectEl) return;
  const selected = str(selectedGeoId);
  const options = [];
  for (const row of rows){
    const pop = num(row?.values?.pop) ?? num(row?.values?.B01003_001E);
    const housing = num(row?.values?.housing_units) ?? num(row?.values?.B25001_001E);
    const label = `${row.geoid} · pop ${pop == null ? "—" : fmtInt(pop)} · housing ${housing == null ? "—" : fmtInt(housing)}`;
    options.push({ value: row.geoid, label });
  }
  fillSelect(selectEl, options, selected, options.length ? "Select GEO" : "No GEO available");
}

function fillGeoInspectorTable(tbody, values){
  if (!tbody) return;
  tbody.innerHTML = "";
  const entries = Object.keys(values || {}).sort((a, b) => a.localeCompare(b));
  if (!entries.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="2">No census values loaded for selected GEO.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const key of entries){
    const tr = document.createElement("tr");
    const value = num(values[key]);
    tr.innerHTML = `<td>${key}</td><td class="num">${value == null ? "—" : fmtInt(value)}</td>`;
    tbody.appendChild(tr);
  }
}

function buildGeoSummary(row){
  if (!row) return "No GEO selected.";
  const values = isObject(row.values) ? row.values : {};
  const pop = num(values.pop) ?? num(values.B01003_001E);
  const housing = num(values.housing_units) ?? num(values.B25001_001E);
  const income = num(values.B19013_001E);
  const renter = share(values.B25003_003E, values.B25003_001E);
  const parts = [
    `GEOID: ${row.geoid}`,
    `Population: ${pop == null ? "—" : fmtInt(pop)}`,
    `Housing units: ${housing == null ? "—" : fmtInt(housing)}`,
    `Median HH income: ${income == null ? "—" : fmtCurrency(income)}`,
    `Renter share: ${renter == null ? "—" : fmtPctFromRatio(renter, 1)}`,
  ];
  return parts.join("\n");
}

function currentArea(state){
  const { geo, area } = ensureScenarioShape(state);
  return {
    type: normalizeAreaTypeInput(area.type),
    stateFips: normalizeStateFips(area.stateFips),
    district: normalizeDistrictCodeForAreaType(area.type, area.district),
    countyFips: normalizeCounty5(area.stateFips, area.countyFips),
    placeFips: normalizePlace5(area.placeFips),
    label: str(area.label),
    resolution: normalizeAreaResolutionInput(geo.resolution),
    boundarySetId: str(state?.dataRefs?.boundarySetId) || null,
    boundaryVintage: str(geo?.boundaryVintage || area?.boundaryVintage || area?.vintage) || null,
  };
}

function applyAreaToState(state, area){
  const { geo, area: target } = ensureScenarioShape(state);
  target.type = normalizeAreaTypeInput(area.type);
  target.stateFips = normalizeStateFips(area.stateFips);
  target.district = normalizeDistrictCodeForAreaType(target.type, area.district);
  target.countyFips = normalizeCounty5(target.stateFips, area.countyFips);
  target.placeFips = normalizePlace5(area.placeFips);
  target.label = str(area.label);
  geo.resolution = normalizeAreaResolutionInput(area.resolution);
}

function flowStatus(areaReady, rowCount){
  if (!areaReady) return "Flow: Step 1 select state + area type + area code.";
  if (!rowCount) return "Flow: Step 2 fetch Census GEO rows for the selected area.";
  return "Flow: Step 3 review map + demographics and pick GEO overlays.";
}

async function handleFetchLookup(state){
  const area = currentArea(state);
  const { district } = ensureScenarioShape(state);
  const apiKey = str(district.censusApiKey);
  if (!normalizeStateFips(area.stateFips)){
    setMessage(state, "lookup", "Set state first, then fetch county/place/GEO lists.", "warn");
    return;
  }
  setMessage(state, "lookup", "Fetching county/place/GEO lookup lists...", "muted");
  let payload = null;
  try{
    payload = await fetchLookupPayload(area, apiKey);
  } catch (err){
    setMessage(state, "lookup", `Lookup fetch failed: ${str(err?.message || err)}`, "warn");
    return;
  }
  district.areaAssistLookup = {
    stateFips: area.stateFips,
    geoResolution: area.resolution,
    geoAreaType: area.type,
    geoCounty3: normalizeCounty3(area.stateFips, area.countyFips),
    geoPlaceFips: area.placeFips,
    geoDistrictCode: area.district,
    counties: payload.counties,
    places: payload.places,
    geos: payload.geos,
    geoSource: payload.geoSource,
    fetchedAt: new Date().toISOString(),
  };
  district.autoLookupKey = `${area.stateFips}|${area.type}|${area.countyFips}|${area.placeFips}|${area.district}|${area.resolution}`;
  const attempts = Array.isArray(payload.geoAttempts) ? payload.geoAttempts : [];
  const failed = attempts.filter((row) => !row.ok);
  const zeroRows = attempts.filter((row) => row.ok && !(Number(row.rowCount) > 0));
  const geoLabel = payload.geos.length
    ? `${payload.geos.length} ${area.resolution === "block_group" ? "block groups" : "tracts"}`
    : `0 ${area.resolution === "block_group" ? "block groups" : "tracts"}`;
  if (!payload.geos.length && attempts.length){
    const firstFail = str(failed[0]?.error);
    const note = failed.length
      ? ` GEO query failed for ${failed.length}/${attempts.length} attempt(s).${firstFail ? ` First error: ${firstFail}` : ""}`
      : ` GEO query returned 0 rows for ${zeroRows.length}/${attempts.length} attempt(s).`;
    setMessage(
      state,
      "lookup",
      `Lookup loaded: ${payload.counties.length} counties, ${payload.places.length} places, ${geoLabel}.${note}`,
      "warn"
    );
    return;
  }
  setMessage(
    state,
    "lookup",
    `Lookup loaded: ${payload.counties.length} counties, ${payload.places.length} places, ${geoLabel}.`,
    "ok"
  );
}

async function handleFetchCensusRows(state){
  const area = currentArea(state);
  const { district } = ensureScenarioShape(state);
  const apiKey = str(district.censusApiKey);
  const selectedVars = normalizeAcsVariableList(district.selectedAcsVariables, DEFAULT_ACS_VARIABLES);
  if (!isAreaReady(area)){
    setMessage(state, "fetch", "Complete area selection first, then fetch Census GEO rows.", "warn");
    return;
  }
  setMessage(state, "fetch", "Fetching Census GEO rows from API...", "muted");
  const decOut = await fetchDecRows(area, apiKey).catch((err) => ({
    rows: [],
    source: "",
    attempts: [],
    error: err,
  }));
  const decAttempts = Array.isArray(decOut.attempts) ? decOut.attempts : [];
  const decFailed = decAttempts.filter((row) => !row.ok);
  if (!Array.isArray(decOut.rows) || !decOut.rows.length){
    const baseMsg = decOut?.error ? str(decOut.error?.message || decOut.error) : "No GEO rows returned for selected area.";
    if (!decAttempts.length){
      setMessage(state, "fetch", `Census fetch failed: ${baseMsg}`, "warn");
      return;
    }
    if (decFailed.length === decAttempts.length){
      const firstErr = str(decFailed[0]?.error);
      setMessage(
        state,
        "fetch",
        `Census fetch failed: all ${decAttempts.length} DEC request(s) failed.${firstErr ? ` First error: ${firstErr}` : ""}`,
        "warn"
      );
      return;
    }
    setMessage(state, "fetch", `Census fetch failed: ${baseMsg}`, "warn");
    return;
  }

  const acsPref = str(state?.geoPack?.district?.acsYearPreference || "auto_latest") || "auto_latest";
  let acsYear = "";
  if (selectedVars.length){
    try{
      acsYear = await resolveAcsYear(acsPref, apiKey);
    } catch (err){
      setMessage(state, "fetch", `Census fetch warning: ${str(err?.message || err)} Using DEC-only fields.`, "warn");
    }
  }

  const countySet = Array.from(new Set(decOut.rows.map((row) => digits(row.geoid).slice(2, 5)).filter(Boolean)));
  let acsByGeoid = new Map();
  let acsAttempts = [];
  if (acsYear && countySet.length && selectedVars.length){
    const acsOut = await fetchAcsRowsByCounty(
      area.stateFips,
      area.resolution,
      countySet,
      acsYear,
      selectedVars,
      apiKey
    ).catch((err) => ({
      byGeoid: new Map(),
      attempts: countySet.map((county) => ({ county, ok: false, rowCount: 0, error: str(err?.message || err) })),
      counties: countySet,
    }));
    acsByGeoid = acsOut.byGeoid instanceof Map ? acsOut.byGeoid : new Map();
    acsAttempts = Array.isArray(acsOut.attempts) ? acsOut.attempts : [];
  }

  const mergedRows = decOut.rows.map((row) => {
    const acsValues = acsByGeoid.get(row.geoid) || {};
    return {
      geoid: row.geoid,
      name: row.name,
      values: {
        ...row.values,
        ...acsValues,
      },
    };
  });

  const datasetId = ensureCatalogDataset(state, area, acsYear || "2020");
  const areaFingerprint = buildAreaResolverCacheKey({ area });
  district.censusRowsV2 = mergedRows;
  district.censusRowsV2Meta = {
    datasetId,
    source: "census_api",
    acsYear: acsYear || null,
    decSource: decOut.source,
    fetchedAt: new Date().toISOString(),
    areaFingerprint,
    validationStatus: "aligned",
    geoidRowCount: mergedRows.length,
    matchedGeoidRows: mergedRows.length,
    rowCount: mergedRows.length,
    acsVariableCount: selectedVars.length,
    decAttemptCount: decAttempts.length,
    decFailedCount: decFailed.length,
    acsAttemptCount: acsAttempts.length,
    acsFailedCount: acsAttempts.filter((row) => !row.ok).length,
    resolution: area.resolution,
    stateFips: area.stateFips,
  };
  district.selectedGeoId = mergedRows[0]?.geoid || "";
  const acsMatchedRows = acsByGeoid.size
    ? mergedRows.filter((row) => {
      const vals = acsByGeoid.get(row.geoid);
      return vals && Object.keys(vals).length > 0;
    }).length
    : 0;
  const acsFailed = acsAttempts.filter((row) => !row.ok);
  const acsWarn = !!(acsYear && selectedVars.length && (acsMatchedRows === 0 || acsFailed.length));
  const decWarn = decFailed.length > 0;
  const statusKind = decWarn || acsWarn ? "warn" : "ok";
  const decPart = decWarn
    ? ` DEC requests had ${decFailed.length}/${decAttempts.length} failure(s).`
    : "";
  const acsPart = acsYear
    ? ` ACS ${acsYear} matched ${acsMatchedRows}/${mergedRows.length} GEO rows (${selectedVars.length} vars).`
    : " ACS unavailable; DEC-only values loaded.";
  const acsErrPart = acsFailed.length
    ? ` ACS county requests had ${acsFailed.length}/${acsAttempts.length} failure(s).`
    : "";
  setMessage(
    state,
    "fetch",
    `Loaded ${mergedRows.length} ${area.resolution === "block_group" ? "block groups" : "tracts"} from ${decOut.source || "DEC API"}.${acsPart}${decPart}${acsErrPart}`,
    statusKind
  );
}

function syncAreaInputsFromState(els, area){
  if (els.intelAreaType) setSelectValue(els.intelAreaType, area.type);
  if (els.intelAreaResolution) setSelectValue(els.intelAreaResolution, area.resolution);
  if (els.intelAreaLabel && document.activeElement !== els.intelAreaLabel) els.intelAreaLabel.value = area.label;
  if (els.intelAreaDistrict && document.activeElement !== els.intelAreaDistrict) els.intelAreaDistrict.value = area.district;
  if (els.intelAreaStateFips) setSelectValue(els.intelAreaStateFips, area.stateFips);
  if (els.intelAreaCountyFips && document.activeElement !== els.intelAreaCountyFips) els.intelAreaCountyFips.value = area.countyFips;
  if (els.intelAreaPlaceFips && document.activeElement !== els.intelAreaPlaceFips) els.intelAreaPlaceFips.value = area.placeFips;
}

function fillStateSelect(selectEl, selectedState){
  const options = Object.keys(STATE_LABEL_BY_FIPS)
    .sort((a, b) => a.localeCompare(b))
    .map((fips) => ({ value: fips, label: `${fips} — ${STATE_LABEL_BY_FIPS[fips]}` }));
  fillSelect(selectEl, options, selectedState, "Select state");
}

function filterAcsCatalogRows(catalog, search){
  const rows = Array.isArray(catalog) ? catalog : [];
  const q = str(search).toLowerCase();
  let filtered = rows;
  if (q){
    filtered = rows.filter((row) => {
      const code = str(row?.code).toLowerCase();
      const label = str(row?.label).toLowerCase();
      const concept = str(row?.concept).toLowerCase();
      return code.includes(q) || label.includes(q) || concept.includes(q);
    });
  }
  return filtered.slice(0, ACS_CATALOG_DISPLAY_LIMIT);
}

function fillAcsCatalogSelect(selectEl, rows){
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const row of Array.isArray(rows) ? rows : []){
    const opt = document.createElement("option");
    opt.value = str(row?.code);
    const code = str(row?.code);
    const label = str(row?.label || code);
    const concept = str(row?.concept);
    opt.textContent = concept ? `${code} — ${label} (${concept})` : `${code} — ${label}`;
    selectEl.appendChild(opt);
  }
}

function fillAcsSelectedSelect(selectEl, selectedVars, catalog){
  if (!selectEl) return;
  const selected = normalizeAcsVariableList(selectedVars, []);
  const byCode = new Map((Array.isArray(catalog) ? catalog : []).map((row) => [str(row?.code), row]));
  selectEl.innerHTML = "";
  for (const code of selected){
    const row = byCode.get(code);
    const opt = document.createElement("option");
    opt.value = code;
    const label = str(row?.label || code);
    opt.textContent = `${code} — ${label}`;
    selectEl.appendChild(opt);
  }
}

function readSelectedOptionValues(selectEl){
  if (!selectEl) return [];
  const out = [];
  for (const opt of Array.from(selectEl.selectedOptions || [])){
    const value = str(opt?.value);
    if (value) out.push(value);
  }
  return out;
}

async function handleLoadAcsVariableCatalog(state){
  const { district } = ensureScenarioShape(state);
  const apiKey = str(district.censusApiKey);
  const prefYear = str(district.acsYearPreference || "auto_latest") || "auto_latest";
  let year = "";
  try{
    year = await resolveAcsYear(prefYear, apiKey);
  } catch (err){
    setMessage(state, "variables", `Could not resolve ACS year: ${str(err?.message || err)}`, "warn");
    return;
  }
  const url = `https://api.census.gov/data/${year}/acs/acs5/variables.json`;
  let payload = null;
  try{
    payload = await fetchJson(url, apiKey);
  } catch (err){
    setMessage(state, "variables", `Variable catalog load failed: ${str(err?.message || err)}`, "warn");
    return;
  }
  const catalog = normalizeAcsCatalog(payload);
  if (!catalog.length){
    setMessage(state, "variables", `No ACS variables parsed for ${year}.`, "warn");
    return;
  }
  district.acsVariableCatalog = catalog;
  district.selectedAcsVariables = normalizeAcsVariableList(district.selectedAcsVariables, DEFAULT_ACS_VARIABLES);
  setMessage(
    state,
    "variables",
    `Loaded ${catalog.length.toLocaleString()} ACS variables for ${year}.`,
    "ok"
  );
}

export function renderDistrictCensusSimple({ els, state } = {}){
  if (!els || !state) return;
  const { district } = ensureScenarioShape(state);
  const area = currentArea(state);
  applyAreaToState(state, area);

  const busyLookup = isBusy(state, "lookup");
  const busyFetch = isBusy(state, "fetch");
  const busyVariables = isBusy(state, "variables");

  fillStateSelect(els.intelAreaStateFips, area.stateFips);
  syncAreaInputsFromState(els, area);
  fillSelect(els.intelAcsYearPreference, acsYearOptions(), district.acsYearPreference, "Auto latest");
  if (els.intelCensusApiKey && document.activeElement !== els.intelCensusApiKey){
    els.intelCensusApiKey.value = district.censusApiKey || "";
  }

  const lookup = isObject(district.areaAssistLookup) ? district.areaAssistLookup : {};
  const catalog = Array.isArray(district.acsVariableCatalog) ? district.acsVariableCatalog : [];
  const filteredCatalog = filterAcsCatalogRows(catalog, district.acsVariableSearch);
  fillAcsCatalogSelect(els.intelAcsVarCatalog, filteredCatalog);
  fillAcsSelectedSelect(els.intelAcsVarSelected, district.selectedAcsVariables, catalog);
  if (els.intelAcsVarSearch && document.activeElement !== els.intelAcsVarSearch){
    els.intelAcsVarSearch.value = district.acsVariableSearch || "";
  }

  const counties = Array.isArray(lookup.counties) ? lookup.counties : [];
  const places = Array.isArray(lookup.places) ? lookup.places : [];
  const rowsAll = Array.isArray(district.censusRowsV2) ? district.censusRowsV2 : [];
  const rowsScoped = normalizeRowsToArea(rowsAll, area, lookup);
  const totals = computeCensusTotals(rowsScoped);
  const acsYear = str(district?.censusRowsV2Meta?.acsYear || "");

  fillSelect(els.intelAreaAssistCounty, counties, area.countyFips, counties.length ? "Select county" : "No county suggestions");
  const placeSelected = area.stateFips && area.placeFips ? `${area.stateFips}${area.placeFips}` : "";
  fillSelect(els.intelAreaAssistPlace, places, placeSelected, places.length ? "Select place" : "No place suggestions");

  const geoFromRows = rowsScoped.map((row) => ({
    value: row.geoid,
    label: `${row.geoid} · ${str(row.name || "")}`,
  }));
  const geoFromLookup = Array.isArray(lookup.geos) ? lookup.geos : [];
  const geoOptions = geoFromRows.length ? geoFromRows : geoFromLookup;

  let selectedGeoId = normalizeAreaGeoId(district.selectedGeoId, area.resolution);
  const geoSet = new Set(geoOptions.map((x) => normalizeAreaGeoId(x.value, area.resolution)).filter(Boolean));
  if (!selectedGeoId || !geoSet.has(selectedGeoId)) selectedGeoId = normalizeAreaGeoId(geoOptions[0]?.value, area.resolution);
  district.selectedGeoId = selectedGeoId || "";

  fillSelect(
    els.intelAreaAssistGeo,
    geoOptions.map((x) => ({ value: normalizeAreaGeoId(x.value, area.resolution), label: x.label })),
    selectedGeoId,
    geoOptions.length ? "Select GEO" : "No GEO suggestions"
  );

  if (els.intelAreaAssistGeo) els.intelAreaAssistGeo.disabled = busyLookup || busyFetch;

  fillGeoInspectorSelect(els.intelGeoInspectorSelect, rowsScoped, selectedGeoId);
  const selectedRow = rowsScoped.find((row) => row.geoid === selectedGeoId) || null;
  const selectedValues = isObject(selectedRow?.values) ? selectedRow.values : {};

  if (els.intelGeoInspectorRace) els.intelGeoInspectorRace.textContent = selectedGeoId || "—";
  if (els.intelGeoInspectorPopulation){
    const pop = num(selectedValues.pop) ?? num(selectedValues.B01003_001E);
    els.intelGeoInspectorPopulation.textContent = pop == null ? "—" : fmtInt(pop);
  }
  if (els.intelGeoInspectorHouseholds){
    const hh = num(selectedValues.B25003_001E) ?? num(selectedValues.housing_units) ?? num(selectedValues.B25001_001E);
    els.intelGeoInspectorHouseholds.textContent = hh == null ? "—" : fmtInt(hh);
  }
  if (els.intelGeoInspectorSummary) els.intelGeoInspectorSummary.value = buildGeoSummary(selectedRow);
  fillGeoInspectorTable(els.intelGeoInspectorCensusTbody, selectedValues);

  if (els.intelGeoInspectorStatus){
    if (!selectedRow){
      setStatus(els.intelGeoInspectorStatus, "No GEO selected.", "muted");
    } else {
      const pop = num(selectedValues.pop) ?? num(selectedValues.B01003_001E);
      const housing = num(selectedValues.housing_units) ?? num(selectedValues.B25001_001E);
      setStatus(
        els.intelGeoInspectorStatus,
        `Selected ${selectedRow.geoid} · pop ${pop == null ? "—" : fmtInt(pop)} · housing ${housing == null ? "—" : fmtInt(housing)}.`,
        "ok"
      );
    }
  }

  fillDemographicsTable(els.intelDistrictDemographicsTbody, rowsScoped, totals, acsYear);

  const population = pickMetric(totals, ["pop", "population", "total_population", "B01003_001E", "B01003_001"]);
  const housing = pickMetric(totals, ["housing_units", "housing", "total_housing_units", "B25001_001E", "B25001_001"]);

  if (els.intelDistrictEvidenceCoverage) els.intelDistrictEvidenceCoverage.textContent = `GEO rows loaded: ${fmtInt(rowsScoped.length)}`;
  if (els.intelDistrictEvidenceVotes) els.intelDistrictEvidenceVotes.textContent = `Population total: ${population == null ? "—" : fmtInt(population)}`;
  if (els.intelDistrictEvidenceSignal) els.intelDistrictEvidenceSignal.textContent = `Housing units total: ${housing == null ? "—" : fmtInt(housing)}`;

  if (els.intelAreaResolverSummary){
    els.intelAreaResolverSummary.textContent = area.type
      ? `Area resolver: ${area.type} ${areaIdentity(area)} · ${area.resolution === "block_group" ? "block group" : "tract"}`
      : "Area resolver: not configured.";
  }

  const variableMsg = getMessage(state, "variables");
  if (els.intelAcsVarStatus){
    const selectedCount = normalizeAcsVariableList(district.selectedAcsVariables, []).length;
    const keyState = str(district.censusApiKey) ? "API key set" : "API key optional";
    if (busyVariables){
      setStatus(els.intelAcsVarStatus, `Loading ACS variable catalog... Selected: ${selectedCount}. ${keyState}.`, "muted");
    } else if (variableMsg.text){
      setStatus(els.intelAcsVarStatus, `${variableMsg.text} Selected: ${selectedCount}. ${keyState}.`, variableMsg.kind);
    } else if (catalog.length){
      setStatus(els.intelAcsVarStatus, `Catalog loaded (${catalog.length.toLocaleString()} vars). Selected: ${selectedCount}. ${keyState}.`, "ok");
    } else {
      setStatus(els.intelAcsVarStatus, `Selected variables: ${selectedCount}. Load catalog to search and narrow fields. ${keyState}.`, "muted");
    }
  }

  const lookupMsg = getMessage(state, "lookup");
  if (els.intelAreaAssistLookupStatus){
    if (busyLookup){
      setStatus(els.intelAreaAssistLookupStatus, "Loading county/place/GEO lookup lists...", "muted");
    } else if (lookupMsg.text){
      setStatus(els.intelAreaAssistLookupStatus, lookupMsg.text, lookupMsg.kind);
    } else if (lookup?.fetchedAt){
      setStatus(els.intelAreaAssistLookupStatus, `Lookup loaded ${str(lookup.fetchedAt).slice(0, 19).replace("T", " ")}.`, "ok");
    } else {
      setStatus(els.intelAreaAssistLookupStatus, "No fetched county/place/GEO lookup loaded.", "muted");
    }
  }

  if (els.intelAreaAssistStatus){
    if (busyLookup){
      setStatus(els.intelAreaAssistStatus, "Loading county/place/GEO lookup lists...", "muted");
    } else if (!area.stateFips){
      setStatus(els.intelAreaAssistStatus, "Set state first, then fetch county/place/GEO lists.", "muted");
    } else if (!isAreaReady(area)){
      setStatus(els.intelAreaAssistStatus, "Choose area type and required area code, then fetch GEO lists and Census rows.", "warn");
    } else if (!geoOptions.length){
      setStatus(els.intelAreaAssistStatus, "No GEO suggestions yet. Fetch county/place/GEO lists or fetch Census GEO rows.", "warn");
    } else {
      setStatus(els.intelAreaAssistStatus, `${geoOptions.length} GEO options ready.`, "ok");
    }
  }

  const fetchMsg = getMessage(state, "fetch");
  if (els.intelDistrictEvidenceStatus){
    if (busyFetch){
      setStatus(els.intelDistrictEvidenceStatus, "Fetching Census GEO rows from API...", "muted");
    } else if (rowsScoped.length){
      setStatus(els.intelDistrictEvidenceStatus, `Census view ready: ${fmtInt(rowsScoped.length)} GEO rows.`, "ok");
    } else if (fetchMsg.text){
      setStatus(els.intelDistrictEvidenceStatus, fetchMsg.text, fetchMsg.kind);
    } else {
      setStatus(els.intelDistrictEvidenceStatus, "District evidence not compiled yet.", "muted");
    }
  }

  const geoRowsForMap = rowsScoped.map((row) => ({
    geoid: row.geoid,
    totalVotes: num(row?.values?.pop) || num(row?.values?.B01003_001E) || 0,
    candidateVotes: {},
    sourcePrecincts: 0,
    hasElection: false,
    hasCensus: true,
    census: row.values,
  }));
  const mapLayer = buildGeoEvidenceMapLayer({ geoRows: geoRowsForMap, maxPoints: 1500 });
  const onSelectGeo = (geoid) => {
    const id = normalizeAreaGeoId(geoid, area.resolution);
    if (!id) return;
    if (els.intelAreaAssistGeo){
      if (els.intelAreaAssistGeo.value !== id) els.intelAreaAssistGeo.value = id;
      els.intelAreaAssistGeo.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    district.selectedGeoId = id;
  };
  renderIntelGeoMap(els.intelDistrictEvidenceMapSvg, els.intelDistrictEvidenceMapStatus, {
    mapLayer,
    area: areaToMapArea(area),
    selectedGeoId,
    onSelectGeo,
  });

  if (els.intelFlowStepStatus){
    els.intelFlowStepStatus.textContent = flowStatus(isAreaReady(area), rowsScoped.length);
  }

  if (els.btnIntelFetchCensusGeoRows) els.btnIntelFetchCensusGeoRows.disabled = !isAreaReady(area) || busyFetch || busyLookup;
  if (els.btnIntelAreaAssistFetchCodes) els.btnIntelAreaAssistFetchCodes.disabled = !area.stateFips || busyLookup || busyFetch;
  if (els.btnIntelLoadAcsVariables) els.btnIntelLoadAcsVariables.disabled = busyVariables || busyFetch;
  if (els.btnIntelAcsVarAdd) els.btnIntelAcsVarAdd.disabled = busyVariables || busyFetch || !filteredCatalog.length;
  if (els.btnIntelAcsVarRemove) els.btnIntelAcsVarRemove.disabled = busyVariables || busyFetch || !normalizeAcsVariableList(district.selectedAcsVariables, []).length;
  if (els.btnIntelGeoInspectorReloadBoundary) els.btnIntelGeoInspectorReloadBoundary.disabled = !selectedGeoId || busyFetch;
  if (els.btnIntelGeoInspectorCopy) els.btnIntelGeoInspectorCopy.disabled = !str(els?.intelGeoInspectorSummary?.value);

  const copyMsg = getMessage(state, "copy");
  if (els.intelGeoInspectorCopyStatus){
    if (copyMsg.text){
      setStatus(els.intelGeoInspectorCopyStatus, copyMsg.text, copyMsg.kind);
    } else {
      setStatus(els.intelGeoInspectorCopyStatus, "No summary copied yet.", "muted");
    }
  }
}

export function wireDistrictCensusSimpleEvents(ctx = {}){
  const { els, state: initialState, getState, commitUIUpdate } = ctx;
  const currentState = () => {
    if (typeof getState === "function"){
      const s = getState();
      return isObject(s) ? s : null;
    }
    return isObject(initialState) ? initialState : null;
  };
  if (!els || !currentState()) return;
  if (els.__districtCensusSimpleBound) return;
  els.__districtCensusSimpleBound = true;

  const update = () => {
    if (typeof commitUIUpdate === "function") commitUIUpdate();
  };

  const withState = (fn) => {
    const s = currentState();
    if (!s) return;
    ensureScenarioShape(s);
    fn(s);
    update();
  };

  let autoLookupTimer = 0;
  const queueAutoLookup = () => {
    if (autoLookupTimer) clearTimeout(autoLookupTimer);
    autoLookupTimer = setTimeout(async () => {
      autoLookupTimer = 0;
      const s = currentState();
      if (!s) return;
      ensureScenarioShape(s);
      const area = currentArea(s);
      if (!area.stateFips) return;
      const { district } = ensureScenarioShape(s);
      if (isBusy(s, "lookup") || isBusy(s, "fetch")){
        queueAutoLookup();
        return;
      }
      const lookup = isObject(district.areaAssistLookup) ? district.areaAssistLookup : null;
      const areaKey = `${area.stateFips}|${area.type}|${area.countyFips}|${area.placeFips}|${area.district}|${area.resolution}`;
      if (str(district.autoLookupKey) === areaKey && lookup && lookup.fetchedAt) return;
      district.autoLookupKey = areaKey;
      setMessage(s, "lookup", "Fetching county/place/GEO lookup lists...", "muted");
      setBusy(s, "lookup", true);
      update();
      try{
        await handleFetchLookup(s);
      } finally {
        setBusy(s, "lookup", false);
      }
      update();
    }, 220);
  };

  if (els.intelAreaStateFips){
    els.intelAreaStateFips.addEventListener("change", () => {
      withState((state) => {
        const area = currentArea(state);
        area.stateFips = normalizeStateFips(els.intelAreaStateFips.value);
        if (!area.type) area.type = "COUNTY";
        area.countyFips = "";
        area.placeFips = "";
        area.district = "";
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaType){
    els.intelAreaType.addEventListener("change", () => {
      withState((state) => {
        const area = currentArea(state);
        area.type = normalizeAreaTypeInput(els.intelAreaType.value);
        area.district = "";
        area.countyFips = "";
        area.placeFips = "";
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaResolution){
    els.intelAreaResolution.addEventListener("change", () => {
      withState((state) => {
        const area = currentArea(state);
        area.resolution = normalizeAreaResolutionInput(els.intelAreaResolution.value);
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaLabel){
    els.intelAreaLabel.addEventListener("input", () => {
      withState((state) => {
        const area = currentArea(state);
        area.label = str(els.intelAreaLabel.value);
        applyAreaToState(state, area);
      });
    });
  }

  if (els.intelAreaDistrict){
    els.intelAreaDistrict.addEventListener("input", () => {
      withState((state) => {
        const area = currentArea(state);
        area.district = normalizeDistrictCodeForAreaType(area.type, els.intelAreaDistrict.value);
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaCountyFips){
    els.intelAreaCountyFips.addEventListener("input", () => {
      withState((state) => {
        const area = currentArea(state);
        area.type = "COUNTY";
        area.countyFips = normalizeCounty5(area.stateFips, els.intelAreaCountyFips.value);
        area.placeFips = "";
        area.district = "";
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaPlaceFips){
    els.intelAreaPlaceFips.addEventListener("input", () => {
      withState((state) => {
        const area = currentArea(state);
        area.type = "PLACE";
        area.placeFips = normalizePlace5(els.intelAreaPlaceFips.value);
        area.countyFips = "";
        area.district = "";
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaAssistCounty){
    els.intelAreaAssistCounty.addEventListener("change", () => {
      withState((state) => {
        const area = currentArea(state);
        area.type = "COUNTY";
        area.countyFips = normalizeCounty5(area.stateFips, els.intelAreaAssistCounty.value);
        area.placeFips = "";
        area.district = "";
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaAssistPlace){
    els.intelAreaAssistPlace.addEventListener("change", () => {
      withState((state) => {
        const area = currentArea(state);
        const d = digits(els.intelAreaAssistPlace.value);
        area.type = "PLACE";
        area.placeFips = d.length >= 7 ? d.slice(-5) : normalizePlace5(d);
        area.countyFips = "";
        area.district = "";
        applyAreaToState(state, area);
        clearCensusRowsForAreaChange(state);
      });
      queueAutoLookup();
    });
  }

  if (els.intelAreaAssistGeo){
    els.intelAreaAssistGeo.addEventListener("change", () => {
      withState((state) => {
        const area = currentArea(state);
        const { district } = ensureScenarioShape(state);
        district.selectedGeoId = normalizeAreaGeoId(els.intelAreaAssistGeo.value, area.resolution);
      });
    });
  }

  if (els.intelGeoInspectorSelect){
    els.intelGeoInspectorSelect.addEventListener("change", () => {
      withState((state) => {
        const area = currentArea(state);
        const { district } = ensureScenarioShape(state);
        district.selectedGeoId = normalizeAreaGeoId(els.intelGeoInspectorSelect.value, area.resolution);
      });
    });
  }

  if (els.intelAcsYearPreference){
    els.intelAcsYearPreference.addEventListener("change", () => {
      withState((state) => {
        const { district } = ensureScenarioShape(state);
        district.acsYearPreference = str(els.intelAcsYearPreference.value || "auto_latest") || "auto_latest";
      });
    });
  }

  if (els.intelCensusApiKey){
    els.intelCensusApiKey.addEventListener("input", () => {
      withState((state) => {
        const { district } = ensureScenarioShape(state);
        district.censusApiKey = str(els.intelCensusApiKey.value);
      });
    });
  }

  if (els.intelAcsVarSearch){
    els.intelAcsVarSearch.addEventListener("input", () => {
      withState((state) => {
        const { district } = ensureScenarioShape(state);
        district.acsVariableSearch = str(els.intelAcsVarSearch.value);
      });
    });
  }

  if (els.btnIntelLoadAcsVariables){
    els.btnIntelLoadAcsVariables.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      ensureScenarioShape(s);
      if (isBusy(s, "variables") || isBusy(s, "fetch")) return;
      setMessage(s, "variables", "Loading ACS variable catalog...", "muted");
      setBusy(s, "variables", true);
      update();
      try{
        await handleLoadAcsVariableCatalog(s);
      } finally {
        setBusy(s, "variables", false);
      }
      update();
    });
  }

  if (els.btnIntelAcsVarAdd){
    els.btnIntelAcsVarAdd.addEventListener("click", () => {
      withState((state) => {
        const { district } = ensureScenarioShape(state);
        const addCodes = readSelectedOptionValues(els.intelAcsVarCatalog);
        const merged = normalizeAcsVariableList(
          [...normalizeAcsVariableList(district.selectedAcsVariables, DEFAULT_ACS_VARIABLES), ...addCodes],
          DEFAULT_ACS_VARIABLES
        );
        district.selectedAcsVariables = merged;
        setMessage(state, "variables", `Selected ${merged.length} ACS variables.`, "ok");
      });
    });
  }

  if (els.btnIntelAcsVarRemove){
    els.btnIntelAcsVarRemove.addEventListener("click", () => {
      withState((state) => {
        const { district } = ensureScenarioShape(state);
        const removeSet = new Set(readSelectedOptionValues(els.intelAcsVarSelected).map((x) => normalizeAcsVariableCode(x)).filter(Boolean));
        const kept = normalizeAcsVariableList(district.selectedAcsVariables, DEFAULT_ACS_VARIABLES).filter((code) => !removeSet.has(code));
        district.selectedAcsVariables = normalizeAcsVariableList(kept, DEFAULT_ACS_VARIABLES);
        setMessage(state, "variables", `Selected ${district.selectedAcsVariables.length} ACS variables.`, "ok");
      });
    });
  }

  if (els.btnIntelAreaAssistFetchCodes){
    els.btnIntelAreaAssistFetchCodes.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      ensureScenarioShape(s);
      if (isBusy(s, "lookup") || isBusy(s, "fetch")) return;
      setMessage(s, "lookup", "Fetching county/place/GEO lookup lists...", "muted");
      setBusy(s, "lookup", true);
      update();
      try{
        await handleFetchLookup(s);
      } finally {
        setBusy(s, "lookup", false);
      }
      update();
    });
  }

  if (els.btnIntelFetchCensusGeoRows){
    els.btnIntelFetchCensusGeoRows.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      ensureScenarioShape(s);
      if (isBusy(s, "fetch") || isBusy(s, "lookup")) return;
      setMessage(s, "fetch", "Fetching Census GEO rows from API...", "muted");
      setBusy(s, "fetch", true);
      update();
      try{
        await handleFetchCensusRows(s);
      } finally {
        setBusy(s, "fetch", false);
      }
      update();
    });
  }

  if (els.btnIntelGeoInspectorReloadBoundary){
    els.btnIntelGeoInspectorReloadBoundary.addEventListener("click", () => {
      withState((state) => {
        const area = currentArea(state);
        const { district } = ensureScenarioShape(state);
        const geoid = normalizeAreaGeoId(district.selectedGeoId, area.resolution);
        if (geoid){
          resetIntelGeoBoundaryCache(geoid);
          setMessage(state, "fetch", `Boundary reload requested for ${geoid}.`, "muted");
        } else {
          resetIntelGeoBoundaryCache();
        }
      });
    });
  }

  if (els.btnIntelGeoInspectorCopy){
    els.btnIntelGeoInspectorCopy.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      const text = str(els?.intelGeoInspectorSummary?.value);
      if (!text){
        setMessage(s, "copy", "No GEO summary to copy.", "warn");
        update();
        return;
      }
      try{
        if (navigator?.clipboard?.writeText){
          await navigator.clipboard.writeText(text);
          setMessage(s, "copy", "GEO summary copied.", "ok");
        } else {
          throw new Error("Clipboard API unavailable.");
        }
      } catch (err){
        setMessage(s, "copy", `Copy failed: ${str(err?.message || err)}`, "warn");
      }
      update();
    });
  }
}
