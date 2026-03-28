import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody,
} from "../../componentFactory.js";
import {
  readDistrictCensusConfigSnapshot,
  setDistrictCensusField,
  setDistrictCensusGeoSelection,
} from "../../stateBridge.js";
import {
  fetchTigerBoundaryGeojson,
  formatMetricValue,
  getMetricsForSet,
  normalizeGeoidsForResolution,
} from "../../../../core/censusModule.js";
import { readMapboxPublicTokenConfig, resolveMapboxPublicToken } from "../../../runtimeConfig.js";

const SHELL_API_KEY = "__FPE_SHELL_API__";
const CENSUS_RUNTIME_API_KEY = "__FPE_CENSUS_RUNTIME_API__";

const MAPBOX_CSS_ID = "v3MapboxCss";
const MAPBOX_SCRIPT_ID = "v3MapboxScript";
const MAPBOX_CSS_URL = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
const MAPBOX_JS_URL = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
const MAPBOX_STYLE_URL = "mapbox://styles/mapbox/light-v11";
const MAP_DEFAULT_CENTER = [-98.5795, 39.8283];
const MAP_DEFAULT_ZOOM = 3.25;

const MAP_STATUS_LOADING = "Loading campaign geography…";
const MAP_STATUS_CONTEXT_REQUIRED = "Select campaign, office, and geography context to load the map.";
const MAP_STATUS_TOKEN_MISSING = "No Mapbox token configured. Open Controls and save a Mapbox public token (pk...).";
const MAP_STATUS_TOKEN_INVALID = "Mapbox token is invalid for browser use. Save a valid Mapbox public token (pk...) in Controls.";
const MAP_STATUS_NO_GEOGRAPHY = "No geography matched the current selection.";
const MAP_STATUS_GEOGRAPHY_UNAVAILABLE = "Campaign geography is unavailable for this context right now. Verify geography selections and retry.";
const MAP_STATUS_METRIC_UNAVAILABLE = "This layer does not have data for the selected metric yet.";
const MAP_STATUS_INSPECT_PROMPT = "Select an area on the map to inspect its field context.";
const MAP_STATUS_BOOT_FAILED = "Map boot failed. Check Mapbox token validity/network access, then refresh the current context.";

const CARD_STATUS_ID = "v3MapSurfaceCardStatus";
const ROOT_ID = "v3MapSurfaceRoot";
const HOST_ID = "v3MapHost";
const STATUS_ID = "v3MapStatus";
const METRIC_STATUS_ID = "v3MapMetricStatus";
const CONTEXT_STATUS_ID = "v3MapContextStatus";
const HOVER_STATUS_ID = "v3MapHoverStatus";
const INSPECT_STATUS_ID = "v3MapInspectStatus";
const INSPECT_BODY_ID = "v3MapInspectBody";
const METRIC_SELECT_ID = "v3MapMetricSelect";
const ACTION_BTN_ID = "v3MapActionBtn";
const FIT_BTN_ID = "v3MapFitBtn";
const RESET_BTN_ID = "v3MapResetBtn";

const AREAS_SOURCE_ID = "v3MapAreasSource";
const POINTS_SOURCE_ID = "v3MapPointsSource";
const FILL_LAYER_ID = "v3MapAreaFillLayer";
const OUTLINE_LAYER_ID = "v3MapAreaOutlineLayer";
const HOVER_LAYER_ID = "v3MapAreaHoverLayer";
const SELECTED_LAYER_ID = "v3MapAreaSelectedLayer";
const POINT_LAYER_ID = "v3MapPointLayer";

const STATUS_LEVELS = ["ok", "warn", "bad", "muted"];
const ROW_LAT_KEYS = ["INTPTLAT", "INTPTLAT20", "intptlat", "lat", "latitude", "centroidLat", "centroid_lat", "y", "Y"];
const ROW_LON_KEYS = ["INTPTLON", "INTPTLON20", "intptlon", "lon", "lng", "longitude", "centroidLon", "centroid_lon", "x", "X"];

let mapboxLoadPromise = null;
let mapRuntime = null;
let mapViewportResizeBound = false;
let mapConfigEventBound = false;

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeGeoidToken(value, expectedLength = 0) {
  const digits = cleanText(value).replace(/\D+/g, "");
  if (!digits) {
    return "";
  }
  if (expectedLength > 0) {
    return digits.slice(-expectedLength).padStart(expectedLength, "0");
  }
  return digits;
}

function resolutionLabel(resolution) {
  const key = cleanText(resolution).toLowerCase();
  if (key === "block_group") return "Block group";
  if (key === "tract") return "Tract";
  if (key === "place") return "Place";
  if (key === "congressional_district") return "Congressional district";
  if (key === "state_senate_district") return "State senate district";
  if (key === "state_house_district") return "State house district";
  return "Geography";
}

function readShellScope() {
  try {
    const api = window?.[SHELL_API_KEY];
    if (!api || typeof api.getView !== "function") {
      return { campaignId: "", officeId: "" };
    }
    const view = api.getView();
    return {
      campaignId: cleanText(view?.campaignId),
      officeId: cleanText(view?.officeId),
    };
  } catch {
    return { campaignId: "", officeId: "" };
  }
}

function openControlsStage() {
  try {
    const nav = window?.__FPE_V3_NAV__;
    if (!nav || typeof nav.navigateStage !== "function") {
      return false;
    }
    nav.navigateStage("controls", { persist: true });
    return true;
  } catch {
    return false;
  }
}

function readCensusRowsByGeoid() {
  try {
    const api = window?.[CENSUS_RUNTIME_API_KEY];
    if (!api || typeof api.getView !== "function" || typeof api.getRowsForState !== "function") {
      return {};
    }
    const view = api.getView();
    const rows = api.getRowsForState(view);
    return rows && typeof rows === "object" ? rows : {};
  } catch {
    return {};
  }
}

function sumVars(values, variableIds) {
  let total = 0;
  let count = 0;
  for (const id of Array.isArray(variableIds) ? variableIds : []) {
    const value = toFiniteNumber(values?.[id]);
    if (value == null) {
      continue;
    }
    total += value;
    count += 1;
  }
  return { total, count };
}

