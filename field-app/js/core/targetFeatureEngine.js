// @ts-check
import {
  TARGET_BASE_SCORE_WEIGHT_KEYS,
  TARGET_FEATURE_KEYS,
  TARGET_SCORING_PROFILES,
} from "./targetFeatureRegistry.js";
import { buildUpliftFeatures } from "./upliftFeatures.js";
import { computeUpliftPlan } from "./upliftModel.js";
import { BASE_RATE_DEFAULTS, resolveStateBaseRates } from "./baseRates.js";
import { deriveVoterModelSignals, extractCensusAgeDistribution } from "./voterDataLayer.js";
import { clampFiniteNumber, coerceFiniteNumber, formatFixedNumber } from "./utils.js";

const safeNum = coerceFiniteNumber;
const clamp = clampFiniteNumber;

export const MASTER_TARGETING_LAW_VERSION = "v1";
const MASTER_TARGETING_LAW_BASE_SCALE = 100;

const LEGACY_WEIGHT_KEYS = Object.freeze([
  "votePotential",
  "turnoutOpportunity",
  "persuasionIndex",
  "fieldEfficiency",
  "networkValue",
]);

const NON_BASE_FEATURE_KEYS = Object.freeze(
  TARGET_FEATURE_KEYS.filter((key) => !TARGET_BASE_SCORE_WEIGHT_KEYS.includes(key)),
);

const EXPLAIN_LABELS = Object.freeze({
  votePotential: "Vote potential",
  turnoutOpportunity: "Turnout opportunity",
  persuasionIndex: "Persuasion index",
  adjustedPersuasion: "Adjusted persuasion",
  fieldEfficiency: "Field efficiency",
  networkValue: "Network value",
  contactProbability: "Contact probability",
  geographicMultiplier: "Geographic fit",
  saturationMultiplier: "Saturation headroom",
});

function minMaxNormalizeSeries(values, fallback = 0){
  const nums = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!nums.length){
    return values.map(() => fallback);
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min){
    return values.map(() => 0.5);
  }
  const span = max - min;
  return values.map((value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp((n - min) / span, 0, 1);
  });
}

export function buildNormalizedTargetComponents(rows){
  const list = Array.isArray(rows) ? rows : [];
  const voteNorm = minMaxNormalizeSeries(list.map((row) => row?.rawSignals?.votePotentialRaw), 0);
  const turnoutNorm = minMaxNormalizeSeries(list.map((row) => row?.rawSignals?.turnoutOpportunityRaw), 0);
  const persuasionNorm = minMaxNormalizeSeries(list.map((row) => row?.rawSignals?.persuasionIndexRaw), 0);
  const fieldNorm = minMaxNormalizeSeries(list.map((row) => row?.rawSignals?.fieldEfficiencyRaw), 0);
  return list.map((_, idx) => ({
    votePotential: voteNorm[idx],
    turnoutOpportunity: turnoutNorm[idx],
    persuasionIndex: persuasionNorm[idx],
    fieldEfficiency: fieldNorm[idx],
  }));
}

function readProfileAdjustedPersuasion(profile = {}){
  const adjusted = Number(profile?.adjustedPersuasion);
  if (Number.isFinite(adjusted)) return Math.max(0, adjusted);
  const legacyPersuasion = Number(profile?.persuasionIndex);
  if (Number.isFinite(legacyPersuasion)) return Math.max(0, legacyPersuasion);
  return 0;
}

