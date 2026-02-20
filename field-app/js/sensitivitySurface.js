// js/sensitivitySurface.js
// Phase 15 — Sensitivity Surface / Fragility Map
//
// Design goals:
// - On-demand only (caller controls when to run)
// - "Pure" in effect: no lasting state mutation; caller may use a temporary patch helper
// - Reuses existing Monte Carlo engine via accessors (same core logic, no duplication)
// - Lightweight analysis: cliffs, diminishing returns, safe zone, fragility points
//
// Export: computeSensitivitySurface({ engine, baseline, sweep, options })

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(v, lo, hi){
  const n = safeNum(v);
  if (n == null) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function median(arr){
  const xs = (arr || []).filter(x => Number.isFinite(x)).slice().sort((a,b)=>a-b);
  const n = xs.length;
  if (!n) return null;
  const mid = Math.floor(n/2);
  return (n % 2) ? xs[mid] : (xs[mid-1] + xs[mid]) / 2;
}

function contiguousRangesFromMask(xs, mask){
  const out = [];
  let i = 0;
  while (i < xs.length){
    while (i < xs.length && !mask[i]) i++;
    if (i >= xs.length) break;
    let j = i;
    while (j < xs.length && mask[j]) j++;
    const lo = xs[i];
    const hi = xs[j-1];
    out.push({ min: lo, max: hi });
    i = j;
  }
  return out;
}

function largestRange(ranges){
  if (!ranges || !ranges.length) return null;
  let best = null;
  let bestSpan = -Infinity;
  for (const r of ranges){
    const span = (Number(r.max) - Number(r.min));
    if (!Number.isFinite(span)) continue;
    if (span > bestSpan){
      bestSpan = span;
      best = r;
    }
  }
  return best;
}

function generateSweepPoints(minValue, maxValue, steps){
  const lo = Number(minValue);
  const hi = Number(maxValue);
  const n = Math.max(2, Math.floor(Number(steps) || 21));
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (n === 1) return [lo];
  if (hi === lo) return Array.from({ length: n }, () => lo);
  const step = (hi - lo) / (n - 1);
  const pts = [];
  for (let i=0;i<n;i++){
    pts.push(lo + step * i);
  }
  return pts;
}

function leverSpecForKey(leverKey){
  const key = String(leverKey || "");
  const specs = {
    volunteerMultiplier: { stateKey: "volunteerMultBase", unit: "raw", clampLo: 0.1, clampHi: 6.0, step: 0.01 },
    supportRate: { stateKey: "supportRatePct", unit: "pct", clampLo: 0, clampHi: 100, step: 0.1 },
    contactRate: { stateKey: "contactRatePct", unit: "pct", clampLo: 0, clampHi: 100, step: 0.1 },
    turnoutReliability: { stateKey: "turnoutReliabilityPct", unit: "pct", clampLo: 0, clampHi: 100, step: 0.1 },
  };
  return specs[key] || null;
}

function analyzeSurface(points, targetWinProb){
  const xs = points.map(p => p.leverValue);
  const ys = points.map(p => p.winProb);

  const deltas = [];
  for (let i=0;i<ys.length-1;i++){
    const a = ys[i], b = ys[i+1];
    deltas.push((Number.isFinite(a) && Number.isFinite(b)) ? (b - a) : null);
  }

  const absD = deltas.map(d => (d == null ? null : Math.abs(d))).filter(d => d != null);
  const medAbs = median(absD) ?? 0;
  const maxAbs = absD.length ? Math.max(...absD) : 0;

  // Cliff: unusually large step in winProb.
  // Criteria: abs(delta) > max(3*medianAbs, 0.02) and abs(delta) > 0.5*maxAbs (avoid noisy flat curves)
  const cliff = [];
  const cliffThresh = Math.max(3 * medAbs, 0.02);
  for (let i=0;i<deltas.length;i++){
    const d = deltas[i];
    if (d == null) continue;
    if (Math.abs(d) >= cliffThresh && Math.abs(d) >= 0.5 * maxAbs){
      // cliff at the *transition* to x_{i+1}
      cliff.push({ at: xs[i+1], delta: d });
    }
  }

  // Diminishing returns: slope falls below 25% of peak slope (same direction) OR nearly flat.
  const diminishingZones = [];
  if (deltas.length){
    const peak = maxAbs || 0;
    const flatThresh = 0.002; // 0.2% win prob per step ~= flat
    const dimThresh = Math.max(flatThresh, peak * 0.25);

    // Define as contiguous region where abs(delta) <= dimThresh for >=2 consecutive steps.
    const mask = new Array(xs.length).fill(false);
    for (let i=0;i<deltas.length;i++){
      const d = deltas[i];
      if (d == null) continue;
      if (Math.abs(d) <= dimThresh){
        // mark both endpoints to make a readable interval
        mask[i] = true;
        mask[i+1] = true;
      }
    }
    const ranges = contiguousRangesFromMask(xs, mask).filter(r => (r.max - r.min) > 0);
    for (const r of ranges){
      diminishingZones.push(r);
    }
  }

  // Safe zone: winProb >= target, contiguous; return largest
  const T = (safeNum(targetWinProb) != null) ? clamp(targetWinProb, 0, 1) : 0.70;
  const safeMask = ys.map(y => (Number.isFinite(y) && y >= T));
  const safeRanges = contiguousRangesFromMask(xs, safeMask);
  const safeZone = largestRange(safeRanges);

  // Fragility points: a small negative step produces a large win drop.
  // Criteria: delta <= -max(0.03, 2*medianAbs) (3% absolute or 2x typical movement)
  const fragility = [];
  const fragThresh = -Math.max(0.03, 2 * medAbs);
  for (let i=0;i<deltas.length;i++){
    const d = deltas[i];
    if (d == null) continue;
    if (d <= fragThresh){
      fragility.push({ at: xs[i+1], delta: d });
    }
  }

  return {
    cliffPoints: cliff,
    diminishingZones,
    safeZone,
    fragilityPoints: fragility,
    meta: { medianAbsDelta: medAbs, maxAbsDelta: maxAbs, targetWinProb: T }
  };
}

export function computeSensitivitySurface({ engine, baseline, sweep, options }){
  // engine: { withPatchedState, runMonteCarloSim }
  // baseline: { res, weeks, needVotes }
  // sweep: { leverKey, minValue, maxValue, steps }
  // options: { runs, seed, targetWinProb }

  const leverKey = String(sweep?.leverKey || "");
  const spec = leverSpecForKey(leverKey);
  if (!spec) return { points: [], analysis: null, warning: "Unknown lever" };

  const minValueRaw = safeNum(sweep?.minValue);
  const maxValueRaw = safeNum(sweep?.maxValue);
  const steps = Math.max(5, Math.floor(safeNum(sweep?.steps) ?? 21));

  if (minValueRaw == null || maxValueRaw == null){
    return { points: [], analysis: null, warning: "Missing sweep bounds" };
  }

  const minValue = clamp(minValueRaw, spec.clampLo, spec.clampHi);
  const maxValue = clamp(maxValueRaw, spec.clampLo, spec.clampHi);

  const pts = generateSweepPoints(minValue, maxValue, steps);
  if (!pts.length){
    return { points: [], analysis: null, warning: "No sweep points" };
  }

  const runs = Math.max(200, Math.floor(safeNum(options?.runs) ?? 2000));
  const seed = (options?.seed != null) ? String(options.seed) : "";

  const out = [];
  const base = baseline || {};
  const res = base.res;
  const weeks = base.weeks;
  const needVotes = base.needVotes;

  const withPatchedState = engine?.withPatchedState;
  const runMonteCarloSim = engine?.runMonteCarloSim;

  if (typeof withPatchedState !== "function" || typeof runMonteCarloSim !== "function"){
    return { points: [], analysis: null, warning: "Missing engine accessors" };
  }

  for (const v of pts){
    const value = clamp(v, spec.clampLo, spec.clampHi);

    const patch = {};
    patch[spec.stateKey] = value;

    const summary = withPatchedState(patch, () => {
      return runMonteCarloSim({ res, weeks, needVotes, runs, seed });
    });

    const wp = safeNum(summary?.winProb);
    const ce = summary?.confidenceEnvelope;
    const p10 = safeNum(ce?.percentiles?.p10);
    const p50 = safeNum(ce?.percentiles?.p50);
    const p90 = safeNum(ce?.percentiles?.p90);

    out.push({
      leverValue: value,
      winProb: wp,
      p10,
      p50,
      p90
    });
  }

  const analysis = analyzeSurface(out, safeNum(options?.targetWinProb) ?? 0.70);

  return { points: out, analysis, warning: null, lever: { key: leverKey, spec }, runs };
}
