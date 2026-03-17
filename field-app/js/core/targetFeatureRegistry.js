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
    votePotential: 0.23,
    turnoutOpportunity: 0.27,
    persuasionIndex: 0.08,
    adjustedPersuasion: 0.06,
    fieldEfficiency: 0.13,
    networkValue: 0.05,
    contactProbability: 0.11,
    geographicMultiplier: 0.04,
    saturationMultiplier: 0.03,
  }),
  persuasion_first: Object.freeze({
    votePotential: 0.21,
    turnoutOpportunity: 0.11,
    persuasionIndex: 0.24,
    adjustedPersuasion: 0.14,
    fieldEfficiency: 0.10,
    networkValue: 0.06,
    contactProbability: 0.08,
    geographicMultiplier: 0.03,
    saturationMultiplier: 0.03,
  }),
  field_efficiency: Object.freeze({
    votePotential: 0.18,
    turnoutOpportunity: 0.08,
    persuasionIndex: 0.08,
    adjustedPersuasion: 0.05,
    fieldEfficiency: 0.28,
    networkValue: 0.07,
    contactProbability: 0.13,
    geographicMultiplier: 0.08,
    saturationMultiplier: 0.05,
  }),
  house_v1: Object.freeze({
    votePotential: 0.24,
    turnoutOpportunity: 0.20,
    persuasionIndex: 0.16,
    adjustedPersuasion: 0.08,
    fieldEfficiency: 0.18,
    networkValue: 0.04,
    contactProbability: 0.06,
    geographicMultiplier: 0.02,
    saturationMultiplier: 0.02,
  }),
});

