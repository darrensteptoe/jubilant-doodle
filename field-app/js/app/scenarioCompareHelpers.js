// @ts-check
/**
 * @param {Record<string, any>} snap
 * @param {{
 *   getUniverseLayerConfigFromStateSelector: (state: Record<string, any>) => Record<string, any>,
 * }} deps
 */
export function getUniverseLayerConfigFromSnapCore(snap, {
  getUniverseLayerConfigFromStateSelector,
}){
  return getUniverseLayerConfigFromStateSelector(snap);
}

/**
 * @param {Record<string, any>} snap
 * @param {{
 *   getEffectiveBaseRatesFromStateSelector: (state: Record<string, any>, deps: Record<string, any>) => Record<string, any>,
 *   computeUniverseAdjustedRates: (args: Record<string, any>) => Record<string, any>,
 * }} deps
 */
export function getEffectiveBaseRatesFromSnapCore(snap, {
  getEffectiveBaseRatesFromStateSelector,
  computeUniverseAdjustedRates,
}){
  return getEffectiveBaseRatesFromStateSelector(snap, { computeUniverseAdjustedRates });
}

/**
 * @param {Record<string, any>} snap
 * @param {Record<string, any>} res
 * @param {number | null} weeks
 * @param {{
 *   computeWeeklyOpsContextFromStateSelector: (state: Record<string, any>, deps: Record<string, any>) => Record<string, any>,
 *   getEffectiveBaseRatesFromSnap: (state: Record<string, any>) => Record<string, any>,
 *   computeCapacityBreakdown: (args: Record<string, any>) => Record<string, any>,
 *   compileEffectiveInputs: (state: Record<string, any>) => Record<string, any>,
 *   computeMaxAttemptsByTactic: (args: Record<string, any>) => Record<string, any>,
 * }} deps
 */
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
