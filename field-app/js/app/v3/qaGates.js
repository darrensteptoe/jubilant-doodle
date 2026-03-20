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
export function runV3QaSmoke({
  restoreStage = true,
  logToConsole = true,
  includeLegacyRetirement = false
} = {}) {
  const startedAt = Date.now();
  const originalStage = getActiveStageId();
  const checks = [];
  let duplicateIds = [];
  const legacyShellRoot = getLegacyShellRoot();

  recordCheck(checks, "v3-root-mounted", isTruthy(document.getElementById("app-shell-v3-root")));
  recordCheck(checks, "v3-surface-mount", isTruthy(document.getElementById("v3SurfaceMount")));
  recordCheck(checks, "v3-kpi-strip", isTruthy(document.getElementById("v3KpiStrip")));
  recordCheck(checks, "v3-right-rail-slot", isTruthy(document.getElementById("v3RightRailSlot")));
  recordCheck(checks, "legacy-shell-wrapper-retired", isTruthy(!document.getElementById("legacyShellRoot")));
  recordCheck(checks, "legacy-dom-pool-present", isTruthy(document.getElementById("legacyDomPool")));
  recordCheck(checks, "legacy-switch-button-retired", isTruthy(!document.getElementById("v3SwitchLegacy")));
  recordCheck(
    checks,
    "legacy-shell-absent-or-hidden",
    isTruthy(!legacyShellRoot || legacyShellRoot.hidden)
  );
  let uiMode = "unknown";
  try {
    const getMode = window.__FPE_GET_UI_MODE__;
    if (typeof getMode === "function") {
      uiMode = String(getMode() || "");
    }
  } catch {}
  recordCheck(checks, "legacy-ui-mode-retired", isTruthy(uiMode === "v3"));
  recordCheck(
    checks,
    "legacy-inline-shell-hook-retired",
    isTruthy(typeof window.__FPE_INIT_LEGACY_INLINE_SHELL__ !== "function")
  );
  recordCheck(
    checks,
    "legacy-right-rail-hooks-retired",
    isTruthy(
      typeof window.__FPE_MOVE_LEGACY_RIGHT_RAIL_TO_HOST__ !== "function"
      && typeof window.__FPE_ATTACH_LEGACY_RIGHT_RAIL_TO_SLOT__ !== "function"
      && typeof window.__FPE_GET_LEGACY_RIGHT_RAIL__ !== "function"
    )
  );
  recordCheck(
    checks,
    "legacy-compat-node-hook-retired",
    isTruthy(typeof window.__FPE_GET_LEGACY_COMPAT_NODE__ !== "function")
  );
  recordCheck(
    checks,
    "legacy-shell-action-host-retired",
    isTruthy(!document.getElementById("legacyShellActionHost"))
  );
  recordCheck(checks, "shell-bridge-api", hasBridgeGetter("__FPE_SHELL_API__"));
  recordCheck(checks, "training-toggle-roundtrip", isTruthy(verifyTrainingToggleRoundTrip()));
  recordCheck(checks, "district-bridge-api", hasBridgeGetter("__FPE_DISTRICT_API__"));
  recordCheck(checks, "census-runtime-bridge-api", hasBridgeGetter("__FPE_CENSUS_RUNTIME_API__"));
  const censusRuntimeApi = window.__FPE_CENSUS_RUNTIME_API__ || {};
  recordCheck(
    checks,
    "census-runtime-bridge-actions",
    isTruthy(
      typeof censusRuntimeApi.setField === "function"
      && typeof censusRuntimeApi.setGeoSelection === "function"
      && typeof censusRuntimeApi.setFile === "function"
      && typeof censusRuntimeApi.triggerAction === "function"
    )
  );
  recordCheck(checks, "reach-bridge-api", hasBridgeGetter("__FPE_REACH_API__"));
  recordCheck(checks, "turnout-bridge-api", hasBridgeGetter("__FPE_TURNOUT_API__"));
  recordCheck(checks, "plan-bridge-api", hasBridgeGetter("__FPE_PLAN_API__"));
  recordCheck(checks, "outcome-bridge-api", hasBridgeGetter("__FPE_OUTCOME_API__"));
  recordCheck(checks, "decision-bridge-api", hasBridgeGetter("__FPE_DECISION_API__"));
  recordCheck(checks, "data-bridge-api", hasBridgeGetter("__FPE_DATA_API__"));
  recordCheck(checks, "legacy-census-card-node", isTruthy(document.getElementById("censusPhase1Card")));
  recordCheck(checks, "legacy-training-toggle-node", isTruthy(document.getElementById("toggleTraining")));
  recordCheck(checks, "legacy-right-rail-node", isTruthy(document.getElementById("legacyResultsSidebar")));
  recordCheck(checks, "legacy-setup-seed-present", isTruthy(document.getElementById("legacySetupSourceSeed")));
  recordCheck(checks, "legacy-checks-seed-present", isTruthy(document.getElementById("legacyChecksSourceSeed")));
  recordCheck(
    checks,
    "legacy-setup-compose-hook-retired",
    isTruthy(typeof window.__FPE_COMPOSE_LEGACY_SETUP_STAGE__ !== "function")
  );
  recordCheck(
    checks,
    "legacy-census-card-detached",
    isTruthy(document.getElementById("censusPhase1Card")?.parentElement !== legacyShellRoot)
  );
  recordCheck(
    checks,
    "legacy-training-toggle-detached",
    isTruthy(document.getElementById("toggleTraining")?.parentElement !== legacyShellRoot)
  );
  recordCheck(
    checks,
    "legacy-right-rail-detached",
    isTruthy(document.getElementById("legacyResultsSidebar")?.parentElement !== legacyShellRoot)
  );
  recordCheck(
    checks,
    "legacy-setup-seed-detached",
    isTruthy(document.getElementById("legacySetupSourceSeed")?.parentElement !== legacyShellRoot)
  );
  recordCheck(
    checks,
    "legacy-checks-seed-detached",
    isTruthy(document.getElementById("legacyChecksSourceSeed")?.parentElement !== legacyShellRoot)
  );
  recordCheck(
    checks,
    "legacy-universe-source-mounted",
    isTruthy(document.querySelector("#legacySetupSourceSeed #universeCard"))
  );
  recordCheck(
    checks,
    "legacy-ballot-source-mounted",
    isTruthy(document.querySelector("#legacySetupSourceSeed #ballotBaselineCard"))
  );
  recordCheck(
    checks,
    "legacy-turnout-source-mounted",
    isTruthy(document.querySelector("#legacySetupSourceSeed #turnoutBaselineCard"))
  );
  recordCheck(
    checks,
    "legacy-census-card-present",
    isTruthy(document.getElementById("censusPhase1Card"))
  );
  recordCheck(
    checks,
    "legacy-training-toggle-present",
    isTruthy(document.getElementById("toggleTraining"))
  );
  recordCheck(
    checks,
    "legacy-setup-bridge-unmounted",
    isTruthy(!document.getElementById("stage-setup"))
  );
  recordCheck(
    checks,
    "legacy-universe-bridge-unmounted",
    isTruthy(!document.getElementById("stage-universe"))
  );
  recordCheck(
    checks,
    "legacy-ballot-bridge-unmounted",
    isTruthy(!document.getElementById("stage-ballot"))
  );
  recordCheck(
    checks,
    "legacy-structure-bridge-unmounted",
    isTruthy(!document.getElementById("stage-structure"))
  );
  recordCheck(
    checks,
    "legacy-structure-stage-absent-or-retired",
    isTruthy(
      !document.getElementById("stage-structure")
      || document.getElementById("stage-structure")?.hidden
      || document.getElementById("stage-structure")?.getAttribute("data-retired") === "true"
    )
  );
  recordCheck(
    checks,
    "legacy-checks-bridge-unmounted",
    isTruthy(!document.getElementById("stage-checks"))
  );
  recordCheck(
    checks,
    "legacy-targeting-bridge-mounted",
    isTruthy(document.getElementById("targetingLabCard"))
  );
  recordCheck(
    checks,
    "legacy-setup-stage-absent-or-retired",
    isTruthy(
      !document.getElementById("stage-setup")
      || document.getElementById("stage-setup")?.hidden
      || document.getElementById("stage-setup")?.getAttribute("data-retired") === "true"
    )
  );
  recordCheck(
    checks,
    "legacy-setup-stage-pruned",
    isTruthy(!document.getElementById("stage-setup"))
  );
  recordCheck(
    checks,
    "legacy-universe-stage-absent-or-retired",
    isTruthy(
      !document.getElementById("stage-universe")
      || document.getElementById("stage-universe")?.hidden
      || document.getElementById("stage-universe")?.getAttribute("data-retired") === "true"
    )
  );
  recordCheck(
    checks,
    "legacy-ballot-stage-absent-or-retired",
    isTruthy(
      !document.getElementById("stage-ballot")
      || document.getElementById("stage-ballot")?.hidden
      || document.getElementById("stage-ballot")?.getAttribute("data-retired") === "true"
    )
  );
  recordCheck(
    checks,
    "legacy-universe-stage-pruned",
    isTruthy(!document.getElementById("stage-universe"))
  );
  recordCheck(
    checks,
    "legacy-ballot-stage-pruned",
    isTruthy(!document.getElementById("stage-ballot"))
  );
  recordCheck(
    checks,
    "legacy-universe-stage-no-controls",
    isTruthy(
      !document.getElementById("stage-universe")
      || !document.getElementById("stage-universe")?.querySelector("input, select, textarea, table, button")
    )
  );
  recordCheck(
    checks,
    "legacy-ballot-stage-no-controls",
    isTruthy(
      !document.getElementById("stage-ballot")
      || !document.getElementById("stage-ballot")?.querySelector("input, select, textarea, table, button")
    )
  );
  recordCheck(
    checks,
    "legacy-checks-stage-absent-or-retired",
    isTruthy(
      !document.getElementById("stage-checks")
      || document.getElementById("stage-checks")?.hidden
      || document.getElementById("stage-checks")?.getAttribute("data-retired") === "true"
    )
  );
  recordCheck(
    checks,
    "legacy-checks-stage-pruned",
    isTruthy(!document.getElementById("stage-checks"))
  );
  recordCheck(
    checks,
    "legacy-right-rail-present",
    isTruthy(
      document.querySelector("#v3RightRailSlot .results-sidebar-new")
      || document.querySelector("#v3RightRailSlot #v3IntelligencePanel")
    )
  );
  recordCheck(
    checks,
    "right-rail-toggle-present",
    isTruthy(document.getElementById("v3RightRailToggle"))
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
      const districtExplainerSelectors = [
        '[data-district-explainer="v3DistrictRaceType"]',
        '[data-district-explainer="v3DistrictUniverseSize"]',
        '[data-district-explainer="v3DistrictUndecidedPct"]',
        '[data-district-explainer="v3DistrictTurnoutA"]',
        '[data-district-explainer="v3DistrictTurnoutB"]',
        '[data-district-explainer="v3DistrictBandWidth"]',
        '[data-district-explainer="v3DistrictRetentionFactor"]',
        '[data-district-explainer="v3DistrictTargetingTopN"]',
        '[data-district-explainer="v3DistrictTargetingMinScore"]',
        '[data-district-explainer="v3CensusStateFips"]',
        '[data-district-explainer="v3CensusCountyFips"]',
      ];
      recordCheck(
        checks,
        "district:legacy-training-panels-retired",
        isTruthy(!isSelectorInPane(pane, ".training-panel-new"))
      );
      recordCheck(
        checks,
        "district:input-explainers-present",
        districtExplainerSelectors.every((selector) => isSelectorInPane(pane, selector))
      );
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
      const bridgedControls = Array.from(pane.querySelectorAll("[data-v3-legacy-id]"));
      recordCheck(
        checks,
        `${stage.id}:bridge-control-count`,
        bridgedControls.length === 0
      );
    }
  }

  duplicateIds = findDuplicateIds();
  recordCheck(checks, "dom:no-duplicate-ids", duplicateIds.length === 0);

  if (restoreStage && originalStage) {
    mountStage(originalStage);
    recordCheck(checks, "restore-stage", getActiveStageId() === originalStage);
  }

  const stableChecks = checks.filter((check) => !isLegacyRetirementCheckName(check.name));
  const legacyChecks = checks.filter((check) => isLegacyRetirementCheckName(check.name));
  const effectiveChecks = includeLegacyRetirement ? checks : stableChecks;
  const failed = effectiveChecks.filter((check) => !check.pass);
  const stableFailed = stableChecks.filter((check) => !check.pass);
  const legacyFailed = legacyChecks.filter((check) => !check.pass);
  const report = {
    pass: failed.length === 0,
    failedCount: failed.length,
    totalChecks: effectiveChecks.length,
    checks: effectiveChecks,
    sections: {
      stable: {
        pass: stableFailed.length === 0,
        failedCount: stableFailed.length,
        totalChecks: stableChecks.length,
      },
      legacyRetirement: {
        included: includeLegacyRetirement,
        pass: legacyFailed.length === 0,
        failedCount: legacyFailed.length,
        totalChecks: legacyChecks.length,
      }
    },
    skippedLegacyChecks: includeLegacyRetirement ? [] : legacyChecks.map((check) => check.name),
    duplicateIds,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt
  };

  if (logToConsole) {
    logQaReport(report);
  }

  return report;
}

