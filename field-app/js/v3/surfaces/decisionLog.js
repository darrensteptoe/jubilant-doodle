import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest } from "../compat.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  bindFieldProxy,
  bindSelectProxy,
  syncControlDisabled,
  readSelectedLabel,
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncFieldValue,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderDecisionLogSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const contextCol = createColumn("context");
  const optionsCol = createColumn("options");
  const outputCol = createColumn("output");

  const sessionCard = createCard({
    title: "Session context",
    description: "Session selection, objective, scenario linkage, and working notes."
  });

  const assumptionsCard = createCard({
    title: "Assumptions & constraints",
    description: "Budget, volunteer capacity, turf limits, blackout windows, and non-negotiables."
  });

  const optionsCard = createCard({
    title: "Option design",
    description: "Alternative paths, option linkage, and tactic tagging for each option."
  });

  const diagnosticsCard = createCard({
    title: "Decision diagnostics",
    description: "Drift, risk, bottlenecks, sensitivity snapshot, and confidence framing."
  });

  const recommendationCard = createCard({
    title: "Recommendation output",
    description: "Selected recommendation, required truths, and client-ready summary export."
  });

  const summaryCard = createCard({
    title: "Decision summary",
    description: "Current decision posture at a glance."
  });

  getCardBody(sessionCard).innerHTML = `
    <div id="v3DecisionBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Create a dedicated session for each decision checkpoint.</li>
          <li>Link the active scenario before recording rationale.</li>
          <li>Keep notes concise and decision-focused for auditability.</li>
        </ul>
      </div>
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Active session</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionActiveLabel">-</div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionSessionSelect">Sessions</label>
          <select class="fpe-input" id="v3DecisionSessionSelect"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label">Session actions</label>
          <div class="fpe-action-row">
            <button class="fpe-btn" id="v3BtnDecisionNew" type="button">New session</button>
          </div>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionRename">Rename session</label>
          <input class="fpe-input" id="v3DecisionRename" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label">Rename actions</label>
          <div class="fpe-action-row">
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionRenameSave" type="button">Save</button>
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionDelete" type="button">Delete</button>
          </div>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionObjective">Objective</label>
          <select class="fpe-input" id="v3DecisionObjective"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label">Scenario linkage</label>
          <div class="fpe-action-row">
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionLinkScenario" type="button">Link to active scenario</button>
          </div>
          <div class="fpe-contained-block">
            <div class="fpe-help fpe-help--flush" id="v3DecisionScenarioLabel">-</div>
          </div>
        </div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionNotes">Notes</label>
        <textarea class="fpe-input" id="v3DecisionNotes" rows="5"></textarea>
      </div>
    </div>
  `;

  getCardBody(assumptionsCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Set hard constraints first so option scoring reflects real operating limits.</li>
        <li>Use non-negotiables to encode client or compliance requirements.</li>
      </ul>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionBudget">Budget cap ($)</label>
        <input class="fpe-input" id="v3DecisionBudget" inputmode="decimal" type="text"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionVolunteerHrs">Volunteer hrs/week</label>
        <input class="fpe-input" id="v3DecisionVolunteerHrs" inputmode="decimal" type="text"/>
      </div>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionTurfAccess">Turf access</label>
        <select class="fpe-input" id="v3DecisionTurfAccess"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionBlackoutDates">Blackout dates</label>
        <input class="fpe-input" id="v3DecisionBlackoutDates" type="text"/>
      </div>
    </div>
    <div class="fpe-field-grid fpe-field-grid--1">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionRiskPosture">Risk posture</label>
        <select class="fpe-input" id="v3DecisionRiskPosture"></select>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DecisionNonNegotiables">Non-negotiables (one per line)</label>
      <textarea class="fpe-input" id="v3DecisionNonNegotiables" rows="4"></textarea>
    </div>
  `;

  getCardBody(optionsCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Keep option names concise and operationally distinct.</li>
        <li>Attach scenario linkage per option before recommendation export.</li>
      </ul>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionOptionSelect">Option</label>
        <select class="fpe-input" id="v3DecisionOptionSelect"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label">Option actions</label>
        <div class="fpe-action-row">
          <button class="fpe-btn" id="v3BtnDecisionOptionNew" type="button">New option</button>
        </div>
      </div>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionOptionRename">Rename option</label>
        <input class="fpe-input" id="v3DecisionOptionRename" type="text"/>
      </div>
      <div class="field">
        <label class="fpe-control-label">Rename actions</label>
        <div class="fpe-action-row">
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionOptionRenameSave" type="button">Save</button>
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionOptionDelete" type="button">Delete</button>
        </div>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label">Option scenario</label>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionOptionLinkScenario" type="button">Link option to active scenario</button>
      </div>
      <div class="fpe-contained-block">
        <div class="fpe-help fpe-help--flush" id="v3DecisionOptionScenarioLabel">-</div>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label">Tactics tags</label>
      <div class="fpe-action-row">
        <label class="fpe-switch"><input id="v3DecisionOptionTacticDoors" type="checkbox"/><span>Doors</span></label>
        <label class="fpe-switch"><input id="v3DecisionOptionTacticPhones" type="checkbox"/><span>Phones</span></label>
        <label class="fpe-switch"><input id="v3DecisionOptionTacticDigital" type="checkbox"/><span>Digital</span></label>
      </div>
    </div>
  `;

  const diagnosticsBody = getCardBody(diagnosticsCard);
  diagnosticsBody.innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Read drift and risk first, then confirm bottlenecks before recommendation lock.</li>
        <li>Use sensitivity snapshot as a sanity check before client summary export.</li>
      </ul>
    </div>
  `;
  mountDecisionRow(diagnosticsBody, "v3-decision-drift-tag-row", "#driftStatusTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-drift-kpis-row", "#driftReq");
  mountDecisionRow(diagnosticsBody, "v3-decision-drift-banner-row", "#driftSlipBanner");
  mountDecisionRow(diagnosticsBody, "v3-decision-risk-tag-row", "#riskBandTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-risk-kpis-row", "#riskWinProb");
  mountDecisionRow(diagnosticsBody, "v3-decision-risk-banner-row", "#riskPlainBanner");
  mountDecisionRow(diagnosticsBody, "v3-decision-bneck-tag-row", "#bneckTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-bneck-kpis-row", "#bneckPrimary");
  mountDecisionRow(diagnosticsBody, "v3-decision-bneck-table-row", "#bneckTbody");
  mountDecisionRow(diagnosticsBody, "v3-decision-sens-tag-row", "#sensTag");
  const sensitivityActions = document.createElement("div");
  sensitivityActions.className = "fpe-action-row";
  sensitivityActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionSensRun" type="button">Run snapshot</button>
  `;
  diagnosticsBody.append(sensitivityActions);
  mountDecisionRow(diagnosticsBody, "v3-decision-sens-table-row", "#sensTbody");
  mountDecisionRow(diagnosticsBody, "v3-decision-conf-tag-row", "#confTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-conf-kpis-row", "#confExec");
  mountDecisionRow(diagnosticsBody, "v3-decision-conf-banner-row", "#confBanner");
  hideLegacyDecisionDiagnosticsActions();

  const recommendationBody = getCardBody(recommendationCard);
  recommendationBody.innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Recommendation should map to a named option and explicit required truths.</li>
        <li>Review preview text before copy/download handoff.</li>
      </ul>
    </div>
    <div class="fpe-field-grid fpe-field-grid--1">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionRecommendSelect">Recommended option</label>
        <select class="fpe-input" id="v3DecisionRecommendSelect"></select>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DecisionWhatTrue">What needs to be true (one per line)</label>
      <textarea class="fpe-input" id="v3DecisionWhatTrue" rows="4"></textarea>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DecisionSummaryPreview">Client-ready summary (preview)</label>
      <textarea class="fpe-input" id="v3DecisionSummaryPreview" rows="14" readonly></textarea>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Copy status</div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionCopyStatus">-</div>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionCopyMd" type="button">Copy markdown</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionCopyText" type="button">Copy text</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionDownloadJson" type="button">Download JSON</button>
    </div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Active session</span><strong id="v3DecisionActiveSession">-</strong></div>
      <div class="fpe-summary-row"><span>Linked scenario</span><strong id="v3DecisionScenario">-</strong></div>
      <div class="fpe-summary-row"><span>Objective</span><strong id="v3DecisionObjectiveSummary">-</strong></div>
      <div class="fpe-summary-row"><span>Selected option</span><strong id="v3DecisionOption">-</strong></div>
      <div class="fpe-summary-row"><span>Recommended option</span><strong id="v3DecisionRecommended">-</strong></div>
      <div class="fpe-summary-row"><span>Confidence tag</span><strong id="v3DecisionConfidence">-</strong></div>
      <div class="fpe-summary-row"><span>Risk tag</span><strong id="v3DecisionRisk">-</strong></div>
      <div class="fpe-summary-row"><span>Bottleneck tag</span><strong id="v3DecisionBottleneck">-</strong></div>
    </div>
  `;

  contextCol.append(sessionCard, assumptionsCard);
  optionsCol.append(optionsCard, diagnosticsCard);
  outputCol.append(recommendationCard, summaryCard);

  frame.append(contextCol, optionsCol, outputCol);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Decision logs turn model output into explicit operating choices with traceable rationale.",
      "Constraints, options, and recommendation should be reviewed together to prevent hidden tradeoffs.",
      "Confidence framing helps teams calibrate execution risk before commitment."
    ])
  );

  wireDecisionBridge();
  return refreshDecisionSummary;
}

function mountDecisionRow(target, key, childSelector) {
  mountLegacyClosest({
    key,
    childSelector,
    closestSelector: ".scm-row",
    target
  });
}

function refreshDecisionSummary() {
  syncDecisionBridgeUi();

  setText("v3DecisionActiveSession", readText("#decisionActiveLabel"));
  setText("v3DecisionScenario", readText("#decisionScenarioLabel"));
  setText("v3DecisionObjectiveSummary", readSelectedLabel("#decisionObjective"));
  setText("v3DecisionOption", readSelectedLabel("#decisionOptionSelect"));
  setText("v3DecisionRecommended", readSelectedLabel("#decisionRecommendSelect"));
  setText("v3DecisionConfidence", readText("#confTag"));
  setText("v3DecisionRisk", readText("#riskBandTag"));
  setText("v3DecisionBottleneck", readText("#bneckTag"));
}

function wireDecisionBridge() {
  const root = document.getElementById("v3DecisionBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindSelectProxy("v3DecisionSessionSelect", "decisionSessionSelect");
  bindFieldProxy("v3DecisionRename", "decisionRename");
  bindSelectProxy("v3DecisionObjective", "decisionObjective");
  bindFieldProxy("v3DecisionNotes", "decisionNotes");
  bindFieldProxy("v3DecisionBudget", "decisionBudget");
  bindFieldProxy("v3DecisionVolunteerHrs", "decisionVolunteerHrs");
  bindSelectProxy("v3DecisionTurfAccess", "decisionTurfAccess");
  bindFieldProxy("v3DecisionBlackoutDates", "decisionBlackoutDates");
  bindSelectProxy("v3DecisionRiskPosture", "decisionRiskPosture");
  bindFieldProxy("v3DecisionNonNegotiables", "decisionNonNegotiables");
  bindSelectProxy("v3DecisionOptionSelect", "decisionOptionSelect");
  bindFieldProxy("v3DecisionOptionRename", "decisionOptionRename");
  bindCheckboxProxy("v3DecisionOptionTacticDoors", "decisionOptionTacticDoors");
  bindCheckboxProxy("v3DecisionOptionTacticPhones", "decisionOptionTacticPhones");
  bindCheckboxProxy("v3DecisionOptionTacticDigital", "decisionOptionTacticDigital");
  bindSelectProxy("v3DecisionRecommendSelect", "decisionRecommendSelect");
  bindFieldProxy("v3DecisionWhatTrue", "decisionWhatTrue");

  bindClickProxy("v3BtnDecisionNew", "btnDecisionNew");
  bindClickProxy("v3BtnDecisionRenameSave", "btnDecisionRenameSave");
  bindClickProxy("v3BtnDecisionDelete", "btnDecisionDelete");
  bindClickProxy("v3BtnDecisionLinkScenario", "btnDecisionLinkScenario");
  bindClickProxy("v3BtnDecisionOptionNew", "btnDecisionOptionNew");
  bindClickProxy("v3BtnDecisionOptionRenameSave", "btnDecisionOptionRenameSave");
  bindClickProxy("v3BtnDecisionOptionDelete", "btnDecisionOptionDelete");
  bindClickProxy("v3BtnDecisionOptionLinkScenario", "btnDecisionOptionLinkScenario");
  bindClickProxy("v3BtnDecisionSensRun", "btnSensRun");
  bindClickProxy("v3BtnDecisionCopyMd", "btnDecisionCopyMd");
  bindClickProxy("v3BtnDecisionCopyText", "btnDecisionCopyText");
  bindClickProxy("v3BtnDecisionDownloadJson", "btnDecisionDownloadJson");
}

function syncDecisionBridgeUi() {
  syncSelectValue("v3DecisionSessionSelect", "decisionSessionSelect");
  syncSelectValue("v3DecisionObjective", "decisionObjective");
  syncSelectValue("v3DecisionTurfAccess", "decisionTurfAccess");
  syncSelectValue("v3DecisionRiskPosture", "decisionRiskPosture");
  syncSelectValue("v3DecisionOptionSelect", "decisionOptionSelect");
  syncSelectValue("v3DecisionRecommendSelect", "decisionRecommendSelect");

  syncFieldValue("v3DecisionRename", "decisionRename");
  syncFieldValue("v3DecisionNotes", "decisionNotes");
  syncFieldValue("v3DecisionBudget", "decisionBudget");
  syncFieldValue("v3DecisionVolunteerHrs", "decisionVolunteerHrs");
  syncFieldValue("v3DecisionBlackoutDates", "decisionBlackoutDates");
  syncFieldValue("v3DecisionNonNegotiables", "decisionNonNegotiables");
  syncFieldValue("v3DecisionOptionRename", "decisionOptionRename");
  syncFieldValue("v3DecisionWhatTrue", "decisionWhatTrue");
  syncFieldValue("v3DecisionSummaryPreview", "decisionSummaryPreview");

  syncCheckboxValue("v3DecisionOptionTacticDoors", "decisionOptionTacticDoors");
  syncCheckboxValue("v3DecisionOptionTacticPhones", "decisionOptionTacticPhones");
  syncCheckboxValue("v3DecisionOptionTacticDigital", "decisionOptionTacticDigital");

  syncControlDisabled("v3DecisionSessionSelect", "decisionSessionSelect");
  syncControlDisabled("v3DecisionRename", "decisionRename");
  syncControlDisabled("v3DecisionObjective", "decisionObjective");
  syncControlDisabled("v3DecisionNotes", "decisionNotes");
  syncControlDisabled("v3DecisionBudget", "decisionBudget");
  syncControlDisabled("v3DecisionVolunteerHrs", "decisionVolunteerHrs");
  syncControlDisabled("v3DecisionTurfAccess", "decisionTurfAccess");
  syncControlDisabled("v3DecisionBlackoutDates", "decisionBlackoutDates");
  syncControlDisabled("v3DecisionRiskPosture", "decisionRiskPosture");
  syncControlDisabled("v3DecisionNonNegotiables", "decisionNonNegotiables");
  syncControlDisabled("v3DecisionOptionSelect", "decisionOptionSelect");
  syncControlDisabled("v3DecisionOptionRename", "decisionOptionRename");
  syncControlDisabled("v3DecisionOptionTacticDoors", "decisionOptionTacticDoors");
  syncControlDisabled("v3DecisionOptionTacticPhones", "decisionOptionTacticPhones");
  syncControlDisabled("v3DecisionOptionTacticDigital", "decisionOptionTacticDigital");
  syncControlDisabled("v3DecisionRecommendSelect", "decisionRecommendSelect");
  syncControlDisabled("v3DecisionWhatTrue", "decisionWhatTrue");

  setText("v3DecisionActiveLabel", readText("#decisionActiveLabel"));
  setText("v3DecisionScenarioLabel", readText("#decisionScenarioLabel"));
  setText("v3DecisionOptionScenarioLabel", readText("#decisionOptionScenarioLabel"));
  setText("v3DecisionCopyStatus", readText("#decisionCopyStatus"));

  syncButtonDisabled("v3BtnDecisionNew", "btnDecisionNew");
  syncButtonDisabled("v3BtnDecisionRenameSave", "btnDecisionRenameSave");
  syncButtonDisabled("v3BtnDecisionDelete", "btnDecisionDelete");
  syncButtonDisabled("v3BtnDecisionLinkScenario", "btnDecisionLinkScenario");
  syncButtonDisabled("v3BtnDecisionOptionNew", "btnDecisionOptionNew");
  syncButtonDisabled("v3BtnDecisionOptionRenameSave", "btnDecisionOptionRenameSave");
  syncButtonDisabled("v3BtnDecisionOptionDelete", "btnDecisionOptionDelete");
  syncButtonDisabled("v3BtnDecisionOptionLinkScenario", "btnDecisionOptionLinkScenario");
  syncButtonDisabled("v3BtnDecisionSensRun", "btnSensRun");
  syncButtonDisabled("v3BtnDecisionCopyMd", "btnDecisionCopyMd");
  syncButtonDisabled("v3BtnDecisionCopyText", "btnDecisionCopyText");
  syncButtonDisabled("v3BtnDecisionDownloadJson", "btnDecisionDownloadJson");
}

function hideLegacyDecisionDiagnosticsActions() {
  const legacy = document.getElementById("btnSensRun");
  if (!(legacy instanceof HTMLElement)) {
    return;
  }
  legacy.style.display = "none";
  legacy.setAttribute("aria-hidden", "true");
}
