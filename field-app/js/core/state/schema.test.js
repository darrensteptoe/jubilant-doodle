// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_DOMAINS,
  CANONICAL_SCHEMA_VERSION,
  ELECTION_DATA_REQUIRED_COLUMNS,
  FIELD_OWNERSHIP_REGISTRY,
  findDuplicateFieldOwnership,
  makeCanonicalState,
  migrateLegacyStateToCanonical,
  normalizeElectionDataSlice,
} from "./schema.js";

test("schema defaults: canonical state includes all required domains and electionData defaults", () => {
  const state = makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
  assert.equal(state.schemaVersion, CANONICAL_SCHEMA_VERSION);
  assert.equal(typeof state.updatedAt, "string");
  assert.ok(state.updatedAt.startsWith("2026-03-20T12:00:00.000Z"));
  assert.ok(state.domains && typeof state.domains === "object");

  for (const domain of CANONICAL_DOMAINS) {
    assert.ok(Object.prototype.hasOwnProperty.call(state.domains, domain), `missing canonical domain: ${domain}`);
  }

  assert.deepEqual(
    state.domains.electionData.schemaMapping.requiredColumns,
    ELECTION_DATA_REQUIRED_COLUMNS,
    "electionData required columns drifted",
  );
  assert.deepEqual(state.domains.electionData.normalizedRows, []);
  assert.equal(state.domains.electionData.quality.confidenceBand, "unknown");
});

test("schema migration shape: legacy state migrates into canonical domains and normalizes election preview rows", () => {
  const legacy = {
    campaignId: "cmp_001",
    campaignName: "Test Campaign",
    officeId: "office_us_house",
    raceType: "congressional_district",
    electionDate: "2026-11-03",
    weeksRemaining: "32",
    mode: "persuasion",
    candidates: [
      { id: "cand_alpha", name: "Alex Alpha", supportPct: 44 },
      { id: "cand_beta", name: "Blair Beta", supportPct: 41 },
    ],
    userSplit: {
      cand_alpha: 55,
      cand_beta: 45,
    },
    candidateHistory: [
      {
        office: "US House",
        cycleYear: 2024,
        electionType: "general",
        candidateName: "Alex Alpha",
        party: "DEM",
        voteShare: 52.1,
      },
    ],
    census: {
      bridgeElectionCsvDryRunStatusText: "Loaded 2 rows",
      bridgeElectionCsvGuideStatusText: "Guide available",
      bridgeElectionCsvPreviewMetaText: "2 normalized rows",
      bridgeElectionCsvPrecinctFilter: "17-031",
      bridgeElectionPreviewRows: [
        ["17-031-001A", "Alex Alpha", "120", "250"],
        ["17-031-001A", "Blair Beta", "130", "250"],
      ],
    },
    ui: {
      activeStage: "district",
      assumptionsProfile: "template",
      activeScenarioId: "baseline",
    },
  };

  const migrated = migrateLegacyStateToCanonical(legacy, { nowDate: new Date("2026-03-20T12:00:00.000Z") });
  assert.equal(migrated.schemaVersion, CANONICAL_SCHEMA_VERSION);
  assert.equal(migrated.domains.campaign.campaignId, "cmp_001");
  assert.equal(migrated.domains.district.form.electionDate, "2026-11-03");
  assert.equal(migrated.domains.ballot.candidateRefs.order.length, 2);
  assert.equal(migrated.domains.ballot.userSplitByCandidateId.cand_alpha, 55);
  assert.equal(migrated.domains.candidateHistory.records.length, 1);
  assert.equal(migrated.domains.electionData.import.status, "ready");
  assert.equal(migrated.domains.electionData.normalizedRows.length, 2);
  assert.equal(migrated.domains.electionData.voteTotals.totalVotes, 250);
  assert.equal(migrated.domains.ui.activeStage, "district");
});

test("schema ownership registry: fields have exactly one canonical owner", () => {
  const duplicates = findDuplicateFieldOwnership();
  assert.deepEqual(duplicates, [], "field ownership registry has duplicates");

  for (const row of FIELD_OWNERSHIP_REGISTRY) {
    assert.ok(CANONICAL_DOMAINS.includes(row.domain), `unknown domain in ownership registry: ${row.domain}`);
    assert.ok(String(row.field || "").trim().length > 0, "empty field in ownership registry");
  }
});

test("electionData normalization shape: canonical refs/totals/quality are deterministic", () => {
  const normalized = normalizeElectionDataSlice(
    {
      rawRows: [
        {
          state_fips: "17",
          county_fips: "031",
          election_date: "2024-11-05",
          office: "US House",
          district_id: "IL-07",
          precinct_id: "17-031-001A",
          candidate: "Alex Alpha",
          party: "DEM",
          votes: "1245",
          total_votes_precinct: "2100",
          registered_voters: "3000",
        },
        {
          state_fips: "17",
          county_fips: "031",
          election_date: "2024-11-05",
          office: "US House",
          district_id: "IL-07",
          precinct_id: "17-031-001A",
          candidate: "Blair Beta",
          party: "REP",
          votes: "855",
          total_votes_precinct: "2100",
          registered_voters: "3000",
        },
      ],
      qa: {
        sourceWarnings: [],
        geographyWarnings: [],
        candidateWarnings: [],
        mappingWarnings: [],
        errors: [],
      },
    },
    { nowDate: new Date("2026-03-20T12:00:00.000Z") },
  );

  assert.equal(normalized.normalizedRows.length, 2);
  assert.equal(normalized.geographyRefs.order.length, 1);
  assert.equal(normalized.candidateRefs.order.length, 2);
  assert.equal(normalized.partyRefs.order.length, 2);
  assert.equal(normalized.turnoutTotals.ballotsCast, 2100);
  assert.equal(normalized.turnoutTotals.registeredVoters, 3000);
  assert.equal(normalized.voteTotals.validVotes, 2100);
  assert.equal(normalized.voteTotals.totalVotes, 2100);
  assert.equal(normalized.quality.confidenceBand, "high");
  assert.equal(normalized.quality.warningCount, 0);
  assert.ok(Number(normalized.quality.score) >= 0.85);
});
