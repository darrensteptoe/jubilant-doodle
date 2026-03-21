// @ts-check

import { asArray, clone, makeActionResult, mutateDomain, toBool, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

const CONFIG_FIELDS = new Set([
  "year",
  "resolution",
  "metricSet",
  "stateFips",
  "countyFips",
  "placeFips",
  "geoSearch",
  "tractFilter",
  "selectionSetDraftName",
  "selectedSelectionSetKey",
  "applyAdjustedAssumptions",
  "mapQaVtdOverlay",
  "apiKey",
  "geoPaste",
]);

export function updateCensusConfig(state, payload, options = {}) {
  const field = cleanText(payload?.field);
  if (!CONFIG_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "census",
    (draft) => {
      const nextValue = field === "applyAdjustedAssumptions" || field === "mapQaVtdOverlay"
        ? toBool(payload?.value)
        : cleanText(payload?.value);
      if (draft.config[field] === nextValue) return false;
      draft.config[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `census.config.${field}` },
  );
  return makeActionResult(result, { field });
}

export function updateCensusSelection(state, payload, options = {}) {
  const selectedGeoids = asArray(payload?.selectedGeoids).map((id) => cleanText(id)).filter(Boolean);
  const activeRowsKey = cleanText(payload?.activeRowsKey);
  const rowsByGeoid = payload?.rowsByGeoid && typeof payload.rowsByGeoid === "object" ? payload.rowsByGeoid : {};
  const loadedRowCount = Math.max(0, Math.trunc(toFinite(payload?.loadedRowCount, selectedGeoids.length) || 0));

  const result = mutateDomain(
    state,
    "census",
    (draft) => {
      draft.selection.selectedGeoids = selectedGeoids.slice();
      draft.selection.activeRowsKey = activeRowsKey;
      draft.selection.rowsByGeoid = clone(rowsByGeoid);
      draft.selection.loadedRowCount = loadedRowCount;
      return true;
    },
    { ...options, revisionReason: "census.selection.update" },
  );
  return makeActionResult(result);
}

export function setCensusRuntimeResults(state, payload, options = {}) {
  const statusText = cleanText(payload?.statusText) || "Ready.";
  const errorText = cleanText(payload?.errorText);
  const lastFetchAt = cleanText(payload?.lastFetchAt);
  const aggregateRows = asArray(payload?.aggregateRows).map((row) => clone(row));
  const advisoryRows = asArray(payload?.advisoryRows).map((row) => clone(row));
  const mapStatusText = cleanText(payload?.mapStatusText);
  const mapQaVtdZipStatusText = cleanText(payload?.mapQaVtdZipStatusText);

  const result = mutateDomain(
    state,
    "census",
    (draft) => {
      draft.runtime.statusText = statusText;
      draft.runtime.errorText = errorText;
      draft.runtime.lastFetchAt = lastFetchAt;
      draft.runtime.aggregateRows = aggregateRows;
      draft.runtime.advisoryRows = advisoryRows;
      draft.runtime.mapStatusText = mapStatusText;
      draft.runtime.mapQaVtdZipStatusText = mapQaVtdZipStatusText;
      return true;
    },
    { ...options, revisionReason: "census.runtime.update" },
  );
  return makeActionResult(result);
}

