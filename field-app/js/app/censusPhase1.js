import {
  CENSUS_LOCAL_KEY,
  listAcsYears,
  resolveLatestAcs5Year,
  listResolutionOptions,
  listMetricSetOptions,
  normalizeCensusState,
  evaluateResolutionContract,
  shouldApplyRequestResult,
  fetchStateOptions,
  fetchCountyOptions,
  fetchPlaceOptions,
  fetchGeoOptions,
  fetchAcsRows,
  fetchVariableCatalog,
  resolveMetricSetVariables,
  auditMetricSetsWithCatalog,
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
  buildCensusPaceFeasibilitySnapshot,
  clampCensusApplyMultipliers,
  evaluateCensusApplyMode,
  evaluateFootprintFeasibility,
  summarizeFootprintFeasibilityIssues,
  buildCensusAssumptionAdvisory,
  evaluateQaOverlayNonBlocking,
  buildElectionCsvTemplate,
  buildElectionCsvWideTemplate,
  getElectionCsvUploadGuide,
  parseCsvText,
  normalizeElectionCsvRows,
  isDistrictResolution,
  formatRaceFootprintScope,
  resolutionLabel,
  resolutionNeedsCounty,
  resolutionSupportsBoundaryOverlay,
} from "../core/censusModule.js";
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorShareUnit,
  resolveCanonicalDoorsPerHour,
} from "../core/throughput.js";
import { formatFixedNumber, formatPercentFromUnit, formatWholeNumber, roundWholeNumberByMode } from "../core/utils.js";
import {
  applyTargetingRunResult,
  applyTargetingFieldPatch,
  applyTargetModelPreset,
  buildTargetRankingPayloadConfig,
  buildTargetRankingExportFilename,
  buildTargetRankingCsv,
  buildTargetRankingPayload,
  computeTargetingContextKey,
  listTargetGeoLevels,
  listTargetModelOptions,
  makeDefaultTargetingState,
  normalizeTargetingState,
  resetTargetingWeightsToPreset,
  runTargetRanking,
  TARGETING_STATUS_LOAD_ROWS_FIRST,
} from "./targetingRuntime.js";
import { summarizeTargetingRows } from "../core/targetingRows.js";
import {
  clearCensusRowsForKey,
  getCensusRowsForState,
  setCensusRowsForKey,
} from "./censusRowsRuntimeStore.js";

