export function renderDistrictV2RaceContextCard({ raceCard, createFieldGrid, getCardBody }) {
  const body = getCardBody(raceCard);

  const raceGrid = createFieldGrid("fpe-field-grid--2");
  raceGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2RaceType">Race template</label>
      <select class="fpe-input" id="v3DistrictV2RaceType"></select>
      <div class="fpe-help fpe-help--flush">Race template sets the default planning posture and starting values. Office context fields below describe or refine the contest context, but planning defaults update when the template changes or when template defaults are explicitly reapplied.</div>
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
      <div class="fpe-help fpe-help--flush">Office level helps define contest context. It does not by itself rewrite current planning values unless template defaults are reapplied from the selected race template.</div>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2ElectionType">Election type</label>
      <select class="fpe-input" id="v3DistrictV2ElectionType"></select>
      <div class="fpe-help fpe-help--flush">General, primary, and special contests often behave differently. Use the election type that matches the real race, not the one that leaves the cleanest default posture.</div>
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
      <div class="fpe-help fpe-help--flush">Salience level describes how much attention, outside pressure, and volatility the race is likely to carry. Higher salience means the race should usually be read more cautiously.</div>
    </div>
  `;

  const officeHelp = document.createElement("div");
  officeHelp.className = "fpe-help fpe-help--flush";
  officeHelp.textContent = "Templates and office interpretation now live in the District Reality manual: templates and office context, office breakdown, and office risk flags.";

  const contextGuideRow = document.createElement("div");
  contextGuideRow.className = "fpe-action-row";
  contextGuideRow.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" data-intel-module="districtRaceContext" data-v3-open-manual="1" type="button">Open Race Context manual</button>
    <span class="fpe-help fpe-help--flush">Templates and office interpretation now live in the Manual rail for District Reality.</span>
  `;

  const actionRow = document.createElement("div");
  actionRow.className = "fpe-action-row";
  actionRow.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ApplyTemplateDefaults" type="button">Apply template defaults</button>
    <span class="fpe-help fpe-help--flush" id="v3DistrictV2TemplateMeta">Template profile unavailable.</span>
  `;

  const contextUpdatedHelp = document.createElement("div");
  contextUpdatedHelp.className = "fpe-help fpe-help--flush";
  contextUpdatedHelp.textContent = "Context updated. Current planning values are still retained from the prior template until you apply template defaults.";

  const applyHelp = document.createElement("div");
  applyHelp.className = "fpe-help fpe-help--flush";
  applyHelp.textContent = "Apply defaults from the currently selected race template while preserving protected manual overrides.";

  body.append(raceGrid, templateGrid, officeHelp, contextGuideRow, actionRow, contextUpdatedHelp, applyHelp);
}
