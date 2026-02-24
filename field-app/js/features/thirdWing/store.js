// js/features/thirdWing/store.js
// IndexedDB store skeleton for Third Wing records.

import {
  THIRD_WING_DB_NAME,
  THIRD_WING_DB_VERSION,
  THIRD_WING_STORES,
  THIRD_WING_STORE_DEFS,
  PIPELINE_STAGES,
  DEFAULT_FORECAST_CONFIG,
} from "./schema.js";

let dbPromise = null;

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
  return openThirdWingDb().then((db) => new Promise((resolve, reject) => {
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
  if (!THIRD_WING_STORES.includes(storeName)){
    throw new Error(`Unknown Third Wing store: ${String(storeName)}`);
  }
}

function nowIso(){
  return new Date().toISOString();
}

export function makeThirdWingId(prefix = "tw"){
  if (typeof crypto !== "undefined" && crypto.randomUUID){
    return `${prefix}_${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(16).slice(2, 10);
  const stamp = Date.now().toString(16);
  return `${prefix}_${stamp}_${rand}`;
}

function sanitizeRecord(storeName, input){
  const rec = (input && typeof input === "object") ? { ...input } : {};
  const stamp = nowIso();

  if (storeName === "meta"){
    if (!rec.key) rec.key = makeThirdWingId("meta");
    return rec;
  }

  const idPrefix = {
    persons: "per",
    pipelineRecords: "pipe",
    shiftRecords: "shift",
    turfEvents: "turf",
    forecastConfigs: "fc",
  }[storeName] || "tw";

  if (!rec.id) rec.id = makeThirdWingId(idPrefix);
  if (!rec.createdAt) rec.createdAt = stamp;
  rec.updatedAt = stamp;

  if (storeName === "persons"){
    rec.active = !!rec.active;
  }
  if (storeName === "pipelineRecords"){
    if (!PIPELINE_STAGES.includes(rec.stage)){
      rec.stage = PIPELINE_STAGES[0];
    }
  }

  return rec;
}

export function openThirdWingDb(){
  requireIndexedDb();
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(THIRD_WING_DB_NAME, THIRD_WING_DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeName of THIRD_WING_STORES){
        const def = THIRD_WING_STORE_DEFS[storeName];
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
    req.onerror = () => reject(req.error || new Error("Could not open Third Wing IndexedDB."));
  });

  return dbPromise;
}

export async function closeThirdWingDb(){
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export async function ensureThirdWingDefaults(){
  await runInTransaction(["forecastConfigs"], "readwrite", async (stores) => {
    const existing = await requestToPromise(stores.forecastConfigs.get("default"));
    if (!existing){
      stores.forecastConfigs.put(sanitizeRecord("forecastConfigs", DEFAULT_FORECAST_CONFIG));
    }
  });
}

export async function getAll(storeName){
  assertStoreName(storeName);
  return runInTransaction([storeName], "readonly", async (stores) => {
    return requestToPromise(stores[storeName].getAll());
  });
}

export async function getById(storeName, id){
  assertStoreName(storeName);
  const key = id == null ? "" : id;
  return runInTransaction([storeName], "readonly", async (stores) => {
    return requestToPromise(stores[storeName].get(key));
  });
}

export async function getByIndex(storeName, indexName, key){
  assertStoreName(storeName);
  return runInTransaction([storeName], "readonly", async (stores) => {
    const idx = stores[storeName].index(indexName);
    return requestToPromise(idx.getAll(key));
  });
}

export async function put(storeName, record){
  assertStoreName(storeName);
  const next = sanitizeRecord(storeName, record);
  return runInTransaction([storeName], "readwrite", async (stores) => {
    stores[storeName].put(next);
    return next;
  });
}

export async function putMany(storeName, records){
  assertStoreName(storeName);
  const list = Array.isArray(records) ? records : [];
  const next = list.map((r) => sanitizeRecord(storeName, r));
  return runInTransaction([storeName], "readwrite", async (stores) => {
    for (const rec of next){
      stores[storeName].put(rec);
    }
    return { count: next.length };
  });
}

export async function remove(storeName, id){
  assertStoreName(storeName);
  const key = id == null ? "" : id;
  return runInTransaction([storeName], "readwrite", async (stores) => {
    stores[storeName].delete(key);
    return { ok: true };
  });
}

export async function clear(storeName){
  assertStoreName(storeName);
  return runInTransaction([storeName], "readwrite", async (stores) => {
    stores[storeName].clear();
    return { ok: true };
  });
}

export async function clearAllStores(){
  const clearable = THIRD_WING_STORES.slice();
  return runInTransaction(clearable, "readwrite", async (stores) => {
    for (const name of clearable){
      stores[name].clear();
    }
    return { ok: true };
  });
}

export async function replaceAllStores(dataByStore){
  const payload = (dataByStore && typeof dataByStore === "object") ? dataByStore : {};
  return runInTransaction(THIRD_WING_STORES, "readwrite", async (stores) => {
    for (const name of THIRD_WING_STORES){
      stores[name].clear();
      const rows = Array.isArray(payload[name]) ? payload[name] : [];
      for (const rec of rows){
        stores[name].put(sanitizeRecord(name, rec));
      }
    }
    return { ok: true };
  });
}

export async function mergeAllStores(dataByStore){
  const payload = (dataByStore && typeof dataByStore === "object") ? dataByStore : {};
  return runInTransaction(THIRD_WING_STORES, "readwrite", async (stores) => {
    for (const name of THIRD_WING_STORES){
      const rows = Array.isArray(payload[name]) ? payload[name] : [];
      for (const rec of rows){
        stores[name].put(sanitizeRecord(name, rec));
      }
    }
    return { ok: true };
  });
}

export async function getSummaryCounts(){
  const result = {};
  for (const name of THIRD_WING_STORES){
    result[name] = (await getAll(name)).length;
  }
  return result;
}

