import { renderDistrictCandidateHistoryBlockHtml } from "./candidateHistory.js";

export function renderDistrictBallotCard({ baselineCard, createFieldGrid, getCardBody }) {
  const baselineBody = getCardBody(baselineCard);
  const baselineTop = createFieldGrid("fpe-field-grid--3");
  baselineTop.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictYourCandidate">You are</label>
      <select class="fpe-input" id="v3DistrictYourCandidate"></select>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictUndecidedPct">Undecided %</label>
      <input class="fpe-input" id="v3DistrictUndecidedPct" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictUndecidedMode">Undecided break</label>
      <select class="fpe-input" id="v3DistrictUndecidedMode"></select>
    </div>
  `;
  baselineBody.append(baselineTop);

  const baselineActions = document.createElement("div");
  baselineActions.className = "fpe-action-row";
  baselineActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnAddCandidate" type="button">Add candidate</button>
  `;
  baselineBody.append(baselineActions);

  baselineBody.insertAdjacentHTML(
    "beforeend",
    `
      <div class="table-wrap fpe-ballot-table">
        <table class="table" aria-label="Candidate support table (v3)">
          <thead>
            <tr>
              <th>Name</th>
              <th class="num">Support %</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="v3DistrictCandTbody"></tbody>
          <tfoot>
            <tr>
              <td class="muted"><strong>Total</strong></td>
              <td class="num"><strong id="v3DistrictSupportTotal">-</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="fpe-contained-block" id="v3DistrictUserSplitWrap" hidden>
        <div class="fpe-help fpe-help--flush">User-defined undecided split %</div>
        <div class="fpe-field-grid fpe-field-grid--2" id="v3DistrictUserSplitList"></div>
        <div class="fpe-help fpe-help--flush">Must sum to 100% across candidates.</div>
      </div>
      <div class="fpe-alert fpe-alert--warn" id="v3DistrictCandWarn" hidden></div>
      ${renderDistrictCandidateHistoryBlockHtml()}
    `,
  );
}
