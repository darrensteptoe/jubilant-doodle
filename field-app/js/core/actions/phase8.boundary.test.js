// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { makeCanonicalState } from "../state/schema.js";
import { saveEventCalendarEvent, updateEventCalendarFilters } from "./eventCalendar.js";
import { updateWeatherRiskConfig } from "./weatherRisk.js";

function seededState() {
  return makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
}

test("phase8 boundary: weather updates do not mutate event calendar state", () => {
  const base = seededState();
  const beforeEvent = structuredClone(base.domains.eventCalendar);

  const updated = updateWeatherRiskConfig(base, {
    field: "overrideZip",
    value: "60614",
  });

  assert.equal(updated.changed, true);
  assert.equal(updated.state.domains.weatherRisk.overrideZip, "60614");
  assert.deepEqual(updated.state.domains.eventCalendar, beforeEvent);
});

test("phase8 boundary: event updates do not mutate weather state", () => {
  const base = seededState();
  const beforeWeather = structuredClone(base.domains.weatherRisk);

  const updated = saveEventCalendarEvent(base, {
    event: {
      title: "Weekend Canvass",
      category: "campaign",
      date: "2026-03-29",
      applyToModel: true,
    },
  });

  assert.equal(updated.changed, true);
  assert.equal(updated.state.domains.eventCalendar.statusSummary.totalEvents, 1);
  assert.deepEqual(updated.state.domains.weatherRisk, beforeWeather);
});

test("phase8 moveability: weather/event module action sequence preserves unrelated canonical state", () => {
  const base = seededState();

  const weather1 = updateWeatherRiskConfig(base, {
    field: "officeZip",
    value: "10001",
  });
  assert.equal(weather1.changed, true);

  const events1 = saveEventCalendarEvent(weather1.state, {
    event: {
      eventId: "event_1",
      title: "Volunteer Call Night",
      category: "campaign",
      date: "2026-03-30",
      status: "scheduled",
      applyToModel: true,
    },
  });
  assert.equal(events1.changed, true);

  const weather2 = updateWeatherRiskConfig(events1.state, {
    field: "useOverrideZip",
    value: true,
  });
  assert.equal(weather2.changed, true);

  const events2 = updateEventCalendarFilters(weather2.state, {
    filters: {
      category: "campaign",
      appliedOnly: true,
    },
  });
  assert.equal(events2.changed, true);

  assert.equal(events2.state.domains.weatherRisk.officeZip, "10001");
  assert.equal(events2.state.domains.weatherRisk.useOverrideZip, true);
  assert.equal(events2.state.domains.eventCalendar.events.length, 1);
  assert.equal(events2.state.domains.eventCalendar.events[0].eventId, "event_1");
});
