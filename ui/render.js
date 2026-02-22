import { fmtInt, clamp, safeNum } from "../utils.js";

let state = null;
let els = null;

let setUI = null;
let computeWeeklyOpsContext = null;
let computeDailyLogHash = null;
let hashMcInputs = null;
let formatMcTimestamp = null;

let hashOpsEnvelopeInputs = null;
let computeOpsEnvelopeD2 = null;
let hashFinishEnvelopeInputs = null;
let computeFinishEnvelopeD3 = null;
let hashMissRiskInputs = null;
let computeMissRiskD4 = null;

let fmtISODate = null;

let deriveNeedVotes = null;
let getEffectiveBaseRates = null;
let optimizeTimelineConstrained = null;

let ensureScenarioRegistry = null;
let scenarioClone = null;
let scenarioInputsFromState = null;

let ensureDecisionScaffold = null;
let ensureDecisionSessionShape = null;
let listDecisionSessions = null;
let getActiveDecisionSession = null;
let listDecisionOptions = null;
let getActiveDecisionOption = null;
let decisionScenarioLabel = null;
let decisionOptionDisplay = null;
let buildDecisionSummaryText = null;

let getLastRenderCtx = null;

export function bindRender(ctx){
  state = ctx.state;
  els = ctx.els;
  const h = ctx.helpers || {};

  setUI = h.setUI;
  computeWeeklyOpsContext = h.computeWeeklyOpsContext;
  computeDailyLogHash = h.computeDailyLogHash;
  hashMcInputs = h.hashMcInputs;
  formatMcTimestamp = h.formatMcTimestamp;

  hashOpsEnvelopeInputs = h.hashOpsEnvelopeInputs;
  computeOpsEnvelopeD2 = h.computeOpsEnvelopeD2;
  hashFinishEnvelopeInputs = h.hashFinishEnvelopeInputs;
  computeFinishEnvelopeD3 = h.computeFinishEnvelopeD3;
  hashMissRiskInputs = h.hashMissRiskInputs;
  computeMissRiskD4 = h.computeMissRiskD4;

  fmtISODate = h.fmtISODate;

  deriveNeedVotes = h.deriveNeedVotes;
  getEffectiveBaseRates = h.getEffectiveBaseRates;
  optimizeTimelineConstrained = h.optimizeTimelineConstrained;

  ensureScenarioRegistry = h.ensureScenarioRegistry;
  scenarioClone = h.scenarioClone;
  scenarioInputsFromState = h.scenarioInputsFromState;

  ensureDecisionScaffold = h.ensureDecisionScaffold;
  ensureDecisionSessionShape = h.ensureDecisionSessionShape;
  listDecisionSessions = h.listDecisionSessions;
  getActiveDecisionSession = h.getActiveDecisionSession;
  listDecisionOptions = h.listDecisionOptions;
  getActiveDecisionOption = h.getActiveDecisionOption;
  decisionScenarioLabel = h.decisionScenarioLabel;
  decisionOptionDisplay = h.decisionOptionDisplay;
  buildDecisionSummaryText = h.buildDecisionSummaryText;

  getLastRenderCtx = h.getLastRenderCtx;
}

export function setRenderState(next){
  state = next;
}



