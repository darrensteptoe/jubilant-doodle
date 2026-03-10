// Phase 10 — Vote production primitives (pure conversion helpers).
// These helpers centralize per-attempt vote math so ROI + optimization
// use one shared conversion surface.
// @ts-check

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function toFiniteOrNull(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(v, min, max){
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

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
  return Math.ceil(capAttempts);
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
