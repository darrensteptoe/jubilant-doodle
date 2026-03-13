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

export function readDistrictSnapshot() {
  const universeRaw = parseNumber(readText("#universeSize"));
  const baselineSupport = readText("#supportTotal");
  const turnoutExpected = firstNonEmpty(["#turnoutExpected", "#kpiTurnoutVotes-sidebar"]);
  const projectedVotes = firstNonEmpty(["#kpiYourVotes-sidebar", "#kpiYourVotes"]);
  const persuasionNeed = firstNonEmpty(["#kpiPersuasionNeed-sidebar", "#kpiPersuasionNeed"]);

  return {
    universe: formatInteger(universeRaw),
    baselineSupport: baselineSupport || "-",
    turnoutExpected: turnoutExpected || "-",
    projectedVotes: projectedVotes || "-",
    persuasionNeed: persuasionNeed || "-"
  };
}

export function readTurnoutSnapshot() {
  return {
    turnoutSummary: firstNonEmpty(["#kpiTurnoutBand-sidebar", "#turnoutSummary"]),
    turnoutVotes: firstNonEmpty(["#kpiTurnoutVotes-sidebar", "#kpiTurnoutVotes"]),
    needVotes: firstNonEmpty(["#kpiPersuasionNeed-sidebar", "#kpiPersuasionNeed"])
  };
}
