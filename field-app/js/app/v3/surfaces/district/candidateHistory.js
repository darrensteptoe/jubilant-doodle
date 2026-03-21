export function renderDistrictCandidateHistoryBlockHtml() {
  return `
    <div class="fpe-contained-block">
      <div class="fpe-action-row">
        <div class="fpe-help fpe-help--flush">
          Candidate history baseline (office/cycle-level records that influence forecast baseline and confidence).
        </div>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnAddCandidateHistory" type="button">Add history row</button>
      </div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictCandidateHistorySummary">No candidate history rows.</div>
      <div class="table-wrap fpe-ballot-table">
        <table class="table" aria-label="Candidate history baseline table (v3)">
          <thead>
            <tr>
              <th>Office</th>
              <th class="num">Cycle</th>
              <th>Election</th>
              <th>Candidate</th>
              <th>Party</th>
              <th>Incumbency</th>
              <th class="num">Vote %</th>
              <th class="num">Margin</th>
              <th class="num">Turnout %</th>
              <th>Repeat</th>
              <th class="num">Over/Under %</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="v3DistrictCandidateHistoryTbody"></tbody>
        </table>
      </div>
      <div class="fpe-alert fpe-alert--warn" id="v3DistrictCandidateHistoryWarn" hidden></div>
    </div>
  `;
}
