// @ts-check
import { REALISM_BANDS, REALISM_BANDS_VERSION } from "./realismBands.js";
import {
  classifyRealismAggressiveness,
  collectRealismSignals,
  scoreRealism,
} from "./realismRules.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

function toSeverity(row){
  return row?.severity === "bad" ? "bad" : "warn";
}

/**
 * Canonical plausibility evaluator.
 * This engine only scores and flags assumptions. It never mutates state.
 *
 * @param {{
 *   state?: AnyRecord,
 *   res?: AnyRecord,
 *   weeks?: unknown,
 *   driftSummary?: AnyRecord | null,
 *   bands?: AnyRecord,
 * }} args
 */
export function runRealismEngine({
  state = {},
  res = {},
  weeks = null,
  driftSummary = null,
  bands = REALISM_BANDS,
} = {}){
  const signals = collectRealismSignals({
    state,
    res,
    weeks,
    driftSummary,
    bands,
  });

  const bandAndHistoricalFlags = [
    ...(Array.isArray(signals.bandFlags) ? signals.bandFlags : []),
    ...(Array.isArray(signals.budgetFlags) ? signals.budgetFlags : []),
    ...(Array.isArray(signals.historicalFlags) ? signals.historicalFlags : []),
  ];
  const crossFlags = Array.isArray(signals.crossFlags) ? signals.crossFlags : [];
  const capacity = signals.capacity || null;

  const warnFlags = bandAndHistoricalFlags.filter((row) => toSeverity(row) === "warn");
  const badFlags = bandAndHistoricalFlags.filter((row) => toSeverity(row) === "bad");
  const crossWarn = crossFlags.filter((row) => toSeverity(row) === "warn");
  const crossBad = crossFlags.filter((row) => toSeverity(row) === "bad");

  const capacitySeverity = capacity?.severity === "bad"
    ? "bad"
    : (capacity?.severity === "warn" ? "warn" : "ok");

  const score = scoreRealism({
    warnCount: warnFlags.length,
    badCount: badFlags.length,
    crossWarnCount: crossWarn.length,
    crossBadCount: crossBad.length,
    capacitySeverity,
  });

  const severeCount = badFlags.length + crossBad.length + (capacitySeverity === "bad" ? 1 : 0);
  const warnCount = warnFlags.length + crossWarn.length + (capacitySeverity === "warn" ? 1 : 0);
  const classification = classifyRealismAggressiveness(
    score,
    severeCount,
    warnCount,
    capacity?.ratioRequiredToAvailable ?? null,
  );
  const status = classification === "unrealistic"
    ? "bad"
    : (classification === "realistic" ? "ok" : "warn");

  const flaggedAssumptions = bandAndHistoricalFlags.map((row) => ({
    type: row?.kind || "assumption",
    field: String(row?.field || ""),
    label: String(row?.label || row?.field || "Assumption"),
    severity: toSeverity(row),
    message: String(row?.reason || "").trim(),
    value: row?.value ?? null,
  }));

  const conflictingVariables = crossFlags.map((row) => ({
    id: String(row?.id || ""),
    severity: toSeverity(row),
    fields: Array.isArray(row?.fields) ? row.fields.map((field) => String(field || "")).filter(Boolean) : [],
    message: String(row?.message || "").trim(),
  }));

  const warnings = [];
  for (const row of flaggedAssumptions.slice(0, 5)){
    if (row.message) warnings.push(row.message);
  }
  for (const row of conflictingVariables.slice(0, 3)){
    if (row.message) warnings.push(row.message);
  }
  if (capacitySeverity !== "ok" && capacity?.message){
    warnings.push(String(capacity.message));
  }

  return {
    version: REALISM_BANDS_VERSION,
    score,
    status,
    classification,
    checked: (Array.isArray(signals.checkedBandKeys) ? signals.checkedBandKeys.length : 0)
      + (Array.isArray(signals.checkedBudgetBandKeys) ? signals.checkedBudgetBandKeys.length : 0),
    outOfTypical: warnFlags.length,
    outOfHard: badFlags.length,
    flags: bandAndHistoricalFlags,
    crossFlags,
    flaggedAssumptions,
    conflictingVariables,
    capacity: {
      hasCapacityCheck: !!capacity?.hasCapacityCheck,
      requiredAttemptsPerWeek: capacity?.requiredAttemptsPerWeek ?? null,
      availableAttemptsPerWeek: capacity?.availableAttemptsPerWeek ?? null,
      gapAttemptsPerWeek: capacity?.gapAttemptsPerWeek ?? null,
      ratioRequiredToAvailable: capacity?.ratioRequiredToAvailable ?? null,
      severity: capacitySeverity,
      message: String(capacity?.message || "").trim(),
    },
    realismScore: score,
    warnings,
    metrics: signals.metrics || {},
  };
}
