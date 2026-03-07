// @ts-check
export function updatePersistenceStatusChipModule(els, persistenceState){
  if (!els.persistenceStatus) return;
  const stateIssue = !persistenceState.stateSaveOk;
  const backupIssue = !persistenceState.backupSaveOk;
  if (!stateIssue && !backupIssue){
    els.persistenceStatus.hidden = true;
    els.persistenceStatus.textContent = "Save issue";
    els.persistenceStatus.title = "";
    return;
  }
  els.persistenceStatus.hidden = false;
  if (stateIssue){
    els.persistenceStatus.textContent = "State save issue";
    els.persistenceStatus.title = persistenceState.stateError || "Could not save planner state.";
    return;
  }
  els.persistenceStatus.textContent = "Backup save issue";
  els.persistenceStatus.title = persistenceState.backupError || "Could not save backup snapshot.";
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
