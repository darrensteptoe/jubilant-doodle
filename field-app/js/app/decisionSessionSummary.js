export function computeDecisionKeyOutCore(inputs, deps = {}){
  const {
    scenarioClone,
    engine,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
  } = deps || {};
  try{
    const snap = scenarioClone(inputs || {});
    const res = engine.computeAll(snap);
    const weeks = engine.derivedWeeksRemaining({
      weeksRemainingOverride: snap?.weeksRemaining,
      electionDateISO: snap?.electionDate ? `${snap.electionDate}T00:00:00` : "",
    });
    const ctx = computeWeeklyOpsContextFromSnap(snap, res, weeks);
    const finish = targetFinishDateFromSnap(snap, weeks);
    return { weeks, ctx, finish };
  } catch {
    return { weeks: null, ctx: null, finish: null };
  }
}

export function decisionOptionDisplayCore(option){
  if (!option) return "—";
  const label = option.label || option.id;
  const sid = option.scenarioId ? ` · ${option.scenarioId}` : "";
  return label + sid;
}

export function buildDecisionSummaryTextCore(session, deps = {}){
  const {
    ensureScenarioRegistry,
    state,
    SCENARIO_BASELINE_ID,
    scenarioClone,
    engine,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
    fmtISODate,
    OBJECTIVE_TEMPLATES,
    fmtInt,
    safeNum,
    clamp,
  } = deps || {};

  try{
    ensureScenarioRegistry();
    const reg = state?.ui?.scenarios || {};
    const baseline = reg[SCENARIO_BASELINE_ID] || null;

    const s = session || null;
    if (!s || !baseline) return "—";

    const options = (s.options && typeof s.options === "object") ? s.options : {};
    const pickId = s.recommendedOptionId || s.activeOptionId || null;
    const opt = (pickId && options[pickId]) ? options[pickId] : null;

    const baseInputs = scenarioClone(baseline.inputs || {});
    const optScenarioId = opt?.scenarioId || s.scenarioId || state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID;
    const optRec = reg[optScenarioId] || null;
    const optInputs = scenarioClone((optRec?.inputs) || {});

    const coreDeps = { scenarioClone, engine, computeWeeklyOpsContextFromSnap, targetFinishDateFromSnap };
    const baseOut = computeDecisionKeyOutCore(baseInputs, coreDeps);
    const optOut = computeDecisionKeyOutCore(optInputs, coreDeps);

    const fmtNum = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
    const fmtDate = (d) => d ? fmtISODate(d) : "—";
    const deltaNum = (a, b) => (a == null || b == null || !isFinite(a) || !isFinite(b)) ? null : (b - a);

    const bCtx = baseOut.ctx || {};
    const oCtx = optOut.ctx || {};

    const attemptsWBase = bCtx.attemptsPerWeek ?? null;
    const attemptsWOpt = oCtx.attemptsPerWeek ?? null;
    const convosWBase = bCtx.convosPerWeek ?? null;
    const convosWOpt = oCtx.convosPerWeek ?? null;

    const gap = oCtx.gap;
    const gapLine = (gap == null || !isFinite(gap))
      ? "—"
      : (gap <= 0 ? "Executable at current capacity" : `Shortfall: ${fmtInt(Math.ceil(gap))} attempts/week`);

    const doorSharePct = safeNum(optInputs?.channelDoorPct);
    const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct / 100, 0, 1);
    const doorsHr = safeNum(optInputs?.doorsPerHour3);
    const callsHr = safeNum(optInputs?.callsPerHour3);
    const aph = (doorShare != null && doorsHr != null && callsHr != null) ? (doorShare * doorsHr + (1 - doorShare) * callsHr) : null;

    const attemptsPerDay = (attemptsWOpt != null && isFinite(attemptsWOpt)) ? (attemptsWOpt / 7) : null;
    const doorsPerDay = (attemptsPerDay != null && doorShare != null) ? (attemptsPerDay * doorShare) : null;
    const callsPerDay = (attemptsPerDay != null && doorShare != null) ? (attemptsPerDay * (1 - doorShare)) : null;
    const hrsPerWeek = (attemptsWOpt != null && aph != null && aph > 0) ? (attemptsWOpt / aph) : null;

    const tactics = opt?.tactics ? Object.keys(opt.tactics).filter(k => !!opt.tactics[k]) : [];
    const tacticsLine = tactics.length ? tactics.map(k => k.toUpperCase()).join(", ") : "—";

    const whatTrue = Array.isArray(s.whatNeedsTrue) ? s.whatNeedsTrue : [];
    const whatTrueLines = whatTrue.length ? whatTrue.map(x => `- [ ] ${x}`).join("\n") : "- [ ] —";

    const lines = [];
    lines.push(`# Decision Summary: ${s.name || s.id}`);
    lines.push(`Date: ${fmtISODate(new Date(s.createdAt || Date.now()))}`);
    lines.push(`Objective: ${(OBJECTIVE_TEMPLATES.find(x => x.key === s.objectiveKey)?.label) || s.objectiveKey || "—"}`);
    lines.push("");
    lines.push("## Recommendation");
    lines.push(`Recommended option: ${opt ? (opt.label || opt.id) : "—"}`);
    lines.push(`Option scenario: ${optScenarioId}${optRec?.name ? ` (${optRec.name})` : ""}`);
    lines.push(`Tactics tags: ${tacticsLine}`);
    lines.push("");
    lines.push("## Baseline vs Option (key deltas)");
    lines.push(`Attempts/week: ${fmtNum(attemptsWBase)} → ${fmtNum(attemptsWOpt)}${(deltaNum(attemptsWBase, attemptsWOpt) == null || deltaNum(attemptsWBase, attemptsWOpt) === 0) ? "" : ` (${(deltaNum(attemptsWBase, attemptsWOpt) > 0 ? "+" : "")}${fmtInt(Math.round(deltaNum(attemptsWBase, attemptsWOpt)))})`}`);
    lines.push(`Convos/week: ${fmtNum(convosWBase)} → ${fmtNum(convosWOpt)}${(deltaNum(convosWBase, convosWOpt) == null || deltaNum(convosWBase, convosWOpt) === 0) ? "" : ` (${(deltaNum(convosWBase, convosWOpt) > 0 ? "+" : "")}${fmtInt(Math.round(deltaNum(convosWBase, convosWOpt)))})`}`);
    lines.push(`Finish date (target): ${fmtDate(baseOut.finish)} → ${fmtDate(optOut.finish)}`);
    lines.push(`Execution status (this week): ${gapLine}`);
    lines.push("");
    lines.push("## What needs to be true");
    lines.push(whatTrueLines);
    lines.push("");
    lines.push("## Next 7 days (execution plan)");
    if (attemptsWOpt == null || !isFinite(attemptsWOpt)){
      lines.push("- Attempts/week: —");
    } else {
      lines.push(`- Attempts/week: ${fmtInt(Math.ceil(attemptsWOpt))} (~${fmtInt(Math.ceil(attemptsWOpt / 7))}/day)`);
    }
    if (doorsPerDay != null && callsPerDay != null){
      lines.push(`- Daily targets: ${fmtInt(Math.ceil(doorsPerDay))} doors/day · ${fmtInt(Math.ceil(callsPerDay))} calls/day`);
    } else {
      lines.push("- Daily targets: —");
    }
    if (hrsPerWeek != null && isFinite(hrsPerWeek)){
      lines.push(`- Estimated hours/week required: ${fmtInt(Math.ceil(hrsPerWeek))} hrs`);
    } else {
      lines.push("- Estimated hours/week required: —");
    }
    if (Array.isArray(s.nonNegotiables) && s.nonNegotiables.length){
      lines.push("");
      lines.push("## Non-negotiables");
      for (const x of s.nonNegotiables) lines.push(`- ${x}`);
    }

    return lines.join("\n");
  } catch {
    return "—";
  }
}

export function copyTextToClipboardCore(text){
  const s = String(text || "");
  if (!s) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(s).then(() => true).catch(() => false);
  }
  try{
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve(!!ok);
  } catch {
    return Promise.resolve(false);
  }
}

export function decisionSummaryPlainTextCore(markdown){
  const s = String(markdown || "");
  return s
    .replace(/^###\s+/gm, "")
    .replace(/^##\s+/gm, "")
    .replace(/^#\s+/gm, "")
    .replace(/^\-\s+/gm, "• ")
    .replace(/\*\*/g, "");
}

export function decisionSessionExportObjectCore(session, deps = {}){
  const s = session ? structuredClone(session) : null;
  if (!s) return null;
  const buildDecisionSummaryText = deps.buildDecisionSummaryText || (() => "");
  return {
    type: "decision_session",
    exportedAt: new Date().toISOString(),
    activeScenarioId: deps.activeScenarioId || null,
    session: s,
    summaryMarkdown: buildDecisionSummaryText(s),
  };
}

export function downloadJsonObjectCore(obj, filename){
  try{
    const name = String(filename || "decision-session.json");
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch {
    // ignore
  }
}
