import { readText as readSurfaceText } from "./surfaceUtils.js";
import {
  callDistrictBridge,
  readDistrictCanonicalBridgeView,
  readDistrictDerivedBridgeView,
} from "./bridges/districtBridge.js";

const TURNOUT_API_KEY = "__FPE_TURNOUT_API__";
const ELECTION_DATA_API_KEY = "__FPE_ELECTION_DATA_API__";
const SHELL_API_KEY = "__FPE_SHELL_API__";

export function readText(selector) {
  return readSurfaceText(selector);
}

export function isMissingValue(value) {
  const normalized = String(value == null ? "" : value).trim();
  return !normalized || normalized === "-" || normalized === "—";
}

export function firstNonMissing(selectors = []) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of list) {
    const value = readText(selector);
    if (!isMissingValue(value)) {
      return value;
    }
  }
  return "";
}

function readDistrictDerivedSummary() {
  const derivedView = readDistrictDerivedBridgeView();
  const summary = derivedView?.summary;
  if (!summary || typeof summary !== "object") {
    return null;
  }
  return {
    universe: String(summary.universeText || "").trim(),
    baselineSupport: String(summary.baselineSupportText || "").trim(),
    turnoutExpected: String(summary.turnoutExpectedText || "").trim(),
    turnoutBand: String(summary.turnoutBandText || "").trim(),
    votesPer1pct: String(summary.votesPer1pctText || "").trim(),
    projectedVotes: String(summary.projectedVotesText || "").trim(),
    persuasionNeed: String(summary.persuasionNeedText || "").trim(),
  };
}

export function setDistrictTargetingField(field, value) {
  return callDistrictBridge("setTargetingField", field, value);
}

export function setDistrictFormField(field, value) {
  return callDistrictBridge("setFormField", field, value);
}

export function applyDistrictTemplateDefaults(mode = "all") {
  return callDistrictBridge("applyTemplateDefaults", mode);
}

export function addDistrictCandidate() {
  return callDistrictBridge("addCandidate");
}

export function updateDistrictCandidate(candidateId, field, value) {
  return callDistrictBridge("updateCandidate", candidateId, field, value);
}

export function removeDistrictCandidate(candidateId) {
  return callDistrictBridge("removeCandidate", candidateId);
}

export function setDistrictUserSplit(candidateId, value) {
  return callDistrictBridge("setUserSplit", candidateId, value);
}

export function addDistrictCandidateHistory() {
  return callDistrictBridge("addCandidateHistory");
}

export function updateDistrictCandidateHistory(recordId, field, value) {
  return callDistrictBridge("updateCandidateHistory", recordId, field, value);
}

export function removeDistrictCandidateHistory(recordId) {
  return callDistrictBridge("removeCandidateHistory", recordId);
}

export function applyDistrictTargetingPreset(modelId) {
  return callDistrictBridge("applyTargetingPreset", modelId);
}

export function resetDistrictTargetingWeights() {
  return callDistrictBridge("resetTargetingWeights");
}

export function runDistrictTargeting() {
  return callDistrictBridge("runTargeting");
}

export function exportDistrictTargetingCsv() {
  return callDistrictBridge("exportTargetingCsv");
}

export function exportDistrictTargetingJson() {
  return callDistrictBridge("exportTargetingJson");
}

export function setDistrictCensusField(field, value) {
  return callDistrictBridge("setCensusField", field, value);
}

export function setDistrictCensusGeoSelection(values) {
  return callDistrictBridge("setCensusGeoSelection", values);
}

export function setDistrictCensusFile(field, files) {
  return callDistrictBridge("setCensusFile", field, files);
}

export function triggerDistrictCensusAction(action) {
  return callDistrictBridge("triggerCensusAction", action);
}

export function readRuntimeDiagnosticsSnapshot() {
  const api = window?.[SHELL_API_KEY];
  if (!api || typeof api !== "object" || typeof api.getRuntimeDiagnostics !== "function") {
    return null;
  }
  try {
    const snapshot = api.getRuntimeDiagnostics();
    return snapshot && typeof snapshot === "object" ? snapshot : null;
  } catch {
    return null;
  }
}

