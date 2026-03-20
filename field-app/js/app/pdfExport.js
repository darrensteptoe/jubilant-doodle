// @ts-check
import { buildReportPlainText } from "./reportComposer.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const title = cleanText(report?.title || report?.reportLabel || "Report");
  const generatedAt = cleanText(report?.generatedAt || "");
  const sections = Array.isArray(report?.sections) ? report.sections : [];
  const sectionHtml = sections.map((section) => {
    const sectionTitle = cleanText(section?.title || section?.id || "Section");
    const lines = Array.isArray(section?.lines) ? section.lines : [];
    const rows = lines
      .map((line) => cleanText(line))
      .filter(Boolean)
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("");
    return `
      <section>
        <h2>${escapeHtml(sectionTitle)}</h2>
        <ul>${rows || "<li>—</li>"}</ul>
      </section>
    `;
  }).join("\n");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: "Times New Roman", Georgia, serif; margin: 24px; color: #111; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      .meta { margin: 0 0 20px; color: #555; font-size: 13px; }
      h2 { margin: 20px 0 8px; font-size: 17px; }
      ul { margin: 0 0 8px 20px; }
      li { margin: 0 0 4px; line-height: 1.35; }
      @media print {
        body { margin: 12mm; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Generated: ${escapeHtml(generatedAt || "—")}</p>
    ${sectionHtml}
  </body>
</html>
  `.trim();
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
