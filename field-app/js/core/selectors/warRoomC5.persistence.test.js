// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { makeCanonicalState } from "../state/schema.js";
import { selectWeatherRiskCanonicalView } from "./weatherRiskCanonical.js";
import { selectEventCalendarCanonicalView } from "./eventCalendarCanonical.js";
import { updateWeatherRiskAdjustment, updateWeatherRiskConfig } from "../actions/weatherRisk.js";
import { saveEventCalendarEvent, updateEventCalendarFilters } from "../actions/eventCalendar.js";

test("war room c5: weather editable controls persist after reopen snapshot", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T20:00:00.000Z") });
  state = updateWeatherRiskConfig(state, { field: "officeZip", value: "60614" }).state;
  state = updateWeatherRiskConfig(state, { field: "overrideZip", value: "60610" }).state;
  state = updateWeatherRiskAdjustment(state, { patch: { mode: "today_only", enabled: true } }).state;

  const reopened = selectWeatherRiskCanonicalView(JSON.parse(JSON.stringify(state)));
  assert.equal(reopened.officeZip, "60614");
  assert.equal(reopened.overrideZip, "60610");
  assert.equal(reopened.adjustment.mode, "today_only");
  assert.equal(reopened.adjustment.enabled, true);
});

test("war room c5: event calendar editable controls persist after reopen snapshot", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T20:05:00.000Z") });
  state = updateEventCalendarFilters(state, {
    filters: {
      category: "campaign",
      appliedOnly: true,
      includeInactive: false,
      date: "2026-11-03",
    },
  }).state;
  state = saveEventCalendarEvent(state, {
    event: {
      eventId: "event_c5",
      title: "C5 parity event",
      category: "campaign",
      eventType: "day_of_action",
      date: "2026-11-03",
      status: "scheduled",
      applyToModel: true,
    },
  }).state;

  const reopened = selectEventCalendarCanonicalView(JSON.parse(JSON.stringify(state)));
  assert.equal(reopened.filters.category, "campaign");
  assert.equal(reopened.filters.appliedOnly, true);
  assert.equal(reopened.filters.date, "2026-11-03");
  assert.equal(reopened.events.length, 1);
  assert.equal(reopened.events[0].title, "C5 parity event");
  assert.equal(reopened.events[0].applyToModel, true);
});

test("war room c5: decision-session snapshot survives navigation-style clone", () => {
  const state = makeCanonicalState({ nowDate: new Date("2026-03-21T20:10:00.000Z") });
  state.domains.scenarios.decisionSessions = {
    c5_session: {
      id: "c5_session",
      name: "C5 Session",
      constraints: {
        budget: 1234,
        volunteerHrs: 88,
      },
      notes: "C5 note",
      warRoom: {
        owner: "Ops Lead",
        followUpDate: "2026-11-04",
      },
    },
  };

  const reopened = JSON.parse(JSON.stringify(state));
  const session = reopened?.domains?.scenarios?.decisionSessions?.c5_session;
  assert.ok(session);
  assert.equal(session.constraints.budget, 1234);
  assert.equal(session.constraints.volunteerHrs, 88);
  assert.equal(session.notes, "C5 note");
  assert.equal(session.warRoom.owner, "Ops Lead");
});
