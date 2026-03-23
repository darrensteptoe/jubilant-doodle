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
const kpiBridgeSource = fs.readFileSync(path.resolve(__dirname, "../kpiBridge.js"), "utf8");
const outcomeSurfaceSource = fs.readFileSync(path.resolve(__dirname, "../surfaces/outcome/index.js"), "utf8");

test("h7 wrapper retirement: outcome aggregate reader is removed", () => {
  assert.doesNotMatch(outcomeBridgeSource, /readOutcomeBridgeView\(/, "outcome aggregate compatibility reader should be deleted");
  assert.doesNotMatch(outcomeBridgeSource, /api\.getView\(/, "outcome canonical/derived readers should not fallback to getView");
});

test("h7 wrapper retirement: district aggregate reader is removed", () => {
  assert.doesNotMatch(districtBridgeSource, /readDistrictBridgeView\(/, "district aggregate compatibility reader should be deleted");
  assert.doesNotMatch(districtBridgeSource, /api\.getView\(/, "district canonical/derived readers should not fallback to getView");
});

test("h7 wrapper retirement: callsites no longer reference outcome aggregate reader", () => {
  assert.doesNotMatch(kpiBridgeSource, /readOutcomeBridgeView\(/, "kpi bridge should not reference aggregate outcome reader");
  assert.doesNotMatch(outcomeSurfaceSource, /readOutcomeBridgeView\(/, "outcome surface should not reference aggregate outcome reader");
});