export function resolveCanonicalWeightProfile({ profileId, customWeights } = {}){
  const id = String(profileId || "house_v1").trim();
  const baseProfile = TARGET_SCORING_PROFILES[id] || TARGET_SCORING_PROFILES.house_v1;
  const out = {};

  for (const key of TARGET_FEATURE_KEYS){
    out[key] = 0;
  }
  for (const key of TARGET_BASE_SCORE_WEIGHT_KEYS){
    if (key === "adjustedPersuasion"){
      out.adjustedPersuasion = readProfileAdjustedPersuasion(baseProfile);
      continue;
    }
    out[key] = Math.max(0, Number(baseProfile?.[key] ?? 0));
  }

  const src = customWeights && typeof customWeights === "object" ? customWeights : {};
  if (Number.isFinite(Number(src?.votePotential))){
    out.votePotential = Math.max(0, Number(src.votePotential));
  }
  if (Number.isFinite(Number(src?.turnoutOpportunity))){
    out.turnoutOpportunity = Math.max(0, Number(src.turnoutOpportunity));
  }
  if (Number.isFinite(Number(src?.fieldEfficiency))){
    out.fieldEfficiency = Math.max(0, Number(src.fieldEfficiency));
  }
  if (Number.isFinite(Number(src?.networkValue))){
    out.networkValue = Math.max(0, Number(src.networkValue));
  }
  if (Number.isFinite(Number(src?.adjustedPersuasion))){
    out.adjustedPersuasion = Math.max(0, Number(src.adjustedPersuasion));
  } else if (Number.isFinite(Number(src?.persuasionIndex))){
    out.adjustedPersuasion = Math.max(0, Number(src.persuasionIndex));
  }

  const hasLegacyCustom =
    LEGACY_WEIGHT_KEYS.some((key) => Number.isFinite(Number(src?.[key])))
    && !Number.isFinite(Number(src?.adjustedPersuasion));
  if (hasLegacyCustom){
    const legacyTotal =
      Math.max(0, Number(src?.votePotential ?? 0)) +
      Math.max(0, Number(src?.turnoutOpportunity ?? 0)) +
      Math.max(0, Number(src?.persuasionIndex ?? 0)) +
      Math.max(0, Number(src?.fieldEfficiency ?? 0)) +
      Math.max(0, Number(src?.networkValue ?? 0));
    if (legacyTotal > 0){
      out.votePotential = Math.max(0, Number(src?.votePotential ?? 0)) / legacyTotal;
      out.turnoutOpportunity = Math.max(0, Number(src?.turnoutOpportunity ?? 0)) / legacyTotal;
      out.adjustedPersuasion = Math.max(0, Number(src?.persuasionIndex ?? 0)) / legacyTotal;
      out.fieldEfficiency = Math.max(0, Number(src?.fieldEfficiency ?? 0)) / legacyTotal;
      out.networkValue = Math.max(0, Number(src?.networkValue ?? 0)) / legacyTotal;
    }
  }

  const total = TARGET_BASE_SCORE_WEIGHT_KEYS.reduce((sum, key) => sum + Math.max(0, Number(out[key] ?? 0)), 0);
  if (total <= 0){
    const fallback = 1 / TARGET_BASE_SCORE_WEIGHT_KEYS.length;
    for (const key of TARGET_BASE_SCORE_WEIGHT_KEYS){
      out[key] = fallback;
    }
  } else {
    for (const key of TARGET_BASE_SCORE_WEIGHT_KEYS){
      out[key] = Math.max(0, Number(out[key] ?? 0)) / total;
    }
  }

  // Backward-compatible alias for existing UI/control wiring.
  out.persuasionIndex = out.adjustedPersuasion;
  for (const key of NON_BASE_FEATURE_KEYS){
    if (key === "persuasionIndex") continue;
    out[key] = 0;
  }
  return out;
}

function normalizeGeoMultiplier(value){
  const n = safeNum(value);
  return clamp(n == null ? 1 : n, 0.75, 1.25);
}

function normalizeSaturationMultiplier(value, fallbackContactProbability, voterDefault){
  const explicit = safeNum(value);
  if (explicit != null){
    return clamp(explicit, 0.5, 1.1);
  }
  const voter = safeNum(voterDefault);
  if (voter != null){
    return clamp(voter, 0.5, 1.1);
  }
  const contact = clamp(Number(fallbackContactProbability ?? 0), 0, 1);
  const inferred = 1 - Math.max(0, contact - 0.55) * 0.55;
  return clamp(inferred, 0.65, 1.0);
}

function featureScoreValue(key, rawValue){
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return 0;
  if (key === "geographicMultiplier"){
    return clamp((n - 0.75) / 0.5, 0, 1);
  }
  if (key === "saturationMultiplier"){
    return clamp((n - 0.5) / 0.6, 0, 1);
  }
  return clamp(n, 0, 1);
}

function computeSupportCenteredPersuasionMultiplier(supportScore){
  const centered = 1 - (2 * Math.abs(0.5 - clamp(Number(supportScore), 0, 1)));
  return Math.max(0, centered);
}

function resolveSupportScore({ rawSignals, config, baseSupportRate } = {}){
  const explicitRaw = safeNum(rawSignals?.supportScore);
  if (explicitRaw != null) return clamp(explicitRaw, 0, 1);
  const explicitConfig = safeNum(config?.supportScore);
  if (explicitConfig != null) return clamp(explicitConfig, 0, 1);
  return clamp(Number(baseSupportRate ?? BASE_RATE_DEFAULTS.sr), 0, 1);
}

function resolveExpectedVotesReachable({ features, rawSignals, config, baseRates } = {}){
  const explicitRaw = safeNum(rawSignals?.expectedVotesReachable);
  if (explicitRaw != null){
    return clamp(explicitRaw, 0, 5000);
  }
  const explicitConfig = safeNum(config?.expectedVotesReachable);
  if (explicitConfig != null){
    return clamp(explicitConfig, 0, 5000);
  }
  const supportRate = clamp(Number(baseRates?.sr ?? BASE_RATE_DEFAULTS.sr), 0.01, 1);
  const turnoutReliability = clamp(Number(baseRates?.tr ?? BASE_RATE_DEFAULTS.tr), 0.01, 1);
  return clamp(supportRate * turnoutReliability, 0, 1);
}

