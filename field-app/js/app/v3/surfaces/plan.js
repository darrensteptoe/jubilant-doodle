import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  bindFieldProxy,
  bindSelectProxy,
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncControlDisabled,
  syncFieldValue,
  syncLegacyTableRows,
  syncSelectValue
} from "../surfaceUtils.js";

const REACH_API_KEY = "__FPE_REACH_API__";

export function renderPlanSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const workloadCol = createColumn("workload");
  const timelineCol = createColumn("timeline");
  const riskCol = createColumn("risk");

  const workloadCard = createCard({
    title: "Workload translator",
    description: "Convert support goals into conversations, doors, shifts, and volunteer load."
  });

  const optimizerCard = createCard({
    title: "Weekly pacing & optimization",
    description: "Budget, objective, and timeline-constrained allocation controls."
  });

  const timelineCard = createCard({
    title: "Timeline & staffing",
    description: "Timeline feasibility, staffing throughput, and weekly pacing diagnostics."
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
    description: "Constraint diagnostics and timeline shortfall posture."
  });

  const actionsCard = createCard({
    title: "Recommended actions",
    description: "Decision-intelligence recommendations to recover feasibility."
  });

  const summaryCard = createCard({
    title: "Plan summary",
    description: "Current staffing burden, timeline feasibility, and constraint posture."
  });

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
      <div class="fpe-summary-row"><span>Expected net votes</span><strong id="v3PlanOptTotalVotes">-</strong></div>
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
        <div class="fpe-control-label">Max achievable net votes</div>
        <div class="fpe-help fpe-help--flush" id="v3PlanTlOptMaxNetVotes">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Remaining gap net votes</div>
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
            <th class="num">Expected net votes</th>
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
      <div class="fpe-summary-row"><span>Shortfall net votes</span><strong id="v3PlanShortfallVotes">-</strong></div>
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
      <div class="fpe-summary-row"><span>Shortfall net votes</span><strong id="v3PlanRiskShortfallVotes">-</strong></div>
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
  `;

  workloadCol.append(workloadCard, optimizerCard);
  timelineCol.append(timelineCard);
  riskCol.append(riskCard, actionsCard, summaryCard);

  frame.append(workloadCol, timelineCol, riskCol);
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

  bindSelectProxy("v3PlanOptMode", "optMode");
  bindSelectProxy("v3PlanOptObjective", "optObjective");
  bindCheckboxProxy("v3PlanTlOptEnabled", "tlOptEnabled");
  bindSelectProxy("v3PlanTlOptObjective", "tlOptObjective");
  bindFieldProxy("v3PlanOptBudget", "optBudget");
  bindFieldProxy("v3PlanOptStep", "optStep");
  bindCheckboxProxy("v3PlanOptUseDecay", "optUseDecay");
  bindClickProxy("v3BtnOptRun", "optRun");

  bindCheckboxProxy("v3PlanTimelineEnabledToggle", "timelineEnabled");
  bindFieldProxy("v3PlanTimelineActiveWeeks", "timelineActiveWeeks");
  bindFieldProxy("v3PlanTimelineGotvWeeks", "timelineGotvWeeks");
  bindFieldProxy("v3PlanTimelineStaffCount", "timelineStaffCount");
  bindFieldProxy("v3PlanTimelineStaffHours", "timelineStaffHours");
  bindFieldProxy("v3PlanTimelineVolCount", "timelineVolCount");
  bindFieldProxy("v3PlanTimelineVolHours", "timelineVolHours");
  bindCheckboxProxy("v3PlanTimelineRampEnabled", "timelineRampEnabled");
  bindSelectProxy("v3PlanTimelineRampMode", "timelineRampMode");
  bindFieldProxy("v3PlanTimelineDoorsPerHour", "timelineDoorsPerHour");
  bindFieldProxy("v3PlanTimelineCallsPerHour", "timelineCallsPerHour");
  bindFieldProxy("v3PlanTimelineTextsPerHour", "timelineTextsPerHour");
}

function refreshPlanSummary() {
  const reachView = readReachView();
  const reachWeekly = readReachWeeklySnapshot();
  const outConversationsNeeded = String(reachWeekly.requiredConvos || "").trim();
  const outDoorsNeeded = String(reachWeekly.requiredDoors || "").trim();
  const workload = buildPlanWorkloadOutputs({ outDoorsNeeded });
  const outShiftsPerWeek = workload.shiftsPerWeek;
  const outVolunteersNeeded = workload.volunteersNeeded;
  const derived = buildPlanDerivedStatus({
    outShiftsPerWeek,
    outVolunteersNeeded
  });
  const optGapContext = derived.gapContext;
  const optBinding = derived.binding;
  const tlPercent = derived.executablePct;
  const tlConstraint = derived.constraint;
  const tlShortfallAttempts = derived.shortfallAttempts;
  const tlShortfallVotes = derived.shortfallVotes;

  setText("v3PlanConversationsNeeded", outConversationsNeeded || "—");
  setText("v3PlanDoorsNeeded", outDoorsNeeded || "—");
  setText("v3PlanDoorsPerShift", workload.doorsPerShift);
  setText("v3PlanTotalShifts", workload.totalShifts);
  setText("v3PlanShiftsPerWeek", outShiftsPerWeek);
  setText("v3PlanVolunteersNeeded", outVolunteersNeeded);

  const optTotals = readPlanOptimizerTotals();
  setText("v3PlanOptTotalAttempts", optTotals.attempts);
  setText("v3PlanOptTotalCost", optTotals.cost);
  setText("v3PlanOptTotalVotes", optTotals.votes);
  setText("v3PlanOptGapContext", optGapContext);
  setText("v3PlanBinding", optBinding);
  setText("v3PlanWorkloadBanner", buildPlanWorkloadBanner(outShiftsPerWeek, outVolunteersNeeded));
  setText("v3PlanOptBanner", buildPlanOptimizerBanner(optBinding, optGapContext));
  setText("v3PlanTlOptGoalFeasible", buildPlanTimelineGoalFeasible(tlPercent, tlShortfallVotes));
  setText("v3PlanTlOptMaxNetVotes", buildPlanTimelineMaxNetVotes(optTotals.votes, tlPercent));
  setText("v3PlanTlOptRemainingGap", buildPlanTimelineRemainingGap(tlShortfallVotes));
  setText("v3PlanTlOptBinding", buildPlanTimelineBinding(tlConstraint, optBinding));
  setText("v3PlanTimelineBanner", buildPlanTimelineBanner(tlPercent, tlConstraint, tlShortfallAttempts, tlShortfallVotes));
  setText("v3PlanRiskExecutable", tlPercent);
  setText("v3PlanRiskConstraint", tlConstraint);
  setText("v3PlanRiskShortfallAttempts", tlShortfallAttempts);
  setText("v3PlanRiskShortfallVotes", tlShortfallVotes);
  syncLegacyTableRows({
    sourceSelector: "#optTbody",
    targetBodyId: "v3PlanOptAllocTbody",
    expectedCols: 4,
    emptyLabel: "Run optimization to generate tactic allocation.",
    numericColumns: [1, 2]
  });

  setText("v3PlanExecutable", tlPercent);
  setText("v3PlanCompletionWeek", buildPlanCompletionWeek(tlPercent));
  setText("v3PlanShortfallAttempts", tlShortfallAttempts);
  setText("v3PlanConstraint", tlConstraint);
  setText("v3PlanShortfallVotes", tlShortfallVotes);
  setText("v3PlanWeekList", buildPlanWeekPreview(tlPercent));

  setText("v3PlanSummaryShiftsPerWeek", outShiftsPerWeek);
  setText("v3PlanSummaryVolunteersNeeded", outVolunteersNeeded);
  setText("v3PlanSummaryExecutable", tlPercent);
  setText("v3PlanSummaryConstraint", tlConstraint);
  setText("v3PlanSummaryBinding", optBinding);
  setText("v3PlanSummaryGapContext", optGapContext);
  syncPlanDecisionIntel({
    tlConstraint,
    optBinding,
    tlShortfallAttempts,
    tlShortfallVotes
  });

  syncPlanReachField("v3PlanGoalSupportIds", reachView?.inputs?.goalSupportIds, !!reachView?.controls?.locked);
  syncPlanReachField("v3PlanHoursPerShift", reachView?.inputs?.hoursPerShift, !!reachView?.controls?.locked);
  syncPlanReachField(
    "v3PlanShiftsPerVolunteer",
    reachView?.inputs?.shiftsPerVolunteerPerWeek,
    !!reachView?.controls?.locked
  );

  syncSelectValue("v3PlanOptMode", "optMode");
  syncSelectValue("v3PlanOptObjective", "optObjective");
  syncCheckboxValue("v3PlanTlOptEnabled", "tlOptEnabled");
  syncSelectValue("v3PlanTlOptObjective", "tlOptObjective");
  syncFieldValue("v3PlanOptBudget", "optBudget");
  syncFieldValue("v3PlanOptStep", "optStep");
  syncCheckboxValue("v3PlanOptUseDecay", "optUseDecay");

  syncCheckboxValue("v3PlanTimelineEnabledToggle", "timelineEnabled");
  syncFieldValue("v3PlanTimelineWeeksAuto", "timelineWeeksAuto");
  syncFieldValue("v3PlanTimelineActiveWeeks", "timelineActiveWeeks");
  syncFieldValue("v3PlanTimelineGotvWeeks", "timelineGotvWeeks");
  syncFieldValue("v3PlanTimelineStaffCount", "timelineStaffCount");
  syncFieldValue("v3PlanTimelineStaffHours", "timelineStaffHours");
  syncFieldValue("v3PlanTimelineVolCount", "timelineVolCount");
  syncFieldValue("v3PlanTimelineVolHours", "timelineVolHours");
  syncCheckboxValue("v3PlanTimelineRampEnabled", "timelineRampEnabled");
  syncSelectValue("v3PlanTimelineRampMode", "timelineRampMode");
  syncFieldValue("v3PlanTimelineDoorsPerHour", "timelineDoorsPerHour");
  syncFieldValue("v3PlanTimelineCallsPerHour", "timelineCallsPerHour");
  syncFieldValue("v3PlanTimelineTextsPerHour", "timelineTextsPerHour");
  syncPlanFieldMirror("v3PlanDoorsPerHour", "v3PlanTimelineDoorsPerHour");

  syncButtonDisabled("v3BtnOptRun", "optRun");

  syncControlDisabled("v3PlanOptMode", "optMode");
  syncControlDisabled("v3PlanOptObjective", "optObjective");
  syncControlDisabled("v3PlanTlOptEnabled", "tlOptEnabled");
  syncControlDisabled("v3PlanTlOptObjective", "tlOptObjective");
  syncControlDisabled("v3PlanOptBudget", "optBudget");
  syncControlDisabled("v3PlanOptStep", "optStep");
  syncControlDisabled("v3PlanOptUseDecay", "optUseDecay");

  syncControlDisabled("v3PlanTimelineEnabledToggle", "timelineEnabled");
  syncControlDisabled("v3PlanTimelineWeeksAuto", "timelineWeeksAuto");
  syncControlDisabled("v3PlanTimelineActiveWeeks", "timelineActiveWeeks");
  syncControlDisabled("v3PlanTimelineGotvWeeks", "timelineGotvWeeks");
  syncControlDisabled("v3PlanTimelineStaffCount", "timelineStaffCount");
  syncControlDisabled("v3PlanTimelineStaffHours", "timelineStaffHours");
  syncControlDisabled("v3PlanTimelineVolCount", "timelineVolCount");
  syncControlDisabled("v3PlanTimelineVolHours", "timelineVolHours");
  syncControlDisabled("v3PlanTimelineRampEnabled", "timelineRampEnabled");
  syncControlDisabled("v3PlanTimelineRampMode", "timelineRampMode");
  syncControlDisabled("v3PlanTimelineDoorsPerHour", "timelineDoorsPerHour");
  syncControlDisabled("v3PlanTimelineCallsPerHour", "timelineCallsPerHour");
  syncControlDisabled("v3PlanTimelineTextsPerHour", "timelineTextsPerHour");
}

function syncPlanDecisionIntel(planContext = null) {
  const context = planContext || {};
  const tlConstraint = String(context.tlConstraint || "").trim();
  const optBinding = String(context.optBinding || "").trim();
  const shortfallAttempts = String(context.tlShortfallAttempts || "").trim();
  const shortfallVotes = String(context.tlShortfallVotes || "").trim();

  const warnTarget = document.getElementById("v3PlanDiWarn");
  if (warnTarget instanceof HTMLElement) {
    const contextText = buildPlanDecisionWarning(tlConstraint, shortfallVotes);
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
  setText("v3PlanDiRecCost", buildPlanRecommendationCost(optBinding));
  setText("v3PlanDiRecProb", buildPlanRecommendationProbability(tlConstraint, shortfallVotes));

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

function buildPlanWorkloadBanner(shiftsPerWeek, volunteersNeeded) {
  if (!shiftsPerWeek && !volunteersNeeded) {
    return "Set support goal and pacing assumptions to generate workload requirements.";
  }
  return `Workload target: ${shiftsPerWeek || "—"} shifts/week and ${volunteersNeeded || "—"} volunteers needed.`;
}

function buildPlanOptimizerBanner(optBinding, optGapContext) {
  const binding = String(optBinding || "").trim();
  const gap = String(optGapContext || "").trim();
  if (!binding && !gap) {
    return "Run optimization to generate allocation and binding-constraint posture.";
  }
  if (binding && gap) {
    return `${binding} is currently binding. ${gap}`;
  }
  return binding || gap;
}

function buildPlanTimelineBanner(executablePct, constraint, shortfallAttempts, shortfallVotes) {
  const pct = String(executablePct || "").trim();
  const binding = String(constraint || "").trim();
  const attempts = String(shortfallAttempts || "").trim();
  const votes = String(shortfallVotes || "").trim();

  if (!pct && !binding && !attempts && !votes) {
    return "Timeline diagnostics update as staffing and pace assumptions change.";
  }
  return `Executable: ${pct || "—"}; Constraint: ${binding || "—"}; Shortfall attempts: ${attempts || "—"}; Shortfall votes: ${votes || "—"}.`;
}

function buildPlanDecisionWarning(constraint, shortfallVotes) {
  const c = String(constraint || "").toLowerCase();
  const votesText = String(shortfallVotes || "").trim();
  const votesNum = Number(votesText.replace(/[^\d.-]/g, ""));
  if (c && (c.includes("timeline") || c.includes("capacity") || c.includes("staff"))) {
    return "Execution risk is elevated under current timeline/staffing assumptions.";
  }
  if (Number.isFinite(votesNum) && votesNum > 0) {
    return `Remaining timeline shortfall detected: ${votesText} net votes.`;
  }
  return "";
}

function buildPlanRecommendationVolunteers(constraint, shortfallAttempts) {
  const c = String(constraint || "").toLowerCase();
  if (c.includes("staff") || c.includes("capacity")) {
    return "Increase organizer or volunteer weekly hours to close the capacity bottleneck.";
  }
  if (String(shortfallAttempts || "").trim()) {
    return "Reduce attempts shortfall by increasing weekly shift coverage or narrowing target scope.";
  }
  return "Volunteer load is currently within modeled bounds.";
}

function buildPlanRecommendationCost(optBinding) {
  const binding = String(optBinding || "").toLowerCase();
  if (binding.includes("budget") || binding.includes("cost")) {
    return "Reallocate toward lower-cost channels before adding new spend.";
  }
  return "Keep budget allocation aligned to channels with highest marginal net votes.";
}

function buildPlanRecommendationProbability(constraint, shortfallVotes) {
  const c = String(constraint || "").toLowerCase();
  const votesNum = Number(String(shortfallVotes || "").replace(/[^\d.-]/g, ""));
  if (c.includes("timeline") || c.includes("week")) {
    return "Improve probability posture by de-risking timeline: pull effort earlier in the schedule.";
  }
  if (Number.isFinite(votesNum) && votesNum > 0) {
    return "Close remaining vote shortfall to improve modeled win confidence.";
  }
  return "Probability posture is stable under current assumptions.";
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

function getReachApi() {
  const api = window[REACH_API_KEY];
  if (!api || typeof api !== "object" || typeof api.getView !== "function") {
    return null;
  }
  return api;
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

function readReachWeeklySnapshot() {
  const view = readReachView();
  if (!view || typeof view.weekly !== "object" || !view.weekly) {
    return {};
  }
  return view.weekly;
}

function buildPlanDerivedStatus({ outShiftsPerWeek, outVolunteersNeeded }) {
  const requiredShifts = parsePlanNumber(outShiftsPerWeek);
  const volunteersNeeded = parsePlanNumber(outVolunteersNeeded);
  const doorsPerShift = parsePlanNumber(readSummaryText("v3PlanDoorsPerShift"));
  const hoursPerShift = parsePlanNumber(readInputValue("v3PlanHoursPerShift"));
  const shiftsPerVolunteer = parsePlanNumber(readInputValue("v3PlanShiftsPerVolunteer"));
  const timelineEnabled = readCheckboxState("v3PlanTimelineEnabledToggle");
  const staffCount = parsePlanNumber(readInputValue("v3PlanTimelineStaffCount"));
  const staffHours = parsePlanNumber(readInputValue("v3PlanTimelineStaffHours"));
  const volunteerCount = parsePlanNumber(readInputValue("v3PlanTimelineVolCount"));

  const staffShiftCapacity = Number.isFinite(staffCount) && Number.isFinite(staffHours) && Number.isFinite(hoursPerShift) && hoursPerShift > 0
    ? (staffCount * staffHours) / hoursPerShift
    : NaN;
  const volunteerShiftCapacity = Number.isFinite(volunteerCount) && Number.isFinite(shiftsPerVolunteer) && shiftsPerVolunteer > 0
    ? volunteerCount * shiftsPerVolunteer
    : NaN;
  const capacityShifts = sumFinite(staffShiftCapacity, volunteerShiftCapacity);

  const executablePctNum = Number.isFinite(requiredShifts) && requiredShifts > 0 && Number.isFinite(capacityShifts)
    ? (capacityShifts / requiredShifts) * 100
    : NaN;
  const executablePct = Number.isFinite(executablePctNum)
    ? `${Math.max(0, Math.min(100, Math.round(executablePctNum)))}%`
    : "Pending";

  const shortfallShifts = Number.isFinite(requiredShifts) && Number.isFinite(capacityShifts)
    ? Math.max(0, requiredShifts - capacityShifts)
    : NaN;
  const shortfallAttemptsNum = Number.isFinite(shortfallShifts) && Number.isFinite(doorsPerShift)
    ? Math.max(0, shortfallShifts * doorsPerShift)
    : NaN;
  const shortfallAttempts = Number.isFinite(shortfallAttemptsNum)
    ? formatPlanWhole(shortfallAttemptsNum)
    : "—";

  const shortfallVotesNum = Number.isFinite(shortfallShifts) && Number.isFinite(volunteersNeeded) && Number.isFinite(requiredShifts) && requiredShifts > 0
    ? Math.max(0, (shortfallShifts / requiredShifts) * volunteersNeeded)
    : NaN;
  const shortfallVotes = Number.isFinite(shortfallVotesNum)
    ? formatPlanWhole(shortfallVotesNum)
    : "—";

  let constraint = "Pending timeline inputs";
  if (!timelineEnabled) {
    constraint = "Timeline module disabled";
  } else if (Number.isFinite(shortfallShifts)) {
    if (shortfallShifts > 0) {
      constraint = "Staffing capacity";
    } else {
      constraint = "No timeline constraint";
    }
  }

  const binding = constraint.includes("capacity")
    ? "Staffing capacity"
    : constraint.includes("disabled")
      ? "Timeline disabled"
      : "No binding optimizer constraint";

  const gapContext = Number.isFinite(shortfallAttemptsNum) && shortfallAttemptsNum > 0
    ? `${formatPlanWhole(shortfallAttemptsNum)} attempts shortfall vs schedule`
    : "No attempt shortfall at current pace";

  return {
    executablePct,
    constraint,
    shortfallAttempts,
    shortfallVotes,
    binding,
    gapContext
  };
}

function buildPlanWorkloadOutputs({ outDoorsNeeded }) {
  const doorsNeededNum = parsePlanNumber(outDoorsNeeded);
  const doorsPerHour = parsePlanNumber(readInputValue("v3PlanDoorsPerHour"));
  const hoursPerShift = parsePlanNumber(readInputValue("v3PlanHoursPerShift"));
  const shiftsPerVolunteer = parsePlanNumber(readInputValue("v3PlanShiftsPerVolunteer"));
  const timelineWeeksAuto = parsePlanNumber(readInputValue("v3PlanTimelineWeeksAuto"));
  const activeWeeks = parsePlanNumber(readInputValue("v3PlanTimelineActiveWeeks"));
  const weeks = Number.isFinite(activeWeeks) && activeWeeks > 0
    ? activeWeeks
    : Number.isFinite(timelineWeeksAuto) && timelineWeeksAuto > 0
      ? timelineWeeksAuto
      : NaN;

  const doorsPerShiftNum = Number.isFinite(doorsPerHour) && Number.isFinite(hoursPerShift)
    ? doorsPerHour * hoursPerShift
    : NaN;
  const totalShiftsNum = Number.isFinite(doorsNeededNum) && Number.isFinite(doorsPerShiftNum) && doorsPerShiftNum > 0
    ? doorsNeededNum / doorsPerShiftNum
    : NaN;
  const shiftsPerWeekNum = Number.isFinite(totalShiftsNum) && Number.isFinite(weeks) && weeks > 0
    ? totalShiftsNum / weeks
    : NaN;
  const volunteersNeededNum = Number.isFinite(shiftsPerWeekNum) && Number.isFinite(shiftsPerVolunteer) && shiftsPerVolunteer > 0
    ? shiftsPerWeekNum / shiftsPerVolunteer
    : NaN;

  return {
    doorsPerShift: Number.isFinite(doorsPerShiftNum) ? formatPlanWhole(doorsPerShiftNum) : "—",
    totalShifts: Number.isFinite(totalShiftsNum) ? formatPlanWhole(totalShiftsNum) : "—",
    shiftsPerWeek: Number.isFinite(shiftsPerWeekNum) ? formatPlanWhole(shiftsPerWeekNum) : "—",
    volunteersNeeded: Number.isFinite(volunteersNeededNum) ? formatPlanWhole(volunteersNeededNum) : "—"
  };
}

function readPlanOptimizerTotals() {
  const tableBody = document.getElementById("v3PlanOptAllocTbody");
  if (!(tableBody instanceof HTMLTableSectionElement)) {
    return { attempts: "—", cost: "—", votes: "—" };
  }

  let attempts = 0;
  let cost = 0;
  let votes = 0;
  let countedRows = 0;
  tableBody.querySelectorAll("tr").forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 4) {
      return;
    }
    const a = parsePlanNumber(cells[1]?.textContent);
    const c = parsePlanNumber(cells[2]?.textContent);
    const v = parsePlanNumber(cells[3]?.textContent);
    const hasAny = Number.isFinite(a) || Number.isFinite(c) || Number.isFinite(v);
    if (!hasAny) {
      return;
    }
    countedRows += 1;
    attempts += Number.isFinite(a) ? a : 0;
    cost += Number.isFinite(c) ? c : 0;
    votes += Number.isFinite(v) ? v : 0;
  });

  if (!countedRows) {
    return { attempts: "—", cost: "—", votes: "—" };
  }
  return {
    attempts: formatPlanWhole(attempts),
    cost: formatPlanCurrency(cost),
    votes: formatPlanWhole(votes)
  };
}

function buildPlanTimelineGoalFeasible(tlPercent, tlShortfallVotes) {
  const pct = parsePlanPercent(tlPercent);
  if (Number.isFinite(pct)) {
    return pct >= 100 ? "Yes" : "No";
  }
  const shortfallVotes = parsePlanNumber(tlShortfallVotes);
  if (Number.isFinite(shortfallVotes)) {
    return shortfallVotes <= 0 ? "Yes" : "No";
  }
  return "Pending";
}

function buildPlanTimelineMaxNetVotes(optTotalVotes, tlPercent) {
  const votes = parsePlanNumber(optTotalVotes);
  const pct = parsePlanPercent(tlPercent);
  if (Number.isFinite(votes) && Number.isFinite(pct) && pct > 0 && pct < 100) {
    return formatPlanWhole(votes * (100 / pct));
  }
  if (Number.isFinite(votes)) {
    return formatPlanWhole(votes);
  }
  return "—";
}

function buildPlanTimelineRemainingGap(tlShortfallVotes) {
  const gap = parsePlanNumber(tlShortfallVotes);
  if (!Number.isFinite(gap)) {
    return "—";
  }
  if (gap <= 0) {
    return "0";
  }
  return formatPlanWhole(gap);
}

function buildPlanTimelineBinding(tlConstraint, optBinding) {
  const tl = String(tlConstraint || "").trim();
  const opt = String(optBinding || "").trim();
  if (tl && opt && tl !== opt) {
    return `${tl}; optimizer: ${opt}`;
  }
  return tl || opt || "Not binding";
}

function buildPlanCompletionWeek(tlPercent) {
  const pct = parsePlanPercent(tlPercent);
  const autoWeeks = parsePlanNumber(readInputValue("v3PlanTimelineWeeksAuto"));
  const activeWeeks = parsePlanNumber(readInputValue("v3PlanTimelineActiveWeeks"));
  const baseline = Number.isFinite(activeWeeks) && activeWeeks > 0
    ? activeWeeks
    : Number.isFinite(autoWeeks) && autoWeeks > 0
      ? autoWeeks
      : NaN;

  if (!Number.isFinite(pct) || !Number.isFinite(baseline)) {
    return "Pending";
  }
  if (pct >= 100) {
    return `Week ${Math.max(1, Math.round(baseline))}`;
  }
  const projected = Math.ceil((baseline * 100) / Math.max(1, pct));
  return `Week ${Math.max(1, projected)}`;
}

function buildPlanWeekPreview(tlPercent) {
  const pct = parsePlanPercent(tlPercent);
  const activeWeeks = parsePlanNumber(readInputValue("v3PlanTimelineActiveWeeks"));
  const gotvWeeks = parsePlanNumber(readInputValue("v3PlanTimelineGotvWeeks"));

  if (!Number.isFinite(activeWeeks) || activeWeeks <= 0) {
    return "Set Active production weeks to render pacing preview.";
  }

  const total = Math.max(1, Math.round(activeWeeks));
  const gotv = Number.isFinite(gotvWeeks) && gotvWeeks > 0 ? Math.min(total, Math.round(gotvWeeks)) : 0;
  const regular = Math.max(0, total - gotv);
  const completionTag = Number.isFinite(pct) ? `${Math.round(pct)}% executable` : "executable % pending";

  const lines = [
    `Regular weeks: ${regular}`,
    `GOTV weeks: ${gotv}`,
    `Status: ${completionTag}`
  ];
  return lines.join("\n");
}

function readInputValue(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) {
    return "";
  }
  return String(el.value || "").trim();
}

function readCheckboxState(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) {
    return false;
  }
  return !!el.checked;
}

function readSummaryText(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) {
    return "";
  }
  return String(el.textContent || "").trim();
}

function sumFinite(...values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) {
    return NaN;
  }
  return nums.reduce((acc, value) => acc + value, 0);
}

function parsePlanNumber(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text || text === "-" || text === "—") {
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function parsePlanPercent(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text || text === "-" || text === "—") {
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function formatPlanWhole(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value).toLocaleString()}`;
}

