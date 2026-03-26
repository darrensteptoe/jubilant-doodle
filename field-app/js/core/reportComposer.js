// @ts-check
import {
  buildCompatibilitySections,
  composeReportDocument,
} from "../core/reporting/composeReport.js";
import { toLegacyAlias } from "../core/reporting/reportTypes.js";
import {
  getReportDefinition,
  normalizeReportType,
  toCanonicalReportType,
} from "./reportRegistry.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function clone(value){
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

/**
 * @param {{
 *   reportType?: unknown,
  *   state?: Record<string, any>,
 *   renderCtx?: Record<string, any> | null,
 *   resultsSnapshot?: Record<string, any> | null,
 *   nowDate?: Date | null,
 * }} args
 */
export function composeReportPayload({
  reportType = "internal",
  state = {},
  renderCtx = null, // intentionally accepted for compatibility
  resultsSnapshot = null,
  nowDate = null,
} = {}){
  const normalizedType = normalizeReportType(reportType);
  const canonicalType = toCanonicalReportType(normalizedType);
  const definition = getReportDefinition(normalizedType);
  const reportDocument = composeReportDocument({
    reportType: canonicalType,
    state,
    resultsSnapshot,
    nowDate,
  });
  const sectionLines = buildCompatibilitySections(reportDocument);
  const legacyType = toLegacyAlias(canonicalType);
  const reportTypeOutput = normalizedType === "internal" || normalizedType === "client"
    ? normalizedType
    : canonicalType;

  void renderCtx;

  return {
    reportType: reportTypeOutput,
    reportTypeCanonical: canonicalType,
    legacyReportType: legacyType,
    generatedAt: cleanText(reportDocument?.generatedAt),
    title: cleanText(reportDocument?.title || definition?.label || "Report"),
    reportLabel: cleanText(reportDocument?.reportLabel || definition?.label || "Report"),
    context: clone(reportDocument?.context || {}),
    sections: sectionLines,
    typedSections: Array.isArray(reportDocument?.sections) ? clone(reportDocument.sections) : [],
    blocks: Array.isArray(reportDocument?.blocks) ? clone(reportDocument.blocks) : [],
    metadata: clone(reportDocument?.metadata || {}),
    metrics: clone(reportDocument?.metrics || {}),
    selectorSnapshot: clone(reportDocument?.selectorSnapshot || {}),
  };
}

/**
 * @param {unknown} reportPayload
 * @returns {string}
 */
export function buildReportPlainText(reportPayload){
  const report = reportPayload && typeof reportPayload === "object" ? reportPayload : {};
  const lines = [];
  const title = cleanText(report?.title || report?.reportLabel || "Report");
  const generatedAt = cleanText(report?.generatedAt);
  if (title) lines.push(title);
  if (generatedAt) lines.push(`Generated: ${generatedAt}`);
  lines.push("");

  const sections = Array.isArray(report?.sections) ? report.sections : [];
  for (const section of sections){
    const sectionTitle = cleanText(section?.title || section?.id || "Section");
    if (!sectionTitle) continue;
    lines.push(sectionTitle);
    const rows = Array.isArray(section?.lines) ? section.lines : [];
    if (!rows.length){
      lines.push("- —");
      lines.push("");
      continue;
    }
    for (const row of rows){
      const text = cleanText(row);
      if (!text) continue;
      lines.push(`- ${text}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
