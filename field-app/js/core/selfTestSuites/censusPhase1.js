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
  getElectionCsvUploadGuide,
  buildElectionCsvTemplate,
} from "../censusModule.js";

export function registerCensusPhase1Tests(ctx){
  const { test, assert } = ctx;

  test("Census Phase1: hardwired API key default is present", () => {
    const key = String(CENSUS_DEFAULT_API_KEY || "").trim();
    assert(/^[a-f0-9]{40}$/i.test(key), "hardwired Census API key default missing or invalid");
  });

  test("Census Phase1: default and normalization contract", () => {
    const base = makeDefaultCensusState();
    assert(base && typeof base === "object", "default census state missing");
    const normalized = normalizeCensusState({ year: "1900", resolution: "bad", metricSet: "x", stateFips: "7", countyFips: "9" });
    assert(normalized.resolution === "tract", "resolution did not normalize");
    assert(normalized.metricSet === "core", "metricSet did not normalize");
    assert(normalized.stateFips === "07", "stateFips did not normalize");
    assert(normalized.countyFips === "009", "countyFips did not normalize");
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
      generatedAt: "2026-03-09T22:00:00.000Z",
    });
    assert(normalized.source === "census_phase1", "provenance source mismatch");
    assert(normalized.raceFootprintFingerprint === "a|b|c", "provenance footprint key mismatch");
    assert(normalized.censusRowsKey === "12345", "provenance rows key mismatch");
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
      },
    });
    assert(mismatch.readyForAssumptions === false, "mismatch should block readiness");
    assert(mismatch.reason === "selection_mismatch", "mismatch reason should be selection_mismatch");
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

  test("Census Phase1: election CSV guide and template contract", () => {
    const guide = getElectionCsvUploadGuide();
    assert(guide.schemaVersion === "election_results_csv.v1", "csv guide schema version mismatch");
    assert(Array.isArray(guide.requiredColumns) && guide.requiredColumns.includes("precinct_id"), "csv guide required columns missing");
    assert(Array.isArray(guide.optionalColumns) && guide.optionalColumns.includes("party"), "csv guide optional columns missing");
    const template = buildElectionCsvTemplate();
    const lines = String(template || "").trim().split("\n");
    assert(lines.length === 2, "csv template should contain header and sample row");
    const header = lines[0].split(",");
    const sample = lines[1].split(",");
    const expectedHeader = [...guide.requiredColumns, ...guide.optionalColumns];
    assert(header.join(",") === expectedHeader.join(","), "csv template header mismatch");
    assert(sample.length === header.length, "csv template sample column count mismatch");
  });
}
