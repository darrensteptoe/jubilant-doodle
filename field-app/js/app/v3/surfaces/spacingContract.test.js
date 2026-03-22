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

function assertSpacingContract(cssSource, label) {
  assert.match(cssSource, /--fpe-module-shell-gap:\s*var\(--fpe-space-5\)\s*;/, `${label}: missing --fpe-module-shell-gap token`);
  assert.match(cssSource, /--fpe-module-head-pad:\s*14px\s+17px\s+12px\s*;/, `${label}: missing --fpe-module-head-pad token`);
  assert.match(cssSource, /--fpe-module-body-pad:\s*16px\s+18px\s*;/, `${label}: missing --fpe-module-body-pad token`);
  assert.match(cssSource, /--fpe-module-grid-gap:\s*var\(--fpe-stack-gap\)\s*;/, `${label}: missing --fpe-module-grid-gap token`);
  assert.match(cssSource, /--fpe-module-inline-gap:\s*var\(--fpe-field-gap\)\s*;/, `${label}: missing --fpe-module-inline-gap token`);
  assert.match(cssSource, /--fpe-module-stack-gap:\s*10px\s*;/, `${label}: missing --fpe-module-stack-gap token`);

  assert.match(cssSource, /\.fpe-surface-frame--two-col\s*\{[^}]*gap:\s*var\(--fpe-module-shell-gap\)\s*;/s, `${label}: two-col frame must use module shell gap token`);
  assert.match(cssSource, /\.fpe-surface-frame--center-stack\s*\{[^}]*gap:\s*var\(--fpe-module-shell-gap\)\s*;/s, `${label}: center-stack frame must use module shell gap token`);
  assert.match(cssSource, /\.fpe-col\s*\{[^}]*gap:\s*var\(--fpe-module-shell-gap\)\s*;/s, `${label}: column gap must use module shell gap token`);
  assert.match(cssSource, /\.fpe-center-stack__column\s*\{[^}]*gap:\s*var\(--fpe-module-shell-gap\)\s*;/s, `${label}: center-stack column gap must use module shell gap token`);

  assert.match(cssSource, /\.fpe-card__head\s*\{[^}]*padding:\s*var\(--fpe-module-head-pad\)\s*;/s, `${label}: card head padding must use module token`);
  assert.match(cssSource, /\.fpe-card__body\s*\{[^}]*padding:\s*var\(--fpe-module-body-pad\)\s*;/s, `${label}: card body padding must use module token`);
  assert.match(cssSource, /\.fpe-field-grid\s*\{[^}]*gap:\s*var\(--fpe-module-grid-gap\)\s*;/s, `${label}: field grid gap must use module token`);
  assert.match(cssSource, /\.fpe-action-row\s*\{[^}]*gap:\s*var\(--fpe-module-inline-gap\)\s*;/s, `${label}: action-row gap must use module token`);
  assert.match(cssSource, /\.fpe-status-strip\s*\{[^}]*gap:\s*var\(--fpe-module-stack-gap\)\s*;/s, `${label}: status-strip gap must use module token`);
}

test("spacing contract: root stylesheet enforces shared module spacing tokens", () => {
  const css = readProjectFile("styles-fpe-v3.css");
  assertSpacingContract(css, "styles-fpe-v3.css");
});

test("spacing contract: app stylesheet mirrors shared module spacing tokens", () => {
  const css = readProjectFile("js/styles-fpe-v3.css");
  assertSpacingContract(css, "js/styles-fpe-v3.css");
});
