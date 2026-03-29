// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "reach.js"), "utf8");

function extractFunctionBody(name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = source.match(pattern);
  assert.ok(match, `${name} must exist`);
  return String(match[1] || "");
}

test("reach election-data advisory: advisory card is downstream-driven and hidden when absent", () => {
  const applyViewBody = extractFunctionBody("applyReachView");
  const advisoryBody = extractFunctionBody("syncReachBenchmarkAdvisory");

  assert.match(source, /id = "v3ReachBenchmarkCard"/);
  assert.match(source, /id="v3ReachBenchmarkPriorityOverlap"/);
  assert.match(source, /id="v3ReachBenchmarkTurnoutOverlap"/);
  assert.match(source, /id="v3ReachBenchmarkInterpretation"/);
  assert.match(source, /id="v3ReachBenchmarkInsights"/);
  assert.match(source, /readDistrictTargetingResultsSnapshot\(\)/);
  assert.match(source, /deriveReachElectionBenchmarkAdvisory\(\s*readElectionDataCanonicalSnapshot\(\),/);
  assert.match(applyViewBody, /syncReachBenchmarkAdvisory\(benchmarkAdvisory\);/);
  assert.match(advisoryBody, /card\.hidden = !hasAdvisory;/);
  assert.match(advisoryBody, /Priority overlap:/);
  assert.match(advisoryBody, /Turnout overlap:/);
  assert.match(advisoryBody, /No benchmark saturation warnings/);
  assert.doesNotMatch(advisoryBody, /setField|applyLever|applyRolling/);
});
