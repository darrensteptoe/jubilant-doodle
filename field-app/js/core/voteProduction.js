// Phase 10 — Vote production primitives (pure conversion helpers).
// These helpers centralize per-attempt vote math so ROI + optimization
// use one shared conversion surface.
// @ts-check
import { clampFiniteNumber, coerceFiniteNumber, roundWholeNumberByMode } from "./utils.js";

const toFiniteOrNull = coerceFiniteNumber;
const clamp = clampFiniteNumber;

/**
 * @param {unknown} pctMaybe
 * @param {number|null} fallbackDecimal
 * @returns {number|null}
 */
export function pctOverrideToDecimal(pctMaybe, fallbackDecimal){
  if (pctMaybe == null || pctMaybe === "" || !Number.isFinite(Number(pctMaybe))) return fallbackDecimal;
  const v = clamp(Number(pctMaybe), 0, 100);
  return v / 100;
}

/**
 * Coerce a mixed rate input to decimal units:
 * - accepts unit inputs in [0, 1]
 * - accepts percent-style inputs in (1, 100]
 * - falls back for invalid/out-of-range values
 *
 * @param {unknown} rateMaybe
 * @param {number|null} fallbackDecimal
 * @returns {number|null}
 */
export function rateOverrideToDecimal(rateMaybe, fallbackDecimal){
  if (rateMaybe == null || rateMaybe === "" || !Number.isFinite(Number(rateMaybe))) return fallbackDecimal;
  const n = Number(rateMaybe);
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return fallbackDecimal;
}

/**
 * Apply a multiplier to a percent-style assumption value (0..100 units).
 * @param {unknown} pctMaybe
 * @param {unknown} multiplierMaybe
 * @param {number|null} fallback
 * @returns {number|null}
 */
export function scalePercentAssumption(pctMaybe, multiplierMaybe = 1, fallback = null){
  const pct = toFiniteOrNull(pctMaybe);
  if (pct == null) return fallback;
  const mult = toFiniteOrNull(multiplierMaybe);
  return pct * (mult == null ? 1 : mult);
}

/**
 * Apply a divisor to an assumption value, preserving finite Number semantics.
 * @param {unknown} valueMaybe
 * @param {unknown} divisorMaybe
 * @param {number|null} fallback
 * @returns {number|null}
 */
export function scaleAssumptionByDivisor(valueMaybe, divisorMaybe = 1, fallback = null){
  const value = toFiniteOrNull(valueMaybe);
  if (value == null) return fallback;
  const divisor = toFiniteOrNull(divisorMaybe);
  if (divisor == null || divisor === 0) return value;
  return value / divisor;
}

/**
 * @param {{ universeSize?: unknown, targetUniversePct?: unknown }} args
 * @returns {number|null}
 */
export function computeTargetUniverseSize({
  universeSize,
  targetUniversePct,
} = {}){
  const U = toFiniteOrNull(universeSize);
  const pct = toFiniteOrNull(targetUniversePct);
  if (U == null || U <= 0) return null;
  if (pct == null) return null;
  const clampedPct = clamp(pct, 0, 100);
  return roundWholeNumberByMode(U * (clampedPct / 100), { mode: "round", fallback: null });
}

/**
 * @param {{ targetUniverseSize?: unknown, avgLiftPP?: unknown }} args
 * @returns {number|null}
 */
export function computeGotvAddedVotes({
  targetUniverseSize,
  avgLiftPP,
} = {}){
  const target = toFiniteOrNull(targetUniverseSize);
  const liftPP = toFiniteOrNull(avgLiftPP);
  if (target == null || target <= 0) return null;
  if (liftPP == null) return null;
  return roundWholeNumberByMode(target * (Math.max(0, liftPP) / 100), { mode: "round", fallback: null });
}

/**
 * @param {Record<string, any>|null|undefined} state
 * @param {{ enabled?: boolean|null, includeDisabled?: boolean }=} options
 * @returns {{ enabled:boolean, baselineTurnoutPct:number|null, liftPerContactPP:number|null, maxLiftPP:number|null, useDiminishing:boolean }|null}
 */
