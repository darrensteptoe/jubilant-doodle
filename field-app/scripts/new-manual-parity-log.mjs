#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const CHECKPOINTS_DIR = join(ROOT, "checkpoints");
const TEMPLATE_PATH = join(CHECKPOINTS_DIR, "manual_parity_results_TEMPLATE.md");

function todayIso(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function main(){
  if (!existsSync(TEMPLATE_PATH)){
    throw new Error(`Template not found: ${TEMPLATE_PATH}`);
  }
  if (!existsSync(CHECKPOINTS_DIR)){
    mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  }

  const date = process.argv[2] || todayIso();
  const targetPath = join(CHECKPOINTS_DIR, `manual_parity_results_${date}.md`);
  if (existsSync(targetPath)){
    process.stdout.write(`${targetPath}\n`);
    return;
  }

  const template = readFileSync(TEMPLATE_PATH, "utf8");
  writeFileSync(targetPath, template, "utf8");
  process.stdout.write(`${targetPath}\n`);
}

try{
  main();
} catch (err){
  const message = err?.message ? String(err.message) : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
