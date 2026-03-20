// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim();
}

function freezeEntry(entry){
  return Object.freeze({
    ...entry,
    requiredInputs: Object.freeze([...(entry.requiredInputs || [])]),
    whereUsed: Object.freeze([...(entry.whereUsed || [])]),
    relatedDoctrinePages: Object.freeze([...(entry.relatedDoctrinePages || [])]),
    relatedPlaybookEntries: Object.freeze([...(entry.relatedPlaybookEntries || [])]),
    canonicalImplementation: Object.freeze({
      module: clean(entry?.canonicalImplementation?.module),
      fn: clean(entry?.canonicalImplementation?.fn),
    }),
  });
}

export const MODEL_STATUS = Object.freeze({
  IMPLEMENTED: "implemented",
  PARTIAL: "partiallyImplemented",
  PLANNED: "planned",
  ABSORBED: "absorbed",
});

export const REQUIRED_MODEL_IDS = Object.freeze([
  "supportTurnoutMatrix",
  "expectedVoteGain",
  "turfEfficiency",
  "contactSaturation",
  "persuasionCurve",
  "congressionalTargetScore",
  "geographicPersuasionClustering",
  "volunteerProduction",
  "turnoutElasticity",
  "persuasionCost",
  "votePathOptimization",
  "socialPressure",
  "networkDiffusion",
  "currentFieldEfficiencyScore",
  "masterTargetingEquation",
]);

