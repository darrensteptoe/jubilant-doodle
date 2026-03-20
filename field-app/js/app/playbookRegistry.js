// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim();
}

function toTextList(value){
  if (Array.isArray(value)){
    return value.map((row) => clean(row)).filter(Boolean);
  }
  const single = clean(value);
  return single ? [single] : [];
}

function freezeStringList(value){
  return Object.freeze(toTextList(value));
}

function normalizeTriggerRules(rows){
  const list = Array.isArray(rows) ? rows : [];
  return Object.freeze(list.map((row) => Object.freeze({
    signal: clean(row?.signal),
    label: clean(row?.label),
    op: clean(row?.op || "eq"),
    value: row?.value,
    values: Array.isArray(row?.values) ? row.values.slice() : undefined,
  })).filter((row) => !!row.signal));
}

function buildWatchSignalsText(triggerRules){
  const labels = (Array.isArray(triggerRules) ? triggerRules : [])
    .map((row) => clean(row?.label) || clean(row?.signal))
    .filter(Boolean);
  return labels.join("; ");
}

function createPlaybookEntry(entry){
  const triggerRules = normalizeTriggerRules(entry?.triggerRules);
  const whatToDo = freezeStringList(entry?.whatToDo);
  const whatNotToDo = freezeStringList(entry?.whatNotToDo);
  const triggerCondition = clean(entry?.triggerCondition);
  const commonTrap = clean(entry?.commonTrap);
  const minimumMatchedRaw = Number.parseInt(String(entry?.minimumMatchedRules ?? ""), 10);
  return Object.freeze({
    id: clean(entry?.id),
    title: clean(entry?.title),
    summary: clean(entry?.summary),
    triggerCondition,
    triggerMatch: clean(entry?.triggerMatch || "all").toLowerCase() === "any" ? "any" : "all",
    minimumMatchedRules: Number.isFinite(minimumMatchedRaw)
      ? Math.max(1, minimumMatchedRaw)
      : 1,
    triggerRules,
    whatPatternMeans: clean(entry?.whatPatternMeans),
    whyItMatters: clean(entry?.whyItMatters),
    whatToDo,
    whatNotToDo,
    commonTrap,
    relatedModules: freezeStringList(entry?.relatedModules),
    relatedDoctrinePages: freezeStringList(entry?.relatedDoctrinePages),
    relatedMessages: freezeStringList(entry?.relatedMessages),
    relatedModels: freezeStringList(entry?.relatedModels),
    relatedTerms: freezeStringList(entry?.relatedTerms),
    // Compatibility aliases so older resolver/index consumers stay deterministic.
    situation: triggerCondition,
    disciplinedResponse: whatToDo.join(" "),
    commonTraps: commonTrap,
    watchSignals: buildWatchSignalsText(triggerRules),
  });
}

