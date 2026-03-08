import { buildAreaResolverCacheKey } from "../core/areaResolver.js";
import { makeDefaultDistrictIntelPack } from "../core/districtData.js";
import { compileDistrictEvidence, buildGeoEvidenceMapLayer } from "../core/districtEvidence.js";
import { buildDistrictIntelPackFromEvidence } from "../core/districtIntelBuilder.js";
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

const ACS_VARIABLES = [
  "B19013_001E",
  "B25003_001E", "B25003_002E", "B25003_003E",
  "B25024_001E", "B25024_006E", "B25024_007E", "B25024_008E", "B25024_009E",
  "B15003_001E", "B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E",
  "C16002_001E", "C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E",
  "B01001_001E",
  "B01001_007E", "B01001_008E", "B01001_009E", "B01001_010E", "B01001_011E", "B01001_012E",
  "B01001_031E", "B01001_032E", "B01001_033E", "B01001_034E", "B01001_035E", "B01001_036E",
  "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
  "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",
];

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
  return Math.round(n).toLocaleString();
}

function fmtPctFromRatio(v, digitsCount = 1){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(Math.max(0, digitsCount | 0))}%`;
}

function fmtCurrency(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
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
  district.selectedGeoId = str(district.selectedGeoId);
  district.acsYearPreference = str(district.acsYearPreference || "auto_latest") || "auto_latest";
  if (!isObject(state.dataRefs)) state.dataRefs = {};
  if (!isObject(state.dataCatalog)) state.dataCatalog = { boundarySets: [], crosswalks: [], censusDatasets: [], electionDatasets: [] };
  if (!Array.isArray(state.dataCatalog.censusDatasets)) state.dataCatalog.censusDatasets = [];
  if (!Array.isArray(state.dataCatalog.boundarySets)) state.dataCatalog.boundarySets = [];
  if (!Array.isArray(state.dataCatalog.crosswalks)) state.dataCatalog.crosswalks = [];
  if (!Array.isArray(state.dataCatalog.electionDatasets)) state.dataCatalog.electionDatasets = [];
  if (!isObject(state.districtIntelPack)) state.districtIntelPack = makeDefaultDistrictIntelPack();
  return { geo, area, district };
}

function resetPack(state){
  state.useDistrictIntel = false;
  state.districtIntelPack = makeDefaultDistrictIntelPack();
}

function clearCensusRowsForAreaChange(state){
  const { district } = ensureScenarioShape(state);
  district.censusRowsV2 = [];
  district.censusRowsV2Meta = null;
  district.selectedGeoId = "";
  resetPack(state);
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

async function fetchJson(url){
  if (typeof fetch !== "function") throw new Error("Browser fetch API is unavailable.");
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  if (!res?.ok) throw new Error(`Request failed (HTTP ${res?.status || "?"}).`);
  return res.json();
}

async function resolveAcsYear(preference){
  const pref = str(preference);
  if (/^\d{4}$/.test(pref)) return pref;
  const now = new Date();
  const max = now.getUTCFullYear() - 1;
  const min = Math.max(2009, max - 15);
  for (let year = max; year >= min; year -= 1){
    const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME&for=us:1`;
    try{
      await fetchJson(url);
      return String(year);
    } catch {}
  }
  throw new Error("Unable to resolve an available ACS year.");
}

async function fetchLookupPayload(area){
  const stateFips = normalizeStateFips(area.stateFips);
  const resolution = normalizeAreaResolutionInput(area.resolution);
  const countyUrl = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateFips}`;
  const placeUrl = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=place:*&in=state:${stateFips}`;
  const [countyPayload, placePayload] = await Promise.all([fetchJson(countyUrl), fetchJson(placeUrl)]);
  const countyRows = parseCensusJsonTable(countyPayload);
  const placeRows = parseCensusJsonTable(placePayload);
  const geoRequests = buildLookupGeoRequests(area);
  let geoRows = [];
  let geoSource = "";
  for (const req of geoRequests){
    try{
      const payload = await fetchJson(req.url);
      const parsed = parseCensusJsonTable(payload);
      if (parsed.length){
        geoRows = parsed;
        geoSource = req.label;
        break;
      }
    } catch {}
  }
  return {
    counties: parseCountyRows(countyRows),
    places: parsePlaceRows(placeRows),
    geos: parseLookupRows(geoRows, resolution),
    geoSource,
  };
}

