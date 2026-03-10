import {
  CENSUS_DEFAULT_API_KEY,
  makeDefaultCensusState,
  normalizeCensusState,
  buildAcsQueryUrl,
  buildGeoLookupUrl,
  parseCensusTable,
  optionFromRow,
  aggregateRowsForSelection,
  validateMetricSetWithCatalog,
  getVariablesForMetricSet,
  buildTigerBoundaryQueryUrls,
  buildTigerVtdBoundaryQueryUrl,
  filterGeoOptions,
  formatMetricValue,
  parseGeoidInput,
  makeDefaultRaceFootprint,
  normalizeRaceFootprint,
  computeRaceFootprintFingerprint,
  buildRaceFootprintFromCensusSelection,
  assessRaceFootprintAlignment,
  makeDefaultAssumptionProvenance,
  normalizeAssumptionProvenance,
  normalizeFootprintCapacity,
  evaluateFootprintFeasibility,
  summarizeFootprintFeasibilityIssues,
  getElectionCsvUploadGuide,
  buildElectionCsvTemplate,
  buildElectionCsvWideTemplate,
  buildCensusAssumptionAdvisory,
  evaluateCensusPaceAgainstAdvisory,
  evaluateQaOverlayNonBlocking,
  clampCensusApplyMultipliers,
  evaluateCensusApplyMode,
  detectElectionCsvFormat,
  normalizeElectionCsvRows,
  parseCsvText,
} from "../censusModule.js?v=20260310-census-phase1-40";

