import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  readDistrictSnapshot,
  readDistrictTargetingSnapshot,
  readDistrictCensusSnapshot
} from "../stateBridge.js";
import {
  bindCheckboxProxy,
  bindFieldProxy,
  bindSelectProxy,
  bindClickProxy,
  createFieldGrid,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncControlDisabled,
  syncFieldValue,
  syncSelectValue
} from "../surfaceUtils.js";
import { computeUniverseAdjustedRates, normalizeUniversePercents } from "../../../core/universeLayer.js";

let districtLegacyCensusCard = null;

function resolveLegacyCensusCard() {
  if (districtLegacyCensusCard instanceof HTMLElement) {
    return districtLegacyCensusCard;
  }

  const preferred = document.querySelector("#app-shell-legacy #censusPhase1Card");
  if (!(preferred instanceof HTMLElement)) {
    return null;
  }

  districtLegacyCensusCard = preferred;
  return districtLegacyCensusCard;
}

export function renderDistrictSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  frame.classList.add("fpe-surface-frame--single");
  const main = createColumn("primary");

  const raceCard = createCard({
    title: "Race context",
    description: "Race template, election date, weeks remaining, and operating mode."
  });

  const electorateCard = createCard({
    title: "Electorate",
    description: "Universe definition, basis, and source provenance."
  });

  const baselineCard = createCard({
    title: "Ballot baseline",
    description: "Candidate support, undecided handling, and persuasion anchor."
  });

  const turnoutCard = createCard({
    title: "Turnout baseline",
    description: "Comparable-cycle turnout assumptions and uncertainty band."
  });

  const structureCard = createCard({
    title: "Electorate structure",
    description:
      "This layer weights persuasion and turnout reliability by party composition and applies a single retention factor. It is aggregate-only (not a CRM)."
  });
  const structureHeaderToggle = document.createElement("div");
  structureHeaderToggle.className = "fpe-header-switch";
  structureHeaderToggle.innerHTML = `
    <span class="fpe-header-switch__label">Electorate weighting (enable to apply)</span>
    <label class="fpe-switch">
      <input id="v3DistrictElectorateWeightingToggle" type="checkbox"/>
      <span>Enable</span>
    </label>
  `;
  setCardHeaderControl(structureCard, structureHeaderToggle);

  const summaryCard = createCard({
    title: "District summary",
    description: "The baseline state that all downstream surfaces inherit."
  });

  const censusCard = createCard({
    title: "Census assumptions",
    description: "Geography context, ACS rows, aggregate demographics, and election CSV dry-run workflow."
  });

  const targetingCard = createCard({
    title: "Targeting lab",
    description: "Model-driven target ranking layer. Derived analysis only; does not mutate core scenario math."
  });

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
  raceBody.append(raceGrid);

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
    `
  );

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
    `
  );

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
    `<div class="fpe-alert fpe-alert--warn" id="v3DistrictStructureWarn" hidden></div>`
  );

  const censusBody = getCardBody(censusCard);
  const censusLegacyCard = resolveLegacyCensusCard();
  if (censusLegacyCard instanceof HTMLElement) {
    renderDistrictCensusProxyShell({
      legacyCard: censusLegacyCard,
      target: censusBody
    });
  }

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

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Universe</span><strong id="v3DistrictUniverse">-</strong></div>
      <div class="fpe-summary-row"><span>Baseline support total</span><strong id="v3DistrictSupport">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout</span><strong id="v3DistrictTurnout">-</strong></div>
      <div class="fpe-summary-row"><span>Your projected votes</span><strong id="v3DistrictProjected">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3DistrictNeed">-</strong></div>
    </div>
  `;

  const whyPanel = createWhyPanel([
    "District sets the denominators and assumptions every downstream result depends on.",
    "If baseline support or universe definitions drift, all win-path outputs drift with them.",
    "Use this page to verify race reality before operational planning."
  ]);
  const topRow = document.createElement("div");
  topRow.className = "fpe-district-top-row";
  topRow.append(whyPanel, summaryCard);

  main.append(
    topRow,
    raceCard,
    electorateCard,
    baselineCard,
    turnoutCard,
    structureCard,
    censusCard,
    targetingCard
  );

  frame.append(main);
  mount.append(frame);

  bindClickProxy("v3BtnAddCandidate", "btnAddCandidate");
  bindSelectProxy("v3DistrictYourCandidate", "yourCandidate");
  bindFieldProxy("v3DistrictUndecidedPct", "undecidedPct");
  bindSelectProxy("v3DistrictUndecidedMode", "undecidedMode");
  bindSelectProxy("v3DistrictRaceType", "raceType");
  bindFieldProxy("v3DistrictElectionDate", "electionDate");
  bindFieldProxy("v3DistrictWeeksRemaining", "weeksRemaining");
  bindSelectProxy("v3DistrictMode", "mode");
  bindFieldProxy("v3DistrictUniverseSize", "universeSize");
  bindSelectProxy("v3DistrictUniverseBasis", "universeBasis");
  bindFieldProxy("v3DistrictSourceNote", "sourceNote");
  bindCheckboxProxy("v3DistrictElectorateWeightingToggle", "universe16Enabled");
  bindFieldProxy("v3DistrictDemPct", "universe16DemPct");
  bindFieldProxy("v3DistrictRepPct", "universe16RepPct");
  bindFieldProxy("v3DistrictNpaPct", "universe16NpaPct");
  bindFieldProxy("v3DistrictOtherPct", "universe16OtherPct");
  bindFieldProxy("v3DistrictRetentionFactor", "retentionFactor");
  bindFieldProxy("v3DistrictTurnoutA", "turnoutA");
  bindFieldProxy("v3DistrictTurnoutB", "turnoutB");
  bindFieldProxy("v3DistrictBandWidth", "bandWidth");
  bindSelectProxy("v3DistrictTargetingGeoLevel", "targetingGeoLevel");
  bindSelectProxy("v3DistrictTargetingModelId", "targetingModelId");
  bindFieldProxy("v3DistrictTargetingTopN", "targetingTopN");
  bindFieldProxy("v3DistrictTargetingMinHousingUnits", "targetingMinHousingUnits");
  bindFieldProxy("v3DistrictTargetingMinPopulation", "targetingMinPopulation");
  bindFieldProxy("v3DistrictTargetingMinScore", "targetingMinScore");
  bindCheckboxProxy("v3DistrictTargetingOnlyRaceFootprint", "targetingOnlyRaceFootprint");
  bindCheckboxProxy("v3DistrictTargetingPrioritizeYoung", "targetingPrioritizeYoung");
  bindCheckboxProxy("v3DistrictTargetingPrioritizeRenters", "targetingPrioritizeRenters");
  bindCheckboxProxy("v3DistrictTargetingAvoidHighMultiUnit", "targetingAvoidHighMultiUnit");
  bindSelectProxy("v3DistrictTargetingDensityFloor", "targetingDensityFloor");
  bindFieldProxy("v3DistrictTargetingWeightVotePotential", "targetingWeightVotePotential");
  bindFieldProxy("v3DistrictTargetingWeightTurnoutOpportunity", "targetingWeightTurnoutOpportunity");
  bindFieldProxy("v3DistrictTargetingWeightPersuasionIndex", "targetingWeightPersuasionIndex");
  bindFieldProxy("v3DistrictTargetingWeightFieldEfficiency", "targetingWeightFieldEfficiency");
  bindClickProxy("v3BtnDistrictTargetingResetWeights", "btnTargetingResetWeights");
  bindClickProxy("v3BtnDistrictRunTargeting", "btnRunTargeting");
  bindClickProxy("v3BtnDistrictExportTargetingCsv", "btnExportTargetingCsv");
  bindClickProxy("v3BtnDistrictExportTargetingJson", "btnExportTargetingJson");
  bindDistrictCensusProxies();
  return refreshDistrictSummary;
}

function refreshDistrictSummary() {
  const snapshot = readDistrictSnapshot();
  setText("v3DistrictUniverse", snapshot.universe);
  setText("v3DistrictSupport", snapshot.baselineSupport);
  setText("v3DistrictTurnout", snapshot.turnoutExpected);
  setText("v3DistrictProjected", snapshot.projectedVotes);
  setText("v3DistrictNeed", snapshot.persuasionNeed);
  setText("v3DistrictTurnoutExpected", snapshot.turnoutExpected);
  setText("v3DistrictTurnoutBand", snapshot.turnoutBand);
  setText("v3DistrictVotesPer1pct", snapshot.votesPer1pct);
  syncSelectValue("v3DistrictYourCandidate", "yourCandidate");
  syncFieldValue("v3DistrictUndecidedPct", "undecidedPct");
  syncSelectValue("v3DistrictUndecidedMode", "undecidedMode");
  syncControlDisabled("v3DistrictYourCandidate", "yourCandidate");
  syncControlDisabled("v3DistrictUndecidedPct", "undecidedPct");
  syncControlDisabled("v3DistrictUndecidedMode", "undecidedMode");
  syncSelectValue("v3DistrictRaceType", "raceType");
  syncFieldValue("v3DistrictElectionDate", "electionDate");
  syncFieldValue("v3DistrictWeeksRemaining", "weeksRemaining");
  syncSelectValue("v3DistrictMode", "mode");
  syncFieldValue("v3DistrictUniverseSize", "universeSize");
  syncSelectValue("v3DistrictUniverseBasis", "universeBasis");
  syncFieldValue("v3DistrictSourceNote", "sourceNote");
  syncControlDisabled("v3DistrictRaceType", "raceType");
  syncControlDisabled("v3DistrictElectionDate", "electionDate");
  syncControlDisabled("v3DistrictWeeksRemaining", "weeksRemaining");
  syncControlDisabled("v3DistrictMode", "mode");
  syncControlDisabled("v3DistrictUniverseSize", "universeSize");
  syncControlDisabled("v3DistrictUniverseBasis", "universeBasis");
  syncControlDisabled("v3DistrictSourceNote", "sourceNote");
  syncButtonDisabled("v3BtnAddCandidate", "btnAddCandidate");
  syncCheckboxValue("v3DistrictElectorateWeightingToggle", "universe16Enabled");
  syncControlDisabled("v3DistrictElectorateWeightingToggle", "universe16Enabled");
  syncFieldValue("v3DistrictTurnoutA", "turnoutA");
  syncFieldValue("v3DistrictTurnoutB", "turnoutB");
  syncFieldValue("v3DistrictBandWidth", "bandWidth");
  syncControlDisabled("v3DistrictTurnoutA", "turnoutA");
  syncControlDisabled("v3DistrictTurnoutB", "turnoutB");
  syncControlDisabled("v3DistrictBandWidth", "bandWidth");
  syncFieldValue("v3DistrictDemPct", "universe16DemPct");
  syncFieldValue("v3DistrictRepPct", "universe16RepPct");
  syncFieldValue("v3DistrictNpaPct", "universe16NpaPct");
  syncFieldValue("v3DistrictOtherPct", "universe16OtherPct");
  syncFieldValue("v3DistrictRetentionFactor", "retentionFactor");
  syncControlDisabled("v3DistrictDemPct", "universe16DemPct");
  syncControlDisabled("v3DistrictRepPct", "universe16RepPct");
  syncControlDisabled("v3DistrictNpaPct", "universe16NpaPct");
  syncControlDisabled("v3DistrictOtherPct", "universe16OtherPct");
  syncControlDisabled("v3DistrictRetentionFactor", "retentionFactor");
  syncDistrictBallotBaseline();
  syncDistrictStructureDerived();
  syncDistrictTargetingLab();
  syncDistrictCensusProxy();
  syncDistrictCensusMessageTones();
  syncCensusMapShellState();
}

function syncDistrictBallotBaseline() {
  syncDistrictCandidateTable();
  syncDistrictUserSplitTable();
  syncDistrictBallotWarning();
  setText("v3DistrictSupportTotal", document.getElementById("supportTotal")?.textContent || "");
}

function syncDistrictCandidateTable() {
  const sourceBody = document.getElementById("candTbody");
  const targetBody = document.getElementById("v3DistrictCandTbody");
  if (!(sourceBody instanceof HTMLElement) || !(targetBody instanceof HTMLElement)) {
    return;
  }

  if (targetBody.contains(document.activeElement)) {
    return;
  }

  targetBody.innerHTML = "";
  const rows = Array.from(sourceBody.querySelectorAll(":scope > tr"));
  rows.forEach((sourceRow) => {
    if (!(sourceRow instanceof HTMLTableRowElement)) {
      return;
    }

    const nameSource = sourceRow.querySelector("td:nth-child(1) input");
    const pctSource = sourceRow.querySelector("td:nth-child(2) input");
    const removeSource = sourceRow.querySelector("td:nth-child(3) button");

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.className = "fpe-input";
    nameInput.type = "text";
    nameInput.value = nameSource instanceof HTMLInputElement ? nameSource.value : "";
    nameInput.disabled = nameSource instanceof HTMLInputElement ? !!nameSource.disabled : true;
    if (nameSource instanceof HTMLInputElement) {
      nameInput.addEventListener("input", () => {
        nameSource.value = nameInput.value;
        dispatchLegacyInput(nameSource);
      });
    }
    tdName.appendChild(nameInput);

    const tdPct = document.createElement("td");
    tdPct.className = "num";
    const pctInput = document.createElement("input");
    pctInput.className = "fpe-input";
    pctInput.type = "number";
    pctInput.min = "0";
    pctInput.max = "100";
    pctInput.step = "0.1";
    pctInput.value = pctSource instanceof HTMLInputElement ? pctSource.value : "";
    pctInput.disabled = pctSource instanceof HTMLInputElement ? !!pctSource.disabled : true;
    if (pctSource instanceof HTMLInputElement) {
      pctInput.addEventListener("input", () => {
        pctSource.value = pctInput.value;
        dispatchLegacyInput(pctSource);
      });
    }
    tdPct.appendChild(pctInput);

    const tdAction = document.createElement("td");
    tdAction.className = "num";
    const removeBtn = document.createElement("button");
    removeBtn.className = "fpe-btn fpe-btn--ghost";
    removeBtn.type = "button";
    removeBtn.textContent =
      removeSource instanceof HTMLButtonElement && removeSource.textContent
        ? removeSource.textContent.trim() || "Remove"
        : "Remove";
    removeBtn.disabled = !(removeSource instanceof HTMLButtonElement) || !!removeSource.disabled;
    if (removeSource instanceof HTMLButtonElement) {
      removeBtn.addEventListener("click", () => {
        removeSource.click();
      });
    }
    tdAction.appendChild(removeBtn);

    tr.append(tdName, tdPct, tdAction);
    targetBody.appendChild(tr);
  });

  if (!targetBody.children.length) {
    const tr = document.createElement("tr");
    tr.className = "fpe-empty-row";
    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "fpe-empty-state";
    td.textContent = "No candidates available.";
    tr.appendChild(td);
    targetBody.appendChild(tr);
  }
}

function syncDistrictUserSplitTable() {
  const sourceWrap = document.getElementById("userSplitWrap");
  const sourceList = document.getElementById("userSplitList");
  const targetWrap = document.getElementById("v3DistrictUserSplitWrap");
  const targetList = document.getElementById("v3DistrictUserSplitList");
  if (
    !(sourceWrap instanceof HTMLElement) ||
    !(sourceList instanceof HTMLElement) ||
    !(targetWrap instanceof HTMLElement) ||
    !(targetList instanceof HTMLElement)
  ) {
    return;
  }

  const visible = !sourceWrap.hidden;
  targetWrap.hidden = !visible;
  if (!visible) {
    return;
  }

  if (targetList.contains(document.activeElement)) {
    return;
  }

  targetList.innerHTML = "";
  const rows = Array.from(sourceList.children);
  rows.forEach((sourceRow) => {
    if (!(sourceRow instanceof HTMLElement)) {
      return;
    }

    const nameEl = sourceRow.querySelector(":scope > .label");
    const inputSource = sourceRow.querySelector(":scope input");
    if (!(inputSource instanceof HTMLInputElement)) {
      return;
    }

    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.className = "fpe-control-label";
    label.textContent = (nameEl?.textContent || "Candidate").trim();

    const input = document.createElement("input");
    input.className = "fpe-input";
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "0.1";
    input.value = inputSource.value || "";
    input.disabled = !!inputSource.disabled;
    input.addEventListener("input", () => {
      inputSource.value = input.value;
      dispatchLegacyInput(inputSource);
    });

    field.append(label, input);
    targetList.appendChild(field);
  });
}

function syncDistrictBallotWarning() {
  const sourceWarn = document.getElementById("candWarn");
  const targetWarn = document.getElementById("v3DistrictCandWarn");
  if (!(targetWarn instanceof HTMLElement)) {
    return;
  }

  const text = (sourceWarn?.textContent || "").trim();
  const showWarn = Boolean(text) && !sourceWarn?.hidden;
  targetWarn.hidden = !showWarn;
  targetWarn.textContent = showWarn ? text : "";
}

function dispatchLegacyInput(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncDistrictStructureDerived() {
  const derived = document.getElementById("v3DistrictDerived");
  const enabled = readCheckboxChecked("v3DistrictElectorateWeightingToggle");
  const demPct = readNumberField("v3DistrictDemPct");
  const repPct = readNumberField("v3DistrictRepPct");
  const npaPct = readNumberField("v3DistrictNpaPct");
  const otherPct = readNumberField("v3DistrictOtherPct");
  const retentionFactor = readNumberField("v3DistrictRetentionFactor");
  const supportRate = readRateDecimal([
    "v3ReachSupportRatePct",
    "supportRatePct"
  ]);
  const turnoutReliability = readRateDecimal([
    "v3OutcomeTurnoutReliabilityPct",
    "turnoutReliabilityPct"
  ]);
  const adjusted = computeUniverseAdjustedRates({
    enabled,
    universePercents: { demPct, repPct, npaPct, otherPct },
    retentionFactor,
    supportRate,
    turnoutReliability
  });

  if (derived instanceof HTMLElement) {
    if (!enabled) {
      derived.textContent = "Disabled (baseline behavior).";
    } else {
      const parts = [];
      const pMult = Number(adjusted?.meta?.persuasionMultiplier);
      const tMult = Number(adjusted?.meta?.turnoutMultiplier);
      const turnoutBoost = Number(adjusted?.meta?.turnoutBoostApplied);
      const srAdj = Number(adjusted?.srAdj);
      const trAdj = Number(adjusted?.trAdj);
      parts.push(`Persuasion multiplier: ${Number.isFinite(pMult) ? pMult.toFixed(2) : "—"}`);
      parts.push(`Turnout multiplier: ${Number.isFinite(tMult) ? tMult.toFixed(2) : "—"}`);
      parts.push(`Turnout boost: ${Number.isFinite(turnoutBoost) ? `${(turnoutBoost * 100).toFixed(1)}%` : "—"}`);
      parts.push(`Effective support rate: ${Number.isFinite(srAdj) ? `${(srAdj * 100).toFixed(1)}%` : "—"}`);
      parts.push(`Effective turnout reliability: ${Number.isFinite(trAdj) ? `${(trAdj * 100).toFixed(1)}%` : "—"}`);
      derived.textContent = parts.join(" · ");
    }
  }

  const v3Warn = document.getElementById("v3DistrictStructureWarn");
  if (!(v3Warn instanceof HTMLElement)) {
    return;
  }

  const normalized = normalizeUniversePercents({ demPct, repPct, npaPct, otherPct });
  const text = enabled && normalized?.normalized ? String(normalized.warning || "").trim() : "";
  const showWarn = Boolean(text);
  v3Warn.hidden = !showWarn;
  v3Warn.textContent = showWarn ? text : "";
}

function readNumberField(id) {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLInputElement)) {
    return null;
  }
  const value = Number(node.value);
  return Number.isFinite(value) ? value : null;
}

function readCheckboxChecked(id) {
  const node = document.getElementById(id);
  return node instanceof HTMLInputElement ? !!node.checked : false;
}

function readRateDecimal(ids = []) {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (!(node instanceof HTMLInputElement)) {
      continue;
    }
    const value = Number(node.value);
    if (Number.isFinite(value)) {
      return Math.max(0, Math.min(100, value)) / 100;
    }
  }
  return null;
}

function syncDistrictTargetingLab() {
  const bridgeSnapshot = readDistrictTargetingSnapshot();
  if (bridgeSnapshot) {
    setText("v3DistrictTargetingStatus", bridgeSnapshot.statusText || "Run targeting to generate ranked GEOs.");
    setText("v3DistrictTargetingMeta", bridgeSnapshot.metaText || "No targeting run yet.");
    renderDistrictTargetingRows(bridgeSnapshot.rows || []);
  } else {
    setText("v3DistrictTargetingStatus", "Run targeting to generate ranked GEOs.");
    setText("v3DistrictTargetingMeta", "No targeting run yet.");
    renderDistrictTargetingRows([]);
  }

  // Keep select option lists hydrated from legacy controls, then apply bridge-selected value.
  syncSelectValue("v3DistrictTargetingGeoLevel", "targetingGeoLevel");
  syncSelectValue("v3DistrictTargetingModelId", "targetingModelId");
  syncSelectValue("v3DistrictTargetingDensityFloor", "targetingDensityFloor");

  const targetingConfig = bridgeSnapshot?.config;
  if (targetingConfig && typeof targetingConfig === "object") {
    syncBridgeSelectValue("v3DistrictTargetingGeoLevel", targetingConfig.geoLevel);
    syncBridgeSelectValue("v3DistrictTargetingModelId", targetingConfig.presetId || targetingConfig.modelId);
    syncBridgeFieldValue("v3DistrictTargetingTopN", targetingConfig.topN);
    syncBridgeFieldValue("v3DistrictTargetingMinHousingUnits", targetingConfig.minHousingUnits);
    syncBridgeFieldValue("v3DistrictTargetingMinPopulation", targetingConfig.minPopulation);
    syncBridgeFieldValue("v3DistrictTargetingMinScore", targetingConfig.minScore);
    syncBridgeCheckboxValue("v3DistrictTargetingOnlyRaceFootprint", targetingConfig.onlyRaceFootprint);
    syncBridgeCheckboxValue("v3DistrictTargetingPrioritizeYoung", targetingConfig.prioritizeYoung);
    syncBridgeCheckboxValue("v3DistrictTargetingPrioritizeRenters", targetingConfig.prioritizeRenters);
    syncBridgeCheckboxValue("v3DistrictTargetingAvoidHighMultiUnit", targetingConfig.avoidHighMultiUnit);
    syncBridgeSelectValue("v3DistrictTargetingDensityFloor", targetingConfig.densityFloor);
    syncBridgeFieldValue("v3DistrictTargetingWeightVotePotential", targetingConfig.weightVotePotential);
    syncBridgeFieldValue("v3DistrictTargetingWeightTurnoutOpportunity", targetingConfig.weightTurnoutOpportunity);
    syncBridgeFieldValue("v3DistrictTargetingWeightPersuasionIndex", targetingConfig.weightPersuasionIndex);
    syncBridgeFieldValue("v3DistrictTargetingWeightFieldEfficiency", targetingConfig.weightFieldEfficiency);
  } else {
    syncFieldValue("v3DistrictTargetingTopN", "targetingTopN");
    syncFieldValue("v3DistrictTargetingMinHousingUnits", "targetingMinHousingUnits");
    syncFieldValue("v3DistrictTargetingMinPopulation", "targetingMinPopulation");
    syncFieldValue("v3DistrictTargetingMinScore", "targetingMinScore");
    syncCheckboxValue("v3DistrictTargetingOnlyRaceFootprint", "targetingOnlyRaceFootprint");
    syncCheckboxValue("v3DistrictTargetingPrioritizeYoung", "targetingPrioritizeYoung");
    syncCheckboxValue("v3DistrictTargetingPrioritizeRenters", "targetingPrioritizeRenters");
    syncCheckboxValue("v3DistrictTargetingAvoidHighMultiUnit", "targetingAvoidHighMultiUnit");
    syncFieldValue("v3DistrictTargetingWeightVotePotential", "targetingWeightVotePotential");
    syncFieldValue("v3DistrictTargetingWeightTurnoutOpportunity", "targetingWeightTurnoutOpportunity");
    syncFieldValue("v3DistrictTargetingWeightPersuasionIndex", "targetingWeightPersuasionIndex");
    syncFieldValue("v3DistrictTargetingWeightFieldEfficiency", "targetingWeightFieldEfficiency");
  }

  syncControlDisabled("v3DistrictTargetingGeoLevel", "targetingGeoLevel");
  syncControlDisabled("v3DistrictTargetingModelId", "targetingModelId");
  syncControlDisabled("v3DistrictTargetingTopN", "targetingTopN");
  syncControlDisabled("v3DistrictTargetingMinHousingUnits", "targetingMinHousingUnits");
  syncControlDisabled("v3DistrictTargetingMinPopulation", "targetingMinPopulation");
  syncControlDisabled("v3DistrictTargetingMinScore", "targetingMinScore");
  syncControlDisabled("v3DistrictTargetingOnlyRaceFootprint", "targetingOnlyRaceFootprint");
  syncControlDisabled("v3DistrictTargetingPrioritizeYoung", "targetingPrioritizeYoung");
  syncControlDisabled("v3DistrictTargetingPrioritizeRenters", "targetingPrioritizeRenters");
  syncControlDisabled("v3DistrictTargetingAvoidHighMultiUnit", "targetingAvoidHighMultiUnit");
  syncControlDisabled("v3DistrictTargetingDensityFloor", "targetingDensityFloor");
  syncControlDisabled("v3DistrictTargetingWeightVotePotential", "targetingWeightVotePotential");
  syncControlDisabled("v3DistrictTargetingWeightTurnoutOpportunity", "targetingWeightTurnoutOpportunity");
  syncControlDisabled("v3DistrictTargetingWeightPersuasionIndex", "targetingWeightPersuasionIndex");
  syncControlDisabled("v3DistrictTargetingWeightFieldEfficiency", "targetingWeightFieldEfficiency");
  syncButtonDisabled("v3BtnDistrictTargetingResetWeights", "btnTargetingResetWeights");
  syncButtonDisabled("v3BtnDistrictRunTargeting", "btnRunTargeting");
  syncButtonDisabled("v3BtnDistrictExportTargetingCsv", "btnExportTargetingCsv");
  syncButtonDisabled("v3BtnDistrictExportTargetingJson", "btnExportTargetingJson");
}

function syncBridgeSelectValue(v3Id, value) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLSelectElement) || document.activeElement === v3) {
    return;
  }
  const next = String(value == null ? "" : value).trim();
  if (!next) {
    return;
  }
  const hasOption = Array.from(v3.options).some((option) => option.value === next);
  if (hasOption) {
    v3.value = next;
  }
}

function syncBridgeFieldValue(v3Id, value) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement || v3 instanceof HTMLTextAreaElement) || document.activeElement === v3) {
    return;
  }
  if (value == null || value === "") {
    return;
  }
  v3.value = String(value);
}

function syncBridgeCheckboxValue(v3Id, value) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement) || document.activeElement === v3) {
    return;
  }
  v3.checked = !!value;
}

function renderDistrictTargetingRows(rows) {
  const tbody = document.getElementById("v3DistrictTargetingResultsTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  tbody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="6">Run targeting to generate ranked GEOs.</td>';
    tbody.append(tr);
    return;
  }

  for (const row of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${escapeHtml(row.rank || "—")}</td>
      <td>${escapeHtml(row.geography || "—")}</td>
      <td class="num">${escapeHtml(row.score || "—")}</td>
      <td class="num">${escapeHtml(row.votesPerHour || "—")}</td>
      <td>${escapeHtml(row.reason || "—")}</td>
      <td>${escapeHtml(row.flags || "—")}</td>
    `;
    tbody.append(tr);
  }
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDistrictCensusProxyShell({ legacyCard, target }) {
  if (!(target instanceof HTMLElement) || !(legacyCard instanceof HTMLElement)) {
    return;
  }

  const shell = document.createElement("div");
  shell.id = "v3DistrictCensusShell";
  shell.className = "fpe-census-card";
  shell.innerHTML = `
    <div class="fpe-census-layout">
      <section class="fpe-census-section">
        <header class="fpe-census-section__head">
          <div class="fpe-census-section__head-main">
            <h3 class="fpe-census-section__title">GEO data workflow</h3>
          </div>
          <p class="fpe-census-section__desc">Run setup, select GEO units, and review aggregate outputs in one contained workflow.</p>
        </header>
        <div class="fpe-census-section__body">
          <section class="fpe-census-subsection fpe-census-subsection--setup">
            <h4 class="fpe-census-subsection__title">Setup</h4>
            <p class="fpe-census-subsection__desc">Geography context and scope for Census data pulls.</p>
            <div class="fpe-census-subsection__body">
              <div class="fpe-field-grid fpe-field-grid--1">
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusApiKey">Census API key</label>
                  <input class="fpe-input" id="v3CensusApiKey" type="text" autocomplete="off"/>
                </div>
              </div>
              <div class="fpe-field-grid fpe-field-grid--1">
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusAcsYear">ACS 5-year</label>
                  <select class="fpe-input" id="v3CensusAcsYear"></select>
                </div>
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusResolution">Resolution</label>
                  <select class="fpe-input" id="v3CensusResolution"></select>
                </div>
              </div>
              <div class="fpe-help fpe-help--flush" id="v3CensusContextHint">State-only context active for this resolution.</div>
              <div class="fpe-field-grid fpe-field-grid--1">
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusStateFips">State</label>
                  <select class="fpe-input" id="v3CensusStateFips"></select>
                </div>
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusCountyFips">County</label>
                  <select class="fpe-input" id="v3CensusCountyFips"></select>
                </div>
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusPlaceFips">Place</label>
                  <select class="fpe-input" id="v3CensusPlaceFips"></select>
                </div>
              </div>
            </div>
          </section>

          <section class="fpe-census-subsection">
            <h4 class="fpe-census-subsection__title">Selection</h4>
            <p class="fpe-census-subsection__desc">Search/paste/select GEO units and manage saved sets.</p>
            <div class="fpe-census-subsection__body">
              <div class="field">
                <label class="fpe-control-label">Fetch actions</label>
                <div class="fpe-action-row">
                  <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusLoadGeo" type="button">Load GEO list</button>
                </div>
              </div>
              <div class="field">
                <label class="fpe-control-label" for="v3CensusGeoSearch">Search GEO name or GEOID</label>
                <input class="fpe-input" id="v3CensusGeoSearch" type="text"/>
              </div>
              <div class="field">
                <label class="fpe-control-label" for="v3CensusTractFilter">Tract filter</label>
                <select class="fpe-input" id="v3CensusTractFilter"></select>
              </div>
              <div class="field">
                <label class="fpe-control-label" for="v3CensusGeoPaste">Paste GEOIDs</label>
                <textarea class="fpe-input" id="v3CensusGeoPaste" rows="2"></textarea>
              </div>
              <div class="fpe-action-row">
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusApplyGeoPaste" type="button">Apply GEOIDs</button>
              </div>
              <div class="field">
                <label class="fpe-control-label" for="v3CensusGeoSelect">GEO units</label>
                <select class="fpe-input" id="v3CensusGeoSelect" multiple size="12"></select>
              </div>
              <div class="fpe-action-row">
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusSelectAll" type="button">Select all</button>
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusClearSelection" type="button">Clear</button>
              </div>
              <div class="fpe-field-grid fpe-field-grid--2">
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusSelectionSetName">Save selection set</label>
                  <div class="fpe-action-row">
                    <input class="fpe-input" id="v3CensusSelectionSetName" type="text"/>
                    <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusSaveSelectionSet" type="button">Save set</button>
                  </div>
                </div>
                <div class="field">
                  <label class="fpe-control-label" for="v3CensusSelectionSetSelect">Saved sets</label>
                  <div class="fpe-action-row">
                    <select class="fpe-input" id="v3CensusSelectionSetSelect"></select>
                    <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusLoadSelectionSet" type="button">Load set</button>
                    <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusDeleteSelectionSet" type="button">Delete</button>
                  </div>
                </div>
              </div>
              <div class="fpe-help fpe-help--flush" id="v3CensusSelectionSetStatus">No saved selection sets.</div>
            </div>
          </section>

          <section class="fpe-census-subsection">
            <h4 class="fpe-census-subsection__title">Workflow status</h4>
            <p class="fpe-census-subsection__desc">Live runtime feedback for fetch and selection state.</p>
            <div class="fpe-census-subsection__body">
              <div class="fpe-census-status-strip">
                <div class="fpe-census-status-chip"><div class="muted" id="v3CensusStatus">Ready.</div></div>
                <div class="fpe-census-status-chip"><div class="muted" id="v3CensusGeoStats">0 selected of 0 GEOs. 0 rows loaded.</div></div>
                <div class="fpe-census-status-chip"><div class="muted" id="v3CensusLastFetch">No fetch yet.</div></div>
              </div>
            </div>
          </section>

          <section class="fpe-census-subsection fpe-census-subsection--output">
            <h4 class="fpe-census-subsection__title">Output</h4>
            <p class="fpe-census-subsection__desc">Set data bundle, fetch ACS rows, and review aggregate metrics.</p>
            <div class="fpe-census-subsection__body">
              <div class="field">
                <label class="fpe-control-label" for="v3CensusMetricSet">Data bundle</label>
                <select class="fpe-input" id="v3CensusMetricSet"></select>
              </div>
              <div class="field">
                <label class="fpe-control-label">Fetch actions</label>
                <div class="fpe-action-row fpe-census-fetch-row">
                  <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusFetchRows" type="button">Fetch ACS rows</button>
                </div>
              </div>
              <div class="table-wrap">
                <table class="table" aria-label="Census aggregate table (v3)">
                  <thead>
                    <tr><th>Metric</th><th class="num">Value</th></tr>
                  </thead>
                  <tbody id="v3CensusAggregateTbody">
                    <tr><td class="muted" colspan="2">No ACS rows loaded.</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="fpe-action-row fpe-census-aggregate-actions">
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusExportAggregateCsv" type="button">Export CSV</button>
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusExportAggregateJson" type="button">Export JSON</button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="fpe-census-section">
        <header class="fpe-census-section__head">
          <div class="fpe-census-section__head-main">
            <h3 class="fpe-census-section__title">Race footprint and assumption apply</h3>
            <div class="fpe-header-switch fpe-card__head-control">
              <span class="fpe-header-switch__label">Census adjustments (enable to apply)</span>
              <label class="fpe-switch">
                <input id="v3CensusApplyAdjustmentsToggle" type="checkbox"/>
                <span>Enable</span>
              </label>
            </div>
          </div>
          <p class="fpe-census-section__desc">Bind selected GEO units to race footprint and control adjusted-assumption application.</p>
        </header>
        <div class="fpe-census-section__body">
          <div class="fpe-action-row">
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusSetRaceFootprint" type="button">Set as race footprint</button>
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusClearRaceFootprint" type="button">Clear race footprint</button>
          </div>
          <div class="fpe-message-window fpe-message-window--status" id="v3CensusFootprintStatusWindow">
            <div class="fpe-message-window__head"><span class="fpe-message-window__tag">Current status</span></div>
            <div class="fpe-message-window__body">
              <ul class="fpe-census-status-list" id="v3CensusFootprintStatusList">
                <li class="fpe-census-status-item"><span id="v3CensusSelectionSummary">No GEO selected.</span></li>
                <li class="fpe-census-status-item"><span id="v3CensusRaceFootprintStatus">Race footprint not set.</span></li>
                <li class="fpe-census-status-item"><span id="v3CensusAssumptionProvenanceStatus">Assumption provenance not set.</span></li>
                <li class="fpe-census-status-item"><span id="v3CensusFootprintCapacityStatus">Footprint capacity: not set.</span></li>
                <li class="fpe-census-status-item"><span id="v3CensusApplyAdjustmentsStatus">Census-adjusted assumptions are OFF.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="fpe-census-section">
        <header class="fpe-census-section__head">
          <div class="fpe-census-section__head-main">
            <h3 class="fpe-census-section__title">Advisory signals</h3>
          </div>
          <p class="fpe-census-section__desc">Review computed signal levels and interpretation guidance for the selected footprint.</p>
        </header>
        <div class="fpe-census-section__body">
          <details class="fpe-census-instruction-details fpe-census-election-details" id="v3CensusAdvisoryGuide">
            <summary>Instructions</summary>
            <div class="fpe-census-election-guide">
              <div class="fpe-message-window fpe-message-window--tip">
                <div class="fpe-message-window__head"><span class="fpe-message-window__tag">Instruction flow</span></div>
                <div class="fpe-message-window__body">
                  <ul class="fpe-census-instruction-list">
                    <li class="fpe-census-instruction-item">Use this module to translate selected GEO demographics into practical operating constraints before finalizing plan assumptions.</li>
                    <li class="fpe-census-instruction-item">Read the signal table first: values near 1.00 are baseline, values below 1.00 indicate lower capacity or tougher conditions, and values above 1.00 indicate stronger conditions.</li>
                    <li class="fpe-census-instruction-item">Treat APH feasibility as the decision gate: if required APH is above the achievable band, adjust staffing, timeline, or expected vote need before locking assumptions.</li>
                  </ul>
                </div>
              </div>
            </div>
          </details>
          <div class="table-wrap">
            <table class="table" aria-label="Census assumptions advisory (v3)">
              <thead>
                <tr><th>Advisory signal</th><th class="num">Value</th></tr>
              </thead>
              <tbody id="v3CensusAdvisoryTbody">
                <tr><td class="muted" colspan="2">Load ACS rows for selected GEO units to compute advisory indices.</td></tr>
              </tbody>
            </table>
          </div>
          <div class="fpe-message-window fpe-message-window--status" id="v3CensusAdvisoryStatusWindow">
            <div class="fpe-message-window__head"><span class="fpe-message-window__tag">Signal status</span></div>
            <div class="fpe-message-window__body">
              <div class="muted" id="v3CensusAdvisoryStatus">Assumption advisory pending.</div>
            </div>
          </div>
        </div>
      </section>

      <section class="fpe-census-section">
        <header class="fpe-census-section__head">
          <div class="fpe-census-section__head-main">
            <h3 class="fpe-census-section__title">Election CSV intake</h3>
          </div>
          <p class="fpe-census-section__desc">Template download, dry-run validation, and preview before import.</p>
        </header>
        <div class="fpe-census-section__body">
          <details class="fpe-census-instruction-details fpe-census-election-details" id="v3CensusElectionGuide">
            <summary>Instructions</summary>
            <div class="fpe-census-election-guide">
              <div class="fpe-message-window fpe-message-window--tip">
                <div class="fpe-message-window__head"><span class="fpe-message-window__tag">Instruction flow</span></div>
                <div class="fpe-message-window__body">
                  <div class="muted" id="v3CensusElectionCsvGuideStatus">Election CSV schema guide loading.</div>
                </div>
              </div>
              <div class="fpe-action-row fpe-census-template-actions">
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusDownloadElectionCsvTemplate" type="button">Download long-format CSV template</button>
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusDownloadElectionCsvWideTemplate" type="button">Download wide-format CSV template</button>
              </div>
            </div>
          </details>
          <div class="fpe-field-grid fpe-field-grid--2">
            <div class="field">
              <label class="fpe-control-label" for="v3CensusElectionCsvFile">Election CSV file</label>
              <input class="fpe-input" id="v3CensusElectionCsvFile" type="file" accept=".csv,text/csv"/>
            </div>
            <div class="field">
              <label class="fpe-control-label">Dry-run</label>
              <div class="fpe-action-row">
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusElectionCsvDryRun" type="button">Run dry-run parse</button>
                <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusElectionCsvClear" type="button">Clear preview</button>
              </div>
            </div>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3CensusElectionCsvPrecinctFilter">Preview precinct filter (optional)</label>
            <input class="fpe-input" id="v3CensusElectionCsvPrecinctFilter" type="text"/>
          </div>
          <div class="fpe-census-election-status-strip">
            <div class="fpe-census-status-chip"><div class="muted" id="v3CensusElectionCsvDryRunStatus">No dry-run run yet.</div></div>
            <div class="fpe-census-status-chip"><div class="muted" id="v3CensusElectionCsvPreviewMeta">No normalized preview rows.</div></div>
          </div>
          <div class="table-wrap">
            <table class="table" aria-label="Election CSV dry-run preview (v3)">
              <thead>
                <tr><th>Precinct</th><th>Candidate</th><th class="num">Votes</th><th class="num">Total precinct votes</th></tr>
              </thead>
              <tbody id="v3CensusElectionCsvPreviewTbody">
                <tr><td class="muted" colspan="4">No dry-run preview yet.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="fpe-census-section">
        <header class="fpe-census-section__head">
          <div class="fpe-census-section__head-main">
            <h3 class="fpe-census-section__title">Map and boundary QA</h3>
          </div>
          <p class="fpe-census-section__desc">Boundary overlay controls and QA source management for visual verification.</p>
        </header>
        <div class="fpe-census-section__body">
          <div class="fpe-census-map-row">
            <div class="muted" id="v3CensusMapStatus">Map idle. Select GEO units and click Load boundaries.</div>
          </div>
          <div class="fpe-census-map-row">
            <label class="fpe-switch">
              <input id="v3CensusMapQaVtdToggle" type="checkbox"/>
              <span>Enable VTD overlay</span>
            </label>
            <div class="fpe-action-row">
              <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusLoadMap" type="button">Load boundaries</button>
              <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusClearMap" type="button">Clear map</button>
            </div>
          </div>
          <div class="field">
            <label class="fpe-control-label" for="v3CensusMapQaVtdZip">VTD ZIP overlay source (optional)</label>
            <div class="fpe-action-row">
              <input class="fpe-input" id="v3CensusMapQaVtdZip" type="file" accept=".zip,application/zip"/>
              <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusMapQaVtdZipClear" type="button">Clear VTD ZIP</button>
            </div>
            <div class="fpe-help" id="v3CensusMapQaVtdZipStatus">No VTD ZIP loaded. VTD QA overlay source is TIGERweb.</div>
          </div>
          <div class="fpe-census-map-shell" id="v3CensusMapShell">
            <div id="v3CensusMapHost"></div>
            <div class="fpe-census-map-overlay">Map idle. Select GEO units and click Load boundaries.</div>
          </div>
        </div>
      </section>
    </div>
  `;

  target.appendChild(shell);

  const mapHost = shell.querySelector("#v3CensusMapHost");
  const legacyMap = legacyCard.querySelector("#censusMap") || document.getElementById("censusMap");
  if (mapHost instanceof HTMLElement && legacyMap instanceof HTMLElement) {
    mapHost.replaceChildren(legacyMap);
  }
}

