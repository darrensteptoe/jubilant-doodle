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

export function downloadJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "scenario.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file){
  const text = await file.text();
  try { return JSON.parse(text); } catch { return null; }
}

// Back-compat: expose clamp() as a global helper for any non-module call sites.
// Does not affect existing imports/exports.
try {
  if (typeof globalThis !== "undefined" && !globalThis.clamp) globalThis.clamp = clamp;
} catch {}
