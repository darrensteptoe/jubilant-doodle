export function renderDistrictV2BallotCard({ ballotCard, createFieldGrid, getCardBody }) {
  const body = getCardBody(ballotCard);

  const topGrid = createFieldGrid("fpe-field-grid--3");
  topGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2YourCandidate">You are</label>
      <select class="fpe-input" id="v3DistrictV2YourCandidate"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UndecidedPct">Undecided %</label>
      <input class="fpe-input" id="v3DistrictV2UndecidedPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2UndecidedMode">Undecided break</label>
      <select class="fpe-input" id="v3DistrictV2UndecidedMode"></select>
    </div>
  `;

  const actionRow = document.createElement("div");
  actionRow.className = "fpe-action-row";
  actionRow.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2AddCandidate" type="button">Add candidate</button>
  `;

  body.append(topGrid, actionRow);

  body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="table-wrap fpe-ballot-table">
        <table class="table" aria-label="District V2 ballot table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="num">Support %</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="v3DistrictV2CandTbody"></tbody>
          <tfoot>
            <tr>
              <td class="muted"><strong>Total</strong></td>
              <td class="num"><strong id="v3DistrictV2SupportTotal">-</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="fpe-contained-block" id="v3DistrictV2UserSplitWrap" hidden>
        <div class="fpe-help fpe-help--flush">User-defined undecided split %</div>
        <div class="fpe-field-grid fpe-field-grid--2" id="v3DistrictV2UserSplitList"></div>
        <div class="fpe-help fpe-help--flush">Must sum to 100% across candidates.</div>
      </div>
      <div class="fpe-alert fpe-alert--warn" id="v3DistrictV2CandWarn" hidden></div>
    `,
  );
}
