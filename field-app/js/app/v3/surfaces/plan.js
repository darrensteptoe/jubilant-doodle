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
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue
} from "../surfaceUtils.js";

export function renderPlanSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const workloadCard = createCard({
    title: "Workload translator",
    description: "Converts support goals into conversations, doors, shifts, and volunteer load."
  });

  const optimizerCard = createCard({
    title: "Optimization",
    description: "Budget/capacity allocation and timeline-constrained optimization outputs."
  });

  const timelineCard = createCard({
    title: "Timeline & execution risk",
    description: "Timeline feasibility, staffing throughput, and risk diagnostics."
  });
  const timelineHeaderToggle = document.createElement("div");
  timelineHeaderToggle.className = "fpe-header-switch";
  timelineHeaderToggle.innerHTML = `
    <span class="fpe-header-switch__label">Timeline module</span>
    <label class="fpe-switch">
      <input id="v3PlanTimelineEnabledToggle" type="checkbox"/>
      <span>Enable</span>
    </label>
  `;
  setCardHeaderControl(timelineCard, timelineHeaderToggle);

  const summaryCard = createCard({
    title: "Plan summary",
    description: "Current staffing burden, timeline feasibility, and constraint posture."
  });

  const workloadBody = getCardBody(workloadCard);
  mountLegacyNode({
    key: "v3-plan-workload-help",
    selector: "#stage-gotv .card .help-text",
    target: workloadBody
  });
  mountLegacyClosest({
    key: "v3-plan-workload-grid",
    childSelector: "#goalSupportIds",
    closestSelector: ".grid3",
    target: workloadBody
  });
  mountLegacyClosest({
    key: "v3-plan-workload-subgrid",
    childSelector: "#outConversationsNeeded",
    closestSelector: ".subgrid",
    target: workloadBody
  });
  mountLegacyNode({
    key: "v3-plan-workload-banner",
    selector: "#convFeasBanner",
    target: workloadBody
  });

  const optimizerBody = getCardBody(optimizerCard);
  const optimizerActions = document.createElement("div");
  optimizerActions.className = "fpe-action-row";
  optimizerActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnOptRun" type="button">Optimize</button>
  `;
  optimizerBody.append(optimizerActions);
  mountLegacyNode({
    key: "v3-plan-opt-help",
    selector: "#stage-roi .phase-p5 > .help-text",
    target: optimizerBody
  });
  mountLegacyClosest({
    key: "v3-plan-opt-grid-a",
    childSelector: "#optMode",
    closestSelector: ".grid3",
    target: optimizerBody
  });
  mountLegacyClosest({
    key: "v3-plan-opt-grid-b",
    childSelector: "#optStep",
    closestSelector: ".grid3",
    target: optimizerBody
  });
  mountLegacyClosest({
    key: "v3-plan-opt-kpis",
    childSelector: "#optTotalAttempts",
    closestSelector: ".kpis",
    target: optimizerBody
  });
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
  mountLegacyClosest({
    key: "v3-plan-tl-grid-a",
    childSelector: "#timelineWeeksAuto",
    closestSelector: ".grid3",
    target: timelineBody
  });
  mountLegacyClosest({
    key: "v3-plan-tl-grid-b",
    childSelector: "#timelineVolHours",
    closestSelector: ".grid3",
    target: timelineBody
  });
  mountLegacyClosest({
    key: "v3-plan-tl-grid-c",
    childSelector: "#timelineDoorsPerHour",
    closestSelector: ".grid3",
    target: timelineBody
  });
  mountLegacyClosest({
    key: "v3-plan-tl-kpis",
    childSelector: "#tlPercent",
    closestSelector: ".kpis",
    target: timelineBody
  });
  mountLegacyClosest({
    key: "v3-plan-tl-grid2",
    childSelector: "#tlShortfallVotes",
    closestSelector: ".grid2",
    target: timelineBody
  });
  mountLegacyNode({
    key: "v3-plan-tl-decision-intel",
    selector: "#decisionIntelCard",
    target: timelineBody
  });
  mountLegacyNode({
    key: "v3-plan-tl-banner",
    selector: "#tlBanner",
    target: timelineBody
  });

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Shifts per week</span><strong id="v3PlanShiftsPerWeek">-</strong></div>
      <div class="fpe-summary-row"><span>Volunteers needed</span><strong id="v3PlanVolunteersNeeded">-</strong></div>
      <div class="fpe-summary-row"><span>Plan executable</span><strong id="v3PlanExecutable">-</strong></div>
      <div class="fpe-summary-row"><span>Timeline constraint</span><strong id="v3PlanConstraint">-</strong></div>
      <div class="fpe-summary-row"><span>Shortfall net votes</span><strong id="v3PlanShortfallVotes">-</strong></div>
      <div class="fpe-summary-row"><span>Optimizer binding</span><strong id="v3PlanBinding">-</strong></div>
    </div>
  `;

  left.append(workloadCard, optimizerCard);
  right.append(timelineCard, summaryCard);

  frame.append(left, right);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Plan translates model assumptions into concrete weekly execution burden.",
      "Optimization should be evaluated against staffing and timeline constraints, not budget alone.",
      "Timeline feasibility and constraint diagnostics should be reviewed before execution commitments."
    ])
  );

  bindClickProxy("v3BtnOptRun", "optRun");
  bindCheckboxProxy("v3PlanTimelineEnabledToggle", "timelineEnabled");
  return refreshPlanSummary;
}

function refreshPlanSummary() {
  setText("v3PlanShiftsPerWeek", readText("#outShiftsPerWeek"));
  setText("v3PlanVolunteersNeeded", readText("#outVolunteersNeeded"));
  setText("v3PlanExecutable", readText("#tlPercent"));
  setText("v3PlanConstraint", readText("#tlConstraint"));
  setText("v3PlanShortfallVotes", readText("#tlShortfallVotes"));
  setText("v3PlanBinding", readText("#optBinding"));
  syncButtonDisabled("v3BtnOptRun", "optRun");
  syncCheckboxValue("v3PlanTimelineEnabledToggle", "timelineEnabled");

  const v3Toggle = document.getElementById("v3PlanTimelineEnabledToggle");
  const legacyToggle = document.getElementById("timelineEnabled");
  if (v3Toggle instanceof HTMLInputElement && legacyToggle instanceof HTMLInputElement) {
    v3Toggle.disabled = legacyToggle.disabled;
  }
}
