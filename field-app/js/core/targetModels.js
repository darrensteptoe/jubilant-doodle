// @ts-check

const AGE_18_24_VARS = [
  "B01001_007E", "B01001_008E", "B01001_009E", "B01001_010E",
  "B01001_031E", "B01001_032E", "B01001_033E", "B01001_034E",
];
const AGE_25_34_VARS = ["B01001_011E", "B01001_012E", "B01001_035E", "B01001_036E"];
const AGE_35_44_VARS = ["B01001_013E", "B01001_014E", "B01001_037E", "B01001_038E"];
const AGE_45_64_VARS = [
  "B01001_015E", "B01001_016E", "B01001_017E", "B01001_018E", "B01001_019E",
  "B01001_039E", "B01001_040E", "B01001_041E", "B01001_042E", "B01001_043E",
];
const AGE_65_PLUS_VARS = [
  "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
  "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",
];
const BA_PLUS_VARS = ["B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E"];
const CITIZEN_VARS = ["B05001_002E", "B05001_003E", "B05001_004E", "B05001_005E"];
const LONG_COMMUTE_VARS = ["B08303_011E", "B08303_012E", "B08303_013E"];
const SUPER_COMMUTE_VARS = ["B08303_012E", "B08303_013E"];
const MULTI_UNIT_VARS = [
  "B25024_003E", "B25024_004E", "B25024_005E", "B25024_006E", "B25024_007E",
  "B25024_008E", "B25024_009E", "B25024_010E", "B25024_011E",
];
const LIMITED_ENGLISH_VARS = ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E"];

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

function sumVars(values, variableIds){
  let total = 0;
  let seen = false;
  for (const id of variableIds || []){
    const n = safeNum(values?.[id]);
    if (n == null) continue;
    total += n;
    seen = true;
  }
  return seen ? total : null;
}

function ratio(numerator, denominator, fallback = 0){
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0){
    return fallback;
  }
  return clamp(numerator / denominator, 0, 1);
}

function turnoutExpectedFromState(state){
  const a = safeNum(state?.turnoutA);
  const b = safeNum(state?.turnoutB);
  if (a != null && b != null){
    return clamp(((a + b) / 2) / 100, 0.2, 0.95);
  }
  const baseline = safeNum(state?.turnoutBaselinePct);
  if (baseline != null){
    return clamp(baseline / 100, 0.2, 0.95);
  }
  return 0.55;
}

function baseDoorsPerHour(state){
  const dph = safeNum(state?.doorsPerHour3 ?? state?.doorsPerHour);
  return dph != null ? clamp(dph, 5, 80) : 30;
}

function densityBandFromRatio(densityRatio){
  const ratioValue = clamp(densityRatio, 0.2, 0.9);
  if (ratioValue >= 0.64){
    return { id: "high_density", label: "High density", multiplier: 0.94, modifier: 0.20 };
  }
  if (ratioValue >= 0.52){
    return { id: "medium_high_density", label: "Medium-high density", multiplier: 1.03, modifier: 0.10 };
  }
  if (ratioValue >= 0.40){
    return { id: "medium_density", label: "Medium density", multiplier: 0.97, modifier: 0.05 };
  }
  return { id: "low_density", label: "Low density", multiplier: 0.88, modifier: -0.10 };
}

function normalizeWeightBag(input){
  const src = input && typeof input === "object" ? input : {};
  const out = {
    votePotential: Number.isFinite(Number(src.votePotential)) ? Math.max(0, Number(src.votePotential)) : 0.35,
    turnoutOpportunity: Number.isFinite(Number(src.turnoutOpportunity)) ? Math.max(0, Number(src.turnoutOpportunity)) : 0.25,
    persuasionIndex: Number.isFinite(Number(src.persuasionIndex)) ? Math.max(0, Number(src.persuasionIndex)) : 0.20,
    fieldEfficiency: Number.isFinite(Number(src.fieldEfficiency)) ? Math.max(0, Number(src.fieldEfficiency)) : 0.20,
  };
  const total = out.votePotential + out.turnoutOpportunity + out.persuasionIndex + out.fieldEfficiency;
  if (total <= 0){
    return { votePotential: 0.35, turnoutOpportunity: 0.25, persuasionIndex: 0.20, fieldEfficiency: 0.20 };
  }
  out.votePotential /= total;
  out.turnoutOpportunity /= total;
  out.persuasionIndex /= total;
  out.fieldEfficiency /= total;
  return out;
}

