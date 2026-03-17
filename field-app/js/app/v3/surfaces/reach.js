import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody,
  setCardHeaderControl
} from "../componentFactory.js";
import { setText } from "../surfaceUtils.js";

const REACH_API_KEY = "__FPE_REACH_API__";

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
    description: "What is binding now and which knobs move the weekly gap fastest.",
    status: "Awaiting inputs"
  });

  const weeklyCard = createCard({
    title: "Weekly production",
    description: "Required vs achievable attempts, pace, and execution status.",
    status: "Awaiting inputs"
  });

  const outlookCard = createCard({
    title: "Capacity outlook",
    description: "Baseline, ramp, and scheduled-attempt comparisons.",
    status: "Awaiting ops data"
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
    description: "Rolling operational signals and calibration controls from organizer data.",
    status: "Awaiting logs"
  });

  const actionsCard = createCard({
    title: "Recommended actions",
    description: "Highest-value interventions under current constraints.",
    status: "Model-based"
  });

  const conversionCard = createCard({
    title: "Persuasion math",
    description: "Contact and support rates that determine conversion efficiency."
  });

  const summaryCard = createCard({
    title: "Reach summary",
    description: "Current capacity posture and operating risk at a glance.",
    status: "Awaiting inputs"
  });

  assignCardStatusId(outlookCard, "v3ReachOutlookCardStatus");
  assignCardStatusId(freshnessCard, "v3ReachFreshnessCardStatus");
  assignCardStatusId(summaryCard, "v3ReachSummaryCardStatus");
  assignCardStatusId(weeklyCard, "v3ReachWeeklyCardStatus");
  assignCardStatusId(leversCard, "v3ReachLeversCardStatus");
  assignCardStatusId(actionsCard, "v3ReachActionsCardStatus");

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
  leversBody.innerHTML = `
    <div class="fpe-contained-block fpe-contained-block--instruction">
      <div class="fpe-help fpe-help--flush" id="v3ReachLeversIntro">-</div>
    </div>
    <div class="fpe-contained-block" id="v3ReachBestMovesBlock">
      <div class="fpe-help fpe-help--flush" id="v3ReachBestMovesIntro">Best 3 moves — impact per unit:</div>
      <ul class="bullets" id="v3ReachBestMovesList"></ul>
    </div>
    <div class="table-wrap">
      <table aria-label="Constraints and levers (v3)" class="table">
        <thead>
          <tr>
            <th>Lever</th>
            <th class="num">Impact</th>
            <th>Cost unit</th>
            <th class="num">Efficiency</th>
            <th>Apply</th>
          </tr>
        </thead>
        <tbody id="v3ReachLeversTbody"></tbody>
      </table>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ReachLeversFoot">-</div>
  `;

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
      <div class="fpe-summary-row"><span>Finish date (attempts)</span><strong id="v3ReachFinishDoors">-</strong></div>
      <div class="fpe-summary-row"><span>Primary constraint</span><strong id="v3ReachConstraint">-</strong></div>
      <div class="fpe-summary-row"><span>Constraint note</span><strong id="v3ReachConstraintNote">-</strong></div>
      <div class="fpe-summary-row"><span>Pace status</span><strong id="v3ReachPace">-</strong></div>
    </div>
    <div class="fpe-alert fpe-alert--warn" hidden id="v3ReachWkBanner"></div>
    <div class="fpe-alert fpe-alert--warn" hidden id="v3ReachWkExecBanner"></div>
  `;

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

    <div class="table-wrap">
      <table aria-label="Operations capacity outlook (v3)" class="table">
        <thead>
          <tr>
            <th>Week starting</th>
            <th class="num">Baseline</th>
            <th class="num">Expected ramp</th>
            <th class="num">Scheduled</th>
            <th class="num">Scheduled − ramp</th>
          </tr>
        </thead>
        <tbody id="v3ReachOutlookTbody"></tbody>
      </table>
    </div>

    <div class="fpe-help fpe-help--flush" id="v3ReachOutlookBasis">-</div>
  `;

  const freshnessBody = getCardBody(freshnessCard);
  freshnessBody.innerHTML = `
    <div class="fpe-contained-block fpe-contained-block--instruction">
      <div class="fpe-help fpe-help--flush">
        Organizer input lives on a separate page for clean data entry.
        <a class="link" href="organizer.html">Open organizer page</a>
        <span class="mini-s">|</span>
        <a class="link" href="operations.html">Open operations hub</a>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3ReachFreshExportBtn" type="button">Export daily log</button>
      </div>
    </div>

    <div class="field">
      <label class="fpe-control-label" for="v3ReachDailyLogImportText">Import daily log (paste JSON)</label>
      <textarea class="fpe-input" id="v3ReachDailyLogImportText" placeholder='Paste JSON array of entries (or {"dailyLog": [...]})' rows="5"></textarea>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3ReachDailyLogImportBtn" type="button">Import & merge</button>
        <span class="mini-s" id="v3ReachDailyLogImportMsg"></span>
      </div>
    </div>

    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Last update</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshLastUpdate">-</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshNote">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Rolling 7-day attempts</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingAttempts">-</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingNote">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Plan status</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshStatus">-</div>
        <div class="fpe-help fpe-help--flush">Based on whether your log supports the assumed rates/capacity</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Rolling 7-day contact rate</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingCR">-</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingCRNote">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Rolling 7-day support rate</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingSR">-</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingSRNote">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Rolling attempts per org hour</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingAPH">-</div>
        <div class="fpe-help fpe-help--flush" id="v3ReachFreshRollingAPHNote">-</div>
      </div>
    </div>

    <div class="fpe-contained-block">
      <div class="fpe-help fpe-help--flush">Analyst tools</div>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3ReachApplyRollingCRBtn" type="button">Use rolling contact rate</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3ReachApplyRollingSRBtn" type="button">Use rolling support rate</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3ReachApplyRollingAPHBtn" type="button">Use rolling productivity</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3ReachApplyRollingAllBtn" type="button">Apply all rolling calibrations</button>
        <span class="mini-s" id="v3ReachApplyRollingMsg"></span>
      </div>
    </div>

    <div class="fpe-contained-block fpe-contained-block--instruction">
      <div class="fpe-help fpe-help--flush" id="v3ReachFreshRealityNote">
        Reality check uses your daily log to estimate actual rates/capacity over the last 7 entries.
      </div>
    </div>
  `;

  const actionsBody = getCardBody(actionsCard);
  actionsBody.innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets" id="v3ReachActionsList"></ul>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn fpe-btn--ghost" id="v3ReachUndoActionBtn" type="button">Undo last applied action</button>
      <span class="mini-s" id="v3ReachUndoActionMsg"></span>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ReachActionsNote">-</div>
  `;

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

  const bridgeRoot = document.createElement("div");
  bridgeRoot.id = "v3ReachBridgeRoot";
  bridgeRoot.append(frame);

  left.append(outlookCard, freshnessCard, universeCard, conversionCard);
  right.append(summaryCard, weeklyCard, leversCard, actionsCard);
  frame.append(left, right);
  mount.append(bridgeRoot);
  mount.append(
    createWhyPanel([
      "Reach converts campaign ambition into weekly throughput constraints you can actually operate.",
      "If required attempts exceed capacity, win-path forecasts will not be executable without staffing, timeline, or rate changes.",
      "Use this page to close the weekly gap before locking scenario decisions."
    ])
  );

  wireReachEvents();
  return refreshReachSummary;
}

function getReachApi() {
  const candidate = window[REACH_API_KEY];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  return candidate;
}

function refreshReachSummary() {
  const api = getReachApi();
  try {
    if (!api || typeof api.getView !== "function") {
      renderReachUnavailable();
      return;
    }

    const payload = api.getView();
    if (!payload || typeof payload !== "object") {
      renderReachUnavailable();
      return;
    }

    applyReachView(payload);
  } catch (error) {
    console.error("[v3-reach] runtime bridge failed", error);
    renderReachUnavailable();
  }
}

function applyReachView(view) {
  const inputs = view.inputs || {};
  const controls = view.controls || {};
  const options = view.options || {};
  const weekly = view.weekly || {};
  const freshness = view.freshness || {};
  const levers = view.levers || {};
  const actions = view.actions || {};
  const summary = view.summary || {};
  const outlook = view.outlook || {};

  syncInputValue("v3ReachPersuasionPct", inputs.persuasionPct);
  syncInputValue("v3ReachEarlyVoteExp", inputs.earlyVoteExp);
  syncInputValue("v3ReachSupportRatePct", inputs.supportRatePct);
  syncInputValue("v3ReachContactRatePct", inputs.contactRatePct);
  syncInputValue("v3ReachCapOverrideHorizonWeeks", inputs.twCapOverrideHorizonWeeks);
  syncInputValue("v3ReachDailyLogImportText", inputs.dailyLogImportText);
  syncCheckboxValue("v3ReachCapOverrideEnabled", !!inputs.twCapOverrideEnabled);
  syncSelectOptions("v3ReachCapOverrideMode", options.twCapOverrideMode || [], inputs.twCapOverrideMode);

  setControlDisabled("v3ReachPersuasionPct", !!controls.locked);
  setControlDisabled("v3ReachEarlyVoteExp", !!controls.locked);
  setControlDisabled("v3ReachSupportRatePct", !!controls.locked);
  setControlDisabled("v3ReachContactRatePct", !!controls.locked);
  setControlDisabled("v3ReachCapOverrideEnabled", !!controls.locked);
  setControlDisabled("v3ReachCapOverrideMode", !!controls.twCapOverrideModeDisabled);
  setControlDisabled("v3ReachCapOverrideHorizonWeeks", !!controls.twCapOverrideHorizonWeeksDisabled);
  setControlDisabled("v3ReachDailyLogImportText", !!controls.locked);
  setButtonDisabled("v3ReachDailyLogImportBtn", !!controls.locked);
  setButtonDisabled("v3ReachApplyRollingCRBtn", !!controls.locked);
  setButtonDisabled("v3ReachApplyRollingSRBtn", !!controls.locked);
  setButtonDisabled("v3ReachApplyRollingAPHBtn", !!controls.locked);
  setButtonDisabled("v3ReachApplyRollingAllBtn", !!controls.locked);
  setButtonDisabled("v3ReachUndoActionBtn", !!controls.undoDisabled);

  setText("v3ReachGoal", weekly.goal);
  setText("v3ReachRequiredAttempts", weekly.requiredAttempts);
  setText("v3ReachRequiredConvos", weekly.requiredConvos);
  setText("v3ReachRequiredDoors", weekly.requiredDoors);
  setText("v3ReachCapacity", weekly.capacity);
  setText("v3ReachGap", weekly.gap);
  setText("v3ReachConstraint", weekly.constraint);
  setText("v3ReachConstraintNote", weekly.constraintNote);
  setText("v3ReachPace", weekly.paceStatus);
  setText("v3ReachFinishConvos", weekly.finishConvos);
  setText("v3ReachFinishDoors", weekly.finishAttempts);
  applyBanner("v3ReachWkBanner", weekly.wkBanner);
  applyBanner("v3ReachWkExecBanner", weekly.wkExecBanner);

  setText("v3ReachSummaryGoal", summary.goal);
  setText("v3ReachSummaryRequiredAttempts", summary.requiredAttempts);
  setText("v3ReachSummaryCapacity", summary.capacity);
  setText("v3ReachSummaryGap", summary.gap);
  setText("v3ReachSummaryConstraint", summary.constraint);
  setText("v3ReachSummaryPace", summary.pace);
  syncReachCardStatus("v3ReachSummaryCardStatus", summary.pace || weekly.paceStatus || "Awaiting inputs");
  syncReachCardStatus("v3ReachWeeklyCardStatus", deriveReachWeeklyCardStatus(weekly));

  setText("v3ReachOutlookStatus", outlook.status);
  setText("v3ReachOutlookSource", outlook.activeSource);
  setText("v3ReachOutlookBaseline", outlook.baseline);
  setText("v3ReachOutlookRamp", outlook.rampTotal);
  setText("v3ReachOutlookScheduled", outlook.scheduledTotal);
  setText("v3ReachOutlookHorizon", outlook.horizon);
  setText("v3ReachDiagInterviewPass", outlook.interviewPass);
  setText("v3ReachDiagOfferAccept", outlook.offerAccept);
  setText("v3ReachDiagOnboardingCompletion", outlook.onboardingCompletion);
  setText("v3ReachDiagTrainingCompletion", outlook.trainingCompletion);
  setText("v3ReachDiagCompositeSignal", outlook.compositeSignal);
  setText("v3ReachDiagReadyNow", outlook.readyNow);
  setText("v3ReachDiagReadyPerWeek", outlook.readyPerWeek);
  setText("v3ReachDiagReadyIn14d", outlook.readyIn14d);
  setText("v3ReachDiagMedianReadyDays", outlook.medianReadyDays);
  setText("v3ReachDiagHintNote", outlook.hintNote);
  setText("v3ReachOutlookBasis", outlook.basis);
  renderReachOutlookRows(outlook.rows || []);
  syncReachCardStatus("v3ReachOutlookCardStatus", outlook.status || "Awaiting ops data");

  setText("v3ReachDailyLogImportMsg", freshness.dailyLogImportMsg);
  setText("v3ReachFreshLastUpdate", freshness.lastUpdate);
  setText("v3ReachFreshNote", freshness.freshNote);
  setText("v3ReachFreshRollingAttempts", freshness.rollingAttempts);
  setText("v3ReachFreshRollingNote", freshness.rollingNote);
  setText("v3ReachFreshStatus", freshness.status);
  setText("v3ReachFreshRollingCR", freshness.rollingCR);
  setText("v3ReachFreshRollingCRNote", freshness.rollingCRNote);
  setText("v3ReachFreshRollingSR", freshness.rollingSR);
  setText("v3ReachFreshRollingSRNote", freshness.rollingSRNote);
  setText("v3ReachFreshRollingAPH", freshness.rollingAPH);
  setText("v3ReachFreshRollingAPHNote", freshness.rollingAPHNote);
  setText("v3ReachApplyRollingMsg", freshness.applyRollingMsg);
  setText("v3ReachUndoActionMsg", freshness.undoActionMsg);
  setText("v3ReachFreshRealityNote", weekly.actualConvosNote || "Reality check uses your daily log to estimate actual rates/capacity over the last 7 entries.");
  syncReachCardStatus("v3ReachFreshnessCardStatus", freshness.status || "Awaiting logs");

  setText("v3ReachLeversIntro", levers.intro);
  setText("v3ReachBestMovesIntro", levers.bestMovesIntro);
  setText("v3ReachLeversFoot", levers.foot);
  setText("v3ReachActionsNote", actions.note);
  toggleElement("v3ReachBestMovesBlock", levers.showBestMoves !== false);
  toggleElement("v3ReachLeversFoot", !!levers.foot);
  renderReachBestMoves(levers.bestMoves || []);
  renderReachLeversRows(levers.rows || []);
  renderReachActions(actions.list || []);
  syncReachCardStatus("v3ReachLeversCardStatus", deriveReachLeversCardStatus(levers, weekly));
  syncReachCardStatus("v3ReachActionsCardStatus", deriveReachActionsCardStatus(actions));
}

function wireReachEvents() {
  const root = document.getElementById("v3ReachBridgeRoot");
  if (!(root instanceof HTMLElement) || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindInput("v3ReachPersuasionPct", (api, value) => api.setField?.("persuasionPct", value));
  bindInput("v3ReachEarlyVoteExp", (api, value) => api.setField?.("earlyVoteExp", value));
  bindInput("v3ReachSupportRatePct", (api, value) => api.setField?.("supportRatePct", value));
  bindInput("v3ReachContactRatePct", (api, value) => api.setField?.("contactRatePct", value));
  bindInput("v3ReachCapOverrideHorizonWeeks", (api, value) => api.setOverrideHorizon?.(value));
  bindTextarea("v3ReachDailyLogImportText", (api, value) => api.setDailyLogImportText?.(value));
  bindCheckbox("v3ReachCapOverrideEnabled", (api, checked) => api.setOverrideEnabled?.(checked));
  bindSelect("v3ReachCapOverrideMode", (api, value) => api.setOverrideMode?.(value));

  bindButton("v3ReachUndoActionBtn", (api) => api.undoLastAction?.());
  bindButton("v3ReachFreshExportBtn", (api) => api.exportDailyLog?.());
  bindButton("v3ReachDailyLogImportBtn", (api) => {
    const field = document.getElementById("v3ReachDailyLogImportText");
    const text = field instanceof HTMLTextAreaElement ? field.value : "";
    return api.importDailyLog?.(text);
  });
  bindButton("v3ReachApplyRollingCRBtn", (api) => api.applyRolling?.("contact"));
  bindButton("v3ReachApplyRollingSRBtn", (api) => api.applyRolling?.("support"));
  bindButton("v3ReachApplyRollingAPHBtn", (api) => api.applyRolling?.("productivity"));
  bindButton("v3ReachApplyRollingAllBtn", (api) => api.applyRollingAll?.());

  const applyHandler = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const btn = target.closest("button[data-v3-reach-lever-id]");
    if (!(btn instanceof HTMLButtonElement)) {
      return;
    }
    const api = getReachApi();
    if (!api || typeof api.applyLever !== "function") {
      return;
    }
    api.applyLever(btn.dataset.v3ReachLeverId || "");
    refreshReachSummary();
  };
  document.getElementById("v3ReachBestMovesList")?.addEventListener("click", applyHandler);
  document.getElementById("v3ReachLeversTbody")?.addEventListener("click", applyHandler);
}

function bindInput(id, action) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  input.addEventListener("change", () => {
    const api = getReachApi();
    if (!api || typeof action !== "function") {
      return;
    }
    action(api, input.value);
    refreshReachSummary();
  });
}

function bindTextarea(id, action) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLTextAreaElement)) {
    return;
  }
  input.addEventListener("input", () => {
    const api = getReachApi();
    if (!api || typeof action !== "function") {
      return;
    }
    action(api, input.value);
  });
}

function bindCheckbox(id, action) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  input.addEventListener("change", () => {
    const api = getReachApi();
    if (!api || typeof action !== "function") {
      return;
    }
    action(api, input.checked);
    refreshReachSummary();
  });
}

function bindSelect(id, action) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLSelectElement)) {
    return;
  }
  input.addEventListener("change", () => {
    const api = getReachApi();
    if (!api || typeof action !== "function") {
      return;
    }
    action(api, input.value);
    refreshReachSummary();
  });
}

function bindButton(id, action) {
  const button = document.getElementById(id);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  button.addEventListener("click", () => {
    const api = getReachApi();
    if (!api || typeof action !== "function") {
      return;
    }
    action(api);
    refreshReachSummary();
  });
}

function syncInputValue(id, value) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return;
  }
  if (document.activeElement === el) {
    return;
  }
  const text = value == null ? "" : String(value);
  if (el.value !== text) {
    el.value = text;
  }
}

function syncCheckboxValue(id, checked) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === el) {
    return;
  }
  el.checked = !!checked;
}

function syncSelectOptions(id, options, selectedValue) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return;
  }

  const normalized = Array.isArray(options)
    ? options.map((opt) => ({
        value: String(opt?.value ?? ""),
        label: String(opt?.label ?? opt?.value ?? "")
      }))
    : [];

  const current = Array.from(el.options).map((opt) => `${opt.value}::${opt.textContent || ""}`);
  const next = normalized.map((opt) => `${opt.value}::${opt.label}`);
  const same = current.length === next.length && current.every((item, index) => item === next[index]);
  if (!same) {
    el.innerHTML = "";
    normalized.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      el.appendChild(option);
    });
  }

  if (document.activeElement === el) {
    return;
  }

  const wanted = selectedValue == null ? "" : String(selectedValue);
  if (wanted && !Array.from(el.options).some((opt) => opt.value === wanted)) {
    const option = document.createElement("option");
    option.value = wanted;
    option.textContent = wanted;
    el.appendChild(option);
  }
  if (el.value !== wanted) {
    el.value = wanted;
  }
}

function setControlDisabled(id, disabled) {
  const el = document.getElementById(id);
  if (
    !(el instanceof HTMLInputElement) &&
    !(el instanceof HTMLSelectElement) &&
    !(el instanceof HTMLTextAreaElement) &&
    !(el instanceof HTMLButtonElement)
  ) {
    return;
  }
  el.disabled = !!disabled;
}

function setButtonDisabled(id, disabled) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLButtonElement)) {
    return;
  }
  el.disabled = !!disabled;
}

function applyBanner(id, banner) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const show = !!banner?.show && String(banner?.text || "").trim().length > 0;
  el.hidden = !show;
  el.classList.remove("ok", "warn", "bad");
  if (show) {
    el.classList.add(String(banner?.kind || "warn"));
    el.textContent = String(banner?.text || "");
  } else {
    el.textContent = "";
  }
}

function renderReachOutlookRows(rows) {
  const body = document.getElementById("v3ReachOutlookTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";

  const list = Array.isArray(rows) ? rows : [];
  list.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row?.weekStarting)}</td>
      <td class="num">${escapeHtml(row?.baseline)}</td>
      <td class="num">${escapeHtml(row?.ramp)}</td>
      <td class="num">${escapeHtml(row?.scheduled)}</td>
      <td class="num">${escapeHtml(row?.delta)}</td>
    `;
    body.appendChild(tr);
  });

  if (!body.children.length) {
    const tr = document.createElement("tr");
    tr.className = "fpe-empty-row";
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "fpe-empty-state";
    td.textContent = "No outlook data.";
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function renderReachBestMoves(rows) {
  const list = document.getElementById("v3ReachBestMovesList");
  if (!(list instanceof HTMLElement)) {
    return;
  }
  list.innerHTML = "";
  const items = Array.isArray(rows) ? rows : [];
  items.forEach((row) => {
    const li = document.createElement("li");
    const line = document.createElement("div");
    line.className = "fpe-action-row";
    const text = document.createElement("span");
    text.textContent = String(row?.text || "");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fpe-btn fpe-btn--ghost";
    btn.dataset.v3ReachLeverId = String(row?.id || "");
    btn.textContent = "Apply";
    line.append(text, btn);
    li.appendChild(line);
    list.appendChild(li);
  });

  if (!list.children.length) {
    const li = document.createElement("li");
    li.className = "fpe-empty-state";
    li.textContent = "No top moves available under current inputs.";
    list.appendChild(li);
  }
}

function renderReachLeversRows(rows) {
  const body = document.getElementById("v3ReachLeversTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  list.forEach((row) => {
    const tr = document.createElement("tr");
    const label = document.createElement("td");
    label.textContent = String(row?.label || "—");
    const impact = document.createElement("td");
    impact.className = "num";
    impact.textContent = String(row?.impact || "—");
    const cost = document.createElement("td");
    cost.textContent = String(row?.costUnit || "—");
    const eff = document.createElement("td");
    eff.className = "num";
    eff.textContent = String(row?.efficiency || "—");
    const apply = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fpe-btn fpe-btn--ghost";
    btn.dataset.v3ReachLeverId = String(row?.id || "");
    btn.textContent = "Apply";
    apply.appendChild(btn);
    tr.append(label, impact, cost, eff, apply);
    body.appendChild(tr);
  });

  if (!body.children.length) {
    const tr = document.createElement("tr");
    tr.className = "fpe-empty-row";
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "fpe-empty-state";
    td.textContent = "No lever estimates available under current inputs.";
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function renderReachActions(rows) {
  const list = document.getElementById("v3ReachActionsList");
  if (!(list instanceof HTMLElement)) {
    return;
  }
  list.innerHTML = "";
  const items = Array.isArray(rows) ? rows : [];
  items.forEach((textValue) => {
    const li = document.createElement("li");
    li.textContent = String(textValue || "");
    list.appendChild(li);
  });
  if (!list.children.length) {
    const li = document.createElement("li");
    li.className = "fpe-empty-state";
    li.textContent = "No recommended actions at this time.";
    list.appendChild(li);
  }
}

function toggleElement(id, show) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.hidden = !show;
}

function renderReachUnavailable() {
  setText("v3ReachLeversIntro", "Reach runtime bridge unavailable.");
  setText("v3ReachActionsNote", "Reload the app to restore Reach runtime wiring.");
  renderReachActions([]);
  renderReachBestMoves([]);
  renderReachLeversRows([]);
  renderReachOutlookRows([]);
  syncReachCardStatus("v3ReachSummaryCardStatus", "Unavailable");
  syncReachCardStatus("v3ReachWeeklyCardStatus", "Unavailable");
  syncReachCardStatus("v3ReachOutlookCardStatus", "Unavailable");
  syncReachCardStatus("v3ReachFreshnessCardStatus", "Unavailable");
  syncReachCardStatus("v3ReachLeversCardStatus", "Unavailable");
  syncReachCardStatus("v3ReachActionsCardStatus", "Unavailable");
}

function escapeHtml(value) {
  return String(value == null ? "—" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function syncReachCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || "Awaiting inputs";
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyReachStatusTone(text);
  if (tone !== "neutral") {
    badge.classList.add(`fpe-status-pill--${tone}`);
  }
}

function deriveReachWeeklyCardStatus(weekly) {
  const pace = String(weekly?.paceStatus || "").trim();
  if (!pace || pace === "—" || /needs inputs/i.test(pace)) {
    return "Awaiting inputs";
  }
  if (/behind/i.test(pace)) {
    return "Gap open";
  }
  if (/pace|feasible/i.test(pace)) {
    return "Feasible";
  }
  return pace;
}

function deriveReachLeversCardStatus(levers, weekly) {
  const hasLevers = Array.isArray(levers?.rows) && levers.rows.length > 0;
  if (!hasLevers) {
    return "Awaiting inputs";
  }
  const pace = String(weekly?.paceStatus || "").trim();
  if (/behind/i.test(pace)) {
    return "Gap focus";
  }
  if (/pace|feasible/i.test(pace)) {
    return "Buffer mode";
  }
  return "Active";
}

function deriveReachActionsCardStatus(actions) {
  const note = String(actions?.note || "").trim();
  const list = Array.isArray(actions?.list) ? actions.list : [];
  if (!list.length) {
    return "Awaiting inputs";
  }
  if (/drift-aware/i.test(note)) {
    return "Drift-aware";
  }
  if (/model-based/i.test(note)) {
    return "Model-based";
  }
  return "Active";
}

function classifyReachStatusTone(text) {
  const lower = String(text || "").trim().toLowerCase();
  if (!lower) {
    return "neutral";
  }
  if (
    /(on pace|feasible|buffer mode|ready|healthy|stable|complete|active|model-based)/.test(lower)
  ) {
    return "ok";
  }
  if (/(behind|gap open|unavailable|missing|incomplete|failed|broken)/.test(lower)) {
    return "bad";
  }
  if (/(awaiting|drift|needs|warning|risk|pending|override|gap focus)/.test(lower)) {
    return "warn";
  }
  return "neutral";
}
