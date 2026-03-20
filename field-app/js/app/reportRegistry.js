// @ts-check

export const REPORT_SECTION_ORDER = Object.freeze([
  "executiveSummary",
  "strategicPosition",
  "targetingUniverseSummary",
  "fieldWorkforceSummary",
  "budgetChannelStrategySummary",
  "turnoutGotvRisk",
  "scenarioSummary",
  "recommendedActions",
  "methodologyAppendix",
]);

export const REPORT_SECTION_LABELS = Object.freeze({
  executiveSummary: "Executive Summary",
  strategicPosition: "Strategic Position",
  targetingUniverseSummary: "Targeting & Universe Summary",
  fieldWorkforceSummary: "Field & Workforce Summary",
  budgetChannelStrategySummary: "Budget / Channel Strategy Summary",
  turnoutGotvRisk: "Turnout & GOTV Risk",
  scenarioSummary: "Scenario Summary",
  recommendedActions: "Recommended Actions",
  methodologyAppendix: "Methodology / Appendix",
});

export const REPORT_REGISTRY = Object.freeze({
  internal: Object.freeze({
    id: "internal",
    label: "Internal Report",
    audience: "internal",
    description: "Full diagnostic report with confidence, readiness, realism, and operational detail.",
    sections: REPORT_SECTION_ORDER,
  }),
  client: Object.freeze({
    id: "client",
    label: "Client Report",
    audience: "client",
    description: "Campaign-manager-facing strategic report with clear recommendations and trust framing.",
    sections: REPORT_SECTION_ORDER,
  }),
});

export const DEFAULT_REPORT_TYPE = "internal";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

/**
 * @param {unknown} reportType
 * @returns {"internal" | "client"}
 */
export function normalizeReportType(reportType){
  const id = cleanText(reportType).toLowerCase();
  if (id === "client") return "client";
  return "internal";
}

/**
 * @param {unknown} reportType
 * @returns {{
 *   id: "internal" | "client",
 *   label: string,
 *   audience: string,
 *   description: string,
 *   sections: readonly string[],
 * }}
 */
export function getReportDefinition(reportType){
  const id = normalizeReportType(reportType);
  return REPORT_REGISTRY[id];
}

/**
 * @returns {Array<{ id: "internal" | "client", label: string }>}
 */
export function listReportTypeOptions(){
  return [
    { id: "internal", label: REPORT_REGISTRY.internal.label },
    { id: "client", label: REPORT_REGISTRY.client.label },
  ];
}

/**
 * @param {unknown} sectionId
 * @returns {string}
 */
export function getReportSectionLabel(sectionId){
  const id = cleanText(sectionId);
  return REPORT_SECTION_LABELS[id] || id || "Section";
}
