// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim();
}

function toObject(value){
  return value && typeof value === "object" ? value : {};
}

function toList(value){
  return Array.isArray(value) ? value.map((row) => clean(row)).filter(Boolean) : [];
}

function valueText(value, fallback = "—"){
  const text = clean(value);
  return text || fallback;
}

function numberText(value, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return String(n);
}

function gapLooksPositive(text){
  const raw = clean(text);
  if (!raw) return false;
  if (raw.startsWith("+")) return true;
  const numeric = Number(raw.replace(/[,%$\s]/g, ""));
  return Number.isFinite(numeric) && numeric > 0;
}

const TRUST_STATE = Object.freeze({
  READY: "ready",
  REVIEW: "review",
  MISSING: "missing",
  FALLBACK: "fallback",
  MISMATCH: "mismatch",
});

export const DTL_GLOBAL_MICROCOPY = Object.freeze({
  showYourWork: "See what this figure is based on, which assumptions are in play, and how the displayed value was produced.",
  whatDrives: "These are the main inputs, filters, and assumptions currently shaping this result.",
  assumptionsInPlay: "This figure depends on the current operating assumptions, selected context, and any active defaults or fallbacks.",
  whyChanged: "This result changed because one or more upstream inputs, filters, or scenario settings changed.",
  reviewBeforeActing: "Use this figure as a decision aid. Review assumptions first if this number will drive staffing, targeting, pacing, or budget choices.",
  displayedValue: "Displayed values are rounded for readability. Canonical results remain preserved upstream.",
  states: Object.freeze({
    ready: "This figure is using the expected context and current assumptions.",
    review: "This figure is usable, but one or more assumptions materially shape the result. Review them before acting.",
    missing: "This figure cannot be relied on until required campaign, office, district, or session context is selected.",
    fallback: "This figure is currently relying on fallback or default assumptions. Review before using it for a decision.",
    mismatch: "This result reflects current filters, which may not match intended analysis context.",
  }),
});

const TRUST_TIER_MAP = Object.freeze({
  tier1: Object.freeze([
    { id: "targetUniverse", title: "Universe Size / Target Universe" },
    { id: "expectedSupport", title: "Expected Support" },
    { id: "turnoutProjection", title: "Turnout Projection / Expected Vote Yield" },
    { id: "reachCapacity", title: "Coverage Capacity / Reach Capacity" },
    { id: "gapToGoal", title: "Gap to Goal" },
    { id: "staffingNeed", title: "Staffing Need / Required Organizers" },
    { id: "budgetRequirement", title: "Cost / Budget Requirement" },
    { id: "planFragility", title: "Risk / Plan Fragility" },
  ]),
  tier2: Object.freeze([
    { id: "productivityRate", title: "Productivity Rate" },
    { id: "contactRate", title: "Contact Rate" },
    { id: "completionRate", title: "Completion Rate" },
    { id: "timelineSufficiency", title: "Timeline Sufficiency" },
  ]),
  tier3: Object.freeze([
    { id: "persuasionLift", title: "Persuasion Lift" },
    { id: "turnoutLift", title: "Turnout Lift" },
  ]),
});

