export function wireBudgetTimelineEvents(ctx){
  const { els, state: initialState, getState, safeNum, commitUIUpdate, render } = ctx || {};
  const currentState = () => {
    if (typeof getState === "function"){
      const s = getState();
      return (s && typeof s === "object") ? s : null;
    }
    return (initialState && typeof initialState === "object") ? initialState : null;
  };
  const withState = (fn) => {
    const s = currentState();
    if (!s) return;
    fn(s);
  };

  if (!els || !currentState()) return;

  const ensureBudget = (state) => {
    if (!state.budget){
      state.budget = {
        overheadAmount: 0,
        includeOverhead: false,
        tactics: {
          doors: { enabled: true, cpa: 0, crPct: null, srPct: null, kind: "persuasion" },
          phones: { enabled: true, cpa: 0, crPct: null, srPct: null, kind: "persuasion" },
          texts: { enabled: false, cpa: 0, crPct: null, srPct: null, kind: "persuasion" }
        },
        optimize: {
          mode: "budget",
          budgetAmount: 10000,
          capacityAttempts: "",
          step: 25,
          useDecay: false,
          objective: "net",
          tlConstrainedEnabled: false,
          tlConstrainedObjective: "max_net"
        }
      };
    }
    if (!state.budget.tactics) state.budget.tactics = { doors: { enabled: true, cpa: 0, crPct: null, srPct: null }, phones: { enabled: true, cpa: 0, crPct: null, srPct: null }, texts: { enabled: false, cpa: 0, crPct: null, srPct: null } };
    if (!state.budget.optimize) state.budget.optimize = { mode: "budget", budgetAmount: 10000, capacityAttempts: "", step: 25, useDecay: false, objective: "net", tlConstrainedEnabled: false, tlConstrainedObjective: "max_net" };
    if (!state.budget.tactics.doors) state.budget.tactics.doors = { enabled: true, cpa: 0, crPct: null, srPct: null };
    if (!state.budget.tactics.phones) state.budget.tactics.phones = { enabled: true, cpa: 0, crPct: null, srPct: null };
    if (!state.budget.tactics.texts) state.budget.tactics.texts = { enabled: false, cpa: 0, crPct: null, srPct: null };
  };

  const watchBool = (el, fn) => {
    if (!el) return;
    el.addEventListener("change", () => {
      withState((state) => {
        ensureBudget(state);
        fn(state);
      });
      commitUIUpdate();
    });
  };

  const watchNum = (el, fn) => {
    if (!el) return;
    el.addEventListener("input", () => {
      withState((state) => {
        ensureBudget(state);
        fn(state);
      });
      commitUIUpdate();
    });
  };

  watchBool(els.roiDoorsEnabled, (state) => { state.budget.tactics.doors.enabled = !!els.roiDoorsEnabled.checked; });
  watchNum(els.roiDoorsCpa, (state) => { state.budget.tactics.doors.cpa = safeNum(els.roiDoorsCpa.value) ?? 0; });
  watchNum(els.roiDoorsCr, (state) => { state.budget.tactics.doors.crPct = safeNum(els.roiDoorsCr.value); });
  watchNum(els.roiDoorsSr, (state) => { state.budget.tactics.doors.srPct = safeNum(els.roiDoorsSr.value); });

  watchBool(els.roiPhonesEnabled, (state) => { state.budget.tactics.phones.enabled = !!els.roiPhonesEnabled.checked; });
  watchNum(els.roiPhonesCpa, (state) => { state.budget.tactics.phones.cpa = safeNum(els.roiPhonesCpa.value) ?? 0; });
  watchNum(els.roiPhonesCr, (state) => { state.budget.tactics.phones.crPct = safeNum(els.roiPhonesCr.value); });
  watchNum(els.roiPhonesSr, (state) => { state.budget.tactics.phones.srPct = safeNum(els.roiPhonesSr.value); });

  watchBool(els.roiTextsEnabled, (state) => { state.budget.tactics.texts.enabled = !!els.roiTextsEnabled.checked; });
  watchNum(els.roiTextsCpa, (state) => { state.budget.tactics.texts.cpa = safeNum(els.roiTextsCpa.value) ?? 0; });
  watchNum(els.roiTextsCr, (state) => { state.budget.tactics.texts.crPct = safeNum(els.roiTextsCr.value); });
  watchNum(els.roiTextsSr, (state) => { state.budget.tactics.texts.srPct = safeNum(els.roiTextsSr.value); });

  watchNum(els.roiOverheadAmount, (state) => { state.budget.overheadAmount = safeNum(els.roiOverheadAmount.value) ?? 0; });
  watchBool(els.roiIncludeOverhead, (state) => { state.budget.includeOverhead = !!els.roiIncludeOverhead.checked; });

  const watchOpt = (el, fn, evt = "input") => {
    if (!el) return;
    el.addEventListener(evt, () => {
      withState((state) => {
        ensureBudget(state);
        fn(state);
      });
      commitUIUpdate();
    });
  };

  watchOpt(els.optMode, (state) => { state.budget.optimize.mode = els.optMode.value; }, "change");
  watchOpt(els.optObjective, (state) => { state.budget.optimize.objective = els.optObjective.value; }, "change");
  watchOpt(els.tlOptEnabled, (state) => { state.budget.optimize.tlConstrainedEnabled = !!els.tlOptEnabled.checked; }, "change");
  watchOpt(els.tlOptObjective, (state) => { state.budget.optimize.tlConstrainedObjective = els.tlOptObjective.value || "max_net"; }, "change");
  watchOpt(els.optBudget, (state) => { state.budget.optimize.budgetAmount = safeNum(els.optBudget.value) ?? 0; });
  watchOpt(els.optCapacity, (state) => { state.budget.optimize.capacityAttempts = els.optCapacity.value ?? ""; });
  watchOpt(els.optStep, (state) => { state.budget.optimize.step = safeNum(els.optStep.value) ?? 25; });
  watchOpt(els.optUseDecay, (state) => { state.budget.optimize.useDecay = !!els.optUseDecay.checked; }, "change");

  const watchTL = (el, fn, evt = "input") => {
    if (!el) return;
    el.addEventListener(evt, () => {
      withState((state) => { fn(state); });
      commitUIUpdate();
    });
  };

  watchTL(els.timelineEnabled, (state) => { state.timelineEnabled = !!els.timelineEnabled.checked; }, "change");
  watchTL(els.timelineActiveWeeks, (state) => { state.timelineActiveWeeks = els.timelineActiveWeeks.value ?? ""; });
  watchTL(els.timelineGotvWeeks, (state) => { state.timelineGotvWeeks = safeNum(els.timelineGotvWeeks.value); });
  watchTL(els.timelineStaffCount, (state) => { state.timelineStaffCount = safeNum(els.timelineStaffCount.value) ?? 0; });
  watchTL(els.timelineStaffHours, (state) => { state.timelineStaffHours = safeNum(els.timelineStaffHours.value) ?? 0; });
  watchTL(els.timelineVolCount, (state) => { state.timelineVolCount = safeNum(els.timelineVolCount.value) ?? 0; });
  watchTL(els.timelineVolHours, (state) => { state.timelineVolHours = safeNum(els.timelineVolHours.value) ?? 0; });
  watchTL(els.timelineRampEnabled, (state) => { state.timelineRampEnabled = !!els.timelineRampEnabled.checked; }, "change");
  watchTL(els.timelineRampMode, (state) => { state.timelineRampMode = els.timelineRampMode.value || "linear"; }, "change");
  watchTL(els.timelineDoorsPerHour, (state) => { state.timelineDoorsPerHour = safeNum(els.timelineDoorsPerHour.value) ?? 0; });
  watchTL(els.timelineCallsPerHour, (state) => { state.timelineCallsPerHour = safeNum(els.timelineCallsPerHour.value) ?? 0; });
  watchTL(els.timelineTextsPerHour, (state) => { state.timelineTextsPerHour = safeNum(els.timelineTextsPerHour.value) ?? 0; });

  if (els.optRun) els.optRun.addEventListener("click", () => { render(); });
  if (els.roiRefresh) els.roiRefresh.addEventListener("click", () => { render(); });
}