function metricValueForRow(metric, rowValues) {
  const values = rowValues && typeof rowValues === "object" ? rowValues : {};
  if (!metric || typeof metric !== "object") {
    return null;
  }
  if (metric.kind === "sum") {
    const out = sumVars(values, metric.sumVars);
    return out.count > 0 ? out.total : null;
  }
  if (metric.kind === "ratio") {
    const numerator = sumVars(values, metric.numeratorVars).total;
    const denominator = sumVars(values, metric.denominatorVars).total;
    return denominator > 0 ? numerator / denominator : null;
  }
  if (metric.kind === "weighted_mean") {
    const value = toFiniteNumber(values?.[metric.valueVar]);
    const weight = toFiniteNumber(values?.[metric.weightVar]);
    if (value == null) {
      return null;
    }
    if (weight != null && weight <= 0) {
      return null;
    }
    return value;
  }
  return null;
}

function firstFiniteByKeys(values, keys) {
  for (const key of keys) {
    const value = toFiniteNumber(values?.[key]);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function extractCanonicalPoint(rowValues) {
  const lat = firstFiniteByKeys(rowValues, ROW_LAT_KEYS);
  const lon = firstFiniteByKeys(rowValues, ROW_LON_KEYS);
  if (lat == null || lon == null) {
    return null;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  return { lat, lon };
}

function metricDefinitions(metricSetId) {
  const id = cleanText(metricSetId) || "core";
  return getMetricsForSet(id)
    .map((row) => ({
      id: cleanText(row?.id),
      label: cleanText(row?.label) || cleanText(row?.id),
      format: cleanText(row?.format) || "int",
      kind: cleanText(row?.kind),
      sumVars: Array.isArray(row?.sumVars) ? row.sumVars.slice() : [],
      numeratorVars: Array.isArray(row?.numeratorVars) ? row.numeratorVars.slice() : [],
      denominatorVars: Array.isArray(row?.denominatorVars) ? row.denominatorVars.slice() : [],
      valueVar: cleanText(row?.valueVar),
      weightVar: cleanText(row?.weightVar),
    }))
    .filter((row) => row.id);
}

function buildMetricInventory(metrics, rowsByGeoid, geoids) {
  const out = [];
  for (const metric of metrics) {
    let availableCount = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (const geoid of geoids) {
      const rowValues = rowsByGeoid?.[geoid]?.values;
      const value = metricValueForRow(metric, rowValues);
      if (value == null) {
        continue;
      }
      availableCount += 1;
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    }
    out.push({
      ...metric,
      availableCount,
      minValue: Number.isFinite(minValue) ? minValue : null,
      maxValue: Number.isFinite(maxValue) ? maxValue : null,
    });
  }
  return out;
}

function selectedGeographyFromConfig(config) {
  const options = Array.isArray(config?.geoSelectOptions) ? config.geoSelectOptions : [];
  const labels = new Map();
  const selectedRaw = [];
  for (const row of options) {
    const value = cleanText(row?.value);
    const label = cleanText(row?.label) || value;
    if (value) {
      labels.set(value, label);
    }
    if (row?.selected && value) {
      selectedRaw.push(value);
    }
  }
  const resolution = cleanText(config?.resolution);
  const selectedGeoids = normalizeGeoidsForResolution(selectedRaw, resolution);
  const normalizedLabels = new Map();
  const expectedLength = selectedGeoids[0]?.length || 0;
  for (const [value, label] of labels.entries()) {
    const normalized = normalizeGeoidToken(value, expectedLength);
    if (normalized) {
      normalizedLabels.set(normalized, label);
    }
  }
  return {
    resolution,
    selectedGeoids,
    labelsByGeoid: normalizedLabels,
  };
}

function readFeatureGeoid(feature, expectedLength = 0) {
  const properties = feature?.properties && typeof feature.properties === "object"
    ? feature.properties
    : {};
  const raw = properties.GEOID ?? properties.geoid ?? feature?.id;
  return normalizeGeoidToken(raw, expectedLength);
}

async function fetchBoundaryCollection({ resolution, geoids }) {
  const normalized = normalizeGeoidsForResolution(geoids, resolution);
  const expectedLength = normalized[0]?.length || 0;
  const requested = new Set(normalized);
  const result = await fetchTigerBoundaryGeojson({ resolution, geoids: normalized });
  const features = (result?.featureCollection?.features || [])
    .map((feature) => {
      const geoid = readFeatureGeoid(feature, expectedLength);
      if (!geoid || !requested.has(geoid)) {
        return null;
      }
      const nextProps = feature?.properties && typeof feature.properties === "object"
        ? { ...feature.properties }
        : {};
      nextProps.geoid = geoid;
      return {
        type: "Feature",
        geometry: feature?.geometry || null,
        properties: nextProps,
      };
    })
    .filter((feature) => feature && feature.geometry);
  return {
    featureCollection: {
      type: "FeatureCollection",
      features,
    },
    matchedGeoids: Array.isArray(result?.matchedGeoids)
      ? normalizeGeoidsForResolution(result.matchedGeoids, resolution)
      : [],
    missingGeoids: Array.isArray(result?.missingGeoids)
      ? normalizeGeoidsForResolution(result.missingGeoids, resolution)
      : normalized.filter((geoid) => !features.some((feature) => cleanText(feature?.properties?.geoid) === geoid)),
  };
}

function buildMapCollections({ boundaryCollection, labelsByGeoid, rowsByGeoid, metric, resolution }) {
  const features = Array.isArray(boundaryCollection?.features) ? boundaryCollection.features : [];
  const areaFeatures = [];
  const featureByGeoid = new Map();
  const pointFeatures = [];
  let metricCount = 0;

  for (const feature of features) {
    const geoid = cleanText(feature?.properties?.geoid);
    if (!geoid) {
      continue;
    }
    const row = rowsByGeoid?.[geoid];
    const rowValues = row?.values && typeof row.values === "object" ? row.values : {};
    const metricValue = metric ? metricValueForRow(metric, rowValues) : null;
    const hasMetric = metricValue != null;
    if (hasMetric) {
      metricCount += 1;
    }
    const label = cleanText(labelsByGeoid.get(geoid))
      || cleanText(row?.label)
      || cleanText(row?.name)
      || cleanText(feature?.properties?.NAME)
      || geoid;
    const population = toFiniteNumber(rowValues?.B01003_001E);
    const areaFeature = {
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        geoid,
        geographyType: resolutionLabel(resolution),
        label,
        hasMetric,
        metricValue: hasMetric ? metricValue : null,
        metricText: hasMetric ? formatMetricValue(metricValue, metric?.format) : "—",
        population: population == null ? null : population,
      },
    };
    areaFeatures.push(areaFeature);
    if (!featureByGeoid.has(geoid)) {
      featureByGeoid.set(geoid, areaFeature);
    }
  }

  for (const [geoid, areaFeature] of featureByGeoid.entries()) {
    const rowValues = rowsByGeoid?.[geoid]?.values;
    const point = extractCanonicalPoint(rowValues);
    if (!point) {
      continue;
    }
    pointFeatures.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
      properties: {
        geoid,
        label: cleanText(areaFeature?.properties?.label) || geoid,
      },
    });
  }

  return {
    areaFeatureCollection: { type: "FeatureCollection", features: areaFeatures },
    pointFeatureCollection: { type: "FeatureCollection", features: pointFeatures },
    featureByGeoid,
    metricCount,
  };
}

