import {
  CENSUS_LOCAL_KEY,
  CENSUS_DEFAULT_API_KEY,
  listAcsYears,
  listResolutionOptions,
  listMetricSetOptions,
  normalizeCensusState,
  fetchStateOptions,
  fetchCountyOptions,
  fetchPlaceOptions,
  fetchGeoOptions,
  fetchAcsRows,
  fetchVariableCatalog,
  validateMetricSetWithCatalog,
  aggregateRowsForSelection,
  buildAggregateTableRows,
  filterGeoOptions,
  fetchTigerBoundaryGeojson,
  fetchTigerVtdBoundaryGeojson,
  parseGeoidInput,
  normalizeGeoidsForResolution,
  makeDefaultRaceFootprint,
  normalizeRaceFootprint,
  computeRaceFootprintFingerprint,
  makeDefaultAssumptionProvenance,
  normalizeAssumptionProvenance,
  makeDefaultFootprintCapacity,
  normalizeFootprintCapacity,
  buildRaceFootprintFromCensusSelection,
  assessRaceFootprintAlignment,
  evaluateFootprintFeasibility,
  summarizeFootprintFeasibilityIssues,
  buildElectionCsvTemplate,
  buildElectionCsvWideTemplate,
  getElectionCsvUploadGuide,
  parseCsvText,
  normalizeElectionCsvRows,
} from "../core/censusModule.js";

const variableCatalogCache = new Map();
let stateOptionsCache = null;
const countyOptionsCache = new Map();
const placeOptionsCache = new Map();
const rowsCache = new Map();
const LEAFLET_CSS_ID = "fpeLeafletCss";
const LEAFLET_SCRIPT_ID = "fpeLeafletScript";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
let leafletLoadPromise = null;
let mapInstance = null;
let mapHost = null;
let mapOverlayLayer = null;
let mapQaVtdLayer = null;
let mapRequestSeq = 0;
let mapLoadedSelectionKey = "";
let electionCsvRequestSeq = 0;
const mapRuntimeStatus = {
  loading: false,
  error: "",
  text: "Map idle. Select GEO units, then load boundaries.",
  featureCount: 0,
  missingCount: 0,
  qaLoading: false,
  qaText: "",
  qaFeatureCount: 0,
};
const electionCsvDryRun = {
  fileName: "",
  fileSize: 0,
  fileUpdatedAt: "",
  statusText: "No dry-run run yet.",
  statusLevel: "muted",
  format: "",
  parsedRows: 0,
  normalizedRows: 0,
  precinctFilter: "",
  errors: [],
  warnings: [],
  records: [],
};

function cleanText(v){
  return String(v == null ? "" : v).trim();
}

function getStorage(){
  try{
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {}
  return null;
}

export function readCensusApiKeyModule(){
  const storage = getStorage();
  if (!storage) return CENSUS_DEFAULT_API_KEY;
  const stored = cleanText(storage.getItem(CENSUS_LOCAL_KEY));
  return stored || CENSUS_DEFAULT_API_KEY;
}

export function writeCensusApiKeyModule(value){
  const storage = getStorage();
  if (!storage) return;
  const key = cleanText(value);
  if (!key || key === CENSUS_DEFAULT_API_KEY){
    storage.removeItem(CENSUS_LOCAL_KEY);
    return;
  }
  storage.setItem(CENSUS_LOCAL_KEY, key);
}

export function ensureCensusStateModule(state){
  if (!state || typeof state !== "object") return null;
  state.census = normalizeCensusState(state.census);
  return state.census;
}

function fillSelect(el, rows, value, placeholderLabel){
  if (!el || typeof el.appendChild !== "function" || !("innerHTML" in el)) return;
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;
  const prev = cleanText(value);
  el.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholderLabel;
  el.appendChild(ph);
  for (const row of rows || []){
    const option = document.createElement("option");
    option.value = cleanText(row.value);
    option.textContent = cleanText(row.label);
    el.appendChild(option);
  }
  el.value = prev;
  if (el.value !== prev) el.value = "";
}

function fillMultiSelect(el, rows, selectedGeoids){
  if (!el || typeof el.appendChild !== "function" || !("innerHTML" in el)) return;
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;
  const selected = new Set(Array.isArray(selectedGeoids) ? selectedGeoids.map((v) => cleanText(v)) : []);
  el.innerHTML = "";
  for (const row of rows || []){
    const opt = document.createElement("option");
    opt.value = cleanText(row.geoid);
    opt.textContent = cleanText(row.label || row.name || row.geoid);
    if (selected.has(opt.value)) opt.selected = true;
    el.appendChild(opt);
  }
}

function fmtTs(ts){
  const s = cleanText(ts);
  if (!s) return "No fetch yet.";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return `Last fetch: ${s}`;
  return `Last fetch: ${d.toLocaleString()}`;
}

function stateRowLabel(row){
  const fips = cleanText(row?.fips);
  const name = cleanText(row?.name);
  if (!fips) return name;
  return `${fips} — ${name}`;
}

function buildStateRows(rows){
  return (rows || []).map((row) => ({ value: row.fips, label: stateRowLabel(row) }));
}

function buildSubRows(rows){
  return (rows || []).map((row) => ({ value: row.fips, label: cleanText(row.name) }));
}

function setStatus(s, text, isError = false){
  s.status = cleanText(text) || "Ready.";
  s.error = isError ? s.status : "";
}

function contextReadyForGeo(s){
  if (!s.stateFips) return false;
  if (s.resolution === "place") return true;
  return !!s.countyFips;
}

function contextText(s){
  if (s.resolution === "place"){
    return s.stateFips ? `state ${s.stateFips}` : "no state";
  }
  return s.stateFips && s.countyFips ? `state ${s.stateFips} county ${s.countyFips}` : "no state/county";
}

function mapSelectionKey(s){
  const geoids = Array.isArray(s?.selectedGeoids) ? s.selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v) : [];
  const uniq = Array.from(new Set(geoids)).sort((a, b) => a.localeCompare(b));
  return [cleanText(s?.resolution), ...uniq].join("|");
}

function setMapRuntimeStatus(text, isError = false){
  mapRuntimeStatus.text = cleanText(text) || "Map idle.";
  mapRuntimeStatus.error = isError ? mapRuntimeStatus.text : "";
}

function cleanFips(v, len){
  const digits = cleanText(v).replace(/\D+/g, "");
  if (!digits) return "";
  return digits.padStart(len, "0").slice(-len);
}

function clearMapQaOverlay(statusText = ""){
  if (mapInstance && mapQaVtdLayer && typeof mapInstance.removeLayer === "function"){
    mapInstance.removeLayer(mapQaVtdLayer);
  }
  mapQaVtdLayer = null;
  mapRuntimeStatus.qaFeatureCount = 0;
  mapRuntimeStatus.qaLoading = false;
  mapRuntimeStatus.qaText = cleanText(statusText);
}

function clearMapOverlay(statusText = ""){
  if (mapInstance && mapOverlayLayer && typeof mapInstance.removeLayer === "function"){
    mapInstance.removeLayer(mapOverlayLayer);
  }
  mapOverlayLayer = null;
  clearMapQaOverlay();
  mapLoadedSelectionKey = "";
  mapRuntimeStatus.featureCount = 0;
  mapRuntimeStatus.missingCount = 0;
  if (statusText){
    setMapRuntimeStatus(statusText, false);
  }
}

function ensureLeafletCss(){
  if (typeof document === "undefined") return;
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}

