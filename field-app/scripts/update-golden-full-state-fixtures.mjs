import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { GOLDEN_FULL_STATE_FIXTURES } from "../js/core/state/goldenFullStateFixtures.js";
import { buildGoldenSignatures } from "../js/core/state/goldenFullStateHarness.js";

const outPath = resolve(process.cwd(), "js/core/state/goldenFullStateExpected.json");

const signatures = buildGoldenSignatures(GOLDEN_FULL_STATE_FIXTURES);

writeFileSync(outPath, `${JSON.stringify(signatures, null, 2)}\n`, "utf8");
console.log(`golden fixtures updated: ${outPath}`);
console.log(`fixture_count=${Object.keys(signatures).length}`);
