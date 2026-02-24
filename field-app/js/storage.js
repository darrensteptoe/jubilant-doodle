const KEY = "dsc_field_engine_state_v1";

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

export function persistStateSnapshot(state, storageOverride){
  const store = storageOverride || localStorage;
  const encoded = safeStringify(state);
  if (!encoded.ok){
    return persistenceError("serialize_failed", "State serialization failed.", encoded.error);
  }
  const ok = safeSet(store, KEY, encoded.text);
  if (!ok){
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


// Phase 11 — auto-backup snapshots (rolling 5, fail-soft)
const BACKUP_KEY = "fpe_backups_v1";
const MAX_BACKUPS = 5;

function safeGet(storage, key){
  try{ return storage.getItem(key); } catch { return null; }
}
function safeSet(storage, key, value){
  try{ storage.setItem(key, value); return true; } catch { return false; }
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
    const ok = safeSet(store, BACKUP_KEY, encoded.text);
    if (!ok){
      return persistenceError("backup_write_failed", "Backup save failed (storage quota or browser policy).");
    }
    return { ok: true, backups: next, bytes: encoded.text.length };
  } catch (err){
    return persistenceError("backup_write_failed", "Backup save failed.", err);
  }
}
