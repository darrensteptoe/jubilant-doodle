// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), "utf8");
}

test("map phase6 contract: map stage defaults to map doctrine module", () => {
  const source = read("../../../intelligenceRegistry.js");
  assert.match(source, /map:\s*"mapOperationsGuide"/, "map stage should default to map doctrine module");
});

test("map phase6 contract: doctrine registry includes campaign geography map guide", () => {
  const source = read("../../../moduleDoctrineRegistry.js");
  assert.match(source, /id:\s*"mapOperationsGuide"/, "map doctrine id should exist");
  assert.match(source, /title:\s*"Campaign Geography Map"/, "map doctrine title should be present");
  assert.match(source, /public token starting with pk\./, "map doctrine should document pk token requirement");
  assert.match(source, /display-only/, "map doctrine should encode display-only guidance");
});

test("map phase6 contract: controls map config includes admin storage note and refresh behavior copy", () => {
  const source = read("../controls.js");
  assert.match(source, /Admin note/, "controls should include admin note block for map config");
  assert.match(source, /MAPBOX_PUBLIC_TOKEN_STORAGE_KEY/, "controls should disclose app-level storage key");
  assert.match(source, /refresh event/, "controls should explain map refresh event behavior");
});

test("map phase6 contract: diagnostics surfaces include map config status output", () => {
  const builders = read("../../../diagnosticsBuilders.js");
  assert.match(builders, /function mapConfigDiagnosticStatus\(/, "diagnostics should include map config status helper");
  assert.match(builders, /out\.push\("map config:"\)/, "model diagnostics should print map config section");

  const v3Index = read("../../index.js");
  assert.match(v3Index, /mapbox:\s*\{/, "runtime diagnostics snapshot should include mapbox object");
  assert.match(v3Index, /mapbox \$\{mapboxText\}/, "runtime diagnostics line should expose mapbox status");
});

test("map phase6 contract: map legend provenance keeps canon-vs-display trust language", () => {
  const source = read("./index.js");
  assert.match(source, /canonical geography \+ Census map metrics/, "legend provenance should name canonical source");
  assert.match(source, /display-only overlay; canon math unchanged/, "legend provenance should preserve trust boundary");
});

test("map phase6 contract: planning overlay inventory and resolver stay display-only", () => {
  const source = read("./index.js");
  assert.match(source, /const PLANNING_OVERLAY_BY_FAMILY = \{/, "planning overlay inventory should exist");
  assert.match(source, /const DEFAULT_PLANNING_OVERLAY = \{/, "default planning overlay fallback should exist");
  assert.match(source, /turnout_need_context/, "turnout planning overlay id should be present");
  assert.match(source, /persuasion_need_context/, "persuasion planning overlay id should be present");
  assert.match(source, /universe_density_context/, "universe density overlay id should be present");
  assert.match(source, /expected_early_vote_context/, "expected early-vote overlay id should be present");
  assert.match(source, /function resolvePlanningOverlayDescriptor\(/, "planning overlay resolver should exist");
  assert.match(source, /PLANNING_OVERLAY_BY_FAMILY\[family\] \|\| DEFAULT_PLANNING_OVERLAY/, "planning overlay resolver should fallback safely");
  assert.match(source, /display-only overlay/, "planning overlay copy should preserve display-only boundary");
});

test("map phase6 contract: inspect panel includes planning context interpretation lines", () => {
  const source = read("./index.js");
  assert.match(source, /<span>Planning overlay<\/span>/, "inspect panel should include planning overlay row");
  assert.match(source, /<span>Planning provenance<\/span>/, "inspect panel should include planning provenance row");
  assert.match(source, /Planning context:/, "inspect panel should include planning context guidance");
  assert.match(source, /Planning interpretation:/, "inspect panel should include planning interpretation guidance");
  assert.match(source, /Planning view is display-only; canonical planning\/execution math remains unchanged\./, "inspect panel should restate planning display-only boundary");
  assert.match(source, /Expected early-vote context:/, "inspect panel should include early-vote context guidance");
});

test("map phase6 contract: runtime diagnostics include planning overlay provenance", () => {
  const mapSource = read("./index.js");
  assert.match(mapSource, /overlayId:/, "map runtime diagnostics should expose overlay id");
  assert.match(mapSource, /overlayProvenance:/, "map runtime diagnostics should expose overlay provenance");

  const builders = read("../../../diagnosticsBuilders.js");
  assert.match(builders, /planningOverlay:/, "diagnostics output should include planning overlay summary");
});
