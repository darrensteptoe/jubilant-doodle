import {
  createCenterModuleCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { readTurnoutSnapshot } from "../stateBridge.js";
import {
  readText,
  setText,
} from "../surfaceUtils.js";
import {
  TURNOUT_STATUS_AWAITING_SETUP,
  buildRoiStatusBanner,
  buildTurnoutStatusBanner,
  classifyTurnoutStatusTone,
  deriveTurnoutAssumptionsCardStatus,
  deriveTurnoutCostCardStatus,
  deriveTurnoutEfficiencyCardStatus,
  deriveTurnoutImpactCardStatus,
  deriveTurnoutLiftCardStatus,
  deriveTurnoutSummaryCardStatus,
  formatTurnoutCurrency,
} from "../../../core/turnoutView.js";

const TURNOUT_API_KEY = "__FPE_TURNOUT_API__";

export function renderTurnoutSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const inputsCol = createColumn("left");
  const resultsCol = createColumn("right");

  const assumptionsCard = createCenterModuleCard({
    title: "Turnout assumptions",
    description: "Baseline turnout, target override, and activation settings for realized-vote modeling.",
    status: "Module off"
  });

  const liftCard = createCenterModuleCard({
    title: "Lift controls",
    description: "Diminishing-return behavior and lift parameters used to estimate turnout response under contact pressure.",
    status: "Awaiting setup"
  });

  const costInputsCard = createCenterModuleCard({
    title: "Efficiency inputs",
    description: "Per-attempt tactic settings and overhead assumptions used by ROI comparison.",
    status: "Awaiting setup"
  });

  const efficiencyCard = createCenterModuleCard({
    title: "Efficiency comparison",
    description: "Cost-per-net-vote and tactic comparison under current turnout and conversion assumptions.",
    status: "Awaiting refresh"
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

  const impactCard = createCenterModuleCard({
    title: "Realized vote impact",
    description: "Turnout contribution against persuasion vote requirements and current forecast posture.",
    status: "Awaiting setup"
  });

  const summaryCard = createCenterModuleCard({
    title: "Turnout summary",
    description: "Current turnout context, vote-impact readout, and setup readiness.",
    status: "Awaiting setup"
  });

  assignCardStatusId(assumptionsCard, "v3TurnoutAssumptionsCardStatus");
  assignCardStatusId(liftCard, "v3TurnoutLiftCardStatus");
  assignCardStatusId(costInputsCard, "v3TurnoutCostCardStatus");
  assignCardStatusId(efficiencyCard, "v3TurnoutEfficiencyCardStatus");
  assignCardStatusId(impactCard, "v3TurnoutImpactCardStatus");
  assignCardStatusId(summaryCard, "v3TurnoutSummaryCardStatus");

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
    <div class="fpe-help fpe-help--flush">
      Example: keep persuasion assumptions fixed and test turnout module settings to isolate participation-driven vote gains.
    </div>
  `;

  const liftBody = getCardBody(liftCard);
  liftBody.innerHTML = `
    <div class="fpe-action-row">
      <label class="fpe-switch">
        <input id="v3TurnoutDiminishingToggle" type="checkbox"/>
        <span>Diminishing returns</span>
      </label>
      <span class="fpe-help fpe-help--flush">When ON, marginal lift tapers as turnout approaches the local participation ceiling.</span>
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
    <div class="fpe-field-grid fpe-field-grid--1 fpe-turnout-efficiency-stack">
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

      <div class="field">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Lit Drop tactic</div>
          <label class="fpe-switch">
            <input id="v3RoiLitDropEnabled" type="checkbox"/>
            <span>Enable lit drop</span>
          </label>
        </div>
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="v3RoiLitDropCpa">Cost / attempt ($)</label>
            <input class="fpe-input" id="v3RoiLitDropCpa" min="0" step="0.01" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiLitDropKind">Tactic type</label>
            <select class="fpe-input" id="v3RoiLitDropKind"></select>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiLitDropCr">Contact rate override %</label>
            <input class="fpe-input" id="v3RoiLitDropCr" max="100" min="0" step="0.1" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiLitDropSr">Support rate override %</label>
            <input class="fpe-input" id="v3RoiLitDropSr" max="100" min="0" step="0.1" type="number"/>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Mail tactic</div>
          <label class="fpe-switch">
            <input id="v3RoiMailEnabled" type="checkbox"/>
            <span>Enable mail</span>
          </label>
        </div>
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="v3RoiMailCpa">Cost / attempt ($)</label>
            <input class="fpe-input" id="v3RoiMailCpa" min="0" step="0.01" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiMailKind">Tactic type</label>
            <select class="fpe-input" id="v3RoiMailKind"></select>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiMailCr">Contact rate override %</label>
            <input class="fpe-input" id="v3RoiMailCr" max="100" min="0" step="0.1" type="number"/>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3RoiMailSr">Support rate override %</label>
            <input class="fpe-input" id="v3RoiMailSr" max="100" min="0" step="0.1" type="number"/>
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

    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Channel cost realism</div>
      <div class="fpe-help fpe-help--flush">Use these ranges as plausibility checks, not automatic truth. A figure can be technically possible and still be weak enough to deserve review before the team leans on it.</div>
      <div class="fpe-help fpe-help--flush"><strong>Doors</strong> Healthy working range: about <strong>$0.08 to $0.80 per attempt</strong>. Review closely below <strong>$0.08</strong> or above <strong>$0.80</strong>. Treat values below <strong>$0.04</strong> or above <strong>$1.25</strong> as severe realism problems unless the campaign can explain them clearly.</div>
      <div class="fpe-help fpe-help--flush"><strong>Phones</strong> Healthy working range: about <strong>$0.01 to $0.20 per attempt</strong>. Review closely below <strong>$0.01</strong> or above <strong>$0.20</strong>. Treat values below <strong>$0.005</strong> or above <strong>$0.40</strong> as severe realism problems unless the campaign can explain them clearly.</div>
      <div class="fpe-help fpe-help--flush"><strong>Texts</strong> Healthy working range: about <strong>$0.005 to $0.15 per attempt</strong>. Review closely below <strong>$0.005</strong> or above <strong>$0.15</strong>. Treat values below <strong>$0.003</strong> or above <strong>$0.30</strong> as severe realism problems unless the campaign can explain them clearly.</div>
      <div class="fpe-help fpe-help--flush"><strong>Lit Drop</strong> Healthy working range: about <strong>$0.06 to $0.65 per attempt</strong>. Review closely below <strong>$0.06</strong> or above <strong>$0.65</strong>. Treat values below <strong>$0.03</strong> or above <strong>$1.10</strong> as severe realism problems unless the campaign can explain them clearly.</div>
      <div class="fpe-help fpe-help--flush"><strong>Mail</strong> Healthy working range: about <strong>$0.30 to $2.50 per attempt</strong>. Review closely below <strong>$0.30</strong> or above <strong>$2.50</strong>. Treat values below <strong>$0.20</strong> or above <strong>$4.00</strong> as severe realism problems unless the campaign can explain them clearly.</div>
      <div class="fpe-help fpe-help--flush">Cheap numbers are not automatically good numbers. If a cost assumption only works because it ignores labor reality, vendor friction, volunteer dependency, or fulfillment overhead, it should not be treated as decision-grade.</div>
    </div>

    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">How to use tactic rows</div>
      <div class="fpe-help fpe-help--flush">Enable only the channels the campaign is genuinely prepared to execute. A tactic that looks efficient on paper but is not operationally real should not be allowed to inflate the plan.</div>
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
    <div class="fpe-help fpe-help--flush">
      Use this table for tactic ranking. It does not change model math until inputs above are updated and refreshed.
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

  inputsCol.append(assumptionsCard, liftCard, costInputsCard, efficiencyCard);
  resultsCol.append(summaryCard, impactCard);
  frame.append(inputsCol, resultsCol);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Turnout mechanics are distinct from persuasion assumptions and should be tuned separately.",
      "Efficiency comparison prevents over-investment in tactics that look busy but convert poorly.",
      "Use this page to test lift realism before finalizing execution workload or forecast commitments."
    ])
  );

  wireTurnoutControlProxies();
  return refreshTurnoutSummary;
}

