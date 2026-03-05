import { safeNum, clamp } from "../utils.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS } from "../core/universeLayer.js";
import {
  deriveNeedVotesOrZero as coreDeriveNeedVotesOrZero,
  deriveWeeksRemainingCeil as coreDeriveWeeksRemainingCeil
} from "../core/model.js";

export function derivedWeeksRemainingFromState(state, { nowDate = new Date() } = {}){
  return coreDeriveWeeksRemainingCeil({
    weeksRemainingOverride: state?.weeksRemaining,
    electionDateISO: state?.electionDate ? `${state.electionDate}T00:00:00` : "",
    nowDate
  });
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

export function computeWeeklyOpsContextFromState(state, {
  res,
  weeks,
  getEffectiveBaseRatesForState,
  computeCapacityBreakdown,
  compileEffectiveInputsForState
} = {}){
  const goal = coreDeriveNeedVotesOrZero(res, state?.goalSupportIds);

  const eff = getEffectiveBaseRatesForState(state);
  let sr = eff.sr;
  let cr = eff.cr;

  let convosNeeded = null;
  let attemptsNeeded = null;
  let convosPerWeek = null;
  let attemptsPerWeek = null;

  let orgCount = safeNum(state?.orgCount);
  let orgHoursPerWeek = safeNum(state?.orgHoursPerWeek);
  let volunteerMult = safeNum(state?.volunteerMultBase);
  let doorSharePct = safeNum(state?.channelDoorPct);
  let doorsPerHour = safeNum(state?.doorsPerHour3);
  let callsPerHour = safeNum(state?.callsPerHour3);
  let capacityDecay = {
    enabled: !!state?.intelState?.expertToggles?.capacityDecayEnabled,
    type: String(state?.intelState?.expertToggles?.decayModel?.type || "linear"),
    weeklyDecayPct: safeNum(state?.intelState?.expertToggles?.decayModel?.weeklyDecayPct),
    floorPctOfBaseline: safeNum(state?.intelState?.expertToggles?.decayModel?.floorPctOfBaseline),
  };

  let compiled = null;
  if (typeof compileEffectiveInputsForState === "function"){
    compiled = compileEffectiveInputsForState(state) || null;
  }
  if (compiled){
    const rates = compiled.rates || {};
    if (rates.sr != null) sr = rates.sr;
    if (rates.cr != null) cr = rates.cr;

    const capIn = compiled.capacity || {};
    if (capIn.orgCount != null) orgCount = capIn.orgCount;
    if (capIn.orgHoursPerWeek != null) orgHoursPerWeek = capIn.orgHoursPerWeek;
    if (capIn.volunteerMult != null) volunteerMult = capIn.volunteerMult;
    if (capIn.doorSharePct != null) doorSharePct = capIn.doorSharePct;
    if (capIn.doorsPerHour != null) doorsPerHour = capIn.doorsPerHour;
    if (capIn.callsPerHour != null) callsPerHour = capIn.callsPerHour;
    if (capIn.capacityDecay) capacityDecay = capIn.capacityDecay;
  }

  if (goal > 0 && sr && sr > 0) convosNeeded = goal / sr;
  if (convosNeeded != null && cr && cr > 0) attemptsNeeded = convosNeeded / cr;
  if (weeks != null && weeks > 0){
    if (convosNeeded != null) convosPerWeek = convosNeeded / weeks;
    if (attemptsNeeded != null) attemptsPerWeek = attemptsNeeded / weeks;
  }

  const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct / 100, 0, 1);

  const cap = computeCapacityBreakdown({
    weeks: 1,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour,
    capacityDecay
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
    callsPerHour,
    capacityDecay
  };
}
