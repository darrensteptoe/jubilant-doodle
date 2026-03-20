import { buildGovernanceSnapshotView } from "../core/modelGovernance.js";
import { runRealismEngine } from "./realismEngine.js";
import { runValidationEngine } from "./validationEngine.js";

// @ts-check
export function createSummaryRenderController({
  els,
  getState,
  engine,
  computeRealityDrift,
  computeEvidenceWarnings,
  computeModelGovernance,
  renderStressModule,
  renderValidationModule,
  renderIntelChecksModule,
  renderAssumptionsModule,
  renderGuardrailsModule,
  assumptionsProfileLabel,
  getYourNameFromState,
  fmtInt,
  blockModule,
  kvModule,
  labelTemplateModule,
  labelUndecidedModeModule,
} = {}){
  function block(title, kvs){
    return blockModule(title, kvs);
  }

  function kv(k, v){
    return kvModule(k, v);
  }

  function labelTemplate(v){
    return labelTemplateModule(v);
  }

  function labelUndecidedMode(v){
    return labelUndecidedModeModule(v);
  }

  function getYourName(){
    return getYourNameFromState(getState());
  }

  let lastGovernance = null;

  function renderStress(res){
    renderStressModule({
      els,
      res,
    });
  }

  function renderValidation(res, weeks){
    const state = getState();
    const benchmarkWarnings = engine?.snapshot?.computeAssumptionBenchmarkWarnings
      ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
      : [];
    const driftSummary = computeRealityDrift();
    const evidenceWarnings = computeEvidenceWarnings(state, { limit: 2, staleDays: 30 });
    const realism = runRealismEngine({
      state,
      res,
      weeks,
      driftSummary,
    });
    const governance = (typeof computeModelGovernance === "function")
      ? computeModelGovernance({
          state,
          res,
          benchmarkWarnings,
          evidenceWarnings,
          driftSummary,
          realism,
        })
      : null;
    if (!state.ui || typeof state.ui !== "object"){
      state.ui = {};
    }
    const validationSnapshot = runValidationEngine({
      state,
      res,
      weeks,
      realism,
      context: {
        campaignId: state?.campaignId,
        campaignName: state?.campaignName,
        officeId: state?.officeId,
        scenarioId: state?.ui?.activeScenarioId || state?.scenarioId,
      },
    });
    state.ui.lastRealismSnapshot = realism;
    state.ui.lastGovernance = governance && typeof governance === "object" ? governance : null;
    state.ui.lastGovernanceSnapshot = buildGovernanceSnapshotView(governance);
    state.ui.lastValidationSnapshot = validationSnapshot;
    state.ui.lastModelReadiness = validationSnapshot?.readiness || null;
    lastGovernance = governance;
    renderValidationModule({
      els,
      state,
      res,
      weeks,
      benchmarkWarnings,
      evidenceWarnings,
      driftSummary,
      governance,
      realism,
      validationSnapshot,
    });
    renderIntelChecksModule({ els, state, engine, benchmarkWarnings, driftSummary });
  }

  function renderAssumptions(res, weeks){
    const state = getState();
    renderAssumptionsModule({
      els,
      state,
      res,
      weeks,
      block,
      kv,
      labelTemplate,
      assumptionsProfileLabel,
      labelUndecidedMode,
      getYourName,
      fmtInt,
    });
  }

  function renderGuardrails(res){
    const governance = lastGovernance;
    renderGuardrailsModule({
      els,
      res,
      block,
      kv,
      governance,
    });
  }

  return {
    block,
    kv,
    labelTemplate,
    labelUndecidedMode,
    getYourName,
    renderStress,
    renderValidation,
    renderAssumptions,
    renderGuardrails,
  };
}
