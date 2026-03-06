import { renderMcFreshnessModule } from "./mcFreshness.js";
import {
  buildAdvancedSpecsModule,
  buildBasicSpecsModule,
  quantileSortedModule,
} from "./mcSpecBuilders.js";
import {
  hashOpsEnvelopeInputsModule,
  computeOpsEnvelopeD2Module,
  renderOpsEnvelopeD2Module,
  hashFinishEnvelopeInputsModule,
  computeFinishEnvelopeD3Module,
  renderFinishEnvelopeD3Module,
  hashMissRiskInputsModule,
  computeMissRiskD4Module,
  renderMissRiskD4Module,
} from "./mcEnvelopePanels.js";

export function createMcEnvelopeController({
  els,
  getState,
  getLastRenderCtx,
  setTextPair,
  setHidden,
  hashMcInputs,
  getMcStaleness,
  computeDailyLogHash,
  computeWeeklyOpsContext,
  computeLastNLogSums,
  getEffectiveBaseRates,
  safeNum,
  makeRng,
  triSample,
  clamp,
  computeSnapshotHash,
  fmtISODate,
  persist,
  fmtInt,
} = {}){
  function resolveMcEnvelopeContext(res, weeks, opts = {}){
    const fromOpts = {
      weeklyContext: opts.weeklyContext || null,
      executionSnapshot: opts.executionSnapshot || null,
    };
    if (fromOpts.weeklyContext || fromOpts.executionSnapshot) return fromOpts;
    const lastRenderCtx = getLastRenderCtx ? getLastRenderCtx() : null;
    if (lastRenderCtx && lastRenderCtx.res === res && lastRenderCtx.weeks === weeks){
      return {
        weeklyContext: lastRenderCtx.weeklyContext || null,
        executionSnapshot: lastRenderCtx.executionSnapshot || null,
      };
    }
    return { weeklyContext: null, executionSnapshot: null };
  }

  function hashOpsEnvelopeInputs(res, weeks){
    return hashOpsEnvelopeInputsModule({
      state: getState(),
      res,
      weeks,
      getEffectiveBaseRates,
      computeSnapshotHash,
      hashMcInputs,
      safeNum,
    });
  }

  function computeOpsEnvelopeD2(res, weeks, opts = {}){
    const { weeklyContext, executionSnapshot } = resolveMcEnvelopeContext(res, weeks, opts);
    return computeOpsEnvelopeD2Module({
      state: getState(),
      res,
      weeks,
      weeklyContext,
      executionSnapshot,
      computeWeeklyOpsContext,
      getEffectiveBaseRates,
      safeNum,
      buildAdvancedSpecs: (params) => buildAdvancedSpecsModule({ state: getState(), safeNum, clamp, ...params }),
      buildBasicSpecs: (params) => buildBasicSpecsModule({ state: getState(), clamp, ...params }),
      hashMcInputs,
      makeRng,
      triSample,
      clamp,
      quantileSorted: quantileSortedModule,
    });
  }

  function renderOpsEnvelopeD2(res, weeks, opts = {}){
    const computeWithCtx = (nextRes, nextWeeks) => computeOpsEnvelopeD2(nextRes, nextWeeks, opts);
    renderOpsEnvelopeD2Module({
      els,
      state: getState(),
      res,
      weeks,
      hashOpsEnvelopeInputs,
      computeOpsEnvelopeD2: computeWithCtx,
      persist,
      fmtInt,
    });
  }

  function hashFinishEnvelopeInputs(res, weeks){
    return hashFinishEnvelopeInputsModule({
      res,
      weeks,
      hashOpsEnvelopeInputs,
      computeSnapshotHash,
      computeDailyLogHash,
      fmtISODate,
    });
  }

  function computeFinishEnvelopeD3(res, weeks, opts = {}){
    const { weeklyContext, executionSnapshot } = resolveMcEnvelopeContext(res, weeks, opts);
    return computeFinishEnvelopeD3Module({
      state: getState(),
      res,
      weeks,
      weeklyContext,
      executionSnapshot,
      computeWeeklyOpsContext,
      computeLastNLogSums,
      getEffectiveBaseRates,
      safeNum,
      buildAdvancedSpecs: (params) => buildAdvancedSpecsModule({ state: getState(), safeNum, clamp, ...params }),
      buildBasicSpecs: (params) => buildBasicSpecsModule({ state: getState(), clamp, ...params }),
      hashMcInputs,
      makeRng,
      triSample,
      clamp,
      quantileSorted: quantileSortedModule,
    });
  }

  function renderFinishEnvelopeD3(res, weeks, opts = {}){
    const computeWithCtx = (nextRes, nextWeeks) => computeFinishEnvelopeD3(nextRes, nextWeeks, opts);
    renderFinishEnvelopeD3Module({
      els,
      state: getState(),
      res,
      weeks,
      hashFinishEnvelopeInputs,
      computeFinishEnvelopeD3: computeWithCtx,
      persist,
      fmtISODate,
    });
  }

  function hashMissRiskInputs(res, weeks){
    return hashMissRiskInputsModule({
      res,
      weeks,
      hashOpsEnvelopeInputs,
      computeSnapshotHash,
      computeDailyLogHash,
    });
  }

  function computeMissRiskD4(res, weeks, opts = {}){
    const { weeklyContext, executionSnapshot } = resolveMcEnvelopeContext(res, weeks, opts);
    return computeMissRiskD4Module({
      state: getState(),
      res,
      weeks,
      weeklyContext,
      executionSnapshot,
      computeWeeklyOpsContext,
      computeLastNLogSums,
      getEffectiveBaseRates,
      safeNum,
      buildAdvancedSpecs: (params) => buildAdvancedSpecsModule({ state: getState(), safeNum, clamp, ...params }),
      buildBasicSpecs: (params) => buildBasicSpecsModule({ state: getState(), clamp, ...params }),
      hashMcInputs,
      makeRng,
      triSample,
      clamp,
    });
  }

  function renderMissRiskD4(res, weeks, opts = {}){
    const computeWithCtx = (nextRes, nextWeeks) => computeMissRiskD4(nextRes, nextWeeks, opts);
    return renderMissRiskD4Module({
      els,
      state: getState(),
      res,
      weeks,
      hashMissRiskInputs,
      computeMissRiskD4: computeWithCtx,
      persist,
    });
  }

  function renderMcFreshness(res, weeks, opts = {}){
    const renderOpsEnvelopeWithCtx = (nextRes, nextWeeks) => renderOpsEnvelopeD2(nextRes, nextWeeks, opts);
    const renderFinishEnvelopeWithCtx = (nextRes, nextWeeks) => renderFinishEnvelopeD3(nextRes, nextWeeks, opts);
    const renderMissRiskWithCtx = (nextRes, nextWeeks) => renderMissRiskD4(nextRes, nextWeeks, opts);
    return renderMcFreshnessModule({
      els,
      state: getState(),
      res,
      weeks,
      setTextPair,
      setHidden,
      hashMcInputs,
      getMcStaleness,
      computeDailyLogHash,
      renderOpsEnvelopeD2: renderOpsEnvelopeWithCtx,
      renderFinishEnvelopeD3: renderFinishEnvelopeWithCtx,
      renderMissRiskD4: renderMissRiskWithCtx,
    });
  }

  return {
    renderMcFreshness,
    hashOpsEnvelopeInputs,
    computeOpsEnvelopeD2,
    renderOpsEnvelopeD2,
    hashFinishEnvelopeInputs,
    computeFinishEnvelopeD3,
    renderFinishEnvelopeD3,
    hashMissRiskInputs,
    computeMissRiskD4,
    renderMissRiskD4,
  };
}
