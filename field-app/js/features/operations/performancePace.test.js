// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { computeOperationsPerformancePaceView } from "./performancePace.js";

const FIXED_NOW_MS = Date.parse("2026-03-26T12:00:00Z");

test("operations performance pace: computes office goal progress and weekly pace from canonical state", () => {
  const view = computeOperationsPerformancePaceView({
    stateSnapshot: {
      goalSupportIds: 100,
      weeksRemaining: 4,
    },
    persons: [
      { id: "org_a", name: "Organizer A", active: true, workforceRole: "organizer" },
      { id: "org_b", name: "Organizer B", active: true, workforceRole: "organizer" },
      { id: "vol_1", name: "Vol 1", active: true, workforceRole: "volunteer", supervisorId: "org_a" },
      { id: "vol_2", name: "Vol 2", active: true, workforceRole: "volunteer", supervisorId: "org_a" },
      { id: "vol_3", name: "Vol 3", active: true, workforceRole: "volunteer", supervisorId: "org_b" },
    ],
    shiftRecords: [
      { date: "2026-03-03", personId: "org_a", supportIds: 30 },
      { date: "2026-03-17", personId: "org_b", supportIds: 20 },
      { date: "2026-03-24", personId: "org_a", supportIds: 10 },
    ],
    turfEvents: [
      { date: "2026-03-24", assignedTo: "org_a", vbms: 7 },
      { date: "2026-03-25", assignedTo: "org_b", vbms: 3 },
    ],
    nowMs: FIXED_NOW_MS,
  });

  assert.equal(view.goalSource, "goalSupportIds");
  assert.equal(view.office.goal, 100);
  assert.equal(view.office.completedToDate, 60);
  assert.equal(view.office.remainingToGoal, 40);
  assert.equal(view.office.weekly.thisWeek, 10);
  assert.equal(view.office.weekly.priorWeek, 20);
  assert.equal(view.office.requiredWeeklyPace, 10);
  assert.equal(view.office.activeVolunteers, 3);
  assert.equal(view.office.vbmsCollected, 10);
  assert.equal(view.office.paceStatus, "Ahead");

  const byId = new Map(view.organizers.map((row) => [String(row.organizerId), row]));
  assert.equal(view.organizers.length, 2);
  assert.equal(byId.get("org_a")?.activeVolunteers, 2);
  assert.equal(byId.get("org_a")?.vbmsCollected, 7);
  assert.equal(byId.get("org_b")?.activeVolunteers, 1);
  assert.equal(byId.get("org_b")?.vbmsCollected, 3);
});

test("operations performance pace: emits deterministic coaching insights for fragile pace and concentration", () => {
  const view = computeOperationsPerformancePaceView({
    stateSnapshot: {
      goalSupportIds: 200,
      weeksRemaining: 2,
    },
    persons: [
      { id: "org_a", name: "Organizer A", active: true, workforceRole: "organizer" },
      { id: "org_b", name: "Organizer B", active: true, workforceRole: "organizer" },
      { id: "org_c", name: "Organizer C", active: true, workforceRole: "organizer" },
    ],
    shiftRecords: [
      { date: "2026-03-10", personId: "org_a", supportIds: 15 },
      { date: "2026-03-11", personId: "org_b", supportIds: 10 },
      { date: "2026-03-18", personId: "org_a", supportIds: 5 },
      { date: "2026-03-19", personId: "org_b", supportIds: 10 },
      { date: "2026-03-24", personId: "org_a", supportIds: 18 },
    ],
    nowMs: FIXED_NOW_MS,
  });

  assert.equal(view.office.paceStatus, "Behind");
  assert.equal(view.office.weekly.direction, "up");
  assert.ok(view.insights.includes("Behind required pace despite improving week-over-week output."));
  assert.ok(view.insights.includes("Volunteer activation is weak; office output depends on paid/organizer lanes."));
  assert.ok(view.insights.includes("Output is concentrated in a small organizer subset; bench depth risk is elevated."));
});

test("operations performance pace: degrades safely when canonical goal is unavailable", () => {
  const view = computeOperationsPerformancePaceView({
    stateSnapshot: {
      goalSupportIds: "",
      weeksRemaining: "",
    },
    persons: [
      { id: "org_a", name: "Organizer A", active: true, workforceRole: "organizer" },
    ],
    shiftRecords: [
      { date: "2026-03-24", personId: "org_a", supportIds: 5 },
    ],
    nowMs: FIXED_NOW_MS,
  });

  assert.equal(view.goalSource, "");
  assert.equal(view.office.goal, null);
  assert.equal(view.office.paceStatus, "Goal Missing");
  assert.equal(view.office.requiredWeeklyPace, null);
  assert.ok(view.insights.some((line) => /goal is missing/i.test(String(line))));
});

test("operations performance pace: read-only computation does not mutate inputs", () => {
  const input = {
    stateSnapshot: { goalSupportIds: 50, weeksRemaining: 5 },
    persons: [{ id: "org_a", name: "Organizer A", active: true, workforceRole: "organizer" }],
    shiftRecords: [{ date: "2026-03-24", personId: "org_a", supportIds: 5 }],
    turfEvents: [{ date: "2026-03-24", assignedTo: "org_a", vbms: 1 }],
    nowMs: FIXED_NOW_MS,
  };
  const before = JSON.stringify(input);
  computeOperationsPerformancePaceView(input);
  const after = JSON.stringify(input);
  assert.equal(after, before);
});
