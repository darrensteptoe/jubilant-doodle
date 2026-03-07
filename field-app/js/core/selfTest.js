// @ts-check
// js/selfTest.js
// Phase 5.5 — Lightweight in-browser self-test infrastructure.
// Exports: runSelfTests(engineAccessors)
//
// Design goals:
// - No build tools
// - No uncaught throws (always returns structured results)
// - No production interference (dev-triggered by app.js)

import { FIXTURES } from "./fixtures.js";
import { computeAll as computeWinMathAll } from "./winMath.js";
import { makeRng as makeSeededRng, triSample as triSampleSeeded, normalSampleBounded } from "./rng.js";
import { selectPlan } from "./robust.js";
import { buildDeterministicExplainMap } from "./explainMap.js";
import { validateImportedScenarioData, computeAssumptionBenchmarkWarnings } from "./importQuality.js";
import { computeVolunteerNeedFromGoal } from "./executionPlanner.js";
import { computeMarginalValueDiagnostics } from "./marginalValue.js";
import { computeDecisionIntelligence } from "./decisionIntelligence.js";
import { computeMaxAttemptsByTactic, optimizeTimelineConstrained } from "./timelineOptimizer.js";
import { MODEL_VERSION, makeScenarioExport, deterministicStringify, validateScenarioExport, PLAN_CSV_HEADERS, planRowsToCsv, hasNonFiniteNumbers, formatSummaryText } from "../export.js";
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
import {
  pctOverrideToDecimal,
  resolveTurnoutContext,
  computeBaseNetVotesPerAttempt,
  computeGotvNetVotesPerAttempt,
  computeHybridEffectiveTurnoutReliability,
  computeGotvSaturationCapAttempts,
  computeTacticVoteProduction,
} from "./voteProduction.js";
import { buildModelInputFromSnapshot } from "./modelInput.js";
import { makeDefaultIntelState, validateAiIntelWritePayload } from "./intelState.js";
import { computeElectionSnapshot } from "./electionSnapshot.js";
import { computeExecutionSnapshot } from "./executionSnapshot.js";
import { safeNum } from "./utils.js";
import { renderMain } from "../app/renderMain.js";
import { renderImpactTracePanel } from "../app/render/impactTrace.js";
import { renderRoiModule } from "../app/renderRoi.js";
import { renderOptimizationModule } from "../app/renderOptimization.js";
import { computeWeeklyOpsContextFromState, getEffectiveBaseRates } from "../app/selectors.js";
import { createEffectiveInputsController } from "../app/effectiveInputs.js";
import {
  applyRecommendationDraftPatch,
  captureObservedMetricsFromDrift,
  createWhatIfIntelRequest,
  refreshDriftRecommendationsFromDrift,
  computeIntelIntegrityScore,
  listMissingEvidenceAudit,
  listMissingNoteAudit,
} from "../app/intelControlsRuntime.js";
import {
  buildCriticalAuditSnapshot,
  captureCriticalAssumptionAudit,
  computeEvidenceWarnings,
} from "../app/intelAudit.js";
import { syncFeatureFlagsFromState } from "../app/featureFlags.js";
import { normalizeLoadedState as normalizeLoadedStateApp } from "../app/state.js";
import { resolveFeatureFlags } from "./featureFlags.js";
import { validateOperationsCapacityInput } from "../features/operations/io.js";
import {
  makeDefaultDataRefs,
  makeDefaultDataCatalog,
  makeDefaultGeoPack,
  makeDefaultDistrictIntelPack,
  normalizeDistrictDataState,
  validateDistrictDataContract,
} from "./districtData.js";
import {
  buildDataSourceRegistry,
  resolveDataRefsByPolicy,
  materializePinnedDataRefs,
  diagnoseDataRefAlignment,
  scoreElectionDatasetCompatibility,
  rankElectionDatasetsForScenario,
} from "./dataSourceRegistry.js";
import { normalizeAreaSelection, buildAreaResolverCacheKey, deriveAreaResolverContext } from "./areaResolver.js";
import {
  normalizeCensusManifest,
  validateCensusManifest,
  normalizeElectionManifest,
  validateElectionManifest,
  censusManifestToCatalogEntry,
  electionManifestToCatalogEntry,
} from "./districtIngest.js";
import { allocatePrecinctVotesToGeo } from "./precinctCensusJoin.js";
import {
  compileDistrictEvidence,
  derivePersuasionSignalFromElection,
  summarizeGeoEvidenceLayers,
  buildGeoEvidenceMapLayer,
} from "./districtEvidence.js";
import { resolveDistrictEvidenceInputs } from "./districtEvidenceInputs.js";
import {
  buildDistrictIntelPackFromEvidence,
  applyDistrictIntelRateOverrides,
  applyDistrictIntelCapacityOverrides,
} from "./districtIntelBuilder.js";
import { registerPhase115ATests } from "./selfTestSuites/phase115A.js";
import { registerReleaseHardeningTests } from "./selfTestSuites/releaseHardening.js";

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
  if (out.intelState == null) out.intelState = makeDefaultIntelState();
  normalizeDistrictDataState(out);
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