function formatPlanCurrency(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `$${Math.round(value).toLocaleString()}`;
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

function buildPlanVolunteerLevers(constraint, shortfallAttempts) {
  const c = String(constraint || "").toLowerCase();
  const attempts = parsePlanNumber(shortfallAttempts);
  if (Number.isFinite(attempts) && attempts > 0) {
    return [
      ["Add organizer shift coverage", `+${formatPlanWhole(Math.ceil(attempts / 250))}`],
      ["Increase volunteer hours / week", `+${formatPlanWhole(Math.ceil(attempts / 400))}`]
    ];
  }
  if (c.includes("staff") || c.includes("capacity")) {
    return [["Increase active volunteer pool", "Priority"]];
  }
  return [["Volunteer load within range", "—"]];
}

function buildPlanCostLevers(optBinding, shortfallAttempts) {
  const binding = String(optBinding || "").toLowerCase();
  const attempts = parsePlanNumber(shortfallAttempts);
  if (binding.includes("budget") || binding.includes("cost")) {
    return [
      ["Shift effort to lower-cost channels", "High"],
      ["Reduce low-yield tactic share", "Medium"]
    ];
  }
  if (Number.isFinite(attempts) && attempts > 0) {
    return [["Phase spend earlier in cycle", "Medium"]];
  }
  return [["Cost posture stable", "—"]];
}

function buildPlanProbabilityLevers(constraint, shortfallVotes) {
  const c = String(constraint || "").toLowerCase();
  const votes = parsePlanNumber(shortfallVotes);
  if (Number.isFinite(votes) && votes > 0) {
    return [
      ["Close remaining net-vote gap", `${formatPlanWhole(votes)}`],
      ["Advance execution to earlier weeks", "Medium"]
    ];
  }
  if (c.includes("timeline") || c.includes("week")) {
    return [["De-risk timeline concentration", "High"]];
  }
  return [["Probability posture stable", "—"]];
}

function escapePlanHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
