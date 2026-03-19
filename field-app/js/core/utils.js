// @ts-check

/**
 * @param {number|null|undefined} n
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(n, lo, hi){
  if (n == null || Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Number() coercion helper for canonical math modules.
 * Unlike safeNum(), empty string becomes 0 (Number semantics).
 *
 * @param {unknown} v
 * @returns {number|null}
 */
export function coerceFiniteNumber(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Clamp helper paired with coerceFiniteNumber().
 *
 * @param {unknown} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clampFiniteNumber(v, lo, hi){
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
export function safeNum(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtInt(n){
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/**
 * @param {unknown} value
 * @param {string=} fallback
 * @returns {string}
 */
export function formatWholeNumber(value, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n).toLocaleString("en-US");
}

/**
 * @param {unknown} value
 * @param {{ mode?: "round" | "ceil" | "floor", fallback?: string }=} options
 * @returns {string}
 */
export function formatWholeNumberByMode(value, options = {}){
  const n = Number(value);
  if (!Number.isFinite(n)) return String(options?.fallback || "—");
  const mode = String(options?.mode || "round");
  const rounded = roundWholeNumberByMode(value, { mode, fallback: null });
  if (rounded == null) return String(options?.fallback || "—");
  return rounded.toLocaleString("en-US");
}

/**
 * @param {unknown} value
 * @param {{ mode?: "round" | "ceil" | "floor", fallback?: number | null }=} options
 * @returns {number|null}
 */
export function roundWholeNumberByMode(value, options = {}){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return options?.fallback == null ? null : Number(options.fallback);
  }
  const mode = String(options?.mode || "round");
  if (mode === "ceil") return Math.ceil(n);
  if (mode === "floor") return Math.floor(n);
  return Math.round(n);
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatFixedNumber(value, digits = 0, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return n.toFixed(places);
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {number|null=} fallback
 * @returns {number|null}
 */
export function roundToDigits(value, digits = 0, fallback = null){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  const scale = 10 ** places;
  if (!Number.isFinite(scale) || scale <= 0) return fallback;
  return Math.round(n * scale) / scale;
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatPercentFromUnit(value, digits = 1, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return `${(n * 100).toFixed(places)}%`;
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatSignedPercentFromUnit(value, digits = 1, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(places)}%`;
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatSignedPointsFromUnit(value, digits = 1, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(places)} pp`;
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatPercentFromPct(value, digits = 1, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return `${n.toFixed(places)}%`;
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatScoreOutOfHundred(value, digits = 1, fallback = "—"){
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return `${n.toFixed(places)}/100`;
}

/**
 * @param {unknown} status
 * @param {unknown} score
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatStatusWithScoreOutOfHundred(status, score, digits = 1, fallback = "—"){
  const rawStatus = String(status == null ? "" : status).trim().toUpperCase();
  const scoreText = formatScoreOutOfHundred(score, digits, "");
  if (!rawStatus && !scoreText) return fallback;
  if (!rawStatus) return scoreText || fallback;
  if (!scoreText) return rawStatus;
  return `${rawStatus} (${scoreText})`;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number|null}
 */
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
