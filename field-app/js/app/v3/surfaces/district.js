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
  readDistrictControlSnapshot,
  readDistrictTemplateSnapshot,
  readDistrictFormSnapshot,
  readDistrictBallotSnapshot,
  readDistrictTargetingSnapshot,
  normalizeDistrictTargetingSnapshotFromView,
  readDistrictCensusSnapshot,
  applyDistrictTemplateDefaults,
  setDistrictFormField,
  addDistrictCandidate,
  updateDistrictCandidate,
  removeDistrictCandidate,
  setDistrictUserSplit,
  addDistrictCandidateHistory,
  updateDistrictCandidateHistory,
  removeDistrictCandidateHistory,
  setDistrictTargetingField,
  applyDistrictTargetingPreset,
  resetDistrictTargetingWeights,
  runDistrictTargeting,
  exportDistrictTargetingCsv,
  exportDistrictTargetingJson,
  setDistrictCensusField,
  setDistrictCensusGeoSelection,
  setDistrictCensusFile,
  triggerDistrictCensusAction,
} from "../stateBridge.js";
import {
  createFieldGrid,
  setText,
} from "../surfaceUtils.js";
import { computeUniverseAdjustedRates, normalizeUniversePercents } from "../../../core/universeLayer.js";
import {
  DISTRICT_STATUS_AWAITING_INPUTS,
  classifyDistrictStatusTone as classifyDistrictStatusToneCore,
  deriveDistrictBaselineCardStatus as deriveDistrictBaselineCardStatusCore,
  deriveDistrictCensusCardStatus as deriveDistrictCensusCardStatusCore,
  deriveDistrictElectorateCardStatus as deriveDistrictElectorateCardStatusCore,
  deriveDistrictRaceCardStatus as deriveDistrictRaceCardStatusCore,
  deriveDistrictStructureCardStatus as deriveDistrictStructureCardStatusCore,
  buildDistrictStructureDerivedText as buildDistrictStructureDerivedTextCore,
  deriveDistrictSummaryCardStatus as deriveDistrictSummaryCardStatusCore,
  deriveDistrictTargetingCardStatus as deriveDistrictTargetingCardStatusCore,
  deriveDistrictTurnoutCardStatus as deriveDistrictTurnoutCardStatusCore,
} from "../../../core/districtView.js";
import {
  getTargetingBridgeDefaults,
  listTargetGeoLevels,
  listTargetModelOptions,
} from "../../targetingRuntime.js";
import {
  listDistrictModeOptions,
  listDistrictRaceTypeOptions,
  listDistrictUndecidedModeOptions,
  listDistrictUniverseBasisOptions,
} from "../../districtOptionRegistry.js";
import { listTemplateDimensionOptions } from "../../templateRegistry.js";
import { listAcsYears, listMetricSetOptions, listResolutionOptions } from "../../../core/censusModule.js";
import { pctOverrideToDecimal } from "../../../core/voteProduction.js";

let censusMapResizePulseHandle = 0;
const TARGETING_DENSITY_OPTIONS = [
  { id: "none", label: "None" },
  { id: "medium", label: "Medium+" },
  { id: "high", label: "High" },
];
const TARGETING_BRIDGE_DEFAULTS = Object.freeze(getTargetingBridgeDefaults("turnout_opportunity"));

const TEMPLATE_DIMENSION_SELECTS = [
  { id: "v3DistrictOfficeLevel", field: "officeLevel", label: "Office level" },
  { id: "v3DistrictElectionType", field: "electionType", label: "Election type" },
  { id: "v3DistrictSeatContext", field: "seatContext", label: "Seat context" },
  { id: "v3DistrictPartisanshipMode", field: "partisanshipMode", label: "Partisanship mode" },
  { id: "v3DistrictSalienceLevel", field: "salienceLevel", label: "Salience level" },
];

const DISTRICT_TRAINING_PANELS = Object.freeze([
  {
    id: "train-setup",
    title: "Training — Set up",
    leftTitle: "What this stage models",
    leftText:
      "Sets the planning context. Race type loads sensible defaults, and election date drives timeline feasibility in later stages.",
    leftRule:
      "Scenario name → saved with export<br/>Race type → default band widths<br/>Election date → weeks remaining auto-calc<br/>Mode → persuasion vs turnout emphasis",
    rightTitle: "Common mistakes",
    rightBullets: [
      "Using Federal template for a state leg race where band widths should be wider.",
      "Leaving election date blank and forgetting to set weeks remaining manually.",
      "Setting mode to late-start before capacity constraints are known.",
    ],
    rightCaution:
      "A plan is only meaningful relative to time constraints. Set election date first.",
  },
  {
    id: "train-universe",
    title: "Training — Universe",
    leftTitle: "What this stage models",
    leftText:
      "Universe is the denominator for everything. Turnout votes and persuasion workload both scale directly from it.",
    leftRule:
      "Registered: most defensible, largest number<br/>Active (voted 1+ recent): smaller, higher quality<br/>Likely voters: smallest, most predictive",
    rightTitle: "Realistic ranges (state leg)",
    rightBullets: [
      "Rural district: 12,000–25,000 registered.",
      "Suburban district: 30,000–60,000 registered.",
      "Urban district: 40,000–80,000 registered.",
    ],
    rightCaution:
      "Always note your source so this assumption stays auditable across scenario revisions.",
  },
  {
    id: "train-ballot",
    title: "Training — Ballot & Persuasion Baseline",
    leftTitle: "What this stage models",
    leftText:
      "The ballot test sets your starting position. Candidate shares plus undecided must sum to 100%.",
    leftRule:
      "Proportional: undecided breaks like committed voters<br/>Conservative against you: undecided breaks toward opponents<br/>User-defined: you set the split explicitly",
    rightTitle: "Common mistakes",
    rightBullets: [
      "Using unweighted internal polling as baseline support.",
      "Setting undecided too low for competitive races.",
      "Assuming proportional undecided break in a race with strong structural bias.",
    ],
    rightCaution:
      "Undecided allocation is a primary volatility driver. Stress-test conservative and proportional paths.",
  },
  {
    id: "train-checks",
    title: "Training — Data Checks & Guardrails",
    leftTitle: "What this stage does",
    leftText:
      "Guardrails catch invalid states and plausibility drift before sharing plans externally.",
    rightTitle: "When to use it",
    rightBullets: [
      "Before every client presentation.",
      "When outputs look unexpectedly strong.",
      "After importing scenario data from another session.",
    ],
  },
]);

function createDistrictTrainingPanel(definition) {
  const panelId = `v3-${definition.id}`;
  const panel = document.createElement("div");
  panel.className = "training-panel-new";
  panel.id = panelId;

  const header = document.createElement("div");
  header.className = "training-hd-new";
  header.setAttribute("onclick", `toggleTrainPanel('${panelId}')`);
  header.innerHTML = `<span>🎓</span><span class="training-title-new">${definition.title}</span><span class="training-chev-new">▾</span>`;

  const body = document.createElement("div");
  body.className = "training-bd-new";

  const leftCol = document.createElement("div");
  leftCol.className = "training-col-new";
  leftCol.innerHTML = `
    <div class="training-sec-title-new">${definition.leftTitle}</div>
    <p>${definition.leftText}</p>
    ${definition.leftRule ? `<div class="training-rule-new">${definition.leftRule}</div>` : ""}
  `;

  const rightCol = document.createElement("div");
  rightCol.className = "training-col-new";
  rightCol.innerHTML = `<div class="training-sec-title-new">${definition.rightTitle}</div>`;
  if (Array.isArray(definition.rightBullets) && definition.rightBullets.length) {
    const list = document.createElement("ul");
    definition.rightBullets.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    });
    rightCol.append(list);
  }
  if (definition.rightCaution) {
    const caution = document.createElement("div");
    caution.className = "training-caution-new";
    caution.textContent = definition.rightCaution;
    rightCol.append(caution);
  }

  body.append(leftCol, rightCol);
  panel.append(header, body);
  return panel;
}

function buildDistrictTrainingPanels() {
  const host = document.createElement("div");
  host.className = "fpe-district-training-stack";
  DISTRICT_TRAINING_PANELS.forEach((definition) => {
    host.append(createDistrictTrainingPanel(definition));
  });
  return host;
}

function createDistrictSection({ eyebrow = "", title = "", description = "" }) {
  const section = document.createElement("section");
  section.className = "fpe-district-section";

  const head = document.createElement("div");
  head.className = "fpe-district-section__head";
  head.innerHTML = `
    ${eyebrow ? `<div class="fpe-district-section__eyebrow">${eyebrow}</div>` : ""}
    ${title ? `<h2 class="fpe-district-section__title">${title}</h2>` : ""}
    ${description ? `<p class="fpe-district-section__desc">${description}</p>` : ""}
  `;

  const body = document.createElement("div");
  body.className = "fpe-district-section__body";

  section.append(head, body);
  return { section, body };
}

function createDistrictBriefBand() {
  const band = document.createElement("section");
  band.className = "fpe-district-brief";
  band.setAttribute("aria-label", "District brief");
  band.innerHTML = `
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Template</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefTemplate">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Mode</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefMode">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Timeline</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefTimeline">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Universe basis</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefUniverseBasis">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Weighting</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefWeighting">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">ACS context</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefCensus">-</div>
    </div>
  `;
  return band;
}

