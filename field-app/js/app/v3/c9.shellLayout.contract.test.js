// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

const shellSource = read("js/app/v3/shell.js");
const stageMountSource = read("js/app/v3/stageMount.js");
const indexHtmlSource = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const districtSource = read("js/app/v3/surfaces/districtV2/index.js");
const electionDataSource = read("js/app/v3/surfaces/electionData/index.js");
const outcomeSource = read("js/app/v3/surfaces/outcome/index.js");
const turnoutSource = read("js/app/v3/surfaces/turnout.js");
const planSource = read("js/app/v3/surfaces/plan.js");
const scenariosSource = read("js/app/v3/surfaces/scenarios.js");
const controlsSource = read("js/app/v3/surfaces/controls.js");

test("c9 shell: runtime debug line is hidden by default and global glossary chip strip is removed", () => {
  assert.match(shellSource, /id="v3RuntimeDiagnostics"[^>]*hidden/);
  assert.doesNotMatch(shellSource, /Glossary shortcuts/);
  assert.doesNotMatch(shellSource, /fpe-context__intel/);
});

test("c9.2 shell: campaign scope row is data-stage scoped", () => {
  assert.match(shellSource, /id="v3DataContextSection"[^>]*hidden/);
  assert.match(shellSource, /id="v3CampaignId"/);
  assert.match(shellSource, /id="v3CampaignName"/);
  assert.match(shellSource, /id="v3OfficeId"/);
  assert.match(shellSource, /id="v3ScenarioName"/);
  assert.match(stageMountSource, /function syncDataContextSection\(\)/);
  assert.match(stageMountSource, /contextSection\.hidden = !visible;/);
  assert.match(stageMountSource, /const visible = activeStageId === "data";/);
});

test("c9 right rail: defaults to results and auto-opens manual for glossary/manual interactions", () => {
  assert.match(stageMountSource, /let activeRightRailMode = RIGHT_RAIL_MODE_RESULTS;/);
  assert.match(stageMountSource, /data-v3-right-rail-mode="results"/);
  assert.match(stageMountSource, /data-v3-right-rail-mode="manual"/);
  assert.match(stageMountSource, /RIGHT_RAIL_MANUAL_TRIGGER_SELECTOR/);
  assert.match(stageMountSource, /\[data-intel-glossary\]/);
  assert.match(stageMountSource, /\[data-intel-model\]/);
  assert.match(stageMountSource, /\[data-intel-playbook\]/);
  assert.match(stageMountSource, /\[data-intel-message\]/);
  assert.match(stageMountSource, /\[data-intel-module\]/);
  assert.match(stageMountSource, /setRightRailMode\(RIGHT_RAIL_MODE_MANUAL, \{ persist: true \}\);/);
  assert.match(stageMountSource, /setRightRailMode\(nextMode, \{ persist: true \}\);/);
});

test("c9 right rail: metadata block only keeps snapshot hash and rail sections are reordered", () => {
  assert.doesNotMatch(indexHtmlSource, /id="metaUniverseBasis"/);
  assert.doesNotMatch(indexHtmlSource, /id="metaSourceNote"/);
  assert.match(indexHtmlSource, /id="snapshotHash-sidebar"/);

  const sidebarStart = indexHtmlSource.indexOf('id="legacyResultsSidebar"');
  assert.ok(sidebarStart >= 0, "missing right-rail results sidebar");
  const railSource = indexHtmlSource.slice(sidebarStart);

  const keyResultsIdx = railSource.indexOf("Win path — expected");
  const validationIdx = railSource.indexOf("Input validation");
  const guardrailIdx = railSource.indexOf("Data checks &amp; guardrails");
  const mcIdx = railSource.indexOf("Monte Carlo win probability");
  const riskIdx = railSource.indexOf("Risk framing");
  const stressIdx = railSource.indexOf("Stress test summary");

  assert.ok(keyResultsIdx >= 0, "missing key results rail section");
  assert.ok(validationIdx > keyResultsIdx, "validation should render after key results");
  assert.ok(guardrailIdx > validationIdx, "guardrails should render after validation");
  assert.ok(mcIdx > guardrailIdx, "Monte Carlo should render after validation/guardrails");
  assert.ok(riskIdx > mcIdx, "risk framing should render after Monte Carlo");
  assert.ok(stressIdx > riskIdx, "stress summary should render after risk framing");
});

test("c9 district/election data ordering: district summary top, election summary moved to election-data page", () => {
  assert.match(districtSource, /center\.append\([\s\S]*summaryCard,\s*raceCard,/m);
  assert.doesNotMatch(districtSource, /title: "Election data summary"/);

  assert.match(electionDataSource, /title: "Election Data summary"/);
  assert.match(electionDataSource, /center\.append\([\s\S]*summaryCard,\s*importCard,/m);
});

test("c9 summary-at-top and density layout rules are applied to rebuilt pages", () => {
  assert.match(outcomeSource, /centerCol\.append\([\s\S]*summaryCard,\s*controlsCard,/m);
  assert.match(turnoutSource, /createSurfaceFrame\("two-col"\)/);
  assert.match(planSource, /createSurfaceFrame\("center-stack"\)/);
  assert.match(planSource, /centerCol\.append\([\s\S]*summaryCard,\s*workloadCard,/m);
  assert.match(scenariosSource, /createSurfaceFrame\("two-col-balanced"\)/);
  assert.match(controlsSource, /createSurfaceFrame\("two-col"\)/);
});
