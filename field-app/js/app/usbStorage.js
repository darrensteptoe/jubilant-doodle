const HANDLE_DB = "fpe_usb_storage_v1";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "planner_dir";
const STATE_FILE = "fpe_state.json";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function hasFsSupport(){
  return typeof window !== "undefined"
    && !!window.isSecureContext
    && typeof window.showDirectoryPicker === "function";
}

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getOpenDbPromise(){
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try{
      const req = indexedDB.open(HANDLE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HANDLE_STORE)){
          db.createObjectStore(HANDLE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function runTx(store, mode, runner){
  return new Promise((resolve) => {
    try{
      const tx = store.transaction(HANDLE_STORE, mode);
      const bucket = tx.objectStore(HANDLE_STORE);
      runner(bucket);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function readStoredHandle(){
  const db = await getOpenDbPromise();
  if (!db) return null;
  return new Promise((resolve) => {
    try{
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const bucket = tx.objectStore(HANDLE_STORE);
      const req = bucket.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeStoredHandle(handle){
  const db = await getOpenDbPromise();
  if (!db) return false;
  return runTx(db, "readwrite", (bucket) => { bucket.put(handle, HANDLE_KEY); });
}

async function clearStoredHandle(){
  const db = await getOpenDbPromise();
  if (!db) return false;
  return runTx(db, "readwrite", (bucket) => { bucket.delete(HANDLE_KEY); });
}

async function hasReadWritePermission(handle, request){
  if (!handle || typeof handle.queryPermission !== "function") return false;
  let permission = "denied";
  try{
    permission = await handle.queryPermission({ mode: "readwrite" });
  } catch {
    permission = "denied";
  }
  if (permission === "granted") return true;
  if (!request || typeof handle.requestPermission !== "function") return false;
  try{
    permission = await handle.requestPermission({ mode: "readwrite" });
  } catch {
    permission = "denied";
  }
  return permission === "granted";
}

async function readStateFile(handle){
  try{
    const fileHandle = await handle.getFileHandle(STATE_FILE);
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!cleanText(text)){
      return { ok: false, exists: true, error: "State file is empty." };
    }
    let parsed = null;
    try{
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, exists: true, error: "State file is not valid JSON." };
    }
    if (!isObject(parsed)){
      return { ok: false, exists: true, error: "State file root must be an object." };
    }
    if (isObject(parsed.state)){
      return {
        ok: true,
        exists: true,
        state: parsed.state,
        savedAt: cleanText(parsed.savedAt),
      };
    }
    if (isObject(parsed.scenario)){
      return {
        ok: true,
        exists: true,
        state: parsed.scenario,
        savedAt: cleanText(parsed.timestamp),
      };
    }
    return {
      ok: true,
      exists: true,
      state: parsed,
      savedAt: cleanText(parsed.savedAt),
    };
  } catch (err){
    if (err?.name === "NotFoundError"){
      return { ok: true, exists: false, state: null, savedAt: "" };
    }
    const msg = cleanText(err?.message) || "Failed to read state file.";
    return { ok: false, exists: false, error: msg };
  }
}

async function writeStateFile(handle, text){
  const fileHandle = await handle.getFileHandle(STATE_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

export function createUsbStorageController(deps = {}){
  const {
    els,
    getState,
    replaceState,
    normalizeLoadedState,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    applyStateToUI,
    rebuildCandidateTable,
    applyThemeFromState,
    render,
    safeCall,
    renderScenarioManagerC1,
    renderDecisionSessionD1,
    persist,
    serializeStateForPersistence,
    reportPersistenceFailure,
    clearPersistenceFailure,
  } = deps;

  let handle = null;
  let supported = hasFsSupport();
  let connected = false;
  let needsReconnect = false;
  let statusOverride = "";
  let lastSavedAt = "";
  let saveTimer = null;
  let saveInFlight = false;
  let queuedSave = false;

  function setStatus(text){
    statusOverride = cleanText(text);
    renderStatus();
  }

  function renderStatus(){
    if (!els?.usbStorageStatus) return;
    if (!supported){
      els.usbStorageStatus.textContent = "External folder storage requires HTTPS and a File System Access browser (Chrome/Edge).";
    } else if (statusOverride){
      els.usbStorageStatus.textContent = statusOverride;
    } else if (connected && handle){
      const tail = lastSavedAt ? ` Last save: ${new Date(lastSavedAt).toLocaleString()}.` : "";
      els.usbStorageStatus.textContent = `Connected folder: ${handle.name}. Autosave ON.${tail}`;
    } else if (needsReconnect){
      const label = handle?.name ? ` (${handle.name})` : "";
      els.usbStorageStatus.textContent = `Folder permission required${label}. Click Connect folder to re-authorize.`;
    } else {
      els.usbStorageStatus.textContent = "Using browser storage only.";
    }
    if (els.btnUsbStorageConnect) els.btnUsbStorageConnect.disabled = !supported;
    if (els.btnUsbStorageLoad) els.btnUsbStorageLoad.disabled = !(supported && connected);
    if (els.btnUsbStorageSave) els.btnUsbStorageSave.disabled = !(supported && connected);
    if (els.btnUsbStorageDisconnect) els.btnUsbStorageDisconnect.disabled = !(supported && (connected || needsReconnect || !!handle));
  }

  function clearStatusOverride(){
    statusOverride = "";
    renderStatus();
  }

  function reportUsbFailure(code, message){
    if (typeof reportPersistenceFailure !== "function") return;
    reportPersistenceFailure("state", {
      ok: false,
      code: cleanText(code) || "usb_write_failed",
      error: cleanText(message) || "USB save failed.",
    });
  }

  function clearUsbFailure(){
    if (typeof clearPersistenceFailure !== "function") return;
    clearPersistenceFailure("state");
  }

  async function connect(){
    if (!supported){
      renderStatus();
      return { ok: false, error: "unsupported" };
    }
    let nextHandle = handle;
    const prevName = handle?.name || "";
    const canReauthorizeExisting = !!nextHandle && needsReconnect && typeof nextHandle.queryPermission === "function";
    if (!canReauthorizeExisting){
      try{
        nextHandle = await window.showDirectoryPicker({ id: "fpe-usb-storage", mode: "readwrite" });
      } catch (err){
        if (err?.name === "AbortError"){
          renderStatus();
          return { ok: false, canceled: true };
        }
        setStatus(`Connect failed: ${cleanText(err?.message) || "Unable to open folder picker."}`);
        return { ok: false, error: "picker_failed" };
      }
    }
    const granted = await hasReadWritePermission(nextHandle, true);
    handle = nextHandle;
    if (!granted){
      connected = false;
      needsReconnect = true;
      await writeStoredHandle(nextHandle);
      reportUsbFailure("usb_permission_denied", "USB folder permission denied.");
      setStatus("Folder selected but write permission was not granted.");
      return { ok: false, error: "permission_denied" };
    }
    connected = true;
    needsReconnect = false;
    if (prevName !== (nextHandle?.name || "")) lastSavedAt = "";
    await writeStoredHandle(nextHandle);
    const seeded = await saveNow({ requestPermission: false });
    if (seeded?.ok){
      clearUsbFailure();
      clearStatusOverride();
      return { ok: true };
    }
    return { ok: false, error: seeded?.error || "seed_failed" };
  }

  async function disconnect(){
    handle = null;
    connected = false;
    needsReconnect = false;
    lastSavedAt = "";
    if (saveTimer){
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await clearStoredHandle();
    clearUsbFailure();
    clearStatusOverride();
    return { ok: true };
  }

  function applyLoadedState(next){
    const normalized = normalizeLoadedState(next);
    replaceState(normalized);
    ensureScenarioRegistry();
    ensureDecisionScaffold();
    try{
      const state = getState();
      const baseline = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
      if (baseline){
        baseline.inputs = scenarioInputsFromState(state);
        baseline.outputs = scenarioOutputsFromState(state);
      }
    } catch {}
    const state = getState();
    applyStateToUI();
    rebuildCandidateTable();
    document.body.classList.toggle("training", !!state?.ui?.training);
    applyThemeFromState();
    if (els?.explainCard) els.explainCard.hidden = !state?.ui?.training;
    render();
    safeCall(() => { renderScenarioManagerC1(); });
    safeCall(() => { renderDecisionSessionD1(); });
    if (typeof persist === "function") persist();
  }

  async function loadFromFolder({ suppressMissingStatus = false } = {}){
    if (!supported || !handle || !connected){
      setStatus("Connect folder before loading.");
      return { ok: false, error: "not_connected" };
    }
    const granted = await hasReadWritePermission(handle, true);
    if (!granted){
      connected = false;
      needsReconnect = true;
      reportUsbFailure("usb_permission_denied", "USB folder permission denied.");
      setStatus("Folder permission denied.");
      return { ok: false, error: "permission_denied" };
    }
    const read = await readStateFile(handle);
    if (!read.ok){
      reportUsbFailure("usb_read_failed", `USB load failed: ${read.error}`);
      setStatus(`Load failed: ${read.error}`);
      return { ok: false, error: "load_failed" };
    }
    if (!read.exists || !isObject(read.state)){
      if (!suppressMissingStatus){
        setStatus(`No ${STATE_FILE} found in ${handle.name}.`);
      } else {
        clearStatusOverride();
      }
      return { ok: false, error: "missing_state_file" };
    }
    applyLoadedState(read.state);
    lastSavedAt = cleanText(read.savedAt) || lastSavedAt;
    clearUsbFailure();
    clearStatusOverride();
    return { ok: true };
  }

  async function saveNow({ requestPermission = true } = {}){
    if (!supported || !handle || !connected){
      setStatus("Connect folder before saving.");
      return { ok: false, error: "not_connected" };
    }
    if (saveInFlight){
      queuedSave = true;
      return { ok: true, queued: true };
    }
    saveInFlight = true;
    try{
      const granted = await hasReadWritePermission(handle, !!requestPermission);
      if (!granted){
        connected = false;
        needsReconnect = true;
        reportUsbFailure("usb_permission_denied", "USB folder permission denied.");
        setStatus("Folder permission denied.");
        return { ok: false, error: "permission_denied" };
      }
      const serialized = serializeStateForPersistence(getState());
      if (!serialized?.ok){
        const msg = cleanText(serialized?.error?.message || serialized?.error || "State serialization failed.");
        reportUsbFailure("usb_serialize_failed", `USB save failed: ${msg}`);
        setStatus(`Save failed: ${msg}`);
        return { ok: false, error: "serialize_failed" };
      }
      let stateObject = null;
      try{
        stateObject = JSON.parse(serialized.text);
      } catch {
        reportUsbFailure("usb_serialize_failed", "USB save failed: serialized state is invalid JSON.");
        setStatus("Save failed: serialized state is invalid JSON.");
        return { ok: false, error: "parse_failed" };
      }
      const payload = {
        schema: "fpe_usb_state_v1",
        savedAt: new Date().toISOString(),
        state: stateObject,
      };
      await writeStateFile(handle, JSON.stringify(payload));
      lastSavedAt = payload.savedAt;
      connected = true;
      needsReconnect = false;
      clearUsbFailure();
      clearStatusOverride();
      return { ok: true };
    } catch (err){
      const msg = cleanText(err?.message) || "Unable to write state file.";
      connected = false;
      needsReconnect = true;
      reportUsbFailure("usb_write_failed", `USB save failed: ${msg}`);
      setStatus(`Save failed: ${msg}`);
      return { ok: false, error: "write_failed" };
    } finally{
      saveInFlight = false;
      if (queuedSave){
        queuedSave = false;
        scheduleSave();
      }
    }
  }

  function scheduleSave(){
    if (!supported || !connected || !handle) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow({ requestPermission: false });
    }, 900);
  }

  async function init(){
    supported = hasFsSupport();
    if (!supported){
      renderStatus();
      return;
    }
    const stored = await readStoredHandle();
    if (!stored){
      renderStatus();
      return;
    }
    handle = stored;
    const granted = await hasReadWritePermission(stored, false);
    connected = granted;
    needsReconnect = !granted;
    renderStatus();
  }

  return {
    init,
    connect,
    disconnect,
    loadFromFolder,
    saveNow,
    scheduleSave,
    renderStatus,
    isConnected: () => !!(supported && connected && handle),
  };
}
