import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function renderElectionDataCandidateReconciliationCard({ candidateReconciliationCard, getCardBody }) {
  getCardBody(candidateReconciliationCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Provide candidate-ID reconciliation as JSON map.</li>
        <li>Keys may be candidate names or existing candidate IDs.</li>
      </ul>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3ElectionDataCandidateMapJson">Candidate reconciliation JSON</label>
      <textarea class="fpe-input" id="v3ElectionDataCandidateMapJson" rows="6" placeholder='{"Alex Alpha":"cand_alex", "Blair Beta":"cand_blair"}'></textarea>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnElectionDataApplyCandidateMap" type="button">Apply Candidate Reconciliation</button>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataCandidateMapStatus">Candidate reconciliation complete.</div>
  `;
}

export function syncElectionDataCandidateReconciliation(canonical, derived) {
  const warning = asArray(canonical?.qa?.candidateWarnings)[0];
  const text = cleanText(derived?.candidateReconciliationText)
    || cleanText(warning)
    || "Candidate reconciliation complete.";
  setText("v3ElectionDataCandidateMapStatus", text);

  const editor = document.getElementById("v3ElectionDataCandidateMapJson");
  if (editor instanceof HTMLTextAreaElement && !editor.dataset.userTouched && cleanText(editor.value) === "") {
    editor.value = JSON.stringify({}, null, 2);
  }
}
