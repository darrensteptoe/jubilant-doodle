import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  DECISION_STATUS_AWAITING_DECISION,
  DECISION_STATUS_UNAVAILABLE,
  classifyDecisionStatusTone,
  deriveDecisionActionCardStatus,
  deriveDecisionDetailCardStatus,
  deriveDecisionDiagnosticsCardStatus,
  deriveDecisionOptionsCardStatus,
  deriveDecisionSessionCardStatus,
  deriveDecisionSummaryCardStatus,
} from "../../../core/decisionView.js";
import { formatFixedNumber, roundWholeNumberByMode } from "../../../core/utils.js";

const DECISION_API_KEY = "__FPE_DECISION_API__";

export function renderDecisionLogSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const contextCol = createColumn("context");
  const optionsCol = createColumn("options");
  const outputCol = createColumn("output");

  const sessionCard = createCard({
    title: "Recent decisions",
    description: "Session selection, objective, scenario linkage, and working notes.",
    status: "Awaiting session"
  });

  const assumptionsCard = createCard({
    title: "Decision detail",
    description: "Budget, volunteer capacity, turf limits, blackout windows, and non-negotiables.",
    status: "Awaiting detail"
  });

  const optionsCard = createCard({
    title: "Linked scenario & options",
    description: "Alternative paths, option linkage, and tactic tagging for each option.",
    status: "Awaiting option"
  });

  const diagnosticsCard = createCard({
    title: "Rationale diagnostics",
    description: "Drift, risk, bottlenecks, sensitivity snapshot, and confidence framing.",
    status: "Awaiting diagnostics"
  });

  const recommendationCard = createCard({
    title: "Next action",
    description: "Selected recommendation, required truths, and client-ready summary export.",
    status: "Awaiting recommendation"
  });

  const summaryCard = createCard({
    title: "Decision summary",
    description: "Current decision posture at a glance.",
    status: "Awaiting session"
  });

  assignCardStatusId(sessionCard, "v3DecisionSessionCardStatus");
  assignCardStatusId(assumptionsCard, "v3DecisionDetailCardStatus");
  assignCardStatusId(optionsCard, "v3DecisionOptionsCardStatus");
  assignCardStatusId(diagnosticsCard, "v3DecisionDiagnosticsCardStatus");
  assignCardStatusId(recommendationCard, "v3DecisionActionCardStatus");
  assignCardStatusId(summaryCard, "v3DecisionSummaryCardStatus");

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
    <div class="fpe-contained-block">
      <div class="fpe-control-label">What changed since last review</div>
      <div class="fpe-status-strip fpe-status-strip--4">
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Classification</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomClassDiag">—</div>
        </div>
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Significance</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomSigDiag">—</div>
        </div>
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Actionability</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomActionDiag">—</div>
        </div>
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Last review</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomLastReviewDiag">—</div>
        </div>
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomSummaryDiag">—</div>
      <div class="table-wrap">
        <table class="table" aria-label="War room change drivers">
          <thead>
            <tr>
              <th>Top drivers</th>
            </tr>
          </thead>
          <tbody id="v3DecisionWarRoomDriversDiag">
            <tr><td class="muted">Capture a review baseline to classify movement.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionCaptureReview" type="button">Capture review baseline</button>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Weather & Field Risk (ZIP-driven)</div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionWeatherOfficeZip">Office ZIP</label>
          <input class="fpe-input" id="v3DecisionWeatherOfficeZip" inputmode="numeric" maxlength="5" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionWeatherOverrideZip">Override ZIP</label>
          <input class="fpe-input" id="v3DecisionWeatherOverrideZip" inputmode="numeric" maxlength="5" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label">Use override</label>
          <label class="fpe-switch"><input id="v3DecisionWeatherUseOverride" type="checkbox"/><span>Use manual override ZIP</span></label>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionWeatherMode">Mode</label>
          <select class="fpe-input" id="v3DecisionWeatherMode">
            <option value="observe_only">Observe only</option>
            <option value="today_only">Apply today-only field adjustment</option>
          </select>
        </div>
        <div class="field">
          <label class="fpe-control-label">Weather actions</label>
          <div class="fpe-action-row">
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionWeatherRefresh" type="button">Refresh weather</button>
          </div>
        </div>
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherStatus">Set a ZIP to load weather context.</div>
      <div class="fpe-status-strip fpe-status-strip--3">
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Field execution risk</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherFieldRisk">—</div>
        </div>
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Election-day turnout risk</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherTurnoutRisk">—</div>
        </div>
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Selected ZIP</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherZip">—</div>
        </div>
      </div>
      <div class="fpe-status-strip fpe-status-strip--3">
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Temp / feels</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherTemp">—</div>
        </div>
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Condition / wind</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherCondition">—</div>
        </div>
        <div class="fpe-contained-block fpe-contained-block--status">
          <div class="fpe-control-label">Precip signal / refreshed</div>
          <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherPrecip">—</div>
        </div>
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherRecommendedAction">—</div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionWeatherAdjustmentBanner">—</div>
      <div class="table-wrap">
        <table class="table" aria-label="Weather outlook">
          <thead>
            <tr>
              <th>Day</th>
              <th>Condition</th>
              <th class="num">High / Low</th>
              <th class="num">Precip</th>
              <th class="num">Wind</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody id="v3DecisionWeatherForecastTbody">
            <tr><td class="muted" colspan="6">No forecast loaded.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Calendar / Events</div>
      <div class="fpe-field-grid fpe-field-grid--4">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventFilterDate">Date</label>
          <input class="fpe-input" id="v3DecisionEventFilterDate" type="date"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventCategoryFilter">Category filter</label>
          <select class="fpe-input" id="v3DecisionEventCategoryFilter"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label">Applied only</label>
          <label class="fpe-switch"><input id="v3DecisionEventAppliedOnly" type="checkbox"/><span>Show apply-to-model only</span></label>
        </div>
        <div class="field">
          <label class="fpe-control-label">Include inactive</label>
          <label class="fpe-switch"><input id="v3DecisionEventIncludeInactive" type="checkbox"/><span>Show completed/cancelled</span></label>
        </div>
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionEventSummary">No events for selected date.</div>
      <div class="fpe-help fpe-help--flush" id="v3DecisionEventImpact">No active campaign events are applying capacity modifiers for the selected date.</div>
      <div class="table-wrap">
        <table class="table" aria-label="Event calendar rows">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Category / Type</th>
              <th>Title / Notes</th>
              <th>Capacity assumptions</th>
              <th>Apply</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="v3DecisionEventTbody">
            <tr><td class="muted" colspan="7">No events on selected date.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventCategory">Category</label>
          <select class="fpe-input" id="v3DecisionEventCategory"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventType">Event type</label>
          <select class="fpe-input" id="v3DecisionEventType"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventStatus">Status</label>
          <select class="fpe-input" id="v3DecisionEventStatus"></select>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventTitle">Title</label>
          <input class="fpe-input" id="v3DecisionEventTitle" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventDate">Event date</label>
          <input class="fpe-input" id="v3DecisionEventDate" type="date"/>
        </div>
        <div class="field">
          <label class="fpe-control-label">Apply to model</label>
          <label class="fpe-switch"><input id="v3DecisionEventApplyToModel" type="checkbox"/><span>Capacity-only (campaign events)</span></label>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventStartTime">Start time</label>
          <input class="fpe-input" id="v3DecisionEventStartTime" type="time"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventEndTime">End time</label>
          <input class="fpe-input" id="v3DecisionEventEndTime" type="time"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventCreatedBy">Created by</label>
          <input class="fpe-input" id="v3DecisionEventCreatedBy" type="text"/>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventExpectedVolunteers">Expected volunteers</label>
          <input class="fpe-input" id="v3DecisionEventExpectedVolunteers" inputmode="numeric" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventExpectedPaid">Expected paid canvassers</label>
          <input class="fpe-input" id="v3DecisionEventExpectedPaid" inputmode="numeric" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventExpectedShiftHours">Expected shift hours</label>
          <input class="fpe-input" id="v3DecisionEventExpectedShiftHours" inputmode="decimal" type="text"/>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventMeetingType">Meeting type (admin)</label>
          <input class="fpe-input" id="v3DecisionEventMeetingType" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventAttendees">Attendees (admin)</label>
          <input class="fpe-input" id="v3DecisionEventAttendees" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventFollowUpOwner">Follow-up owner</label>
          <input class="fpe-input" id="v3DecisionEventFollowUpOwner" type="text"/>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventFollowUpDate">Follow-up date</label>
          <input class="fpe-input" id="v3DecisionEventFollowUpDate" type="date"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventOfficeLocation">Office / location</label>
          <input class="fpe-input" id="v3DecisionEventOfficeLocation" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DecisionEventChannelFocus">Channel focus</label>
          <input class="fpe-input" id="v3DecisionEventChannelFocus" type="text"/>
        </div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionEventFieldGoalNotes">Field goal notes</label>
        <textarea class="fpe-input" id="v3DecisionEventFieldGoalNotes" rows="2"></textarea>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionEventNotes">Notes</label>
        <textarea class="fpe-input" id="v3DecisionEventNotes" rows="2"></textarea>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionEventSave" type="button">Save event</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDecisionEventClear" type="button">Clear draft</button>
      </div>
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
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionWatchItems">Watch items (one per line)</label>
        <textarea class="fpe-input" id="v3DecisionWatchItems" rows="4"></textarea>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionDecisionItems">Decision items (one per line)</label>
        <textarea class="fpe-input" id="v3DecisionDecisionItems" rows="4"></textarea>
      </div>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionOwner">Decision owner</label>
        <input class="fpe-input" id="v3DecisionOwner" type="text"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DecisionFollowUpDate">Follow-up date</label>
        <input class="fpe-input" id="v3DecisionFollowUpDate" type="date"/>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DecisionDecisionSummary">Decision summary for log entry</label>
      <textarea class="fpe-input" id="v3DecisionDecisionSummary" rows="3"></textarea>
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
      <button class="fpe-btn" id="v3BtnDecisionLogDecision" type="button">Log decision</button>
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
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Signal class</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomClass">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Decision significance</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomSig">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Actionability</div>
        <div class="fpe-help fpe-help--flush" id="v3DecisionWarRoomAction">-</div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Decision log & follow-through</div>
      <div class="table-wrap">
        <table class="table" aria-label="War room decision log">
          <thead>
            <tr>
              <th>When</th>
              <th>Class</th>
              <th>Summary</th>
              <th>Owner / Follow-up</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="v3DecisionLogTbody">
            <tr><td class="muted" colspan="5">No decisions logged yet.</td></tr>
          </tbody>
        </table>
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
  syncInput("v3DecisionWatchItems", view.warRoom?.watchItemsText || "");
  syncInput("v3DecisionDecisionItems", view.warRoom?.decisionItemsText || "");
  syncInput("v3DecisionOwner", view.warRoom?.owner || "");
  syncInput("v3DecisionFollowUpDate", view.warRoom?.followUpDate || "");
  syncInput("v3DecisionDecisionSummary", view.warRoom?.decisionSummary || "");
  syncInput("v3DecisionSummaryPreview", view.summaryPreview || "");
  syncInput("v3DecisionWeatherOfficeZip", view.warRoom?.weather?.officeZip || "");
  syncInput("v3DecisionWeatherOverrideZip", view.warRoom?.weather?.overrideZip || "");
  syncSelectValue("v3DecisionWeatherMode", view.warRoom?.weather?.mode || "observe_only");
  const eventCalendar = view.warRoom?.eventCalendar || {};
  const eventFilters = eventCalendar.filters || {};
  const eventDraft = eventCalendar.draft || {};
  const eventOptions = eventCalendar.options || {};
  syncInput("v3DecisionEventFilterDate", eventFilters.date || "");
  syncSelect("v3DecisionEventCategoryFilter", eventOptions.categoryFilterOptions || [], eventFilters.category || "all", "value", "label");
  syncSelect("v3DecisionEventCategory", eventOptions.categoryOptions || [], eventDraft.category || "campaign", "value", "label");
  syncSelect("v3DecisionEventType", eventOptions.eventTypeOptions || [], eventDraft.eventType || "", "value", "label");
  syncSelect("v3DecisionEventStatus", eventOptions.statusOptions || [], eventDraft.status || "scheduled", "value", "label");
  syncInput("v3DecisionEventTitle", eventDraft.title || "");
  syncInput("v3DecisionEventDate", eventDraft.date || "");
  syncInput("v3DecisionEventStartTime", eventDraft.startTime || "");
  syncInput("v3DecisionEventEndTime", eventDraft.endTime || "");
  syncInput("v3DecisionEventCreatedBy", eventDraft.createdBy || "");
  syncInput("v3DecisionEventExpectedVolunteers", eventDraft.expectedVolunteers == null ? "" : String(eventDraft.expectedVolunteers));
  syncInput("v3DecisionEventExpectedPaid", eventDraft.expectedPaidCanvassers == null ? "" : String(eventDraft.expectedPaidCanvassers));
  syncInput("v3DecisionEventExpectedShiftHours", eventDraft.expectedShiftHours == null ? "" : String(eventDraft.expectedShiftHours));
  syncInput("v3DecisionEventMeetingType", eventDraft.meetingType || "");
  syncInput("v3DecisionEventAttendees", eventDraft.attendees || "");
  syncInput("v3DecisionEventFollowUpOwner", eventDraft.followUpOwner || "");
  syncInput("v3DecisionEventFollowUpDate", eventDraft.followUpDate || "");
  syncInput("v3DecisionEventOfficeLocation", eventDraft.officeLocation || "");
  syncInput("v3DecisionEventChannelFocus", eventDraft.channelFocus || "");
  syncInput("v3DecisionEventFieldGoalNotes", eventDraft.fieldGoalNotes || "");
  syncInput("v3DecisionEventNotes", eventDraft.notes || "");

  setChecked("v3DecisionOptionTacticDoors", !!view.activeOption?.tactics?.doors);
  setChecked("v3DecisionOptionTacticPhones", !!view.activeOption?.tactics?.phones);
  setChecked("v3DecisionOptionTacticDigital", !!view.activeOption?.tactics?.digital);
  setChecked("v3DecisionWeatherUseOverride", !!view.warRoom?.weather?.useOverrideZip);
  setChecked("v3DecisionEventAppliedOnly", !!eventFilters.appliedOnly);
  setChecked("v3DecisionEventIncludeInactive", !!eventFilters.includeInactive);
  setChecked("v3DecisionEventApplyToModel", !!eventDraft.applyToModel);

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
  setDisabled("v3DecisionWatchItems", !hasSession);
  setDisabled("v3DecisionDecisionItems", !hasSession);
  setDisabled("v3DecisionOwner", !hasSession);
  setDisabled("v3DecisionFollowUpDate", !hasSession);
  setDisabled("v3DecisionDecisionSummary", !hasSession);
  setDisabled("v3BtnDecisionCaptureReview", !hasSession);
  setDisabled("v3BtnDecisionLogDecision", !hasSession);
  setDisabled("v3DecisionWeatherOfficeZip", !hasSession);
  setDisabled("v3DecisionWeatherOverrideZip", !hasSession);
  setDisabled("v3DecisionWeatherUseOverride", !hasSession);
  setDisabled("v3DecisionWeatherMode", !hasSession);
  setDisabled("v3BtnDecisionWeatherRefresh", !hasSession);
  setDisabled("v3DecisionEventFilterDate", !hasSession);
  setDisabled("v3DecisionEventCategoryFilter", !hasSession);
  setDisabled("v3DecisionEventAppliedOnly", !hasSession);
  setDisabled("v3DecisionEventIncludeInactive", !hasSession);
  setDisabled("v3DecisionEventCategory", !hasSession);
  setDisabled("v3DecisionEventType", !hasSession);
  setDisabled("v3DecisionEventStatus", !hasSession);
  setDisabled("v3DecisionEventTitle", !hasSession);
  setDisabled("v3DecisionEventDate", !hasSession);
  setDisabled("v3DecisionEventStartTime", !hasSession);
  setDisabled("v3DecisionEventEndTime", !hasSession);
  setDisabled("v3DecisionEventCreatedBy", !hasSession);
  setDisabled("v3DecisionEventExpectedVolunteers", !hasSession);
  setDisabled("v3DecisionEventExpectedPaid", !hasSession);
  setDisabled("v3DecisionEventExpectedShiftHours", !hasSession);
  setDisabled("v3DecisionEventMeetingType", !hasSession);
  setDisabled("v3DecisionEventAttendees", !hasSession);
  setDisabled("v3DecisionEventFollowUpOwner", !hasSession);
  setDisabled("v3DecisionEventFollowUpDate", !hasSession);
  setDisabled("v3DecisionEventOfficeLocation", !hasSession);
  setDisabled("v3DecisionEventChannelFocus", !hasSession);
  setDisabled("v3DecisionEventFieldGoalNotes", !hasSession);
  setDisabled("v3DecisionEventNotes", !hasSession);
  setDisabled("v3DecisionEventApplyToModel", !hasSession || String(eventDraft.category || "").toLowerCase() !== "campaign");
  setDisabled("v3BtnDecisionEventSave", !hasSession);
  setDisabled("v3BtnDecisionEventClear", !hasSession);

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

  const warRoom = view.warRoom || {};
  setText("v3DecisionWarRoomClassDiag", warRoom.classification || "—");
  setText("v3DecisionWarRoomSigDiag", warRoom.significance || "—");
  setText("v3DecisionWarRoomActionDiag", warRoom.actionability || "—");
  setText("v3DecisionWarRoomLastReviewDiag", warRoom.lastReviewAt || "—");
  setText("v3DecisionWarRoomSummaryDiag", warRoom.summary || "—");
  setText("v3DecisionWarRoomClass", warRoom.classification || "—");
  setText("v3DecisionWarRoomSig", warRoom.significance || "—");
  setText("v3DecisionWarRoomAction", warRoom.actionability || "—");
  renderWarRoomDriversRows(warRoom.topDrivers || []);
  renderWarRoomDecisionLogRows(warRoom.decisionLogRows || []);

  const weather = warRoom.weather || {};
  setText("v3DecisionWeatherStatus", weather.error ? weather.error : (weather.status || "idle"));
  setText("v3DecisionWeatherFieldRisk", weather.fieldExecutionRisk || "—");
  setText("v3DecisionWeatherTurnoutRisk", weather.electionDayTurnoutRisk || "—");
  setText("v3DecisionWeatherZip", weather.selectedZip || "—");
  setText("v3DecisionWeatherTemp", formatWeatherTempText(weather.current));
  setText("v3DecisionWeatherCondition", formatWeatherConditionText(weather.current));
  setText("v3DecisionWeatherPrecip", formatWeatherPrecipText(weather));
  setText("v3DecisionWeatherRecommendedAction", weather.recommendedAction || "—");
  setText("v3DecisionWeatherAdjustmentBanner", buildWeatherAdjustmentBanner(weather));
  renderWeatherForecastRows(weather.forecast3d || []);
  setText("v3DecisionEventSummary", eventCalendar.summaryText || "No events for selected date.");
  setText("v3DecisionEventImpact", eventCalendar.impactText || "No active campaign events are applying capacity modifiers for the selected date.");
  renderEventRows(eventCalendar.rows || []);

  syncDecisionCardStatus(
    "v3DecisionSessionCardStatus",
    deriveDecisionSessionCardStatus(view)
  );
  syncDecisionCardStatus(
    "v3DecisionDetailCardStatus",
    deriveDecisionDetailCardStatus(view)
  );
  syncDecisionCardStatus(
    "v3DecisionOptionsCardStatus",
    deriveDecisionOptionsCardStatus(view)
  );
  syncDecisionCardStatus(
    "v3DecisionDiagnosticsCardStatus",
    deriveDecisionDiagnosticsCardStatus(drift, risk, bneck, sens, conf)
  );
  syncDecisionCardStatus(
    "v3DecisionActionCardStatus",
    deriveDecisionActionCardStatus(view)
  );
  syncDecisionCardStatus(
    "v3DecisionSummaryCardStatus",
    deriveDecisionSummaryCardStatus(view, conf, risk, bneck)
  );
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
  on("v3DecisionWatchItems", "input", () => run((api) => api.updateSessionField?.("warRoomWatchItems", valueOf("v3DecisionWatchItems"))));
  on("v3DecisionDecisionItems", "input", () => run((api) => api.updateSessionField?.("warRoomDecisionItems", valueOf("v3DecisionDecisionItems"))));
  on("v3DecisionOwner", "input", () => run((api) => api.updateSessionField?.("warRoomOwner", valueOf("v3DecisionOwner"))));
  on("v3DecisionFollowUpDate", "change", () => run((api) => api.updateSessionField?.("warRoomFollowUpDate", valueOf("v3DecisionFollowUpDate"))));
  on("v3DecisionDecisionSummary", "input", () => run((api) => api.updateSessionField?.("warRoomDecisionSummary", valueOf("v3DecisionDecisionSummary"))));
  on("v3DecisionWeatherOfficeZip", "input", () => run((api) => api.setWeatherField?.("officeZip", valueOf("v3DecisionWeatherOfficeZip"))));
  on("v3DecisionWeatherOverrideZip", "input", () => run((api) => api.setWeatherField?.("overrideZip", valueOf("v3DecisionWeatherOverrideZip"))));
  on("v3DecisionWeatherUseOverride", "change", () => run((api) => api.setWeatherField?.("useOverrideZip", checkedOf("v3DecisionWeatherUseOverride"))));
  on("v3DecisionWeatherMode", "change", () => run((api) => api.setWeatherMode?.(valueOf("v3DecisionWeatherMode"))));
  on("v3DecisionEventFilterDate", "change", () => run((api) => api.setEventFilter?.("date", valueOf("v3DecisionEventFilterDate"))));
  on("v3DecisionEventCategoryFilter", "change", () => run((api) => api.setEventFilter?.("category", valueOf("v3DecisionEventCategoryFilter"))));
  on("v3DecisionEventAppliedOnly", "change", () => run((api) => api.setEventFilter?.("appliedOnly", checkedOf("v3DecisionEventAppliedOnly"))));
  on("v3DecisionEventIncludeInactive", "change", () => run((api) => api.setEventFilter?.("includeInactive", checkedOf("v3DecisionEventIncludeInactive"))));
  on("v3DecisionEventCategory", "change", () => run((api) => api.setEventDraftField?.("category", valueOf("v3DecisionEventCategory"))));
  on("v3DecisionEventType", "change", () => run((api) => api.setEventDraftField?.("eventType", valueOf("v3DecisionEventType"))));
  on("v3DecisionEventStatus", "change", () => run((api) => api.setEventDraftField?.("status", valueOf("v3DecisionEventStatus"))));
  on("v3DecisionEventTitle", "input", () => run((api) => api.setEventDraftField?.("title", valueOf("v3DecisionEventTitle"))));
  on("v3DecisionEventDate", "change", () => run((api) => api.setEventDraftField?.("date", valueOf("v3DecisionEventDate"))));
  on("v3DecisionEventStartTime", "change", () => run((api) => api.setEventDraftField?.("startTime", valueOf("v3DecisionEventStartTime"))));
  on("v3DecisionEventEndTime", "change", () => run((api) => api.setEventDraftField?.("endTime", valueOf("v3DecisionEventEndTime"))));
  on("v3DecisionEventCreatedBy", "input", () => run((api) => api.setEventDraftField?.("createdBy", valueOf("v3DecisionEventCreatedBy"))));
  on("v3DecisionEventApplyToModel", "change", () => run((api) => api.setEventDraftField?.("applyToModel", checkedOf("v3DecisionEventApplyToModel"))));
  on("v3DecisionEventExpectedVolunteers", "input", () => run((api) => api.setEventDraftField?.("expectedVolunteers", valueOf("v3DecisionEventExpectedVolunteers"))));
  on("v3DecisionEventExpectedPaid", "input", () => run((api) => api.setEventDraftField?.("expectedPaidCanvassers", valueOf("v3DecisionEventExpectedPaid"))));
  on("v3DecisionEventExpectedShiftHours", "input", () => run((api) => api.setEventDraftField?.("expectedShiftHours", valueOf("v3DecisionEventExpectedShiftHours"))));
  on("v3DecisionEventMeetingType", "input", () => run((api) => api.setEventDraftField?.("meetingType", valueOf("v3DecisionEventMeetingType"))));
  on("v3DecisionEventAttendees", "input", () => run((api) => api.setEventDraftField?.("attendees", valueOf("v3DecisionEventAttendees"))));
  on("v3DecisionEventFollowUpOwner", "input", () => run((api) => api.setEventDraftField?.("followUpOwner", valueOf("v3DecisionEventFollowUpOwner"))));
  on("v3DecisionEventFollowUpDate", "change", () => run((api) => api.setEventDraftField?.("followUpDate", valueOf("v3DecisionEventFollowUpDate"))));
  on("v3DecisionEventOfficeLocation", "input", () => run((api) => api.setEventDraftField?.("officeLocation", valueOf("v3DecisionEventOfficeLocation"))));
  on("v3DecisionEventChannelFocus", "input", () => run((api) => api.setEventDraftField?.("channelFocus", valueOf("v3DecisionEventChannelFocus"))));
  on("v3DecisionEventFieldGoalNotes", "input", () => run((api) => api.setEventDraftField?.("fieldGoalNotes", valueOf("v3DecisionEventFieldGoalNotes"))));
  on("v3DecisionEventNotes", "input", () => run((api) => api.setEventDraftField?.("notes", valueOf("v3DecisionEventNotes"))));
  on("v3BtnDecisionEventSave", "click", () => run((api) => api.saveEventDraft?.()));
  on("v3BtnDecisionEventClear", "click", () => run((api) => api.clearEventDraft?.()));

  on("v3BtnDecisionSensRun", "click", () => run((api) => api.runSensitivitySnapshot?.()));
  on("v3BtnDecisionCaptureReview", "click", () => run((api) => api.captureReviewBaseline?.()));
  on("v3BtnDecisionWeatherRefresh", "click", () => run((api) => api.refreshWeather?.()));
  on("v3BtnDecisionLogDecision", "click", () => run((api) => api.logDecision?.()));
  on("v3BtnDecisionCopyMd", "click", () => run((api) => api.copySummary?.("markdown")));
  on("v3BtnDecisionCopyText", "click", () => run((api) => api.copySummary?.("text")));
  on("v3BtnDecisionDownloadJson", "click", () => run((api) => api.downloadSummaryJson?.()));

  const logBody = document.getElementById("v3DecisionLogTbody");
  if (logBody instanceof HTMLElement && logBody.dataset.v3StatusBound !== "1"){
    logBody.dataset.v3StatusBound = "1";
    logBody.addEventListener("change", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const rowId = String(target.dataset.decisionLogId || "").trim();
      if (!rowId) return;
      run((api) => api.setDecisionLogStatus?.(rowId, target.value));
    });
  }

  const eventBody = document.getElementById("v3DecisionEventTbody");
  if (eventBody instanceof HTMLElement && eventBody.dataset.v3EventBound !== "1"){
    eventBody.dataset.v3EventBound = "1";

    eventBody.addEventListener("change", (event) => {
      const target = event?.target;
      if (target instanceof HTMLInputElement && target.type === "checkbox"){
        const rowId = String(target.dataset.eventId || "").trim();
        if (!rowId) return;
        run((api) => api.setEventApplyToModel?.(rowId, !!target.checked));
        return;
      }
      if (target instanceof HTMLSelectElement){
        const rowId = String(target.dataset.eventStatusId || "").trim();
        if (!rowId) return;
        run((api) => api.setEventStatus?.(rowId, target.value));
      }
    });

    eventBody.addEventListener("click", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLElement)) return;
      const rowId = String(target.dataset.eventActionId || "").trim();
      if (!rowId) return;
      const action = String(target.dataset.eventAction || "").trim();
      if (!action) return;
      if (action === "edit"){
        run((api) => api.loadEventDraft?.(rowId));
      } else if (action === "delete"){
        confirmThenRun("Delete selected event?", (api) => api.deleteEvent?.(rowId));
      }
    });
  }
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

