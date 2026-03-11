import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import {
  bindCheckboxProxy,
  bindFieldProxy,
  bindSelectProxy,
  readText,
  setText,
  syncControlDisabled,
  syncCheckboxValue,
  syncFieldValue,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderReachSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("left");
  const right = createColumn("right");

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
  const outlookHeaderToggle = document.createElement("div");
  outlookHeaderToggle.className = "fpe-header-switch";
  outlookHeaderToggle.innerHTML = `
    <span class="fpe-header-switch__label">Operations override (enable to apply)</span>
    <label class="fpe-switch">
      <input id="v3ReachCapOverrideEnabled" type="checkbox"/>
      <span>Enable</span>
    </label>
  `;
  setCardHeaderControl(outlookCard, outlookHeaderToggle);

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
  universeBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3ReachPersuasionPct">Movable universe %</label>
        <input class="fpe-input" id="v3ReachPersuasionPct" max="100" min="0" step="0.1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3ReachEarlyVoteExp">Early vote expected %</label>
        <input class="fpe-input" id="v3ReachEarlyVoteExp" max="100" min="0" step="0.1" type="number"/>
      </div>
    </div>
    <div class="fpe-help fpe-help--flush">These assumptions affect how much persuadable universe remains for field contact over the timeline.</div>
  `;

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
  weeklyBody.innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Goal support IDs / week</span><strong id="v3ReachGoal">-</strong></div>
      <div class="fpe-summary-row"><span>Attempts required / week</span><strong id="v3ReachRequiredAttempts">-</strong></div>
      <div class="fpe-summary-row"><span>Conversations required / week</span><strong id="v3ReachRequiredConvos">-</strong></div>
      <div class="fpe-summary-row"><span>Door attempts required / week</span><strong id="v3ReachRequiredDoors">-</strong></div>
      <div class="fpe-summary-row"><span>Capacity / week</span><strong id="v3ReachCapacity">-</strong></div>
      <div class="fpe-summary-row"><span>Weekly gap</span><strong id="v3ReachGap">-</strong></div>
      <div class="fpe-summary-row"><span>Finish date (convos)</span><strong id="v3ReachFinishConvos">-</strong></div>
      <div class="fpe-summary-row"><span>Finish date (doors)</span><strong id="v3ReachFinishDoors">-</strong></div>
      <div class="fpe-summary-row"><span>Primary constraint</span><strong id="v3ReachConstraint">-</strong></div>
      <div class="fpe-summary-row"><span>Constraint note</span><strong id="v3ReachConstraintNote">-</strong></div>
      <div class="fpe-summary-row"><span>Pace status</span><strong id="v3ReachPace">-</strong></div>
    </div>
  `;
  mountLegacyNode({
    key: "v3-reach-weekly-banner",
    selector: "#wkBanner",
    target: weeklyBody
  });
  mountLegacyNode({
    key: "v3-reach-weekly-exec-banner",
    selector: "#wkExecBanner",
    target: weeklyBody
  });

  const outlookBody = getCardBody(outlookCard);
  outlookBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3ReachCapOverrideMode">Override source</label>
        <select class="fpe-input" id="v3ReachCapOverrideMode"></select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3ReachCapOverrideHorizonWeeks">Horizon (weeks)</label>
        <input class="fpe-input" id="v3ReachCapOverrideHorizonWeeks" max="52" min="4" step="1" type="number"/>
      </div>
    </div>

    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Status</span><strong id="v3ReachOutlookStatus">-</strong></div>
      <div class="fpe-summary-row"><span>Active source</span><strong id="v3ReachOutlookSource">-</strong></div>
      <div class="fpe-summary-row"><span>Baseline / week</span><strong id="v3ReachOutlookBaseline">-</strong></div>
      <div class="fpe-summary-row"><span>Expected ramp (horizon)</span><strong id="v3ReachOutlookRamp">-</strong></div>
      <div class="fpe-summary-row"><span>Scheduled attempts (horizon)</span><strong id="v3ReachOutlookScheduled">-</strong></div>
      <div class="fpe-summary-row"><span>Horizon note</span><strong id="v3ReachOutlookHorizon">-</strong></div>
    </div>

    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Interview pass rate</span><strong id="v3ReachDiagInterviewPass">-</strong></div>
      <div class="fpe-summary-row"><span>Offer accept rate</span><strong id="v3ReachDiagOfferAccept">-</strong></div>
      <div class="fpe-summary-row"><span>Onboarding completion</span><strong id="v3ReachDiagOnboardingCompletion">-</strong></div>
      <div class="fpe-summary-row"><span>Training completion</span><strong id="v3ReachDiagTrainingCompletion">-</strong></div>
      <div class="fpe-summary-row"><span>Composite ramp signal</span><strong id="v3ReachDiagCompositeSignal">-</strong></div>
      <div class="fpe-summary-row"><span>Ready now</span><strong id="v3ReachDiagReadyNow">-</strong></div>
      <div class="fpe-summary-row"><span>Recent ready / week</span><strong id="v3ReachDiagReadyPerWeek">-</strong></div>
      <div class="fpe-summary-row"><span>Projected ready in 14d</span><strong id="v3ReachDiagReadyIn14d">-</strong></div>
      <div class="fpe-summary-row"><span>Median days to readiness</span><strong id="v3ReachDiagMedianReadyDays">-</strong></div>
      <div class="fpe-summary-row"><span>Diagnostic note</span><strong id="v3ReachDiagHintNote">-</strong></div>
    </div>
  `;
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
  const freshnessContext = document.createElement("div");
  freshnessContext.className = "fpe-contained-block";
  freshnessBody.append(freshnessContext);
  mountLegacyNode({
    key: "v3-reach-freshness-context-text",
    selector: "#weeklyOpsFreshnessCard > .note > div:first-child",
    target: freshnessContext
  });
  const freshnessTopActions = document.createElement("div");
  freshnessTopActions.className = "fpe-action-row";
  freshnessContext.append(freshnessTopActions);
  mountLegacyNode({
    key: "v3-reach-freshness-export-btn",
    selector: "#dailyLogExportBtn",
    target: freshnessTopActions
  });
  mountLegacyClosest({
    key: "v3-reach-freshness-import-field",
    childSelector: "#dailyLogImportText",
    closestSelector: ".field",
    target: freshnessBody
  });
  const importField = freshnessBody.querySelector("#dailyLogImportText")?.closest(".field");
  if (importField) {
    const importActions = document.createElement("div");
    importActions.className = "fpe-action-row";
    importField.append(importActions);
    const importBtn = importField.querySelector("#dailyLogImportBtn");
    const importMsg = importField.querySelector("#dailyLogImportMsg");
    if (importBtn) {
      importActions.append(importBtn);
    }
    if (importMsg) {
      importActions.append(importMsg);
    }
  }
  mountLegacyClosest({
    key: "v3-reach-freshness-subgrid",
    childSelector: "#wkLastUpdate",
    closestSelector: ".subgrid",
    target: freshnessBody
  });
  const analystTools = document.createElement("div");
  analystTools.className = "fpe-contained-block";
  analystTools.innerHTML = `<div class="fpe-help fpe-help--flush">Analyst tools</div>`;
  freshnessBody.append(analystTools);
  const analystActions = document.createElement("div");
  analystActions.className = "fpe-action-row";
  analystTools.append(analystActions);
  mountLegacyNode({
    key: "v3-reach-analyst-cr-btn",
    selector: "#applyRollingCRBtn",
    target: analystActions
  });
  mountLegacyNode({
    key: "v3-reach-analyst-sr-btn",
    selector: "#applyRollingSRBtn",
    target: analystActions
  });
  mountLegacyNode({
    key: "v3-reach-analyst-aph-btn",
    selector: "#applyRollingAPHBtn",
    target: analystActions
  });
  mountLegacyNode({
    key: "v3-reach-analyst-all-btn",
    selector: "#applyRollingAllBtn",
    target: analystActions
  });
  mountLegacyNode({
    key: "v3-reach-analyst-msg",
    selector: "#applyRollingMsg",
    target: analystActions
  });
  const freshnessRealityNote = document.createElement("div");
  freshnessRealityNote.className = "fpe-contained-block";
  freshnessBody.append(freshnessRealityNote);
  mountLegacyNode({
    key: "v3-reach-freshness-reality-note",
    selector: "#weeklyOpsFreshnessCard > .note:last-of-type",
    target: freshnessRealityNote
  });

  const actionsBody = getCardBody(actionsCard);
  const actionsListWrap = document.createElement("div");
  actionsListWrap.className = "fpe-contained-block";
  actionsBody.append(actionsListWrap);
  mountLegacyNode({
    key: "v3-reach-actions-list",
    selector: "#wkActionsList",
    target: actionsListWrap
  });
  const actionsUndoRow = document.createElement("div");
  actionsUndoRow.className = "fpe-action-row";
  actionsBody.append(actionsUndoRow);
  mountLegacyNode({
    key: "v3-reach-actions-undo-btn",
    selector: "#wkUndoActionBtn",
    target: actionsUndoRow
  });
  mountLegacyNode({
    key: "v3-reach-actions-undo-msg",
    selector: "#wkUndoActionMsg",
    target: actionsUndoRow
  });
  const actionsGuidance = document.createElement("div");
  actionsGuidance.className = "fpe-contained-block";
  actionsBody.append(actionsGuidance);
  mountLegacyNode({
    key: "v3-reach-actions-note",
    selector: "#weeklyOpsActionsCard > .note",
    target: actionsGuidance
  });

  const conversionBody = getCardBody(conversionCard);
  conversionBody.innerHTML = `
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3ReachSupportRatePct">Support rate (of conversations)</label>
        <input class="fpe-input" id="v3ReachSupportRatePct" max="100" min="0" step="0.1" type="number"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3ReachContactRatePct">Contact rate (doors → conversation)</label>
        <input class="fpe-input" id="v3ReachContactRatePct" max="100" min="0" step="0.1" type="number"/>
      </div>
    </div>
    <div class="fpe-help fpe-help--flush">Attempts → contacts (contact rate) → support IDs (support rate). Shared backbone for Reach, Turnout, Outcome, and Plan.</div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Goal support IDs / week</span><strong id="v3ReachSummaryGoal">-</strong></div>
      <div class="fpe-summary-row"><span>Attempts required / week</span><strong id="v3ReachSummaryRequiredAttempts">-</strong></div>
      <div class="fpe-summary-row"><span>Capacity / week</span><strong id="v3ReachSummaryCapacity">-</strong></div>
      <div class="fpe-summary-row"><span>Weekly gap</span><strong id="v3ReachSummaryGap">-</strong></div>
      <div class="fpe-summary-row"><span>Primary constraint</span><strong id="v3ReachSummaryConstraint">-</strong></div>
      <div class="fpe-summary-row"><span>Pace status</span><strong id="v3ReachSummaryPace">-</strong></div>
    </div>
  `;

  left.append(outlookCard, freshnessCard, universeCard, conversionCard);
  right.append(summaryCard, weeklyCard, leversCard, actionsCard);

  frame.append(left, right);
  mount.append(frame);

  wireReachControlProxies();
  return refreshReachSummary;
}

function wireReachControlProxies() {
  bindFieldProxy("v3ReachPersuasionPct", "persuasionPct");
  bindFieldProxy("v3ReachEarlyVoteExp", "earlyVoteExp");

  bindCheckboxProxy("v3ReachCapOverrideEnabled", "twCapOverrideEnabled");
  bindSelectProxy("v3ReachCapOverrideMode", "twCapOverrideMode");
  bindFieldProxy("v3ReachCapOverrideHorizonWeeks", "twCapOverrideHorizonWeeks");

  bindFieldProxy("v3ReachSupportRatePct", "supportRatePct");
  bindFieldProxy("v3ReachContactRatePct", "contactRatePct");
}

function refreshReachSummary() {
  setText("v3ReachGoal", readText("#wkGoal"));
  setText("v3ReachRequiredAttempts", readText("#wkAttemptsPerWeek"));
  setText("v3ReachRequiredConvos", readText("#wkReqConvosWeek"));
  setText("v3ReachRequiredDoors", readText("#wkReqDoorAttemptsWeek"));
  setText("v3ReachCapacity", readText("#wkCapacityPerWeek"));
  setText("v3ReachGap", readText("#wkGapPerWeek"));
  setText("v3ReachConstraint", readText("#wkConstraint"));
  setText("v3ReachConstraintNote", readText("#wkConstraintNote"));
  setText("v3ReachPace", readText("#wkPaceStatus"));
  setText("v3ReachFinishConvos", readText("#wkFinishConvos"));
  setText("v3ReachFinishDoors", readText("#wkFinishDoors"));

  setText("v3ReachOutlookStatus", readText("#twCapOutlookStatus"));
  setText("v3ReachOutlookSource", readText("#twCapOutlookActiveSource"));
  setText("v3ReachOutlookBaseline", readText("#twCapOutlookBaseline"));
  setText("v3ReachOutlookRamp", readText("#twCapOutlookRampTotal"));
  setText("v3ReachOutlookScheduled", readText("#twCapOutlookScheduledTotal"));
  setText("v3ReachOutlookHorizon", readText("#twCapOutlookHorizon"));

  setText("v3ReachDiagInterviewPass", readText("#twDiagInterviewPass"));
  setText("v3ReachDiagOfferAccept", readText("#twDiagOfferAccept"));
  setText("v3ReachDiagOnboardingCompletion", readText("#twDiagOnboardingCompletion"));
  setText("v3ReachDiagTrainingCompletion", readText("#twDiagTrainingCompletion"));
  setText("v3ReachDiagCompositeSignal", readText("#twDiagCompositeSignal"));
  setText("v3ReachDiagReadyNow", readText("#twDiagReadyNow"));
  setText("v3ReachDiagReadyPerWeek", readText("#twDiagReadyPerWeek"));
  setText("v3ReachDiagReadyIn14d", readText("#twDiagReadyIn14d"));
  setText("v3ReachDiagMedianReadyDays", readText("#twDiagMedianReadyDays"));
  setText("v3ReachDiagHintNote", readText("#twDiagHintNote"));

  setText("v3ReachSummaryGoal", readText("#wkGoal"));
  setText("v3ReachSummaryRequiredAttempts", readText("#wkAttemptsPerWeek"));
  setText("v3ReachSummaryCapacity", readText("#wkCapacityPerWeek"));
  setText("v3ReachSummaryGap", readText("#wkGapPerWeek"));
  setText("v3ReachSummaryConstraint", readText("#wkConstraint"));
  setText("v3ReachSummaryPace", readText("#wkPaceStatus"));

  syncFieldValue("v3ReachPersuasionPct", "persuasionPct");
  syncFieldValue("v3ReachEarlyVoteExp", "earlyVoteExp");

  syncCheckboxValue("v3ReachCapOverrideEnabled", "twCapOverrideEnabled");
  syncSelectValue("v3ReachCapOverrideMode", "twCapOverrideMode");
  syncFieldValue("v3ReachCapOverrideHorizonWeeks", "twCapOverrideHorizonWeeks");

  syncFieldValue("v3ReachSupportRatePct", "supportRatePct");
  syncFieldValue("v3ReachContactRatePct", "contactRatePct");

  syncControlDisabled("v3ReachPersuasionPct", "persuasionPct");
  syncControlDisabled("v3ReachEarlyVoteExp", "earlyVoteExp");

  syncControlDisabled("v3ReachCapOverrideEnabled", "twCapOverrideEnabled");
  syncControlDisabled("v3ReachCapOverrideMode", "twCapOverrideMode");
  syncControlDisabled("v3ReachCapOverrideHorizonWeeks", "twCapOverrideHorizonWeeks");

  syncControlDisabled("v3ReachSupportRatePct", "supportRatePct");
  syncControlDisabled("v3ReachContactRatePct", "contactRatePct");
}
