// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function readFromRepo(relPath){
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("turf-event write path: turf entry UI includes bounded worked-geography inputs", () => {
  const html = readFromRepo("operations-turf.html");
  assert.match(html, /id="turfUnitType"/, "turf entry should include unitType input");
  assert.match(html, /id="turfUnitId"/, "turf entry should include unitId input");
  assert.match(html, /id="turfTractGeoid"/, "turf entry should include tract GEOID input");
  assert.match(html, /id="turfBlockGroupGeoid"/, "turf entry should include block-group GEOID input");
  assert.match(html, /id="turfStateFips"/, "turf entry should include state FIPS input");
  assert.match(html, /id="turfCountyFips"/, "turf entry should include county FIPS input");
});

test("turf-event write path: save handler normalizes worked-geography fields", () => {
  const source = readFromRepo("js/operationsTurf.js");
  assert.match(source, /import \{ normalizeTurfEventRecord \} from "\.\/features\/operations\/geographyActivity\.js";/, "turf save path should normalize records");
  assert.match(source, /const unitType = clean\(els\.turfUnitType\?\.value\);/, "save path should read unitType");
  assert.match(source, /const unitId = clean\(els\.turfUnitId\?\.value\);/, "save path should read unitId");
  assert.match(source, /const tractGeoid = clean\(els\.turfTractGeoid\?\.value\);/, "save path should read tract geoid");
  assert.match(source, /const blockGroupGeoid = clean\(els\.turfBlockGroupGeoid\?\.value\);/, "save path should read block-group geoid");
  assert.match(source, /normalizeTurfEventRecord\(\{[\s\S]*unitType,[\s\S]*unitId,[\s\S]*tractGeoid,[\s\S]*blockGroupGeoid,[\s\S]*stateFips,[\s\S]*countyFips,[\s\S]*\}\)/m, "save path should pass normalized geography fields");
});

test("turf-event write path: validation keeps legacy compatibility and explicit paired unit fields", () => {
  const source = readFromRepo("js/operationsTurf.js");
  assert.match(source, /Unit type and Unit ID must be entered together\./, "save path should require paired unit type/id");
  assert.match(source, /Provide worked geography: Turf\/Precinct or Unit Type \+ Unit ID/, "save path should preserve legacy turf/precinct fallback");
});
