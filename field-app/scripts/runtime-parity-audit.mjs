#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function resolveRef(ref) {
  const token = String(ref || "").trim();
  if (!token) {
    return "";
  }
  const clean = token.replace(/^\//, "");
  return path.join(DIST_DIR, clean);
}

function findModuleScripts(html) {
  const regex = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
  const out = [];
  let match = regex.exec(html);
  while (match) {
    out.push(String(match[1] || "").trim());
    match = regex.exec(html);
  }
  return out;
}

function parseAssetHash(ref) {
  const token = String(ref || "").trim();
  const fromName = token.match(/-([a-z0-9]{6,})\.js$/i);
  if (fromName && fromName[1]) {
    return String(fromName[1]).trim();
  }
  const fromQuery = token.match(/[?&](?:v|hash|build)=([^&]+)/i);
  if (fromQuery && fromQuery[1]) {
    return String(fromQuery[1]).trim();
  }
  return "";
}

function main() {
  if (!fs.existsSync(DIST_INDEX)) {
    throw new Error(`Missing dist index: ${DIST_INDEX}`);
  }

  const html = read(DIST_INDEX);
  const moduleScripts = findModuleScripts(html);
  const assetScripts = moduleScripts.filter((ref) => ref.includes("/assets/") && ref.endsWith(".js"));
  const selectedRef = assetScripts.find((ref) => /index-[a-z0-9]+\.js$/i.test(ref)) || assetScripts[0] || "";
  const selectedPath = resolveRef(selectedRef);
  const hasSelectedAsset = selectedPath ? fs.existsSync(selectedPath) : false;
  const selectedContent = hasSelectedAsset ? read(selectedPath) : "";

  const report = {
    generatedAt: new Date().toISOString(),
    distIndex: DIST_INDEX,
    moduleScripts,
    assetScripts,
    selectedBundle: {
      ref: selectedRef,
      hashToken: parseAssetHash(selectedRef),
      path: selectedPath,
      exists: hasSelectedAsset,
      bytes: hasSelectedAsset ? Buffer.byteLength(selectedContent, "utf8") : 0,
      sha256: hasSelectedAsset ? sha256(selectedContent) : "",
      containsDistrictV2MountMarker: hasSelectedAsset ? selectedContent.includes("[district_v2] mounted") : false,
      containsRuntimeParityBridge: hasSelectedAsset ? selectedContent.includes("__FPE_RUNTIME_DIAGNOSTICS__") : false,
      containsLegacyPendingWriteSymbol: hasSelectedAsset ? selectedContent.includes("markDistrictPendingWrite") : false,
    },
    htmlChecks: {
      referencesAssetsBundle: assetScripts.length > 0,
      referencesOnlyOneIndexBundle: assetScripts.filter((ref) => /index-[a-z0-9]+\.js$/i.test(ref)).length <= 1,
      containsLegacyQueryBundleRefs: moduleScripts.some((ref) => ref.includes("scope-aggregation-fix")),
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const msg = error?.message ? String(error.message) : String(error || "runtime parity audit failed");
  process.stderr.write(`runtime-parity-audit: FAIL (${msg})\n`);
  process.exit(1);
}
