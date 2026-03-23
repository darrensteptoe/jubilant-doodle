export function syncOutcomeGovernanceSnapshot(context = {}) {
  const {
    governanceView,
    outcomeRiskLabel,
    outcomeFragilityIndex,
    outcomeGapNote,
    mcStatus,
    setText,
    formatOutcomeGovernanceSignal,
  } = context;

  if (
    typeof setText !== "function"
    || typeof formatOutcomeGovernanceSignal !== "function"
  ) {
    return;
  }

  const governance = governanceView && typeof governanceView === "object" ? governanceView : {};
  const status = mcStatus && typeof mcStatus === "object" ? mcStatus : {};

  const governanceRealism = formatOutcomeGovernanceSignal(governance.realismStatus, governance.realismScore);
  const governanceDataQuality = formatOutcomeGovernanceSignal(governance.dataQualityStatus, governance.dataQualityScore);
  const governanceConfidence = formatOutcomeGovernanceSignal(governance.confidenceBand, governance.confidenceScore);
  const governanceWarning = String(governance.executionTopIssue || governance.topWarning || "").trim() || "—";
  const governanceLearning = String(governance.learningTopSuggestion || "").trim() || "—";

  setText("v3OutcomeRiskFlagLabel", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagGrade", outcomeRiskLabel);
  setText("v3OutcomeRiskFlagFragility", outcomeFragilityIndex);
  setText("v3OutcomeRiskFlagGapNote", outcomeGapNote || "—");
  setText("v3OutcomeRiskFlagGovernanceRealism", governanceRealism);
  setText("v3OutcomeRiskFlagGovernanceData", governanceDataQuality);
  setText("v3OutcomeRiskFlagGovernanceConfidence", governanceConfidence);
  setText("v3OutcomeRiskFlagGovernanceWarning", governanceWarning);
  setText("v3OutcomeRiskFlagGovernanceLearning", governanceLearning);
  setText("v3OutcomeRiskFlagFresh", String(status.freshTag || "—"));
  setText("v3OutcomeRiskFlagLastRun", String(status.lastRun || "—"));
  setText("v3OutcomeRiskFlagStale", String(status.staleTag || "—"));
}
