import {
  buildTargetRankingCsv,
  makeDefaultTargetingState,
  normalizeTargetingState,
  runTargetRanking,
} from "../../app/targetingRuntime.js";
import {
  deriveTargetSignalsForRow,
  listTargetModels,
  scoreTargetRow,
} from "../targetModels.js";

function baseState(){
  return {
    turnoutA: 42,
    turnoutB: 48,
    contactRatePct: 24,
    supportRatePct: 56,
    turnoutReliabilityPct: 80,
    doorsPerHour3: 32,
    raceFootprint: {
      geoids: ["170310101001"],
    },
    targeting: makeDefaultTargetingState(),
  };
}

function makeRow(geoid, overrides = {}){
  return {
    geoid,
    label: `Row ${geoid}`,
    values: {
      B01003_001E: 1200,
      B25001_001E: 500,
      B25003_001E: 420,
      B25003_002E: 220,
      B25003_003E: 200,
      B08201_001E: 420,
      B08201_002E: 70,
      B05001_001E: 1200,
      B05001_002E: 900,
      B05001_003E: 120,
      B05001_004E: 80,
      B05001_005E: 60,
      B08303_001E: 520,
      B08303_011E: 80,
      B08303_012E: 25,
      B08303_013E: 15,
      B17001_001E: 1200,
      B17001_002E: 170,
      B28002_001E: 420,
      B28002_013E: 45,
      B15003_001E: 900,
      B15003_022E: 120,
      B15003_023E: 80,
      B15003_024E: 30,
      B15003_025E: 20,
      C16002_001E: 1200,
      C16002_004E: 30,
      C16002_007E: 20,
      C16002_010E: 10,
      C16002_013E: 5,
      B01001_002E: 580,
      B01001_026E: 620,
      B01001_007E: 30,
      B01001_008E: 35,
      B01001_009E: 28,
      B01001_010E: 24,
      B01001_031E: 31,
      B01001_032E: 33,
      B01001_033E: 24,
      B01001_034E: 22,
      B01001_011E: 35,
      B01001_012E: 35,
      B01001_035E: 33,
      B01001_036E: 32,
      B01001_013E: 37,
      B01001_014E: 35,
      B01001_037E: 36,
      B01001_038E: 34,
      B01001_015E: 40,
      B01001_016E: 38,
      B01001_017E: 36,
      B01001_018E: 34,
      B01001_019E: 32,
      B01001_039E: 39,
      B01001_040E: 37,
      B01001_041E: 35,
      B01001_042E: 33,
      B01001_043E: 31,
      B01001_020E: 24,
      B01001_021E: 22,
      B01001_022E: 20,
      B01001_023E: 18,
      B01001_024E: 16,
      B01001_025E: 14,
      B01001_044E: 24,
      B01001_045E: 22,
      B01001_046E: 20,
      B01001_047E: 18,
      B01001_048E: 16,
      B01001_049E: 14,
      B25024_003E: 30,
      B25024_004E: 22,
      B25024_005E: 18,
      B25024_006E: 14,
      B25024_007E: 10,
      B25024_008E: 8,
      B25024_009E: 7,
      B25024_010E: 6,
      B25024_011E: 5,
    },
    ...overrides,
  };
}

