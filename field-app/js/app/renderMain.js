export function renderMain(ctx){
  const {
    state,
    els,
    safeNum,
    engine,
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

  const planningSnapshot = (typeof computeElectionSnapshot === "function")
    ? computeElectionSnapshot({ state, nowDate: new Date(), toNum: safeNum })
    : null;

  const modelInput = planningSnapshot?.modelInput || null;
  const res = planningSnapshot?.res || (modelInput ? engine.computeAll(modelInput) : null);
  const weeks = planningSnapshot?.weeks ?? null;
  const needVotes = planningSnapshot?.needVotes ?? null;

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

  const executionSnapshot = (typeof computeExecutionSnapshot === "function")
    ? computeExecutionSnapshot({
        planningSnapshot,
        weeklyContext,
        dailyLog: state?.ui?.dailyLog || [],
        assumedCR: weeklyContext?.cr ?? null,
        assumedSR: weeklyContext?.sr ?? null,
        expectedAPH,
        windowN: 7,
        safeNumFn: safeNum,
      })
    : null;

  setLastRenderCtx({
    res,
    weeks,
    needVotes,
    modelInput,
    planningSnapshot,
    weeklyContext,
    executionSnapshot,
  });

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
  safeCall(() => renderDecisionConfidenceE5(res, weeks));
  safeCall(() => renderImpactTraceE6(res, weeks));

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