const FIGURES = Object.freeze({
  targetUniverse: Object.freeze({
    id: "targetUniverse",
    tier: "tier1",
    title: "Universe Size / Target Universe",
    stageIds: Object.freeze(["district"]),
    requiredContext: Object.freeze(["campaignId", "officeId"]),
    shortDefinition: "The number of records currently included in the active target universe.",
    whatItMeans: "This is the planning base population after active filters, eligibility rules, and targeting logic.",
    whatDrives: "District/geography, targeting model, filter set, and scenario/session context.",
    howToUse: "Validate this before staffing, coverage, persuasion, or turnout decisions.",
    canonicalPath: "__FPE_DISTRICT_API__.getView().form.universeSize",
    displaySurfaces: Object.freeze(["District -> District summary", "District -> Target config"]),
    reportSurfaces: Object.freeze(["internalFull:SITUATION SNAPSHOT", "clientStandard:WHAT MATTERS NOW"]),
    reportParityMappings: Object.freeze([]),
    resolveValue: ({ stageViews }) => {
      const district = toObject(stageViews?.district);
      const raw = district?.form?.universeSize;
      const summary = clean(district?.summary?.universeText);
      return summary || numberText(raw, "—");
    },
    resolveAssumptions: ({ stageViews }) => {
      const district = toObject(stageViews?.district);
      return [
        `Universe basis: ${valueText(district?.form?.universeBasis)}`,
        `Turnout A/B: ${valueText(district?.form?.turnoutA)}/${valueText(district?.form?.turnoutB)}`,
        `Band width: ${valueText(district?.form?.bandWidth)}`,
      ];
    },
    resolveFallback: ({ stageViews }) => {
      const district = toObject(stageViews?.district);
      const basis = clean(district?.form?.universeBasis).toLowerCase();
      return basis.includes("default") || basis.includes("fallback");
    },
    resolveReview: ({ value }) => value === "—",
    changeReasons: Object.freeze([
      "District/geography changed",
      "Target model/filter changed",
      "Scenario/session changed",
      "Eligibility/exclusion changed",
    ]),
    roundingNote: "Displayed values are rounded for readability.",
  }),
  expectedSupport: Object.freeze({
    id: "expectedSupport",
    tier: "tier1",
    title: "Expected Support",
    stageIds: Object.freeze(["district"]),
    requiredContext: Object.freeze(["campaignId", "officeId"]),
    shortDefinition: "Estimated support in the active universe under current assumptions.",
    whatItMeans: "A modeled estimate, not guaranteed votes cast.",
    whatDrives: "Active universe, support assumptions/scoring, scenario context, and relevant thresholds.",
    howToUse: "Compare with turnout and coverage before acting.",
    canonicalPath: "__FPE_DISTRICT_API__.getView().summary.baselineSupportText",
    displaySurfaces: Object.freeze(["District -> District summary", "District -> Ballot"]),
    reportSurfaces: Object.freeze(["internalFull:SITUATION SNAPSHOT", "clientStandard:WHAT MATTERS NOW"]),
    reportParityMappings: Object.freeze([
      Object.freeze({ reportType: "internal_full", sectionId: "situation_snapshot", metricLabel: "Baseline support" }),
      Object.freeze({ reportType: "client_standard", sectionId: "what_matters_now", metricLabel: "Baseline support" }),
    ]),
    resolveValue: ({ stageViews }) => {
      const district = toObject(stageViews?.district);
      return valueText(district?.summary?.baselineSupportText);
    },
    resolveAssumptions: ({ stageViews }) => {
      const district = toObject(stageViews?.district);
      return [
        `Undecided mode: ${valueText(district?.ballot?.undecidedMode)}`,
        `Undecided share: ${valueText(district?.ballot?.undecidedPct)}`,
        `Your candidate: ${valueText(district?.ballot?.yourCandidateId)}`,
      ];
    },
    resolveFallback: () => false,
    resolveReview: ({ value }) => value === "—",
    changeReasons: Object.freeze([
      "Support assumptions changed",
      "Universe changed",
      "Model/threshold changed",
      "Scenario/session changed",
    ]),
    roundingNote: "Displayed value rounded; canonical value preserved.",
  }),
  turnoutProjection: Object.freeze({
    id: "turnoutProjection",
    tier: "tier1",
    title: "Turnout Projection / Expected Vote Yield",
    stageIds: Object.freeze(["turnout", "district"]),
    requiredContext: Object.freeze(["campaignId", "officeId", "scenarioId"]),
    shortDefinition: "Estimated turnout or vote yield under active assumptions.",
    whatItMeans: "Planning estimate, not guaranteed outcome.",
    whatDrives: "Turnout assumptions, active universe, scenario context, and election/district conditions.",
    howToUse: "Use for viability checks and scenario comparisons.",
    canonicalPath: "__FPE_TURNOUT_API__.getView().summary.turnoutVotesText",
    displaySurfaces: Object.freeze(["Turnout -> Turnout summary", "District -> District summary"]),
    reportSurfaces: Object.freeze(["internalFull:SITUATION SNAPSHOT", "clientStandard:WHAT MATTERS NOW"]),
    reportParityMappings: Object.freeze([
      Object.freeze({ reportType: "internal_full", sectionId: "situation_snapshot", metricLabel: "Turnout expected" }),
      Object.freeze({ reportType: "client_standard", sectionId: "what_matters_now", metricLabel: "Turnout expected" }),
    ]),
    resolveValue: ({ stageViews, stageId }) => {
      const turnout = toObject(stageViews?.turnout);
      const district = toObject(stageViews?.district);
      if (clean(stageId) === "district"){
        return valueText(district?.summary?.turnoutExpectedText);
      }
      return valueText(turnout?.summary?.turnoutVotesText);
    },
    resolveAssumptions: ({ stageViews, stageId }) => {
      const turnout = toObject(stageViews?.turnout);
      const district = toObject(stageViews?.district);
      if (clean(stageId) === "district"){
        return [
          `Turnout expected: ${valueText(district?.summary?.turnoutExpectedText)}`,
          `Turnout band: ${valueText(district?.summary?.turnoutBandText)}`,
          `Votes per 1% turnout: ${valueText(district?.summary?.votesPer1pctText)}`,
        ];
      }
      return [
        `Baseline turnout: ${valueText(turnout?.inputs?.turnoutBaselinePct)}`,
        `Target override: ${valueText(turnout?.inputs?.turnoutTargetOverridePct)}`,
        `GOTV mode: ${valueText(turnout?.inputs?.gotvMode)}`,
      ];
    },
    resolveFallback: ({ stageViews, stageId }) => {
      if (clean(stageId) === "district") return false;
      const turnout = toObject(stageViews?.turnout);
      return clean(turnout?.summary?.turnoutSummaryText).toLowerCase().includes("fallback");
    },
    resolveReview: ({ value }) => value === "—",
    changeReasons: Object.freeze([
      "Turnout assumptions changed",
      "Universe changed",
      "Election/district context changed",
      "Scenario/session changed",
    ]),
    roundingNote: "Displayed values are rounded.",
  }),
  reachCapacity: Object.freeze({
    id: "reachCapacity",
    tier: "tier1",
    title: "Coverage Capacity / Reach Capacity",
    stageIds: Object.freeze(["reach"]),
    requiredContext: Object.freeze(["campaignId", "officeId", "scenarioId"]),
    shortDefinition: "Estimated reachable volume under current plan.",
    whatItMeans: "Practical operational reach, not theoretical universe size.",
    whatDrives: "Staffing, productivity assumptions, timeline, and universe size.",
    howToUse: "Reality-check plan feasibility before commitment.",
    canonicalPath: "__FPE_REACH_API__.getView().summary.capacity",
    displaySurfaces: Object.freeze(["Reach -> Reach summary", "Reach -> Efficiency inputs"]),
    reportSurfaces: Object.freeze(["internalFull:RECOMMENDED ACTIONS", "weeklyActions:WORKPLAN"]),
    reportParityMappings: Object.freeze([]),
    resolveValue: ({ stageViews }) => {
      const reach = toObject(stageViews?.reach);
      return valueText(reach?.summary?.capacity);
    },
    resolveAssumptions: ({ stageViews }) => {
      const reach = toObject(stageViews?.reach);
      return [
        `Support rate: ${valueText(reach?.inputs?.supportRatePct)}`,
        `Contact rate: ${valueText(reach?.inputs?.contactRatePct)}`,
        `Hours per shift: ${valueText(reach?.inputs?.hoursPerShift)}`,
        `Shifts per volunteer/week: ${valueText(reach?.inputs?.shiftsPerVolunteerPerWeek)}`,
      ];
    },
    resolveFallback: ({ stageViews }) => {
      const reach = toObject(stageViews?.reach);
      return clean(reach?.outlook?.activeSource).toLowerCase().includes("fallback");
    },
    resolveReview: ({ value }) => value === "—",
    changeReasons: Object.freeze([
      "Staffing changed",
      "Timeline changed",
      "Productivity/reach assumptions changed",
      "Universe/district changed",
    ]),
    roundingNote: "Displayed values rounded for readability.",
  }),
  gapToGoal: Object.freeze({
    id: "gapToGoal",
    tier: "tier1",
    title: "Gap to Goal",
    stageIds: Object.freeze(["reach", "plan"]),
    requiredContext: Object.freeze(["campaignId", "officeId", "scenarioId"]),
    shortDefinition: "Difference between current projection and target.",
    whatItMeans: "Decision gap still needing closure.",
    whatDrives: "Goal target + projection + all projection assumptions.",
    howToUse: "Decide hold/adjust/escalate plan.",
    canonicalPath: "__FPE_REACH_API__.getView().summary.gap",
    displaySurfaces: Object.freeze(["Reach -> Reach summary", "Plan -> Summary"]),
    reportSurfaces: Object.freeze(["internalFull:RECOMMENDED ACTIONS", "warRoomBrief:IMMEDIATE DECISIONS"]),
    reportParityMappings: Object.freeze([]),
    resolveValue: ({ stageViews, stageId }) => {
      if (clean(stageId) === "plan"){
        const plan = toObject(stageViews?.plan);
        return valueText(plan?.summary?.timeline?.remainingGapValue);
      }
      const reach = toObject(stageViews?.reach);
      return valueText(reach?.summary?.gap);
    },
    resolveAssumptions: ({ stageViews, stageId }) => {
      if (clean(stageId) === "plan"){
        const plan = toObject(stageViews?.plan);
        return [
          `Timeline shortfall attempts: ${valueText(plan?.summary?.timeline?.shortfallAttempts)}`,
          `Timeline shortfall value: ${valueText(plan?.summary?.timeline?.shortfallValue)}`,
          `Binding constraint: ${valueText(plan?.summary?.timeline?.binding)}`,
        ];
      }
      const reach = toObject(stageViews?.reach);
      return [
        `Required attempts/week: ${valueText(reach?.weekly?.requiredAttempts)}`,
        `Capacity/week: ${valueText(reach?.weekly?.capacity)}`,
        `Constraint: ${valueText(reach?.weekly?.constraint)}`,
      ];
    },
    resolveFallback: () => false,
    resolveReview: ({ value }) => value === "—" || gapLooksPositive(value),
    changeReasons: Object.freeze([
      "Goal changed",
      "Projection changed",
      "Upstream assumptions changed",
      "Scenario changed",
    ]),
    roundingNote: "Displayed values are rounded.",
  }),
  staffingNeed: Object.freeze({
    id: "staffingNeed",
    tier: "tier1",
    title: "Staffing Need / Required Organizers",
    stageIds: Object.freeze(["plan"]),
    requiredContext: Object.freeze(["campaignId", "officeId", "scenarioId"]),
    shortDefinition: "Estimated staffing needed to execute current plan.",
    whatItMeans: "Converts plan scale into concrete capacity requirement.",
    whatDrives: "Task size, time available, and productivity/utilization assumptions.",
    howToUse: "Validate operational realism before committing.",
    canonicalPath: "__FPE_PLAN_API__.getView().summary.workload.volunteersNeeded",
    displaySurfaces: Object.freeze(["Plan -> Workload", "Plan -> Timeline"]),
    reportSurfaces: Object.freeze(["internalFull:RECOMMENDED ACTIONS", "weeklyActions:NEXT 7 DAYS"]),
    reportParityMappings: Object.freeze([]),
    resolveValue: ({ stageViews }) => {
      const plan = toObject(stageViews?.plan);
      return valueText(plan?.summary?.workload?.volunteersNeeded);
    },
    resolveAssumptions: ({ stageViews }) => {
      const plan = toObject(stageViews?.plan);
      return [
        `Timeline staff count: ${valueText(plan?.inputs?.timelineStaffCount)}`,
        `Timeline staff hours: ${valueText(plan?.inputs?.timelineStaffHours)}`,
        `Timeline volunteer count: ${valueText(plan?.inputs?.timelineVolCount)}`,
        `Timeline volunteer hours: ${valueText(plan?.inputs?.timelineVolHours)}`,
      ];
    },
    resolveFallback: () => false,
    resolveReview: ({ value }) => value === "—",
    changeReasons: Object.freeze([
      "Timeline changed",
      "Productivity changed",
      "Target universe/goal changed",
      "Operating assumptions changed",
    ]),
    roundingNote: "Rounded for readability.",
  }),
  budgetRequirement: Object.freeze({
    id: "budgetRequirement",
    tier: "tier1",
    title: "Cost / Budget Requirement",
    stageIds: Object.freeze(["plan"]),
    requiredContext: Object.freeze(["campaignId", "officeId", "scenarioId"]),
    shortDefinition: "Estimated resources required under current plan.",
    whatItMeans: "Financial feasibility estimate for current strategy.",
    whatDrives: "Staffing assumptions, timeline, plan scale, and cost inputs.",
    howToUse: "Compare against available resources and alternatives.",
    canonicalPath: "__FPE_PLAN_API__.getView().summary.optimizer.totalCost",
    displaySurfaces: Object.freeze(["Plan -> Optimizer", "Plan -> Costs"]),
    reportSurfaces: Object.freeze(["clientStandard:TOP RECOMMENDATIONS", "internalFull:RECOMMENDED ACTIONS"]),
    reportParityMappings: Object.freeze([]),
    resolveValue: ({ stageViews }) => {
      const plan = toObject(stageViews?.plan);
      return valueText(plan?.summary?.optimizer?.totalCost);
    },
    resolveAssumptions: ({ stageViews }) => {
      const plan = toObject(stageViews?.plan);
      return [
        `Optimization mode: ${valueText(plan?.inputs?.optMode)}`,
        `Optimization objective: ${valueText(plan?.inputs?.optObjective)}`,
        `Budget input: ${valueText(plan?.inputs?.optBudget)}`,
      ];
    },
    resolveFallback: () => false,
    resolveReview: ({ value }) => value === "—",
    changeReasons: Object.freeze([
      "Staffing changed",
      "Plan scale changed",
      "Timeline changed",
      "Cost inputs changed",
    ]),
    roundingNote: "Rounded display; canonical outputs preserved.",
  }),
  planFragility: Object.freeze({
    id: "planFragility",
    tier: "tier1",
    title: "Risk / Plan Fragility",
    stageIds: Object.freeze(["outcome", "decision-log", "war-room", "scenarios"]),
    requiredContext: Object.freeze(["campaignId", "officeId", "scenarioId"]),
    shortDefinition: "Indicates plan vulnerability to assumption failure.",
    whatItMeans: "Exposure signal, not panic signal.",
    whatDrives: "Gap-to-goal, sensitivity to assumptions, scenario conditions, and staffing/time tightness.",
    howToUse: "Pressure-test plan and identify fragility.",
    canonicalPath: "__FPE_OUTCOME_API__.getView().mc.fragilityIndex",
    displaySurfaces: Object.freeze(["Outcome -> Risk framing", "War Room -> Decision posture"]),
    reportSurfaces: Object.freeze(["warRoomBrief:24-72 HOUR RISK", "clientStandard:CONFIDENCE FRAME"]),
    reportParityMappings: Object.freeze([]),
    resolveValue: ({ stageViews }) => {
      const outcome = toObject(stageViews?.outcome);
      const value = outcome?.mc?.fragilityIndex;
      if (Number.isFinite(Number(value))){
        return String(value);
      }
      return valueText(outcome?.mc?.riskLabel);
    },
    resolveAssumptions: ({ stageViews }) => {
      const outcome = toObject(stageViews?.outcome);
      return [
        `MC mode: ${valueText(outcome?.inputs?.mcMode)}`,
        `MC volatility: ${valueText(outcome?.inputs?.mcVolatility)}`,
        `Turnout reliability: ${valueText(outcome?.inputs?.turnoutReliabilityPct)}`,
        `Staleness: ${valueText(outcome?.mc?.staleTag)}`,
      ];
    },
    resolveFallback: ({ stageViews }) => {
      const outcome = toObject(stageViews?.outcome);
      const fresh = clean(outcome?.mc?.freshTag).toLowerCase();
      return fresh.includes("pending") || clean(outcome?.mc?.staleTag).toLowerCase().includes("no run");
    },
    resolveReview: ({ stageViews, value }) => {
      const outcome = toObject(stageViews?.outcome);
      const stale = clean(outcome?.mc?.freshTag).toLowerCase().includes("stale");
      return value === "—" || stale;
    },
    changeReasons: Object.freeze([
      "Scenario changed",
      "Gap changed",
      "Staffing/timeline changed",
      "Critical assumptions changed",
    ]),
    roundingNote: "Rounded/simplified for readability where appropriate.",
  }),
});

