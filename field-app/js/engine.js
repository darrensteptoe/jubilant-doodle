// js/engine.js
// Steptoe Strategic Media LLC Campaign Engine 2.0 — Facade API over the sacred core engine.
// UI must call ONLY this module for computations/optimization/diagnostics/snapshot handling.

import { computeDeterministic as computeAll } from "./core/model.js";
import { runMonteCarloSim } from "./core/monteCarlo.js";
import { optimizeMixBudget, optimizeMixCapacity } from "./core/optimize.js";
import { computeRoiRows, buildOptimizationTactics } from "./core/budget.js";
import { computeTimelineFeasibility } from "./core/timeline.js";
import { computeMaxAttemptsByTactic, optimizeTimelineConstrained } from "./core/timelineOptimizer.js";
import { computeMarginalValueDiagnostics } from "./core/marginalValue.js";
import { computeDecisionIntelligence } from "./core/decisionIntelligence.js";
import { computeSensitivitySurface as _computeSensitivitySurface } from "./core/sensitivitySurface.js";
import { deriveNeedVotes, derivedWeeksRemaining, computeCapacityBreakdown } from "./core/model.js";
import { computeUniverseAdjustedRates } from "./core/universeLayer.js";

import { computeSnapshotHash } from "./core/hash.js";
import { migrateSnapshot, CURRENT_SCHEMA_VERSION } from "./core/migrate.js";
import { checkStrictImportPolicy } from "./core/importPolicy.js";
import { validateImportedScenarioData, computeAssumptionBenchmarkWarnings } from "./core/importQuality.js";
import {
  MODEL_VERSION,
  makeScenarioExport,
  deterministicStringify,
  validateScenarioExport,
  makeTimestampedFilename,
  planRowsToCsv,
  formatSummaryText,
  copyTextToClipboard,
  hasNonFiniteNumbers,
} from "./export.js";

import { runSelfTests as _runSelfTests } from "./core/selfTest.js";
import { gateFromSelfTestResult, SELFTEST_GATE } from "./core/selfTestGate.js";

// Phase R2 — Risk framing + robust selection (pure, additive)
import * as risk from "./core/risk.js";
import * as robust from "./core/robust.js";

function buildDeterministicExplainMap(inputs = {}, res = {}){
  const hasUserDefinedSplit = String(inputs?.undecidedMode || "").trim() === "user_defined";
  return {
    "validation.universeOk": {
      module: "core/winMath.js::validateInputs",
      inputs: ["universeSize"],
      dependsOn: [],
      note: "Universe must be a positive number.",
    },
    "validation.candidateTableOk": {
      module: "core/winMath.js::validateInputs",
      inputs: ["candidates[*].supportPct", "undecidedPct"],
      dependsOn: [],
      note: "Candidate + undecided totals must equal 100%.",
    },
    "turnout.expectedPct": {
      module: "core/winMath.js::computeTurnout",
      inputs: ["turnoutA", "turnoutB"],
      dependsOn: [],
      note: "Expected turnout is the midpoint of cycle A/B baselines.",
    },
    "turnout.bestPct": {
      module: "core/winMath.js::computeTurnout",
      inputs: ["turnoutA", "turnoutB", "bandWidth"],
      dependsOn: ["turnout.expectedPct"],
      note: "Best/worst turnout uses symmetric band width around expected.",
    },
    "turnout.worstPct": {
      module: "core/winMath.js::computeTurnout",
      inputs: ["turnoutA", "turnoutB", "bandWidth"],
      dependsOn: ["turnout.expectedPct"],
      note: "Best/worst turnout uses symmetric band width around expected.",
    },
    "expected.turnoutVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: ["universeSize", "turnout.expectedPct"],
      dependsOn: ["validation.universeOk", "turnout.expectedPct"],
      note: "Baseline electorate turnout votes (not GOTV-adjusted).",
    },
    "expected.earlyVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: ["earlyVoteExp", "expected.turnoutVotes"],
      dependsOn: ["expected.turnoutVotes"],
      note: "Early/election-day split is informational unless other layers consume it explicitly.",
    },
    "expected.edVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: ["earlyVoteExp", "expected.turnoutVotes"],
      dependsOn: ["expected.turnoutVotes"],
      note: "Election-day votes are remainder after early vote split.",
    },
    "expected.yourVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: [
        "candidates[*].supportPct",
        "undecidedPct",
        "undecidedMode",
        ...(hasUserDefinedSplit ? ["userSplit[*]"] : []),
      ],
      dependsOn: ["validation.candidateTableOk", "expected.turnoutVotes"],
      note: "Your projected votes after undecided allocation.",
    },
    "expected.winThreshold": {
      module: "core/winMath.js::computeExpected",
      inputs: ["candidates[*].supportPct", "undecidedPct", "undecidedMode"],
      dependsOn: ["expected.turnoutVotes", "expected.yourVotes"],
      note: "Threshold is top competitor projection + 1 vote.",
    },
    "expected.persuasionNeed": {
      module: "core/winMath.js::computeExpected",
      inputs: ["expected.winThreshold", "expected.yourVotes"],
      dependsOn: ["expected.winThreshold", "expected.yourVotes"],
      note: "Clamped at zero when projected votes already meet threshold.",
    },
    "expected.persuasionUniverse": {
      module: "core/winMath.js::computeExpected",
      inputs: ["universeSize", "persuasionPct"],
      dependsOn: ["validation.universeOk"],
      note: "Modeled movable universe for persuasion planning.",
    },
    "stressSummary": {
      module: "core/winMath.js::computeStressSummary",
      inputs: ["turnout.*", "expected.*", "validation.*"],
      dependsOn: ["turnout.expectedPct", "expected.persuasionNeed"],
      note: "Advisory risk framing from deterministic assumptions.",
    },
    "guardrails": {
      module: "core/winMath.js::computeGuardrails",
      inputs: ["raw.*", "turnout.*", "expected.*", "validation.*"],
      dependsOn: ["validation.universeOk", "validation.candidateTableOk"],
      note: "Input-quality checks and structural warnings.",
    },
    _meta: {
      generatedAt: new Date().toISOString(),
      moduleVersion: "engine.explain.v1",
      hasResult: !!res && typeof res === "object",
    },
  };
}

