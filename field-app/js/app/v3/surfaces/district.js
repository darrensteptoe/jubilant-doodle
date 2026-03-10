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
  const censusLegacyCard = mountLegacyNode({
    key: "v3-district-census-phase1-card",
    selector: "#censusPhase1Card",
    target: censusBody
  });
  normalizeCensusPhase1Card(censusLegacyCard);

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
  syncCensusMapShellState();
}

function normalizeCensusPhase1Card(card) {
  if (!(card instanceof HTMLElement)) {
    return;
  }
  if (card.dataset.v3CensusNormalized === "1") {
    syncCensusMapShellState();
    return;
  }
  card.dataset.v3CensusNormalized = "1";
  card.classList.add("fpe-census-card");

  const intro = card.querySelector(":scope > .help-text");
  const resolutionHint = card.querySelector(":scope > .muted:not([id])");

  const apiKeyField = findClosest(card, "#censusApiKey", ".field");
  const acsYearField = findClosest(card, "#censusAcsYear", ".field");
  const resolutionField = findClosest(card, "#censusResolution", ".field");
  const stateField = findClosest(card, "#censusStateFips", ".field");
  const countyField = findClosest(card, "#censusCountyFips", ".field");
  const placeField = findClosest(card, "#censusPlaceFips", ".field");
  const contextHint = card.querySelector("#censusContextHint");

  const metricSetField = findClosest(card, "#censusMetricSet", ".field");
  const fetchActions = findClosest(card, "#btnCensusLoadGeo", ".rowline");
  const censusStatus = card.querySelector("#censusStatus");
  const censusGeoStats = card.querySelector("#censusGeoStats");
  const censusLastFetch = card.querySelector("#censusLastFetch");
  const selectionSetGrid = findClosest(card, "#censusSelectionSetName", ".grid2");
  const selectionSetStatus = card.querySelector("#censusSelectionSetStatus");

  const geoSelectionGrid = findClosest(card, "#censusGeoSearch", ".grid2");
  const aggregateExportActions = findClosest(card, "#btnCensusExportAggregateCsv", ".rowline");

  const advisoryTable = findClosest(card, "#censusAdvisoryTbody", ".table-wrap");
  const advisoryStatus = card.querySelector("#censusAdvisoryStatus");
  const advisoryGuide = card.querySelector("#censusAdvisoryGuide");

  const selectionSummary = card.querySelector("#censusSelectionSummary");
  const footprintActions = findClosest(card, "#btnCensusSetRaceFootprint", ".rowline");
  const raceFootprintStatus = card.querySelector("#censusRaceFootprintStatus");
  const provenanceStatus = card.querySelector("#censusAssumptionProvenanceStatus");
  const capacityStatus = card.querySelector("#censusFootprintCapacityStatus");
  const applyAdjustmentsToggle = findClosest(card, "#censusApplyAdjustmentsToggle", ".switch");
  const applyAdjustmentsStatus = card.querySelector("#censusApplyAdjustmentsStatus");

  const mapStatusRow = findClosest(card, "#censusMapStatus", ".rowline");
  const mapZipRow = findClosest(card, "#censusMapQaVtdZip", ".rowline");
  const mapZipStatus = card.querySelector("#censusMapQaVtdZipStatus");
  const mapHost = card.querySelector("#censusMap");

  const electionDetails = findClosest(card, "#censusElectionCsvGuideStatus", "details");
  const electionGuideNote = electionDetails?.querySelector(":scope > .note");
  const electionGuideStatus = card.querySelector("#censusElectionCsvGuideStatus");
  const electionGuideTable = electionDetails?.querySelector("table[aria-label='Election CSV required columns']")?.closest(".table-wrap");
  const electionGuideSchema = Array.from(electionDetails?.querySelectorAll(":scope > .muted") || []).find((node) =>
    (node.textContent || "").toLowerCase().includes("schema:")
  );
  const electionTemplateActions = findClosest(card, "#btnCensusDownloadElectionCsvTemplate", ".rowline");
  const electionUploadGrid = findClosest(card, "#censusElectionCsvFile", ".grid2");
  const electionPrecinctField = findClosest(card, "#censusElectionCsvPrecinctFilter", ".field");
  const electionDryRunStatus = card.querySelector("#censusElectionCsvDryRunStatus");
  const electionPreviewMeta = card.querySelector("#censusElectionCsvPreviewMeta");
  const electionPreviewTable = findClosest(card, "#censusElectionCsvPreviewTbody", ".table-wrap");

  const layout = document.createElement("div");
  layout.className = "fpe-census-layout";

  if (intro) {
    intro.classList.add("fpe-census-intro");
    layout.appendChild(intro);
  }

  const geographySection = createCensusSection({
    title: "Geography context",
    description: "Set API/year/resolution and geographic scope before loading GEO units."
  });
  const geographyTopGrid = createFieldGrid("fpe-field-grid--3");
  appendIfPresent(geographyTopGrid, apiKeyField, acsYearField, resolutionField);
  if (geographyTopGrid.children.length) {
    geographySection.body.appendChild(geographyTopGrid);
  }
  appendIfPresent(geographySection.body, resolutionHint);

  const geographyBottomGrid = createFieldGrid("fpe-field-grid--3");
  appendIfPresent(geographyBottomGrid, stateField, countyField, placeField);
  if (geographyBottomGrid.children.length) {
    geographySection.body.appendChild(geographyBottomGrid);
  }
  appendIfPresent(geographySection.body, contextHint);
  layout.appendChild(geographySection.section);

  const bundleSection = createCensusSection({
    title: "Data bundle, fetch, and saved sets",
    description: "Choose the ACS bundle, fetch rows, then save/load reusable GEO selection sets."
  });
  const bundleGrid = createFieldGrid("fpe-field-grid--2");
  appendIfPresent(bundleGrid, metricSetField);
  const fetchActionsField = createFetchActionsField(fetchActions);
  appendIfPresent(bundleGrid, fetchActionsField);
  if (bundleGrid.children.length) {
    bundleSection.body.appendChild(bundleGrid);
  }

  const statusStrip = document.createElement("div");
  statusStrip.className = "fpe-census-status-strip";
  appendIfPresent(
    statusStrip,
    toStatusChip(censusStatus),
    toStatusChip(censusGeoStats),
    toStatusChip(censusLastFetch)
  );
  if (statusStrip.children.length) {
    bundleSection.body.appendChild(statusStrip);
  }
  appendIfPresent(bundleSection.body, selectionSetGrid, selectionSetStatus);
  layout.appendChild(bundleSection.section);

  const geoMetricsSection = createCensusSection({
    title: "GEO selection and aggregate metrics",
    description: "Search/paste/select GEO units and review aggregated demographic outputs."
  });
  if (aggregateExportActions instanceof HTMLElement) {
    aggregateExportActions.classList.add("fpe-census-aggregate-actions", "fpe-action-row");
  }
  appendIfPresent(geoMetricsSection.body, geoSelectionGrid);
  appendIfPresent(geoMetricsSection.body, aggregateExportActions);
  layout.appendChild(geoMetricsSection.section);

  const footprintSection = createCensusSection({
    title: "Race footprint and assumption apply",
    description: "Bind selected GEO units to race footprint and control adjusted-assumption application."
  });
  appendIfPresent(
    footprintSection.body,
    selectionSummary,
    footprintActions,
    raceFootprintStatus,
    provenanceStatus,
    capacityStatus,
    applyAdjustmentsToggle,
    applyAdjustmentsStatus
  );
  layout.appendChild(footprintSection.section);

  const advisorySection = createCensusSection({
    title: "Advisory signals",
    description: "Review computed signal levels and interpretation guidance for the selected footprint."
  });
  appendIfPresent(advisorySection.body, advisoryTable, advisoryStatus, advisoryGuide);
  layout.appendChild(advisorySection.section);

  const electionSection = createCensusSection({
    title: "Election CSV intake",
    description: "Template download, dry-run validation, and preview before import."
  });
  if (electionDetails instanceof HTMLDetailsElement) {
    electionDetails.classList.add("fpe-census-election-details");
    electionDetails.open = false;
    const summary = electionDetails.querySelector(":scope > summary");
    if (summary instanceof HTMLElement) {
      summary.textContent = "Instructions";
    }

    const guideBody = document.createElement("div");
    guideBody.className = "fpe-census-election-guide";
    appendIfPresent(guideBody, electionGuideNote, electionGuideStatus, electionGuideTable, electionGuideSchema);

    if (summary) {
      electionDetails.replaceChildren(summary, guideBody);
    } else {
      electionDetails.replaceChildren(guideBody);
    }
  }

  if (electionTemplateActions instanceof HTMLElement) {
    electionTemplateActions.classList.add("fpe-action-row");
  }
  appendIfPresent(electionSection.body, electionTemplateActions, electionUploadGrid, electionPrecinctField);

  const electionStatusStrip = document.createElement("div");
  electionStatusStrip.className = "fpe-census-election-status-strip";
  appendIfPresent(electionStatusStrip, toStatusChip(electionDryRunStatus), toStatusChip(electionPreviewMeta));
  if (electionStatusStrip.children.length) {
    electionSection.body.appendChild(electionStatusStrip);
  }
  appendIfPresent(electionSection.body, electionPreviewTable, electionDetails);
  layout.appendChild(electionSection.section);

  const mapSection = createCensusSection({
    title: "Map and boundary QA",
    description: "Boundary overlay controls and QA source management for visual verification."
  });
  if (mapStatusRow instanceof HTMLElement) {
    mapStatusRow.classList.add("fpe-census-map-row");
  }
  appendIfPresent(mapSection.body, mapStatusRow, mapZipRow, mapZipStatus);

  if (mapHost instanceof HTMLElement) {
    const mapShell = document.createElement("div");
    mapShell.className = "fpe-census-map-shell";
    const mapOverlay = document.createElement("div");
    mapOverlay.className = "fpe-census-map-overlay";
    mapOverlay.textContent = "Map idle. Select GEO units and load boundaries.";
    mapShell.append(mapHost, mapOverlay);
    mapSection.body.appendChild(mapShell);
  }
  layout.appendChild(mapSection.section);

  card.replaceChildren(layout);
  syncCensusMapShellState();
}

