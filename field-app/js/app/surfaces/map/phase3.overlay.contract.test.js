// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readSource() {
  return fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
}

test("map phase3 contract: fit/reset controls and hover status are present", () => {
  const source = readSource();
  assert.match(source, /const FIT_BTN_ID = "v3MapFitBtn";/, "fit button id must be defined");
  assert.match(source, /const RESET_BTN_ID = "v3MapResetBtn";/, "reset button id must be defined");
  assert.match(source, /const HOVER_STATUS_ID = "v3MapHoverStatus";/, "hover status id must be defined");
  assert.match(source, /Fit to boundary/, "fit button label must be rendered");
  assert.match(source, /Reset view/, "reset button label must be rendered");
});

test("map phase3 contract: hover interaction updates boundary highlight and status", () => {
  const source = readSource();
  assert.match(source, /const HOVER_LAYER_ID = "v3MapAreaHoverLayer";/, "hover layer must be declared");
  assert.match(source, /function updateHoverFilter/, "hover filter helper must exist");
  assert.match(source, /function syncHoverStatus/, "hover status helper must exist");
  assert.match(source, /map\.on\("mousemove", FILL_LAYER_ID, onFeatureHover\)/, "fill hover handler missing");
  assert.match(source, /map\.on\("mousemove", OUTLINE_LAYER_ID, onFeatureHover\)/, "outline hover handler missing");
});

test("map phase3 contract: inspect panel includes area type and office context", () => {
  const source = readSource();
  assert.match(source, /<span>Type<\/span>/, "inspect panel should include geography type row");
  assert.match(source, /<span>Office context<\/span>/, "inspect panel should include office context row");
  assert.match(source, /geographyType: resolutionLabel\(resolution\)/, "map features should capture geography type provenance");
});

