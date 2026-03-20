// @ts-check
import { NULL_BASE_RATE_DEFAULTS, resolveStateBaseRates } from "../core/baseRates.js";
import { computeGoalPaceRequirements } from "../core/executionPlanner.js";
import { computeCapacityBreakdown } from "../core/model.js";
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorsPerHour,
  resolveDoorShareUnitFromPct,
} from "../core/throughput.js";
import { deriveVoterModelSignals, extractCensusAgeDistribution } from "../core/voterDataLayer.js";
import { clampFiniteNumber, formatFixedNumber, safeNum } from "../core/utils.js";
import { BUDGET_REALISM_CHANNEL_BANDS } from "./budgetRealismBands.js";
import { evaluateEventAssumptionRealism } from "./eventImpactRules.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} state
 * @param {string} path
 * @returns {unknown}
 */
function readPath(state, path){
  const src = state && typeof state === "object" ? state : {};
  const parts = String(path || "")
    .trim()
    .replace(/^state\./, "")
    .split(".")
    .filter(Boolean);
  let cur = src;
  for (const part of parts){
    if (!cur || typeof cur !== "object"){
      return null;
    }
    cur = cur[part];
  }
  return cur;
}

/**
 * @param {AnyRecord} state
 * @returns {Record<string, number | null>}
 */
export function collectRealismMetrics(state = {}){
  const rates = resolveStateBaseRates(state, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });

  const doorsPerHour = resolveCanonicalDoorsPerHour(state, { toNumber: safeNum });
  const callsPerHour = resolveCanonicalCallsPerHour(state, { toNumber: safeNum });
  const doorShare = resolveDoorShareUnitFromPct(state?.channelDoorPct, { fallback: 0.5 });

  return {
    persuasionPct: safeNum(state?.persuasionPct),
    supportRatePct: rates.sr == null ? safeNum(state?.supportRatePct) : Number(rates.sr) * 100,
    contactRatePct: rates.cr == null ? safeNum(state?.contactRatePct) : Number(rates.cr) * 100,
    turnoutReliabilityPct: rates.tr == null ? safeNum(state?.turnoutReliabilityPct) : Number(rates.tr) * 100,
    turnoutBaselinePct: safeNum(state?.turnoutBaselinePct),
    turnoutTargetOverridePct: safeNum(state?.turnoutTargetOverridePct),
    gotvLiftPP: safeNum(state?.gotvLiftPP),
    gotvMaxLiftPP: safeNum(state?.gotvMaxLiftPP || state?.gotvMaxLiftPP2),
    doorsPerHour: doorsPerHour,
    callsPerHour: callsPerHour,
    volunteerMultiplier: safeNum(state?.volunteerMultBase),
    organizerCount: safeNum(state?.orgCount),
    doorShareUnit: doorShare,
    weeksRemaining: safeNum(state?.weeksRemaining),
    orgHoursPerWeek: safeNum(state?.orgHoursPerWeek),
  };
}

/**
 * @param {string} key
 * @param {number | null} value
 * @param {AnyRecord} band
 */
function evaluateBandValue(key, value, band){
  if (value == null || !Number.isFinite(value)){
    return null;
  }
  const min = safeNum(band?.min);
  const max = safeNum(band?.max);
  const typicalLow = safeNum(band?.typicalLow);
  const typicalHigh = safeNum(band?.typicalHigh);
  const extreme = safeNum(band?.extreme);
  const label = String(band?.label || key).trim() || key;

  if (min != null && value < min){
    return {
      kind: "band",
      field: key,
      label,
      severity: "bad",
      value,
      typicalMin: typicalLow,
      typicalMax: typicalHigh,
      hardMin: min,
      hardMax: max,
      extreme,
      reason: `${label} is below realistic floor (${value} < ${min}).`,
    };
  }

  if (max != null && value > max){
    return {
      kind: "band",
      field: key,
      label,
      severity: "bad",
      value,
      typicalMin: typicalLow,
      typicalMax: typicalHigh,
      hardMin: min,
      hardMax: max,
      extreme,
      reason: `${label} is above realistic ceiling (${value} > ${max}).`,
    };
  }

  if (extreme != null && value > extreme){
    return {
      kind: "band",
      field: key,
      label,
      severity: "bad",
      value,
      typicalMin: typicalLow,
      typicalMax: typicalHigh,
      hardMin: min,
      hardMax: max,
      extreme,
      reason: `${label} exceeds extreme plausibility bound (${value} > ${extreme}).`,
    };
  }

  if (
    (typicalLow != null && value < typicalLow)
    || (typicalHigh != null && value > typicalHigh)
  ){
    return {
      kind: "band",
      field: key,
      label,
      severity: "warn",
      value,
      typicalMin: typicalLow,
      typicalMax: typicalHigh,
      hardMin: min,
      hardMax: max,
      extreme,
      reason: `${label} is outside typical range (${typicalLow}–${typicalHigh}).`,
    };
  }

  return null;
}

