// @ts-check
// js/features/operations/store.js
// IndexedDB store for Operations records.

import {
  OPERATIONS_DB_NAME,
  OPERATIONS_DB_VERSION,
  OPERATIONS_STORES,
  SCOPED_OPERATIONS_STORES,
  OPERATIONS_STORE_DEFS,
  PIPELINE_STAGES,
  DEFAULT_FORECAST_CONFIG,
} from "./schema.js";
import {
  DEFAULT_CAMPAIGN_ID,
  normalizeCampaignId,
  normalizeOfficeId,
  resolveActiveContext,
} from "../../app/activeContext.js";
import { normalizePersonWorkforceFields } from "./workforce.js";

let dbPromise = null;
const OPERATIONS_DATA_REV_KEY = "fpe_operations_data_rev_v1";
let inMemoryRevision = 0;
const SCOPED_STORES = new Set(SCOPED_OPERATIONS_STORES);

function parseRevision(raw){
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function readRevision(){
  try{
    if (typeof localStorage !== "undefined"){
      const fromStorage = parseRevision(localStorage.getItem(OPERATIONS_DATA_REV_KEY));
      if (fromStorage > inMemoryRevision) inMemoryRevision = fromStorage;
    }
  } catch {
    // ignore localStorage access issues
  }
  return inMemoryRevision;
}

function writeRevision(next){
  const val = parseRevision(next);
  inMemoryRevision = val;
  try{
    if (typeof localStorage !== "undefined"){
      localStorage.setItem(OPERATIONS_DATA_REV_KEY, String(val));
    }
  } catch {
    // ignore localStorage access issues
  }
  return val;
}

function bumpOperationsDataRevision(){
  const cur = readRevision();
  return writeRevision(cur + 1);
}

function requireIndexedDb(){
  if (typeof indexedDB === "undefined"){
    throw new Error("IndexedDB is not available in this environment.");
  }
}

function requestToPromise(req){
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed."));
  });
}

function runInTransaction(storeNames, mode, worker){
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  return openOperationsDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode);
    const stores = {};
    for (const name of names){
      stores[name] = tx.objectStore(name);
    }

    let done = false;
    let workerResult;
    const settleErr = (err) => {
      if (done) return;
      done = true;
      reject(err);
    };

    Promise.resolve()
      .then(() => worker(stores, tx))
      .then((result) => {
        workerResult = result;
      })
      .catch((err) => {
        try { tx.abort(); } catch {}
        settleErr(err);
      });

    tx.oncomplete = () => {
      if (done) return;
      done = true;
      resolve(workerResult);
    };
    tx.onabort = () => {
      settleErr(tx.error || new Error("IndexedDB transaction aborted."));
    };
    tx.onerror = () => {
      // handled by onabort/oncomplete
    };
  }));
}

function assertStoreName(storeName){
  if (!OPERATIONS_STORES.includes(storeName)){
    throw new Error(`Unknown Operations store: ${String(storeName)}`);
  }
}

function nowIso(){
  return new Date().toISOString();
}

