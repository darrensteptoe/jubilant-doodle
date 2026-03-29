// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const weatherSource = fs.readFileSync(path.join(__dirname, "weatherRisk.js"), "utf8");
const eventSource = fs.readFileSync(path.join(__dirname, "eventCalendar.js"), "utf8");

function expect(pattern, message) {
  assert.match(indexSource, pattern, message);
}

test("war room phase8: surface is decomposed into module files", () => {
  expect(/from "\.\/decisionSessions\.js"/, "war room index must import decision sessions module");
  expect(/from "\.\/diagnostics\.js"/, "war room index must import diagnostics module");
  expect(/from "\.\/weatherRisk\.js"/, "war room index must import weather risk module");
  expect(/from "\.\/eventCalendar\.js"/, "war room index must import event calendar module");
  expect(/from "\.\/actionLog\.js"/, "war room index must import action log module");
});

test("war room phase8: module sync and event binding are orchestrated from index", () => {
  expect(/syncWarRoomDecisionSessions\(/, "index must orchestrate decision session sync");
  expect(/syncWarRoomDiagnostics\(/, "index must orchestrate diagnostics sync");
  expect(/syncWarRoomWeatherRisk\(/, "index must orchestrate weather module sync");
  expect(/syncWarRoomEventCalendar\(/, "index must orchestrate event calendar module sync");
  expect(/syncWarRoomActionLog\(/, "index must orchestrate action log sync");
  expect(/bindWarRoomDecisionSessionEvents\(/, "index must bind decision session events through module");
  expect(/bindWarRoomDiagnosticsEvents\(/, "index must bind diagnostics events through module");
  expect(/bindWarRoomWeatherRiskEvents\(/, "index must bind weather events through module");
  expect(/bindWarRoomEventCalendarEvents\(/, "index must bind event calendar events through module");
  expect(/bindWarRoomActionLogEvents\(/, "index must bind action log events through module");
});

test("war room phase8: weather and event modules keep field ownership boundaries", () => {
  assert.doesNotMatch(weatherSource, /v3DecisionEvent/, "weather module must not own event-calendar fields");
  assert.doesNotMatch(eventSource, /v3DecisionWeather/, "event module must not own weather fields");
});

test("war room phase8: full-width center-shell layout contract is enforced", () => {
  expect(/createCenterStackFrame\(/, "war room surface must use center stack frame");
  expect(/createCenterStackColumn\(/, "war room surface must use center stack column");
  expect(/createCenterModuleCard\(/, "war room surface must use center module cards");
  assert.doesNotMatch(indexSource, /createSurfaceFrame\("two-col"\)/, "war room surface must not use two-col frame");
  assert.doesNotMatch(indexSource, /createSurfaceFrame\("three-col"\)/, "war room surface must not use three-col frame");
});