function renderAssumptionDriftE1(res, weeks){
  if (!els.driftStatusTag) return;

  const fInt = (v) => (v == null || !isFinite(v)) ? "—" : (String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  const fPct1 = (v) => (v == null || !isFinite(v)) ? "—" : ((v * 100).toFixed(1) + "%");

  const ctx = computeWeeklyOpsContext(res, weeks);
  const req = ctx?.attemptsPerWeek;
  if (els.driftReq) els.driftReq.textContent = (req == null || !isFinite(req)) ? "—" : fInt(Math.ceil(req));

  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  if (!log || log.length === 0){
    els.driftStatusTag.className = "tag";
    els.driftStatusTag.textContent = "Not tracking";
    if (els.driftActual) els.driftActual.textContent = "—";
    if (els.driftDelta) els.driftDelta.textContent = "—";
    if (els.driftSlipBanner){
      els.driftSlipBanner.className = "banner";
      els.driftSlipBanner.textContent = "Add daily log entries in organizer.html to activate drift detection.";
    }
    return;
  }

  const sorted = [...log].filter(x => x && x.date).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const lastN = sorted.slice(-7);

  let sumAttempts7 = 0;
  let sumAttemptsAll = 0;
  for (const x of sorted){
    const doors = safeNum(x?.doors) || 0;
    const calls = safeNum(x?.calls) || 0;
    const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
    sumAttemptsAll += attempts;
  }
  for (const x of lastN){
    const doors = safeNum(x?.doors) || 0;
    const calls = safeNum(x?.calls) || 0;
    const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
    sumAttempts7 += attempts;
  }

  if (els.driftActual) els.driftActual.textContent = fInt(sumAttempts7);

  let deltaPct = null;
  if (req != null && isFinite(req) && req > 0) deltaPct = (sumAttempts7 - req) / req;

  const abs = (deltaPct == null || !isFinite(deltaPct)) ? null : Math.abs(deltaPct);
  const cls = (abs == null) ? "" : (abs <= 0.05 ? "ok" : (abs <= 0.15 ? "warn" : "bad"));

  els.driftStatusTag.className = cls ? `tag ${cls}` : "tag";
  els.driftStatusTag.textContent = cls === "ok" ? "Green" : (cls === "warn" ? "Yellow" : (cls === "bad" ? "Red" : "—"));

  if (els.driftDelta){
    if (deltaPct == null || !isFinite(deltaPct)) els.driftDelta.textContent = "—";
    else els.driftDelta.textContent = `${deltaPct >= 0 ? "+" : ""}${fPct1(deltaPct)}`;
  }

  let slipDays = null;
  const totalNeed = ctx?.attemptsNeeded;
  const remaining = (totalNeed != null && isFinite(totalNeed)) ? Math.max(0, totalNeed - sumAttemptsAll) : null;
  if (remaining != null && isFinite(remaining) && weeks != null && isFinite(weeks) && weeks > 0 && sumAttempts7 > 0){
    const projWeeks = remaining / sumAttempts7;
    const d = (projWeeks - weeks) * 7;
    slipDays = Math.max(0, Math.round(d));
  }

  if (els.driftSlipBanner){
    const bCls = cls ? cls : "";
    els.driftSlipBanner.className = bCls ? `banner ${bCls}` : "banner";
    if (slipDays == null){
      els.driftSlipBanner.textContent = "At current pace, projected slip unavailable under current inputs.";
    } else {
      els.driftSlipBanner.textContent = slipDays === 0
        ? "At current pace, target completion stays on schedule."
        : `At current pace, target completion shifts by +${slipDays} days.`;
    }
  }
}

function renderRiskFramingE2(){
  if (!els.riskBandTag || !els.riskWinProb || !els.riskMarginBand || !els.riskVolatility || !els.riskPlainBanner) return;

  const setTag = (label, cls) => {
    els.riskBandTag.textContent = label || "—";
    els.riskBandTag.classList.remove("ok","warn","bad");
    if (cls) els.riskBandTag.classList.add(cls);
  };

  const setBanner = (text, cls) => {
    els.riskPlainBanner.className = `banner ${cls || ""}`.trim();
    els.riskPlainBanner.textContent = text || "—";
  };

  const s = state.mcLast;
  if (!s){
    setTag("—", null);
    els.riskWinProb.textContent = "—";
    els.riskMarginBand.textContent = "—";
    els.riskVolatility.textContent = "—";
    setBanner("Run Monte Carlo to populate risk framing.", "warn");
    return;
  }

  const p = clamp(Number(s.winProb ?? 0), 0, 1);
  els.riskWinProb.textContent = `${(p * 100).toFixed(1)}%`;

  const ce = s.confidenceEnvelope;
  const lo = (ce?.percentiles?.p10 != null) ? Number(ce.percentiles.p10) : (s.p5 != null ? Number(s.p5) : null);
  const hi = (ce?.percentiles?.p90 != null) ? Number(ce.percentiles.p90) : (s.p95 != null ? Number(s.p95) : null);
  const mid = (ce?.percentiles?.p50 != null) ? Number(ce.percentiles.p50) : (s.median != null ? Number(s.median) : null);

  const fmtBand = (a, b, m) => {
    if (a == null || b == null || !isFinite(a) || !isFinite(b)) return "—";
    const mtxt = (m == null || !isFinite(m)) ? "" : ` (p50: ${fmtSigned(m)})`;
    return `${fmtSigned(a)} to ${fmtSigned(b)}${mtxt}`;
  };

  els.riskMarginBand.textContent = fmtBand(lo, hi, mid);

  const span = (lo == null || hi == null || !isFinite(lo) || !isFinite(hi)) ? null : Math.abs(hi - lo);
  let volClass = "—";
  if (span != null && isFinite(span)){
    if (span <= 2) volClass = "Low";
    else if (span <= 5) volClass = "Medium";
    else volClass = "High";
  }
  els.riskVolatility.textContent = (span == null || !isFinite(span)) ? "—" : `${volClass} (±${(span/2).toFixed(1)} pts)`;

  const dir = (p >= 0.5) ? "win" : "loss";
  const volHigh = (volClass === "High");

  let band = "Volatile";
  let cls = "bad";
  if (!volHigh && p >= 0.75){
    band = "High confidence";
    cls = "ok";
  } else if (!volHigh && p >= 0.60){
    band = "Lean";
    cls = "warn";
  }

  setTag(band, cls);

  const marginLine = (mid == null || !isFinite(mid))
    ? ""
    : `Expected margin (p50): ${fmtSigned(mid)}.`;

  let plain = "";
  if (band === "High confidence"){
    plain = `Model indicates ${(p*100).toFixed(0)}% chance to ${dir}. ${marginLine} Volatility: ${volClass}.`;
  } else if (band === "Lean"){
    plain = `Leaning ${dir}: ${(p*100).toFixed(0)}% model win chance. ${marginLine} Volatility: ${volClass}.`;
  } else {
    plain = `Volatile outlook: ${(p*100).toFixed(0)}% model win chance. Small changes in execution or assumptions can swing outcomes. ${marginLine} Volatility: ${volClass}.`;
  }

  setBanner(plain, cls);
}

function renderBottleneckAttributionE3(res, weeks){
  if (!els.bneckTag || !els.bneckPrimary || !els.bneckSecondary || !els.bneckTbody || !els.bneckWarn) return;

  const clear = () => { els.bneckTbody.innerHTML = ""; };
  const stub = () => {
    clear();
    els.bneckTbody.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="muted">—</td></tr>';
  };

  const setWarn = (t) => {
    els.bneckWarn.textContent = t || "";
    els.bneckWarn.style.display = t ? "block" : "none";
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

  const tlOn = !!state.optimizer?.tlConstrainedEnabled;
  const timelineEnabled = !!state.timelineEnabled;
  if (!tlOn || !timelineEnabled){
    els.bneckTag.textContent = "—";
    els.bneckTag.classList.remove("ok","warn","bad");
    els.bneckPrimary.textContent = state.ui?.lastDiagnostics?.primaryBottleneck || "—";
    els.bneckSecondary.textContent = state.ui?.lastDiagnostics?.secondaryNotes || "—";
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

  const opt = state.optimizer || {};
  const budget = state.budget || {};
  const tactics = engine.buildOptimizationTactics({ baseRates: { cr, sr, tr }, tactics: budget.tactics || {} });

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
    const objective = opt.objective || "net";

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
      goalNetVotes: needVotes
    };
    return { out: engine.optimizeTimelineConstrained(inputs), maxAttemptsByTactic };
  };

  const baseBudget = safeNum(opt.budgetAmount) ?? 0;
  const base = computeTl({ tacticsIn: tactics, capsIn: capsInputBase, budgetLimitIn: baseBudget });
  const baseMeta = base.out?.meta || {};
  const baseMax = safeNum(baseMeta.maxAchievableNetVotes) ?? null;

  const ps = computePrimarySecondary({ maxAttemptsByTactic: base.maxAttemptsByTactic || null });
  els.bneckPrimary.textContent = ps.primary;
  els.bneckSecondary.textContent = ps.secondary;

  const bindingObj = baseMeta.bindingObj || state.ui?.lastTlMeta?.bindingObj || {};
  const badgeCls = (bindingObj?.budget || bindingObj?.capacity || (Array.isArray(bindingObj?.timeline) && bindingObj.timeline.length)) ? "warn" : "ok";
  els.bneckTag.textContent = badgeCls === "ok" ? "Clear" : "Binding";
  els.bneckTag.classList.remove("ok","warn","bad");
  els.bneckTag.classList.add(badgeCls);

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
    const m = safeNum(out.out?.meta?.maxAchievableNetVotes) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: "timeline capacity (staff hours/week)" };
  })();

  const volHours10 = (() => {
    const c = structuredClone(capsInputBase);
    const cur = safeNum(c.staffing?.volunteerHours) ?? 0;
    c.staffing.volunteerHours = cur * 1.10;
    const out = computeTl({ tacticsIn: tactics, capsIn: c, budgetLimitIn: baseBudget });
    const m = safeNum(out.out?.meta?.maxAchievableNetVotes) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: "volunteer hours/week" };
  })();

  const budget10 = (() => {
    if ((opt.mode || "budget") === "capacity") return { delta: null, notes: "budget not active (capacity mode)" };
    const out = computeTl({ tacticsIn: tactics, capsIn: capsInputBase, budgetLimitIn: baseBudget * 1.10 });
    const m = safeNum(out.out?.meta?.maxAchievableNetVotes) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: "budget ceiling" };
  })();

  const contactRate10 = (() => {
    const curPct = safeNum(state.contactRatePct);
    if (curPct == null) return { delta: null, notes: "contact rate missing" };
    const nextPct = clamp(curPct * 1.10, 0, 100);
    const t2 = engine.buildOptimizationTactics({ baseRates: { cr: clamp(nextPct,0,100)/100, sr, tr }, tactics: budget.tactics || {} });
    const out = computeTl({ tacticsIn: t2, capsIn: capsInputBase, budgetLimitIn: baseBudget });
    const m = safeNum(out.out?.meta?.maxAchievableNetVotes) ?? null;
    return { delta: (m != null && baseMax != null) ? (m - baseMax) : null, notes: `contact rate ${curPct.toFixed(1)}% → ${nextPct.toFixed(1)}%` };
  })();

  clear();
  els.bneckTbody.appendChild(buildRow("Timeline capacity", staffHours10.delta, staffHours10.notes));
  els.bneckTbody.appendChild(buildRow("Budget ceiling", budget10.delta, budget10.notes));
  els.bneckTbody.appendChild(buildRow("Contact rate", contactRate10.delta, contactRate10.notes));
  els.bneckTbody.appendChild(buildRow("Volunteer hours", volHours10.delta, volHours10.notes));
 }

