export function renderDistrictTargetingCard({ targetingCard, getCardBody }) {
  const targetingBody = getCardBody(targetingCard);
  targetingBody.innerHTML = `
    <div class="fpe-targeting-lab">
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingGeoLevel">Geography level</label>
          <select class="fpe-input" id="v3DistrictTargetingGeoLevel"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingModelId">Target model</label>
          <select class="fpe-input" id="v3DistrictTargetingModelId"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingTopN">Top N</label>
          <input class="fpe-input" id="v3DistrictTargetingTopN" min="1" step="1" type="number"/>
        </div>
      </div>

      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingMinHousingUnits">Minimum housing units</label>
          <input class="fpe-input" id="v3DistrictTargetingMinHousingUnits" min="0" step="1" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingMinPopulation">Minimum population</label>
          <input class="fpe-input" id="v3DistrictTargetingMinPopulation" min="0" step="1" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingMinScore">Minimum score</label>
          <input class="fpe-input" id="v3DistrictTargetingMinScore" min="0" step="0.1" type="number"/>
        </div>
      </div>

      <div class="fpe-action-row">
        <label class="fpe-switch">
          <input id="v3DistrictTargetingOnlyRaceFootprint" type="checkbox"/>
          <span>Only race footprint</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictTargetingPrioritizeYoung" type="checkbox"/>
          <span>Prioritize young profile</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictTargetingPrioritizeRenters" type="checkbox"/>
          <span>Prioritize renters</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictTargetingAvoidHighMultiUnit" type="checkbox"/>
          <span>Avoid high multi-unit</span>
        </label>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingDensityFloor">Density floor</label>
          <select class="fpe-input" id="v3DistrictTargetingDensityFloor"></select>
        </div>
      </div>

      <div class="fpe-help fpe-help--flush">House model weights (used when Target model = House Model v1). Weights auto-normalize on run.</div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingWeightVotePotential">Vote potential weight</label>
          <input class="fpe-input" id="v3DistrictTargetingWeightVotePotential" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingWeightTurnoutOpportunity">Turnout opportunity weight</label>
          <input class="fpe-input" id="v3DistrictTargetingWeightTurnoutOpportunity" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingWeightPersuasionIndex">Persuasion index weight</label>
          <input class="fpe-input" id="v3DistrictTargetingWeightPersuasionIndex" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictTargetingWeightFieldEfficiency">Field efficiency weight</label>
          <input class="fpe-input" id="v3DistrictTargetingWeightFieldEfficiency" min="0" step="0.01" type="number"/>
        </div>
      </div>

      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictTargetingResetWeights" type="button">Reset house weights</button>
      </div>

      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictRunTargeting" type="button">Run targeting</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictExportTargetingCsv" type="button">Export targets CSV</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictExportTargetingJson" type="button">Export targets JSON</button>
      </div>

      <div class="fpe-help fpe-help--flush" id="v3DistrictTargetingStatus">-</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictTargetingMeta">-</div>

      <div class="table-wrap">
        <table class="table" aria-label="Targeting rankings (v3)">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Geography</th>
              <th class="num">Score</th>
              <th class="num">Votes/hr</th>
              <th>Reason</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody id="v3DistrictTargetingResultsTbody">
            <tr><td class="muted" colspan="6">Run targeting to generate ranked GEOs.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