function bindDistrictCensusProxies() {
  const shell = document.getElementById("v3DistrictCensusShell");
  if (!(shell instanceof HTMLElement) || shell.dataset.v3Bound === "1") {
    return;
  }
  shell.dataset.v3Bound = "1";

  bindFieldProxy("v3CensusApiKey", "censusApiKey");
  bindSelectProxy("v3CensusAcsYear", "censusAcsYear");
  bindSelectProxy("v3CensusResolution", "censusResolution");
  bindSelectProxy("v3CensusStateFips", "censusStateFips");
  bindSelectProxy("v3CensusCountyFips", "censusCountyFips");
  bindSelectProxy("v3CensusPlaceFips", "censusPlaceFips");
  bindSelectProxy("v3CensusMetricSet", "censusMetricSet");
  bindFieldProxy("v3CensusGeoSearch", "censusGeoSearch");
  bindSelectProxy("v3CensusTractFilter", "censusTractFilter");
  bindFieldProxy("v3CensusGeoPaste", "censusGeoPaste");
  bindFieldProxy("v3CensusSelectionSetName", "censusSelectionSetName");
  bindSelectProxy("v3CensusSelectionSetSelect", "censusSelectionSetSelect");
  bindCheckboxProxy("v3CensusApplyAdjustmentsToggle", "censusApplyAdjustmentsToggle");
  bindFileProxy("v3CensusElectionCsvFile", "censusElectionCsvFile");
  bindFieldProxy("v3CensusElectionCsvPrecinctFilter", "censusElectionCsvPrecinctFilter");
  bindCheckboxProxy("v3CensusMapQaVtdToggle", "censusMapQaVtdToggle");
  bindFileProxy("v3CensusMapQaVtdZip", "censusMapQaVtdZip");

  bindClickProxy("v3BtnCensusLoadGeo", "btnCensusLoadGeo");
  bindClickProxy("v3BtnCensusFetchRows", "btnCensusFetchRows");
  bindClickProxy("v3BtnCensusApplyGeoPaste", "btnCensusApplyGeoPaste");
  bindClickProxy("v3BtnCensusSelectAll", "btnCensusSelectAll");
  bindClickProxy("v3BtnCensusClearSelection", "btnCensusClearSelection");
  bindClickProxy("v3BtnCensusSaveSelectionSet", "btnCensusSaveSelectionSet");
  bindClickProxy("v3BtnCensusLoadSelectionSet", "btnCensusLoadSelectionSet");
  bindClickProxy("v3BtnCensusDeleteSelectionSet", "btnCensusDeleteSelectionSet");
  bindClickProxy("v3BtnCensusExportAggregateCsv", "btnCensusExportAggregateCsv");
  bindClickProxy("v3BtnCensusExportAggregateJson", "btnCensusExportAggregateJson");
  bindClickProxy("v3BtnCensusSetRaceFootprint", "btnCensusSetRaceFootprint");
  bindClickProxy("v3BtnCensusClearRaceFootprint", "btnCensusClearRaceFootprint");
  bindClickProxy("v3BtnCensusDownloadElectionCsvTemplate", "btnCensusDownloadElectionCsvTemplate");
  bindClickProxy("v3BtnCensusDownloadElectionCsvWideTemplate", "btnCensusDownloadElectionCsvWideTemplate");
  bindClickProxy("v3BtnCensusElectionCsvDryRun", "btnCensusElectionCsvDryRun");
  bindClickProxy("v3BtnCensusElectionCsvClear", "btnCensusElectionCsvClear");
  bindClickProxy("v3BtnCensusLoadMap", "btnCensusLoadMap");
  bindClickProxy("v3BtnCensusClearMap", "btnCensusClearMap");
  bindClickProxy("v3BtnCensusMapQaVtdZipClear", "btnCensusMapQaVtdZipClear");

  bindMultiSelectProxy("v3CensusGeoSelect", "censusGeoSelect");
}

