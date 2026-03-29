// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTurfEventUnitJoinKey,
  normalizeTurfEventRecord,
  normalizeTurfEventRecords,
  normalizeTurfEventUnitType,
  resolveTurfEventMapJoinRef,
  summarizeOrganizerGeographyJoinability,
} from "./geographyActivity.js";

test("operations geography activity: unit type normalization accepts canonical aliases", () => {
  assert.equal(normalizeTurfEventUnitType("block group"), "block_group");
  assert.equal(normalizeTurfEventUnitType("block-group"), "block_group");
  assert.equal(normalizeTurfEventUnitType("bg"), "block_group");
  assert.equal(normalizeTurfEventUnitType("tract"), "tract");
  assert.equal(normalizeTurfEventUnitType("precinct"), "precinct");
  assert.equal(normalizeTurfEventUnitType("turf"), "turf");
  assert.equal(normalizeTurfEventUnitType(""), "");
  assert.equal(normalizeTurfEventUnitType("county"), "");
});

test("operations geography activity: explicit unitType/unitId is preferred when valid", () => {
  const normalized = normalizeTurfEventRecord({
    id: "evt_1",
    unitType: "tract",
    unitId: "17-031-010100",
    turfId: "T-9",
    precinct: "P-22",
  });
  assert.equal(normalized.unitType, "tract");
  assert.equal(normalized.unitId, "17031010100");
  assert.equal(normalized.tractGeoid, "17031010100");
  assert.equal(normalized.stateFips, "17");
  assert.equal(normalized.countyFips, "031");
});

test("operations geography activity: falls back to legacy block-group/tract references", () => {
  const normalized = normalizeTurfEventRecord({
    id: "evt_2",
    blockGroupGeoid: "170310101001",
  });
  assert.equal(normalized.unitType, "block_group");
  assert.equal(normalized.unitId, "170310101001");
  assert.equal(normalized.blockGroupGeoid, "170310101001");
  assert.equal(normalized.tractGeoid, "17031010100");
  assert.equal(normalized.stateFips, "17");
  assert.equal(normalized.countyFips, "031");
});

test("operations geography activity: fallback supports legacy precinct and turf joins", () => {
  const precinctOnly = normalizeTurfEventRecord({ precinct: "P-11" });
  assert.equal(precinctOnly.unitType, "precinct");
  assert.equal(precinctOnly.unitId, "P-11");

  const turfOnly = normalizeTurfEventRecord({ turfId: "T-102" });
  assert.equal(turfOnly.unitType, "turf");
  assert.equal(turfOnly.unitId, "T-102");
});

test("operations geography activity: malformed geography safely degrades to empty join", () => {
  const malformed = normalizeTurfEventRecord({
    unitType: "tract",
    unitId: "bad",
    turfId: "",
    precinct: "",
  });
  assert.equal(malformed.unitType, "");
  assert.equal(malformed.unitId, "");
  assert.equal(malformed.tractGeoid, "");
  assert.equal(malformed.blockGroupGeoid, "");
});

test("operations geography activity: map join ref provides stable join key by unit family", () => {
  const tractRef = resolveTurfEventMapJoinRef({ unitType: "tract", unitId: "17031010100" });
  assert.equal(tractRef.joinable, true);
  assert.equal(tractRef.joinKey, "tract:17031010100");

  const precinctRef = resolveTurfEventMapJoinRef({ precinct: "Precinct 11-A" });
  assert.equal(precinctRef.joinable, true);
  assert.equal(precinctRef.unitType, "precinct");
  assert.equal(precinctRef.joinKey, "precinct:precinct11a");
});

test("operations geography activity: exported join-key helper stays deterministic", () => {
  assert.equal(buildTurfEventUnitJoinKey("turf", "T-7"), "turf:t7");
  assert.equal(buildTurfEventUnitJoinKey("precinct", "P-11"), "precinct:p11");
  assert.equal(buildTurfEventUnitJoinKey("tract", "17031010100"), "tract:17031010100");
  assert.equal(buildTurfEventUnitJoinKey("block_group", "170310101001"), "block_group:170310101001");
  assert.equal(buildTurfEventUnitJoinKey("tract", "bad"), "");
});

test("operations geography activity: list normalization preserves length and compatibility", () => {
  const rows = normalizeTurfEventRecords([
    { id: "a", turfId: "T-1" },
    { id: "b", precinct: "P-7" },
    { id: "c", blockGroupGeoid: "170310101001" },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].unitType, "turf");
  assert.equal(rows[1].unitType, "precinct");
  assert.equal(rows[2].unitType, "block_group");
});

test("operations geography activity: organizer joinability summary is truthful and bounded", () => {
  const summary = summarizeOrganizerGeographyJoinability({
    persons: [
      { id: "org_1", workforceRole: "organizer" },
      { id: "vol_1", workforceRole: "volunteer" },
    ],
    shiftRecords: [
      { id: "shift_1", turfId: "T-1" },
      { id: "shift_2", turfId: "" },
    ],
    turfEvents: [
      { id: "evt_1", assignedTo: "org_1", turfId: "T-1", shiftId: "shift_1" },
      { id: "evt_2", assignedTo: "org_1", precinct: "P-11" },
      { id: "evt_3", blockGroupGeoid: "170310101001" },
      { id: "evt_4", unitType: "tract", unitId: "bad" },
    ],
  });

  assert.equal(summary.organizerCount, 1);
  assert.equal(summary.shiftCount, 2);
  assert.equal(summary.shiftWithTurfIdCount, 1);
  assert.equal(summary.turfEventCount, 4);
  assert.equal(summary.organizerLinkedEventCount, 2);
  assert.equal(summary.organizerJoinableEventCount, 2);
  assert.equal(summary.shiftLinkedEventCount, 1);
  assert.equal(summary.joinableEventCount, 3);
  assert.equal(summary.unitTypeCounts.turf, 1);
  assert.equal(summary.unitTypeCounts.precinct, 1);
  assert.equal(summary.unitTypeCounts.block_group, 1);
  assert.equal(summary.unitTypeCounts.none, 1);
  assert.equal(summary.mappingScope.officeLevel, true);
  assert.equal(summary.mappingScope.turfLevel, true);
  assert.equal(summary.mappingScope.precinctLevel, true);
  assert.equal(summary.mappingScope.blockGroupLevel, true);
  assert.equal(summary.mappingScope.tractLevel, false);
});
