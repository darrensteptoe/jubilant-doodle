// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stageRegistrySource = fs.readFileSync(path.resolve(__dirname, "../stageRegistry.js"), "utf8");
const stageMountSource = fs.readFileSync(path.resolve(__dirname, "../stageMount.js"), "utf8");
const outcomeSurfaceSource = fs.readFileSync(path.resolve(__dirname, "./outcome/index.js"), "utf8");

test("hardening route contract: stage registry maps key routed surfaces", () => {
  assert.match(
    stageRegistrySource,
    /id:\s*"turnout"[\s\S]*?surface:\s*"turnout"/m,
    "turnout stage must map to turnout surface",
  );
  assert.match(
    stageRegistrySource,
    /id:\s*"data"[\s\S]*?surface:\s*"data"/m,
    "data stage must map to data surface",
  );
  assert.match(
    stageRegistrySource,
    /id:\s*"outcome"[\s\S]*?surface:\s*"outcome"/m,
    "outcome stage must map to outcome surface",
  );
});

test("hardening route contract: stage mount wires key routed surfaces to v3 renderers", () => {
  assert.match(
    stageMountSource,
    /import\s*\{\s*renderTurnoutSurface\s*\}\s*from\s*"\.\/surfaces\/turnout\.js";/,
    "stage mount must import turnout v3 surface",
  );
  assert.match(
    stageMountSource,
    /import\s*\{\s*renderDataSurface\s*\}\s*from\s*"\.\/surfaces\/data\/index\.js";/,
    "stage mount must import data v3 surface",
  );
  assert.match(
    stageMountSource,
    /import\s*\{\s*renderOutcomeSurface\s*\}\s*from\s*"\.\/surfaces\/outcome\/index\.js";/,
    "stage mount must import outcome v3 surface",
  );
  assert.match(
    stageMountSource,
    /turnout:\s*renderTurnoutSurface/,
    "stage mount surface map must route turnout to renderTurnoutSurface",
  );
  assert.match(
    stageMountSource,
    /data:\s*renderDataSurface/,
    "stage mount surface map must route data to renderDataSurface",
  );
  assert.match(
    stageMountSource,
    /outcome:\s*renderOutcomeSurface/,
    "stage mount surface map must route outcome to renderOutcomeSurface",
  );
});

test("hardening forecast/trust contract: outcome surface keeps forecast and trust framing cards", () => {
  assert.match(outcomeSurfaceSource, /title:\s*"Forecast"/, "outcome surface must render forecast card");
  assert.match(outcomeSurfaceSource, /title:\s*"Risk flags"/, "outcome surface must render risk flags card");
  assert.match(
    outcomeSurfaceSource,
    /Current warning posture and freshness checks before trusting the forecast\./,
    "outcome surface must preserve trust framing language",
  );
});
