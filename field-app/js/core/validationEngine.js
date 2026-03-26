// @ts-check
import { validateCampaignContext } from "../core/campaignContextManager.js";
import { deriveVoterModelSignals, extractCensusAgeDistribution } from "../core/voterDataLayer.js";
import { computeModelReadiness } from "./modelReadiness.js";
import { VALIDATION_DOMAIN_META, VALIDATION_RULES, VALIDATION_RULES_VERSION } from "./validationRules.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

function normalizeSeverity(value){
  const text = String(value || "").trim().toLowerCase();
  if (text === "blocker" || text === "critical" || text === "warning" || text === "advisory"){
    return text;
  }
  return "advisory";
}

/**
 * @param {{ issues?: AnyRecord[] }} args
 */
function buildIssueCounts({ issues = [] } = {}){
  const rows = Array.isArray(issues) ? issues : [];
  const out = {
    blocker: 0,
    critical: 0,
    warning: 0,
    advisory: 0,
    total: rows.length,
  };
  for (const row of rows){
    const severity = normalizeSeverity(row?.severity);
    out[severity] += 1;
  }
  return out;
}

function buildFixPathIndex(issues = []){
  const out = {};
  for (const row of issues){
    const issueId = String(row?.issueId || "").trim();
    if (!issueId) continue;
    out[issueId] = {
      fixPath: String(row?.fixPath || "").trim(),
      inputPath: String(row?.inputPath || "").trim(),
      manualPageId: String(row?.manualPageId || "").trim(),
      manualAnchor: String(row?.manualAnchor || "").trim(),
      domain: String(row?.domain || "").trim(),
      severity: normalizeSeverity(row?.severity),
    };
  }
  return out;
}

/**
 * Canonical validation/readiness engine.
 * Structural validation and readiness only; realism stays separate and is consumed as an input.
 *
 * @param {{
 *   state?: AnyRecord,
 *   res?: AnyRecord,
 *   weeks?: unknown,
 *   realism?: AnyRecord | null,
 *   context?: AnyRecord,
 * }} args
 */
export function runValidationEngine({
  state = {},
  res = {},
  weeks = null,
  realism = null,
  context = null,
} = {}){
  const contextValidation = validateCampaignContext(
    context || {
      campaignId: state?.campaignId,
      campaignName: state?.campaignName,
      officeId: state?.officeId,
      scenarioId: state?.ui?.activeScenarioId || state?.scenarioId,
    },
    { requireOffice: true }
  );

  const ruleContext = {
    state,
    res,
    weeks: Number.isFinite(Number(weeks)) ? Number(weeks) : null,
    contextValidation,
    realism: realism && typeof realism === "object" ? realism : null,
    voterSignals: deriveVoterModelSignals(state?.voterData, {
      censusAgeDistribution: extractCensusAgeDistribution(state?.census),
      universeSize: Number.isFinite(Number(state?.universeSize)) ? Number(state.universeSize) : null,
    }),
  };

  const issues = [];
  for (const rule of VALIDATION_RULES){
    if (!rule || typeof rule.evaluate !== "function") continue;
    let result = null;
    try {
      result = rule.evaluate(ruleContext);
    } catch (err){
      result = {
        issueId: String(rule.id || "").trim(),
        domain: String(rule.domain || "assumptions").trim(),
        layer: String(rule.layer || "structural_validity").trim(),
        severity: "warning",
        title: `${String(rule.title || "Validation rule")} runtime error`,
        message: String(err?.message || err || "Validation rule threw an error."),
        fixPath: String(rule.fixPath || "").trim(),
        inputPath: String(rule.inputPath || "").trim(),
        manualPageId: String(rule.manualPageId || VALIDATION_DOMAIN_META?.[rule.domain]?.manualPageId || "").trim(),
        manualAnchor: String(rule.manualAnchor || VALIDATION_DOMAIN_META?.[rule.domain]?.manualAnchor || "").trim(),
        moduleId: String(rule.moduleId || "").trim(),
        data: null,
      };
    }
    if (!result) continue;
    issues.push({
      ...result,
      severity: normalizeSeverity(result.severity),
    });
  }

  const readiness = computeModelReadiness({ issues });
  const issueCounts = buildIssueCounts({ issues });

  return {
    version: VALIDATION_RULES_VERSION,
    generatedAt: new Date().toISOString(),
    context: contextValidation?.context || {},
    contextValidation,
    domains: Object.keys(VALIDATION_DOMAIN_META).map((key) => ({
      id: key,
      title: String(VALIDATION_DOMAIN_META?.[key]?.title || key),
      manualPageId: String(VALIDATION_DOMAIN_META?.[key]?.manualPageId || ""),
      manualAnchor: String(VALIDATION_DOMAIN_META?.[key]?.manualAnchor || ""),
      moduleState: readiness?.moduleState?.[key] || "ok",
    })),
    issues,
    issueCounts,
    fixPathIndex: buildFixPathIndex(issues),
    groupedIssues: readiness.groupedIssues,
    moduleState: readiness.moduleState,
    readinessScore: readiness.score,
    readinessBand: readiness.band,
    readiness,
  };
}
