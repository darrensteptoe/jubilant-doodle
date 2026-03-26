// @ts-check

import {
  REPORT_DEFAULT_TYPE as CORE_REPORT_DEFAULT_TYPE,
  REPORT_FAMILIES,
  listReportTypeOptions as listCoreReportTypeOptions,
  resolveCanonicalReportType,
} from "../core/reporting/reportTypes.js";

export const REPORT_SECTION_ORDER = Object.freeze([
  "situation_snapshot",
  "operational_risk",
  "election_benchmark_intelligence",
  "recommended_actions",
  "confidence_methodology",
]);

export const REPORT_SECTION_LABELS = Object.freeze({
  situation_snapshot: "Situation Snapshot",
  operational_risk: "Operational Risk & Diagnostics",
  election_benchmark_intelligence: "Election Data Benchmark Intelligence",
  recommended_actions: "Recommended Actions",
  confidence_methodology: "Confidence & Methodology",
});

const LEGACY_TO_CANONICAL = Object.freeze({
  internal: "internal_full",
  client: "client_standard",
});

const CANONICAL_TO_LEGACY = Object.freeze({
  internal_full: "internal",
  client_standard: "client",
});

export const DEFAULT_REPORT_TYPE = "internal";

export const REPORT_REGISTRY = Object.freeze(
  Object.fromEntries(
    Object.keys(REPORT_FAMILIES).map((canonicalId) => {
      const definition = REPORT_FAMILIES[canonicalId];
      const id = CANONICAL_TO_LEGACY[canonicalId] || canonicalId;
      return [
        id,
        Object.freeze({
          id,
          canonicalId,
          label: String(definition?.label || canonicalId),
          audience: String(definition?.audience || ""),
          description: String(definition?.description || ""),
          sections: REPORT_SECTION_ORDER,
        }),
      ];
    }),
  ),
);

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

/**
 * @param {unknown} reportType
 * @returns {string}
 */
export function normalizeReportType(reportType){
  const id = cleanText(reportType).toLowerCase();
  if (!id) return DEFAULT_REPORT_TYPE;
  if (Object.prototype.hasOwnProperty.call(LEGACY_TO_CANONICAL, id)) {
    return id;
  }
  if (Object.prototype.hasOwnProperty.call(REPORT_FAMILIES, id)) {
    return id;
  }
  return DEFAULT_REPORT_TYPE;
}

/**
 * @param {unknown} reportType
 * @returns {string}
 */
export function toCanonicalReportType(reportType){
  const normalized = normalizeReportType(reportType);
  if (Object.prototype.hasOwnProperty.call(LEGACY_TO_CANONICAL, normalized)) {
    return LEGACY_TO_CANONICAL[normalized];
  }
  return resolveCanonicalReportType(normalized || CORE_REPORT_DEFAULT_TYPE);
}

/**
 * @param {unknown} reportType
 * @returns {{
 *   id: string,
 *   canonicalId: string,
 *   label: string,
 *   audience: string,
 *   description: string,
 *   sections: readonly string[],
 * }}
 */
export function getReportDefinition(reportType){
  const id = normalizeReportType(reportType);
  const canonicalId = toCanonicalReportType(id);
  const canonical = REPORT_FAMILIES[canonicalId] || REPORT_FAMILIES.internal_full;
  return {
    id,
    canonicalId,
    label: String(canonical?.label || canonicalId),
    audience: String(canonical?.audience || ""),
    description: String(canonical?.description || ""),
    sections: REPORT_SECTION_ORDER,
  };
}

/**
 * @returns {Array<{ id: string, label: string, audience: string, description: string }>}
 */
export function listReportTypeOptions(){
  return listCoreReportTypeOptions().map((row) => ({
    id: String(row?.id || ""),
    label: String(row?.label || row?.id || ""),
    audience: String(row?.audience || ""),
    description: String(row?.description || ""),
  }));
}

/**
 * @param {unknown} sectionId
 * @returns {string}
 */
export function getReportSectionLabel(sectionId){
  const id = cleanText(sectionId);
  return REPORT_SECTION_LABELS[id] || id || "Section";
}
