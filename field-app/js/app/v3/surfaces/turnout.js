import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
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
  syncLegacyTableRows,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderTurnoutSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const controlsCol = createColumn("controls");
  const analysisCol = createColumn("analysis");
  const resultsCol = createColumn("results");

  const assumptionsCard = createCard({
    title: "Turnout assumptions",
    description: "Baseline turnout, target override, and module activation for realized-vote modeling."
  });

  const liftCard = createCard({
    title: "Lift controls",
    description: "Diminishing-return behavior and lift parameters used to estimate turnout response."
  });

  const costInputsCard = createCard({
    title: "Efficiency inputs",
    description: "Per-attempt tactic settings and overhead assumptions for ROI comparison."
  });

  const efficiencyCard = createCard({
    title: "Efficiency comparison",
    description: "Cost-per-net-vote and tactic comparison under current turnout assumptions."
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
    description: "Turnout contribution against persuasion vote requirements and forecast posture."
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
  efficiencyBody.innerHTML = `
    <div class="fpe-action-row">
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnRoiRefresh" type="button">Refresh</button>
    </div>
    <div class="table-wrap">
      <table class="table" aria-label="Turnout efficiency comparison">
        <thead>
          <tr>
            <th>Tactic</th>
            <th class="num">Cost / attempt</th>
            <th class="num">Cost / net vote</th>
            <th class="num">Cost / TA net vote</th>
            <th class="num">Total cost to close gap</th>
            <th>Feasibility</th>
          </tr>
        </thead>
        <tbody id="v3TurnoutRoiTbody">
          <tr>
            <td class="muted" colspan="6">Refresh ROI to compute efficiency comparison.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">ROI status</div>
      <div class="fpe-help fpe-help--flush" id="v3TurnoutRoiBanner">-</div>
    </div>
    <div class="fpe-help fpe-help--flush">
      ROI backbone: Attempts -> Contacts (CR) -> Support IDs (SR) -> Net votes (turnout-adjusted). Costs are deterministic.
    </div>
  `;

  const impactBody = getCardBody(impactCard);
  impactBody.insertAdjacentHTML(
    "beforeend",
    `
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Turnout status</div>
        <div class="fpe-help fpe-help--flush" id="v3TurnoutStatusBanner">-</div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Expected turnout votes</div>
          <div class="fpe-turnout-impact-value" id="v3TurnoutImpactVotes">-</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Persuasion votes needed</div>
          <div class="fpe-turnout-impact-value" id="v3TurnoutImpactNeed">-</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Projected margin context</div>
          <div class="fpe-turnout-impact-value" id="v3TurnoutImpactMargin">-</div>
        </div>
      </div>
      <div class="fpe-summary-grid">
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
  analysisCol.append(efficiencyCard, costInputsCard);
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
  const turnoutSummary = String(snapshot.turnoutSummary || "").trim();
  const turnoutVotes = String(snapshot.turnoutVotes || "").trim();
  const needVotes = String(snapshot.needVotes || "").trim();

  setText("v3TurnoutSummary", turnoutSummary || "-");
  setText("v3TurnoutVotes", turnoutVotes || "-");
  setText("v3TurnoutNeedVotes", needVotes || "-");
  setText("v3TurnoutImpactVotes", turnoutVotes || "-");
  setText("v3TurnoutImpactNeed", needVotes || "-");
  setText("v3TurnoutImpactMargin", readTurnoutMarginContext());
  setText("v3TurnoutImpactWinProb", readV3WinProbability());
  setText("v3TurnoutStatusBanner", buildTurnoutStatusBanner(turnoutSummary, turnoutVotes, needVotes));
  syncLegacyTableRows({
    sourceSelector: "#roiTbody",
    targetBodyId: "v3TurnoutRoiTbody",
    expectedCols: 6,
    emptyLabel: "Refresh ROI to compute efficiency comparison.",
    numericColumns: [1, 2, 3, 4]
  });
  setText("v3TurnoutRoiBanner", buildRoiStatusBanner());

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

function readTurnoutMarginContext() {
  const kpiMargin = readText("#v3KpiMargin .fpe-kpi__value").trim();
  if (kpiMargin) {
    return kpiMargin;
  }
  return "—";
}

function readV3WinProbability() {
  const value = readText("#v3KpiWinProb .fpe-kpi__value");
  return value || "—";
}

function buildTurnoutStatusBanner(summary, turnoutVotes, needVotes) {
  if (summary) {
    return summary;
  }
  if (turnoutVotes || needVotes) {
    return `Expected turnout votes ${turnoutVotes || "—"} vs persuasion need ${needVotes || "—"}.`;
  }
  return "Set turnout assumptions and refresh ROI to evaluate realized-vote impact.";
}

function buildRoiStatusBanner() {
  const bodyText = readText("#v3TurnoutRoiTbody");
  if (!bodyText || /refresh roi to compute/i.test(bodyText)) {
    return "Refresh ROI to compute efficiency comparison.";
  }
  return "ROI comparison reflects current tactic settings.";
}
