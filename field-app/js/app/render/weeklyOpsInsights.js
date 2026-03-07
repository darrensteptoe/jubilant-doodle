// @ts-check
export function renderWeeklyOpsInsightsPanel({
  els,
  state,
  res,
  weeks,
  ctx,
  executionSnapshot,
  computeWeeklyOpsContext,
  fmtInt,
  clamp,
  computeCapacityBreakdown,
  syncWeeklyUndoUI,
  safeCall,
  applyWeeklyLeverScenario,
  computeRealityDrift
}){
  if (!els.wkLeversIntro || !els.wkActionsList || !els.wkBestMovesList || !els.wkLeversTbody) return;

  const opsCtx = ctx || computeWeeklyOpsContext(res, weeks);
  const fmtCeil = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtNum1 = (v) => (v == null || !isFinite(v)) ? "—" : (Number(v).toFixed(1));

  els.wkBestMovesList.innerHTML = "";
  els.wkActionsList.innerHTML = "";
  els.wkLeversTbody.innerHTML = "";

  syncWeeklyUndoUI();

  if (els.wkLeversFoot) els.wkLeversFoot.hidden = false;
  if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = false;

  if (opsCtx.goal <= 0){
    els.wkLeversIntro.textContent = "No operational gap to analyze (goal is 0 under current inputs).";
    addBullet(els.wkActionsList, "Set a goal (Support IDs needed) or adjust win path assumptions to generate a real plan.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }
  if (opsCtx.weeks == null || opsCtx.weeks <= 0){
    els.wkLeversIntro.textContent = "Timeline is missing. Set election date or weeks remaining to compute weekly pressure.";
    addBullet(els.wkActionsList, "Enter an election date (or weeks remaining) so the plan can compute per-week targets.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }
  if (opsCtx.sr == null || opsCtx.sr <= 0 || opsCtx.cr == null || opsCtx.cr <= 0){
    els.wkLeversIntro.textContent = "Rates are missing. Enter Support rate and Contact rate to estimate workload.";
    addBullet(els.wkActionsList, "Fill Support rate (%) and Contact rate (%) in Phase 2.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }
  if (opsCtx.capTotal == null || !isFinite(opsCtx.capTotal)){
    els.wkLeversIntro.textContent = "Capacity inputs are incomplete. Fill Phase 3 execution inputs to compute what is executable.";
    addBullet(els.wkActionsList, "Enter organizers, hours/week, doors/hr, calls/hr, and channel split in Phase 3.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    if (els.wkLeversFoot) els.wkLeversFoot.hidden = true;
    return;
  }

  const baseReq = opsCtx.attemptsPerWeek;
  const baseCap = opsCtx.capTotal;
  const gap = (baseReq != null && baseCap != null) ? Math.max(0, baseReq - baseCap) : null;
  const isGap = (gap != null && gap > 0);

  els.wkLeversIntro.textContent = isGap
    ? `You are short by ~${fmtCeil(gap)} attempts/week. These levers estimate attempts/week relief in consistent units.`
    : "You are currently feasible (capacity covers attempts/week). These levers estimate buffer gained per unit.";

  const capTotal = (p) => {
    const out = computeCapacityBreakdown(p);
    return out?.total;
  };

  const levers = [];

  const push = (x) => {
    if (!x) return;
    if (x.impact == null || !isFinite(x.impact) || x.impact <= 0) return;
    const impactUse = isGap ? Math.min(x.impact, gap) : x.impact;
    const eff = (x.costScalar != null && isFinite(x.costScalar) && x.costScalar > 0) ? (impactUse / x.costScalar) : null;
    levers.push({ ...x, impactUse, eff });
  };

  const baseCapParams = {
    weeks: 1,
    orgCount: opsCtx.orgCount,
    orgHoursPerWeek: opsCtx.orgHoursPerWeek,
    volunteerMult: opsCtx.volunteerMult,
    doorShare: opsCtx.doorShare,
    doorsPerHour: opsCtx.doorsPerHour,
    callsPerHour: opsCtx.callsPerHour,
    capacityDecay: opsCtx.capacityDecay,
  };

  if (opsCtx.orgCount != null && opsCtx.orgHoursPerWeek != null && opsCtx.volunteerMult != null){
    const plusOrg = capTotal({ ...baseCapParams, orgCount: opsCtx.orgCount + 1 });
    if (plusOrg != null && baseCap != null) push({
      kind: "capacity",
      key: "org",
      label: "+1 organizer",
      impact: plusOrg - baseCap,
      costLabel: "1 organizer",
      costScalar: 1,
      effUnit: "per organizer"
    });

    const plusHr = capTotal({ ...baseCapParams, orgHoursPerWeek: opsCtx.orgHoursPerWeek + 1 });
    if (plusHr != null && baseCap != null){
      const addedHours = Math.max(1, opsCtx.orgCount || 1);
      push({
        kind: "capacity",
        key: "orgHr",
        label: "+1 hour/week per organizer",
        impact: plusHr - baseCap,
        costLabel: `+1 hr/org (= ${fmtCeil(addedHours)} org-hrs/wk)`,
        costScalar: addedHours,
        effUnit: "per org-hour"
      });
    }

    const plusVol = capTotal({ ...baseCapParams, volunteerMult: opsCtx.volunteerMult + 0.10 });
    if (plusVol != null && baseCap != null) push({
      kind: "capacity",
      key: "volMult",
      label: "+10% volunteer multiplier",
      impact: plusVol - baseCap,
      costLabel: "+10% volunteer mult",
      costScalar: 0.10,
      effUnit: "per +10% mult"
    });
  }

  if (opsCtx.doorsPerHour != null){
    const plusDoorHr = capTotal({ ...baseCapParams, doorsPerHour: opsCtx.doorsPerHour + 1 });
    if (plusDoorHr != null && baseCap != null) push({
      kind: "capacity",
      key: "dph",
      label: "+1 door/hr",
      impact: plusDoorHr - baseCap,
      costLabel: "+1 door/hr",
      costScalar: 1,
      effUnit: "per +1 door/hr"
    });
  }

  if (opsCtx.callsPerHour != null){
    const plusCallHr = capTotal({ ...baseCapParams, callsPerHour: opsCtx.callsPerHour + 1 });
    if (plusCallHr != null && baseCap != null) push({
      kind: "capacity",
      key: "cph",
      label: "+1 call/hr",
      impact: plusCallHr - baseCap,
      costLabel: "+1 call/hr",
      costScalar: 1,
      effUnit: "per +1 call/hr"
    });
  }

  if (opsCtx.doorShare != null && opsCtx.doorsPerHour != null && opsCtx.callsPerHour != null){
    const doorIsFaster = opsCtx.doorsPerHour >= opsCtx.callsPerHour;
    const shift = 0.10;
    const newShare = clamp(opsCtx.doorShare + (doorIsFaster ? shift : -shift), 0, 1);
    const capShift = capTotal({ ...baseCapParams, doorShare: newShare });
    if (capShift != null && baseCap != null) push({
      kind: "capacity",
      key: "mix",
      label: `Shift mix +10 pts toward ${doorIsFaster ? "doors" : "calls"}`,
      impact: capShift - baseCap,
      costLabel: "10 pts mix shift",
      costScalar: 10,
      effUnit: "per 1 pt"
    });
  }

  const pp = 0.01;
  if (baseReq != null && isFinite(baseReq)){
    const srPlus = Math.min(0.99, opsCtx.sr + pp);
    const crPlus = Math.min(0.99, opsCtx.cr + pp);

    const reqSrPlus = (opsCtx.goal > 0 && srPlus > 0 && opsCtx.cr > 0 && opsCtx.weeks > 0) ? (opsCtx.goal / srPlus / opsCtx.cr / opsCtx.weeks) : null;
    if (reqSrPlus != null) push({
      kind: "rates",
      key: "sr",
      label: "+1 pp support rate",
      impact: baseReq - reqSrPlus,
      costLabel: "+1 pp SR",
      costScalar: 1,
      effUnit: "per +1pp"
    });

    const reqCrPlus = (opsCtx.goal > 0 && crPlus > 0 && opsCtx.sr > 0 && opsCtx.weeks > 0) ? (opsCtx.goal / opsCtx.sr / crPlus / opsCtx.weeks) : null;
    if (reqCrPlus != null) push({
      kind: "rates",
      key: "cr",
      label: "+1 pp contact rate",
      impact: baseReq - reqCrPlus,
      costLabel: "+1 pp CR",
      costScalar: 1,
      effUnit: "per +1pp"
    });

    const wPlus = opsCtx.weeks + 1;
    const reqWPlus = (opsCtx.goal > 0 && opsCtx.sr > 0 && opsCtx.cr > 0 && wPlus > 0) ? (opsCtx.goal / opsCtx.sr / opsCtx.cr / wPlus) : null;
    if (reqWPlus != null) push({
      kind: "timeline",
      key: "weeks",
      label: "+1 week timeline",
      impact: baseReq - reqWPlus,
      costLabel: "+1 week",
      costScalar: 1,
      effUnit: "per week"
    });
  }

  const usable = levers
    .filter(x => x.impactUse != null && isFinite(x.impactUse) && x.impactUse > 0)
    .sort((a,b) => (b.impactUse - a.impactUse));

  if (usable.length === 0){
    addBullet(els.wkActionsList, "No lever estimates available under current inputs.");
    if (els.wkBestMovesIntro) els.wkBestMovesIntro.hidden = true;
    return;
  }

  const bestByEff = [...usable]
    .filter(x => x.eff != null && isFinite(x.eff))
    .sort((a,b) => (b.eff - a.eff) || (b.impactUse - a.impactUse))
    .slice(0, 3);

  for (const l of bestByEff){
    const li = document.createElement("li");
    li.className = "actionItem";
    const span = document.createElement("span");
    span.textContent = `${l.label}: ~${fmtCeil(l.impactUse)} attempts/week (${fmtNum1(l.eff)} ${l.effUnit})`;
    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.type = "button";
    btn.textContent = "Apply";
    btn.addEventListener("click", () => { safeCall(() => { applyWeeklyLeverScenario(l, opsCtx); }); });
    li.appendChild(span);
    li.appendChild(btn);
    els.wkBestMovesList.appendChild(li);
  }

  const rows = usable.slice(0, 10);
  for (const l of rows){
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    const td3 = document.createElement("td");
    const td4 = document.createElement("td");
    const td5 = document.createElement("td");
    td2.className = "num";
    td4.className = "num";
    td1.textContent = l.label;
    td2.textContent = `~${fmtCeil(l.impactUse)}`;
    td3.textContent = l.costLabel || "—";
    td4.textContent = (l.eff == null || !isFinite(l.eff)) ? "—" : `${fmtNum1(l.eff)}`;

    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.type = "button";
    btn.textContent = "Apply";
    btn.addEventListener("click", () => { safeCall(() => { applyWeeklyLeverScenario(l, opsCtx); }); });
    td5.appendChild(btn);

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    els.wkLeversTbody.appendChild(tr);
  }

  const bestCap = usable.filter(x => x.kind === "capacity").sort((a,b) => (b.impactUse - a.impactUse))[0] || null;
  const bestRate = usable.filter(x => x.kind === "rates").sort((a,b) => (b.impactUse - a.impactUse))[0] || null;
  const bestCr = usable.find(x => x.kind === "rates" && x.key === "cr") || null;
  const bestSr = usable.find(x => x.kind === "rates" && x.key === "sr") || null;

  const drift = executionSnapshot
    ? {
        hasLog: !!executionSnapshot?.log?.hasLog,
        flags: Array.isArray(executionSnapshot?.drift?.flags) ? executionSnapshot.drift.flags : [],
        primary: executionSnapshot?.drift?.primary || null,
      }
    : computeRealityDrift();
  const hasDrift = drift?.hasLog && drift?.flags?.length;
  const primary = drift?.primary || null;

  const actions = [];

  if (isGap){
    if (hasDrift){
      if (primary === "productivity"){
        if (bestCap) actions.push(`Reality check shows productivity below assumed. Close the gap by raising execution capacity first: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
        if (bestCr) actions.push(`Then reduce workload by improving contact rate: ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week relief).`);
        else if (bestRate) actions.push(`Then reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      } else if (primary === "contact"){
        if (bestCr) actions.push(`Reality check shows contact rate below assumed. Prioritize: ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week relief).`);
        if (bestCap) actions.push(`If rate lift is slow, backstop with more capacity: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      } else if (primary === "support"){
        if (bestSr) actions.push(`Reality check shows support rate below assumed. Prioritize: ${bestSr.label} (≈ ${fmtCeil(bestSr.impactUse)} attempts/week relief).`);
        if (bestCap) actions.push(`If persuasion lift is slow, backstop with more capacity: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      } else {
        if (bestCap) actions.push(`Close the gap by increasing execution capacity: start with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
        if (bestRate) actions.push(`Reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      }
      actions.push("If actual performance stays below assumptions, either align assumptions to reality (and re-plan) or change inputs to close the gap (capacity, speeds, mix, training).");
    } else {
      if (bestCap) actions.push(`Close the gap by increasing execution capacity: start with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      if (bestRate) actions.push(`Reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      actions.push("If neither is realistic, reduce weekly pressure by extending timeline assumptions (more weeks) or revising the goal (Support IDs needed).");
    }
  } else {
    if (hasDrift){
      if (primary === "productivity" && bestCap) actions.push(`You are feasible, but productivity is below assumed. Add buffer with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week).`);
      if (primary === "contact" && bestCr) actions.push(`You are feasible, but contact rate is below assumed. Improve efficiency with ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week).`);
      if (primary === "support" && bestSr) actions.push(`You are feasible, but support rate is below assumed. Improve efficiency with ${bestSr.label} (≈ ${fmtCeil(bestSr.impactUse)} attempts/week).`);
      if (actions.length === 0 && bestRate) actions.push(`You are feasible, but assumptions are drifting. Consider ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week).`);
      actions.push("Use buffer to absorb volatility, and align assumptions to observed daily log so planning stays honest.");
    } else {
      if (bestCap) actions.push(`Build buffer: ${bestCap.label} adds ≈ ${fmtCeil(bestCap.impactUse)} attempts/week of slack.`);
      if (bestRate) actions.push(`Improve efficiency: ${bestRate.label} reduces required attempts by ≈ ${fmtCeil(bestRate.impactUse)} attempts/week.`);
      actions.push("Use the buffer to absorb volatility (bad weeks, weather, volunteer drop-off) or to front-load early vote chasing.");
    }
  }
  for (const a of actions.slice(0, 4)) addBullet(els.wkActionsList, a);
}

export function renderWeeklyOpsFreshnessPanel({
  els,
  state,
  res,
  weeks,
  ctx,
  executionSnapshot,
  safeNum,
  computeWeeklyOpsContext
}){
  if (!els.wkLastUpdate || !els.wkFreshStatus) return;

  const fInt = (v) => (v == null || !isFinite(v)) ? "—" : (String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  const fPct = (v) => (v == null || !isFinite(v)) ? "—" : ((v * 100).toFixed(1) + "%");
  const fNum1 = (v) => (v == null || !isFinite(v)) ? "—" : (Number(v).toFixed(1));

  const snap = executionSnapshot || null;
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  const hasLog = snap ? !!snap?.log?.hasLog : !!(log && log.length);
  if (!hasLog){
    els.wkLastUpdate.textContent = "—";
    if (els.wkFreshNote) els.wkFreshNote.textContent = "No daily log configured yet";
    if (els.wkRollingAttempts) els.wkRollingAttempts.textContent = "—";
    if (els.wkRollingNote) els.wkRollingNote.textContent = "Add entries in organizer.html to activate reality checks";
    if (els.wkRollingCR) els.wkRollingCR.textContent = "—";
    if (els.wkRollingCRNote) els.wkRollingCRNote.textContent = "—";
    if (els.wkRollingSR) els.wkRollingSR.textContent = "—";
    if (els.wkRollingSRNote) els.wkRollingSRNote.textContent = "—";
    if (els.wkRollingAPH) els.wkRollingAPH.textContent = "—";
    if (els.wkRollingAPHNote) els.wkRollingAPHNote.textContent = "—";
    els.wkFreshStatus.textContent = "Not tracking";
    return;
  }

  const sorted = snap?.log?.sorted || [...log].filter(x => x && x.date).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const last = sorted[sorted.length - 1];
  els.wkLastUpdate.textContent = last?.date || "—";
  if (els.wkFreshNote) els.wkFreshNote.textContent = "Using state.ui.dailyLog";

  const sumAttempts = snap?.log?.sumAttemptsWindow ?? 0;
  const sumConvos = snap?.log?.sumConvosWindow ?? 0;
  const sumSupportIds = snap?.log?.sumSupportIdsWindow ?? 0;
  const sumOrgHours = snap?.log?.sumOrgHoursWindow ?? 0;

  if (els.wkRollingAttempts) els.wkRollingAttempts.textContent = fInt(sumAttempts);

  const actualCR = snap?.rolling?.cr ?? ((sumAttempts > 0) ? (sumConvos / sumAttempts) : null);
  const actualSR = snap?.rolling?.sr ?? ((sumConvos > 0) ? (sumSupportIds / sumConvos) : null);
  const actualAPH = snap?.rolling?.aph ?? ((sumOrgHours > 0) ? (sumAttempts / sumOrgHours) : null);

  if (els.wkRollingCR) els.wkRollingCR.textContent = fPct(actualCR);
  if (els.wkRollingSR) els.wkRollingSR.textContent = fPct(actualSR);
  if (els.wkRollingAPH) els.wkRollingAPH.textContent = fNum1(actualAPH);

  const assumedCR = snap?.assumptions?.cr ?? ((state.contactRatePct != null && state.contactRatePct !== "") ? ((safeNum(state.contactRatePct) || 0) / 100) : null);
  const assumedSR = snap?.assumptions?.sr ?? ((state.supportRatePct != null && state.supportRatePct !== "") ? ((safeNum(state.supportRatePct) || 0) / 100) : null);
  const expectedAPH = snap?.assumptions?.aph ?? (() => {
    const mixDoor = (state.channelDoorPct != null && state.channelDoorPct !== "") ? ((safeNum(state.channelDoorPct) || 0) / 100) : null;
    const doorsHr = (state.doorsPerHour3 != null && state.doorsPerHour3 !== "") ? (safeNum(state.doorsPerHour3) || 0) : null;
    const callsHr = (state.callsPerHour3 != null && state.callsPerHour3 !== "") ? (safeNum(state.callsPerHour3) || 0) : null;
    return (mixDoor != null && doorsHr != null && callsHr != null)
      ? (mixDoor * doorsHr + (1 - mixDoor) * callsHr)
      : null;
  })();

  if (els.wkRollingCRNote){
    if (assumedCR == null) els.wkRollingCRNote.textContent = "Assumed: —";
    else els.wkRollingCRNote.textContent = `Assumed: ${fPct(assumedCR)}`;
  }
  if (els.wkRollingSRNote){
    if (assumedSR == null) els.wkRollingSRNote.textContent = "Assumed: —";
    else els.wkRollingSRNote.textContent = `Assumed: ${fPct(assumedSR)}`;
  }
  if (els.wkRollingAPHNote){
    if (expectedAPH == null) els.wkRollingAPHNote.textContent = "Expected: —";
    else els.wkRollingAPHNote.textContent = `Expected: ${fNum1(expectedAPH)} / hr`;
  }

  const opsCtx = ctx || computeWeeklyOpsContext(res, weeks);
  const req = snap?.pace?.requiredAttemptsPerWeek ?? opsCtx.attemptsPerWeek;
  if (els.wkRollingNote){
    if (req == null || !isFinite(req)) els.wkRollingNote.textContent = "Required attempts/week unavailable under current inputs";
    else els.wkRollingNote.textContent = `Required ≈ ${fInt(Math.ceil(req))} attempts/week`;
  }

  let ratio = snap?.pace?.ratio ?? null;
  if ((ratio == null || !isFinite(ratio)) && req != null && isFinite(req) && req > 0) ratio = sumAttempts / req;

  const flags = [];
  const tol = 0.90;
  if (assumedCR != null && actualCR != null && isFinite(actualCR) && actualCR < assumedCR * tol) flags.push("contact rate below assumed");
  if (assumedSR != null && actualSR != null && isFinite(actualSR) && actualSR < assumedSR * tol) flags.push("support rate below assumed");
  if (expectedAPH != null && actualAPH != null && isFinite(actualAPH) && actualAPH < expectedAPH * tol) flags.push("productivity below assumed");

  if (ratio == null || !isFinite(ratio)){
    els.wkFreshStatus.textContent = flags.length ? "Assumptions drifting" : "Needs inputs";
    return;
  }

  if (ratio >= 1.0 && flags.length === 0) els.wkFreshStatus.textContent = "On pace";
  else if (ratio >= 1.0 && flags.length) els.wkFreshStatus.textContent = "On pace (assumptions off)";
  else if (ratio >= 0.85 && flags.length === 0) els.wkFreshStatus.textContent = "Slightly behind";
  else if (ratio >= 0.85 && flags.length) els.wkFreshStatus.textContent = "Behind (rates/capacity off)";
  else if (flags.length) els.wkFreshStatus.textContent = "Behind";
  else els.wkFreshStatus.textContent = "Behind";

  if (flags.length && els.wkFreshNote){
    els.wkFreshNote.textContent = `Reality check: ${flags.join(", ")}`;
  }
}

function addBullet(listEl, text){
  if (!listEl) return;
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}
