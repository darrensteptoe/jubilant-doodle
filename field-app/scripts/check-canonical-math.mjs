#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const JS_ROOT = join(ROOT, "js");

const IGNORE_PREFIXES = [
  "js/core/",
  "js/features/",
  "js/selfTest.js",
  "js/selfTestSuites/",
];

const FORBIDDEN_PATTERNS = [
  { id: "Math.round(", re: /\bMath\.round\s*\(/g },
  { id: "Math.floor(", re: /\bMath\.floor\s*\(/g },
  { id: "Math.ceil(", re: /\bMath\.ceil\s*\(/g },
  { id: ".toFixed(", re: /\.toFixed\s*\(/g },
];

function walk(dir, out = []){
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries){
    const full = join(dir, entry.name);
    if (entry.isDirectory()){
      walk(full, out);
      continue;
    }
    if (entry.isFile() && extname(entry.name) === ".js"){
      out.push(full);
    }
  }
  return out;
}

function ignored(relPath){
  return IGNORE_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function scanFile(fullPath, relPath){
  const source = readFileSync(fullPath, "utf8");
  const lines = source.split(/\r?\n/);
  const findings = [];
  for (let idx = 0; idx < lines.length; idx += 1){
    const line = lines[idx];
    for (const pattern of FORBIDDEN_PATTERNS){
      if (pattern.re.test(line)){
        findings.push({ relPath, line: idx + 1, pattern: pattern.id, text: line.trim() });
      }
      pattern.re.lastIndex = 0;
    }
  }
  return findings;
}

function main(){
  const isJsRoot = statSync(JS_ROOT, { throwIfNoEntry: false })?.isDirectory?.() || false;
  if (!isJsRoot){
    console.error(`Missing js root: ${JS_ROOT}`);
    process.exit(1);
  }

  const files = walk(JS_ROOT);
  const findings = [];
  for (const fullPath of files){
    const relPath = relative(ROOT, fullPath).replace(/\\/g, "/");
    if (ignored(relPath)) continue;
    findings.push(...scanFile(fullPath, relPath));
  }

  if (!findings.length){
    console.log("canonical-math-check: ok");
    process.exit(0);
  }

  console.error("canonical-math-check: violations detected");
  for (const finding of findings){
    console.error(`${finding.relPath}:${finding.line} [${finding.pattern}] ${finding.text}`);
  }
  process.exit(1);
}

main();
