// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  STATE_MIGRATION_PLAN,
  STATE_MIGRATION_TARGET_VERSION,
  createCanonicalStateSeed,
  ensureCanonicalStateVersion,
  migrateState,
  migrateStateToCanonical,
  readStateVersion,
} from "./migrations.js";
import { CANONICAL_SCHEMA_VERSION } from "./schema.js";

test("migrations: migration plan targets canonical schema version", () => {
  assert.equal(STATE_MIGRATION_TARGET_VERSION, CANONICAL_SCHEMA_VERSION);
  assert.ok(Array.isArray(STATE_MIGRATION_PLAN));
  assert.ok(STATE_MIGRATION_PLAN.length >= 1);
  const latest = STATE_MIGRATION_PLAN[STATE_MIGRATION_PLAN.length - 1];
  assert.equal(Number(latest?.to), CANONICAL_SCHEMA_VERSION);
});

test("migrations: legacy state migrates into canonical shape", () => {
  const legacy = {
    campaignId: "cmp_001",
    officeId: "office_01",
    raceType: "municipal",
    weeksRemaining: "20",
    electionDate: "2026-11-03",
    candidates: [
      { id: "cand_a", name: "A", supportPct: 51 },
      { id: "cand_b", name: "B", supportPct: 44 },
    ],
    ui: {
      activeStage: "district",
    },
  };

  const migrated = migrateStateToCanonical(legacy, {
    nowDate: new Date("2026-03-21T12:00:00.000Z"),
  });
  assert.equal(migrated.schemaVersion, CANONICAL_SCHEMA_VERSION);
  assert.equal(migrated.domains.campaign.campaignId, "cmp_001");
  assert.equal(migrated.domains.district.form.weeksRemaining, "20");
  assert.equal(migrated.domains.ballot.candidateRefs.order.length, 2);
});

test("migrations: ensureCanonicalStateVersion keeps canonical state identity", () => {
  const state = createCanonicalStateSeed({
    nowDate: new Date("2026-03-21T12:00:00.000Z"),
  });
  const ensured = ensureCanonicalStateVersion(state, {
    nowDate: new Date("2026-03-21T13:00:00.000Z"),
  });
  assert.equal(ensured, state);
  assert.equal(readStateVersion(ensured), CANONICAL_SCHEMA_VERSION);
});

test("migrations: unsupported target version fails loud", () => {
  assert.throws(
    () => migrateState({}, { targetVersion: 999 }),
    /unsupported migration target version/,
  );
});