function createCensusSection({ title, description = "" }) {
  const section = document.createElement("section");
  section.className = "fpe-census-section";

  const head = document.createElement("header");
  head.className = "fpe-census-section__head";

  const heading = document.createElement("h3");
  heading.className = "fpe-census-section__title";
  heading.textContent = title;
  head.appendChild(heading);

  if (description) {
    const text = document.createElement("p");
    text.className = "fpe-census-section__desc";
    text.textContent = description;
    head.appendChild(text);
  }

  const body = document.createElement("div");
  body.className = "fpe-census-section__body";

  section.append(head, body);
  return { section, body };
}

function findClosest(root, selector, closestSelector) {
  const node = root.querySelector(selector);
  return node ? node.closest(closestSelector) : null;
}

function appendIfPresent(target, ...nodes) {
  if (!(target instanceof HTMLElement)) {
    return;
  }
  nodes.forEach((node) => {
    if (node instanceof Node) {
      target.appendChild(node);
    }
  });
}

function toStatusChip(node) {
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  const chip = document.createElement("div");
  chip.className = "fpe-census-status-chip";
  chip.appendChild(node);
  return chip;
}

function createFetchActionsField(row) {
  if (!(row instanceof HTMLElement)) {
    return null;
  }
  row.classList.add("fpe-action-row");

  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.className = "fpe-control-label";
  label.textContent = "Fetch actions";

  field.append(label, row);
  return field;
}

function syncCensusMapShellState() {
  const shell = document.querySelector("#censusPhase1Card .fpe-census-map-shell");
  if (!(shell instanceof HTMLElement)) {
    return;
  }

  const statusText = (document.getElementById("censusMapStatus")?.textContent || "").trim();
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

function isCensusMapIdle(statusText) {
  const value = String(statusText || "").toLowerCase();
  return (
    !value ||
    value.includes("map idle") ||
    value.includes("select geo units") ||
    value.includes("no boundary overlay")
  );
}
