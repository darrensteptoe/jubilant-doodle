// js/core/monteCarlo.js
// Monte Carlo engine (pure). Extracted from app.js so UI contains no simulation loops.
// Must not touch DOM/window/document.

import { makeRng, triSample } from "./rng.js";

function normalizeTri({ min, mode, max }){
  let a = min, b = mode, c = max;
  if (!isFinite(a)) a = 0;
  if (!isFinite(b)) b = 0;
  if (!isFinite(c)) c = 0;

  // Enforce ordering
  const lo = Math.min(a, b, c);
  const hi = Math.max(a, b, c);
  // keep mode inside
  b = clamp(b, lo, hi);
  return { min: lo, mode: b, max: hi };
}

import { safeNum, clamp } from "./utils.js";
import { computeAvgLiftPP } from "./turnout.js";
import { computeUniverseAdjustedRates, normalizeUniversePercents } from "./universeLayer.js";
import { computeCapacityContacts } from "./model.js";
import { computeConfidenceEnvelope } from "./confidenceEnvelope.js";

// --- helpers (verbatim logic from prior app.js) ---
function pctToUnit(v, fallback){
  if (v == null || !isFinite(v)) return fallback;
  return clamp(v, 0, 100) / 100;
}

function spread(base, w, minClamp, maxClamp){
  const mode = base;
  const min = clamp(base * (1 - w), minClamp, maxClamp);
  const max = clamp(base * (1 + w), minClamp, maxClamp);
  return normalizeTri({ min, mode, max });
}

function triFromPctInputs(minIn, modeIn, maxIn, baseUnit){
  const fallbackMode = baseUnit;
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null) ? clamp(modeV, 0, 100) / 100 : fallbackMode;
  const min = (minV != null) ? clamp(minV, 0, 100) / 100 : clamp(mode * 0.8, 0, 1);
  const max = (maxV != null) ? clamp(maxV, 0, 100) / 100 : clamp(mode * 1.2, 0, 1);

  return normalizeTri({ min, mode, max });
}

function triFromNumInputs(minIn, modeIn, maxIn, base, floor){
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null && modeV > 0) ? modeV : base;
  const min = (minV != null && minV > 0) ? minV : Math.max(floor, mode * 0.8);
  const max = (maxV != null && maxV > 0) ? maxV : Math.max(min + floor, mode * 1.2);

  return normalizeTri({ min, mode, max });
}

function buildBasicSpecs(sc, { baseCr, basePr, baseRr, baseDph, baseCph, baseVol, volBoost = 0 }){
  const v = (sc.mcVolatility || "med");
  const w = (v === "low") ? 0.10 : (v === "high") ? 0.30 : 0.20;

  return {
    contactRate: spread(baseCr, w, 0, 1),
    persuasionRate: spread(basePr, w + (volBoost || 0), 0, 1),
    turnoutReliability: spread(baseRr, w + (volBoost || 0), 0, 1),
    doorsPerHour: spread(baseDph, w, 0.01, Infinity),
    callsPerHour: spread(baseCph, w, 0.01, Infinity),
    volunteerMult: spread(baseVol, w, 0.01, Infinity),
  };
}

function buildAdvancedSpecs(sc, { baseCr, basePr, baseRr, baseDph, baseCph, baseVol, volBoost = 0 }){
  // Inputs are in % for rates and raw for productivity/multiplier.
  const cr = triFromPctInputs(sc.mcContactMin, sc.mcContactMode, sc.mcContactMax, baseCr);
  const pr0 = triFromPctInputs(sc.mcPersMin, sc.mcPersMode, sc.mcPersMax, basePr);
  const rr0 = triFromPctInputs(sc.mcReliMin, sc.mcReliMode, sc.mcReliMax, baseRr);

  // Phase 16 — widen triangle slightly when retention is low (tiny, capped)
  const widen = (tri, boost) => {
    if (!tri || tri.min == null || tri.mode == null || tri.max == null) return tri;
    const b = Math.max(0, Number(boost) || 0);
    if (b <= 0) return tri;
    const mid = tri.mode;
    const span = (tri.max - tri.min);
    const extra = span * b;
    return {
      min: Math.max(0, tri.min - extra),
      mode: Math.min(1, Math.max(0, mid)),
      max: Math.min(1, tri.max + extra)
    };
  };

  const pr = widen(pr0, volBoost);
  const rr = widen(rr0, volBoost);

  const dph = triFromNumInputs(sc.mcDphMin, sc.mcDphMode, sc.mcDphMax, baseDph, 0.01);
  const cph = triFromNumInputs(sc.mcCphMin, sc.mcCphMode, sc.mcCphMax, baseCph, 0.01);
  const vm = triFromNumInputs(sc.mcVolMin, sc.mcVolMode, sc.mcVolMax, baseVol, 0.01);

  return {
    contactRate: cr,
    persuasionRate: pr,
    turnoutReliability: rr,
    doorsPerHour: dph,
    callsPerHour: cph,
    volunteerMult: vm,
  };
}

