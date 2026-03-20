// @ts-check
import { formatFixedNumber, formatPercentFromPct, formatPercentFromUnit, formatWholeNumberByMode } from "../core/utils.js";
import { getReportSectionLabel } from "./reportRegistry.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function fmtWhole(value){
  if (!Number.isFinite(Number(value))) return "—";
  return formatWholeNumberByMode(Number(value), { mode: "round", fallback: "—" });
}

function fmtPct(value){
  if (!Number.isFinite(Number(value))) return "—";
  return formatPercentFromPct(Number(value), 1, "—");
}

function fmtUnitPct(value){
  if (!Number.isFinite(Number(value))) return "—";
  return formatPercentFromUnit(Number(value), 1, "—");
}

function fmtScore(value){
  if (!Number.isFinite(Number(value))) return "—";
  return formatFixedNumber(Number(value), 1, "—");
}

/**
 * @param {{
 *   generatedAt?: string,
 *   context?: Record<string, any>,
 *   forecast?: Record<string, any>,
 *   strategicPosition?: Record<string, any>,
 *   targeting?: Record<string, any>,
 *   workforce?: Record<string, any>,
 *   budget?: Record<string, any>,
 *   readiness?: Record<string, any>,
 *   realism?: Record<string, any>,
 *   governance?: Record<string, any>,
 *   scenario?: Record<string, any>,
 *   warRoom?: Record<string, any>,
 *   events?: Record<string, any>,
 *   voterIntelligence?: Record<string, any>,
 *   manual?: Record<string, any>,
 * }} snapshot
 * @param {{ reportDefinition?: Record<string, any> }=} options
 */