function normalizeStageId(stageId){
  const raw = clean(stageId).toLowerCase();
  if (raw === "war-room") return "decision-log";
  return raw || "district";
}

function missingContextForFigure(entry, shellView){
  const shell = toObject(shellView);
  const contextMissing = toList(shell?.contextMissing).map((row) => row.toLowerCase());
  const required = toList(entry?.requiredContext);
  for (const key of required){
    const value = clean(shell?.[key]);
    if (!value || contextMissing.includes(String(key).toLowerCase())){
      return true;
    }
  }
  return false;
}

function resolveTrustState(entry, payload){
  if (missingContextForFigure(entry, payload.shellView)){
    return { code: TRUST_STATE.MISSING, label: "Missing required context", detail: DTL_GLOBAL_MICROCOPY.states.missing };
  }
  if (entry?.resolveFallback && entry.resolveFallback(payload)){
    return { code: TRUST_STATE.FALLBACK, label: "Fallback in use", detail: DTL_GLOBAL_MICROCOPY.states.fallback };
  }
  if (entry?.resolveReview && entry.resolveReview(payload)){
    return { code: TRUST_STATE.REVIEW, label: "Review assumptions", detail: DTL_GLOBAL_MICROCOPY.states.review };
  }
  return { code: TRUST_STATE.READY, label: "Ready", detail: DTL_GLOBAL_MICROCOPY.states.ready };
}

