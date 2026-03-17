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
import { computeChannelCostMetrics, resolveChannelCostAssumption } from "../channelCosts.js";
import {
  appendForecastArchiveEntry,
  buildForecastArchiveContext,
  buildForecastArchiveMarginSummary,
  buildForecastArchiveEntry,
  makeForecastArchiveKey,
  normalizeForecastArchiveActual,
  readForecastArchive,
  resolveForecastArchiveMargin,
  summarizeForecastArchive,
  updateForecastArchiveActual,
} from "../forecastArchive.js";
import { summarizeModelAuditFromArchive } from "../modelAudit.js";
import {
  makeOperationsContextKey,
  resolveOperationsContext,
  resolveOperationsContextFromState,
  summarizeOperationsContext,
  toOperationsStoreOptions,
  toOperationsStoreOptionsFromState,
} from "../../features/operations/context.js";
import { getTargetModelPreset } from "../../app/targetingRuntime.js";
import { applyContextToState, resolveActiveContext } from "../../app/activeContext.js";
import { computeOperationalRollups } from "../../features/operations/rollups.js";
import { computeModelGovernance } from "../modelGovernance.js";
import { computeConfidenceProfile } from "../confidence.js";
import { computeLearningLoop } from "../learningLoop.js";
import {
  buildConfidenceStats as buildOutcomeConfidenceStats,
  buildOutcomeMcStatus,
  buildMissRiskSummary,
  buildOutcomeCliff,
  buildOutcomeFragility,
  buildOutcomeRiskLabel,
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
  deriveShiftFromMargin,
} from "../outcomeView.js";
import {
  PLAN_OPTIMIZER_STATUS_FALLBACK,
  PLAN_TIMELINE_STATUS_FALLBACK,
  PLAN_WORKLOAD_STATUS_FALLBACK,
  buildPlanCostLevers,
  buildPlanDecisionWarning,
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
} from "../planView.js";
import {
  REACH_REALITY_NOTE_FALLBACK,
  REACH_STATUS_AWAITING_INPUTS,
  REACH_STATUS_UNAVAILABLE,
  classifyReachStatusTone,
  deriveReachActionsCardStatus,
  deriveReachLeversCardStatus,
  deriveReachWeeklyCardStatus,
} from "../reachView.js";
import {
  DECISION_STATUS_AWAITING_DECISION,
  DECISION_STATUS_UNAVAILABLE,
  classifyDecisionStatusTone,
  deriveDecisionActionCardStatus,
  deriveDecisionDetailCardStatus,
  deriveDecisionDiagnosticsCardStatus,
  deriveDecisionOptionsCardStatus,
  deriveDecisionSessionCardStatus,
  deriveDecisionSummaryCardStatus,
} from "../decisionView.js";
import {
  DATA_STATUS_AWAITING_STORAGE,
  classifyDataStatusTone,
  deriveDataAuditCardStatus,
  deriveDataExchangeCardStatus,
  deriveDataPolicyCardStatus,
  deriveDataStorageCardStatus,
  deriveDataSummaryCardStatus,
} from "../dataView.js";
import {
  SCENARIO_STATUS_AWAITING_SCENARIO,
  SCENARIO_STATUS_UNAVAILABLE,
  classifyScenarioStatusTone,
  deriveScenarioCompareCardStatus,
  deriveScenarioNotesCardStatus,
  deriveScenarioSummaryCardStatus,
  deriveScenarioWorkspaceCardStatus,
} from "../scenarioView.js";
import {
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
} from "../controlsView.js";
import {
  TURNOUT_ROI_BANNER_FALLBACK,
  TURNOUT_STATUS_AWAITING_SETUP,
  TURNOUT_STATUS_BANNER_FALLBACK,
  buildRoiStatusBanner,
  buildTurnoutStatusBanner,
  classifyTurnoutStatusTone,
  deriveTurnoutAssumptionsCardStatus,
  deriveTurnoutCostCardStatus,
  deriveTurnoutEfficiencyCardStatus,
  deriveTurnoutImpactCardStatus,
  deriveTurnoutLiftCardStatus,
  deriveTurnoutSummaryCardStatus,
} from "../turnoutView.js";
import {
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
} from "../districtView.js";
import { buildOptimizationTactics } from "../budget.js";
import {
  buildOptimizationUpliftSummaryText,
  buildOptimizationExecutionSummary,
  deriveOptimizationUpliftSignals,
  optimizeMixBudget,
} from "../optimize.js";
import { getTimelineObjectiveMeta, optimizeTimelineConstrained } from "../timelineOptimizer.js";
import { getOptimizationObjectiveCopy } from "../turnout.js";
import { computeMarginalValueDiagnostics } from "../marginalValue.js";
import { computeTimelineFeasibility, getTimelineFeasibilityObjectiveMeta } from "../timeline.js";
import { computeCanonicalTargetMetrics } from "../targetFeatureEngine.js";
import { resolveCanonicalWeightProfile } from "../targetFeatureEngine.js";
import { TARGET_FEATURE_KEYS } from "../targetFeatureRegistry.js";
import { scoreTargetRow } from "../targetModels.js";
import { scoreTargetRows } from "../targetRankingEngine.js";
import { buildUpliftFeatures } from "../upliftFeatures.js";
import { computeOptimizationUpliftPlan, computeUpliftPlan } from "../upliftModel.js";

