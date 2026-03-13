import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import { readTurnoutSnapshot } from "../stateBridge.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  createFieldGrid,
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue
} from "../surfaceUtils.js";

const TURNOUT_API_KEY = "__FPE_TURNOUT_API__";

export function renderTurnoutSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const controlsCol = createColumn("controls");
  const analysisCol = createColumn("analysis");
  const resultsCol = createColumn("results");

  const assumptionsCard = createCard({
    title: "Turnout assumptions",
    description: "Baseline turnout, target override, and modeling mode."
  });

  const liftCard = createCard({
    title: "Lift behavior",
    description: "Diminishing-return behavior and basic/advanced lift controls."
  });

  const costInputsCard = createCard({
    title: "Tactic cost inputs",
    description: "Per-attempt tactic settings and overhead assumptions."
  });

  const efficiencyCard = createCard({
    title: "Efficiency comparison",
    description: "Cost-per-net-vote and tactic comparison under current assumptions."
  });
  const assumptionsHeaderToggle = document.createElement("div");
  assumptionsHeaderToggle.className = "fpe-header-switch";
  assumptionsHeaderToggle.innerHTML = `
    <span class="fpe-header-switch__label">Turnout module (enable to apply)</span>
    <label class="fpe-switch">
      <input id="v3TurnoutEnabledToggle" type="checkbox"/>
      <span>Enable</span>
    </label>
  `;
  setCardHeaderControl(assumptionsCard, assumptionsHeaderToggle);

  const impactCard = createCard({
    title: "Realized vote impact",
    description: "Readout of current turnout context against vote requirements."
  });

  const summaryCard = createCard({
    title: "Turnout summary",
    description: "Current turnout context and vote-impact readout."
  });

  const costBody = getCardBody(costInputsCard);
  const costFields = createFieldGrid("fpe-field-grid--3");
  costBody.append(costFields);
  mountLegacyClosest({
    key: "v3-turnout-cost-doors-field",
    childSelector: "#roiDoorsEnabled",
    closestSelector: ".field",
    target: costFields
  });
  mountLegacyClosest({
    key: "v3-turnout-cost-phones-field",
    childSelector: "#roiPhonesEnabled",
    closestSelector: ".field",
    target: costFields
  });
  mountLegacyClosest({
    key: "v3-turnout-cost-texts-field",
    childSelector: "#roiTextsEnabled",
    closestSelector: ".field",
    target: costFields
  });
  mountLegacyClosest({
    key: "v3-turnout-cost-overhead-grid",
    childSelector: "#roiOverheadAmount",
    closestSelector: ".grid2",
    target: costBody
  });

  const efficiencyBody = getCardBody(efficiencyCard);
  const efficiencyActions = document.createElement("div");
  efficiencyActions.className = "fpe-action-row";
  efficiencyActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnRoiRefresh" type="button">Refresh</button>
  `;
  efficiencyBody.append(efficiencyActions);
  mountLegacyClosest({
    key: "v3-turnout-roi-table",
    childSelector: "#roiTbody",
    closestSelector: ".table-wrap",
    target: efficiencyBody
  });
  efficiencyBody.insertAdjacentHTML(
    "beforeend",
    `<div class="fpe-help fpe-help--flush" id="v3TurnoutRoiBanner">-</div>`
  );

  const assumptionsBody = getCardBody(assumptionsCard);
  mountLegacyClosest({
    key: "v3-turnout-base-grid",
    childSelector: "#turnoutBaselinePct",
    closestSelector: ".grid3",
    target: assumptionsBody
  });

  const liftBody = getCardBody(liftCard);
  mountLegacyClosest({
    key: "v3-turnout-diminishing-row",
    childSelector: "#gotvDiminishing",
    closestSelector: ".rowline",
    target: liftBody
  });
  mountLegacyNode({
    key: "v3-turnout-basic-panel",
    selector: "#gotvBasic",
    target: liftBody
  });
  mountLegacyNode({
    key: "v3-turnout-advanced-panel",
    selector: "#gotvAdvanced",
    target: liftBody
  });
  liftBody.insertAdjacentHTML(
    "beforeend",
    `<div class="fpe-help fpe-help--flush">Use basic mode for a single lift assumption, or advanced mode to model uncertainty bounds.</div>`
  );

  const impactBody = getCardBody(impactCard);
  impactBody.insertAdjacentHTML(
    "beforeend",
    `<div class="fpe-help fpe-help--flush" id="v3TurnoutImpactSummary">-</div>`
  );
  impactBody.insertAdjacentHTML(
    "beforeend",
    `
      <div class="fpe-summary-grid">
        <div class="fpe-summary-row"><span>Expected turnout votes</span><strong id="v3TurnoutImpactVotes">-</strong></div>
        <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3TurnoutImpactNeed">-</strong></div>
        <div class="fpe-summary-row"><span>Projected margin context</span><strong id="v3TurnoutImpactMargin">-</strong></div>
        <div class="fpe-summary-row"><span>Win probability</span><strong id="v3TurnoutImpactWinProb">-</strong></div>
      </div>
    `
  );

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Turnout summary</span><strong id="v3TurnoutSummary">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout votes</span><strong id="v3TurnoutVotes">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3TurnoutNeedVotes">-</strong></div>
    </div>
  `;

  controlsCol.append(assumptionsCard, liftCard);
  analysisCol.append(costInputsCard, efficiencyCard);
  resultsCol.append(impactCard, summaryCard);

  frame.append(controlsCol, analysisCol, resultsCol);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Turnout mechanics are distinct from persuasion assumptions and should be tuned separately.",
      "Efficiency comparisons help prevent over-investment in low-yield tactics.",
      "Use this page to test lift realism before finalizing execution workload."
    ])
  );

  bindClickProxy("v3BtnRoiRefresh", "roiRefresh");
  bindCheckboxProxy("v3TurnoutEnabledToggle", "turnoutEnabled");
  return refreshTurnoutSummary;
}

