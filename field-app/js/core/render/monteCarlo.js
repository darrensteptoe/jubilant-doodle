// @ts-check
import { resolveFeatureFlags } from "../../core/featureFlags.js";
import { computeNeedVotePaceRequirements } from "../../core/executionPlanner.js";
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorShareUnit,
  resolveCanonicalDoorsPerHour,
} from "../../core/throughput.js";
import { formatPercentFromUnit } from "../../core/utils.js";
import { buildTurnoutPhase3CapacityGapView } from "../../core/turnoutView.js";
import {
  buildOutcomeHistogramVisualView,
  buildOutcomeWinProbMarkerView,
  formatOutcomeSensitivityImpact,
} from "../../core/outcomeView.js";

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
  const p3WeeksEl = els?.p3Weeks;
  const p3CapContactsEl = els?.p3CapContacts;
  const p3GapContactsEl = els?.p3GapContacts;
  const p3GapNoteEl = els?.p3GapNote;
  const features = resolveFeatureFlags(state || {});

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  if (p3WeeksEl) p3WeeksEl.textContent = fmtInt(w);

  const eff = getEffectiveBaseRates();
  const cr = eff.cr;
  const pr = eff.sr;
  const rr = eff.tr;

  const orgCount = safeNum(state.orgCount);
  const orgHrs = safeNum(state.orgHoursPerWeek);
  const volMult = safeNum(state.volunteerMultBase);
  const doorShare = resolveCanonicalDoorShareUnit(state);

  const dph = resolveCanonicalDoorsPerHour(state);
  const cph = resolveCanonicalCallsPerHour(state, { toNumber: safeNum });
  const capacityDecay = {
    enabled: !!features.capacityDecayEnabled,
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

  const needVotes = deriveNeedVotes(res);

  const reqContacts = computeNeedVotePaceRequirements({
    goalVotes: needVotes,
    turnoutReliability: rr,
    supportRate: pr,
    contactRate: cr,
  }).attemptsNeeded;

  const phase3GapView = buildTurnoutPhase3CapacityGapView({
    capContacts,
    requiredContacts: reqContacts,
    formatInt: fmtInt,
  });
  if (p3CapContactsEl) p3CapContactsEl.textContent = phase3GapView.capContactsText;
  if (p3GapContactsEl) p3GapContactsEl.textContent = phase3GapView.gapContactsText;
  if (p3GapNoteEl) p3GapNoteEl.textContent = phase3GapView.gapNoteText;

  renderMcFreshness(res, w);

  if (state.mcLast){
    renderMcResults(state.mcLast);
  }
}

export function renderMcResultsPanel({
  els,
  summary,
  state,
  fmtInt,
  fmtSigned,
  setTextPair,
  renderMcVisuals
}){
  if (!els || (!els.mcWinProb && !els.mcWinProbSidebar)) return;
  const setMirror = (primary, sidebar, value) => {
    if (primary) primary.textContent = value;
    if (sidebar) sidebar.textContent = value;
  };
  const renderSensitivity = (target, rows) => {
    if (!target) return;
    const tag = String(target.tagName || "").toLowerCase();
    target.innerHTML = "";
    if (!rows.length){
      if (tag === "tbody"){
        const tr = document.createElement("tr");
        tr.innerHTML = '<td class="muted">No sensitivity rows</td><td class="num muted">—</td>';
        target.appendChild(tr);
      } else {
        const line = document.createElement("div");
        line.textContent = "No sensitivity rows";
        target.appendChild(line);
      }
      return;
    }
    if (tag === "tbody"){
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        const tdA = document.createElement("td");
        tdA.textContent = row.label;
        const tdB = document.createElement("td");
        tdB.className = "num";
        tdB.textContent = formatOutcomeSensitivityImpact(row.impact, 2, "—");
        tr.appendChild(tdA);
        tr.appendChild(tdB);
        target.appendChild(tr);
      });
      return;
    }
    rows.forEach((row) => {
      const line = document.createElement("div");
      line.textContent = `${row.label}: ${formatOutcomeSensitivityImpact(row.impact, 2, "—")}`;
      target.appendChild(line);
    });
  };

  if (summary.winProbTurnoutAdjusted != null && summary.winProbTurnoutAdjusted !== summary.winProb){
    setTextPair(
      els.mcWinProb,
      els.mcWinProbSidebar,
      `${formatPercentFromUnit(summary.winProb, 1)} (TA: ${formatPercentFromUnit(summary.winProbTurnoutAdjusted, 1)})`,
    );
  } else {
    setTextPair(els.mcWinProb, els.mcWinProbSidebar, formatPercentFromUnit(summary.winProb, 1));
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
    setMirror(els.mcDownside, els.mcDownsideSidebar, formatPercentFromUnit(ce.risk?.downsideRiskMass ?? 0, 1));
    setMirror(els.mcES10, els.mcES10Sidebar, fmtSigned(ce.risk?.expectedShortfall10));
    setMirror(els.mcShiftP50, els.mcShiftP50Sidebar, fmtInt(ce.risk?.breakEven?.requiredShiftP50 ?? 0));
    setMirror(els.mcShiftP10, els.mcShiftP10Sidebar, fmtInt(ce.risk?.breakEven?.requiredShiftP10 ?? 0));
    setMirror(els.mcFragility, els.mcFragilitySidebar, formatOutcomeSensitivityImpact(ce.risk?.fragility?.fragilityIndex, 3, "0.000"));
    setMirror(els.mcCliff, els.mcCliffSidebar, formatPercentFromUnit(ce.risk?.fragility?.cliffRisk ?? 0, 1));
    setMirror(els.mcRiskGrade, els.mcRiskGradeSidebar, ce.risk?.advisor?.grade || "—");
    setMirror(els.mcShift60, els.mcShift60Sidebar, fmtInt(ce.risk?.targets?.shiftWin60 ?? 0));
    setMirror(els.mcShift70, els.mcShift70Sidebar, fmtInt(ce.risk?.targets?.shiftWin70 ?? 0));
    setMirror(els.mcShift80, els.mcShift80Sidebar, fmtInt(ce.risk?.targets?.shiftWin80 ?? 0));
    setMirror(els.mcShock10, els.mcShock10Sidebar, formatPercentFromUnit(ce.risk?.shocks?.lossProb10 ?? 0, 1));
    setMirror(els.mcShock25, els.mcShock25Sidebar, formatPercentFromUnit(ce.risk?.shocks?.lossProb25 ?? 0, 1));
    setMirror(els.mcShock50, els.mcShock50Sidebar, formatPercentFromUnit(ce.risk?.shocks?.lossProb50 ?? 0, 1));
  }

  let extra = "";
  if (summary.turnoutAdjusted){
    extra = ` | TA votes (p50): ${fmtInt(summary.turnoutAdjusted.p50)}`;
  }
  const ceNote = summary.confidenceEnvelope?.risk?.advisor?.narrative;
  const label = ceNote ? ceNote : summary.riskLabel;
  const riskLabelText = `${label} — Need: ${fmtInt(summary.needVotes)} net persuasion votes.${extra}`;
  setMirror(els.mcRiskLabel, els.mcRiskLabelSidebar, riskLabelText);

  const rows = Array.isArray(summary?.sensitivity)
    ? summary.sensitivity.map((row) => ({
        label: String(row?.label || ""),
        impact: Number.isFinite(Number(row?.impact)) ? Number(row.impact) : null,
      }))
    : [];
  if (state && typeof state === "object"){
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.lastOutcomeSensitivityRows = structuredClone(rows);
  }
  renderSensitivity(els.mcSensitivity, rows);
  renderSensitivity(els.mcSensitivitySidebar, rows);

  renderMcVisuals(summary);
}

