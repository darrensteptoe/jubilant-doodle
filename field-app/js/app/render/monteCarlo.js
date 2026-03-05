export function renderPhase3Panel({
  els,
  state,
  res,
  weeks,
  fmtInt,
  safeNum,
  clamp,
  getEffectiveBaseRates,
  computeCapacityContacts,
  deriveNeedVotes,
  renderMcFreshness,
  renderMcResults
}){
  if (!els.p3CapContacts) return;

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  els.p3Weeks.textContent = w == null ? "—" : fmtInt(w);

  const eff = getEffectiveBaseRates();
  const cr = eff.cr;
  const pr = eff.sr;
  const rr = eff.tr;

  const orgCount = safeNum(state.orgCount);
  const orgHrs = safeNum(state.orgHoursPerWeek);
  const volMult = safeNum(state.volunteerMultBase);
  const doorSharePct = safeNum(state.channelDoorPct);
  const doorShare = (doorSharePct != null) ? clamp(doorSharePct, 0, 100) / 100 : null;

  const dph = safeNum(state.doorsPerHour3) ?? safeNum(state.doorsPerHour);
  const cph = safeNum(state.callsPerHour3);
  const capacityDecay = {
    enabled: !!state?.intelState?.expertToggles?.capacityDecayEnabled,
    type: String(state?.intelState?.expertToggles?.decayModel?.type || "linear"),
    weeklyDecayPct: safeNum(state?.intelState?.expertToggles?.decayModel?.weeklyDecayPct),
    floorPctOfBaseline: safeNum(state?.intelState?.expertToggles?.decayModel?.floorPctOfBaseline),
  };

  const capContacts = computeCapacityContacts({
    weeks: w,
    orgCount,
    orgHoursPerWeek: orgHrs,
    volunteerMult: volMult,
    doorShare,
    doorsPerHour: dph,
    callsPerHour: cph,
    capacityDecay,
  });

  els.p3CapContacts.textContent = (capContacts == null) ? "—" : fmtInt(Math.floor(capContacts));

  const needVotes = deriveNeedVotes(res);

  let reqContacts = null;
  if (needVotes > 0 && cr && cr > 0 && pr && pr > 0 && rr && rr > 0){
    const reqSupports = needVotes / rr;
    const reqConvos = reqSupports / pr;
    reqContacts = reqConvos / cr;
  }

  if (capContacts == null || reqContacts == null){
    els.p3GapContacts.textContent = "—";
    els.p3GapNote.textContent = "Enter Phase 2 rates + Phase 3 capacity to compute.";
  } else {
    const gap = capContacts - reqContacts;
    const sign = gap >= 0 ? "+" : "−";
    els.p3GapContacts.textContent = `${sign}${fmtInt(Math.ceil(Math.abs(gap)))}`;
    if (gap >= 0){
      els.p3GapNote.textContent = "Capacity ≥ requirement (base rates).";
    } else {
      els.p3GapNote.textContent = "Shortfall vs requirement (base rates).";
    }
  }

  renderMcFreshness(res, w);

  if (state.mcLast){
    renderMcResults(state.mcLast);
  }
}

export function renderMcResultsPanel({
  els,
  summary,
  fmtInt,
  fmtSigned,
  setTextPair,
  renderMcVisuals
}){
  if (!els.mcWinProb) return;

  if (summary.winProbTurnoutAdjusted != null && summary.winProbTurnoutAdjusted !== summary.winProb){
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}% (TA: ${(summary.winProbTurnoutAdjusted * 100).toFixed(1)}%)`);
  } else {
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}%`);
  }
  els.mcMedian.textContent = fmtSigned(summary.median);
  els.mcP5.textContent = fmtSigned(summary.p5);
  els.mcP95.textContent = fmtSigned(summary.p95);

  if (summary.confidenceEnvelope){
    const ce = summary.confidenceEnvelope;
    if (els.mcP10) setTextPair(els.mcP10, els.mcP10Sidebar, fmtSigned(ce.percentiles?.p10));
    if (els.mcP50) setTextPair(els.mcP50, els.mcP50Sidebar, fmtSigned(ce.percentiles?.p50));
    if (els.mcP90) setTextPair(els.mcP90, els.mcP90Sidebar, fmtSigned(ce.percentiles?.p90));
    if (els.mcMoS) els.mcMoS.textContent = fmtSigned(ce.risk?.marginOfSafety);
    if (els.mcDownside) els.mcDownside.textContent = `${((ce.risk?.downsideRiskMass ?? 0) * 100).toFixed(1)}%`;
    if (els.mcES10) els.mcES10.textContent = fmtSigned(ce.risk?.expectedShortfall10);
    if (els.mcShiftP50) els.mcShiftP50.textContent = fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP50 ?? 0));
    if (els.mcShiftP10) els.mcShiftP10.textContent = fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP10 ?? 0));
    if (els.mcFragility) els.mcFragility.textContent = (ce.risk?.fragility?.fragilityIndex ?? 0).toFixed(3);
    if (els.mcCliff) els.mcCliff.textContent = `${((ce.risk?.fragility?.cliffRisk ?? 0) * 100).toFixed(1)}%`;
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
    const rows = Array.isArray(summary?.sensitivity) ? summary.sensitivity : [];
    if (!rows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted">No sensitivity rows</td><td class="num muted">—</td>';
      els.mcSensitivity.appendChild(tr);
    }
    rows.forEach(row => {
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

  renderMcVisuals(summary);
}

export function renderMcVisualsPanel({ els, summary, clamp, fmtSigned }){
  if (els.svgWinProbMarker && els.vizWinProbNote){
    const p = clamp(summary?.winProb ?? 0, 0, 1);
    const x = 300 * p;
    els.svgWinProbMarker.setAttribute("cx", x.toFixed(2));
    els.vizWinProbNote.textContent = `${(p * 100).toFixed(1)}% chance to win (model-based).`;
  }

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
