// @ts-check
export function renderScenarioManagerPanel({
  els,
  state,
  ensureScenarioRegistry,
  listScenarioRecords,
  SCENARIO_BASELINE_ID,
  SCENARIO_MAX,
  setScenarioWarn,
  renderScenarioComparison,
}){
  ensureScenarioRegistry();

  const reg = state.ui.scenarios;
  const activeId = state.ui.activeScenarioId;
  const selectedId = state.ui.scenarioUiSelectedId;

  if (els.activeScenarioLabel){
    const active = reg[activeId];
    els.activeScenarioLabel.textContent = `Active Scenario: ${active ? (active.name || active.id) : "—"}`;
  }

  if (els.scenarioSelect){
    const list = listScenarioRecords();
    els.scenarioSelect.innerHTML = "";
    for (const s of list){
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      els.scenarioSelect.appendChild(opt);
    }
    els.scenarioSelect.value = reg[selectedId] ? selectedId : activeId;
  }

  if (els.btnScenarioDelete){
    const canDel = selectedId && selectedId !== SCENARIO_BASELINE_ID && !!reg[selectedId];
    els.btnScenarioDelete.disabled = !canDel;
  }

  if (els.btnScenarioLoadSelected){
    const canLoad = selectedId && !!reg[selectedId] && selectedId !== activeId;
    els.btnScenarioLoadSelected.disabled = !canLoad;
  }

  if (els.btnScenarioReturnBaseline){
    els.btnScenarioReturnBaseline.disabled = (activeId === SCENARIO_BASELINE_ID);
  }

  const count = Object.keys(reg).length;
  if (count > SCENARIO_MAX){
    setScenarioWarn(`Scenario limit exceeded (${count}/${SCENARIO_MAX}). Delete scenarios to stay under the cap.`);
  } else {
    setScenarioWarn(null);
  }

  renderScenarioComparison();
}
