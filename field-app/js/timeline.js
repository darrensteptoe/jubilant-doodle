/* js/timeline.js
   Phase 7 — Timeline / Production Modeling (feasibility layer)

   ✅ Pure + deterministic
   ✅ Consumes optimizer outputs (required attempts per tactic)
   ✅ Does NOT modify winMath, Monte Carlo, or optimizer
   ✅ Timeline OFF => produces no constraints/effects
*/

function num(v, fallback = null){
  // Treat null/undefined/empty as "no value" (important because Number(null) === 0).
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nonNeg(v, fallback = 0){
  const n = num(v, fallback);
  if (n == null) return fallback;
  return n < 0 ? 0 : n;
}

function clamp(v, lo, hi){
  if (!Number.isFinite(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function safeDiv(a, b){
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

function buildRampFactors(nWeeks, mode){
  const n = Math.max(0, Math.floor(nonNeg(nWeeks, 0)));
  if (n === 0) return [];
  if (mode !== "linear" && mode !== "s") return new Array(n).fill(1);

  const out = new Array(n);
  for (let i=0;i<n;i++){
    const t = (n === 1) ? 1 : (i / (n - 1));
    if (mode === "linear"){
      // 0.6 → 1.4
      out[i] = 0.6 + 0.8 * t;
    } else {
      // Simple S curve: ease-in-out centered
      // Map t∈[0,1] to f∈[0.65,1.35]
      const s = 0.5 - 0.5 * Math.cos(Math.PI * t);
      out[i] = 0.65 + 0.70 * s;
    }
  }
  return out;
}

function distributeWithCaps(total, caps){
  const n = caps.length;
  const alloc = new Array(n).fill(0);
  const target = Math.max(0, Math.floor(nonNeg(total, 0)));
  if (n === 0 || target === 0) return alloc;

  const capSum = caps.reduce((a,b)=>a+nonNeg(b,0), 0);
  if (capSum <= 0) return alloc;

  for (let i=0;i<n;i++){
    const share = nonNeg(caps[i],0) / capSum;
    alloc[i] = Math.min(nonNeg(caps[i],0), Math.round(target * share));
  }

  // Fix rounding drift + enforce caps.
  let used = alloc.reduce((a,b)=>a+b, 0);
  while (used > target){
    for (let i=n-1;i>=0 && used>target;i--){
      if (alloc[i] > 0){ alloc[i] -= 1; used -= 1; }
    }
    if (n === 0) break;
  }

  while (used < target){
    let progressed = false;
    for (let i=0;i<n && used<target;i++){
      const slack = Math.max(0, nonNeg(caps[i],0) - alloc[i]);
      if (slack > 0){
        alloc[i] += 1;
        used += 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return alloc;
}

/**
 * Compute feasibility without feeding back into optimizer.
 */
export function computeTimelineFeasibility({
  enabled,
  weeksRemaining,
  activeWeeksOverride,
  gotvWindowWeeks,
  staffing,
  throughput,
  required,
  tacticKinds,
  netVotesPerAttempt,
  bindingHint,
  ramp
}){
  const out = {
    enabled: !!enabled,
    requiredAttemptsTotal: 0,
    executableAttemptsTotal: 0,
    percentPlanExecutable: 1,
    projectedCompletionWeek: 0,
    shortfallAttempts: 0,
    shortfallNetVotes: null,
    constraintType: "—",
    weekly: []
  };

  if (!out.enabled) return out;

  const weeks = Math.max(0, Math.floor(nonNeg(weeksRemaining, 0)));
  const activeOverride = num(activeWeeksOverride, null);
  const activeWeeks = clamp(
    (activeOverride == null ? weeks : Math.floor(nonNeg(activeOverride, 0))),
    0,
    weeks
  );

  const gotvW = num(gotvWindowWeeks, null);
  const gotvWeeks = (gotvW == null) ? null : clamp(Math.floor(nonNeg(gotvW, 0)), 0, weeks);

  const staffN = nonNeg(staffing?.staff, 0);
  const volN = nonNeg(staffing?.volunteers, 0);
  const staffH = nonNeg(staffing?.staffHours, 0);
  const volH = nonNeg(staffing?.volunteerHours, 0);

  const keys = new Set([
    ...Object.keys(required || {}),
    ...Object.keys(throughput || {})
  ]);

  const perTactic = {};
  for (const id of keys){
    const req = nonNeg(required?.[id], 0);
    const aph = nonNeg(throughput?.[id], 0);

    const wkCap = (staffN * staffH + volN * volH) * aph;
    const kind = (tacticKinds && tacticKinds[id]) ? String(tacticKinds[id]) : "persuasion";
    const useWeeks = (kind === "turnout" && gotvWeeks != null) ? Math.min(activeWeeks, gotvWeeks) : activeWeeks;
    const maxExec = wkCap * useWeeks;

    perTactic[id] = {
      required: req,
      weeklyCapacity: Number.isFinite(wkCap) && wkCap > 0 ? wkCap : 0,
      weeks: useWeeks,
      maxExecutable: Number.isFinite(maxExec) && maxExec > 0 ? maxExec : 0,
      executable: Math.min(req, Number.isFinite(maxExec) ? maxExec : 0)
    };
  }

  const requiredTotal = Object.values(perTactic).reduce((s,t)=>s+t.required, 0);
  const execTotal = Object.values(perTactic).reduce((s,t)=>s+t.executable, 0);

  out.requiredAttemptsTotal = requiredTotal;
  out.executableAttemptsTotal = execTotal;

  if (requiredTotal <= 0){
    out.percentPlanExecutable = 1;
    out.projectedCompletionWeek = 0;
    out.shortfallAttempts = 0;
    out.shortfallNetVotes = 0;
    out.constraintType = "—";
    out.weekly = [];
    return out;
  }

  out.percentPlanExecutable = clamp(execTotal / requiredTotal, 0, 1);
  out.shortfallAttempts = Math.max(0, requiredTotal - execTotal);

  const vpa = num(netVotesPerAttempt, null);
  out.shortfallNetVotes = (vpa != null) ? out.shortfallAttempts * vpa : null;

  // Completion week as slowest tactic.
  let maxWeeksNeeded = 0;
  let impossible = false;
  for (const t of Object.values(perTactic)){
    if (t.required <= 0) continue;
    if (t.weeklyCapacity <= 0){
      impossible = true;
      continue;
    }
    const wNeed = safeDiv(t.required, t.weeklyCapacity);
    if (wNeed != null) maxWeeksNeeded = Math.max(maxWeeksNeeded, wNeed);
  }
  out.projectedCompletionWeek = impossible ? null : Math.max(1, Math.ceil(maxWeeksNeeded));

  if (out.percentPlanExecutable < 1){
    out.constraintType = "Timeline-limited";
  } else {
    const b = String(bindingHint || "").toLowerCase();
    if (b === "budget") out.constraintType = "Budget-limited";
    else if (b === "capacity") out.constraintType = "Capacity-limited";
    else out.constraintType = "—";
  }

  const active = Math.max(0, Math.floor(activeWeeks));
  if (active <= 0){
    out.weekly = [];
    return out;
  }

  // Preview uses blended weekly capacity across tactics (not per-tactic dispatch)
  const baseWeeklyTotal = Object.values(perTactic).reduce((s,t)=>s + nonNeg(t.weeklyCapacity,0), 0);
  const rampEnabled = !!ramp?.enabled;
  const rampMode = ramp?.mode || "linear";
  const factors = rampEnabled ? buildRampFactors(active, (rampMode === "s" ? "s" : "linear")) : new Array(active).fill(1);
  const caps = factors.map(f => Math.max(0, baseWeeklyTotal * nonNeg(f,1)));

  const previewTotal = Math.floor(Math.min(requiredTotal, execTotal));
  const alloc = distributeWithCaps(previewTotal, caps);
  out.weekly = alloc.map((a,i)=>({ week: i+1, attempts: a }));

  return out;
}
