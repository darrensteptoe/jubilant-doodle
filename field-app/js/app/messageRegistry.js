// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim();
}

function normalizeLookupToken(value){
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Canonical message interpretation registry.
 * Static explanation content only.
 */
export const MESSAGE_REGISTRY = Object.freeze({
  contextMissing: Object.freeze({
    id: "contextMissing",
    kind: "warning",
    title: "Context Missing",
    aliases: Object.freeze(["missing context"]),
    meaning: "Required campaign or office context is missing for scoped execution.",
    whyItHappens: "No active context was selected or scoped URL params are incomplete.",
    whatToDo: "Set campaign and office context before running context-dependent actions.",
    whatItAffects: "Persistence, reporting scope, and team-safe collaboration boundaries.",
    ifIgnored: "Can produce cross-team ambiguity and invalid scoped outputs.",
    relatedModules: Object.freeze(["scenarioManager", "warRoomDecisionSession"]),
    relatedTerms: Object.freeze(["confidence", "signal"]),
  }),
  contextLocked: Object.freeze({
    id: "contextLocked",
    kind: "info",
    title: "Context Locked By URL",
    aliases: Object.freeze(["locked context"]),
    meaning: "Campaign and office scope are both pinned by URL parameters.",
    whyItHappens: "A shared or delegated link locked both scope dimensions intentionally.",
    whatToDo: "Use an unlocked entry URL if scope changes are needed.",
    whatItAffects: "Context controls, storage paths, and team-safe isolation.",
    ifIgnored: "Users may assume scope changed when it is still locked.",
    relatedModules: Object.freeze(["scenarioManager"]),
    relatedTerms: Object.freeze(["signal"]),
  }),
  campaignLocked: Object.freeze({
    id: "campaignLocked",
    kind: "info",
    title: "Campaign Locked By URL",
    aliases: Object.freeze(["campaign scope locked"]),
    meaning: "Campaign scope is locked from URL parameters.",
    whyItHappens: "A delegated or shared link pinned campaign context intentionally.",
    whatToDo: "Use a different link or remove locking params if scope change is intended.",
    whatItAffects: "Context selection controls and cross-campaign isolation enforcement.",
    ifIgnored: "Operators may think context changed when it did not.",
    relatedModules: Object.freeze(["scenarioManager"]),
    relatedTerms: Object.freeze(["signal"]),
  }),
  officeLocked: Object.freeze({
    id: "officeLocked",
    kind: "info",
    title: "Office Locked By URL",
    aliases: Object.freeze(["office scope locked"]),
    meaning: "Office scope is locked from URL parameters.",
    whyItHappens: "Team-entry links pinned office context for isolation safety.",
    whatToDo: "Use unlocked context or update link parameters for new office scope.",
    whatItAffects: "Office-scoped state persistence and operational record isolation.",
    ifIgnored: "Data can be interpreted under the wrong office assumption.",
    relatedModules: Object.freeze(["operationsWorkforce"]),
    relatedTerms: Object.freeze(["confidence"]),
  }),
  lowConfidenceForecast: Object.freeze({
    id: "lowConfidenceForecast",
    kind: "warning",
    title: "Low Confidence Forecast",
    aliases: Object.freeze(["forecast confidence low"]),
    meaning: "Forecast outputs are available but confidence is degraded.",
    whyItHappens: "Evidence coverage, data quality, or execution reliability is weak.",
    whatToDo: "Address governance and readiness gaps before major commitments.",
    whatItAffects: "Decision urgency, recommendation certainty, and report framing.",
    ifIgnored: "Teams may overcommit to fragile outcome assumptions.",
    relatedModules: Object.freeze(["forecastOutcome", "governanceConfidence"]),
    relatedTerms: Object.freeze(["confidence", "bias", "calibration"]),
  }),
  saturationRisk: Object.freeze({
    id: "saturationRisk",
    kind: "warning",
    title: "Saturation Risk",
    aliases: Object.freeze(["contact saturation warning"]),
    meaning: "Repeated contact assumptions are approaching diminishing-return territory.",
    whyItHappens: "Planned touches exceed realistic marginal effect for current universe.",
    whatToDo: "Rebalance channels, rotate universes, or lower incremental lift assumptions.",
    whatItAffects: "Optimizer allocation, projected gains, and execution priorities.",
    ifIgnored: "Plan may overstate impact and understate cost-per-net-vote.",
    relatedModules: Object.freeze(["turnoutContactSaturation", "optimizer"]),
    relatedTerms: Object.freeze(["saturation", "lift", "contact probability"]),
  }),
  strictImportEnabled: Object.freeze({
    id: "strictImportEnabled",
    kind: "info",
    title: "Strict Import Policy Enabled",
    aliases: Object.freeze(["strict import"]),
    meaning: "Import policy requires stronger schema/integrity compatibility checks.",
    whyItHappens: "Strict mode was enabled for data safety and auditability.",
    whatToDo: "Import compatible snapshots or disable strict mode intentionally.",
    whatItAffects: "Import acceptance, migration tolerance, and integrity verification flow.",
    ifIgnored: "Operators may misread blocked imports as random failures.",
    relatedModules: Object.freeze(["learningAudit"]),
    relatedTerms: Object.freeze(["confidence", "calibration"]),
  }),
  ballotBaselineConflict: Object.freeze({
    id: "ballotBaselineConflict",
    kind: "warning",
    title: "Ballot Baseline Conflict",
    aliases: Object.freeze(["ballot warning"]),
    meaning: "Candidate support, undecided values, or split rules are internally inconsistent.",
    whyItHappens: "Support totals may not close, or user-defined split assumptions conflict with inputs.",
    whatToDo: "Reconcile candidate shares, undecided percent, and split mode before trusting forecast shifts.",
    whatItAffects: "Vote baseline, persuasion need, and all downstream projections.",
    ifIgnored: "Downstream plans may optimize against a broken baseline.",
    relatedModules: Object.freeze(["templateArchetype", "forecastOutcome"]),
    relatedTerms: Object.freeze(["ballot baseline", "bias"]),
  }),
  electorateStructureNormalization: Object.freeze({
    id: "electorateStructureNormalization",
    kind: "warning",
    title: "Electorate Structure Needs Normalization",
    aliases: Object.freeze(["structure warning"]),
    meaning: "Electorate composition inputs are not normalized for weighting logic.",
    whyItHappens: "Party-share assumptions may not sum correctly or exceed feasible bounds.",
    whatToDo: "Normalize composition inputs before using weighted interpretations.",
    whatItAffects: "Support-retention interpretation and related diagnostics.",
    ifIgnored: "Weighted summaries can look precise while being mathematically unstable.",
    relatedModules: Object.freeze(["targetUniverseMatrix"]),
    relatedTerms: Object.freeze(["realism", "calibration"]),
  }),
  capacityGapWarning: Object.freeze({
    id: "capacityGapWarning",
    kind: "warning",
    title: "Weekly Capacity Gap",
    aliases: Object.freeze(["weekly gap"]),
    meaning: "Current staffing and pace assumptions are short of required weekly execution.",
    whyItHappens: "Required attempt/conversation targets exceed projected achievable volume.",
    whatToDo: "Adjust staffing, rates, or goals before locking commitments.",
    whatItAffects: "Timeline reliability, action recommendations, and war room posture.",
    ifIgnored: "Execution slippage compounds and can invalidate forecast confidence.",
    relatedModules: Object.freeze(["operationsWorkforce", "optimizer"]),
    relatedTerms: Object.freeze(["capacity", "readiness"]),
  }),
  executionGapWarning: Object.freeze({
    id: "executionGapWarning",
    kind: "warning",
    title: "Execution Reliability Gap",
    aliases: Object.freeze(["execution gap"]),
    meaning: "Observed execution pace does not support current modeled assumptions.",
    whyItHappens: "Recent logs indicate lower throughput or conversion than planning assumptions.",
    whatToDo: "Apply observed calibrations or revise plan assumptions with rationale.",
    whatItAffects: "Constraint interpretation, recommendations, and confidence framing.",
    ifIgnored: "Model may remain optimistic while field reality is lagging.",
    relatedModules: Object.freeze(["learningAudit", "operationsWorkforce"]),
    relatedTerms: Object.freeze(["signal", "noise", "calibration"]),
  }),
  turnoutRoiNeedsRefresh: Object.freeze({
    id: "turnoutRoiNeedsRefresh",
    kind: "info",
    title: "Turnout ROI Needs Refresh",
    aliases: Object.freeze(["roi refresh"]),
    meaning: "ROI table reflects stale assumptions until refreshed.",
    whyItHappens: "Inputs changed since the last deterministic ROI computation.",
    whatToDo: "Run refresh before comparing cost-per-net-vote tactics.",
    whatItAffects: "Turnout efficiency ranking and tactic recommendations.",
    ifIgnored: "Teams may compare tactics using outdated numbers.",
    relatedModules: Object.freeze(["turnoutContactSaturation", "optimizer"]),
    relatedTerms: Object.freeze(["cost per contact", "confidence"]),
  }),
  turnoutStatusContext: Object.freeze({
    id: "turnoutStatusContext",
    kind: "info",
    title: "Turnout Status Context",
    aliases: Object.freeze(["turnout status"]),
    meaning: "Turnout impact should be interpreted against persuasion need and current confidence posture.",
    whyItHappens: "Raw turnout votes alone do not indicate strategic sufficiency.",
    whatToDo: "Compare expected turnout contribution to persuasion gap and risk framing.",
    whatItAffects: "Outcome interpretation and recommendation sequencing.",
    ifIgnored: "Turnout gains may be overstated relative to total vote path needs.",
    relatedModules: Object.freeze(["forecastOutcome", "turnoutContactSaturation"]),
    relatedTerms: Object.freeze(["vote path", "confidence"]),
  }),
  undecidedModeProportional: Object.freeze({
    id: "undecidedModeProportional",
    kind: "option",
    title: "Undecided Mode: Proportional",
    aliases: Object.freeze(["proportional undecided"]),
    meaning: "Undecided votes are allocated in proportion to current candidate support.",
    whyItHappens: "Selected when analysts want a neutral split assumption.",
    whatToDo: "Use as baseline, then test conservative and user-defined alternatives.",
    whatItAffects: "Ballot baseline, persuasion requirement, and scenario sensitivity.",
    ifIgnored: "Single-mode assumptions can understate uncertainty.",
    relatedModules: Object.freeze(["templateArchetype", "forecastOutcome"]),
    relatedTerms: Object.freeze(["ballot baseline", "variance"]),
  }),
  undecidedModeAgainst: Object.freeze({
    id: "undecidedModeAgainst",
    kind: "option",
    title: "Undecided Mode: Against You",
    aliases: Object.freeze(["against undecided"]),
    meaning: "Undecided allocation assumes relative disadvantage for your candidate.",
    whyItHappens: "Chosen for stress testing adverse break behavior.",
    whatToDo: "Use for downside planning and capacity stress checks.",
    whatItAffects: "Required persuasion volume and contingency planning thresholds.",
    ifIgnored: "Team can miss downside risk in close races.",
    relatedModules: Object.freeze(["scenarioManager", "forecastOutcome"]),
    relatedTerms: Object.freeze(["ballot baseline", "readiness"]),
  }),
  undecidedModeUserDefined: Object.freeze({
    id: "undecidedModeUserDefined",
    kind: "option",
    title: "Undecided Mode: User Defined",
    aliases: Object.freeze(["manual undecided split"]),
    meaning: "Undecided allocation is manually specified per candidate.",
    whyItHappens: "Operator selected manual undecided split instead of proportional mode.",
    whatToDo: "Review split assumptions and maintain source notes for auditability.",
    whatItAffects: "Projected vote distribution and persuasion need calculations.",
    ifIgnored: "Manual split can silently bias baseline comparisons.",
    relatedModules: Object.freeze(["templateArchetype", "forecastOutcome"]),
    relatedTerms: Object.freeze(["bias", "ballot baseline"]),
  }),
  gotvModeBasic: Object.freeze({
    id: "gotvModeBasic",
    kind: "option",
    title: "GOTV Lift Model: Basic",
    aliases: Object.freeze(["gotv basic"]),
    meaning: "Uses simpler turnout lift assumptions for stable baseline planning.",
    whyItHappens: "Selected when data support for advanced calibration is limited.",
    whatToDo: "Start here, then graduate to advanced mode when evidence improves.",
    whatItAffects: "Turnout gain assumptions and ROI sensitivity.",
    ifIgnored: "Advanced precision may be implied without supporting evidence.",
    relatedModules: Object.freeze(["turnoutContactSaturation"]),
    relatedTerms: Object.freeze(["readiness", "confidence"]),
  }),
  gotvModeAdvanced: Object.freeze({
    id: "gotvModeAdvanced",
    kind: "option",
    title: "GOTV Lift Model: Advanced",
    aliases: Object.freeze(["gotv advanced"]),
    meaning: "Uses expanded turnout lift controls and richer assumption inputs.",
    whyItHappens: "Selected for campaigns with enough evidence to support finer tuning.",
    whatToDo: "Monitor realism and confidence when widening lift-parameter flexibility.",
    whatItAffects: "Turnout projections, sensitivity outputs, and Monte Carlo behavior.",
    ifIgnored: "Aggressive tuning can create false certainty.",
    relatedModules: Object.freeze(["turnoutContactSaturation", "forecastOutcome"]),
    relatedTerms: Object.freeze(["realism", "variance"]),
  }),
  capacityOverrideBaseline: Object.freeze({
    id: "capacityOverrideBaseline",
    kind: "option",
    title: "Capacity Override: Baseline",
    aliases: Object.freeze(["override baseline"]),
    meaning: "Uses baseline capacity profile for reach planning.",
    whyItHappens: "Selected when no event/ramp override should be applied.",
    whatToDo: "Use as reference mode for comparing override scenarios.",
    whatItAffects: "Capacity outlook and weekly feasibility posture.",
    ifIgnored: "Comparisons can lose a stable reference point.",
    relatedModules: Object.freeze(["operationsWorkforce"]),
    relatedTerms: Object.freeze(["capacity"]),
  }),
  capacityOverrideRamp: Object.freeze({
    id: "capacityOverrideRamp",
    kind: "option",
    title: "Capacity Override: Ramp",
    aliases: Object.freeze(["override ramp"]),
    meaning: "Uses expected readiness ramp profile for near-horizon capacity assumptions.",
    whyItHappens: "Selected when onboarding/activation changes are expected to lift volume.",
    whatToDo: "Validate ramp assumptions against observed readiness signals.",
    whatItAffects: "Near-term required-vs-achievable feasibility checks.",
    ifIgnored: "Ramp optimism can hide imminent execution gaps.",
    relatedModules: Object.freeze(["operationsWorkforce", "learningAudit"]),
    relatedTerms: Object.freeze(["capacity", "signal"]),
  }),
  capacityOverrideScheduled: Object.freeze({
    id: "capacityOverrideScheduled",
    kind: "option",
    title: "Capacity Override: Scheduled",
    aliases: Object.freeze(["override scheduled"]),
    meaning: "Uses scheduled shifts as the active near-horizon capacity source.",
    whyItHappens: "Selected when shift plans are more reliable than baseline/ramp estimates.",
    whatToDo: "Keep schedule completeness current to preserve reliability.",
    whatItAffects: "Operational pace projections and weekly workload confidence.",
    ifIgnored: "Missing schedule updates can quickly stale feasibility outputs.",
    relatedModules: Object.freeze(["operationsWorkforce"]),
    relatedTerms: Object.freeze(["capacity", "readiness"]),
  }),
  capacityOverrideMax: Object.freeze({
    id: "capacityOverrideMax",
    kind: "option",
    title: "Capacity Override: Max",
    aliases: Object.freeze(["override max"]),
    meaning: "Uses optimistic upper-bound capacity for stress or stretch planning.",
    whyItHappens: "Selected for upside sensitivity and edge-case planning.",
    whatToDo: "Treat as aggressive scenario, not default operating assumption.",
    whatItAffects: "Gap diagnostics, pace framing, and decision significance.",
    ifIgnored: "Teams may treat stretch assumptions as guaranteed capacity.",
    relatedModules: Object.freeze(["scenarioManager", "operationsWorkforce"]),
    relatedTerms: Object.freeze(["capacity", "realism"]),
  }),
  voterAdapterCanonicalV1: Object.freeze({
    id: "voterAdapterCanonicalV1",
    kind: "option",
    title: "Voter Adapter: Canonical v1",
    aliases: Object.freeze(["canonical adapter"]),
    meaning: "Uses the canonical voter adapter contract for aggregate intake and mapping.",
    whyItHappens: "Selected to enforce stable canonical field normalization.",
    whatToDo: "Keep import payloads aligned with documented canonical schema requirements.",
    whatItAffects: "Voter import compatibility, mapped-field coverage, and downstream segmentation.",
    ifIgnored: "Input drift can reduce coverage and degrade readiness confidence.",
    relatedModules: Object.freeze(["campaignDataRequirements", "learningAudit"]),
    relatedTerms: Object.freeze(["readiness", "calibration"]),
  }),
});

const MESSAGE_LOOKUP = Object.freeze(buildMessageLookup());

function buildMessageLookup(){
  /** @type {Record<string, string>} */
  const out = Object.create(null);
  for (const entry of Object.values(MESSAGE_REGISTRY)){
    const id = clean(entry?.id);
    if (!id) continue;
    const aliases = [
      id,
      clean(entry?.title),
      ...(Array.isArray(entry?.aliases) ? entry.aliases : []),
    ];
    for (const alias of aliases){
      const normalized = normalizeLookupToken(alias);
      if (!normalized || out[normalized]) continue;
      out[normalized] = id;
    }
  }
  return out;
}

/**
 * @param {string=} messageId
 */
export function normalizeMessageId(messageId = ""){
  const direct = clean(messageId);
  if (!direct) return "";
  if (MESSAGE_REGISTRY[direct]) return direct;
  const normalized = normalizeLookupToken(direct);
  if (!normalized) return "";
  return clean(MESSAGE_LOOKUP[normalized]);
}

/**
 * @param {string=} messageId
 */
export function getMessageDefinition(messageId = ""){
  const id = normalizeMessageId(messageId);
  if (!id) return null;
  return MESSAGE_REGISTRY[id] || null;
}

export function listMessageDefinitions(){
  return Object.values(MESSAGE_REGISTRY);
}
