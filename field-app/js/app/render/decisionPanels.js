// @ts-check
import {
  buildDecisionDiagnosticsSnapshotView,
  buildDecisionIntelligencePanelView,
  DECISION_DIVERGENCE_KEY_ORDER,
} from "../../core/decisionView.js";

export function renderDecisionConfidencePanel({
  els,
  state,
  weeks,
  weeklyContext,
  executionSnapshot,
  clamp,
  ensureScenarioRegistry,
  SCENARIO_BASELINE_ID,
  fmtInt,
}){
  const confTagEl = els?.confTag;
  const confExecEl = els?.confExec;
  const confRiskEl = els?.confRisk;
  const confTightEl = els?.confTight;
  const confDivEl = els?.confDiv;
  const confBannerEl = els?.confBanner;

  const setTag = (cls, text) => {
    if (!confTagEl) return;
    confTagEl.classList.remove("ok","warn","bad");
    if (cls) confTagEl.classList.add(cls);
    confTagEl.textContent = text || "—";
  };

  const setBanner = (cls, text) => {
    if (!confBannerEl) return;
    confBannerEl.className = `banner ${cls || ""}`.trim();
    confBannerEl.textContent = text || "—";
  };

  ensureScenarioRegistry();
  const reg = state?.ui?.scenarios || {};
  const activeId = state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID;
  const diagnostics = buildDecisionDiagnosticsSnapshotView({
    executionSnapshot: executionSnapshot || null,
    weeklyContext: weeklyContext || null,
    mcResult: state?.mcLast || null,
    clampFn: clamp,
    bindingObj: state?.ui?.lastTlMeta?.bindingObj || null,
    primaryBottleneck: state?.ui?.lastDiagnostics?.primaryBottleneck || null,
    secondaryNotes: state?.ui?.lastDiagnostics?.secondaryNotes || null,
    sensitivityCache: state?.ui?.e4Sensitivity || null,
    baselineInputs: reg?.[SCENARIO_BASELINE_ID]?.inputs || null,
    activeInputs: reg?.[activeId]?.inputs || null,
    divergenceKeyOrder: DECISION_DIVERGENCE_KEY_ORDER,
    formatInt: fmtInt,
    weeksRemaining: weeks,
  });
  const drift = diagnostics.exec || {};
  const risk = diagnostics.risk || {};
  const confidence = diagnostics.confidence || {};

  if (confExecEl) confExecEl.textContent = drift.paceLabel || confidence.exec || "—";
  if (confRiskEl) confRiskEl.textContent = risk.tag || confidence.risk || "—";
  if (confTightEl) confTightEl.textContent = confidence.tight || diagnostics.bottleneck?.tag || "—";
  if (confDivEl) confDivEl.textContent = confidence.divergence || "—";
  setTag(confidence.cls || "", String(confidence.tag || "—"));
  setBanner(confidence.cls || "", confidence.banner || "—");
}

export function renderDecisionIntelligencePanelView({
  els,
  engine,
  res,
  weeks,
  getStateSnapshot,
  withPatchedState,
  computeElectionSnapshot,
  derivedWeeksRemaining,
  deriveNeedVotes,
  runMonteCarloSim,
  fmtInt
}){
  const diPrimaryEl = els?.diPrimary;
  const diSecondaryEl = els?.diSecondary;
  const diNotBindingEl = els?.diNotBinding;
  const diRecVolEl = els?.diRecVol;
  const diRecCostEl = els?.diRecCost;
  const diRecProbEl = els?.diRecProb;
  const diVolTbodyEl = els?.diVolTbody;
  const diCostTbodyEl = els?.diCostTbody;
  const diProbTbodyEl = els?.diProbTbody;
  const diWarnEl = els?.diWarn;

  const clearTable = (tbody) => { if (tbody) tbody.innerHTML = ""; };
  const stubRow = (tbody) => {
    if (!tbody) return;
    const tr = document.createElement("tr");
    const td0 = document.createElement("td"); td0.className = "muted"; td0.textContent = "—";
    const td1 = document.createElement("td"); td1.className = "num muted"; td1.textContent = "—";
    tr.appendChild(td0); tr.appendChild(td1);
    tbody.appendChild(tr);
  };

  const setWarn = (msg) => {
    if (!diWarnEl) return;
    if (!msg){
      diWarnEl.hidden = true;
      diWarnEl.textContent = "";
      return;
    }
    diWarnEl.hidden = false;
    diWarnEl.textContent = msg;
  };

  try{
    const snap = getStateSnapshot();

    const accessors = {
      getStateSnapshot,
      withPatchedState,
      computeElectionSnapshot,
      computeAll: (mi, options) => engine.computeAll(mi, options),
      derivedWeeksRemaining,
      deriveNeedVotes,
      runMonteCarloSim,
      computeRoiRows: engine.computeRoiRows,
      buildOptimizationTactics: engine.buildOptimizationTactics,
      computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
    };

    const di = engine.computeDecisionIntelligence({ engine: accessors, snap, baseline: { res, weeks } });

    const panelView = buildDecisionIntelligencePanelView(di, {
      formatInt: fmtInt,
    });
    setWarn(panelView.warning || null);

    if (diPrimaryEl) diPrimaryEl.textContent = panelView.primary;
    if (diSecondaryEl) diSecondaryEl.textContent = panelView.secondary;
    if (diNotBindingEl) diNotBindingEl.textContent = panelView.notBinding;

    if (diRecVolEl) diRecVolEl.textContent = panelView.recommendations.volunteers;
    if (diRecCostEl) diRecCostEl.textContent = panelView.recommendations.cost;
    if (diRecProbEl) diRecProbEl.textContent = panelView.recommendations.probability;

    const fill = (tbody, rows, fmt) => {
      clearTable(tbody);
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length){ stubRow(tbody); return; }
      for (const r of list){
        const tr = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = r?.lever || "—";
        const td1 = document.createElement("td");
        td1.className = "num";
        td1.textContent = fmt(r?.valueText);
        tr.appendChild(td0); tr.appendChild(td1);
        tbody.appendChild(tr);
      }
    };

    fill(diVolTbodyEl, panelView.rankings.volunteers, (valueText)=>valueText);
    fill(diCostTbodyEl, panelView.rankings.cost, (valueText)=>valueText);
    fill(diProbTbodyEl, panelView.rankings.probability, (valueText)=>valueText);

  } catch {
    setWarn("Decision Intelligence failed (panel render error).");
    if (diPrimaryEl) diPrimaryEl.textContent = "—";
    if (diSecondaryEl) diSecondaryEl.textContent = "—";
    if (diNotBindingEl) diNotBindingEl.textContent = "—";
    if (diRecVolEl) diRecVolEl.textContent = "—";
    if (diRecCostEl) diRecCostEl.textContent = "—";
    if (diRecProbEl) diRecProbEl.textContent = "—";
    clearTable(diVolTbodyEl); stubRow(diVolTbodyEl);
    clearTable(diCostTbodyEl); stubRow(diCostTbodyEl);
    clearTable(diProbTbodyEl); stubRow(diProbTbodyEl);
  }
}
