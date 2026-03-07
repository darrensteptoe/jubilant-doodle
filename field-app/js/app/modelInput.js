// @ts-check
import { buildModelInputFromSnapshot } from "../core/modelInput.js";

/**
 * @param {Record<string, any>} state
 * @param {(v: any) => number | null} safeNumFn
 * @returns {Record<string, any>}
 */
export function buildModelInputFromState(state, safeNumFn){
  return buildModelInputFromSnapshot(state, safeNumFn);
}
