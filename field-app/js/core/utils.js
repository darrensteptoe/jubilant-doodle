// Core utility helpers used by app.js (ESM)

export function clamp(v, lo, hi){
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (lo != null && n < lo) return lo;
  if (hi != null && n > hi) return hi;
  return n;
}

export function safeNum(v){
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function fmtInt(n){
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  // Use locale formatting with no decimals.
  return Math.round(x).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function daysBetween(a, b){
  try{
    const da = (a instanceof Date) ? a : new Date(a);
    const db = (b instanceof Date) ? b : new Date(b);
    const ms = db.getTime() - da.getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.round(ms / 86400000);
  } catch {
    return null;
  }
}

export function downloadJson(obj, filename){
  try{
    const text = JSON.stringify(obj, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

export function readJsonFile(file){
  return new Promise((resolve, reject) => {
    try{
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("read failed"));
      fr.onload = () => {
        try{
          const txt = String(fr.result ?? "");
          resolve(JSON.parse(txt));
        } catch (e){
          reject(e);
        }
      };
      fr.readAsText(file);
    } catch (e){
      reject(e);
    }
  });
}