export function renderDistrictSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  frame.classList.add("fpe-surface-frame--single");
  const main = createColumn("primary");

  const raceCard = createCard({
    title: "Race context",
    description: "Race template, election date, weeks remaining, and operating mode.",
    status: "Awaiting context"
  });

  const electorateCard = createCard({
    title: "Electorate",
    description: "Universe definition, basis, and source provenance.",
    status: "Awaiting universe"
  });

  const baselineCard = createCard({
    title: "Ballot baseline",
    description: "Candidate support, undecided handling, and persuasion anchor.",
    status: "Awaiting ballot"
  });

  const turnoutCard = createCard({
    title: "Turnout baseline",
    description: "Comparable-cycle turnout assumptions and uncertainty band.",
    status: "Awaiting turnout"
  });

  const structureCard = createCard({
    title: "Electorate structure",
    description:
      "This layer weights persuasion and turnout reliability by party composition and applies a single retention factor. It is aggregate-only (not a CRM).",
    status: "Weighting off"
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
    description: "The baseline state that all downstream surfaces inherit.",
    status: "Awaiting baseline"
  });

  const censusCard = createCard({
    title: "Census assumptions",
    description: "Geography context, ACS rows, aggregate demographics, and election CSV dry-run workflow.",
    status: "Ready"
  });

  const targetingCard = createCard({
    title: "Targeting lab",
    description: "Model-driven target ranking layer. Derived analysis only; does not mutate core scenario math.",
    status: "Run targeting"
  });

  assignCardStatusId(raceCard, "v3DistrictRaceCardStatus");
  assignCardStatusId(electorateCard, "v3DistrictElectorateCardStatus");
  assignCardStatusId(baselineCard, "v3DistrictBaselineCardStatus");
  assignCardStatusId(turnoutCard, "v3DistrictTurnoutCardStatus");
  assignCardStatusId(structureCard, "v3DistrictStructureCardStatus");
  assignCardStatusId(summaryCard, "v3DistrictSummaryCardStatus");
  assignCardStatusId(censusCard, "v3DistrictCensusCardStatus");
  assignCardStatusId(targetingCard, "v3DistrictTargetingCardStatus");

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
  renderDistrictCensusProxyShell({
    target: censusBody
  });

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
  const briefBand = createDistrictBriefBand();
  const trainingPanels = buildDistrictTrainingPanels();

  const baselineSection = createDistrictSection({
    eyebrow: "Baseline",
    title: "Race and electorate setup",
    description: "Set the race context, universe, ballot baseline, and turnout assumptions that drive every downstream surface."
  });
  const baselineGrid = document.createElement("div");
  baselineGrid.className = "fpe-district-grid";
  baselineGrid.append(raceCard, electorateCard, baselineCard, turnoutCard);
  baselineSection.body.append(baselineGrid);

  const compositionSection = createDistrictSection({
    eyebrow: "Composition",
    title: "Electorate weighting",
    description: "Optional electorate weighting changes how persuasion and turnout reliability are interpreted from the same baseline assumptions."
  });
  const compositionGrid = document.createElement("div");
  compositionGrid.className = "fpe-district-grid";
  structureCard.classList.add("fpe-card--district-wide");
  compositionGrid.append(structureCard);
  compositionSection.body.append(compositionGrid);

  const analysisSection = createDistrictSection({
    eyebrow: "Geography",
    title: "Census and targeting workspace",
    description: "Use Census to set geographic assumptions and then test the derived targeting workflow from the same district baseline."
  });
  const analysisGrid = document.createElement("div");
  analysisGrid.className = "fpe-district-analysis-grid";
  censusCard.classList.add("fpe-card--district-census");
  targetingCard.classList.add("fpe-card--district-targeting");
  analysisGrid.append(censusCard, targetingCard);
  analysisSection.body.append(analysisGrid);

  main.append(
    topRow,
    briefBand,
    ...(trainingPanels ? [trainingPanels] : []),
    baselineSection.section,
    compositionSection.section,
    analysisSection.section
  );

  frame.append(main);
  mount.append(frame);

  const addCandidateBtn = document.getElementById("v3BtnAddCandidate");
  if (addCandidateBtn instanceof HTMLButtonElement && addCandidateBtn.dataset.v3BallotAddBound !== "1") {
    addCandidateBtn.dataset.v3BallotAddBound = "1";
    addCandidateBtn.addEventListener("click", () => {
      addDistrictCandidate();
    });
  }
  const addCandidateHistoryBtn = document.getElementById("v3BtnAddCandidateHistory");
  if (addCandidateHistoryBtn instanceof HTMLButtonElement && addCandidateHistoryBtn.dataset.v3BallotAddBound !== "1") {
    addCandidateHistoryBtn.dataset.v3BallotAddBound = "1";
    addCandidateHistoryBtn.addEventListener("click", () => {
      addDistrictCandidateHistory();
    });
  }
  bindDistrictFormSelect("v3DistrictYourCandidate", "yourCandidate");
  bindDistrictFormField("v3DistrictUndecidedPct", "undecidedPct");
  bindDistrictFormSelect("v3DistrictUndecidedMode", "undecidedMode");
  bindDistrictFormSelect("v3DistrictRaceType", "raceType");
  bindDistrictFormSelect("v3DistrictOfficeLevel", "officeLevel");
  bindDistrictFormSelect("v3DistrictElectionType", "electionType");
  bindDistrictFormSelect("v3DistrictSeatContext", "seatContext");
  bindDistrictFormSelect("v3DistrictPartisanshipMode", "partisanshipMode");
  bindDistrictFormSelect("v3DistrictSalienceLevel", "salienceLevel");
  bindDistrictFormField("v3DistrictElectionDate", "electionDate");
  bindDistrictFormField("v3DistrictWeeksRemaining", "weeksRemaining");
  bindDistrictFormSelect("v3DistrictMode", "mode");
  bindDistrictFormField("v3DistrictUniverseSize", "universeSize");
  bindDistrictFormSelect("v3DistrictUniverseBasis", "universeBasis");
  bindDistrictFormField("v3DistrictSourceNote", "sourceNote");
  bindDistrictFormCheckbox("v3DistrictElectorateWeightingToggle", "universe16Enabled");
  bindDistrictFormField("v3DistrictDemPct", "universe16DemPct");
  bindDistrictFormField("v3DistrictRepPct", "universe16RepPct");
  bindDistrictFormField("v3DistrictNpaPct", "universe16NpaPct");
  bindDistrictFormField("v3DistrictOtherPct", "universe16OtherPct");
  bindDistrictFormField("v3DistrictRetentionFactor", "retentionFactor");
  bindDistrictFormField("v3DistrictTurnoutA", "turnoutA");
  bindDistrictFormField("v3DistrictTurnoutB", "turnoutB");
  bindDistrictFormField("v3DistrictBandWidth", "bandWidth");
  const applyTemplateDefaultsBtn = document.getElementById("v3BtnDistrictApplyTemplateDefaults");
  if (applyTemplateDefaultsBtn instanceof HTMLButtonElement) {
    applyTemplateDefaultsBtn.addEventListener("click", () => {
      applyDistrictTemplateDefaults("all");
      refreshDistrictSummary();
    });
  }
  bindDistrictTargetingBridge();
  bindDistrictCensusProxies();
  hydrateDistrictSetupOptions();
  hydrateTemplateDimensionOptions();
  return refreshDistrictSummary;
}

