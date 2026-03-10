import {
  createCard,
  createColumn,
  createSurfaceFrame,
  setCardHeaderControl,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import { readDistrictSnapshot } from "../stateBridge.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  createFieldGrid,
  setText,
  syncButtonDisabled,
  syncCheckboxValue
} from "../surfaceUtils.js";

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
    <span class="fpe-header-switch__label">Electorate weighting</span>
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

  const raceGrid = createFieldGrid("fpe-field-grid--2");
  const raceBody = getCardBody(raceCard);
  raceBody.append(raceGrid);
  mountLegacyClosest({
    key: "v3-district-raceType-field",
    childSelector: "#raceType",
    closestSelector: ".field",
    target: raceGrid
  });
  mountLegacyClosest({
    key: "v3-district-electionDate-field",
    childSelector: "#electionDate",
    closestSelector: ".field",
    target: raceGrid
  });
  mountLegacyClosest({
    key: "v3-district-weeksRemaining-field",
    childSelector: "#weeksRemaining",
    closestSelector: ".field",
    target: raceGrid
  });
  mountLegacyClosest({
    key: "v3-district-mode-field",
    childSelector: "#mode",
    closestSelector: ".field",
    target: raceGrid
  });

  const electorateGrid = createFieldGrid("fpe-field-grid--2");
  const electorateBody = getCardBody(electorateCard);
  electorateBody.append(electorateGrid);
  mountLegacyClosest({
    key: "v3-district-universeSize-field",
    childSelector: "#universeSize",
    closestSelector: ".field",
    target: electorateGrid
  });
  mountLegacyClosest({
    key: "v3-district-universeBasis-field",
    childSelector: "#universeBasis",
    closestSelector: ".field",
    target: electorateGrid
  });
  mountLegacyClosest({
    key: "v3-district-sourceNote-field",
    childSelector: "#sourceNote",
    closestSelector: ".field",
    target: electorateGrid
  });

  const baselineBody = getCardBody(baselineCard);
  const baselineTop = createFieldGrid("fpe-field-grid--1");
  const baselineBottom = createFieldGrid("fpe-field-grid--2");
  baselineBottom.style.marginTop = "14px";
  baselineBody.append(baselineTop);
  mountLegacyClosest({
    key: "v3-district-yourCandidate-field",
    childSelector: "#yourCandidate",
    closestSelector: ".field",
    target: baselineTop
  });
  const baselineActions = document.createElement("div");
  baselineActions.className = "fpe-action-row";
  baselineActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnAddCandidate" type="button">Add candidate</button>
  `;
  baselineBody.append(baselineActions);
  mountLegacyNode({
    key: "v3-district-candidate-table",
    selector: "#ballotBaselineCard .table-wrap",
    target: baselineBody
  });
  baselineBody.append(baselineBottom);
  mountLegacyClosest({
    key: "v3-district-undecidedMode-field",
    childSelector: "#undecidedMode",
    closestSelector: ".field",
    target: baselineBottom
  });
  mountLegacyNode({
    key: "v3-district-userSplit-field",
    selector: "#userSplitWrap",
    target: baselineBottom
  });
  mountLegacyNode({
    key: "v3-district-candWarn",
    selector: "#candWarn",
    target: baselineBody
  });

  const turnoutBody = getCardBody(turnoutCard);
  const turnoutFields = createFieldGrid("fpe-field-grid--3");
  turnoutBody.append(turnoutFields);
  mountLegacyClosest({
    key: "v3-district-turnoutA-field",
    childSelector: "#turnoutA",
    closestSelector: ".field",
    target: turnoutFields
  });
  mountLegacyClosest({
    key: "v3-district-turnoutB-field",
    childSelector: "#turnoutB",
    closestSelector: ".field",
    target: turnoutFields
  });
  mountLegacyClosest({
    key: "v3-district-bandWidth-field",
    childSelector: "#bandWidth",
    closestSelector: ".field",
    target: turnoutFields
  });
  mountLegacyClosest({
    key: "v3-district-turnout-metrics",
    childSelector: "#turnoutExpected",
    closestSelector: ".inline-metrics",
    target: turnoutBody
  });

  const structureBody = getCardBody(structureCard);
  const structureShares = createFieldGrid("fpe-field-grid--4");
  structureBody.append(structureShares);
  mountLegacyClosest({
    key: "v3-district-structure-dem-field",
    childSelector: "#universe16DemPct",
    closestSelector: ".field",
    target: structureShares
  });
  mountLegacyClosest({
    key: "v3-district-structure-rep-field",
    childSelector: "#universe16RepPct",
    closestSelector: ".field",
    target: structureShares
  });
  mountLegacyClosest({
    key: "v3-district-structure-npa-field",
    childSelector: "#universe16NpaPct",
    closestSelector: ".field",
    target: structureShares
  });
  mountLegacyClosest({
    key: "v3-district-structure-other-field",
    childSelector: "#universe16OtherPct",
    closestSelector: ".field",
    target: structureShares
  });
  const structureDerived = createFieldGrid("fpe-field-grid--2");
  structureBody.append(structureDerived);
  mountLegacyClosest({
    key: "v3-district-structure-retention-field",
    childSelector: "#retentionFactor",
    closestSelector: ".field",
    target: structureDerived
  });
  mountLegacyClosest({
    key: "v3-district-structure-derived-field",
    childSelector: "#universe16Derived",
    closestSelector: ".field",
    target: structureDerived
  });
  mountLegacyNode({
    key: "v3-district-structure-warn",
    selector: "#universe16Warn",
    target: structureBody
  });

  const censusBody = getCardBody(censusCard);
  mountLegacyNode({
    key: "v3-district-census-phase1-card",
    selector: "#censusPhase1Card",
    target: censusBody
  });

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Universe</span><strong id="v3DistrictUniverse">-</strong></div>
      <div class="fpe-summary-row"><span>Baseline support total</span><strong id="v3DistrictSupport">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout</span><strong id="v3DistrictTurnout">-</strong></div>
      <div class="fpe-summary-row"><span>Your projected votes</span><strong id="v3DistrictProjected">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3DistrictNeed">-</strong></div>
    </div>
  `;

  main.append(
    raceCard,
    electorateCard,
    baselineCard,
    turnoutCard,
    structureCard,
    censusCard,
    summaryCard
  );

  frame.append(main);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "District sets the denominators and assumptions every downstream result depends on.",
      "If baseline support or universe definitions drift, all win-path outputs drift with them.",
      "Use this page to verify race reality before operational planning."
    ])
  );

  bindClickProxy("v3BtnAddCandidate", "btnAddCandidate");
  bindCheckboxProxy("v3DistrictElectorateWeightingToggle", "universe16Enabled");
  return refreshDistrictSummary;
}

function refreshDistrictSummary() {
  const snapshot = readDistrictSnapshot();
  setText("v3DistrictUniverse", snapshot.universe);
  setText("v3DistrictSupport", snapshot.baselineSupport);
  setText("v3DistrictTurnout", snapshot.turnoutExpected);
  setText("v3DistrictProjected", snapshot.projectedVotes);
  setText("v3DistrictNeed", snapshot.persuasionNeed);
  syncButtonDisabled("v3BtnAddCandidate", "btnAddCandidate");
  syncCheckboxValue("v3DistrictElectorateWeightingToggle", "universe16Enabled");

  const v3Toggle = document.getElementById("v3DistrictElectorateWeightingToggle");
  const legacyToggle = document.getElementById("universe16Enabled");
  if (v3Toggle instanceof HTMLInputElement && legacyToggle instanceof HTMLInputElement) {
    v3Toggle.disabled = legacyToggle.disabled;
  }
}