function renderSensitivitySnapshotE4(){
  if (!els.sensTag || !els.sensTbody || !els.sensBanner || !els.btnSensRun) return;

  const stub = (msg, cls) => {
    els.sensTbody.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td></tr>';
    els.sensTag.textContent = "—";
    els.sensTag.classList.remove("ok","warn","bad");
    els.sensBanner.className = `banner ${cls || ""}`.trim();
    els.sensBanner.textContent = msg || "—";
  };

  const base = state.mcLast;
  if (!base){
    stub("Run Monte Carlo to enable the sensitivity snapshot.", "warn");
    els.btnSensRun.disabled = true;
    return;
  }

  els.btnSensRun.disabled = false;

  const cache = state.ui?.e4Sensitivity;
  if (!cache || cache.baseHash !== state.mcLastHash || !Array.isArray(cache.rows) || cache.rows.length === 0){
    stub("Click \"Run snapshot\" to compute small perturbation deltas (read-only).", "");
    return;
  }

  els.sensTbody.innerHTML = "";
  for (const r of cache.rows){
    const tr = document.createElement("tr");
    const td0 = document.createElement("td"); td0.textContent = r.label || "—";
    const td1 = document.createElement("td"); td1.className = "num"; td1.textContent = r.dWin || "—";
    const td2 = document.createElement("td"); td2.className = "num"; td2.textContent = r.dP50 || "—";
    const td3 = document.createElement("td"); td3.className = "muted"; td3.textContent = r.note || "";
    tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    els.sensTbody.appendChild(tr);
  }

  const tag = cache.tag || "Snapshot";
  els.sensTag.textContent = tag;
  els.sensTag.classList.remove("ok","warn","bad");
  if (cache.cls) els.sensTag.classList.add(cache.cls);

  els.sensBanner.className = `banner ${cache.cls || ""}`.trim();
  els.sensBanner.textContent = cache.banner || "—";
}

