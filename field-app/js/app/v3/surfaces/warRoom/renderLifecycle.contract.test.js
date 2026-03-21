// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const warRoomSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const decisionSessionsSource = fs.readFileSync(path.join(__dirname, "decisionSessions.js"), "utf8");
const weatherRiskSource = fs.readFileSync(path.join(__dirname, "weatherRisk.js"), "utf8");
const eventCalendarSource = fs.readFileSync(path.join(__dirname, "eventCalendar.js"), "utf8");

function extractFunctionBody(name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = warRoomSource.match(pattern);
  assert.ok(match, `${name} must exist`);
  return String(match[1] || "");
}

test("c5 contract: war room editable binders are one-time and hold-free", () => {
  assert.match(warRoomSource, /root\.dataset\.wired = "1";/);
  assert.match(eventCalendarSource, /eventBody\.dataset\.v3EventBound = "1";/);

  const combined = `${warRoomSource}\n${decisionSessionsSource}\n${weatherRiskSource}\n${eventCalendarSource}`;
  assert.doesNotMatch(combined, /markDistrictPendingWrite\(/);
  assert.doesNotMatch(combined, /shouldHoldDistrictControlSync\(/);
  assert.doesNotMatch(combined, /districtPendingWrites/);
  assert.doesNotMatch(combined, /pending-write|stale-sync|pendingWrite/i);
});

test("c5 contract: war room select sync updates options in place", () => {
  const syncSelectBody = extractFunctionBody("syncSelect");
  const replaceSelectBody = extractFunctionBody("replaceWarRoomSelectOptionsInPlace");

  assert.match(syncSelectBody, /replaceWarRoomSelectOptionsInPlace\(/);
  assert.doesNotMatch(syncSelectBody, /innerHTML\s*=/);
  assert.doesNotMatch(replaceSelectBody, /innerHTML\s*=/);
  assert.match(replaceSelectBody, /while \(select\.options\.length > list\.length\)/);
});

test("c5 contract: war room trace harness covers decision weather and event controls", () => {
  assert.match(warRoomSource, /const WAR_ROOM_V3_TRACE_PREFIX = "\[war_room_v3_dom_trace\]"/);
  assert.match(warRoomSource, /"v3DecisionBudget"/);
  assert.match(warRoomSource, /"v3DecisionWeatherOfficeZip"/);
  assert.match(warRoomSource, /"v3DecisionEventTitle"/);
  assert.match(warRoomSource, /eventType: "trace\.auto\.c5\.post"/);
  assert.match(warRoomSource, /eventType: "trace\.auto\.c5\.diagnostics\.post"/);
  assert.match(warRoomSource, /siblingReplacementMap/);
});

test("c5 contract: weather and event module binders keep boundaries", () => {
  assert.match(weatherRiskSource, /api\.setWeatherField\?\./);
  assert.match(weatherRiskSource, /api\.setWeatherMode\?\./);
  assert.doesNotMatch(weatherRiskSource, /api\.setEvent(Filter|DraftField|ApplyToModel|Status)\?\./);

  assert.match(eventCalendarSource, /api\.setEventFilter\?\./);
  assert.match(eventCalendarSource, /api\.setEventDraftField\?\./);
  assert.doesNotMatch(eventCalendarSource, /api\.setWeather(Field|Mode)\?\./);
});
