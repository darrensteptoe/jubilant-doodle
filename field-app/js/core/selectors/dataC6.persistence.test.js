// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeCanonicalState } from "../state/schema.js";
import { saveForecastArchiveActual, selectForecastArchiveEntry } from "../actions/forecastArchive.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRuntimeSource = fs.readFileSync(path.resolve(__dirname, "../../appRuntime.js"), "utf8");

test("data c6: recovery strict-import flag persists after reopen snapshot", () => {
  const state = makeCanonicalState({ nowDate: new Date("2026-03-21T21:00:00.000Z") });
  state.domains.recovery.strictImport = true;
  state.domains.recovery.usbConnected = true;

  const reopened = JSON.parse(JSON.stringify(state));
  assert.equal(reopened.domains.recovery.strictImport, true);
  assert.equal(reopened.domains.recovery.usbConnected, true);
});

test("data c6: forecast archive selection and entry persist after reopen snapshot", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T21:05:00.000Z") });

  state = saveForecastArchiveActual(state, {
    entry: {
      hash: "c6-hash-1",
      recordedAt: "2026-11-03T00:00:00.000Z",
      actualMargin: 1.2,
      notes: "c6-note",
    },
  }).state;

  state = selectForecastArchiveEntry(state, { hash: "c6-hash-1" }).state;

  const reopened = JSON.parse(JSON.stringify(state));
  assert.equal(reopened.domains.forecastArchive.selectedHash, "c6-hash-1");
  assert.equal(reopened.domains.forecastArchive.entries.length, 1);
  assert.equal(reopened.domains.forecastArchive.entries[0].hash, "c6-hash-1");
  assert.equal(reopened.domains.forecastArchive.entries[0].notes, "c6-note");
});

test("data c6: runtime bridge keeps voter-import draft and reporting type on state-backed paths", () => {
  assert.match(appRuntimeSource, /function dataBridgeSetVoterImportDraft\(/);
  assert.match(appRuntimeSource, /voterImportDraft:\s*\{/);
  assert.match(appRuntimeSource, /setVoterImportDraft:\s*\(payload\)\s*=>\s*dataBridgeSetVoterImportDraft\(payload\)/);
  assert.match(appRuntimeSource, /setReportType:\s*\(reportType\)\s*=>\s*dataBridgeSetReportType\(reportType\)/);
});
