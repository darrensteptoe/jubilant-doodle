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

export function readDistrictSnapshot() {
  const universeRaw = readFirstNumber(["#v3DistrictUniverseSize", "#universeSize"]);
  const baselineSupport = firstNonMissing(["#v3DistrictSupportTotal", "#supportTotal"]);
  const turnoutExpected = readExpectedTurnoutPct();
  const projectedVotes = firstNonEmpty(["#kpiYourVotes-sidebar"]);
  const persuasionNeed = firstNonEmpty(["#kpiPersuasionNeed-sidebar"]);

  return {
    universe: formatInteger(universeRaw),
    baselineSupport: baselineSupport || "-",
    turnoutExpected: turnoutExpected || "-",
    projectedVotes: projectedVotes || "-",
    persuasionNeed: persuasionNeed || "-"
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
