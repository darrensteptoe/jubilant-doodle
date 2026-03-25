// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "intelligenceRenderer.js"), "utf8");

test("intelligence renderer does not render fake deep-dive affordance text", () => {
  assert.doesNotMatch(source, /Deep dive/);
  assert.match(source, /function renderSectionMeta\(row\)\{/);
});
