// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeCanonicalState } from "../state/schema.js";
import {
  updateDistrictFormField,
  updateDistrictTemplateField,
  updateDistrictUniverseField,
} from "../actions/district.js";
import {
  addBallotCandidate,
  setBallotUndecided,
  setBallotYourCandidate,
  updateBallotUserSplit,
} from "../actions/ballot.js";
import { addCandidateHistoryRecord } from "../actions/candidateHistory.js";
import { selectDistrictCanonicalView } from "./districtCanonical.js";
import { computeElectionSnapshot } from "../electionSnapshot.js";
import {
  buildDistrictTurnoutFallbackView,
  computeDistrictSupportTotalPctFromState,
} from "../districtView.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRuntimePath = path.resolve(__dirname, "../../appRuntime.js");
const censusModulePath = path.resolve(__dirname, "../censusModule.js");
const censusPhase1Path = path.resolve(__dirname, "../../app/censusPhase1.js");
const districtSurfacePath = path.resolve(__dirname, "../../app/v3/surfaces/districtV2/index.js");
const targetingModulePath = path.resolve(__dirname, "../../app/v3/surfaces/districtV2/targetingConfig.js");

const appRuntimeSource = fs.readFileSync(appRuntimePath, "utf8");
const censusModuleSource = fs.readFileSync(censusModulePath, "utf8");
const censusPhase1Source = fs.readFileSync(censusPhase1Path, "utf8");
const districtSurfaceSource = fs.readFileSync(districtSurfacePath, "utf8");
const targetingModuleSource = fs.readFileSync(targetingModulePath, "utf8");

