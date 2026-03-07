// @ts-check
export function createSummaryRenderController({
  els,
  getState,
  engine,
  computeRealityDrift,
  computeEvidenceWarnings,
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
    renderValidationModule({
      els,
      state,
      res,
      weeks,
      benchmarkWarnings,
      evidenceWarnings,
      driftSummary,
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
    renderGuardrailsModule({
      els,
      res,
      block,
      kv,
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
