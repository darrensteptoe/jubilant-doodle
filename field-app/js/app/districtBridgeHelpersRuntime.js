// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createDistrictBridgeHelpersRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };
  const mutateState = (...args) => call(deps.mutateState, ...args);
  const cleanText = (...args) => call(deps.cleanText, ...args);
  const safeNum = (...args) => call(deps.safeNum, ...args);
  const isScenarioLockedForEdits = (...args) => call(deps.isScenarioLockedForEdits, ...args);
  const formatPercentFromPct = (...args) => call(deps.formatPercentFromPct, ...args);
  const formatWholeNumberByMode = (...args) => call(deps.formatWholeNumberByMode, ...args);
  const roundWholeNumberByMode = (...args) => call(deps.roundWholeNumberByMode, ...args);
  const computeDistrictSupportTotalPctFromState = (...args) => call(deps.computeDistrictSupportTotalPctFromState, ...args);
  const buildDistrictTurnoutFallbackView = (...args) => call(deps.buildDistrictTurnoutFallbackView, ...args);
  const buildDistrictLastFetchText = (...args) => call(deps.buildDistrictLastFetchText, ...args);
  const buildDistrictCensusContextHint = (...args) => call(deps.buildDistrictCensusContextHint, ...args);
  const buildDistrictSelectionSetStatus = (...args) => call(deps.buildDistrictSelectionSetStatus, ...args);
  const buildDistrictGeoStatsText = (...args) => call(deps.buildDistrictGeoStatsText, ...args);
  const buildDistrictSelectionSummaryText = (...args) => call(deps.buildDistrictSelectionSummaryText, ...args);
  const buildDistrictRaceFootprintStatus = (...args) => call(deps.buildDistrictRaceFootprintStatus, ...args);
  const buildDistrictAssumptionProvenanceStatus = (...args) => call(deps.buildDistrictAssumptionProvenanceStatus, ...args);
  const buildDistrictFootprintCapacityStatus = (...args) => call(deps.buildDistrictFootprintCapacityStatus, ...args);
  const buildDistrictApplyAdjustmentsStatus = (...args) => call(deps.buildDistrictApplyAdjustmentsStatus, ...args);
  const getCensusRowsForState = (...args) => call(deps.getCensusRowsForState, ...args) || {};
  const normalizeCensusState = (...args) => call(deps.normalizeCensusState, ...args);
  const resolutionNeedsCounty = (...args) => call(deps.resolutionNeedsCounty, ...args);

  const getWindowRef = () => {
    if (deps.windowRef && typeof deps.windowRef === "object"){
      return deps.windowRef;
    }
    return typeof window !== "undefined" ? window : null;
  };

  function districtBridgeFmtPct(value, digits = 1){
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return formatPercentFromPct(n, digits, "—");
  }

  function districtBridgeFmtInt(value){
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return formatWholeNumberByMode(n, { mode: "round", fallback: "—" });
  }

  function districtBridgeSupportTotalFromState(currentState){
    return computeDistrictSupportTotalPctFromState(currentState);
  }

  function districtBridgeFallbackTurnout(currentState){
    return buildDistrictTurnoutFallbackView(currentState, {
      formatPercent: (value, digits = 1) => districtBridgeFmtPct(value, digits),
      formatInt: (value) => districtBridgeFmtInt(value),
    });
  }

  function districtBridgeFmtTimestamp(ts){
    return buildDistrictLastFetchText(ts);
  }

  function districtBridgeBuildContextHint(censusState){
    return buildDistrictCensusContextHint(censusState);
  }

  function districtBridgeBuildSelectionSetStatus(censusState){
    return buildDistrictSelectionSetStatus(censusState, {
      formatInt: (value) => districtBridgeFmtInt(value),
    });
  }

  function districtBridgeBuildGeoStatsText(censusState){
    return buildDistrictGeoStatsText(censusState, {
      formatInt: (value) => districtBridgeFmtInt(value),
    });
  }

  function districtBridgeBuildSelectionSummary(censusState){
    return buildDistrictSelectionSummaryText(censusState);
  }

  function districtBridgeBuildRaceFootprintStatus(currentState){
    return buildDistrictRaceFootprintStatus(currentState, {
      formatInt: (value) => districtBridgeFmtInt(value),
    });
  }

  function districtBridgeBuildAssumptionProvenanceStatus(currentState){
    return buildDistrictAssumptionProvenanceStatus(currentState);
  }

  function districtBridgeBuildFootprintCapacityStatus(currentState){
    return buildDistrictFootprintCapacityStatus(currentState, {
      formatInt: (value) => districtBridgeFmtInt(value),
    });
  }

  function districtBridgeBuildApplyAdjustmentsStatus(censusState){
    return buildDistrictApplyAdjustmentsStatus(censusState);
  }

  function districtBridgeBuildSelectOptions(values, { selected = "", placeholder = "" } = {}){
    const rows = Array.isArray(values) ? values : [];
    const seen = new Set();
    const out = [];
    const selectedValue = String(selected || "").trim();

    if (placeholder) {
      out.push({ value: "", label: String(placeholder).trim() || "Select" });
      seen.add("");
    }

    for (const row of rows){
      const value = String(row?.value || "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push({
        value,
        label: String(row?.label || value).trim() || value,
      });
    }

    if (selectedValue && !seen.has(selectedValue)) {
      out.push({ value: selectedValue, label: selectedValue });
    }

    return out;
  }

  function districtBridgeBuildCensusConfigOptions(censusState){
    const census = censusState && typeof censusState === "object" ? censusState : {};
    const geoRowsRaw = Array.isArray(census.geoOptions) ? census.geoOptions : [];
    const selectedState = String(census.stateFips || "").trim();
    const selectedCounty = String(census.countyFips || census.county || "").trim();
    const geoRows = geoRowsRaw
      .map((row) => {
        const geoid = String(row?.geoid || "").trim();
        return {
          geoid,
          label: String(row?.label || row?.name || geoid).trim() || geoid,
          state: String(row?.state || "").trim(),
          county: String(row?.county || "").trim(),
          place: String(row?.place || "").trim(),
          tract: String(row?.tract || "").trim(),
        };
      })
      .filter((row) => !!row.geoid);

    const selectedGeoids = new Set(
      (Array.isArray(census.selectedGeoids) ? census.selectedGeoids : [])
        .map((id) => String(id || "").trim())
        .filter((id) => !!id),
    );

    const bridgeStateOptions = Array.isArray(census.bridgeStateOptions) ? census.bridgeStateOptions : [];
    const bridgeCountyOptions = Array.isArray(census.bridgeCountyOptions) ? census.bridgeCountyOptions : [];
    const bridgePlaceOptions = Array.isArray(census.bridgePlaceOptions) ? census.bridgePlaceOptions : [];
    const bridgeTractFilterOptions = Array.isArray(census.bridgeTractFilterOptions) ? census.bridgeTractFilterOptions : [];
    const bridgeSelectionSetOptions = Array.isArray(census.bridgeSelectionSetOptions) ? census.bridgeSelectionSetOptions : [];
    const bridgeGeoSelectOptions = Array.isArray(census.bridgeGeoSelectOptions) ? census.bridgeGeoSelectOptions : [];
    const countyRowsFromGeo = geoRows
      .filter((row) => !selectedState || row.state === selectedState)
      .map((row) => ({ value: row.county, label: row.county }));
    const placeRowsFromGeo = geoRows
      .filter((row) => {
        if (selectedState && row.state !== selectedState) return false;
        if (selectedCounty && row.county !== selectedCounty) return false;
        return true;
      })
      .map((row) => ({ value: row.place, label: row.place, county: row.county, state: row.state }));
    const placeFallbackSet = new Set(
      placeRowsFromGeo
        .map((row) => String(row?.value || "").trim())
        .filter(Boolean),
    );

    const stateOptions = districtBridgeBuildSelectOptions(
      bridgeStateOptions.length
        ? bridgeStateOptions
        : geoRows.map((row) => ({
          value: row.state,
          label: row.state,
        })),
      { selected: census.stateFips, placeholder: "Select state" },
    );
    const countyOptions = districtBridgeBuildSelectOptions(
      (bridgeCountyOptions.length ? bridgeCountyOptions : countyRowsFromGeo).filter((row) => {
        if (!selectedState) return true;
        const rowState = String(row?.state || row?.stateFips || "").trim();
        return !rowState || rowState === selectedState;
      }),
      { selected: census.countyFips, placeholder: "Select county" },
    );
    const placeOptions = districtBridgeBuildSelectOptions(
      (bridgePlaceOptions.length ? bridgePlaceOptions : placeRowsFromGeo).filter((row) => {
        const rowValue = String(row?.value || "").trim();
        const rowState = String(row?.state || row?.stateFips || "").trim();
        const rowCounty = String(row?.county || row?.countyFips || row?.parentCountyFips || "").trim();
        if (selectedState && rowState && rowState !== selectedState) return false;
        if (selectedCounty) {
          if (rowCounty) return rowCounty === selectedCounty;
          if (placeFallbackSet.size) return placeFallbackSet.has(rowValue);
          return false;
        }
        return true;
      }),
      { selected: census.placeFips, placeholder: "Select place" },
    );
    const tractFilterOptions = districtBridgeBuildSelectOptions(
      bridgeTractFilterOptions.length
        ? bridgeTractFilterOptions
        : geoRows.map((row) => ({ value: row.tract, label: row.tract })),
      { selected: census.tractFilter, placeholder: "All tracts" },
    );
    const selectionSetOptions = districtBridgeBuildSelectOptions(
      bridgeSelectionSetOptions.length
        ? bridgeSelectionSetOptions
        : (Array.isArray(census.selectionSets) ? census.selectionSets : []).map((row, idx) => ({
          value: String(idx),
          label: `${String(row?.name || "").trim()} · ${String(row?.resolution || "").trim()} · ${Array.isArray(row?.geoids) ? row.geoids.length : 0} GEO`,
        })),
      { selected: census.selectedSelectionSetKey, placeholder: "Saved sets" },
    );

    const geoSelectOptions = (bridgeGeoSelectOptions.length
      ? bridgeGeoSelectOptions.map((row) => ({
        value: String(row?.value || "").trim(),
        label: String(row?.label || row?.value || "").trim(),
        selected: !!row?.selected,
      }))
      : geoRows.map((row) => ({
        value: row.geoid,
        label: row.label,
        selected: selectedGeoids.has(row.geoid),
      })))
      .filter((row) => !!row.value);

    for (const geoid of selectedGeoids) {
      if (!geoSelectOptions.some((row) => row.value === geoid)) {
        geoSelectOptions.push({ value: geoid, label: geoid, selected: true });
      }
    }

    return {
      stateOptions,
      countyOptions,
      placeOptions,
      tractFilterOptions,
      selectionSetOptions,
      geoSelectOptions,
    };
  }

  function districtBridgeBuildCensusDisabledMap(currentState, censusState){
    const census = censusState && typeof censusState === "object" ? censusState : {};
    const controlsLocked = isScenarioLockedForEdits(currentState);
    const resolution = String(census?.resolution || "").trim();
    const stateFips = String(census?.stateFips || "").trim();
    const countyFips = String(census?.countyFips || census?.county || "").trim();
    const requiresCounty = resolution === "tract" || resolution === "block_group";
    const contextReadyForGeo = !!stateFips && (!requiresCounty || !!countyFips);
    const geoOptionsCount = Array.isArray(census?.geoOptions) ? census.geoOptions.length : 0;
    const hasGeoOptions = geoOptionsCount > 0;
    const selectedGeoCount = Array.isArray(census?.selectedGeoids) ? census.selectedGeoids.length : 0;
    const loadedRowCount = Number.isFinite(Number(census?.loadedRowCount))
      ? Math.max(0, roundWholeNumberByMode(Number(census.loadedRowCount), { mode: "floor", fallback: 0 }) || 0)
      : 0;
    const selectedSetKey = String(census?.selectedSelectionSetKey || "").trim();
    const draftName = String(census?.selectionSetDraftName || "").trim();
    const hasRaceFootprint = Array.isArray(currentState?.raceFootprint?.geoids)
      ? currentState.raceFootprint.geoids.length > 0
      : false;

    const map = {
      v3CensusCountyFips: controlsLocked || !stateFips,
      v3CensusPlaceFips: controlsLocked || !stateFips,
      v3CensusGeoSearch: controlsLocked || !hasGeoOptions,
      v3CensusTractFilter: controlsLocked || resolution !== "block_group" || !hasGeoOptions,
      v3BtnCensusLoadGeo: controlsLocked || !!census?.loadingGeo || !contextReadyForGeo,
      v3BtnCensusFetchRows: controlsLocked || !!census?.loadingRows || !contextReadyForGeo,
      v3BtnCensusSelectAll: controlsLocked || !hasGeoOptions,
      v3BtnCensusClearSelection: controlsLocked || !selectedGeoCount,
      v3BtnCensusApplyGeoPaste: controlsLocked || !hasGeoOptions,
      v3BtnCensusSetRaceFootprint: controlsLocked || !selectedGeoCount || !loadedRowCount,
      v3BtnCensusClearRaceFootprint: controlsLocked || !hasRaceFootprint,
      v3BtnCensusSaveSelectionSet: controlsLocked || !selectedGeoCount || !draftName,
      v3BtnCensusLoadSelectionSet: controlsLocked || !selectedSetKey || !hasGeoOptions,
      v3BtnCensusDeleteSelectionSet: controlsLocked || !selectedSetKey,
      v3BtnCensusExportAggregateCsv: controlsLocked || !loadedRowCount,
      v3BtnCensusExportAggregateJson: controlsLocked || !loadedRowCount,
      v3BtnCensusDownloadElectionCsvTemplate: controlsLocked || false,
      v3BtnCensusDownloadElectionCsvWideTemplate: controlsLocked || false,
      v3CensusApplyAdjustmentsToggle: controlsLocked || false,
      v3CensusMapQaVtdToggle: null,
      v3CensusMapQaVtdZip: null,
      v3BtnCensusMapQaVtdZipClear: null,
      v3BtnCensusLoadMap: null,
      v3BtnCensusClearMap: null,
      v3BtnCensusElectionCsvDryRun: controlsLocked ? true : null,
      v3BtnCensusElectionCsvClear: controlsLocked ? true : null,
      v3CensusElectionCsvFile: controlsLocked || false,
      v3CensusElectionCsvPrecinctFilter: controlsLocked || false,
      v3CensusApiKey: controlsLocked || false,
      v3CensusAcsYear: true,
      v3CensusResolution: controlsLocked || false,
      v3CensusStateFips: controlsLocked || false,
      v3CensusMetricSet: controlsLocked || false,
      v3CensusGeoPaste: controlsLocked || false,
      v3CensusSelectionSetName: controlsLocked || false,
      v3CensusSelectionSetSelect: controlsLocked || false,
      v3CensusGeoSelect: controlsLocked || false,
    };
    const out = {};
    for (const [id, value] of Object.entries(map)){
      if (typeof value === "boolean"){
        out[id] = value;
      }
    }
    return out;
  }

  function districtBridgeNormalizeRows(rows, expectedCols = 0){
    const list = Array.isArray(rows) ? rows : [];
    const out = [];
    for (const row of list){
      const cells = Array.isArray(row) ? row : [];
      const cols = cells.map((cell) => String(cell == null ? "" : cell).trim());
      if (!cols.some(Boolean)) continue;
      if (expectedCols > 0){
        while (cols.length < expectedCols) cols.push("");
        out.push(cols.slice(0, expectedCols));
      } else {
        out.push(cols);
      }
    }
    return out;
  }

  function districtBridgeBuildDistrictDisabledMap(currentState){
    const controlsLocked = isScenarioLockedForEdits(currentState);
    return {
      v3DistrictYourCandidate: controlsLocked,
      v3DistrictUndecidedPct: controlsLocked,
      v3DistrictUndecidedMode: controlsLocked,
      v3BtnAddCandidate: controlsLocked,
      v3BtnAddCandidateHistory: controlsLocked,
      v3DistrictRaceType: controlsLocked,
      v3DistrictOfficeLevel: controlsLocked,
      v3DistrictElectionType: controlsLocked,
      v3DistrictSeatContext: controlsLocked,
      v3DistrictPartisanshipMode: controlsLocked,
      v3DistrictSalienceLevel: controlsLocked,
      v3BtnDistrictApplyTemplateDefaults: controlsLocked,
      v3DistrictElectionDate: controlsLocked,
      v3DistrictWeeksRemaining: controlsLocked,
      v3DistrictMode: controlsLocked,
      v3DistrictUniverseSize: controlsLocked,
      v3DistrictUniverseBasis: controlsLocked,
      v3DistrictSourceNote: controlsLocked,
      v3DistrictElectorateWeightingToggle: controlsLocked,
      v3DistrictTurnoutA: controlsLocked,
      v3DistrictTurnoutB: controlsLocked,
      v3DistrictBandWidth: controlsLocked,
      v3DistrictDemPct: controlsLocked,
      v3DistrictRepPct: controlsLocked,
      v3DistrictNpaPct: controlsLocked,
      v3DistrictOtherPct: controlsLocked,
      v3DistrictRetentionFactor: controlsLocked,
    };
  }

  function districtBridgeGetCensusRuntimeApi(){
    const windowRef = getWindowRef();
    if (!windowRef || typeof windowRef !== "object"){
      return null;
    }
    try {
      const api = windowRef.__FPE_CENSUS_RUNTIME_API__;
      return (api && typeof api === "object") ? api : null;
    } catch {
      return null;
    }
  }

  function districtBridgeCallCensusRuntime(method, ...args){
    const api = districtBridgeGetCensusRuntimeApi();
    if (!api || typeof api[method] !== "function"){
      return null;
    }
    try {
      return api[method](...args);
    } catch {
      return null;
    }
  }

  function districtBridgePatchCensusBridgeField(field, rawValue){
    const key = cleanText(field);
    if (!key) return false;
    const resetGeoData = (census) => {
      census.geoSearch = "";
      census.tractFilter = "";
      census.geoOptions = [];
      census.selectedGeoids = [];
      census.rowsByGeoid = {};
      census.activeRowsKey = "";
      census.loadedRowCount = 0;
      census.loadingGeo = false;
      census.loadingRows = false;
      census.lastFetchAt = "";
    };
    const resetRowsOnly = (census) => {
      census.rowsByGeoid = {};
      census.activeRowsKey = "";
      census.loadedRowCount = 0;
      census.loadingRows = false;
      census.lastFetchAt = "";
    };
    let applied = false;
    mutateState((next) => {
      next.census = normalizeCensusState(next.census);
      const census = {
        ...next.census,
        geoOptions: Array.isArray(next.census?.geoOptions) ? next.census.geoOptions.slice() : [],
        selectedGeoids: Array.isArray(next.census?.selectedGeoids) ? next.census.selectedGeoids.slice() : [],
        rowsByGeoid: next.census?.rowsByGeoid && typeof next.census.rowsByGeoid === "object"
          ? { ...next.census.rowsByGeoid }
          : {},
        selectionSets: Array.isArray(next.census?.selectionSets) ? next.census.selectionSets.slice() : [],
        bridgeStateOptions: Array.isArray(next.census?.bridgeStateOptions) ? next.census.bridgeStateOptions.slice() : [],
        bridgeCountyOptions: Array.isArray(next.census?.bridgeCountyOptions) ? next.census.bridgeCountyOptions.slice() : [],
        bridgePlaceOptions: Array.isArray(next.census?.bridgePlaceOptions) ? next.census.bridgePlaceOptions.slice() : [],
        bridgeTractFilterOptions: Array.isArray(next.census?.bridgeTractFilterOptions) ? next.census.bridgeTractFilterOptions.slice() : [],
        bridgeSelectionSetOptions: Array.isArray(next.census?.bridgeSelectionSetOptions) ? next.census.bridgeSelectionSetOptions.slice() : [],
        bridgeGeoSelectOptions: Array.isArray(next.census?.bridgeGeoSelectOptions) ? next.census.bridgeGeoSelectOptions.slice() : [],
        bridgeAggregateRows: Array.isArray(next.census?.bridgeAggregateRows) ? next.census.bridgeAggregateRows.slice() : [],
        bridgeAdvisoryRows: Array.isArray(next.census?.bridgeAdvisoryRows) ? next.census.bridgeAdvisoryRows.slice() : [],
        bridgeElectionPreviewRows: Array.isArray(next.census?.bridgeElectionPreviewRows) ? next.census.bridgeElectionPreviewRows.slice() : [],
      };
      if (key === "apiKey"){
        census.bridgeApiKey = cleanText(rawValue);
        applied = true;
      } else if (key === "geoPaste"){
        census.bridgeGeoPaste = String(rawValue == null ? "" : rawValue);
        applied = true;
      } else if (key === "electionCsvPrecinctFilter"){
        census.bridgeElectionCsvPrecinctFilter = String(rawValue == null ? "" : rawValue);
        applied = true;
      } else if (key === "year"){
        census.year = cleanText(rawValue);
        resetRowsOnly(census);
        applied = true;
      } else if (key === "resolution"){
        const resolution = cleanText(rawValue) || census.resolution;
        census.resolution = resolution;
        if (!resolutionNeedsCounty(resolution) && resolution !== "place"){
          census.countyFips = "";
        }
        if (resolution !== "block_group"){
          census.tractFilter = "";
        }
        resetGeoData(census);
        applied = true;
      } else if (key === "stateFips"){
        census.stateFips = cleanText(rawValue);
        census.countyFips = "";
        census.placeFips = "";
        resetGeoData(census);
        applied = true;
      } else if (key === "countyFips"){
        census.countyFips = cleanText(rawValue);
        census.placeFips = "";
        resetGeoData(census);
        applied = true;
      } else if (key === "placeFips"){
        census.placeFips = cleanText(rawValue);
        if (cleanText(census.resolution) === "place"){
          resetGeoData(census);
        }
        applied = true;
      } else if (key === "metricSet"){
        census.metricSet = cleanText(rawValue) || census.metricSet;
        resetRowsOnly(census);
        applied = true;
      } else if (key === "geoSearch"){
        census.geoSearch = cleanText(rawValue);
        applied = true;
      } else if (key === "tractFilter"){
        census.tractFilter = cleanText(rawValue);
        applied = true;
      } else if (key === "selectionSetDraftName"){
        census.selectionSetDraftName = cleanText(rawValue);
        applied = true;
      } else if (key === "selectedSelectionSetKey"){
        census.selectedSelectionSetKey = cleanText(rawValue);
        applied = true;
      } else if (key === "applyAdjustedAssumptions"){
        census.applyAdjustedAssumptions = !!rawValue;
        applied = true;
      } else if (key === "mapQaVtdOverlay"){
        census.mapQaVtdOverlay = !!rawValue;
        applied = true;
      }

      if (applied){
        next.census = normalizeCensusState(census);
        const statusBase = cleanText(next.census.status) || "Ready.";
        next.census.status = statusBase;
        next.census.error = "";
      }
    });
    return applied;
  }

  function districtBridgePatchCensusGeoSelection(values){
    const nextValues = Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value == null ? "" : value).trim())
        .filter(Boolean),
    ));
    let applied = false;
    mutateState((next) => {
      next.census = normalizeCensusState(next.census);
      next.census = {
        ...next.census,
        selectedGeoids: nextValues,
      };
      applied = true;
    });
    return applied;
  }

  return {
    districtBridgeFmtPct,
    districtBridgeFmtInt,
    districtBridgeSupportTotalFromState,
    districtBridgeFallbackTurnout,
    districtBridgeFmtTimestamp,
    districtBridgeBuildContextHint,
    districtBridgeBuildSelectionSetStatus,
    districtBridgeBuildGeoStatsText,
    districtBridgeBuildSelectionSummary,
    districtBridgeBuildRaceFootprintStatus,
    districtBridgeBuildAssumptionProvenanceStatus,
    districtBridgeBuildFootprintCapacityStatus,
    districtBridgeBuildApplyAdjustmentsStatus,
    districtBridgeBuildSelectOptions,
    districtBridgeBuildCensusConfigOptions,
    districtBridgeBuildCensusDisabledMap,
    districtBridgeNormalizeRows,
    districtBridgeBuildDistrictDisabledMap,
    districtBridgeGetCensusRuntimeApi,
    districtBridgeCallCensusRuntime,
    districtBridgePatchCensusBridgeField,
    districtBridgePatchCensusGeoSelection,
  };
}
