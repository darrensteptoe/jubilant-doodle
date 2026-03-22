export function renderDistrictV2CensusCard({ censusCard, getCardBody }) {
  const body = getCardBody(censusCard);
  body.innerHTML = `
    <div class="fpe-census-card" id="v3DistrictV2CensusShell">
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusApiKey">Census API key</label>
          <input class="fpe-input" id="v3DistrictV2CensusApiKey" type="text" autocomplete="off"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusAcsYear">ACS 5-year</label>
          <select class="fpe-input" id="v3DistrictV2CensusAcsYear"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusResolution">Resolution</label>
          <select class="fpe-input" id="v3DistrictV2CensusResolution"></select>
        </div>
      </div>

      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusStateFips">State</label>
          <select class="fpe-input" id="v3DistrictV2CensusStateFips"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusCountyFips">County</label>
          <select class="fpe-input" id="v3DistrictV2CensusCountyFips"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusPlaceFips">Place</label>
          <select class="fpe-input" id="v3DistrictV2CensusPlaceFips"></select>
        </div>
      </div>

      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusMetricSet">Data bundle</label>
          <select class="fpe-input" id="v3DistrictV2CensusMetricSet"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusTractFilter">Tract filter</label>
          <select class="fpe-input" id="v3DistrictV2CensusTractFilter"></select>
        </div>
      </div>

      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusGeoSearch">Search GEO name or GEOID</label>
          <input class="fpe-input" id="v3DistrictV2CensusGeoSearch" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusGeoPaste">Paste GEOIDs</label>
          <textarea class="fpe-input" id="v3DistrictV2CensusGeoPaste" rows="2"></textarea>
        </div>
      </div>

      <div class="field">
        <label class="fpe-control-label" for="v3DistrictV2CensusGeoSelect">GEO units</label>
        <select class="fpe-input" id="v3DistrictV2CensusGeoSelect" multiple size="10"></select>
      </div>

      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusLoadGeo" type="button">Load GEO list</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusApplyGeoPaste" type="button">Apply GEOIDs</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusSelectAll" type="button">Select all</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusClearSelection" type="button">Clear selection</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusFetchRows" type="button">Fetch ACS rows</button>
      </div>

      <div class="fpe-action-row">
        <label class="fpe-switch">
          <input id="v3DistrictV2CensusApplyAdjustments" type="checkbox"/>
          <span>Enable census adjustments</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictV2CensusMapQaVtdOverlay" type="checkbox"/>
          <span>Enable VTD overlay</span>
        </label>
      </div>

      <div class="fpe-census-map-row fpe-census-map-row--actions">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusLoadMap" type="button">Load boundaries</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusClearMap" type="button">Clear map</button>
      </div>

      <div class="fpe-field-grid fpe-field-grid--2 fpe-census-map-row--vtd">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2CensusMapQaVtdZip">VTD ZIP overlay source (optional)</label>
          <input accept=".zip,application/zip" class="fpe-input" id="v3DistrictV2CensusMapQaVtdZip" type="file"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3BtnDistrictV2CensusClearVtdZip">VTD ZIP control</label>
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2CensusClearVtdZip" type="button">Clear VTD ZIP</button>
        </div>
      </div>

      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusContextHint">Set state and resolution to define Census context.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusStatus">Ready.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusGeoStats">0 selected of 0 GEOs. 0 rows loaded.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusLastFetch">No fetch yet.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusSelectionSummary">No GEO selected.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusMapStatus">Map idle. Select GEO units and click Load boundaries.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusMapQaVtdZipStatus">No VTD ZIP loaded.</div>

      <div class="fpe-census-map-shell is-idle" id="v3DistrictV2CensusMapShell">
        <div class="census-map" id="v3CensusMapHost" role="img" aria-label="District Census boundaries map"></div>
        <div class="fpe-census-map-overlay" id="v3DistrictV2CensusMapOverlay">Map shell restored. Load boundaries to refresh geometry status.</div>
      </div>
      <div class="fpe-help fpe-help--flush fpe-census-map-labels" id="v3DistrictV2CensusMapLabels">No geography labels loaded.</div>

      <div class="fpe-help fpe-help--flush"><strong>Census advisory / assumptions analysis</strong></div>
      <div class="fpe-help fpe-help--flush">
        Translate loaded ACS conditions into field-operating reality. Values near 1.00 indicate baseline conditions; below 1.00 indicate harder conditions; above 1.00 indicate stronger conditions. APH feasibility is the pacing reality check: if required APH exceeds the achievable band, revisit staffing, timeline, or vote-goal assumptions before locking.
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusAdvisoryStatusSummary">Assumption advisory pending.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusAssumptionProvenance">Assumption provenance not set.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2CensusApplyAdjustmentsStatus">Census-adjusted assumptions are OFF.</div>

      <div class="table-wrap">
        <table class="table" aria-label="District V2 census advisory assumptions table">
          <thead>
            <tr><th>Advisory signal</th><th class="num">Value</th></tr>
          </thead>
          <tbody id="v3DistrictV2CensusAdvisoryTbody">
            <tr><td class="muted" colspan="2">Load ACS rows for selected GEO units to compute advisory indices.</td></tr>
          </tbody>
        </table>
      </div>

      <div class="table-wrap">
        <table class="table" aria-label="District V2 census aggregate table">
          <thead>
            <tr><th>Metric</th><th class="num">Value</th></tr>
          </thead>
          <tbody id="v3DistrictV2CensusAggregateTbody">
            <tr><td class="muted" colspan="2">No ACS rows loaded.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