export function wireTabAndExportEvents(ctx){
  const {
    els,
    getState,
    persist,
    engine,
    APP_VERSION,
    BUILD_ID,
    getLastResultsSnapshot,
    setLastExportHash,
    downloadText,
  } = ctx || {};
  if (!els || typeof getState !== "function" || typeof persist !== "function") return;

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      const panel = document.getElementById(`tab-${tab}`);

      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      if (panel){
        const state = getState();
        if (state?.ui) state.ui.activeTab = tab;
        panel.classList.add("active");
      } else {
        const state = getState();
        if (state?.ui) state.ui.activeTab = "win";
        document.getElementById("tab-win")?.classList.add("active");
      }
      persist();
    });
  });

  if (els.btnSaveJson){
    els.btnSaveJson.addEventListener("click", () => {
      const state = getState();
      if (!state || !engine?.snapshot) return;
      const scenarioClone = structuredClone(state);
      const snapshot = {
        modelVersion: engine.snapshot.MODEL_VERSION,
        schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
        scenarioState: scenarioClone,
        appVersion: APP_VERSION,
        buildId: BUILD_ID
      };
      snapshot.snapshotHash = engine.snapshot.computeSnapshotHash(snapshot);
      if (typeof setLastExportHash === "function") setLastExportHash(snapshot.snapshotHash);
      const payload = engine.snapshot.makeScenarioExport(snapshot);
      if (engine.snapshot.hasNonFiniteNumbers(payload)){
        alert("Export blocked: scenario contains NaN/Infinity.");
        return;
      }
      const filename = engine.snapshot.makeTimestampedFilename("field-path-scenario", "json");
      const text = engine.snapshot.deterministicStringify(payload, 2);
      downloadText(text, filename, "application/json");
    });
  }

  if (els.btnExportCsv){
    els.btnExportCsv.addEventListener("click", () => {
      const snap = (typeof getLastResultsSnapshot === "function") ? getLastResultsSnapshot() : null;
      if (!snap){
        alert("Nothing to export yet. Run a scenario first.");
        return;
      }
      const csv = engine.snapshot.planRowsToCsv(snap);
      if (/NaN|Infinity/.test(csv)){
        alert("CSV export blocked: contains NaN/Infinity.");
        return;
      }
      const filename = engine.snapshot.makeTimestampedFilename("field-path-plan", "csv");
      downloadText(csv, filename, "text/csv");
    });
  }

  if (els.btnCopySummary){
    els.btnCopySummary.addEventListener("click", async () => {
      const snap = (typeof getLastResultsSnapshot === "function") ? getLastResultsSnapshot() : null;
      if (!snap){
        alert("Nothing to copy yet. Run a scenario first.");
        return;
      }
      const text = engine.snapshot.formatSummaryText(snap);
      const r = await engine.snapshot.copyTextToClipboard(text);
      if (!r.ok) alert(r.reason || "Copy failed.");
    });
  }
}

