// @ts-check
// js/importPolicy.js
// Phase 11 — Strict import mode policy (pure)
import { CURRENT_SCHEMA_VERSION } from "./migrate.js";

/**
 * @param {unknown} v
 * @returns {[number, number, number]}
 */
function parseParts(v){
  const s = String(v || "0.0.0");
  const m = s.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [0,0,0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function compareSemver(a, b){
  const A = parseParts(a);
  const B = parseParts(b);
  for (let i=0;i<3;i++){
    if (A[i] < B[i]) return -1;
    if (A[i] > B[i]) return 1;
  }
  return 0;
}

/**
 * @param {{
 *   strictMode?: boolean,
 *   importedSchemaVersion?: string | null,
 *   currentSchemaVersion?: string,
 *   hashMismatch?: boolean
 * }} input
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function checkStrictImportPolicy({ strictMode, importedSchemaVersion, currentSchemaVersion = CURRENT_SCHEMA_VERSION, hashMismatch }){
  const issues = [];
  if (!strictMode) return { ok: true, issues };

  if (importedSchemaVersion && compareSemver(importedSchemaVersion, currentSchemaVersion) > 0){
    issues.push(`Import blocked: snapshot schemaVersion (${importedSchemaVersion}) is newer than this build (${currentSchemaVersion}).`);
  }
  if (hashMismatch){
    issues.push("Import blocked: integrity hash mismatch (exportedHash vs recomputed).");
  }
  return { ok: issues.length === 0, issues };
}