function functionSegment(source, fnName) {
  const startToken = `function ${fnName}(`;
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing function ${fnName}`);
  const next = source.indexOf("\nfunction ", start + startToken.length);
  return next > start ? source.slice(start, next) : source.slice(start);
}

test("district compatibility guards: edits still land canonically in domains.*", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T10:00:00.000Z") });

  state = updateDistrictTemplateField(state, { field: "raceType", value: "city_council" }).state;
  state = updateDistrictTemplateField(state, { field: "officeLevel", value: "municipal" }).state;
  state = updateDistrictFormField(state, { field: "electionDate", value: "2026-11-03" }).state;
  state = updateDistrictFormField(state, { field: "universeSize", value: 98000 }).state;
  state = updateDistrictFormField(state, { field: "turnoutA", value: 46 }).state;
  state = updateDistrictFormField(state, { field: "turnoutB", value: 54 }).state;
  state = updateDistrictFormField(state, { field: "bandWidth", value: 5 }).state;
  state = updateDistrictUniverseField(state, { field: "enabled", value: true }).state;
  state = updateDistrictUniverseField(state, { field: "demPct", value: 38 }).state;

  state = addBallotCandidate(state, { candidateId: "cand_a", name: "A", supportPct: 48 }).state;
  state = addBallotCandidate(state, { candidateId: "cand_b", name: "B", supportPct: 42 }).state;
  state = setBallotUndecided(state, { undecidedPct: 10, undecidedMode: "user_defined" }).state;
  state = setBallotYourCandidate(state, { candidateId: "cand_a" }).state;
  state = updateBallotUserSplit(state, { candidateId: "cand_a", value: 60 }).state;
  state = updateBallotUserSplit(state, { candidateId: "cand_b", value: 40 }).state;

  state = addCandidateHistoryRecord(state, {
    recordId: "history_1",
    office: "Ward 1",
    cycleYear: 2022,
    electionType: "general",
    candidateName: "A",
    voteShare: 51,
  }).state;

  const canonical = selectDistrictCanonicalView(state);
  assert.equal(canonical.templateProfile.raceType, "city_council");
  assert.equal(canonical.templateProfile.officeLevel, "municipal");
  assert.equal(canonical.form.electionDate, "2026-11-03");
  assert.equal(canonical.form.universeSize, 98000);
  assert.equal(canonical.form.turnoutA, 46);
  assert.equal(canonical.form.turnoutB, 54);
  assert.equal(canonical.form.bandWidth, 5);
  assert.equal(canonical.universeComposition.enabled, true);
  assert.equal(canonical.universeComposition.demPct, 38);
  assert.equal(canonical.ballot.yourCandidateId, "cand_a");
  assert.equal(canonical.ballot.undecidedMode, "user_defined");
  assert.equal(canonical.ballot.userSplitByCandidateId.cand_a, 60);
  assert.equal(canonical.ballot.userSplitByCandidateId.cand_b, 40);
  assert.equal(canonical.candidateHistory.records.length, 1);
});

test("district compatibility guards: runtime bridge keeps legacy mirror writes while syncing domain actions", () => {
  const setFormSeg = functionSegment(appRuntimeSource, "districtBridgeSetFormField");
  assert.match(setFormSeg, /next\.raceType\s*=\s*value;/, "must still mirror raceType for compatibility");
  assert.match(setFormSeg, /syncTemplateField\("raceType",\s*value\)/, "must still sync canonical raceType");
  assert.match(setFormSeg, /next\.electionDate\s*=\s*String\(/, "must still mirror electionDate");
  assert.match(setFormSeg, /syncFormField\("electionDate",\s*next\.electionDate\)/, "must still sync canonical electionDate");
  assert.match(setFormSeg, /next\.universeSize\s*=\s*safeNum\(/, "must still mirror universeSize");
  assert.match(setFormSeg, /syncFormField\("universeSize",\s*next\.universeSize\)/, "must still sync canonical universeSize");
  assert.match(setFormSeg, /next\.undecidedPct\s*=\s*safeNum\(/, "must still mirror undecidedPct");
  assert.match(setFormSeg, /next\.undecidedMode\s*=\s*String\(/, "must still mirror undecidedMode");
  assert.match(setFormSeg, /syncUndecided\(\)/, "must still sync canonical undecided payload");
  assert.match(setFormSeg, /next\.universeLayerEnabled\s*=\s*!!rawValue;/, "must still mirror universe toggle");
  assert.match(setFormSeg, /syncUniverseField\("enabled",\s*next\.universeLayerEnabled\)/, "must still sync canonical universe toggle");

  const addCandidateSeg = functionSegment(appRuntimeSource, "districtBridgeAddCandidate");
  assert.match(addCandidateSeg, /next\.candidates\.push\(candidate\)/, "must still mirror candidate rows for compatibility");
  assert.match(addCandidateSeg, /addBallotCandidateAction/, "must still sync canonical ballot candidate refs");

  const setUserSplitSeg = functionSegment(appRuntimeSource, "districtBridgeSetUserSplit");
  assert.match(setUserSplitSeg, /next\.userSplit\[id\]\s*=\s*safeNum\(rawValue\)/, "must still mirror userSplit compatibility map");
  assert.match(setUserSplitSeg, /updateBallotUserSplitAction/, "must still sync canonical userSplit map");

  const historySeg = functionSegment(appRuntimeSource, "districtBridgeUpdateCandidateHistoryRecord");
  assert.match(historySeg, /next\.candidateHistory\s*=\s*normalizeCandidateHistoryRecords\(/, "must still mirror candidateHistory list");
  assert.match(historySeg, /updateCandidateHistoryRecordAction/, "must still sync canonical candidate history domain");
});

test("district compatibility guards: transitional mirror read paths remain explicit", () => {
  const derivedSeg = functionSegment(appRuntimeSource, "districtBridgeDerivedView");
  assert.match(derivedSeg, /computeElectionSnapshot\(\{\s*state:\s*currentState/, "district derived view still depends on legacy planning snapshot input shape");
  assert.match(derivedSeg, /currentState\?\.universeSize/, "district derived summary still reads mirrored universeSize");
  assert.match(derivedSeg, /currentState\?\.undecidedMode/, "district ballot warning logic still reads mirrored undecided mode");
  assert.match(derivedSeg, /normalizeCandidateHistoryRecords\(currentState\?\.candidateHistory\)/, "district history summaries still read mirrored history rows");

  assert.match(appRuntimeSource, /computeElectionSnapshot\(\{ state: snap, nowDate: new Date\(\), toNum: safeNum \}\)/, "outcome surface compute still consumes planning snapshot from full state object");
  assert.match(appRuntimeSource, /const modelInput = buildModelInputFromState\(snap, safeNum\);/, "outcome surface compute still uses model-input compatibility adapter");
});

test("district compatibility guards: derived summary + ballot warning math stays stable across refresh", () => {
  const state = {
    universeSize: 100000,
    turnoutA: 45,
    turnoutB: 55,
    bandWidth: 4,
    candidates: [
      { id: "cand_a", name: "A", supportPct: 48 },
      { id: "cand_b", name: "B", supportPct: 42 },
    ],
    undecidedPct: 10,
    undecidedMode: "user_defined",
    yourCandidateId: "cand_a",
    userSplit: { cand_a: 60, cand_b: 40 },
    campaignName: "Test Campaign",
    raceType: "state_leg",
    templateMeta: { electionType: "general" },
    weeksRemaining: "10",
    electionDate: "2026-11-03",
    persuasionPct: 30,
    earlyVoteExp: 35,
    contactRatePct: 22,
    supportRatePct: 55,
    turnoutReliabilityPct: 80,
  };

  const supportTotal = computeDistrictSupportTotalPctFromState(state);
  const turnoutFallback = buildDistrictTurnoutFallbackView(state);
  const planning = computeElectionSnapshot({ state, nowDate: new Date("2026-03-21T00:00:00.000Z") });

  assert.equal(supportTotal, 100);
  assert.equal(turnoutFallback.expectedPct, 50);
  assert.equal(turnoutFallback.votesPer1pct, 1000);
  assert.equal(planning?.res?.validation?.candidateTableOk, true);
  assert.equal(planning?.res?.validation?.userSplitOk, true);
  assert.equal(planning?.res?.validation?.supportTotalPct, 100);

  const warningState = {
    ...state,
    undecidedPct: 5,
  };
  const warningPlanning = computeElectionSnapshot({ state: warningState, nowDate: new Date("2026-03-21T00:00:00.000Z") });
  assert.equal(warningPlanning?.res?.validation?.candidateTableOk, false);
  assert.match(String(warningPlanning?.res?.validation?.candidateTableMsg || ""), /Totals must equal 100%/);

  const reopened = JSON.parse(JSON.stringify(state));
  const supportTotalAfterRefresh = computeDistrictSupportTotalPctFromState(reopened);
  const turnoutAfterRefresh = buildDistrictTurnoutFallbackView(reopened);
  const planningAfterRefresh = computeElectionSnapshot({ state: reopened, nowDate: new Date("2026-03-21T00:00:00.000Z") });

  assert.equal(supportTotalAfterRefresh, supportTotal);
  assert.equal(turnoutAfterRefresh.expectedPct, turnoutFallback.expectedPct);
  assert.equal(turnoutAfterRefresh.votesPer1pct, turnoutFallback.votesPer1pct);
  assert.equal(planningAfterRefresh?.res?.validation?.supportTotalPct, planning?.res?.validation?.supportTotalPct);
});

test("district compatibility guards: outcome planning outputs still respond to district edits", () => {
  const base = {
    universeSize: 100000,
    turnoutA: 45,
    turnoutB: 55,
    bandWidth: 4,
    candidates: [
      { id: "cand_a", name: "A", supportPct: 48 },
      { id: "cand_b", name: "B", supportPct: 42 },
    ],
    undecidedPct: 10,
    undecidedMode: "user_defined",
    yourCandidateId: "cand_a",
    userSplit: { cand_a: 60, cand_b: 40 },
    campaignName: "Test Campaign",
    raceType: "state_leg",
    templateMeta: { electionType: "general" },
    weeksRemaining: "10",
    electionDate: "2026-11-03",
    persuasionPct: 30,
    earlyVoteExp: 35,
    contactRatePct: 22,
    supportRatePct: 55,
    turnoutReliabilityPct: 80,
  };

  const edited = {
    ...base,
    universeSize: 120000,
    turnoutA: 50,
    turnoutB: 60,
    candidates: [
      { id: "cand_a", name: "A", supportPct: 40 },
      { id: "cand_b", name: "B", supportPct: 50 },
    ],
  };

  const before = computeElectionSnapshot({ state: base, nowDate: new Date("2026-03-21T00:00:00.000Z") });
  const after = computeElectionSnapshot({ state: edited, nowDate: new Date("2026-03-21T00:00:00.000Z") });

  assert.notEqual(after?.res?.turnout?.votesPer1pct, before?.res?.turnout?.votesPer1pct);
  assert.notEqual(after?.res?.expected?.yourVotes, before?.res?.expected?.yourVotes);
});

test("district pending-write hold scope: removed from district_v2 binders", () => {
  const bindFormSelectSeg = functionSegment(districtSurfaceSource, "bindDistrictV2FormSelect");
  const bindFormFieldSeg = functionSegment(districtSurfaceSource, "bindDistrictV2FormField");
  const bindFormCheckboxSeg = functionSegment(districtSurfaceSource, "bindDistrictV2FormCheckbox");
  const bindTargetingModuleSeg = functionSegment(targetingModuleSource, "bind");
  const bindCensusFieldSeg = functionSegment(districtSurfaceSource, "bindDistrictV2CensusField");

  assert.doesNotMatch(bindFormSelectSeg, /markDistrictPendingWrite\(/, "district_v2 form select binder must not use pending-write hold");
  assert.doesNotMatch(bindFormFieldSeg, /markDistrictPendingWrite\(/, "district_v2 form field binder must not use pending-write hold");
  assert.doesNotMatch(bindFormCheckboxSeg, /markDistrictPendingWrite\(/, "district_v2 form checkbox binder must not use pending-write hold");
  assert.doesNotMatch(bindTargetingModuleSeg, /markDistrictPendingWrite\(/, "district_v2 targeting binder must not use pending-write hold");
  assert.doesNotMatch(bindCensusFieldSeg, /markDistrictPendingWrite\(/, "district_v2 census binder must not use pending-write hold");
  assert.doesNotMatch(districtSurfaceSource, /shouldHoldDistrictControlSync\(/, "district_v2 must not use hold-based control sync");
});

test("c9.4 targeting lab: canRun uses canonical census rows with runtime fallback", () => {
  const canonicalSeg = functionSegment(appRuntimeSource, "districtBridgeCanonicalView");
  assert.match(
    canonicalSeg,
    /const runtimeCensusRows = getCensusRowsForState\(censusRuntimeState\);/,
    "district canonical view must read runtime census rows for fallback",
  );
  assert.match(
    canonicalSeg,
    /const runtimeCensusRowsCount = Object\.keys\(runtimeCensusRows[\s\S]*\)\.length;/,
    "district canonical view must derive runtime census row count",
  );
  assert.match(
    canonicalSeg,
    /const targetingCanRun = censusLoadedRowCount > 0 \|\| runtimeCensusRowsCount > 0;/,
    "targeting canRun must fallback to runtime census row presence",
  );
  assert.match(
    canonicalSeg,
    /canRun:\s*targetingCanRun,/,
    "targeting config should expose fallback-aware canRun",
  );
});

test("c9.4 targeting lab: empty targeting state surfaces explicit load-rows status", () => {
  const derivedSeg = functionSegment(appRuntimeSource, "districtBridgeDerivedView");
  assert.match(
    derivedSeg,
    /const runtimeCensusRows = getCensusRowsForState\(censusState\);/,
    "district derived view must inspect runtime census rows",
  );
  assert.match(
    derivedSeg,
    /TARGETING_STATUS_LOAD_ROWS_FIRST/,
    "district derived targeting status should include explicit load-rows guidance",
  );
});

test("c9.4 targeting lab: census runtime updates sync canonical selection slice", () => {
  const helperSeg = functionSegment(appRuntimeSource, "districtBridgeSyncCensusSelectionCanonicalState");
  assert.match(helperSeg, /updateCensusSelectionAction/, "selection sync must dispatch census selection action");
  assert.match(helperSeg, /rowsByGeoid:\s*runtimeRows/, "selection sync must include runtime rows");
  assert.match(helperSeg, /activeRowsKey/, "selection sync must include active rows key");
  assert.match(helperSeg, /loadedRowCount/, "selection sync must include loaded row count");

  const setFieldSeg = functionSegment(appRuntimeSource, "districtBridgeSetCensusField");
  const setGeoSeg = functionSegment(appRuntimeSource, "districtBridgeSetCensusGeoSelection");
  const triggerSeg = functionSegment(appRuntimeSource, "districtBridgeTriggerCensusAction");
  assert.match(setFieldSeg, /districtBridgeSyncCensusSelectionCanonicalState\(next\)/, "setField must sync canonical census selection");
  assert.match(setGeoSeg, /districtBridgeSyncCensusSelectionCanonicalState\(next\)/, "setGeoSelection must sync canonical census selection");
  assert.match(triggerSeg, /districtBridgeSyncCensusSelectionCanonicalState\(next\)/, "triggerCensusAction must sync canonical census selection");
});

test("c9.4a targeting lab: run action is gated by lock + readiness", () => {
  const targetingSyncSeg = functionSegment(districtSurfaceSource, "syncDistrictV2Targeting");
  assert.match(
    targetingSyncSeg,
    /districtV2TargetingModule\.sync\(/,
    "district v2 targeting sync should delegate to targeting module",
  );
  assert.match(
    targetingModuleSource,
    /const canRunByCanonical = config\?\.canRun == null \? true : !!config\.canRun;/,
    "targeting module readiness must normalize canRun state",
  );
  assert.match(
    targetingModuleSource,
    /applyDisabled\("v3BtnDistrictV2RunTargeting", locked \|\| !readyForRun\);/,
    "run targeting button must disable when prerequisites are not met",
  );
});

test("c9.4b targeting lab: run_failed bridge responses include error message detail", () => {
  const runSeg = functionSegment(appRuntimeSource, "districtBridgeRunTargeting");
  assert.match(runSeg, /let runErrorMessage = "";/, "runTargeting should track runtime error detail");
  assert.match(runSeg, /runErrorMessage = cleanText\(err\?\.message\) \|\| "Targeting run failed\."/);
  assert.match(runSeg, /code:\s*"run_failed"/);
  assert.match(runSeg, /message:\s*runErrorMessage \|\| "Targeting run failed\."/);
});

test("c9.4b targeting lab: runtime bridge resolves runTargetRanking via targeting runtime module", () => {
  assert.match(
    appRuntimeSource,
    /import\s+\*\s+as\s+targetingRuntimeModule\s+from "\.\/app\/targetingRuntime\.js";/,
    "appRuntime should import targeting runtime module namespace",
  );
  const runSeg = functionSegment(appRuntimeSource, "districtBridgeRunTargeting");
  assert.match(
    runSeg,
    /targetingRuntimeModule\s*&&\s*typeof targetingRuntimeModule\.runTargetRanking === "function"/,
    "districtBridgeRunTargeting must resolve runTargetRanking from runtime module namespace",
  );
  assert.match(
    runSeg,
    /runTargetRankingFn\(/,
    "districtBridgeRunTargeting must call resolved runtime function",
  );
});

test("c9.4c targeting lab: district derived rows preserve target labels and priority badges in reasons", () => {
  const derivedSeg = functionSegment(appRuntimeSource, "districtBridgeDerivedView");
  assert.match(
    derivedSeg,
    /const reasons = Array\.isArray\(row\?\.reasons\)/,
    "targeting derived rows should preserve the full reasons array",
  );
  assert.match(
    derivedSeg,
    /if \(row\?\.isTopTarget\) badges\.push\("Top target"\);/,
    "targeting derived rows should include top-target badges",
  );
  assert.match(
    derivedSeg,
    /const headline = targetLabel \? `\$\{targetLabel\}: \$\{reasonBase \|\| "—"\}` : \(reasonBase \|\| "—"\);/,
    "targeting reasons should include target label context when present",
  );
  assert.match(
    derivedSeg,
    /const flagsText = flagsList\.length \? flagsList\.join\(" • "\) : String\(row\?\.flagText \|\| ""\)\.trim\(\);/,
    "targeting derived rows should preserve multi-flag text without forcing dash placeholders",
  );
});

test("c10 census hierarchy: county is state-scoped and place is county-scoped when data exists", () => {
  const optionsSeg = functionSegment(appRuntimeSource, "districtBridgeBuildCensusConfigOptions");
  const disabledSeg = functionSegment(appRuntimeSource, "districtBridgeBuildCensusDisabledMap");
  const patchSeg = functionSegment(appRuntimeSource, "districtBridgePatchCensusBridgeField");

  assert.match(optionsSeg, /const selectedState = String\(census\.stateFips \|\| ""\)\.trim\(\);/);
  assert.match(optionsSeg, /const selectedCounty = String\(census\.countyFips \|\| ""\)\.trim\(\);/);
  assert.match(optionsSeg, /const placeFallbackSet = new Set\(/, "place options should support geo-derived county narrowing");
  assert.match(optionsSeg, /const rowCounty = String\(row\?\.county \|\| row\?\.countyFips \|\| row\?\.parentCountyFips \|\| ""\)\.trim\(\);/);
  assert.match(optionsSeg, /if \(selectedCounty\) \{[\s\S]*placeFallbackSet\.has\(rowValue\)/, "place options should narrow by selected county where possible");

  assert.match(
    disabledSeg,
    /v3CensusCountyFips:\s*controlsLocked \|\| !stateFips,/,
    "county selector should remain enabled once state is selected",
  );
  assert.doesNotMatch(
    disabledSeg,
    /v3CensusCountyFips:\s*controlsLocked \|\| !stateFips \|\| !requiresCounty/,
    "county selector must not be disabled just because current resolution does not require county",
  );

  assert.match(
    patchSeg,
    /if \(!resolutionNeedsCounty\(resolution\) && resolution !== "place"\)\{/,
    "resolution changes should preserve county filter for place resolution",
  );
  assert.match(
    patchSeg,
    /} else if \(key === "countyFips"\)\{[\s\S]*census\.placeFips = "";[\s\S]*resetGeoData\(census\);/,
    "changing county should clear stale place selection and refresh geo context",
  );

  const placeFetchSeg = functionSegment(censusModuleSource, "fetchPlaceOptions");
  assert.match(placeFetchSeg, /county:\s*fips\(row\?\.county,\s*3\)/, "place option fetch should preserve county metadata when available");

  const buildSubRowsSeg = functionSegment(censusPhase1Source, "buildSubRows");
  assert.match(buildSubRowsSeg, /county:\s*cleanText\(row\?\.county\)/, "census bridge rows should retain county metadata");
  assert.match(
    censusPhase1Source,
    /const placeRowsFiltered = filterPlaceRowsByCounty\(placeRows,\s*s\.countyFips\);/,
    "render path should narrow place options by selected county",
  );
  assert.match(
    censusPhase1Source,
    /fillSelect\(els\.censusPlaceFips,\s*buildSubRows\(placeRowsFiltered\),\s*s\.placeFips,\s*"Select place"\);/,
    "place select should render county-filtered place rows",
  );
  assert.match(
    censusPhase1Source,
    /s\.bridgePlaceOptions = buildSubRows\(placeRowsFiltered\)\.map\(/,
    "bridge place options should publish county-filtered rows",
  );
  assert.match(
    censusPhase1Source,
    /els\.censusCountyFips\.disabled = !s\.stateFips;/,
    "county selector should remain available once state is chosen",
  );
  assert.match(
    censusPhase1Source,
    /if \(!resolutionNeedsCounty\(s\.resolution\) && s\.resolution !== "place"\)\{\s*s\.countyFips = "";/,
    "runtime setField resolution path should keep county for place resolution",
  );
});