export function deriveTargetSignalsForRow(row, state, config = {}){
  const values = row?.values && typeof row.values === "object" ? row.values : {};
  const criteria = config?.criteria && typeof config.criteria === "object" ? config.criteria : {};

  const population = Math.max(0, safeNum(values.B01003_001E) ?? 0);
  const housingUnits = Math.max(0, safeNum(values.B25001_001E) ?? 0);
  const occupiedHousingTotal = Math.max(0, safeNum(values.B25003_001E) ?? 0);
  const renterHouseholds = Math.max(0, safeNum(values.B25003_003E) ?? 0);
  const ownerHouseholds = Math.max(0, safeNum(values.B25003_002E) ?? 0);
  const noVehicleHouseholds = Math.max(0, safeNum(values.B08201_002E) ?? 0);
  const vehicleHouseholdsTotal = Math.max(0, safeNum(values.B08201_001E) ?? 0);
  const citizenshipTotal = Math.max(0, safeNum(values.B05001_001E) ?? 0);
  const commuteWorkersTotal = Math.max(0, safeNum(values.B08303_001E) ?? 0);
  const povertyUniverse = Math.max(0, safeNum(values.B17001_001E) ?? 0);
  const povertyCount = Math.max(0, safeNum(values.B17001_002E) ?? 0);
  const internetHouseholdsTotal = Math.max(0, safeNum(values.B28002_001E) ?? 0);
  const noInternetHouseholds = Math.max(0, safeNum(values.B28002_013E) ?? 0);
  const maleCount = Math.max(0, safeNum(values.B01001_002E) ?? 0);
  const femaleCount = Math.max(0, safeNum(values.B01001_026E) ?? 0);

  const multiUnitHousing = Math.max(0, sumVars(values, MULTI_UNIT_VARS) ?? 0);
  const baPlusCount = Math.max(0, sumVars(values, BA_PLUS_VARS) ?? 0);
  const citizenCount = Math.max(0, sumVars(values, CITIZEN_VARS) ?? 0);
  const longCommuteCount = Math.max(0, sumVars(values, LONG_COMMUTE_VARS) ?? 0);
  const superCommuteCount = Math.max(0, sumVars(values, SUPER_COMMUTE_VARS) ?? 0);
  const educationTotal = Math.max(0, safeNum(values.B15003_001E) ?? 0);
  const limitedEnglishCount = Math.max(0, sumVars(values, LIMITED_ENGLISH_VARS) ?? 0);
  const limitedEnglishTotal = Math.max(0, safeNum(values.C16002_001E) ?? 0);

  const age18to24Count = Math.max(0, sumVars(values, AGE_18_24_VARS) ?? 0);
  const age25to34Count = Math.max(0, sumVars(values, AGE_25_34_VARS) ?? 0);
  const age35to44Count = Math.max(0, sumVars(values, AGE_35_44_VARS) ?? 0);
  const age45to64Count = Math.max(0, sumVars(values, AGE_45_64_VARS) ?? 0);
  const age65PlusCount = Math.max(0, sumVars(values, AGE_65_PLUS_VARS) ?? 0);

  const turnoutExpected = turnoutExpectedFromState(state);

  const renterShare = ratio(renterHouseholds, occupiedHousingTotal, 0.35);
  const ownerShare = ratio(ownerHouseholds, occupiedHousingTotal, 0.55);
  const multiUnitShare = ratio(multiUnitHousing, housingUnits, 0.20);
  const baPlusShare = ratio(baPlusCount, educationTotal, 0.33);
  const citizenShare = ratio(citizenCount, citizenshipTotal, 0.92);
  const limitedEnglishShare = ratio(limitedEnglishCount, limitedEnglishTotal, 0.05);
  const noVehicleShare = ratio(noVehicleHouseholds, vehicleHouseholdsTotal, 0.08);
  const longCommuteShare = ratio(longCommuteCount, commuteWorkersTotal, 0.18);
  const superCommuteShare = ratio(superCommuteCount, commuteWorkersTotal, 0.08);
  const povertyShare = ratio(povertyCount, povertyUniverse, 0.11);
  const noInternetShare = ratio(noInternetHouseholds, internetHouseholdsTotal, 0.12);
  const maleShare = ratio(maleCount, population, 0.49);
  const femaleShare = ratio(femaleCount, population, 0.51);

  const age18to24Share = ratio(age18to24Count, population, 0.10);
  const age25to34Share = ratio(age25to34Count, population, 0.14);
  const age35to44Share = ratio(age35to44Count, population, 0.13);
  const age45to64Share = ratio(age45to64Count, population, 0.26);
  const age65PlusShare = ratio(age65PlusCount, population, 0.18);
  const age18to34Share = clamp(age18to24Share + age25to34Share, 0, 1);
  const primeAgeShare = clamp(age25to34Share + age35to44Share + age45to64Share, 0, 1);

  const densityRatio = clamp(
    (population > 0 && housingUnits > 0) ? (housingUnits / population) : 0.45,
    0.2,
    0.9,
  );
  const densityBand = densityBandFromRatio(densityRatio);

  const contactRateModifier = clamp(
    1 - (multiUnitShare * 0.15) - (renterShare * 0.05),
    0.75,
    1.05,
  );
  const availabilityModifier = clamp(
    1 - (longCommuteShare * 0.10) - (superCommuteShare * 0.06) - (noInternetShare * 0.04),
    0.72,
    1.06,
  );
  const walkability = clamp(
    0.92 + (0.22 * noVehicleShare) + (0.16 * densityRatio) - (0.10 * multiUnitShare),
    0.78,
    1.15,
  );
  const estimatedDoorsPerHourFactor = clamp(
    densityBand.multiplier * walkability * contactRateModifier * availabilityModifier,
    0.72,
    1.22,
  );
  const estimatedDoorsPerHour = baseDoorsPerHour(state) * estimatedDoorsPerHourFactor;

  const baseContactRate = clamp((safeNum(state?.contactRatePct) ?? 22) / 100, 0.01, 1);
  const baseSupportRate = clamp((safeNum(state?.supportRatePct) ?? 55) / 100, 0.01, 1);
  const baseTurnoutReliability = clamp((safeNum(state?.turnoutReliabilityPct) ?? 80) / 100, 0.01, 1);
  const votesPerOrganizerHour =
    estimatedDoorsPerHour *
    baseContactRate *
    contactRateModifier *
    availabilityModifier *
    baseSupportRate *
    baseTurnoutReliability;

  const turnoutReliabilityRaw = clamp(
    (age45to64Share * 0.60) +
    (age65PlusShare * 0.80) +
    (baPlusShare * 0.55),
    0,
    1.5,
  );
  const votePotentialRaw = housingUnits * turnoutExpected * clamp(citizenShare, 0.55, 1.05);

  let turnoutOpportunityRaw = (
    (age18to24Share * 1.00) +
    (age25to34Share * 0.85) +
    (age35to44Share * 0.40) -
    (age65PlusShare * 0.30) -
    (baPlusShare * 0.18) +
    (povertyShare * 0.18) -
    (longCommuteShare * 0.08) +
    ((1 - turnoutReliabilityRaw) * 0.20)
  );
  if (criteria.prioritizeYoung){
    turnoutOpportunityRaw += age18to34Share * 0.08;
  }

  let persuasionIndexRaw = (
    1 +
    (age18to34Share * 0.15) +
    (renterShare * 0.10) -
    (baPlusShare * 0.15) +
    (povertyShare * 0.08) -
    (superCommuteShare * 0.06)
  );
  if (criteria.prioritizeRenters){
    persuasionIndexRaw += renterShare * 0.06;
  }

  let fieldEfficiencyRaw = (
    1 +
    densityBand.modifier -
    (multiUnitShare * 0.20) -
    (limitedEnglishShare * 0.15) +
    (noVehicleShare * 0.10) -
    (longCommuteShare * 0.15) -
    (noInternetShare * 0.08)
  );
  if (criteria.avoidHighMultiUnit){
    fieldEfficiencyRaw -= (multiUnitShare * 0.10);
  }

  return {
    population,
    housingUnits,
    turnoutExpected,
    votePotentialRaw: Math.max(0, votePotentialRaw),
    turnoutOpportunityRaw: clamp(turnoutOpportunityRaw, 0, 2),
    persuasionIndexRaw: clamp(persuasionIndexRaw, 0, 2),
    fieldEfficiencyRaw: clamp(fieldEfficiencyRaw, 0, 2),
    renterShare,
    ownerShare,
    baPlusShare,
    citizenShare,
    limitedEnglishShare,
    multiUnitShare,
    noVehicleShare,
    longCommuteShare,
    superCommuteShare,
    povertyShare,
    noInternetShare,
    maleShare,
    femaleShare,
    age18to24Share,
    age25to34Share,
    age35to44Share,
    age45to64Share,
    age65PlusShare,
    age18to34Share,
    primeAgeShare,
    densityRatio,
    densityBand,
    walkability,
    contactRateModifier,
    availabilityModifier,
    estimatedDoorsPerHourFactor,
    estimatedDoorsPerHour,
    turnoutReliabilityRaw,
    votesPerOrganizerHour,
  };
}

