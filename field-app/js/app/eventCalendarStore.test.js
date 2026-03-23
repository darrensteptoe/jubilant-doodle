// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import { makeDefaultEventCalendarState } from "./eventCalendarState.js";
import { saveEventDraftAsEvent, setEventDraftField } from "./eventCalendarStore.js";

function makeState({ campaignId = "default", officeId = "", scenarioId = "baseline" } = {}) {
  return {
    campaignId,
    officeId,
    ui: { activeScenarioId: scenarioId },
    warRoom: {
      eventCalendar: makeDefaultEventCalendarState({ nowDate: new Date("2026-03-22T00:00:00.000Z") }),
    },
  };
}

test("eventCalendarStore: save allows campaign-scoped events when office scope is empty", () => {
  const state = makeState({ campaignId: "il-hd-21", officeId: "" });
  const titleSet = setEventDraftField(state, "title", "Volunteer launch");
  assert.equal(titleSet.ok, true);

  const result = saveEventDraftAsEvent(state, {
    uidFn: () => "abc123",
    nowDate: new Date("2026-03-22T12:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, "ok");
  assert.equal(state.warRoom.eventCalendar.events.length, 1);
  assert.equal(state.warRoom.eventCalendar.events[0].campaignId, "il-hd-21");
  assert.equal(state.warRoom.eventCalendar.events[0].officeId, "");
});

test("eventCalendarStore: save fails with explicit context error when campaign scope is missing", () => {
  const state = makeState({ campaignId: "", officeId: "west" });
  const titleSet = setEventDraftField(state, "title", "Canvass kickoff");
  assert.equal(titleSet.ok, true);

  const result = saveEventDraftAsEvent(state, {
    uidFn: () => "def456",
    nowDate: new Date("2026-03-22T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "missing_context");
  assert.match(String(result.message || ""), /campaignId context/i);
  assert.equal(state.warRoom.eventCalendar.events.length, 0);
});
