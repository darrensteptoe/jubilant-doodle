// @ts-check
import {
  DEFAULT_CAMPAIGN_ID,
  normalizeCampaignId,
  normalizeOfficeId,
  normalizeScenarioId,
  resolveActiveContext,
} from "./app/activeContext.js";

const KEY_BASE = "dsc_field_engine_state_v1";
const KEY_LEGACY = "dsc_field_engine_state_v1";
const BACKUP_KEY_BASE = "fpe_backups_v1";
const BACKUP_KEY_LEGACY = "fpe_backups_v1";
const MAX_BACKUPS = 5;

function isStorageLike(value){
  return !!value
    && typeof value === "object"
    && typeof value.getItem === "function"
    && typeof value.setItem === "function"
    && typeof value.removeItem === "function";
}

function normalizeContextArg(input){
  const src = (input && typeof input === "object") ? input : {};
  return resolveActiveContext({
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    officeId: src.officeId,
    scenarioId: src.scenarioId,
    search: src.search,
    fallback: src.fallback,
  });
}

function resolveContextFromState(state, contextInput){
  const fallbackState = (state && typeof state === "object") ? state : {};
  const src = (contextInput && typeof contextInput === "object") ? contextInput : {};
  const campaignPinned = src.campaignSource === "explicit" || src.campaignSource === "url";
  const officePinned = src.officeSource === "explicit" || src.officeSource === "url";
  const scenarioPinned = src.scenarioSource === "explicit" || src.scenarioSource === "url";
  return normalizeContextArg({
    campaignId: campaignPinned ? src.campaignId : "",
    campaignName: campaignPinned ? src.campaignName : "",
    officeId: officePinned ? src.officeId : "",
    scenarioId: scenarioPinned ? src.scenarioId : "",
    search: src.search,
    fallback: {
      campaignId: fallbackState.campaignId || src.campaignId,
      campaignName: fallbackState.campaignName || src.campaignName,
      officeId: fallbackState.officeId || src.officeId,
      scenarioId: fallbackState.scenarioId || src.scenarioId,
    },
  });
}

function resolveStorageAndContext(storageOrOptions, maybeOptions){
  if (isStorageLike(storageOrOptions)){
    return {
      store: storageOrOptions,
      context: normalizeContextArg(maybeOptions || {}),
    };
  }
  const options = (storageOrOptions && typeof storageOrOptions === "object") ? storageOrOptions : {};
  return {
    store: isStorageLike(options.storageOverride) ? options.storageOverride : getDefaultStorage(),
    context: normalizeContextArg(options),
  };
}

function getDefaultStorage(){
  if (typeof localStorage !== "undefined") return localStorage;
  return {
    getItem(){ return null; },
    setItem(){},
    removeItem(){},
  };
}

function scopedKey(base, context = {}){
  const src = (context && typeof context === "object") ? context : {};
  const cid = normalizeCampaignId(src.campaignId, DEFAULT_CAMPAIGN_ID);
  const oid = normalizeOfficeId(src.officeId, "");
  const officeToken = oid || "all";
  const sid = normalizeScenarioId(src.scenarioId, "");
  if (sid) return `${base}::${cid}::${officeToken}::${sid}`;
  return `${base}::${cid}::${officeToken}`;
}

function priorScopedCompatibilityKeys(base, context = {}){
  const src = (context && typeof context === "object") ? context : {};
  const cid = normalizeCampaignId(src.campaignId, DEFAULT_CAMPAIGN_ID);
  const sid = normalizeScenarioId(src.scenarioId, "");
  const keys = [];
  if (sid){
    keys.push(`${base}::${cid}::${sid}`);
  }
  keys.push(`${base}::${cid}`);
  return keys;
}

function listScopedCampaignKeys(storage, base, context = {}){
  if (!storage || typeof storage.length !== "number" || typeof storage.key !== "function"){
    return [];
  }
  const cid = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  const prefix = `${base}::${cid}::`;
  const out = [];
  for (let i = 0; i < storage.length; i += 1){
    const key = String(storage.key(i) || "");
    if (!key.startsWith(prefix)) continue;
    out.push(key);
  }
  return out;
}

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stateMatchesContextScope(stateLike, context = {}){
  const row = isObject(stateLike) ? stateLike : null;
  if (!row) return false;
  const ctxCampaignId = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  const rowCampaignId = normalizeCampaignId(row?.campaignId, DEFAULT_CAMPAIGN_ID);
  if (ctxCampaignId !== rowCampaignId) return false;

  const ctxOfficeId = normalizeOfficeId(context?.officeId, "");
  if (!ctxOfficeId) return true;
  const rowOfficeId = normalizeOfficeId(row?.officeId, "");
  return rowOfficeId === ctxOfficeId;
}

function withDefaultContextFields(stateLike, context = {}){
  if (!isObject(stateLike)) return stateLike;
  const out = { ...stateLike };
  if (!out.campaignId) out.campaignId = context.campaignId;
  if (!Object.prototype.hasOwnProperty.call(out, "campaignName")) out.campaignName = context.campaignName || "";
  if (!Object.prototype.hasOwnProperty.call(out, "officeId")) out.officeId = context.officeId || "";
  return out;
}

