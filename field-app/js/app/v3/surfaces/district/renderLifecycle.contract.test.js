// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const districtV2Path = path.join(__dirname, "../districtV2/index.js");
const source = fs.readFileSync(districtV2Path, "utf8");

function extractFunctionBody(name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = source.match(pattern);
  assert.ok(match, `${name} must exist`);
  return String(match[1] || "");
}

test("render lifecycle: district editable row modules gate structural rerender by row signature", () => {
  assert.match(
    source,
    /function syncDistrictV2CandidateTable[\s\S]*structureSignature[\s\S]*previousSignature[\s\S]*if \(previousSignature !== structureSignature\)/,
    "candidate table must gate structural rerender behind a row signature check",
  );
  assert.match(
    source,
    /function syncDistrictV2UserSplitTable[\s\S]*structureSignature[\s\S]*previousSignature[\s\S]*if \(previousSignature !== structureSignature\)/,
    "user split table must gate structural rerender behind a row signature check",
  );
  assert.match(
    source,
    /function syncDistrictV2CandidateHistory[\s\S]*structureSignature[\s\S]*previousSignature[\s\S]*if \(previousSignature !== structureSignature\)/,
    "candidate history table must gate structural rerender behind a row signature check",
  );
});

test("render lifecycle: editable controls sync in place from canonical snapshots", () => {
  const selectBody = extractFunctionBody("syncSelectControlInPlace");
  const inputBody = extractFunctionBody("syncInputControlInPlace");
  const checkboxBody = extractFunctionBody("syncCheckboxControlInPlace");

  assert.match(selectBody, /replaceSelectOptionsInPlace\(/, "select sync must use in-place option replacement helper");
  assert.doesNotMatch(selectBody, /innerHTML\s*=/, "select sync must not rebuild via innerHTML");

  assert.match(inputBody, /document\.activeElement === control/, "input sync must preserve active control identity");
  assert.match(checkboxBody, /document\.activeElement === control/, "checkbox sync must preserve active control identity");
  assert.doesNotMatch(inputBody, /innerHTML\s*=/, "input sync must not rebuild markup");
  assert.doesNotMatch(checkboxBody, /innerHTML\s*=/, "checkbox sync must not rebuild markup");
});

test("render lifecycle: rebuilt district editable sections avoid direct innerHTML writes", () => {
  const lines = source.split(/\r?\n/);
  const directInnerHtml = [];
  lines.forEach((line, index) => {
    if (!/\.innerHTML\s*=/.test(line)) {
      return;
    }
    const trimmed = line.trim();
    const allowed = [
      "runtimeDebug.innerHTML = `",
      "mount.innerHTML = \"\";",
      "node.innerHTML = html;",
    ];
    if (allowed.some((candidate) => trimmed.includes(candidate))) {
      return;
    }
    directInnerHtml.push(`${index + 1}:${trimmed}`);
  });

  assert.deepEqual(
    directInnerHtml,
    [],
    `districtV2 index must not use direct innerHTML writes in editable lifecycle paths: ${directInnerHtml.join(", ")}`,
  );
});

test("c1 contract: race context and electorate ordinary sync paths do not structurally rerender", () => {
  const raceContextSectionMatch = source.match(
    /function syncDistrictV2RaceContext[\s\S]*?function syncDistrictV2Electorate/,
  );
  assert.ok(raceContextSectionMatch, "race context sync section must exist");
  const raceContextSection = String(raceContextSectionMatch[0] || "");
  assert.doesNotMatch(
    raceContextSection,
    /setInnerHtmlWithTrace\(/,
    "race context ordinary sync must not structurally rerender editable controls",
  );

  const electorateSectionMatch = source.match(
    /function syncDistrictV2Electorate[\s\S]*?function syncDistrictV2Ballot/,
  );
  assert.ok(electorateSectionMatch, "electorate sync section must exist");
  const electorateSection = String(electorateSectionMatch[0] || "");
  assert.doesNotMatch(
    electorateSection,
    /setInnerHtmlWithTrace\(/,
    "electorate ordinary sync must not structurally rerender editable controls",
  );
});

test("c1 contract: race and electorate controls bind once and include identity trace hooks", () => {
  assert.match(
    source,
    /if \(\s*!\(control instanceof HTMLSelectElement\) \|\| control\.dataset\.v3DistrictV2Bound === "1"\s*\)\s*\{\s*return;\s*\}/,
    "select binders must guard against duplicate binding",
  );
  assert.match(
    source,
    /control\.dataset\.v3DistrictV2Bound = "1";/,
    "form binders must mark controls as bound",
  );
  assert.match(
    source,
    /logDistrictV2ControlTrace\("blur\.after\.microtask"/,
    "trace harness must record blur microtask identity checks",
  );
  assert.match(
    source,
    /logDistrictV2ControlTrace\("blur\.after\.raf"/,
    "trace harness must record blur raf identity checks",
  );
  assert.match(
    source,
    /replacedSinceReference:/,
    "trace payload must include node identity replacement flag",
  );
});

test("c2 contract: ballot ordinary edits use in-place sync paths after structure gate", () => {
  const candidateTableBody = extractFunctionBody("syncDistrictV2CandidateTable");
  const userSplitBody = extractFunctionBody("syncDistrictV2UserSplitTable");

  assert.match(
    candidateTableBody,
    /if \(previousSignature !== structureSignature\)[\s\S]*setInnerHtmlWithTrace\(/,
    "candidate table must allow structural rerender only behind signature change",
  );
  const candidateInPlacePath = String(candidateTableBody.split("const rowMap = new Map();")[1] || "");
  assert.ok(candidateInPlacePath, "candidate table in-place path must exist");
  assert.match(candidateInPlacePath, /syncInputControlInPlace\(/, "candidate table in-place path must sync existing inputs");
  assert.doesNotMatch(
    candidateInPlacePath,
    /setInnerHtmlWithTrace\(/,
    "candidate table ordinary edit path must not structurally rerender rows",
  );

  assert.match(
    userSplitBody,
    /if \(previousSignature !== structureSignature\)[\s\S]*setInnerHtmlWithTrace\(/,
    "user-split table must allow structural rerender only behind signature change",
  );
  const userSplitInPlacePath = String(userSplitBody.split("const rowMap = new Map();")[1] || "");
  assert.ok(userSplitInPlacePath, "user-split in-place path must exist");
  assert.match(userSplitInPlacePath, /syncInputControlInPlace\(/, "user-split in-place path must sync existing inputs");
  assert.doesNotMatch(
    userSplitInPlacePath,
    /setInnerHtmlWithTrace\(/,
    "user-split ordinary edit path must not structurally rerender rows",
  );
});

test("c2 contract: candidate history ordinary edits use in-place sync path after structure gate", () => {
  const historyBody = extractFunctionBody("syncDistrictV2CandidateHistory");
  assert.match(
    historyBody,
    /if \(previousSignature !== structureSignature\)[\s\S]*setInnerHtmlWithTrace\(/,
    "candidate-history table must allow structural rerender only behind signature change",
  );
  const historyInPlacePath = String(historyBody.split("const rowMap = new Map();")[1] || "");
  assert.ok(historyInPlacePath, "candidate-history in-place path must exist");
  assert.match(historyInPlacePath, /syncInputControlInPlace\(/, "candidate-history in-place path must sync existing inputs");
  assert.match(historyInPlacePath, /syncSelectControlInPlace\(/, "candidate-history in-place path must sync existing selects");
  assert.match(historyInPlacePath, /syncCheckboxControlInPlace\(/, "candidate-history in-place path must sync existing checkboxes");
  assert.doesNotMatch(
    historyInPlacePath,
    /setInnerHtmlWithTrace\(/,
    "candidate-history ordinary edit path must not structurally rerender rows",
  );
});

test("c3 contract: targeting and census ordinary editable sync paths avoid structural rerender", () => {
  const targetingBody = extractFunctionBody("syncDistrictV2Targeting");
  const censusBody = extractFunctionBody("syncDistrictV2Census");

  assert.match(targetingBody, /syncSelectOptions\(/, "targeting sync must use in-place select sync helpers");
  assert.match(targetingBody, /syncInputValueFromRaw\(/, "targeting sync must use in-place input sync helpers");
  assert.doesNotMatch(
    targetingBody,
    /setInnerHtmlWithTrace\(/,
    "targeting ordinary edit controls must not structurally rerender module body",
  );

  assert.match(censusBody, /syncSelectOptions\(/, "census sync must use in-place select sync helpers");
  assert.match(censusBody, /syncInputValueFromRaw\(/, "census sync must use in-place input sync helpers");
  assert.match(censusBody, /syncMultiSelectOptions\(/, "census sync must use in-place multi-select sync helper");
  assert.doesNotMatch(
    censusBody,
    /setInnerHtmlWithTrace\(/,
    "census ordinary edit controls must not structurally rerender module body",
  );
});

test("c3 contract: targeting and census binders are one-time and hold-free", () => {
  const targetingSelectBody = extractFunctionBody("bindDistrictV2TargetingSelect");
  const targetingFieldBody = extractFunctionBody("bindDistrictV2TargetingField");
  const censusFieldBody = extractFunctionBody("bindDistrictV2CensusField");

  assert.match(targetingSelectBody, /control\.dataset\.v3DistrictV2Bound === "1"/);
  assert.match(targetingSelectBody, /control\.dataset\.v3DistrictV2Bound = "1";/);
  assert.match(targetingFieldBody, /control\.dataset\.v3DistrictV2Bound === "1"/);
  assert.match(targetingFieldBody, /control\.dataset\.v3DistrictV2Bound = "1";/);
  assert.match(censusFieldBody, /control\.dataset\.v3DistrictV2Bound === "1"/);
  assert.match(censusFieldBody, /control\.dataset\.v3DistrictV2Bound = "1";/);

  assert.doesNotMatch(targetingSelectBody, /markDistrictPendingWrite|shouldHoldDistrictControlSync/);
  assert.doesNotMatch(targetingFieldBody, /markDistrictPendingWrite|shouldHoldDistrictControlSync/);
  assert.doesNotMatch(censusFieldBody, /markDistrictPendingWrite|shouldHoldDistrictControlSync/);
});
