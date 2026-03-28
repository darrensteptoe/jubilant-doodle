// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../../..");

function readFromRepo(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("map phase7 contract: boot failure handling distinguishes token and asset failures", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /function classifyMapBootError\(/, "map surface should include boot error classifier");
  assert.match(source, /MAP_STATUS_BOOT_NETWORK_FAILED/, "map surface should include network asset failure status");
  assert.match(source, /Mapbox rejected the configured token during map bootstrap/, "map surface should include explicit token-rejected guidance");
  assert.match(source, /Map runtime assets could not load/, "map surface should include explicit asset-load guidance");
});

test("map phase7 contract: responsive map layout keeps host and inspect panel usable on small screens", () => {
  const css = readFromRepo("styles-fpe-v3.css");
  assert.match(css, /@media \(max-width: 640px\)\s*\{[\s\S]*\.fpe-mapbox-shell,\s*[\s\S]*\.fpe-mapbox-host[\s\S]*min-height: 260px;/m);
  assert.match(css, /@media \(max-width: 640px\)\s*\{[\s\S]*\.fpe-map-inspect-row[\s\S]*flex-direction:\s*column;/m);
});

test("map phase7 contract: mapbox token storage remains app-level and out of scenario schema", () => {
  const schema = readFromRepo("js/core/state/schema.js");
  assert.doesNotMatch(schema, /MAPBOX_PUBLIC_TOKEN|vice\.mapbox\.publicToken/i, "scenario schema must not persist app-level map token state");
});

test("map phase7 contract: client-facing map/config sources contain no exposed sk token", () => {
  const sources = [
    readFromRepo("index.html"),
    readFromRepo("js/app/runtimeConfig.js"),
    readFromRepo("js/app/v3/surfaces/map/index.js"),
    readFromRepo("js/app/v3/surfaces/controls.js"),
  ].join("\n");
  assert.doesNotMatch(sources, /sk\.[A-Za-z0-9_-]{10,}/, "client-facing sources must not include secret-style Mapbox tokens");
});