async function fetchDecRows(area){
  const requests = buildCensusGeoRequests(area);
  const byGeoid = new Map();
  let source = "";
  for (const req of requests){
    try{
      const payload = await fetchJson(req.url);
      const parsed = parseDecGeoRows(parseCensusJsonTable(payload), area.resolution);
      if (!parsed.length) continue;
      for (const row of parsed){
        byGeoid.set(row.geoid, row);
      }
      if (!source) source = req.label;
    } catch {}
  }
  return {
    rows: Array.from(byGeoid.values()).sort((a, b) => a.geoid.localeCompare(b.geoid)),
    source,
  };
}

async function fetchAcsRowsByCounty(stateFips, resolution, counties, acsYear){
  const mode = normalizeAreaResolutionInput(resolution);
  const countyList = Array.from(new Set((Array.isArray(counties) ? counties : []).map((x) => digits(x).slice(0, 3)).filter(Boolean)));
  const byGeoid = new Map();
  const getVars = ["NAME", ...ACS_VARIABLES].join(",");
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
      payload = await fetchJson(url);
    } catch {
      continue;
    }
    const rows = parseCensusJsonTable(payload);
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
      for (const key of ACS_VARIABLES){
        const n = num(row[key]);
        if (n == null) continue;
        values[key] = n;
      }
      byGeoid.set(geoid, values);
    }
  }
  return byGeoid;
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

function buildAssumptionRows(pack){
  const assumptions = isObject(pack?.derivedAssumptions) ? pack.derivedAssumptions : {};
  const indices = isObject(pack?.indices) ? pack.indices : {};
  return [
    {
      label: "Doors per hour",
      base: num(assumptions?.doorsPerHour?.base),
      adjusted: num(assumptions?.doorsPerHour?.adjusted),
      driver: `Field speed ${num(indices.fieldSpeed) == null ? "—" : Number(indices.fieldSpeed).toFixed(2)}x`,
      pct: false,
    },
    {
      label: "Persuasion rate",
      base: num(assumptions?.persuasionRate?.base),
      adjusted: num(assumptions?.persuasionRate?.adjusted),
      driver: `Persuasion env ${num(indices.persuasionEnv) == null ? "—" : Number(indices.persuasionEnv).toFixed(2)}x`,
      pct: true,
    },
    {
      label: "Turnout lift",
      base: num(assumptions?.turnoutLift?.base),
      adjusted: num(assumptions?.turnoutLift?.adjusted),
      driver: `Turnout elasticity ${num(indices.turnoutElasticity) == null ? "—" : Number(indices.turnoutElasticity).toFixed(2)}x`,
      pct: false,
    },
    {
      label: "Organizer capacity",
      base: num(assumptions?.organizerCapacity?.base),
      adjusted: num(assumptions?.organizerCapacity?.adjusted),
      driver: `Field difficulty ${num(indices.fieldDifficulty) == null ? "—" : Number(indices.fieldDifficulty).toFixed(2)}x`,
      pct: false,
    },
  ];
}

function fmtAssumptionValue(v, pct){
  if (v == null) return "—";
  return pct ? fmtPctFromRatio(v, 1) : fmtInt(v);
}

function fillAssumptionTable(tbody, pack){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!pack?.ready){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="5" class="muted">No district-intel assumption pack generated yet.</td>';
    tbody.appendChild(tr);
    return;
  }
  const rows = buildAssumptionRows(pack);
  for (const row of rows){
    const tr = document.createElement("tr");
    const delta = row.base != null && row.adjusted != null ? row.adjusted - row.base : null;
    const deltaText = delta == null
      ? "—"
      : row.pct
        ? `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp`
        : `${delta >= 0 ? "+" : ""}${Math.round(delta).toLocaleString()}`;
    tr.innerHTML = `
      <td>${row.label}</td>
      <td class="num">${fmtAssumptionValue(row.base, row.pct)}</td>
      <td class="num">${fmtAssumptionValue(row.adjusted, row.pct)}</td>
      <td class="num">${deltaText}</td>
      <td>${row.driver}</td>
    `;
    tbody.appendChild(tr);
  }
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

function fillGeoTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="6">No GEO layer rows available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const sorted = rows.slice().sort((a, b) => a.geoid.localeCompare(b.geoid)).slice(0, 500);
  for (const row of sorted){
    const values = isObject(row?.values) ? row.values : {};
    const pop = num(values.pop) ?? num(values.B01003_001E);
    const housing = num(values.housing_units) ?? num(values.B25001_001E);
    const income = num(values.B19013_001E);
    const renter = share(values.B25003_003E, values.B25003_001E);
    const keys = Object.keys(values).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.geoid}</td>
      <td class="num">${pop == null ? "—" : fmtInt(pop)}</td>
      <td class="num">${housing == null ? "—" : fmtInt(housing)}</td>
      <td class="num">${income == null ? "—" : fmtCurrency(income)}</td>
      <td class="num">${renter == null ? "—" : fmtPctFromRatio(renter, 1)}</td>
      <td>${keys ? `${keys} fields` : "—"}</td>
    `;
    tbody.appendChild(tr);
  }
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

function flowStatus(areaReady, rowCount, packReady){
  if (!areaReady) return "Flow: Step 1 select state + area type + area code.";
  if (!rowCount) return "Flow: Step 2 fetch Census GEO rows for the selected area.";
  if (!packReady) return "Flow: Step 3 review map + demographics, then Step 4 generate assumptions.";
  return "Flow: Step 5 toggle district-intel assumptions ON/OFF.";
}

async function handleFetchLookup(state){
  const area = currentArea(state);
  if (!normalizeStateFips(area.stateFips)){
    setMessage(state, "lookup", "Set state first, then fetch county/place/GEO lists.", "warn");
    return;
  }
  setMessage(state, "lookup", "Fetching county/place/GEO lookup lists...", "muted");
  let payload = null;
  try{
    payload = await fetchLookupPayload(area);
  } catch (err){
    setMessage(state, "lookup", `Lookup fetch failed: ${str(err?.message || err)}`, "warn");
    return;
  }
  const { district } = ensureScenarioShape(state);
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
  setMessage(
    state,
    "lookup",
    `Lookup loaded: ${payload.counties.length} counties, ${payload.places.length} places${payload.geos.length ? `, ${payload.geos.length} ${area.resolution === "block_group" ? "block groups" : "tracts"}` : ""}.`,
    "ok"
  );
}

async function handleFetchCensusRows(state){
  const area = currentArea(state);
  if (!isAreaReady(area)){
    setMessage(state, "fetch", "Complete area selection first, then fetch Census GEO rows.", "warn");
    return;
  }
  setMessage(state, "fetch", "Fetching Census GEO rows from API...", "muted");
  const decOut = await fetchDecRows(area).catch((err) => ({ rows: [], source: "", error: err }));
  if (!Array.isArray(decOut.rows) || !decOut.rows.length){
    const msg = decOut?.error ? str(decOut.error?.message || decOut.error) : "No GEO rows returned for selected area.";
    setMessage(state, "fetch", `Census fetch failed: ${msg}`, "warn");
    return;
  }

  const acsPref = str(state?.geoPack?.district?.acsYearPreference || "auto_latest") || "auto_latest";
  let acsYear = "";
  try{
    acsYear = await resolveAcsYear(acsPref);
  } catch (err){
    setMessage(state, "fetch", `Census fetch warning: ${str(err?.message || err)} Using DEC-only fields.`, "warn");
  }

  const countySet = Array.from(new Set(decOut.rows.map((row) => digits(row.geoid).slice(2, 5)).filter(Boolean)));
  let acsByGeoid = new Map();
  if (acsYear && countySet.length){
    acsByGeoid = await fetchAcsRowsByCounty(area.stateFips, area.resolution, countySet, acsYear).catch(() => new Map());
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
  const { district } = ensureScenarioShape(state);
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
    resolution: area.resolution,
    stateFips: area.stateFips,
  };
  district.selectedGeoId = mergedRows[0]?.geoid || "";
  resetPack(state);
  setMessage(
    state,
    "fetch",
    `Loaded ${mergedRows.length} ${area.resolution === "block_group" ? "block groups" : "tracts"}${acsYear ? ` with ACS ${acsYear}` : ""}.`,
    "ok"
  );
}

function handleGenerateAssumptions(state, engine){
  const area = currentArea(state);
  const { district } = ensureScenarioShape(state);
  const rows = normalizeRowsToArea(district.censusRowsV2, area, district.areaAssistLookup);
  if (!rows.length){
    setMessage(state, "generate", "Load Census GEO rows for the selected area before generating assumptions.", "warn");
    return;
  }
  const evidence = compileDistrictEvidence({
    precinctResults: [],
    crosswalkRows: [],
    censusGeoRows: rows.map((row) => ({ geoid: row.geoid, values: row.values })),
  });
  const buildPack = typeof engine?.snapshot?.buildDistrictIntelPackFromEvidence === "function"
    ? engine.snapshot.buildDistrictIntelPackFromEvidence
    : buildDistrictIntelPackFromEvidence;
  const out = buildPack({
    scenario: state,
    evidence,
    refs: {
      censusDatasetId: str(state?.dataRefs?.censusDatasetId) || null,
      electionDatasetId: null,
      crosswalkVersionId: null,
      boundarySetId: str(state?.dataRefs?.boundarySetId) || null,
    },
    nowIso: new Date().toISOString(),
  });
  const pack = isObject(out?.pack) ? out.pack : out;
  if (!isObject(pack)){
    setMessage(state, "generate", "District-intel generation failed: no pack returned.", "warn");
    return;
  }
  state.districtIntelPack = pack;
  state.useDistrictIntel = false;
  const warnings = Array.isArray(pack?.warnings) ? pack.warnings.filter(Boolean) : [];
  if (pack.ready){
    setMessage(
      state,
      "generate",
      warnings.length
        ? `District-intel assumptions generated with warnings: ${str(warnings[0])}`
        : "District-intel assumptions generated from Census evidence.",
      warnings.length ? "warn" : "ok"
    );
  } else {
    setMessage(state, "generate", "District-intel assumptions not ready. Census evidence is incomplete.", "warn");
  }
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

export function renderDistrictCensusSimple({ els, state, engine } = {}){
  if (!els || !state) return;
  const { district } = ensureScenarioShape(state);
  const area = currentArea(state);
  applyAreaToState(state, area);

  if (els.intelDistrictAdvancedDataDetails) els.intelDistrictAdvancedDataDetails.hidden = true;
  if (els.intelDistrictElectionTables) els.intelDistrictElectionTables.hidden = true;
  if (els.intelDistrictEvidenceSelectedElection) els.intelDistrictEvidenceSelectedElection.hidden = true;

  fillStateSelect(els.intelAreaStateFips, area.stateFips);
  syncAreaInputsFromState(els, area);
  fillSelect(els.intelAcsYearPreference, acsYearOptions(), district.acsYearPreference, "Auto latest");

  const lookup = isObject(district.areaAssistLookup) ? district.areaAssistLookup : {};
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

  if (els.intelAreaAssistGeo) els.intelAreaAssistGeo.disabled = !geoOptions.length;

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
  fillAssumptionTable(els.intelDistrictAssumptionTbody, state.districtIntelPack);
  fillGeoTable(els.intelDistrictEvidenceGeoTbody, rowsScoped);

  const population = pickMetric(totals, ["pop", "population", "total_population", "B01003_001E", "B01003_001"]);
  const housing = pickMetric(totals, ["housing_units", "housing", "total_housing_units", "B25001_001E", "B25001_001"]);

  if (els.intelDistrictEvidenceCoverage) els.intelDistrictEvidenceCoverage.textContent = `GEO rows loaded: ${fmtInt(rowsScoped.length)}`;
  if (els.intelDistrictEvidenceVotes) els.intelDistrictEvidenceVotes.textContent = `Population total: ${population == null ? "—" : fmtInt(population)}`;
  if (els.intelDistrictEvidenceSignal) els.intelDistrictEvidenceSignal.textContent = `Housing units total: ${housing == null ? "—" : fmtInt(housing)}`;

  const areaFingerprint = buildAreaResolverCacheKey({ area });
  if (els.intelAreaResolverSummary){
    els.intelAreaResolverSummary.textContent = area.type
      ? `Area resolver: ${area.type} ${areaIdentity(area)} · ${area.resolution === "block_group" ? "block group" : "tract"}`
      : "Area resolver: not configured.";
  }
  if (els.intelAreaResolverDetail){
    els.intelAreaResolverDetail.textContent = area.type
      ? `Cache key: ${areaFingerprint}`
      : "Set area + resolution to generate a deterministic cache key.";
  }

  if (els.intelAreaCodeLinks){
    if (!area.stateFips){
      els.intelAreaCodeLinks.textContent = "Code lookup links appear after State FIPS is set.";
    } else {
      const base = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${area.stateFips}`;
      const links = [`County list API: ${base}`];
      els.intelAreaCodeLinks.textContent = links.join(" · ");
    }
  }

  const lookupMsg = getMessage(state, "lookup");
  if (els.intelAreaAssistLookupStatus){
    if (lookupMsg.text){
      setStatus(els.intelAreaAssistLookupStatus, lookupMsg.text, lookupMsg.kind);
    } else if (lookup?.fetchedAt){
      setStatus(els.intelAreaAssistLookupStatus, `Lookup loaded ${str(lookup.fetchedAt).slice(0, 19).replace("T", " ")}.`, "ok");
    } else {
      setStatus(els.intelAreaAssistLookupStatus, "No fetched county/place/GEO lookup loaded.", "muted");
    }
  }

  if (els.intelAreaAssistStatus){
    if (!area.stateFips){
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
    if (rowsScoped.length){
      setStatus(els.intelDistrictEvidenceStatus, `Census view ready: ${fmtInt(rowsScoped.length)} GEO rows.`, "ok");
    } else if (fetchMsg.text){
      setStatus(els.intelDistrictEvidenceStatus, fetchMsg.text, fetchMsg.kind);
    } else {
      setStatus(els.intelDistrictEvidenceStatus, "District evidence not compiled yet.", "muted");
    }
  }

  if (els.intelDistrictEvidenceSource){
    const datasetId = str(state?.dataRefs?.censusDatasetId);
    const sourceBits = [];
    if (datasetId) sourceBits.push(`Census dataset: ${datasetId}`);
    if (acsYear) sourceBits.push(`ACS year: ${acsYear}`);
    sourceBits.push(rowsScoped.length ? "Render source: selected-area census rows" : "Render source: none");
    els.intelDistrictEvidenceSource.textContent = sourceBits.join(" · ");
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
  renderIntelGeoMap(els.intelDistrictEvidenceMapSvg, els.intelDistrictEvidenceMapStatus, {
    mapLayer,
    area: areaToMapArea(area),
    selectedGeoId,
  });

  const packReady = !!state?.districtIntelPack?.ready;
  const generateMsg = getMessage(state, "generate");

  if (els.intelUseDistrictToggle){
    els.intelUseDistrictToggle.disabled = !packReady;
    els.intelUseDistrictToggle.checked = !!state.useDistrictIntel && packReady;
  }

  if (els.intelDistrictIntelStatus){
    if (state.useDistrictIntel && packReady){
      const generatedAt = str(state?.districtIntelPack?.generatedAt).slice(0, 10) || "today";
      setStatus(els.intelDistrictIntelStatus, `District-intel assumptions are ON (generated ${generatedAt}).`, "ok");
    } else if (packReady){
      if (generateMsg.text){
        setStatus(els.intelDistrictIntelStatus, generateMsg.text, generateMsg.kind);
      } else {
        setStatus(els.intelDistrictIntelStatus, "District-intel pack ready. Toggle ON to apply assumptions.", "muted");
      }
    } else {
      setStatus(els.intelDistrictIntelStatus, "District-intel assumptions are OFF.", "muted");
    }
  }

  if (els.intelDistrictIntelSummary){
    if (!packReady){
      els.intelDistrictIntelSummary.textContent = "No district-intel pack generated yet.";
    } else {
      const p = state?.districtIntelPack?.indices || {};
      els.intelDistrictIntelSummary.textContent = `Field speed ${num(p.fieldSpeed) == null ? "—" : Number(p.fieldSpeed).toFixed(2)}x · Persuasion ${num(p.persuasionEnv) == null ? "—" : Number(p.persuasionEnv).toFixed(2)}x · Turnout ${num(p.turnoutElasticity) == null ? "—" : Number(p.turnoutElasticity).toFixed(2)}x · Difficulty ${num(p.fieldDifficulty) == null ? "—" : Number(p.fieldDifficulty).toFixed(2)}x`;
    }
  }

  if (els.intelDistrictIntelAlignment){
    if (!packReady){
      setStatus(els.intelDistrictIntelAlignment, "Alignment: no district-intel pack generated.", "muted");
    } else {
      const provenanceArea = str(state?.districtIntelPack?.provenance?.areaFingerprint);
      if (!provenanceArea){
        setStatus(els.intelDistrictIntelAlignment, "Alignment warning: pack provenance area fingerprint missing.", "warn");
      } else if (provenanceArea !== areaFingerprint){
        setStatus(els.intelDistrictIntelAlignment, "Alignment warning: pack provenance differs from current area. Regenerate assumptions.", "warn");
      } else {
        setStatus(els.intelDistrictIntelAlignment, "Alignment: pack provenance matches current area.", "ok");
      }
    }
  }

  if (els.intelFlowStepStatus){
    els.intelFlowStepStatus.textContent = flowStatus(isAreaReady(area), rowsScoped.length, packReady);
  }

  if (els.btnIntelGenerateDistrictIntel) els.btnIntelGenerateDistrictIntel.disabled = !rowsScoped.length;
  if (els.btnIntelFetchCensusGeoRows) els.btnIntelFetchCensusGeoRows.disabled = !isAreaReady(area);
  if (els.btnIntelAreaAssistFetchCodes) els.btnIntelAreaAssistFetchCodes.disabled = !area.stateFips;
  if (els.btnIntelGeoInspectorReloadBoundary) els.btnIntelGeoInspectorReloadBoundary.disabled = !selectedGeoId;
  if (els.btnIntelGeoInspectorCopy) els.btnIntelGeoInspectorCopy.disabled = !str(els?.intelGeoInspectorSummary?.value);

  const copyMsg = getMessage(state, "copy");
  if (els.intelGeoInspectorCopyStatus){
    if (copyMsg.text){
      setStatus(els.intelGeoInspectorCopyStatus, copyMsg.text, copyMsg.kind);
    } else {
      setStatus(els.intelGeoInspectorCopyStatus, "No summary copied yet.", "muted");
    }
  }

  if (els.intelDataRefStatus) setStatus(els.intelDataRefStatus, "Data refs auto-managed by Census fetch for this card.", "muted");
  if (els.intelDataRefAlignmentSummary) els.intelDataRefAlignmentSummary.textContent = "Alignment: Census-only mode active.";
  if (els.intelDataRefAlignmentDetail) els.intelDataRefAlignmentDetail.textContent = "Election/crosswalk refs are disabled in this rebuild phase.";
}

export function wireDistrictCensusSimpleEvents(ctx = {}){
  const { els, state: initialState, getState, commitUIUpdate, engine } = ctx;
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

  if (els.btnIntelAreaAssistFetchCodes){
    els.btnIntelAreaAssistFetchCodes.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      ensureScenarioShape(s);
      setMessage(s, "lookup", "Fetching county/place/GEO lookup lists...", "muted");
      update();
      await handleFetchLookup(s);
      update();
    });
  }

  if (els.btnIntelFetchCensusGeoRows){
    els.btnIntelFetchCensusGeoRows.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      ensureScenarioShape(s);
      setMessage(s, "fetch", "Fetching Census GEO rows from API...", "muted");
      update();
      await handleFetchCensusRows(s);
      update();
    });
  }

  if (els.btnIntelGenerateDistrictIntel){
    els.btnIntelGenerateDistrictIntel.addEventListener("click", () => {
      withState((state) => {
        handleGenerateAssumptions(state, engine);
      });
    });
  }

  if (els.intelUseDistrictToggle){
    els.intelUseDistrictToggle.addEventListener("change", () => {
      withState((state) => {
        if (!state?.districtIntelPack?.ready){
          state.useDistrictIntel = false;
          els.intelUseDistrictToggle.checked = false;
          setMessage(state, "generate", "Generate assumptions before enabling district-intel toggle.", "warn");
          return;
        }
        state.useDistrictIntel = !!els.intelUseDistrictToggle.checked;
      });
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
