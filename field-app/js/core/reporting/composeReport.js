// @ts-check

import { PRODUCT_NAME } from "../../app/brand.js";
import { flattenSectionBlocks, resetBlockIdCounter } from "./blocks/index.js";
import { buildReportContext } from "./reportContext.js";
import { getReportDefinition, resolveCanonicalReportType } from "./reportTypes.js";
import { buildReportSections } from "./sectionBuilders/index.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function toLegacyReportType(canonicalType) {
  if (canonicalType === "internal_full") return "internal";
  if (canonicalType === "client_standard") return "client";
  return canonicalType;
}

function summarizeBlock(block) {
  const type = cleanText(block?.type);
  if (type === "headline") {
    return cleanText(block?.headline || block?.subheadline || "");
  }
  if (type === "status") {
    const label = cleanText(block?.label);
    const value = cleanText(block?.value);
    const note = cleanText(block?.note);
    return [label && value ? `${label}: ${value}` : (label || value), note].filter(Boolean).join(" — ");
  }
  if (type === "metric_grid") {
    const rows = Array.isArray(block?.metrics) ? block.metrics : [];
    return rows
      .map((row) => {
        const label = cleanText(row?.label);
        const value = cleanText(row?.value);
        return label && value ? `${label}: ${value}` : (label || value);
      })
      .filter(Boolean)
      .join(" | ");
  }
  if (type === "trend") {
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    return rows
      .map((row) => {
        const metric = cleanText(row?.metric);
        const delta = cleanText(row?.delta);
        const direction = cleanText(row?.direction);
        const core = metric && delta ? `${metric}: ${delta}` : (metric || delta);
        return direction && direction !== "flat" ? `${core} (${direction})` : core;
      })
      .filter(Boolean)
      .join(" | ");
  }
  if (type === "benchmark") {
    const label = cleanText(block?.label);
    const value = cleanText(block?.value);
    const confidence = cleanText(block?.confidence);
    const note = cleanText(block?.note);
    const row = [label && value ? `${label}: ${value}` : (label || value), confidence ? `confidence ${confidence}` : "", note]
      .filter(Boolean)
      .join(" — ");
    return row;
  }
  if (type === "risk") {
    return [
      cleanText(block?.summary),
      cleanText(block?.level) ? `level ${cleanText(block.level)}` : "",
      cleanText(block?.mitigation),
    ].filter(Boolean).join(" — ");
  }
  if (type === "recommendation") {
    return [
      cleanText(block?.priority) ? `[${cleanText(block.priority)}]` : "",
      cleanText(block?.text),
      cleanText(block?.rationale),
    ].filter(Boolean).join(" ");
  }
  if (type === "action_owner") {
    return [
      cleanText(block?.action),
      cleanText(block?.owner) ? `owner ${cleanText(block.owner)}` : "",
      cleanText(block?.due) ? `due ${cleanText(block.due)}` : "",
      cleanText(block?.status) ? `status ${cleanText(block.status)}` : "",
    ].filter(Boolean).join(" — ");
  }
  if (type === "confidence_methodology") {
    const confidenceBand = cleanText(block?.confidenceBand);
    const score = cleanText(block?.score);
    return [
      confidenceBand ? `confidence ${confidenceBand}` : "",
      score ? `score ${score}` : "",
    ].filter(Boolean).join(" — ");
  }
  if (type === "appendix") {
    const title = cleanText(block?.title);
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    const rowText = rows
      .map((row) => {
        const label = cleanText(row?.label);
        const value = cleanText(row?.value);
        return label && value ? `${label}: ${value}` : (label || value);
      })
      .filter(Boolean)
      .join(" | ");
    return [title, rowText].filter(Boolean).join(" — ");
  }
  return cleanText(block?.text || block?.label || "");
}

export function buildCompatibilitySections(reportDocument) {
  const sections = Array.isArray(reportDocument?.sections) ? reportDocument.sections : [];
  return sections.map((section) => {
    const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
    const lines = blocks
      .map((block) => summarizeBlock(block))
      .map((line) => cleanText(line))
      .filter(Boolean);
    return {
      id: cleanText(section?.id),
      title: cleanText(section?.title || section?.id || "Section"),
      lines,
    };
  });
}

export function composeReportDocument({
  reportType = "internal_full",
  state = {},
  resultsSnapshot = null,
  comparison = null,
  nowDate = null,
} = {}) {
  const canonicalType = resolveCanonicalReportType(reportType);
  const reportDefinition = getReportDefinition(canonicalType);
  const reportContext = buildReportContext({
    reportType: canonicalType,
    state,
    resultsSnapshot,
    comparison,
    nowDate,
  });

  resetBlockIdCounter();
  const sections = buildReportSections(canonicalType, reportContext);
  const blocks = flattenSectionBlocks(sections);

  const context = reportContext?.context || {};
  const campaignLabel = cleanText(context?.campaignName || context?.campaignId || "Campaign");
  const title = `${PRODUCT_NAME} — ${reportDefinition.label} — ${campaignLabel}`;

  return {
    reportType: canonicalType,
    legacyReportType: toLegacyReportType(canonicalType),
    reportLabel: reportDefinition.label,
    title,
    generatedAt: reportContext.generatedAt,
    context: clone(context),
    sections,
    blocks,
    metrics: clone(reportContext.metrics),
    selectorSnapshot: clone(reportContext),
    metadata: {
      reportType: canonicalType,
      reportAudience: reportDefinition.audience,
      reportTone: reportDefinition.tone,
      generatedAt: reportContext.generatedAt,
      sourceSnapshotRef: clone(reportContext.sourceReferences),
      scenarioReference: {
        scenarioId: cleanText(context?.scenarioId),
        scenarioName: cleanText(context?.scenarioName),
      },
      comparisonReference: clone(reportContext?.metrics?.comparison?.reference || {}),
    },
  };
}
