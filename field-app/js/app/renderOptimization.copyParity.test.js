// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.join(__dirname, "renderOptimization.js"), "utf8");

test("optimization copy parity: tactic enable warning reflects all visible tactics", () => {
  assert.match(
    source,
    /Optimization: Enable at least one tactic \(Doors\/Phones\/Texts\/Lit Drop\/Mail\) in Phase 4 inputs\./,
  );
});