function ensureLeaflet(){
  if (typeof window === "undefined" || typeof document === "undefined"){
    return Promise.reject(new Error("Map runtime unavailable."));
  }
  if (window.L && typeof window.L.map === "function"){
    return Promise.resolve(window.L);
  }
  if (leafletLoadPromise) return leafletLoadPromise;
  ensureLeafletCss();
  leafletLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(LEAFLET_SCRIPT_ID);
    if (existing){
      existing.addEventListener("load", () => resolve(window.L), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Leaflet.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = LEAFLET_SCRIPT_ID;
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.onload = () => {
      if (window.L && typeof window.L.map === "function"){
        resolve(window.L);
        return;
      }
      reject(new Error("Leaflet loaded but unavailable."));
    };
    script.onerror = () => reject(new Error("Failed to load Leaflet."));
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

function ensureMapMounted(container){
  if (!container || typeof window === "undefined" || !window.L || typeof window.L.map !== "function"){
    return null;
  }
  if (mapInstance && mapHost === container){
    if (typeof mapInstance.invalidateSize === "function"){
      mapInstance.invalidateSize(false);
    }
    return mapInstance;
  }
  if (mapInstance && mapHost && mapHost !== container){
    mapInstance.remove();
    mapInstance = null;
    mapOverlayLayer = null;
    mapQaVtdLayer = null;
  }
  mapHost = container;
  mapInstance = window.L.map(container, { zoomControl: true }).setView([39.5, -98.35], 4);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(mapInstance);
  if (typeof requestAnimationFrame === "function"){
    requestAnimationFrame(() => {
      if (mapInstance && typeof mapInstance.invalidateSize === "function"){
        mapInstance.invalidateSize(false);
      }
    });
  }
  return mapInstance;
}

function applyMapOverlay(featureCollection){
  if (!mapInstance || !window.L) return;
  if (mapOverlayLayer && typeof mapInstance.removeLayer === "function"){
    mapInstance.removeLayer(mapOverlayLayer);
  }
  mapOverlayLayer = window.L.geoJSON(featureCollection, {
    style: () => ({
      color: "#f04f37",
      weight: 2,
      fillColor: "#f04f37",
      fillOpacity: 0.12,
    }),
  }).addTo(mapInstance);
  if (typeof mapOverlayLayer.getBounds === "function"){
    const bounds = mapOverlayLayer.getBounds();
    if (bounds && typeof bounds.isValid === "function" && bounds.isValid()){
      mapInstance.fitBounds(bounds.pad(0.15));
    }
  }
}

function applyMapQaOverlay(featureCollection){
  if (!mapInstance || !window.L) return;
  if (mapQaVtdLayer && typeof mapInstance.removeLayer === "function"){
    mapInstance.removeLayer(mapQaVtdLayer);
  }
  const labelForFeature = (feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    const pick = (keys) => {
      for (const key of keys){
        const value = cleanText(props?.[key]);
        if (value) return value;
      }
      return "";
    };
    const label = pick(["NAME20", "NAME", "NAMELSAD20", "NAMELSAD", "VTDST20", "VTDI20", "LABEL"]);
    if (label) return label;
    const geoid = cleanText(feature?.properties?.GEOID20 || feature?.properties?.GEOID || feature?.id).replace(/\D+/g, "");
    return geoid;
  };
  mapQaVtdLayer = window.L.geoJSON(featureCollection, {
    style: () => ({
      color: "#3d8bfd",
      weight: 1,
      fillColor: "#3d8bfd",
      fillOpacity: 0,
    }),
    onEachFeature: (feature, layer) => {
      if (!layer) return;
      const label = labelForFeature(feature);
      if (!label) return;
      if (typeof layer.bindTooltip === "function"){
        layer.bindTooltip(label, { direction: "top", sticky: true, opacity: 0.95 });
      }
      if (typeof layer.bindPopup === "function"){
        const geoid = cleanText(feature?.properties?.GEOID20 || feature?.properties?.GEOID || feature?.id);
        const popupText = geoid && geoid !== label ? `${label} (${geoid})` : label;
        layer.bindPopup(popupText);
      }
    },
  }).addTo(mapInstance);
}

function mapQaCountyContext(s){
  const selected = Array.isArray(s?.selectedGeoids) ? s.selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v) : [];
  const first = selected[0] || "";
  const stateFips = cleanFips(s?.stateFips || first.slice(0, 2), 2);
  let countyFips = cleanFips(s?.countyFips, 3);
  if (!countyFips && first.length >= 5){
    countyFips = cleanFips(first.slice(2, 5), 3);
  }
  return { stateFips, countyFips };
}

async function onLoadMapBoundaries({ s, els, commitUIUpdate }){
  if (!s || !els || !els.censusMap){
    setMapRuntimeStatus("Map container unavailable.", true);
    commitUIUpdate({ persist: false });
    return;
  }
  const selected = Array.isArray(s.selectedGeoids) ? s.selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v) : [];
  if (!selected.length){
    clearMapOverlay("Select one or more GEO units first.");
    commitUIUpdate({ persist: false });
    return;
  }
  const seq = ++mapRequestSeq;
  mapRuntimeStatus.loading = true;
  mapRuntimeStatus.qaLoading = false;
  mapRuntimeStatus.qaText = "";
  mapRuntimeStatus.qaFeatureCount = 0;
  setMapRuntimeStatus(`Loading ${selected.length} boundary ${selected.length === 1 ? "shape" : "shapes"}...`, false);
  commitUIUpdate({ persist: false });
  try{
    await ensureLeaflet();
    const map = ensureMapMounted(els.censusMap);
    if (!map){
      throw new Error("Could not initialize map.");
    }
    const result = await fetchTigerBoundaryGeojson({
      resolution: s.resolution,
      geoids: selected,
    });
    if (seq !== mapRequestSeq) return;
    applyMapOverlay(result.featureCollection);
    mapRuntimeStatus.featureCount = Array.isArray(result.featureCollection?.features) ? result.featureCollection.features.length : 0;
    mapRuntimeStatus.missingCount = Array.isArray(result.missingGeoids) ? result.missingGeoids.length : 0;
    mapLoadedSelectionKey = mapSelectionKey(s);
    if (!mapRuntimeStatus.featureCount){
      setMapRuntimeStatus("No boundary features returned for selected GEOs.", true);
    } else if (mapRuntimeStatus.missingCount > 0){
      setMapRuntimeStatus(`Loaded ${mapRuntimeStatus.featureCount} boundaries; ${mapRuntimeStatus.missingCount} GEOIDs not matched.`, false);
    } else {
      setMapRuntimeStatus(`Loaded ${mapRuntimeStatus.featureCount} boundaries.`, false);
    }
    if (s.mapQaVtdOverlay){
      const qaContext = mapQaCountyContext(s);
      if (!qaContext.stateFips || !qaContext.countyFips){
        clearMapQaOverlay("VTD QA overlay unavailable for this selection (county context required).");
      } else {
        mapRuntimeStatus.qaLoading = true;
        const qaResult = await fetchTigerVtdBoundaryGeojson({
          stateFips: qaContext.stateFips,
          countyFips: qaContext.countyFips,
        });
        if (seq !== mapRequestSeq) return;
        applyMapQaOverlay(qaResult.featureCollection);
        mapRuntimeStatus.qaFeatureCount = Number.isFinite(Number(qaResult.featureCount)) ? Math.max(0, Math.floor(Number(qaResult.featureCount))) : 0;
        mapRuntimeStatus.qaText = mapRuntimeStatus.qaFeatureCount > 0
          ? `VTD QA overlay loaded (${mapRuntimeStatus.qaFeatureCount.toLocaleString("en-US")} polygons). Hover/click polygons for precinct labels.`
          : "VTD QA overlay returned no polygons.";
      }
    } else {
      clearMapQaOverlay();
    }
  } catch (err){
    if (seq !== mapRequestSeq) return;
    const msg = cleanText(err?.message) || "Boundary load failed.";
    if (mapRuntimeStatus.qaLoading){
      clearMapQaOverlay(`VTD QA overlay unavailable: ${msg}`);
      mapRuntimeStatus.qaLoading = false;
      mapRuntimeStatus.qaText = cleanText(mapRuntimeStatus.qaText) || "VTD QA overlay unavailable.";
    } else {
      setMapRuntimeStatus(msg, true);
    }
  } finally {
    if (seq === mapRequestSeq){
      mapRuntimeStatus.loading = false;
      mapRuntimeStatus.qaLoading = false;
      commitUIUpdate({ persist: false });
    }
  }
}

function resetGeoData(s){
  s.geoSearch = "";
  s.tractFilter = "";
  s.geoOptions = [];
  s.selectedGeoids = [];
  s.rowsByGeoid = {};
  s.activeRowsKey = "";
  s.loadedRowCount = 0;
  s.lastFetchAt = "";
  clearMapOverlay("Map cleared. Load boundaries for the new GEO selection.");
}

function placeGeoid(stateFips, placeFips){
  const state = cleanText(stateFips).replace(/\D+/g, "").padStart(2, "0").slice(-2);
  const place = cleanText(placeFips).replace(/\D+/g, "").padStart(5, "0").slice(-5);
  return state && place ? `${state}${place}` : "";
}

function setLoadingFlags(s, mode, flag){
  if (mode === "geo") s.loadingGeo = !!flag;
  if (mode === "rows") s.loadingRows = !!flag;
}

function nextSeq(s){
  s.requestSeq = Number.isFinite(Number(s.requestSeq)) ? Number(s.requestSeq) + 1 : 1;
  return s.requestSeq;
}

async function ensureStateOptions(key){
  if (Array.isArray(stateOptionsCache) && stateOptionsCache.length) return stateOptionsCache;
  const rows = await fetchStateOptions({ key });
  stateOptionsCache = rows;
  return rows;
}

async function ensureCountyOptions(stateFips, key){
  const sf = cleanText(stateFips);
  if (!sf) return [];
  const hit = countyOptionsCache.get(sf);
  if (hit) return hit;
  const rows = await fetchCountyOptions({ stateFips: sf, key });
  countyOptionsCache.set(sf, rows);
  return rows;
}

async function ensurePlaceOptions(stateFips, key){
  const sf = cleanText(stateFips);
  if (!sf) return [];
  const hit = placeOptionsCache.get(sf);
  if (hit) return hit;
  const rows = await fetchPlaceOptions({ stateFips: sf, key });
  placeOptionsCache.set(sf, rows);
  return rows;
}

function selectionFromMultiSelect(el){
  if (!el) return [];
  return Array.from(el.selectedOptions || []).map((opt) => cleanText(opt.value)).filter((v) => !!v);
}

function rowsCount(rowsByGeoid){
  return Object.keys(rowsByGeoid && typeof rowsByGeoid === "object" ? rowsByGeoid : {}).length;
}

function uniqueTractRows(options){
  const rows = Array.isArray(options) ? options : [];
  const seen = new Set();
  const out = [];
  for (const row of rows){
    const tract = cleanText(row?.tract);
    if (!tract || seen.has(tract)) continue;
    seen.add(tract);
    out.push({ value: tract, label: tract });
  }
  out.sort((a, b) => a.value.localeCompare(b.value));
  return out;
}

function rowsKeyFromState(s){
  return [
    cleanText(s.year),
    cleanText(s.resolution),
    cleanText(s.stateFips),
    cleanText(s.countyFips),
    cleanText(s.metricSet),
  ].join("|");
}

function getRowsForState(s){
  if (!cleanText(s?.stateFips)) return {};
  const key = cleanText(s.activeRowsKey);
  if (!key) return {};
  const rows = rowsCache.get(key);
  return rows && typeof rows === "object" ? rows : {};
}

function contextFingerprint(s){
  const resolution = cleanText(s?.resolution);
  const stateFips = cleanText(s?.stateFips);
  const countyFips = resolution === "place" ? "" : cleanText(s?.countyFips);
  const placeFips = resolution === "place" ? cleanText(s?.placeFips) : "";
  return [
    resolution,
    stateFips,
    countyFips,
    placeFips,
  ].join("|");
}

function setRowContextFingerprint(row){
  const resolution = cleanText(row?.resolution);
  const stateFips = cleanText(row?.stateFips);
  const countyFips = resolution === "place" ? "" : cleanText(row?.countyFips);
  const placeFips = resolution === "place" ? cleanText(row?.placeFips) : "";
  return [
    resolution,
    stateFips,
    countyFips,
    placeFips,
  ].join("|");
}

function buildSelectionSetRows(selectionSets){
  const rows = Array.isArray(selectionSets) ? selectionSets : [];
  return rows.map((row, idx) => ({
    value: String(idx),
    label: `${cleanText(row.name)} · ${cleanText(row.resolution)} · ${Array.isArray(row.geoids) ? row.geoids.length : 0} GEO`,
  }));
}

function getSelectionSetByKey(selectionSets, key){
  const rows = Array.isArray(selectionSets) ? selectionSets : [];
  const idx = Number(key);
  if (!Number.isInteger(idx) || idx < 0 || idx >= rows.length) return null;
  const row = rows[idx];
  return row && typeof row === "object" ? row : null;
}

function uniqueGeoids(values){
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []){
    const id = cleanText(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function liveRaceFootprintFromCensusState(s, { source = "census_phase1", updatedAt = "" } = {}){
  const footprint = normalizeRaceFootprint({
    ...buildRaceFootprintFromCensusSelection({
      ...s,
      selectedGeoids: normalizeGeoidsForResolution(uniqueGeoids(s?.selectedGeoids), cleanText(s?.resolution)),
    }),
    source,
    updatedAt: cleanText(updatedAt),
  });
  footprint.fingerprint = computeRaceFootprintFingerprint(footprint);
  return footprint;
}

function ensureAssumptionProvenance(state){
  if (!state || typeof state !== "object") return makeDefaultAssumptionProvenance();
  state.assumptionsProvenance = normalizeAssumptionProvenance(state.assumptionsProvenance);
  return state.assumptionsProvenance;
}

function aggregateSnapshot(s){
  const runtimeRows = getRowsForState(s);
  const aggregate = aggregateRowsForSelection({
    rowsByGeoid: runtimeRows,
    selectedGeoids: s.selectedGeoids,
    metricSet: s.metricSet,
  });
  const tableRows = buildAggregateTableRows(aggregate, s.metricSet);
  return { runtimeRows, aggregate, tableRows };
}

function selectedPopulationFromRows(rowsByGeoid, selectedGeoids){
  const rows = rowsByGeoid && typeof rowsByGeoid === "object" ? rowsByGeoid : {};
  const geoids = Array.isArray(selectedGeoids) ? selectedGeoids : [];
  let total = 0;
  let seen = 0;
  for (const geoid of geoids){
    const row = rows[cleanText(geoid)];
    const value = Number(row?.values?.B01003_001E);
    if (!Number.isFinite(value) || value < 0) continue;
    total += value;
    seen += 1;
  }
  return seen > 0 ? total : null;
}

function csvEscape(value){
  const text = String(value == null ? "" : value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function downloadTextFile(text, filename, mime){
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return false;
  const blob = new Blob([String(text == null ? "" : text)], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

function fileStamp(){
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function fileSlugPart(text){
  return cleanText(text).replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function canonicalToken(value){
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parsePrecinctFilterTokens(value){
  const parts = cleanText(value).split(/[\s,;|]+/g);
  const out = [];
  const seen = new Set();
  for (const part of parts){
    const token = canonicalToken(part);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function filterElectionDryRunRecords(records, filterText){
  const rows = Array.isArray(records) ? records : [];
  const tokens = parsePrecinctFilterTokens(filterText);
  if (!tokens.length){
    return { rows: rows.slice(), tokens };
  }
  const filtered = rows.filter((row) => {
    const precinct = canonicalToken(row?.precinct_id);
    if (!precinct) return false;
    for (const token of tokens){
      if (precinct === token || precinct.includes(token)) return true;
    }
    return false;
  });
  return { rows: filtered, tokens };
}

function exportBaseName(s){
  const parts = [
    "census-aggregate",
    fileSlugPart(s.resolution) || "resolution",
    fileSlugPart(s.stateFips) || "state",
    fileSlugPart(s.countyFips || s.placeFips) || "area",
    fileStamp(),
  ];
  return parts.filter((x) => !!x).join("-");
}

function resetElectionCsvDryRunRuntime(){
  electionCsvDryRun.fileName = "";
  electionCsvDryRun.fileSize = 0;
  electionCsvDryRun.fileUpdatedAt = "";
  electionCsvDryRun.statusText = "No dry-run run yet.";
  electionCsvDryRun.statusLevel = "muted";
  electionCsvDryRun.format = "";
  electionCsvDryRun.parsedRows = 0;
  electionCsvDryRun.normalizedRows = 0;
  electionCsvDryRun.precinctFilter = "";
  electionCsvDryRun.errors = [];
  electionCsvDryRun.warnings = [];
  electionCsvDryRun.records = [];
}

function setElectionCsvDryRunStatus(text, level = "muted"){
  electionCsvDryRun.statusText = cleanText(text) || "No dry-run run yet.";
  electionCsvDryRun.statusLevel = ["ok", "warn", "bad", "muted"].includes(cleanText(level)) ? cleanText(level) : "muted";
}

function readTextFile(file){
  if (!file) return Promise.reject(new Error("No file selected."));
  if (typeof file.text === "function"){
    return file.text();
  }
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== "function"){
      reject(new Error("FileReader unavailable."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result == null ? "" : reader.result));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

export function renderCensusPhase1Module({ els, state, res } = {}){
  if (!els || !state) return;
  const s = ensureCensusStateModule(state);
  if (!s) return;
  const footprintCapacity = normalizeFootprintCapacity(state.footprintCapacity);
  const alignment = assessRaceFootprintAlignment({
    censusState: s,
    raceFootprint: state.raceFootprint,
    assumptionsProvenance: state.assumptionsProvenance,
  });
  const feasibility = evaluateFootprintFeasibility({ state, res });
  const feasibilitySummary = summarizeFootprintFeasibilityIssues(feasibility.issues);

  const storedKey = readCensusApiKeyModule();
  if (els.censusApiKey && typeof document !== "undefined" && document.activeElement !== els.censusApiKey){
    els.censusApiKey.value = storedKey;
  }

  const yearRows = listAcsYears().map((y) => ({ value: y, label: y }));
  fillSelect(els.censusAcsYear, yearRows, s.year, "Select year");
  fillSelect(els.censusResolution, listResolutionOptions().map((row) => ({ value: row.id, label: row.label })), s.resolution, "Select resolution");
  fillSelect(els.censusMetricSet, listMetricSetOptions().map((row) => ({ value: row.id, label: row.label })), s.metricSet, "Select bundle");

  const stateRows = Array.isArray(stateOptionsCache) ? stateOptionsCache : [];
  fillSelect(els.censusStateFips, buildStateRows(stateRows), s.stateFips, "Select state");

  const countyRows = Array.isArray(countyOptionsCache.get(cleanText(s.stateFips))) ? countyOptionsCache.get(cleanText(s.stateFips)) : [];
  const placeRows = Array.isArray(placeOptionsCache.get(cleanText(s.stateFips))) ? placeOptionsCache.get(cleanText(s.stateFips)) : [];
  fillSelect(els.censusCountyFips, buildSubRows(countyRows), s.countyFips, "Select county");
  fillSelect(els.censusPlaceFips, buildSubRows(placeRows), s.placeFips, "Select place");
  if (els.censusGeoSearch && document.activeElement !== els.censusGeoSearch){
    els.censusGeoSearch.value = s.geoSearch || "";
  }
  const tractRows = s.resolution === "block_group" ? uniqueTractRows(s.geoOptions) : [];
  fillSelect(els.censusTractFilter, tractRows, s.tractFilter, "All tracts");
  if (els.censusSelectionSetName && document.activeElement !== els.censusSelectionSetName){
    els.censusSelectionSetName.value = s.selectionSetDraftName || "";
  }
  const setRows = buildSelectionSetRows(s.selectionSets);
  const selectedSetKey = setRows.some((row) => row.value === cleanText(s.selectedSelectionSetKey)) ? cleanText(s.selectedSelectionSetKey) : "";
  fillSelect(els.censusSelectionSetSelect, setRows, selectedSetKey, "Saved sets");

  if (els.censusCountyFips){
    els.censusCountyFips.disabled = s.resolution === "place" || !s.stateFips;
  }
  if (els.censusPlaceFips){
    els.censusPlaceFips.disabled = !s.stateFips;
  }
  if (els.censusGeoSearch){
    els.censusGeoSearch.disabled = !s.geoOptions.length;
  }
  if (els.censusTractFilter){
    els.censusTractFilter.disabled = s.resolution !== "block_group" || !s.geoOptions.length;
  }

  const filteredGeoOptions = filterGeoOptions(s.geoOptions, {
    search: s.geoSearch,
    tractFilter: s.tractFilter,
  });
  fillMultiSelect(els.censusGeoSelect, filteredGeoOptions, s.selectedGeoids);

  if (els.btnCensusLoadGeo){
    els.btnCensusLoadGeo.disabled = s.loadingGeo || !contextReadyForGeo(s);
  }
  if (els.btnCensusFetchRows){
    els.btnCensusFetchRows.disabled = s.loadingRows || !contextReadyForGeo(s);
  }
  if (els.btnCensusSelectAll){
    els.btnCensusSelectAll.disabled = !filteredGeoOptions.length;
  }
  if (els.btnCensusClearSelection){
    els.btnCensusClearSelection.disabled = !s.selectedGeoids.length;
  }
  if (els.btnCensusSetRaceFootprint){
    els.btnCensusSetRaceFootprint.disabled = !s.selectedGeoids.length || !s.loadedRowCount;
  }
  if (els.btnCensusClearRaceFootprint){
    els.btnCensusClearRaceFootprint.disabled = !alignment.footprintDefined;
  }
  if (els.btnCensusDownloadElectionCsvTemplate){
    els.btnCensusDownloadElectionCsvTemplate.disabled = false;
  }
  if (els.btnCensusDownloadElectionCsvWideTemplate){
    els.btnCensusDownloadElectionCsvWideTemplate.disabled = false;
  }
  if (els.btnCensusElectionCsvDryRun){
    const hasFile = !!(els.censusElectionCsvFile && els.censusElectionCsvFile.files && els.censusElectionCsvFile.files.length);
    els.btnCensusElectionCsvDryRun.disabled = !hasFile;
  }
  if (els.btnCensusElectionCsvClear){
    const hasPreview = !!(
      electionCsvDryRun.fileName ||
      electionCsvDryRun.records.length ||
      electionCsvDryRun.errors.length ||
      electionCsvDryRun.warnings.length ||
      cleanText(electionCsvDryRun.precinctFilter)
    );
    els.btnCensusElectionCsvClear.disabled = !hasPreview;
  }
  if (els.censusElectionCsvPrecinctFilter && document.activeElement !== els.censusElectionCsvPrecinctFilter){
    els.censusElectionCsvPrecinctFilter.value = cleanText(electionCsvDryRun.precinctFilter);
  }
  if (els.btnCensusApplyGeoPaste){
    els.btnCensusApplyGeoPaste.disabled = !s.geoOptions.length;
  }
  if (els.btnCensusSaveSelectionSet){
    els.btnCensusSaveSelectionSet.disabled = !s.selectedGeoids.length || !cleanText(s.selectionSetDraftName);
  }
  if (els.btnCensusLoadSelectionSet){
    els.btnCensusLoadSelectionSet.disabled = !selectedSetKey || !s.geoOptions.length;
  }
  if (els.btnCensusDeleteSelectionSet){
    els.btnCensusDeleteSelectionSet.disabled = !selectedSetKey;
  }
  if (els.btnCensusLoadMap){
    els.btnCensusLoadMap.disabled = mapRuntimeStatus.loading || mapRuntimeStatus.qaLoading || !s.selectedGeoids.length;
  }
  if (els.btnCensusClearMap){
    els.btnCensusClearMap.disabled = mapRuntimeStatus.loading || mapRuntimeStatus.qaLoading || (!mapRuntimeStatus.featureCount && !mapRuntimeStatus.qaFeatureCount);
  }
  if (els.censusMapQaVtdToggle){
    els.censusMapQaVtdToggle.checked = !!s.mapQaVtdOverlay;
    els.censusMapQaVtdToggle.disabled = mapRuntimeStatus.loading || mapRuntimeStatus.qaLoading;
  }

  const { runtimeRows, tableRows } = aggregateSnapshot(s);
  if (els.btnCensusExportAggregateCsv){
    els.btnCensusExportAggregateCsv.disabled = !tableRows.length || !s.selectedGeoids.length;
  }
  if (els.btnCensusExportAggregateJson){
    els.btnCensusExportAggregateJson.disabled = !tableRows.length || !s.selectedGeoids.length;
  }

  if (
    els.censusAggregateTbody &&
    typeof els.censusAggregateTbody.appendChild === "function" &&
    "innerHTML" in els.censusAggregateTbody &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ){
    els.censusAggregateTbody.innerHTML = "";
    if (!tableRows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted" colspan="2">No ACS rows loaded.</td>';
      els.censusAggregateTbody.appendChild(tr);
    } else {
      for (const row of tableRows){
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${row.label}</td><td class="num">${row.valueText}</td>`;
        els.censusAggregateTbody.appendChild(tr);
      }
    }
  }

  if (els.censusStatus){
    els.censusStatus.classList.remove("ok", "warn", "bad", "muted");
    if (s.error){
      els.censusStatus.classList.add("bad");
    } else if (s.loadingGeo || s.loadingRows){
      els.censusStatus.classList.add("warn");
    } else {
      els.censusStatus.classList.add("muted");
    }
    els.censusStatus.textContent = s.status || "Ready.";
  }

  if (els.censusGeoStats){
    const totalGeo = s.geoOptions.length;
    const visibleGeo = filteredGeoOptions.length;
    const selectedGeo = s.selectedGeoids.length;
    const loadedRows = rowsCount(runtimeRows);
    els.censusGeoStats.textContent = `${selectedGeo} selected. ${visibleGeo}/${totalGeo} visible GEOs. ${loadedRows} rows loaded.`;
  }

  if (els.censusSelectionSummary){
    const summary = s.selectedGeoids.length > 0
      ? `Aggregate reflects ${s.selectedGeoids.length} selected GEO units.`
      : "No GEO selected. Select one or more GEO units to aggregate.";
    els.censusSelectionSummary.textContent = summary;
  }

  if (els.censusRaceFootprintStatus){
    const storedFootprint = alignment.stored;
    if (!alignment.footprintDefined){
      els.censusRaceFootprintStatus.textContent = "Race footprint not set.";
    } else {
      const area = storedFootprint.resolution === "place"
        ? `state ${storedFootprint.stateFips} place ${storedFootprint.placeFips}`
        : `state ${storedFootprint.stateFips} county ${storedFootprint.countyFips}`;
      const match = alignment.selectionMatches
        ? "Current selection matches."
        : "Current selection differs.";
      els.censusRaceFootprintStatus.textContent = `Race footprint: ${storedFootprint.geoids.length} GEOs (${storedFootprint.resolution}) in ${area}. ${match}`;
    }
  }

  if (els.censusAssumptionProvenanceStatus){
    const provenance = alignment.provenance;
    if (alignment.reason === "footprint_not_set"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance not set.";
    } else if (alignment.reason === "selection_context_missing"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance blocked: load ACS rows for the active year and bundle.";
    } else if (alignment.reason === "selection_mismatch"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance blocked: current selection differs from saved race footprint.";
    } else if (!provenance.raceFootprintFingerprint){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance not set.";
    } else if (alignment.reason === "provenance_rows_not_set"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance is stale: ACS rows key missing.";
    } else if (alignment.reason === "provenance_year_not_set"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance is stale: ACS year missing.";
    } else if (alignment.reason === "provenance_metric_set_not_set"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance is stale: metric bundle missing.";
    } else if (alignment.reason === "provenance_footprint_mismatch"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance is stale: footprint mismatch.";
    } else if (alignment.reason === "provenance_rows_mismatch"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance is stale: ACS row context changed.";
    } else if (alignment.reason === "provenance_year_mismatch"){
      els.censusAssumptionProvenanceStatus.textContent = `Assumption provenance is stale: ACS year mismatch (provenance ${provenance.acsYear || "—"}, active ${cleanText(s.year) || "—"}).`;
    } else if (alignment.reason === "provenance_metric_set_mismatch"){
      els.censusAssumptionProvenanceStatus.textContent = `Assumption provenance is stale: metric bundle mismatch (provenance ${provenance.metricSet || "—"}, active ${cleanText(s.metricSet) || "—"}).`;
    } else {
      els.censusAssumptionProvenanceStatus.textContent = provenance.generatedAt
        ? `Assumption provenance aligned with race footprint (generated ${fmtTs(provenance.generatedAt).replace("Last fetch: ", "")}).`
        : `Assumption provenance aligned with race footprint (ACS ${provenance.acsYear || "—"}, bundle ${provenance.metricSet || "—"}).`;
    }
  }

  if (els.censusFootprintCapacityStatus){
    els.censusFootprintCapacityStatus.classList.remove("ok", "warn", "bad", "muted");
    let tone = "muted";
    let text = "";
    if (!alignment.footprintDefined){
      tone = "muted";
      text = "Footprint capacity: not set.";
    } else if (!Number.isFinite(Number(footprintCapacity.population))){
      tone = "warn";
      text = "Footprint capacity: population unavailable. Re-set race footprint after ACS fetch.";
    } else {
      const stale = (
        (footprintCapacity.raceFootprintFingerprint && footprintCapacity.raceFootprintFingerprint !== alignment.stored.fingerprint) ||
        (footprintCapacity.censusRowsKey && footprintCapacity.censusRowsKey !== cleanText(s.activeRowsKey)) ||
        (footprintCapacity.year && footprintCapacity.year !== cleanText(s.year)) ||
        (footprintCapacity.metricSet && footprintCapacity.metricSet !== cleanText(s.metricSet))
      );
      if (stale){
        tone = "warn";
        text = `Footprint capacity population: ${Math.round(Number(footprintCapacity.population)).toLocaleString("en-US")} (ACS ${footprintCapacity.year || "—"}, bundle ${footprintCapacity.metricSet || "—"}, stale).`;
      } else {
        tone = "ok";
        text = `Footprint capacity population: ${Math.round(Number(footprintCapacity.population)).toLocaleString("en-US")} (ACS ${footprintCapacity.year || "—"}, bundle ${footprintCapacity.metricSet || "—"}).`;
      }
    }
    if (feasibilitySummary.level === "bad"){
      tone = "bad";
      if (feasibilitySummary.text && !text.includes(feasibilitySummary.text)){
        text = `${text} Blocked: ${feasibilitySummary.text}`;
      }
    } else if (feasibilitySummary.level === "warn"){
      if (tone !== "bad"){
        tone = tone === "ok" ? "warn" : tone;
      }
      if (feasibilitySummary.text && !text.includes(feasibilitySummary.text)){
        text = `${text} Warning: ${feasibilitySummary.text}`;
      }
    }
    if (!text){
      text = "Footprint feasibility checks clear.";
      tone = "ok";
    }
    els.censusFootprintCapacityStatus.classList.add(tone);
    els.censusFootprintCapacityStatus.textContent = text;
  }

  if (els.censusElectionCsvGuideStatus){
    const guide = getElectionCsvUploadGuide();
    const formatCount = Array.isArray(guide.acceptedFormats) ? guide.acceptedFormats.length : 1;
    els.censusElectionCsvGuideStatus.textContent = `Election CSV schema ${guide.schemaVersion}: ${formatCount} supported format(s) (long and wide).`;
  }

  if (els.censusElectionCsvDryRunStatus){
    els.censusElectionCsvDryRunStatus.classList.remove("ok", "warn", "bad", "muted");
    els.censusElectionCsvDryRunStatus.classList.add(electionCsvDryRun.statusLevel || "muted");
    els.censusElectionCsvDryRunStatus.textContent = electionCsvDryRun.statusText || "No dry-run run yet.";
  }

  if (els.censusElectionCsvPreviewMeta){
    const allRecords = Array.isArray(electionCsvDryRun.records) ? electionCsvDryRun.records : [];
    const filtered = filterElectionDryRunRecords(allRecords, electionCsvDryRun.precinctFilter);
    const filteredCount = filtered.rows.length;
    const formatLabel = cleanText(electionCsvDryRun.format) || "—";
    const fileLabel = cleanText(electionCsvDryRun.fileName) || "none";
    const parseCount = Number.isFinite(Number(electionCsvDryRun.parsedRows)) ? Math.max(0, Math.floor(Number(electionCsvDryRun.parsedRows))) : 0;
    const normalizedCount = Number.isFinite(Number(electionCsvDryRun.normalizedRows)) ? Math.max(0, Math.floor(Number(electionCsvDryRun.normalizedRows))) : 0;
    const errCount = Array.isArray(electionCsvDryRun.errors) ? electionCsvDryRun.errors.length : 0;
    const warnCount = Array.isArray(electionCsvDryRun.warnings) ? electionCsvDryRun.warnings.length : 0;
    const filterLabel = cleanText(electionCsvDryRun.precinctFilter);
    const filterText = filterLabel ? ` · Precinct filter: ${filterLabel} (${filteredCount.toLocaleString("en-US")} match)` : "";
    els.censusElectionCsvPreviewMeta.textContent = `File: ${fileLabel} · Format: ${formatLabel} · Parsed rows: ${parseCount.toLocaleString("en-US")} · Normalized rows: ${normalizedCount.toLocaleString("en-US")} · Errors: ${errCount} · Warnings: ${warnCount}${filterText}`;
  }

  if (
    els.censusElectionCsvPreviewTbody &&
    typeof els.censusElectionCsvPreviewTbody.appendChild === "function" &&
    "innerHTML" in els.censusElectionCsvPreviewTbody &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ){
    const allRecords = Array.isArray(electionCsvDryRun.records) ? electionCsvDryRun.records : [];
    const filtered = filterElectionDryRunRecords(allRecords, electionCsvDryRun.precinctFilter);
    const previewRows = filtered.rows.slice(0, 50);
    els.censusElectionCsvPreviewTbody.innerHTML = "";
    if (!previewRows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = filtered.tokens.length
        ? '<td class="muted" colspan="4">No rows match the current precinct filter.</td>'
        : '<td class="muted" colspan="4">No dry-run preview yet.</td>';
      els.censusElectionCsvPreviewTbody.appendChild(tr);
    } else {
      for (const row of previewRows){
        const tr = document.createElement("tr");
        const precinct = cleanText(row?.precinct_id) || "—";
        const candidate = cleanText(row?.candidate) || "—";
        const votes = Number.isFinite(Number(row?.votes)) ? Math.round(Number(row.votes)).toLocaleString("en-US") : "—";
        const total = Number.isFinite(Number(row?.total_votes_precinct)) ? Math.round(Number(row.total_votes_precinct)).toLocaleString("en-US") : "—";
        tr.innerHTML = `<td>${precinct}</td><td>${candidate}</td><td class="num">${votes}</td><td class="num">${total}</td>`;
        els.censusElectionCsvPreviewTbody.appendChild(tr);
      }
    }
  }

  if (els.censusSelectionSetStatus){
    const setCount = Array.isArray(s.selectionSets) ? s.selectionSets.length : 0;
    if (!setCount){
      els.censusSelectionSetStatus.textContent = "No saved selection sets.";
    } else {
      const matchCount = (s.selectionSets || []).filter((row) => setRowContextFingerprint(row) === contextFingerprint(s)).length;
      els.censusSelectionSetStatus.textContent = `${setCount} saved set${setCount === 1 ? "" : "s"}. ${matchCount} match current context.`;
    }
  }

  if (els.censusLastFetch){
    els.censusLastFetch.textContent = fmtTs(s.lastFetchAt);
  }

  if (els.censusMapStatus){
    els.censusMapStatus.classList.remove("ok", "warn", "bad", "muted");
    if (mapRuntimeStatus.error){
      els.censusMapStatus.classList.add("bad");
    } else if (mapRuntimeStatus.loading || mapRuntimeStatus.qaLoading){
      els.censusMapStatus.classList.add("warn");
    } else if (cleanText(mapRuntimeStatus.qaText).toLowerCase().includes("unavailable")){
      els.censusMapStatus.classList.add("warn");
    } else {
      els.censusMapStatus.classList.add("muted");
    }
    const selectedKey = mapSelectionKey(s);
    const qaText = cleanText(mapRuntimeStatus.qaText);
    if (!mapRuntimeStatus.loading && mapLoadedSelectionKey && selectedKey !== mapLoadedSelectionKey && !mapRuntimeStatus.error){
      const base = "Selection changed. Reload boundaries to refresh map.";
      els.censusMapStatus.textContent = qaText ? `${base} ${qaText}` : base;
    } else {
      const base = mapRuntimeStatus.error || mapRuntimeStatus.text;
      els.censusMapStatus.textContent = qaText ? `${base} ${qaText}` : base;
    }
  }

  if (els.censusMap && mapInstance && mapHost === els.censusMap && typeof mapInstance.invalidateSize === "function"){
    mapInstance.invalidateSize(false);
  }
}

async function loadStateScopedLists(s, key){
  if (!s.stateFips) return;
  await Promise.all([
    ensureCountyOptions(s.stateFips, key),
    ensurePlaceOptions(s.stateFips, key),
  ]);
}

async function onLoadGeo({ s, key, getState, commitUIUpdate }){
  if (!contextReadyForGeo(s)){
    setStatus(s, `Select required geography context for ${s.resolution}.`, true);
    commitUIUpdate();
    return;
  }
  const seq = nextSeq(s);
  setLoadingFlags(s, "geo", true);
  setStatus(s, `Loading GEO list for ${contextText(s)} (${s.resolution})...`, false);
  commitUIUpdate({ persist: false });
  try{
    const options = await fetchGeoOptions({
      year: s.year,
      resolution: s.resolution,
      stateFips: s.stateFips,
      countyFips: s.countyFips,
      key,
    });
    const current = ensureCensusStateModule(getState());
    if (!current || current.requestSeq !== seq) return;
    current.geoOptions = options;
    const tractRows = current.resolution === "block_group" ? uniqueTractRows(current.geoOptions) : [];
    if (current.resolution !== "block_group" || !tractRows.some((row) => cleanText(row.value) === cleanText(current.tractFilter))){
      current.tractFilter = "";
    }
    if (current.resolution === "place" && current.placeFips){
      const preferred = placeGeoid(current.stateFips, current.placeFips);
      current.selectedGeoids = options.some((row) => cleanText(row.geoid) === preferred) ? [preferred] : [];
    } else {
      current.selectedGeoids = [];
    }
    if (!current.selectedGeoids.length){
      current.selectedGeoids = options.slice(0, Math.min(options.length, 25)).map((row) => row.geoid);
    }
    current.rowsByGeoid = {};
    current.activeRowsKey = "";
    current.loadedRowCount = 0;
    current.lastFetchAt = "";
    setStatus(current, `${options.length} GEO options loaded for ${current.resolution}.`, false);
  } catch (err){
    const current = ensureCensusStateModule(getState());
    if (!current || current.requestSeq !== seq) return;
    const msg = cleanText(err?.message) || "Failed to load GEO list.";
    resetGeoData(current);
    setStatus(current, msg, true);
  }
  const finalState = ensureCensusStateModule(getState());
  if (finalState && finalState.requestSeq === seq){
    setLoadingFlags(finalState, "geo", false);
  }
  commitUIUpdate();
}

async function onFetchRows({ s, key, getState, commitUIUpdate }){
  if (!contextReadyForGeo(s)){
    setStatus(s, `Select required geography context for ${s.resolution}.`, true);
    commitUIUpdate();
    return;
  }
  const seq = nextSeq(s);
  setLoadingFlags(s, "rows", true);
  setStatus(s, `Fetching ACS rows for ${contextText(s)} (${s.resolution}, ${s.year})...`, false);
  commitUIUpdate({ persist: false });
  try{
    let variableNames = variableCatalogCache.get(s.year);
    if (!Array.isArray(variableNames)){
      variableNames = await fetchVariableCatalog({ year: s.year, key });
      variableCatalogCache.set(s.year, variableNames);
    }
    const check = validateMetricSetWithCatalog(s.metricSet, variableNames);
    const currentBeforeRows = ensureCensusStateModule(getState());
    if (!currentBeforeRows || currentBeforeRows.requestSeq !== seq) return;
    currentBeforeRows.variableCatalogYear = s.year;
    currentBeforeRows.variableCatalogCount = Array.isArray(variableNames) ? variableNames.length : 0;
    if (!check.ok){
      setStatus(currentBeforeRows, `Selected bundle has missing ACS variables for year ${s.year}: ${check.missing.join(", ")}`, true);
      setLoadingFlags(currentBeforeRows, "rows", false);
      commitUIUpdate();
      return;
    }
    const rowsByGeoid = await fetchAcsRows({
      year: s.year,
      resolution: s.resolution,
      stateFips: s.stateFips,
      countyFips: s.countyFips,
      metricSet: s.metricSet,
      key,
    });
    const current = ensureCensusStateModule(getState());
    if (!current || current.requestSeq !== seq) return;
    const rowsKey = rowsKeyFromState(current);
    rowsCache.set(rowsKey, rowsByGeoid);
    current.rowsByGeoid = {};
    current.activeRowsKey = rowsKey;
    current.loadedRowCount = Object.keys(rowsByGeoid).length;
    const availableGeoids = new Set(Object.keys(rowsByGeoid));
    current.geoOptions = current.geoOptions.filter((row) => availableGeoids.has(cleanText(row.geoid)));
    if (!current.geoOptions.length){
      current.geoOptions = Object.values(rowsByGeoid)
        .map((row) => ({ geoid: cleanText(row.geoid), label: cleanText(row.label || row.name || row.geoid), name: cleanText(row.name) }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    const filtered = current.selectedGeoids.filter((geoid) => availableGeoids.has(cleanText(geoid)));
    current.selectedGeoids = filtered.length
      ? filtered
      : current.geoOptions.slice(0, Math.min(current.geoOptions.length, 25)).map((row) => cleanText(row.geoid));
    current.lastFetchAt = new Date().toISOString();
    setStatus(current, `Loaded ${current.loadedRowCount} ACS rows for ${current.resolution}.`, false);
  } catch (err){
    const current = ensureCensusStateModule(getState());
    if (!current || current.requestSeq !== seq) return;
    const msg = cleanText(err?.message) || "Failed to fetch ACS rows.";
    current.rowsByGeoid = {};
    current.activeRowsKey = "";
    current.loadedRowCount = 0;
    current.lastFetchAt = "";
    setStatus(current, msg, true);
  }
  const finalState = ensureCensusStateModule(getState());
  if (finalState && finalState.requestSeq === seq){
    setLoadingFlags(finalState, "rows", false);
  }
  commitUIUpdate();
}

export function wireCensusPhase1EventsModule(ctx){
  const { els, state: initialState, getState, commitUIUpdate } = ctx || {};
  const currentState = () => {
    if (typeof getState === "function"){
      const s = getState();
      return (s && typeof s === "object") ? s : null;
    }
    return (initialState && typeof initialState === "object") ? initialState : null;
  };
  if (!els || !currentState() || typeof commitUIUpdate !== "function") return;

  const withState = (fn) => {
    const state = currentState();
    if (!state) return;
    const s = ensureCensusStateModule(state);
    if (!s) return;
    fn(state, s);
  };

  if (els.censusApiKey){
    els.censusApiKey.addEventListener("change", async () => {
      const key = cleanText(els.censusApiKey.value);
      writeCensusApiKeyModule(key);
      withState((_, s) => {
        setStatus(s, "Census API key saved. Loading geography lookups...", false);
      });
      commitUIUpdate({ persist: false });
      const s = ensureCensusStateModule(currentState());
      if (!s) return;
      try{
        await ensureStateOptions(key);
        if (s.stateFips){
          await loadStateScopedLists(s, key);
        }
        const latest = ensureCensusStateModule(currentState());
        if (!latest) return;
        setStatus(latest, latest.stateFips ? "Census module ready." : "State list loaded. Select state and geography, then load GEO list.", false);
      } catch (err){
        const latest = ensureCensusStateModule(currentState());
        if (!latest) return;
        setStatus(latest, cleanText(err?.message) || "Failed to load geography lookups.", true);
      }
      commitUIUpdate({ persist: false });
    });
  }

  if (els.censusAcsYear){
    els.censusAcsYear.addEventListener("change", () => {
      withState((_, s) => {
        s.year = cleanText(els.censusAcsYear.value);
        s.rowsByGeoid = {};
        s.activeRowsKey = "";
        s.loadedRowCount = 0;
        s.lastFetchAt = "";
        s.variableCatalogYear = "";
        s.variableCatalogCount = 0;
        setStatus(s, `ACS year set to ${s.year}. Cached rows cleared; footprint/provenance now stale until refetch.`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.censusMetricSet){
    els.censusMetricSet.addEventListener("change", () => {
      withState((_, s) => {
        s.metricSet = cleanText(els.censusMetricSet.value) || "core";
        s.rowsByGeoid = {};
        s.activeRowsKey = "";
        s.loadedRowCount = 0;
        s.lastFetchAt = "";
        s.variableCatalogYear = "";
        s.variableCatalogCount = 0;
        setStatus(s, "Bundle changed. Cached rows cleared; footprint/provenance now stale until refetch.", false);
      });
      commitUIUpdate();
    });
  }

  if (els.censusResolution){
    els.censusResolution.addEventListener("change", () => {
      withState((_, s) => {
        s.resolution = cleanText(els.censusResolution.value) || "tract";
        s.countyFips = s.resolution === "place" ? "" : s.countyFips;
        resetGeoData(s);
        setStatus(s, `Resolution set to ${s.resolution}. Load GEO list next.`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.censusStateFips){
    els.censusStateFips.addEventListener("change", async () => {
      const key = cleanText(els.censusApiKey?.value) || readCensusApiKeyModule();
      withState((_, s) => {
        s.stateFips = cleanText(els.censusStateFips.value);
        s.countyFips = "";
        s.placeFips = "";
        resetGeoData(s);
        setStatus(s, s.stateFips ? "Loading county/place lists..." : "Select a state to continue.", false);
      });
      commitUIUpdate({ persist: false });
      const s = ensureCensusStateModule(currentState());
      if (!s || !s.stateFips) return;
      try{
        await ensureStateOptions(key);
        await loadStateScopedLists(s, key);
        const latest = ensureCensusStateModule(currentState());
        if (!latest || !latest.stateFips) return;
        setStatus(latest, "County/place lists loaded. Choose geography context and load GEO list.", false);
      } catch (err){
        const latest = ensureCensusStateModule(currentState());
        if (!latest) return;
        setStatus(latest, cleanText(err?.message) || "Failed to load county/place lists.", true);
      }
      commitUIUpdate();
    });
  }

  if (els.censusCountyFips){
    els.censusCountyFips.addEventListener("change", () => {
      withState((_, s) => {
        s.countyFips = cleanText(els.censusCountyFips.value);
        resetGeoData(s);
        setStatus(s, s.countyFips ? "County set. Load GEO list next." : "Select county to continue.", false);
      });
      commitUIUpdate();
    });
  }

  if (els.censusPlaceFips){
    els.censusPlaceFips.addEventListener("change", () => {
      withState((_, s) => {
        s.placeFips = cleanText(els.censusPlaceFips.value);
        if (s.resolution === "place" && s.geoOptions.length){
          const selected = placeGeoid(s.stateFips, s.placeFips);
          s.selectedGeoids = selected ? [selected] : [];
          setStatus(s, s.placeFips ? "Place set. Selection updated." : "Select place to continue.", false);
        } else if (s.resolution === "place"){
          resetGeoData(s);
          setStatus(s, s.placeFips ? "Place set. Load GEO list next." : "Select place to continue.", false);
        } else {
          setStatus(s, s.placeFips ? "Place selected. Tract/block fetch still uses county." : "Place cleared.", false);
        }
      });
      commitUIUpdate();
    });
  }

  if (els.censusGeoSearch){
    els.censusGeoSearch.addEventListener("input", () => {
      withState((_, s) => {
        s.geoSearch = cleanText(els.censusGeoSearch.value);
        setStatus(s, "Search filter updated.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.censusTractFilter){
    els.censusTractFilter.addEventListener("change", () => {
      withState((_, s) => {
        s.tractFilter = cleanText(els.censusTractFilter.value);
        setStatus(s, s.tractFilter ? `Tract filter set to ${s.tractFilter}.` : "Tract filter cleared.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.censusSelectionSetName){
    els.censusSelectionSetName.addEventListener("input", () => {
      withState((_, s) => {
        s.selectionSetDraftName = cleanText(els.censusSelectionSetName.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.censusSelectionSetSelect){
    els.censusSelectionSetSelect.addEventListener("change", () => {
      withState((_, s) => {
        s.selectedSelectionSetKey = cleanText(els.censusSelectionSetSelect.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnCensusLoadGeo){
    els.btnCensusLoadGeo.addEventListener("click", async () => {
      const key = cleanText(els.censusApiKey?.value) || readCensusApiKeyModule();
      if (!key){
        withState((_, s) => {
          setStatus(s, "Enter Census API key first.", true);
        });
        commitUIUpdate();
        return;
      }
      let s = ensureCensusStateModule(currentState());
      if (!s) return;
      try{
        await ensureStateOptions(key);
        await loadStateScopedLists(s, key);
      } catch (err){
        s = ensureCensusStateModule(currentState());
        if (s){
          setStatus(s, cleanText(err?.message) || "Failed to refresh state lookups.", true);
          commitUIUpdate();
        }
        return;
      }
      s = ensureCensusStateModule(currentState());
      if (!s) return;
      await onLoadGeo({ s, key, getState: currentState, commitUIUpdate });
    });
  }

  if (els.btnCensusFetchRows){
    els.btnCensusFetchRows.addEventListener("click", async () => {
      const key = cleanText(els.censusApiKey?.value) || readCensusApiKeyModule();
      if (!key){
        withState((_, s) => {
          setStatus(s, "Enter Census API key first.", true);
        });
        commitUIUpdate();
        return;
      }
      const s = ensureCensusStateModule(currentState());
      if (!s) return;
      await onFetchRows({ s, key, getState: currentState, commitUIUpdate });
    });
  }

  if (els.censusGeoSelect){
    els.censusGeoSelect.addEventListener("change", () => {
      withState((_, s) => {
        s.selectedGeoids = selectionFromMultiSelect(els.censusGeoSelect);
        setStatus(s, "Selection updated.", false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusSelectAll){
    els.btnCensusSelectAll.addEventListener("click", () => {
      withState((_, s) => {
        const filteredGeoOptions = filterGeoOptions(s.geoOptions, {
          search: s.geoSearch,
          tractFilter: s.tractFilter,
        });
        s.selectedGeoids = filteredGeoOptions.map((row) => cleanText(row.geoid));
        setStatus(s, `Selected ${s.selectedGeoids.length} GEO units.`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusClearSelection){
    els.btnCensusClearSelection.addEventListener("click", () => {
      withState((_, s) => {
        s.selectedGeoids = [];
        setStatus(s, "Selection cleared.", false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusSetRaceFootprint){
    els.btnCensusSetRaceFootprint.addEventListener("click", () => {
      withState((state, s) => {
        const footprint = liveRaceFootprintFromCensusState(s, { updatedAt: new Date().toISOString() });
        if (!footprint.geoids.length){
          setStatus(s, "Select one or more GEO units before setting race footprint.", true);
          return;
        }
        if (!footprint.rowCount || !footprint.rowsKey){
          setStatus(s, "Fetch ACS rows before setting race footprint.", true);
          return;
        }
        state.raceFootprint = footprint;
        const runtimeRows = getRowsForState(s);
        const population = selectedPopulationFromRows(runtimeRows, footprint.geoids);
        state.footprintCapacity = normalizeFootprintCapacity({
          source: "census_phase1",
          population,
          year: cleanText(s.year),
          metricSet: cleanText(s.metricSet),
          raceFootprintFingerprint: footprint.fingerprint,
          censusRowsKey: footprint.rowsKey,
          updatedAt: new Date().toISOString(),
        });
        const provenance = ensureAssumptionProvenance(state);
        provenance.source = "census_phase1";
        provenance.raceFootprintFingerprint = footprint.fingerprint;
        provenance.censusRowsKey = footprint.rowsKey;
        provenance.acsYear = cleanText(s.year);
        provenance.metricSet = cleanText(s.metricSet);
        provenance.generatedAt = "";
        if (Number.isFinite(Number(population))){
          setStatus(s, `Race footprint set (${footprint.geoids.length} GEOs, pop ${Math.round(Number(population)).toLocaleString("en-US")}).`, false);
        } else {
          setStatus(s, `Race footprint set (${footprint.geoids.length} GEOs). Population unavailable for current ACS rows.`, false);
        }
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusClearRaceFootprint){
    els.btnCensusClearRaceFootprint.addEventListener("click", () => {
      withState((state, s) => {
        state.raceFootprint = makeDefaultRaceFootprint();
        state.assumptionsProvenance = makeDefaultAssumptionProvenance();
        state.footprintCapacity = makeDefaultFootprintCapacity();
        setStatus(s, "Race footprint cleared.", false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusDownloadElectionCsvTemplate){
    els.btnCensusDownloadElectionCsvTemplate.addEventListener("click", () => {
      withState((_, s) => {
        const csv = buildElectionCsvTemplate();
        const ok = downloadTextFile(csv, `election-results-template-${fileStamp()}.csv`, "text/csv");
        setStatus(s, ok ? "Election CSV template downloaded." : "Election CSV template download failed.", !ok);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnCensusDownloadElectionCsvWideTemplate){
    els.btnCensusDownloadElectionCsvWideTemplate.addEventListener("click", () => {
      withState((_, s) => {
        const csv = buildElectionCsvWideTemplate();
        const ok = downloadTextFile(csv, `election-results-wide-template-${fileStamp()}.csv`, "text/csv");
        setStatus(s, ok ? "Election wide-format CSV template downloaded." : "Election wide-format CSV template download failed.", !ok);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.censusElectionCsvFile){
    els.censusElectionCsvFile.addEventListener("change", () => {
      const file = els.censusElectionCsvFile?.files?.[0];
      if (!file){
        resetElectionCsvDryRunRuntime();
        commitUIUpdate({ persist: false });
        return;
      }
      electionCsvDryRun.fileName = cleanText(file.name);
      electionCsvDryRun.fileSize = Number.isFinite(Number(file.size)) ? Math.max(0, Number(file.size)) : 0;
      electionCsvDryRun.fileUpdatedAt = new Date().toISOString();
      electionCsvDryRun.format = "";
      electionCsvDryRun.parsedRows = 0;
      electionCsvDryRun.normalizedRows = 0;
      electionCsvDryRun.errors = [];
      electionCsvDryRun.warnings = [];
      electionCsvDryRun.records = [];
      setElectionCsvDryRunStatus(`Selected file ${electionCsvDryRun.fileName} (${Math.round(electionCsvDryRun.fileSize / 1024).toLocaleString("en-US")} KB).`, "muted");
      commitUIUpdate({ persist: false });
    });
  }

  if (els.censusElectionCsvPrecinctFilter){
    els.censusElectionCsvPrecinctFilter.addEventListener("input", () => {
      electionCsvDryRun.precinctFilter = cleanText(els.censusElectionCsvPrecinctFilter.value);
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnCensusElectionCsvDryRun){
    els.btnCensusElectionCsvDryRun.addEventListener("click", async () => {
      const seq = ++electionCsvRequestSeq;
      const file = els.censusElectionCsvFile?.files?.[0];
      const state = currentState();
      const s = ensureCensusStateModule(state);
      if (!file || !s){
        setElectionCsvDryRunStatus("Select an election CSV file first.", "warn");
        commitUIUpdate({ persist: false });
        return;
      }
      setElectionCsvDryRunStatus(`Running dry-run parse for ${cleanText(file.name)}...`, "warn");
      commitUIUpdate({ persist: false });
      try{
        const text = await readTextFile(file);
        if (seq !== electionCsvRequestSeq) return;
        const parsed = parseCsvText(text, { maxRows: 500000 });
        electionCsvDryRun.fileName = cleanText(file.name);
        electionCsvDryRun.fileSize = Number.isFinite(Number(file.size)) ? Math.max(0, Number(file.size)) : 0;
        electionCsvDryRun.fileUpdatedAt = new Date().toISOString();
        electionCsvDryRun.parsedRows = Array.isArray(parsed.rows) ? parsed.rows.length : 0;
        if (!parsed.ok){
          electionCsvDryRun.format = "";
          electionCsvDryRun.normalizedRows = 0;
          electionCsvDryRun.records = [];
          electionCsvDryRun.errors = Array.isArray(parsed.errors) ? parsed.errors.slice(0, 200) : [];
          electionCsvDryRun.warnings = Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 200) : [];
          const first = cleanText(electionCsvDryRun.errors[0]) || "parse failed.";
          setElectionCsvDryRunStatus(`Dry-run failed: ${first}`, "bad");
          commitUIUpdate({ persist: false });
          return;
        }
        const normalized = normalizeElectionCsvRows(parsed.rows, {
          headers: parsed.headers,
          context: {
            state_fips: cleanText(s.stateFips),
            county_fips: cleanText(s.countyFips),
            election_date: cleanText(state?.electionDate),
          },
        });
        if (seq !== electionCsvRequestSeq) return;
        electionCsvDryRun.format = cleanText(normalized.format) || "invalid";
        electionCsvDryRun.records = Array.isArray(normalized.records) ? normalized.records.slice() : [];
        electionCsvDryRun.normalizedRows = electionCsvDryRun.records.length;
        electionCsvDryRun.errors = Array.isArray(normalized.errors) ? normalized.errors.slice(0, 200) : [];
        electionCsvDryRun.warnings = Array.isArray(normalized.warnings) ? normalized.warnings.slice(0, 200) : [];
        if (!normalized.ok){
          const first = cleanText(electionCsvDryRun.errors[0]) || "validation failed.";
          setElectionCsvDryRunStatus(`Dry-run failed (${electionCsvDryRun.format || "invalid"}): ${first}`, "bad");
          commitUIUpdate({ persist: false });
          return;
        }
        if (electionCsvDryRun.warnings.length){
          setElectionCsvDryRunStatus(`Dry-run parsed ${electionCsvDryRun.normalizedRows.toLocaleString("en-US")} normalized candidate rows (${electionCsvDryRun.format} format) with ${electionCsvDryRun.warnings.length} warning(s).`, "warn");
        } else {
          setElectionCsvDryRunStatus(`Dry-run parsed ${electionCsvDryRun.normalizedRows.toLocaleString("en-US")} normalized candidate rows (${electionCsvDryRun.format} format).`, "ok");
        }
      } catch (err){
        if (seq !== electionCsvRequestSeq) return;
        electionCsvDryRun.records = [];
        electionCsvDryRun.normalizedRows = 0;
        electionCsvDryRun.errors = [cleanText(err?.message) || "Dry-run failed."];
        setElectionCsvDryRunStatus(electionCsvDryRun.errors[0], "bad");
      }
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnCensusElectionCsvClear){
    els.btnCensusElectionCsvClear.addEventListener("click", () => {
      resetElectionCsvDryRunRuntime();
      if (els.censusElectionCsvFile) els.censusElectionCsvFile.value = "";
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnCensusApplyGeoPaste){
    els.btnCensusApplyGeoPaste.addEventListener("click", () => {
      withState((_, s) => {
        const parsed = parseGeoidInput(els.censusGeoPaste?.value, s.resolution);
        if (!parsed.length){
          setStatus(s, "No valid GEOIDs detected in paste input.", true);
          return;
        }
        const available = new Set((s.geoOptions || []).map((row) => cleanText(row.geoid)));
        const matched = parsed.filter((id) => available.has(id));
        if (!matched.length){
          setStatus(s, "Pasted GEOIDs did not match loaded GEO list.", true);
          return;
        }
        s.selectedGeoids = matched;
        const unmatched = parsed.length - matched.length;
        setStatus(s, unmatched > 0
          ? `Applied GEOIDs: ${matched.length} matched, ${unmatched} unmatched.`
          : `Applied GEOIDs: ${matched.length} matched.`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusSaveSelectionSet){
    els.btnCensusSaveSelectionSet.addEventListener("click", () => {
      withState((_, s) => {
        const name = cleanText(s.selectionSetDraftName || els.censusSelectionSetName?.value);
        const geoids = uniqueGeoids(s.selectedGeoids);
        if (!name){
          setStatus(s, "Enter a set name before saving.", true);
          return;
        }
        if (!geoids.length){
          setStatus(s, "Select GEO units before saving a set.", true);
          return;
        }
        const rows = Array.isArray(s.selectionSets) ? s.selectionSets.slice() : [];
        const context = contextFingerprint(s);
        const existingIdx = rows.findIndex((row) => cleanText(row?.name).toLowerCase() === name.toLowerCase() && setRowContextFingerprint(row) === context);
        const record = {
          name,
          resolution: cleanText(s.resolution),
          stateFips: cleanText(s.stateFips),
          countyFips: cleanText(s.countyFips),
          placeFips: cleanText(s.placeFips),
          geoids,
          updatedAt: new Date().toISOString(),
        };
        if (existingIdx >= 0){
          rows[existingIdx] = record;
          s.selectedSelectionSetKey = String(existingIdx);
        } else {
          rows.unshift(record);
          if (rows.length > 50) rows.length = 50;
          s.selectedSelectionSetKey = "0";
        }
        s.selectionSets = rows;
        s.selectionSetDraftName = name;
        setStatus(s, `Saved set "${name}" with ${geoids.length} GEO units.`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusLoadSelectionSet){
    els.btnCensusLoadSelectionSet.addEventListener("click", () => {
      withState((_, s) => {
        const row = getSelectionSetByKey(s.selectionSets, s.selectedSelectionSetKey);
        if (!row){
          setStatus(s, "Select a saved set to load.", true);
          return;
        }
        const available = new Set((s.geoOptions || []).map((opt) => cleanText(opt.geoid)));
        const matched = uniqueGeoids(row.geoids).filter((id) => available.has(id));
        if (!matched.length){
          setStatus(s, "Saved set has no GEOIDs in current loaded list. Load matching GEO list first.", true);
          return;
        }
        s.selectedGeoids = matched;
        s.selectionSetDraftName = cleanText(row.name);
        const missing = uniqueGeoids(row.geoids).length - matched.length;
        setStatus(s, missing > 0
          ? `Loaded set "${row.name}": ${matched.length} matched, ${missing} unavailable in current list.`
          : `Loaded set "${row.name}" with ${matched.length} GEO units.`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusDeleteSelectionSet){
    els.btnCensusDeleteSelectionSet.addEventListener("click", () => {
      withState((_, s) => {
        const idx = Number(s.selectedSelectionSetKey);
        if (!Number.isInteger(idx) || idx < 0 || idx >= (s.selectionSets || []).length){
          setStatus(s, "Select a saved set to delete.", true);
          return;
        }
        const rows = s.selectionSets.slice();
        const removed = rows.splice(idx, 1)[0];
        s.selectionSets = rows;
        s.selectedSelectionSetKey = "";
        setStatus(s, `Deleted set "${cleanText(removed?.name) || "Unnamed"}".`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusExportAggregateCsv){
    els.btnCensusExportAggregateCsv.addEventListener("click", () => {
      withState((_, s) => {
        const { tableRows } = aggregateSnapshot(s);
        if (!tableRows.length || !s.selectedGeoids.length){
          setStatus(s, "No aggregate available to export.", true);
          return;
        }
        const headers = ["metric_id", "metric_label", "value", "value_text", "format", "year", "resolution", "state_fips", "county_fips", "place_fips", "selected_geo_count"];
        const lines = [headers.map(csvEscape).join(",")];
        for (const row of tableRows){
          const values = [
            row.id,
            row.label,
            row.value,
            row.valueText,
            row.format,
            s.year,
            s.resolution,
            s.stateFips,
            s.countyFips,
            s.placeFips,
            s.selectedGeoids.length,
          ];
          lines.push(values.map(csvEscape).join(","));
        }
        const ok = downloadTextFile(lines.join("\n"), `${exportBaseName(s)}.csv`, "text/csv");
        setStatus(s, ok ? "Aggregate CSV exported." : "CSV export failed.", !ok);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnCensusExportAggregateJson){
    els.btnCensusExportAggregateJson.addEventListener("click", () => {
      withState((_, s) => {
        const { tableRows } = aggregateSnapshot(s);
        if (!tableRows.length || !s.selectedGeoids.length){
          setStatus(s, "No aggregate available to export.", true);
          return;
        }
        const payload = {
          exportedAt: new Date().toISOString(),
          context: {
            year: s.year,
            resolution: s.resolution,
            metricSet: s.metricSet,
            stateFips: s.stateFips,
            countyFips: s.countyFips,
            placeFips: s.placeFips,
          },
          selectedGeoids: s.selectedGeoids.slice(),
          selectedGeoCount: s.selectedGeoids.length,
          rowsLoaded: s.loadedRowCount,
          metrics: tableRows.map((row) => ({
            id: row.id,
            label: row.label,
            value: row.value,
            valueText: row.valueText,
            format: row.format,
          })),
        };
        const ok = downloadTextFile(JSON.stringify(payload, null, 2), `${exportBaseName(s)}.json`, "application/json");
        setStatus(s, ok ? "Aggregate JSON exported." : "JSON export failed.", !ok);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.censusMapQaVtdToggle){
    els.censusMapQaVtdToggle.addEventListener("change", () => {
      withState((_, s) => {
        s.mapQaVtdOverlay = !!els.censusMapQaVtdToggle.checked;
        if (!s.mapQaVtdOverlay){
          clearMapQaOverlay();
        } else {
          mapRuntimeStatus.qaText = "VTD QA overlay enabled. Reload boundaries to apply.";
        }
        setStatus(s, s.mapQaVtdOverlay
          ? "VTD QA overlay enabled (visual only). Reload boundaries."
          : "VTD QA overlay disabled.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnCensusLoadMap){
    els.btnCensusLoadMap.addEventListener("click", async () => {
      const s = ensureCensusStateModule(currentState());
      if (!s) return;
      await onLoadMapBoundaries({ s, els, commitUIUpdate });
    });
  }

  if (els.btnCensusClearMap){
    els.btnCensusClearMap.addEventListener("click", () => {
      clearMapOverlay("Map overlay cleared.");
      commitUIUpdate({ persist: false });
    });
  }

  (async () => {
    const key = cleanText(readCensusApiKeyModule()) || cleanText(els.censusApiKey?.value);
    const s = ensureCensusStateModule(currentState());
    if (!s) return;
    try{
      await ensureStateOptions(key);
      if (s.stateFips){
        await loadStateScopedLists(s, key);
      }
      setStatus(s, s.stateFips ? "Census module ready." : "Select state and geography, then load GEO list.", false);
    } catch {
      setStatus(s, "Could not pre-load Census lookups. Enter key and load GEO list manually.", true);
    }
    commitUIUpdate({ persist: false });
  })();
}
