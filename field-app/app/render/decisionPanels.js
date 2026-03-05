export function renderDecisionConfidencePanel({
  els,
  state,
  res,
  weeks,
  weeklyContext,
  executionSnapshot,
  deriveNeedVotes,
  normalizeDailyLogEntry,
  safeNum,
  getEffectiveBaseRates,
  clamp,
  ensureScenarioRegistry,
  SCENARIO_BASELINE_ID,
  scenarioClone,
  scenarioInputsFromState,
  fmtInt
}){
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
    if (executionSnapshot?.pace){
      const req7 = executionSnapshot?.pace?.requiredAttemptsPerWeek;
      const actual7 = executionSnapshot?.log?.sumAttemptsWindow;
      const pct = (req7 != null && isFinite(req7) && req7 > 0 && actual7 != null && isFinite(actual7))
        ? ((actual7 - req7) / req7)
        : null;
      const absPct = (pct != null) ? Math.abs(pct) : null;
      let status = "unknown";
      if (absPct != null){
        if (absPct <= 0.05) status = "green";
        else if (absPct <= 0.15) status = "yellow";
        else status = "red";
      }
      return { status, pct, req: req7, actual7 };
    }

    const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : [];
    const sorted = [...log].map(normalizeDailyLogEntry).filter(Boolean).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const last7 = sorted.slice(-7);
    const actual7 = last7.reduce((s,e)=> s + (safeNum(e.attempts) ?? 0), 0);

    const fallbackCtx = weeklyContext || null;
    let attemptsPerWeekReq = fallbackCtx?.attemptsPerWeek ?? null;
    if (!(attemptsPerWeekReq != null && isFinite(attemptsPerWeekReq))){
      const needVotes = (typeof deriveNeedVotes === "function")
        ? deriveNeedVotes(res, state?.goalSupportIds)
        : null;
      const goal = (needVotes != null && needVotes > 0) ? needVotes : 0;
      const eff = getEffectiveBaseRates();
      const sr = eff.sr;
      const cr = eff.cr;
      if (goal > 0 && sr && sr > 0 && cr && cr > 0 && weeks != null && weeks > 0){
        const convosNeeded = goal / sr;
        const attemptsNeeded = convosNeeded / cr;
        attemptsPerWeekReq = attemptsNeeded / weeks;
      }
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
  if (!els.diPrimary || !els.diVolTbody || !els.diCostTbody || !els.diProbTbody) return;

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
    if (!els.diWarn) return;
    if (!msg){
      els.diWarn.hidden = true;
      els.diWarn.textContent = "";
      return;
    }
    els.diWarn.hidden = false;
    els.diWarn.textContent = msg;
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

    setWarn(di?.warning || null);

    if (els.diPrimary) els.diPrimary.textContent = di?.bottlenecks?.primary || "—";
    if (els.diSecondary) els.diSecondary.textContent = di?.bottlenecks?.secondary || "—";
    if (els.diNotBinding){
      const nb = Array.isArray(di?.bottlenecks?.notBinding) ? di.bottlenecks.notBinding : [];
      els.diNotBinding.textContent = nb.length ? nb.join(", ") : "—";
    }

    if (els.diRecVol) els.diRecVol.textContent = di?.recs?.volunteers || "—";
    if (els.diRecCost) els.diRecCost.textContent = di?.recs?.cost || "—";
    if (els.diRecProb) els.diRecProb.textContent = di?.recs?.probability || "—";

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
        td1.textContent = fmt(r?.value);
        tr.appendChild(td0); tr.appendChild(td1);
        tbody.appendChild(tr);
      }
    };

    const fmtSigned = (v, kind) => {
      if (v == null || !Number.isFinite(v)) return "—";
      const sign = (v > 0) ? "+" : "";
      if (kind === "vol") return sign + v.toFixed(2);
      if (kind === "cost") return sign + "$" + fmtInt(Math.round(v));
      if (kind === "prob") return sign + (v*100).toFixed(2) + " pp";
      return sign + String(v);
    };

    fill(els.diVolTbody, di?.rankings?.volunteers, (v)=>fmtSigned(v, "vol"));
    fill(els.diCostTbody, di?.rankings?.cost, (v)=>fmtSigned(v, "cost"));
    fill(els.diProbTbody, di?.rankings?.probability, (v)=>fmtSigned(v, "prob"));

  } catch {
    setWarn("Decision Intelligence failed (panel render error).");
    if (els.diPrimary) els.diPrimary.textContent = "—";
    if (els.diSecondary) els.diSecondary.textContent = "—";
    if (els.diNotBinding) els.diNotBinding.textContent = "—";
    if (els.diRecVol) els.diRecVol.textContent = "—";
    if (els.diRecCost) els.diRecCost.textContent = "—";
    if (els.diRecProb) els.diRecProb.textContent = "—";
    clearTable(els.diVolTbody); stubRow(els.diVolTbody);
    clearTable(els.diCostTbody); stubRow(els.diCostTbody);
    clearTable(els.diProbTbody); stubRow(els.diProbTbody);
  }
}
