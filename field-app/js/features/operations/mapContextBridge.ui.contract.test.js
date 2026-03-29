// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function readFromRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("operations map bridge contract: operations hub renders organizer/office worked-map controls", () => {
  const html = readFromRepo("operations.html");
  assert.match(html, /Map worked-geography bridge/, "operations hub should include map bridge panel");
  assert.match(html, /id="mapBridgeOrganizerSelect"/, "operations hub should include organizer bridge selector");
  assert.match(html, /id="btnMapBridgeOrganizer"/, "operations hub should include organizer bridge action");
  assert.match(html, /id="btnMapBridgeOffice"/, "operations hub should include office bridge action");
  assert.match(html, /activity evidence, not assigned turf boundaries/, "bridge copy should remain explicit about worked evidence");
});

test("operations map bridge contract: operations runtime publishes worked-map bridge context before map navigation", () => {
  const source = readFromRepo("js/operations.js");
  assert.match(source, /writeOperationsMapContext/, "operations runtime should write shared map bridge context");
  assert.match(source, /requestedMode:\s*WORKED_ACTIVITY_MODE_ID/, "bridge writes should request worked activity mode");
  assert.match(source, /source:\s*"operations_hub"/, "bridge writes should retain operations_hub provenance");
  assert.match(source, /url\.searchParams\.set\("stage", "map"\)/, "bridge navigation should target map stage");
});