function refreshDistrictSummary() {
  const snapshot = readDistrictSnapshot();
  const controlSnapshot = readDistrictControlSnapshot();
  const templateSnapshot = readDistrictTemplateSnapshot();
  const formSnapshot = readDistrictFormSnapshot();
  const ballotSnapshot = readDistrictBallotSnapshot();
  const censusSnapshot = readDistrictCensusSnapshot();
  setText("v3DistrictUniverse", snapshot.universe);
  setText("v3DistrictSupport", snapshot.baselineSupport);
  setText("v3DistrictTurnout", snapshot.turnoutExpected);
  setText("v3DistrictProjected", snapshot.projectedVotes);
  setText("v3DistrictNeed", snapshot.persuasionNeed);
  setText("v3DistrictTurnoutExpected", snapshot.turnoutExpected);
  setText("v3DistrictTurnoutBand", snapshot.turnoutBand);
  setText("v3DistrictVotesPer1pct", snapshot.votesPer1pct);
  syncDistrictBallotTopline(ballotSnapshot);
  syncSelectValueFromRaw("v3DistrictRaceType", formSnapshot?.raceType);
  syncSelectValueFromRaw("v3DistrictOfficeLevel", templateSnapshot?.officeLevel);
  syncSelectValueFromRaw("v3DistrictElectionType", templateSnapshot?.electionType);
  syncSelectValueFromRaw("v3DistrictSeatContext", templateSnapshot?.seatContext);
  syncSelectValueFromRaw("v3DistrictPartisanshipMode", templateSnapshot?.partisanshipMode);
  syncSelectValueFromRaw("v3DistrictSalienceLevel", templateSnapshot?.salienceLevel);
  syncInputValueFromRaw("v3DistrictElectionDate", formSnapshot?.electionDate);
  syncInputValueFromRaw("v3DistrictWeeksRemaining", formSnapshot?.weeksRemaining);
  syncSelectValueFromRaw("v3DistrictMode", formSnapshot?.mode);
  syncInputValueFromRaw("v3DistrictUniverseSize", formSnapshot?.universeSize);
  syncSelectValueFromRaw("v3DistrictUniverseBasis", formSnapshot?.universeBasis);
  syncInputValueFromRaw("v3DistrictSourceNote", formSnapshot?.sourceNote);
  syncCheckboxCheckedFromRaw("v3DistrictElectorateWeightingToggle", formSnapshot?.universe16Enabled);
  syncInputValueFromRaw("v3DistrictTurnoutA", formSnapshot?.turnoutA);
  syncInputValueFromRaw("v3DistrictTurnoutB", formSnapshot?.turnoutB);
  syncInputValueFromRaw("v3DistrictBandWidth", formSnapshot?.bandWidth);
  syncInputValueFromRaw("v3DistrictDemPct", formSnapshot?.universe16DemPct);
  syncInputValueFromRaw("v3DistrictRepPct", formSnapshot?.universe16RepPct);
  syncInputValueFromRaw("v3DistrictNpaPct", formSnapshot?.universe16NpaPct);
  syncInputValueFromRaw("v3DistrictOtherPct", formSnapshot?.universe16OtherPct);
  syncInputValueFromRaw("v3DistrictRetentionFactor", formSnapshot?.retentionFactor);
  syncDistrictBallotBaseline(ballotSnapshot, controlSnapshot);
  if (controlSnapshot?.locked) {
    applyDistrictBallotDynamicLock();
  }
  syncDistrictStructureDerived();
  syncDistrictTargetingLab();
  syncDistrictCensusProxy(censusSnapshot);
  syncDistrictTemplateProfile(templateSnapshot);
  syncDistrictCensusMessageTones();
  syncCensusMapShellState();
  syncDistrictBrief(snapshot, censusSnapshot, templateSnapshot);
  syncDistrictCardStatus("v3DistrictRaceCardStatus", deriveDistrictRaceCardStatus());
  syncDistrictCardStatus("v3DistrictElectorateCardStatus", deriveDistrictElectorateCardStatus());
  syncDistrictCardStatus("v3DistrictBaselineCardStatus", deriveDistrictBaselineCardStatus());
  syncDistrictCardStatus("v3DistrictTurnoutCardStatus", deriveDistrictTurnoutCardStatus());
  syncDistrictCardStatus("v3DistrictStructureCardStatus", deriveDistrictStructureCardStatus());
  syncDistrictCardStatus("v3DistrictSummaryCardStatus", deriveDistrictSummaryCardStatus(snapshot));
  syncDistrictCardStatus("v3DistrictCensusCardStatus", deriveDistrictCensusCardStatus());
  syncDistrictCardStatus("v3DistrictTargetingCardStatus", deriveDistrictTargetingCardStatus());
  applyDistrictBridgeDisabledMap(controlSnapshot?.disabledMap);
}

function syncDistrictBrief(snapshot, censusSnapshot, templateSnapshot) {
  const raceTemplateText = readSelectedLabel("v3DistrictRaceType") || "Unset";
  const appliedTemplateId = String(templateSnapshot?.appliedTemplateId || "").trim();
  const overrides = Array.isArray(templateSnapshot?.overriddenFields) ? templateSnapshot.overriddenFields.length : 0;
  const templateText = appliedTemplateId
    ? `${raceTemplateText} (${appliedTemplateId}${overrides > 0 ? ` · ${overrides} overrides` : ""})`
    : raceTemplateText;
  const modeText = readSelectedLabel("v3DistrictMode") || "Unset";
  const electionDate = readInputValue("v3DistrictElectionDate");
  const weeksRemaining = readInputValue("v3DistrictWeeksRemaining");
  const universeBasisText = readSelectedLabel("v3DistrictUniverseBasis") || "Unset";
  const weightingEnabled = readCheckboxChecked("v3DistrictElectorateWeightingToggle");
  const structureWarning = String(document.getElementById("v3DistrictStructureWarn")?.textContent || "").trim();
  const censusText =
    censusSnapshot?.geoStatsText
    || censusSnapshot?.selectionSummaryText
    || censusSnapshot?.statusText
    || "No ACS rows";

  let timelineText = "Unset";
  if (electionDate && weeksRemaining) {
    timelineText = `${electionDate} · ${weeksRemaining} weeks`;
  } else if (electionDate) {
    timelineText = electionDate;
  } else if (weeksRemaining) {
    timelineText = `${weeksRemaining} weeks`;
  }

  let weightingText = weightingEnabled ? "Weighted" : "Baseline only";
  if (weightingEnabled && structureWarning) {
    weightingText = "Weighted · normalize inputs";
  }

  setText("v3DistrictBriefTemplate", templateText);
  setText("v3DistrictBriefMode", modeText);
  setText("v3DistrictBriefTimeline", timelineText);
  setText("v3DistrictBriefUniverseBasis", universeBasisText);
  setText("v3DistrictBriefWeighting", weightingText);
  setText("v3DistrictBriefCensus", censusText);
}

function readSelectedLabel(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return "";
  }
  const option = el.selectedOptions?.[0];
  return String(option?.textContent || "").trim();
}

function readInputValue(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return "";
  }
  return String(el.value || "").trim();
}

function syncDistrictBallotBaseline(ballotSnapshot, controlSnapshot) {
  const snapshot = ballotSnapshot && typeof ballotSnapshot === "object" ? ballotSnapshot : null;
  syncDistrictCandidateTable(snapshot, controlSnapshot);
  syncDistrictUserSplitTable(snapshot, controlSnapshot);
  syncDistrictCandidateHistoryTable(snapshot, controlSnapshot);
  syncDistrictBallotWarning(snapshot);
  const supportText = String(snapshot?.supportTotalText || "").trim();
  setText("v3DistrictSupportTotal", supportText || "—");
}

function syncDistrictBallotTopline(ballotSnapshot) {
  const snapshot = ballotSnapshot && typeof ballotSnapshot === "object" ? ballotSnapshot : null;
  const candidateOptions = Array.isArray(snapshot?.candidates)
    ? snapshot.candidates
      .map((row) => ({
        value: String(row?.id || "").trim(),
        label: String(row?.name || row?.id || "").trim(),
      }))
      .filter((row) => !!row.value)
    : [];
  hydrateSelectOptions("v3DistrictYourCandidate", candidateOptions, snapshot?.yourCandidateId);
  syncSelectValueFromRaw("v3DistrictYourCandidate", snapshot?.yourCandidateId);
  syncInputValueFromRaw("v3DistrictUndecidedPct", snapshot?.undecidedPct);
  syncSelectValueFromRaw("v3DistrictUndecidedMode", snapshot?.undecidedMode);
}

