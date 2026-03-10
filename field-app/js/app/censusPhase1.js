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
  buildElectionCsvTemplate,
  getElectionCsvUploadGuide,
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
let mapRequestSeq = 0;
let mapLoadedSelectionKey = "";
const mapRuntimeStatus = {
  loading: false,
  error: "",
  text: "Map idle. Select GEO units, then load boundaries.",
  featureCount: 0,
  missingCount: 0,
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

function clearMapOverlay(statusText = ""){
  if (mapInstance && mapOverlayLayer && typeof mapInstance.removeLayer === "function"){
    mapInstance.removeLayer(mapOverlayLayer);
  }
  mapOverlayLayer = null;
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
  } catch (err){
    if (seq !== mapRequestSeq) return;
    setMapRuntimeStatus(cleanText(err?.message) || "Boundary load failed.", true);
  } finally {
    if (seq === mapRequestSeq){
      mapRuntimeStatus.loading = false;
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

export function renderCensusPhase1Module({ els, state } = {}){
  if (!els || !state) return;
  const s = ensureCensusStateModule(state);
  if (!s) return;
  const footprintCapacity = normalizeFootprintCapacity(state.footprintCapacity);
  const alignment = assessRaceFootprintAlignment({
    censusState: s,
    raceFootprint: state.raceFootprint,
    assumptionsProvenance: state.assumptionsProvenance,
  });

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
    els.btnCensusLoadMap.disabled = mapRuntimeStatus.loading || !s.selectedGeoids.length;
  }
  if (els.btnCensusClearMap){
    els.btnCensusClearMap.disabled = mapRuntimeStatus.loading || !mapRuntimeStatus.featureCount;
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
    } else if (!provenance.raceFootprintFingerprint){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance not set.";
    } else if (alignment.reason === "provenance_footprint_mismatch"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance is stale: footprint mismatch.";
    } else if (alignment.reason === "provenance_rows_mismatch"){
      els.censusAssumptionProvenanceStatus.textContent = "Assumption provenance is stale: ACS row context changed.";
    } else {
      els.censusAssumptionProvenanceStatus.textContent = provenance.generatedAt
        ? `Assumption provenance aligned with race footprint (generated ${fmtTs(provenance.generatedAt).replace("Last fetch: ", "")}).`
        : "Assumption provenance aligned with race footprint.";
    }
  }

  if (els.censusFootprintCapacityStatus){
    if (!alignment.footprintDefined){
      els.censusFootprintCapacityStatus.textContent = "Footprint capacity: not set.";
    } else if (!Number.isFinite(Number(footprintCapacity.population))){
      els.censusFootprintCapacityStatus.textContent = "Footprint capacity: population unavailable. Re-set race footprint after ACS fetch.";
    } else {
      const stale = (
        (footprintCapacity.raceFootprintFingerprint && footprintCapacity.raceFootprintFingerprint !== alignment.stored.fingerprint) ||
        (footprintCapacity.censusRowsKey && footprintCapacity.censusRowsKey !== cleanText(s.activeRowsKey)) ||
        (footprintCapacity.year && footprintCapacity.year !== cleanText(s.year))
      );
      if (stale){
        els.censusFootprintCapacityStatus.textContent = `Footprint capacity population: ${Math.round(Number(footprintCapacity.population)).toLocaleString("en-US")} (ACS ${footprintCapacity.year || "—"}, stale).`;
      } else {
        els.censusFootprintCapacityStatus.textContent = `Footprint capacity population: ${Math.round(Number(footprintCapacity.population)).toLocaleString("en-US")} (ACS ${footprintCapacity.year || "—"}).`;
      }
    }
  }

  if (els.censusElectionCsvGuideStatus){
    const guide = getElectionCsvUploadGuide();
    els.censusElectionCsvGuideStatus.textContent = `Election CSV schema ${guide.schemaVersion}: ${guide.requiredColumns.length} required column(s).`;
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
    } else if (mapRuntimeStatus.loading){
      els.censusMapStatus.classList.add("warn");
    } else {
      els.censusMapStatus.classList.add("muted");
    }
    const selectedKey = mapSelectionKey(s);
    if (!mapRuntimeStatus.loading && mapLoadedSelectionKey && selectedKey !== mapLoadedSelectionKey && !mapRuntimeStatus.error){
      els.censusMapStatus.textContent = "Selection changed. Reload boundaries to refresh map.";
    } else {
      els.censusMapStatus.textContent = mapRuntimeStatus.error || mapRuntimeStatus.text;
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
        setStatus(s, `ACS year set to ${s.year}. Fetch rows to refresh data.`, false);
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
        setStatus(s, "Bundle changed. Fetch rows to refresh aggregate data.", false);
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
