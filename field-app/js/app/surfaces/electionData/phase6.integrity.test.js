// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

function expect(pattern, message) {
  assert.match(source, pattern, message);
}

test("election data phase6: surface is decomposed into module files", () => {
  expect(/from "\.\/importPanel\.js"/, "election data index must import importPanel module");
  expect(/from "\.\/columnMapping\.js"/, "election data index must import columnMapping module");
  expect(/from "\.\/normalizedPreview\.js"/, "election data index must import normalizedPreview module");
  expect(/from "\.\/candidateReconciliation\.js"/, "election data index must import candidateReconciliation module");
  expect(/from "\.\/geographyReconciliation\.js"/, "election data index must import geographyReconciliation module");
  expect(/from "\.\/benchmarks\.js"/, "election data index must import benchmarks module");
  expect(/from "\.\/qualityPanel\.js"/, "election data index must import qualityPanel module");
});

test("election data phase6: canonical and derived readers are lane-split", () => {
  expect(/const canonical = readElectionDataCanonicalSnapshot\(\);/, "surface must read canonical election data snapshot");
  expect(/const derived = readElectionDataDerivedSnapshot\(\);/, "surface must read derived election data snapshot");
  expect(/syncElectionDataImportPanel\(canonical, derived\)/, "import panel must hydrate from canonical+derived snapshots");
  expect(/syncElectionDataBenchmarks\(canonical, derived\)/, "benchmarks panel must hydrate from canonical+derived snapshots");
});

test("election data phase6: writes route through electionData bridge actions", () => {
  expect(/importElectionDataFileBridge\(/, "import must call electionData bridge import action");
  expect(/mapElectionDataColumnsBridge\(/, "column map apply must call electionData bridge map action");
  expect(/reconcileElectionDataCandidatesBridge\(/, "candidate reconciliation must call electionData bridge action");
  expect(/reconcileElectionDataGeographiesBridge\(/, "geography reconciliation must call electionData bridge action");
  expect(/applyElectionDataBenchmarksBridge\(/, "downstream apply must call electionData bridge benchmark action");
});

test("election data phase6: full-width center-shell layout contract is enforced", () => {
  expect(/createCenterStackFrame\(/, "election data surface must use center stack frame");
  expect(/createCenterStackColumn\(/, "election data surface must use center stack column");
  expect(/createCenterModuleCard\(/, "election data surface must use center module cards");
  assert.doesNotMatch(source, /createSurfaceFrame\("two-col"\)/, "election data surface must not use two-col frame");
  assert.doesNotMatch(source, /createSurfaceFrame\("three-col"\)/, "election data surface must not use three-col frame");
});