/**
 * @param {{
 *   state?: AnyRecord,
 *   bands?: AnyRecord,
 * }} args
 */
export function evaluateRealismBandRules({ state = {}, bands = {} } = {}){
  const metrics = collectRealismMetrics(state);
  const flags = [];
  const checked = [];

  for (const [key, band] of Object.entries(bands || {})){
    const fromPath = safeNum(readPath(state, String(band?.path || "")));
    const metricValue = Object.prototype.hasOwnProperty.call(metrics, key)
      ? metrics[key]
      : fromPath;
    const value = metricValue == null ? fromPath : metricValue;
    if (value == null || !Number.isFinite(value)) continue;
    checked.push(key);
    const row = evaluateBandValue(key, value, band);
    if (row) flags.push(row);
  }

  return { flags, checked };
}

/**
 * @param {{
 *   key: string,
 *   value: number,
 *   band: AnyRecord,
 *   enabled: boolean,
 * }} args
 */
function evaluateBudgetChannelBand({ key, value, band, enabled }){
  const label = String(key || "channel").trim() || "channel";
  const floor = safeNum(band?.floor);
  const ceiling = safeNum(band?.ceiling);
  const extremeLow = safeNum(band?.extremeLow);
  const extremeHigh = safeNum(band?.extremeHigh);
  const channelId = label;
  const enabledNote = enabled ? " (channel enabled)" : "";

  if (extremeLow != null && value < extremeLow){
    return {
      kind: "budget",
      field: key,
      channelId,
      label,
      severity: "bad",
      value,
      floor,
      ceiling,
      extremeLow,
      extremeHigh,
      reason: `${label} below extreme low (${value} < ${extremeLow})${enabledNote}.`,
    };
  }
  if (extremeHigh != null && value > extremeHigh){
    return {
      kind: "budget",
      field: key,
      channelId,
      label,
      severity: "bad",
      value,
      floor,
      ceiling,
      extremeLow,
      extremeHigh,
      reason: `${label} above extreme high (${value} > ${extremeHigh})${enabledNote}.`,
    };
  }
  if (floor != null && value < floor){
    return {
      kind: "budget",
      field: key,
      channelId,
      label,
      severity: "warn",
      value,
      floor,
      ceiling,
      extremeLow,
      extremeHigh,
      reason: `${label} below realistic floor (${value} < ${floor})${enabledNote}.`,
    };
  }
  if (ceiling != null && value > ceiling){
    return {
      kind: "budget",
      field: key,
      channelId,
      label,
      severity: "warn",
      value,
      floor,
      ceiling,
      extremeLow,
      extremeHigh,
      reason: `${label} above realistic ceiling (${value} > ${ceiling})${enabledNote}.`,
    };
  }
  return null;
}

/**
 * @param {{
 *   state?: AnyRecord,
 *   budgetBands?: AnyRecord,
 * }} args
 */