export function readDistrictSummarySnapshot() {
  const bridgeSummary = readDistrictDerivedSummary();
  return {
    universe: !isMissingValue(bridgeSummary?.universe) ? String(bridgeSummary.universe) : "-",
    baselineSupport: !isMissingValue(bridgeSummary?.baselineSupport) ? String(bridgeSummary.baselineSupport) : "-",
    turnoutExpected: !isMissingValue(bridgeSummary?.turnoutExpected) ? String(bridgeSummary.turnoutExpected) : "-",
    turnoutBand: !isMissingValue(bridgeSummary?.turnoutBand) ? String(bridgeSummary.turnoutBand) : "-",
    votesPer1pct: !isMissingValue(bridgeSummary?.votesPer1pct) ? String(bridgeSummary.votesPer1pct) : "-",
    projectedVotes: !isMissingValue(bridgeSummary?.projectedVotes) ? String(bridgeSummary.projectedVotes) : "-",
    persuasionNeed: !isMissingValue(bridgeSummary?.persuasionNeed) ? String(bridgeSummary.persuasionNeed) : "-",
  };
}

export function readDistrictControlSnapshot() {
  const canonicalView = readDistrictCanonicalBridgeView();
  const controls = canonicalView?.controls;
  if (!controls || typeof controls !== "object") {
    return {
      locked: false,
      disabledMap: {},
    };
  }
  return {
    locked: !!controls.locked,
    disabledMap: controls.disabledMap && typeof controls.disabledMap === "object" ? controls.disabledMap : {},
  };
}

export function readDistrictTemplateSnapshot() {
  const canonicalTemplate = readDistrictCanonicalBridgeView()?.template;
  const derivedTemplate = readDistrictDerivedBridgeView()?.template;
  const template = canonicalTemplate && typeof canonicalTemplate === "object"
    ? canonicalTemplate
    : null;
  if (!template) {
    return null;
  }
  const overridden = Array.isArray(template.overriddenFields)
    ? template.overriddenFields.map((field) => String(field || "").trim()).filter(Boolean)
    : [];
  return {
    raceType: String(template.raceType || "").trim(),
    officeLevel: String(template.officeLevel || "").trim(),
    electionType: String(template.electionType || "").trim(),
    seatContext: String(template.seatContext || "").trim(),
    partisanshipMode: String(template.partisanshipMode || "").trim(),
    salienceLevel: String(template.salienceLevel || "").trim(),
    appliedTemplateId: String(template.appliedTemplateId || "").trim(),
    appliedVersion: String(template.appliedVersion || "").trim(),
    benchmarkKey: String(template.benchmarkKey || "").trim(),
    assumptionsProfile: String(template.assumptionsProfile || "").trim(),
    candidateHistoryCoverageBand: String(
      derivedTemplate?.candidateHistoryCoverageBand ?? "",
    ).trim(),
    candidateHistoryConfidenceBand: String(
      derivedTemplate?.candidateHistoryConfidenceBand ?? "",
    ).trim(),
    candidateHistoryRecordCount: Number.isFinite(
      Number(derivedTemplate?.candidateHistoryRecordCount),
    )
      ? Number(derivedTemplate?.candidateHistoryRecordCount)
      : 0,
    overriddenFields: overridden,
  };
}

export function readDistrictFormSnapshot() {
  const canonicalView = readDistrictCanonicalBridgeView();
  const form = canonicalView?.form;
  if (!form || typeof form !== "object") {
    return null;
  }
  return {
    raceType: String(form.raceType || "").trim(),
    electionDate: String(form.electionDate || "").trim(),
    weeksRemaining: String(form.weeksRemaining ?? "").trim(),
    mode: String(form.mode || "").trim(),
    universeSize: toOptionalSnapshotNumber(form.universeSize),
    universeBasis: String(form.universeBasis || "").trim(),
    sourceNote: String(form.sourceNote || "").trim(),
    turnoutA: toOptionalSnapshotNumber(form.turnoutA),
    turnoutB: toOptionalSnapshotNumber(form.turnoutB),
    bandWidth: toOptionalSnapshotNumber(form.bandWidth),
    universe16Enabled: !!form.universe16Enabled,
    universe16DemPct: toOptionalSnapshotNumber(form.universe16DemPct),
    universe16RepPct: toOptionalSnapshotNumber(form.universe16RepPct),
    universe16NpaPct: toOptionalSnapshotNumber(form.universe16NpaPct),
    universe16OtherPct: toOptionalSnapshotNumber(form.universe16OtherPct),
    retentionFactor: toOptionalSnapshotNumber(form.retentionFactor),
  };
}

