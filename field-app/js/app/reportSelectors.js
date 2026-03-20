// @ts-check
import { safeNum } from "../core/utils.js";
import { getDoctrineModule } from "./moduleDoctrineRegistry.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function asObject(value){
  return value && typeof value === "object" ? value : {};
}

function asArray(value){
  return Array.isArray(value) ? value : [];
}

function toFiniteOrNull(value){
  const n = safeNum(value);
  return n == null ? null : n;
}

function resolveDecisionSession(state){
  const decision = asObject(state?.ui?.decision);
  const sessions = asObject(decision?.sessions);
  const activeId = cleanText(decision?.activeSessionId);
  if (activeId && sessions[activeId] && typeof sessions[activeId] === "object"){
    return sessions[activeId];
  }
  const ids = Object.keys(sessions);
  if (!ids.length) return null;
  const first = sessions[ids[0]];
  return first && typeof first === "object" ? first : null;
}

function resolveReadinessTopIssues(validationSnapshot){
  const readiness = asObject(validationSnapshot?.readiness);
  const issues = asArray(readiness?.issues);
  return issues
    .slice(0, 6)
    .map((row) => ({
      issueId: cleanText(row?.issueId),
      severity: cleanText(row?.severity),
      message: cleanText(row?.message || row?.title),
      fixPath: cleanText(row?.fixPath),
      domain: cleanText(row?.domain),
    }))
    .filter((row) => row.message);
}

/**
 * Canonical report selector snapshot.
 * This function only selects/normalizes already-computed canonical outputs.
 *
 * @param {{
 *   state?: Record<string, any>,
 *   renderCtx?: Record<string, any> | null,
 *   resultsSnapshot?: Record<string, any> | null,
 *   nowDate?: Date | null,
 * }} args
 */
