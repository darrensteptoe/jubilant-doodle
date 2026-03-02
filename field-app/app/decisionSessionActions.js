export function createDecisionSessionActions(ctx){
  const {
    els,
    stateRef,
    ensureDecisionScaffold,
    makeDecisionSessionId,
    makeDecisionOptionId,
    OBJECTIVE_TEMPLATES,
    SCENARIO_BASELINE_ID,
    getActiveDecisionSession,
    ensureDecisionSessionShape,
    getActiveDecisionOption,
    ensureDecisionOptionShape,
    ensureScenarioRegistry,
    persist,
    renderDecisionSessionD1,
  } = ctx || {};

  const state = () => stateRef?.();

  const createNewDecisionSession = () => {
    ensureDecisionScaffold();
    const s = state();
    const sessions = s.ui.decision.sessions;
    const id = makeDecisionSessionId();
    const n = Object.keys(sessions).length + 1;
    sessions[id] = {
      id,
      name: `Session ${n}`,
      createdAt: new Date().toISOString(),
      scenarioId: s.ui.activeScenarioId || SCENARIO_BASELINE_ID,
      objectiveKey: OBJECTIVE_TEMPLATES[0].key,
      notes: "",
      constraints: { budget: null, volunteerHrs: null, turfAccess: "", blackoutDates: "" },
      riskPosture: "balanced",
      nonNegotiables: [],
      options: {},
      activeOptionId: null,
    };
    s.ui.decision.activeSessionId = id;
    persist();
    renderDecisionSessionD1();
  };

  const renameActiveDecisionSession = () => {
    const s = getActiveDecisionSession();
    if (!s || !els?.decisionRename) return;
    const nm = String(els.decisionRename.value || "").trim();
    if (!nm) return;
    s.name = nm;
    persist();
    renderDecisionSessionD1();
  };

  const deleteActiveDecisionSession = () => {
    ensureDecisionScaffold();
    const root = state();
    const sessions = root.ui.decision.sessions;
    const ids = Object.keys(sessions);
    if (ids.length <= 1) return;
    const cur = root.ui.decision.activeSessionId;
    const s = sessions[cur];
    const nm = s ? (s.name || s.id) : "this session";
    const ok = confirm(`Delete "${nm}"?`);
    if (!ok) return;
    delete sessions[cur];
    const nextIds = Object.keys(sessions);
    root.ui.decision.activeSessionId = nextIds[0] || null;
    persist();
    renderDecisionSessionD1();
  };

  const linkDecisionSessionToActiveScenario = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    const root = state();
    ensureScenarioRegistry();
    s.scenarioId = root.ui.activeScenarioId || SCENARIO_BASELINE_ID;
    persist();
    renderDecisionSessionD1();
  };

  const createNewDecisionOption = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    const root = state();
    ensureDecisionSessionShape(s);

    const id = makeDecisionOptionId();
    const n = Object.keys(s.options || {}).length + 1;
    s.options[id] = {
      id,
      label: `Option ${n}`,
      createdAt: new Date().toISOString(),
      scenarioId: root.ui.activeScenarioId || SCENARIO_BASELINE_ID,
      tactics: { doors: false, phones: false, digital: false },
    };
    s.activeOptionId = id;
    persist();
    renderDecisionSessionD1();
  };

  const renameActiveDecisionOption = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o || !els?.decisionOptionRename) return;
    const nm = String(els.decisionOptionRename.value || "").trim();
    if (!nm) return;
    o.label = nm;
    persist();
    renderDecisionSessionD1();
  };

  const deleteActiveDecisionOption = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    ensureDecisionSessionShape(s);
    const options = s.options || {};
    const ids = Object.keys(options);
    if (ids.length <= 1) return;

    const o = getActiveDecisionOption(s);
    if (!o) return;
    const nm = o.label || o.id;
    const ok = confirm(`Delete "${nm}"?`);
    if (!ok) return;

    delete options[o.id];
    const nextIds = Object.keys(options);
    s.activeOptionId = nextIds[0] || null;
    persist();
    renderDecisionSessionD1();
  };

  const linkDecisionOptionToActiveScenario = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    const root = state();
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) return;
    ensureScenarioRegistry();
    o.scenarioId = root.ui.activeScenarioId || SCENARIO_BASELINE_ID;
    persist();
    renderDecisionSessionD1();
  };

  return {
    createNewDecisionSession,
    renameActiveDecisionSession,
    deleteActiveDecisionSession,
    linkDecisionSessionToActiveScenario,
    createNewDecisionOption,
    renameActiveDecisionOption,
    deleteActiveDecisionOption,
    linkDecisionOptionToActiveScenario,
  };
}
