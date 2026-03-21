import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody
} from "../../componentFactory.js";
import {
  readText,
  setText,
} from "../../surfaceUtils.js";
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
} from "../../../../core/outcomeView.js";
import { formatPercentFromUnit } from "../../../../core/utils.js";
import {
  syncOutcomeForecastCanonicalSnapshot,
  syncOutcomeForecastRunControls,
  wireOutcomeForecastControls,
} from "./forecast.js";
import { syncOutcomeGovernanceSnapshot } from "./governance.js";
import { renderOutcomeSensitivityRows } from "./sensitivity.js";
import {
  renderOutcomeSurfaceRows,
  syncOutcomeImpactTraceFallback,
} from "./surface.js";
import {
  computeOutcomeBridgeSurface,
  readOutcomeCanonicalBridgeView,
  readOutcomeDerivedBridgeView,
  rerunOutcomeBridgeMc,
  runOutcomeBridgeMc,
  setOutcomeBridgeField,
} from "../../bridges/outcomeBridge.js";

const OUTCOME_V3_TRACE_PREFIX = "[outcome_v3_dom_trace]";
const OUTCOME_V3_TRACE_FLAG_KEY = "__FPE_OUTCOME_V3_TRACE_ENABLED__";
const OUTCOME_V3_TRACE_AUTO_MAX_ATTEMPTS = 12;
const OUTCOME_V3_TRACE_AUTO_RETRY_MS = 60;
const OUTCOME_V3_CONTROL_IDS = Object.freeze([
  "v3OutcomeMcMode",
  "v3OutcomeOrgCount",
]);
let outcomeV3NodeSequence = 0;
let outcomeV3TraceInstalled = false;
let outcomeV3TraceAutoRan = false;
let outcomeV3TraceAutoAttempts = 0;
const outcomeV3NodeTokens = new WeakMap();

export function renderOutcomeSurface(mount) {
  const frame = createCenterStackFrame();
  const centerCol = createCenterStackColumn();

  const controlsCard = createCenterModuleCard({
    title: "Drivers",
    description: "Execution assumptions, uncertainty mode, and Monte Carlo controls that drive outcome behavior.",
    status: "Model inputs"
  });
  controlsCard.id = "v3OutcomeControlsCard";

  const forecastCard = createCenterModuleCard({
    title: "Forecast",
    description: "Win probability and projected margin under current assumptions.",
    status: "Awaiting run"
  });

  const confidenceCard = createCenterModuleCard({
    title: "Confidence envelope",
    description: "P10/P50/P90 spread and distribution shape.",
    status: "Awaiting run"
  });

  const sensitivityCard = createCenterModuleCard({
    title: "Sensitivity & surface",
    description: "Driver ranking and lever surface diagnostics.",
    status: "Awaiting sims"
  });

  const interpretationCard = createCenterModuleCard({
    title: "Interpretation",
    description: "Risk framing and explanatory links between assumptions and outputs.",
    status: "Context"
  });

  const riskFlagsCard = createCenterModuleCard({
    title: "Risk flags",
    description: "Current warning posture and freshness checks before trusting the forecast.",
    status: "Awaiting run"
  });

  const summaryCard = createCenterModuleCard({
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

  centerCol.append(
    controlsCard,
    forecastCard,
    confidenceCard,
    sensitivityCard,
    riskFlagsCard,
    interpretationCard,
    summaryCard,
  );

  frame.append(centerCol);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Outcome summarizes probability, not certainty.",
      "Sensitivity rankings identify which assumptions are worth validating in the field first.",
      "Interpretation should separate signal from model noise before decisions are logged."
    ])
  );

  wireOutcomeControlProxies();
  installOutcomeV3DomLifecycleTrace();
  return refreshOutcomeSummary;
}

function wireOutcomeControlProxies() {
  wireOutcomeForecastControls({
    bindOutcomeInputField,
    bindOutcomeSelectField,
    bindOutcomeAction,
  });
}

