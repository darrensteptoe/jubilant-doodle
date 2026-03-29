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

test("map phase4 contract: operations bridge context is read from shared organizer/office context path", () => {
  const source = readSource();
  assert.match(source, /readOperationsMapContext/, "map should import/read operations map bridge context");
  assert.match(source, /operationsMapContextAppliesToScope/, "map should scope-check bridge context");
  assert.match(source, /function resolveWorkedBridgeContext\(/, "map should resolve worked bridge context");
  assert.match(source, /WORKED_ACTIVITY_MODE_ID|worked_activity_context/, "worked mode bridge should be explicit");
});

test("map phase4 contract: worked-geography context supports organizer and office filters", () => {
  const source = readSource();
  assert.match(source, /async function readOperationsExecutionContext\(shellScope,\s*workedBridge = \{\}\)/, "ops context reader should accept worked bridge filters");
  assert.match(source, /organizerId:\s*workedOrganizerId/, "worked index should support organizer filter");
  assert.match(source, /activeOrganizerId:\s*workedOrganizerId/, "ops context should retain active organizer scope");
  assert.match(source, /workedScopeToken:/, "ops context should expose deterministic worked scope token");
});

test("map phase4 contract: worked mode refit and no-data fallback are scope-aware", () => {
  const source = readSource();
  assert.match(source, /contextMode === CONTEXT_MODE_WORKED/, "worked mode branch should remain explicit");
  assert.match(source, /const workedScopeToken = contextMode === CONTEXT_MODE_WORKED/, "worked mode should derive dedicated scope token");
  assert.match(source, /workedScopeChanged/, "worked mode should trigger refit when scope changes without stale bleed");
  assert.match(source, /selected organizer .* has no mapped worked-geography activity evidence/, "worked no-data fallback should be explicit for organizer scope");
  assert.match(source, /fitWorkedScopeFeatures\(/, "worked scope should have dedicated fit helper");
});

test("map phase4 contract: inspect/readout include worked scope ownership context", () => {
  const source = readSource();
  assert.match(source, /<span>Worked scope<\/span>/, "inspect panel should include worked scope row");
  assert.match(source, /<span>Worked scope source<\/span>/, "inspect panel should include worked scope source row");
  assert.match(source, /Worked scope:/, "copied area summary should include worked scope");
});

test("map phase4 contract: map refreshes when operations map-context bridge updates", () => {
  const source = readSource();
  assert.match(source, /OPERATIONS_MAP_CONTEXT_EVENT/, "map should import operations map-context event constant");
  assert.match(source, /window\.addEventListener\(OPERATIONS_MAP_CONTEXT_EVENT,\s*\(\)\s*=>\s*\{\s*void syncMapSurface\(\);\s*\}\);/m, "map should resync when bridge context updates");
});
