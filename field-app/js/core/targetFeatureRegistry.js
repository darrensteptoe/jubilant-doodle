// @ts-check

export const TARGET_FEATURE_KEYS = Object.freeze([
  "votePotential",
  "turnoutOpportunity",
  "persuasionIndex",
  "adjustedPersuasion",
  "fieldEfficiency",
  "networkValue",
  "contactProbability",
  "geographicMultiplier",
  "saturationMultiplier",
]);

export const TARGET_BASE_SCORE_WEIGHT_KEYS = Object.freeze([
  "votePotential",
  "turnoutOpportunity",
  "adjustedPersuasion",
  "fieldEfficiency",
  "networkValue",
]);

export const TARGET_FEATURE_REGISTRY = Object.freeze({
  votePotential: Object.freeze({ label: "Vote potential", range: [0, 1] }),
  turnoutOpportunity: Object.freeze({ label: "Turnout opportunity", range: [0, 1] }),
  persuasionIndex: Object.freeze({ label: "Persuasion index", range: [0, 1] }),
  adjustedPersuasion: Object.freeze({ label: "Adjusted persuasion", range: [0, 1] }),
  fieldEfficiency: Object.freeze({ label: "Field efficiency", range: [0, 1] }),
  networkValue: Object.freeze({ label: "Network value", range: [0, 1] }),
  contactProbability: Object.freeze({ label: "Contact probability", range: [0, 1] }),
  geographicMultiplier: Object.freeze({ label: "Geographic multiplier", range: [0.75, 1.25] }),
  saturationMultiplier: Object.freeze({ label: "Saturation multiplier", range: [0.5, 1.1] }),
});

export const TARGET_SCORING_PROFILES = Object.freeze({
  turnout_opportunity: Object.freeze({
    votePotential: 0.31,
    turnoutOpportunity: 0.34,
    persuasionIndex: 0,
    adjustedPersuasion: 0.12,
    fieldEfficiency: 0.18,
    networkValue: 0.05,
    contactProbability: 0,
    geographicMultiplier: 0,
    saturationMultiplier: 0,
  }),
  persuasion_first: Object.freeze({
    votePotential: 0.23,
    turnoutOpportunity: 0.11,
    persuasionIndex: 0,
    adjustedPersuasion: 0.34,
    fieldEfficiency: 0.22,
    networkValue: 0.10,
    contactProbability: 0,
    geographicMultiplier: 0,
    saturationMultiplier: 0,
  }),
  field_efficiency: Object.freeze({
    votePotential: 0.19,
    turnoutOpportunity: 0.09,
    persuasionIndex: 0,
    adjustedPersuasion: 0.12,
    fieldEfficiency: 0.45,
    networkValue: 0.15,
    contactProbability: 0,
    geographicMultiplier: 0,
    saturationMultiplier: 0,
  }),
  house_v1: Object.freeze({
    votePotential: 0.28,
    turnoutOpportunity: 0.24,
    persuasionIndex: 0,
    adjustedPersuasion: 0.20,
    fieldEfficiency: 0.22,
    networkValue: 0.06,
    contactProbability: 0,
    geographicMultiplier: 0,
    saturationMultiplier: 0,
  }),
});
