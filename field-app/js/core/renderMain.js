// @ts-check
import { buildModelInputFromState } from "./modelInput.js";
import { computeExpectedAphFromWeeklyContext } from "../core/executionSnapshot.js";
import {
  buildOutcomeExpectedVoteTexts,
  buildOutcomeSupportTotalText,
  buildOutcomeTurnoutBandText,
  buildOutcomeTurnoutExpectedText,
} from "../core/outcomeView.js";

let censusRenderModulePromise = null;
let censusRenderModule = null;
let censusRenderLoadFailed = false;

function renderCensusPhase1Safe(ctx){
  if (typeof censusRenderModule === "function"){
    censusRenderModule(ctx);
    return;
  }
  if (censusRenderLoadFailed){
    return;
  }
  if (!censusRenderModulePromise){
    censusRenderModulePromise = import("./censusPhase1.js")
      .then((mod) => {
        const fn = (mod && typeof mod.renderCensusPhase1Module === "function")
          ? mod.renderCensusPhase1Module
          : null;
        censusRenderModule = fn;
        if (!fn){
          censusRenderLoadFailed = true;
        }
        return fn;
      })
      .catch((err) => {
        censusRenderLoadFailed = true;
        console.error("[renderMain] failed to load census render module", err);
        return null;
      });
  }
  censusRenderModulePromise.then((fn) => {
    if (typeof fn === "function"){
      try {
        fn(ctx);
      } catch (err) {
        console.error("[renderMain] census render failed", err);
      }
    }
  });
}

