const KEY = "dsc_field_engine_state_v1";
const CHUNK_PREFIX = `${KEY}__chunk__`;
const CHUNK_META_PREFIX = "__FPE_CHUNKED__:";
const CHUNK_SIZE = 120000;

function isQuotaError(err){
  const e = err || {};
  return e?.name === "QuotaExceededError" || e?.name === "NS_ERROR_DOM_QUOTA_REACHED" || e?.code === 22 || e?.code === 1014;
}

function chunkKey(i){
  return `${CHUNK_PREFIX}${i}`;
}

function clearChunked(store){
  try{
    const raw = store.getItem(KEY);
    if (!raw || !String(raw).startsWith(CHUNK_META_PREFIX)) return;
    const n = Number(String(raw).slice(CHUNK_META_PREFIX.length)) || 0;
    for (let i = 0; i < n; i++) store.removeItem(chunkKey(i));
  } catch {
    // ignore
  }
}

function encodeState(state){
  return JSON.stringify(state);
}

export function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    if (String(raw).startsWith(CHUNK_META_PREFIX)){
      const n = Number(String(raw).slice(CHUNK_META_PREFIX.length)) || 0;
      if (n <= 0) return null;
      let joined = "";
      for (let i = 0; i < n; i++){
        const chunk = localStorage.getItem(chunkKey(i));
        if (typeof chunk !== "string") return null;
        joined += chunk;
      }
      return JSON.parse(joined);
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(state){
  let payload = "";
  try{
    payload = encodeState(state);
    clearChunked(localStorage);
    localStorage.setItem(KEY, payload);
    return { ok: true, bytes: payload.length, chunked: false };
  } catch (err){
    if (!isQuotaError(err)){
      return { ok: false, code: "serialize_or_write_failed", message: String(err?.message || "save failed"), bytes: payload.length || 0 };
    }
  }

  try{
    payload = payload || encodeState(state);
    const chunks = [];
    for (let i = 0; i < payload.length; i += CHUNK_SIZE){
      chunks.push(payload.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++){
      localStorage.setItem(chunkKey(i), chunks[i]);
    }
    localStorage.setItem(KEY, `${CHUNK_META_PREFIX}${chunks.length}`);
    return { ok: true, bytes: payload.length, chunked: true, chunks: chunks.length };
  } catch (err){
    try{
      clearChunked(localStorage);
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    return {
      ok: false,
      code: isQuotaError(err) ? "quota_exceeded" : "write_failed",
      message: String(err?.message || "save failed"),
      bytes: payload.length || 0
    };
  }
}

export function clearState(){
  try{
    clearChunked(localStorage);
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
