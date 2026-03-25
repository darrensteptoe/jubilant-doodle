// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../..");

function readProjectFile(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function expectCenterStackSurface(relativePath) {
  const source = readProjectFile(relativePath);
  assert.match(source, /createCenterStackFrame\(/, `${relativePath} must use center-stack frame`);
  assert.match(source, /createCenterStackColumn\(/, `${relativePath} must use center-stack column`);
  assert.match(source, /createCenterModuleCard\(/, `${relativePath} must use center-module cards`);
  assert.doesNotMatch(source, /createSurfaceFrame\("three-col"\)/, `${relativePath} must not use three-col frame`);
  assert.doesNotMatch(source, /createSurfaceFrame\("two-col"\)/, `${relativePath} must not use two-col frame`);
}

function expectDistrictCompatSurface(relativePath) {
  const source = readProjectFile(relativePath);
  assert.match(
    source,
    /renderDistrictV2Surface\s+as\s+renderDistrictSurface/,
    `${relativePath} must forward to districtV2 renderer`,
  );
}

test("layout contract: rewritten center surfaces use center-stack shell", () => {
  expectDistrictCompatSurface("js/app/v3/surfaces/district/index.js");
  expectCenterStackSurface("js/app/v3/surfaces/districtV2/index.js");
  expectCenterStackSurface("js/app/v3/surfaces/electionData/index.js");
  expectCenterStackSurface("js/app/v3/surfaces/outcome/index.js");
  expectCenterStackSurface("js/app/v3/surfaces/data/index.js");
  expectCenterStackSurface("js/app/v3/surfaces/controls.js");
  expectCenterStackSurface("js/app/v3/surfaces/warRoom/index.js");
});

test("layout contract: shared CSS defines center-stack and full-width district module grids", () => {
  const css = readProjectFile("styles-fpe-v3.css");
  assert.match(css, /\.fpe-surface-frame--center-stack\s*\{/);
  assert.match(css, /\.fpe-center-stack__column\s*\{/);
  assert.match(css, /\.fpe-center-module\s*\{/);
  assert.match(
    css,
    /\.fpe-surface-pane\[data-v3-stage="district"\]\s+\.fpe-district-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/m,
  );
  assert.match(
    css,
    /\.fpe-surface-pane\[data-v3-stage="district"\]\s+\.fpe-district-analysis-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/m,
  );
});
