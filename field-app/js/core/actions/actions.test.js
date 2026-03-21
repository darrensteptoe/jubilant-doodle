// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { makeCanonicalState } from "../state/schema.js";
import {
  addBallotCandidate,
  removeBallotCandidate,
  setBallotYourCandidate,
  updateBallotCandidate,
  updateBallotUserSplit,
} from "./ballot.js";
import { addCandidateHistoryRecord, removeCandidateHistoryRecord, updateCandidateHistoryRecord } from "./candidateHistory.js";
import { updateCensusConfig } from "./census.js";
import { applyDistrictTemplate, updateDistrictFormField } from "./district.js";
import {
  applyElectionBenchmarks,
  importElectionDataFile,
  mapElectionDataColumns,
  reconcileElectionDataCandidates,
  reconcileElectionDataGeographies,
} from "./electionData.js";
import { saveEventCalendarEvent } from "./eventCalendar.js";
import { saveForecastArchiveActual } from "./forecastArchive.js";
import { runOutcomeMc, updateOutcomeControlField } from "./outcome.js";
import { updateTargetingConfig } from "./targeting.js";
import { updateWeatherRiskConfig } from "./weatherRisk.js";

function seededState() {
  return makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
}

test("actions: field updates mutate only intended slices and bump revisions", () => {
  const base = seededState();
  const result = updateDistrictFormField(base, { field: "weeksRemaining", value: "28" });

  assert.equal(result.changed, true);
  assert.equal(result.blocked, false);
  assert.notEqual(result.state, base);
  assert.equal(result.state.revision, base.revision + 1);
  assert.equal(result.state.domains.district.form.weeksRemaining, "28");
  assert.notEqual(result.state.domains.district, base.domains.district);
  assert.equal(result.state.domains.ballot, base.domains.ballot);
  assert.equal(result.state.domains.census, base.domains.census);
  assert.equal(result.state.domains.district.revision, 1);
});

test("actions: ballot row add/edit/remove + user split update", () => {
  const base = seededState();
  const added = addBallotCandidate(base, { name: "Jamie Rivera", supportPct: 22 });
  assert.equal(added.changed, true);
  const newId = added.state.domains.ballot.candidateRefs.order.find((id) => id.includes("jamie_rivera"));
  assert.ok(newId, "new candidate id missing");

  const edited = updateBallotCandidate(added.state, { candidateId: newId, field: "supportPct", value: "24" });
  assert.equal(edited.changed, true);
  assert.equal(edited.state.domains.ballot.candidateRefs.byId[newId].supportPct, 24);

  const split = updateBallotUserSplit(edited.state, { candidateId: newId, value: "38" });
  assert.equal(split.changed, true);
  assert.equal(split.state.domains.ballot.userSplitByCandidateId[newId], 38);

  const fallbackId = split.state.domains.ballot.candidateRefs.order.find((id) => id !== newId);
  assert.ok(fallbackId, "expected fallback candidate id");

  const selectedFallback = setBallotYourCandidate(split.state, { candidateId: fallbackId });
  assert.equal(selectedFallback.changed, true);
  assert.equal(selectedFallback.state.domains.ballot.yourCandidateId, fallbackId);

  const selected = setBallotYourCandidate(selectedFallback.state, { candidateId: newId });
  assert.equal(selected.changed, true);
  assert.equal(selected.state.domains.ballot.yourCandidateId, newId);

  const removed = removeBallotCandidate(selected.state, { candidateId: newId });
  assert.equal(removed.changed, true);
  assert.equal(Boolean(removed.state.domains.ballot.candidateRefs.byId[newId]), false);
});

test("actions: candidate history row add/edit/remove", () => {
  const base = seededState();
  const added = addCandidateHistoryRecord(base, {
    office: "US House",
    cycleYear: 2024,
    electionType: "general",
    candidateName: "Jamie Rivera",
    voteShare: 51.2,
  });
  assert.equal(added.changed, true);
  const recordId = added.state.domains.candidateHistory.records[0].recordId;
  assert.ok(recordId);

  const edited = updateCandidateHistoryRecord(added.state, {
    recordId,
    field: "voteShare",
    value: "52.4",
  });
  assert.equal(edited.changed, true);
  assert.equal(edited.state.domains.candidateHistory.records[0].voteShare, 52.4);

  const removed = removeCandidateHistoryRecord(edited.state, { recordId });
  assert.equal(removed.changed, true);
  assert.equal(removed.state.domains.candidateHistory.records.length, 0);
});

test("actions: apply district template patch normalizes form/template/universe", () => {
  const base = seededState();
  const applied = applyDistrictTemplate(base, {
    templatePatch: {
      raceType: "congressional_district",
      officeLevel: "federal",
      electionType: "general",
      overriddenFields: ["mode", "turnoutA"],
    },
    formPatch: {
      mode: "turnout",
      turnoutA: "44",
      turnoutB: "47",
    },
    universePatch: {
      enabled: true,
      demPct: "36.5",
      repPct: "31.5",
    },
  });
  assert.equal(applied.changed, true);
  assert.equal(applied.state.domains.district.templateProfile.raceType, "congressional_district");
  assert.deepEqual(applied.state.domains.district.templateProfile.overriddenFields, ["mode", "turnoutA"]);
  assert.equal(applied.state.domains.district.form.mode, "turnout");
  assert.equal(applied.state.domains.district.form.turnoutA, 44);
  assert.equal(applied.state.domains.district.universeComposition.enabled, true);
  assert.equal(applied.state.domains.district.universeComposition.demPct, 36.5);
});

