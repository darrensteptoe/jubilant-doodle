import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import { createFieldGrid, readText, setText } from "../surfaceUtils.js";

export function renderReachSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const controls = createColumn("controls");
  const modelState = createColumn("state");
  const results = createColumn("results");
  results.classList.add("fpe-col--full-row");

  const universeCard = createCard({
    title: "Universe assumptions",
    description: "Movable-universe and early-vote assumptions that shape reachable target volume."
  });

  const leversCard = createCard({
    title: "Constraints & levers",
    description: "What is binding now and which knobs move the weekly gap fastest."
  });

  const weeklyCard = createCard({
    title: "Weekly production",
    description: "Required vs achievable attempts, pace, and execution status."
  });

  const outlookCard = createCard({
    title: "Capacity outlook",
    description: "Baseline, ramp, and scheduled-attempt comparisons."
  });

  const freshnessCard = createCard({
    title: "Data freshness",
    description: "Rolling operational signals and calibration controls from organizer data."
  });

  const actionsCard = createCard({
    title: "Recommended actions",
    description: "Highest-value interventions under current constraints."
  });

  const conversionCard = createCard({
    title: "Persuasion math",
    description: "Contact and support rates that determine conversion efficiency."
  });

  const summaryCard = createCard({
    title: "Reach summary",
    description: "Current capacity posture and operating risk at a glance."
  });

  const universeBody = getCardBody(universeCard);
  const universeFields = createFieldGrid("fpe-field-grid--2");
  universeBody.append(universeFields);
  mountLegacyClosest({
    key: "v3-reach-persuasionPct-field",
    childSelector: "#persuasionPct",
    closestSelector: ".field",
    target: universeFields
  });
  mountLegacyClosest({
    key: "v3-reach-earlyVoteExp-field",
    childSelector: "#earlyVoteExp",
    closestSelector: ".field",
    target: universeFields
  });

  const leversBody = getCardBody(leversCard);
  mountLegacyNode({
    key: "v3-reach-levers-intro",
    selector: "#wkLeversIntro",
    target: leversBody
  });
  mountLegacyNode({
    key: "v3-reach-levers-bestmoves-intro",
    selector: "#wkBestMovesIntro",
    target: leversBody
  });
  mountLegacyNode({
    key: "v3-reach-levers-bestmoves-list",
    selector: "#wkBestMovesList",
    target: leversBody
  });
  mountLegacyClosest({
    key: "v3-reach-levers-table-wrap",
    childSelector: "#wkLeversTbody",
    closestSelector: ".table-wrap",
    target: leversBody
  });
  mountLegacyNode({
    key: "v3-reach-levers-foot",
    selector: "#wkLeversFoot",
    target: leversBody
  });

  const weeklyBody = getCardBody(weeklyCard);
  mountLegacyClosest({
    key: "v3-reach-weekly-top-subgrid",
    childSelector: "#wkGoal",
    closestSelector: ".subgrid",
    target: weeklyBody
  });
  mountLegacyClosest({
    key: "v3-reach-weekly-second-subgrid",
    childSelector: "#wkCapacityPerWeek",
    closestSelector: ".subgrid",
    target: weeklyBody
  });
  mountLegacyNode({
    key: "v3-reach-weekly-banner",
    selector: "#wkBanner",
    target: weeklyBody
  });
  mountLegacyClosest({
    key: "v3-reach-weekly-subtitle",
    childSelector: "#wkReqConvosWeek",
    closestSelector: ".card-subtitle",
    target: weeklyBody
  });
  mountLegacyClosest({
    key: "v3-reach-weekly-third-subgrid",
    childSelector: "#wkReqConvosWeek",
    closestSelector: ".subgrid",
    target: weeklyBody
  });
  mountLegacyClosest({
    key: "v3-reach-weekly-fourth-subgrid",
    childSelector: "#wkReqDoorAttemptsWeek",
    closestSelector: ".subgrid",
    target: weeklyBody
  });
  mountLegacyClosest({
    key: "v3-reach-weekly-fifth-subgrid",
    childSelector: "#wkFinishConvos",
    closestSelector: ".subgrid",
    target: weeklyBody
  });
  mountLegacyNode({
    key: "v3-reach-weekly-exec-banner",
    selector: "#wkExecBanner",
    target: weeklyBody
  });

  const outlookBody = getCardBody(outlookCard);
  mountLegacyNode({
    key: "v3-reach-outlook-status",
    selector: "#twCapOutlookStatus",
    target: outlookBody
  });
  mountLegacyClosest({
    key: "v3-reach-outlook-controls",
    childSelector: "#twCapOverrideEnabled",
    closestSelector: ".note",
    target: outlookBody
  });
  mountLegacyClosest({
    key: "v3-reach-outlook-headline-subgrid",
    childSelector: "#twCapOutlookBaseline",
    closestSelector: ".subgrid",
    target: outlookBody
  });
  mountLegacyClosest({
    key: "v3-reach-outlook-diagnostics-subgrid",
    childSelector: "#twDiagInterviewPass",
    closestSelector: ".subgrid",
    target: outlookBody
  });
  mountLegacyClosest({
    key: "v3-reach-outlook-table-wrap",
    childSelector: "#twCapOutlookTbody",
    closestSelector: ".table-wrap",
    target: outlookBody
  });
  mountLegacyNode({
    key: "v3-reach-outlook-basis-note",
    selector: "#twCapOutlookBasis",
    target: outlookBody
  });

  const freshnessBody = getCardBody(freshnessCard);
  mountLegacyNode({
    key: "v3-reach-freshness-top-note",
    selector: "#weeklyOpsFreshnessCard > .note",
    target: freshnessBody
  });
  mountLegacyClosest({
    key: "v3-reach-freshness-import-field",
    childSelector: "#dailyLogImportText",
    closestSelector: ".field",
    target: freshnessBody
  });
  mountLegacyClosest({
    key: "v3-reach-freshness-subgrid",
    childSelector: "#wkLastUpdate",
    closestSelector: ".subgrid",
    target: freshnessBody
  });
  mountLegacyClosest({
    key: "v3-reach-freshness-analyst-note",
    childSelector: "#applyRollingCRBtn",
    closestSelector: ".note",
    target: freshnessBody
  });

  const actionsBody = getCardBody(actionsCard);
  mountLegacyNode({
    key: "v3-reach-actions-bar",
    selector: "#weeklyOpsActionsCard .wkActionBar",
    target: actionsBody
  });
  mountLegacyNode({
    key: "v3-reach-actions-list",
    selector: "#wkActionsList",
    target: actionsBody
  });
  mountLegacyNode({
    key: "v3-reach-actions-note",
    selector: "#weeklyOpsActionsCard .note",
    target: actionsBody
  });

  const conversionBody = getCardBody(conversionCard);
  const conversionFields = createFieldGrid("fpe-field-grid--2");
  conversionBody.append(conversionFields);
  mountLegacyClosest({
    key: "v3-reach-supportRate-field",
    childSelector: "#supportRatePct",
    closestSelector: ".field",
    target: conversionFields
  });
  mountLegacyClosest({
    key: "v3-reach-contactRate-field",
    childSelector: "#contactRatePct",
    closestSelector: ".field",
    target: conversionFields
  });
  mountLegacyNode({
    key: "v3-reach-conversion-note",
    selector: "#conversionCard .note",
    target: conversionBody
  });

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Goal support IDs / week</span><strong id="v3ReachGoal">-</strong></div>
      <div class="fpe-summary-row"><span>Attempts required / week</span><strong id="v3ReachRequiredAttempts">-</strong></div>
      <div class="fpe-summary-row"><span>Capacity / week</span><strong id="v3ReachCapacity">-</strong></div>
      <div class="fpe-summary-row"><span>Weekly gap</span><strong id="v3ReachGap">-</strong></div>
      <div class="fpe-summary-row"><span>Primary constraint</span><strong id="v3ReachConstraint">-</strong></div>
      <div class="fpe-summary-row"><span>Pace status</span><strong id="v3ReachPace">-</strong></div>
    </div>
  `;

  controls.append(universeCard, leversCard);
  modelState.append(weeklyCard, outlookCard, freshnessCard);
  results.append(actionsCard, conversionCard, summaryCard);

  frame.append(controls, modelState, results);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Reach is bounded by throughput and conversion physics, not aspiration.",
      "This page should immediately show whether current capacity can close the modeled need.",
      "Use levers to resolve bottlenecks before changing outcome assumptions."
    ])
  );

  return refreshReachSummary;
}

function refreshReachSummary() {
  setText("v3ReachGoal", readText("#wkGoal"));
  setText("v3ReachRequiredAttempts", readText("#wkAttemptsPerWeek"));
  setText("v3ReachCapacity", readText("#wkCapacityPerWeek"));
  setText("v3ReachGap", readText("#wkGapPerWeek"));
  setText("v3ReachConstraint", readText("#wkConstraint"));
  setText("v3ReachPace", readText("#wkPaceStatus"));
}