function renderDecisionConfidenceE5(res, weeks){
  if (!els.confTag || !els.confExec || !els.confRisk || !els.confTight || !els.confDiv || !els.confBanner) return;

  const setTag = (cls, text) => {
    els.confTag.classList.remove("ok","warn","bad");
    if (cls) els.confTag.classList.add(cls);
    els.confTag.textContent = text || "—";
  };

  const setBanner = (cls, text) => {
    els.confBanner.className = `banner ${cls || ""}`.trim();
    els.confBanner.textContent = text || "—";
  };

  const computeExec = () => {
    const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : [];
    const sorted = [...log].map(normalizeDailyLogEntry).filter(Boolean).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const last7 = sorted.slice(-7);
    const actual7 = last7.reduce((s,e)=> s + (safeNum(e.attempts) ?? 0), 0);

    const rawGoal = safeNum(state.goalSupportIds);
    const autoGoal = safeNum(res?.expected?.persuasionNeed);
    const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

    const eff = getEffectiveBaseRates();
    const sr = eff.sr;
    const cr = eff.cr;

    let attemptsPerWeekReq = null;
    if (goal > 0 && sr && sr > 0 && cr && cr > 0 && weeks != null && weeks > 0){
      const convosNeeded = goal / sr;
      const attemptsNeeded = convosNeeded / cr;
      attemptsPerWeekReq = attemptsNeeded / weeks;
    }

    const req7 = (attemptsPerWeekReq != null) ? (attemptsPerWeekReq) : null;
    const pct = (req7 != null && req7 > 0) ? ((actual7 - req7) / req7) : null;
    const absPct = (pct != null) ? Math.abs(pct) : null;

    let status = "unknown";
    if (absPct != null){
      if (absPct <= 0.05) status = "green";
      else if (absPct <= 0.15) status = "yellow";
      else status = "red";
    }
    return { status, pct, req: req7, actual7 };
  };

  const computeRisk = () => {
    const mc = state.mcLast;
    if (!mc) return { band: "unknown", vol: null, winProb: null };
    const p = (mc.winProb != null) ? clamp(Number(mc.winProb), 0, 1) : null;

    const env = mc.confidenceEnvelope?.percentiles || null;
    const lo = (env?.p10 != null) ? Number(env.p10)
      : (env?.p5 != null) ? Number(env.p5)
      : null;
    const hi = (env?.p90 != null) ? Number(env.p90)
      : (env?.p95 != null) ? Number(env.p95)
      : null;
    const width = (lo != null && hi != null && isFinite(lo) && isFinite(hi)) ? (hi - lo) : null;

    const band = (() => {
      if (p == null) return "unknown";
      if (p >= 0.70 && (width == null || width <= 8)) return "high";
      if (p >= 0.55 && (width == null || width <= 14)) return "lean";
      return "volatile";
    })();

    return { band, vol: width, winProb: p };
  };

  const computeTightness = () => {
    const bindingObj = state.ui?.lastTlMeta?.bindingObj || null;
    if (!bindingObj || typeof bindingObj !== "object") return { cls: "", label: "—" };
    const b = [];
    if (bindingObj.budget) b.push("budget");
    if (bindingObj.capacity) b.push("capacity");
    if (Array.isArray(bindingObj.timeline) && bindingObj.timeline.length) b.push("timeline");
    if (!b.length) return { cls: "ok", label: "Clear" };
    if (b.length === 1) return { cls: "warn", label: "Binding" };
    return { cls: "bad", label: "Severe" };
  };

  const computeDivergence = () => {
    ensureScenarioRegistry();
    const reg = state.ui.scenarios;
    const activeId = state.ui.activeScenarioId;
    if (!activeId || activeId === SCENARIO_BASELINE_ID) return { cls: "ok", label: "Low" };

    const baseRec = reg?.[SCENARIO_BASELINE_ID] || null;
    if (!baseRec) return { cls: "", label: "—" };

    const baseInputs = scenarioClone(baseRec.inputs || {});
    const actInputs = scenarioInputsFromState(state);

    const keyOrder = [
      "raceType","mode","electionDate","weeksRemaining",
      "universeBasis","universeSize",
      "goalSupportIds","supportRatePct","contactRatePct","turnoutReliabilityPct",
      "universeLayerEnabled","universeDemPct","universeRepPct","universeNpaPct","universeOtherPct","retentionFactor",
      "orgCount","orgHoursPerWeek","volunteerMultBase","channelDoorPct","doorsPerHour3","callsPerHour3",
      "timelineEnabled","timelineStaffCount","timelineVolCount","timelineStaffHours","timelineVolHours","timelineDoorsPerHour","timelineCallsPerHour","timelineTextsPerHour","timelineDoorSharePct","timelineActiveWeeks","timelineGotvWeeks"
    ];

    let diff = 0;
    for (const k of keyOrder){
      const a = baseInputs?.[k];
      const b = actInputs?.[k];
      const same = (a === b) || (String(a ?? "") === String(b ?? ""));
      if (!same) diff++;
    }

    if (diff <= 3) return { cls: "ok", label: "Low" };
    if (diff <= 8) return { cls: "warn", label: "Moderate" };
    return { cls: "bad", label: "High" };
  };

  const exec = computeExec();
  const risk = computeRisk();
  const tight = computeTightness();
  const div = computeDivergence();

  const execLabel = exec.status === "green" ? "On pace" : exec.status === "yellow" ? "Drifting" : exec.status === "red" ? "Off pace" : "—";
  els.confExec.textContent = execLabel;

  const riskLabel = risk.band === "high" ? "High confidence" : risk.band === "lean" ? "Lean" : risk.band === "volatile" ? "Volatile" : "—";
  els.confRisk.textContent = riskLabel;

  els.confTight.textContent = tight.label || "—";
  els.confDiv.textContent = div.label || "—";

  const scorePiece = (kind) => {
    if (kind === "exec"){
      if (exec.status === "green") return 25;
      if (exec.status === "yellow") return 15;
      if (exec.status === "red") return 5;
      return 10;
    }
    if (kind === "risk"){
      if (risk.band === "high") return 25;
      if (risk.band === "lean") return 15;
      if (risk.band === "volatile") return 5;
      return 10;
    }
    if (kind === "tight"){
      if (tight.label === "Clear") return 25;
      if (tight.label === "Binding") return 15;
      if (tight.label === "Severe") return 5;
      return 10;
    }
    if (kind === "div"){
      if (div.label === "Low") return 25;
      if (div.label === "Moderate") return 15;
      if (div.label === "High") return 5;
      return 10;
    }
    return 0;
  };

  const score = scorePiece("exec") + scorePiece("risk") + scorePiece("tight") + scorePiece("div");
  const rating = (score >= 80) ? "Strong" : (score >= 50) ? "Moderate" : "Low";
  const cls = (rating === "Strong") ? "ok" : (rating === "Moderate") ? "warn" : "bad";

  setTag(cls, `${rating}`);

  const slips = (() => {
    if (exec.pct == null || exec.req == null || exec.req <= 0) return null;
    const perWeekActual = exec.actual7;
    const perWeekReq = exec.req;
    if (!isFinite(perWeekActual) || !isFinite(perWeekReq) || perWeekActual <= 0) return null;
    const factor = perWeekReq / perWeekActual;
    const extraWeeks = (factor - 1) * (weeks ?? 0);
    if (!isFinite(extraWeeks)) return null;
    const days = Math.max(0, Math.round(extraWeeks * 7));
    return days;
  })();

  const driverLines = [];
  if (exec.status === "red") driverLines.push("Execution pace is off required weekly pace.");
  else if (exec.status === "yellow") driverLines.push("Execution pace is drifting from required weekly pace.");

  if (risk.band === "volatile") driverLines.push("Monte Carlo outputs are volatile.");
  else if (risk.band === "lean") driverLines.push("Win probability is lean rather than secure.");

  if (tight.label === "Severe") driverLines.push("Multiple constraints are binding simultaneously.");
  else if (tight.label === "Binding") driverLines.push("At least one constraint is binding.");

  if (div.label === "High") driverLines.push("Active scenario diverges meaningfully from baseline.");
  else if (div.label === "Moderate") driverLines.push("Active scenario differs from baseline in several assumptions.");

  const slipText = (slips != null && slips > 0) ? `If pace holds, target slips by ~${fmtInt(slips)} days.` : null;
  if (slipText) driverLines.unshift(slipText);

  const banner = driverLines.length ? driverLines.slice(0, 3).join(" ") : "Confidence combines pace, risk, constraints, and scenario divergence.";
  setBanner(cls, banner);
}

