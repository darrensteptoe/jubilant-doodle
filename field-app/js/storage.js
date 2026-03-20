// @ts-check
import {
  DEFAULT_CAMPAIGN_ID,
  normalizeCampaignId,
  normalizeOfficeId,
  normalizeScenarioId,
  resolveActiveContext,
} from "./app/activeContext.js";
import {
  CONTEXT_STORAGE_ROOT,
  makeCampaignStoragePath,
} from "./core/campaignContextManager.js";

const KEY_BASE = "dsc_field_engine_state_v1"; // legacy compatibility only
const KEY_LEGACY = "dsc_field_engine_state_v1";
const BACKUP_KEY_BASE = "fpe_backups_v1"; // legacy compatibility only
const BACKUP_KEY_LEGACY = "fpe_backups_v1";
const STATE_MODULE = "state";
const STATE_KEY = "snapshot-v1";
const BACKUP_KEY = "backups-v1";
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
  const includeScenario = base === STATE_KEY;
  return makeCampaignStoragePath(src, {
    module: STATE_MODULE,
    key: base,
    includeScenario,
  });
}

function priorModernCompatibilityKeys(base, context = {}){
  if (base !== STATE_KEY) return [];
  const src = (context && typeof context === "object") ? context : {};
  const sid = normalizeScenarioId(src.scenarioId, "");
  if (!sid) return [];
  return [makeCampaignStoragePath({ ...src, scenarioId: "" }, {
    module: STATE_MODULE,
    key: STATE_KEY,
    includeScenario: false,
  })];
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
  const legacyPrefix = `${base}::${cid}::`;
  const modernPrefix = `${CONTEXT_STORAGE_ROOT}/${cid}/`;
  const modernSuffix = base === BACKUP_KEY_BASE
    ? `/${STATE_MODULE}/${BACKUP_KEY}`
    : `/${STATE_MODULE}/${STATE_KEY}`;
  const out = [];
  for (let i = 0; i < storage.length; i += 1){
    const key = String(storage.key(i) || "");
    if (key.startsWith(legacyPrefix)){
      out.push(key);
      continue;
    }
    if (key.startsWith(modernPrefix) && key.endsWith(modernSuffix)){
      out.push(key);
      continue;
    }
  }
  return out;
}

function modernCampaignFallbackKeys(context = {}){
  const cid = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  const out = [];
  out.push(makeCampaignStoragePath({
    campaignId: cid,
    officeId: "",
  }, {
    module: STATE_MODULE,
    key: STATE_KEY,
    includeScenario: false,
  }));
  const sid = normalizeScenarioId(context?.scenarioId, "");
  if (sid){
    out.push(makeCampaignStoragePath({
      campaignId: cid,
      officeId: "",
      scenarioId: sid,
    }, {
      module: STATE_MODULE,
      key: STATE_KEY,
      includeScenario: true,
    }));
  }
  return out;
}

function modernBackupCampaignFallbackKeys(context = {}){
  const cid = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  return [
    makeCampaignStoragePath({
      campaignId: cid,
      officeId: "",
    }, {
      module: STATE_MODULE,
      key: BACKUP_KEY,
      includeScenario: false,
    }),
  ];
}

function listScopedCampaignKeysLegacyAndModern(storage, base, context = {}){
  const keys = listScopedCampaignKeys(storage, base, context);
  const unique = [];
  const seen = new Set();
  for (const key of keys){
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  return unique;
}

function listModernAndLegacyStateFallbackKeys(context = {}){
  const out = [];
  const seen = new Set();
  const pushKey = (key) => {
    const token = String(key || "");
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(key);
  };
  pushKey(makeStateStorageKey(context));
  for (const key of priorModernCompatibilityKeys(STATE_KEY, context)) pushKey(key);
  for (const key of modernCampaignFallbackKeys(context)) pushKey(key);
  for (const key of priorScopedCompatibilityKeys(KEY_BASE, context)) pushKey(key);
  return out;
}

function listModernAndLegacyBackupFallbackKeys(context = {}){
  const out = [];
  const seen = new Set();
  const pushKey = (key) => {
    const token = String(key || "");
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(key);
  };
  pushKey(makeBackupStorageKey(context));
  for (const key of modernBackupCampaignFallbackKeys(context)) pushKey(key);
  for (const key of priorScopedCompatibilityKeys(BACKUP_KEY_BASE, context)) pushKey(key);
  return out;
}

function listAllOfficeStateKeysForCampaign(storage, context = {}){
  return listScopedCampaignKeysLegacyAndModern(storage, KEY_BASE, context)
    .filter((key) => key.endsWith(`/${STATE_MODULE}/${STATE_KEY}`) || key.includes(`${KEY_BASE}::`));
}

function listAllOfficeBackupKeysForCampaign(storage, context = {}){
  return listScopedCampaignKeysLegacyAndModern(storage, BACKUP_KEY_BASE, context)
    .filter((key) => key.endsWith(`/${STATE_MODULE}/${BACKUP_KEY}`) || key.includes(`${BACKUP_KEY_BASE}::`));
}

function removeKeys(storage, keys = []){
  const seen = new Set();
  for (const key of keys){
    const token = String(key || "");
    if (!token || seen.has(token)) continue;
    seen.add(token);
    safeRemove(storage, token);
  }
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
  return scopedKey(STATE_KEY, context);
}

export function makeBackupStorageKey(context = {}){
  return scopedKey(BACKUP_KEY, context);
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
  try{
    for (const compatKey of listModernAndLegacyStateFallbackKeys(context)){
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
  removeKeys(store, listModernAndLegacyStateFallbackKeys(context));
  removeKeys(store, listModernAndLegacyBackupFallbackKeys(context));
  if (!normalizeOfficeId(context.officeId, "")){
    removeKeys(store, listAllOfficeStateKeysForCampaign(store, context));
    removeKeys(store, listAllOfficeBackupKeysForCampaign(store, context));
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
  const backupReadContext = hasLegacyStorageArg ? context : { ...context, ...(options || {}) };
  const backupKey = makeBackupStorageKey(backupReadContext);
  try{
    const collected = [];
    for (const key of listModernAndLegacyBackupFallbackKeys(backupReadContext)){
      const scopedRaw = safeGet(store, key);
      if (!scopedRaw) continue;
      const parsed = JSON.parse(scopedRaw);
      if (Array.isArray(parsed)) collected.push(...parsed);
    }

    if (!normalizeOfficeId(context?.officeId, "")){
      const campaignScopedKeys = listAllOfficeBackupKeysForCampaign(store, context);
      for (const campaignKey of campaignScopedKeys){
        if (campaignKey === backupKey) continue;
        const parsed = JSON.parse(safeGet(store, campaignKey) || "null");
        if (Array.isArray(parsed)) collected.push(...parsed);
      }
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
