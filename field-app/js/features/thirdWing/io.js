// js/features/thirdWing/io.js
// Third Wing import/export helpers (JSON + CSV).

import { APP_VERSION, BUILD_ID } from "../../build.js";
import { downloadJson } from "../../utils.js";
import { THIRD_WING_SCHEMA_VERSION, THIRD_WING_STORES } from "./schema.js";
import {
  ensureThirdWingDefaults,
  getAll,
  replaceAllStores,
  mergeAllStores,
  putMany,
  clear,
} from "./store.js";

const CSV_COLUMNS = {
  persons: ["id", "name", "office", "region", "role", "active", "createdAt", "updatedAt"],
  pipelineRecords: ["id", "personId", "recruiter", "sourceChannel", "office", "region", "stage", "dropoffReason", "createdAt", "updatedAt"],
  shiftRecords: ["id", "personId", "date", "mode", "startAt", "endAt", "checkInAt", "checkOutAt", "turfId", "attempts", "convos", "supportIds", "office", "createdAt", "updatedAt"],
  turfEvents: ["id", "turfId", "precinct", "county", "date", "assignedTo", "mode", "shiftId", "attempts", "canvassed", "vbms", "createdAt", "updatedAt"],
  forecastConfigs: ["id", "stageConversionDefaults", "stageDurationDefaultsDays", "productivityDefaults", "createdAt", "updatedAt"],
  meta: ["key", "value"],
};

const JSON_REQUIRED_STORES = ["persons", "pipelineRecords", "shiftRecords", "turfEvents", "forecastConfigs"];

function escCsv(v){
  const raw = (v == null) ? "" : String(v);
  if (/[",\n\r]/.test(raw)){
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function toPrimitive(raw){
  const v = String(raw ?? "").trim();
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)){
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("[") && v.endsWith("]"))){
    try { return JSON.parse(v); } catch {}
  }
  return v;
}

function parseCsv(text){
  const src = String(text ?? "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++){
    const ch = src[i];
    const nxt = src[i + 1];

    if (inQuotes){
      if (ch === '"' && nxt === '"'){
        cell += '"';
        i++;
      } else if (ch === '"'){
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"'){
      inQuotes = true;
      continue;
    }
    if (ch === ","){
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n"){
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r"){
      continue;
    }
    cell += ch;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => String(c || "").trim() !== ""));
}

export function validateThirdWingSnapshot(snapshot){
  const errors = [];
  if (!snapshot || typeof snapshot !== "object"){
    return { ok: false, errors: ["Snapshot must be an object."] };
  }
  if (snapshot.type !== "third-wing-snapshot"){
    errors.push("Snapshot type must be third-wing-snapshot.");
  }
  if (!snapshot.schemaVersion){
    errors.push("Snapshot missing schemaVersion.");
  }
  if (!snapshot.data || typeof snapshot.data !== "object"){
    errors.push("Snapshot missing data object.");
  } else {
    for (const storeName of JSON_REQUIRED_STORES){
      if (!Array.isArray(snapshot.data[storeName])){
        errors.push(`Snapshot data.${storeName} must be an array.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function exportThirdWingSnapshot({ includeMeta = true } = {}){
  await ensureThirdWingDefaults();

  const data = {};
  const stores = includeMeta ? THIRD_WING_STORES : THIRD_WING_STORES.filter((s) => s !== "meta");
  for (const storeName of stores){
    data[storeName] = await getAll(storeName);
  }

  return {
    type: "third-wing-snapshot",
    schemaVersion: THIRD_WING_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function downloadThirdWingSnapshot(filename = "third-wing-snapshot.json"){
  const snap = await exportThirdWingSnapshot({ includeMeta: true });
  downloadJson(snap, filename);
  return { ok: true, filename };
}

export async function importThirdWingSnapshot(snapshot, { mode = "replace" } = {}){
  const v = validateThirdWingSnapshot(snapshot);
  if (!v.ok){
    throw new Error(v.errors.join(" "));
  }

  const payload = snapshot.data || {};
  if (mode === "replace"){
    await replaceAllStores(payload);
  } else {
    await mergeAllStores(payload);
  }

  return { ok: true, mode };
}

export function recordsToCsv(storeName, records){
  const cols = CSV_COLUMNS[storeName];
  if (!cols){
    throw new Error(`CSV mapping not defined for store: ${storeName}`);
  }

  const rows = Array.isArray(records) ? records : [];
  const lines = [];
  lines.push(cols.map(escCsv).join(","));
  for (const rec of rows){
    const line = cols.map((k) => {
      const v = rec?.[k];
      if (v && typeof v === "object"){
        return escCsv(JSON.stringify(v));
      }
      return escCsv(v);
    }).join(",");
    lines.push(line);
  }
  return lines.join("\n");
}

export async function exportStoreCsv(storeName){
  const rows = await getAll(storeName);
  return recordsToCsv(storeName, rows);
}

export async function downloadStoreCsv(storeName, filename){
  const csv = await exportStoreCsv(storeName);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${storeName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, storeName };
}

export function csvToRecords(storeName, csvText){
  const cols = CSV_COLUMNS[storeName];
  if (!cols){
    throw new Error(`CSV mapping not defined for store: ${storeName}`);
  }
  const rows = parseCsv(csvText);
  if (!rows.length) return [];

  const header = rows[0].map((s) => String(s || "").trim());
  const colMap = header.map((h) => cols.indexOf(h));
  const out = [];
  for (let i = 1; i < rows.length; i++){
    const cells = rows[i];
    const rec = {};
    for (let c = 0; c < colMap.length; c++){
      const idx = colMap[c];
      if (idx < 0) continue;
      const key = cols[idx];
      rec[key] = toPrimitive(cells[c]);
    }
    out.push(rec);
  }
  return out;
}

export async function importStoreCsv(storeName, csvText, { mode = "merge" } = {}){
  const rows = csvToRecords(storeName, csvText);
  if (mode === "replace"){
    await clear(storeName);
  }
  await putMany(storeName, rows);
  return { ok: true, mode, count: rows.length };
}
