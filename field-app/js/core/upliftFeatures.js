// @ts-check

function safeNum(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max){
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function buildUpliftFeatures({
  rawSignals = {},
  state = {},
  canonicalFeatures = {},
} = {}){
  const persuasionOpportunity = clamp(Number(canonicalFeatures?.adjustedPersuasion ?? 0), 0, 1);
  const turnoutOpportunity = clamp(Number(canonicalFeatures?.turnoutOpportunity ?? 0), 0, 1);
  const contactProbability = clamp(Number(canonicalFeatures?.contactProbability ?? 0), 0, 1);
  const geographyAccess = clamp(Number(canonicalFeatures?.geographicMultiplier ?? 1), 0.75, 1.25);

  const densityModifier = clamp(Number(rawSignals?.densityBand?.multiplier ?? 1), 0.75, 1.25);
  const multiUnitShare = clamp(Number(rawSignals?.multiUnitShare ?? 0), 0, 1);
  const longCommuteShare = clamp(Number(rawSignals?.longCommuteShare ?? 0), 0, 1);
  const bandWidth = clamp((safeNum(state?.bandWidth) ?? 4), 0, 15);

  const saturationRisk = clamp(
    (0.60 * contactProbability) + (0.25 * multiUnitShare) + (0.15 * longCommuteShare),
    0,
    1,
  );

  const uncertainty = clamp(
    0.08 + (bandWidth / 40) + Math.abs(1 - densityModifier) * 0.15,
    0.08,
    0.45,
  );

  return {
    persuasionOpportunity,
    turnoutOpportunity,
    contactProbability,
    geographyAccess,
    saturationRisk,
    uncertainty,
  };
}

