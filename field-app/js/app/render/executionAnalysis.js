// @ts-check
import { resolveFeatureFlags } from "../../core/featureFlags.js";
import {
  buildVolunteerConversionSnapshot,
} from "../../core/executionPlanner.js";
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorsPerHour,
  setCanonicalCallsPerHour,
  setCanonicalDoorsPerHour,
} from "../../core/throughput.js";
import {
  buildDecisionBottleneckImpactRowsView,
  buildDecisionConversionPanelView,
  buildDecisionSensitivityPanelView,
  computeDecisionSensitivityMiniSurfaceCache,
} from "../../core/decisionView.js";
import {
  computeTimelineConstraintInterventionDeltas,
  deriveOptimizationBindingSummary,
} from "../../core/optimize.js";
import { buildPlanNumberFormatters } from "../../core/planView.js";

export function renderBottleneckAttributionPanel({
  els,
  state,
  res,
  weeks,
  safeNum,
  fmtInt,
  clamp,
  engine,
  getEffectiveBaseRates,
  deriveNeedVotes
}){
  const bneckTagEl = els?.bneckTag;
  const bneckPrimaryEl = els?.bneckPrimary;
  const bneckSecondaryEl = els?.bneckSecondary;
  const bneckTbodyEl = els?.bneckTbody;
  const bneckWarnEl = els?.bneckWarn;
  const features = resolveFeatureFlags(state || {});
  const planNumber = buildPlanNumberFormatters(fmtInt);

  const clear = () => {
    if (bneckTbodyEl) bneckTbodyEl.innerHTML = "";
  };
  const stub = () => {
    clear();
    if (bneckTbodyEl){
      bneckTbodyEl.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="muted">—</td></tr>';
    }
  };

  const setWarn = (t) => {
    if (!bneckWarnEl) return;
    bneckWarnEl.textContent = t || "";
    bneckWarnEl.style.display = t ? "block" : "none";
  };

  const tlOn = !!state.budget?.optimize?.tlConstrainedEnabled;
  const timelineEnabled = !!features.timelineEnabled;
  if (!tlOn || !timelineEnabled){
    if (bneckTagEl){
      bneckTagEl.textContent = "—";
      bneckTagEl.classList.remove("ok","warn","bad");
    }
    if (bneckPrimaryEl) bneckPrimaryEl.textContent = state.ui?.lastDiagnostics?.primaryBottleneck || "—";
    if (bneckSecondaryEl) bneckSecondaryEl.textContent = state.ui?.lastDiagnostics?.secondaryNotes || "—";
    stub();
    setWarn("Enable Timeline-constrained optimization to compute constraint impacts.");
    return;
  }

  setWarn(null);

  const eff = getEffectiveBaseRates();
  const cr = eff.cr;
  const sr = eff.sr;
  const tr = eff.tr;

  const needVotes = deriveNeedVotes(res);

  const opt = state.budget?.optimize || {};
  const budget = state.budget || {};
  const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
  const includeOverhead = !!budget.includeOverhead;
  const baseBudget = safeNum(opt.budgetAmount) ?? 0;
  const attribution = computeTimelineConstraintInterventionDeltas({
    state,
    weeksRemaining: weeks,
    needObjectiveValue: needVotes,
    budgetAmount: baseBudget,
    includeOverhead,
    overheadAmount,
    optimizeConfig: opt,
    baseRates: { cr, sr, tr },
    tacticsRaw: budget.tactics || {},
    buildOptimizationTactics: (input) => engine.buildOptimizationTactics(input),
    computeMaxAttemptsByTactic: (input) => engine.computeMaxAttemptsByTactic(input),
    optimizeTimelineConstrained: (input) => engine.optimizeTimelineConstrained(input),
    clampFn: clamp,
  });

  const ps = deriveOptimizationBindingSummary({
    bindingObj: attribution?.base?.bindingObj || state.ui?.lastTlMeta?.bindingObj || {},
    allocation: state.ui?.lastOpt?.allocation || {},
    maxAttemptsByTactic: attribution?.base?.maxAttemptsByTactic || null,
  });
  if (bneckPrimaryEl) bneckPrimaryEl.textContent = ps.primary;
  if (bneckSecondaryEl) bneckSecondaryEl.textContent = ps.secondary;

  const bindingObj = attribution?.base?.bindingObj || state.ui?.lastTlMeta?.bindingObj || {};
  const badgeCls = (bindingObj?.budget || bindingObj?.capacity || (Array.isArray(bindingObj?.timeline) && bindingObj.timeline.length)) ? "warn" : "ok";
  if (bneckTagEl){
    bneckTagEl.textContent = badgeCls === "ok" ? "Clear" : "Binding";
    bneckTagEl.classList.remove("ok","warn","bad");
    bneckTagEl.classList.add(badgeCls);
  }

  const buildRow = (name, deltaText, notes) => {
    const trEl = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = name;
    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = deltaText || "—";
    const td2 = document.createElement("td");
    td2.className = "muted";
    td2.textContent = notes || "—";
    trEl.appendChild(td0); trEl.appendChild(td1); trEl.appendChild(td2);
    return trEl;
  };
  const rowViews = buildDecisionBottleneckImpactRowsView(attribution?.rows || [], {
    formatInt: planNumber.formatIntRound,
  });

  clear();
  if (bneckTbodyEl){
    for (const row of rowViews){
      bneckTbodyEl.appendChild(buildRow(row.intervention, row.deltaText, row.notes));
    }
    if (!rowViews.length){
      bneckTbodyEl.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="muted">—</td></tr>';
    }
  }
}