function scoreProduct(components, exponents){
  const epsilon = 0.02;
  const vote = clamp(Number(components?.votePotential), 0, 1);
  const turnout = clamp(Number(components?.turnoutOpportunity), 0, 1);
  const persuasion = clamp(Number(components?.persuasionIndex), 0, 1);
  const efficiency = clamp(Number(components?.fieldEfficiency), 0, 1);
  return 100 * (
    Math.pow(vote + epsilon, exponents.votePotential) *
    Math.pow(turnout + epsilon, exponents.turnoutOpportunity) *
    Math.pow(persuasion + epsilon, exponents.persuasionIndex) *
    Math.pow(efficiency + epsilon, exponents.fieldEfficiency)
  );
}

const TARGET_MODELS_INTERNAL = {
  turnout_opportunity: {
    id: "turnout_opportunity",
    label: "Turnout Opportunity",
    description: "Prioritize scalable turnout upside with feasible field contact.",
    score(components){
      return scoreProduct(components, {
        votePotential: 0.95,
        turnoutOpportunity: 1.45,
        persuasionIndex: 0.80,
        fieldEfficiency: 0.90,
      });
    },
  },
  persuasion_first: {
    id: "persuasion_first",
    label: "Persuasion First",
    description: "Prioritize soft-opinion turf with enough scale and contactability.",
    score(components){
      return scoreProduct(components, {
        votePotential: 1.00,
        turnoutOpportunity: 0.70,
        persuasionIndex: 1.45,
        fieldEfficiency: 0.95,
      });
    },
  },
  field_efficiency: {
    id: "field_efficiency",
    label: "Field Efficiency",
    description: "Prioritize votes per organizer hour and clean execution turf.",
    score(components){
      return scoreProduct(components, {
        votePotential: 0.80,
        turnoutOpportunity: 0.60,
        persuasionIndex: 0.70,
        fieldEfficiency: 1.65,
      });
    },
  },
  house_v1: {
    id: "house_v1",
    label: "House Model v1",
    description: "Transparent weighted composite for house-model iteration.",
    score(components, config){
      const w = normalizeWeightBag(config?.weights);
      const vote = clamp(Number(components?.votePotential), 0, 1);
      const turnout = clamp(Number(components?.turnoutOpportunity), 0, 1);
      const persuasion = clamp(Number(components?.persuasionIndex), 0, 1);
      const efficiency = clamp(Number(components?.fieldEfficiency), 0, 1);
      return 100 * (
        (w.votePotential * vote) +
        (w.turnoutOpportunity * turnout) +
        (w.persuasionIndex * persuasion) +
        (w.fieldEfficiency * efficiency)
      );
    },
  },
};

