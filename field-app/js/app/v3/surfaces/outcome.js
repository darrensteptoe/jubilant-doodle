import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  bindClickProxy,
  bindFieldProxy,
  bindSelectProxy,
  readText,
  setText,
  syncControlDisabled,
  syncButtonDisabled,
  syncFieldValue,
  syncLegacyTableRows,
  syncSelectValue
} from "../surfaceUtils.js";

const OUTCOME_API_KEY = "__FPE_OUTCOME_API__";

export function renderOutcomeSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const forecastCol = createColumn("forecast");
  const driversCol = createColumn("drivers");
  const riskCol = createColumn("risk");

  const controlsCard = createCard({
    title: "Drivers",
    description: "Execution assumptions, uncertainty mode, and Monte Carlo controls that drive outcome behavior."
  });

  const forecastCard = createCard({
    title: "Forecast",
    description: "Win probability and projected margin under current assumptions."
  });

  const confidenceCard = createCard({
    title: "Confidence envelope",
    description: "P10/P50/P90 spread and distribution shape."
  });

  const sensitivityCard = createCard({
    title: "Sensitivity & surface",
    description: "Driver ranking and lever surface diagnostics."
  });

  const interpretationCard = createCard({
    title: "Interpretation",
    description: "Risk framing and explanatory links between assumptions and outputs."
  });

  const riskFlagsCard = createCard({
    title: "Risk flags",
    description: "Current warning posture and freshness checks before trusting the forecast."
  });

  const summaryCard = createCard({
    title: "Outcome summary",
    description: "Current confidence posture and fragility at a glance."
  });

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
  const api = getOutcomeApi();
  if (!api || typeof api.setField !== "function") {
    bindFieldProxy("v3OutcomeOrgCount", "orgCount");
    bindFieldProxy("v3OutcomeOrgHours", "orgHoursPerWeek");
    bindFieldProxy("v3OutcomeVolunteerMult", "volunteerMultBase");
    bindFieldProxy("v3OutcomeDoorShare", "channelDoorPct");
    bindFieldProxy("v3OutcomeDoorsPerHour", "doorsPerHour3");
    bindFieldProxy("v3OutcomeCallsPerHour", "callsPerHour3");

    bindSelectProxy("v3OutcomeMcMode", "mcMode");
    bindFieldProxy("v3OutcomeMcSeed", "mcSeed");
    bindSelectProxy("v3OutcomeMcVolatility", "mcVolatility");
    bindFieldProxy("v3OutcomeTurnoutReliabilityPct", "turnoutReliabilityPct");

    bindFieldProxy("v3OutcomeMcContactMin", "mcContactMin");
    bindFieldProxy("v3OutcomeMcContactMode", "mcContactMode");
    bindFieldProxy("v3OutcomeMcContactMax", "mcContactMax");
    bindFieldProxy("v3OutcomeMcPersMin", "mcPersMin");
    bindFieldProxy("v3OutcomeMcPersMode", "mcPersMode");
    bindFieldProxy("v3OutcomeMcPersMax", "mcPersMax");
    bindFieldProxy("v3OutcomeMcReliMin", "mcReliMin");
    bindFieldProxy("v3OutcomeMcReliMode", "mcReliMode");
    bindFieldProxy("v3OutcomeMcReliMax", "mcReliMax");
    bindFieldProxy("v3OutcomeMcDphMin", "mcDphMin");
    bindFieldProxy("v3OutcomeMcDphMode", "mcDphMode");
    bindFieldProxy("v3OutcomeMcDphMax", "mcDphMax");
    bindFieldProxy("v3OutcomeMcCphMin", "mcCphMin");
    bindFieldProxy("v3OutcomeMcCphMode", "mcCphMode");
    bindFieldProxy("v3OutcomeMcCphMax", "mcCphMax");
    bindFieldProxy("v3OutcomeMcVolMin", "mcVolMin");
    bindFieldProxy("v3OutcomeMcVolMode", "mcVolMode");
    bindFieldProxy("v3OutcomeMcVolMax", "mcVolMax");

    bindClickProxy("v3BtnOutcomeRun", "mcRun");
    bindClickProxy("v3BtnOutcomeRerun", "mcRerun");
    bindClickProxy("v3BtnComputeSurface", "btnComputeSurface");

    bindSelectProxy("v3OutcomeSurfaceLever", "surfaceLever");
    bindSelectProxy("v3OutcomeSurfaceMode", "surfaceMode");
    bindFieldProxy("v3OutcomeSurfaceMin", "surfaceMin");
    bindFieldProxy("v3OutcomeSurfaceMax", "surfaceMax");
    bindFieldProxy("v3OutcomeSurfaceSteps", "surfaceSteps");
    bindFieldProxy("v3OutcomeSurfaceTarget", "surfaceTarget");
    return;
  }

  bindOutcomeInputField("v3OutcomeOrgCount", "orgCount", "orgCount");
  bindOutcomeInputField("v3OutcomeOrgHours", "orgHoursPerWeek", "orgHoursPerWeek");
  bindOutcomeInputField("v3OutcomeVolunteerMult", "volunteerMultBase", "volunteerMultBase");
  bindOutcomeInputField("v3OutcomeDoorShare", "channelDoorPct", "channelDoorPct");
  bindOutcomeInputField("v3OutcomeDoorsPerHour", "doorsPerHour3", "doorsPerHour3");
  bindOutcomeInputField("v3OutcomeCallsPerHour", "callsPerHour3", "callsPerHour3");

  bindOutcomeSelectField("v3OutcomeMcMode", "mcMode", "mcMode");
  bindOutcomeInputField("v3OutcomeMcSeed", "mcSeed", "mcSeed");
  bindOutcomeSelectField("v3OutcomeMcVolatility", "mcVolatility", "mcVolatility");
  bindOutcomeInputField("v3OutcomeTurnoutReliabilityPct", "turnoutReliabilityPct", "turnoutReliabilityPct");

  bindOutcomeInputField("v3OutcomeMcContactMin", "mcContactMin", "mcContactMin");
  bindOutcomeInputField("v3OutcomeMcContactMode", "mcContactMode", "mcContactMode");
  bindOutcomeInputField("v3OutcomeMcContactMax", "mcContactMax", "mcContactMax");
  bindOutcomeInputField("v3OutcomeMcPersMin", "mcPersMin", "mcPersMin");
  bindOutcomeInputField("v3OutcomeMcPersMode", "mcPersMode", "mcPersMode");
  bindOutcomeInputField("v3OutcomeMcPersMax", "mcPersMax", "mcPersMax");
  bindOutcomeInputField("v3OutcomeMcReliMin", "mcReliMin", "mcReliMin");
  bindOutcomeInputField("v3OutcomeMcReliMode", "mcReliMode", "mcReliMode");
  bindOutcomeInputField("v3OutcomeMcReliMax", "mcReliMax", "mcReliMax");
  bindOutcomeInputField("v3OutcomeMcDphMin", "mcDphMin", "mcDphMin");
  bindOutcomeInputField("v3OutcomeMcDphMode", "mcDphMode", "mcDphMode");
  bindOutcomeInputField("v3OutcomeMcDphMax", "mcDphMax", "mcDphMax");
  bindOutcomeInputField("v3OutcomeMcCphMin", "mcCphMin", "mcCphMin");
  bindOutcomeInputField("v3OutcomeMcCphMode", "mcCphMode", "mcCphMode");
  bindOutcomeInputField("v3OutcomeMcCphMax", "mcCphMax", "mcCphMax");
  bindOutcomeInputField("v3OutcomeMcVolMin", "mcVolMin", "mcVolMin");
  bindOutcomeInputField("v3OutcomeMcVolMode", "mcVolMode", "mcVolMode");
  bindOutcomeInputField("v3OutcomeMcVolMax", "mcVolMax", "mcVolMax");

  bindOutcomeAction("v3BtnOutcomeRun", "runMc", "mcRun");
  bindOutcomeAction("v3BtnOutcomeRerun", "rerunMc", "mcRerun");
  bindOutcomeAction("v3BtnComputeSurface", "computeSurface", "btnComputeSurface");

  bindOutcomeSelectField("v3OutcomeSurfaceLever", "surfaceLever", "surfaceLever");
  bindOutcomeSelectField("v3OutcomeSurfaceMode", "surfaceMode", "surfaceMode");
  bindOutcomeInputField("v3OutcomeSurfaceMin", "surfaceMin", "surfaceMin");
  bindOutcomeInputField("v3OutcomeSurfaceMax", "surfaceMax", "surfaceMax");
  bindOutcomeInputField("v3OutcomeSurfaceSteps", "surfaceSteps", "surfaceSteps");
  bindOutcomeInputField("v3OutcomeSurfaceTarget", "surfaceTarget", "surfaceTarget");
}

