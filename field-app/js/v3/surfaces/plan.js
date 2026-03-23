import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  readText,
  setText,
} from "../surfaceUtils.js";
import { getOptimizationObjectiveCopy } from "../../../core/turnout.js";
import {
  buildPlanOfficePathTableRowsView,
  buildPlanOfficeBestText,
  PLAN_OPTIMIZER_STATUS_FALLBACK,
  PLAN_OFFICE_PATH_TABLE_EMPTY,
  PLAN_TIMELINE_STATUS_FALLBACK,
  PLAN_WEEK_PREVIEW_FALLBACK,
  buildPlanCostLevers,
  buildPlanDecisionWarning,
  buildPlanOptimizerBanner,
  buildPlanOptimizerAllocationRowsView,
  buildPlanProbabilityLevers,
  buildPlanRecommendationCost,
  buildPlanRecommendationProbability,
  buildPlanRecommendationVolunteers,
  buildPlanTimelineBanner,
  buildPlanVolunteerLevers,
  buildPlanWorkloadBanner,
  classifyPlanStatusTone,
  derivePlanActionsCardStatus,
  derivePlanOptimizerCardStatus,
  derivePlanRiskCardStatus,
  derivePlanSummaryCardStatus,
  derivePlanTimelineCardStatus,
  derivePlanWorkloadCardStatus,
  formatPlanAutoWeeksInputValue,
  formatPlanCurrency,
  formatPlanWhole,
} from "../../../core/planView.js";

const REACH_API_KEY = "__FPE_REACH_API__";
const PLAN_API_KEY = "__FPE_PLAN_API__";
const SCENARIO_API_KEY = "__FPE_SCENARIO_API__";

