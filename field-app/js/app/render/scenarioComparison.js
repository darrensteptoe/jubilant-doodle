// @ts-check
import {
  buildLegacyScenarioComparisonKeyOutput,
  buildLegacyScenarioInputDiffSummary,
  buildLegacyScenarioOutputDiffRows,
  deriveLegacyScenarioCompareTag,
} from "../../core/scenarioView.js";

export function renderScenarioComparisonPanel({
  els,
  state,
  ensureScenarioRegistry,
  SCENARIO_BASELINE_ID,
  scenarioClone,
  scenarioInputsFromState,
  computeDecisionKeyOutCore,
  computeElectionSnapshot,
  engine,
  derivedWeeksRemaining,
  computeWeeklyOpsContextFromSnap,
  targetFinishDateFromSnap,
  computeLastNLogSums,
  paceFinishDate,
  safeNum,
  fmtInt,
  fmtISODate
}){
  const scmCompareWrapEl = els?.scmCompareWrap;
  const scmCompareTagEl = els?.scmCompareTag;
  const scmCompareEmptyEl = els?.scmCompareEmpty;
  const scmCompareGridEl = els?.scmCompareGrid;
  const scmDiffInputsEl = els?.scmDiffInputs;
  const scmDiffOutputsEl = els?.scmDiffOutputs;
  const scmDiffInputsFootEl = els?.scmDiffInputsFoot;
  if (!scmCompareWrapEl && !scmCompareTagEl && !scmCompareEmptyEl && !scmCompareGridEl && !scmDiffInputsEl && !scmDiffOutputsEl) return;
  if (typeof ensureScenarioRegistry === "function") ensureScenarioRegistry();

  const ui = state?.ui || {};
  const reg = ui.scenarios || {};
  const activeId = ui.activeScenarioId;
  const baseRec = reg?.[SCENARIO_BASELINE_ID] || null;
  const activeRec = reg?.[activeId] || null;

  const isDiff = !!(baseRec && activeRec && activeId !== SCENARIO_BASELINE_ID);

  if (scmCompareEmptyEl) scmCompareEmptyEl.hidden = isDiff;
  if (scmCompareGridEl) scmCompareGridEl.hidden = !isDiff;

  const setCompareTag = (kind, text) => {
    if (!scmCompareTagEl) return;
    scmCompareTagEl.classList.remove("ok","warn","bad");
    if (kind) scmCompareTagEl.classList.add(kind);
    scmCompareTagEl.textContent = text || "—";
  };

  if (!isDiff){
    setCompareTag(null, "—");
    if (scmDiffInputsEl) scmDiffInputsEl.innerHTML = "";
    if (scmDiffOutputsEl) scmDiffOutputsEl.innerHTML = "";
    if (scmDiffInputsFootEl) scmDiffInputsFootEl.textContent = "";
    return;
  }

  const baseInputs = scenarioClone(baseRec.inputs || {});
  const actInputs = scenarioInputsFromState(state);
  const inputDiff = buildLegacyScenarioInputDiffSummary({
    baselineInputs: baseInputs,
    activeInputs: actInputs,
    maxShow: 12,
  });

  if (scmDiffInputsEl){
    scmDiffInputsEl.innerHTML = "";
    for (const item of inputDiff.items){
      const li = document.createElement("li");
      li.className = "diff-item";
      const head = document.createElement("div");
      head.className = "diff-k";
      head.textContent = item.label;
      const line = document.createElement("div");
      line.className = "diff-v";
      line.textContent = item.text;
      li.appendChild(head);
      li.appendChild(line);
      scmDiffInputsEl.appendChild(li);
    }
    if (scmDiffInputsFootEl){
      scmDiffInputsFootEl.textContent = inputDiff.remainingCount > 0
        ? `${inputDiff.remainingCount} more changed input(s) not shown.`
        : "";
    }
  }

  const computeKeyOut = (inputs) => {
    const core = computeDecisionKeyOutCore(inputs, {
      scenarioClone,
      engine,
      derivedWeeksRemaining,
      computeElectionSnapshot,
      computeWeeklyOpsContextFromSnap,
      targetFinishDateFromSnap,
      safeNum,
    });
    return buildLegacyScenarioComparisonKeyOutput({
      coreOutput: core,
      lastLogSummary: computeLastNLogSums(7),
      paceFinishDateFn: paceFinishDate,
    });
  };

  const baseOut = computeKeyOut(baseInputs);
  const actOut = computeKeyOut(actInputs);

  const outputDiff = buildLegacyScenarioOutputDiffRows({
    baseline: baseOut,
    active: actOut,
    formatInt: fmtInt,
    formatDate: fmtISODate,
  });

  if (scmDiffOutputsEl){
    scmDiffOutputsEl.innerHTML = "";
    for (const row of outputDiff.rows){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.label}</td>
        <td class="num">${row.baselineText}</td>
        <td class="num">${row.activeText}</td>
        <td class="num"><span class="delta ${row.kind || ""}">${row.deltaText}</span></td>
      `;
      scmDiffOutputsEl.appendChild(tr);
    }
  }

  const compareTag = deriveLegacyScenarioCompareTag({
    totalChanged: inputDiff.totalChanged,
    attemptsDelta: outputDiff.attemptsDelta,
  });
  setCompareTag(compareTag.kind, compareTag.text);
}