function syncDistrictCandidateTable(ballotSnapshot, controlSnapshot) {
  const targetBody = document.getElementById("v3DistrictCandTbody");
  if (!(targetBody instanceof HTMLElement)) {
    return;
  }

  if (targetBody.contains(document.activeElement)) {
    return;
  }

  const rows = Array.isArray(ballotSnapshot?.candidates) ? ballotSnapshot.candidates : [];
  const controlsLocked = !!controlSnapshot?.locked;
  targetBody.innerHTML = "";
  rows.forEach((sourceRow) => {
    const candidateId = String(sourceRow?.id || "").trim();
    if (!candidateId) return;
    const candidateName = String(sourceRow?.name || "").trim();
    const supportPct = Number.isFinite(Number(sourceRow?.supportPct)) ? String(Number(sourceRow.supportPct)) : "";
    const canRemove = !controlsLocked && !!sourceRow?.canRemove;

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.className = "fpe-input";
    nameInput.type = "text";
    nameInput.value = candidateName;
    nameInput.disabled = controlsLocked;
    nameInput.addEventListener("input", () => {
      updateDistrictCandidate(candidateId, "name", nameInput.value);
    });
    tdName.appendChild(nameInput);

    const tdPct = document.createElement("td");
    tdPct.className = "num";
    const pctInput = document.createElement("input");
    pctInput.className = "fpe-input";
    pctInput.type = "number";
    pctInput.min = "0";
    pctInput.max = "100";
    pctInput.step = "0.1";
    pctInput.value = supportPct;
    pctInput.disabled = controlsLocked;
    pctInput.addEventListener("input", () => {
      updateDistrictCandidate(candidateId, "supportPct", pctInput.value);
    });
    tdPct.appendChild(pctInput);

    const tdAction = document.createElement("td");
    tdAction.className = "num";
    const removeBtn = document.createElement("button");
    removeBtn.className = "fpe-btn fpe-btn--ghost";
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.disabled = !canRemove;
    removeBtn.addEventListener("click", () => {
      removeDistrictCandidate(candidateId);
    });
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

function syncDistrictUserSplitTable(ballotSnapshot, controlSnapshot) {
  const targetWrap = document.getElementById("v3DistrictUserSplitWrap");
  const targetList = document.getElementById("v3DistrictUserSplitList");
  if (!(targetWrap instanceof HTMLElement) || !(targetList instanceof HTMLElement)) {
    return;
  }

  const visible = !!ballotSnapshot?.userSplitVisible;
  targetWrap.hidden = !visible;
  if (!visible) {
    return;
  }

  if (targetList.contains(document.activeElement)) {
    return;
  }

  const rows = Array.isArray(ballotSnapshot?.userSplitRows) ? ballotSnapshot.userSplitRows : [];
  const controlsLocked = !!controlSnapshot?.locked;
  targetList.innerHTML = "";
  rows.forEach((sourceRow) => {
    const candidateId = String(sourceRow?.id || "").trim();
    if (!candidateId) return;
    const rowLabel = String(sourceRow?.name || "Candidate").trim() || "Candidate";

    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.className = "fpe-control-label";
    label.textContent = rowLabel;

    const input = document.createElement("input");
    input.className = "fpe-input";
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "0.1";
    input.value = Number.isFinite(Number(sourceRow?.value)) ? String(Number(sourceRow.value)) : "";
    input.disabled = controlsLocked;
    input.addEventListener("input", () => {
      setDistrictUserSplit(candidateId, input.value);
    });

    field.append(label, input);
    targetList.appendChild(field);
  });
}

function syncDistrictCandidateHistoryTable(ballotSnapshot, controlSnapshot) {
  const summaryEl = document.getElementById("v3DistrictCandidateHistorySummary");
  const warnEl = document.getElementById("v3DistrictCandidateHistoryWarn");
  const targetBody = document.getElementById("v3DistrictCandidateHistoryTbody");
  const summaryText = String(ballotSnapshot?.candidateHistorySummaryText || "").trim();
  const warningText = String(ballotSnapshot?.candidateHistoryWarningText || "").trim();

  if (summaryEl instanceof HTMLElement) {
    summaryEl.textContent = summaryText || "No candidate history rows.";
  }
  if (warnEl instanceof HTMLElement) {
    warnEl.hidden = !warningText;
    warnEl.textContent = warningText;
  }
  if (!(targetBody instanceof HTMLElement)) {
    return;
  }

  if (targetBody.contains(document.activeElement)) {
    return;
  }

  const rows = Array.isArray(ballotSnapshot?.candidateHistoryRecords)
    ? ballotSnapshot.candidateHistoryRecords
    : [];
  const options = ballotSnapshot?.candidateHistoryOptions && typeof ballotSnapshot.candidateHistoryOptions === "object"
    ? ballotSnapshot.candidateHistoryOptions
    : {};
  const electionTypeOptions = Array.isArray(options.electionType) ? options.electionType : [];
  const incumbencyOptions = Array.isArray(options.incumbencyStatus) ? options.incumbencyStatus : [];
  const controlsLocked = !!controlSnapshot?.locked;
  targetBody.innerHTML = "";

  rows.forEach((record) => {
    const recordId = String(record?.recordId || "").trim();
    if (!recordId) return;
    const tr = document.createElement("tr");

    const makeInputCell = ({ type = "text", value = "", min = "", max = "", step = "", onInput = null } = {}) => {
      const td = document.createElement("td");
      if (type === "number") td.className = "num";
      const input = document.createElement("input");
      input.className = "fpe-input";
      input.type = type;
      if (min !== "") input.min = String(min);
      if (max !== "") input.max = String(max);
      if (step !== "") input.step = String(step);
      input.value = String(value == null ? "" : value);
      input.disabled = controlsLocked;
      if (typeof onInput === "function") {
        input.addEventListener("input", () => onInput(input.value));
      }
      td.appendChild(input);
      return td;
    };

    const makeSelectCell = ({ rowsList = [], value = "", onChange = null } = {}) => {
      const td = document.createElement("td");
      const select = document.createElement("select");
      select.className = "fpe-input";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select";
      select.appendChild(placeholder);
      const normalizedRows = Array.isArray(rowsList) ? rowsList.slice() : [];
      const selectedValue = String(value == null ? "" : value).trim();
      if (selectedValue && !normalizedRows.some((row) => String(row?.value || "").trim() === selectedValue)) {
        normalizedRows.push({ value: selectedValue, label: selectedValue });
      }
      normalizedRows.forEach((row) => {
        const option = document.createElement("option");
        option.value = String(row?.value || "");
        option.textContent = String(row?.label || row?.value || "");
        select.appendChild(option);
      });
      select.value = selectedValue;
      select.disabled = controlsLocked;
      if (typeof onChange === "function") {
        select.addEventListener("change", () => onChange(select.value));
      }
      td.appendChild(select);
      return td;
    };

    const officeTd = makeInputCell({
      type: "text",
      value: record?.office || "",
      onInput: (value) => updateDistrictCandidateHistory(recordId, "office", value),
    });
    const cycleTd = makeInputCell({
      type: "number",
      value: Number.isFinite(Number(record?.cycleYear)) ? Number(record.cycleYear) : "",
      min: 1900,
      max: 2100,
      step: 1,
      onInput: (value) => updateDistrictCandidateHistory(recordId, "cycleYear", value),
    });
    const electionTd = makeSelectCell({
      rowsList: electionTypeOptions,
      value: record?.electionType || "",
      onChange: (value) => updateDistrictCandidateHistory(recordId, "electionType", value),
    });
    const candidateTd = makeInputCell({
      type: "text",
      value: record?.candidateName || "",
      onInput: (value) => updateDistrictCandidateHistory(recordId, "candidateName", value),
    });
    const partyTd = makeInputCell({
      type: "text",
      value: record?.party || "",
      onInput: (value) => updateDistrictCandidateHistory(recordId, "party", value),
    });
    const incumbencyTd = makeSelectCell({
      rowsList: incumbencyOptions,
      value: record?.incumbencyStatus || "",
      onChange: (value) => updateDistrictCandidateHistory(recordId, "incumbencyStatus", value),
    });
    const voteTd = makeInputCell({
      type: "number",
      value: Number.isFinite(Number(record?.voteShare)) ? Number(record.voteShare) : "",
      min: 0,
      max: 100,
      step: 0.1,
      onInput: (value) => updateDistrictCandidateHistory(recordId, "voteShare", value),
    });
    const marginTd = makeInputCell({
      type: "number",
      value: Number.isFinite(Number(record?.margin)) ? Number(record.margin) : "",
      min: -100,
      max: 100,
      step: 0.1,
      onInput: (value) => updateDistrictCandidateHistory(recordId, "margin", value),
    });
    const turnoutTd = makeInputCell({
      type: "number",
      value: Number.isFinite(Number(record?.turnoutContext)) ? Number(record.turnoutContext) : "",
      min: 0,
      max: 100,
      step: 0.1,
      onInput: (value) => updateDistrictCandidateHistory(recordId, "turnoutContext", value),
    });

    const repeatTd = document.createElement("td");
    const repeatToggle = document.createElement("input");
    repeatToggle.type = "checkbox";
    repeatToggle.checked = !!record?.repeatCandidate;
    repeatToggle.disabled = controlsLocked;
    repeatToggle.addEventListener("change", () => {
      updateDistrictCandidateHistory(recordId, "repeatCandidate", repeatToggle.checked);
    });
    repeatTd.appendChild(repeatToggle);

    const overUnderTd = makeInputCell({
      type: "number",
      value: Number.isFinite(Number(record?.overUnderPerformancePct)) ? Number(record.overUnderPerformancePct) : "",
      min: -40,
      max: 40,
      step: 0.1,
      onInput: (value) => updateDistrictCandidateHistory(recordId, "overUnderPerformancePct", value),
    });

    const actionTd = document.createElement("td");
    actionTd.className = "num";
    const removeBtn = document.createElement("button");
    removeBtn.className = "fpe-btn fpe-btn--ghost";
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.disabled = controlsLocked;
    removeBtn.addEventListener("click", () => {
      removeDistrictCandidateHistory(recordId);
    });
    actionTd.appendChild(removeBtn);

    tr.append(
      officeTd,
      cycleTd,
      electionTd,
      candidateTd,
      partyTd,
      incumbencyTd,
      voteTd,
      marginTd,
      turnoutTd,
      repeatTd,
      overUnderTd,
      actionTd,
    );
    targetBody.appendChild(tr);
  });

  if (!targetBody.children.length) {
    const tr = document.createElement("tr");
    tr.className = "fpe-empty-row";
    const td = document.createElement("td");
    td.colSpan = 12;
    td.className = "fpe-empty-state";
    td.textContent = "No candidate history rows yet.";
    tr.appendChild(td);
    targetBody.appendChild(tr);
  }
}

function syncDistrictBallotWarning(ballotSnapshot) {
  const targetWarn = document.getElementById("v3DistrictCandWarn");
  if (!(targetWarn instanceof HTMLElement)) {
    return;
  }

  const text = String(ballotSnapshot?.warningText || "").trim();
  const showWarn = !!text;
  targetWarn.hidden = !showWarn;
  targetWarn.textContent = showWarn ? text : "";
}

function applyDistrictBallotDynamicLock() {
  document.querySelectorAll(
    "#v3DistrictCandTbody input, #v3DistrictCandTbody button, #v3DistrictUserSplitList input, #v3DistrictCandidateHistoryTbody input, #v3DistrictCandidateHistoryTbody select, #v3DistrictCandidateHistoryTbody button, #v3BtnAddCandidateHistory",
  ).forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
      el.disabled = true;
      return;
    }
    if (el instanceof HTMLSelectElement) {
      el.disabled = true;
    }
  });
}

function hydrateTemplateDimensionOptions() {
  TEMPLATE_DIMENSION_SELECTS.forEach(({ id, field, label }) => {
    const options = listTemplateDimensionOptions(field);
    const withPlaceholder = [{ value: "", label: `Select ${label.toLowerCase()}` }, ...options];
    hydrateSelectOptions(id, withPlaceholder);
  });
}

