// js/hash.js
// Phase 9B — Snapshot Integrity + Hash Verification
//
// Pure module:
// - Accepts a snapshot-like object (typically { modelVersion, scenarioState })
// - Returns a deterministic, order-independent hash string
// - No external libraries, no side effects, no mutation
//
// Hash algorithm: FNV-1a 64-bit over a canonical JSON serialization (sorted keys).
// Collision tolerance: non-cryptographic; intended for accidental drift detection, not adversarial security.

function isPlainObject(v){
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function canonicalize(v){
  if (Array.isArray(v)) return v.map(canonicalize);
  if (!isPlainObject(v)) return v;
  const out = {};
  const keys = Object.keys(v).sort();
  for (const k of keys){
    out[k] = canonicalize(v[k]);
  }
  return out;
}

function stableSerialize(obj){
  // No whitespace, canonical key ordering.
  return JSON.stringify(canonicalize(obj));
}

function utf8Bytes(str){
  const s = String(str ?? "");
  if (typeof TextEncoder !== "undefined"){
    return new TextEncoder().encode(s);
  }
  // Fallback: best-effort (ASCII/Latin1). Good enough for our snapshot keys/values.
  const out = [];
  for (let i = 0; i < s.length; i++){
    out.push(s.charCodeAt(i) & 0xff);
  }
  return out;
}

function fnv1a64Hex(str){
  // 64-bit FNV-1a
  let hash = 14695981039346656037n; // offset basis
  const prime = 1099511628211n;
  const mask = (1n << 64n) - 1n;

  const bytes = utf8Bytes(str);
  for (let i = 0; i < bytes.length; i++){
    hash ^= BigInt(bytes[i]);
    hash = (hash * prime) & mask;
  }

  let hex = hash.toString(16);
  return hex.padStart(16, "0");
}

export function computeSnapshotHash(snapshot){
  // Only hash stable, meaning-bearing content. Do NOT include exportedAt timestamps, UI-only caches, etc.
  const mv = snapshot?.modelVersion ?? "";
  const scen = snapshot?.scenarioState ?? snapshot?.scenario ?? snapshot ?? null;

  const hashInput = {
    modelVersion: mv,
    scenario: scen
  };

  const serialized = stableSerialize(hashInput);
  return fnv1a64Hex(serialized);
}

export const __hashInternals = { canonicalize, stableSerialize, fnv1a64Hex };