const MODEL_REGISTRY_INTERNAL = Object.freeze({
  supportTurnoutMatrix: freezeEntry({
    id: "supportTurnoutMatrix",
    displayName: "Support-Turnout Matrix",
    purpose: "Construct canonical support/turnout segmentation primitives for targeting and universe shaping.",
    formulaLabel: "supportTurnoutMatrix = f(votePotentialRaw, turnoutOpportunityRaw, persuasionIndexRaw)",
    canonicalImplementation: {
      module: "js/core/targetModels.js",
      fn: "deriveTargetSignalsForRow",
    },
    requiredInputs: [
      "census row aggregates",
      "turnout baseline assumptions",
      "support and contact baseline assumptions",
      "targeting criteria flags",
    ],
    outputName: "rawSignals.votePotentialRaw / rawSignals.turnoutOpportunityRaw / rawSignals.persuasionIndexRaw",
    architectureLayer: "core.targeting.signals",
    whereUsed: ["targetingLab", "targetUniverseMatrix", "forecastOutcome", "scenarioManager"],
    relatedDoctrinePages: ["targetingLab", "targetUniverseMatrix", "forecastOutcome"],
    relatedPlaybookEntries: ["persuasionUniverseTooBroad", "behindButStillLive"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Canonical owner for pre-score segmentation features.",
  }),
  expectedVoteGain: freezeEntry({
    id: "expectedVoteGain",
    displayName: "Expected Vote Gain",
    purpose: "Translate targeting score into expected net impact under reachable-contact assumptions.",
    formulaLabel: "expectedVoteGain = targetScore * expectedVotesReachable",
    canonicalImplementation: {
      module: "js/core/targetFeatureEngine.js",
      fn: "computeCanonicalTargetMetrics",
    },
    requiredInputs: [
      "targetScore",
      "contactProbability",
      "supportRate baseline",
      "turnoutReliability baseline",
      "uplift reach assumptions",
    ],
    outputName: "scores.expectedNetVoteValue",
    architectureLayer: "core.targeting.scoring",
    whereUsed: ["targetingLab", "optimizer", "forecastOutcome", "warRoomDecisionSession"],
    relatedDoctrinePages: ["targetingLab", "forecastOutcome", "optimizer"],
    relatedPlaybookEntries: ["forecastImprovedBecauseAssumptionsChanged", "behindButStillLive"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Canonical expected-vote-gain path now follows targetScore * expectedVotesReachable / costPerContact.",
  }),
  turfEfficiency: freezeEntry({
    id: "turfEfficiency",
    displayName: "Turf Efficiency",
    purpose: "Estimate execution feasibility and throughput quality by geography profile.",
    formulaLabel: "turfEfficiency = f(fieldEfficiencyRaw, doorsPerHour, walkability, availability)",
    canonicalImplementation: {
      module: "js/core/targetModels.js",
      fn: "deriveTargetSignalsForRow",
    },
    requiredInputs: [
      "housing density profile",
      "multi-unit share",
      "commute availability signals",
      "canonical throughput baselines",
    ],
    outputName: "rawSignals.fieldEfficiencyRaw / rawSignals.votesPerOrganizerHour",
    architectureLayer: "core.targeting.signals",
    whereUsed: ["targetingLab", "operationsWorkforce", "optimizer", "warRoomDecisionSession"],
    relatedDoctrinePages: ["targetingLab", "operationsWorkforce", "optimizer"],
    relatedPlaybookEntries: ["strongVolunteerCountWeakRealCapacity", "dayOfActionLooksBigButCapacityMathStillMatters"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Feeds both score components and operational capacity framing.",
  }),
  contactSaturation: freezeEntry({
    id: "contactSaturation",
    displayName: "Contact Saturation",
    purpose: "Apply diminishing headroom logic to repeated-contact assumptions.",
    formulaLabel: "saturationMultiplier = f(contactProbability, saturationDefaults, scenario pressure)",
    canonicalImplementation: {
      module: "js/core/targetFeatureEngine.js",
      fn: "buildCanonicalTargetFeatures",
    },
    requiredInputs: [
      "contactProbability",
      "saturation defaults",
      "scenario-level saturation override (optional)",
    ],
    outputName: "features.saturationMultiplier",
    architectureLayer: "core.targeting.features",
    whereUsed: ["targetingLab", "turnoutContactSaturation", "optimizer", "forecastOutcome"],
    relatedDoctrinePages: ["turnoutContactSaturation", "targetingLab", "optimizer"],
    relatedPlaybookEntries: ["lateCycleRepeatedContactFlattened", "persuasionUniverseTooBroad"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Canonical saturation is feature-level and consumed by score stack.",
  }),
  persuasionCurve: freezeEntry({
    id: "persuasionCurve",
    displayName: "Persuasion Curve",
    purpose: "Adjust raw persuasion index into reliability-aware persuasion contribution.",
    formulaLabel: "persuasionMultiplier = max(0, 1 - 2 * abs(0.5 - supportScore)); adjustedPersuasion = persuasionIndex * persuasionMultiplier",
    canonicalImplementation: {
      module: "js/core/targetFeatureEngine.js",
      fn: "buildCanonicalTargetFeatures",
    },
    requiredInputs: [
      "persuasionIndex",
      "turnout reliability signal",
      "profile-specific weighting",
    ],
    outputName: "features.adjustedPersuasion",
    architectureLayer: "core.targeting.features",
    whereUsed: ["targetingLab", "forecastOutcome", "optimizer"],
    relatedDoctrinePages: ["targetingLab", "forecastOutcome"],
    relatedPlaybookEntries: ["persuasionUniverseTooBroad", "behindButStillLive"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Support-centered persuasion multiplier is locked in canonical targeting law v1.",
  }),
  congressionalTargetScore: freezeEntry({
    id: "congressionalTargetScore",
    displayName: "Congressional Target Score",
    purpose: "Produce comparable geographic targeting scores from canonical weighted features.",
    formulaLabel: "targetScore = baseScore * contactProbability * geographicMultiplier * saturationMultiplier",
    canonicalImplementation: {
      module: "js/core/targetFeatureEngine.js",
      fn: "scoreCanonicalTarget",
    },
    requiredInputs: [
      "canonical target features",
      "weight profile",
      "geographic multiplier",
      "saturation multiplier",
    ],
    outputName: "scores.targetScore",
    architectureLayer: "core.targeting.scoring",
    whereUsed: ["targetingLab", "targetUniverseMatrix", "optimizer", "warRoomDecisionSession"],
    relatedDoctrinePages: ["targetingLab", "targetUniverseMatrix", "warRoomDecisionSession"],
    relatedPlaybookEntries: ["behindButStillLive", "optimizerOvervaluesCheapChannels"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Canonical score now uses the locked master targeting-law architecture.",
  }),
  geographicPersuasionClustering: freezeEntry({
    id: "geographicPersuasionClustering",
    displayName: "Geographic Persuasion Clustering",
    purpose: "Represent geography-specific persuasion/contact structure in scoring multipliers.",
    formulaLabel: "geographicMultiplier = f(densityBand, walkability, field conditions)",
    canonicalImplementation: {
      module: "js/core/targetModels.js",
      fn: "deriveTargetSignalsForRow",
    },
    requiredInputs: [
      "housing-to-population ratio",
      "walkability proxy signals",
      "multi-unit and commute structure",
    ],
    outputName: "rawSignals.densityBand.multiplier -> features.geographicMultiplier",
    architectureLayer: "core.targeting.signals",
    whereUsed: ["targetingLab", "optimizer", "forecastOutcome", "warRoomDecisionSession"],
    relatedDoctrinePages: ["targetingLab", "optimizer", "forecastOutcome"],
    relatedPlaybookEntries: ["persuasionUniverseTooBroad", "aheadButFragile"],
    status: MODEL_STATUS.PARTIAL,
    notes: "Current clustering proxy uses density/walkability; higher-fidelity clustering remains planned.",
  }),
  volunteerProduction: freezeEntry({
    id: "volunteerProduction",
    displayName: "Volunteer Production",
    purpose: "Convert workforce assumptions into capacity and output constraints by role and hours.",
    formulaLabel: "volunteerProduction = f(orgCount, hours, volunteerMultiplier, throughput)",
    canonicalImplementation: {
      module: "js/core/model.js",
      fn: "computeCapacityBreakdown",
    },
    requiredInputs: [
      "organizer count",
      "organizer hours per week",
      "volunteer multiplier / role mix",
      "channel throughput rates",
    ],
    outputName: "capacityBreakdown.totalCapacityContacts",
    architectureLayer: "core.operations.capacity",
    whereUsed: ["operationsWorkforce", "optimizer", "warRoomDecisionSession", "event calendar capacity effects"],
    relatedDoctrinePages: ["operationsWorkforce", "optimizer", "warRoomDecisionSession"],
    relatedPlaybookEntries: ["strongVolunteerCountWeakRealCapacity", "dayOfActionLooksBigButCapacityMathStillMatters"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Role typing and event/weather modifiers operate as bounded capacity modifiers on this path.",
  }),
  turnoutElasticity: freezeEntry({
    id: "turnoutElasticity",
    displayName: "Turnout Elasticity",
    purpose: "Scale turnout-lift expectations by district structural signals and evidence.",
    formulaLabel: "turnoutElasticity = f(age mix, renter share, competitiveness, evidence bounds)",
    canonicalImplementation: {
      module: "js/core/districtIntelBuilder.js",
      fn: "buildDistrictIntelPackFromEvidence",
    },
    requiredInputs: [
      "district evidence pack",
      "age cohort shares",
      "competitiveness/margin context",
      "bounds from intel pack",
    ],
    outputName: "districtIntelPack.indices.turnoutElasticity",
    architectureLayer: "core.district.intel",
    whereUsed: ["forecastOutcome", "templateArchetype", "scenarioManager", "warRoomDecisionSession"],
    relatedDoctrinePages: ["forecastOutcome", "templateArchetype", "scenarioManager"],
    relatedPlaybookEntries: ["aheadButFragile", "behindButStillLive"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Also surfaced in advisory diagnostics through census module outputs.",
  }),
  persuasionCost: freezeEntry({
    id: "persuasionCost",
    displayName: "Persuasion Cost",
    purpose: "Bind channel/unit economics to persuasion and turnout strategy quality.",
    formulaLabel: "persuasionCost = expectedVoteGain / costPerContact (channel-aware)",
    canonicalImplementation: {
      module: "js/core/channelCosts.js",
      fn: "computeChannelCostMetrics",
    },
    requiredInputs: [
      "channel unit costs",
      "workforce assumptions",
      "channel-specific outreach assumptions",
      "expected vote gain outputs",
    ],
    outputName: "channelCostMetrics.effectiveCostPerContact",
    architectureLayer: "core.budget.costing",
    whereUsed: ["budgetChannelCost", "optimizer", "warRoomDecisionSession", "reporting"],
    relatedDoctrinePages: ["budgetChannelCost", "optimizer", "warRoomDecisionSession"],
    relatedPlaybookEntries: ["optimizerOvervaluesCheapChannels", "behindButStillLive"],
    status: MODEL_STATUS.PARTIAL,
    notes: "Canonical cost metrics exist; dedicated persuasion-cost decomposition remains partial.",
  }),
  votePathOptimization: freezeEntry({
    id: "votePathOptimization",
    displayName: "Vote Path Optimization",
    purpose: "Find constrained allocation plans that maximize canonical objective outputs.",
    formulaLabel: "votePathOptimization = argmax objective(subject to budget/capacity/constraints)",
    canonicalImplementation: {
      module: "js/core/optimize.js",
      fn: "optimizeMixByOffice",
    },
    requiredInputs: [
      "budget constraints",
      "capacity constraints",
      "channel tactic assumptions",
      "objective selection",
    ],
    outputName: "optimization.officePathSummary / optimization.recommendedMix",
    architectureLayer: "core.optimization",
    whereUsed: ["optimizer", "forecastOutcome", "warRoomDecisionSession", "scenarioManager"],
    relatedDoctrinePages: ["optimizer", "forecastOutcome", "scenarioManager"],
    relatedPlaybookEntries: ["optimizerOvervaluesCheapChannels", "behindButStillLive"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Consumes canonical score/cost/capacity outputs; no shadow objective path.",
  }),
  socialPressure: freezeEntry({
    id: "socialPressure",
    displayName: "Social Pressure",
    purpose: "Represent peer-pressure turnout and mobilization spillover effects where evidence supports it.",
    formulaLabel: "socialPressure = f(network effects, social-contact context, turnout behavior)",
    canonicalImplementation: {
      module: "js/core/targetFeatureEngine.js",
      fn: "",
    },
    requiredInputs: [
      "network-connected voter clusters",
      "social influence priors",
      "observed turnout response evidence",
    ],
    outputName: "planned.socialPressureSignal",
    architectureLayer: "core.targeting.experimental",
    whereUsed: ["planned targeting extensions"],
    relatedDoctrinePages: ["targetingLab", "learningAudit"],
    relatedPlaybookEntries: ["lowConfidenceHighPressure"],
    status: MODEL_STATUS.PLANNED,
    notes: "Registry-only metadata entry; no canonical production computation yet.",
  }),
  networkDiffusion: freezeEntry({
    id: "networkDiffusion",
    displayName: "Network Diffusion",
    purpose: "Capture network spillover contribution as a bounded component in targeting.",
    formulaLabel: "networkValue = f(voter-network priors, diffusion assumptions)",
    canonicalImplementation: {
      module: "js/core/targetFeatureEngine.js",
      fn: "buildCanonicalTargetFeatures",
    },
    requiredInputs: [
      "voter model signals",
      "network-value defaults",
      "scenario network overrides (optional)",
    ],
    outputName: "features.networkValue",
    architectureLayer: "core.targeting.features",
    whereUsed: ["targetingLab", "forecastOutcome", "warRoomDecisionSession"],
    relatedDoctrinePages: ["targetingLab", "forecastOutcome", "learningAudit"],
    relatedPlaybookEntries: ["lowConfidenceHighPressure", "forecastImprovedBecauseAssumptionsChanged"],
    status: MODEL_STATUS.PARTIAL,
    notes: "Currently bounded and default-light; richer diffusion modeling remains planned.",
  }),
  currentFieldEfficiencyScore: freezeEntry({
    id: "currentFieldEfficiencyScore",
    displayName: "Current Field Efficiency Score",
    purpose: "Summarize present-cycle execution efficiency from capacity, pace, and friction signals.",
    formulaLabel: "currentFieldEfficiencyScore = f(votesPerOrganizerHour, capacity utilization, execution friction)",
    canonicalImplementation: {
      module: "js/core/targetModels.js",
      fn: "deriveTargetSignalsForRow",
    },
    requiredInputs: [
      "votesPerOrganizerHour",
      "fieldEfficiencyRaw",
      "current capacity modifiers (event/weather/day-bound)",
    ],
    outputName: "rawSignals.fieldEfficiencyRaw / rawSignals.votesPerOrganizerHour",
    architectureLayer: "core.operations.targeting-bridge",
    whereUsed: ["operationsWorkforce", "targetingLab", "warRoomDecisionSession"],
    relatedDoctrinePages: ["operationsWorkforce", "warRoomDecisionSession", "targetingLab"],
    relatedPlaybookEntries: ["strongVolunteerCountWeakRealCapacity", "dayOfActionLooksBigButCapacityMathStillMatters"],
    status: MODEL_STATUS.ABSORBED,
    notes: "Standalone field-efficiency scoring is absorbed into canonical target features (fieldEfficiency) and consumed through masterTargetingEquation + optimizer paths.",
  }),
  masterTargetingEquation: freezeEntry({
    id: "masterTargetingEquation",
    displayName: "Master Targeting Equation",
    purpose: "Define the one canonical targeting architecture consumed by ranking and optimization layers.",
    formulaLabel: "persuasionMultiplier=max(0,1-2*abs(0.5-supportScore)); adjustedPersuasion=persuasionIndex*persuasionMultiplier; baseScore=(voteWeight*votePotential)+(turnoutWeight*turnoutOpportunity)+(persuasionWeight*adjustedPersuasion)+(fieldWeight*fieldEfficiency)+(networkWeight*networkValue); targetScore=baseScore*contactProbability*geographicMultiplier*saturationMultiplier; expectedNetVoteValue=targetScore*expectedVotesReachable/costPerContact",
    canonicalImplementation: {
      module: "js/core/targetFeatureEngine.js",
      fn: "scoreCanonicalTarget",
    },
    requiredInputs: [
      "canonical feature vector",
      "weight profile",
      "contact probability",
      "geographic multiplier",
      "saturation multiplier",
      "cost and reach factors for expected net value",
    ],
    outputName: "scores.targetScore / scores.expectedNetVoteValue",
    architectureLayer: "core.targeting.scoring",
    whereUsed: ["targetingLab", "optimizer", "forecastOutcome", "warRoomDecisionSession", "reporting"],
    relatedDoctrinePages: ["targetingLab", "optimizer", "forecastOutcome", "warRoomDecisionSession"],
    relatedPlaybookEntries: ["optimizerOvervaluesCheapChannels", "forecastImprovedBecauseAssumptionsChanged"],
    status: MODEL_STATUS.IMPLEMENTED,
    notes: "Canonical targeting law v1 is locked and consumed by targeting ranking/optimization surfaces.",
  }),
});

const MODEL_STATUS_SET = new Set(Object.values(MODEL_STATUS));

/**
 * @param {string=} id
 */
export function getModelDefinition(id = ""){
  const key = clean(id);
  if (!key) return null;
  return MODEL_REGISTRY_INTERNAL[key] || null;
}

export function listModelDefinitions(){
  return Object.values(MODEL_REGISTRY_INTERNAL).slice();
}

export function getRequiredModelIds(){
  return REQUIRED_MODEL_IDS.slice();
}

/**
 * Phase 22 helper: verify required model coverage and status quality
 * without introducing duplicate math.
 */
export function verifyModelCoverage(){
  const models = listModelDefinitions();
  const byId = new Map(models.map((row) => [clean(row.id), row]));
  const missingRequired = REQUIRED_MODEL_IDS.filter((id) => !byId.has(id));
  const invalidStatus = models
    .filter((row) => !MODEL_STATUS_SET.has(clean(row.status)))
    .map((row) => clean(row.id));
  const unresolvedOwner = models
    .filter((row) => clean(row.status) !== MODEL_STATUS.PLANNED)
    .filter((row) => !clean(row?.canonicalImplementation?.module))
    .map((row) => clean(row.id));
  const statusCounts = {
    implemented: 0,
    partiallyImplemented: 0,
    planned: 0,
    absorbed: 0,
  };
  for (const row of models){
    const status = clean(row.status);
    if (status === MODEL_STATUS.IMPLEMENTED) statusCounts.implemented += 1;
    if (status === MODEL_STATUS.PARTIAL) statusCounts.partiallyImplemented += 1;
    if (status === MODEL_STATUS.PLANNED) statusCounts.planned += 1;
    if (status === MODEL_STATUS.ABSORBED) statusCounts.absorbed += 1;
  }
  return {
    total: models.length,
    required: REQUIRED_MODEL_IDS.length,
    missingRequired,
    invalidStatus,
    unresolvedOwner,
    statusCounts,
    ok: !missingRequired.length && !invalidStatus.length && !unresolvedOwner.length,
  };
}
