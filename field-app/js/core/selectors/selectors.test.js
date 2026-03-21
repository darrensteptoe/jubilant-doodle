// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { makeCanonicalState, normalizeElectionDataSlice } from "../state/schema.js";
import { selectCensusCanonicalView } from "./censusCanonical.js";
import { selectCensusDerivedView } from "./censusDerived.js";
import { selectDistrictCanonicalView } from "./districtCanonical.js";
import { selectDistrictDerivedView } from "./districtDerived.js";
import { selectElectionDataCanonicalView } from "./electionDataCanonical.js";
import { selectElectionDataDerivedView } from "./electionDataDerived.js";
import { selectEventCalendarCanonicalView } from "./eventCalendarCanonical.js";
import { selectEventCalendarDerivedView } from "./eventCalendarDerived.js";
import { selectOutcomeCanonicalView } from "./outcomeCanonical.js";
import { selectOutcomeDerivedView } from "./outcomeDerived.js";
import { selectTargetingCanonicalView } from "./targetingCanonical.js";
import { selectTargetingDerivedView } from "./targetingDerived.js";
import { selectWeatherRiskCanonicalView } from "./weatherRiskCanonical.js";
import { selectWeatherRiskDerivedView } from "./weatherRiskDerived.js";

function deepClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return value;
}

function buildFixtureState() {
  const state = makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
  state.revision = 14;

  state.domains.district.form.weeksRemaining = "28";
  state.domains.district.form.turnoutA = 44;
  state.domains.district.form.turnoutB = 48;
  state.domains.district.templateProfile.raceType = "congressional_district";

  state.domains.ballot.candidateRefs = {
    byId: {
      cand_a: { id: "cand_a", name: "Alex Alpha", supportPct: 46 },
      cand_b: { id: "cand_b", name: "Blair Beta", supportPct: 42 },
    },
    order: ["cand_a", "cand_b"],
  };
  state.domains.ballot.userSplitByCandidateId = { cand_a: 53, cand_b: 47 };
  state.domains.ballot.undecidedPct = 12;
  state.domains.ballot.yourCandidateId = "cand_a";

  state.domains.candidateHistory.records = [
    {
      recordId: "history_1",
      office: "US House",
      cycleYear: 2024,
      electionType: "general",
      candidateName: "Alex Alpha",
      party: "DEM",
      voteShare: 51.2,
      margin: 2.3,
      turnoutContext: 67.5,
      repeatCandidate: true,
      overUnderPerformancePct: 1.1,
    },
  ];
  state.domains.candidateHistory.matchedRecordCount = 1;

  state.domains.targeting.config.modelId = "house_v1";
  state.domains.targeting.config.geoLevel = "block_group";
  state.domains.targeting.config.topN = 25;
  state.domains.targeting.config.minScore = 0.45;
  state.domains.targeting.runtime.statusText = "Targeting complete";
  state.domains.targeting.runtime.lastRunAt = "2026-03-20T11:00:00.000Z";
  state.domains.targeting.runtime.rows = [
    { geoid: "170310101001", score: 0.81, isTopTarget: true, reachableVoters: 320, fieldEfficiency: 0.73 },
    { geoid: "170310101002", score: 0.64, isTopTarget: true, reachableVoters: 210, fieldEfficiency: 0.67 },
    { geoid: "170310101003", score: 0.31, isTopTarget: false, reachableVoters: 80, fieldEfficiency: 0.41 },
  ];

  state.domains.census.config.year = "2024";
  state.domains.census.config.resolution = "tract";
  state.domains.census.selection.selectedGeoids = ["17031010100", "17031010200"];
  state.domains.census.selection.loadedRowCount = 2;
  state.domains.census.runtime.statusText = "Rows loaded.";
  state.domains.census.runtime.aggregateRows = [{ key: "population", value: 2200 }];
  state.domains.census.runtime.advisoryRows = [{ severity: "warn", text: "Low confidence in one tract." }];

  state.domains.electionData = normalizeElectionDataSlice(
    {
      import: {
        fileName: "election.csv",
        importedAt: "2026-03-20T10:00:00.000Z",
        status: "imported",
        statusText: "Imported 2 rows.",
      },
      normalizedRows: [
        {
          state_fips: "17",
          county_fips: "031",
          election_date: "2024-11-05",
          office: "US House",
          district_id: "IL-07",
          precinct_id: "17-031-001A",
          candidate: "Alex Alpha",
          candidate_id: "cand_a",
          party: "DEM",
          party_id: "party_dem",
          votes: 1245,
          total_votes_precinct: 2100,
          registered_voters: 3000,
        },
        {
          state_fips: "17",
          county_fips: "031",
          election_date: "2024-11-05",
          office: "US House",
          district_id: "IL-07",
          precinct_id: "17-031-001A",
          candidate: "Blair Beta",
          candidate_id: "cand_b",
          party: "REP",
          party_id: "party_rep",
          votes: 855,
          total_votes_precinct: 2100,
          registered_voters: 3000,
        },
      ],
      benchmarks: {
        turnoutBaselines: [{ cycleYear: 2024, turnoutRate: 0.7 }],
        historicalRaceBenchmarks: [{ cycleYear: 2022, margin: 1.8 }],
        downstreamRecommendations: {
          district: { baselineSupportHint: 0.51 },
          targeting: { turnoutBoostGeoids: ["17-031-001A"] },
          outcome: { confidenceFloor: 0.62 },
        },
      },
    },
    { nowDate: new Date("2026-03-20T12:00:00.000Z") },
  );

  state.domains.weatherRisk.status = "ready";
  state.domains.weatherRisk.selectedZip = "60614";
  state.domains.weatherRisk.fieldExecutionRisk = "medium";
  state.domains.weatherRisk.electionDayTurnoutRisk = "low";
  state.domains.weatherRisk.forecast3d = [{ precipProbability: 0.35 }, { precipProbability: 0.18 }];
  state.domains.weatherRisk.adjustment.enabled = true;
  state.domains.weatherRisk.adjustment.mode = "observe_only";
  state.domains.weatherRisk.adjustment.log = [{ at: "2026-03-20T11:30:00.000Z" }];

  state.domains.eventCalendar.events = [
    {
      eventId: "event_1",
      title: "Weekend Canvass",
      category: "field",
      date: "2026-03-28",
      status: "scheduled",
      applyToModel: true,
    },
    {
      eventId: "event_2",
      title: "Volunteer Debrief",
      category: "ops",
      date: "2026-03-30",
      status: "closed",
      applyToModel: false,
    },
  ];
  state.domains.eventCalendar.filters.category = "all";

  state.domains.outcome.controls.mcMode = "advanced";
  state.domains.outcome.cache.mcLastHash = "mc_hash_1";
  state.domains.outcome.cache.mcLast = {
    winProb: 0.59,
    expectedMargin: 1.6,
    p05Margin: -1.8,
    p95Margin: 4.7,
  };
  state.domains.outcome.cache.sensitivityRows = [{ label: "Turnout reliability", impact: 0.23 }];
  state.domains.outcome.cache.surfaceRows = [{ x: 1, y: 2, winProb: 0.57 }];
  state.domains.outcome.cache.surfaceStatusText = "Surface ready.";
  state.domains.outcome.cache.surfaceSummaryText = "Stable center plateau.";

  return state;
}

