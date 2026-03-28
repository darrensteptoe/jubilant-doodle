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
