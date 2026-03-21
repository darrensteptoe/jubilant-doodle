// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import { composeReportPayload } from "../../app/reportComposer.js";
import { makeCanonicalState, normalizeElectionDataSlice } from "../state/schema.js";
import { composeReportDocument } from "./composeReport.js";
import { buildReportContext } from "./reportContext.js";
import { REPORT_FAMILY_ORDER } from "./reportTypes.js";

const NOW_ISO = "2026-03-20T12:00:00.000Z";

function buildFixtureState() {
  const nowDate = new Date(NOW_ISO);
  const state = makeCanonicalState({ nowDate });
  state.revision = 19;

  state.domains.campaign.campaignId = "il-hd-21";
  state.domains.campaign.campaignName = "IL HD 21 Forward";
  state.domains.campaign.officeId = "west";
  state.domains.campaign.scenarioName = "baseline";
  state.domains.scenarios.activeScenarioId = "baseline";
  state.domains.scenarios.selectedScenarioId = "baseline";

  state.domains.district.revision = 6;
  state.domains.district.form.weeksRemaining = "28";
  state.domains.district.form.turnoutA = 44;
  state.domains.district.form.turnoutB = 49;
  state.domains.district.form.universeSize = 62000;
  state.domains.district.templateProfile.raceType = "state_leg";
  state.domains.district.templateProfile.electionType = "general";

  state.domains.ballot.revision = 5;
  state.domains.ballot.yourCandidateId = "cand_alpha";
  state.domains.ballot.undecidedPct = 9;
  state.domains.ballot.candidateRefs = {
    byId: {
      cand_alpha: { id: "cand_alpha", name: "Alex Alpha", supportPct: 47 },
      cand_beta: { id: "cand_beta", name: "Blair Beta", supportPct: 44 },
    },
    order: ["cand_alpha", "cand_beta"],
  };

  state.domains.candidateHistory.revision = 3;
  state.domains.candidateHistory.records = [
    {
      recordId: "hist_2024",
      office: "State House",
      cycleYear: 2024,
      electionType: "general",
      candidateName: "Alex Alpha",
      party: "DEM",
      voteShare: 50.8,
      margin: 1.6,
      turnoutContext: 63.4,
      repeatCandidate: true,
      overUnderPerformancePct: 1.1,
    },
  ];

  state.domains.targeting.revision = 7;
  state.domains.targeting.config.modelId = "house_v1";
  state.domains.targeting.config.geoLevel = "block_group";
  state.domains.targeting.config.minScore = 0.42;
  state.domains.targeting.runtime.rows = [
    { geoid: "170310101001", score: 0.81, isTopTarget: true, reachableVoters: 340, fieldEfficiency: 0.72 },
    { geoid: "170310101002", score: 0.63, isTopTarget: true, reachableVoters: 260, fieldEfficiency: 0.68 },
    { geoid: "170310101003", score: 0.29, isTopTarget: false, reachableVoters: 120, fieldEfficiency: 0.43 },
  ];

  state.domains.census.revision = 4;
  state.domains.census.config.year = "2024";
  state.domains.census.config.resolution = "tract";
  state.domains.census.selection.selectedGeoids = ["17031010100", "17031010200"];
  state.domains.census.selection.loadedRowCount = 2;

  state.domains.electionData = normalizeElectionDataSlice(
    {
      revision: 8,
      import: {
        fileName: "cook-2024.csv",
        importedAt: "2026-03-20T10:00:00.000Z",
        status: "imported",
        statusText: "Imported 2 rows.",
      },
      normalizedRows: [
        {
          state_fips: "17",
          county_fips: "031",
          election_date: "2024-11-05",
          office: "State House",
          district_id: "21",
          precinct_id: "17-031-001A",
          candidate: "Alex Alpha",
          candidate_id: "cand_alpha",
          party: "DEM",
          party_id: "dem",
          votes: 1245,
          total_votes_precinct: 2100,
          registered_voters: 3000,
        },
        {
          state_fips: "17",
          county_fips: "031",
          election_date: "2024-11-05",
          office: "State House",
          district_id: "21",
          precinct_id: "17-031-001A",
          candidate: "Blair Beta",
          candidate_id: "cand_beta",
          party: "REP",
          party_id: "rep",
          votes: 855,
          total_votes_precinct: 2100,
          registered_voters: 3000,
        },
      ],
      benchmarks: {
        turnoutBaselines: [{ cycleYear: 2024, turnoutRate: 0.7 }],
        historicalRaceBenchmarks: [{ cycleYear: 2022, margin: 1.8 }],
        comparableRacePools: [{ office: "State House", cycleYear: 2022, count: 12 }],
        downstreamRecommendations: {
          district: { baselineSupport: 46.2 },
          targeting: { turnoutBoostGeoids: ["170310101001"] },
          outcome: { confidenceFloor: 0.61 },
        },
      },
    },
    { nowDate },
  );

  state.domains.outcome.revision = 3;
  state.domains.outcome.cache.mcLastHash = "mc_hash_01";
  state.domains.outcome.cache.mcLast = {
    winProb: 0.58,
    expectedMargin: 1.5,
    p05Margin: -1.4,
    p95Margin: 4.1,
  };
  state.domains.outcome.cache.sensitivityRows = [{ label: "Turnout turnout", impact: 0.23 }];
  state.domains.outcome.cache.surfaceRows = [{ x: 0.9, y: 1.05, winProb: 0.57 }];

  state.domains.weatherRisk.overrideZip = "60614";
  state.domains.weatherRisk.selectedZip = "60614";
  state.domains.weatherRisk.fieldExecutionRisk = "medium";
  state.domains.weatherRisk.electionDayTurnoutRisk = "low";
  state.domains.weatherRisk.recommendedAction = "Shift launch 90 minutes later if rain probability exceeds 55%.";
  state.domains.weatherRisk.forecast3d = [{ precipProbability: 0.52 }];

  state.domains.eventCalendar.events = [
    {
      eventId: "event_1",
      title: "Canvass launch",
      date: "2026-03-23",
      status: "open",
      applyToModel: true,
      category: "field",
    },
    {
      eventId: "event_2",
      title: "Press conference",
      date: "2026-03-27",
      status: "closed",
      applyToModel: false,
      category: "earned_media",
    },
  ];

  state.domains.forecastArchive.selectedHash = "mc_hash_01";
  state.domains.forecastArchive.entries = [{ hash: "mc_hash_01", margin: 1.5 }];
  state.domains.forecastArchive.summary = { total: 1 };

  state.domains.recovery.strictImport = true;
  state.domains.recovery.usbConnected = false;
  state.domains.recovery.lastBackupRestoreAt = "2026-03-18T11:30:00.000Z";

  state.domains.governance.confidenceBand = "medium";
  state.domains.governance.topWarning = "Turnout priors are sensitive to one low-sample precinct.";
  state.domains.governance.learningRecommendation = "Refresh turnout priors after next import.";

  state.domains.audit.validationSnapshot = { ok: true };
  state.domains.audit.realismSnapshot = { ok: true };
  state.domains.audit.diagnosticsSnapshot = { ok: true };
  state.domains.audit.contractFindings = [{ id: "finding_1" }];

  return state;
}

