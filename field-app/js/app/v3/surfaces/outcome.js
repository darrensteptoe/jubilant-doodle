import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import { bindClickProxy, readText, setText, syncButtonDisabled } from "../surfaceUtils.js";

export function renderOutcomeSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const controlsCol = createColumn("controls");
  const analysisCol = createColumn("analysis");
  const interpretationCol = createColumn("interpretation");

  const controlsCard = createCard({
    title: "Simulation controls",
    description: "Execution assumptions, uncertainty mode, and Monte Carlo run controls."
  });

  const forecastCard = createCard({
    title: "Forecast",
    description: "Win probability and projected margin under current assumptions."
  });

  const confidenceCard = createCard({
    title: "Confidence envelope",
    description: "P10/P50/P90 spread and distribution shape."
  });

  const sensitivityCard = createCard({
    title: "Sensitivity & surface",
    description: "Driver ranking and lever surface diagnostics."
  });

  const interpretationCard = createCard({
    title: "Interpretation",
    description: "Risk framing and explanatory links between assumptions and outputs."
  });

  const summaryCard = createCard({
    title: "Outcome summary",
    description: "Current confidence posture and fragility at a glance."
  });

  const controlsBody = getCardBody(controlsCard);
  mountLegacyNode({
    key: "v3-outcome-controls-desc",
    selector: "#phase3Card .module-desc",
    target: controlsBody
  });
  mountLegacyNode({
    key: "v3-outcome-controls-summary",
    selector: "#phase3Card .mc-summary",
    target: controlsBody
  });
  mountLegacyClosest({
    key: "v3-outcome-controls-grid",
    childSelector: "#orgCount",
    closestSelector: ".grid3",
    target: controlsBody
  });
  mountLegacyClosest({
    key: "v3-outcome-controls-subgrid",
    childSelector: "#p3Weeks",
    closestSelector: ".subgrid",
    target: controlsBody
  });
  mountLegacyClosest({
    key: "v3-outcome-controls-runbar",
    childSelector: "#mcMode",
    closestSelector: ".mc-row",
    target: controlsBody
  });
  mountLegacyNode({
    key: "v3-outcome-controls-basic",
    selector: "#mcBasic",
    target: controlsBody
  });
  mountLegacyNode({
    key: "v3-outcome-controls-advanced",
    selector: "#mcAdvanced",
    target: controlsBody
  });

  const forecastBody = getCardBody(forecastCard);
  mountLegacyClosest({
    key: "v3-outcome-forecast-kpis",
    childSelector: "#mcWinProb",
    closestSelector: ".kpis",
    target: forecastBody
  });

  const confidenceBody = getCardBody(confidenceCard);
  mountLegacyClosest({
    key: "v3-outcome-confidence-envelope",
    childSelector: "#mcP10",
    closestSelector: ".card",
    target: confidenceBody
  });
  mountLegacyClosest({
    key: "v3-outcome-confidence-distribution",
    childSelector: "#mcDistSvg",
    closestSelector: ".card",
    target: confidenceBody
  });

  const sensitivityBody = getCardBody(sensitivityCard);
  mountLegacyClosest({
    key: "v3-outcome-sensitivity-table",
    childSelector: "#mcSensitivity",
    closestSelector: ".card",
    target: sensitivityBody
  });
  mountLegacyClosest({
    key: "v3-outcome-surface-grid",
    childSelector: "#surfaceLever",
    closestSelector: ".grid2",
    target: sensitivityBody
  });
  const surfaceActions = document.createElement("div");
  surfaceActions.className = "fpe-action-row";
  surfaceActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnComputeSurface" type="button">Compute Surface</button>
  `;
  sensitivityBody.append(surfaceActions);
  mountLegacyNode({
    key: "v3-outcome-surface-status",
    selector: "#surfaceStatus",
    target: sensitivityBody
  });
  mountLegacyClosest({
    key: "v3-outcome-surface-table",
    childSelector: "#surfaceTbody",
    closestSelector: ".table-wrap",
    target: sensitivityBody
  });
  mountLegacyNode({
    key: "v3-outcome-surface-summary",
    selector: "#surfaceSummary",
    target: sensitivityBody
  });

  const interpretationBody = getCardBody(interpretationCard);
  mountLegacyClosest({
    key: "v3-outcome-interpretation-body",
    childSelector: "#impactTraceDetails",
    closestSelector: ".explain-body",
    target: interpretationBody
  });

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Win probability</span><strong id="v3OutcomeWinProb">-</strong></div>
      <div class="fpe-summary-row"><span>Median margin (P50)</span><strong id="v3OutcomeP50">-</strong></div>
      <div class="fpe-summary-row"><span>P10 margin</span><strong id="v3OutcomeP10">-</strong></div>
      <div class="fpe-summary-row"><span>P90 margin</span><strong id="v3OutcomeP90">-</strong></div>
      <div class="fpe-summary-row"><span>Risk grade</span><strong id="v3OutcomeRiskGrade">-</strong></div>
      <div class="fpe-summary-row"><span>Fragility index</span><strong id="v3OutcomeFragility">-</strong></div>
    </div>
  `;

  controlsCol.append(controlsCard, forecastCard);
  analysisCol.append(confidenceCard, sensitivityCard);
  interpretationCol.append(interpretationCard, summaryCard);

  frame.append(controlsCol, analysisCol, interpretationCol);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Outcome summarizes probability, not certainty.",
      "Sensitivity rankings identify which assumptions are worth validating in the field first.",
      "Interpretation should separate signal from model noise before decisions are logged."
    ])
  );

  bindClickProxy("v3BtnComputeSurface", "btnComputeSurface");
  return refreshOutcomeSummary;
}

function refreshOutcomeSummary() {
  setText("v3OutcomeWinProb", readText("#mcWinProb-sidebar"));
  setText("v3OutcomeP50", readText("#mcP50"));
  setText("v3OutcomeP10", readText("#mcP10"));
  setText("v3OutcomeP90", readText("#mcP90"));
  setText("v3OutcomeRiskGrade", readText("#mcRiskGrade"));
  setText("v3OutcomeFragility", readText("#mcFragility"));
  syncButtonDisabled("v3BtnComputeSurface", "btnComputeSurface");
}
