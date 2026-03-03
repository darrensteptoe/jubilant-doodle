export function renderScenarioComparisonPanel({
  els,
  state,
  ensureScenarioRegistry,
  SCENARIO_BASELINE_ID,
  scenarioClone,
  scenarioInputsFromState,
  computeDecisionKeyOutCore,
  engine,
  derivedWeeksRemaining,
  computeWeeklyOpsContextFromSnap,
  targetFinishDateFromSnap,
  computeLastNLogSums,
  paceFinishDate,
  fmtInt,
  fmtISODate
}){
  if (!els.scmCompareWrap) return;
  ensureScenarioRegistry();

  const reg = state.ui.scenarios;
  const activeId = state.ui.activeScenarioId;
  const baseRec = reg?.[SCENARIO_BASELINE_ID] || null;
  const activeRec = reg?.[activeId] || null;

  const isDiff = !!(baseRec && activeRec && activeId !== SCENARIO_BASELINE_ID);

  if (els.scmCompareEmpty) els.scmCompareEmpty.hidden = isDiff;
  if (els.scmCompareGrid) els.scmCompareGrid.hidden = !isDiff;

  if (!els.scmCompareTag) return;

  const setCompareTag = (kind, text) => {
    els.scmCompareTag.classList.remove("ok","warn","bad");
    if (kind) els.scmCompareTag.classList.add(kind);
    els.scmCompareTag.textContent = text || "—";
  };

  if (!isDiff){
    setCompareTag(null, "—");
    if (els.scmDiffInputs) els.scmDiffInputs.innerHTML = "";
    if (els.scmDiffOutputs) els.scmDiffOutputs.innerHTML = "";
    if (els.scmDiffInputsFoot) els.scmDiffInputsFoot.textContent = "";
    return;
  }

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

  const labels = {
    raceType:"Race type",
    mode:"Mode",
    electionDate:"Election date",
    weeksRemaining:"Weeks remaining override",
    universeBasis:"Universe basis",
    universeSize:"Universe size",
    goalSupportIds:"Goal support IDs",
    supportRatePct:"Support rate (%)",
    contactRatePct:"Contact rate (%)",
    turnoutReliabilityPct:"Turnout reliability (%)",
    universeLayerEnabled:"Universe layer enabled",
    universeDemPct:"Universe Dem (%)",
    universeRepPct:"Universe Rep (%)",
    universeNpaPct:"Universe NPA (%)",
    universeOtherPct:"Universe Other (%)",
    retentionFactor:"Retention factor",
    orgCount:"Organizers",
    orgHoursPerWeek:"Org hours/week",
    volunteerMultBase:"Volunteer multiplier",
    channelDoorPct:"Door share (%)",
    doorsPerHour3:"Doors/hour",
    callsPerHour3:"Calls/hour",
    timelineEnabled:"Timeline enabled",
    timelineStaffCount:"Timeline staff",
    timelineVolCount:"Timeline volunteers",
    timelineStaffHours:"Staff hours/week",
    timelineVolHours:"Volunteer hours/week",
    timelineDoorsPerHour:"Timeline doors/hour",
    timelineCallsPerHour:"Timeline calls/hour",
    timelineTextsPerHour:"Timeline texts/hour",
    timelineDoorSharePct:"Timeline door share (%)",
    timelineActiveWeeks:"Timeline active weeks",
    timelineGotvWeeks:"GOTV window (weeks)",
  };

  const fmtV = (k, v) => {
    if (v == null) return "—";
    if (typeof v === "boolean") return v ? "On" : "Off";
    if (typeof v === "number" && isFinite(v)){
      if (k === "retentionFactor") return v.toFixed(2);
      if (k.endsWith("Pct")) return String(v);
      if (Math.abs(v) >= 1000) return fmtInt(Math.round(v));
      return String(v);
    }
    if (typeof v === "string") return v === "" ? "—" : v;
    return String(v);
  };

  const diffKeys = [];
  const seen = new Set();
  for (const k of keyOrder){
    seen.add(k);
    const a = baseInputs?.[k];
    const b = actInputs?.[k];
    const same = (a === b) || (String(a ?? "") === String(b ?? ""));
    if (!same) diffKeys.push(k);
  }
  const otherKeys = Array.from(new Set([...Object.keys(baseInputs||{}), ...Object.keys(actInputs||{})])).filter(k => !seen.has(k) && k !== "ui" && k !== "mcLast" && k !== "mcLastHash");
  const otherChanged = otherKeys.filter(k => {
    const a = baseInputs?.[k];
    const b = actInputs?.[k];
    return !((a === b) || (String(a ?? "") === String(b ?? "")));
  });

  if (els.scmDiffInputs){
    els.scmDiffInputs.innerHTML = "";
    const maxShow = 12;
    const showKeys = diffKeys.slice(0, maxShow);
    for (const k of showKeys){
      const li = document.createElement("li");
      li.className = "diff-item";
      const head = document.createElement("div");
      head.className = "diff-k";
      head.textContent = labels[k] || k;
      const line = document.createElement("div");
      line.className = "diff-v";
      line.textContent = `${fmtV(k, baseInputs?.[k])} → ${fmtV(k, actInputs?.[k])}`;
      li.appendChild(head);
      li.appendChild(line);
      els.scmDiffInputs.appendChild(li);
    }
    const remaining = (diffKeys.length - showKeys.length) + otherChanged.length;
    if (els.scmDiffInputsFoot){
      els.scmDiffInputsFoot.textContent = remaining > 0
        ? `${remaining} more changed input(s) not shown.`
        : "";
    }
  }

  const computeKeyOut = (inputs) => {
    const core = computeDecisionKeyOutCore(inputs, {
      scenarioClone,
      engine,
      derivedWeeksRemaining,
      computeWeeklyOpsContextFromSnap,
      targetFinishDateFromSnap,
    });

    const last7 = computeLastNLogSums(7);
    const paceAttemptsPerDay = (last7?.hasLog && last7?.days && last7.days > 0) ? (last7.sumAttempts / last7.days) : null;
    const paceFinish = paceFinishDate(core?.ctx?.attemptsNeeded, paceAttemptsPerDay);

    return {
      attemptsPerWeek: core?.ctx?.attemptsPerWeek ?? null,
      convosPerWeek: core?.ctx?.convosPerWeek ?? null,
      finishDate: core?.finish ?? null,
      paceFinishDate: paceFinish,
    };
  };

  const baseOut = computeKeyOut(baseInputs);
  const actOut = computeKeyOut(actInputs);

  const fmtOutNum = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
  const fmtOutDate = (d) => d ? fmtISODate(d) : "—";
  const fmtDeltaNum = (d) => (d == null || !isFinite(d) || d === 0) ? "—" : ((d > 0) ? `+${fmtInt(Math.round(d))}` : `${fmtInt(Math.round(d))}`);

  const deltaKindNumLowerIsBetter = (d) => {
    if (d == null || !isFinite(d) || d === 0) return null;
    return d < 0 ? "ok" : "bad";
  };

  const deltaKindDateEarlierIsBetter = (a, b) => {
    if (!a || !b) return null;
    const da = a.getTime();
    const db = b.getTime();
    if (!isFinite(da) || !isFinite(db) || da === db) return null;
    return db < da ? "ok" : "bad";
  };

  const rows = [
    {
      label: "Attempts/week",
      base: baseOut.attemptsPerWeek,
      act: actOut.attemptsPerWeek,
      delta: (actOut.attemptsPerWeek != null && baseOut.attemptsPerWeek != null) ? (actOut.attemptsPerWeek - baseOut.attemptsPerWeek) : null,
      kind: deltaKindNumLowerIsBetter((actOut.attemptsPerWeek != null && baseOut.attemptsPerWeek != null) ? (actOut.attemptsPerWeek - baseOut.attemptsPerWeek) : null),
      fmtBase: () => fmtOutNum(baseOut.attemptsPerWeek),
      fmtAct: () => fmtOutNum(actOut.attemptsPerWeek),
      fmtDelta: (d) => fmtDeltaNum(d),
    },
    {
      label: "Convos/week",
      base: baseOut.convosPerWeek,
      act: actOut.convosPerWeek,
      delta: (actOut.convosPerWeek != null && baseOut.convosPerWeek != null) ? (actOut.convosPerWeek - baseOut.convosPerWeek) : null,
      kind: deltaKindNumLowerIsBetter((actOut.convosPerWeek != null && baseOut.convosPerWeek != null) ? (actOut.convosPerWeek - baseOut.convosPerWeek) : null),
      fmtBase: () => fmtOutNum(baseOut.convosPerWeek),
      fmtAct: () => fmtOutNum(actOut.convosPerWeek),
      fmtDelta: (d) => fmtDeltaNum(d),
    },
    {
      label: "Finish date",
      baseDate: baseOut.finishDate,
      actDate: actOut.finishDate,
      kind: deltaKindDateEarlierIsBetter(baseOut.finishDate, actOut.finishDate),
      fmtBase: () => fmtOutDate(baseOut.finishDate),
      fmtAct: () => fmtOutDate(actOut.finishDate),
      fmtDelta: () => {
        if (!baseOut.finishDate || !actOut.finishDate) return "—";
        const dd = Math.round((actOut.finishDate.getTime() - baseOut.finishDate.getTime()) / (24*3600*1000));
        if (!isFinite(dd) || dd === 0) return "—";
        return dd > 0 ? `+${fmtInt(dd)}d` : `${fmtInt(dd)}d`;
      }
    },
    {
      label: "Pace finish (attempts)",
      baseDate: baseOut.paceFinishDate,
      actDate: actOut.paceFinishDate,
      kind: deltaKindDateEarlierIsBetter(baseOut.paceFinishDate, actOut.paceFinishDate),
      fmtBase: () => fmtOutDate(baseOut.paceFinishDate),
      fmtAct: () => fmtOutDate(actOut.paceFinishDate),
      fmtDelta: () => {
        if (!baseOut.paceFinishDate || !actOut.paceFinishDate) return "—";
        const dd = Math.round((actOut.paceFinishDate.getTime() - baseOut.paceFinishDate.getTime()) / (24*3600*1000));
        if (!isFinite(dd) || dd === 0) return "—";
        return dd > 0 ? `+${fmtInt(dd)}d` : `${fmtInt(dd)}d`;
      }
    },
  ];

  if (els.scmDiffOutputs){
    els.scmDiffOutputs.innerHTML = "";
    for (const r of rows){
      const tr = document.createElement("tr");
      const kind = r.kind;
      const deltaText = (typeof r.fmtDelta === "function") ? r.fmtDelta(r.delta) : "—";
      tr.innerHTML = `
        <td>${r.label}</td>
        <td class="num">${r.fmtBase()}</td>
        <td class="num">${r.fmtAct()}</td>
        <td class="num"><span class="delta ${kind || ""}">${deltaText}</span></td>
      `;
      els.scmDiffOutputs.appendChild(tr);
    }
  }

  const totalChanged = diffKeys.length + otherChanged.length;
  const outDelta = rows[0]?.delta;
  const overallKind = (outDelta == null || !isFinite(outDelta) || outDelta === 0) ? null : (outDelta < 0 ? "ok" : "bad");
  const tagText = `${totalChanged} input change(s)`;
  setCompareTag(overallKind, tagText);
}
