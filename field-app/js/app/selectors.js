// @ts-check
import { safeNum, clamp } from "../utils.js";
import { normalizeUniversePercents, UNIVERSE_DEFAULTS } from "../core/universeLayer.js";
import { resolveFeatureFlags } from "../core/featureFlags.js";
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
  let doorsPerHour = safeNum(state?.doorsPerHour3);
  let callsPerHour = safeNum(state?.callsPerHour3);
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
    const capsInput = {
      enabled: true,
      weeksRemaining: weeks ?? 0,
      activeWeeksOverride: safeNum(state?.timelineActiveWeeks),
      gotvWindowWeeks: safeNum(state?.timelineGotvWeeks),
      staffing: {
        staff: safeNum(state?.timelineStaffCount) ?? 0,
        volunteers: safeNum(state?.timelineVolCount) ?? 0,
        staffHours: safeNum(state?.timelineStaffHours) ?? 0,
        volunteerHours: safeNum(state?.timelineVolHours) ?? 0,
      },
      throughput: {
        doors: safeNum(state?.timelineDoorsPerHour) ?? 0,
        phones: safeNum(state?.timelineCallsPerHour) ?? 0,
        texts: safeNum(state?.timelineTextsPerHour) ?? 0,
      },
      tacticKinds: {
        doors: state?.budget?.tactics?.doors?.kind || "persuasion",
        phones: state?.budget?.tactics?.phones?.kind || "persuasion",
        texts: state?.budget?.tactics?.texts?.kind || "persuasion",
      }
    };
    const capsWrap = computeMaxAttemptsByTactic(capsInput);
    const tCaps = (capsWrap && capsWrap.enabled && capsWrap.maxAttemptsByTactic && typeof capsWrap.maxAttemptsByTactic === "object")
      ? capsWrap.maxAttemptsByTactic
      : null;
    if (tCaps){
      const asCap = (v) => {
        const n = Number(v);
        return (Number.isFinite(n) && n >= 0) ? n : null;
      };
      const timelineCapsByTactic = {};
      for (const [key, value] of Object.entries(tCaps)){
        timelineCapsByTactic[key] = asCap(value);
      }
      const total = Object.values(timelineCapsByTactic).reduce((sum, v) => sum + ((v == null) ? 0 : v), 0);
      if (Number.isFinite(total) && total >= 0){
        capTotal = total;
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
