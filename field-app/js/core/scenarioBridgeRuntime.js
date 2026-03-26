// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createScenarioBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const scenarioBridgeKey = String(deps.scenarioBridgeKey || "__FPE_SCENARIO_API__");
  const scenarioBaselineId = String(deps.scenarioBaselineId || "baseline");
  const parsedScenarioMax = Number(deps.scenarioMax);
  const scenarioMax = Number.isFinite(parsedScenarioMax) && parsedScenarioMax > 0
    ? parsedScenarioMax
    : 20;

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };

  const replaceState = (next) => call(deps.replaceState, next);

  const ensureScenarioRegistry = (...args) => call(deps.ensureScenarioRegistry, ...args);
  const listScenarioRecords = (...args) => call(deps.listScenarioRecords, ...args) || [];
  const buildScenarioWorkspaceSummaryView = (...args) => call(deps.buildScenarioWorkspaceSummaryView, ...args) || {};
  const scenarioClone = (...args) => call(deps.scenarioClone, ...args);
  const scenarioInputsFromState = (...args) => call(deps.scenarioInputsFromState, ...args);
  const scenarioOutputsFromState = (...args) => call(deps.scenarioOutputsFromState, ...args);
  const setScenarioWarn = (...args) => call(deps.setScenarioWarn, ...args);
  const uid = (...args) => call(deps.uid, ...args);
  const persist = (...args) => call(deps.persist, ...args);
  const notifyBridgeSync = (...args) => call(deps.notifyBridgeSync, ...args);
  const markMcStale = (...args) => call(deps.markMcStale, ...args);
  const applyStateToUI = (...args) => call(deps.applyStateToUI, ...args);
  const render = (...args) => call(deps.render, ...args);
  const safeCall = (...args) => call(deps.safeCall, ...args);
  const renderScenarioManagerC1 = (...args) => call(deps.renderScenarioManagerC1, ...args);
  const renderDecisionSessionD1 = (...args) => call(deps.renderDecisionSessionD1, ...args);
  const ensureIntelCollections = (...args) => call(deps.ensureIntelCollections, ...args);
  const commitUIUpdate = (...args) => call(deps.commitUIUpdate, ...args);
  const upsertBenchmarkEntry = (...args) => call(deps.upsertBenchmarkEntry, ...args);
  const loadDefaultBenchmarksForRaceType = (...args) => call(deps.loadDefaultBenchmarksForRaceType, ...args);
  const removeBenchmarkEntry = (...args) => call(deps.removeBenchmarkEntry, ...args);
  const attachEvidenceRecord = (...args) => call(deps.attachEvidenceRecord, ...args);
  const generateScenarioSummaryBrief = (...args) => call(deps.generateScenarioSummaryBrief, ...args);
  const generateScenarioDiffBrief = (...args) => call(deps.generateScenarioDiffBrief, ...args);
  const generateDriftExplanationBrief = (...args) => call(deps.generateDriftExplanationBrief, ...args);
  const generateSensitivityInterpretationBrief = (...args) => call(deps.generateSensitivityInterpretationBrief, ...args);
  const generateCalibrationSourceBrief = (...args) => call(deps.generateCalibrationSourceBrief, ...args);
  const addDefaultCorrelationModel = (...args) => call(deps.addDefaultCorrelationModel, ...args);
  const importCorrelationModelsJson = (...args) => call(deps.importCorrelationModelsJson, ...args);
  const addDefaultShockScenario = (...args) => call(deps.addDefaultShockScenario, ...args);
  const importShockScenariosJson = (...args) => call(deps.importShockScenariosJson, ...args);
  const computeRealityDrift = (...args) => call(deps.computeRealityDrift, ...args);
  const captureObservedMetricsFromDrift = (...args) => call(deps.captureObservedMetricsFromDrift, ...args);
  const captureObservedAndRefreshDriftRecommendations = (...args) => call(deps.captureObservedAndRefreshDriftRecommendations, ...args);
  const createWhatIfIntelRequest = (...args) => call(deps.createWhatIfIntelRequest, ...args);
  const applyTopDriftRecommendation = (...args) => call(deps.applyTopDriftRecommendation, ...args);

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

  function hasLegacyScenarioManagerDom(){
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== "function"){
      return false;
    }
    return !!(
      documentRef.getElementById("scenarioSelect") ||
      documentRef.getElementById("activeScenarioLabel")
    );
  }

  function refreshLegacyScenarioManagerIfMounted(){
    if (!hasLegacyScenarioManagerDom()){
      return;
    }
    safeCall(() => { renderScenarioManagerC1(); });
  }

  function scenarioBridgeStateView(){
    ensureScenarioRegistry();
    const state = getState();
    const reg = state?.ui?.scenarios || {};
    const activeId = state?.ui?.activeScenarioId || scenarioBaselineId;
    const selectedId = state?.ui?.scenarioUiSelectedId || activeId;
    const active = reg[activeId] || null;
    const baseline = reg[scenarioBaselineId] || null;
    const records = listScenarioRecords().map((rec) => ({
      id: rec?.id || "",
      name: rec?.name || rec?.id || "",
      createdAt: rec?.createdAt || ""
    }));
    const count = Object.keys(reg).length;
    const summary = buildScenarioWorkspaceSummaryView({
      activeScenario: active,
      activeScenarioId: activeId,
      count,
      max: scenarioMax,
    });

    return {
      baselineId: scenarioBaselineId,
      max: scenarioMax,
      count,
      activeScenarioId: activeId,
      selectedScenarioId: selectedId,
      activeLabel: summary.activeLabel,
      warning: summary.warning,
      storageStatus: summary.storageStatus,
      scenarios: records,
      baseline: baseline
        ? {
            id: baseline.id,
            name: baseline.name || baseline.id,
            inputs: scenarioClone(baseline.inputs || {}),
            outputs: scenarioClone(baseline.outputs || {})
          }
        : null,
      active: active
        ? {
            id: active.id,
            name: active.name || active.id,
            inputs: scenarioClone(active.inputs || {}),
            outputs: scenarioClone(active.outputs || {})
          }
        : null
    };
  }

  function scenarioBridgeSelect(id){
    ensureScenarioRegistry();
    const nextId = String(id || "").trim();
    const state = getState();
    const reg = state?.ui?.scenarios || {};
    if (!nextId || !reg[nextId]) {
      return { ok: false, code: "not_found", view: scenarioBridgeStateView() };
    }

    state.ui.scenarioUiSelectedId = nextId;
    persist();
    notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_selected" });
    refreshLegacyScenarioManagerIfMounted();
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeSaveNew(name){
    ensureScenarioRegistry();
    const state = getState();
    const reg = state?.ui?.scenarios || {};
    const count = Object.keys(reg).length;
    if (count >= scenarioMax){
      setScenarioWarn(`Max scenarios reached (${scenarioMax}). Delete one to save a new scenario.`);
      refreshLegacyScenarioManagerIfMounted();
      return { ok: false, code: "max_reached", view: scenarioBridgeStateView() };
    }

    const id = "scn_" + uid() + Date.now().toString(16);
    const nm = String(name || "").trim() || `Scenario ${count}`;
    reg[id] = {
      id,
      name: nm,
      inputs: scenarioClone(scenarioInputsFromState(state) || {}),
      outputs: scenarioClone(scenarioOutputsFromState(state) || {}),
      createdAt: new Date().toISOString()
    };
    state.ui.scenarioUiSelectedId = id;
    persist();
    notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_saved" });
    refreshLegacyScenarioManagerIfMounted();
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeCloneBaseline(name){
    ensureScenarioRegistry();
    const state = getState();
    const reg = state?.ui?.scenarios || {};
    const count = Object.keys(reg).length;
    if (count >= scenarioMax){
      setScenarioWarn(`Max scenarios reached (${scenarioMax}). Delete one to clone baseline.`);
      refreshLegacyScenarioManagerIfMounted();
      return { ok: false, code: "max_reached", view: scenarioBridgeStateView() };
    }

    const base = reg[scenarioBaselineId];
    const id = "scn_" + uid() + Date.now().toString(16);
    const nm = String(name || "").trim() || "Baseline clone";
    reg[id] = {
      id,
      name: nm,
      inputs: scenarioClone(base?.inputs || {}),
      outputs: scenarioClone(base?.outputs || {}),
      createdAt: new Date().toISOString()
    };
    state.ui.scenarioUiSelectedId = id;
    persist();
    notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_cloned" });
    refreshLegacyScenarioManagerIfMounted();
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeLoad(id){
    ensureScenarioRegistry();
    const targetId = String(id || "").trim();
    const currentState = getState();
    const reg = currentState?.ui?.scenarios || {};
    const rec = reg[targetId];
    if (!rec) {
      return { ok: false, code: "not_found", view: scenarioBridgeStateView() };
    }

    const uiKeep = currentState.ui || {};
    const next = scenarioClone(rec.inputs || {});
    next.ui = uiKeep;
    replaceState(next);

    ensureScenarioRegistry();
    const state = getState();
    state.ui.activeScenarioId = targetId;
    state.ui.scenarioUiSelectedId = targetId;

    markMcStale();
    applyStateToUI();
    persist();
    render();
    notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_loaded" });
    refreshLegacyScenarioManagerIfMounted();
    safeCall(() => { renderDecisionSessionD1(); });
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeDeleteSelected(){
    ensureScenarioRegistry();
    const state = getState();
    const selectedId = String(state?.ui?.scenarioUiSelectedId || "").trim();
    if (!selectedId || selectedId === scenarioBaselineId){
      return { ok: false, code: "cannot_delete", view: scenarioBridgeStateView() };
    }

    delete state.ui.scenarios[selectedId];
    state.ui.scenarioUiSelectedId = scenarioBaselineId;
    persist();
    notifyBridgeSync({ source: "bridge.scenario", reason: "scenario_deleted" });
    refreshLegacyScenarioManagerIfMounted();
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeEnsureIntelWorkflow(targetState){
    const intel = ensureIntelCollections(targetState);
    if (!intel?.workflow || typeof intel.workflow !== "object"){
      return {
        scenarioLocked: false,
        lockReason: "",
        lockedAt: null,
        lockedBy: "",
        governanceBaselineAt: null,
        requireCriticalNote: true,
        requireCriticalEvidence: true
      };
    }
    return intel.workflow;
  }

  function scenarioBridgeEnsureIntelToggles(targetState){
    const intel = ensureIntelCollections(targetState);
    return {
      simToggles: (intel && typeof intel.simToggles === "object") ? intel.simToggles : {
        mcDistribution: "triangular",
        correlatedShocks: false,
        correlationMatrixId: null,
        shockScenariosEnabled: true
      },
      expertToggles: (intel && typeof intel.expertToggles === "object") ? intel.expertToggles : {
        capacityDecayEnabled: false,
        decayModel: {
          type: "linear",
          weeklyDecayPct: 0.03,
          floorPctOfBaseline: 0.70
        }
      }
    };
  }

  function scenarioBridgeUpdateIntelWorkflow(patch){
    const nextPatch = (patch && typeof patch === "object") ? patch : {};
    const hasPatch = [
      "scenarioLocked",
      "lockReason",
      "requireCriticalNote",
      "requireCriticalEvidence"
    ].some((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
    if (!hasPatch){
      return { ok: false, code: "empty_patch", view: scenarioBridgeStateView() };
    }

    const workflow = scenarioBridgeEnsureIntelWorkflow(getState());
    if (Object.prototype.hasOwnProperty.call(nextPatch, "scenarioLocked")){
      const locked = !!nextPatch.scenarioLocked;
      workflow.scenarioLocked = locked;
      workflow.lockedAt = locked ? new Date().toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, "lockReason")){
      workflow.lockReason = String(nextPatch.lockReason || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, "requireCriticalNote")){
      workflow.requireCriticalNote = !!nextPatch.requireCriticalNote;
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, "requireCriticalEvidence")){
      workflow.requireCriticalEvidence = !!nextPatch.requireCriticalEvidence;
    }

    commitUIUpdate({ allowScenarioLockBypass: true });
    refreshLegacyScenarioManagerIfMounted();
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeUpdateIntelSimToggles(patch){
    const nextPatch = (patch && typeof patch === "object") ? patch : {};
    const hasPatch = [
      "mcDistribution",
      "correlatedShocks",
      "correlationMatrixId",
      "shockScenariosEnabled"
    ].some((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
    if (!hasPatch){
      return { ok: false, code: "empty_patch", view: scenarioBridgeStateView() };
    }

    const { simToggles } = scenarioBridgeEnsureIntelToggles(getState());
    if (Object.prototype.hasOwnProperty.call(nextPatch, "mcDistribution")){
      const raw = String(nextPatch.mcDistribution || "").trim().toLowerCase();
      const allowed = raw === "triangular" || raw === "uniform" || raw === "normal";
      simToggles.mcDistribution = allowed ? raw : "triangular";
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, "correlatedShocks")){
      simToggles.correlatedShocks = !!nextPatch.correlatedShocks;
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, "correlationMatrixId")){
      const raw = String(nextPatch.correlationMatrixId || "").trim();
      simToggles.correlationMatrixId = raw && raw.toLowerCase() !== "none" ? raw : null;
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, "shockScenariosEnabled")){
      simToggles.shockScenariosEnabled = !!nextPatch.shockScenariosEnabled;
    }

    markMcStale();
    commitUIUpdate({ allowScenarioLockBypass: true });
    refreshLegacyScenarioManagerIfMounted();
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeUpdateIntelExpertToggles(patch){
    const nextPatch = (patch && typeof patch === "object") ? patch : {};
    const hasPatch = [
      "capacityDecayEnabled",
      "decayModel"
    ].some((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
    if (!hasPatch){
      return { ok: false, code: "empty_patch", view: scenarioBridgeStateView() };
    }

    const { expertToggles } = scenarioBridgeEnsureIntelToggles(getState());
    if (Object.prototype.hasOwnProperty.call(nextPatch, "capacityDecayEnabled")){
      expertToggles.capacityDecayEnabled = !!nextPatch.capacityDecayEnabled;
    }

    if (nextPatch.decayModel && typeof nextPatch.decayModel === "object"){
      const decay = expertToggles.decayModel || {};
      if (Object.prototype.hasOwnProperty.call(nextPatch.decayModel, "type")){
        const rawType = String(nextPatch.decayModel.type || "").trim().toLowerCase();
        decay.type = rawType === "linear" ? "linear" : "linear";
      }
      if (Object.prototype.hasOwnProperty.call(nextPatch.decayModel, "weeklyDecayPct")){
        const n = Number(nextPatch.decayModel.weeklyDecayPct);
        if (Number.isFinite(n)) {
          decay.weeklyDecayPct = Math.min(1, Math.max(0, n));
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextPatch.decayModel, "floorPctOfBaseline")){
        const n = Number(nextPatch.decayModel.floorPctOfBaseline);
        if (Number.isFinite(n)) {
          decay.floorPctOfBaseline = Math.min(1, Math.max(0, n));
        }
      }
      expertToggles.decayModel = decay;
    }

    markMcStale();
    commitUIUpdate({ allowScenarioLockBypass: true });
    refreshLegacyScenarioManagerIfMounted();
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeSetPendingCriticalNote(note){
    const state = getState();
    if (!state.ui || typeof state.ui !== "object"){
      state.ui = {};
    }
    state.ui.pendingCriticalNote = String(note || "");
    commitUIUpdate({ allowScenarioLockBypass: true });
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeSaveBenchmark(payload){
    const result = upsertBenchmarkEntry(getState(), payload || {});
    if (!result?.ok){
      return { ok: false, code: "save_failed", error: String(result?.error || "Benchmark save failed."), view: scenarioBridgeStateView() };
    }
    commitUIUpdate({ allowScenarioLockBypass: true });
    return { ok: true, mode: result.mode || "updated", row: result.row || null, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeLoadDefaultBenchmarks(scopeInput){
    const result = loadDefaultBenchmarksForRaceType(getState(), scopeInput || "default");
    if (!result?.ok){
      return { ok: false, code: "load_defaults_failed", error: String(result?.error || "Failed to load defaults."), view: scenarioBridgeStateView() };
    }
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      raceType: result.raceType || "all",
      benchmarkKey: result.benchmarkKey || "default",
      created: result.created || 0,
      updated: result.updated || 0,
      view: scenarioBridgeStateView(),
    };
  }

  function scenarioBridgeRemoveBenchmark(benchmarkId){
    const result = removeBenchmarkEntry(getState(), benchmarkId);
    if (!result?.ok){
      return { ok: false, code: "remove_failed", error: String(result?.error || "Failed to remove benchmark."), view: scenarioBridgeStateView() };
    }
    commitUIUpdate({ allowScenarioLockBypass: true });
    return { ok: true, view: scenarioBridgeStateView() };
  }

  function scenarioBridgeAttachEvidence(payload){
    const result = attachEvidenceRecord(getState(), payload || {});
    if (!result?.ok){
      return {
        ok: false,
        code: "attach_evidence_failed",
        error: String(result?.error || "Evidence attach failed."),
        view: scenarioBridgeStateView()
      };
    }
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      evidence: result.evidence || null,
      resolvedAuditId: result.resolvedAuditId || null,
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeGenerateIntelBrief(kind){
    const briefKind = String(kind || "calibrationSources").trim() || "calibrationSources";
    let result = null;
    if (briefKind === "scenarioSummary"){
      result = generateScenarioSummaryBrief(getState());
    } else if (briefKind === "scenarioDiff"){
      result = generateScenarioDiffBrief(getState(), { baselineId: "baseline" });
    } else if (briefKind === "driftExplanation"){
      result = generateDriftExplanationBrief(getState(), { drift: computeRealityDrift() });
    } else if (briefKind === "sensitivityInterpretation"){
      result = generateSensitivityInterpretationBrief(getState());
    } else {
      result = generateCalibrationSourceBrief(getState());
    }
    if (!result?.ok){
      return {
        ok: false,
        code: "generate_brief_failed",
        error: String(result?.error || "Failed to generate brief."),
        kind: briefKind,
        view: scenarioBridgeStateView()
      };
    }
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      kind: briefKind,
      brief: result.brief || null,
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeAddDefaultCorrelation(){
    const result = addDefaultCorrelationModel(getState());
    if (!result?.ok){
      return {
        ok: false,
        code: "add_correlation_failed",
        error: String(result?.error || "Failed to add default correlation model."),
        view: scenarioBridgeStateView()
      };
    }
    markMcStale();
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      mode: result.mode || "updated",
      row: result.row || null,
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeImportCorrelationModels(jsonText){
    const result = importCorrelationModelsJson(getState(), jsonText || "");
    if (!result?.ok){
      return {
        ok: false,
        code: "import_correlation_failed",
        error: String(result?.error || "Failed to import correlation models."),
        view: scenarioBridgeStateView()
      };
    }
    markMcStale();
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      created: Number(result.created || 0),
      updated: Number(result.updated || 0),
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeAddDefaultShock(){
    const result = addDefaultShockScenario(getState());
    if (!result?.ok){
      return {
        ok: false,
        code: "add_shock_failed",
        error: String(result?.error || "Failed to add default shock scenario."),
        view: scenarioBridgeStateView()
      };
    }
    markMcStale();
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      mode: result.mode || "updated",
      row: result.row || null,
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeImportShockScenarios(jsonText){
    const result = importShockScenariosJson(getState(), jsonText || "");
    if (!result?.ok){
      return {
        ok: false,
        code: "import_shock_failed",
        error: String(result?.error || "Failed to import shock scenarios."),
        view: scenarioBridgeStateView()
      };
    }
    markMcStale();
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      created: Number(result.created || 0),
      updated: Number(result.updated || 0),
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeCaptureObservedMetrics(){
    const drift = computeRealityDrift();
    const result = captureObservedMetricsFromDrift(getState(), drift);
    if (!result?.ok){
      return {
        ok: false,
        code: "capture_observed_failed",
        error: String(result?.error || "Observed metrics capture failed."),
        view: scenarioBridgeStateView()
      };
    }
    commitUIUpdate();
    return {
      ok: true,
      created: Number(result.created || 0),
      updated: Number(result.updated || 0),
      total: Number(result.total || 0),
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeGenerateDriftRecommendations(){
    const drift = computeRealityDrift();
    const refresh = captureObservedAndRefreshDriftRecommendations(getState(), { drift });
    const metricsResult = refresh.metricsResult;
    const result = refresh.recommendationResult;
    if (!result?.ok){
      return {
        ok: false,
        code: "generate_recommendations_failed",
        error: String(result?.error || "Recommendation generation failed."),
        metricsOk: !!metricsResult?.ok,
        metricsError: metricsResult?.ok ? "" : String(metricsResult?.error || ""),
        view: scenarioBridgeStateView()
      };
    }
    commitUIUpdate();
    return {
      ok: true,
      autoTotal: Number(result.autoTotal || 0),
      created: Number(result.created || 0),
      updated: Number(result.updated || 0),
      cleared: Number(result.cleared || 0),
      metricsOk: !!metricsResult?.ok,
      metricsCreated: Number(metricsResult?.created || 0),
      metricsUpdated: Number(metricsResult?.updated || 0),
      metricsError: metricsResult?.ok ? "" : String(metricsResult?.error || ""),
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeParseWhatIf(requestText){
    const result = createWhatIfIntelRequest(getState(), String(requestText || ""), { source: "user.whatIf.v1", maxEntries: 120 });
    if (!result?.ok){
      return {
        ok: false,
        code: "parse_what_if_failed",
        error: String(result?.error || "Failed to parse what-if request."),
        view: scenarioBridgeStateView()
      };
    }
    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      parsedTargets: Number(result.parsedTargets || 0),
      unresolved: Number(result.unresolved || 0),
      row: result.row || null,
      view: scenarioBridgeStateView()
    };
  }

  function scenarioBridgeApplyTopRecommendation(){
    const result = applyTopDriftRecommendation(getState());
    if (!result?.ok){
      return {
        ok: false,
        code: String(result?.code || "apply_recommendation_failed"),
        error: String(result?.error || "Failed to apply recommendation patch."),
        view: scenarioBridgeStateView()
      };
    }

    markMcStale();
    commitUIUpdate();

    commitUIUpdate({ allowScenarioLockBypass: true });
    return {
      ok: true,
      recommendationId: String(result.recommendationId || ""),
      recommendationTitle: String(result.recommendationTitle || ""),
      changesCount: Number(result.changesCount || 0),
      noop: !!result.noop,
      needsGovernance: !!result.needsGovernance,
      view: scenarioBridgeStateView()
    };
  }

  function installScenarioBridge(){
    const windowRef = getWindowRef();
    if (!windowRef || typeof windowRef !== "object"){
      return;
    }
    windowRef[scenarioBridgeKey] = {
      getView: () => scenarioBridgeStateView(),
      getLiveInputs: () => scenarioClone(scenarioInputsFromState(getState()) || {}),
      getLiveOutputs: () => scenarioClone(scenarioOutputsFromState(getState()) || {}),
      selectScenario: (id) => scenarioBridgeSelect(id),
      saveNew: (name) => scenarioBridgeSaveNew(name),
      cloneBaseline: (name) => scenarioBridgeCloneBaseline(name),
      loadScenario: (id) => scenarioBridgeLoad(id),
      loadSelected: () => scenarioBridgeLoad(getState()?.ui?.scenarioUiSelectedId),
      returnBaseline: () => scenarioBridgeLoad(scenarioBaselineId),
      deleteSelected: () => scenarioBridgeDeleteSelected(),
      updateIntelWorkflow: (patch) => scenarioBridgeUpdateIntelWorkflow(patch),
      updateIntelSimToggles: (patch) => scenarioBridgeUpdateIntelSimToggles(patch),
      updateIntelExpertToggles: (patch) => scenarioBridgeUpdateIntelExpertToggles(patch),
      setPendingCriticalNote: (note) => scenarioBridgeSetPendingCriticalNote(note),
      saveBenchmark: (payload) => scenarioBridgeSaveBenchmark(payload),
      loadDefaultBenchmarks: (scopeInput) => scenarioBridgeLoadDefaultBenchmarks(scopeInput),
      removeBenchmark: (benchmarkId) => scenarioBridgeRemoveBenchmark(benchmarkId),
      attachEvidence: (payload) => scenarioBridgeAttachEvidence(payload),
      generateIntelBrief: (kind) => scenarioBridgeGenerateIntelBrief(kind),
      addDefaultCorrelationModel: () => scenarioBridgeAddDefaultCorrelation(),
      importCorrelationModels: (jsonText) => scenarioBridgeImportCorrelationModels(jsonText),
      addDefaultShockScenario: () => scenarioBridgeAddDefaultShock(),
      importShockScenarios: (jsonText) => scenarioBridgeImportShockScenarios(jsonText),
      captureObservedMetrics: () => scenarioBridgeCaptureObservedMetrics(),
      generateDriftRecommendations: () => scenarioBridgeGenerateDriftRecommendations(),
      parseWhatIf: (requestText) => scenarioBridgeParseWhatIf(requestText),
      applyTopRecommendation: () => scenarioBridgeApplyTopRecommendation(),
    };
  }

  return {
    hasLegacyScenarioManagerDom,
    refreshLegacyScenarioManagerIfMounted,
    scenarioBridgeStateView,
    scenarioBridgeSelect,
    scenarioBridgeSaveNew,
    scenarioBridgeCloneBaseline,
    scenarioBridgeLoad,
    scenarioBridgeDeleteSelected,
    scenarioBridgeEnsureIntelWorkflow,
    scenarioBridgeEnsureIntelToggles,
    scenarioBridgeUpdateIntelWorkflow,
    scenarioBridgeUpdateIntelSimToggles,
    scenarioBridgeUpdateIntelExpertToggles,
    scenarioBridgeSetPendingCriticalNote,
    scenarioBridgeSaveBenchmark,
    scenarioBridgeLoadDefaultBenchmarks,
    scenarioBridgeRemoveBenchmark,
    scenarioBridgeAttachEvidence,
    scenarioBridgeGenerateIntelBrief,
    scenarioBridgeAddDefaultCorrelation,
    scenarioBridgeImportCorrelationModels,
    scenarioBridgeAddDefaultShock,
    scenarioBridgeImportShockScenarios,
    scenarioBridgeCaptureObservedMetrics,
    scenarioBridgeGenerateDriftRecommendations,
    scenarioBridgeParseWhatIf,
    scenarioBridgeApplyTopRecommendation,
    installScenarioBridge,
  };
}
