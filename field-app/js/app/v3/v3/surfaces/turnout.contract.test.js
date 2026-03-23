// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const turnoutSource = fs.readFileSync(path.join(__dirname, "turnout.js"), "utf8");

test("turnout surface contract: ROI controls include lit drop + mail tactic rows", () => {
  const requiredIds = [
    "v3RoiLitDropEnabled",
    "v3RoiLitDropCpa",
    "v3RoiLitDropKind",
    "v3RoiLitDropCr",
    "v3RoiLitDropSr",
    "v3RoiMailEnabled",
    "v3RoiMailCpa",
    "v3RoiMailKind",
    "v3RoiMailCr",
    "v3RoiMailSr",
  ];
  for (const id of requiredIds){
    assert.match(turnoutSource, new RegExp(`id="${id}"`), `missing control ${id}`);
  }
});

test("turnout surface contract: channel realism + tactic usage guidance text is present", () => {
  assert.match(turnoutSource, /Channel cost realism/, "missing realism section title");
  assert.match(
    turnoutSource,
    /Use these ranges as plausibility checks, not automatic truth\./,
    "missing realism intro copy",
  );
  assert.match(turnoutSource, /How to use tactic rows/, "missing tactic usage note title");
  assert.match(
    turnoutSource,
    /Enable only the channels the campaign is genuinely prepared to execute\./,
    "missing tactic usage note body",
  );
});

