// @ts-check
/**
 * @typedef {Record<string, any>} AnyState
 * @typedef {{
 *   els: Record<string, any>,
 *   readBackups: () => any[],
 *   appendBackupEntry: (entry: Record<string, any>) => { ok?: boolean, error?: string, code?: string } | null,
 *   safeCall: (fn: () => void) => void,
 *   getState: () => AnyState,
 *   setState: (next: AnyState) => void,
 *   engine: Record<string, any>,
 *   APP_VERSION: string,
 *   BUILD_ID: string,
 *   setLastExportHash: (hash: string) => void,
 *   clearPersistenceFailure: (scope: "state" | "backup") => void,
 *   reportPersistenceFailure: (scope: "state" | "backup", result: any) => void,
 *   normalizeLoadedScenarioRuntime: (state: AnyState) => AnyState,
 *   buildCriticalAuditSnapshot: (state: AnyState) => any,
 *   setLastCriticalAuditSnapshot: (snapshot: any) => void,
 *   ensureDecisionScaffold: () => void,
 *   persist: () => void,
 *   render: () => void,
 *   renderDecisionSessionD1: () => void,
 * }} BackupRecoveryControllerDeps
 */

/**
 * @param {BackupRecoveryControllerDeps=} deps
 */
export function createBackupRecoveryController(deps = {}){
  const {
    els,
    readBackups,
    appendBackupEntry,
    safeCall,
    getState,
    setState,
    engine,
    APP_VERSION,
    BUILD_ID,
    setLastExportHash,
    clearPersistenceFailure,
    reportPersistenceFailure,
    normalizeLoadedScenarioRuntime,
    buildCriticalAuditSnapshot,
    setLastCriticalAuditSnapshot,
    ensureDecisionScaffold,
    persist,
    render,
    renderDecisionSessionD1,
  } = deps || {};

  let backupTimer = null;

  function refreshBackupDropdown(){
    try{
      if (!els.restoreBackup) return;
      const backups = readBackups();
      const cur = els.restoreBackup.value;
      els.restoreBackup.innerHTML = '<option value="">Restore backup...</option>';
      backups.forEach((b, i) => {
        const opt = document.createElement("option");
        const name = (b?.scenarioName || "").trim();
        const when = b?.ts ? String(b.ts).replace("T", " ").replace("Z", "") : "";
        opt.value = String(i);
        opt.textContent = `${when}${name ? " — " + name : ""}`;
        els.restoreBackup.appendChild(opt);
      });
      els.restoreBackup.value = cur && cur !== "" ? cur : "";
    } catch {
      // ignore
    }
  }

  function scheduleBackupWrite(){
    try{
      if (backupTimer) clearTimeout(backupTimer);
      backupTimer = setTimeout(() => {
        safeCall(() => {
          const currentState = getState();
          const scenarioClone = structuredClone(currentState);
          const snapshot = {
            modelVersion: engine.snapshot.MODEL_VERSION,
            schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
            scenarioState: scenarioClone,
            appVersion: APP_VERSION,
            buildId: BUILD_ID
          };
          snapshot.snapshotHash = engine.snapshot.computeSnapshotHash(snapshot);
          setLastExportHash(snapshot.snapshotHash);
          const payload = engine.snapshot.makeScenarioExport(snapshot);
          const result = appendBackupEntry({
            ts: new Date().toISOString(),
            scenarioName: scenarioClone?.scenarioName || "",
            payload
          });
          if (result?.ok){
            clearPersistenceFailure("backup");
          } else {
            reportPersistenceFailure("backup", result);
          }
          refreshBackupDropdown();
        });
      }, 800);
    } catch {
      // ignore
    }
  }

  function restoreBackupByIndex(idx){
    const backups = readBackups();
    const entry = backups[Number(idx)];
    if (!entry) return;
    const ok = confirm("Restore this backup? This will overwrite current scenario inputs.");
    if (!ok) return;

    const rawPayload = (entry && Object.prototype.hasOwnProperty.call(entry, "payload"))
      ? entry.payload
      : entry;

    let loaded = rawPayload;
    if (typeof loaded === "string"){
      try{
        loaded = JSON.parse(loaded);
      } catch {
        alert("Backup restore failed: invalid backup payload.");
        return;
      }
    }
    if (!loaded || typeof loaded !== "object"){
      alert("Backup restore failed: invalid backup payload.");
      return;
    }

    const migrated = engine.snapshot.migrateSnapshot(loaded);
    const validated = engine.snapshot.validateScenarioExport(migrated?.snapshot, engine.snapshot.MODEL_VERSION);
    if (!validated?.ok){
      alert(`Backup restore failed: ${validated?.reason || "could not migrate snapshot."}`);
      return;
    }

    const quality = engine.snapshot.validateImportedScenarioData(validated.scenario);
    if (!quality.ok){
      const details = quality.errors.map((x) => `- ${x}`).join("\n");
      alert(`Backup restore failed: quality checks failed.\n${details}`);
      return;
    }
    try{
      const currentState = getState();
      const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
      const recomputed = engine.snapshot.computeSnapshotHash({
        modelVersion: validated.modelVersion,
        scenarioState: validated.scenario
      });
      const hashMismatch = !!(exportedHash && exportedHash !== recomputed);
      if (hashMismatch){
        if (els.importHashBanner){
          els.importHashBanner.hidden = false;
          els.importHashBanner.textContent = "Snapshot hash differs from exported hash.";
        }
        console.warn("Backup snapshot hash mismatch", { exportedHash, recomputed });
      } else if (els.importHashBanner){
        els.importHashBanner.hidden = true;
      }

      const policy = engine.snapshot.checkStrictImportPolicy({
        strictMode: !!currentState?.ui?.strictImport,
        importedSchemaVersion: (migrated?.snapshot?.schemaVersion || loaded.schemaVersion || null),
        currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
        hashMismatch
      });
      if (!policy.ok){
        alert(policy.issues.join(" "));
        return;
      }
    } catch {
      if (getState()?.ui?.strictImport){
        alert("Backup restore blocked: could not verify integrity hash in strict mode.");
        return;
      }
    }

    const restoreWarnings = [];
    if (Array.isArray(migrated?.warnings)) restoreWarnings.push(...migrated.warnings);
    if (Array.isArray(quality?.warnings)) restoreWarnings.push(...quality.warnings);
    if (els.importWarnBanner){
      if (restoreWarnings.length){
        const shown = restoreWarnings.slice(0, 6).join(" ");
        const extra = restoreWarnings.length > 6 ? ` (+${restoreWarnings.length - 6} more)` : "";
        els.importWarnBanner.hidden = false;
        els.importWarnBanner.textContent = `${shown}${extra}`.trim();
      } else {
        els.importWarnBanner.hidden = true;
        els.importWarnBanner.textContent = "";
      }
    }

    const nextState = normalizeLoadedScenarioRuntime(validated.scenario);
    setState(nextState);
    setLastCriticalAuditSnapshot(buildCriticalAuditSnapshot(nextState));
    ensureDecisionScaffold();
    persist();
    render();
    safeCall(() => { renderDecisionSessionD1(); });
  }

  return {
    scheduleBackupWrite,
    refreshBackupDropdown,
    restoreBackupByIndex,
  };
}
