#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const STRICT_WARN_PATTERNS = [
  /MODULE_TYPELESS_PACKAGE_JSON/,
  /\[plugin vite:reporter\]/,
  /Circular chunk:/,
  /^\s*\(!\)\s/m,
];

const STEPS = [
  { label: "canonical-math", cmd: "npm", args: ["run", "check:canonical-math"] },
  { label: "interaction-integrity", cmd: "npm", args: ["run", "check:interaction-integrity"] },
  { label: "interaction-pages", cmd: "npm", args: ["run", "check:interaction-pages"] },
  { label: "district-integrity", cmd: "npm", args: ["run", "check:district-integrity"] },
  { label: "contracts", cmd: "npm", args: ["run", "check:contracts"] },
  { label: "spacing-contract", cmd: "npm", args: ["run", "check:spacing-contract"] },
  { label: "rebuild-contracts", cmd: "node", args: ["js/core/selfTestSuites/rebuildContracts.js"] },
  { label: "targeting-suite", cmd: "node", args: ["js/core/selfTestSuites/targeting.js"] },
  { label: "voter-suite", cmd: "node", args: ["js/core/selfTestSuites/voterDataLayer.js"] },
  { label: "census-suite", cmd: "node", args: ["js/core/selfTestSuites/censusPhase1.js"] },
  { label: "core-selftest", cmd: "node", args: ["js/core/selfTest.js"] },
  { label: "build", cmd: "npm", args: ["run", "build"] },
];

function runStep(step){
  const result = spawnSync(step.cmd, step.args, {
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  process.stdout.write(out);

  if (result.status !== 0){
    throw new Error(`step failed: ${step.label}`);
  }

  for (const pattern of STRICT_WARN_PATTERNS){
    if (pattern.test(out)){
      throw new Error(`strict warning detected in step ${step.label}: ${pattern}`);
    }
  }
}

function main(){
  for (const step of STEPS){
    runStep(step);
  }
  process.stdout.write("\nstrict-gate: PASS\n");
}

try{
  main();
} catch (err){
  const message = err?.message ? String(err.message) : String(err);
  process.stderr.write(`\nstrict-gate: FAIL (${message})\n`);
  process.exit(1);
}