const PLAYBOOK_BY_ID = Object.freeze({
  lowConfidenceHighPressure: createPlaybookEntry({
    id: "lowConfidenceHighPressure",
    title: "Low Confidence, High Pressure",
    summary: "When pressure to decide outruns evidence quality, slow tempo and preserve reversibility.",
    triggerCondition: "Decision pressure is high while readiness, realism, or confidence posture is weak.",
    triggerMatch: "any",
    minimumMatchedRules: 2,
    triggerRules: [
      { signal: "decisionPressureLevel", op: "in", values: ["medium", "high"], label: "Decision pressure elevated" },
      { signal: "readinessBand", op: "in", values: ["degraded", "low", "warning", "critical", "blocked"], label: "Readiness degraded" },
      { signal: "realismClassification", op: "in", values: ["stretched", "unrealistic"], label: "Realism stretched" },
      { signal: "governanceConfidenceBand", op: "in", values: ["low"], label: "Confidence low" },
    ],
    whatPatternMeans: "The system is signaling uncertainty while leadership urgency is increasing.",
    whyItMatters: "Fast commitments on weak evidence create compounding execution and credibility risk.",
    whatToDo: [
      "Lock assumptions and identify what changed since last review.",
      "Choose a reversible action with explicit owner and follow-up timestamp.",
      "State confidence limits in plain language before approving escalation.",
    ],
    whatNotToDo: [
      "Do not use certainty language when readiness/realism are weak.",
      "Do not push major allocation shifts without an evidence checkpoint.",
    ],
    commonTrap: "Confusing urgency with evidence quality and forcing a confident narrative.",
    relatedModules: ["governanceConfidence", "warRoomDecisionSession", "scenarioManager"],
    relatedDoctrinePages: ["durabilityTrustStandards", "campaignDataRequirements", "warRoomDecisionSession"],
    relatedMessages: ["lowConfidenceForecast", "capacityGapWarning", "executionGapWarning"],
    relatedModels: ["masterTargetingEquation", "expectedVoteGain"],
    relatedTerms: ["confidence", "signal", "noise", "decision significance"],
  }),
  aheadButFragile: createPlaybookEntry({
    id: "aheadButFragile",
    title: "Ahead, But Fragile",
    summary: "Protect narrow advantage with discipline instead of victory behavior.",
    triggerCondition: "Forecast posture looks favorable, but confidence/saturation/weather risk still shows fragility.",
    triggerMatch: "any",
    minimumMatchedRules: 2,
    triggerRules: [
      { signal: "stageId", op: "in", values: ["outcome", "war-room", "decision-log"], label: "Decision stage active" },
      { signal: "governanceConfidenceBand", op: "in", values: ["low", "medium"], label: "Confidence not high" },
      { signal: "saturationPressure", op: "in", values: ["medium", "high"], label: "Saturation pressure elevated" },
      { signal: "weatherElectionDayTurnoutRisk", op: "in", values: ["medium", "high"], label: "Turnout weather risk elevated" },
    ],
    whatPatternMeans: "The lead is operationally vulnerable and can reverse under normal turbulence.",
    whyItMatters: "Premature victory behavior weakens turnout protection and raises downside variance.",
    whatToDo: [
      "Protect proven turnout lanes before adding speculative expansion.",
      "Reserve contingency capacity for late-cycle shock response.",
      "Review fragile cohorts/geographies at each War Room check-in.",
    ],
    whatNotToDo: [
      "Do not reallocate away from core turnout protection too early.",
      "Do not interpret one favorable update as structural safety.",
    ],
    commonTrap: "Treating a narrow edge as if volatility disappeared.",
    relatedModules: ["forecastOutcome", "turnoutContactSaturation", "warRoomDecisionSession"],
    relatedDoctrinePages: ["forecastOutcome", "warRoomDecisionSession", "durabilityTrustStandards"],
    relatedMessages: ["lowConfidenceForecast", "turnoutStatusContext", "saturationRisk"],
    relatedModels: ["expectedVoteGain", "turnoutElasticity", "contactSaturation"],
    relatedTerms: ["variance", "turnout opportunity", "scenario drift"],
  }),
  behindButStillLive: createPlaybookEntry({
    id: "behindButStillLive",
    title: "Behind, But Still Live",
    summary: "Shift to a narrower, feasible vote path instead of broad panic response.",
    triggerCondition: "System pressure is high with performance gaps, but path-to-win remains operationally reachable.",
    triggerMatch: "any",
    minimumMatchedRules: 2,
    triggerRules: [
      { signal: "stageId", op: "in", values: ["plan", "outcome", "war-room"], label: "Execution decision stage active" },
      { signal: "capacitySeverity", op: "in", values: ["warn", "bad"], label: "Capacity constraint active" },
      { signal: "readinessBand", op: "in", values: ["degraded", "low", "warning"], label: "Readiness not strong" },
      { signal: "decisionPressureLevel", op: "in", values: ["high"], label: "Decision pressure high" },
    ],
    whatPatternMeans: "The current path is too broad for available capacity, but not mathematically dead.",
    whyItMatters: "Disciplined narrowing can recover performance; diffuse effort usually deepens losses.",
    whatToDo: [
      "Narrow universe and channel mix to the highest-convertible path.",
      "Run bounded aggressive scenarios that remain realism-compliant.",
      "Tie each tactical escalation to clear capacity coverage.",
    ],
    whatNotToDo: [
      "Do not chase every segment to preserve optics.",
      "Do not assume unrealistic output velocity to close the gap.",
    ],
    commonTrap: "Panic broadening that burns capacity without moving net votes.",
    relatedModules: ["optimizer", "targetUniverseMatrix", "warRoomDecisionSession"],
    relatedDoctrinePages: ["optimizer", "targetUniverseMatrix", "campaignDataRequirements"],
    relatedMessages: ["capacityGapWarning", "executionGapWarning", "lowConfidenceForecast"],
    relatedModels: ["votePathOptimization", "persuasionCost", "expectedVoteGain"],
    relatedTerms: ["vote path", "realism", "actionability"],
  }),
  persuasionUniverseTooBroad: createPlaybookEntry({
    id: "persuasionUniverseTooBroad",
    title: "Persuasion Universe Too Broad",
    summary: "Scope persuasion to where conversion can realistically happen.",
    triggerCondition: "Persuasion share is broad relative to saturation or execution reality.",
    triggerMatch: "any",
    triggerRules: [
      { signal: "persuasionPct", op: "gte", value: 35, label: "Persuasion share elevated" },
      { signal: "saturationPressure", op: "in", values: ["medium", "high"], label: "Saturation pressure rising" },
    ],
    whatPatternMeans: "Current persuasion target is wider than reachable conversion capacity.",
    whyItMatters: "Broad low-yield persuasion wastes touches and suppresses turnout opportunity execution.",
    whatToDo: [
      "Narrow persuasion universe by convertibility and geography.",
      "Prioritize segments with stronger contact probability and lift potential.",
      "Re-check saturation before increasing cadence.",
    ],
    whatNotToDo: [
      "Do not equate universe size with expected net gain.",
      "Do not keep adding touches to low-response segments.",
    ],
    commonTrap: "Vanity persuasion scope that looks strategic but dilutes impact.",
    relatedModules: ["targetingLab", "turnoutContactSaturation", "optimizer"],
    relatedDoctrinePages: ["targetingLab", "targetUniverseMatrix", "turnoutContactSaturation"],
    relatedMessages: ["saturationRisk", "turnoutStatusContext"],
    relatedModels: ["supportTurnoutMatrix", "persuasionCurve", "contactSaturation"],
    relatedTerms: ["persuasion", "saturation", "lift"],
  }),
  strongVolunteerCountWeakRealCapacity: createPlaybookEntry({
    id: "strongVolunteerCountWeakRealCapacity",
    title: "Strong Volunteer Count, Weak Real Capacity",
    summary: "Translate volunteer headline into supervised, role-typed production reality.",
    triggerCondition: "Volunteer scale appears strong, but role coverage/capacity feasibility remains weak.",
    triggerMatch: "any",
    minimumMatchedRules: 2,
    triggerRules: [
      { signal: "volunteerScale", op: "gte", value: 1.1, label: "Volunteer scale elevated" },
      { signal: "roleTypingCoveragePct", op: "lt", value: 80, label: "Role typing coverage low" },
      { signal: "capacitySeverity", op: "in", values: ["warn", "bad"], label: "Capacity feasibility warning" },
    ],
    whatPatternMeans: "Headcount quality and operational supervision are not supporting assumed output.",
    whyItMatters: "Unrealistic workforce assumptions infect timeline, turnout, and budget decisions.",
    whatToDo: [
      "Enforce organizer/volunteer/paid-canvasser role typing completeness.",
      "Audit show-rate, supervision span, and shift-hour assumptions.",
      "Plan from realized throughput, not signup totals.",
    ],
    whatNotToDo: [
      "Do not claim field strength from unverified volunteer counts.",
      "Do not project output gains without role-based feasibility checks.",
    ],
    commonTrap: "Treating volunteer volume as production capacity.",
    relatedModules: ["operationsWorkforce", "turnoutContactSaturation", "warRoomDecisionSession"],
    relatedDoctrinePages: ["operationsWorkforce", "campaignDataRequirements", "durabilityTrustStandards"],
    relatedMessages: ["capacityGapWarning", "executionGapWarning"],
    relatedModels: ["volunteerProduction", "currentFieldEfficiencyScore"],
    relatedTerms: ["field organizer", "volunteer", "paid canvasser"],
  }),
  optimizerOvervaluesCheapChannels: createPlaybookEntry({
    id: "optimizerOvervaluesCheapChannels",
    title: "Optimizer Overvalues Cheap Channels",
    summary: "Cheap channel cost should not outrank realism and effectiveness evidence.",
    triggerCondition: "Allocation pressure concentrates on low-cost channels with weak quality confidence.",
    triggerMatch: "any",
    triggerRules: [
      { signal: "optimizerCheapChannelRisk", op: "truthy", label: "Cheap-channel concentration risk detected" },
      { signal: "optimizerTopChannelShare", op: "gte", value: 0.7, label: "Single-channel concentration high" },
    ],
    whatPatternMeans: "Cost efficiency is dominating allocation beyond proven conversion realism.",
    whyItMatters: "Cheap-but-weak channels can underdeliver votes while hiding risk in projection math.",
    whatToDo: [
      "Validate channel floor/ceiling realism bands before reallocating.",
      "Check downstream conversion quality, not only nominal CPA.",
      "Impose diversification guardrails when concentration exceeds tolerance.",
    ],
    whatNotToDo: [
      "Do not treat lower nominal CPA as automatically better vote value.",
      "Do not allow one cheap channel to displace all proven lanes.",
    ],
    commonTrap: "Confusing inexpensive with sufficient.",
    relatedModules: ["optimizer", "budgetChannelCost", "turnoutContactSaturation"],
    relatedDoctrinePages: ["budgetChannelCost", "optimizer", "durabilityTrustStandards"],
    relatedMessages: ["saturationRisk", "turnoutRoiNeedsRefresh"],
    relatedModels: ["persuasionCost", "votePathOptimization", "expectedVoteGain"],
    relatedTerms: ["calibration", "bias", "contact probability"],
  }),
  forecastImprovedBecauseAssumptionsChanged: createPlaybookEntry({
    id: "forecastImprovedBecauseAssumptionsChanged",
    title: "Forecast Improved Because Assumptions Changed",
    summary: "Separate observed campaign improvement from assumption edits.",
    triggerCondition: "Forecast movement coincides with assumption or baseline edits rather than new field evidence.",
    triggerMatch: "any",
    triggerRules: [
      { signal: "assumptionDriftDetected", op: "truthy", label: "Assumption drift detected" },
    ],
    whatPatternMeans: "The model got better-looking faster than operations evidence improved.",
    whyItMatters: "Mislabeling assumption edits as momentum corrupts trust and downstream decisions.",
    whatToDo: [
      "Log assumption deltas with rationale and owner.",
      "Present observed-change and assumption-change separately.",
      "Downgrade confidence language until observed execution confirms.",
    ],
    whatNotToDo: [
      "Do not claim strategic improvement from input optimism alone.",
      "Do not hide assumption edits inside summary narratives.",
    ],
    commonTrap: "Celebrating model-input drift as campaign performance.",
    relatedModules: ["forecastOutcome", "learningAudit", "durabilityTrustStandards"],
    relatedDoctrinePages: ["durabilityTrustStandards", "learningAudit", "forecastOutcome"],
    relatedMessages: ["lowConfidenceForecast", "executionGapWarning"],
    relatedModels: ["expectedVoteGain", "masterTargetingEquation"],
    relatedTerms: ["signal", "noise", "calibration"],
  }),
  lateCycleRepeatedContactFlattened: createPlaybookEntry({
    id: "lateCycleRepeatedContactFlattened",
    title: "Late-Cycle Repeated Contact Flattened",
    summary: "When marginal returns flatten, rotate targets and rebalance cadence.",
    triggerCondition: "Saturation pressure is high and repeated touch strategy shows diminishing marginal value.",
    triggerMatch: "any",
    triggerRules: [
      { signal: "saturationPressure", op: "in", values: ["high"], label: "Saturation pressure high" },
      { signal: "capacitySeverity", op: "in", values: ["warn", "bad"], label: "Capacity strain while saturation is high" },
    ],
    whatPatternMeans: "Continuing current cadence is producing activity, not incremental vote movement.",
    whyItMatters: "Over-contacting exhausted universes burns time and budget needed elsewhere.",
    whatToDo: [
      "Reduce redundant cadence in exhausted segments.",
      "Re-rank toward under-contacted universes with higher marginal value.",
      "Shift channel mix where freshness and reach are stronger.",
    ],
    whatNotToDo: [
      "Do not preserve stale cadence to protect appearance of activity.",
      "Do not ignore saturation warnings once marginal lift falls.",
    ],
    commonTrap: "Treating volume as effectiveness after marginal returns collapse.",
    relatedModules: ["turnoutContactSaturation", "targetingLab", "optimizer"],
    relatedDoctrinePages: ["turnoutContactSaturation", "targetingLab", "optimizer"],
    relatedMessages: ["saturationRisk", "turnoutRoiNeedsRefresh"],
    relatedModels: ["contactSaturation", "persuasionCurve", "expectedVoteGain"],
    relatedTerms: ["saturation", "contact probability", "vote path"],
  }),
  weatherThreatensElectionDayPlan: createPlaybookEntry({
    id: "weatherThreatensElectionDayPlan",
    title: "Weather Threatens Election-Day Plan",
    summary: "Use bounded same-day modifiers and explicit contingency actions.",
    triggerCondition: "Weather risk elevates field execution or election-day turnout risk.",
    triggerMatch: "any",
    triggerRules: [
      { signal: "weatherFieldExecutionRisk", op: "in", values: ["medium", "high"], label: "Field execution weather risk elevated" },
      { signal: "weatherElectionDayTurnoutRisk", op: "in", values: ["medium", "high"], label: "Election-day turnout weather risk elevated" },
      { signal: "weatherMode", op: "eq", value: "today_only", label: "Today-only weather mode active" },
    ],
    whatPatternMeans: "Same-day field assumptions are weather-sensitive and need explicit operational posture.",
    whyItMatters: "Silent weather reactions create hidden model drift and poor field coordination.",
    whatToDo: [
      "Choose observe-only vs today-only mode explicitly and log it.",
      "Apply only visible, reversible, date-bound modifiers.",
      "Deploy fallback channels and staffing contingencies for the same day.",
    ],
    whatNotToDo: [
      "Do not silently rewrite long-run assumptions due to short-horizon weather.",
      "Do not carry weather modifiers beyond the intended date.",
    ],
    commonTrap: "Ad-hoc weather overrides without logging, visibility, or expiry discipline.",
    relatedModules: ["warRoomDecisionSession", "operationsWorkforce", "turnoutContactSaturation"],
    relatedDoctrinePages: ["warRoomDecisionSession", "durabilityTrustStandards", "operationsWorkforce"],
    relatedMessages: ["turnoutStatusContext", "capacityGapWarning"],
    relatedModels: ["currentFieldEfficiencyScore", "volunteerProduction"],
    relatedTerms: ["signal", "actionability", "turnout opportunity"],
  }),
  dayOfActionLooksBigButCapacityMathStillMatters: createPlaybookEntry({
    id: "dayOfActionLooksBigButCapacityMathStillMatters",
    title: "Day of Action Looks Big, Capacity Math Still Matters",
    summary: "Treat event surges as temporary capacity input, never guaranteed output.",
    triggerCondition: "Large campaign event assumptions are active, but capacity feasibility remains constrained.",
    triggerMatch: "any",
    minimumMatchedRules: 2,
    triggerRules: [
      { signal: "todayCampaignEvents", op: "gte", value: 1, label: "Campaign event active today" },
      { signal: "todayExpectedVolunteers", op: "gte", value: 40, label: "Large event volunteer expectation" },
      { signal: "capacitySeverity", op: "in", values: ["warn", "bad"], label: "Capacity gap still present" },
    ],
    whatPatternMeans: "Event enthusiasm is high, but normal productivity math still governs achievable output.",
    whyItMatters: "Injecting fake output from event size creates confidence illusions and poor follow-through.",
    whatToDo: [
      "Apply event impact as date-bound capacity boost only.",
      "Run normal productivity math to estimate achievable output.",
      "Compare required vs available capacity even after event assumptions.",
    ],
    whatNotToDo: [
      "Do not inject fixed output totals from event size.",
      "Do not let event assumptions persist silently past event date.",
    ],
    commonTrap: "Mistaking event scale optics for guaranteed production.",
    relatedModules: ["operationsWorkforce", "warRoomDecisionSession", "learningAudit"],
    relatedDoctrinePages: ["operationsWorkforce", "warRoomDecisionSession", "campaignDataRequirements"],
    relatedMessages: ["capacityGapWarning", "executionGapWarning"],
    relatedModels: ["volunteerProduction", "currentFieldEfficiencyScore", "masterTargetingEquation"],
    relatedTerms: ["field organizer", "volunteer", "realism"],
  }),
});