function renderWarRoomDriversRows(rows) {
  const body = document.getElementById("v3DecisionWarRoomDriversDiag");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted">No material drivers yet.</td></tr>';
    return;
  }
  list.forEach((line) => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = String(line || "—");
    tr.appendChild(td);
    body.appendChild(tr);
  });
}

function renderWarRoomDecisionLogRows(rows) {
  const body = document.getElementById("v3DecisionLogTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted" colspan="5">No decisions logged yet.</td></tr>';
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");

    const whenCell = document.createElement("td");
    whenCell.textContent = String(row?.recordedAtText || row?.recordedAt || "—");

    const classCell = document.createElement("td");
    classCell.textContent = `${String(row?.classification || "—")} / ${String(row?.significance || "—")}`;

    const summaryCell = document.createElement("td");
    summaryCell.textContent = String(row?.summary || "—");

    const ownerCell = document.createElement("td");
    ownerCell.textContent = `${String(row?.owner || "—")} · ${String(row?.followUpDate || "—")}`;

    const statusCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "fpe-input";
    select.dataset.decisionLogId = String(row?.id || "");
    const statuses = [
      { value: "open", label: "open" },
      { value: "in_progress", label: "in progress" },
      { value: "closed", label: "closed" },
    ];
    statuses.forEach((entry) => {
      const opt = document.createElement("option");
      opt.value = entry.value;
      opt.textContent = entry.label;
      select.appendChild(opt);
    });
    const nextStatus = String(row?.status || "open");
    if ([...select.options].some((opt) => opt.value === nextStatus)) {
      select.value = nextStatus;
    }
    statusCell.appendChild(select);

    tr.append(whenCell, classCell, summaryCell, ownerCell, statusCell);
    body.appendChild(tr);
  });
}

