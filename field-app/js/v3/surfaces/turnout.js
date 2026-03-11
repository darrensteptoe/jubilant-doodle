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
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncControlDisabled,
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
  costBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--3">
      <div class="field">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Doors tactic</div>
          <label class="fpe-switch">
            <input id="v3RoiDoorsEnabled" type="checkbox"/>
            <span>Enable doors</span>
          </label>
        </div>
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="v3RoiDoorsCpa">Cost / attempt ($)</label>
            <input class="fpe-input" id="v3RoiDoorsCpa" min="0" step="0.01" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiDoorsKind">Tactic type</label>
            <select class="fpe-input" id="v3RoiDoorsKind"></select>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiDoorsCr">Contact rate override %</label>
            <input class="fpe-input" id="v3RoiDoorsCr" max="100" min="0" step="0.1" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiDoorsSr">Support rate override %</label>
            <input class="fpe-input" id="v3RoiDoorsSr" max="100" min="0" step="0.1" type="number"/>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Phones tactic</div>
          <label class="fpe-switch">
            <input id="v3RoiPhonesEnabled" type="checkbox"/>
            <span>Enable phones</span>
          </label>
        </div>
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="v3RoiPhonesCpa">Cost / attempt ($)</label>
            <input class="fpe-input" id="v3RoiPhonesCpa" min="0" step="0.01" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiPhonesKind">Tactic type</label>
            <select class="fpe-input" id="v3RoiPhonesKind"></select>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiPhonesCr">Contact rate override %</label>
            <input class="fpe-input" id="v3RoiPhonesCr" max="100" min="0" step="0.1" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiPhonesSr">Support rate override %</label>
            <input class="fpe-input" id="v3RoiPhonesSr" max="100" min="0" step="0.1" type="number"/>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Texts tactic</div>
          <label class="fpe-switch">
            <input id="v3RoiTextsEnabled" type="checkbox"/>
            <span>Enable texts</span>
          </label>
        </div>
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="v3RoiTextsCpa">Cost / attempt ($)</label>
            <input class="fpe-input" id="v3RoiTextsCpa" min="0" step="0.01" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiTextsKind">Tactic type</label>
            <select class="fpe-input" id="v3RoiTextsKind"></select>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiTextsCr">Contact rate override %</label>
            <input class="fpe-input" id="v3RoiTextsCr" max="100" min="0" step="0.1" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiTextsSr">Support rate override %</label>
            <input class="fpe-input" id="v3RoiTextsSr" max="100" min="0" step="0.1" type="number"/>
          </div>
        </div>
      </div>
    </div>

    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3RoiOverheadAmount">Overhead amount ($)</label>
        <input class="fpe-input" id="v3RoiOverheadAmount" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label">Include overhead in ROI</label>
        <label class="fpe-switch">
          <input id="v3RoiIncludeOverhead" type="checkbox"/>
          <span>Allocate overhead across required attempts</span>
        </label>
      </div>
    </div>
  `;

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

  bindCheckboxProxy("v3RoiDoorsEnabled", "roiDoorsEnabled");
  bindFieldProxy("v3RoiDoorsCpa", "roiDoorsCpa");
  bindSelectProxy("v3RoiDoorsKind", "roiDoorsKind");
  bindFieldProxy("v3RoiDoorsCr", "roiDoorsCr");
  bindFieldProxy("v3RoiDoorsSr", "roiDoorsSr");

  bindCheckboxProxy("v3RoiPhonesEnabled", "roiPhonesEnabled");
  bindFieldProxy("v3RoiPhonesCpa", "roiPhonesCpa");
  bindSelectProxy("v3RoiPhonesKind", "roiPhonesKind");
  bindFieldProxy("v3RoiPhonesCr", "roiPhonesCr");
  bindFieldProxy("v3RoiPhonesSr", "roiPhonesSr");

  bindCheckboxProxy("v3RoiTextsEnabled", "roiTextsEnabled");
  bindFieldProxy("v3RoiTextsCpa", "roiTextsCpa");
  bindSelectProxy("v3RoiTextsKind", "roiTextsKind");
  bindFieldProxy("v3RoiTextsCr", "roiTextsCr");
  bindFieldProxy("v3RoiTextsSr", "roiTextsSr");

  bindFieldProxy("v3RoiOverheadAmount", "roiOverheadAmount");
  bindCheckboxProxy("v3RoiIncludeOverhead", "roiIncludeOverhead");
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

  syncCheckboxValue("v3RoiDoorsEnabled", "roiDoorsEnabled");
  syncFieldValue("v3RoiDoorsCpa", "roiDoorsCpa");
  syncSelectValue("v3RoiDoorsKind", "roiDoorsKind");
  syncFieldValue("v3RoiDoorsCr", "roiDoorsCr");
  syncFieldValue("v3RoiDoorsSr", "roiDoorsSr");

  syncCheckboxValue("v3RoiPhonesEnabled", "roiPhonesEnabled");
  syncFieldValue("v3RoiPhonesCpa", "roiPhonesCpa");
  syncSelectValue("v3RoiPhonesKind", "roiPhonesKind");
  syncFieldValue("v3RoiPhonesCr", "roiPhonesCr");
  syncFieldValue("v3RoiPhonesSr", "roiPhonesSr");

  syncCheckboxValue("v3RoiTextsEnabled", "roiTextsEnabled");
  syncFieldValue("v3RoiTextsCpa", "roiTextsCpa");
  syncSelectValue("v3RoiTextsKind", "roiTextsKind");
  syncFieldValue("v3RoiTextsCr", "roiTextsCr");
  syncFieldValue("v3RoiTextsSr", "roiTextsSr");

  syncFieldValue("v3RoiOverheadAmount", "roiOverheadAmount");
  syncCheckboxValue("v3RoiIncludeOverhead", "roiIncludeOverhead");

  syncControlDisabled("v3TurnoutEnabledToggle", "turnoutEnabled");
  syncControlDisabled("v3TurnoutBaselinePct", "turnoutBaselinePct");
  syncControlDisabled("v3TurnoutTargetOverridePct", "turnoutTargetOverridePct");
  syncControlDisabled("v3TurnoutMode", "gotvMode");
  syncControlDisabled("v3TurnoutDiminishingToggle", "gotvDiminishing");
  syncControlDisabled("v3GotvLiftPP", "gotvLiftPP");
  syncControlDisabled("v3GotvMaxLiftPP", "gotvMaxLiftPP");
  syncControlDisabled("v3GotvLiftMin", "gotvLiftMin");
  syncControlDisabled("v3GotvLiftMode", "gotvLiftMode");
  syncControlDisabled("v3GotvLiftMax", "gotvLiftMax");
  syncControlDisabled("v3GotvMaxLiftPP2", "gotvMaxLiftPP2");
  syncControlDisabled("v3RoiDoorsEnabled", "roiDoorsEnabled");
  syncControlDisabled("v3RoiDoorsCpa", "roiDoorsCpa");
  syncControlDisabled("v3RoiDoorsKind", "roiDoorsKind");
  syncControlDisabled("v3RoiDoorsCr", "roiDoorsCr");
  syncControlDisabled("v3RoiDoorsSr", "roiDoorsSr");
  syncControlDisabled("v3RoiPhonesEnabled", "roiPhonesEnabled");
  syncControlDisabled("v3RoiPhonesCpa", "roiPhonesCpa");
  syncControlDisabled("v3RoiPhonesKind", "roiPhonesKind");
  syncControlDisabled("v3RoiPhonesCr", "roiPhonesCr");
  syncControlDisabled("v3RoiPhonesSr", "roiPhonesSr");
  syncControlDisabled("v3RoiTextsEnabled", "roiTextsEnabled");
  syncControlDisabled("v3RoiTextsCpa", "roiTextsCpa");
  syncControlDisabled("v3RoiTextsKind", "roiTextsKind");
  syncControlDisabled("v3RoiTextsCr", "roiTextsCr");
  syncControlDisabled("v3RoiTextsSr", "roiTextsSr");
  syncControlDisabled("v3RoiOverheadAmount", "roiOverheadAmount");
  syncControlDisabled("v3RoiIncludeOverhead", "roiIncludeOverhead");

  syncButtonDisabled("v3BtnRoiRefresh", "roiRefresh");
}
