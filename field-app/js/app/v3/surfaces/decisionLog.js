import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";

const DECISION_API_KEY = "__FPE_DECISION_API__";

export function renderDecisionLogSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const contextCol = createColumn("context");
  const optionsCol = createColumn("options");
  const outputCol = createColumn("output");

  const sessionCard = createCard({
    title: "Recent decisions",
    description: "Session selection, objective, scenario linkage, and working notes."
  });

  const assumptionsCard = createCard({
    title: "Decision detail",
    description: "Budget, volunteer capacity, turf limits, blackout windows, and non-negotiables."
  });

  const optionsCard = createCard({
    title: "Linked scenario & options",
    description: "Alternative paths, option linkage, and tactic tagging for each option."
  });

  const diagnosticsCard = createCard({
    title: "Rationale diagnostics",
    description: "Drift, risk, bottlenecks, sensitivity snapshot, and confidence framing."
  });

  const recommendationCard = createCard({
    title: "Next action",
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

  getCardBody(diagnosticsCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Read drift and risk first, then confirm bottlenecks before recommendation lock.</li>
        <li>Use sensitivity snapshot as a sanity check before client summary export.</li>
      </ul>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Drift tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionDriftTag">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Risk tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionRiskTag">—</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Required attempts/week</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionDriftReq">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Actual attempts (last 7)</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionDriftActual">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Delta</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionDriftDelta">—</div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Assumption drift status</div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionDriftBanner">—</div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Win probability</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionRiskWinProb">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Expected margin band</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionRiskMarginBand">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Volatility</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionRiskVolatility">—</div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Risk framing status</div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionRiskBanner">—</div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Bottleneck tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionBneckTag">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Primary constraint</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionBneckPrimary">—</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Secondary constraint</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionBneckSecondary">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Confidence tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionConfTag">—</div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Bottleneck sensitivity (+10%)</div>
      <div class="table-wrap">
        <table class="table" aria-label="Bottleneck sensitivity table">
          <thead>
            <tr>
              <th>Constraint</th>
              <th class="num">If +10%</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="v3DecisionBneckTbody">
            <tr>
              <td class="muted" colspan="3">No bottleneck sensitivity rows.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionBneckWarn">—</div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Sensitivity tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionSensTag">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Sensitivity snapshot</div>
        <div class="fpe-action-row">
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionSensRun" type="button">Run snapshot</button>
        </div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Sensitivity deltas</div>
      <div class="table-wrap">
        <table class="table" aria-label="Sensitivity deltas table">
          <thead>
            <tr>
              <th>Perturbation</th>
              <th class="num">Δ win prob</th>
              <th class="num">Δ p50 margin</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="v3DecisionSensTbody">
            <tr>
              <td class="muted" colspan="4">No sensitivity rows. Run snapshot.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionSensBanner">—</div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--4">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Execution pace</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionConfExec">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Risk band</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionConfRisk">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Constraint tightness</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionConfTight">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Scenario divergence</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionConfDiv">—</div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Decision confidence status</div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionConfBanner">—</div>
    </div>
  `;

  getCardBody(recommendationCard).innerHTML = `
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
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Active session</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionActiveSession">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Linked scenario</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionScenario">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Objective</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionObjectiveSummary">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Selected option</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionOption">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Recommended option</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionRecommended">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Confidence tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionConfidence">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Risk tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionRisk">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Bottleneck tag</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionBottleneck">-</div>
      </div>
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

  wireDecisionEvents();
  return refreshDecisionSummary;
}

function getDecisionApi() {
  return window[DECISION_API_KEY] || null;
}

function refreshDecisionSummary() {
  const api = getDecisionApi();
  if (!api?.getView) {
    renderUnavailable();
    return;
  }
  const view = api.getView();
  if (!view || typeof view !== "object") {
    renderUnavailable();
    return;
  }

  syncSelect("v3DecisionSessionSelect", view.sessions || [], view.activeSessionId || "");
  syncSelect("v3DecisionObjective", view.objectiveOptions || [], view.session?.objectiveKey || "", "key", "label");
  syncSelect("v3DecisionTurfAccess", view.turfAccessOptions || [], view.session?.constraints?.turfAccess || "", "key", "label");
  syncSelect("v3DecisionRiskPosture", view.riskPostureOptions || [], view.session?.riskPosture || "", "key", "label");
  syncSelect("v3DecisionOptionSelect", view.options || [], view.activeOptionId || "", "id", "displayLabel");
  syncSelect("v3DecisionRecommendSelect", view.options || [], view.recommendedOptionId || "", "id", "displayLabel");

  syncInput("v3DecisionRename", view.session?.name || "");
  syncInput("v3DecisionNotes", view.session?.notes || "");
  syncInput("v3DecisionBudget", view.session?.constraints?.budget || "");
  syncInput("v3DecisionVolunteerHrs", view.session?.constraints?.volunteerHrs || "");
  syncInput("v3DecisionBlackoutDates", view.session?.constraints?.blackoutDates || "");
  syncInput("v3DecisionNonNegotiables", view.session?.nonNegotiablesText || "");
  syncInput("v3DecisionOptionRename", view.activeOption?.label || "");
  syncInput("v3DecisionWhatTrue", view.whatNeedsTrueText || "");
  syncInput("v3DecisionSummaryPreview", view.summaryPreview || "");

  setChecked("v3DecisionOptionTacticDoors", !!view.activeOption?.tactics?.doors);
  setChecked("v3DecisionOptionTacticPhones", !!view.activeOption?.tactics?.phones);
  setChecked("v3DecisionOptionTacticDigital", !!view.activeOption?.tactics?.digital);

  const hasSession = !!view.session;
  const hasOption = !!view.activeOption;

  setDisabled("v3BtnDecisionRenameSave", !hasSession);
  setDisabled("v3BtnDecisionDelete", !view.canDeleteSession);
  setDisabled("v3BtnDecisionLinkScenario", !hasSession);
  setDisabled("v3DecisionObjective", !hasSession);
  setDisabled("v3DecisionNotes", !hasSession);
  setDisabled("v3DecisionBudget", !hasSession);
  setDisabled("v3DecisionVolunteerHrs", !hasSession);
  setDisabled("v3DecisionTurfAccess", !hasSession);
  setDisabled("v3DecisionBlackoutDates", !hasSession);
  setDisabled("v3DecisionRiskPosture", !hasSession);
  setDisabled("v3DecisionNonNegotiables", !hasSession);
  setDisabled("v3DecisionOptionSelect", !hasSession || !(view.options || []).length);
  setDisabled("v3DecisionOptionRename", !hasOption);
  setDisabled("v3BtnDecisionOptionRenameSave", !hasOption);
  setDisabled("v3BtnDecisionOptionDelete", !view.canDeleteOption);
  setDisabled("v3BtnDecisionOptionLinkScenario", !hasOption);
  setDisabled("v3DecisionOptionTacticDoors", !hasOption);
  setDisabled("v3DecisionOptionTacticPhones", !hasOption);
  setDisabled("v3DecisionOptionTacticDigital", !hasOption);
  setDisabled("v3DecisionRecommendSelect", !hasSession || !(view.options || []).length);
  setDisabled("v3DecisionWhatTrue", !hasSession);

  setText("v3DecisionActiveLabel", view.activeSessionLabel || "Active session: —");
  setText("v3DecisionScenarioLabel", view.session?.scenarioLabel || "—");
  setText("v3DecisionOptionScenarioLabel", view.activeOption?.scenarioLabel || "—");
  setText("v3DecisionCopyStatus", view.copyStatus || "");

  setText("v3DecisionActiveSession", view.activeSessionLabel || "—");
  setText("v3DecisionScenario", view.summary?.scenarioLabel || "—");
  setText("v3DecisionObjectiveSummary", view.summary?.objectiveLabel || "—");
  setText("v3DecisionOption", view.summary?.selectedOptionLabel || "—");
  setText("v3DecisionRecommended", view.summary?.recommendedOptionLabel || "—");
  setText("v3DecisionConfidence", view.summary?.confidenceTag || "—");
  setText("v3DecisionRisk", view.summary?.riskTag || "—");
  setText("v3DecisionBottleneck", view.summary?.bottleneckTag || "—");

  const diagnostics = view.diagnostics || {};
  const drift = diagnostics.exec || {};
  setText("v3DecisionDriftTag", drift.tag || "—");
  setText("v3DecisionDriftReq", drift.reqText || "—");
  setText("v3DecisionDriftActual", drift.actualText || "—");
  setText("v3DecisionDriftDelta", drift.deltaText || "—");
  setText("v3DecisionDriftBanner", drift.banner || "—");

  const risk = diagnostics.risk || {};
  setText("v3DecisionRiskTag", risk.tag || "—");
  setText("v3DecisionRiskWinProb", risk.winProbText || "—");
  setText("v3DecisionRiskMarginBand", risk.marginBandText || "—");
  setText("v3DecisionRiskVolatility", risk.volatilityText || "—");
  setText("v3DecisionRiskBanner", risk.banner || "—");

  const bneck = diagnostics.bottleneck || {};
  setText("v3DecisionBneckTag", bneck.tag || "—");
  setText("v3DecisionBneckPrimary", bneck.primary || "—");
  setText("v3DecisionBneckSecondary", bneck.secondary || "—");
  setText("v3DecisionBneckWarn", bneck.warn || "—");
  renderBneckRows(bneck.rows || []);

  const sens = diagnostics.sensitivity || {};
  setText("v3DecisionSensTag", sens.tag || "—");
  setText("v3DecisionSensBanner", sens.banner || "—");
  renderSensitivityRows(sens.rows || []);

  const conf = diagnostics.confidence || {};
  setText("v3DecisionConfTag", conf.tag || "—");
  setText("v3DecisionConfExec", conf.exec || "—");
  setText("v3DecisionConfRisk", conf.risk || "—");
  setText("v3DecisionConfTight", conf.tight || "—");
  setText("v3DecisionConfDiv", conf.divergence || "—");
  setText("v3DecisionConfBanner", conf.banner || "—");
}

function wireDecisionEvents() {
  const root = document.getElementById("v3DecisionBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  const run = (fn) => {
    const api = getDecisionApi();
    if (!api) return;
    const out = fn(api);
    if (out && typeof out.then === "function") {
      out.finally(() => refreshDecisionSummary());
      return;
    }
    refreshDecisionSummary();
  };

  const confirmThenRun = (message, fn) => {
    if (!window.confirm(message)) {
      return;
    }
    run(fn);
  };

  on("v3DecisionSessionSelect", "change", () => run((api) => api.selectSession?.(valueOf("v3DecisionSessionSelect"))));
  on("v3BtnDecisionNew", "click", () => run((api) => api.createSession?.("")));
  on("v3BtnDecisionRenameSave", "click", () => run((api) => api.renameSession?.(valueOf("v3DecisionRename"))));
  on("v3BtnDecisionDelete", "click", () => confirmThenRun("Delete active decision session?", (api) => api.deleteSession?.()));
  on("v3BtnDecisionLinkScenario", "click", () => run((api) => api.linkSessionToActiveScenario?.()));

  on("v3DecisionObjective", "change", () => run((api) => api.updateSessionField?.("objectiveKey", valueOf("v3DecisionObjective"))));
  on("v3DecisionNotes", "input", () => run((api) => api.updateSessionField?.("notes", valueOf("v3DecisionNotes"))));
  on("v3DecisionBudget", "input", () => run((api) => api.updateSessionField?.("budget", valueOf("v3DecisionBudget"))));
  on("v3DecisionVolunteerHrs", "input", () => run((api) => api.updateSessionField?.("volunteerHrs", valueOf("v3DecisionVolunteerHrs"))));
  on("v3DecisionTurfAccess", "change", () => run((api) => api.updateSessionField?.("turfAccess", valueOf("v3DecisionTurfAccess"))));
  on("v3DecisionBlackoutDates", "input", () => run((api) => api.updateSessionField?.("blackoutDates", valueOf("v3DecisionBlackoutDates"))));
  on("v3DecisionRiskPosture", "change", () => run((api) => api.updateSessionField?.("riskPosture", valueOf("v3DecisionRiskPosture"))));
  on("v3DecisionNonNegotiables", "input", () => run((api) => api.updateSessionField?.("nonNegotiables", valueOf("v3DecisionNonNegotiables"))));

  on("v3DecisionOptionSelect", "change", () => run((api) => api.selectOption?.(valueOf("v3DecisionOptionSelect"))));
  on("v3BtnDecisionOptionNew", "click", () => run((api) => api.createOption?.("")));
  on("v3BtnDecisionOptionRenameSave", "click", () => run((api) => api.renameOption?.(valueOf("v3DecisionOptionRename"))));
  on("v3BtnDecisionOptionDelete", "click", () => confirmThenRun("Delete active decision option?", (api) => api.deleteOption?.()));
  on("v3BtnDecisionOptionLinkScenario", "click", () => run((api) => api.linkOptionToActiveScenario?.()));

  on("v3DecisionOptionTacticDoors", "change", () => run((api) => api.setOptionTactic?.("doors", checkedOf("v3DecisionOptionTacticDoors"))));
  on("v3DecisionOptionTacticPhones", "change", () => run((api) => api.setOptionTactic?.("phones", checkedOf("v3DecisionOptionTacticPhones"))));
  on("v3DecisionOptionTacticDigital", "change", () => run((api) => api.setOptionTactic?.("digital", checkedOf("v3DecisionOptionTacticDigital"))));

  on("v3DecisionRecommendSelect", "change", () => run((api) => api.setRecommendedOption?.(valueOf("v3DecisionRecommendSelect"))));
  on("v3DecisionWhatTrue", "input", () => run((api) => api.setWhatNeedsTrue?.(valueOf("v3DecisionWhatTrue"))));

  on("v3BtnDecisionSensRun", "click", () => run((api) => api.runSensitivitySnapshot?.()));
  on("v3BtnDecisionCopyMd", "click", () => run((api) => api.copySummary?.("markdown")));
  on("v3BtnDecisionCopyText", "click", () => run((api) => api.copySummary?.("text")));
  on("v3BtnDecisionDownloadJson", "click", () => run((api) => api.downloadSummaryJson?.()));
}

function renderBneckRows(rows) {
  const body = document.getElementById("v3DecisionBneckTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = '<tr><td class="muted" colspan="3">No bottleneck sensitivity rows.</td></tr>';
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const c0 = document.createElement("td");
    c0.textContent = String(row?.constraint || "—");
    const c1 = document.createElement("td");
    c1.className = "num";
    c1.textContent = String(row?.delta || "—");
    const c2 = document.createElement("td");
    c2.textContent = String(row?.notes || "");
    tr.append(c0, c1, c2);
    body.appendChild(tr);
  });
}

function renderSensitivityRows(rows) {
  const body = document.getElementById("v3DecisionSensTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = '<tr><td class="muted" colspan="4">No sensitivity rows. Run snapshot.</td></tr>';
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const c0 = document.createElement("td");
    c0.textContent = String(row?.perturbation || "—");
    const c1 = document.createElement("td");
    c1.className = "num";
    c1.textContent = String(row?.dWin || "—");
    const c2 = document.createElement("td");
    c2.className = "num";
    c2.textContent = String(row?.dP50 || "—");
    const c3 = document.createElement("td");
    c3.textContent = String(row?.notes || "");
    tr.append(c0, c1, c2, c3);
    body.appendChild(tr);
  });
}

