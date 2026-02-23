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