function refreshTurnoutSummary() {
  const snapshot = readTurnoutSnapshot();
  const turnoutView = readTurnoutBridgeView();
  setText("v3TurnoutSummary", snapshot.turnoutSummary || "-");
  setText("v3TurnoutImpactSummary", snapshot.turnoutSummary || "-");
  setText("v3TurnoutRoiBanner", turnoutView?.roiBannerText || "-");
  setText("v3TurnoutVotes", snapshot.turnoutVotes || "-");
  setText("v3TurnoutNeedVotes", snapshot.needVotes || "-");
  setText("v3TurnoutImpactVotes", readText("#kpiTurnoutVotes-sidebar"));
  setText("v3TurnoutImpactNeed", readText("#kpiPersuasionNeed-sidebar"));
  const marginContext = readText("#v3KpiMargin .fpe-kpi__value") || readText("#mcP50-sidebar");
  setText("v3TurnoutImpactMargin", marginContext);
  setText("v3TurnoutImpactWinProb", readText("#mcWinProb-sidebar"));
  syncButtonDisabled("v3BtnRoiRefresh", "roiRefresh");
  syncCheckboxValue("v3TurnoutEnabledToggle", "turnoutEnabled");

  const v3Toggle = document.getElementById("v3TurnoutEnabledToggle");
  const legacyToggle = document.getElementById("turnoutEnabled");
  if (v3Toggle instanceof HTMLInputElement && legacyToggle instanceof HTMLInputElement) {
    v3Toggle.disabled = legacyToggle.disabled;
  }
}

function readTurnoutBridgeView() {
  const api = window[TURNOUT_API_KEY];
  if (!api || typeof api.getView !== "function") {
    return null;
  }
  try {
    const view = api.getView();
    return view && typeof view === "object" ? view : null;
  } catch {
    return null;
  }
}