function refreshOutcomeSummary() {
  const outcomeView = readOutcomeBridgeView();
  const hasBridgeInputs = !!(outcomeView?.inputs && typeof outcomeView.inputs === "object");
  const hasBridgeControls = !!(outcomeView?.controls && typeof outcomeView.controls === "object");

  if (hasBridgeInputs) {
    applyOutcomeControlView(outcomeView);
  } else {
    syncFieldValue("v3OutcomeOrgCount", "orgCount");
    syncFieldValue("v3OutcomeOrgHours", "orgHoursPerWeek");
    syncFieldValue("v3OutcomeVolunteerMult", "volunteerMultBase");
    syncFieldValue("v3OutcomeDoorShare", "channelDoorPct");
    syncFieldValue("v3OutcomeDoorsPerHour", "doorsPerHour3");
    syncFieldValue("v3OutcomeCallsPerHour", "callsPerHour3");

    syncSelectValue("v3OutcomeMcMode", "mcMode");
    syncFieldValue("v3OutcomeMcSeed", "mcSeed");
    syncSelectValue("v3OutcomeMcVolatility", "mcVolatility");
    syncFieldValue("v3OutcomeTurnoutReliabilityPct", "turnoutReliabilityPct");

    syncFieldValue("v3OutcomeMcContactMin", "mcContactMin");
    syncFieldValue("v3OutcomeMcContactMode", "mcContactMode");
    syncFieldValue("v3OutcomeMcContactMax", "mcContactMax");
    syncFieldValue("v3OutcomeMcPersMin", "mcPersMin");
    syncFieldValue("v3OutcomeMcPersMode", "mcPersMode");
    syncFieldValue("v3OutcomeMcPersMax", "mcPersMax");
    syncFieldValue("v3OutcomeMcReliMin", "mcReliMin");
    syncFieldValue("v3OutcomeMcReliMode", "mcReliMode");
    syncFieldValue("v3OutcomeMcReliMax", "mcReliMax");
    syncFieldValue("v3OutcomeMcDphMin", "mcDphMin");
    syncFieldValue("v3OutcomeMcDphMode", "mcDphMode");
    syncFieldValue("v3OutcomeMcDphMax", "mcDphMax");
    syncFieldValue("v3OutcomeMcCphMin", "mcCphMin");
    syncFieldValue("v3OutcomeMcCphMode", "mcCphMode");
    syncFieldValue("v3OutcomeMcCphMax", "mcCphMax");
    syncFieldValue("v3OutcomeMcVolMin", "mcVolMin");
    syncFieldValue("v3OutcomeMcVolMode", "mcVolMode");
    syncFieldValue("v3OutcomeMcVolMax", "mcVolMax");

    syncSelectValue("v3OutcomeSurfaceLever", "surfaceLever");
    syncSelectValue("v3OutcomeSurfaceMode", "surfaceMode");
    syncFieldValue("v3OutcomeSurfaceMin", "surfaceMin");
    syncFieldValue("v3OutcomeSurfaceMax", "surfaceMax");
    syncFieldValue("v3OutcomeSurfaceSteps", "surfaceSteps");
    syncFieldValue("v3OutcomeSurfaceTarget", "surfaceTarget");
  }

  const mcRunsInput = document.getElementById("v3OutcomeMcRuns");
  if (mcRunsInput instanceof HTMLInputElement) {
    if (document.activeElement !== mcRunsInput) {
      const runsValue = hasBridgeInputs ? String(outcomeView?.inputs?.mcRuns ?? "10000") : "10000";
      mcRunsInput.value = runsValue;
    }
    mcRunsInput.disabled = true;
  }

  if (!hasBridgeControls) {
    syncControlDisabled("v3OutcomeOrgCount", "orgCount");
    syncControlDisabled("v3OutcomeOrgHours", "orgHoursPerWeek");
    syncControlDisabled("v3OutcomeVolunteerMult", "volunteerMultBase");
    syncControlDisabled("v3OutcomeDoorShare", "channelDoorPct");
    syncControlDisabled("v3OutcomeDoorsPerHour", "doorsPerHour3");
    syncControlDisabled("v3OutcomeCallsPerHour", "callsPerHour3");
    syncControlDisabled("v3OutcomeMcMode", "mcMode");
    syncControlDisabled("v3OutcomeMcSeed", "mcSeed");
    syncControlDisabled("v3OutcomeMcVolatility", "mcVolatility");
    syncControlDisabled("v3OutcomeTurnoutReliabilityPct", "turnoutReliabilityPct");
    syncControlDisabled("v3OutcomeMcContactMin", "mcContactMin");
    syncControlDisabled("v3OutcomeMcContactMode", "mcContactMode");
    syncControlDisabled("v3OutcomeMcContactMax", "mcContactMax");
    syncControlDisabled("v3OutcomeMcPersMin", "mcPersMin");
    syncControlDisabled("v3OutcomeMcPersMode", "mcPersMode");
    syncControlDisabled("v3OutcomeMcPersMax", "mcPersMax");
    syncControlDisabled("v3OutcomeMcReliMin", "mcReliMin");
    syncControlDisabled("v3OutcomeMcReliMode", "mcReliMode");
    syncControlDisabled("v3OutcomeMcReliMax", "mcReliMax");
    syncControlDisabled("v3OutcomeMcDphMin", "mcDphMin");
    syncControlDisabled("v3OutcomeMcDphMode", "mcDphMode");
    syncControlDisabled("v3OutcomeMcDphMax", "mcDphMax");
    syncControlDisabled("v3OutcomeMcCphMin", "mcCphMin");
    syncControlDisabled("v3OutcomeMcCphMode", "mcCphMode");
    syncControlDisabled("v3OutcomeMcCphMax", "mcCphMax");
    syncControlDisabled("v3OutcomeMcVolMin", "mcVolMin");
    syncControlDisabled("v3OutcomeMcVolMode", "mcVolMode");
    syncControlDisabled("v3OutcomeMcVolMax", "mcVolMax");
    syncControlDisabled("v3OutcomeSurfaceLever", "surfaceLever");
    syncControlDisabled("v3OutcomeSurfaceMode", "surfaceMode");
    syncControlDisabled("v3OutcomeSurfaceMin", "surfaceMin");
    syncControlDisabled("v3OutcomeSurfaceMax", "surfaceMax");
    syncControlDisabled("v3OutcomeSurfaceSteps", "surfaceSteps");
    syncControlDisabled("v3OutcomeSurfaceTarget", "surfaceTarget");
  }

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
  const bridgedSurfaceStatus = String(outcomeView?.surfaceStatusText || "").trim();
  const bridgedSurfaceSummary = String(outcomeView?.surfaceSummaryText || "").trim();
  setText("v3OutcomeSurfaceStatus", bridgedSurfaceStatus || defaultSurfaceStatus);
  setText("v3OutcomeSurfaceSummary", bridgedSurfaceSummary || defaultSurfaceSummary);
  setText(
    "v3OutcomeImpactTraceNote",
    "Live dependency map for key planning outputs. This is explanatory only; it does not change model math."
  );

  const bridgeMc = outcomeView?.mc || null;
  const outcomeWinProb =
    formatBridgeWinProb(bridgeMc?.winProb) ||
    readOutcomeWinProbability();
  setText("v3OutcomeForecastWinProb", outcomeWinProb);
  const outcomeP10 =
    formatBridgeMargin(bridgeMc?.p10) ||
    readOutcomeSidebarPercentile("mcP10-sidebar");
  const outcomeP50 =
    formatBridgeMargin(bridgeMc?.p50) ||
    readText("#v3KpiMargin .fpe-kpi__value") ||
    readOutcomeSidebarPercentile("mcP50-sidebar");
  const outcomeP90 =
    formatBridgeMargin(bridgeMc?.p90) ||
    readOutcomeSidebarPercentile("mcP90-sidebar");
  const outcomeShiftP50 = deriveShiftFromMargin(outcomeP50);
  const outcomeShiftP10 = deriveShiftFromMargin(outcomeP10);
  const confidenceStats = buildConfidenceStats(outcomeP10, outcomeP50, outcomeP90, outcomeWinProb);
  const bridgeRiskGrade = String(bridgeMc?.riskGrade || "").trim();
  const outcomeRiskLabel = bridgeRiskGrade || buildOutcomeRiskLabel({
    p10: outcomeP10,
    p50: outcomeP50,
    p90: outcomeP90,
    winProb: outcomeWinProb
  });
  const outcomeFragility = buildOutcomeFragility(outcomeP10, outcomeP90);
  const outcomeCliff = buildOutcomeCliff(outcomeP10, outcomeP50);
  const derivedMcStatus = buildOutcomeMcStatus(outcomeWinProb, outcomeP10, outcomeP90);
  const mcStatus = {
    freshTag: String(bridgeMc?.freshTag || derivedMcStatus.freshTag || "—"),
    lastRun: String(bridgeMc?.lastRun || derivedMcStatus.lastRun || "—"),
    staleTag: String(bridgeMc?.staleTag || derivedMcStatus.staleTag || "—"),
  };
  setText("v3OutcomeForecastMedian", outcomeP50);
  setText("v3OutcomeForecastP95", outcomeP90);
  setText("v3OutcomeForecastP5", outcomeP10);

  setText("v3OutcomeMcFreshTag", mcStatus.freshTag);
  setText("v3OutcomeMcLastRun", mcStatus.lastRun);
  setText("v3OutcomeMcStale", mcStatus.staleTag);
  setText("v3OutcomeForecastRisk", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagLabel", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagGrade", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagFragility", outcomeFragility);
  setText("v3OutcomeRiskFlagGapNote", outcomeGapNote || "—");
  setText("v3OutcomeRiskFlagFresh", mcStatus.freshTag);
  setText("v3OutcomeRiskFlagLastRun", mcStatus.lastRun);
  setText("v3OutcomeRiskFlagStale", mcStatus.staleTag);

  setText("v3OutcomeWinProb", outcomeWinProb);
  setText("v3OutcomeP50", outcomeP50);
  setText("v3OutcomeP10", outcomeP10);
  setText("v3OutcomeP90", outcomeP90);
  setText("v3OutcomeRiskGrade", outcomeRiskLabel);
  setText("v3OutcomeFragility", outcomeFragility);

  setJoinedText("v3OutcomeConfMargins", [outcomeP10, outcomeP50, outcomeP90], " / ");
  setText("v3OutcomeConfAttempts", confidenceStats.attemptsBand);
  setText("v3OutcomeConfConvos", confidenceStats.conversationBand);
  setText("v3OutcomeConfFinish", confidenceStats.finishBand);
  setText("v3OutcomeConfMissRisk", buildMissRiskSummary({
    outcomeP10,
    outcomeWinProb,
    outcomeRiskLabel
  }));
  setText("v3OutcomeConfMoS", confidenceStats.marginOfSafety);
  setText("v3OutcomeConfDownside", confidenceStats.downside);
  setText("v3OutcomeConfES10", confidenceStats.es10);
  setText("v3OutcomeConfShiftP50", outcomeShiftP50);
  setText("v3OutcomeConfShiftP10", outcomeShiftP10);
  setText("v3OutcomeConfFragility", outcomeFragility);
  setText("v3OutcomeConfCliff", outcomeCliff);
  setText("v3OutcomeConfRiskGrade", outcomeRiskLabel);
  setText("v3OutcomeConfShift60", confidenceStats.shiftTo60);
  setText("v3OutcomeConfShift70", confidenceStats.shiftTo70);
  setText("v3OutcomeConfShift80", confidenceStats.shiftTo80);
  setText("v3OutcomeConfShock10", confidenceStats.shock10);
  setText("v3OutcomeConfShock25", confidenceStats.shock25);
  setText("v3OutcomeConfShock50", confidenceStats.shock50);

  const bridgedSensitivityRows = Array.isArray(outcomeView?.sensitivityRows)
    ? outcomeView.sensitivityRows
    : null;
  if (bridgedSensitivityRows){
    renderOutcomeSensitivityRows(bridgedSensitivityRows);
  } else {
    syncLegacyTableRows({
      sourceSelector: "#mcSensitivity",
      targetBodyId: "v3OutcomeSensitivityTbody",
      expectedCols: 2,
      emptyLabel: "Run simulations to rank drivers.",
      numericColumns: [1]
    });
  }

  const bridgedSurfaceRows = Array.isArray(outcomeView?.surfaceRows)
    ? outcomeView.surfaceRows
    : null;
  if (bridgedSurfaceRows){
    renderOutcomeSurfaceRows(bridgedSurfaceRows);
  } else {
    syncLegacyTableRows({
      sourceSelector: "#surfaceTbody",
      targetBodyId: "v3OutcomeSurfaceTbody",
      expectedCols: 5,
      emptyLabel: "Run surface compute.",
      numericColumns: [1, 2, 3]
    });
  }
  syncOutcomeImpactTraceFallback({
    targetId: "v3OutcomeImpactTraceList",
    outcomeGapNote,
    outcomeRiskLabel,
    outcomeWinProb
  });

  if (hasBridgeControls) {
    setOutcomeControlDisabled("v3BtnOutcomeRun", !!outcomeView?.controls?.runDisabled);
    setOutcomeControlDisabled("v3BtnOutcomeRerun", !!outcomeView?.controls?.rerunDisabled);
    setOutcomeControlDisabled("v3BtnComputeSurface", !!outcomeView?.controls?.surfaceDisabled);
  } else {
    syncButtonDisabled("v3BtnOutcomeRun", "mcRun");
    syncButtonDisabled("v3BtnOutcomeRerun", "mcRerun");
    syncButtonDisabled("v3BtnComputeSurface", "btnComputeSurface");
  }
}

function setJoinedText(targetId, values, separator = " / ") {
  const parts = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter((value) => !!value && value !== "—")
    : [];
  setText(targetId, parts.length ? parts.join(separator) : "—");
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

function bindOutcomeInputField(v3Id, field, legacyId) {
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
      return;
    }
    dispatchLegacyField(legacyId, input.value);
  };
  input.addEventListener("input", onChange);
  input.addEventListener("change", onChange);
}

