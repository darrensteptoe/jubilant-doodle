import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import {
  bindClickProxy,
  bindFieldProxy,
  bindSelectProxy,
  readText,
  setText,
  syncControlDisabled,
  syncButtonDisabled,
  syncFieldValue,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderOutcomeSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const controlsCol = createColumn("controls");
  const analysisCol = createColumn("analysis");
  const interpretationCol = createColumn("interpretation");

  const controlsCard = createCard({
    title: "Simulation controls",
    description: "Execution assumptions, uncertainty mode, and Monte Carlo run controls."
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

  const summaryCard = createCard({
    title: "Outcome summary",
    description: "Current confidence posture and fragility at a glance."
  });

  const controlsBody = getCardBody(controlsCard);
  controlsBody.innerHTML = `
    <div id="v3OutcomeControlsIntro" class="fpe-contained-block"></div>
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
    </div>

    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnOutcomeRun" type="button">Run 10,000 sims</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnOutcomeRerun" type="button">Re-run MC</button>
      <span class="fpe-help fpe-help--flush" id="v3OutcomeMcFreshTag">-</span>
      <span class="fpe-help fpe-help--flush" id="v3OutcomeMcLastRun">-</span>
      <span class="fpe-help fpe-help--flush" id="v3OutcomeMcStale">-</span>
    </div>
  `;

  mountLegacyNode({
    key: "v3-outcome-controls-desc",
    selector: "#phase3Card .module-desc",
    target: document.getElementById("v3OutcomeControlsIntro")
  });
  mountLegacyNode({
    key: "v3-outcome-controls-basic",
    selector: "#mcBasic",
    target: controlsBody
  });
  mountLegacyNode({
    key: "v3-outcome-controls-advanced",
    selector: "#mcAdvanced",
    target: controlsBody
  });

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
  mountLegacyClosest({
    key: "v3-outcome-confidence-envelope-table",
    childSelector: "#mcP10",
    closestSelector: ".table-wrap",
    target: confidenceBody
  });
  confidenceBody.insertAdjacentHTML(
    "beforeend",
    `<div class="fpe-help fpe-help--flush">Margin is net persuasion votes delivered minus net persuasion votes needed. Fragility rises when small negative shocks materially reduce win probability.</div>`
  );

  const sensitivityBody = getCardBody(sensitivityCard);
  mountLegacyClosest({
    key: "v3-outcome-sensitivity-table",
    childSelector: "#mcSensitivity",
    closestSelector: ".table-wrap",
    target: sensitivityBody
  });
  sensitivityBody.insertAdjacentHTML(
    "beforeend",
    `
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
        <span class="fpe-help fpe-help--flush" id="v3OutcomeSurfaceStatus">-</span>
      </div>
    `
  );
  mountLegacyClosest({
    key: "v3-outcome-surface-table",
    childSelector: "#surfaceTbody",
    closestSelector: ".table-wrap",
    target: sensitivityBody
  });
  mountLegacyNode({
    key: "v3-outcome-surface-summary",
    selector: "#surfaceSummary",
    target: sensitivityBody
  });

  const interpretationBody = getCardBody(interpretationCard);
  mountLegacyNode({
    key: "v3-outcome-interpretation-intro",
    selector: "#explainCard .explain-body > p",
    target: interpretationBody
  });
  mountLegacyNode({
    key: "v3-outcome-interpretation-list",
    selector: "#explainCard .explain-body > ul",
    target: interpretationBody
  });
  mountLegacyClosest({
    key: "v3-outcome-impact-trace",
    childSelector: "#impactTraceDetails",
    closestSelector: ".explain",
    target: interpretationBody
  });

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

  controlsCol.append(controlsCard, forecastCard);
  analysisCol.append(confidenceCard, sensitivityCard);
  interpretationCol.append(interpretationCard, summaryCard);

  frame.append(controlsCol, analysisCol, interpretationCol);
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

  setText("v3OutcomeMcFreshTag", readText("#mcFreshTag"));
  setText("v3OutcomeMcLastRun", readText("#mcLastRun"));
  setText("v3OutcomeMcStale", readText("#mcStale"));
  setText("v3OutcomeSurfaceStatus", readText("#surfaceStatus"));

  setText("v3OutcomeForecastWinProb", readText("#mcWinProb-sidebar"));
  setText("v3OutcomeForecastMedian", readText("#mcMedian"));
  setText("v3OutcomeForecastP95", readText("#mcP95"));
  setText("v3OutcomeForecastP5", readText("#mcP5"));
  setText("v3OutcomeForecastRisk", readText("#mcRiskLabel"));

  setText("v3OutcomeWinProb", readText("#mcWinProb-sidebar"));
  setText("v3OutcomeP50", readText("#mcP50"));
  setText("v3OutcomeP10", readText("#mcP10"));
  setText("v3OutcomeP90", readText("#mcP90"));
  setText("v3OutcomeRiskGrade", readText("#mcRiskGrade"));
  setText("v3OutcomeFragility", readText("#mcFragility"));

  syncButtonDisabled("v3BtnOutcomeRun", "mcRun");
  syncButtonDisabled("v3BtnOutcomeRerun", "mcRerun");
  syncButtonDisabled("v3BtnComputeSurface", "btnComputeSurface");
}
