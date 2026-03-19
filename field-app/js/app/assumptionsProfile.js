// @ts-check
import {
  applyTemplateDefaultsToState,
  deriveAssumptionsProfileFromState as deriveAssumptionsProfileFromTemplateState,
  getTemplateLabelForRaceType,
  getTemplateLabelForState,
  listOverriddenTemplateFields,
  normalizeTemplateApplyMode,
  syncTemplateMetaFromState,
} from "./templateResolver.js";

/**
 * @param {Record<string, any>} targetState
 * @param {string} raceType
 * @param {{ force?: boolean }=} options
 */
export function applyTemplateDefaultsForRaceModule(
  targetState,
  raceType,
  options = {}
){
  if (!targetState || typeof targetState !== "object") return { ok: false, code: "invalid_state" };
  return applyTemplateDefaultsToState(targetState, {
    raceType,
    templateId: options?.templateId,
    officeLevel: options?.officeLevel,
    electionType: options?.electionType,
    seatContext: options?.seatContext,
    partisanshipMode: options?.partisanshipMode,
    salienceLevel: options?.salienceLevel,
    mode: normalizeTemplateApplyMode(options?.mode, { force: !!options?.force }),
  });
}

/**
 * @param {Record<string, any>} snap
 */
export function deriveAssumptionsProfileFromStateModule(
  snap
){
  return deriveAssumptionsProfileFromTemplateState(snap);
}

/**
 * @param {Record<string, any>} state
 * @param {(state: Record<string, any>) => string} deriveAssumptionsProfileFromState
 */
export function refreshAssumptionsProfileModule(state, deriveAssumptionsProfileFromState){
  if (!state.ui) state.ui = {};
  syncTemplateMetaFromState(state);
  state.ui.assumptionsProfile = deriveAssumptionsProfileFromState(state);
}

/**
 * @param {Record<string, any>} src
 * @param {(raceType: string) => string} labelTemplate
 */
export function assumptionsProfileLabelModule(src, labelTemplate){
  const s = src || {};
  const profile = deriveAssumptionsProfileFromTemplateState(s);
  if (profile === "template"){
    const detailedLabel = getTemplateLabelForState(s, { detailed: true });
    const fallback = (typeof labelTemplate === "function")
      ? labelTemplate(s)
      : getTemplateLabelForRaceType(s.raceType);
    return `Template (${detailedLabel || fallback})`;
  }
  const overrideCount = listOverriddenTemplateFields(s).length;
  return overrideCount > 0 ? `Custom overrides (${overrideCount})` : "Custom overrides";
}