export function renderMcVisualsPanel({ els, summary, clamp, fmtSigned }){
  const svgWinProbMarkerEl = els?.svgWinProbMarker || null;
  const vizWinProbNoteEl = els?.vizWinProbNote || null;
  const svgMarginBarsEl = els?.svgMarginBars || null;
  const svgMarginZeroEl = els?.svgMarginZero || null;
  const svgMarginMinEl = els?.svgMarginMin || null;
  const svgMarginMaxEl = els?.svgMarginMax || null;
  const svgMarginWinShadeEl = els?.svgMarginWinShade || null;

  if (svgWinProbMarkerEl && vizWinProbNoteEl){
    const markerView = buildOutcomeWinProbMarkerView(summary?.winProb, { width: 300 });
    svgWinProbMarkerEl.setAttribute("cx", markerView.xText);
    vizWinProbNoteEl.textContent = `${formatPercentFromUnit(markerView.winProb, 1)} chance to win (model-based).`;
  }

  const h = summary?.histogram;
  if (svgMarginBarsEl) svgMarginBarsEl.innerHTML = "";
  if (svgMarginWinShadeEl) svgMarginWinShadeEl.innerHTML = "";
  const histogramView = buildOutcomeHistogramVisualView(h, { width: 300, baseY: 76, topY: 12 });
  if (!histogramView.valid){
    if (svgMarginMinEl) svgMarginMinEl.textContent = "—";
    if (svgMarginMaxEl) svgMarginMaxEl.textContent = "—";
    if (svgMarginZeroEl){
      svgMarginZeroEl.setAttribute("x1", histogramView.zeroXText);
      svgMarginZeroEl.setAttribute("x2", histogramView.zeroXText);
    }
    return;
  }

  if (!svgMarginBarsEl) return;

  if (svgMarginZeroEl){
    svgMarginZeroEl.setAttribute("x1", histogramView.zeroXText);
    svgMarginZeroEl.setAttribute("x2", histogramView.zeroXText);
  }

  if (svgMarginWinShadeEl && histogramView.shadeVisible){
    const shade = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shade.setAttribute("x", histogramView.shadeXText);
    shade.setAttribute("y", String(histogramView.topY));
    shade.setAttribute("width", histogramView.shadeWidthText);
    shade.setAttribute("height", String(Math.max(0, histogramView.baseY - histogramView.topY)));
    shade.setAttribute("class", "viz-winshade");
    svgMarginWinShadeEl.appendChild(shade);
  }

  for (const bar of histogramView.bars){
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", bar.xText);
    r.setAttribute("y", bar.yText);
    r.setAttribute("width", bar.widthText);
    r.setAttribute("height", bar.heightText);
    r.setAttribute("class", "viz-bar");
    svgMarginBarsEl.appendChild(r);
  }

  if (svgMarginMinEl) svgMarginMinEl.textContent = fmtSigned(histogramView.min);
  if (svgMarginMaxEl) svgMarginMaxEl.textContent = fmtSigned(histogramView.max);
}
