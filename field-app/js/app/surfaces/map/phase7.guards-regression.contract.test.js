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

test("map phase7 contract: execution context mode is available as a display-only overlay", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /const CONTEXT_MODE_EXECUTION = "execution_context";/, "execution context mode constant should exist");
  assert.match(source, /Execution \/ ops context/, "execution context mode option should render in UI");
  assert.match(source, /function resolveExecutionContext\(/, "execution context resolver should exist");
  assert.match(source, /Execution\/ops context:/, "inspect guidance should label execution context explicitly");
});

test("map phase7 contract: execution context reads existing operations snapshot/performance lanes", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /getOperationsMetricsSnapshot\(/, "map should read operations metrics snapshot");
  assert.match(source, /computeOperationsPerformancePaceView\(/, "map should derive organizer pace context from existing ops layer");
  assert.match(source, /executionTaggedCount/, "runtime diagnostics should surface execution-tagged coverage count");
});

test("map phase7 contract: execution mapping uses required ops context lanes", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /Activity coverage:/, "execution coverage mapping should exist");
  assert.match(source, /Progress context:/, "execution progress mapping should exist");
  assert.match(source, /Organizer presence:/, "execution organizer-presence mapping should exist");
  assert.match(source, /Ballot collection \/ VBM context:/, "execution VBM mapping should exist");
});

test("map phase7 contract: inspect panel explicitly separates planning and execution context", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /Planning context:/, "inspect panel should label planning context explicitly");
  assert.match(source, /Planning interpretation:/, "inspect panel should include planning interpretation guidance");
  assert.match(source, /Planning view is display-only; canonical planning\/execution math remains unchanged\./, "inspect panel should preserve planning boundary copy");
  assert.match(source, /Execution\/ops context:/, "inspect panel should label execution context explicitly");
});

test("map phase7 contract: missing ops signals return explicit fallback text", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /no area-level operations coverage signal in current context\./, "coverage fallback should be explicit");
  assert.match(source, /no area-level execution progress signal in current context\./, "progress fallback should be explicit");
  assert.match(source, /no organizer assignment signal in current context\./, "organizer fallback should be explicit");
  assert.match(source, /no area-level VBM signal in current context\./, "VBM fallback should be explicit");
  assert.match(source, /area-level execution signals are not present; use office-level operations surfaces for immediate decisions\./, "execution interpretation fallback should be explicit");
});

test("map phase7 contract: map surface includes trust/provenance and diagnostics status lines", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /const TRUST_STATUS_ID = "v3MapTrustStatus";/, "map should define trust status id");
  assert.match(source, /const DIAGNOSTIC_STATUS_ID = "v3MapDiagnosticStatus";/, "map should define diagnostic status id");
  assert.match(source, /Trust\/provenance guidance appears after map context is ready\./, "map should render trust guidance placeholder");
  assert.match(source, /Diagnostics summary appears after map context is ready\./, "map should render diagnostics guidance placeholder");
  assert.match(source, /function resolveContextTrustStatus\(/, "map should compute context trust status");
  assert.match(source, /function resolveMapDiagnosticStatus\(/, "map should compute inline diagnostics summary");
});

test("map phase7 contract: runtime diagnostics include scope, worked evidence backing, and fallback reason", () => {
  const source = readFromRepo("js/app/v3/surfaces/map/index.js");
  assert.match(source, /function diagnosticFallbackReasonForStatus\(/, "map should compute deterministic fallback reasons");
  assert.match(source, /fallbackReason:\s*cleanText\(fallbackReason\)/, "runtime diagnostics should expose fallback reason text");
  assert.match(source, /scope:\s*\{[\s\S]*scopeLabel:/m, "runtime diagnostics should expose mode/scope details");
  assert.match(source, /hasMatchingActivityEvidence:\s*!!workedExecutionSummary\?\.hasEvidence/, "runtime diagnostics should expose worked evidence backing flag");
  assert.match(source, /ready_worked_no_activity/, "map should classify ready-state worked no-evidence fallback");
  assert.match(source, /ready_office_fallback_campaign/, "map should classify ready-state office fallback");
});

test("map phase7 contract: diagnostics builders print map scope, worked evidence, and fallback reason", () => {
  const diagnostics = readFromRepo("js/app/diagnosticsBuilders.js");
  assert.match(diagnostics, /scope: modeLabel=/, "diagnostics output should include map mode/scope summary");
  assert.match(diagnostics, /workedGeography: source=/, "diagnostics output should include worked geography evidence source");
  assert.match(diagnostics, /fallbackReason:/, "diagnostics output should include explicit fallback reason line");
});

test("map phase7 contract: map manual copy explains worked evidence boundaries and no-recorded meaning", () => {
  const resolver = readFromRepo("js/app/intelligenceResolver.js");
  assert.match(resolver, /No recorded activity means no matching turfEvents evidence was joined for this area in the current scope\./, "manual should explain no-recorded-activity meaning");
  assert.match(resolver, /not an inferred assignment turf map/i, "manual should forbid inferred assignment turf interpretation");
  assert.match(resolver, /Organizer worked view and office worked view share the same evidence model but apply different scope filters/, "manual should distinguish organizer vs office worked view");
});