function syncDistrictCensusProxy() {
  const bridgeSnapshot = readDistrictCensusSnapshot();
  syncLegacyOrBridgeText({
    v3Id: "v3CensusContextHint",
    bridgeText: bridgeSnapshot?.contextHint,
    fallback: "State-only context active for this resolution."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusSelectionSetStatus",
    bridgeText: bridgeSnapshot?.selectionSetStatus,
    fallback: "No saved selection sets."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusStatus",
    bridgeText: bridgeSnapshot?.statusText,
    fallback: "Ready."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusGeoStats",
    bridgeText: bridgeSnapshot?.geoStatsText,
    fallback: "0 selected of 0 GEOs. 0 rows loaded."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusLastFetch",
    bridgeText: bridgeSnapshot?.lastFetchText,
    fallback: "No fetch yet."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusSelectionSummary",
    bridgeText: bridgeSnapshot?.selectionSummaryText,
    fallback: "No GEO selected."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusRaceFootprintStatus",
    bridgeText: bridgeSnapshot?.raceFootprintStatusText,
    fallback: "Race footprint not set."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusAssumptionProvenanceStatus",
    bridgeText: bridgeSnapshot?.assumptionProvenanceStatusText,
    fallback: "Assumption provenance not set."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusFootprintCapacityStatus",
    bridgeText: bridgeSnapshot?.footprintCapacityStatusText,
    fallback: "Footprint capacity: not set."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusApplyAdjustmentsStatus",
    bridgeText: bridgeSnapshot?.applyAdjustmentsStatusText,
    fallback: "Census-adjusted assumptions are OFF."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusAdvisoryStatus",
    bridgeText: bridgeSnapshot?.advisoryStatusText,
    fallback: "Assumption advisory pending."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusElectionCsvGuideStatus",
    bridgeText: bridgeSnapshot?.electionCsvGuideStatusText,
    fallback: "Election CSV schema guide loading."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusElectionCsvDryRunStatus",
    bridgeText: bridgeSnapshot?.electionCsvDryRunStatusText,
    fallback: "No dry-run run yet."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusElectionCsvPreviewMeta",
    bridgeText: bridgeSnapshot?.electionCsvPreviewMetaText,
    fallback: "No normalized preview rows."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusMapStatus",
    bridgeText: bridgeSnapshot?.mapStatusText,
    fallback: "Map idle. Select GEO units and click Load boundaries."
  });
  syncLegacyOrBridgeText({
    v3Id: "v3CensusMapQaVtdZipStatus",
    bridgeText: bridgeSnapshot?.mapQaVtdZipStatusText,
    fallback: "No VTD ZIP loaded."
  });

  syncSelectValue("v3CensusAcsYear", "censusAcsYear");
  syncSelectValue("v3CensusResolution", "censusResolution");
  syncSelectValue("v3CensusStateFips", "censusStateFips");
  syncSelectValue("v3CensusCountyFips", "censusCountyFips");
  syncSelectValue("v3CensusPlaceFips", "censusPlaceFips");
  syncSelectValue("v3CensusMetricSet", "censusMetricSet");
  syncSelectValue("v3CensusTractFilter", "censusTractFilter");
  syncSelectValue("v3CensusSelectionSetSelect", "censusSelectionSetSelect");
  syncFieldValue("v3CensusApiKey", "censusApiKey");
  syncFieldValue("v3CensusGeoSearch", "censusGeoSearch");
  syncFieldValue("v3CensusGeoPaste", "censusGeoPaste");
  syncFieldValue("v3CensusSelectionSetName", "censusSelectionSetName");
  syncFieldValue("v3CensusElectionCsvPrecinctFilter", "censusElectionCsvPrecinctFilter");
  syncCheckboxValue("v3CensusApplyAdjustmentsToggle", "censusApplyAdjustmentsToggle");
  syncCheckboxValue("v3CensusMapQaVtdToggle", "censusMapQaVtdToggle");
  syncMultiSelectProxy("v3CensusGeoSelect", "censusGeoSelect");

  syncControlDisabled("v3CensusApiKey", "censusApiKey");
  syncControlDisabled("v3CensusAcsYear", "censusAcsYear");
  syncControlDisabled("v3CensusResolution", "censusResolution");
  syncControlDisabled("v3CensusStateFips", "censusStateFips");
  syncControlDisabled("v3CensusCountyFips", "censusCountyFips");
  syncControlDisabled("v3CensusPlaceFips", "censusPlaceFips");
  syncControlDisabled("v3CensusMetricSet", "censusMetricSet");
  syncControlDisabled("v3CensusGeoSearch", "censusGeoSearch");
  syncControlDisabled("v3CensusTractFilter", "censusTractFilter");
  syncControlDisabled("v3CensusGeoPaste", "censusGeoPaste");
  syncControlDisabled("v3CensusSelectionSetName", "censusSelectionSetName");
  syncControlDisabled("v3CensusSelectionSetSelect", "censusSelectionSetSelect");
  syncControlDisabled("v3CensusApplyAdjustmentsToggle", "censusApplyAdjustmentsToggle");
  syncControlDisabled("v3CensusElectionCsvFile", "censusElectionCsvFile");
  syncControlDisabled("v3CensusElectionCsvPrecinctFilter", "censusElectionCsvPrecinctFilter");
  syncControlDisabled("v3CensusMapQaVtdToggle", "censusMapQaVtdToggle");
  syncControlDisabled("v3CensusMapQaVtdZip", "censusMapQaVtdZip");
  syncControlDisabled("v3CensusGeoSelect", "censusGeoSelect");

  syncButtonDisabled("v3BtnCensusLoadGeo", "btnCensusLoadGeo");
  syncButtonDisabled("v3BtnCensusFetchRows", "btnCensusFetchRows");
  syncButtonDisabled("v3BtnCensusApplyGeoPaste", "btnCensusApplyGeoPaste");
  syncButtonDisabled("v3BtnCensusSelectAll", "btnCensusSelectAll");
  syncButtonDisabled("v3BtnCensusClearSelection", "btnCensusClearSelection");
  syncButtonDisabled("v3BtnCensusSaveSelectionSet", "btnCensusSaveSelectionSet");
  syncButtonDisabled("v3BtnCensusLoadSelectionSet", "btnCensusLoadSelectionSet");
  syncButtonDisabled("v3BtnCensusDeleteSelectionSet", "btnCensusDeleteSelectionSet");
  syncButtonDisabled("v3BtnCensusExportAggregateCsv", "btnCensusExportAggregateCsv");
  syncButtonDisabled("v3BtnCensusExportAggregateJson", "btnCensusExportAggregateJson");
  syncButtonDisabled("v3BtnCensusSetRaceFootprint", "btnCensusSetRaceFootprint");
  syncButtonDisabled("v3BtnCensusClearRaceFootprint", "btnCensusClearRaceFootprint");
  syncButtonDisabled("v3BtnCensusDownloadElectionCsvTemplate", "btnCensusDownloadElectionCsvTemplate");
  syncButtonDisabled("v3BtnCensusDownloadElectionCsvWideTemplate", "btnCensusDownloadElectionCsvWideTemplate");
  syncButtonDisabled("v3BtnCensusElectionCsvDryRun", "btnCensusElectionCsvDryRun");
  syncButtonDisabled("v3BtnCensusElectionCsvClear", "btnCensusElectionCsvClear");
  syncButtonDisabled("v3BtnCensusLoadMap", "btnCensusLoadMap");
  syncButtonDisabled("v3BtnCensusClearMap", "btnCensusClearMap");
  syncButtonDisabled("v3BtnCensusMapQaVtdZipClear", "btnCensusMapQaVtdZipClear");

  renderDistrictCensusTableRows({
    targetBodyId: "v3CensusAggregateTbody",
    rows: bridgeSnapshot?.aggregateRows,
    expectedCols: 2,
    emptyLabel: "No ACS rows loaded.",
    numericColumns: [1]
  });
  renderDistrictCensusTableRows({
    targetBodyId: "v3CensusAdvisoryTbody",
    rows: bridgeSnapshot?.advisoryRows,
    expectedCols: 2,
    emptyLabel: "Load ACS rows for selected GEO units to compute advisory indices.",
    numericColumns: [1]
  });
  renderDistrictCensusTableRows({
    targetBodyId: "v3CensusElectionCsvPreviewTbody",
    rows: bridgeSnapshot?.electionPreviewRows,
    expectedCols: 4,
    emptyLabel: "No dry-run preview yet.",
    numericColumns: [2, 3]
  });
}