export function evaluateBudgetRealismRules({
  state = {},
  budgetBands = BUDGET_REALISM_CHANNEL_BANDS,
} = {}){
  const flags = [];
  const checked = [];
  const tactics = (state?.budget?.tactics && typeof state.budget.tactics === "object")
    ? state.budget.tactics
    : {};

  for (const [key, band] of Object.entries(budgetBands || {})){
    const tacticKey = String(band?.tacticKey || (key === "calls" ? "phones" : key)).trim();
    if (!tacticKey) continue;
    const value = safeNum(tactics?.[tacticKey]?.cpa);
    if (value == null || !Number.isFinite(value)) continue;
    checked.push(key);
    const enabled = !!tactics?.[tacticKey]?.enabled;
    const row = evaluateBudgetChannelBand({ key, value, band, enabled });
    if (row) flags.push(row);
  }

  return { flags, checked };
}

/**
 * @param {{ metrics?: Record<string, number | null> }} args
 */
export function evaluateRealismCrossVariableRules({ metrics = {} } = {}){
  const flags = [];

  const target = safeNum(metrics.turnoutTargetOverridePct);
  const baseline = safeNum(metrics.turnoutBaselinePct);
  if (target != null && baseline != null){
    const delta = target - baseline;
    const deltaText = formatFixedNumber(delta, 1, "0.0");
    if (delta >= 15){
      flags.push({
        kind: "cross",
        id: "turnout_override_jump",
        severity: "bad",
        fields: ["turnoutBaselinePct", "turnoutTargetOverridePct"],
        message: `Turnout target override is ${deltaText}pp above baseline.`,
      });
    } else if (delta >= 8){
      flags.push({
        kind: "cross",
        id: "turnout_override_stretch",
        severity: "warn",
        fields: ["turnoutBaselinePct", "turnoutTargetOverridePct"],
        message: `Turnout target override is ${deltaText}pp above baseline (aggressive).`,
      });
    }
  }

  const gotvLift = safeNum(metrics.gotvLiftPP);
  const gotvMax = safeNum(metrics.gotvMaxLiftPP);
  if (gotvLift != null && gotvMax != null && gotvLift > gotvMax){
    flags.push({
      kind: "cross",
      id: "gotv_lift_exceeds_cap",
      severity: "bad",
      fields: ["gotvLiftPP", "gotvMaxLiftPP"],
      message: "Configured GOTV lift exceeds configured GOTV cap.",
    });
  }

  const contact = safeNum(metrics.contactRatePct);
  const support = safeNum(metrics.supportRatePct);
  const persuasion = safeNum(metrics.persuasionPct);
  if (contact != null && support != null && persuasion != null){
    if (contact > 45 && support > 75 && persuasion > 35){
      flags.push({
        kind: "cross",
        id: "stacked_high_assumptions",
        severity: "bad",
        fields: ["contactRatePct", "supportRatePct", "persuasionPct"],
        message: "Contact, support, and persuasion assumptions are all simultaneously very high.",
      });
    } else if (contact > 40 && support > 70 && persuasion > 30){
      flags.push({
        kind: "cross",
        id: "stacked_assumption_pressure",
        severity: "warn",
        fields: ["contactRatePct", "supportRatePct", "persuasionPct"],
        message: "Contact, support, and persuasion assumptions are jointly elevated.",
      });
    }
  }

  const doorsPerHour = safeNum(metrics.doorsPerHour);
  const callsPerHour = safeNum(metrics.callsPerHour);
  if (doorsPerHour != null && callsPerHour != null && doorsPerHour > 55 && callsPerHour > 45){
    flags.push({
      kind: "cross",
      id: "throughput_dual_peak",
      severity: "warn",
      fields: ["doorsPerHour", "callsPerHour"],
      message: "Both door and phone throughput assumptions are near top-end simultaneously.",
    });
  }

  return flags;
}

/**
 * @param {{
 *   state?: AnyRecord,
 *   res?: AnyRecord,
 *   weeks?: unknown,
 * }} args
 */
