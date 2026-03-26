// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createDecisionBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const decisionBridgeKey = String(deps.decisionBridgeKey || "__FPE_DECISION_API__");

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };

  const getLastRenderCtx = () => {
    const value = call(deps.getLastRenderCtx);
    return value && typeof value === "object" ? value : null;
  };

  const getWindowRef = () => {
    if (deps.windowRef && typeof deps.windowRef === "object") return deps.windowRef;
    return typeof window !== "undefined" ? window : null;
  };

  const getDocumentRef = () => {
    if (deps.documentRef && typeof deps.documentRef === "object") return deps.documentRef;
    return typeof document !== "undefined" ? document : null;
  };

  const safeCall = (...args) => call(deps.safeCall, ...args);
  const renderDecisionSessionD1 = (...args) => call(deps.renderDecisionSessionD1, ...args);
  const renderDecisionSummaryD4 = (...args) => call(deps.renderDecisionSummaryD4, ...args);

  const ensureDecisionSessionShape = (...args) => call(deps.ensureDecisionSessionShape, ...args);
  const ensureWarRoomStateShape = (...args) => call(deps.ensureWarRoomStateShape, ...args);
  const ensureEventCalendarStateShape = (...args) => call(deps.ensureEventCalendarStateShape, ...args);
  const deriveVoterModelSignals = (...args) => call(deps.deriveVoterModelSignals, ...args);
  const extractCensusAgeDistribution = (...args) => call(deps.extractCensusAgeDistribution, ...args);
  const safeNum = (...args) => call(deps.safeNum, ...args);
  const buildWarRoomReviewBaselineView = (...args) => call(deps.buildWarRoomReviewBaselineView, ...args);

  const ensureScenarioRegistry = (...args) => call(deps.ensureScenarioRegistry, ...args);
  const ensureDecisionScaffold = (...args) => call(deps.ensureDecisionScaffold, ...args);
  const listDecisionSessions = (...args) => call(deps.listDecisionSessions, ...args);
  const getActiveDecisionSession = (...args) => call(deps.getActiveDecisionSession, ...args);
  const ensureDecisionOptionShape = (...args) => call(deps.ensureDecisionOptionShape, ...args);
  const listDecisionOptions = (...args) => call(deps.listDecisionOptions, ...args);
  const getActiveDecisionOption = (...args) => call(deps.getActiveDecisionOption, ...args);
  const decisionOptionDisplay = (...args) => call(deps.decisionOptionDisplay, ...args);
  const decisionScenarioLabel = (...args) => call(deps.decisionScenarioLabel, ...args);
  const buildDecisionSummaryText = (...args) => call(deps.buildDecisionSummaryText, ...args);

  const buildDecisionDiagnosticsSnapshotView = (...args) => call(deps.buildDecisionDiagnosticsSnapshotView, ...args);
  const DECISION_DIVERGENCE_KEY_ORDER = deps.DECISION_DIVERGENCE_KEY_ORDER || [];
  const clamp = (...args) => call(deps.clamp, ...args);
  const fmtInt = (...args) => call(deps.fmtInt, ...args);

  const buildWarRoomChangeClassificationView = (...args) => call(deps.buildWarRoomChangeClassificationView, ...args);
  const buildWarRoomDecisionLogRowsView = (...args) => call(deps.buildWarRoomDecisionLogRowsView, ...args);
  const buildWarRoomWeatherView = (...args) => call(deps.buildWarRoomWeatherView, ...args);
  const buildEventCalendarView = (...args) => call(deps.buildEventCalendarView, ...args);

  const OBJECTIVE_TEMPLATES = Array.isArray(deps.OBJECTIVE_TEMPLATES) ? deps.OBJECTIVE_TEMPLATES : [];
  const RISK_POSTURES = Array.isArray(deps.RISK_POSTURES) ? deps.RISK_POSTURES : [];
  const SCENARIO_BASELINE_ID = String(deps.SCENARIO_BASELINE_ID || "baseline");

  const persist = (...args) => call(deps.persist, ...args);
  const makeDecisionSessionId = (...args) => call(deps.makeDecisionSessionId, ...args);
  const makeDecisionOptionId = (...args) => call(deps.makeDecisionOptionId, ...args);
  const uid = (...args) => call(deps.uid, ...args);

  const normalizeZip = (...args) => call(deps.normalizeZip, ...args);
  const resolveSelectedZip = (...args) => call(deps.resolveSelectedZip, ...args);
  const applyWeatherModeToState = (...args) => call(deps.applyWeatherModeToState, ...args);
  const fetchWarRoomWeatherByZip = (...args) => call(deps.fetchWarRoomWeatherByZip, ...args);
  const applyWeatherObservationToState = (...args) => call(deps.applyWeatherObservationToState, ...args);
  const WEATHER_MODE_TODAY_ONLY = String(deps.WEATHER_MODE_TODAY_ONLY || "today_only");
  const WEATHER_MODE_OBSERVE_ONLY = String(deps.WEATHER_MODE_OBSERVE_ONLY || "observe_only");

  const setEventCalendarFilter = (...args) => call(deps.setEventCalendarFilter, ...args);
  const setEventCalendarDraftField = (...args) => call(deps.setEventCalendarDraftField, ...args);
  const saveEventCalendarDraftAsEvent = (...args) => call(deps.saveEventCalendarDraftAsEvent, ...args);
  const loadEventCalendarDraft = (...args) => call(deps.loadEventCalendarDraft, ...args);
  const clearEventCalendarDraft = (...args) => call(deps.clearEventCalendarDraft, ...args);
  const deleteEventCalendarRecord = (...args) => call(deps.deleteEventCalendarRecord, ...args);
  const updateEventCalendarApplyToModel = (...args) => call(deps.updateEventCalendarApplyToModel, ...args);
  const setEventCalendarStatus = (...args) => call(deps.setEventCalendarStatus, ...args);

  const copyTextToClipboard = (...args) => call(deps.copyTextToClipboard, ...args);
  const decisionSummaryPlainText = (...args) => call(deps.decisionSummaryPlainText, ...args);
  const decisionSessionExportObject = (...args) => call(deps.decisionSessionExportObject, ...args);
  const downloadJsonObject = (...args) => call(deps.downloadJsonObject, ...args);

  const getMcStaleness = (...args) => call(deps.getMcStaleness, ...args);
  const hashMcInputs = (...args) => call(deps.hashMcInputs, ...args);
  const computeDailyLogHash = (...args) => call(deps.computeDailyLogHash, ...args);
  const computeDecisionSensitivityMiniSurfaceCache = (...args) => call(deps.computeDecisionSensitivityMiniSurfaceCache, ...args);
  const runMonteCarloSim = (...args) => call(deps.runMonteCarloSim, ...args);
  const canonicalDoorsPerHourFromSnap = (...args) => call(deps.canonicalDoorsPerHourFromSnap, ...args);
  const canonicalCallsPerHourFromSnap = (...args) => call(deps.canonicalCallsPerHourFromSnap, ...args);
  const setCanonicalDoorsPerHour = (...args) => call(deps.setCanonicalDoorsPerHour, ...args);
  const setCanonicalCallsPerHour = (...args) => call(deps.setCanonicalCallsPerHour, ...args);
  const renderSensitivitySnapshotE4 = (...args) => call(deps.renderSensitivitySnapshotE4, ...args);

  const state = new Proxy({}, {
    get(_target, prop){
      return getState()?.[prop];
    },
    set(_target, prop, value){
      const src = getState();
      if (src && typeof src === "object"){
        src[prop] = value;
        return true;
      }
      return false;
    },
    has(_target, prop){
      const src = getState();
      return !!src && prop in src;
    },
    ownKeys(){
      const src = getState();
      return src && typeof src === "object" ? Reflect.ownKeys(src) : [];
    },
    getOwnPropertyDescriptor(_target, prop){
      const src = getState();
      if (src && Object.prototype.hasOwnProperty.call(src, prop)){
        return { enumerable: true, configurable: true, value: src[prop], writable: true };
      }
      return undefined;
    },
  });

  let decisionBridgeCopyStatus = "";
  
  function hasLegacyDecisionManagerDom(){
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== "function"){
      return false;
    }
    return !!(
      documentRef.getElementById("stage-decisions") ||
      documentRef.getElementById("decisionSessionSelect") ||
      documentRef.getElementById("decisionActiveLabel")
    );
  }
  
  function hasLegacySensitivitySnapshotDom(){
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== "function"){
      return false;
    }
    return !!(
      documentRef.getElementById("sensTag") ||
      documentRef.getElementById("sensTbody") ||
      documentRef.getElementById("sensBanner") ||
      documentRef.getElementById("btnSensRun")
    );
  }
  
  function refreshLegacyDecisionManagerIfMounted(){
    if (!hasLegacyDecisionManagerDom()){
      return;
    }
    safeCall(() => { renderDecisionSessionD1(); });
    safeCall(() => { renderDecisionSummaryD4(); });
  }
  
  function decisionBridgeParseMaybeNumber(raw){
    const text = String(raw ?? "").trim();
    if (!text) return null;
    const n = Number(text.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  
  function decisionBridgeLineList(raw){
    return String(raw ?? "")
      .split(/\r?\n|,/)
      .map((line) => String(line || "").trim())
      .filter(Boolean);
  }
  
  function decisionBridgeNormalizeWarRoomSession(session){
    if (!session || typeof session !== "object"){
      return null;
    }
    ensureDecisionSessionShape(session);
    if (!session.warRoom || typeof session.warRoom !== "object"){
      session.warRoom = {};
    }
    const warRoom = session.warRoom;
    if (!Array.isArray(warRoom.watchItems)) warRoom.watchItems = [];
    if (!Array.isArray(warRoom.decisionItems)) warRoom.decisionItems = [];
    if (!Array.isArray(warRoom.decisionLog)) warRoom.decisionLog = [];
    if (warRoom.owner == null) warRoom.owner = "";
    if (warRoom.followUpDate == null) warRoom.followUpDate = "";
    if (warRoom.decisionSummary == null) warRoom.decisionSummary = "";
    if (warRoom.lastReview == null || typeof warRoom.lastReview !== "object"){
      warRoom.lastReview = null;
    }
    return warRoom;
  }
  
  function decisionBridgeEnsureWarRoomState(){
    ensureWarRoomStateShape(state, { nowDate: new Date() });
    ensureEventCalendarStateShape(state, { nowDate: new Date() });
    return state?.warRoom || null;
  }
  
  function decisionBridgeWarRoomCurrentBaseline(session, diagnostics){
    const voterSignals = deriveVoterModelSignals(state?.voterData, {
      censusAgeDistribution: extractCensusAgeDistribution(state?.census),
      universeSize: safeNum(state?.universeSize),
    });
    return buildWarRoomReviewBaselineView({
      diagnostics,
      voterSignals,
      recommendedOptionId: session?.recommendedOptionId || "",
      scenarioId: state?.ui?.activeScenarioId || session?.scenarioId || SCENARIO_BASELINE_ID,
      reviewedAt: new Date().toISOString(),
    });
  }
  
  function decisionBridgeCurrentSnapshot(){
    ensureScenarioRegistry();
    ensureDecisionScaffold();
    decisionBridgeEnsureWarRoomState();
  
    const sessions = listDecisionSessions();
    const sessionMap = state?.ui?.decision?.sessions || {};
    const activeSession = getActiveDecisionSession();
    const activeSessionId = activeSession?.id || state?.ui?.decision?.activeSessionId || null;
  
    if (activeSession){
      ensureDecisionSessionShape(activeSession);
    }
  
    const options = activeSession ? listDecisionOptions(activeSession) : [];
    const activeOption = activeSession ? getActiveDecisionOption(activeSession) : null;
    if (activeOption){
      ensureDecisionOptionShape(activeOption);
    }
  
    const objectiveOptions = OBJECTIVE_TEMPLATES.map((row) => ({
      key: row.key,
      label: row.label
    }));
    const riskPostureOptions = RISK_POSTURES.map((row) => ({
      key: row.key,
      label: row.label
    }));
    const turfAccessOptions = [
      { key: "", label: "Unknown" },
      { key: "full", label: "Full" },
      { key: "limited", label: "Limited" },
      { key: "none", label: "None" },
    ];
  
    const objectiveLabel = objectiveOptions.find((row) => row.key === activeSession?.objectiveKey)?.label || "—";
    const selectedOptionLabel = decisionOptionDisplay(activeOption) || "—";
    const recommendedOption = activeSession?.recommendedOptionId
      ? (activeSession?.options?.[activeSession.recommendedOptionId] || null)
      : null;
    const recommendedOptionLabel = decisionOptionDisplay(recommendedOption) || "—";
    const scenarioLabel = decisionScenarioLabel(activeSession?.scenarioId || null);
  
    const summaryPreview = activeSession ? buildDecisionSummaryText(activeSession) : "";
  
    const diagnostics = decisionBridgeDiagnosticsSnapshot();
    const warRoomSession = decisionBridgeNormalizeWarRoomSession(activeSession);
    const warRoomCurrent = decisionBridgeWarRoomCurrentBaseline(activeSession, diagnostics);
    const warRoomPrevious = warRoomSession?.lastReview || null;
    const warRoomChange = buildWarRoomChangeClassificationView({
      previousBaseline: warRoomPrevious,
      currentBaseline: warRoomCurrent,
    });
    const warRoomDecisionLogRows = buildWarRoomDecisionLogRowsView(warRoomSession?.decisionLog || []);
    const weather = buildWarRoomWeatherView(state, { nowDate: new Date() });
    const eventCalendar = buildEventCalendarView(state, {
      nowDate: new Date(),
      scenarioId: state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID,
    });
  
    return {
      sessions,
      sessionMap,
      activeSessionId,
      activeSession,
      options,
      activeOption,
      objectiveOptions,
      riskPostureOptions,
      turfAccessOptions,
      objectiveLabel,
      selectedOptionLabel,
      recommendedOptionLabel,
      scenarioLabel,
      summaryPreview,
      diagnostics,
      warRoom: {
        current: warRoomCurrent,
        previous: warRoomPrevious,
        change: warRoomChange,
        watchItems: Array.isArray(warRoomSession?.watchItems) ? warRoomSession.watchItems.slice() : [],
        decisionItems: Array.isArray(warRoomSession?.decisionItems) ? warRoomSession.decisionItems.slice() : [],
        owner: String(warRoomSession?.owner || ""),
        followUpDate: String(warRoomSession?.followUpDate || ""),
        decisionSummary: String(warRoomSession?.decisionSummary || ""),
        decisionLogRows: warRoomDecisionLogRows,
        weather,
        eventCalendar,
      },
    };
  }
  
  function decisionBridgeDiagnosticsSnapshot(){
    ensureScenarioRegistry();
    const lastRenderCtx = getLastRenderCtx();
    const reg = state?.ui?.scenarios || {};
    const activeId = state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID;
    const baseInputs = reg?.[SCENARIO_BASELINE_ID]?.inputs || null;
    const activeInputs = reg?.[activeId]?.inputs || null;
    return buildDecisionDiagnosticsSnapshotView({
      executionSnapshot: lastRenderCtx?.executionSnapshot || null,
      weeklyContext: lastRenderCtx?.weeklyContext || null,
      mcResult: state?.mcLast || null,
      clampFn: clamp,
      bindingObj: state?.ui?.lastTlMeta?.bindingObj || null,
      primaryBottleneck: state?.ui?.lastDiagnostics?.primaryBottleneck || null,
      secondaryNotes: state?.ui?.lastDiagnostics?.secondaryNotes || null,
      sensitivityCache: state?.ui?.e4Sensitivity || null,
      baselineInputs: baseInputs,
      activeInputs,
      divergenceKeyOrder: DECISION_DIVERGENCE_KEY_ORDER,
      formatInt: (value) => fmtInt(value),
      weeksRemaining: lastRenderCtx?.weeks ?? null,
    });
  }
  
  function decisionBridgeStateView(){
    const snap = decisionBridgeCurrentSnapshot();
    const s = snap.activeSession || null;
    const activeOption = snap.activeOption || null;
    const warRoom = snap.warRoom && typeof snap.warRoom === "object" ? snap.warRoom : {};
    const recommendedOptionId = s?.recommendedOptionId || "";
    const whatNeedsTrueText = Array.isArray(s?.whatNeedsTrue) ? s.whatNeedsTrue.join("\n") : "";
    const nonNegotiablesText = Array.isArray(s?.nonNegotiables) ? s.nonNegotiables.join("\n") : "";
  
    const canDeleteSession = snap.sessions.length > 1;
    const canDeleteOption = snap.options.length > 1;
  
    return {
      sessions: snap.sessions.map((row) => ({
        id: row?.id || "",
        name: row?.name || row?.id || ""
      })),
      activeSessionId: snap.activeSessionId,
      activeSessionLabel: s ? `Active session: ${s.name || s.id}` : "Active session: —",
      objectiveOptions: snap.objectiveOptions,
      riskPostureOptions: snap.riskPostureOptions,
      turfAccessOptions: snap.turfAccessOptions,
      session: s ? {
        id: s.id,
        name: s.name || s.id,
        objectiveKey: s.objectiveKey || "",
        notes: s.notes || "",
        scenarioLabel: snap.scenarioLabel,
        constraints: {
          budget: s.constraints?.budget == null ? "" : String(s.constraints.budget),
          volunteerHrs: s.constraints?.volunteerHrs == null ? "" : String(s.constraints.volunteerHrs),
          turfAccess: s.constraints?.turfAccess || "",
          blackoutDates: s.constraints?.blackoutDates || "",
        },
        riskPosture: s.riskPosture || "balanced",
        nonNegotiablesText,
      } : null,
      options: snap.options.map((row) => ({
        id: row?.id || "",
        label: row?.label || row?.id || "",
        displayLabel: decisionOptionDisplay(row),
        scenarioLabel: decisionScenarioLabel(row?.scenarioId || null),
      })),
      activeOptionId: s?.activeOptionId || "",
      activeOption: activeOption ? {
        id: activeOption.id,
        label: activeOption.label || activeOption.id,
        scenarioLabel: decisionScenarioLabel(activeOption.scenarioId || null),
        tactics: {
          doors: !!activeOption?.tactics?.doors,
          phones: !!activeOption?.tactics?.phones,
          digital: !!activeOption?.tactics?.digital,
        },
      } : null,
      recommendedOptionId,
      whatNeedsTrueText,
      summaryPreview: snap.summaryPreview || "",
      copyStatus: decisionBridgeCopyStatus || "",
      canDeleteSession,
      canDeleteOption,
      diagnostics: snap.diagnostics,
      warRoom: {
        classification: String(warRoom?.change?.classification || "noise"),
        significance: String(warRoom?.change?.significance || "low"),
        actionability: String(warRoom?.change?.actionability || "watch"),
        score: Number.isFinite(Number(warRoom?.change?.score)) ? Number(warRoom.change.score) : 0,
        changedSinceReview: !!warRoom?.change?.changedSinceReview,
        summary: String(warRoom?.change?.summary || "—"),
        topDrivers: Array.isArray(warRoom?.change?.topDrivers) ? warRoom.change.topDrivers.slice() : [],
        deltas: warRoom?.change?.deltas || {},
        lastReviewAt: String(warRoom?.previous?.reviewedAt || ""),
        currentReviewAt: String(warRoom?.current?.reviewedAt || ""),
        watchItemsText: Array.isArray(warRoom?.watchItems) ? warRoom.watchItems.join("\n") : "",
        decisionItemsText: Array.isArray(warRoom?.decisionItems) ? warRoom.decisionItems.join("\n") : "",
        owner: String(warRoom?.owner || ""),
        followUpDate: String(warRoom?.followUpDate || ""),
        decisionSummary: String(warRoom?.decisionSummary || ""),
        recommendationLabel: snap.recommendedOptionLabel || "—",
        decisionLogRows: Array.isArray(warRoom?.decisionLogRows) ? warRoom.decisionLogRows : [],
        weather: warRoom?.weather || null,
        eventCalendar: warRoom?.eventCalendar || null,
      },
      summary: {
        objectiveLabel: snap.objectiveLabel || "—",
        selectedOptionLabel: snap.selectedOptionLabel || "—",
        recommendedOptionLabel: snap.recommendedOptionLabel || "—",
        confidenceTag: snap.diagnostics?.confidence?.tag || "—",
        riskTag: snap.diagnostics?.risk?.tag || "—",
        bottleneckTag: snap.diagnostics?.bottleneck?.tag || "—",
        scenarioLabel: snap.scenarioLabel || "—",
      },
    };
  }
  
  function decisionBridgeSelectSession(id){
    ensureDecisionScaffold();
    const nextId = String(id || "").trim();
    const sessions = state?.ui?.decision?.sessions || {};
    if (!nextId || !sessions[nextId]) {
      return { ok: false, code: "not_found", view: decisionBridgeStateView() };
    }
    state.ui.decision.activeSessionId = nextId;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeCreateSession(name){
    ensureDecisionScaffold();
    const sessions = state?.ui?.decision?.sessions || {};
    const id = makeDecisionSessionId();
    const defaultName = `Session ${Object.keys(sessions).length + 1}`;
    const nextName = String(name || "").trim() || defaultName;
    sessions[id] = {
      id,
      name: nextName,
      createdAt: new Date().toISOString(),
      scenarioId: state.ui.activeScenarioId || SCENARIO_BASELINE_ID,
      objectiveKey: OBJECTIVE_TEMPLATES[0]?.key || "win_prob",
      notes: "",
      constraints: { budget: null, volunteerHrs: null, turfAccess: "", blackoutDates: "" },
      riskPosture: "balanced",
      nonNegotiables: [],
      whatNeedsTrue: [],
      recommendedOptionId: null,
      options: {},
      activeOptionId: null,
      warRoom: {
        watchItems: [],
        decisionItems: [],
        owner: "",
        followUpDate: "",
        decisionSummary: "",
        lastReview: null,
        decisionLog: [],
      },
    };
    state.ui.decision.activeSessionId = id;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeRenameSession(name){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    const nextName = String(name || "").trim();
    if (!nextName) {
      return { ok: false, code: "invalid_name", view: decisionBridgeStateView() };
    }
    s.name = nextName;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeDeleteSession(){
    ensureDecisionScaffold();
    const sessions = state?.ui?.decision?.sessions || {};
    const ids = Object.keys(sessions);
    if (ids.length <= 1) {
      return { ok: false, code: "cannot_delete_last", view: decisionBridgeStateView() };
    }
    const cur = state?.ui?.decision?.activeSessionId || "";
    if (!cur || !sessions[cur]) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    delete sessions[cur];
    const nextIds = Object.keys(sessions);
    state.ui.decision.activeSessionId = nextIds[0] || null;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeLinkSessionToActiveScenario(){
    ensureScenarioRegistry();
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    s.scenarioId = state.ui.activeScenarioId || SCENARIO_BASELINE_ID;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeUpdateSessionField(field, value){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const warRoom = decisionBridgeNormalizeWarRoomSession(s);
    const key = String(field || "").trim();
    if (key === "objectiveKey"){
      s.objectiveKey = String(value || "").trim() || OBJECTIVE_TEMPLATES[0]?.key || "win_prob";
    } else if (key === "notes"){
      s.notes = String(value || "");
    } else if (key === "budget"){
      s.constraints.budget = decisionBridgeParseMaybeNumber(value);
    } else if (key === "volunteerHrs"){
      s.constraints.volunteerHrs = decisionBridgeParseMaybeNumber(value);
    } else if (key === "turfAccess"){
      s.constraints.turfAccess = String(value || "");
    } else if (key === "blackoutDates"){
      s.constraints.blackoutDates = String(value || "");
    } else if (key === "riskPosture"){
      s.riskPosture = String(value || "balanced");
    } else if (key === "nonNegotiables"){
      s.nonNegotiables = decisionBridgeLineList(value);
    } else if (key === "warRoomWatchItems"){
      warRoom.watchItems = decisionBridgeLineList(value);
    } else if (key === "warRoomDecisionItems"){
      warRoom.decisionItems = decisionBridgeLineList(value);
    } else if (key === "warRoomOwner"){
      warRoom.owner = String(value || "").trim();
    } else if (key === "warRoomFollowUpDate"){
      warRoom.followUpDate = String(value || "").trim();
    } else if (key === "warRoomDecisionSummary"){
      warRoom.decisionSummary = String(value || "");
    } else {
      return { ok: false, code: "unknown_field", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSelectOption(id){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const nextId = String(id || "").trim();
    if (!nextId || !s.options?.[nextId]){
      return { ok: false, code: "not_found", view: decisionBridgeStateView() };
    }
    s.activeOptionId = nextId;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeCreateOption(name){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const id = makeDecisionOptionId();
    const nextName = String(name || "").trim() || `Option ${Object.keys(s.options || {}).length + 1}`;
    s.options[id] = {
      id,
      label: nextName,
      createdAt: new Date().toISOString(),
      scenarioId: state.ui.activeScenarioId || SCENARIO_BASELINE_ID,
      tactics: { doors: false, phones: false, digital: false },
    };
    s.activeOptionId = id;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeRenameOption(name){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) {
      return { ok: false, code: "no_option", view: decisionBridgeStateView() };
    }
    const nextName = String(name || "").trim();
    if (!nextName) {
      return { ok: false, code: "invalid_name", view: decisionBridgeStateView() };
    }
    o.label = nextName;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeDeleteOption(){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const options = s.options || {};
    const ids = Object.keys(options);
    if (ids.length <= 1) {
      return { ok: false, code: "cannot_delete_last", view: decisionBridgeStateView() };
    }
    const o = getActiveDecisionOption(s);
    if (!o) {
      return { ok: false, code: "no_option", view: decisionBridgeStateView() };
    }
    delete options[o.id];
    const nextIds = Object.keys(options);
    s.activeOptionId = nextIds[0] || null;
    if (s.recommendedOptionId && !options[s.recommendedOptionId]){
      s.recommendedOptionId = null;
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeLinkOptionToActiveScenario(){
    ensureScenarioRegistry();
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) {
      return { ok: false, code: "no_option", view: decisionBridgeStateView() };
    }
    o.scenarioId = state.ui.activeScenarioId || SCENARIO_BASELINE_ID;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetOptionTactic(kind, enabled){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) {
      return { ok: false, code: "no_option", view: decisionBridgeStateView() };
    }
    ensureDecisionOptionShape(o);
    const key = String(kind || "").trim();
    if (!["doors", "phones", "digital"].includes(key)){
      return { ok: false, code: "unknown_tactic", view: decisionBridgeStateView() };
    }
    o.tactics[key] = !!enabled;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetRecommendedOption(id){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const nextId = String(id || "").trim();
    s.recommendedOptionId = nextId && s.options?.[nextId] ? nextId : null;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetWhatNeedsTrue(raw){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    s.whatNeedsTrue = decisionBridgeLineList(raw);
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeCaptureReviewBaseline(){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const warRoom = decisionBridgeNormalizeWarRoomSession(s);
    const diagnostics = decisionBridgeDiagnosticsSnapshot();
    warRoom.lastReview = decisionBridgeWarRoomCurrentBaseline(s, diagnostics);
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeLogDecision(){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const warRoom = decisionBridgeNormalizeWarRoomSession(s);
    const snap = decisionBridgeCurrentSnapshot();
    const change = snap?.warRoom?.change || buildWarRoomChangeClassificationView({
      previousBaseline: warRoom.lastReview || null,
      currentBaseline: decisionBridgeWarRoomCurrentBaseline(s, snap?.diagnostics || null),
    });
    const summary = String(warRoom.decisionSummary || "").trim()
      || `Decision checkpoint: ${String(snap?.recommendedOptionLabel || "No recommendation")}`;
  
    const row = {
      id: `wr_${uid()}${Date.now().toString(16)}`,
      recordedAt: new Date().toISOString(),
      scenarioId: state?.ui?.activeScenarioId || s?.scenarioId || SCENARIO_BASELINE_ID,
      classification: String(change?.classification || "noise"),
      significance: String(change?.significance || "low"),
      actionability: String(change?.actionability || "watch"),
      owner: String(warRoom.owner || "").trim(),
      followUpDate: String(warRoom.followUpDate || "").trim(),
      summary,
      status: "open",
      recommendationLabel: String(snap?.recommendedOptionLabel || "—"),
      topDrivers: Array.isArray(change?.topDrivers) ? change.topDrivers.slice(0, 6) : [],
      watchItems: Array.isArray(warRoom.watchItems) ? warRoom.watchItems.slice(0, 20) : [],
      decisionItems: Array.isArray(warRoom.decisionItems) ? warRoom.decisionItems.slice(0, 20) : [],
    };
  
    warRoom.decisionLog.unshift(row);
    if (warRoom.decisionLog.length > 120){
      warRoom.decisionLog.length = 120;
    }
    if (!warRoom.lastReview){
      warRoom.lastReview = decisionBridgeWarRoomCurrentBaseline(s, snap?.diagnostics || null);
    }
  
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetDecisionLogStatus(id, status){
    const s = getActiveDecisionSession();
    if (!s) {
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    ensureDecisionSessionShape(s);
    const warRoom = decisionBridgeNormalizeWarRoomSession(s);
    const rowId = String(id || "").trim();
    const nextStatus = String(status || "").trim().toLowerCase();
    const allowed = new Set(["open", "in_progress", "closed"]);
    if (!rowId || !allowed.has(nextStatus)){
      return { ok: false, code: "invalid_status_request", view: decisionBridgeStateView() };
    }
    const row = warRoom.decisionLog.find((entry) => String(entry?.id || "").trim() === rowId);
    if (!row){
      return { ok: false, code: "log_row_not_found", view: decisionBridgeStateView() };
    }
    row.status = nextStatus;
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetWeatherField(field, value){
    const warRoom = decisionBridgeEnsureWarRoomState();
    const weather = warRoom?.weather || {};
    const key = String(field || "").trim();
    if (key === "officeZip"){
      weather.officeZip = normalizeZip(value);
    } else if (key === "overrideZip"){
      weather.overrideZip = normalizeZip(value);
    } else if (key === "useOverrideZip"){
      weather.useOverrideZip = !!value;
    } else {
      return { ok: false, code: "unknown_weather_field", view: decisionBridgeStateView() };
    }
    weather.selectedZip = resolveSelectedZip(weather);
    if (!weather.selectedZip){
      weather.status = "idle";
      weather.error = "Select an office ZIP or override ZIP for weather context.";
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetWeatherMode(mode){
    const warRoom = decisionBridgeEnsureWarRoomState();
    const requestedMode = String(mode || "").trim().toLowerCase();
    if (requestedMode === WEATHER_MODE_TODAY_ONLY){
      const selectedZip = resolveSelectedZip(warRoom?.weather || {});
      if (!selectedZip){
        warRoom.weather.status = "error";
        warRoom.weather.error = "Select a ZIP before enabling today-only weather adjustment.";
        persist();
        refreshLegacyDecisionManagerIfMounted();
        return { ok: false, code: "missing_zip", view: decisionBridgeStateView() };
      }
    }
    applyWeatherModeToState(state, mode, { nowDate: new Date() });
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  async function decisionBridgeRefreshWeather(){
    const warRoom = decisionBridgeEnsureWarRoomState();
    const weather = warRoom?.weather || {};
    const selectedZip = resolveSelectedZip(weather);
    if (!selectedZip){
      weather.status = "error";
      weather.error = "Select a ZIP before refreshing weather.";
      persist();
      refreshLegacyDecisionManagerIfMounted();
      return { ok: false, code: "missing_zip", view: decisionBridgeStateView() };
    }
  
    weather.status = "loading";
    weather.error = "";
    refreshLegacyDecisionManagerIfMounted();
  
    try{
      const payload = await fetchWarRoomWeatherByZip(selectedZip);
      applyWeatherObservationToState(state, payload, { nowDate: new Date() });
      const mode = state?.warRoom?.weatherAdjustment?.mode || WEATHER_MODE_OBSERVE_ONLY;
      if (mode === WEATHER_MODE_TODAY_ONLY){
        applyWeatherModeToState(state, WEATHER_MODE_TODAY_ONLY, { nowDate: new Date() });
      }
      persist();
      refreshLegacyDecisionManagerIfMounted();
      return { ok: !!payload?.ok, code: payload?.ok ? "ok" : (payload?.code || "weather_error"), view: decisionBridgeStateView() };
    } catch (err){
      weather.status = "error";
      weather.error = err?.message ? String(err.message) : "Weather refresh failed.";
      persist();
      refreshLegacyDecisionManagerIfMounted();
      return { ok: false, code: "weather_exception", view: decisionBridgeStateView() };
    }
  }
  
  function decisionBridgeSetEventFilter(field, value){
    decisionBridgeEnsureWarRoomState();
    const out = setEventCalendarFilter(state, field, value, { nowDate: new Date() });
    if (!out?.ok){
      return { ok: false, code: out?.code || "event_filter_failed", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetEventDraftField(field, value){
    decisionBridgeEnsureWarRoomState();
    const out = setEventCalendarDraftField(state, field, value, { nowDate: new Date() });
    if (!out?.ok){
      return { ok: false, code: out?.code || "event_draft_field_failed", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSaveEventDraft(){
    decisionBridgeEnsureWarRoomState();
    const out = saveEventCalendarDraftAsEvent(state, {
      uidFn: uid,
      nowDate: new Date(),
    });
    if (!out?.ok){
      return {
        ok: false,
        code: out?.code || "event_save_failed",
        message: String(out?.message || ""),
        view: decisionBridgeStateView(),
      };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, code: "ok", message: "Event saved.", view: decisionBridgeStateView() };
  }
  
  function decisionBridgeLoadEventDraft(eventId){
    decisionBridgeEnsureWarRoomState();
    const out = loadEventCalendarDraft(state, eventId, { nowDate: new Date() });
    if (!out?.ok){
      return { ok: false, code: out?.code || "event_load_failed", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeClearEventDraft(){
    decisionBridgeEnsureWarRoomState();
    const out = clearEventCalendarDraft(state, { nowDate: new Date() });
    if (!out?.ok){
      return { ok: false, code: out?.code || "event_clear_draft_failed", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeDeleteEvent(eventId){
    decisionBridgeEnsureWarRoomState();
    const out = deleteEventCalendarRecord(state, eventId, { nowDate: new Date() });
    if (!out?.ok){
      return { ok: false, code: out?.code || "event_delete_failed", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetEventApplyToModel(eventId, enabled){
    decisionBridgeEnsureWarRoomState();
    const out = updateEventCalendarApplyToModel(state, eventId, enabled, { nowDate: new Date() });
    if (!out?.ok){
      return { ok: false, code: out?.code || "event_apply_toggle_failed", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function decisionBridgeSetEventStatus(eventId, status){
    decisionBridgeEnsureWarRoomState();
    const out = setEventCalendarStatus(state, eventId, status, { nowDate: new Date() });
    if (!out?.ok){
      return { ok: false, code: out?.code || "event_status_failed", view: decisionBridgeStateView() };
    }
    persist();
    refreshLegacyDecisionManagerIfMounted();
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  async function decisionBridgeCopySummary(kind = "markdown"){
    const s = getActiveDecisionSession();
    if (!s) {
      decisionBridgeCopyStatus = "No active session.";
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    const md = buildDecisionSummaryText(s);
    const mode = String(kind || "markdown").trim();
    const text = mode === "text" ? decisionSummaryPlainText(md) : md;
    const ok = await copyTextToClipboard(text);
    decisionBridgeCopyStatus = ok
      ? (mode === "text" ? "Copied summary (text)." : "Copied summary (markdown).")
      : "Copy failed.";
    return { ok, code: ok ? "ok" : "copy_failed", view: decisionBridgeStateView() };
  }
  
  function decisionBridgeDownloadSummaryJson(){
    const s = getActiveDecisionSession();
    if (!s) {
      decisionBridgeCopyStatus = "No active session.";
      return { ok: false, code: "no_session", view: decisionBridgeStateView() };
    }
    const obj = decisionSessionExportObject(s);
    if (!obj) {
      decisionBridgeCopyStatus = "Export failed.";
      return { ok: false, code: "export_failed", view: decisionBridgeStateView() };
    }
    const safe = String((s.name || s.id || "decision-session"))
      .toLowerCase()
      .replace(/[^a-z0-9\-\_]+/g, "-")
      .replace(/\-+/g, "-")
      .replace(/^\-+|\-+$/g, "");
    const filename = `${safe || "decision-session"}.json`;
    downloadJsonObject(obj, filename);
    decisionBridgeCopyStatus = "Downloaded session JSON.";
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  async function decisionBridgeRunSensitivitySnapshot(){
    const lastRenderCtx = getLastRenderCtx();
    const base = state.mcLast;
    if (!base){
      return { ok: false, code: "missing_base_mc", view: decisionBridgeStateView() };
    }
  
    const stale = (lastRenderCtx && lastRenderCtx.res)
      ? getMcStaleness({
          state,
          res: lastRenderCtx.res,
          weeks: lastRenderCtx.weeks,
          hashMcInputs,
          computeDailyLogHash,
        })
      : null;
    if (stale?.isStale){
      return {
        ok: false,
        code: "mc_stale",
        reason: stale.reasonText || "inputs changed",
        view: decisionBridgeStateView()
      };
    }
  
    const computed = computeDecisionSensitivityMiniSurfaceCache({
      state,
      lastRenderCtx,
      clampFn: clamp,
      runMonteCarloSim,
      resolveCanonicalDoorsPerHourFn: canonicalDoorsPerHourFromSnap,
      resolveCanonicalCallsPerHourFn: canonicalCallsPerHourFromSnap,
      setCanonicalDoorsPerHourFn: (target, value, options = {}) => setCanonicalDoorsPerHour(target, value, options),
      setCanonicalCallsPerHourFn: (target, value, options = {}) => setCanonicalCallsPerHour(target, value, options),
    });
    if (!computed.ok || !computed.cache){
      return { ok: false, code: computed.code || "failed", view: decisionBridgeStateView() };
    }
  
    if (!state.ui) state.ui = {};
    state.ui.e4Sensitivity = computed.cache;
    persist();
    if (hasLegacySensitivitySnapshotDom()){
      safeCall(() => { renderSensitivitySnapshotE4(); });
    }
    return { ok: true, view: decisionBridgeStateView() };
  }
  
  function installDecisionBridge(){
    const windowRef = getWindowRef();
    if (!windowRef){
      return;
    }
    windowRef[decisionBridgeKey] = {
      getView: () => decisionBridgeStateView(),
      selectSession: (id) => decisionBridgeSelectSession(id),
      createSession: (name) => decisionBridgeCreateSession(name),
      renameSession: (name) => decisionBridgeRenameSession(name),
      deleteSession: () => decisionBridgeDeleteSession(),
      linkSessionToActiveScenario: () => decisionBridgeLinkSessionToActiveScenario(),
      updateSessionField: (field, value) => decisionBridgeUpdateSessionField(field, value),
  
      selectOption: (id) => decisionBridgeSelectOption(id),
      createOption: (name) => decisionBridgeCreateOption(name),
      renameOption: (name) => decisionBridgeRenameOption(name),
      deleteOption: () => decisionBridgeDeleteOption(),
      linkOptionToActiveScenario: () => decisionBridgeLinkOptionToActiveScenario(),
      setOptionTactic: (kind, enabled) => decisionBridgeSetOptionTactic(kind, enabled),
  
      setRecommendedOption: (id) => decisionBridgeSetRecommendedOption(id),
      setWhatNeedsTrue: (raw) => decisionBridgeSetWhatNeedsTrue(raw),
      captureReviewBaseline: () => decisionBridgeCaptureReviewBaseline(),
      logDecision: () => decisionBridgeLogDecision(),
      setDecisionLogStatus: (id, status) => decisionBridgeSetDecisionLogStatus(id, status),
      setWeatherField: (field, value) => decisionBridgeSetWeatherField(field, value),
      setWeatherMode: (mode) => decisionBridgeSetWeatherMode(mode),
      refreshWeather: () => decisionBridgeRefreshWeather(),
      setEventFilter: (field, value) => decisionBridgeSetEventFilter(field, value),
      setEventDraftField: (field, value) => decisionBridgeSetEventDraftField(field, value),
      saveEventDraft: () => decisionBridgeSaveEventDraft(),
      loadEventDraft: (eventId) => decisionBridgeLoadEventDraft(eventId),
      clearEventDraft: () => decisionBridgeClearEventDraft(),
      deleteEvent: (eventId) => decisionBridgeDeleteEvent(eventId),
      setEventApplyToModel: (eventId, enabled) => decisionBridgeSetEventApplyToModel(eventId, enabled),
      setEventStatus: (eventId, status) => decisionBridgeSetEventStatus(eventId, status),
      copySummary: (kind) => decisionBridgeCopySummary(kind),
      downloadSummaryJson: () => decisionBridgeDownloadSummaryJson(),
      runSensitivitySnapshot: () => decisionBridgeRunSensitivitySnapshot(),
    };
  }
  
  // =========================
  // Phase D1 — Decision Session Scaffold (UI + state only)

  return {
    decisionBridgeParseMaybeNumber,
    decisionBridgeLineList,
    decisionBridgeNormalizeWarRoomSession,
    decisionBridgeEnsureWarRoomState,
    decisionBridgeWarRoomCurrentBaseline,
    decisionBridgeCurrentSnapshot,
    decisionBridgeDiagnosticsSnapshot,
    decisionBridgeStateView,
    decisionBridgeSelectSession,
    decisionBridgeCreateSession,
    decisionBridgeRenameSession,
    decisionBridgeDeleteSession,
    decisionBridgeLinkSessionToActiveScenario,
    decisionBridgeUpdateSessionField,
    decisionBridgeSelectOption,
    decisionBridgeCreateOption,
    decisionBridgeRenameOption,
    decisionBridgeDeleteOption,
    decisionBridgeLinkOptionToActiveScenario,
    decisionBridgeSetOptionTactic,
    decisionBridgeSetRecommendedOption,
    decisionBridgeSetWhatNeedsTrue,
    decisionBridgeCaptureReviewBaseline,
    decisionBridgeLogDecision,
    decisionBridgeSetDecisionLogStatus,
    decisionBridgeSetWeatherField,
    decisionBridgeSetWeatherMode,
    decisionBridgeRefreshWeather,
    decisionBridgeSetEventFilter,
    decisionBridgeSetEventDraftField,
    decisionBridgeSaveEventDraft,
    decisionBridgeLoadEventDraft,
    decisionBridgeClearEventDraft,
    decisionBridgeDeleteEvent,
    decisionBridgeSetEventApplyToModel,
    decisionBridgeSetEventStatus,
    decisionBridgeCopySummary,
    decisionBridgeDownloadSummaryJson,
    decisionBridgeRunSensitivitySnapshot,
    installDecisionBridge,
  };
}