function syncLegacyOrBridgeText({ v3Id, bridgeText, fallback = "—" }) {
  const text = String(bridgeText || "").trim();
  if (text) {
    setText(v3Id, text);
    return;
  }
  setText(v3Id, fallback);
}

function renderDistrictCensusTableRows({
  targetBodyId,
  rows,
  expectedCols = 1,
  emptyLabel = "No rows.",
  numericColumns = []
}) {
  const tbody = document.getElementById(targetBodyId);
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  tbody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="muted" colspan="${expectedCols}">${escapeHtml(emptyLabel)}</td>`;
    tbody.append(tr);
    return;
  }

  for (const row of list) {
    const tr = document.createElement("tr");
    const cells = Array.isArray(row) ? row : [];
    for (let i = 0; i < expectedCols; i += 1) {
      const td = document.createElement("td");
      if (numericColumns.includes(i)) {
        td.className = "num";
      }
      td.innerHTML = escapeHtml(cells[i] ?? "");
      tr.append(td);
    }
    tbody.append(tr);
  }
}

function bindMultiSelectProxy(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLSelectElement)) {
    return;
  }

  v3.addEventListener("change", () => {
    const legacy = document.getElementById(legacyId);
    if (!(legacy instanceof HTMLSelectElement)) {
      return;
    }
    const selected = new Set(Array.from(v3.selectedOptions).map((opt) => opt.value));
    Array.from(legacy.options).forEach((option) => {
      option.selected = selected.has(option.value);
    });
    legacy.dispatchEvent(new Event("input", { bubbles: true }));
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function syncMultiSelectProxy(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = document.getElementById(legacyId);
  if (!(v3 instanceof HTMLSelectElement) || !(legacy instanceof HTMLSelectElement)) {
    return;
  }

  if (document.activeElement !== v3) {
    const legacySignature = Array.from(legacy.options)
      .map((opt) => `${opt.value}::${opt.text}::${opt.selected ? "1" : "0"}`)
      .join("|");
    const v3Signature = Array.from(v3.options)
      .map((opt) => `${opt.value}::${opt.text}::${opt.selected ? "1" : "0"}`)
      .join("|");
    if (legacySignature !== v3Signature) {
      v3.innerHTML = "";
      Array.from(legacy.options).forEach((opt) => {
        const next = document.createElement("option");
        next.value = opt.value;
        next.textContent = opt.textContent || "";
        next.selected = opt.selected;
        v3.appendChild(next);
      });
    }
  }

  v3.disabled = legacy.disabled;
}

function bindFileProxy(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement) || v3.type !== "file") {
    return;
  }

  v3.addEventListener("change", () => {
    const legacy = document.getElementById(legacyId);
    if (!(legacy instanceof HTMLInputElement) || legacy.type !== "file") {
      return;
    }

    try {
      const transfer = new DataTransfer();
      Array.from(v3.files || []).forEach((file) => transfer.items.add(file));
      legacy.files = transfer.files;
    } catch {
      // best effort: some browsers restrict files assignment
    }

    legacy.dispatchEvent(new Event("input", { bubbles: true }));
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function syncCensusMapShellState() {
  const shell = document.getElementById("v3CensusMapShell");
  if (!(shell instanceof HTMLElement)) {
    return;
  }

  const statusText = (document.getElementById("v3CensusMapStatus")?.textContent || "").trim();
  const isIdle = isCensusMapIdle(statusText);
  shell.classList.toggle("is-idle", isIdle);
  shell.classList.toggle("is-active", !isIdle);

  const overlay = shell.querySelector(".fpe-census-map-overlay");
  if (overlay instanceof HTMLElement) {
    overlay.textContent = isIdle
      ? "Map idle. Select GEO units and click Load boundaries."
      : "Boundary map active.";
  }
}

function syncDistrictCensusMessageTones() {
  const advisoryText = (document.getElementById("v3CensusAdvisoryStatus")?.textContent || "").trim();
  syncMessageToneByWindow("v3CensusAdvisoryStatusWindow", advisoryText, "Signal status");

  const footprintText = [
    "v3CensusSelectionSummary",
    "v3CensusRaceFootprintStatus",
    "v3CensusAssumptionProvenanceStatus",
    "v3CensusFootprintCapacityStatus",
    "v3CensusApplyAdjustmentsStatus"
  ]
    .map((id) => (document.getElementById(id)?.textContent || "").trim())
    .filter(Boolean)
    .join(" ");
  syncMessageToneByWindow("v3CensusFootprintStatusWindow", footprintText, "Current status");
}

function syncMessageToneByWindow(windowId, text, defaultLabel) {
  const windowEl = document.getElementById(windowId);
  if (!(windowEl instanceof HTMLElement)) {
    return;
  }

  const tone = detectMessageTone(text || "");
  windowEl.classList.remove("fpe-message-window--warn", "fpe-message-window--status", "fpe-message-window--tip", "fpe-message-window--info");
  windowEl.classList.add(`fpe-message-window--${tone}`);

  const tag = windowEl.querySelector(".fpe-message-window__tag");
  if (!(tag instanceof HTMLElement)) {
    return;
  }
  tag.textContent = tone === "warn" ? "Warning" : defaultLabel;
}

function detectMessageTone(text) {
  const value = String(text || "").toLowerCase();
  if (
    /warn|warning|invalid|missing|error|fail|incomplete|not set|stale|risk|shortfall|required|pending|off\b/.test(
      value
    )
  ) {
    return "warn";
  }
  if (/tip|guide|workflow|instructions|recommended/.test(value)) {
    return "tip";
  }
  if (/status|ready|loaded|selected|last fetch|active|enabled|disabled|coverage|delta|using/.test(value)) {
    return "status";
  }
  return "info";
}

function isCensusMapIdle(statusText) {
  const value = String(statusText || "").toLowerCase();
  return (
    !value ||
    value.includes("map idle") ||
    value.includes("select geo units") ||
    value.includes("no boundary overlay")
  );
}
