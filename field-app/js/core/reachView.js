// @ts-check

export const REACH_STATUS_AWAITING_INPUTS = "Awaiting inputs";
export const REACH_STATUS_UNAVAILABLE = "Unavailable";
export const REACH_REALITY_NOTE_FALLBACK =
  "Reality check uses your daily log to estimate actual rates/capacity over the last 7 entries.";

/**
 * @param {Record<string, any> | null | undefined} weekly
 * @returns {string}
 */
export function deriveReachWeeklyCardStatus(weekly){
  const pace = String(weekly?.paceStatus || "").trim();
  if (!pace || pace === "—" || /needs inputs/i.test(pace)){
    return REACH_STATUS_AWAITING_INPUTS;
  }
  if (/behind/i.test(pace)){
    return "Gap open";
  }
  if (/pace|feasible/i.test(pace)){
    return "Feasible";
  }
  return pace;
}

/**
 * @param {Record<string, any> | null | undefined} levers
 * @param {Record<string, any> | null | undefined} weekly
 * @returns {string}
 */
export function deriveReachLeversCardStatus(levers, weekly){
  const hasLevers = Array.isArray(levers?.rows) && levers.rows.length > 0;
  if (!hasLevers){
    return REACH_STATUS_AWAITING_INPUTS;
  }
  const pace = String(weekly?.paceStatus || "").trim();
  if (/behind/i.test(pace)){
    return "Gap focus";
  }
  if (/pace|feasible/i.test(pace)){
    return "Buffer mode";
  }
  return "Active";
}

/**
 * @param {Record<string, any> | null | undefined} actions
 * @returns {string}
 */
export function deriveReachActionsCardStatus(actions){
  const note = String(actions?.note || "").trim();
  const list = Array.isArray(actions?.list) ? actions.list : [];
  if (!list.length){
    return REACH_STATUS_AWAITING_INPUTS;
  }
  if (/drift-aware/i.test(note)){
    return "Drift-aware";
  }
  if (/model-based/i.test(note)){
    return "Model-based";
  }
  return "Active";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyReachStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (
    /(on pace|feasible|buffer mode|ready|healthy|stable|complete|active|model-based)/.test(lower)
  ){
    return "ok";
  }
  if (/(behind|gap open|unavailable|missing|incomplete|failed|broken)/.test(lower)){
    return "bad";
  }
  if (/(awaiting|drift|needs|warning|risk|pending|override|gap focus)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
