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

test("map phase8 contract: map surface includes search and quick navigation controls", () => {
  const source = readSource();
  assert.match(source, /Find geography/, "map surface should include geography search label");
  assert.match(source, /Find area/, "map surface should include search action button");
  assert.match(source, /district:, office:, turf:, organizer:, precinct:, tract:/, "search help should include prefixed jump modes");
  assert.match(source, /Refit current scope/, "map surface should include scope-refit quick action");
  assert.match(source, /Campaign view/, "map surface should include campaign view quick action");
  assert.match(source, /Office view/, "map surface should include office view quick action");
  assert.match(source, /Organizer worked view/, "map surface should include organizer worked quick-return action");
  assert.match(source, /Selected area view/, "map surface should include selected area quick action");
  assert.match(source, /Save bookmark/, "map surface should include save bookmark action");
  assert.match(source, /Jump bookmark/, "map surface should include jump bookmark action");
  assert.match(source, /Copy area summary/, "map surface should include copy summary action");
  assert.match(source, /Clear selection/, "map surface should include clear selection action");
  assert.match(source, /Mode and scope status appears after map context is ready\./, "map surface should include explicit mode/scope status line");
});

test("map phase8 contract: runtime includes bounded search and selection helpers", () => {
  const source = readSource();
  assert.match(source, /function normalizeSearchDirective\(/, "map runtime should normalize prefixed search directives");
  assert.match(source, /function findFeatureForQuery\(/, "map runtime should include search matcher");
  assert.match(source, /if \(\["district"\]\.includes\(mode\)\) return \{ mode: "district", token \};/, "search directive parser should support district prefix");
  assert.match(source, /if \(\["tract"\]\.includes\(mode\)\) return \{ mode: "tract", token \};/, "search directive parser should support tract prefix");
  assert.match(source, /const matchDistrict = \(\) =>/, "runtime should include district matcher");
  assert.match(source, /const matchTract = \(\) =>/, "runtime should include tract matcher");
  assert.match(source, /if \(directive\.mode === "tract"\) return matchTract\(\);/, "tract-prefixed queries should resolve through tract matcher");
  assert.match(source, /if \(directive\.mode === "district"\) return matchDistrict\(\);/, "district-prefixed queries should resolve through district matcher");
  assert.match(source, /function fitCurrentScopeFeatures\(/, "runtime should include scope-aware refit helper");
  assert.match(source, /function resolveOrganizerWorkedQuickScope\(/, "runtime should resolve organizer quick-return scope");
  assert.match(source, /function resolveModeScopeStatus\(/, "runtime should include explicit mode/scope status generation");
  assert.match(source, /function syncMapModeScopeState\(/, "runtime should synchronize mode/scope state line");
  assert.match(source, /function fitOfficeScopeFeatures\(/, "map runtime should include office-view fitter");
  assert.match(source, /function selectRuntimeGeoid\(/, "map runtime should include selection helper");
  assert.match(source, /function clearRuntimeSelection\(/, "map runtime should include clear-selection helper");
  assert.match(source, /function saveRuntimeBookmark\(/, "map runtime should include bookmark-save helper");
  assert.match(source, /function jumpRuntimeBookmark\(/, "map runtime should include bookmark-jump helper");
  assert.match(source, /function buildSelectedAreaSummaryText\(/, "map runtime should include copy-summary helper");
  assert.match(source, /function syncMapNavigationState\(/, "map runtime should include nav-state sync helper");
});

test("map phase8 contract: cleared selection state is preserved across refresh cycles", () => {
  const source = readSource();
  assert.match(source, /selectionCleared:\s*false/, "runtime should track cleared-selection state");
  assert.match(source, /if \(runtime\.selectionCleared\)\s*\{\s*runtime\.selectedGeoid = \"\";/m, "refresh logic should preserve explicit selection clear");
});

test("map phase8 contract: navigation status copy covers search, selection, and quick-action states", () => {
  const source = readSource();
  assert.match(source, /Search and quick navigation become available once map geography loads\./, "nav status should include pre-ready guidance");
  assert.match(source, /No mapped areas are available to search for the current context\./, "nav status should include no-geography guidance");
  assert.match(source, /Search by area name\/GEOID or use prefixes \(district:, office:, turf:, organizer:, precinct:, tract:\), then click map areas to inspect\./, "nav status should include prefixed search guidance");
  assert.match(source, /Selection cleared\. Click an area or search by GEOID\/name to inspect again\./, "clear-selection action should produce explicit feedback");
  assert.match(source, /Campaign view applied to current geometry footprint\./, "campaign-view quick action should produce success feedback");
  assert.match(source, /Returning to office context for .*…/, "office quick-return flow should provide explicit transition copy");
  assert.match(source, /Organizer worked view is unavailable because no organizer worked-geography context is active\./, "organizer quick-return should fail safely when organizer scope is missing");
});

test("map phase8 contract: scope-switch quick actions use explicit mode transitions to avoid stale state bleed", () => {
  const source = readSource();
  assert.match(source, /runtime\.contextMode = CONTEXT_MODE_CAMPAIGN;/, "campaign quick action should force campaign mode before sync");
  assert.match(source, /runtime\.contextMode = CONTEXT_MODE_OFFICE;/, "office quick action should force office mode before sync");
  assert.match(source, /runtime\.contextMode = CONTEXT_MODE_WORKED;/, "organizer quick action should force worked mode before sync");
  assert.match(source, /void syncMapSurface\(\)\.then\(\(\) => \{/, "scope-switch quick actions should re-sync map runtime after mode change");
});