export function readDistrictBallotSnapshot() {
  const canonicalBallot = readDistrictCanonicalBridgeView()?.ballot;
  const derivedBallot = readDistrictDerivedBridgeView()?.ballot;
  if (!canonicalBallot || typeof canonicalBallot !== "object") {
    return null;
  }
  const candidatesRaw = Array.isArray(canonicalBallot.candidates) ? canonicalBallot.candidates : [];
  const userSplitRaw = Array.isArray(canonicalBallot.userSplitRows) ? canonicalBallot.userSplitRows : [];
  const historyRaw = Array.isArray(canonicalBallot.candidateHistoryRecords) ? canonicalBallot.candidateHistoryRecords : [];
  const historyOptions = canonicalBallot.candidateHistoryOptions && typeof canonicalBallot.candidateHistoryOptions === "object"
    ? canonicalBallot.candidateHistoryOptions
    : {};
  const normalizeOptionRows = (rows) => (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      value: String(row?.value || "").trim(),
      label: String(row?.label || row?.value || "").trim(),
    }))
    .filter((row) => row.value || row.label);
  return {
    yourCandidateId: String(canonicalBallot.yourCandidateId || "").trim(),
    undecidedPct: Number.isFinite(Number(canonicalBallot.undecidedPct)) ? Number(canonicalBallot.undecidedPct) : null,
    undecidedMode: String(canonicalBallot.undecidedMode || "").trim(),
    supportTotalText: String(derivedBallot?.supportTotalText || "").trim(),
    warningText: String(derivedBallot?.warningText || "").trim(),
    userSplitVisible: !!canonicalBallot.userSplitVisible,
    candidates: candidatesRaw.map((row) => ({
      id: String(row?.id || "").trim(),
      name: String(row?.name || "").trim(),
      supportPct: Number.isFinite(Number(row?.supportPct)) ? Number(row.supportPct) : null,
      canRemove: !!row?.canRemove,
    })).filter((row) => row.id),
    userSplitRows: userSplitRaw.map((row) => ({
      id: String(row?.id || "").trim(),
      name: String(row?.name || "").trim(),
      value: Number.isFinite(Number(row?.value)) ? Number(row.value) : null,
    })).filter((row) => row.id),
    candidateHistorySummaryText: String(derivedBallot?.candidateHistorySummaryText || "").trim(),
    candidateHistoryWarningText: String(derivedBallot?.candidateHistoryWarningText || "").trim(),
    candidateHistoryOptions: {
      office: normalizeOptionRows(historyOptions.office),
      electionType: normalizeOptionRows(historyOptions.electionType),
      incumbencyStatus: normalizeOptionRows(historyOptions.incumbencyStatus),
    },
    candidateHistoryRecords: historyRaw.map((row) => ({
      recordId: String(row?.recordId || "").trim(),
      office: String(row?.office || "").trim(),
      cycleYear: Number.isFinite(Number(row?.cycleYear)) ? Number(row.cycleYear) : null,
      electionType: String(row?.electionType || "").trim(),
      candidateName: String(row?.candidateName || "").trim(),
      party: String(row?.party || "").trim(),
      incumbencyStatus: String(row?.incumbencyStatus || "").trim(),
      voteShare: Number.isFinite(Number(row?.voteShare)) ? Number(row.voteShare) : null,
      margin: Number.isFinite(Number(row?.margin)) ? Number(row.margin) : null,
      turnoutContext: Number.isFinite(Number(row?.turnoutContext)) ? Number(row.turnoutContext) : null,
      repeatCandidate: !!row?.repeatCandidate,
      overUnderPerformancePct: Number.isFinite(Number(row?.overUnderPerformancePct)) ? Number(row.overUnderPerformancePct) : null,
    })).filter((row) => row.recordId),
  };
}

