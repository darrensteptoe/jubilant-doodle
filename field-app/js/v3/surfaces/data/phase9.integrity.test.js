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
const archiveSource = fs.readFileSync(path.join(__dirname, "forecastArchive.js"), "utf8");
const reportingSource = fs.readFileSync(path.join(__dirname, "reporting.js"), "utf8");
const stageMountSource = fs.readFileSync(path.resolve(__dirname, "../../stageMount.js"), "utf8");

function expect(pattern, message) {
  assert.match(indexSource, pattern, message);
}

test("data phase9: surface is decomposed into module files", () => {
  expect(/from "\.\/importExport\.js"/, "data index must import import/export module");
  expect(/from "\.\/recovery\.js"/, "data index must import recovery module");
  expect(/from "\.\/forecastArchive\.js"/, "data index must import forecast archive module");
  expect(/from "\.\/learning\.js"/, "data index must import learning module");
  expect(/from "\.\/reporting\.js"/, "data index must import reporting module");
});

test("data phase9: index orchestrates module sync and event binding", () => {
  expect(/syncDataImportExportModule\(/, "index must orchestrate import/export module sync");
  expect(/syncDataRecoveryModule\(/, "index must orchestrate recovery module sync");
  expect(/syncDataForecastArchiveModule\(/, "index must orchestrate forecast archive module sync");
  expect(/syncDataLearningModule\(/, "index must orchestrate learning module sync");
  expect(/syncDataReportingModule\(/, "index must orchestrate reporting module sync");

  expect(/bindDataImportExportEvents\(/, "index must bind import/export events through module");
  expect(/bindDataRecoveryEvents\(/, "index must bind recovery events through module");
  expect(/bindDataForecastArchiveEvents\(/, "index must bind archive events through module");
  expect(/bindDataReportingEvents\(/, "index must bind reporting events through module");
});

test("data phase9: module ownership boundaries are lane-split", () => {
  assert.doesNotMatch(recoverySource, /v3DataReport/, "recovery module must not own reporting fields");
  assert.doesNotMatch(recoverySource, /v3DataArchive/, "recovery module must not own archive fields");

  assert.doesNotMatch(
    archiveSource,
    /v3DataBtnSaveJson|v3DataBtnLoadJson|v3DataBtnCopySummary|v3DataBtnExportCsv|v3DataVoterFile|v3DataVoterAdapter|v3DataVoterSourceId/,
    "archive module must not own import/export fields",
  );

  assert.doesNotMatch(importSource, /v3DataArchive/, "import/export module must not own archive fields");
  assert.doesNotMatch(importSource, /v3DataStrictToggle|v3DataRestoreBackup/, "import/export module must not own recovery fields");

  assert.doesNotMatch(reportingSource, /v3DataArchive/, "reporting module must not own archive fields");
  assert.doesNotMatch(reportingSource, /v3DataStrictToggle|v3DataRestoreBackup/, "reporting module must not own recovery fields");
});

test("data phase9: stage mount imports decomposed data surface index directly", () => {
  assert.match(
    stageMountSource,
    /from "\.\/surfaces\/data\/index\.js"/,
    "stage mount must import data surface directly from ./surfaces/data/index.js",
  );
});

test("data phase9: full-width center-shell layout contract is enforced", () => {
  expect(/createCenterStackFrame\(/, "data surface must use center stack frame");
  expect(/createCenterStackColumn\(/, "data surface must use center stack column");
  expect(/createCenterModuleCard\(/, "data surface must use center module cards");
  assert.doesNotMatch(indexSource, /createSurfaceFrame\("two-col"\)/, "data surface must not use two-col frame");
  assert.doesNotMatch(indexSource, /createSurfaceFrame\("three-col"\)/, "data surface must not use three-col frame");
});