export function makeStateStorageKey(context = {}){
  return scopedKey(KEY_BASE, context);
}

export function makeBackupStorageKey(context = {}){
  return scopedKey(BACKUP_KEY_BASE, context);
}

/**
 * @param {{
 *   storageOverride?: Storage,
 *   campaignId?: string,
 *   campaignName?: string,
 *   officeId?: string,
 *   scenarioId?: string,
 *   search?: string,
 * }=} options
 */
export function loadState(options = {}){
  const { store, context } = resolveStorageAndContext(options);
  const primaryKey = makeStateStorageKey(context);
  try{
    const raw = safeGet(store, primaryKey);
    if (raw){
      const loaded = JSON.parse(raw);
      return withDefaultContextFields(loaded, context);
    }

    for (const compatKey of priorScopedCompatibilityKeys(KEY_BASE, context)){
      const compatRaw = safeGet(store, compatKey);
      if (!compatRaw) continue;
      const compatLoaded = JSON.parse(compatRaw);
      if (!stateMatchesContextScope(compatLoaded, context)) continue;
      return withDefaultContextFields(compatLoaded, context);
    }

    const legacyRaw = safeGet(store, KEY_LEGACY);
    if (legacyRaw){
      const legacyLoaded = JSON.parse(legacyRaw);
      if (stateMatchesContextScope(legacyLoaded, context)){
        return withDefaultContextFields(legacyLoaded, context);
      }
    }

    return null;
  } catch {
    return null;
  }
}

function safeStringify(value){
  try{
    return { ok: true, text: JSON.stringify(value) };
  } catch (err){
    return { ok: false, error: err };
  }
}

function persistenceError(code, fallback, err){
  const tail = err?.message ? ` ${err.message}` : "";
  return {
    ok: false,
    code,
    error: `${fallback}${tail}`.trim(),
  };
}

function compactCensusForPersistence(census){
  if (!isObject(census)) return census;
  const out = { ...census };
  out.geoOptions = [];
  out.rowsByGeoid = {};
  out.loadingGeo = false;
  out.loadingRows = false;
  out.requestSeq = 0;
  return out;
}

function compactScenarioRecordForPersistence(record){
  if (!isObject(record)) return record;
  const out = { ...record };
  if (isObject(out.inputs)){
    out.inputs = compactStateForPersistence(out.inputs);
  }
  return out;
}

function compactStateForPersistence(state){
  if (!isObject(state)) return state;
  const out = { ...state };
  if (isObject(out.census)){
    out.census = compactCensusForPersistence(out.census);
  }
  if (isObject(out.ui)){
    const ui = { ...out.ui };
    if (isObject(ui.scenarios)){
      const next = {};
      for (const [id, record] of Object.entries(ui.scenarios)){
        next[id] = compactScenarioRecordForPersistence(record);
      }
      ui.scenarios = next;
    }
    out.ui = ui;
  }
  return out;
}

export function prepareStateForPersistence(state){
  return compactStateForPersistence(state);
}

export function serializeStateForPersistence(state){
  return safeStringify(prepareStateForPersistence(state));
}

export function persistStateSnapshot(state, storageOverride, options){
  const hasLegacyStorageArg = isStorageLike(storageOverride);
  const { store, context } = resolveStorageAndContext(
    hasLegacyStorageArg ? storageOverride : storageOverride || {},
    hasLegacyStorageArg ? options : undefined
  );
  const fallbackOptions = hasLegacyStorageArg ? options : storageOverride;
  const resolvedContext = resolveContextFromState(state, { ...context, ...(fallbackOptions || {}) });
  const stateKey = makeStateStorageKey(resolvedContext);
  const backupKey = makeBackupStorageKey(resolvedContext);
  const encoded = serializeStateForPersistence(state);
  if (!encoded.ok){
    return persistenceError("serialize_failed", "State serialization failed.", encoded.error);
  }
  let ok = safeSet(store, stateKey, encoded.text);
  if (!ok){
    safeRemove(store, backupKey);
    ok = safeSet(store, stateKey, encoded.text);
    if (ok){
      return { ok: true, bytes: encoded.text.length, clearedBackups: true };
    }
    return persistenceError("write_failed", "State save failed (storage quota or browser policy).");
  }
  return { ok: true, bytes: encoded.text.length };
}

export function saveState(state, storageOverride, options){
  return persistStateSnapshot(state, storageOverride, options).ok;
}

export function clearState(options = {}){
  const { store, context } = resolveStorageAndContext(options);
  const key = makeStateStorageKey(context);
  const backupKey = makeBackupStorageKey(context);
  safeRemove(store, key);
  safeRemove(store, backupKey);
  if (!normalizeOfficeId(context.officeId, "")){
    for (const compatKey of priorScopedCompatibilityKeys(KEY_BASE, context)){
      safeRemove(store, compatKey);
    }
    for (const compatBackupKey of priorScopedCompatibilityKeys(BACKUP_KEY_BASE, context)){
      safeRemove(store, compatBackupKey);
    }
  }
  if (context.campaignSource === "default"){
    safeRemove(store, KEY_LEGACY);
    safeRemove(store, BACKUP_KEY_LEGACY);
  }
}