export function readDistrictElectionDataSummarySnapshot() {
  const canonical = readDistrictCanonicalBridgeView()?.electionData;
  const derived = readDistrictDerivedBridgeView()?.electionData;
  if ((!canonical || typeof canonical !== "object") && (!derived || typeof derived !== "object")) {
    return null;
  }
  return {
    fileName: String(canonical?.fileName || "").trim(),
    importedAt: String(canonical?.importedAt || "").trim(),
    importStatus: String(canonical?.importStatus || "").trim(),
    normalizedRowCount: Number.isFinite(Number(canonical?.normalizedRowCount))
      ? Number(canonical.normalizedRowCount)
      : 0,
    qualityScore: Number.isFinite(Number(canonical?.qualityScore))
      ? Number(canonical.qualityScore)
      : null,
    confidenceBand: String(canonical?.confidenceBand || "").trim() || "unknown",
    benchmarkSuggestionCount: Number.isFinite(Number(canonical?.benchmarkSuggestionCount))
      ? Number(canonical.benchmarkSuggestionCount)
      : 0,
    downstreamReady: !!canonical?.downstreamReady,
    statusText: String(derived?.statusText || "").trim(),
    qualityText: String(derived?.qualityText || "").trim(),
    benchmarkText: String(derived?.benchmarkText || "").trim(),
    importedAtText: String(derived?.importedAtText || "").trim(),
  };
}

export function normalizeDistrictTargetingSnapshotFromView(view) {
  const targeting = view?.targeting;
  if (!targeting || typeof targeting !== "object") {
    return null;
  }
  const config = targeting.config && typeof targeting.config === "object" ? targeting.config : {};

  const rowsRaw = Array.isArray(targeting.rows) ? targeting.rows : [];
  const rows = rowsRaw.map((row) => ({
    rank: String(row?.rankText || "").trim(),
    geoid: String(row?.geoidText || "").trim(),
    geography: String(row?.geoText || "").trim(),
    score: String(row?.scoreText || "").trim(),
    scoreValue: Number.isFinite(Number(row?.scoreValue)) ? Number(row.scoreValue) : null,
    votesPerHour: String(row?.votesPerHourText || "").trim(),
    votesPerHourValue: Number.isFinite(Number(row?.votesPerHourValue)) ? Number(row.votesPerHourValue) : null,
    reason: String(row?.reasonText || "").trim(),
    flags: String(row?.flagsText || "").trim(),
    topTarget: !!row?.topTarget,
    turnoutPriority: !!row?.turnoutPriority,
    persuasionPriority: !!row?.persuasionPriority,
    efficiencyPriority: !!row?.efficiencyPriority,
  })).filter((row) => row.rank || row.geoid || row.geography || row.score || row.votesPerHour || row.reason || row.flags);

  return {
    statusText: String(targeting.statusText || "").trim(),
    metaText: String(targeting.metaText || "").trim(),
    rows,
    config: {
      presetId: String(config.presetId || "").trim(),
      geoLevel: String(config.geoLevel || "").trim(),
      modelId: String(config.modelId || "").trim(),
      topN: Number.isFinite(Number(config.topN)) ? Number(config.topN) : null,
      minHousingUnits: Number.isFinite(Number(config.minHousingUnits)) ? Number(config.minHousingUnits) : null,
      minPopulation: Number.isFinite(Number(config.minPopulation)) ? Number(config.minPopulation) : null,
      minScore: Number.isFinite(Number(config.minScore)) ? Number(config.minScore) : null,
      onlyRaceFootprint: !!config.onlyRaceFootprint,
      prioritizeYoung: !!config.prioritizeYoung,
      prioritizeRenters: !!config.prioritizeRenters,
      avoidHighMultiUnit: !!config.avoidHighMultiUnit,
      densityFloor: String(config.densityFloor || "").trim(),
      weightVotePotential: Number.isFinite(Number(config.weightVotePotential)) ? Number(config.weightVotePotential) : null,
      weightTurnoutOpportunity: Number.isFinite(Number(config.weightTurnoutOpportunity)) ? Number(config.weightTurnoutOpportunity) : null,
      weightPersuasionIndex: Number.isFinite(Number(config.weightPersuasionIndex)) ? Number(config.weightPersuasionIndex) : null,
      weightFieldEfficiency: Number.isFinite(Number(config.weightFieldEfficiency)) ? Number(config.weightFieldEfficiency) : null,
      controlsLocked: !!config.controlsLocked,
      canRun: config.canRun == null ? null : !!config.canRun,
      canExport: config.canExport == null ? null : !!config.canExport,
      canResetWeights: config.canResetWeights == null ? null : !!config.canResetWeights,
    },
  };
}

