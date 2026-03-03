export function twCapTextModule(el, text){
  if (el) el.textContent = String(text ?? "");
}

export function twCapNumModule(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function twCapFmtIntModule(v, { fmtInt } = {}){
  return (v == null || !Number.isFinite(v)) ? "—" : fmtInt(Math.round(v));
}

export function twCapFmt1Module(v){
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

export function twCapFmtSignedModule(v, { fmtInt } = {}){
  if (v == null || !Number.isFinite(v)) return "—";
  const n = Math.round(v);
  if (n > 0) return `+${fmtInt(n)}`;
  if (n < 0) return `−${fmtInt(Math.abs(n))}`;
  return "0";
}

export function twCapRatioTextModule(numerator, denominator){
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "—";
  return `${(100 * num / den).toFixed(1)}%`;
}

export function twCapFmtPct01Module(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(100 * n).toFixed(1)}%`;
}

export function twCapMedianModule(values){
  const list = (Array.isArray(values) ? values : [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  if (list.length % 2 === 1) return list[mid];
  return (list[mid - 1] + list[mid]) / 2;
}

export function twCapCleanModule(v){
  return String(v == null ? "" : v).trim();
}

export function twCapTransitionKeyModule(from, to){
  const slug = (s) => twCapCleanModule(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${slug(from)}_to_${slug(to)}`;
}

export function twCapParseDateModule(value){
  const s = twCapCleanModule(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const dt = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function twCapWeekStartModule(dt){
  const base = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const day = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - day);
  return base;
}

export function twCapIsoUTCModule(dt){
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