function figureForStage(entry, stageId){
  const allowed = Array.isArray(entry?.stageIds) ? entry.stageIds : [];
  return allowed.includes(stageId);
}

function buildFigureView(entry, payload){
  const value = entry?.resolveValue ? valueText(entry.resolveValue(payload)) : "—";
  const assumptions = entry?.resolveAssumptions
    ? toList(entry.resolveAssumptions(payload)).map((row) => row)
    : [];
  const trustState = resolveTrustState(entry, { ...payload, value });
  return {
    id: entry.id,
    tier: entry.tier,
    title: entry.title,
    shortDefinition: entry.shortDefinition,
    whatItMeans: entry.whatItMeans,
    whatDrives: entry.whatDrives,
    howToUse: entry.howToUse,
    displayValue: value,
    tracedValue: value,
    assumptions,
    trustState,
    canonicalPath: entry.canonicalPath,
    displaySurfaces: Array.isArray(entry.displaySurfaces) ? entry.displaySurfaces.slice() : [],
    reportSurfaces: Array.isArray(entry.reportSurfaces) ? entry.reportSurfaces.slice() : [],
    reportParityMappings: Array.isArray(entry.reportParityMappings) ? entry.reportParityMappings.map((row) => ({
      reportType: clean(row?.reportType),
      sectionId: clean(row?.sectionId),
      metricLabel: clean(row?.metricLabel),
    })).filter((row) => row.reportType && row.sectionId && row.metricLabel) : [],
    changeReasons: Array.isArray(entry.changeReasons) ? entry.changeReasons.slice() : [],
    roundingNote: clean(entry.roundingNote) || DTL_GLOBAL_MICROCOPY.displayedValue,
  };
}

