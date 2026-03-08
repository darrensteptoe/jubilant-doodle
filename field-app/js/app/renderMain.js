// @ts-check
import { buildModelInputFromState } from "./modelInput.js";

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
  const expectedAPH = (
    weeklyContext?.doorShare != null &&
    weeklyContext?.doorsPerHour != null &&
    weeklyContext?.callsPerHour != null
  )
    ? (weeklyContext.doorShare * weeklyContext.doorsPerHour + (1 - weeklyContext.doorShare) * weeklyContext.callsPerHour)
    : null;

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

  const fmtSignedInt = (v) => {
    if (v == null || !isFinite(v)) return "—";
    const n = Math.round(v);
    if (n === 0) return "0";
    const sign = n > 0 ? "+" : "-";
    return `${sign}${fmtInt(Math.abs(n))}`;
  };
  const fmtSignedPp = (v) => {
    if (v == null || !isFinite(v)) return "—";
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)} pp`;
  };
  const toMs = (v) => {
    if (v == null || v === "") return null;
    const ms = new Date(v).getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  els.turnoutExpected.textContent = res.turnout.expectedPct == null ? "—" : `${res.turnout.expectedPct.toFixed(1)}%`;
  els.turnoutBand.textContent = res.turnout.bestPct == null ? "—" : `${res.turnout.bestPct.toFixed(1)}% / ${res.turnout.worstPct.toFixed(1)}%`;
  els.votesPer1pct.textContent = (res.turnout.votesPer1pct == null) ? "—" : fmtInt(res.turnout.votesPer1pct);

  els.supportTotal.textContent = res.validation.supportTotalPct == null ? "—" : `${res.validation.supportTotalPct.toFixed(1)}%`;

  els.candWarn.hidden = res.validation.candidateTableOk;
  els.candWarn.textContent = res.validation.candidateTableOk ? "" : res.validation.candidateTableMsg;

  setText(els.kpiTurnoutVotesSidebar, res.expected.turnoutVotes == null ? "—" : fmtInt(res.expected.turnoutVotes));
  setText(els.kpiTurnoutBandSidebar, res.turnout.bandVotesText || "—");

  setText(els.kpiWinThresholdSidebar, res.expected.winThreshold == null ? "—" : fmtInt(res.expected.winThreshold));
  setText(els.kpiYourVotesSidebar, res.expected.yourVotes == null ? "—" : fmtInt(res.expected.yourVotes));
  setText(els.kpiYourVotesShareSidebar, res.expected.yourShareText || "—");

  setText(els.kpiPersuasionNeedSidebar, res.expected.persuasionNeed == null ? "—" : fmtInt(res.expected.persuasionNeed));
  setText(els.kpiPersuasionStatusSidebar, res.expected.persuasionStatus || "—");

  setText(els.miniEarlyVotesSidebar, res.expected.earlyVotes == null ? "—" : fmtInt(res.expected.earlyVotes));
  setText(els.miniEDVotesSidebar, res.expected.edVotes == null ? "—" : fmtInt(res.expected.edVotes));
  setText(els.miniEarlyNoteSidebar, res.expected.earlyNote || "—");

  setText(els.miniPersUniverseSidebar, res.expected.persuasionUniverse == null ? "—" : fmtInt(res.expected.persuasionUniverse));
  setText(els.miniPersCheckSidebar, res.expected.persuasionUniverseCheck || "—");
  setText(els.metaUniverseBasis, state.universeBasis || "—");
  setText(els.metaSourceNote, state.sourceNote || "—");

  const yourVotes = safeNum(res?.expected?.yourVotes);
  const winThreshold = safeNum(res?.expected?.winThreshold);
  const projectedMarginVotes = (yourVotes != null && winThreshold != null) ? (yourVotes - (winThreshold - 1)) : null;
  const winProb = safeNum(state?.mcLast?.winProb);
  const votesNeeded = (needVotes == null || !isFinite(needVotes)) ? null : Math.max(0, Math.round(needVotes));
  const coverageRatio = (weeklyContext?.attemptsPerWeek != null && weeklyContext?.attemptsPerWeek > 0 && weeklyContext?.capTotal != null)
    ? (weeklyContext.capTotal / weeklyContext.attemptsPerWeek)
    : null;
  const contactCapacityConstrained = (coverageRatio != null) ? coverageRatio < 1 : (weeklyContext?.gap != null && weeklyContext.gap > 0);
  const persuasionNeed = safeNum(res?.expected?.persuasionNeed);
  const persuasionUniverse = safeNum(res?.expected?.persuasionUniverse);
  const persuasionLimitReached = persuasionNeed != null && persuasionUniverse != null && persuasionNeed > persuasionUniverse;
  const turnoutBaseline = safeNum((state?.turnoutTargetOverridePct != null && state.turnoutTargetOverridePct !== "") ? state.turnoutTargetOverridePct : state?.turnoutBaselinePct);
  const configuredLift = safeNum((state?.gotvMode === "advanced") ? state?.gotvLiftMode : state?.gotvLiftPP);
  const maxLift = safeNum((state?.gotvMode === "advanced") ? state?.gotvMaxLiftPP2 : state?.gotvMaxLiftPP);
  const turnoutHeadroom = (turnoutBaseline == null) ? null : Math.max(0, 100 - turnoutBaseline);
  const turnoutLiftLimit = !!state?.turnoutEnabled && (
    (maxLift != null && turnoutHeadroom != null && maxLift >= (turnoutHeadroom - 0.1)) ||
    (configuredLift != null && configuredLift >= 1.8 && (persuasionNeed ?? 0) > 0)
  );

  let bottleneckLabel = "Balanced";
  if (contactCapacityConstrained) bottleneckLabel = "Organizer constrained";
  else if (persuasionLimitReached) bottleneckLabel = "Persuasion limited";
  else if (turnoutLiftLimit) bottleneckLabel = "Turnout limited";

  let reachStatus = "Balanced";
  if (contactCapacityConstrained) reachStatus = "Organizer constrained";
  else if (coverageRatio != null && coverageRatio >= 1.05) reachStatus = "Ahead of pace";
  else if (coverageRatio != null) reachStatus = "On pace";

  let outcomeStatus = "Monitoring";
  if (winProb != null){
    if (winProb >= 0.7) outcomeStatus = "Strong";
    else if (winProb >= 0.5) outcomeStatus = "Competitive";
    else outcomeStatus = "At risk";
  }

  setText(els.kpiWinProb, winProb == null ? "—" : `${(winProb * 100).toFixed(1)}%`);
  setText(els.kpiMargin, projectedMarginVotes == null ? "—" : `${fmtSignedInt(projectedMarginVotes)} votes`);
  setText(els.kpiVotesNeeded, votesNeeded == null ? "—" : fmtInt(votesNeeded));
  setText(els.kpiBottleneck, bottleneckLabel);
  setText(els.kpiPathTag, bottleneckLabel);

  setText(els.districtSummaryUniverse, res.raw.universeSize == null ? "—" : fmtInt(res.raw.universeSize));
  setText(els.districtSummaryTurnout, (res.turnout.expectedPct == null || res.expected.turnoutVotes == null) ? "—" : `${res.turnout.expectedPct.toFixed(1)}% (${fmtInt(res.expected.turnoutVotes)} votes)`);
  setText(els.districtSummaryNeed, votesNeeded == null ? "—" : fmtInt(votesNeeded));
  setText(els.districtSummaryPath, bottleneckLabel);
  setText(els.reachStatusTag, reachStatus);
  setText(els.outcomeStatusTag, outcomeStatus);

  if (!state.ui) state.ui = {};
  const prevWinProb = safeNum(state.ui?.inspectorPrev?.winProb);
  const prevMarginVotes = safeNum(state.ui?.inspectorPrev?.marginVotes);
  const deltaWinPp = (winProb != null && prevWinProb != null) ? ((winProb - prevWinProb) * 100) : null;
  const deltaMarginVotes = (projectedMarginVotes != null && prevMarginVotes != null) ? (projectedMarginVotes - prevMarginVotes) : null;

  setText(els.inspectorDeltaWinProb, fmtSignedPp(deltaWinPp));
  setText(els.inspectorDeltaMargin, deltaMarginVotes == null ? "—" : `${fmtSignedInt(deltaMarginVotes)} votes`);

  const persuasionAssumption = safeNum(state?.supportRatePct);
  const contactAssumption = safeNum(state?.contactRatePct);
  setText(els.inspectorAssumptionPersuasion, persuasionAssumption == null ? "—" : `${persuasionAssumption.toFixed(1)}%`);
  setText(els.inspectorAssumptionContact, contactAssumption == null ? "—" : `${contactAssumption.toFixed(1)}%`);
  setText(els.inspectorAssumptionTurnout, !!state?.turnoutEnabled
    ? (configuredLift == null ? "—" : `${configuredLift.toFixed(1)} pp`)
    : "Off");

  const evidenceRows = Array.isArray(state?.intelState?.evidence) ? state.intelState.evidence : [];
  let latestEvidenceMs = null;
  for (const row of evidenceRows){
    const ms = toMs(row?.capturedAt) ?? toMs(row?.updatedAt) ?? toMs(row?.createdAt) ?? toMs(row?.ts);
    if (ms == null) continue;
    if (latestEvidenceMs == null || ms > latestEvidenceMs) latestEvidenceMs = ms;
  }
  const mcRunMs = toMs(state?.ui?.mcMeta?.lastRunAt);
  const lastRefreshMs = [latestEvidenceMs, mcRunMs].reduce((acc, ms) => {
    if (ms == null) return acc;
    if (acc == null || ms > acc) return ms;
    return acc;
  }, null);
  const evidenceAgeDays = (latestEvidenceMs == null) ? null : Math.max(0, Math.floor((Date.now() - latestEvidenceMs) / 86400000));
  const sourceType = state?.sourceNote ? "Scenario source note" : (state?.universeBasis === "active" ? "Active universe" : "Registered universe");

  setText(els.inspectorSourceAge, evidenceAgeDays == null ? "No evidence" : `${evidenceAgeDays}d old`);
  setText(els.inspectorSourceRefresh, lastRefreshMs == null ? "—" : new Date(lastRefreshMs).toLocaleString());
  setText(els.inspectorSourceType, sourceType);

  let warningText = "No critical warnings.";
  let nextAction = "Maintain plan and refresh evidence";
  if (contactCapacityConstrained){
    warningText = coverageRatio == null ? "Coverage is below target." : `Coverage is below target (${Math.round(coverageRatio * 100)}%).`;
    nextAction = "Increase organizer staffing";
  } else if (persuasionLimitReached){
    warningText = "Required persuasion exceeds modeled movable universe.";
    nextAction = "Re-evaluate persuasion assumption";
  } else if (turnoutLiftLimit){
    warningText = "Outcome is highly dependent on turnout lift assumptions.";
    nextAction = "Expand turnout program";
  } else if (winProb != null && winProb < 0.5){
    warningText = "Current win probability is below 50%.";
    nextAction = "Increase weekly production";
  }

  if (els.inspectorWarningBand){
    els.inspectorWarningBand.className = warningText === "No critical warnings." ? "banner ok" : "banner warn";
  }
  if (els.inspectorNextAction){
    els.inspectorNextAction.className = "banner";
  }
  setText(els.inspectorWarningBand, warningText);
  setText(els.inspectorNextAction, nextAction);

  state.ui.inspectorPrev = {
    winProb,
    marginVotes: projectedMarginVotes,
    updatedAt: new Date().toISOString(),
    scenarioName: state.scenarioName || "",
  };

  safeCall(() => renderStress(res));
  safeCall(() => renderValidation(res, weeks));
  safeCall(() => renderAssumptions(res, weeks));
  safeCall(() => renderGuardrails(res));
  safeCall(() => renderConversion(res, weeks));
  safeCall(() => renderPhase3(res, weeks));
  safeCall(() => renderWeeklyOps(res, weeks, { weeklyContext, executionSnapshot }));
  safeCall(() => renderWeeklyOpsInsights(res, weeks, { weeklyContext, executionSnapshot }));
  safeCall(() => renderWeeklyOpsFreshness(res, weeks, { weeklyContext, executionSnapshot }));
  safeCall(() => scheduleOperationsCapacityOutlookRender(weeks));
  safeCall(() => renderAssumptionDriftE1(res, weeks, { weeklyContext, executionSnapshot }));
  safeCall(() => renderRiskFramingE2());
  safeCall(() => renderBottleneckAttributionE3(res, weeks));
  safeCall(() => renderSensitivitySnapshotE4());
  safeCall(() => renderDecisionConfidenceE5(res, weeks, { weeklyContext, executionSnapshot }));
  safeCall(() => renderImpactTraceE6(res, weeks, { weeklyContext, executionSnapshot }));

  safeCall(() => renderUniverse16Card());

  safeCall(() => renderRoi(res, weeks));
  safeCall(() => renderOptimization(res, weeks));
  safeCall(() => renderTimeline(res, weeks));
  safeCall(() => renderDecisionIntelligencePanel({ res, weeks }));

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
  els.explainCard.hidden = !state.ui.training;
}
