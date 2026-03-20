// @ts-check

const PLAYBOOK_BY_ID = Object.freeze({
  lowConfidenceHighPressure: Object.freeze({
    id: "lowConfidenceHighPressure",
    title: "Low Confidence, High Pressure",
    summary: "Slow down the decision tempo when pressure rises faster than confidence.",
    situation: "Used when leadership pressure is high but model confidence is degraded or uncertain.",
    disciplinedResponse: "Lock assumptions, capture what changed, choose a reversible action, and set a follow-up checkpoint.",
    commonTraps: "Overreacting to one update, forcing certainty language, and skipping decision-owner accountability.",
    watchSignals: "Confidence drop, weak signal classification, and incomplete required inputs.",
    relatedModules: Object.freeze(["governanceConfidence", "warRoomDecisionSession", "scenarioManager"]),
    relatedModels: Object.freeze(["masterTargetingEquation", "expectedVoteGain"]),
    relatedTerms: Object.freeze(["confidence", "signal", "noise", "decision significance"]),
  }),
  aheadButFragile: Object.freeze({
    id: "aheadButFragile",
    title: "Ahead, But Fragile",
    summary: "Protect the lead without pretending volatility is gone.",
    situation: "Use when topline forecast improves but variance and field risk remain elevated.",
    disciplinedResponse: "Preserve reserve capacity, tighten execution quality, and monitor slippage by cohort/geography.",
    commonTraps: "Declaring victory early and reallocating budget away from proven channels too quickly.",
    watchSignals: "Lead maintained with falling confidence, turnout risk bump, and contact-efficiency drift.",
    relatedModules: Object.freeze(["forecastOutcome", "turnoutContactSaturation", "warRoomDecisionSession"]),
    relatedModels: Object.freeze(["expectedVoteGain", "turnoutElasticity", "contactSaturation"]),
    relatedTerms: Object.freeze(["variance", "turnout opportunity", "scenario drift"]),
  }),
  behindButStillLive: Object.freeze({
    id: "behindButStillLive",
    title: "Behind, But Still Live",
    summary: "Concentrate on reachable vote path segments and operational feasibility.",
    situation: "Use when forecast is behind baseline targets but path-to-win remains non-zero.",
    disciplinedResponse: "Narrow universes, prioritize high-utility channels, and run bounded aggressive scenarios.",
    commonTraps: "Trying to chase every voter segment and accepting implausible productivity assumptions.",
    watchSignals: "Capacity gap warnings, unrealistic channel costs, and broad persuasion universes.",
    relatedModules: Object.freeze(["optimizer", "targetUniverseMatrix", "warRoomDecisionSession"]),
    relatedModels: Object.freeze(["votePathOptimization", "persuasionCost", "expectedVoteGain"]),
    relatedTerms: Object.freeze(["vote path", "realism", "actionability"]),
  }),
  persuasionUniverseTooBroad: Object.freeze({
    id: "persuasionUniverseTooBroad",
    title: "Persuasion Universe Too Broad",
    summary: "Trim persuasion scope before scaling contact volume.",
    situation: "Use when persuasion segments are large but response rates and field capacity are limited.",
    disciplinedResponse: "Tighten support/turnout filters, prioritize high-lift geographies, and track saturation effects.",
    commonTraps: "Equating universe size with net-vote gain and ignoring diminishing returns.",
    watchSignals: "High persuasion share plus low conversion velocity and saturation warnings.",
    relatedModules: Object.freeze(["targetingLab", "turnoutContactSaturation", "optimizer"]),
    relatedModels: Object.freeze(["supportTurnoutMatrix", "persuasionCurve", "contactSaturation"]),
    relatedTerms: Object.freeze(["persuasion", "saturation", "lift"]),
  }),
  strongVolunteerCountWeakRealCapacity: Object.freeze({
    id: "strongVolunteerCountWeakRealCapacity",
    title: "Strong Volunteer Count, Weak Real Capacity",
    summary: "Convert headcount into realistic output assumptions before planning commitments.",
    situation: "Use when volunteer totals look healthy but realized attempts remain constrained.",
    disciplinedResponse: "Validate role typing, show-rate assumptions, organizer span, and shift-hour realism.",
    commonTraps: "Planning from raw sign-ups and ignoring attendance/productivity decay.",
    watchSignals: "Role-typing coverage gaps and low realized attempts per organizer hour.",
    relatedModules: Object.freeze(["operationsWorkforce", "turnoutContactSaturation", "warRoomDecisionSession"]),
    relatedModels: Object.freeze(["volunteerProduction", "currentFieldEfficiencyScore"]),
    relatedTerms: Object.freeze(["field organizer", "volunteer", "paid canvasser"]),
  }),
  optimizerOvervaluesCheapChannels: Object.freeze({
    id: "optimizerOvervaluesCheapChannels",
    title: "Optimizer Overvalues Cheap Channels",
    summary: "Check cost realism and channel effectiveness assumptions before adopting allocation shifts.",
    situation: "Use when optimizer heavily concentrates budget into one low-cost channel.",
    disciplinedResponse: "Audit channel floor/ceiling bands, verify contact quality, and enforce diversification constraints.",
    commonTraps: "Treating nominal CPA as fully fungible vote value across channels.",
    watchSignals: "Budget realism warnings and weak downstream conversion in the concentrated channel.",
    relatedModules: Object.freeze(["optimizer", "budgetChannelCost", "turnoutContactSaturation"]),
    relatedModels: Object.freeze(["persuasionCost", "votePathOptimization", "expectedVoteGain"]),
    relatedTerms: Object.freeze(["calibration", "bias", "contact probability"]),
  }),
  forecastImprovedBecauseAssumptionsChanged: Object.freeze({
    id: "forecastImprovedBecauseAssumptionsChanged",
    title: "Forecast Improved Because Assumptions Changed",
    summary: "Separate true performance gains from assumption edits.",
    situation: "Use when forecast movement coincides with recent assumption or baseline edits.",
    disciplinedResponse: "Log assumption diffs, classify signal strength, and communicate confidence-qualified updates.",
    commonTraps: "Presenting edited assumptions as observed momentum.",
    watchSignals: "Material forecast shift with low observed execution change.",
    relatedModules: Object.freeze(["forecastOutcome", "learningAudit", "durabilityTrustStandards"]),
    relatedModels: Object.freeze(["expectedVoteGain", "masterTargetingEquation"]),
    relatedTerms: Object.freeze(["signal", "noise", "calibration"]),
  }),
  lateCycleRepeatedContactFlattened: Object.freeze({
    id: "lateCycleRepeatedContactFlattened",
    title: "Late-Cycle Repeated Contact Flattened",
    summary: "Rebalance toward untouched or under-contacted segments when marginal returns flatten.",
    situation: "Use when repeated touches are high and incremental lift declines.",
    disciplinedResponse: "Reduce redundant cadence, re-rank targets, and shift mix toward under-covered universes.",
    commonTraps: "Maintaining same cadence to preserve activity optics.",
    watchSignals: "Saturation warnings, stagnant conversion, and rising cost per net vote.",
    relatedModules: Object.freeze(["turnoutContactSaturation", "targetingLab", "optimizer"]),
    relatedModels: Object.freeze(["contactSaturation", "persuasionCurve", "expectedVoteGain"]),
    relatedTerms: Object.freeze(["saturation", "contact probability", "vote path"]),
  }),
  weatherThreatensElectionDayPlan: Object.freeze({
    id: "weatherThreatensElectionDayPlan",
    title: "Weather Threatens Election-Day Plan",
    summary: "Use bounded same-day modifiers and contingency channels without rewriting long-run assumptions.",
    situation: "Use when War Room weather risk indicates moderate/high field execution or turnout risk.",
    disciplinedResponse: "Decide observe-only vs today-only mode explicitly, log owner/follow-up, and deploy backup outreach channels.",
    commonTraps: "Silent model edits, unlogged ad-hoc overrides, and carrying weather modifiers beyond intended date.",
    watchSignals: "High fieldExecutionRisk, turnout risk bump, and volunteer show-rate degradation.",
    relatedModules: Object.freeze(["warRoomDecisionSession", "operationsWorkforce", "turnoutContactSaturation"]),
    relatedModels: Object.freeze(["currentFieldEfficiencyScore", "volunteerProduction"]),
    relatedTerms: Object.freeze(["signal", "actionability", "turnout opportunity"]),
  }),
  dayOfActionLooksBigButCapacityMathStillMatters: Object.freeze({
    id: "dayOfActionLooksBigButCapacityMathStillMatters",
    title: "Day of Action Looks Big, Capacity Math Still Matters",
    summary: "Treat Day of Action planning as temporary capacity input, not guaranteed output injection.",
    situation: "Use when campaign events report large volunteer expectations for a specific date.",
    disciplinedResponse: "Validate staffing realism, apply capacity-only toggles, and compare required vs available throughput.",
    commonTraps: "Injecting fixed output counts and skipping role/productivity constraints.",
    watchSignals: "Event realism flags, capacity gap persistence, and weak follow-through after event day.",
    relatedModules: Object.freeze(["operationsWorkforce", "warRoomDecisionSession", "learningAudit"]),
    relatedModels: Object.freeze(["volunteerProduction", "currentFieldEfficiencyScore", "masterTargetingEquation"]),
    relatedTerms: Object.freeze(["field organizer", "volunteer", "realism"]),
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

function clean(value){
  return String(value == null ? "" : value).trim();
}

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
