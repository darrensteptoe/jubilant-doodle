import {
  CENSUS_LOCAL_KEY,
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
} from "../core/censusModule.js";

const variableCatalogCache = new Map();
let stateOptionsCache = null;
const countyOptionsCache = new Map();
const placeOptionsCache = new Map();
const rowsCache = new Map();

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
  if (!storage) return "";
  return cleanText(storage.getItem(CENSUS_LOCAL_KEY));
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

function fillSelect(el, rows, value, placeholderLabel){
  if (!el) return;
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
  if (!el) return;
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

function resetGeoData(s){
  s.geoOptions = [];
  s.selectedGeoids = [];
  s.rowsByGeoid = {};
  s.activeRowsKey = "";
  s.loadedRowCount = 0;
  s.lastFetchAt = "";
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
  const key = cleanText(s.activeRowsKey);
  if (!key) return {};
  const rows = rowsCache.get(key);
  return rows && typeof rows === "object" ? rows : {};
}

export function renderCensusPhase1Module({ els, state } = {}){
  if (!els || !state) return;
  const s = ensureCensusStateModule(state);
  if (!s) return;

  const storedKey = readCensusApiKeyModule();
  if (els.censusApiKey && document.activeElement !== els.censusApiKey){
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

  if (els.censusCountyFips){
    els.censusCountyFips.disabled = s.resolution === "place" || !s.stateFips;
  }
  if (els.censusPlaceFips){
    els.censusPlaceFips.disabled = s.resolution !== "place" || !s.stateFips;
  }

  fillMultiSelect(els.censusGeoSelect, s.geoOptions, s.selectedGeoids);

  if (els.btnCensusLoadGeo){
    els.btnCensusLoadGeo.disabled = s.loadingGeo || !contextReadyForGeo(s);
  }
  if (els.btnCensusFetchRows){
    els.btnCensusFetchRows.disabled = s.loadingRows || !contextReadyForGeo(s);
  }
  if (els.btnCensusSelectAll){
    els.btnCensusSelectAll.disabled = !s.geoOptions.length;
  }
  if (els.btnCensusClearSelection){
    els.btnCensusClearSelection.disabled = !s.selectedGeoids.length;
  }

  const runtimeRows = getRowsForState(s);
  const aggregate = aggregateRowsForSelection({
    rowsByGeoid: runtimeRows,
    selectedGeoids: s.selectedGeoids,
    metricSet: s.metricSet,
  });
  const tableRows = buildAggregateTableRows(aggregate, s.metricSet);

  if (els.censusAggregateTbody){
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
    const selectedGeo = s.selectedGeoids.length;
    const loadedRows = rowsCount(runtimeRows);
    els.censusGeoStats.textContent = `${selectedGeo} selected of ${totalGeo} GEOs. ${loadedRows} rows loaded.`;
  }

  if (els.censusSelectionSummary){
    const summary = s.selectedGeoids.length
      ? `Aggregate reflects ${s.selectedGeoids.length} selected GEO units.`
      : "No GEO selected. Select one or more GEO units to aggregate.";
    els.censusSelectionSummary.textContent = summary;
  }

  if (els.censusLastFetch){
    els.censusLastFetch.textContent = fmtTs(s.lastFetchAt);
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
    els.censusApiKey.addEventListener("change", () => {
      writeCensusApiKeyModule(els.censusApiKey.value);
      withState((_, s) => {
        setStatus(s, "Census API key saved in local browser storage.", false);
      });
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
        s.placeFips = s.resolution === "place" ? s.placeFips : "";
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
        } else {
          resetGeoData(s);
          setStatus(s, s.placeFips ? "Place set. Load GEO list next." : "Select place to continue.", false);
        }
      });
      commitUIUpdate();
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
        s.selectedGeoids = s.geoOptions.map((row) => cleanText(row.geoid));
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

  (async () => {
    const key = readCensusApiKeyModule();
    if (!key) return;
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
