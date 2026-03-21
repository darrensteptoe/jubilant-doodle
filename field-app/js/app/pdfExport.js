// @ts-check
import { buildReportPlainText } from "./reportComposer.js";
import { renderReportPdfHtmlDocument } from "../core/reporting/renderers/pdf.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function sanitizeFilePart(value){
  const text = cleanText(value).toLowerCase();
  if (!text) return "report";
  return text
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "report";
}

/**
 * @param {unknown} reportPayload
 * @returns {string}
 */
export function buildReportHtml(reportPayload){
  const report = reportPayload && typeof reportPayload === "object" ? reportPayload : {};
  return renderReportPdfHtmlDocument(report, { includeStyles: true });
}

function downloadTextFile(text, filename, mimeType){
  const blob = new Blob([String(text || "")], { type: String(mimeType || "text/plain") });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Canonical PDF export helper.
 * Uses browser print-to-PDF path and never recomputes campaign math.
 *
 * @param {unknown} reportPayload
 * @param {{ filenameBase?: unknown }=} options
 */
export function exportReportPdf(reportPayload, { filenameBase = "" } = {}){
  const report = reportPayload && typeof reportPayload === "object" ? reportPayload : null;
  if (!report){
    return { ok: false, code: "missing_report_payload" };
  }
  const title = cleanText(report?.title || report?.reportLabel || "report");
  const stamp = new Date().toISOString().slice(0, 10);
  const fileBase = sanitizeFilePart(filenameBase || title);
  const pdfName = `${fileBase}-${stamp}.pdf`;
  const html = buildReportHtml(report);

  try{
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (popup && popup.document){
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      // Browser-native flow: user chooses "Save as PDF" in print dialog.
      popup.print();
      return { ok: true, code: "print_dialog_opened", filename: pdfName };
    }
  } catch {
    // Fall back below.
  }

  try{
    downloadTextFile(html, `${fileBase}-${stamp}.html`, "text/html");
    return { ok: true, code: "html_fallback_downloaded", filename: `${fileBase}-${stamp}.html` };
  } catch {
    const plain = buildReportPlainText(report);
    try{
      downloadTextFile(plain, `${fileBase}-${stamp}.txt`, "text/plain");
      return { ok: true, code: "text_fallback_downloaded", filename: `${fileBase}-${stamp}.txt` };
    } catch {
      return { ok: false, code: "export_failed" };
    }
  }
}