function safeGet(storage, key){
  try{ return storage.getItem(key); } catch { return null; }
}
function safeSet(storage, key, value){
  try{ storage.setItem(key, value); return true; } catch { return false; }
}
function safeRemove(storage, key){
  try{ storage.removeItem(key); return true; } catch { return false; }
}

function backupEntryScenarioState(entry){
  const row = isObject(entry) ? entry : {};
  const payload = isObject(row.payload) ? row.payload : {};
  const snapshotState = isObject(payload.scenarioState)
    ? payload.scenarioState
    : (isObject(payload.scenario) ? payload.scenario : null);
  if (snapshotState) return snapshotState;
  if (isObject(row.scenarioState)) return row.scenarioState;
  return null;
}

function backupEntryMatchesContext(entry, context = {}){
  const scopedState = backupEntryScenarioState(entry);
  if (!scopedState) return !normalizeOfficeId(context?.officeId, "");
  return stateMatchesContextScope(scopedState, context);
}

function dedupeBackupEntries(entries){
  const list = Array.isArray(entries) ? entries : [];
  const seen = new Set();
  const out = [];
  for (const entry of list){
    const row = isObject(entry) ? entry : {};
    const ts = String(row.ts || "").trim();
    const scenarioName = String(row.scenarioName || "").trim();
    const snapshotHash = String(row?.payload?.snapshotHash || "").trim();
    const token = snapshotHash || `${ts}::${scenarioName}`;
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(entry);
  }
  return out;
}

export function readBackups(storageOverride, options){
  const hasLegacyStorageArg = isStorageLike(storageOverride);
  const { store, context } = resolveStorageAndContext(
    hasLegacyStorageArg ? storageOverride : storageOverride || {},
    hasLegacyStorageArg ? options : undefined
  );
  const backupKey = makeBackupStorageKey(hasLegacyStorageArg ? context : { ...context, ...(options || {}) });
  try{
    const collected = [];
    const scopedRaw = safeGet(store, backupKey);
    if (scopedRaw){
      const parsed = JSON.parse(scopedRaw);
      if (Array.isArray(parsed)) collected.push(...parsed);
    }

    if (!normalizeOfficeId(context?.officeId, "")){
      const campaignScopedKeys = listScopedCampaignKeys(store, BACKUP_KEY_BASE, context);
      for (const campaignKey of campaignScopedKeys){
        if (campaignKey === backupKey) continue;
        const parsed = JSON.parse(safeGet(store, campaignKey) || "null");
        if (Array.isArray(parsed)) collected.push(...parsed);
      }
    }

    for (const compatKey of priorScopedCompatibilityKeys(BACKUP_KEY_BASE, context)){
      const compatRaw = safeGet(store, compatKey);
      if (!compatRaw) continue;
      const parsed = JSON.parse(compatRaw);
      if (Array.isArray(parsed)) collected.push(...parsed);
    }

    const legacyRaw = safeGet(store, BACKUP_KEY_LEGACY);
    if (legacyRaw){
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) collected.push(...parsed);
    }

    if (!collected.length) return [];
    return dedupeBackupEntries(collected
      .filter((entry) => backupEntryMatchesContext(entry, context))
    ).slice(0, MAX_BACKUPS);
  } catch {
    return [];
  }
}

export function writeBackupEntry(entry, storageOverride, options){
  const result = appendBackupEntry(entry, storageOverride, options);
  return result.ok ? result.backups : [];
}

export function appendBackupEntry(entry, storageOverride, options){
  const hasLegacyStorageArg = isStorageLike(storageOverride);
  const { store, context } = resolveStorageAndContext(
    hasLegacyStorageArg ? storageOverride : storageOverride || {},
    hasLegacyStorageArg ? options : undefined
  );
  const resolvedContext = hasLegacyStorageArg ? normalizeContextArg(options || {}) : context;
  const backupKey = makeBackupStorageKey(resolvedContext);
  try{
    const prev = readBackups(store, resolvedContext);
    const next = [entry, ...prev].slice(0, MAX_BACKUPS);
    const encoded = safeStringify(next);
    if (!encoded.ok){
      return persistenceError("backup_serialize_failed", "Backup serialization failed.", encoded.error);
    }
    let ok = safeSet(store, backupKey, encoded.text);
    if (!ok){
      const fallback = [entry];
      const fallbackEncoded = safeStringify(fallback);
      if (!fallbackEncoded.ok){
        return persistenceError("backup_serialize_failed", "Backup serialization failed.", fallbackEncoded.error);
      }
      ok = safeSet(store, backupKey, fallbackEncoded.text);
      if (!ok){
        return persistenceError("backup_write_failed", "Backup save failed (storage quota or browser policy).");
      }
      return { ok: true, backups: fallback, bytes: fallbackEncoded.text.length, trimmed: true };
    }
    return { ok: true, backups: next, bytes: encoded.text.length };
  } catch (err){
    return persistenceError("backup_write_failed", "Backup save failed.", err);
  }
}
