export function renderDistrictV2RaceContextCard({ raceCard, createFieldGrid, getCardBody }) {
  const body = getCardBody(raceCard);

  const raceGrid = createFieldGrid("fpe-field-grid--2");
  raceGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2RaceType">Race template</label>
      <select class="fpe-input" id="v3DistrictV2RaceType"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2ElectionDate">Election date</label>
      <input class="fpe-input" id="v3DistrictV2ElectionDate" type="date"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2WeeksRemaining">Weeks remaining (override)</label>
      <input class="fpe-input" id="v3DistrictV2WeeksRemaining" min="0" step="1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2Mode">Mode</label>
      <select class="fpe-input" id="v3DistrictV2Mode"></select>
    </div>
  `;

  const templateGrid = createFieldGrid("fpe-field-grid--4");
  templateGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2OfficeLevel">Office level</label>
      <select class="fpe-input" id="v3DistrictV2OfficeLevel"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2ElectionType">Election type</label>
      <select class="fpe-input" id="v3DistrictV2ElectionType"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2SeatContext">Seat context</label>
      <select class="fpe-input" id="v3DistrictV2SeatContext"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2PartisanshipMode">Partisanship mode</label>
      <select class="fpe-input" id="v3DistrictV2PartisanshipMode"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2SalienceLevel">Salience level</label>
      <select class="fpe-input" id="v3DistrictV2SalienceLevel"></select>
    </div>
  `;

  const actionRow = document.createElement("div");
  actionRow.className = "fpe-action-row";
  actionRow.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ApplyTemplateDefaults" type="button">Apply template defaults</button>
    <span class="fpe-help fpe-help--flush" id="v3DistrictV2TemplateMeta">Template profile unavailable.</span>
  `;

  body.append(raceGrid, templateGrid, actionRow);
}
