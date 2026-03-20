import {
  applyTargetModelPreset,
  buildTargetRankingCsv,
  getTargetModelPreset,
  listTargetModelOptions,
  makeDefaultTargetingState,
  normalizeTargetingState,
  runTargetRanking,
} from "../../app/targetingRuntime.js";
import {
  MASTER_TARGETING_LAW_VERSION,
  buildCanonicalTargetFeatures,
  computeMasterTargetingEquation,
  resolveCanonicalWeightProfile,
  scoreCanonicalTarget,
} from "../targetFeatureEngine.js";
import {
  applyCandidateHistorySupportAdjustments,
  deriveCandidateHistoryBaseline,
} from "../candidateHistoryBaseline.js";
import { buildModelInputFromSnapshot } from "../modelInput.js";
import { computeDeterministic } from "../model.js";
import {
  deriveTargetSignalsForRow,
  listTargetModels,
  scoreTargetRow,
} from "../targetModels.js";
import {
  REQUIRED_MODEL_IDS,
  getModelDefinition,
  listModelDefinitions,
  verifyModelCoverage,
} from "../../app/modelRegistry.js";

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

  test("Phase 20: canonical model registry covers required model ids", () => {
    const coverage = verifyModelCoverage();
    assert(Array.isArray(coverage?.missingRequired), "coverage response missing required list");
    assert(coverage.missingRequired.length === 0, `missing required model ids: ${coverage.missingRequired.join(", ")}`);
    for (const id of REQUIRED_MODEL_IDS){
      const row = getModelDefinition(id);
      assert(!!row, `model registry missing ${id}`);
    }
  });

  test("Phase 20: model registry entries map to canonical owner metadata", () => {
    const models = listModelDefinitions();
    const allowed = new Set(["implemented", "partiallyImplemented", "planned", "absorbed"]);
    assert(models.length >= REQUIRED_MODEL_IDS.length, "registry row count should cover required model IDs");
    for (const row of models){
      const id = String(row?.id || "");
      assert(id.length > 0, "registry row missing id");
      assert(String(row?.displayName || "").length > 0, `registry row ${id} missing displayName`);
      assert(String(row?.purpose || "").length > 0, `registry row ${id} missing purpose`);
      assert(String(row?.formulaLabel || "").length > 0, `registry row ${id} missing formulaLabel`);
      assert(allowed.has(String(row?.status || "")), `registry row ${id} has invalid status`);
      if (String(row?.status) !== "planned"){
        assert(String(row?.canonicalImplementation?.module || "").length > 0, `registry row ${id} missing canonical implementation module`);
      }
    }
  });

  test("Phase 21: canonical features use support-centered persuasion multiplier", () => {
    const features = buildCanonicalTargetFeatures({
      components: {
        votePotential: 0.62,
        turnoutOpportunity: 0.48,
        persuasionIndex: 0.70,
        fieldEfficiency: 0.51,
      },
      rawSignals: {},
      state: {
        supportRatePct: 80,
        contactRatePct: 24,
        turnoutReliabilityPct: 79,
      },
      config: {},
    });
    const expectedMultiplier = 1 - (2 * Math.abs(0.5 - 0.8));
    const expectedAdjusted = 0.70 * expectedMultiplier;
    assert(Math.abs(Number(features?.supportScore) - 0.8) < 1e-9, "supportScore should resolve from canonical support rate");
    assert(Math.abs(Number(features?.persuasionMultiplier) - expectedMultiplier) < 1e-9, "persuasion multiplier should use canonical support-centered law");
    assert(Math.abs(Number(features?.adjustedPersuasion) - expectedAdjusted) < 1e-9, "adjusted persuasion should multiply persuasion index by canonical multiplier");
  });

  test("Phase 21: master targeting equation computes canonical score stack", () => {
    const weights = resolveCanonicalWeightProfile({
      profileId: "house_v1",
      customWeights: {
        votePotential: 0.4,
        turnoutOpportunity: 0.2,
        persuasionIndex: 0.2,
        fieldEfficiency: 0.1,
        networkValue: 0.1,
      },
    });
    const features = {
      votePotential: 0.7,
      turnoutOpportunity: 0.5,
      adjustedPersuasion: 0.28,
      fieldEfficiency: 0.6,
      networkValue: 0.1,
      contactProbability: 0.4,
      geographicMultiplier: 1.1,
      saturationMultiplier: 0.9,
    };
    const scored = computeMasterTargetingEquation({
      features,
      weightProfile: weights,
      expectedVotesReachable: 0.5,
      costPerContact: 2,
    });

    const expectedBase = ((0.7 * 0.4) + (0.5 * 0.2) + (0.28 * 0.2) + (0.6 * 0.1) + (0.1 * 0.1)) * 100;
    const expectedTarget = expectedBase * 0.4 * 1.1 * 0.9;
    const expectedNet = (expectedTarget * 0.5) / 2;

    assert(Math.abs(Number(scored?.baseScore) - expectedBase) < 1e-9, "base score should follow locked canonical weighted terms");
    assert(Math.abs(Number(scored?.targetScore) - expectedTarget) < 1e-9, "target score should multiply base by contact/geography/saturation");
    assert(Math.abs(Number(scored?.expectedNetVoteValue) - expectedNet) < 1e-9, "expected net vote value should divide by cost per contact");
  });

  test("Phase 21: scoreCanonicalTarget reports locked targeting law version", () => {
    const scored = scoreCanonicalTarget({
      features: {
        votePotential: 0.6,
        turnoutOpportunity: 0.5,
        adjustedPersuasion: 0.4,
        fieldEfficiency: 0.55,
        networkValue: 0.2,
        contactProbability: 0.3,
        geographicMultiplier: 1.0,
        saturationMultiplier: 1.0,
        expectedVotesReachable: 0.45,
        costPerContact: 1.5,
      },
      state: {},
      profileId: "house_v1",
      customWeights: null,
    });
    assert(String(scored?.targetingLawVersion || "") === MASTER_TARGETING_LAW_VERSION, "target scoring should publish canonical law version");
    assert(Number.isFinite(Number(scored?.scores?.expectedVotesReachable)), "target scoring should expose expectedVotesReachable");
    assert(Number.isFinite(Number(scored?.scores?.costPerContact)), "target scoring should expose costPerContact");
  });

  test("Phase 21.25: candidate-history baseline derives deterministic support adjustments", () => {
    const baseline = deriveCandidateHistoryBaseline({
      records: [
        {
          recordId: "h1",
          office: "IL-HD-10",
          cycleYear: 2022,
          electionType: "general",
          candidateName: "Candidate A",
          party: "DEM",
          incumbencyStatus: "incumbent",
          voteShare: 52.1,
          margin: 4.2,
          turnoutContext: 49.8,
          repeatCandidate: true,
          overUnderPerformancePct: 2.8,
        },
      ],
      candidates: [
        { id: "cand_a", name: "Candidate A", supportPct: 45 },
        { id: "cand_b", name: "Candidate B", supportPct: 45 },
      ],
      yourCandidateId: "cand_a",
      office: "IL-HD-10",
      electionType: "general",
      nowYear: 2026,
    });
    assert(Number(baseline.recordCount) === 1, "candidate-history baseline should keep record count");
    assert(String(baseline.confidenceBand || "") === "medium", "single complete history row should provide medium confidence");
    assert(Number(baseline?.adjustmentsByCandidateId?.cand_a || 0) > 0, "incumbent repeat row should apply positive support delta");

    const adjusted = applyCandidateHistorySupportAdjustments([
      { id: "cand_a", name: "Candidate A", supportPct: 45 },
      { id: "cand_b", name: "Candidate B", supportPct: 45 },
    ], baseline.adjustmentsByCandidateId);
    const adjustedA = adjusted?.adjustedCandidates?.find((row) => String(row?.id || "") === "cand_a");
    const adjustedB = adjusted?.adjustedCandidates?.find((row) => String(row?.id || "") === "cand_b");
    assert(Number(adjustedA?.supportPct || 0) > Number(adjustedB?.supportPct || 0), "support shift should favor candidate with positive history");
  });

  test("Phase 21.25: deterministic forecast consumes candidate-history baseline without parallel engine", () => {
    const snapshot = {
      officeId: "IL-HD-10",
      templateMeta: { electionType: "general" },
      universeSize: 100000,
      turnoutA: 50,
      turnoutB: 50,
      bandWidth: 4,
      candidates: [
        { id: "cand_a", name: "Candidate A", supportPct: 45 },
        { id: "cand_b", name: "Candidate B", supportPct: 45 },
      ],
      undecidedPct: 10,
      undecidedMode: "proportional",
      yourCandidateId: "cand_a",
      persuasionPct: 20,
      candidateHistory: [
        {
          recordId: "h1",
          office: "IL-HD-10",
          cycleYear: 2022,
          electionType: "general",
          candidateName: "Candidate A",
          party: "DEM",
          incumbencyStatus: "incumbent",
          voteShare: 52.1,
          margin: 4.2,
          turnoutContext: 49.8,
          repeatCandidate: true,
          overUnderPerformancePct: 2.8,
        },
      ],
    };
    const modelInput = buildModelInputFromSnapshot(snapshot);
    const res = computeDeterministic(modelInput);
    const impact = res?.expected?.candidateHistoryImpact || null;
    assert(impact && typeof impact === "object", "expected candidateHistoryImpact payload missing");
    assert(impact.enabled === true, "candidateHistoryImpact should be enabled when records exist");
    assert(Number(impact.yourVotesDelta || 0) !== 0, "candidate history should shift projected votes when confidence permits");
    assert(Number(res?.validation?.candidateHistory?.recordCount || 0) === 1, "validation should expose candidate-history record count");
  });

  test("Targeting: preset options include named campaign profiles and apply mapped defaults", () => {
    const options = listTargetModelOptions();
    const optionIds = new Set(options.map((row) => String(row?.id || "")));
    assert(optionIds.has("obama_persuasion"), "missing obama_persuasion preset");
    assert(optionIds.has("obama_turnout"), "missing obama_turnout preset");
    assert(optionIds.has("biden_expansion"), "missing biden_expansion preset");
    assert(optionIds.has("efficiency_sweep"), "missing efficiency_sweep preset");
    assert(optionIds.has("hybrid_model"), "missing hybrid_model preset");

    const target = makeDefaultTargetingState();
    const applied = applyTargetModelPreset(target, "obama_persuasion");
    assert(String(applied?.preset?.id || "") === "obama_persuasion", "preset apply did not resolve obama_persuasion");
    assert(String(target.modelId || "") === "persuasion_first", "obama_persuasion should map to persuasion_first model");
    assert(Number(target.topN) === 40, "obama_persuasion topN mismatch");
    const expectedWeights = resolveCanonicalWeightProfile({
      profileId: "persuasion_first",
      customWeights: getTargetModelPreset("obama_persuasion")?.weights,
    });
    assert(
      Math.abs(Number(target.weights?.persuasionIndex) - Number(expectedWeights?.persuasionIndex)) < 1e-9,
      "obama_persuasion persuasion weight mismatch",
    );

    const hybrid = getTargetModelPreset("hybrid_model");
    assert(String(hybrid?.modelId || "") === "house_v1", "hybrid_model should map to house_v1");
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
