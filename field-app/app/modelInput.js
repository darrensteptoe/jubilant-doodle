import { buildModelInputFromSnapshot } from "../core/modelInput.js";

export function buildModelInputFromState(state, safeNumFn){
  return buildModelInputFromSnapshot(state, safeNumFn);
}