export function renderPlanSurface(mount) {
  const frame = createSurfaceFrame("center-stack");
  const centerCol = createColumn("plan");

  const workloadCard = createCard({
    title: "Workload translator",
    description: "Convert support goals into conversations, doors, shifts, and volunteer load.",
    status: "Awaiting setup"
  });

  const optimizerCard = createCard({
    title: "Weekly pacing & optimization",
    description: "Budget, objective, and timeline-constrained allocation controls.",
    status: "Awaiting run"
  });

  const timelineCard = createCard({
    title: "Timeline & staffing",
    description: "Timeline feasibility, staffing throughput, and weekly pacing diagnostics.",
    status: "Module off"
  });
  const timelineHeaderToggle = document.createElement("div");
  timelineHeaderToggle.className = "fpe-header-switch";
  timelineHeaderToggle.innerHTML = `
    <span class="fpe-header-switch__label">Timeline module (enable to apply)</span>
    <label class="fpe-switch">
      <input id="v3PlanTimelineEnabledToggle" type="checkbox"/>
      <span>Enable</span>
    </label>
  `;
  setCardHeaderControl(timelineCard, timelineHeaderToggle);

  const riskCard = createCard({
    title: "Execution risk",
    description: "Constraint diagnostics and timeline shortfall posture.",
    status: "Awaiting setup"
  });

  const actionsCard = createCard({
    title: "Recommended actions",
    description: "Decision-intelligence recommendations to recover feasibility.",
    status: "Guidance pending"
  });

  const summaryCard = createCard({
    title: "Plan summary",
    description: "Current staffing burden, timeline feasibility, and constraint posture.",
    status: "Awaiting setup"
  });

  assignCardStatusId(workloadCard, "v3PlanWorkloadCardStatus");
  assignCardStatusId(optimizerCard, "v3PlanOptimizerCardStatus");
  assignCardStatusId(timelineCard, "v3PlanTimelineCardStatus");
  assignCardStatusId(riskCard, "v3PlanRiskCardStatus");
  assignCardStatusId(actionsCard, "v3PlanActionsCardStatus");
  assignCardStatusId(summaryCard, "v3PlanSummaryCardStatus");

  const workloadBody = getCardBody(workloadCard);
  workloadBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3PlanGoalSupportIds">Support IDs needed (goal)</label>
        <input class="fpe-input" id="v3PlanGoalSupportIds" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanDoorsPerHour">Doors per hour (source)</label>
        <input class="fpe-input" disabled id="v3PlanDoorsPerHour" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanHoursPerShift">Hours per shift</label>
        <input class="fpe-input" id="v3PlanHoursPerShift" min="0" step="0.5" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanShiftsPerVolunteer">Shifts per volunteer / week</label>
        <input class="fpe-input" id="v3PlanShiftsPerVolunteer" min="0" step="0.5" type="number"/>
      </div>
    </div>

    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Conversations needed</span><strong id="v3PlanConversationsNeeded">-</strong></div>
      <div class="fpe-summary-row"><span>Doors needed</span><strong id="v3PlanDoorsNeeded">-</strong></div>
      <div class="fpe-summary-row"><span>Doors per shift</span><strong id="v3PlanDoorsPerShift">-</strong></div>
      <div class="fpe-summary-row"><span>Total shifts</span><strong id="v3PlanTotalShifts">-</strong></div>
      <div class="fpe-summary-row"><span>Shifts / week</span><strong id="v3PlanShiftsPerWeek">-</strong></div>
      <div class="fpe-summary-row"><span>Volunteers needed</span><strong id="v3PlanVolunteersNeeded">-</strong></div>
    </div>

    <div class="fpe-help fpe-help--flush">Workload math uses support/contact assumptions from Reach and updates in real time as timeline/staffing settings change.</div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Workload status</div>
      <div class="fpe-help fpe-help--flush" id="v3PlanWorkloadBanner">-</div>
    </div>
  `;

  const optimizerBody = getCardBody(optimizerCard);
  optimizerBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3PlanOptMode">Mode</label>
        <select class="fpe-input" id="v3PlanOptMode"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanOptObjective">Optimize for</label>
        <select class="fpe-input" id="v3PlanOptObjective"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTlOptObjective">Timeline objective</label>
        <select class="fpe-input" id="v3PlanTlOptObjective"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanOptBudget">Budget ($)</label>
        <input class="fpe-input" id="v3PlanOptBudget" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanOptStep">Step size (attempts)</label>
        <input class="fpe-input" id="v3PlanOptStep" min="1" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label">Options</label>
        <div class="fpe-action-row">
          <label class="fpe-switch">
            <input id="v3PlanTlOptEnabled" type="checkbox"/>
            <span>Timeline constrained</span>
          </label>
          <label class="fpe-switch">
            <input id="v3PlanOptUseDecay" type="checkbox"/>
            <span>Diminishing returns</span>
          </label>
        </div>
      </div>
    </div>

    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnOptRun" type="button">Optimize</button>
    </div>

    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Total attempts</span><strong id="v3PlanOptTotalAttempts">-</strong></div>
      <div class="fpe-summary-row"><span>Total cost</span><strong id="v3PlanOptTotalCost">-</strong></div>
      <div class="fpe-summary-row"><span id="v3PlanOptObjectiveMetricLabel">Expected net votes</span><strong id="v3PlanOptTotalVotes">-</strong></div>
      <div class="fpe-summary-row"><span>Gap context</span><strong id="v3PlanOptGapContext">-</strong></div>
      <div class="fpe-summary-row"><span>Binding constraint</span><strong id="v3PlanBinding">-</strong></div>
    </div>

    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Optimizer status</div>
      <div class="fpe-help fpe-help--flush" id="v3PlanOptBanner">-</div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Timeline goal feasible</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanTlOptGoalFeasible">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label" id="v3PlanTlOptMaxLabel">Max achievable net votes</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanTlOptMaxNetVotes">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label" id="v3PlanTlOptRemainingLabel">Remaining gap net votes</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanTlOptRemainingGap">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Timeline binding constraints</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanTlOptBinding">-</div>
      </div>
    </div>

    <div class="table-wrap">
      <table class="table" aria-label="Plan optimizer allocation">
        <thead>
          <tr>
            <th>Tactic</th>
            <th class="num">Attempts</th>
            <th class="num">Cost</th>
            <th class="num" id="v3PlanOptAllocValueHeader">Expected net votes</th>
          </tr>
        </thead>
        <tbody id="v3PlanOptAllocTbody">
          <tr>
            <td class="muted" colspan="4">Run optimization to generate tactic allocation.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3PlanOptInterpretation">
      Interpretation: If diminishing returns is OFF and there are no caps, allocation can concentrate in the strongest marginal tactic.
    </div>
  `;

  const timelineBody = getCardBody(timelineCard);
  timelineBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--3">
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineWeeksAuto">Weeks remaining (auto)</label>
        <input class="fpe-input" disabled id="v3PlanTimelineWeeksAuto" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineActiveWeeks">Active production weeks</label>
        <input class="fpe-input" id="v3PlanTimelineActiveWeeks" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineGotvWeeks">GOTV window (weeks)</label>
        <input class="fpe-input" id="v3PlanTimelineGotvWeeks" min="0" step="1" type="number"/>
      </div>

      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineStaffCount">Paid field staff (#)</label>
        <input class="fpe-input" id="v3PlanTimelineStaffCount" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineStaffHours">Avg staff hours / week</label>
        <input class="fpe-input" id="v3PlanTimelineStaffHours" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineVolCount">Active volunteers / week (#)</label>
        <input class="fpe-input" id="v3PlanTimelineVolCount" min="0" step="1" type="number"/>
      </div>

      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineVolHours">Avg volunteer hours / week</label>
        <input class="fpe-input" id="v3PlanTimelineVolHours" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineRampMode">Ramp shape</label>
        <select class="fpe-input" id="v3PlanTimelineRampMode"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label">Ramp options</label>
        <div class="fpe-action-row">
          <label class="fpe-switch">
            <input id="v3PlanTimelineRampEnabled" type="checkbox"/>
            <span>Enable ramp-up distribution</span>
          </label>
        </div>
      </div>

      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineDoorsPerHour">Doors attempts / hour</label>
        <input class="fpe-input" id="v3PlanTimelineDoorsPerHour" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineCallsPerHour">Calls attempts / hour</label>
        <input class="fpe-input" id="v3PlanTimelineCallsPerHour" min="0" step="1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3PlanTimelineTextsPerHour">Texts attempts / hour</label>
        <input class="fpe-input" id="v3PlanTimelineTextsPerHour" min="0" step="1" type="number"/>
      </div>
    </div>

    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>% plan executable</span><strong id="v3PlanExecutable">-</strong></div>
      <div class="fpe-summary-row"><span>Projected completion week</span><strong id="v3PlanCompletionWeek">-</strong></div>
      <div class="fpe-summary-row"><span>Shortfall attempts</span><strong id="v3PlanShortfallAttempts">-</strong></div>
      <div class="fpe-summary-row"><span>Constraint type</span><strong id="v3PlanConstraint">-</strong></div>
      <div class="fpe-summary-row"><span id="v3PlanShortfallValueLabel">Shortfall net votes</span><strong id="v3PlanShortfallVotes">-</strong></div>
    </div>

    <div class="fpe-contained-block">
      <div class="fpe-help fpe-help--flush">Weekly distribution preview</div>
      <pre class="week-list" id="v3PlanWeekList">-</pre>
    </div>
  `;

  const riskBody = getCardBody(riskCard);
  riskBody.innerHTML = `
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Timeline risk status</div>
      <div class="fpe-help fpe-help--flush" id="v3PlanTimelineBanner">-</div>
    </div>
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>% plan executable</span><strong id="v3PlanRiskExecutable">-</strong></div>
      <div class="fpe-summary-row"><span>Constraint type</span><strong id="v3PlanRiskConstraint">-</strong></div>
      <div class="fpe-summary-row"><span>Shortfall attempts</span><strong id="v3PlanRiskShortfallAttempts">-</strong></div>
      <div class="fpe-summary-row"><span id="v3PlanRiskShortfallValueLabel">Shortfall net votes</span><strong id="v3PlanRiskShortfallVotes">-</strong></div>
    </div>
  `;

  const actionsBody = getCardBody(actionsCard);
  actionsBody.innerHTML = `
    <div class="fpe-alert fpe-alert--warn" hidden id="v3PlanDiWarn"></div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Primary bottleneck</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanDiPrimary">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Secondary bottleneck</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanDiSecondary">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Not binding</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanDiNotBinding">-</div>
      </div>
    </div>

    <div class="fpe-contained-block fpe-contained-block--instruction">
      <div class="fpe-control-label">Recommendations</div>
      <ul class="bullets">
        <li id="v3PlanDiRecVol">-</li>
        <li id="v3PlanDiRecCost">-</li>
        <li id="v3PlanDiRecProb">-</li>
      </ul>
    </div>

    <div class="fpe-field-grid fpe-field-grid--3">
      <div class="table-wrap">
        <table class="table" aria-label="Top levers — Volunteer load">
          <thead>
            <tr><th>Top levers — Volunteer load</th><th class="num">Δ volunteers</th></tr>
          </thead>
          <tbody id="v3PlanDiVolTbody">
            <tr><td class="muted">-</td><td class="num muted">-</td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table class="table" aria-label="Top levers — Cost">
          <thead>
            <tr><th>Top levers — Cost</th><th class="num">Δ cost</th></tr>
          </thead>
          <tbody id="v3PlanDiCostTbody">
            <tr><td class="muted">-</td><td class="num muted">-</td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table class="table" aria-label="Top levers — Win probability">
          <thead>
            <tr><th>Top levers — Win probability</th><th class="num">Δ prob</th></tr>
          </thead>
          <tbody id="v3PlanDiProbTbody">
            <tr><td class="muted">-</td><td class="num muted">-</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Shifts / week</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryShiftsPerWeek">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Volunteers needed</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryVolunteersNeeded">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Plan executable</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryExecutable">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Timeline constraint</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryConstraint">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Optimizer binding</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryBinding">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Gap context</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryGapContext">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift expected</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryUpliftExpected">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift low-bound</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryUpliftLow">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best uplift channel</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryUpliftBestChannel">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift source</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryUpliftSource">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift uncertainty</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryUpliftUncertaintyBand">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Saturation pressure</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanSummaryUpliftSaturationPressure">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / dollar</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanOfficeBestDollar">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / organizer hour</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanOfficeBestOrganizerHour">-</div>
      </div>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3PlanOfficePathStatus">-</div>
    <div class="table-wrap">
      <table class="table" aria-label="Office path rankings">
        <thead>
          <tr>
            <th>Office</th>
            <th class="num">Expected value</th>
            <th class="num">Value / $</th>
            <th class="num">Value / org hour</th>
            <th class="num">Uplift expected</th>
            <th class="num">Uplift source</th>
            <th class="num">Top channel</th>
          </tr>
        </thead>
        <tbody id="v3PlanOfficePathTbody">
          <tr>
            <td class="muted" colspan="7">${PLAN_OFFICE_PATH_TABLE_EMPTY}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  centerCol.append(summaryCard, workloadCard, optimizerCard, timelineCard, riskCard, actionsCard);

  frame.append(centerCol);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Plan translates model assumptions into concrete weekly execution burden.",
      "Optimization should be judged against staffing and timeline constraints, not budget alone.",
      "Timeline feasibility and bottleneck diagnostics should be reviewed before execution commitments."
    ])
  );

  wirePlanControlProxies();
  return refreshPlanSummary;
}

