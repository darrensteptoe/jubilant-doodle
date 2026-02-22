// js/core/risk.js
// Phase R2 — Risk framing helpers (pure, additive).
// Operates on Monte Carlo margin arrays (net votes above/below needVotes).

function isFiniteNumber(x){
  return typeof x === "number" && Number.isFinite(x);
}

function mean(arr){
  let s = 0;
  for (let i=0;i<arr.length;i++) s += arr[i];
  return arr.length ? (s / arr.length) : 0;
}

function stdevPop(arr){
  const n = arr.length;
  if (!n) return 0;
  const m = mean(arr);
  let v = 0;
  for (let i=0;i<n;i++){
    const d = arr[i] - m;
    v += d*d;
  }
  v /= n;
  return Math.sqrt(v);
}

function quantileSorted(sorted, q){
  const n = sorted.length;
  if (!n) return 0;
  if (q <= 0) return sorted[0];
  if (q >= 1) return sorted[n - 1];
  const i = q * (n - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  const t = i - lo;
  return sorted[lo] + t * (sorted[hi] - sorted[lo]);
}

function sanitizeMargins(margins){
  const arr = Array.isArray(margins) ? margins : [];
  // Do not filter values silently — fail closed if any non-finite present.
  for (let i=0;i<arr.length;i++){
    if (!isFiniteNumber(arr[i])) return [];
  }
  return arr;
}

export function summaryFromMargins(margins){
  const arr = sanitizeMargins(margins);
  const n = arr.length;

  const out = {
    runs: n,
    mean: 0,
    median: 0,
    p10: 0,
    p25: 0,
    p75: 0,
    p90: 0,
    min: 0,
    max: 0,
    stdev: 0,
    probWin: 0,
    probLose: 0,
  };

  if (!n) return out;

  const sorted = arr.slice().sort((a,b)=>a-b);
  out.mean = mean(arr);
  out.median = quantileSorted(sorted, 0.50);
  out.p10 = quantileSorted(sorted, 0.10);
  out.p25 = quantileSorted(sorted, 0.25);
  out.p75 = quantileSorted(sorted, 0.75);
  out.p90 = quantileSorted(sorted, 0.90);
  out.min = sorted[0];
  out.max = sorted[n - 1];
  out.stdev = stdevPop(arr);

  let wins = 0;
  for (let i=0;i<n;i++) if (arr[i] >= 0) wins++;
  out.probWin = wins / n;
  out.probLose = 1 - out.probWin;

  return out;
}

export function shortfallProbability(margins, threshold){
  const arr = sanitizeMargins(margins);
  const n = arr.length;
  if (!n) return 0;
  const t = Number(threshold);
  if (!Number.isFinite(t)) return 0;
  let hits = 0;
  for (let i=0;i<n;i++) if (arr[i] < t) hits++;
  return hits / n;
}

export function valueAtRisk(margins, q){
  const arr = sanitizeMargins(margins);
  const n = arr.length;
  if (!n) return 0;
  const qq = Number(q);
  if (!Number.isFinite(qq)) return 0;
  const sorted = arr.slice().sort((a,b)=>a-b);
  return quantileSorted(sorted, qq);
}

export function conditionalValueAtRisk(margins, q){
  const arr = sanitizeMargins(margins);
  const n = arr.length;
  if (!n) return 0;
  const qq = Number(q);
  if (!Number.isFinite(qq)) return 0;
  const sorted = arr.slice().sort((a,b)=>a-b);
  const cutoff = quantileSorted(sorted, qq);

  // Average of outcomes at/below cutoff (worst tail).
  let s = 0;
  let c = 0;
  for (let i=0;i<n;i++){
    const v = arr[i];
    if (v <= cutoff){
      s += v;
      c += 1;
    }
  }
  return c ? (s / c) : cutoff;
}
