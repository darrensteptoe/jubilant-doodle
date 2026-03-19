// @ts-check
import {
  TARGET_FEATURE_KEYS,
  TARGET_SCORING_PROFILES,
} from "./targetFeatureRegistry.js";
import { buildUpliftFeatures } from "./upliftFeatures.js";
import { computeUpliftPlan } from "./upliftModel.js";
import { BASE_RATE_DEFAULTS, resolveStateBaseRates } from "./baseRates.js";
import { deriveVoterModelSignals } from "./voterDataLayer.js";
import { clampFiniteNumber, coerceFiniteNumber, formatFixedNumber } from "./utils.js";

const safeNum = coerceFiniteNumber;
const clamp = clampFiniteNumber;

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

const LEGACY_WEIGHT_KEYS = Object.freeze([
  "votePotential",
  "turnoutOpportunity",
  "persuasionIndex",
  "fieldEfficiency",
]);

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

export function resolveCanonicalWeightProfile({ profileId, customWeights } = {}){
  const id = String(profileId || "house_v1").trim();
  const baseProfile = TARGET_SCORING_PROFILES[id] || TARGET_SCORING_PROFILES.house_v1;
  const out = {};
  for (const key of TARGET_FEATURE_KEYS){
    out[key] = Math.max(0, Number(baseProfile?.[key] ?? 0));
  }

  const src = customWeights && typeof customWeights === "object" ? customWeights : {};
  const hasLegacyCustom = LEGACY_WEIGHT_KEYS.some((key) => Number.isFinite(Number(src?.[key])));
  if (hasLegacyCustom){
    let legacyTotal = 0;
    for (const key of LEGACY_WEIGHT_KEYS){
      legacyTotal += Math.max(0, Number(src?.[key] ?? 0));
    }
    if (legacyTotal > 0){
      const legacyShare = 0.86;
      for (const key of LEGACY_WEIGHT_KEYS){
        out[key] = (Math.max(0, Number(src?.[key] ?? 0)) / legacyTotal) * legacyShare;
      }
      const extras = TARGET_FEATURE_KEYS.filter((key) => !LEGACY_WEIGHT_KEYS.includes(key));
      const baseExtras = extras.reduce((sum, key) => sum + Math.max(0, Number(baseProfile?.[key] ?? 0)), 0);
      const extraShare = 1 - legacyShare;
      if (baseExtras > 0){
        for (const key of extras){
          out[key] = (Math.max(0, Number(baseProfile?.[key] ?? 0)) / baseExtras) * extraShare;
        }
      } else {
        const each = extraShare / extras.length;
        for (const key of extras){
          out[key] = each;
        }
      }
    }
  }

  const total = TARGET_FEATURE_KEYS.reduce((sum, key) => sum + Math.max(0, Number(out[key] ?? 0)), 0);
  if (total <= 0){
    const fallback = 1 / TARGET_FEATURE_KEYS.length;
    for (const key of TARGET_FEATURE_KEYS){
      out[key] = fallback;
    }
    return out;
  }
  for (const key of TARGET_FEATURE_KEYS){
    out[key] = Math.max(0, Number(out[key] ?? 0)) / total;
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

export function buildCanonicalTargetFeatures({
  components = {},
  rawSignals = {},
  state = {},
  config = {},
} = {}){
  const voterSignals = deriveVoterModelSignals(state?.voterData);
  const votePotential = clamp(Number(components?.votePotential), 0, 1);
  const turnoutOpportunity = clamp(Number(components?.turnoutOpportunity), 0, 1);
  const persuasionIndex = clamp(Number(components?.persuasionIndex), 0, 1);
  const fieldEfficiency = clamp(Number(components?.fieldEfficiency), 0, 1);

  const turnoutReliabilityRaw = clamp(Number(rawSignals?.turnoutReliabilityRaw ?? 0.8), 0, 1.5);
  const reliabilityPenalty = clamp(1 - Math.max(0, turnoutReliabilityRaw - 0.8) * 0.35, 0.7, 1.05);
  const adjustedPersuasion = clamp(persuasionIndex * reliabilityPenalty, 0, 1);

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

  return {
    votePotential,
    turnoutOpportunity,
    persuasionIndex,
    adjustedPersuasion,
    fieldEfficiency,
    networkValue,
    contactProbability,
    geographicMultiplier,
    saturationMultiplier,
  };
}

export function scoreCanonicalTarget({
  features = {},
  state = {},
  profileId = "house_v1",
  customWeights = null,
} = {}){
  const weightProfile = resolveCanonicalWeightProfile({ profileId, customWeights });
  const featureScores = {};
  let weightedSum = 0;
  for (const key of TARGET_FEATURE_KEYS){
    const score = featureScoreValue(key, features[key]);
    featureScores[key] = score;
    weightedSum += score * weightProfile[key];
  }

  const baseScore = weightedSum * 100;
  const geo = clamp(Number(features?.geographicMultiplier ?? 1), 0.75, 1.25);
  const sat = clamp(Number(features?.saturationMultiplier ?? 1), 0.5, 1.1);
  const targetScore = baseScore * geo * sat;

  const baseRates = resolveStateBaseRates(state, {
    defaults: BASE_RATE_DEFAULTS,
    clampMin: 0.01,
    clampMax: 1,
  });
  const supportRate = clamp(Number(baseRates?.sr ?? BASE_RATE_DEFAULTS.sr), 0.01, 1);
  const turnoutReliability = clamp(Number(baseRates?.tr ?? BASE_RATE_DEFAULTS.tr), 0.01, 1);
  const expectedNetVoteValue = targetScore * clamp(Number(features?.contactProbability ?? 0), 0, 1) * supportRate * turnoutReliability;

  const driverRows = TARGET_FEATURE_KEYS.map((key) => ({
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
    weightProfile,
    featureScores,
    scores: {
      baseScore,
      targetScore,
      expectedNetVoteValue,
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
      legacyExpectedNetVoteValue: scoring.scores.expectedNetVoteValue,
      expectedNetVoteValue: upliftAdjustedExpectedNet,
    },
    uplift: {
      features: upliftFeatures,
      ...uplift,
    },
  };
}
