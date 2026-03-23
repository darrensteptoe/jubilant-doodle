export function renderDistrictV2TurnoutBaselineCard({ turnoutBaselineCard, createFieldGrid, getCardBody }) {
  const body = getCardBody(turnoutBaselineCard);

  const grid = createFieldGrid("fpe-field-grid--3");
  grid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2TurnoutA">Turnout cycle A (%)</label>
      <input class="fpe-input" id="v3DistrictV2TurnoutA" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2TurnoutB">Turnout cycle B (%)</label>
      <input class="fpe-input" id="v3DistrictV2TurnoutB" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2BandWidth">Band width (±)</label>
      <input class="fpe-input" id="v3DistrictV2BandWidth" max="25" min="0" step="0.5" type="number"/>
    </div>
  `;

  const note = document.createElement("div");
  note.className = "fpe-help fpe-help--flush";
  note.textContent = "These turnout anchors feed District baseline and right-rail turnout framing.";

  body.append(grid, note);
}