function renderWeatherForecastRows(rows) {
  const body = document.getElementById("v3DecisionWeatherForecastTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted" colspan="6">No forecast loaded.</td></tr>';
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");
    const day = document.createElement("td");
    day.textContent = String(row?.dayLabel || "—");
    const condition = document.createElement("td");
    condition.textContent = String(row?.condition || "—");
    const temp = document.createElement("td");
    temp.className = "num";
    const hi = formatWeatherWholeNumber(row?.tempHighF, "F");
    const lo = formatWeatherWholeNumber(row?.tempLowF, "F");
    temp.textContent = `${hi} / ${lo}`;
    const precip = document.createElement("td");
    precip.className = "num";
    precip.textContent = formatWeatherPercent01(row?.precipChance);
    const wind = document.createElement("td");
    wind.className = "num";
    wind.textContent = formatWeatherWholeNumber(row?.windMph, " mph");
    const risk = document.createElement("td");
    risk.textContent = String(row?.riskBadge || "—");
    tr.append(day, condition, temp, precip, wind, risk);
    body.appendChild(tr);
  });
}

function renderEventRows(rows) {
  const body = document.getElementById("v3DecisionEventTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted" colspan="7">No events on selected date.</td></tr>';
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");
    const eventId = String(row?.eventId || "").trim();

    const cDate = document.createElement("td");
    cDate.textContent = `${String(row?.dateLabel || "—")} / ${String(row?.timeLabel || "—")}`;

    const cType = document.createElement("td");
    cType.textContent = `${String(row?.categoryLabel || "—")} / ${String(row?.eventType || "—")}`;

    const cTitle = document.createElement("td");
    const title = String(row?.title || "Untitled");
    const notes = String(row?.notes || "").trim();
    cTitle.textContent = notes ? `${title} — ${notes}` : title;

    const cCapacity = document.createElement("td");
    cCapacity.textContent = `V ${String(row?.expectedVolunteers ?? 0)} / P ${String(row?.expectedPaidCanvassers ?? 0)} / H ${String(row?.expectedShiftHours ?? 0)}`;

    const cApply = document.createElement("td");
    const applyToggle = document.createElement("input");
    applyToggle.type = "checkbox";
    applyToggle.checked = !!row?.applyToModel;
    applyToggle.disabled = !row?.canApplyToModel;
    applyToggle.dataset.eventId = eventId;
    cApply.appendChild(applyToggle);

    const cStatus = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = "fpe-input";
    statusSelect.dataset.eventStatusId = eventId;
    const statuses = [
      { value: "scheduled", label: "scheduled" },
      { value: "active", label: "active" },
      { value: "completed", label: "completed" },
      { value: "cancelled", label: "cancelled" },
    ];
    statuses.forEach((statusRow) => {
      const opt = document.createElement("option");
      opt.value = statusRow.value;
      opt.textContent = statusRow.label;
      statusSelect.appendChild(opt);
    });
    const statusValue = String(row?.status || "scheduled").toLowerCase();
    if ([...statusSelect.options].some((opt) => opt.value === statusValue)) {
      statusSelect.value = statusValue;
    }
    cStatus.appendChild(statusSelect);

    const cActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "fpe-btn fpe-btn--ghost";
    editBtn.textContent = "Edit";
    editBtn.dataset.eventAction = "edit";
    editBtn.dataset.eventActionId = eventId;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "fpe-btn fpe-btn--ghost";
    deleteBtn.textContent = "Delete";
    deleteBtn.dataset.eventAction = "delete";
    deleteBtn.dataset.eventActionId = eventId;

    cActions.append(editBtn, deleteBtn);

    tr.append(cDate, cType, cTitle, cCapacity, cApply, cStatus, cActions);
    body.appendChild(tr);
  });
}

