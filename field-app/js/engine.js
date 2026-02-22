// js/engine.js
// Field Path Engine 2.0 — Facade API over the sacred core engine.
// UI must call ONLY this module for computations/optimization/diagnostics/snapshot handling.

import { computeDeterministic as computeAll } from "/js/core/model.js";
import { runMonteCarloSim } from "/js/core/monteCarlo.js";
import { optimizeMixBudget, optimizeMixCapacity } from "/js/core/optimize.js";
import { computeRoiRows, buildOptimizationTactics } from "/js/core/budget.js";
import { computeTimelineFeasibility } from "/js/core/timeline.js";
import { computeMaxAttemptsByTactic, optimizeTimelineConstrained } from "/js/core/timelineOptimizer.js";
import { computeMarginalValueDiagnostics } from "/js/core/marginalValue.js";
import { computeDecisionIntelligence } from "/js/core/decisionIntelligence.js";
import { computeSensitivitySurface as _computeSensitivitySurface } from "/js/core/sensitivitySurface.js";
import { deriveNeedVotes, derivedWeeksRemaining, computeCapacityBreakdown } from "/js/core/model.js";

import { computeSnapshotHash } from "/js/core/hash.js";
import { migrateSnapshot, CURRENT_SCHEMA_VERSION } from "/js/core/migrate.js";
import { checkStrictImportPolicy } from "/js/core/importPolicy.js";
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
} from "/js/export.js";

import { runSelfTests as _runSelfTests } from "/js/core/selfTest.js";
import { gateFromSelfTestResult, SELFTEST_GATE } from "/js/core/selfTestGate.js";

// Phase R2 — Risk framing + robust selection (pure, additive)
import * as risk from "/js/core/risk.js";
import * as robust from "/js/core/robust.js";

// Internal: build the engine accessor bundle expected by selfTest + sensitivitySurface.
function buildAccessors(){
  return {
    computeAll: (mi, options) => computeAll(mi, options),
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
  computeAll: (inputs, options) => computeAll(inputs, options),

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
