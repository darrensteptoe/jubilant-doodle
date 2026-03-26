// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createShellBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };

  const replaceState = (nextState) => {
    call(deps.replaceState, nextState);
  };

  const clean = (value) => String(value == null ? "" : value).trim();

  const toFiniteOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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

  const resolvedContext = () => {
    const srcState = getState();
    return call(deps.resolveActiveContext, {
      fallback: {
        campaignId: srcState?.campaignId,
        campaignName: srcState?.campaignName,
        officeId: srcState?.officeId,
        scenarioId: srcState?.ui?.activeScenarioId || srcState?.scenarioId,
      },
    }) || {};
  };

  const syncContextLinks = () => {
    const ctx = resolvedContext();
    call(deps.applyActiveContextToLinks, ctx, ".nav-item-new[href]");
    call(deps.applyActiveContextToLinks, ctx, ".fpe-nav__item[href]");
  };

  const resolveDecisionSession = (srcState = getState()) => {
    const decision = srcState?.ui?.decision;
    const sessions = (decision?.sessions && typeof decision.sessions === "object")
      ? decision.sessions
      : {};
    const activeId = clean(decision?.activeSessionId);
    if (activeId && sessions[activeId] && typeof sessions[activeId] === "object"){
      return sessions[activeId];
    }
    const ids = Object.keys(sessions);
    if (!ids.length){
      return null;
    }
    const first = sessions[ids[0]];
    return first && typeof first === "object" ? first : null;
  };

  const buildPlaybookSignals = (srcState = getState()) => {
    const validation = srcState?.ui?.lastValidationSnapshot && typeof srcState.ui.lastValidationSnapshot === "object"
      ? srcState.ui.lastValidationSnapshot
      : {};
    const validationReadiness = validation?.readiness && typeof validation.readiness === "object"
      ? validation.readiness
      : {};
    const readinessBand = clean(validation?.readinessBand || validationReadiness?.band).toLowerCase();
    const readinessScore = toFiniteOrNull(validation?.readinessScore ?? validationReadiness?.score);
    const realism = srcState?.ui?.lastRealismSnapshot && typeof srcState.ui.lastRealismSnapshot === "object"
      ? srcState.ui.lastRealismSnapshot
      : {};
    const realismClassification = clean(realism?.classification).toLowerCase();
    const realismStatus = clean(realism?.status).toLowerCase();
    const capacitySeverity = clean(realism?.capacity?.severity).toLowerCase();
    const capacityRatioRequiredToAvailable = toFiniteOrNull(realism?.capacity?.ratioRequiredToAvailable);
    const governance = srcState?.ui?.lastGovernanceSnapshot && typeof srcState.ui.lastGovernanceSnapshot === "object"
      ? srcState.ui.lastGovernanceSnapshot
      : {};
    const governanceConfidenceBand = clean(governance?.confidenceBand).toLowerCase();
    const saturationPressure = clean(governance?.executionSaturationPressure).toLowerCase();
    const governanceTopWarning = clean(governance?.topWarning);
    const learningTopSuggestion = clean(governance?.learningTopSuggestion);
    const learningRecommendation = clean(governance?.learningRecommendation);
    const assumptionDriftDetected = /assumption/i.test(governanceTopWarning)
      || /assumption/i.test(learningTopSuggestion)
      || /assumption/i.test(learningRecommendation);

    const weather = srcState?.warRoom?.weather && typeof srcState.warRoom.weather === "object"
      ? srcState.warRoom.weather
      : {};
    const weatherAdjustment = srcState?.warRoom?.weatherAdjustment && typeof srcState.warRoom.weatherAdjustment === "object"
      ? srcState.warRoom.weatherAdjustment
      : {};
    const weatherFieldExecutionRisk = clean(weather?.fieldExecutionRisk).toLowerCase();
    const weatherElectionDayTurnoutRisk = clean(weather?.electionDayTurnoutRisk).toLowerCase();
    const weatherMode = weatherAdjustment?.enabled && clean(weatherAdjustment?.mode).toLowerCase() === "today_only"
      ? "today_only"
      : "observe_only";

    const eventCalendar = srcState?.warRoom?.eventCalendar && typeof srcState.warRoom.eventCalendar === "object"
      ? srcState.warRoom.eventCalendar
      : {};
    const events = Array.isArray(eventCalendar?.events) ? eventCalendar.events : [];
    const todayIso = new Date().toISOString().slice(0, 10);
    let appliedCampaignEvents = 0;
    let todayCampaignEvents = 0;
    let todayExpectedVolunteers = 0;
    for (const eventRow of events){
      if (clean(eventRow?.category).toLowerCase() !== "campaign") continue;
      if (!eventRow?.applyToModel) continue;
      appliedCampaignEvents += 1;
      if (clean(eventRow?.date) === todayIso){
        todayCampaignEvents += 1;
        const expectedVolunteers = toFiniteOrNull(eventRow?.expectedVolunteers);
        if (expectedVolunteers != null && expectedVolunteers > 0){
          todayExpectedVolunteers += expectedVolunteers;
        }
      }
    }

    const decisionSession = resolveDecisionSession(srcState);
    const decisionWarRoom = decisionSession?.warRoom && typeof decisionSession.warRoom === "object"
      ? decisionSession.warRoom
      : {};
    const decisionItemsCount = Array.isArray(decisionWarRoom?.decisionItems) ? decisionWarRoom.decisionItems.length : 0;
    const watchItemsCount = Array.isArray(decisionWarRoom?.watchItems) ? decisionWarRoom.watchItems.length : 0;
    const decisionPressureLevel = decisionItemsCount >= 3
      ? "high"
      : (decisionItemsCount > 0 ? "medium" : "low");

    const persuasionPct = toFiniteOrNull(srcState?.persuasionPct);
    const workforceRoleTypingCoverage = toFiniteOrNull(srcState?.ui?.twCapOutlookLatest?.workforce?.roleTypingCoveragePct);
    const volunteerScale = toFiniteOrNull(srcState?.volunteerMultBase);

    const tacticRows = srcState?.budget?.tactics && typeof srcState.budget.tactics === "object"
      ? Object.entries(srcState.budget.tactics)
        .map(([id, tactic]) => ({
          id: clean(id).toLowerCase(),
          enabled: !!tactic?.enabled,
          cpa: toFiniteOrNull(tactic?.cpa),
        }))
        .filter((row) => row.enabled && row.cpa != null && row.cpa > 0)
      : [];
    let optimizerCheapChannelRisk = false;
    if (tacticRows.length >= 2){
      const sortedByCpa = tacticRows.slice().sort((a, b) => Number(a.cpa) - Number(b.cpa));
      const cheapest = toFiniteOrNull(sortedByCpa[0]?.cpa);
      const second = toFiniteOrNull(sortedByCpa[1]?.cpa);
      if (cheapest != null && second != null && cheapest > 0){
        optimizerCheapChannelRisk = (second / cheapest) >= 2.2;
      }
    }

    const planRows = Array.isArray(srcState?.ui?.lastPlanRows) ? srcState.ui.lastPlanRows : [];
    let optimizerTopChannelShare = null;
    if (planRows.length){
      let totalAttempts = 0;
      let topAttempts = 0;
      for (const row of planRows){
        const attempts = toFiniteOrNull(row?.attempts);
        if (attempts == null || attempts <= 0) continue;
        totalAttempts += attempts;
        if (attempts > topAttempts){
          topAttempts = attempts;
        }
      }
      if (totalAttempts > 0){
        optimizerTopChannelShare = topAttempts / totalAttempts;
      }
    }

    return {
      readinessBand,
      readinessScore,
      realismClassification,
      realismStatus,
      governanceConfidenceBand,
      governanceTopWarning,
      assumptionDriftDetected,
      saturationPressure,
      decisionPressureLevel,
      decisionItemsCount,
      watchItemsCount,
      optimizerCheapChannelRisk,
      optimizerTopChannelShare,
      persuasionPct,
      roleTypingCoveragePct: workforceRoleTypingCoverage,
      volunteerScale,
      capacitySeverity,
      capacityRatioRequiredToAvailable,
      weatherFieldExecutionRisk,
      weatherElectionDayTurnoutRisk,
      weatherMode,
      appliedCampaignEvents,
      todayCampaignEvents,
      todayExpectedVolunteers,
    };
  };

  const readPlaybookEnabled = (srcState = getState()) => {
    const ui = (srcState?.ui && typeof srcState.ui === "object") ? srcState.ui : {};
    if (Object.prototype.hasOwnProperty.call(ui, "playbook")){
      return !!ui.playbook;
    }
    return !!ui.training;
  };

  const applyPlaybookUiState = (enabled) => {
    const srcState = getState();
    const value = !!enabled;
    if (!srcState.ui || typeof srcState.ui !== "object") srcState.ui = {};
    srcState.ui.playbook = value;
    srcState.ui.training = value;
    if (deps.els?.toggleTraining) deps.els.toggleTraining.checked = value;
    const doc = getDocumentRef();
    if (doc?.body?.classList){
      doc.body.classList.toggle("training", value);
      doc.body.classList.toggle("playbook", value);
    }
    if (deps.els?.explainCard) deps.els.explainCard.hidden = !value;
  };

  const stateView = () => {
    const srcState = getState();
    const ctx = resolvedContext();
    const contextValidation = call(deps.validateCampaignContext, ctx, { requireOffice: false }) || {};
    const playbookEnabled = readPlaybookEnabled(srcState);
    return {
      scenarioName: String(srcState?.scenarioName || ""),
      playbookEnabled,
      trainingEnabled: playbookEnabled,
      campaignId: String(ctx?.campaignId || ""),
      campaignName: String(srcState?.campaignName || ctx?.campaignName || ""),
      officeId: String(ctx?.officeId || ""),
      scenarioId: String(ctx?.scenarioId || ""),
      isCampaignLocked: !!ctx?.isCampaignLocked,
      isOfficeLocked: !!ctx?.isOfficeLocked,
      isScenarioLocked: !!ctx?.isScenarioLocked,
      contextReady: !!contextValidation?.ok,
      contextMissing: Array.isArray(contextValidation?.missing) ? contextValidation.missing.slice() : [],
      playbookSignals: buildPlaybookSignals(srcState),
    };
  };

  const storageBackendAvailable = (name) => {
    const key = String(name || "").trim();
    const win = getWindowRef();
    if (!win) return false;
    try {
      if (key === "localStorage"){
        return typeof win.localStorage !== "undefined";
      }
      if (key === "sessionStorage"){
        return typeof win.sessionStorage !== "undefined";
      }
      if (key === "indexedDB"){
        return typeof win.indexedDB !== "undefined";
      }
    } catch {}
    return false;
  };

  const readStorageUsage = () => {
    const root = typeof globalThis === "object" ? globalThis : {};
    const src = root && typeof root === "object" ? root.__FPE_STORAGE_DEBUG__ : null;
    const readBucket = (name) => {
      const row = src && typeof src === "object" && src[name] && typeof src[name] === "object"
        ? src[name]
        : {};
      return {
        reads: Number(row.reads || 0),
        writes: Number(row.writes || 0),
        removes: Number(row.removes || 0),
        lastKey: String(row.lastKey || "").trim(),
        lastAt: String(row.lastAt || "").trim(),
        lastOk: typeof row.lastOk === "boolean" ? row.lastOk : null,
      };
    };
    return {
      localStorage: readBucket("localStorage"),
      sessionStorage: readBucket("sessionStorage"),
      indexedDB: readBucket("indexedDB"),
      memory: readBucket("memory"),
    };
  };

  const readPersistedStateByScope = (context = {}) => {
    const payload = call(deps.loadState, {
      campaignId: context?.campaignId,
      campaignName: context?.campaignName,
      officeId: context?.officeId,
      scenarioId: context?.scenarioId,
    });
    return payload && typeof payload === "object" ? payload : null;
  };

  const readLocalStorageRaw = (key) => {
    const storageKey = String(key || "").trim();
    if (!storageKey){
      return "";
    }
    const win = getWindowRef();
    if (!win?.localStorage) return "";
    try {
      return String(win.localStorage.getItem(storageKey) || "");
    } catch {
      return "";
    }
  };

  const districtDebugValuesFromState = (srcState) => {
    const src = srcState && typeof srcState === "object" ? srcState : {};
    const canonical = src?.canonical && typeof src.canonical === "object" ? src.canonical : {};
    const domains = canonical?.domains && typeof canonical.domains === "object" ? canonical.domains : {};
    const districtDomain = domains?.district && typeof domains.district === "object" ? domains.district : {};
    const template = districtDomain?.templateProfile && typeof districtDomain.templateProfile === "object"
      ? districtDomain.templateProfile
      : {};
    const form = districtDomain?.form && typeof districtDomain.form === "object"
      ? districtDomain.form
      : {};
    const raceTemplate = call(deps.cleanText, template?.raceType || src?.raceType);
    const universeCanonical = call(deps.safeNum, form?.universeSize);
    const universeLegacy = call(deps.safeNum, src?.universeSize);
    const universeSize = universeCanonical == null ? universeLegacy : universeCanonical;
    return {
      raceTemplate,
      universeSize,
    };
  };

  const runtimeDiagnostics = () => {
    const srcState = getState();
    const ctx = resolvedContext();
    const canonicalDistrict = call(deps.selectDistrictCanonicalView, srcState || {}) || {};
    const currentCanonicalRaceTemplate = call(deps.cleanText, canonicalDistrict?.templateProfile?.raceType);
    const currentCanonicalUniverseSize = call(deps.safeNum, canonicalDistrict?.form?.universeSize);
    const stateStorageKey = call(deps.makeStateStorageKey, {
      campaignId: ctx?.campaignId,
      campaignName: ctx?.campaignName,
      officeId: ctx?.officeId,
      scenarioId: ctx?.scenarioId,
    });
    const persistedRaw = readLocalStorageRaw(stateStorageKey);
    let parsedPersisted = null;
    if (persistedRaw){
      try {
        const parsed = JSON.parse(persistedRaw);
        if (parsed && typeof parsed === "object"){
          parsedPersisted = parsed;
        }
      } catch {}
    }
    const scopedPersisted = parsedPersisted || readPersistedStateByScope(ctx);
    const persistedDistrict = districtDebugValuesFromState(scopedPersisted);
    const persistedSchemaVersion = Number.isFinite(Number(scopedPersisted?.schemaVersion))
      ? Number(scopedPersisted.schemaVersion)
      : null;
    const runtimeSchemaVersion = Number(call(deps.getRuntimeSchemaVersion) || 0) || 0;
    return {
      generatedAt: new Date().toISOString(),
      appVersion: String(deps.APP_VERSION || ""),
      buildId: String(deps.BUILD_ID || ""),
      runtimeSchemaVersion,
      activeStateSchemaVersion: Number.isFinite(Number(srcState?.schemaVersion))
        ? Number(srcState.schemaVersion)
        : null,
      context: {
        campaignId: String(ctx?.campaignId || ""),
        campaignName: String(srcState?.campaignName || ctx?.campaignName || ""),
        officeId: String(ctx?.officeId || ""),
        scenarioId: String(ctx?.scenarioId || ""),
      },
      storage: {
        stateStorageKey: String(stateStorageKey || ""),
        persistedRawBytes: persistedRaw ? persistedRaw.length : 0,
        backends: {
          localStorage: storageBackendAvailable("localStorage"),
          sessionStorage: storageBackendAvailable("sessionStorage"),
          indexedDB: storageBackendAvailable("indexedDB"),
        },
        usage: readStorageUsage(),
      },
      district: {
        currentCanonical: {
          raceTemplate: currentCanonicalRaceTemplate,
          universeSize: currentCanonicalUniverseSize,
        },
        persisted: {
          raceTemplate: persistedDistrict.raceTemplate,
          universeSize: persistedDistrict.universeSize,
        },
      },
      persisted: {
        found: !!scopedPersisted,
        schemaVersion: persistedSchemaVersion,
      },
    };
  };

  const setScenarioName = (rawValue) => {
    const srcState = getState();
    const nextValue = String(rawValue == null ? "" : rawValue);
    srcState.scenarioName = nextValue;
    if (deps.els?.scenarioName && deps.els.scenarioName.value !== nextValue){
      deps.els.scenarioName.value = nextValue;
    }
    call(deps.schedulePersist);
    call(deps.notifyBridgeSync, { source: "bridge.shell", reason: "scenario_name_changed" });
    return { ok: true, view: stateView() };
  };

  const setContext = (rawPatch) => {
    const patch = (rawPatch && typeof rawPatch === "object") ? rawPatch : {};
    const srcState = getState();
    const current = resolvedContext();
    const requestedCampaignId = String(patch.campaignId == null ? "" : patch.campaignId).trim();
    const requestedCampaignName = String(patch.campaignName == null ? "" : patch.campaignName).trim();
    const requestedOfficeId = String(patch.officeId == null ? "" : patch.officeId).trim();
    const requestedScenarioId = String(patch.scenarioId == null ? "" : patch.scenarioId).trim();

    const next = call(deps.resolveActiveContext, {
      campaignId: current.isCampaignLocked ? current.campaignId : requestedCampaignId,
      campaignName: current.isCampaignLocked ? current.campaignName : requestedCampaignName,
      officeId: current.isOfficeLocked ? current.officeId : requestedOfficeId,
      scenarioId: current.isScenarioLocked ? current.scenarioId : requestedScenarioId,
      fallback: {
        campaignId: srcState?.campaignId || current.campaignId,
        campaignName: srcState?.campaignName || current.campaignName,
        officeId: srcState?.officeId || current.officeId,
        scenarioId: srcState?.ui?.activeScenarioId || srcState?.scenarioId || current.scenarioId,
      },
    }) || {};
    const nextContextValidation = call(deps.validateCampaignContext, next, { requireOffice: false }) || {};
    call(deps.observeContractEvent, {
      type: "context_update",
      action_name: "shellBridgeSetContext",
      handler_name: "shellBridgeSetContext",
      context: {
        campaignId: next?.campaignId,
        officeId: next?.officeId,
        scenarioId: next?.scenarioId,
      },
      contextReady: !!nextContextValidation?.ok,
      contextMissing: Array.isArray(nextContextValidation?.missing) ? nextContextValidation.missing.slice() : [],
      observed_behavior: nextContextValidation?.ok
        ? "context update resolved campaign/office scope"
        : `context update missing: ${(nextContextValidation?.missing || []).join(", ")}`,
    });

    if (current.isCampaignLocked && requestedCampaignId && requestedCampaignId !== current.campaignId){
      return { ok: false, code: "campaign_locked", view: stateView() };
    }
    if (current.isOfficeLocked && requestedOfficeId && requestedOfficeId !== current.officeId){
      return { ok: false, code: "office_locked", view: stateView() };
    }
    if (current.isScenarioLocked && requestedScenarioId && requestedScenarioId !== current.scenarioId){
      return { ok: false, code: "scenario_locked", view: stateView() };
    }

    const scopeChanged = (
      String(current?.campaignId || "") !== String(next?.campaignId || "")
      || String(current?.officeId || "") !== String(next?.officeId || "")
    );

    if (!scopeChanged){
      srcState.campaignId = String(next?.campaignId || srcState?.campaignId || "");
      srcState.officeId = String(next?.officeId || srcState?.officeId || "");
      if (requestedCampaignName && !current.isCampaignLocked){
        srcState.campaignName = requestedCampaignName;
      } else if (!srcState.campaignName){
        srcState.campaignName = String(next?.campaignName || "");
      }
      syncContextLinks();
      call(deps.schedulePersist);
      call(deps.notifyBridgeSync, { source: "bridge.shell", reason: "context_updated" });
      return { ok: true, changed: false, view: stateView() };
    }

    call(deps.persist);
    const loaded = call(deps.loadState, {
      campaignId: next.campaignId,
      campaignName: requestedCampaignName || next.campaignName,
      officeId: next.officeId,
      scenarioId: next.scenarioId,
    });

    const nextState = call(deps.normalizeLoadedScenarioRuntime, loaded || call(deps.makeDefaultStateModule, {
      uid: deps.uid,
      activeContext: {
        campaignId: next.campaignId,
        campaignName: requestedCampaignName || next.campaignName,
        officeId: next.officeId,
        scenarioId: next.scenarioId,
      },
    })) || {};
    replaceState(nextState);

    call(deps.observeContractEvent, {
      type: "state_rehydrated",
      action_name: "shellBridgeSetContext.scope_change",
      handler_name: "shellBridgeSetContext",
      context: {
        campaignId: nextState?.campaignId,
        officeId: nextState?.officeId,
        scenarioId: nextState?.ui?.activeScenarioId || nextState?.scenarioId,
      },
      observed_behavior: "state rehydrated for context scope change",
    });

    if (requestedCampaignName && !current.isCampaignLocked){
      nextState.campaignName = requestedCampaignName;
    }

    call(deps.refreshModelAuditFromArchive);
    call(deps.ensureScenarioRegistry);
    call(deps.ensureDecisionScaffold);
    try{
      const baseline = nextState?.ui?.scenarios?.[deps.SCENARIO_BASELINE_ID];
      if (baseline){
        baseline.inputs = call(deps.scenarioInputsFromState, nextState);
        baseline.outputs = call(deps.scenarioOutputsFromState, nextState);
      }
    } catch {}
    call(deps.applyStateToUI);
    call(deps.rebuildCandidateTable);
    call(deps.render);
    call(deps.safeCall, () => { call(deps.renderScenarioManagerC1); });
    call(deps.safeCall, () => { call(deps.renderDecisionSessionD1); });
    syncContextLinks();
    call(deps.persist);
    call(deps.notifyBridgeSync, { source: "bridge.shell", reason: "context_scope_changed" });
    return { ok: true, changed: true, view: stateView() };
  };

  const setTrainingEnabled = (enabled) => {
    applyPlaybookUiState(enabled);
    const snapshotHash = call(deps.getLastResultsSnapshot)?.snapshotHash || "—";
    call(deps.setText, deps.els?.snapshotHash, snapshotHash);
    call(deps.setText, deps.els?.snapshotHashSidebar, snapshotHash);
    call(deps.persist);
    call(deps.notifyBridgeSync, { source: "bridge.shell", reason: "playbook_toggled" });
    return { ok: true, view: stateView() };
  };

  const setPlaybookEnabled = (enabled) => setTrainingEnabled(enabled);

  const syncPlaybookUiState = () => {
    applyPlaybookUiState(readPlaybookEnabled());
    return { ok: true, view: stateView() };
  };

  const openDiagnosticsBridge = () => {
    call(deps.openDiagnostics);
    return { ok: true, view: stateView() };
  };

  const resetScenario = () => {
    const confirmFn = typeof deps.confirmFn === "function"
      ? deps.confirmFn
      : (typeof globalThis.confirm === "function" ? globalThis.confirm.bind(globalThis) : () => false);
    const ok = !!confirmFn("Reset all fields to defaults? This will clear the saved scenario in this browser.");
    if (!ok){
      return { ok: false, code: "canceled", view: stateView() };
    }
    const nextState = call(deps.makeDefaultState) || {};
    replaceState(nextState);
    call(deps.refreshModelAuditFromArchive);
    call(deps.ensureScenarioRegistry);
    call(deps.ensureDecisionScaffold);
    try{
      const baseline = nextState?.ui?.scenarios?.[deps.SCENARIO_BASELINE_ID];
      if (baseline){
        baseline.inputs = call(deps.scenarioInputsFromState, nextState);
        baseline.outputs = call(deps.scenarioOutputsFromState, nextState);
      }
    } catch {}
    call(deps.clearState);
    call(deps.applyStateToUI);
    call(deps.rebuildCandidateTable);
    syncPlaybookUiState();
    call(deps.applyThemeFromState);
    call(deps.render);
    call(deps.safeCall, () => { call(deps.renderScenarioManagerC1); });
    call(deps.safeCall, () => { call(deps.renderDecisionSessionD1); });
    syncContextLinks();
    call(deps.persist);
    call(deps.notifyBridgeSync, { source: "bridge.shell", reason: "scenario_reset" });
    return { ok: true, view: stateView() };
  };

  const install = () => {
    const win = getWindowRef();
    if (!win || typeof win !== "object"){
      return;
    }
    win[deps.shellBridgeKey] = {
      getView: () => stateView(),
      getRuntimeDiagnostics: () => runtimeDiagnostics(),
      setScenarioName: (value) => setScenarioName(value),
      setContext: (patch) => setContext(patch),
      setPlaybookEnabled: (enabled) => setPlaybookEnabled(enabled),
      setTrainingEnabled: (enabled) => setTrainingEnabled(enabled),
      openDiagnostics: () => openDiagnosticsBridge(),
      resetScenario: () => resetScenario(),
    };
    win.__FPE_RESET_SCENARIO__ = () => resetScenario();
    win.__FPE_RUNTIME_DIAGNOSTICS_RAW__ = () => runtimeDiagnostics();
  };

  return {
    stateView,
    runtimeDiagnostics,
    setScenarioName,
    setContext,
    setPlaybookEnabled,
    setTrainingEnabled,
    openDiagnostics: openDiagnosticsBridge,
    resetScenario,
    syncContextLinks,
    syncPlaybookUiState,
    install,
  };
}