export function buildTurnoutModelFromState(state, { enabled = null, includeDisabled = false } = {}){
  const src = state && typeof state === "object" ? state : {};
  const turnoutEnabled = (enabled == null) ? !!src.turnoutEnabled : !!enabled;
  if (!turnoutEnabled && !includeDisabled) return null;

  const overrideBaseline = toFiniteOrNull(src.turnoutTargetOverridePct);
  const baselineTurnoutPct = (overrideBaseline != null)
    ? overrideBaseline
    : toFiniteOrNull(src.turnoutBaselinePct);
  const advancedMode = String(src.gotvMode || "basic").toLowerCase() === "advanced";
  const liftPerContactPP = advancedMode
    ? toFiniteOrNull(src.gotvLiftMode)
    : toFiniteOrNull(src.gotvLiftPP);
  const maxLiftPP = advancedMode
    ? toFiniteOrNull(src.gotvMaxLiftPP2)
    : toFiniteOrNull(src.gotvMaxLiftPP);

  return {
    enabled: turnoutEnabled,
    baselineTurnoutPct,
    liftPerContactPP,
    maxLiftPP,
    useDiminishing: !!src.gotvDiminishing,
  };
}

/**
 * @param {Record<string, any>|null} turnoutModel
 * @returns {import("./types").TurnoutContext}
 */
export function resolveTurnoutContext(turnoutModel = null){
  const turnoutEnabled = !!turnoutModel?.enabled;
  const gotvLiftPP = turnoutEnabled
    ? Math.max(0, Number(turnoutModel?.liftPerContactPP ?? 0))
    : 0;
  const gotvMaxLiftPP = turnoutEnabled
    ? Math.max(0, Number(turnoutModel?.maxLiftPP ?? 0))
    : 0;
  const baselineTurnoutPct = turnoutEnabled
    ? clamp(Number(turnoutModel?.baselineTurnoutPct ?? 0), 0, 100)
    : 0;
  const maxAdditionalPP = turnoutEnabled
    ? Math.max(0, Math.min(gotvMaxLiftPP, 100 - baselineTurnoutPct))
    : 0;
  const liftAppliedPP = Math.min(maxAdditionalPP, gotvLiftPP);
  return {
    enabled: turnoutEnabled,
    gotvLiftPP,
    gotvMaxLiftPP,
    baselineTurnoutPct,
    maxAdditionalPP,
    liftAppliedPP,
  };
}

/**
 * @param {{ cr?:unknown, sr?:unknown, tr?:unknown, requirePositive?:boolean }} args
 * @returns {number}
 */
export function computeBaseNetVotesPerAttempt({
  cr,
  sr,
  tr,
  requirePositive = true,
} = {}){
  const c = toFiniteOrNull(cr);
  const s = toFiniteOrNull(sr);
  const t = toFiniteOrNull(tr);
  if (c == null || s == null || t == null) return 0;
  if (requirePositive && (c <= 0 || s <= 0 || t <= 0)) return 0;
  return c * s * t;
}

/**
 * @param {{ cr?:unknown, liftPerContactPP?:unknown, requirePositiveCr?:boolean }} args
 * @returns {number}
 */
export function computeGotvNetVotesPerAttempt({
  cr,
  liftPerContactPP = 0,
  requirePositiveCr = true,
} = {}){
  const c = toFiniteOrNull(cr);
  if (c == null) return 0;
  if (requirePositiveCr && c <= 0) return 0;
  const lift = Math.max(0, Number(liftPerContactPP) || 0);
  return c * (lift / 100);
}

/**
 * @param {{ tr?:unknown, liftAppliedPP?:unknown, clampUnit?:boolean }} args
 * @returns {number|null}
 */
export function computeHybridEffectiveTurnoutReliability({
  tr,
  liftAppliedPP = 0,
  clampUnit = true,
} = {}){
  const baseTr = toFiniteOrNull(tr);
  if (baseTr == null) return null;
  const eff = baseTr + ((Number(liftAppliedPP) || 0) / 100);
  return clampUnit ? Math.min(1, eff) : eff;
}

