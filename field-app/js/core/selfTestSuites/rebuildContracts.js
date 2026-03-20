// @ts-check

import {
  applyTemplateDefaultsToState,
  getTemplateRecord,
  makeDefaultTemplateMeta,
  syncTemplateMetaFromState,
} from "../../app/templateResolver.js";
import {
  clearCensusRowsForKey,
  getCensusRowsForState,
  setCensusRowsForKey,
} from "../../app/censusRowsRuntimeStore.js";
import {
  VOTER_LAYER_SCOPING_RULE,
  buildVoterImportOutcomeView,
  buildVoterLayerStatusSnapshot,
  buildVoterContactHistoryLedger,
  deriveVoterModelSignals,
  formatVoterSourceRef,
  inferVoterInputFormat,
  buildVoterUniverseSummary,
  isMaterialCanonicalVoterField,
  normalizeVoterAdapterId,
  parseVoterRowsInput,
  listCanonicalVoterFieldTiers,
  normalizeVoterDataState,
  normalizeVoterRows,
} from "../voterDataLayer.js";
import { computeChannelCostMetrics, resolveChannelCostAssumption } from "../channelCosts.js";
import {
  BASE_RATE_DEFAULTS,
  NULL_BASE_RATE_DEFAULTS,
  resolveBaseRatesWithStateFallback,
  resolveStateBaseRates,
} from "../baseRates.js";
import {
  buildVolunteerCapacityFeasibility,
  buildVolunteerConversionSnapshot,
  computeGoalPaceRequirements,
  computeNeedVotePaceRequirements,
  computeProjectedSlipDays,
  computeRemainingAttempts,
  computeFinishDateFromDailyPace,
  computeVolunteerNeedFromGoal,
  computeVolunteerWorkloadFromGoal,
  computeWeeksToFinishAtPace,
} from "../executionPlanner.js";
import {
  deriveExecutionAttemptsFromLogEntry,
  computeExpectedAphFromWeeklyContext,
  computeRollingExecutionRates,
  summarizeExecutionDailyLog,
} from "../executionSnapshot.js";
import { computeBlendedAttemptsPerHour, computeCapacityContacts } from "../model.js";
import {
  benchmarkScopeLabel,
  benchmarkScopeToBenchmarkKey,
  benchmarkScopeToRaceType,
  listBenchmarkScopeOptions,
} from "../benchmarkProfiles.js";
import {
  buildTimelineCapsInputFromState,
  computeTimelineCapsSummary,
  computeTimelineCapsSummaryFromState,
  buildTimelineTacticKindsMapFromState,
  extractTimelineActiveWeeks,
  extractTimelineMaxAttemptsByTactic,
  normalizeTimelineCapsByTactic,
  sumTimelineCapsAttempts,
} from "../timelineCapsInput.js";
import {
  appendForecastArchiveEntry,
  buildForecastArchiveOptions,
  buildForecastArchiveContext,
  buildForecastArchiveSelectedEntryView,
  buildForecastArchiveMarginSummary,
  formatForecastArchiveRecordedAt,
  buildForecastArchiveTableRows,
  buildForecastArchiveEntry,
  makeForecastArchiveKey,
  normalizeForecastArchiveActual,
  readForecastArchive,
  resolveForecastArchiveSelectedHash,
  resolveForecastArchiveMargin,
  summarizeForecastArchive,
  updateForecastArchiveActual,
} from "../forecastArchive.js";
import { buildArchiveLearningSignals, buildModelLearningFromArchive, summarizeModelAuditFromArchive } from "../modelAudit.js";
import {
  makeOperationsContextKey,
  resolveOperationsOfficeField,
  resolveOperationsContext,
  resolveOperationsContextFromState,
  shouldLockOperationsOfficeField,
  summarizeOperationsContext,
  toOperationsStoreOptions,
  toOperationsStoreOptionsFromState,
} from "../../features/operations/context.js";
import {
  makeCampaignContextScopeKey,
  makeCampaignStoragePath,
  validateCampaignContext,
} from "../campaignContextManager.js";
import { resolveIntelligencePayload } from "../../app/intelligenceResolver.js";
import { getGlossaryTerm, normalizeGlossaryTermId } from "../../app/glossaryRegistry.js";
import { getMessageDefinition, normalizeMessageId } from "../../app/messageRegistry.js";
import { INTEL_SELECT_OPTION_MESSAGE_MAP, INTEL_WARNING_MESSAGE_BY_ID } from "../../app/intelligenceInteractions.js";
import {
  operationsAddDaysUTC,
  operationsClampNumber,
  operationsCombineDateAndTimeIso,
  operationsDaysSince,
  operationsFiniteNumber,
  operationsLocalTimeFromIso,
  operationsParseDate,
  operationsParseIsoDateInput,
  operationsShiftHours,
  operationsStartOfWeekUTC,
  operationsTransitionKey,
  operationsToIsoDateUTC,
} from "../../features/operations/time.js";
import {
  formatOperationsDateTime,
  formatOperationsFixed,
  formatOperationsOneDecimal,
  formatOperationsPercentInputValue,
  formatOperationsPercentFromUnit,
  formatOperationsWhole,
} from "../../features/operations/view.js";
import {
  applyTargetingRunResult,
  applyTargetingFieldPatch,
  buildTargetRankingPayloadConfig,
  buildTargetRankingExportFilename,
  buildTargetingRunCompleteStatus,
  countTopTargets,
  getTargetModelPreset,
  normalizeTargetRankingFileStamp,
  normalizeTargetRankingModelSlug,
  resetTargetingWeightsToPreset,
  TARGETING_STATUS_LOAD_ROWS_FIRST,
  TARGETING_STATUS_NO_MATCH,
} from "../../app/targetingRuntime.js";
import {
  applyTopDriftRecommendation,
  captureObservedAndRefreshDriftRecommendations,
  ensureIntelCollections,
  loadDefaultBenchmarksForRaceType,
  listAutoDriftRecommendations,
  listIntelBenchmarks,
  patchValuesEqual,
  resolveRecommendationForApply,
  upsertBenchmarkEntry,
} from "../../app/intelControlsRuntime.js";
import { applyActiveContextToLinks, applyContextToState, resolveActiveContext } from "../../app/activeContext.js";
import {
  buildAssumptionsApplyModeReasonLabel,
  buildAssumptionsApplyModeText,
  buildAssumptionsBandWidthText,
  buildAssumptionsFeasibilityText,
  buildAssumptionsSignalCoverageText,
  buildAssumptionsTurnoutCyclesText,
  buildAssumptionsWeeksText,
  formatAssumptionsBand,
  formatAssumptionsOneDecimal,
  formatAssumptionsPercent,
} from "../../app/assumptionsViewHelpers.js";
import { computeOperationalRollups } from "../../features/operations/rollups.js";
import {
  buildDriftValidationChecklist,
  buildGovernanceSnapshotView,
  buildGovernanceValidationChecklist,
  computeModelGovernance
} from "../modelGovernance.js";
import { buildValidationChecklistView } from "../validationView.js";
import { computeConfidenceProfile } from "../confidence.js";
import { computeLearningLoop } from "../learningLoop.js";
import {
  buildConfidenceStats as buildOutcomeConfidenceStats,
  buildOutcomeMcStatus,
  buildOutcomeRiskFramingView,
  buildMissRiskSummary,
  buildOutcomeCliff,
  buildOutcomeFragility,
  buildOutcomeRiskLabel,
  buildOutcomeSupportTotalText,
  buildOutcomeTurnoutBandText,
  buildOutcomeTurnoutExpectedText,
  buildOutcomeExpectedVoteTexts,
  buildOutcomeHistogramVisualView,
  buildOutcomeWinProbMarkerView,
  buildOutcomeSurfaceSummaryText,
  deriveGapFromNote,
  deriveOutcomeConfidenceCardStatus,
  deriveOutcomeForecastCardStatus,
  deriveOutcomeInterpretationCardStatus,
  deriveOutcomeRiskFlagsCardStatus,
  deriveOutcomeSensitivityCardStatus,
  deriveOutcomeSummaryCardStatus,
  OUTCOME_STATUS_AWAITING_RUN,
  classifyOutcomeStatusTone,
  formatOutcomeGovernanceSignal,
  formatOutcomeBridgeDecimal,
  formatOutcomeBridgeMargin,
  formatOutcomeBridgePercent,
  formatOutcomeBridgeWhole,
  formatOutcomeBridgeWinProb,
  formatOutcomePercentFromPct,
  formatOutcomeSvgCoord,
  formatOutcomeSensitivityImpact,
  deriveShiftFromMargin,
} from "../outcomeView.js";
import {
  buildPlanNumberFormatters,
  buildPlanOfficeBestText,
  buildPlanOfficePathTableRowsView,
  PLAN_OPTIMIZER_STATUS_FALLBACK,
  PLAN_OFFICE_PATH_TABLE_EMPTY,
  PLAN_TIMELINE_STATUS_FALLBACK,
  PLAN_WORKLOAD_STATUS_FALLBACK,
  buildPlanMarginalDiagnosticsRowsView,
  buildPlanOptimizerAllocationRowsView,
  buildPlanOptimizerInterpretationText,
  buildPlanOptimizerTotalsView,
  buildPlanRatePercentText,
  buildPlanSummaryView,
  buildPlanWeekPreviewText,
  buildPlanCostLevers,
  buildPlanDecisionWarning,
  derivePlanBindingText,
  formatPlanGoalFeasible,
  buildPlanOptimizerBanner,
  buildPlanProbabilityLevers,
  buildPlanRecommendationCost,
  buildPlanRecommendationProbability,
  buildPlanRecommendationVolunteers,
  buildPlanTimelineBanner,
  buildPlanVolunteerLevers,
  buildPlanWorkloadBanner,
  classifyPlanStatusTone,
  derivePlanActionsCardStatus,
  derivePlanOptimizerCardStatus,
  derivePlanRiskCardStatus,
  derivePlanSummaryCardStatus,
  derivePlanTimelineCardStatus,
  derivePlanWorkloadCardStatus,
  formatPlanAutoWeeksInputValue,
  formatPlanCurrency,
  formatPlanPercentUnit,
  normalizePlanOptimizerRows,
  formatPlanWhole,
} from "../planView.js";
import {
  REACH_REALITY_NOTE_FALLBACK,
  REACH_STATUS_AWAITING_INPUTS,
  REACH_STATUS_UNAVAILABLE,
  buildReachIntFormatter,
  buildReachFreshnessView,
  buildReachLeversAndActionsView,
  buildReachWeeklyConstraintView,
  buildReachWeeklyExecutionView,
  classifyReachStatusTone,
  deriveReachActionsCardStatus,
  deriveReachLeversCardStatus,
  deriveReachWeeklyCardStatus,
  formatReachInt,
} from "../reachView.js";
import {
  buildDecisionBottleneckSnapshotView,
  buildDecisionBottleneckImpactRowsView,
  buildDecisionConversionPanelView,
  buildDecisionConfidenceSnapshotView,
  computeDecisionSensitivityMiniSurfaceCache,
  buildDecisionSensitivityPanelView,
  buildDecisionIntelligencePanelView,
  buildDecisionIntelligenceRankingRowsView,
  buildDecisionDiagnosticsSnapshotView,
  buildDecisionDivergenceView,
  buildDecisionDriftSnapshotView,
  buildDecisionRiskSnapshotView,
  buildDecisionSensitivitySnapshotView,
  computeDecisionConfidenceComposite,
  DECISION_DIVERGENCE_KEY_ORDER,
  DECISION_STATUS_AWAITING_DECISION,
  DECISION_STATUS_UNAVAILABLE,
  classifyDecisionStatusTone,
  deriveDecisionConstraintTightness,
  deriveDecisionExecutionPaceStatus,
  deriveDecisionRiskBand,
  deriveDecisionActionCardStatus,
  deriveDecisionDetailCardStatus,
  deriveDecisionDiagnosticsCardStatus,
  deriveDecisionOptionsCardStatus,
  deriveDecisionSessionCardStatus,
  deriveDecisionSummaryCardStatus,
} from "../decisionView.js";
import {
  buildDataArchiveLearningSignalsView,
  buildDataArchiveLearningView,
  buildDataImportFileStatus,
  buildDataRestoreSelectionLabel,
  buildDataSurfaceSummaryView,
  buildDataArchiveTableSummaryText,
  buildDataArchiveOfficeWinnerText,
  buildDataArchiveSelectedSnapshotView,
  buildDataVoterSchemaGuideView,
  inferDataVoterInputFormat,
  listDataVoterAdapterOptions,
  buildDataVoterLayerSnapshotView,
  buildDataVoterSourceLabel,
  DATA_ARCHIVE_DETAIL_FALLBACK,
  DATA_BACKUP_SELECTION_FALLBACK,
  DATA_IMPORT_FILE_STATUS_FALLBACK,
  DATA_LEARNING_LABEL_FALLBACK,
  DATA_LEARNING_RECOMMENDATION_FALLBACK,
  DATA_STATUS_AWAITING_STORAGE,
  DATA_VOTER_IMPORT_STATUS_FALLBACK,
  countDataBackupOptions,
  classifyDataStatusTone,
  deriveDataAuditCardStatus,
  deriveDataAuditCardStatusFromMetrics,
  deriveDataExchangeCardStatus,
  formatDataScopeCampaign,
  formatDataScopeLocks,
  formatDataScopeOffice,
  formatDataArchiveRecordedAt,
  formatDataArchiveCount,
  formatDataArchiveDecimal,
  formatDataPercentFromPct,
  formatDataRatePercent,
  formatDataSampleCount,
  formatDataSignedDecimal,
  normalizeDataArchiveSummary,
  parseDataOptionalNumber,
  deriveDataPolicyCardStatus,
  deriveDataStorageCardStatus,
  deriveDataSummaryCardStatus,
} from "../dataView.js";
import {
  buildLegacyScenarioComparisonKeyOutput,
  buildLegacyScenarioInputDiffSummary,
  buildLegacyScenarioOutputDiffRows,
  computeLegacyScenarioPaceAttemptsPerDay,
  SCENARIO_ACTIVE_LABEL_FALLBACK,
  buildScenarioWorkspaceSummaryView,
  buildScenarioInputChangeRows,
  buildScenarioComparisonView,
  deriveLegacyScenarioDivergence,
  deriveLegacyScenarioCompareTag,
  SCENARIO_COMPARE_MODE_DISABLED_TEXT,
  SCENARIO_STORAGE_STATUS_SESSION_ONLY,
  SCENARIO_STATUS_AWAITING_SCENARIO,
  SCENARIO_STATUS_UNAVAILABLE,
  classifyScenarioStatusTone,
  deriveScenarioCompareCardStatus,
  deriveScenarioNotesCardStatus,
  deriveScenarioSummaryCardStatus,
  deriveScenarioWorkspaceCardStatus,
} from "../scenarioView.js";
import { buildImpactTraceItemsView } from "../impactTraceView.js";
import {
  buildControlsApplyTopRecommendationButtonLabel,
  buildControlsAuditSelectOption,
  buildControlsBenchmarkCountText,
  buildControlsBenchmarkDraftStatus,
  buildControlsBenchmarkTableRowView,
  buildControlsCalibrationStatus,
  buildControlsCalibrationStatusView,
  buildControlsCorrelationDisabledHint,
  buildControlsCorrelationHintStatusView,
  buildControlsCorrelationStatus,
  buildControlsCorrelationStatusView,
  buildControlsDecayStatus,
  buildControlsDecayStatusView,
  buildControlsEvidenceAttachStatus,
  buildControlsEvidenceRowView,
  buildControlsMissingEvidenceCountText,
  buildControlsMissingNoteCountText,
  buildControlsNoActiveRecommendationStatus,
  buildControlsObservedStatusView,
  buildControlsObservedCaptureStatus,
  buildControlsRecommendationStatusView,
  buildControlsRecommendationRefreshStatus,
  buildControlsScenarioLockStatus,
  buildControlsShockScenarioCountText,
  buildControlsShockStatus,
  buildControlsShockStatusView,
  buildControlsWhatIfDetailedPreviewText,
  buildControlsWhatIfSavedStatus,
  buildControlsWhatIfStatusView,
  buildControlsWorkflowStatus,
  buildControlsWorkflowIntegrityStatusView,
  buildObservedCountText,
  buildObservedStatusText,
  buildRecommendationCountText,
  buildRecommendationPreviewTextFromIntel,
  buildRecommendationStatusText,
  buildWhatIfCountText,
  buildWhatIfPreviewTextFromIntel,
  buildWhatIfStatusText,
  CONTROLS_STATUS_AWAITING_REVIEW,
  classifyControlsStatusTone,
  deriveControlsBenchmarkCardStatus,
  deriveControlsEvidenceCardStatus,
  deriveControlsIntegrityCardStatus,
  deriveControlsReviewCardStatus,
  deriveControlsWarningsCardStatus,
  deriveControlsWorkflowCardStatus,
  formatControlsIsoDate,
  formatControlsNumber,
  formatControlsPercentInputValue,
  formatControlsRecordCount,
  formatControlsWhatIfTarget,
  parseControlsOptionalNumber,
} from "../controlsView.js";
import {
  TURNOUT_ROI_BANNER_FALLBACK,
  TURNOUT_STATUS_AWAITING_SETUP,
  TURNOUT_STATUS_BANNER_FALLBACK,
  buildTurnoutPhase3CapacityGapView,
  buildRoiStatusBanner,
  buildTurnoutStatusBanner,
  classifyTurnoutStatusTone,
  deriveTurnoutAssumptionsCardStatus,
  deriveTurnoutCostCardStatus,
  deriveTurnoutEfficiencyCardStatus,
  deriveTurnoutImpactCardStatus,
  deriveTurnoutLiftCardStatus,
  deriveTurnoutSummaryCardStatus,
  formatTurnoutCurrency,
} from "../turnoutView.js";
import {
  buildRoiTableRowsView,
  buildRoiTurnoutDisabledSummary,
  buildRoiTurnoutSummary,
  computeRoiContactsAtCapacity,
  formatRoiCurrencyFixed,
  formatRoiCurrencyWhole,
  formatRoiNeedVotesText,
} from "../roiView.js";
import {
  buildDistrictApplyAdjustmentsStatus,
  buildDistrictAssumptionProvenanceStatus,
  buildDistrictCensusContextHint,
  buildDistrictFootprintCapacityStatus,
  buildDistrictGeoStatsText,
  buildDistrictLastFetchText,
  buildDistrictRaceFootprintStatus,
  buildDistrictSelectionSetStatus,
  buildDistrictSelectionSummaryText,
  buildDistrictStructureDerivedText,
  buildDistrictStructureInputView,
  buildDistrictTurnoutFallbackView,
  computeDistrictSupportTotalPctFromState,
  DISTRICT_STATUS_AWAITING_INPUTS,
  classifyDistrictStatusTone,
  deriveDistrictBaselineCardStatus,
  deriveDistrictCensusCardStatus,
  deriveDistrictElectorateCardStatus,
  deriveDistrictRaceCardStatus,
  deriveDistrictStructureCardStatus,
  deriveDistrictSummaryCardStatus,
  deriveDistrictTargetingCardStatus,
  deriveDistrictTurnoutCardStatus,
  formatDistrictMultiplier,
} from "../districtView.js";
import { buildOptimizationTactics, computeRoiRows } from "../budget.js";
import {
  buildTimelineConstrainedOptimizationInput,
  buildOfficeOptimizationSummary,
  buildOptimizationOfficePathSummary,
  buildOptimizationExecutionView,
  buildOptimizationGapContext,
  buildOptimizationLastSummarySnapshot,
  buildOptimizationTopAllocationLabels,
  buildOptimizationUpliftSummaryText,
  buildOptimizationExecutionSummary,
  computeTimelineConstraintInterventionDeltas,
  deriveOptimizationBindingSummary,
  deriveOptimizationUpliftSignals,
  normalizeOptimizationOfficePathRow,
  optimizeMixByOffice,
  optimizeMixBudget,
  resolveOptimizationBudgetAvailable,
  resolveOptimizationCapacityLimit,
  resolveOptimizationFeasible,
} from "../optimize.js";
import { getTimelineObjectiveMeta, optimizeTimelineConstrained } from "../timelineOptimizer.js";
import { getOptimizationObjectiveCopy } from "../turnout.js";
import { computeMarginalValueDiagnostics } from "../marginalValue.js";
import {
  buildTimelineFeasibilityDisplayView,
  buildTimelineStateSnapshot,
  computeTimelineFeasibility,
  getTimelineFeasibilityObjectiveMeta,
  normalizeTimelineWeeklyPlanRows,
  resolveTimelineObjectiveValuePerAttemptFromTotals,
} from "../timeline.js";
import {
  buildNormalizedTargetComponents,
  computeCanonicalTargetMetrics,
  resolveCanonicalWeightProfile,
} from "../targetFeatureEngine.js";
import { TARGET_FEATURE_KEYS } from "../targetFeatureRegistry.js";
import { scoreTargetRow } from "../targetModels.js";
import { scoreTargetRows } from "../targetRankingEngine.js";
import {
  countTopTargetRows,
  selectTopTargetingRows,
  summarizeTargetingRows,
  targetRowScoreValue,
} from "../targetingRows.js";
import { buildUpliftFeatures } from "../upliftFeatures.js";
import { computeOptimizationUpliftPlan, computeUpliftPlan } from "../upliftModel.js";
import {
  deriveUpliftSourceGovernanceSignal,
  formatUpliftSourceLabel,
  normalizeUpliftSource,
  UPLIFT_SOURCE_BASE_RATES,
  UPLIFT_SOURCE_TARGETING_ROWS,
  UPLIFT_SOURCE_UNKNOWN,
} from "../upliftSource.js";
import { valuesEqualWithTolerance } from "../valueCompare.js";
import { computeAssumptionBenchmarkWarnings } from "../importQuality.js";
import {
  computeBlendedAttemptsPerHourFromState,
  resolveBaseCallsPerHour,
  resolveBaseDoorsPerHour,
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorShareUnit,
  resolveCanonicalDoorsPerHour,
  setCanonicalCallsPerHour,
  setCanonicalDoorsPerHour,
} from "../throughput.js";
import {
  clampFiniteNumber,
  coerceFiniteNumber,
  formatFixedNumber,
  formatWholeNumberByMode,
  formatSignedPointsFromUnit,
  formatStatusWithScoreOutOfHundred,
  formatWholeNumber,
  roundWholeNumberByMode,
  roundToDigits,
} from "../utils.js";
import {
  buildTurnoutModelFromState,
  computeGotvAddedVotes,
  computeTargetUniverseSize,
  rateOverrideToDecimal,
} from "../voteProduction.js";
import {
  appendBackupEntry,
  loadState,
  makeBackupStorageKey,
  makeStateStorageKey,
  persistStateSnapshot,
  readBackups,
} from "../../storage.js";

function approx(a, b, tol = 1e-9){
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tol;
}

function makeMemoryStorage(){
  const map = new Map();
  const keys = () => Array.from(map.keys());
  return {
    get length(){
      return map.size;
    },
    key(index){
      const i = Number(index);
      if (!Number.isFinite(i) || i < 0) return null;
      return keys()[Math.floor(i)] ?? null;
    },
    getItem(key){
      return map.has(key) ? String(map.get(key)) : null;
    },
    setItem(key, value){
      map.set(String(key), String(value));
    },
    removeItem(key){
      map.delete(String(key));
    },
  };
}

/**
 * @param {{
 *   test: (name: string, fn: () => unknown) => void,
 *   assert: (cond: unknown, msg?: string) => void,
 * }} ctx
 * @returns {void}
 */
export function registerRebuildContractTests(ctx){
  const { test, assert } = ctx;

  test("Rebuild contracts: template apply mode untouched keeps overridden values", () => {
    const state = {
      raceType: "state_leg",
      supportRatePct: 61,
      bandWidth: 4,
      persuasionPct: 30,
      earlyVoteExp: 38,
      contactRatePct: 22,
      turnoutReliabilityPct: 80,
      templateMeta: makeDefaultTemplateMeta({ raceType: "state_leg" }),
    };
    syncTemplateMetaFromState(state);
    const out = applyTemplateDefaultsToState(state, { raceType: "federal", mode: "untouched" });
    assert(out?.ok === true, "template apply should succeed");
    assert(state.templateMeta?.appliedTemplateId === "federal_general_incumbent", "template id should resolve to federal archetype");
    assert(state.templateMeta?.benchmarkKey === "federal_general", "template meta should persist canonical benchmark key");
    assert(state.supportRatePct === 61, "untouched mode should preserve explicit support override");
    assert(Array.isArray(state.templateMeta?.overriddenFields) && state.templateMeta.overriddenFields.includes("supportRatePct"), "override metadata should include preserved field");
    return true;
  });

  test("Rebuild contracts: template apply mode all resets to template defaults", () => {
    const state = {
      raceType: "state_leg",
      supportRatePct: 61,
      templateMeta: makeDefaultTemplateMeta({ raceType: "state_leg" }),
    };
    syncTemplateMetaFromState(state);
    const out = applyTemplateDefaultsToState(state, { raceType: "federal", mode: "all" });
    const fed = getTemplateRecord("federal_general_incumbent");
    assert(out?.ok === true, "template apply should succeed");
    assert(state.supportRatePct === fed?.defaults?.supportRatePct, "all mode should restore template defaults");
    assert(state.templateMeta?.appliedTemplateId === "federal_general_incumbent", "template provenance should update");
    return true;
  });

  test("Rebuild contracts: template dimensions resolve archetype deterministically", () => {
    const state = {
      raceType: "state_leg",
      templateMeta: makeDefaultTemplateMeta({ raceType: "state_leg" }),
    };
    syncTemplateMetaFromState(state);
    const out = applyTemplateDefaultsToState(state, {
      mode: "all",
      officeLevel: "state_house",
      electionType: "special",
      seatContext: "open",
      partisanshipMode: "partisan",
      salienceLevel: "low",
    });
    const resolvedTemplate = getTemplateRecord("special_low_turnout");
    assert(out?.ok === true, "dimension-based template apply should succeed");
    assert(state.templateMeta?.appliedTemplateId === "special_low_turnout", "dimensions should resolve to special_low_turnout archetype");
    assert(state.gotvMaxLiftPP === resolvedTemplate?.defaults?.gotvMaxLiftPP, "resolved archetype defaults should apply canonically");
    return true;
  });

  test("Rebuild contracts: benchmark warnings resolve from template benchmark profile before race fallback", () => {
    const templateScopedScenario = {
      raceType: "municipal",
      contactRatePct: 50,
      supportRatePct: 54,
      turnoutA: 55,
      turnoutB: 55,
      persuasionPct: 30,
      templateMeta: {
        appliedTemplateId: "federal_general_incumbent",
      },
    };
    const raceScopedScenario = {
      raceType: "municipal",
      contactRatePct: 50,
      supportRatePct: 54,
      turnoutA: 55,
      turnoutB: 55,
      persuasionPct: 30,
    };
    const templateWarnings = computeAssumptionBenchmarkWarnings(templateScopedScenario, "Benchmark");
    const raceWarnings = computeAssumptionBenchmarkWarnings(raceScopedScenario, "Benchmark");
    assert(
      templateWarnings.some((msg) => String(msg).includes("contactRatePct")),
      "template benchmark profile should enforce federal contact-rate band when federal template is applied",
    );
    assert(
      !raceWarnings.some((msg) => String(msg).includes("contactRatePct")),
      "race fallback should keep municipal contact-rate band when no template benchmark scope is present",
    );
    return true;
  });

  test("Rebuild contracts: intel benchmark entries prioritize benchmarkKey over legacy race scope", () => {
    const scenario = {
      raceType: "municipal",
      contactRatePct: 50,
      templateMeta: { appliedTemplateId: "federal_general_incumbent", benchmarkKey: "federal_general" },
      intelState: {
        benchmarks: [
          {
            ref: "core.contactRatePct",
            benchmarkKey: "federal_general",
            raceType: "federal",
            range: { min: 8, max: 40 },
          },
        ],
      },
    };
    const warnings = computeAssumptionBenchmarkWarnings(scenario, "Benchmark");
    assert(
      warnings.some((msg) => String(msg).includes("contactRatePct")),
      "benchmarkKey-scoped benchmark row should apply even when legacy raceType differs",
    );
    return true;
  });

  test("Rebuild contracts: benchmark upsert persists canonical benchmark scope key", () => {
    const state = {
      raceType: "municipal",
      templateMeta: { appliedTemplateId: "federal_general_incumbent", benchmarkKey: "federal_general" },
      intelState: {},
    };
    ensureIntelCollections(state);
    const created = upsertBenchmarkEntry(state, {
      ref: "core.contactRatePct",
      raceType: "all",
      min: 8,
      max: 45,
    });
    assert(created?.ok === true, "benchmark upsert should succeed");
    const rows = listIntelBenchmarks(state);
    assert(rows.length === 1, "benchmark upsert should create one scoped row");
    assert(rows[0]?.benchmarkKey === "federal_general", "benchmark row should store canonical benchmark scope key");

    const updated = upsertBenchmarkEntry(state, {
      ref: "core.contactRatePct",
      raceType: "federal",
      min: 9,
      max: 44,
    });
    assert(updated?.ok === true, "benchmark upsert update should succeed");
    assert(listIntelBenchmarks(state).length === 1, "benchmark upsert should de-dupe legacy race scope and canonical key scope");
    return true;
  });

  test("Rebuild contracts: default benchmark loader resolves template benchmark scope when race is all", () => {
    const state = {
      raceType: "state_leg",
      templateMeta: { appliedTemplateId: "federal_general_incumbent", benchmarkKey: "federal_general" },
      intelState: {},
    };
    ensureIntelCollections(state);
    const loaded = loadDefaultBenchmarksForRaceType(state, "all");
    assert(loaded?.ok === true, "benchmark defaults should load");
    assert(loaded?.benchmarkKey === "federal_general", "benchmark defaults should align to template benchmark scope");
    const rows = listIntelBenchmarks(state);
    assert(rows.length >= 5, "benchmark defaults should populate canonical rows");
    assert(rows.every((row) => row?.benchmarkKey === "federal_general"), "loaded benchmark rows should carry canonical benchmark key");
    return true;
  });

  test("Rebuild contracts: benchmark scope helpers map canonical and legacy scope values", () => {
    const options = listBenchmarkScopeOptions();
    const optionValues = options.map((row) => String(row?.value || ""));
    assert(optionValues.includes("default"), "benchmark scope options should include default scope");
    assert(optionValues.includes("federal_general"), "benchmark scope options should include federal profile scope");
    assert(
      benchmarkScopeToBenchmarkKey("federal") === "federal_general",
      "legacy federal race scope should resolve to federal benchmark profile key",
    );
    assert(
      benchmarkScopeToBenchmarkKey("state_house_general") === "state_house_general",
      "canonical benchmark scope key should resolve to itself",
    );
    assert(
      benchmarkScopeToRaceType("municipal_nonpartisan") === "municipal",
      "canonical municipal benchmark scope should map to legacy municipal race type",
    );
    assert(
      benchmarkScopeLabel("special_low_turnout") === "Special / low turnout",
      "benchmark scope label should come from canonical profile labels",
    );
    return true;
  });

  test("Rebuild contracts: default benchmark loader honors explicit benchmark scope input", () => {
    const state = { raceType: "municipal", intelState: {} };
    ensureIntelCollections(state);
    const loaded = loadDefaultBenchmarksForRaceType(state, {
      raceType: "municipal",
      benchmarkKey: "federal_general",
    });
    assert(loaded?.ok === true, "benchmark defaults should load for explicit benchmark scope");
    assert(loaded?.benchmarkKey === "federal_general", "explicit benchmark scope should override race fallback");
    const rows = listIntelBenchmarks(state);
    assert(rows.length >= 5, "explicit benchmark scope loader should populate canonical rows");
    assert(rows.every((row) => row?.benchmarkKey === "federal_general"), "explicit benchmark scope rows should carry requested scope key");
    return true;
  });

  test("Rebuild contracts: timeline caps helpers provide canonical render-safe values", () => {
    const state = {
      budget: {
        tactics: {
          doors: { kind: "persuasion" },
          phones: { kind: "turnout" },
        },
      },
      timelineStaffCount: 2,
      timelineVolCount: 5,
      timelineStaffHours: 40,
      timelineVolHours: 6,
      timelineDoorsPerHour: 18,
      timelineCallsPerHour: 24,
      timelineTextsPerHour: 28,
      timelineActiveWeeks: 7,
      timelineGotvWeeks: 2,
    };
    const tacticKinds = buildTimelineTacticKindsMapFromState(state);
    const capsInput = buildTimelineCapsInputFromState({
      state,
      weeksRemaining: 9,
      enabled: true,
      tacticKinds,
    });
    assert(capsInput.enabled === true, "timeline caps input should preserve enabled flag");
    assert(capsInput.staffing.staff === 2 && capsInput.staffing.volunteers === 5, "timeline caps input should include staffing fields");
    assert(capsInput.throughput.doors === 18 && capsInput.throughput.phones === 24 && capsInput.throughput.texts === 28, "timeline caps input should include throughput fields");
    assert(capsInput.tacticKinds.phones === "turnout", "timeline caps input should preserve tactic-kind map");

    const computedSummary = computeTimelineCapsSummary({
      capsInput,
      computeMaxAttemptsByTactic: () => ({
        maxAttemptsByTactic: {
          doors: "120",
          phones: 60,
          texts: "oops",
        },
        meta: { enabled: true },
      }),
    });
    assert(!!computedSummary.capsInput && computedSummary.capsInput.enabled === true, "timeline caps summary should preserve caps input payload");
    assert(computedSummary.maxAttemptsByTactic?.doors === "120", "timeline caps summary should preserve raw max-attempt payload");
    assert(computedSummary.capsByTactic?.doors === 120, "timeline caps summary should normalize positive finite caps");
    assert(computedSummary.capsByTactic?.texts === null, "timeline caps summary should null invalid caps");
    assert(computedSummary.totalAttempts === 180, "timeline caps summary should sum normalized tactic caps");

    const disabledSummary = computeTimelineCapsSummary({
      capsInput,
      computeMaxAttemptsByTactic: () => ({
        maxAttemptsByTactic: { doors: 10 },
        meta: { enabled: false },
      }),
    });
    assert(disabledSummary.maxAttemptsByTactic == null, "timeline caps summary should honor enabled wrappers by default");
    const includeDisabledSummary = computeTimelineCapsSummary({
      capsInput,
      computeMaxAttemptsByTactic: () => ({
        maxAttemptsByTactic: { doors: 10 },
        meta: { enabled: false },
      }),
      requireEnabled: false,
    });
    assert(includeDisabledSummary.maxAttemptsByTactic?.doors === 10, "timeline caps summary should include disabled wrappers when requireEnabled=false");

    const summaryFromState = computeTimelineCapsSummaryFromState({
      state,
      weeksRemaining: 9,
      enabled: true,
      tacticKinds,
      computeMaxAttemptsByTactic: (input) => ({
        maxAttemptsByTactic: {
          doors: input?.throughput?.doors,
          phones: input?.throughput?.phones,
        },
        meta: { enabled: true },
      }),
    });
    assert(summaryFromState.capsInput.staffing.staff === 2, "state timeline caps summary should construct staffing input canonically");
    assert(summaryFromState.capsByTactic?.doors === 18, "state timeline caps summary should project canonical throughput-derived doors cap");
    assert(summaryFromState.capsByTactic?.phones === 24, "state timeline caps summary should project canonical throughput-derived phones cap");
    assert(summaryFromState.totalAttempts === 42, "state timeline caps summary should aggregate normalized tactic caps");

    const normalizedCaps = normalizeTimelineCapsByTactic({
      doors: "120",
      phones: -10,
      texts: "oops",
    });
    assert(normalizedCaps.doors === 120, "timeline caps normalization should coerce finite positive values");
    assert(normalizedCaps.phones === null && normalizedCaps.texts === null, "timeline caps normalization should null invalid/negative values");
    assert(sumTimelineCapsAttempts({ doors: 40, phones: null, texts: 10 }) === 50, "timeline caps sum should ignore null values");
    assert(
      !!extractTimelineMaxAttemptsByTactic({ maxAttemptsByTactic: { doors: 10 }, meta: { enabled: true } }),
      "timeline caps extraction should honor meta.enabled wrappers",
    );
    assert(
      extractTimelineMaxAttemptsByTactic({ maxAttemptsByTactic: { doors: 10 }, meta: { enabled: false } }) == null,
      "timeline caps extraction should ignore disabled wrappers",
    );
    assert(
      !!extractTimelineMaxAttemptsByTactic({ maxAttemptsByTactic: { doors: 10 }, enabled: true }),
      "timeline caps extraction should support legacy enabled wrappers",
    );
    assert(
      extractTimelineActiveWeeks({ meta: { activeWeeks: 6 } }, 2) === 6,
      "timeline active-weeks extraction should prefer meta.activeWeeks",
    );
    assert(
      extractTimelineActiveWeeks({ activeWeeks: 4 }, 2) === 4,
      "timeline active-weeks extraction should support legacy activeWeeks wrappers",
    );
    assert(
      extractTimelineActiveWeeks({}, 3) === 3,
      "timeline active-weeks extraction should honor fallback value",
    );
    return true;
  });

  test("Rebuild contracts: canonical throughput helpers preserve legacy fallback behavior", () => {
    const canonical = resolveCanonicalDoorsPerHour({ doorsPerHour3: 24, doorsPerHour: 18 });
    const legacy = resolveCanonicalDoorsPerHour({ doorsPerHour3: "", doorsPerHour: 18 });
    const missing = resolveCanonicalDoorsPerHour({ doorsPerHour3: "", doorsPerHour: "" });
    const callsCanonical = resolveCanonicalCallsPerHour({ callsPerHour3: 31, callsPerHour: 22 });
    const callsLegacy = resolveCanonicalCallsPerHour({ callsPerHour3: "", callsPerHour: 22 });
    const callsMissing = resolveCanonicalCallsPerHour({ callsPerHour3: "", callsPerHour: "" });
    const target = {};
    const callsTarget = {};
    setCanonicalDoorsPerHour(target, "26");
    setCanonicalCallsPerHour(callsTarget, "28");
    assert(canonical === 24, "canonical doors-per-hour helper should prefer canonical field when present");
    assert(legacy === 18, "canonical doors-per-hour helper should fall back to legacy field when canonical is missing");
    assert(missing == null, "canonical doors-per-hour helper should return null when no finite doors/hour exists");
    assert(callsCanonical === 31, "canonical calls-per-hour helper should prefer canonical field when present");
    assert(callsLegacy === 22, "canonical calls-per-hour helper should fall back to legacy field when canonical is missing");
    assert(callsMissing == null, "canonical calls-per-hour helper should return null when no finite calls/hour exists");
    assert(target.doorsPerHour3 === 26 && target.doorsPerHour === 26, "canonical doors-per-hour setter should synchronize canonical + legacy fields");
    assert(callsTarget.callsPerHour3 === 28 && callsTarget.callsPerHour === 28, "canonical calls-per-hour setter should synchronize canonical + legacy fields");
    setCanonicalDoorsPerHour(target, null, { emptyValue: "" });
    setCanonicalCallsPerHour(callsTarget, null, { emptyValue: "" });
    assert(target.doorsPerHour3 === "" && target.doorsPerHour === "", "canonical doors-per-hour setter should apply empty fallback when value is invalid");
    assert(callsTarget.callsPerHour3 === "" && callsTarget.callsPerHour === "", "canonical calls-per-hour setter should apply empty fallback when value is invalid");
    assert(resolveBaseDoorsPerHour({ doorsPerHour3: 27 }) === 27, "base doors helper should preserve positive canonical values");
    assert(resolveBaseDoorsPerHour({ doorsPerHour3: -1 }, { fallback: 30 }) === 30, "base doors helper should apply fallback for invalid values");
    assert(resolveBaseCallsPerHour({ callsPerHour3: 33 }) === 33, "base calls helper should preserve positive canonical values");
    assert(resolveBaseCallsPerHour({ callsPerHour3: "" }, { fallback: 25 }) === 25, "base calls helper should apply fallback for missing values");
    assert(resolveCanonicalDoorShareUnit({ channelDoorPct: 62 }) === 0.62, "canonical door-share helper should normalize pct inputs to unit share");
    assert(
      computeBlendedAttemptsPerHourFromState({ channelDoorPct: 60, doorsPerHour3: 30, callsPerHour3: 20 }) === 26,
      "state blended-throughput helper should combine canonical door-share + throughput values",
    );
    return true;
  });

  test("Rebuild contracts: base rate helpers provide one canonical state/default resolver", () => {
    const fromState = resolveStateBaseRates({
      contactRatePct: 24,
      supportRatePct: 56,
      turnoutReliabilityPct: 82,
    });
    assert(Math.abs((fromState.cr ?? 0) - 0.24) < 1e-9, "state base-rate helper should parse contact rate pct to unit");
    assert(Math.abs((fromState.sr ?? 0) - 0.56) < 1e-9, "state base-rate helper should parse support rate pct to unit");
    assert(Math.abs((fromState.tr ?? 0) - 0.82) < 1e-9, "state base-rate helper should parse turnout reliability pct to unit");

    const defaulted = resolveStateBaseRates({}, { defaults: BASE_RATE_DEFAULTS });
    assert(defaulted.cr === BASE_RATE_DEFAULTS.cr, "state base-rate helper should honor canonical contact fallback");
    assert(defaulted.sr === BASE_RATE_DEFAULTS.sr, "state base-rate helper should honor canonical support fallback");
    assert(defaulted.tr === BASE_RATE_DEFAULTS.tr, "state base-rate helper should honor canonical turnout fallback");

    const noFallback = resolveStateBaseRates({}, { defaults: NULL_BASE_RATE_DEFAULTS });
    assert(noFallback.cr == null && noFallback.sr == null && noFallback.tr == null, "null-default base-rate mode should not invent values");

    const merged = resolveBaseRatesWithStateFallback({
      state: { contactRatePct: 20, supportRatePct: 52, turnoutReliabilityPct: 77 },
      baseRates: { cr: 0.31, tr: 0.84 },
      defaults: BASE_RATE_DEFAULTS,
    });
    assert(Math.abs((merged.cr ?? 0) - 0.31) < 1e-9, "base-rate overrides should win for contact rate");
    assert(Math.abs((merged.sr ?? 0) - 0.52) < 1e-9, "state fallback should fill missing support-rate overrides");
    assert(Math.abs((merged.tr ?? 0) - 0.84) < 1e-9, "base-rate overrides should win for turnout reliability");
    return true;
  });

  test("Rebuild contracts: blended attempts helper provides canonical throughput math", () => {
    const blended = computeBlendedAttemptsPerHour({
      doorShare: 0.7,
      doorsPerHour: 24,
      callsPerHour: 12,
    });
    assert(Math.abs((blended ?? 0) - 20.4) < 1e-9, "blended attempts helper should compute weighted door/call throughput");
    assert(
      computeBlendedAttemptsPerHour({ doorShare: 2, doorsPerHour: 20, callsPerHour: 10 }) === 20,
      "blended attempts helper should clamp door share into unit bounds",
    );
    assert(
      computeBlendedAttemptsPerHour({ doorShare: null, doorsPerHour: 20, callsPerHour: 10 }) == null,
      "blended attempts helper should return null for missing inputs",
    );

    const expectedAph = computeExpectedAphFromWeeklyContext({
      doorShare: 0.6,
      doorsPerHour: 30,
      callsPerHour: 20,
    });
    assert(expectedAph === 26, "expected APH helper should reuse canonical blended-throughput calculation");

    const rolling = computeRollingExecutionRates({
      sumAttempts: 200,
      sumConvos: 80,
      sumSupportIds: 28,
      sumOrgHours: 10,
    });
    assert(rolling.cr === 0.4, "rolling execution rates helper should derive CR from convos/attempts");
    assert(rolling.sr === 0.35, "rolling execution rates helper should derive SR from support IDs/conversations");
    assert(rolling.aph === 20, "rolling execution rates helper should derive APH from attempts/org-hours");

    const logSummary = summarizeExecutionDailyLog({
      dailyLog: [
        { date: "2026-03-01", doors: 40, calls: 20, convos: 24, supportIds: 8, orgHours: 3 },
        { date: "2026-03-02", doors: 50, calls: 10, convos: 22, supportIds: 9, orgHours: 3 },
      ],
      windowN: 7,
    });
    assert(logSummary.hasLog === true, "execution log summary helper should detect populated logs");
    assert(logSummary.sumAttemptsWindow === 120, "execution log summary helper should aggregate attempts canonically");
    assert(logSummary.sumConvosWindow === 46, "execution log summary helper should aggregate conversations canonically");
    assert(logSummary.sumSupportIdsWindow === 17, "execution log summary helper should aggregate support IDs canonically");
    assert(logSummary.sumOrgHoursWindow === 6, "execution log summary helper should aggregate organizer hours canonically");
    assert(
      deriveExecutionAttemptsFromLogEntry({ doors: 9, calls: 6, attempts: "" }) === 15,
      "execution attempts helper should fallback to doors+calls when attempts is blank",
    );
    assert(
      deriveExecutionAttemptsFromLogEntry({ doors: 9, calls: 6, attempts: 22 }) === 22,
      "execution attempts helper should prefer explicit attempts when present",
    );
    return true;
  });

  test("Rebuild contracts: goal pace requirements helper is canonical for workload math", () => {
    const pace = computeGoalPaceRequirements({
      goalVotes: 1000,
      supportRate: 0.5,
      contactRate: 0.25,
      weeks: 10,
    });
    assert(pace.convosNeeded === 2000, "goal pace helper should derive conversations needed from goal/support rate");
    assert(pace.attemptsNeeded === 8000, "goal pace helper should derive attempts needed from conversations/contact rate");
    assert(pace.convosPerWeek === 200, "goal pace helper should derive conversations per week from weeks");
    assert(pace.attemptsPerWeek === 800, "goal pace helper should derive attempts per week from weeks");
    assert(
      computeGoalPaceRequirements({ goalVotes: 0, supportRate: 0.5, contactRate: 0.25, weeks: 10 }).attemptsNeeded == null,
      "goal pace helper should return null requirements when goal is not positive",
    );
    const turnoutAware = computeNeedVotePaceRequirements({
      goalVotes: 1000,
      turnoutReliability: 0.8,
      supportRate: 0.5,
      contactRate: 0.25,
      weeks: 10,
    });
    assert(turnoutAware.supportsNeeded === 1250, "need-vote pace helper should derive supports from goal/turnout reliability");
    assert(turnoutAware.convosNeeded === 2500, "need-vote pace helper should derive conversations from supports/support rate");
    assert(turnoutAware.attemptsNeeded === 10000, "need-vote pace helper should derive attempts from conversations/contact rate");
    assert(turnoutAware.attemptsPerWeek === 1000, "need-vote pace helper should derive weekly attempts from attempts/weeks");
    assert(
      computeRemainingAttempts({ attemptsNeeded: 10000, attemptsCompleted: 2500 }) === 7500,
      "remaining-attempts helper should derive non-negative remaining attempts",
    );
    assert(
      computeWeeksToFinishAtPace({ remainingAttempts: 7500, attemptsPerWeek: 700 }) === (7500 / 700),
      "weeks-to-finish helper should derive finish horizon from remaining attempts and pace",
    );
    const finishDate = computeFinishDateFromDailyPace({
      totalAttempts: 700,
      attemptsPerDay: 100,
      nowDate: new Date("2026-03-10T12:00:00Z"),
    });
    assert(
      finishDate instanceof Date && Number.isFinite(finishDate.getTime()) && finishDate.toISOString().startsWith("2026-03-17"),
      "finish-date helper should derive calendar projection from total attempts and daily pace",
    );
    assert(
      computeProjectedSlipDays({
        attemptsNeeded: 10000,
        attemptsCompleted: 2500,
        attemptsPerWeek: 700,
        weeksRemaining: 8,
      }) === 19,
      "projected-slip helper should derive slip days from remaining attempts and weekly pace",
    );
    const volunteerWorkload = computeVolunteerWorkloadFromGoal({
      goalVotes: 1000,
      supportRatePct: 50,
      contactRatePct: 25,
      doorsPerHour: 20,
      hoursPerShift: 4,
      shiftsPerVolunteerPerWeek: 2,
      weeks: 10,
    });
    assert(volunteerWorkload.convosNeeded === 2000, "volunteer workload helper should reuse canonical goal-pace convos math");
    assert(volunteerWorkload.attemptsNeeded === 8000, "volunteer workload helper should reuse canonical goal-pace attempts math");
    assert(volunteerWorkload.doorsPerShift === 80, "volunteer workload helper should derive doors per shift from DPH * hours/shift");
    assert(volunteerWorkload.totalShifts === 100, "volunteer workload helper should derive total shifts from attempts / doors-per-shift");
    assert(volunteerWorkload.shiftsPerWeek === 10, "volunteer workload helper should derive shifts-per-week from total shifts / weeks");
    assert(volunteerWorkload.volunteersNeeded === 5, "volunteer workload helper should derive volunteers from shifts/week and shifts per volunteer");
    const volunteerWorkloadUnitRates = computeVolunteerWorkloadFromGoal({
      goalVotes: 1000,
      supportRate: 0.5,
      contactRate: 0.25,
      doorsPerHour: 20,
      hoursPerShift: 4,
      shiftsPerVolunteerPerWeek: 2,
      weeks: 10,
    });
    assert(volunteerWorkloadUnitRates.volunteersNeeded === 5, "volunteer workload helper should accept canonical unit-rate inputs directly");
    assert(
      computeVolunteerNeedFromGoal({
        goalVotes: 1000,
        supportRatePct: 50,
        contactRatePct: 25,
        doorsPerHour: 20,
        hoursPerShift: 4,
        shiftsPerVolunteerPerWeek: 2,
        weeks: 10,
      }) === volunteerWorkload.volunteersNeeded,
      "volunteer need helper should compose the canonical volunteer-workload helper",
    );
    return true;
  });

  test("Rebuild contracts: volunteer feasibility messaging is canonical", () => {
    const zeroGoal = buildVolunteerCapacityFeasibility({
      goalVotes: 0,
      weeks: 8,
      supportRate: 0.5,
      contactRate: 0.25,
      doorsPerShift: 80,
      volunteersNeeded: 12,
    });
    const missingWeeks = buildVolunteerCapacityFeasibility({
      goalVotes: 100,
      weeks: 0,
      supportRate: 0.5,
      contactRate: 0.25,
      doorsPerShift: 80,
      volunteersNeeded: 12,
    });
    const ambitious = buildVolunteerCapacityFeasibility({
      goalVotes: 1000,
      weeks: 10,
      supportRate: 0.5,
      contactRate: 0.25,
      doorsPerShift: 80,
      volunteersNeeded: 26.2,
      formatWhole: (value) => String(Math.round(Number(value))),
    });
    const highRisk = buildVolunteerCapacityFeasibility({
      goalVotes: 1000,
      weeks: 10,
      supportRate: 0.5,
      contactRate: 0.25,
      doorsPerShift: 80,
      volunteersNeeded: 61,
    });
    assert(zeroGoal.kind === "ok", "volunteer feasibility should return ok for zero-goal state");
    assert(zeroGoal.text.includes("goal = 0"), "volunteer feasibility zero-goal message mismatch");
    assert(missingWeeks.kind === "warn", "volunteer feasibility should warn when weeks are missing");
    assert(missingWeeks.text.includes("Set an election date"), "volunteer feasibility missing-weeks message mismatch");
    assert(ambitious.kind === "warn", "volunteer feasibility should classify midrange load as ambitious");
    assert(ambitious.text.includes("≈ 27 active volunteers"), "volunteer feasibility should ceil volunteer counts before formatting");
    assert(highRisk.kind === "bad", "volunteer feasibility should classify high volunteer requirements as high risk");
    assert(highRisk.text.includes("High risk"), "volunteer feasibility high-risk message mismatch");
    assert(highRisk.shown === true, "volunteer feasibility should keep canonical shown=true behavior");
    return true;
  });

  test("Rebuild contracts: volunteer conversion snapshot is canonical", () => {
    const snapshot = buildVolunteerConversionSnapshot({
      goalVotes: 1000,
      supportRatePct: 50,
      contactRatePct: 25,
      doorsPerHour: 20,
      hoursPerShift: 4,
      shiftsPerVolunteerPerWeek: 2,
      weeks: 10,
      formatWhole: (value) => String(Math.round(Number(value))),
    });
    assert(snapshot.goalObjectiveValue === 1000, "conversion snapshot should preserve objective goal");
    assert(snapshot.goalNetVotes === 1000, "conversion snapshot should preserve legacy net-vote goal alias");
    assert(snapshot.conversationsNeeded === 2000, "conversion snapshot should compose canonical conversations-needed value");
    assert(snapshot.doorsNeeded === 8000, "conversion snapshot should compose canonical doors-needed value");
    assert(snapshot.doorsPerShift === 80, "conversion snapshot should compose canonical doors-per-shift value");
    assert(snapshot.totalShifts === 100, "conversion snapshot should compose canonical total-shifts value");
    assert(snapshot.shiftsPerWeek === 10, "conversion snapshot should compose canonical shifts-per-week value");
    assert(snapshot.volunteersNeeded === 5, "conversion snapshot should compose canonical volunteer requirement");
    assert(snapshot.feasibility.kind === "ok", "conversion snapshot should compose canonical feasibility kind");
    assert(snapshot.feasibility.text.includes("Looks feasible"), "conversion snapshot should compose canonical feasibility text");
    assert(snapshot.feasibility.shown === true, "conversion snapshot should compose canonical feasibility visibility");
    return true;
  });

  test("Rebuild contracts: governance output is deterministic and structured", () => {
    const input = {
      state: {
        persuasionPct: 52,
        contactRatePct: 28,
        supportRatePct: 57,
        turnoutReliabilityPct: 82,
        gotvMaxLiftPP: 12,
        doorsPerHour3: 31,
        callsPerHour3: 21,
        mcLast: {
          winProb: 0.61,
          confidenceEnvelope: {
            percentiles: { p10: -180, p50: 40, p90: 260 },
          },
        },
        ui: {
          e4Sensitivity: {
            rows: [
              { label: "Contact rate +2", dWin: "+1.4 pts" },
              { label: "Support rate +2", dWin: "+1.1 pts" },
              { label: "Turnout reliability +2", dWin: "+0.6 pts" },
            ],
          },
          lastTimeline: {
            percentPlanExecutable: 0.84,
            shortfallAttempts: 320,
          },
          lastSummary: {
            upliftSummary: {
              source: "targeting_rows",
              uncertaintyBand: "high",
              saturationPressure: "medium",
              weightedExpectedMarginalGain: 0.62,
              weightedLowMarginalGain: 0.42,
            },
          },
          modelAudit: {
            within1ptPct: 64,
            within2ptPct: 86,
          },
        },
      },
      res: {
        turnout: { expectedPct: 56 },
      },
      benchmarkWarnings: ["benchmark drift"],
      evidenceWarnings: [{ id: "ev_1" }],
      driftSummary: {
        hasLog: true,
        actualCR: 18,
        assumedCR: 22,
        actualSR: 55,
        assumedSR: 57,
        actualAPH: 24,
        expectedAPH: 28,
      },
    };
    const a = computeModelGovernance(input);
    const b = computeModelGovernance(input);
    const snapshot = buildGovernanceSnapshotView(a);
    const validationChecklist = buildGovernanceValidationChecklist(a);
    const driftChecklist = buildDriftValidationChecklist(input.driftSummary);
    assert(JSON.stringify(a) === JSON.stringify(b), "governance outputs must be deterministic");
    assert(Number.isFinite(Number(a?.realism?.score)), "realism score should be finite");
    assert(Number.isFinite(Number(a?.dataQuality?.score)), "data quality score should be finite");
    assert(Number.isFinite(Number(a?.execution?.score)), "execution realism score should be finite");
    assert(String(a?.execution?.status || "").length > 0, "execution realism status missing");
    assert(typeof a?.confidence?.band === "string" && a.confidence.band.length > 0, "confidence band missing");
    assert(Number.isFinite(Number(a?.confidence?.influences?.execution)), "confidence execution influence missing");
    assert(String(a?.learning?.topSuggestion?.label || "").trim().length > 0, "learning suggestion missing");
    assert(Array.isArray(a?.guardrails) && a.guardrails.length >= 2, "governance guardrails missing");
    assert(String(snapshot?.confidenceBand || "") === String(a?.confidence?.band || ""), "governance snapshot should preserve confidence band");
    assert(Number.isFinite(Number(snapshot?.confidenceScore)), "governance snapshot confidence score should be finite");
    assert(String(snapshot?.executionStatus || "") === String(a?.execution?.status || ""), "governance snapshot should preserve execution status");
    assert(String(snapshot?.executionUpliftSource || "") === String(a?.execution?.uplift?.source || ""), "governance snapshot should preserve execution uplift source");
    assert(Number.isFinite(Number(snapshot?.topSensitivityDeltaWinPct)), "governance snapshot should preserve top sensitivity delta");
    assert(String(snapshot?.learningTopSuggestion || "").trim().length > 0, "governance snapshot should preserve learning top suggestion");
    assert(Array.isArray(validationChecklist) && validationChecklist.length >= 6, "governance validation checklist should include canonical governance rows");
    assert(validationChecklist.some((row) => String(row?.text || "").includes("Governance realism")), "governance validation checklist should include realism row");
    assert(validationChecklist.some((row) => String(row?.text || "").includes("Top sensitivity driver")), "governance validation checklist should include top sensitivity row");
    assert(validationChecklist.some((row) => String(row?.text || "").includes("Calibration:")), "governance validation checklist should include warning rows");
    assert(Array.isArray(driftChecklist) && driftChecklist.length === 3, "drift validation checklist should include CR/SR/APH rows when drift data exists");
    assert(driftChecklist.some((row) => row.kind === "warn" && String(row?.text || "").includes("Rolling CR")), "drift checklist should warn on CR underperformance");
    assert(driftChecklist.some((row) => row.kind === "ok" && String(row?.text || "").includes("Rolling SR")), "drift checklist should keep SR row ok when within tolerance");
    assert(Array.isArray(buildDriftValidationChecklist(null)) && buildDriftValidationChecklist(null).length === 0, "drift validation checklist should be empty without drift summary");
    return true;
  });

  test("Rebuild contracts: validation checklist view is canonical and deterministic", () => {
    const input = {
      state: {
        undecidedMode: "user_defined",
        weeksRemaining: 9,
      },
      res: {
        validation: {
          universeOk: false,
          turnoutOk: true,
          candidateTableOk: false,
          userSplitOk: false,
          persuasionOk: false,
        },
        expected: {
          persuasionNeed: 240,
        },
      },
      weeks: 9,
      benchmarkWarnings: ["Benchmark drift warning", "Benchmark drift warning"],
      evidenceWarnings: ["Missing benchmark evidence"],
      driftSummary: {
        hasLog: true,
        actualCR: 18,
        assumedCR: 22,
        actualSR: 57,
        assumedSR: 56,
        actualAPH: 24,
        expectedAPH: 26,
      },
      governance: null,
      resolutionContract: {
        ok: false,
        missingInOptions: ["tract"],
        unsupportedByNormalize: ["place"],
      },
      dependencyHealth: {
        ok: false,
        issues: [{ kind: "warn", text: "Dependency warning" }],
      },
      footprint: {
        issues: [{ kind: "warn", text: "Footprint warning" }],
        alignment: {
          footprintDefined: true,
          selectionMatches: true,
          provenanceAligned: true,
        },
      },
      censusPaceSnapshot: {
        hasRows: true,
        applyMultipliers: true,
        pace: {
          ready: true,
          requiredAph: 4.4,
          availableAphRange: { low: 2.1, mid: 3.9, high: 4.6 },
          severity: "warn",
        },
      },
    };
    const a = buildValidationChecklistView(input);
    const b = buildValidationChecklistView(input);
    const benchmarkRows = a.filter((row) => row?.text === "Benchmark drift warning");

    assert(JSON.stringify(a) === JSON.stringify(b), "validation checklist view should be deterministic");
    assert(a.some((row) => row.kind === "bad" && row.text === "Universe size missing or invalid."), "validation checklist should include universe guardrail");
    assert(a.some((row) => row.kind === "bad" && row.text === "Candidate + undecided totals must equal 100%."), "validation checklist should include candidate-table guardrail");
    assert(a.some((row) => row.kind === "bad" && row.text === "User-defined undecided split must total 100% across candidates."), "validation checklist should include user-defined split guardrail");
    assert(
      a.some((row) => row.kind === "bad" && row.text.includes("Census resolution contract mismatch (tract, place).")),
      "validation checklist should include canonical census contract mismatch text",
    );
    assert(a.some((row) => row.kind === "warn" && row.text === "Dependency warning"), "validation checklist should include dependency warnings");
    assert(a.some((row) => row.kind === "warn" && row.text === "Footprint warning"), "validation checklist should include footprint warnings");
    assert(a.some((row) => row.kind === "ok" && row.text === "Census selection matches race footprint."), "validation checklist should include alignment-ok row");
    assert(a.some((row) => row.kind === "ok" && row.text === "Assumption provenance aligned with race footprint."), "validation checklist should include provenance-ok row");
    assert(
      a.some((row) => row.kind === "warn" && row.text === "Census APH feasibility (Census-adjusted assumptions ON): required 4.4 is near high achievable 4.6 (band 2.1/3.9/4.6)."),
      "validation checklist should include canonical census APH warn copy",
    );
    assert(a.some((row) => row.text.includes("Rolling CR")), "validation checklist should include drift row output");
    assert(benchmarkRows.length === 1, "validation checklist should dedupe duplicate benchmark warnings");
    return true;
  });

  test("Rebuild contracts: confidence profile includes execution readiness influence when provided", () => {
    const base = computeConfidenceProfile({
      p10: -120,
      p50: 20,
      p90: 160,
      realismScore: 70,
      dataQualityScore: 70,
      historicalAccuracyScore: 70,
    });
    const lowExec = computeConfidenceProfile({
      p10: -120,
      p50: 20,
      p90: 160,
      realismScore: 70,
      dataQualityScore: 70,
      historicalAccuracyScore: 70,
      executionReadinessScore: 20,
    });
    const highExec = computeConfidenceProfile({
      p10: -120,
      p50: 20,
      p90: 160,
      realismScore: 70,
      dataQualityScore: 70,
      historicalAccuracyScore: 70,
      executionReadinessScore: 90,
    });
    assert(Number(highExec?.score) > Number(lowExec?.score), "higher execution readiness should raise confidence score");
    assert(Number(base?.score) > 0, "baseline confidence score should be finite");
    assert(Number.isFinite(Number(lowExec?.influences?.execution)), "execution influence should be present when provided");
    return true;
  });

  test("Rebuild contracts: outcome view helpers are canonical and deterministic", () => {
    const riskLabel = buildOutcomeRiskLabel({
      p10: "-12",
      p50: "+8",
      p90: "+34",
      winProb: "58%",
    });
    const missRisk = buildMissRiskSummary({
      outcomeP10: "-12",
      outcomeWinProb: "58%",
      outcomeRiskLabel: riskLabel,
    });
    const fragility = buildOutcomeFragility("-18", "+66");
    const cliff = buildOutcomeCliff("-4", "+5");
    const shiftFromMargin = deriveShiftFromMargin("-3.2");
    const confidenceStats = buildOutcomeConfidenceStats("-10", "+8", "+36", "62%");
    const bridgeWinProb = formatOutcomeBridgeWinProb(0.6234);
    const bridgePercent = formatOutcomeBridgePercent("42.5%");
    const percentFromPct = formatOutcomePercentFromPct(55.55, 1);
    const bridgeWhole = formatOutcomeBridgeWhole(7.8);
    const bridgeWholeMin = formatOutcomeBridgeWhole(-2.2);
    const bridgeDecimal = formatOutcomeBridgeDecimal(0.12345, 3);
    const bridgeMargin = formatOutcomeBridgeMargin(-3.4);
    const turnoutExpectedText = buildOutcomeTurnoutExpectedText(53.21);
    const turnoutBandText = buildOutcomeTurnoutBandText(52.2, 48.9);
    const turnoutBandFallback = buildOutcomeTurnoutBandText(null, 48.9);
    const supportTotalText = buildOutcomeSupportTotalText(49.96);
    const expectedVoteTexts = buildOutcomeExpectedVoteTexts(
      {
        turnoutVotes: 1200.4,
        winThreshold: "800",
        yourVotes: 765.2,
        persuasionNeed: null,
        earlyVotes: 410.7,
        edVotes: 389.1,
        persuasionUniverse: "913",
      },
      {
        formatInt: (value) => `#${value.toLocaleString("en-US")}`,
      },
    );
    const expectedVoteFallback = buildOutcomeExpectedVoteTexts({}, { formatInt: null });
    const sensitivityImpact = formatOutcomeSensitivityImpact(1.239, 2);
    const sensitivityImpactFallback = formatOutcomeSensitivityImpact("n/a", 2);
    const svgCoord = formatOutcomeSvgCoord(12.3456, 2);
    const svgCoordFallback = formatOutcomeSvgCoord("n/a", 2, "0.00");
    const winProbMarker = buildOutcomeWinProbMarkerView(0.62, { width: 300 });
    const winProbMarkerFallback = buildOutcomeWinProbMarkerView("n/a", { width: 300 });
    const histogramVisual = buildOutcomeHistogramVisualView({
      counts: [2, 4, 1],
      min: -5,
      max: 5,
    }, { width: 300, baseY: 76, topY: 12 });
    const histogramVisualFallback = buildOutcomeHistogramVisualView(null, { width: 300, baseY: 76, topY: 12 });
    const riskFraming = buildOutcomeRiskFramingView({
      mcResult: {
        winProb: 0.62,
        confidenceEnvelope: {
          percentiles: {
            p10: 1,
            p50: 3,
            p90: 4,
          },
        },
      },
      formatSigned: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        const rounded = Math.round(n);
        return rounded >= 0 ? `+${rounded}` : `${rounded}`;
      },
      clampFn: (value, min, max) => Math.min(max, Math.max(min, Number(value))),
    });
    const riskFramingStale = buildOutcomeRiskFramingView({
      mcResult: {
        winProb: 0.62,
        confidenceEnvelope: {
          percentiles: {
            p10: 1,
            p50: 3,
            p90: 4,
          },
        },
      },
      formatSigned: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        const rounded = Math.round(n);
        return rounded >= 0 ? `+${rounded}` : `${rounded}`;
      },
      clampFn: (value, min, max) => Math.min(max, Math.max(min, Number(value))),
      mcStaleness: { isStale: true, reasonText: "inputs changed" },
    });
    const riskFramingEmpty = buildOutcomeRiskFramingView({});
    const surfaceSummary = buildOutcomeSurfaceSummaryText({
      spec: { fmt: (value) => Number(value).toFixed(1) },
      result: {
        analysis: {
          safeZone: { min: 1, max: 2.5 },
          cliffPoints: [{ at: 1.4 }, { at: 2.1 }, { at: 2.8 }, { at: 3.3 }],
          diminishingZones: [{ min: 2.2, max: 4.0 }, { min: 4.0, max: 5.0 }],
          fragilityPoints: [{ at: 1.1 }],
        },
      },
      targetPercent: 75,
    });
    const surfaceSummaryNone = buildOutcomeSurfaceSummaryText({
      spec: { fmt: (value) => String(value) },
      result: { analysis: {} },
      targetPercent: 70,
    });

    assert(riskLabel === "Moderate risk", "outcome risk label should resolve from canonical downside logic");
    assert(missRisk === "Moderate miss risk", "miss-risk summary should use canonical risk label mapping");
    assert(fragility === "High", "fragility should derive from canonical percentile spread");
    assert(cliff === "Potential cliff under downside path", "cliff text should derive from canonical downside crossover");
    assert(shiftFromMargin === "4", "shift-from-margin should round up required recovery");
    assert(confidenceStats.marginOfSafety === "-10 net votes", "confidence stats margin of safety should come from canonical formatter");
    assert(confidenceStats.downside === "Elevated downside risk", "confidence stats downside text mismatch");
    assert(confidenceStats.shiftTo60 === "0", "shift-to-60 should be zero when already above threshold");
    assert(confidenceStats.shiftTo70 === "4", "shift-to-70 should reflect canonical probability gap logic");
    assert(confidenceStats.shock10 === "Vulnerable", "shock guidance should derive from canonical buffered margin");
    assert(bridgeWinProb === "62.3%", "bridge win-prob formatter should resolve canonical percent output");
    assert(bridgePercent === "42.5%", "bridge percent formatter should normalize mixed percent input");
    assert(percentFromPct === "55.5%", "outcome pct formatter should round and append percent symbol canonically");
    assert(bridgeWhole === "8", "bridge whole formatter should round to canonical non-negative whole");
    assert(bridgeWholeMin === "0", "bridge whole formatter should clamp negatives to zero");
    assert(bridgeDecimal === "0.123", "bridge decimal formatter should use fixed precision");
    assert(bridgeMargin === "-3", "bridge margin formatter should use canonical signed-whole formatting");
    assert(turnoutExpectedText === "53.2%", "outcome turnout-expected text helper should render one-decimal percent text");
    assert(turnoutBandText === "52.2% / 48.9%", "outcome turnout-band text helper should render best/worst percent range");
    assert(turnoutBandFallback === "—", "outcome turnout-band text helper should fall back when either value is missing");
    assert(supportTotalText === "50.0%", "outcome support-total text helper should render canonical one-decimal percent text");
    assert(expectedVoteTexts.turnoutVotesText === "#1,200", "expected-vote turnout text should use canonical formatter path");
    assert(expectedVoteTexts.winThresholdText === "#800", "expected-vote threshold text should normalize numeric strings");
    assert(expectedVoteTexts.yourVotesText === "#765", "expected-vote your-votes text should round before formatting");
    assert(expectedVoteTexts.persuasionNeedText === "—", "expected-vote persuasion-need text should fallback for missing values");
    assert(expectedVoteTexts.earlyVotesText === "#411", "expected-vote early-vote text should round and format canonically");
    assert(expectedVoteTexts.edVotesText === "#389", "expected-vote election-day text should round and format canonically");
    assert(expectedVoteTexts.persuasionUniverseText === "#913", "expected-vote persuasion-universe text should normalize numeric strings");
    assert(expectedVoteFallback.turnoutVotesText === "—", "expected-vote helper should fallback when values are missing");
    assert(sensitivityImpact === "1.24", "outcome sensitivity impact formatter should round to canonical precision");
    assert(sensitivityImpactFallback === "—", "outcome sensitivity impact formatter should return fallback for invalid values");
    assert(svgCoord === "12.35", "outcome SVG coordinate formatter should round to canonical fixed precision");
    assert(svgCoordFallback === "0.00", "outcome SVG coordinate formatter should return canonical fallback for invalid values");
    assert(winProbMarker.xText === "186.00", "outcome win-prob marker view should project canonical marker coordinate text");
    assert(winProbMarkerFallback.xText === "0.00", "outcome win-prob marker view should fallback to zero position when win probability is invalid");
    assert(histogramVisual.valid === true, "outcome histogram visual view should mark valid histogram inputs");
    assert(histogramVisual.zeroXText === "150.00", "outcome histogram visual view should project canonical zero-axis coordinate");
    assert(histogramVisual.bars.length === 3, "outcome histogram visual view should preserve canonical bar count");
    assert(histogramVisual.bars[0]?.xText === "0.60", "outcome histogram visual view should project canonical first-bar x coordinate");
    assert(histogramVisual.bars[0]?.yText === "44.00", "outcome histogram visual view should project canonical first-bar y coordinate");
    assert(histogramVisual.bars[0]?.widthText === "98.80", "outcome histogram visual view should project canonical first-bar width coordinate");
    assert(histogramVisual.bars[0]?.heightText === "32.00", "outcome histogram visual view should project canonical first-bar height coordinate");
    assert(histogramVisualFallback.valid === false, "outcome histogram visual view should flag invalid histogram inputs");
    assert(histogramVisualFallback.zeroXText === "150.00", "outcome histogram visual view should fallback zero-axis coordinate deterministically");
    assert(riskFraming.tagLabel === "Lean", "risk framing should classify moderate-probability low-volatility runs as lean");
    assert(riskFraming.tagKind === "warn", "risk framing should map lean band to warning tone");
    assert(riskFraming.winProbText === "62.0%", "risk framing win probability should use canonical percentage formatter");
    assert(riskFraming.marginBandText === "+1 to +4 (p50: +3)", "risk framing margin band should use canonical percentile formatting");
    assert(riskFraming.volatilityText === "Medium (±1.5 pts)", "risk framing volatility text should use canonical spread math");
    assert(
      riskFraming.bannerText.startsWith("Leaning win: 62% model win chance."),
      "risk framing banner should use canonical lean narrative copy",
    );
    assert(riskFramingStale.tagLabel === "Stale MC", "stale risk framing should override the canonical tag label");
    assert(riskFramingStale.tagKind === "warn", "stale risk framing should use warning tone");
    assert(
      riskFramingStale.bannerText.includes("Monte Carlo is stale (inputs changed)."),
      "stale risk framing banner should include canonical stale reason copy",
    );
    assert(
      riskFramingEmpty.bannerText === "Run Monte Carlo to populate risk framing.",
      "empty risk framing should return canonical no-run banner copy",
    );
    assert(
      surfaceSummary === "Safe zone (≥ 75%): 1.0 to 2.5 • Cliff edges: 1.4, 2.1, 2.8… • Diminishing returns: 2.2 to 4.0… • Fragility points: 1.1",
      "outcome surface summary should format canonical safe-zone/cliff/diminishing/fragility copy",
    );
    assert(
      surfaceSummaryNone === "Safe zone (≥ 70%): none • Cliff edges: none • Diminishing returns: none • Fragility points: none",
      "outcome surface summary should emit canonical none-state copy when analysis buckets are empty",
    );
    return true;
  });

  test("Rebuild contracts: outcome status helpers are canonical and deterministic", () => {
    const mcStatus = buildOutcomeMcStatus("62%", "-10", "+30");
    assert(mcStatus?.freshTag === "MC snapshot available", "mc status should mark snapshot available when win-prob is present");
    assert(mcStatus?.staleTag === "Current distribution loaded", "mc status should mark distribution loaded when spread is non-flat");

    const forecastStatus = deriveOutcomeForecastCardStatus("62%", "Moderate risk");
    const confidenceStatus = deriveOutcomeConfidenceCardStatus("Moderate", "Potential cliff under downside path");
    const sensitivityStatus = deriveOutcomeSensitivityCardStatus(
      [{ label: "Contact rate", impact: 1.2 }],
      "Compute to see safe zones, cliffs, and diminishing returns.",
    );
    const interpretationStatus = deriveOutcomeInterpretationCardStatus([{ label: "Contact rate" }], []);
    const riskFlagsStatus = deriveOutcomeRiskFlagsCardStatus(
      mcStatus,
      "Moderate risk",
      { executionStatus: "warn", confidenceBand: "medium", learningSampleSize: 6 },
    );
    const summaryStatus = deriveOutcomeSummaryCardStatus("Moderate risk", "62%", "Moderate");
    const gapValue = deriveGapFromNote("Short by 200 attempts/week.");
    const governanceSignal = formatOutcomeGovernanceSignal("warn", 72.4);
    const governanceSignalNoScore = formatOutcomeGovernanceSignal("ok", null);
    const governanceStatusLabel = formatStatusWithScoreOutOfHundred("warn", 72.4, 1);
    const signedPointsLabel = formatSignedPointsFromUnit(0.1234, 2);
    const toneOk = classifyOutcomeStatusTone("Stable");
    const toneWarn = classifyOutcomeStatusTone("Competitive");
    const toneBad = classifyOutcomeStatusTone("Fragile");

    assert(forecastStatus === "Competitive", "forecast status should resolve from canonical win/risk mapping");
    assert(confidenceStatus === "Watch", "confidence status should resolve from canonical fragility/cliff mapping");
    assert(sensitivityStatus === "Surface ready", "sensitivity status should detect canonical surface-ready note");
    assert(interpretationStatus === "Explainable", "interpretation status should resolve from available evidence rows");
    assert(riskFlagsStatus === "Execution watch", "risk flags should prioritize execution watch when governance execution warns");
    assert(summaryStatus === "Watch", "summary status should resolve from canonical risk/fragility mapping");
    assert(gapValue === "200", "gap extraction should use canonical numeric parse rule");
    assert(governanceSignal === "WARN (72.4/100)", "governance signal formatter should produce canonical score label");
    assert(governanceSignalNoScore === "OK", "governance signal formatter should preserve status-only labels when score is absent");
    assert(governanceStatusLabel === "WARN (72.4/100)", "status/score label formatter should align with canonical governance labeling");
    assert(signedPointsLabel === "+12.34 pp", "signed points formatter should produce canonical percentage-point labels");
    assert(toneOk === "ok", "outcome status tone should map stable to ok");
    assert(toneWarn === "warn", "outcome status tone should map competitive to warn");
    assert(toneBad === "bad", "outcome status tone should map fragile to bad");
    assert(OUTCOME_STATUS_AWAITING_RUN === "Awaiting run", "outcome awaiting-run constant mismatch");
    return true;
  });

  test("Rebuild contracts: plan view helpers are canonical and deterministic", () => {
    const workloadBanner = buildPlanWorkloadBanner("", "");
    const optimizerBanner = buildPlanOptimizerBanner("budget", "Budget-limited scenario.");
    const timelineBanner = buildPlanTimelineBanner("84%", "timeline capacity", "320", "140");
    const decisionWarning = buildPlanDecisionWarning("timeline", "140", "net votes");

    const recommendationVol = buildPlanRecommendationVolunteers("capacity", "320");
    const recommendationCost = buildPlanRecommendationCost("budget", "net votes");
    const recommendationProb = buildPlanRecommendationProbability("timeline", "140");
    const officeBestText = buildPlanOfficeBestText({
      officeName: "west",
      objectivePerDollar: "0.1000",
      upliftExpectedMarginalGain: "62%",
      topChannel: "doors",
    });
    const officeBestFallback = buildPlanOfficeBestText({}, { fallback: "No office" });
    const officePathRowsView = buildPlanOfficePathTableRowsView([
      {
        officeName: "West",
        objectiveValue: "100",
        objectivePerDollar: "0.1000",
        objectivePerOrganizerHour: "0.250",
        upliftExpectedMarginalGain: "62%",
        upliftSource: "Targeting rows",
        topChannel: "doors",
      },
      {
        officeId: "east",
      },
    ]);

    const volunteerLevers = buildPlanVolunteerLevers("capacity", "320");
    const costLevers = buildPlanCostLevers("budget", "320");
    const probabilityLevers = buildPlanProbabilityLevers("timeline", "140");
    const weekPreview = buildPlanWeekPreviewText(
      [{ week: 1, attempts: 120.2 }, { week: 2, attempts: 132.7 }],
      { formatInt: (value) => String(value) },
    );
    const weekPreviewFallback = buildPlanWeekPreviewText([], { fallbackText: "No preview rows." });
    const bindingText = derivePlanBindingText({ timeline: ["doors", "phones"], budget: true, capacity: true });
    const goalFeasibleYes = formatPlanGoalFeasible(true);
    const goalFeasibleNo = formatPlanGoalFeasible(false);
    const goalFeasibleUnknown = formatPlanGoalFeasible(null);
    const goalFeasibleBoolean = formatPlanGoalFeasible(true, { trueLabel: "true", falseLabel: "false", unknownLabel: "—" });
    const ratePct = buildPlanRatePercentText(0.166, { max: 1.25 });
    const wholeFormatted = formatPlanWhole(1234.6);
    const wholeMissing = formatPlanWhole("n/a");
    const currencyFormatted = formatPlanCurrency(3210.2);
    const currencyMissing = formatPlanCurrency(undefined);
    const customPlanNumber = buildPlanNumberFormatters((value) => `#${value.toLocaleString("en-US")}`);
    const defaultPlanNumber = buildPlanNumberFormatters(null);
    const percentUnitFormatted = formatPlanPercentUnit(0.842);
    const percentUnitOver = formatPlanPercentUnit(1.2);
    const percentUnitMissing = formatPlanPercentUnit("n/a");
    const autoWeeksRounded = formatPlanAutoWeeksInputValue(7.6);
    const autoWeeksNegative = formatPlanAutoWeeksInputValue(-1.1);
    const autoWeeksMissing = formatPlanAutoWeeksInputValue("n/a");
    const interpretationFallback = buildPlanOptimizerInterpretationText({
      objectiveCopy: { metricLabel: "Net votes" },
      upliftSummary: {},
      buildUpliftSummaryText: () => "",
    });
    const summaryView = buildPlanSummaryView({
      objectiveCopy: { value: "net", metricLabel: "Net votes" },
      conversion: {
        conversationsNeeded: 450,
        doorsNeeded: 900,
        doorsPerShift: 50,
        totalShifts: 18,
        shiftsPerWeek: 6,
        volunteersNeeded: 24,
        feasibility: { text: "Capacity feasible" },
      },
      timeline: {
        percentPlanExecutable: 0.84,
        projectedCompletionWeek: 7.6,
        shortfallAttempts: 320,
        constraintType: "timeline capacity",
        weeklyPlan: [{ week: 1, attempts: 120.2 }],
      },
      timelineObjectiveMeta: { shortfallObjectiveValue: 140 },
      tlMeta: { goalFeasible: false, bindingObj: { timeline: ["doors"], budget: true } },
      tlObjectiveMeta: { maxAchievableObjectiveValue: 980, remainingGapObjectiveValue: 140 },
      lastSummary: {
        cost: 5600,
        banner: "Optimizer ready",
        gapContext: "Gap context",
        upliftSummary: {
          source: "targeting_rows",
          bestChannel: "doors",
          weightedExpectedMarginalGain: 0.62,
          weightedLowMarginalGain: 0.42,
          uncertaintyBand: "medium",
          saturationPressure: "high",
        },
        officePaths: {
          bestByDollar: {
            officeId: "west",
            officeName: "west",
            objectiveValue: 100,
            objectivePerDollar: 0.1,
            objectivePerOrganizerHour: 0.2,
            upliftExpectedMarginalGain: 0.62,
            upliftLowMarginalGain: 0.42,
            upliftUncertaintyBand: "medium",
            upliftSaturationPressure: "high",
            upliftSource: "targeting_rows",
            topChannel: "doors",
          },
          bestByOrganizerHour: {
            officeId: "east",
            officeName: "east",
            objectiveValue: 80,
            objectivePerDollar: 0.08,
            objectivePerOrganizerHour: 0.4,
            upliftExpectedMarginalGain: 0.56,
            upliftLowMarginalGain: 0.37,
            upliftUncertaintyBand: "high",
            upliftSaturationPressure: "medium",
            upliftSource: "targeting_rows",
            topChannel: "phones",
          },
          rows: [
            {
              officeId: "west",
              officeName: "west",
              objectiveValue: 100,
              objectivePerDollar: 0.1,
              objectivePerOrganizerHour: 0.2,
              upliftExpectedMarginalGain: 0.62,
              upliftLowMarginalGain: 0.42,
              upliftUncertaintyBand: "medium",
              upliftSaturationPressure: "high",
              upliftSource: "targeting_rows",
              topChannel: "doors",
            },
            {
              officeId: "east",
              officeName: "east",
              objectiveValue: 80,
              objectivePerDollar: 0.08,
              objectivePerOrganizerHour: 0.4,
              upliftExpectedMarginalGain: 0.56,
              upliftLowMarginalGain: 0.37,
              upliftUncertaintyBand: "high",
              upliftSaturationPressure: "medium",
              upliftSource: "targeting_rows",
              topChannel: "phones",
            },
          ],
        },
      },
      lastOptTotals: { attempts: 1300, cost: 5700, netVotes: 880 },
      lastOpt: { binding: "budget" },
      diagnostics: { primaryBottleneck: "timeline", secondaryNotes: "staffing" },
      formatInt: (value) => String(Math.round(value)),
      formatWhole: (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? String(Math.round(n)) : "—";
      },
      formatCurrency: (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? `$${Math.round(n)}` : "—";
      },
      formatPercentUnit: (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
      },
    });
    const normalizedOptimizerRows = normalizePlanOptimizerRows([
      {
        id: "doors",
        tactic: "Doors",
        attempts: "102.8",
        expectedContacts: "45.4",
        expectedNetVotes: "12.2",
        expectedObjectiveValue: "14.1",
        cost: "220.7",
        costPerNetVote: "18.09",
        upliftExpectedMarginalGain: "0.62",
        upliftLowMarginalGain: "0.42",
        upliftGainPerDollar: "0.0034",
        upliftSource: "targeting_rows",
        upliftUncertaintyBand: "medium",
        upliftSaturationPressure: "high",
        saturationUtilization: "0.81",
      },
      {
        id: "phones",
        attempts: null,
      },
    ]);
    const optimizerAllocationRows = buildPlanOptimizerAllocationRowsView([
      {
        tactic: "Doors",
        attempts: 120,
        cost: 360,
        expectedObjectiveValue: 18,
      },
      {
        tactic: "Phones",
        attempts: 0,
        cost: 0,
        expectedObjectiveValue: 0,
      },
    ], {
      formatWhole: (value) => String(Math.round(Number(value) || 0)),
      formatCurrency: (value) => `$${Math.round(Number(value) || 0)}`,
    });
    const optimizerAllocationRowsWithZero = buildPlanOptimizerAllocationRowsView([
      {
        tactic: "Doors",
        attempts: 120,
        cost: 360,
        expectedObjectiveValue: 18,
      },
      {
        tactic: "Phones",
        attempts: 0,
        cost: 0,
        expectedObjectiveValue: 0,
      },
    ], {
      includeZeroAttempts: true,
      formatWhole: (value) => String(Math.round(Number(value) || 0)),
      formatCurrency: (value) => `$${Math.round(Number(value) || 0)}`,
    });
    const optimizerTotalsView = buildPlanOptimizerTotalsView({
      attempts: 1300,
      cost: 5700,
      objectiveValue: 880,
      binding: "budget",
    }, {
      formatWhole: (value) => String(Math.round(Number(value) || 0)),
      formatCurrency: (value) => `$${Math.round(Number(value) || 0)}`,
    });
    const optimizerTotalsFallback = buildPlanOptimizerTotalsView(null);
    const marginalDiagnosticsRows = buildPlanMarginalDiagnosticsRowsView([
      {
        intervention: "add organizer",
        deltaObjectiveValue: 25.4,
        deltaCost: 900.1,
        notes: "highest impact",
      },
      {
        intervention: "add volunteers",
        deltaMaxNetVotes: 11.8,
        deltaCost: 0,
        notes: "",
      },
    ], {
      formatWhole: (value) => String(Math.round(Number(value) || 0)),
      formatCurrency: (value) => `$${Math.round(Number(value) || 0)}`,
    });

    const workloadStatus = derivePlanWorkloadCardStatus(workloadBanner);
    const optimizerStatus = derivePlanOptimizerCardStatus({ attempts: "1200" }, optimizerBanner, "budget");
    const timelineStatus = derivePlanTimelineCardStatus({ inputs: { timelineEnabled: true } }, "84%", "timeline capacity");
    const riskStatus = derivePlanRiskCardStatus("84%", "timeline capacity", "140");
    const actionsStatus = derivePlanActionsCardStatus("timeline capacity", "budget", "140");
    const summaryStatus = derivePlanSummaryCardStatus("84%", "timeline capacity", "budget");
    const tone = classifyPlanStatusTone("Recovery plan");

    assert(workloadBanner === PLAN_WORKLOAD_STATUS_FALLBACK, "plan workload fallback should be canonical");
    assert(optimizerBanner === "budget is currently binding. Budget-limited scenario.", "plan optimizer banner mismatch");
    assert(timelineBanner.includes("Executable: 84%"), "plan timeline banner should include executable summary");
    assert(decisionWarning.includes("Execution risk is elevated"), "plan decision warning should detect timeline/capacity risk");

    assert(recommendationVol.includes("capacity bottleneck"), "volunteer recommendation should acknowledge capacity constraint");
    assert(recommendationCost.includes("lower-cost channels"), "cost recommendation should match canonical budget guidance");
    assert(recommendationProb.includes("de-risking timeline"), "probability recommendation should match canonical timeline guidance");
    assert(officeBestText === "west · 0.1000 / $ · uplift 62% · top doors", "plan office-best formatter should preserve canonical office-path summary text");
    assert(officeBestFallback === "No office", "plan office-best formatter should preserve explicit fallback");
    assert(Array.isArray(officePathRowsView) && officePathRowsView.length === 2, "plan office-path table-row helper should preserve row count");
    assert(officePathRowsView[0]?.officeName === "West", "plan office-path table-row helper should preserve office label");
    assert(officePathRowsView[0]?.upliftSource === "Targeting rows", "plan office-path table-row helper should preserve uplift source label");
    assert(officePathRowsView[1]?.officeName === "east", "plan office-path table-row helper should fall back to officeId");
    assert(officePathRowsView[1]?.objectiveValue === "—", "plan office-path table-row helper should apply canonical fallback markers");

    assert(Array.isArray(volunteerLevers) && volunteerLevers.length >= 1, "volunteer levers should be present");
    assert(Array.isArray(costLevers) && costLevers.length >= 1, "cost levers should be present");
    assert(Array.isArray(probabilityLevers) && probabilityLevers.length >= 1, "probability levers should be present");
    assert(weekPreview === "Week 1: 120 attempts\nWeek 2: 133 attempts", "plan week preview should format canonical weekly attempt rows");
    assert(weekPreviewFallback === "No preview rows.", "plan week preview should respect explicit fallback text");
    assert(bindingText === "doors / phones", "plan binding text should prioritize joined timeline constraints");
    assert(goalFeasibleYes === "Yes", "plan goal-feasible formatter should map true to canonical yes label");
    assert(goalFeasibleNo === "No", "plan goal-feasible formatter should map false to canonical no label");
    assert(goalFeasibleUnknown === "—", "plan goal-feasible formatter should map unknown values to canonical fallback");
    assert(goalFeasibleBoolean === "true", "plan goal-feasible formatter should support custom labels for legacy bridges");
    assert(ratePct === "17%", "plan rate-percent formatter should clamp + round canonical percentages");
    assert(wholeFormatted === "1,235", "plan whole formatter should provide canonical rounded integer text");
    assert(wholeMissing === "—", "plan whole formatter should provide canonical missing marker");
    assert(currencyFormatted === "$3,210", "plan currency formatter should provide canonical rounded dollar text");
    assert(currencyMissing === "—", "plan currency formatter should provide canonical missing marker");
    assert(customPlanNumber.formatWhole(1234.6) === "#1,235", "plan number formatter bundle should reuse provided integer formatter for whole numbers");
    assert(customPlanNumber.formatCurrency(987.2) === "$#987", "plan number formatter bundle should reuse provided integer formatter for currency values");
    assert(customPlanNumber.roundWhole("n/a") === 0, "plan number formatter bundle should round invalid values to zero for execution bridges");
    assert(customPlanNumber.formatIntRound(1200.4) === "#1,200", "plan number formatter bundle should produce canonical rounded-int labels");
    assert(defaultPlanNumber.formatWhole(42.2) === "42", "plan number formatter bundle should fall back to canonical locale whole formatting");
    assert(defaultPlanNumber.formatCurrency(42.2) === "$42", "plan number formatter bundle should fall back to canonical locale currency formatting");
    assert(percentUnitFormatted === "84%", "plan percent-unit formatter should convert unit fractions to canonical whole-percent text");
    assert(percentUnitOver === "100%", "plan percent-unit formatter should clamp to canonical unit max by default");
    assert(percentUnitMissing === "—", "plan percent-unit formatter should provide canonical missing marker");
    assert(autoWeeksRounded === "8", "plan auto-weeks formatter should round to canonical whole-week input text");
    assert(autoWeeksNegative === "0", "plan auto-weeks formatter should clamp negative week values to zero");
    assert(autoWeeksMissing === "", "plan auto-weeks formatter should return empty string for missing week values");
    assert(
      interpretationFallback.includes("strongest marginal net votes"),
      "plan optimizer interpretation fallback should include canonical objective metric copy",
    );
    assert(summaryView.workload.statusText === "Capacity feasible", "plan summary view should preserve conversion feasibility status");
    assert(summaryView.optimizer.totalAttempts === "1300", "plan summary view should format optimizer attempts from canonical totals");
    assert(summaryView.optimizer.totalCost === "$5600", "plan summary view should prioritize last summary cost");
    assert(summaryView.optimizer.totalValue === "880", "plan summary view should fallback objective value to canonical net-vote totals");
    assert(summaryView.optimizer.binding === "budget", "plan summary view should prefer explicit optimizer binding");
    assert(summaryView.optimizer.gapContext === "Gap context", "plan summary view should preserve optimizer gap context text");
    assert(summaryView.optimizer.upliftExpectedMarginalGain === "62%", "plan summary view should format uplift expected marginal gain canonically");
    assert(summaryView.optimizer.upliftLowMarginalGain === "42%", "plan summary view should format uplift low-bound marginal gain canonically");
    assert(summaryView.optimizer.upliftBestChannel === "doors", "plan summary view should preserve uplift best-channel label");
    assert(summaryView.optimizer.upliftSource === "Targeting rows", "plan summary view should preserve uplift source provenance");
    assert(summaryView.optimizer.upliftUncertaintyBand === "medium", "plan summary view should preserve uplift uncertainty band");
    assert(summaryView.optimizer.upliftSaturationPressure === "high", "plan summary view should preserve uplift saturation pressure");
    assert(summaryView.timeline.executablePct === "84%", "plan summary view should format executable percent");
    assert(summaryView.timeline.projectedCompletionWeek === "8", "plan summary view should round projected completion week");
    assert(summaryView.timeline.weekPreviewText === "Week 1: 120 attempts", "plan summary view should compose canonical week preview text");
    assert(summaryView.timeline.binding === "budget", "plan timeline summary should carry canonical binding text");
    assert(summaryView.timeline.goalFeasible === "No", "plan timeline summary should map boolean goal-feasible to Yes/No");
    assert(summaryView.optimizer.officePaths.statusText === "Office path ranking ready.", "plan summary view should expose office path readiness");
    assert(summaryView.optimizer.officePaths.bestByDollar.officeId === "west", "plan summary view should preserve best office by dollar");
    assert(summaryView.optimizer.officePaths.bestByOrganizerHour.officeId === "east", "plan summary view should preserve best office by organizer-hour");
    assert(summaryView.optimizer.officePaths.bestByDollar.objectivePerDollar === "0.1000", "plan summary view should format office objective-per-dollar canonically");
    assert(summaryView.optimizer.officePaths.bestByOrganizerHour.objectivePerOrganizerHour === "0.400", "plan summary view should format office objective-per-organizer-hour canonically");
    assert(summaryView.optimizer.officePaths.bestByDollar.upliftExpectedMarginalGain === "62%", "plan summary view should format best-by-dollar uplift expected canonically");
    assert(summaryView.optimizer.officePaths.bestByOrganizerHour.upliftSource === "Targeting rows", "plan summary view should preserve office-path uplift source");
    assert(normalizedOptimizerRows.length === 2, "plan optimizer-row normalizer should preserve row count");
    assert(normalizedOptimizerRows[0]?.id === "doors", "plan optimizer-row normalizer should preserve row id");
    assert(normalizedOptimizerRows[0]?.attempts === 103, "plan optimizer-row normalizer should round attempts canonically");
    assert(approx(Number(normalizedOptimizerRows[0]?.expectedContacts), 45.4, 1e-9), "plan optimizer-row normalizer expectedContacts mismatch");
    assert(approx(Number(normalizedOptimizerRows[0]?.expectedObjectiveValue), 14.1, 1e-9), "plan optimizer-row normalizer expectedObjectiveValue mismatch");
    assert(approx(Number(normalizedOptimizerRows[0]?.cost), 220.7, 1e-9), "plan optimizer-row normalizer cost mismatch");
    assert(approx(Number(normalizedOptimizerRows[0]?.upliftExpectedMarginalGain), 0.62, 1e-9), "plan optimizer-row normalizer uplift expected mismatch");
    assert(String(normalizedOptimizerRows[0]?.upliftSource || "") === "targeting_rows", "plan optimizer-row normalizer should preserve uplift source");
    assert(String(normalizedOptimizerRows[0]?.upliftUncertaintyBand || "") === "medium", "plan optimizer-row normalizer should preserve uplift uncertainty band");
    assert(String(normalizedOptimizerRows[0]?.upliftSaturationPressure || "") === "high", "plan optimizer-row normalizer should preserve uplift saturation pressure");
    assert(normalizedOptimizerRows[1]?.attempts === 0, "plan optimizer-row normalizer should default missing attempts to zero");
    assert(Array.isArray(optimizerAllocationRows) && optimizerAllocationRows.length === 1, "plan optimizer-allocation helper should hide zero-attempt rows by default");
    assert(optimizerAllocationRows[0]?.attempts === "120", "plan optimizer-allocation helper should format attempts canonically");
    assert(optimizerAllocationRows[0]?.cost === "$360", "plan optimizer-allocation helper should format cost canonically");
    assert(optimizerAllocationRows[0]?.expectedObjectiveValue === "18", "plan optimizer-allocation helper should format expected objective values canonically");
    assert(Array.isArray(optimizerAllocationRowsWithZero) && optimizerAllocationRowsWithZero.length === 2, "plan optimizer-allocation helper should optionally keep zero-attempt rows");
    assert(optimizerAllocationRowsWithZero[1]?.attempts === "0", "plan optimizer-allocation helper should preserve zero attempts when requested");
    assert(optimizerTotalsView.attempts === "1300", "plan optimizer-totals helper should format attempts canonically");
    assert(optimizerTotalsView.cost === "$5700", "plan optimizer-totals helper should format cost canonically");
    assert(optimizerTotalsView.objectiveValue === "880", "plan optimizer-totals helper should format objective totals canonically");
    assert(optimizerTotalsView.binding === "budget", "plan optimizer-totals helper should preserve binding text");
    assert(optimizerTotalsFallback.attempts === "—", "plan optimizer-totals helper should return fallback attempts when missing");
    assert(marginalDiagnosticsRows[0]?.deltaObjectiveValue === "25", "plan marginal diagnostics helper should format objective delta canonically");
    assert(marginalDiagnosticsRows[0]?.deltaCost === "$900", "plan marginal diagnostics helper should format cost delta canonically");
    assert(marginalDiagnosticsRows[1]?.deltaObjectiveValue === "12", "plan marginal diagnostics helper should support deltaMaxNetVotes alias");
    assert(marginalDiagnosticsRows[1]?.notes === "—", "plan marginal diagnostics helper should apply canonical notes fallback");
    assert(Array.isArray(summaryView.optimizer.officePaths.rows) && summaryView.optimizer.officePaths.rows.length === 2, "plan summary view should preserve office path rows");
    assert(summaryView.actions.primary === "timeline", "plan actions summary should preserve primary bottleneck text");
    assert(summaryView.actions.secondary === "staffing", "plan actions summary should preserve secondary bottleneck text");

    assert(workloadStatus === "Awaiting setup", "workload status should map fallback banner to setup state");
    assert(optimizerStatus === "Binding", "optimizer status should detect binding constraint");
    assert(timelineStatus === "Constrained", "timeline status should resolve constrained when executable < 100");
    assert(riskStatus === "Elevated", "risk status should resolve elevated under shortfall");
    assert(actionsStatus === "Recovery plan", "actions status should resolve recovery when shortfall remains");
    assert(summaryStatus === "Constrained", "summary status should resolve constrained under shortfall");
    assert(tone === "bad", "status tone should classify recovery plan as bad");
    assert(typeof PLAN_OPTIMIZER_STATUS_FALLBACK === "string" && PLAN_OPTIMIZER_STATUS_FALLBACK.length > 0, "optimizer fallback constant missing");
    assert(typeof PLAN_OFFICE_PATH_TABLE_EMPTY === "string" && PLAN_OFFICE_PATH_TABLE_EMPTY.length > 0, "office-path table-empty fallback constant missing");
    assert(typeof PLAN_TIMELINE_STATUS_FALLBACK === "string" && PLAN_TIMELINE_STATUS_FALLBACK.length > 0, "timeline fallback constant missing");
    return true;
  });

  test("Rebuild contracts: reach view helpers are canonical and deterministic", () => {
    const weeklyStatusAwaiting = deriveReachWeeklyCardStatus({ paceStatus: "Needs inputs" });
    const weeklyStatusGap = deriveReachWeeklyCardStatus({ paceStatus: "Behind pace" });
    const weeklyStatusFeasible = deriveReachWeeklyCardStatus({ paceStatus: "On pace" });

    const leversAwaiting = deriveReachLeversCardStatus({ rows: [] }, { paceStatus: "On pace" });
    const leversGap = deriveReachLeversCardStatus({ rows: [{ label: "Contact +1pp" }] }, { paceStatus: "Behind pace" });
    const leversBuffer = deriveReachLeversCardStatus({ rows: [{ label: "Contact +1pp" }] }, { paceStatus: "On pace" });

    const actionsAwaiting = deriveReachActionsCardStatus({ note: "", list: [] });
    const actionsDrift = deriveReachActionsCardStatus({ note: "Drift-aware guidance", list: ["Action 1"] });
    const actionsModel = deriveReachActionsCardStatus({ note: "Model-based recommendation", list: ["Action 1"] });
    const actionsActive = deriveReachActionsCardStatus({ note: "Manual note", list: ["Action 1"] });

    const toneOk = classifyReachStatusTone("Model-based");
    const toneWarn = classifyReachStatusTone("Gap focus");
    const toneBad = classifyReachStatusTone("Unavailable");
    const reachIntFactory = buildReachIntFormatter((value) => `#${value.toLocaleString("en-US")}`);
    const reachIntDefault = formatReachInt(1234.6);
    const reachIntCeil = formatReachInt(12.1, { ceil: true });
    const reachIntFloor = formatReachInt(12.9, { floor: true });
    const reachIntCustom = formatReachInt(4500.2, { formatInt: (value) => `#${value.toLocaleString("en-US")}` });
    const reachIntMissing = formatReachInt("n/a");
    const reachIntFactoryRounded = reachIntFactory(102.3);
    const reachIntFactoryCeil = reachIntFactory(102.3, { ceil: true });
    const formatInt = (value, options = {}) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return "—";
      if (options?.ceil) return String(Math.ceil(n));
      if (options?.floor) return String(Math.floor(n));
      return String(Math.round(n));
    };
    const formatIsoDate = (raw) => {
      const dt = (raw instanceof Date) ? raw : new Date(raw);
      if (!Number.isFinite(dt.getTime())) return "—";
      return dt.toISOString().slice(0, 10);
    };
    const weeklyConstraint = buildReachWeeklyConstraintView(
      { goal: 900, weeks: 10, sr: 0.6, cr: 0.25, capTotal: 1100, gap: 220 },
      { formatInt }
    );
    const weeklyExecution = buildReachWeeklyExecutionView({
      ctx: {
        convosPerWeek: 100,
        attemptsPerWeek: 400,
        doorShare: 0.35,
        weeks: 4,
        convosNeeded: 400,
        attemptsNeeded: 1600,
      },
      logSummary: {
        hasLog: true,
        n: 7,
        days: 7,
        sumConvos: 90,
        sumAttempts: 360,
        lastDate: "2026-05-01",
      },
      rollingCR: 0.25,
      formatInt,
      formatDate: formatIsoDate,
      clampFn: (value, min, max) => Math.min(max, Math.max(min, Number(value))),
      now: new Date("2026-05-02T12:00:00.000Z"),
    });
    const weeklyNoLog = buildReachWeeklyExecutionView({
      ctx: {
        convosPerWeek: 100,
        attemptsPerWeek: 400,
        doorShare: 0.35,
      },
      logSummary: { hasLog: false, n: 0 },
      formatInt,
      formatDate: formatIsoDate,
      hideChannelBreakdownWithoutLog: true,
    });
    const formatPct = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";
    };
    const formatNum1 = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(1) : "—";
    };
    const freshnessActive = buildReachFreshnessView({
      state: {
        contactRatePct: 30,
        supportRatePct: 60,
        channelDoorPct: 40,
        doorsPerHour3: 18,
        callsPerHour3: 30,
        ui: {
          dailyLog: [
            { date: "2026-04-26" },
            { date: "2026-05-02" },
          ],
        },
      },
      weeklyContext: { attemptsPerWeek: 300 },
      executionSnapshot: {
        log: {
          hasLog: true,
          sorted: [{ date: "2026-05-02" }],
          sumAttemptsWindow: 240,
          sumConvosWindow: 60,
          sumSupportIdsWindow: 24,
          sumOrgHoursWindow: 12,
        },
        rolling: { cr: 0.25, sr: 0.40, aph: 20 },
        assumptions: { cr: 0.30, sr: 0.60, aph: 22.8 },
        pace: { requiredAttemptsPerWeek: 300, ratio: 0.8 },
      },
      safeNumFn: (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      },
      formatInt,
      formatPct,
      formatNum1,
    });
    const freshnessEmpty = buildReachFreshnessView({
      state: { ui: { dailyLog: [] } },
      weeklyContext: null,
      executionSnapshot: null,
      formatInt,
      formatPct,
      formatNum1,
    });

    assert(weeklyStatusAwaiting === REACH_STATUS_AWAITING_INPUTS, "reach weekly status should map missing pace to awaiting");
    assert(weeklyStatusGap === "Gap open", "reach weekly status should detect behind-pace gap");
    assert(weeklyStatusFeasible === "Feasible", "reach weekly status should detect feasible pace");

    assert(leversAwaiting === REACH_STATUS_AWAITING_INPUTS, "reach levers status should await when no levers exist");
    assert(leversGap === "Gap focus", "reach levers status should focus gap when pace is behind");
    assert(leversBuffer === "Buffer mode", "reach levers status should show buffer mode when pace is feasible");

    assert(actionsAwaiting === REACH_STATUS_AWAITING_INPUTS, "reach actions status should await when no actions exist");
    assert(actionsDrift === "Drift-aware", "reach actions status should detect drift-aware note");
    assert(actionsModel === "Model-based", "reach actions status should detect model-based note");
    assert(actionsActive === "Active", "reach actions status should default to active");

    assert(toneOk === "ok", "reach status tone should map model-based to ok");
    assert(toneWarn === "warn", "reach status tone should map gap focus to warn");
    assert(toneBad === "bad", "reach status tone should map unavailable to bad");
    assert(reachIntDefault === "1,235", "reach integer formatter should round and comma-format canonically");
    assert(reachIntCeil === "13", "reach integer formatter should honor canonical ceil mode");
    assert(reachIntFloor === "12", "reach integer formatter should honor canonical floor mode");
    assert(reachIntCustom === "#4,500", "reach integer formatter should support injected custom integer formatter");
    assert(reachIntMissing === "—", "reach integer formatter should return canonical fallback for invalid values");
    assert(reachIntFactoryRounded === "#102", "reach integer formatter factory should produce canonical rounded values");
    assert(reachIntFactoryCeil === "#103", "reach integer formatter factory should preserve canonical ceil semantics");
    assert(weeklyConstraint.constraint === "Capacity", "reach weekly constraint should detect capacity gap");
    assert(weeklyConstraint.gapText === "220", "reach weekly constraint should format positive gap text");
    assert(weeklyConstraint.wkBanner.kind === "warn", "reach weekly banner should be warning for moderate gap");
    assert(
      weeklyConstraint.wkBanner.text.includes("short by ~220 attempts per week"),
      "reach weekly banner text should use canonical capacity-gap guidance",
    );
    assert(weeklyExecution.requiredDoorAttemptsText === "140", "reach weekly execution should derive required doors canonically");
    assert(weeklyExecution.requiredCallAttemptsText === "260", "reach weekly execution should derive required calls canonically");
    assert(weeklyExecution.gapConvosText === "-10", "reach weekly execution should compute conversation gap text canonically");
    assert(weeklyExecution.gapAttemptsText === "-40", "reach weekly execution should compute attempt gap text canonically");
    assert(weeklyExecution.paceStatus === "Tight", "reach weekly execution should classify within-10pct pace as tight");
    assert(weeklyExecution.impliedConvosText === "100", "reach weekly execution should compute implied conversations canonically");
    assert(weeklyExecution.finishConvosText === "2026-06-03", "reach weekly execution should compute finish date from canonical pace math");
    assert(weeklyExecution.finishAttemptsText === "2026-06-03", "reach weekly execution should compute attempt finish date canonically");
    assert(
      weeklyExecution.actualConvosNote === "7 entries over ~7 day(s) · last: 2026-05-01",
      "reach weekly execution should format canonical log note",
    );
    assert(weeklyExecution.wkExecBanner.show === true, "reach weekly execution should expose banner when pace kind is known");
    assert(weeklyExecution.wkExecBanner.kind === "warn", "reach weekly execution should map tight pace to warn banner");
    assert(
      weeklyExecution.wkExecBanner.text.includes("Last 7: 90 convos / 360 attempts"),
      "reach weekly execution banner should use canonical summary phrasing",
    );
    assert(weeklyNoLog.paceStatus === "—", "reach weekly execution should be unavailable without log data");
    assert(
      weeklyNoLog.requiredDoorAttemptsText === "—" && weeklyNoLog.requiredCallAttemptsText === "—",
      "reach weekly execution should hide channel breakdown when no logs are present in legacy mode",
    );
    assert(freshnessActive.lastUpdate === "2026-05-02", "reach freshness should report canonical last-update date");
    assert(
      freshnessActive.freshNote.includes("contact rate below assumed") && freshnessActive.freshNote.includes("support rate below assumed"),
      "reach freshness note should include canonical drift flags",
    );
    assert(freshnessActive.rollingAttempts === "240", "reach freshness should format rolling attempts canonically");
    assert(freshnessActive.rollingNote === "Required ≈ 300 attempts/week", "reach freshness rolling note should use canonical required-attempt copy");
    assert(freshnessActive.rollingCR === "25.0%", "reach freshness should format rolling CR canonically");
    assert(freshnessActive.rollingSR === "40.0%", "reach freshness should format rolling SR canonically");
    assert(freshnessActive.rollingAPH === "20.0", "reach freshness should format rolling APH canonically");
    assert(freshnessActive.rollingCRNote === "Assumed: 30.0%", "reach freshness CR-note should include canonical assumed label");
    assert(freshnessActive.rollingSRNote === "Assumed: 60.0%", "reach freshness SR-note should include canonical assumed label");
    assert(freshnessActive.rollingAPHNote === "Expected: 22.8 / hr", "reach freshness APH-note should include canonical expected label");
    assert(freshnessActive.status === "Behind", "reach freshness status should classify low-ratio paths canonically");
    assert(freshnessEmpty.status === "Not tracking", "reach freshness should return canonical no-log status");
    assert(freshnessEmpty.freshNote === "No daily log configured yet", "reach freshness should return canonical no-log note");
    const leversView = buildReachLeversAndActionsView({
      weeklyContext: {
        goal: 1000,
        weeks: 10,
        sr: 0.5,
        cr: 0.25,
        attemptsPerWeek: 400,
        capTotal: 300,
        orgCount: 2,
        orgHoursPerWeek: 10,
        volunteerMult: 1,
        doorShare: 0.5,
        doorsPerHour: 20,
        callsPerHour: 10,
        capacityDecay: 0,
      },
      executionSnapshot: {
        log: { hasLog: true },
        drift: { flags: ["contact rate below assumed"], primary: "contact" },
      },
      computeCapacityBreakdownFn: (payload) => {
        const orgCount = Number(payload?.orgCount) || 0;
        const orgHoursPerWeek = Number(payload?.orgHoursPerWeek) || 0;
        const volunteerMult = Number(payload?.volunteerMult) || 0;
        const doorShare = Number(payload?.doorShare) || 0;
        const doorsPerHour = Number(payload?.doorsPerHour) || 0;
        const callsPerHour = Number(payload?.callsPerHour) || 0;
        const total = computeCapacityContacts({
          weeks: 1,
          orgCount,
          orgHoursPerWeek,
          volunteerMult,
          doorShare,
          doorsPerHour,
          callsPerHour,
        });
        return { total: total ?? 0 };
      },
      clampFn: (value, min, max) => Math.min(max, Math.max(min, Number(value))),
      formatInt,
      formatNum1,
    });
    assert(
      leversView.intro.includes("short by ~100 attempts/week"),
      "reach levers intro should use canonical gap summary text",
    );
    assert(
      Array.isArray(leversView.bestMoves) && leversView.bestMoves.length > 0,
      "reach levers view should include canonical best-move recommendations",
    );
    assert(
      Array.isArray(leversView.rows) && leversView.rows.some((row) => row.id === "capacity:org"),
      "reach levers rows should include canonical organizer-capacity lever",
    );
    assert(
      Array.isArray(leversView.actions) && leversView.actions.length > 0,
      "reach levers view should include canonical actions",
    );
    assert(
      leversView.actionsNote.includes("reality-drift"),
      "reach levers actions-note should detect canonical drift-aware mode",
    );
    assert(typeof REACH_REALITY_NOTE_FALLBACK === "string" && REACH_REALITY_NOTE_FALLBACK.length > 0, "reach reality-note fallback missing");
    assert(REACH_STATUS_UNAVAILABLE === "Unavailable", "reach unavailable status constant mismatch");
    return true;
  });

  test("Rebuild contracts: impact trace view helper is canonical and deterministic", () => {
    const items = buildImpactTraceItemsView({
      state: {
        goalSupportIds: 100,
        supportRatePct: 50,
        contactRatePct: 25,
        orgCount: 2,
        orgHoursPerWeek: 10,
        volunteerMultBase: 1.1,
        channelDoorPct: 50,
        doorsPerHour3: 20,
        callsPerHour3: 40,
        mcLast: { winProb: 0.6, runs: 200 },
        twCapOverrideEnabled: true,
        twCapOverrideMode: "scheduled",
      },
      res: {
        expected: {
          winThreshold: 120,
          persuasionNeed: 22,
        },
        explain: {
          "expected.winThreshold": {
            module: "winMathThreshold",
            inputs: ["turnoutA", "turnoutB"],
            dependsOn: ["candidates"],
            note: "threshold explain",
          },
          "expected.persuasionNeed": {
            module: "persuasionNeedCore",
            inputs: ["winThreshold", "projectedVotes"],
            dependsOn: ["candidate support"],
            note: "need explain",
          },
          stressSummary: {
            module: "mcStressSummary",
            inputs: ["runs", "seed"],
            dependsOn: ["mc margins"],
            note: "stress explain",
          },
        },
      },
      weeks: 4,
      formatInt: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return String(Math.round(n));
      },
      weeklyContext: {
        attemptsPerWeek: 90,
        capTotal: 80,
        gap: 10,
      },
      executionSnapshot: {
        pace: {
          requiredAttemptsPerWeek: 95,
          capacityAttemptsPerWeek: 70,
          gapAttemptsPerWeek: 25,
        },
      },
    });

    assert(Array.isArray(items) && items.length === 7, "impact trace should return all canonical trace rows");
    assert(items[0]?.title === "Win threshold" && items[0]?.value === "120", "impact trace win-threshold row mismatch");
    assert(items[1]?.title === "Persuasion votes needed" && items[1]?.value === "22", "impact trace persuasion-need row mismatch");
    assert(items[2]?.value === "95", "impact trace required attempts should prefer execution/weekly context");
    assert(items[3]?.value === "70", "impact trace capacity should prefer execution/weekly context");
    assert(items[4]?.value === "+25", "impact trace gap should prefer execution/weekly context");
    assert(items[5]?.value === "60.0% (200 runs)", "impact trace MC row should format canonical probability + runs text");
    assert(items[6]?.value === "ON (scheduled)", "impact trace override row should format canonical override status");
    assert(items[0]?.explain?.formula === "winMathThreshold", "impact trace explain formula mapping mismatch");
    assert(items[0]?.explain?.upstream === "turnoutA, turnoutB", "impact trace explain upstream mapping mismatch");
    assert(items[5]?.explain?.formula === "mcStressSummary", "impact trace MC explain mapping mismatch");
    return true;
  });

  test("Rebuild contracts: decision view helpers are canonical and deterministic", () => {
    const linkedSessionStatus = deriveDecisionSessionCardStatus({
      session: { scenarioLabel: "Scenario A" },
    });
    const activeSessionStatus = deriveDecisionSessionCardStatus({
      session: { scenarioLabel: "—" },
    });
    const detailStatus = deriveDecisionDetailCardStatus({
      session: {
        constraints: { budget: "$5000", volunteerHrs: "" },
        nonNegotiablesText: "",
      },
    });
    const optionsStatus = deriveDecisionOptionsCardStatus({
      session: {},
      options: [{ id: "opt_1" }],
      activeOption: { scenarioLabel: "Scenario A" },
    });
    const diagnosticsStatus = deriveDecisionDiagnosticsCardStatus(
      { banner: "Drift warning" },
      { banner: "" },
      { warn: "" },
      { banner: "" },
      { banner: "" },
    );
    const actionStatus = deriveDecisionActionCardStatus({
      session: {},
      summary: { recommendedOptionLabel: "Option A" },
      copyStatus: "",
    });
    const exportStatus = deriveDecisionActionCardStatus({
      session: {},
      summary: { recommendedOptionLabel: "Option A" },
      copyStatus: "Copied summary (markdown).",
    });
    const summaryStatus = deriveDecisionSummaryCardStatus(
      { session: {}, summary: { confidenceTag: "—", riskTag: "Competitive", bottleneckTag: "—" } },
      { tag: "" },
      { tag: "" },
      { tag: "" },
    );
    const toneOk = classifyDecisionStatusTone("Recommendation set");
    const toneWarn = classifyDecisionStatusTone("Watch diagnostics");
    const toneBad = classifyDecisionStatusTone("Unavailable");
    const confidenceStrong = computeDecisionConfidenceComposite({
      execStatus: "green",
      riskBand: "high",
      tightLabel: "Clear",
      divergenceLabel: "Low",
      slipDays: 0,
    });
    const confidenceModerate = computeDecisionConfidenceComposite({
      execStatus: "yellow",
      riskBand: "lean",
      tightLabel: "Binding",
      divergenceLabel: "Moderate",
      slipDays: 4,
    });
    const confidenceLow = computeDecisionConfidenceComposite({
      execStatus: "red",
      riskBand: "volatile",
      tightLabel: "Severe",
      divergenceLabel: "High",
      slipDays: 21,
    });
    const paceUnknown = deriveDecisionExecutionPaceStatus(null);
    const paceGreen = deriveDecisionExecutionPaceStatus(0.04);
    const paceYellow = deriveDecisionExecutionPaceStatus(-0.10);
    const paceRed = deriveDecisionExecutionPaceStatus(0.20);
    const riskUnknown = deriveDecisionRiskBand(null, null);
    const riskHigh = deriveDecisionRiskBand(0.72, 7);
    const riskLean = deriveDecisionRiskBand(0.60, 12);
    const riskVolatile = deriveDecisionRiskBand(0.54, 9);
    const tightUnknown = deriveDecisionConstraintTightness(null);
    const tightClear = deriveDecisionConstraintTightness({ budget: false, capacity: false, timeline: [] });
    const tightBinding = deriveDecisionConstraintTightness({ budget: true, capacity: false, timeline: [] });
    const tightSevere = deriveDecisionConstraintTightness({ budget: true, capacity: true, timeline: ["staff"] });
    const driftView = buildDecisionDriftSnapshotView({
      executionSnapshot: {
        pace: { requiredAttemptsPerWeek: 100, ratio: 0.92, projectedSlipDays: 6.4 },
        log: { hasLog: true, sumAttemptsWindow: 92 },
      },
      weeklyContext: { attemptsPerWeek: 95 },
      formatInt: (value) => String(value),
      weeksRemaining: 8,
    });
    const riskView = buildDecisionRiskSnapshotView({
      mcResult: {
        winProb: 0.62,
        confidenceEnvelope: { percentiles: { p10: 1, p90: 9 } },
      },
    });
    const bottleneckView = buildDecisionBottleneckSnapshotView({
      bindingObj: { budget: false, capacity: false, timeline: ["doors"] },
      primaryBottleneck: "",
      secondaryNotes: "",
    });
    const bottleneckImpactRows = buildDecisionBottleneckImpactRowsView([
      { intervention: "Timeline capacity", deltaObjectiveValue: 12.4, notes: "staff hours/week" },
      { intervention: "Budget ceiling", deltaObjectiveValue: -3.2, notes: "" },
      { intervention: "Contact rate", deltaObjectiveValue: 0, notes: "rate hold" },
      { intervention: "Volunteer hours", deltaMaxNetVotes: 6.2, notes: "volunteers" },
      { intervention: "", deltaObjectiveValue: null, notes: null },
    ], {
      formatInt: (value) => String(value),
    });
    const conversionPanelView = buildDecisionConversionPanelView({
      conversationsNeeded: 123.1,
      doorsNeeded: 456.2,
      doorsPerShift: 19.5,
      totalShifts: 24.2,
      shiftsPerWeek: 3.1,
      volunteersNeeded: 8.2,
      feasibility: {
        kind: "warn",
        text: "Volunteer requirement exceeds current staffing assumptions.",
        shown: true,
      },
    }, {
      formatInt: (value) => String(value),
    });
    const sensitivityView = buildDecisionSensitivitySnapshotView({
      tag: "Snapshot",
      cls: "warn",
      banner: "Sensitivity snapshot available.",
      rows: [{ label: "Door +10%", dWin: "+2.1pp", dP50: "+1.0", note: "strongest lever" }],
    });
    const divergenceView = buildDecisionDivergenceView({
      baselineInputs: {
        raceType: "state_house",
        mode: "general",
        electionDate: "2026-11-03",
      },
      activeInputs: {
        raceType: "state_house",
        mode: "general",
        electionDate: "2026-11-04",
      },
      keyOrder: DECISION_DIVERGENCE_KEY_ORDER,
    });
    const confidenceView = buildDecisionConfidenceSnapshotView({
      drift: driftView,
      risk: riskView,
      bottleneck: bottleneckView,
      divergence: divergenceView,
    });
    const diagnosticsView = buildDecisionDiagnosticsSnapshotView({
      executionSnapshot: {
        pace: { requiredAttemptsPerWeek: 100, ratio: 0.92, projectedSlipDays: 6.4 },
        log: { hasLog: true, sumAttemptsWindow: 92 },
      },
      weeklyContext: { attemptsPerWeek: 95 },
      mcResult: {
        winProb: 0.62,
        confidenceEnvelope: { percentiles: { p10: 1, p90: 9 } },
      },
      bindingObj: { budget: false, capacity: false, timeline: ["doors"] },
      sensitivityCache: {
        tag: "Snapshot",
        cls: "warn",
        banner: "Sensitivity snapshot available.",
        rows: [{ label: "Door +10%", dWin: "+2.1pp", dP50: "+1.0", note: "strongest lever" }],
      },
      baselineInputs: {
        raceType: "state_house",
        mode: "general",
        electionDate: "2026-11-03",
      },
      activeInputs: {
        raceType: "state_house",
        mode: "general",
        electionDate: "2026-11-04",
      },
      divergenceKeyOrder: DECISION_DIVERGENCE_KEY_ORDER,
      formatInt: (value) => String(value),
      weeksRemaining: 8,
    });
    const sensitivityMiniCache = computeDecisionSensitivityMiniSurfaceCache({
      state: {
        mcLast: {
          winProb: 0.55,
          confidenceEnvelope: { percentiles: { p50: 2.0 } },
        },
        mcLastHash: "hash-1",
        doorsPerHour3: 20,
        callsPerHour3: 10,
        volunteerMultBase: 1.0,
        gotvMode: "simple",
        gotvLiftPP: 3,
      },
      lastRenderCtx: {
        res: { expectedNetVotes: 100 },
        weeks: 8,
        needVotes: 120,
      },
      clampFn: (value, min, max) => Math.min(max, Math.max(min, value)),
      runMonteCarloSim: ({ scenario }) => {
        const snap = scenario && typeof scenario === "object" ? scenario : {};
        const doors = Number(snap.doorsPerHour3 ?? snap.doorsPerHour ?? 0);
        const calls = Number(snap.callsPerHour3 ?? snap.callsPerHour ?? 0);
        const vol = Number(snap.volunteerMultBase ?? 0);
        const gotv = Number(snap.gotvLiftPP ?? snap.gotvLiftMode ?? 0);
        const winProb = 0.55
          + ((doors - 20) * 0.001)
          + ((calls - 10) * 0.0005)
          + ((vol - 1.0) * 0.01)
          + ((gotv - 3) * 0.001);
        const p50 = 2.0
          + ((doors - 20) * 0.05)
          + ((calls - 10) * 0.03)
          + ((vol - 1.0) * 0.4)
          + ((gotv - 3) * 0.2);
        return {
          winProb,
          confidenceEnvelope: { percentiles: { p50 } },
        };
      },
      resolveCanonicalDoorsPerHourFn: (snap) => Number(snap?.doorsPerHour3 ?? snap?.doorsPerHour ?? 0),
      resolveCanonicalCallsPerHourFn: (snap) => Number(snap?.callsPerHour3 ?? snap?.callsPerHour ?? 0),
      setCanonicalDoorsPerHourFn: (snap, value) => {
        snap.doorsPerHour3 = value;
        snap.doorsPerHour = value;
      },
      setCanonicalCallsPerHourFn: (snap, value) => {
        snap.callsPerHour3 = value;
        snap.callsPerHour = value;
      },
    });
    const intelligenceRankingVol = buildDecisionIntelligenceRankingRowsView([
      { lever: "Contact rate (+1pp)", value: 1.234 },
      { lever: "Shifts/week (+1)", value: -0.5 },
      { lever: "No-data", value: null },
    ], {
      kind: "volunteers",
      formatInt: (value) => String(value),
    });
    const intelligenceRankingCost = buildDecisionIntelligenceRankingRowsView([
      { lever: "Cost per attempt (-1%)", value: 250.4 },
      { lever: "Shift effort", value: -120.2 },
    ], {
      kind: "cost",
      formatInt: (value) => String(value),
    });
    const intelligenceRankingProb = buildDecisionIntelligenceRankingRowsView([
      { lever: "Contact rate (+1pp)", value: 0.0123 },
      { lever: "Risky move", value: -0.031 },
    ], {
      kind: "probability",
    });
    const intelligencePanelView = buildDecisionIntelligencePanelView({
      warning: "watch this",
      bottlenecks: {
        primary: "timeline: doors",
        secondary: "budget",
        notBinding: ["capacity", "timeline"],
      },
      recs: {
        volunteers: "Best lever volunteers",
        cost: "Best lever cost",
        probability: "Best lever probability",
      },
      rankings: {
        volunteers: [{ lever: "Vol lever", value: 1.2 }],
        cost: [{ lever: "Cost lever", value: 200 }],
        probability: [{ lever: "Prob lever", value: 0.02 }],
      },
    }, {
      formatInt: (value) => String(value),
    });
    const sensitivityPanelMissing = buildDecisionSensitivityPanelView({
      mcResult: null,
      sensitivityCache: null,
      mcStaleness: null,
    });
    const sensitivityPanelStale = buildDecisionSensitivityPanelView({
      mcResult: { winProb: 0.55 },
      sensitivityCache: null,
      mcStaleness: { isStale: true, reasonText: "inputs changed" },
    });
    const sensitivityPanelReady = buildDecisionSensitivityPanelView({
      mcResult: { winProb: 0.55 },
      sensitivityCache: {
        tag: "Mini surface",
        cls: "warn",
        banner: "Snapshot ready.",
        rows: [
          { label: "Door +10%", dWin: "+2.1 pts", dP50: "+1.0", note: "top mover" },
        ],
      },
      mcStaleness: { isStale: false, reasonText: "" },
    });
    const sensitivityPanelAwaiting = buildDecisionSensitivityPanelView({
      mcResult: { winProb: 0.55 },
      sensitivityCache: {
        tag: "Mini surface",
        cls: "warn",
        banner: "Snapshot ready.",
        rows: [],
      },
      mcStaleness: { isStale: false, reasonText: "" },
    });

    assert(linkedSessionStatus === "Session linked", "decision session status should detect scenario linkage");
    assert(activeSessionStatus === "Session active", "decision session status should mark active session without linkage");
    assert(detailStatus === "Constraints set", "decision detail status should detect configured constraints");
    assert(optionsStatus === "Option linked", "decision options status should detect linked option");
    assert(diagnosticsStatus === "Watch diagnostics", "decision diagnostics status should detect risk/drift signals");
    assert(actionStatus === "Recommendation set", "decision action status should detect recommendation");
    assert(exportStatus === "Export ready", "decision action status should detect export-ready copy status");
    assert(summaryStatus === "Competitive", "decision summary status should fall back to risk tag when confidence absent");

    assert(toneOk === "ok", "decision status tone should map recommendation set to ok");
    assert(toneWarn === "warn", "decision status tone should map watch diagnostics to warn");
    assert(toneBad === "bad", "decision status tone should map unavailable to bad");
    assert(confidenceStrong.score === 100 && confidenceStrong.rating === "Strong" && confidenceStrong.tone === "ok", "decision confidence composite should classify all-green posture as Strong/ok");
    assert(confidenceModerate.score === 60 && confidenceModerate.rating === "Moderate" && confidenceModerate.tone === "warn", "decision confidence composite should classify mixed posture as Moderate/warn");
    assert(confidenceLow.score === 20 && confidenceLow.rating === "Low" && confidenceLow.tone === "bad", "decision confidence composite should classify all-red posture as Low/bad");
    assert(
      confidenceModerate.banner.includes("If pace holds, target slips by ~4 days.") && confidenceModerate.banner.includes("Execution pace is drifting"),
      "decision confidence composite should include slip + drift drivers in moderate banner",
    );
    assert(
      confidenceLow.banner.includes("Execution pace is off required weekly pace.") && confidenceLow.banner.includes("Monte Carlo outputs are volatile."),
      "decision confidence composite should include primary low-confidence drivers",
    );
    assert(paceUnknown === "unknown", "decision pace status should return unknown when delta pct is missing");
    assert(paceGreen === "green", "decision pace status should classify <=5% delta as green");
    assert(paceYellow === "yellow", "decision pace status should classify <=15% delta as yellow");
    assert(paceRed === "red", "decision pace status should classify >15% delta as red");
    assert(riskUnknown === "unknown", "decision risk band should return unknown when win prob is missing");
    assert(riskHigh === "high", "decision risk band should classify high-probability/low-volatility posture as high");
    assert(riskLean === "lean", "decision risk band should classify mid-confidence posture as lean");
    assert(riskVolatile === "volatile", "decision risk band should classify low-probability posture as volatile");
    assert(tightUnknown.cls === "" && tightUnknown.label === "—", "decision tightness should return unknown when no binding object is provided");
    assert(tightClear.cls === "ok" && tightClear.label === "Clear", "decision tightness should classify no active constraints as clear");
    assert(tightBinding.cls === "warn" && tightBinding.label === "Binding", "decision tightness should classify one active constraint as binding");
    assert(tightSevere.cls === "bad" && tightSevere.label === "Severe", "decision tightness should classify multiple active constraints as severe");
    assert(driftView.tag === "Yellow" && driftView.cls === "warn", "decision drift builder should classify 8% pace delta as yellow/warn");
    assert(driftView.deltaText === "-8.0%", "decision drift builder should format signed delta percent");
    assert(driftView.banner.includes("+6 days"), "decision drift banner should include rounded slip days");
    assert(riskView.tag === "Lean" && riskView.cls === "warn", "decision risk builder should classify 62% win / 8pt spread as lean");
    assert(riskView.winProbText === "62.0%", "decision risk builder should format canonical win-probability text");
    assert(riskView.marginBandText === "1.0 to 9.0", "decision risk builder should format canonical margin-band text");
    assert(riskView.volatilityText === "8.0", "decision risk builder should expose volatility width");
    assert(bottleneckView.tag === "Binding" && bottleneckView.cls === "warn", "decision bottleneck builder should detect binding constraints");
    assert(bottleneckView.primary === "timeline: doors", "decision bottleneck builder should derive canonical primary bottleneck text");
    assert(Array.isArray(bottleneckImpactRows) && bottleneckImpactRows.length === 5, "decision bottleneck impact helper should preserve row count");
    assert(bottleneckImpactRows[0]?.deltaText === "+12", "decision bottleneck impact helper should format positive deltas with sign");
    assert(bottleneckImpactRows[1]?.deltaText === "-3", "decision bottleneck impact helper should format negative deltas with sign");
    assert(bottleneckImpactRows[2]?.deltaText === "0", "decision bottleneck impact helper should preserve zero deltas");
    assert(bottleneckImpactRows[3]?.deltaText === "+6", "decision bottleneck impact helper should support deltaMaxNetVotes alias");
    assert(bottleneckImpactRows[4]?.intervention === "—", "decision bottleneck impact helper should apply canonical intervention fallback");
    assert(bottleneckImpactRows[4]?.notes === "—", "decision bottleneck impact helper should apply canonical notes fallback");
    assert(conversionPanelView.conversationsNeededText === "124", "decision conversion panel view should ceil conversations-needed text canonically");
    assert(conversionPanelView.doorsNeededText === "457", "decision conversion panel view should ceil doors-needed text canonically");
    assert(conversionPanelView.doorsPerShiftText === "20", "decision conversion panel view should round doors-per-shift text canonically");
    assert(conversionPanelView.totalShiftsText === "25", "decision conversion panel view should ceil total-shifts text canonically");
    assert(conversionPanelView.shiftsPerWeekText === "4", "decision conversion panel view should ceil shifts/week text canonically");
    assert(conversionPanelView.volunteersNeededText === "9", "decision conversion panel view should ceil volunteers-needed text canonically");
    assert(conversionPanelView.feasibility.kind === "warn" && conversionPanelView.feasibility.shown === true, "decision conversion panel view should preserve feasibility metadata canonically");
    assert(sensitivityView.tag === "Snapshot" && sensitivityView.rows.length === 1, "decision sensitivity builder should map cached rows");
    assert(divergenceView.label === "Low" && divergenceView.diffCount === 1, "decision divergence builder should count key-order diffs deterministically");
    assert(confidenceView.tag === "Moderate" && confidenceView.cls === "warn", "decision confidence snapshot should classify mixed posture as moderate/warn");
    assert(
      confidenceView.banner.includes("If pace holds, target slips by ~6 days.") && confidenceView.banner.includes("Win probability is lean"),
      "decision confidence snapshot banner should include slip and lean-risk driver text",
    );
    assert(diagnosticsView.exec.tag === "Yellow", "decision diagnostics builder should include drift snapshot");
    assert(diagnosticsView.risk.tag === "Lean", "decision diagnostics builder should include risk snapshot");
    assert(diagnosticsView.bottleneck.tag === "Binding", "decision diagnostics builder should include bottleneck snapshot");
    assert(diagnosticsView.sensitivity.tag === "Snapshot", "decision diagnostics builder should include sensitivity snapshot");
    assert(diagnosticsView.confidence.tag === "Moderate", "decision diagnostics builder should include confidence snapshot");
    assert(sensitivityMiniCache.ok === true && sensitivityMiniCache.code === "ok", "decision sensitivity mini-cache helper should report success when context and simulator are present");
    assert(Array.isArray(sensitivityMiniCache.cache?.rows) && sensitivityMiniCache.cache.rows.length === 4, "decision sensitivity mini-cache helper should produce canonical four-row perturbation output");
    assert(String(sensitivityMiniCache.cache?.tag || "") === "Mini surface", "decision sensitivity mini-cache helper should set canonical tag");
    assert(String(sensitivityMiniCache.cache?.baseHash || "") === "hash-1", "decision sensitivity mini-cache helper should preserve base hash");
    assert(String(sensitivityMiniCache.cache?.rows?.[0]?.label || "") === "+10% doors", "decision sensitivity mini-cache helper should preserve canonical row ordering");
    assert(String(sensitivityMiniCache.cache?.rows?.[0]?.dWin || "").includes("pts"), "decision sensitivity mini-cache helper should emit win-probability delta text");
    assert(Array.isArray(intelligenceRankingVol) && intelligenceRankingVol.length === 3, "decision intelligence ranking helper should preserve row count");
    assert(intelligenceRankingVol[0]?.valueText === "+1.23", "decision intelligence ranking helper should format volunteer deltas with fixed precision");
    assert(intelligenceRankingVol[1]?.valueText === "-0.50", "decision intelligence ranking helper should preserve negative volunteer signs");
    assert(intelligenceRankingVol[2]?.valueText === "—", "decision intelligence ranking helper should apply missing-value fallback");
    assert(intelligenceRankingCost[0]?.valueText === "+$250", "decision intelligence ranking helper should format positive cost deltas canonically");
    assert(intelligenceRankingCost[1]?.valueText === "$-120", "decision intelligence ranking helper should preserve negative cost format");
    assert(intelligenceRankingProb[0]?.valueText === "+1.23 pp", "decision intelligence ranking helper should format probability deltas in percentage points");
    assert(intelligenceRankingProb[1]?.valueText === "-3.10 pp", "decision intelligence ranking helper should preserve negative probability deltas in percentage points");
    assert(intelligencePanelView.warning === "watch this", "decision intelligence panel helper should preserve warning text");
    assert(intelligencePanelView.primary === "timeline: doors", "decision intelligence panel helper should preserve primary bottleneck");
    assert(intelligencePanelView.notBinding === "capacity, timeline", "decision intelligence panel helper should format non-binding list canonically");
    assert(intelligencePanelView.recommendations.probability === "Best lever probability", "decision intelligence panel helper should preserve probability recommendation");
    assert(intelligencePanelView.rankings.cost[0]?.valueText === "+$200", "decision intelligence panel helper should project ranking value text canonically");
    assert(sensitivityPanelMissing.runDisabled === true && sensitivityPanelMissing.cls === "warn", "decision sensitivity panel helper should disable run when MC is missing");
    assert(sensitivityPanelMissing.banner.includes("Run Monte Carlo"), "decision sensitivity panel helper should emit missing-MC guidance");
    assert(sensitivityPanelStale.runDisabled === true && sensitivityPanelStale.banner.includes("stale"), "decision sensitivity panel helper should disable run and emit stale warning");
    assert(sensitivityPanelReady.runDisabled === false && sensitivityPanelReady.rows.length === 1, "decision sensitivity panel helper should expose cached snapshot rows when ready");
    assert(sensitivityPanelReady.rows[0]?.label === "Door +10%", "decision sensitivity panel helper should preserve perturbation labels");
    assert(sensitivityPanelAwaiting.runDisabled === false && sensitivityPanelAwaiting.rows.length === 0, "decision sensitivity panel helper should stay enabled while awaiting snapshot run");
    assert(sensitivityPanelAwaiting.banner.includes("Run snapshot"), "decision sensitivity panel helper should emit awaiting-run guidance when cache is empty");
    assert(DECISION_STATUS_UNAVAILABLE === "Unavailable", "decision unavailable status constant mismatch");
    assert(DECISION_STATUS_AWAITING_DECISION === "Awaiting decision", "decision awaiting status constant mismatch");
    return true;
  });

  test("Rebuild contracts: data view helpers are canonical and deterministic", () => {
    const policyCheckImport = deriveDataPolicyCardStatus(true, "hash mismatch", "", 2);
    const policyStrict = deriveDataPolicyCardStatus(true, "", "", 0);
    const policyRestore = deriveDataPolicyCardStatus(false, "", "", 2);
    const policyNoBackups = deriveDataPolicyCardStatus(false, "", "", 0);

    const exchangeStaged = deriveDataExchangeCardStatus("Selected import: scenario.json");
    const exchangeReady = deriveDataExchangeCardStatus("");

    const storageBrowser = deriveDataStorageCardStatus("Browser storage only.");
    const storageAwaiting = deriveDataStorageCardStatus("Connect folder before running this action.");
    const storageLinked = deriveDataStorageCardStatus("Folder connected.");

    const auditAwaiting = deriveDataAuditCardStatus("0", "none", "No archive records yet.");
    const auditArchiveOnly = deriveDataAuditCardStatus("0", "none", "3 archived forecasts.");
    const auditBiasWatch = deriveDataAuditCardStatus("14", "overestimate", "3 archived forecasts.");
    const auditLearning = deriveDataAuditCardStatus("14", "none", "3 archived forecasts.");
    const auditMetricsAwaiting = deriveDataAuditCardStatusFromMetrics({}, { totalEntries: 0 });
    const auditMetricsArchiveOnly = deriveDataAuditCardStatusFromMetrics({ sampleSize: 0 }, { totalEntries: 3 });
    const auditMetricsBiasWatch = deriveDataAuditCardStatusFromMetrics({ sampleSize: 14, biasDirection: "overestimate" }, { totalEntries: 3 });
    const auditMetricsLearning = deriveDataAuditCardStatusFromMetrics({ sampleSize: 14, biasDirection: "none" }, { totalEntries: 3 });

    const summaryWatch = deriveDataSummaryCardStatus(true, true, false, "Browser storage only.");
    const summaryStrictLocal = deriveDataSummaryCardStatus(true, false, false, "Browser storage only.");
    const summaryStrictExternal = deriveDataSummaryCardStatus(true, false, false, "Folder connected.");
    const summaryStable = deriveDataSummaryCardStatus(false, false, false, "Browser storage only.");
    const summaryExternalReady = deriveDataSummaryCardStatus(false, false, false, "Folder connected.");
    const importFileStatus = buildDataImportFileStatus("scenario.json");
    const importFileStatusFallback = buildDataImportFileStatus("");
    const backupCount = countDataBackupOptions([{ value: "" }, { value: "0" }, { value: "1" }]);
    const restoreSelection = buildDataRestoreSelectionLabel(
      [{ value: "0", label: "Backup A" }, { value: "1", label: "Backup B" }],
      "1",
    );
    const restoreSelectionFallback = buildDataRestoreSelectionLabel([], "");
    const dataSurfaceSummary = buildDataSurfaceSummaryView({
      strictImport: true,
      backupOptions: [{ value: "0", label: "Backup A" }, { value: "1", label: "Backup B" }],
      selectedBackup: "1",
      importFileName: "scenario.json",
      hashBannerText: "",
      warnBannerText: "",
      usbStatus: "Using browser storage only.",
      forecastArchive: {
        summary: { totalEntries: 3 },
        modelAudit: { sampleSize: 14, biasDirection: "none" },
      },
    });

    const toneOk = classifyDataStatusTone("Learning active");
    const toneWarn = classifyDataStatusTone("Bias watch");
    const toneBad = classifyDataStatusTone("Check import");
    const parsedNumber = parseDataOptionalNumber("12.5");
    const parsedMissingNumber = parseDataOptionalNumber("");
    const parsedInvalidNumber = parseDataOptionalNumber("n/a");
    const scopeCampaignText = formatDataScopeCampaign({ campaignId: "il-hd-21", campaignName: "IL HD 21" });
    const scopeCampaignFallback = formatDataScopeCampaign({});
    const scopeOfficeText = formatDataScopeOffice({ officeId: "west" });
    const scopeOfficeFallback = formatDataScopeOffice({});
    const scopeLocksText = formatDataScopeLocks({ isCampaignLocked: true, isOfficeLocked: false, isScenarioLocked: true });
    const scopeLocksFallback = formatDataScopeLocks({});
    const archiveCountText = formatDataArchiveCount(42.8);
    const sampleCountText = formatDataSampleCount(42.8);
    const archiveDecimalText = formatDataArchiveDecimal(28.456, 2);
    const archivePctText = formatDataPercentFromPct(64.44, 1);
    const archivePctFallback = formatDataPercentFromPct("n/a", 1);
    const archiveRatePercentText = formatDataRatePercent(0.612, { max: 1.25, digits: 0 });
    const signedPositiveText = formatDataSignedDecimal(1.234, 2);
    const signedNegativeText = formatDataSignedDecimal(-0.5, 2);
    const recordedAtText = formatDataArchiveRecordedAt("2026-03-18T10:20:30Z");
    const normalizedArchiveSummary = normalizeDataArchiveSummary({ totalEntries: 5, withActualEntries: 2 }, []);
    const archiveSummaryText = buildDataArchiveTableSummaryText(normalizedArchiveSummary, []);
    const learningView = buildDataArchiveLearningView({
      topSuggestion: {
        label: "Forecasts are systematically high",
        recommendation: "Reduce aggressive baseline assumptions by about 2.4%.",
        severity: "warn",
      },
    });
    const learningFallback = buildDataArchiveLearningView({});
    const learningSignalsView = buildDataArchiveLearningSignalsView({
      signals: {
        voterRows: 25000,
        voterGeoCoverageRate: 0.74,
        voterContactableRate: 0.58,
      },
    });
    const learningSignalsFallback = buildDataArchiveLearningSignalsView({});
    const voterLayerSnapshot = buildVoterLayerStatusSnapshot({
      manifest: {
        adapterId: "van",
        sourceId: "van_sync_20260318",
        importedAt: "2026-03-18T12:34:56Z",
        mappedCanonicalFields: ["voterId", "precinctId", "supportScore"],
        ignoredHeaderCount: 5,
      },
      rows: [
        {
          voterId: "A",
          precinctId: "P1",
          contactPhone: "3125551111",
          contactAttempts: 2,
          contactConversations: 1,
          lastContactAt: "2026-03-10T00:00:00Z",
        },
        {
          voterId: "B",
          tractGeoid: "17031010100",
          contactAttempts: 1,
          contactConversations: 0,
        },
      ],
    }, { nowIso: "2026-03-18T00:00:00Z", recentWindowDays: 14 });
    const voterLayerView = buildDataVoterLayerSnapshotView(voterLayerSnapshot);
    const voterSchemaGuide = buildDataVoterSchemaGuideView();
    const canonicalVoterFieldTiers = listCanonicalVoterFieldTiers();
    const voterSourceLabel = buildDataVoterSourceLabel("van", "van_sync_20260318");
    const voterSourceFallback = buildDataVoterSourceLabel("", "");
    const voterSourceRef = formatVoterSourceRef("van", "van_sync_20260318");
    const voterSourceRefFallback = formatVoterSourceRef("", "", { fallback: "n/a" });
    const voterInputFormatJson = inferVoterInputFormat("voters.2026.json");
    const voterInputFormatCsv = inferVoterInputFormat("voters.2026.csv");
    const voterInputFormatAuto = inferVoterInputFormat("voters.2026.txt");
    const dataVoterInputFormatJson = inferDataVoterInputFormat("district-voters.json");
    const voterImportOutcome = buildVoterImportOutcomeView({
      voterDataState: voterLayerSnapshot,
      warnings: ["Missing precinct for 12 rows", "Unknown header ignored"],
    });
    const voterImportOutcomeEmpty = buildVoterImportOutcomeView({});
    const voterAdapterOptions = listDataVoterAdapterOptions();
    const officeWinnerText = buildDataArchiveOfficeWinnerText("west", "doors");
    const archiveDetail = buildDataArchiveSelectedSnapshotView({
      targeting: {
        rowCount: 120,
        topTargetCount: 40,
        expectedNetVoteValueTotal: 28.45,
      },
      execution: {
        officePaths: {
          rowCount: 2,
          bestByDollarOfficeId: "west",
          bestByDollarTopChannel: "doors",
          bestByDollarUpliftExpectedMarginalGain: 0.62,
          bestByDollarUpliftSource: "targeting_rows",
          bestByOrganizerHourOfficeId: "east",
          bestByOrganizerHourTopChannel: "phones",
          bestByOrganizerHourUpliftExpectedMarginalGain: 0.56,
          bestByOrganizerHourUpliftSource: "targeting_rows",
          statusText: "Office path ranking ready.",
        },
        uplift: {
          source: "targeting_rows",
          expectedMarginalGain: 0.62,
          lowMarginalGain: 0.42,
          bestChannel: "doors",
          uncertaintyBand: "medium",
          saturationPressure: "high",
        },
      },
      governance: {
        confidenceBand: "medium",
        confidenceScore: 72.4,
        executionStatus: "warn",
        executionScore: 64,
        executionUpliftSource: "targeting_rows",
        topWarning: "Execution realism: timeline executable at 84%.",
        learningTopSuggestion: "Improve voter geography linkage",
        learningRecommendation: "Strengthen precinct/tract/block-group mapping before applying aggressive turf-level optimization.",
      },
      templateMeta: {
        appliedTemplateId: "state_house_general_open",
        appliedVersion: "2.1.0",
      },
      workforce: {
        organizerCount: 5,
        paidCanvasserCount: 18,
        activeVolunteerCount: 73,
      },
      budget: {
        includeOverhead: true,
        overheadAmount: 42000,
        optimize: { objective: "uplift" },
      },
      forecast: {
        optimizationObjectiveLabel: "Expected net votes",
      },
      voter: {
        scopingRule: "import_broad_persist_narrow",
        adapterId: "van",
        sourceId: "van_sync_20260318",
        rowCount: 25000,
        geoCoverageRate: 0.74,
        contactableRate: 0.58,
      },
    });
    const archiveDetailFallback = buildDataArchiveSelectedSnapshotView({});

    assert(policyCheckImport === "Check import", "data policy status should prioritize import warnings");
    assert(policyStrict === "Strict mode", "data policy status should reflect strict mode");
    assert(policyRestore === "Restore ready", "data policy status should indicate restore-ready backups");
    assert(policyNoBackups === "No backups", "data policy status should indicate missing backups");

    assert(exchangeStaged === "File staged", "data exchange status should detect staged import file");
    assert(exchangeReady === "Ready", "data exchange status should default ready");

    assert(storageBrowser === "Browser storage", "data storage status should detect browser mode");
    assert(storageAwaiting === "Awaiting folder", "data storage status should detect connect-needed mode");
    assert(storageLinked === "Folder linked", "data storage status should detect linked folder mode");

    assert(auditAwaiting === "Awaiting archive", "data audit status should await archive when no rows exist");
    assert(auditArchiveOnly === "Archive only", "data audit status should detect archive rows without sample size");
    assert(auditBiasWatch === "Bias watch", "data audit status should detect directional bias");
    assert(auditLearning === "Learning active", "data audit status should detect active learning posture");
    assert(auditMetricsAwaiting === "Awaiting archive", "metrics audit status should await archive when no rows exist");
    assert(auditMetricsArchiveOnly === "Archive only", "metrics audit status should detect archive rows without sample size");
    assert(auditMetricsBiasWatch === "Bias watch", "metrics audit status should detect directional bias");
    assert(auditMetricsLearning === "Learning active", "metrics audit status should detect active learning posture");

    assert(summaryWatch === "Watch policy", "data summary status should prioritize policy warnings");
    assert(summaryStrictLocal === "Strict local", "data summary status should detect strict-local posture");
    assert(summaryStrictExternal === "Strict external", "data summary status should detect strict-external posture");
    assert(summaryStable === "Stable", "data summary status should detect stable browser posture");
    assert(summaryExternalReady === "External ready", "data summary status should detect external-ready posture");
    assert(importFileStatus === "Selected import: scenario.json", "data import-file status helper should build canonical selected-file text");
    assert(importFileStatusFallback === DATA_IMPORT_FILE_STATUS_FALLBACK, "data import-file status helper should expose canonical fallback text");
    assert(backupCount === 2, "data backup-option counter should only count non-empty backup entries");
    assert(restoreSelection === "Backup B", "data restore-selection helper should resolve canonical selected backup label");
    assert(restoreSelectionFallback === DATA_BACKUP_SELECTION_FALLBACK, "data restore-selection helper should expose canonical fallback text");
    assert(dataSurfaceSummary.strictImportText === "ON", "data surface-summary view should expose canonical strict-import text");
    assert(dataSurfaceSummary.backupCountText === "2", "data surface-summary view should expose canonical backup count text");
    assert(dataSurfaceSummary.restoreSelection === "Backup B", "data surface-summary view should expose canonical selected backup label");
    assert(dataSurfaceSummary.importFileSummary === "Selected import: scenario.json", "data surface-summary view should expose canonical import-file text");
    assert(dataSurfaceSummary.policyCardStatus === "Strict mode", "data surface-summary view should derive canonical policy-card status");
    assert(dataSurfaceSummary.exchangeCardStatus === "File staged", "data surface-summary view should derive canonical exchange-card status");
    assert(dataSurfaceSummary.storageCardStatus === "Browser storage", "data surface-summary view should derive canonical storage-card status");
    assert(dataSurfaceSummary.auditCardStatus === "Learning active", "data surface-summary view should derive canonical audit-card status");
    assert(dataSurfaceSummary.summaryCardStatus === "Strict local", "data surface-summary view should derive canonical summary-card status");

    assert(toneOk === "ok", "data tone should map learning-active to ok");
    assert(toneWarn === "warn", "data tone should map bias-watch to warn");
    assert(toneBad === "bad", "data tone should map check-import to bad");
    assert(parsedNumber === 12.5, "data optional-number parser should parse canonical numeric text");
    assert(parsedMissingNumber === null, "data optional-number parser should return null for blank input");
    assert(parsedInvalidNumber === null, "data optional-number parser should return null for invalid input");
    assert(scopeCampaignText === "IL HD 21 (il-hd-21)", "data scope campaign formatter should preserve canonical campaign label");
    assert(scopeCampaignFallback === "default", "data scope campaign formatter should preserve canonical default fallback");
    assert(scopeOfficeText === "west", "data scope office formatter should preserve canonical office id");
    assert(scopeOfficeFallback === "all", "data scope office formatter should preserve canonical all-office fallback");
    assert(scopeLocksText === "campaign, scenario", "data scope locks formatter should join active context locks canonically");
    assert(scopeLocksFallback === "none", "data scope locks formatter should preserve canonical unlocked fallback");
    assert(archiveCountText === "43", "data archive count formatter should round to whole-number text");
    assert(sampleCountText === "42", "data sample count formatter should floor to whole-number text");
    assert(archiveDecimalText === "28.46", "data archive decimal formatter should honor canonical precision");
    assert(archivePctText === "64.4%", "data percent formatter should output canonical percentage-point text");
    assert(archivePctFallback === "—", "data percent formatter should return canonical fallback for invalid input");
    assert(archiveRatePercentText === "61%", "data rate-percent formatter should output canonical percent text");
    assert(signedPositiveText === "+1.23", "data signed formatter should include plus sign for positive values");
    assert(signedNegativeText === "-0.50", "data signed formatter should preserve sign for negative values");
    assert(recordedAtText === "2026-03-18 10:20:30", "data recorded-at formatter should normalize canonical timestamp text");
    assert(normalizedArchiveSummary.totalEntries === 5, "data archive summary normalizer should preserve total entries");
    assert(normalizedArchiveSummary.withActualEntries === 2, "data archive summary normalizer should preserve actual-entry counts");
    assert(normalizedArchiveSummary.pendingEntries === 3, "data archive summary normalizer should derive pending entries");
    assert(
      archiveSummaryText === "Showing 5 archived forecasts (2 with actuals, 3 pending).",
      "data archive summary text should be built by canonical formatter",
    );
    assert(learningView.label === "Forecasts are systematically high", "data learning view should preserve top suggestion label");
    assert(learningView.recommendation.includes("2.4%"), "data learning view should preserve top suggestion recommendation");
    assert(learningView.severity === "warn", "data learning view should preserve top suggestion severity");
    assert(learningFallback.label === DATA_LEARNING_LABEL_FALLBACK, "data learning view should expose canonical fallback label");
    assert(
      learningFallback.recommendation === DATA_LEARNING_RECOMMENDATION_FALLBACK,
      "data learning view should expose canonical fallback recommendation",
    );
    assert(learningSignalsView.voterRows === "25,000", "data learning-signals view should format voter row totals");
    assert(learningSignalsView.voterGeoCoverage === "74%", "data learning-signals view should format voter geo coverage");
    assert(learningSignalsView.voterContactableRate === "58%", "data learning-signals view should format voter contactable rate");
    assert(learningSignalsFallback.voterRows === "—", "data learning-signals view should expose canonical fallback voter rows");
    assert(learningSignalsFallback.voterGeoCoverage === "—", "data learning-signals view should expose canonical fallback voter geo coverage");
    assert(learningSignalsFallback.voterContactableRate === "—", "data learning-signals view should expose canonical fallback voter contactable rate");
    assert(voterLayerView.scopingRule === "import_broad_persist_narrow", "data voter-layer view should preserve canonical scoping rule");
    assert(voterLayerView.source === "van:van_sync_20260318", "data voter-layer view should preserve canonical source label");
    assert(voterLayerView.rowCount === "2", "data voter-layer view should format canonical row count");
    assert(voterLayerView.importedAt === "2026-03-18 12:34:56", "data voter-layer view should format canonical import timestamp");
    assert(voterLayerView.mappedCanonicalFields === "3", "data voter-layer view should format mapped canonical-field count");
    assert(voterLayerView.ignoredHeaders === "5", "data voter-layer view should format ignored header count");
    assert(voterLayerView.geoCoverage === "50%", "data voter-layer view should format geo coverage percent");
    assert(voterLayerView.contactableRate === "50%", "data voter-layer view should format contactable percent");
    assert(voterLayerView.recentContactRate === "50%", "data voter-layer view should format recent-contact percent");
    assert(voterLayerView.conversationRate === "33%", "data voter-layer view should format conversation percent");
    assert(voterSchemaGuide.requiredCount === "1", "data voter-schema guide should preserve required field count");
    assert(
      voterSchemaGuide.recommendedCount === String(canonicalVoterFieldTiers.recommended.length),
      "data voter-schema guide should preserve recommended field count",
    );
    assert(voterSchemaGuide.requiredFields === "voterId", "data voter-schema guide should preserve required field labels");
    assert(voterSchemaGuide.recommendedFields.includes("precinctId"), "data voter-schema guide should preserve recommended field labels");
    assert(voterSourceRef === "van:van_sync_20260318", "voter source-ref helper should preserve adapter+source contract");
    assert(voterSourceRefFallback === "n/a", "voter source-ref helper should honor explicit fallback");
    assert(voterInputFormatJson === "json", "voter input-format helper should infer json files");
    assert(voterInputFormatCsv === "csv", "voter input-format helper should infer csv files");
    assert(voterInputFormatAuto === "auto", "voter input-format helper should default to auto for unknown extension");
    assert(dataVoterInputFormatJson === "json", "data voter input-format helper should use canonical voter inference");
    assert(voterImportOutcome.rowCount === 2, "voter import outcome helper should preserve canonical row count");
    assert(voterImportOutcome.sourceRef === "van:van_sync_20260318", "voter import outcome helper should preserve canonical source reference");
    assert(voterImportOutcome.statusText === "Imported 2 voter rows (van:van_sync_20260318).", "voter import outcome helper should format canonical success status");
    assert(voterImportOutcome.warningText.includes("Voter import warnings"), "voter import outcome helper should format canonical warning text");
    assert(voterImportOutcomeEmpty.statusText === "No voter rows imported.", "voter import outcome helper should format canonical empty status");
    assert(voterImportOutcomeEmpty.warningText === "", "voter import outcome helper should keep warning text empty when no warnings");
    assert(voterSourceLabel === "van:van_sync_20260318", "data voter-source label helper should preserve adapter+source contract");
    assert(voterSourceFallback === "—", "data voter-source label helper should expose canonical fallback");
    assert(Array.isArray(voterAdapterOptions) && voterAdapterOptions.length >= 4, "data voter-adapter option helper should expose canonical adapter options");
    assert(String(voterAdapterOptions[0]?.id || "") === "canonical", "data voter-adapter options should keep canonical first");
    assert(String(voterAdapterOptions[1]?.id || "") === "van", "data voter-adapter options should include VAN preset");
    assert(officeWinnerText === "west · top doors", "data archive office winner formatter should preserve office+channel text");
    assert(archiveDetail.targetRows === "120", "data archive detail view should format targeting row count");
    assert(archiveDetail.topTargets === "40", "data archive detail view should format top-target count");
    assert(archiveDetail.targetValueTotal === "28.45", "data archive detail view should format target value totals");
    assert(archiveDetail.officePathRows === "2", "data archive detail view should format office-path row count");
    assert(archiveDetail.officeBestByDollar === "west · top doors", "data archive detail view should preserve best-by-dollar office");
    assert(archiveDetail.officeBestByOrganizerHour === "east · top phones", "data archive detail view should preserve best-by-organizer-hour office");
    assert(archiveDetail.officeBestByDollarUpliftExpected === "62%", "data archive detail view should format best-by-dollar office uplift expected");
    assert(archiveDetail.officeBestByDollarUpliftSource === "Targeting rows", "data archive detail view should preserve best-by-dollar office uplift source");
    assert(archiveDetail.officeBestByOrganizerHourUpliftExpected === "56%", "data archive detail view should format best-by-organizer-hour office uplift expected");
    assert(archiveDetail.officeBestByOrganizerHourUpliftSource === "Targeting rows", "data archive detail view should preserve best-by-organizer-hour office uplift source");
    assert(archiveDetail.officePathStatus === "Office path ranking ready.", "data archive detail view should preserve office path status text");
    assert(archiveDetail.upliftExpected === "62%", "data archive detail view should format uplift expected percent");
    assert(archiveDetail.upliftLow === "42%", "data archive detail view should format uplift low-bound percent");
    assert(archiveDetail.upliftBestChannel === "doors", "data archive detail view should preserve uplift best channel");
    assert(archiveDetail.upliftSource === "Targeting rows", "data archive detail view should preserve uplift source provenance");
    assert(archiveDetail.upliftUncertaintyBand === "medium", "data archive detail view should preserve uplift uncertainty band");
    assert(archiveDetail.upliftSaturationPressure === "high", "data archive detail view should preserve uplift saturation pressure");
    assert(archiveDetail.templateSummary === "state_house_general_open (v2.1.0)", "data archive detail view should preserve template provenance");
    assert(archiveDetail.workforceSummary === "Org 5 · Paid 18 · Vol 73", "data archive detail view should format workforce mix summary");
    assert(archiveDetail.budgetSummary === "Expected net votes · overhead on (42,000)", "data archive detail view should format budget posture summary");
    assert(archiveDetail.voterRows === "25,000", "data archive detail view should format voter row totals");
    assert(archiveDetail.voterScopingRule === "import_broad_persist_narrow", "data archive detail view should preserve voter-layer scoping rule");
    assert(archiveDetail.voterSource === "van:van_sync_20260318", "data archive detail view should preserve canonical voter source provenance");
    assert(archiveDetail.voterGeoCoverage === "74%", "data archive detail view should format voter geography coverage");
    assert(archiveDetail.voterContactableRate === "58%", "data archive detail view should format voter contactable rate");
    assert(archiveDetail.governanceConfidence === "MEDIUM (72.4/100)", "data archive detail view should format governance confidence snapshot");
    assert(archiveDetail.governanceExecution === "WARN (64/100)", "data archive detail view should format governance execution snapshot");
    assert(archiveDetail.governanceUpliftSource === "Targeting rows", "data archive detail view should preserve governance uplift source");
    assert(
      archiveDetail.governanceTopWarning === "Execution realism: timeline executable at 84%.",
      "data archive detail view should preserve governance warning text",
    );
    assert(archiveDetail.governanceLearning === "Improve voter geography linkage", "data archive detail view should expose governance learning label");
    assert(archiveDetail.governanceRecommendation.includes("precinct/tract"), "data archive detail view should expose governance recommendation text");
    assert(archiveDetailFallback.officePathStatus === DATA_ARCHIVE_DETAIL_FALLBACK, "data archive detail view should expose canonical fallback status");
    assert(archiveDetailFallback.officeBestByDollarUpliftExpected === "—", "data archive detail view should expose canonical fallback best-by-dollar uplift expected");
    assert(archiveDetailFallback.officeBestByDollarUpliftSource === "—", "data archive detail view should expose canonical fallback best-by-dollar uplift source");
    assert(archiveDetailFallback.officeBestByOrganizerHourUpliftExpected === "—", "data archive detail view should expose canonical fallback best-by-organizer-hour uplift expected");
    assert(archiveDetailFallback.officeBestByOrganizerHourUpliftSource === "—", "data archive detail view should expose canonical fallback best-by-organizer-hour uplift source");
    assert(archiveDetailFallback.upliftSource === "—", "data archive detail view should expose canonical uplift source fallback");
    assert(archiveDetailFallback.upliftUncertaintyBand === "unknown", "data archive detail view should expose canonical uplift uncertainty fallback");
    assert(archiveDetailFallback.upliftSaturationPressure === "unknown", "data archive detail view should expose canonical uplift saturation fallback");
    assert(archiveDetailFallback.templateSummary === "—", "data archive detail view should expose canonical fallback template summary");
    assert(archiveDetailFallback.workforceSummary === "—", "data archive detail view should expose canonical fallback workforce summary");
    assert(archiveDetailFallback.budgetSummary === "—", "data archive detail view should expose canonical fallback budget summary");
    assert(archiveDetailFallback.voterScopingRule === "—", "data archive detail view should expose canonical fallback voter scoping rule");
    assert(archiveDetailFallback.voterSource === "—", "data archive detail view should expose canonical fallback voter source");
    assert(archiveDetailFallback.governanceUpliftSource === "—", "data archive detail view should expose canonical fallback governance uplift source");
    assert(archiveDetailFallback.governanceLearning === "—", "data archive detail view should expose canonical fallback governance learning label");
    assert(archiveDetailFallback.governanceRecommendation === "—", "data archive detail view should expose canonical fallback governance recommendation");
    assert(DATA_STATUS_AWAITING_STORAGE === "Awaiting storage", "data awaiting-storage constant mismatch");
    assert(DATA_VOTER_IMPORT_STATUS_FALLBACK === "No voter import run in this session.", "data voter-import fallback constant mismatch");
    return true;
  });

  test("Rebuild contracts: scenario view helpers are canonical and deterministic", () => {
    const workspaceSummary = buildScenarioWorkspaceSummaryView({
      activeScenario: { id: "scenario_a", name: "Path A" },
      activeScenarioId: "scenario_a",
      count: 3,
      max: 2,
    });
    const workspaceSummaryBaseline = buildScenarioWorkspaceSummaryView({
      activeScenario: null,
      activeScenarioId: "",
      count: 1,
      max: 4,
    });
    const workspaceUnavailable = deriveScenarioWorkspaceCardStatus({
      baselineId: "baseline",
      activeScenarioId: "baseline",
      scenarios: [],
    });
    const workspaceActive = deriveScenarioWorkspaceCardStatus({
      baselineId: "baseline",
      activeScenarioId: "scenario_a",
      scenarios: [{ id: "baseline" }, { id: "scenario_a" }],
    });
    const workspaceBaseline = deriveScenarioWorkspaceCardStatus({
      baselineId: "baseline",
      activeScenarioId: "baseline",
      scenarios: [{ id: "baseline" }],
    });

    const comparisonDisabled = buildScenarioComparisonView({
      baselineId: "baseline",
      baseline: { id: "baseline", name: "Baseline", inputs: {}, outputs: {} },
      active: { id: "baseline", name: "Baseline", inputs: {}, outputs: {} },
    });
    const comparisonActive = buildScenarioComparisonView({
      baselineId: "baseline",
      baseline: {
        id: "baseline",
        name: "Baseline",
        inputs: { supportRatePct: 55, turnoutA: 42 },
        outputs: { winProb: 0.48, voteNeed: 1800 },
      },
      active: {
        id: "scenario_a",
        name: "Path A",
        inputs: { supportRatePct: 57, turnoutA: 44, contactRatePct: 26 },
        outputs: { winProb: 0.53, voteNeed: 1200 },
      },
    });
    const legacyInputDiff = buildLegacyScenarioInputDiffSummary({
      baselineInputs: {
        supportRatePct: 55,
        turnoutA: 42,
        ui: { ignored: true },
      },
      activeInputs: {
        supportRatePct: 57,
        turnoutA: 44,
        contactRatePct: 26,
        mcLast: { ignored: true },
      },
      maxShow: 1,
    });
    const legacyOutputDiff = buildLegacyScenarioOutputDiffRows({
      baseline: {
        attemptsPerWeek: 100,
        convosPerWeek: 30,
        finishDate: new Date("2026-10-01T00:00:00.000Z"),
        paceFinishDate: new Date("2026-10-15T00:00:00.000Z"),
      },
      active: {
        attemptsPerWeek: 90,
        convosPerWeek: 35,
        finishDate: new Date("2026-09-28T00:00:00.000Z"),
        paceFinishDate: new Date("2026-10-20T00:00:00.000Z"),
      },
      formatInt: (value) => String(value),
      formatDate: (date) => date.toISOString().slice(0, 10),
    });
    const legacyPaceAttempts = computeLegacyScenarioPaceAttemptsPerDay({
      hasLog: true,
      days: 7,
      sumAttempts: 140,
    });
    const legacyPaceAttemptsMissing = computeLegacyScenarioPaceAttemptsPerDay({
      hasLog: false,
      days: 7,
      sumAttempts: 140,
    });
    const legacyKeyOutput = buildLegacyScenarioComparisonKeyOutput({
      coreOutput: {
        ctx: {
          attemptsPerWeek: 112,
          convosPerWeek: 44,
          attemptsNeeded: 900,
        },
        finish: new Date("2026-10-10T00:00:00.000Z"),
      },
      lastLogSummary: {
        hasLog: true,
        days: 7,
        sumAttempts: 140,
      },
      paceFinishDateFn: (attemptsNeeded, attemptsPerDay) => {
        if (!Number.isFinite(Number(attemptsNeeded)) || !Number.isFinite(Number(attemptsPerDay)) || Number(attemptsPerDay) <= 0){
          return null;
        }
        return new Date("2026-10-20T00:00:00.000Z");
      },
    });
    const legacyKeyOutputFallback = buildLegacyScenarioComparisonKeyOutput({
      coreOutput: null,
      lastLogSummary: null,
      paceFinishDateFn: null,
    });
    const legacyCompareTag = deriveLegacyScenarioCompareTag({
      totalChanged: legacyInputDiff.totalChanged,
      attemptsDelta: legacyOutputDiff.attemptsDelta,
    });
    const divergenceLow = deriveLegacyScenarioDivergence({
      baselineInputs: { supportRatePct: 55, contactRatePct: 24 },
      activeInputs: { supportRatePct: 57, contactRatePct: 26 },
      lowThreshold: 3,
      moderateThreshold: 8,
    });
    const divergenceModerate = deriveLegacyScenarioDivergence({
      baselineInputs: { supportRatePct: 55, contactRatePct: 24, turnoutReliabilityPct: 79, orgCount: 8 },
      activeInputs: { supportRatePct: 57, contactRatePct: 28, turnoutReliabilityPct: 82, orgCount: 8 },
      lowThreshold: 2,
      moderateThreshold: 4,
    });
    const divergenceHigh = deriveLegacyScenarioDivergence({
      baselineInputs: { supportRatePct: 55, contactRatePct: 24, turnoutReliabilityPct: 79, orgCount: 8, callsPerHour3: 42 },
      activeInputs: { supportRatePct: 58, contactRatePct: 27, turnoutReliabilityPct: 83, orgCount: 10, callsPerHour3: 46 },
      lowThreshold: 1,
      moderateThreshold: 3,
    });
    const genericChanges = buildScenarioInputChangeRows({
      baselineInputs: {
        supportRatePct: 55,
        contactRatePct: 24,
        ui: { ignored: true },
      },
      activeInputs: {
        supportRatePct: 57,
        contactRatePct: 26,
        turnoutReliabilityPct: 80,
        mcLastHash: "ignored",
      },
      labels: {
        supportRatePct: "Support rate %",
        contactRatePct: "Contact rate %",
        turnoutReliabilityPct: "Turnout reliability %",
      },
      ignoreKeys: ["ui", "mcLast", "mcLastHash"],
    });

    const compareNone = deriveScenarioCompareCardStatus({
      modeText: SCENARIO_COMPARE_MODE_DISABLED_TEXT,
      outputDiffCount: 0,
    });
    const compareDiffs = deriveScenarioCompareCardStatus({ modeText: "Comparing", outputDiffCount: 3 });
    const compareDone = deriveScenarioCompareCardStatus({ modeText: "Comparing", outputDiffCount: 0 });

    const notesUnavailable = deriveScenarioNotesCardStatus("Scenario runtime bridge unavailable.", "Scenario storage unavailable.");
    const notesReady = deriveScenarioNotesCardStatus("No warnings.", "Local storage");
    const notesWatch = deriveScenarioNotesCardStatus("Warning: diff volume is high.", "Local storage");

    const summaryUnavailable = deriveScenarioSummaryCardStatus(null, null);
    const summaryDelta = deriveScenarioSummaryCardStatus(
      { activeScenarioId: "scenario_a", baselineId: "baseline" },
      { inputDiffCount: 2 },
    );
    const summaryActive = deriveScenarioSummaryCardStatus(
      { activeScenarioId: "scenario_a", baselineId: "baseline" },
      { inputDiffCount: 0 },
    );
    const summaryBaseline = deriveScenarioSummaryCardStatus(
      { activeScenarioId: "baseline", baselineId: "baseline" },
      { inputDiffCount: 0 },
    );

    const toneOk = classifyScenarioStatusTone("Baseline ready");
    const toneWarn = classifyScenarioStatusTone("Delta tracked");
    const toneBad = classifyScenarioStatusTone("Unavailable");

    assert(workspaceSummary.activeLabel === "Active Scenario: Path A", "scenario workspace summary should build active scenario labels canonically");
    assert(workspaceSummary.warning === "Scenario limit exceeded (3/2). Delete scenarios to stay under the cap.", "scenario workspace summary should format canonical over-limit warning text");
    assert(workspaceSummary.storageStatus === SCENARIO_STORAGE_STATUS_SESSION_ONLY, "scenario workspace summary should expose canonical storage status text");
    assert(SCENARIO_ACTIVE_LABEL_FALLBACK === "Active Scenario: —", "scenario active-label fallback constant mismatch");
    assert(workspaceSummaryBaseline.activeLabel === SCENARIO_ACTIVE_LABEL_FALLBACK, "scenario workspace summary should fall back to canonical empty active label");
    assert(workspaceSummaryBaseline.warning === "", "scenario workspace summary should omit warning when within scenario cap");
    assert(workspaceUnavailable === SCENARIO_STATUS_UNAVAILABLE, "scenario workspace status should be unavailable with no scenarios");
    assert(workspaceActive === "Scenario active", "scenario workspace status should detect active non-baseline scenario");
    assert(workspaceBaseline === "Baseline ready", "scenario workspace status should detect baseline mode");

    assert(comparisonDisabled.modeText === SCENARIO_COMPARE_MODE_DISABLED_TEXT, "scenario comparison view should use disabled compare mode text when active scenario is baseline");
    assert(comparisonDisabled.outputDiffCount === 0, "scenario comparison view should have zero output diffs when comparison disabled");
    assert(comparisonDisabled.inputDiffs.length === 0, "scenario comparison view should expose no input diffs when comparison disabled");
    assert(comparisonActive.modeText === "Comparing active scenario", "scenario comparison view should detect active compare mode");
    assert(comparisonActive.tag === "Baseline vs Path A", "scenario comparison view should build baseline-vs-active tag");
    assert(comparisonActive.inputDiffCount === 3, "scenario comparison view should count input diffs canonically");
    assert(comparisonActive.outputDiffCount === 2, "scenario comparison view should count output diffs canonically");
    assert(comparisonActive.inputDiffFoot === "3 fields differ.", "scenario comparison view should format canonical diff footnote");
    assert(legacyInputDiff.diffKeyCount === 2, "legacy scenario input diff should count ordered key diffs canonically");
    assert(legacyInputDiff.otherChangedCount === 1, "legacy scenario input diff should count non-ordered key diffs canonically");
    assert(legacyInputDiff.totalChanged === 3, "legacy scenario input diff should include ordered + non-ordered changes");
    assert(legacyInputDiff.items.length === 1, "legacy scenario input diff should honor maxShow");
    assert(legacyInputDiff.items[0]?.label === "Support rate (%)", "legacy scenario input diff should map canonical labels");
    assert(legacyInputDiff.items[0]?.text === "55 → 57", "legacy scenario input diff should format canonical before/after text");
    assert(legacyInputDiff.remainingCount === 2, "legacy scenario input diff should expose remaining hidden change count");
    assert(legacyOutputDiff.rows.length === 4, "legacy scenario output diff should produce canonical output rows");
    assert(legacyOutputDiff.rows[0]?.deltaText === "-10", "legacy scenario output diff should compute numeric delta text canonically");
    assert(legacyOutputDiff.rows[0]?.kind === "ok", "legacy scenario output diff should classify lower attempts as favorable");
    assert(legacyOutputDiff.rows[1]?.deltaText === "+5", "legacy scenario output diff should compute positive numeric delta text canonically");
    assert(legacyOutputDiff.rows[1]?.kind === "bad", "legacy scenario output diff should classify higher convos as unfavorable in legacy compare");
    assert(legacyOutputDiff.rows[2]?.deltaText === "-3d", "legacy scenario output diff should compute finish-date delta text canonically");
    assert(legacyOutputDiff.rows[2]?.kind === "ok", "legacy scenario output diff should classify earlier finish dates as favorable");
    assert(legacyOutputDiff.rows[3]?.deltaText === "+5d", "legacy scenario output diff should compute pace-finish delta text canonically");
    assert(legacyOutputDiff.rows[3]?.kind === "bad", "legacy scenario output diff should classify later pace-finish dates as unfavorable");
    assert(legacyOutputDiff.attemptsDelta === -10, "legacy scenario output diff should expose attempts delta for tag derivation");
    assert(approx(Number(legacyPaceAttempts), 20, 1e-9), "legacy scenario pace-attempt helper should compute attempts/day canonically");
    assert(legacyPaceAttemptsMissing == null, "legacy scenario pace-attempt helper should return null when logs are unavailable");
    assert(legacyKeyOutput.attemptsPerWeek === 112, "legacy scenario key-output helper should preserve attempts/week from core output");
    assert(legacyKeyOutput.convosPerWeek === 44, "legacy scenario key-output helper should preserve convos/week from core output");
    assert(legacyKeyOutput.finishDate instanceof Date, "legacy scenario key-output helper should preserve finish-date objects");
    assert(legacyKeyOutput.paceFinishDate instanceof Date, "legacy scenario key-output helper should project pace-finish date via callback");
    assert(approx(Number(legacyKeyOutput.paceAttemptsPerDay), 20, 1e-9), "legacy scenario key-output helper should preserve derived pace attempts/day");
    assert(legacyKeyOutputFallback.attemptsPerWeek == null, "legacy scenario key-output helper should fall back to null attempts/week without core output");
    assert(legacyKeyOutputFallback.paceFinishDate == null, "legacy scenario key-output helper should fall back to null pace-finish date without callback");
    assert(legacyCompareTag.kind === "ok", "legacy scenario compare tag should classify lower attempts delta as favorable");
    assert(legacyCompareTag.text === "3 input change(s)", "legacy scenario compare tag should format canonical input change summary");
    assert(divergenceLow.cls === "ok" && divergenceLow.label === "Low" && divergenceLow.diffCount === 2, "legacy divergence should classify low diff count as Low");
    assert(divergenceModerate.cls === "warn" && divergenceModerate.label === "Moderate" && divergenceModerate.diffCount === 3, "legacy divergence should classify threshold-middle diff count as Moderate");
    assert(divergenceHigh.cls === "bad" && divergenceHigh.label === "High" && divergenceHigh.diffCount === 5, "legacy divergence should classify high diff count as High");
    assert(genericChanges.length === 3, "scenario input change rows should include all non-ignored changed keys");
    assert(genericChanges[0]?.label === "Contact rate %", "scenario input change rows should sort rows by label");
    assert(genericChanges[1]?.label === "Support rate %", "scenario input change rows should preserve supplied labels");
    assert(genericChanges[2]?.label === "Turnout reliability %", "scenario input change rows should include newly-added changed keys");

    assert(compareNone === "No compare", "scenario compare status should indicate no-compare mode");
    assert(compareDiffs === "Diffs ready", "scenario compare status should detect output diffs");
    assert(compareDone === "Compared", "scenario compare status should detect zero-diff compared mode");

    assert(notesUnavailable === SCENARIO_STATUS_UNAVAILABLE, "scenario notes status should detect unavailable warnings");
    assert(notesReady === "Storage ready", "scenario notes status should detect no-warning storage-ready mode");
    assert(notesWatch === "Watchlist", "scenario notes status should detect warning/diff/delete watchlist mode");

    assert(summaryUnavailable === SCENARIO_STATUS_UNAVAILABLE, "scenario summary status should be unavailable without view");
    assert(summaryDelta === "Delta tracked", "scenario summary status should detect tracked deltas");
    assert(summaryActive === "Scenario active", "scenario summary status should detect active scenario without deltas");
    assert(summaryBaseline === "Baseline", "scenario summary status should detect baseline mode");

    assert(toneOk === "ok", "scenario tone should map baseline-ready to ok");
    assert(toneWarn === "warn", "scenario tone should map delta-tracked to warn");
    assert(toneBad === "bad", "scenario tone should map unavailable to bad");
    assert(SCENARIO_STATUS_AWAITING_SCENARIO === "Awaiting scenario", "scenario awaiting-status constant mismatch");
    return true;
  });

  test("Rebuild contracts: intel defaults and patch matching are canonical", () => {
    const state = {
      intelState: {
        workflow: {},
        simToggles: {},
        expertToggles: {},
      },
    };
    const intel = ensureIntelCollections(state);

    assert(intel?.workflow?.requireCriticalNote === true, "intel workflow should default requireCriticalNote=true");
    assert(intel?.workflow?.requireCriticalEvidence === true, "intel workflow should default requireCriticalEvidence=true");
    assert(intel?.simToggles?.mcDistribution === "triangular", "intel sim toggles should default mcDistribution to triangular");
    assert(intel?.simToggles?.shockScenariosEnabled === true, "intel sim toggles should default shock scenarios enabled");
    assert(intel?.expertToggles?.capacityDecayEnabled === false, "intel expert toggles should default capacityDecayEnabled to false");
    assert(Number(intel?.expertToggles?.decayModel?.weeklyDecayPct) === 0.03, "intel decay model should default weeklyDecayPct to canonical value");
    assert(Number(intel?.expertToggles?.decayModel?.floorPctOfBaseline) === 0.70, "intel decay model should default floorPctOfBaseline to canonical value");

    assert(patchValuesEqual(1, 1 + 5e-10) === true, "patch value matcher should treat near-equal numeric values as equal");
    assert(patchValuesEqual(1, 1 + 2e-9) === false, "patch value matcher should distinguish numeric values outside epsilon");
    assert(patchValuesEqual("1", 1) === false, "patch value matcher should preserve strict non-numeric equality");
    assert(valuesEqualWithTolerance(1, 1 + 5e-10, 1e-9) === true, "value compare helper should treat near-equal numbers as equal");
    assert(valuesEqualWithTolerance(1, 1 + 1e-9, 1e-9) === false, "value compare helper should enforce canonical strict epsilon threshold");
    assert(valuesEqualWithTolerance("match", "match", 1e-9) === true, "value compare helper should preserve Object.is semantics for non-numeric values");

    const recommendationState = {
      intelState: {
        recommendations: [
          { id: "auto_low", source: "auto.realityDrift.v1", priority: 9 },
          { id: "manual_rec", source: "manual.review", priority: 1 },
          { id: "auto_high", source: "auto.realityDrift.v1", priority: 2 },
        ],
      },
    };
    const resolvedTop = resolveRecommendationForApply(recommendationState, "");
    const resolvedSpecific = resolveRecommendationForApply(recommendationState, "manual_rec");
    const resolvedMissing = resolveRecommendationForApply({}, "missing");
    const autoRecs = listAutoDriftRecommendations(recommendationState);
    const autoRecTopOnly = listAutoDriftRecommendations(recommendationState, { limit: 1 });

    assert(String(resolvedTop?.id || "") === "auto_high", "recommendation resolver should select the highest-priority auto drift recommendation");
    assert(String(resolvedSpecific?.id || "") === "manual_rec", "recommendation resolver should return explicit recommendation id matches");
    assert(resolvedMissing === null, "recommendation resolver should return null when recommendation is unavailable");
    assert(autoRecs.length === 2 && String(autoRecs[0]?.id || "") === "auto_high", "auto drift recommendation list should sort canonically by priority");
    assert(autoRecTopOnly.length === 1 && String(autoRecTopOnly[0]?.id || "") === "auto_high", "auto drift recommendation list should support canonical top-N limiting");

    const applyState = {
      supportRatePct: 50,
      ui: {},
      intelState: {
        workflow: {},
        recommendations: [
          {
            id: "auto_apply",
            source: "auto.realityDrift.v1",
            priority: 1,
            title: "Raise support",
            draftPatch: {
              type: "setInput",
              target: "supportRatePct",
              suggestedValue: 52,
            },
          },
        ],
        audit: [
          {
            id: "audit_support",
            kind: "critical_ref_change",
            source: "ui",
            key: "supportRatePct",
            after: 52,
            status: "open",
          },
        ],
      },
    };
    const applyResult = applyTopDriftRecommendation(applyState);
    const appliedRec = Array.isArray(applyState?.intelState?.recommendations) ? applyState.intelState.recommendations[0] : null;

    assert(applyResult?.ok === true, "top drift recommendation apply helper should apply canonical recommendation");
    assert(Number(applyState.supportRatePct) === 52, "top drift recommendation apply helper should patch state inputs");
    assert(Number(applyResult?.changesCount || 0) === 1, "top drift recommendation apply helper should report canonical change count");
    assert(applyResult?.needsGovernance === true, "top drift recommendation apply helper should detect unresolved governance follow-up");
    assert(String(appliedRec?.status || "") === "appliedNeedsGovernance", "top drift recommendation apply helper should set recommendation governance status");
    assert(Array.isArray(appliedRec?.appliedAuditIds) && appliedRec.appliedAuditIds.includes("audit_support"), "top drift recommendation apply helper should link matching audit ids");

    const missingApply = applyTopDriftRecommendation({ intelState: { recommendations: [] } });
    assert(missingApply?.ok === false && String(missingApply?.code || "") === "missing_recommendation", "top drift recommendation apply helper should return canonical missing-recommendation failure");

    const refreshState = {
      supportRatePct: 50,
      contactRatePct: 24,
      doorsPerHour3: 24,
      callsPerHour3: 16,
      intelState: {
        recommendations: [
          { id: "manual_keep", source: "manual.review", title: "Manual recommendation" },
        ],
        flags: [
          { id: "manual_flag_keep", source: "manual.review", message: "Manual flag" },
        ],
      },
    };
    const refreshResult = captureObservedAndRefreshDriftRecommendations(refreshState, {
      drift: {
        hasLog: true,
        windowStart: "2026-02-01",
        windowEnd: "2026-02-07",
        windowEntries: 7,
        actualCR: 0.18,
        assumedCR: 0.25,
        actualSR: 0.46,
        assumedSR: 0.52,
        actualAPH: 16,
        expectedAPH: 20,
        primary: "contact",
      },
      observedSource: "dailyLog.rolling7",
      observedMaxEntries: 180,
      recommendationMaxEntries: 60,
    });
    assert(refreshResult?.ok === true, "drift refresh helper should report success when recommendation refresh succeeds");
    assert(refreshResult?.metricsResult?.ok === true, "drift refresh helper should include observed metrics capture result");
    assert(refreshResult?.recommendationResult?.ok === true, "drift refresh helper should include recommendation refresh result");
    assert(Number(refreshResult?.recommendationResult?.autoTotal || 0) >= 1, "drift refresh helper should produce auto recommendations for drifted metrics");
    assert(Array.isArray(refreshState?.intelState?.recommendations) && refreshState.intelState.recommendations.some((row) => String(row?.id || "") === "manual_keep"), "drift refresh helper should preserve manual recommendations");
    return true;
  });

  test("Rebuild contracts: canonical numeric coercion helpers preserve Number semantics", () => {
    assert(coerceFiniteNumber("42.5") === 42.5, "coerceFiniteNumber should parse numeric strings");
    assert(coerceFiniteNumber("") === 0, "coerceFiniteNumber should preserve Number('') === 0 semantics");
    assert(coerceFiniteNumber("not-a-number") == null, "coerceFiniteNumber should return null for non-finite inputs");
    assert(clampFiniteNumber("7", 0, 5) === 5, "clampFiniteNumber should clamp parsed numeric strings");
    assert(clampFiniteNumber("-2", 0, 5) === 0, "clampFiniteNumber should enforce lower bound");
    assert(clampFiniteNumber("bad", 3, 9) === 3, "clampFiniteNumber should fall back to lower bound for non-numeric inputs");
    assert(rateOverrideToDecimal("0.42", null) === 0.42, "rateOverrideToDecimal should preserve canonical decimal rate inputs");
    assert(rateOverrideToDecimal("42", null) === 0.42, "rateOverrideToDecimal should normalize percent-style rates to decimal units");
    assert(rateOverrideToDecimal("120", 0.33) === 0.33, "rateOverrideToDecimal should preserve fallback for out-of-range rate inputs");
    assert(computeTargetUniverseSize({ universeSize: 10000, targetUniversePct: 35 }) === 3500, "computeTargetUniverseSize should normalize canonical universe math");
    assert(computeGotvAddedVotes({ targetUniverseSize: 3500, avgLiftPP: 1.8 }) === 63, "computeGotvAddedVotes should normalize canonical turnout-added-votes math");
    return true;
  });

  test("Rebuild contracts: turnout model helper resolves canonical mode-specific turnout inputs", () => {
    const basic = buildTurnoutModelFromState({
      turnoutEnabled: true,
      turnoutBaselinePct: 55,
      gotvMode: "basic",
      gotvLiftPP: 1.2,
      gotvLiftMode: 3.4,
      gotvMaxLiftPP: 9,
      gotvMaxLiftPP2: 14,
      gotvDiminishing: true,
    });
    assert(!!basic && basic.enabled === true, "turnout model helper should return enabled model when turnout is enabled");
    assert(basic?.baselineTurnoutPct === 55, "turnout model helper should default baseline to turnoutBaselinePct");
    assert(basic?.liftPerContactPP === 1.2, "turnout model helper should use basic-mode lift input in basic mode");
    assert(basic?.maxLiftPP === 9, "turnout model helper should use basic-mode max lift input in basic mode");
    assert(basic?.useDiminishing === true, "turnout model helper should preserve diminishing toggle");

    const advanced = buildTurnoutModelFromState({
      turnoutEnabled: true,
      turnoutBaselinePct: 55,
      gotvMode: "advanced",
      gotvLiftPP: 1.2,
      gotvLiftMode: 3.4,
      gotvMaxLiftPP: 9,
      gotvMaxLiftPP2: 14,
    });
    assert(advanced?.liftPerContactPP === 3.4, "turnout model helper should use advanced lift input in advanced mode");
    assert(advanced?.maxLiftPP === 14, "turnout model helper should use advanced max lift input in advanced mode");

    const withOverride = buildTurnoutModelFromState({
      turnoutEnabled: true,
      turnoutBaselinePct: 55,
      turnoutTargetOverridePct: 61,
    });
    assert(withOverride?.baselineTurnoutPct === 61, "turnout model helper should prioritize turnout target override when present");

    assert(
      buildTurnoutModelFromState({ turnoutEnabled: false }) == null,
      "turnout model helper should return null for disabled turnout unless includeDisabled is requested",
    );
    const disabledModel = buildTurnoutModelFromState({ turnoutEnabled: false }, { includeDisabled: true });
    assert(!!disabledModel && disabledModel.enabled === false, "turnout model helper should support includeDisabled option");
    return true;
  });

  test("Rebuild contracts: controls view helpers are canonical and deterministic", () => {
    const workflowUnavailable = deriveControlsWorkflowCardStatus("Unavailable", "Unavailable");
    const workflowLocked = deriveControlsWorkflowCardStatus("Scenario lock ON", "Active review");
    const workflowGuarded = deriveControlsWorkflowCardStatus("Scenario lock OFF", "Active review");
    const workflowHealthy = deriveControlsWorkflowCardStatus("Scenario lock OFF", "Healthy");
    const workflowAwaiting = deriveControlsWorkflowCardStatus("", "");

    const evidenceUnavailable = deriveControlsEvidenceCardStatus("0 unresolved", "0 unresolved", "Unavailable");
    const evidenceNeeds = deriveControlsEvidenceCardStatus("2 unresolved", "0 unresolved", "Ready");
    const evidenceAttach = deriveControlsEvidenceCardStatus("0 unresolved", "0 unresolved", "Ready to attach");
    const evidenceClear = deriveControlsEvidenceCardStatus("0 unresolved", "0 unresolved", "No unresolved evidence");
    const evidenceAwaiting = deriveControlsEvidenceCardStatus("0 unresolved", "0 unresolved", "");

    const benchmarkUnavailable = deriveControlsBenchmarkCardStatus("0 records", "Unavailable");
    const benchmarkSet = deriveControlsBenchmarkCardStatus("3 records", "Ready");
    const benchmarkReady = deriveControlsBenchmarkCardStatus("0 records", "Ready");
    const benchmarkEmpty = deriveControlsBenchmarkCardStatus("0 records", "");

    const reviewUnavailable = deriveControlsReviewCardStatus("0 observed", "0 recommendations", "Unavailable", "0 what-if");
    const reviewReady = deriveControlsReviewCardStatus("0 observed", "2 recommendations", "Ready", "0 what-if");
    const reviewObserved = deriveControlsReviewCardStatus("2 observed", "0 recommendations", "Ready", "0 what-if");
    const reviewParser = deriveControlsReviewCardStatus("0 observed", "0 recommendations", "Ready", "2 what-if");
    const reviewAwaiting = deriveControlsReviewCardStatus("0 observed", "0 recommendations", "Ready", "0 what-if");

    const integrityUnavailable = deriveControlsIntegrityCardStatus("Unavailable", "", "", "");
    const integrityBrief = deriveControlsIntegrityCardStatus("Generated", "", "", "");
    const integritySim = deriveControlsIntegrityCardStatus("", "matrix on", "enabled", "");
    const integrityNeeds = deriveControlsIntegrityCardStatus("", "", "", "");

    const warningsUnavailable = deriveControlsWarningsCardStatus("0 unresolved", "0 unresolved", "0 recommendations", "Unavailable");
    const warningsAction = deriveControlsWarningsCardStatus("1 unresolved", "0 unresolved", "0 recommendations", "Healthy");
    const warningsWatch = deriveControlsWarningsCardStatus("0 unresolved", "0 unresolved", "2 recommendations", "Active");
    const warningsQuiet = deriveControlsWarningsCardStatus("0 unresolved", "0 unresolved", "0 recommendations", "Healthy");

    const toneOk = classifyControlsStatusTone("Review ready");
    const toneWarn = classifyControlsStatusTone("Watchlist");
    const toneBad = classifyControlsStatusTone("Needs evidence");
    const parsedControlNumber = parseControlsOptionalNumber("7.5");
    const parsedControlBlank = parseControlsOptionalNumber("   ");
    const parsedControlInvalid = parseControlsOptionalNumber("n/a");
    const controlsNumberInteger = formatControlsNumber(12);
    const controlsNumberDecimal = formatControlsNumber(12.3456);
    const controlsNumberMissing = formatControlsNumber("n/a");
    const controlsRecordSingle = formatControlsRecordCount(1, "benchmark entry", "configured");
    const controlsRecordPlural = formatControlsRecordCount(3, "benchmark entry", "configured");
    const controlsRecordFallback = formatControlsRecordCount("n/a", "benchmark entry", "configured");
    const controlsIsoDate = formatControlsIsoDate("2026-03-18T12:45:00.000Z");
    const controlsIsoDateFallback = formatControlsIsoDate("");

    assert(workflowUnavailable === "Unavailable", "controls workflow status should detect unavailable state");
    assert(workflowLocked === "Locked", "controls workflow status should detect lock-on state");
    assert(workflowGuarded === "Guarded", "controls workflow status should detect active guard state");
    assert(workflowHealthy === "Healthy", "controls workflow status should detect healthy state");
    assert(workflowAwaiting === CONTROLS_STATUS_AWAITING_REVIEW, "controls workflow status should fall back to awaiting-review");

    assert(evidenceUnavailable === "Unavailable", "controls evidence status should detect unavailable state");
    assert(evidenceNeeds === "Needs evidence", "controls evidence status should detect unresolved evidence");
    assert(evidenceAttach === "Ready to attach", "controls evidence status should detect attach readiness");
    assert(evidenceClear === "Audit clear", "controls evidence status should detect clear audits");
    assert(evidenceAwaiting === "Awaiting audit", "controls evidence status should fall back to awaiting-audit");

    assert(benchmarkUnavailable === "Unavailable", "controls benchmark status should detect unavailable state");
    assert(benchmarkSet === "Benchmarks set", "controls benchmark status should detect configured benchmark count");
    assert(benchmarkReady === "Ready", "controls benchmark status should detect ready catalog");
    assert(benchmarkEmpty === "Catalog empty", "controls benchmark status should detect empty catalog");

    assert(reviewUnavailable === "Unavailable", "controls review status should detect unavailable recommendation state");
    assert(reviewReady === "Review ready", "controls review status should detect ready recommendations");
    assert(reviewObserved === "Observed captured", "controls review status should detect observed metrics capture");
    assert(reviewParser === "Parser active", "controls review status should detect active what-if parser");
    assert(reviewAwaiting === "Awaiting feedback", "controls review status should fall back to awaiting feedback");

    assert(integrityUnavailable === "Unavailable", "controls integrity status should detect unavailable state");
    assert(integrityBrief === "Brief ready", "controls integrity status should detect generated calibration brief");
    assert(integritySim === "Sim ready", "controls integrity status should detect ready simulation inputs");
    assert(integrityNeeds === "Needs brief", "controls integrity status should detect missing brief");

    assert(warningsUnavailable === "Unavailable", "controls warnings status should detect unavailable workflow");
    assert(warningsAction === "Action needed", "controls warnings status should detect unresolved warnings");
    assert(warningsWatch === "Watchlist", "controls warnings status should detect active recommendations/workflow");
    assert(warningsQuiet === "Quiet", "controls warnings status should detect quiet state");

    assert(toneOk === "ok", "controls tone should map review-ready to ok");
    assert(toneWarn === "warn", "controls tone should map watchlist to warn");
    assert(toneBad === "bad", "controls tone should map needs-evidence to bad");
    assert(parsedControlNumber === 7.5, "controls optional-number parser should parse finite numeric strings");
    assert(parsedControlBlank == null, "controls optional-number parser should return null for empty input");
    assert(parsedControlInvalid == null, "controls optional-number parser should return null for non-numeric input");
    assert(controlsNumberInteger === "12", "controls number formatter should keep integers whole");
    assert(controlsNumberDecimal === "12.35", "controls number formatter should clamp decimals to two places");
    assert(controlsNumberMissing === "—", "controls number formatter should return em-dash fallback for invalid input");
    assert(controlsRecordSingle === "1 benchmark entry configured.", "controls record-count formatter should singularize nouns");
    assert(controlsRecordPlural === "3 benchmark entries configured.", "controls record-count formatter should use canonical pluralization behavior");
    assert(controlsRecordFallback === "0 benchmark entries configured.", "controls record-count formatter should default invalid counts to zero");
    assert(controlsIsoDate === "2026-03-18", "controls ISO date formatter should trim timestamps to canonical date text");
    assert(controlsIsoDateFallback === "—", "controls ISO date formatter should return fallback when value is empty");
    assert(CONTROLS_STATUS_AWAITING_REVIEW === "Awaiting review", "controls awaiting-review constant mismatch");

    const intel = {
      observedMetrics: [{ id: "obs_1" }, { id: "obs_2" }],
      recommendations: [
        { id: "rec_2", priority: 2, title: "Second recommendation", detail: "Detail B" },
        { id: "rec_1", priority: 1, title: "First recommendation", detail: "Detail A" },
      ],
      intelRequests: [
        { id: "req_1", createdAt: "2026-03-01T00:00:00.000Z", status: "parsed", summary: "Older", prompt: "Old prompt" },
        { id: "req_2", createdAt: "2026-03-02T00:00:00.000Z", status: "queued", summary: "Latest", prompt: "Latest prompt" },
      ],
    };
    const emptyIntel = {};

    const observedCountText = buildObservedCountText(intel);
    const recommendationCountText = buildRecommendationCountText(intel);
    const observedStatusText = buildObservedStatusText(intel);
    const recommendationStatusText = buildRecommendationStatusText(intel);
    const whatIfCountText = buildWhatIfCountText(intel);
    const whatIfStatusText = buildWhatIfStatusText(intel);
    const whatIfPreviewText = buildWhatIfPreviewTextFromIntel(intel);
    const recommendationPreviewText = buildRecommendationPreviewTextFromIntel(intel);

    assert(observedCountText === "2 observed metric entries captured.", "controls observed count text should use canonical observed-metrics count");
    assert(recommendationCountText === "2 active drift recommendations.", "controls recommendation count text should use canonical recommendation count");
    assert(observedStatusText === "Observed metrics captured.", "controls observed status text should detect captured metrics");
    assert(recommendationStatusText === "Drift recommendations ready for review.", "controls recommendation status text should detect recommendations");
    assert(whatIfCountText === "2 what-if request(s) parsed.", "controls what-if count text should use canonical request count");
    assert(whatIfStatusText === "What-if request parsed.", "controls what-if status text should detect parsed requests");
    assert(whatIfPreviewText.includes("Status: queued") && whatIfPreviewText.includes("Summary: Latest"), "controls what-if preview should prioritize most recent request");
    assert(recommendationPreviewText.startsWith("[P1] First recommendation"), "controls recommendation preview should be priority-sorted");

    assert(buildObservedCountText(emptyIntel) === "0 observed metric entries captured.", "controls observed count text should default to zero");
    assert(buildRecommendationCountText(emptyIntel) === "0 active drift recommendations.", "controls recommendation count text should default to zero");
    assert(buildObservedStatusText(emptyIntel) === "No observed metrics captured yet.", "controls observed status text should default to empty state");
    assert(buildRecommendationStatusText(emptyIntel) === "No drift recommendations generated yet.", "controls recommendation status text should default to empty state");
    assert(buildWhatIfCountText(emptyIntel) === "0 what-if requests parsed.", "controls what-if count text should default to zero");
    assert(buildWhatIfStatusText(emptyIntel) === "No what-if requests parsed yet.", "controls what-if status text should default to empty state");
    assert(buildWhatIfPreviewTextFromIntel(emptyIntel) === "", "controls what-if preview text should be empty when no requests exist");
    assert(buildRecommendationPreviewTextFromIntel(emptyIntel) === "", "controls recommendation preview text should be empty when no recommendations exist");
    assert(
      buildControlsObservedStatusView(intel).tone === "muted",
      "controls observed status-view helper should mark populated metrics as muted informational state",
    );
    assert(
      buildControlsObservedStatusView(emptyIntel).text.includes("Use Capture observed metrics."),
      "controls observed status-view helper should append capture guidance when empty",
    );
    assert(
      buildControlsRecommendationStatusView({ observedIntel: emptyIntel, recommendationIntel: intel }).tone === "warn",
      "controls recommendation status-view helper should warn when observed metrics are missing",
    );
    assert(
      buildControlsRecommendationStatusView({ observedIntel: intel, recommendationIntel: intel }).tone === "ok",
      "controls recommendation status-view helper should be ok when observed metrics and recommendations are both present",
    );
    assert(
      buildControlsRecommendationStatusView({ observedIntel: intel, recommendationIntel: emptyIntel }).tone === "muted",
      "controls recommendation status-view helper should become muted when no recommendations are active",
    );

    assert(
      buildControlsScenarioLockStatus({ locked: false, lockReason: "Freeze" }) === "Scenario lock OFF.",
      "controls scenario lock status should show OFF when lock is disabled",
    );
    assert(
      buildControlsScenarioLockStatus({ locked: true, lockReason: "Client review freeze" }) === "Scenario lock ON (Client review freeze).",
      "controls scenario lock status should include lock reason",
    );
    assert(
      buildControlsWorkflowStatus({ scenarioLocked: false, requireCriticalNote: false, requireCriticalEvidence: false }) === "Governance controls healthy.",
      "controls workflow status should be healthy when no guards are active",
    );
    assert(
      buildControlsWorkflowStatus({ scenarioLocked: true, requireCriticalNote: false, requireCriticalEvidence: false }) === "Governance controls active.",
      "controls workflow status should be active when scenario lock is enabled",
    );
    assert(
      buildControlsBenchmarkDraftStatus({ reference: "" }) === "Select reference and scope, then save benchmark.",
      "controls benchmark draft status should require a reference",
    );
    assert(
      buildControlsBenchmarkDraftStatus({ reference: "core.supportRatePct" }) === "Benchmark ready to save.",
      "controls benchmark draft status should mark benchmark ready when reference exists",
    );
    assert(
      buildControlsEvidenceAttachStatus({
        evidenceRowCount: 0,
        unresolvedAuditCount: 2,
        evidenceTitle: "",
        evidenceSource: "",
      }) === "Select an audit item, then attach evidence.",
      "controls evidence attach status should require title/source while unresolved items exist",
    );
    assert(
      buildControlsEvidenceAttachStatus({
        evidenceRowCount: 0,
        unresolvedAuditCount: 2,
        evidenceTitle: "Source doc",
        evidenceSource: "Report",
      }) === "Ready to attach evidence.",
      "controls evidence attach status should detect attach readiness",
    );
    assert(
      buildControlsEvidenceAttachStatus({
        evidenceRowCount: 3,
        unresolvedAuditCount: 0,
        evidenceTitle: "",
        evidenceSource: "",
      }) === "All critical edits resolved with evidence.",
      "controls evidence attach status should detect resolved audits",
    );
    assert(
      buildControlsCorrelationDisabledHint(0) === "No models yet.",
      "controls correlation hint should show no-model message when empty",
    );
    assert(
      buildControlsCorrelationDisabledHint(2) === "Correlation models available. Select a model to apply.",
      "controls correlation hint should show model-available message when models exist",
    );
    assert(
      buildControlsDecayStatus({ enabled: false, weeklyPct: "3" }) === "Capacity decay OFF.",
      "controls decay status should show OFF when decay is disabled",
    );
    assert(
      buildControlsDecayStatus({ enabled: true, weeklyPct: "3.5" }) === "Capacity decay ON at 3.5% weekly.",
      "controls decay status should include weekly percentage when present",
    );
    assert(
      buildControlsCorrelationStatus({
        enabled: false,
        modelCount: 0,
        selectedModelId: "",
        selectedModelLabel: "",
      }) === "Correlation model OFF (no models configured).",
      "controls correlation status should detect disabled state with no models",
    );
    assert(
      buildControlsCorrelationStatus({
        enabled: true,
        modelCount: 2,
        selectedModelId: "",
        selectedModelLabel: "",
      }) === "Correlation model ON (2 models available, select one).",
      "controls correlation status should request selection when enabled without model selection",
    );
    assert(
      buildControlsCorrelationStatus({
        enabled: true,
        modelCount: 2,
        selectedModelId: "corr_1",
        selectedModelLabel: "Top matrix (corr_1)",
      }) === "Correlation model ON (Top matrix (corr_1)).",
      "controls correlation status should include selected model label",
    );
    assert(
      buildControlsShockScenarioCountText(1) === "1 scenario configured.",
      "controls shock scenario count text should singularize at one scenario",
    );
    assert(
      buildControlsShockScenarioCountText(3) === "3 scenarios configured.",
      "controls shock scenario count text should pluralize for multiple scenarios",
    );
    assert(
      buildControlsShockStatus({ enabled: false, scenarioCount: 4 }) === "Shock scenarios disabled.",
      "controls shock status should detect disabled state",
    );
    assert(
      buildControlsShockStatus({ enabled: true, scenarioCount: 0 }) === "Shock scenarios enabled (no scenario set loaded).",
      "controls shock status should detect enabled state without loaded scenarios",
    );
    assert(
      buildControlsCalibrationStatus({ briefKindLabel: "Calibration sources", hasBrief: false }) === "No calibration brief generated yet.",
      "controls calibration status should detect missing brief",
    );
    assert(
      buildControlsCalibrationStatus({ briefKindLabel: "Calibration sources", hasBrief: true }) === "Calibration sources brief generated.",
      "controls calibration status should include brief kind label when generated",
    );
    assert(
      buildControlsObservedCaptureStatus(3, 5) === "Observed metrics captured (3 new, 5 updated).",
      "controls observed capture status should format created/updated counts canonically",
    );
    assert(
      buildControlsRecommendationRefreshStatus(0) === "No active drift recommendations (rolling metrics are within tolerance).",
      "controls recommendation refresh status should expose canonical zero-active text",
    );
    assert(
      buildControlsRecommendationRefreshStatus(4) === "Drift recommendations updated (4 active).",
      "controls recommendation refresh status should expose canonical active-count text",
    );
    assert(
      buildControlsWhatIfSavedStatus(2, 1) === "Saved what-if request (2 parsed, 1 unresolved segment).",
      "controls what-if saved status should format unresolved singular counts canonically",
    );
    assert(
      buildControlsWhatIfSavedStatus(1, 0) === "Saved what-if request (1 parsed target).",
      "controls what-if saved status should format parsed-target singular counts canonically",
    );
    assert(
      buildControlsNoActiveRecommendationStatus() === "No active drift recommendation to apply.",
      "controls no-active-recommendation status should expose canonical helper text",
    );
    assert(
      buildControlsBenchmarkCountText(2) === "2 benchmark entries configured.",
      "controls benchmark-count helper should format benchmark entry count canonically",
    );
    assert(
      buildControlsMissingEvidenceCountText(1).startsWith("1 critical assumption edit(s) missing evidence."),
      "controls missing-evidence count helper should emit unresolved evidence guidance",
    );
    assert(
      buildControlsMissingNoteCountText(0) === "No critical assumption edits are missing notes.",
      "controls missing-note count helper should emit resolved note guidance",
    );
    assert(
      formatControlsPercentInputValue(0.125, 1) === "12.5",
      "controls percent-input formatter should convert unit ratios to trimmed percentage text",
    );
    assert(
      formatControlsWhatIfTarget({ op: "delta", label: "supportRatePct", delta: 1.25 }) === "supportRatePct: +1.25",
      "controls what-if target formatter should preserve signed delta formatting",
    );
    assert(
      formatControlsWhatIfTarget({ op: "set", label: "contactRatePct", value: 42 }) === "contactRatePct: 42",
      "controls what-if target formatter should preserve absolute value formatting",
    );
    const benchmarkTableRowView = buildControlsBenchmarkTableRowView({
      range: { min: 0.1, max: 0.2 },
      severityBands: { warnAbove: 0.3, hardAbove: 0.4 },
      source: { title: "Playbook" },
      benchmarkKey: "state_house_general_open",
      raceType: "state_house",
    });
    assert(
      benchmarkTableRowView.rangeText === "0.10 .. 0.20" && benchmarkTableRowView.severityText === "0.30 / 0.40",
      "controls benchmark table-row view should canonicalize range and severity text",
    );
    const auditOption = buildControlsAuditSelectOption({ id: "audit_1", ts: "2026-03-05T15:20:00.000Z", ref: "supportRatePct" });
    assert(
      auditOption.value === "audit_1" && auditOption.label === "2026-03-05 · supportRatePct",
      "controls audit-select option builder should canonicalize option value and label",
    );
    const evidenceRowView = buildControlsEvidenceRowView({
      title: "Memo",
      source: "Field report",
      capturedAt: "2026-03-06T08:30:00.000Z",
      ref: "supportRatePct",
      id: "ev_1",
    });
    assert(
      evidenceRowView.capturedAt === "2026-03-06" && evidenceRowView.id === "ev_1",
      "controls evidence-row view should canonicalize evidence table fields",
    );
    const workflowIntegrityOpen = buildControlsWorkflowIntegrityStatusView({
      workflowBaseText: "Governance controls active.",
      integrityScore: 68,
      integrityGrade: "C",
      missingEvidenceCount: 2,
      missingNoteCount: 1,
    });
    assert(
      workflowIntegrityOpen.tone === "bad" && workflowIntegrityOpen.text.includes("2 missing evidence, 1 missing note"),
      "controls workflow-integrity view should emit open-governance warning text and tone",
    );
    const workflowIntegrityHealthy = buildControlsWorkflowIntegrityStatusView({
      workflowBaseText: "Governance controls healthy.",
      integrityScore: 90,
      integrityGrade: "A",
      missingEvidenceCount: 0,
      missingNoteCount: 0,
    });
    assert(
      workflowIntegrityHealthy.tone === "ok" && workflowIntegrityHealthy.text.includes("Integrity score: 90 (A)."),
      "controls workflow-integrity view should emit healthy governance status when integrity is strong",
    );
    const correlationStatusView = buildControlsCorrelationStatusView({
      enabled: true,
      modelCount: 2,
      selectedModelId: "corr_1",
      selectedModelLabel: "Corr model 1",
    });
    assert(
      correlationStatusView.tone === "ok" && correlationStatusView.text.includes("Re-run Monte Carlo to apply."),
      "controls correlation status view should emit ready status when correlated shocks are active",
    );
    const correlationHintView = buildControlsCorrelationHintStatusView({
      enabled: false,
      modelCount: 2,
      selectedModelId: "",
      selectedModelLabel: "",
    });
    assert(
      correlationHintView.tone === "muted" && correlationHintView.text.includes("Enable Correlated shocks"),
      "controls correlation hint view should guide enabling correlated shocks when disabled",
    );
    const decayStatusView = buildControlsDecayStatusView({
      enabled: true,
      weeklyPct: "3",
      modelType: "linear",
      floorPct: "80",
    });
    assert(
      decayStatusView.tone === "ok" && decayStatusView.text.includes("floor 80% baseline"),
      "controls decay status view should include model floor details",
    );
    const shockStatusView = buildControlsShockStatusView({
      enabled: true,
      scenarioCount: 1,
    });
    assert(
      shockStatusView.tone === "ok" && shockStatusView.text.includes("Re-run Monte Carlo to apply."),
      "controls shock status view should emit rerun guidance when enabled with scenarios",
    );
    const calibrationStatusView = buildControlsCalibrationStatusView({
      briefKindLabel: "Calibration sources",
      hasBrief: true,
      createdAt: "2026-03-08T10:00:00.000Z",
    });
    assert(
      calibrationStatusView.text === "Calibration sources brief generated. Last generated 2026-03-08.",
      "controls calibration status view should append canonical brief timestamp",
    );
    assert(
      buildControlsApplyTopRecommendationButtonLabel({ priority: 2 }) === "Apply P2 recommendation",
      "controls apply-top recommendation label helper should canonicalize priority label",
    );
    const latestWhatIfRequest = {
      prompt: "Raise contact rate",
      status: "partial",
      parsed: {
        unresolvedCount: 1,
        targets: [{ op: "delta", label: "contactRatePct", delta: 1 }],
        unresolvedSegments: [{ segment: "and add more volunteers", reason: "unknown metric" }],
      },
    };
    const intelWhatIfView = {
      intelRequests: [latestWhatIfRequest],
    };
    assert(
      buildControlsWhatIfDetailedPreviewText(latestWhatIfRequest).includes("Parsed targets: 1"),
      "controls detailed what-if preview helper should summarize parsed targets",
    );
    const whatIfStatusView = buildControlsWhatIfStatusView({
      latestRequest: latestWhatIfRequest,
      intel: intelWhatIfView,
    });
    assert(
      whatIfStatusView.tone === "warn" && whatIfStatusView.text.includes("1 unresolved segment"),
      "controls what-if status view should warn when latest request is partial",
    );
    return true;
  });

  test("Rebuild contracts: turnout view helpers are canonical and deterministic", () => {
    const statusBannerFallback = buildTurnoutStatusBanner("", "", "");
    const statusBannerComputed = buildTurnoutStatusBanner("", "120", "200");
    const statusBannerSummary = buildTurnoutStatusBanner("Turnout stable.", "120", "200");

    const roiBannerFallback = buildRoiStatusBanner({ roiBannerText: "", roiRows: [] });
    const roiBannerRows = buildRoiStatusBanner({ roiBannerText: "", roiRows: [{ tactic: "doors" }] });
    const roiBannerExplicit = buildRoiStatusBanner({ roiBannerText: "Best tactic: doors", roiRows: [] });

    const assumptionsOff = deriveTurnoutAssumptionsCardStatus({ inputs: { turnoutEnabled: false } });
    const assumptionsAwaiting = deriveTurnoutAssumptionsCardStatus({ inputs: { turnoutEnabled: true, turnoutBaselinePct: "" } });
    const assumptionsActive = deriveTurnoutAssumptionsCardStatus({ inputs: { turnoutEnabled: true, turnoutBaselinePct: 55 } });

    const liftOff = deriveTurnoutLiftCardStatus({ inputs: { turnoutEnabled: false } });
    const liftAwaiting = deriveTurnoutLiftCardStatus({ inputs: { turnoutEnabled: true, gotvLiftPP: "" } });
    const liftLinear = deriveTurnoutLiftCardStatus({ inputs: { turnoutEnabled: true, gotvLiftPP: 2, gotvDiminishing: false } });
    const liftDim = deriveTurnoutLiftCardStatus({ inputs: { turnoutEnabled: true, gotvLiftPP: 2, gotvDiminishing: true } });

    const costNone = deriveTurnoutCostCardStatus({ inputs: {} });
    const costOne = deriveTurnoutCostCardStatus({ inputs: { roiDoorsEnabled: true } });
    const costThree = deriveTurnoutCostCardStatus({ inputs: { roiDoorsEnabled: true, roiPhonesEnabled: true, roiTextsEnabled: true } });

    const effAwaiting = deriveTurnoutEfficiencyCardStatus({ roiRows: [] }, "Refresh ROI");
    const effCompared = deriveTurnoutEfficiencyCardStatus({ roiRows: [{ tactic: "doors" }] }, "Best tactic feasible");
    const effCurrent = deriveTurnoutEfficiencyCardStatus({ roiRows: [{ tactic: "doors" }] }, "Current comparison");

    const impactAwaiting = deriveTurnoutImpactCardStatus(TURNOUT_STATUS_BANNER_FALLBACK, "—");
    const impactHelpful = deriveTurnoutImpactCardStatus("Turnout covers persuasion gap.", "—");
    const impactContext = deriveTurnoutImpactCardStatus("Current outlook", "62%");
    const impactCurrent = deriveTurnoutImpactCardStatus("Current outlook", "—");

    const summaryFromLongText = deriveTurnoutSummaryCardStatus("This summary text is deliberately long for truncation behavior", "", "");
    const summaryFromShortText = deriveTurnoutSummaryCardStatus("Current", "", "");
    const summaryFromValues = deriveTurnoutSummaryCardStatus("", "120", "200");
    const summaryAwaiting = deriveTurnoutSummaryCardStatus("", "", "");

    const toneOk = classifyTurnoutStatusTone("Compared");
    const toneWarn = classifyTurnoutStatusTone("Awaiting refresh");
    const toneBad = classifyTurnoutStatusTone("No tactics");
    const currencyWhole = formatTurnoutCurrency(12345, 0);
    const currencyCents = formatTurnoutCurrency(12.345, 2);
    const currencyMissing = formatTurnoutCurrency("n/a", 2);
    const phase3GapPositive = buildTurnoutPhase3CapacityGapView({
      capContacts: 550,
      requiredContacts: 480,
      formatInt: (value) => String(value),
    });
    const phase3GapNegative = buildTurnoutPhase3CapacityGapView({
      capContacts: 410,
      requiredContacts: 480,
      formatInt: (value) => String(value),
    });
    const phase3GapMissing = buildTurnoutPhase3CapacityGapView({
      capContacts: null,
      requiredContacts: 480,
      formatInt: (value) => String(value),
    });

    assert(statusBannerFallback === TURNOUT_STATUS_BANNER_FALLBACK, "turnout status banner should use canonical fallback");
    assert(statusBannerComputed === "Expected turnout votes 120 vs persuasion need 200.", "turnout status banner should include turnout/need values");
    assert(statusBannerSummary === "Turnout stable.", "turnout status banner should prefer explicit summary");

    assert(roiBannerFallback === TURNOUT_ROI_BANNER_FALLBACK, "turnout ROI banner should use canonical fallback");
    assert(roiBannerRows === "ROI comparison reflects current tactic settings.", "turnout ROI banner should detect computed rows");
    assert(roiBannerExplicit === "Best tactic: doors", "turnout ROI banner should prefer explicit banner text");

    assert(assumptionsOff === "Module off", "turnout assumptions status should detect module-off");
    assert(assumptionsAwaiting === TURNOUT_STATUS_AWAITING_SETUP, "turnout assumptions status should await setup when baseline missing");
    assert(assumptionsActive === "Active", "turnout assumptions status should detect active baseline");

    assert(liftOff === "Module off", "turnout lift status should detect module-off");
    assert(liftAwaiting === TURNOUT_STATUS_AWAITING_SETUP, "turnout lift status should await setup when lift missing");
    assert(liftLinear === "Linear", "turnout lift status should detect linear mode");
    assert(liftDim === "Diminishing on", "turnout lift status should detect diminishing mode");

    assert(costNone === "No tactics", "turnout cost status should detect no enabled tactics");
    assert(costOne === "1 tactic", "turnout cost status should detect one enabled tactic");
    assert(costThree === "3 tactics", "turnout cost status should detect three enabled tactics");

    assert(effAwaiting === "Awaiting refresh", "turnout efficiency status should await refresh without rows");
    assert(effCompared === "Compared", "turnout efficiency status should detect feasible/best comparison");
    assert(effCurrent === "Current", "turnout efficiency status should default to current with rows");

    assert(impactAwaiting === TURNOUT_STATUS_AWAITING_SETUP, "turnout impact status should await setup when banner not established");
    assert(impactHelpful === "Helpful", "turnout impact status should detect helpful/covers messaging");
    assert(impactContext === "In context", "turnout impact status should detect available win-prob context");
    assert(impactCurrent === "Current", "turnout impact status should default current without win-prob context");

    assert(summaryFromLongText === "Current", "turnout summary status should compress long summary text");
    assert(summaryFromShortText === "Current", "turnout summary status should preserve short summary text");
    assert(summaryFromValues === "Current", "turnout summary status should detect turnout/need values");
    assert(summaryAwaiting === TURNOUT_STATUS_AWAITING_SETUP, "turnout summary status should await setup when empty");
    assert(currencyWhole === "$12,345", "turnout currency formatter should produce canonical whole-dollar output");
    assert(currencyCents === "$12.35", "turnout currency formatter should honor canonical decimal precision");
    assert(currencyMissing === "—", "turnout currency formatter should return canonical missing marker for invalid input");
    assert(phase3GapPositive.capContactsText === "550", "turnout phase3 gap helper should format canonical capacity-contact text");
    assert(phase3GapPositive.gapContactsText === "+70", "turnout phase3 gap helper should emit signed surplus gap text");
    assert(phase3GapPositive.gapNoteText === "Capacity ≥ requirement (base rates).", "turnout phase3 gap helper should emit canonical surplus note");
    assert(phase3GapNegative.gapContactsText === "−70", "turnout phase3 gap helper should emit signed shortfall gap text");
    assert(phase3GapNegative.gapNoteText === "Shortfall vs requirement (base rates).", "turnout phase3 gap helper should emit canonical shortfall note");
    assert(phase3GapMissing.gapContactsText === "—", "turnout phase3 gap helper should return fallback gap text when contacts are missing");
    assert(phase3GapMissing.gapNoteText === "Enter Phase 2 rates + Phase 3 capacity to compute.", "turnout phase3 gap helper should emit setup guidance when inputs are incomplete");

    assert(toneOk === "ok", "turnout tone should map compared to ok");
    assert(toneWarn === "warn", "turnout tone should map awaiting refresh to warn");
    assert(toneBad === "bad", "turnout tone should map no tactics to bad");
    return true;
  });

  test("Rebuild contracts: ROI view helpers are canonical and deterministic", () => {
    const fixedCost = formatRoiCurrencyFixed(1.239, 2);
    const fixedMissing = formatRoiCurrencyFixed("n/a", 2);
    const wholeCost = formatRoiCurrencyWhole(1234.6, { formatInt: (value) => String(value) });
    const wholeMissing = formatRoiCurrencyWhole(undefined);
    const needVotesText = formatRoiNeedVotesText(219.8, { formatInt: (value) => String(value) });
    const needVotesFallback = formatRoiNeedVotesText("n/a");
    const contactsAtCapacity = computeRoiContactsAtCapacity(1000, 0.22);
    const contactsFallback = computeRoiContactsAtCapacity("", 0.22);
    const turnoutSummary = buildRoiTurnoutSummary({
      baselineTurnoutPct: 52.34,
      avgLiftPP: 1.56,
      gotvAddedVotes: 124.8,
      needVotesText: "320",
      formatInt: (value) => String(value),
    });
    const turnoutDisabled = buildRoiTurnoutDisabledSummary("320");
    const roiRowsTurnoutOn = buildRoiTableRowsView([
      {
        label: "Doors",
        cpa: 4.123,
        costPerNetVote: 17.8,
        costPerTurnoutAdjustedNetVote: 12.45,
        totalCost: 980.4,
        feasibilityText: "Feasible",
      },
    ], { turnoutEnabled: true, formatInt: (value) => String(value) });
    const roiRowsTurnoutOff = buildRoiTableRowsView([
      {
        label: "Doors",
        cpa: 4.123,
        costPerNetVote: 17.8,
        costPerTurnoutAdjustedNetVote: 12.45,
        totalCost: 980.4,
        feasibilityText: "Feasible",
      },
    ], { turnoutEnabled: false, formatInt: (value) => String(value) });

    assert(fixedCost === "$1.24", "ROI fixed-currency formatter should use canonical two-decimal output");
    assert(fixedMissing === "—", "ROI fixed-currency formatter should return fallback for invalid inputs");
    assert(wholeCost === "$1235", "ROI whole-currency formatter should round to canonical whole-dollar output");
    assert(wholeMissing === "—", "ROI whole-currency formatter should return fallback for missing values");
    assert(needVotesText === "220", "ROI need-votes formatter should round and format canonical text");
    assert(needVotesFallback === "—", "ROI need-votes formatter should return fallback for invalid values");
    assert(approx(contactsAtCapacity, 220, 1e-9), "ROI contact estimate should multiply capacity by contact rate canonically");
    assert(contactsFallback === 0, "ROI contact estimate should return zero when capacity or rate is missing");
    assert(
      turnoutSummary.summaryText === "Turnout enabled: baseline 52.3% · modeled avg lift 1.6pp · implied +125 votes (at capacity ceiling).",
      "ROI turnout summary helper should build canonical enabled-summary text",
    );
    assert(turnoutSummary.turnoutVotesText === "125", "ROI turnout summary helper should round implied votes canonically");
    assert(turnoutSummary.needVotesText === "320", "ROI turnout summary helper should preserve provided need-votes text");
    assert(turnoutDisabled.summaryText === "Turnout module disabled.", "ROI turnout disabled helper should expose canonical disabled summary");
    assert(turnoutDisabled.turnoutVotesText === "—", "ROI turnout disabled helper should use canonical turnout-votes fallback");
    assert(turnoutDisabled.needVotesText === "320", "ROI turnout disabled helper should preserve need-votes context");
    assert(Array.isArray(roiRowsTurnoutOn) && roiRowsTurnoutOn.length === 1, "ROI table-row view helper should preserve canonical row count");
    assert(roiRowsTurnoutOn[0]?.label === "Doors", "ROI table-row view helper should preserve channel label");
    assert(roiRowsTurnoutOn[0]?.cpaText === "$4.12", "ROI table-row view helper should format CPA canonically");
    assert(roiRowsTurnoutOn[0]?.costPerNetVoteText === "$17.80", "ROI table-row view helper should format cost-per-net-vote canonically");
    assert(roiRowsTurnoutOn[0]?.costPerTurnoutAdjustedNetVoteText === "$12.45", "ROI table-row view helper should surface turnout-adjusted cost when turnout is enabled");
    assert(roiRowsTurnoutOn[0]?.totalCostText === "$980", "ROI table-row view helper should format total cost in canonical whole-dollar text");
    assert(roiRowsTurnoutOff[0]?.costPerTurnoutAdjustedNetVoteText === "—", "ROI table-row view helper should hide turnout-adjusted cost when turnout is disabled");
    return true;
  });

  test("Rebuild contracts: district view helpers are canonical and deterministic", () => {
    const raceAwaiting = deriveDistrictRaceCardStatus({});
    const raceNeedsDate = deriveDistrictRaceCardStatus({ raceType: "State House" });
    const raceConfigured = deriveDistrictRaceCardStatus({
      raceType: "State House",
      electionDate: "2026-11-03",
      mode: "General",
    });

    const electorateAwaiting = deriveDistrictElectorateCardStatus({});
    const electorateSet = deriveDistrictElectorateCardStatus({ universe: "125000", basis: "registered" });
    const electorateSourced = deriveDistrictElectorateCardStatus({ universe: "125000", basis: "registered", sourceNote: "State file" });

    const baselineAwaiting = deriveDistrictBaselineCardStatus({});
    const baselineBallot = deriveDistrictBaselineCardStatus({ supportTotal: "99.5%" });
    const baselineBalanced = deriveDistrictBaselineCardStatus({ supportTotal: "100.0%" });
    const baselineWarning = deriveDistrictBaselineCardStatus({ warning: "Candidate totals exceed 100%" });

    const turnoutAwaiting = deriveDistrictTurnoutCardStatus({});
    const turnoutIncomplete = deriveDistrictTurnoutCardStatus({ turnoutA: "52" });
    const turnoutSet = deriveDistrictTurnoutCardStatus({ turnoutExpected: "56.4%", turnoutA: "52", turnoutB: "55" });

    const structureOff = deriveDistrictStructureCardStatus({ enabled: false });
    const structureWarn = deriveDistrictStructureCardStatus({ enabled: true, warning: "Share mismatch" });
    const structureWeighted = deriveDistrictStructureCardStatus({ enabled: true, warning: "" });
    const structureDerivedOff = buildDistrictStructureDerivedText({ enabled: false, adjusted: null });
    const structureDerivedOn = buildDistrictStructureDerivedText({
      enabled: true,
      adjusted: {
        meta: {
          persuasionMultiplier: 1.08,
          turnoutMultiplier: 1.04,
          turnoutBoostApplied: 0.012,
        },
        srAdj: 0.571,
        trAdj: 0.804,
      },
    });
    const structureInputView = buildDistrictStructureInputView({
      enabled: true,
      percents: {
        demPct: 44.44,
        repPct: 41.2,
        npaPct: 12.01,
        otherPct: null,
      },
      retentionFactor: null,
      wasNormalized: true,
      warning: "Shares normalized to 100.",
    }, {
      defaultRetentionFactor: 0.85,
    });
    const structureInputFallback = buildDistrictStructureInputView(null, {
      defaultRetentionFactor: 0.77,
    });
    const multiplierFormatted = formatDistrictMultiplier(1.236, 2, "—");
    const multiplierFallback = formatDistrictMultiplier("n/a", 2, "—");

    const summaryAwaiting = deriveDistrictSummaryCardStatus({ universe: "—", projectedVotes: "—", persuasionNeed: "—" });
    const summaryNeedPath = deriveDistrictSummaryCardStatus({ universe: "125000", projectedVotes: "50000", persuasionNeed: "2300" });
    const summaryReady = deriveDistrictSummaryCardStatus({ universe: "125000", projectedVotes: "50000", persuasionNeed: "0" });

    const censusAwaiting = deriveDistrictCensusCardStatus({});
    const censusProgress = deriveDistrictCensusCardStatus({ status: "Pulling...", geoStats: "0 rows loaded" });
    const censusReady = deriveDistrictCensusCardStatus({ status: "Ready", geoStats: "0 rows loaded" });
    const censusRows = deriveDistrictCensusCardStatus({ status: "Ready", geoStats: "12 rows loaded" });
    const censusAttention = deriveDistrictCensusCardStatus({ status: "Failed to load", geoStats: "" });

    const targetingRun = deriveDistrictTargetingCardStatus({ status: "Run targeting to score precincts.", rowCount: 0 });
    const targetingAwaiting = deriveDistrictTargetingCardStatus({ status: "Scoring queued...", rowCount: 0 });
    const targetingUnavailable = deriveDistrictTargetingCardStatus({ status: "Unavailable", rowCount: 0 });
    const targetingReady = deriveDistrictTargetingCardStatus({ status: "Ready", rowCount: 5 });

    const toneOk = classifyDistrictStatusTone("Baseline ready");
    const toneWarn = classifyDistrictStatusTone("Need path");
    const toneBad = classifyDistrictStatusTone("Attention");
    const contextHint = buildDistrictCensusContextHint({
      resolution: "tract",
      stateFips: "17",
      countyFips: "031",
    });
    const selectionSetStatus = buildDistrictSelectionSetStatus({
      selectionSets: [{ key: "A" }, { key: "B" }],
      selectedSelectionSetKey: "",
    }, { formatInt: (value) => String(value) });
    const geoStats = buildDistrictGeoStatsText({
      selectedGeoids: ["a", "b", "c"],
      loadedRowCount: 11,
    }, { formatInt: (value) => String(value) });
    const selectionSummary = buildDistrictSelectionSummaryText({
      selectedGeoids: ["17031010100", "17031010200", "17031010300"],
    });
    const raceFootprintStatus = buildDistrictRaceFootprintStatus({
      raceFootprint: { geoids: ["17031"], resolution: "tract" },
    }, { formatInt: (value) => String(value) });
    const assumptionProvenanceStatus = buildDistrictAssumptionProvenanceStatus({
      assumptionsProvenance: {
        generatedAt: "2026-03-15T00:00:00.000Z",
        acsYear: "2024",
        metricSet: "core",
      },
    });
    const footprintCapacityStatus = buildDistrictFootprintCapacityStatus({
      footprintCapacity: { population: 25250 },
    }, { formatInt: (value) => String(value) });
    const adjustmentsOn = buildDistrictApplyAdjustmentsStatus({ applyAdjustedAssumptions: true });
    const adjustmentsOff = buildDistrictApplyAdjustmentsStatus({ applyAdjustedAssumptions: false });
    const lastFetchText = buildDistrictLastFetchText("2026-03-16T10:30:00.000Z");
    const supportTotalFromState = computeDistrictSupportTotalPctFromState({
      candidates: [{ supportPct: 48.2 }, { supportPct: 45.8 }],
      undecidedPct: 6,
    });
    const supportTotalMissing = computeDistrictSupportTotalPctFromState({});
    const turnoutFallback = buildDistrictTurnoutFallbackView({
      turnoutA: 52,
      turnoutB: 56,
      bandWidth: 3,
      universeSize: 123456,
    }, {
      formatPercent: (value, digits = 1) => `${Number(value).toFixed(digits)}%`,
      formatInt: (value) => String(value),
    });

    assert(raceAwaiting === "Awaiting context", "district race status should await missing context");
    assert(raceNeedsDate === "Needs date", "district race status should detect partial context");
    assert(raceConfigured === "Configured", "district race status should detect complete context");

    assert(electorateAwaiting === "Awaiting universe", "district electorate status should await universe");
    assert(electorateSet === "Universe set", "district electorate status should detect configured universe");
    assert(electorateSourced === "Sourced", "district electorate status should detect sourced universe");

    assert(baselineAwaiting === "Awaiting ballot", "district baseline status should await ballot");
    assert(baselineBallot === "Ballot set", "district baseline status should detect non-100 ballot total");
    assert(baselineBalanced === "Balanced", "district baseline status should detect balanced ballot total");
    assert(baselineWarning === "Check totals", "district baseline status should detect candidate-total warning");

    assert(turnoutAwaiting === "Awaiting turnout", "district turnout status should await turnout cycles");
    assert(turnoutIncomplete === "Incomplete", "district turnout status should detect incomplete cycle inputs");
    assert(turnoutSet === "2 cycles set", "district turnout status should detect complete turnout setup");

    assert(structureOff === "Weighting off", "district structure status should detect weighting-off mode");
    assert(structureWarn === "Check shares", "district structure status should detect share warning");
    assert(structureWeighted === "Weighted", "district structure status should detect weighted mode");
    assert(structureDerivedOff === "Disabled (baseline behavior).", "district structure-derived helper should emit canonical disabled text");
    assert(
      structureDerivedOn === "Persuasion multiplier: 1.08 · Turnout multiplier: 1.04 · Turnout boost: 1.2% · Effective support rate: 57.1% · Effective turnout reliability: 80.4%",
      "district structure-derived helper should emit canonical weighted summary text"
    );
    assert(structureInputView.enabled === true, "district structure-input helper should preserve enabled state");
    assert(structureInputView.demPctInput === "44.4", "district structure-input helper should format Dem share to one decimal");
    assert(structureInputView.repPctInput === "41.2", "district structure-input helper should format Rep share to one decimal");
    assert(structureInputView.npaPctInput === "12.0", "district structure-input helper should format NPA share to one decimal");
    assert(structureInputView.otherPctInput === "", "district structure-input helper should return empty input for missing share values");
    assert(structureInputView.retentionFactorInput === "0.85", "district structure-input helper should fallback retention factor to defaults with two decimals");
    assert(structureInputView.warningVisible === true, "district structure-input helper should expose normalization warnings when enabled");
    assert(structureInputView.warningText === "Shares normalized to 100.", "district structure-input helper should preserve warning text");
    assert(structureInputFallback.enabled === false, "district structure-input helper should default missing config to disabled");
    assert(structureInputFallback.retentionFactorInput === "0.77", "district structure-input helper should format default retention values canonically");
    assert(multiplierFormatted === "1.24", "district multiplier formatter should round to canonical precision");
    assert(multiplierFallback === "—", "district multiplier formatter should return fallback for missing values");

    assert(summaryAwaiting === "Awaiting baseline", "district summary status should await baseline without universe");
    assert(summaryNeedPath === "Need path", "district summary status should detect positive persuasion need");
    assert(summaryReady === "Baseline ready", "district summary status should detect baseline-ready posture");

    assert(censusAwaiting === "Awaiting GEOs", "district census status should await GEO inputs");
    assert(censusProgress === "In progress", "district census status should detect in-progress GEO pull");
    assert(censusReady === "Ready", "district census status should detect ready status");
    assert(censusRows === "Rows loaded", "district census status should detect loaded rows");
    assert(censusAttention === "Attention", "district census status should detect failures");

    assert(targetingRun === "Run targeting", "district targeting status should detect run prompt");
    assert(targetingAwaiting === "Awaiting run", "district targeting status should detect waiting state");
    assert(targetingUnavailable === "Unavailable", "district targeting status should detect unavailable state");
    assert(targetingReady === "Ranks ready", "district targeting status should detect ranked results");
    assert(contextHint === "Tract context: state 17, county 031.", "district census context hint should use canonical resolution/state/county text");
    assert(selectionSetStatus === "2 saved selection set(s).", "district selection-set status should report canonical saved-set count");
    assert(geoStats === "3 selected. 11 rows loaded.", "district geo-stats text should format selected count and loaded rows");
    assert(selectionSummary === "17031010100, 17031010200 +1 more", "district selection summary should include canonical preview + overflow suffix");
    assert(raceFootprintStatus === "Race footprint set: 1 GEO(s) (Tract).", "district race-footprint status should include canonical count + resolution label");
    assert(assumptionProvenanceStatus === "Assumption provenance set (2024, core).", "district assumption provenance status should include canonical year/metric-set text");
    assert(footprintCapacityStatus === "Footprint capacity: 25250.", "district footprint capacity status should include canonical population text");
    assert(adjustmentsOn === "Census-adjusted assumptions are ON.", "district adjustments status should map ON state");
    assert(adjustmentsOff === "Census-adjusted assumptions are OFF.", "district adjustments status should map OFF state");
    assert(String(lastFetchText).startsWith("Last fetch: "), "district last-fetch text should prefix canonical timestamp copy");
    assert(approx(Number(supportTotalFromState), 100, 1e-9), "district support-total helper should sum candidate support + undecided");
    assert(supportTotalMissing == null, "district support-total helper should return null when no candidate/undecided inputs exist");
    assert(turnoutFallback.expectedText === "54.0%", "district turnout fallback should derive expected turnout from turnoutA/turnoutB midpoint");
    assert(turnoutFallback.bandText === "57.0% / 51.0%", "district turnout fallback should derive canonical best/worst turnout band from bandWidth");
    assert(turnoutFallback.votesPer1pctText === "1235", "district turnout fallback should derive votes-per-1pp from universe size");
    assert(approx(Number(turnoutFallback.expectedPct), 54, 1e-9), "district turnout fallback should expose numeric expected turnout");
    assert(approx(Number(turnoutFallback.bestPct), 57, 1e-9), "district turnout fallback should expose numeric best turnout");
    assert(approx(Number(turnoutFallback.worstPct), 51, 1e-9), "district turnout fallback should expose numeric worst turnout");
    assert(Number(turnoutFallback.votesPer1pct) === 1235, "district turnout fallback should expose numeric votes-per-1pp");

    assert(toneOk === "ok", "district tone should map baseline-ready to ok");
    assert(toneWarn === "warn", "district tone should map need-path to warn");
    assert(toneBad === "bad", "district tone should map attention to bad");
    assert(DISTRICT_STATUS_AWAITING_INPUTS === "Awaiting inputs", "district awaiting-inputs constant mismatch");
    return true;
  });

  test("Rebuild contracts: learning loop derives calibration guidance from model audit history", () => {
    const learning = computeLearningLoop({
      modelAudit: {
        sampleSize: 8,
        meanErrorMargin: -1.6,
        meanAbsErrorMargin: 2.4,
        within1ptPct: 37,
        within2ptPct: 62,
        biasDirection: "overestimate",
      },
    });
    assert(learning?.hasHistory === true, "learning loop should be active with enough history");
    assert(String(learning?.topSuggestion?.id || "") === "bias_overestimate", "expected overestimate bias suggestion");
    assert(Number.isFinite(Number(learning?.topSuggestion?.calibrationPct)), "learning calibration pct should be finite");
    assert(Array.isArray(learning?.suggestions) && learning.suggestions.length >= 2, "learning should emit multiple guidance rows");
    return true;
  });

  test("Rebuild contracts: learning loop includes voter/governance signal guidance", () => {
    const learning = computeLearningLoop({
      modelAudit: {
        sampleSize: 7,
        meanErrorMargin: 0.05,
        meanAbsErrorMargin: 1.1,
        within1ptPct: 64,
        within2ptPct: 88,
        biasDirection: "neutral",
      },
      signals: {
        voterRows: 12000,
        voterGeoCoverageRate: 0.58,
        voterContactableRate: 0.44,
        governanceDataQualityScore: 52,
        governanceConfidenceScore: 56,
        governanceExecutionScore: 49,
      },
    });
    const suggestionIds = Array.isArray(learning?.suggestions)
      ? learning.suggestions.map((row) => String(row?.id || ""))
      : [];
    assert(suggestionIds.includes("voter_geo_coverage_low"), "learning loop should emit low voter-geo coverage guidance from signals");
    assert(suggestionIds.includes("voter_contactable_low"), "learning loop should emit low voter-contactable guidance from signals");
    assert(suggestionIds.includes("governance_data_quality_low"), "learning loop should emit governance data-quality guidance from signals");
    assert(suggestionIds.includes("governance_confidence_low"), "learning loop should emit governance confidence guidance from signals");
    assert(suggestionIds.includes("governance_execution_low"), "learning loop should emit governance execution guidance from signals");
    assert(String(learning?.topSuggestion?.id || "") === "voter_geo_coverage_low", "signal guidance should become top suggestion when model-audit guidance is otherwise stable");
    assert(approx(Number(learning?.signals?.voterGeoCoverageRate), 0.58, 1e-9), "learning loop should preserve normalized signal values");
    return true;
  });

  test("Rebuild contracts: channel cost metrics derive from canonical cost assumptions", () => {
    const assumption = resolveChannelCostAssumption("doors", {
      tactic: { cpa: 0.20, crPct: 25, kind: "persuasion" },
      workforce: {
        organizerCount: 2,
        paidCanvasserCount: 4,
        activeVolunteerCount: 3,
      },
    });
    const metrics = computeChannelCostMetrics({
      channelId: "doors",
      assumption,
      netVotesPerAttempt: 0.04,
      turnoutAdjustedNetVotesPerAttempt: 0.05,
    });
    const expectedPerContact = assumption.costPerContact;
    assert(approx(metrics.costPerContact, expectedPerContact, 1e-9), "costPerContact should come from canonical assumption");
    assert(approx(metrics.costPerExpectedVote, assumption.costPerAttempt / 0.04, 1e-9), "costPerExpectedVote mismatch");
    assert(approx(metrics.costPerExpectedNetVote, assumption.costPerAttempt / 0.05, 1e-9), "costPerExpectedNetVote mismatch");
    return true;
  });

  test("Rebuild contracts: ROI row cost-per-vote fields stay aligned with canonical channel-cost metrics", () => {
    const roi = computeRoiRows({
      goalObjectiveValue: 120,
      baseRates: { cr: 0.22, sr: 0.56, tr: 0.80 },
      tactics: {
        doors: { enabled: true, cpa: 0.20, kind: "persuasion" },
      },
      turnoutModel: { enabled: true, gotvMode: "advanced", gotvLiftPP: 1.2, gotvMaxLiftPP: 8 },
      includeOverhead: false,
      overheadAmount: 0,
      workforce: { organizerCount: 2, paidCanvasserCount: 3, activeVolunteerCount: 4 },
    });
    const row = Array.isArray(roi?.rows) ? roi.rows.find((r) => String(r?.key || "") === "doors") : null;
    assert(row, "expected doors ROI row");
    assert(
      approx(Number(row?.costPerNetVote), Number(row?.costPerExpectedVote), 1e-9),
      "ROI costPerNetVote should mirror canonical costPerExpectedVote",
    );
    assert(
      approx(Number(row?.costPerTurnoutAdjustedNetVote), Number(row?.costPerExpectedNetVote), 1e-9),
      "ROI turnout-adjusted cost should mirror canonical costPerExpectedNetVote",
    );
    return true;
  });

  test("Rebuild contracts: forecast archive context builder normalizes campaign/office/scenario scope", () => {
    const ctx = buildForecastArchiveContext(
      {
        campaignId: "IL HD 21",
        campaignName: "IL HD 21 General",
        officeId: "West Field",
        ui: { activeScenarioId: "Baseline Plan" },
      },
      {
        scenarioId: "Election Night",
      },
    );
    assert(ctx.campaignId === "il-hd-21", "forecast archive context should normalize campaign id");
    assert(ctx.campaignName === "IL HD 21 General", "forecast archive context should preserve campaign name label");
    assert(ctx.officeId === "west-field", "forecast archive context should normalize office id");
    assert(ctx.scenarioId === "election-night", "forecast archive context should normalize scenario id from override");
    return true;
  });

  test("Rebuild contracts: optimization tactics include extended cost channels when enabled", () => {
    const tactics = buildOptimizationTactics({
      baseRates: { cr: 0.22, sr: 0.56, tr: 0.80 },
      tactics: {
        doors: { enabled: true, cpa: 0.20, kind: "persuasion" },
        litDrop: { enabled: true, cpa: 0.11, kind: "persuasion" },
        mail: { enabled: true, cpa: 0.65, kind: "persuasion" },
      },
      turnoutModel: { enabled: false },
      workforce: { organizerCount: 2, paidCanvasserCount: 3, activeVolunteerCount: 4 },
    });
    const byId = new Map((Array.isArray(tactics) ? tactics : []).map((row) => [String(row?.id || ""), row]));
    assert(byId.has("doors"), "doors tactic should be present");
    assert(byId.has("litDrop"), "litDrop tactic should be present");
    assert(byId.has("mail"), "mail tactic should be present");
    for (const id of ["doors", "litDrop", "mail"]){
      const row = byId.get(id);
      assert(Number.isFinite(Number(row?.costPerAttempt)), `${id} costPerAttempt missing`);
      assert(Number.isFinite(Number(row?.costPerExpectedNetVote)), `${id} costPerExpectedNetVote missing`);
    }
    return true;
  });

  test("Rebuild contracts: forecast archive keys and entries are campaign+office scoped", () => {
    const key = makeForecastArchiveKey({ campaignId: "IL HD 21", officeId: "West Field" });
    assert(/::il-hd-21::west-field$/.test(key), "forecast archive key should normalize campaign+office scope");
    const allOfficeKey = makeForecastArchiveKey({ campaignId: "IL HD 21" });
    assert(/::il-hd-21::all$/.test(allOfficeKey), "forecast archive key should use 'all' scope when office is empty");

    const mem = makeMemoryStorage();
    const context = { campaignId: "IL HD 21", officeId: "west" };
    const first = appendForecastArchiveEntry({
      snapshotHash: "hash-a",
      scenarioName: "Scenario A",
      recordedAt: "2026-03-01T00:00:00.000Z",
    }, context, mem, { maxEntries: 20 });
    assert(first.ok === true, "first archive append failed");

    const dup = appendForecastArchiveEntry({
      snapshotHash: "hash-a",
      scenarioName: "Scenario A duplicate",
      recordedAt: "2026-03-02T00:00:00.000Z",
    }, context, mem, { maxEntries: 20 });
    assert(dup.ok === true, "duplicate archive append failed");

    const second = appendForecastArchiveEntry({
      snapshotHash: "hash-b",
      scenarioName: "Scenario B",
      recordedAt: "2026-03-03T00:00:00.000Z",
    }, context, mem, { maxEntries: 20 });
    assert(second.ok === true, "second archive append failed");

    const rows = readForecastArchive(context, mem);
    assert(rows.length === 2, "archive should dedupe by snapshot hash");
    assert(rows[0]?.snapshotHash === "hash-b", "most recent archive row should be first");
    assert(rows[1]?.snapshotHash === "hash-a", "older archive row should remain");
    return true;
  });

  test("Rebuild contracts: forecast archive reads remain office-isolated (including legacy fallback)", () => {
    const mem = makeMemoryStorage();
    const legacyKey = "dsc_field_forecast_archive_v1::il-hd-21";
    mem.setItem(legacyKey, JSON.stringify([
      { snapshotHash: "legacy-west", campaignId: "il-hd-21", officeId: "west", recordedAt: "2026-03-01T00:00:00.000Z" },
      { snapshotHash: "legacy-east", campaignId: "il-hd-21", officeId: "east", recordedAt: "2026-03-02T00:00:00.000Z" },
      { snapshotHash: "legacy-all", campaignId: "il-hd-21", officeId: "", recordedAt: "2026-03-03T00:00:00.000Z" },
    ]));

    const westRows = readForecastArchive({ campaignId: "IL HD 21", officeId: "west" }, mem);
    const eastRows = readForecastArchive({ campaignId: "IL HD 21", officeId: "east" }, mem);
    const allRows = readForecastArchive({ campaignId: "IL HD 21" }, mem);

    assert(westRows.length === 1 && westRows[0]?.snapshotHash === "legacy-west", "west office should only read west-scoped archive rows");
    assert(eastRows.length === 1 && eastRows[0]?.snapshotHash === "legacy-east", "east office should only read east-scoped archive rows");
    assert(allRows.length === 3, "all-office scope should read all campaign archive rows");
    return true;
  });

  test("Rebuild contracts: all-office archive scope aggregates office-scoped campaign keys", () => {
    const mem = makeMemoryStorage();
    const campaign = { campaignId: "IL HD 21" };
    appendForecastArchiveEntry({
      snapshotHash: "west-hash",
      scenarioName: "West",
      recordedAt: "2026-03-04T00:00:00.000Z",
    }, { ...campaign, officeId: "west" }, mem, { maxEntries: 20 });
    appendForecastArchiveEntry({
      snapshotHash: "east-hash",
      scenarioName: "East",
      recordedAt: "2026-03-05T00:00:00.000Z",
    }, { ...campaign, officeId: "east" }, mem, { maxEntries: 20 });

    const rows = readForecastArchive(campaign, mem);
    const hashes = rows.map((row) => String(row?.snapshotHash || ""));
    assert(rows.length === 2, "all-office archive read should include office-scoped rows");
    assert(hashes.includes("west-hash"), "all-office archive should include west-scoped row");
    assert(hashes.includes("east-hash"), "all-office archive should include east-scoped row");
    return true;
  });

  test("Rebuild contracts: census runtime row store resolves rows by activeRowsKey", () => {
    const key = "2025|tract|17|031|core";
    clearCensusRowsForKey(key);
    setCensusRowsForKey(key, {
      "170310101001": { geoid: "170310101001", values: { B01003_001E: 1200 } },
      "170310101002": { geoid: "170310101002", values: { B01003_001E: 900 } },
    });
    const rows = getCensusRowsForState({ activeRowsKey: key });
    assert(Object.keys(rows).length === 2, "census row store should return keyed rows");
    assert(Number(rows?.["170310101001"]?.values?.B01003_001E) === 1200, "census row store should preserve row values");
    clearCensusRowsForKey(key);
    const cleared = getCensusRowsForState({ activeRowsKey: key });
    assert(Object.keys(cleared).length === 0, "census row store clear should remove keyed rows");
    return true;
  });

  test("Rebuild contracts: voter data layer keeps canonical lean-import contract", () => {
    const out = normalizeVoterRows([
      {
        VoterFileVANID: "1001",
        FirstName: "Ada",
        LastName: "Lovelace",
        PrecinctName: "P-101",
        Tract: "17031010100",
        BlockGroup: "170310101001",
        SupportScore: "72",
        TurnoutScore: "0.61",
        Attempts: "3",
        Conversations: "2",
        LastContactDate: "2026-03-10",
        Party: "DEM",
        BestPhone: "3125551001",
        UnneededAuditBlob: "{\"raw\":true}",
      },
    ], {
      adapterId: "van",
      campaignId: "il-hd-21",
      officeId: "west",
      sourceId: "van_sync_20260318",
    });

    assert(out.rows.length === 1, "voter normalize should emit one canonical row");
    assert(out.rows[0]?.voterId === "1001", "canonical voter id should resolve from VAN alias");
    assert(approx(Number(out.rows[0]?.supportScore), 0.72, 1e-9), "support score should normalize to unit value");
    assert(out.rows[0]?.campaignId === "il-hd-21" && out.rows[0]?.officeId === "west", "campaign/office scope should persist in canonical rows");
    assert(
      Number(out.manifest?.ignoredHeaderCount || 0) >= 1
      && Array.isArray(out.manifest?.ignoredHeadersSample)
      && out.manifest.ignoredHeadersSample.includes("UnneededAuditBlob"),
      "lean import should track ignored source headers for traceability",
    );
    assert(isMaterialCanonicalVoterField("supportScore") === true, "supportScore should be canonical material field");
    assert(isMaterialCanonicalVoterField("UnneededAuditBlob") === false, "unknown source fields should not enter canonical schema");
    assert(normalizeVoterAdapterId("state_csv") === "state_file", "voter adapter normalizer should map state_csv alias to state_file");
    assert(normalizeVoterAdapterId("state-file") === "state_file", "voter adapter normalizer should map dash aliases to state_file");
    assert(VOTER_LAYER_SCOPING_RULE === "import_broad_persist_narrow", "voter scoping rule drifted");
    return true;
  });

  test("Rebuild contracts: voter input parser supports json/csv/row payloads canonically", () => {
    const jsonParsed = parseVoterRowsInput(JSON.stringify([
      { voter_id: "A1", support_score: "0.51" },
      { voter_id: "A2", support_score: "0.33" },
    ]), { format: "json" });
    const csvParsed = parseVoterRowsInput("voter_id,support_score\nB1,0.44\nB2,0.21\n", { format: "csv" });
    const rowsParsed = parseVoterRowsInput([{ voter_id: "C1" }, { voter_id: "C2" }]);
    const invalidJson = parseVoterRowsInput("{bad json", { format: "json" });

    assert(jsonParsed.ok === true && jsonParsed.format === "json", "json voter parser should parse canonical json payload");
    assert(Array.isArray(jsonParsed.rows) && jsonParsed.rows.length === 2, "json voter parser row count mismatch");
    assert(csvParsed.ok === true && csvParsed.format === "csv", "csv voter parser should parse canonical csv payload");
    assert(Array.isArray(csvParsed.rows) && csvParsed.rows.length === 2, "csv voter parser row count mismatch");
    assert(rowsParsed.ok === true && rowsParsed.format === "rows", "row-array voter parser should preserve rows format");
    assert(Array.isArray(rowsParsed.rows) && rowsParsed.rows.length === 2, "row-array voter parser row count mismatch");
    assert(invalidJson.ok === false && Array.isArray(invalidJson.errors) && invalidJson.errors.length > 0, "voter parser should reject invalid json when json format is explicit");
    return true;
  });

  test("Rebuild contracts: voter data state summaries are deterministic", () => {
    const state = normalizeVoterDataState({
      manifest: { adapterId: "canonical", campaignId: "il-hd-21", officeId: "west" },
      rows: [
        { voter_id: "A", support_score: "0.55", turnout_score: "0.45", attempts: "2", conversations: "1", last_contact_date: "2026-03-17", precinct: "P1" },
        { voter_id: "B", support_score: "0.30", turnout_score: "0.65", attempts: "1", conversations: "0", last_contact_date: "2026-03-01", precinct: "P2" },
      ],
    });
    const summary = buildVoterUniverseSummary(state.rows);
    const ledger = buildVoterContactHistoryLedger(state.rows, { nowIso: "2026-03-18T00:00:00.000Z", recentWindowDays: 21 });

    assert(Array.isArray(state.rows) && state.rows.length === 2, "voterData state should normalize canonical rows");
    assert(Number(state.latestUniverseSummary?.totalVoters) === 2, "latest voter universe summary should persist canonical totals");
    assert(Number(state.latestContactLedger?.totalAttempts) === 3, "latest contact ledger should persist canonical attempts");
    assert(summary.totalVoters === 2 && summary.mappedToPrecinct === 2, "voter summary helper should remain deterministic");
    assert(ledger.totalRows === 2 && ledger.recentlyContacted === 1, "contact ledger helper should remain deterministic");
    return true;
  });

  test("Rebuild contracts: voter model signals remain deterministic and lean", () => {
    const voterData = normalizeVoterDataState({
      manifest: { adapterId: "canonical", campaignId: "il-hd-21", officeId: "west" },
      rows: [
        {
          voter_id: "A",
          precinct: "P1",
          tract_geoid: "17031010100",
          block_group_geoid: "170310101001",
          support_score: "0.55",
          turnout_score: "0.45",
          attempts: "2",
          conversations: "1",
          last_contact_date: "2026-03-17",
          last_contact_result: "Support identified",
          phone: "3125550101",
        },
        {
          voter_id: "B",
          precinct: "P2",
          tract_geoid: "17031010200",
          block_group_geoid: "",
          support_score: "0.30",
          turnout_score: "0.65",
          attempts: "0",
          conversations: "0",
          last_contact_date: "2026-02-01",
        },
      ],
    });
    const signals = deriveVoterModelSignals(voterData, {
      nowIso: "2026-03-18T00:00:00.000Z",
      recentWindowDays: 21,
    });

    assert(signals.hasRows === true && signals.totalRows === 2, "voter model signals should carry canonical row totals");
    assert(approx(signals.coverage.contactableRate, 0.5, 1e-9), "contactable rate should remain deterministic");
    assert(approx(signals.coverage.geoCoverageRate, 1, 1e-9), "geo coverage rate should prioritize deepest available linkage");
    assert(approx(signals.history.recentContactRate, 0.5, 1e-9), "recent contact rate should remain deterministic");
    assert(approx(signals.history.conversationRate, 0.5, 1e-9), "conversation rate should remain deterministic");
    assert(approx(signals.history.supportIdentifiedRate, 0.5, 1e-9), "support identified rate should remain deterministic");
    assert(approx(signals.targeting.networkValueDefault, 0.5, 1e-9), "network-value default should derive from canonical voter contact signals");
    assert(approx(signals.targeting.saturationMultiplierDefault, 0.75, 1e-9), "saturation default should derive from recent-contact pressure");
    return true;
  });

  test("Rebuild contracts: forecast archive actual updates write back by snapshot hash", () => {
    const mem = makeMemoryStorage();
    const context = { campaignId: "IL HD 21", officeId: "west" };
    const appended = appendForecastArchiveEntry({
      snapshotHash: "hash-live",
      scenarioName: "Election Night Plan",
      recordedAt: "2026-03-10T00:00:00.000Z",
      forecast: { margin: 1.8, yourVotes: 6400, winThreshold: 6200 },
    }, context, mem, { maxEntries: 20 });
    assert(appended.ok === true, "archive append should succeed before actual update");
    const updated = updateForecastArchiveActual({
      snapshotHash: "hash-live",
      actual: { margin: 0.9, yourVotes: 6320, winThreshold: 6200, winner: "Candidate A" },
      notes: "Certified county totals",
    }, context, mem);
    assert(updated.ok === true, "archive actual update should succeed");
    const rows = readForecastArchive(context, mem);
    assert(rows.length === 1, "archive entry count should remain stable after actual update");
    assert(approx(Number(rows[0]?.actual?.margin), 0.9, 1e-9), "actual margin not persisted");
    assert(rows[0]?.actual?.winner === "Candidate A", "actual winner not persisted");
    assert(approx(Number(rows[0]?.variance?.forecastMargin), 1.8, 1e-9), "variance forecastMargin not persisted");
    assert(approx(Number(rows[0]?.variance?.actualMargin), 0.9, 1e-9), "variance actualMargin not persisted");
    assert(approx(Number(rows[0]?.variance?.errorMargin), -0.9, 1e-9), "variance errorMargin not persisted");
    assert(rows[0]?.notes === "Certified county totals", "actual notes not persisted");
    return true;
  });

  test("Rebuild contracts: forecast archive summary reports actual coverage", () => {
    const summary = summarizeForecastArchive([
      {
        snapshotHash: "a",
        recordedAt: "2026-03-01T00:00:00.000Z",
        actual: { margin: 1.2 },
      },
      {
        snapshotHash: "b",
        recordedAt: "2026-03-03T00:00:00.000Z",
        actual: { winner: "Candidate B" },
      },
      {
        snapshotHash: "c",
        recordedAt: "2026-03-02T00:00:00.000Z",
        actual: null,
      },
    ]);
    assert(Number(summary?.totalEntries) === 3, "forecast archive summary totalEntries mismatch");
    assert(Number(summary?.withActualEntries) === 2, "forecast archive summary withActualEntries mismatch");
    assert(Number(summary?.withActualMarginEntries) === 1, "forecast archive summary withActualMarginEntries mismatch");
    assert(Number(summary?.pendingActualEntries) === 1, "forecast archive summary pendingActualEntries mismatch");
    assert(String(summary?.latestRecordedAt || "") === "2026-03-03T00:00:00.000Z", "forecast archive summary latestRecordedAt mismatch");
    return true;
  });

  test("Rebuild contracts: forecast archive options + selection are canonical", () => {
    const options = buildForecastArchiveOptions([
      {
        snapshotHash: "hash-2",
        recordedAt: "2026-03-12T14:15:00.000Z",
        scenarioName: "Plan B",
      },
      {
        snapshotHash: "hash-1",
        recordedAt: "2026-03-11T09:00:00.000Z",
        scenarioId: "plan-a",
      },
      {
        snapshotHash: "",
        recordedAt: "2026-03-10T08:00:00.000Z",
        scenarioName: "Missing hash",
      },
    ]);
    assert(options.length === 2, "forecast archive options should drop rows without snapshot hash");
    assert(options[0]?.value === "hash-2", "forecast archive options should preserve snapshot hash values");
    assert(options[0]?.label.includes("2026-03-12 14:15:00.000"), "forecast archive options should include canonical recorded-at text");
    assert(options[0]?.label.includes("Plan B"), "forecast archive options should include scenario label");
    assert(options[1]?.label.includes("plan-a"), "forecast archive options should fall back to scenario id");

    const lookup = new Map([["hash-2", { id: 2 }], ["hash-1", { id: 1 }]]);
    const selectedPreferred = resolveForecastArchiveSelectedHash({
      preferredHash: "hash-1",
      options,
      lookup,
    });
    const selectedFallback = resolveForecastArchiveSelectedHash({
      preferredHash: "missing",
      options,
      lookup,
    });
    const selectedEmpty = resolveForecastArchiveSelectedHash({ preferredHash: "", options: [], lookup: null });
    assert(selectedPreferred === "hash-1", "forecast archive selection resolver should preserve valid preferred hash");
    assert(selectedFallback === "hash-2", "forecast archive selection resolver should fall back to first option when preferred hash is missing");
    assert(selectedEmpty === "", "forecast archive selection resolver should return empty string when no options exist");

    const recordedAtText = formatForecastArchiveRecordedAt("2026-03-12T14:15:00.000Z");
    const recordedAtFallback = formatForecastArchiveRecordedAt(null, "—");
    assert(recordedAtText === "2026-03-12 14:15:00.000", "forecast archive recorded-at formatter should normalize timestamp text");
    assert(recordedAtFallback === "—", "forecast archive recorded-at formatter should preserve explicit fallback");
    return true;
  });

  test("Rebuild contracts: forecast archive Data projections are canonical", () => {
    const rows = buildForecastArchiveTableRows([
      {
        snapshotHash: "snap-2",
        recordedAt: "2026-03-12T00:00:00.000Z",
        scenarioName: "Plan B",
        forecast: { margin: 2.4 },
        actual: { margin: 1.9 },
        targeting: { rowCount: 120 },
        execution: { officePaths: { rowCount: 2 } },
      },
      {
        snapshotHash: "snap-1",
        recordedAt: "2026-03-11T00:00:00.000Z",
        scenarioId: "plan-a",
        forecast: { yourVotes: 6400, winThreshold: 6200 },
      },
    ], { limit: 1 });
    assert(rows.length === 1, "forecast archive table projection should honor row limit");
    assert(rows[0]?.snapshotHash === "snap-2", "forecast archive table projection should preserve row ordering");
    assert(approx(Number(rows[0]?.forecastMargin), 2.4, 1e-9), "forecast archive table projection forecast margin mismatch");
    assert(approx(Number(rows[0]?.actualMargin), 1.9, 1e-9), "forecast archive table projection actual margin mismatch");
    assert(rows[0]?.scenarioName === "Plan B", "forecast archive table projection should preserve scenario name");
    assert(Number(rows[0]?.targetingRowCount) === 120, "forecast archive table projection targeting row count mismatch");
    assert(Number(rows[0]?.officePathRowCount) === 2, "forecast archive table projection office-path row count mismatch");

    const selected = buildForecastArchiveSelectedEntryView({
      snapshotHash: "snap-view",
      recordedAt: "2026-03-13T00:00:00.000Z",
      scenarioId: "plan-c",
      forecast: {
        margin: 3.1,
        yourVotes: 6500,
        winThreshold: 6300,
        optimizationObjectiveLabel: "Expected net votes",
      },
      templateMeta: {
        appliedTemplateId: "state_house_general_open",
        appliedVersion: "2.1.0",
      },
      workforce: {
        organizerCount: 5,
        paidCanvasserCount: 18,
        activeVolunteerCount: 73,
      },
      budget: {
        includeOverhead: true,
        overheadAmount: 42000,
        optimize: { objective: "uplift" },
      },
      actual: { yourVotes: 6400, winThreshold: 6300, winner: "Candidate A" },
      targeting: {
        presetId: "balanced",
        modelId: "master",
        rowCount: 90,
        topTargetCount: 30,
        expectedNetVoteValueTotal: 25.5,
      },
      execution: {
        officePaths: {
          statusText: "Office path ranking ready.",
          rowCount: 2,
          bestByDollarOfficeId: "west",
          bestByDollarTopChannel: "doors",
          bestByDollarUpliftExpectedMarginalGain: 0.62,
          bestByDollarUpliftLowMarginalGain: 0.42,
          bestByDollarUpliftUncertaintyBand: "medium",
          bestByDollarUpliftSaturationPressure: "high",
          bestByDollarUpliftSource: "targeting_rows",
          bestByOrganizerHourOfficeId: "east",
          bestByOrganizerHourTopChannel: "phones",
          bestByOrganizerHourUpliftExpectedMarginalGain: 0.56,
          bestByOrganizerHourUpliftLowMarginalGain: 0.37,
          bestByOrganizerHourUpliftUncertaintyBand: "high",
          bestByOrganizerHourUpliftSaturationPressure: "medium",
          bestByOrganizerHourUpliftSource: "targeting_rows",
          officeIds: ["west", "east"],
          topChannels: ["doors", "phones"],
        },
        uplift: {
          source: "targeting_rows",
          bestChannel: "doors",
          expectedMarginalGain: 0.62,
          lowMarginalGain: 0.42,
          uncertaintyBand: "medium",
          saturationPressure: "high",
        },
      },
      governance: {
        realismStatus: "warn",
        realismScore: 68,
        dataQualityStatus: "ok",
        dataQualityScore: 82,
        confidenceBand: "medium",
        confidenceScore: 72.4,
        executionStatus: "warn",
        executionScore: 64,
        executionTimelineExecutablePct: 0.84,
        executionShortfallAttempts: 320,
        executionUpliftSource: "targeting_rows",
        topWarning: "Execution realism: timeline executable at 84%.",
        topSensitivityDriver: "Contact rate +2",
        learningSampleSize: 6,
        learningTopSuggestion: "Forecasts are systematically high",
        learningRecommendation: "Reduce aggressive baseline assumptions by about 2.4%.",
      },
      voter: {
        scopingRule: "import_broad_persist_narrow",
        adapterId: "van",
        sourceId: "van_sync_20260318",
        importedAt: "2026-03-10T09:00:00.000Z",
        rowCount: 25000,
        contactableVoters: 14500,
        mappedToPrecinct: 23000,
        mappedToTract: 24000,
        mappedToBlockGroup: 21000,
        geoCoverageRate: 0.74,
        contactableRate: 0.58,
      },
      notes: "Certified.",
    });
    assert(!!selected, "forecast archive selected-entry projection should be created");
    assert(selected?.scenarioName === "plan-c", "forecast archive selected-entry projection should fall back to scenarioId");
    assert(approx(Number(selected?.forecast?.margin), 3.1, 1e-9), "forecast archive selected-entry forecast margin mismatch");
    assert(approx(Number(selected?.actual?.margin), 100, 1e-9), "forecast archive selected-entry actual margin should derive from votes-threshold");
    assert(approx(Number(selected?.variance?.errorMargin), 96.9, 1e-9), "forecast archive selected-entry error margin mismatch");
    assert(selected?.actual?.winner === "Candidate A", "forecast archive selected-entry winner mismatch");
    assert(String(selected?.templateMeta?.appliedTemplateId || "") === "state_house_general_open", "forecast archive selected-entry should preserve template id");
    assert(String(selected?.templateMeta?.appliedVersion || "") === "2.1.0", "forecast archive selected-entry should preserve template version");
    assert(approx(Number(selected?.workforce?.organizerCount), 5, 1e-9), "forecast archive selected-entry should preserve organizer count");
    assert(approx(Number(selected?.workforce?.paidCanvasserCount), 18, 1e-9), "forecast archive selected-entry should preserve paid-canvasser count");
    assert(approx(Number(selected?.workforce?.activeVolunteerCount), 73, 1e-9), "forecast archive selected-entry should preserve volunteer count");
    assert(selected?.budget?.includeOverhead === true, "forecast archive selected-entry should preserve budget overhead toggle");
    assert(approx(Number(selected?.budget?.overheadAmount), 42000, 1e-9), "forecast archive selected-entry should preserve budget overhead amount");
    assert(String(selected?.budget?.objective || "") === "uplift", "forecast archive selected-entry should preserve budget objective");
    assert(String(selected?.budget?.objectiveLabel || "") === "Expected net votes", "forecast archive selected-entry should preserve budget objective label");
    assert(selected?.execution?.officePaths?.statusText === "Office path ranking ready.", "forecast archive selected-entry office-path status mismatch");
    assert(selected?.execution?.officePaths?.bestByDollarOfficeId === "west", "forecast archive selected-entry best-by-dollar office mismatch");
    assert(approx(Number(selected?.execution?.officePaths?.bestByDollarUpliftExpectedMarginalGain), 0.62, 1e-9), "forecast archive selected-entry best-by-dollar office uplift expected mismatch");
    assert(String(selected?.execution?.officePaths?.bestByDollarUpliftSource || "") === "targeting_rows", "forecast archive selected-entry best-by-dollar office uplift source mismatch");
    assert(approx(Number(selected?.execution?.officePaths?.bestByOrganizerHourUpliftExpectedMarginalGain), 0.56, 1e-9), "forecast archive selected-entry best-by-organizer-hour office uplift expected mismatch");
    assert(String(selected?.execution?.officePaths?.bestByOrganizerHourUpliftSource || "") === "targeting_rows", "forecast archive selected-entry best-by-organizer-hour office uplift source mismatch");
    assert(Array.isArray(selected?.execution?.officePaths?.officeIds) && selected.execution.officePaths.officeIds.length === 2, "forecast archive selected-entry office-id list mismatch");
    assert(String(selected?.execution?.uplift?.source || "") === "targeting_rows", "forecast archive selected-entry uplift source mismatch");
    assert(selected?.execution?.uplift?.bestChannel === "doors", "forecast archive selected-entry uplift best-channel mismatch");
    assert(approx(Number(selected?.execution?.uplift?.expectedMarginalGain), 0.62, 1e-9), "forecast archive selected-entry uplift expected mismatch");
    assert(String(selected?.execution?.uplift?.uncertaintyBand || "") === "medium", "forecast archive selected-entry uplift uncertainty mismatch");
    assert(String(selected?.execution?.uplift?.saturationPressure || "") === "high", "forecast archive selected-entry uplift saturation mismatch");
    assert(selected?.targeting?.presetId === "balanced", "forecast archive selected-entry targeting preset mismatch");
    assert(approx(Number(selected?.targeting?.expectedNetVoteValueTotal), 25.5, 1e-9), "forecast archive selected-entry targeting value mismatch");
    assert(String(selected?.governance?.confidenceBand || "") === "medium", "forecast archive selected-entry governance confidence band mismatch");
    assert(approx(Number(selected?.governance?.confidenceScore), 72.4, 1e-9), "forecast archive selected-entry governance confidence score mismatch");
    assert(String(selected?.governance?.executionStatus || "") === "warn", "forecast archive selected-entry governance execution status mismatch");
    assert(String(selected?.governance?.executionUpliftSource || "") === "targeting_rows", "forecast archive selected-entry governance execution uplift source mismatch");
    assert(String(selected?.governance?.topWarning || "").includes("timeline executable"), "forecast archive selected-entry governance warning mismatch");
    assert(String(selected?.voter?.scopingRule || "") === "import_broad_persist_narrow", "forecast archive selected-entry voter scoping-rule mismatch");
    assert(selected?.voter?.adapterId === "van", "forecast archive selected-entry voter adapter mismatch");
    assert(selected?.voter?.sourceId === "van_sync_20260318", "forecast archive selected-entry voter source mismatch");
    assert(approx(Number(selected?.voter?.rowCount), 25000, 1e-9), "forecast archive selected-entry voter row count mismatch");
    assert(approx(Number(selected?.voter?.geoCoverageRate), 0.74, 1e-9), "forecast archive selected-entry voter geo coverage mismatch");
    assert(approx(Number(selected?.voter?.contactableRate), 0.58, 1e-9), "forecast archive selected-entry voter contactable rate mismatch");
    assert(selected?.notes === "Certified.", "forecast archive selected-entry notes mismatch");
    return true;
  });

  test("Rebuild contracts: forecast archive margin summary is canonical", () => {
    const summary = buildForecastArchiveMarginSummary({
      forecast: { margin: 2.0, yourVotes: 6500, winThreshold: 6400 },
      actual: { yourVotes: 6420, winThreshold: 6400 },
    });
    assert(approx(Number(summary?.forecastMargin), 2.0, 1e-9), "margin summary forecastMargin should prefer explicit margin");
    assert(approx(Number(summary?.actualMargin), 20, 1e-9), "margin summary actualMargin should derive from votes-threshold");
    assert(approx(Number(summary?.errorMargin), 18, 1e-9), "margin summary errorMargin mismatch");
    assert(summary?.hasActualMargin === true, "margin summary hasActualMargin mismatch");
    return true;
  });

  test("Rebuild contracts: forecast archive actual normalization + margin resolution are canonical", () => {
    const normalized = normalizeForecastArchiveActual({
      margin: "2.5",
      yourVotes: "6500",
      winThreshold: "6400",
      turnoutVotes: "13000",
      voteSharePct: "51.4",
      winner: "  Candidate A  ",
      resultDate: " 2026-11-03 ",
      ignored: "drop-me",
    });
    assert(!Object.prototype.hasOwnProperty.call(normalized, "ignored"), "unexpected fields should not be copied into normalized actual payload");
    assert(approx(Number(normalized.margin), 2.5, 1e-9), "normalized actual margin mismatch");
    assert(approx(Number(normalized.yourVotes), 6500, 1e-9), "normalized actual yourVotes mismatch");
    assert(normalized.winner === "Candidate A", "normalized actual winner should be trimmed");
    assert(normalized.resultDate === "2026-11-03", "normalized actual resultDate should be trimmed");

    const explicitMargin = resolveForecastArchiveMargin({ margin: "1.2", yourVotes: 6600, winThreshold: 6500 });
    const derivedMargin = resolveForecastArchiveMargin({ yourVotes: 6600, winThreshold: 6500 });
    assert(approx(Number(explicitMargin), 1.2, 1e-9), "explicit margin should take priority");
    assert(approx(Number(derivedMargin), 100, 1e-9), "derived margin should use yourVotes - winThreshold");
    return true;
  });

  test("Rebuild contracts: forecast archive snapshot builder includes canonical context", () => {
    const entry = buildForecastArchiveEntry({
      state: {
        campaignId: "IL HD 21",
        campaignName: "IL HD 21 General",
        officeId: "west",
        scenarioName: "Primary Plan",
        templateMeta: { appliedTemplateId: "state_house_general_open" },
        raceType: "state_leg",
        persuasionPct: 30,
        earlyVoteExp: 38,
        supportRatePct: 55,
        contactRatePct: 22,
        turnoutReliabilityPct: 80,
        bandWidth: 4,
        ui: {
          activeScenarioId: "Primary Plan",
          lastSnapshotHash: "snap-123",
          lastSummary: {
            objectiveValue: 146,
            netVotes: 140,
            cost: 3200,
            upliftSummary: {
              source: "targeting_rows",
              bestChannel: "doors",
              weightedExpectedMarginalGain: 0.62,
              weightedLowMarginalGain: 0.42,
              uncertaintySpread: 0.20,
              uncertaintyBand: "medium",
              weightedSaturationUtilization: 0.81,
              saturationPressure: "high",
            },
            officePaths: {
              statusText: "Office path ranking ready.",
              bestByDollar: {
                officeId: "west",
                topChannel: "doors",
                upliftExpectedMarginalGain: 0.62,
                upliftLowMarginalGain: 0.42,
                upliftUncertaintyBand: "medium",
                upliftSaturationPressure: "high",
                upliftSource: "targeting_rows",
              },
              bestByOrganizerHour: {
                officeId: "east",
                topChannel: "phones",
                upliftExpectedMarginalGain: 0.56,
                upliftLowMarginalGain: 0.36,
                upliftUncertaintyBand: "high",
                upliftSaturationPressure: "medium",
                upliftSource: "targeting_rows",
              },
              rows: [
                {
                  officeId: "west",
                  objectiveValue: 90,
                  topChannel: "doors",
                },
                {
                  officeId: "east",
                  objectiveValue: 56,
                  topChannel: "phones",
                },
              ],
            },
          },
          lastWeeklyOps: {
            goal: 220,
            weeks: 8,
            attemptsPerWeek: 1800,
            capacityPerWeek: 1600,
            gapPerWeek: 200,
            constraint: "Capacity",
            note: "Short by 200 attempts/week.",
            banner: { text: "Gap remains." },
          },
          lastConversion: {
            goalObjectiveValue: 220,
            conversationsNeeded: 3600,
            doorsNeeded: 12000,
            shiftsPerWeek: 20,
            volunteersNeeded: 42,
            feasibility: { text: "Ambitious but plausible." },
          },
          lastTlMeta: {
            goalObjectiveValue: 160,
            maxAchievableObjectiveValue: 150,
            remainingGapObjectiveValue: 10,
          },
          lastTimeline: {
            shortfallObjectiveValue: 24,
          },
          twCapOutlookLatest: {
            workforce: { organizerCount: 2, paidCanvasserCount: 4, activeVolunteerCount: 6 },
          },
        },
        targeting: {
          presetId: "hybrid_model",
          modelId: "house_v1",
          topN: 40,
          lastRun: "2026-03-16T12:00:00.000Z",
          lastMeta: { contextKey: "ctx-1" },
          lastRows: [
            { geoid: "170310101001", label: "A", isTopTarget: true, score: 82.5, expectedNetVoteValue: 18.4 },
            { geoid: "170310101002", label: "B", isTopTarget: false, score: 71.25, expectedNetVoteValue: 10.1 },
          ],
        },
        budget: {
          includeOverhead: true,
          overheadAmount: 300,
          tactics: { doors: { cpa: 0.2, kind: "persuasion" } },
          optimize: { objective: "net" },
        },
        voterData: {
          manifest: {
            adapterId: "van",
            sourceId: "van_sync_20260318",
            importedAt: "2026-03-10T09:00:00.000Z",
            mappedCanonicalFields: ["voterId", "precinctId", "supportScore"],
            ignoredHeaderCount: 12,
          },
          latestUniverseSummary: {
            totalVoters: 25000,
            contactableVoters: 14500,
            mappedToPrecinct: 23000,
            mappedToTract: 24000,
            mappedToBlockGroup: 21000,
          },
          latestContactLedger: {
            totalRows: 25000,
            recentlyContacted: 5000,
            totalAttempts: 12000,
            totalConversations: 3600,
            supportIdentifiedCount: 2200,
          },
          rows: [],
        },
        mcLast: {
          winProb: 0.58,
          confidenceEnvelope: { percentiles: { p10: -90, p50: 35, p90: 170 } },
        },
      },
      renderCtx: {
        weeks: 18,
        res: {
          turnout: { expectedPct: 56 },
          expected: {
            turnoutVotes: 12500,
            winThreshold: 6200,
            yourVotes: 6400,
            persuasionNeed: 120,
          },
        },
      },
      snapshot: { snapshotHash: "snap-123" },
    });
    assert(!!entry, "forecast archive entry should be created");
    assert(entry?.campaignId === "il-hd-21", "campaign id should be normalized");
    assert(entry?.scenarioId === "primary-plan", "scenario id should be normalized");
    assert(entry?.snapshotHash === "snap-123", "snapshot hash missing");
    assert(approx(Number(entry?.forecast?.weeksRemaining), 18, 1e-9), "forecast weeksRemaining should be preserved in archive entry");
    assert(approx(Number(entry?.forecast?.winProb), 0.58, 1e-9), "forecast winProb should be preserved in archive entry");
    assert(String(entry?.forecast?.optimizationObjective || "") === "net", "forecast optimization objective should be preserved");
    assert(approx(Number(entry?.forecast?.objectiveValue), 146, 1e-9), "forecast objectiveValue should be preserved");
    assert(approx(Number(entry?.forecast?.maxAchievableObjectiveValue), 150, 1e-9), "forecast max achievable objective should be preserved");
    assert(approx(Number(entry?.forecast?.shortfallObjectiveValue), 24, 1e-9), "forecast shortfall objective should be preserved");
    assert(entry?.variance?.actualMargin == null, "variance actualMargin should be null before actuals are recorded");
    assert(approx(Number(entry?.execution?.weeklyOps?.gapPerWeek), 200, 1e-9), "execution weeklyOps gap should be preserved");
    assert(approx(Number(entry?.execution?.conversion?.conversationsNeeded), 3600, 1e-9), "execution conversion conversations should be preserved");
    assert(approx(Number(entry?.execution?.timeline?.shortfallObjectiveValue), 24, 1e-9), "execution timeline shortfall should be preserved");
    assert(Number(entry?.execution?.officePaths?.rowCount) === 2, "execution office-path snapshot should include row count");
    assert(String(entry?.execution?.uplift?.source || "") === "targeting_rows", "execution uplift snapshot should preserve source provenance");
    assert(String(entry?.execution?.uplift?.bestChannel || "") === "doors", "execution uplift snapshot should preserve best channel");
    assert(approx(Number(entry?.execution?.uplift?.expectedMarginalGain), 0.62, 1e-9), "execution uplift snapshot should preserve expected marginal gain");
    assert(approx(Number(entry?.execution?.uplift?.lowMarginalGain), 0.42, 1e-9), "execution uplift snapshot should preserve low marginal gain");
    assert(String(entry?.execution?.uplift?.uncertaintyBand || "") === "medium", "execution uplift snapshot should preserve uncertainty band");
    assert(String(entry?.execution?.uplift?.saturationPressure || "") === "high", "execution uplift snapshot should preserve saturation pressure");
    assert(String(entry?.execution?.officePaths?.bestByDollarOfficeId || "") === "west", "execution office-path snapshot should preserve best-by-dollar office");
    assert(approx(Number(entry?.execution?.officePaths?.bestByDollarUpliftExpectedMarginalGain), 0.62, 1e-9), "execution office-path snapshot should preserve best-by-dollar uplift expected");
    assert(String(entry?.execution?.officePaths?.bestByDollarUpliftSource || "") === "targeting_rows", "execution office-path snapshot should preserve best-by-dollar uplift source");
    assert(String(entry?.execution?.officePaths?.bestByOrganizerHourOfficeId || "") === "east", "execution office-path snapshot should preserve best-by-organizer-hour office");
    assert(approx(Number(entry?.execution?.officePaths?.bestByOrganizerHourUpliftExpectedMarginalGain), 0.56, 1e-9), "execution office-path snapshot should preserve best-by-organizer-hour uplift expected");
    assert(String(entry?.execution?.officePaths?.bestByOrganizerHourUpliftSource || "") === "targeting_rows", "execution office-path snapshot should preserve best-by-organizer-hour uplift source");
    assert(approx(Number(entry?.execution?.officePaths?.objectiveValueTotal), 146, 1e-9), "execution office-path snapshot should aggregate objective values");
    assert(Number(entry?.targeting?.rowCount) === 2, "targeting archive snapshot should include row count");
    assert(Number(entry?.targeting?.topTargetCount) === 1, "targeting archive snapshot should include top-target count");
    assert(Array.isArray(entry?.targeting?.topGeoids) && entry.targeting.topGeoids[0] === "170310101001", "targeting archive snapshot should preserve top geoid list");
    assert(approx(Number(entry?.targeting?.expectedNetVoteValueTotal), 28.5, 1e-9), "targeting archive snapshot should aggregate expected net vote value");
    assert(approx(Number(entry?.targeting?.topExpectedNetVoteValueTotal), 18.4, 1e-9), "targeting archive snapshot should aggregate top expected net vote value");
    assert(String(entry?.voter?.scopingRule || "") === "import_broad_persist_narrow", "voter snapshot should preserve canonical scoping rule");
    assert(String(entry?.voter?.adapterId || "") === "van", "voter snapshot should preserve adapter id");
    assert(String(entry?.voter?.sourceId || "") === "van_sync_20260318", "voter snapshot should preserve source id");
    assert(approx(Number(entry?.voter?.rowCount), 25000, 1e-9), "voter snapshot should preserve canonical row count");
    assert(approx(Number(entry?.voter?.geoCoverageRate), 0.96, 1e-9), "voter snapshot should derive canonical geo coverage rate");
    assert(approx(Number(entry?.voter?.contactableRate), 0.58, 1e-9), "voter snapshot should derive canonical contactable rate");
    assert(approx(Number(entry?.voter?.recentContactRate), 0.2, 1e-9), "voter snapshot should derive canonical recent-contact rate");
    assert(approx(Number(entry?.voter?.conversationRate), 0.3, 1e-9), "voter snapshot should derive canonical conversation rate");
    assert(approx(Number(entry?.voter?.supportIdentifiedRate), 0.088, 1e-9), "voter snapshot should derive canonical support-identified rate");
    return true;
  });

  test("Rebuild contracts: model audit summary derives from forecast archive actuals", () => {
    const summary = summarizeModelAuditFromArchive([
      {
        snapshotHash: "a",
        forecast: { margin: 2.0 },
        actual: { margin: 1.0 },
      },
      {
        snapshotHash: "b",
        forecast: { margin: -1.0 },
        actual: { margin: -2.2 },
      },
      {
        snapshotHash: "c",
        forecast: { margin: 0.5 },
        actual: null,
      },
    ]);
    assert(Number(summary?.sampleSize) === 2, "model audit should include only rows with actual outcomes");
    assert(approx(Number(summary?.meanErrorMargin), -1.1, 1e-9), "mean error margin mismatch");
    assert(approx(Number(summary?.meanAbsErrorMargin), 1.1, 1e-9), "mean abs error margin mismatch");
    assert(approx(Number(summary?.within1ptPct), 50, 1e-9), "within1pt summary mismatch");
    assert(approx(Number(summary?.within2ptPct), 100, 1e-9), "within2pt summary mismatch");
    assert(String(summary?.biasDirection) === "overestimate", "bias direction mismatch");
    return true;
  });

  test("Rebuild contracts: model audit learning bundle is canonical", () => {
    const bundle = buildModelLearningFromArchive([
      {
        snapshotHash: "a",
        forecast: { margin: 2.0 },
        actual: { margin: 1.0 },
      },
      {
        snapshotHash: "b",
        forecast: { margin: -1.0 },
        actual: { margin: -2.2 },
      },
      {
        snapshotHash: "c",
        forecast: { margin: 0.5 },
        actual: null,
      },
    ]);
    assert(!!bundle && typeof bundle === "object", "model-learning bundle should return an object");
    assert(Number(bundle?.modelAudit?.sampleSize) === 2, "model-learning bundle should include canonical model-audit sample size");
    assert(String(bundle?.modelAudit?.biasDirection || "") === "overestimate", "model-learning bundle should preserve model-audit bias direction");
    assert(String(bundle?.learning?.version || "") === "1.0.0", "model-learning bundle should include canonical learning-loop version");
    assert(Number(bundle?.learning?.sampleSize) === 2, "model-learning bundle should preserve sample size in learning summary");
    assert(String(bundle?.learning?.topSuggestion?.id || "") === "insufficient_history", "model-learning bundle should derive learning suggestions from canonical model-audit summary");
    assert(bundle?.signals?.voterRows == null, "model-learning bundle should keep voterRows null when archive rows have no voter snapshot");
    assert(bundle?.signals?.voterGeoCoverageRate == null, "model-learning bundle should keep voter geo coverage null when unavailable");
    return true;
  });

  test("Rebuild contracts: archive learning signals derive weighted voter/governance context", () => {
    const signals = buildArchiveLearningSignals([
      {
        voter: { rowCount: 1000, geoCoverageRate: 0.5, contactableRate: 0.4 },
        governance: { confidenceScore: 40, dataQualityScore: 52, executionScore: 48 },
      },
      {
        voter: { rowCount: 3000, geoCoverageRate: 0.9, contactableRate: 0.7 },
        governance: { confidenceScore: 80, dataQualityScore: 76, executionScore: 70 },
      },
    ]);
    assert(approx(Number(signals?.voterRows), 3000, 1e-9), "archive learning signals should use max voter row count");
    assert(approx(Number(signals?.voterGeoCoverageRate), 0.8, 1e-9), "archive learning signals should compute weighted voter geo coverage");
    assert(approx(Number(signals?.voterContactableRate), 0.625, 1e-9), "archive learning signals should compute weighted voter contactable rate");
    assert(approx(Number(signals?.governanceConfidenceScore), 70, 1e-9), "archive learning signals should compute weighted governance confidence");
    assert(approx(Number(signals?.governanceDataQualityScore), 70, 1e-9), "archive learning signals should compute weighted governance data quality");
    assert(approx(Number(signals?.governanceExecutionScore), 64.5, 1e-9), "archive learning signals should compute weighted governance execution");
    return true;
  });

  test("Rebuild contracts: operations context key/scoped options are deterministic", () => {
    const resolved = resolveOperationsContext({
      campaignId: "IL HD 21",
      campaignName: "IL HD 21 General",
      officeId: "West Field",
    });
    const contextKey = makeOperationsContextKey(resolved);
    const scoped = toOperationsStoreOptions(resolved);
    const summary = summarizeOperationsContext(resolved);
    assert(contextKey === "il-hd-21::west-field", "operations context key should normalize campaign/office ids");
    assert(scoped.campaignId === "il-hd-21", "scoped campaign id mismatch");
    assert(scoped.officeId === "west-field", "scoped office id mismatch");
    assert(/Campaign/.test(summary) && /Office/.test(summary), "context summary should include campaign and office labels");
    return true;
  });

  test("Rebuild contracts: operations office field resolution honors locked team-entry scope", () => {
    const lockedCtx = resolveOperationsContext({
      search: "?campaign=il-hd-21&office=west",
      fallback: { officeId: "east" },
    });
    const unlockedCtx = resolveOperationsContext({
      search: "?campaign=il-hd-21",
      fallback: { officeId: "" },
    });
    assert(shouldLockOperationsOfficeField(lockedCtx) === true, "office field should lock when office URL param is present");
    assert(
      resolveOperationsOfficeField(lockedCtx, "east", "hq") === "west",
      "locked office context should override explicit/fallback office labels",
    );
    assert(shouldLockOperationsOfficeField(unlockedCtx) === false, "office field should stay editable without locked office URL");
    assert(
      resolveOperationsOfficeField(unlockedCtx, "north", "hq") === "north",
      "editable office context should preserve explicit office value",
    );
    assert(
      resolveOperationsOfficeField(unlockedCtx, "", "hq") === "hq",
      "editable office context should use fallback when explicit office is blank",
    );
    return true;
  });

  test("Rebuild contracts: campaign context manager emits canonical scope keys and storage paths", () => {
    const context = {
      campaignId: "IL HD 21",
      officeId: "West Field",
      scenarioId: "Baseline Plan",
    };
    const key = makeCampaignContextScopeKey(context, { includeScenario: true });
    assert(key === "il-hd-21::west-field::baseline-plan", "campaign context key should normalize campaign/office/scenario");
    const statePath = makeCampaignStoragePath(context, {
      module: "state",
      key: "snapshot-v1",
      includeScenario: true,
    });
    assert(
      statePath === "fpe/il-hd-21/west-field/state/scenario/baseline-plan/snapshot-v1",
      "campaign storage path should follow canonical fpe/{campaign}/{office}/{module}/{key} pattern",
    );
    const validation = validateCampaignContext(context, { requireOffice: true, requireScenario: true });
    assert(validation.ok === true, "context with campaign+office+scenario should validate");
    return true;
  });

  test("Rebuild contracts: intelligence resolver supports module/glossary/message/search modes", () => {
    const context = {
      campaignId: "il-hd-21",
      campaignName: "IL HD 21",
      officeId: "west",
      scenarioId: "baseline",
      stageId: "district",
    };

    const modulePayload = resolveIntelligencePayload({
      mode: "module",
      moduleId: "targetingLab",
      context,
    });
    assert(modulePayload.mode === "module", "module payload mode mismatch");
    assert(modulePayload.title === "Targeting Lab", "module payload title mismatch");
    assert(Array.isArray(modulePayload.sections) && modulePayload.sections.length > 0, "module payload should include doctrine sections");

    const glossaryPayload = resolveIntelligencePayload({
      mode: "glossary",
      termId: "variance",
      context,
    });
    assert(glossaryPayload.mode === "glossary", "glossary payload mode mismatch");
    assert(glossaryPayload.title === "Variance", "glossary payload title mismatch");

    const glossaryAliasPayload = resolveIntelligencePayload({
      mode: "glossary",
      termId: "contact probability",
      context,
    });
    assert(glossaryAliasPayload.title === "Contact Probability", "glossary alias resolution should map canonical term labels");

    const messagePayload = resolveIntelligencePayload({
      mode: "message",
      messageId: "contextMissing",
      context,
    });
    assert(messagePayload.mode === "message", "message payload mode mismatch");
    assert(/Context Missing/i.test(String(messagePayload.title || "")), "message payload title mismatch");

    const messageAliasPayload = resolveIntelligencePayload({
      mode: "message",
      messageId: "strict import",
      context,
    });
    assert(/Strict Import/i.test(String(messageAliasPayload.title || "")), "message alias resolution should map canonical message labels");

    const searchPayload = resolveIntelligencePayload({
      mode: "search",
      query: "variance",
      context,
    });
    assert(searchPayload.mode === "search", "search payload mode mismatch");
    assert(Array.isArray(searchPayload.results) && searchPayload.results.length > 0, "search mode should return at least one match for variance");
    return true;
  });

  test("Rebuild contracts: glossary/message registries normalize aliases deterministically", () => {
    assert(
      normalizeGlossaryTermId("contact probability") === "contactProbability",
      "glossary alias should normalize to canonical id",
    );
    const lowProp = getGlossaryTerm("low-propensity voters");
    assert(lowProp?.id === "lowPropensityVoters", "glossary hyphenated alias should resolve canonical term");
    assert(normalizeMessageId("Undecided Mode: User Defined") === "undecidedModeUserDefined", "message title alias should normalize canonical id");
    const overrideRamp = getMessageDefinition("override ramp");
    assert(overrideRamp?.id === "capacityOverrideRamp", "message alias should resolve canonical option message");
    return true;
  });

  test("Rebuild contracts: intelligence interaction maps cover dropdown and warning explanation hooks", () => {
    const undecidedMap = INTEL_SELECT_OPTION_MESSAGE_MAP.v3DistrictUndecidedMode || {};
    const turnoutMap = INTEL_SELECT_OPTION_MESSAGE_MAP.v3TurnoutMode || {};
    const reachCapMap = INTEL_SELECT_OPTION_MESSAGE_MAP.v3ReachCapOverrideMode || {};
    assert(undecidedMap.user_defined === "undecidedModeUserDefined", "undecided dropdown map should route user-defined option");
    assert(turnoutMap.advanced === "gotvModeAdvanced", "turnout mode dropdown map should route advanced option");
    assert(reachCapMap.scheduled === "capacityOverrideScheduled", "reach capacity dropdown map should route scheduled option");
    assert(
      INTEL_WARNING_MESSAGE_BY_ID.v3DataWarnBannerUi === "strictImportEnabled",
      "data warning banner should map to strict import explanation message",
    );
    assert(
      INTEL_WARNING_MESSAGE_BY_ID.v3DistrictCandWarn === "ballotBaselineConflict",
      "district ballot warning should map to canonical warning explanation message",
    );
    return true;
  });

  test("Rebuild contracts: engine state persistence keys are office-scoped with compatibility fallback", () => {
    const westContext = { campaignId: "IL HD 21", officeId: "west", scenarioId: "baseline" };
    const eastContext = { campaignId: "IL HD 21", officeId: "east", scenarioId: "baseline" };
    const mem = makeMemoryStorage();

    const write = persistStateSnapshot({
      campaignId: "il-hd-21",
      campaignName: "IL HD 21",
      officeId: "west",
      scenarioId: "baseline",
      ui: {},
    }, mem, westContext);
    assert(write?.ok === true, "state persistence should succeed for scoped context");
    assert(
      /^fpe\/il-hd-21\/west\/state\/scenario\/baseline\/snapshot-v1$/.test(makeStateStorageKey(westContext)),
      "state storage key should include campaign+office+scenario scope",
    );

    const westLoaded = loadState({ storageOverride: mem, ...westContext });
    const eastLoaded = loadState({ storageOverride: mem, ...eastContext });
    assert(westLoaded?.officeId === "west", "west scope should read west-scoped state");
    assert(eastLoaded == null, "east scope should not read west-scoped state");

    const memCompat = makeMemoryStorage();
    memCompat.setItem("dsc_field_engine_state_v1::il-hd-21::baseline", JSON.stringify({
      campaignId: "il-hd-21",
      officeId: "west",
      scenarioId: "baseline",
      legacyCompat: true,
    }));
    const compatWest = loadState({ storageOverride: memCompat, ...westContext });
    const compatEast = loadState({ storageOverride: memCompat, ...eastContext });
    assert(compatWest?.legacyCompat === true, "compat key should be readable for matching office scope");
    assert(compatEast == null, "compat key should remain office-isolated");
    return true;
  });

  test("Rebuild contracts: backup persistence is office-scoped with all-office aggregate reads", () => {
    const mem = makeMemoryStorage();
    const westContext = { campaignId: "IL HD 21", officeId: "west" };
    const eastContext = { campaignId: "IL HD 21", officeId: "east" };
    const allContext = { campaignId: "IL HD 21" };

    appendBackupEntry({
      ts: "2026-03-01T00:00:00.000Z",
      scenarioName: "West backup",
      payload: { scenarioState: { campaignId: "il-hd-21", officeId: "west" } },
    }, mem, westContext);
    appendBackupEntry({
      ts: "2026-03-02T00:00:00.000Z",
      scenarioName: "East backup",
      payload: { scenarioState: { campaignId: "il-hd-21", officeId: "east" } },
    }, mem, eastContext);

    assert(
      /^fpe\/il-hd-21\/west\/state\/backups-v1$/.test(makeBackupStorageKey(westContext)),
      "backup key should include office scope",
    );
    const westRows = readBackups(mem, westContext);
    const eastRows = readBackups(mem, eastContext);
    const allRows = readBackups(mem, allContext);
    assert(westRows.length === 1, "west backup scope should isolate west entries");
    assert(eastRows.length === 1, "east backup scope should isolate east entries");
    assert(allRows.length === 2, "all-office backup scope should aggregate office-scoped backups");
    return true;
  });

  test("Rebuild contracts: operations context helpers resolve directly from app-state shape", () => {
    const stateLike = {
      campaignId: "IL-HD-21",
      campaignName: "IL HD 21 General",
      officeId: "West Field",
      ui: {
        activeScenarioId: "Primary Plan",
      },
    };
    const resolved = resolveOperationsContextFromState(stateLike);
    const scoped = toOperationsStoreOptionsFromState(stateLike);
    assert(resolved.campaignId === "il-hd-21", "state-context resolver should normalize campaign id");
    assert(resolved.officeId === "west-field", "state-context resolver should normalize office id");
    assert(resolved.scenarioId === "primary-plan", "state-context resolver should normalize ui.activeScenarioId");
    assert(scoped.campaignId === "il-hd-21", "state-scope helper should preserve normalized campaign id");
    assert(scoped.officeId === "west-field", "state-scope helper should preserve normalized office id");
    assert(scoped.scenarioId === "primary-plan", "state-scope helper should preserve normalized scenario id");
    return true;
  });

  test("Rebuild contracts: operations time helpers are deterministic and canonical", () => {
    const parsedIso = operationsParseIsoDateInput("2026-03-10");
    const parsedFallback = operationsParseDate("2026-03-11T12:30:00.000Z");
    const added = operationsAddDaysUTC(new Date("2026-03-10T00:00:00.000Z"), 5);
    const weekStart = operationsStartOfWeekUTC(new Date("2026-03-18T09:30:00.000Z"));
    const transitionKey = operationsTransitionKey("Phone Screen", "Offer Accepted");
    const combinedIso = operationsCombineDateAndTimeIso("2026-03-10", "09:45");
    const localTime = operationsLocalTimeFromIso(combinedIso);
    const clamped = operationsClampNumber("120", 0, 100);
    const finiteBlank = operationsFiniteNumber("");
    const finiteFallback = operationsFiniteNumber("bad", 7);
    const shiftHours = operationsShiftHours({
      checkInAt: "2026-03-10T15:00:00.000Z",
      checkOutAt: "2026-03-10T20:30:00.000Z",
    });
    const daysWhole = operationsDaysSince("2026-03-10T00:00:00.000Z", { nowMs: Date.parse("2026-03-17T00:00:00.000Z"), floor: true });
    const daysFractional = operationsDaysSince("2026-03-10T12:00:00.000Z", { nowMs: Date.parse("2026-03-17T00:00:00.000Z"), floor: false });

    assert(parsedIso instanceof Date && operationsToIsoDateUTC(parsedIso) === "2026-03-10", "operations ISO date parser should produce canonical UTC date");
    assert(parsedFallback instanceof Date && operationsToIsoDateUTC(parsedFallback) === "2026-03-11", "operations generic date parser should parse ISO timestamps");
    assert(operationsToIsoDateUTC(added) === "2026-03-15", "operations add-days helper should compute canonical date offsets");
    assert(operationsToIsoDateUTC(weekStart) === "2026-03-16", "operations week-start helper should snap to Monday in UTC");
    assert(String(transitionKey) === "phone_screen_to_offer_accepted", "operations transition key helper should normalize stage names canonically");
    assert(typeof combinedIso === "string" && combinedIso.startsWith("2026-03-10T"), "operations combine-date-time helper should build canonical ISO timestamps");
    assert(localTime === "09:45", "operations local-time helper should round-trip canonical local time inputs");
    assert(Number(clamped) === 100, "operations clamp helper should enforce upper bounds with numeric coercion");
    assert(Number(finiteBlank) === 0, "operations finite-number helper should preserve Number('') semantics");
    assert(Number(finiteFallback) === 7, "operations finite-number helper should apply fallback for invalid values");
    assert(approx(Number(shiftHours), 5.5, 1e-9), "operations shift-hours helper should compute elapsed check-in/check-out time");
    assert(Number(daysWhole) === 7, "operations days-since helper should support integer day windows");
    assert(approx(Number(daysFractional), 6.5, 1e-9), "operations days-since helper should support fractional day windows");
    assert(operationsDaysSince("invalid", { nowMs: Date.parse("2026-03-17T00:00:00.000Z") }) == null, "operations days-since helper should return null for invalid dates");
    return true;
  });

  test("Rebuild contracts: operations view formatters are canonical and deterministic", () => {
    const whole = formatOperationsWhole(1234.6, { fallback: "0" });
    const wholeFallback = formatOperationsWhole("bad", { fallback: "0" });
    const decimal = formatOperationsOneDecimal(12.345, { digits: 1, fallback: "0.0" });
    const decimalFallback = formatOperationsOneDecimal("bad", { digits: 1, fallback: "0.0" });
    const fixed = formatOperationsFixed(12.3456, { digits: 2, fallback: "0.00" });
    const fixedFallback = formatOperationsFixed("bad", { digits: 2, fallback: "0.00" });
    const percentInput = formatOperationsPercentInputValue(0.1234, { digits: 2, fallback: "0.00" });
    const percentInputFallback = formatOperationsPercentInputValue("bad", { digits: 2, fallback: "0.00" });
    const pct = formatOperationsPercentFromUnit(0.1234, { digits: 1, fallback: "—" });
    const pctFallback = formatOperationsPercentFromUnit("bad", { digits: 1, fallback: "—" });
    const dt = formatOperationsDateTime("2026-03-10T12:45:00.000Z", { fallback: "—" });
    const dtFallback = formatOperationsDateTime("bad", { fallback: "—" });

    assert(whole === "1,235", "operations whole formatter should round and comma-format canonically");
    assert(wholeFallback === "0", "operations whole formatter should return configured fallback for invalid values");
    assert(decimal === "12.3", "operations decimal formatter should round to configured precision");
    assert(decimalFallback === "0.0", "operations decimal formatter should return configured fallback for invalid values");
    assert(fixed === "12.35", "operations fixed formatter should round to configured precision");
    assert(fixedFallback === "0.00", "operations fixed formatter should return configured fallback for invalid values");
    assert(percentInput === "12.34", "operations percent-input formatter should convert unit ratios without suffix");
    assert(percentInputFallback === "0.00", "operations percent-input formatter should return configured fallback for invalid values");
    assert(pct === "12.3%", "operations percent formatter should convert unit fractions to canonical percent text");
    assert(pctFallback === "—", "operations percent formatter should return configured fallback for invalid values");
    assert(dt !== "—", "operations datetime formatter should parse valid timestamps");
    assert(dtFallback === "—", "operations datetime formatter should return configured fallback for invalid values");
    return true;
  });

  test("Rebuild contracts: core number format helpers remain canonical", () => {
    const whole = formatWholeNumber(1234.6, "0");
    const wholeFallback = formatWholeNumber("bad", "0");
    const fixed = formatFixedNumber(12.3456, 2, "0.00");
    const fixedFallback = formatFixedNumber("bad", 2, "0.00");
    const wholeCeil = formatWholeNumberByMode(12.1, { mode: "ceil", fallback: "0" });
    const wholeFloor = formatWholeNumberByMode(12.9, { mode: "floor", fallback: "0" });
    const roundedWhole = roundWholeNumberByMode(12.6, { mode: "round", fallback: null });
    const ceiledWhole = roundWholeNumberByMode(12.1, { mode: "ceil", fallback: null });
    const rounded = roundToDigits(12.3456, 2, null);
    const roundedFallback = roundToDigits("bad", 2, -1);
    assert(whole === "1,235", "core whole-number formatter should round and comma-format canonically");
    assert(wholeFallback === "0", "core whole-number formatter should honor fallback for invalid values");
    assert(fixed === "12.35", "core fixed-number formatter should round to configured precision");
    assert(fixedFallback === "0.00", "core fixed-number formatter should honor fallback for invalid values");
    assert(wholeCeil === "13", "core whole-number-by-mode formatter should support ceil mode");
    assert(wholeFloor === "12", "core whole-number-by-mode formatter should support floor mode");
    assert(Number(roundedWhole) === 13, "core round-whole helper should support round mode");
    assert(Number(ceiledWhole) === 13, "core round-whole helper should support ceil mode");
    assert(approx(Number(rounded), 12.35, 1e-9), "core round-to-digits helper should round numerics deterministically");
    assert(Number(roundedFallback) === -1, "core round-to-digits helper should honor fallback for invalid values");
    return true;
  });

  test("Rebuild contracts: assumptions view helpers produce canonical formatting outputs", () => {
    const oneDecimal = formatAssumptionsOneDecimal(12.34);
    const pctText = formatAssumptionsPercent(51.26);
    const bandText = formatAssumptionsBand({ low: 12.2, mid: 15.8, high: 18.4 });
    const applyReason = buildAssumptionsApplyModeReasonLabel("selection_mismatch");
    const applyText = buildAssumptionsApplyModeText({
      applyGate: { reason: "ready" },
      applyMultipliers: {
        doorsPerHour: 1.1,
        contactRate: 0.97,
        persuasion: 1.03,
        turnoutLift: 1.04,
        organizerLoad: 0.9,
      },
    });
    const feasibilityBad = buildAssumptionsFeasibilityText({ ready: true, severity: "bad" });
    const signalCoverage = buildAssumptionsSignalCoverageText({
      ready: true,
      coverage: { availableSignals: 4, totalSignals: 6 },
    });
    const turnoutCycles = buildAssumptionsTurnoutCyclesText(48.6, 52.1);
    const bandWidth = buildAssumptionsBandWidthText(3.2);
    const weeksText = buildAssumptionsWeeksText(12);
    const weeksFallback = buildAssumptionsWeeksText("n/a");
    assert(oneDecimal === "12.3", "assumptions one-decimal formatter should round values canonically");
    assert(pctText === "51.3%", "assumptions percent formatter should append one-decimal percent text");
    assert(bandText === "12.2 / 15.8 / 18.4", "assumptions band formatter should produce canonical triplet text");
    assert(applyReason === "Blocked (selection mismatch)", "assumptions apply-mode reason helper should map selection mismatch code");
    assert(applyText.includes("ON (1.10x DPH"), "assumptions apply-mode helper should include canonical multiplier formatting when available");
    assert(feasibilityBad === "Above plausible range", "assumptions feasibility helper should map bad severity to canonical text");
    assert(signalCoverage === "4/6", "assumptions signal coverage helper should emit available/total count text");
    assert(turnoutCycles === "48.6% & 52.1%", "assumptions turnout-cycles helper should format dual percent values canonically");
    assert(bandWidth === "±3.2%", "assumptions band-width helper should render canonical plus/minus percent text");
    assert(weeksText === "12", "assumptions weeks-text helper should preserve numeric week strings canonically");
    assert(weeksFallback === "—", "assumptions weeks-text helper should return fallback marker for invalid weeks");
    return true;
  });

  test("Rebuild contracts: active context resolves locked URL campaign/office links deterministically", () => {
    const ctx = resolveActiveContext({
      search: "?campaign=IL-HD-21&office=West&scenario=Plan-A",
      fallback: {
        campaignId: "fallback-campaign",
        officeId: "fallback-office",
        scenarioId: "fallback-scenario",
      },
    });
    assert(ctx.campaignId === "il-hd-21", "active context should normalize campaign id from URL");
    assert(ctx.officeId === "west", "active context should normalize office id from URL");
    assert(ctx.scenarioId === "plan-a", "active context should normalize scenario id from URL");
    assert(ctx.isCampaignLocked === true, "campaign should be marked locked when URL campaign param exists");
    assert(ctx.isOfficeLocked === true, "office should be marked locked when URL office param exists");
    assert(ctx.isScenarioLocked === true, "scenario should be marked locked when URL scenario param exists");
    assert(ctx.campaignSource === "url", "campaign source should be URL when campaign param exists");
    assert(ctx.officeSource === "url", "office source should be URL when office param exists");
    assert(ctx.scenarioSource === "url", "scenario source should be URL when scenario param exists");

    const state = applyContextToState({ campaignId: "", campaignName: "", officeId: "", ui: {} }, ctx);
    assert(state?.campaignId === "il-hd-21", "applyContextToState should persist normalized campaign id");
    assert(state?.officeId === "west", "applyContextToState should persist normalized office id");
    assert(state?.scenarioId === "plan-a", "applyContextToState should persist normalized scenario id");
    assert(state?.ui?.activeScenarioId === "plan-a", "applyContextToState should persist active scenario id into ui scope");
    return true;
  });

  test("Rebuild contracts: active context link scoping preserves campaign/office params", () => {
    if (typeof document === "undefined") return true;
    const host = document.createElement("div");
    host.innerHTML = [
      '<a id="ctxScopedA" href="operations.html">Operations</a>',
      '<a id="ctxScopedB" href="organizer.html?campaign=already-set">Organizer</a>',
    ].join("");
    document.body.appendChild(host);
    try{
      applyActiveContextToLinks(
        {
          campaignId: "il-hd-21",
          campaignName: "IL HD 21 General",
          officeId: "west",
          scenarioId: "plan-a",
        },
        "#ctxScopedA, #ctxScopedB",
        { includeScenario: true },
      );
      const hrefA = String(host.querySelector("#ctxScopedA")?.getAttribute("href") || "");
      const hrefB = String(host.querySelector("#ctxScopedB")?.getAttribute("href") || "");
      const urlA = new URL(hrefA, "https://example.test/");
      const urlB = new URL(hrefB, "https://example.test/");
      assert(urlA.searchParams.get("campaign") === "il-hd-21", "context link scoper should include campaign param");
      assert(urlA.searchParams.get("office") === "west", "context link scoper should include office param");
      assert(urlA.searchParams.get("scenario") === "plan-a", "context link scoper should include scenario param when enabled");
      assert(urlB.searchParams.get("campaign") === "already-set", "context link scoper should preserve explicit campaign params");
      assert(urlB.searchParams.get("office") === "west", "context link scoper should append office to links missing office");
    } finally {
      host.remove();
    }
    return true;
  });

  test("Rebuild contracts: workforce office mix comes from canonical operations rollups", () => {
    const rollups = computeOperationalRollups({
      persons: [
        { id: "p1", officeId: "west", roleType: "field_organizer", compensationType: "paid", active: true },
        { id: "p2", officeId: "west", roleType: "canvasser", compensationType: "paid", active: true },
        { id: "p3", officeId: "west", roleType: "volunteer", compensationType: "volunteer", active: true },
        { id: "p4", officeId: "east", roleType: "canvasser", compensationType: "stipend", active: true },
        { id: "p5", officeId: "east", roleType: "volunteer_lead", compensationType: "volunteer", active: false },
      ],
      shiftRecords: [],
      turfEvents: [],
      options: {},
    });

    const workforce = rollups?.workforce || {};
    const officeMix = Array.isArray(rollups?.officeMix) ? rollups.officeMix : [];
    const west = officeMix.find((row) => row.officeId === "west");
    const east = officeMix.find((row) => row.officeId === "east");

    assert(Number(workforce.organizerCount || 0) === 1, "organizer count should be role-aware");
    assert(Number(workforce.paidCanvasserCount || 0) === 2, "paid canvasser count should include paid + stipend canvassers");
    assert(Number(workforce.activeVolunteerCount || 0) === 1, "active volunteer count should be role-aware");
    assert(Number(workforce.activePaidHeadcount || 0) === 2, "active paid headcount should be tracked");
    assert(Number(workforce.activeStipendHeadcount || 0) === 1, "active stipend headcount should be tracked");
    assert(Number(workforce.activeVolunteerHeadcount || 0) === 1, "active volunteer compensation headcount should be tracked");

    assert(!!west, "west office mix missing");
    assert(!!east, "east office mix missing");
    assert(Number(west?.organizerCount || 0) === 1, "west organizer count mismatch");
    assert(Number(west?.paidCanvasserCount || 0) === 1, "west paid canvasser count mismatch");
    assert(Number(west?.activeVolunteerCount || 0) === 1, "west active volunteer count mismatch");
    assert(Number(east?.paidCanvasserCount || 0) === 1, "east stipend canvasser should count as paid canvasser");
    assert(Number(east?.volunteerLeadCount || 0) === 0, "inactive volunteer lead should not count in active volunteer lead totals");
    return true;
  });

  test("Rebuild contracts: uplift planner ranks channels by gain-per-dollar", () => {
    const features = buildUpliftFeatures({
      rawSignals: {
        densityBand: { multiplier: 1.05 },
        multiUnitShare: 0.22,
        longCommuteShare: 0.16,
      },
      state: { bandWidth: 4 },
      canonicalFeatures: {
        adjustedPersuasion: 0.58,
        turnoutOpportunity: 0.52,
        contactProbability: 0.46,
        geographicMultiplier: 1.05,
      },
    });
    const plan = computeUpliftPlan({
      features,
      state: {
        budget: {
          tactics: {
            doors: { cpa: 0.38 },
            phones: { cpa: 0.14 },
            texts: { cpa: 0.03 },
            litDrop: { cpa: 0.11 },
            mail: { cpa: 0.92 },
          },
        },
        ui: {
          twCapOutlookLatest: {
            workforce: { organizerCount: 2, paidCanvasserCount: 3, activeVolunteerCount: 2 },
          },
        },
      },
    });
    assert(Array.isArray(plan?.channels) && plan.channels.length === 5, "uplift plan should include 5 channels");
    assert(plan.channels.some((row) => row.channelId === "litDrop"), "uplift plan should include litDrop channel");
    for (let i = 1; i < plan.channels.length; i++){
      assert(plan.channels[i - 1].gainPerDollar >= plan.channels[i].gainPerDollar, "uplift channels should be sorted by gain-per-dollar");
    }
    assert(plan.bestChannel === plan.channels[0].channelId, "bestChannel should match first ranked channel");
    assert(Number.isFinite(Number(plan.expectedMarginalGain)), "expectedMarginalGain should be finite");
    return true;
  });

  test("Rebuild contracts: optimization uplift base-rate fallback consumes canonical voter signals", () => {
    const normalizedRows = normalizeVoterRows(
      [
        {
          voter_id: "A",
          phone: "3125550100",
          precinct: "P-1",
          last_contact_date: "2026-03-17",
          attempts: "1",
          conversations: "1",
        },
        {
          voter_id: "B",
          phone: "",
          precinct: "",
          last_contact_date: "",
          attempts: "0",
          conversations: "0",
        },
      ],
      { adapterId: "state_csv", campaignId: "il-hd-21", officeId: "west", sourceId: "test-voter-uplift" },
    ).rows;

    const voterData = {
      rows: normalizedRows,
      latestUniverseSummary: buildVoterUniverseSummary(normalizedRows),
      latestContactLedger: buildVoterContactHistoryLedger(normalizedRows, { nowIso: "2026-03-18T00:00:00.000Z" }),
    };

    const plan = computeOptimizationUpliftPlan({
      state: {
        bandWidth: 4,
        voterData,
        targeting: { lastRows: [] },
      },
      baseRates: { cr: 0.30, sr: 0.55, tr: 0.70 },
    });

    assert(plan?.source === "base_rates", "uplift fallback source should stay base-rates when targeting rows are absent");
    assert(approx(Number(plan?.features?.contactProbability), 0.225, 1e-9), "uplift contact probability should apply canonical voter multipliers");
    assert(approx(Number(plan?.features?.geographyAccess), 1, 1e-9), "uplift geography access should reflect canonical voter geo coverage");
    return true;
  });

  test("Rebuild contracts: optimization tactics consume canonical uplift plan", () => {
    const state = {
      bandWidth: 4,
      supportRatePct: 56,
      contactRatePct: 24,
      turnoutReliabilityPct: 80,
      budget: {
        tactics: {
          doors: { enabled: true, cpa: 0.32, kind: "persuasion" },
          phones: { enabled: true, cpa: 0.12, kind: "persuasion" },
          texts: { enabled: true, cpa: 0.04, kind: "turnout" },
          litDrop: { enabled: false, cpa: 0.10, kind: "turnout" },
          mail: { enabled: false, cpa: 0.80, kind: "persuasion" },
        },
      },
      targeting: {
        topN: 2,
        lastRows: [
          {
            rank: 1,
            score: 71,
            memberCount: 2,
            componentScores: {
              adjustedPersuasion: 0.59,
              turnoutOpportunity: 0.52,
              contactProbability: 0.47,
              geographicMultiplier: 1.05,
            },
            rawSignals: {
              densityBand: { multiplier: 1.04 },
              multiUnitShare: 0.25,
              longCommuteShare: 0.16,
            },
          },
          {
            rank: 2,
            score: 66,
            memberCount: 1,
            componentScores: {
              adjustedPersuasion: 0.55,
              turnoutOpportunity: 0.49,
              contactProbability: 0.43,
              geographicMultiplier: 1.01,
            },
            rawSignals: {
              densityBand: { multiplier: 0.98 },
              multiUnitShare: 0.18,
              longCommuteShare: 0.21,
            },
          },
        ],
      },
      ui: {
        twCapOutlookLatest: {
          workforce: { organizerCount: 2, paidCanvasserCount: 3, activeVolunteerCount: 4 },
        },
      },
    };
    const baseRates = { cr: 0.24, sr: 0.56, tr: 0.80 };
    const upliftPlan = computeOptimizationUpliftPlan({ state, baseRates });
    const tactics = buildOptimizationTactics({
      baseRates,
      tactics: state.budget.tactics,
      state,
      workforce: state.ui.twCapOutlookLatest.workforce,
    });
    const byId = new Map((Array.isArray(tactics) ? tactics : []).map((row) => [String(row?.id || ""), row]));
    const doors = byId.get("doors");
    const phones = byId.get("phones");
    const texts = byId.get("texts");
    assert(!!doors && !!phones && !!texts, "expected enabled optimization tactics");
    const upliftByChannel = new Map((Array.isArray(upliftPlan?.channels) ? upliftPlan.channels : []).map((row) => [String(row?.channelId || ""), row]));

    for (const id of ["doors", "phones", "texts"]){
      const tactic = byId.get(id);
      const upliftRow = upliftByChannel.get(id);
      assert(!!tactic, `${id} tactic missing`);
      assert(!!upliftRow, `${id} uplift row missing`);
      assert(approx(Number(tactic?.production?.effects?.uplift?.expectedMarginalGain), Number(upliftRow?.expectedMarginalGain), 1e-9), `${id} uplift expected gain mismatch`);
      const low = Number(tactic?.production?.effects?.uplift?.lowMarginalGain);
      const expected = Number(tactic?.production?.effects?.uplift?.expectedMarginalGain);
      assert(Number.isFinite(low) && Number.isFinite(expected), `${id} uplift low/expected should be finite`);
      assert(low <= expected + 1e-9, `${id} uplift low gain should not exceed expected gain`);
      const expectedAdjusted = Number(tactic?.netVotesPerAttempt || 0) * Number(upliftRow?.expectedMarginalGain || 0);
      assert(approx(Number(tactic?.upliftAdjustedNetVotesPerAttempt), expectedAdjusted, 1e-9), `${id} uplift-adjusted net mismatch`);
      const expectedRobust = Number(tactic?.netVotesPerAttempt || 0) * low;
      assert(approx(Number(tactic?.upliftRiskAdjustedNetVotesPerAttempt), expectedRobust, 1e-9), `${id} uplift robust net mismatch`);
    }
    return true;
  });

  test("Rebuild contracts: optimization execution summary is canonical for objective, uplift, and saturation", () => {
    const tactics = [
      {
        id: "doors",
        label: "Doors",
        costPerAttempt: 1.5,
        netVotesPerAttempt: 0.10,
        turnoutAdjustedNetVotesPerAttempt: 0.10,
        upliftAdjustedNetVotesPerAttempt: 0.05,
        used: { cr: 0.4 },
        production: {
          effects: {
            turnout: { saturationCapAttempts: 150 },
            uplift: {
              expectedMarginalGain: 0.50,
              lowMarginalGain: 0.30,
              gainPerDollar: 0.33,
              source: "targeting_rows",
              uncertaintyBand: "high",
              saturationPressure: "medium",
              bestChannel: true,
            },
          },
        },
      },
      {
        id: "phones",
        label: "Phones",
        costPerAttempt: 1.0,
        netVotesPerAttempt: 0.12,
        turnoutAdjustedNetVotesPerAttempt: 0.12,
        upliftAdjustedNetVotesPerAttempt: 0.07,
        used: { cr: 0.5 },
        production: {
          effects: {
            turnout: { saturationCapAttempts: 100 },
            uplift: {
              expectedMarginalGain: 0.80,
              lowMarginalGain: 0.60,
              gainPerDollar: 0.70,
              source: "targeting_rows",
              uncertaintyBand: "high",
              saturationPressure: "medium",
              bestChannel: false,
            },
          },
        },
      },
    ];
    const allocation = { doors: 120, phones: 80 };
    const summary = buildOptimizationExecutionSummary({
      tactics,
      allocation,
      totals: { attempts: 200, cost: 260, netVotes: 11.6 },
      objective: "uplift",
      needObjectiveValue: 20,
      includeOverhead: true,
      overheadAmount: 40,
    });

    assert(Array.isArray(summary?.rows) && summary.rows.length === 2, "expected two summary rows");
    assert(approx(Number(summary?.totals?.attempts), 200, 1e-9), "summary attempts mismatch");
    assert(approx(Number(summary?.totals?.cost), 300, 1e-9), "summary cost should include overhead");
    assert(approx(Number(summary?.totals?.objectiveValue), 11.6, 1e-9), "summary objective total mismatch");
    assert(approx(Number(summary?.totals?.gapObjectiveValue), 8.4, 1e-9), "summary objective gap mismatch");

    const doors = summary.rows.find((row) => row.id === "doors");
    const phones = summary.rows.find((row) => row.id === "phones");
    assert(!!doors && !!phones, "expected doors and phones summary rows");
    assert(approx(Number(doors?.expectedObjectiveValue), 6.0, 1e-9), "doors expected objective mismatch");
    assert(approx(Number(phones?.expectedObjectiveValue), 5.6, 1e-9), "phones expected objective mismatch");
    assert(approx(Number(doors?.expectedContacts), 48, 1e-9), "doors expected contacts mismatch");
    assert(approx(Number(phones?.expectedContacts), 40, 1e-9), "phones expected contacts mismatch");
    assert(String(doors?.upliftSource || "") === "targeting_rows", "execution summary row should preserve uplift source");
    assert(String(doors?.upliftUncertaintyBand || "") === "high", "execution summary row should preserve uplift uncertainty band");
    assert(String(doors?.upliftSaturationPressure || "") === "medium", "execution summary row should preserve uplift saturation pressure");

    assert(approx(Number(summary?.uplift?.weightedExpectedMarginalGain), 0.62, 1e-9), "weighted expected uplift mismatch");
    assert(approx(Number(summary?.uplift?.weightedLowMarginalGain), 0.42, 1e-9), "weighted low uplift mismatch");
    assert(approx(Number(summary?.uplift?.uncertaintySpread), 0.20, 1e-9), "uplift uncertainty spread mismatch");
    assert(approx(Number(summary?.uplift?.weightedSaturationUtilization), 0.8, 1e-9), "weighted saturation mismatch");
    assert(summary?.uplift?.uncertaintyBand === "high", "uncertainty band should be high");
    assert(summary?.uplift?.saturationPressure === "medium", "saturation pressure should be medium");
    assert(summary?.uplift?.source === "targeting_rows", "summary uplift should preserve weighted source provenance");
    assert(summary?.uplift?.bestChannel === "doors", "best channel should use canonical uplift best-channel flag");
    return true;
  });

  test("Rebuild contracts: optimization uplift signals are derived from canonical summary fields", () => {
    const normalized = deriveOptimizationUpliftSignals({
      weightedExpectedMarginalGain: 0.62,
      weightedLowMarginalGain: 0.42,
      uncertaintyBand: "HIGH",
      saturationPressure: "medium",
      bestChannel: "doors",
      source: "targeting_rows",
    });
    assert(approx(Number(normalized?.expectedMarginalGain), 0.62, 1e-9), "normalized expected uplift mismatch");
    assert(approx(Number(normalized?.lowMarginalGain), 0.42, 1e-9), "normalized low uplift mismatch");
    assert(normalized?.hasRange === true, "normalized uplift should mark range when low + expected are present");
    assert(normalized?.hasUncertainty === true, "normalized uplift should mark uncertainty when band exists");
    assert(normalized?.uncertaintyBand === "high", "uncertainty band should normalize to lowercase");
    assert(normalized?.hasSaturation === true, "normalized uplift should mark non-unknown saturation pressure");
    assert(normalized?.saturationPressure === "medium", "saturation pressure should normalize to lowercase");
    assert(normalized?.bestChannel === "doors", "bestChannel should preserve canonical channel id");
    assert(normalized?.source === "targeting_rows", "source should preserve canonical uplift source");
    assert(normalized?.hasSource === true, "source flag should be true when source is present");
    return true;
  });

  test("Rebuild contracts: uplift source normalization + labeling + governance signals are canonical", () => {
    const normalizedTargeting = normalizeUpliftSource("targeting_rows");
    const normalizedBaseRates = normalizeUpliftSource(" BASE_RATES ");
    const normalizedTargetingLabel = normalizeUpliftSource("Targeting rows");
    const normalizedBaseRatesLabel = normalizeUpliftSource("base-rate fallback");
    const normalizedUnknown = normalizeUpliftSource("custom_source");

    assert(normalizedTargeting === UPLIFT_SOURCE_TARGETING_ROWS, "uplift source normalizer should preserve canonical targeting_rows id");
    assert(normalizedBaseRates === UPLIFT_SOURCE_BASE_RATES, "uplift source normalizer should canonicalize base_rates id");
    assert(normalizedTargetingLabel === UPLIFT_SOURCE_TARGETING_ROWS, "uplift source normalizer should treat targeting label aliases canonically");
    assert(normalizedBaseRatesLabel === UPLIFT_SOURCE_BASE_RATES, "uplift source normalizer should treat base-rate label aliases canonically");
    assert(normalizedUnknown === UPLIFT_SOURCE_UNKNOWN, "uplift source normalizer should map unknown ids to canonical unknown");

    assert(formatUpliftSourceLabel("targeting_rows") === "Targeting rows", "uplift source label formatter should map targeting_rows canonically");
    assert(formatUpliftSourceLabel("base_rates") === "Base-rate fallback", "uplift source label formatter should map base_rates canonically");
    assert(formatUpliftSourceLabel("Targeting rows") === "Targeting rows", "uplift source label formatter should preserve targeting label aliases");
    assert(formatUpliftSourceLabel("base-rate fallback") === "Base-rate fallback", "uplift source label formatter should preserve base-rate label aliases");
    assert(formatUpliftSourceLabel("unknown", { unknownLabel: "—" }) === "—", "uplift source label formatter should honor canonical unknown fallback");

    const targetingSignal = deriveUpliftSourceGovernanceSignal("targeting_rows");
    const baseRateSignal = deriveUpliftSourceGovernanceSignal("base_rates");
    const unknownSignal = deriveUpliftSourceGovernanceSignal("");

    assert(targetingSignal.penalty === 0 && targetingSignal.issue === "", "uplift governance signal should treat targeting_rows as canonical no-penalty source");
    assert(baseRateSignal.penalty === 10 && baseRateSignal.issue.includes("base-rate fallback"), "uplift governance signal should flag base-rate fallback");
    assert(unknownSignal.penalty === 6 && unknownSignal.issue.includes("unavailable"), "uplift governance signal should flag missing source");
    return true;
  });

  test("Rebuild contracts: optimization uplift summary text comes from canonical formatter", () => {
    const summaryText = buildOptimizationUpliftSummaryText({
      weightedExpectedMarginalGain: 0.62,
      weightedLowMarginalGain: 0.42,
      uncertaintyBand: "high",
      saturationPressure: "medium",
      bestChannel: "doors",
      source: "targeting_rows",
    }, {
      formatPercent: (value) => `${Math.round(Number(value) * 100)}%`,
      rangeJoiner: " to ",
      saturationPrefix: "saturation pressure",
    });
    assert(
      summaryText === "Uplift range 42% to 62%; best channel doors; source targeting rows; uncertainty high; saturation pressure medium",
      "canonical uplift summary text should preserve deterministic ordering and phrasing",
    );
    return true;
  });

  test("Rebuild contracts: optimization execution view text is canonical", () => {
    const gapClosed = buildOptimizationGapContext(0, { formatInt: (value) => String(value) });
    const gapOpen = buildOptimizationGapContext(84.4, { formatInt: (value) => String(value) });
    const gapUnknown = buildOptimizationGapContext(null, { formatInt: (value) => String(value) });
    const topLabels = buildOptimizationTopAllocationLabels([
      { tactic: "Doors", attempts: 120.2 },
      { id: "phones", attempts: 80.7 },
      { attempts: 12 },
    ], {
      formatInt: (value) => String(value),
    });
    const executionView = buildOptimizationExecutionView({
      executionSummary: {
        totals: { gapObjectiveValue: 84.4 },
        topAllocations: [
          { tactic: "Doors", attempts: 120.2 },
          { tactic: "Phones", attempts: 80.7 },
        ],
        uplift: {
          weightedExpectedMarginalGain: 0.62,
          weightedLowMarginalGain: 0.42,
          uncertaintyBand: "high",
          saturationPressure: "medium",
          bestChannel: "doors",
          source: "targeting_rows",
        },
      },
      mode: "capacity",
      objectiveLabel: "Expected net votes",
      formatInt: (value) => String(value),
      formatPercent: (value) => `${Math.round(Number(value) * 100)}%`,
    });
    const summarySnapshot = buildOptimizationLastSummarySnapshot({
      objective: "uplift",
      executionSummary: {
        totals: { objectiveValue: 11.6, cost: 300 },
        uplift: {
          weightedExpectedMarginalGain: 0.62,
          weightedLowMarginalGain: 0.42,
        },
      },
      executionView,
      binding: "budget",
      feasible: true,
      primaryBottleneck: "timeline",
      officePaths: { rows: [{ officeId: "west" }] },
      roundWhole: (value) => Math.round(Number(value)),
    });

    assert(gapClosed === "Modeled allocation closes current gap.", "optimization gap-context should recognize fully closed gaps");
    assert(gapOpen === "84 gap remains under current allocation.", "optimization gap-context should format positive remaining gap");
    assert(gapUnknown === "Gap context unavailable.", "optimization gap-context should expose canonical fallback");
    assert(topLabels.length === 2, "optimization top-allocation labels should skip rows without tactic labels");
    assert(topLabels[0] === "Doors: 120 attempts", "optimization top-allocation labels should format tactic + attempts deterministically");
    assert(topLabels[1] === "phones: 81 attempts", "optimization top-allocation labels should fall back to id and rounded attempts");
    assert(executionView.modeLabel === "Capacity-constrained", "optimization execution view should derive canonical mode label");
    assert(executionView.gapContext === "84 gap remains under current allocation.", "optimization execution view should reuse canonical gap context");
    assert(
      executionView.upliftSummaryText === "Uplift range 42%-62%; best channel doors; source targeting rows; uncertainty high; saturation medium",
      "optimization execution view should preserve canonical uplift summary wording",
    );
    assert(
      executionView.banner === "Capacity-constrained allocation using Expected net votes. Uplift range 42%-62%; best channel doors; source targeting rows; uncertainty high; saturation medium",
      "optimization execution view banner should preserve canonical wording and ordering",
    );
    assert(Array.isArray(executionView.topAllocations) && executionView.topAllocations[0] === "Doors: 120 attempts", "optimization execution view should preserve canonical top allocation labels");
    assert(summarySnapshot.objective === "uplift", "optimization last-summary snapshot should preserve objective");
    assert(summarySnapshot.objectiveValue === 12, "optimization last-summary snapshot should round objective value canonically");
    assert(summarySnapshot.netVotes === 12, "optimization last-summary snapshot should alias netVotes to rounded objective value");
    assert(summarySnapshot.cost === 300, "optimization last-summary snapshot should preserve rounded cost");
    assert(summarySnapshot.binding === "budget", "optimization last-summary snapshot should preserve binding");
    assert(summarySnapshot.gapContext === "84 gap remains under current allocation.", "optimization last-summary snapshot should preserve canonical gap context");
    assert(summarySnapshot.banner.includes("Capacity-constrained allocation"), "optimization last-summary snapshot should preserve canonical banner");
    assert(summarySnapshot.feasible === true, "optimization last-summary snapshot should preserve feasible flag");
    assert(summarySnapshot.primaryBottleneck === "timeline", "optimization last-summary snapshot should preserve primary bottleneck");
    assert(Array.isArray(summarySnapshot.topAllocations) && summarySnapshot.topAllocations.length === 2, "optimization last-summary snapshot should preserve top allocation labels");
    assert(summarySnapshot.upliftSummary && typeof summarySnapshot.upliftSummary === "object", "optimization last-summary snapshot should preserve uplift summary payload");
    assert(summarySnapshot.officePaths && typeof summarySnapshot.officePaths === "object", "optimization last-summary snapshot should preserve office path payload");
    return true;
  });

  test("Rebuild contracts: optimization budget/capacity resolvers are canonical", () => {
    const withOverhead = resolveOptimizationBudgetAvailable({
      budgetAmount: 1000,
      includeOverhead: true,
      overheadAmount: 250,
    });
    const clamped = resolveOptimizationBudgetAvailable({
      budgetAmount: 120,
      includeOverhead: true,
      overheadAmount: 240,
    });
    const explicitCapacity = resolveOptimizationCapacityLimit({
      capacityAttempts: "240",
      fallbackCapacity: 100,
    });
    const fallbackCapacity = resolveOptimizationCapacityLimit({
      capacityAttempts: null,
      fallbackCapacity: 100,
    });
    const missingCapacity = resolveOptimizationCapacityLimit({
      capacityAttempts: -1,
      fallbackCapacity: null,
    });
    assert(approx(withOverhead, 750, 1e-9), "optimization budget resolver should subtract fixed overhead once");
    assert(approx(clamped, 0, 1e-9), "optimization budget resolver should clamp to zero");
    assert(approx(Number(explicitCapacity), 240, 1e-9), "optimization capacity resolver should prefer explicit non-negative capacity");
    assert(approx(Number(fallbackCapacity), 100, 1e-9), "optimization capacity resolver should fall back when explicit value is missing");
    assert(missingCapacity == null, "optimization capacity resolver should return null when no valid capacity exists");
    return true;
  });

  test("Rebuild contracts: timeline constrained optimization input builder centralizes limits", () => {
    const budgetInput = buildTimelineConstrainedOptimizationInput({
      mode: "budget",
      budgetAmount: 1000,
      includeOverhead: true,
      overheadAmount: 250,
      capacityAttempts: 400,
      capacityCeiling: 600,
      tactics: [{ id: "doors" }],
      step: 24.8,
      useDecay: true,
      objective: "uplift",
      maxAttemptsByTactic: { doors: 180 },
      tlObjectiveMode: "min_cost_goal",
      goalObjectiveValue: 150,
    });
    const capacityInput = buildTimelineConstrainedOptimizationInput({
      mode: "capacity",
      budgetAmount: 1000,
      includeOverhead: true,
      overheadAmount: 250,
      capacityAttempts: null,
      capacityCeiling: 600,
      tactics: [{ id: "phones" }],
      step: 0.2,
      useDecay: false,
      objective: "turnout",
      maxAttemptsByTactic: { phones: 120 },
      tlObjectiveMode: "max_net",
      goalObjectiveValue: 80,
    });
    assert(budgetInput.mode === "budget", "timeline constrained helper should normalize budget mode");
    assert(approx(Number(budgetInput.budgetLimit), 750, 1e-9), "timeline constrained helper should use canonical budget resolver");
    assert(budgetInput.capacityLimit == null, "budget mode should not set capacityLimit");
    assert(approx(Number(budgetInput.capacityCeiling), 600, 1e-9), "budget mode should preserve capacity ceiling");
    assert(budgetInput.step === 24, "timeline constrained helper should floor step to whole-number attempts");
    assert(budgetInput.objective === "uplift", "timeline constrained helper should preserve objective");
    assert(budgetInput.tlObjectiveMode === "min_cost_goal", "timeline constrained helper should preserve objective mode");
    assert(approx(Number(budgetInput.goalObjectiveValue), 150, 1e-9), "timeline constrained helper should preserve goal objective value");
    assert(capacityInput.mode === "capacity", "timeline constrained helper should normalize capacity mode");
    assert(capacityInput.budgetLimit == null, "capacity mode should not set budget limit");
    assert(approx(Number(capacityInput.capacityLimit), 0, 1e-9), "capacity mode should default missing capacity limit to zero");
    assert(capacityInput.capacityCeiling == null, "capacity mode should clear budget-mode capacity ceiling");
    assert(capacityInput.step === 1, "timeline constrained helper should enforce minimum step of 1");
    return true;
  });

  test("Rebuild contracts: timeline-constraint intervention deltas are canonical", () => {
    const buildOptimizationTacticsStub = ({ baseRates }) => ([
      {
        id: "doors",
        label: "Doors",
        used: {
          cr: Number(baseRates?.cr || 0),
        },
      },
    ]);
    const computeMaxAttemptsByTacticStub = (capsInput) => {
      const staffHours = Number(capsInput?.staffing?.staffHours || 0);
      const volunteerHours = Number(capsInput?.staffing?.volunteerHours || 0);
      return {
        enabled: true,
        maxAttemptsByTactic: {
          doors: Math.max(0, Math.round(staffHours + volunteerHours)),
          phones: 0,
          texts: 0,
        },
      };
    };
    const optimizeTimelineConstrainedStub = (input) => {
      const budgetLimit = Number(input?.budgetLimit || 0);
      const caps = input?.maxAttemptsByTactic && typeof input.maxAttemptsByTactic === "object"
        ? input.maxAttemptsByTactic
        : {};
      const timelineCap = Number(caps?.doors || 0) + Number(caps?.phones || 0) + Number(caps?.texts || 0);
      const firstTactic = Array.isArray(input?.tactics) ? input.tactics[0] : null;
      const contactRate = Number(firstTactic?.used?.cr || 0);
      const maxObjectiveValue = budgetLimit + timelineCap + (contactRate * 100);
      return {
        meta: {
          maxAchievableObjectiveValue: maxObjectiveValue,
          bindingObj: { timeline: ["doors"], budget: true, capacity: false },
        },
      };
    };

    const out = computeTimelineConstraintInterventionDeltas({
      state: {
        contactRatePct: 30,
        timelineStaffHours: 40,
        timelineVolHours: 20,
        budget: {
          tactics: {
            doors: { kind: "persuasion" },
            phones: { kind: "persuasion" },
            texts: { kind: "persuasion" },
          },
        },
      },
      weeksRemaining: 8,
      needObjectiveValue: 100,
      budgetAmount: 100,
      includeOverhead: false,
      overheadAmount: 0,
      optimizeConfig: {
        mode: "budget",
        objective: "net",
        tlConstrainedObjective: "max_net",
        step: 25,
        useDecay: false,
      },
      baseRates: { cr: 0.30, sr: 0.60, tr: 0.70 },
      tacticsRaw: {
        doors: { kind: "persuasion" },
        phones: { kind: "persuasion" },
        texts: { kind: "persuasion" },
      },
      buildOptimizationTactics: buildOptimizationTacticsStub,
      computeMaxAttemptsByTactic: computeMaxAttemptsByTacticStub,
      optimizeTimelineConstrained: optimizeTimelineConstrainedStub,
    });

    const byIntervention = new Map((Array.isArray(out?.rows) ? out.rows : []).map((row) => [String(row?.intervention || ""), row]));
    assert(approx(Number(out?.base?.maxObjectiveValue), 190, 1e-9), "intervention delta helper should preserve baseline objective value");
    assert(approx(Number(byIntervention.get("Timeline capacity")?.deltaObjectiveValue), 4, 1e-9), "intervention delta helper should compute timeline-capacity delta");
    assert(approx(Number(byIntervention.get("Volunteer hours")?.deltaObjectiveValue), 2, 1e-9), "intervention delta helper should compute volunteer-hours delta");
    assert(approx(Number(byIntervention.get("Budget ceiling")?.deltaObjectiveValue), 10, 1e-9), "intervention delta helper should compute budget-ceiling delta in budget mode");
    assert(approx(Number(byIntervention.get("Contact rate")?.deltaObjectiveValue), 3, 1e-9), "intervention delta helper should compute contact-rate delta");
    assert(String(byIntervention.get("Contact rate")?.notes || "").includes("30.0% -> 33.0%"), "intervention delta helper should emit canonical contact-rate notes");

    const capacityMode = computeTimelineConstraintInterventionDeltas({
      state: {
        contactRatePct: 30,
        timelineStaffHours: 40,
        timelineVolHours: 20,
        budget: {
          tactics: {
            doors: { kind: "persuasion" },
            phones: { kind: "persuasion" },
            texts: { kind: "persuasion" },
          },
        },
      },
      weeksRemaining: 8,
      needObjectiveValue: 100,
      budgetAmount: 100,
      includeOverhead: false,
      overheadAmount: 0,
      optimizeConfig: {
        mode: "capacity",
        objective: "net",
        tlConstrainedObjective: "max_net",
        step: 25,
        useDecay: false,
      },
      baseRates: { cr: 0.30, sr: 0.60, tr: 0.70 },
      tacticsRaw: {
        doors: { kind: "persuasion" },
        phones: { kind: "persuasion" },
        texts: { kind: "persuasion" },
      },
      buildOptimizationTactics: buildOptimizationTacticsStub,
      computeMaxAttemptsByTactic: computeMaxAttemptsByTacticStub,
      optimizeTimelineConstrained: optimizeTimelineConstrainedStub,
    });
    const budgetCapacityRow = (Array.isArray(capacityMode?.rows) ? capacityMode.rows : []).find((row) => row?.intervention === "Budget ceiling");
    assert(budgetCapacityRow?.deltaObjectiveValue == null, "intervention delta helper should suppress budget delta in capacity mode");
    assert(String(budgetCapacityRow?.notes || "") === "budget not active (capacity mode)", "intervention delta helper should emit canonical capacity-mode budget note");
    return true;
  });

  test("Rebuild contracts: optimization feasibility resolver is canonical", () => {
    const unconstrained = resolveOptimizationFeasible({
      timelineConstrainedEnabled: false,
      timelineEnabled: true,
      timelineGoalFeasible: null,
      timelineExecutablePct: 0.4,
    });
    const goalTrue = resolveOptimizationFeasible({
      timelineConstrainedEnabled: true,
      timelineEnabled: true,
      timelineGoalFeasible: true,
      timelineExecutablePct: 0.1,
    });
    const goalFalse = resolveOptimizationFeasible({
      timelineConstrainedEnabled: true,
      timelineEnabled: true,
      timelineGoalFeasible: false,
      timelineExecutablePct: 1,
    });
    const executableFalse = resolveOptimizationFeasible({
      timelineConstrainedEnabled: true,
      timelineEnabled: true,
      timelineGoalFeasible: null,
      timelineExecutablePct: 0.998,
      executableThreshold: 0.999,
    });
    const executableTrue = resolveOptimizationFeasible({
      timelineConstrainedEnabled: true,
      timelineEnabled: true,
      timelineGoalFeasible: null,
      timelineExecutablePct: 0.999,
      executableThreshold: 0.999,
    });
    const unknown = resolveOptimizationFeasible({
      timelineConstrainedEnabled: true,
      timelineEnabled: true,
      timelineGoalFeasible: null,
      timelineExecutablePct: null,
    });

    assert(unconstrained === true, "optimization feasibility should default true when timeline constraints are disabled");
    assert(goalTrue === true, "optimization feasibility should honor explicit goal-feasible true");
    assert(goalFalse === false, "optimization feasibility should honor explicit goal-feasible false");
    assert(executableFalse === false, "optimization feasibility should use executable threshold when goal-feasible is unknown");
    assert(executableTrue === true, "optimization feasibility should mark executable plans as feasible at threshold");
    assert(unknown == null, "optimization feasibility should return null when timeline feasibility is unknown");
    return true;
  });

  test("Rebuild contracts: optimization binding summary is canonical and deterministic", () => {
    const timelineBound = deriveOptimizationBindingSummary({
      bindingObj: {
        timeline: ["phones", "doors"],
        budget: true,
        capacity: false,
      },
      allocation: {
        doors: 90,
        phones: 60,
      },
      maxAttemptsByTactic: {
        doors: 100,
        phones: 80,
      },
    });
    const nonTimelineBound = deriveOptimizationBindingSummary({
      bindingObj: {
        timeline: [],
        budget: true,
        capacity: true,
      },
      allocation: {},
      maxAttemptsByTactic: {},
    });
    const unbound = deriveOptimizationBindingSummary({
      bindingObj: {},
      allocation: {},
      maxAttemptsByTactic: {},
    });

    assert(timelineBound.primary === "timeline: doors", "binding summary should rank timeline primary by highest saturation");
    assert(timelineBound.secondary === "timeline: phones", "binding summary should rank timeline secondary by next saturation");
    assert(Array.isArray(timelineBound.notBinding) && timelineBound.notBinding.length === 1 && timelineBound.notBinding[0] === "capacity", "binding summary should report non-binding dimensions deterministically");
    assert(nonTimelineBound.primary === "budget", "binding summary should fall back to budget primary when timeline is not binding");
    assert(nonTimelineBound.secondary === "capacity", "binding summary should fall back to capacity secondary");
    assert(Array.isArray(nonTimelineBound.notBinding) && nonTimelineBound.notBinding.length === 1 && nonTimelineBound.notBinding[0] === "timeline", "non-timeline binding summary should mark timeline as non-binding");
    assert(unbound.primary === "none/unknown", "binding summary should expose canonical primary fallback when nothing binds");
    assert(unbound.secondary === "—", "binding summary should expose canonical secondary fallback when nothing binds");
    assert(Array.isArray(unbound.notBinding) && unbound.notBinding.join(",") === "timeline,budget,capacity", "unbound summary should preserve canonical non-binding order");
    return true;
  });

  test("Rebuild contracts: optimizer objective uplift ranks by uplift-adjusted value per dollar", () => {
    const out = optimizeMixBudget({
      budget: 100,
      step: 10,
      objective: "uplift",
      tactics: [
        {
          id: "doors",
          label: "Doors",
          costPerAttempt: 1,
          netVotesPerAttempt: 0.12,
          turnoutAdjustedNetVotesPerAttempt: 0.12,
          upliftAdjustedNetVotesPerAttempt: 0.05,
        },
        {
          id: "phones",
          label: "Phones",
          costPerAttempt: 1,
          netVotesPerAttempt: 0.10,
          turnoutAdjustedNetVotesPerAttempt: 0.10,
          upliftAdjustedNetVotesPerAttempt: 0.09,
        },
      ],
    });
    const doorsAttempts = Number(out?.allocation?.doors || 0);
    const phonesAttempts = Number(out?.allocation?.phones || 0);
    assert(phonesAttempts > doorsAttempts, "uplift objective should prioritize higher uplift-adjusted value-per-dollar tactics");
    return true;
  });

  test("Rebuild contracts: office optimizer paths rank best office by dollar and organizer-hour", () => {
    const officePlans = optimizeMixByOffice({
      defaultObjective: "uplift",
      defaultStep: 10,
      offices: [
        {
          officeId: "west",
          officeName: "West",
          budget: 100,
          organizerHours: 80,
          tactics: [
            {
              id: "doors",
              label: "Doors",
              costPerAttempt: 1,
              netVotesPerAttempt: 0.14,
              turnoutAdjustedNetVotesPerAttempt: 0.14,
              upliftAdjustedNetVotesPerAttempt: 0.10,
              production: {
                effects: {
                  uplift: {
                    expectedMarginalGain: 0.62,
                    lowMarginalGain: 0.42,
                    uncertaintyBand: "medium",
                    saturationPressure: "high",
                    source: "targeting_rows",
                  },
                },
              },
            },
            {
              id: "phones",
              label: "Phones",
              costPerAttempt: 1,
              netVotesPerAttempt: 0.09,
              turnoutAdjustedNetVotesPerAttempt: 0.09,
              upliftAdjustedNetVotesPerAttempt: 0.06,
              production: {
                effects: {
                  uplift: {
                    expectedMarginalGain: 0.56,
                    lowMarginalGain: 0.34,
                    uncertaintyBand: "high",
                    saturationPressure: "medium",
                    source: "targeting_rows",
                  },
                },
              },
            },
          ],
        },
        {
          officeId: "east",
          officeName: "East",
          budget: 100,
          organizerHours: 20,
          tactics: [
            {
              id: "doors",
              label: "Doors",
              costPerAttempt: 1,
              netVotesPerAttempt: 0.12,
              turnoutAdjustedNetVotesPerAttempt: 0.12,
              upliftAdjustedNetVotesPerAttempt: 0.08,
              production: {
                effects: {
                  uplift: {
                    expectedMarginalGain: 0.55,
                    lowMarginalGain: 0.31,
                    uncertaintyBand: "high",
                    saturationPressure: "high",
                    source: "targeting_rows",
                  },
                },
              },
            },
            {
              id: "phones",
              label: "Phones",
              costPerAttempt: 1,
              netVotesPerAttempt: 0.08,
              turnoutAdjustedNetVotesPerAttempt: 0.08,
              upliftAdjustedNetVotesPerAttempt: 0.03,
              production: {
                effects: {
                  uplift: {
                    expectedMarginalGain: 0.44,
                    lowMarginalGain: 0.24,
                    uncertaintyBand: "high",
                    saturationPressure: "medium",
                    source: "targeting_rows",
                  },
                },
              },
            },
          ],
        },
      ],
    });

    assert(Array.isArray(officePlans?.rows) && officePlans.rows.length === 2, "office optimizer should return one row per office");
    assert(String(officePlans?.bestByDollar?.officeId || "") === "west", "best-by-dollar office should be west");
    assert(String(officePlans?.bestByOrganizerHour?.officeId || "") === "east", "best-by-organizer-hour office should be east");
    assert(
      approx(Number(officePlans?.bestByDollar?.objectivePerDollar), 0.1, 1e-9),
      "west objective-per-dollar should come from canonical office execution summary",
    );
    assert(
      approx(Number(officePlans?.bestByOrganizerHour?.objectivePerOrganizerHour), 0.4, 1e-9),
      "east objective-per-organizer-hour should come from canonical organizer-hour normalization",
    );
    assert(
      String(officePlans?.bestByDollar?.topChannels?.[0]?.id || "") === "doors",
      "office path should preserve canonical top-channel summary from execution summary",
    );
    assert(approx(Number(officePlans?.bestByDollar?.summary?.uplift?.weightedExpectedMarginalGain), 0.62, 1e-9), "best-by-dollar office should preserve uplift expected marginal gain from summary");

    const normalizedOfficeRow = normalizeOptimizationOfficePathRow({
      officeId: "west",
      officeName: "West",
      mode: "budget",
      binding: "budget",
      objectiveValue: "10.2",
      objectivePerDollar: "0.102",
      objectivePerOrganizerHour: "0.25",
      summary: {
        uplift: {
          weightedExpectedMarginalGain: 0.62,
          weightedLowMarginalGain: 0.42,
          uncertaintyBand: "medium",
          saturationPressure: "high",
          source: "targeting_rows",
        },
      },
      topChannels: [{ id: "doors" }],
    });
    const officeSummary = buildOptimizationOfficePathSummary(officePlans);
    assert(!!normalizedOfficeRow, "office path normalizer should produce a row for valid input");
    assert(normalizedOfficeRow?.officeId === "west", "office path normalizer should preserve office id");
    assert(approx(Number(normalizedOfficeRow?.objectiveValue), 10.2, 1e-9), "office path normalizer should parse objective value as finite number");
    assert(approx(Number(normalizedOfficeRow?.upliftExpectedMarginalGain), 0.62, 1e-9), "office path normalizer should preserve uplift expected marginal gain");
    assert(String(normalizedOfficeRow?.upliftSource || "") === "targeting_rows", "office path normalizer should preserve uplift source");
    assert(normalizedOfficeRow?.topChannel === "doors", "office path normalizer should preserve canonical top channel id");
    assert(!!officeSummary && Array.isArray(officeSummary.rows), "office path summary builder should return canonical row array");
    assert(officeSummary.rows.length === 2, "office path summary builder should preserve office row count");
    assert(String(officeSummary?.bestByDollar?.officeId || "") === "west", "office path summary builder should preserve best-by-dollar office");
    assert(String(officeSummary?.bestByOrganizerHour?.officeId || "") === "east", "office path summary builder should preserve best-by-organizer-hour office");
    return true;
  });

  test("Rebuild contracts: office optimization summary helper is canonical", () => {
    const summary = buildOfficeOptimizationSummary({
      officeMixRows: [
        { officeId: "west", organizerCount: 2, paidCanvasserCount: 1, activeVolunteerCount: 3 },
        { officeId: "east", organizerCount: 1, paidCanvasserCount: 1, activeVolunteerCount: 3 },
      ],
      mode: "budget",
      objective: "uplift",
      step: 10,
      useDecay: false,
      budgetAmount: 100,
      includeOverhead: false,
      overheadAmount: 0,
      capacityLimit: 100,
      baseRates: { cr: 0.2, sr: 0.5, tr: 0.8 },
      tacticsRaw: { doors: { enabled: true }, phones: { enabled: true } },
      state: {},
      workforce: {},
      organizerHoursPerWeek: 20,
      weeksRemaining: 2,
      buildOptimizationTactics: ({ workforce }) => {
        const organizerCount = Number(workforce?.organizerCount || 0);
        const doorValue = organizerCount >= 2 ? 0.12 : 0.08;
        return [
          {
            id: "doors",
            label: "Doors",
            costPerAttempt: 1,
            netVotesPerAttempt: doorValue,
            turnoutAdjustedNetVotesPerAttempt: doorValue,
            upliftAdjustedNetVotesPerAttempt: doorValue,
          },
          {
            id: "phones",
            label: "Phones",
            costPerAttempt: 1,
            netVotesPerAttempt: 0.04,
            turnoutAdjustedNetVotesPerAttempt: 0.04,
            upliftAdjustedNetVotesPerAttempt: 0.04,
          },
        ];
      },
      runOfficeOptimizer: (input) => optimizeMixByOffice(input),
    });

    assert(!!summary, "office optimization summary helper should return summary payload when callbacks are provided");
    assert(Array.isArray(summary?.rows) && summary.rows.length === 2, "office optimization summary helper should preserve office row count");
    assert(String(summary?.bestByDollar?.officeId || "") === "west", "office optimization summary helper should rank best-by-dollar office canonically");
    assert(String(summary?.bestByOrganizerHour?.officeId || "") === "east", "office optimization summary helper should rank best-by-organizer-hour office canonically");
    assert(String(summary?.rows?.[0]?.topChannel || "") === "doors", "office optimization summary helper should preserve top-channel ids");

    const missingCallbacks = buildOfficeOptimizationSummary({
      officeMixRows: [{ officeId: "west", organizerCount: 1 }],
    });
    assert(missingCallbacks == null, "office optimization summary helper should return null when required callbacks are missing");
    return true;
  });

  test("Rebuild contracts: optimization objective copy resolves canonical labels from registry", () => {
    const robustCopy = getOptimizationObjectiveCopy("uplift_robust");
    assert(robustCopy.value === "uplift_robust", "expected uplift_robust objective value");
    assert(robustCopy.label === "Uplift (Risk-Adjusted) Net Votes", "objective label should come from canonical objective registry");
    assert(robustCopy.metricLabel === "Expected uplift (risk-adjusted) net votes", "metric label should be derived canonically");
    assert(robustCopy.shortfallLabel === "Shortfall uplift (risk-adjusted) net votes", "shortfall label should be derived canonically");

    const fallbackCopy = getOptimizationObjectiveCopy("unknown_objective");
    assert(fallbackCopy.value === "net", "unknown objective should normalize to net");
    assert(fallbackCopy.label === "Net Votes", "fallback objective label should resolve to Net Votes");
    return true;
  });

  test("Rebuild contracts: optimizer objective uplift_robust uses uncertainty-adjusted lower bound", () => {
    const out = optimizeMixBudget({
      budget: 100,
      step: 10,
      objective: "uplift_robust",
      tactics: [
        {
          id: "doors",
          label: "Doors",
          costPerAttempt: 1,
          netVotesPerAttempt: 0.20,
          upliftAdjustedNetVotesPerAttempt: 0.13,
          upliftRiskAdjustedNetVotesPerAttempt: 0.03,
        },
        {
          id: "phones",
          label: "Phones",
          costPerAttempt: 1,
          netVotesPerAttempt: 0.15,
          upliftAdjustedNetVotesPerAttempt: 0.10,
          upliftRiskAdjustedNetVotesPerAttempt: 0.07,
        },
      ],
    });
    const doorsAttempts = Number(out?.allocation?.doors || 0);
    const phonesAttempts = Number(out?.allocation?.phones || 0);
    assert(phonesAttempts > doorsAttempts, "uplift_robust objective should prioritize stronger lower-bound gain-per-dollar");
    return true;
  });

  test("Rebuild contracts: timeline optimizer meta exposes canonical objective-value fields", () => {
    const tl = optimizeTimelineConstrained({
      mode: "budget",
      budgetLimit: 100,
      capacityLimit: null,
      capacityCeiling: null,
      tactics: [
        {
          id: "doors",
          label: "Doors",
          costPerAttempt: 1,
          netVotesPerAttempt: 0.10,
          turnoutAdjustedNetVotesPerAttempt: 0.10,
          upliftAdjustedNetVotesPerAttempt: 0.05,
        },
      ],
      step: 10,
      useDecay: false,
      objective: "uplift",
      maxAttemptsByTactic: { doors: 50 },
      tlObjectiveMode: "max_net",
      goalObjectiveValue: 10,
    });
    const meta = tl?.meta || {};
    const objectiveMeta = getTimelineObjectiveMeta(meta);
    const maxObjective = Number(objectiveMeta?.maxAchievableObjectiveValue);
    const remainingObjective = Number(objectiveMeta?.remainingGapObjectiveValue);
    assert(Number.isFinite(maxObjective), "maxAchievableObjectiveValue should be finite");
    assert(Number.isFinite(remainingObjective), "remainingGapObjectiveValue should be finite");
    assert(approx(Number(meta?.maxAchievableNetVotes), maxObjective, 1e-9), "net-vote alias should match canonical max objective value");
    assert(approx(Number(meta?.remainingGapNetVotes), remainingObjective, 1e-9), "net-vote alias should match canonical remaining objective value");
    assert(approx(Number(objectiveMeta?.goalObjectiveValue), Number(meta?.goalNetVotes), 1e-9), "goalObjectiveValue and goalNetVotes alias should match");
    return true;
  });

  test("Rebuild contracts: marginal-value diagnostics expose objective-value delta with net-vote alias", () => {
    const baselineInputs = {
      mode: "budget",
      budgetLimit: 200,
      capacityLimit: null,
      capacityCeiling: null,
      tactics: [
        {
          id: "doors",
          label: "Doors",
          costPerAttempt: 1,
          netVotesPerAttempt: 0.10,
          turnoutAdjustedNetVotesPerAttempt: 0.10,
          upliftAdjustedNetVotesPerAttempt: 0.05,
        },
      ],
      step: 10,
      useDecay: false,
      objective: "uplift",
      maxAttemptsByTactic: { doors: 40 },
      tlObjectiveMode: "max_net",
      goalObjectiveValue: 12,
    };
    const timelineInputs = {
      enabled: true,
      weeksRemaining: 2,
      activeWeeksOverride: 2,
      gotvWindowWeeks: 1,
      staffing: { staff: 1, volunteers: 0, staffHours: 2, volunteerHours: 0 },
      throughput: { doors: 10 },
      tacticKinds: { doors: "persuasion" },
    };
    const baselineResult = optimizeTimelineConstrained(baselineInputs);
    const diagnostics = computeMarginalValueDiagnostics({
      baselineInputs,
      baselineResult,
      timelineInputs,
    });
    const rows = Array.isArray(diagnostics?.interventions) ? diagnostics.interventions : [];
    assert(rows.length > 0, "expected marginal-value interventions");
    for (const row of rows){
      const objectiveDelta = Number(row?.deltaObjectiveValue);
      const netAliasDelta = Number(row?.deltaMaxNetVotes);
      assert(Number.isFinite(objectiveDelta), "deltaObjectiveValue should be finite");
      assert(Number.isFinite(netAliasDelta), "deltaMaxNetVotes alias should be finite");
      assert(approx(objectiveDelta, netAliasDelta, 1e-9), "delta aliases should match");
    }
    return true;
  });

  test("Rebuild contracts: timeline feasibility exposes objective shortfall with net-vote alias", () => {
    const tl = computeTimelineFeasibility({
      enabled: true,
      weeksRemaining: 1,
      activeWeeksOverride: 1,
      gotvWindowWeeks: 1,
      staffing: { staff: 1, volunteers: 0, staffHours: 1, volunteerHours: 0 },
      throughput: { doors: 10 },
      required: { doors: 100 },
      tacticKinds: { doors: "persuasion" },
      objectiveValuePerAttempt: 0.4,
    });
    const shortfallAttempts = Number(tl?.shortfallAttempts || 0);
    const shortfallObjectiveValue = Number(tl?.shortfallObjectiveValue);
    const shortfallNetVotes = Number(tl?.shortfallNetVotes);
    assert(Number.isFinite(shortfallObjectiveValue), "shortfallObjectiveValue should be finite");
    assert(Number.isFinite(shortfallNetVotes), "shortfallNetVotes alias should be finite");
    assert(approx(shortfallObjectiveValue, shortfallNetVotes, 1e-9), "timeline shortfall aliases should match");
    assert(approx(shortfallObjectiveValue, shortfallAttempts * 0.4, 1e-9), "timeline shortfall objective should equal attempts shortfall × objective value per attempt");
    const timelineObjectiveMeta = getTimelineFeasibilityObjectiveMeta({
      objectiveValuePerAttempt: 0.4,
      shortfallNetVotes: shortfallObjectiveValue,
    });
    const objectivePerAttempt = resolveTimelineObjectiveValuePerAttemptFromTotals({
      attempts: 200,
      netVotes: 80,
    });
    const objectivePerAttemptFallback = resolveTimelineObjectiveValuePerAttemptFromTotals({
      attempts: 0,
      netVotes: 80,
    });
    const normalizedWeeklyRows = normalizeTimelineWeeklyPlanRows([
      { week: "1", attempts: "120.4" },
      { week: 2, attempts: null },
      { foo: "bar" },
    ]);
    const timelineSnapshot = buildTimelineStateSnapshot({
      timelineResult: {
        percentPlanExecutable: 0.84,
        projectedCompletionWeek: 8,
        shortfallAttempts: 320,
        constraintType: "Timeline-limited",
      },
      objectiveMeta: { shortfallObjectiveValue: 128 },
      weeklyPlan: normalizedWeeklyRows,
    });
    const timelineDisplay = buildTimelineFeasibilityDisplayView({
      timelineResult: {
        percentPlanExecutable: 0.84,
        projectedCompletionWeek: 8,
        shortfallAttempts: 320,
        constraintType: "Timeline-limited",
      },
      objectiveMeta: { shortfallObjectiveValue: 128 },
      weeklyPlan: normalizedWeeklyRows,
      formatWhole: (value) => String(Math.round(Number(value) || 0)),
      formatPercent: (value) => `${Math.round(Number(value) * 100)}%`,
      buildWeekPreviewText: (rows) => `rows:${rows.length}`,
    });
    const timelineDisplayNoShortfall = buildTimelineFeasibilityDisplayView({
      timelineResult: {
        percentPlanExecutable: 1,
        projectedCompletionWeek: 6,
        shortfallAttempts: 0,
        constraintType: null,
      },
      objectiveMeta: { shortfallObjectiveValue: 0 },
      weeklyPlan: [],
      formatWhole: (value) => String(Math.round(Number(value) || 0)),
      formatPercent: (value) => `${Math.round(Number(value) * 100)}%`,
      buildWeekPreviewText: () => "none",
    });
    assert(approx(Number(timelineObjectiveMeta?.shortfallObjectiveValue), shortfallObjectiveValue, 1e-9), "timeline objective helper should normalize shortfall alias");
    assert(approx(Number(timelineObjectiveMeta?.objectiveValuePerAttempt), 0.4, 1e-9), "timeline objective helper should normalize objective value per attempt");
    assert(approx(Number(objectivePerAttempt), 0.4, 1e-9), "timeline objective-per-attempt resolver should derive objective/attempt from totals");
    assert(objectivePerAttemptFallback == null, "timeline objective-per-attempt resolver should return null for invalid totals");
    assert(Array.isArray(normalizedWeeklyRows) && normalizedWeeklyRows.length === 3, "timeline weekly-plan normalizer should preserve row count");
    assert(approx(Number(normalizedWeeklyRows[0]?.week), 1, 1e-9), "timeline weekly-plan normalizer should coerce week values");
    assert(approx(Number(normalizedWeeklyRows[0]?.attempts), 120.4, 1e-9), "timeline weekly-plan normalizer should coerce attempt values");
    assert(normalizedWeeklyRows[2]?.week == null && normalizedWeeklyRows[2]?.attempts == null, "timeline weekly-plan normalizer should emit nulls for missing values");
    assert(approx(Number(timelineSnapshot.percentPlanExecutable), 0.84, 1e-9), "timeline state snapshot should preserve executable percent");
    assert(approx(Number(timelineSnapshot.shortfallObjectiveValue), 128, 1e-9), "timeline state snapshot should preserve objective shortfall");
    assert(Array.isArray(timelineSnapshot.weeklyPlan) && timelineSnapshot.weeklyPlan.length === 3, "timeline state snapshot should preserve normalized weekly plan");
    assert(timelineDisplay.executableText === "84%", "timeline display helper should format executable percentage canonically");
    assert(timelineDisplay.projectedCompletionWeekText === "8", "timeline display helper should format projected completion week canonically");
    assert(timelineDisplay.shortfallAttemptsText === "320", "timeline display helper should format shortfall attempts canonically");
    assert(timelineDisplay.constraintText === "Timeline-limited", "timeline display helper should format constraint label canonically");
    assert(timelineDisplay.shortfallObjectiveText === "128", "timeline display helper should format shortfall objective canonically");
    assert(timelineDisplay.weekPreviewText === "rows:3", "timeline display helper should use canonical week-preview callback");
    assert(timelineDisplay.bannerKind === "warn", "timeline display helper should mark shortfall banners as warning");
    assert(timelineDisplay.bannerText.includes("shortfall 320 attempts"), "timeline display helper should compose canonical shortfall banner");
    assert(timelineDisplayNoShortfall.bannerText === "", "timeline display helper should suppress banner when fully executable");
    return true;
  });

  test("Rebuild contracts: target row scoring uses canonical targeting pipeline", () => {
    const components = {
      votePotential: 0.64,
      turnoutOpportunity: 0.49,
      persuasionIndex: 0.57,
      fieldEfficiency: 0.52,
    };
    const rawSignals = {
      turnoutReliabilityRaw: 0.83,
      contactRateModifier: 1.05,
      availabilityModifier: 0.94,
      densityBand: { multiplier: 1.04 },
      multiUnitShare: 0.24,
      longCommuteShare: 0.17,
    };
    const state = {
      contactRatePct: 24,
      supportRatePct: 56,
      turnoutReliabilityPct: 80,
      bandWidth: 4,
      budget: {
        tactics: {
          doors: { cpa: 0.24 },
          phones: { cpa: 0.08 },
          texts: { cpa: 0.02 },
          mail: { cpa: 0.70 },
        },
      },
      ui: {
        twCapOutlookLatest: {
          workforce: { organizerCount: 2, paidCanvasserCount: 3, activeVolunteerCount: 5 },
        },
      },
    };

    const canonical = computeCanonicalTargetMetrics({
      components,
      rawSignals,
      state,
      profileId: "house_v1",
      customWeights: null,
      config: {},
    });
    const scored = scoreTargetRow({
      modelId: "house_v1",
      components,
      rawSignals,
      config: { state },
    });

    assert(approx(scored.score, canonical.scores.targetScore, 1e-9), "target score should come from canonical pipeline");
    assert(approx(scored.expectedNetVoteValue, canonical.scores.expectedNetVoteValue, 1e-9), "expected net vote value should come from canonical pipeline");
    assert(approx(Number(scored?.uplift?.expectedMarginalGain), Number(canonical?.uplift?.expectedMarginalGain), 1e-9), "uplift expected marginal gain mismatch");
    assert(scored?.uplift?.bestChannel === canonical?.uplift?.bestChannel, "uplift best-channel mismatch");
    assert(Array.isArray(scored?.explainDrivers) && scored.explainDrivers.length > 0, "target explain drivers should be present");
    return true;
  });

  test("Rebuild contracts: canonical targeting defaults consume voter model signals", () => {
    const voterData = normalizeVoterDataState({
      manifest: { adapterId: "canonical", campaignId: "il-hd-21", officeId: "west" },
      rows: [
        {
          voter_id: "A",
          support_score: "0.60",
          turnout_score: "0.52",
          attempts: "2",
          conversations: "1",
          last_contact_result: "Support identified",
          last_contact_date: "2026-03-17",
          phone: "3125550101",
          precinct: "P1",
          tract_geoid: "17031010100",
          block_group_geoid: "170310101001",
        },
        {
          voter_id: "B",
          support_score: "0.41",
          turnout_score: "0.46",
          attempts: "0",
          conversations: "0",
          last_contact_date: "2026-02-01",
          precinct: "P2",
          tract_geoid: "17031010200",
        },
      ],
    });
    const voterSignals = deriveVoterModelSignals(voterData, {
      nowIso: "2026-03-18T00:00:00.000Z",
      recentWindowDays: 21,
    });

    const canonical = computeCanonicalTargetMetrics({
      components: {
        votePotential: 0.61,
        turnoutOpportunity: 0.48,
        persuasionIndex: 0.57,
        fieldEfficiency: 0.51,
      },
      rawSignals: {
        turnoutReliabilityRaw: 0.82,
        densityBand: { multiplier: 1.0 },
      },
      state: {
        contactRatePct: 25,
        supportRatePct: 56,
        turnoutReliabilityPct: 80,
        voterData,
      },
      profileId: "house_v1",
      config: {},
    });

    assert(approx(Number(canonical?.features?.networkValue), Number(voterSignals?.targeting?.networkValueDefault), 1e-9), "targeting network-value default should come from voter model signals");
    assert(approx(Number(canonical?.features?.saturationMultiplier), Number(voterSignals?.targeting?.saturationMultiplierDefault), 1e-9), "targeting saturation default should come from voter model signals");
    assert(approx(Number(canonical?.features?.contactProbability), 0.25, 1e-9), "contact probability should stay canonical when voter multiplier is neutral");
    return true;
  });

  test("Rebuild contracts: targeting ranking rows use canonical score engine", () => {
    const rows = [
      {
        geoid: "170310101001",
        label: "A",
        memberCount: 1,
        sourceGeoids: ["170310101001"],
        rawSignals: {
          votePotentialRaw: 510,
          turnoutOpportunityRaw: 1.18,
          persuasionIndexRaw: 1.10,
          fieldEfficiencyRaw: 0.94,
          votesPerOrganizerHour: 2.25,
          turnoutReliabilityRaw: 0.82,
          contactRateModifier: 1.03,
          availabilityModifier: 0.97,
          densityBand: { id: "medium_density", label: "Medium density", multiplier: 0.97 },
        },
      },
      {
        geoid: "170310101002",
        label: "B",
        memberCount: 1,
        sourceGeoids: ["170310101002"],
        rawSignals: {
          votePotentialRaw: 300,
          turnoutOpportunityRaw: 0.72,
          persuasionIndexRaw: 1.26,
          fieldEfficiencyRaw: 1.05,
          votesPerOrganizerHour: 1.84,
          turnoutReliabilityRaw: 0.78,
          contactRateModifier: 0.96,
          availabilityModifier: 0.92,
          densityBand: { id: "high_density", label: "High density", multiplier: 0.94 },
        },
      },
    ];
    const state = {
      contactRatePct: 23,
      supportRatePct: 55,
      turnoutReliabilityPct: 79,
    };
    const normalizedComponents = buildNormalizedTargetComponents(rows);
    const scored = scoreTargetRows({
      rows,
      modelId: "house_v1",
      state,
      config: { minScore: 0 },
    });
    assert(Array.isArray(scored) && scored.length === 2, "canonical ranking score engine should score all rows");
    const expectedByGeoid = new Map(rows.map((row, idx) => [String(row?.geoid || ""), normalizedComponents[idx]]));
    for (const row of scored){
      assert(Number.isFinite(Number(row?.score)), "ranked row score should be finite");
      assert(Number.isFinite(Number(row?.baseScore)), "ranked row baseScore should be finite");
      assert(Number.isFinite(Number(row?.expectedNetVoteValue)), "ranked row expectedNetVoteValue should be finite");
      assert(Number.isFinite(Number(row?.scoreByModel?.turnout_opportunity)), "turnout score-by-model missing");
      assert(Number.isFinite(Number(row?.scoreByModel?.persuasion_first)), "persuasion score-by-model missing");
      assert(Number.isFinite(Number(row?.scoreByModel?.field_efficiency)), "efficiency score-by-model missing");
      const expected = expectedByGeoid.get(String(row?.geoid || ""));
      assert(expected, "expected canonical normalized components for ranked row");
      assert(approx(Number(row?.componentScores?.votePotential), Number(expected?.votePotential), 1e-9), "votePotential should come from canonical normalized component engine");
      assert(approx(Number(row?.componentScores?.turnoutOpportunity), Number(expected?.turnoutOpportunity), 1e-9), "turnoutOpportunity should come from canonical normalized component engine");
      assert(approx(Number(row?.componentScores?.persuasionIndex), Number(expected?.persuasionIndex), 1e-9), "persuasionIndex should come from canonical normalized component engine");
      assert(approx(Number(row?.componentScores?.fieldEfficiency), Number(expected?.fieldEfficiency), 1e-9), "fieldEfficiency should come from canonical normalized component engine");
    }
    return true;
  });

  test("Rebuild contracts: targeting preset weights resolve through canonical profile", () => {
    const preset = getTargetModelPreset("turnout_opportunity");
    const expected = resolveCanonicalWeightProfile({
      profileId: preset.modelId,
      customWeights: preset.weights,
    });
    for (const key of TARGET_FEATURE_KEYS){
      assert(approx(Number(preset?.weights?.[key]), Number(expected?.[key]), 1e-9), `preset weight mismatch for ${key}`);
    }
    return true;
  });

  test("Rebuild contracts: targeting field patch uses canonical clamp rules", () => {
    const targeting = {
      geoLevel: "block_group",
      topN: 25,
      minHousingUnits: 0,
      minPopulation: 0,
      minScore: 0,
      onlyRaceFootprint: true,
      criteria: {},
      weights: {},
      presetId: "turnout_opportunity",
      modelId: "turnout_opportunity",
    };

    const okTopN = applyTargetingFieldPatch(targeting, "topN", "999");
    const okHousing = applyTargetingFieldPatch(targeting, "minHousingUnits", "-12.8");
    const okPopulation = applyTargetingFieldPatch(targeting, "minPopulation", "42.9");
    const okScore = applyTargetingFieldPatch(targeting, "minScore", "-0.2");
    const okDensity = applyTargetingFieldPatch(targeting, "densityFloor", "bad-density");
    const okWeight = applyTargetingFieldPatch(targeting, "weightTurnoutOpportunity", "-3");
    const okToggle = applyTargetingFieldPatch(targeting, "onlyRaceFootprint", 0);
    const okGeo = applyTargetingFieldPatch(targeting, "geoLevel", "tract");
    const ignoredBlankGeo = applyTargetingFieldPatch(targeting, "geoLevel", "");

    assert(okTopN === true && targeting.topN === 500, "targeting topN should clamp to canonical upper bound");
    assert(okHousing === true && targeting.minHousingUnits === 0, "targeting minHousingUnits should clamp to canonical non-negative integer");
    assert(okPopulation === true && targeting.minPopulation === 42, "targeting minPopulation should floor to canonical integer");
    assert(okScore === true && targeting.minScore === 0, "targeting minScore should clamp to canonical non-negative value");
    assert(okDensity === true && targeting.criteria?.densityFloor === "none", "targeting densityFloor should normalize invalid values to canonical fallback");
    assert(okWeight === true && targeting.weights?.turnoutOpportunity === 0, "targeting weights should clamp to canonical non-negative values");
    assert(okToggle === true && targeting.onlyRaceFootprint === false, "targeting boolean toggles should coerce to canonical boolean values");
    assert(okGeo === true && targeting.geoLevel === "tract", "targeting geoLevel patch should set non-empty values");
    assert(ignoredBlankGeo === false, "targeting geoLevel patch should ignore blank values");
    const reset = resetTargetingWeightsToPreset(targeting, "turnout_opportunity");
    assert(reset?.ok === true, "targeting weight reset helper should succeed with canonical preset id");
    assert(Number.isFinite(Number(reset?.weights?.votePotential)), "targeting weight reset helper should return canonical votePotential weight");
    assert(Number.isFinite(Number(reset?.weights?.turnoutOpportunity)), "targeting weight reset helper should return canonical turnoutOpportunity weight");
    assert(Number.isFinite(Number(reset?.weights?.persuasionIndex)), "targeting weight reset helper should return canonical persuasionIndex weight");
    assert(Number.isFinite(Number(reset?.weights?.fieldEfficiency)), "targeting weight reset helper should return canonical fieldEfficiency weight");
    assert(TARGETING_STATUS_LOAD_ROWS_FIRST === "Load ACS rows before running targeting.", "targeting load-rows status constant mismatch");
    assert(TARGETING_STATUS_NO_MATCH === "Targeting run complete: no rows matched current filters. Relax thresholds and retry.", "targeting no-match status constant mismatch");
    assert(
      buildTargetingRunCompleteStatus(1234, 78, "en-US") === "Targeting run complete: 1,234 rows ranked, 78 top targets flagged.",
      "targeting run complete status helper should format canonical row/top counts"
    );
    assert(
      countTopTargets([{ isTopTarget: true }, { isTopTarget: false }, {}, { isTopTarget: 1 }]) === 2,
      "targeting top-target counter should deterministically count truthy top-target rows"
    );
    const targetOut = { lastRows: [], lastMeta: null, lastRun: "" };
    const appliedRows = applyTargetingRunResult(targetOut, {
      rows: [{ isTopTarget: true }, { isTopTarget: false }, { isTopTarget: true }],
      meta: { ranAt: "2026-03-17T12:00:00.000Z" },
    }, { locale: "en-US" });
    const appliedEmpty = applyTargetingRunResult(targetOut, { rows: [], meta: {} }, { locale: "en-US" });
    assert(appliedRows.hasRows === true && appliedRows.topCount === 2, "targeting run-result helper should compute canonical top-target counts");
    assert(appliedRows.statusText === "Targeting run complete: 3 rows ranked, 2 top targets flagged.", "targeting run-result helper should build canonical non-empty status");
    assert(appliedRows.ranAt === "2026-03-17T12:00:00.000Z", "targeting run-result helper should preserve canonical run timestamp from meta");
    assert(Array.isArray(targetOut.lastRows), "targeting run-result helper should write rows onto targeting state");
    assert(appliedEmpty.hasRows === false && appliedEmpty.statusText === TARGETING_STATUS_NO_MATCH, "targeting run-result helper should emit canonical empty status");
    const payloadConfig = buildTargetRankingPayloadConfig({
      enabled: 1,
      presetId: " obama_turnout ",
      geoLevel: " tract ",
      modelId: " turnout_opportunity ",
      topN: "25",
      minHousingUnits: "10",
      minPopulation: "20",
      minScore: "0.4",
      excludeZeroHousing: 0,
      onlyRaceFootprint: 1,
      weights: { votePotential: 0.2 },
      criteria: { densityFloor: "medium" },
    });
    assert(payloadConfig.enabled === true, "targeting payload config helper should coerce enabled to boolean");
    assert(payloadConfig.presetId === "obama_turnout", "targeting payload config helper should trim preset id");
    assert(payloadConfig.geoLevel === "tract", "targeting payload config helper should trim geo level");
    assert(payloadConfig.modelId === "turnout_opportunity", "targeting payload config helper should trim model id");
    assert(payloadConfig.topN === 25 && payloadConfig.minHousingUnits === 10 && payloadConfig.minPopulation === 20, "targeting payload config helper should coerce numeric fields canonically");
    assert(payloadConfig.minScore === 0.4, "targeting payload config helper should preserve minScore numeric conversion");
    assert(payloadConfig.excludeZeroHousing === false && payloadConfig.onlyRaceFootprint === true, "targeting payload config helper should coerce targeting boolean flags");
    assert(payloadConfig.weights.votePotential === 0.2, "targeting payload config helper should preserve weights object values");
    assert(payloadConfig.criteria.densityFloor === "medium", "targeting payload config helper should preserve criteria object values");
    assert(
      normalizeTargetRankingModelSlug("Obama Persuasion / 2026") === "obama-persuasion-2026",
      "targeting export model slug helper should canonicalize model labels"
    );
    assert(
      normalizeTargetRankingFileStamp("2026-03-17T12:34:56.789Z") === "2026-03-17T12-34-56-789Z",
      "targeting export file stamp helper should canonicalize timestamp separators"
    );
    assert(
      buildTargetRankingExportFilename({
        presetId: "obama_persuasion",
        modelId: "persuasion_first",
        extension: ".json",
        stamp: "2026-03-17T12-34-56-789Z",
      }) === "target-ranking-obama_persuasion-2026-03-17T12-34-56-789Z.json",
      "targeting export filename helper should build canonical ranking export filenames"
    );
    return true;
  });

  test("Rebuild contracts: canonical targeting-row helpers apply one deterministic rank/score ordering", () => {
    const rows = [
      { geoid: "a", score: 55, targetScore: 70, rank: 2 },
      { geoid: "b", score: 95, targetScore: 88, rank: 1, isTopTarget: true },
      { geoid: "c", score: 99, targetScore: 91, isTopTarget: true },
      { geoid: "d", score: 60, targetScore: 75, isTopTarget: false },
    ];
    const selected = selectTopTargetingRows(rows, 2, { fallbackTopN: 25 });
    assert(Array.isArray(selected) && selected.length === 2, "top-target selector should apply canonical topN limit");
    assert(String(selected[0]?.geoid || "") === "b", "ranked row with lowest rank should come first");
    assert(String(selected[1]?.geoid || "") === "a", "ranked row with next rank should come second");

    const scoreA = targetRowScoreValue(rows[0]);
    const scoreD = targetRowScoreValue(rows[3]);
    assert(approx(Number(scoreA), 70, 1e-9), "target-row score helper should prefer targetScore");
    assert(approx(Number(scoreD), 75, 1e-9), "target-row score helper should read canonical targetScore");
    assert(
      countTopTargetRows([{ isTopTarget: true }, { isTopTarget: false }, {}, { isTopTarget: 1 }]) === 2,
      "canonical top-target counter should deterministically count truthy top-target rows",
    );
    return true;
  });

  test("Rebuild contracts: canonical targeting-row summary powers archive/uplift snapshots", () => {
    const summary = summarizeTargetingRows([
      { geoid: "170310101001", label: "A", score: 82.5, expectedNetVoteValue: 18.4, isTopTarget: true, isTurnoutPriority: true },
      { geoid: "170310101002", label: "B", score: 71.25, expectedNetVoteValue: 10.1, isTopTarget: false, isPersuasionPriority: true },
      { geoid: "170310101003", label: "C", score: 66.0, expectedNetVoteValue: 7.5, isTopTarget: true, isEfficiencyPriority: true },
    ], { topListLimit: 1 });
    assert(summary.rowCount === 3, "targeting-row summary should preserve row count");
    assert(summary.topTargetCount === 2, "targeting-row summary should count top targets");
    assert(summary.turnoutPriorityCount === 1, "targeting-row summary should count turnout-priority rows");
    assert(summary.persuasionPriorityCount === 1, "targeting-row summary should count persuasion-priority rows");
    assert(summary.efficiencyPriorityCount === 1, "targeting-row summary should count efficiency-priority rows");
    assert(approx(Number(summary.meanScore), (82.5 + 71.25 + 66.0) / 3, 1e-9), "targeting-row summary mean score mismatch");
    assert(approx(Number(summary.topMeanScore), (82.5 + 66.0) / 2, 1e-9), "targeting-row summary top mean score mismatch");
    assert(approx(Number(summary.expectedNetVoteValueTotal), 36.0, 1e-9), "targeting-row summary expected-net total mismatch");
    assert(approx(Number(summary.topExpectedNetVoteValueTotal), 25.9, 1e-9), "targeting-row summary top expected-net total mismatch");
    assert(summary.topGeoids.length === 1 && String(summary.topGeoids[0] || "") === "170310101001", "targeting-row summary should cap top GEOID list deterministically");
    assert(summary.topLabels.length === 1 && String(summary.topLabels[0] || "") === "A", "targeting-row summary should cap top label list deterministically");
    return true;
  });
}