function wireTurnoutControlProxies() {
  bindTurnoutAction("v3BtnRoiRefresh", "refreshRoi");

  bindTurnoutCheckbox("v3TurnoutEnabledToggle", "turnoutEnabled");
  bindTurnoutField("v3TurnoutBaselinePct", "turnoutBaselinePct");
  bindTurnoutField("v3TurnoutTargetOverridePct", "turnoutTargetOverridePct");
  bindTurnoutSelect("v3TurnoutMode", "gotvMode");
  bindTurnoutCheckbox("v3TurnoutDiminishingToggle", "gotvDiminishing");

  bindTurnoutField("v3GotvLiftPP", "gotvLiftPP");
  bindTurnoutField("v3GotvMaxLiftPP", "gotvMaxLiftPP");
  bindTurnoutField("v3GotvLiftMin", "gotvLiftMin");
  bindTurnoutField("v3GotvLiftMode", "gotvLiftMode");
  bindTurnoutField("v3GotvLiftMax", "gotvLiftMax");
  bindTurnoutField("v3GotvMaxLiftPP2", "gotvMaxLiftPP2");

  bindTurnoutCheckbox("v3RoiDoorsEnabled", "roiDoorsEnabled");
  bindTurnoutField("v3RoiDoorsCpa", "roiDoorsCpa");
  bindTurnoutSelect("v3RoiDoorsKind", "roiDoorsKind");
  bindTurnoutField("v3RoiDoorsCr", "roiDoorsCr");
  bindTurnoutField("v3RoiDoorsSr", "roiDoorsSr");

  bindTurnoutCheckbox("v3RoiPhonesEnabled", "roiPhonesEnabled");
  bindTurnoutField("v3RoiPhonesCpa", "roiPhonesCpa");
  bindTurnoutSelect("v3RoiPhonesKind", "roiPhonesKind");
  bindTurnoutField("v3RoiPhonesCr", "roiPhonesCr");
  bindTurnoutField("v3RoiPhonesSr", "roiPhonesSr");

  bindTurnoutCheckbox("v3RoiTextsEnabled", "roiTextsEnabled");
  bindTurnoutField("v3RoiTextsCpa", "roiTextsCpa");
  bindTurnoutSelect("v3RoiTextsKind", "roiTextsKind");
  bindTurnoutField("v3RoiTextsCr", "roiTextsCr");
  bindTurnoutField("v3RoiTextsSr", "roiTextsSr");

  bindTurnoutCheckbox("v3RoiLitDropEnabled", "roiLitDropEnabled");
  bindTurnoutField("v3RoiLitDropCpa", "roiLitDropCpa");
  bindTurnoutSelect("v3RoiLitDropKind", "roiLitDropKind");
  bindTurnoutField("v3RoiLitDropCr", "roiLitDropCr");
  bindTurnoutField("v3RoiLitDropSr", "roiLitDropSr");

  bindTurnoutCheckbox("v3RoiMailEnabled", "roiMailEnabled");
  bindTurnoutField("v3RoiMailCpa", "roiMailCpa");
  bindTurnoutSelect("v3RoiMailKind", "roiMailKind");
  bindTurnoutField("v3RoiMailCr", "roiMailCr");
  bindTurnoutField("v3RoiMailSr", "roiMailSr");

  bindTurnoutField("v3RoiOverheadAmount", "roiOverheadAmount");
  bindTurnoutCheckbox("v3RoiIncludeOverhead", "roiIncludeOverhead");
}