export const TARGET_MODELS = Object.freeze(TARGET_MODELS_INTERNAL);

export function listTargetModels(){
  return Object.values(TARGET_MODELS_INTERNAL).map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
  }));
}

function buildReasons(components, rawSignals, modelId){
  const reasons = [];
  const c = components || {};
  const baPlusShare = Number(rawSignals?.baPlusShare);
  const noVehicleShare = Number(rawSignals?.noVehicleShare);
  const longCommuteShare = Number(rawSignals?.longCommuteShare);
  const povertyShare = Number(rawSignals?.povertyShare);
  if (c.votePotential >= 0.66){
    reasons.push("Large vote potential from housing-unit scale.");
  }
  if (c.turnoutOpportunity >= 0.66){
    reasons.push("High turnout upside from age profile.");
  }
  if (c.persuasionIndex >= 0.66){
    reasons.push("Strong persuasion opportunity in demographic mix.");
  }
  if (c.fieldEfficiency >= 0.66){
    reasons.push("Efficient field access and expected contact pace.");
  }
  if (Number.isFinite(baPlusShare) && baPlusShare >= 0.40){
    reasons.push("High BA+ share suggests stable turnout propensity.");
  } else if (Number.isFinite(baPlusShare) && baPlusShare <= 0.20){
    reasons.push("Low BA+ share indicates turnout-opportunity turf.");
  }
  if (Number.isFinite(noVehicleShare) && noVehicleShare >= 0.18){
    reasons.push("High no-vehicle share supports dense walk-list execution.");
  }
  if (Number.isFinite(longCommuteShare) && longCommuteShare <= 0.15){
    reasons.push("Lower long-commute share improves weekday contact timing.");
  }
  if (Number.isFinite(povertyShare) && povertyShare >= 0.18){
    reasons.push("Economic hardship profile suggests turnout-opportunity upside.");
  }
  if (!reasons.length){
    reasons.push("Balanced composite profile across turnout, persuasion, and field feasibility.");
  }
  if (modelId === "field_efficiency" && Number.isFinite(Number(rawSignals?.votesPerOrganizerHour))){
    reasons.push(`Estimated votes per organizer hour: ${Number(rawSignals.votesPerOrganizerHour).toFixed(2)}.`);
  }
  return reasons.slice(0, 3);
}