function hydrateDistrictSetupOptions() {
  hydrateSelectOptions("v3DistrictRaceType", listDistrictRaceTypeOptions());
  hydrateSelectOptions("v3DistrictMode", listDistrictModeOptions());
  hydrateSelectOptions("v3DistrictUniverseBasis", listDistrictUniverseBasisOptions());
  hydrateSelectOptions("v3DistrictUndecidedMode", listDistrictUndecidedModeOptions());
}

function syncSelectValueFromRaw(id, rawValue) {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  if (document.activeElement === select) {
    return;
  }
  const value = String(rawValue == null ? "" : rawValue).trim();
  if (!value) {
    const hasEmptyOption = Array.from(select.options).some((option) => String(option.value || "").trim() === "");
    if (hasEmptyOption) {
      select.value = "";
    } else {
      select.selectedIndex = -1;
    }
    return;
  }
  let hasOption = Array.from(select.options).some((option) => String(option.value || "").trim() === value);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
    hasOption = true;
  }
  if (hasOption) {
    select.value = value;
  }
}

function syncInputValueFromRaw(id, rawValue) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  const value = (rawValue == null || rawValue === "") ? "" : String(rawValue);
  if (input.value !== value) {
    input.value = value;
  }
}

function syncCheckboxCheckedFromRaw(id, rawValue) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.checked = !!rawValue;
}

function syncDistrictTemplateProfile(templateSnapshot) {
  const target = document.getElementById("v3DistrictTemplateMeta");
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const snapshot = templateSnapshot && typeof templateSnapshot === "object" ? templateSnapshot : null;
  if (!snapshot) {
    target.textContent = "Template profile unavailable.";
    return;
  }
  const templateId = String(snapshot.appliedTemplateId || "").trim() || "unresolved";
  const version = String(snapshot.appliedVersion || "").trim();
  const benchmarkKey = String(snapshot.benchmarkKey || "").trim();
  const overrides = Array.isArray(snapshot.overriddenFields) ? snapshot.overriddenFields.length : 0;
  const profile = String(snapshot.assumptionsProfile || "").trim() || (overrides > 0 ? "custom" : "template");
  const candidateHistoryCoverageBand = String(snapshot.candidateHistoryCoverageBand || "").trim();
  const candidateHistoryConfidenceBand = String(snapshot.candidateHistoryConfidenceBand || "").trim();
  const candidateHistoryRecordCount = Number.isFinite(Number(snapshot.candidateHistoryRecordCount))
    ? Number(snapshot.candidateHistoryRecordCount)
    : 0;
  const parts = [`Template: ${templateId}`];
  if (version) parts.push(`v${version}`);
  if (benchmarkKey) parts.push(`Benchmark: ${benchmarkKey}`);
  parts.push(`Profile: ${profile}`);
  parts.push(`Overrides: ${overrides}`);
  if (candidateHistoryRecordCount > 0){
    parts.push(`History: ${candidateHistoryRecordCount} row(s), ${candidateHistoryCoverageBand || "none"} coverage, ${candidateHistoryConfidenceBand || "missing"} confidence`);
  } else {
    parts.push("History: none");
  }
  target.textContent = parts.join(" · ");
}

function bindDistrictFormSelect(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictFormBound === "1") {
    return;
  }
  control.dataset.v3DistrictFormBound = "1";
  control.addEventListener("change", () => {
    setDistrictFormField(field, control.value);
  });
}

function bindDistrictFormField(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (
    !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
    || control.dataset.v3DistrictFormBound === "1"
  ) {
    return;
  }
  control.dataset.v3DistrictFormBound = "1";
  control.addEventListener("input", () => {
    setDistrictFormField(field, control.value);
  });
}

function bindDistrictFormCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.type !== "checkbox" || control.dataset.v3DistrictFormBound === "1") {
    return;
  }
  control.dataset.v3DistrictFormBound = "1";
  control.addEventListener("change", () => {
    setDistrictFormField(field, control.checked);
  });
}

function applyDistrictBridgeDisabledMap(disabledMap) {
  const map = disabledMap && typeof disabledMap === "object" ? disabledMap : null;
  if (!map) return;
  for (const [id, value] of Object.entries(map)) {
    if (typeof value !== "boolean") continue;
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLButtonElement
    ) {
      el.disabled = value;
    }
  }
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
    derived.textContent = buildDistrictStructureDerivedTextCore({ enabled, adjusted });
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
    const value = pctOverrideToDecimal(node.value, null);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function syncDistrictTargetingLab(snapshotOverride = null) {
  const bridgeSnapshot = snapshotOverride || readDistrictTargetingSnapshot();
  const targetingConfig = bridgeSnapshot?.config;
  if (bridgeSnapshot) {
    setText("v3DistrictTargetingStatus", bridgeSnapshot.statusText || "Run targeting to generate ranked GEOs.");
    setText("v3DistrictTargetingMeta", bridgeSnapshot.metaText || "No targeting run yet.");
    renderDistrictTargetingRows(bridgeSnapshot.rows || []);
  } else {
    setText("v3DistrictTargetingStatus", "Run targeting to generate ranked GEOs.");
    setText("v3DistrictTargetingMeta", "No targeting run yet.");
    renderDistrictTargetingRows([]);
  }

  ensureDistrictTargetingOptionHydration(targetingConfig);

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
    syncBridgeSelectValue("v3DistrictTargetingGeoLevel", TARGETING_BRIDGE_DEFAULTS.geoLevel);
    syncBridgeSelectValue("v3DistrictTargetingModelId", TARGETING_BRIDGE_DEFAULTS.presetId);
    syncBridgeFieldValue("v3DistrictTargetingTopN", TARGETING_BRIDGE_DEFAULTS.topN);
    syncBridgeFieldValue("v3DistrictTargetingMinHousingUnits", TARGETING_BRIDGE_DEFAULTS.minHousingUnits);
    syncBridgeFieldValue("v3DistrictTargetingMinPopulation", TARGETING_BRIDGE_DEFAULTS.minPopulation);
    syncBridgeFieldValue("v3DistrictTargetingMinScore", TARGETING_BRIDGE_DEFAULTS.minScore);
    syncBridgeCheckboxValue("v3DistrictTargetingOnlyRaceFootprint", TARGETING_BRIDGE_DEFAULTS.onlyRaceFootprint);
    syncBridgeCheckboxValue("v3DistrictTargetingPrioritizeYoung", TARGETING_BRIDGE_DEFAULTS.prioritizeYoung);
    syncBridgeCheckboxValue("v3DistrictTargetingPrioritizeRenters", TARGETING_BRIDGE_DEFAULTS.prioritizeRenters);
    syncBridgeCheckboxValue("v3DistrictTargetingAvoidHighMultiUnit", TARGETING_BRIDGE_DEFAULTS.avoidHighMultiUnit);
    syncBridgeSelectValue("v3DistrictTargetingDensityFloor", TARGETING_BRIDGE_DEFAULTS.densityFloor);
    syncBridgeFieldValue("v3DistrictTargetingWeightVotePotential", TARGETING_BRIDGE_DEFAULTS.weightVotePotential);
    syncBridgeFieldValue("v3DistrictTargetingWeightTurnoutOpportunity", TARGETING_BRIDGE_DEFAULTS.weightTurnoutOpportunity);
    syncBridgeFieldValue("v3DistrictTargetingWeightPersuasionIndex", TARGETING_BRIDGE_DEFAULTS.weightPersuasionIndex);
    syncBridgeFieldValue("v3DistrictTargetingWeightFieldEfficiency", TARGETING_BRIDGE_DEFAULTS.weightFieldEfficiency);
  }

  syncDistrictTargetingDisabledFallback({
    config: targetingConfig,
    rowCount: Array.isArray(bridgeSnapshot?.rows) ? bridgeSnapshot.rows.length : 0,
  });
}

function ensureDistrictTargetingOptionHydration(config) {
  const geoOptions = listTargetGeoLevels().map((row) => ({
    value: String(row?.id || "").trim(),
    label: String(row?.label || "").trim(),
  })).filter((row) => row.value);
  const modelOptions = listTargetModelOptions().map((row) => ({
    value: String(row?.id || "").trim(),
    label: String(row?.label || "").trim(),
  })).filter((row) => row.value);
  const densityOptions = TARGETING_DENSITY_OPTIONS.map((row) => ({
    value: String(row?.id || "").trim(),
    label: String(row?.label || "").trim(),
  })).filter((row) => row.value);

  hydrateSelectOptions("v3DistrictTargetingGeoLevel", geoOptions, config?.geoLevel);
  hydrateSelectOptions(
    "v3DistrictTargetingModelId",
    modelOptions,
    config?.presetId || config?.modelId,
  );
  hydrateSelectOptions("v3DistrictTargetingDensityFloor", densityOptions, config?.densityFloor);
}

function hydrateSelectOptions(v3Id, options, preferredValue) {
  const select = document.getElementById(v3Id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalized = Array.isArray(options)
    ? options
      .map((row) => ({
        value: String(row?.value || "").trim(),
        label: String(row?.label || "").trim() || String(row?.value || "").trim(),
      }))
      .filter((row) => !!row.value || !!row.label)
    : [];

  const nextPreferred = String(preferredValue == null ? "" : preferredValue).trim();
  if (nextPreferred && !normalized.some((row) => row.value === nextPreferred)) {
    normalized.push({ value: nextPreferred, label: nextPreferred });
  }

  const currentSignature = Array.from(select.options).map((opt) => `${opt.value}::${opt.textContent || ""}`);
  const nextSignature = normalized.map((row) => `${row.value}::${row.label}`);
  const needsRefresh = currentSignature.length !== nextSignature.length
    || currentSignature.some((sig, idx) => sig !== nextSignature[idx]);

  if (needsRefresh && document.activeElement !== select) {
    const previousValue = String(select.value || "").trim();
    select.innerHTML = "";
    normalized.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.value;
      option.textContent = row.label;
      select.appendChild(option);
    });
    const restoreValue = nextPreferred || previousValue;
    if (restoreValue && Array.from(select.options).some((opt) => opt.value === restoreValue)) {
      select.value = restoreValue;
    }
  }
}

