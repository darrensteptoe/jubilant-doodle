// @ts-check
import { resolveFeatureFlags } from "../../core/featureFlags.js";
import { getTimelineObjectiveMeta } from "../../core/timelineOptimizer.js";
import { normalizeOptimizationObjective } from "../../core/turnout.js";

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

  const fmtDelta = (v) => {
    if (v == null || !isFinite(v)) return "—";
    const s = v > 0 ? "+" : "";
    return `${s}${fmtInt(Math.round(v))}`;
  };

  const computePrimarySecondary = ({ maxAttemptsByTactic }) => {
    const bindingObj = state.ui?.lastTlMeta?.bindingObj || {};
    const alloc = state.ui?.lastOpt?.allocation || {};
    const bindingTimeline = Array.isArray(bindingObj?.timeline) ? bindingObj.timeline : [];
    const bindingBudget = !!bindingObj?.budget;
    const bindingCapacity = !!bindingObj?.capacity;

    const sat = [];
    for (const t of bindingTimeline){
      const cap = safeNum(maxAttemptsByTactic?.[t]);
      const a = safeNum(alloc?.[t]);
      const s = (cap != null && cap > 0 && a != null) ? (a / cap) : null;
      if (s != null) sat.push({ t, s });
    }
    sat.sort((a,b)=> b.s - a.s || String(a.t).localeCompare(String(b.t)));

    let primary = null;
    let secondary = null;

    if (sat.length){
      primary = `timeline: ${sat[0].t}`;
      if (sat.length > 1) secondary = `timeline: ${sat[1].t}`;
    } else if (bindingTimeline.length){
      primary = `timeline: ${bindingTimeline[0]}`;
      if (bindingTimeline.length > 1) secondary = `timeline: ${bindingTimeline[1]}`;
    }

    const others = [];
    if (bindingBudget) others.push("budget");
    if (bindingCapacity) others.push("capacity");

    if (!primary && others.length){
      primary = others[0];
      secondary = others[1] || null;
    } else if (primary && !secondary && others.length){
      secondary = others[0];
    }

    return { primary: primary || "none/unknown", secondary: secondary || "—" };
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
  const tactics = engine.buildOptimizationTactics({
    baseRates: { cr, sr, tr },
    tactics: budget.tactics || {},
    state,
  });

  const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
  const includeOverhead = !!budget.includeOverhead;

  const capsInputBase = {
    enabled: true,
    weeksRemaining: (weeks != null && isFinite(weeks)) ? weeks : 0,
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

  const computeTl = ({ tacticsIn, capsIn, budgetLimitIn }) => {
    const caps = engine.computeMaxAttemptsByTactic(capsIn);
    const maxAttemptsByTactic = (caps && caps.enabled) ? caps.maxAttemptsByTactic : null;

    const budgetIn = safeNum(budgetLimitIn) ?? 0;
    const budgetAvail = Math.max(0, budgetIn - (includeOverhead ? overheadAmount : 0));

    const capUser = safeNum(opt.capacityAttempts);
    const capCeiling = null;
    const capLimit = (capUser != null && capUser >= 0) ? capUser : null;

    const tlObj = opt.tlConstrainedObjective || "max_net";
    const step = safeNum(opt.step) ?? 100;
    const objective = normalizeOptimizationObjective(opt.objective, "net");

    const inputs = {
      mode: (opt.mode || "budget"),
      budgetLimit: ((opt.mode || "budget") === "capacity") ? null : budgetAvail,
      capacityLimit: ((opt.mode || "budget") === "capacity") ? (capLimit ?? 0) : null,
      capacityCeiling: ((opt.mode || "budget") === "capacity") ? null : capCeiling,
      tactics: tacticsIn,
      step,
      useDecay: !!opt.useDecay,
      objective,
      maxAttemptsByTactic,
      tlObjectiveMode: tlObj,
      goalObjectiveValue: needVotes
    };
    return { out: engine.optimizeTimelineConstrained(inputs), maxAttemptsByTactic };
  };
  const readTimelineObjectiveMeta = (meta) => getTimelineObjectiveMeta(meta);

  const baseBudget = safeNum(opt.budgetAmount) ?? 0;
  const base = computeTl({ tacticsIn: tactics, capsIn: capsInputBase, budgetLimitIn: baseBudget });
  const baseMeta = base.out?.meta || {};
  const baseObjectiveMeta = readTimelineObjectiveMeta(baseMeta);
  const baseMax = safeNum(baseObjectiveMeta.maxAchievableObjectiveValue) ?? null;

  const ps = computePrimarySecondary({ maxAttemptsByTactic: base.maxAttemptsByTactic || null });
  if (bneckPrimaryEl) bneckPrimaryEl.textContent = ps.primary;
  if (bneckSecondaryEl) bneckSecondaryEl.textContent = ps.secondary;

  const bindingObj = baseMeta.bindingObj || state.ui?.lastTlMeta?.bindingObj || {};
  const badgeCls = (bindingObj?.budget || bindingObj?.capacity || (Array.isArray(bindingObj?.timeline) && bindingObj.timeline.length)) ? "warn" : "ok";
  if (bneckTagEl){
    bneckTagEl.textContent = badgeCls === "ok" ? "Clear" : "Binding";
    bneckTagEl.classList.remove("ok","warn","bad");
    bneckTagEl.classList.add(badgeCls);
  }

  const buildRow = (name, delta, notes) => {
    const trEl = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = name;
    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = fmtDelta(delta);
    const td2 = document.createElement("td");
    td2.className = "muted";
    td2.textContent = notes || "—";
    trEl.appendChild(td0); trEl.appendChild(td1); trEl.appendChild(td2);
    return trEl;
  };

  const staffHours10 = (() => {
    const c = structuredClone(capsInputBase);
    const cur = safeNum(c.staffing?.staffHours) ?? 0;
    c.staffing.staffHours = cur * 1.10;
    const out = computeTl({ tacticsIn: tactics, capsIn: c, budgetLimitIn: baseBudget });
    const outObjectiveMeta = readTimelineObjectiveMeta(out.out?.meta || null);
    const m = safeNum(outObjectiveMeta.maxAchievableObjectiveValue) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: "timeline capacity (staff hours/week)" };
  })();

  const volHours10 = (() => {
    const c = structuredClone(capsInputBase);
    const cur = safeNum(c.staffing?.volunteerHours) ?? 0;
    c.staffing.volunteerHours = cur * 1.10;
    const out = computeTl({ tacticsIn: tactics, capsIn: c, budgetLimitIn: baseBudget });
    const outObjectiveMeta = readTimelineObjectiveMeta(out.out?.meta || null);
    const m = safeNum(outObjectiveMeta.maxAchievableObjectiveValue) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: "volunteer hours/week" };
  })();

  const budget10 = (() => {
    if ((opt.mode || "budget") === "capacity") return { delta: null, notes: "budget not active (capacity mode)" };
    const out = computeTl({ tacticsIn: tactics, capsIn: capsInputBase, budgetLimitIn: baseBudget * 1.10 });
    const outObjectiveMeta = readTimelineObjectiveMeta(out.out?.meta || null);
    const m = safeNum(outObjectiveMeta.maxAchievableObjectiveValue) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: "budget ceiling" };
  })();

  const contactRate10 = (() => {
    const curPct = safeNum(state.contactRatePct);
    if (curPct == null) return { delta: null, notes: "contact rate missing" };
    const nextPct = clamp(curPct * 1.10, 0, 100);
    const t2 = engine.buildOptimizationTactics({
      baseRates: { cr: clamp(nextPct,0,100)/100, sr, tr },
      tactics: budget.tactics || {},
      state,
    });
    const out = computeTl({ tacticsIn: t2, capsIn: capsInputBase, budgetLimitIn: baseBudget });
    const outObjectiveMeta = readTimelineObjectiveMeta(out.out?.meta || null);
    const m = safeNum(outObjectiveMeta.maxAchievableObjectiveValue) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: `contact rate ${curPct.toFixed(1)}% → ${nextPct.toFixed(1)}%` };
  })();

  clear();
  if (bneckTbodyEl){
    bneckTbodyEl.appendChild(buildRow("Timeline capacity", staffHours10.delta, staffHours10.notes));
    bneckTbodyEl.appendChild(buildRow("Budget ceiling", budget10.delta, budget10.notes));
    bneckTbodyEl.appendChild(buildRow("Contact rate", contactRate10.delta, contactRate10.notes));
    bneckTbodyEl.appendChild(buildRow("Volunteer hours", volHours10.delta, volHours10.notes));
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

  const needVotes = (typeof deriveNeedVotes === "function")
    ? deriveNeedVotes(res, state?.goalSupportIds)
    : null;
  const goal = (needVotes != null && needVotes > 0) ? needVotes : 0;

  const eff = getEffectiveBaseRates();
  const sr = eff.sr;
  const cr = eff.cr;

  const dph = safeNum(state.doorsPerHour3) ?? safeNum(state.doorsPerHour);
  const hps = safeNum(state.hoursPerShift);
  const spv = safeNum(state.shiftsPerVolunteerPerWeek);

  const doorsPerShift = (dph != null && hps != null) ? dph * hps : null;

  const convosNeeded = (sr && sr > 0) ? goal / sr : null;
  const doorsNeeded = (convosNeeded != null && cr && cr > 0) ? convosNeeded / cr : null;

  const totalShifts = (doorsNeeded != null && doorsPerShift && doorsPerShift > 0) ? doorsNeeded / doorsPerShift : null;
  const shiftsPerWeek = (totalShifts != null && weeks && weeks > 0) ? totalShifts / weeks : null;
  const volsNeeded = (shiftsPerWeek != null && spv && spv > 0) ? shiftsPerWeek / spv : null;

  const fmtMaybe = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  setText(outConversationsNeededEl, fmtMaybe(convosNeeded));
  setText(outDoorsNeededEl, fmtMaybe(doorsNeeded));
  setText(outDoorsPerShiftEl, (doorsPerShift == null || !isFinite(doorsPerShift)) ? "—" : fmtInt(Math.round(doorsPerShift)));
  setText(outTotalShiftsEl, fmtMaybe(totalShifts));
  setText(outShiftsPerWeekEl, fmtMaybe(shiftsPerWeek));
  setText(outVolunteersNeededEl, fmtMaybe(volsNeeded));

  let msg = "";
  let cls = "";
  let show = true;

  if (goal <= 0){
    msg = "Capacity check: Under current assumptions, no additional support IDs are required (goal = 0).";
    cls = "ok";
  } else if (weeks == null || weeks <= 0){
    msg = "Capacity check: Set an election date (or weeks remaining) to compute per-week requirements.";
    cls = "warn";
  } else if (sr == null || sr <= 0 || cr == null || cr <= 0 || doorsPerShift == null || doorsPerShift <= 0){
    msg = "Capacity check: Enter Support rate, Contact rate, Doors/hour, and Hours/shift to compute workload.";
    cls = "warn";
  } else if (volsNeeded == null || !isFinite(volsNeeded)){
    msg = "Capacity check: Enter Shifts per volunteer/week to estimate active volunteer requirement.";
    cls = "warn";
  } else {
    const v = Math.ceil(volsNeeded);
    if (v <= 25){
      msg = `Capacity check: Looks feasible (≈ ${fmtInt(v)} active volunteers at your stated cadence).`;
      cls = "ok";
    } else if (v <= 60){
      msg = `Capacity check: Ambitious (≈ ${fmtInt(v)} active volunteers). Consider higher efficiency, longer shifts, or supplementing with paid/phones/texts.`;
      cls = "warn";
    } else {
      msg = `Capacity check: High risk (≈ ${fmtInt(v)} active volunteers). You likely need multi-channel + paid volume, or revise assumptions.`;
      cls = "bad";
    }
  }

  if (convFeasBannerEl){
    convFeasBannerEl.hidden = !show;
    convFeasBannerEl.className = `banner ${cls}`.trim();
    convFeasBannerEl.textContent = msg;
  }

  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  state.ui.lastConversion = {
    goalObjectiveValue: goal,
    goalNetVotes: goal,
    conversationsNeeded: convosNeeded,
    doorsNeeded,
    doorsPerShift,
    totalShifts,
    shiftsPerWeek,
    volunteersNeeded: volsNeeded,
    feasibility: {
      kind: cls || "",
      text: msg || "",
      shown: !!show,
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

  const base = state.mcLast;
  if (!base){
    stub("Run Monte Carlo to enable the sensitivity snapshot.", "warn");
    if (btnSensRunEl) btnSensRunEl.disabled = true;
    return;
  }

  if (mcStaleness?.isStale){
    const reason = mcStaleness.reasonText || "inputs changed";
    stub(`Monte Carlo is stale (${reason}). Re-run MC, then run snapshot.`, "warn");
    if (btnSensRunEl) btnSensRunEl.disabled = true;
    return;
  }

  if (btnSensRunEl) btnSensRunEl.disabled = false;

  const cache = state.ui?.e4Sensitivity;
  if (!cache || cache.baseHash !== state.mcLastHash || !Array.isArray(cache.rows) || cache.rows.length === 0){
    stub("Click \"Run snapshot\" to compute small perturbation deltas (read-only).", "");
    return;
  }

  if (sensTbodyEl) {
    sensTbodyEl.innerHTML = "";
    for (const r of cache.rows){
      const tr = document.createElement("tr");
      const td0 = document.createElement("td"); td0.textContent = r.label || "—";
      const td1 = document.createElement("td"); td1.className = "num"; td1.textContent = r.dWin || "—";
      const td2 = document.createElement("td"); td2.className = "num"; td2.textContent = r.dP50 || "—";
      const td3 = document.createElement("td"); td3.className = "muted"; td3.textContent = r.note || "";
      tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      sensTbodyEl.appendChild(tr);
    }
  }

  const tag = cache.tag || "Snapshot";
  if (sensTagEl) {
    sensTagEl.textContent = tag;
    sensTagEl.classList.remove("ok","warn","bad");
    if (cache.cls) sensTagEl.classList.add(cache.cls);
  }

  if (sensBannerEl) {
    sensBannerEl.className = `banner ${cache.cls || ""}`.trim();
    sensBannerEl.textContent = cache.banner || "—";
  }
}

export function computeSensitivitySnapshotCache({
  state,
  lastRenderCtx,
  clamp,
  runMonteCarloSim,
  runs = 2000,
}){
  const base = state?.mcLast;
  if (!base){
    return { ok: false, code: "missing_base_mc" };
  }

  const ctx = lastRenderCtx;
  if (!ctx || !ctx.res){
    return { ok: false, code: "missing_render_context" };
  }

  const weeks = (ctx.weeks != null && ctx.weeks >= 0) ? ctx.weeks : null;
  const needVotes = (ctx.needVotes != null && ctx.needVotes >= 0) ? ctx.needVotes : null;
  const seed = state.mcSeed || "";

  const baseP = clamp(Number(base.winProb ?? 0), 0, 1);
  const baseP50 = (base.confidenceEnvelope?.percentiles?.p50 != null) ? Number(base.confidenceEnvelope.percentiles.p50)
    : (base.median != null ? Number(base.median) : null);

  const fmtWinDelta = (p) => {
    if (p == null || !isFinite(p)) return "—";
    const d = (p - baseP) * 100;
    const s = d > 0 ? "+" : "";
    return `${s}${d.toFixed(1)} pts`;
  };

  const fmtMarginDelta = (m) => {
    if (m == null || !isFinite(m) || baseP50 == null || !isFinite(baseP50)) return "—";
    const d = m - baseP50;
    const s = d > 0 ? "+" : "";
    return `${s}${d.toFixed(1)}`;
  };

  const simWin = (sim) => (sim && sim.winProb != null) ? clamp(Number(sim.winProb), 0, 1) : null;
  const simP50 = (sim) => {
    if (!sim) return null;
    const p50 = sim.confidenceEnvelope?.percentiles?.p50;
    if (p50 != null && isFinite(p50)) return Number(p50);
    const m = sim.median;
    if (m != null && isFinite(m)) return Number(m);
    return null;
  };

  const bump = (v, f, lo, hi) => {
    const n = Number(v);
    if (!isFinite(n)) return v;
    const x = n * f;
    if (lo != null || hi != null){
      const a = (lo == null) ? x : Math.max(lo, x);
      return (hi == null) ? a : Math.min(hi, a);
    }
    return x;
  };

  const s1 = structuredClone(state);
  s1.doorsPerHour3 = bump(s1.doorsPerHour3, 1.10, 0.01, null);

  const s2 = structuredClone(state);
  s2.callsPerHour3 = bump(s2.callsPerHour3, 1.10, 0.01, null);

  const s3 = structuredClone(state);
  s3.volunteerMultBase = bump(s3.volunteerMultBase, 1.10, 0.01, 10);

  const s4 = structuredClone(state);
  if (s4.gotvMode === "advanced"){
    const v = Number(s4.gotvLiftMode);
    s4.gotvLiftMode = (isFinite(v) ? v : 0) + 5;
  } else {
    const v = Number(s4.gotvLiftPP);
    s4.gotvLiftPP = (isFinite(v) ? v : 0) + 5;
  }

  const jobs = [
    { label: "+10% doors", nextState: s1, note: "Doors/hr × 1.10" },
    { label: "+10% phones", nextState: s2, note: "Calls/hr × 1.10" },
    { label: "+10% volunteers", nextState: s3, note: "Volunteer multiplier × 1.10" },
    { label: "+5pp turnout lift", nextState: s4, note: "GOTV lift + 5pp" },
  ];

  const rows = [];
  for (const job of jobs){
    const sim = runMonteCarloSim({
      scenario: job.nextState,
      res: ctx.res,
      weeks,
      needVotes,
      runs,
      seed
    });
    const p = simWin(sim);
    const m = simP50(sim);
    rows.push({
      label: job.label,
      dWin: fmtWinDelta(p),
      dP50: fmtMarginDelta(m),
      note: job.note,
    });
  }

  const best = rows.reduce((acc, row) => {
    const m = parseFloat(String(row.dWin || "").replace(/[^0-9\-\.]+/g, ""));
    if (!isFinite(m)) return acc;
    const abs = Math.abs(m);
    if (!acc || abs > acc.abs) return { abs, row };
    return acc;
  }, null);

  const banner = best ? `Biggest movement in win probability: ${best.row.label} (${best.row.dWin}).` : "Snapshot complete.";
  const cls = best && best.abs >= 5 ? "warn" : "ok";

  return {
    ok: true,
    code: "ok",
    cache: {
      baseHash: state.mcLastHash,
      computedAt: Date.now(),
      rows,
      banner,
      tag: "Mini surface",
      cls,
    },
  };
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
