import {
  makeDefaultCensusState,
  normalizeCensusState,
  buildAcsQueryUrl,
  parseCensusTable,
  optionFromRow,
  aggregateRowsForSelection,
  validateMetricSetWithCatalog,
  getVariablesForMetricSet,
} from "../censusModule.js";

export function registerCensusPhase1Tests(ctx){
  const { test, assert } = ctx;

  test("Census Phase1: default and normalization contract", () => {
    const base = makeDefaultCensusState();
    assert(base && typeof base === "object", "default census state missing");
    const normalized = normalizeCensusState({ year: "1900", resolution: "bad", metricSet: "x", stateFips: "7", countyFips: "9" });
    assert(normalized.resolution === "tract", "resolution did not normalize");
    assert(normalized.metricSet === "core", "metricSet did not normalize");
    assert(normalized.stateFips === "07", "stateFips did not normalize");
    assert(normalized.countyFips === "009", "countyFips did not normalize");
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
}
