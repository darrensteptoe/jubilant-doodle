// js/features/operations/io.js
// Operations import/export helpers (JSON + CSV).

import { APP_VERSION, BUILD_ID } from "../../build.js";
import { downloadJson } from "../../utils.js";
import { OPERATIONS_SCHEMA_VERSION, OPERATIONS_STORES } from "./schema.js";
import {
  ensureOperationsDefaults,
  getAll,
  replaceAllStores,
  mergeAllStores,
  putMany,
  clear,
} from "./store.js";

const CSV_COLUMNS = {
  persons: ["id", "name", "office", "region", "role", "active", "createdAt", "updatedAt"],
  pipelineRecords: ["id", "personId", "recruiter", "sourceChannel", "office", "region", "stage", "dropoffReason", "createdAt", "updatedAt"],
  interviews: ["id", "personId", "scheduledAt", "interviewer", "score", "outcome", "notes", "createdAt", "updatedAt"],
  onboardingRecords: ["id", "personId", "docsSubmittedAt", "backgroundStatus", "onboardingStatus", "completedAt", "notes", "createdAt", "updatedAt"],
  trainingRecords: ["id", "personId", "trainingTrack", "sessions", "completionStatus", "completedAt", "notes", "createdAt", "updatedAt"],
  shiftRecords: ["id", "personId", "date", "mode", "startAt", "endAt", "checkInAt", "checkOutAt", "turfId", "attempts", "convos", "supportIds", "office", "createdAt", "updatedAt"],
  turfEvents: ["id", "turfId", "precinct", "county", "date", "assignedTo", "mode", "shiftId", "attempts", "canvassed", "vbms", "createdAt", "updatedAt"],
  forecastConfigs: ["id", "stageConversionDefaults", "stageDurationDefaultsDays", "productivityDefaults", "createdAt", "updatedAt"],
  meta: ["key", "value"],
};

// Keep legacy snapshots importable; new stores are optional and default empty.
const JSON_REQUIRED_STORES = ["persons", "pipelineRecords", "shiftRecords", "turfEvents", "forecastConfigs"];
const OPS_OVERRIDE_MODES = new Set(["baseline", "ramp", "scheduled", "max"]);

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