function computeAllWithExplain(inputs, options){
  const result = computeAll(inputs, options);
  if (!options || options.explain !== true) return result;
  if (!result || typeof result !== "object") return result;
  return {
    ...result,
    explain: buildDeterministicExplainMap(inputs, result),
  };
}

// Internal: build the engine accessor bundle expected by selfTest + sensitivitySurface.
function buildAccessors(){
  return {
    computeAll: (mi, options) => computeAllWithExplain(mi, options),
    deriveNeedVotes: (res, goalOverride) => deriveNeedVotes(res, goalOverride),
    derivedWeeksRemaining: (args) => derivedWeeksRemaining(args),
    runMonteCarloSim: (args) => runMonteCarloSim(args),
    optimizeMixBudget: (inputs, options) => optimizeMixBudget(inputs, options),
    optimizeMixCapacity: (inputs, options) => optimizeMixCapacity(inputs, options),
    buildOptimizationTactics: (...args) => buildOptimizationTactics(...args),
    computeRoiRows: (...args) => computeRoiRows(...args),
    computeCapacityBreakdown: (args) => computeCapacityBreakdown(args),
  };
}

// Facade — MUST expose ONLY the documented surface area.
export const engine = {
  computeAll: (inputs, options) => computeAllWithExplain(inputs, options),
  // Backward-compat shim for older app modules that still call engine.computeUniverseAdjustedRates(...)
  computeUniverseAdjustedRates: (args) => computeUniverseAdjustedRates(args),

  runMonteCarlo: (args) => runMonteCarloSim(args),

  optimizeMixBudget: (inputs, options) => optimizeMixBudget(inputs, options),
  optimizeMixCapacity: (inputs, options) => optimizeMixCapacity(inputs, options),
  optimizeTimelineConstrained: (inputs, options) => optimizeTimelineConstrained(inputs, options),

  computeTimelineFeasibility: (inputs, options) => computeTimelineFeasibility(inputs, options),
  computeMaxAttemptsByTactic: (inputs, options) => computeMaxAttemptsByTactic(inputs, options),

  computeRoiRows: (...args) => computeRoiRows(...args),
  buildOptimizationTactics: (...args) => buildOptimizationTactics(...args),

  computeMarginalValueDiagnostics: (inputs, options) => computeMarginalValueDiagnostics(inputs, options),
  computeDecisionIntelligence: (inputs, options) => computeDecisionIntelligence(inputs, options),

  computeSensitivitySurface: ({ baseline, sweep, options } = {}) => {
    return _computeSensitivitySurface({ engine: buildAccessors(), baseline, sweep, options });
  },

  snapshot: {
    MODEL_VERSION,
    CURRENT_SCHEMA_VERSION,
    computeSnapshotHash,
    migrateSnapshot,
    checkStrictImportPolicy,
    validateImportedScenarioData,
    computeAssumptionBenchmarkWarnings,
    makeScenarioExport,
    deterministicStringify,
    validateScenarioExport,
    makeTimestampedFilename,
    planRowsToCsv,
    formatSummaryText,
    copyTextToClipboard,
    hasNonFiniteNumbers,
  },

  selfTest: {
    runSelfTests: () => _runSelfTests(buildAccessors()),
    gateFromSelfTestResult,
    SELFTEST_GATE,
  },

  // Phase R2 — OFF by default (no UI surface unless dev tools enable)
  risk,
  robust,
};
