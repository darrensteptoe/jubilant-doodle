#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST_DIR = path.resolve(ROOT, "dist");
const RELEASE_DIR = path.resolve(ROOT, "release");
const DEPLOY_IGNORE_FILE = path.resolve(ROOT, ".deployignore");

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function readDeployIgnore() {
  if (!fs.existsSync(DEPLOY_IGNORE_FILE)) return [];
  const source = fs.readFileSync(DEPLOY_IGNORE_FILE, "utf8");
  return source
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter((line) => line && !line.startsWith("#"));
}

function detectActiveRuntimeBundle(distDir) {
  const assetsDir = path.resolve(distDir, "assets");
  if (!fs.existsSync(assetsDir)) return "";
  const files = fs.readdirSync(assetsDir)
    .filter((name) => /^index-.*\.js$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  return files.length ? `dist/assets/${files[files.length - 1]}` : "";
}

function writePackageReadme(packageDir, activeBundle, exclusions) {
  const lines = [
    "Field App Runtime Package",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Source path: ${ROOT}`,
    `Active runtime bundle: ${activeBundle || "unknown"}`,
    "",
    "Runtime payload:",
    "- dist/",
    "",
    "Excluded from deploy package:",
    ...(exclusions.length ? exclusions.map((row) => `- ${row}`) : ["- (none)"]),
    "",
    "Notes:",
    "- This package is runtime-only and intentionally excludes workspace artifacts.",
    "- Keep working repository history/checkpoints in source, not in deploy artifact.",
  ];
  fs.writeFileSync(path.resolve(packageDir, "README_DEPLOY.txt"), `${lines.join("\n")}\n`);
}

function run() {
  if (!fs.existsSync(DIST_DIR)) {
    process.stderr.write("package-runtime-bundle: missing dist/ directory. Run `npm run build` first.\n");
    process.exit(1);
  }
  fs.mkdirSync(RELEASE_DIR, { recursive: true });

  const stamp = nowStamp();
  const packageDir = path.resolve(RELEASE_DIR, `field-app-40-runtime-${stamp}`);
  const packageDist = path.resolve(packageDir, "dist");
  const exclusions = readDeployIgnore();
  const activeRuntimeBundle = detectActiveRuntimeBundle(DIST_DIR);

  fs.mkdirSync(packageDir, { recursive: true });
  fs.cpSync(DIST_DIR, packageDist, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourcePath: ROOT,
    runtimePackagePath: path.relative(ROOT, packageDir).split(path.sep).join("/"),
    activeRuntimeBundle,
    included: ["dist/**"],
    excludedByPolicy: exclusions,
    notes: [
      "Runtime package includes built static assets only.",
      "Workspace artifacts remain in source and are excluded from deploy package.",
    ],
  };
  fs.writeFileSync(
    path.resolve(packageDir, "DEPLOY_MANIFEST.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writePackageReadme(packageDir, activeRuntimeBundle, exclusions);

  process.stdout.write(`package-runtime-bundle: created ${manifest.runtimePackagePath}\n`);
  process.stdout.write(`package-runtime-bundle: active_runtime_bundle=${activeRuntimeBundle || "unknown"}\n`);
}

run();