export function readDistrictTargetingConfigSnapshot() {
  const config = readDistrictCanonicalBridgeView()?.targeting?.config;
  if (!config || typeof config !== "object") {
    return null;
  }
  return {
    presetId: String(config.presetId || "").trim(),
    geoLevel: String(config.geoLevel || "").trim(),
    modelId: String(config.modelId || "").trim(),
    topN: Number.isFinite(Number(config.topN)) ? Number(config.topN) : null,
    minHousingUnits: Number.isFinite(Number(config.minHousingUnits)) ? Number(config.minHousingUnits) : null,
    minPopulation: Number.isFinite(Number(config.minPopulation)) ? Number(config.minPopulation) : null,
    minScore: Number.isFinite(Number(config.minScore)) ? Number(config.minScore) : null,
    onlyRaceFootprint: !!config.onlyRaceFootprint,
    prioritizeYoung: !!config.prioritizeYoung,
    prioritizeRenters: !!config.prioritizeRenters,
    avoidHighMultiUnit: !!config.avoidHighMultiUnit,
    densityFloor: String(config.densityFloor || "").trim(),
    weightVotePotential: Number.isFinite(Number(config.weightVotePotential)) ? Number(config.weightVotePotential) : null,
    weightTurnoutOpportunity: Number.isFinite(Number(config.weightTurnoutOpportunity)) ? Number(config.weightTurnoutOpportunity) : null,
    weightPersuasionIndex: Number.isFinite(Number(config.weightPersuasionIndex)) ? Number(config.weightPersuasionIndex) : null,
    weightFieldEfficiency: Number.isFinite(Number(config.weightFieldEfficiency)) ? Number(config.weightFieldEfficiency) : null,
    controlsLocked: !!config.controlsLocked,
    canRun: config.canRun == null ? null : !!config.canRun,
    canExport: config.canExport == null ? null : !!config.canExport,
    canResetWeights: config.canResetWeights == null ? null : !!config.canResetWeights,
  };
}

export function readDistrictTargetingResultsSnapshot() {
  const targeting = readDistrictDerivedBridgeView()?.targeting;
  if (!targeting || typeof targeting !== "object") {
    return null;
  }
  const rowsRaw = Array.isArray(targeting.rows) ? targeting.rows : [];
  const rows = rowsRaw.map((row) => ({
    rank: String(row?.rankText || "").trim(),
    geoid: String(row?.geoidText || "").trim(),
    geography: String(row?.geoText || "").trim(),
    score: String(row?.scoreText || "").trim(),
    scoreValue: Number.isFinite(Number(row?.scoreValue)) ? Number(row.scoreValue) : null,
    votesPerHour: String(row?.votesPerHourText || "").trim(),
    votesPerHourValue: Number.isFinite(Number(row?.votesPerHourValue)) ? Number(row.votesPerHourValue) : null,
    reason: String(row?.reasonText || "").trim(),
    flags: String(row?.flagsText || "").trim(),
    topTarget: !!row?.topTarget,
    turnoutPriority: !!row?.turnoutPriority,
    persuasionPriority: !!row?.persuasionPriority,
    efficiencyPriority: !!row?.efficiencyPriority,
  })).filter((row) => row.rank || row.geoid || row.geography || row.score || row.votesPerHour || row.reason || row.flags);
  return {
    statusText: String(targeting.statusText || "").trim(),
    metaText: String(targeting.metaText || "").trim(),
    rows,
  };
}

export function readDistrictTargetingSnapshot() {
  const config = readDistrictTargetingConfigSnapshot();
  const results = readDistrictTargetingResultsSnapshot();
  if (!config && !results) {
    return null;
  }
  return {
    statusText: String(results?.statusText || "").trim(),
    metaText: String(results?.metaText || "").trim(),
    rows: Array.isArray(results?.rows) ? results.rows : [],
    config: config || null,
  };
}

