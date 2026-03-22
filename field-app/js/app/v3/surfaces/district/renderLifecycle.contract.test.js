// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const districtV2Path = path.join(__dirname, "../districtV2/index.js");
const districtV2TargetingModulePath = path.join(__dirname, "../districtV2/targetingConfig.js");
const districtV2CensusConfigPath = path.join(__dirname, "../districtV2/censusConfig.js");
const censusPhase1Path = path.join(__dirname, "../../../../app/censusPhase1.js");
const source = fs.readFileSync(districtV2Path, "utf8");
const targetingModuleSource = fs.readFileSync(districtV2TargetingModulePath, "utf8");
const censusConfigSource = fs.readFileSync(districtV2CensusConfigPath, "utf8");
const censusPhase1Source = fs.readFileSync(censusPhase1Path, "utf8");

function extractFunctionBodyFrom(text, name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = text.match(pattern);
  assert.ok(match, `${name} must exist`);
  return String(match[1] || "");
}

function extractFunctionBody(name) {
  return extractFunctionBodyFrom(source, name);
}

function escapeRegexLiteral(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const targetingBody = extractFunctionBodyFrom(targetingModuleSource, "sync");
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
  const targetingBindBody = extractFunctionBodyFrom(targetingModuleSource, "bind");
  const censusFieldBody = extractFunctionBody("bindDistrictV2CensusField");

  assert.match(targetingBindBody, /control\.dataset\.v3DistrictV2Bound === "1"/);
  assert.match(targetingBindBody, /control\.dataset\.v3DistrictV2Bound = "1";/);
  assert.match(censusFieldBody, /control\.dataset\.v3DistrictV2Bound === "1"/);
  assert.match(censusFieldBody, /control\.dataset\.v3DistrictV2Bound = "1";/);

  assert.doesNotMatch(targetingBindBody, /markDistrictPendingWrite|shouldHoldDistrictControlSync/);
  assert.doesNotMatch(censusFieldBody, /markDistrictPendingWrite|shouldHoldDistrictControlSync/);
});

