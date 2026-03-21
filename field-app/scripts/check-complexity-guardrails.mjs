#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AUDIT_DIR = path.resolve(ROOT, "audit");
const OUTPUT_JSON = path.join(AUDIT_DIR, "complexity-guardrails.json");
const OUTPUT_MD = path.join(AUDIT_DIR, "complexity-guardrails.md");

const THRESHOLDS = Object.freeze({
  fileLinesByCategory: {
    surface: 700,
    bridge: 160,
    selector: 140,
    runtime: 1200,
  },
  functionDecisionPointsWarn: 36,
  functionDecisionMinLines: 40,
  functionLinesWarn: 220,
});

const FILE_EXCEPTIONS = Object.freeze({
  "js/appRuntime.js": "Known orchestration hub in staged shrink path; tracked separately in pruning.",
});

const TARGET_GROUPS = Object.freeze([
  {
    category: "surface",
    baseDir: "js/app/v3/surfaces",
    includeRegex: /\.js$/i,
    excludeRegex: /\.test\.js$/i,
  },
  {
    category: "bridge",
    baseDir: "js/app/v3/bridges",
    includeRegex: /\.js$/i,
    excludeRegex: /\.test\.js$/i,
  },
  {
    category: "selector",
    baseDir: "js/core/selectors",
    includeRegex: /\.js$/i,
    excludeRegex: /(?:\.test\.js|\/index\.js$|\/_core\.js$)/i,
  },
]);

const RUNTIME_FILES = Object.freeze([
  "js/appRuntime.js",
  "js/app/v3/stateBridge.js",
  "js/app/v3/index.js",
]);

function toRel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function listFilesRecursive(baseDirAbs) {
  if (!fs.existsSync(baseDirAbs)) {
    return [];
  }
  const out = [];
  const stack = [baseDirAbs];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
      } else if (entry.isFile()) {
        out.push(nextPath);
      }
    }
  }
  return out.sort((a, b) => String(a).localeCompare(String(b)));
}

function countLines(sourceText) {
  if (!sourceText) return 0;
  return String(sourceText).split(/\r?\n/).length;
}

function matchCount(text, regex) {
  const matches = String(text || "").match(regex);
  return Array.isArray(matches) ? matches.length : 0;
}

function computeDecisionPoints(blockText) {
  const text = String(blockText || "");
  return (
    matchCount(text, /\bif\b/g)
    + matchCount(text, /\bfor\b/g)
    + matchCount(text, /\bwhile\b/g)
    + matchCount(text, /\bcase\b/g)
    + matchCount(text, /\bcatch\b/g)
    + matchCount(text, /\?/g)
    + matchCount(text, /&&/g)
    + matchCount(text, /\|\|/g)
  );
}

function detectFunctions(sourceText) {
  const lines = String(sourceText || "").split(/\r?\n/);
  const rows = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fnDecl = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
    const fnArrow = line.match(
      /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/,
    );
    const fnName = fnDecl?.[1] || fnArrow?.[1] || "";
    if (!fnName) continue;

    let foundBrace = false;
    let depth = 0;
    let endLineIndex = i;
    outer: for (let j = i; j < lines.length; j += 1) {
      const part = lines[j];
      for (let k = 0; k < part.length; k += 1) {
        const ch = part[k];
        if (ch === "{") {
          depth += 1;
          foundBrace = true;
        } else if (ch === "}") {
          depth -= 1;
          if (foundBrace && depth <= 0) {
            endLineIndex = j;
            break outer;
          }
        }
      }
      endLineIndex = j;
    }

    const startLine = i + 1;
    const endLine = endLineIndex + 1;
    const blockText = lines.slice(i, endLineIndex + 1).join("\n");
    const lineCount = Math.max(1, endLine - startLine + 1);
    const decisionPoints = computeDecisionPoints(blockText);
    rows.push({
      name: fnName,
      startLine,
      endLine,
      lineCount,
      decisionPoints,
    });

    i = endLineIndex;
  }

  return rows;
}

function scanFiles() {
  const files = [];

  for (const group of TARGET_GROUPS) {
    const baseAbs = path.resolve(ROOT, group.baseDir);
    const list = listFilesRecursive(baseAbs);
    for (const fileAbs of list) {
      const rel = toRel(fileAbs);
      if (!group.includeRegex.test(rel)) continue;
      if (group.excludeRegex && group.excludeRegex.test(rel)) continue;
      files.push({ category: group.category, relPath: rel, absPath: fileAbs });
    }
  }

  for (const runtimeRel of RUNTIME_FILES) {
    const absPath = path.resolve(ROOT, runtimeRel);
    if (!fs.existsSync(absPath)) continue;
    files.push({
      category: "runtime",
      relPath: runtimeRel,
      absPath,
    });
  }

  const seen = new Set();
  return files.filter((row) => {
    if (seen.has(row.relPath)) return false;
    seen.add(row.relPath);
    return true;
  });
}