function syncDistrictTargetingDisabledFallback({ config, rowCount }) {
  const controlsLocked = !!config?.controlsLocked;
  const canRun = config?.canRun == null ? true : !!config.canRun;
  const canExport = config?.canExport == null ? Number(rowCount) > 0 : !!config.canExport;
  const canResetWeights = config?.canResetWeights == null ? true : !!config.canResetWeights;
  const weightsDisabled = controlsLocked || !canResetWeights;

  [
    "v3DistrictTargetingGeoLevel",
    "v3DistrictTargetingModelId",
    "v3DistrictTargetingTopN",
    "v3DistrictTargetingMinHousingUnits",
    "v3DistrictTargetingMinPopulation",
    "v3DistrictTargetingMinScore",
    "v3DistrictTargetingOnlyRaceFootprint",
    "v3DistrictTargetingPrioritizeYoung",
    "v3DistrictTargetingPrioritizeRenters",
    "v3DistrictTargetingAvoidHighMultiUnit",
    "v3DistrictTargetingDensityFloor",
    "v3DistrictTargetingWeightVotePotential",
    "v3DistrictTargetingWeightTurnoutOpportunity",
    "v3DistrictTargetingWeightPersuasionIndex",
    "v3DistrictTargetingWeightFieldEfficiency",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLButtonElement
    ) {
      el.disabled = controlsLocked;
    }
  });

  [
    "v3DistrictTargetingWeightVotePotential",
    "v3DistrictTargetingWeightTurnoutOpportunity",
    "v3DistrictTargetingWeightPersuasionIndex",
    "v3DistrictTargetingWeightFieldEfficiency",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.disabled = weightsDisabled;
    }
  });

  const resetBtn = document.getElementById("v3BtnDistrictTargetingResetWeights");
  if (resetBtn instanceof HTMLButtonElement) {
    resetBtn.disabled = weightsDisabled;
  }
  const runBtn = document.getElementById("v3BtnDistrictRunTargeting");
  if (runBtn instanceof HTMLButtonElement) {
    runBtn.disabled = controlsLocked || !canRun;
  }
  const csvBtn = document.getElementById("v3BtnDistrictExportTargetingCsv");
  if (csvBtn instanceof HTMLButtonElement) {
    csvBtn.disabled = controlsLocked || !canExport;
  }
  const jsonBtn = document.getElementById("v3BtnDistrictExportTargetingJson");
  if (jsonBtn instanceof HTMLButtonElement) {
    jsonBtn.disabled = controlsLocked || !canExport;
  }
}

function bindDistrictTargetingBridge() {
  bindDistrictTargetingSelect("v3DistrictTargetingGeoLevel", "geoLevel");
  bindDistrictTargetingModelSelect("v3DistrictTargetingModelId");
  bindDistrictTargetingField("v3DistrictTargetingTopN", "topN");
  bindDistrictTargetingField("v3DistrictTargetingMinHousingUnits", "minHousingUnits");
  bindDistrictTargetingField("v3DistrictTargetingMinPopulation", "minPopulation");
  bindDistrictTargetingField("v3DistrictTargetingMinScore", "minScore");
  bindDistrictTargetingCheckbox("v3DistrictTargetingOnlyRaceFootprint", "onlyRaceFootprint");
  bindDistrictTargetingCheckbox("v3DistrictTargetingPrioritizeYoung", "prioritizeYoung");
  bindDistrictTargetingCheckbox("v3DistrictTargetingPrioritizeRenters", "prioritizeRenters");
  bindDistrictTargetingCheckbox("v3DistrictTargetingAvoidHighMultiUnit", "avoidHighMultiUnit");
  bindDistrictTargetingSelect("v3DistrictTargetingDensityFloor", "densityFloor");
  bindDistrictTargetingField("v3DistrictTargetingWeightVotePotential", "weightVotePotential");
  bindDistrictTargetingField("v3DistrictTargetingWeightTurnoutOpportunity", "weightTurnoutOpportunity");
  bindDistrictTargetingField("v3DistrictTargetingWeightPersuasionIndex", "weightPersuasionIndex");
  bindDistrictTargetingField("v3DistrictTargetingWeightFieldEfficiency", "weightFieldEfficiency");
  bindDistrictTargetingAction("v3BtnDistrictTargetingResetWeights", () => resetDistrictTargetingWeights(), {
    syncTargeting: true,
  });
  bindDistrictTargetingAction("v3BtnDistrictRunTargeting", () => runDistrictTargeting(), {
    syncTargeting: true,
  });
  bindDistrictTargetingAction("v3BtnDistrictExportTargetingCsv", () => exportDistrictTargetingCsv());
  bindDistrictTargetingAction("v3BtnDistrictExportTargetingJson", () => exportDistrictTargetingJson());
}

function bindDistrictTargetingSelect(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3TargetingBound === "1") {
    return;
  }
  control.dataset.v3TargetingBound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictTargetingField(field, control.value);
    syncDistrictTargetingFromResult(result);
  });
}

function bindDistrictTargetingModelSelect(v3Id) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3TargetingBound === "1") {
    return;
  }
  control.dataset.v3TargetingBound = "1";
  control.addEventListener("change", () => {
    const result = applyDistrictTargetingPreset(control.value);
    syncDistrictTargetingFromResult(result);
  });
}

function bindDistrictTargetingField(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (
    !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
    || control.dataset.v3TargetingBound === "1"
  ) {
    return;
  }
  control.dataset.v3TargetingBound = "1";
  control.addEventListener("input", () => {
    const result = setDistrictTargetingField(field, control.value);
    syncDistrictTargetingFromResult(result);
  });
}

function bindDistrictTargetingCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3TargetingBound === "1") {
    return;
  }
  control.dataset.v3TargetingBound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictTargetingField(field, control.checked);
    syncDistrictTargetingFromResult(result);
  });
}

function bindDistrictTargetingAction(v3Id, action, opts = {}) {
  const button = document.getElementById(v3Id);
  if (!(button instanceof HTMLButtonElement) || button.dataset.v3TargetingBound === "1") {
    return;
  }
  button.dataset.v3TargetingBound = "1";
  button.addEventListener("click", () => {
    if (typeof action === "function") {
      const result = action();
      if (opts?.syncTargeting) {
        syncDistrictTargetingFromResult(result);
      }
    }
  });
}

function syncDistrictTargetingFromResult(result) {
  const snapshot = normalizeDistrictTargetingSnapshotFromView(result?.view);
  if (snapshot) {
    syncDistrictTargetingLab(snapshot);
    window.requestAnimationFrame(() => syncDistrictTargetingLab());
    return;
  }
  if (result?.ok) {
    syncDistrictTargetingLab();
    window.requestAnimationFrame(() => syncDistrictTargetingLab());
  }
}

function syncBridgeSelectValue(v3Id, value) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLSelectElement) || document.activeElement === v3) {
    return;
  }
  const next = String(value == null ? "" : value).trim();
  if (!next) {
    const hasEmptyOption = Array.from(v3.options).some((option) => option.value === "");
    if (hasEmptyOption) {
      v3.value = "";
    } else {
      v3.selectedIndex = -1;
    }
    return;
  }
  let hasOption = Array.from(v3.options).some((option) => option.value === next);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = next;
    option.textContent = next;
    v3.appendChild(option);
    hasOption = true;
  }
  if (hasOption) {
    v3.value = next;
  }
}

function syncBridgeFieldValue(v3Id, value) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement || v3 instanceof HTMLTextAreaElement) || document.activeElement === v3) {
    return;
  }
  v3.value = String(value == null ? "" : value);
}

function syncBridgeCheckboxValue(v3Id, value) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement) || document.activeElement === v3) {
    return;
  }
  v3.checked = !!value;
}

function syncBridgeMultiSelectValue(v3Id, rows) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLSelectElement) || document.activeElement === v3) {
    return;
  }
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      value: String(row?.value || "").trim(),
      label: String(row?.label || row?.value || "").trim(),
      selected: !!row?.selected,
    }))
    .filter((row) => !!row.value);

  const currentSignature = Array.from(v3.options)
    .map((opt) => `${opt.value}::${opt.textContent || ""}::${opt.selected ? "1" : "0"}`)
    .join("|");
  const nextSignature = normalized
    .map((row) => `${row.value}::${row.label || row.value}::${row.selected ? "1" : "0"}`)
    .join("|");
  if (currentSignature === nextSignature) {
    return;
  }

  v3.innerHTML = "";
  normalized.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.value;
    option.textContent = row.label || row.value;
    option.selected = row.selected;
    v3.appendChild(option);
  });
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

