// @ts-check

import { asArray, clone, makeActionResult, mutateDomain, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

const CONTROL_FIELDS = new Set([
  "mcMode",
  "mcVolatility",
  "mcSeed",
  "turnoutReliabilityPct",
  "mcContactMin",
  "mcContactMode",
  "mcContactMax",
  "mcPersMin",
  "mcPersMode",
  "mcPersMax",
  "mcReliMin",
  "mcReliMode",
  "mcReliMax",
  "mcDphMin",
  "mcDphMode",
  "mcDphMax",
  "mcCphMin",
  "mcCphMode",
  "mcCphMax",
  "mcVolMin",
  "mcVolMode",
  "mcVolMax",
]);

function normalizeControlValue(field, value) {
  if (field === "mcMode" || field === "mcVolatility" || field === "mcSeed") {
    return cleanText(value);
  }
  return toFinite(value, null);
}

export function updateOutcomeControlField(state, payload, options = {}) {
  const field = cleanText(payload?.field);
  if (!CONTROL_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "outcome",
    (draft) => {
      const nextValue = normalizeControlValue(field, payload?.value);
      if (draft.controls[field] === nextValue) return false;
      draft.controls[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `outcome.controls.${field}` },
  );
  return makeActionResult(result, { field });
}

export function runOutcomeMc(state, payload, options = {}) {
  const run = payload?.run && typeof payload.run === "object" ? payload.run : {};
  const hash = cleanText(payload?.hash || run.hash);
  const sensitivityRows = asArray(payload?.sensitivityRows).map((row) => clone(row));
  const summary = cleanText(payload?.summaryText);
  const status = cleanText(payload?.statusText) || "MC run complete.";
  const ranAt = cleanText(payload?.ranAt) || new Date().toISOString();

  const result = mutateDomain(
    state,
    "outcome",
    (draft) => {
      draft.cache.mcLast = clone(run);
      draft.cache.mcLastHash = hash;
      if (sensitivityRows.length) {
        draft.cache.sensitivityRows = sensitivityRows;
      }
      if (summary) {
        draft.cache.surfaceSummaryText = summary;
      }
      draft.cache.surfaceStatusText = status;
      draft.cache.lastRunAt = ranAt;
      return true;
    },
    { ...options, revisionReason: "outcome.runMc" },
  );
  return makeActionResult(result, { hash });
}

export function updateOutcomeSurface(state, payload, options = {}) {
  const rows = asArray(payload?.rows).map((row) => clone(row));
  const inputs = payload?.inputs && typeof payload.inputs === "object" ? payload.inputs : {};
  const statusText = cleanText(payload?.statusText);
  const summaryText = cleanText(payload?.summaryText);

  const result = mutateDomain(
    state,
    "outcome",
    (draft) => {
      draft.cache.surfaceRows = rows;
      draft.cache.surfaceInputs = {
        ...draft.cache.surfaceInputs,
        ...clone(inputs),
      };
      if (statusText) draft.cache.surfaceStatusText = statusText;
      if (summaryText) draft.cache.surfaceSummaryText = summaryText;
      return true;
    },
    { ...options, revisionReason: "outcome.surface.update" },
  );
  return makeActionResult(result);
}

