import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  readText,
  setText,
} from "../surfaceUtils.js";
import {
  buildConfidenceStats,
  buildOutcomeMcStatus,
  buildMissRiskSummary,
  buildOutcomeCliff,
  deriveGapFromNote,
  deriveOutcomeConfidenceCardStatus,
  deriveOutcomeForecastCardStatus,
  buildOutcomeFragility,
  deriveOutcomeInterpretationCardStatus,
  deriveOutcomeRiskFlagsCardStatus,
  deriveOutcomeSensitivityCardStatus,
  deriveOutcomeSummaryCardStatus,
  formatOutcomeGovernanceSignal,
  buildOutcomeRiskLabel,
  deriveShiftFromMargin,
  OUTCOME_STATUS_AWAITING_RUN,
  classifyOutcomeStatusTone,
  formatOutcomeBridgeDecimal,
  formatOutcomeBridgeMargin,
  formatOutcomeBridgePercent,
  formatOutcomeBridgeWhole,
  formatOutcomeBridgeWinProb,
  formatOutcomeSensitivityImpact,
  formatSignedWhole,
} from "../../../core/outcomeView.js";
import { formatPercentFromUnit } from "../../../core/utils.js";

const OUTCOME_API_KEY = "__FPE_OUTCOME_API__";

export function renderOutcomeSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const forecastCol = createColumn("forecast");
  const driversCol = createColumn("drivers");
  const riskCol = createColumn("risk");

  const controlsCard = createCard({
    title: "Drivers",
    description: "Execution assumptions, uncertainty mode, and Monte Carlo controls that drive outcome behavior.",
    status: "Model inputs"
  });

  const forecastCard = createCard({
    title: "Forecast",
    description: "Win probability and projected margin under current assumptions.",
    status: "Awaiting run"
  });

  const confidenceCard = createCard({
    title: "Confidence envelope",
    description: "P10/P50/P90 spread and distribution shape.",
    status: "Awaiting run"
  });

  const sensitivityCard = createCard({
    title: "Sensitivity & surface",
    description: "Driver ranking and lever surface diagnostics.",
    status: "Awaiting sims"
  });

  const interpretationCard = createCard({
    title: "Interpretation",
    description: "Risk framing and explanatory links between assumptions and outputs.",
    status: "Context"
  });

  const riskFlagsCard = createCard({
    title: "Risk flags",
    description: "Current warning posture and freshness checks before trusting the forecast.",
    status: "Awaiting run"
  });

  const summaryCard = createCard({
    title: "Outcome summary",
    description: "Current confidence posture and fragility at a glance.",
    status: "Awaiting run"
  });

  assignCardStatusId(forecastCard, "v3OutcomeForecastCardStatus");
  assignCardStatusId(confidenceCard, "v3OutcomeConfidenceCardStatus");
  assignCardStatusId(sensitivityCard, "v3OutcomeSensitivityCardStatus");
  assignCardStatusId(interpretationCard, "v3OutcomeInterpretationCardStatus");
  assignCardStatusId(riskFlagsCard, "v3OutcomeRiskFlagsCardStatus");
  assignCardStatusId(summaryCard, "v3OutcomeSummaryCardStatus");

  const controlsBody = getCardBody(controlsCard);
  controlsBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--3">
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeOrgCount">Organizers (count)</label>
        <input class="fpe-input" id="v3OutcomeOrgCount" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeOrgHours">Organizer hours / week</label>
        <input class="fpe-input" id="v3OutcomeOrgHours" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeVolunteerMult">Volunteer multiplier (base)</label>
        <input class="fpe-input" id="v3OutcomeVolunteerMult" min="0" step="0.05" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeDoorShare">Door share % (vs calls)</label>
        <input class="fpe-input" id="v3OutcomeDoorShare" max="100" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeDoorsPerHour">Doors per hour (base)</label>
        <input class="fpe-input" id="v3OutcomeDoorsPerHour" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeCallsPerHour">Calls per hour (base)</label>
        <input class="fpe-input" id="v3OutcomeCallsPerHour" min="0" step="1" type="number"/>
      </div>
    </div>

    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Weeks remaining</span><strong id="v3OutcomeWeeksRemaining">-</strong></div>
      <div class="fpe-summary-row"><span>Capacity (contacts possible)</span><strong id="v3OutcomeCapContacts">-</strong></div>
      <div class="fpe-summary-row"><span>Gap vs required contacts</span><strong id="v3OutcomeGapContacts">-</strong></div>
      <div class="fpe-summary-row"><span>Gap interpretation</span><strong id="v3OutcomeGapNote">-</strong></div>
    </div>

    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeMcMode">Monte Carlo mode</label>
        <select class="fpe-input" id="v3OutcomeMcMode"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeMcSeed">Seed (optional)</label>
        <input class="fpe-input" id="v3OutcomeMcSeed" placeholder="leave blank for random" type="text"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeMcVolatility">Volatility profile</label>
        <select class="fpe-input" id="v3OutcomeMcVolatility"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeTurnoutReliabilityPct">Turnout reliability % (base)</label>
        <input class="fpe-input" id="v3OutcomeTurnoutReliabilityPct" max="100" min="0" step="0.5" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeMcRuns">Run count</label>
        <input class="fpe-input" disabled id="v3OutcomeMcRuns" min="1000" step="1000" type="number"/>
      </div>
    </div>

    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnOutcomeRun" type="button">Run 10,000 sims</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnOutcomeRerun" type="button">Re-run MC</button>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">MC freshness</div>
        <div class="fpe-help fpe-help--flush" id="v3OutcomeMcFreshTag">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">MC last run</div>
        <div class="fpe-help fpe-help--flush" id="v3OutcomeMcLastRun">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">MC stale signal</div>
        <div class="fpe-help fpe-help--flush" id="v3OutcomeMcStale">-</div>
      </div>
    </div>

    <div class="fpe-contained-block">
      <div class="fpe-control-label">Advanced ranges (min / expected / max)</div>
      <div class="table-wrap">
        <table class="table" aria-label="Outcome advanced MC ranges">
          <thead>
            <tr>
              <th>Variable</th>
              <th class="num">Min</th>
              <th class="num">Expected</th>
              <th class="num">Max</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Contact rate %</td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcContactMin" max="100" min="0" step="0.1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcContactMode" max="100" min="0" step="0.1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcContactMax" max="100" min="0" step="0.1" type="number"/></td>
            </tr>
            <tr>
              <td>Persuasion rate %</td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcPersMin" max="100" min="0" step="0.1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcPersMode" max="100" min="0" step="0.1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcPersMax" max="100" min="0" step="0.1" type="number"/></td>
            </tr>
            <tr>
              <td>Turnout reliability %</td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcReliMin" max="100" min="0" step="0.5" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcReliMode" max="100" min="0" step="0.5" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcReliMax" max="100" min="0" step="0.5" type="number"/></td>
            </tr>
            <tr>
              <td>Doors per hour</td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcDphMin" min="0" step="1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcDphMode" min="0" step="1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcDphMax" min="0" step="1" type="number"/></td>
            </tr>
            <tr>
              <td>Calls per hour</td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcCphMin" min="0" step="1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcCphMode" min="0" step="1" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcCphMax" min="0" step="1" type="number"/></td>
            </tr>
            <tr>
              <td>Volunteer multiplier</td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcVolMin" min="0" step="0.05" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcVolMode" min="0" step="0.05" type="number"/></td>
              <td class="num"><input class="fpe-input" id="v3OutcomeMcVolMax" min="0" step="0.05" type="number"/></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  getCardBody(forecastCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Win probability</span><strong id="v3OutcomeForecastWinProb">-</strong></div>
      <div class="fpe-summary-row"><span>Median net votes vs need</span><strong id="v3OutcomeForecastMedian">-</strong></div>
      <div class="fpe-summary-row"><span>P95 upside</span><strong id="v3OutcomeForecastP95">-</strong></div>
      <div class="fpe-summary-row"><span>P5 downside</span><strong id="v3OutcomeForecastP5">-</strong></div>
      <div class="fpe-summary-row"><span>Risk label</span><strong id="v3OutcomeForecastRisk">-</strong></div>
    </div>
  `;

  const confidenceBody = getCardBody(confidenceCard);
  confidenceBody.innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>P10 / P50 / P90 margin</span><strong id="v3OutcomeConfMargins">-</strong></div>
      <div class="fpe-summary-row"><span>Attempts/week needed (P10/P50/P90)</span><strong id="v3OutcomeConfAttempts">-</strong></div>
      <div class="fpe-summary-row"><span>Convos/week needed (P10/P50/P90)</span><strong id="v3OutcomeConfConvos">-</strong></div>
      <div class="fpe-summary-row"><span>Finish date (P10/P50/P90)</span><strong id="v3OutcomeConfFinish">-</strong></div>
      <div class="fpe-summary-row"><span>Risk of missing goal at current pace</span><strong id="v3OutcomeConfMissRisk">-</strong></div>
      <div class="fpe-summary-row"><span>Margin of safety (P10)</span><strong id="v3OutcomeConfMoS">-</strong></div>
      <div class="fpe-summary-row"><span>Downside loss probability</span><strong id="v3OutcomeConfDownside">-</strong></div>
      <div class="fpe-summary-row"><span>Expected shortfall (worst 10%)</span><strong id="v3OutcomeConfES10">-</strong></div>
      <div class="fpe-summary-row"><span>Shift needed (make P50 ≥ 0)</span><strong id="v3OutcomeConfShiftP50">-</strong></div>
      <div class="fpe-summary-row"><span>Shift needed (make P10 ≥ 0)</span><strong id="v3OutcomeConfShiftP10">-</strong></div>
      <div class="fpe-summary-row"><span>Fragility index</span><strong id="v3OutcomeConfFragility">-</strong></div>
      <div class="fpe-summary-row"><span>Cliff risk</span><strong id="v3OutcomeConfCliff">-</strong></div>
      <div class="fpe-summary-row"><span>Risk grade</span><strong id="v3OutcomeConfRiskGrade">-</strong></div>
      <div class="fpe-summary-row"><span>Shift needed (P(win) ≥ 60%)</span><strong id="v3OutcomeConfShift60">-</strong></div>
      <div class="fpe-summary-row"><span>Shift needed (P(win) ≥ 70%)</span><strong id="v3OutcomeConfShift70">-</strong></div>
      <div class="fpe-summary-row"><span>Shift needed (P(win) ≥ 80%)</span><strong id="v3OutcomeConfShift80">-</strong></div>
      <div class="fpe-summary-row"><span>Win prob loss under -10 shock</span><strong id="v3OutcomeConfShock10">-</strong></div>
      <div class="fpe-summary-row"><span>Win prob loss under -25 shock</span><strong id="v3OutcomeConfShock25">-</strong></div>
      <div class="fpe-summary-row"><span>Win prob loss under -50 shock</span><strong id="v3OutcomeConfShock50">-</strong></div>
    </div>
    <div class="fpe-help fpe-help--flush">Margin is net persuasion votes delivered minus net persuasion votes needed. Fragility rises when small negative shocks materially reduce win probability.</div>
  `;

  const sensitivityBody = getCardBody(sensitivityCard);
  sensitivityBody.innerHTML = `
    <div class="table-wrap">
      <table class="table" aria-label="Outcome sensitivity ranking">
        <thead>
          <tr><th>Variable</th><th class="num">Impact</th></tr>
        </thead>
        <tbody id="v3OutcomeSensitivityTbody">
          <tr><td class="muted">Run simulations to rank drivers.</td><td class="num muted">-</td></tr>
        </tbody>
      </table>
    </div>

    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeSurfaceLever">Lever</label>
        <select class="fpe-input" id="v3OutcomeSurfaceLever"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeSurfaceMode">Run mode</label>
        <select class="fpe-input" id="v3OutcomeSurfaceMode"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeSurfaceMin">Min</label>
        <input class="fpe-input" id="v3OutcomeSurfaceMin" step="0.01" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeSurfaceMax">Max</label>
        <input class="fpe-input" id="v3OutcomeSurfaceMax" step="0.01" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeSurfaceSteps">Points</label>
        <input class="fpe-input" id="v3OutcomeSurfaceSteps" max="51" min="5" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3OutcomeSurfaceTarget">Target win %</label>
        <input class="fpe-input" id="v3OutcomeSurfaceTarget" max="99" min="50" step="1" type="number"/>
      </div>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnComputeSurface" type="button">Compute Surface</button>
    </div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Surface status</div>
      <div class="fpe-help fpe-help--flush" id="v3OutcomeSurfaceStatus">-</div>
    </div>

    <div class="table-wrap">
      <table class="table" aria-label="Outcome sensitivity surface">
        <thead>
          <tr>
            <th>Lever</th>
            <th class="num">Win%</th>
            <th class="num">P10</th>
            <th class="num">P50</th>
            <th class="num">P90</th>
          </tr>
        </thead>
        <tbody id="v3OutcomeSurfaceTbody">
          <tr>
            <td class="muted">Run surface compute.</td>
            <td class="num muted">-</td>
            <td class="num muted">-</td>
            <td class="num muted">-</td>
            <td class="num muted">-</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-help fpe-help--flush" id="v3OutcomeSurfaceSummary">Compute to see safe zones, cliffs, and diminishing returns.</div>
    </div>
  `;

  const interpretationBody = getCardBody(interpretationCard);
  interpretationBody.innerHTML = `
    <div class="fpe-contained-block fpe-contained-block--instruction">
      <ul class="bullets">
        <li>Outcome computes operational confidence under current assumptions; it does not replace field validation.</li>
        <li>Use sensitivity rankings to prioritize which assumptions must be validated first.</li>
        <li>Treat fragility and downside metrics as decision risk controls before committing execution plans.</li>
      </ul>
    </div>
    <details>
      <summary>Impact trace (input -> output links)</summary>
      <div class="fpe-help" id="v3OutcomeImpactTraceNote">Run simulation to refresh impact trace.</div>
      <div class="fpe-contained-block">
        <ul class="bullets" id="v3OutcomeImpactTraceList">
          <li class="muted">No impact trace yet.</li>
        </ul>
      </div>
    </details>
  `;

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

  getCardBody(riskFlagsCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Risk label</span><strong id="v3OutcomeRiskFlagLabel">-</strong></div>
      <div class="fpe-summary-row"><span>Risk grade</span><strong id="v3OutcomeRiskFlagGrade">-</strong></div>
      <div class="fpe-summary-row"><span>Fragility index</span><strong id="v3OutcomeRiskFlagFragility">-</strong></div>
      <div class="fpe-summary-row"><span>Capacity gap note</span><strong id="v3OutcomeRiskFlagGapNote">-</strong></div>
      <div class="fpe-summary-row"><span>Governance realism</span><strong id="v3OutcomeRiskFlagGovernanceRealism">-</strong></div>
      <div class="fpe-summary-row"><span>Governance data quality</span><strong id="v3OutcomeRiskFlagGovernanceData">-</strong></div>
      <div class="fpe-summary-row"><span>Governance confidence</span><strong id="v3OutcomeRiskFlagGovernanceConfidence">-</strong></div>
      <div class="fpe-summary-row"><span>Governance top warning</span><strong id="v3OutcomeRiskFlagGovernanceWarning">-</strong></div>
      <div class="fpe-summary-row"><span>Learning calibration</span><strong id="v3OutcomeRiskFlagGovernanceLearning">-</strong></div>
      <div class="fpe-summary-row"><span>MC freshness</span><strong id="v3OutcomeRiskFlagFresh">-</strong></div>
      <div class="fpe-summary-row"><span>MC last run</span><strong id="v3OutcomeRiskFlagLastRun">-</strong></div>
      <div class="fpe-summary-row"><span>MC stale signal</span><strong id="v3OutcomeRiskFlagStale">-</strong></div>
    </div>
  `;

  forecastCol.append(forecastCard, confidenceCard);
  driversCol.append(controlsCard, sensitivityCard);
  riskCol.append(riskFlagsCard, interpretationCard, summaryCard);

  frame.append(forecastCol, driversCol, riskCol);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Outcome summarizes probability, not certainty.",
      "Sensitivity rankings identify which assumptions are worth validating in the field first.",
      "Interpretation should separate signal from model noise before decisions are logged."
    ])
  );

  wireOutcomeControlProxies();
  return refreshOutcomeSummary;
}

function wireOutcomeControlProxies() {
  bindOutcomeInputField("v3OutcomeOrgCount", "orgCount");
  bindOutcomeInputField("v3OutcomeOrgHours", "orgHoursPerWeek");
  bindOutcomeInputField("v3OutcomeVolunteerMult", "volunteerMultBase");
  bindOutcomeInputField("v3OutcomeDoorShare", "channelDoorPct");
  bindOutcomeInputField("v3OutcomeDoorsPerHour", "doorsPerHour3");
  bindOutcomeInputField("v3OutcomeCallsPerHour", "callsPerHour3");

  bindOutcomeSelectField("v3OutcomeMcMode", "mcMode");
  bindOutcomeInputField("v3OutcomeMcSeed", "mcSeed");
  bindOutcomeSelectField("v3OutcomeMcVolatility", "mcVolatility");
  bindOutcomeInputField("v3OutcomeTurnoutReliabilityPct", "turnoutReliabilityPct");

  bindOutcomeInputField("v3OutcomeMcContactMin", "mcContactMin");
  bindOutcomeInputField("v3OutcomeMcContactMode", "mcContactMode");
  bindOutcomeInputField("v3OutcomeMcContactMax", "mcContactMax");
  bindOutcomeInputField("v3OutcomeMcPersMin", "mcPersMin");
  bindOutcomeInputField("v3OutcomeMcPersMode", "mcPersMode");
  bindOutcomeInputField("v3OutcomeMcPersMax", "mcPersMax");
  bindOutcomeInputField("v3OutcomeMcReliMin", "mcReliMin");
  bindOutcomeInputField("v3OutcomeMcReliMode", "mcReliMode");
  bindOutcomeInputField("v3OutcomeMcReliMax", "mcReliMax");
  bindOutcomeInputField("v3OutcomeMcDphMin", "mcDphMin");
  bindOutcomeInputField("v3OutcomeMcDphMode", "mcDphMode");
  bindOutcomeInputField("v3OutcomeMcDphMax", "mcDphMax");
  bindOutcomeInputField("v3OutcomeMcCphMin", "mcCphMin");
  bindOutcomeInputField("v3OutcomeMcCphMode", "mcCphMode");
  bindOutcomeInputField("v3OutcomeMcCphMax", "mcCphMax");
  bindOutcomeInputField("v3OutcomeMcVolMin", "mcVolMin");
  bindOutcomeInputField("v3OutcomeMcVolMode", "mcVolMode");
  bindOutcomeInputField("v3OutcomeMcVolMax", "mcVolMax");

  bindOutcomeAction("v3BtnOutcomeRun", "runMc");
  bindOutcomeAction("v3BtnOutcomeRerun", "rerunMc");
  bindOutcomeAction("v3BtnComputeSurface", "computeSurface");

  bindOutcomeSelectField("v3OutcomeSurfaceLever", "surfaceLever");
  bindOutcomeSelectField("v3OutcomeSurfaceMode", "surfaceMode");
  bindOutcomeInputField("v3OutcomeSurfaceMin", "surfaceMin");
  bindOutcomeInputField("v3OutcomeSurfaceMax", "surfaceMax");
  bindOutcomeInputField("v3OutcomeSurfaceSteps", "surfaceSteps");
  bindOutcomeInputField("v3OutcomeSurfaceTarget", "surfaceTarget");
}

function refreshOutcomeSummary() {
  const canonicalView = readOutcomeCanonicalBridgeView();
  const derivedView = readOutcomeDerivedBridgeView();
  const combinedView = readOutcomeBridgeView();
  const outcomeControlView = canonicalView || combinedView;
  const outcomeDerivedView = derivedView || combinedView;
  const hasBridgeInputs = !!(outcomeControlView?.inputs && typeof outcomeControlView.inputs === "object");
  const hasBridgeControls = !!(outcomeControlView?.controls && typeof outcomeControlView.controls === "object");

  if (hasBridgeInputs) {
    applyOutcomeControlView(outcomeControlView);
  }

  const mcRunsInput = document.getElementById("v3OutcomeMcRuns");
  if (mcRunsInput instanceof HTMLInputElement) {
    if (document.activeElement !== mcRunsInput) {
      const runsValue = hasBridgeInputs ? String(outcomeControlView?.inputs?.mcRuns ?? "10000") : "10000";
      mcRunsInput.value = runsValue;
    }
    mcRunsInput.disabled = true;
  }

  // Bridge-driven controls; no legacy control-disabled mirror path.

  const outcomeWeeksRemaining = "See Plan timeline.";
  const outcomeCapacityPerWeek = "See Reach capacity outlook.";
  const outcomeGapNote = readText("#v3KpiBottleneck .fpe-kpi__value") || "See Reach capacity outlook.";
  const outcomeGapPerWeek = deriveGapFromNote(outcomeGapNote);

  setText("v3OutcomeWeeksRemaining", outcomeWeeksRemaining || "—");
  setText("v3OutcomeCapContacts", outcomeCapacityPerWeek || "—");
  setText("v3OutcomeGapContacts", outcomeGapPerWeek || "—");
  setText("v3OutcomeGapNote", outcomeGapNote || "—");

  const defaultSurfaceStatus = "Run surface compute to refresh win-band diagnostics.";
  const defaultSurfaceSummary = "Compute to see safe zones, cliffs, and diminishing returns.";
  const bridgedSurfaceStatus = String(outcomeDerivedView?.surfaceStatusText || "").trim();
  const bridgedSurfaceSummary = String(outcomeDerivedView?.surfaceSummaryText || "").trim();
  setText("v3OutcomeSurfaceStatus", bridgedSurfaceStatus || defaultSurfaceStatus);
  setText("v3OutcomeSurfaceSummary", bridgedSurfaceSummary || defaultSurfaceSummary);
  setText(
    "v3OutcomeImpactTraceNote",
    "Live dependency map for key planning outputs. This is explanatory only; it does not change model math."
  );

  const bridgeMc = outcomeDerivedView?.mc || null;
  const outcomeWinProb =
    formatOutcomeBridgeWinProb(bridgeMc?.winProb) ||
    readOutcomeWinProbability();
  setText("v3OutcomeForecastWinProb", outcomeWinProb);
  const outcomeP10 =
    formatOutcomeBridgeMargin(bridgeMc?.p10) ||
    readOutcomeSidebarPercentile("mcP10-sidebar");
  const outcomeP50 =
    formatOutcomeBridgeMargin(bridgeMc?.p50) ||
    readText("#v3KpiMargin .fpe-kpi__value") ||
    readOutcomeSidebarPercentile("mcP50-sidebar");
  const outcomeP90 =
    formatOutcomeBridgeMargin(bridgeMc?.p90) ||
    readOutcomeSidebarPercentile("mcP90-sidebar");
  const outcomeShiftP50 = formatOutcomeBridgeWhole(bridgeMc?.requiredShiftP50) || deriveShiftFromMargin(outcomeP50);
  const outcomeShiftP10 = formatOutcomeBridgeWhole(bridgeMc?.requiredShiftP10) || deriveShiftFromMargin(outcomeP10);
  const confidenceStats = buildConfidenceStats(outcomeP10, outcomeP50, outcomeP90, outcomeWinProb);
  const bridgeRiskGrade = String(bridgeMc?.riskGrade || "").trim();
  const bridgeRiskLabel = String(bridgeMc?.riskLabel || "").trim();
  const outcomeRiskLabel = bridgeRiskLabel || bridgeRiskGrade || buildOutcomeRiskLabel({
    p10: outcomeP10,
    p50: outcomeP50,
    p90: outcomeP90,
    winProb: outcomeWinProb
  });
  const outcomeFragility = buildOutcomeFragility(outcomeP10, outcomeP90);
  const outcomeFragilityIndex = formatOutcomeBridgeDecimal(bridgeMc?.fragilityIndex, 3) || outcomeFragility;
  const outcomeCliff = buildOutcomeCliff(outcomeP10, outcomeP50);
  const outcomeCliffText = formatOutcomeBridgePercent(bridgeMc?.cliffRisk) || outcomeCliff;
  const confMissRiskText = String(bridgeMc?.missRiskLabel || "").trim() || buildMissRiskSummary({
    outcomeP10,
    outcomeWinProb,
    outcomeRiskLabel
  });
  const confMarginOfSafety = formatOutcomeBridgeMargin(bridgeMc?.marginOfSafety) || confidenceStats.marginOfSafety;
  const confDownside = formatOutcomeBridgePercent(bridgeMc?.downsideRiskMass) || confidenceStats.downside;
  const confExpectedShortfall = formatOutcomeBridgeMargin(bridgeMc?.expectedShortfall10) || confidenceStats.es10;
  const confShift60 = formatOutcomeBridgeWhole(bridgeMc?.shiftWin60) || confidenceStats.shiftTo60;
  const confShift70 = formatOutcomeBridgeWhole(bridgeMc?.shiftWin70) || confidenceStats.shiftTo70;
  const confShift80 = formatOutcomeBridgeWhole(bridgeMc?.shiftWin80) || confidenceStats.shiftTo80;
  const confShock10 = formatOutcomeBridgePercent(bridgeMc?.shockLoss10) || confidenceStats.shock10;
  const confShock25 = formatOutcomeBridgePercent(bridgeMc?.shockLoss25) || confidenceStats.shock25;
  const confShock50 = formatOutcomeBridgePercent(bridgeMc?.shockLoss50) || confidenceStats.shock50;
  const derivedMcStatus = buildOutcomeMcStatus(outcomeWinProb, outcomeP10, outcomeP90);
  const mcStatus = {
    freshTag: String(bridgeMc?.freshTag || derivedMcStatus.freshTag || "—"),
    lastRun: String(bridgeMc?.lastRun || derivedMcStatus.lastRun || "—"),
    staleTag: String(bridgeMc?.staleTag || derivedMcStatus.staleTag || "—"),
  };
  const governanceView = outcomeDerivedView?.governance && typeof outcomeDerivedView.governance === "object"
    ? outcomeDerivedView.governance
    : null;
  const governanceRealism = formatOutcomeGovernanceSignal(governanceView?.realismStatus, governanceView?.realismScore);
  const governanceDataQuality = formatOutcomeGovernanceSignal(governanceView?.dataQualityStatus, governanceView?.dataQualityScore);
  const governanceConfidence = formatOutcomeGovernanceSignal(governanceView?.confidenceBand, governanceView?.confidenceScore);
  const governanceWarning = String(governanceView?.executionTopIssue || governanceView?.topWarning || "").trim() || "—";
  const governanceLearning = String(governanceView?.learningTopSuggestion || "").trim() || "—";
  setText("v3OutcomeForecastMedian", outcomeP50);
  setText("v3OutcomeForecastP95", outcomeP90);
  setText("v3OutcomeForecastP5", outcomeP10);

  setText("v3OutcomeMcFreshTag", mcStatus.freshTag);
  setText("v3OutcomeMcLastRun", mcStatus.lastRun);
  setText("v3OutcomeMcStale", mcStatus.staleTag);
  setText("v3OutcomeForecastRisk", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagLabel", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagGrade", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagFragility", outcomeFragilityIndex);
  setText("v3OutcomeRiskFlagGapNote", outcomeGapNote || "—");
  setText("v3OutcomeRiskFlagGovernanceRealism", governanceRealism);
  setText("v3OutcomeRiskFlagGovernanceData", governanceDataQuality);
  setText("v3OutcomeRiskFlagGovernanceConfidence", governanceConfidence);
  setText("v3OutcomeRiskFlagGovernanceWarning", governanceWarning);
  setText("v3OutcomeRiskFlagGovernanceLearning", governanceLearning);
  setText("v3OutcomeRiskFlagFresh", mcStatus.freshTag);
  setText("v3OutcomeRiskFlagLastRun", mcStatus.lastRun);
  setText("v3OutcomeRiskFlagStale", mcStatus.staleTag);

  setText("v3OutcomeWinProb", outcomeWinProb);
  setText("v3OutcomeP50", outcomeP50);
  setText("v3OutcomeP10", outcomeP10);
  setText("v3OutcomeP90", outcomeP90);
  setText("v3OutcomeRiskGrade", outcomeRiskLabel);
  setText("v3OutcomeFragility", outcomeFragilityIndex);
  syncOutcomeCardStatus("v3OutcomeForecastCardStatus", deriveOutcomeForecastCardStatus(outcomeWinProb, outcomeRiskLabel));
  syncOutcomeCardStatus("v3OutcomeConfidenceCardStatus", deriveOutcomeConfidenceCardStatus(outcomeFragility, outcomeCliff));
  syncOutcomeCardStatus("v3OutcomeRiskFlagsCardStatus", deriveOutcomeRiskFlagsCardStatus(mcStatus, outcomeRiskLabel, governanceView));
  syncOutcomeCardStatus("v3OutcomeSummaryCardStatus", deriveOutcomeSummaryCardStatus(outcomeRiskLabel, outcomeWinProb, outcomeFragility));

  setJoinedText("v3OutcomeConfMargins", [outcomeP10, outcomeP50, outcomeP90], " / ");
  setText("v3OutcomeConfAttempts", confidenceStats.attemptsBand);
  setText("v3OutcomeConfConvos", confidenceStats.conversationBand);
  setText("v3OutcomeConfFinish", confidenceStats.finishBand);
  setText("v3OutcomeConfMissRisk", confMissRiskText);
  setText("v3OutcomeConfMoS", confMarginOfSafety);
  setText("v3OutcomeConfDownside", confDownside);
  setText("v3OutcomeConfES10", confExpectedShortfall);
  setText("v3OutcomeConfShiftP50", outcomeShiftP50);
  setText("v3OutcomeConfShiftP10", outcomeShiftP10);
  setText("v3OutcomeConfFragility", outcomeFragilityIndex);
  setText("v3OutcomeConfCliff", outcomeCliffText);
  setText("v3OutcomeConfRiskGrade", outcomeRiskLabel);
  setText("v3OutcomeConfShift60", confShift60);
  setText("v3OutcomeConfShift70", confShift70);
  setText("v3OutcomeConfShift80", confShift80);
  setText("v3OutcomeConfShock10", confShock10);
  setText("v3OutcomeConfShock25", confShock25);
  setText("v3OutcomeConfShock50", confShock50);

  const bridgedSensitivityRows = Array.isArray(outcomeDerivedView?.sensitivityRows) ? outcomeDerivedView.sensitivityRows : [];
  renderOutcomeSensitivityRows(bridgedSensitivityRows);

  const bridgedSurfaceRows = Array.isArray(outcomeDerivedView?.surfaceRows) ? outcomeDerivedView.surfaceRows : [];
  renderOutcomeSurfaceRows(bridgedSurfaceRows);
  syncOutcomeCardStatus("v3OutcomeSensitivityCardStatus", deriveOutcomeSensitivityCardStatus(bridgedSensitivityRows, bridgedSurfaceStatus));
  syncOutcomeCardStatus("v3OutcomeInterpretationCardStatus", deriveOutcomeInterpretationCardStatus(bridgedSensitivityRows, bridgedSurfaceRows));
  syncOutcomeImpactTraceFallback({
    targetId: "v3OutcomeImpactTraceList",
    outcomeGapNote,
    outcomeRiskLabel,
    outcomeWinProb
  });

  if (hasBridgeControls) {
    setOutcomeControlDisabled("v3BtnOutcomeRun", !!outcomeControlView?.controls?.runDisabled);
    setOutcomeControlDisabled("v3BtnOutcomeRerun", !!outcomeControlView?.controls?.rerunDisabled);
    setOutcomeControlDisabled("v3BtnComputeSurface", !!outcomeControlView?.controls?.surfaceDisabled);
  }
}

function setJoinedText(targetId, values, separator = " / ") {
  const parts = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter((value) => !!value && value !== "—")
    : [];
  setText(targetId, parts.length ? parts.join(separator) : "—");
}

function readOutcomeCanonicalBridgeView() {
  const api = window[OUTCOME_API_KEY];
  if (!api || typeof api !== "object") {
    return null;
  }
  try {
    if (typeof api.getCanonicalView === "function") {
      const view = api.getCanonicalView();
      return view && typeof view === "object" ? view : null;
    }
    if (typeof api.getView !== "function") {
      return null;
    }
    const view = api.getView();
    if (!view || typeof view !== "object") {
      return null;
    }
    if (view.canonical && typeof view.canonical === "object") {
      return view.canonical;
    }
    return view;
  } catch {
    return null;
  }
}

function readOutcomeDerivedBridgeView() {
  const api = window[OUTCOME_API_KEY];
  if (!api || typeof api !== "object") {
    return null;
  }
  try {
    if (typeof api.getDerivedView === "function") {
      const view = api.getDerivedView();
      return view && typeof view === "object" ? view : null;
    }
    if (typeof api.getView !== "function") {
      return null;
    }
    const view = api.getView();
    if (!view || typeof view !== "object") {
      return null;
    }
    if (view.derived && typeof view.derived === "object") {
      return view.derived;
    }
    return view;
  } catch {
    return null;
  }
}

function readOutcomeBridgeView() {
  const api = window[OUTCOME_API_KEY];
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

function getOutcomeApi() {
  const api = window[OUTCOME_API_KEY];
  return api && typeof api === "object" ? api : null;
}

function bindOutcomeInputField(v3Id, field) {
  const input = document.getElementById(v3Id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (input.dataset.v3OutcomeBound === "1") {
    return;
  }
  input.dataset.v3OutcomeBound = "1";
  const onChange = () => {
    const api = getOutcomeApi();
    if (api && typeof api.setField === "function") {
      api.setField(field, input.value);
    }
  };
  input.addEventListener("input", onChange);
  input.addEventListener("change", onChange);
}

function bindOutcomeSelectField(v3Id, field) {
  const select = document.getElementById(v3Id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  if (select.dataset.v3OutcomeBound === "1") {
    return;
  }
  select.dataset.v3OutcomeBound = "1";
  select.addEventListener("change", () => {
    const api = getOutcomeApi();
    if (api && typeof api.setField === "function") {
      api.setField(field, select.value);
    }
  });
}

function bindOutcomeAction(v3Id, actionName) {
  const button = document.getElementById(v3Id);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  if (button.dataset.v3OutcomeBound === "1") {
    return;
  }
  button.dataset.v3OutcomeBound = "1";
  button.addEventListener("click", () => {
    const api = getOutcomeApi();
    if (api && typeof api[actionName] === "function") {
      api[actionName]();
    }
  });
}

function syncOutcomeInputValue(id, value) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.value = value == null ? "" : String(value);
}

function syncOutcomeSelectOptions(id, options, selectedValue) {
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
  if (document.activeElement !== select) {
    const wanted = selectedValue == null ? "" : String(selectedValue);
    if (wanted && !Array.from(select.options).some((option) => option.value === wanted)) {
      const extra = document.createElement("option");
      extra.value = wanted;
      extra.textContent = wanted;
      select.appendChild(extra);
    }
    select.value = wanted;
  }
}

function setOutcomeControlDisabled(id, disabled) {
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

function applyOutcomeControlView(view) {
  const inputs = view?.inputs && typeof view.inputs === "object" ? view.inputs : {};
  const options = view?.options && typeof view.options === "object" ? view.options : {};
  const controls = view?.controls && typeof view.controls === "object" ? view.controls : {};

  syncOutcomeInputValue("v3OutcomeOrgCount", inputs.orgCount);
  syncOutcomeInputValue("v3OutcomeOrgHours", inputs.orgHoursPerWeek);
  syncOutcomeInputValue("v3OutcomeVolunteerMult", inputs.volunteerMultBase);
  syncOutcomeInputValue("v3OutcomeDoorShare", inputs.channelDoorPct);
  syncOutcomeInputValue("v3OutcomeDoorsPerHour", inputs.doorsPerHour3);
  syncOutcomeInputValue("v3OutcomeCallsPerHour", inputs.callsPerHour3);
  syncOutcomeSelectOptions("v3OutcomeMcMode", options.mcMode || [], inputs.mcMode);
  syncOutcomeInputValue("v3OutcomeMcSeed", inputs.mcSeed);
  syncOutcomeSelectOptions("v3OutcomeMcVolatility", options.mcVolatility || [], inputs.mcVolatility);
  syncOutcomeInputValue("v3OutcomeTurnoutReliabilityPct", inputs.turnoutReliabilityPct);

  syncOutcomeInputValue("v3OutcomeMcContactMin", inputs.mcContactMin);
  syncOutcomeInputValue("v3OutcomeMcContactMode", inputs.mcContactMode);
  syncOutcomeInputValue("v3OutcomeMcContactMax", inputs.mcContactMax);
  syncOutcomeInputValue("v3OutcomeMcPersMin", inputs.mcPersMin);
  syncOutcomeInputValue("v3OutcomeMcPersMode", inputs.mcPersMode);
  syncOutcomeInputValue("v3OutcomeMcPersMax", inputs.mcPersMax);
  syncOutcomeInputValue("v3OutcomeMcReliMin", inputs.mcReliMin);
  syncOutcomeInputValue("v3OutcomeMcReliMode", inputs.mcReliMode);
  syncOutcomeInputValue("v3OutcomeMcReliMax", inputs.mcReliMax);
  syncOutcomeInputValue("v3OutcomeMcDphMin", inputs.mcDphMin);
  syncOutcomeInputValue("v3OutcomeMcDphMode", inputs.mcDphMode);
  syncOutcomeInputValue("v3OutcomeMcDphMax", inputs.mcDphMax);
  syncOutcomeInputValue("v3OutcomeMcCphMin", inputs.mcCphMin);
  syncOutcomeInputValue("v3OutcomeMcCphMode", inputs.mcCphMode);
  syncOutcomeInputValue("v3OutcomeMcCphMax", inputs.mcCphMax);
  syncOutcomeInputValue("v3OutcomeMcVolMin", inputs.mcVolMin);
  syncOutcomeInputValue("v3OutcomeMcVolMode", inputs.mcVolMode);
  syncOutcomeInputValue("v3OutcomeMcVolMax", inputs.mcVolMax);

  syncOutcomeSelectOptions("v3OutcomeSurfaceLever", options.surfaceLever || [], inputs.surfaceLever);
  syncOutcomeSelectOptions("v3OutcomeSurfaceMode", options.surfaceMode || [], inputs.surfaceMode);
  syncOutcomeInputValue("v3OutcomeSurfaceMin", inputs.surfaceMin);
  syncOutcomeInputValue("v3OutcomeSurfaceMax", inputs.surfaceMax);
  syncOutcomeInputValue("v3OutcomeSurfaceSteps", inputs.surfaceSteps);
  syncOutcomeInputValue("v3OutcomeSurfaceTarget", inputs.surfaceTarget);

  const locked = !!controls.locked;
  setOutcomeControlDisabled("v3OutcomeOrgCount", locked);
  setOutcomeControlDisabled("v3OutcomeOrgHours", locked);
  setOutcomeControlDisabled("v3OutcomeVolunteerMult", locked);
  setOutcomeControlDisabled("v3OutcomeDoorShare", locked);
  setOutcomeControlDisabled("v3OutcomeDoorsPerHour", locked);
  setOutcomeControlDisabled("v3OutcomeCallsPerHour", locked);
  setOutcomeControlDisabled("v3OutcomeMcMode", locked);
  setOutcomeControlDisabled("v3OutcomeMcSeed", locked);
  setOutcomeControlDisabled("v3OutcomeMcVolatility", locked);
  setOutcomeControlDisabled("v3OutcomeTurnoutReliabilityPct", locked);
  setOutcomeControlDisabled("v3OutcomeMcContactMin", locked);
  setOutcomeControlDisabled("v3OutcomeMcContactMode", locked);
  setOutcomeControlDisabled("v3OutcomeMcContactMax", locked);
  setOutcomeControlDisabled("v3OutcomeMcPersMin", locked);
  setOutcomeControlDisabled("v3OutcomeMcPersMode", locked);
  setOutcomeControlDisabled("v3OutcomeMcPersMax", locked);
  setOutcomeControlDisabled("v3OutcomeMcReliMin", locked);
  setOutcomeControlDisabled("v3OutcomeMcReliMode", locked);
  setOutcomeControlDisabled("v3OutcomeMcReliMax", locked);
  setOutcomeControlDisabled("v3OutcomeMcDphMin", locked);
  setOutcomeControlDisabled("v3OutcomeMcDphMode", locked);
  setOutcomeControlDisabled("v3OutcomeMcDphMax", locked);
  setOutcomeControlDisabled("v3OutcomeMcCphMin", locked);
  setOutcomeControlDisabled("v3OutcomeMcCphMode", locked);
  setOutcomeControlDisabled("v3OutcomeMcCphMax", locked);
  setOutcomeControlDisabled("v3OutcomeMcVolMin", locked);
  setOutcomeControlDisabled("v3OutcomeMcVolMode", locked);
  setOutcomeControlDisabled("v3OutcomeMcVolMax", locked);
  setOutcomeControlDisabled("v3OutcomeSurfaceLever", !!controls.surfaceDisabled);
  setOutcomeControlDisabled("v3OutcomeSurfaceMode", !!controls.surfaceDisabled);
  setOutcomeControlDisabled("v3OutcomeSurfaceMin", !!controls.surfaceDisabled);
  setOutcomeControlDisabled("v3OutcomeSurfaceMax", !!controls.surfaceDisabled);
  setOutcomeControlDisabled("v3OutcomeSurfaceSteps", !!controls.surfaceDisabled);
  setOutcomeControlDisabled("v3OutcomeSurfaceTarget", !!controls.surfaceDisabled);
}

function renderOutcomeSensitivityRows(rows) {
  const tbody = document.getElementById("v3OutcomeSensitivityTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  tbody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td class="muted">Run simulations to rank drivers.</td><td class="num muted">-</td></tr>';
    return;
  }
  for (const row of list) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = String(row?.label || "—");
    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = formatOutcomeSensitivityImpact(row?.impact, 2);
    tr.append(td0, td1);
    tbody.appendChild(tr);
  }
}

function renderOutcomeSurfaceRows(rows) {
  const tbody = document.getElementById("v3OutcomeSurfaceTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  tbody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">Run surface compute.</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
      </tr>
    `;
    return;
  }
  for (const row of list) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = String(row?.leverValue ?? "—");

    const td1 = document.createElement("td");
    td1.className = "num";
    const winProb = Number(row?.winProb);
    td1.textContent = formatPercentFromUnit(winProb, 1);

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = formatSignedWhole(Number(row?.p10));

    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = formatSignedWhole(Number(row?.p50));

    const td4 = document.createElement("td");
    td4.className = "num";
    td4.textContent = formatSignedWhole(Number(row?.p90));

    tr.append(td0, td1, td2, td3, td4);
    tbody.appendChild(tr);
  }
}

function syncOutcomeImpactTraceFallback({ targetId, outcomeGapNote, outcomeRiskLabel, outcomeWinProb }) {
  const target = document.getElementById(targetId);
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const rows = [
    `Capacity -> Gap note: ${String(outcomeGapNote || "—").trim() || "—"}`,
    `Risk posture -> ${String(outcomeRiskLabel || "—").trim() || "—"}`,
    `Win probability context -> ${String(outcomeWinProb || "—").trim() || "—"}`
  ];
  target.innerHTML = rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("");
}


function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readOutcomeWinProbability() {
  const kpiValue = readText("#v3KpiWinProb .fpe-kpi__value");
  return kpiValue || "—";
}

function readOutcomeSidebarPercentile(id) {
  const raw = readText(`#${id}`);
  if (!raw) {
    return "—";
  }
  const idx = raw.indexOf(":");
  const value = idx >= 0 ? raw.slice(idx + 1).trim() : raw.trim();
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

function syncOutcomeCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || OUTCOME_STATUS_AWAITING_RUN;
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyOutcomeStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
}
