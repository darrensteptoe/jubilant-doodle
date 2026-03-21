#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findDuplicateFieldOwnership } from "../js/core/state/schema.js";

const ROOT = process.cwd();
const AUDIT_DIR = path.resolve(ROOT, "audit");
const REPORT_JSON_PATH = path.resolve(AUDIT_DIR, "architectural-drift-gate.json");
const REPORT_MD_PATH = path.resolve(AUDIT_DIR, "architectural-drift-gate.md");

const STRICT_SURFACE_FILES = Object.freeze([
  "js/app/v3/surfaces/district/index.js",
  "js/app/v3/surfaces/outcome/index.js",
  "js/app/v3/surfaces/data/index.js",
  "js/app/v3/surfaces/electionData/index.js",
  "js/app/v3/surfaces/warRoom/index.js",
]);

const STRICT_BRIDGE_FILES = Object.freeze([
  "js/app/v3/bridges/districtBridge.js",
  "js/app/v3/bridges/outcomeBridge.js",
]);

const RETIRED_WRAPPER_FILES = Object.freeze([
  "js/app/v3/surfaces/district.js",
  "js/app/v3/surfaces/data.js",
  "js/app/v3/surfaces/outcome.js",
  "js/app/v3/surfaces/electionData.js",
  "js/app/v3/surfaces/decisionLog.js",
]);

const DEPRECATED_WRAPPER_TOKENS = Object.freeze([
  {
    token: "readDistrictBridgeView(",
    retiredOn: "2026-03-21",
    scope: "district bridge aggregate compatibility reader",
  },
  {
    token: "readOutcomeBridgeView(",
    retiredOn: "2026-03-21",
    scope: "outcome bridge aggregate compatibility reader",
  },
]);

const ALLOWED_MIXED_BRIDGE_EXCEPTIONS = Object.freeze([
  {
    file: "js/app/v3/surfaces/warRoom/index.js",
    contains: "api.getView()",
    expiresOn: "2026-06-30",
    reason: "War Room weather/event canonical split bridge remains in staged migration; tracked by wrapper retirement.",
  },
]);

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toIsoDate(nowDate = new Date()) {
  const value = nowDate instanceof Date ? nowDate : new Date(nowDate);
  if (!Number.isFinite(value.getTime())) return "1970-01-01";
  return value.toISOString().slice(0, 10);
}

function rel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function exists(relPath) {
  return fs.existsSync(path.resolve(ROOT, relPath));
}

function readFile(relPath) {
  const abs = path.resolve(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

function listJsFiles(baseRelPath) {
  const baseAbs = path.resolve(ROOT, baseRelPath);
  if (!fs.existsSync(baseAbs)) return [];
  const out = [];
  const stack = [baseAbs];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && next.endsWith(".js")) {
        out.push(next);
      }
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out.map((absPath) => rel(absPath));
}

function findTokenOccurrences(files, token) {
  const out = [];
  for (const file of files) {
    const source = readFile(file);
    if (!source) continue;
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].includes(token)) {
        out.push({ file, line: i + 1, token });
      }
    }
  }
  return out;
}

function findRegexOccurrences(files, regex) {
  const out = [];
  for (const file of files) {
    const source = readFile(file);
    if (!source) continue;
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (regex.test(lines[i])) {
        out.push({ file, line: i + 1, snippet: cleanText(lines[i]) });
      }
    }
  }
  return out;
}

function makeResult(id, description, pass, violations = [], notes = []) {
  return {
    id,
    description,
    pass: !!pass,
    violations: Array.isArray(violations) ? violations : [],
    notes: Array.isArray(notes) ? notes : [],
  };
}

function checkDuplicateFieldOwnership() {
  const duplicates = findDuplicateFieldOwnership();
  const pass = duplicates.length === 0;
  const violations = duplicates.map((row) => ({
    field: row.field,
    domains: row.domains,
  }));
  return makeResult(
    "ownership-duplicate-canonical-field",
    "No canonical field has duplicate ownership.",
    pass,
    violations,
  );
}

function checkDeprecatedWrappers(nowDate = new Date()) {
  const today = toIsoDate(nowDate);
  const jsFiles = listJsFiles("js")
    .filter((file) => !file.endsWith(".test.js"));
  const violations = [];

  for (const item of DEPRECATED_WRAPPER_TOKENS) {
    if (today < item.retiredOn) continue;
    const occurrences = findTokenOccurrences(jsFiles, item.token);
    for (const found of occurrences) {
      violations.push({
        type: "token",
        scope: item.scope,
        retiredOn: item.retiredOn,
        file: found.file,
        line: found.line,
        token: item.token,
      });
    }
  }

  for (const retiredPath of RETIRED_WRAPPER_FILES) {
    if (exists(retiredPath)) {
      violations.push({
        type: "file_exists",
        file: retiredPath,
        reason: "retired wrapper file reintroduced",
      });
    }
  }

  return makeResult(
    "deprecated-wrapper-retirement",
    "Retired wrappers are not used past retirement deadline.",
    violations.length === 0,
    violations,
    [`evaluated_at=${today}`],
  );
}