function normalizeCensusOptionRows(rows, { includeSelected = false } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const row of list) {
    const value = String(row?.value || "").trim();
    const label = String(row?.label || value).trim() || value;
    if (!value && !label) continue;
    const item = { value, label };
    if (includeSelected) {
      item.selected = !!row?.selected;
    }
    out.push(item);
  }
  return out;
}

function normalizeCensusTableRows(rows, expectedCols) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      const cells = Array.isArray(row) ? row : [];
      const normalized = cells.map((cell) => String(cell == null ? "" : cell).trim());
      while (normalized.length < expectedCols) normalized.push("");
      return normalized.slice(0, expectedCols);
    })
    .filter((cells) => cells.some((cell) => cell));
}

function normalizeBooleanMap(rawMap) {
  return Object.fromEntries(
    Object.entries(rawMap && typeof rawMap === "object" ? rawMap : {})
      .filter(([, value]) => typeof value === "boolean"),
  );
}

export function readDistrictCensusConfigSnapshot() {
  const config = readDistrictCanonicalBridgeView()?.census?.config;
  if (!config || typeof config !== "object") {
    return null;
  }
  return {
    apiKey: String(config.apiKey || "").trim(),
    year: String(config.year || "").trim(),
    resolution: String(config.resolution || "").trim(),
    stateFips: String(config.stateFips || "").trim(),
    countyFips: String(config.countyFips || "").trim(),
    placeFips: String(config.placeFips || "").trim(),
    metricSet: String(config.metricSet || "").trim(),
    geoSearch: String(config.geoSearch || "").trim(),
    geoPaste: String(config.geoPaste || "").trim(),
    tractFilter: String(config.tractFilter || "").trim(),
    selectionSetDraftName: String(config.selectionSetDraftName || "").trim(),
    selectedSelectionSetKey: String(config.selectedSelectionSetKey || "").trim(),
    electionCsvPrecinctFilter: String(config.electionCsvPrecinctFilter || "").trim(),
    applyAdjustedAssumptions: !!config.applyAdjustedAssumptions,
    mapQaVtdOverlay: !!config.mapQaVtdOverlay,
    controlsLocked: !!config.controlsLocked,
    disabledMap: normalizeBooleanMap(config.disabledMap),
    stateOptions: normalizeCensusOptionRows(config.stateOptions),
    countyOptions: normalizeCensusOptionRows(config.countyOptions),
    placeOptions: normalizeCensusOptionRows(config.placeOptions),
    tractFilterOptions: normalizeCensusOptionRows(config.tractFilterOptions),
    selectionSetOptions: normalizeCensusOptionRows(config.selectionSetOptions),
    geoSelectOptions: normalizeCensusOptionRows(config.geoSelectOptions, { includeSelected: true }),
  };
}

export function readDistrictCensusResultsSnapshot() {
  const census = readDistrictDerivedBridgeView()?.census;
  if (!census || typeof census !== "object") {
    return null;
  }
  return {
    contextHint: String(census.contextHint || "").trim(),
    selectionSetStatus: String(census.selectionSetStatus || "").trim(),
    statusText: String(census.statusText || "").trim(),
    geoStatsText: String(census.geoStatsText || "").trim(),
    lastFetchText: String(census.lastFetchText || "").trim(),
    selectionSummaryText: String(census.selectionSummaryText || "").trim(),
    raceFootprintStatusText: String(census.raceFootprintStatusText || "").trim(),
    assumptionProvenanceStatusText: String(census.assumptionProvenanceStatusText || "").trim(),
    footprintCapacityStatusText: String(census.footprintCapacityStatusText || "").trim(),
    applyAdjustmentsStatusText: String(census.applyAdjustmentsStatusText || "").trim(),
    advisoryStatusText: String(census.advisoryStatusText || "").trim(),
    electionCsvGuideStatusText: String(census.electionCsvGuideStatusText || "").trim(),
    electionCsvDryRunStatusText: String(census.electionCsvDryRunStatusText || "").trim(),
    electionCsvPreviewMetaText: String(census.electionCsvPreviewMetaText || "").trim(),
    mapStatusText: String(census.mapStatusText || "").trim(),
    mapQaVtdZipStatusText: String(census.mapQaVtdZipStatusText || "").trim(),
    aggregateRows: normalizeCensusTableRows(census.aggregateRows, 2),
    advisoryRows: normalizeCensusTableRows(census.advisoryRows, 2),
    electionPreviewRows: normalizeCensusTableRows(census.electionPreviewRows, 4),
  };
}

