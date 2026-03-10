// @ts-check
const KEY = "dsc_field_engine_state_v1";
const BACKUP_KEY = "fpe_backups_v1";
const MAX_BACKUPS = 5;

export function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
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

export function persistStateSnapshot(state, storageOverride){
  const store = storageOverride || localStorage;
  const encoded = serializeStateForPersistence(state);
  if (!encoded.ok){
    return persistenceError("serialize_failed", "State serialization failed.", encoded.error);
  }
  let ok = safeSet(store, KEY, encoded.text);
  if (!ok){
    safeRemove(store, BACKUP_KEY);
    ok = safeSet(store, KEY, encoded.text);
    if (ok){
      return { ok: true, bytes: encoded.text.length, clearedBackups: true };
    }
    return persistenceError("write_failed", "State save failed (storage quota or browser policy).");
  }
  return { ok: true, bytes: encoded.text.length };
}

export function saveState(state, storageOverride){
  return persistStateSnapshot(state, storageOverride).ok;
}

export function clearState(){
  try{
    localStorage.removeItem(KEY);
  } catch {
    // ignore
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

export function readBackups(storageOverride){
  const store = storageOverride || localStorage;
  try{
    const raw = safeGet(store, BACKUP_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_BACKUPS) : [];
  } catch {
    return [];
  }
}

export function writeBackupEntry(entry, storageOverride){
  const result = appendBackupEntry(entry, storageOverride);
  return result.ok ? result.backups : [];
}

export function appendBackupEntry(entry, storageOverride){
  const store = storageOverride || localStorage;
  try{
    const prev = readBackups(store);
    const next = [entry, ...prev].slice(0, MAX_BACKUPS);
    const encoded = safeStringify(next);
    if (!encoded.ok){
      return persistenceError("backup_serialize_failed", "Backup serialization failed.", encoded.error);
    }
    let ok = safeSet(store, BACKUP_KEY, encoded.text);
    if (!ok){
      const fallback = [entry];
      const fallbackEncoded = safeStringify(fallback);
      if (!fallbackEncoded.ok){
        return persistenceError("backup_serialize_failed", "Backup serialization failed.", fallbackEncoded.error);
      }
      ok = safeSet(store, BACKUP_KEY, fallbackEncoded.text);
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
