// @ts-check
/** @param {import("./types").ScenarioManagerBindingsCtx} ctx */
export function wireScenarioManagerBindings(ctx){
  const {
    els,
    getState,
    replaceState,
    ensureScenarioRegistry,
    SCENARIO_BASELINE_ID,
    SCENARIO_MAX,
    setScenarioWarn,
    uid,
    scenarioClone,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    persist,
    renderScenarioManagerC1,
    markMcStale,
    applyStateToUI,
    render,
    safeCall,
    renderDecisionSessionD1,
  } = ctx || {};

  if (!els || typeof getState !== "function" || typeof replaceState !== "function") return;
  const hasLegacyScenarioUi = !!(
    els.activeScenarioLabel ||
    els.scenarioSelect ||
    els.scenarioNewName ||
    els.btnScenarioSaveNew ||
    els.btnScenarioCloneBaseline ||
    els.btnScenarioLoadSelected ||
    els.btnScenarioReturnBaseline ||
    els.btnScenarioDelete ||
    els.scWarn ||
    els.scenarioStorageNote ||
    els.scmDiffInputs ||
    els.scmDiffOutputs
  );
  if (!hasLegacyScenarioUi) return;

  const createScenarioRecord = ({ name, fromInputs, fromOutputs }) => {
    const state = getState();
    const id = "scn_" + uid() + Date.now().toString(16);
    const nm = (name || "").trim() || `Scenario ${Object.keys(state?.ui?.scenarios || {}).length}`;
    return {
      id,
      name: nm,
      inputs: scenarioClone(fromInputs || {}),
      outputs: scenarioClone(fromOutputs || {}),
      createdAt: new Date().toISOString()
    };
  };

  const loadScenarioById = (id) => {
    ensureScenarioRegistry();
    const state = getState();
    const reg = state?.ui?.scenarios;
    const rec = reg?.[id];
    if (!rec) return;

    const uiKeep = state.ui || {};
    const next = scenarioClone(rec.inputs || {});
    next.ui = uiKeep;
    replaceState(next);

    ensureScenarioRegistry();
    const cur = getState();
    cur.ui.activeScenarioId = id;
    cur.ui.scenarioUiSelectedId = id;

    markMcStale();
    applyStateToUI();
    persist();
    render();
    renderScenarioManagerC1();
    safeCall(() => { renderDecisionSessionD1(); });
  };

  const onScenarioSaveNew = () => {
    ensureScenarioRegistry();
    const state = getState();
    const reg = state.ui.scenarios;
    const count = Object.keys(reg).length;
    if (count >= SCENARIO_MAX){
      setScenarioWarn(`Max scenarios reached (${SCENARIO_MAX}). Delete one to save a new scenario.`);
      return;
    }

    const nm = els.scenarioNewName ? els.scenarioNewName.value : "";
    const rec = createScenarioRecord({
      name: nm,
      fromInputs: scenarioInputsFromState(state),
      fromOutputs: scenarioOutputsFromState(state)
    });
    reg[rec.id] = rec;
    state.ui.scenarioUiSelectedId = rec.id;
    if (els.scenarioNewName) els.scenarioNewName.value = "";
    persist();
    renderScenarioManagerC1();
  };

  const onScenarioCloneBaseline = () => {
    ensureScenarioRegistry();
    const state = getState();
    const reg = state.ui.scenarios;
    const count = Object.keys(reg).length;
    if (count >= SCENARIO_MAX){
      setScenarioWarn(`Max scenarios reached (${SCENARIO_MAX}). Delete one to clone baseline.`);
      return;
    }

    const base = reg[SCENARIO_BASELINE_ID];
    const nm = els.scenarioNewName ? els.scenarioNewName.value : "";
    const rec = createScenarioRecord({
      name: nm || "Baseline clone",
      fromInputs: base?.inputs || {},
      fromOutputs: base?.outputs || {}
    });
    reg[rec.id] = rec;
    state.ui.scenarioUiSelectedId = rec.id;
    if (els.scenarioNewName) els.scenarioNewName.value = "";
    persist();
    renderScenarioManagerC1();
  };

  const onScenarioDeleteSelected = () => {
    ensureScenarioRegistry();
    const state = getState();
    const id = state.ui.scenarioUiSelectedId;
    if (!id || id === SCENARIO_BASELINE_ID) return;
    const ok = confirm("Delete this scenario?");
    if (!ok) return;

    delete state.ui.scenarios[id];
    state.ui.scenarioUiSelectedId = SCENARIO_BASELINE_ID;
    persist();
    renderScenarioManagerC1();
  };

  const onScenarioLoadSelected = () => {
    ensureScenarioRegistry();
    const state = getState();
    const id = state.ui.scenarioUiSelectedId;
    const reg = state.ui.scenarios;
    const rec = reg?.[id];
    if (!rec) return;
    if (id === state.ui.activeScenarioId) return;

    const nm = String(rec?.name || rec?.id || "scenario");
    const ok = confirm(`Load scenario "${nm}"? This will replace current inputs.`);
    if (!ok) return;
    loadScenarioById(id);
  };

  const onScenarioReturnBaseline = () => {
    ensureScenarioRegistry();
    const state = getState();
    const reg = state.ui.scenarios;
    const rec = reg?.[SCENARIO_BASELINE_ID];
    if (!rec) return;
    if (state.ui.activeScenarioId === SCENARIO_BASELINE_ID) return;

    const ok = confirm("Return to baseline? This will replace current inputs.");
    if (!ok) return;
    loadScenarioById(SCENARIO_BASELINE_ID);
  };

  if (els.scenarioSelect){
    els.scenarioSelect.addEventListener("change", () => {
      ensureScenarioRegistry();
      const state = getState();
      const id = els.scenarioSelect.value;
      if (id && state.ui.scenarios[id]){
        state.ui.scenarioUiSelectedId = id;
        persist();
        renderScenarioManagerC1();
      }
    });
  }

  if (els.btnScenarioSaveNew) els.btnScenarioSaveNew.addEventListener("click", onScenarioSaveNew);
  if (els.btnScenarioCloneBaseline) els.btnScenarioCloneBaseline.addEventListener("click", onScenarioCloneBaseline);
  if (els.btnScenarioLoadSelected) els.btnScenarioLoadSelected.addEventListener("click", onScenarioLoadSelected);
  if (els.btnScenarioReturnBaseline) els.btnScenarioReturnBaseline.addEventListener("click", onScenarioReturnBaseline);
  if (els.btnScenarioDelete) els.btnScenarioDelete.addEventListener("click", onScenarioDeleteSelected);

  renderScenarioManagerC1();
}