export function wireResetImportAndUiToggles(ctx){
  const {
    els,
    getState,
    replaceState,
    makeDefaultState,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    clearState,
    applyStateToUI,
    rebuildCandidateTable,
    applyThemeFromState,
    render,
    safeCall,
    renderScenarioManagerC1,
    renderDecisionSessionD1,
    persist,
    readJsonFile,
    engine,
    requiredScenarioKeysMissing,
    normalizeLoadedState,
    setText,
    getLastResultsSnapshot,
  } = ctx || {};

  if (!els || typeof getState !== "function" || typeof replaceState !== "function") return;

  if (els.btnResetAll){
    els.btnResetAll.addEventListener("click", () => {
      const ok = confirm("Reset all fields to defaults? This will clear the saved scenario in this browser.");
      if (!ok) return;
      replaceState(makeDefaultState());
      ensureScenarioRegistry();
      ensureDecisionScaffold();
      try{
        const state = getState();
        const b = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
        if (b){
          b.inputs = scenarioInputsFromState(state);
          b.outputs = scenarioOutputsFromState(state);
        }
      } catch {}
      clearState();
      const state = getState();
      applyStateToUI();
      rebuildCandidateTable();
      document.body.classList.toggle("training", !!state?.ui?.training);
      applyThemeFromState();
      if (els.explainCard) els.explainCard.hidden = !state?.ui?.training;
      render();
      safeCall(() => { renderScenarioManagerC1(); });
      safeCall(() => { renderDecisionSessionD1(); });
      persist();
    });
  }

  if (els.loadJson){
    els.loadJson.addEventListener("change", async () => {
      const file = els.loadJson.files?.[0];
      if (!file) return;

      const loaded = await readJsonFile(file);
      if (!loaded || typeof loaded !== "object"){
        alert("Import failed: invalid JSON.");
        els.loadJson.value = "";
        return;

      // Phase 11 — strict import: block newer schema before migration (optional)
      const curState = getState();
      const prePolicy = engine.snapshot.checkStrictImportPolicy({
        strictMode: !!curState?.ui?.strictImport,
        importedSchemaVersion: loaded.schemaVersion || null,
        currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
        hashMismatch: false
      });
      if (!prePolicy.ok){
        alert(prePolicy.issues.join(" "));
        els.loadJson.value = "";
        return;
      }

      }

      const mig = engine.snapshot.migrateSnapshot(loaded);
      if (els.importWarnBanner){
        if (mig.warnings && mig.warnings.length){
          els.importWarnBanner.hidden = false;
          els.importWarnBanner.textContent = mig.warnings.join(" ");
        } else {
          els.importWarnBanner.hidden = true;
          els.importWarnBanner.textContent = "";
        }
      }

      const v = engine.snapshot.validateScenarioExport(mig.snapshot, engine.snapshot.MODEL_VERSION);
      if (!v.ok){
        alert(`Import failed: ${v.reason}`);
        els.loadJson.value = "";
        return;
      }

      const missing = requiredScenarioKeysMissing(v.scenario);
      if (missing.length){
        alert("Import failed: scenario is missing required fields: " + missing.join(", "));
        els.loadJson.value = "";
        return;
      }

      // Phase 9B — snapshot integrity verification (+ Phase 11 strict option)
      try{
        const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
        const recomputed = engine.snapshot.computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
        const hashMismatch = !!(exportedHash && exportedHash !== recomputed);

        if (hashMismatch){
          if (els.importHashBanner){
            els.importHashBanner.hidden = false;
            els.importHashBanner.textContent = "Snapshot hash differs from exported hash.";
          }
          console.warn("Snapshot hash mismatch", { exportedHash, recomputed });
        } else {
          if (els.importHashBanner) els.importHashBanner.hidden = true;
        }

        const curState = getState();
        const policy = engine.snapshot.checkStrictImportPolicy({
          strictMode: !!curState?.ui?.strictImport,
          importedSchemaVersion: (mig?.snapshot?.schemaVersion || loaded.schemaVersion || null),
          currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
          hashMismatch
        });
        if (!policy.ok){
          alert(policy.issues.join(" "));
          els.loadJson.value = "";
          return;
        }
      } catch {
        const curState = getState();
        if (curState?.ui?.strictImport){
          alert("Import blocked: could not verify integrity hash in strict mode.");
          els.loadJson.value = "";
          return;
        }
      }

      // Replace entire state safely (no partial merge with current state)
      replaceState(normalizeLoadedState(v.scenario));
      ensureScenarioRegistry();
      ensureDecisionScaffold();
      try{
        const state = getState();
        const b = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
        if (b){
          b.inputs = scenarioInputsFromState(state);
          b.outputs = scenarioOutputsFromState(state);
        }
      } catch {}
      const state = getState();
      applyStateToUI();
      rebuildCandidateTable();
      document.body.classList.toggle("training", !!state?.ui?.training);
      applyThemeFromState();
      if (els.explainCard) els.explainCard.hidden = !state?.ui?.training;
      render();
      safeCall(() => { renderDecisionSessionD1(); });
      persist();
      els.loadJson.value = "";
    });
  }

  if (els.toggleTraining){
    els.toggleTraining.addEventListener("change", () => {
      const state = getState();
      if (!state?.ui) return;
      state.ui.training = els.toggleTraining.checked;
      document.body.classList.toggle("training", !!state.ui.training);
      const snap = (typeof getLastResultsSnapshot === "function") ? getLastResultsSnapshot() : null;
      setText(els.snapshotHash, snap?.snapshotHash || "—");
      setText(els.snapshotHashSidebar, snap?.snapshotHash || "—");
      if (els.explainCard) els.explainCard.hidden = !state.ui.training;
      persist();
    });
  }

  if (els.toggleDark){
    els.toggleDark.addEventListener("change", () => {
      const state = getState();
      if (!state) return;
      if (!state.ui) state.ui = {};
      state.ui.themeMode = els.toggleDark.checked ? "dark" : "system";
      applyThemeFromState();
      persist();
    });
  }

  if (els.toggleAdvDiag){
    els.toggleAdvDiag.addEventListener("change", () => {
      const state = getState();
      if (!state?.ui) return;
      state.ui.advDiag = els.toggleAdvDiag.checked;
      if (els.advDiagBox) els.advDiagBox.hidden = !state.ui.advDiag;
      persist();
    });
  }
}
