// @ts-check

import { getDiagnosticEngine } from "./diagnosticEngine.js";
import { buildDiagnosticPanelLines } from "./diagnosticFormatters.js";

/**
 * @param {{ engine?: ReturnType<typeof getDiagnosticEngine>, maxEntries?: number }=} options
 */
export function buildDiagnosticPanelSnapshot({ engine = getDiagnosticEngine(), maxEntries = 12 } = {}){
  const limit = Math.max(0, Number(maxEntries) || 0);
  return {
    summary: engine.summary(),
    entries: engine.listEntries({ limit }),
    maxEntries: limit,
  };
}

/**
 * @param {string[]} lines
 * @param {{ engine?: ReturnType<typeof getDiagnosticEngine>, maxEntries?: number }=} options
 * @returns {string[]}
 */
export function appendDiagnosticPanelLines(lines, { engine = getDiagnosticEngine(), maxEntries = 12 } = {}){
  const base = Array.isArray(lines) ? lines.slice() : [];
  const snapshot = buildDiagnosticPanelSnapshot({ engine, maxEntries });
  const panelLines = buildDiagnosticPanelLines(snapshot);
  if (base.length){
    base.push("");
  }
  return base.concat(panelLines);
}

