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

export function saveState(state){
  try{
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
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
  const store = storageOverride || localStorage;
  try{
    const prev = readBackups(store);
    const next = [entry, ...prev].slice(0, MAX_BACKUPS);
    safeSet(store, BACKUP_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}
