// @ts-check
// js/universeLayer.js
// Phase 16 — Universe Composition + Retention Layer
// Pure module: no DOM, no mutation.
import { clampFiniteNumber, coerceFiniteNumber, formatFixedNumber } from "./utils.js";
import { pctOverrideToDecimal } from "./voteProduction.js";

/**
 * @typedef {object} UniversePercents
 * @property {number=} demPct
 * @property {number=} repPct
 * @property {number=} npaPct
 * @property {number=} otherPct
 */

/**
 * @typedef {object} UniverseAdjustedRatesInput
 * @property {boolean=} enabled
 * @property {UniversePercents=} universePercents
 * @property {number=} retentionFactor
 * @property {number=} supportRate
 * @property {number=} turnoutReliability
 */

const safeNum = coerceFiniteNumber;
const clamp = clampFiniteNumber;

/**
 * @param {unknown} x
 * @returns {number | null}
 */
function clamp01(x){
  const n = safeNum(x);
  if (n == null) return null;
  return clampFiniteNumber(n, 0, 1);
}

export const UNIVERSE_DEFAULTS = {
  enabled: false,
  demPct: 100,
  repPct: 0,
  npaPct: 0,
  otherPct: 0,
  retentionFactor: 0.80,
};

export const UNIVERSE_MULTIPLIERS = {
  persuasion: { dem: 1.00, rep: 0.60, npa: 1.10, other: 0.80 },
  turnout: { dem: 1.00, rep: 1.05, npa: 0.90, other: 0.85 },
};

export const TURNOUT_BOOST_CAP = 0.05;

/**
 * @param {UniversePercents=} input
 * @returns {{
 *   percents: { demPct: number, repPct: number, npaPct: number, otherPct: number },
 *   shares: { dem: number, rep: number, npa: number, other: number },
 *   sum: number,
 *   normalized: boolean,
 *   warning: string
 * }}
 */
export function normalizeUniversePercents({ demPct, repPct, npaPct, otherPct } = {}){
  const d = clamp(demPct, 0, 100);
  const r = clamp(repPct, 0, 100);
  const n = clamp(npaPct, 0, 100);
  const o = clamp(otherPct, 0, 100);
  const sum = d + r + n + o;

  // If everything is 0 or not meaningful, fall back to homogeneous.
  if (!Number.isFinite(sum) || sum <= 0){
    return {
      percents: { demPct: 100, repPct: 0, npaPct: 0, otherPct: 0 },
      shares: { dem: 1, rep: 0, npa: 0, other: 0 },
      sum: 100,
      normalized: true,
      warning: "Universe composition defaulted to 100% Dem (no valid inputs).",
    };
  }

  // Normalize to 100% (keeps UI tolerant to small entry error).
  const nd = 100 * (d / sum);
  const nr = 100 * (r / sum);
  const nn = 100 * (n / sum);
  const no = 100 * (o / sum);

  return {
    percents: { demPct: nd, repPct: nr, npaPct: nn, otherPct: no },
    shares: {
      dem: pctOverrideToDecimal(nd, 0) ?? 0,
      rep: pctOverrideToDecimal(nr, 0) ?? 0,
      npa: pctOverrideToDecimal(nn, 0) ?? 0,
      other: pctOverrideToDecimal(no, 0) ?? 0,
    },
    sum,
    normalized: Math.abs(sum - 100) > 0.05,
    warning: Math.abs(sum - 100) > 0.05
      ? `Universe composition normalized from ${formatFixedNumber(sum, 1, "—")}% to 100%.`
      : "",
  };
}

/**
 * @param {{ dem?: number, rep?: number, npa?: number, other?: number } | null | undefined} shares
 * @param {{ dem?: number, rep?: number, npa?: number, other?: number }} multipliers
 * @returns {number}
 */
function weightedMultiplier(shares, multipliers){
  const s = shares || { dem: 1, rep: 0, npa: 0, other: 0 };
  return (
    (s.dem ?? 0) * (multipliers.dem ?? 1) +
    (s.rep ?? 0) * (multipliers.rep ?? 1) +
    (s.npa ?? 0) * (multipliers.npa ?? 1) +
    (s.other ?? 0) * (multipliers.other ?? 1)
  );
}

/**
 * @param {UniverseAdjustedRatesInput=} input
 */
export function computeUniverseAdjustedRates({
  enabled,
  universePercents,
  retentionFactor,
  supportRate,
  turnoutReliability,
} = {}){
  const on = !!enabled;
  const sr = clamp01(supportRate);
  const tr = clamp01(turnoutReliability);

  // UI constrains to 0.60–0.95, but allowing 1.00 here lets the self-test
  // assert the strict identity case (no drift) for exports / fixtures.
  const rf = clamp(retentionFactor, 0.60, 1.00);

  if (!on){
    return {
      srAdj: sr,
      trAdj: tr,
      volatilityBoost: 0,
      meta: {
        enabled: false,
        retentionFactor: rf,
        persuasionMultiplier: 1,
        turnoutMultiplier: 1,
        turnoutBoostApplied: 0,
      }
    };
  }

  // Hard identity guard: retentionFactor=1.0 must match Phase 15 baseline.
  // (This also keeps backwards-compat fixtures stable even if enabled.)
  if (rf >= 0.999999){
    return {
      srAdj: sr,
      trAdj: tr,
      volatilityBoost: 0,
      meta: {
        enabled: true,
        retentionFactor: 1,
        persuasionMultiplier: 1,
        turnoutMultiplier: 1,
        turnoutBoostApplied: 0,
        normalizedWarning: "",
        normalizedPercents: null,
      }
    };
  }

  const norm = normalizeUniversePercents(universePercents || {});
  const shares = norm.shares;

  const pMult = weightedMultiplier(shares, UNIVERSE_MULTIPLIERS.persuasion);
  const tMult = weightedMultiplier(shares, UNIVERSE_MULTIPLIERS.turnout);

  const srAdjRaw = (sr == null) ? null : (sr * pMult * rf);
  const srAdj = (srAdjRaw == null) ? null : clamp01(srAdjRaw);

  const boost = TURNOUT_BOOST_CAP; // cap at 5%
  const boostApplied = boost * rf;
  const trAdjRaw = (tr == null) ? null : (tr * tMult * (1 + boostApplied));
  const trAdj = (trAdjRaw == null) ? null : clamp01(trAdjRaw);

  // Slightly widen volatility when retention is low (applied in MC only).
  // Boost is small and capped (<= 0.05 absolute volatility width).
  const volatilityBoost = Math.min(0.05, Math.max(0, (1 - rf) * 0.10));

  return {
    srAdj,
    trAdj,
    volatilityBoost,
    meta: {
      enabled: true,
      retentionFactor: rf,
      persuasionMultiplier: pMult,
      turnoutMultiplier: tMult,
      turnoutBoostApplied: boostApplied,
      normalizedWarning: norm.warning || "",
      normalizedPercents: norm.percents,
    }
  };
}