export function readDistrictCensusSnapshot() {
  const config = readDistrictCensusConfigSnapshot();
  const results = readDistrictCensusResultsSnapshot();
  if (!config && !results) {
    return null;
  }
  return {
    config: config || null,
    contextHint: String(results?.contextHint || "").trim(),
    selectionSetStatus: String(results?.selectionSetStatus || "").trim(),
    statusText: String(results?.statusText || "").trim(),
    geoStatsText: String(results?.geoStatsText || "").trim(),
    lastFetchText: String(results?.lastFetchText || "").trim(),
    selectionSummaryText: String(results?.selectionSummaryText || "").trim(),
    raceFootprintStatusText: String(results?.raceFootprintStatusText || "").trim(),
    assumptionProvenanceStatusText: String(results?.assumptionProvenanceStatusText || "").trim(),
    footprintCapacityStatusText: String(results?.footprintCapacityStatusText || "").trim(),
    applyAdjustmentsStatusText: String(results?.applyAdjustmentsStatusText || "").trim(),
    advisoryStatusText: String(results?.advisoryStatusText || "").trim(),
    electionCsvGuideStatusText: String(results?.electionCsvGuideStatusText || "").trim(),
    electionCsvDryRunStatusText: String(results?.electionCsvDryRunStatusText || "").trim(),
    electionCsvPreviewMetaText: String(results?.electionCsvPreviewMetaText || "").trim(),
    mapStatusText: String(results?.mapStatusText || "").trim(),
    mapQaVtdZipStatusText: String(results?.mapQaVtdZipStatusText || "").trim(),
    aggregateRows: Array.isArray(results?.aggregateRows) ? results.aggregateRows : [],
    advisoryRows: Array.isArray(results?.advisoryRows) ? results.advisoryRows : [],
    electionPreviewRows: Array.isArray(results?.electionPreviewRows) ? results.electionPreviewRows : [],
  };
}

function readElectionDataBridgeView() {
  try {
    const api = window[ELECTION_DATA_API_KEY];
    if (!api || typeof api.getView !== "function") {
      return null;
    }
    const view = api.getView();
    return view && typeof view === "object" ? view : null;
  } catch {
    return null;
  }
}

function readElectionDataCanonicalBridgeView() {
  try {
    const api = window[ELECTION_DATA_API_KEY];
    if (!api || typeof api !== "object") {
      return null;
    }
    if (typeof api.getCanonicalView === "function") {
      const view = api.getCanonicalView();
      return view && typeof view === "object" ? view : null;
    }
    const view = readElectionDataBridgeView();
    if (!view || typeof view !== "object") {
      return null;
    }
    if (view.canonical && typeof view.canonical === "object") {
      return view.canonical;
    }
    return view;
  } catch {
    return null;
  }
}

function readElectionDataDerivedBridgeView() {
  try {
    const api = window[ELECTION_DATA_API_KEY];
    if (!api || typeof api !== "object") {
      return null;
    }
    if (typeof api.getDerivedView === "function") {
      const view = api.getDerivedView();
      return view && typeof view === "object" ? view : null;
    }
    const view = readElectionDataBridgeView();
    if (!view || typeof view !== "object") {
      return null;
    }
    if (view.derived && typeof view.derived === "object") {
      return view.derived;
    }
    return view;
  } catch {
    return null;
  }
}

function callElectionDataBridge(method, ...args) {
  try {
    const api = window[ELECTION_DATA_API_KEY];
    if (!api || typeof api[method] !== "function") {
      return null;
    }
    return api[method](...args);
  } catch {
    return null;
  }
}

