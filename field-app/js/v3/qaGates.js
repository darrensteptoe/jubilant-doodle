import { V3_STAGE_REGISTRY } from "./stageRegistry.js";
import { getActiveStageId, mountStage } from "./stageMount.js";

const STAGE_EXPECTATIONS = {
  district: [
    "#v3DistrictUniverse",
    "#v3BtnAddCandidate",
    "#v3DistrictElectorateWeightingToggle",
    "#v3CensusStatus",
    "#v3CensusAggregateTbody",
    "#v3CensusAdvisoryTbody",
    "#v3CensusMapShell",
    "#v3DistrictTargetingStatus",
    "#v3BtnDistrictRunTargeting",
    "#v3DistrictTargetingResultsTbody",
    "#v3DistrictRaceType",
    "#v3DistrictUniverseSize",
    "#v3DistrictTurnoutA"
  ],
  reach: [
    "#v3ReachGoal",
    "#v3ReachPersuasionPct",
    "#v3ReachSupportRatePct",
    "#v3ReachCapOverrideEnabled",
    "#v3ReachOutlookTbody",
    "#v3ReachLeversTbody"
  ],
  outcome: [
    "#v3OutcomeWinProb",
    "#v3OutcomeOrgCount",
    "#v3OutcomeMcMode",
    "#v3OutcomeMcVolatility",
    "#v3OutcomeTurnoutReliabilityPct",
    "#v3OutcomeConfMargins",
    "#v3OutcomeSensitivityTbody",
    "#v3OutcomeSurfaceTbody",
    "#v3OutcomeImpactTraceList",
    "#v3BtnOutcomeRun",
    "#v3BtnComputeSurface",
    "#v3OutcomeForecastWinProb"
  ],
  turnout: [
    "#v3TurnoutSummary",
    "#v3TurnoutBaselinePct",
    "#v3TurnoutMode",
    "#v3TurnoutDiminishingToggle",
    "#v3TurnoutStatusBanner",
    "#v3TurnoutRoiBanner",
    "#v3TurnoutRoiTbody",
    "#v3RoiDoorsEnabled",
    "#v3RoiOverheadAmount",
    "#v3BtnRoiRefresh",
    "#v3TurnoutEnabledToggle",
    "#v3TurnoutImpactMargin"
  ],
  plan: [
    "#v3PlanGoalSupportIds",
    "#v3PlanOptMode",
    "#v3PlanTimelineActiveWeeks",
    "#v3PlanExecutable",
    "#v3PlanWorkloadBanner",
    "#v3PlanOptBanner",
    "#v3PlanTimelineBanner",
    "#v3PlanOptAllocTbody",
    "#v3PlanSummaryShiftsPerWeek",
    "#v3PlanSummaryVolunteersNeeded",
    "#v3PlanSummaryExecutable",
    "#v3PlanSummaryConstraint",
    "#v3PlanSummaryBinding",
    "#v3PlanSummaryGapContext",
    "#v3BtnOptRun",
    "#v3PlanTimelineEnabledToggle",
    "#v3PlanWeekList"
  ],
  controls: [
    "#v3ControlsWorkflowStatus",
    "#v3ControlsBenchmarkCount",
    "#v3ControlsMissingEvidence",
    "#v3ControlsCalibrationStatus",
    "#v3ControlsRecommendationCount",
    "#v3IntelBenchmarkTbody",
    "#v3IntelEvidenceTbody",
    "#v3IntelScenarioLocked",
    "#v3IntelBenchmarkRef",
    "#v3IntelAuditSelect",
    "#v3IntelBriefKind",
    "#v3BtnIntelCaptureObserved",
    "#v3IntelWorkflowStatus",
    "#v3IntelCalibrationStatus"
  ],
  scenarios: [
    "#v3ScenarioActive",
    "#v3ScenarioSelect",
    "#v3ScenarioWarningStatus",
    "#v3ScenarioStorageStatus",
    "#v3ScenarioDiffInputs",
    "#v3ScenarioDiffOutputs",
    "#v3BtnScenarioSaveNew",
    "#v3ScenarioActiveLabel"
  ],
  "decision-log": [
    "#v3DecisionActiveSession",
    "#v3DecisionSessionSelect",
    "#v3DecisionRecommendSelect",
    "#v3BtnDecisionSensRun",
    "#v3DecisionDriftTag",
    "#v3DecisionBneckTbody",
    "#v3DecisionSensTbody",
    "#v3DecisionObjectiveSummary",
    "#v3DecisionRecommended",
    "#v3DecisionConfidence",
    "#v3DecisionRisk",
    "#v3DecisionBottleneck",
    "#v3DecisionSummaryPreview",
    "#v3DecisionActiveLabel"
  ],
  data: [
    "#v3DataStrictImport",
    "#v3DataStrictToggle",
    "#v3DataRestoreSelection",
    "#v3DataImportFileSummary",
    "#v3DataBtnSaveJson",
    "#v3DataUsbStatus",
    "#v3DataHashBanner"
  ]
};
const STAGES_EXPECTING_NO_LEGACY_BRIDGE = new Set([
  "reach",
  "outcome",
  "turnout",
  "plan",
  "scenarios",
  "decision-log",
  "data"
]);

export function runV3QaSmoke({ restoreStage = true, logToConsole = true } = {}) {
  const startedAt = Date.now();
  const originalStage = getActiveStageId();
  const checks = [];
  let duplicateIds = [];

  recordCheck(checks, "v3-root-mounted", isTruthy(document.getElementById("app-shell-v3-root")));
  recordCheck(checks, "v3-surface-mount", isTruthy(document.getElementById("v3SurfaceMount")));
  recordCheck(checks, "v3-kpi-strip", isTruthy(document.getElementById("v3KpiStrip")));
  recordCheck(checks, "v3-right-rail-slot", isTruthy(document.getElementById("v3RightRailSlot")));
  recordCheck(checks, "legacy-shell-hidden", isTruthy(document.getElementById("app-shell-legacy")?.hidden));
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
        isTruthy(isSelectorInPane(pane, selector))
      );
    }

    if (pane instanceof HTMLElement) {
      const expectsNoLegacyBridge = STAGES_EXPECTING_NO_LEGACY_BRIDGE.has(stage.id);
      const bridgedControls = Array.from(pane.querySelectorAll("[data-v3-legacy-id]"));
      recordCheck(
        checks,
        `${stage.id}:bridge-control-count`,
        expectsNoLegacyBridge ? bridgedControls.length === 0 : bridgedControls.length > 0
      );
      const missingBridgeTargets = bridgedControls.filter((el) => {
        if (!(el instanceof HTMLElement)) {
          return false;
        }
        const legacyId = el.dataset.v3LegacyId;
        if (!legacyId) {
          return false;
        }
        return !document.getElementById(legacyId);
      });
      recordCheck(
        checks,
        `${stage.id}:bridge-targets-exist`,
        expectsNoLegacyBridge ? true : missingBridgeTargets.length === 0
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

function isSelectorInPane(pane, selector) {
  if (!(pane instanceof HTMLElement) || !selector) {
    return false;
  }

  const idMatch = selector.match(/^#([A-Za-z0-9_-]+)$/);
  if (idMatch) {
    const el = document.getElementById(idMatch[1]);
    return !!el && pane.contains(el);
  }

  const el = pane.querySelector(selector);
  return !!el;
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
