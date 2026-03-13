// @ts-check
export function renderMcResultsModule(args){
  const {
    els,
    summary,
    state,
    setTextPair,
    fmtSigned,
    fmtInt,
    renderMcVisuals,
  } = args || {};

  if (!els || (!els.mcWinProb && !els.mcWinProbSidebar)) return;

  if (summary.winProbTurnoutAdjusted != null && summary.winProbTurnoutAdjusted !== summary.winProb){
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}% (TA: ${(summary.winProbTurnoutAdjusted * 100).toFixed(1)}%)`);
  } else {
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}%`);
  }
  if (els.mcMedian) els.mcMedian.textContent = fmtSigned(summary.median);
  if (els.mcP5) els.mcP5.textContent = fmtSigned(summary.p5);
  if (els.mcP95) els.mcP95.textContent = fmtSigned(summary.p95);

  if (summary.confidenceEnvelope){
    const ce = summary.confidenceEnvelope;
    if (els.mcP10 || els.mcP10Sidebar) setTextPair(els.mcP10, els.mcP10Sidebar, fmtSigned(ce.percentiles?.p10));
    if (els.mcP50 || els.mcP50Sidebar) setTextPair(els.mcP50, els.mcP50Sidebar, fmtSigned(ce.percentiles?.p50));
    if (els.mcP90 || els.mcP90Sidebar) setTextPair(els.mcP90, els.mcP90Sidebar, fmtSigned(ce.percentiles?.p90));
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

  const sensitivityRows = Array.isArray(summary?.sensitivity)
    ? summary.sensitivity.map((row) => ({
        label: String(row?.label || ""),
        impact: Number.isFinite(Number(row?.impact)) ? Number(row.impact) : null,
      }))
    : [];

  if (state && typeof state === "object"){
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.lastOutcomeSensitivityRows = structuredClone(sensitivityRows);
  }

  if (els.mcSensitivity){
    els.mcSensitivity.innerHTML = "";
    sensitivityRows.forEach((row) => {
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
