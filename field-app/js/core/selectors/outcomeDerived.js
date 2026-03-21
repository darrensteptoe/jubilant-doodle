// @ts-check

import { asArray, ensureCanonicalState, toFinite } from "./_core.js";

export function selectOutcomeDerivedView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const cache = canonical.domains?.outcome?.cache || {};
  const mcLast = cache.mcLast && typeof cache.mcLast === "object" ? cache.mcLast : {};
  const sensitivityRows = asArray(cache.sensitivityRows);
  const surfaceRows = asArray(cache.surfaceRows);

  const winProb = toFinite(mcLast.winProb ?? mcLast.winProbability, null);
  const expectedMargin = toFinite(mcLast.expectedMargin ?? mcLast.margin, null);
  const p05 = toFinite(mcLast.p05Margin, null);
  const p95 = toFinite(mcLast.p95Margin, null);
  const marginBandWidth = p05 != null && p95 != null ? p95 - p05 : null;

  return {
    mcSummary: {
      hash: cache.mcLastHash || "",
      winProb,
      expectedMargin,
      marginBandWidth,
      hasRun: !!cache.mcLastHash,
    },
    sensitivitySummary: {
      rowCount: sensitivityRows.length,
      topDriver: sensitivityRows.length ? String(sensitivityRows[0]?.label || sensitivityRows[0]?.name || "") : "",
    },
    surfaceSummary: {
      rowCount: surfaceRows.length,
      statusText: cache.surfaceStatusText || "",
      summaryText: cache.surfaceSummaryText || "",
      hasSurfaceRows: surfaceRows.length > 0,
    },
  };
}

