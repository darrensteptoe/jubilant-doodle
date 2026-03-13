// @ts-check
export function updatePersistenceStatusChipModule(els, persistenceState){
  const persistenceStatusEl = els?.persistenceStatus || null;
  if (!persistenceStatusEl) return;
  const stateIssue = !persistenceState.stateSaveOk;
  const backupIssue = !persistenceState.backupSaveOk;
  if (!stateIssue && !backupIssue){
    persistenceStatusEl.hidden = true;
    persistenceStatusEl.textContent = "Save issue";
    persistenceStatusEl.title = "";
    return;
  }
  persistenceStatusEl.hidden = false;
  if (stateIssue){
    persistenceStatusEl.textContent = "State save issue";
    persistenceStatusEl.title = persistenceState.stateError || "Could not save planner state.";
    return;
  }
  persistenceStatusEl.textContent = "Backup save issue";
  persistenceStatusEl.title = persistenceState.backupError || "Could not save backup snapshot.";
}

/** @param {import("./types").PersistenceStatusCtx} ctx */
export function reportPersistenceFailureModule(ctx){
  const {
    scope,
    result,
    persistenceState,
    getPersistenceErrorSig,
    setPersistenceErrorSig,
    recordError,
    updatePersistenceStatusChip,
  } = ctx || {};

  const msg = String(result?.error || "Unknown persistence error");
  if (scope === "state"){
    persistenceState.stateSaveOk = false;
    persistenceState.stateError = msg;
  } else {
    persistenceState.backupSaveOk = false;
    persistenceState.backupError = msg;
  }

  const sig = `${scope}:${result?.code || "unknown"}:${msg}`;
  if (sig !== getPersistenceErrorSig()){
    setPersistenceErrorSig(sig);
    recordError("persistence", `${scope} save failed: ${msg}`, { code: result?.code || "unknown" });
  }
  updatePersistenceStatusChip();
}

/** @param {import("./types").ClearPersistenceStatusCtx} ctx */
export function clearPersistenceFailureModule(ctx){
  const {
    scope,
    persistenceState,
    setPersistenceErrorSig,
    updatePersistenceStatusChip,
  } = ctx || {};

  if (scope === "state"){
    persistenceState.stateSaveOk = true;
    persistenceState.stateError = "";
  } else {
    persistenceState.backupSaveOk = true;
    persistenceState.backupError = "";
  }
  if (persistenceState.stateSaveOk && persistenceState.backupSaveOk){
    setPersistenceErrorSig("");
  }
  updatePersistenceStatusChip();
}
