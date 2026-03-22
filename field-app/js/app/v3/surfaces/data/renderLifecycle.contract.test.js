// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const importSource = fs.readFileSync(path.join(__dirname, "importExport.js"), "utf8");
const recoverySource = fs.readFileSync(path.join(__dirname, "recovery.js"), "utf8");
const forecastSource = fs.readFileSync(path.join(__dirname, "forecastArchive.js"), "utf8");
const reportingSource = fs.readFileSync(path.join(__dirname, "reporting.js"), "utf8");

function extractFunctionBody(source, name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = source.match(pattern);
  assert.ok(match, `${name} must exist`);
  return String(match[1] || "");
}

test("c6 contract: data editable binders are one-time and hold-free", () => {
  assert.match(indexSource, /root\.dataset\.wired = "1";/);

  const combined = `${indexSource}\n${importSource}\n${recoverySource}\n${forecastSource}\n${reportingSource}`;
  assert.doesNotMatch(combined, /markDistrictPendingWrite\(/);
  assert.doesNotMatch(combined, /shouldHoldDistrictControlSync\(/);
  assert.doesNotMatch(combined, /districtPendingWrites/);
  assert.doesNotMatch(combined, /pending-write|stale-sync|pendingWrite/i);
});

test("c6 contract: data ordinary select sync updates options in place", () => {
  const syncBackupBody = extractFunctionBody(indexSource, "syncBackupSelect");
  const syncVoterAdapterBody = extractFunctionBody(indexSource, "syncVoterAdapterSelect");
  const replaceSelectBody = extractFunctionBody(indexSource, "replaceDataSelectOptionsInPlace");

  const syncArchiveBody = extractFunctionBody(forecastSource, "syncArchiveSelect");
  const replaceArchiveBody = extractFunctionBody(forecastSource, "replaceArchiveSelectOptionsInPlace");

  const syncReportBody = extractFunctionBody(reportingSource, "syncReportTypeSelect");
  const replaceReportBody = extractFunctionBody(reportingSource, "replaceReportTypeOptionsInPlace");

  assert.match(syncBackupBody, /replaceDataSelectOptionsInPlace\(/);
  assert.match(syncVoterAdapterBody, /replaceDataSelectOptionsInPlace\(/);
  assert.doesNotMatch(syncBackupBody, /innerHTML\s*=/);
  assert.doesNotMatch(syncVoterAdapterBody, /innerHTML\s*=/);
  assert.doesNotMatch(replaceSelectBody, /innerHTML\s*=/);

  assert.match(syncArchiveBody, /replaceArchiveSelectOptionsInPlace\(/);
  assert.doesNotMatch(syncArchiveBody, /innerHTML\s*=/);
  assert.doesNotMatch(replaceArchiveBody, /innerHTML\s*=/);

  assert.match(syncReportBody, /replaceReportTypeOptionsInPlace\(/);
  assert.doesNotMatch(syncReportBody, /innerHTML\s*=/);
  assert.doesNotMatch(replaceReportBody, /innerHTML\s*=/);
});

test("c6 contract: data trace harness covers import recovery archive reporting controls", () => {
  assert.match(indexSource, /const DATA_V3_TRACE_PREFIX = "\[data_v3_dom_trace\]";/);
  assert.match(indexSource, /"v3DataVoterSourceId"/);
  assert.match(indexSource, /"v3DataStrictToggle"/);
  assert.match(indexSource, /"v3DataArchiveSelect"/);
  assert.match(indexSource, /"v3DataReportType"/);
  assert.match(indexSource, /eventType: "trace\.auto\.c6\.post"/);
  assert.match(indexSource, /siblingReplacementMap/);
});

test("c6 contract: import/export draft writes flow through data bridge API", () => {
  assert.match(importSource, /api\.setVoterImportDraft\(/);
  assert.match(importSource, /v3DataVoterAdapter/);
  assert.match(importSource, /v3DataVoterSourceId/);
});
