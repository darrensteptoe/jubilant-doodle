export function getUniverseLayerConfigFromSnapCore(snap, {
  getUniverseLayerConfigFromStateSelector,
}){
  return getUniverseLayerConfigFromStateSelector(snap);
}

export function getEffectiveBaseRatesFromSnapCore(snap, {
  getEffectiveBaseRatesFromStateSelector,
  computeUniverseAdjustedRates,
}){
  return getEffectiveBaseRatesFromStateSelector(snap, { computeUniverseAdjustedRates });
}

export function computeWeeklyOpsContextFromSnapCore(snap, res, weeks, {
  computeWeeklyOpsContextFromStateSelector,
  getEffectiveBaseRatesFromSnap,
  computeCapacityBreakdown,
  compileEffectiveInputs,
  computeMaxAttemptsByTactic,
}){
  return computeWeeklyOpsContextFromStateSelector(snap, {
    res,
    weeks,
    getEffectiveBaseRatesForState: (s) => getEffectiveBaseRatesFromSnap(s),
    computeCapacityBreakdown,
    compileEffectiveInputsForState: (s) => compileEffectiveInputs(s),
    computeMaxAttemptsByTactic
  });
}
