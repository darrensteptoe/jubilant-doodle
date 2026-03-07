// @ts-check
// Build and apply district-intel assumptions from compiled district evidence.
// Pure helpers only: no DOM, no storage, no network.

import { normalizeDistrictIntelPack } from "./districtData.js";

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function numOrNull(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(n, min, max){
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {Record<string, any>} totals
 * @param {string[]} keys
 * @returns {number | null}
 */
function pickNum(totals, keys){
  for (const key of keys){
    const n = numOrNull(totals?.[key]);
    if (n != null) return n;
  }
  return null;
}

/**
 * @param {Record<string, any>} totals
 * @param {string[]} keys
 * @returns {number | null}
 */
function pickShare(totals, keys){
  const raw = pickNum(totals, keys);
  if (raw == null) return null;
  if (raw >= 0 && raw <= 1) return raw;
  if (raw > 1 && raw <= 100) return raw / 100;
  return null;
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function toUnitRate(v){
  const n = numOrNull(v);
  if (n == null) return null;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return null;
}

/**
 * @param {{
 *   scenario?: unknown,
 *   evidence?: unknown,
 *   refs?: {
 *     censusDatasetId?: unknown,
 *     electionDatasetId?: unknown,
 *     boundarySetId?: unknown,
 *     crosswalkVersionId?: unknown
 *   },
 *   nowIso?: unknown
 * }} args
 * @returns {{
 *   pack: ReturnType<typeof normalizeDistrictIntelPack>,
 *   diagnostics: {
 *     pop: number | null,
 *     housingUnits: number | null,
 *     renterShare: number | null,
 *     multiunitShare: number | null,
 *     baPlusShare: number | null,
 *     youthShare: number | null,
 *     olderShare: number | null,
 *     limitedEnglishShare: number | null,
 *     meanCommuteMin: number | null,
 *     competitiveness: number | null,
 *     marginPct: number | null,
 *   }
 * }}
 */
export function buildDistrictIntelPackFromEvidence(args){
  const scenario = isObject(args?.scenario) ? args.scenario : {};
  const evidence = isObject(args?.evidence) ? args.evidence : {};
  const nowIso = str(args?.nowIso) || new Date().toISOString();
  const currentPack = normalizeDistrictIntelPack(scenario?.districtIntelPack);
  const refs = isObject(args?.refs) ? args.refs : {};
  const dataRefs = isObject(scenario?.dataRefs) ? scenario.dataRefs : {};

  const boundsMin = numOrNull(currentPack?.bounds?.min) ?? 0.6;
  const boundsMax = Math.max(boundsMin, numOrNull(currentPack?.bounds?.max) ?? 1.4);

  const censusTotalsIn = isObject(evidence?.censusTotals) ? evidence.censusTotals : {};
  const signal = isObject(evidence?.persuasionSignal) ? evidence.persuasionSignal : {};
  const summary = isObject(evidence?.summary) ? evidence.summary : {};
  const warnings = Array.isArray(evidence?.warnings)
    ? evidence.warnings.map((x) => str(x)).filter(Boolean)
    : [];

  const pop = pickNum(censusTotalsIn, ["pop", "population", "total_population", "B01003_001E"]);
  const housingUnits = pickNum(censusTotalsIn, ["housing_units", "housing", "B25001_001E"]);
  const renterShare = pickShare(censusTotalsIn, ["renter_share", "renters_share", "renterPct", "renter_pct"]);
  const multiunitShare = pickShare(censusTotalsIn, ["multiunit_share", "multi_unit_share", "multiunit5p_share"]);
  const baPlusShare = pickShare(censusTotalsIn, ["ba_plus_share", "baShare", "education_ba_plus"]);
  const youthShare = pickShare(censusTotalsIn, ["age_18_34_share", "youth_share"]);
  const olderShare = pickShare(censusTotalsIn, ["age_65_plus_share", "older_share"]);
  const limitedEnglishShare = pickShare(censusTotalsIn, ["limited_english_share", "lep_share"]);
  const meanCommuteMin = pickNum(censusTotalsIn, ["mean_commute_min", "commute_min", "mean_commute_minutes"]);

  const marginPct = numOrNull(signal?.marginPct);
  const competitiveness = numOrNull(signal?.competitivenessPct);
  const evidenceSignalIndex = clamp(
    numOrNull(signal?.index) ?? 1,
    Math.max(0.7, boundsMin),
    Math.min(1.3, boundsMax)
  );

  const housingPerCapita = (housingUnits != null && pop != null && pop > 0)
    ? clamp(housingUnits / pop, 0, 2)
    : null;
  const commutePenalty = (meanCommuteMin != null)
    ? clamp((meanCommuteMin - 22) / 28, 0, 1)
    : null;

  let fieldSpeed = 1;
  if (multiunitShare != null) fieldSpeed -= 0.22 * clamp(multiunitShare, 0, 1);
  if (limitedEnglishShare != null) fieldSpeed -= 0.12 * clamp(limitedEnglishShare, 0, 1);
  if (commutePenalty != null) fieldSpeed -= 0.10 * commutePenalty;
  if (housingPerCapita != null) fieldSpeed += 0.08 * clamp((housingPerCapita - 0.35) / 0.25, -1, 1);
  if (renterShare != null) fieldSpeed -= 0.07 * Math.max(0, renterShare - 0.45);
  fieldSpeed = clamp(fieldSpeed, Math.max(0.6, boundsMin), Math.min(1.4, boundsMax));

  let persuasionEnv = evidenceSignalIndex;
  if (baPlusShare != null) persuasionEnv += 0.10 * clamp((baPlusShare - 0.30) / 0.25, -1, 1);
  if (youthShare != null && olderShare != null){
    persuasionEnv += 0.04 * clamp((youthShare - olderShare) / 0.20, -1, 1);
  }
  persuasionEnv = clamp(persuasionEnv, Math.max(0.7, boundsMin), Math.min(1.3, boundsMax));

  let turnoutElasticity = 1;
  if (youthShare != null) turnoutElasticity += 0.08 * clamp((youthShare - 0.20) / 0.20, -1, 1);
  if (olderShare != null) turnoutElasticity += 0.05 * clamp((olderShare - 0.16) / 0.20, -1, 1);
  if (renterShare != null) turnoutElasticity += 0.06 * clamp((renterShare - 0.35) / 0.30, -1, 1);
  if (marginPct != null) turnoutElasticity += 0.03 * clamp((12 - marginPct) / 12, -1, 1);
  turnoutElasticity = clamp(turnoutElasticity, Math.max(0.7, boundsMin), Math.min(1.3, boundsMax));

  let fieldDifficulty = 1 / Math.max(0.6, fieldSpeed);
  if (multiunitShare != null) fieldDifficulty += 0.18 * clamp(multiunitShare, 0, 1);
  if (limitedEnglishShare != null) fieldDifficulty += 0.12 * clamp(limitedEnglishShare, 0, 1);
  fieldDifficulty = clamp(fieldDifficulty, Math.max(0.8, boundsMin), Math.min(1.5, boundsMax));

  const doorsPerHourBase = numOrNull(scenario?.doorsPerHour3);
  const persuasionRateBase = toUnitRate(scenario?.supportRatePct);
  const turnoutLiftBase = numOrNull(scenario?.gotvLiftMode) ?? numOrNull(scenario?.gotvLiftPP);
  const organizerCapacityBase = numOrNull(scenario?.orgCount);

  const doorsPerHourAdjusted = doorsPerHourBase == null ? null : Math.max(0, doorsPerHourBase * fieldSpeed);
  const persuasionRateAdjusted = persuasionRateBase == null ? null : clamp(persuasionRateBase * persuasionEnv, 0, 1);
  const turnoutLiftAdjusted = turnoutLiftBase == null ? null : Math.max(0, turnoutLiftBase * turnoutElasticity);
  const organizerCapacityAdjusted = organizerCapacityBase == null ? null : Math.max(0, organizerCapacityBase / Math.max(0.01, fieldDifficulty));

  const ready = !!(
    (numOrNull(summary?.totalVotes) || 0) > 0 &&
    (Object.keys(censusTotalsIn).length > 0 || (numOrNull(summary?.geoRowsCount) || 0) > 0)
  );

  if ((numOrNull(summary?.totalVotes) || 0) <= 0){
    warnings.push("No weighted election votes available for district evidence.");
  }
  if (!Object.keys(censusTotalsIn).length){
    warnings.push("No census totals available for district evidence.");
  }

  const pack = normalizeDistrictIntelPack({
    ...currentPack,
    ready,
    indices: {
      fieldSpeed,
      persuasionEnv,
      turnoutElasticity,
      fieldDifficulty,
    },
    derivedAssumptions: {
      doorsPerHour: { base: doorsPerHourBase, adjusted: doorsPerHourAdjusted },
      persuasionRate: { base: persuasionRateBase, adjusted: persuasionRateAdjusted },
      turnoutLift: { base: turnoutLiftBase, adjusted: turnoutLiftAdjusted },
      organizerCapacity: { base: organizerCapacityBase, adjusted: organizerCapacityAdjusted },
    },
    provenance: {
      censusDatasetId: str(refs.censusDatasetId || dataRefs?.censusDatasetId) || null,
      electionDatasetId: str(refs.electionDatasetId || dataRefs?.electionDatasetId) || null,
      boundarySetId: str(refs.boundarySetId || dataRefs?.boundarySetId) || null,
      crosswalkVersionId: str(refs.crosswalkVersionId || dataRefs?.crosswalkVersionId) || null,
    },
    generatedAt: nowIso,
    warnings,
  });

  return {
    pack,
    diagnostics: {
      pop,
      housingUnits,
      renterShare,
      multiunitShare,
      baPlusShare,
      youthShare,
      olderShare,
      limitedEnglishShare,
      meanCommuteMin,
      competitiveness,
      marginPct,
    },
  };
}

/**
 * @param {{
 *   state?: unknown,
 *   rates?: { cr: number | null, sr: number | null, tr: number | null }
 * }} args
 * @returns {{
 *   rates: { cr: number | null, sr: number | null, tr: number | null },
 *   meta: { applied: boolean, reason: string, used: string[] }
 * }}
 */
export function applyDistrictIntelRateOverrides(args){
  const state = isObject(args?.state) ? args.state : {};
  const ratesIn = isObject(args?.rates) ? args.rates : {};
  const rates = {
    cr: numOrNull(ratesIn.cr),
    sr: numOrNull(ratesIn.sr),
    tr: numOrNull(ratesIn.tr),
  };
  const used = [];
  if (!state?.useDistrictIntel){
    return { rates, meta: { applied: false, reason: "disabled", used } };
  }
  const pack = normalizeDistrictIntelPack(state?.districtIntelPack);
  if (!pack.ready){
    return { rates, meta: { applied: false, reason: "pack_not_ready", used } };
  }

  const srFromDerived = toUnitRate(pack?.derivedAssumptions?.persuasionRate?.adjusted);
  if (srFromDerived != null){
    rates.sr = clamp(srFromDerived, 0, 1);
    used.push("persuasionRate.adjusted");
  } else if (rates.sr != null && numOrNull(pack?.indices?.persuasionEnv) != null){
    rates.sr = clamp(rates.sr * Number(pack.indices.persuasionEnv), 0, 1);
    used.push("indices.persuasionEnv");
  }

  return { rates, meta: { applied: used.length > 0, reason: used.length ? "applied" : "no_rate_fields", used } };
}

/**
 * @param {{
 *   state?: unknown,
 *   capacity?: {
 *     orgCount: number | null,
 *     orgHoursPerWeek: number | null,
 *     volunteerMult: number | null,
 *     doorSharePct: number | null,
 *     doorShare: number | null,
 *     doorsPerHour: number | null,
 *     callsPerHour: number | null,
 *   }
 * }} args
 * @returns {{
 *   capacity: {
 *     orgCount: number | null,
 *     orgHoursPerWeek: number | null,
 *     volunteerMult: number | null,
 *     doorSharePct: number | null,
 *     doorShare: number | null,
 *     doorsPerHour: number | null,
 *     callsPerHour: number | null,
 *   },
 *   meta: { applied: boolean, reason: string, used: string[] }
 * }}
 */
export function applyDistrictIntelCapacityOverrides(args){
  const state = isObject(args?.state) ? args.state : {};
  const capIn = isObject(args?.capacity) ? args.capacity : {};
  const capacity = {
    orgCount: numOrNull(capIn.orgCount),
    orgHoursPerWeek: numOrNull(capIn.orgHoursPerWeek),
    volunteerMult: numOrNull(capIn.volunteerMult),
    doorSharePct: numOrNull(capIn.doorSharePct),
    doorShare: numOrNull(capIn.doorShare),
    doorsPerHour: numOrNull(capIn.doorsPerHour),
    callsPerHour: numOrNull(capIn.callsPerHour),
  };
  const used = [];
  if (!state?.useDistrictIntel){
    return { capacity, meta: { applied: false, reason: "disabled", used } };
  }
  const pack = normalizeDistrictIntelPack(state?.districtIntelPack);
  if (!pack.ready){
    return { capacity, meta: { applied: false, reason: "pack_not_ready", used } };
  }

  const dphAdj = numOrNull(pack?.derivedAssumptions?.doorsPerHour?.adjusted);
  if (dphAdj != null && dphAdj >= 0){
    capacity.doorsPerHour = dphAdj;
    used.push("doorsPerHour.adjusted");
  } else if (capacity.doorsPerHour != null && numOrNull(pack?.indices?.fieldSpeed) != null){
    capacity.doorsPerHour = Math.max(0, capacity.doorsPerHour * Number(pack.indices.fieldSpeed));
    used.push("indices.fieldSpeed");
  }

  const orgAdj = numOrNull(pack?.derivedAssumptions?.organizerCapacity?.adjusted);
  if (orgAdj != null && orgAdj >= 0){
    capacity.orgCount = orgAdj;
    used.push("organizerCapacity.adjusted");
  } else if (capacity.orgCount != null && numOrNull(pack?.indices?.fieldDifficulty) != null){
    const denom = Math.max(0.01, Number(pack.indices.fieldDifficulty));
    capacity.orgCount = Math.max(0, capacity.orgCount / denom);
    used.push("indices.fieldDifficulty");
  }

  return { capacity, meta: { applied: used.length > 0, reason: used.length ? "applied" : "no_capacity_fields", used } };
}
