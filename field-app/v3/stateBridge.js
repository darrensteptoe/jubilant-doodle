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
  for (const selector of selectors) {
    const value = readText(selector);
    if (value) {
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
    turnoutSummary: firstNonEmpty(["#turnoutSummary", "#kpiTurnoutBand-sidebar"]),
    turnoutVotes: firstNonEmpty(["#kpiTurnoutVotes-sidebar", "#kpiTurnoutVotes"]),
    needVotes: firstNonEmpty(["#kpiPersuasionNeed-sidebar", "#kpiPersuasionNeed"])
  };
}
