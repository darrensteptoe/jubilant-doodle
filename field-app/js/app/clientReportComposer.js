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
export function composeClientReport(snapshot = {}, { reportDefinition = null } = {}){
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

  const campaignLabel = cleanText(context?.campaignName || context?.campaignId || "Campaign");
  const reportLabel = cleanText(reportDefinition?.label || "Client Report");
  const readinessBand = cleanText(readiness?.band || "unknown");
  const realismClass = cleanText(realism?.classification || "unknown");
  const confidenceBand = cleanText(governance?.confidenceBand || "unknown");

  const sections = [
    {
      id: "executiveSummary",
      title: getReportSectionLabel("executiveSummary"),
      lines: [
        `${campaignLabel} is currently tracking at ${fmtUnitPct(forecast?.winProb)} win probability with projected turnout ${fmtPct(forecast?.turnoutExpectedPct)}.`,
        `Readiness is ${readinessBand}, realism is ${realismClass}, and confidence is ${confidenceBand}.`,
        cleanText(governance?.topWarning)
          ? `Current watchout: ${cleanText(governance.topWarning)}.`
          : "No top governance warning is currently active.",
      ],
    },
    {
      id: "strategicPosition",
      title: getReportSectionLabel("strategicPosition"),
      lines: [
        `Primary objective: ${cleanText(strategic?.objective || "—")}.`,
        `Projected vote position: ${fmtWhole(forecast?.yourVotes)} votes vs threshold ${fmtWhole(forecast?.winThreshold)}.`,
        `Primary operational bottleneck: ${cleanText(strategic?.primaryBottleneck || "—")}.`,
      ],
    },
    {
      id: "targetingUniverseSummary",
      title: getReportSectionLabel("targetingUniverseSummary"),
      lines: [
        `Target universe: ${fmtWhole(targeting?.universeSize)} with model ${cleanText(targeting?.modelId || "—")} (top ${fmtWhole(targeting?.topN)} priorities).`,
        `Support/contact assumptions: ${fmtPct(targeting?.supportRatePct)} support and ${fmtPct(targeting?.contactRatePct)} contact.`,
        `Age composition signals: opportunity ${cleanText(voterIntelligence?.ageOpportunityBucket || "unknown")} / turnout risk ${cleanText(voterIntelligence?.ageTurnoutRiskBucket || "unknown")} (coverage ${fmtUnitPct(voterIntelligence?.ageCoverageRate)}).`,
      ],
    },
    {
      id: "fieldWorkforceSummary",
      title: getReportSectionLabel("fieldWorkforceSummary"),
      lines: [
        `Field build: ${fmtWhole(workforce?.organizerCount)} organizers, ${fmtWhole(workforce?.organizerHoursPerWeek)} organizer-hours per week, volunteer multiplier ${fmtScore(workforce?.volunteerMultiplier)}.`,
        `Role typing coverage is ${fmtPct(workforce?.roleTypingCoveragePct)}.`,
        `War Room ownership: ${cleanText(warRoom?.decisionOwner || "owner not set")} with follow-up ${cleanText(warRoom?.followUpDate || "not set")}.`,
      ],
    },
    {
      id: "budgetChannelStrategySummary",
      title: getReportSectionLabel("budgetChannelStrategySummary"),
      lines: [
        `Budget strategy objective: ${cleanText(budget?.objective || "—")}.`,
        `Enabled channels: doors ${budget?.tactics?.doors?.enabled ? "on" : "off"}, phones ${budget?.tactics?.phones?.enabled ? "on" : "off"}, texts ${budget?.tactics?.texts?.enabled ? "on" : "off"}, mail ${budget?.tactics?.mail?.enabled ? "on" : "off"}.`,
        `Realism classification for budget assumptions: ${realismClass}.`,
      ],
    },
    {
      id: "turnoutGotvRisk",
      title: getReportSectionLabel("turnoutGotvRisk"),
      lines: [
        `Turnout projection: ${fmtPct(forecast?.turnoutExpectedPct)} (${fmtWhole(forecast?.turnoutVotes)} votes).`,
        `Persuasion votes still needed: ${fmtWhole(forecast?.persuasionNeed)}.`,
        `Weather/event planning context: ZIP ${cleanText(warRoom?.weatherZip || "—")}, weather mode ${cleanText(warRoom?.weatherMode || "observe_only")}, applied campaign events ${fmtWhole(events?.appliedCampaignEvents)}.`,
      ],
    },
    {
      id: "scenarioSummary",
      title: getReportSectionLabel("scenarioSummary"),
      lines: [
        `Active scenario: ${cleanText(context?.scenarioName || context?.scenarioId || "—")} (registry size ${fmtWhole(scenario?.registrySize)}).`,
        `Candidate-history baseline confidence: ${cleanText(scenario?.candidateHistoryConfidenceBand || "unknown")} (${fmtWhole(scenario?.candidateHistoryRecordCount)} records).`,
        `Forecast range (p10 / p50 / p90 margin): ${fmtScore(forecast?.p10Margin)} / ${fmtScore(forecast?.p50Margin)} / ${fmtScore(forecast?.p90Margin)}.`,
      ],
    },
    {
      id: "recommendedActions",
      title: getReportSectionLabel("recommendedActions"),
      lines: [
        readiness?.topIssues?.[0]?.message
          ? `Immediate fix: ${cleanText(readiness.topIssues[0].message)}`
          : "Immediate fix: maintain current input discipline and update weekly.",
        cleanText(warRoom?.decisionSummary)
          ? `Execution priority: ${cleanText(warRoom.decisionSummary)}`
          : "Execution priority: confirm next War Room decision summary and owner.",
        cleanText(governance?.learningRecommendation)
          ? `Calibration step: ${cleanText(governance.learningRecommendation)}`
          : "Calibration step: continue entering certified actual outcomes to strengthen confidence.",
      ],
    },
    {
      id: "methodologyAppendix",
      title: getReportSectionLabel("methodologyAppendix"),
      lines: [
        "This report uses canonical campaign model outputs and diagnostics from the active scenario context.",
        "Recommendations are confidence-aware and reflect current readiness/realism conditions.",
        `Campaign data requirements guide: ${cleanText(manual?.campaignDataRequirementsSummary || "not available")}.`,
        `Durability and trust standards guide: ${cleanText(manual?.durabilityTrustSummary || "not available")}.`,
        "If readiness or realism is weak, treat strategy as conditional until flagged inputs are corrected.",
      ],
    },
  ];

  return {
    reportType: "client",
    reportLabel,
    generatedAt: cleanText(snapshot?.generatedAt),
    title: `${reportLabel} — ${campaignLabel}`,
    context: snapshot?.context || {},
    sections,
    metadata: {
      readinessBand,
      realismClassification: realismClass,
      confidenceBand,
    },
  };
}
