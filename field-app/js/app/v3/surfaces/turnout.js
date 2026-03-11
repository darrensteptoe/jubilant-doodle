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
  bindFieldProxy,
  bindSelectProxy,
  createFieldGrid,
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncFieldValue,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderTurnoutSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const controlsCol = createColumn("controls");
  const analysisCol = createColumn("analysis");
  const resultsCol = createColumn("results");

  const assumptionsCard = createCard({
    title: "Turnout assumptions",
    description: "Baseline turnout, target override, and GOTV lift mode."
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

  const assumptionsBody = getCardBody(assumptionsCard);
  assumptionsBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--3">
      <div class="field">
        <label class="fpe-control-label" for="v3TurnoutBaselinePct">Baseline turnout rate %</label>
        <input class="fpe-input" id="v3TurnoutBaselinePct" max="100" min="0" step="0.5" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3TurnoutTargetOverridePct">Target universe turnout override %</label>
        <input class="fpe-input" id="v3TurnoutTargetOverridePct" max="100" min="0" step="0.5" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3TurnoutMode">GOTV lift model</label>
        <select class="fpe-input" id="v3TurnoutMode"></select>
      </div>
    </div>
    <div class="fpe-help fpe-help--flush">
      Turnout modeling affects realized votes. Persuasion changes preference among those who vote; GOTV changes probability of voting.
    </div>
  `;

  const liftBody = getCardBody(liftCard);
  liftBody.innerHTML = `
    <div class="fpe-action-row">
      <label class="fpe-switch">
        <input id="v3TurnoutDiminishingToggle" type="checkbox"/>
        <span>Diminishing returns</span>
      </label>
      <span class="fpe-help fpe-help--flush">When ON, marginal lift tapers as turnout approaches the ceiling.</span>
    </div>
    <div class="fpe-field-grid fpe-field-grid--3">
      <div class="field">
        <label class="fpe-control-label" for="v3GotvLiftPP">GOTV lift per contact (pp)</label>
        <input class="fpe-input" id="v3GotvLiftPP" max="25" min="0" step="0.1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3GotvMaxLiftPP">Max lift ceiling (pp)</label>
        <input class="fpe-input" id="v3GotvMaxLiftPP" max="50" min="0" step="0.5" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3GotvMaxLiftPP2">Advanced max lift ceiling (pp)</label>
        <input class="fpe-input" id="v3GotvMaxLiftPP2" max="50" min="0" step="0.5" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3GotvLiftMin">Lift min (pp)</label>
        <input class="fpe-input" id="v3GotvLiftMin" max="25" min="0" step="0.1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3GotvLiftMode">Lift mode (pp)</label>
        <input class="fpe-input" id="v3GotvLiftMode" max="25" min="0" step="0.1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3GotvLiftMax">Lift max (pp)</label>
        <input class="fpe-input" id="v3GotvLiftMax" max="25" min="0" step="0.1" type="number"/>
      </div>
    </div>
  `;

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

  const impactBody = getCardBody(impactCard);
  mountLegacyNode({
    key: "v3-turnout-summary-banner",
    selector: "#turnoutSummary",
    target: impactBody
  });
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

  wireTurnoutControlProxies();
  return refreshTurnoutSummary;
}

function wireTurnoutControlProxies() {
  bindClickProxy("v3BtnRoiRefresh", "roiRefresh");
  bindCheckboxProxy("v3TurnoutEnabledToggle", "turnoutEnabled");
  bindFieldProxy("v3TurnoutBaselinePct", "turnoutBaselinePct");
  bindFieldProxy("v3TurnoutTargetOverridePct", "turnoutTargetOverridePct");
  bindSelectProxy("v3TurnoutMode", "gotvMode");
  bindCheckboxProxy("v3TurnoutDiminishingToggle", "gotvDiminishing");

  bindFieldProxy("v3GotvLiftPP", "gotvLiftPP");
  bindFieldProxy("v3GotvMaxLiftPP", "gotvMaxLiftPP");
  bindFieldProxy("v3GotvLiftMin", "gotvLiftMin");
  bindFieldProxy("v3GotvLiftMode", "gotvLiftMode");
  bindFieldProxy("v3GotvLiftMax", "gotvLiftMax");
  bindFieldProxy("v3GotvMaxLiftPP2", "gotvMaxLiftPP2");
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

  syncFieldValue("v3TurnoutBaselinePct", "turnoutBaselinePct");
  syncFieldValue("v3TurnoutTargetOverridePct", "turnoutTargetOverridePct");
  syncSelectValue("v3TurnoutMode", "gotvMode");
  syncCheckboxValue("v3TurnoutDiminishingToggle", "gotvDiminishing");

  syncFieldValue("v3GotvLiftPP", "gotvLiftPP");
  syncFieldValue("v3GotvMaxLiftPP", "gotvMaxLiftPP");
  syncFieldValue("v3GotvLiftMin", "gotvLiftMin");
  syncFieldValue("v3GotvLiftMode", "gotvLiftMode");
  syncFieldValue("v3GotvLiftMax", "gotvLiftMax");
  syncFieldValue("v3GotvMaxLiftPP2", "gotvMaxLiftPP2");

  syncButtonDisabled("v3BtnRoiRefresh", "roiRefresh");
  syncCheckboxValue("v3TurnoutEnabledToggle", "turnoutEnabled");

  const v3Toggle = document.getElementById("v3TurnoutEnabledToggle");
  const legacyToggle = document.getElementById("turnoutEnabled");
  if (v3Toggle instanceof HTMLInputElement && legacyToggle instanceof HTMLInputElement) {
    v3Toggle.disabled = legacyToggle.disabled;
  }

  const v3Diminishing = document.getElementById("v3TurnoutDiminishingToggle");
  const legacyDiminishing = document.getElementById("gotvDiminishing");
  if (v3Diminishing instanceof HTMLInputElement && legacyDiminishing instanceof HTMLInputElement) {
    v3Diminishing.disabled = legacyDiminishing.disabled;
  }
}