function emitOutcomeV3Trace(level, payload) {
  const row = payload && typeof payload === "object" ? payload : {};
  const line = `${OUTCOME_V3_TRACE_PREFIX} ${JSON.stringify(row)}`;
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

function isOutcomeV3TraceEnabled() {
  try {
    const root = typeof window === "object" ? window : {};
    if (root && root[OUTCOME_V3_TRACE_FLAG_KEY] === false) {
      return false;
    }
    if (root && root[OUTCOME_V3_TRACE_FLAG_KEY] === true) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get("outcomeDomTrace") || "").trim().toLowerCase();
    if (token === "1" || token === "true" || token === "yes") {
      return true;
    }
    if (token === "0" || token === "false" || token === "no") {
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

function isOutcomeV3TraceAutoEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get("outcomeDomTraceAuto") || "").trim().toLowerCase();
    return token === "1" || token === "true" || token === "yes";
  } catch {
    return false;
  }
}

function outcomeV3NodeToken(node) {
  if (!(node instanceof HTMLElement)) {
    return "(missing)";
  }
  const cached = outcomeV3NodeTokens.get(node);
  if (typeof cached === "string" && cached) {
    return cached;
  }
  outcomeV3NodeSequence += 1;
  const token = `outcome_node_${outcomeV3NodeSequence}`;
  outcomeV3NodeTokens.set(node, token);
  return token;
}

function readOutcomeV3CanonicalByControlId(controlId) {
  const id = String(controlId || "").trim();
  const canonical = readOutcomeCanonicalBridgeView();
  const inputs = canonical?.inputs && typeof canonical.inputs === "object"
    ? canonical.inputs
    : {};
  if (id === "v3OutcomeMcMode") {
    return String(inputs.mcMode || "").trim();
  }
  if (id === "v3OutcomeOrgCount") {
    const numeric = Number(inputs.orgCount);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function readOutcomeV3TraceSnapshot(controlId) {
  const control = document.getElementById(controlId);
  const domValue = control instanceof HTMLInputElement || control instanceof HTMLSelectElement
    ? String(control.value || "")
    : "";
  return {
    control,
    domValue,
    canonicalValue: readOutcomeV3CanonicalByControlId(controlId),
  };
}

function logOutcomeV3ControlTrace(eventType, controlId, referenceNode = null) {
  if (!isOutcomeV3TraceEnabled()) {
    return;
  }
  const snapshot = readOutcomeV3TraceSnapshot(controlId);
  const currentNode = snapshot.control;
  const replacedSinceReference = referenceNode instanceof HTMLElement
    ? currentNode !== referenceNode
    : false;
  emitOutcomeV3Trace("info", {
    eventType,
    controlId,
    nodeToken: outcomeV3NodeToken(currentNode),
    referenceNodeToken: referenceNode instanceof HTMLElement ? outcomeV3NodeToken(referenceNode) : "",
    replacedSinceReference,
    domValue: snapshot.domValue,
    canonicalValue: snapshot.canonicalValue,
  });
}

function bindOutcomeV3ControlLifecycleTrace(controlId) {
  const control = document.getElementById(controlId);
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
    return;
  }
  if (control.dataset.v3OutcomeTraceBound === "1") {
    return;
  }
  control.dataset.v3OutcomeTraceBound = "1";
  control.addEventListener("focus", () => {
    logOutcomeV3ControlTrace("focus", controlId);
  });
  control.addEventListener("input", () => {
    logOutcomeV3ControlTrace("input", controlId);
  });
  control.addEventListener("change", () => {
    logOutcomeV3ControlTrace("change", controlId);
  });
  control.addEventListener("blur", (event) => {
    const target = event?.target;
    const referenceNode = target instanceof HTMLElement ? target : null;
    logOutcomeV3ControlTrace("blur.before", controlId, referenceNode);
    queueMicrotask(() => {
      logOutcomeV3ControlTrace("blur.after.microtask", controlId, referenceNode);
    });
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        logOutcomeV3ControlTrace("blur.after.raf", controlId, referenceNode);
      });
    }
  });
}

