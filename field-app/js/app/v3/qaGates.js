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
  "controls",
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
  recordCheck(checks, "district-bridge-api", hasBridgeGetter("__FPE_DISTRICT_API__"));
  recordCheck(checks, "reach-bridge-api", hasBridgeGetter("__FPE_REACH_API__"));
  recordCheck(checks, "turnout-bridge-api", hasBridgeGetter("__FPE_TURNOUT_API__"));
  recordCheck(checks, "plan-bridge-api", hasBridgeGetter("__FPE_PLAN_API__"));
  recordCheck(checks, "outcome-bridge-api", hasBridgeGetter("__FPE_OUTCOME_API__"));
  recordCheck(checks, "decision-bridge-api", hasBridgeGetter("__FPE_DECISION_API__"));
  recordCheck(checks, "data-bridge-api", hasBridgeGetter("__FPE_DATA_API__"));
  recordCheck(checks, "legacy-census-bridge-host", isTruthy(document.getElementById("legacyCensusBridgeHost")));
  recordCheck(
    checks,
    "legacy-census-bridge-mounted",
    isTruthy(document.querySelector("#legacyCensusBridgeHost #censusPhase1Card"))
  );
  recordCheck(
    checks,
    "legacy-setup-bridge-mounted",
    isTruthy(document.querySelector("#legacyCensusBridgeHost #stage-setup"))
  );
  recordCheck(
    checks,
    "legacy-universe-bridge-mounted",
    isTruthy(document.querySelector("#legacyCensusBridgeHost #stage-universe"))
  );
  recordCheck(
    checks,
    "legacy-ballot-bridge-mounted",
    isTruthy(document.querySelector("#legacyCensusBridgeHost #stage-ballot"))
  );
  recordCheck(
    checks,
    "legacy-structure-bridge-mounted",
    isTruthy(document.querySelector("#legacyCensusBridgeHost #stage-structure"))
  );
  recordCheck(
    checks,
    "legacy-targeting-bridge-mounted",
    isTruthy(document.querySelector("#legacyCensusBridgeHost #targetingLabCard"))
  );
  recordCheck(
    checks,
    "legacy-setup-stage-hidden",
    isTruthy(document.getElementById("stage-setup")?.hidden)
  );
  recordCheck(
    checks,
    "legacy-universe-stage-hidden",
    isTruthy(document.getElementById("stage-universe")?.hidden)
  );
  recordCheck(
    checks,
    "legacy-ballot-stage-hidden",
    isTruthy(document.getElementById("stage-ballot")?.hidden)
  );
  recordCheck(
    checks,
    "legacy-checks-stage-hidden",
    isTruthy(document.getElementById("stage-checks")?.hidden)
  );
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

    if (stage.id === "controls") {
      recordCheck(
        checks,
        "controls:mc-distribution-options",
        hasSelectOptionValue("v3IntelMcDistribution", "triangular")
        && hasSelectOptionValue("v3IntelMcDistribution", "uniform")
        && hasSelectOptionValue("v3IntelMcDistribution", "normal")
      );
      recordCheck(
        checks,
        "controls:decay-model-options",
        hasSelectOptionValue("v3IntelDecayModelType", "linear")
      );
      recordCheck(
        checks,
        "controls:correlation-select-placeholder",
        hasSelectOptionValue("v3IntelCorrelationMatrixId", "")
      );
    }

    if (stage.id === "district") {
      const districtView = readBridgeView("__FPE_DISTRICT_API__");
      recordCheck(
        checks,
        "district:bridge-view-summary",
        isTruthy(districtView && typeof districtView.summary === "object")
      );
      const summary = districtView?.summary || {};
      recordCheck(
        checks,
        "district:bridge-summary-keys",
        isTruthy(
          hasNonEmpty(summary.universeText)
          && hasNonEmpty(summary.baselineSupportText)
          && hasNonEmpty(summary.turnoutExpectedText)
          && hasNonEmpty(summary.turnoutBandText)
          && hasNonEmpty(summary.votesPer1pctText)
          && hasNonEmpty(summary.projectedVotesText)
          && hasNonEmpty(summary.persuasionNeedText)
        )
      );
      const districtForm = districtView?.form || {};
      const districtFormValues = districtForm?.values || {};
      const districtFormOptions = districtForm?.options || {};
      recordCheck(
        checks,
        "district:bridge-form-config",
        isTruthy(
          hasNonEmpty(districtFormValues.raceType)
          && Object.prototype.hasOwnProperty.call(districtFormValues, "universeSize")
          && Array.isArray(districtFormOptions.raceTypeOptions)
          && Array.isArray(districtFormOptions.yourCandidateOptions)
        )
      );
      const targeting = districtView?.targeting || {};
      const targetingConfig = targeting?.config || {};
      recordCheck(
        checks,
        "district:bridge-targeting-config",
        isTruthy(
          hasNonEmpty(targetingConfig.modelId)
          && hasNonEmpty(targetingConfig.geoLevel)
          && Number.isFinite(Number(targetingConfig.topN))
        )
      );
      const districtApi = window.__FPE_DISTRICT_API__ || {};
      recordCheck(
        checks,
        "district:bridge-targeting-actions",
        isTruthy(
          typeof districtApi.setFormField === "function"
          && typeof districtApi.addCandidate === "function"
          typeof districtApi.setTargetingField === "function"
          && typeof districtApi.applyTargetingPreset === "function"
          && typeof districtApi.resetTargetingWeights === "function"
          && typeof districtApi.runTargeting === "function"
          && typeof districtApi.exportTargetingCsv === "function"
          && typeof districtApi.exportTargetingJson === "function"
        )
      );
      const census = districtView?.census || {};
      const censusConfig = census?.config || {};
      recordCheck(
        checks,
        "district:bridge-census-keys",
        isTruthy(
          hasNonEmpty(census.statusText)
          && hasNonEmpty(census.geoStatsText)
          && hasNonEmpty(census.selectionSummaryText)
        )
      );
      recordCheck(
        checks,
        "district:bridge-census-tables",
        isTruthy(
          Array.isArray(census.aggregateRows)
          && Array.isArray(census.advisoryRows)
          && Array.isArray(census.electionPreviewRows)
        )
      );
      recordCheck(
        checks,
        "district:bridge-census-config-inputs",
        isTruthy(
          censusConfig
          && Object.prototype.hasOwnProperty.call(censusConfig, "apiKey")
          && Object.prototype.hasOwnProperty.call(censusConfig, "geoPaste")
          && Object.prototype.hasOwnProperty.call(censusConfig, "electionCsvPrecinctFilter")
        )
      );
      recordCheck(
        checks,
        "district:bridge-census-disabled-map",
        isTruthy(
          censusConfig
          && censusConfig.disabledMap
          && typeof censusConfig.disabledMap === "object"
          && Object.keys(censusConfig.disabledMap).length > 0
        )
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

function hasNonEmpty(value) {
  const text = String(value == null ? "" : value).trim();
  return text.length > 0;
}

function hasBridgeGetter(key) {
  const bridge = window?.[key];
  return !!bridge && typeof bridge.getView === "function";
}

function readBridgeView(key) {
  try {
    const bridge = window?.[key];
    if (!bridge || typeof bridge.getView !== "function") {
      return null;
    }
    return bridge.getView();
  } catch {
    return null;
  }
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

function hasSelectOptionValue(id, value) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return false;
  }
  return Array.from(el.options).some((opt) => String(opt.value) === String(value));
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
