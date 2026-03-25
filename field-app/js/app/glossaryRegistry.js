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
  percentileRange: Object.freeze({
    id: "percentileRange",
    term: "Percentile Range",
    definition: "A way of showing different points across a forecast distribution, from lower-end to higher-end plausible outcomes.",
    whyItMatters: "It helps the team see not just the middle expectation, but how much downside and upside surround that expectation. That makes planning more honest.",
    aliases: Object.freeze(["outcome band", "forecast percentile"]),
    relatedModules: Object.freeze(["forecastOutcome", "governanceConfidence"]),
  }),
  median: Object.freeze({
    id: "median",
    term: "Median",
    definition: "The middle forecast value, where half of modeled outcomes fall below it and half above it.",
    whyItMatters: "Usually the best single anchor for balanced planning because it avoids both panic and fantasy. In most campaign conversations, this is the clearest place to start.",
    aliases: Object.freeze(["P50", "middle case", "center of gravity"]),
    relatedModules: Object.freeze(["forecastOutcome", "warRoomDecisionSession"]),
  }),
  planningFloor: Object.freeze({
    id: "planningFloor",
    term: "Planning Floor",
    definition: "A lower-end but still plausible planning case used to protect commitments against softer performance.",
    whyItMatters: "It keeps staffing, pacing, and promises from depending too heavily on upside. It is the number you use when the cost of missing is high.",
    aliases: Object.freeze(["conservative case", "lower-bound planning case", "protective case"]),
    relatedModules: Object.freeze(["forecastOutcome", "warRoomDecisionSession"]),
  }),
  upsideCase: Object.freeze({
    id: "upsideCase",
    term: "Upside Case",
    definition: "A stronger outcome that is possible when conditions break favorably and execution is strong.",
    whyItMatters: "Useful for stretch planning and ceiling checks, but risky when mistaken for the baseline. Upside should be understood deliberately, not quietly assumed.",
    aliases: Object.freeze(["high case", "stretch case", "ceiling-side case"]),
    relatedModules: Object.freeze(["forecastOutcome", "warRoomDecisionSession"]),
  }),
  confidenceBand: Object.freeze({
    id: "confidenceBand",
    term: "Confidence Band",
    definition: "The spread between forecast points that shows how tight or wide modeled uncertainty is.",
    whyItMatters: "A tighter band suggests more stability and a clearer signal. A wider band signals more uncertainty and more need for caution, even when the top-line number looks attractive.",
    aliases: Object.freeze(["uncertainty band", "forecast spread"]),
    relatedModules: Object.freeze(["forecastOutcome", "governanceConfidence"]),
  }),
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
  raceTemplate: Object.freeze({
    id: "raceTemplate",
    term: "Race Template",
    definition: "Main preset package that sets starting planning posture and default assumptions.",
    whyItMatters: "The selected template sets the opening context for downstream planning values.",
    aliases: Object.freeze(["template"]),
    relatedModules: Object.freeze(["districtRaceContext", "templateArchetype"]),
  }),
  electionDateField: Object.freeze({
    id: "electionDateField",
    term: "Election Date",
    definition: "The election the scenario is trying to reach.",
    whyItMatters: "Timeline pressure, pacing math, and readiness checks all depend on this date being correct.",
    aliases: Object.freeze(["election date"]),
    relatedModules: Object.freeze(["districtRaceContext", "operatorWorkflowGuide"]),
  }),
  weeksRemainingOverride: Object.freeze({
    id: "weeksRemainingOverride",
    term: "Weeks Remaining (Override)",
    definition: "Manual planning-horizon override when the working timeline differs from the calendar.",
    whyItMatters: "It lets operators reflect real scheduling constraints without changing election metadata.",
    aliases: Object.freeze(["weeks override"]),
    relatedModules: Object.freeze(["districtRaceContext", "planOperationsGuide"]),
  }),
  officeLevelContext: Object.freeze({
    id: "officeLevelContext",
    term: "Office Level",
    definition: "Scale and class of contest context used to interpret planning posture.",
    whyItMatters: "Office context shapes uncertainty framing and interpretation across modules.",
    aliases: Object.freeze(["office level"]),
    relatedModules: Object.freeze(["districtRaceContext"]),
  }),
  electionTypeField: Object.freeze({
    id: "electionTypeField",
    term: "Election Type",
    definition: "Contest type such as general, primary, or special.",
    whyItMatters: "Different election structures often produce different turnout and persuasion behavior.",
    aliases: Object.freeze(["election type"]),
    relatedModules: Object.freeze(["districtRaceContext"]),
  }),
  seatContextField: Object.freeze({
    id: "seatContextField",
    term: "Seat Context",
    definition: "Strategic race posture such as open, incumbent, challenger, executive, or legislative.",
    whyItMatters: "Seat posture changes how assumptions should be interpreted and stress-tested.",
    aliases: Object.freeze(["seat context"]),
    relatedModules: Object.freeze(["districtRaceContext"]),
  }),
  partisanshipModeField: Object.freeze({
    id: "partisanshipModeField",
    term: "Partisanship Mode",
    definition: "Whether party structure materially organizes the race.",
    whyItMatters: "It frames how coalition and behavior assumptions should be read.",
    aliases: Object.freeze(["partisanship mode"]),
    relatedModules: Object.freeze(["districtRaceContext"]),
  }),
  salienceLevelField: Object.freeze({
    id: "salienceLevelField",
    term: "Salience Level",
    definition: "How hot, visible, or volatile the race environment is.",
    whyItMatters: "Higher salience generally requires more cautious interpretation of stability.",
    aliases: Object.freeze(["salience level"]),
    relatedModules: Object.freeze(["districtRaceContext"]),
  }),
  sourceNoteField: Object.freeze({
    id: "sourceNoteField",
    term: "Source Note",
    definition: "Human note explaining what the current setup is grounded in.",
    whyItMatters: "Source notes preserve traceability and help prevent silent assumption drift.",
    aliases: Object.freeze(["source note"]),
    relatedModules: Object.freeze(["districtElectorate", "campaignDataRequirements"]),
  }),
  universeSizeField: Object.freeze({
    id: "universeSizeField",
    term: "Universe Size (U)",
    definition: "Relevant voter base the model is built on.",
    whyItMatters: "Labor, pacing, and vote-path estimates all scale from this base.",
    aliases: Object.freeze(["universe size"]),
    relatedModules: Object.freeze(["districtElectorate"]),
  }),
  universeBasisField: Object.freeze({
    id: "universeBasisField",
    term: "Universe Basis",
    definition: "Rule for what U represents.",
    whyItMatters: "Inconsistent basis choices create fake precision across downstream modules.",
    aliases: Object.freeze(["universe basis"]),
    relatedModules: Object.freeze(["districtElectorate"]),
  }),
  supportRetention: Object.freeze({
    id: "supportRetention",
    term: "Support Retention",
    definition: "Share of baseline support expected to hold through Election Day.",
    whyItMatters: "Retention assumptions strongly affect reach pressure and outcome fragility.",
    aliases: Object.freeze(["retention factor"]),
    relatedModules: Object.freeze(["districtElectorate", "reachOperationsGuide"]),
  }),
  turnoutBandWidth: Object.freeze({
    id: "turnoutBandWidth",
    term: "Band Width (±)",
    definition: "Uncertainty spread around turnout conditions.",
    whyItMatters: "Band width sets how much downside and upside risk should be planned for.",
    aliases: Object.freeze(["band width"]),
    relatedModules: Object.freeze(["districtTurnoutBaseline", "forecastOutcome"]),
  }),
  targetModelField: Object.freeze({
    id: "targetModelField",
    term: "Target Model",
    definition: "Scoring framework used for ranking geographies.",
    whyItMatters: "Model choice determines what the ranking engine prioritizes.",
    aliases: Object.freeze(["target model"]),
    relatedModules: Object.freeze(["districtTargetConfig", "targetingLab"]),
  }),
  topN: Object.freeze({
    id: "topN",
    term: "Top N",
    definition: "Number of highest-ranked geographies returned.",
    whyItMatters: "Top N controls breadth-versus-focus tradeoffs in turf output.",
    aliases: Object.freeze(["top n"]),
    relatedModules: Object.freeze(["districtTargetConfig", "targetingLab"]),
  }),
  minimumScore: Object.freeze({
    id: "minimumScore",
    term: "Minimum Score",
    definition: "Score threshold a geography must clear for inclusion.",
    whyItMatters: "Raising or lowering this floor directly changes turf quality and volume.",
    aliases: Object.freeze(["min score"]),
    relatedModules: Object.freeze(["districtTargetConfig", "targetingLab"]),
  }),
  densityFloor: Object.freeze({
    id: "densityFloor",
    term: "Density Floor",
    definition: "Minimum density requirement for inclusion.",
    whyItMatters: "Density filters shape field efficiency and coverage practicality.",
    aliases: Object.freeze(["density floor"]),
    relatedModules: Object.freeze(["districtTargetConfig", "targetingLab"]),
  }),
  earlyVoteExpected: Object.freeze({
    id: "earlyVoteExpected",
    term: "Early Vote Expected",
    definition: "Share of vote likely to arrive before Election Day.",
    whyItMatters: "Early vote share changes remaining persuadable volume and timeline pressure.",
    aliases: Object.freeze(["early vote expected"]),
    relatedModules: Object.freeze(["reachOperationsGuide", "districtRaceContext"]),
  }),
  dataBundleField: Object.freeze({
    id: "dataBundleField",
    term: "Data Bundle",
    definition: "External packaged data source used by the system.",
    whyItMatters: "Bundle quality and provenance control downstream trust and reproducibility.",
    aliases: Object.freeze(["data bundle"]),
    relatedModules: Object.freeze(["dataOperationsGuide"]),
  }),
  geoUnitsField: Object.freeze({
    id: "geoUnitsField",
    term: "GEO Units",
    definition: "Selected geographies used by the system.",
    whyItMatters: "Selections must be coherent before targeting or interpretation can be trusted.",
    aliases: Object.freeze(["geo units"]),
    relatedModules: Object.freeze(["dataOperationsGuide", "districtTargetConfig"]),
  }),
  geographyLevelField: Object.freeze({
    id: "geographyLevelField",
    term: "Geography Level",
    definition: "Unit level used for analysis or turfing.",
    whyItMatters: "Operational execution should match the level chosen for ranking and planning.",
    aliases: Object.freeze(["geography level"]),
    relatedModules: Object.freeze(["districtTargetConfig", "dataOperationsGuide"]),
  }),
  scenarioLockField: Object.freeze({
    id: "scenarioLockField",
    term: "Scenario Lock",
    definition: "Control that freezes editable controls until intentionally unlocked.",
    whyItMatters: "Locking preserves comparability and prevents silent drift in high-stakes reviews.",
    aliases: Object.freeze(["scenario lock"]),
    relatedModules: Object.freeze(["controlsOperationsGuide", "scenarioOperationsGuide"]),
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