function refreshTurnoutSummary() {
  const turnoutView = readTurnoutView();
  const bridgeSummary = turnoutView?.summary && typeof turnoutView.summary === "object"
    ? turnoutView.summary
    : {};
  const snapshot = readTurnoutSnapshot();
  const turnoutSummary = String(bridgeSummary.turnoutSummaryText || snapshot.turnoutSummary || "").trim();
  const turnoutVotes = String(bridgeSummary.turnoutVotesText || snapshot.turnoutVotes || "").trim();
  const needVotes = String(bridgeSummary.needVotesText || snapshot.needVotes || "").trim();

  setText("v3TurnoutSummary", turnoutSummary || "-");
  setText("v3TurnoutVotes", turnoutVotes || "-");
  setText("v3TurnoutNeedVotes", needVotes || "-");
  setText("v3TurnoutImpactVotes", turnoutVotes || "-");
  setText("v3TurnoutImpactNeed", needVotes || "-");
  setText("v3TurnoutImpactMargin", readTurnoutMarginContext());
  const turnoutWinProb = readV3WinProbability();
  const turnoutStatusBanner = buildTurnoutStatusBanner(turnoutSummary, turnoutVotes, needVotes);
  setText("v3TurnoutImpactWinProb", turnoutWinProb);
  setText("v3TurnoutStatusBanner", turnoutStatusBanner);
  applyTurnoutView(turnoutView);
  const roiBanner = buildRoiStatusBanner(turnoutView);
  setText("v3TurnoutRoiBanner", roiBanner);
  syncTurnoutCardStatus("v3TurnoutAssumptionsCardStatus", deriveTurnoutAssumptionsCardStatus(turnoutView));
  syncTurnoutCardStatus("v3TurnoutLiftCardStatus", deriveTurnoutLiftCardStatus(turnoutView));
  syncTurnoutCardStatus("v3TurnoutCostCardStatus", deriveTurnoutCostCardStatus(turnoutView));
  syncTurnoutCardStatus("v3TurnoutEfficiencyCardStatus", deriveTurnoutEfficiencyCardStatus(turnoutView, roiBanner));
  syncTurnoutCardStatus("v3TurnoutImpactCardStatus", deriveTurnoutImpactCardStatus(turnoutStatusBanner, turnoutWinProb));
  syncTurnoutCardStatus("v3TurnoutSummaryCardStatus", deriveTurnoutSummaryCardStatus(turnoutSummary, turnoutVotes, needVotes));
}