function cloneValue(value, fallback) {
  const src = value == null ? fallback : value;
  try {
    return structuredClone(src);
  } catch {
    return JSON.parse(JSON.stringify(src));
  }
}

function toSnapshotNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toOptionalSnapshotNumber(value) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function importElectionDataFileBridge(payload) {
  return callElectionDataBridge("importFile", payload);
}

export function mapElectionDataColumnsBridge(payload) {
  return callElectionDataBridge("mapColumns", payload);
}

export function reconcileElectionDataCandidatesBridge(payload) {
  return callElectionDataBridge("reconcileCandidates", payload);
}

export function reconcileElectionDataGeographiesBridge(payload) {
  return callElectionDataBridge("reconcileGeographies", payload);
}

export function applyElectionDataBenchmarksBridge(payload) {
  return callElectionDataBridge("applyBenchmarks", payload);
}

export function readElectionDataCanonicalSnapshot() {
  const canonical = readElectionDataCanonicalBridgeView();
  if (!canonical || typeof canonical !== "object") {
    return null;
  }
  return {
    revision: toSnapshotNumber(canonical.revision, 0) || 0,
    import: cloneValue(canonical.import, {}),
    schemaMapping: cloneValue(canonical.schemaMapping, {}),
    rawRows: cloneValue(canonical.rawRows, []),
    normalizedRows: cloneValue(canonical.normalizedRows, []),
    jurisdictionKeys: cloneValue(canonical.jurisdictionKeys, []),
    raceMeta: cloneValue(canonical.raceMeta, {}),
    geographyRefs: cloneValue(canonical.geographyRefs, { byId: {}, order: [] }),
    candidateRefs: cloneValue(canonical.candidateRefs, { byId: {}, order: [] }),
    partyRefs: cloneValue(canonical.partyRefs, { byId: {}, order: [] }),
    turnoutTotals: cloneValue(canonical.turnoutTotals, {}),
    voteTotals: cloneValue(canonical.voteTotals, {}),
    qa: cloneValue(canonical.qa, {}),
    quality: cloneValue(canonical.quality, {}),
    benchmarks: cloneValue(canonical.benchmarks, {}),
  };
}

export function readElectionDataDerivedSnapshot() {
  const derived = readElectionDataDerivedBridgeView();
  if (!derived || typeof derived !== "object") {
    return null;
  }
  return {
    importStatus: cloneValue(derived.importStatus, {}),
    coverage: cloneValue(derived.coverage, {}),
    totals: cloneValue(derived.totals, {}),
    qualitySummary: cloneValue(derived.qualitySummary, {}),
    benchmarkSummary: cloneValue(derived.benchmarkSummary, {}),
    statusText: String(derived.statusText || "").trim(),
    qualityText: String(derived.qualityText || "").trim(),
    benchmarkText: String(derived.benchmarkText || "").trim(),
    mappingText: String(derived.mappingText || "").trim(),
    candidateReconciliationText: String(derived.candidateReconciliationText || "").trim(),
    geographyReconciliationText: String(derived.geographyReconciliationText || "").trim(),
    downstreamStatusText: String(derived.downstreamStatusText || "").trim(),
    normalizedPreviewRows: cloneValue(derived.normalizedPreviewRows, []),
  };
}

export function readTurnoutSnapshot() {
  const bridgeSummary = readTurnoutBridgeSummary();
  return {
    turnoutSummary: String(bridgeSummary?.turnoutSummary || "").trim() || "—",
    turnoutVotes: String(bridgeSummary?.turnoutVotes || "").trim() || "—",
    needVotes: String(bridgeSummary?.needVotes || "").trim() || "—",
  };
}

function readTurnoutBridgeSummary() {
  try {
    const api = window[TURNOUT_API_KEY];
    if (!api || typeof api.getView !== "function") {
      return null;
    }
    const view = api.getView();
    const summary = view?.summary;
    if (!summary || typeof summary !== "object") {
      return null;
    }
    return {
      turnoutSummary: String(summary.turnoutSummaryText || "").trim(),
      turnoutVotes: String(summary.turnoutVotesText || "").trim(),
      needVotes: String(summary.needVotesText || "").trim(),
    };
  } catch {
    return null;
  }
}