function checkMixedBridgeDependencies() {
  const files = [
    ...STRICT_SURFACE_FILES,
    ...STRICT_BRIDGE_FILES,
  ];
  const violations = [];

  const notes = [];
  const today = toIsoDate(new Date());

  for (const file of files) {
    const source = readFile(file);
    if (source == null) {
      violations.push({ file, reason: "required file missing from strict drift scope" });
      continue;
    }
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      if (/\bgetView\s*\(/.test(text)) {
        const allowed = ALLOWED_MIXED_BRIDGE_EXCEPTIONS.find((row) => (
          row.file === file
          && text.includes(row.contains)
          && today <= row.expiresOn
        ));
        if (allowed) {
          notes.push(
            `${file}:${i + 1} allowed until ${allowed.expiresOn} (${allowed.reason})`,
          );
          continue;
        }
        violations.push({
          file,
          line: i + 1,
          reason: "mixed bridge aggregate dependency detected (`getView`)",
          snippet: cleanText(text),
        });
      }
      if (/read(?:District|Outcome)BridgeView\s*\(/.test(text)) {
        violations.push({
          file,
          line: i + 1,
          reason: "compatibility aggregate bridge reader detected",
          snippet: cleanText(text),
        });
      }
    }
  }

  return makeResult(
    "mixed-bridge-dependency",
    "Strict rebuilt modules do not depend on mixed aggregate bridge views.",
    violations.length === 0,
    violations,
    notes,
  );
}

function checkControlHydrationFromDerived() {
  const violations = [];
  const outcomeFile = "js/app/v3/surfaces/outcome/index.js";
  const source = readFile(outcomeFile);
  if (source == null) {
    violations.push({ file: outcomeFile, reason: "outcome surface missing" });
  } else {
    if (!/const canonicalView = readOutcomeCanonicalBridgeView\(\);/.test(source)) {
      violations.push({
        file: outcomeFile,
        reason: "missing canonical bridge reader for control hydration",
      });
    }
    if (!/const outcomeControlView = canonicalView;/.test(source)) {
      violations.push({
        file: outcomeFile,
        reason: "controls lane is not pinned to canonical view",
      });
    }
    if (/outcomeControlView\s*=\s*derivedView/.test(source)) {
      violations.push({
        file: outcomeFile,
        reason: "controls lane hydrated from derived view",
      });
    }
  }

  return makeResult(
    "control-hydration-lane",
    "Control hydration in strict rebuilt surfaces is canonical-only.",
    violations.length === 0,
    violations,
  );
}

function checkWritesOutsideActions() {
  const strictFiles = [
    ...STRICT_SURFACE_FILES,
    ...STRICT_BRIDGE_FILES,
  ];
  const violations = [];
  const bannedRegexes = [
    /\bsetState\s*\(/,
    /\bcommitUIUpdate\s*\(/,
    /\bschedulePersist\s*\(/,
    /\bmutateState\s*\(/,
  ];

  for (const file of strictFiles) {
    const source = readFile(file);
    if (source == null) continue;
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      for (const pattern of bannedRegexes) {
        if (pattern.test(text)) {
          violations.push({
            file,
            line: i + 1,
            reason: `write path bypass detected (${pattern})`,
            snippet: cleanText(text),
          });
        }
      }
    }
  }

  const v3Files = listJsFiles("js/app/v3")
    .filter((file) => !file.endsWith(".test.js"));
  const domainAssignmentViolations = findRegexOccurrences(v3Files, /\bdomains\.[A-Za-z0-9_]+\s*=/);
  for (const row of domainAssignmentViolations) {
    violations.push({
      file: row.file,
      line: row.line,
      reason: "direct canonical domain assignment detected outside action modules",
      snippet: row.snippet,
    });
  }

  return makeResult(
    "write-path-actions-only",
    "Strict rebuilt modules write through action/bridge mutation paths only.",
    violations.length === 0,
    violations,
  );
}

function checkSelectorBypassAndRawCacheTruth() {
  const strictFiles = [
    ...STRICT_SURFACE_FILES,
    ...STRICT_BRIDGE_FILES,
  ];
  const violations = [];
  const bannedTokens = [
    "lastRenderCtx",
    "renderCache",
    "bridgeAggregateRows",
  ];

  for (const file of strictFiles) {
    const source = readFile(file);
    if (source == null) continue;
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      for (const token of bannedTokens) {
        if (text.includes(token)) {
          violations.push({
            file,
            line: i + 1,
            reason: `raw cache token detected (${token})`,
            snippet: cleanText(text),
          });
        }
      }
      if (/window\.__FPE_[A-Z0-9_]+/.test(text)) {
        violations.push({
          file,
          line: i + 1,
          reason: "direct runtime bridge-global read detected in strict module",
          snippet: cleanText(text),
        });
      }
    }
  }

  return makeResult(
    "selector-bypass-raw-cache",
    "Strict rebuilt modules do not read raw runtime cache/globals as truth.",
    violations.length === 0,
    violations,
  );
}

function checkFullWidthCenterLayout() {
  const violations = [];

  for (const file of STRICT_SURFACE_FILES) {
    const source = readFile(file);
    if (source == null) {
      violations.push({ file, reason: "strict surface file missing" });
      continue;
    }
    if (!/createCenterStackFrame\(/.test(source)) {
      violations.push({ file, reason: "missing createCenterStackFrame layout contract" });
    }
    if (!/createCenterStackColumn\(/.test(source)) {
      violations.push({ file, reason: "missing createCenterStackColumn layout contract" });
    }
    if (!/createCenterModuleCard\(/.test(source)) {
      violations.push({ file, reason: "missing createCenterModuleCard layout contract" });
    }
    if (/createSurfaceFrame\("two-col"\)/.test(source) || /createSurfaceFrame\("three-col"\)/.test(source)) {
      violations.push({ file, reason: "mixed-width surface frame detected (two-col/three-col)" });
    }
  }

  return makeResult(
    "center-layout-full-width",
    "Strict rebuilt surfaces enforce full-width center module layout contract.",
    violations.length === 0,
    violations,
  );
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# Architectural Drift Gate Report", "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push(`Pass: ${report.pass ? "yes" : "no"}`, "");
  lines.push(`Checks: total=${report.summary.total} pass=${report.summary.pass} fail=${report.summary.fail}`, "");
  lines.push("## Check Results", "");
  lines.push("| Check | Status | Violations |");
  lines.push("| --- | --- | --- |");
  for (const check of report.checks) {
    lines.push(`| \`${check.id}\` | ${check.pass ? "PASS" : "FAIL"} | ${check.violations.length} |`);
  }
  lines.push("");

  const failed = report.checks.filter((row) => !row.pass);
  if (failed.length) {
    lines.push("## Violations", "");
    for (const check of failed) {
      lines.push(`### ${check.id}`, "");
      for (const violation of check.violations) {
        const file = cleanText(violation.file);
        const line = Number(violation.line);
        const location = file ? (line > 0 ? `${file}:${line}` : file) : "";
        const reason = cleanText(violation.reason || violation.token || "violation");
        lines.push(`- ${location ? `\`${location}\`` : ""} ${reason}`.trim());
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeReports(report) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(REPORT_MD_PATH, buildMarkdownReport(report));
}

export function runArchitecturalDriftGate(options = {}) {
  const nowDate = options.nowDate || new Date();
  const checks = [
    checkDuplicateFieldOwnership(),
    checkDeprecatedWrappers(nowDate),
    checkMixedBridgeDependencies(),
    checkControlHydrationFromDerived(),
    checkWritesOutsideActions(),
    checkSelectorBypassAndRawCacheTruth(),
    checkFullWidthCenterLayout(),
  ];
  const passCount = checks.filter((row) => row.pass).length;
  const report = {
    generatedAt: new Date().toISOString(),
    pass: checks.every((row) => row.pass),
    summary: {
      total: checks.length,
      pass: passCount,
      fail: checks.length - passCount,
    },
    checks,
    artifacts: {
      json: rel(REPORT_JSON_PATH),
      markdown: rel(REPORT_MD_PATH),
    },
  };

  if (options.writeReports !== false) {
    writeReports(report);
  }
  return report;
}

function printSummary(report) {
  process.stdout.write(
    `architectural-drift-gate: total=${report.summary.total} pass=${report.summary.pass} fail=${report.summary.fail}\n`,
  );
  process.stdout.write(`architectural-drift-gate: report_json=${report.artifacts.json}\n`);
  process.stdout.write(`architectural-drift-gate: report_md=${report.artifacts.markdown}\n`);
}

function runCli() {
  const report = runArchitecturalDriftGate();
  printSummary(report);
  if (!report.pass) {
    process.stderr.write("architectural-drift-gate: FAIL\n");
    process.exit(1);
  }
}

const THIS_FILE = fileURLToPath(import.meta.url);
const IS_CLI = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(THIS_FILE);

if (IS_CLI) {
  runCli();
}
