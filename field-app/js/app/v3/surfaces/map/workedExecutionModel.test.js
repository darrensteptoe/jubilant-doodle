// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkedExecutionSummaryModel,
  deriveWorkedActivityStateRows,
  normalizeWorkedScopeFocusType,
  resolveWorkedSignalValue,
  WORKED_ACTIVITY_STATE_HIGH,
  WORKED_ACTIVITY_STATE_NONE,
  WORKED_ACTIVITY_STATE_RECORDED,
} from "./workedExecutionModel.js";

test("worked execution model: focus normalization is bounded", () => {
  assert.equal(normalizeWorkedScopeFocusType("organizer"), "organizer");
  assert.equal(normalizeWorkedScopeFocusType("office"), "office");
  assert.equal(normalizeWorkedScopeFocusType("other"), "campaign");
});

test("worked execution model: signal value respects organizer vs office focus", () => {
  const row = { officeTouches: 5, organizerTouches: 2 };
  assert.equal(resolveWorkedSignalValue(row, "office"), 5);
  assert.equal(resolveWorkedSignalValue(row, "organizer"), 2);
  assert.equal(resolveWorkedSignalValue(row, "campaign"), 5);
});

test("worked execution model: state derivation yields no/recorded/higher activity states from event truth", () => {
  const derived = deriveWorkedActivityStateRows([
    { geoid: "1", officeTouches: 0, organizerTouches: 0 },
    { geoid: "2", officeTouches: 1, organizerTouches: 0 },
    { geoid: "3", officeTouches: 3, organizerTouches: 0 },
    { geoid: "4", officeTouches: 8, organizerTouches: 0 },
    { geoid: "5", officeTouches: 12, organizerTouches: 0 },
  ], {
    focusType: "office",
    highQuantile: 0.8,
    minPositiveRowsForHigh: 3,
  });
  const byGeoid = new Map(derived.rows.map((row) => [row.geoid, row]));
  assert.equal(byGeoid.get("1")?.state, WORKED_ACTIVITY_STATE_NONE);
  assert.equal(byGeoid.get("2")?.state, WORKED_ACTIVITY_STATE_RECORDED);
  assert.equal(byGeoid.get("4")?.state, WORKED_ACTIVITY_STATE_HIGH);
  assert.equal(derived.stateCounts[WORKED_ACTIVITY_STATE_NONE], 1);
  assert.ok(derived.stateCounts[WORKED_ACTIVITY_STATE_HIGH] >= 1);
});

test("worked execution model: organizer focus uses organizer touches for state derivation", () => {
  const derived = deriveWorkedActivityStateRows([
    { geoid: "a", officeTouches: 10, organizerTouches: 0 },
    { geoid: "b", officeTouches: 10, organizerTouches: 4 },
  ], {
    focusType: "organizer",
  });
  const byGeoid = new Map(derived.rows.map((row) => [row.geoid, row]));
  assert.equal(byGeoid.get("a")?.state, WORKED_ACTIVITY_STATE_NONE);
  assert.equal(byGeoid.get("b")?.state, WORKED_ACTIVITY_STATE_RECORDED);
});

test("worked execution model: summary model is truthful for no-evidence scopes", () => {
  const summary = buildWorkedExecutionSummaryModel({
    workedScope: { focusType: "organizer", organizerLabel: "A. Organizer" },
    workedOfficeTotals: { touches: 0, attempts: 0, canvassed: 0, vbms: 0 },
    workedJoinableEventCount: 0,
    workedConsideredEventCount: 0,
    workedStateCounts: {
      no_recorded_activity: 12,
      recorded_activity: 0,
      higher_activity_concentration: 0,
    },
  });
  assert.equal(summary.selectedScopeLabel, "Organizer A. Organizer");
  assert.equal(summary.hasEvidence, false);
  assert.equal(summary.noRecordedActivityCount, 12);
});

test("worked execution model: summary model keeps turfEvents-backed counts for manager readout", () => {
  const summary = buildWorkedExecutionSummaryModel({
    workedScope: { focusType: "office", officeId: "west-office" },
    workedOfficeTotals: { touches: 30, attempts: 81, canvassed: 40, vbms: 6 },
    workedJoinableEventCount: 14,
    workedConsideredEventCount: 22,
    workedStateCounts: {
      no_recorded_activity: 4,
      recorded_activity: 7,
      higher_activity_concentration: 3,
    },
  });
  assert.equal(summary.selectedScopeLabel, "Office west-office");
  assert.equal(summary.hasEvidence, true);
  assert.equal(summary.joinedUnitCount, 14);
  assert.equal(summary.touches, 30);
  assert.equal(summary.attempts, 81);
  assert.equal(summary.canvassed, 40);
  assert.equal(summary.vbms, 6);
  assert.equal(summary.recordedActivityCount, 7);
  assert.equal(summary.higherActivityCount, 3);
});