const PLAYBOOK_STAGE_DEFAULTS = Object.freeze({
  district: "persuasionUniverseTooBroad",
  reach: "strongVolunteerCountWeakRealCapacity",
  turnout: "lateCycleRepeatedContactFlattened",
  outcome: "forecastImprovedBecauseAssumptionsChanged",
  plan: "optimizerOvervaluesCheapChannels",
  scenarios: "behindButStillLive",
  "decision-log": "lowConfidenceHighPressure",
  "war-room": "lowConfidenceHighPressure",
  controls: "forecastImprovedBecauseAssumptionsChanged",
  data: "dayOfActionLooksBigButCapacityMathStillMatters",
});

/**
 * @param {string=} id
 */
export function getPlaybookEntry(id = ""){
  const key = clean(id);
  if (!key) return null;
  return PLAYBOOK_BY_ID[key] || null;
}

export function listPlaybookEntries(){
  return Object.values(PLAYBOOK_BY_ID).slice();
}

/**
 * @param {string=} stageId
 */
export function getDefaultPlaybookForStage(stageId = ""){
  const key = clean(stageId).toLowerCase();
  if (!key) return "lowConfidenceHighPressure";
  return PLAYBOOK_STAGE_DEFAULTS[key] || "lowConfidenceHighPressure";
}