function bindTurnoutField(id, field) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (input.dataset.v3TurnoutBound === "1") {
    return;
  }
  input.dataset.v3TurnoutBound = "1";
  const onInput = () => {
    const api = getTurnoutApi();
    if (!api || typeof api.setField !== "function") {
      return;
    }
    api.setField(field, input.value);
  };
  input.addEventListener("input", onInput);
  input.addEventListener("change", onInput);
}

function bindTurnoutCheckbox(id, field) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (input.dataset.v3TurnoutBound === "1") {
    return;
  }
  input.dataset.v3TurnoutBound = "1";
  input.addEventListener("change", () => {
    const api = getTurnoutApi();
    if (!api || typeof api.setField !== "function") {
      return;
    }
    api.setField(field, input.checked);
  });
}

function bindTurnoutSelect(id, field) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLSelectElement)) {
    return;
  }
  if (input.dataset.v3TurnoutBound === "1") {
    return;
  }
  input.dataset.v3TurnoutBound = "1";
  input.addEventListener("change", () => {
    const api = getTurnoutApi();
    if (!api || typeof api.setField !== "function") {
      return;
    }
    api.setField(field, input.value);
  });
}

function bindTurnoutAction(id, actionName) {
  const button = document.getElementById(id);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  if (button.dataset.v3TurnoutBound === "1") {
    return;
  }
  button.dataset.v3TurnoutBound = "1";
  button.addEventListener("click", () => {
    const api = getTurnoutApi();
    if (!api || typeof api[actionName] !== "function") {
      return;
    }
    api[actionName]();
  });
}

function syncTurnoutInputValue(id, value) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.value = value == null ? "" : String(value);
}

function syncTurnoutCheckboxValue(id, value) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.checked = !!value;
}

function syncTurnoutSelectOptions(id, options, selectedValue) {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const normalized = Array.isArray(options)
    ? options.map((option) => ({
        value: String(option?.value ?? ""),
        label: String(option?.label ?? option?.value ?? "")
      }))
    : [];
  const current = Array.from(select.options).map((option) => `${option.value}::${option.textContent || ""}`);
  const next = normalized.map((option) => `${option.value}::${option.label}`);
  const isSame = current.length === next.length && current.every((item, index) => item === next[index]);
  if (!isSame) {
    select.innerHTML = "";
    normalized.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    });
  }
  if (document.activeElement === select) {
    return;
  }
  const wanted = selectedValue == null ? "" : String(selectedValue);
  if (wanted && !Array.from(select.options).some((option) => option.value === wanted)) {
    const extra = document.createElement("option");
    extra.value = wanted;
    extra.textContent = wanted;
    select.appendChild(extra);
  }
  select.value = wanted;
}

function setTurnoutControlDisabled(id, disabled) {
  const control = document.getElementById(id);
  if (
    !(control instanceof HTMLInputElement) &&
    !(control instanceof HTMLSelectElement) &&
    !(control instanceof HTMLButtonElement)
  ) {
    return;
  }
  control.disabled = !!disabled;
}