function wirePlanControlProxies() {
  wirePlanReachField("v3PlanGoalSupportIds", "goalSupportIds");
  wirePlanReachField("v3PlanHoursPerShift", "hoursPerShift");
  wirePlanReachField("v3PlanShiftsPerVolunteer", "shiftsPerVolunteerPerWeek");

  bindPlanSelectField("v3PlanOptMode", "optMode");
  bindPlanSelectField("v3PlanOptObjective", "optObjective");
  bindPlanCheckboxField("v3PlanTlOptEnabled", "tlOptEnabled");
  bindPlanSelectField("v3PlanTlOptObjective", "tlOptObjective");
  bindPlanInputField("v3PlanOptBudget", "optBudget");
  bindPlanInputField("v3PlanOptStep", "optStep");
  bindPlanCheckboxField("v3PlanOptUseDecay", "optUseDecay");
  bindPlanAction("v3BtnOptRun", "runOptimize");

  bindPlanCheckboxField("v3PlanTimelineEnabledToggle", "timelineEnabled");
  bindPlanInputField("v3PlanTimelineActiveWeeks", "timelineActiveWeeks");
  bindPlanInputField("v3PlanTimelineGotvWeeks", "timelineGotvWeeks");
  bindPlanInputField("v3PlanTimelineStaffCount", "timelineStaffCount");
  bindPlanInputField("v3PlanTimelineStaffHours", "timelineStaffHours");
  bindPlanInputField("v3PlanTimelineVolCount", "timelineVolCount");
  bindPlanInputField("v3PlanTimelineVolHours", "timelineVolHours");
  bindPlanCheckboxField("v3PlanTimelineRampEnabled", "timelineRampEnabled");
  bindPlanSelectField("v3PlanTimelineRampMode", "timelineRampMode");
  bindPlanInputField("v3PlanTimelineDoorsPerHour", "timelineDoorsPerHour");
  bindPlanInputField("v3PlanTimelineCallsPerHour", "timelineCallsPerHour");
  bindPlanInputField("v3PlanTimelineTextsPerHour", "timelineTextsPerHour");
}

