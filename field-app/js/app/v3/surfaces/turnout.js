import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import { readTurnoutSnapshot } from "../stateBridge.js";
import { bindClickProxy, createFieldGrid, readText, setText, syncButtonDisabled } from "../surfaceUtils.js";

export function renderTurnoutSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const costInputsCard = createCard({
    title: "Cost inputs",
    description: "Per-attempt tactic settings and overhead assumptions."
  });

  const efficiencyCard = createCard({
    title: "ROI comparison",
    description: "Cost-per-net-vote and tactic comparison under current assumptions."
  });

  const assumptionsCard = createCard({
    title: "Turnout mechanics",
    description: "Baseline turnout, lift behavior, and diminishing-return controls."
  });

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
  mountLegacyNode({
    key: "v3-turnout-roi-banner",
    selector: "#roiBanner",
    target: efficiencyBody
  });
  mountLegacyNode({
    key: "v3-turnout-roi-note",
    selector: "#roiBanner ~ .note",
    target: efficiencyBody
  });

  const assumptionsBody = getCardBody(assumptionsCard);
  mountLegacyClosest({
    key: "v3-turnout-toggle-row",
    childSelector: "#turnoutEnabled",
    closestSelector: ".rowline",
    target: assumptionsBody
  });
  mountLegacyClosest({
    key: "v3-turnout-base-grid",
    childSelector: "#turnoutBaselinePct",
    closestSelector: ".grid3",
    target: assumptionsBody
  });
  mountLegacyClosest({
    key: "v3-turnout-diminishing-row",
    childSelector: "#gotvDiminishing",
    closestSelector: ".rowline",
    target: assumptionsBody
  });
  mountLegacyNode({
    key: "v3-turnout-basic-panel",
    selector: "#gotvBasic",
    target: assumptionsBody
  });
  mountLegacyNode({
    key: "v3-turnout-advanced-panel",
    selector: "#gotvAdvanced",
    target: assumptionsBody
  });
  mountLegacyNode({
    key: "v3-turnout-summary-note",
    selector: "#stage-roi .phase-p6 > .note",
    target: assumptionsBody
  });
  mountLegacyNode({
    key: "v3-turnout-summary-banner",
    selector: "#turnoutSummary",
    target: assumptionsBody
  });

  getCardBody(impactCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Expected turnout votes</span><strong id="v3TurnoutImpactVotes">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3TurnoutImpactNeed">-</strong></div>
      <div class="fpe-summary-row"><span>Projected margin context</span><strong id="v3TurnoutImpactMargin">-</strong></div>
      <div class="fpe-summary-row"><span>Win probability</span><strong id="v3TurnoutImpactWinProb">-</strong></div>
    </div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Turnout summary</span><strong id="v3TurnoutSummary">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout votes</span><strong id="v3TurnoutVotes">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3TurnoutNeedVotes">-</strong></div>
    </div>
  `;

  left.append(costInputsCard, efficiencyCard);
  right.append(assumptionsCard, impactCard, summaryCard);

  frame.append(left, right);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Turnout mechanics are distinct from persuasion assumptions and should be tuned separately.",
      "Efficiency comparisons help prevent over-investment in low-yield tactics.",
      "Use this page to test lift realism before finalizing execution workload."
    ])
  );

  bindClickProxy("v3BtnRoiRefresh", "roiRefresh");
  return refreshTurnoutSummary;
}

function refreshTurnoutSummary() {
  const snapshot = readTurnoutSnapshot();
  setText("v3TurnoutSummary", snapshot.turnoutSummary || "-");
  setText("v3TurnoutVotes", snapshot.turnoutVotes || "-");
  setText("v3TurnoutNeedVotes", snapshot.needVotes || "-");
  setText("v3TurnoutImpactVotes", readText("#kpiTurnoutVotes-sidebar"));
  setText("v3TurnoutImpactNeed", readText("#kpiPersuasionNeed-sidebar"));
  setText("v3TurnoutImpactMargin", readText("#mcP50"));
  setText("v3TurnoutImpactWinProb", readText("#mcWinProb-sidebar"));
  syncButtonDisabled("v3BtnRoiRefresh", "roiRefresh");
}