function bindOutcomeSelectField(v3Id, field, legacyId) {
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
      return;
    }
    dispatchLegacyField(legacyId, select.value, { isSelect: true });
  });
}

function bindOutcomeAction(v3Id, actionName, legacyId) {
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
      return;
    }
    const legacyBtn = document.getElementById(legacyId);
    if (legacyBtn instanceof HTMLElement && typeof legacyBtn.click === "function") {
      legacyBtn.click();
    }
  });
}

function dispatchLegacyField(id, value, { isSelect = false } = {}) {
  const legacy = document.getElementById(id);
  if (isSelect) {
    if (!(legacy instanceof HTMLSelectElement)) {
      return;
    }
    legacy.value = String(value ?? "");
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (!(legacy instanceof HTMLInputElement) && !(legacy instanceof HTMLTextAreaElement)) {
    return;
  }
  legacy.value = String(value ?? "");
  legacy.dispatchEvent(new Event("input", { bubbles: true }));
  legacy.dispatchEvent(new Event("change", { bubbles: true }));
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
    select.value = selectedValue == null ? "" : String(selectedValue);
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
    const impact = Number(row?.impact);
    td1.textContent = Number.isFinite(impact) ? impact.toFixed(2) : "—";
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
    td1.textContent = Number.isFinite(winProb) ? `${(winProb * 100).toFixed(1)}%` : "—";

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

function buildMissRiskSummary({ outcomeP10, outcomeWinProb, outcomeRiskLabel }) {
  const p10 = parseSignedNumber(outcomeP10);
  const winProb = parsePercentNumber(outcomeWinProb);
  const risk = String(outcomeRiskLabel || "").toLowerCase();

  if (risk.includes("high")) {
    return "High miss risk";
  }
  if (risk.includes("moderate") || risk.includes("watch")) {
    return "Moderate miss risk";
  }

  if (Number.isFinite(winProb)) {
    if (winProb < 50) {
      return "High miss risk";
    }
    if (winProb < 60) {
      return "Moderate miss risk";
    }
  }

  if (Number.isFinite(p10)) {
    return p10 < 0 ? "Moderate miss risk (downside path negative)" : "Low miss risk";
  }

  return "Risk pending";
}

function buildOutcomeRiskLabel({ p10, p50, p90, winProb }) {
  const p10Num = parseSignedNumber(p10);
  const p50Num = parseSignedNumber(p50);
  const p90Num = parseSignedNumber(p90);
  const winProbNum = parsePercentNumber(winProb);

  if (Number.isFinite(winProbNum) && winProbNum < 50) {
    return "High risk";
  }
  if (Number.isFinite(p10Num) && Number.isFinite(p50Num) && p10Num < 0 && p50Num < 0) {
    return "High risk";
  }
  if (Number.isFinite(p10Num) && p10Num < 0) {
    return "Moderate risk";
  }
  if (Number.isFinite(p90Num) && p90Num <= 0) {
    return "Watch";
  }
  return "Low risk";
}

function buildOutcomeFragility(p10, p90) {
  const low = parseSignedNumber(p10);
  const high = parseSignedNumber(p90);
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return "Pending";
  }
  const spread = Math.abs(high - low);
  if (spread >= 80) {
    return "High";
  }
  if (spread >= 40) {
    return "Moderate";
  }
  return "Low";
}

function buildOutcomeCliff(p10, p50) {
  const low = parseSignedNumber(p10);
  const mid = parseSignedNumber(p50);
  if (!Number.isFinite(low) || !Number.isFinite(mid)) {
    return "Pending";
  }
  if (low < 0 && mid >= 0) {
    return "Potential cliff under downside path";
  }
  if (mid < 0) {
    return "Active cliff risk";
  }
  return "No immediate cliff signal";
}

function buildOutcomeMcStatus(winProb, p10, p90) {
  const winProbNum = parsePercentNumber(winProb);
  const p10Num = parseSignedNumber(p10);
  const p90Num = parseSignedNumber(p90);

  const freshTag = Number.isFinite(winProbNum) ? "MC snapshot available" : "MC pending";
  const lastRun = Number.isFinite(winProbNum) ? "Recent run reflected in KPI strip" : "No run reflected yet";
  let staleTag = "Unknown";
  if (Number.isFinite(p10Num) && Number.isFinite(p90Num)) {
    staleTag = Math.abs(p90Num - p10Num) > 0 ? "Current distribution loaded" : "Distribution appears flat";
  }
  return { freshTag, lastRun, staleTag };
}

function buildConfidenceStats(p10, p50, p90, winProbText) {
  const p10Num = parseSignedNumber(p10);
  const p50Num = parseSignedNumber(p50);
  const p90Num = parseSignedNumber(p90);
  const winProbNum = parsePercentNumber(winProbText);

  const attemptsBand = Number.isFinite(p10Num) || Number.isFinite(p50Num) || Number.isFinite(p90Num)
    ? "Use sensitivity table for P10/P50/P90 attempt deltas."
    : "Run MC to estimate attempt bands.";
  const conversationBand = Number.isFinite(p10Num) || Number.isFinite(p50Num) || Number.isFinite(p90Num)
    ? "Conversation requirement follows attempt volatility."
    : "Run MC to estimate conversation bands.";
  const finishBand = Number.isFinite(p10Num)
    ? p10Num >= 0
      ? "Finish risk low at current pace."
      : "Finish risk elevated under downside path."
    : "Run MC to estimate finish-date spread.";

  const marginOfSafety = Number.isFinite(p10Num)
    ? `${formatSignedWhole(p10Num)} net votes`
    : "—";
  const downside = Number.isFinite(p10Num)
    ? p10Num < 0
      ? "Elevated downside risk"
      : "Contained downside risk"
    : "—";
  const es10 = Number.isFinite(p10Num)
    ? `${formatSignedWhole(p10Num)} (proxy from P10)`
    : "—";

  const shiftTo60 = buildShiftToProbability(winProbNum, 60, p50Num);
  const shiftTo70 = buildShiftToProbability(winProbNum, 70, p50Num);
  const shiftTo80 = buildShiftToProbability(winProbNum, 80, p50Num);

  const shock10 = buildShockGuidance(p10Num, p50Num, 10);
  const shock25 = buildShockGuidance(p10Num, p50Num, 25);
  const shock50 = buildShockGuidance(p10Num, p50Num, 50);

  return {
    attemptsBand,
    conversationBand,
    finishBand,
    marginOfSafety,
    downside,
    es10,
    shiftTo60,
    shiftTo70,
    shiftTo80,
    shock10,
    shock25,
    shock50
  };
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

function buildShiftToProbability(currentProb, targetProb, p50Margin) {
  if (Number.isFinite(currentProb)) {
    if (currentProb >= targetProb) {
      return "0";
    }
    const gap = targetProb - currentProb;
    if (Number.isFinite(p50Margin)) {
      const penalty = p50Margin < 0 ? Math.ceil(Math.abs(p50Margin)) : 0;
      return `${Math.max(1, Math.ceil(gap / 2) + penalty)}`;
    }
    return `${Math.max(1, Math.ceil(gap / 2))}`;
  }
  return "—";
}

function buildShockGuidance(p10, p50, shockSize) {
  if (!Number.isFinite(p10) && !Number.isFinite(p50)) {
    return "—";
  }
  const base = Number.isFinite(p50) ? p50 : p10;
  const buffered = Number.isFinite(base) ? base - shockSize : NaN;
  if (!Number.isFinite(buffered)) {
    return "—";
  }
  return buffered >= 0 ? "Contained" : "Vulnerable";
}

function parsePercentNumber(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text || text === "—") {
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatSignedWhole(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value);
  if (rounded > 0) {
    return `+${rounded}`;
  }
  return `${rounded}`;
}

function formatBridgeWinProb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  return `${(n * 100).toFixed(1)}%`;
}

function formatBridgeMargin(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  return formatSignedWhole(n);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deriveShiftFromMargin(rawMargin) {
  const marginNum = parseSignedNumber(rawMargin);
  if (!Number.isFinite(marginNum)) {
    return "—";
  }
  if (marginNum >= 0) {
    return "0";
  }
  return `${Math.ceil(Math.abs(marginNum))}`;
}

function parseSignedNumber(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text || text === "—") {
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
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

function deriveGapFromNote(noteText) {
  const text = String(noteText || "").trim();
  if (!text) {
    return "—";
  }
  const numeric = text.match(/[+-]?\d[\d,]*/);
  if (numeric && numeric[0]) {
    return numeric[0];
  }
  return "See note";
}
