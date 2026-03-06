export function createPlanningRuntimeController({
  els,
  getState,
  coreDeriveNeedVotesOrZero,
  coreComputeCapacityBreakdown,
  coreComputeCapacityContacts,
  getCapacityDecayConfigFromState,
  renderRoiModule,
  renderOptimizationModule,
  renderTimelineModule,
  renderPhase3Module,
  getEffectiveBaseRates,
  safeNum,
  clamp,
  canonicalDoorsPerHourFromSnap,
  engine,
  computeAvgLiftPP,
  fmtInt,
  compileEffectiveInputs,
  renderMcFreshness,
  renderMcResults,
} = {}){
  function deriveNeedVotes(res, goalSupportIdsOverride){
    return coreDeriveNeedVotesOrZero(res, goalSupportIdsOverride);
  }

  function computeCapacityBreakdown(args){
    const next = (args && typeof args === "object") ? { ...args } : {};
    if (!next.capacityDecay){
      next.capacityDecay = getCapacityDecayConfigFromState(getState());
    }
    return coreComputeCapacityBreakdown(next);
  }

  function computeCapacityContacts(args){
    const next = (args && typeof args === "object") ? { ...args } : {};
    if (!next.capacityDecay){
      next.capacityDecay = getCapacityDecayConfigFromState(getState());
    }
    return coreComputeCapacityContacts(next);
  }

  function renderRoi(res, weeks){
    const state = getState();
    renderRoiModule({
      els,
      state,
      res,
      weeks,
      deriveNeedVotes,
      getEffectiveBaseRates,
      computeCapacityBreakdown,
      safeNum,
      clamp,
      canonicalDoorsPerHourFromSnap,
      engine,
      computeAvgLiftPP,
      fmtInt,
    });
  }

  function renderOptimization(res, weeks){
    const state = getState();
    renderOptimizationModule({
      els,
      state,
      res,
      weeks,
      deriveNeedVotes,
      fmtInt,
      compileEffectiveInputs,
      computeCapacityBreakdown,
      safeNum,
      engine,
    });
  }

  function renderTimeline(res, weeks){
    const state = getState();
    renderTimelineModule({
      els,
      state,
      weeks,
      safeNum,
      fmtInt,
      engine,
    });
  }

  function renderPhase3(res, weeks){
    const state = getState();
    renderPhase3Module({
      els,
      state,
      res,
      weeks,
      fmtInt,
      compileEffectiveInputs,
      computeCapacityContacts,
      deriveNeedVotes,
      renderMcFreshness,
      renderMcResults,
    });
  }

  return {
    deriveNeedVotes,
    computeCapacityBreakdown,
    computeCapacityContacts,
    renderRoi,
    renderOptimization,
    renderTimeline,
    renderPhase3,
  };
}
