// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readSource() {
  return fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
}

test("map phase1 contract: active office context resolves from shell with operations fallback", () => {
  const source = readSource();
  assert.match(source, /function readOperationsScopeFallback\(/, "operations fallback helper should exist");
  assert.match(source, /resolveOperationsContext\(\{ fallback: shellScope \}\)/, "operations context resolver should be used as shell fallback");
  assert.match(source, /campaignSource: shellScope\.campaignId \? "shell" : \(opsScope\.campaignId \? "operations_context" : ""\)/, "campaign source provenance should be explicit");
  assert.match(source, /officeSource: shellScope\.officeId \? "shell" : \(opsScope\.officeId \? "operations_context" : ""\)/, "office source provenance should be explicit");
});

test("map phase1 contract: office context handoff is wired into map runtime scope gating", () => {
  const source = readSource();
  assert.match(source, /runtime\.shellScope = shellScope;/, "map runtime should store resolved shell/operations scope");
  assert.match(source, /const hasContext = !!cleanText\(shellScope\.campaignId\)\s*&& !!cleanText\(shellScope\.officeId\)/m, "map context gate should require campaign and office scope");
});

test("map phase1 contract: area inspect renders office context and office association with truthful fallback", () => {
  const source = readSource();
  assert.match(source, /<span>Office context<\/span>/, "inspect panel should render office context");
  assert.match(source, /<span>Office association<\/span>/, "inspect panel should render office association");
  assert.match(source, /No office-specific geography tag in canonical rows/, "inspect fallback should be explicit when office tags are absent");
});

test("map phase1 contract: office missing-geometry fallback and focus state are explicit", () => {
  const source = readSource();
  assert.match(source, /Office footprint mode: no mapped areas match office \$\{officeId\} in current canonical rows; showing campaign footprint as fallback\./, "office-mode fallback status should be explicit");
  assert.match(source, /function emptyOfficeFocusState\(/, "office focus state helper should exist");
  assert.match(source, /fallbackToCampaign: false/, "office focus state should track fallback flag");
  assert.match(source, /officeTagsAvailable: false/, "office focus state should track office-tag availability");
  assert.match(source, /runtime\.officeFocusState = emptyOfficeFocusState\(\);/, "office focus state should reset on empty map collections");
});

test("map phase1 contract: office refit keys include office scope to prevent stale focus", () => {
  const source = readSource();
  assert.match(source, /const fitScopeKey = contextMode === CONTEXT_MODE_OFFICE\s*\? `\$\{boundaryKey\}\|office:\$\{cleanText\(shellScope\.officeId\)\}`\s*: `\$\{boundaryKey\}\|\$\{contextMode\}`;/m, "fit key should include active office id for office mode");
  assert.match(source, /if \(runtime\.fittedBoundaryKey !== fitScopeKey\)/, "refit check should use scope-aware fit key");
  assert.match(source, /fitOfficeScopeFeatures\(runtime\);/, "office mode should refit to office-scoped features");
});