function renderOpsEnvelopeD2(res, weeks){
  if (!els.opsAttP10 && !els.opsConP10) return;

  const clear = () => {
    if (els.opsAttP10) els.opsAttP10.textContent = "—";
    if (els.opsAttP50) els.opsAttP50.textContent = "—";
    if (els.opsAttP90) els.opsAttP90.textContent = "—";
    if (els.opsConP10) els.opsConP10.textContent = "—";
    if (els.opsConP50) els.opsConP50.textContent = "—";
    if (els.opsConP90) els.opsConP90.textContent = "—";
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashOpsEnvelopeInputs(res, weeks);
  const cached = (state.ui && state.ui.opsEnvelope && typeof state.ui.opsEnvelope === "object") ? state.ui.opsEnvelope : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeOpsEnvelopeD2(res, weeks);
    if (!env){
      clear();
      return;
    }
    setUI((ui) => {
      ui.opsEnvelope = { hash: h, env, computedAt: new Date().toISOString() };
    }, { render: false });
  }

  const fmt = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.round(v));

  if (els.opsAttP10) els.opsAttP10.textContent = fmt(env.attempts.p10);
  if (els.opsAttP50) els.opsAttP50.textContent = fmt(env.attempts.p50);
  if (els.opsAttP90) els.opsAttP90.textContent = fmt(env.attempts.p90);
  if (els.opsConP10) els.opsConP10.textContent = fmt(env.convos.p10);
  if (els.opsConP50) els.opsConP50.textContent = fmt(env.convos.p50);
  if (els.opsConP90) els.opsConP90.textContent = fmt(env.convos.p90);
}

function renderFinishEnvelopeD3(res, weeks){
  if (!els.opsFinishP10 && !els.opsFinishP50 && !els.opsFinishP90) return;

  const clear = () => {
    if (els.opsFinishP10) els.opsFinishP10.textContent = "—";
    if (els.opsFinishP50) els.opsFinishP50.textContent = "—";
    if (els.opsFinishP90) els.opsFinishP90.textContent = "—";
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashFinishEnvelopeInputs(res, weeks);
  const cached = (state.ui && state.ui.finishEnvelope && typeof state.ui.finishEnvelope === "object") ? state.ui.finishEnvelope : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeFinishEnvelopeD3(res, weeks);
    if (!env){
      clear();
      return;
    }
    setUI((ui) => {
      ui.finishEnvelope = { hash: h, env, computedAt: new Date().toISOString() };
    }, { render: false });
  }

  const base = new Date();
  const fmt = (days) => {
    if (days == null || !isFinite(days)) return "—";
    const dt = new Date(base.getTime() + Math.round(days) * 24*3600*1000);
    return fmtISODate(dt);
  };

  if (els.opsFinishP10) els.opsFinishP10.textContent = fmt(env.p10Days);
  if (els.opsFinishP50) els.opsFinishP50.textContent = fmt(env.p50Days);
  if (els.opsFinishP90) els.opsFinishP90.textContent = fmt(env.p90Days);
}

