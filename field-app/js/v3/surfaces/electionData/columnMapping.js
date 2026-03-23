import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function renderElectionDataColumnMappingCard({ columnMappingCard, getCardBody }) {
  getCardBody(columnMappingCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Map CSV source columns to canonical electionData fields.</li>
        <li>Accepts JSON object as either <code>{"canonical":"source"}</code> or <code>{"source":"canonical"}</code>.</li>
      </ul>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3ElectionDataColumnMapJson">Column map JSON</label>
      <textarea class="fpe-input" id="v3ElectionDataColumnMapJson" rows="7" placeholder='{"state_fips":"STATEFP", "county_fips":"COUNTYFP", "candidate":"Candidate"}'></textarea>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnElectionDataApplyColumnMap" type="button">Apply Column Mapping</button>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataColumnMapStatus">No column mapping applied yet.</div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataColumnMapSummary">Mapped columns: 0 · Unmapped columns: 0</div>
  `;
}

export function syncElectionDataColumnMapping(canonical, derived) {
  const schemaMapping = canonical?.schemaMapping && typeof canonical.schemaMapping === "object"
    ? canonical.schemaMapping
    : {};

  const mapped = asArray(schemaMapping.mappedColumns);
  const unmapped = asArray(schemaMapping.unmappedColumns);
  const status = cleanText(schemaMapping.status) || "unmapped";
  const mappingText = cleanText(derived?.mappingText)
    || (status === "mapped" ? "Canonical mapping applied." : "Column mapping required.");

  setText("v3ElectionDataColumnMapStatus", mappingText);
  setText(
    "v3ElectionDataColumnMapSummary",
    `Mapped columns: ${mapped.length.toLocaleString("en-US")} · Unmapped columns: ${unmapped.length.toLocaleString("en-US")}`,
  );

  const editor = document.getElementById("v3ElectionDataColumnMapJson");
  if (editor instanceof HTMLTextAreaElement && !editor.dataset.userTouched) {
    const map = schemaMapping.columnMap && typeof schemaMapping.columnMap === "object"
      ? schemaMapping.columnMap
      : {};
    editor.value = JSON.stringify(map, null, 2);
  }
}
