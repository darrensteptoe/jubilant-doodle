// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createDataBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };

  const replaceState = (nextState) => {
    call(deps.replaceState, nextState);
  };

  const getWindowRef = () => {
    if (deps.windowRef && typeof deps.windowRef === "object"){
      return deps.windowRef;
    }
    return typeof window !== "undefined" ? window : null;
  };

  const getDocumentRef = () => {
    if (deps.documentRef && typeof deps.documentRef === "object"){
      return deps.documentRef;
    }
    return typeof document !== "undefined" ? document : null;
  };

  const isHtmlSelect = (value) => typeof HTMLSelectElement !== "undefined" && value instanceof HTMLSelectElement;
  const isHtmlInput = (value) => typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement;
  const isHtmlElement = (value) => typeof HTMLElement !== "undefined" && value instanceof HTMLElement;

  let dataBridgeSelectedBackup = "";
  let dataBridgeImportFileName = "";
  let dataBridgeHashBannerText = "";
  let dataBridgeWarnBannerText = "";
  let dataBridgeUsbStatusText = "";
  let dataBridgeSelectedArchiveHash = "";
  let dataBridgeVoterImportStatusText = "";

  function dataBridgeBuildBackupOptions(){
    const selectEl = deps?.els?.restoreBackup;
    if (isHtmlSelect(selectEl)) {
      return Array.from(selectEl.options || [])
        .filter((opt) => opt && String(opt.value || "").trim())
        .map((opt) => ({
          value: String(opt.value || ""),
          label: String(opt.textContent || "").trim() || String(opt.value || "")
        }));
    }
    const backups = call(deps.readBackups) || [];
    return backups.map((entry, idx) => {
      const when = entry?.ts ? String(entry.ts).replace("T", " ").replace("Z", "") : "";
      const name = String(entry?.scenarioName || "").trim();
      const label = `${when}${name ? ` — ${name}` : ""}`.trim() || `Backup ${idx + 1}`;
      return { value: String(idx), label };
    });
  }

  function dataBridgeBuildArchiveRows(){
    const entries = call(deps.readForecastArchive, call(deps.forecastArchiveContextFromState));
    return Array.isArray(entries) ? entries : [];
  }

  function dataBridgeBuildArchiveOptions(entries = []){
    return call(deps.buildForecastArchiveOptions, entries) || [];
  }

  function dataBridgeEnsureVoterImportDraftState(){
    const state = getState();
    if (!state.ui || typeof state.ui !== "object"){
      state.ui = {};
    }
    if (!state.ui.voterImportDraft || typeof state.ui.voterImportDraft !== "object"){
      state.ui.voterImportDraft = {};
    }
    const draft = state.ui.voterImportDraft;
    draft.adapterId = String(draft.adapterId || "").trim();
    draft.sourceId = String(draft.sourceId || "").trim();
    return draft;
  }

  function dataBridgeEnsureReportingState(){
    const state = getState();
    if (!state.ui || typeof state.ui !== "object"){
      state.ui = {};
    }
    if (!state.ui.reporting || typeof state.ui.reporting !== "object"){
      state.ui.reporting = {};
    }
    const reporting = state.ui.reporting;
    if (!reporting.request || typeof reporting.request !== "object"){
      reporting.request = {};
    }
    reporting.request.type = call(deps.normalizeReportType, reporting.request.type);
    if (typeof reporting.previewText !== "string"){
      reporting.previewText = "";
    }
    if (typeof reporting.lastStatus !== "string"){
      reporting.lastStatus = "";
    }
    if (typeof reporting.lastGeneratedAt !== "string"){
      reporting.lastGeneratedAt = "";
    }
    if (!reporting.lastPayload || typeof reporting.lastPayload !== "object"){
      reporting.lastPayload = null;
    }
    return reporting;
  }

  function dataBridgeHasFsSupport(){
    const win = getWindowRef();
    return !!win
      && !!win.isSecureContext
      && typeof win.showDirectoryPicker === "function";
  }

  function dataBridgeNormalizeWarnings(list){
    const arr = Array.isArray(list) ? list : [];
    const benignUnknownFields = new Set(["buildId", "appVersion", "timestamp"]);
    const seen = new Set();
    const out = [];
    for (const item of arr){
      const text = String(item == null ? "" : item).trim();
      if (!text) continue;
      const m = text.match(/^Unknown field '([^']+)' ignored\.?$/i);
      if (m && benignUnknownFields.has(String(m[1] || "").trim())) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  }

  function dataBridgeSetHashBannerText(text){
    dataBridgeHashBannerText = String(text || "").trim();
  }

  function dataBridgeSetWarnBannerText(text){
    dataBridgeWarnBannerText = String(text || "").trim();
  }

  function dataBridgeSetImportFileName(name){
    dataBridgeImportFileName = String(name || "").trim();
  }

  function dataBridgeSetUsbStatusText(text){
    dataBridgeUsbStatusText = String(text || "").trim();
  }

  function dataBridgeSetVoterImportStatusText(text){
    dataBridgeVoterImportStatusText = String(text || "").trim();
  }

  function dataBridgeApplyUsbResultStatus(result){
    if (result?.ok){
      dataBridgeSetUsbStatusText("");
      return;
    }
    if (result?.canceled){
      dataBridgeSetUsbStatusText("Folder connect canceled.");
      return;
    }
    const code = String(result?.error || "").trim();
    switch (code){
      case "unsupported":
        dataBridgeSetUsbStatusText("External folder storage requires HTTPS and File System Access browser support.");
        break;
      case "permission_denied":
        dataBridgeSetUsbStatusText("Folder permission denied.");
        break;
      case "not_connected":
        dataBridgeSetUsbStatusText("Connect folder before running this action.");
        break;
      case "missing_state_file":
        dataBridgeSetUsbStatusText("No state file found in connected folder.");
        break;
      case "load_failed":
        dataBridgeSetUsbStatusText("USB load failed.");
        break;
      case "serialize_failed":
      case "parse_failed":
      case "write_failed":
        dataBridgeSetUsbStatusText("USB save failed.");
        break;
      default:
        dataBridgeSetUsbStatusText("Using browser storage only.");
        break;
    }
  }

  function dataBridgeApplyImportedScenario(nextScenario){
    const normalized = call(deps.normalizeLoadedScenarioRuntime, nextScenario);
    replaceState(normalized);
    const state = getState();
    call(deps.observeContractEvent, {
      type: "state_rehydrated",
      action_name: "dataBridgeApplyImportedScenario",
      handler_name: "dataBridgeApplyImportedScenario",
      context: call(deps.diagnosticContextFromState, state),
      observed_behavior: "state rehydrated from imported scenario snapshot",
    });
    call(deps.refreshModelAuditFromArchive);
    call(deps.ensureScenarioRegistry);
    call(deps.ensureDecisionScaffold);
    try{
      const baseline = state?.ui?.scenarios?.[deps.SCENARIO_BASELINE_ID];
      if (baseline){
        baseline.inputs = call(deps.scenarioInputsFromState, state);
        baseline.outputs = call(deps.scenarioOutputsFromState, state);
      }
    } catch {}
    call(deps.applyStateToUI);
    call(deps.rebuildCandidateTable);
    call(deps.shellBridgeSyncPlaybookUiState);
    call(deps.applyThemeFromState);
    call(deps.render);
    call(deps.safeCall, () => { call(deps.renderDecisionSessionD1); });
    call(deps.persist);
    call(deps.notifyBridgeSync, { source: "bridge.data", reason: "scenario_imported" });
  }

  function dataBridgeRunSaveJson(){
    const state = getState();
    const scenarioClone = structuredClone(state);
    const snapshot = {
      modelVersion: deps.engine?.snapshot?.MODEL_VERSION,
      schemaVersion: deps.engine?.snapshot?.CURRENT_SCHEMA_VERSION,
      scenarioState: scenarioClone,
      appVersion: deps.APP_VERSION,
      buildId: deps.BUILD_ID
    };
    const payload = deps.engine?.snapshot?.makeScenarioExport?.(snapshot);
    if (deps.engine?.snapshot?.hasNonFiniteNumbers?.(payload)){
      dataBridgeSetWarnBannerText("Export blocked: scenario contains NaN/Infinity.");
      return { ok: false, code: "non_finite" };
    }
    call(deps.setLastExportHash, String(payload?.snapshotHash || "") || null);
    const filename = deps.engine?.snapshot?.makeTimestampedFilename?.("field-path-scenario", "json");
    const text = deps.engine?.snapshot?.deterministicStringify?.(payload, 2);
    call(deps.downloadText, text, filename, "application/json");
    return { ok: true };
  }

  function dataBridgeRunExportCsv(){
    const snapshot = call(deps.getLastResultsSnapshot);
    if (!snapshot){
      dataBridgeSetWarnBannerText("Nothing to export yet. Run a scenario first.");
      return { ok: false, code: "missing_snapshot" };
    }
    const csv = deps.engine?.snapshot?.planRowsToCsv?.(snapshot);
    if (/NaN|Infinity/.test(String(csv || ""))){
      dataBridgeSetWarnBannerText("CSV export blocked: contains NaN/Infinity.");
      return { ok: false, code: "non_finite" };
    }
    const filename = deps.engine?.snapshot?.makeTimestampedFilename?.("field-path-plan", "csv");
    call(deps.downloadText, csv, filename, "text/csv");
    return { ok: true };
  }

  async function dataBridgeRunCopySummary(){
    const snapshot = call(deps.getLastResultsSnapshot);
    if (!snapshot){
      dataBridgeSetWarnBannerText("Nothing to copy yet. Run a scenario first.");
      return { ok: false, code: "missing_snapshot" };
    }
    const text = deps.engine?.snapshot?.formatSummaryText?.(snapshot);
    const result = await deps.engine?.snapshot?.copyTextToClipboard?.(text);
    if (!result?.ok){
      dataBridgeSetWarnBannerText(result?.reason || "Copy failed.");
      return { ok: false, code: "copy_failed" };
    }
    return { ok: true };
  }

  function dataBridgePickJsonFile(){
    return new Promise((resolve) => {
      try{
        const doc = getDocumentRef();
        if (!doc){
          resolve(null);
          return;
        }
        const input = doc.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.hidden = true;
        input.addEventListener("change", () => {
          const file = input.files?.[0] || null;
          input.remove();
          resolve(file);
        }, { once: true });
        doc.body.appendChild(input);
        input.click();
      } catch {
        resolve(null);
      }
    });
  }

  async function dataBridgeImportJsonFile(file){
    const state = getState();
    const nextFile = file || null;
    if (!nextFile){
      return { ok: false, code: "missing_file" };
    }
    dataBridgeSetImportFileName(nextFile.name || "");
    dataBridgeSetWarnBannerText("");
    dataBridgeSetHashBannerText("");

    const loaded = await call(deps.readJsonFile, nextFile);
    if (!loaded || typeof loaded !== "object"){
      dataBridgeSetWarnBannerText("Import failed: invalid JSON.");
      return { ok: false, code: "invalid_json" };
    }

    const prePolicy = deps.engine?.snapshot?.checkStrictImportPolicy?.({
      strictMode: !!state?.ui?.strictImport,
      importedSchemaVersion: loaded.schemaVersion || null,
      currentSchemaVersion: deps.engine?.snapshot?.CURRENT_SCHEMA_VERSION,
      hashMismatch: false
    });
    if (!prePolicy?.ok){
      dataBridgeSetWarnBannerText((prePolicy?.issues || []).join(" "));
      return { ok: false, code: "policy_blocked" };
    }

    const migrated = deps.engine?.snapshot?.migrateSnapshot?.(loaded);
    const warnings = [];
    if (Array.isArray(migrated?.warnings)) warnings.push(...migrated.warnings);

    const validated = deps.engine?.snapshot?.validateScenarioExport?.(
      migrated?.snapshot,
      deps.engine?.snapshot?.MODEL_VERSION
    );
    if (!validated?.ok){
      dataBridgeSetWarnBannerText(`Import failed: ${validated?.reason || "invalid snapshot"}.`);
      return { ok: false, code: "validate_failed" };
    }

    const missing = call(deps.requiredScenarioKeysMissing, validated.scenario) || [];
    if (missing.length){
      dataBridgeSetWarnBannerText(`Import failed: missing fields: ${missing.join(", ")}`);
      return { ok: false, code: "missing_fields" };
    }

    const quality = deps.engine?.snapshot?.validateImportedScenarioData?.(validated.scenario);
    if (!quality?.ok){
      const detail = Array.isArray(quality?.errors) && quality.errors.length
        ? ` ${quality.errors[0]}`
        : "";
      dataBridgeSetWarnBannerText(`Import failed: quality checks failed.${detail}`);
      return { ok: false, code: "quality_failed" };
    }
    if (Array.isArray(quality?.warnings)) warnings.push(...quality.warnings);

    const normalizedWarnings = dataBridgeNormalizeWarnings(warnings);
    if (normalizedWarnings.length){
      const shown = normalizedWarnings.slice(0, 3).join(" • ");
      const extra = normalizedWarnings.length > 3 ? ` (+${normalizedWarnings.length - 3} more)` : "";
      dataBridgeSetWarnBannerText(`${shown}${extra}`.trim());
    } else {
      dataBridgeSetWarnBannerText("");
    }

    try{
      const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
      const recomputed = deps.engine?.snapshot?.computeSnapshotHash?.({
        modelVersion: validated.modelVersion,
        scenarioState: validated.scenario
      });
      const hashMismatch = !!(exportedHash && exportedHash !== recomputed);
      if (hashMismatch){
        dataBridgeSetHashBannerText("Snapshot hash differs from exported hash.");
      } else {
        dataBridgeSetHashBannerText("");
      }

      const policy = deps.engine?.snapshot?.checkStrictImportPolicy?.({
        strictMode: !!state?.ui?.strictImport,
        importedSchemaVersion: (migrated?.snapshot?.schemaVersion || loaded.schemaVersion || null),
        currentSchemaVersion: deps.engine?.snapshot?.CURRENT_SCHEMA_VERSION,
        hashMismatch
      });
      if (!policy?.ok){
        dataBridgeSetWarnBannerText((policy?.issues || []).join(" "));
        return { ok: false, code: "policy_blocked" };
      }
    } catch {
      if (state?.ui?.strictImport){
        dataBridgeSetWarnBannerText("Import blocked: could not verify integrity hash in strict mode.");
        return { ok: false, code: "hash_verify_failed" };
      }
    }

    dataBridgeApplyImportedScenario(validated.scenario);
    return { ok: true };
  }

  function dataBridgeStateView(){
    const state = getState();
    const strictToggle = deps?.els?.toggleStrictImport;
    const restoreSelect = deps?.els?.restoreBackup;
    const loadJsonInput = deps?.els?.loadJson;
    const usb = call(deps.getUsbStorageController);
    const usbConnected = !!usb?.isConnected?.();
    const strictImport =
      isHtmlInput(strictToggle)
        ? !!strictToggle.checked
        : !!state?.ui?.strictImport;
    const importFileName = dataBridgeImportFileName
      || (isHtmlInput(loadJsonInput) && loadJsonInput.files && loadJsonInput.files.length
        ? String(loadJsonInput.files[0]?.name || "")
        : "");
    const hashBannerText = dataBridgeHashBannerText
      || (isHtmlElement(deps?.els?.importHashBanner) && !deps.els.importHashBanner.hidden
        ? String(deps.els.importHashBanner.textContent || "").trim()
        : "");
    const warnBannerText = dataBridgeWarnBannerText
      || (isHtmlElement(deps?.els?.importWarnBanner) && !deps.els.importWarnBanner.hidden
        ? String(deps.els.importWarnBanner.textContent || "").trim()
        : "");
    const usbStatusText = dataBridgeUsbStatusText;
    const backupOptions = dataBridgeBuildBackupOptions();
    const canFs = dataBridgeHasFsSupport();
    const canUseSnapshot = !!call(deps.getLastResultsSnapshot);
    const archiveRows = dataBridgeBuildArchiveRows();
    const archiveSummary = call(deps.summarizeForecastArchive, archiveRows);
    const archiveContext = call(deps.forecastArchiveContextFromState);
    const activeContext = call(deps.resolveActiveContext, { fallback: archiveContext });
    const archiveOptions = dataBridgeBuildArchiveOptions(archiveRows);
    const archiveLookup = new Map(archiveRows.map((row) => [String(row?.snapshotHash || "").trim(), row]));
    const selectedArchiveHash = call(deps.resolveForecastArchiveSelectedHash, {
      preferredHash: dataBridgeSelectedArchiveHash,
      options: archiveOptions,
      lookup: archiveLookup,
    });
    dataBridgeSelectedArchiveHash = selectedArchiveHash;
    const selectedArchive = archiveLookup.get(selectedArchiveHash) || null;
    const selectedEntryView = call(deps.buildForecastArchiveSelectedEntryView, selectedArchive);
    const archiveLearning = call(deps.buildModelLearningFromArchive, archiveRows) || {};
    const modelAuditSummary = archiveLearning.modelAudit;
    const learningSummary = archiveLearning.learning;
    const archiveTableRows = call(deps.buildForecastArchiveTableRows, archiveRows, { limit: 40 }) || [];
    const voterLayer = call(deps.buildVoterLayerStatusSnapshot, state?.voterData);
    const voterImportDraftState = dataBridgeEnsureVoterImportDraftState();
    const voterAdapterOptions = call(deps.listVoterAdapterOptions) || [];
    const selectedVoterAdapter = call(deps.normalizeBridgeSelectValue,
      voterImportDraftState?.adapterId,
      voterAdapterOptions.map((row) => ({
        value: String(row?.id || "").trim(),
        label: String(row?.label || row?.id || "").trim(),
      })),
      "canonical",
    );
    voterImportDraftState.adapterId = selectedVoterAdapter;
    const voterSourceId = String(voterImportDraftState?.sourceId || "").trim();
    const reporting = dataBridgeEnsureReportingState();
    const reportTypeOptions = (call(deps.listReportTypeOptions) || []).map((row) => ({
      value: String(row?.id || "").trim(),
      label: String(row?.label || row?.id || "").trim() || String(row?.id || ""),
    }));
    const selectedReportType = call(deps.normalizeBridgeSelectValue,
      reporting?.request?.type,
      reportTypeOptions,
      "internal"
    );
    reporting.request.type = selectedReportType;
    const hasReportPayload = !!(reporting?.lastPayload && typeof reporting.lastPayload === "object");
    const previewText = String(
      reporting?.previewText
        || (hasReportPayload ? call(deps.buildReportPlainText, reporting.lastPayload) : "")
        || ""
    );
    reporting.previewText = previewText;
    const reportStatus = String(reporting?.lastStatus || "").trim()
      || (hasReportPayload ? "Report composed." : "Choose report type and compose.");

    return {
      context: {
        campaignId: String(activeContext?.campaignId || "").trim(),
        campaignName: String(activeContext?.campaignName || archiveContext?.campaignName || "").trim(),
        officeId: String(activeContext?.officeId || "").trim(),
        scenarioId: String(activeContext?.scenarioId || archiveContext?.scenarioId || "").trim(),
        isCampaignLocked: !!activeContext?.isCampaignLocked,
        isOfficeLocked: !!activeContext?.isOfficeLocked,
        isScenarioLocked: !!activeContext?.isScenarioLocked,
      },
      strictImport,
      backupOptions,
      selectedBackup: dataBridgeSelectedBackup || (isHtmlSelect(restoreSelect) ? String(restoreSelect.value || "") : ""),
      importFileName,
      voterImportStatus: dataBridgeVoterImportStatusText,
      voterImportDraft: {
        adapterId: selectedVoterAdapter,
        sourceId: voterSourceId,
      },
      hashBannerText,
      warnBannerText,
      usbConnected,
      usbStatus: usbStatusText || (usbConnected ? "External folder connected." : "Using browser storage only."),
      forecastArchive: {
        summary: archiveSummary,
        options: archiveOptions,
        selectedHash: selectedArchiveHash,
        selectedEntry: selectedEntryView,
        rows: archiveTableRows,
        modelAudit: modelAuditSummary,
        learning: learningSummary,
      },
      reporting: {
        options: reportTypeOptions,
        selectedType: selectedReportType,
        status: reportStatus,
        previewText,
        generatedAt: String(reporting?.lastGeneratedAt || "").trim(),
        hasPayload: hasReportPayload,
      },
      voterLayer,
      controls: {
        strictToggleDisabled: false,
        restoreDisabled: !backupOptions.length,
        saveJsonDisabled: false,
        loadJsonDisabled: false,
        copySummaryDisabled: !canUseSnapshot,
        exportCsvDisabled: !canUseSnapshot,
        usbConnectDisabled: !canFs,
        usbLoadDisabled: !(canFs && usbConnected),
        usbSaveDisabled: !(canFs && usbConnected),
        usbDisconnectDisabled: !canFs,
        voterImportDisabled: false,
        archiveSelectionDisabled: !archiveOptions.length,
        archiveSaveDisabled: !selectedArchiveHash,
        archiveRefreshDisabled: false,
        reportTypeDisabled: false,
        reportComposeDisabled: false,
        reportExportPdfDisabled: !hasReportPayload,
      }
    };
  }

  function dataBridgeSetStrictImport(enabled){
    const next = !!enabled;
    call(deps.setState, (s) => {
      if (!s.ui || typeof s.ui !== "object") s.ui = {};
      s.ui.strictImport = next;
    });
    try{
      const doc = getDocumentRef();
      doc?.body?.classList?.toggle("strict-import", next);
    } catch {}
    if (isHtmlInput(deps?.els?.toggleStrictImport)){
      deps.els.toggleStrictImport.checked = next;
    }
    return { ok: true, view: dataBridgeStateView() };
  }

  function dataBridgeRestoreBackup(index){
    const value = String(index ?? "").trim();
    if (!value){
      return { ok: false, code: "missing_index", view: dataBridgeStateView() };
    }
    dataBridgeSelectedBackup = value;
    call(deps.restoreBackupByIndex, value);
    call(deps.refreshModelAuditFromArchive);
    dataBridgeSelectedBackup = "";
    if (isHtmlSelect(deps?.els?.restoreBackup)){
      deps.els.restoreBackup.value = "";
    }
    call(deps.notifyBridgeSync, { source: "bridge.data", reason: "backup_restored" });
    return { ok: true, view: dataBridgeStateView() };
  }

  function dataBridgeSetArchiveSelection(snapshotHash){
    const hash = String(snapshotHash || "").trim();
    dataBridgeSelectedArchiveHash = hash;
    return { ok: true, view: dataBridgeStateView() };
  }

  function dataBridgeSetVoterImportDraft(payload = {}){
    const src = payload && typeof payload === "object" ? payload : {};
    const prev = dataBridgeEnsureVoterImportDraftState();
    const nextAdapterId = Object.prototype.hasOwnProperty.call(src, "adapterId")
      ? String(src.adapterId || "").trim()
      : prev.adapterId;
    const nextSourceId = Object.prototype.hasOwnProperty.call(src, "sourceId")
      ? String(src.sourceId || "").trim()
      : prev.sourceId;
    if (nextAdapterId === prev.adapterId && nextSourceId === prev.sourceId){
      return { ok: true, view: dataBridgeStateView() };
    }
    call(deps.setState, (s) => {
      if (!s.ui || typeof s.ui !== "object"){
        s.ui = {};
      }
      const currentDraft = s.ui.voterImportDraft && typeof s.ui.voterImportDraft === "object"
        ? s.ui.voterImportDraft
        : {};
      s.ui.voterImportDraft = {
        ...currentDraft,
        adapterId: nextAdapterId,
        sourceId: nextSourceId,
      };
    }, { actionName: "dataBridgeSetVoterImportDraft" });
    call(deps.schedulePersist);
    call(deps.notifyBridgeSync, { source: "bridge.data", reason: "voter_import_draft_updated" });
    return {
      ok: true,
      draft: { adapterId: nextAdapterId, sourceId: nextSourceId },
      view: dataBridgeStateView(),
    };
  }

  function dataBridgeSaveArchiveActual(payload = {}){
    const src = payload && typeof payload === "object" ? payload : {};
    const snapshotHash = String(src.snapshotHash || dataBridgeSelectedArchiveHash || "").trim();
    if (!snapshotHash){
      return { ok: false, code: "missing_snapshot_hash", view: dataBridgeStateView() };
    }
    const actual = call(deps.normalizeForecastArchiveActual, src.actual);
    const notes = String(src.notes || "").trim();
    const result = call(deps.updateForecastArchiveActual, {
      snapshotHash,
      actual,
      notes,
    }, call(deps.forecastArchiveContextFromState));
    if (!result?.ok){
      return { ok: false, code: String(result?.error || "archive_update_failed"), view: dataBridgeStateView() };
    }
    call(deps.refreshModelAuditFromArchive);
    call(deps.schedulePersist);
    call(deps.notifyBridgeSync, { source: "bridge.data", reason: "archive_actual_saved" });
    return { ok: true, view: dataBridgeStateView() };
  }

  function dataBridgeRefreshArchive(){
    call(deps.refreshModelAuditFromArchive);
    return { ok: true, view: dataBridgeStateView() };
  }

  function dataBridgeImportVoterRows(payload = {}){
    const state = getState();
    const src = payload && typeof payload === "object" ? payload : {};
    const parsed = call(deps.parseVoterRowsInput, src.rows ?? src.text ?? src.input, {
      format: src.format,
      maxRows: src.maxRows,
    });
    if (!parsed?.ok){
      const msg = parsed?.errors?.[0] || "Voter import failed.";
      dataBridgeSetVoterImportStatusText(msg);
      dataBridgeSetWarnBannerText(msg);
      return { ok: false, code: "voter_import_invalid", errors: parsed?.errors || [], view: dataBridgeStateView() };
    }

    const activeContext = call(deps.resolveActiveContext, { fallback: call(deps.forecastArchiveContextFromState) });
    const campaignId = String(
      activeContext?.isCampaignLocked
        ? (activeContext?.campaignId || "")
        : (src.campaignId || activeContext?.campaignId || "")
    ).trim();
    const officeId = String(
      activeContext?.isOfficeLocked
        ? (activeContext?.officeId || "")
        : (src.officeId || activeContext?.officeId || "")
    ).trim();
    const draft = dataBridgeEnsureVoterImportDraftState();
    const adapterId = String(src.adapterId || draft.adapterId || "").trim();
    const sourceId = String(src.sourceId || draft.sourceId || src.fileName || "").trim()
      || `voter_import_${new Date().toISOString()}`;
    const normalizedRows = call(deps.normalizeVoterRows, parsed.rows, {
      adapterId,
      campaignId,
      officeId,
      sourceId,
      headerMap: src.headerMap,
      manifest: src.manifest,
    });
    const nextVoterData = call(deps.normalizeVoterDataState, {
      manifest: normalizedRows?.manifest,
      rows: normalizedRows?.rows,
    });
    call(deps.mutateState, (s) => {
      s.voterData = nextVoterData;
    });
    const importOutcome = call(deps.buildVoterImportOutcomeView, {
      voterDataState: nextVoterData,
      warnings: parsed.warnings,
    }) || {};
    dataBridgeSetVoterImportStatusText(importOutcome.statusText);
    if (importOutcome.warningText){
      dataBridgeSetWarnBannerText(importOutcome.warningText);
    } else {
      dataBridgeSetWarnBannerText("");
    }
    call(deps.schedulePersist);
    return { ok: true, importedRows: importOutcome.rowCount, warnings: parsed.warnings, view: dataBridgeStateView() };
  }

  function dataBridgeComposeReport(payload = {}){
    const state = getState();
    const src = payload && typeof payload === "object" ? payload : {};
    const reporting = dataBridgeEnsureReportingState();
    const requestedType = call(deps.normalizeReportType, src.reportType || reporting.request.type);
    reporting.request.type = requestedType;
    const report = call(deps.composeReportPayload, {
      reportType: requestedType,
      state,
      renderCtx: call(deps.getLastRenderCtx),
      resultsSnapshot: call(deps.getLastResultsSnapshot),
      nowDate: new Date(),
    });
    reporting.lastPayload = report;
    reporting.previewText = call(deps.buildReportPlainText, report);
    reporting.lastGeneratedAt = String(report?.generatedAt || new Date().toISOString());
    reporting.lastStatus = `Composed ${String(report?.reportLabel || requestedType)} at ${reporting.lastGeneratedAt}.`;
    const reportContext = report?.context && typeof report.context === "object" ? report.context : {};
    call(deps.observeContractEvent, {
      type: "report_composed",
      action_name: "dataBridgeComposeReport",
      handler_name: "dataBridgeComposeReport",
      reportType: requestedType,
      reportContext: {
        campaignId: String(reportContext?.campaignId || "").trim(),
        officeId: String(reportContext?.officeId || "").trim(),
        scenarioId: String(reportContext?.scenarioId || "").trim(),
      },
      reportHasCanonicalSnapshot: !!call(deps.getLastResultsSnapshot),
      reportHasValidation: !!state?.ui?.lastValidationSnapshot,
      reportHasRealism: !!state?.ui?.lastRealismSnapshot,
      reportHasGovernance: !!state?.ui?.lastGovernanceSnapshot,
      requiresValidation: true,
      validationReady: !!state?.ui?.lastValidationSnapshot,
      observed_behavior: `report composed (${requestedType})`,
    });
    dataBridgeSetWarnBannerText("");
    call(deps.schedulePersist);
    call(deps.notifyBridgeSync, { source: "bridge.data", reason: "report_composed" });
    return { ok: true, report, view: dataBridgeStateView() };
  }

  function dataBridgeSetReportType(reportType){
    const reporting = dataBridgeEnsureReportingState();
    const nextType = call(deps.normalizeReportType, reportType || reporting.request.type);
    reporting.request.type = nextType;
    const composed = dataBridgeComposeReport({ reportType: nextType });
    return {
      ok: !!composed?.ok,
      reportType: nextType,
      view: composed?.view || dataBridgeStateView(),
    };
  }

  function dataBridgeExportReportPdf(payload = {}){
    const state = getState();
    const src = payload && typeof payload === "object" ? payload : {};
    const reporting = dataBridgeEnsureReportingState();
    const requestedType = call(deps.normalizeReportType, src.reportType || reporting.request.type);
    let report = reporting.lastPayload;
    if (!report || call(deps.normalizeReportType, report?.reportType) !== requestedType){
      const composed = dataBridgeComposeReport({ reportType: requestedType });
      if (!composed?.ok){
        return { ok: false, code: "report_compose_failed", view: dataBridgeStateView() };
      }
      report = composed.report;
    }
    const context = report?.context && typeof report.context === "object" ? report.context : {};
    const fileBase = [
      call(deps.normalizeReportType, report?.reportType || requestedType),
      String(context?.campaignId || context?.campaignName || "campaign").trim(),
      String(context?.officeId || "office").trim(),
      String(context?.scenarioId || "scenario").trim(),
    ].map((part) => String(part || "").replace(/\s+/g, "-")).filter(Boolean).join("-");
    const result = call(deps.exportReportPdf, report, { filenameBase: fileBase || "report" });
    if (!result?.ok){
      dataBridgeSetWarnBannerText("Report PDF export failed.");
      return { ok: false, code: "report_export_failed", view: dataBridgeStateView() };
    }
    reporting.lastStatus = result.code === "print_dialog_opened"
      ? "Print dialog opened. Choose Save as PDF to complete export."
      : `Report exported via ${result.code}.`;
    call(deps.observeContractEvent, {
      type: "report_exported",
      action_name: "dataBridgeExportReportPdf",
      handler_name: "dataBridgeExportReportPdf",
      reportType: requestedType,
      reportContext: {
        campaignId: String(context?.campaignId || "").trim(),
        officeId: String(context?.officeId || "").trim(),
        scenarioId: String(context?.scenarioId || "").trim(),
      },
      reportHasCanonicalSnapshot: !!call(deps.getLastResultsSnapshot),
      reportHasValidation: !!state?.ui?.lastValidationSnapshot,
      reportHasRealism: !!state?.ui?.lastRealismSnapshot,
      reportHasGovernance: !!state?.ui?.lastGovernanceSnapshot,
      requiresValidation: true,
      validationReady: !!state?.ui?.lastValidationSnapshot,
      observed_behavior: `report exported (${requestedType}) via ${String(result.code || "unknown")}`,
    });
    dataBridgeSetWarnBannerText("");
    call(deps.schedulePersist);
    call(deps.notifyBridgeSync, { source: "bridge.data", reason: "report_pdf_exported" });
    return { ok: true, code: String(result.code || "ok"), view: dataBridgeStateView() };
  }

  function dataBridgeTrigger(action){
    const key = String(action || "").trim();
    switch (key){
      case "save_json":
        return { ...dataBridgeRunSaveJson(), view: dataBridgeStateView() };
      case "export_csv":
        return { ...dataBridgeRunExportCsv(), view: dataBridgeStateView() };
      case "copy_summary":
        return dataBridgeRunCopySummary()
          .then((result) => ({ ...(result || { ok: false, code: "copy_failed" }), view: dataBridgeStateView() }))
          .catch(() => ({ ok: false, code: "copy_failed", view: dataBridgeStateView() }));
      case "load_json":
        return dataBridgePickJsonFile()
          .then((file) => dataBridgeImportJsonFile(file))
          .then((result) => ({ ...(result || { ok: false, code: "import_failed" }), view: dataBridgeStateView() }))
          .catch(() => {
            dataBridgeSetWarnBannerText("Import failed.");
            return { ok: false, code: "import_failed", view: dataBridgeStateView() };
          });
      case "usb_connect":
        return call(deps.getUsbStorageController).connect()
          .then((result) => {
            if (result?.ok){
              dataBridgeSetWarnBannerText("");
            }
            dataBridgeApplyUsbResultStatus(result);
            return { ...(result || { ok: false, code: "usb_connect_failed" }), view: dataBridgeStateView() };
          })
          .catch(() => ({ ok: false, code: "usb_connect_failed", view: dataBridgeStateView() }));
      case "usb_load":
        return call(deps.getUsbStorageController).loadFromFolder()
          .then((result) => {
            dataBridgeApplyUsbResultStatus(result);
            return { ...(result || { ok: false, code: "usb_load_failed" }), view: dataBridgeStateView() };
          })
          .catch(() => ({ ok: false, code: "usb_load_failed", view: dataBridgeStateView() }));
      case "usb_save":
        return call(deps.getUsbStorageController).saveNow({ requestPermission: true })
          .then((result) => {
            dataBridgeApplyUsbResultStatus(result);
            return { ...(result || { ok: false, code: "usb_save_failed" }), view: dataBridgeStateView() };
          })
          .catch(() => ({ ok: false, code: "usb_save_failed", view: dataBridgeStateView() }));
      case "usb_disconnect":
        return call(deps.getUsbStorageController).disconnect()
          .then((result) => {
            dataBridgeApplyUsbResultStatus(result);
            return { ...(result || { ok: false, code: "usb_disconnect_failed" }), view: dataBridgeStateView() };
          })
          .catch(() => ({ ok: false, code: "usb_disconnect_failed", view: dataBridgeStateView() }));
      case "compose_report":
        return dataBridgeComposeReport();
      case "export_report_pdf":
        return dataBridgeExportReportPdf();
      default:
        return { ok: false, code: "not_available", view: dataBridgeStateView() };
    }
  }

  function installDataBridge(){
    const win = getWindowRef();
    if (!win || typeof win !== "object") return;
    win[deps.dataBridgeKey] = {
      getView: () => dataBridgeStateView(),
      setStrictImport: (enabled) => dataBridgeSetStrictImport(enabled),
      restoreBackup: (index) => dataBridgeRestoreBackup(index),
      setArchiveSelection: (snapshotHash) => dataBridgeSetArchiveSelection(snapshotHash),
      setVoterImportDraft: (payload) => dataBridgeSetVoterImportDraft(payload),
      setReportType: (reportType) => dataBridgeSetReportType(reportType),
      composeReport: (payload) => dataBridgeComposeReport(payload),
      exportReportPdf: (payload) => dataBridgeExportReportPdf(payload),
      saveArchiveActual: (payload) => dataBridgeSaveArchiveActual(payload),
      refreshArchive: () => dataBridgeRefreshArchive(),
      importVoterRows: (payload) => dataBridgeImportVoterRows(payload),
      trigger: (action) => dataBridgeTrigger(action),
    };
  }

  return {
    dataBridgeBuildBackupOptions,
    dataBridgeBuildArchiveRows,
    dataBridgeBuildArchiveOptions,
    dataBridgeEnsureVoterImportDraftState,
    dataBridgeEnsureReportingState,
    dataBridgeHasFsSupport,
    dataBridgeNormalizeWarnings,
    dataBridgeSetHashBannerText,
    dataBridgeSetWarnBannerText,
    dataBridgeSetImportFileName,
    dataBridgeSetUsbStatusText,
    dataBridgeSetVoterImportStatusText,
    dataBridgeApplyUsbResultStatus,
    dataBridgeApplyImportedScenario,
    dataBridgeRunSaveJson,
    dataBridgeRunExportCsv,
    dataBridgeRunCopySummary,
    dataBridgePickJsonFile,
    dataBridgeImportJsonFile,
    dataBridgeStateView,
    dataBridgeSetStrictImport,
    dataBridgeRestoreBackup,
    dataBridgeSetArchiveSelection,
    dataBridgeSetVoterImportDraft,
    dataBridgeSaveArchiveActual,
    dataBridgeRefreshArchive,
    dataBridgeImportVoterRows,
    dataBridgeComposeReport,
    dataBridgeSetReportType,
    dataBridgeExportReportPdf,
    dataBridgeTrigger,
    installDataBridge,
  };
}
