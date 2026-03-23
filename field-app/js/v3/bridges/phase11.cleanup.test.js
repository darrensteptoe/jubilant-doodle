// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outcomeBridgeSource = fs.readFileSync(path.join(__dirname, "outcomeBridge.js"), "utf8");
const districtBridgeSource = fs.readFileSync(path.join(__dirname, "districtBridge.js"), "utf8");
const weatherBridgeSource = fs.readFileSync(path.join(__dirname, "weatherRiskBridge.js"), "utf8");
const eventBridgeSource = fs.readFileSync(path.join(__dirname, "eventCalendarBridge.js"), "utf8");
const outcomeSurfaceSource = fs.readFileSync(path.resolve(__dirname, "../surfaces/outcome/index.js"), "utf8");
const kpiBridgeSource = fs.readFileSync(path.resolve(__dirname, "../kpiBridge.js"), "utf8");
const stateBridgeSource = fs.readFileSync(path.resolve(__dirname, "../stateBridge.js"), "utf8");

function expect(source, pattern, message) {
  assert.match(source, pattern, message);
}

test("phase11 bridge cleanup: outcome bridge centralizes canonical/derived reads without compatibility fallback", () => {
  expect(outcomeBridgeSource, /export function readOutcomeCanonicalBridgeView\(/, "must export canonical reader");
  expect(outcomeBridgeSource, /export function readOutcomeDerivedBridgeView\(/, "must export derived reader");
  assert.doesNotMatch(outcomeBridgeSource, /export function readOutcomeBridgeView\(/, "compatibility reader must be retired");
  expect(outcomeBridgeSource, /if \(typeof api\.getCanonicalView === "function"\)/, "canonical path must prefer getCanonicalView");
  expect(outcomeBridgeSource, /if \(typeof api\.getDerivedView === "function"\)/, "derived path must prefer getDerivedView");
  assert.doesNotMatch(outcomeBridgeSource, /getView\(/, "outcome bridge reader must not depend on aggregate getView fallback");
  expect(outcomeBridgeSource, /export function setOutcomeBridgeField\(/, "must export setField action wrapper");
  expect(outcomeBridgeSource, /export function runOutcomeBridgeMc\(/, "must export run action wrapper");
  expect(outcomeBridgeSource, /export function rerunOutcomeBridgeMc\(/, "must export rerun action wrapper");
  expect(outcomeBridgeSource, /export function computeOutcomeBridgeSurface\(/, "must export surface action wrapper");
});

test("phase11 bridge cleanup: outcome surface consumes bridge module instead of direct global API reads", () => {
  expect(outcomeSurfaceSource, /from "\.\.\/\.\.\/bridges\/outcomeBridge\.js"/, "outcome surface must import bridge module");
  assert.doesNotMatch(outcomeSurfaceSource, /__FPE_OUTCOME_API__/, "outcome surface must not hardcode global bridge key");
  assert.doesNotMatch(outcomeSurfaceSource, /window\[[^\]]*OUTCOME/, "outcome surface must not read outcome bridge directly from window");
  expect(outcomeSurfaceSource, /setOutcomeBridgeField\(/, "outcome input writes must route through outcome bridge wrapper");
  expect(outcomeSurfaceSource, /runOutcomeBridgeMc\(/, "outcome run must route through outcome bridge wrapper");
  expect(outcomeSurfaceSource, /rerunOutcomeBridgeMc\(/, "outcome rerun must route through outcome bridge wrapper");
  expect(outcomeSurfaceSource, /computeOutcomeBridgeSurface\(/, "surface compute must route through outcome bridge wrapper");
});

test("phase11 bridge cleanup: KPI strip prefers derived outcome bridge snapshot", () => {
  expect(kpiBridgeSource, /from "\.\/bridges\/outcomeBridge\.js"/, "kpi bridge must import outcome bridge module");
  expect(kpiBridgeSource, /const outcomeView = readOutcomeDerivedBridgeView\(\);/, "kpi bridge must consume derived outcome view only");
  assert.doesNotMatch(kpiBridgeSource, /readOutcomeBridgeView\(/, "kpi bridge must not reference compatibility reader");
  assert.doesNotMatch(kpiBridgeSource, /__FPE_OUTCOME_API__/, "kpi bridge must not hardcode outcome API key");
});

test("phase11 bridge cleanup: state bridge delegates district reads/writes to district bridge module", () => {
  expect(stateBridgeSource, /from "\.\/bridges\/districtBridge\.js"/, "state bridge must import district bridge module");
  expect(stateBridgeSource, /readDistrictCanonicalBridgeView\(/, "state bridge must use imported district canonical reader");
  expect(stateBridgeSource, /readDistrictDerivedBridgeView\(/, "state bridge must use imported district derived reader");
  expect(stateBridgeSource, /callDistrictBridge\(/, "state bridge district actions must use imported district bridge caller");
  assert.doesNotMatch(stateBridgeSource, /__FPE_DISTRICT_API__/, "state bridge must not hardcode district bridge key");
});

test("phase11 bridge cleanup: district bridge has no aggregate compatibility reader", () => {
  assert.doesNotMatch(districtBridgeSource, /export function readDistrictBridgeView\(/, "district compatibility reader must be retired");
  assert.doesNotMatch(districtBridgeSource, /getView\(/, "district bridge reader must not depend on aggregate getView fallback");
});

test("phase11 bridge cleanup: weather and event bridge modules exist with decision-bridge wrappers", () => {
  expect(weatherBridgeSource, /export function setWeatherRiskField\(/, "weather bridge must expose field setter");
  expect(weatherBridgeSource, /export function setWeatherRiskMode\(/, "weather bridge must expose mode setter");
  expect(weatherBridgeSource, /export function refreshWeatherRisk\(/, "weather bridge must expose refresh action");

  expect(eventBridgeSource, /export function setEventCalendarFilter\(/, "event bridge must expose filter setter");
  expect(eventBridgeSource, /export function setEventCalendarDraftField\(/, "event bridge must expose draft setter");
  expect(eventBridgeSource, /export function saveEventCalendarDraft\(/, "event bridge must expose save action");
  expect(eventBridgeSource, /export function deleteEventCalendarEvent\(/, "event bridge must expose delete action");
});