export function registerCensusPhase1Tests(ctx){
  const { test, assert } = ctx;

  test("Census Phase1: hardwired API key default is present", () => {
    const key = String(CENSUS_DEFAULT_API_KEY || "").trim();
    assert(/^[a-f0-9]{40}$/i.test(key), "hardwired Census API key default missing or invalid");
  });

  test("Census Phase1: default and normalization contract", () => {
    const base = makeDefaultCensusState();
    assert(base && typeof base === "object", "default census state missing");
    assert(base.mapQaVtdOverlay === false, "default VTD QA overlay toggle should be false");
    assert(base.applyAdjustedAssumptions === false, "default apply-adjusted toggle should be false");
    const normalized = normalizeCensusState({ year: "1900", resolution: "bad", metricSet: "x", stateFips: "7", countyFips: "9" });
    assert(normalized.resolution === "tract", "resolution did not normalize");
    assert(normalized.metricSet === "core", "metricSet did not normalize");
    assert(normalized.stateFips === "07", "stateFips did not normalize");
    assert(normalized.countyFips === "009", "countyFips did not normalize");
    const normalizedToggle = normalizeCensusState({ mapQaVtdOverlay: 1 });
    assert(normalizedToggle.mapQaVtdOverlay === true, "VTD QA overlay toggle should normalize to boolean");
    const normalizedApplyToggle = normalizeCensusState({ applyAdjustedAssumptions: 1 });
    assert(normalizedApplyToggle.applyAdjustedAssumptions === true, "apply-adjusted toggle should normalize to boolean");
  });

  test("Census Phase1: runtime cache key normalization modes", () => {
    const keep = normalizeCensusState({ stateFips: "17", countyFips: "031", activeRowsKey: "abc|123", loadedRowCount: 88 });
    assert(keep.activeRowsKey === "abc|123", "runtime key should persist in runtime normalization");
    assert(keep.loadedRowCount === 88, "loadedRowCount should persist in runtime normalization");
    const reset = normalizeCensusState({ stateFips: "17", countyFips: "031", activeRowsKey: "abc|123", loadedRowCount: 88 }, { resetRuntime: true });
    assert(reset.activeRowsKey === "", "runtime key should reset when requested");
    assert(reset.loadedRowCount === 0, "loadedRowCount should reset when requested");
    const withSets = normalizeCensusState({
      selectionSets: [
        { name: "A", resolution: "tract", stateFips: "17", countyFips: "031", geoids: ["17031010100", "17031010100"] },
        { name: "", resolution: "tract", geoids: ["17031010100"] },
      ],
    });
    assert(Array.isArray(withSets.selectionSets) && withSets.selectionSets.length === 1, "selection set normalization mismatch");
    assert(withSets.selectionSets[0].geoids.length === 1, "selection set geoid dedupe mismatch");
  });

  test("Census Phase1: ACS URL builder contract", () => {
    const url = buildAcsQueryUrl({
      year: "2024",
      getVars: ["B01003_001E", "B25001_001E"],
      forClause: "tract:*",
      inClauses: ["state:17", "county:031"],
      key: "abc123",
    });
    assert(url.includes("/data/2024/acs/acs5?"), "year/dataset missing in URL");
    assert(url.includes("for=tract%3A*"), "for clause missing");
    assert(url.includes("in=state%3A17"), "state in clause missing");
    assert(url.includes("in=county%3A031"), "county in clause missing");
    assert(url.includes("key=abc123"), "key missing");
  });

  test("Census Phase1: geo lookup URL supports keyless mode", () => {
    const keyless = buildGeoLookupUrl({ scope: "state", key: "" });
    assert(!keyless.includes("key="), "keyless geo lookup should omit key param");
    assert(keyless.includes("/dec/pl?"), "geo lookup should use dec/pl endpoint");
    const keyed = buildGeoLookupUrl({ scope: "county", stateFips: "17", key: CENSUS_DEFAULT_API_KEY });
    assert(keyed.includes("key="), "keyed geo lookup should include key param");
    assert(keyed.includes("in=state%3A17"), "geo lookup county url missing state filter");
  });

  test("Census Phase1: table parser and GEOID option mapping", () => {
    const parsed = parseCensusTable([
      ["NAME", "state", "county", "tract", "block group", "B01003_001E"],
      ["Tract 1, Example County, IL", "17", "031", "010100", "2", "500"],
    ]);
    assert(Array.isArray(parsed) && parsed.length === 1, "table parse failed");
    const opt = optionFromRow(parsed[0], "block_group");
    assert(opt.geoid === "170310101002", `unexpected block group geoid: ${opt.geoid}`);
  });

  test("Census Phase1: multi-select aggregation math", () => {
    const rowsByGeoid = {
      "17031010100": {
        geoid: "17031010100",
        values: {
          B01003_001E: 1000,
          B11001_001E: 400,
          B25001_001E: 450,
          B25003_001E: 400,
          B25003_002E: 220,
          B25003_003E: 180,
          B19013_001E: 60000,
        },
      },
      "17031010200": {
        geoid: "17031010200",
        values: {
          B01003_001E: 1500,
          B11001_001E: 600,
          B25001_001E: 640,
          B25003_001E: 600,
          B25003_002E: 240,
          B25003_003E: 360,
          B19013_001E: 50000,
        },
      },
    };

    const aggregate = aggregateRowsForSelection({
      rowsByGeoid,
      selectedGeoids: ["17031010100", "17031010200"],
      metricSet: "core",
    });

    const population = aggregate.metrics.population_total?.value;
    const renterShare = aggregate.metrics.renter_share?.value;
    assert(population === 2500, `population sum mismatch: ${population}`);
    assert(Math.abs(renterShare - (540 / 1000)) <= 1e-12, `renter share mismatch: ${renterShare}`);

    const incomeAgg = aggregateRowsForSelection({
      rowsByGeoid,
      selectedGeoids: ["17031010100", "17031010200"],
      metricSet: "income",
    });
    const income = incomeAgg.metrics.median_household_income_est?.value;
    const expectedIncome = (60000 * 400 + 50000 * 600) / 1000;
    assert(Math.abs(income - expectedIncome) <= 1e-12, `income weighted estimate mismatch: ${income}`);

    const emptyAgg = aggregateRowsForSelection({
      rowsByGeoid,
      selectedGeoids: [],
      metricSet: "core",
    });
    assert(emptyAgg.metrics.population_total?.value == null, "sum metric should be null when selection is empty");
  });

  test("Census Phase1: variable catalog validation", () => {
    const required = getVariablesForMetricSet("core");
    const checkOk = validateMetricSetWithCatalog("core", required);
    assert(checkOk.ok === true, "expected variable catalog to validate for core set");

    const missingOne = required.slice(0, required.length - 1);
    const checkMissing = validateMetricSetWithCatalog("core", missingOne);
    assert(checkMissing.ok === false, "expected missing-variable validation failure");
    assert(Array.isArray(checkMissing.missing) && checkMissing.missing.length === 1, "missing variable count mismatch");
  });

  test("Census Phase1: GEO option filter by search and tract", () => {
    const options = [
      { geoid: "170310101001", label: "BG 1", name: "Alpha", tract: "010100" },
      { geoid: "170310101002", label: "BG 2", name: "Beta", tract: "010100" },
      { geoid: "170310102001", label: "BG 3", name: "Gamma", tract: "010200" },
    ];
    const bySearch = filterGeoOptions(options, { search: "beta" });
    assert(bySearch.length === 1 && bySearch[0].geoid === "170310101002", "search filter mismatch");
    const byTract = filterGeoOptions(options, { tractFilter: "010100" });
    assert(byTract.length === 2, "tract filter mismatch");
    const byBoth = filterGeoOptions(options, { search: "bg 3", tractFilter: "010200" });
    assert(byBoth.length === 1 && byBoth[0].geoid === "170310102001", "combined filter mismatch");
  });

  test("Census Phase1: TIGER boundary URL builder", () => {
    const tractUrls = buildTigerBoundaryQueryUrls({
      resolution: "tract",
      geoids: ["17031010100", "17031010200"],
      chunkSize: 1,
    });
    assert(tractUrls.length === 2, "tract boundary URL chunking mismatch");
    assert(tractUrls[0].includes("/TIGERweb/Tracts_Blocks/MapServer/10/query"), "tract layer URL mismatch");
    const placeUrls = buildTigerBoundaryQueryUrls({
      resolution: "place",
      geoids: ["1714000"],
    });
    assert(placeUrls.length === 2, "place boundary should query both place layers");
    assert(placeUrls[0].includes("/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query"), "place incorporated layer mismatch");
    assert(placeUrls[1].includes("/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/5/query"), "place CDP layer mismatch");
  });

  test("Census Phase1: VTD boundary URL builder", () => {
    const layerConfig = {
      serviceName: "Voting_Districts",
      layerId: 0,
      fields: {
        state: "STATEFP20",
        county: "COUNTYFP20",
        geoid: "GEOID20",
        name: "NAME20",
      },
    };
    const url = buildTigerVtdBoundaryQueryUrl({
      layerConfig,
      stateFips: "17",
      countyFips: "031",
    });
    assert(url.includes("/TIGERweb/Voting_Districts/MapServer/0/query"), "VTD query URL path mismatch");
    assert(url.includes("STATEFP20"), "VTD query URL should include state field");
    assert(url.includes("COUNTYFP20"), "VTD query URL should include county field");
    const missingCounty = buildTigerVtdBoundaryQueryUrl({
      layerConfig,
      stateFips: "17",
      countyFips: "",
    });
    assert(missingCounty === "", "VTD query URL should require county context");
  });

  test("Census Phase1: VTD QA overlay failure remains non-blocking when primary overlay is loaded", () => {
    const nonBlocking = evaluateQaOverlayNonBlocking({
      primaryFeatureCount: 12,
      qaEnabled: true,
      qaFailed: true,
    });
    assert(nonBlocking.blocking === false, "qa failure should be non-blocking when primary features exist");
    assert(nonBlocking.code === "qa_non_blocking", "qa non-blocking code mismatch");
    const blocking = evaluateQaOverlayNonBlocking({
      primaryFeatureCount: 0,
      qaEnabled: true,
      qaFailed: true,
    });
    assert(blocking.blocking === true, "qa failure should be blocking when primary overlay is missing");
    assert(blocking.code === "qa_blocking", "qa blocking code mismatch");
  });

  test("Census Phase1: metric formatter handles missing values", () => {
    assert(formatMetricValue(null, "int") === "-", "int formatter should show dash for null");
    assert(formatMetricValue(undefined, "pct1") === "-", "pct formatter should show dash for undefined");
    assert(formatMetricValue("", "currency0") === "-", "currency formatter should show dash for empty string");
  });

  test("Census Phase1: GEOID paste parser", () => {
    const tract = parseGeoidInput("17031010100, 17031010200\n17031010100", "tract");
    assert(tract.length === 2, "tract GEOID parse/dedupe mismatch");
    const blockGroup = parseGeoidInput("170310101001 abc 170310101002", "block_group");
    assert(blockGroup.length === 2, "block group GEOID parse mismatch");
    const place = parseGeoidInput("1714000|1714100", "place");
    assert(place.length === 2, "place GEOID parse mismatch");
  });

  test("Census Phase1: race footprint normalization and fingerprint", () => {
    const base = makeDefaultRaceFootprint();
    assert(base && typeof base === "object", "default race footprint missing");
    const normalized = normalizeRaceFootprint({
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "31",
      geoids: ["17031010100", "17031010200", "17031010100"],
    });
    assert(normalized.stateFips === "17", "race footprint state did not normalize");
    assert(normalized.countyFips === "031", "race footprint county did not normalize");
    assert(Array.isArray(normalized.geoids) && normalized.geoids.length === 2, "race footprint geoid dedupe mismatch");
    const fingerprint = computeRaceFootprintFingerprint(normalized);
    assert(typeof fingerprint === "string" && fingerprint.includes("17031010100"), "race footprint fingerprint mismatch");
  });

  test("Census Phase1: assumption provenance normalization", () => {
    const base = makeDefaultAssumptionProvenance();
    assert(base && typeof base === "object", "default assumption provenance missing");
    const normalized = normalizeAssumptionProvenance({
      source: "census_phase1",
      raceFootprintFingerprint: "a|b|c",
      censusRowsKey: 12345,
      acsYear: 2024,
      metricSet: "core",
      generatedAt: "2026-03-09T22:00:00.000Z",
    });
    assert(normalized.source === "census_phase1", "provenance source mismatch");
    assert(normalized.raceFootprintFingerprint === "a|b|c", "provenance footprint key mismatch");
    assert(normalized.censusRowsKey === "12345", "provenance rows key mismatch");
    assert(normalized.acsYear === "2024", "provenance year mismatch");
    assert(normalized.metricSet === "core", "provenance metricSet mismatch");
  });

  test("Census Phase1: race footprint alignment evaluator", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100", "17031010200"],
      loadedRowCount: 2,
      activeRowsKey: "2024|tract|17|031|core",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const aligned = assessRaceFootprintAlignment({
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2024",
        metricSet: "core",
      },
    });
    assert(aligned.readyForAssumptions === true, "alignment should be ready");
    const mismatch = assessRaceFootprintAlignment({
      censusState: { ...censusState, selectedGeoids: ["17031010300"] },
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2024",
        metricSet: "core",
      },
    });
    assert(mismatch.readyForAssumptions === false, "mismatch should block readiness");
    assert(mismatch.reason === "selection_mismatch", "mismatch reason should be selection_mismatch");
  });

  test("Census Phase1: provenance strictness enforces year and metric bundle", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100", "17031010200"],
      loadedRowCount: 2,
      activeRowsKey: "2024|tract|17|031|core",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const yearMismatch = assessRaceFootprintAlignment({
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2023",
        metricSet: "core",
      },
    });
    assert(yearMismatch.readyForAssumptions === false, "year mismatch should block readiness");
    assert(yearMismatch.reason === "provenance_year_mismatch", "year mismatch reason mismatch");
    const bundleMismatch = assessRaceFootprintAlignment({
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2024",
        metricSet: "housing",
      },
    });
    assert(bundleMismatch.readyForAssumptions === false, "metric bundle mismatch should block readiness");
    assert(bundleMismatch.reason === "provenance_metric_set_mismatch", "metric bundle mismatch reason mismatch");
  });

  test("Census Phase1: provenance reason transitions resolve to ready", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100", "17031010200"],
      loadedRowCount: 2,
      activeRowsKey: "2024|tract|17|031|core",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const missingRows = assessRaceFootprintAlignment({
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: "",
        acsYear: "2024",
        metricSet: "core",
      },
    });
    assert(missingRows.reason === "provenance_rows_not_set", "missing rows reason mismatch");
    const rowMismatch = assessRaceFootprintAlignment({
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: "2024|tract|17|031|demographics",
        acsYear: "2024",
        metricSet: "core",
      },
    });
    assert(rowMismatch.reason === "provenance_rows_mismatch", "rows mismatch reason mismatch");
    const ready = assessRaceFootprintAlignment({
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2024",
        metricSet: "core",
      },
    });
    assert(ready.reason === "ready", "provenance should resolve to ready");
    assert(ready.readyForAssumptions === true, "ready transition should enable assumptions");
  });

  test("Census Phase1: apply-mode gate requires provenance alignment, rows, and advisory", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100"],
      loadedRowCount: 1,
      activeRowsKey: "2024|tract|17|031|core",
      applyAdjustedAssumptions: true,
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const ready = evaluateCensusApplyMode({
      applyRequested: true,
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2024",
        metricSet: "core",
      },
      advisoryReady: true,
      hasRows: true,
    });
    assert(ready.ready === true, "apply mode should be ready with strict alignment");
    assert(ready.reason === "ready", "apply mode ready reason mismatch");
    const missingRows = evaluateCensusApplyMode({
      applyRequested: true,
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2024",
        metricSet: "core",
      },
      advisoryReady: true,
      hasRows: false,
    });
    assert(missingRows.ready === false, "apply mode should block when rows are missing");
    assert(missingRows.reason === "rows_not_ready", "apply mode missing rows reason mismatch");
    const stale = evaluateCensusApplyMode({
      applyRequested: true,
      censusState,
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2023",
        metricSet: "core",
      },
      advisoryReady: true,
      hasRows: true,
    });
    assert(stale.ready === false, "apply mode should block on stale provenance");
    assert(stale.reason === "provenance_year_mismatch", "apply mode stale reason mismatch");
  });

  test("Census Phase1: apply multipliers are bounded", () => {
    const multipliers = clampCensusApplyMultipliers({
      doorsPerHour: 1.8,
      persuasion: 0.4,
      turnoutLift: 1.3,
      organizerLoad: 0.1,
    });
    assert(multipliers.doorsPerHour === 1.15, "doors multiplier upper bound mismatch");
    assert(multipliers.persuasion === 0.9, "persuasion multiplier lower bound mismatch");
    assert(multipliers.turnoutLift === 1.1, "turnout multiplier upper bound mismatch");
    assert(multipliers.organizerLoad === 0.85, "organizer-load multiplier lower bound mismatch");
  });

  test("Census Phase1: alignment tolerates runtime rows key reset when footprint/provenance match", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100", "17031010200"],
      loadedRowCount: 2,
      activeRowsKey: "2024|tract|17|031|core",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const aligned = assessRaceFootprintAlignment({
      censusState: { ...censusState, activeRowsKey: "" },
      raceFootprint: { ...live, fingerprint: live.fingerprint },
      assumptionsProvenance: {
        source: "census_phase1",
        raceFootprintFingerprint: live.fingerprint,
        censusRowsKey: live.rowsKey,
        acsYear: "2024",
        metricSet: "core",
      },
    });
    assert(aligned.readyForAssumptions === true, `alignment should be ready when runtime key resets (${aligned.reason})`);
  });

  test("Census Phase1: footprint capacity normalization", () => {
    const normalized = normalizeFootprintCapacity({
      source: "census_phase1",
      population: "1234",
      year: "2024",
      metricSet: "all",
      raceFootprintFingerprint: "17|tract|x",
      censusRowsKey: 12345,
      updatedAt: "2026-03-09T22:30:00.000Z",
    });
    assert(normalized.population === 1234, "population should normalize to number");
    assert(normalized.metricSet === "all", "metricSet should preserve valid set id");
    assert(normalized.censusRowsKey === "12345", "rows key should normalize to string");
    const invalid = normalizeFootprintCapacity({ population: -5, metricSet: "bad" });
    assert(invalid.population == null, "invalid population should normalize to null");
    assert(invalid.metricSet === "", "invalid metric set should clear");
  });

  test("Census Phase1: footprint feasibility detects hard capacity violations", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100"],
      loadedRowCount: 1,
      activeRowsKey: "2024|tract|17|031|core",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const result = evaluateFootprintFeasibility({
      state: {
        census: censusState,
        raceFootprint: { ...live, fingerprint: live.fingerprint },
        assumptionsProvenance: {
          source: "census_phase1",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: live.rowsKey,
          acsYear: "2024",
          metricSet: "core",
        },
        footprintCapacity: {
          source: "census_phase1",
          population: 100,
          year: "2024",
          metricSet: "core",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: live.rowsKey,
        },
      },
      res: {
        raw: { universeSize: 130 },
        expected: { turnoutVotes: 140, winThreshold: 110, persuasionNeed: 105 },
      },
    });
    const codes = result.issues.map((x) => x.code);
    assert(codes.includes("universe_exceeds_population"), "universe guard should fire");
    assert(codes.includes("turnout_exceeds_population"), "turnout guard should fire");
    assert(codes.includes("threshold_exceeds_population"), "threshold guard should fire");
    assert(codes.includes("need_exceeds_population"), "need guard should fire");
  });

  test("Census Phase1: footprint feasibility warns when capacity is missing", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100"],
      loadedRowCount: 1,
      activeRowsKey: "2024|tract|17|031|core",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const result = evaluateFootprintFeasibility({
      state: {
        census: censusState,
        raceFootprint: { ...live, fingerprint: live.fingerprint },
        assumptionsProvenance: {
          source: "census_phase1",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: live.rowsKey,
          acsYear: "2024",
          metricSet: "core",
        },
        footprintCapacity: {
          source: "census_phase1",
          population: null,
          year: "2024",
          metricSet: "core",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: live.rowsKey,
        },
      },
      res: {
        raw: { universeSize: 10 },
        expected: { turnoutVotes: 9, winThreshold: 6, persuasionNeed: 4 },
      },
    });
    const codes = result.issues.map((x) => x.code);
    assert(codes.includes("capacity_population_missing"), "capacity missing warning should fire");
  });

  test("Census Phase1: footprint feasibility warns when capacity context is stale", () => {
    const censusState = {
      year: "2025",
      resolution: "tract",
      metricSet: "demographics",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100"],
      loadedRowCount: 1,
      activeRowsKey: "2025|tract|17|031|demographics",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const result = evaluateFootprintFeasibility({
      state: {
        census: censusState,
        raceFootprint: { ...live, fingerprint: live.fingerprint },
        assumptionsProvenance: {
          source: "census_phase1",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: live.rowsKey,
          acsYear: "2025",
          metricSet: "demographics",
        },
        footprintCapacity: {
          source: "census_phase1",
          population: 1200,
          year: "2024",
          metricSet: "core",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: "2024|tract|17|031|core",
        },
      },
      res: {
        raw: { universeSize: 300 },
        expected: { turnoutVotes: 180, winThreshold: 95, persuasionNeed: 40 },
      },
    });
    const codes = result.issues.map((x) => x.code);
    assert(codes.includes("capacity_stale"), "capacity stale warning should fire");
    assert(!codes.includes("capacity_population_missing"), "capacity stale case should keep population available");
  });

  test("Census Phase1: footprint feasibility warns when provenance is stale", () => {
    const censusState = {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "17",
      countyFips: "031",
      selectedGeoids: ["17031010100"],
      loadedRowCount: 1,
      activeRowsKey: "2024|tract|17|031|core",
    };
    const live = buildRaceFootprintFromCensusSelection(censusState);
    const result = evaluateFootprintFeasibility({
      state: {
        census: censusState,
        raceFootprint: { ...live, fingerprint: live.fingerprint },
        assumptionsProvenance: {
          source: "census_phase1",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: live.rowsKey,
          acsYear: "2023",
          metricSet: "core",
        },
        footprintCapacity: {
          source: "census_phase1",
          population: 1200,
          year: "2024",
          metricSet: "core",
          raceFootprintFingerprint: live.fingerprint,
          censusRowsKey: live.rowsKey,
        },
      },
      res: {
        raw: { universeSize: 300 },
        expected: { turnoutVotes: 180, winThreshold: 95, persuasionNeed: 40 },
      },
    });
    const codes = result.issues.map((x) => x.code);
    assert(codes.includes("provenance_stale"), "provenance stale warning should fire");
  });

  test("Census Phase1: footprint feasibility summary prioritizes bad over warn", () => {
    const summary = summarizeFootprintFeasibilityIssues([
      { kind: "warn", text: "Warning message." },
      { kind: "bad", text: "Bad message." },
      { kind: "warn", text: "Later warning." },
    ]);
    assert(summary.level === "bad", "summary should prioritize bad level");
    assert(summary.text === "Bad message.", "summary should use first bad message");
  });

  test("Census Phase1: footprint feasibility summary returns warn when only warnings exist", () => {
    const summary = summarizeFootprintFeasibilityIssues([
      { kind: "warn", text: "Warning message." },
      { kind: "warn", text: "Other warning." },
    ]);
    assert(summary.level === "warn", "summary should return warn level");
    assert(summary.text === "Warning message.", "summary should use first warning");
  });

  test("Census Phase1: footprint feasibility summary returns ok when issues are empty", () => {
    const summary = summarizeFootprintFeasibilityIssues([]);
    assert(summary.level === "ok", "summary should return ok level");
    assert(summary.text === "", "ok summary should have empty text");
  });

  test("Census Phase1: ACS advisory computes indices and APH adjustment", () => {
    const advisory = buildCensusAssumptionAdvisory({
      aggregate: {
        selectedGeoCount: 2,
        metrics: {
          population_total: { value: 2500 },
          housing_units_total: { value: 1100 },
          renter_share: { value: 0.52 },
          multi_unit_share: { value: 0.44 },
          limited_english_share: { value: 0.11 },
          ba_plus_share: { value: 0.38 },
          median_household_income_est: { value: 68000 },
        },
      },
      doorShare: 0.55,
      doorsPerHour: 22,
      callsPerHour: 18,
    });
    assert(advisory.ready === true, "advisory should be ready");
    assert(advisory.reason === "ready", "advisory reason mismatch");
    assert(advisory.coverage.availableSignals >= 6, "advisory signal coverage mismatch");
    assert(advisory.indices.fieldSpeed > 0 && advisory.indices.fieldSpeed < 2, "fieldSpeed index out of bounds");
    assert(advisory.indices.fieldDifficulty > 0 && advisory.indices.fieldDifficulty < 2, "fieldDifficulty index out of bounds");
    assert(Number.isFinite(advisory.aph.base), "base APH should be finite");
    assert(Number.isFinite(advisory.aph.adjusted), "adjusted APH should be finite");
    assert(Number.isFinite(advisory.aph.deltaPct), "advisory APH delta should be finite");
    assert(Number.isFinite(advisory.aph.range?.low), "advisory APH low band should be finite");
    assert(Number.isFinite(advisory.aph.range?.mid), "advisory APH mid band should be finite");
    assert(Number.isFinite(advisory.aph.range?.high), "advisory APH high band should be finite");
    assert(advisory.aph.range.low <= advisory.aph.range.mid && advisory.aph.range.mid <= advisory.aph.range.high, "advisory APH band order mismatch");
  });

  test("Census Phase1: ACS advisory computes weighted APH band from selected GEO variability", () => {
    const rowsByGeoid = {
      "17031010100": {
        values: {
          B01003_001E: 1000,
          B25001_001E: 420,
          B25003_003E: 260,
          B25003_001E: 400,
          B25024_003E: 120,
          B25024_004E: 80,
          B25024_001E: 300,
          C16002_004E: 20,
          C16002_007E: 15,
          C16002_010E: 10,
          C16002_013E: 5,
          C16002_001E: 900,
          B15003_022E: 90,
          B15003_023E: 60,
          B15003_024E: 30,
          B15003_025E: 20,
          B15003_001E: 700,
          B19013_001E: 52000,
        },
      },
      "17031010200": {
        values: {
          B01003_001E: 2500,
          B25001_001E: 980,
          B25003_003E: 300,
          B25003_001E: 800,
          B25024_003E: 90,
          B25024_004E: 60,
          B25024_001E: 900,
          C16002_004E: 30,
          C16002_007E: 20,
          C16002_010E: 12,
          C16002_013E: 8,
          C16002_001E: 2000,
          B15003_022E: 260,
          B15003_023E: 210,
          B15003_024E: 120,
          B15003_025E: 70,
          B15003_001E: 1800,
          B19013_001E: 86000,
        },
      },
      "17031010300": {
        values: {
          B01003_001E: 700,
          B25001_001E: 310,
          B25003_003E: 230,
          B25003_001E: 290,
          B25024_003E: 110,
          B25024_004E: 75,
          B25024_001E: 210,
          C16002_004E: 35,
          C16002_007E: 28,
          C16002_010E: 20,
          C16002_013E: 14,
          C16002_001E: 500,
          B15003_022E: 40,
          B15003_023E: 25,
          B15003_024E: 15,
          B15003_025E: 10,
          B15003_001E: 420,
          B19013_001E: 42000,
        },
      },
    };
    const aggregate = aggregateRowsForSelection({
      rowsByGeoid,
      selectedGeoids: ["17031010100", "17031010200", "17031010300"],
      metricSet: "all",
    });
    const advisory = buildCensusAssumptionAdvisory({
      aggregate,
      rowsByGeoid,
      selectedGeoids: ["17031010100", "17031010200", "17031010300"],
      doorShare: 0.6,
      doorsPerHour: 24,
      callsPerHour: 16,
    });
    assert(advisory.multiplierBand.sampleCount === 3, "advisory multiplier sample count mismatch");
    assert(advisory.multiplierBand.low <= advisory.multiplierBand.mid, "advisory multiplier low/mid order mismatch");
    assert(advisory.multiplierBand.mid <= advisory.multiplierBand.high, "advisory multiplier mid/high order mismatch");
    assert(advisory.aph.range.low <= advisory.aph.range.mid, "advisory APH low/mid order mismatch");
    assert(advisory.aph.range.mid <= advisory.aph.range.high, "advisory APH mid/high order mismatch");
  });

  test("Census Phase1: ACS advisory handles missing selection", () => {
    const advisory = buildCensusAssumptionAdvisory({
      aggregate: {
        selectedGeoCount: 0,
        metrics: {},
      },
    });
    assert(advisory.ready === false, "advisory should not be ready without selection");
    assert(advisory.reason === "selection_missing", "advisory missing-selection reason mismatch");
    assert(advisory.coverage.availableSignals === 0, "advisory missing-selection coverage mismatch");
  });

  test("Census Phase1: pace advisory marks shortfall when required APH exceeds adjusted APH", () => {
    const advisory = {
      aph: { adjusted: 14.2 },
    };
    const pace = evaluateCensusPaceAgainstAdvisory({
      advisory,
      needVotes: 1800,
      weeks: 10,
      contactRatePct: 22,
      supportRatePct: 55,
      turnoutReliabilityPct: 80,
      orgCount: 2,
      orgHoursPerWeek: 10,
      volunteerMult: 1,
    });
    assert(pace.ready === true, "pace advisory should be ready");
    assert(pace.feasible === false, "pace advisory should detect shortfall");
    assert(pace.severity === "bad" || pace.severity === "warn", "pace advisory severity mismatch");
    assert(Number.isFinite(pace.requiredAph) && pace.requiredAph > 0, "required APH should be positive");
    assert(Number.isFinite(pace.gapPct) && pace.gapPct > 0, "pace advisory gap should be positive");
  });

  test("Census Phase1: pace advisory marks feasible when adjusted APH covers required APH", () => {
    const advisory = {
      aph: { adjusted: 30 },
    };
    const pace = evaluateCensusPaceAgainstAdvisory({
      advisory,
      needVotes: 600,
      weeks: 12,
      contactRatePct: 30,
      supportRatePct: 60,
      turnoutReliabilityPct: 85,
      orgCount: 3,
      orgHoursPerWeek: 12,
      volunteerMult: 1.1,
    });
    assert(pace.ready === true, "pace advisory should be ready");
    assert(pace.feasible === true, "pace advisory should mark feasible");
    assert(pace.severity === "ok", "pace advisory severity should be ok");
    assert(Number.isFinite(pace.gapPct) && pace.gapPct <= 0, "pace advisory gap should be non-positive");
  });

  test("Census Phase1: pace advisory uses achievable APH band for severity", () => {
    const nearTop = evaluateCensusPaceAgainstAdvisory({
      advisory: {
        aph: {
          adjusted: 20,
          range: { low: 18, mid: 20, high: 22 },
        },
      },
      needVotes: 500,
      weeks: 10,
      contactRatePct: 25,
      supportRatePct: 60,
      turnoutReliabilityPct: 80,
      orgCount: 2,
      orgHoursPerWeek: 10,
      volunteerMult: 1,
    });
    assert(nearTop.ready === true, "band pace check should be ready");
    assert(nearTop.feasible === true, "near-top band case should remain feasible");
    assert(nearTop.severity === "warn", "near-top band case should warn");
    assert(nearTop.nearTop === true, "near-top flag mismatch");
    const aboveBand = evaluateCensusPaceAgainstAdvisory({
      advisory: {
        aph: {
          adjusted: 20,
          range: { low: 18, mid: 20, high: 22 },
        },
      },
      needVotes: 560,
      weeks: 10,
      contactRatePct: 25,
      supportRatePct: 60,
      turnoutReliabilityPct: 80,
      orgCount: 2,
      orgHoursPerWeek: 10,
      volunteerMult: 1,
    });
    assert(aboveBand.ready === true, "above-band pace check should be ready");
    assert(aboveBand.feasible === false, "above-band pace case should be infeasible");
    assert(aboveBand.severity === "bad", "above-band pace case should be bad");
    assert(aboveBand.gapPct > 0, "above-band gap should be positive");
  });

  test("Census Phase1: pace advisory reports missing inputs", () => {
    const pace = evaluateCensusPaceAgainstAdvisory({
      advisory: { aph: { adjusted: null } },
      needVotes: null,
      weeks: null,
      contactRatePct: null,
      supportRatePct: null,
      turnoutReliabilityPct: null,
      orgCount: null,
      orgHoursPerWeek: null,
      volunteerMult: null,
    });
    assert(pace.ready === false, "pace advisory should not be ready");
    assert(pace.reason === "advisory_aph_missing", "pace advisory missing-input reason mismatch");
    assert(pace.severity === "muted", "pace advisory missing-input severity mismatch");
  });

  test("Census Phase1: election CSV guide and template contract", () => {
    const guide = getElectionCsvUploadGuide();
    assert(guide.schemaVersion === "election_results_csv.v1", "csv guide schema version mismatch");
    assert(Array.isArray(guide.requiredColumns) && guide.requiredColumns.includes("precinct_id"), "csv guide required columns missing");
    assert(Array.isArray(guide.optionalColumns) && guide.optionalColumns.includes("party"), "csv guide optional columns missing");
    assert(Array.isArray(guide.optionalColumns) && guide.optionalColumns.includes("registered_voters"), "csv guide registered_voters optional column missing");
    assert(Array.isArray(guide.acceptedFormats) && guide.acceptedFormats.length >= 2, "csv guide formats missing");
    const template = buildElectionCsvTemplate();
    const lines = String(template || "").trim().split("\n");
    assert(lines.length === 2, "csv template should contain header and sample row");
    const header = lines[0].split(",");
    const sample = lines[1].split(",");
    const expectedHeader = [...guide.requiredColumns, ...guide.optionalColumns];
    assert(header.join(",") === expectedHeader.join(","), "csv template header mismatch");
    assert(sample.length === header.length, "csv template sample column count mismatch");
    const wideTemplate = buildElectionCsvWideTemplate();
    const wideLines = String(wideTemplate || "").trim().split("\n");
    assert(wideLines.length === 2, "wide csv template should contain header and sample row");
  });

  test("Census Phase1: election CSV guide block and template controls render", () => {
    if (typeof document === "undefined" || typeof document.getElementById !== "function"){
      return;
    }
    const requiredIds = [
      "censusElectionCsvGuideStatus",
      "btnCensusDownloadElectionCsvTemplate",
      "btnCensusDownloadElectionCsvWideTemplate",
      "censusElectionCsvPrecinctFilter",
      "btnCensusElectionCsvDryRun",
      "btnCensusElectionCsvClear",
      "censusAdvisoryStatus",
      "censusAdvisoryTbody",
      "censusAdvisoryGuide",
      "censusAdvisoryGuideTbody",
      "censusApplyAdjustmentsToggle",
      "censusApplyAdjustmentsStatus",
      "censusMapQaVtdToggle",
      "censusMapQaVtdZip",
      "btnCensusMapQaVtdZipClear",
      "censusMapQaVtdZipStatus",
    ];
    for (const id of requiredIds){
      assert(!!document.getElementById(id), `missing guide control: ${id}`);
    }
  });

  test("Census Phase1: election CSV format detection supports long and wide", () => {
    const longDetected = detectElectionCsvFormat([
      "state_fips", "county_fips", "election_date", "office", "district_id", "precinct_id", "candidate", "votes",
    ]);
    assert(longDetected.format === "long", "long format detection failed");
    const wideDetected = detectElectionCsvFormat([
      "state_fips", "county_fips", "election_date", "office", "district_id", "precinct_id", "Jane Doe", "John Roe",
    ]);
    assert(wideDetected.format === "wide", "wide format detection failed");
    assert(Array.isArray(wideDetected.candidateColumns) && wideDetected.candidateColumns.length === 2, "wide candidate column detection mismatch");
  });

  test("Census Phase1: wide election CSV normalization expands candidate columns", () => {
    const rows = [
      {
        state_fips: "17",
        county_fips: "031",
        election_date: "2024-11-05",
        office: "US House",
        district_id: "IL-07",
        precinct_id: "17-031-001A",
        "Jane Doe": "1245",
        "John Roe": "1830",
        total_votes_precinct: "3140",
        registered_voters: "4120",
      },
    ];
    const normalized = normalizeElectionCsvRows(rows, { headers: Object.keys(rows[0]) });
    assert(normalized.ok === true, "wide normalization should succeed");
    assert(normalized.format === "wide", "wide normalization format mismatch");
    assert(Array.isArray(normalized.records) && normalized.records.length === 2, "wide normalization record count mismatch");
    const names = normalized.records.map((x) => x.candidate).sort((a, b) => a.localeCompare(b));
    assert(names[0] === "Jane Doe" && names[1] === "John Roe", "wide normalization candidate names mismatch");
    const totalVotes = normalized.records.reduce((acc, row) => acc + Number(row.votes || 0), 0);
    assert(totalVotes === 3075, "wide normalization vote totals mismatch");
    assert(normalized.records.every((row) => Number(row.registered_voters) === 4120), "wide normalization registered_voters mismatch");
  });

  test("Census Phase1: long election CSV normalization preserves candidate rows", () => {
    const rows = [
      {
        state_fips: "17",
        county_fips: "031",
        election_date: "2024-11-05",
        office: "US House",
        district_id: "IL-07",
        precinct_id: "17-031-001A",
        candidate: "Jane Doe",
        votes: "1245",
      },
      {
        state_fips: "17",
        county_fips: "031",
        election_date: "2024-11-05",
        office: "US House",
        district_id: "IL-07",
        precinct_id: "17-031-001A",
        candidate: "John Roe",
        votes: "1830",
      },
    ];
    const normalized = normalizeElectionCsvRows(rows, { headers: Object.keys(rows[0]) });
    assert(normalized.ok === true, "long normalization should succeed");
    assert(normalized.format === "long", "long normalization format mismatch");
    assert(Array.isArray(normalized.records) && normalized.records.length === 2, "long normalization record count mismatch");
  });

  test("Census Phase1: CSV parser handles quoted values", () => {
    const parsed = parseCsvText("\"a\",\"b\"\n\"x,1\",\"y\"\n");
    assert(parsed.ok === true, "csv parser should succeed");
    assert(Array.isArray(parsed.headers) && parsed.headers.length === 2, "csv parser header count mismatch");
    assert(Array.isArray(parsed.rows) && parsed.rows.length === 1, "csv parser row count mismatch");
    assert(parsed.rows[0].a === "x,1", "csv parser quoted value mismatch");
  });

  test("Census Phase1: alias election CSV normalization uses context and skips summary rows", () => {
    const rows = [
      {
        JurisdictionID: "16",
        JurisName: "COOK",
        EISContestID: "0",
        ContestName: "",
        PrecinctName: "7000001",
        Registration: "1015",
        CandidateName: "",
        VoteCount: "231",
      },
      {
        JurisdictionID: "16",
        JurisName: "COOK",
        EISContestID: "12921",
        ContestName: "PRESIDENT",
        PrecinctName: "7000001",
        Registration: "1015",
        CandidateName: "JANE DOE",
        VoteCount: "150",
      },
      {
        JurisdictionID: "16",
        JurisName: "COOK",
        EISContestID: "12921",
        ContestName: "PRESIDENT",
        PrecinctName: "7000001",
        Registration: "1015",
        CandidateName: "JOHN ROE",
        VoteCount: "81",
      },
    ];
    const normalized = normalizeElectionCsvRows(rows, {
      headers: Object.keys(rows[0]),
      context: {
        state_fips: "17",
        county_fips: "031",
        election_date: "2024-11-05",
      },
    });
    assert(normalized.ok === true, "alias normalization should succeed");
    assert(normalized.format === "long", "alias normalization should detect long format");
    assert(Array.isArray(normalized.records) && normalized.records.length === 2, "alias normalization record count mismatch");
    assert(Number(normalized.skippedSummaryRows) === 1, "alias normalization summary skip mismatch");
    assert(Array.isArray(normalized.errors) && normalized.errors.length === 0, "alias normalization should not emit errors");
    const first = normalized.records[0];
    assert(first.state_fips === "17", "alias normalization state context mismatch");
    assert(first.county_fips === "031", "alias normalization county context mismatch");
    assert(first.election_date === "2024-11-05", "alias normalization date context mismatch");
    assert(Number(first.registered_voters) === 1015, "alias normalization registered_voters mismatch");
  });

  test("Census Phase1: broad aliases are rejected without explicit mapping", () => {
    const rows = [
      {
        state: "17",
        county: "031",
        date: "2024-11-05",
        office: "US House",
        district_id: "IL-07",
        precinct_id: "17-031-001A",
        candidate: "Jane Doe",
        votes: "1245",
      },
    ];
    const normalized = normalizeElectionCsvRows(rows, { headers: Object.keys(rows[0]) });
    assert(normalized.ok === false, "broad aliases should not pass normalization");
    const msg = Array.isArray(normalized.errors) && normalized.errors.length ? String(normalized.errors[0]) : "";
    assert(msg.includes("Missing required base columns"), "broad alias failure message mismatch");
  });

  test("Census Phase1: registration header is reserved in wide format", () => {
    const detected = detectElectionCsvFormat([
      "state_fips",
      "county_fips",
      "election_date",
      "office",
      "district_id",
      "precinct_id",
      "Registration",
      "Jane Doe",
      "John Roe",
    ]);
    assert(detected.format === "wide", "wide detection with registration header failed");
    assert(Array.isArray(detected.candidateColumns) && detected.candidateColumns.length === 2, "registration should not be treated as candidate column");
  });

  test("Census Phase1: wide normalization skips non-numeric extra columns", () => {
    const rows = [
      {
        state_fips: "17",
        county_fips: "031",
        election_date: "2024-11-05",
        office: "US House",
        district_id: "IL-07",
        precinct_id: "17-031-001A",
        JurisdictionID: "16",
        "Jane Doe": "1,245",
        "John Roe": "1830",
        "Batch Label": "A-1",
      },
    ];
    const normalized = normalizeElectionCsvRows(rows, { headers: Object.keys(rows[0]) });
    assert(normalized.ok === true, "wide normalization with non-numeric extras should succeed");
    assert(Array.isArray(normalized.records) && normalized.records.length === 2, "wide normalization should only keep numeric candidate vote columns");
    const names = normalized.records.map((x) => x.candidate).sort((a, b) => a.localeCompare(b));
    assert(names[0] === "Jane Doe" && names[1] === "John Roe", "wide normalization candidate names mismatch with extras");
    const totalVotes = normalized.records.reduce((acc, row) => acc + Number(row.votes || 0), 0);
    assert(totalVotes === 3075, "wide normalization should parse comma-formatted vote values");
    assert(
      Array.isArray(normalized.warnings) && normalized.warnings.some((msg) => String(msg).includes("non-numeric cell(s)")),
      "wide normalization should warn on non-numeric extra columns",
    );
  });
}
