// js/scenarioManager.js
// Phase 13 — Scenario Manager / Plan Compare Engine
// Design goals:
// - In-memory only (no localStorage)
// - Deep-clone snapshots (never mutate baseline)
// - Deterministic summaries (same seed + run count)
// - Fail-soft (never throw to caller)

import { computeSnapshotHash } from "/js/hash.js";
import { computeDecisionIntelligence } from "/js/decisionIntelligence.js";
import { computeRoiRows, buildOptimizationTactics } from "/js/budget.js";
import { computeAvgLiftPP } from "/js/turnout.js";

const DEFAULT_MAX = 5;
const MC_RUNS = 10000;

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function clamp(v, lo, hi){
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}
function pctToUnit(pct, fallback){
  const n = safeNum(pct);
  if (n == null) return fallback;
  return clamp(n, 0, 100) / 100;
}
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

function derivedWeeksRemainingFromSnap(snap){
  try{
    const wOverride = safeNum(snap?.weeksRemaining);
    if (wOverride != null && wOverride >= 0) return wOverride;

    const d = (snap?.electionDate || "").trim();
    if (!d) return null;

    // Use local date parsing as app does; fail-soft.
    const dt = new Date(d + "T00:00:00");
    if (!Number.isFinite(dt.getTime())) return null;
    const now = new Date();
    const ms = dt.getTime() - now.getTime();
    const days = ms / (1000 * 60 * 60 * 24);
    const weeks = Math.max(0, days / 7);
    return weeks;
  } catch {
    return null;
  }
}

function computeVolunteerNeed({ snap, res, weeks }){
  const rawGoal = safeNum(snap.goalSupportIds);
  const autoGoal = safeNum(res?.expected?.persuasionNeed);
  const goal = (rawGoal != null && rawGoal >= 0) ? rawGoal : (autoGoal != null && autoGoal > 0 ? autoGoal : 0);

  const sr = pctToUnit(snap.supportRatePct, null);
  const cr = pctToUnit(snap.contactRatePct, null);

  const dph = safeNum(snap.doorsPerHour);
  const hps = safeNum(snap.hoursPerShift);
  const spv = safeNum(snap.shiftsPerVolunteerPerWeek);

  const doorsPerShift = (dph != null && hps != null) ? (dph * hps) : null;

  const convosNeeded = (sr != null && sr > 0) ? (goal / sr) : null;
  const doorsNeeded = (convosNeeded != null && cr != null && cr > 0) ? (convosNeeded / cr) : null;

  const totalShifts = (doorsNeeded != null && doorsPerShift != null && doorsPerShift > 0) ? (doorsNeeded / doorsPerShift) : null;
  const shiftsPerWeek = (totalShifts != null && weeks != null && weeks > 0) ? (totalShifts / weeks) : null;
  const volsNeeded = (shiftsPerWeek != null && spv != null && spv > 0) ? (shiftsPerWeek / spv) : null;

  return volsNeeded;
}

function computeMinCostToCloseGap({ snap, needVotes }){
  try{
    const cr = pctToUnit(snap.contactRatePct, null);
    const sr = pctToUnit(snap.supportRatePct, null);
    const tr = pctToUnit(snap.turnoutReliabilityPct, null);

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

    let turnoutModel = null;
    if (snap.turnoutEnabled){
      const basePct = safeNum(snap.turnoutBaselinePct);
      const maxLift = safeNum(snap.gotvMaxLiftPP2 ?? snap.gotvMaxLiftPP);
      const useDim = !!(snap.gotvDiminishing2 ?? snap.gotvDiminishing);
      // We'll compute lift per contact as the average of the configured lift distribution, reusing the pure helper.
      const liftPerContactPP = safeNum(snap.gotvLiftPP);
      turnoutModel = {
        enabled: true,
        baselineTurnoutPct: basePct,
        liftPerContactPP: liftPerContactPP,
        maxLiftPP: maxLift,
        useDiminishing: useDim,
      };
    }

    const rows = computeRoiRows({
      goalNetVotes: needVotes,
      baseRates: { cr, sr, tr },
      tactics,
      overheadAmount,
      includeOverhead,
      caps: null,
      mcLast: null,
      turnoutModel
    });

    const costs = (rows || [])
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
      const weeks = engine.withPatchedState(snap, () => engine.derivedWeeksRemaining());
      const needVotes = engine.withPatchedState(snap, () => engine.deriveNeedVotes(res));

      const sim = engine.withPatchedState(snap, () => engine.runMonteCarloSim({
        res,
        weeks,
        needVotes,
        runs: MC_RUNS,
        seed: (snap.mcSeed || "")
      }));

      const winProb = safeNum(sim?.winProb);
      const volunteers = computeVolunteerNeed({ snap, res, weeks });
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

      const di = computeDecisionIntelligence({ engine: diEngine, snap, baseline: { res, weeks } });
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
