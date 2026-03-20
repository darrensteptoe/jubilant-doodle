#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function runCommand(cmd, args){
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });
  return {
    pass: result.status === 0,
    code: result.status ?? 1,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

function checkFile(filePath, description){
  return {
    id: `file:${filePath}`,
    description,
    pass: fs.existsSync(path.resolve(filePath)),
  };
}

function readJson(filePath){
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return null;
  try{
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

function checkNoLegacyAlias(){
  const text = fs.readFileSync(path.resolve("js/app/v3/stageRegistry.js"), "utf8");
  return {
    id: "legacy:stage-alias",
    description: "stage registry has no legacy alias fallback",
    pass: !text.includes("legacyStageIds") && !text.includes("getStageByLegacyId"),
  };
}

function checkNoCompatFacades(){
  const blocked = [
    "js/renderIntelChecks.js",
    "js/wireEventsRuntime.js",
    "js/app/wireEvents.js",
  ].filter((file) => fs.existsSync(path.resolve(file)));
  return {
    id: "legacy:compat-facades",
    description: "compatibility facade files removed",
    pass: blocked.length === 0,
    detail: blocked,
  };
}

function commandCheck(id, description, cmd, args){
  const result = runCommand(cmd, args);
  return {
    id,
    description,
    pass: result.pass,
    detail: result.pass ? "" : result.output.slice(-1500),
  };
}

function main(){
  const checks = [];

  // Artifact readiness checks
  checks.push(checkFile("prune/relevance-matrix.csv", "Phase 23 relevance matrix exists"));
  checks.push(checkFile("prune/prune-decisions.md", "Phase 23 prune decisions exist"));
  checks.push(checkFile("contracts/flowContracts.js", "Flow contracts module exists"));
  checks.push(checkFile("contracts/stateContracts.js", "State contracts module exists"));
  checks.push(checkFile("contracts/outputContracts.js", "Output contracts module exists"));
  checks.push(checkFile("contracts/boundaryContracts.js", "Boundary contracts module exists"));
  checks.push(checkFile("diagnostics/diagnosticStore.js", "Diagnostic store module exists"));
  checks.push(checkFile("diagnostics/diagnosticEngine.js", "Diagnostic engine module exists"));
  checks.push(checkFile("diagnostics/diagnosticPanel.js", "Diagnostic panel module exists"));
  checks.push(checkFile("audit/audit-matrix.md", "Audit matrix exists"));
  checks.push(checkFile("audit/controls.csv", "Audit controls exists"));
  checks.push(checkFile("audit/state-lineage.csv", "Audit state lineage exists"));
  checks.push(checkFile("audit/formulas.csv", "Audit formulas exists"));
  checks.push(checkFile("audit/renders.csv", "Audit renders exists"));
  checks.push(checkFile("audit/exports.csv", "Audit exports exists"));

  // Execution gate checks
  checks.push(commandCheck("cmd:check-contracts", "Contracts/diagnostics check passes", "npm", ["run", "check:contracts"]));
  checks.push(commandCheck("cmd:gate-rebuild", "Strict rebuild gate passes", "npm", ["run", "gate:rebuild"]));
  checks.push(commandCheck("cmd:gate-gauntlet", "Release gauntlet suite passes", "npm", ["run", "gate:gauntlet"]));

  const gauntletResults = readJson("audit/gauntlet-results.json");
  const gauntletPass = !!gauntletResults?.pass;
  checks.push({
    id: "gauntlet:json-pass",
    description: "Gauntlet JSON result is pass=true",
    pass: gauntletPass,
  });
  const requiredGauntlets = ["RG-01", "RG-02", "RG-03", "RG-04", "RG-05", "RG-06"];
  const gauntletRows = Array.isArray(gauntletResults?.gauntlets) ? gauntletResults.gauntlets : [];
  for (const id of requiredGauntlets){
    const row = gauntletRows.find((item) => String(item?.id || "") === id);
    checks.push({
      id: `gauntlet:${id}`,
      description: `${id} passes`,
      pass: !!row?.pass,
    });
  }

  // Legacy disconnect checks
  checks.push(checkNoLegacyAlias());
  checks.push(checkNoCompatFacades());

  const pass = checks.every((check) => check.pass);
  const output = {
    generatedAt: new Date().toISOString(),
    pass,
    checks,
  };

  fs.mkdirSync(path.resolve("audit"), { recursive: true });
  fs.writeFileSync(path.resolve("audit/freeze-readiness.json"), `${JSON.stringify(output, null, 2)}\n`);

  for (const check of checks){
    const label = check.pass ? "PASS" : "FAIL";
    process.stdout.write(`${label} ${check.id} - ${check.description}\n`);
  }

  if (!pass){
    process.stderr.write("freeze-gate: FAIL\n");
    process.exit(1);
  }
  process.stdout.write("freeze-gate: PASS\n");
}

main();

