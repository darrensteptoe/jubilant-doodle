// @ts-check

import { asArray, ensureCanonicalState } from "./_core.js";

export function selectCensusDerivedView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const census = canonical.domains?.census || {};
  const runtime = census.runtime || {};
  const selection = census.selection || {};
  const aggregateRows = asArray(runtime.aggregateRows);
  const advisoryRows = asArray(runtime.advisoryRows);

  return {
    fetchStatus: {
      statusText: runtime.statusText || "Ready.",
      errorText: runtime.errorText || "",
      lastFetchAt: runtime.lastFetchAt || "",
    },
    coverage: {
      selectedGeoidCount: asArray(selection.selectedGeoids).length,
      loadedRowCount: Number(selection.loadedRowCount || 0),
      aggregateRowCount: aggregateRows.length,
      advisoryRowCount: advisoryRows.length,
    },
    mapStatus: {
      mapStatusText: runtime.mapStatusText || "",
      mapQaVtdZipStatusText: runtime.mapQaVtdZipStatusText || "",
      hasOverlayWarnings: Boolean(runtime.mapQaVtdZipStatusText),
    },
    aggregateSummary: {
      keys: aggregateRows.map((row) => String(row?.key || "")).filter(Boolean),
      warningCount: advisoryRows.filter((row) => String(row?.severity || "").toLowerCase() === "warn").length,
      badCount: advisoryRows.filter((row) => String(row?.severity || "").toLowerCase() === "bad").length,
    },
  };
}