export function evaluateRealismCapacityRule({ state = {}, res = {}, weeks = null } = {}){
  const rates = resolveStateBaseRates(state, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  const supportRate = rates.sr;
  const contactRate = rates.cr;
  const goalVotes = safeNum(res?.expected?.persuasionNeed);
  const weeksResolvedRaw = safeNum(weeks);
  const weeksResolved = weeksResolvedRaw == null ? safeNum(state?.weeksRemaining) : weeksResolvedRaw;

  const required = computeGoalPaceRequirements({
    goalVotes,
    supportRate,
    contactRate,
    weeks: weeksResolved,
  });
  const requiredAttemptsPerWeek = safeNum(required?.attemptsPerWeek);

  const available = computeCapacityBreakdown({
    weeks: 1,
    orgCount: safeNum(state?.orgCount),
    orgHoursPerWeek: safeNum(state?.orgHoursPerWeek),
    volunteerMult: safeNum(state?.volunteerMultBase),
    doorShare: resolveDoorShareUnitFromPct(state?.channelDoorPct, { fallback: 0.5 }),
    doorsPerHour: resolveCanonicalDoorsPerHour(state, { toNumber: safeNum }),
    callsPerHour: resolveCanonicalCallsPerHour(state, { toNumber: safeNum }),
    capacityDecay: {
      enabled: false,
      type: "linear",
      weeklyDecayPct: null,
      floorPctOfBaseline: null,
    },
  });
  const availableAttemptsPerWeek = safeNum(available?.total);

  if (requiredAttemptsPerWeek == null || requiredAttemptsPerWeek <= 0 || availableAttemptsPerWeek == null || availableAttemptsPerWeek <= 0){
    return {
      hasCapacityCheck: false,
      requiredAttemptsPerWeek,
      availableAttemptsPerWeek,
      gapAttemptsPerWeek: null,
      ratioRequiredToAvailable: null,
      severity: "ok",
      message: "",
    };
  }

  const gap = requiredAttemptsPerWeek - availableAttemptsPerWeek;
  const ratio = requiredAttemptsPerWeek / availableAttemptsPerWeek;
  let severity = "ok";
  let message = "";
  if (gap > 0){
    const overageText = formatFixedNumber(ratio - 1, 2, "0.00");
    if (ratio >= 1.5){
      severity = "bad";
      message = `Required weekly attempts exceed plausible capacity by ${overageText}x.`;
    } else {
      severity = "warn";
      message = `Required weekly attempts exceed plausible capacity by ${overageText}x.`;
    }
  }

  return {
    hasCapacityCheck: true,
    requiredAttemptsPerWeek,
    availableAttemptsPerWeek,
    gapAttemptsPerWeek: gap,
    ratioRequiredToAvailable: ratio,
    severity,
    message,
  };
}

/**
 * @param {{ driftSummary?: AnyRecord | null }} args
 */
export function evaluateHistoricalPlausibilityRules({ driftSummary = null } = {}){
  const out = [];
  const drift = driftSummary && typeof driftSummary === "object" ? driftSummary : null;
  if (!drift?.hasLog) return out;

  const checks = [
    {
      key: "historical_contact_rate",
      label: "Rolling contact rate",
      actual: safeNum(drift.actualCR),
      assumed: safeNum(drift.assumedCR),
    },
    {
      key: "historical_support_rate",
      label: "Rolling support rate",
      actual: safeNum(drift.actualSR),
      assumed: safeNum(drift.assumedSR),
    },
    {
      key: "historical_productivity",
      label: "Rolling productivity",
      actual: safeNum(drift.actualAPH),
      assumed: safeNum(drift.expectedAPH),
    },
  ];

  for (const row of checks){
    if (row.actual == null || row.assumed == null || row.assumed <= 0) continue;
    const ratio = row.actual / row.assumed;
    const ratioPctText = formatFixedNumber(ratio * 100, 0, "0");
    if (ratio < 0.8){
      out.push({
        kind: "historical",
        field: row.key,
        label: row.label,
        severity: "bad",
        value: row.actual,
        reason: `${row.label} is materially below assumed baseline (${ratioPctText}% of assumed).`,
      });
    } else if (ratio < 0.9){
      out.push({
        kind: "historical",
        field: row.key,
        label: row.label,
        severity: "warn",
        value: row.actual,
        reason: `${row.label} is below assumed baseline (${ratioPctText}% of assumed).`,
      });
    }
  }
  return out;
}

/**
 * @param {{
 *   state?: AnyRecord,
 *   voterSignals?: AnyRecord | null,
 * }} args
 */
export function evaluateAgeCohortRealismRules({
  state = {},
  voterSignals = null,
} = {}){
  const out = [];
  const signals = voterSignals && typeof voterSignals === "object"
    ? voterSignals
    : deriveVoterModelSignals(state?.voterData, {
      censusAgeDistribution: extractCensusAgeDistribution(state?.census),
      universeSize: safeNum(state?.universeSize),
    });
  const ageSeg = signals?.ageSegmentation && typeof signals.ageSegmentation === "object"
    ? signals.ageSegmentation
    : {};
  const historyIntel = signals?.historyIntelligence && typeof signals.historyIntelligence === "object"
    ? signals.historyIntelligence
    : {};
  const agePercents = ageSeg?.bucketPercents && typeof ageSeg.bucketPercents === "object"
    ? ageSeg.bucketPercents
    : {};
  const frequency = historyIntel?.frequencySegments && typeof historyIntel.frequencySegments === "object"
    ? historyIntel.frequencySegments
    : {};
  const ageSource = String(ageSeg?.source || "unknown").trim().toLowerCase();

  if (ageSource === "unknown"){
    out.push({
      kind: "age",
      field: "voterData.ageSegmentation",
      label: "Age segmentation",
      severity: "warn",
      value: null,
      reason: "Age segmentation is unavailable; age-cohort realism checks are limited.",
    });
    return out;
  }

  const totalRows = Math.max(0, safeNum(signals?.totalRows) ?? 0);
  const lowFrequencyCount = Math.max(0, safeNum(frequency?.lowFrequencyVoters) ?? 0);
  const dropoffCount = Math.max(0, safeNum(frequency?.dropoffVoters) ?? 0);
  const lowPropensityShare = totalRows > 0
    ? clampFiniteNumber((lowFrequencyCount + dropoffCount) / totalRows, 0, 1)
    : 0;
  const youngShare = clampFiniteNumber(
    (safeNum(agePercents?.age_18_24) ?? 0) + (safeNum(agePercents?.age_25_34) ?? 0),
    0,
    1,
  );
  const seniorShare = clampFiniteNumber(
    safeNum(agePercents?.age_65_plus) ?? 0,
    0,
    1,
  );
  const ageRiskScore = clampFiniteNumber(safeNum(ageSeg?.turnoutRiskScore) ?? 0, 0, 1);
  const turnoutBaselinePct = safeNum(state?.turnoutBaselinePct);
  const turnoutTargetPct = safeNum(state?.turnoutTargetOverridePct);
  const turnoutDelta = (turnoutTargetPct == null || turnoutBaselinePct == null)
    ? null
    : (turnoutTargetPct - turnoutBaselinePct);
  const persuasionPct = safeNum(state?.persuasionPct);

  if (turnoutDelta != null){
    if (turnoutDelta >= 10 && (lowPropensityShare >= 0.4 || ageRiskScore >= 0.68)){
      out.push({
        kind: "age",
        field: "turnoutTargetOverridePct",
        label: "Turnout target vs age cohort risk",
        severity: "bad",
        value: turnoutDelta,
        reason: `Turnout target increase (${formatFixedNumber(turnoutDelta, 1, "0.0")}pp) is inconsistent with low-propensity age profile (${formatFixedNumber(lowPropensityShare * 100, 0, "0")}% low/dropoff).`,
      });
    } else if (turnoutDelta >= 7 && (lowPropensityShare >= 0.32 || ageRiskScore >= 0.58)){
      out.push({
        kind: "age",
        field: "turnoutTargetOverridePct",
        label: "Turnout target vs age cohort risk",
        severity: "warn",
        value: turnoutDelta,
        reason: `Turnout target increase (${formatFixedNumber(turnoutDelta, 1, "0.0")}pp) is aggressive given age-cohort turnout risk.`,
      });
    }
  }

  if (persuasionPct != null){
    if (persuasionPct > 38 && seniorShare >= 0.5){
      out.push({
        kind: "age",
        field: "persuasionPct",
        label: "Persuasion assumption by age profile",
        severity: "bad",
        value: persuasionPct,
        reason: `Persuasion assumption (${formatFixedNumber(persuasionPct, 1, "0.0")}%) is implausibly high for a senior-heavy electorate profile.`,
      });
    } else if (persuasionPct > 32 && seniorShare >= 0.45){
      out.push({
        kind: "age",
        field: "persuasionPct",
        label: "Persuasion assumption by age profile",
        severity: "warn",
        value: persuasionPct,
        reason: `Persuasion assumption (${formatFixedNumber(persuasionPct, 1, "0.0")}%) is elevated for a senior-heavy electorate profile.`,
      });
    }
  }

  const tactics = state?.budget?.tactics && typeof state.budget.tactics === "object"
    ? state.budget.tactics
    : {};
  const textsEnabled = !!tactics?.texts?.enabled;
  const phonesEnabled = !!tactics?.phones?.enabled;
  const doorsEnabled = !!tactics?.doors?.enabled;
  const doorShare = resolveDoorShareUnitFromPct(state?.channelDoorPct, { fallback: 0.5 });

  if (youngShare >= 0.48 && doorShare >= 0.75 && !textsEnabled){
    out.push({
      kind: "age",
      field: "budget.tactics.texts.enabled",
      label: "Channel mix vs young cohort",
      severity: "warn",
      value: youngShare,
      reason: "Channel mix is door-heavy for a young-skew electorate while texts are disabled.",
    });
  }

  if (seniorShare >= 0.55 && !doorsEnabled && !phonesEnabled && textsEnabled){
    out.push({
      kind: "age",
      field: "budget.tactics",
      label: "Channel mix vs senior cohort",
      severity: "warn",
      value: seniorShare,
      reason: "Channel mix is text-heavy for a senior-skew electorate with no doors/phones enabled.",
    });
  }

  return out;
}

/**
 * @param {{
 *   state?: AnyRecord,
 *   res?: AnyRecord,
 *   weeks?: unknown,
 *   driftSummary?: AnyRecord | null,
 *   bands?: AnyRecord,
 * }} args
 */
export function collectRealismSignals({
  state = {},
  res = {},
  weeks = null,
  driftSummary = null,
  bands = {},
} = {}){
  const voterSignals = deriveVoterModelSignals(state?.voterData, {
    censusAgeDistribution: extractCensusAgeDistribution(state?.census),
    universeSize: safeNum(state?.universeSize),
  });
  const metrics = collectRealismMetrics(state);
  const ageSeg = voterSignals?.ageSegmentation && typeof voterSignals.ageSegmentation === "object"
    ? voterSignals.ageSegmentation
    : {};
  const historyIntel = voterSignals?.historyIntelligence && typeof voterSignals.historyIntelligence === "object"
    ? voterSignals.historyIntelligence
    : {};
  const frequency = historyIntel?.frequencySegments && typeof historyIntel.frequencySegments === "object"
    ? historyIntel.frequencySegments
    : {};
  const totalRows = Math.max(0, safeNum(voterSignals?.totalRows) ?? 0);
  const lowFrequencyCount = Math.max(0, safeNum(frequency?.lowFrequencyVoters) ?? 0);
  const dropoffCount = Math.max(0, safeNum(frequency?.dropoffVoters) ?? 0);
  const lowPropensityShare = totalRows > 0
    ? clampFiniteNumber((lowFrequencyCount + dropoffCount) / totalRows, 0, 1)
    : 0;
  const agePercents = ageSeg?.bucketPercents && typeof ageSeg.bucketPercents === "object"
    ? ageSeg.bucketPercents
    : {};
  metrics.ageKnownCoverageRate = clampFiniteNumber(safeNum(ageSeg?.knownAgeCoverageRate) ?? 0, 0, 1);
  metrics.ageTurnoutRiskScore = clampFiniteNumber(safeNum(ageSeg?.turnoutRiskScore) ?? 0, 0, 1);
  metrics.ageOpportunityScore = clampFiniteNumber(safeNum(ageSeg?.opportunityScore) ?? 0, 0, 1);
  metrics.lowPropensityShare = lowPropensityShare;
  metrics.youngShare = clampFiniteNumber(
    (safeNum(agePercents?.age_18_24) ?? 0) + (safeNum(agePercents?.age_25_34) ?? 0),
    0,
    1,
  );
  metrics.seniorShare = clampFiniteNumber(safeNum(agePercents?.age_65_plus) ?? 0, 0, 1);

  const bandRules = evaluateRealismBandRules({ state, bands });
  const budgetRules = evaluateBudgetRealismRules({ state });
  const crossRules = evaluateRealismCrossVariableRules({ metrics });
  const capacity = evaluateRealismCapacityRule({ state, res, weeks });
  const historicalRules = evaluateHistoricalPlausibilityRules({ driftSummary });
  const ageRules = evaluateAgeCohortRealismRules({ state, voterSignals });
  const eventRules = evaluateEventAssumptionRealism(state, {
    date: new Date().toISOString().slice(0, 10),
    scenarioId: state?.ui?.activeScenarioId || "",
  });

  return {
    metrics,
    bandFlags: Array.isArray(bandRules?.flags) ? bandRules.flags : [],
    budgetFlags: Array.isArray(budgetRules?.flags) ? budgetRules.flags : [],
    checkedBandKeys: Array.isArray(bandRules?.checked) ? bandRules.checked : [],
    checkedBudgetBandKeys: Array.isArray(budgetRules?.checked) ? budgetRules.checked : [],
    crossFlags: Array.isArray(crossRules) ? crossRules : [],
    historicalFlags: [
      ...(Array.isArray(historicalRules) ? historicalRules : []),
      ...(Array.isArray(ageRules) ? ageRules : []),
      ...(Array.isArray(eventRules) ? eventRules : []),
    ],
    ageFlags: Array.isArray(ageRules) ? ageRules : [],
    capacity,
    voterSignals: voterSignals && typeof voterSignals === "object" ? voterSignals : null,
  };
}

/**
 * @param {number} score
 * @param {number} badCount
 * @param {number} warnCount
 * @param {number | null} requiredToAvailableRatio
 */
export function classifyRealismAggressiveness(score, badCount, warnCount, requiredToAvailableRatio){
  const ratio = safeNum(requiredToAvailableRatio);
  if (badCount > 0 || score < 55 || (ratio != null && ratio >= 1.5)){
    return "unrealistic";
  }
  if (score < 70 || warnCount >= 4 || (ratio != null && ratio >= 1.2)){
    return "stretched";
  }
  if (score < 85 || warnCount >= 2){
    return "aggressive";
  }
  return "realistic";
}

/**
 * @param {{
 *   warnCount?: number,
 *   badCount?: number,
 *   crossWarnCount?: number,
 *   crossBadCount?: number,
 *   capacitySeverity?: string,
 * }} args
 */
export function scoreRealism({
  warnCount = 0,
  badCount = 0,
  crossWarnCount = 0,
  crossBadCount = 0,
  capacitySeverity = "ok",
} = {}){
  let penalty = 0;
  penalty += Math.min(36, Math.max(0, warnCount) * 6);
  penalty += Math.min(72, Math.max(0, badCount) * 18);
  penalty += Math.min(24, Math.max(0, crossWarnCount) * 8);
  penalty += Math.min(44, Math.max(0, crossBadCount) * 22);

  if (capacitySeverity === "warn"){
    penalty += 15;
  } else if (capacitySeverity === "bad"){
    penalty += 30;
  }

  return clampFiniteNumber(100 - penalty, 0, 100);
}