function syncSelect(id, rows, value, valueKey = "id", labelKey = "name") {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return;
  }

  const nextRows = Array.isArray(rows) ? rows : [];
  const nextSig = nextRows.map((row) => `${String(row?.[valueKey] ?? "")}:${String(row?.[labelKey] ?? row?.[valueKey] ?? "")}`).join("|");
  const curSig = Array.from(el.options).map((opt) => `${opt.value}:${opt.textContent || ""}`).join("|");
  if (curSig !== nextSig) {
    el.innerHTML = "";
    nextRows.forEach((row) => {
      const opt = document.createElement("option");
      opt.value = String(row?.[valueKey] ?? "");
      opt.textContent = String(row?.[labelKey] ?? row?.[valueKey] ?? "");
      el.appendChild(opt);
    });
  }

  if (document.activeElement !== el) {
    const wanted = String(value ?? "");
    if (wanted && !Array.from(el.options).some((opt) => opt.value === wanted)) {
      const opt = document.createElement("option");
      opt.value = wanted;
      opt.textContent = wanted;
      el.appendChild(opt);
    }
    el.value = wanted;
  }
}

function syncInput(id, value) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return;
  }
  const next = String(value ?? "");
  if (document.activeElement === el) {
    return;
  }
  if (el.value !== next) {
    el.value = next;
  }
}

function setChecked(id, checked) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement) || el.type !== "checkbox") {
    return;
  }
  if (document.activeElement === el) {
    return;
  }
  el.checked = !!checked;
}

function setDisabled(id, disabled) {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el instanceof HTMLButtonElement) {
    el.disabled = !!disabled;
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(text ?? "—");
}

function valueOf(id) {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return el.value;
  }
  return "";
}

function checkedOf(id) {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    return !!el.checked;
  }
  return false;
}

function on(id, eventName, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(eventName, handler);
}

function renderUnavailable() {
  setText("v3DecisionActiveLabel", "Decision runtime bridge unavailable.");
  setText("v3DecisionActiveSession", "Decision runtime bridge unavailable.");
  setText("v3DecisionCopyStatus", "Decision runtime bridge unavailable.");
}
