// @ts-check

import { clone, ensureCanonicalState } from "./_core.js";

export function selectCensusCanonicalView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const census = canonical.domains?.census || {};

  return {
    revision: Number(census.revision || 0),
    config: clone(census.config || {}),
    selection: {
      selectedGeoids: clone(census.selection?.selectedGeoids || []),
      activeRowsKey: census.selection?.activeRowsKey || "",
      loadedRowCount: Number(census.selection?.loadedRowCount || 0),
      selectionSetDraftName: census.config?.selectionSetDraftName || "",
      selectedSelectionSetKey: census.config?.selectedSelectionSetKey || "",
    },
  };
}