export function validateOperationsSnapshot(snapshot){
  const errors = [];
  if (!snapshot || typeof snapshot !== "object"){
    return { ok: false, errors: ["Snapshot must be an object."] };
  }
  if (snapshot.type !== "operations-snapshot" && snapshot.type !== "third-wing-snapshot"){
    errors.push("Snapshot type must be operations-snapshot.");
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

/**
 * Operations/Engine seam contract (compileEffectiveInputs output).
 * This is validated before engine consumers use Operations-derived capacity/rate inputs.
 * @typedef {Object} OperationsCapacityInput
 * @property {{ cr:number|null, sr:number|null, tr:number|null }} rates
 * @property {{
 *   orgCount:number|null,
 *   orgHoursPerWeek:number|null,
 *   volunteerMult:number|null,
 *   doorSharePct:number|null,
 *   doorShare:number|null,
 *   doorsPerHour:number|null,
 *   callsPerHour:number|null,
 *   capacityDecay:{
 *     enabled:boolean,
 *     type:string,
 *     weeklyDecayPct:number|null,
 *     floorPctOfBaseline:number|null
 *   }
 * }} capacity
 * @property {{
 *   source:string,
 *   twCapOverrideEnabled:boolean,
 *   twCapOverrideMode:string,
 *   twCapOverrideTargetAttemptsPerWeek:number|null
 * }} meta
 */

function isFiniteNum(v){
  return typeof v === "number" && Number.isFinite(v);
}

function isFiniteOrNull(v){
  return v == null || isFiniteNum(v);
}

function inRange(v, min, max){
  return isFiniteNum(v) && v >= min && v <= max;
}

/**
 * Validate Operations/Engine capacity input seam.
 * @param {unknown} input
 * @returns {{ ok:boolean, errors:string[] }}
 */
export function validateOperationsCapacityInput(input){
  const errors = [];
  if (!input || typeof input !== "object"){
    return { ok: false, errors: ["Operations capacity input must be an object."] };
  }

  const rates = input.rates;
  if (!rates || typeof rates !== "object"){
    errors.push("rates must be an object.");
  } else {
    for (const key of ["cr", "sr", "tr"]){
      const v = rates[key];
      if (!isFiniteOrNull(v) || (v != null && !inRange(v, 0, 1))){
        errors.push(`rates.${key} must be null or a number in [0,1].`);
      }
    }
  }

  const cap = input.capacity;
  if (!cap || typeof cap !== "object"){
    errors.push("capacity must be an object.");
  } else {
    for (const key of ["orgCount", "orgHoursPerWeek", "volunteerMult", "doorsPerHour", "callsPerHour"]){
      const v = cap[key];
      if (!isFiniteOrNull(v) || (v != null && v < 0)){
        errors.push(`capacity.${key} must be null or a number >= 0.`);
      }
    }
    if (!isFiniteOrNull(cap.doorSharePct) || (cap.doorSharePct != null && !inRange(cap.doorSharePct, 0, 100))){
      errors.push("capacity.doorSharePct must be null or a number in [0,100].");
    }
    if (!isFiniteOrNull(cap.doorShare) || (cap.doorShare != null && !inRange(cap.doorShare, 0, 1))){
      errors.push("capacity.doorShare must be null or a number in [0,1].");
    }
    if (isFiniteNum(cap.doorSharePct) && isFiniteNum(cap.doorShare)){
      const expectedPct = cap.doorShare * 100;
      if (Math.abs(expectedPct - cap.doorSharePct) > 0.25){
        errors.push("capacity.doorSharePct and capacity.doorShare are inconsistent.");
      }
    }

    const decay = cap.capacityDecay;
    if (!decay || typeof decay !== "object"){
      errors.push("capacity.capacityDecay must be an object.");
    } else {
      if (typeof decay.enabled !== "boolean"){
        errors.push("capacity.capacityDecay.enabled must be boolean.");
      }
      if (!String(decay.type || "").trim()){
        errors.push("capacity.capacityDecay.type must be a non-empty string.");
      }
      if (!isFiniteOrNull(decay.weeklyDecayPct) || (decay.weeklyDecayPct != null && !inRange(decay.weeklyDecayPct, 0, 1))){
        errors.push("capacity.capacityDecay.weeklyDecayPct must be null or a number in [0,1].");
      }
      if (!isFiniteOrNull(decay.floorPctOfBaseline) || (decay.floorPctOfBaseline != null && !inRange(decay.floorPctOfBaseline, 0, 1))){
        errors.push("capacity.capacityDecay.floorPctOfBaseline must be null or a number in [0,1].");
      }
    }
  }

  const meta = input.meta;
  if (!meta || typeof meta !== "object"){
    errors.push("meta must be an object.");
  } else {
    if (!String(meta.source || "").trim()){
      errors.push("meta.source must be a non-empty string.");
    }
    if (typeof meta.twCapOverrideEnabled !== "boolean"){
      errors.push("meta.twCapOverrideEnabled must be boolean.");
    }
    const mode = String(meta.twCapOverrideMode || "");
    if (!OPS_OVERRIDE_MODES.has(mode)){
      errors.push("meta.twCapOverrideMode must be one of baseline|ramp|scheduled|max.");
    }
    const target = meta.twCapOverrideTargetAttemptsPerWeek;
    if (!isFiniteOrNull(target) || (target != null && target < 0)){
      errors.push("meta.twCapOverrideTargetAttemptsPerWeek must be null or a number >= 0.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function exportOperationsSnapshot({ includeMeta = true } = {}){
  await ensureOperationsDefaults();

  const data = {};
  const stores = includeMeta ? OPERATIONS_STORES : OPERATIONS_STORES.filter((s) => s !== "meta");
  for (const storeName of stores){
    data[storeName] = await getAll(storeName);
  }

  return {
    type: "operations-snapshot",
    schemaVersion: OPERATIONS_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function downloadOperationsSnapshot(filename = "operations-snapshot.json"){
  const snap = await exportOperationsSnapshot({ includeMeta: true });
  downloadJson(snap, filename);
  return { ok: true, filename };
}

export async function importOperationsSnapshot(snapshot, { mode = "replace" } = {}){
  const v = validateOperationsSnapshot(snapshot);
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

// Legacy aliases (backward compatibility with historical naming).
export const validateThirdWingSnapshot = validateOperationsSnapshot;
export const exportThirdWingSnapshot = exportOperationsSnapshot;
export const downloadThirdWingSnapshot = downloadOperationsSnapshot;
export const importThirdWingSnapshot = importOperationsSnapshot;
