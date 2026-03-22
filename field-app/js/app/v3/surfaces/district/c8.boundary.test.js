// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRuntimeSource = fs.readFileSync(path.join(__dirname, "../../../../appRuntime.js"), "utf8");
const censusConfigSource = fs.readFileSync(path.join(__dirname, "../districtV2/censusConfig.js"), "utf8");

test("c8 boundary: district election-data summary no longer derives normalized rows from census preview fallback", () => {
  assert.match(appRuntimeSource, /normalizedRowCount:\s*canonicalElectionRows,/);
  assert.match(
    appRuntimeSource,
    /const electionRowCount = Array\.isArray\(electionDataState\?\.normalizedRows\)\s*\?\s*electionDataState\.normalizedRows\.length\s*:\s*0;/,
  );
  assert.doesNotMatch(appRuntimeSource, /censusPreviewRows/);
  assert.doesNotMatch(appRuntimeSource, /normalizedRowCount:\s*canonicalElectionRows > 0 \? canonicalElectionRows : censusPreviewRows/);
});

test("c8 boundary: district census surface does not restore legacy election advisory/preview tables", () => {
  assert.doesNotMatch(censusConfigSource, /v3DistrictV2CensusAdvisoryTbody/);
  assert.doesNotMatch(censusConfigSource, /v3DistrictV2CensusElectionPreviewTbody/);
  assert.doesNotMatch(censusConfigSource, /Election preview/i);
  assert.doesNotMatch(censusConfigSource, /Assumption advisory/i);
});