export function listDecisionTrustFigures(){
  return Object.values(FIGURES).map((row) => ({
    id: row.id,
    title: row.title,
    tier: row.tier,
    stageIds: Array.isArray(row.stageIds) ? row.stageIds.slice() : [],
    canonicalPath: row.canonicalPath,
    displaySurfaces: Array.isArray(row.displaySurfaces) ? row.displaySurfaces.slice() : [],
    reportSurfaces: Array.isArray(row.reportSurfaces) ? row.reportSurfaces.slice() : [],
    reportParityMappings: Array.isArray(row.reportParityMappings) ? row.reportParityMappings.map((entry) => ({ ...entry })) : [],
  }));
}

export function buildDecisionTrustSurface(input = {}){
  const stageId = normalizeStageId(input?.stageId);
  const shellView = toObject(input?.shellView);
  const stageViews = toObject(input?.stageViews);

  const figures = Object.values(FIGURES)
    .filter((entry) => figureForStage(entry, stageId))
    .map((entry) => buildFigureView(entry, {
      stageId,
      shellView,
      stageViews,
    }));

  return {
    title: "Decision Trust Layer",
    subtitle: "Inspect major decision figures using canonical value paths, assumptions in play, and trust-state guardrails.",
    globalMicrocopy: DTL_GLOBAL_MICROCOPY,
    tiers: {
      tier1: TRUST_TIER_MAP.tier1.slice(),
      tier2: TRUST_TIER_MAP.tier2.slice(),
      tier3: TRUST_TIER_MAP.tier3.slice(),
    },
    figures,
  };
}
