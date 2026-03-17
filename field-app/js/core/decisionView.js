// @ts-check

export const DECISION_STATUS_UNAVAILABLE = "Unavailable";
export const DECISION_STATUS_AWAITING_DECISION = "Awaiting decision";

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionSessionCardStatus(view){
  if (!view || !view.session){
    return "Awaiting session";
  }
  const scenarioLabel = String(view.session?.scenarioLabel || "").trim();
  if (scenarioLabel && scenarioLabel !== "—"){
    return "Session linked";
  }
  return "Session active";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionDetailCardStatus(view){
  if (!view || !view.session){
    return "Awaiting detail";
  }
  const budget = String(view.session?.constraints?.budget || "").trim();
  const volunteerHrs = String(view.session?.constraints?.volunteerHrs || "").trim();
  const nonNegotiables = String(view.session?.nonNegotiablesText || "").trim();
  if (budget || volunteerHrs || nonNegotiables){
    return "Constraints set";
  }
  return "Awaiting detail";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionOptionsCardStatus(view){
  if (!view || !view.session){
    return "Awaiting option";
  }
  const options = Array.isArray(view.options) ? view.options : [];
  if (!options.length){
    return "Awaiting option";
  }
  const scenarioLabel = String(view.activeOption?.scenarioLabel || "").trim();
  if (scenarioLabel && scenarioLabel !== "—"){
    return "Option linked";
  }
  return "Options ready";
}

/**
 * @param {Record<string, any> | null | undefined} drift
 * @param {Record<string, any> | null | undefined} risk
 * @param {Record<string, any> | null | undefined} bneck
 * @param {Record<string, any> | null | undefined} sens
 * @param {Record<string, any> | null | undefined} conf
 * @returns {string}
 */
export function deriveDecisionDiagnosticsCardStatus(drift, risk, bneck, sens, conf){
  const combined = [
    drift?.banner,
    risk?.banner,
    bneck?.warn,
    sens?.banner,
    conf?.banner
  ].join(" ").toLowerCase();
  if (combined.includes("unavailable")){
    return DECISION_STATUS_UNAVAILABLE;
  }
  if (combined.includes("run snapshot")){
    return "Run snapshot";
  }
  if (combined.includes("risk") || combined.includes("drift") || combined.includes("constraint")){
    return "Watch diagnostics";
  }
  if (combined.replace(/—/g, "").trim()){
    return "Diagnostics ready";
  }
  return "Awaiting diagnostics";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionActionCardStatus(view){
  if (!view || !view.session){
    return "Awaiting recommendation";
  }
  const recommended = String(view.summary?.recommendedOptionLabel || "").trim();
  const copyStatus = String(view.copyStatus || "").toLowerCase();
  if (copyStatus.includes("copied") || copyStatus.includes("download")){
    return "Export ready";
  }
  if (recommended && recommended !== "—"){
    return "Recommendation set";
  }
  return "Awaiting recommendation";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @param {Record<string, any> | null | undefined} conf
 * @param {Record<string, any> | null | undefined} risk
 * @param {Record<string, any> | null | undefined} bneck
 * @returns {string}
 */
export function deriveDecisionSummaryCardStatus(view, conf, risk, bneck){
  if (!view || !view.session){
    return "Awaiting session";
  }
  const confidence = String(conf?.tag || view.summary?.confidenceTag || "").trim();
  const riskTag = String(risk?.tag || view.summary?.riskTag || "").trim();
  const bottleneck = String(bneck?.tag || view.summary?.bottleneckTag || "").trim();
  if (confidence && confidence !== "—"){
    return confidence;
  }
  if (riskTag && riskTag !== "—"){
    return riskTag;
  }
  if (bottleneck && bottleneck !== "—"){
    return bottleneck;
  }
  return "Decision active";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyDecisionStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(session linked|constraints set|option linked|options ready|diagnostics ready|recommendation set|export ready|steady|high confidence|decision active)/.test(lower)){
    return "ok";
  }
  if (/(unavailable)/.test(lower)){
    return "bad";
  }
  if (/(awaiting|watch diagnostics|run snapshot|session active|fragile|risk|constraint|warning|competitive|at risk)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
