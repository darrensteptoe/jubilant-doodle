export function ensureScenarioRegistryCore(state, {
  scenarioBaselineId,
  scenarioInputsFromState,
  scenarioOutputsFromState,
}){
  if (!state) return;
  if (!state.ui) state.ui = {};
  if (!state.ui.scenarios || typeof state.ui.scenarios !== "object") state.ui.scenarios = {};
  if (!state.ui.activeScenarioId || typeof state.ui.activeScenarioId !== "string") state.ui.activeScenarioId = scenarioBaselineId;
  if (!state.ui.scenarioUiSelectedId || typeof state.ui.scenarioUiSelectedId !== "string") state.ui.scenarioUiSelectedId = state.ui.activeScenarioId;

  const reg = state.ui.scenarios;
  if (!reg[scenarioBaselineId]){
    reg[scenarioBaselineId] = {
      id: scenarioBaselineId,
      name: "Baseline",
      inputs: scenarioInputsFromState(state),
      outputs: scenarioOutputsFromState(state),
      createdAt: new Date().toISOString()
    };
  }

  if (!reg[state.ui.activeScenarioId]) state.ui.activeScenarioId = scenarioBaselineId;
  if (!reg[state.ui.scenarioUiSelectedId]) state.ui.scenarioUiSelectedId = state.ui.activeScenarioId;
}

export function listScenarioRecordsCore(state, {
  scenarioBaselineId,
}){
  const reg = state?.ui?.scenarios || {};
  const all = Object.values(reg);
  const baseline = all.find((s) => s && s.id === scenarioBaselineId) || null;
  const rest = all.filter((s) => s && s.id !== scenarioBaselineId);
  rest.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  return baseline ? [baseline, ...rest] : rest;
}