const canonicalSelectors = [
  ["districtCanonical", selectDistrictCanonicalView],
  ["electionDataCanonical", selectElectionDataCanonicalView],
  ["targetingCanonical", selectTargetingCanonicalView],
  ["censusCanonical", selectCensusCanonicalView],
  ["weatherRiskCanonical", selectWeatherRiskCanonicalView],
  ["eventCalendarCanonical", selectEventCalendarCanonicalView],
  ["outcomeCanonical", selectOutcomeCanonicalView],
];

const derivedSelectors = [
  ["districtDerived", selectDistrictDerivedView],
  ["electionDataDerived", selectElectionDataDerivedView],
  ["targetingDerived", selectTargetingDerivedView],
  ["censusDerived", selectCensusDerivedView],
  ["weatherRiskDerived", selectWeatherRiskDerivedView],
  ["eventCalendarDerived", selectEventCalendarDerivedView],
  ["outcomeDerived", selectOutcomeDerivedView],
];

test("selectors: same input returns deterministic output", () => {
  const state = buildFixtureState();
  for (const [label, selector] of [...canonicalSelectors, ...derivedSelectors]) {
    const first = selector(state);
    const second = selector(state);
    assert.deepEqual(second, first, `${label} is not deterministic`);
  }
});

test("selectors: no mutation side effects on input state", () => {
  const state = buildFixtureState();
  const baseline = deepClone(state);
  for (const [, selector] of [...canonicalSelectors, ...derivedSelectors]) {
    selector(state);
  }
  assert.deepEqual(state, baseline, "selectors mutated state");
});

test("selectors: canonical selectors ignore render-derived noise outside canonical domains", () => {
  const base = buildFixtureState();
  const noisy = deepClone(base);
  noisy.lastRenderCtx = {
    res: { supportA: 999, turnout: 999 },
    diagnostics: { volatile: true },
  };
  noisy.renderCache = { temp: "noise" };
  noisy.compat = { mergedView: true };

  for (const [label, selector] of canonicalSelectors) {
    const a = selector(base);
    const b = selector(noisy);
    assert.deepEqual(b, a, `${label} depends on render-derived noise`);
  }
});

test("selectors: derived selectors do not expose editable-owner keys", () => {
  const state = deepFreeze(buildFixtureState());
  const bannedRootKeys = new Set([
    "form",
    "templateProfile",
    "ballot",
    "config",
    "criteria",
    "weights",
    "controls",
    "schemaMapping",
    "rawRows",
    "draft",
    "events",
    "selection",
  ]);

  for (const [label, selector] of derivedSelectors) {
    const output = selector(state);
    Object.keys(output || {}).forEach((key) => {
      assert.equal(bannedRootKeys.has(key), false, `${label} leaked editable owner key: ${key}`);
    });
  }
});

