// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { clamp, safeNum } from "../core/utils.js";
import { makeDefaultState } from "./state.js";
import { resolveActiveContext } from "./activeContext.js";
import { normalizeLoadedStateModule } from "./normalizeLoadedState.js";
import { makeScenarioExport, validateScenarioExport } from "../export.js";
import {
  canonicalDoorsPerHourFromSnapModule,
  setCanonicalDoorsPerHourModule,
} from "./stateNormalizationHelpers.js";
import { deriveAssumptionsProfileFromStateModule } from "./assumptionsProfile.js";

function makeDeps(activeContext){
  return {
    makeDefaultState: () => makeDefaultState(),
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap: (snap) => canonicalDoorsPerHourFromSnapModule(snap, safeNum),
    setCanonicalDoorsPerHour: (state, value) => setCanonicalDoorsPerHourModule(state, value, safeNum),
    deriveAssumptionsProfileFromState: deriveAssumptionsProfileFromStateModule,
    activeContext,
  };
}

function buildImportedState(overrides = {}){
  const base = makeDefaultState();
  return {
    ...base,
    campaignId: "team_custom",
    campaignName: "Team Custom",
    officeId: "north_office",
    ...overrides,
  };
}

test("normalizeLoadedState: imported campaignId survives when resolved context source is default", () => {
  const imported = buildImportedState();
  const defaultResolvedContext = resolveActiveContext({});
  const next = normalizeLoadedStateModule(imported, makeDeps(defaultResolvedContext));

  assert.equal(next.campaignId, "team_custom");
  assert.equal(next.campaignName, "Team Custom");
  assert.equal(next.officeId, "north_office");
});

test("normalizeLoadedState: explicit context campaignId remains authoritative", () => {
  const imported = buildImportedState();
  const explicitContext = resolveActiveContext({
    campaignId: "scope_locked",
    officeId: "scope_office",
    scenarioId: "scope_scenario",
  });
  const next = normalizeLoadedStateModule(imported, makeDeps(explicitContext));

  assert.equal(next.campaignId, "scope_locked");
  assert.equal(next.officeId, "scope_office");
  assert.equal(next.scenarioId, "scope_scenario");
  assert.equal(next.ui?.activeScenarioId, "scope_scenario");
});

test("normalizeLoadedState: URL locked campaign still overrides imported campaignId", () => {
  const imported = buildImportedState();
  const urlContext = resolveActiveContext({ search: "?campaign=url_scope&office=url_office&scenario=url_scenario" });
  const next = normalizeLoadedStateModule(imported, makeDeps(urlContext));

  assert.equal(next.campaignId, "url_scope");
  assert.equal(next.officeId, "url_office");
  assert.equal(next.scenarioId, "url_scenario");
  assert.equal(next.ui?.activeScenarioId, "url_scenario");
});

test("normalizeLoadedState: imported scenarioId survives when resolved context source is default", () => {
  const imported = buildImportedState({
    scenarioId: "plan_alpha",
    ui: { activeScenarioId: "plan_alpha" },
  });
  const defaultResolvedContext = resolveActiveContext({});
  const next = normalizeLoadedStateModule(imported, makeDeps(defaultResolvedContext));

  assert.equal(next.scenarioId, "plan_alpha");
  assert.equal(next.ui?.activeScenarioId, "plan_alpha");
});

test("normalizeLoadedState: default-sourced campaign name does not clobber imported campaign name", () => {
  const imported = buildImportedState({
    campaignName: "Imported Team Name",
  });
  const next = normalizeLoadedStateModule(imported, makeDeps({
    campaignName: "Default Label",
    campaignSource: "default",
  }));

  assert.equal(next.campaignId, "team_custom");
  assert.equal(next.campaignName, "Imported Team Name");
});

test("scenario export/import round-trip keeps non-default campaignId under default context", () => {
  const sourceState = buildImportedState({
    campaignId: "district_team_17",
    campaignName: "District Team 17",
    officeId: "ops_hq",
    scenarioName: "General Plan",
    scenarioId: "plan_general",
    ui: { activeScenarioId: "plan_general" },
  });
  const payload = makeScenarioExport({
    modelVersion: "2.1.1",
    schemaVersion: 4,
    scenarioState: sourceState,
  });
  const validated = validateScenarioExport(payload, "2.1.1");
  assert.equal(validated.ok, true);

  const defaultResolvedContext = resolveActiveContext({});
  const hydrated = normalizeLoadedStateModule(validated.scenario, makeDeps(defaultResolvedContext));
  assert.equal(hydrated.campaignId, "district_team_17");
  assert.equal(hydrated.campaignName, "District Team 17");
  assert.equal(hydrated.officeId, "ops_hq");
  assert.equal(hydrated.scenarioName, "General Plan");
  assert.equal(hydrated.scenarioId, "plan_general");
  assert.equal(hydrated.ui?.activeScenarioId, "plan_general");
});
