#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { REQUIRED_UI_MARKERS, verifyBuiltArtifact } from "./check-built-artifact.mjs";

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

function listAllAssetFiles(distDir) {
  const assetsDir = path.resolve(distDir, "assets");
  if (!fs.existsSync(assetsDir)) return [];
  return fs.readdirSync(assetsDir)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `dist/assets/${name}`);
}

function writePackageReadme(packageDir, activeBundle, exclusions, verification) {
  const markerLines = (verification?.markerChecks || []).map((row) => {
    const status = row?.found ? "PASS" : "FAIL";
    const marker = clean(row?.marker);
    const assetPath = clean(row?.assetPath);
    return `- ${status}: ${marker}${assetPath ? ` (${assetPath})` : ""}`;
  });
  const lines = [
    "Field App Runtime Package",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Source path: ${ROOT}`,
    `Active runtime bundle: ${activeBundle || "unknown"}`,
    `Build verification: ${verification?.ok ? "PASS" : "FAIL"}`,
    "",
    "Verified built assets:",
    ...((verification?.assetsChecked || []).length
      ? verification.assetsChecked.map((row) => `- ${row}`)
      : ["- (none)"]),
    "",
    "Verified UI markers:",
    ...(markerLines.length ? markerLines : ["- (none)"]),
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
    "",
    "Release verification:",
    "This runtime package was built from the current source and verified against key visible UI markers. If the live app does not show recently added surfaces or wording, the most likely cause is that an older built artifact is still being served.",
    "",
    "Release verification checklist:",
    "- Rebuild the app before packaging.",
    "- Deploy the newest `dist` output, not an older extracted folder.",
    "- Hard refresh the browser after deploy.",
    "- If a feature exists in source but not on screen, verify the built asset and hosting path before assuming the code is missing.",
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
  const artifactVerification = verifyBuiltArtifact({ root: ROOT, requiredMarkers: REQUIRED_UI_MARKERS });
  const activeRuntimeBundle = artifactVerification.activeRuntimeBundle || detectActiveRuntimeBundle(DIST_DIR);
  const includedAssetFiles = listAllAssetFiles(DIST_DIR);

  if (!artifactVerification.ok) {
    process.stderr.write("package-runtime-bundle: built artifact verification failed.\n");
    process.stderr.write(`package-runtime-bundle: reason=${artifactVerification.reason}\n`);
    if (artifactVerification.missingMarkers?.length) {
      process.stderr.write(`package-runtime-bundle: missing_markers=${artifactVerification.missingMarkers.join(" | ")}\n`);
    }
    process.exit(1);
  }

  fs.mkdirSync(packageDir, { recursive: true });
  fs.cpSync(DIST_DIR, packageDist, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourcePath: ROOT,
    runtimePackagePath: path.relative(ROOT, packageDir).split(path.sep).join("/"),
    activeRuntimeBundle,
    includedAssetFiles,
    buildVerification: {
      checkedAt: new Date().toISOString(),
      passed: artifactVerification.ok,
      checkedAssets: artifactVerification.assetsChecked,
      requiredMarkers: artifactVerification.requiredMarkers,
      markerChecks: artifactVerification.markerChecks,
    },
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
  writePackageReadme(packageDir, activeRuntimeBundle, exclusions, artifactVerification);

  process.stdout.write(`package-runtime-bundle: created ${manifest.runtimePackagePath}\n`);
  process.stdout.write(`package-runtime-bundle: active_runtime_bundle=${activeRuntimeBundle || "unknown"}\n`);
  process.stdout.write(`package-runtime-bundle: built_artifact_verification=${artifactVerification.ok ? "PASS" : "FAIL"}\n`);
}

run();
