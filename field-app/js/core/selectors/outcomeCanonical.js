// @ts-check

import { clone, ensureCanonicalState } from "./_core.js";

export function selectOutcomeCanonicalView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const outcome = canonical.domains?.outcome || {};

  return {
    revision: Number(outcome.revision || 0),
    controls: clone(outcome.controls || {}),
    surfaceInputs: clone(outcome?.cache?.surfaceInputs || {}),
  };
}