function probeOutcomeV3Control(controlId, kind) {
  const node = document.getElementById(controlId);
  if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) {
    return;
  }
  const beforeDomValue = String(node.value || "");
  let probeValue = beforeDomValue;
  if (kind === "select" && node instanceof HTMLSelectElement) {
    const values = Array.from(node.options)
      .map((option) => String(option?.value || "").trim())
      .filter((value) => value.length > 0);
    probeValue = values.find((value) => value !== beforeDomValue) || beforeDomValue;
  } else if (kind === "number" && node instanceof HTMLInputElement) {
    const baseline = Number(node.value || 0);
    probeValue = String(Number.isFinite(baseline) ? baseline + 2 : 2);
  }
  const referenceNode = node;
  emitOutcomeV3Trace("info", {
    eventType: "trace.auto.c4.set",
    controlId,
    beforeDomValue,
    probeValue,
    canonicalBefore: readOutcomeV3CanonicalByControlId(controlId),
  });
  if (typeof node.focus === "function") {
    node.focus();
  }
  node.value = probeValue;
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
  if (typeof node.blur === "function") {
    node.blur();
  }
  window.setTimeout(() => {
    const currentNode = document.getElementById(controlId);
    const currentControl = currentNode instanceof HTMLInputElement || currentNode instanceof HTMLSelectElement
      ? currentNode
      : null;
    emitOutcomeV3Trace("info", {
      eventType: "trace.auto.c4.post",
      controlId,
      referenceNodeToken: outcomeV3NodeToken(referenceNode),
      nodeToken: outcomeV3NodeToken(currentControl),
      replacedSinceReference: currentControl !== referenceNode,
      domValue: currentControl ? String(currentControl.value || "") : "",
      canonicalValue: readOutcomeV3CanonicalByControlId(controlId),
    });
  }, 140);
}

function runOutcomeV3TraceAutoProbe() {
  if (!isOutcomeV3TraceEnabled() || !isOutcomeV3TraceAutoEnabled()) {
    return;
  }
  if (outcomeV3TraceAutoRan) {
    return;
  }
  const mcMode = document.getElementById("v3OutcomeMcMode");
  const orgCount = document.getElementById("v3OutcomeOrgCount");
  const ready = mcMode instanceof HTMLSelectElement
    && orgCount instanceof HTMLInputElement
    && Array.from(mcMode.options).some((option) => String(option?.value || "").trim());
  if (!ready) {
    if (outcomeV3TraceAutoAttempts >= OUTCOME_V3_TRACE_AUTO_MAX_ATTEMPTS) {
      emitOutcomeV3Trace("warn", {
        eventType: "trace.auto.c4.skipped",
        reason: "controls-not-ready",
        attempts: outcomeV3TraceAutoAttempts,
      });
      outcomeV3TraceAutoRan = true;
      return;
    }
    outcomeV3TraceAutoAttempts += 1;
    window.setTimeout(() => {
      runOutcomeV3TraceAutoProbe();
    }, OUTCOME_V3_TRACE_AUTO_RETRY_MS);
    return;
  }
  outcomeV3TraceAutoRan = true;
  probeOutcomeV3Control("v3OutcomeMcMode", "select");
  probeOutcomeV3Control("v3OutcomeOrgCount", "number");
}

function installOutcomeV3DomLifecycleTrace() {
  if (!isOutcomeV3TraceEnabled()) {
    outcomeV3TraceInstalled = false;
    return;
  }
  OUTCOME_V3_CONTROL_IDS.forEach((controlId) => {
    bindOutcomeV3ControlLifecycleTrace(controlId);
    logOutcomeV3ControlTrace("trace.init", controlId);
  });
  if (outcomeV3TraceInstalled) {
    return;
  }
  outcomeV3TraceInstalled = true;
  runOutcomeV3TraceAutoProbe();
}

