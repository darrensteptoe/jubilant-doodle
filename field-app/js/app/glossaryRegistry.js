// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim();
}

function normalizeLookupToken(value){
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Canonical glossary registry.
 * Static definitions only; no live computed values stored here.
 */
export const GLOSSARY_REGISTRY = Object.freeze({
  variance: Object.freeze({
    id: "variance",
    term: "Variance",
    definition: "The spread of plausible outcomes around an expected value.",
    whyItMatters: "Higher variance lowers planning certainty and increases decision risk.",
    aliases: Object.freeze(["outcome variance"]),
    relatedModules: Object.freeze(["forecastOutcome", "governanceConfidence"]),
  }),
  lift: Object.freeze({
    id: "lift",
    term: "Lift",
    definition: "Incremental improvement above baseline caused by an intervention.",
    whyItMatters: "Planning depends on incremental effect, not gross activity volume.",
    aliases: Object.freeze(["incremental lift"]),
    relatedModules: Object.freeze(["turnoutContactSaturation", "optimizer"]),
  }),
  persuasion: Object.freeze({
    id: "persuasion",
    term: "Persuasion",
    definition: "Movement of support among voters not already firmly committed.",
    whyItMatters: "Persuasion assumptions directly affect needed contacts and budget.",
    aliases: Object.freeze(["persuadable"]),
    relatedModules: Object.freeze(["targetUniverseMatrix", "targetingLab"]),
  }),
  turnoutOpportunity: Object.freeze({
    id: "turnoutOpportunity",
    term: "Turnout Opportunity",
    definition: "Potential vote gain from increasing participation among favorable voters.",
    whyItMatters: "Improves vote path when persuasion potential is limited.",
    aliases: Object.freeze(["turnout upside"]),
    relatedModules: Object.freeze(["turnoutContactSaturation", "targetUniverseMatrix"]),
  }),
  turnoutElasticity: Object.freeze({
    id: "turnoutElasticity",
    term: "Turnout Elasticity",
    definition: "Sensitivity of turnout outcomes to additional contact or organizing pressure.",
    whyItMatters: "Distinguishes where extra field effort is likely to move participation versus plateau.",
    aliases: Object.freeze(["elasticity"]),
    relatedModules: Object.freeze(["turnoutContactSaturation", "targetingLab"]),
  }),
  contactProbability: Object.freeze({
    id: "contactProbability",
    term: "Contact Probability",
    definition: "Chance that an attempt results in a valid voter contact.",
    whyItMatters: "Converts raw attempts into realistic conversation expectations.",
    aliases: Object.freeze(["contact rate", "contact likelihood"]),
    relatedModules: Object.freeze(["optimizer", "operationsWorkforce"]),
  }),
  saturation: Object.freeze({
    id: "saturation",
    term: "Saturation",
    definition: "Point where additional contacts produce diminishing marginal impact.",
    whyItMatters: "Prevents overcounting gains from repeated touches.",
    aliases: Object.freeze(["contact saturation"]),
    relatedModules: Object.freeze(["turnoutContactSaturation", "optimizer"]),
  }),
  confidence: Object.freeze({
    id: "confidence",
    term: "Confidence",
    definition: "Trust level in model outputs given evidence quality and assumptions.",
    whyItMatters: "Guides whether to commit, delay, or degrade decisions.",
    aliases: Object.freeze(["trust score"]),
    relatedModules: Object.freeze(["governanceConfidence", "warRoomDecisionSession"]),
  }),
  realism: Object.freeze({
    id: "realism",
    term: "Realism",
    definition: "Assessment of whether assumptions are operationally plausible.",
    whyItMatters: "Structurally valid inputs can still be practically impossible.",
    aliases: Object.freeze(["plausibility"]),
    relatedModules: Object.freeze(["operationsWorkforce", "budgetChannelCost"]),
  }),
  bias: Object.freeze({
    id: "bias",
    term: "Bias",
    definition: "Systematic directional error in assumptions or interpretation.",
    whyItMatters: "Persistent bias can produce confidently wrong strategy.",
    aliases: Object.freeze(["systematic error"]),
    relatedModules: Object.freeze(["learningAudit", "governanceConfidence"]),
  }),
  calibration: Object.freeze({
    id: "calibration",
    term: "Calibration",
    definition: "Updating assumptions to better match observed outcomes.",
    whyItMatters: "Improves forecast reliability over the campaign cycle.",
    aliases: Object.freeze(["recalibration"]),
    relatedModules: Object.freeze(["learningAudit", "templateArchetype"]),
  }),
  votePath: Object.freeze({
    id: "votePath",
    term: "Vote Path",
    definition: "Projected route from current position to required winning votes.",
    whyItMatters: "Aligns targeting, staffing, and budget with outcome requirements.",
    aliases: Object.freeze(["path to win"]),
    relatedModules: Object.freeze(["forecastOutcome", "optimizer"]),
  }),
  fieldOrganizer: Object.freeze({
    id: "fieldOrganizer",
    term: "Field Organizer",
    definition: "Core staff role responsible for volunteer management and execution reliability.",
    whyItMatters: "Organizer coverage drives practical volunteer productivity.",
    aliases: Object.freeze(["organizer"]),
    relatedModules: Object.freeze(["operationsWorkforce"]),
  }),
  paidCanvasser: Object.freeze({
    id: "paidCanvasser",
    term: "Paid Canvasser",
    definition: "Compensated field role used for predictable contact output.",
    whyItMatters: "Adds cost but can improve output consistency under time pressure.",
    aliases: Object.freeze(["canvasser"]),
    relatedModules: Object.freeze(["operationsWorkforce", "budgetChannelCost"]),
  }),
  volunteer: Object.freeze({
    id: "volunteer",
    term: "Volunteer",
    definition: "Unpaid supporter contributing campaign contact capacity.",
    whyItMatters: "Can scale reach, but reliability and training vary widely.",
    aliases: Object.freeze(["volunteer workforce"]),
    relatedModules: Object.freeze(["operationsWorkforce"]),
  }),
  scenarioDrift: Object.freeze({
    id: "scenarioDrift",
    term: "Scenario Drift",
    definition: "Difference between expected scenario path and observed execution/data updates.",
    whyItMatters: "Signals when strategic assumptions need revision.",
    aliases: Object.freeze(["drift"]),
    relatedModules: Object.freeze(["scenarioManager", "learningAudit"]),
  }),
  signal: Object.freeze({
    id: "signal",
    term: "Signal",
    definition: "Meaningful change likely to affect decisions.",
    whyItMatters: "War room decisions should react to signal, not noise.",
    aliases: Object.freeze(["material signal"]),
    relatedModules: Object.freeze(["warRoomDecisionSession"]),
  }),
  noise: Object.freeze({
    id: "noise",
    term: "Noise",
    definition: "Short-term fluctuation that does not materially alter strategy.",
    whyItMatters: "Reduces overreaction and unnecessary tactical churn.",
    aliases: Object.freeze(["variance noise"]),
    relatedModules: Object.freeze(["warRoomDecisionSession"]),
  }),
  materialChange: Object.freeze({
    id: "materialChange",
    term: "Material Change",
    definition: "A shift large enough to alter recommendation logic or operating decisions.",
    whyItMatters: "Separates background fluctuations from changes that should trigger action.",
    aliases: Object.freeze(["meaningful change"]),
    relatedModules: Object.freeze(["warRoomDecisionSession", "forecastOutcome"]),
  }),
  actionability: Object.freeze({
    id: "actionability",
    term: "Actionability",
    definition: "Whether a signal can be translated into a concrete decision or operational adjustment now.",
    whyItMatters: "Prevents analysis loops that do not produce decisions or follow-through.",
    aliases: Object.freeze(["actionable shift"]),
    relatedModules: Object.freeze(["warRoomDecisionSession", "operationsWorkforce"]),
  }),
  decisionSignificance: Object.freeze({
    id: "decisionSignificance",
    term: "Decision Significance",
    definition: "Relative importance of a decision based on expected impact, reversibility, and timing risk.",
    whyItMatters: "Helps teams reserve escalation bandwidth for high-consequence choices.",
    aliases: Object.freeze(["significance"]),
    relatedModules: Object.freeze(["warRoomDecisionSession", "governanceConfidence"]),
  }),
  driverSummary: Object.freeze({
    id: "driverSummary",
    term: "Driver Summary",
    definition: "Compact explanation of the top factors currently moving recommendations or forecast posture.",
    whyItMatters: "Improves decision speed by focusing discussion on the highest-impact levers.",
    aliases: Object.freeze(["top drivers"]),
    relatedModules: Object.freeze(["warRoomDecisionSession", "forecastOutcome"]),
  }),
  superVoters: Object.freeze({
    id: "superVoters",
    term: "Super Voters",
    definition: "Voters with consistently high participation across cycles.",
    whyItMatters: "Useful for base mobilization and turnout certainty assumptions.",
    aliases: Object.freeze(["super voters"]),
    relatedModules: Object.freeze(["targetUniverseMatrix"]),
  }),
  highFrequencyVoters: Object.freeze({
    id: "highFrequencyVoters",
    term: "High-Frequency Voters",
    definition: "Voters with strong but not perfect turnout history.",
    whyItMatters: "High contact efficiency but potentially lower marginal turnout lift.",
    aliases: Object.freeze(["high frequency voters"]),
    relatedModules: Object.freeze(["targetUniverseMatrix"]),
  }),
  mediumFrequencyVoters: Object.freeze({
    id: "mediumFrequencyVoters",
    term: "Medium-Frequency Voters",
    definition: "Voters with intermittent but recurring turnout behavior.",
    whyItMatters: "Often represent a practical blend of turnout upside and reachable contact cost.",
    aliases: Object.freeze(["medium frequency voters"]),
    relatedModules: Object.freeze(["targetUniverseMatrix"]),
  }),
  lowPropensityVoters: Object.freeze({
    id: "lowPropensityVoters",
    term: "Low-Propensity Voters",
    definition: "Voters with infrequent turnout behavior.",
    whyItMatters: "May offer upside but often require more costly engagement.",
    aliases: Object.freeze(["low propensity voters"]),
    relatedModules: Object.freeze(["targetUniverseMatrix", "turnoutContactSaturation"]),
  }),
  dropoffVoters: Object.freeze({
    id: "dropoffVoters",
    term: "Dropoff Voters",
    definition: "Voters likely to participate in top-of-ticket races but skip down-ballot contests.",
    whyItMatters: "Down-ballot field plans should explicitly account for dropoff risk.",
    aliases: Object.freeze(["drop off voters"]),
    relatedModules: Object.freeze(["targetUniverseMatrix", "forecastOutcome"]),
  }),
  ageCohort: Object.freeze({
    id: "ageCohort",
    term: "Age Cohort",
    definition: "Age-segmented group used for turnout and persuasion strategy analysis.",
    whyItMatters: "Channel mix and expected behavior differ materially by age segment.",
    aliases: Object.freeze(["age bucket", "age segment"]),
    relatedModules: Object.freeze(["targetUniverseMatrix", "forecastOutcome"]),
  }),
  ballotBaseline: Object.freeze({
    id: "ballotBaseline",
    term: "Ballot Baseline",
    definition: "Starting vote landscape built from structural and historical indicators.",
    whyItMatters: "Anchors scenario expectations before tactical optimization.",
    aliases: Object.freeze(["baseline ballot"]),
    relatedModules: Object.freeze(["templateArchetype", "forecastOutcome"]),
  }),
  persuasionUniverse: Object.freeze({
    id: "persuasionUniverse",
    term: "Persuasion Universe",
    definition: "Target segment where movement in support is considered plausible and worth field investment.",
    whyItMatters: "Overly broad persuasion universes dilute capacity and inflate expected gains.",
    aliases: Object.freeze(["persuadable universe"]),
    relatedModules: Object.freeze(["targetUniverseMatrix", "targetingLab"]),
  }),
  mobilizationUniverse: Object.freeze({
    id: "mobilizationUniverse",
    term: "Mobilization Universe",
    definition: "Segment of voters who are supportive enough that turnout activation is the primary objective.",
    whyItMatters: "Separating mobilization from persuasion improves channel and staffing efficiency.",
    aliases: Object.freeze(["turnout universe"]),
    relatedModules: Object.freeze(["targetUniverseMatrix", "turnoutContactSaturation"]),
  }),
  costPerContact: Object.freeze({
    id: "costPerContact",
    term: "Cost Per Contact",
    definition: "Average cost required to generate one valid voter contact in a channel.",
    whyItMatters: "Unit economics drive optimizer choices and budget realism checks.",
    aliases: Object.freeze(["cpc"]),
    relatedModules: Object.freeze(["budgetChannelCost", "optimizer"]),
  }),
  capacity: Object.freeze({
    id: "capacity",
    term: "Capacity",
    definition: "Practical volume of execution a program can sustain with current staffing, time, and process constraints.",
    whyItMatters: "Plans that exceed capacity are structurally brittle even when formulas are valid.",
    aliases: Object.freeze(["operational capacity"]),
    relatedModules: Object.freeze(["operationsWorkforce", "optimizer", "warRoomDecisionSession"]),
  }),
  readiness: Object.freeze({
    id: "readiness",
    term: "Readiness",
    definition: "Degree to which required inputs and integrity checks are complete enough for trusted outputs.",
    whyItMatters: "Prevents teams from treating partially known states as decision-ready truth.",
    aliases: Object.freeze(["model readiness"]),
    relatedModules: Object.freeze(["governanceConfidence", "campaignDataRequirements"]),
  }),
});

const GLOSSARY_LOOKUP = Object.freeze(buildGlossaryLookup());

function buildGlossaryLookup(){
  /** @type {Record<string, string>} */
  const out = Object.create(null);
  for (const entry of Object.values(GLOSSARY_REGISTRY)){
    const id = clean(entry?.id);
    if (!id) continue;
    const aliases = [
      id,
      clean(entry?.term),
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
 * @param {string=} termId
 */
export function normalizeGlossaryTermId(termId = ""){
  const direct = clean(termId);
  if (!direct) return "";
  if (GLOSSARY_REGISTRY[direct]) return direct;
  const normalized = normalizeLookupToken(direct);
  if (!normalized) return "";
  return clean(GLOSSARY_LOOKUP[normalized]);
}

/**
 * @param {string=} termId
 */
export function getGlossaryTerm(termId = ""){
  const id = normalizeGlossaryTermId(termId);
  if (!id) return null;
  return GLOSSARY_REGISTRY[id] || null;
}

export function listGlossaryTerms(){
  return Object.values(GLOSSARY_REGISTRY);
}
