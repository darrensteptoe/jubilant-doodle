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

test("map phase5 contract: inspect panel includes rank/intensity and operational note", () => {
  const source = readSource();
  assert.match(source, /function resolveLegendIntensity\(/, "legend intensity helper must exist");
  assert.match(source, /function buildOperationalNote\(/, "operational note helper must exist");
  assert.match(source, /<span>Relative intensity<\/span>/, "inspect panel should include relative intensity row");
  assert.match(source, /<span>Metric rank<\/span>/, "inspect panel should include metric rank row");
  assert.match(source, /fpe-map-inspect-note/, "inspect panel should include operational note block");
});

test("map phase5 contract: inspect panel includes what\/why\/how field guidance", () => {
  const source = readSource();
  assert.match(source, /What this area represents:/, "inspect panel should include 'what' guidance");
  assert.match(source, /Why it matters:/, "inspect panel should include 'why' guidance");
  assert.match(source, /How to use it:/, "inspect panel should include 'how' guidance");
});

test("map phase5 contract: inspect panel includes office, universe, and split-context fields", () => {
  const source = readSource();
  assert.match(source, /<span>Office context<\/span>/, "inspect panel should include office context row");
  assert.match(source, /<span>Office association<\/span>/, "inspect panel should include office association row");
  assert.match(source, /<span>Organizational layer<\/span>/, "inspect panel should include organizational layer row");
  assert.match(source, /<span>Turf context<\/span>/, "inspect panel should include turf context row");
  assert.match(source, /Universe context:/, "inspect panel should include universe context copy");
  assert.match(source, /Turnout\/Persuasion split context:/, "inspect panel should include turnout/persuasion context copy");
  assert.match(source, /resolveTurnoutPersuasionSplitContext\(/, "split-context resolver should exist");
  assert.match(source, /resolveOrganizationalLayerContext\(/, "organizational-layer resolver should exist");
});

test("map phase5 contract: context mode switcher supports campaign, office, and turf overlays", () => {
  const source = readSource();
  assert.match(source, /const CONTEXT_MODE_SELECT_ID = "v3MapContextMode";/, "context mode select id should exist");
  assert.match(source, /const CONTEXT_MODE_CAMPAIGN = "campaign_footprint";/, "campaign context mode constant should exist");
  assert.match(source, /const CONTEXT_MODE_OFFICE = "office_footprint";/, "office context mode constant should exist");
  assert.match(source, /const CONTEXT_MODE_TURF = "turf_context";/, "turf context mode constant should exist");
  assert.match(source, /Map context mode/, "context mode selector should be rendered");
  assert.match(source, /function resolveOfficeTurfContext\(/, "office/turf context resolver should exist");
  assert.match(source, /function fillExpressionForContextMode\(/, "context mode fill expression helper should exist");
});
