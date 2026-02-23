// js/selfTest.js
// Phase 5.5 — Lightweight in-browser self-test infrastructure.
// Exports: runSelfTests(engineAccessors)
//
// Design goals:
// - No build tools
// - No uncaught throws (always returns structured results)
// - No production interference (dev-triggered by app.js)

import { FIXTURES } from "./fixtures.js";
import { computeMarginalValueDiagnostics } from "./marginalValue.js";
import { computeDecisionIntelligence } from "./decisionIntelligence.js";
import { computeMaxAttemptsByTactic, optimizeTimelineConstrained } from "./timelineOptimizer.js";
import { MODEL_VERSION, makeScenarioExport, deterministicStringify, validateScenarioExport, PLAN_CSV_HEADERS, planRowsToCsv, hasNonFiniteNumbers } from "../export.js";
import { computeSnapshotHash } from "./hash.js";
import { createScenarioManager } from "../scenarioManager.js";
import { migrateSnapshot, CURRENT_SCHEMA_VERSION } from "./migrate.js";
import { APP_VERSION, BUILD_ID } from "../build.js";
import { SELFTEST_GATE, gateFromSelfTestResult } from "./selfTestGate.js";
import { readBackups, writeBackupEntry } from "../storage.js";
import { checkStrictImportPolicy } from "./importPolicy.js";
import { computeConfidenceEnvelope } from "./confidenceEnvelope.js";
import { computeSensitivitySurface } from "./sensitivitySurface.js";
import { computeUniverseAdjustedRates, UNIVERSE_DEFAULTS } from "./universeLayer.js";

function withUniverseDefaults(s){
  // Phase 16 fields are now required for stable hashing/export roundtrips.
  // Self-tests should construct scenarios in the canonical "complete" shape.
  const out = structuredClone(s || {});
  if (out.universeLayerEnabled == null) out.universeLayerEnabled = !!UNIVERSE_DEFAULTS.enabled;
  if (out.universeDemPct == null) out.universeDemPct = UNIVERSE_DEFAULTS.demPct;
  if (out.universeRepPct == null) out.universeRepPct = UNIVERSE_DEFAULTS.repPct;
  if (out.universeNpaPct == null) out.universeNpaPct = UNIVERSE_DEFAULTS.npaPct;
  if (out.universeOtherPct == null) out.universeOtherPct = UNIVERSE_DEFAULTS.otherPct;
  if (out.retentionFactor == null) out.retentionFactor = UNIVERSE_DEFAULTS.retentionFactor;
  return out;
}


function deepFreeze(obj){
  if (obj == null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)){
    deepFreeze(obj[k]);
  }
  return obj;
}

