// @ts-check

import { renderReportHtmlDocument } from "./html.js";

/**
 * PDF export renderer.
 * Produces print-ready HTML consumed by browser print-to-PDF flow.
 *
 * @param {Record<string, any>} reportDocument
 * @param {{ includeStyles?: boolean }=} options
 * @returns {string}
 */
export function renderReportPdfHtmlDocument(reportDocument = {}, { includeStyles = true } = {}) {
  return renderReportHtmlDocument(reportDocument, { includeStyles });
}