export function composeInternalReport(snapshot = {}, { reportDefinition = null } = {}){
  const context = snapshot?.context || {};
  const forecast = snapshot?.forecast || {};
  const strategic = snapshot?.strategicPosition || {};
  const targeting = snapshot?.targeting || {};
  const workforce = snapshot?.workforce || {};
  const budget = snapshot?.budget || {};
  const readiness = snapshot?.readiness || {};
  const realism = snapshot?.realism || {};
  const governance = snapshot?.governance || {};
  const scenario = snapshot?.scenario || {};
  const warRoom = snapshot?.warRoom || {};
  const events = snapshot?.events || {};
  const voterIntelligence = snapshot?.voterIntelligence || {};
  const manual = snapshot?.manual || {};

  const titleCampaign = cleanText(context?.campaignName || context?.campaignId || "Campaign");
  const reportLabel = cleanText(reportDefinition?.label || "Internal Report");

  const sections = [
    {
      id: "executiveSummary",
      title: getReportSectionLabel("executiveSummary"),
      lines: [
        `Context: ${titleCampaign} | office ${cleanText(context?.officeId || "—")} | scenario ${cleanText(context?.scenarioName || context?.scenarioId || "—")}.`,
        `Forecast: win probability ${fmtUnitPct(forecast?.winProb)}, turnout expected ${fmtPct(forecast?.turnoutExpectedPct)}, persuasion need ${fmtWhole(forecast?.persuasionNeed)}.`,
        `Readiness ${cleanText(readiness?.band || "unknown")} (${fmtScore(readiness?.score)}/100), realism ${cleanText(realism?.classification || "unknown")} (${fmtScore(realism?.score)}/100), governance confidence ${cleanText(governance?.confidenceBand || "unknown")} (${fmtScore(governance?.confidenceScore)}/100).`,
      ],
    },
    {
      id: "strategicPosition",
      title: getReportSectionLabel("strategicPosition"),
      lines: [
        `Objective: ${cleanText(strategic?.objective || "—")} | value ${fmtWhole(strategic?.objectiveValue)} | gap ${fmtWhole(strategic?.objectiveGap)}.`,
        `Primary bottleneck: ${cleanText(strategic?.primaryBottleneck || "—")}.`,
        `Top allocations: ${Array.isArray(strategic?.topAllocations) && strategic.topAllocations.length ? strategic.topAllocations.join(" | ") : "—"}.`,
      ],
    },
    {
      id: "targetingUniverseSummary",
      title: getReportSectionLabel("targetingUniverseSummary"),
      lines: [
        `Targeting model: ${cleanText(targeting?.modelId || "—")} | top N ${fmtWhole(targeting?.topN)} | scored rows ${fmtWhole(targeting?.rowCount)}.`,
        `Universe size ${fmtWhole(targeting?.universeSize)} | support ${fmtPct(targeting?.supportRatePct)} | contact ${fmtPct(targeting?.contactRatePct)} | turnout reliability ${fmtPct(targeting?.turnoutReliabilityPct)}.`,
        `Voter-history intelligence: super ${fmtWhole(voterIntelligence?.superVoters)}, high ${fmtWhole(voterIntelligence?.highFrequencyVoters)}, low ${fmtWhole(voterIntelligence?.lowFrequencyVoters)}, dropoff ${fmtWhole(voterIntelligence?.dropoffVoters)}.`,
        `Age cohorts: source ${cleanText(voterIntelligence?.ageSource || "unknown")} | coverage ${fmtUnitPct(voterIntelligence?.ageCoverageRate)} | opportunity ${cleanText(voterIntelligence?.ageOpportunityBucket || "unknown")} | turnout risk ${cleanText(voterIntelligence?.ageTurnoutRiskBucket || "unknown")}.`,
      ],
    },
    {
      id: "fieldWorkforceSummary",
      title: getReportSectionLabel("fieldWorkforceSummary"),
      lines: [
        `Organizers ${fmtWhole(workforce?.organizerCount)} @ ${fmtWhole(workforce?.organizerHoursPerWeek)} hrs/week | volunteer multiplier ${fmtScore(workforce?.volunteerMultiplier)}.`,
        `Role typing coverage ${fmtPct(workforce?.roleTypingCoveragePct)} | active headcount ${fmtWhole(workforce?.activeHeadcount)} | missing role-typed ${fmtWhole(workforce?.missingRoleTypedCount)}.`,
        `War Room ownership: owner ${cleanText(warRoom?.decisionOwner || "—")} | follow-up ${cleanText(warRoom?.followUpDate || "—")} | decision log entries ${fmtWhole(warRoom?.decisionLogCount)}.`,
      ],
    },
    {
      id: "budgetChannelStrategySummary",
      title: getReportSectionLabel("budgetChannelStrategySummary"),
      lines: [
        `Budget objective ${cleanText(budget?.objective || "—")} | overhead ${budget?.includeOverhead ? "on" : "off"} (${fmtWhole(budget?.overheadAmount)}).`,
        `Doors: ${budget?.tactics?.doors?.enabled ? "on" : "off"} @ ${fmtWhole(budget?.tactics?.doors?.cpa)} | Phones: ${budget?.tactics?.phones?.enabled ? "on" : "off"} @ ${fmtWhole(budget?.tactics?.phones?.cpa)} | Texts: ${budget?.tactics?.texts?.enabled ? "on" : "off"} @ ${fmtWhole(budget?.tactics?.texts?.cpa)} | Mail: ${budget?.tactics?.mail?.enabled ? "on" : "off"} @ ${fmtWhole(budget?.tactics?.mail?.cpa)}.`,
        `Realism posture: ${cleanText(realism?.classification || "unknown")} | top warning ${cleanText(realism?.warnings?.[0] || "none")}.`,
      ],
    },
    {
      id: "turnoutGotvRisk",
      title: getReportSectionLabel("turnoutGotvRisk"),
      lines: [
        `Turnout expected ${fmtPct(forecast?.turnoutExpectedPct)} | votes ${fmtWhole(forecast?.turnoutVotes)} | threshold ${fmtWhole(forecast?.winThreshold)} | projected your votes ${fmtWhole(forecast?.yourVotes)}.`,
        `Weather context: ZIP ${cleanText(warRoom?.weatherZip || "—")} | status ${cleanText(warRoom?.weatherStatus || "—")} | condition ${cleanText(warRoom?.weatherCondition || "—")} | mode ${cleanText(warRoom?.weatherMode || "observe_only")}.`,
        `Events: total ${fmtWhole(events?.totalEvents)} | campaign events applying to model ${fmtWhole(events?.appliedCampaignEvents)}.`,
      ],
    },
    {
      id: "scenarioSummary",
      title: getReportSectionLabel("scenarioSummary"),
      lines: [
        `Active scenario ${cleanText(scenario?.activeScenarioId || "—")} | scenario registry size ${fmtWhole(scenario?.registrySize)}.`,
        `Candidate-history baseline rows ${fmtWhole(scenario?.candidateHistoryRecordCount)} | coverage ${cleanText(scenario?.candidateHistoryCoverageBand || "unknown")} | confidence ${cleanText(scenario?.candidateHistoryConfidenceBand || "unknown")}.`,
        `Forecast band p10/p50/p90 margin: ${fmtScore(forecast?.p10Margin)} / ${fmtScore(forecast?.p50Margin)} / ${fmtScore(forecast?.p90Margin)}.`,
      ],
    },
    {
      id: "recommendedActions",
      title: getReportSectionLabel("recommendedActions"),
      lines: [
        readiness?.topIssues?.[0]?.message
          ? `Fix first readiness issue: ${cleanText(readiness.topIssues[0].message)}${cleanText(readiness.topIssues[0].fixPath) ? ` (Fix path: ${cleanText(readiness.topIssues[0].fixPath)}).` : ""}`
          : "Fix path: no blocking readiness issue recorded.",
        cleanText(governance?.topWarning)
          ? `Address governance warning: ${cleanText(governance.topWarning)}.`
          : "Governance warning surface is clear.",
        cleanText(warRoom?.decisionSummary)
          ? `Execute War Room decision summary: ${cleanText(warRoom.decisionSummary)}.`
          : "Capture a War Room decision summary and owner for next checkpoint.",
        cleanText(governance?.learningRecommendation)
          ? `Learning loop recommendation: ${cleanText(governance.learningRecommendation)}.`
          : "Learning loop recommendation unavailable; continue recording certified outcomes.",
      ],
    },
    {
      id: "methodologyAppendix",
      title: getReportSectionLabel("methodologyAppendix"),
      lines: [
        "All sections consume canonical state and output snapshots; no parallel forecast math is computed in report composition.",
        "Trust framing reflects canonical readiness, realism, governance, and scenario-state diagnostics.",
        `Campaign data requirements reference: ${cleanText(manual?.campaignDataRequirementsSummary || "not available")}.`,
        `Durability and trust standards reference: ${cleanText(manual?.durabilityTrustSummary || "not available")}.`,
        "When readiness/realism confidence is weak, recommendations are presented as conditional and explicitly risk-tagged.",
      ],
    },
  ];

  return {
    reportType: "internal",
    reportLabel,
    generatedAt: cleanText(snapshot?.generatedAt),
    title: `${reportLabel} — ${titleCampaign}`,
    context: snapshot?.context || {},
    sections,
    metadata: {
      readinessBand: cleanText(readiness?.band || "unknown"),
      realismClassification: cleanText(realism?.classification || "unknown"),
      confidenceBand: cleanText(governance?.confidenceBand || "unknown"),
    },
  };
}