test("actions: election data import + mapping + candidate/geography reconciliation + benchmarks", () => {
  const base = seededState();
  const csvText = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes,total_votes_precinct,registered_voters,party",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245,2100,3000,DEM",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Blair Beta,855,2100,3000,REP",
  ].join("\n");

  const imported = importElectionDataFile(base, {
    fileName: "election.csv",
    fileSize: csvText.length,
    fileHash: "hash_001",
    csvText,
  });
  assert.equal(imported.changed, true);
  assert.equal(imported.importOk, true);
  assert.equal(imported.state.domains.electionData.normalizedRows.length, 2);
  assert.equal(imported.state.domains.electionData.voteTotals.validVotes, 2100);

  const mapped = mapElectionDataColumns(imported.state, {
    columnMap: {
      state_fips: "state_fips",
      county_fips: "county_fips",
      precinct_id: "precinct_id",
      candidate: "candidate",
      votes: "votes",
    },
  });
  assert.equal(mapped.changed, true);
  assert.equal(mapped.state.domains.electionData.schemaMapping.status, "mapped");

  const reconciledCandidates = reconcileElectionDataCandidates(mapped.state, {
    mapping: {
      "Alex Alpha": "cand_alex",
      "Blair Beta": "cand_blair",
    },
  });
  assert.equal(reconciledCandidates.changed, true);
  assert.ok(reconciledCandidates.state.domains.electionData.candidateRefs.byId.cand_alex);
  assert.ok(reconciledCandidates.state.domains.electionData.candidateRefs.byId.cand_blair);

  const reconciledGeos = reconcileElectionDataGeographies(reconciledCandidates.state, {
    mapping: {
      "17-031-001A": "geo_001A",
    },
  });
  assert.equal(reconciledGeos.changed, true);
  assert.ok(reconciledGeos.state.domains.electionData.geographyRefs.byId.geo_001A);

  const withBenchmarks = applyElectionBenchmarks(reconciledGeos.state, {
    benchmarks: {
      turnoutBaselines: [{ cycleYear: 2024, turnoutRate: 0.7 }],
      benchmarkSuggestions: [{ type: "turnout_calibration", value: 0.68 }],
    },
    downstreamRecommendations: {
      district: { baselineSupportHint: 0.51 },
      targeting: { turnoutBoostGeoids: ["geo_001A"] },
      outcome: { confidenceFloor: 0.62 },
    },
  });
  assert.equal(withBenchmarks.changed, true);
  assert.equal(withBenchmarks.state.domains.electionData.benchmarks.turnoutBaselines.length, 1);
  assert.equal(withBenchmarks.state.domains.electionData.benchmarks.downstreamRecommendations.district.baselineSupportHint, 0.51);
});

test("actions: scenario lock blocks mutating actions", () => {
  const base = seededState();
  const locked = {
    ...base,
    domains: {
      ...base.domains,
      campaign: {
        ...base.domains.campaign,
        contextLock: {
          ...base.domains.campaign.contextLock,
          scenario: true,
        },
      },
    },
  };

  const result = updateTargetingConfig(locked, { field: "topN", value: 75 });
  assert.equal(result.blocked, true);
  assert.equal(result.changed, false);
  assert.equal(result.reason, "scenario_locked");
  assert.equal(result.state, locked);
});

test("actions: cross-domain action coverage for census/weather/event/archive/outcome", () => {
  const base = seededState();

  const census = updateCensusConfig(base, { field: "stateFips", value: "17" });
  assert.equal(census.changed, true);
  assert.equal(census.state.domains.census.config.stateFips, "17");

  const weather = updateWeatherRiskConfig(census.state, { field: "overrideZip", value: "60614" });
  assert.equal(weather.changed, true);
  assert.equal(weather.state.domains.weatherRisk.overrideZip, "60614");

  const eventSaved = saveEventCalendarEvent(weather.state, {
    event: {
      title: "Weekend Canvass",
      date: "2026-04-04",
      expectedVolunteers: 45,
      applyToModel: true,
    },
  });
  assert.equal(eventSaved.changed, true);
  assert.equal(eventSaved.state.domains.eventCalendar.statusSummary.totalEvents, 1);

  const archiveSaved = saveForecastArchiveActual(eventSaved.state, {
    entry: {
      hash: "mc_hash_1",
      margin: 1.4,
      status: "fresh",
    },
  });
  assert.equal(archiveSaved.changed, true);
  assert.equal(archiveSaved.state.domains.forecastArchive.summary.total, 1);

  const control = updateOutcomeControlField(archiveSaved.state, { field: "mcMode", value: "advanced" });
  assert.equal(control.changed, true);
  assert.equal(control.state.domains.outcome.controls.mcMode, "advanced");

  const mc = runOutcomeMc(control.state, {
    run: { winProb: 0.58, expectedMargin: 1.2 },
    hash: "mc_hash_1",
    statusText: "MC run complete.",
  });
  assert.equal(mc.changed, true);
  assert.equal(mc.state.domains.outcome.cache.mcLastHash, "mc_hash_1");
});
