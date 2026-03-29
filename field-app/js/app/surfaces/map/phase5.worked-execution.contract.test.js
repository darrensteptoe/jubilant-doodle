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

test("map phase5 contract: worked execution summary panel is rendered and synchronized", () => {
  const source = readSource();
  assert.match(source, /const WORKED_SUMMARY_STATUS_ID = "v3MapWorkedSummaryStatus";/, "worked summary status id should exist");
  assert.match(source, /const WORKED_SUMMARY_BODY_ID = "v3MapWorkedSummaryBody";/, "worked summary body id should exist");
  assert.match(source, /Worked execution summary/, "map should render worked execution summary panel");
  assert.match(source, /function syncWorkedExecutionSummary\(/, "worked execution summary sync helper should exist");
  assert.match(source, /buildWorkedExecutionSummaryModel\(/, "worked execution summary should use deterministic summary model helper");
});

test("map phase5 contract: inspect panel includes manager-facing worked activity evidence fields", () => {
  const source = readSource();
  assert.match(source, /<span>Worked activity status<\/span>/, "inspect should include worked activity status row");
  assert.match(source, /<span>Worked activity evidence<\/span>/, "inspect should include worked activity evidence row");
  assert.match(source, /Manager notice:/, "inspect should include manager-facing worked notice copy");
});

test("map phase5 contract: worked mode legend and visual states are explicit and truthful", () => {
  const source = readSource();
  assert.match(source, /WORKED_ACTIVITY_STATE_COLOR_MAP/, "worked mode should define dedicated activity state colors");
  assert.match(source, /workedActivityState/, "worked mode should key visual treatment off worked activity state");
  assert.match(source, /Higher activity concentration/, "worked legend should include higher concentration label");
  assert.match(source, /Recorded activity/, "worked legend should include recorded activity label");
  assert.match(source, /No recorded activity/, "worked legend should include no-activity label");
  assert.match(source, /not assigned turf boundaries/, "worked legend copy should explicitly avoid assignment language");
});

test("map phase5 contract: worked execution summary and inspect use turf-event evidence counts", () => {
  const source = readSource();
  assert.match(source, /workedGeographyOfficeCanvassed:/, "feature props should include office canvassed counts");
  assert.match(source, /workedGeographyOrganizerCanvassed:/, "feature props should include organizer canvassed counts");
  assert.match(source, /workedGeographyOfficeVbms:/, "feature props should include office VBM counts");
  assert.match(source, /workedGeographyOrganizerVbms:/, "feature props should include organizer VBM counts");
  assert.match(source, /touches • .*attempts • .*canvassed • .*VBM/, "summary/inspect should render bounded evidence count line");
});