export function renderConversionPanel({
  els,
  state,
  res,
  weeks,
  deriveNeedVotes,
  safeNum,
  fmtInt,
  getEffectiveBaseRates,
  setText,
  renderPhase3
}){
  const outConversationsNeededEl = els?.outConversationsNeeded;
  const outDoorsNeededEl = els?.outDoorsNeeded;
  const outDoorsPerShiftEl = els?.outDoorsPerShift;
  const outTotalShiftsEl = els?.outTotalShifts;
  const outShiftsPerWeekEl = els?.outShiftsPerWeek;
  const outVolunteersNeededEl = els?.outVolunteersNeeded;
  const convFeasBannerEl = els?.convFeasBanner;
  const planNumber = buildPlanNumberFormatters(fmtInt);

  const needVotes = (typeof deriveNeedVotes === "function")
    ? deriveNeedVotes(res, state?.goalSupportIds)
    : null;
  const goal = (needVotes != null && needVotes > 0) ? needVotes : 0;

  const eff = getEffectiveBaseRates();
  const sr = eff.sr;
  const cr = eff.cr;

  const dph = resolveCanonicalDoorsPerHour(state);
  const conversionSnapshot = buildVolunteerConversionSnapshot({
    goalVotes: goal,
    supportRate: sr,
    contactRate: cr,
    doorsPerHour: dph,
    hoursPerShift: safeNum(state.hoursPerShift),
    shiftsPerVolunteerPerWeek: safeNum(state.shiftsPerVolunteerPerWeek),
    weeks,
    formatWhole: planNumber.formatWhole,
  });
  const conversionView = buildDecisionConversionPanelView(conversionSnapshot, {
    formatInt: planNumber.formatIntRound,
  });
  setText(outConversationsNeededEl, conversionView.conversationsNeededText);
  setText(outDoorsNeededEl, conversionView.doorsNeededText);
  setText(outDoorsPerShiftEl, conversionView.doorsPerShiftText);
  setText(outTotalShiftsEl, conversionView.totalShiftsText);
  setText(outShiftsPerWeekEl, conversionView.shiftsPerWeekText);
  setText(outVolunteersNeededEl, conversionView.volunteersNeededText);

  const feasibility = conversionView.feasibility;

  if (convFeasBannerEl){
    convFeasBannerEl.hidden = !feasibility.shown;
    convFeasBannerEl.className = `banner ${feasibility.kind}`.trim();
    convFeasBannerEl.textContent = feasibility.text;
  }

  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  state.ui.lastConversion = {
    ...conversionSnapshot,
    feasibility: {
      kind: feasibility.kind || "",
      text: feasibility.text || "",
      shown: !!feasibility.shown,
    },
  };

  renderPhase3(res, weeks);
}

