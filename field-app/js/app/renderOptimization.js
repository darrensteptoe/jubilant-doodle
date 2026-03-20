// @ts-check
import { resolveFeatureFlags } from "../core/featureFlags.js";
import { getTimelineObjectiveMeta } from "../core/timelineOptimizer.js";
import {
  buildTimelineConstrainedOptimizationInput,
  buildOfficeOptimizationSummary,
  buildOptimizationExecutionView,
  buildOptimizationExecutionSummary as buildCanonicalOptimizationExecutionSummary,
  buildOptimizationLastSummarySnapshot,
  resolveOptimizationBudgetAvailable,
  resolveOptimizationCapacityLimit,
  resolveOptimizationFeasible,
} from "../core/optimize.js";
import {
  getOptimizationObjectiveLabel,
  normalizeOptimizationObjective,
} from "../core/turnout.js";
import {
  buildTimelineTacticKindsMapFromState,
  computeTimelineCapsSummaryFromState,
} from "../core/timelineCapsInput.js";
import {
  buildPlanNumberFormatters,
  buildPlanMarginalDiagnosticsRowsView,
  buildPlanOptimizerAllocationRowsView,
  buildPlanOptimizerTotalsView,
  derivePlanBindingText,
  formatPlanGoalFeasible,
  normalizePlanOptimizerRows,
} from "../core/planView.js";
import { roundWholeNumberByMode } from "../core/utils.js";

