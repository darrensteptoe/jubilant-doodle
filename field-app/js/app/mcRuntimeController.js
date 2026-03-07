// @ts-check
import { runMonteCarloNowModule } from "./monteCarloApp.js";

export function createMcRuntimeController({
  getState,
  setLastRenderCtx,
  computeElectionSnapshot,
  computeExecutionSnapshot,
  computeWeeklyOpsContext,
  derivedWeeksRemaining,
  buildModelInputFromState,
  safeNum,
  engine,
  deriveNeedVotes,
  hashMcInputs,
  computeDailyLogHash,
  persist,
  clearMcStale,
  renderMcResults,
  renderMcFreshness,
  renderRiskFramingE2,
  renderSensitivitySnapshotE4,
} = {}){
  function runMonteCarloSim(argsOrScenario, legacyRes, legacyWeeks, legacyNeedVotes, legacyRuns, legacySeed, legacyIncludeMargins){
    const state = getState();
    const looksObject = !!argsOrScenario && typeof argsOrScenario === "object" && !Array.isArray(argsOrScenario);
    const hasNamedShape = looksObject && (
      Object.prototype.hasOwnProperty.call(argsOrScenario, "scenario") ||
      Object.prototype.hasOwnProperty.call(argsOrScenario, "scenarioState") ||
      Object.prototype.hasOwnProperty.call(argsOrScenario, "res") ||
      Object.prototype.hasOwnProperty.call(argsOrScenario, "weeks") ||
      Object.prototype.hasOwnProperty.call(argsOrScenario, "needVotes") ||
      Object.prototype.hasOwnProperty.call(argsOrScenario, "seed") ||
      Object.prototype.hasOwnProperty.call(argsOrScenario, "includeMargins")
    );

    const payload = hasNamedShape
      ? {
        scenario: argsOrScenario.scenario || argsOrScenario.scenarioState || state,
        res: argsOrScenario.res,
        weeks: argsOrScenario.weeks,
        needVotes: argsOrScenario.needVotes,
        runs: argsOrScenario.runs,
        seed: argsOrScenario.seed,
        includeMargins: argsOrScenario.includeMargins,
      }
      : {
        scenario: looksObject ? argsOrScenario : state,
        res: legacyRes,
        weeks: legacyWeeks,
        needVotes: legacyNeedVotes,
        runs: legacyRuns,
        seed: legacySeed,
        includeMargins: legacyIncludeMargins,
      };

    return engine.runMonteCarlo(payload);
  }

  function runMonteCarloNow(){
    return runMonteCarloNowModule({
      state: getState(),
      computeElectionSnapshot,
      computeExecutionSnapshot,
      computeWeeklyOpsContext,
      derivedWeeksRemaining,
      buildModelInputFromState,
      safeNum,
      engine,
      deriveNeedVotes,
      setLastRenderCtx,
      hashMcInputs,
      runMonteCarloSim,
      computeDailyLogHash,
      persist,
      clearMcStale,
      renderMcResults,
      renderMcFreshness,
      renderRiskFramingE2,
      renderSensitivitySnapshotE4,
    });
  }

  return {
    runMonteCarloSim,
    runMonteCarloNow,
  };
}