const variableCatalogCache = new Map();
let latestAcsYearResolutionStarted = false;
let stateOptionsCache = null;
let stateOptionsUsingFallback = false;
const countyOptionsCache = new Map();
const placeOptionsCache = new Map();
const CENSUS_RUNTIME_BRIDGE_KEY = "__FPE_CENSUS_RUNTIME_API__";
let censusRuntimeBridgeGetState = null;
let censusRuntimeBridgeCommitUIUpdate = null;
let censusRuntimeBridgeEls = null;
let censusRuntimeBridgeRunAction = null;
const STATE_OPTIONS_FALLBACK = [
  { fips: "01", name: "Alabama" },
  { fips: "02", name: "Alaska" },
  { fips: "04", name: "Arizona" },
  { fips: "05", name: "Arkansas" },
  { fips: "06", name: "California" },
  { fips: "08", name: "Colorado" },
  { fips: "09", name: "Connecticut" },
  { fips: "10", name: "Delaware" },
  { fips: "11", name: "District of Columbia" },
  { fips: "12", name: "Florida" },
  { fips: "13", name: "Georgia" },
  { fips: "15", name: "Hawaii" },
  { fips: "16", name: "Idaho" },
  { fips: "17", name: "Illinois" },
  { fips: "18", name: "Indiana" },
  { fips: "19", name: "Iowa" },
  { fips: "20", name: "Kansas" },
  { fips: "21", name: "Kentucky" },
  { fips: "22", name: "Louisiana" },
  { fips: "23", name: "Maine" },
  { fips: "24", name: "Maryland" },
  { fips: "25", name: "Massachusetts" },
  { fips: "26", name: "Michigan" },
  { fips: "27", name: "Minnesota" },
  { fips: "28", name: "Mississippi" },
  { fips: "29", name: "Missouri" },
  { fips: "30", name: "Montana" },
  { fips: "31", name: "Nebraska" },
  { fips: "32", name: "Nevada" },
  { fips: "33", name: "New Hampshire" },
  { fips: "34", name: "New Jersey" },
  { fips: "35", name: "New Mexico" },
  { fips: "36", name: "New York" },
  { fips: "37", name: "North Carolina" },
  { fips: "38", name: "North Dakota" },
  { fips: "39", name: "Ohio" },
  { fips: "40", name: "Oklahoma" },
  { fips: "41", name: "Oregon" },
  { fips: "42", name: "Pennsylvania" },
  { fips: "44", name: "Rhode Island" },
  { fips: "45", name: "South Carolina" },
  { fips: "46", name: "South Dakota" },
  { fips: "47", name: "Tennessee" },
  { fips: "48", name: "Texas" },
  { fips: "49", name: "Utah" },
  { fips: "50", name: "Vermont" },
  { fips: "51", name: "Virginia" },
  { fips: "53", name: "Washington" },
  { fips: "54", name: "West Virginia" },
  { fips: "55", name: "Wisconsin" },
  { fips: "56", name: "Wyoming" },
  { fips: "60", name: "American Samoa" },
  { fips: "66", name: "Guam" },
  { fips: "69", name: "Northern Mariana Islands" },
  { fips: "72", name: "Puerto Rico" },
  { fips: "78", name: "U.S. Virgin Islands" },
];
stateOptionsCache = STATE_OPTIONS_FALLBACK.slice();
stateOptionsUsingFallback = true;
const LEAFLET_CSS_ID = "fpeLeafletCss";
const LEAFLET_SCRIPT_ID = "fpeLeafletScript";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const SHPJS_SCRIPT_ID = "fpeShpJsScript";
const SHPJS_URL = "https://unpkg.com/shpjs@6.2.0/dist/shp.min.js";
let leafletLoadPromise = null;
let shpJsLoadPromise = null;
let mapInstance = null;
let mapHost = null;
let mapOverlayLayer = null;
let mapQaVtdLayer = null;
let mapRequestSeq = 0;
let mapQaVtdUploadSeq = 0;
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
const mapQaVtdUpload = {
  fileName: "",
  statusText: "No VTD ZIP loaded. VTD QA overlay source is TIGERweb.",
  statusLevel: "muted",
  loading: false,
  featureCount: 0,
  featureCollection: null,
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
const censusRuntimeFileCache = {
  electionCsvFile: null,
  mapQaVtdZip: null,
};
const RESOLUTION_OPTIONS_SOURCE = listResolutionOptions()
  .map((row) => ({ id: cleanText(row?.id), label: cleanText(row?.label) }))
  .filter((row) => !!row.id);
const RESOLUTION_OPTIONS_FALLBACK = [
  { id: "place", label: "Place" },
  { id: "tract", label: "Tract" },
  { id: "block_group", label: "Block group" },
  { id: "congressional_district", label: "Congressional district" },
  { id: "state_senate_district", label: "State senate district (upper)" },
  { id: "state_house_district", label: "State house district (lower)" },
];
const RESOLUTION_OPTIONS = (() => {
  const byId = new Map();
  for (const row of RESOLUTION_OPTIONS_SOURCE){
    byId.set(row.id, row);
  }
  for (const row of RESOLUTION_OPTIONS_FALLBACK){
    if (!byId.has(row.id)){
      byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
})();
const RESOLUTION_CONTRACT = evaluateResolutionContract({
  options: RESOLUTION_OPTIONS_SOURCE,
  normalizeState: normalizeCensusState,
});
const RESOLUTION_CONTRACT_ISSUES = Array.from(new Set([
  ...RESOLUTION_CONTRACT.missingInOptions,
  ...RESOLUTION_CONTRACT.unsupportedByNormalize,
]));
const RESOLUTION_LABEL_BY_ID = Object.fromEntries(
  RESOLUTION_OPTIONS.map((row) => [row.id, row.label]),
);

function cleanText(v){
  return String(v == null ? "" : v).trim();
}

function formatCensusFixed(value, digits = 1, fallback = "—"){
  return formatFixedNumber(value, digits, fallback);
}

function formatCensusWhole(value, fallback = "—"){
  return formatWholeNumber(value, fallback);
}

function formatCensusApplyMultiplierSummary(multipliers){
  return `DPH ${formatCensusFixed(multipliers?.doorsPerHour, 2)}x, contact ${formatCensusFixed(multipliers?.contactRate, 2)}x, persuasion ${formatCensusFixed(multipliers?.persuasion, 2)}x, turnout ${formatCensusFixed(multipliers?.turnoutLift, 2)}x, organizer load ${formatCensusFixed(multipliers?.organizerLoad, 2)}x`;
}

function formatCensusFileSizeKb(fileSize){
  return `${formatCensusWhole(Number(fileSize) / 1024, "0")} KB`;
}

function floorCensusInt(value, fallback = 0){
  const rounded = roundWholeNumberByMode(value, { mode: "floor", fallback: null });
  return rounded == null ? fallback : rounded;
}

function censusRuntimeReadState(){
  if (typeof censusRuntimeBridgeGetState !== "function") return null;
  try {
    const state = censusRuntimeBridgeGetState();
    return (state && typeof state === "object") ? state : null;
  } catch {
    return null;
  }
}

function censusRuntimeCommit(options = { persist: false }){
  if (typeof censusRuntimeBridgeCommitUIUpdate !== "function") return;
  try {
    censusRuntimeBridgeCommitUIUpdate(options);
  } catch {}
}

function censusRuntimeSetBridgeFieldFallback(key, rawValue){
  const state = censusRuntimeReadState();
  if (!state) return false;
  const s = ensureCensusStateModule(state);
  if (!s) return false;
  const field = cleanText(key);
  if (!field) return false;

  if (field === "apiKey"){
    const value = cleanText(rawValue);
    writeCensusApiKeyModule(value);
    s.bridgeApiKey = value;
    setStatus(s, "Census API override saved. Loading geography lookups...", false);
    const keyForLookup = value || readCensusApiKeyModule();
    void (async () => {
      try{
        await ensureStateOptions(keyForLookup);
        const latest = ensureCensusStateModule(censusRuntimeReadState());
        if (!latest) return;
        if (latest.stateFips){
          await loadStateScopedLists(latest, keyForLookup);
        }
        const final = ensureCensusStateModule(censusRuntimeReadState());
        if (!final) return;
        if (final.stateFips){
          setStatus(final, "Census module ready.", false);
        } else {
          setStatus(
            final,
            stateOptionsUsingFallback
              ? "State list loaded (fallback). Select state and geography, then load GEO list."
              : "State list loaded. Select state and geography, then load GEO list.",
            false,
          );
        }
      } catch (err){
        const latest = ensureCensusStateModule(censusRuntimeReadState());
        if (!latest) return;
        setStatus(latest, cleanText(err?.message) || "Failed to load geography lookups.", true);
      }
      censusRuntimeCommit({ persist: false });
    })();
    return true;
  }
  if (field === "geoPaste"){
    s.bridgeGeoPaste = String(rawValue == null ? "" : rawValue);
    return true;
  }
  if (field === "electionCsvPrecinctFilter"){
    const value = cleanText(rawValue);
    electionCsvDryRun.precinctFilter = value;
    s.bridgeElectionCsvPrecinctFilter = value;
    return true;
  }
  if (field === "applyAdjustedAssumptions"){
    const wantsOn = !!rawValue;
    if (!wantsOn){
      s.applyAdjustedAssumptions = false;
      setStatus(s, "Census-adjusted assumptions turned OFF.", false);
      return true;
    }
    const { runtimeRows, aggregate } = aggregateSnapshot(s);
    const canonicalDoorShare = resolveCanonicalDoorShareUnit(state, { fallback: 0.5 }) ?? 0.5;
    const advisory = buildCensusAssumptionAdvisory({
      aggregate,
      doorShare: canonicalDoorShare,
      doorsPerHour: resolveCanonicalDoorsPerHour(state),
      callsPerHour: resolveCanonicalCallsPerHour(state),
      rowsByGeoid: runtimeRows,
      selectedGeoids: s.selectedGeoids,
    });
    const applyGate = evaluateCensusApplyMode({
      applyRequested: true,
      censusState: s,
      raceFootprint: state.raceFootprint,
      assumptionsProvenance: state.assumptionsProvenance,
      advisoryReady: !!advisory.ready,
      hasRows: !!Object.keys(runtimeRows).length && !!cleanText(s.activeRowsKey),
    });
    if (!applyGate.ready){
      s.applyAdjustedAssumptions = false;
      setStatus(s, applyModeReasonText(applyGate.reason), true);
      return true;
    }
    const multipliers = clampCensusApplyMultipliers(advisory.multipliers);
    s.applyAdjustedAssumptions = true;
    setStatus(
      s,
      `Census-adjusted assumptions ON (${formatCensusApplyMultiplierSummary(multipliers)}).`,
      false,
    );
    return true;
  }
  if (field === "mapQaVtdOverlay"){
    s.mapQaVtdOverlay = !!rawValue;
    if (!s.mapQaVtdOverlay){
      clearMapQaOverlay();
    } else {
      mapRuntimeStatus.qaText = "VTD QA overlay enabled. Reload boundaries to apply.";
    }
    setStatus(
      s,
      s.mapQaVtdOverlay
        ? "VTD QA overlay enabled (visual only). Reload boundaries."
        : "VTD QA overlay disabled.",
      false,
    );
    return true;
  }
  if (field === "selectedSelectionSetKey"){
    s.selectedSelectionSetKey = cleanText(rawValue);
    return true;
  }
  if (field === "selectionSetDraftName"){
    s.selectionSetDraftName = cleanText(rawValue);
    return true;
  }
  if (field === "geoSearch"){
    s.geoSearch = cleanText(rawValue);
    setStatus(s, "Search filter updated.", false);
    return true;
  }
  if (field === "tractFilter"){
    s.tractFilter = cleanText(rawValue);
    setStatus(s, s.tractFilter ? `Tract filter set to ${s.tractFilter}.` : "Tract filter cleared.", false);
    return true;
  }
  if (field === "year"){
    const requestedYear = cleanText(rawValue);
    s.year = requestedYear;
    const forcedToLatest = enforceLatestAcsYear(s, {
      reasonPrefix: requestedYear && requestedYear !== cleanText(listAcsYears()[0])
        ? `Requested ACS year ${requestedYear} is unavailable.`
        : "",
    });
    if (!forcedToLatest) {
      const applyWasOn = disableCensusApplyAdjustments(s);
      clearCensusRowsForYearShift(s);
      const suffix = applyWasOn ? " Census-adjusted assumptions turned OFF." : "";
      setStatus(s, `ACS year set to ${s.year}. Cached rows cleared; footprint/provenance now stale until refetch.${suffix}`, false);
    }
    return true;
  }
  if (field === "resolution"){
    const requestedResolution = cleanText(rawValue) || "tract";
    s.resolution = requestedResolution;
    if (!resolutionNeedsCounty(s.resolution) && s.resolution !== "place"){
      s.countyFips = "";
    }
    if (s.resolution !== "block_group"){
      s.tractFilter = "";
    }
    resetGeoData(s);
    const label = RESOLUTION_LABEL_BY_ID[cleanText(s.resolution)] || cleanText(s.resolution);
    setStatus(s, `Resolution set to ${label || s.resolution}. Load GEO list next.`, false);
    return true;
  }
  if (field === "stateFips"){
    const keyForLookup = cleanText(s.bridgeApiKey) || readCensusApiKeyModule();
    s.stateFips = cleanText(rawValue);
    s.countyFips = "";
    s.placeFips = "";
    resetGeoData(s);
    setStatus(s, s.stateFips ? "Loading lookup lists..." : "Select a state to continue.", false);
    if (s.stateFips){
      void (async () => {
        try{
          await ensureStateOptions(keyForLookup);
          const latest = ensureCensusStateModule(censusRuntimeReadState());
          if (!latest || !latest.stateFips) return;
          await loadStateScopedLists(latest, keyForLookup);
          const final = ensureCensusStateModule(censusRuntimeReadState());
          if (!final || !final.stateFips) return;
          setStatus(final, "Lookup lists loaded. Choose geography context and load GEO list.", false);
        } catch (err){
          const latest = ensureCensusStateModule(censusRuntimeReadState());
          if (!latest) return;
          setStatus(latest, cleanText(err?.message) || "Failed to load lookup lists.", true);
        }
        censusRuntimeCommit({ persist: false });
      })();
    }
    return true;
  }
  if (field === "countyFips"){
    s.countyFips = cleanText(rawValue);
    s.placeFips = "";
    resetGeoData(s);
    setStatus(s, s.countyFips ? "County set. Load GEO list next." : "Select county to continue.", false);
    return true;
  }
  if (field === "placeFips"){
    disableCensusApplyAdjustments(s);
    s.placeFips = cleanText(rawValue);
    if (s.resolution === "place" && s.geoOptions.length){
      const selected = placeGeoid(s.stateFips, s.placeFips);
      s.selectedGeoids = selected ? [selected] : [];
      setStatus(s, s.placeFips ? "Place set. Selection updated." : "Select place to continue.", false);
    } else if (s.resolution === "place"){
      resetGeoData(s);
      setStatus(s, s.placeFips ? "Place set. Load GEO list next." : "Select place to continue.", false);
    } else {
      setStatus(s, s.placeFips ? "Place selected. Current resolution does not use place filter." : "Place cleared.", false);
    }
    return true;
  }
  if (field === "metricSet"){
    const applyWasOn = disableCensusApplyAdjustments(s);
    s.metricSet = cleanText(rawValue) || "core";
    clearCensusRowsForYearShift(s);
    const suffix = applyWasOn ? " Census-adjusted assumptions turned OFF." : "";
    setStatus(s, `Bundle changed. Cached rows cleared; footprint/provenance now stale until refetch.${suffix}`, false);
    return true;
  }
  return false;
}

function censusRuntimeSetField(field, rawValue){
  const key = cleanText(field);
  if (!key){
    return { ok: false, code: "missing_field" };
  }

  const patched = censusRuntimeSetBridgeFieldFallback(key, rawValue);
  if (patched) {
    censusRuntimeCommit({ persist: true });
    return { ok: true, code: "updated_bridge_state" };
  }
  return { ok: false, code: "unavailable" };
}

function censusRuntimeSetGeoSelection(values){
  const state = censusRuntimeReadState();
  if (state){
    const s = ensureCensusStateModule(state);
    if (s){
      disableCensusApplyAdjustments(s);
      s.selectedGeoids = Array.from(new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => cleanText(value))
          .filter(Boolean),
      ));
      setStatus(s, "Selection updated.", false);
      censusRuntimeCommit({ persist: true });
      return { ok: true, code: "updated_bridge_state" };
    }
  }
  return { ok: false, code: "unavailable" };
}

function censusRuntimeSetFile(field, filesLike){
  const key = cleanText(field);
  if (!key){
    return { ok: false, code: "missing_field" };
  }
  const file = Array.from(filesLike || []).find((row) => row instanceof File) || null;
  if (key === "electionCsvFile"){
    censusRuntimeFileCache.electionCsvFile = file;
  } else if (key === "mapQaVtdZip"){
    censusRuntimeFileCache.mapQaVtdZip = file;
  }

  const state = censusRuntimeReadState();
  const s = ensureCensusStateModule(state);
  if (!s){
    return { ok: false, code: "unavailable" };
  }

  if (key === "electionCsvFile"){
    if (!file){
      resetElectionCsvDryRunRuntime();
      censusRuntimeCommit({ persist: false });
      return { ok: true, code: "updated_bridge_state" };
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
    setElectionCsvDryRunStatus(`Selected file ${electionCsvDryRun.fileName} (${formatCensusFileSizeKb(electionCsvDryRun.fileSize)}).`, "muted");
    censusRuntimeCommit({ persist: false });
    return { ok: true, code: "updated_bridge_state" };
  }

  if (key === "mapQaVtdZip"){
    if (!file){
      mapQaVtdUploadSeq += 1;
      clearMapQaVtdUploadRuntime();
      if (s.mapQaVtdOverlay){
        clearMapQaOverlay("VTD ZIP cleared. Reload boundaries to draw TIGERweb QA overlay.");
        setStatus(s, "VTD ZIP cleared. Reload boundaries to use TIGERweb QA source.", false);
      } else {
        setStatus(s, "VTD ZIP cleared.", false);
      }
      censusRuntimeCommit({ persist: false });
      return { ok: true, code: "updated_bridge_state" };
    }
    void (async () => {
      const ok = await loadMapQaVtdZipFile(file);
      const latest = ensureCensusStateModule(censusRuntimeReadState());
      if (!latest){
        censusRuntimeCommit({ persist: false });
        return;
      }
      if (!ok){
        if (latest.mapQaVtdOverlay){
          clearMapQaOverlay();
        }
        setStatus(latest, cleanText(mapQaVtdUpload.statusText) || "VTD ZIP load failed.", true);
        censusRuntimeCommit({ persist: false });
        return;
      }
      setStatus(latest, "VTD ZIP loaded. QA overlay will use ZIP polygons for matching state/county context.", false);
      censusRuntimeCommit({ persist: false });
      if (latest.mapQaVtdOverlay && mapRuntimeStatus.featureCount > 0){
        await onLoadMapBoundaries({ s: latest, els: censusRuntimeBridgeEls || {}, commitUIUpdate: censusRuntimeCommit });
      }
    })();
    censusRuntimeCommit({ persist: false });
    return { ok: true, code: "dispatched" };
  }
  return { ok: false, code: "unavailable" };
}

function censusRuntimeTriggerAction(action){
  const key = cleanText(action);
  if (!key){
    return { ok: false, code: "missing_action" };
  }
  if (typeof censusRuntimeBridgeRunAction === "function"){
    try {
      const handled = censusRuntimeBridgeRunAction(key);
      if (handled && typeof handled === "object" && handled.handled){
        return {
          ok: handled.ok !== false,
          code: cleanText(handled.code) || (handled.ok === false ? "failed" : "triggered"),
        };
      }
    } catch {}
  }
  return { ok: false, code: "unavailable" };
}

function censusRuntimeGetView(){
  const state = censusRuntimeReadState();
  const s = ensureCensusStateModule(state);
  return {
    statusText: cleanText(s?.status) || "Ready.",
    errorText: cleanText(s?.error),
    resolution: cleanText(s?.resolution),
    stateFips: cleanText(s?.stateFips),
    countyFips: cleanText(s?.countyFips),
    placeFips: cleanText(s?.placeFips),
    loadedRowCount: Number.isFinite(Number(s?.loadedRowCount)) ? Math.max(0, floorCensusInt(s.loadedRowCount, 0)) : 0,
    selectedGeoCount: Array.isArray(s?.selectedGeoids) ? s.selectedGeoids.length : 0,
    activeRowsKey: cleanText(s?.activeRowsKey),
  };
}

if (typeof window !== "undefined"){
  window[CENSUS_RUNTIME_BRIDGE_KEY] = {
    getView: () => censusRuntimeGetView(),
    getRowsForState: (censusState) => getRowsForState(censusState),
    setField: (field, value) => censusRuntimeSetField(field, value),
    setGeoSelection: (values) => censusRuntimeSetGeoSelection(values),
    setFile: (field, files) => censusRuntimeSetFile(field, files),
    triggerAction: (action) => censusRuntimeTriggerAction(action),
  };
}

function getStorage(){
  try{
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {}
  return null;
}

export function readCensusApiKeyModule(){
  const storage = getStorage();
  if (!storage) return "";
  const stored = cleanText(storage.getItem(CENSUS_LOCAL_KEY));
  return stored;
}

export function writeCensusApiKeyModule(value){
  const storage = getStorage();
  if (!storage) return;
  const key = cleanText(value);
  if (!key){
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

function ensureTargetingState(state){
  if (!state || typeof state !== "object") return makeDefaultTargetingState();
  state.targeting = normalizeTargetingState(state.targeting);
  return state.targeting;
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
  return (rows || []).map((row) => ({
    value: row.fips,
    label: cleanText(row.name),
    state: cleanText(row?.state),
    county: cleanText(row?.county),
  }));
}

function filterPlaceRowsByCounty(rows, countyFips){
  const list = Array.isArray(rows) ? rows : [];
  const selectedCounty = cleanText(countyFips);
  if (!selectedCounty) {
    return list;
  }
  return list.filter((row) => {
    const rowCounty = cleanText(row?.county);
    if (!rowCounty) return true;
    return rowCounty === selectedCounty;
  });
}

function setStatus(s, text, isError = false){
  s.status = cleanText(text) || "Ready.";
  s.error = isError ? s.status : "";
}

function contextReadyForGeo(s){
  const resolution = cleanText(s?.resolution);
  const countyFips = cleanText(s?.countyFips || s?.county);
  if (!cleanText(s?.stateFips)) return false;
  if (!resolutionNeedsCounty(resolution)) return true;
  return !!countyFips;
}

function contextText(s){
  const resolution = cleanText(s?.resolution);
  const countyFips = cleanText(s?.countyFips || s?.county);
  if (!cleanText(s?.stateFips)){
    return "no state";
  }
  if (resolutionNeedsCounty(resolution)){
    return countyFips
      ? `state ${s.stateFips} county ${countyFips}`
      : `state ${s.stateFips} county not set`;
  }
  if (resolution === "place"){
    return cleanText(s?.placeFips)
      ? `state ${s.stateFips} place ${s.placeFips}`
      : `state ${s.stateFips}`;
  }
  if (isDistrictResolution(resolution)){
    const label = RESOLUTION_LABEL_BY_ID[resolution] || "district";
    return `state ${s.stateFips} ${label.toLowerCase()}`;
  }
  return `state ${s.stateFips}`;
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

function buildCensusAdvisoryStatusView({ advisory, advisoryPace, applyForPace }){
  const pendingSelectionText = "Assumption advisory pending: select GEO units and fetch ACS rows.";
  const pendingSignalText = "Assumption advisory pending: ACS signal metrics are unavailable.";
  if (!advisory || !advisory.ready){
    return {
      level: "muted",
      text: advisory && advisory.reason === "selection_missing" ? pendingSelectionText : pendingSignalText,
    };
  }
  const coverage = advisory && advisory.coverage && typeof advisory.coverage === "object" ? advisory.coverage : {};
  const coverageText = `${Number.isFinite(Number(coverage.availableSignals)) ? Number(coverage.availableSignals) : 0}/${Number.isFinite(Number(coverage.totalSignals)) ? Number(coverage.totalSignals) : 0}`;
  const aph = advisory && advisory.aph && typeof advisory.aph === "object" ? advisory.aph : {};
  const hasAph = Number.isFinite(Number(aph.base)) && Number.isFinite(Number(aph.adjusted));
  const deltaAbs = Math.abs(Number(aph.deltaPct));
  let level = "ok";
  if (advisoryPace && advisoryPace.ready && advisoryPace.severity === "bad"){
    level = "bad";
  } else if (advisoryPace && advisoryPace.ready && advisoryPace.severity === "warn"){
    level = "warn";
  } else if (!hasAph){
    level = "muted";
  } else if (Number.isFinite(deltaAbs) && deltaAbs >= 0.15){
    level = "warn";
  }
  if (advisoryPace && advisoryPace.ready){
    const req = formatCensusFixed(advisoryPace.requiredAph, 1);
    const adj = formatCensusFixed(advisoryPace.availableAph, 1);
    const gap = formatPercentFromUnit(advisoryPace.gapPct, 1);
    const buffer = formatPercentFromUnit(Math.abs(Number(advisoryPace.gapPct)), 1);
    const sourceTag = applyForPace ? " Census-adjusted assumptions ON." : "";
    const band = advisoryPace.availableAphRange;
    if (band){
      const low = formatCensusFixed(band.low, 1);
      const mid = formatCensusFixed(band.mid, 1);
      const high = formatCensusFixed(band.high, 1);
      const text = advisoryPace.feasible
        ? (advisoryPace.severity === "warn"
          ? `Assumption advisory ready. Signal coverage ${coverageText}. Required APH ${req} vs achievable band ${low}/${mid}/${high} (near top, ${buffer} headroom).${sourceTag}`
          : `Assumption advisory ready. Signal coverage ${coverageText}. Required APH ${req} vs achievable band ${low}/${mid}/${high} (${buffer} headroom).${sourceTag}`)
        : `Assumption advisory ready. Signal coverage ${coverageText}. Required APH ${req} vs achievable band ${low}/${mid}/${high} (${gap} above plausible range).${sourceTag}`;
      return { level, text };
    }
    const text = advisoryPace.feasible
      ? `Assumption advisory ready. Signal coverage ${coverageText}. Required APH ${req} vs adjusted APH ${adj} (${buffer} buffer).${sourceTag}`
      : `Assumption advisory ready. Signal coverage ${coverageText}. Required APH ${req} vs adjusted APH ${adj} (${gap} shortfall).${sourceTag}`;
    return { level, text };
  }
  if (hasAph){
    const pct = formatPercentFromUnit(aph.deltaPct, 1);
    return {
      level,
      text: `Assumption advisory ready. Signal coverage ${coverageText}. Environment-adjusted APH delta ${pct}.`,
    };
  }
  return {
    level,
    text: `Assumption advisory ready. Signal coverage ${coverageText}. APH advisory unavailable until doors/hour and calls/hour are set.`,
  };
}

function buildCensusMapStatusView(s){
  const boundarySupported = resolutionSupportsBoundaryOverlay(s?.resolution);
  let level = "muted";
  if (boundarySupported && mapRuntimeStatus.error){
    level = "bad";
  } else if (boundarySupported && (mapRuntimeStatus.loading || mapRuntimeStatus.qaLoading)){
    level = "warn";
  } else if (boundarySupported && cleanText(mapRuntimeStatus.qaText).toLowerCase().includes("unavailable")){
    level = "warn";
  }
  const qaText = cleanText(mapRuntimeStatus.qaText);
  if (!boundarySupported){
    const label = RESOLUTION_LABEL_BY_ID[cleanText(s?.resolution)] || cleanText(s?.resolution) || "selected resolution";
    return {
      level,
      text: `Boundary overlay unavailable for ${label}. Use place, tract, or block group for map overlays.`,
    };
  }
  const selectedKey = mapSelectionKey(s);
  if (!mapRuntimeStatus.loading && mapLoadedSelectionKey && selectedKey !== mapLoadedSelectionKey && !mapRuntimeStatus.error){
    const base = "Selection changed. Reload boundaries to refresh map.";
    return { level, text: qaText ? `${base} ${qaText}` : base };
  }
  const base = cleanText(mapRuntimeStatus.error || mapRuntimeStatus.text) || "Map idle. Select GEO units and click Load boundaries.";
  return { level, text: qaText ? `${base} ${qaText}` : base };
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

function ensureShpJs(){
  if (typeof window === "undefined" || typeof document === "undefined"){
    return Promise.reject(new Error("ZIP parser unavailable."));
  }
  if (typeof window.shp === "function"){
    return Promise.resolve(window.shp);
  }
  if (shpJsLoadPromise) return shpJsLoadPromise;
  shpJsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SHPJS_SCRIPT_ID);
    if (existing){
      existing.addEventListener("load", () => {
        if (typeof window.shp === "function"){
          resolve(window.shp);
          return;
        }
        reject(new Error("SHP parser loaded but unavailable."));
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load SHP parser.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = SHPJS_SCRIPT_ID;
    script.src = SHPJS_URL;
    script.async = true;
    script.onload = () => {
      if (typeof window.shp === "function"){
        resolve(window.shp);
        return;
      }
      reject(new Error("SHP parser loaded but unavailable."));
    };
    script.onerror = () => reject(new Error("Failed to load SHP parser."));
    document.head.appendChild(script);
  });
  return shpJsLoadPromise;
}

function readArrayBufferFile(file){
  if (!file) return Promise.reject(new Error("No file selected."));
  if (typeof file.arrayBuffer === "function"){
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== "function"){
      reject(new Error("FileReader unavailable."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read ZIP file."));
    reader.readAsArrayBuffer(file);
  });
}

function normalizeGeojsonFeatureCollection(input){
  const stack = Array.isArray(input) ? input.slice() : [input];
  const features = [];
  while (stack.length){
    const item = stack.shift();
    if (!item) continue;
    if (Array.isArray(item)){
      for (const sub of item){
        stack.push(sub);
      }
      continue;
    }
    if (item.type === "FeatureCollection" && Array.isArray(item.features)){
      for (const feature of item.features){
        if (feature && feature.type === "Feature"){
          features.push(feature);
        }
      }
      continue;
    }
    if (item.type === "Feature"){
      features.push(item);
    }
  }
  return { type: "FeatureCollection", features };
}

function featurePropByAliases(feature, aliases){
  const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  const keys = Object.keys(props);
  const wanted = (aliases || []).map((x) => canonicalToken(x)).filter((x) => !!x);
  for (const key of keys){
    const canonical = canonicalToken(key);
    if (!canonical) continue;
    if (!wanted.includes(canonical)) continue;
    return props[key];
  }
  return "";
}

function filterVtdFeatureCollectionByContext(featureCollection, { stateFips, countyFips } = {}){
  const fc = featureCollection && typeof featureCollection === "object" ? featureCollection : { type: "FeatureCollection", features: [] };
  const features = Array.isArray(fc.features) ? fc.features : [];
  const state = cleanFips(stateFips, 2);
  const county = cleanFips(countyFips, 3);
  if (!state && !county){
    return { type: "FeatureCollection", features: features.slice() };
  }
  const filtered = features.filter((feature) => {
    const geoidRaw = cleanText(featurePropByAliases(feature, ["GEOID20", "GEOID", "GEOIDFP20", "GEOIDFP", "VTDST20"]));
    const geoidDigits = geoidRaw.replace(/\D+/g, "");
    const featureState = cleanFips(featurePropByAliases(feature, ["STATEFP20", "STATEFP", "STATE"]), 2) || cleanFips(geoidDigits.slice(0, 2), 2);
    const featureCounty = cleanFips(featurePropByAliases(feature, ["COUNTYFP20", "COUNTYFP", "COUNTY"]), 3) || cleanFips(geoidDigits.slice(2, 5), 3);
    if (state && featureState && featureState !== state){
      return false;
    }
    if (county && featureCounty && featureCounty !== county){
      return false;
    }
    if (county && !featureCounty && geoidDigits.length >= 5){
      return geoidDigits.slice(2, 5) === county;
    }
    return true;
  });
  return { type: "FeatureCollection", features: filtered };
}

function setMapQaVtdUploadStatus(text, level = "muted"){
  mapQaVtdUpload.statusText = cleanText(text) || "No VTD ZIP loaded. VTD QA overlay source is TIGERweb.";
  mapQaVtdUpload.statusLevel = ["ok", "warn", "bad", "muted"].includes(cleanText(level)) ? cleanText(level) : "muted";
}

function clearMapQaVtdUploadRuntime(){
  mapQaVtdUpload.fileName = "";
  mapQaVtdUpload.loading = false;
  mapQaVtdUpload.featureCount = 0;
  mapQaVtdUpload.featureCollection = null;
  setMapQaVtdUploadStatus("No VTD ZIP loaded. VTD QA overlay source is TIGERweb.", "muted");
}

async function loadMapQaVtdZipFile(file){
  const seq = ++mapQaVtdUploadSeq;
  mapQaVtdUpload.loading = true;
  mapQaVtdUpload.fileName = cleanText(file?.name);
  setMapQaVtdUploadStatus(`Loading VTD ZIP ${mapQaVtdUpload.fileName || ""}...`, "warn");
  try{
    const shp = await ensureShpJs();
    const buffer = await readArrayBufferFile(file);
    if (seq !== mapQaVtdUploadSeq) return false;
    const parsed = await shp(buffer);
    if (seq !== mapQaVtdUploadSeq) return false;
    const featureCollection = normalizeGeojsonFeatureCollection(parsed);
    const featureCount = Array.isArray(featureCollection.features) ? featureCollection.features.length : 0;
    mapQaVtdUpload.featureCollection = featureCollection;
    mapQaVtdUpload.featureCount = featureCount;
    if (featureCount > 0){
      setMapQaVtdUploadStatus(`Loaded VTD ZIP ${mapQaVtdUpload.fileName} (${featureCount.toLocaleString("en-US")} precinct polygons).`, "ok");
      return true;
    }
    setMapQaVtdUploadStatus(`Loaded VTD ZIP ${mapQaVtdUpload.fileName}, but no polygon features were found.`, "warn");
    return false;
  } catch (err){
    if (seq !== mapQaVtdUploadSeq) return false;
    mapQaVtdUpload.featureCollection = null;
    mapQaVtdUpload.featureCount = 0;
    setMapQaVtdUploadStatus(`VTD ZIP load failed: ${cleanText(err?.message) || "unknown error."}`, "bad");
    return false;
  } finally {
    if (seq === mapQaVtdUploadSeq){
      mapQaVtdUpload.loading = false;
    }
  }
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

function labelForBoundaryFeature(feature, resolution = ""){
  const resolutionId = cleanText(resolution);
  const name = cleanText(featurePropByAliases(feature, ["NAME20", "NAME", "NAMELSAD20", "NAMELSAD", "LABEL"]));
  const geoid = cleanText(
    featurePropByAliases(feature, [
      "GEOID20",
      "GEOID",
      "GEOIDFP20",
      "GEOIDFP",
      "TRACTCE",
      "PLACEFP",
      "BLKGRPCE",
    ]),
  ).replace(/\D+/g, "");
  if (name && geoid && name !== geoid){
    return `${name} (${geoid})`;
  }
  if (name){
    return name;
  }
  if (resolutionId === "tract" && geoid.length >= 6){
    const tract = geoid.slice(-6);
    return `Tract ${tract}${geoid ? ` (${geoid})` : ""}`;
  }
  if (resolutionId === "block_group" && geoid.length >= 7){
    const tract = geoid.slice(-7, -1);
    const blockGroup = geoid.slice(-1);
    return `Block group ${blockGroup}${tract ? ` · Tract ${tract}` : ""}${geoid ? ` (${geoid})` : ""}`;
  }
  if (resolutionId === "place" && geoid.length >= 5){
    const place = geoid.slice(-5);
    return `Place ${place}${geoid ? ` (${geoid})` : ""}`;
  }
  return geoid || cleanText(feature?.id);
}

function applyMapOverlay(featureCollection, { resolution = "" } = {}){
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
    onEachFeature: (feature, layer) => {
      if (!layer) return;
      const label = labelForBoundaryFeature(feature, resolution);
      if (!label) return;
      if (typeof layer.bindTooltip === "function"){
        layer.bindTooltip(label, { direction: "top", sticky: true, opacity: 0.95 });
      }
      if (typeof layer.bindPopup === "function"){
        layer.bindPopup(label);
      }
    },
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

function resolveCensusMapContainer(els){
  if (typeof document !== "undefined"){
    const v3Host = document.getElementById("v3CensusMapHost");
    if (v3Host instanceof HTMLElement){
      return v3Host;
    }
  }
  if (els?.censusMap instanceof HTMLElement){
    return els.censusMap;
  }
  if (censusRuntimeBridgeEls?.censusMap instanceof HTMLElement){
    return censusRuntimeBridgeEls.censusMap;
  }
  if (typeof document === "undefined") return null;
  const legacyHost = document.getElementById("censusMap");
  if (legacyHost instanceof HTMLElement){
    return legacyHost;
  }
  return null;
}

async function onLoadMapBoundaries({ s, els, commitUIUpdate }){
  const mapContainer = resolveCensusMapContainer(els);
  if (!s || !mapContainer){
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
  if (!resolutionSupportsBoundaryOverlay(s.resolution)){
    const label = RESOLUTION_LABEL_BY_ID[cleanText(s.resolution)] || cleanText(s.resolution) || "selected resolution";
    clearMapOverlay(`Boundary overlay unavailable for ${label}.`);
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
    const map = ensureMapMounted(mapContainer);
    if (!map){
      throw new Error("Could not initialize map.");
    }
    const result = await fetchTigerBoundaryGeojson({
      resolution: s.resolution,
      geoids: selected,
    });
    if (seq !== mapRequestSeq) return;
    applyMapOverlay(result.featureCollection, { resolution: s.resolution });
    mapRuntimeStatus.featureCount = Array.isArray(result.featureCollection?.features) ? result.featureCollection.features.length : 0;
    mapRuntimeStatus.missingCount = Array.isArray(result.missingGeoids) ? result.missingGeoids.length : 0;
    mapLoadedSelectionKey = mapSelectionKey(s);
    if (!mapRuntimeStatus.featureCount){
      setMapRuntimeStatus("No boundary features returned for selected GEOs.", true);
    } else if (mapRuntimeStatus.missingCount > 0){
      setMapRuntimeStatus(`Loaded ${mapRuntimeStatus.featureCount} boundaries; ${mapRuntimeStatus.missingCount} GEOIDs not matched. Hover boundaries for labels.`, false);
    } else {
      setMapRuntimeStatus(`Loaded ${mapRuntimeStatus.featureCount} boundaries. Hover boundaries for labels.`, false);
    }
    if (s.mapQaVtdOverlay){
      const qaContext = mapQaCountyContext(s);
      if (mapQaVtdUpload.featureCollection){
        const uploaded = filterVtdFeatureCollectionByContext(mapQaVtdUpload.featureCollection, qaContext);
        applyMapQaOverlay(uploaded);
        mapRuntimeStatus.qaFeatureCount = Array.isArray(uploaded.features) ? uploaded.features.length : 0;
        if (mapRuntimeStatus.qaFeatureCount > 0){
          mapRuntimeStatus.qaText = `VTD QA overlay loaded from ZIP (${mapRuntimeStatus.qaFeatureCount.toLocaleString("en-US")} polygons). Hover/click polygons for precinct labels.`;
        } else {
          mapRuntimeStatus.qaText = "VTD ZIP loaded, but no precinct polygons matched current state/county context.";
        }
      } else if (!qaContext.stateFips || !qaContext.countyFips){
        clearMapQaOverlay("VTD QA overlay unavailable for this selection (county context required, or upload ZIP).");
      } else {
        mapRuntimeStatus.qaLoading = true;
        const qaResult = await fetchTigerVtdBoundaryGeojson({
          stateFips: qaContext.stateFips,
          countyFips: qaContext.countyFips,
        });
        if (seq !== mapRequestSeq) return;
        applyMapQaOverlay(qaResult.featureCollection);
        mapRuntimeStatus.qaFeatureCount = Number.isFinite(Number(qaResult.featureCount)) ? Math.max(0, floorCensusInt(qaResult.featureCount, 0)) : 0;
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
    const qaFailure = !!mapRuntimeStatus.qaLoading;
    const qaPolicy = evaluateQaOverlayNonBlocking({
      primaryFeatureCount: mapRuntimeStatus.featureCount,
      qaEnabled: !!s.mapQaVtdOverlay,
      qaFailed: qaFailure,
    });
    if (qaFailure && !qaPolicy.blocking){
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
  disableCensusApplyAdjustments(s);
  clearCensusRowsForKey(s?.activeRowsKey);
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
  try{
    const rows = await fetchStateOptions({ key });
    if (Array.isArray(rows) && rows.length){
      stateOptionsCache = rows;
      stateOptionsUsingFallback = false;
      return rows;
    }
    throw new Error("No state rows returned.");
  } catch (err){
    if (!stateOptionsUsingFallback){
      const reason = cleanText(err?.message) || "Lookup failed";
      console.warn(`[censusPhase1] Using built-in fallback state list: ${reason}`);
    }
    stateOptionsUsingFallback = true;
    stateOptionsCache = STATE_OPTIONS_FALLBACK.slice();
    return stateOptionsCache;
  }
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
    resolutionNeedsCounty(cleanText(s.resolution)) ? cleanText(s.countyFips) : "",
    cleanText(s.metricSet),
  ].join("|");
}

function getRowsForState(s){
  if (!cleanText(s?.stateFips)) return {};
  return getCensusRowsForState(s);
}

function contextFingerprint(s){
  const resolution = cleanText(s?.resolution);
  const stateFips = cleanText(s?.stateFips);
  const countyFips = resolutionNeedsCounty(resolution) ? cleanText(s?.countyFips) : "";
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
  const countyFips = resolutionNeedsCounty(resolution) ? cleanText(row?.countyFips) : "";
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

function disableCensusApplyAdjustments(s){
  if (!s || typeof s !== "object") return false;
  if (!s.applyAdjustedAssumptions) return false;
  s.applyAdjustedAssumptions = false;
  return true;
}

function clearCensusRowsForYearShift(s){
  if (!s || typeof s !== "object") return;
  s.rowsByGeoid = {};
  clearCensusRowsForKey(s.activeRowsKey);
  s.activeRowsKey = "";
  s.loadedRowCount = 0;
  s.lastFetchAt = "";
  s.variableCatalogYear = "";
  s.variableCatalogCount = 0;
}

function enforceLatestAcsYear(s, { reasonPrefix = "" } = {}){
  if (!s || typeof s !== "object") return false;
  const latestYear = cleanText(listAcsYears()[0]);
  if (!latestYear) return false;
  if (cleanText(s.year) === latestYear) return false;
  const applyWasOn = disableCensusApplyAdjustments(s);
  s.year = latestYear;
  clearCensusRowsForYearShift(s);
  const suffix = applyWasOn ? " Census-adjusted assumptions turned OFF." : "";
  const prefix = cleanText(reasonPrefix);
  setStatus(
    s,
    `${prefix ? `${prefix} ` : ""}Using latest ACS 5-year vintage ${latestYear}. Cached rows cleared; footprint/provenance now stale until refetch.${suffix}`,
    false,
  );
  return true;
}

function applyModeReasonText(reason){
  const key = cleanText(reason);
  if (key === "toggle_off") return "Census-adjusted assumptions are OFF.";
  if (key === "footprint_not_set") return "Apply mode unavailable: set race footprint first.";
  if (key === "selection_context_missing") return "Apply mode unavailable: Census selection context is missing.";
  if (key === "selection_mismatch") return "Apply mode unavailable: current selection differs from race footprint.";
  if (key === "provenance_not_set") return "Apply mode unavailable: assumption provenance is not set.";
  if (key === "provenance_rows_not_set") return "Apply mode unavailable: provenance rows key is missing.";
  if (key === "provenance_year_not_set") return "Apply mode unavailable: provenance ACS year is missing.";
  if (key === "provenance_metric_set_not_set") return "Apply mode unavailable: provenance metric bundle is missing.";
  if (key === "provenance_footprint_mismatch") return "Apply mode unavailable: provenance footprint mismatch.";
  if (key === "provenance_rows_mismatch") return "Apply mode unavailable: provenance row context mismatch.";
  if (key === "provenance_year_mismatch") return "Apply mode unavailable: provenance ACS year mismatch.";
  if (key === "provenance_metric_set_mismatch") return "Apply mode unavailable: provenance metric bundle mismatch.";
  if (key === "rows_not_ready") return "Apply mode unavailable: fetch ACS rows for the current selection first.";
  if (key === "advisory_not_ready") return "Apply mode unavailable: advisory signals are not ready.";
  if (key === "ready") return "Census-adjusted assumptions are active.";
  return "Census-adjusted assumptions are unavailable.";
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

  enforceLatestAcsYear(s);
  const yearRows = listAcsYears().map((y) => ({ value: y, label: `${y} (latest)` }));
  fillSelect(els.censusAcsYear, yearRows, s.year, "Latest ACS 5-year");
  fillSelect(els.censusResolution, RESOLUTION_OPTIONS.map((row) => ({ value: row.id, label: row.label })), s.resolution, "Select resolution");
  fillSelect(els.censusMetricSet, listMetricSetOptions().map((row) => ({ value: row.id, label: row.label })), s.metricSet, "Select bundle");

  const stateRows = Array.isArray(stateOptionsCache) ? stateOptionsCache : [];
  fillSelect(els.censusStateFips, buildStateRows(stateRows), s.stateFips, "Select state");

  const countyRows = Array.isArray(countyOptionsCache.get(cleanText(s.stateFips))) ? countyOptionsCache.get(cleanText(s.stateFips)) : [];
  const placeRows = Array.isArray(placeOptionsCache.get(cleanText(s.stateFips))) ? placeOptionsCache.get(cleanText(s.stateFips)) : [];
  const placeRowsFiltered = filterPlaceRowsByCounty(placeRows, s.countyFips);
  fillSelect(els.censusCountyFips, buildSubRows(countyRows), s.countyFips, "Select county");
  fillSelect(els.censusPlaceFips, buildSubRows(placeRowsFiltered), s.placeFips, "Select place");
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

  if (els.censusAcsYear){
    els.censusAcsYear.disabled = true;
  }
  if (els.censusCountyFips){
    els.censusCountyFips.disabled = !s.stateFips;
  }
  if (els.censusPlaceFips){
    els.censusPlaceFips.disabled = !s.stateFips;
  }
  if (els.censusContextHint){
    if (RESOLUTION_CONTRACT_ISSUES.length){
      els.censusContextHint.textContent = `Resolution contract mismatch in loaded runtime (${RESOLUTION_CONTRACT_ISSUES.join(", ")}). Hard refresh to load the latest JS bundle.`;
    } else {
      const resolution = cleanText(s.resolution);
      if (!s.stateFips){
        els.censusContextHint.textContent = stateOptionsUsingFallback
          ? "Select a state first. Fallback state list is active; county/place lookups require working Census API access."
          : "Select a state first, then set geography context for the current resolution.";
      } else if (resolutionNeedsCounty(resolution)){
        els.censusContextHint.textContent = "County is required for this resolution. Place is not used.";
      } else if (resolution === "place"){
        els.censusContextHint.textContent = "Place is required for this resolution. County is not used.";
      } else if (isDistrictResolution(resolution)){
        const label = RESOLUTION_LABEL_BY_ID[resolution] || "district";
        els.censusContextHint.textContent = `${label} uses state-only context. County and place are not used.`;
      } else {
        els.censusContextHint.textContent = "State-only context active for this resolution.";
      }
    }
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
    els.btnCensusLoadMap.disabled = !resolutionSupportsBoundaryOverlay(s.resolution)
      || mapRuntimeStatus.loading
      || mapRuntimeStatus.qaLoading
      || !s.selectedGeoids.length;
  }
  if (els.btnCensusClearMap){
    els.btnCensusClearMap.disabled = mapRuntimeStatus.loading || mapRuntimeStatus.qaLoading || (!mapRuntimeStatus.featureCount && !mapRuntimeStatus.qaFeatureCount);
  }
  if (els.censusMapQaVtdToggle){
    els.censusMapQaVtdToggle.checked = !!s.mapQaVtdOverlay;
    els.censusMapQaVtdToggle.disabled = mapRuntimeStatus.loading || mapRuntimeStatus.qaLoading || mapQaVtdUpload.loading;
  }
  if (els.censusMapQaVtdZip){
    els.censusMapQaVtdZip.disabled = mapQaVtdUpload.loading;
  }
  if (els.btnCensusMapQaVtdZipClear){
    els.btnCensusMapQaVtdZipClear.disabled = mapQaVtdUpload.loading || (!mapQaVtdUpload.fileName && !mapQaVtdUpload.featureCollection);
  }

  const { runtimeRows, aggregate, tableRows } = aggregateSnapshot(s);
  const canonicalDoorShare = resolveCanonicalDoorShareUnit(state, { fallback: 0.5 }) ?? 0.5;
  const resolvedDoorsPerHour = resolveCanonicalDoorsPerHour(state);
  const resolvedCallsPerHour = resolveCanonicalCallsPerHour(state);
  let censusPaceSnapshot = buildCensusPaceFeasibilitySnapshot({
    state,
    needVotes: res?.expected?.persuasionNeed,
    weeks: state?.weeksRemaining,
    rowsByGeoid: runtimeRows,
    selectedGeoids: s.selectedGeoids,
    doorShare: canonicalDoorShare,
    doorsPerHour: resolvedDoorsPerHour,
    callsPerHour: resolvedCallsPerHour,
  });
  let advisory = censusPaceSnapshot.advisory;
  if (!advisory){
    advisory = buildCensusAssumptionAdvisory({
      aggregate,
      doorShare: canonicalDoorShare,
      doorsPerHour: resolvedDoorsPerHour,
      callsPerHour: resolvedCallsPerHour,
      rowsByGeoid: runtimeRows,
      selectedGeoids: s.selectedGeoids,
    });
  }
  let applyGate = censusPaceSnapshot.applyGate;
  if (applyGate.requested && !applyGate.ready){
    s.applyAdjustedAssumptions = false;
    censusPaceSnapshot = buildCensusPaceFeasibilitySnapshot({
      state,
      needVotes: res?.expected?.persuasionNeed,
      weeks: state?.weeksRemaining,
      rowsByGeoid: runtimeRows,
      selectedGeoids: s.selectedGeoids,
      doorShare: canonicalDoorShare,
      doorsPerHour: resolvedDoorsPerHour,
      callsPerHour: resolvedCallsPerHour,
    });
    advisory = censusPaceSnapshot.advisory || advisory;
    applyGate = censusPaceSnapshot.applyGate;
  }
  const applyMultipliers = clampCensusApplyMultipliers(advisory?.multipliers || {});
  const applyForPace = !!censusPaceSnapshot.applyMultipliers && !!s.applyAdjustedAssumptions;
  const advisoryPace = censusPaceSnapshot.pace || {
    ready: false,
    reason: "rows_not_ready",
    availableAph: null,
    availableAphRange: null,
    requiredAph: null,
    gapPct: null,
    ratio: null,
    feasible: null,
    severity: "muted",
    nearTop: null,
    requiredAttemptsPerWeek: null,
    capacityHoursPerWeek: null,
  };
  const advisoryFmtIndex = (value) => {
    return formatCensusFixed(value, 2);
  };
  const advisoryFmtPercent = (value) => formatPercentFromUnit(value, 1);
  const advisoryFmtNumber = (value) => {
    return formatCensusFixed(value, 1);
  };
  const advisoryFmtBand = (band) => {
    const low = Number(band?.low);
    const mid = Number(band?.mid);
    const high = Number(band?.high);
    if (!Number.isFinite(low) || !Number.isFinite(mid) || !Number.isFinite(high)) return "—";
    return `${advisoryFmtNumber(low)} / ${advisoryFmtNumber(mid)} / ${advisoryFmtNumber(high)}`;
  };
  const advisoryFmtAgeMix = (ageDistribution) => {
    const age = ageDistribution && typeof ageDistribution === "object" ? ageDistribution : {};
    return [
      `18-24 ${advisoryFmtPercent(age.age18to24)}`,
      `25-34 ${advisoryFmtPercent(age.age25to34)}`,
      `35-44 ${advisoryFmtPercent(age.age35to44)}`,
      `45-64 ${advisoryFmtPercent(age.age45to64)}`,
      `65+ ${advisoryFmtPercent(age.age65Plus)}`,
    ].join(" | ");
  };
  const advisoryRows = advisory.ready
    ? [
        { label: "Field speed index", value: `${advisoryFmtIndex(advisory.indices.fieldSpeed)} (${advisory.bands.fieldSpeed})` },
        { label: "Persuasion environment", value: `${advisoryFmtIndex(advisory.indices.persuasionEnvironment)} (${advisory.bands.persuasionEnvironment})` },
        { label: "Turnout elasticity", value: `${advisoryFmtIndex(advisory.indices.turnoutElasticity)} (${advisory.bands.turnoutElasticity})` },
        { label: "Turnout potential index", value: `${advisoryFmtIndex(advisory.indices.turnoutPotential)} (${advisory.bands.turnoutPotential})` },
        { label: "Field difficulty", value: `${advisoryFmtIndex(advisory.indices.fieldDifficulty)} (${advisory.bands.fieldDifficulty})` },
        {
          label: "Housing density ratio (units / resident)",
          value: `${advisoryFmtIndex(advisory.indices.densityRatio)} (${advisory.indices?.densityBand?.label || "—"})`,
        },
        {
          label: "Vehicle availability / no-vehicle HH",
          value: `${advisoryFmtPercent(advisory.indices.vehicleAvailability)} / ${advisoryFmtPercent(advisory.indices.noVehicleShare)}`,
        },
        {
          label: "Long / super commute share",
          value: `${advisoryFmtPercent(advisory.indices.longCommuteShare)} / ${advisoryFmtPercent(advisory.indices.superCommuteShare)}`,
        },
        {
          label: "No-internet share",
          value: advisoryFmtPercent(advisory.indices.noInternetShare),
        },
        {
          label: "Poverty share",
          value: advisoryFmtPercent(advisory.indices.povertyShare),
        },
        { label: "Walkability factor", value: `${advisoryFmtIndex(advisory.indices.walkability)}x` },
        { label: "Contact probability modifier", value: `${advisoryFmtIndex(advisory.multipliers.contactRate)}x` },
        { label: "Estimated doors/hour factor", value: `${advisoryFmtIndex(advisory.indices.estimatedDoorsPerHourFactor)}x` },
        { label: "Age distribution", value: advisoryFmtAgeMix(advisory.indices.ageDistribution) },
        { label: "Advisory doors/hour multiplier", value: `${advisoryFmtIndex(advisory.multipliers.doorsPerHour)} (${advisoryFmtPercent(advisory.aph.deltaPct)})` },
        { label: "Current blended APH", value: advisoryFmtNumber(advisory.aph.base) },
        { label: "Achievable APH band (p25/p50/p75)", value: advisoryFmtBand(advisory.aph.range) },
        { label: "Environment-adjusted APH (p50)", value: advisoryFmtNumber(advisory.aph.adjusted) },
        { label: "Required APH to hit goal", value: advisoryPace.ready ? advisoryFmtNumber(advisoryPace.requiredAph) : "—" },
        {
          label: "APH feasibility check",
          value: (() => {
            if (!advisoryPace.ready) return "—";
            const req = advisoryFmtNumber(advisoryPace.requiredAph);
            const band = advisoryPace.availableAphRange;
            if (band){
              const low = advisoryFmtNumber(band.low);
              const high = advisoryFmtNumber(band.high);
              if (!advisoryPace.feasible){
                return `Required ${req} > high ${high} (${advisoryFmtPercent(advisoryPace.gapPct)})`;
              }
              if (advisoryPace.severity === "warn"){
                return `Required ${req} near high ${high} (${advisoryFmtPercent(advisoryPace.gapPct)})`;
              }
              return `Required ${req} inside ${low}-${high} (${advisoryFmtPercent(advisoryPace.gapPct)})`;
            }
            if (!advisoryPace.feasible){
              return `Required ${req} above adjusted ${advisoryFmtNumber(advisoryPace.availableAph)} (${advisoryFmtPercent(advisoryPace.gapPct)})`;
            }
            return advisoryPace.severity === "warn"
              ? `Required ${req} near adjusted ${advisoryFmtNumber(advisoryPace.availableAph)} (${advisoryFmtPercent(advisoryPace.gapPct)})`
              : `Required ${req} within adjusted ${advisoryFmtNumber(advisoryPace.availableAph)} (${advisoryFmtPercent(advisoryPace.gapPct)})`;
          })(),
        },
      ]
    : [];
  const applyToggleEnabled = alignment.readyForAssumptions
    && advisory.ready
    && !!Object.keys(runtimeRows).length
    && !!cleanText(s.activeRowsKey);
  if (els.censusApplyAdjustmentsToggle){
    els.censusApplyAdjustmentsToggle.checked = !!s.applyAdjustedAssumptions;
    els.censusApplyAdjustmentsToggle.disabled = !applyToggleEnabled;
  }
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

  if (
    els.censusAdvisoryTbody &&
    typeof els.censusAdvisoryTbody.appendChild === "function" &&
    "innerHTML" in els.censusAdvisoryTbody &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ){
    els.censusAdvisoryTbody.innerHTML = "";
    if (!advisoryRows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted" colspan="2">Load ACS rows for selected GEO units to compute advisory indices.</td>';
      els.censusAdvisoryTbody.appendChild(tr);
    } else {
      for (const row of advisoryRows){
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${row.label}</td><td class="num">${row.value}</td>`;
        els.censusAdvisoryTbody.appendChild(tr);
      }
    }
  }

  const targeting = ensureTargetingState(state);
  const targetingRows = Array.isArray(targeting?.lastRows) ? targeting.lastRows : [];
  const targetingSummary = summarizeTargetingRows(targetingRows, { topListLimit: 0 });
  const targetingMeta = targeting?.lastMeta && typeof targeting.lastMeta === "object" ? targeting.lastMeta : null;
  const targetingRowsLoaded = rowsCount(runtimeRows) > 0;
  const sampleRow = Object.values(runtimeRows || {})[0];
  const sampleValues = sampleRow && typeof sampleRow === "object" ? sampleRow.values : null;
  const targetingSignalChecks = [
    { id: "B01001_001E", label: "age mix" },
    { id: "B15003_001E", label: "education" },
    { id: "B08201_001E", label: "vehicle availability" },
    { id: "B25024_001E", label: "housing structure" },
    { id: "B05001_001E", label: "citizenship" },
    { id: "B08303_001E", label: "commute profile" },
    { id: "B17001_001E", label: "poverty status" },
    { id: "B28002_001E", label: "internet access" },
  ];
  const targetingMissingSignals = targetingRowsLoaded
    ? targetingSignalChecks
      .filter((item) => !Number.isFinite(Number(sampleValues?.[item.id])))
      .map((item) => item.label)
    : [];
  const targetingContextKey = computeTargetingContextKey({ state, censusState: s, config: targeting });
  const targetingStale = !!targetingRows.length
    && !!cleanText(targetingMeta?.contextKey)
    && cleanText(targetingMeta?.contextKey) !== cleanText(targetingContextKey);
  const targetModelOptions = listTargetModelOptions();
  const targetModelLabelById = new Map(targetModelOptions.map((row) => [cleanText(row.id), cleanText(row.label)]));
  const activePresetId = cleanText(targeting.presetId) || cleanText(targeting.modelId);
  const activeModelLabel = targetModelLabelById.get(activePresetId)
    || targetModelLabelById.get(cleanText(targeting.modelId))
    || cleanText(targeting.modelId)
    || "Target model";

  fillSelect(
    els.targetingGeoLevel,
    listTargetGeoLevels().map((row) => ({ value: row.id, label: row.label })),
    targeting.geoLevel,
    "Select geography level",
  );
  fillSelect(
    els.targetingModelId,
    targetModelOptions.map((row) => ({ value: row.id, label: row.label })),
    activePresetId,
    "Select target model",
  );
  if (els.targetingTopN && document.activeElement !== els.targetingTopN){
    els.targetingTopN.value = String(targeting.topN ?? "");
  }
  if (els.targetingMinHousingUnits && document.activeElement !== els.targetingMinHousingUnits){
    els.targetingMinHousingUnits.value = String(targeting.minHousingUnits ?? "");
  }
  if (els.targetingMinPopulation && document.activeElement !== els.targetingMinPopulation){
    els.targetingMinPopulation.value = String(targeting.minPopulation ?? "");
  }
  if (els.targetingMinScore && document.activeElement !== els.targetingMinScore){
    els.targetingMinScore.value = String(targeting.minScore ?? "");
  }
  if (els.targetingOnlyRaceFootprint){
    els.targetingOnlyRaceFootprint.checked = !!targeting.onlyRaceFootprint;
  }
  if (els.targetingPrioritizeYoung){
    els.targetingPrioritizeYoung.checked = !!targeting.criteria?.prioritizeYoung;
  }
  if (els.targetingPrioritizeRenters){
    els.targetingPrioritizeRenters.checked = !!targeting.criteria?.prioritizeRenters;
  }
  if (els.targetingAvoidHighMultiUnit){
    els.targetingAvoidHighMultiUnit.checked = !!targeting.criteria?.avoidHighMultiUnit;
  }
  if (els.targetingDensityFloor){
    const floor = cleanText(targeting.criteria?.densityFloor) || "none";
    els.targetingDensityFloor.value = ["none", "medium", "high"].includes(floor) ? floor : "none";
  }
  const houseModelActive = cleanText(targeting.modelId) === "house_v1";
  if (els.targetingWeightVotePotential && document.activeElement !== els.targetingWeightVotePotential){
    const value = Number(targeting.weights?.votePotential);
    els.targetingWeightVotePotential.value = Number.isFinite(value) ? formatCensusFixed(value, 2, "0.35") : "0.35";
  }
  if (els.targetingWeightTurnoutOpportunity && document.activeElement !== els.targetingWeightTurnoutOpportunity){
    const value = Number(targeting.weights?.turnoutOpportunity);
    els.targetingWeightTurnoutOpportunity.value = Number.isFinite(value) ? formatCensusFixed(value, 2, "0.25") : "0.25";
  }
  if (els.targetingWeightPersuasionIndex && document.activeElement !== els.targetingWeightPersuasionIndex){
    const value = Number(targeting.weights?.persuasionIndex);
    els.targetingWeightPersuasionIndex.value = Number.isFinite(value) ? formatCensusFixed(value, 2, "0.20") : "0.20";
  }
  if (els.targetingWeightFieldEfficiency && document.activeElement !== els.targetingWeightFieldEfficiency){
    const value = Number(targeting.weights?.fieldEfficiency);
    els.targetingWeightFieldEfficiency.value = Number.isFinite(value) ? formatCensusFixed(value, 2, "0.20") : "0.20";
  }
  if (els.targetingWeightVotePotential){
    els.targetingWeightVotePotential.disabled = !houseModelActive;
  }
  if (els.targetingWeightTurnoutOpportunity){
    els.targetingWeightTurnoutOpportunity.disabled = !houseModelActive;
  }
  if (els.targetingWeightPersuasionIndex){
    els.targetingWeightPersuasionIndex.disabled = !houseModelActive;
  }
  if (els.targetingWeightFieldEfficiency){
    els.targetingWeightFieldEfficiency.disabled = !houseModelActive;
  }
  if (els.btnTargetingResetWeights){
    els.btnTargetingResetWeights.disabled = !houseModelActive;
  }
  if (els.btnRunTargeting){
    els.btnRunTargeting.disabled = !targetingRowsLoaded;
  }
  if (els.btnExportTargetingCsv){
    els.btnExportTargetingCsv.disabled = !targetingRows.length;
  }
  if (els.btnExportTargetingJson){
    els.btnExportTargetingJson.disabled = !targetingRows.length;
  }
  if (els.targetingStatus){
    els.targetingStatus.classList.remove("ok", "warn", "bad", "muted");
    if (!targetingRowsLoaded){
      els.targetingStatus.classList.add("muted");
      els.targetingStatus.textContent = "Load ACS rows, then run targeting.";
    } else if (!targetingRows.length){
      els.targetingStatus.classList.add("muted");
      els.targetingStatus.textContent = "Targeting not run yet.";
    } else if (targetingMissingSignals.length){
      els.targetingStatus.classList.add("warn");
      els.targetingStatus.textContent = `Targeting ran with fallback signals (missing: ${targetingMissingSignals.join(", ")}). Use Turnout potential or Field efficiency bundle for full scoring.`;
    } else if (targetingStale){
      els.targetingStatus.classList.add("warn");
      els.targetingStatus.textContent = "Targeting settings or selection changed. Re-run targeting to refresh rankings.";
    } else {
      const topCount = targetingSummary.topTargetCount;
      const turnoutCount = targetingSummary.turnoutPriorityCount;
      const persuasionCount = targetingSummary.persuasionPriorityCount;
      const efficiencyCount = targetingSummary.efficiencyPriorityCount;
      els.targetingStatus.classList.add("ok");
      els.targetingStatus.textContent = `Targeting ready. ${topCount} top targets under ${activeModelLabel}; core priorities flagged (T/P/E): ${turnoutCount}/${persuasionCount}/${efficiencyCount}.`;
    }
  }
  if (els.targetingMeta){
    if (!targetingRows.length || !targetingMeta){
      els.targetingMeta.textContent = `Model: ${activeModelLabel}.`;
    } else {
      const level = cleanText(targetingMeta.geoLevel) || cleanText(targeting.geoLevel) || "block_group";
      const levelLabel = level === "tract" ? "Tract" : "Block group";
      const ranText = cleanText(targetingMeta.ranAt)
        ? fmtTs(targetingMeta.ranAt).replace("Last fetch: ", "")
        : "not recorded";
      const totalRows = Number.isFinite(Number(targetingMeta.totalRows))
        ? Math.max(0, floorCensusInt(targetingMeta.totalRows, 0))
        : targetingRows.length;
      const topN = Number.isFinite(Number(targetingMeta.topN))
        ? Math.max(1, floorCensusInt(targetingMeta.topN, 25))
        : Math.max(1, floorCensusInt(targeting.topN || 25, 25));
      const turnoutCount = targetingSummary.turnoutPriorityCount;
      const persuasionCount = targetingSummary.persuasionPriorityCount;
      const efficiencyCount = targetingSummary.efficiencyPriorityCount;
      const weightNote = houseModelActive
        ? ` House weights: VP ${formatCensusFixed(targeting.weights?.votePotential || 0, 2, "0.00")} · TO ${formatCensusFixed(targeting.weights?.turnoutOpportunity || 0, 2, "0.00")} · PI ${formatCensusFixed(targeting.weights?.persuasionIndex || 0, 2, "0.00")} · FE ${formatCensusFixed(targeting.weights?.fieldEfficiency || 0, 2, "0.00")}.`
        : "";
      els.targetingMeta.textContent = `${levelLabel} ranking · ${totalRows.toLocaleString("en-US")} rows · Top ${topN.toLocaleString("en-US")} flagged · Core top-10 flags (T/P/E): ${turnoutCount}/${persuasionCount}/${efficiencyCount} · Last run ${ranText}.${weightNote}`;
    }
  }
  if (
    els.targetingResultsTbody &&
    typeof els.targetingResultsTbody.appendChild === "function" &&
    "innerHTML" in els.targetingResultsTbody &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ){
    els.targetingResultsTbody.innerHTML = "";
    if (!targetingRowsLoaded){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted" colspan="6">Load ACS rows to enable targeting.</td>';
      els.targetingResultsTbody.appendChild(tr);
    } else if (!targetingRows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted" colspan="6">No ranked GEOs yet. Run targeting to generate results.</td>';
      els.targetingResultsTbody.appendChild(tr);
    } else {
      const cap = Math.max(25, Math.min(300, floorCensusInt(Number(targeting.topN || 25) * 4, 100)));
      const displayRows = targetingRows.slice(0, cap);
      const formatNum = (value, digits = 1) => {
        return formatCensusFixed(value, digits);
      };
      for (const row of displayRows){
        const tr = document.createElement("tr");
        const rankTd = document.createElement("td");
        rankTd.textContent = row.isTopTarget ? `${row.rank}*` : String(row.rank || "—");
        const geoTd = document.createElement("td");
        const geoid = cleanText(row.geoid);
        const label = cleanText(row.label);
        const memberCount = Number.isFinite(Number(row.memberCount)) ? Math.max(1, floorCensusInt(row.memberCount, 1)) : 1;
        geoTd.textContent = memberCount > 1
          ? `${label || geoid} (${memberCount} block groups)`
          : (label || geoid || "—");
        const scoreTd = document.createElement("td");
        scoreTd.className = "num";
        scoreTd.textContent = formatNum(row.score, 1);
        const votesTd = document.createElement("td");
        votesTd.className = "num";
        votesTd.textContent = formatNum(row.votesPerOrganizerHour, 2);
        const reasonTd = document.createElement("td");
        const targetLabel = cleanText(row.targetLabel);
        const reasons = Array.isArray(row.reasons) ? row.reasons.map((x) => cleanText(x)).filter((x) => !!x) : [];
        const reasonText = reasons.length ? reasons.join(" • ") : (cleanText(row.reasonText) || "—");
        const badges = [];
        if (row.isTopTarget) badges.push("Top target");
        if (row.isTurnoutPriority) badges.push("Turnout priority");
        if (row.isPersuasionPriority) badges.push("Persuasion priority");
        if (row.isEfficiencyPriority) badges.push("Efficiency priority");
        const headline = targetLabel ? `${targetLabel}: ${reasonText}` : reasonText;
        reasonTd.textContent = badges.length ? `[${badges.join(" | ")}] ${headline}` : headline;
        const flagsTd = document.createElement("td");
        const flags = Array.isArray(row.flags) ? row.flags.map((x) => cleanText(x)).filter((x) => !!x) : [];
        flagsTd.textContent = flags.length ? flags.join(" • ") : (cleanText(row.flagText) || "—");
        tr.append(rankTd, geoTd, scoreTd, votesTd, reasonTd, flagsTd);
        els.targetingResultsTbody.appendChild(tr);
      }
      if (targetingRows.length > displayRows.length){
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="muted" colspan="6">Showing first ${displayRows.length.toLocaleString("en-US")} of ${targetingRows.length.toLocaleString("en-US")} ranked rows. Export for full list.</td>`;
        els.targetingResultsTbody.appendChild(tr);
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
      const area = formatRaceFootprintScope(storedFootprint);
      const label = resolutionLabel(storedFootprint.resolution) || storedFootprint.resolution || "resolution";
      const match = alignment.selectionMatches
        ? "Current selection matches."
        : "Current selection differs.";
      els.censusRaceFootprintStatus.textContent = `Race footprint: ${storedFootprint.geoids.length} GEOs (${label}) in ${area}. ${match}`;
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
        text = `Footprint capacity population: ${formatCensusWhole(footprintCapacity.population)} (ACS ${footprintCapacity.year || "—"}, bundle ${footprintCapacity.metricSet || "—"}, stale).`;
      } else {
        tone = "ok";
        text = `Footprint capacity population: ${formatCensusWhole(footprintCapacity.population)} (ACS ${footprintCapacity.year || "—"}, bundle ${footprintCapacity.metricSet || "—"}).`;
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

  if (els.censusApplyAdjustmentsStatus){
    els.censusApplyAdjustmentsStatus.classList.remove("ok", "warn", "bad", "muted");
    let tone = "muted";
    let text = applyModeReasonText(applyGate.reason);
    if (applyGate.ready && s.applyAdjustedAssumptions){
      tone = "ok";
      text = `Census-adjusted assumptions are ON. ${formatCensusApplyMultiplierSummary(applyMultipliers)}.`;
    } else if (applyGate.reason === "toggle_off"){
      tone = applyToggleEnabled ? "muted" : "warn";
      if (applyToggleEnabled){
        text = "Census-adjusted assumptions are OFF. Toggle ON to apply bounded multipliers.";
      }
    } else if (String(applyGate.reason || "").startsWith("provenance_") || applyGate.reason === "selection_mismatch"){
      tone = "warn";
    } else {
      tone = "warn";
    }
    els.censusApplyAdjustmentsStatus.classList.add(tone);
    els.censusApplyAdjustmentsStatus.textContent = text;
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

  const allElectionRecords = Array.isArray(electionCsvDryRun.records) ? electionCsvDryRun.records : [];
  const filteredElection = filterElectionDryRunRecords(allElectionRecords, electionCsvDryRun.precinctFilter);
  const electionPreviewRows = filteredElection.rows.slice(0, 50).map((row) => {
    const precinct = cleanText(row?.precinct_id) || "—";
    const candidate = cleanText(row?.candidate) || "—";
    const votesText = formatCensusWhole(row?.votes);
    const totalText = formatCensusWhole(row?.total_votes_precinct);
    return {
      precinct,
      candidate,
      votesText,
      totalText,
    };
  });

  if (els.censusElectionCsvPreviewMeta){
    const filteredCount = filteredElection.rows.length;
    const formatLabel = cleanText(electionCsvDryRun.format) || "—";
    const fileLabel = cleanText(electionCsvDryRun.fileName) || "none";
    const parseCount = Number.isFinite(Number(electionCsvDryRun.parsedRows)) ? Math.max(0, floorCensusInt(electionCsvDryRun.parsedRows, 0)) : 0;
    const normalizedCount = Number.isFinite(Number(electionCsvDryRun.normalizedRows)) ? Math.max(0, floorCensusInt(electionCsvDryRun.normalizedRows, 0)) : 0;
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
    els.censusElectionCsvPreviewTbody.innerHTML = "";
    if (!electionPreviewRows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = filteredElection.tokens.length
        ? '<td class="muted" colspan="4">No rows match the current precinct filter.</td>'
        : '<td class="muted" colspan="4">No dry-run preview yet.</td>';
      els.censusElectionCsvPreviewTbody.appendChild(tr);
    } else {
      for (const row of electionPreviewRows){
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${row.precinct}</td><td>${row.candidate}</td><td class="num">${row.votesText}</td><td class="num">${row.totalText}</td>`;
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

  const advisoryStatusView = buildCensusAdvisoryStatusView({ advisory, advisoryPace, applyForPace });
  if (els.censusAdvisoryStatus){
    els.censusAdvisoryStatus.classList.remove("ok", "warn", "bad", "muted");
    els.censusAdvisoryStatus.classList.add(advisoryStatusView.level);
    els.censusAdvisoryStatus.textContent = advisoryStatusView.text;
  }

  const mapStatusView = buildCensusMapStatusView(s);
  if (els.censusMapStatus){
    els.censusMapStatus.classList.remove("ok", "warn", "bad", "muted");
    els.censusMapStatus.classList.add(mapStatusView.level);
    els.censusMapStatus.textContent = mapStatusView.text;
  }

  if (els.censusMapQaVtdZipStatus){
    els.censusMapQaVtdZipStatus.classList.remove("ok", "warn", "bad", "muted");
    els.censusMapQaVtdZipStatus.classList.add(mapQaVtdUpload.statusLevel || "muted");
    els.censusMapQaVtdZipStatus.textContent = mapQaVtdUpload.statusText || "No VTD ZIP loaded. VTD QA overlay source is TIGERweb.";
  }

  const mapContainer = resolveCensusMapContainer(els);
  if (mapContainer && mapInstance && mapHost === mapContainer && typeof mapInstance.invalidateSize === "function"){
    mapInstance.invalidateSize(false);
  }

  const guide = getElectionCsvUploadGuide();
  const guideFormatCount = Array.isArray(guide?.acceptedFormats) ? guide.acceptedFormats.length : 1;
  const guideText = `Election CSV schema ${guide?.schemaVersion || "v1"}: ${guideFormatCount} supported format(s) (long and wide).`;

  const dryRunStatusText = cleanText(electionCsvDryRun.statusText) || "No dry-run run yet.";
  const mapStatusText = mapStatusView.text;
  const mapQaStatusText = cleanText(mapQaVtdUpload.statusText) || "No VTD ZIP loaded. VTD QA overlay source is TIGERweb.";

  const allRecordsForMeta = Array.isArray(electionCsvDryRun.records) ? electionCsvDryRun.records : [];
  const filteredForMeta = filterElectionDryRunRecords(allRecordsForMeta, electionCsvDryRun.precinctFilter);
  const formatLabel = cleanText(electionCsvDryRun.format) || "—";
  const fileLabel = cleanText(electionCsvDryRun.fileName) || "none";
  const parseCount = Number.isFinite(Number(electionCsvDryRun.parsedRows)) ? Math.max(0, floorCensusInt(electionCsvDryRun.parsedRows, 0)) : 0;
  const normalizedCount = Number.isFinite(Number(electionCsvDryRun.normalizedRows)) ? Math.max(0, floorCensusInt(electionCsvDryRun.normalizedRows, 0)) : 0;
  const errCount = Array.isArray(electionCsvDryRun.errors) ? electionCsvDryRun.errors.length : 0;
  const warnCount = Array.isArray(electionCsvDryRun.warnings) ? electionCsvDryRun.warnings.length : 0;
  const filterLabel = cleanText(electionCsvDryRun.precinctFilter);
  const filterText = filterLabel ? ` · Precinct filter: ${filterLabel} (${filteredForMeta.rows.length.toLocaleString("en-US")} match)` : "";
  const electionPreviewMetaText = `File: ${fileLabel} · Format: ${formatLabel} · Parsed rows: ${parseCount.toLocaleString("en-US")} · Normalized rows: ${normalizedCount.toLocaleString("en-US")} · Errors: ${errCount} · Warnings: ${warnCount}${filterText}`;

  s.bridgeApiKey = cleanText(s.bridgeApiKey) || cleanText(storedKey);
  s.bridgeGeoPaste = cleanText(s.bridgeGeoPaste || els?.censusGeoPaste?.value);
  s.bridgeElectionCsvPrecinctFilter = cleanText(electionCsvDryRun.precinctFilter);
  s.bridgeStateOptions = buildStateRows(stateRows).map((row) => ({
    value: cleanText(row?.value),
    label: cleanText(row?.label || row?.value),
  }));
  s.bridgeCountyOptions = buildSubRows(countyRows).map((row) => ({
    value: cleanText(row?.value),
    label: cleanText(row?.label || row?.value),
    state: cleanText(row?.state),
  }));
  s.bridgePlaceOptions = buildSubRows(placeRowsFiltered).map((row) => ({
    value: cleanText(row?.value),
    label: cleanText(row?.label || row?.value),
    state: cleanText(row?.state),
    county: cleanText(row?.county),
  }));
  s.bridgeTractFilterOptions = tractRows.map((row) => ({
    value: cleanText(row?.value),
    label: cleanText(row?.label || row?.value),
  }));
  s.bridgeSelectionSetOptions = setRows.map((row) => ({
    value: cleanText(row?.value),
    label: cleanText(row?.label || row?.value),
  }));
  s.bridgeGeoSelectOptions = filteredGeoOptions.map((row) => {
    const geoid = cleanText(row?.geoid);
    return {
      value: geoid,
      label: cleanText(row?.label || row?.name || geoid),
      selected: s.selectedGeoids.includes(geoid),
    };
  });
  s.bridgeAggregateRows = tableRows.map((row) => [cleanText(row?.label), cleanText(row?.valueText)]);
  s.bridgeAdvisoryRows = advisoryRows.map((row) => [cleanText(row?.label), cleanText(row?.value)]);
  s.bridgeElectionPreviewRows = electionPreviewRows.map((row) => [
    cleanText(row?.precinct),
    cleanText(row?.candidate),
    cleanText(row?.votesText),
    cleanText(row?.totalText),
  ]);
  s.bridgeAdvisoryStatusText = advisoryStatusView.text;
  s.bridgeElectionCsvGuideStatusText = guideText;
  s.bridgeElectionCsvDryRunStatusText = dryRunStatusText;
  s.bridgeElectionCsvPreviewMetaText = electionPreviewMetaText;
  s.bridgeMapStatusText = mapStatusText;
  s.bridgeMapQaVtdZipStatusText = mapQaStatusText;
}

async function loadStateScopedLists(s, key){
  if (!s.stateFips) return;
  await Promise.all([
    ensureCountyOptions(s.stateFips, key),
    ensurePlaceOptions(s.stateFips, key),
  ]);
}

async function onLoadGeo({ s, key, getState, commitUIUpdate }){
  const resolutionLabel = RESOLUTION_LABEL_BY_ID[cleanText(s.resolution)] || cleanText(s.resolution) || "resolution";
  const countyFips = cleanText(s?.countyFips || s?.county);
  if (!contextReadyForGeo(s)){
    setStatus(s, `Select required geography context for ${resolutionLabel}.`, true);
    commitUIUpdate();
    return;
  }
  const seq = nextSeq(s);
  setLoadingFlags(s, "geo", true);
  setStatus(s, `Loading GEO list for ${contextText(s)} (${resolutionLabel})...`, false);
  commitUIUpdate({ persist: false });
  try{
    const options = await fetchGeoOptions({
      year: s.year,
      resolution: s.resolution,
      stateFips: s.stateFips,
      countyFips,
      key,
    });
    const current = ensureCensusStateModule(getState());
    if (!current || !shouldApplyRequestResult({ activeSeq: current.requestSeq, resultSeq: seq })) return;
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
    clearCensusRowsForKey(current.activeRowsKey);
    current.activeRowsKey = "";
    current.loadedRowCount = 0;
    current.lastFetchAt = "";
    const currentResolutionLabel = RESOLUTION_LABEL_BY_ID[cleanText(current.resolution)] || cleanText(current.resolution) || "resolution";
    setStatus(current, `${options.length} GEO options loaded for ${currentResolutionLabel}.`, false);
  } catch (err){
    const current = ensureCensusStateModule(getState());
    if (!current || !shouldApplyRequestResult({ activeSeq: current.requestSeq, resultSeq: seq })) return;
    const msg = cleanText(err?.message) || "Failed to load GEO list.";
    resetGeoData(current);
    setStatus(current, msg, true);
  }
  const finalState = ensureCensusStateModule(getState());
  if (finalState && shouldApplyRequestResult({ activeSeq: finalState.requestSeq, resultSeq: seq })){
    setLoadingFlags(finalState, "geo", false);
  }
  commitUIUpdate();
}

async function onFetchRows({ s, key, getState, commitUIUpdate }){
  const resolutionLabel = RESOLUTION_LABEL_BY_ID[cleanText(s.resolution)] || cleanText(s.resolution) || "resolution";
  const countyFips = cleanText(s?.countyFips || s?.county);
  if (!contextReadyForGeo(s)){
    setStatus(s, `Select required geography context for ${resolutionLabel}.`, true);
    commitUIUpdate();
    return;
  }
  const seq = nextSeq(s);
  setLoadingFlags(s, "rows", true);
  setStatus(s, `Fetching ACS rows for ${contextText(s)} (${resolutionLabel}, ${s.year})...`, false);
  commitUIUpdate({ persist: false });
  try{
    const chooseCompatibleMetricSet = (audit) => {
      const rows = Array.isArray(audit?.metricSets) ? audit.metricSets : [];
      const compatible = rows.filter((row) => Array.isArray(row?.available) && row.available.length > 0);
      if (!compatible.length) return "";
      const nonAll = compatible.filter((row) => cleanText(row.metricSet) !== "all");
      const pool = nonAll.length ? nonAll : compatible;
      pool.sort((a, b) => {
        const aAvail = Number.isFinite(Number(a?.available?.length)) ? Number(a.available.length) : 0;
        const bAvail = Number.isFinite(Number(b?.available?.length)) ? Number(b.available.length) : 0;
        if (bAvail !== aAvail) return bAvail - aAvail;
        const aCoverage = Number.isFinite(Number(a?.coveragePct)) ? Number(a.coveragePct) : 0;
        const bCoverage = Number.isFinite(Number(b?.coveragePct)) ? Number(b.coveragePct) : 0;
        if (bCoverage !== aCoverage) return bCoverage - aCoverage;
        return cleanText(a?.metricSet).localeCompare(cleanText(b?.metricSet));
      });
      return cleanText(pool[0]?.metricSet);
    };

    let variableNames = variableCatalogCache.get(s.year);
    if (!Array.isArray(variableNames)){
      variableNames = await fetchVariableCatalog({ year: s.year, key });
      variableCatalogCache.set(s.year, variableNames);
    }
    let activeMetricSet = cleanText(s.metricSet) || "core";
    let variableResolution = resolveMetricSetVariables(activeMetricSet, variableNames);
    const bundleAudit = auditMetricSetsWithCatalog(variableNames);
    const summary = bundleAudit?.summary && typeof bundleAudit.summary === "object" ? bundleAudit.summary : null;
    const auditSummaryText = summary
      ? ` Catalog audit: ${summary.fullyCompatible}/${summary.total} bundles fully compatible, ${summary.partiallyCompatible} partial, ${summary.incompatible} incompatible.`
      : "";
    const currentBeforeRows = ensureCensusStateModule(getState());
    if (!currentBeforeRows || !shouldApplyRequestResult({ activeSeq: currentBeforeRows.requestSeq, resultSeq: seq })) return;
    currentBeforeRows.variableCatalogYear = s.year;
    currentBeforeRows.variableCatalogCount = Array.isArray(variableNames) ? variableNames.length : 0;
    if (!variableResolution.available.length){
      const fallbackMetricSet = chooseCompatibleMetricSet(bundleAudit);
      if (!fallbackMetricSet){
        setStatus(currentBeforeRows, `Selected bundle has no compatible ACS variables for year ${s.year}.${auditSummaryText}`, true);
        setLoadingFlags(currentBeforeRows, "rows", false);
        commitUIUpdate();
        return;
      }
      const originalMetricSet = activeMetricSet;
      activeMetricSet = fallbackMetricSet;
      currentBeforeRows.metricSet = fallbackMetricSet;
      s.metricSet = fallbackMetricSet;
      variableResolution = resolveMetricSetVariables(activeMetricSet, variableNames);
      setStatus(
        currentBeforeRows,
        `Selected bundle ${originalMetricSet || "—"} is incompatible with ACS ${s.year}. Auto-switched to ${fallbackMetricSet}.${auditSummaryText}`,
        false
      );
      commitUIUpdate({ persist: false });
    }
    const rowsByGeoid = await fetchAcsRows({
      year: s.year,
      resolution: s.resolution,
      stateFips: s.stateFips,
      countyFips,
      metricSet: activeMetricSet,
      variableNames,
      key,
    });
    const current = ensureCensusStateModule(getState());
    if (!current || !shouldApplyRequestResult({ activeSeq: current.requestSeq, resultSeq: seq })) return;
    const rowsKey = rowsKeyFromState(current);
    const previousRowsKey = cleanText(current.activeRowsKey);
    if (previousRowsKey && previousRowsKey !== rowsKey){
      clearCensusRowsForKey(previousRowsKey);
    }
    setCensusRowsForKey(rowsKey, rowsByGeoid);
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
    const currentResolutionLabel = RESOLUTION_LABEL_BY_ID[cleanText(current.resolution)] || cleanText(current.resolution) || "resolution";
    const missing = Array.isArray(variableResolution.missing) ? variableResolution.missing : [];
    if (missing.length){
      const preview = missing.slice(0, 8).join(", ");
      const extra = missing.length > 8 ? ` +${missing.length - 8} more` : "";
      const coveragePct = Number(variableResolution.coveragePct);
      const coverageText = formatPercentFromUnit(coveragePct, 0, "partial");
      setStatus(
        current,
        `Loaded ${current.loadedRowCount} ACS rows for ${currentResolutionLabel} using bundle ${activeMetricSet}. Bundle fallback active (${coverageText} vars present); missing: ${preview}${extra}.${auditSummaryText}`,
        false,
      );
    } else {
      setStatus(current, `Loaded ${current.loadedRowCount} ACS rows for ${currentResolutionLabel} using bundle ${activeMetricSet}.${auditSummaryText}`, false);
    }
  } catch (err){
    const current = ensureCensusStateModule(getState());
    if (!current || !shouldApplyRequestResult({ activeSeq: current.requestSeq, resultSeq: seq })) return;
    const msg = cleanText(err?.message) || "Failed to fetch ACS rows.";
    disableCensusApplyAdjustments(current);
    current.rowsByGeoid = {};
    clearCensusRowsForKey(current.activeRowsKey);
    current.activeRowsKey = "";
    current.loadedRowCount = 0;
    current.lastFetchAt = "";
    setStatus(current, msg, true);
  }
  const finalState = ensureCensusStateModule(getState());
  if (finalState && shouldApplyRequestResult({ activeSeq: finalState.requestSeq, resultSeq: seq })){
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
  if (!els || !currentState() || typeof commitUIUpdate !== "function"){
    censusRuntimeBridgeRunAction = null;
    return;
  }
  censusRuntimeBridgeEls = els;
  censusRuntimeBridgeGetState = currentState;
  censusRuntimeBridgeCommitUIUpdate = commitUIUpdate;

  const withState = (fn) => {
    const state = currentState();
    if (!state) return;
    const s = ensureCensusStateModule(state);
    if (!s) return;
    fn(state, s);
  };
  const withTargeting = (fn) => {
    withState((state, s) => {
      const targeting = ensureTargetingState(state);
      fn(state, s, targeting);
    });
  };
  const getCensusApiKeyForActions = () => {
    const s = ensureCensusStateModule(currentState());
    return cleanText(s?.bridgeApiKey) || cleanText(els.censusApiKey?.value) || readCensusApiKeyModule();
  };

  if (!latestAcsYearResolutionStarted){
    latestAcsYearResolutionStarted = true;
    void (async () => {
      const key = getCensusApiKeyForActions();
      try {
        await resolveLatestAcs5Year({ key });
      } catch {
        // Keep fallback latest-year behavior when metadata lookup is unavailable.
      }
      let changed = false;
      withState((_, s) => {
        changed = enforceLatestAcsYear(s);
      });
      if (changed){
        commitUIUpdate();
      }
    })();
  }

  const runCensusLoadGeoAction = async () => {
    const key = getCensusApiKeyForActions();
    try {
      await resolveLatestAcs5Year({ key });
    } catch {
      // Non-blocking; fallback latest-year logic remains active.
    }
    let changedYear = false;
    withState((_, s) => {
      changedYear = enforceLatestAcsYear(s);
    });
    if (changedYear){
      commitUIUpdate();
    }
    let s = ensureCensusStateModule(currentState());
    if (!s) return false;
    try{
      await ensureStateOptions(key);
      await loadStateScopedLists(s, key);
    } catch (err){
      s = ensureCensusStateModule(currentState());
      if (s){
        setStatus(s, cleanText(err?.message) || "Failed to refresh state lookups.", true);
        commitUIUpdate();
      }
      return false;
    }
    s = ensureCensusStateModule(currentState());
    if (!s) return false;
    await onLoadGeo({ s, key, getState: currentState, commitUIUpdate });
    return true;
  };

  const runCensusFetchRowsAction = async () => {
    const key = getCensusApiKeyForActions();
    try {
      await resolveLatestAcs5Year({ key });
    } catch {
      // Non-blocking; fallback latest-year logic remains active.
    }
    let changedYear = false;
    withState((_, s) => {
      changedYear = enforceLatestAcsYear(s);
    });
    if (changedYear){
      commitUIUpdate();
    }
    const s = ensureCensusStateModule(currentState());
    if (!s) return false;
    await onFetchRows({ s, key, getState: currentState, commitUIUpdate });
    return true;
  };

  const runCensusSelectAllAction = () => {
    withState((_, s) => {
      disableCensusApplyAdjustments(s);
      const filteredGeoOptions = filterGeoOptions(s.geoOptions, {
        search: s.geoSearch,
        tractFilter: s.tractFilter,
      });
      s.selectedGeoids = filteredGeoOptions.map((row) => cleanText(row.geoid));
      setStatus(s, `Selected ${s.selectedGeoids.length} GEO units.`, false);
    });
    commitUIUpdate();
    return true;
  };

  const runCensusClearSelectionAction = () => {
    withState((_, s) => {
      disableCensusApplyAdjustments(s);
      s.selectedGeoids = [];
      setStatus(s, "Selection cleared.", false);
    });
    commitUIUpdate();
    return true;
  };

  const runCensusSetRaceFootprintAction = () => {
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
        setStatus(s, `Race footprint set (${footprint.geoids.length} GEOs, pop ${formatCensusWhole(population)}).`, false);
      } else {
        setStatus(s, `Race footprint set (${footprint.geoids.length} GEOs). Population unavailable for current ACS rows.`, false);
      }
    });
    commitUIUpdate();
    return true;
  };

  const runCensusClearRaceFootprintAction = () => {
    withState((state, s) => {
      disableCensusApplyAdjustments(s);
      state.raceFootprint = makeDefaultRaceFootprint();
      state.assumptionsProvenance = makeDefaultAssumptionProvenance();
      state.footprintCapacity = makeDefaultFootprintCapacity();
      setStatus(s, "Race footprint cleared.", false);
    });
    commitUIUpdate();
    return true;
  };

  const runCensusDownloadElectionCsvTemplateAction = () => {
    withState((_, s) => {
      const csv = buildElectionCsvTemplate();
      const ok = downloadTextFile(csv, `election-results-template-${fileStamp()}.csv`, "text/csv");
      setStatus(s, ok ? "Election CSV template downloaded." : "Election CSV template download failed.", !ok);
    });
    commitUIUpdate({ persist: false });
    return true;
  };

  const runCensusDownloadElectionCsvWideTemplateAction = () => {
    withState((_, s) => {
      const csv = buildElectionCsvWideTemplate();
      const ok = downloadTextFile(csv, `election-results-wide-template-${fileStamp()}.csv`, "text/csv");
      setStatus(s, ok ? "Election wide-format CSV template downloaded." : "Election wide-format CSV template download failed.", !ok);
    });
    commitUIUpdate({ persist: false });
    return true;
  };

  const runCensusElectionDryRunAction = async () => {
    const seq = ++electionCsvRequestSeq;
    const file = els.censusElectionCsvFile?.files?.[0] || censusRuntimeFileCache.electionCsvFile;
    const state = currentState();
    const s = ensureCensusStateModule(state);
    if (!file || !s){
      setElectionCsvDryRunStatus("Select an election CSV file first.", "warn");
      commitUIUpdate({ persist: false });
      return false;
    }
    setElectionCsvDryRunStatus(`Running dry-run parse for ${cleanText(file.name)}...`, "warn");
    commitUIUpdate({ persist: false });
    try{
      const text = await readTextFile(file);
      if (seq !== electionCsvRequestSeq) return false;
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
        return false;
      }
      const normalized = normalizeElectionCsvRows(parsed.rows, {
        headers: parsed.headers,
        context: {
          state_fips: cleanText(s.stateFips),
          county_fips: cleanText(s.countyFips),
          election_date: cleanText(state?.electionDate),
        },
      });
      if (seq !== electionCsvRequestSeq) return false;
      electionCsvDryRun.format = cleanText(normalized.format) || "invalid";
      electionCsvDryRun.records = Array.isArray(normalized.records) ? normalized.records.slice() : [];
      electionCsvDryRun.normalizedRows = electionCsvDryRun.records.length;
      electionCsvDryRun.errors = Array.isArray(normalized.errors) ? normalized.errors.slice(0, 200) : [];
      electionCsvDryRun.warnings = Array.isArray(normalized.warnings) ? normalized.warnings.slice(0, 200) : [];
      if (!normalized.ok){
        const first = cleanText(electionCsvDryRun.errors[0]) || "validation failed.";
        setElectionCsvDryRunStatus(`Dry-run failed (${electionCsvDryRun.format || "invalid"}): ${first}`, "bad");
        commitUIUpdate({ persist: false });
        return false;
      }
      if (electionCsvDryRun.warnings.length){
        setElectionCsvDryRunStatus(`Dry-run parsed ${electionCsvDryRun.normalizedRows.toLocaleString("en-US")} normalized candidate rows (${electionCsvDryRun.format} format) with ${electionCsvDryRun.warnings.length} warning(s).`, "warn");
      } else {
        setElectionCsvDryRunStatus(`Dry-run parsed ${electionCsvDryRun.normalizedRows.toLocaleString("en-US")} normalized candidate rows (${electionCsvDryRun.format} format).`, "ok");
      }
    } catch (err){
      if (seq !== electionCsvRequestSeq) return false;
      electionCsvDryRun.records = [];
      electionCsvDryRun.normalizedRows = 0;
      electionCsvDryRun.errors = [cleanText(err?.message) || "Dry-run failed."];
      setElectionCsvDryRunStatus(electionCsvDryRun.errors[0], "bad");
    }
    commitUIUpdate({ persist: false });
    return true;
  };

  const runCensusElectionClearAction = () => {
    resetElectionCsvDryRunRuntime();
    censusRuntimeFileCache.electionCsvFile = null;
    if (els.censusElectionCsvFile) els.censusElectionCsvFile.value = "";
    commitUIUpdate({ persist: false });
    return true;
  };

  const runCensusApplyGeoPasteAction = () => {
    withState((_, s) => {
      disableCensusApplyAdjustments(s);
      const pasteText = cleanText(s.bridgeGeoPaste || els.censusGeoPaste?.value);
      const parsed = parseGeoidInput(pasteText, s.resolution);
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
    return true;
  };

  const runCensusSaveSelectionSetAction = () => {
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
    return true;
  };

  const runCensusLoadSelectionSetAction = () => {
    withState((_, s) => {
      disableCensusApplyAdjustments(s);
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
    return true;
  };

  const runCensusDeleteSelectionSetAction = () => {
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
    return true;
  };

  const runCensusExportAggregateCsvAction = () => {
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
    return true;
  };

  const runCensusExportAggregateJsonAction = () => {
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
    return true;
  };

  const runCensusLoadMapAction = async () => {
    const s = ensureCensusStateModule(currentState());
    if (!s) return false;
    await onLoadMapBoundaries({ s, els, commitUIUpdate });
    return true;
  };

  const runCensusClearMapAction = () => {
    clearMapOverlay("Map overlay cleared.");
    commitUIUpdate({ persist: false });
    return true;
  };

  const runCensusClearVtdZipAction = async () => {
    mapQaVtdUploadSeq += 1;
    censusRuntimeFileCache.mapQaVtdZip = null;
    clearMapQaVtdUploadRuntime();
    if (els.censusMapQaVtdZip){
      els.censusMapQaVtdZip.value = "";
    }
    const s = ensureCensusStateModule(currentState());
    if (!s){
      commitUIUpdate({ persist: false });
      return false;
    }
    if (s.mapQaVtdOverlay && mapRuntimeStatus.featureCount > 0){
      setStatus(s, "VTD ZIP cleared. Reloading QA overlay from TIGERweb...", false);
      commitUIUpdate({ persist: false });
      await onLoadMapBoundaries({ s, els, commitUIUpdate });
      return true;
    }
    if (s.mapQaVtdOverlay){
      clearMapQaOverlay("VTD ZIP cleared. Reload boundaries to draw TIGERweb QA overlay.");
      setStatus(s, "VTD ZIP cleared. Reload boundaries to use TIGERweb QA source.", false);
    } else {
      setStatus(s, "VTD ZIP cleared.", false);
    }
    commitUIUpdate({ persist: false });
    return true;
  };

  const censusRuntimeActionHandlers = Object.freeze({
    loadGeo: () => { void runCensusLoadGeoAction(); return { handled: true, ok: true, code: "dispatched" }; },
    fetchRows: () => { void runCensusFetchRowsAction(); return { handled: true, ok: true, code: "dispatched" }; },
    applyGeoPaste: () => ({ handled: true, ok: runCensusApplyGeoPasteAction(), code: "triggered" }),
    selectAll: () => ({ handled: true, ok: runCensusSelectAllAction(), code: "triggered" }),
    clearSelection: () => ({ handled: true, ok: runCensusClearSelectionAction(), code: "triggered" }),
    saveSelectionSet: () => ({ handled: true, ok: runCensusSaveSelectionSetAction(), code: "triggered" }),
    loadSelectionSet: () => ({ handled: true, ok: runCensusLoadSelectionSetAction(), code: "triggered" }),
    deleteSelectionSet: () => ({ handled: true, ok: runCensusDeleteSelectionSetAction(), code: "triggered" }),
    exportAggregateCsv: () => ({ handled: true, ok: runCensusExportAggregateCsvAction(), code: "triggered" }),
    exportAggregateJson: () => ({ handled: true, ok: runCensusExportAggregateJsonAction(), code: "triggered" }),
    setRaceFootprint: () => ({ handled: true, ok: runCensusSetRaceFootprintAction(), code: "triggered" }),
    clearRaceFootprint: () => ({ handled: true, ok: runCensusClearRaceFootprintAction(), code: "triggered" }),
    downloadElectionTemplate: () => ({ handled: true, ok: runCensusDownloadElectionCsvTemplateAction(), code: "triggered" }),
    downloadElectionWideTemplate: () => ({ handled: true, ok: runCensusDownloadElectionCsvWideTemplateAction(), code: "triggered" }),
    electionDryRun: () => { void runCensusElectionDryRunAction(); return { handled: true, ok: true, code: "dispatched" }; },
    electionClear: () => ({ handled: true, ok: runCensusElectionClearAction(), code: "triggered" }),
    loadMap: () => { void runCensusLoadMapAction(); return { handled: true, ok: true, code: "dispatched" }; },
    clearMap: () => ({ handled: true, ok: runCensusClearMapAction(), code: "triggered" }),
    clearVtdZip: () => { void runCensusClearVtdZipAction(); return { handled: true, ok: true, code: "dispatched" }; },
  });

  censusRuntimeBridgeRunAction = (action) => {
    const key = cleanText(action);
    const handler = censusRuntimeActionHandlers[key];
    if (typeof handler !== "function"){
      return { handled: false };
    }
    return handler();
  };

  if (els.censusApiKey){
    els.censusApiKey.addEventListener("change", async () => {
      const key = cleanText(els.censusApiKey.value);
      writeCensusApiKeyModule(key);
      withState((_, s) => {
        setStatus(s, "Census API override saved. Loading geography lookups...", false);
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
        if (latest.stateFips){
          setStatus(latest, "Census module ready.", false);
        } else {
          setStatus(
            latest,
            stateOptionsUsingFallback
              ? "State list loaded (fallback). Select state and geography, then load GEO list."
              : "State list loaded. Select state and geography, then load GEO list.",
            false
          );
        }
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
        const requestedYear = cleanText(els.censusAcsYear.value);
        s.year = requestedYear;
        const forcedToLatest = enforceLatestAcsYear(s, {
          reasonPrefix: requestedYear && requestedYear !== cleanText(listAcsYears()[0])
            ? `Requested ACS year ${requestedYear} is unavailable.`
            : "",
        });
        if (!forcedToLatest){
          const applyWasOn = disableCensusApplyAdjustments(s);
          clearCensusRowsForYearShift(s);
          const suffix = applyWasOn ? " Census-adjusted assumptions turned OFF." : "";
          setStatus(s, `ACS year set to ${s.year}. Cached rows cleared; footprint/provenance now stale until refetch.${suffix}`, false);
        }
      });
      commitUIUpdate();
    });
  }

  if (els.censusMetricSet){
    els.censusMetricSet.addEventListener("change", () => {
      withState((_, s) => {
        const applyWasOn = disableCensusApplyAdjustments(s);
        s.metricSet = cleanText(els.censusMetricSet.value) || "core";
        clearCensusRowsForYearShift(s);
        const suffix = applyWasOn ? " Census-adjusted assumptions turned OFF." : "";
        setStatus(s, `Bundle changed. Cached rows cleared; footprint/provenance now stale until refetch.${suffix}`, false);
      });
      commitUIUpdate();
    });
  }

  if (els.censusResolution){
    els.censusResolution.addEventListener("change", () => {
      const requestedResolution = cleanText(els.censusResolution.value) || "tract";
      withState((_, s) => {
        s.resolution = requestedResolution;
        if (!resolutionNeedsCounty(s.resolution) && s.resolution !== "place"){
          s.countyFips = "";
        }
        if (s.resolution !== "block_group"){
          s.tractFilter = "";
        }
        resetGeoData(s);
        const label = RESOLUTION_LABEL_BY_ID[cleanText(s.resolution)] || cleanText(s.resolution);
        setStatus(s, `Resolution set to ${label || s.resolution}. Load GEO list next.`, false);
      });
      commitUIUpdate();
      const latest = ensureCensusStateModule(currentState());
      if (latest && latest.resolution !== requestedResolution){
        withState((_, s) => {
          setStatus(s, `Resolution "${requestedResolution}" is unavailable in the loaded runtime. Hard refresh to load the latest JS bundle.`, true);
        });
        commitUIUpdate();
      }
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
        setStatus(s, s.stateFips ? "Loading lookup lists..." : "Select a state to continue.", false);
      });
      commitUIUpdate({ persist: false });
      const s = ensureCensusStateModule(currentState());
      if (!s || !s.stateFips) return;
      try{
        await ensureStateOptions(key);
        await loadStateScopedLists(s, key);
        const latest = ensureCensusStateModule(currentState());
        if (!latest || !latest.stateFips) return;
        setStatus(latest, "Lookup lists loaded. Choose geography context and load GEO list.", false);
      } catch (err){
        const latest = ensureCensusStateModule(currentState());
        if (!latest) return;
        setStatus(latest, cleanText(err?.message) || "Failed to load lookup lists.", true);
      }
      commitUIUpdate();
    });
  }

  if (els.censusCountyFips){
    els.censusCountyFips.addEventListener("change", () => {
      withState((_, s) => {
        s.countyFips = cleanText(els.censusCountyFips.value);
        s.placeFips = "";
        resetGeoData(s);
        setStatus(s, s.countyFips ? "County set. Load GEO list next." : "Select county to continue.", false);
      });
      commitUIUpdate();
    });
  }

  if (els.censusPlaceFips){
    els.censusPlaceFips.addEventListener("change", () => {
      withState((_, s) => {
        disableCensusApplyAdjustments(s);
        s.placeFips = cleanText(els.censusPlaceFips.value);
        if (s.resolution === "place" && s.geoOptions.length){
          const selected = placeGeoid(s.stateFips, s.placeFips);
          s.selectedGeoids = selected ? [selected] : [];
          setStatus(s, s.placeFips ? "Place set. Selection updated." : "Select place to continue.", false);
        } else if (s.resolution === "place"){
          resetGeoData(s);
          setStatus(s, s.placeFips ? "Place set. Load GEO list next." : "Select place to continue.", false);
        } else {
          setStatus(s, s.placeFips ? "Place selected. Current resolution does not use place filter." : "Place cleared.", false);
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

  if (els.censusGeoPaste){
    els.censusGeoPaste.addEventListener("input", () => {
      withState((_, s) => {
        s.bridgeGeoPaste = cleanText(els.censusGeoPaste.value);
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
    els.btnCensusLoadGeo.addEventListener("click", () => {
      void runCensusLoadGeoAction();
    });
  }

  if (els.btnCensusFetchRows){
    els.btnCensusFetchRows.addEventListener("click", () => {
      void runCensusFetchRowsAction();
    });
  }

  if (els.censusGeoSelect){
    els.censusGeoSelect.addEventListener("change", () => {
      withState((_, s) => {
        disableCensusApplyAdjustments(s);
        s.selectedGeoids = selectionFromMultiSelect(els.censusGeoSelect);
        setStatus(s, "Selection updated.", false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusSelectAll){
    els.btnCensusSelectAll.addEventListener("click", () => {
      runCensusSelectAllAction();
    });
  }

  if (els.btnCensusClearSelection){
    els.btnCensusClearSelection.addEventListener("click", () => {
      runCensusClearSelectionAction();
    });
  }

  if (els.btnCensusSetRaceFootprint){
    els.btnCensusSetRaceFootprint.addEventListener("click", () => {
      runCensusSetRaceFootprintAction();
    });
  }

  if (els.btnCensusClearRaceFootprint){
    els.btnCensusClearRaceFootprint.addEventListener("click", () => {
      runCensusClearRaceFootprintAction();
    });
  }

  if (els.censusApplyAdjustmentsToggle){
    els.censusApplyAdjustmentsToggle.addEventListener("change", () => {
      withState((state, s) => {
        const wantsOn = !!els.censusApplyAdjustmentsToggle.checked;
        if (!wantsOn){
          s.applyAdjustedAssumptions = false;
          setStatus(s, "Census-adjusted assumptions turned OFF.", false);
          return;
        }
        const { runtimeRows, aggregate } = aggregateSnapshot(s);
        const canonicalDoorShare = resolveCanonicalDoorShareUnit(state, { fallback: 0.5 }) ?? 0.5;
        const advisory = buildCensusAssumptionAdvisory({
          aggregate,
          doorShare: canonicalDoorShare,
          doorsPerHour: resolveCanonicalDoorsPerHour(state),
          callsPerHour: resolveCanonicalCallsPerHour(state),
          rowsByGeoid: runtimeRows,
          selectedGeoids: s.selectedGeoids,
        });
        const applyGate = evaluateCensusApplyMode({
          applyRequested: true,
          censusState: s,
          raceFootprint: state.raceFootprint,
          assumptionsProvenance: state.assumptionsProvenance,
          advisoryReady: !!advisory.ready,
          hasRows: !!Object.keys(runtimeRows).length && !!cleanText(s.activeRowsKey),
        });
        if (!applyGate.ready){
          s.applyAdjustedAssumptions = false;
          setStatus(s, applyModeReasonText(applyGate.reason), true);
          return;
        }
        const multipliers = clampCensusApplyMultipliers(advisory.multipliers);
        s.applyAdjustedAssumptions = true;
        setStatus(
          s,
          `Census-adjusted assumptions ON (${formatCensusApplyMultiplierSummary(multipliers)}).`,
          false,
        );
      });
      commitUIUpdate();
    });
  }

  if (els.btnCensusDownloadElectionCsvTemplate){
    els.btnCensusDownloadElectionCsvTemplate.addEventListener("click", () => {
      runCensusDownloadElectionCsvTemplateAction();
    });
  }

  if (els.btnCensusDownloadElectionCsvWideTemplate){
    els.btnCensusDownloadElectionCsvWideTemplate.addEventListener("click", () => {
      runCensusDownloadElectionCsvWideTemplateAction();
    });
  }

  if (els.censusElectionCsvFile){
    els.censusElectionCsvFile.addEventListener("change", () => {
      const file = els.censusElectionCsvFile?.files?.[0];
      censusRuntimeFileCache.electionCsvFile = file || null;
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
      setElectionCsvDryRunStatus(`Selected file ${electionCsvDryRun.fileName} (${formatCensusFileSizeKb(electionCsvDryRun.fileSize)}).`, "muted");
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
    els.btnCensusElectionCsvDryRun.addEventListener("click", () => {
      void runCensusElectionDryRunAction();
    });
  }

  if (els.btnCensusElectionCsvClear){
    els.btnCensusElectionCsvClear.addEventListener("click", () => {
      runCensusElectionClearAction();
    });
  }

  if (els.btnCensusApplyGeoPaste){
    els.btnCensusApplyGeoPaste.addEventListener("click", () => {
      runCensusApplyGeoPasteAction();
    });
  }

  if (els.btnCensusSaveSelectionSet){
    els.btnCensusSaveSelectionSet.addEventListener("click", () => {
      runCensusSaveSelectionSetAction();
    });
  }

  if (els.btnCensusLoadSelectionSet){
    els.btnCensusLoadSelectionSet.addEventListener("click", () => {
      runCensusLoadSelectionSetAction();
    });
  }

  if (els.btnCensusDeleteSelectionSet){
    els.btnCensusDeleteSelectionSet.addEventListener("click", () => {
      runCensusDeleteSelectionSetAction();
    });
  }

  if (els.btnCensusExportAggregateCsv){
    els.btnCensusExportAggregateCsv.addEventListener("click", () => {
      runCensusExportAggregateCsvAction();
    });
  }

  if (els.btnCensusExportAggregateJson){
    els.btnCensusExportAggregateJson.addEventListener("click", () => {
      runCensusExportAggregateJsonAction();
    });
  }

  if (els.targetingGeoLevel){
    els.targetingGeoLevel.addEventListener("change", () => {
      withTargeting((_, s, targeting) => {
        applyTargetingFieldPatch(targeting, "geoLevel", els.targetingGeoLevel.value);
        setStatus(s, "Targeting geography level updated. Re-run targeting to refresh rankings.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingModelId){
    els.targetingModelId.addEventListener("change", () => {
      withTargeting((_, s, targeting) => {
        const nextModelId = cleanText(els.targetingModelId.value) || targeting.modelId;
        const applied = applyTargetModelPreset(targeting, nextModelId);
        const presetLabel = cleanText(applied?.preset?.label) || "model preset";
        setStatus(s, `Target model preset applied (${presetLabel}). Re-run targeting to refresh rankings.`, false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingTopN){
    els.targetingTopN.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "topN", els.targetingTopN.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingMinHousingUnits){
    els.targetingMinHousingUnits.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "minHousingUnits", els.targetingMinHousingUnits.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingMinPopulation){
    els.targetingMinPopulation.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "minPopulation", els.targetingMinPopulation.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingMinScore){
    els.targetingMinScore.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "minScore", els.targetingMinScore.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingOnlyRaceFootprint){
    els.targetingOnlyRaceFootprint.addEventListener("change", () => {
      withTargeting((_, s, targeting) => {
        applyTargetingFieldPatch(targeting, "onlyRaceFootprint", !!els.targetingOnlyRaceFootprint.checked);
        setStatus(s, "Targeting footprint filter updated. Re-run targeting to refresh rankings.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingPrioritizeYoung){
    els.targetingPrioritizeYoung.addEventListener("change", () => {
      withTargeting((_, s, targeting) => {
        applyTargetingFieldPatch(targeting, "prioritizeYoung", !!els.targetingPrioritizeYoung.checked);
        setStatus(s, "Targeting age-priority rule updated. Re-run targeting to refresh rankings.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingPrioritizeRenters){
    els.targetingPrioritizeRenters.addEventListener("change", () => {
      withTargeting((_, s, targeting) => {
        applyTargetingFieldPatch(targeting, "prioritizeRenters", !!els.targetingPrioritizeRenters.checked);
        setStatus(s, "Targeting renter-priority rule updated. Re-run targeting to refresh rankings.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingAvoidHighMultiUnit){
    els.targetingAvoidHighMultiUnit.addEventListener("change", () => {
      withTargeting((_, s, targeting) => {
        applyTargetingFieldPatch(targeting, "avoidHighMultiUnit", !!els.targetingAvoidHighMultiUnit.checked);
        setStatus(s, "Targeting multi-unit filter updated. Re-run targeting to refresh rankings.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingDensityFloor){
    els.targetingDensityFloor.addEventListener("change", () => {
      withTargeting((_, s, targeting) => {
        applyTargetingFieldPatch(targeting, "densityFloor", els.targetingDensityFloor.value);
        setStatus(s, "Targeting density floor updated. Re-run targeting to refresh rankings.", false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingWeightVotePotential){
    els.targetingWeightVotePotential.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "weightVotePotential", els.targetingWeightVotePotential.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingWeightTurnoutOpportunity){
    els.targetingWeightTurnoutOpportunity.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "weightTurnoutOpportunity", els.targetingWeightTurnoutOpportunity.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingWeightPersuasionIndex){
    els.targetingWeightPersuasionIndex.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "weightPersuasionIndex", els.targetingWeightPersuasionIndex.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.targetingWeightFieldEfficiency){
    els.targetingWeightFieldEfficiency.addEventListener("input", () => {
      withTargeting((_, __, targeting) => {
        applyTargetingFieldPatch(targeting, "weightFieldEfficiency", els.targetingWeightFieldEfficiency.value);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnTargetingResetWeights){
    els.btnTargetingResetWeights.addEventListener("click", () => {
      withTargeting((_, s, targeting) => {
        const presetId = cleanText(targeting.presetId) || cleanText(targeting.modelId) || "turnout_opportunity";
        const reset = resetTargetingWeightsToPreset(targeting, presetId);
        const presetLabel = cleanText(reset?.preset?.label) || "House model";
        setStatus(s, `${presetLabel} weights reset to preset defaults.`, false);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnRunTargeting){
    els.btnRunTargeting.addEventListener("click", () => {
      withTargeting((state, s, targeting) => {
        const runtimeRows = getRowsForState(s);
        const loadedCount = rowsCount(runtimeRows);
        if (!loadedCount){
          setStatus(s, TARGETING_STATUS_LOAD_ROWS_FIRST, true);
          return;
        }
        const result = runTargetRanking({
          state,
          censusState: s,
          rowsByGeoid: runtimeRows,
        });
        const applied = applyTargetingRunResult(targeting, result, { locale: "en-US" });
        if (!applied.hasRows){
          setStatus(s, applied.statusText, false);
          return;
        }
        setStatus(s, applied.statusText, false);
      });
      commitUIUpdate();
    });
  }

  if (els.btnExportTargetingCsv){
    els.btnExportTargetingCsv.addEventListener("click", () => {
      withTargeting((_, s, targeting) => {
        const rows = Array.isArray(targeting.lastRows) ? targeting.lastRows : [];
        if (!rows.length){
          setStatus(s, "Run targeting before exporting CSV.", true);
          return;
        }
        const csv = buildTargetRankingCsv(rows);
        const file = buildTargetRankingExportFilename({
          presetId: cleanText(targeting.presetId),
          modelId: cleanText(targeting.modelId),
          extension: "csv",
          stamp: fileStamp(),
        });
        const ok = downloadTextFile(csv, file, "text/csv");
        setStatus(s, ok ? "Target rankings CSV exported." : "Target rankings CSV export failed.", !ok);
      });
      commitUIUpdate({ persist: false });
    });
  }

  if (els.btnExportTargetingJson){
    els.btnExportTargetingJson.addEventListener("click", () => {
      withTargeting((_, s, targeting) => {
        const rows = Array.isArray(targeting.lastRows) ? targeting.lastRows : [];
        if (!rows.length){
          setStatus(s, "Run targeting before exporting JSON.", true);
          return;
        }
        const payload = buildTargetRankingPayload({
          rows,
          meta: targeting.lastMeta,
          config: buildTargetRankingPayloadConfig(targeting),
        });
        const file = buildTargetRankingExportFilename({
          presetId: cleanText(targeting.presetId),
          modelId: cleanText(targeting.modelId),
          extension: "json",
          stamp: fileStamp(),
        });
        const ok = downloadTextFile(JSON.stringify(payload, null, 2), file, "application/json");
        setStatus(s, ok ? "Target rankings JSON exported." : "Target rankings JSON export failed.", !ok);
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

  if (els.censusMapQaVtdZip){
    els.censusMapQaVtdZip.addEventListener("change", async () => {
      const file = els.censusMapQaVtdZip?.files?.[0];
      censusRuntimeFileCache.mapQaVtdZip = file || null;
      if (!file){
        mapQaVtdUploadSeq += 1;
        clearMapQaVtdUploadRuntime();
        const s = ensureCensusStateModule(currentState());
        if (s){
          if (s.mapQaVtdOverlay){
            clearMapQaOverlay("VTD ZIP cleared. Reload boundaries to draw TIGERweb QA overlay.");
            setStatus(s, "VTD ZIP cleared. Reload boundaries to use TIGERweb QA source.", false);
          } else {
            setStatus(s, "VTD ZIP cleared.", false);
          }
        }
        commitUIUpdate({ persist: false });
        return;
      }
      const ok = await loadMapQaVtdZipFile(file);
      const s = ensureCensusStateModule(currentState());
      if (!s){
        commitUIUpdate({ persist: false });
        return;
      }
      if (!ok){
        if (s.mapQaVtdOverlay){
          clearMapQaOverlay();
        }
        setStatus(s, cleanText(mapQaVtdUpload.statusText) || "VTD ZIP load failed.", true);
        commitUIUpdate({ persist: false });
        return;
      }
      setStatus(s, "VTD ZIP loaded. QA overlay will use ZIP polygons for matching state/county context.", false);
      commitUIUpdate({ persist: false });
      if (s.mapQaVtdOverlay && mapRuntimeStatus.featureCount > 0){
        await onLoadMapBoundaries({ s, els, commitUIUpdate });
      }
    });
  }

  if (els.btnCensusMapQaVtdZipClear){
    els.btnCensusMapQaVtdZipClear.addEventListener("click", () => {
      void runCensusClearVtdZipAction();
    });
  }

  if (els.btnCensusLoadMap){
    els.btnCensusLoadMap.addEventListener("click", () => {
      void runCensusLoadMapAction();
    });
  }

  if (els.btnCensusClearMap){
    els.btnCensusClearMap.addEventListener("click", () => {
      runCensusClearMapAction();
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
      if (s.stateFips){
        setStatus(s, "Census module ready.", false);
      } else {
        setStatus(
          s,
          stateOptionsUsingFallback
            ? "State list loaded (fallback). Select state and geography, then load GEO list."
            : "Select state and geography, then load GEO list.",
          false
        );
      }
    } catch {
      setStatus(s, "Could not pre-load Census lookups. Load GEO list manually.", true);
    }
    commitUIUpdate({ persist: false });
  })();
}