function refreshPlanSummary() {
  const planView = readPlanView();
  const planSummary = planView?.summary && typeof planView.summary === "object" ? planView.summary : {};
  const objectiveSummary = planSummary?.objective && typeof planSummary.objective === "object" ? planSummary.objective : {};
  const objectiveCopy = getOptimizationObjectiveCopy(
    objectiveSummary?.value ?? planView?.inputs?.optObjective,
    "net"
  );
  const objectiveLabel = String(objectiveSummary?.label || objectiveCopy.label).trim() || objectiveCopy.label;
  const objectiveMetricLabel = String(objectiveSummary?.metricLabel || objectiveCopy.metricLabel).trim() || objectiveCopy.metricLabel;
  const objectiveMaxLabel = String(objectiveSummary?.maxLabel || objectiveCopy.maxLabel).trim() || objectiveCopy.maxLabel;
  const objectiveRemainingGapLabel = String(objectiveSummary?.remainingGapLabel || objectiveCopy.remainingGapLabel).trim() || objectiveCopy.remainingGapLabel;
  const objectiveShortfallLabel = String(objectiveSummary?.shortfallLabel || objectiveCopy.shortfallLabel).trim() || objectiveCopy.shortfallLabel;
  const reachView = readReachView();
  const reachWeekly = readReachWeeklySnapshot();
  const workloadSummary = planSummary?.workload && typeof planSummary.workload === "object" ? planSummary.workload : {};
  const optimizerSummary = planSummary?.optimizer && typeof planSummary.optimizer === "object" ? planSummary.optimizer : {};
  const timelineSummary = planSummary?.timeline && typeof planSummary.timeline === "object" ? planSummary.timeline : {};
  const officePathsSummary = optimizerSummary?.officePaths && typeof optimizerSummary.officePaths === "object"
    ? optimizerSummary.officePaths
    : {};

  const outConversationsNeeded = String(workloadSummary?.conversationsNeeded || reachWeekly.requiredConvos || "").trim() || "—";
  const outDoorsNeeded = String(workloadSummary?.doorsNeeded || reachWeekly.requiredDoors || "").trim() || "—";
  const doorsPerShift = String(workloadSummary?.doorsPerShift || "").trim() || "—";
  const totalShifts = String(workloadSummary?.totalShifts || "").trim() || "—";
  const outShiftsPerWeek = String(workloadSummary?.shiftsPerWeek || "").trim() || "—";
  const outVolunteersNeeded = String(workloadSummary?.volunteersNeeded || "").trim() || "—";

  const optGapContext = String(optimizerSummary?.gapContext || "").trim() || PLAN_OPTIMIZER_STATUS_FALLBACK;
  const optBinding = String(optimizerSummary?.binding || "").trim() || "—";
  const tlPercent = String(timelineSummary?.executablePct || "").trim() || "—";
  const tlConstraint = String(timelineSummary?.constraintType || "").trim() || "—";
  const tlShortfallAttempts = String(timelineSummary?.shortfallAttempts || "").trim() || "—";
  const tlShortfallVotes = String(timelineSummary?.shortfallValue || "").trim() || "—";

  setText("v3PlanConversationsNeeded", outConversationsNeeded || "—");
  setText("v3PlanDoorsNeeded", outDoorsNeeded || "—");
  setText("v3PlanDoorsPerShift", doorsPerShift);
  setText("v3PlanTotalShifts", totalShifts);
  setText("v3PlanShiftsPerWeek", outShiftsPerWeek);
  setText("v3PlanVolunteersNeeded", outVolunteersNeeded);

  const optTotals = {
    attempts: String(optimizerSummary?.totalAttempts || "").trim() || "—",
    cost: String(optimizerSummary?.totalCost || "").trim() || "—",
    votes: String(optimizerSummary?.totalValue || "").trim() || "—",
  };
  setText("v3PlanOptTotalAttempts", optTotals.attempts);
  setText("v3PlanOptTotalCost", optTotals.cost);
  setText("v3PlanOptTotalVotes", optTotals.votes);
  setText("v3PlanOptObjectiveMetricLabel", objectiveMetricLabel);
  setText("v3PlanOptAllocValueHeader", objectiveMetricLabel);
  setText("v3PlanOptGapContext", optGapContext);
  setText("v3PlanBinding", optBinding);
  const workloadBanner = String(workloadSummary?.statusText || "").trim() || buildPlanWorkloadBanner(outShiftsPerWeek, outVolunteersNeeded);
  const optimizerBanner = String(optimizerSummary?.statusText || "").trim() || buildPlanOptimizerBanner(optBinding, optGapContext);
  const optimizerInterpretation = String(optimizerSummary?.interpretationText || "").trim()
    || "Interpretation: If diminishing returns is OFF and there are no caps, allocation can concentrate in the strongest marginal tactic.";
  setText("v3PlanWorkloadBanner", workloadBanner);
  setText("v3PlanOptBanner", optimizerBanner);
  setText("v3PlanOptInterpretation", optimizerInterpretation);
  setText("v3PlanTlOptGoalFeasible", String(timelineSummary?.goalFeasible || "").trim() || "—");
  setText("v3PlanTlOptMaxLabel", objectiveMaxLabel);
  setText("v3PlanTlOptMaxNetVotes", String(timelineSummary?.maxAchievableValue || "").trim() || "—");
  setText("v3PlanTlOptRemainingLabel", objectiveRemainingGapLabel);
  setText("v3PlanTlOptRemainingGap", String(timelineSummary?.remainingGapValue || "").trim() || "—");
  setText("v3PlanTlOptBinding", String(timelineSummary?.binding || "").trim() || optBinding || "—");
  const timelineBanner = String(timelineSummary?.statusText || "").trim()
    || buildPlanTimelineBanner(tlPercent, tlConstraint, tlShortfallAttempts, tlShortfallVotes)
    || PLAN_TIMELINE_STATUS_FALLBACK;
  setText("v3PlanTimelineBanner", timelineBanner);
  setText("v3PlanRiskExecutable", tlPercent);
  setText("v3PlanRiskConstraint", tlConstraint);
  setText("v3PlanRiskShortfallAttempts", tlShortfallAttempts);
  setText("v3PlanRiskShortfallValueLabel", objectiveShortfallLabel);
  setText("v3PlanRiskShortfallVotes", tlShortfallVotes);

  setText("v3PlanExecutable", tlPercent);
  setText("v3PlanCompletionWeek", String(timelineSummary?.projectedCompletionWeek || "").trim() || "Pending");
  setText("v3PlanShortfallAttempts", tlShortfallAttempts);
  setText("v3PlanConstraint", tlConstraint);
  setText("v3PlanShortfallValueLabel", objectiveShortfallLabel);
  setText("v3PlanShortfallVotes", tlShortfallVotes);
  setText(
    "v3PlanWeekList",
    String(timelineSummary?.weekPreviewText || "").trim() || PLAN_WEEK_PREVIEW_FALLBACK
  );

  setText("v3PlanSummaryShiftsPerWeek", outShiftsPerWeek);
  setText("v3PlanSummaryVolunteersNeeded", outVolunteersNeeded);
  setText("v3PlanSummaryExecutable", tlPercent);
  setText("v3PlanSummaryConstraint", tlConstraint);
  setText("v3PlanSummaryBinding", optBinding);
  setText("v3PlanSummaryGapContext", optGapContext);
  setText("v3PlanSummaryUpliftExpected", String(optimizerSummary?.upliftExpectedMarginalGain || "—").trim() || "—");
  setText("v3PlanSummaryUpliftLow", String(optimizerSummary?.upliftLowMarginalGain || "—").trim() || "—");
  setText("v3PlanSummaryUpliftBestChannel", String(optimizerSummary?.upliftBestChannel || "—").trim() || "—");
  setText("v3PlanSummaryUpliftSource", String(optimizerSummary?.upliftSource || "—").trim() || "—");
  setText("v3PlanSummaryUpliftUncertaintyBand", String(optimizerSummary?.upliftUncertaintyBand || "unknown").trim() || "unknown");
  setText("v3PlanSummaryUpliftSaturationPressure", String(optimizerSummary?.upliftSaturationPressure || "unknown").trim() || "unknown");
  setText("v3PlanOfficeBestDollar", buildPlanOfficeBestText(officePathsSummary?.bestByDollar));
  setText("v3PlanOfficeBestOrganizerHour", buildPlanOfficeBestText(officePathsSummary?.bestByOrganizerHour));
  setText("v3PlanOfficePathStatus", String(officePathsSummary?.statusText || "").trim() || PLAN_OFFICE_PATH_TABLE_EMPTY);
  renderPlanOfficePathRows(officePathsSummary?.rows);
  syncPlanCardStatus("v3PlanWorkloadCardStatus", derivePlanWorkloadCardStatus(workloadBanner));
  syncPlanCardStatus("v3PlanOptimizerCardStatus", derivePlanOptimizerCardStatus(optTotals, optimizerBanner, optBinding));
  syncPlanCardStatus("v3PlanTimelineCardStatus", derivePlanTimelineCardStatus(readPlanView(), tlPercent, tlConstraint));
  syncPlanCardStatus("v3PlanRiskCardStatus", derivePlanRiskCardStatus(tlPercent, tlConstraint, tlShortfallVotes));
  syncPlanCardStatus("v3PlanSummaryCardStatus", derivePlanSummaryCardStatus(tlPercent, tlConstraint, optBinding));
  syncPlanDecisionIntel({
    tlConstraint,
    optBinding,
    tlShortfallAttempts,
    tlShortfallVotes,
    objectiveLabel,
  });

  syncPlanReachField("v3PlanGoalSupportIds", reachView?.inputs?.goalSupportIds, !!reachView?.controls?.locked);
  syncPlanReachField("v3PlanHoursPerShift", reachView?.inputs?.hoursPerShift, !!reachView?.controls?.locked);
  syncPlanReachField(
    "v3PlanShiftsPerVolunteer",
    reachView?.inputs?.shiftsPerVolunteerPerWeek,
    !!reachView?.controls?.locked
  );

  applyPlanView(planView);
  syncPlanTimelineWeeksAuto("v3PlanTimelineWeeksAuto");
  syncPlanFieldMirror("v3PlanDoorsPerHour", "v3PlanTimelineDoorsPerHour");
  syncPlanAutoFieldDisabled("v3PlanTimelineWeeksAuto");
}

