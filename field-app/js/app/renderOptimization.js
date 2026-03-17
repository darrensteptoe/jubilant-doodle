// @ts-check
import { resolveFeatureFlags } from "../core/featureFlags.js";
import { getTimelineObjectiveMeta } from "../core/timelineOptimizer.js";
import {
  buildOptimizationUpliftSummaryText,
  deriveOptimizationUpliftSignals,
} from "../core/optimize.js";
import {
  getOptimizationObjectiveLabel,
  normalizeOptimizationObjective,
} from "../core/turnout.js";

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

  const needVotes = deriveNeedVotes(res);
  if (els.optGapContext) els.optGapContext.textContent = (needVotes == null) ? "—" : fmtInt(Math.round(needVotes));

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

  const step = safeNum(opt.step) ?? 25;
  const objective = normalizeOptimizationObjective(opt.objective, "net");
  const objectiveLabel = getOptimizationObjectiveLabel(objective);
  let result = null;
  let timelineCapsWrap = null;
  let timelineCapTotal = null;

  if (tlConstrainedOn && timelineEnabled){
    const capsInput = {
      enabled: true,
      weeksRemaining: weeks ?? 0,
      activeWeeksOverride: safeNum(state.timelineActiveWeeks),
      gotvWindowWeeks: safeNum(state.timelineGotvWeeks),
      staffing: {
        staff: safeNum(state.timelineStaffCount) ?? 0,
        volunteers: safeNum(state.timelineVolCount) ?? 0,
        staffHours: safeNum(state.timelineStaffHours) ?? 0,
        volunteerHours: safeNum(state.timelineVolHours) ?? 0,
      },
      throughput: {
        doors: safeNum(state.timelineDoorsPerHour) ?? 0,
        phones: safeNum(state.timelineCallsPerHour) ?? 0,
        texts: safeNum(state.timelineTextsPerHour) ?? 0,
      },
      tacticKinds: {
        doors: state.budget?.tactics?.doors?.kind || "persuasion",
        phones: state.budget?.tactics?.phones?.kind || "persuasion",
        texts: state.budget?.tactics?.texts?.kind || "persuasion",
      }
    };
    timelineCapsWrap = engine.computeMaxAttemptsByTactic(capsInput);
    const caps = (timelineCapsWrap && timelineCapsWrap.enabled && timelineCapsWrap.maxAttemptsByTactic && typeof timelineCapsWrap.maxAttemptsByTactic === "object")
      ? timelineCapsWrap.maxAttemptsByTactic
      : null;
    if (caps){
      const total = Object.values(caps).reduce((acc, value) => {
        const v = Number(value);
        return acc + (Number.isFinite(v) && v >= 0 ? v : 0);
      }, 0);
      if (Number.isFinite(total) && total >= 0) timelineCapTotal = total;
    }
  }
  const effectiveCapAttempts = (timelineCapTotal != null) ? timelineCapTotal : capAttempts;

  if ((opt.mode || "budget") === "capacity"){
    const capUser = safeNum(opt.capacityAttempts);
    const cap = (capUser != null && capUser >= 0) ? capUser : (effectiveCapAttempts != null ? effectiveCapAttempts : 0);

    result = engine.optimizeMixCapacity({
      capacity: cap,
      tactics,
      step,
      useDecay: !!opt.useDecay,
      objective
    });

    hideBanner();
    showBanner("ok", `Optimization: Capacity-constrained plan (${objectiveLabel} under attempt ceiling).`);
  } else {
    const budgetIn = safeNum(opt.budgetAmount) ?? 0;
    const budgetAvail = Math.max(0, budgetIn - (includeOverhead ? overheadAmount : 0));

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
      showBanner("ok", `Optimization: Budget-constrained plan. Overhead ($${fmtInt(Math.round(overheadAmount))}) treated as fixed; remaining budget optimized.`);
    } else {
      showBanner("ok", `Optimization: Budget-constrained plan (${objectiveLabel} under fixed budget).`);
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
    const tacticKinds = {
      doors: state.budget?.tactics?.doors?.kind || "persuasion",
      phones: state.budget?.tactics?.phones?.kind || "persuasion",
      texts: state.budget?.tactics?.texts?.kind || "persuasion",
    };

    const capsInput = {
      enabled: !!features.timelineEnabled,
      weeksRemaining: weeks ?? 0,
      activeWeeksOverride: safeNum(state.timelineActiveWeeks),
      gotvWindowWeeks: safeNum(state.timelineGotvWeeks),
      staffing: {
        staff: safeNum(state.timelineStaffCount) ?? 0,
        volunteers: safeNum(state.timelineVolCount) ?? 0,
        staffHours: safeNum(state.timelineStaffHours) ?? 0,
        volunteerHours: safeNum(state.timelineVolHours) ?? 0,
      },
      throughput: {
        doors: safeNum(state.timelineDoorsPerHour) ?? 0,
        phones: safeNum(state.timelineCallsPerHour) ?? 0,
        texts: safeNum(state.timelineTextsPerHour) ?? 0,
      },
      tacticKinds
    };

    const caps = timelineCapsWrap || engine.computeMaxAttemptsByTactic(capsInput);

    const budgetIn = safeNum(opt.budgetAmount) ?? 0;
    const budgetAvail = Math.max(0, budgetIn - (includeOverhead ? overheadAmount : 0));

    const capUser = safeNum(opt.capacityAttempts);
    const capLimit = (capUser != null && capUser >= 0) ? capUser : (effectiveCapAttempts != null ? effectiveCapAttempts : 0);

    const tlObj = opt.tlConstrainedObjective || "max_net";
    const tlInputs = {
      mode: (opt.mode || "budget"),
      budgetLimit: (opt.mode === "capacity") ? null : budgetAvail,
      capacityLimit: (opt.mode === "capacity") ? capLimit : null,
      capacityCeiling: (opt.mode === "capacity") ? null : effectiveCapAttempts,
      tactics,
      step,
      useDecay: !!opt.useDecay,
      objective,
      maxAttemptsByTactic: (caps && caps.enabled) ? caps.maxAttemptsByTactic : null,
      tlObjectiveMode: tlObj,
      goalObjectiveValue: needVotes
    };

    const tlOut = engine.optimizeTimelineConstrained(tlInputs);

    if (tlOut && tlOut.plan){
      result = tlOut.plan;
    }

    const meta = tlOut?.meta || {};
    const tlObjectiveMeta = getTimelineObjectiveMeta(meta);
    if (els.tlOptGoalFeasible) els.tlOptGoalFeasible.textContent = (meta.goalFeasible === true) ? "true" : (meta.goalFeasible === false ? "false" : "—");
    if (els.tlOptMaxNetVotes){
      const maxAchievableValue = safeNum(tlObjectiveMeta.maxAchievableObjectiveValue) ?? 0;
      els.tlOptMaxNetVotes.textContent = fmtInt(Math.round(maxAchievableValue));
    }
    if (els.tlOptRemainingGap){
      const remainingGapValue = safeNum(tlObjectiveMeta.remainingGapObjectiveValue) ?? 0;
      els.tlOptRemainingGap.textContent = fmtInt(Math.round(remainingGapValue));
    }
    if (els.tlOptBinding){
      const b = meta.bindingObj || {};
      const parts = [];
      if (Array.isArray(b.timeline) && b.timeline.length) parts.push("timeline");
      if (b.budget) parts.push("budget");
      if (b.capacity) parts.push("capacity");
      els.tlOptBinding.textContent = parts.length ? parts.join(" / ") : "none";
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
      const rows = Array.isArray(mv?.interventions) ? mv.interventions : [];
      for (const it of rows){
        const trEl = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = it?.intervention || "—";

        const td1 = document.createElement("td");
        td1.className = "num";
        const dv = (it && typeof it.deltaObjectiveValue === "number")
          ? it.deltaObjectiveValue
          : ((it && typeof it.deltaMaxNetVotes === "number") ? it.deltaMaxNetVotes : null);
        td1.textContent = (dv == null) ? "—" : fmtInt(Math.round(dv));

        const td2 = document.createElement("td");
        td2.className = "num";
        const dc = (it && typeof it.deltaCost === "number") ? it.deltaCost : null;
        td2.textContent = (dc == null) ? "—" : `$${fmtInt(Math.round(dc))}`;

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
  const executionSummary = engine.buildOptimizationExecutionSummary({
    tactics,
    allocation: result.allocation,
    totals: result.totals,
    objective: obj,
    needObjectiveValue: needVotes,
    includeOverhead,
    overheadAmount,
  });
  const summaryRows = Array.isArray(executionSummary?.rows) ? executionSummary.rows : [];

  let any = false;
  for (const row of summaryRows){
    if (!(Number(row?.attempts) > 0)) continue;
    any = true;

    if (optTbody){
      const trEl = document.createElement("tr");

      const td0 = document.createElement("td");
      td0.textContent = String(row.tactic || "—");

      const td1 = document.createElement("td");
      td1.className = "num";
      td1.textContent = fmtInt(Math.round(Number(row.attempts) || 0));

      const td2 = document.createElement("td");
      td2.className = "num";
      td2.textContent = `$${fmtInt(Math.round(Number(row.cost) || 0))}`;

      const td3 = document.createElement("td");
      td3.className = "num";
      td3.textContent = fmtInt(Math.round(Number(row.expectedObjectiveValue) || 0));

      trEl.appendChild(td0);
      trEl.appendChild(td1);
      trEl.appendChild(td2);
      trEl.appendChild(td3);
      optTbody.appendChild(trEl);
    }
  }

  if (!any) stubRow();

  const totalAttempts = Number(executionSummary?.totals?.attempts || 0);
  const totalCost = Number(executionSummary?.totals?.cost || 0);
  const totalObjectiveValue = Number(executionSummary?.totals?.objectiveValue || 0);

  setTotals({
    attempts: totalAttempts,
    cost: totalCost,
    votes: totalObjectiveValue,
    binding: result.binding || "—"
  });

  try {
    const planRows = summaryRows.map((row) => ({
      id: String(row.id || ""),
      tactic: String(row.tactic || ""),
      attempts: Math.round(Number(row.attempts) || 0),
      expectedContacts: Number(row.expectedContacts) || 0,
      expectedNetVotes: Number(row.expectedNetVotes) || 0,
      expectedObjectiveValue: Number(row.expectedObjectiveValue) || 0,
      cost: Number(row.cost) || 0,
      costPerNetVote: Number.isFinite(Number(row.costPerNetVote)) ? Number(row.costPerNetVote) : null,
      upliftExpectedMarginalGain: Number.isFinite(Number(row.upliftExpectedMarginalGain)) ? Number(row.upliftExpectedMarginalGain) : null,
      upliftLowMarginalGain: Number.isFinite(Number(row.upliftLowMarginalGain)) ? Number(row.upliftLowMarginalGain) : null,
      upliftGainPerDollar: Number.isFinite(Number(row.upliftGainPerDollar)) ? Number(row.upliftGainPerDollar) : null,
      saturationUtilization: Number.isFinite(Number(row.saturationUtilization)) ? Number(row.saturationUtilization) : null,
    }));

    const weeksMeta = (weeks != null && Number.isFinite(weeks)) ? Math.max(0, Math.floor(weeks)) : null;
    const staffMeta = safeNum(state.timelineStaffCount) ?? null;
    const volMeta = safeNum(state.timelineVolCount) ?? null;

    const tlPct = state.ui?.lastTimeline?.percentPlanExecutable;
    const tlGoalFeasible = state.ui?.lastTlMeta?.goalFeasible;
    const feasible = (tlConstrainedOn && timelineEnabled)
      ? (tlGoalFeasible === true ? true : (tlGoalFeasible === false ? false : (tlPct != null ? tlPct >= 0.999 : null)))
      : true;

    state.ui.lastPlanRows = structuredClone(planRows);
    state.ui.lastPlanMeta = {
      weeks: weeksMeta,
      staff: staffMeta,
      volunteers: volMeta,
      objective: obj,
      feasible
    };

    const topAllocations = Array.isArray(executionSummary?.topAllocations)
      ? executionSummary.topAllocations.map((row) => `${row.tactic}: ${fmtInt(Math.round(Number(row.attempts) || 0))} attempts`)
      : [];
    const gapObjective = Number(executionSummary?.totals?.gapObjectiveValue);
    const gapContext = (Number.isFinite(gapObjective))
      ? (gapObjective <= 0
        ? "Modeled allocation closes current gap."
        : `${fmtInt(Math.round(gapObjective))} gap remains under current allocation.`)
      : "Gap context unavailable.";
    const modeLabel = ((opt.mode || "budget") === "capacity")
      ? "Capacity-constrained"
      : "Budget-constrained";
    const upliftSummaryText = buildUpliftSummaryText(executionSummary?.uplift, fmtInt);
    const banner = upliftSummaryText
      ? `${modeLabel} allocation using ${objectiveLabel}. ${upliftSummaryText}`
      : `${modeLabel} allocation using ${objectiveLabel}.`;

    state.ui.lastSummary = {
      objective: obj,
      objectiveValue: Math.round(totalObjectiveValue || 0),
      netVotes: Math.round(totalObjectiveValue || 0),
      cost: Math.round(totalCost || 0),
      binding: result.binding || null,
      gapContext,
      banner,
      feasible,
      primaryBottleneck: state.ui?.lastDiagnostics?.primaryBottleneck || null,
      topAllocations,
      upliftSummary: executionSummary?.uplift || null,
    };
  } catch {}

  function setTotals(t){
    if (els.optTotalAttempts) els.optTotalAttempts.textContent = t ? fmtInt(Math.round(t.attempts)) : "—";
    if (els.optTotalCost) els.optTotalCost.textContent = t ? `$${fmtInt(Math.round(t.cost))}` : "—";
    if (els.optTotalVotes) els.optTotalVotes.textContent = t ? fmtInt(Math.round(t.votes)) : "—";
    if (els.optBinding) els.optBinding.textContent = t ? (t.binding || "—") : "—";
  }

  function stubRow(){
    if (!optTbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td>';
    optTbody.appendChild(tr);
  }
}

function buildUpliftSummaryText(summary, fmtInt){
  const uplift = deriveOptimizationUpliftSignals(summary);
  if (!uplift.hasExpected && !uplift.bestChannel && !uplift.hasUncertainty && !uplift.hasSaturation){
    return "";
  }
  return buildOptimizationUpliftSummaryText(summary, {
    formatPercent: (value) => `${fmtInt(Math.round(Number(value) * 100))}%`,
    rangeJoiner: "-",
    saturationPrefix: "saturation",
  });
}
