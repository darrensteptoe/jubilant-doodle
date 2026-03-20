// @ts-check

const DEFAULT_MAX_ENTRIES = 400;
const STORE_GLOBAL_KEY = "__FPE_DIAGNOSTIC_STORE__";

export const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  VIOLATION: "VIOLATION",
  BLOCKER: "BLOCKER",
});

const SEVERITY_ORDER = Object.freeze({
  [DIAGNOSTIC_SEVERITY.INFO]: 0,
  [DIAGNOSTIC_SEVERITY.WARNING]: 1,
  [DIAGNOSTIC_SEVERITY.VIOLATION]: 2,
  [DIAGNOSTIC_SEVERITY.BLOCKER]: 3,
});

function normalizeSeverity(value){
  const raw = String(value || "").trim().toUpperCase();
  return DIAGNOSTIC_SEVERITY[raw] || DIAGNOSTIC_SEVERITY.INFO;
}

function normalizeClassification(value, severity){
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "blocker" || raw === "warning" || raw === "info"){
    return raw;
  }
  if (severity === DIAGNOSTIC_SEVERITY.BLOCKER){
    return "blocker";
  }
  if (severity === DIAGNOSTIC_SEVERITY.WARNING || severity === DIAGNOSTIC_SEVERITY.VIOLATION){
    return "warning";
  }
  return "info";
}

function normalizeContext(context){
  const src = context && typeof context === "object" ? context : {};
  return {
    campaignId: String(src.campaignId || "").trim(),
    officeId: String(src.officeId || "").trim(),
    scenarioId: String(src.scenarioId || "").trim(),
  };
}

function normalizeEntry(rawEntry){
  const raw = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
  const severity = normalizeSeverity(raw.severity);
  return {
    timestamp: String(raw.timestamp || new Date().toISOString()),
    severity,
    contract_name: String(raw.contract_name || "unknown_contract"),
    contract_type: String(raw.contract_type || "Unknown Contracts"),
    action_name: String(raw.action_name || "unknown_action"),
    handler_name: String(raw.handler_name || ""),
    module: String(raw.module || "runtime"),
    context: normalizeContext(raw.context || raw.scenario_context || raw.scenarioContext),
    affected_path: String(raw.affected_path || raw.affectedPath || ""),
    expected_behavior: String(raw.expected_behavior || ""),
    observed_behavior: String(raw.observed_behavior || ""),
    probable_cause: String(raw.probable_cause || ""),
    classification: normalizeClassification(raw.classification, severity),
    meta: raw.meta && typeof raw.meta === "object" ? { ...raw.meta } : {},
  };
}

function severityAtLeast(entrySeverity, minSeverity){
  const entryRank = SEVERITY_ORDER[normalizeSeverity(entrySeverity)] ?? 0;
  const minRank = SEVERITY_ORDER[normalizeSeverity(minSeverity)] ?? 0;
  return entryRank >= minRank;
}

/**
 * @param {{ maxEntries?: number }=} options
 */
export function createDiagnosticStore({ maxEntries = DEFAULT_MAX_ENTRIES } = {}){
  let entries = [];

  function add(rawEntry){
    const entry = normalizeEntry(rawEntry);
    entries.unshift(entry);
    if (entries.length > maxEntries){
      entries.length = maxEntries;
    }
    return entry;
  }

  /**
   * @param {{ limit?: number, minSeverity?: string, contractType?: string, module?: string }=} options
   */
  function list({ limit = 200, minSeverity = DIAGNOSTIC_SEVERITY.INFO, contractType = "", module = "" } = {}){
    const wantContractType = String(contractType || "").trim();
    const wantModule = String(module || "").trim();
    const filtered = entries.filter((entry) => {
      if (!severityAtLeast(entry.severity, minSeverity)) return false;
      if (wantContractType && entry.contract_type !== wantContractType) return false;
      if (wantModule && entry.module !== wantModule) return false;
      return true;
    });
    return filtered.slice(0, Math.max(0, Number(limit) || 0));
  }

  function clear(){
    entries = [];
  }

  function summary(){
    const countsBySeverity = {
      [DIAGNOSTIC_SEVERITY.INFO]: 0,
      [DIAGNOSTIC_SEVERITY.WARNING]: 0,
      [DIAGNOSTIC_SEVERITY.VIOLATION]: 0,
      [DIAGNOSTIC_SEVERITY.BLOCKER]: 0,
    };
    const countsByType = {};
    for (const entry of entries){
      countsBySeverity[entry.severity] = (countsBySeverity[entry.severity] || 0) + 1;
      const type = String(entry.contract_type || "Unknown Contracts");
      countsByType[type] = (countsByType[type] || 0) + 1;
    }
    return {
      total: entries.length,
      blockers: countsBySeverity[DIAGNOSTIC_SEVERITY.BLOCKER] || 0,
      violations: countsBySeverity[DIAGNOSTIC_SEVERITY.VIOLATION] || 0,
      warnings: countsBySeverity[DIAGNOSTIC_SEVERITY.WARNING] || 0,
      info: countsBySeverity[DIAGNOSTIC_SEVERITY.INFO] || 0,
      countsBySeverity,
      countsByType,
      latestTimestamp: entries[0]?.timestamp || "",
    };
  }

  return {
    add,
    list,
    clear,
    summary,
    size: () => entries.length,
  };
}

export function getDiagnosticStore(){
  if (!globalThis[STORE_GLOBAL_KEY]){
    globalThis[STORE_GLOBAL_KEY] = createDiagnosticStore();
  }
  return globalThis[STORE_GLOBAL_KEY];
}

