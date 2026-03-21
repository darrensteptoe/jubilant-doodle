export function renderDistrictV2ElectorateCard({ electorateCard, createFieldGrid, getCardBody }) {
  const body = getCardBody(electorateCard);

  const setupGrid = createFieldGrid("fpe-field-grid--2");
  setupGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UniverseSize">Universe size (U)</label>
      <input class="fpe-input" id="v3DistrictV2UniverseSize" min="0" step="1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UniverseBasis">Universe basis</label>
      <select class="fpe-input" id="v3DistrictV2UniverseBasis"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2SourceNote">Source note</label>
      <input class="fpe-input" id="v3DistrictV2SourceNote" type="text"/>
    </div>
  `;

  const weightingRow = document.createElement("div");
  weightingRow.className = "fpe-action-row";
  weightingRow.innerHTML = `
    <label class="fpe-switch">
      <input id="v3DistrictV2Universe16Enabled" type="checkbox"/>
      <span>Enable weighted electorate composition</span>
    </label>
  `;

  const shareGrid = createFieldGrid("fpe-field-grid--4");
  shareGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UniverseDemPct">Dem share (%)</label>
      <input class="fpe-input" id="v3DistrictV2UniverseDemPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UniverseRepPct">Rep share (%)</label>
      <input class="fpe-input" id="v3DistrictV2UniverseRepPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UniverseNpaPct">Unaffiliated share (%)</label>
      <input class="fpe-input" id="v3DistrictV2UniverseNpaPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UniverseOtherPct">Other share (%)</label>
      <input class="fpe-input" id="v3DistrictV2UniverseOtherPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2RetentionFactor">Support retention (0.60-0.95)</label>
      <input class="fpe-input" id="v3DistrictV2RetentionFactor" max="0.95" min="0.60" step="0.01" type="number"/>
    </div>
  `;

  body.append(setupGrid, weightingRow, shareGrid);
}
