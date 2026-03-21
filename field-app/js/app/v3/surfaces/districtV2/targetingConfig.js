export function renderDistrictV2TargetingCard({ targetingCard, getCardBody }) {
  const body = getCardBody(targetingCard);
  body.innerHTML = `
    <div class="fpe-targeting-lab">
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingGeoLevel">Geography level</label>
          <select class="fpe-input" id="v3DistrictV2TargetingGeoLevel"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingModelId">Target model</label>
          <select class="fpe-input" id="v3DistrictV2TargetingModelId"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingTopN">Top N</label>
          <input class="fpe-input" id="v3DistrictV2TargetingTopN" min="1" step="1" type="number"/>
        </div>
      </div>

      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingMinHousingUnits">Minimum housing units</label>
          <input class="fpe-input" id="v3DistrictV2TargetingMinHousingUnits" min="0" step="1" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingMinPopulation">Minimum population</label>
          <input class="fpe-input" id="v3DistrictV2TargetingMinPopulation" min="0" step="1" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingMinScore">Minimum score</label>
          <input class="fpe-input" id="v3DistrictV2TargetingMinScore" min="0" step="0.1" type="number"/>
        </div>
      </div>

      <div class="fpe-action-row">
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingOnlyRaceFootprint" type="checkbox"/>
          <span>Only race footprint</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingPrioritizeYoung" type="checkbox"/>
          <span>Prioritize young profile</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingPrioritizeRenters" type="checkbox"/>
          <span>Prioritize renters</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingAvoidHighMultiUnit" type="checkbox"/>
          <span>Avoid high multi-unit</span>
        </label>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingDensityFloor">Density floor</label>
          <select class="fpe-input" id="v3DistrictV2TargetingDensityFloor"></select>
        </div>
      </div>

      <div class="fpe-help fpe-help--flush">House model weights (used when Target model = House Model v1).</div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightVotePotential">Vote potential weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightVotePotential" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightTurnoutOpportunity">Turnout opportunity weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightTurnoutOpportunity" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightPersuasionIndex">Persuasion index weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightPersuasionIndex" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightFieldEfficiency">Field efficiency weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightFieldEfficiency" min="0" step="0.01" type="number"/>
        </div>
      </div>

      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2TargetingResetWeights" type="button">Reset house weights</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2RunTargeting" type="button">Run targeting</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ExportTargetingCsv" type="button">Export targets CSV</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ExportTargetingJson" type="button">Export targets JSON</button>
      </div>

      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingStatus">-</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingMeta">-</div>

      <div class="table-wrap">
        <table class="table" aria-label="District V2 targeting rankings">
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
          <tbody id="v3DistrictV2TargetingResultsTbody">
            <tr><td class="muted" colspan="6">Run targeting to generate ranked GEOs.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