function ensureMapboxCss() {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(MAPBOX_CSS_ID)) {
    return;
  }
  const link = document.createElement("link");
  link.id = MAPBOX_CSS_ID;
  link.rel = "stylesheet";
  link.href = MAPBOX_CSS_URL;
  document.head.append(link);
}

function loadMapboxGl() {
  if (globalThis?.mapboxgl && typeof globalThis.mapboxgl.Map === "function") {
    return Promise.resolve(globalThis.mapboxgl);
  }
  if (mapboxLoadPromise) {
    return mapboxLoadPromise;
  }
  mapboxLoadPromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is unavailable."));
      return;
    }
    ensureMapboxCss();
    let script = document.getElementById(MAPBOX_SCRIPT_ID);
    if (!(script instanceof HTMLScriptElement)) {
      script = document.createElement("script");
      script.id = MAPBOX_SCRIPT_ID;
      script.src = MAPBOX_JS_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    const resolveReady = () => {
      if (globalThis?.mapboxgl && typeof globalThis.mapboxgl.Map === "function") {
        resolve(globalThis.mapboxgl);
        return;
      }
      reject(new Error("Mapbox GL did not initialize."));
    };
    script.addEventListener("load", resolveReady, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Mapbox GL.")), { once: true });
  }).catch((error) => {
    mapboxLoadPromise = null;
    throw error;
  });
  return mapboxLoadPromise;
}

function setStatusLevel(el, level = "muted") {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.classList.remove(...STATUS_LEVELS);
  el.classList.add(STATUS_LEVELS.includes(level) ? level : "muted");
}

function setTextWithLevel(el, text, level = "muted") {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.textContent = text;
  setStatusLevel(el, level);
}

function setCardStatus(text) {
  const el = document.getElementById(CARD_STATUS_ID);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.textContent = cleanText(text) || "Awaiting context";
}

function setMetricSelectorDisabled(selectEl, placeholder = "") {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return;
  }
  selectEl.disabled = true;
  if (!placeholder) {
    return;
  }
  selectEl.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  selectEl.append(option);
  selectEl.value = "";
}

function setMetricSelectorEnabled(selectEl, enabled = true) {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return;
  }
  selectEl.disabled = !enabled;
}

function syncMetricSelector(selectEl, inventory, selectedMetricId) {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return "";
  }
  const options = Array.isArray(inventory) ? inventory : [];
  const existingByValue = new Map(Array.from(selectEl.options).map((option) => [cleanText(option.value), option]));
  const seen = new Set();
  for (const row of options) {
    const value = cleanText(row?.id);
    if (!value) {
      continue;
    }
    seen.add(value);
    const suffix = row.availableCount > 0 ? "" : " (no row data)";
    const label = `${cleanText(row?.label) || value}${suffix}`;
    const existing = existingByValue.get(value);
    if (existing) {
      if (existing.textContent !== label) {
        existing.textContent = label;
      }
      continue;
    }
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    selectEl.append(option);
  }
  Array.from(selectEl.options).forEach((option) => {
    if (!seen.has(cleanText(option.value))) {
      option.remove();
    }
  });
  if (!options.length) {
    selectEl.value = "";
    return "";
  }
  const inventoryById = new Map(options.map((row) => [cleanText(row.id), row]));
  const preferred = cleanText(selectedMetricId);
  const fallbackWithData = options.find((row) => row.availableCount > 0)?.id || "";
  const fallbackAny = options[0]?.id || "";
  const nextValue = inventoryById.has(preferred) ? preferred : (fallbackWithData || fallbackAny);
  selectEl.value = nextValue;
  return nextValue;
}

function setMapActionButton(buttonEl, { visible = false, label = "Open Controls", disabled = false } = {}) {
  if (!(buttonEl instanceof HTMLButtonElement)) {
    return;
  }
  buttonEl.hidden = !visible;
  buttonEl.disabled = !!disabled;
  if (label) {
    buttonEl.textContent = String(label);
  }
}

function defaultFeatureCollection() {
  return { type: "FeatureCollection", features: [] };
}

function setSourceData(map, sourceId, data) {
  const source = map?.getSource?.(sourceId);
  if (source && typeof source.setData === "function") {
    source.setData(data || defaultFeatureCollection());
  }
}