function applyTurnoutView(view) {
  if (!view || typeof view !== "object") {
    return;
  }
  const inputs = view.inputs && typeof view.inputs === "object" ? view.inputs : {};
  const options = view.options && typeof view.options === "object" ? view.options : {};
  const controls = view.controls && typeof view.controls === "object" ? view.controls : {};

  syncTurnoutSelectOptions("v3TurnoutMode", options.gotvMode || [], inputs.gotvMode);
  syncTurnoutSelectOptions("v3RoiDoorsKind", options.tacticKind || [], inputs.roiDoorsKind);
  syncTurnoutSelectOptions("v3RoiPhonesKind", options.tacticKind || [], inputs.roiPhonesKind);
  syncTurnoutSelectOptions("v3RoiTextsKind", options.tacticKind || [], inputs.roiTextsKind);
  syncTurnoutSelectOptions("v3RoiLitDropKind", options.tacticKind || [], inputs.roiLitDropKind);
  syncTurnoutSelectOptions("v3RoiMailKind", options.tacticKind || [], inputs.roiMailKind);

  syncTurnoutCheckboxValue("v3TurnoutEnabledToggle", inputs.turnoutEnabled);
  syncTurnoutInputValue("v3TurnoutBaselinePct", inputs.turnoutBaselinePct);
  syncTurnoutInputValue("v3TurnoutTargetOverridePct", inputs.turnoutTargetOverridePct);
  syncTurnoutCheckboxValue("v3TurnoutDiminishingToggle", inputs.gotvDiminishing);
  syncTurnoutInputValue("v3GotvLiftPP", inputs.gotvLiftPP);
  syncTurnoutInputValue("v3GotvMaxLiftPP", inputs.gotvMaxLiftPP);
  syncTurnoutInputValue("v3GotvLiftMin", inputs.gotvLiftMin);
  syncTurnoutInputValue("v3GotvLiftMode", inputs.gotvLiftMode);
  syncTurnoutInputValue("v3GotvLiftMax", inputs.gotvLiftMax);
  syncTurnoutInputValue("v3GotvMaxLiftPP2", inputs.gotvMaxLiftPP2);

  syncTurnoutCheckboxValue("v3RoiDoorsEnabled", inputs.roiDoorsEnabled);
  syncTurnoutInputValue("v3RoiDoorsCpa", inputs.roiDoorsCpa);
  syncTurnoutInputValue("v3RoiDoorsCr", inputs.roiDoorsCr);
  syncTurnoutInputValue("v3RoiDoorsSr", inputs.roiDoorsSr);

  syncTurnoutCheckboxValue("v3RoiPhonesEnabled", inputs.roiPhonesEnabled);
  syncTurnoutInputValue("v3RoiPhonesCpa", inputs.roiPhonesCpa);
  syncTurnoutInputValue("v3RoiPhonesCr", inputs.roiPhonesCr);
  syncTurnoutInputValue("v3RoiPhonesSr", inputs.roiPhonesSr);

  syncTurnoutCheckboxValue("v3RoiTextsEnabled", inputs.roiTextsEnabled);
  syncTurnoutInputValue("v3RoiTextsCpa", inputs.roiTextsCpa);
  syncTurnoutInputValue("v3RoiTextsCr", inputs.roiTextsCr);
  syncTurnoutInputValue("v3RoiTextsSr", inputs.roiTextsSr);

  syncTurnoutCheckboxValue("v3RoiLitDropEnabled", inputs.roiLitDropEnabled);
  syncTurnoutInputValue("v3RoiLitDropCpa", inputs.roiLitDropCpa);
  syncTurnoutInputValue("v3RoiLitDropCr", inputs.roiLitDropCr);
  syncTurnoutInputValue("v3RoiLitDropSr", inputs.roiLitDropSr);

  syncTurnoutCheckboxValue("v3RoiMailEnabled", inputs.roiMailEnabled);
  syncTurnoutInputValue("v3RoiMailCpa", inputs.roiMailCpa);
  syncTurnoutInputValue("v3RoiMailCr", inputs.roiMailCr);
  syncTurnoutInputValue("v3RoiMailSr", inputs.roiMailSr);

  syncTurnoutInputValue("v3RoiOverheadAmount", inputs.roiOverheadAmount);
  syncTurnoutCheckboxValue("v3RoiIncludeOverhead", inputs.roiIncludeOverhead);
  renderTurnoutRoiRows(view.roiRows);

  const locked = !!controls.locked;
  setTurnoutControlDisabled("v3TurnoutEnabledToggle", locked);
  setTurnoutControlDisabled("v3TurnoutBaselinePct", locked);
  setTurnoutControlDisabled("v3TurnoutTargetOverridePct", locked);
  setTurnoutControlDisabled("v3TurnoutMode", locked);
  setTurnoutControlDisabled("v3TurnoutDiminishingToggle", locked);
  setTurnoutControlDisabled("v3GotvLiftPP", locked);
  setTurnoutControlDisabled("v3GotvMaxLiftPP", locked);
  setTurnoutControlDisabled("v3GotvLiftMin", locked);
  setTurnoutControlDisabled("v3GotvLiftMode", locked);
  setTurnoutControlDisabled("v3GotvLiftMax", locked);
  setTurnoutControlDisabled("v3GotvMaxLiftPP2", locked);
  setTurnoutControlDisabled("v3RoiDoorsEnabled", locked);
  setTurnoutControlDisabled("v3RoiDoorsCpa", locked);
  setTurnoutControlDisabled("v3RoiDoorsKind", locked);
  setTurnoutControlDisabled("v3RoiDoorsCr", locked);
  setTurnoutControlDisabled("v3RoiDoorsSr", locked);
  setTurnoutControlDisabled("v3RoiPhonesEnabled", locked);
  setTurnoutControlDisabled("v3RoiPhonesCpa", locked);
  setTurnoutControlDisabled("v3RoiPhonesKind", locked);
  setTurnoutControlDisabled("v3RoiPhonesCr", locked);
  setTurnoutControlDisabled("v3RoiPhonesSr", locked);
  setTurnoutControlDisabled("v3RoiTextsEnabled", locked);
  setTurnoutControlDisabled("v3RoiTextsCpa", locked);
  setTurnoutControlDisabled("v3RoiTextsKind", locked);
  setTurnoutControlDisabled("v3RoiTextsCr", locked);
  setTurnoutControlDisabled("v3RoiTextsSr", locked);
  setTurnoutControlDisabled("v3RoiLitDropEnabled", locked);
  setTurnoutControlDisabled("v3RoiLitDropCpa", locked);
  setTurnoutControlDisabled("v3RoiLitDropKind", locked);
  setTurnoutControlDisabled("v3RoiLitDropCr", locked);
  setTurnoutControlDisabled("v3RoiLitDropSr", locked);
  setTurnoutControlDisabled("v3RoiMailEnabled", locked);
  setTurnoutControlDisabled("v3RoiMailCpa", locked);
  setTurnoutControlDisabled("v3RoiMailKind", locked);
  setTurnoutControlDisabled("v3RoiMailCr", locked);
  setTurnoutControlDisabled("v3RoiMailSr", locked);
  setTurnoutControlDisabled("v3RoiOverheadAmount", locked);
  setTurnoutControlDisabled("v3RoiIncludeOverhead", locked);
  setTurnoutControlDisabled("v3BtnRoiRefresh", !!controls.refreshDisabled);
}

