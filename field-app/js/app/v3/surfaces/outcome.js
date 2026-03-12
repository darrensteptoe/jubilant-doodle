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
  syncLegacyListItems,
  syncLegacyTableRows,
  syncSelectValue
} from "../surfaceUtils.js";

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
  bindFieldProxy("v3OutcomeMcRuns", "mcRuns");

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
}

function refreshOutcomeSummary() {
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
  syncFieldValue("v3OutcomeMcRuns", "mcRuns");

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
  syncControlDisabled("v3OutcomeMcRuns", "mcRuns");
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

  setText("v3OutcomeWeeksRemaining", readText("#p3Weeks"));
  setText("v3OutcomeCapContacts", readText("#p3CapContacts"));
  setText("v3OutcomeGapContacts", readText("#p3GapContacts"));
  setText("v3OutcomeGapNote", readText("#p3GapNote"));

  setText("v3OutcomeMcFreshTag", readText("#mcFreshTag-sidebar"));
  setText("v3OutcomeMcLastRun", readText("#mcLastRun-sidebar"));
  setText("v3OutcomeMcStale", readText("#mcStale-sidebar"));
  setText("v3OutcomeSurfaceStatus", readText("#surfaceStatus"));
  setText("v3OutcomeSurfaceSummary", readText("#surfaceSummary"));
  setText("v3OutcomeImpactTraceNote", readText("#impactTraceNote"));

  setText("v3OutcomeForecastWinProb", readText("#mcWinProb-sidebar"));
  setText("v3OutcomeForecastMedian", readText("#mcMedian"));
  setText("v3OutcomeForecastP95", readText("#mcP95"));
  setText("v3OutcomeForecastP5", readText("#mcP5"));
  const outcomeP10 = readOutcomeSidebarMetric("#mcP10-sidebar", null, /^P10:\s*/i);
  const outcomeP50 = readOutcomeSidebarMetric("#mcP50-sidebar", null, /^Median:\s*/i);
  const outcomeP90 = readOutcomeSidebarMetric("#mcP90-sidebar", null, /^P90:\s*/i);
  const outcomeRiskLabel = readText("#riskBandTag-sidebar");

  setText("v3OutcomeForecastRisk", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagLabel", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagGrade", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagFragility", readText("#riskVolatility-sidebar"));
  setText("v3OutcomeRiskFlagGapNote", readText("#p3GapNote"));
  setText("v3OutcomeRiskFlagFresh", readText("#mcFreshTag-sidebar"));
  setText("v3OutcomeRiskFlagLastRun", readText("#mcLastRun-sidebar"));
  setText("v3OutcomeRiskFlagStale", readText("#mcStale-sidebar"));

  setText("v3OutcomeWinProb", readText("#mcWinProb-sidebar"));
  setText("v3OutcomeP50", outcomeP50);
  setText("v3OutcomeP10", outcomeP10);
  setText("v3OutcomeP90", outcomeP90);
  setText("v3OutcomeRiskGrade", outcomeRiskLabel);
  setText("v3OutcomeFragility", readText("#riskVolatility-sidebar"));

  setJoinedText("v3OutcomeConfMargins", [outcomeP10, outcomeP50, outcomeP90], " / ");
  setJoinedText("v3OutcomeConfAttempts", [readText("#opsAttP10"), readText("#opsAttP50"), readText("#opsAttP90")], " / ");
  setJoinedText("v3OutcomeConfConvos", [readText("#opsConP10"), readText("#opsConP50"), readText("#opsConP90")], " / ");
  setJoinedText("v3OutcomeConfFinish", [readText("#opsFinishP10"), readText("#opsFinishP50"), readText("#opsFinishP90")], " / ");
  setJoinedText("v3OutcomeConfMissRisk", [readText("#opsMissProb"), readText("#opsMissTag")], " ");
  setText("v3OutcomeConfMoS", readText("#mcMoS"));
  setText("v3OutcomeConfDownside", readText("#mcDownside"));
  setText("v3OutcomeConfES10", readText("#mcES10"));
  setText("v3OutcomeConfShiftP50", readText("#mcShiftP50"));
  setText("v3OutcomeConfShiftP10", readText("#mcShiftP10"));
  setText("v3OutcomeConfFragility", readText("#riskVolatility-sidebar"));
  setText("v3OutcomeConfCliff", readText("#riskPlainBanner-sidebar"));
  setText("v3OutcomeConfRiskGrade", outcomeRiskLabel);
  setText("v3OutcomeConfShift60", readText("#mcShift60"));
  setText("v3OutcomeConfShift70", readText("#mcShift70"));
  setText("v3OutcomeConfShift80", readText("#mcShift80"));
  setText("v3OutcomeConfShock10", readText("#mcShock10"));
  setText("v3OutcomeConfShock25", readText("#mcShock25"));
  setText("v3OutcomeConfShock50", readText("#mcShock50"));

  syncLegacyTableRows({
    sourceSelector: "#mcSensitivity",
    targetBodyId: "v3OutcomeSensitivityTbody",
    expectedCols: 2,
    emptyLabel: "Run simulations to rank drivers.",
    numericColumns: [1]
  });
  syncLegacyTableRows({
    sourceSelector: "#surfaceTbody",
    targetBodyId: "v3OutcomeSurfaceTbody",
    expectedCols: 5,
    emptyLabel: "Run surface compute.",
    numericColumns: [1, 2, 3]
  });
  syncLegacyListItems({
    sourceSelector: "#impactTraceList",
    targetId: "v3OutcomeImpactTraceList",
    emptyItem: "No impact trace yet."
  });

  syncButtonDisabled("v3BtnOutcomeRun", "mcRun");
  syncButtonDisabled("v3BtnOutcomeRerun", "mcRerun");
  syncButtonDisabled("v3BtnComputeSurface", "btnComputeSurface");
}

function setJoinedText(targetId, values, separator = " / ") {
  const parts = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter((value) => !!value && value !== "—")
    : [];
  setText(targetId, parts.length ? parts.join(separator) : "—");
}

function readOutcomeSidebarMetric(sidebarSelector, fallbackSelector = null, prefixPattern = null) {
  const sidebarRaw = readText(sidebarSelector);
  const sidebarValue = prefixPattern ? sidebarRaw.replace(prefixPattern, "").trim() : sidebarRaw.trim();
  if (sidebarValue) {
    return sidebarValue;
  }
  if (fallbackSelector) {
    return readText(fallbackSelector) || "—";
  }
  return "—";
}
