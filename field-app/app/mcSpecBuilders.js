export function quantileSortedModule(sorted, q){
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] == null) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function normalizeTri({ min, mode, max }, { clamp }){
  let a = min;
  let b = mode;
  let c = max;
  if (!isFinite(a)) a = 0;
  if (!isFinite(b)) b = 0;
  if (!isFinite(c)) c = 0;

  const lo = Math.min(a, b, c);
  const hi = Math.max(a, b, c);
  b = clamp(b, lo, hi);
  return { min: lo, mode: b, max: hi };
}

function spread(base, w, minClamp, maxClamp, { clamp }){
  const mode = base;
  const min = clamp(base * (1 - w), minClamp, maxClamp);
  const max = clamp(base * (1 + w), minClamp, maxClamp);
  return normalizeTri({ min, mode, max }, { clamp });
}

function triFromPctInputs(minIn, modeIn, maxIn, baseUnit, { safeNum, clamp }){
  const fallbackMode = baseUnit;
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null) ? clamp(modeV, 0, 100) / 100 : fallbackMode;
  const min = (minV != null) ? clamp(minV, 0, 100) / 100 : clamp(mode * 0.8, 0, 1);
  const max = (maxV != null) ? clamp(maxV, 0, 100) / 100 : clamp(mode * 1.2, 0, 1);

  return normalizeTri({ min, mode, max }, { clamp });
}

function triFromNumInputs(minIn, modeIn, maxIn, base, floor, { safeNum, clamp }){
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null && modeV > 0) ? modeV : base;
  const min = (minV != null && minV > 0) ? minV : Math.max(floor, mode * 0.8);
  const max = (maxV != null && maxV > 0) ? maxV : Math.max(min + floor, mode * 1.2);

  return normalizeTri({ min, mode, max }, { clamp });
}

export function buildBasicSpecsModule(args){
  const {
    state,
    clamp,
    baseCr,
    basePr,
    baseRr,
    baseDph,
    baseCph,
    baseVol,
    volBoost = 0,
  } = args || {};

  const v = (state.mcVolatility || "med");
  const w = (v === "low") ? 0.10 : (v === "high") ? 0.30 : 0.20;

  return {
    contactRate: spread(baseCr, w, 0, 1, { clamp }),
    persuasionRate: spread(basePr, w + (volBoost || 0), 0, 1, { clamp }),
    turnoutReliability: spread(baseRr, w + (volBoost || 0), 0, 1, { clamp }),
    doorsPerHour: spread(baseDph, w, 0.01, Infinity, { clamp }),
    callsPerHour: spread(baseCph, w, 0.01, Infinity, { clamp }),
    volunteerMult: spread(baseVol, w, 0.01, Infinity, { clamp }),
  };
}

export function buildAdvancedSpecsModule(args){
  const {
    state,
    safeNum,
    clamp,
    baseCr,
    basePr,
    baseRr,
    baseDph,
    baseCph,
    baseVol,
    volBoost = 0,
  } = args || {};

  const cr = triFromPctInputs(state.mcContactMin, state.mcContactMode, state.mcContactMax, baseCr, { safeNum, clamp });
  const pr0 = triFromPctInputs(state.mcPersMin, state.mcPersMode, state.mcPersMax, basePr, { safeNum, clamp });
  const rr0 = triFromPctInputs(state.mcReliMin, state.mcReliMode, state.mcReliMax, baseRr, { safeNum, clamp });

  const widen = (tri, boost) => {
    if (!tri || tri.min == null || tri.mode == null || tri.max == null) return tri;
    const b = Math.max(0, Number(boost) || 0);
    if (b <= 0) return tri;
    const mid = tri.mode;
    const span = tri.max - tri.min;
    const extra = span * b;
    return {
      min: Math.max(0, tri.min - extra),
      mode: Math.min(1, Math.max(0, mid)),
      max: Math.min(1, tri.max + extra),
    };
  };

  const pr = widen(pr0, volBoost);
  const rr = widen(rr0, volBoost);

  const dph = triFromNumInputs(state.mcDphMin, state.mcDphMode, state.mcDphMax, baseDph, 0.01, { safeNum, clamp });
  const cph = triFromNumInputs(state.mcCphMin, state.mcCphMode, state.mcCphMax, baseCph, 0.01, { safeNum, clamp });
  const vm = triFromNumInputs(state.mcVolMin, state.mcVolMode, state.mcVolMax, baseVol, 0.01, { safeNum, clamp });

  return {
    contactRate: cr,
    persuasionRate: pr,
    turnoutReliability: rr,
    doorsPerHour: dph,
    callsPerHour: cph,
    volunteerMult: vm,
  };
}