export function buildReportSelectorSnapshot({
  state = {},
  renderCtx = null,
  resultsSnapshot = null,
  nowDate = null,
} = {}){
  const srcState = asObject(state);
  const ui = asObject(srcState?.ui);
  const summary = asObject(ui?.lastSummary);
  const turnout = asObject(renderCtx?.res?.turnout);
  const expected = asObject(renderCtx?.res?.expected);
  const validation = asObject(ui?.lastValidationSnapshot);
  const readiness = asObject(validation?.readiness);
  const governanceSnapshot = asObject(ui?.lastGovernanceSnapshot);
  const realism = asObject(ui?.lastRealismSnapshot);
  const warRoom = asObject(srcState?.warRoom);
  const weather = asObject(warRoom?.weather);
  const weatherAdjustment = asObject(warRoom?.weatherAdjustment);
  const eventCalendar = asObject(warRoom?.eventCalendar);
  const voterData = asObject(srcState?.voterData);
  const voterHistory = asObject(voterData?.latestHistoryIntelligence);
  const frequency = asObject(voterHistory?.frequencySegments);
  const age = asObject(voterHistory?.age);
  const campaignDataRequirements = asObject(getDoctrineModule("campaignDataRequirements"));
  const campaignDataSections = asObject(campaignDataRequirements?.sections);
  const durabilityTrustStandards = asObject(getDoctrineModule("durabilityTrustStandards"));
  const durabilitySections = asObject(durabilityTrustStandards?.sections);
  const candidateHistory = asArray(srcState?.candidateHistory);
  const tactics = asObject(srcState?.budget?.tactics);
  const decisionSession = resolveDecisionSession(srcState);
  const decisionWarRoom = asObject(decisionSession?.warRoom);
  const generatedAt = (nowDate instanceof Date ? nowDate : new Date()).toISOString();

  return {
    generatedAt,
    context: {
      campaignId: cleanText(srcState?.campaignId),
      campaignName: cleanText(srcState?.campaignName),
      officeId: cleanText(srcState?.officeId),
      scenarioId: cleanText(ui?.activeScenarioId || srcState?.scenarioId),
      scenarioName: cleanText(srcState?.scenarioName),
    },
    forecast: {
      weeksRemaining: toFiniteOrNull(renderCtx?.weeks),
      turnoutExpectedPct: toFiniteOrNull(turnout?.expectedPct),
      turnoutVotes: toFiniteOrNull(expected?.turnoutVotes),
      winThreshold: toFiniteOrNull(expected?.winThreshold),
      yourVotes: toFiniteOrNull(expected?.yourVotes),
      persuasionNeed: toFiniteOrNull(expected?.persuasionNeed),
      winProb: toFiniteOrNull(srcState?.mcLast?.winProb),
      p10Margin: toFiniteOrNull(srcState?.mcLast?.confidenceEnvelope?.percentiles?.p10),
      p50Margin: toFiniteOrNull(srcState?.mcLast?.confidenceEnvelope?.percentiles?.p50),
      p90Margin: toFiniteOrNull(srcState?.mcLast?.confidenceEnvelope?.percentiles?.p90),
    },
    strategicPosition: {
      objective: cleanText(summary?.objective),
      objectiveValue: toFiniteOrNull(summary?.objectiveValue),
      objectiveGap: toFiniteOrNull(summary?.objectiveGap),
      primaryBottleneck: cleanText(summary?.primaryBottleneck),
      topAllocations: asArray(summary?.topAllocations).map((row) => cleanText(row)).filter(Boolean),
    },
    targeting: {
      modelId: cleanText(srcState?.targeting?.modelId || srcState?.targeting?.presetId),
      topN: toFiniteOrNull(srcState?.targeting?.topN),
      rowCount: toFiniteOrNull(srcState?.targeting?.lastRows?.length),
      supportRatePct: toFiniteOrNull(srcState?.supportRatePct),
      contactRatePct: toFiniteOrNull(srcState?.contactRatePct),
      turnoutReliabilityPct: toFiniteOrNull(srcState?.turnoutReliabilityPct),
      persuasionPct: toFiniteOrNull(srcState?.persuasionPct),
      universeSize: toFiniteOrNull(srcState?.universeSize),
    },
    workforce: {
      organizerCount: toFiniteOrNull(srcState?.orgCount),
      organizerHoursPerWeek: toFiniteOrNull(srcState?.orgHoursPerWeek),
      volunteerMultiplier: toFiniteOrNull(srcState?.volunteerMultBase),
      roleTypingCoveragePct: toFiniteOrNull(ui?.twCapOutlookLatest?.workforce?.roleTypingCoveragePct),
      activeHeadcount: toFiniteOrNull(ui?.twCapOutlookLatest?.workforce?.activeHeadcount),
      missingRoleTypedCount: toFiniteOrNull(ui?.twCapOutlookLatest?.workforce?.missingRoleTypedCount),
    },
    budget: {
      objective: cleanText(srcState?.budget?.optimize?.objective),
      includeOverhead: !!srcState?.budget?.includeOverhead,
      overheadAmount: toFiniteOrNull(srcState?.budget?.overheadAmount),
      tactics: {
        doors: {
          enabled: !!tactics?.doors?.enabled,
          cpa: toFiniteOrNull(tactics?.doors?.cpa),
          kind: cleanText(tactics?.doors?.kind),
        },
        phones: {
          enabled: !!tactics?.phones?.enabled,
          cpa: toFiniteOrNull(tactics?.phones?.cpa),
          kind: cleanText(tactics?.phones?.kind),
        },
        texts: {
          enabled: !!tactics?.texts?.enabled,
          cpa: toFiniteOrNull(tactics?.texts?.cpa),
          kind: cleanText(tactics?.texts?.kind),
        },
        mail: {
          enabled: !!tactics?.mail?.enabled,
          cpa: toFiniteOrNull(tactics?.mail?.cpa),
          kind: cleanText(tactics?.mail?.kind),
        },
      },
    },
    readiness: {
      score: toFiniteOrNull(validation?.readinessScore),
      band: cleanText(validation?.readinessBand || readiness?.band),
      counts: asObject(readiness?.counts),
      topIssues: resolveReadinessTopIssues(validation),
    },
    realism: {
      score: toFiniteOrNull(realism?.score),
      classification: cleanText(realism?.classification),
      status: cleanText(realism?.status),
      warnings: asArray(realism?.warnings).slice(0, 8).map((row) => cleanText(row)).filter(Boolean),
      flaggedAssumptions: asArray(realism?.flaggedAssumptions).slice(0, 8),
    },
    governance: {
      confidenceBand: cleanText(governanceSnapshot?.confidenceBand),
      confidenceScore: toFiniteOrNull(governanceSnapshot?.confidenceScore),
      dataQualityStatus: cleanText(governanceSnapshot?.dataQualityStatus),
      dataQualityScore: toFiniteOrNull(governanceSnapshot?.dataQualityScore),
      executionStatus: cleanText(governanceSnapshot?.executionStatus),
      executionScore: toFiniteOrNull(governanceSnapshot?.executionScore),
      topWarning: cleanText(governanceSnapshot?.topWarning),
      learningRecommendation: cleanText(governanceSnapshot?.learningRecommendation),
    },
    scenario: {
      activeScenarioId: cleanText(ui?.activeScenarioId),
      registrySize: Object.keys(asObject(ui?.scenarios)).length,
      candidateHistoryRecordCount: candidateHistory.length,
      candidateHistoryCoverageBand: cleanText(renderCtx?.res?.validation?.candidateHistory?.coverageBand),
      candidateHistoryConfidenceBand: cleanText(renderCtx?.res?.validation?.candidateHistory?.confidenceBand),
    },
    warRoom: {
      decisionOwner: cleanText(decisionWarRoom?.owner),
      followUpDate: cleanText(decisionWarRoom?.followUpDate),
      decisionSummary: cleanText(decisionWarRoom?.decisionSummary),
      decisionLogCount: asArray(decisionWarRoom?.decisionLog).length,
      weatherZip: cleanText(weather?.selectedZip),
      weatherStatus: cleanText(weather?.status),
      weatherCondition: cleanText(weather?.current?.condition),
      weatherMode: cleanText(weatherAdjustment?.mode || "observe_only"),
    },
    events: {
      totalEvents: asArray(eventCalendar?.events).length,
      todayEvents: asArray(eventCalendar?.events).filter((row) => cleanText(row?.date) === cleanText(warRoom?.dateContext)).length,
      appliedCampaignEvents: asArray(eventCalendar?.events).filter((row) => row?.category === "campaign" && !!row?.applyToModel).length,
    },
    voterIntelligence: {
      rowCount: toFiniteOrNull(voterData?.rows?.length),
      ageSource: cleanText(age?.source),
      ageCoverageRate: toFiniteOrNull(age?.knownAgeCoverageRate),
      ageOpportunityBucket: cleanText(age?.opportunityBucketLabel),
      ageTurnoutRiskBucket: cleanText(age?.turnoutRiskBucketLabel),
      superVoters: toFiniteOrNull(frequency?.superVoters),
      highFrequencyVoters: toFiniteOrNull(frequency?.highFrequencyVoters),
      lowFrequencyVoters: toFiniteOrNull(frequency?.lowFrequencyVoters),
      dropoffVoters: toFiniteOrNull(frequency?.dropoffVoters),
    },
    manual: {
      campaignDataRequirementsSummary: cleanText(campaignDataRequirements?.summary),
      campaignRequirementsCadence: cleanText(campaignDataSections?.rangesExplained),
      durabilityTrustSummary: cleanText(durabilityTrustStandards?.summary),
      durabilityTrustStandards: cleanText(durabilitySections?.parametersExplained),
    },
    sources: {
      hasResultsSnapshot: !!(resultsSnapshot && typeof resultsSnapshot === "object"),
      hasRenderCtx: !!(renderCtx && typeof renderCtx === "object"),
      snapshotHash: cleanText(resultsSnapshot?.snapshotHash),
      schemaVersion: cleanText(resultsSnapshot?.schemaVersion),
      appVersion: cleanText(resultsSnapshot?.appVersion),
      buildId: cleanText(resultsSnapshot?.buildId),
    },
  };
}