function formatWeatherWholeNumber(value, suffix = "") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: null });
  if (rounded == null) return "—";
  return `${rounded}${suffix}`;
}

function formatWeatherPercent01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = roundWholeNumberByMode(n * 100, { mode: "round", fallback: null });
  if (rounded == null) return "—";
  return `${rounded}%`;
}

function formatWeatherTempText(current) {
  const src = current && typeof current === "object" ? current : {};
  const temp = formatWeatherWholeNumber(src?.tempF, "F");
  const feels = formatWeatherWholeNumber(src?.feelsLikeF, "F");
  return `${temp} / ${feels}`;
}

function formatWeatherConditionText(current) {
  const src = current && typeof current === "object" ? current : {};
  const condition = String(src?.condition || "—");
  const wind = formatWeatherWholeNumber(src?.windMph, " mph");
  return `${condition} / ${wind}`;
}

function formatWeatherPrecipText(weather) {
  const src = weather && typeof weather === "object" ? weather : {};
  const precip = formatWeatherPercent01(src?.precipSignal);
  const fetched = String(src?.fetchedAt || "").trim();
  if (!fetched) {
    return `${precip} / not refreshed`;
  }
  return `${precip} / ${fetched}`;
}

function buildWeatherAdjustmentBanner(weather) {
  const src = weather && typeof weather === "object" ? weather : {};
  const mode = String(src?.mode || "observe_only");
  if (mode !== "today_only" || !src?.adjustmentActive) {
    return "Observation-only mode. No model modifiers are active.";
  }
  const mod = src?.modifiers && typeof src.modifiers === "object" ? src.modifiers : {};
  const d = Number(mod?.doorEfficiencyMultiplier || 1);
  const v = Number(mod?.volunteerShowRateMultiplier || 1);
  const t = Number(mod?.electionDayTurnoutRiskBump || 0);
  const date = String(src?.adjustmentDate || "today");
  const doors = formatFixedNumber(d, 2);
  const volunteer = formatFixedNumber(v, 2);
  const turnoutBump = formatFixedNumber(t * 100, 1);
  return `Today-only adjustment active (${date}): doors x${doors}, volunteer show-rate x${volunteer}, turnout risk +${turnoutBump} pts.`;
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

function syncSelectValue(id, value) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return;
  }
  if (document.activeElement === el) {
    return;
  }
  const wanted = String(value ?? "");
  if (!wanted) {
    return;
  }
  if (![...el.options].some((opt) => opt.value === wanted)) {
    const opt = document.createElement("option");
    opt.value = wanted;
    opt.textContent = wanted;
    el.appendChild(opt);
  }
  el.value = wanted;
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
  setText("v3DecisionWarRoomClassDiag", "Decision runtime bridge unavailable.");
  setText("v3DecisionWarRoomSummaryDiag", "Decision runtime bridge unavailable.");
  setText("v3DecisionWeatherStatus", "Decision runtime bridge unavailable.");
  setText("v3DecisionEventSummary", "Decision runtime bridge unavailable.");
  setText("v3DecisionEventImpact", "Decision runtime bridge unavailable.");
  renderWeatherForecastRows([]);
  renderEventRows([]);
  syncDecisionCardStatus("v3DecisionSessionCardStatus", DECISION_STATUS_UNAVAILABLE);
  syncDecisionCardStatus("v3DecisionDetailCardStatus", DECISION_STATUS_UNAVAILABLE);
  syncDecisionCardStatus("v3DecisionOptionsCardStatus", DECISION_STATUS_UNAVAILABLE);
  syncDecisionCardStatus("v3DecisionDiagnosticsCardStatus", DECISION_STATUS_UNAVAILABLE);
  syncDecisionCardStatus("v3DecisionActionCardStatus", DECISION_STATUS_UNAVAILABLE);
  syncDecisionCardStatus("v3DecisionSummaryCardStatus", DECISION_STATUS_UNAVAILABLE);
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

function syncDecisionCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || DECISION_STATUS_AWAITING_DECISION;
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyDecisionStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
}