function quantileSorted(sorted, q){
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] == null) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function sum(arr){
  let s = 0;
  for (let i=0;i<arr.length;i++) s += arr[i];
  return s;
}

function mean(arr){
  if (!arr || arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

function riskLabelFromWinProb(p){
  if (p >= 0.85) return "Strong structural position";
  if (p >= 0.65) return "Favored but fragile";
  if (p >= 0.50) return "Toss-up";
  return "Structural underdog";
}

function computeSensitivity(samples, margins){
  // Pearson correlation between each variable and margin; return absolute impact.
  const out = [];

  const vars = [
    ["Turnout reliability", samples.turnoutReliability],
    ["Persuasion rate", samples.persuasionRate],
    ["Organizer productivity (doors/hr)", samples.doorsPerHour],
    ["Organizer productivity (calls/hr)", samples.callsPerHour],
    ["Contact rate", samples.contactRate],
    ["Volunteer multiplier", samples.volunteerMult],
  ];

  for (const [label, xs] of vars){
    const r = pearson(xs, margins);
    out.push({ label, impact: (r == null) ? null : Math.abs(r) });
  }

  out.sort((a,b) => (b.impact ?? -1) - (a.impact ?? -1));
  return out;
}

function pearson(xs, ys){
  const n = xs.length;
  if (!n || ys.length !== n) return null;

  let sumX=0, sumY=0;
  for (let i=0;i<n;i++){ sumX += xs[i]; sumY += ys[i]; }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num=0, denX=0, denY=0;
  for (let i=0;i<n;i++){
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (!isFinite(den) || den === 0) return null;
  return num / den;
}

function getUniverseLayerConfig(sc){
  const enabled = !!sc.universeLayerEnabled;
  const demPct = safeNum(sc.universeDemPct);
  const repPct = safeNum(sc.universeRepPct);
  const npaPct = safeNum(sc.universeNpaPct);
  const otherPct = safeNum(sc.universeOtherPct);
  const retentionFactor = safeNum(sc.retentionFactor);

  const norm = normalizeUniversePercents({ demPct, repPct, npaPct, otherPct });
  return {
    enabled,
    percents: norm?.percents || { demPct, repPct, npaPct, otherPct },
    retentionFactor,
  };
}

export function runMonteCarloSim({ scenario, scenarioState, res, weeks, needVotes, runs, seed, includeMargins }){
  const sc = scenario || scenarioState || {}; 
  const mode = sc.mcMode || "basic";

  // Base rates
  const baseCr = pctToUnit(safeNum(sc.contactRatePct), 0.22);
  const rawPr = pctToUnit(safeNum(sc.supportRatePct), 0.55);
  const rawRr = pctToUnit(safeNum(sc.turnoutReliabilityPct), 0.80);

  // Phase 16 — optional universe weighting + retention (no drift when disabled)
  const cfg = getUniverseLayerConfig(sc);
  const adj = computeUniverseAdjustedRates({
    enabled: cfg.enabled,
    universePercents: cfg.percents,
    retentionFactor: cfg.retentionFactor,
    supportRate: rawPr,
    turnoutReliability: rawRr,
  });

  const basePr = (adj && adj.srAdj != null) ? adj.srAdj : rawPr;
  const baseRr = (adj && adj.trAdj != null) ? adj.trAdj : rawRr;
  const volBoost = (cfg.enabled && adj && adj.volatilityBoost != null) ? adj.volatilityBoost : 0;

  // Capacity bases
  const orgCount = safeNum(sc.orgCount) ?? 2;
  const orgHrs = safeNum(sc.orgHoursPerWeek) ?? 40;
  const doorShare = pctToUnit(safeNum(sc.channelDoorPct), 0.70);
  const baseDph = safeNum(sc.doorsPerHour3) ?? safeNum(sc.doorsPerHour) ?? 30;
  const baseCph = safeNum(sc.callsPerHour3) ?? 20;
  const baseVol = safeNum(sc.volunteerMultBase) ?? 1.0;

  const rng = makeRng(seed);

  const specs = (mode === "advanced")
    ? buildAdvancedSpecs(sc, { baseCr, basePr, baseRr, baseDph, baseCph, baseVol, volBoost })
    : buildBasicSpecs(sc, { baseCr, basePr, baseRr, baseDph, baseCph, baseVol, volBoost });

  const margins = new Array(runs);
  const wins = new Array(runs);

  // Track sampled variables for sensitivity.
  const samples = {
    contactRate: new Array(runs),
    persuasionRate: new Array(runs),
    turnoutReliability: new Array(runs),
    doorsPerHour: new Array(runs),
    callsPerHour: new Array(runs),
    volunteerMult: new Array(runs),
  };

  const turnoutEnabled = !!sc.turnoutEnabled;
  const baseTurnoutPct = (safeNum(sc.turnoutTargetOverridePct) != null) ? safeNum(sc.turnoutTargetOverridePct) : safeNum(sc.turnoutBaselinePct);
  const gotvMaxLiftPP = (sc.gotvMode === "advanced") ? safeNum(sc.gotvMaxLiftPP2) : safeNum(sc.gotvMaxLiftPP);
  const useDim = (sc.gotvMode === "advanced") ? !!sc.gotvDiminishing2 : !!sc.gotvDiminishing;

  const U = safeNum(sc.universeSize);
  const tuPct = safeNum(sc.persuasionPct);
  const targetUniverseSize = (U != null && tuPct != null) ? Math.round(U * (clamp(tuPct, 0, 100) / 100)) : null;

  const turnoutAdjustedVotesArr = new Array(runs);
  const winsTA = new Array(runs);

  // Add sampled GOTV lift to sensitivity when enabled + advanced
  if (turnoutEnabled && mode === "advanced"){
    samples.gotvLift = new Array(runs);
  }


  for (let i=0;i<runs;i++){
    const cr = triSample(specs.contactRate.min, specs.contactRate.mode, specs.contactRate.max, rng);
    const pr = triSample(specs.persuasionRate.min, specs.persuasionRate.mode, specs.persuasionRate.max, rng);
    const rr = triSample(specs.turnoutReliability.min, specs.turnoutReliability.mode, specs.turnoutReliability.max, rng);
    const dph = triSample(specs.doorsPerHour.min, specs.doorsPerHour.mode, specs.doorsPerHour.max, rng);
    const cph = triSample(specs.callsPerHour.min, specs.callsPerHour.mode, specs.callsPerHour.max, rng);
    const vm = triSample(specs.volunteerMult.min, specs.volunteerMult.mode, specs.volunteerMult.max, rng);

    let gotvLiftPP = 0;
    if (turnoutEnabled){
      if (mode === "advanced" && sc.gotvMode === "advanced"){
        const mn = Math.max(0, safeNum(sc.gotvLiftMin) ?? 0);
        const md = Math.max(0, safeNum(sc.gotvLiftMode) ?? 0);
        const mx = Math.max(0, safeNum(sc.gotvLiftMax) ?? 0);
        gotvLiftPP = triSample(mn, md, mx, rng);
      } else {
        gotvLiftPP = Math.max(0, safeNum(sc.gotvLiftPP) ?? 0);
      }
    }

    const capContacts = computeCapacityContacts({
      weeks,
      orgCount,
      orgHoursPerWeek: orgHrs,
      volunteerMult: vm,
      doorShare,
      doorsPerHour: dph,
      callsPerHour: cph,
    });

    let votes = 0;
    let turnoutAdjustedVotes = 0;

    let convos = 0;
    if (capContacts != null && capContacts > 0){
      convos = capContacts * cr;
      const supports = convos * pr;
      votes = supports * rr;
    }

    turnoutAdjustedVotes = votes;

    if (turnoutEnabled && targetUniverseSize != null && targetUniverseSize > 0 && gotvLiftPP > 0){
      const avgLiftPP = computeAvgLiftPP({
        baselineTurnoutPct: baseTurnoutPct,
        liftPerContactPP: gotvLiftPP,
        maxLiftPP: gotvMaxLiftPP,
        contacts: convos,
        universeSize: targetUniverseSize,
        useDiminishing: useDim,
      });
      const gotvAddedVotes = targetUniverseSize * (avgLiftPP / 100);
      turnoutAdjustedVotes = votes + gotvAddedVotes;
    }

    const margin = votes - needVotes;
    const marginTA = turnoutAdjustedVotes - needVotes;

    margins[i] = margin;
    wins[i] = (margin >= 0) ? 1 : 0;

    turnoutAdjustedVotesArr[i] = turnoutAdjustedVotes;
    winsTA[i] = (marginTA >= 0) ? 1 : 0;

    samples.contactRate[i] = cr;
    samples.persuasionRate[i] = pr;
    samples.turnoutReliability[i] = rr;
    samples.doorsPerHour[i] = dph;
    samples.callsPerHour[i] = cph;
    samples.volunteerMult[i] = vm;
    if (turnoutEnabled && mode === "advanced" && sc.gotvMode === "advanced" && samples.gotvLift){ samples.gotvLift[i] = gotvLiftPP; }
  }

  const winProb = sum(wins) / runs;
  const winProbTurnoutAdjusted = turnoutEnabled ? (sum(winsTA) / runs) : winProb;

  const sorted = margins.slice().sort((a,b)=>a-b);
  const median = quantileSorted(sorted, 0.50);
  const p5 = quantileSorted(sorted, 0.05);
  const p95 = quantileSorted(sorted, 0.95);

  // Lightweight distribution for visualization (does not affect any calculations)
  const buildHistogram = (sortedArr, bins = 44) => {
    if (!sortedArr || !sortedArr.length) return null;
    const lo = quantileSorted(sortedArr, 0.01);
    const hi = quantileSorted(sortedArr, 0.99);
    const min = isFinite(lo) ? lo : sortedArr[0];
    const max = isFinite(hi) ? hi : sortedArr[sortedArr.length - 1];
    const span = (max - min);
    const safeSpan = (span === 0) ? 1 : span;
    const b = Math.max(12, Math.min(80, Math.floor(bins)));
    const counts = new Array(b).fill(0);
    for (let i=0;i<sortedArr.length;i++){
      const v = sortedArr[i];
      if (!isFinite(v)) continue;
      if (v < min || v > max) continue;
      const t = (v - min) / safeSpan;
      let idx = Math.floor(t * b);
      if (idx < 0) idx = 0;
      if (idx >= b) idx = b - 1;
      counts[idx] += 1;
    }
    return { min, max, counts };
  };
  const histogram = buildHistogram(sorted, 44);

  let turnoutAdjustedSummary = null;
  if (turnoutEnabled){
    const vSorted = turnoutAdjustedVotesArr.slice().sort((a,b)=>a-b);
    turnoutAdjustedSummary = {
      mean: mean(turnoutAdjustedVotesArr),
      p10: quantileSorted(vSorted, 0.10),
      p50: quantileSorted(vSorted, 0.50),
      p90: quantileSorted(vSorted, 0.90),
    };
  }

  const sens = computeSensitivity(samples, margins);

  const summary = {
    runs,
    winProb,
    winProbTurnoutAdjusted,
    median,
    p5,
    p95,
    confidenceEnvelope: computeConfidenceEnvelope({ margins, sortedMargins: sorted, winProb, winRule: "gte0" }),
    histogram,
    sensitivity: sens,
    riskLabel: riskLabelFromWinProb(winProb),
    needVotes,
    turnoutAdjusted: turnoutAdjustedSummary,
  };

  // Phase R2 — Optional raw margins exposure for risk framing / robust selection.
  // OFF by default. No impact unless explicitly requested by caller.
  if (includeMargins){
    summary.margins = margins.slice();
    summary.sortedMargins = sorted;
  }

  return summary;
}