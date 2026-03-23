// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stageRegistrySource = fs.readFileSync(path.resolve(__dirname, "../../stageRegistry.js"), "utf8");
const stageMountSource = fs.readFileSync(path.resolve(__dirname, "../../stageMount.js"), "utf8");
const districtCompatibilitySource = fs.readFileSync(path.resolve(__dirname, "../district/index.js"), "utf8");
const districtV2Source = fs.readFileSync(path.resolve(__dirname, "./index.js"), "utf8");

test("district route is swapped to districtV2 and temporary stage is removed", () => {
  assert.match(stageRegistrySource, /id:\s*"district"/);
  assert.match(stageRegistrySource, /surface:\s*"districtV2"/);
  assert.doesNotMatch(stageRegistrySource, /id:\s*"district_v2"/);

  assert.match(stageMountSource, /import\s+\{\s*renderDistrictV2Surface\s*\}\s+from\s+"\.\/surfaces\/districtV2\/index\.js"/);
  assert.match(stageMountSource, /districtV2:\s*renderDistrictV2Surface/);
  assert.doesNotMatch(stageMountSource, /renderDistrictSurface/);
  assert.doesNotMatch(stageMountSource, /district:\s*renderDistrictSurface/);
});

test("districtV2 mount marker and district compatibility wrapper are explicit", () => {
  assert.match(districtV2Source, /console\.info\("\[district_v2\] mounted"\)/);
  assert.match(
    districtCompatibilitySource,
    /export\s+\{\s*renderDistrictV2Surface as renderDistrictSurface\s*\}\s+from\s+"\.\.\/districtV2\/index\.js";/,
  );
});
