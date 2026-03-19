// @ts-check
// js/scenarioManager.js
// Phase 13 — Scenario Manager / Plan Compare Engine
// Design goals:
// - In-memory only (no localStorage)
// - Deep-clone snapshots (never mutate baseline)
// - Deterministic summaries (same seed + run count)
// - Fail-soft (never throw to caller)

import { computeSnapshotHash } from "./core/hash.js";
import { computeDecisionIntelligence } from "./core/decisionIntelligence.js";
import { computeRoiRows, buildOptimizationTactics } from "./core/budget.js";
import { deriveNeedVotes as coreDeriveNeedVotes } from "./core/model.js";
import { computeVolunteerNeedFromGoal } from "./core/executionPlanner.js";
import { NULL_BASE_RATE_DEFAULTS, resolveStateBaseRates } from "./core/baseRates.js";
import { coerceFiniteNumber } from "./core/utils.js";
import { buildTurnoutModelFromState } from "./core/voteProduction.js";

const DEFAULT_MAX = 5;
const MC_RUNS = 10000;
const SCENARIO_FALLBACK_SEED = "__scenario_compare_seed__";
const safeNum = coerceFiniteNumber;

function deepClone(obj){
  try{
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch { /* ignore */ }
  try{
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return (obj && typeof obj === "object") ? { ...obj } : obj;
  }
}

function computeMinCostToCloseGap({ snap, needVotes }){
  try{
    const baseRates = resolveStateBaseRates(snap, {
      defaults: NULL_BASE_RATE_DEFAULTS,
      clampMin: 0,
      clampMax: 1,
    });
    const { cr, sr, tr } = baseRates;

    const budget = snap.budget || {};
    const tacticsRaw = budget.tactics || {};
    const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
    const includeOverhead = !!budget.includeOverhead;

    const tactics = buildOptimizationTactics({
      baseRates: { cr, sr, tr },
      tactics: tacticsRaw,
      turnoutModel: null,
      universeSize: safeNum(snap.universeSize),
      targetUniversePct: safeNum(snap.targetUniversePct),
    });

    const turnoutModel = buildTurnoutModelFromState(snap);

    const out = computeRoiRows({
      goalNetVotes: needVotes,
      baseRates: { cr, sr, tr },
      tactics,
      overheadAmount,
      includeOverhead,
      caps: null,
      mcLast: null,
      turnoutModel
    });
    const rows = Array.isArray(out?.rows) ? out.rows : [];

    const costs = rows
      .map(r => safeNum(r?.totalCost))
      .filter(v => v != null && v >= 0);

    if (!costs.length) return null;
    return Math.min(...costs);
  } catch {
    return null;
  }
}

function stableId(){
  // Non-crypto, deterministic enough for session (no requirements on id determinism)
  return "sc_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
}

function deriveWeeksFromSnapWithEngine(engine, snap){
  if (!engine || typeof engine.derivedWeeksRemaining !== "function") return null;
  try{
    const weeks = engine.derivedWeeksRemaining({
      weeksRemainingOverride: snap?.weeksRemaining,
      electionDateISO: snap?.electionDate ? `${snap.electionDate}T00:00:00` : ""
    });
    return (weeks != null && Number.isFinite(weeks)) ? weeks : null;
  } catch {
    return null;
  }
}

function computeOverallWinner(rows){
  if (!rows || !rows.length) return null;

  const vols = rows.map(r => r.volunteers).filter(v => v != null && isFinite(v));
  const costs = rows.map(r => r.cost).filter(v => v != null && isFinite(v));
  const wins = rows.map(r => r.winProb).filter(v => v != null && isFinite(v));

  const volOrder = [...rows].sort((a,b) => (safeNum(a.volunteers) ?? 1e30) - (safeNum(b.volunteers) ?? 1e30)).map(r => r.id);
  const costOrder = [...rows].sort((a,b) => (safeNum(a.cost) ?? 1e30) - (safeNum(b.cost) ?? 1e30)).map(r => r.id);
  const winOrder = [...rows].sort((a,b) => (safeNum(b.winProb) ?? -1) - (safeNum(a.winProb) ?? -1)).map(r => r.id);

  const rankMap = (order) => {
    const m = new Map();
    order.forEach((id, i) => m.set(id, i+1));
    return m;
  };
  const rV = rankMap(volOrder);
  const rC = rankMap(costOrder);
  const rW = rankMap(winOrder);

  let best = null;
  let bestScore = 1e30;

  for (const r of rows){
    const score =
      (rV.get(r.id) ?? 999) +
      (rC.get(r.id) ?? 999) +
      (rW.get(r.id) ?? 999);

    if (score < bestScore){
      bestScore = score;
      best = r.id;
    }
  }
  return best;
}

export function createScenarioManager({ max = DEFAULT_MAX } = {}){
  const scenarios = [];

  function add({ label, snapshot, engine, modelVersion }){
    const snap = deepClone(snapshot);
    const id = stableId();
    const savedHash = computeSnapshotHash({ modelVersion: modelVersion || "", scenarioState: snap });

    let metrics = null;
    let warning = null;

    try{
      if (!engine) throw new Error("missing engine");
      const res = engine.computeAll(snap);
      const weeks = deriveWeeksFromSnapWithEngine(engine, snap);
      const needVotes = engine.deriveNeedVotes(res, snap?.goalSupportIds);

      const sim = engine.runMonteCarloSim({
        scenario: snap,
        res,
        weeks,
        needVotes,
        runs: MC_RUNS,
        seed: ((snap.mcSeed != null && String(snap.mcSeed).trim() !== "") ? String(snap.mcSeed) : SCENARIO_FALLBACK_SEED)
      });

      const winProb = safeNum(sim?.winProb);
      const volunteers = computeVolunteerNeedFromGoal({
        goalVotes: needVotes,
        supportRatePct: snap.supportRatePct,
        contactRatePct: snap.contactRatePct,
        doorsPerHour: snap.doorsPerHour,
        hoursPerShift: snap.hoursPerShift,
        shiftsPerVolunteerPerWeek: snap.shiftsPerVolunteerPerWeek,
        weeks
      });
      const cost = computeMinCostToCloseGap({ snap, needVotes });

      const diEngine = {
        getStateSnapshot: engine.getStateSnapshot,
        withPatchedState: engine.withPatchedState,
        computeAll: engine.computeAll,
        derivedWeeksRemaining: engine.derivedWeeksRemaining,
        deriveNeedVotes: engine.deriveNeedVotes,
        runMonteCarloSim: engine.runMonteCarloSim,
        computeRoiRows,
        buildOptimizationTactics,
        computeMaxAttemptsByTactic: engine.computeMaxAttemptsByTactic,
        computeTimelineFeasibility: engine.computeTimelineFeasibility,
      };

      const di = computeDecisionIntelligence({ engine: diEngine, snap, baseline: { res, weeks, needVotes } });
      const primaryBottleneck = di?.bottlenecks?.primary || "—";

      metrics = {
        volunteers,
        cost,
        winProb,
        primaryBottleneck,
        needVotes
      };
    } catch (e){
      warning = "Scenario analysis failed.";
      metrics = {
        volunteers: null,
        cost: null,
        winProb: null,
        primaryBottleneck: "—",
        needVotes: null
      };
    }

    const item = {
      id,
      label: String(label || `Scenario ${scenarios.length + 1}`),
      snapshot: snap,
      savedHash,
      metrics,
      warning
    };

    scenarios.push(item);
    if (scenarios.length > max) scenarios.shift();
    return deepClone(item);
  }

  function remove(id){
    const idx = scenarios.findIndex(s => s.id === id);
    if (idx >= 0) scenarios.splice(idx, 1);
  }

  function setLabel(id, label){
    const s = scenarios.find(x => x.id === id);
    if (s) s.label = String(label || "");
  }

  function list(){
    return scenarios.map(s => ({
      id: s.id,
      label: s.label,
      savedHash: s.savedHash,
      metrics: deepClone(s.metrics),
      warning: s.warning
    }));
  }

  function compare(){
    const rows = scenarios.map(s => ({
      id: s.id,
      label: s.label,
      volunteers: safeNum(s.metrics?.volunteers),
      cost: safeNum(s.metrics?.cost),
      winProb: safeNum(s.metrics?.winProb),
      primaryBottleneck: s.metrics?.primaryBottleneck || "—"
    }));

    const bestVol = [...rows].filter(r => r.volunteers != null).sort((a,b) => a.volunteers - b.volunteers)[0]?.id || null;
    const bestCost = [...rows].filter(r => r.cost != null).sort((a,b) => a.cost - b.cost)[0]?.id || null;
    const bestWin = [...rows].filter(r => r.winProb != null).sort((a,b) => b.winProb - a.winProb)[0]?.id || null;

    const overall = computeOverallWinner(rows);

    return {
      rows,
      highlights: { bestVol, bestCost, bestWin },
      overall
    };
  }

  return {
    add,
    remove,
    setLabel,
    list,
    compare,
    _unsafe_peek: () => scenarios, // tests only
  };
}
