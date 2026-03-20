// @ts-check
import { composeClientReport } from "./clientReportComposer.js";
import { composeInternalReport } from "./internalReportComposer.js";
import { getReportDefinition, normalizeReportType } from "./reportRegistry.js";
import { buildReportSelectorSnapshot } from "./reportSelectors.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
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
  renderCtx = null,
  resultsSnapshot = null,
  nowDate = null,
} = {}){
  const normalizedType = normalizeReportType(reportType);
  const definition = getReportDefinition(normalizedType);
  const selectorSnapshot = buildReportSelectorSnapshot({
    state,
    renderCtx,
    resultsSnapshot,
    nowDate,
  });
  const report = normalizedType === "client"
    ? composeClientReport(selectorSnapshot, { reportDefinition: definition })
    : composeInternalReport(selectorSnapshot, { reportDefinition: definition });

  return {
    reportType: normalizedType,
    generatedAt: cleanText(report?.generatedAt || selectorSnapshot?.generatedAt),
    title: cleanText(report?.title || definition?.label || "Report"),
    reportLabel: cleanText(report?.reportLabel || definition?.label || "Report"),
    context: report?.context || selectorSnapshot?.context || {},
    sections: Array.isArray(report?.sections) ? report.sections : [],
    metadata: report?.metadata || {},
    selectorSnapshot,
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
