export function clamp(n, lo, hi){
  if (n == null || Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function safeNum(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function fmtInt(n){
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function daysBetween(a, b){
  if (!(a instanceof Date) || !(b instanceof Date)) return null;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Back-compat: expose clamp() as a global helper for any non-module call sites.
// Does not affect existing imports/exports.
try {
  if (typeof globalThis !== "undefined" && !globalThis.clamp) globalThis.clamp = clamp;
} catch {}