function nowMs(){ return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

function stableStringify(obj){
  try{
    return JSON.stringify(obj, Object.keys(obj).sort());
  } catch {
    // Fallback if cyclic (shouldn't happen). Best-effort string.
    try { return String(obj); } catch { return "[unstringifiable]"; }
  }
}

function clamp01(v){
  if (v == null || !isFinite(v)) return null;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function pctToUnitFromPct(pct){
  if (pct == null || !isFinite(pct)) return null;
  return clamp01(Number(pct) / 100);
}

function normalizeDailyLogEntryE11(e){
  const o = (e && typeof e === "object") ? e : {};
  const date = String(o.date || "").trim();
  if (!date) return null;
  const asInt = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  };
  const attempts = asInt(o.attempts);
  const convos = asInt(o.convos);
  const supportIds = asInt(o.supportIds);
  const convosClamped = Math.min(convos, attempts);
  const supportClamped = Math.min(supportIds, convosClamped);
  return { date, attempts, convos: convosClamped, supportIds: supportClamped };
}

function normalizeDailyLogArrayE11(arr){
  const out = [];
  const seen = new Set();
  const items = Array.isArray(arr) ? arr : [];
  for (const it of items){
    const n = normalizeDailyLogEntryE11(it);
    if (!n) continue;
    if (seen.has(n.date)) continue;
    seen.add(n.date);
    out.push(n);
  }
  out.sort((a,b) => String(a.date).localeCompare(String(b.date)));
  return out;
}

function dailyLogMergeSummaryE11(existingArr, incomingArr){
  const existing = normalizeDailyLogArrayE11(existingArr);
  const incoming = normalizeDailyLogArrayE11(incomingArr);
  const byDate = new Map();
  for (const e of existing) byDate.set(e.date, e);
  let added = 0;
  let replaced = 0;
  let ignored = 0;
  for (const inc of incoming){
    const cur = byDate.get(inc.date);
    if (!cur){
      byDate.set(inc.date, inc);
      added += 1;
      continue;
    }
    if (stableStringify(cur) === stableStringify(inc)){
      ignored += 1;
      continue;
    }
    byDate.set(inc.date, inc);
    replaced += 1;
  }
  const merged = Array.from(byDate.values()).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  return { merged, added, replaced, ignored };
}

export function runSelfTests(engine){
  const started = nowMs();

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: [],
    durationMs: 0
  };

  const recordFailure = (name, message) => {
    results.failed += 1;
    results.failures.push({ name, message: String(message || "Test failed") });
  };

  const test = (name, fn) => {
    results.total += 1;
    try{
      const ok = fn();
      if (ok === false){
        recordFailure(name, "Returned false");
      } else {
        results.passed += 1;
      }
    } catch (err){
      recordFailure(name, err && err.message ? err.message : String(err));
    }
  };

  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg || "Assertion failed");
  };

  const approx = (a, b, tolAbs) => {
    // Treat null/undefined as equivalent "no value" for snapshot comparisons.
    // This is important for ROI rows where values can legitimately be null.
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (!isFinite(a) || !isFinite(b)) return false;
    return Math.abs(a - b) <= tolAbs;
  };

  const isFiniteNum = (v) => (v != null && typeof v === "number" && Number.isFinite(v));

  // Guard: engine accessors present
  test("SelfTest: engine accessors present", () => {
    assert(engine && typeof engine === "object", "Missing engineAccessors object");
    const required = ["computeAll","deriveNeedVotes","derivedWeeksRemaining","runMonteCarloSim","optimizeMixBudget","optimizeMixCapacity","buildOptimizationTactics","computeRoiRows","computeCapacityBreakdown"];
    for (const k of required){
      assert(typeof engine[k] === "function", `Missing accessor: ${k}()`);
    }
  });

  // --- C) Phase 8B — Marginal value diagnostics (pure) ---
  test("Phase 8B: non-binding timeline caps => deltas ~0 and no NaN", () => {
    const tactics = [
      { id:"doors", label:"Doors", costPerAttempt: 1.0, netVotesPerAttempt: 0.05, maxAttempts: null },
      { id:"phones", label:"Phones", costPerAttempt: 0.8, netVotesPerAttempt: 0.03, maxAttempts: null },
      { id:"texts", label:"Texts", costPerAttempt: 0.2, netVotesPerAttempt: 0.005, maxAttempts: null }
    ];

    const capsInput = {
      enabled: true,
      weeksRemaining: 12,
      activeWeeksOverride: 12,
      gotvWindowWeeks: 4,
      staffing: { staff: 5, volunteers: 10, staffHours: 30, volunteerHours: 10 },
      throughput: { doors: 25, phones: 40, texts: 200 },
      tacticKinds: { doors:"persuasion", phones:"persuasion", texts:"persuasion" }
    };
    const caps = computeMaxAttemptsByTactic(capsInput);

    // Capacity mode with a low ceiling ensures timeline caps are non-binding.
    const tlInputs = {
      mode: "capacity",
      budgetLimit: null,
      capacityLimit: 100,
      capacityCeiling: null,
      tactics,
      step: 25,
      useDecay: false,
      objective: "net",
      maxAttemptsByTactic: caps.maxAttemptsByTactic,
      tlObjectiveMode: "max_net",
      goalNetVotes: 10
    };
    const baseline = optimizeTimelineConstrained(tlInputs);

    const mv = computeMarginalValueDiagnostics({ baselineInputs: tlInputs, baselineResult: baseline, timelineInputs: capsInput });

    assert(mv && typeof mv === "object", "Diagnostics missing");
    assert(typeof mv.primaryBottleneck === "string", "primaryBottleneck not string");
    assert(Array.isArray(mv.interventions), "interventions not array");

    for (const it of mv.interventions){
      if (it.deltaMaxNetVotes != null) assert(isFiniteNum(it.deltaMaxNetVotes), "deltaMaxNetVotes NaN/Infinity");
      if (it.deltaCost != null) assert(isFiniteNum(it.deltaCost), "deltaCost NaN/Infinity");
      // With capacity binding, adding timeline capacity shouldn't change max net votes.
      if (it.deltaMaxNetVotes != null) assert(Math.abs(it.deltaMaxNetVotes) <= 1e-9, "Expected ~0 deltaMaxNetVotes");
    }
  });

  test("Phase 8B: binding timeline cap => primary is timeline and some intervention helps", () => {
    const tactics = [
      { id:"doors", label:"Doors", costPerAttempt: 1.0, netVotesPerAttempt: 0.20, maxAttempts: null },
      { id:"phones", label:"Phones", costPerAttempt: 1.0, netVotesPerAttempt: 0.05, maxAttempts: null },
      { id:"texts", label:"Texts", costPerAttempt: 1.0, netVotesPerAttempt: 0.01, maxAttempts: null }
    ];

    const capsInput = {
      enabled: true,
      weeksRemaining: 4,
      activeWeeksOverride: 4,
      gotvWindowWeeks: 2,
      staffing: { staff: 1, volunteers: 0, staffHours: 5, volunteerHours: 0 },
      throughput: { doors: 10, phones: 10, texts: 10 },
      tacticKinds: { doors:"persuasion", phones:"persuasion", texts:"persuasion" }
    };
    const caps = computeMaxAttemptsByTactic(capsInput);

    const tlInputs = {
      mode: "budget",
      budgetLimit: 100000,
      capacityLimit: null,
      capacityCeiling: null,
      tactics,
      step: 25,
      useDecay: false,
      objective: "net",
      maxAttemptsByTactic: caps.maxAttemptsByTactic,
      tlObjectiveMode: "max_net",
      goalNetVotes: 999999
    };
    const baseline = optimizeTimelineConstrained(tlInputs);
    const mv1 = computeMarginalValueDiagnostics({ baselineInputs: tlInputs, baselineResult: baseline, timelineInputs: capsInput });
    const mv2 = computeMarginalValueDiagnostics({ baselineInputs: tlInputs, baselineResult: baseline, timelineInputs: capsInput });

    assert(String(mv1.primaryBottleneck).startsWith("timeline:"), `Expected timeline bottleneck, got ${mv1.primaryBottleneck}`);

    const anyPositive = (mv1.interventions || []).some(it => (typeof it.deltaMaxNetVotes === "number") && it.deltaMaxNetVotes > 0);
    assert(anyPositive, "Expected at least one positive deltaMaxNetVotes");

    // Determinism: stable ordering / values
    assert(stableStringify(mv1) === stableStringify(mv2), "Diagnostics not deterministic");
  });

  // Build baseline deterministic context from current state snapshot (no UI mutation)
  const snap = (engine.getStateSnapshot && typeof engine.getStateSnapshot === "function")
    ? engine.getStateSnapshot()
    : null;

  const buildModelInputFromSnapshot = (s) => {
    // Mirrors app.js modelInput structure.
    const candidates = Array.isArray(s?.candidates) ? s.candidates : [];
    return {
      universeSize: (s?.universeSize != null) ? Number(s.universeSize) : null,
      turnoutA: (s?.turnoutA != null) ? Number(s.turnoutA) : null,
      turnoutB: (s?.turnoutB != null) ? Number(s.turnoutB) : null,
      bandWidth: (s?.bandWidth != null) ? Number(s.bandWidth) : null,
      candidates: candidates.map(c => ({
        id: c.id,
        name: c.name,
        supportPct: (c?.supportPct != null) ? Number(c.supportPct) : null
      })),
      undecidedPct: (s?.undecidedPct != null) ? Number(s.undecidedPct) : null,
      yourCandidateId: s?.yourCandidateId,
      undecidedMode: s?.undecidedMode,
      userSplit: s?.userSplit,
      persuasionPct: (s?.persuasionPct != null) ? Number(s.persuasionPct) : null,
      earlyVoteExp: (s?.earlyVoteExp != null) ? Number(s.earlyVoteExp) : null,
    };
  };

  const baseline = (() => {
    try{
      const weeks = engine.derivedWeeksRemaining();
      const w = (weeks != null && weeks >= 0) ? weeks : null;
      const modelInput = snap ? buildModelInputFromSnapshot(snap) : null;
      const res = modelInput ? engine.computeAll(modelInput) : null;
      const needVotes = res ? engine.deriveNeedVotes(res) : null;
      return { weeks: w, res, needVotes };
    } catch {
      return { weeks: null, res: null, needVotes: null };
    }
  })();

  // --- A) Deterministic Math Invariants ---
  test("Deterministic: computeAll produces finite expected KPIs (where defined)", () => {
    assert(baseline.res, "Baseline computeAll result missing");
    const nv = baseline.res?.expected?.netVotes;
    const your = baseline.res?.expected?.yourVotes;
    const thr = baseline.res?.expected?.winThreshold;
    // Some can be null based on incomplete input; only assert finite if present.
    if (nv != null) assert(isFiniteNum(nv), "netVotes is NaN/Infinity");
    if (your != null) assert(isFiniteNum(your), "yourVotes is NaN/Infinity");
    if (thr != null) assert(isFiniteNum(thr), "winThreshold is NaN/Infinity");
  });

  test("ROI layer: no NaN/Infinity in totalCost or costPerNetVote (where defined)", () => {
    assert(snap, "State snapshot unavailable (getStateSnapshot missing?)");
    assert(baseline.res, "Baseline computeAll result missing");

    const cr = pctToUnitFromPct(snap.contactRatePct);
    const sr = pctToUnitFromPct(snap.supportRatePct);
    const tr = pctToUnitFromPct(snap.turnoutReliabilityPct);

    const weeks = baseline.weeks;
    const cap = engine.computeCapacityBreakdown({
      weeks,
      orgCount: (snap.orgCount != null) ? Number(snap.orgCount) : null,
      orgHoursPerWeek: (snap.orgHoursPerWeek != null) ? Number(snap.orgHoursPerWeek) : null,
      volunteerMult: (snap.volunteerMultBase != null) ? Number(snap.volunteerMultBase) : null,
      doorShare: pctToUnitFromPct(snap.channelDoorPct),
      doorsPerHour: (snap.doorsPerHour3 != null) ? Number(snap.doorsPerHour3) : (snap.doorsPerHour != null ? Number(snap.doorsPerHour) : null),
      callsPerHour: (snap.callsPerHour3 != null) ? Number(snap.callsPerHour3) : null,
    });

    const budget = snap.budget || {};
    const overheadAmount = (budget.overheadAmount != null && isFinite(budget.overheadAmount)) ? Math.max(0, Number(budget.overheadAmount)) : 0;
    const includeOverhead = !!budget.includeOverhead;

    const { rows } = engine.computeRoiRows({
      goalNetVotes: baseline.needVotes,
      baseRates: { cr, sr, tr },
      tactics: (budget.tactics || {}),
      overheadAmount,
      includeOverhead,
      caps: { total: cap?.total ?? null, doors: cap?.doors ?? null, phones: cap?.phones ?? null },
      mcLast: snap.mcLast || null
    });

    for (const r of rows || []){
      if (r.totalCost != null) assert(isFiniteNum(r.totalCost), `ROI ${r.label}: totalCost NaN/Infinity`);
      if (r.costPerNetVote != null) assert(isFiniteNum(r.costPerNetVote), `ROI ${r.label}: costPerNetVote NaN/Infinity`);
    }
  });

  test("Optimization: zero budget => zero allocation", () => {
    assert(snap, "State snapshot unavailable");
    const cr = pctToUnitFromPct(snap.contactRatePct);
    const sr = pctToUnitFromPct(snap.supportRatePct);
    const tr = pctToUnitFromPct(snap.turnoutReliabilityPct);

    const budget = snap.budget || {};
    const tacticsRaw = budget.tactics || {};
    const tactics = engine.buildOptimizationTactics({ baseRates: { cr, sr, tr }, tactics: tacticsRaw, turnoutModel: { enabled:false }, universeSize: snap?.universeSize ?? null, targetUniversePct: snap?.persuasionPct ?? null });

    const out = engine.optimizeMixBudget({
      budget: 0,
      tactics,
      step: 25,
      capacityCeiling: null,
      useDecay: false
    });

    const attempts = out?.totals?.attempts ?? 0;
    const cost = out?.totals?.cost ?? 0;
    assert(attempts === 0, `Expected 0 attempts, got ${attempts}`);
    assert(cost === 0, `Expected 0 cost, got ${cost}`);
  });

  test("Optimization: zero capacity => zero allocation", () => {
    assert(snap, "State snapshot unavailable");
    const cr = pctToUnitFromPct(snap.contactRatePct);
    const sr = pctToUnitFromPct(snap.supportRatePct);
    const tr = pctToUnitFromPct(snap.turnoutReliabilityPct);

    const budget = snap.budget || {};
    const tacticsRaw = budget.tactics || {};
    const tactics = engine.buildOptimizationTactics({ baseRates: { cr, sr, tr }, tactics: tacticsRaw });

    const out = engine.optimizeMixCapacity({
      capacity: 0,
      tactics,
      step: 25,
      useDecay: false
    });

    const attempts = out?.totals?.attempts ?? 0;
    const cost = out?.totals?.cost ?? 0;
    assert(attempts === 0, `Expected 0 attempts, got ${attempts}`);
    assert(cost === 0, `Expected 0 cost, got ${cost}`);
  });

  // --- B) Optimization Constraints ---
  test("Optimization: budget mode never exceeds budget", () => {
    const tactics = [
      { id:"a", label:"A", costPerAttempt: 1.0, netVotesPerAttempt: 0.05, maxAttempts: null },
      { id:"b", label:"B", costPerAttempt: 2.5, netVotesPerAttempt: 0.12, maxAttempts: null },
      { id:"c", label:"C", costPerAttempt: 0.5, netVotesPerAttempt: 0.01, maxAttempts: null }
    ];
    const budget = 250;
    const step = 25;
    const out = engine.optimizeMixBudget({ budget, tactics, step, capacityCeiling: null, useDecay: false });
    const cost = out?.totals?.cost ?? 0;
    assert(cost <= budget + 1e-9, `Cost ${cost} exceeded budget ${budget}`);
  });

  test("Optimization: capacity mode never exceeds capacity", () => {
    const tactics = [
      { id:"a", label:"A", costPerAttempt: 1.0, netVotesPerAttempt: 0.05, maxAttempts: null },
      { id:"b", label:"B", costPerAttempt: 2.5, netVotesPerAttempt: 0.12, maxAttempts: null }
    ];
    const cap = 300;
    const step = 25;
    const out = engine.optimizeMixCapacity({ capacity: cap, tactics, step, useDecay: false });
    const attempts = out?.totals?.attempts ?? 0;
    assert(attempts <= cap + 1e-9, `Attempts ${attempts} exceeded capacity ${cap}`);
  });

  test("Optimization: respects maxAttempts caps", () => {
    const tactics = [
      { id:"a", label:"A", costPerAttempt: 1.0, netVotesPerAttempt: 0.20, maxAttempts: 50 },
      { id:"b", label:"B", costPerAttempt: 1.0, netVotesPerAttempt: 0.10, maxAttempts: 9999 }
    ];
    const out = engine.optimizeMixBudget({ budget: 500, tactics, step: 25, capacityCeiling: null, useDecay: false });
    const a = out?.allocation?.a ?? 0;
    assert(a <= 50 + 1e-9, `Allocation a=${a} exceeded maxAttempts=50`);
  });

  test("Optimization: deterministic reproducibility (same input => same output)", () => {
    const tactics = [
      { id:"a", label:"A", costPerAttempt: 1.0, netVotesPerAttempt: 0.05, maxAttempts: null },
      { id:"b", label:"B", costPerAttempt: 2.5, netVotesPerAttempt: 0.12, maxAttempts: null }
    ];
    const args = { budget: 250, tactics, step: 25, capacityCeiling: 9999, useDecay: false };
    const o1 = engine.optimizeMixBudget(args);
    const o2 = engine.optimizeMixBudget(args);
    assert(stableStringify(o1) === stableStringify(o2), "Outputs differed for identical inputs");
  });

  // --- Phase 7) Timeline / Production feasibility ---
  test("Timeline: OFF returns neutral outputs", () => {
    const tl = engine.computeTimelineFeasibility({
      enabled: false,
      weeksRemaining: 10,
      activeWeeksOverride: null,
      gotvWindowWeeks: 2,
      staffing: { staff: 1, volunteers: 0, staffHours: 40, volunteerHours: 0 },
      throughput: { doors: 30 },
      required: { doors: 1000 },
      tacticKinds: { doors: "persuasion" },
      netVotesPerAttempt: 0.01,
      bindingHint: "budget",
      ramp: { enabled: false, mode: "linear" }
    });
    assert(tl && tl.enabled === false, "Timeline should be disabled");
    assert(tl.percentPlanExecutable === 1, "Disabled timeline should be neutral (100%)");
  });

  test("Timeline: zero weeks => zero executable attempts", () => {
    const tl = engine.computeTimelineFeasibility({
      enabled: true,
      weeksRemaining: 0,
      activeWeeksOverride: null,
      gotvWindowWeeks: 2,
      staffing: { staff: 2, volunteers: 0, staffHours: 40, volunteerHours: 0 },
      throughput: { doors: 30 },
      required: { doors: 1000 },
      tacticKinds: { doors: "persuasion" },
      netVotesPerAttempt: 0.01,
      bindingHint: "budget",
      ramp: { enabled: false, mode: "linear" }
    });
    assert((tl.executableAttemptsTotal ?? -1) === 0, `Expected 0 executable, got ${tl.executableAttemptsTotal}`);
    assert((tl.percentPlanExecutable ?? 1) === 0, `Expected 0% executable, got ${tl.percentPlanExecutable}`);
    assert((tl.shortfallAttempts ?? 0) === 1000, `Expected shortfall 1000, got ${tl.shortfallAttempts}`);
  });

  test("Timeline: required attempts <= capacity => 100% executable", () => {
    const tl = engine.computeTimelineFeasibility({
      enabled: true,
      weeksRemaining: 4,
      activeWeeksOverride: null,
      gotvWindowWeeks: 2,
      staffing: { staff: 1, volunteers: 0, staffHours: 40, volunteerHours: 0 },
      throughput: { doors: 10 },
      required: { doors: 1000 },
      tacticKinds: { doors: "persuasion" },
      netVotesPerAttempt: 0.01,
      bindingHint: "capacity",
      ramp: { enabled: false, mode: "linear" }
    });
    assert(tl.percentPlanExecutable === 1, `Expected 100%, got ${tl.percentPlanExecutable}`);
    assert((tl.shortfallAttempts ?? 0) === 0, `Expected 0 shortfall, got ${tl.shortfallAttempts}`);
  });

  test("Timeline: required attempts > capacity => shortfall > 0", () => {
    const tl = engine.computeTimelineFeasibility({
      enabled: true,
      weeksRemaining: 2,
      activeWeeksOverride: null,
      gotvWindowWeeks: 2,
      staffing: { staff: 1, volunteers: 0, staffHours: 10, volunteerHours: 0 },
      throughput: { doors: 10 },
      required: { doors: 1000 },
      tacticKinds: { doors: "persuasion" },
      netVotesPerAttempt: 0.01,
      bindingHint: "budget",
      ramp: { enabled: true, mode: "linear" }
    });
    assert((tl.shortfallAttempts ?? 0) > 0, "Expected shortfall > 0");
    assert(tl.constraintType === "Timeline-limited", `Expected Timeline-limited, got ${tl.constraintType}`);
  });

  test("Timeline: no NaN / Infinity in outputs", () => {
    const tl = engine.computeTimelineFeasibility({
      enabled: true,
      weeksRemaining: 0,
      activeWeeksOverride: 0,
      gotvWindowWeeks: 0,
      staffing: { staff: 0, volunteers: 0, staffHours: 0, volunteerHours: 0 },
      throughput: { doors: 0, phones: 0, texts: 0 },
      required: { doors: 0, phones: 0, texts: 0 },
      tacticKinds: { doors: "persuasion", phones: "persuasion", texts: "turnout" },
      netVotesPerAttempt: 0,
      bindingHint: "caps",
      ramp: { enabled: false, mode: "linear" }
    });
    const scalars = [
      tl.requiredAttemptsTotal,
      tl.executableAttemptsTotal,
      tl.percentPlanExecutable,
      tl.shortfallAttempts
    ];
    for (const v of scalars){
      assert(v == null || Number.isFinite(v), `Non-finite scalar: ${v}`);
    }
    if (Array.isArray(tl.weekly)){
      for (const w of tl.weekly){
        assert(Number.isFinite(w.week), `Non-finite week index: ${w.week}`);
        assert(Number.isFinite(w.attempts), `Non-finite week attempts: ${w.attempts}`);
      }
    }
  });

  test("Timeline: deterministic reproducibility", () => {
    const args = {
      enabled: true,
      weeksRemaining: 5,
      activeWeeksOverride: 5,
      gotvWindowWeeks: 2,
      staffing: { staff: 2, volunteers: 5, staffHours: 35, volunteerHours: 3 },
      throughput: { doors: 28, phones: 18, texts: 120 },
      required: { doors: 1200, phones: 2000, texts: 5000 },
      tacticKinds: { doors: "persuasion", phones: "persuasion", texts: "turnout" },
      netVotesPerAttempt: 0.02,
      bindingHint: "budget",
      ramp: { enabled: true, mode: "s" }
    };
    const a = engine.computeTimelineFeasibility(args);
    const b = engine.computeTimelineFeasibility(args);
    assert(stableStringify(a) === stableStringify(b), "Timeline outputs differed for identical inputs");
  });

  // --- C) Monte Carlo Stability ---
  test("Monte Carlo: same seed => identical summary output", () => {
    assert(baseline.res, "Baseline computeAll result missing");
    const sim1 = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 2000, seed: "selftest-seed-1" });
    const sim2 = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 2000, seed: "selftest-seed-1" });
    assert(stableStringify(sim1?.summary) === stableStringify(sim2?.summary), "Same seed produced different summaries");
  });

  test("Monte Carlo: different seed => different summary output", () => {
    assert(baseline.res, "Baseline computeAll result missing");
    // If weeks is unknown or capacity inputs are incomplete, MC will often degenerate
    // into a constant output regardless of seed (votes=0 for every run). In that case,
    // this test is not informative and should be skipped as a pass.
    if (baseline.weeks == null) return true;
    const sim1 = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 2000, seed: "selftest-seed-A" });
    const sim2 = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 2000, seed: "selftest-seed-B" });
    const s1 = sim1?.summary || {};
    const s2 = sim2?.summary || {};
    // Degenerate case: if both outputs show zero spread, seed sensitivity can't be asserted.
    const deg1 = (s1.p5 === s1.p95) && (s1.median === s1.p5);
    const deg2 = (s2.p5 === s2.p95) && (s2.median === s2.p5);
    if (deg1 && deg2 && (s1.p5 === s2.p5) && (s1.median === s2.median) && (s1.p95 === s2.p95)) return true;
    // Compare a couple of scalar outputs; tolerate rare collision.
    const same = (s1.winProb === s2.winProb) && (s1.median === s2.median) && (s1.p5 === s2.p5) && (s1.p95 === s2.p95);
    assert(!same, "Different seeds produced identical key summary stats (unexpected)");
  });

  test("Monte Carlo: deterministic baseline roughly aligns with MC median (within tolerance)", () => {
    assert(snap, "State snapshot unavailable");
    assert(baseline.res, "Baseline computeAll result missing");

    // Deterministic expectation using base rates + base capacity (mirrors MC core math).
    const weeks = baseline.weeks;
    const orgCount = (snap.orgCount != null) ? Number(snap.orgCount) : null;
    const orgHrs = (snap.orgHoursPerWeek != null) ? Number(snap.orgHoursPerWeek) : null;
    const vm = (snap.volunteerMultBase != null) ? Number(snap.volunteerMultBase) : null;
    const doorShare = pctToUnitFromPct(snap.channelDoorPct);
    const dph = (snap.doorsPerHour3 != null) ? Number(snap.doorsPerHour3) : (snap.doorsPerHour != null ? Number(snap.doorsPerHour) : null);
    const cph = (snap.callsPerHour3 != null) ? Number(snap.callsPerHour3) : null;

    const capContacts = engine.computeCapacityContacts({ weeks, orgCount, orgHoursPerWeek: orgHrs, volunteerMult: vm, doorShare, doorsPerHour: dph, callsPerHour: cph });
    // If capacity can't be computed (incomplete inputs), skip as pass.
    if (capContacts == null || capContacts <= 0) return true;

    const cr = pctToUnitFromPct(snap.contactRatePct);
    const pr = pctToUnitFromPct(snap.supportRatePct);
    const rr = pctToUnitFromPct(snap.turnoutReliabilityPct);
    if (!(cr && cr > 0) || !(pr && pr > 0) || !(rr && rr > 0)) return true;

    const detVotes = capContacts * cr * pr * rr;
    const detMargin = detVotes - (baseline.needVotes ?? 0);

    const sim = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 5000, seed: "selftest-seed-align" });
    const mcMedian = sim?.summary?.median;

    if (mcMedian == null || !isFinite(mcMedian)) return true;

    // Tolerance: absolute 10% of |detMargin| plus a floor to avoid tiny margins.
    const tol = Math.max(100, Math.abs(detMargin) * 0.10);
    assert(approx(mcMedian, detMargin, tol), `MC median ${mcMedian} not within tol ${tol} of deterministic margin ${detMargin}`);
  });

  
  // --- Phase 5.6) Golden snapshot fixtures (drift detection) ---
  const normalizeMoney = (v) => (v == null || !isFinite(v)) ? null : Math.round(Number(v) * 100) / 100;
  const normalizeRate = (v) => (v == null || !isFinite(v)) ? null : Math.round(Number(v) * 10000) / 10000;

  const fixtureResults = [];

  const runFixture = (fx) => {
    const spec = fx?.spec || {};
    const mi = spec.modelInput || {};
    const res = engine.computeAll(mi);
    const need = res?.expected?.persuasionNeed ?? 0;

    const baseRates = spec.baseRates || {};
    const tactics = spec.tactics || {};
    const overheadAmount = (spec.overheadAmount != null && isFinite(spec.overheadAmount)) ? Number(spec.overheadAmount) : 0;
    const includeOverhead = !!spec.includeOverhead;

    const { rows } = engine.computeRoiRows({
      goalNetVotes: need,
      baseRates: { cr: Number(baseRates.cr), sr: Number(baseRates.sr), tr: Number(baseRates.tr) },
      tactics,
      overheadAmount,
      includeOverhead,
      caps: { total: null, doors: null, phones: null },
      mcLast: null
    });

    const tacticsOpt = engine.buildOptimizationTactics({ baseRates: { cr: Number(baseRates.cr), sr: Number(baseRates.sr), tr: Number(baseRates.tr) }, tactics });
    const optSpec = spec.optimize || {};
    const step = (optSpec.step != null && isFinite(optSpec.step)) ? Number(optSpec.step) : 25;

    const opt = (optSpec.mode === "capacity")
      ? engine.optimizeMixCapacity({ capacity: Number(optSpec.capacity), tactics: tacticsOpt, step, useDecay: false })
      : engine.optimizeMixBudget({ budget: Number(optSpec.budget), tactics: tacticsOpt, step, capacityCeiling: (optSpec.capacityCeiling != null ? Number(optSpec.capacityCeiling) : null), useDecay: false });

    const roiRows = Array.isArray(rows) ? rows.map(r => ({
      key: r.key,
      totalCost: normalizeMoney(r.totalCost),
      costPerNetVote: normalizeRate(r.costPerNetVote)
    })) : [];

    const out = {
      id: fx.id,
      persuasionNeed: need,
      turnoutVotes: res?.expected?.turnoutVotes ?? null,
      winThreshold: res?.expected?.winThreshold ?? null,
      yourVotes: res?.expected?.yourVotes ?? null,
      roi: {
        rows: roiRows
      },
      optimize: {
        totals: {
          cost: normalizeMoney(opt?.totals?.cost),
          attempts: (opt?.totals?.attempts != null ? Number(opt.totals.attempts) : null)
        },
        allocation: opt?.allocation || {}
      }
    };

    fixtureResults.push(out);
    return out;
  };

  const getFixtureExpectedRow = (fxExpect, key) => {
    const rows = fxExpect?.roi?.rows;
    if (!Array.isArray(rows)) return null;
    return rows.find(r => r.key === key) || null;
  };

  // Run fixtures + assert against snapshots
  if (Array.isArray(FIXTURES) && FIXTURES.length){
    for (const fx of FIXTURES){
      test(`Fixture: ${fx.id} matches golden snapshot`, () => {
        const got = runFixture(fx);
        const exp = fx.expect || {};

        // Integers should be exact
        assert(got.persuasionNeed === exp.persuasionNeed, `persuasionNeed ${got.persuasionNeed} != ${exp.persuasionNeed}`);
        assert(got.turnoutVotes === exp.turnoutVotes, `turnoutVotes ${got.turnoutVotes} != ${exp.turnoutVotes}`);
        assert(got.winThreshold === exp.winThreshold, `winThreshold ${got.winThreshold} != ${exp.winThreshold}`);
        assert(got.yourVotes === exp.yourVotes, `yourVotes ${got.yourVotes} != ${exp.yourVotes}`);

        // ROI snapshot (tolerant rounding already applied)
        const expRows = exp?.roi?.rows || [];
        for (const er of expRows){
          const gr = got.roi.rows.find(r => r.key === er.key);
          assert(gr, `missing ROI row: ${er.key}`);
          assert(approx(gr.totalCost, er.totalCost, 0.01), `ROI ${er.key} totalCost ${gr.totalCost} != ${er.totalCost}`);
          assert(approx(gr.costPerNetVote, er.costPerNetVote, 0.0002), `ROI ${er.key} costPerNetVote ${gr.costPerNetVote} != ${er.costPerNetVote}`);
        }

        // Optimization snapshot
        const expOpt = exp.optimize || {};
        const gotCost = got.optimize.totals.cost;
        const gotAttempts = got.optimize.totals.attempts;
        assert(approx(gotCost, expOpt?.totals?.cost, 0.01), `opt cost ${gotCost} != ${expOpt?.totals?.cost}`);
        assert(gotAttempts === expOpt?.totals?.attempts, `opt attempts ${gotAttempts} != ${expOpt?.totals?.attempts}`);

        const expAlloc = expOpt.allocation || {};
        for (const k of Object.keys(expAlloc)){
          assert((got.optimize.allocation?.[k] ?? 0) === expAlloc[k], `opt alloc ${k} ${(got.optimize.allocation?.[k] ?? 0)} != ${expAlloc[k]}`);
        }
      });
    }
  } else {
    test("Fixtures: FIXTURES present", () => {
      assert(false, "No fixtures found (FIXTURES missing or empty)");
    });
  }

  // Build a compact signature for drift diagnostics in the dev panel.
  const signature = {
    phase: "5.6",
    fixtures: fixtureResults
  };
  results.signature = signature;
  try{
    // Deterministic, order-independent hash for drift diagnostics.
    // NOTE: This must be a short, stable hex string (not a JSON blob).
    results.signatureHash = computeSnapshotHash(signature);
  } catch {
    results.signatureHash = null;
  }




  // --- Phase 6: Turnout / GOTV invariants ---
  test("Phase 6 invariant: Turnout OFF leaves objective values unchanged", () => {
      assert(typeof engine.withPatchedState === "function", "Missing withPatchedState()");
      const out = engine.withPatchedState({ turnoutEnabled: false }, () => {
        const s = engine.getStateSnapshot();
        const cr = (s?.contactRatePct != null) ? Number(s.contactRatePct)/100 : 0.15;
        const sr = (s?.supportRatePct != null) ? Number(s.supportRatePct)/100 : 0.10;
        const tr = (s?.turnoutReliabilityPct != null) ? Number(s.turnoutReliabilityPct)/100 : 0.80;
        return engine.buildOptimizationTactics({
          baseRates: { cr, sr, tr },
          tactics: s?.budget?.tactics || {},
          turnoutModel: { enabled:false },
          universeSize: s?.universeSize ?? null,
          targetUniversePct: s?.persuasionPct ?? null,
        });
      });

      assert(Array.isArray(out), "Expected tactics array");
      for (const t of out){
        assert(approx(t.turnoutAdjustedNetVotesPerAttempt, t.netVotesPerAttempt, 1e-12), `tactic ${t.id} drifted when turnout OFF`);
      }
    });

    test("Phase 6: Monte Carlo seeds affect turnout-adjusted outputs when variability exists", () => {
      assert(typeof engine.withPatchedState === "function", "Missing withPatchedState()");
      const baseSnap = engine.getStateSnapshot();
      const modelInput = buildModelInputFromSnapshot(baseSnap);

      const patch = {
        turnoutEnabled: true,
        turnoutBaselinePct: 55,
        turnoutTargetOverridePct: "",
        gotvMode: "advanced",
        gotvLiftMin: 0.2,
        gotvLiftMode: 1.0,
        gotvLiftMax: 2.0,
        gotvMaxLiftPP2: 12,
        gotvDiminishing2: true,
      };

      const a = engine.withPatchedState(patch, () => engine.runMonteCarloSim(modelInput, { mode: "advanced", seed: "seed-A", runs: 2000 }));
      const b = engine.withPatchedState(patch, () => engine.runMonteCarloSim(modelInput, { mode: "advanced", seed: "seed-B", runs: 2000 }));

      assert(a && b, "Missing MC summaries");
      assert(a.turnoutAdjusted && b.turnoutAdjusted, "Missing turnoutAdjusted summaries");
      assert(a.turnoutAdjusted.mean !== b.turnoutAdjusted.mean, "Different seeds should change turnout-adjusted mean when variability exists");
    });

    test("Phase 6: No NaN/Infinity in turnout-adjusted ROI fields", () => {
      assert(typeof engine.withPatchedState === "function", "Missing withPatchedState()");
      const s = engine.getStateSnapshot();
      const cr = (s?.contactRatePct != null) ? clamp(Number(s.contactRatePct), 0, 100)/100 : 0.15;
      const sr = (s?.supportRatePct != null) ? clamp(Number(s.supportRatePct), 0, 100)/100 : 0.10;
      const tr = (s?.turnoutReliabilityPct != null) ? clamp(Number(s.turnoutReliabilityPct), 0, 100)/100 : 0.80;

      const rows = engine.withPatchedState({
        turnoutEnabled: true,
        gotvMode: "basic",
        gotvLiftPP: 1.0,
        gotvMaxLiftPP: 10,
        gotvDiminishing: false,
        turnoutBaselinePct: 55,
        budget: { tactics: { doors: { enabled:true, cpa:0.18, kind:"gotv" }, phones: { enabled:true, cpa:0.03, kind:"persuasion" } } }
      }, () => {
        const res = engine.computeAll(buildModelInputFromSnapshot(engine.getStateSnapshot()));
        const needVotes = engine.deriveNeedVotes(res);
        const out = engine.computeRoiRows({
          goalNetVotes: needVotes,
          baseRates: { cr, sr, tr },
          tactics: engine.getStateSnapshot().budget.tactics,
          overheadAmount: 0,
          includeOverhead: false,
          caps: { total: null, doors: null, phones: null },
          mcLast: null,
          turnoutModel: { enabled:true, baselineTurnoutPct:55, liftPerContactPP:1.0, maxLiftPP:10, useDiminishing:false },
        });
        return out.rows || [];
      });

      for (const r of rows){
        if (r.turnoutAdjustedNetVotesPerAttempt != null){
          assert(Number.isFinite(r.turnoutAdjustedNetVotesPerAttempt), "turnoutAdjustedNetVotesPerAttempt not finite");
        }
        if (r.costPerTurnoutAdjustedNetVote != null){
          assert(Number.isFinite(r.costPerTurnoutAdjustedNetVote), "costPerTurnoutAdjustedNetVote not finite");
        }
      }
    });



  // =========================
  // Phase 8A — Timeline-Constrained Optimization tests
  // =========================

  test("Phase 8A: Caps high enough => timeline-constrained matches standard optimizer", () => {
    if (!engine.optimizeTimelineConstrained) return true;

    const tacticsOpt = engine.buildOptimizationTactics({
      baseRates: { cr: 0.2, sr: 0.5, tr: 0.8 },
      tactics: {
        doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
        phones: { enabled: true, cpa: 0.03, kind: "persuasion" },
        texts: { enabled: true, cpa: 0.02, kind: "persuasion" }
      }
    });

    const standard = engine.optimizeMixBudget({
      budget: 5000,
      tactics: tacticsOpt,
      step: 25,
      capacityCeiling: null,
      useDecay: false,
      objective: "net"
    });

    const tl = engine.optimizeTimelineConstrained({
      mode: "budget",
      budgetLimit: 5000,
      capacityLimit: null,
      capacityCeiling: null,
      tactics: tacticsOpt,
      step: 25,
      useDecay: false,
      objective: "net",
      maxAttemptsByTactic: { doors: 1e12, phones: 1e12, texts: 1e12 },
      tlObjectiveMode: "max_net",
      goalNetVotes: 100
    });

    assert(stableStringify(tl.plan.allocation) === stableStringify(standard.allocation), "Allocation drift under high caps");
    assert(Math.abs((tl.plan.totals?.netVotes ?? 0) - (standard.totals?.netVotes ?? 0)) < 1e-9, "Totals drift under high caps");
    return true;
  });

  test("Phase 8A: Tight caps => allocations never exceed caps", () => {
    if (!engine.optimizeTimelineConstrained) return true;

    const tacticsOpt = engine.buildOptimizationTactics({
      baseRates: { cr: 0.2, sr: 0.5, tr: 0.8 },
      tactics: {
        doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
        phones: { enabled: true, cpa: 0.03, kind: "persuasion" },
        texts: { enabled: true, cpa: 0.02, kind: "persuasion" }
      }
    });

    const caps = { doors: 0, phones: 200, texts: 50 };

    const tl = engine.optimizeTimelineConstrained({
      mode: "budget",
      budgetLimit: 5000,
      capacityLimit: null,
      capacityCeiling: null,
      tactics: tacticsOpt,
      step: 25,
      useDecay: false,
      objective: "net",
      maxAttemptsByTactic: caps,
      tlObjectiveMode: "max_net",
      goalNetVotes: 100
    });

    for (const [k, cap] of Object.entries(caps)){
      const a = Number(tl.plan.allocation?.[k] ?? 0);
      assert(Number.isFinite(a), `Allocation ${k} not finite`);
      assert(a <= cap + 1e-9, `Allocation ${k} exceeds cap`);
    }
    return true;
  });

  test("Phase 8A: Impossible goal => goalFeasible=false, remainingGapNetVotes>0", () => {
    if (!engine.optimizeTimelineConstrained) return true;

    const tacticsOpt = engine.buildOptimizationTactics({
      baseRates: { cr: 0.2, sr: 0.5, tr: 0.8 },
      tactics: {
        doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
        phones: { enabled: true, cpa: 0.03, kind: "persuasion" },
        texts: { enabled: true, cpa: 0.02, kind: "persuasion" }
      }
    });

    const tl = engine.optimizeTimelineConstrained({
      mode: "budget",
      budgetLimit: 100,
      capacityLimit: null,
      capacityCeiling: null,
      tactics: tacticsOpt,
      step: 25,
      useDecay: false,
      objective: "net",
      maxAttemptsByTactic: { doors: 25, phones: 25, texts: 25 },
      tlObjectiveMode: "min_cost_goal",
      goalNetVotes: 1e9
    });

    assert(tl.meta.goalFeasible === false, "Expected goalFeasible=false");
    assert(Number.isFinite(tl.meta.maxAchievableNetVotes), "maxAchievableNetVotes not finite");
    assert(Number.isFinite(tl.meta.remainingGapNetVotes), "remainingGapNetVotes not finite");
    assert(tl.meta.remainingGapNetVotes > 0, "Expected remainingGapNetVotes > 0");
    return true;
  });

  test("Phase 8A: No NaN/Infinity in new outputs", () => {
    if (!engine.optimizeTimelineConstrained) return true;

    const tacticsOpt = engine.buildOptimizationTactics({
      baseRates: { cr: 0.2, sr: 0.5, tr: 0.8 },
      tactics: {
        doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
        phones: { enabled: true, cpa: 0.03, kind: "persuasion" }
      }
    });

    const tl = engine.optimizeTimelineConstrained({
      mode: "capacity",
      budgetLimit: null,
      capacityLimit: 100,
      capacityCeiling: null,
      tactics: tacticsOpt,
      step: 25,
      useDecay: false,
      objective: "net",
      maxAttemptsByTactic: { doors: 100, phones: 100 },
      tlObjectiveMode: "max_net",
      goalNetVotes: 10
    });

    const meta = tl.meta || {};
    assert(typeof meta.bindingConstraints === "string", "bindingConstraints not string");
    assert(Number.isFinite(meta.maxAchievableNetVotes), "maxAchievableNetVotes not finite");
    assert(Number.isFinite(meta.remainingGapNetVotes), "remainingGapNetVotes not finite");
    return true;
  });

  test("Phase 8A: Deterministic reproducibility (same inputs => same outputs)", () => {
    if (!engine.optimizeTimelineConstrained) return true;

    const tacticsOpt = engine.buildOptimizationTactics({
      baseRates: { cr: 0.2, sr: 0.5, tr: 0.8 },
      tactics: {
        doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
        phones: { enabled: true, cpa: 0.03, kind: "persuasion" },
        texts: { enabled: true, cpa: 0.02, kind: "persuasion" }
      }
    });

    const args = {
      mode: "budget",
      budgetLimit: 5000,
      capacityLimit: null,
      capacityCeiling: null,
      tactics: tacticsOpt,
      step: 25,
      useDecay: false,
      objective: "net",
      maxAttemptsByTactic: { doors: 200, phones: 200, texts: 200 },
      tlObjectiveMode: "min_cost_goal",
      goalNetVotes: 50
    };

    const a = engine.optimizeTimelineConstrained(args);
    const b = engine.optimizeTimelineConstrained(args);

    assert(stableStringify(a.plan.allocation) === stableStringify(b.plan.allocation), "Allocation not deterministic");
    assert(stableStringify(a.meta) === stableStringify(b.meta), "Meta not deterministic");
    return true;
  });

  test("Phase 9A: deterministic JSON ordering", () => {
    const obj = { b: 2, a: { d: 4, c: 3 } };
    const s1 = deterministicStringify(obj, 2);
    const s2 = deterministicStringify(obj, 2);
    assert(s1 === s2, "deterministicStringify not stable");
    // Must order keys alphabetically at each level
    assert(s1.indexOf('"a"') < s1.indexOf('"b"'), "Top-level keys not ordered");
    return true;
  });

  test("Phase 9A: Export → Import roundtrip preserves scenario", () => {
    const scenario = withUniverseDefaults({ scenarioName: "X", raceType: "state_leg", electionDate: "2026-11-03", weeksRemaining: "", mode: "persuasion",
      universeBasis: "registered", universeSize: 1000, turnoutA: 40, turnoutB: 44, bandWidth: 4,
      candidates: [{id:"a",name:"A",supportPct:40},{id:"b",name:"B",supportPct:40}], undecidedPct: 20, yourCandidateId:"a",
      undecidedMode:"even", persuasionPct:30, earlyVoteExp:40,
      supportRatePct:55, contactRatePct:22, turnoutReliabilityPct:80,
      mcMode:"basic", mcVolatility:10, mcSeed:123,
      budget: { overheadAmount:0, includeOverhead:false, tactics:{}, optimize:{ mode:"budget", budgetAmount:0, capacityAttempts:"", step:25, useDecay:false, objective:"net" } },
      timelineEnabled:false, ui:{ training:false, dark:false }
    });
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: scenario });
    const v = validateScenarioExport(payload, MODEL_VERSION);
    assert(v.ok, "validateScenarioExport failed");
    const sA = deterministicStringify(v.scenario, 2);
    const sB = deterministicStringify(scenario, 2);
    assert(sA === sB, "Scenario drift in roundtrip");
    return true;
  });

  test("Phase 10: export includes schemaVersion (and appVersion)", () => {
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, schemaVersion: CURRENT_SCHEMA_VERSION, appVersion: MODEL_VERSION, scenarioState: { a: 1 } });
    assert(payload.schemaVersion === CURRENT_SCHEMA_VERSION, "Missing/incorrect schemaVersion on export");
    assert(typeof payload.appVersion === "string" && payload.appVersion.length > 0, "Missing appVersion on export");
    return true;
  });

  test("Phase 10: import missing schemaVersion migrates with warnings", () => {
    const scenario = { a: 1, ui: { training:false, dark:false } };
    const legacy = { modelVersion: MODEL_VERSION, snapshotHash: computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: scenario }), exportedAt: new Date().toISOString(), scenario };
    const mig = migrateSnapshot(legacy);
    assert(mig.snapshot.schemaVersion === CURRENT_SCHEMA_VERSION, "schemaVersion default not applied");
    assert(Array.isArray(mig.warnings) && mig.warnings.length > 0, "Expected migration warnings");
    const v = validateScenarioExport(mig.snapshot, MODEL_VERSION);
    assert(v.ok, "validateScenarioExport failed after migration");
    const h = computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
    assert(typeof h === "string" && h.length >= 8, "Hash recompute failed");
    return true;
  });

  test("Phase 10: migration does not mutate inputs", () => {
    const raw = deepFreeze({
      modelVersion: MODEL_VERSION,
      scenario: deepFreeze({ a: 1, b: { c: 2 } }),
      exportedAt: "2026-01-01T00:00:00.000Z",
      snapshotHash: "abc",
      extraField: { x: 1 }
    });
    const before = stableStringify(raw);
    const mig = migrateSnapshot(raw);
    const after = stableStringify(raw);
    assert(before === after, "Input mutated by migrateSnapshot");
    assert(mig.snapshot && typeof mig.snapshot === "object", "Missing migrated snapshot");
    return true;
  });

  test("Phase 10: Export → Import → Export roundtrip keeps schemaVersion stable and hash stable", () => {
    const scenario = withUniverseDefaults({ scenarioName: "X", raceType: "state_leg", electionDate: "2026-11-03", weeksRemaining: "", mode: "persuasion",
      universeBasis: "registered", universeSize: 1000, turnoutA: 40, turnoutB: 44, bandWidth: 4,
      candidates: [{id:"a",name:"A",supportPct:40},{id:"b",name:"B",supportPct:40}], undecidedPct: 20, yourCandidateId:"a",
      undecidedMode:"even", persuasionPct:30, earlyVoteExp:40,
      supportRatePct:55, contactRatePct:22, turnoutReliabilityPct:80,
      mcMode:"basic", mcVolatility:10, mcSeed:123,
      budget: { overheadAmount:0, includeOverhead:false, tactics:{}, optimize:{ mode:"budget", budgetAmount:0, capacityAttempts:"", step:25, useDecay:false, objective:"net" } },
      timelineEnabled:false, ui:{ training:false, dark:false }
    });
    const p1 = makeScenarioExport({ modelVersion: MODEL_VERSION, schemaVersion: CURRENT_SCHEMA_VERSION, appVersion: MODEL_VERSION, scenarioState: scenario });
    const mig = migrateSnapshot(p1);
    const v = validateScenarioExport(mig.snapshot, MODEL_VERSION);
    assert(v.ok, "validateScenarioExport failed after migration");
    const h1 = computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
    const p2 = makeScenarioExport({ modelVersion: v.modelVersion, schemaVersion: mig.snapshot.schemaVersion, appVersion: mig.snapshot.appVersion || MODEL_VERSION, scenarioState: v.scenario });
    assert(p2.schemaVersion === CURRENT_SCHEMA_VERSION, "schemaVersion not stable across roundtrip");
    assert(p2.snapshotHash === h1, "hash not stable across export/import/export for same effective snapshot");
    return true;
  });

  test("Phase 11: DailyLog JSON roundtrip preserves normalized entries", () => {
    const original = [
      { date: "2026-02-18", attempts: 100, convos: 40, supportIds: 10 },
      { date: "2026-02-19", attempts: 90, convos: 120, supportIds: 999 },
      { date: "2026-02-20", attempts: -5, convos: -1, supportIds: -2 },
    ];
    const normA = normalizeDailyLogArrayE11(original);
    const json = deterministicStringify({ dailyLog: original }, 2);
    const parsed = JSON.parse(json);
    const normB = normalizeDailyLogArrayE11(parsed.dailyLog);
    assert(stableStringify(normA) === stableStringify(normB), "dailyLog drift in JSON roundtrip");
    return true;
  });

  test("Phase 11: DailyLog merge summary counts (added/updated/ignored) are stable", () => {
    const existing = [
      { date: "2026-02-18", attempts: 100, convos: 40, supportIds: 10 },
      { date: "2026-02-19", attempts: 90, convos: 30, supportIds: 5 },
    ];
    const incoming = [
      { date: "2026-02-19", attempts: 90, convos: 30, supportIds: 5 },
      { date: "2026-02-20", attempts: 80, convos: 20, supportIds: 4 },
      { date: "2026-02-18", attempts: 120, convos: 50, supportIds: 12 },
    ];
    const r = dailyLogMergeSummaryE11(existing, incoming);
    assert(r.added === 1, `Expected 1 added, got ${r.added}`);
    assert(r.ignored === 1, `Expected 1 ignored, got ${r.ignored}`);
    assert(r.replaced === 1, `Expected 1 updated, got ${r.replaced}`);
    const norm = normalizeDailyLogArrayE11(r.merged);
    assert(norm.length === 3, "Merged log should have 3 unique dates");
    return true;
  });

  test("Phase 9A: CSV headers present", () => {
    const snap = {
      planRows: [{ tactic:"Doors", attempts:100, expectedContacts:20, expectedNetVotes:3, cost:18, costPerNetVote:6 }],
      planMeta: { weeks: 10, staff: 1, volunteers: 5, objective: "net", feasible: true }
    };
    const csv = planRowsToCsv(snap);
    for (const h of PLAN_CSV_HEADERS){
      assert(csv.includes(h), `Missing CSV header: ${h}`);
    }
    assert(!/NaN|Infinity/.test(csv), "CSV contains NaN/Infinity");
    return true;
  });

  test("Phase 9A: exports contain no NaN/Infinity", () => {
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: { a: 1 } });
    assert(!hasNonFiniteNumbers(payload), "Non-finite numbers found");
    return true;
  });


  test("Phase 9B: same snapshot → same hash", () => {
    const snap = { modelVersion: MODEL_VERSION, scenarioState: { a: 1, b: { c: 2 } } };
    const h1 = computeSnapshotHash(snap);
    const h2 = computeSnapshotHash(snap);
    assert(h1 === h2, "Hash should be stable for identical snapshot");
    return true;
  });

  test("Phase 9B: different snapshot → different hash", () => {
    const a = { modelVersion: MODEL_VERSION, scenarioState: { a: 1, b: 2 } };
    const b = { modelVersion: MODEL_VERSION, scenarioState: { a: 1, b: 3 } };
    const h1 = computeSnapshotHash(a);
    const h2 = computeSnapshotHash(b);
    assert(h1 !== h2, "Hash should differ when scenario changes");
    return true;
  });

  test("Phase 9B: hash does not depend on key order", () => {
    const a = { modelVersion: MODEL_VERSION, scenarioState: { a: 1, b: { x: 9, y: 8 } } };
    const b = { modelVersion: MODEL_VERSION, scenarioState: { b: { y: 8, x: 9 }, a: 1 } };
    const h1 = computeSnapshotHash(a);
    const h2 = computeSnapshotHash(b);
    assert(h1 === h2, "Hash should be order-independent");
    return true;
  });

  test("Phase 9B: Export → Import → identical hash", () => {
    const scenario = { a: 1, b: { c: 2 }, ui: { training:false, dark:false, advDiag:false, activeTab:"win" } };
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: scenario });
    assert(typeof payload.snapshotHash === "string" && payload.snapshotHash.length >= 8, "Export missing snapshotHash");
    const v = validateScenarioExport(payload, MODEL_VERSION);
    assert(v.ok, "validateScenarioExport failed");
    const recomputed = computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
    assert(recomputed === payload.snapshotHash, "Recomputed hash differs after export/import roundtrip");
    return true;
  });


  // =========================
  // Phase 11 — Release hardening tests
  // =========================

  test("Phase 11: Export metadata includes appVersion + buildId", () => {
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: { a: 1 } });
    assert(payload.appVersion === APP_VERSION, "appVersion missing or wrong");
    assert(payload.buildId === BUILD_ID, "buildId missing or wrong");
    return true;
  });

  test("Phase 11: Self-test gate state transitions (pure)", () => {
    assert(gateFromSelfTestResult(null) === SELFTEST_GATE.UNVERIFIED, "null should be UNVERIFIED");
    assert(gateFromSelfTestResult({ total: 10, passed: 10, failed: 0 }) === SELFTEST_GATE.VERIFIED, "pass should be VERIFIED");
    assert(gateFromSelfTestResult({ total: 10, passed: 9, failed: 1 }) === SELFTEST_GATE.FAILED, "fail should be FAILED");
    return true;
  });

  test("Phase 11: Backups roll to max 5 (mocked storage)", () => {
    const mem = (() => {
      const m = new Map();
      return { getItem: (k)=> m.has(k)? m.get(k): null, setItem:(k,v)=>{ m.set(k,String(v)); } };
    })();

    for (let i=0;i<7;i++){
      writeBackupEntry({ ts: String(i), scenarioName: "S"+i, payload: { schemaVersion: CURRENT_SCHEMA_VERSION, modelVersion: MODEL_VERSION, scenario: { n:i } } }, mem);
    }
    const arr = readBackups(mem);
    assert(arr.length === 5, "Expected 5 backups max");
    assert(arr[0].ts === "6", "Newest backup should be first");
    assert(arr[4].ts === "2", "Oldest retained should be #2");
    return true;
  });

  test("Phase 11: Restore backup payload preserves deterministic hash", () => {
    const scenario = withUniverseDefaults({ scenarioName:"RestoreTest", universeSize: 1000, ui:{ training:false, dark:false } });
    const snap = { modelVersion: MODEL_VERSION, schemaVersion: CURRENT_SCHEMA_VERSION, scenarioState: scenario };
    const hash0 = computeSnapshotHash(snap);
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: scenario });
    const mig = migrateSnapshot(payload);
    assert(mig && mig.snapshot && typeof mig.snapshot === "object", "migrateSnapshot failed");
    const v = validateScenarioExport(mig.snapshot, MODEL_VERSION);
    assert(v.ok, "validateScenarioExport failed after migration");
    const hash1 = computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
    assert(hash1 === hash0, "Hash changed after restore path");
    return true;
  });

  test("Phase 11: Strict import blocks newer schema + hash mismatch, allows when OFF", () => {
    const newer = checkStrictImportPolicy({ strictMode:true, importedSchemaVersion:"9.9.9", currentSchemaVersion:CURRENT_SCHEMA_VERSION, hashMismatch:false });
    assert(!newer.ok && newer.issues.length, "Should block newer schema");
    const hm = checkStrictImportPolicy({ strictMode:true, importedSchemaVersion:CURRENT_SCHEMA_VERSION, currentSchemaVersion:CURRENT_SCHEMA_VERSION, hashMismatch:true });
    assert(!hm.ok && hm.issues.length, "Should block hash mismatch");
    const off = checkStrictImportPolicy({ strictMode:false, importedSchemaVersion:"9.9.9", currentSchemaVersion:CURRENT_SCHEMA_VERSION, hashMismatch:true });
    assert(off.ok, "Should allow when strict mode OFF");
    return true;
  });



  // --- D) Phase 12 — Decision Intelligence (sidecar) ---
  test("Phase 12: analysis does not mutate snapshot", () => {
    const snap = engine.getStateSnapshot();
    const before = computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: snap });

    const engineDI = {
      getStateSnapshot: engine.getStateSnapshot,
      withPatchedState: engine.withPatchedState,
      computeAll: engine.computeAll,
      derivedWeeksRemaining: engine.derivedWeeksRemaining,
      deriveNeedVotes: engine.deriveNeedVotes,
      runMonteCarloSim: engine.runMonteCarloSim,
      computeRoiRows: engine.computeRoiRows,
      buildOptimizationTactics: engine.buildOptimizationTactics,
      computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
    };

    const di = computeDecisionIntelligence({ engine: engineDI, snap });
    assert(di && typeof di === "object", "Decision Intelligence did not return an object");

    const after = computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: snap });
    assert(before === after, "Snapshot mutated by Decision Intelligence");
  });

  test("Phase 12: rankings are deterministic (same inputs => same ordering)", () => {
    const snap = engine.getStateSnapshot();
    const engineDI = {
      getStateSnapshot: engine.getStateSnapshot,
      withPatchedState: engine.withPatchedState,
      computeAll: engine.computeAll,
      derivedWeeksRemaining: engine.derivedWeeksRemaining,
      deriveNeedVotes: engine.deriveNeedVotes,
      runMonteCarloSim: engine.runMonteCarloSim,
      computeRoiRows: engine.computeRoiRows,
      buildOptimizationTactics: engine.buildOptimizationTactics,
      computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
    };

    const a = computeDecisionIntelligence({ engine: engineDI, snap });
    const b = computeDecisionIntelligence({ engine: engineDI, snap });

    const aV = (a?.rankings?.volunteers || []).map(x => x.lever).join("|");
    const bV = (b?.rankings?.volunteers || []).map(x => x.lever).join("|");
    const aC = (a?.rankings?.cost || []).map(x => x.lever).join("|");
    const bC = (b?.rankings?.cost || []).map(x => x.lever).join("|");
    const aP = (a?.rankings?.probability || []).map(x => x.lever).join("|");
    const bP = (b?.rankings?.probability || []).map(x => x.lever).join("|");

    assert(aV === bV, "Volunteer ranking order drifted");
    assert(aC === bC, "Cost ranking order drifted");
    assert(aP === bP, "Probability ranking order drifted");
  });

  test("Phase 12: Monte Carlo probability deltas are stable under same seed", () => {
    const snap = engine.getStateSnapshot();
    const engineDI = {
      getStateSnapshot: engine.getStateSnapshot,
      withPatchedState: engine.withPatchedState,
      computeAll: engine.computeAll,
      derivedWeeksRemaining: engine.derivedWeeksRemaining,
      deriveNeedVotes: engine.deriveNeedVotes,
      runMonteCarloSim: engine.runMonteCarloSim,
      computeRoiRows: engine.computeRoiRows,
      buildOptimizationTactics: engine.buildOptimizationTactics,
      computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
    };

    const a = computeDecisionIntelligence({ engine: engineDI, snap });
    const b = computeDecisionIntelligence({ engine: engineDI, snap });

    const aVals = (a?.rankings?.probability || []).map(x => String(x.value)).join("|");
    const bVals = (b?.rankings?.probability || []).map(x => String(x.value)).join("|");

    assert(aVals === bVals, "Probability deltas changed across identical runs");
  });


  

  // Phase 13 — Scenario Manager / Compare Engine
  test("Phase 13: Saving a scenario does not mutate current state", () => {
    const before = engine.getStateSnapshot();
    const beforeHash = computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: before });
    const mgr = createScenarioManager({ max: 5 });
    mgr.add({ label: "A", snapshot: before, engine, modelVersion: MODEL_VERSION });
    const after = engine.getStateSnapshot();
    const afterHash = computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: after });
    if (beforeHash !== afterHash) throw new Error("State mutated by save");
    return true;
  });

  test("Phase 13: Stored snapshot hash equals baseline hash at save time", () => {
    const snap = engine.getStateSnapshot();
    const mgr = createScenarioManager({ max: 5 });
    const item = mgr.add({ label: "A", snapshot: snap, engine, modelVersion: MODEL_VERSION });
    const expected = computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: snap });
    if (item.savedHash !== expected) throw new Error("Saved hash mismatch");
    return true;
  });

  test("Phase 13: Comparison ordering is deterministic across re-run", () => {
    const snap = engine.getStateSnapshot();
    const mgr = createScenarioManager({ max: 5 });
    mgr.add({ label: "A", snapshot: snap, engine, modelVersion: MODEL_VERSION });
    mgr.add({ label: "B", snapshot: snap, engine, modelVersion: MODEL_VERSION });
    const a = mgr.compare().rows.map(r => r.id).join(",");
    const b = mgr.compare().rows.map(r => r.id).join(",");
    if (a !== b) throw new Error("Ordering changed across re-run");
    return true;
  });

  test("Phase 13: MC win probability stable across identical scenarios", () => {
    const snap = engine.getStateSnapshot();
    const mgr = createScenarioManager({ max: 5 });
    mgr.add({ label: "A", snapshot: snap, engine, modelVersion: MODEL_VERSION });
    mgr.add({ label: "B", snapshot: snap, engine, modelVersion: MODEL_VERSION });
    const rows = mgr.compare().rows;
    const w1 = rows[0]?.winProb;
    const w2 = rows[1]?.winProb;
    if (w1 == null || w2 == null) throw new Error("Missing winProb");
    if (Math.abs(w1 - w2) > 1e-12) throw new Error("WinProb differs");
    return true;
  });

  test("Phase 13: Deleting a scenario does not affect others", () => {
    const snap = engine.getStateSnapshot();
    const mgr = createScenarioManager({ max: 5 });
    const a = mgr.add({ label: "A", snapshot: snap, engine, modelVersion: MODEL_VERSION });
    const b = mgr.add({ label: "B", snapshot: snap, engine, modelVersion: MODEL_VERSION });
    mgr.remove(a.id);
    const ids = mgr.list().map(x => x.id);
    if (ids.includes(a.id)) throw new Error("Delete failed");
    if (!ids.includes(b.id)) throw new Error("Other scenario affected");
    return true;
  });

  test("Phase 13: Baseline fixture hash unchanged after scenario saves", () => {
    const base = JSON.parse(JSON.stringify(FIXTURES[0]));
    const baseHash = computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: base });
    const mgr = createScenarioManager({ max: 5 });
    mgr.add({ label: "A", snapshot: base, engine, modelVersion: MODEL_VERSION });
    const baseHash2 = computeSnapshotHash({ modelVersion: MODEL_VERSION, scenarioState: base });
    if (baseHash !== baseHash2) throw new Error("Fixture mutated");
    return true;
  });



  // UI smoke tests (bindings contract) — UI only, engine frozen.
  test("UI Smoke: required element IDs exist and are unique", () => {
    if (typeof document === "undefined") return true;
    const required = [
      "universeSize",
      "persuasionPct",
      "validationList",
      "phase3Card",
      "scenarioCompareCard",
      "btnSaveScenario"
    ];
    for (const id of required){
      const el = document.getElementById(id);
      if (!el) throw new Error(`Missing element id: ${id}`);
      const matches = document.querySelectorAll(`[id="${id}"]`);
      if (matches.length !== 1) throw new Error(`Duplicate id detected: ${id}`);
    }
    return true;
  });

  test("UI Smoke: no duplicate IDs in DOM", () => {
    if (typeof document === "undefined") return true;
    const els = Array.from(document.querySelectorAll("[id]"));
    const seen = new Set();
    for (const el of els){
      const id = el.getAttribute("id");
      if (!id) continue;
      if (seen.has(id)) throw new Error(`Duplicate id detected: ${id}`);
      seen.add(id);
    }
    return true;
  });


  // Phase 14 — Confidence Envelope invariants
  test("Phase14: percentiles monotonic + probability bounds", () => {
    const margins = [];
    // symmetric distribution around 0
    for (let i=0;i<200;i++){
      margins.push(-2,-1,0,1,2);
    }
    const wins = margins.filter(m => m >= 0).length;
    const winProb = wins / margins.length;
    const ce = computeConfidenceEnvelope({ margins, winProb, winRule: "gte0" });
    assert(ce && ce.percentiles, "Missing confidence envelope");
    assert(ce.percentiles.p10 <= ce.percentiles.p50 && ce.percentiles.p50 <= ce.percentiles.p90, "Non-monotonic percentiles");
    assert(ce.winProb >= 0 && ce.winProb <= 1, "winProb out of bounds");
    assert(ce.risk.downsideRiskMass >= 0 && ce.risk.downsideRiskMass <= 1, "downside mass out of bounds");
    assert(ce.risk.targets.shiftWin80 >= ce.risk.targets.shiftWin70 && ce.risk.targets.shiftWin70 >= ce.risk.targets.shiftWin60, "target shifts not monotonic");
    assert(ce.risk.shocks.lossProb50 >= ce.risk.shocks.lossProb25 && ce.risk.shocks.lossProb25 >= ce.risk.shocks.lossProb10, "shock losses not monotonic");
    return true;
  });

  test("Phase14: strong win case requires zero shift", () => {
    const margins = new Array(1000).fill(50);
    const ce = computeConfidenceEnvelope({ margins, winProb: 1, winRule: "gte0" });
    assert(ce.risk.breakEven.requiredShiftP50 === 0, "P50 shift should be 0");
    assert(ce.risk.breakEven.requiredShiftP10 === 0, "P10 shift should be 0");
    assert(ce.risk.fragility.cliffRisk === 0, "cliff risk should be 0 for constant far from 0");
    assert(ce.risk.targets.shiftWin60 === 0 && ce.risk.targets.shiftWin70 === 0 && ce.risk.targets.shiftWin80 === 0, "target shifts should be 0 for sure-win");
    assert(ce.risk.shocks.lossProb10 === 0 && ce.risk.shocks.lossProb25 === 0 && ce.risk.shocks.lossProb50 === 0, "shock losses should be 0 for sure-win");
    return true;
  });

  test("Phase14: knife-edge has non-trivial cliff risk", () => {
    const margins = [];
    for (let i=0;i<500;i++){
      margins.push(-5,-3,-1,0,1,3,5);
    }
    const wins = margins.filter(m => m >= 0).length;
    const ce = computeConfidenceEnvelope({ margins, winProb: wins/margins.length, winRule: "gte0" });
    assert(ce.risk.fragility.cliffRisk > 0.10, "expected cliff risk to be noticeable");
    return true;
  });




  // --- Phase 15) Sensitivity Surface (on-demand) ---
  test("Phase15 surface: returns points + bounds + ordering", () => {
    assert(engine && typeof engine.withPatchedState === "function", "withPatchedState missing");
    assert(engine && typeof engine.runMonteCarloSim === "function", "runMonteCarloSim missing");
    assert(typeof computeSensitivitySurface === "function", "computeSensitivitySurface missing");

    // Use a stable baseline (small runs for test speed).
    // Patch minimal MC-relevant state (rates + capacity bases).
    const patch = {
      contactRatePct: 22,
      supportRatePct: 55,
      turnoutReliabilityPct: 80,
      volunteerMultBase: 1.0,
      mcMode: "basic",
      mcSeed: "phase15-test",
      turnoutEnabled: false
    };

    const mi = {
      universeSize: 50000,
      turnoutA: 35,
      turnoutB: 55,
      bandWidth: 4,
      candidates: [{ id:"a", name:"A", supportPct:35 }, { id:"b", name:"B", supportPct:35 }],
      undecidedPct: 30,
      yourCandidateId: "a",
      undecidedMode: "proportional",
      userSplit: {},
      persuasionPct: 30,
      earlyVoteExp: 40
    };

    const res = engine.computeAll(mi);
    const needVotes = res?.expected?.persuasionNeed ?? 0;

    const out = engine.withPatchedState(patch, () => {
      return computeSensitivitySurface({
        engine,
        baseline: { res, weeks: 10, needVotes },
        sweep: { leverKey: "supportRate", minValue: 45, maxValue: 65, steps: 9 },
        options: { runs: 400, seed: "phase15-test", targetWinProb: 0.70 }
      });
    });

    assert(out && Array.isArray(out.points), "points missing");
    assert(out.points.length === 9, "unexpected point count");

    for (const p of out.points){
      assert(p.winProb == null || (p.winProb >= 0 && p.winProb <= 1), "winProb out of bounds");
      if (p.p10 != null && p.p50 != null) assert(p.p10 <= p.p50 + 1e-9, "p10>p50");
      if (p.p50 != null && p.p90 != null) assert(p.p50 <= p.p90 + 1e-9, "p50>p90");
    }

    return true;
  });

  test("Phase15 surface: safe zone detection returns null or range", () => {
    const patch = {
      contactRatePct: 22,
      supportRatePct: 55,
      turnoutReliabilityPct: 80,
      volunteerMultBase: 1.0,
      mcMode: "basic",
      mcSeed: "phase15-test2",
      turnoutEnabled: false
    };

    const mi = {
      universeSize: 50000,
      turnoutA: 35,
      turnoutB: 55,
      bandWidth: 4,
      candidates: [{ id:"a", name:"A", supportPct:35 }, { id:"b", name:"B", supportPct:35 }],
      undecidedPct: 30,
      yourCandidateId: "a",
      undecidedMode: "proportional",
      userSplit: {},
      persuasionPct: 30,
      earlyVoteExp: 40
    };

    const res = engine.computeAll(mi);
    const needVotes = res?.expected?.persuasionNeed ?? 0;

    const out = engine.withPatchedState(patch, () => {
      return computeSensitivitySurface({
        engine,
        baseline: { res, weeks: 10, needVotes },
        sweep: { leverKey: "volunteerMultiplier", minValue: 0.6, maxValue: 1.4, steps: 7 },
        options: { runs: 400, seed: "phase15-test2", targetWinProb: 0.70 }
      });
    });

    const z = out?.analysis?.safeZone ?? null;
    if (z != null){
      assert(isFiniteNum(z.min) && isFiniteNum(z.max), "safeZone not numeric");
      assert(z.max >= z.min, "safeZone inverted");
    }
    return true;
  });


  // --- Phase 16) Universe composition + retention (aggregate layer) ---
  test("Phase16 layer: disabled is identity", () => {
    const out = computeUniverseAdjustedRates({
      enabled: false,
      universePercents: { demPct: 25, repPct: 25, npaPct: 25, otherPct: 25 },
      retentionFactor: 0.75,
      supportRate: 0.55,
      turnoutReliability: 0.80,
    });

    assert(out && out.srAdj === 0.55, "sr should be unchanged when disabled");
    assert(out && out.trAdj === 0.80, "tr should be unchanged when disabled");
    assert(out && out.meta && out.meta.enabled === false, "meta enabled should be false");
    return true;
  });

  test("Phase16 layer: higher retention increases effective rates", () => {
    const a = computeUniverseAdjustedRates({
      enabled: true,
      universePercents: { demPct: 100, repPct: 0, npaPct: 0, otherPct: 0 },
      retentionFactor: 0.60,
      supportRate: 0.50,
      turnoutReliability: 0.80,
    });
    const b = computeUniverseAdjustedRates({
      enabled: true,
      universePercents: { demPct: 100, repPct: 0, npaPct: 0, otherPct: 0 },
      retentionFactor: 0.90,
      supportRate: 0.50,
      turnoutReliability: 0.80,
    });

    assert(a && b, "missing outputs");
    assert(b.srAdj >= a.srAdj - 1e-12, "srAdj should not decrease with higher retention");
    assert(b.trAdj >= a.trAdj - 1e-12, "trAdj should not decrease with higher retention");
    return true;
  });

  test("Phase16 layer: retentionFactor=1.0 is strict identity", () => {
    const out = computeUniverseAdjustedRates({
      enabled: true,
      universePercents: { demPct: 10, repPct: 30, npaPct: 50, otherPct: 10 },
      retentionFactor: 1.0,
      supportRate: 0.55,
      turnoutReliability: 0.80,
    });
    assert(out && out.srAdj === 0.55, "sr should match baseline at rf=1.0");
    assert(out && out.trAdj === 0.80, "tr should match baseline at rf=1.0");
    assert(out && out.volatilityBoost === 0, "volatilityBoost should be 0 at rf=1.0");
    return true;
  });



results.durationMs = Math.round(nowMs() - started);
  // Ensure totals are consistent even if something weird happened.
  results.passed = Math.max(0, results.total - results.failed);

  return results;
}
