// @ts-check

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function uniqueSorted(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => cleanText(value))
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
}

const DOMAIN_INVALIDATION_RULES = Object.freeze({
  campaign: Object.freeze({
    selectors: Object.freeze(["districtCanonical", "targetingCanonical", "outcomeCanonical"]),
    modules: Object.freeze(["district", "targeting", "outcome", "data"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  district: Object.freeze({
    selectors: Object.freeze([
      "districtCanonical",
      "districtDerived",
      "targetingCanonical",
      "targetingDerived",
      "outcomeCanonical",
      "outcomeDerived",
    ]),
    modules: Object.freeze(["district", "targeting", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  assumptions: Object.freeze({
    selectors: Object.freeze(["districtDerived", "outcomeCanonical", "outcomeDerived"]),
    modules: Object.freeze(["district", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  ballot: Object.freeze({
    selectors: Object.freeze(["districtCanonical", "districtDerived", "outcomeDerived"]),
    modules: Object.freeze(["district", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  candidateHistory: Object.freeze({
    selectors: Object.freeze(["districtCanonical", "districtDerived", "targetingDerived", "outcomeDerived"]),
    modules: Object.freeze(["district", "targeting", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  targeting: Object.freeze({
    selectors: Object.freeze(["targetingCanonical", "targetingDerived", "outcomeDerived"]),
    modules: Object.freeze(["targeting", "district", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  census: Object.freeze({
    selectors: Object.freeze(["censusCanonical", "censusDerived", "targetingCanonical", "targetingDerived", "outcomeDerived"]),
    modules: Object.freeze(["census", "district", "targeting", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  electionData: Object.freeze({
    selectors: Object.freeze([
      "electionDataCanonical",
      "electionDataDerived",
      "districtDerived",
      "targetingCanonical",
      "targetingDerived",
      "outcomeDerived",
    ]),
    modules: Object.freeze(["electionData", "district", "targeting", "outcome", "data"]),
    bridges: Object.freeze(["electionDataBridge", "districtBridge", "outcomeBridge"]),
  }),
  outcome: Object.freeze({
    selectors: Object.freeze(["outcomeCanonical", "outcomeDerived"]),
    modules: Object.freeze(["outcome", "data"]),
    bridges: Object.freeze(["outcomeBridge"]),
  }),
  fieldCapacity: Object.freeze({
    selectors: Object.freeze(["outcomeCanonical", "outcomeDerived"]),
    modules: Object.freeze(["district", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  weatherRisk: Object.freeze({
    selectors: Object.freeze(["weatherRiskCanonical", "weatherRiskDerived", "outcomeDerived"]),
    modules: Object.freeze(["warRoom", "outcome"]),
    bridges: Object.freeze(["weatherRiskBridge", "outcomeBridge"]),
  }),
  eventCalendar: Object.freeze({
    selectors: Object.freeze(["eventCalendarCanonical", "eventCalendarDerived", "outcomeDerived"]),
    modules: Object.freeze(["warRoom", "outcome"]),
    bridges: Object.freeze(["eventCalendarBridge", "outcomeBridge"]),
  }),
  forecastArchive: Object.freeze({
    selectors: Object.freeze(["outcomeDerived"]),
    modules: Object.freeze(["data", "outcome"]),
    bridges: Object.freeze(["outcomeBridge"]),
  }),
  recovery: Object.freeze({
    selectors: Object.freeze(["districtCanonical", "outcomeCanonical"]),
    modules: Object.freeze(["data", "district", "outcome"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  governance: Object.freeze({
    selectors: Object.freeze(["outcomeDerived"]),
    modules: Object.freeze(["outcome", "data"]),
    bridges: Object.freeze(["outcomeBridge"]),
  }),
  scenarios: Object.freeze({
    selectors: Object.freeze(["districtCanonical", "targetingCanonical", "outcomeCanonical"]),
    modules: Object.freeze(["district", "targeting", "outcome", "warRoom", "data"]),
    bridges: Object.freeze(["districtBridge", "outcomeBridge"]),
  }),
  audit: Object.freeze({
    selectors: Object.freeze(["outcomeDerived"]),
    modules: Object.freeze(["data", "outcome"]),
    bridges: Object.freeze(["outcomeBridge"]),
  }),
  ui: Object.freeze({
    selectors: Object.freeze([]),
    modules: Object.freeze(["ui"]),
    bridges: Object.freeze([]),
  }),
});

function withElectionImportOverrides(rule, revisionReason = "") {
  const reason = cleanText(revisionReason);
  if (!reason.startsWith("electionData.importFile")) {
    return rule;
  }
  return {
    selectors: uniqueSorted([
      ...(rule?.selectors || []),
      "districtCanonical",
    ]),
    modules: uniqueSorted([
      ...(rule?.modules || []),
      "reporting",
    ]),
    bridges: uniqueSorted(rule?.bridges || []),
  };
}

/**
 * Resolve downstream recompute invalidations for a mutation.
 *
 * @param {{
 *   domain?: string,
 *   actionName?: string,
 *   revisionReason?: string,
 * }} input
 */
export function resolveRecomputeInvalidations(input = {}) {
  const domain = cleanText(input?.domain);
  const actionName = cleanText(input?.actionName);
  const revisionReason = cleanText(input?.revisionReason);
  const base = DOMAIN_INVALIDATION_RULES[domain] || {
    selectors: [],
    modules: [],
    bridges: [],
  };
  const adjusted = domain === "electionData"
    ? withElectionImportOverrides(base, revisionReason)
    : base;

  return {
    domain,
    actionName,
    revisionReason,
    selectors: uniqueSorted(adjusted.selectors),
    modules: uniqueSorted(adjusted.modules),
    bridges: uniqueSorted(adjusted.bridges),
  };
}

export function listRecomputeInvalidationRules() {
  const out = {};
  Object.keys(DOMAIN_INVALIDATION_RULES)
    .sort((a, b) => a.localeCompare(b))
    .forEach((domain) => {
      const row = DOMAIN_INVALIDATION_RULES[domain];
      out[domain] = {
        selectors: uniqueSorted(row.selectors),
        modules: uniqueSorted(row.modules),
        bridges: uniqueSorted(row.bridges),
      };
    });
  return out;
}