export function runV3LegacyRetirementSmoke(options = {}) {
  return runV3QaSmoke({ ...options, includeLegacyRetirement: true });
}

function getLegacyShellRoot() {
  return document.querySelector('[data-legacy-shell-root="true"]');
}

export function installV3QaSmokeBridge() {
  window.runV3QaSmoke = (options) => runV3QaSmoke(options);
  window.runV3LegacyRetirementSmoke = (options) => runV3LegacyRetirementSmoke(options);
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

function verifyTrainingToggleRoundTrip() {
  try {
    const shell = window?.__FPE_SHELL_API__;
    if (!shell || typeof shell.getView !== "function" || typeof shell.setTrainingEnabled !== "function") {
      return false;
    }
    const toggle = document.getElementById("toggleTraining");
    const originalEnabled = !!shell.getView()?.trainingEnabled;
    const nextEnabled = !originalEnabled;

    shell.setTrainingEnabled(nextEnabled);
    const toggledEnabled = !!shell.getView()?.trainingEnabled;
    const toggledBodyClass = document.body.classList.contains("training") === nextEnabled;
    const toggledInput = toggle instanceof HTMLInputElement ? toggle.checked === nextEnabled : true;

    shell.setTrainingEnabled(originalEnabled);
    const restoredEnabled = !!shell.getView()?.trainingEnabled;
    const restoredBodyClass = document.body.classList.contains("training") === originalEnabled;
    const restoredInput = toggle instanceof HTMLInputElement ? toggle.checked === originalEnabled : true;

    return (
      toggledEnabled === nextEnabled
      && toggledBodyClass
      && toggledInput
      && restoredEnabled === originalEnabled
      && restoredBodyClass
      && restoredInput
    );
  } catch {
    return false;
  }
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

function isLegacyRetirementCheckName(name) {
  return String(name || "").startsWith("legacy-");
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

  const legacySummary = report?.sections?.legacyRetirement;
  if (legacySummary && legacySummary.included === false && legacySummary.totalChecks > 0) {
    console.info(
      `[v3-qa] legacy-retirement checks skipped (run runV3LegacyRetirementSmoke for ${legacySummary.totalChecks} transitional checks)`
    );
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
