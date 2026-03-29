import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function renderElectionDataGeographyReconciliationCard({ geographyReconciliationCard, getCardBody }) {
  getCardBody(geographyReconciliationCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Provide geography reconciliation as JSON map.</li>
        <li>Keys may be precinct IDs, ward IDs, or existing geography IDs.</li>
      </ul>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3ElectionDataGeographyMapJson">Geography reconciliation JSON</label>
      <textarea class="fpe-input" id="v3ElectionDataGeographyMapJson" rows="6" placeholder='{"17-031-001A":"geo_001A"}'></textarea>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnElectionDataApplyGeographyMap" type="button">Apply Geography Reconciliation</button>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataGeographyMapStatus">Geography reconciliation complete.</div>
  `;
}

export function syncElectionDataGeographyReconciliation(canonical, derived) {
  const warning = asArray(canonical?.qa?.geographyWarnings)[0];
  const text = cleanText(derived?.geographyReconciliationText)
    || cleanText(warning)
    || "Geography reconciliation complete.";
  setText("v3ElectionDataGeographyMapStatus", text);

  const editor = document.getElementById("v3ElectionDataGeographyMapJson");
  if (editor instanceof HTMLTextAreaElement && !editor.dataset.userTouched && cleanText(editor.value) === "") {
    editor.value = JSON.stringify({}, null, 2);
  }
}