function renderDistrictCensusProxyShell({ target }) {
  if (!(target instanceof HTMLElement)) {
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
}

function bindDistrictCensusProxies() {
  const shell = document.getElementById("v3DistrictCensusShell");
  if (!(shell instanceof HTMLElement) || shell.dataset.v3Bound === "1") {
    return;
  }
  shell.dataset.v3Bound = "1";

  bindDistrictCensusField("v3CensusApiKey", "apiKey", "input");
  bindDistrictCensusField("v3CensusAcsYear", "year", "change");
  bindDistrictCensusField("v3CensusResolution", "resolution", "change");
  bindDistrictCensusField("v3CensusStateFips", "stateFips", "change");
  bindDistrictCensusField("v3CensusCountyFips", "countyFips", "change");
  bindDistrictCensusField("v3CensusPlaceFips", "placeFips", "change");
  bindDistrictCensusField("v3CensusMetricSet", "metricSet", "change");
  bindDistrictCensusField("v3CensusGeoSearch", "geoSearch", "input");
  bindDistrictCensusField("v3CensusTractFilter", "tractFilter", "change");
  bindDistrictCensusField("v3CensusGeoPaste", "geoPaste", "input");
  bindDistrictCensusField("v3CensusSelectionSetName", "selectionSetDraftName", "input");
  bindDistrictCensusField("v3CensusSelectionSetSelect", "selectedSelectionSetKey", "change");
  bindDistrictCensusCheckbox("v3CensusApplyAdjustmentsToggle", "applyAdjustedAssumptions");
  bindDistrictCensusField("v3CensusElectionCsvPrecinctFilter", "electionCsvPrecinctFilter", "input");
  bindDistrictCensusCheckbox("v3CensusMapQaVtdToggle", "mapQaVtdOverlay");
  bindDistrictCensusFile("v3CensusElectionCsvFile", "electionCsvFile");
  bindDistrictCensusFile("v3CensusMapQaVtdZip", "mapQaVtdZip");
  bindDistrictCensusGeoSelection("v3CensusGeoSelect");

  bindDistrictCensusAction("v3BtnCensusLoadGeo", "loadGeo");
  bindDistrictCensusAction("v3BtnCensusFetchRows", "fetchRows");
  bindDistrictCensusAction("v3BtnCensusApplyGeoPaste", "applyGeoPaste");
  bindDistrictCensusAction("v3BtnCensusSelectAll", "selectAll");
  bindDistrictCensusAction("v3BtnCensusClearSelection", "clearSelection");
  bindDistrictCensusAction("v3BtnCensusSaveSelectionSet", "saveSelectionSet");
  bindDistrictCensusAction("v3BtnCensusLoadSelectionSet", "loadSelectionSet");
  bindDistrictCensusAction("v3BtnCensusDeleteSelectionSet", "deleteSelectionSet");
  bindDistrictCensusAction("v3BtnCensusExportAggregateCsv", "exportAggregateCsv");
  bindDistrictCensusAction("v3BtnCensusExportAggregateJson", "exportAggregateJson");
  bindDistrictCensusAction("v3BtnCensusSetRaceFootprint", "setRaceFootprint");
  bindDistrictCensusAction("v3BtnCensusClearRaceFootprint", "clearRaceFootprint");
  bindDistrictCensusAction("v3BtnCensusDownloadElectionCsvTemplate", "downloadElectionTemplate");
  bindDistrictCensusAction("v3BtnCensusDownloadElectionCsvWideTemplate", "downloadElectionWideTemplate");
  bindDistrictCensusAction("v3BtnCensusElectionCsvDryRun", "electionDryRun");
  bindDistrictCensusAction("v3BtnCensusElectionCsvClear", "electionClear");
  bindDistrictCensusAction("v3BtnCensusLoadMap", "loadMap");
  bindDistrictCensusAction("v3BtnCensusClearMap", "clearMap");
  bindDistrictCensusAction("v3BtnCensusMapQaVtdZipClear", "clearVtdZip");
}

function syncDistrictCensusProxy() {
  const bridgeSnapshot = readDistrictCensusSnapshot();
  const censusConfig = bridgeSnapshot?.config;
  ensureDistrictCensusStaticOptionHydration(censusConfig);
  syncBridgeText({
    v3Id: "v3CensusContextHint",
    bridgeText: bridgeSnapshot?.contextHint,
    fallback: "State-only context active for this resolution."
  });
  syncBridgeText({
    v3Id: "v3CensusSelectionSetStatus",
    bridgeText: bridgeSnapshot?.selectionSetStatus,
    fallback: "No saved selection sets."
  });
  syncBridgeText({
    v3Id: "v3CensusStatus",
    bridgeText: bridgeSnapshot?.statusText,
    fallback: "Ready."
  });
  syncBridgeText({
    v3Id: "v3CensusGeoStats",
    bridgeText: bridgeSnapshot?.geoStatsText,
    fallback: "0 selected of 0 GEOs. 0 rows loaded."
  });
  syncBridgeText({
    v3Id: "v3CensusLastFetch",
    bridgeText: bridgeSnapshot?.lastFetchText,
    fallback: "No fetch yet."
  });
  syncBridgeText({
    v3Id: "v3CensusSelectionSummary",
    bridgeText: bridgeSnapshot?.selectionSummaryText,
    fallback: "No GEO selected."
  });
  syncBridgeText({
    v3Id: "v3CensusRaceFootprintStatus",
    bridgeText: bridgeSnapshot?.raceFootprintStatusText,
    fallback: "Race footprint not set."
  });
  syncBridgeText({
    v3Id: "v3CensusAssumptionProvenanceStatus",
    bridgeText: bridgeSnapshot?.assumptionProvenanceStatusText,
    fallback: "Assumption provenance not set."
  });
  syncBridgeText({
    v3Id: "v3CensusFootprintCapacityStatus",
    bridgeText: bridgeSnapshot?.footprintCapacityStatusText,
    fallback: "Footprint capacity: not set."
  });
  syncBridgeText({
    v3Id: "v3CensusApplyAdjustmentsStatus",
    bridgeText: bridgeSnapshot?.applyAdjustmentsStatusText,
    fallback: "Census-adjusted assumptions are OFF."
  });
  syncBridgeText({
    v3Id: "v3CensusAdvisoryStatus",
    bridgeText: bridgeSnapshot?.advisoryStatusText,
    fallback: "Assumption advisory pending."
  });
  syncBridgeText({
    v3Id: "v3CensusElectionCsvGuideStatus",
    bridgeText: bridgeSnapshot?.electionCsvGuideStatusText,
    fallback: "Election CSV schema guide loading."
  });
  syncBridgeText({
    v3Id: "v3CensusElectionCsvDryRunStatus",
    bridgeText: bridgeSnapshot?.electionCsvDryRunStatusText,
    fallback: "No dry-run run yet."
  });
  syncBridgeText({
    v3Id: "v3CensusElectionCsvPreviewMeta",
    bridgeText: bridgeSnapshot?.electionCsvPreviewMetaText,
    fallback: "No normalized preview rows."
  });
  syncBridgeText({
    v3Id: "v3CensusMapStatus",
    bridgeText: bridgeSnapshot?.mapStatusText,
    fallback: "Map idle. Select GEO units and click Load boundaries."
  });
  syncBridgeText({
    v3Id: "v3CensusMapQaVtdZipStatus",
    bridgeText: bridgeSnapshot?.mapQaVtdZipStatusText,
    fallback: "No VTD ZIP loaded."
  });

  const config = (censusConfig && typeof censusConfig === "object") ? censusConfig : {};
  syncBridgeFieldValue("v3CensusApiKey", config.apiKey);
  syncBridgeSelectValue("v3CensusAcsYear", config.year);
  syncBridgeSelectValue("v3CensusResolution", config.resolution);
  syncBridgeSelectValue("v3CensusStateFips", config.stateFips);
  syncBridgeSelectValue("v3CensusCountyFips", config.countyFips);
  syncBridgeSelectValue("v3CensusPlaceFips", config.placeFips);
  syncBridgeSelectValue("v3CensusMetricSet", config.metricSet);
  syncBridgeSelectValue("v3CensusTractFilter", config.tractFilter);
  syncBridgeSelectValue("v3CensusSelectionSetSelect", config.selectedSelectionSetKey);
  syncBridgeFieldValue("v3CensusGeoSearch", config.geoSearch);
  syncBridgeFieldValue("v3CensusGeoPaste", config.geoPaste);
  syncBridgeFieldValue("v3CensusSelectionSetName", config.selectionSetDraftName);
  syncBridgeFieldValue("v3CensusElectionCsvPrecinctFilter", config.electionCsvPrecinctFilter);
  syncBridgeCheckboxValue("v3CensusApplyAdjustmentsToggle", config.applyAdjustedAssumptions);
  syncBridgeCheckboxValue("v3CensusMapQaVtdToggle", config.mapQaVtdOverlay);
  syncBridgeMultiSelectValue("v3CensusGeoSelect", config.geoSelectOptions);
  applyDistrictCensusBridgeDisabledMap(config.disabledMap);
  syncDistrictCensusDisabledFallback(config);

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

function applyDistrictCensusBridgeDisabledMap(disabledMap) {
  const map = disabledMap && typeof disabledMap === "object" ? disabledMap : null;
  if (!map) return;
  for (const [id, value] of Object.entries(map)) {
    if (typeof value !== "boolean") continue;
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLButtonElement
    ) {
      el.disabled = value;
    }
  }
}

function ensureDistrictCensusStaticOptionHydration(config) {
  const yearOptions = listAcsYears().map((year) => ({
    value: String(year || "").trim(),
    label: String(year || "").trim(),
  })).filter((row) => row.value);
  const resolutionOptions = listResolutionOptions().map((row) => ({
    value: String(row?.id || "").trim(),
    label: String(row?.label || row?.id || "").trim(),
  })).filter((row) => row.value);
  const metricSetOptions = listMetricSetOptions().map((row) => ({
    value: String(row?.id || "").trim(),
    label: String(row?.label || row?.id || "").trim(),
  })).filter((row) => row.value);

  hydrateSelectOptions("v3CensusAcsYear", yearOptions);
  hydrateSelectOptions("v3CensusResolution", resolutionOptions);
  hydrateSelectOptions("v3CensusMetricSet", metricSetOptions);
  hydrateSelectOptions("v3CensusStateFips", normalizeBridgeOptions(config?.stateOptions), config?.stateFips);
  hydrateSelectOptions("v3CensusCountyFips", normalizeBridgeOptions(config?.countyOptions), config?.countyFips);
  hydrateSelectOptions("v3CensusPlaceFips", normalizeBridgeOptions(config?.placeOptions), config?.placeFips);
  hydrateSelectOptions("v3CensusTractFilter", normalizeBridgeOptions(config?.tractFilterOptions), config?.tractFilter);
  hydrateSelectOptions(
    "v3CensusSelectionSetSelect",
    normalizeBridgeOptions(config?.selectionSetOptions),
    config?.selectedSelectionSetKey,
  );
}

function normalizeBridgeOptions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      value: String(row?.value || "").trim(),
      label: String(row?.label || row?.value || "").trim(),
    }))
    .filter((row) => !!row.value || !!row.label);
}

