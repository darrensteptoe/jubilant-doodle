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
  try {
    const api = window[DISTRICT_API_KEY];
    if (!api || typeof api.getView !== "function") {
      return null;
    }
    const view = api.getView();
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
