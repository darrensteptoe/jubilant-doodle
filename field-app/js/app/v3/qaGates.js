import { V3_STAGE_REGISTRY } from "./stageRegistry.js";
import { getActiveStageId, mountStage } from "./stageMount.js";

const STAGE_EXPECTATIONS = {
  district: ["#v3DistrictUniverse", "#raceType", "#universeSize", "#turnoutA"],
  reach: ["#v3ReachGoal", "#wkGoal", "#wkCapacityPerWeek"],
  outcome: ["#v3OutcomeWinProb", "#mcWinProb-sidebar", "#mcP50"],
  turnout: ["#v3TurnoutSummary", "#turnoutSummary", "#roiTbody"],
  plan: ["#v3PlanExecutable", "#tlPercent", "#outShiftsPerWeek"],
  controls: [
    "#v3ControlsWorkflowStatus",
    "#v3IntelScenarioLocked",
    "#intelWorkflowStatus",
    "#censusStatus"
  ],
  scenarios: [
    "#v3ScenarioActive",
    "#v3ScenarioSelect",
    "#v3BtnScenarioSaveNew",
    "#activeScenarioLabel",
    "#scmCompareWrap"
  ],
  "decision-log": ["#v3DecisionActiveSession", "#decisionActiveLabel", "#decisionSummaryPreview"],
  data: [
    "#v3DataStrictImport",
    "#v3DataStrictToggle",
    "#v3DataBtnSaveJson",
    "#toggleStrictImport",
    "#usbStorageStatus"
  ]
};

export function runV3QaSmoke({ restoreStage = true, logToConsole = true } = {}) {
  const startedAt = Date.now();
  const originalStage = getActiveStageId();
  const checks = [];
  let duplicateIds = [];

  recordCheck(checks, "v3-root-mounted", isTruthy(document.getElementById("app-shell-v3-root")));
  recordCheck(checks, "v3-surface-mount", isTruthy(document.getElementById("v3SurfaceMount")));
  recordCheck(checks, "v3-kpi-strip", isTruthy(document.getElementById("v3KpiStrip")));
  recordCheck(checks, "v3-right-rail-slot", isTruthy(document.getElementById("v3RightRailSlot")));
  recordCheck(
    checks,
    "legacy-right-rail-present",
    isTruthy(document.querySelector("#v3RightRailSlot .results-sidebar-new"))
  );

  for (const stage of V3_STAGE_REGISTRY) {
    mountStage(stage.id);

    const pane = document.querySelector(`.fpe-surface-pane[data-v3-stage="${stage.id}"]`);
    const nav = document.querySelector(`.fpe-nav__item[data-v3-stage="${stage.id}"]`);
    const title = document.getElementById("v3PageTitle");

    recordCheck(checks, `${stage.id}:pane-mounted`, isTruthy(pane));
    recordCheck(checks, `${stage.id}:pane-visible`, isTruthy(pane && !pane.hidden));
    recordCheck(
      checks,
      `${stage.id}:nav-active`,
      isTruthy(nav && nav.classList.contains("is-active"))
    );
    recordCheck(
      checks,
      `${stage.id}:title-matches`,
      isTruthy(title && title.textContent && title.textContent.trim() === stage.pageTitle)
    );
    recordCheck(checks, `${stage.id}:has-card`, isTruthy(pane && pane.querySelector(".fpe-card")));
    recordCheck(checks, `${stage.id}:has-why-panel`, isTruthy(pane && pane.querySelector(".fpe-why")));

    const expected = STAGE_EXPECTATIONS[stage.id] || [];
    for (const selector of expected) {
      recordCheck(
        checks,
        `${stage.id}:selector:${selector}`,
        isTruthy(document.querySelector(selector))
      );
    }
  }

  duplicateIds = findDuplicateIds();
  recordCheck(checks, "dom:no-duplicate-ids", duplicateIds.length === 0);

  if (restoreStage && originalStage) {
    mountStage(originalStage);
    recordCheck(checks, "restore-stage", getActiveStageId() === originalStage);
  }

  const failed = checks.filter((check) => !check.pass);
  const report = {
    pass: failed.length === 0,
    failedCount: failed.length,
    totalChecks: checks.length,
    checks,
    duplicateIds,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt
  };

  if (logToConsole) {
    logQaReport(report);
  }

  return report;
}

export function installV3QaSmokeBridge() {
  window.runV3QaSmoke = (options) => runV3QaSmoke(options);
}

function recordCheck(checks, name, pass) {
  checks.push({ name, pass: Boolean(pass) });
}

function isTruthy(value) {
  return Boolean(value);
}

function logQaReport(report) {
  const label = `[v3-qa] ${report.pass ? "PASS" : "FAIL"} (${report.totalChecks - report.failedCount}/${report.totalChecks}) in ${report.durationMs}ms`;
  if (report.pass) {
    console.info(label);
  } else {
    console.error(label);
  }

  if (typeof console.table === "function") {
    console.table(
      report.checks.map((check) => ({
        check: check.name,
        status: check.pass ? "pass" : "fail"
      }))
    );
  }

  if (report.duplicateIds.length) {
    console.warn("[v3-qa] duplicate IDs detected:", report.duplicateIds);
  }
}

function findDuplicateIds() {
  const counts = new Map();
  document.querySelectorAll("[id]").forEach((el) => {
    const id = el.id;
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}