export function registerTargetingTests(ctx){
  const { test, assert } = ctx;

  test("Targeting: model registry exposes required model ids", () => {
    const models = listTargetModels();
    const ids = new Set(models.map((m) => String(m?.id || "")));
    assert(ids.has("turnout_opportunity"), "missing turnout_opportunity model");
    assert(ids.has("persuasion_first"), "missing persuasion_first model");
    assert(ids.has("field_efficiency"), "missing field_efficiency model");
    assert(ids.has("house_v1"), "missing house_v1 model");
    assert(models.length >= 4, "expected at least 4 target models");
  });

  test("Targeting: sparse row signal derivation remains finite", () => {
    const row = {
      geoid: "170310101001",
      values: {
        B01003_001E: 1000,
        B25001_001E: 400,
      },
    };
    const signal = deriveTargetSignalsForRow(row, baseState(), {});
    assert(Number.isFinite(Number(signal.population)), "population should be finite");
    assert(Number.isFinite(Number(signal.housingUnits)), "housingUnits should be finite");
    assert(Number.isFinite(Number(signal.votesPerOrganizerHour)), "votesPerOrganizerHour should be finite");
    assert(Number.isFinite(Number(signal.turnoutOpportunityRaw)), "turnoutOpportunityRaw should be finite");
  });

  test("Targeting: ranking sorts descending and flags top targets", () => {
    const state = baseState();
    state.targeting = normalizeTargetingState({
      modelId: "house_v1",
      topN: 2,
      onlyRaceFootprint: false,
      geoLevel: "block_group",
      minHousingUnits: 0,
      minPopulation: 0,
      minScore: 0,
      weights: {
        votePotential: 1,
        turnoutOpportunity: 0,
        persuasionIndex: 0,
        fieldEfficiency: 0,
      },
      criteria: {
        prioritizeYoung: false,
        prioritizeRenters: false,
        avoidHighMultiUnit: false,
        densityFloor: "none",
      },
    });

    const high = makeRow("170310101001", { values: { ...makeRow("x").values, B25001_001E: 900 } });
    const low = makeRow("170310101002", { values: { ...makeRow("y").values, B25001_001E: 250 } });
    const result = runTargetRanking({
      state,
      censusState: {
        rowsByGeoid: {
          [high.geoid]: high,
          [low.geoid]: low,
        },
        selectedGeoids: [high.geoid, low.geoid],
      },
    });

    assert(Array.isArray(result?.rows), "rows missing");
    assert(result.rows.length === 2, "expected two ranked rows");
    assert(result.rows[0].score >= result.rows[1].score, "rows should be sorted desc");
    assert(result.rows[0].isTopTarget === true, "top row should be flagged");
    assert(result.rows[1].isTopTarget === true, "second row should be flagged when topN includes rank 2");
    assert(result.rows[0].rank === 1, "first rank should be 1");
    assert(result.rows[1].rank === 2, "second rank should be 2");
  });

  test("Targeting: race-footprint filter and csv export contract", () => {
    const state = baseState();
    state.targeting = normalizeTargetingState({
      modelId: "turnout_opportunity",
      topN: 5,
      onlyRaceFootprint: true,
      geoLevel: "block_group",
      minHousingUnits: 0,
      minPopulation: 0,
    });
    state.raceFootprint = { geoids: ["170310101001"] };

    const inFp = makeRow("170310101001");
    const outFp = makeRow("170310101099");
    const result = runTargetRanking({
      state,
      censusState: {
        rowsByGeoid: {
          [inFp.geoid]: inFp,
          [outFp.geoid]: outFp,
        },
        selectedGeoids: [inFp.geoid, outFp.geoid],
      },
    });

    assert(result.rows.length === 1, "only race-footprint row should remain");
    assert(result.rows[0].geoid === inFp.geoid, "wrong row passed footprint filter");

    const csv = buildTargetRankingCsv(result.rows);
    assert(typeof csv === "string" && csv.includes("rank,geoid,label"), "csv header missing");
    assert(csv.includes(inFp.geoid), "csv should contain ranked geoid");
  });

  test("Targeting: house model score remains finite even with zeroed weights", () => {
    const score = scoreTargetRow({
      modelId: "house_v1",
      components: {
        votePotential: 0.7,
        turnoutOpportunity: 0.5,
        persuasionIndex: 0.4,
        fieldEfficiency: 0.6,
      },
      rawSignals: {},
      config: {
        weights: {
          votePotential: 0,
          turnoutOpportunity: 0,
          persuasionIndex: 0,
          fieldEfficiency: 0,
        },
      },
    });
    assert(Number.isFinite(Number(score?.score)), "house model score should remain finite");
    assert(score.score >= 0, "house model score should be non-negative");
  });
}
