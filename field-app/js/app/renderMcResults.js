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
  const setMirror = (primary, sidebar, value) => {
    if (primary) primary.textContent = value;
    if (sidebar) sidebar.textContent = value;
  };
  const renderSensitivity = (target, rows) => {
    if (!target) return;
    const tag = String(target.tagName || "").toLowerCase();
    target.innerHTML = "";
    if (tag === "tbody"){
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        const tdA = document.createElement("td");
        tdA.textContent = row.label;
        const tdB = document.createElement("td");
        tdB.className = "num";
        tdB.textContent = row.impact == null ? "—" : row.impact.toFixed(2);
        tr.appendChild(tdA);
        tr.appendChild(tdB);
        target.appendChild(tr);
      });
      return;
    }
    rows.forEach((row) => {
      const line = document.createElement("div");
      line.textContent = `${row.label}: ${row.impact == null ? "—" : row.impact.toFixed(2)}`;
      target.appendChild(line);
    });
  };

  if (summary.winProbTurnoutAdjusted != null && summary.winProbTurnoutAdjusted !== summary.winProb){
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}% (TA: ${(summary.winProbTurnoutAdjusted * 100).toFixed(1)}%)`);
  } else {
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, `${(summary.winProb * 100).toFixed(1)}%`);
  }
  setMirror(els.mcMedian, els.mcMedianSidebar, fmtSigned(summary.median));
  setMirror(els.mcP5, els.mcP5Sidebar, fmtSigned(summary.p5));
  setMirror(els.mcP95, els.mcP95Sidebar, fmtSigned(summary.p95));

  if (summary.confidenceEnvelope){
    const ce = summary.confidenceEnvelope;
    if (els.mcP10 || els.mcP10Sidebar) setTextPair(els.mcP10, els.mcP10Sidebar, fmtSigned(ce.percentiles?.p10));
    if (els.mcP50 || els.mcP50Sidebar) setTextPair(els.mcP50, els.mcP50Sidebar, fmtSigned(ce.percentiles?.p50));
    if (els.mcP90 || els.mcP90Sidebar) setTextPair(els.mcP90, els.mcP90Sidebar, fmtSigned(ce.percentiles?.p90));
    setMirror(els.mcMoS, els.mcMoSSidebar, fmtSigned(ce.risk?.marginOfSafety));
    setMirror(els.mcDownside, els.mcDownsideSidebar, `${((ce.risk?.downsideRiskMass ?? 0) * 100).toFixed(1)}%`);
    setMirror(els.mcES10, els.mcES10Sidebar, fmtSigned(ce.risk?.expectedShortfall10));
    setMirror(els.mcShiftP50, els.mcShiftP50Sidebar, fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP50 ?? 0)));
    setMirror(els.mcShiftP10, els.mcShiftP10Sidebar, fmtInt(Math.round(ce.risk?.breakEven?.requiredShiftP10 ?? 0)));
    setMirror(els.mcFragility, els.mcFragilitySidebar, (ce.risk?.fragility?.fragilityIndex ?? 0).toFixed(3));
    setMirror(els.mcCliff, els.mcCliffSidebar, `${((ce.risk?.fragility?.cliffRisk ?? 0) * 100).toFixed(1)}%`);
    setMirror(els.mcRiskGrade, els.mcRiskGradeSidebar, ce.risk?.advisor?.grade || "—");
    setMirror(els.mcShift60, els.mcShift60Sidebar, fmtInt(Math.round(ce.risk?.targets?.shiftWin60 ?? 0)));
    setMirror(els.mcShift70, els.mcShift70Sidebar, fmtInt(Math.round(ce.risk?.targets?.shiftWin70 ?? 0)));
    setMirror(els.mcShift80, els.mcShift80Sidebar, fmtInt(Math.round(ce.risk?.targets?.shiftWin80 ?? 0)));
    setMirror(els.mcShock10, els.mcShock10Sidebar, `${((ce.risk?.shocks?.lossProb10 ?? 0) * 100).toFixed(1)}%`);
    setMirror(els.mcShock25, els.mcShock25Sidebar, `${((ce.risk?.shocks?.lossProb25 ?? 0) * 100).toFixed(1)}%`);
    setMirror(els.mcShock50, els.mcShock50Sidebar, `${((ce.risk?.shocks?.lossProb50 ?? 0) * 100).toFixed(1)}%`);
  }

  let extra = "";
  if (summary.turnoutAdjusted){
    extra = ` | TA votes (p50): ${fmtInt(Math.round(summary.turnoutAdjusted.p50))}`;
  }
  const ceNote = summary.confidenceEnvelope?.risk?.advisor?.narrative;
  const label = ceNote ? ceNote : summary.riskLabel;
  const riskLabelText = `${label} — Need: ${fmtInt(Math.round(summary.needVotes))} net persuasion votes.${extra}`;
  setMirror(els.mcRiskLabel, els.mcRiskLabelSidebar, riskLabelText);

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

  renderSensitivity(els.mcSensitivity, sensitivityRows);
  renderSensitivity(els.mcSensitivitySidebar, sensitivityRows);

  renderMcVisuals(summary);
}
