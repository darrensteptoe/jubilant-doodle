// @ts-check
import { renderPhase3Panel } from "./render/monteCarlo.js";
import { clampFiniteNumber, safeNum } from "../core/utils.js";

export function renderPhase3Module(args){
  const input = args || {};
  const state = input?.state || {};
  const getEffectiveBaseRates = () => {
    const effective = (typeof input?.compileEffectiveInputs === "function")
      ? input.compileEffectiveInputs(state)
      : null;
    const rates = (effective?.rates && typeof effective.rates === "object") ? effective.rates : {};
    return {
      cr: rates?.cr,
      sr: rates?.sr,
      tr: rates?.tr,
    };
  };
  return renderPhase3Panel({
    ...input,
    safeNum,
    clamp: clampFiniteNumber,
    getEffectiveBaseRates,
  });
}
