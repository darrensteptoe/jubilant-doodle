// @ts-check
// Canonical operations date/time helpers.
import { roundWholeNumberByMode } from "../../core/utils.js";

const DAY_MS = 86400000;

function clean(value){
  return String(value == null ? "" : value).trim();
}

export function operationsSlug(value){
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function operationsTransitionKey(from, to){
  return `${operationsSlug(from)}_to_${operationsSlug(to)}`;
}

export function operationsNowIso(){
  return new Date().toISOString();
}

export function operationsTodayIso(){
  return operationsNowIso().slice(0, 10);
}

export function operationsParseIsoDateInput(value){
  const s = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function operationsParseDate(value){
  const s = clean(value);
  if (!s) return null;
  const iso = operationsParseIsoDateInput(s);
  if (iso) return iso;
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function operationsToIsoDateUTC(dt){
  if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return "";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function operationsStartOfWeekUTC(dt){
  const base = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const day = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - day);
  return base;
}

export function operationsAddDaysUTC(dt, days){
  const n = Number(days);
  const span = Number.isFinite(n) ? n : 0;
  return new Date(dt.getTime() + (span * DAY_MS));
}

export function operationsDaysSince(value, { nowMs = Date.now(), floor = true } = {}){
  const dt = operationsParseDate(value);
  if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return null;
  const delta = Number(nowMs) - dt.getTime();
  if (!Number.isFinite(delta) || delta < 0) return 0;
  const raw = delta / DAY_MS;
  return floor ? (roundWholeNumberByMode(raw, { mode: "floor", fallback: 0 }) ?? 0) : raw;
}

export function operationsShiftHours(record){
  const start = operationsParseDate(record?.checkInAt || record?.startAt);
  const end = operationsParseDate(record?.checkOutAt || record?.endAt);
  if (!(start instanceof Date) || !(end instanceof Date)) return 0;
  const span = end.getTime() - start.getTime();
  if (!Number.isFinite(span) || span <= 0) return 0;
  return span / 3600000;
}

export function operationsNonNegativeNumber(value, fallback = 0){
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(fallback) || 0;
  return Math.max(0, n);
}

export function operationsNonNegativeInt(value, fallback = 0){
  const base = operationsNonNegativeNumber(value, fallback);
  const fallbackInt = Number(fallback) || 0;
  return roundWholeNumberByMode(base, { mode: "floor", fallback: fallbackInt }) ?? fallbackInt;
}

export function operationsFiniteNumber(value, fallback = null){
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  if (fallback == null) return null;
  const fb = Number(fallback);
  return Number.isFinite(fb) ? fb : 0;
}

export function operationsClampNumber(value, min, max){
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(min) || 0;
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return n;
  return Math.min(hi, Math.max(lo, n));
}

export function operationsCombineDateAndTimeIso(dateIso, hhmm){
  const d = clean(dateIso);
  const t = clean(hhmm);
  if (!d || !t) return "";
  const dt = new Date(`${d}T${t}`);
  if (!Number.isFinite(dt.getTime())) return "";
  return dt.toISOString();
}

export function operationsLocalTimeFromIso(value){
  const dt = operationsParseDate(value);
  if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return "";
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
