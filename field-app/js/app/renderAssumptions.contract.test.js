// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "renderAssumptions.js"), "utf8");

test("assumptions right rail derives race context from district canonical selector", () => {
  assert.match(source, /import\s+\{\s*selectDistrictCanonicalView\s*\}\s+from\s+"..\/core\/selectors\/districtCanonical\.js";/);
  assert.match(source, /const districtCanonical = selectDistrictCanonicalView\(runtimeState\);/);
  assert.match(source, /const canonicalElectionDate = String\(canonicalForm\.electionDate \|\| ""\)\.trim\(\);/);
  assert.match(source, /kv\("Assumptions profile", assumptionsProfileLabel\(state\)\)/);
  assert.match(source, /kv\("Support retention", formatAssumptionsPercent\(retentionPct\)\)/);
  assert.match(source, /const retentionStateValue = safeNum\(runtimeState\.retentionFactor\);/);
  assert.match(source, /const retentionCanonicalValue = safeNum\(canonicalUniverse\.retentionFactor\);/);
  assert.match(source, /UNIVERSE_DEFAULTS\.retentionFactor \* 100/);
  assert.doesNotMatch(source, /kv\("Race template"/);
  assert.doesNotMatch(source, /kv\("Template key"/);
  assert.doesNotMatch(source, /kv\("Office level"/);
  assert.doesNotMatch(source, /kv\("Election type"/);
  assert.doesNotMatch(source, /kv\("Seat context"/);
  assert.doesNotMatch(source, /kv\("Partisanship mode"/);
  assert.doesNotMatch(source, /kv\("Salience level"/);
  assert.match(source, /const electionCountdown = buildElectionCountdownView\(canonicalElectionDate\);/);
  assert.match(source, /els\?\.daysToEdaySidebar/);
});