/** @param {import("./types").RenderMainCtx} ctx */
export function renderMain(ctx){
  const {
    state,
    els,
    safeNum,
    engine,
    derivedWeeksRemaining,
    deriveNeedVotes,
    computeElectionSnapshot,
    computeExecutionSnapshot,
    computeWeeklyOpsContext,
    setLastRenderCtx,
    setLastResultsSnapshot,
    fmtInt,
    setText,
    safeCall,
    renderStress,
    renderValidation,
    renderAssumptions,
    renderGuardrails,
    renderConversion,
    renderPhase3,
    renderWeeklyOps,
    renderWeeklyOpsInsights,
    renderWeeklyOpsFreshness,
    scheduleOperationsCapacityOutlookRender,
    renderAssumptionDriftE1,
    renderRiskFramingE2,
    renderBottleneckAttributionE3,
    renderSensitivitySnapshotE4,
    renderDecisionConfidenceE5,
    renderImpactTraceE6,
    renderUniverse16Card,
    renderRoi,
    renderOptimization,
    renderTimeline,
    renderDecisionIntelligencePanel,
  } = ctx || {};

  let planningSnapshot = null;
  try{
    planningSnapshot = (typeof computeElectionSnapshot === "function")
      ? computeElectionSnapshot({ state, nowDate: new Date(), toNum: safeNum })
      : null;
  } catch {
    planningSnapshot = null;
  }

  let modelInput = planningSnapshot?.modelInput || null;
  let res = planningSnapshot?.res || null;
  let weeks = planningSnapshot?.weeks ?? null;
  let needVotes = (planningSnapshot?.needVotes != null) ? planningSnapshot.needVotes : null;

  if (!res){
    const modelInputFallback = buildModelInputFromState(state, safeNum);
    const resFallback = engine.computeAll(modelInputFallback);
    const weeksFallback = (typeof derivedWeeksRemaining === "function") ? derivedWeeksRemaining() : null;
    const needVotesFallback = (typeof deriveNeedVotes === "function") ? deriveNeedVotes(resFallback) : null;

    modelInput = modelInputFallback;
    res = resFallback;
    weeks = weeksFallback;
    needVotes = needVotesFallback;
  }

  if (!res){
    return;
  }

  const weeklyContext = (typeof computeWeeklyOpsContext === "function")
    ? (computeWeeklyOpsContext(res, weeks) || null)
    : null;
  const expectedAPH = computeExpectedAphFromWeeklyContext(weeklyContext);

  let executionSnapshot = null;
  try{
    executionSnapshot = (typeof computeExecutionSnapshot === "function")
      ? computeExecutionSnapshot({
          planningSnapshot: planningSnapshot || { weeks },
          weeklyContext,
          dailyLog: state?.ui?.dailyLog || [],
          assumedCR: weeklyContext?.cr ?? null,
          assumedSR: weeklyContext?.sr ?? null,
          expectedAPH,
          windowN: 7,
          safeNumFn: safeNum,
        })
      : null;
  } catch {
    executionSnapshot = null;
  }

  setLastRenderCtx({
    res,
    weeks,
    needVotes,
    modelInput,
    planningSnapshot,
    weeklyContext,
    executionSnapshot,
  });

  setText(els.turnoutExpected, buildOutcomeTurnoutExpectedText(res.turnout.expectedPct));
  setText(els.turnoutBand, buildOutcomeTurnoutBandText(res.turnout.bestPct, res.turnout.worstPct));
  setText(els.votesPer1pct, fmtInt(res.turnout.votesPer1pct));

  setText(els.supportTotal, buildOutcomeSupportTotalText(res.validation.supportTotalPct));

  if (els.candWarn){
    els.candWarn.hidden = !!res.validation.candidateTableOk;
    els.candWarn.textContent = res.validation.candidateTableOk ? "" : (res.validation.candidateTableMsg || "");
  }

  const expectedVoteTexts = buildOutcomeExpectedVoteTexts(res.expected, { formatInt: fmtInt });

  setText(els.kpiTurnoutVotesSidebar, expectedVoteTexts.turnoutVotesText);
  setText(els.kpiTurnoutBandSidebar, res.turnout.bandVotesText || "—");

  setText(els.kpiWinThresholdSidebar, expectedVoteTexts.winThresholdText);
  setText(els.kpiYourVotesSidebar, expectedVoteTexts.yourVotesText);
  setText(els.kpiYourVotesShareSidebar, res.expected.yourShareText || "—");

  setText(els.kpiPersuasionNeedSidebar, expectedVoteTexts.persuasionNeedText);
  setText(els.kpiPersuasionStatusSidebar, res.expected.persuasionStatus || "—");

  setText(els.miniEarlyVotesSidebar, expectedVoteTexts.earlyVotesText);
  setText(els.miniEDVotesSidebar, expectedVoteTexts.edVotesText);
  setText(els.miniEarlyNoteSidebar, res.expected.earlyNote || "—");

  setText(els.miniPersUniverseSidebar, expectedVoteTexts.persuasionUniverseText);
  setText(els.miniPersCheckSidebar, res.expected.persuasionUniverseCheck || "—");

  const run = (label, fn) => safeCall(fn, { label });
  run("render.stress", () => renderStress(res));
  run("render.validation", () => renderValidation(res, weeks));
  run("render.assumptions", () => renderAssumptions(res, weeks));
  run("render.guardrails", () => renderGuardrails(res));
  run("render.conversion", () => renderConversion(res, weeks));
  run("render.phase3", () => renderPhase3(res, weeks));
  run("render.weeklyOps", () => renderWeeklyOps(res, weeks, { weeklyContext, executionSnapshot }));
  run("render.weeklyOpsInsights", () => renderWeeklyOpsInsights(res, weeks, { weeklyContext, executionSnapshot }));
  run("render.weeklyOpsFreshness", () => renderWeeklyOpsFreshness(res, weeks, { weeklyContext, executionSnapshot }));
  run("render.operationsCapacityOutlook", () => scheduleOperationsCapacityOutlookRender(weeks));
  run("render.assumptionDriftE1", () => renderAssumptionDriftE1(res, weeks, { weeklyContext, executionSnapshot }));
  run("render.riskFramingE2", () => renderRiskFramingE2());
  run("render.bottleneckAttributionE3", () => renderBottleneckAttributionE3(res, weeks));
  run("render.sensitivitySnapshotE4", () => renderSensitivitySnapshotE4());
  run("render.decisionConfidenceE5", () => renderDecisionConfidenceE5(res, weeks, { weeklyContext, executionSnapshot }));
  run("render.impactTraceE6", () => renderImpactTraceE6(res, weeks, { weeklyContext, executionSnapshot }));
  run("render.censusPhase1", () => renderCensusPhase1Safe({ els, state, res }));

  run("render.universe16", () => renderUniverse16Card());

  run("render.roi", () => renderRoi(res, weeks));
  run("render.optimization", () => renderOptimization(res, weeks));
  run("render.timeline", () => renderTimeline(res, weeks));
  run("render.decisionIntelligencePanel", () => renderDecisionIntelligencePanel({ res, weeks }));

  let nextSnapshot = null;
  try{
    nextSnapshot = {
      schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
      appVersion: engine.snapshot.MODEL_VERSION,
      modelVersion: engine.snapshot.MODEL_VERSION,
      scenarioState: structuredClone(state),
      planRows: structuredClone(state.ui?.lastPlanRows || []),
      planMeta: structuredClone(state.ui?.lastPlanMeta || {}),
      summary: structuredClone(state.ui?.lastSummary || {})
    };
    nextSnapshot.snapshotHash = engine.snapshot.computeSnapshotHash({
      modelVersion: engine.snapshot.MODEL_VERSION,
      scenarioState: nextSnapshot.scenarioState
    });
  } catch {
    nextSnapshot = null;
  }
  setLastResultsSnapshot(nextSnapshot);

  setText(els.snapshotHash, nextSnapshot?.snapshotHash || "—");
  setText(els.snapshotHashSidebar, nextSnapshot?.snapshotHash || "—");
  if (els.explainCard){
    els.explainCard.hidden = !state.ui.training;
  }
}