function renderTurnoutRoiRows(rows) {
  const tbody = document.getElementById("v3TurnoutRoiTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  tbody.innerHTML = "";

  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="muted" colspan="6">Refresh ROI to compute efficiency comparison.</td>`;
    tbody.appendChild(tr);
    return;
  }

  list.forEach((row) => {
    const tr = document.createElement("tr");

    const td0 = document.createElement("td");
    td0.textContent = String(row?.label || "—");

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = formatTurnoutCurrency(row?.cpa, 2);

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = formatTurnoutCurrency(row?.costPerNetVote, 2);

    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = formatTurnoutCurrency(row?.costPerTurnoutAdjustedNetVote, 2);

    const td4 = document.createElement("td");
    td4.className = "num";
    td4.textContent = formatTurnoutCurrency(row?.totalCost, 0);

    const td5 = document.createElement("td");
    td5.textContent = String(row?.feasibilityText || "—");

    tr.append(td0, td1, td2, td3, td4, td5);
    tbody.appendChild(tr);
  });
}

function getTurnoutApi() {
  const api = window[TURNOUT_API_KEY];
  if (!api || typeof api !== "object" || typeof api.getView !== "function") {
    return null;
  }
  return api;
}

function readTurnoutView() {
  const api = getTurnoutApi();
  if (!api) {
    return null;
  }
  try {
    const view = api.getView();
    return view && typeof view === "object" ? view : null;
  } catch {
    return null;
  }
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

function assignCardStatusId(card, id) {
  if (!(card instanceof HTMLElement) || !id) {
    return;
  }
  const badge = card.querySelector(".fpe-card__status");
  if (badge instanceof HTMLElement) {
    badge.id = id;
  }
}

function syncTurnoutCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || TURNOUT_STATUS_AWAITING_SETUP;
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyTurnoutStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
}
