// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkedGeographyActivityIndex,
  buildWorkedGeographyUnitJoinKey,
  normalizeWorkedGeographyAlias,
} from "./workedGeography.js";

test("worked geography: organizer aggregation is joinable across legacy and normalized event refs", () => {
  const index = buildWorkedGeographyActivityIndex({
    persons: [
      { id: "org_1", name: "Morgan Diaz" },
      { id: "org_2", name: "Riley Park" },
    ],
    turfEvents: [
      { id: "evt_1", assignedTo: "org_1", officeId: "hq", turfId: "T-1", attempts: 10, canvassed: 6, vbms: 1, date: "2026-03-20" },
      { id: "evt_2", assignedTo: "org_1", officeId: "hq", precinct: "P-11", attempts: 5, canvassed: 4, vbms: 0, date: "2026-03-21" },
      { id: "evt_3", assignedTo: "org_2", officeId: "hq", unitType: "tract", unitId: "17031010100", attempts: 3, canvassed: 2, vbms: 0, date: "2026-03-21" },
    ],
  });

  assert.equal(index.available, true);
  assert.equal(index.joinableEventCount, 3);
  assert.equal(index.byUnitKey.get("turf:t1")?.touches, 1);
  assert.equal(index.byUnitKey.get("precinct:p11")?.touches, 1);
  assert.equal(index.byUnitKey.get("tract:17031010100")?.touches, 1);

  const organizerAlias = normalizeWorkedGeographyAlias("org_1");
  assert.equal(index.byOrganizerAliasUnitKey.get(`${organizerAlias}|turf:t1`)?.touches, 1);
  assert.equal(index.byOrganizerAliasUnitKey.get(`${organizerAlias}|precinct:p11`)?.touches, 1);
  assert.equal(index.byOrganizerTotals.get("org_1")?.touches, 2);
});

test("worked geography: office aggregation supports office scope and office+unit joins", () => {
  const index = buildWorkedGeographyActivityIndex({
    officeId: "hq",
    turfEvents: [
      { id: "a", officeId: "hq", assignedTo: "org_a", turfId: "T-5", attempts: 4, canvassed: 3, vbms: 1, date: "2026-03-18" },
      { id: "b", officeId: "hq", assignedTo: "org_a", unitType: "tract", unitId: "17031010100", attempts: 7, canvassed: 5, vbms: 0, date: "2026-03-19" },
      { id: "c", officeId: "west", assignedTo: "org_b", turfId: "T-8", attempts: 9, canvassed: 8, vbms: 0, date: "2026-03-19" },
    ],
  });

  assert.equal(index.consideredEventCount, 2);
  assert.equal(index.joinableEventCount, 2);
  assert.equal(index.officeTotals.touches, 2);
  assert.equal(index.officeTotals.attempts, 11);
  assert.equal(index.byOfficeUnitKey.get("hq|turf:t5")?.touches, 1);
  assert.equal(index.byOfficeUnitKey.get("hq|tract:17031010100")?.touches, 1);
  assert.equal(index.byOfficeUnitKey.has("west|turf:t8"), false);
});

test("worked geography: optional date and shift scopes are deterministic", () => {
  const index = buildWorkedGeographyActivityIndex({
    shiftId: "shift_1",
    dateFrom: "2026-03-21",
    dateTo: "2026-03-21",
    turfEvents: [
      { id: "x", shiftId: "shift_1", turfId: "T-1", date: "2026-03-21", attempts: 2 },
      { id: "y", shiftId: "shift_1", turfId: "T-2", date: "2026-03-20", attempts: 4 },
      { id: "z", shiftId: "shift_2", turfId: "T-3", date: "2026-03-21", attempts: 6 },
    ],
  });

  assert.equal(index.consideredEventCount, 1);
  assert.equal(index.joinableEventCount, 1);
  assert.equal(index.byUnitKey.size, 1);
  assert.equal(index.byUnitKey.get("turf:t1")?.attempts, 2);
});

test("worked geography: mixed legacy/new records safely fallback without invented precision", () => {
  const index = buildWorkedGeographyActivityIndex({
    turfEvents: [
      { id: "legacy_precinct", precinct: "P-7", attempts: 1 },
      { id: "legacy_turf", turfId: "T-2", attempts: 2 },
      { id: "new_bg", unitType: "block_group", unitId: "170310101001", attempts: 3 },
      { id: "new_bad", unitType: "tract", unitId: "bad", attempts: 4 },
      { id: "legacy_bad", turfId: "", precinct: "", attempts: 5 },
    ],
  });

  assert.equal(index.consideredEventCount, 5);
  assert.equal(index.joinableEventCount, 3);
  assert.equal(index.byUnitKey.has("precinct:p7"), true);
  assert.equal(index.byUnitKey.has("turf:t2"), true);
  assert.equal(index.byUnitKey.has("block_group:170310101001"), true);
  assert.equal(index.byUnitKey.has("tract:"), false);
});

test("worked geography: feature join-key helper remains compatible with turf-event join keys", () => {
  assert.equal(buildWorkedGeographyUnitJoinKey("turf", "T-11"), "turf:t11");
  assert.equal(buildWorkedGeographyUnitJoinKey("precinct", "P-88"), "precinct:p88");
  assert.equal(buildWorkedGeographyUnitJoinKey("tract", "17031010100"), "tract:17031010100");
  assert.equal(buildWorkedGeographyUnitJoinKey("block_group", "170310101001"), "block_group:170310101001");
  assert.equal(buildWorkedGeographyUnitJoinKey("tract", "bad"), "");
});
