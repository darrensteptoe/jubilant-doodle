// @ts-check

import { clampFiniteNumber } from "./utils.js";

const clamp = clampFiniteNumber;

export const CHANNEL_UPLIFT_DEFAULTS = Object.freeze({
  doors: Object.freeze({
    persuasionWeight: 0.52,
    turnoutWeight: 0.30,
    contactWeight: 0.18,
    saturationPenalty: 0.55,
  }),
  phones: Object.freeze({
    persuasionWeight: 0.40,
    turnoutWeight: 0.28,
    contactWeight: 0.32,
    saturationPenalty: 0.45,
  }),
  texts: Object.freeze({
    persuasionWeight: 0.14,
    turnoutWeight: 0.48,
    contactWeight: 0.38,
    saturationPenalty: 0.35,
  }),
  litDrop: Object.freeze({
    persuasionWeight: 0.20,
    turnoutWeight: 0.44,
    contactWeight: 0.36,
    saturationPenalty: 0.30,
  }),
  mail: Object.freeze({
    persuasionWeight: 0.22,
    turnoutWeight: 0.46,
    contactWeight: 0.32,
    saturationPenalty: 0.28,
  }),
});

export function computeChannelUplift({
  channelId = "doors",
  features = {},
  profile = null,
} = {}){
  const p = profile || CHANNEL_UPLIFT_DEFAULTS[channelId] || CHANNEL_UPLIFT_DEFAULTS.doors;
  const persuasion = clamp(Number(features?.persuasionOpportunity ?? 0), 0, 1);
  const turnout = clamp(Number(features?.turnoutOpportunity ?? 0), 0, 1);
  const contact = clamp(Number(features?.contactProbability ?? 0), 0, 1);
  const saturation = clamp(Number(features?.saturationRisk ?? 0), 0, 1);
  const geography = clamp(Number(features?.geographyAccess ?? 1), 0.75, 1.25);
  const uncertainty = clamp(Number(features?.uncertainty ?? 0.2), 0.05, 0.6);

  const baseLiftIndex =
    (persuasion * Number(p?.persuasionWeight ?? 0)) +
    (turnout * Number(p?.turnoutWeight ?? 0)) +
    (contact * Number(p?.contactWeight ?? 0));
  const saturationFactor = clamp(1 - (saturation * Number(p?.saturationPenalty ?? 0.4)), 0.25, 1);
  const expectedMarginalGain = clamp(baseLiftIndex * saturationFactor * geography, 0, 1.25);
  const uncertaintyBand = {
    low: clamp(expectedMarginalGain * (1 - uncertainty), 0, 1.25),
    high: clamp(expectedMarginalGain * (1 + uncertainty), 0, 1.25),
  };
  return {
    channelId,
    expectedMarginalGain,
    uncertaintyBand,
  };
}
