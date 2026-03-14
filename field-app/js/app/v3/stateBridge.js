const DISTRICT_API_KEY = "__FPE_DISTRICT_API__";
const TURNOUT_API_KEY = "__FPE_TURNOUT_API__";

function readFromElement(el) {
  if (!el) {
    return "";
  }

  if ("value" in el && typeof el.value === "string") {
    return el.value.trim();
  }

  return (el.textContent || "").trim();
}

export function readText(selector) {
  return readFromElement(document.querySelector(selector));
}

export function firstNonEmpty(selectors = []) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of list) {
    const value = readText(selector);
    if (value) {
      return value;
    }
  }
  return "";
}

export function readNumber(selector) {
  return parseNumber(readText(selector));
}

export function isMissingValue(value) {
  const normalized = String(value == null ? "" : value).trim();
  return !normalized || normalized === "-" || normalized === "—";
}

export function readFirstNumber(selectors = []) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of list) {
    const value = readNumber(selector);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return NaN;
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

export function parseNumber(value) {
  const numeric = String(value || "").replace(/[^\d.-]/g, "");
  const num = Number(numeric);
  return Number.isFinite(num) ? num : NaN;
}

export function formatInteger(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return Math.round(value).toLocaleString();
}

function readExpectedTurnoutPct() {
  const direct = firstNonMissing(["#v3DistrictTurnoutExpected", "#turnoutExpected"]);
  if (!isMissingValue(direct)) {
    return direct;
  }

  const turnoutA = readFirstNumber(["#v3DistrictTurnoutA", "#turnoutA"]);
  const turnoutB = readFirstNumber(["#v3DistrictTurnoutB", "#turnoutB"]);
  if (Number.isFinite(turnoutA) && Number.isFinite(turnoutB)) {
    return `${((turnoutA + turnoutB) / 2).toFixed(1)}%`;
  }
  return "";
}

function readDistrictBridgeSummary() {
  const view = readDistrictBridgeView();
  const summary = view?.summary;
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

function readDistrictBridgeView() {
  try {
    const api = window[DISTRICT_API_KEY];
    if (!api || typeof api.getView !== "function") {
      return null;
    }
    const view = api.getView();
    return view && typeof view === "object" ? view : null;
  } catch {
    return null;
  }
}

export function readDistrictSnapshot() {
  const bridgeSummary = readDistrictBridgeSummary();
  const universeRaw = readFirstNumber(["#v3DistrictUniverseSize", "#universeSize"]);
  const baselineSupportFallback = firstNonMissing(["#v3DistrictSupportTotal", "#supportTotal"]);
  const turnoutExpectedFallback = readExpectedTurnoutPct();
  const turnoutBandFallback = firstNonMissing(["#v3DistrictTurnoutBand", "#turnoutBand"]);
  const votesPer1pctFallback = firstNonMissing(["#v3DistrictVotesPer1pct", "#votesPer1pct"]);
  const projectedVotesFallback = firstNonEmpty(["#kpiYourVotes-sidebar"]);
  const persuasionNeedFallback = firstNonEmpty(["#kpiPersuasionNeed-sidebar"]);

  return {
    universe: !isMissingValue(bridgeSummary?.universe) ? bridgeSummary.universe : formatInteger(universeRaw),
    baselineSupport: !isMissingValue(bridgeSummary?.baselineSupport) ? bridgeSummary.baselineSupport : (baselineSupportFallback || "-"),
    turnoutExpected: !isMissingValue(bridgeSummary?.turnoutExpected) ? bridgeSummary.turnoutExpected : (turnoutExpectedFallback || "-"),
    turnoutBand: !isMissingValue(bridgeSummary?.turnoutBand) ? bridgeSummary.turnoutBand : (turnoutBandFallback || "-"),
    votesPer1pct: !isMissingValue(bridgeSummary?.votesPer1pct) ? bridgeSummary.votesPer1pct : (votesPer1pctFallback || "-"),
    projectedVotes: !isMissingValue(bridgeSummary?.projectedVotes) ? bridgeSummary.projectedVotes : (projectedVotesFallback || "-"),
    persuasionNeed: !isMissingValue(bridgeSummary?.persuasionNeed) ? bridgeSummary.persuasionNeed : (persuasionNeedFallback || "-")
  };
}

export function readDistrictTargetingSnapshot() {
  const view = readDistrictBridgeView();
  const targeting = view?.targeting;
  if (!targeting || typeof targeting !== "object") {
    return null;
  }
  const config = targeting.config && typeof targeting.config === "object" ? targeting.config : {};

  const rowsRaw = Array.isArray(targeting.rows) ? targeting.rows : [];
  const rows = rowsRaw.map((row) => ({
    rank: String(row?.rankText || "").trim(),
    geography: String(row?.geoText || "").trim(),
    score: String(row?.scoreText || "").trim(),
    votesPerHour: String(row?.votesPerHourText || "").trim(),
    reason: String(row?.reasonText || "").trim(),
    flags: String(row?.flagsText || "").trim(),
  })).filter((row) => row.rank || row.geography || row.score || row.votesPerHour || row.reason || row.flags);

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
    },
  };
}

export function readDistrictCensusSnapshot() {
  const view = readDistrictBridgeView();
  const census = view?.census;
  if (!census || typeof census !== "object") {
    return null;
  }

  const normalizeRows = (rows, expectedCols) => {
    const list = Array.isArray(rows) ? rows : [];
    return list
      .map((row) => {
        const cells = Array.isArray(row) ? row : [];
        const normalized = cells.map((cell) => String(cell == null ? "" : cell).trim());
        while (normalized.length < expectedCols) normalized.push("");
        return normalized.slice(0, expectedCols);
      })
      .filter((cells) => cells.some((cell) => cell));
  };

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
    aggregateRows: normalizeRows(census.aggregateRows, 2),
    advisoryRows: normalizeRows(census.advisoryRows, 2),
    electionPreviewRows: normalizeRows(census.electionPreviewRows, 4),
  };
}

export function readTurnoutSnapshot() {
  const bridgeSummary = readTurnoutBridgeSummary();
  return {
    turnoutSummary: bridgeSummary?.turnoutSummary || firstNonEmpty(["#kpiTurnoutBand-sidebar"]),
    turnoutVotes: bridgeSummary?.turnoutVotes || firstNonEmpty(["#kpiTurnoutVotes-sidebar"]),
    needVotes: bridgeSummary?.needVotes || firstNonEmpty(["#kpiPersuasionNeed-sidebar"])
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
