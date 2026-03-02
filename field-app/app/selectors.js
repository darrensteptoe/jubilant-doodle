import { safeNum, daysBetween, clamp } from "../utils.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS } from "../core/universeLayer.js";

export function derivedWeeksRemainingFromState(state, { nowDate = new Date() } = {}){
  const override = safeNum(state?.weeksRemaining);
  if (override != null && override >= 0) return override;

  const d = state?.electionDate;
  if (!d) return null;
  const election = new Date(d + "T00:00:00");
  const days = daysBetween(nowDate, election);
  if (days == null) return null;
  return Math.max(0, Math.ceil(days / 7));
}

export function getUniverseLayerConfig(state){
  const enabled = !!state?.universeLayerEnabled;
  const demPct = safeNum(state?.universeDemPct);
  const repPct = safeNum(state?.universeRepPct);
  const npaPct = safeNum(state?.universeNpaPct);
  const otherPct = safeNum(state?.universeOtherPct);
  const retentionFactor = safeNum(state?.retentionFactor);

  const norm = normalizeUniversePercents({ demPct, repPct, npaPct, otherPct });
  return {
    enabled,
    percents: norm.percents,
    shares: norm.shares,
    retentionFactor: (retentionFactor != null) ? clamp(retentionFactor, 0.60, 0.95) : UNIVERSE_DEFAULTS.retentionFactor,
    warning: norm.warning || "",
    wasNormalized: !!norm.normalized,
  };
}

export function getEffectiveBaseRates(state, { computeUniverseAdjustedRates } = {}){
  const cr = (safeNum(state?.contactRatePct) != null) ? clamp(safeNum(state.contactRatePct), 0, 100) / 100 : null;
  const sr = (safeNum(state?.supportRatePct) != null) ? clamp(safeNum(state.supportRatePct), 0, 100) / 100 : null;
  const tr = (safeNum(state?.turnoutReliabilityPct) != null) ? clamp(safeNum(state.turnoutReliabilityPct), 0, 100) / 100 : null;

  const cfg = getUniverseLayerConfig(state);
  const adj = computeUniverseAdjustedRates({
    enabled: cfg.enabled,
    universePercents: cfg.percents,
    retentionFactor: cfg.retentionFactor,
    supportRate: sr,
    turnoutReliability: tr,
  });

  return {
    cr,
    sr: adj.srAdj,
    tr: adj.trAdj,
    cfg,
    meta: adj.meta,
    volatilityBoost: adj.volatilityBoost || 0,
  };
}

export function computeWeeklyOpsContextFromState(state, { res, weeks, getEffectiveBaseRatesForState, computeCapacityBreakdown } = {}){
  const rawGoal = safeNum(state?.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

  const eff = getEffectiveBaseRatesForState(state);
  const sr = eff.sr;
  const cr = eff.cr;

  let convosNeeded = null;
  let attemptsNeeded = null;
  let convosPerWeek = null;
  let attemptsPerWeek = null;

  if (goal > 0 && sr && sr > 0) convosNeeded = goal / sr;
  if (convosNeeded != null && cr && cr > 0) attemptsNeeded = convosNeeded / cr;
  if (weeks != null && weeks > 0){
    if (convosNeeded != null) convosPerWeek = convosNeeded / weeks;
    if (attemptsNeeded != null) attemptsPerWeek = attemptsNeeded / weeks;
  }

  const orgCount = safeNum(state?.orgCount);
  const orgHoursPerWeek = safeNum(state?.orgHoursPerWeek);
  const volunteerMult = safeNum(state?.volunteerMultBase);
  const doorSharePct = safeNum(state?.channelDoorPct);
  const doorsPerHour = safeNum(state?.doorsPerHour3);
  const callsPerHour = safeNum(state?.callsPerHour3);

  const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct / 100, 0, 1);

  const cap = computeCapacityBreakdown({
    weeks: 1,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour
  });

  const capTotal = cap?.total ?? null;
  const gap = (attemptsPerWeek != null && capTotal != null) ? (attemptsPerWeek - capTotal) : null;

  return {
    goal,
    weeks,
    sr,
    cr,
    convosNeeded,
    attemptsNeeded,
    convosPerWeek,
    attemptsPerWeek,
    cap,
    capTotal,
    gap,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour
  };
}
