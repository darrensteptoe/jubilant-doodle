// @ts-check
import { safeNum, clamp } from "../utils.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS } from "../core/universeLayer.js";
import { resolveFeatureFlags } from "../core/featureFlags.js";
import { NULL_BASE_RATE_DEFAULTS, resolveStateBaseRates } from "../core/baseRates.js";
import { computeGoalPaceRequirements } from "../core/executionPlanner.js";
import {
  buildTimelineTacticKindsMapFromState,
  computeTimelineCapsSummaryFromState,
} from "../core/timelineCapsInput.js";
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorsPerHour,
  resolveDoorShareUnitFromPct,
} from "../core/throughput.js";
import {
  deriveNeedVotesOrZero as coreDeriveNeedVotesOrZero,
  deriveWeeksRemainingCeil as coreDeriveWeeksRemainingCeil
} from "../core/model.js";

/**
 * @typedef {Record<string, any>} AnyState
 */

/**
 * @param {AnyState} state
 * @param {{ nowDate?: Date }=} options
 */
export function derivedWeeksRemainingFromState(state, { nowDate = new Date() } = {}){
  return coreDeriveWeeksRemainingCeil({
    weeksRemainingOverride: state?.weeksRemaining,
    electionDateISO: state?.electionDate ? `${state.electionDate}T00:00:00` : "",
    nowDate
  });
}

/**
 * @param {AnyState} state
 */
export function getUniverseLayerConfig(state){
  const features = resolveFeatureFlags(state || {});
  const enabled = !!features.universeWeightingEnabled;
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

/**
 * @param {AnyState} state
 * @param {{ computeUniverseAdjustedRates: (args: Record<string, any>) => Record<string, any> }=} deps
 */
export function getEffectiveBaseRates(state, { computeUniverseAdjustedRates } = {}){
  const baseRates = resolveStateBaseRates(state, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  const cr = baseRates.cr;
  const sr = baseRates.sr;
  const tr = baseRates.tr;

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
    meta: {
      universe: adj.meta,
    },
    volatilityBoost: adj.volatilityBoost || 0,
  };
}

/**
 * @param {AnyState} state
 * @param {{
 *   res: Record<string, any>,
 *   weeks: number | null,
 *   getEffectiveBaseRatesForState: (state: AnyState) => Record<string, any>,
 *   computeCapacityBreakdown: (args: Record<string, any>) => Record<string, any>,
 *   compileEffectiveInputsForState: (state: AnyState) => Record<string, any> | null,
 *   computeMaxAttemptsByTactic: (args: Record<string, any>) => Record<string, any>,
 * }=} deps
 */
export function computeWeeklyOpsContextFromState(state, {
  res,
  weeks,
  getEffectiveBaseRatesForState,
  computeCapacityBreakdown,
  compileEffectiveInputsForState,
  computeMaxAttemptsByTactic,
} = {}){
  const features = resolveFeatureFlags(state || {});
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
  let doorsPerHour = resolveCanonicalDoorsPerHour(state, { toNumber: safeNum });
  let callsPerHour = resolveCanonicalCallsPerHour(state, { toNumber: safeNum });
  let capacityDecay = {
    enabled: !!features.capacityDecayEnabled,
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

  const paceReq = computeGoalPaceRequirements({
    goalVotes: goal,
    supportRate: sr,
    contactRate: cr,
    weeks,
  });
  convosNeeded = paceReq.convosNeeded;
  attemptsNeeded = paceReq.attemptsNeeded;
  convosPerWeek = paceReq.convosPerWeek;
  attemptsPerWeek = paceReq.attemptsPerWeek;

  const doorShare = resolveDoorShareUnitFromPct(doorSharePct);

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
  let capTotal = cap?.total ?? null;
  let capSource = "classic";
  let capByTactic = {
    doors: cap?.doors ?? null,
    phones: cap?.phones ?? null,
    texts: null,
  };

  const tlConstrainedOn = !!state?.budget?.optimize?.tlConstrainedEnabled;
  const timelineEnabled = !!features.timelineEnabled;
  if (tlConstrainedOn && timelineEnabled && typeof computeMaxAttemptsByTactic === "function"){
    const capsSummary = computeTimelineCapsSummaryFromState({
      state,
      weeksRemaining: weeks ?? 0,
      enabled: true,
      tacticKinds: buildTimelineTacticKindsMapFromState(state),
      computeMaxAttemptsByTactic,
    });
    if (capsSummary.maxAttemptsByTactic){
      const timelineCapsByTactic = capsSummary.capsByTactic || {};
      if (capsSummary.totalAttempts != null){
        capTotal = capsSummary.totalAttempts;
        capSource = "timeline";
        capByTactic = { ...capByTactic, ...timelineCapsByTactic };
      }
    }
  }

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
    capByTactic,
    capTotal,
    capSource,
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
