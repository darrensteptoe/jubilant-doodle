export function renderDistrictV2TurnoutBaselineCard({ turnoutBaselineCard, createFieldGrid, getCardBody }) {
  const body = getCardBody(turnoutBaselineCard);

  const grid = createFieldGrid("fpe-field-grid--3");
  grid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2TurnoutA">Turnout cycle A (%)</label>
      <input class="fpe-input" id="v3DistrictV2TurnoutA" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2TurnoutB">Turnout cycle B (%)</label>
      <input class="fpe-input" id="v3DistrictV2TurnoutB" max="100" min="0" step="0.1" type="number"/>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3DistrictV2BandWidth">Band width (±)</label>
      <input class="fpe-input" id="v3DistrictV2BandWidth" max="25" min="0" step="0.5" type="number"/>
    </div>
  `;

  const note = document.createElement("div");
  note.className = "fpe-help fpe-help--flush";
  note.textContent = "Band width is the uncertainty spread around turnout conditions. Wider bands are appropriate when the environment is volatile or poorly understood. Narrow bands should be earned, not assumed.";

  const benchmark = document.createElement("div");
  benchmark.id = "v3DistrictV2TurnoutBenchmarkCard";
  benchmark.className = "fpe-contained-block";
  benchmark.hidden = true;
  benchmark.innerHTML = `
    <div class="fpe-control-label">Election Data benchmark</div>
    <div class="fpe-help fpe-help--flush" id="v3DistrictV2TurnoutBenchmarkStatus">No benchmark recommendations available.</div>
    <div class="fpe-help fpe-help--flush" id="v3DistrictV2TurnoutBenchmarkAnchors">Turnout anchors: —</div>
    <div class="fpe-help fpe-help--flush" id="v3DistrictV2TurnoutBenchmarkBand">Band suggestion: —</div>
    <div class="fpe-help fpe-help--flush" id="v3DistrictV2TurnoutBenchmarkProvenance">Source: imported/computed election benchmark history.</div>
    <div class="fpe-action-row">
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2UseBenchmarkAnchors" type="button">Use benchmark turnout anchors</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2UseBenchmarkBand" type="button">Use benchmark band suggestion</button>
    </div>
  `;

  body.append(grid, note, benchmark);
}