function renderPlanOfficePathRows(rows){
  const tbody = document.getElementById("v3PlanOfficePathTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = buildPlanOfficePathTableRowsView(rows);
  tbody.innerHTML = "";
  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="muted" colspan="7">${PLAN_OFFICE_PATH_TABLE_EMPTY}</td>`;
    tbody.appendChild(tr);
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = String(row?.officeName || "—");
    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = String(row?.objectiveValue || "—");
    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = String(row?.objectivePerDollar || "—");
    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = String(row?.objectivePerOrganizerHour || "—");
    const td4 = document.createElement("td");
    td4.className = "num";
    td4.textContent = String(row?.upliftExpectedMarginalGain || "—");
    const td5 = document.createElement("td");
    td5.className = "num";
    td5.textContent = String(row?.upliftSource || "—");
    const td6 = document.createElement("td");
    td6.className = "num";
    td6.textContent = String(row?.topChannel || "—");
    tr.append(td0, td1, td2, td3, td4, td5, td6);
    tbody.appendChild(tr);
  });
}

function syncPlanDecisionIntel(planContext = null) {
  const context = planContext || {};
  const tlConstraint = String(context.tlConstraint || "").trim();
  const optBinding = String(context.optBinding || "").trim();
  const shortfallAttempts = String(context.tlShortfallAttempts || "").trim();
  const shortfallVotes = String(context.tlShortfallVotes || "").trim();
  const objectiveLabel = String(context.objectiveLabel || "net votes").trim();

  const warnTarget = document.getElementById("v3PlanDiWarn");
  if (warnTarget instanceof HTMLElement) {
    const contextText = buildPlanDecisionWarning(tlConstraint, shortfallVotes, objectiveLabel);
    const text = contextText;
    const show = Boolean(text);
    warnTarget.hidden = !show;
    warnTarget.textContent = show ? text : "";
  }

  setText("v3PlanDiPrimary", tlConstraint || optBinding || "No active bottleneck");
  setText(
    "v3PlanDiSecondary",
    tlConstraint && optBinding && tlConstraint !== optBinding ? optBinding : "No secondary bottleneck signaled"
  );
  setText("v3PlanDiNotBinding", "See optimizer allocation rows for non-binding levers.");
  setText("v3PlanDiRecVol", buildPlanRecommendationVolunteers(tlConstraint, shortfallAttempts));
  setText("v3PlanDiRecCost", buildPlanRecommendationCost(optBinding, objectiveLabel));
  setText("v3PlanDiRecProb", buildPlanRecommendationProbability(tlConstraint, shortfallVotes));
  syncPlanCardStatus("v3PlanActionsCardStatus", derivePlanActionsCardStatus(tlConstraint, optBinding, shortfallVotes));

  renderPlanDecisionRows("v3PlanDiVolTbody", buildPlanVolunteerLevers(tlConstraint, shortfallAttempts));
  renderPlanDecisionRows("v3PlanDiCostTbody", buildPlanCostLevers(optBinding, shortfallAttempts));
  renderPlanDecisionRows("v3PlanDiProbTbody", buildPlanProbabilityLevers(tlConstraint, shortfallVotes));
}

function syncPlanFieldMirror(targetId, sourceId) {
  const target = document.getElementById(targetId);
  const source = document.getElementById(sourceId);
  if (!(target instanceof HTMLInputElement) || !(source instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement !== target) {
    target.value = source.value || "";
  }
  target.disabled = true;
}


function wirePlanReachField(id, field) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (input.dataset.v3ReachBound === "1") {
    return;
  }
  input.dataset.v3ReachBound = "1";
  const onChange = () => {
    const api = getReachApi();
    if (!api || typeof api.setField !== "function") {
      return;
    }
    api.setField(field, input.value);
  };
  input.addEventListener("input", onChange);
  input.addEventListener("change", onChange);
}

function syncPlanReachField(id, value, locked) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement !== input) {
    input.value = value == null ? "" : String(value);
  }
  input.disabled = !!locked;
}

function bindPlanInputField(id, field) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (input.dataset.v3PlanBound === "1") {
    return;
  }
  input.dataset.v3PlanBound = "1";
  const onInput = () => {
    const api = getPlanApi();
    if (!api || typeof api.setField !== "function") {
      return;
    }
    api.setField(field, input.value);
  };
  input.addEventListener("input", onInput);
  input.addEventListener("change", onInput);
}

function bindPlanCheckboxField(id, field) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (input.dataset.v3PlanBound === "1") {
    return;
  }
  input.dataset.v3PlanBound = "1";
  input.addEventListener("change", () => {
    const api = getPlanApi();
    if (!api || typeof api.setField !== "function") {
      return;
    }
    api.setField(field, input.checked);
  });
}

function bindPlanSelectField(id, field) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLSelectElement)) {
    return;
  }
  if (input.dataset.v3PlanBound === "1") {
    return;
  }
  input.dataset.v3PlanBound = "1";
  input.addEventListener("change", () => {
    const api = getPlanApi();
    if (!api || typeof api.setField !== "function") {
      return;
    }
    api.setField(field, input.value);
  });
}

function bindPlanAction(id, actionName) {
  const button = document.getElementById(id);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  if (button.dataset.v3PlanBound === "1") {
    return;
  }
  button.dataset.v3PlanBound = "1";
  button.addEventListener("click", () => {
    const api = getPlanApi();
    if (!api || typeof api[actionName] !== "function") {
      return;
    }
    api[actionName]();
  });
}

function syncPlanInputValue(id, value) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.value = value == null ? "" : String(value);
}

function syncPlanCheckboxValue(id, value) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.checked = !!value;
}

function syncPlanSelectOptions(id, options, selectedValue) {
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
  const isSame =
    current.length === next.length &&
    current.every((item, index) => item === next[index]);
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

function setPlanControlDisabled(id, disabled) {
  const control = document.getElementById(id);
  if (
    !(control instanceof HTMLInputElement) &&
    !(control instanceof HTMLSelectElement) &&
    !(control instanceof HTMLButtonElement) &&
    !(control instanceof HTMLTextAreaElement)
  ) {
    return;
  }
  control.disabled = !!disabled;
}

function applyPlanView(view) {
  if (!view || typeof view !== "object") {
    return;
  }
  const inputs = view.inputs && typeof view.inputs === "object" ? view.inputs : {};
  const options = view.options && typeof view.options === "object" ? view.options : {};
  const controls = view.controls && typeof view.controls === "object" ? view.controls : {};
  renderPlanAllocationRows(view.optimizerRows);

  syncPlanSelectOptions("v3PlanOptMode", options.optMode || [], inputs.optMode);
  syncPlanSelectOptions("v3PlanOptObjective", options.optObjective || [], inputs.optObjective);
  syncPlanSelectOptions("v3PlanTlOptObjective", options.tlOptObjective || [], inputs.tlOptObjective);
  syncPlanSelectOptions("v3PlanTimelineRampMode", options.timelineRampMode || [], inputs.timelineRampMode);

  syncPlanCheckboxValue("v3PlanTlOptEnabled", inputs.tlOptEnabled);
  syncPlanCheckboxValue("v3PlanOptUseDecay", inputs.optUseDecay);
  syncPlanCheckboxValue("v3PlanTimelineEnabledToggle", inputs.timelineEnabled);
  syncPlanCheckboxValue("v3PlanTimelineRampEnabled", inputs.timelineRampEnabled);

  syncPlanInputValue("v3PlanOptBudget", inputs.optBudget);
  syncPlanInputValue("v3PlanOptStep", inputs.optStep);
  syncPlanInputValue("v3PlanTimelineActiveWeeks", inputs.timelineActiveWeeks);
  syncPlanInputValue("v3PlanTimelineGotvWeeks", inputs.timelineGotvWeeks);
  syncPlanInputValue("v3PlanTimelineStaffCount", inputs.timelineStaffCount);
  syncPlanInputValue("v3PlanTimelineStaffHours", inputs.timelineStaffHours);
  syncPlanInputValue("v3PlanTimelineVolCount", inputs.timelineVolCount);
  syncPlanInputValue("v3PlanTimelineVolHours", inputs.timelineVolHours);
  syncPlanInputValue("v3PlanTimelineDoorsPerHour", inputs.timelineDoorsPerHour);
  syncPlanInputValue("v3PlanTimelineCallsPerHour", inputs.timelineCallsPerHour);
  syncPlanInputValue("v3PlanTimelineTextsPerHour", inputs.timelineTextsPerHour);

  const locked = !!controls.locked;
  setPlanControlDisabled("v3PlanOptMode", locked);
  setPlanControlDisabled("v3PlanOptObjective", locked);
  setPlanControlDisabled("v3PlanTlOptEnabled", locked);
  setPlanControlDisabled("v3PlanTlOptObjective", locked);
  setPlanControlDisabled("v3PlanOptBudget", locked);
  setPlanControlDisabled("v3PlanOptStep", locked);
  setPlanControlDisabled("v3PlanOptUseDecay", locked);
  setPlanControlDisabled("v3BtnOptRun", !!controls.runDisabled);
  setPlanControlDisabled("v3PlanTimelineEnabledToggle", locked);
  setPlanControlDisabled("v3PlanTimelineActiveWeeks", locked);
  setPlanControlDisabled("v3PlanTimelineGotvWeeks", locked);
  setPlanControlDisabled("v3PlanTimelineStaffCount", locked);
  setPlanControlDisabled("v3PlanTimelineStaffHours", locked);
  setPlanControlDisabled("v3PlanTimelineVolCount", locked);
  setPlanControlDisabled("v3PlanTimelineVolHours", locked);
  setPlanControlDisabled("v3PlanTimelineRampEnabled", locked);
  setPlanControlDisabled("v3PlanTimelineRampMode", locked);
  setPlanControlDisabled("v3PlanTimelineDoorsPerHour", locked);
  setPlanControlDisabled("v3PlanTimelineCallsPerHour", locked);
  setPlanControlDisabled("v3PlanTimelineTextsPerHour", locked);
}

function renderPlanAllocationRows(rows) {
  const tbody = document.getElementById("v3PlanOptAllocTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = buildPlanOptimizerAllocationRowsView(rows, {
    includeZeroAttempts: true,
    formatWhole: formatPlanWhole,
    formatCurrency: formatPlanCurrency,
  });
  tbody.innerHTML = "";

  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="4">Run optimization to generate tactic allocation.</td>';
    tbody.appendChild(tr);
    return;
  }

  list.forEach((row) => {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = String(row?.tactic || "—");

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = String(row?.attempts || "—");

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = String(row?.cost || "—");

    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = String(row?.expectedObjectiveValue || "—");

    tr.append(td0, td1, td2, td3);
    tbody.appendChild(tr);
  });
}

function syncPlanTimelineWeeksAuto(id) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const weeks = readScenarioWeeksRemaining();
  if (document.activeElement !== input) {
    input.value = formatPlanAutoWeeksInputValue(weeks);
  }
}

function syncPlanAutoFieldDisabled(id) {
  const input = document.getElementById(id);
  if (input instanceof HTMLInputElement) {
    input.disabled = true;
  }
}

function getReachApi() {
  const api = window[REACH_API_KEY];
  if (!api || typeof api !== "object" || typeof api.getView !== "function") {
    return null;
  }
  return api;
}

function getPlanApi() {
  const api = window[PLAN_API_KEY];
  if (!api || typeof api !== "object" || typeof api.getView !== "function") {
    return null;
  }
  return api;
}

function getScenarioApi() {
  const api = window[SCENARIO_API_KEY];
  if (!api || typeof api !== "object" || typeof api.getView !== "function") {
    return null;
  }
  return api;
}

function readScenarioWeeksRemaining() {
  const api = getScenarioApi();
  if (!api) {
    return NaN;
  }
  try {
    const view = api.getView();
    const raw = view?.active?.inputs?.weeksRemaining;
    const num = Number(raw);
    return Number.isFinite(num) ? num : NaN;
  } catch {
    return NaN;
  }
}

function readReachView() {
  const api = getReachApi();
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

function readPlanView() {
  const api = getPlanApi();
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

function readReachWeeklySnapshot() {
  const view = readReachView();
  if (!view || typeof view.weekly !== "object" || !view.weekly) {
    return {};
  }
  return view.weekly;
}

function renderPlanDecisionRows(targetBodyId, rows) {
  const body = document.getElementById(targetBodyId);
  if (!(body instanceof HTMLTableSectionElement)) {
    return;
  }
  const normalized = Array.isArray(rows) ? rows.filter((row) => Array.isArray(row) && row.length >= 2) : [];
  if (!normalized.length) {
    body.innerHTML = '<tr><td class="muted">No levers available.</td><td class="num muted">—</td></tr>';
    return;
  }
  body.innerHTML = normalized
    .map(([label, delta]) => `<tr><td>${escapePlanHtml(label)}</td><td class="num">${escapePlanHtml(delta)}</td></tr>`)
    .join("");
}


function escapePlanHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function syncPlanCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || "Awaiting setup";
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyPlanStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
}
