// @ts-check

export const PLAN_WORKLOAD_STATUS_FALLBACK = "Set support goal and pacing assumptions to generate workload requirements.";
export const PLAN_OPTIMIZER_STATUS_FALLBACK = "Run optimization to generate allocation and binding-constraint posture.";
export const PLAN_TIMELINE_STATUS_FALLBACK = "Timeline diagnostics update as staffing and pace assumptions change.";
export const PLAN_WEEK_PREVIEW_FALLBACK = "Timeline preview available after optimization run.";

/**
 * @param {unknown} rawValue
 * @returns {number}
 */
function parsePlanNumber(rawValue){
  const text = String(rawValue || "").trim();
  if (!text || text === "-" || text === "—"){
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * @param {unknown} rawValue
 * @returns {number}
 */
function parsePlanPercent(rawValue){
  return parsePlanNumber(rawValue);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatPlanWhole(value){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return "—";
  }
  return `${Math.round(n).toLocaleString()}`;
}

/**
 * @param {unknown} shiftsPerWeek
 * @param {unknown} volunteersNeeded
 * @returns {string}
 */
export function buildPlanWorkloadBanner(shiftsPerWeek, volunteersNeeded){
  if (!shiftsPerWeek && !volunteersNeeded){
    return PLAN_WORKLOAD_STATUS_FALLBACK;
  }
  return `Workload target: ${shiftsPerWeek || "—"} shifts/week and ${volunteersNeeded || "—"} volunteers needed.`;
}

/**
 * @param {unknown} optBinding
 * @param {unknown} optGapContext
 * @returns {string}
 */
export function buildPlanOptimizerBanner(optBinding, optGapContext){
  const binding = String(optBinding || "").trim();
  const gap = String(optGapContext || "").trim();
  if (!binding && !gap){
    return PLAN_OPTIMIZER_STATUS_FALLBACK;
  }
  if (binding && gap){
    return `${binding} is currently binding. ${gap}`;
  }
  return binding || gap;
}

/**
 * @param {unknown} executablePct
 * @param {unknown} constraint
 * @param {unknown} shortfallAttempts
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function buildPlanTimelineBanner(executablePct, constraint, shortfallAttempts, shortfallVotes){
  const pct = String(executablePct || "").trim();
  const binding = String(constraint || "").trim();
  const attempts = String(shortfallAttempts || "").trim();
  const votes = String(shortfallVotes || "").trim();

  if (!pct && !binding && !attempts && !votes){
    return PLAN_TIMELINE_STATUS_FALLBACK;
  }
  return `Executable: ${pct || "—"}; Constraint: ${binding || "—"}; Shortfall attempts: ${attempts || "—"}; Shortfall votes: ${votes || "—"}.`;
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @param {string} [objectiveLabel]
 * @returns {string}
 */
export function buildPlanDecisionWarning(constraint, shortfallVotes, objectiveLabel = "net votes"){
  const c = String(constraint || "").toLowerCase();
  const votesText = String(shortfallVotes || "").trim();
  const votesNum = Number(votesText.replace(/[^\d.-]/g, ""));
  const objectiveText = String(objectiveLabel || "net votes").toLowerCase();
  if (c && (c.includes("timeline") || c.includes("capacity") || c.includes("staff"))){
    return "Execution risk is elevated under current timeline/staffing assumptions.";
  }
  if (Number.isFinite(votesNum) && votesNum > 0){
    return `Remaining timeline shortfall detected: ${votesText} ${objectiveText}.`;
  }
  return "";
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallAttempts
 * @returns {string}
 */
export function buildPlanRecommendationVolunteers(constraint, shortfallAttempts){
  const c = String(constraint || "").toLowerCase();
  if (c.includes("staff") || c.includes("capacity")){
    return "Increase organizer or volunteer weekly hours to close the capacity bottleneck.";
  }
  if (String(shortfallAttempts || "").trim()){
    return "Reduce attempts shortfall by increasing weekly shift coverage or narrowing target scope.";
  }
  return "Volunteer load is currently within modeled bounds.";
}

/**
 * @param {unknown} optBinding
 * @param {string} [objectiveLabel]
 * @returns {string}
 */
export function buildPlanRecommendationCost(optBinding, objectiveLabel = "net votes"){
  const binding = String(optBinding || "").toLowerCase();
  const objectiveText = String(objectiveLabel || "net votes").toLowerCase();
  if (binding.includes("budget") || binding.includes("cost")){
    return "Reallocate toward lower-cost channels before adding new spend.";
  }
  return `Keep budget allocation aligned to channels with highest marginal ${objectiveText}.`;
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function buildPlanRecommendationProbability(constraint, shortfallVotes){
  const c = String(constraint || "").toLowerCase();
  const votesNum = Number(String(shortfallVotes || "").replace(/[^\d.-]/g, ""));
  if (c.includes("timeline") || c.includes("week")){
    return "Improve probability posture by de-risking timeline: pull effort earlier in the schedule.";
  }
  if (Number.isFinite(votesNum) && votesNum > 0){
    return "Close remaining vote shortfall to improve modeled win confidence.";
  }
  return "Probability posture is stable under current assumptions.";
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallAttempts
 * @returns {string[][]}
 */
export function buildPlanVolunteerLevers(constraint, shortfallAttempts){
  const c = String(constraint || "").toLowerCase();
  const attempts = parsePlanNumber(shortfallAttempts);
  if (Number.isFinite(attempts) && attempts > 0){
    return [
      ["Add organizer shift coverage", `+${formatPlanWhole(Math.ceil(attempts / 250))}`],
      ["Increase volunteer hours / week", `+${formatPlanWhole(Math.ceil(attempts / 400))}`]
    ];
  }
  if (c.includes("staff") || c.includes("capacity")){
    return [["Increase active volunteer pool", "Priority"]];
  }
  return [["Volunteer load within range", "—"]];
}

/**
 * @param {unknown} optBinding
 * @param {unknown} shortfallAttempts
 * @returns {string[][]}
 */
export function buildPlanCostLevers(optBinding, shortfallAttempts){
  const binding = String(optBinding || "").toLowerCase();
  const attempts = parsePlanNumber(shortfallAttempts);
  if (binding.includes("budget") || binding.includes("cost")){
    return [
      ["Shift effort to lower-cost channels", "High"],
      ["Reduce low-yield tactic share", "Medium"]
    ];
  }
  if (Number.isFinite(attempts) && attempts > 0){
    return [["Phase spend earlier in cycle", "Medium"]];
  }
  return [["Cost posture stable", "—"]];
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @returns {string[][]}
 */
export function buildPlanProbabilityLevers(constraint, shortfallVotes){
  const c = String(constraint || "").toLowerCase();
  const votes = parsePlanNumber(shortfallVotes);
  if (Number.isFinite(votes) && votes > 0){
    return [
      ["Close remaining net-vote gap", `${formatPlanWhole(votes)}`],
      ["Advance execution to earlier weeks", "Medium"]
    ];
  }
  if (c.includes("timeline") || c.includes("week")){
    return [["De-risk timeline concentration", "High"]];
  }
  return [["Probability posture stable", "—"]];
}

/**
 * @param {unknown} workloadBanner
 * @returns {string}
 */
export function derivePlanWorkloadCardStatus(workloadBanner){
  const text = String(workloadBanner || "").trim().toLowerCase();
  if (!text || text.includes("set support goal")){
    return "Awaiting setup";
  }
  return "Current";
}

/**
 * @param {{ attempts?: unknown } | null | undefined} optTotals
 * @param {unknown} optimizerBanner
 * @param {unknown} optBinding
 * @returns {string}
 */
export function derivePlanOptimizerCardStatus(optTotals, optimizerBanner, optBinding){
  const attempts = parsePlanNumber(optTotals?.attempts);
  const banner = String(optimizerBanner || "").trim().toLowerCase();
  const binding = String(optBinding || "").trim().toLowerCase();
  if (!Number.isFinite(attempts) || attempts <= 0){
    return "Awaiting run";
  }
  if (binding.includes("budget") || binding.includes("capacity") || banner.includes("binding")){
    return "Binding";
  }
  return "Allocated";
}

/**
 * @param {Record<string, any> | null | undefined} planView
 * @param {unknown} executablePct
 * @param {unknown} constraint
 * @returns {string}
 */
export function derivePlanTimelineCardStatus(planView, executablePct, constraint){
  const enabled = !!planView?.inputs?.timelineEnabled;
  const pct = parsePlanPercent(executablePct);
  const binding = String(constraint || "").trim().toLowerCase();
  if (!enabled){
    return "Module off";
  }
  if (!Number.isFinite(pct)){
    return "Awaiting setup";
  }
  if (pct >= 100 && (binding.includes("no timeline constraint") || binding.includes("no constraint"))){
    return "Feasible";
  }
  if (pct >= 100){
    return "Tight";
  }
  return "Constrained";
}

/**
 * @param {unknown} executablePct
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function derivePlanRiskCardStatus(executablePct, constraint, shortfallVotes){
  const pct = parsePlanPercent(executablePct);
  const binding = String(constraint || "").trim().toLowerCase();
  const gap = parsePlanNumber(shortfallVotes);
  if (!Number.isFinite(pct) && !binding){
    return "Awaiting setup";
  }
  if ((Number.isFinite(pct) && pct < 100) || (Number.isFinite(gap) && gap > 0)){
    return "Elevated";
  }
  if (binding.includes("staff") || binding.includes("capacity") || binding.includes("timeline")){
    return "Watch";
  }
  return "Contained";
}

/**
 * @param {unknown} tlConstraint
 * @param {unknown} optBinding
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function derivePlanActionsCardStatus(tlConstraint, optBinding, shortfallVotes){
  const constraint = String(tlConstraint || "").trim().toLowerCase();
  const binding = String(optBinding || "").trim().toLowerCase();
  const gap = parsePlanNumber(shortfallVotes);
  if (!constraint && !binding && !Number.isFinite(gap)){
    return "Guidance pending";
  }
  if (Number.isFinite(gap) && gap > 0){
    return "Recovery plan";
  }
  if (constraint || binding){
    return "Guidance ready";
  }
  return "Current";
}

/**
 * @param {unknown} executablePct
 * @param {unknown} tlConstraint
 * @param {unknown} optBinding
 * @returns {string}
 */
export function derivePlanSummaryCardStatus(executablePct, tlConstraint, optBinding){
  const pct = parsePlanPercent(executablePct);
  const constraint = String(tlConstraint || "").trim().toLowerCase();
  const binding = String(optBinding || "").trim().toLowerCase();
  if (!Number.isFinite(pct)){
    return "Awaiting setup";
  }
  if (pct >= 100 && (constraint.includes("no timeline constraint") || binding.includes("no binding"))){
    return "Feasible";
  }
  if (pct >= 100){
    return "Tight";
  }
  return "Constrained";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyPlanStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(current|allocated|feasible|contained|guidance ready)/.test(lower)){
    return "ok";
  }
  if (/(elevated|constrained|binding|recovery plan|unavailable|failed|broken)/.test(lower)){
    return "bad";
  }
  if (/(awaiting|module off|tight|watch|pending)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