function fillExpressionForMetric(metric) {
  if (!metric || metric.availableCount <= 0) {
    return "#e5e7eb";
  }
  const min = Number.isFinite(Number(metric.minValue)) ? Number(metric.minValue) : 0;
  const maxRaw = Number.isFinite(Number(metric.maxValue)) ? Number(metric.maxValue) : min;
  const max = maxRaw === min ? min + 1 : maxRaw;
  const mid = min + ((max - min) / 2);
  return [
    "case",
    ["boolean", ["get", "hasMetric"], false],
    [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "metricValue"], min],
      min, "#dbeafe",
      mid, "#60a5fa",
      max, "#1d4ed8",
    ],
    "#e5e7eb",
  ];
}

function updateSelectedFilter(runtime) {
  const map = runtime?.map;
  if (!map?.getLayer?.(SELECTED_LAYER_ID)) {
    return;
  }
  const geoid = cleanText(runtime?.selectedGeoid);
  map.setFilter(
    SELECTED_LAYER_ID,
    geoid ? ["==", ["get", "geoid"], geoid] : ["==", ["get", "geoid"], "__none__"],
  );
}

function updateHoverFilter(runtime) {
  const map = runtime?.map;
  if (!map?.getLayer?.(HOVER_LAYER_ID)) {
    return;
  }
  const geoid = cleanText(runtime?.hoveredGeoid);
  map.setFilter(
    HOVER_LAYER_ID,
    geoid ? ["==", ["get", "geoid"], geoid] : ["==", ["get", "geoid"], "__none__"],
  );
}

function collectCoordinates(geometry, sink) {
  const coords = geometry?.coordinates;
  if (!Array.isArray(coords)) {
    return;
  }
  const walk = (node) => {
    if (!Array.isArray(node)) {
      return;
    }
    if (node.length >= 2 && Number.isFinite(Number(node[0])) && Number.isFinite(Number(node[1]))) {
      sink.push([Number(node[0]), Number(node[1])]);
      return;
    }
    for (const child of node) {
      walk(child);
    }
  };
  walk(coords);
}

function fitMapToFeatures(runtime, featureCollection) {
  const mapboxgl = runtime?.mapboxgl;
  const map = runtime?.map;
  if (!mapboxgl || !map) {
    return;
  }
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : [];
  if (!features.length) {
    return;
  }
  const coords = [];
  for (const feature of features) {
    collectCoordinates(feature?.geometry, coords);
  }
  if (!coords.length) {
    return;
  }
  const bounds = new mapboxgl.LngLatBounds(coords[0], coords[0]);
  for (let i = 1; i < coords.length; i += 1) {
    bounds.extend(coords[i]);
  }
  if (bounds.isEmpty()) {
    return;
  }
  map.fitBounds(bounds, { padding: 44, maxZoom: 11, duration: 0 });
}

function fitRuntimeBoundary(runtime) {
  const features = runtime?.boundaryFeatureCollection?.features;
  if (!Array.isArray(features) || !features.length) {
    return false;
  }
  fitMapToFeatures(runtime, runtime.boundaryFeatureCollection);
  return true;
}