function buildFlags(rawSignals){
  const flags = [];
  const multiUnitShare = Number(rawSignals?.multiUnitShare);
  const limitedEnglishShare = Number(rawSignals?.limitedEnglishShare);
  const noVehicleShare = Number(rawSignals?.noVehicleShare);
  const citizenShare = Number(rawSignals?.citizenShare);
  const longCommuteShare = Number(rawSignals?.longCommuteShare);
  const noInternetShare = Number(rawSignals?.noInternetShare);
  if (Number.isFinite(multiUnitShare) && multiUnitShare >= 0.55){
    flags.push("High multi-unit share may reduce direct access.");
  }
  if (Number.isFinite(limitedEnglishShare) && limitedEnglishShare >= 0.18){
    flags.push("Language access burden likely for contact scripts.");
  }
  if (Number.isFinite(noVehicleShare) && noVehicleShare >= 0.20){
    flags.push("High no-vehicle share may require walk-list planning.");
  }
  if (Number.isFinite(citizenShare) && citizenShare <= 0.80){
    flags.push("Lower citizen share can reduce eligible-voter density.");
  }
  if (Number.isFinite(longCommuteShare) && longCommuteShare >= 0.28){
    flags.push("Long-commute profile may reduce weekday contact availability.");
  }
  if (Number.isFinite(noInternetShare) && noInternetShare >= 0.20){
    flags.push("High no-internet share can reduce digital follow-up reach.");
  }
  return flags.slice(0, 3);
}

function buildTargetLabel(rawSignals){
  const baPlusShare = Number(rawSignals?.baPlusShare);
  const renterShare = Number(rawSignals?.renterShare);
  const age25to34Share = Number(rawSignals?.age25to34Share);
  const votesPerOrganizerHour = Number(rawSignals?.votesPerOrganizerHour);
  const povertyShare = Number(rawSignals?.povertyShare);
  if (Number.isFinite(baPlusShare) && baPlusShare >= 0.40){
    return "High Propensity Voters";
  }
  if (
    Number.isFinite(povertyShare) &&
    povertyShare >= 0.18 &&
    Number.isFinite(baPlusShare) &&
    baPlusShare <= 0.30
  ){
    return "Turnout Lift Turf";
  }
  if (Number.isFinite(baPlusShare) && baPlusShare <= 0.20){
    return "Turnout Opportunity";
  }
  if (
    Number.isFinite(renterShare) && renterShare >= 0.45 &&
    Number.isFinite(age25to34Share) && age25to34Share >= 0.16
  ){
    return "Persuasion Turf";
  }
  if (Number.isFinite(votesPerOrganizerHour) && votesPerOrganizerHour >= 2.6){
    return "High Efficiency Turf";
  }
  return "Balanced Turf";
}

export function scoreTargetRow({
  modelId,
  components,
  rawSignals,
  config,
} = {}){
  const id = String(modelId || "turnout_opportunity");
  const model = TARGET_MODELS_INTERNAL[id] || TARGET_MODELS_INTERNAL.turnout_opportunity;
  const score = model.score(components || {}, config || {});
  return {
    score: Number.isFinite(score) ? score : 0,
    componentScores: {
      votePotential: clamp(Number(components?.votePotential), 0, 1),
      turnoutOpportunity: clamp(Number(components?.turnoutOpportunity), 0, 1),
      persuasionIndex: clamp(Number(components?.persuasionIndex), 0, 1),
      fieldEfficiency: clamp(Number(components?.fieldEfficiency), 0, 1),
    },
    reasons: buildReasons(components, rawSignals, model.id),
    flags: buildFlags(rawSignals),
    targetLabel: buildTargetLabel(rawSignals),
    model: {
      id: model.id,
      label: model.label,
    },
  };
}
