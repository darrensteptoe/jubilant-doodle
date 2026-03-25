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
  assert.match(source, /kv\("Race template", templateLabel \|\| canonicalRaceType \|\| "—"\)/);
  assert.match(source, /kv\("Template key", canonicalRaceType \|\| "—"\)/);
  assert.match(source, /kv\("Office level", canonicalTemplateMeta\.officeLevel \|\| "—"\)/);
  assert.match(source, /kv\("Election type", canonicalTemplateMeta\.electionType \|\| "—"\)/);
  assert.match(source, /kv\("Seat context", canonicalTemplateMeta\.seatContext \|\| "—"\)/);
  assert.match(source, /kv\("Partisanship mode", canonicalTemplateMeta\.partisanshipMode \|\| "—"\)/);
  assert.match(source, /kv\("Salience level", canonicalTemplateMeta\.salienceLevel \|\| "—"\)/);
  assert.match(source, /const electionCountdown = buildElectionCountdownView\(canonicalElectionDate\);/);
  assert.match(source, /els\?\.daysToEdaySidebar/);
});