function buildReport() {
  const scannedFiles = scanFiles();
  const fileWarnings = [];
  const fileExceptions = [];
  const functionWarnings = [];

  for (const file of scannedFiles) {
    const text = fs.readFileSync(file.absPath, "utf8");
    const lineCount = countLines(text);
    const maxLines = THRESHOLDS.fileLinesByCategory[file.category] || 300;
    const exceptionReason = FILE_EXCEPTIONS[file.relPath] || "";

    if (lineCount > maxLines) {
      if (exceptionReason) {
        fileExceptions.push({
          ...file,
          lineCount,
          maxLines,
          reason: exceptionReason,
        });
      } else {
        fileWarnings.push({
          ...file,
          lineCount,
          maxLines,
        });
      }
    }

    const functions = detectFunctions(text);
    for (const fn of functions) {
      const tooManyLines = fn.lineCount > THRESHOLDS.functionLinesWarn;
      const tooComplex = (
        fn.decisionPoints > THRESHOLDS.functionDecisionPointsWarn
        && fn.lineCount >= THRESHOLDS.functionDecisionMinLines
      );
      if (!tooManyLines && !tooComplex) {
        continue;
      }
      functionWarnings.push({
        ...file,
        functionName: fn.name,
        startLine: fn.startLine,
        endLine: fn.endLine,
        functionLines: fn.lineCount,
        decisionPoints: fn.decisionPoints,
        reasons: {
          lineCount: tooManyLines,
          complexity: tooComplex,
        },
      });
    }
  }

  fileWarnings.sort((a, b) => b.lineCount - a.lineCount || a.relPath.localeCompare(b.relPath));
  fileExceptions.sort((a, b) => b.lineCount - a.lineCount || a.relPath.localeCompare(b.relPath));
  functionWarnings.sort((a, b) => {
    if (b.decisionPoints !== a.decisionPoints) return b.decisionPoints - a.decisionPoints;
    if (b.functionLines !== a.functionLines) return b.functionLines - a.functionLines;
    return a.relPath.localeCompare(b.relPath);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    mode: process.argv.includes("--strict") ? "strict" : "warn",
    thresholds: THRESHOLDS,
    scannedFileCount: scannedFiles.length,
    summary: {
      fileWarnings: fileWarnings.length,
      functionWarnings: functionWarnings.length,
      fileExceptions: fileExceptions.length,
      totalWarnings: fileWarnings.length + functionWarnings.length,
    },
    fileWarnings,
    functionWarnings,
    fileExceptions,
  };

  return payload;
}

function markdownTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [head, rule, ...body].join("\n");
}

function writeReport(payload) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);

  const fileRows = payload.fileWarnings.slice(0, 40).map((row) => [
    row.category,
    `\`${row.relPath}\``,
    String(row.lineCount),
    String(row.maxLines),
  ]);
  const fnRows = payload.functionWarnings.slice(0, 40).map((row) => [
    row.category,
    `\`${row.relPath}:${row.startLine}\``,
    `\`${row.functionName}\``,
    String(row.functionLines),
    String(row.decisionPoints),
    row.reasons.lineCount && row.reasons.complexity
      ? "line+complexity"
      : (row.reasons.lineCount ? "line" : "complexity"),
  ]);
  const exceptionRows = payload.fileExceptions.map((row) => [
    row.category,
    `\`${row.relPath}\``,
    String(row.lineCount),
    String(row.maxLines),
    row.reason,
  ]);

  const md = [
    "# Complexity Guardrail Report",
    "",
    `Generated: ${payload.generatedAt}`,
    `Mode: ${payload.mode}`,
    "",
    "## Thresholds",
    "",
    `- Surface file line warning: > ${THRESHOLDS.fileLinesByCategory.surface}`,
    `- Bridge file line warning: > ${THRESHOLDS.fileLinesByCategory.bridge}`,
    `- Selector file line warning: > ${THRESHOLDS.fileLinesByCategory.selector}`,
    `- Runtime file line warning: > ${THRESHOLDS.fileLinesByCategory.runtime}`,
    `- Function complexity warning: decision points > ${THRESHOLDS.functionDecisionPointsWarn} and lines >= ${THRESHOLDS.functionDecisionMinLines}`,
    `- Function length warning: lines > ${THRESHOLDS.functionLinesWarn}`,
    "",
    "## Summary",
    "",
    `- Files scanned: ${payload.scannedFileCount}`,
    `- File warnings: ${payload.summary.fileWarnings}`,
    `- Function warnings: ${payload.summary.functionWarnings}`,
    `- Exception files: ${payload.summary.fileExceptions}`,
    `- Total warnings: ${payload.summary.totalWarnings}`,
    "",
    "## File Warnings",
    "",
    fileRows.length
      ? markdownTable(["Category", "File", "Lines", "Threshold"], fileRows)
      : "_None_",
    "",
    "## Function Warnings",
    "",
    fnRows.length
      ? markdownTable(["Category", "File:Line", "Function", "Lines", "DecisionPts", "Reason"], fnRows)
      : "_None_",
    "",
    "## Exceptions",
    "",
    exceptionRows.length
      ? markdownTable(["Category", "File", "Lines", "Threshold", "Reason"], exceptionRows)
      : "_None_",
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_MD, `${md}\n`);
}

function main() {
  const strictMode = process.argv.includes("--strict");
  const payload = buildReport();
  writeReport(payload);

  process.stdout.write(
    `complexity-guardrails: files=${payload.scannedFileCount} `
      + `file_warnings=${payload.summary.fileWarnings} `
      + `function_warnings=${payload.summary.functionWarnings} `
      + `exceptions=${payload.summary.fileExceptions}\n`,
  );
  process.stdout.write(`complexity-guardrails: report_json=${toRel(OUTPUT_JSON)}\n`);
  process.stdout.write(`complexity-guardrails: report_md=${toRel(OUTPUT_MD)}\n`);

  if (strictMode && payload.summary.totalWarnings > 0) {
    process.stderr.write("complexity-guardrails: FAIL (strict mode and warnings present)\n");
    process.exit(1);
  }
}

main();
