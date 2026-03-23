#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_UI_MARKERS = Object.freeze([
  "Reporting Workflow",
  "Lit Drop tactic",
  "Mail tactic",
  "Channel cost realism",
  "How to read this forecast",
  "How to use trust correctly",
  "How to use benchmark data without fooling yourself",
]);

function toPosixPath(value) {
  return String(value || "").split(path.sep).join("/");
}

function detectActiveRuntimeBundle(distDir) {
  const assetsDir = path.resolve(distDir, "assets");
  if (!fs.existsSync(assetsDir)) return "";
  const files = fs.readdirSync(assetsDir)
    .filter((name) => /^index-.*\.js$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  return files.length ? toPosixPath(path.join("dist", "assets", files[files.length - 1])) : "";
}

function listJsAssets(distDir) {
  const assetsDir = path.resolve(distDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    return [];
  }
  return fs.readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      absolutePath: path.resolve(assetsDir, name),
      relativePath: toPosixPath(path.join("dist", "assets", name)),
    }));
}

export function verifyBuiltArtifact({ root = process.cwd(), requiredMarkers = REQUIRED_UI_MARKERS } = {}) {
  const distDir = path.resolve(root, "dist");
  const activeRuntimeBundle = detectActiveRuntimeBundle(distDir);

  if (!fs.existsSync(distDir)) {
    return {
      ok: false,
      reason: "missing-dist",
      rootPath: toPosixPath(root),
      distPath: toPosixPath(path.relative(root, distDir) || "dist"),
      activeRuntimeBundle,
      assetsChecked: [],
      markerChecks: [],
      requiredMarkers: [...requiredMarkers],
      missingMarkers: [...requiredMarkers],
    };
  }

  const assets = listJsAssets(distDir);
  if (!assets.length) {
    return {
      ok: false,
      reason: "missing-assets",
      rootPath: toPosixPath(root),
      distPath: toPosixPath(path.relative(root, distDir) || "dist"),
      activeRuntimeBundle,
      assetsChecked: [],
      markerChecks: [],
      requiredMarkers: [...requiredMarkers],
      missingMarkers: [...requiredMarkers],
    };
  }

  const fileText = new Map();
  for (const asset of assets) {
    fileText.set(asset.relativePath, fs.readFileSync(asset.absolutePath, "utf8"));
  }

  const markerChecks = [...requiredMarkers].map((marker) => {
    for (const [assetPath, contents] of fileText.entries()) {
      if (contents.includes(marker)) {
        return {
          marker,
          found: true,
          assetPath,
        };
      }
    }
    return {
      marker,
      found: false,
      assetPath: "",
    };
  });

  const missingMarkers = markerChecks.filter((row) => !row.found).map((row) => row.marker);
  return {
    ok: missingMarkers.length === 0,
    reason: missingMarkers.length ? "missing-markers" : "ok",
    rootPath: toPosixPath(root),
    distPath: toPosixPath(path.relative(root, distDir) || "dist"),
    activeRuntimeBundle,
    assetsChecked: assets.map((asset) => asset.relativePath),
    markerChecks,
    requiredMarkers: [...requiredMarkers],
    missingMarkers,
  };
}

function printResult(result) {
  process.stdout.write(`built-artifact-check: dist_path=${result.distPath}\n`);
  process.stdout.write(`built-artifact-check: active_runtime_bundle=${result.activeRuntimeBundle || "unknown"}\n`);
  process.stdout.write("built-artifact-check: assets_checked=\n");
  if (!result.assetsChecked.length) {
    process.stdout.write("- (none)\n");
  } else {
    for (const asset of result.assetsChecked) {
      process.stdout.write(`- ${asset}\n`);
    }
  }

  process.stdout.write("built-artifact-check: required_markers=\n");
  for (const row of result.markerChecks) {
    process.stdout.write(`- ${row.found ? "PASS" : "FAIL"} :: ${row.marker}${row.assetPath ? ` @ ${row.assetPath}` : ""}\n`);
  }
}

function main() {
  const result = verifyBuiltArtifact();
  printResult(result);
  if (!result.ok) {
    const reasonText = result.reason === "missing-dist"
      ? "dist/ directory missing (run `npm run build` first)"
      : result.reason === "missing-assets"
        ? "dist/assets/*.js not found"
        : `required marker(s) missing: ${result.missingMarkers.join(" | ")}`;
    process.stderr.write(`built-artifact-check: FAIL (${reasonText})\n`);
    process.exit(1);
  }
  process.stdout.write("built-artifact-check: PASS\n");
}

const thisFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFilePath && invokedFilePath === thisFilePath) {
  main();
}