function resetRuntimeView(runtime) {
  const map = runtime?.map;
  if (!map || typeof map.easeTo !== "function") {
    return false;
  }
  map.easeTo({
    center: MAP_DEFAULT_CENTER,
    zoom: MAP_DEFAULT_ZOOM,
    duration: 0,
  });
  return true;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function syncInspectPanel(runtime, metric) {
  const inspectStatus = document.getElementById(INSPECT_STATUS_ID);
  const inspectBody = document.getElementById(INSPECT_BODY_ID);
  if (!(inspectStatus instanceof HTMLElement) || !(inspectBody instanceof HTMLElement)) {
    return;
  }
  const selectedGeoid = cleanText(runtime?.selectedGeoid);
  const feature = selectedGeoid ? runtime?.featureByGeoid?.get(selectedGeoid) : null;
  if (!feature) {
    inspectBody.innerHTML = "";
    setTextWithLevel(inspectStatus, MAP_STATUS_INSPECT_PROMPT, "muted");
    return;
  }
  const props = feature.properties && typeof feature.properties === "object" ? feature.properties : {};
  const metricLabel = cleanText(metric?.label) || "Metric";
  const metricText = cleanText(props.metricText) || "—";
  const population = toFiniteNumber(props.population);
  const populationText = population == null ? "—" : population.toLocaleString();
  const label = cleanText(props.label) || selectedGeoid;
  const geographyType = cleanText(props.geographyType) || resolutionLabel(runtime?.resolution);
  const officeId = cleanText(runtime?.shellScope?.officeId) || "—";
  inspectBody.innerHTML = [
    `<div class="fpe-map-inspect-row"><span>Area</span><strong>${escapeHtml(label)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Type</span><strong>${escapeHtml(geographyType)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>GEOID</span><strong>${escapeHtml(selectedGeoid)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Office context</span><strong>${escapeHtml(officeId)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>${escapeHtml(metricLabel)}</span><strong>${escapeHtml(metricText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Population</span><strong>${escapeHtml(populationText)}</strong></div>`,
  ].join("");
  setTextWithLevel(
    inspectStatus,
    `Inspecting ${label} (${selectedGeoid}).`,
    "ok",
  );
}

function syncHoverStatus(runtime) {
  const el = document.getElementById(HOVER_STATUS_ID);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const geoid = cleanText(runtime?.hoveredGeoid);
  const feature = geoid ? runtime?.featureByGeoid?.get(geoid) : null;
  if (!feature) {
    setTextWithLevel(el, "Hover an area to preview name, type, and geography identifier.", "muted");
    return;
  }
  const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  const label = cleanText(props.label) || geoid;
  const geographyType = cleanText(props.geographyType) || resolutionLabel(runtime?.resolution);
  setTextWithLevel(el, `Hover: ${label} • ${geographyType} • ${geoid}`, "ok");
}

function bridgeMapSelection(runtime, geoid) {
  const id = cleanText(geoid);
  if (!id) {
    return;
  }
  const current = Array.isArray(runtime?.selectedGeoids) ? runtime.selectedGeoids : [];
  const next = current.includes(id) ? current.slice() : [id, ...current];
  setDistrictCensusField("geoSearch", id);
  setDistrictCensusGeoSelection(next);
}

function bindMapInteractions(runtime) {
  if (!runtime?.map || runtime.handlersBound) {
    return;
  }
  const map = runtime.map;
  const onFeatureClick = (event) => {
    const feature = Array.isArray(event?.features) ? event.features[0] : null;
    const geoid = cleanText(feature?.properties?.geoid);
    if (!geoid) {
      return;
    }
    runtime.selectedGeoid = geoid;
    updateSelectedFilter(runtime);
    syncInspectPanel(runtime, runtime.activeMetric || null);
    bridgeMapSelection(runtime, geoid);
  };
  map.on("click", FILL_LAYER_ID, onFeatureClick);
  map.on("click", OUTLINE_LAYER_ID, onFeatureClick);
  const onFeatureHover = (event) => {
    const feature = Array.isArray(event?.features) ? event.features[0] : null;
    const geoid = cleanText(feature?.properties?.geoid);
    runtime.hoveredGeoid = geoid;
    updateHoverFilter(runtime);
    syncHoverStatus(runtime);
  };
  map.on("mousemove", FILL_LAYER_ID, onFeatureHover);
  map.on("mousemove", OUTLINE_LAYER_ID, onFeatureHover);
  map.on("mouseenter", FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseenter", OUTLINE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", FILL_LAYER_ID, () => {
    runtime.hoveredGeoid = "";
    updateHoverFilter(runtime);
    syncHoverStatus(runtime);
    map.getCanvas().style.cursor = "";
  });
  map.on("mouseleave", OUTLINE_LAYER_ID, () => {
    runtime.hoveredGeoid = "";
    updateHoverFilter(runtime);
    syncHoverStatus(runtime);
    map.getCanvas().style.cursor = "";
  });
  runtime.handlersBound = true;
}

function ensureMapLayers(runtime) {
  const map = runtime?.map;
  if (!map || !runtime.mapLoaded) {
    return;
  }
  if (!map.getSource(AREAS_SOURCE_ID)) {
    map.addSource(AREAS_SOURCE_ID, { type: "geojson", data: defaultFeatureCollection() });
  }
  if (!map.getSource(POINTS_SOURCE_ID)) {
    map.addSource(POINTS_SOURCE_ID, { type: "geojson", data: defaultFeatureCollection() });
  }
  if (!map.getLayer(FILL_LAYER_ID)) {
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: AREAS_SOURCE_ID,
      paint: {
        "fill-color": "#e5e7eb",
        "fill-opacity": 0.72,
      },
    });
  }
  if (!map.getLayer(OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: OUTLINE_LAYER_ID,
      type: "line",
      source: AREAS_SOURCE_ID,
      paint: {
        "line-color": "#334155",
        "line-width": 1.1,
        "line-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer(HOVER_LAYER_ID)) {
    map.addLayer({
      id: HOVER_LAYER_ID,
      type: "line",
      source: AREAS_SOURCE_ID,
      filter: ["==", ["get", "geoid"], "__none__"],
      paint: {
        "line-color": "#06b6d4",
        "line-width": 2.2,
        "line-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer(SELECTED_LAYER_ID)) {
    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: "line",
      source: AREAS_SOURCE_ID,
      filter: ["==", ["get", "geoid"], "__none__"],
      paint: {
        "line-color": "#f97316",
        "line-width": 3.1,
        "line-opacity": 1,
      },
    });
  }
  if (!map.getLayer(POINT_LAYER_ID)) {
    map.addLayer({
      id: POINT_LAYER_ID,
      type: "circle",
      source: POINTS_SOURCE_ID,
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#0f172a",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.15,
        "circle-opacity": 0.86,
      },
    });
  }
  bindMapInteractions(runtime);
  updateHoverFilter(runtime);
  updateSelectedFilter(runtime);
}

function clearMapCollections(runtime) {
  const map = runtime?.map;
  if (!map || !runtime?.mapLoaded) {
    return;
  }
  setSourceData(map, AREAS_SOURCE_ID, defaultFeatureCollection());
  setSourceData(map, POINTS_SOURCE_ID, defaultFeatureCollection());
  if (map.getLayer(POINT_LAYER_ID)) {
    map.setLayoutProperty(POINT_LAYER_ID, "visibility", "none");
  }
  runtime.featureByGeoid = new Map();
  runtime.selectedGeoid = "";
  runtime.hoveredGeoid = "";
  runtime.fittedBoundaryKey = "";
  runtime.boundaryFeatureCollection = defaultFeatureCollection();
  updateHoverFilter(runtime);
  updateSelectedFilter(runtime);
}

function destroyMapInstance(runtime) {
  const map = runtime?.map;
  if (map && typeof map.remove === "function") {
    try {
      map.remove();
    } catch {}
  }
  if (!runtime || typeof runtime !== "object") {
    return;
  }
  runtime.map = null;
  runtime.mapboxgl = null;
  runtime.mapLoaded = false;
  runtime.handlersBound = false;
  runtime.mapToken = "";
  runtime.boundaryKey = "";
  runtime.fittedBoundaryKey = "";
  runtime.boundaryFeatureCollection = defaultFeatureCollection();
  runtime.featureByGeoid = new Map();
  runtime.selectedGeoid = "";
  runtime.hoveredGeoid = "";
  runtime.selectedGeoids = [];
  runtime.shellScope = { campaignId: "", officeId: "" };
  runtime.resolution = "";
}

function bindMapViewportResize() {
  if (mapViewportResizeBound) {
    return;
  }
  mapViewportResizeBound = true;
  window.addEventListener("resize", () => {
    const map = mapRuntime?.map;
    if (!map || typeof map.resize !== "function") {
      return;
    }
    try {
      map.resize();
    } catch {}
  });
}

async function ensureMapInstance(runtime, host, token) {
  const nextToken = cleanText(token);
  if (!nextToken) {
    return;
  }
  if (runtime.map && runtime.mapToken === nextToken) {
    runtime.map.resize();
    return;
  }
  if (runtime.map) {
    runtime.map.remove();
    runtime.map = null;
    runtime.mapLoaded = false;
    runtime.handlersBound = false;
  }
  const mapboxgl = await loadMapboxGl();
  mapboxgl.accessToken = nextToken;
  const map = new mapboxgl.Map({
    container: host,
    style: MAPBOX_STYLE_URL,
    center: MAP_DEFAULT_CENTER,
    zoom: MAP_DEFAULT_ZOOM,
    attributionControl: true,
  });
  runtime.mapboxgl = mapboxgl;
  runtime.map = map;
  runtime.mapLoaded = false;
  runtime.handlersBound = false;
  runtime.mapToken = nextToken;
  await new Promise((resolve, reject) => {
    map.once("load", () => {
      runtime.mapLoaded = true;
      ensureMapLayers(runtime);
      resolve();
    });
    map.once("error", () => {
      reject(new Error("Mapbox style failed to load."));
    });
  });
}

function applyMapCollections(runtime, mapCollections, metric) {
  const map = runtime?.map;
  if (!map || !runtime.mapLoaded) {
    return;
  }
  ensureMapLayers(runtime);
  setSourceData(map, AREAS_SOURCE_ID, mapCollections.areaFeatureCollection);
  setSourceData(map, POINTS_SOURCE_ID, mapCollections.pointFeatureCollection);
  if (map.getLayer(FILL_LAYER_ID)) {
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", fillExpressionForMetric(metric));
  }
  if (map.getLayer(POINT_LAYER_ID)) {
    map.setLayoutProperty(
      POINT_LAYER_ID,
      "visibility",
      (mapCollections?.pointFeatureCollection?.features || []).length ? "visible" : "none",
    );
  }
  updateHoverFilter(runtime);
  updateSelectedFilter(runtime);
}

function readMapElements() {
  return {
    root: document.getElementById(ROOT_ID),
    host: document.getElementById(HOST_ID),
    mapStatus: document.getElementById(STATUS_ID),
    metricStatus: document.getElementById(METRIC_STATUS_ID),
    contextStatus: document.getElementById(CONTEXT_STATUS_ID),
    hoverStatus: document.getElementById(HOVER_STATUS_ID),
    metricSelect: document.getElementById(METRIC_SELECT_ID),
    actionBtn: document.getElementById(ACTION_BTN_ID),
    fitBtn: document.getElementById(FIT_BTN_ID),
    resetBtn: document.getElementById(RESET_BTN_ID),
  };
}

function ensureRuntime(root) {
  if (mapRuntime && mapRuntime.root === root) {
    return mapRuntime;
  }
  if (mapRuntime?.map) {
    destroyMapInstance(mapRuntime);
  }
  mapRuntime = {
    root,
    map: null,
    mapboxgl: null,
    mapLoaded: false,
    handlersBound: false,
    mapToken: "",
    requestSeq: 0,
    boundaryKey: "",
    boundaryFeatureCollection: defaultFeatureCollection(),
    featureByGeoid: new Map(),
    selectedGeoids: [],
    selectedGeoid: "",
    hoveredGeoid: "",
    shellScope: { campaignId: "", officeId: "" },
    resolution: "",
    metricId: "",
    activeMetric: null,
    fittedBoundaryKey: "",
  };
  return mapRuntime;
}

async function syncMapSurface() {
  const els = readMapElements();
  if (!(els.root instanceof HTMLElement) || !(els.host instanceof HTMLElement)) {
    return;
  }
  const runtime = ensureRuntime(els.root);
  const requestSeq = ++runtime.requestSeq;
  setMapActionButton(els.actionBtn, { visible: false });
  if (els.fitBtn instanceof HTMLButtonElement) {
    els.fitBtn.disabled = true;
  }
  if (els.resetBtn instanceof HTMLButtonElement) {
    els.resetBtn.disabled = true;
  }

  const tokenConfig = readMapboxPublicTokenConfig();
  const token = resolveMapboxPublicToken();
  if (!token) {
    const invalid = !!tokenConfig?.invalidConfigValue;
    setCardStatus("Config unavailable");
    setTextWithLevel(
      els.mapStatus,
      invalid ? MAP_STATUS_TOKEN_INVALID : MAP_STATUS_TOKEN_MISSING,
      "warn",
    );
    setTextWithLevel(els.metricStatus, "Choropleth metrics are unavailable until Mapbox token setup is complete.", "muted");
    setMetricSelectorDisabled(
      els.metricSelect,
      invalid ? "Invalid token; update in Controls" : "Set token in Controls",
    );
    setTextWithLevel(
      els.contextStatus,
      "Token setup is app-level. Configure Mapbox once in Controls for all map sessions.",
      "muted",
    );
    setTextWithLevel(els.hoverStatus, "Hover preview unavailable until map boot completes.", "muted");
    setMapActionButton(els.actionBtn, {
      visible: true,
      label: "Set Mapbox token in Controls",
      disabled: false,
    });
    destroyMapInstance(runtime);
    syncInspectPanel(runtime, null);
    return;
  }
  setMapActionButton(els.actionBtn, { visible: false });

  const shellScope = readShellScope();
  const censusConfig = readDistrictCensusConfigSnapshot() || {};
  const geoContext = selectedGeographyFromConfig(censusConfig);
  runtime.shellScope = shellScope;
  runtime.resolution = geoContext.resolution;
  runtime.selectedGeoids = geoContext.selectedGeoids.slice();

  const hasContext = !!cleanText(shellScope.campaignId)
    && !!cleanText(shellScope.officeId)
    && !!cleanText(censusConfig?.stateFips)
    && !!cleanText(geoContext.resolution)
    && geoContext.selectedGeoids.length > 0;

  if (!hasContext) {
    setCardStatus("Awaiting context");
    setTextWithLevel(els.mapStatus, MAP_STATUS_CONTEXT_REQUIRED, "muted");
    setTextWithLevel(els.metricStatus, "Metric selector is disabled until geography context is selected.", "muted");
    setTextWithLevel(els.contextStatus, "Waiting for canonical campaign, office, and geography selections.", "muted");
    setTextWithLevel(els.hoverStatus, "Hover preview unavailable until geography is loaded.", "muted");
    setMetricSelectorDisabled(els.metricSelect, "Awaiting geography context");
    clearMapCollections(runtime);
    runtime.featureByGeoid = new Map();
    runtime.selectedGeoid = "";
    syncInspectPanel(runtime, null);
    return;
  }

  const rowsByGeoid = readCensusRowsByGeoid();
  const metrics = metricDefinitions(censusConfig?.metricSet);
  const metricInventory = buildMetricInventory(metrics, rowsByGeoid, geoContext.selectedGeoids);
  runtime.metricId = syncMetricSelector(els.metricSelect, metricInventory, runtime.metricId);
  const activeMetric = metricInventory.find((row) => cleanText(row.id) === cleanText(runtime.metricId)) || null;
  runtime.activeMetric = activeMetric;
  setMetricSelectorEnabled(els.metricSelect, false);
  setTextWithLevel(
    els.contextStatus,
    `Context: office ${cleanText(shellScope.officeId) || "—"} • ${resolutionLabel(geoContext.resolution)} • ${geoContext.selectedGeoids.length.toLocaleString()} selected area${geoContext.selectedGeoids.length === 1 ? "" : "s"}.`,
    "muted",
  );
  setTextWithLevel(els.hoverStatus, "Hover an area to preview name, type, and geography identifier.", "muted");

  setCardStatus("Loading map");
  setTextWithLevel(els.mapStatus, MAP_STATUS_LOADING, "muted");
  setTextWithLevel(els.metricStatus, "Preparing map and choropleth controls…", "muted");

  try {
    await ensureMapInstance(runtime, els.host, token);
    if (requestSeq !== runtime.requestSeq) {
      return;
    }
    runtime.map?.resize?.();
    requestAnimationFrame(() => {
      try {
        runtime.map?.resize?.();
      } catch {}
    });
  } catch {
    setCardStatus("Boot failed");
    setTextWithLevel(els.mapStatus, MAP_STATUS_BOOT_FAILED, "bad");
    setTextWithLevel(els.metricStatus, "Map bootstrap failed before choropleth controls became available.", "bad");
    setMetricSelectorDisabled(els.metricSelect, "Map boot failed");
    setTextWithLevel(els.hoverStatus, "Hover preview unavailable because map boot failed.", "bad");
    clearMapCollections(runtime);
    runtime.featureByGeoid = new Map();
    runtime.selectedGeoid = "";
    syncInspectPanel(runtime, activeMetric);
    return;
  }

  const boundaryKey = `${geoContext.resolution}|${geoContext.selectedGeoids.join(",")}`;
  if (runtime.boundaryKey !== boundaryKey) {
    try {
      const fetched = await fetchBoundaryCollection({
        resolution: geoContext.resolution,
        geoids: geoContext.selectedGeoids,
      });
      if (requestSeq !== runtime.requestSeq) {
        return;
      }
      runtime.boundaryFeatureCollection = fetched.featureCollection;
      runtime.boundaryKey = boundaryKey;
      runtime.fittedBoundaryKey = "";
    } catch {
      setCardStatus("Geography unavailable");
      setTextWithLevel(els.mapStatus, MAP_STATUS_GEOGRAPHY_UNAVAILABLE, "bad");
      setTextWithLevel(els.metricStatus, "Boundary data request failed for this geography context.", "bad");
      setMetricSelectorDisabled(els.metricSelect, "Geography unavailable");
      setTextWithLevel(els.hoverStatus, "Hover preview unavailable because geography did not load.", "bad");
      clearMapCollections(runtime);
      runtime.featureByGeoid = new Map();
      runtime.selectedGeoid = "";
      syncInspectPanel(runtime, activeMetric);
      return;
    }
  }

  const mapCollections = buildMapCollections({
    boundaryCollection: runtime.boundaryFeatureCollection,
    labelsByGeoid: geoContext.labelsByGeoid,
    rowsByGeoid,
    metric: activeMetric,
    resolution: geoContext.resolution,
  });

  if (!mapCollections.areaFeatureCollection.features.length) {
    setCardStatus("No geography");
    setTextWithLevel(els.mapStatus, MAP_STATUS_NO_GEOGRAPHY, "warn");
    setTextWithLevel(els.metricStatus, "No mapped areas are available for the current geography selection.", "warn");
    setMetricSelectorDisabled(els.metricSelect, "No geography available");
    setTextWithLevel(els.hoverStatus, "No mapped areas are available to inspect.", "warn");
    runtime.featureByGeoid = new Map();
    runtime.selectedGeoid = "";
    applyMapCollections(runtime, mapCollections, activeMetric);
    syncInspectPanel(runtime, activeMetric);
    return;
  }

  runtime.featureByGeoid = mapCollections.featureByGeoid;
  if (!cleanText(runtime.selectedGeoid) || !runtime.featureByGeoid.has(runtime.selectedGeoid)) {
    runtime.selectedGeoid = geoContext.selectedGeoids[0] || "";
  }
  applyMapCollections(runtime, mapCollections, activeMetric);

  if (runtime.fittedBoundaryKey !== boundaryKey) {
    fitMapToFeatures(runtime, mapCollections.areaFeatureCollection);
    runtime.fittedBoundaryKey = boundaryKey;
  }

  const metricsReady = metricInventory.length > 0;
  setMetricSelectorEnabled(els.metricSelect, metricsReady);
  if (!metricsReady) {
    setTextWithLevel(els.metricStatus, "No choropleth metrics are available for the current geography context.", "warn");
  } else if (!activeMetric || activeMetric.availableCount <= 0 || mapCollections.metricCount <= 0) {
    setTextWithLevel(els.metricStatus, MAP_STATUS_METRIC_UNAVAILABLE, "warn");
  } else {
    const count = mapCollections.metricCount.toLocaleString();
    setTextWithLevel(
      els.metricStatus,
      `Choropleth metric: ${activeMetric.label} (${count} mapped area${mapCollections.metricCount === 1 ? "" : "s"}).`,
      "ok",
    );
  }
  setCardStatus("Ready");
  setTextWithLevel(
    els.mapStatus,
    `Campaign geography loaded (${mapCollections.areaFeatureCollection.features.length.toLocaleString()} polygon feature${mapCollections.areaFeatureCollection.features.length === 1 ? "" : "s"}).`,
    "ok",
  );
  if (els.fitBtn instanceof HTMLButtonElement) {
    els.fitBtn.disabled = !mapCollections.areaFeatureCollection.features.length;
  }
  if (els.resetBtn instanceof HTMLButtonElement) {
    els.resetBtn.disabled = false;
  }
  syncHoverStatus(runtime);
  syncInspectPanel(runtime, activeMetric);
}

function bindMapSurfaceEvents() {
  const metricSelect = document.getElementById(METRIC_SELECT_ID);
  if (!(metricSelect instanceof HTMLSelectElement) || metricSelect.dataset.v3MapBound === "1") {
    // no-op
  } else {
    metricSelect.dataset.v3MapBound = "1";
    metricSelect.addEventListener("change", () => {
      const runtime = mapRuntime;
      if (runtime) {
        runtime.metricId = cleanText(metricSelect.value);
      }
      void syncMapSurface();
    });
  }

  const actionBtn = document.getElementById(ACTION_BTN_ID);
  if (actionBtn instanceof HTMLButtonElement && actionBtn.dataset.v3MapBound !== "1") {
    actionBtn.dataset.v3MapBound = "1";
    actionBtn.addEventListener("click", () => {
      const ok = openControlsStage();
      if (!ok) {
        const statusEl = document.getElementById(STATUS_ID);
        setTextWithLevel(statusEl, "Controls navigation is unavailable. Open the Controls stage from the top navigation.", "warn");
      }
    });
  }

  const fitBtn = document.getElementById(FIT_BTN_ID);
  if (fitBtn instanceof HTMLButtonElement && fitBtn.dataset.v3MapBound !== "1") {
    fitBtn.dataset.v3MapBound = "1";
    fitBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = fitRuntimeBoundary(runtime);
      const metricStatus = document.getElementById(METRIC_STATUS_ID);
      if (!ok) {
        setTextWithLevel(metricStatus, "No boundary geometry is available to fit right now.", "warn");
      }
    });
  }

  const resetBtn = document.getElementById(RESET_BTN_ID);
  if (resetBtn instanceof HTMLButtonElement && resetBtn.dataset.v3MapBound !== "1") {
    resetBtn.dataset.v3MapBound = "1";
    resetBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = resetRuntimeView(runtime);
      const metricStatus = document.getElementById(METRIC_STATUS_ID);
      if (!ok) {
        setTextWithLevel(metricStatus, "Map is not ready to reset yet.", "warn");
      }
    });
  }
}