function resolveCostPerContact({ rawSignals, config } = {}){
  const explicitRaw = safeNum(rawSignals?.costPerContact);
  if (explicitRaw != null){
    return clamp(explicitRaw, 0.01, 10000);
  }
  const explicitConfig = safeNum(config?.costPerContact);
  if (explicitConfig != null){
    return clamp(explicitConfig, 0.01, 10000);
  }
  return 1;
}

export function computeMasterTargetingEquation({
  features = {},
  weightProfile = {},
  expectedVotesReachable = null,
  costPerContact = null,
  baseScale = MASTER_TARGETING_LAW_BASE_SCALE,
} = {}){
  const baseWeighted = (
    (clamp(Number(features?.votePotential ?? 0), 0, 1) * Math.max(0, Number(weightProfile?.votePotential ?? 0))) +
    (clamp(Number(features?.turnoutOpportunity ?? 0), 0, 1) * Math.max(0, Number(weightProfile?.turnoutOpportunity ?? 0))) +
    (clamp(Number(features?.adjustedPersuasion ?? 0), 0, 1) * Math.max(0, Number(weightProfile?.adjustedPersuasion ?? 0))) +
    (clamp(Number(features?.fieldEfficiency ?? 0), 0, 1) * Math.max(0, Number(weightProfile?.fieldEfficiency ?? 0))) +
    (clamp(Number(features?.networkValue ?? 0), 0, 1) * Math.max(0, Number(weightProfile?.networkValue ?? 0)))
  );
  const baseScore = baseWeighted * Number(baseScale || MASTER_TARGETING_LAW_BASE_SCALE);
  const contactProbability = clamp(Number(features?.contactProbability ?? 0), 0, 1);
  const geographicMultiplier = clamp(Number(features?.geographicMultiplier ?? 1), 0.75, 1.25);
  const saturationMultiplier = clamp(Number(features?.saturationMultiplier ?? 1), 0.5, 1.1);
  const targetScore = baseScore * contactProbability * geographicMultiplier * saturationMultiplier;
  const reachable = Math.max(0, Number(expectedVotesReachable ?? 0));
  const cpc = Math.max(0.01, Number(costPerContact ?? 1));
  const expectedNetVoteValue = (targetScore * reachable) / cpc;
  return {
    baseScore,
    targetScore,
    expectedNetVoteValue,
    terms: {
      contactProbability,
      geographicMultiplier,
      saturationMultiplier,
      expectedVotesReachable: reachable,
      costPerContact: cpc,
    },
  };
}

export function buildCanonicalTargetFeatures({
  components = {},
  rawSignals = {},
  state = {},
  config = {},
} = {}){
  const voterSignals = deriveVoterModelSignals(state?.voterData, {
    censusAgeDistribution: extractCensusAgeDistribution(state?.census),
    universeSize: safeNum(state?.universeSize),
  });
  const votePotential = clamp(Number(components?.votePotential), 0, 1);
  const turnoutOpportunityBase = clamp(Number(components?.turnoutOpportunity), 0, 1);
  const persuasionIndexBase = clamp(Number(components?.persuasionIndex), 0, 1);
  const turnoutOpportunity = clamp(
    turnoutOpportunityBase * clamp(Number(voterSignals?.targeting?.turnoutOpportunityMultiplier ?? 1), 0.82, 1.25),
    0,
    1,
  );
  const persuasionIndex = clamp(
    persuasionIndexBase * clamp(Number(voterSignals?.targeting?.persuasionIndexMultiplier ?? 1), 0.85, 1.18),
    0,
    1,
  );
  const fieldEfficiency = clamp(Number(components?.fieldEfficiency), 0, 1);

  const networkValueSeed = safeNum(rawSignals?.networkValue);
  const networkValue = clamp(
    networkValueSeed
      ?? safeNum(config?.networkValueDefault)
      ?? safeNum(voterSignals?.targeting?.networkValueDefault)
      ?? 0,
    0,
    1,
  );

  const baseRates = resolveStateBaseRates(state, {
    defaults: BASE_RATE_DEFAULTS,
    clampMin: 0.01,
    clampMax: 1,
  });
  const supportScore = resolveSupportScore({
    rawSignals,
    config,
    baseSupportRate: baseRates?.sr ?? BASE_RATE_DEFAULTS.sr,
  });
  const persuasionMultiplier = computeSupportCenteredPersuasionMultiplier(supportScore);
  const adjustedPersuasion = clamp(persuasionIndex * persuasionMultiplier, 0, 1);

  const baseContactRate = clamp(Number(baseRates?.cr ?? BASE_RATE_DEFAULTS.cr), 0.01, 1);
  const voterContactMultiplier = clamp(
    Number(voterSignals?.targeting?.contactProbabilityMultiplier ?? 1),
    0.65,
    1.25,
  );
  const contactProbability = clamp(
    baseContactRate *
      clamp(Number(rawSignals?.contactRateModifier ?? 1), 0.65, 1.25) *
      voterContactMultiplier *
      clamp(Number(voterSignals?.targeting?.ageContactProbabilityMultiplier ?? 1), 0.85, 1.1) *
      clamp(Number(rawSignals?.availabilityModifier ?? 1), 0.65, 1.2),
    0,
    1,
  );

  const geographicMultiplier = normalizeGeoMultiplier(rawSignals?.densityBand?.multiplier);
  const saturationMultiplier = normalizeSaturationMultiplier(
    config?.saturationMultiplier,
    contactProbability,
    voterSignals?.targeting?.saturationMultiplierDefault,
  );
  const expectedVotesReachable = resolveExpectedVotesReachable({
    features: { contactProbability },
    rawSignals,
    config,
    baseRates,
  });
  const costPerContact = resolveCostPerContact({ rawSignals, config });

  return {
    votePotential,
    turnoutOpportunity,
    persuasionIndex,
    supportScore,
    persuasionMultiplier,
    adjustedPersuasion,
    fieldEfficiency,
    networkValue,
    contactProbability,
    geographicMultiplier,
    saturationMultiplier,
    expectedVotesReachable,
    costPerContact,
  };
}

