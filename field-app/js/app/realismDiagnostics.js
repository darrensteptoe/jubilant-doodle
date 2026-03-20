// @ts-check
import { formatFixedNumber } from "../core/utils.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

function severityToKind(severity){
  return severity === "bad" ? "bad" : (severity === "warn" ? "warn" : "ok");
}

/**
 * Canonical validation rows derived from realism output.
 *
 * @param {AnyRecord | null | undefined} realism
 * @param {{ limit?: number }=} options
 * @returns {Array<{ kind: "ok" | "warn" | "bad", text: string }>}
 */
export function buildRealismValidationRows(realism, { limit = 4 } = {}){
  const src = realism && typeof realism === "object" ? realism : null;
  if (!src) return [];

  const rows = [];
  const scoreText = formatFixedNumber(src.score, 0, "—");
  rows.push({
    kind: severityToKind(src.status),
    text: `Realism: ${String(src.classification || "unknown")} (score ${scoreText}/100).`,
  });

  const cap = src.capacity && typeof src.capacity === "object" ? src.capacity : null;
  if (cap?.hasCapacityCheck){
    const req = formatFixedNumber(cap.requiredAttemptsPerWeek, 0, "—");
    const avail = formatFixedNumber(cap.availableAttemptsPerWeek, 0, "—");
    const ratio = formatFixedNumber(cap.ratioRequiredToAvailable, 2, "—");
    rows.push({
      kind: severityToKind(cap.severity),
      text: `Capacity realism: required attempts/week ${req} vs available ${avail} (ratio ${ratio}x).`,
    });
  }

  const assumptions = Array.isArray(src.flaggedAssumptions) ? src.flaggedAssumptions : [];
  for (const row of assumptions.slice(0, Math.max(0, limit))){
    const label = String(row?.label || row?.field || "Assumption").trim();
    const message = String(row?.message || "").trim();
    rows.push({
      kind: severityToKind(row?.severity),
      text: message || `${label} flagged by realism diagnostics.`,
    });
  }

  const conflicts = Array.isArray(src.conflictingVariables) ? src.conflictingVariables : [];
  for (const row of conflicts.slice(0, 2)){
    const message = String(row?.message || "").trim();
    if (!message) continue;
    rows.push({
      kind: severityToKind(row?.severity),
      text: `Cross-variable conflict: ${message}`,
    });
  }

  return rows;
}

/**
 * Canonical compact realism diagnostics snapshot.
 *
 * @param {AnyRecord | null | undefined} realism
 * @returns {{
 *   score: number | null,
 *   status: string,
 *   classification: string,
 *   flaggedAssumptions: number,
 *   conflictingVariables: number,
 *   capacitySeverity: string,
 *   topWarning: string,
 * }}
 */
export function buildRealismDiagnostics(realism){
  const src = realism && typeof realism === "object" ? realism : {};
  const assumptions = Array.isArray(src.flaggedAssumptions) ? src.flaggedAssumptions : [];
  const conflicts = Array.isArray(src.conflictingVariables) ? src.conflictingVariables : [];
  const warnings = Array.isArray(src.warnings) ? src.warnings : [];
  const capSeverity = String(src?.capacity?.severity || "ok").trim() || "ok";
  return {
    score: Number.isFinite(Number(src?.score)) ? Number(src.score) : null,
    status: String(src?.status || "").trim(),
    classification: String(src?.classification || "").trim(),
    flaggedAssumptions: assumptions.length,
    conflictingVariables: conflicts.length,
    capacitySeverity: capSeverity,
    topWarning: String(warnings[0] || "").trim(),
  };
}

