#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const CHECKPOINTS_DIR = join(ROOT, "checkpoints");

const STAGE_LABELS = [
  "District",
  "Reach",
  "Outcome",
  "Turnout",
  "Plan",
  "Scenarios",
  "Decision Log",
  "Controls",
  "Data",
  "Operations pages",
];

function todayIso(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clean(v){
  return String(v == null ? "" : v).trim();
}

function resolveInputPath(pathArg){
  if (pathArg){
    return isAbsolute(pathArg) ? pathArg : resolve(ROOT, pathArg);
  }
  return join(CHECKPOINTS_DIR, `manual_parity_results_${todayIso()}.md`);
}

function classifyStageStatus(value){
  const raw = clean(value).toUpperCase();
  if (!raw) return "pending";
  if (raw.includes("PASS / FAIL")) return "pending";
  if (raw.includes("PASS")) return "pass";
  if (raw.includes("FAIL")) return "fail";
  return "pending";
}

function classifySignoff(value){
  const raw = clean(value).toUpperCase();
  if (!raw) return "pending";
  if (raw.includes("YES / NO")) return "pending";
  if (raw.includes("YES")) return "yes";
  if (raw.includes("NO")) return "no";
  return "pending";
}

function parseStatus(markdown){
  const lines = String(markdown || "").split(/\r?\n/);
  const stage = {};
  for (const label of STAGE_LABELS){
    const line = lines.find((row) => row.startsWith(`- ${label}:`));
    const value = clean(line ? line.split(":").slice(1).join(":") : "");
    stage[label] = {
      raw: value,
      status: classifyStageStatus(value),
    };
  }

  const qaLine = lines.find((row) => row.startsWith("- QA sign-off:"));
  const productLine = lines.find((row) => row.startsWith("- Product sign-off:"));
  const qaRaw = clean(qaLine ? qaLine.split(":").slice(1).join(":") : "");
  const productRaw = clean(productLine ? productLine.split(":").slice(1).join(":") : "");

  const stageRows = Object.values(stage);
  const totalStages = stageRows.length;
  const passStages = stageRows.filter((row) => row.status === "pass").length;
  const failStages = stageRows.filter((row) => row.status === "fail").length;
  const pendingStages = stageRows.filter((row) => row.status === "pending").length;

  const qa = classifySignoff(qaRaw);
  const product = classifySignoff(productRaw);
  const readyForCloseout =
    failStages === 0 &&
    pendingStages === 0 &&
    qa === "yes" &&
    product === "yes";

  return {
    stage,
    summary: {
      totalStages,
      passStages,
      failStages,
      pendingStages,
    },
    signoff: {
      qa: { raw: qaRaw, status: qa },
      product: { raw: productRaw, status: product },
    },
    readyForCloseout,
  };
}

function main(){
  const argv = process.argv.slice(2);
  const strict = argv.includes("--strict");
  const pathArg = argv.find((arg) => !arg.startsWith("--"));
  const filePath = resolveInputPath(pathArg);
  if (!existsSync(filePath)){
    throw new Error(`Manual parity file not found: ${filePath}`);
  }

  const markdown = readFileSync(filePath, "utf8");
  const status = parseStatus(markdown);
  const out = {
    file: filePath,
    ...status,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);

  if (strict && !status.readyForCloseout){
    process.exit(1);
  }
}

try{
  main();
} catch (err){
  const message = err?.message ? String(err.message) : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
