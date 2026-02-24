export function wireEventsApp(ctx){
  const {
    els,
    state,
    safeCall,
    setState,
    refreshBackupDropdown,
    restoreBackupByIndex,
    openDiagnostics,
    closeDiagnostics,
    copyDebugBundle,
    exportDailyLog,
    mergeDailyLogIntoState,
    applyRollingRateToAssumption,
    undoLastWeeklyAction,
    DEFAULTS_BY_TEMPLATE,
    applyStateToUI,
    applyThemeFromState,
    initThemeSystemListener,
    render,
    persist,
    safeNum,
    uid,
    rebuildCandidateTable,
    rebuildUserSplitInputs,
    syncGotvModeUI,
    syncMcModeUI,
    markMcStale,
    runMonteCarloNow,
    APP_VERSION,
    BUILD_ID,
    engine,
    lastExportHashRef,
    setLastExportHash,
    downloadText,
    lastResultsSnapshotRef,
    clearState,
    makeDefaultState,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    renderScenarioManagerC1,
    renderDecisionSessionD1,
    readJsonFile,
    normalizeLoadedState,
    requiredScenarioKeysMissing,
  } = ctx;

  safeCall(() => {
    if (els.toggleStrictImport){
      els.toggleStrictImport.checked = !!state?.ui?.strictImport;
      els.toggleStrictImport.addEventListener("change", () => {
        setState(s => { s.ui.strictImport = !!els.toggleStrictImport.checked; });
      });
    }
    if (els.restoreBackup){
      refreshBackupDropdown();
      els.restoreBackup.addEventListener("change", () => {
        const v = els.restoreBackup.value;
        if (!v) return;
        restoreBackupByIndex(v);
        els.restoreBackup.value = "";
      });
    }
    if (els.btnDiagnostics) els.btnDiagnostics.addEventListener("click", openDiagnostics);
    if (els.btnDiagClose) els.btnDiagClose.addEventListener("click", closeDiagnostics);
    if (els.diagModal){
      els.diagModal.addEventListener("click", (e) => {
        const t = e?.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeDiagnostics();
      });
    }
    if (els.btnCopyDebug) els.btnCopyDebug.addEventListener("click", () => { safeCall(() => { copyDebugBundle(); }); });

    if (els.dailyLogExportBtn) els.dailyLogExportBtn.addEventListener("click", () => { safeCall(() => { exportDailyLog(); }); });
    if (els.dailyLogImportBtn) els.dailyLogImportBtn.addEventListener("click", () => {
      safeCall(() => {
        const raw = String(els.dailyLogImportText?.value || "").trim();
        if (!raw){
          if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Paste JSON first";
          return;
        }
        let parsed = null;
        try{ parsed = JSON.parse(raw); } catch {
          if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Invalid JSON";
          return;
        }
        const r = mergeDailyLogIntoState(parsed);
        if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = r.msg;
      });
    });

    if (els.applyRollingCRBtn) els.applyRollingCRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("contact"); }); });
    if (els.applyRollingSRBtn) els.applyRollingSRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("support"); }); });
    if (els.wkUndoActionBtn) els.wkUndoActionBtn.addEventListener("click", () => { safeCall(() => { undoLastWeeklyAction(); }); });
    if (els.btnJumpDrift){
      els.btnJumpDrift.addEventListener("click", () => {
        const go = () => {
          const target = document.getElementById("driftStatusTag");
          if (target && typeof target.scrollIntoView === "function"){
            target.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        };
        try{
          const btn = document.querySelector('.nav-item-new[data-stage="decisions"]');
          if (btn && typeof btn.click === "function") btn.click();
        } catch {}
        setTimeout(go, 60);
      });
    }
  });

  els.scenarioName.addEventListener("input", () => { state.scenarioName = els.scenarioName.value; persist(); });

  els.raceType.addEventListener("change", () => {
    state.raceType = els.raceType.value;
    const defs = DEFAULTS_BY_TEMPLATE[state.raceType] || DEFAULTS_BY_TEMPLATE.state_leg;
    if (!state.bandWidth && state.bandWidth !== 0) state.bandWidth = defs.bandWidth;
    state.bandWidth = state.bandWidth || defs.bandWidth;
    state.persuasionPct = state.persuasionPct || defs.persuasionPct;
    state.earlyVoteExp = state.earlyVoteExp || defs.earlyVoteExp;
    applyStateToUI();
    applyThemeFromState();
    initThemeSystemListener();
    render();
    persist();
  });

  els.electionDate.addEventListener("change", () => { state.electionDate = els.electionDate.value; render(); persist(); });
  els.weeksRemaining.addEventListener("input", () => { state.weeksRemaining = els.weeksRemaining.value; render(); persist(); });
  els.mode.addEventListener("change", () => { state.mode = els.mode.value; persist(); });

  els.universeBasis.addEventListener("change", () => { state.universeBasis = els.universeBasis.value; render(); persist(); });
  els.universeSize.addEventListener("input", () => { state.universeSize = safeNum(els.universeSize.value); render(); persist(); });
  els.sourceNote.addEventListener("input", () => { state.sourceNote = els.sourceNote.value; persist(); });

  els.turnoutA.addEventListener("input", () => { state.turnoutA = safeNum(els.turnoutA.value); render(); persist(); });
  els.turnoutB.addEventListener("input", () => { state.turnoutB = safeNum(els.turnoutB.value); render(); persist(); });
  els.bandWidth.addEventListener("input", () => { state.bandWidth = safeNum(els.bandWidth.value); render(); persist(); });

  els.btnAddCandidate.addEventListener("click", () => {
    state.candidates.push({ id: uid(), name: `Candidate ${String.fromCharCode(65 + state.candidates.length)}`, supportPct: 0 });
    rebuildCandidateTable();
    render();
    persist();
  });

  els.yourCandidate.addEventListener("change", () => { state.yourCandidateId = els.yourCandidate.value; render(); persist(); });
  els.undecidedPct.addEventListener("input", () => { state.undecidedPct = safeNum(els.undecidedPct.value); render(); persist(); });

  els.undecidedMode.addEventListener("change", () => {
    state.undecidedMode = els.undecidedMode.value;
    rebuildUserSplitInputs();
    render();
    persist();
  });

  els.persuasionPct.addEventListener("input", () => { state.persuasionPct = safeNum(els.persuasionPct.value); render(); persist(); });
  els.earlyVoteExp.addEventListener("input", () => { state.earlyVoteExp = safeNum(els.earlyVoteExp.value); render(); persist(); });

  if (els.goalSupportIds) els.goalSupportIds.addEventListener("input", () => { state.goalSupportIds = els.goalSupportIds.value; markMcStale(); render(); persist(); });
  if (els.supportRatePct) els.supportRatePct.addEventListener("input", () => { state.supportRatePct = safeNum(els.supportRatePct.value); markMcStale(); render(); persist(); });
  if (els.contactRatePct) els.contactRatePct.addEventListener("input", () => { state.contactRatePct = safeNum(els.contactRatePct.value); markMcStale(); render(); persist(); });
  if (els.doorsPerHour) els.doorsPerHour.addEventListener("input", () => { state.doorsPerHour = safeNum(els.doorsPerHour.value); render(); persist(); });
  if (els.hoursPerShift) els.hoursPerShift.addEventListener("input", () => { state.hoursPerShift = safeNum(els.hoursPerShift.value); render(); persist(); });
  if (els.shiftsPerVolunteerPerWeek) els.shiftsPerVolunteerPerWeek.addEventListener("input", () => { state.shiftsPerVolunteerPerWeek = safeNum(els.shiftsPerVolunteerPerWeek.value); render(); persist(); });

  if (els.universe16Enabled) els.universe16Enabled.addEventListener("change", () => { state.universeLayerEnabled = !!els.universe16Enabled.checked; markMcStale(); render(); persist(); });
  if (els.universe16DemPct) els.universe16DemPct.addEventListener("input", () => { state.universeDemPct = safeNum(els.universe16DemPct.value); markMcStale(); render(); persist(); });
  if (els.universe16RepPct) els.universe16RepPct.addEventListener("input", () => { state.universeRepPct = safeNum(els.universe16RepPct.value); markMcStale(); render(); persist(); });
  if (els.universe16NpaPct) els.universe16NpaPct.addEventListener("input", () => { state.universeNpaPct = safeNum(els.universe16NpaPct.value); markMcStale(); render(); persist(); });
  if (els.universe16OtherPct) els.universe16OtherPct.addEventListener("input", () => { state.universeOtherPct = safeNum(els.universe16OtherPct.value); markMcStale(); render(); persist(); });
  if (els.retentionFactor) els.retentionFactor.addEventListener("input", () => { state.retentionFactor = safeNum(els.retentionFactor.value); markMcStale(); render(); persist(); });

  if (els.orgCount) els.orgCount.addEventListener("input", () => { state.orgCount = safeNum(els.orgCount.value); markMcStale(); render(); persist(); });
  if (els.orgHoursPerWeek) els.orgHoursPerWeek.addEventListener("input", () => { state.orgHoursPerWeek = safeNum(els.orgHoursPerWeek.value); markMcStale(); render(); persist(); });
  if (els.volunteerMultBase) els.volunteerMultBase.addEventListener("input", () => { state.volunteerMultBase = safeNum(els.volunteerMultBase.value); markMcStale(); render(); persist(); });
  if (els.channelDoorPct) els.channelDoorPct.addEventListener("input", () => { state.channelDoorPct = safeNum(els.channelDoorPct.value); markMcStale(); render(); persist(); });
  if (els.doorsPerHour3) els.doorsPerHour3.addEventListener("input", () => { state.doorsPerHour3 = safeNum(els.doorsPerHour3.value); markMcStale(); render(); persist(); });
  if (els.callsPerHour3) els.callsPerHour3.addEventListener("input", () => { state.callsPerHour3 = safeNum(els.callsPerHour3.value); markMcStale(); render(); persist(); });
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.addEventListener("input", () => { state.turnoutReliabilityPct = safeNum(els.turnoutReliabilityPct.value); markMcStale(); render(); persist(); });

  if (els.turnoutEnabled) els.turnoutEnabled.addEventListener("change", () => { state.turnoutEnabled = !!els.turnoutEnabled.checked; markMcStale(); render(); persist(); });
  if (els.turnoutBaselinePct) els.turnoutBaselinePct.addEventListener("input", () => { state.turnoutBaselinePct = safeNum(els.turnoutBaselinePct.value); markMcStale(); render(); persist(); });
  if (els.turnoutTargetOverridePct) els.turnoutTargetOverridePct.addEventListener("input", () => { state.turnoutTargetOverridePct = els.turnoutTargetOverridePct.value; markMcStale(); render(); persist(); });

  if (els.gotvMode) els.gotvMode.addEventListener("change", () => { state.gotvMode = els.gotvMode.value; syncGotvModeUI(); markMcStale(); render(); persist(); });
  if (els.gotvLiftPP) els.gotvLiftPP.addEventListener("input", () => { state.gotvLiftPP = safeNum(els.gotvLiftPP.value); markMcStale(); render(); persist(); });
  if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.addEventListener("input", () => { state.gotvMaxLiftPP = safeNum(els.gotvMaxLiftPP.value); markMcStale(); render(); persist(); });
  if (els.gotvDiminishing) els.gotvDiminishing.addEventListener("change", () => { state.gotvDiminishing = !!els.gotvDiminishing.checked; markMcStale(); render(); persist(); });
  if (els.gotvLiftMin) els.gotvLiftMin.addEventListener("input", () => { state.gotvLiftMin = safeNum(els.gotvLiftMin.value); markMcStale(); render(); persist(); });
  if (els.gotvLiftMode) els.gotvLiftMode.addEventListener("input", () => { state.gotvLiftMode = safeNum(els.gotvLiftMode.value); markMcStale(); render(); persist(); });
  if (els.gotvLiftMax) els.gotvLiftMax.addEventListener("input", () => { state.gotvLiftMax = safeNum(els.gotvLiftMax.value); markMcStale(); render(); persist(); });
  if (els.gotvMaxLiftPP2) els.gotvMaxLiftPP2.addEventListener("input", () => { state.gotvMaxLiftPP2 = safeNum(els.gotvMaxLiftPP2.value); markMcStale(); render(); persist(); });
  if (els.gotvDiminishing2) els.gotvDiminishing2.addEventListener("change", () => { state.gotvDiminishing2 = !!els.gotvDiminishing2.checked; markMcStale(); render(); persist(); });

  if (els.mcMode) els.mcMode.addEventListener("change", () => { state.mcMode = els.mcMode.value; syncMcModeUI(); markMcStale(); persist(); });
  if (els.mcVolatility) els.mcVolatility.addEventListener("change", () => { state.mcVolatility = els.mcVolatility.value; markMcStale(); persist(); });
  if (els.mcSeed) els.mcSeed.addEventListener("input", () => { state.mcSeed = els.mcSeed.value; markMcStale(); persist(); });

  const advWatch = (el, key) => {
    if (!el) return;
    el.addEventListener("input", () => {
      state[key] = safeNum(el.value);
      markMcStale();
      persist();
    });
  };
  advWatch(els.mcContactMin, "mcContactMin");
  advWatch(els.mcContactMode, "mcContactMode");
  advWatch(els.mcContactMax, "mcContactMax");
  advWatch(els.mcPersMin, "mcPersMin");
  advWatch(els.mcPersMode, "mcPersMode");
  advWatch(els.mcPersMax, "mcPersMax");
  advWatch(els.mcReliMin, "mcReliMin");
  advWatch(els.mcReliMode, "mcReliMode");
  advWatch(els.mcReliMax, "mcReliMax");
  advWatch(els.mcDphMin, "mcDphMin");
  advWatch(els.mcDphMode, "mcDphMode");
  advWatch(els.mcDphMax, "mcDphMax");
  advWatch(els.mcCphMin, "mcCphMin");
  advWatch(els.mcCphMode, "mcCphMode");
  advWatch(els.mcCphMax, "mcCphMax");
  advWatch(els.mcVolMin, "mcVolMin");
  advWatch(els.mcVolMode, "mcVolMode");
  advWatch(els.mcVolMax, "mcVolMax");

  if (els.mcRun) els.mcRun.addEventListener("click", () => runMonteCarloNow());
  if (els.mcRunSidebar) els.mcRunSidebar.addEventListener("click", () => runMonteCarloNow());
  if (els.mcRerun) els.mcRerun.addEventListener("click", () => runMonteCarloNow());

  const ensureBudget = () => {
    if (!state.budget) state.budget = { overheadAmount: 0, includeOverhead: false, tactics: { doors:{enabled:true,cpa:0,crPct:null,srPct:null,kind:"persuasion"}, phones:{enabled:true,cpa:0,crPct:null,srPct:null,kind:"persuasion"}, texts:{enabled:false,cpa:0,crPct:null,srPct:null,kind:"persuasion"} }, optimize: { mode:"budget", budgetAmount:10000, capacityAttempts:"", step:25, useDecay:false, objective:"net", tlConstrainedEnabled:false, tlConstrainedObjective:"max_net" } };
    if (!state.budget.tactics) state.budget.tactics = { doors:{enabled:true,cpa:0,crPct:null,srPct:null}, phones:{enabled:true,cpa:0,crPct:null,srPct:null}, texts:{enabled:false,cpa:0,crPct:null,srPct:null} };
    if (!state.budget.optimize) state.budget.optimize = { mode:"budget", budgetAmount:10000, capacityAttempts:"", step:25, useDecay:false, objective:"net", tlConstrainedEnabled:false, tlConstrainedObjective:"max_net" };
    if (!state.budget.tactics.doors) state.budget.tactics.doors = { enabled:true, cpa:0, crPct:null, srPct:null };
    if (!state.budget.tactics.phones) state.budget.tactics.phones = { enabled:true, cpa:0, crPct:null, srPct:null };
    if (!state.budget.tactics.texts) state.budget.tactics.texts = { enabled:false, cpa:0, crPct:null, srPct:null };
  };

  const watchBool = (el, fn) => {
    if (!el) return;
    el.addEventListener("change", () => { ensureBudget(); fn(); render(); persist(); });
  };
  const watchNum = (el, fn) => {
    if (!el) return;
    el.addEventListener("input", () => { ensureBudget(); fn(); render(); persist(); });
  };

  watchBool(els.roiDoorsEnabled, () => state.budget.tactics.doors.enabled = !!els.roiDoorsEnabled.checked);
  watchNum(els.roiDoorsCpa, () => state.budget.tactics.doors.cpa = safeNum(els.roiDoorsCpa.value) ?? 0);
  watchNum(els.roiDoorsCr, () => state.budget.tactics.doors.crPct = safeNum(els.roiDoorsCr.value));
  watchNum(els.roiDoorsSr, () => state.budget.tactics.doors.srPct = safeNum(els.roiDoorsSr.value));

  watchBool(els.roiPhonesEnabled, () => state.budget.tactics.phones.enabled = !!els.roiPhonesEnabled.checked);
  watchNum(els.roiPhonesCpa, () => state.budget.tactics.phones.cpa = safeNum(els.roiPhonesCpa.value) ?? 0);
  watchNum(els.roiPhonesCr, () => state.budget.tactics.phones.crPct = safeNum(els.roiPhonesCr.value));
  watchNum(els.roiPhonesSr, () => state.budget.tactics.phones.srPct = safeNum(els.roiPhonesSr.value));

  watchBool(els.roiTextsEnabled, () => state.budget.tactics.texts.enabled = !!els.roiTextsEnabled.checked);
  watchNum(els.roiTextsCpa, () => state.budget.tactics.texts.cpa = safeNum(els.roiTextsCpa.value) ?? 0);
  watchNum(els.roiTextsCr, () => state.budget.tactics.texts.crPct = safeNum(els.roiTextsCr.value));
  watchNum(els.roiTextsSr, () => state.budget.tactics.texts.srPct = safeNum(els.roiTextsSr.value));

  watchNum(els.roiOverheadAmount, () => state.budget.overheadAmount = safeNum(els.roiOverheadAmount.value) ?? 0);
  watchBool(els.roiIncludeOverhead, () => state.budget.includeOverhead = !!els.roiIncludeOverhead.checked);

  const watchOpt = (el, fn, evt="input") => {
    if (!el) return;
    el.addEventListener(evt, () => { ensureBudget(); fn(); render(); persist(); });
  };

  watchOpt(els.optMode, () => state.budget.optimize.mode = els.optMode.value, "change");
  watchOpt(els.optObjective, () => state.budget.optimize.objective = els.optObjective.value, "change");
  watchOpt(els.tlOptEnabled, () => state.budget.optimize.tlConstrainedEnabled = !!els.tlOptEnabled.checked, "change");
  watchOpt(els.tlOptObjective, () => state.budget.optimize.tlConstrainedObjective = els.tlOptObjective.value || "max_net", "change");
  watchOpt(els.optBudget, () => state.budget.optimize.budgetAmount = safeNum(els.optBudget.value) ?? 0);
  watchOpt(els.optCapacity, () => state.budget.optimize.capacityAttempts = els.optCapacity.value ?? "");
  watchOpt(els.optStep, () => state.budget.optimize.step = safeNum(els.optStep.value) ?? 25);
  watchOpt(els.optUseDecay, () => state.budget.optimize.useDecay = !!els.optUseDecay.checked, "change");

  const watchTL = (el, fn, evt="input") => {
    if (!el) return;
    el.addEventListener(evt, () => { fn(); render(); persist(); });
  };

  watchTL(els.timelineEnabled, () => state.timelineEnabled = !!els.timelineEnabled.checked, "change");
  watchTL(els.timelineActiveWeeks, () => state.timelineActiveWeeks = els.timelineActiveWeeks.value ?? "");
  watchTL(els.timelineGotvWeeks, () => state.timelineGotvWeeks = safeNum(els.timelineGotvWeeks.value));
  watchTL(els.timelineStaffCount, () => state.timelineStaffCount = safeNum(els.timelineStaffCount.value) ?? 0);
  watchTL(els.timelineStaffHours, () => state.timelineStaffHours = safeNum(els.timelineStaffHours.value) ?? 0);
  watchTL(els.timelineVolCount, () => state.timelineVolCount = safeNum(els.timelineVolCount.value) ?? 0);
  watchTL(els.timelineVolHours, () => state.timelineVolHours = safeNum(els.timelineVolHours.value) ?? 0);
  watchTL(els.timelineRampEnabled, () => state.timelineRampEnabled = !!els.timelineRampEnabled.checked, "change");
  watchTL(els.timelineRampMode, () => state.timelineRampMode = els.timelineRampMode.value || "linear", "change");
  watchTL(els.timelineDoorsPerHour, () => state.timelineDoorsPerHour = safeNum(els.timelineDoorsPerHour.value) ?? 0);
  watchTL(els.timelineCallsPerHour, () => state.timelineCallsPerHour = safeNum(els.timelineCallsPerHour.value) ?? 0);
  watchTL(els.timelineTextsPerHour, () => state.timelineTextsPerHour = safeNum(els.timelineTextsPerHour.value) ?? 0);

  if (els.optRun) els.optRun.addEventListener("click", () => { render(); });
  if (els.roiRefresh) els.roiRefresh.addEventListener("click", () => { render(); });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      state.ui.activeTab = tab;

      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      document.getElementById(`tab-${tab}`).classList.add("active");

      persist();
    });
  });

  if (els.btnSaveJson) els.btnSaveJson.addEventListener("click", () => {
    const scenarioClone = structuredClone(state);
    const snapshot = { modelVersion: engine.snapshot.MODEL_VERSION, schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION, scenarioState: scenarioClone, appVersion: APP_VERSION, buildId: BUILD_ID };
    snapshot.snapshotHash = engine.snapshot.computeSnapshotHash(snapshot);
    setLastExportHash(snapshot.snapshotHash);
    const payload = engine.snapshot.makeScenarioExport(snapshot);
    if (engine.snapshot.hasNonFiniteNumbers(payload)){
      alert("Export blocked: scenario contains NaN/Infinity.");
      return;
    }
    const filename = engine.snapshot.makeTimestampedFilename("field-path-scenario", "json");
    const text = engine.snapshot.deterministicStringify(payload, 2);
    downloadText(text, filename, "application/json");
  });

  if (els.btnExportCsv) els.btnExportCsv.addEventListener("click", () => {
    const lastResultsSnapshot = lastResultsSnapshotRef();
    if (!lastResultsSnapshot){
      alert("Nothing to export yet. Run a scenario first.");
      return;
    }
    const csv = engine.snapshot.planRowsToCsv(lastResultsSnapshot);
    if (/NaN|Infinity/.test(csv)){
      alert("CSV export blocked: contains NaN/Infinity.");
      return;
    }
    const filename = engine.snapshot.makeTimestampedFilename("field-path-plan", "csv");
    downloadText(csv, filename, "text/csv");
  });

  if (els.btnCopySummary) els.btnCopySummary.addEventListener("click", async () => {
    const lastResultsSnapshot = lastResultsSnapshotRef();
    if (!lastResultsSnapshot){
      alert("Nothing to copy yet. Run a scenario first.");
      return;
    }
    const text = engine.snapshot.formatSummaryText(lastResultsSnapshot);
    const r = await engine.snapshot.copyTextToClipboard(text);
    if (!r.ok) alert(r.reason || "Copy failed.");
  });

  if (els.btnResetAll) els.btnResetAll.addEventListener("click", () => {
    const ok = confirm("Reset all fields to defaults? This will clear the saved scenario in this browser.");
    if (!ok) return;
    let next = makeDefaultState();
    state.raceType = next.raceType; // keep ref mutation minimal
    Object.keys(state).forEach(k => { delete state[k]; });
    Object.assign(state, next);
    ensureScenarioRegistry();
    ensureDecisionScaffold();
    try{
      const b = state.ui.scenarios?.[SCENARIO_BASELINE_ID];
      if (b){
        b.inputs = scenarioInputsFromState(state);
        b.outputs = scenarioOutputsFromState(state);
      }
    } catch {}
    clearState();
    applyStateToUI();
    rebuildCandidateTable();
    document.body.classList.toggle("training", !!state.ui.training);
    applyThemeFromState();
    if (els.explainCard) els.explainCard.hidden = !state.ui.training;
    render();
    safeCall(() => { renderScenarioManagerC1(); });
    safeCall(() => { renderDecisionSessionD1(); });
    persist();
  });

  els.loadJson.addEventListener("change", async () => {
    const file = els.loadJson.files?.[0];
    if (!file) return;

    const loaded = await readJsonFile(file);
    if (!loaded || typeof loaded !== "object"){
      alert("Import failed: invalid JSON.");
      els.loadJson.value = "";
      return;
    }

    const prePolicy = engine.snapshot.checkStrictImportPolicy({
      strictMode: !!state?.ui?.strictImport,
      importedSchemaVersion: loaded.schemaVersion || null,
      currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
      hashMismatch: false
    });
    if (!prePolicy.ok){
      alert(prePolicy.issues.join(" "));
      els.loadJson.value = "";
      return;
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

    let hashMismatch = false;
    try{
      const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
      const recomputed = engine.snapshot.computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
      hashMismatch = !!(exportedHash && exportedHash !== recomputed);

      if (hashMismatch){
        if (els.importHashBanner){
          els.importHashBanner.hidden = false;
          els.importHashBanner.textContent = "Snapshot hash differs from exported hash.";
        }
        console.warn("Snapshot hash mismatch", { exportedHash, recomputed });
      } else {
        if (els.importHashBanner) els.importHashBanner.hidden = true;
      }

      const policy = engine.snapshot.checkStrictImportPolicy({
        strictMode: !!state?.ui?.strictImport,
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
      if (state?.ui?.strictImport){
        alert("Import blocked: could not verify integrity hash in strict mode.");
        els.loadJson.value = "";
        return;
      }
    }

    const next = normalizeLoadedState(v.scenario);
    Object.keys(state).forEach(k => { delete state[k]; });
    Object.assign(state, next);
    ensureScenarioRegistry();
    ensureDecisionScaffold();
    try{
      const b = state.ui.scenarios?.[SCENARIO_BASELINE_ID];
      if (b){
        b.inputs = scenarioInputsFromState(state);
        b.outputs = scenarioOutputsFromState(state);
      }
    } catch {}
    applyStateToUI();
    rebuildCandidateTable();
    document.body.classList.toggle("training", !!state.ui.training);
    applyThemeFromState();
    if (els.explainCard) els.explainCard.hidden = !state.ui.training;
    render();
    safeCall(() => { renderDecisionSessionD1(); });
    persist();
    els.loadJson.value = "";
  });

  if (els.toggleTraining) els.toggleTraining.addEventListener("change", () => {
    state.ui.training = els.toggleTraining.checked;
    document.body.classList.toggle("training", !!state.ui.training);
    const last = lastResultsSnapshotRef();
    if (last){
      if (els.snapshotHash) els.snapshotHash.textContent = last.snapshotHash || "—";
      if (els.snapshotHashSidebar) els.snapshotHashSidebar.textContent = last.snapshotHash || "—";
    }
    if (els.importHashBanner && els.importHashBanner.hidden === false){ /* keep until next import clears */ }
    els.explainCard.hidden = !state.ui.training;
    persist();
  });

  if (els.toggleDark) els.toggleDark.addEventListener("change", () => {
    if (!state.ui) state.ui = {};
    state.ui.themeMode = els.toggleDark.checked ? "dark" : "system";
    applyThemeFromState();
    persist();
  });

  if (els.toggleAdvDiag) els.toggleAdvDiag.addEventListener("change", () => {
    state.ui.advDiag = els.toggleAdvDiag.checked;
    if (els.advDiagBox) els.advDiagBox.hidden = !state.ui.advDiag;
    persist();
  });
}
