import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
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
  syncSelectValue
} from "../surfaceUtils.js";

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
    title: "Optimization",
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
    description: "Constraint diagnostics and decision-intelligence recommendations."
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
  `;
  mountLegacyNode({
    key: "v3-plan-workload-banner",
    selector: "#convFeasBanner",
    target: workloadBody
  });

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
  `;

  mountLegacyNode({
    key: "v3-plan-opt-banner",
    selector: "#optBanner",
    target: optimizerBody
  });
  mountLegacyNode({
    key: "v3-plan-opt-tl-results",
    selector: "#tlOptResults",
    target: optimizerBody
  });
  mountLegacyClosest({
    key: "v3-plan-opt-table",
    childSelector: "#optTbody",
    closestSelector: ".table-wrap",
    target: optimizerBody
  });
  mountLegacyNode({
    key: "v3-plan-opt-note",
    selector: "#stage-roi .phase-p5 > .note",
    target: optimizerBody
  });

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
  mountLegacyNode({
    key: "v3-plan-tl-decision-intel",
    selector: "#decisionIntelCard",
    target: riskBody
  });
  mountLegacyNode({
    key: "v3-plan-tl-banner",
    selector: "#tlBanner",
    target: riskBody
  });

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Shifts / week</span><strong id="v3PlanSummaryShiftsPerWeek">-</strong></div>
      <div class="fpe-summary-row"><span>Volunteers needed</span><strong id="v3PlanSummaryVolunteersNeeded">-</strong></div>
      <div class="fpe-summary-row"><span>Plan executable</span><strong id="v3PlanSummaryExecutable">-</strong></div>
      <div class="fpe-summary-row"><span>Timeline constraint</span><strong id="v3PlanSummaryConstraint">-</strong></div>
      <div class="fpe-summary-row"><span>Optimizer binding</span><strong id="v3PlanSummaryBinding">-</strong></div>
      <div class="fpe-summary-row"><span>Gap context</span><strong id="v3PlanSummaryGapContext">-</strong></div>
    </div>
  `;

  workloadCol.append(workloadCard, optimizerCard);
  timelineCol.append(timelineCard);
  riskCol.append(riskCard, summaryCard);

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
  bindFieldProxy("v3PlanGoalSupportIds", "goalSupportIds");
  bindFieldProxy("v3PlanHoursPerShift", "hoursPerShift");
  bindFieldProxy("v3PlanShiftsPerVolunteer", "shiftsPerVolunteerPerWeek");

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
  setText("v3PlanConversationsNeeded", readText("#outConversationsNeeded"));
  setText("v3PlanDoorsNeeded", readText("#outDoorsNeeded"));
  setText("v3PlanDoorsPerShift", readText("#outDoorsPerShift"));
  setText("v3PlanTotalShifts", readText("#outTotalShifts"));
  setText("v3PlanShiftsPerWeek", readText("#outShiftsPerWeek"));
  setText("v3PlanVolunteersNeeded", readText("#outVolunteersNeeded"));

  setText("v3PlanOptTotalAttempts", readText("#optTotalAttempts"));
  setText("v3PlanOptTotalCost", readText("#optTotalCost"));
  setText("v3PlanOptTotalVotes", readText("#optTotalVotes"));
  setText("v3PlanOptGapContext", readText("#optGapContext"));
  setText("v3PlanBinding", readText("#optBinding"));

  setText("v3PlanExecutable", readText("#tlPercent"));
  setText("v3PlanCompletionWeek", readText("#tlCompletionWeek"));
  setText("v3PlanShortfallAttempts", readText("#tlShortfallAttempts"));
  setText("v3PlanConstraint", readText("#tlConstraint"));
  setText("v3PlanShortfallVotes", readText("#tlShortfallVotes"));
  setText("v3PlanWeekList", readText("#tlWeekList"));

  setText("v3PlanSummaryShiftsPerWeek", readText("#outShiftsPerWeek"));
  setText("v3PlanSummaryVolunteersNeeded", readText("#outVolunteersNeeded"));
  setText("v3PlanSummaryExecutable", readText("#tlPercent"));
  setText("v3PlanSummaryConstraint", readText("#tlConstraint"));
  setText("v3PlanSummaryBinding", readText("#optBinding"));
  setText("v3PlanSummaryGapContext", readText("#optGapContext"));

  syncFieldValue("v3PlanGoalSupportIds", "goalSupportIds");
  syncFieldValue("v3PlanDoorsPerHour", "doorsPerHour");
  syncFieldValue("v3PlanHoursPerShift", "hoursPerShift");
  syncFieldValue("v3PlanShiftsPerVolunteer", "shiftsPerVolunteerPerWeek");

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

  syncButtonDisabled("v3BtnOptRun", "optRun");

  syncControlDisabled("v3PlanGoalSupportIds", "goalSupportIds");
  syncControlDisabled("v3PlanDoorsPerHour", "doorsPerHour");
  syncControlDisabled("v3PlanHoursPerShift", "hoursPerShift");
  syncControlDisabled("v3PlanShiftsPerVolunteer", "shiftsPerVolunteerPerWeek");

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