function bindMapConfigEvents() {
  if (mapConfigEventBound) {
    return;
  }
  mapConfigEventBound = true;
  window.addEventListener("vice:mapbox-config-updated", () => {
    void syncMapSurface();
  });
}

export function renderMapSurface(mount) {
  const frame = createCenterStackFrame();
  const center = createCenterStackColumn();

  const mapCard = createCenterModuleCard({
    title: "Campaign geography map",
    description: "Render canonical campaign geography as a secure Mapbox visualization surface.",
    status: "Awaiting context",
  });
  mapCard.id = "v3MapSurfaceCard";
  const statusEl = mapCard.querySelector(".fpe-card__status");
  if (statusEl instanceof HTMLElement) {
    statusEl.id = CARD_STATUS_ID;
  }

  const body = getCardBody(mapCard);
  if (body instanceof HTMLElement) {
    body.innerHTML = `
      <div class="fpe-map-surface" id="${ROOT_ID}">
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="${METRIC_SELECT_ID}">Choropleth metric</label>
            <select class="fpe-input" id="${METRIC_SELECT_ID}" disabled>
              <option value="">Awaiting map readiness</option>
            </select>
          </div>
          <div class="fpe-contained-block fpe-contained-block--status">
            <div class="fpe-control-label">Geography load</div>
            <div class="fpe-help fpe-help--flush muted" id="${STATUS_ID}">${MAP_STATUS_CONTEXT_REQUIRED}</div>
            <div class="fpe-action-row">
              <button class="fpe-btn fpe-btn--ghost" hidden id="${ACTION_BTN_ID}" type="button">Set Mapbox token in Controls</button>
            </div>
          </div>
        </div>
        <div class="fpe-help fpe-help--flush muted" id="${CONTEXT_STATUS_ID}">Waiting for canonical campaign, office, and geography selections.</div>
        <div class="fpe-action-row">
          <button class="fpe-btn fpe-btn--ghost" disabled id="${FIT_BTN_ID}" type="button">Fit to boundary</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${RESET_BTN_ID}" type="button">Reset view</button>
        </div>

        <div class="fpe-mapbox-shell">
          <div class="fpe-mapbox-host" id="${HOST_ID}" role="img" aria-label="Campaign geography map"></div>
        </div>

        <div class="fpe-help fpe-help--flush muted" id="${METRIC_STATUS_ID}"></div>
        <div class="fpe-help fpe-help--flush muted" id="${HOVER_STATUS_ID}">Hover an area to preview name, type, and geography identifier.</div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Area inspect</div>
          <div class="fpe-help fpe-help--flush muted" id="${INSPECT_STATUS_ID}">${MAP_STATUS_INSPECT_PROMPT}</div>
          <div class="fpe-map-inspect" id="${INSPECT_BODY_ID}"></div>
        </div>
      </div>
    `;
  }

  center.append(
    createWhyPanel([
      "Mapbox is used here as a rendering layer only; campaign canon calculations remain unchanged.",
      "Geography and metric values come from existing canonical Census context and runtime rows.",
      "Map click inspect writes through existing Census bridge actions for bounded detail sync.",
    ]),
    mapCard,
  );
  frame.append(center);
  mount.innerHTML = "";
  mount.append(frame);

  bindMapViewportResize();
  bindMapConfigEvents();
  bindMapSurfaceEvents();
  void syncMapSurface();

  return () => {
    bindMapViewportResize();
    bindMapConfigEvents();
    bindMapSurfaceEvents();
    void syncMapSurface();
  };
}