export function renderOptimizationModule(args){
  const {
    els,
    state,
    res,
    weeks,
    deriveNeedVotes,
    fmtInt,
    compileEffectiveInputs,
    computeCapacityBreakdown,
    safeNum,
    engine,
  } = args || {};

  const features = resolveFeatureFlags(state || {});
  const optTbody = els?.optTbody instanceof HTMLElement ? els.optTbody : null;
  const clearPlanCaches = () => {
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.lastPlanRows = [];
    state.ui.lastPlanMeta = null;
    state.ui.lastSummary = {
      objective: normalizeOptimizationObjective(state?.budget?.optimize?.objective, "net"),
      objectiveValue: 0,
      netVotes: 0,
      cost: 0,
      feasible: null,
      primaryBottleneck: null,
      topAllocations: [],
      upliftSummary: null,
    };
  };
  const planNumber = buildPlanNumberFormatters(fmtInt);

  const needVotes = deriveNeedVotes(res);
  if (els.optGapContext) els.optGapContext.textContent = planNumber.formatWhole(needVotes);

  const effective = compileEffectiveInputs(state);
  const cr = effective.rates.cr;
  const sr = effective.rates.sr;
  const tr = effective.rates.tr;

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  const capBreakdown = computeCapacityBreakdown({
    weeks: w,
    orgCount: effective.capacity.orgCount,
    orgHoursPerWeek: effective.capacity.orgHoursPerWeek,
    volunteerMult: effective.capacity.volunteerMult,
    doorShare: effective.capacity.doorShare,
    doorsPerHour: effective.capacity.doorsPerHour,
    callsPerHour: effective.capacity.callsPerHour,
    capacityDecay: effective.capacity.capacityDecay,
  });
  const capAttempts = capBreakdown?.total ?? null;

  const budget = state.budget || {};
  const tacticsRaw = budget.tactics || {};
  const opt = budget.optimize || { mode: "budget", budgetAmount: 0, capacityAttempts: "", step: 25, useDecay: false };
  const tlConstrainedOn = !!opt.tlConstrainedEnabled;
  const timelineEnabled = !!features.timelineEnabled;

  const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
  const includeOverhead = !!budget.includeOverhead;
  const workforce = state?.ui?.twCapOutlookLatest?.workforce || null;

  const tactics = engine.buildOptimizationTactics({
    baseRates: { cr, sr, tr },
    tactics: tacticsRaw,
    workforce,
    state,
  });
  const realismSnapshot = (state?.ui?.lastRealismSnapshot && typeof state.ui.lastRealismSnapshot === "object")
    ? state.ui.lastRealismSnapshot
    : null;
  const budgetRealismFlags = Array.isArray(realismSnapshot?.flaggedAssumptions)
    ? realismSnapshot.flaggedAssumptions.filter((row) => String(row?.type || "").trim() === "budget")
    : [];
  const severeBudgetRealismFlags = budgetRealismFlags.filter((row) => String(row?.severity || "").trim() === "bad");
  const warningBudgetRealismFlags = budgetRealismFlags.filter((row) => String(row?.severity || "").trim() === "warn");
  const budgetRealismWarningText = warningBudgetRealismFlags.length
    ? String(warningBudgetRealismFlags[0]?.message || "One or more channel costs are outside realistic floors/ceilings.")
    : "";

  const bannerEl = els.optBanner;
  const showBanner = (kind, text) => {
    if (!bannerEl) return;
    bannerEl.hidden = false;
    bannerEl.className = `banner ${kind}`;
    bannerEl.textContent = text;
  };
  const hideBanner = () => {
    if (!bannerEl) return;
    bannerEl.hidden = true;
    bannerEl.textContent = "";
  };

  if (els.optMode && els.optBudget && els.optCapacity){
    const m = opt.mode || "budget";
    const isBudget = m === "budget";
    const budgetField = els.optBudget.closest(".field");
    const capField = els.optCapacity.closest(".field");
    if (budgetField) budgetField.hidden = !isBudget;
    if (capField) capField.hidden = isBudget;
  }

  if (optTbody) optTbody.innerHTML = "";

  if (!tactics.length){
    clearPlanCaches();
    hideBanner();
    showBanner("warn", "Optimization: Enable at least one tactic (Doors/Phones/Texts) in Phase 4 inputs.");
    setTotals(null);
    stubRow();
    return;
  }

  if (!(cr && cr > 0) || !(sr && sr > 0) || !(tr && tr > 0)){
    clearPlanCaches();
    hideBanner();
    showBanner("warn", "Optimization: Enter Phase 2 Contact rate + Support rate and Phase 3 Turnout reliability to optimize.");
    setTotals(null);
    stubRow();
    return;
  }
  if (severeBudgetRealismFlags.length){
    const detail = String(severeBudgetRealismFlags[0]?.message || "Channel costs exceed extreme realism bounds.");
    clearPlanCaches();
    hideBanner();
    showBanner("bad", `Optimization blocked by budget realism. ${detail}`);
    setTotals(null);
    stubRow();
    return;
  }
  const step = safeNum(opt.step) ?? 25;
  const objective = normalizeOptimizationObjective(opt.objective, "net");
  const objectiveLabel = getOptimizationObjectiveLabel(objective);
  let result = null;
  let timelineCapsSummary = null;
  let timelineCapTotal = null;

  if (tlConstrainedOn && timelineEnabled){
    timelineCapsSummary = computeTimelineCapsSummaryFromState({
      state,
      weeksRemaining: weeks ?? 0,
      enabled: true,
      tacticKinds: buildTimelineTacticKindsMapFromState(state),
      computeMaxAttemptsByTactic: (capsInput) => engine.computeMaxAttemptsByTactic(capsInput),
    });
    if (timelineCapsSummary.totalAttempts != null) timelineCapTotal = timelineCapsSummary.totalAttempts;
  }
  const effectiveCapAttempts = (timelineCapTotal != null) ? timelineCapTotal : capAttempts;

  if ((opt.mode || "budget") === "capacity"){
    const cap = resolveOptimizationCapacityLimit({
      capacityAttempts: safeNum(opt.capacityAttempts),
      fallbackCapacity: effectiveCapAttempts,
    }) ?? 0;

    result = engine.optimizeMixCapacity({
      capacity: cap,
      tactics,
      step,
      useDecay: !!opt.useDecay,
      objective
    });

    hideBanner();
    showBanner(
      budgetRealismWarningText ? "warn" : "ok",
      budgetRealismWarningText
        ? `Capacity plan with budget realism warning. ${budgetRealismWarningText}`
        : `Optimization: Capacity-constrained plan (${objectiveLabel} under attempt ceiling).`
    );
  } else {
    const budgetAvail = resolveOptimizationBudgetAvailable({
      budgetAmount: safeNum(opt.budgetAmount) ?? 0,
      includeOverhead,
      overheadAmount,
    });

    result = engine.optimizeMixBudget({
      budget: budgetAvail,
      tactics,
      step,
      capacityCeiling: effectiveCapAttempts,
      useDecay: !!opt.useDecay,
      objective
    });

    hideBanner();
    if (includeOverhead && overheadAmount > 0){
      showBanner(
        budgetRealismWarningText ? "warn" : "ok",
        budgetRealismWarningText
          ? `Budget plan with budget realism warning. ${budgetRealismWarningText}`
          : `Optimization: Budget-constrained plan. Overhead (${planNumber.formatCurrency(overheadAmount)}) treated as fixed; remaining budget optimized.`
      );
    } else {
      showBanner(
        budgetRealismWarningText ? "warn" : "ok",
        budgetRealismWarningText
          ? `Budget plan with budget realism warning. ${budgetRealismWarningText}`
          : `Optimization: Budget-constrained plan (${objectiveLabel} under fixed budget).`
      );
    }
  }

  if (!result){
    clearPlanCaches();
    setTotals(null);
    stubRow();
    return;
  }

  if (els.tlOptResults) els.tlOptResults.hidden = !tlConstrainedOn;

  if (tlConstrainedOn){
    const capsSummary = timelineCapsSummary || computeTimelineCapsSummaryFromState({
      state,
      weeksRemaining: weeks ?? 0,
      enabled: !!features.timelineEnabled,
      tacticKinds: buildTimelineTacticKindsMapFromState(state),
      computeMaxAttemptsByTactic: (capsInput) => engine.computeMaxAttemptsByTactic(capsInput),
    });
    const rawMaxAttemptsByTactic = capsSummary.maxAttemptsByTactic;
    const normalizedCaps = capsSummary.capsByTactic;
    const capsInput = capsSummary.capsInput || {};

    const tlObj = opt.tlConstrainedObjective || "max_net";
    const tlInputs = buildTimelineConstrainedOptimizationInput({
      mode: opt.mode || "budget",
      budgetAmount: safeNum(opt.budgetAmount) ?? 0,
      includeOverhead,
      overheadAmount,
      capacityAttempts: safeNum(opt.capacityAttempts),
      capacityCeiling: effectiveCapAttempts,
      tactics,
      step,
      useDecay: !!opt.useDecay,
      objective,
      maxAttemptsByTactic: rawMaxAttemptsByTactic ? (normalizedCaps || rawMaxAttemptsByTactic) : null,
      tlObjectiveMode: tlObj,
      goalObjectiveValue: needVotes,
    });

    const tlOut = engine.optimizeTimelineConstrained(tlInputs);

    if (tlOut && tlOut.plan){
      result = tlOut.plan;
    }

    const meta = tlOut?.meta || {};
    const tlObjectiveMeta = getTimelineObjectiveMeta(meta);
    if (els.tlOptGoalFeasible){
      els.tlOptGoalFeasible.textContent = formatPlanGoalFeasible(meta.goalFeasible, {
        trueLabel: "true",
        falseLabel: "false",
        unknownLabel: "—",
      });
    }
    if (els.tlOptMaxNetVotes){
      const maxAchievableValue = safeNum(tlObjectiveMeta.maxAchievableObjectiveValue) ?? 0;
      els.tlOptMaxNetVotes.textContent = planNumber.formatWhole(maxAchievableValue);
    }
    if (els.tlOptRemainingGap){
      const remainingGapValue = safeNum(tlObjectiveMeta.remainingGapObjectiveValue) ?? 0;
      els.tlOptRemainingGap.textContent = planNumber.formatWhole(remainingGapValue);
    }
    if (els.tlOptBinding){
      const bindingText = derivePlanBindingText(meta.bindingObj || {});
      els.tlOptBinding.textContent = (bindingText && bindingText !== "—") ? bindingText : "none";
    }

    state.ui.lastTlMeta = structuredClone(meta);

    const mv = engine.computeMarginalValueDiagnostics({
      baselineInputs: tlInputs,
      baselineResult: tlOut,
      timelineInputs: capsInput
    });

    state.ui.lastDiagnostics = {
      primaryBottleneck: mv?.primaryBottleneck || null,
      secondaryNotes: mv?.secondaryNotes || null
    };

    if (els.tlMvPrimary) els.tlMvPrimary.textContent = mv?.primaryBottleneck || "—";
    if (els.tlMvSecondary) els.tlMvSecondary.textContent = mv?.secondaryNotes || "—";

    if (els.tlMvTbody){
      els.tlMvTbody.innerHTML = "";
      const rows = buildPlanMarginalDiagnosticsRowsView(Array.isArray(mv?.interventions) ? mv.interventions : [], {
        formatWhole: planNumber.formatWhole,
        formatCurrency: planNumber.formatCurrency,
      });
      for (const it of rows){
        const trEl = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = it?.intervention || "—";

        const td1 = document.createElement("td");
        td1.className = "num";
        td1.textContent = it?.deltaObjectiveValue || "—";

        const td2 = document.createElement("td");
        td2.className = "num";
        td2.textContent = it?.deltaCost || "—";

        const td3 = document.createElement("td");
        td3.className = "muted";
        td3.textContent = it?.notes || "—";

        trEl.appendChild(td0);
        trEl.appendChild(td1);
        trEl.appendChild(td2);
        trEl.appendChild(td3);
        els.tlMvTbody.appendChild(trEl);
      }
      if (!rows.length){
        const tr = document.createElement("tr");
        tr.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td>';
        els.tlMvTbody.appendChild(tr);
      }
    }
  }

  state.ui.lastOpt = {
    allocation: structuredClone(result.allocation || {}),
    totals: structuredClone(result.totals || {}),
    binding: result.binding || "caps",
    objective
  };

  const obj = normalizeOptimizationObjective(state.budget?.optimize?.objective, "net");
  const buildExecutionSummary = (typeof engine?.buildOptimizationExecutionSummary === "function")
    ? (input) => engine.buildOptimizationExecutionSummary(input)
    : (input) => buildCanonicalOptimizationExecutionSummary(input);
  const executionSummary = buildExecutionSummary({
    tactics,
    allocation: result.allocation,
    totals: result.totals,
    objective: obj,
    needObjectiveValue: needVotes,
    includeOverhead,
    overheadAmount,
  });
  const summaryRows = Array.isArray(executionSummary?.rows) ? executionSummary.rows : [];
  const officePathSummary = buildOfficeOptimizationSummary({
    officeMixRows: state?.ui?.twCapOutlookLatest?.officeMix,
    mode: opt.mode || "budget",
    objective: obj,
    step,
    useDecay: !!opt.useDecay,
    budgetAmount: safeNum(opt.budgetAmount) ?? 0,
    includeOverhead,
    overheadAmount,
    capacityLimit: resolveOptimizationCapacityLimit({
      capacityAttempts: safeNum(opt.capacityAttempts),
      fallbackCapacity: effectiveCapAttempts,
    }) ?? 0,
    baseRates: { cr, sr, tr },
    tacticsRaw,
    state,
    workforce,
    organizerHoursPerWeek: effective.capacity.orgHoursPerWeek,
    weeksRemaining: weeks,
    buildOptimizationTactics: (input) => engine.buildOptimizationTactics(input),
    runOfficeOptimizer: (input) => engine.optimizeMixByOffice(input),
  });

  const allocationRows = buildPlanOptimizerAllocationRowsView(summaryRows, {
    formatWhole: planNumber.formatWhole,
    formatCurrency: planNumber.formatCurrency,
  });
  for (const row of allocationRows){

    if (optTbody){
      const trEl = document.createElement("tr");

      const td0 = document.createElement("td");
      td0.textContent = String(row.tactic || "—");

      const td1 = document.createElement("td");
      td1.className = "num";
      td1.textContent = row.attempts || "—";

      const td2 = document.createElement("td");
      td2.className = "num";
      td2.textContent = row.cost || "—";

      const td3 = document.createElement("td");
      td3.className = "num";
      td3.textContent = row.expectedObjectiveValue || "—";

      trEl.appendChild(td0);
      trEl.appendChild(td1);
      trEl.appendChild(td2);
      trEl.appendChild(td3);
      optTbody.appendChild(trEl);
    }
  }

  if (!allocationRows.length) stubRow();

  const totalAttempts = Number(executionSummary?.totals?.attempts || 0);
  const totalCost = Number(executionSummary?.totals?.cost || 0);
  const totalObjectiveValue = Number(executionSummary?.totals?.objectiveValue || 0);

  setTotals({
    attempts: totalAttempts,
    cost: totalCost,
    objectiveValue: totalObjectiveValue,
    binding: result.binding || "—"
  });

  try {
    const planRows = normalizePlanOptimizerRows(summaryRows);

    const weeksRounded = roundWholeNumberByMode(weeks, { mode: "floor", fallback: null });
    const weeksMeta = (weeksRounded != null) ? Math.max(0, weeksRounded) : null;
    const staffMeta = safeNum(state.timelineStaffCount) ?? null;
    const volMeta = safeNum(state.timelineVolCount) ?? null;

    const feasible = resolveOptimizationFeasible({
      timelineConstrainedEnabled: tlConstrainedOn,
      timelineEnabled,
      timelineGoalFeasible: state.ui?.lastTlMeta?.goalFeasible,
      timelineExecutablePct: state.ui?.lastTimeline?.percentPlanExecutable,
      executableThreshold: 0.999,
    });

    state.ui.lastPlanRows = structuredClone(planRows);
    state.ui.lastPlanMeta = {
      weeks: weeksMeta,
      staff: staffMeta,
      volunteers: volMeta,
      objective: obj,
      feasible
    };

    const executionView = buildOptimizationExecutionView({
      executionSummary,
      mode: opt.mode || "budget",
      objectiveLabel,
      formatInt: planNumber.formatIntRound,
    });
    state.ui.lastSummary = buildOptimizationLastSummarySnapshot({
      objective: obj,
      executionSummary,
      executionView,
      binding: result.binding || null,
      feasible,
      primaryBottleneck: state.ui?.lastDiagnostics?.primaryBottleneck || null,
      officePaths: officePathSummary,
      roundWhole: planNumber.roundWhole,
    });
  } catch {}

  function setTotals(t){
    const totalsView = buildPlanOptimizerTotalsView(t, {
      formatWhole: planNumber.formatWhole,
      formatCurrency: planNumber.formatCurrency,
    });
    if (els.optTotalAttempts) els.optTotalAttempts.textContent = totalsView.attempts;
    if (els.optTotalCost) els.optTotalCost.textContent = totalsView.cost;
    if (els.optTotalVotes) els.optTotalVotes.textContent = totalsView.objectiveValue;
    if (els.optBinding) els.optBinding.textContent = totalsView.binding;
  }

  function stubRow(){
    if (!optTbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td>';
    optTbody.appendChild(tr);
  }
}
