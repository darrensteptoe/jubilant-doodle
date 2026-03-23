// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

function extractFunctionBody(name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = source.match(pattern);
  assert.ok(match, `${name} must exist`);
  return String(match[1] || "");
}

test("c4 contract: outcome input/select binders are one-time and hold-free", () => {
  const inputBody = extractFunctionBody("bindOutcomeInputField");
  const selectBody = extractFunctionBody("bindOutcomeSelectField");

  assert.match(inputBody, /if \(input\.dataset\.v3OutcomeBound === "1"\)/);
  assert.match(inputBody, /input\.dataset\.v3OutcomeBound = "1";/);
  assert.match(selectBody, /if \(select\.dataset\.v3OutcomeBound === "1"\)/);
  assert.match(selectBody, /select\.dataset\.v3OutcomeBound = "1";/);

  assert.doesNotMatch(inputBody, /pending|hold|stale-sync|shouldHold/i);
  assert.doesNotMatch(selectBody, /pending|hold|stale-sync|shouldHold/i);
});

test("c4 contract: outcome ordinary edits sync existing controls in place", () => {
  const inputSyncBody = extractFunctionBody("syncOutcomeInputValue");
  const selectSyncBody = extractFunctionBody("syncOutcomeSelectOptions");
  const replaceOptionsBody = extractFunctionBody("replaceOutcomeSelectOptionsInPlace");

  assert.match(inputSyncBody, /if \(document\.activeElement === input\) \{\s*return;\s*\}/);

  assert.match(selectSyncBody, /replaceOutcomeSelectOptionsInPlace\(/);
  assert.doesNotMatch(selectSyncBody, /innerHTML\s*=/);
  assert.doesNotMatch(replaceOptionsBody, /innerHTML\s*=/);
  assert.match(replaceOptionsBody, /while \(select\.options\.length > rows\.length\)/);
});

test("c4 contract: outcome trace harness records DOM identity for select and numeric controls", () => {
  assert.match(source, /const OUTCOME_V3_TRACE_PREFIX = "\[outcome_v3_dom_trace\]"/);
  assert.match(source, /"v3OutcomeMcMode"/);
  assert.match(source, /"v3OutcomeOrgCount"/);
  assert.match(source, /eventType: "trace\.auto\.c4\.post"/);
  assert.match(source, /replacedSinceReference:/);
  assert.match(source, /installOutcomeV3DomLifecycleTrace\(\);/);
});