function makeComparison(state) {
  const priorState = structuredClone(state);
  priorState.domains.targeting.runtime.rows = [
    { geoid: "170310101001", score: 0.58, isTopTarget: true, reachableVoters: 340, fieldEfficiency: 0.62 },
    { geoid: "170310101002", score: 0.47, isTopTarget: false, reachableVoters: 260, fieldEfficiency: 0.56 },
    { geoid: "170310101003", score: 0.22, isTopTarget: false, reachableVoters: 120, fieldEfficiency: 0.39 },
  ];
  priorState.domains.targeting.revision = 6;
  priorState.domains.outcome.cache.mcLast = {
    winProb: 0.51,
    expectedMargin: 0.8,
    p05Margin: -2.2,
    p95Margin: 3.4,
  };
  priorState.domains.outcome.revision = 2;
  priorState.revision = 18;

  const priorReport = composeReportDocument({
    reportType: "internal_full",
    state: priorState,
    nowDate: new Date("2026-03-13T12:00:00.000Z"),
  });
  return { priorReport };
}

test("report composition: all required report families compose deterministic typed output", () => {
  const state = buildFixtureState();

  for (const reportType of REPORT_FAMILY_ORDER) {
    const first = composeReportDocument({
      reportType,
      state,
      nowDate: new Date(NOW_ISO),
    });
    const second = composeReportDocument({
      reportType,
      state,
      nowDate: new Date(NOW_ISO),
    });

    assert.equal(first.reportType, reportType);
    assert.ok(Array.isArray(first.sections));
    assert.ok(Array.isArray(first.blocks));
    assert.ok(first.sections.length > 0, `${reportType} must have sections`);
    assert.ok(first.blocks.length > 0, `${reportType} must have blocks`);
    assert.deepEqual(second.sections, first.sections, `${reportType} should be deterministic`);
    assert.deepEqual(second.blocks, first.blocks, `${reportType} blocks should be deterministic`);
  }
});