export function renderSensitivitySnapshotPanel({ els, state, mcStaleness = null }){
  const sensTagEl = els?.sensTag;
  const sensTbodyEl = els?.sensTbody;
  const sensBannerEl = els?.sensBanner;
  const btnSensRunEl = els?.btnSensRun;

  const stub = (msg, cls) => {
    if (sensTbodyEl) {
      sensTbodyEl.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td></tr>';
    }
    if (sensTagEl) {
      sensTagEl.textContent = "—";
      sensTagEl.classList.remove("ok","warn","bad");
    }
    if (sensBannerEl) {
      sensBannerEl.className = `banner ${cls || ""}`.trim();
      sensBannerEl.textContent = msg || "—";
    }
  };

  const cache = state?.ui?.e4Sensitivity;
  const cacheForView = (cache && cache.baseHash === state?.mcLastHash) ? cache : null;
  const panelView = buildDecisionSensitivityPanelView({
    mcResult: state?.mcLast || null,
    sensitivityCache: cacheForView,
    mcStaleness: mcStaleness || null,
  });
  if (btnSensRunEl) btnSensRunEl.disabled = !!panelView.runDisabled;

  if (!Array.isArray(panelView.rows) || !panelView.rows.length){
    stub(panelView.banner, panelView.cls);
    return;
  }

  if (sensTbodyEl) {
    sensTbodyEl.innerHTML = "";
    for (const r of panelView.rows){
      const tr = document.createElement("tr");
      const td0 = document.createElement("td"); td0.textContent = r.label || "—";
      const td1 = document.createElement("td"); td1.className = "num"; td1.textContent = r.dWin || "—";
      const td2 = document.createElement("td"); td2.className = "num"; td2.textContent = r.dP50 || "—";
      const td3 = document.createElement("td"); td3.className = "muted"; td3.textContent = r.note || "";
      tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      sensTbodyEl.appendChild(tr);
    }
  }

  if (sensTagEl) {
    sensTagEl.textContent = panelView.tag || "Snapshot";
    sensTagEl.classList.remove("ok","warn","bad");
    if (panelView.cls) sensTagEl.classList.add(panelView.cls);
  }

  if (sensBannerEl) {
    sensBannerEl.className = `banner ${panelView.cls || ""}`.trim();
    sensBannerEl.textContent = panelView.banner || "—";
  }
}

export function computeSensitivitySnapshotCache({
  state,
  lastRenderCtx,
  clamp,
  runMonteCarloSim,
  runs = 2000,
}){
  return computeDecisionSensitivityMiniSurfaceCache({
    state,
    lastRenderCtx,
    clampFn: clamp,
    runMonteCarloSim,
    runs,
    resolveCanonicalDoorsPerHourFn: resolveCanonicalDoorsPerHour,
    resolveCanonicalCallsPerHourFn: resolveCanonicalCallsPerHour,
    setCanonicalDoorsPerHourFn: (target, value, options = {}) => setCanonicalDoorsPerHour(target, value, options),
    setCanonicalCallsPerHourFn: (target, value, options = {}) => setCanonicalCallsPerHour(target, value, options),
  });
}

export async function runSensitivitySnapshotPanel({
  els,
  state,
  lastRenderCtx,
  clamp,
  runMonteCarloSim,
  persist,
  renderSensitivitySnapshotE4,
  getMcStaleness
}){
  const btnSensRunEl = els?.btnSensRun;
  const sensBannerEl = els?.sensBanner;

  const base = state.mcLast;
  if (!base) return;

  const stale = (typeof getMcStaleness === "function") ? getMcStaleness() : null;
  if (stale?.isStale){
    const reason = stale.reasonText || "inputs changed";
    if (sensBannerEl){
      sensBannerEl.className = "banner warn";
      sensBannerEl.textContent = `Monte Carlo is stale (${reason}). Re-run MC, then run snapshot.`;
    }
    if (btnSensRunEl) btnSensRunEl.disabled = true;
    return;
  }

  const ctx = lastRenderCtx;
  if (!ctx || !ctx.res) return;

  const setBusy = (on) => {
    if (!btnSensRunEl) return;
    btnSensRunEl.disabled = !!on;
    btnSensRunEl.textContent = on ? "Running…" : "Run snapshot";
  };

  setBusy(true);
  try{
    const computed = computeSensitivitySnapshotCache({
      state,
      lastRenderCtx: ctx,
      clamp,
      runMonteCarloSim,
    });
    if (!computed.ok || !computed.cache){
      return;
    }
    if (!state.ui) state.ui = {};
    state.ui.e4Sensitivity = computed.cache;
    persist();
    renderSensitivitySnapshotE4();
  } finally {
    setBusy(false);
  }
}