export function scoreCanonicalTarget({
  features = {},
  state = {},
  profileId = "house_v1",
  customWeights = null,
  config = {},
} = {}){
  const weightProfile = resolveCanonicalWeightProfile({ profileId, customWeights });
  const featureScores = {};
  for (const key of TARGET_FEATURE_KEYS){
    featureScores[key] = featureScoreValue(key, features[key]);
  }

  const baseRates = resolveStateBaseRates(state, {
    defaults: BASE_RATE_DEFAULTS,
    clampMin: 0.01,
    clampMax: 1,
  });
  const scored = computeMasterTargetingEquation({
    features,
    weightProfile,
    expectedVotesReachable: (
      safeNum(features?.expectedVotesReachable)
      ?? resolveExpectedVotesReachable({ features, rawSignals: null, config, baseRates })
    ),
    costPerContact: (
      safeNum(features?.costPerContact)
      ?? resolveCostPerContact({ rawSignals: null, config })
    ),
  });

  const driverRows = TARGET_BASE_SCORE_WEIGHT_KEYS.map((key) => ({
    key,
    label: EXPLAIN_LABELS[key] || key,
    contribution: featureScores[key] * weightProfile[key],
    value: featureScores[key],
    weight: weightProfile[key],
  }))
    .sort((a, b) => Number(b.contribution) - Number(a.contribution))
    .slice(0, 3);

  return {
    profileId: String(profileId || "house_v1"),
    targetingLawVersion: MASTER_TARGETING_LAW_VERSION,
    weightProfile,
    featureScores,
    scores: {
      baseScore: scored.baseScore,
      targetScore: scored.targetScore,
      expectedNetVoteValue: scored.expectedNetVoteValue,
      expectedVotesReachable: scored.terms.expectedVotesReachable,
      costPerContact: scored.terms.costPerContact,
    },
    explain: {
      topDrivers: driverRows.map((row) => ({
        key: row.key,
        label: row.label,
        text: `${row.label} contributes ${formatFixedNumber(row.contribution * 100, 0)} bp.`,
      })),
      driverRows,
    },
  };
}

export function computeCanonicalTargetMetrics({
  components = {},
  rawSignals = {},
  state = {},
  profileId = "house_v1",
  customWeights = null,
  config = {},
} = {}){
  const features = buildCanonicalTargetFeatures({ components, rawSignals, state, config });
  const scoring = scoreCanonicalTarget({
    features,
    state,
    profileId,
    customWeights,
    config,
  });
  const upliftFeatures = buildUpliftFeatures({
    rawSignals,
    state,
    canonicalFeatures: features,
  });
  const uplift = computeUpliftPlan({
    features: upliftFeatures,
    state,
    channels: Array.isArray(config?.upliftChannels) ? config.upliftChannels : undefined,
  });
  const upliftExpected = clamp(Number(uplift?.expectedMarginalGain ?? 0), 0, 1.25);
  const upliftAdjustedExpectedNet = scoring.scores.targetScore * upliftExpected;
  return {
    features,
    ...scoring,
    scores: {
      ...scoring.scores,
      upliftAdjustedExpectedNetVoteValue: upliftAdjustedExpectedNet,
    },
    uplift: {
      features: upliftFeatures,
      ...uplift,
    },
  };
}