/**
 * @param {{ cr?:unknown, targetUniverseSize?:unknown, maxAdditionalPP?:unknown, gotvLiftPP?:unknown }} args
 * @returns {number|null}
 */
export function computeGotvSaturationCapAttempts({
  cr,
  targetUniverseSize,
  maxAdditionalPP,
  gotvLiftPP,
} = {}){
  const c = toFiniteOrNull(cr);
  const target = toFiniteOrNull(targetUniverseSize);
  const maxPP = toFiniteOrNull(maxAdditionalPP);
  const liftPP = toFiniteOrNull(gotvLiftPP);
  if (c == null || c <= 0) return null;
  if (target == null || target <= 0) return null;
  if (maxPP == null || maxPP <= 0) return null;
  if (liftPP == null || liftPP <= 0) return null;
  const capContacts = target * (maxPP / liftPP);
  const capAttempts = capContacts / c;
  if (!Number.isFinite(capAttempts) || capAttempts <= 0) return null;
  return roundWholeNumberByMode(capAttempts, { mode: "ceil", fallback: null });
}

/**
 * @param {{
 *   cr?:unknown,
 *   sr?:unknown,
 *   tr?:unknown,
 *   kind?:string,
 *   turnoutContext?:import("./types").TurnoutContext|null,
 *   targetUniverseSize?:unknown,
 *   gotvSaturationCap?:boolean,
 *   requirePositiveBase?:boolean,
 *   requirePositiveGotvCr?:boolean,
 *   clampHybridTr?:boolean
 * }} args
 * @returns {{
 *   kind:string,
 *   baseNetVotesPerAttempt:number,
 *   turnoutAdjustedNetVotesPerAttempt:number,
 *   hybridEffectiveTr:number|null,
 *   maxAttempts:number|null,
 *   turnoutCtx:import("./types").TurnoutContext
 * }}
 */
export function computeTacticVoteProduction({
  cr,
  sr,
  tr,
  kind = "persuasion",
  turnoutContext = null,
  targetUniverseSize = null,
  gotvSaturationCap = false,
  requirePositiveBase = true,
  requirePositiveGotvCr = true,
  clampHybridTr = true,
} = {}){
  const turnoutCtx = (turnoutContext && typeof turnoutContext === "object")
    ? turnoutContext
    : resolveTurnoutContext(null);
  const normalizedKind = String(kind || "persuasion").toLowerCase();

  const baseNetVotesPerAttempt = computeBaseNetVotesPerAttempt({
    cr,
    sr,
    tr,
    requirePositive: !!requirePositiveBase,
  });

  let turnoutAdjustedNetVotesPerAttempt = baseNetVotesPerAttempt;
  let hybridEffectiveTr = null;
  let maxAttempts = null;

  if (turnoutCtx?.enabled){
    if (normalizedKind === "gotv"){
      turnoutAdjustedNetVotesPerAttempt = computeGotvNetVotesPerAttempt({
        cr,
        liftPerContactPP: turnoutCtx.gotvLiftPP,
        requirePositiveCr: !!requirePositiveGotvCr,
      });
      if (gotvSaturationCap){
        maxAttempts = computeGotvSaturationCapAttempts({
          cr,
          targetUniverseSize,
          maxAdditionalPP: turnoutCtx.maxAdditionalPP,
          gotvLiftPP: turnoutCtx.gotvLiftPP,
        });
      }
    } else if (normalizedKind === "hybrid"){
      hybridEffectiveTr = computeHybridEffectiveTurnoutReliability({
        tr,
        liftAppliedPP: turnoutCtx.liftAppliedPP,
        clampUnit: !!clampHybridTr,
      });
      turnoutAdjustedNetVotesPerAttempt = computeBaseNetVotesPerAttempt({
        cr,
        sr,
        tr: hybridEffectiveTr,
        requirePositive: !!requirePositiveBase,
      });
    }
  }

  return {
    kind: normalizedKind,
    baseNetVotesPerAttempt,
    turnoutAdjustedNetVotesPerAttempt,
    hybridEffectiveTr,
    maxAttempts,
    turnoutCtx,
  };
}
