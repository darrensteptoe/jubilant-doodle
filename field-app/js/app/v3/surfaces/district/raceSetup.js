export function renderDistrictRaceContextCard({ raceCard, createFieldGrid, getCardBody }) {
  const raceGrid = createFieldGrid("fpe-field-grid--2");
  const raceBody = getCardBody(raceCard);
  raceGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictRaceType">Race template</label>
      <select class="fpe-input" id="v3DistrictRaceType"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictElectionDate">Election date</label>
      <input class="fpe-input" id="v3DistrictElectionDate" type="date"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictWeeksRemaining">Weeks remaining (override)</label>
      <input class="fpe-input" id="v3DistrictWeeksRemaining" min="0" step="1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictMode">Mode</label>
      <select class="fpe-input" id="v3DistrictMode"></select>
    </div>
  `;

  const raceTemplateGrid = createFieldGrid("fpe-field-grid--4");
  raceTemplateGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictOfficeLevel">Office level</label>
      <select class="fpe-input" id="v3DistrictOfficeLevel"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictElectionType">Election type</label>
      <select class="fpe-input" id="v3DistrictElectionType"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictSeatContext">Seat context</label>
      <select class="fpe-input" id="v3DistrictSeatContext"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictPartisanshipMode">Partisanship mode</label>
      <select class="fpe-input" id="v3DistrictPartisanshipMode"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictSalienceLevel">Salience level</label>
      <select class="fpe-input" id="v3DistrictSalienceLevel"></select>
    </div>
  `;

  const raceTemplateActions = document.createElement("div");
  raceTemplateActions.className = "fpe-action-row";
  raceTemplateActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictApplyTemplateDefaults" type="button">Apply template defaults</button>
    <span class="fpe-help fpe-help--flush" id="v3DistrictTemplateMeta">Template profile unavailable.</span>
  `;

  raceBody.append(raceGrid, raceTemplateGrid, raceTemplateActions);
}

export function renderDistrictElectorateCard({ electorateCard, createFieldGrid, getCardBody }) {
  const electorateGrid = createFieldGrid("fpe-field-grid--2");
  const electorateBody = getCardBody(electorateCard);
  electorateGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictUniverseSize">Universe size (U)</label>
      <input class="fpe-input" id="v3DistrictUniverseSize" min="0" step="1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictUniverseBasis">Universe basis</label>
      <select class="fpe-input" id="v3DistrictUniverseBasis"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictSourceNote">Source note (optional)</label>
      <input class="fpe-input" id="v3DistrictSourceNote" type="text"/>
    </div>
  `;
  electorateBody.append(electorateGrid);
}

export function renderDistrictTurnoutCard({ turnoutCard, createFieldGrid, getCardBody }) {
  const turnoutBody = getCardBody(turnoutCard);
  const turnoutFields = createFieldGrid("fpe-field-grid--3");
  turnoutFields.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictTurnoutA">Cycle A turnout %</label>
      <input class="fpe-input" id="v3DistrictTurnoutA" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictTurnoutB">Cycle B turnout %</label>
      <input class="fpe-input" id="v3DistrictTurnoutB" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictBandWidth">Band width (±)</label>
      <input class="fpe-input" id="v3DistrictBandWidth" max="25" min="0" step="0.5" type="number"/>
    </div>
  `;
  turnoutBody.append(turnoutFields);
  turnoutBody.insertAdjacentHTML(
    "beforeend",
    `
      <div class="fpe-summary-grid">
        <div class="fpe-summary-row"><span>Expected turnout %</span><strong id="v3DistrictTurnoutExpected">-</strong></div>
        <div class="fpe-summary-row"><span>Best / Worst turnout %</span><strong id="v3DistrictTurnoutBand">-</strong></div>
        <div class="fpe-summary-row"><span>Votes per 1% turnout</span><strong id="v3DistrictVotesPer1pct">-</strong></div>
      </div>
    `,
  );
}

export function renderDistrictStructureCard({ structureCard, createFieldGrid, getCardBody }) {
  const structureBody = getCardBody(structureCard);
  const structureShares = createFieldGrid("fpe-field-grid--4");
  structureShares.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictDemPct">Dem share (%)</label>
      <input class="fpe-input" id="v3DistrictDemPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictRepPct">Rep share (%)</label>
      <input class="fpe-input" id="v3DistrictRepPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictNpaPct">Unaffiliated share (%)</label>
      <input class="fpe-input" id="v3DistrictNpaPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictOtherPct">Other share (%)</label>
      <input class="fpe-input" id="v3DistrictOtherPct" max="100" min="0" step="0.1" type="number"/>
    </div>
  `;
  structureBody.append(structureShares);

  const structureDerived = createFieldGrid("fpe-field-grid--2");
  structureDerived.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictRetentionFactor">Support retention (0.60–0.95)</label>
      <input class="fpe-input" id="v3DistrictRetentionFactor" max="0.95" min="0.60" step="0.01" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictDerived">Derived (internal)</label>
      <div class="fpe-readonly-field" id="v3DistrictDerived">-</div>
    </div>
  `;
  structureBody.append(structureDerived);
  structureBody.insertAdjacentHTML(
    "beforeend",
    `<div class="fpe-alert fpe-alert--warn" id="v3DistrictStructureWarn" hidden></div>`,
  );
}
