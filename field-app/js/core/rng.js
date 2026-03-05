// js/core/rng.js
// Single source of truth for seeded RNG + triangular distribution sampling.
// Pure module — no DOM, no side effects, no imports.
// Used by monteCarlo.js and app.js (legacy MC loops pending migration to core).

export function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}

export function mulberry32(a){
  return function(){
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// makeRng(seedStr) -> rng function
// Pass a stable string seed for deterministic results; omit for Math.random fallback.
export function makeRng(seedStr){
  if (!seedStr) return Math.random;
  const seed = xmur3(seedStr)();
  return mulberry32(seed);
}

// triSample(min, mode, max, rng) -> number
// Triangular distribution sampling. rng must be a function returning [0,1).
export function triSample(min, mode, max, rng){
  const u = rng();
  const c = (mode - min) / (max - min || 1);
  if (u < c){
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function uniformSample(min, max, rng){
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!isFinite(lo) || !isFinite(hi)) return 0;
  if (hi === lo) return lo;
  return lo + (rng() * (hi - lo));
}

function gaussianZ(rng){
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function normalSampleBounded(min, mode, max, rng){
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!isFinite(lo) || !isFinite(hi)) return 0;
  if (hi === lo) return lo;

  const mu = Math.min(hi, Math.max(lo, isFinite(mode) ? mode : (lo + hi) / 2));
  const sigma = Math.max((hi - lo) / 6, 1e-9);

  for (let i = 0; i < 8; i++){
    const x = mu + gaussianZ(rng) * sigma;
    if (x >= lo && x <= hi) return x;
  }
  return Math.min(hi, Math.max(lo, mu));
}