function approx(a, b, tol = 1e-9){
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tol;
}

function makeMemoryStorage(){
  const map = new Map();
  return {
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
    assert(JSON.stringify(a) === JSON.stringify(b), "governance outputs must be deterministic");
    assert(Number.isFinite(Number(a?.realism?.score)), "realism score should be finite");
    assert(Number.isFinite(Number(a?.dataQuality?.score)), "data quality score should be finite");
    assert(Number.isFinite(Number(a?.execution?.score)), "execution realism score should be finite");
    assert(String(a?.execution?.status || "").length > 0, "execution realism status missing");
    assert(typeof a?.confidence?.band === "string" && a.confidence.band.length > 0, "confidence band missing");
    assert(Number.isFinite(Number(a?.confidence?.influences?.execution)), "confidence execution influence missing");
    assert(String(a?.learning?.topSuggestion?.label || "").trim().length > 0, "learning suggestion missing");
    assert(Array.isArray(a?.guardrails) && a.guardrails.length >= 2, "governance guardrails missing");
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

    const volunteerLevers = buildPlanVolunteerLevers("capacity", "320");
    const costLevers = buildPlanCostLevers("budget", "320");
    const probabilityLevers = buildPlanProbabilityLevers("timeline", "140");

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

    assert(Array.isArray(volunteerLevers) && volunteerLevers.length >= 1, "volunteer levers should be present");
    assert(Array.isArray(costLevers) && costLevers.length >= 1, "cost levers should be present");
    assert(Array.isArray(probabilityLevers) && probabilityLevers.length >= 1, "probability levers should be present");

    assert(workloadStatus === "Awaiting setup", "workload status should map fallback banner to setup state");
    assert(optimizerStatus === "Binding", "optimizer status should detect binding constraint");
    assert(timelineStatus === "Constrained", "timeline status should resolve constrained when executable < 100");
    assert(riskStatus === "Elevated", "risk status should resolve elevated under shortfall");
    assert(actionsStatus === "Recovery plan", "actions status should resolve recovery when shortfall remains");
    assert(summaryStatus === "Constrained", "summary status should resolve constrained under shortfall");
    assert(tone === "bad", "status tone should classify recovery plan as bad");
    assert(typeof PLAN_OPTIMIZER_STATUS_FALLBACK === "string" && PLAN_OPTIMIZER_STATUS_FALLBACK.length > 0, "optimizer fallback constant missing");
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
    assert(typeof REACH_REALITY_NOTE_FALLBACK === "string" && REACH_REALITY_NOTE_FALLBACK.length > 0, "reach reality-note fallback missing");
    assert(REACH_STATUS_UNAVAILABLE === "Unavailable", "reach unavailable status constant mismatch");
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

    const summaryWatch = deriveDataSummaryCardStatus(true, true, false, "Browser storage only.");
    const summaryStrictLocal = deriveDataSummaryCardStatus(true, false, false, "Browser storage only.");
    const summaryStrictExternal = deriveDataSummaryCardStatus(true, false, false, "Folder connected.");
    const summaryStable = deriveDataSummaryCardStatus(false, false, false, "Browser storage only.");
    const summaryExternalReady = deriveDataSummaryCardStatus(false, false, false, "Folder connected.");

    const toneOk = classifyDataStatusTone("Learning active");
    const toneWarn = classifyDataStatusTone("Bias watch");
    const toneBad = classifyDataStatusTone("Check import");

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

    assert(summaryWatch === "Watch policy", "data summary status should prioritize policy warnings");
    assert(summaryStrictLocal === "Strict local", "data summary status should detect strict-local posture");
    assert(summaryStrictExternal === "Strict external", "data summary status should detect strict-external posture");
    assert(summaryStable === "Stable", "data summary status should detect stable browser posture");
    assert(summaryExternalReady === "External ready", "data summary status should detect external-ready posture");

    assert(toneOk === "ok", "data tone should map learning-active to ok");
    assert(toneWarn === "warn", "data tone should map bias-watch to warn");
    assert(toneBad === "bad", "data tone should map check-import to bad");
    assert(DATA_STATUS_AWAITING_STORAGE === "Awaiting storage", "data awaiting-storage constant mismatch");
    return true;
  });

  test("Rebuild contracts: scenario view helpers are canonical and deterministic", () => {
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

    const compareNone = deriveScenarioCompareCardStatus({
      modeText: "Select a non-baseline active scenario to view differences.",
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

    assert(workspaceUnavailable === SCENARIO_STATUS_UNAVAILABLE, "scenario workspace status should be unavailable with no scenarios");
    assert(workspaceActive === "Scenario active", "scenario workspace status should detect active non-baseline scenario");
    assert(workspaceBaseline === "Baseline ready", "scenario workspace status should detect baseline mode");

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

    assert(toneOk === "ok", "turnout tone should map compared to ok");
    assert(toneWarn === "warn", "turnout tone should map awaiting refresh to warn");
    assert(toneBad === "bad", "turnout tone should map no tactics to bad");
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
    const expectedPerContact = assumption.costPerAttempt / assumption.contactRate;
    assert(approx(metrics.costPerContact, expectedPerContact, 1e-9), "costPerContact should come from canonical assumption");
    assert(approx(metrics.costPerExpectedVote, assumption.costPerAttempt / 0.04, 1e-9), "costPerExpectedVote mismatch");
    assert(approx(metrics.costPerExpectedNetVote, assumption.costPerAttempt / 0.05, 1e-9), "costPerExpectedNetVote mismatch");
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

  test("Rebuild contracts: forecast archive keys and entries are campaign-scoped", () => {
    const key = makeForecastArchiveKey({ campaignId: "IL HD 21" });
    assert(/::il-hd-21$/.test(key), "forecast archive key should normalize campaign scope");

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
        },
        budget: {
          includeOverhead: true,
          overheadAmount: 300,
          tactics: { doors: { cpa: 0.2, kind: "persuasion" } },
          optimize: { objective: "net" },
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

    assert(approx(Number(summary?.uplift?.weightedExpectedMarginalGain), 0.62, 1e-9), "weighted expected uplift mismatch");
    assert(approx(Number(summary?.uplift?.weightedLowMarginalGain), 0.42, 1e-9), "weighted low uplift mismatch");
    assert(approx(Number(summary?.uplift?.uncertaintySpread), 0.20, 1e-9), "uplift uncertainty spread mismatch");
    assert(approx(Number(summary?.uplift?.weightedSaturationUtilization), 0.8, 1e-9), "weighted saturation mismatch");
    assert(summary?.uplift?.uncertaintyBand === "high", "uncertainty band should be high");
    assert(summary?.uplift?.saturationPressure === "medium", "saturation pressure should be medium");
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
    });
    assert(approx(Number(normalized?.expectedMarginalGain), 0.62, 1e-9), "normalized expected uplift mismatch");
    assert(approx(Number(normalized?.lowMarginalGain), 0.42, 1e-9), "normalized low uplift mismatch");
    assert(normalized?.hasRange === true, "normalized uplift should mark range when low + expected are present");
    assert(normalized?.hasUncertainty === true, "normalized uplift should mark uncertainty when band exists");
    assert(normalized?.uncertaintyBand === "high", "uncertainty band should normalize to lowercase");
    assert(normalized?.hasSaturation === true, "normalized uplift should mark non-unknown saturation pressure");
    assert(normalized?.saturationPressure === "medium", "saturation pressure should normalize to lowercase");
    assert(normalized?.bestChannel === "doors", "bestChannel should preserve canonical channel id");
    return true;
  });

  test("Rebuild contracts: optimization uplift summary text comes from canonical formatter", () => {
    const summaryText = buildOptimizationUpliftSummaryText({
      weightedExpectedMarginalGain: 0.62,
      weightedLowMarginalGain: 0.42,
      uncertaintyBand: "high",
      saturationPressure: "medium",
      bestChannel: "doors",
    }, {
      formatPercent: (value) => `${Math.round(Number(value) * 100)}%`,
      rangeJoiner: " to ",
      saturationPrefix: "saturation pressure",
    });
    assert(
      summaryText === "Uplift range 42% to 62%; best channel doors; uncertainty high; saturation pressure medium",
      "canonical uplift summary text should preserve deterministic ordering and phrasing",
    );
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
    assert(approx(Number(timelineObjectiveMeta?.shortfallObjectiveValue), shortfallObjectiveValue, 1e-9), "timeline objective helper should normalize shortfall alias");
    assert(approx(Number(timelineObjectiveMeta?.objectiveValuePerAttempt), 0.4, 1e-9), "timeline objective helper should normalize objective value per attempt");
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
    const scored = scoreTargetRows({
      rows,
      modelId: "house_v1",
      state,
      config: { minScore: 0 },
    });
    assert(Array.isArray(scored) && scored.length === 2, "canonical ranking score engine should score all rows");
    for (const row of scored){
      assert(Number.isFinite(Number(row?.score)), "ranked row score should be finite");
      assert(Number.isFinite(Number(row?.baseScore)), "ranked row baseScore should be finite");
      assert(Number.isFinite(Number(row?.expectedNetVoteValue)), "ranked row expectedNetVoteValue should be finite");
      assert(Number.isFinite(Number(row?.scoreByModel?.turnout_opportunity)), "turnout score-by-model missing");
      assert(Number.isFinite(Number(row?.scoreByModel?.persuasion_first)), "persuasion score-by-model missing");
      assert(Number.isFinite(Number(row?.scoreByModel?.field_efficiency)), "efficiency score-by-model missing");
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
}