function syncDistrictCensusDisabledFallback(config) {
  const controlsLocked = !!config?.controlsLocked;
  if (!controlsLocked) {
    return;
  }
  [
    "v3CensusAcsYear",
    "v3CensusResolution",
    "v3CensusStateFips",
    "v3CensusCountyFips",
    "v3CensusPlaceFips",
    "v3CensusMetricSet",
    "v3CensusGeoSearch",
    "v3CensusTractFilter",
    "v3CensusGeoPaste",
    "v3CensusSelectionSetName",
    "v3CensusSelectionSetSelect",
    "v3CensusApplyAdjustmentsToggle",
    "v3CensusElectionCsvFile",
    "v3CensusElectionCsvPrecinctFilter",
    "v3CensusMapQaVtdToggle",
    "v3CensusMapQaVtdZip",
    "v3CensusGeoSelect",
    "v3BtnCensusLoadGeo",
    "v3BtnCensusFetchRows",
    "v3BtnCensusApplyGeoPaste",
    "v3BtnCensusSelectAll",
    "v3BtnCensusClearSelection",
    "v3BtnCensusSaveSelectionSet",
    "v3BtnCensusLoadSelectionSet",
    "v3BtnCensusDeleteSelectionSet",
    "v3BtnCensusExportAggregateCsv",
    "v3BtnCensusExportAggregateJson",
    "v3BtnCensusSetRaceFootprint",
    "v3BtnCensusClearRaceFootprint",
    "v3BtnCensusDownloadElectionCsvTemplate",
    "v3BtnCensusDownloadElectionCsvWideTemplate",
    "v3BtnCensusElectionCsvDryRun",
    "v3BtnCensusElectionCsvClear",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLButtonElement
    ) {
      el.disabled = el.disabled || controlsLocked;
    }
  });
}

function syncBridgeText({ v3Id, bridgeText, fallback = "—" }) {
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

function queueDistrictCensusSync() {
  syncDistrictCensusProxy();
  window.requestAnimationFrame(() => {
    syncDistrictCensusProxy();
  });
}

function bindDistrictCensusField(v3Id, field, eventName = "input") {
  const control = document.getElementById(v3Id);
  if (
    !(control instanceof HTMLInputElement
      || control instanceof HTMLSelectElement
      || control instanceof HTMLTextAreaElement)
    || control.dataset.v3DistrictCensusBound === "1"
  ) {
    return;
  }
  control.dataset.v3DistrictCensusBound = "1";
  control.addEventListener(eventName, () => {
    setDistrictCensusField(field, control.value);
    queueDistrictCensusSync();
  });
}

function bindDistrictCensusCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.type !== "checkbox" || control.dataset.v3DistrictCensusBound === "1") {
    return;
  }
  control.dataset.v3DistrictCensusBound = "1";
  control.addEventListener("change", () => {
    setDistrictCensusField(field, control.checked);
    queueDistrictCensusSync();
  });
}

function bindDistrictCensusGeoSelection(v3Id) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictCensusBound === "1") {
    return;
  }
  control.dataset.v3DistrictCensusBound = "1";
  control.addEventListener("change", () => {
    const selected = Array.from(control.selectedOptions).map((option) => option.value);
    setDistrictCensusGeoSelection(selected);
    queueDistrictCensusSync();
  });
}

function bindDistrictCensusFile(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.type !== "file" || control.dataset.v3DistrictCensusBound === "1") {
    return;
  }
  control.dataset.v3DistrictCensusBound = "1";
  control.addEventListener("change", () => {
    setDistrictCensusFile(field, control.files);
    queueDistrictCensusSync();
  });
}

function bindDistrictCensusAction(v3Id, action) {
  const button = document.getElementById(v3Id);
  if (!(button instanceof HTMLButtonElement) || button.dataset.v3DistrictCensusBound === "1") {
    return;
  }
  button.dataset.v3DistrictCensusBound = "1";
  button.addEventListener("click", () => {
    triggerDistrictCensusAction(action);
    queueDistrictCensusSync();
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

  if (!isIdle) {
    scheduleCensusMapResizePulse();
  }
}

function scheduleCensusMapResizePulse() {
  if (typeof window === "undefined") {
    return;
  }
  if (censusMapResizePulseHandle) {
    window.clearTimeout(censusMapResizePulseHandle);
  }
  censusMapResizePulseHandle = window.setTimeout(() => {
    censusMapResizePulseHandle = 0;
    try {
      window.dispatchEvent(new Event("resize"));
    } catch {}
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        try {
          window.dispatchEvent(new Event("resize"));
        } catch {}
      });
    }
  }, 32);
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

function assignCardStatusId(card, id) {
  if (!(card instanceof HTMLElement) || !id) {
    return;
  }
  const badge = card.querySelector(".fpe-card__status");
  if (badge instanceof HTMLElement) {
    badge.id = id;
  }
}

function syncDistrictCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || DISTRICT_STATUS_AWAITING_INPUTS;
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyDistrictStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
}

function deriveDistrictRaceCardStatus() {
  return deriveDistrictRaceCardStatusCore({
    raceType: readSelectTextById("v3DistrictRaceType"),
    electionDate: readValueTextById("v3DistrictElectionDate"),
    mode: readSelectTextById("v3DistrictMode"),
  });
}

function deriveDistrictElectorateCardStatus() {
  return deriveDistrictElectorateCardStatusCore({
    universe: readValueTextById("v3DistrictUniverseSize"),
    basis: readSelectTextById("v3DistrictUniverseBasis"),
    sourceNote: readValueTextById("v3DistrictSourceNote"),
  });
}

function deriveDistrictBaselineCardStatus() {
  return deriveDistrictBaselineCardStatusCore({
    warning: readTextById("v3DistrictCandWarn"),
    supportTotal: readTextById("v3DistrictSupportTotal"),
  });
}

function deriveDistrictTurnoutCardStatus() {
  return deriveDistrictTurnoutCardStatusCore({
    turnoutExpected: readTextById("v3DistrictTurnoutExpected"),
    turnoutA: readValueTextById("v3DistrictTurnoutA"),
    turnoutB: readValueTextById("v3DistrictTurnoutB"),
  });
}

function deriveDistrictStructureCardStatus() {
  return deriveDistrictStructureCardStatusCore({
    enabled: readCheckboxChecked("v3DistrictElectorateWeightingToggle"),
    warning: readTextById("v3DistrictStructureWarn"),
  });
}

function deriveDistrictSummaryCardStatus(snapshot) {
  return deriveDistrictSummaryCardStatusCore(snapshot || {});
}

function deriveDistrictCensusCardStatus() {
  return deriveDistrictCensusCardStatusCore({
    status: readTextById("v3CensusStatus"),
    geoStats: readTextById("v3CensusGeoStats"),
  });
}

function deriveDistrictTargetingCardStatus() {
  return deriveDistrictTargetingCardStatusCore({
    status: readTextById("v3DistrictTargetingStatus"),
    rowCount: countBodyRows("v3DistrictTargetingResultsTbody"),
  });
}

function classifyDistrictStatusTone(text) {
  return classifyDistrictStatusToneCore(text);
}

function readTextById(id) {
  const node = document.getElementById(id);
  return node ? String(node.textContent || "").trim() : "";
}

function readValueTextById(id) {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
    return "";
  }
  return String(node.value || "").trim();
}

function readSelectTextById(id) {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLSelectElement)) {
    return "";
  }
  const option = node.selectedOptions && node.selectedOptions.length ? node.selectedOptions[0] : null;
  return option ? String(option.textContent || "").trim() : "";
}

function countBodyRows(id) {
  const tbody = document.getElementById(id);
  if (!(tbody instanceof HTMLElement)) {
    return 0;
  }
  const rows = Array.from(tbody.querySelectorAll(":scope > tr"));
  return rows.filter((row) => !row.querySelector(".muted")).length;
}