function renderMissRiskD4(res, weeks){
  if (!els.opsMissProb && !els.opsMissTag) return;

  const clear = () => {
    if (els.opsMissProb) els.opsMissProb.textContent = "—";
    if (els.opsMissTag){
      els.opsMissTag.textContent = "—";
      els.opsMissTag.classList.remove("ok","warn","bad");
    }
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashMissRiskInputs(res, weeks);
  const cached = (state.ui && state.ui.missRiskD4 && typeof state.ui.missRiskD4 === "object") ? state.ui.missRiskD4 : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeMissRiskD4(res, weeks);
    if (!env){
      clear();
      return;
    }
    setUI((ui) => {
      ui.missRiskD4 = { hash: h, env, computedAt: new Date().toISOString() };
    }, { render: false });
  }

  const prob = env.prob;
  const pct = (prob == null || !isFinite(prob)) ? "—" : `${(prob * 100).toFixed(1)}%`;

  if (els.opsMissProb) els.opsMissProb.textContent = pct;

  if (els.opsMissTag){
    let label = "Low";
    let cls = "ok";
    if (prob >= 0.60){
      label = "High";
      cls = "bad";
    } else if (prob >= 0.30){
      label = "Moderate";
      cls = "warn";
    }
    els.opsMissTag.textContent = label;
    els.opsMissTag.classList.remove("ok","warn","bad");
    els.opsMissTag.classList.add(cls);
  }
}

function renderDecisionSessionD1(){
  if (!els.decisionSessionSelect && !els.decisionActiveLabel) return;
  ensureDecisionScaffold();
  const sessions = listDecisionSessions();
  const activeId = state.ui.decision.activeSessionId;
  const active = getActiveDecisionSession();
  ensureDecisionSessionShape(active);

  if (els.decisionSessionSelect){
    els.decisionSessionSelect.innerHTML = "";
    for (const s of sessions){
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      els.decisionSessionSelect.appendChild(opt);
    }
    els.decisionSessionSelect.value = activeId;
  }

  if (els.decisionActiveLabel){
    els.decisionActiveLabel.textContent = active ? `Active session: ${active.name || active.id}` : "Active session: —";
  }

  if (els.decisionRename){
    els.decisionRename.value = active?.name || "";
  }

  if (els.decisionObjective){
    els.decisionObjective.innerHTML = "";
    for (const o of OBJECTIVE_TEMPLATES){
      const opt = document.createElement("option");
      opt.value = o.key;
      opt.textContent = o.label;
      els.decisionObjective.appendChild(opt);
    }
    els.decisionObjective.value = active?.objectiveKey || OBJECTIVE_TEMPLATES[0].key;
  }

  if (els.decisionNotes){
    els.decisionNotes.value = active?.notes || "";
  }


  if (els.decisionBudget){
    const v = active?.constraints?.budget;
    els.decisionBudget.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionVolunteerHrs){
    const v = active?.constraints?.volunteerHrs;
    els.decisionVolunteerHrs.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionTurfAccess){
    els.decisionTurfAccess.value = String(active?.constraints?.turfAccess || "");
  }

  if (els.decisionBlackoutDates){
    els.decisionBlackoutDates.value = String(active?.constraints?.blackoutDates || "");
  }

  if (els.decisionRiskPosture){
    if (!els.decisionRiskPosture.options.length){
      for (const rp of RISK_POSTURES){
        const opt = document.createElement("option");
        opt.value = rp.key;
        opt.textContent = rp.label;
        els.decisionRiskPosture.appendChild(opt);
      }
    }
    els.decisionRiskPosture.value = String(active?.riskPosture || "balanced");
  }

  if (els.decisionNonNegotiables){
    const lines = Array.isArray(active?.nonNegotiables) ? active.nonNegotiables : [];
    els.decisionNonNegotiables.value = lines.join("\n");
  }

  if (els.decisionScenarioLabel){
    els.decisionScenarioLabel.textContent = decisionScenarioLabel(active?.scenarioId || null);
  }

  if (els.btnDecisionDelete){
    els.btnDecisionDelete.disabled = sessions.length <= 1;
  }


  renderDecisionOptionsD3(active);
  renderDecisionSummaryD4(active);
}

function renderDecisionOptionsD3(session){
  if (!els.decisionOptionSelect) return;
  if (!session) return;

  ensureDecisionSessionShape(session);

  const options = listDecisionOptions(session);
  const active = getActiveDecisionOption(session);

  els.decisionOptionSelect.innerHTML = "";
  if (!options.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No options yet";
    els.decisionOptionSelect.appendChild(opt);
    els.decisionOptionSelect.value = "";
  } else {
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label || o.id;
      els.decisionOptionSelect.appendChild(opt);
    }
    els.decisionOptionSelect.value = session.activeOptionId || options[0].id;
    if (!session.activeOptionId) session.activeOptionId = els.decisionOptionSelect.value;
  }

  const has = !!active;

  if (els.decisionOptionRename){
    els.decisionOptionRename.value = has ? String(active.label || "") : "";
    els.decisionOptionRename.disabled = !has;
  }

  if (els.btnDecisionOptionRenameSave) els.btnDecisionOptionRenameSave.disabled = !has;
  if (els.btnDecisionOptionDelete) els.btnDecisionOptionDelete.disabled = options.length <= 1;
  if (els.btnDecisionOptionLinkScenario) els.btnDecisionOptionLinkScenario.disabled = !has;

  if (els.decisionOptionScenarioLabel){
    els.decisionOptionScenarioLabel.textContent = has ? decisionScenarioLabel(active.scenarioId || null) : "—";
  }

  const t = has ? (active.tactics || {}) : {};
  if (els.decisionOptionTacticDoors){
    els.decisionOptionTacticDoors.checked = !!t.doors;
    els.decisionOptionTacticDoors.disabled = !has;
  }
  if (els.decisionOptionTacticPhones){
    els.decisionOptionTacticPhones.checked = !!t.phones;
    els.decisionOptionTacticPhones.disabled = !has;
  }
  if (els.decisionOptionTacticDigital){
    els.decisionOptionTacticDigital.checked = !!t.digital;
    els.decisionOptionTacticDigital.disabled = !has;
  }
}

