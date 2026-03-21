// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  applyElectionBenchmarks,
  importElectionDataFile,
  mapElectionDataColumns,
  reconcileElectionDataCandidates,
  reconcileElectionDataGeographies,
} from "../actions/electionData.js";
import { computeElectionDataBenchmarks } from "./benchmarks.js";
import { normalizeElectionDataRows } from "./normalizeRows.js";
import { makeCanonicalState } from "../state/schema.js";
import { selectElectionDataDerivedView } from "../selectors/electionDataDerived.js";

function seededState() {
  return makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
}

test("electionData: import valid CSV into canonical domain", () => {
  const csvText = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes,total_votes_precinct,registered_voters,party,election_type,cycle_year",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245,2100,3000,DEM,general,2024",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Blair Beta,855,2100,3000,REP,general,2024",
  ].join("\n");

  const result = importElectionDataFile(seededState(), {
    fileName: "election.csv",
    fileSize: csvText.length,
    fileHash: "hash_01",
    csvText,
  });

  assert.equal(result.changed, true);
  assert.equal(result.importOk, true);
  assert.equal(result.state.domains.electionData.import.status, "imported");
  assert.equal(result.state.domains.electionData.normalizedRows.length, 2);
  assert.equal(result.state.domains.electionData.schemaMapping.status, "mapped");
  assert.ok(result.state.domains.electionData.benchmarks.historicalRaceBenchmarks.length >= 1);
});

test("electionData: reject malformed CSV payload", () => {
  const malformedCsv = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,\"Blair Beta,855",
  ].join("\n");

  const result = importElectionDataFile(seededState(), {
    fileName: "bad.csv",
    fileSize: malformedCsv.length,
    csvText: malformedCsv,
  });

  assert.equal(result.changed, true);
  assert.equal(result.importOk, false);
  assert.equal(result.state.domains.electionData.import.status, "error");
  assert.ok(result.state.domains.electionData.qa.errors.length >= 1);
});

test("electionData: map columns from non-canonical headers", () => {
  const base = seededState();
  const imported = importElectionDataFile(base, {
    rows: [
      {
        STATEFP: "17",
        COUNTYFP: "031",
        ELECTION_DATE: "2024-11-05",
        OFFICE_NAME: "US House",
        DISTRICT: "IL-07",
        PRECINCT: "17-031-001A",
        CAND_NAME: "Alex Alpha",
        VOTES_CAST: 1200,
        BALLOTS: 2100,
        REGISTERED: 3000,
      },
    ],
  });

  const mapped = mapElectionDataColumns(imported.state, {
    columnMap: {
      state_fips: "STATEFP",
      county_fips: "COUNTYFP",
      election_date: "ELECTION_DATE",
      office: "OFFICE_NAME",
      district_id: "DISTRICT",
      precinct_id: "PRECINCT",
      candidate: "CAND_NAME",
      votes: "VOTES_CAST",
      total_votes_precinct: "BALLOTS",
      registered_voters: "REGISTERED",
    },
  });

  assert.equal(mapped.changed, true);
  assert.equal(mapped.state.domains.electionData.schemaMapping.status, "mapped");
  assert.equal(mapped.state.domains.electionData.normalizedRows.length, 1);
  assert.equal(mapped.state.domains.electionData.normalizedRows[0].candidateName, "Alex Alpha");
});

test("electionData: normalize rows helper produces deterministic canonical slice", () => {
  const normalized = normalizeElectionDataRows(
    [
      {
        state_fips: "17",
        county_fips: "031",
        election_date: "2024-11-05",
        office: "US House",
        district_id: "IL-07",
        precinct_id: "17-031-001A",
        candidate: "Alex Alpha",
        votes: 1245,
        total_votes_precinct: 2100,
        registered_voters: 3000,
        party: "DEM",
      },
    ],
    {
      nowDate: new Date("2026-03-20T12:00:00.000Z"),
      columnMap: {
        state_fips: "state_fips",
        county_fips: "county_fips",
        election_date: "election_date",
        office: "office",
        district_id: "district_id",
        precinct_id: "precinct_id",
        candidate: "candidate",
        votes: "votes",
        total_votes_precinct: "total_votes_precinct",
        registered_voters: "registered_voters",
      },
    },
  );

  assert.equal(normalized.ok, true);
  assert.equal(normalized.normalizedRecords.length, 1);
  assert.equal(normalized.slice.candidateRefs.order.length, 1);
  assert.equal(normalized.slice.geographyRefs.order.length, 1);
  assert.equal(normalized.slice.voteTotals.validVotes, 1245);
});

test("electionData: reconcile candidate and geography mappings", () => {
  const csvText = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes,total_votes_precinct,registered_voters",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245,2100,3000",
  ].join("\n");

  const imported = importElectionDataFile(seededState(), {
    fileName: "election.csv",
    csvText,
  });

  const withCandidate = reconcileElectionDataCandidates(imported.state, {
    mapping: {
      "Alex Alpha": "cand_alex",
    },
  });
  assert.equal(withCandidate.changed, true);
  assert.equal(withCandidate.state.domains.electionData.normalizedRows[0].candidateId, "cand_alex");

  const withGeography = reconcileElectionDataGeographies(withCandidate.state, {
    mapping: {
      "17-031-001A": "geo_001A",
    },
  });
  assert.equal(withGeography.changed, true);
  assert.equal(withGeography.state.domains.electionData.normalizedRows[0].geographyId, "geo_001A");
});

test("electionData: compute benchmarks and emit downstream selector payloads", () => {
  const csvText = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes,total_votes_precinct,registered_voters,party,election_type,cycle_year",
    "17,031,2022-11-08,US House,IL-07,17-031-001A,Alex Alpha,1120,2000,2950,DEM,general,2022",
    "17,031,2022-11-08,US House,IL-07,17-031-001A,Blair Beta,880,2000,2950,REP,general,2022",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245,2100,3000,DEM,general,2024",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Blair Beta,855,2100,3000,REP,general,2024",
  ].join("\n");

  const imported = importElectionDataFile(seededState(), {
    fileName: "election.csv",
    csvText,
  });

  const computed = computeElectionDataBenchmarks(imported.state.domains.electionData.normalizedRows, {
    quality: imported.state.domains.electionData.quality,
  });
  assert.ok(computed.turnoutBaselines.length >= 1);
  assert.ok(computed.historicalRaceBenchmarks.length >= 1);
  assert.ok(computed.benchmarkSuggestions.length >= 1);

  const applied = applyElectionBenchmarks(imported.state, {
    benchmarks: {
      turnoutBaselines: computed.turnoutBaselines,
      historicalRaceBenchmarks: computed.historicalRaceBenchmarks,
      benchmarkSuggestions: computed.benchmarkSuggestions,
    },
    downstreamRecommendations: computed.downstreamRecommendations,
  });

  assert.equal(applied.changed, true);
  const derived = selectElectionDataDerivedView(applied.state);
  assert.ok((derived.benchmarkSummary.turnoutBaselineCount || 0) >= 1);
  assert.ok((derived.benchmarkSummary.historicalBenchmarkCount || 0) >= 1);
  assert.ok((derived.benchmarkSummary.recommendationTargets.district || 0) >= 1);
});
