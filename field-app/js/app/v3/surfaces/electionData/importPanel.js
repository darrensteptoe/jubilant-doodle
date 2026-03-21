import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function renderElectionDataImportPanel({ importCard, getCardBody }) {
  getCardBody(importCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Import election CSV directly into the canonical electionData domain.</li>
        <li>Use file upload or paste raw CSV text for rapid iteration.</li>
      </ul>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3ElectionDataImportFile">Election CSV file</label>
        <input class="fpe-input" id="v3ElectionDataImportFile" type="file" accept=".csv,text/csv" />
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3ElectionDataImportFormat">Format hint</label>
        <select class="fpe-input" id="v3ElectionDataImportFormat">
          <option value="">Auto detect</option>
          <option value="long">Long format</option>
          <option value="wide">Wide format</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3ElectionDataImportText">CSV text (optional)</label>
      <textarea class="fpe-input" id="v3ElectionDataImportText" rows="6" placeholder="Paste CSV here when not uploading a file."></textarea>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnElectionDataImport" type="button">Import Election Data</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnElectionDataClearImportText" type="button">Clear text</button>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataImportStatus">No import has run yet.</div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataImportMeta">No source file selected.</div>
  `;
}

export function syncElectionDataImportPanel(canonical, derived) {
  const importState = canonical?.import && typeof canonical.import === "object" ? canonical.import : {};
  const importStatus = derived?.importStatus && typeof derived.importStatus === "object" ? derived.importStatus : {};

  const fileName = cleanText(importState.fileName);
  const fileSize = toFinite(importState.fileSize, null);
  const importedAt = cleanText(importState.importedAt);
  const rowCount = toFinite(importStatus.rowCount, 0) || 0;

  const statusText = cleanText(importStatus.statusText)
    || cleanText(importState.statusText)
    || "No import has run yet.";

  const metaBits = [];
  if (fileName) metaBits.push(fileName);
  if (fileSize != null && fileSize > 0) metaBits.push(`${fileSize.toLocaleString("en-US")} bytes`);
  if (importedAt) metaBits.push(`Imported ${importedAt}`);
  if (rowCount > 0) metaBits.push(`${rowCount.toLocaleString("en-US")} normalized row(s)`);

  setText("v3ElectionDataImportStatus", statusText);
  setText("v3ElectionDataImportMeta", metaBits.length ? metaBits.join(" · ") : "No source file selected.");

  const formatSelect = document.getElementById("v3ElectionDataImportFormat");
  if (formatSelect instanceof HTMLSelectElement) {
    const format = cleanText(importState.format).toLowerCase();
    if (format === "long" || format === "wide") {
      formatSelect.value = format;
    } else if (!formatSelect.value) {
      formatSelect.value = "";
    }
  }
}