function renderDecisionSummaryD4(session){
  const s = session || getActiveDecisionSession();
  if (!s) return;

  if (els.decisionRecommendSelect){
    els.decisionRecommendSelect.innerHTML = "";
    const options = (s.options && typeof s.options === "object") ? Object.values(s.options) : [];
    options.sort((a,b) => String(a?.createdAt||"").localeCompare(String(b?.createdAt||"")));
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "—";
    els.decisionRecommendSelect.appendChild(ph);
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = decisionOptionDisplay(o);
      els.decisionRecommendSelect.appendChild(opt);
    }
    els.decisionRecommendSelect.value = s.recommendedOptionId || "";
  }

  if (els.decisionWhatTrue){
    const lines = Array.isArray(s.whatNeedsTrue) ? s.whatNeedsTrue : [];
    els.decisionWhatTrue.value = lines.join("\n");
  }

  if (els.decisionSummaryPreview){
    els.decisionSummaryPreview.value = buildDecisionSummaryText(s);
  }
}

function renderMcResults(summary){
  if (!els.mcWinProb) return;

  if (summary.winProbTurnoutAdjusted != null && summary.winProbTurnoutAdjusted !== summary.winProb){
    els.mcWinProb.textContent = `${(summary.winProb * 100).toFixed(1)}% (TA: ${(summary.winProbTurnoutAdjusted * 100).toFixed(1)}%)`;
  } else {
    els.mcWinProb.textContent = `${(summary.winProb * 100).toFixed(1)}%`;
  }
  els.mcMedian.textContent = fmtSigned(summary.median);
  els.mcP5.textContent = fmtSigned(summary.p5);
  els.mcP95.textContent = fmtSigned(summary.p95);

  // Phase 14 — Confidence Envelope
  if (summary.confidenceEnvelope){
    const ce = summary.confidenceEnvelope;
    if (els.mcP10) els.mcP10.textContent = fmtSigned(ce.percentiles?.p10);
    if (els.mcP50) els.mcP50.textContent = fmtSigned(ce.percentiles?.p50);
    if (els.mcP90) els.mcP90.textContent = fmtSigned(ce.percentiles?.p90);
    if (els.mcMoS) els.mcMoS.textContent = fmtSigned(ce.risk?.marginOfSafety);
    if (els.mcDownside) els.mcDownside.textContent = `${((ce.risk?.downsideRiskMass ?? 0) * 100).toFixed(1)}%`;
    if (els.mcES10) els.mcES10.textContent = fmtSigned(ce.risk?.expectedShortfall10);
    if (els.mcShiftP50) els.mcShiftP50.textContent = fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP50 ?? 0));
    if (els.mcShiftP10) els.mcShiftP10.textContent = fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP10 ?? 0));
    if (els.mcFragility) els.mcFragility.textContent = (ce.risk?.fragility?.fragilityIndex ?? 0).toFixed(3);
    if (els.mcCliff) els.mcCliff.textContent = `${((ce.risk?.fragility?.cliffRisk ?? 0) * 100).toFixed(1)}%`;
    // Phase 14.1 extras
    if (els.mcRiskGrade) els.mcRiskGrade.textContent = ce.risk?.advisor?.grade || "—";
    if (els.mcShift60) els.mcShift60.textContent = fmtInt(Math.round(ce.risk?.targets?.shiftWin60 ?? 0));
    if (els.mcShift70) els.mcShift70.textContent = fmtInt(Math.round(ce.risk?.targets?.shiftWin70 ?? 0));
    if (els.mcShift80) els.mcShift80.textContent = fmtInt(Math.round(ce.risk?.targets?.shiftWin80 ?? 0));
    if (els.mcShock10) els.mcShock10.textContent = `${((ce.risk?.shocks?.lossProb10 ?? 0) * 100).toFixed(1)}%`;
    if (els.mcShock25) els.mcShock25.textContent = `${((ce.risk?.shocks?.lossProb25 ?? 0) * 100).toFixed(1)}%`;
    if (els.mcShock50) els.mcShock50.textContent = `${((ce.risk?.shocks?.lossProb50 ?? 0) * 100).toFixed(1)}%`;
  }


  if (els.mcRiskLabel){
    let extra = "";
    if (summary.turnoutAdjusted){
      extra = ` | TA votes (p50): ${fmtInt(Math.round(summary.turnoutAdjusted.p50))}`;
    }
        const ceNote = summary.confidenceEnvelope?.risk?.advisor?.narrative;
    const label = ceNote ? ceNote : summary.riskLabel;
    els.mcRiskLabel.textContent = `${label} — Need: ${fmtInt(Math.round(summary.needVotes))} net persuasion votes.${extra}`;
  }

  if (els.mcSensitivity){
    els.mcSensitivity.innerHTML = "";
    summary.sensitivity.forEach(row => {
      const tr = document.createElement("tr");
      const tdA = document.createElement("td");
      tdA.textContent = row.label;
      const tdB = document.createElement("td");
      tdB.className = "num";
      tdB.textContent = row.impact == null ? "—" : row.impact.toFixed(2);
      tr.appendChild(tdA);
      tr.appendChild(tdB);
      els.mcSensitivity.appendChild(tr);
    });
  }

  // Lightweight visuals
  renderMcVisuals(summary);
}