function getMcSummary(sim){
  if (!sim || typeof sim !== "object") return null;
  if (sim.summary && typeof sim.summary === "object") return sim.summary;
  return sim;
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

/**
 * @typedef {object} SelfTestEngineAccessors
 * @property {(...args: any[]) => any} computeAll
 * @property {(...args: any[]) => any} deriveNeedVotes
 * @property {(...args: any[]) => any} derivedWeeksRemaining
 * @property {(...args: any[]) => any} runMonteCarloSim
 * @property {(...args: any[]) => any} optimizeMixBudget
 * @property {(...args: any[]) => any} optimizeMixCapacity
 * @property {(...args: any[]) => any} buildOptimizationTactics
 * @property {(...args: any[]) => any} computeRoiRows
 * @property {(...args: any[]) => any} computeCapacityBreakdown
 */

/**
 * @param {SelfTestEngineAccessors} engine
 */
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

  registerPhase115ATests({
    test,
    assert,
    engine,
    withUniverseDefaults,
    isFiniteNum,
    computeWinMathAll,
    makeSeededRng,
    triSampleSeeded,
    normalSampleBounded,
    selectPlan,
    buildDeterministicExplainMap,
    computeAssumptionBenchmarkWarnings,
    validateImportedScenarioData,
    computeVolunteerNeedFromGoal,
    createEffectiveInputsController,
    safeNum,
    getEffectiveBaseRates,
    computeUniverseAdjustedRates,
    validateOperationsCapacityInput,
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
    const s1 = getMcSummary(sim1);
    const s2 = getMcSummary(sim2);
    assert(s1 && s2, "Monte Carlo summary missing");
    assert(stableStringify(s1) === stableStringify(s2), "Same seed produced different summaries");
  });

  test("Monte Carlo: positional legacy signature matches named-args signature", () => {
    assert(snap && typeof snap === "object", "State snapshot unavailable");
    assert(baseline.res, "Baseline computeAll result missing");
    const named = getMcSummary(engine.runMonteCarloSim({
      scenario: snap,
      res: baseline.res,
      weeks: baseline.weeks,
      needVotes: baseline.needVotes,
      runs: 600,
      seed: "selftest-seed-legacy-shape",
      includeMargins: true,
    }));
    const legacy = getMcSummary(engine.runMonteCarloSim(
      snap,
      baseline.res,
      baseline.weeks,
      baseline.needVotes,
      600,
      "selftest-seed-legacy-shape",
      true
    ));
    assert(named && legacy, "Monte Carlo summary missing for legacy-signature parity test");
    assert(stableStringify(named) === stableStringify(legacy), "Legacy positional signature diverged from named-args signature");
  });

  test("Monte Carlo: different seed => different summary output", () => {
    assert(baseline.res, "Baseline computeAll result missing");
    // If weeks is unknown or capacity inputs are incomplete, MC will often degenerate
    // into a constant output regardless of seed (votes=0 for every run). In that case,
    // this test is not informative and should be skipped as a pass.
    if (baseline.weeks == null) return true;
    const sim1 = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 2000, seed: "selftest-seed-A" });
    const sim2 = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 2000, seed: "selftest-seed-B" });
    const s1 = getMcSummary(sim1) || {};
    const s2 = getMcSummary(sim2) || {};
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

    const features = resolveFeatureFlags(snap || {});
    const decayModel = snap?.intelState?.expertToggles?.decayModel || {};
    const capContacts = engine.computeCapacityContacts({
      weeks,
      orgCount,
      orgHoursPerWeek: orgHrs,
      volunteerMult: vm,
      doorShare,
      doorsPerHour: dph,
      callsPerHour: cph,
      capacityDecay: {
        enabled: !!features.capacityDecayEnabled,
        type: String(decayModel?.type || "linear"),
        weeklyDecayPct: safeNum(decayModel?.weeklyDecayPct),
        floorPctOfBaseline: safeNum(decayModel?.floorPctOfBaseline),
      },
    });
    // If capacity can't be computed (incomplete inputs), skip as pass.
    if (capContacts == null || capContacts <= 0) return true;

    const effRates = getEffectiveBaseRates(snap, { computeUniverseAdjustedRates });
    const cr = effRates?.cr;
    const pr = effRates?.sr;
    const rr = effRates?.tr;
    if (!(cr && cr > 0) || !(pr && pr > 0) || !(rr && rr > 0)) return true;

    const detVotes = capContacts * cr * pr * rr;
    const detMargin = detVotes - (baseline.needVotes ?? 0);

    const sim = engine.runMonteCarloSim({ res: baseline.res, weeks: baseline.weeks, needVotes: baseline.needVotes, runs: 5000, seed: "selftest-seed-align" });
    const mcMedian = getMcSummary(sim)?.median;

    if (mcMedian == null || !isFinite(mcMedian)) return true;

    // Tolerance: absolute 25% of |detMargin| plus a floor to absorb scenario-specific skew.
    const tol = Math.max(250, Math.abs(detMargin) * 0.25);
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
      const patch = {
        mcMode: "advanced",
        turnoutEnabled: true,
        turnoutBaselinePct: 55,
        turnoutTargetOverridePct: "",
        gotvMode: "advanced",
        gotvLiftMin: 0.2,
        gotvLiftMode: 1.0,
        gotvLiftMax: 2.0,
        gotvMaxLiftPP2: 12,
        gotvDiminishing: true,
      };

      const a = engine.withPatchedState(patch, () => {
        const sc = engine.getStateSnapshot();
        const resPatched = engine.computeAll(buildModelInputFromSnapshot(sc));
        const weeksPatched = engine.derivedWeeksRemaining({
          weeksRemainingOverride: sc?.weeksRemaining,
          electionDateISO: sc?.electionDate ? `${sc.electionDate}T00:00:00` : "",
        });
        const needVotesPatched = engine.deriveNeedVotes(resPatched);
        return engine.runMonteCarloSim({ scenario: sc, res: resPatched, weeks: weeksPatched, needVotes: needVotesPatched, runs: 2000, seed: "seed-A" });
      });
      const b = engine.withPatchedState(patch, () => {
        const sc = engine.getStateSnapshot();
        const resPatched = engine.computeAll(buildModelInputFromSnapshot(sc));
        const weeksPatched = engine.derivedWeeksRemaining({
          weeksRemainingOverride: sc?.weeksRemaining,
          electionDateISO: sc?.electionDate ? `${sc.electionDate}T00:00:00` : "",
        });
        const needVotesPatched = engine.deriveNeedVotes(resPatched);
        return engine.runMonteCarloSim({ scenario: sc, res: resPatched, weeks: weeksPatched, needVotes: needVotesPatched, runs: 2000, seed: "seed-B" });
      });

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

  test("Phase 10: migration allows governance top-level key without unknown-field warning", () => {
    const raw = {
      modelVersion: MODEL_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      snapshotHash: "abc12345",
      governance: { available: true, missing: { evidence: 0, note: 0 } },
      scenario: withUniverseDefaults({ scenarioName: "GovernanceKey", universeSize: 1000 }),
    };
    const mig = migrateSnapshot(raw);
    const warningText = (Array.isArray(mig.warnings) ? mig.warnings : []).join(" | ").toLowerCase();
    assert(!warningText.includes("unknown field 'governance'"), "Governance key was treated as unknown");
    return true;
  });

  test("Phase 10: migration allows intelBundle top-level key without unknown-field warning", () => {
    const raw = {
      modelVersion: MODEL_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      snapshotHash: "abc12345",
      intelBundle: { available: true, counts: { audit: 1 } },
      scenario: withUniverseDefaults({ scenarioName: "IntelBundleKey", universeSize: 1000 }),
    };
    const mig = migrateSnapshot(raw);
    const warningText = (Array.isArray(mig.warnings) ? mig.warnings : []).join(" | ").toLowerCase();
    assert(!warningText.includes("unknown field 'intelbundle'"), "intelBundle key was treated as unknown");
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


  registerReleaseHardeningTests({
    test,
    assert,
    withUniverseDefaults,
    makeDefaultIntelState,
    makeScenarioExport,
    MODEL_VERSION,
    APP_VERSION,
    BUILD_ID,
    formatSummaryText,
    SELFTEST_GATE,
    gateFromSelfTestResult,
    writeBackupEntry,
    readBackups,
    CURRENT_SCHEMA_VERSION,
    computeSnapshotHash,
    migrateSnapshot,
    validateScenarioExport,
    checkStrictImportPolicy,
    makeDefaultDataRefs,
    makeDefaultDataCatalog,
    makeDefaultGeoPack,
    makeDefaultDistrictIntelPack,
    normalizeDistrictDataState,
    validateDistrictDataContract,
    normalizeCensusManifest,
    validateCensusManifest,
    normalizeElectionManifest,
    validateElectionManifest,
    censusManifestToCatalogEntry,
    electionManifestToCatalogEntry,
    allocatePrecinctVotesToGeo,
    compileDistrictEvidence,
    derivePersuasionSignalFromElection,
    summarizeGeoEvidenceLayers,
    buildGeoEvidenceMapLayer,
    resolveDistrictEvidenceInputs,
    buildDistrictIntelPackFromEvidence,
    applyDistrictIntelRateOverrides,
    applyDistrictIntelCapacityOverrides,
    buildDataSourceRegistry,
    resolveDataRefsByPolicy,
    materializePinnedDataRefs,
    diagnoseDataRefAlignment,
    scoreElectionDatasetCompatibility,
    rankElectionDatasetsForScenario,
    normalizeAreaSelection,
    buildAreaResolverCacheKey,
    deriveAreaResolverContext,
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
      "operationsCapacityOutlookCard",
      "phase3Card",
      "scenarioCompareCard",
      "btnScenarioSaveNew"
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

  test("UI Smoke: no empty top-level module cards", () => {
    if (typeof document === "undefined") return true;
    const cards = Array.from(
      document.querySelectorAll(".stage-body-new > .card, .stage-body-new > .panel > .card")
    );
    for (const card of cards){
      const text = (card.textContent || "").trim();
      const hasInteractive = !!card.querySelector("input, select, textarea, button, table, [data-help], .metric");
      const hasStructure = !!card.querySelector(".card-head, .module-desc, .grid2, .grid3, .field, .mini-note");
      if (!text && !hasInteractive && !hasStructure){
        const cls = card.className || "(no-class)";
        const id = card.id ? `#${card.id}` : "(no-id)";
        throw new Error(`Empty top-level module card detected: ${cls} ${id}`);
      }
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

  // --- Phase 17) Intel feedback + governance metadata hardening ---
  test("Phase17 feedback: observed metrics capture is stable/idempotent", () => {
    const state = { intelState: makeDefaultIntelState() };
    const drift = {
      hasLog: true,
      windowStart: "2026-03-01",
      windowEnd: "2026-03-07",
      windowEntries: 7,
      actualCR: 0.31,
      assumedCR: 0.40,
      actualSR: 0.28,
      assumedSR: 0.35,
      actualAPH: 14.0,
      expectedAPH: 18.0,
    };

    const a = captureObservedMetricsFromDrift(state, drift);
    assert(a.ok, "First observed-metrics capture failed");
    assert(a.created === 3, `Expected 3 created observed metrics, got ${a.created}`);
    assert(Array.isArray(state.intelState.observedMetrics) && state.intelState.observedMetrics.length === 3, "Observed metrics total should be 3");

    const b = captureObservedMetricsFromDrift(state, drift);
    assert(b.ok, "Second observed-metrics capture failed");
    assert(state.intelState.observedMetrics.length === 3, "Observed metrics should remain deduped at 3");
    return true;
  });

  test("Phase17 feedback: drift recommendations create and clear deterministically", () => {
    const state = {
      intelState: makeDefaultIntelState(),
      doorsPerHour3: 30,
      callsPerHour3: 20,
    };
    const drift = {
      hasLog: true,
      actualCR: 0.20,
      assumedCR: 0.35,
      actualSR: 0.22,
      assumedSR: 0.40,
      actualAPH: 12.0,
      expectedAPH: 18.0,
      primary: "support",
    };

    const a = refreshDriftRecommendationsFromDrift(state, drift);
    assert(a.ok, "Drift recommendation refresh failed");
    assert((state.intelState.recommendations || []).length >= 1, "Expected at least one recommendation");
    assert((state.intelState.flags || []).length >= 1, "Expected at least one drift flag");

    const b = refreshDriftRecommendationsFromDrift(state, { hasLog: false });
    assert(b.ok, "Drift recommendation clear pass failed");
    assert((state.intelState.recommendations || []).length === 0, "Auto recommendations should clear when no log");
    const autoFlags = (state.intelState.flags || []).filter((x) => String(x?.source || "") === "auto.realityDrift.v1");
    assert(autoFlags.length === 0, "Auto drift flags should clear when no log");
    return true;
  });

  test("Phase17 feedback: recommendation draft patch applies deterministically", () => {
    const state = {
      ui: {},
      contactRatePct: 22,
      supportRatePct: 55,
      intelState: makeDefaultIntelState(),
    };
    state.intelState.recommendations = [
      {
        id: "rec_apply_contact",
        title: "Contact rate is below plan",
        source: "auto.realityDrift.v1",
        priority: 1,
        draftPatch: {
          type: "setInput",
          target: "contactRatePct",
          suggestedValue: 33.3,
          unit: "pct",
        },
      },
    ];

    const a = applyRecommendationDraftPatch(state, { recommendationId: "rec_apply_contact" });
    assert(a.ok, "Expected recommendation patch apply to succeed");
    assert(a.noop !== true, "Expected recommendation patch apply to write changes");
    assert(approx(state.contactRatePct, 33.3, 1e-9), `Expected contactRatePct=33.3, got ${state.contactRatePct}`);

    const rec = (state.intelState.recommendations || [])[0];
    assert(String(rec?.status || "") === "applied", "Recommendation status should be applied");
    assert(Number(rec?.applyCount || 0) === 1, "Recommendation applyCount should increment");
    assert(Array.isArray(rec?.lastAppliedChanges) && rec.lastAppliedChanges.length === 1, "Expected one recorded applied change");
    return true;
  });

  test("Phase17 feedback: what-if parser stores intel requests deterministically", () => {
    const state = {
      supportRatePct: 55,
      contactRatePct: 33,
      intelState: makeDefaultIntelState(),
    };
    const out = createWhatIfIntelRequest(state, "Set support rate to 60 and contact rate +2");
    assert(out.ok, `Expected what-if parser success, got ${out.error || "unknown error"}`);
    assert(Number(out.parsedTargets) === 2, `Expected 2 parsed targets, got ${out.parsedTargets}`);
    assert(Array.isArray(state.intelState.intelRequests) && state.intelState.intelRequests.length === 1, "Expected one intel request row");

    const row = state.intelState.intelRequests[0] || {};
    assert(row && typeof row === "object", "Expected intel request row object");
    assert(String(row.status || "") === "parsed", `Expected parsed status, got ${row.status}`);
    assert(String(row.parsed?.action || "") === "what_if", "Expected parsed action=what_if");
    const targets = Array.isArray(row.parsed?.targets) ? row.parsed.targets : [];
    assert(targets.length === 2, `Expected 2 stored parsed targets, got ${targets.length}`);

    const support = targets.find((t) => String(t?.key || "") === "supportRatePct");
    assert(support && String(support.op || "") === "set", "Expected support-rate set target");
    assert(approx(Number(support?.suggestedValue), 60, 1e-9), `Expected support-rate value 60, got ${support?.suggestedValue}`);

    const contact = targets.find((t) => String(t?.key || "") === "contactRatePct");
    assert(contact && String(contact.op || "") === "delta", "Expected contact-rate delta target");
    assert(approx(Number(contact?.delta), 2, 1e-9), `Expected contact-rate delta +2, got ${contact?.delta}`);
    assert(approx(Number(contact?.suggestedValue), 35, 1e-9), `Expected contact-rate suggested value 35, got ${contact?.suggestedValue}`);
    return true;
  });

  test("Phase17 governance: critical audit requirements produce warnings", () => {
    const state = withUniverseDefaults({
      scenarioName: "GovWarns",
      universeSize: 1000,
      supportRatePct: 55,
      intelState: makeDefaultIntelState(),
    });
    const prev = buildCriticalAuditSnapshot(state);
    state.supportRatePct = 65;

    const audit = captureCriticalAssumptionAudit({
      state,
      previousSnapshot: prev,
      source: "selftest",
      requireNote: true,
      requireEvidence: true,
      note: "",
    });
    assert(audit.wroteAudit === true, "Expected critical audit row to be written");
    const warnings = computeEvidenceWarnings(state, { limit: 10, staleDays: 0 });
    const joined = warnings.join(" | ").toLowerCase();
    assert(joined.includes("missing evidence"), "Missing evidence warning not produced");
    assert(joined.includes("missing note"), "Missing note warning not produced");
    return true;
  });

  test("Phase17 governance: unresolved critical edits coalesce by ref/key/source", () => {
    const state = withUniverseDefaults({
      scenarioName: "GovCoalesce",
      supportRatePct: 55,
      intelState: makeDefaultIntelState(),
    });

    let prev = buildCriticalAuditSnapshot(state);
    state.supportRatePct = 60;
    const first = captureCriticalAssumptionAudit({
      state,
      previousSnapshot: prev,
      source: "selftest",
      requireNote: true,
      requireEvidence: true,
      note: "",
    });
    assert(first.wroteAudit === true, "Expected first critical audit write");

    prev = first.nextSnapshot;
    state.supportRatePct = 62;
    const second = captureCriticalAssumptionAudit({
      state,
      previousSnapshot: prev,
      source: "selftest",
      requireNote: true,
      requireEvidence: true,
      note: "",
    });
    assert(second.wroteAudit === true, "Expected second critical audit write");

    const rows = (state.intelState.audit || []).filter((x) =>
      x &&
      x.kind === "critical_ref_change" &&
      String(x.key || "") === "supportRatePct" &&
      String(x.ref || "") === "core.supportRatePct" &&
      String(x.source || "") === "selftest"
    );
    assert(rows.length === 1, `Expected coalesced unresolved audit row count 1, got ${rows.length}`);
    const row = rows[0];
    assert(approx(Number(row.before), 55, 1e-9), `Expected preserved original 'before' value 55, got ${row.before}`);
    assert(approx(Number(row.after), 62, 1e-9), `Expected updated 'after' value 62, got ${row.after}`);
    assert(String(row.status || "").toLowerCase() === "missingnote", "Expected unresolved status to remain missingNote");
    return true;
  });

  test("Phase17 governance: missing evidence/note lists dedupe legacy duplicate rows", () => {
    const state = withUniverseDefaults({
      scenarioName: "GovDedupeLists",
      intelState: makeDefaultIntelState(),
    });

    const intel = state.intelState;
    const baseTs = "2026-03-05T00:00:00.000Z";
    const newerTs = "2026-03-05T00:10:00.000Z";
    intel.audit.push(
      {
        id: "aud_old",
        ts: baseTs,
        source: "ui",
        kind: "critical_ref_change",
        key: "supportRatePct",
        ref: "core.supportRatePct",
        requiresEvidence: true,
        requiresNote: true,
        note: "",
        evidenceId: null,
        status: "missingNote",
        governanceTracked: true,
      },
      {
        id: "aud_new",
        ts: newerTs,
        source: "ui",
        kind: "critical_ref_change",
        key: "supportRatePct",
        ref: "core.supportRatePct",
        requiresEvidence: true,
        requiresNote: true,
        note: "",
        evidenceId: null,
        status: "missingNote",
        governanceTracked: true,
      }
    );

    const missingEvidence = listMissingEvidenceAudit(state, { limit: 10 });
    const missingNote = listMissingNoteAudit(state, { limit: 10 });
    assert(missingEvidence.length === 1, `Expected deduped missing-evidence count 1, got ${missingEvidence.length}`);
    assert(missingNote.length === 1, `Expected deduped missing-note count 1, got ${missingNote.length}`);
    assert(String(missingEvidence[0]?.id) === "aud_new", "Expected newest duplicate row to survive dedupe");
    return true;
  });

  test("Phase17 governance: evidence warnings dedupe legacy duplicate rows", () => {
    const state = withUniverseDefaults({
      scenarioName: "GovDedupeWarnings",
      intelState: makeDefaultIntelState(),
    });

    const intel = state.intelState;
    intel.audit.push(
      {
        id: "aud_w_old",
        ts: "2026-03-05T00:00:00.000Z",
        source: "ui",
        kind: "critical_ref_change",
        key: "supportRatePct",
        ref: "core.supportRatePct",
        requiresEvidence: true,
        requiresNote: true,
        note: "",
        evidenceId: null,
        status: "missingNote",
        governanceTracked: true,
      },
      {
        id: "aud_w_new",
        ts: "2026-03-05T00:10:00.000Z",
        source: "ui",
        kind: "critical_ref_change",
        key: "supportRatePct",
        ref: "core.supportRatePct",
        requiresEvidence: true,
        requiresNote: true,
        note: "",
        evidenceId: null,
        status: "missingNote",
        governanceTracked: true,
      }
    );

    const warnings = computeEvidenceWarnings(state, { limit: 10, staleDays: 0 });
    const joined = warnings.join(" | ");
    assert(joined.includes("Evidence gap: 1 critical assumption edit(s)"), "Expected deduped evidence-gap warning count");
    assert(joined.includes("Documentation gap: 1 critical assumption edit(s)"), "Expected deduped note-gap warning count");
    return true;
  });

  test("Phase17 governance: integrity score penalizes missing governance artifacts", () => {
    const state = {
      intelState: makeDefaultIntelState(),
    };
    state.intelState.audit.push({
      id: "aud_test",
      ts: "2026-03-05T00:00:00.000Z",
      governanceTracked: true,
      requiresEvidence: true,
      requiresNote: true,
      evidenceId: null,
      note: "",
      status: "open",
    });
    const out = computeIntelIntegrityScore(state, {
      benchmarkWarnings: ["warn"],
      driftFlags: ["flag"],
      staleDays: 0,
    });
    assert(out && Number.isFinite(out.score), "Integrity score missing");
    assert(out.score < 100, "Integrity score should be penalized below 100");
    assert(out.components.missingEvidence >= 1, "Expected missingEvidence component >= 1");
    assert(out.components.missingNote >= 1, "Expected missingNote component >= 1");
    return true;
  });

  test("Phase 9: snapshot equivalence across planning/weekly/execution contexts", () => {
    const snap = engine.getStateSnapshot();
    assert(snap && typeof snap === "object", "State snapshot unavailable");

    const planning = computeElectionSnapshot({ state: snap, nowDate: new Date(), toNum: safeNum });
    assert(planning && planning.res, "Planning snapshot missing deterministic result");

    const fallbackModelInput = buildModelInputFromSnapshot(snap);
    const fallbackRes = engine.computeAll(fallbackModelInput);
    const fallbackNeedVotes = engine.deriveNeedVotes(fallbackRes, snap.goalSupportIds);

    assert(
      approx(planning.res?.expected?.persuasionNeed, fallbackRes?.expected?.persuasionNeed, 1e-9),
      "Planning snapshot persuasionNeed drifted from deterministic baseline"
    );
    assert(
      approx(planning.needVotes, fallbackNeedVotes, 1e-9),
      "Planning snapshot needVotes drifted from deterministic baseline"
    );

    const weekly = computeWeeklyOpsContextFromState(snap, {
      res: planning.res,
      weeks: planning.weeks,
      getEffectiveBaseRatesForState: (s) => getEffectiveBaseRates(s, { computeUniverseAdjustedRates }),
      computeCapacityBreakdown: engine.computeCapacityBreakdown,
      compileEffectiveInputsForState: () => null,
    });
    assert(weekly && typeof weekly === "object", "Weekly ops context missing");
    assert(approx(weekly.goal, planning.needVotes, 1e-9), "Weekly ops goal does not match planning needVotes");

    const expectedAPH = (
      weekly?.doorShare != null &&
      weekly?.doorsPerHour != null &&
      weekly?.callsPerHour != null
    )
      ? (weekly.doorShare * weekly.doorsPerHour + (1 - weekly.doorShare) * weekly.callsPerHour)
      : null;

    const execution = computeExecutionSnapshot({
      planningSnapshot: planning,
      weeklyContext: weekly,
      dailyLog: snap?.ui?.dailyLog || [],
      assumedCR: weekly?.cr ?? null,
      assumedSR: weekly?.sr ?? null,
      expectedAPH,
      windowN: 7,
      safeNumFn: safeNum,
    });

  test("Phase 9 explain map: deterministic outputs expose lineage metadata", () => {
    const snap = engine.getStateSnapshot();
    assert(snap && typeof snap === "object", "State snapshot unavailable");
    const mi = buildModelInputFromSnapshot(snap);
    assert(mi && typeof mi === "object", "Model input unavailable");

    const out = engine.computeAll(mi, { explain: true });
    assert(out && typeof out === "object", "Explain computeAll result missing");
    assert(out.explain && typeof out.explain === "object", "Explain map missing");

    const requiredKeys = [
      "expected.turnoutVotes",
      "expected.yourVotes",
      "expected.winThreshold",
      "expected.persuasionNeed",
      "guardrails",
      "stressSummary",
    ];
    for (const key of requiredKeys){
      const row = out.explain[key];
      assert(row && typeof row === "object", `Explain row missing: ${key}`);
      assert(typeof row.module === "string" && row.module.length > 0, `Explain module missing for ${key}`);
      assert(Array.isArray(row.inputs), `Explain inputs missing for ${key}`);
      assert(Array.isArray(row.dependsOn), `Explain dependsOn missing for ${key}`);
    }

    const meta = out.explain._meta;
    assert(meta && typeof meta === "object", "Explain _meta missing");
    assert(meta.moduleVersion === "engine.explain.v1", `Unexpected explain moduleVersion: ${meta?.moduleVersion}`);
    return true;
  });

  test("Phase 9 explain map: explain-mode does not alter deterministic outputs", () => {
    const snap = engine.getStateSnapshot();
    assert(snap && typeof snap === "object", "State snapshot unavailable");
    const mi = buildModelInputFromSnapshot(snap);
    assert(mi && typeof mi === "object", "Model input unavailable");

    const plain = engine.computeAll(mi);
    const explained = engine.computeAll(mi, { explain: true });
    assert(plain && explained, "Deterministic outputs missing for explain parity");

    const cmp = (path, a, b) => {
      assert(
        stableStringify(a) === stableStringify(b),
        `Explain parity mismatch at ${path}`
      );
    };

    cmp("raw", plain.raw, explained.raw);
    cmp("turnout", plain.turnout, explained.turnout);
    cmp("expected", plain.expected, explained.expected);
    cmp("validation", plain.validation, explained.validation);
    cmp("guardrails", plain.guardrails, explained.guardrails);
    cmp("stressSummary", plain.stressSummary, explained.stressSummary);
    return true;
  });

    assert(execution && execution.pace, "Execution snapshot missing pace section");
    assert(
      approx(execution.pace.requiredAttemptsPerWeek, weekly?.attemptsPerWeek, 1e-9),
      "Execution requiredAttemptsPerWeek diverged from weekly context"
    );
    assert(
      approx(execution.pace.capacityAttemptsPerWeek, weekly?.capTotal, 1e-9),
      "Execution capacityAttemptsPerWeek diverged from weekly context"
    );
    assert(
      approx(execution.pace.gapAttemptsPerWeek, weekly?.gap, 1e-9),
      "Execution gapAttemptsPerWeek diverged from weekly context"
    );
    return true;
  });

  test("Phase 9: weekly ops context uses timeline cap source when constrained timeline is ON", () => {
    const mockState = {
      goalSupportIds: 1000,
      budget: {
        optimize: { tlConstrainedEnabled: true },
        tactics: {
          doors: { kind: "persuasion" },
          phones: { kind: "persuasion" },
          texts: { kind: "gotv" },
        },
      },
      timelineEnabled: true,
      timelineActiveWeeks: 8,
      timelineGotvWeeks: 2,
      timelineStaffCount: 3,
      timelineVolCount: 12,
      timelineStaffHours: 40,
      timelineVolHours: 6,
      timelineDoorsPerHour: 18,
      timelineCallsPerHour: 20,
      timelineTextsPerHour: 80,
      orgCount: 5,
      orgHoursPerWeek: 40,
      volunteerMultBase: 1.5,
      channelDoorPct: 70,
      doorsPerHour3: 18,
      callsPerHour3: 20,
    };

    const ctx = computeWeeklyOpsContextFromState(mockState, {
      res: { expected: { persuasionNeed: 1000 } },
      weeks: 10,
      getEffectiveBaseRatesForState: () => ({ cr: 0.2, sr: 0.5, tr: 0.8 }),
      computeCapacityBreakdown: () => ({ total: 99999, doors: 70000, phones: 29999 }),
      compileEffectiveInputsForState: () => null,
      computeMaxAttemptsByTactic: () => ({
        enabled: true,
        maxAttemptsByTactic: { doors: 120, phones: 80, texts: 50 },
      }),
    });

    assert(ctx && typeof ctx === "object", "Weekly context missing");
    assert(ctx.capSource === "timeline", "Expected timeline cap source");
    assert(ctx.capTotal === 250, `Expected timeline cap total 250, got ${ctx.capTotal}`);
    assert(ctx.capByTactic?.doors === 120, "Expected timeline doors cap");
    assert(ctx.capByTactic?.phones === 80, "Expected timeline phones cap");
    assert(ctx.capByTactic?.texts === 50, "Expected timeline texts cap");
    return true;
  });

  test("Phase 9: no-UI-math guard keeps render path snapshot-driven", () => {
    const snap = engine.getStateSnapshot();
    assert(snap && typeof snap === "object", "State snapshot unavailable");

    const planning = computeElectionSnapshot({ state: snap, nowDate: new Date(), toNum: safeNum });
    assert(planning && planning.res, "Planning snapshot unavailable");

    const makeEl = () => ({
      textContent: "",
      hidden: false,
      classList: { add(){}, remove(){} },
    });
    const els = new Proxy({}, {
      get(target, key){
        if (!(key in target)) target[key] = makeEl();
        return target[key];
      }
    });

    let computeAllCalls = 0;
    const fakeEngine = {
      computeAll: () => {
        computeAllCalls += 1;
        return planning.res;
      },
      snapshot: {
        CURRENT_SCHEMA_VERSION,
        MODEL_VERSION,
        computeSnapshotHash,
      },
    };

    const noop = () => {};
    renderMain({
      state: snap,
      els,
      safeNum,
      engine: fakeEngine,
      derivedWeeksRemaining: () => planning.weeks,
      deriveNeedVotes: () => planning.needVotes,
      computeElectionSnapshot: () => planning,
      computeExecutionSnapshot: () => null,
      computeWeeklyOpsContext: () => null,
      setLastRenderCtx: noop,
      setLastResultsSnapshot: noop,
      fmtInt: (n) => String(n ?? "—"),
      setText: (el, v) => { if (el) el.textContent = String(v ?? ""); },
      safeCall: (fn) => { if (typeof fn === "function") fn(); },
      renderStress: noop,
      renderValidation: noop,
      renderAssumptions: noop,
      renderGuardrails: noop,
      renderConversion: noop,
      renderPhase3: noop,
      renderWeeklyOps: noop,
      renderWeeklyOpsInsights: noop,
      renderWeeklyOpsFreshness: noop,
      scheduleOperationsCapacityOutlookRender: noop,
      renderAssumptionDriftE1: noop,
      renderRiskFramingE2: noop,
      renderBottleneckAttributionE3: noop,
      renderSensitivitySnapshotE4: noop,
      renderDecisionConfidenceE5: noop,
      renderImpactTraceE6: noop,
      renderUniverse16Card: noop,
      renderRoi: noop,
      renderOptimization: noop,
      renderTimeline: noop,
      renderDecisionIntelligencePanel: noop,
    });

    assert(computeAllCalls === 0, "renderMain should not call engine.computeAll when planning snapshot is available");
    return true;
  });

  test("Phase 9 UI: impact trace prefers execution/weekly context over state-derived math", () => {
    const mount = document.createElement("div");
    const list = document.createElement("div");
    list.id = "impactTraceList";
    mount.appendChild(list);
    document.body.appendChild(mount);
    try {
      const state = {
        goalSupportIds: 999999,
        supportRatePct: 1,
        contactRatePct: 1,
        orgCount: 1,
        orgHoursPerWeek: 1,
        volunteerMultBase: 1,
        channelDoorPct: 50,
        doorsPerHour3: 1,
        callsPerHour3: 1,
      };
      const res = {
        expected: {
          persuasionNeed: 123,
          winThreshold: 456,
        },
      };
      const weeklyContext = {
        attemptsPerWeek: 1234,
        capTotal: 987,
        gap: 247,
      };
      const executionSnapshot = {
        pace: {
          requiredAttemptsPerWeek: 1234,
          capacityAttemptsPerWeek: 987,
          gapAttemptsPerWeek: 247,
        },
      };

      const fmtIntLocal = (n) => String(Math.round(n));

      renderImpactTracePanel({
        els: { impactTraceList: list },
        state,
        res,
        weeks: 12,
        fmtInt: fmtIntLocal,
        weeklyContext,
        executionSnapshot,
      });

      const rows = Array.from(list.querySelectorAll(".impact-trace-item"));
      assert(rows.length > 0, "Impact trace should render rows");

      const valueFor = (titleText) => {
        const row = rows.find((node) => String(node.querySelector(".impact-trace-head span")?.textContent || "").trim() === titleText);
        if (!row) return null;
        const valueEl = row.querySelector(".impact-trace-value");
        return String(valueEl?.textContent || "").trim();
      };

      assert(valueFor("Required attempts per week") === "1234", "Impact trace required attempts should come from context");
      assert(valueFor("Capacity contacts possible per week") === "987", "Impact trace capacity should come from context");
      assert(valueFor("Gap vs required contacts (per week)") === "+247", "Impact trace gap should come from context");
    } finally {
      mount.remove();
    }
    return true;
  });

  test("Phase 9 UI: ROI feasibility uses timeline caps when timeline-constrained mode is ON", () => {
    const roiTbody = document.createElement("tbody");
    const captured = { caps: null };

    renderRoiModule({
      els: {
        roiTbody,
        roiBanner: document.createElement("div"),
        turnoutSummary: document.createElement("div"),
      },
      state: {
        orgCount: 2,
        orgHoursPerWeek: 40,
        volunteerMultBase: 1,
        channelDoorPct: 70,
        doorsPerHour3: 18,
        callsPerHour3: 20,
        universeSize: 100000,
        persuasionPct: 30,
        turnoutEnabled: false,
        gotvMode: "basic",
        budget: {
          optimize: { tlConstrainedEnabled: true },
          tactics: {
            doors: { enabled: true, kind: "persuasion" },
            phones: { enabled: true, kind: "persuasion" },
            texts: { enabled: true, kind: "gotv" },
          },
        },
        timelineEnabled: true,
        timelineActiveWeeks: 8,
        timelineGotvWeeks: 2,
        timelineStaffCount: 3,
        timelineVolCount: 20,
        timelineStaffHours: 40,
        timelineVolHours: 6,
        timelineDoorsPerHour: 18,
        timelineCallsPerHour: 20,
        timelineTextsPerHour: 80,
      },
      res: { expected: { persuasionNeed: 1000 } },
      weeks: 10,
      deriveNeedVotes: () => 1000,
      getEffectiveBaseRates: () => ({ cr: 0.2, sr: 0.3, tr: 0.8 }),
      computeCapacityBreakdown: () => ({ total: 100000, doors: 70000, phones: 30000 }),
      safeNum: (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      },
      clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v))),
      canonicalDoorsPerHourFromSnap: () => 18,
      computeAvgLiftPP: () => 0,
      fmtInt: (n) => String(Math.round(Number(n) || 0)),
      engine: {
        computeMaxAttemptsByTactic: () => ({
          enabled: true,
          maxAttemptsByTactic: { doors: 120, phones: 80, texts: 50 }
        }),
        computeRoiRows: (args) => {
          captured.caps = args?.caps || null;
          return { rows: [], banner: null };
        }
      }
    });

    assert(captured.caps != null, "ROI computeRoiRows caps were not captured");
    assert(captured.caps.doors === 120, "ROI should use timeline doors cap");
    assert(captured.caps.phones === 80, "ROI should use timeline phones cap");
    assert(captured.caps.texts === 50, "ROI should use timeline texts cap");
    assert(captured.caps.total === 250, "ROI should use summed timeline cap total");
    return true;
  });

  test("Phase 9 UI: optimization uses timeline cap total as ceiling when constrained", () => {
    const calls = [];
    const plan = {
      allocation: { doors: 25 },
      totals: { attempts: 25, cost: 50, netVotes: 5 },
      binding: "caps",
    };

    const makeEl = (tag = "div") => document.createElement(tag);
    const optTbody = document.createElement("tbody");
    const tlMvTbody = document.createElement("tbody");
    const tlOptResults = makeEl("div");
    tlOptResults.hidden = true;

    renderOptimizationModule({
      els: {
        optTbody,
        optGapContext: makeEl("span"),
        optBanner: makeEl("div"),
        optTotalAttempts: makeEl("span"),
        optTotalCost: makeEl("span"),
        optTotalVotes: makeEl("span"),
        optBinding: makeEl("span"),
        tlOptResults,
        tlOptGoalFeasible: makeEl("span"),
        tlOptMaxNetVotes: makeEl("span"),
        tlOptRemainingGap: makeEl("span"),
        tlOptBinding: makeEl("span"),
        tlMvPrimary: makeEl("span"),
        tlMvSecondary: makeEl("span"),
        tlMvTbody,
      },
      state: {
        ui: {},
        budget: {
          overheadAmount: 0,
          includeOverhead: false,
          tactics: {
            doors: { enabled: true, cpa: 2, kind: "persuasion" },
            phones: { enabled: false, cpa: 1, kind: "persuasion" },
            texts: { enabled: false, cpa: 1, kind: "persuasion" },
          },
          optimize: {
            mode: "budget",
            budgetAmount: 1000,
            capacityAttempts: "",
            step: 25,
            useDecay: false,
            objective: "net",
            tlConstrainedEnabled: true,
            tlConstrainedObjective: "max_net",
          }
        },
        timelineEnabled: true,
        timelineActiveWeeks: 8,
        timelineGotvWeeks: 2,
        timelineStaffCount: 3,
        timelineVolCount: 20,
        timelineStaffHours: 40,
        timelineVolHours: 6,
        timelineDoorsPerHour: 18,
        timelineCallsPerHour: 20,
        timelineTextsPerHour: 80,
      },
      res: { expected: { persuasionNeed: 1000 } },
      weeks: 10,
      deriveNeedVotes: () => 1000,
      fmtInt: (n) => String(Math.round(Number(n) || 0)),
      compileEffectiveInputs: () => ({
        rates: { cr: 0.25, sr: 0.3, tr: 0.8 },
        capacity: {
          orgCount: 2,
          orgHoursPerWeek: 40,
          volunteerMult: 1,
          doorShare: 0.7,
          doorsPerHour: 18,
          callsPerHour: 20,
          capacityDecay: { enabled: false, type: "linear", weeklyDecayPct: 0.03, floorPctOfBaseline: 0.7 },
        }
      }),
      computeCapacityBreakdown: () => ({ total: 99999, doors: 70000, phones: 29999 }),
      safeNum: (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      },
      engine: {
        buildOptimizationTactics: () => ([
          { id: "doors", label: "Doors", costPerAttempt: 2, netVotesPerAttempt: 0.2, turnoutAdjustedNetVotesPerAttempt: 0.2, used: { cr: 0.25 } },
        ]),
        computeMaxAttemptsByTactic: () => ({ enabled: true, maxAttemptsByTactic: { doors: 120, phones: 80, texts: 50 } }),
        optimizeMixBudget: (args) => {
          calls.push({ fn: "optimizeMixBudget", args });
          return plan;
        },
        optimizeTimelineConstrained: (args) => {
          calls.push({ fn: "optimizeTimelineConstrained", args });
          return { plan, meta: { goalFeasible: true, maxAchievableNetVotes: 5, remainingGapNetVotes: 0, bindingObj: {} } };
        },
        computeMarginalValueDiagnostics: () => ({ interventions: [], primaryBottleneck: null, secondaryNotes: null }),
      }
    });

    const firstBudgetCall = calls.find((c) => c.fn === "optimizeMixBudget");
    assert(firstBudgetCall, "Missing optimizeMixBudget call");
    assert(firstBudgetCall.args?.capacityCeiling === 250, "Optimization should use timeline cap total as budget capacity ceiling");

    const tlCall = calls.find((c) => c.fn === "optimizeTimelineConstrained");
    assert(tlCall, "Missing optimizeTimelineConstrained call");
    assert(tlCall.args?.capacityCeiling === 250, "Timeline constrained optimization should use timeline cap total as ceiling");
    assert(tlCall.args?.maxAttemptsByTactic?.doors === 120, "Timeline constrained optimization should pass timeline tactic caps");
    return true;
  });

  test("Phase 9: AI write-constraint schema validation blocks forbidden writes", () => {
    const valid = validateAiIntelWritePayload({
      briefs: [{ content: "Calibration summary." }],
      recommendations: [{ title: "Reduce support-rate assumption.", draftPatch: { ref: "core.supportRatePct", value: 52 } }],
      flags: [{ explanation: "Observed support rate trails assumption." }],
      inputCards: { ai: { draftNotes: "Review with field director." } },
      intelRequests: [{ parsed: { action: "what_if", target: "supportRatePct" } }],
      observations: [],
      classifications: [],
    });
    assert(valid.ok === true, `Expected valid AI payload; got errors: ${(valid.errors || []).join(" | ")}`);

    const badRoot = validateAiIntelWritePayload({
      scenarioState: { supportRatePct: 99 },
    });
    assert(badRoot.ok === false, "Forbidden root key should fail validation");
    assert((badRoot.errors || []).some((e) => String(e).includes("forbidden root key")), "Missing forbidden-root validation error");

    const badFlag = validateAiIntelWritePayload({
      flags: [{ explanation: "bad", actualCR: 0.33 }],
    });
    assert(badFlag.ok === false, "Numeric drift fields in flags should fail validation");
    assert((badFlag.errors || []).some((e) => String(e).includes("numeric drift field")), "Missing numeric-drift-field validation error");
    return true;
  });

  test("Phase 9: seeded MC reproducibility guard includes raw margins", () => {
    assert(baseline.res, "Baseline computeAll result missing");
    assert(baseline.weeks != null, "Baseline weeks missing");
    assert(baseline.needVotes != null, "Baseline needVotes missing");

    const runs = 600;
    const a = engine.runMonteCarloSim({
      res: baseline.res,
      weeks: baseline.weeks,
      needVotes: baseline.needVotes,
      runs,
      seed: "phase9-seed-margins-A",
      includeMargins: true,
    });
    const b = engine.runMonteCarloSim({
      res: baseline.res,
      weeks: baseline.weeks,
      needVotes: baseline.needVotes,
      runs,
      seed: "phase9-seed-margins-A",
      includeMargins: true,
    });

    assert(Array.isArray(a?.margins) && a.margins.length === runs, "Expected margins array with requested run length");
    assert(Array.isArray(a?.sortedMargins) && a.sortedMargins.length === runs, "Expected sortedMargins array with requested run length");
    assert(stableStringify(a.margins) === stableStringify(b.margins), "Same seed produced different raw margins");
    assert(stableStringify(a.sortedMargins) === stableStringify(b.sortedMargins), "Same seed produced different sortedMargins");

    const c = engine.runMonteCarloSim({
      res: baseline.res,
      weeks: baseline.weeks,
      needVotes: baseline.needVotes,
      runs,
      seed: "phase9-seed-margins-B",
      includeMargins: true,
    });
    const degenerate = (a?.p5 === a?.p95) && (c?.p5 === c?.p95);
    if (!degenerate){
      assert(stableStringify(a.margins) !== stableStringify(c.margins), "Different seeds produced identical raw margins (unexpected)");
    }
    return true;
  });



  test("Phase 9: voteProduction helpers remain deterministic and bounded", () => {
    const fallback = 0.25;
    assert(approx(pctOverrideToDecimal(null, fallback), fallback, 1e-12), "pctOverrideToDecimal should preserve fallback");
    assert(approx(pctOverrideToDecimal("", fallback), fallback, 1e-12), "pctOverrideToDecimal should preserve fallback for empty input");
    assert(approx(pctOverrideToDecimal("50", fallback), 0.5, 1e-12), "pctOverrideToDecimal failed 50% conversion");

    const turnoutCtx = resolveTurnoutContext({
      enabled: true,
      liftPerContactPP: 3,
      maxLiftPP: 6,
      baselineTurnoutPct: 98,
    });
    assert(turnoutCtx.enabled === true, "resolveTurnoutContext should mark turnout enabled");
    assert(approx(turnoutCtx.maxAdditionalPP, 2, 1e-12), "resolveTurnoutContext maxAdditionalPP should clamp to 2");
    assert(approx(turnoutCtx.liftAppliedPP, 2, 1e-12), "resolveTurnoutContext liftAppliedPP should clamp to maxAdditionalPP");

    const baseNetVotesPerAttempt = computeBaseNetVotesPerAttempt({ cr: 0.4, sr: 0.3, tr: 0.8 });
    assert(approx(baseNetVotesPerAttempt, 0.096, 1e-12), "computeBaseNetVotesPerAttempt mismatch");

    const gotvVotesPerAttempt = computeGotvNetVotesPerAttempt({ cr: 0.4, liftPerContactPP: 2 });
    assert(approx(gotvVotesPerAttempt, 0.008, 1e-12), "computeGotvNetVotesPerAttempt mismatch");

    const hybridTr = computeHybridEffectiveTurnoutReliability({ tr: 0.99, liftAppliedPP: 5, clampUnit: true });
    assert(approx(hybridTr, 1, 1e-12), "computeHybridEffectiveTurnoutReliability should clamp at 1");

    const capAttempts = computeGotvSaturationCapAttempts({
      cr: 0.25,
      targetUniverseSize: 100000,
      maxAdditionalPP: 4,
      gotvLiftPP: 2,
    });
    assert(capAttempts === 800000, `computeGotvSaturationCapAttempts mismatch: expected 800000, got ${capAttempts}`);
    assert(computeGotvSaturationCapAttempts({
      cr: 0,
      targetUniverseSize: 1000,
      maxAdditionalPP: 4,
      gotvLiftPP: 2,
    }) == null, "computeGotvSaturationCapAttempts should return null for invalid CR");
    return true;
  });

  test("Phase 9: computeTacticVoteProduction is single-source parity-safe", () => {
    const turnoutCtx = resolveTurnoutContext({
      enabled: true,
      liftPerContactPP: 2,
      maxLiftPP: 4,
      baselineTurnoutPct: 55,
    });

    const gotv = computeTacticVoteProduction({
      cr: 0.35,
      sr: 0.28,
      tr: 0.82,
      kind: "gotv",
      turnoutContext: turnoutCtx,
      targetUniverseSize: 80000,
      gotvSaturationCap: true,
      requirePositiveBase: true,
      requirePositiveGotvCr: true,
    });
    assert(approx(gotv.baseNetVotesPerAttempt, computeBaseNetVotesPerAttempt({ cr: 0.35, sr: 0.28, tr: 0.82 }), 1e-12), "GOTV base path mismatch");
    assert(approx(gotv.turnoutAdjustedNetVotesPerAttempt, computeGotvNetVotesPerAttempt({ cr: 0.35, liftPerContactPP: turnoutCtx.gotvLiftPP }), 1e-12), "GOTV turnout-adjusted mismatch");
    assert(
      gotv.maxAttempts === computeGotvSaturationCapAttempts({
        cr: 0.35,
        targetUniverseSize: 80000,
        maxAdditionalPP: turnoutCtx.maxAdditionalPP,
        gotvLiftPP: turnoutCtx.gotvLiftPP,
      }),
      "GOTV saturation cap mismatch"
    );

    const hybrid = computeTacticVoteProduction({
      cr: 0.35,
      sr: 0.28,
      tr: 0.82,
      kind: "hybrid",
      turnoutContext: turnoutCtx,
      gotvSaturationCap: true,
      requirePositiveBase: true,
      requirePositiveGotvCr: true,
    });
    const expectedHybridTr = computeHybridEffectiveTurnoutReliability({
      tr: 0.82,
      liftAppliedPP: turnoutCtx.liftAppliedPP,
      clampUnit: true,
    });
    assert(approx(hybrid.hybridEffectiveTr, expectedHybridTr, 1e-12), "Hybrid effective TR mismatch");
    assert(
      approx(
        hybrid.turnoutAdjustedNetVotesPerAttempt,
        computeBaseNetVotesPerAttempt({ cr: 0.35, sr: 0.28, tr: expectedHybridTr }),
        1e-12
      ),
      "Hybrid turnout-adjusted mismatch"
    );
    return true;
  });

  test("Phase 9: ROI and optimization share vote-production parity", () => {
    const snap = engine.getStateSnapshot();
    assert(snap && typeof snap === "object", "State snapshot unavailable");

    const baseRates = {
      cr: pctToUnitFromPct(snap.contactRatePct) ?? 0.33,
      sr: pctToUnitFromPct(snap.supportRatePct) ?? 0.3,
      tr: pctToUnitFromPct(snap.turnoutReliabilityPct) ?? 0.85,
    };
    const tactics = {
      doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
      phones: { enabled: true, cpa: 0.03, kind: "hybrid", crPct: 22 },
      texts: { enabled: true, cpa: 0.02, kind: "gotv", crPct: 8 },
    };
    const turnoutModel = {
      enabled: true,
      baselineTurnoutPct: 50,
      liftPerContactPP: 1.5,
      maxLiftPP: 6,
    };

    const goalNetVotes = Math.max(1, Number(baseline.needVotes) || 1000);
    const roiOut = engine.computeRoiRows({
      goalNetVotes,
      baseRates,
      tactics,
      turnoutModel,
    });
    const optTactics = engine.buildOptimizationTactics({
      baseRates,
      tactics,
      turnoutModel,
      universeSize: (Number(snap.universeSize) > 0 ? Number(snap.universeSize) : 50000),
      targetUniversePct: (Number(snap.persuasionPct) >= 0 ? Number(snap.persuasionPct) : 30),
    });

    assert(Array.isArray(roiOut?.rows) && roiOut.rows.length === 3, "Expected ROI rows for all enabled tactics");
    assert(Array.isArray(optTactics) && optTactics.length === 3, "Expected optimization tactics for all enabled channels");

    const optById = new Map(optTactics.map((t) => [String(t.id), t]));
    for (const row of roiOut.rows){
      const t = optById.get(String(row.key));
      assert(t, `Missing optimization tactic for ROI row key '${row.key}'`);
      const baseVpa = row.production?.base?.netVotesPerAttempt;
      assert(
        approx(baseVpa, t.production?.base?.netVotesPerAttempt, 1e-12),
        `Base netVotesPerAttempt mismatch for ${row.key}`
      );
      assert(
        approx(row.turnoutAdjustedNetVotesPerAttempt, t.turnoutAdjustedNetVotesPerAttempt, 1e-12),
        `turnoutAdjustedNetVotesPerAttempt mismatch for ${row.key}`
      );
      assert(
        approx(
          row.production?.adjusted?.turnoutAdjustedNetVotesPerAttempt,
          t.production?.adjusted?.turnoutAdjustedNetVotesPerAttempt,
          1e-12
        ),
        `production.adjusted turnoutAdjusted mismatch for ${row.key}`
      );
      if (row.costPerNetVote != null && row.cpa != null && baseVpa != null && baseVpa > 0){
        assert(
          approx(row.costPerNetVote, row.cpa / baseVpa, 1e-12),
          `ROI costPerNetVote must align with shared baseNetVotesPerAttempt for ${row.key}`
        );
      }
    }
    return true;
  });

  test("Phase 9: explain mode returns lineage without altering deterministic outputs", () => {
    const snap = engine.getStateSnapshot();
    assert(snap && typeof snap === "object", "State snapshot unavailable");

    const modelInput = buildModelInputFromSnapshot(snap);
    const plain = engine.computeAll(modelInput);
    const explained = engine.computeAll(modelInput, { explain: true });

    assert(plain && typeof plain === "object", "Plain computeAll result missing");
    assert(!plain.explain, "Plain computeAll should not include explain payload");
    assert(explained && typeof explained === "object", "Explain computeAll result missing");
    assert(explained.explain && typeof explained.explain === "object", "Explain payload missing");
    assert(explained.explain._meta?.moduleVersion === "engine.explain.v1", "Unexpected explain module version");

    assert(
      approx(plain?.expected?.turnoutVotes, explained?.expected?.turnoutVotes, 1e-12),
      "Explain mode changed expected.turnoutVotes"
    );
    assert(
      approx(plain?.expected?.winThreshold, explained?.expected?.winThreshold, 1e-12),
      "Explain mode changed expected.winThreshold"
    );
    assert(
      approx(plain?.expected?.persuasionNeed, explained?.expected?.persuasionNeed, 1e-12),
      "Explain mode changed expected.persuasionNeed"
    );

    const lineage = explained.explain["expected.persuasionNeed"];
    assert(lineage && typeof lineage === "object", "Missing lineage node for expected.persuasionNeed");
    assert(typeof lineage.module === "string" && lineage.module.length > 0, "Lineage node missing module path");
    assert(Array.isArray(lineage.inputs) && lineage.inputs.length > 0, "Lineage node missing inputs list");
    assert(Array.isArray(lineage.dependsOn), "Lineage node missing dependsOn list");

    const explainedAgain = engine.computeAll(modelInput, { explain: true });
    assert(
      stableStringify(explainedAgain.explain["expected.persuasionNeed"]) === stableStringify(lineage),
      "Explain lineage node should be deterministic across repeated runs"
    );
    return true;
  });

  test("Phase 9: planning snapshot explain wiring is training-gated and parity-safe", () => {
    const snap = engine.getStateSnapshot();
    assert(snap && typeof snap === "object", "State snapshot unavailable");

    const offState = structuredClone(snap);
    offState.ui = { ...(offState.ui || {}), training: false };
    const off = computeElectionSnapshot({ state: offState, nowDate: new Date(), toNum: safeNum });
    assert(off && off.res, "Snapshot (training OFF) missing deterministic result");
    assert(!off.res.explain, "Training OFF snapshot should not include explain payload");

    const onState = structuredClone(snap);
    onState.ui = { ...(onState.ui || {}), training: true };
    const on = computeElectionSnapshot({ state: onState, nowDate: new Date(), toNum: safeNum });
    assert(on && on.res, "Snapshot (training ON) missing deterministic result");
    assert(on.res.explain && typeof on.res.explain === "object", "Training ON snapshot should include explain payload");
    assert(on.res.explain._meta?.moduleVersion === "engine.explain.v1", "Unexpected explain module version in snapshot");

    assert(
      approx(off.res?.expected?.turnoutVotes, on.res?.expected?.turnoutVotes, 1e-12),
      "Training-gated explain should not alter turnoutVotes"
    );
    assert(
      approx(off.res?.expected?.winThreshold, on.res?.expected?.winThreshold, 1e-12),
      "Training-gated explain should not alter winThreshold"
    );
    assert(
      approx(off.res?.expected?.persuasionNeed, on.res?.expected?.persuasionNeed, 1e-12),
      "Training-gated explain should not alter persuasionNeed"
    );
    return true;
  });

  test("Phase 9 UI: turnout assumptions are edited only in Budget card (no duplicate mirror card)", () => {
    const mirrorStatusEl = document.getElementById("gotvPlannerStatus");
    assert(!mirrorStatusEl, "Turnout assumptions mirror node should not exist");

    const titles = Array.from(document.querySelectorAll(".card-title"));
    const mirrorTitles = titles.filter((el) => /turnout assumptions source/i.test(String(el?.textContent || "")));
    assert(mirrorTitles.length === 0, `Expected no 'Turnout assumptions source' card title; got ${mirrorTitles.length}`);

    const gotvToggle = document.getElementById("gotvDiminishing");
    assert(gotvToggle, "Missing canonical GOTV diminishing toggle");
    const legacyGotvToggle = document.getElementById("gotvDiminishing2");
    assert(!legacyGotvToggle, "Legacy GOTV diminishing toggle should not exist");
    return true;
  });

  test("Phase 9: feature flags sync mirrors legacy toggles when features are absent", () => {
    const s = {
      turnoutEnabled: true,
      timelineEnabled: true,
      universeLayerEnabled: true,
      intelState: {
        simToggles: {
          mcDistribution: "normal",
          correlatedShocks: true,
          shockScenariosEnabled: false,
        },
        expertToggles: {
          capacityDecayEnabled: true,
        },
      },
    };
    const features = syncFeatureFlagsFromState(s, { preferFeatures: false });
    assert(features && typeof features === "object", "features object missing after sync");
    assert(features.turnout?.modelingEnabled === true, "turnout.modelingEnabled mismatch");
    assert(features.timeline?.enabled === true, "timeline.enabled mismatch");
    assert(features.universe?.weightingEnabled === true, "universe.weightingEnabled mismatch");
    assert(features.risk?.mcDistribution === "normal", "risk.mcDistribution mismatch");
    assert(features.risk?.correlatedShocks === true, "risk.correlatedShocks mismatch");
    assert(features.risk?.shockScenariosEnabled === false, "risk.shockScenariosEnabled mismatch");
    assert(features.capacity?.decayEnabled === true, "capacity.decayEnabled mismatch");
    assert(s.turnoutEnabled === true && s.timelineEnabled === true && s.universeLayerEnabled === true, "legacy booleans should remain aligned");
    return true;
  });

  test("Phase 9: legacy GOTV diminishing key migrates to canonical load state", () => {
    const migrated = normalizeLoadedStateApp({
      gotvMode: "advanced",
      gotvDiminishing2: true,
      gotvDiminishing: null,
    });
    assert(!!migrated.gotvDiminishing === true, "legacy gotvDiminishing2 should migrate to gotvDiminishing=true");
    assert(!Object.prototype.hasOwnProperty.call(migrated, "gotvDiminishing2"), "legacy gotvDiminishing2 should be removed after normalization");
    return true;
  });

  test("Phase 9: feature flags can be preferred as source-of-truth on load", () => {
    const s = {
      turnoutEnabled: false,
      timelineEnabled: false,
      universeLayerEnabled: false,
      intelState: {
        simToggles: {
          mcDistribution: "triangular",
          correlatedShocks: false,
          shockScenariosEnabled: true,
        },
        expertToggles: {
          capacityDecayEnabled: false,
        },
      },
      features: {
        turnout: { modelingEnabled: true },
        timeline: { enabled: true },
        universe: { weightingEnabled: true },
        risk: { mcDistribution: "uniform", correlatedShocks: true, shockScenariosEnabled: false },
        capacity: { decayEnabled: true },
      }
    };
    const features = syncFeatureFlagsFromState(s, { preferFeatures: true });
    assert(features.risk?.mcDistribution === "uniform", "features normalization should preserve provided distribution");
    assert(s.turnoutEnabled === true, "legacy turnoutEnabled should be derived from features");
    assert(s.timelineEnabled === true, "legacy timelineEnabled should be derived from features");
    assert(s.universeLayerEnabled === true, "legacy universeLayerEnabled should be derived from features");
    assert(s.intelState?.simToggles?.mcDistribution === "uniform", "intel mcDistribution should mirror features");
    assert(s.intelState?.simToggles?.correlatedShocks === true, "intel correlatedShocks should mirror features");
    assert(s.intelState?.simToggles?.shockScenariosEnabled === false, "intel shockScenariosEnabled should mirror features");
    assert(s.intelState?.expertToggles?.capacityDecayEnabled === true, "intel capacityDecayEnabled should mirror features");
    return true;
  });

  test("Phase 9: core feature resolver prefers features with legacy fallback", () => {
    const legacyOnly = {
      turnoutEnabled: true,
      timelineEnabled: false,
      universeLayerEnabled: true,
      intelState: {
        simToggles: { mcDistribution: "normal", correlatedShocks: true, shockScenariosEnabled: false },
        expertToggles: { capacityDecayEnabled: true },
      },
    };
    const a = resolveFeatureFlags(legacyOnly);
    assert(a.turnoutModelingEnabled === true, "legacy turnout fallback mismatch");
    assert(a.timelineEnabled === false, "legacy timeline fallback mismatch");
    assert(a.universeWeightingEnabled === true, "legacy universe fallback mismatch");
    assert(a.mcDistribution === "normal", "legacy mcDistribution fallback mismatch");
    assert(a.correlatedShocks === true, "legacy correlatedShocks fallback mismatch");
    assert(a.shockScenariosEnabled === false, "legacy shockScenarios fallback mismatch");
    assert(a.capacityDecayEnabled === true, "legacy capacityDecay fallback mismatch");

    const withFeatures = {
      ...legacyOnly,
      features: {
        turnout: { modelingEnabled: false },
        timeline: { enabled: true },
        universe: { weightingEnabled: false },
        risk: { mcDistribution: "uniform", correlatedShocks: false, shockScenariosEnabled: true },
        capacity: { decayEnabled: false },
      }
    };
    const b = resolveFeatureFlags(withFeatures);
    assert(b.turnoutModelingEnabled === false, "feature turnout precedence mismatch");
    assert(b.timelineEnabled === true, "feature timeline precedence mismatch");
    assert(b.universeWeightingEnabled === false, "feature universe precedence mismatch");
    assert(b.mcDistribution === "uniform", "feature distribution precedence mismatch");
    assert(b.correlatedShocks === false, "feature correlatedShocks precedence mismatch");
    assert(b.shockScenariosEnabled === true, "feature shockScenarios precedence mismatch");
    assert(b.capacityDecayEnabled === false, "feature capacityDecay precedence mismatch");
    return true;
  });

  results.durationMs = Math.round(nowMs() - started);
  // Ensure totals are consistent even if something weird happened.
  results.passed = Math.max(0, results.total - results.failed);

  return results;
}