function refreshOutcomeSummary() {
  installOutcomeV3DomLifecycleTrace();
  const canonicalView = readOutcomeCanonicalBridgeView();
  const derivedView = readOutcomeDerivedBridgeView();
  const outcomeControlView = canonicalView;
  const outcomeDerivedView = derivedView;
  const hasBridgeInputs = !!(outcomeControlView?.inputs && typeof outcomeControlView.inputs === "object");
  const hasBridgeControls = !!(outcomeControlView?.controls && typeof outcomeControlView.controls === "object");

  syncOutcomeForecastCanonicalSnapshot({
    hasBridgeInputs,
    outcomeControlView,
    applyOutcomeControlView,
  });

  syncOutcomeForecastRunControls({
    hasBridgeInputs,
    outcomeControlView,
    hasBridgeControls,
    setOutcomeControlDisabled,
  });

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
  setText("v3OutcomeForecastMedian", outcomeP50);
  setText("v3OutcomeForecastP95", outcomeP90);
  setText("v3OutcomeForecastP5", outcomeP10);

  setText("v3OutcomeMcFreshTag", mcStatus.freshTag);
  setText("v3OutcomeMcLastRun", mcStatus.lastRun);
  setText("v3OutcomeMcStale", mcStatus.staleTag);
  setText("v3OutcomeForecastRisk", outcomeRiskLabel);
  syncOutcomeGovernanceSnapshot({
    governanceView,
    outcomeRiskLabel,
    outcomeFragilityIndex,
    outcomeGapNote,
    mcStatus,
    setText,
    formatOutcomeGovernanceSignal,
  });

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
  renderOutcomeSensitivityRows(bridgedSensitivityRows, {
    formatOutcomeSensitivityImpact,
  });

  const bridgedSurfaceRows = Array.isArray(outcomeDerivedView?.surfaceRows) ? outcomeDerivedView.surfaceRows : [];
  renderOutcomeSurfaceRows(bridgedSurfaceRows, {
    formatPercentFromUnit,
    formatSignedWhole,
  });
  syncOutcomeCardStatus("v3OutcomeSensitivityCardStatus", deriveOutcomeSensitivityCardStatus(bridgedSensitivityRows, bridgedSurfaceStatus));
  syncOutcomeCardStatus("v3OutcomeInterpretationCardStatus", deriveOutcomeInterpretationCardStatus(bridgedSensitivityRows, bridgedSurfaceRows));
  syncOutcomeImpactTraceFallback({
    targetId: "v3OutcomeImpactTraceList",
    outcomeGapNote,
    outcomeRiskLabel,
    outcomeWinProb
  });
}

function setJoinedText(targetId, values, separator = " / ") {
  const parts = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter((value) => !!value && value !== "—")
    : [];
  setText(targetId, parts.length ? parts.join(separator) : "—");
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
    setOutcomeBridgeField(field, input.value);
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
    setOutcomeBridgeField(field, select.value);
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
    if (actionName === "runMc") {
      runOutcomeBridgeMc();
      return;
    }
    if (actionName === "rerunMc") {
      rerunOutcomeBridgeMc();
      return;
    }
    if (actionName === "computeSurface") {
      computeOutcomeBridgeSurface();
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
    replaceOutcomeSelectOptionsInPlace(select, normalized);
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

function replaceOutcomeSelectOptionsInPlace(select, options) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const rows = Array.isArray(options) ? options : [];
  while (select.options.length > rows.length) {
    select.remove(select.options.length - 1);
  }
  rows.forEach((row, index) => {
    const wantedValue = String(row?.value ?? "");
    const wantedLabel = String(row?.label ?? wantedValue);
    let option = select.options[index];
    if (!(option instanceof HTMLOptionElement)) {
      option = document.createElement("option");
      select.add(option);
    }
    if (option.value !== wantedValue) {
      option.value = wantedValue;
    }
    if ((option.textContent || "") !== wantedLabel) {
      option.textContent = wantedLabel;
    }
  });
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