test("c8 contract: turnout baseline sync and bind paths are in-place and hold-free", () => {
  const turnoutSyncBody = extractFunctionBody("syncDistrictV2TurnoutBaseline");
  const turnoutBindBody = extractFunctionBody("bindDistrictV2TurnoutBaselineHandlers");

  assert.match(turnoutSyncBody, /syncInputValueFromRaw\("v3DistrictV2TurnoutA"/);
  assert.match(turnoutSyncBody, /syncInputValueFromRaw\("v3DistrictV2TurnoutB"/);
  assert.match(turnoutSyncBody, /syncInputValueFromRaw\("v3DistrictV2BandWidth"/);
  assert.doesNotMatch(turnoutSyncBody, /setInnerHtmlWithTrace\(/);

  assert.match(turnoutBindBody, /bindDistrictV2FormField\("v3DistrictV2TurnoutA", "turnoutA"\);/);
  assert.match(turnoutBindBody, /bindDistrictV2FormField\("v3DistrictV2TurnoutB", "turnoutB"\);/);
  assert.match(turnoutBindBody, /bindDistrictV2FormField\("v3DistrictV2BandWidth", "bandWidth"\);/);
  assert.doesNotMatch(turnoutBindBody, /markDistrictPendingWrite|shouldHoldDistrictControlSync/);
});

test("c8 contract: census map/vtd lane is wired and advisory assumptions lane is present without election preview restore", () => {
  assert.match(source, /bindDistrictV2CensusFile\("v3DistrictV2CensusMapQaVtdZip", "mapQaVtdZip"\);/);
  assert.match(source, /bindDistrictV2CensusAction\("v3BtnDistrictV2CensusLoadMap", "loadMap"\);/);
  assert.match(source, /bindDistrictV2CensusAction\("v3BtnDistrictV2CensusClearMap", "clearMap"\);/);
  assert.match(source, /bindDistrictV2CensusAction\("v3BtnDistrictV2CensusClearVtdZip", "clearVtdZip"\);/);
  assert.match(source, /bindDistrictV2CensusAction\("v3BtnDistrictV2CensusSelectAll", "selectAll"\);/);
  assert.match(source, /bindDistrictV2CensusAction\("v3BtnDistrictV2CensusClearSelection", "clearSelection"\);/);

  assert.match(censusConfigSource, /id="v3DistrictV2CensusMapShell"/);
  assert.match(censusConfigSource, /id="v3DistrictV2CensusMapStatus"/);
  assert.match(censusConfigSource, /id="v3DistrictV2CensusMapQaVtdZipStatus"/);
  assert.match(censusConfigSource, /id="v3DistrictV2CensusMapQaVtdZip"/);
  assert.match(censusConfigSource, /id="v3DistrictV2CensusAdvisoryTbody"/);
  assert.match(censusConfigSource, /id="v3DistrictV2CensusAdvisoryStatusSummary"/);
  assert.match(censusConfigSource, /id="v3DistrictV2CensusAssumptionProvenance"/);
  assert.match(censusConfigSource, /id="v3DistrictV2CensusApplyAdjustmentsStatus"/);
  assert.doesNotMatch(censusConfigSource, /v3DistrictV2CensusElectionPreviewTbody/);
});

test("c9 contract: census map label lane is present and synced without editable control rebuild", () => {
  const censusSyncBody = extractFunctionBody("syncDistrictV2Census");
  assert.match(censusConfigSource, /id="v3DistrictV2CensusMapLabels"/);
  assert.match(censusSyncBody, /setText\(\s*"v3DistrictV2CensusMapLabels"/);
  assert.match(censusSyncBody, /setText\(\s*"v3DistrictV2CensusAdvisoryStatusSummary"/);
  assert.match(censusSyncBody, /setText\(\s*"v3DistrictV2CensusAssumptionProvenance"/);
  assert.match(censusSyncBody, /setText\(\s*"v3DistrictV2CensusApplyAdjustmentsStatus"/);
  assert.match(censusSyncBody, /renderDistrictV2CensusAdvisoryRows\(/);
  assert.doesNotMatch(censusSyncBody, /setInnerHtmlWithTrace\(\s*mapShell/);
  assert.doesNotMatch(censusSyncBody, /markDistrictPendingWrite|shouldHoldDistrictControlSync/);
});

test("c10 contract: census advisory field set remains canon-complete in runtime advisory builder", () => {
  const requiredLabels = [
    "Field speed index",
    "Persuasion environment",
    "Turnout elasticity",
    "Turnout potential index",
    "Field difficulty",
    "Housing density ratio (units / resident)",
    "Vehicle availability / no-vehicle HH",
    "Long / super commute share",
    "No-internet share",
    "Poverty share",
    "Walkability factor",
    "Contact probability modifier",
    "Estimated doors/hour factor",
    "Age distribution",
    "Advisory doors/hour multiplier",
    "Current blended APH",
    "Achievable APH band (p25/p50/p75)",
    "Environment-adjusted APH (p50)",
    "Required APH to hit goal",
    "APH feasibility check",
  ];
  for (const label of requiredLabels) {
    const pattern = new RegExp(`label:\\s*"${escapeRegexLiteral(label)}"`);
    assert.match(censusPhase1Source, pattern, `missing canon advisory label: ${label}`);
  }
});

test("c9.3 contract: district v2 map host is present and preferred by census runtime resolver", () => {
  assert.match(censusConfigSource, /id="v3CensusMapHost"/);
  const resolverBodyMatch = censusPhase1Source.match(
    /function resolveCensusMapContainer\(els\)\{([\s\S]*?)\n\}/m,
  );
  assert.ok(resolverBodyMatch, "resolveCensusMapContainer must exist");
  const resolverBody = String(resolverBodyMatch?.[1] || "");
  const v3HostIdx = resolverBody.indexOf('document.getElementById("v3CensusMapHost")');
  const bridgeElsIdx = resolverBody.indexOf("censusRuntimeBridgeEls?.censusMap");
  const legacyHostIdx = resolverBody.indexOf('document.getElementById("censusMap")');
  assert.ok(v3HostIdx >= 0, "resolver must query v3 host");
  assert.ok(bridgeElsIdx >= 0, "resolver must still support bridge host");
  assert.ok(legacyHostIdx >= 0, "resolver must still support legacy host");
  assert.ok(v3HostIdx < bridgeElsIdx, "v3 host must be preferred over legacy bridge host");
  assert.ok(v3HostIdx < legacyHostIdx, "v3 host must be preferred over legacy censusMap host");
});

test("c10 contract: census boundary overlay binds tract/place/block-group labels on loaded layers", () => {
  const applyMapOverlayBody = extractFunctionBodyFrom(censusPhase1Source, "applyMapOverlay");
  const loadMapBody = extractFunctionBodyFrom(censusPhase1Source, "onLoadMapBoundaries");
  assert.match(censusPhase1Source, /function labelForBoundaryFeature\(feature, resolution = ""\)\{/);
  assert.match(applyMapOverlayBody, /labelForBoundaryFeature\(feature, resolution\)/);
  assert.match(applyMapOverlayBody, /layer\.bindTooltip\(/);
  assert.match(applyMapOverlayBody, /layer\.bindPopup\(/);
  assert.match(
    loadMapBody,
    /applyMapOverlay\(result\.featureCollection,\s*\{\s*resolution:\s*s\.resolution\s*\}\)/,
    "boundary overlay should pass active resolution for label shaping",
  );
});

test("c9.4a contract: targeting actions surface null bridge results and explicit no_rows feedback", () => {
  const mutationBody = extractFunctionBodyFrom(targetingModuleSource, "handleMutationResult");
  const failureMessageBody = extractFunctionBodyFrom(targetingModuleSource, "resolveRunFailureMessage");
  assert.match(mutationBody, /result == null/, "targeting mutation handling must detect null bridge results");
  assert.match(
    mutationBody,
    /Targeting action failed to reach the runtime bridge\. Reload the page and try again\./,
    "null bridge results must surface explicit targeting status text",
  );
  assert.match(mutationBody, /code === "no_rows"/, "targeting mutation handling must branch no_rows result codes");
  assert.match(
    mutationBody,
    /targetingActionStatusOverride = "Load ACS rows before running targeting\.";/,
    "no_rows should surface actionable load-rows guidance",
  );
  assert.match(
    mutationBody,
    /code === "run_failed"/,
    "targeting mutation handling must branch run_failed result codes",
  );
  assert.match(
    failureMessageBody,
    /Targeting run failed:/,
    "run_failed should surface runtime detail text when available",
  );
});

test("c9.4a contract: run targeting disabled state and status text respect canRun", () => {
  const targetingBody = extractFunctionBodyFrom(targetingModuleSource, "sync");
  const readinessBody = extractFunctionBodyFrom(targetingModuleSource, "deriveReadiness");
  assert.match(
    readinessBody,
    /const canRunByCanonical = config\?\.canRun == null \? true : !!config\.canRun;/,
    "targeting readiness must normalize canRun from canonical config",
  );
  assert.match(
    targetingBody,
    /applyDisabled\("v3BtnDistrictV2RunTargeting", locked \|\| !readyForRun\);/,
    "run targeting button must be disabled when prerequisites are unmet",
  );
  assert.match(
    targetingBody,
    /const statusText = targetingActionStatusOverride \|\| \(readiness\.ready \? derivedStatusText : readiness\.reason\);/,
    "targeting status should surface explicit action-level failures before derived fallback",
  );
});

test("c9.4c contract: targeting rows render explicit non-dash flag fallback and signal-coverage note", () => {
  const renderRowsBody = extractFunctionBodyFrom(targetingModuleSource, "renderTargetingRows");
  const syncBody = extractFunctionBodyFrom(targetingModuleSource, "sync");
  const coverageBody = extractFunctionBodyFrom(targetingModuleSource, "evaluateTargetingSignalCoverage");
  assert.match(
    targetingModuleSource,
    /getMetricIdsForSet/,
    "targeting module should inspect Census metric-set coverage for signal quality",
  );
  assert.match(
    renderRowsBody,
    /const flagsCellText = flagsValue \|\| String\(flagFallbackText \|\| "No risk flags triggered\."\);/,
    "targeting rows should show explicit fallback text when flags are empty",
  );
  assert.doesNotMatch(
    renderRowsBody,
    /<td>\$\{escapeHtml\(String\(row\?\.flags \|\| ""\)\)\}<\/td>/,
    "targeting flags cell should not render raw empty-string values as dead dashes",
  );
  assert.match(
    coverageBody,
    /Signal coverage limited \(/,
    "targeting module should define explicit metric-coverage note text",
  );
  assert.match(
    syncBody,
    /const metaText = signalCoverageNote/,
    "targeting sync should include coverage notes in module meta text",
  );
});
