// @ts-check

export const SCENARIO_STATUS_UNAVAILABLE = "Unavailable";
export const SCENARIO_STATUS_AWAITING_SCENARIO = "Awaiting scenario";

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveScenarioWorkspaceCardStatus(view){
  const scenarios = Array.isArray(view?.scenarios) ? view.scenarios : [];
  const activeId = String(view?.activeScenarioId || view?.baselineId || "");
  const baselineId = String(view?.baselineId || "baseline");
  if (!scenarios.length){
    return SCENARIO_STATUS_UNAVAILABLE;
  }
  if (activeId && activeId !== baselineId){
    return "Scenario active";
  }
  return "Baseline ready";
}

/**
 * @param {Record<string, any> | null | undefined} comparison
 * @returns {string}
 */
export function deriveScenarioCompareCardStatus(comparison){
  const count = Number(comparison?.outputDiffCount || 0);
  if (!comparison || comparison.modeText === "Select a non-baseline active scenario to view differences."){
    return "No compare";
  }
  if (count > 0){
    return "Diffs ready";
  }
  return "Compared";
}

/**
 * @param {string} warning
 * @param {string} storage
 * @returns {string}
 */
export function deriveScenarioNotesCardStatus(warning, storage){
  const warningText = String(warning || "").toLowerCase();
  const storageText = String(storage || "").toLowerCase();
  if (warningText.includes("unavailable") || storageText.includes("unavailable")){
    return SCENARIO_STATUS_UNAVAILABLE;
  }
  if (!warningText || warningText === "no warnings."){
    return "Storage ready";
  }
  if (warningText.includes("warning") || warningText.includes("diff") || warningText.includes("delete")){
    return "Watchlist";
  }
  return "Storage ready";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @param {Record<string, any> | null | undefined} comparison
 * @returns {string}
 */
export function deriveScenarioSummaryCardStatus(view, comparison){
  const activeId = String(view?.activeScenarioId || view?.baselineId || "");
  const baselineId = String(view?.baselineId || "baseline");
  if (!view){
    return SCENARIO_STATUS_UNAVAILABLE;
  }
  if (activeId && activeId !== baselineId){
    return Number(comparison?.inputDiffCount || 0) > 0 ? "Delta tracked" : "Scenario active";
  }
  return "Baseline";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyScenarioStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(baseline ready|storage ready|compared|baseline)/.test(lower)){
    return "ok";
  }
  if (/(unavailable)/.test(lower)){
    return "bad";
  }
  if (/(scenario active|diffs ready|watchlist|delta tracked|no compare|awaiting)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