test("report composition: internal and client report families are structurally distinct", () => {
  const state = buildFixtureState();
  const internalReport = composeReportDocument({
    reportType: "internal_full",
    state,
    nowDate: new Date(NOW_ISO),
  });
  const clientReport = composeReportDocument({
    reportType: "client_standard",
    state,
    nowDate: new Date(NOW_ISO),
  });

  const internalSectionIds = internalReport.sections.map((section) => section.id);
  const clientSectionIds = clientReport.sections.map((section) => section.id);
  assert.notDeepEqual(clientSectionIds, internalSectionIds);
  assert.ok(internalSectionIds.includes("operational_risk"));
  assert.ok(clientSectionIds.includes("strategic_position"));
});

test("report composition: comparison context generates trend/delta blocks", () => {
  const state = buildFixtureState();
  const comparison = makeComparison(state);
  const report = composeReportDocument({
    reportType: "internal_full",
    state,
    comparison,
    nowDate: new Date(NOW_ISO),
  });

  const trendBlock = report.blocks.find(
    (block) => String(block?.type || "") === "trend"
      && String(block?.label || "").toLowerCase().includes("change since prior"),
  );
  assert.ok(trendBlock, "expected a trend block for prior comparison deltas");
  assert.ok(Array.isArray(trendBlock.rows));
  assert.ok(
    trendBlock.rows.some((row) => String(row?.delta || "").trim() !== "—"),
    "trend block should include at least one computed delta",
  );
});

test("report composition: election-data benchmark family emits benchmark and recommendation blocks", () => {
  const state = buildFixtureState();
  const report = composeReportDocument({
    reportType: "election_data_benchmark",
    state,
    nowDate: new Date(NOW_ISO),
  });

  const benchmarkBlocks = report.blocks.filter((block) => block.type === "benchmark");
  const recommendationBlocks = report.blocks.filter((block) => block.type === "recommendation");

  assert.ok(benchmarkBlocks.length >= 3, "benchmark report should include benchmark blocks");
  assert.ok(
    benchmarkBlocks.some((block) => String(block?.label || "") === "Quality score"),
    "benchmark report should include election quality benchmark block",
  );
  assert.ok(recommendationBlocks.length >= 2, "benchmark report should include recommendation blocks");
});

test("report context: canonical selector sources and metadata are present", () => {
  const state = buildFixtureState();
  const ctx = buildReportContext({
    reportType: "internal_full",
    state,
    resultsSnapshot: {
      snapshotHash: "snapshot_123",
      schemaVersion: "1",
      appVersion: "2026.03.20",
      buildId: "build_abc",
    },
    nowDate: new Date(NOW_ISO),
  });

  assert.equal(ctx.context.campaignId, "il-hd-21");
  assert.equal(ctx.context.officeId, "west");
  assert.equal(ctx.context.scenarioId, "baseline");

  assert.ok(ctx.selectorRefs.canonical.includes("selectDistrictCanonicalView"));
  assert.ok(ctx.selectorRefs.derived.includes("selectOutcomeDerivedView"));
  assert.equal(ctx.selectorRefs.metrics, "buildMetricProvenanceDiagnostics");
  assert.ok(ctx.metrics.metrics.baselineSupport);
  assert.equal(ctx.sourceReferences.snapshotHash, "snapshot_123");
  assert.equal(ctx.sourceReferences.buildId, "build_abc");
});

test("report composer facade: preserves legacy aliases while exposing canonical typed payload", () => {
  const state = buildFixtureState();
  const legacy = composeReportPayload({
    reportType: "internal",
    state,
    nowDate: new Date(NOW_ISO),
  });
  const canonical = composeReportPayload({
    reportType: "client_standard",
    state,
    nowDate: new Date(NOW_ISO),
  });

  assert.equal(legacy.reportType, "internal");
  assert.equal(legacy.reportTypeCanonical, "internal_full");
  assert.equal(legacy.legacyReportType, "internal");
  assert.ok(Array.isArray(legacy.sections));
  assert.ok(Array.isArray(legacy.typedSections));
  assert.ok(Array.isArray(legacy.blocks));

  assert.equal(canonical.reportType, "client_standard");
  assert.equal(canonical.reportTypeCanonical, "client_standard");
  assert.equal(canonical.legacyReportType, "client");
});