export function makeOperationsId(prefix = "tw"){
  if (typeof crypto !== "undefined" && crypto.randomUUID){
    return `${prefix}_${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(16).slice(2, 10);
  const stamp = Date.now().toString(16);
  return `${prefix}_${stamp}_${rand}`;
}

function clean(value){
  return String(value == null ? "" : value).trim();
}

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStoreScoped(storeName){
  return SCOPED_STORES.has(storeName);
}

function normalizeStoreContext(context){
  const src = isObject(context) ? context : {};
  return resolveActiveContext({
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    officeId: src.officeId,
    scenarioId: src.scenarioId,
    search: src.search,
    fallback: src.fallback,
  });
}

function resolveStoreContext(options = {}, fallback = {}){
  const src = isObject(options) ? options : {};
  const fb = isObject(fallback) ? fallback : {};
  return normalizeStoreContext({
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    officeId: src.officeId,
    scenarioId: src.scenarioId,
    search: src.search,
    fallback: {
      campaignId: src.campaignId || fb.campaignId,
      campaignName: src.campaignName || fb.campaignName,
      officeId: src.officeId || fb.officeId || fb.office,
      scenarioId: src.scenarioId || fb.scenarioId,
    },
  });
}

function normalizeRecordCampaignId(record, context){
  return normalizeCampaignId(record?.campaignId || record?.campaign || context?.campaignId, DEFAULT_CAMPAIGN_ID);
}

function normalizeRecordOfficeId(record, context){
  return normalizeOfficeId(record?.officeId || record?.office || context?.officeId, "");
}

function toScopeToken(officeId){
  return clean(officeId) || "all";
}

function forecastConfigScopedId(baseId, context){
  const root = clean(baseId) || "default";
  const campaignId = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  const officeId = normalizeOfficeId(context?.officeId, "");
  return `${root}::${campaignId}::${toScopeToken(officeId)}`;
}

function forecastBaseId(value){
  const raw = clean(value) || "default";
  const cut = raw.indexOf("::");
  if (cut < 0) return raw;
  return clean(raw.slice(0, cut)) || "default";
}

function applyScopedFields(storeName, rec, context){
  if (!isStoreScoped(storeName)) return rec;
  const scoped = { ...rec };
  scoped.campaignId = normalizeRecordCampaignId(scoped, context);
  scoped.officeId = normalizeRecordOfficeId(scoped, context);
  if (!clean(scoped.office) && clean(scoped.officeId)){
    scoped.office = scoped.officeId;
  }
  if (storeName === "forecastConfigs"){
    const baseId = forecastBaseId(scoped.baseId || scoped.id || "default");
    scoped.baseId = baseId;
    scoped.id = forecastConfigScopedId(baseId, scoped);
  }
  return scoped;
}

function isScopedMatch(storeName, record, context, { includeCampaignDefaults = false } = {}){
  if (!isStoreScoped(storeName)) return true;
  const cid = normalizeRecordCampaignId(record, context);
  const contextCampaign = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  if (cid !== contextCampaign) return false;

  const contextOffice = normalizeOfficeId(context?.officeId, "");
  if (!contextOffice) return true;

  const rid = normalizeRecordOfficeId(record, context);
  if (rid === contextOffice) return true;
  if (includeCampaignDefaults && !rid) return true;
  return false;
}

function filterRowsByScope(storeName, rows, context){
  const list = Array.isArray(rows) ? rows : [];
  if (!isStoreScoped(storeName)) return list;
  const includeCampaignDefaults = storeName === "forecastConfigs";
  return list.filter((row) => isScopedMatch(storeName, row, context, { includeCampaignDefaults }));
}

async function getRowsForContext(store, storeName, context){
  if (!isStoreScoped(storeName)) return requestToPromise(store.getAll());
  try{
    const idx = store.index("campaignId");
    const rows = await requestToPromise(idx.getAll(normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID)));
    return filterRowsByScope(storeName, rows, context);
  } catch {
    const rows = await requestToPromise(store.getAll());
    return filterRowsByScope(storeName, rows, context);
  }
}

async function clearRowsForContext(store, storeName, context){
  if (!isStoreScoped(storeName)){
    if (storeName === "meta") return;
    store.clear();
    return;
  }
  const rows = await getRowsForContext(store, storeName, context);
  const keyPath = store.keyPath;
  for (const row of rows){
    if (typeof keyPath === "string" && keyPath){
      store.delete(row?.[keyPath]);
    }
  }
}

function sanitizeRecord(storeName, input, context){
  const rec = (input && typeof input === "object") ? { ...input } : {};
  const stamp = nowIso();

  if (storeName === "meta"){
    if (!rec.key) rec.key = makeOperationsId("meta");
    return rec;
  }

  const idPrefix = {
    persons: "per",
    pipelineRecords: "pipe",
    interviews: "iv",
    onboardingRecords: "onb",
    trainingRecords: "trn",
    shiftRecords: "shift",
    turfEvents: "turf",
    forecastConfigs: "fc",
  }[storeName] || "tw";

  if (!rec.id) rec.id = makeOperationsId(idPrefix);
  if (!rec.createdAt) rec.createdAt = stamp;
  rec.updatedAt = stamp;

  if (storeName === "persons"){
    const normalized = normalizePersonWorkforceFields(rec);
    rec.roleType = normalized.roleType;
    rec.compensationType = normalized.compensationType;
    rec.payRate = normalized.payRate;
    rec.expectedHoursPerWeek = normalized.expectedHoursPerWeek;
    rec.supervisorId = normalized.supervisorId;
    rec.role = normalized.role;
    rec.active = normalized.active;
  }
  if (storeName === "pipelineRecords"){
    if (!PIPELINE_STAGES.includes(rec.stage)){
      rec.stage = PIPELINE_STAGES[0];
    }
  }
  if (storeName === "interviews"){
    if (!rec.outcome) rec.outcome = "pending";
  }
  if (storeName === "onboardingRecords"){
    if (!rec.backgroundStatus) rec.backgroundStatus = "pending";
    if (!rec.onboardingStatus) rec.onboardingStatus = "in_progress";
  }
  if (storeName === "trainingRecords"){
    if (!rec.completionStatus) rec.completionStatus = "not_started";
    const sessions = Number(rec.sessions);
    rec.sessions = Number.isFinite(sessions) && sessions > 0 ? Math.round(sessions) : 0;
  }

  return applyScopedFields(storeName, rec, context || {});
}

export function openOperationsDb(){
  requireIndexedDb();
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(OPERATIONS_DB_NAME, OPERATIONS_DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeName of OPERATIONS_STORES){
        const def = OPERATIONS_STORE_DEFS[storeName];
        if (!def) continue;

        let store = null;
        if (!db.objectStoreNames.contains(storeName)){
          store = db.createObjectStore(storeName, { keyPath: def.keyPath });
        } else {
          store = req.transaction.objectStore(storeName);
        }

        for (const idx of def.indexes || []){
          if (!store.indexNames.contains(idx.name)){
            store.createIndex(idx.name, idx.keyPath, idx.options || { unique: false });
          }
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Could not open Operations IndexedDB."));
  });

  return dbPromise;
}

export async function closeOperationsDb(){
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export async function ensureOperationsDefaults(options = {}){
  const context = resolveStoreContext(options);
  const scopedDefaultId = forecastConfigScopedId(DEFAULT_FORECAST_CONFIG.baseId || DEFAULT_FORECAST_CONFIG.id || "default", context);
  const result = await runInTransaction(["forecastConfigs"], "readwrite", async (stores) => {
    let existing = await requestToPromise(stores.forecastConfigs.get(scopedDefaultId));
    if (!existing && !context.officeId && context.campaignSource === "default"){
      existing = await requestToPromise(stores.forecastConfigs.get("default"));
    }
    let inserted = false;
    if (!existing){
      stores.forecastConfigs.put(sanitizeRecord("forecastConfigs", DEFAULT_FORECAST_CONFIG, context));
      inserted = true;
    }
    return { inserted };
  });
  if (result?.inserted) bumpOperationsDataRevision();
}

export async function getAll(storeName, options = {}){
  assertStoreName(storeName);
  const scope = isObject(options) ? options : {};
  if (scope.scope === "all"){
    return runInTransaction([storeName], "readonly", async (stores) => requestToPromise(stores[storeName].getAll()));
  }
  const context = resolveStoreContext(scope);
  return runInTransaction([storeName], "readonly", async (stores) => {
    return getRowsForContext(stores[storeName], storeName, context);
  });
}

export async function getById(storeName, id, options = {}){
  assertStoreName(storeName);
  const scope = isObject(options) ? options : {};
  const context = resolveStoreContext(scope);
  const key = clean(id);
  return runInTransaction([storeName], "readonly", async (stores) => {
    if (scope.scope === "all" || !isStoreScoped(storeName)){
      return requestToPromise(stores[storeName].get(key));
    }
    if (storeName === "forecastConfigs"){
      const baseId = key || "default";
      const scopedId = forecastConfigScopedId(baseId, context);
      let row = await requestToPromise(stores[storeName].get(scopedId));
      if (!row && context.officeId){
        const campaignDefaultId = forecastConfigScopedId(baseId, { ...context, officeId: "" });
        row = await requestToPromise(stores[storeName].get(campaignDefaultId));
      }
      if (!row && !context.officeId && context.campaignSource === "default"){
        row = await requestToPromise(stores[storeName].get(baseId));
      }
      return row || null;
    }
    const row = await requestToPromise(stores[storeName].get(key));
    if (!row) return null;
    return isScopedMatch(storeName, row, context) ? row : null;
  });
}

export async function getByIndex(storeName, indexName, key, options = {}){
  assertStoreName(storeName);
  const scope = isObject(options) ? options : {};
  const context = resolveStoreContext(scope);
  return runInTransaction([storeName], "readonly", async (stores) => {
    const idx = stores[storeName].index(indexName);
    const rows = await requestToPromise(idx.getAll(key));
    if (scope.scope === "all" || !isStoreScoped(storeName)) return rows;
    return filterRowsByScope(storeName, rows, context);
  });
}

export async function put(storeName, record, options = {}){
  assertStoreName(storeName);
  const context = resolveStoreContext(options, record);
  const next = sanitizeRecord(storeName, record, context);
  const out = await runInTransaction([storeName], "readwrite", async (stores) => {
    stores[storeName].put(next);
    return next;
  });
  bumpOperationsDataRevision();
  return out;
}

export async function putMany(storeName, records, options = {}){
  assertStoreName(storeName);
  const context = resolveStoreContext(options);
  const list = Array.isArray(records) ? records : [];
  const next = list.map((r) => sanitizeRecord(storeName, r, context));
  const out = await runInTransaction([storeName], "readwrite", async (stores) => {
    for (const rec of next){
      stores[storeName].put(rec);
    }
    return { count: next.length };
  });
  if (next.length > 0) bumpOperationsDataRevision();
  return out;
}

export async function remove(storeName, id, options = {}){
  assertStoreName(storeName);
  const scope = isObject(options) ? options : {};
  const context = resolveStoreContext(scope);
  const key = clean(id);
  const out = await runInTransaction([storeName], "readwrite", async (stores) => {
    if (scope.scope === "all" || !isStoreScoped(storeName)){
      stores[storeName].delete(key);
      return { ok: true };
    }
    if (storeName === "forecastConfigs"){
      const scopedId = forecastConfigScopedId(key || "default", context);
      stores[storeName].delete(scopedId);
      if (context.officeId){
        const campaignDefaultId = forecastConfigScopedId(key || "default", { ...context, officeId: "" });
        stores[storeName].delete(campaignDefaultId);
      }
      return { ok: true };
    }
    const existing = await requestToPromise(stores[storeName].get(key));
    if (existing && isScopedMatch(storeName, existing, context)){
      stores[storeName].delete(key);
    }
    return { ok: true };
  });
  bumpOperationsDataRevision();
  return out;
}

export async function clear(storeName, options = {}){
  assertStoreName(storeName);
  const scope = isObject(options) ? options : {};
  const context = resolveStoreContext(scope);
  const out = await runInTransaction([storeName], "readwrite", async (stores) => {
    if (scope.scope === "all"){
      stores[storeName].clear();
      return { ok: true };
    }
    await clearRowsForContext(stores[storeName], storeName, context);
    return { ok: true };
  });
  bumpOperationsDataRevision();
  return out;
}

export async function clearAllStores(options = {}){
  const scope = isObject(options) ? options : {};
  const context = resolveStoreContext(scope);
  const clearable = OPERATIONS_STORES.slice();
  const out = await runInTransaction(clearable, "readwrite", async (stores) => {
    for (const name of clearable){
      if (scope.scope === "all"){
        stores[name].clear();
      } else {
        await clearRowsForContext(stores[name], name, context);
      }
    }
    return { ok: true };
  });
  bumpOperationsDataRevision();
  return out;
}

export async function replaceAllStores(dataByStore, options = {}){
  const scope = isObject(options) ? options : {};
  const context = resolveStoreContext(scope);
  const payload = (dataByStore && typeof dataByStore === "object") ? dataByStore : {};
  const out = await runInTransaction(OPERATIONS_STORES, "readwrite", async (stores) => {
    for (const name of OPERATIONS_STORES){
      if (scope.scope === "all"){
        stores[name].clear();
      } else {
        await clearRowsForContext(stores[name], name, context);
      }
      const rows = Array.isArray(payload[name]) ? payload[name] : [];
      for (const rec of rows){
        stores[name].put(sanitizeRecord(name, rec, context));
      }
    }
    return { ok: true };
  });
  bumpOperationsDataRevision();
  return out;
}

export async function mergeAllStores(dataByStore, options = {}){
  const context = resolveStoreContext(options);
  const payload = (dataByStore && typeof dataByStore === "object") ? dataByStore : {};
  const out = await runInTransaction(OPERATIONS_STORES, "readwrite", async (stores) => {
    for (const name of OPERATIONS_STORES){
      const rows = Array.isArray(payload[name]) ? payload[name] : [];
      for (const rec of rows){
        stores[name].put(sanitizeRecord(name, rec, context));
      }
    }
    return { ok: true };
  });
  bumpOperationsDataRevision();
  return out;
}

export async function getSummaryCounts(options = {}){
  const result = {};
  for (const name of OPERATIONS_STORES){
    result[name] = (await getAll(name, options)).length;
  }
  return result;
}

export function getOperationsDataRevision(){
  return readRevision();
}

// Legacy aliases (backward compatibility with historical naming).
export const openThirdWingDb = openOperationsDb;
export const closeThirdWingDb = closeOperationsDb;
export const ensureThirdWingDefaults = ensureOperationsDefaults;
export const makeThirdWingId = makeOperationsId;
export const getThirdWingDataRevision = getOperationsDataRevision;