function renderMcVisuals(summary){
  // Win probability bar
  if (els.svgWinProbMarker && els.vizWinProbNote){
    const p = clamp(summary?.winProb ?? 0, 0, 1);
    const x = 300 * p;
    els.svgWinProbMarker.setAttribute("cx", x.toFixed(2));
    els.vizWinProbNote.textContent = `${(p * 100).toFixed(1)}% chance to win (model-based).`;
  }

  // Margin distribution histogram
  if (!els.svgMarginBars || !els.svgMarginZero || !els.svgMarginMin || !els.svgMarginMax || !els.svgMarginWinShade) return;
  const h = summary?.histogram;
  els.svgMarginBars.innerHTML = "";
  els.svgMarginWinShade.innerHTML = "";
  if (!h || !h.counts || !h.counts.length || !isFinite(h.min) || !isFinite(h.max)){
    els.svgMarginMin.textContent = "—";
    els.svgMarginMax.textContent = "—";
    els.svgMarginZero.setAttribute("x1", 150);
    els.svgMarginZero.setAttribute("x2", 150);
    return;
  }

  const W = 300;
  const baseY = 76;
  const topY = 12;
  const H = (baseY - topY);
  const counts = h.counts;
  const maxC = Math.max(1, ...counts);
  const n = counts.length;
  const bw = W / n;

  const span = (h.max - h.min) || 1;
  const x0 = clamp(((0 - h.min) / span) * W, 0, W);
  els.svgMarginZero.setAttribute("x1", x0.toFixed(2));
  els.svgMarginZero.setAttribute("x2", x0.toFixed(2));

  // Shade the win side (right of zero) when it falls inside the plotted range
  if (x0 > 0 && x0 < W){
    const shade = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shade.setAttribute("x", x0.toFixed(2));
    shade.setAttribute("y", topY);
    shade.setAttribute("width", (W - x0).toFixed(2));
    shade.setAttribute("height", H);
    shade.setAttribute("class", "viz-winshade");
    els.svgMarginWinShade.appendChild(shade);
  }

  for (let i=0;i<n;i++){
    const c = counts[i];
    const bh = (c / maxC) * H;
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", (i * bw + 0.6).toFixed(2));
    r.setAttribute("y", (baseY - bh).toFixed(2));
    r.setAttribute("width", Math.max(0.5, bw - 1.2).toFixed(2));
    r.setAttribute("height", bh.toFixed(2));
    r.setAttribute("class", "viz-bar");
    els.svgMarginBars.appendChild(r);
  }

  els.svgMarginMin.textContent = fmtSigned(h.min);
  els.svgMarginMax.textContent = fmtSigned(h.max);
}

function renderMcFreshness(res, weeks){
  if (!els.mcFreshTag && !els.mcLastRun && !els.mcStale) return;

  const has = !!state.mcLast;
  const meta = (state.ui && state.ui.mcMeta && typeof state.ui.mcMeta === "object") ? state.ui.mcMeta : null;

  if (els.mcRerun) els.mcRerun.disabled = !has;

  if (!has){
    if (els.mcFreshTag){
      els.mcFreshTag.textContent = "Not run";
      els.mcFreshTag.classList.remove("ok","warn","bad");
      els.mcFreshTag.classList.add("warn");
    }
    if (els.mcLastRun) els.mcLastRun.textContent = "Last run: —";
    if (els.mcStale) els.mcStale.hidden = true;
    return;
  }

  const hNow = hashMcInputs(res, weeks);
  const inputsAtRun = meta && meta.inputsHash ? String(meta.inputsHash) : String(state.mcLastHash || "");
  const logAtRun = meta && meta.dailyLogHash ? String(meta.dailyLogHash) : "";
  const logNow = computeDailyLogHash();

  const staleInputs = !!inputsAtRun && inputsAtRun !== hNow;
  const staleLog = !!logAtRun && logAtRun !== logNow;

  let status = "Fresh";
  let cls = "ok";
  if (staleInputs){
    status = "Stale: inputs changed";
    cls = "warn";
  } else if (staleLog){
    status = "Stale: execution updated";
    cls = "warn";
  }

  if (els.mcFreshTag){
    els.mcFreshTag.textContent = status;
    els.mcFreshTag.classList.remove("ok","warn","bad");
    els.mcFreshTag.classList.add(cls);
  }

  if (els.mcLastRun){
    const ts = meta && meta.lastRunAt ? meta.lastRunAt : "";
    els.mcLastRun.textContent = `Last run: ${formatMcTimestamp(ts)}`;
  }

  if (els.mcStale){
    els.mcStale.hidden = !(staleInputs || staleLog);
  }

  renderOpsEnvelopeD2(res, weeks);
  renderFinishEnvelopeD3(res, weeks);
  renderMissRiskD4(res, weeks);
}

export {
  bindRender,
  setRenderState,
  renderAssumptionDriftE1,
  renderRiskFramingE2,
  renderBottleneckAttributionE3,
  renderSensitivitySnapshotE4,
  renderDecisionConfidenceE5,
  renderMcFreshness,
  renderOpsEnvelopeD2,
  renderFinishEnvelopeD3,
  renderMissRiskD4,
  renderDecisionSessionD1,
  renderDecisionOptionsD3,
  renderDecisionSummaryD4,
  renderMcResults,
  renderMcVisuals
};
