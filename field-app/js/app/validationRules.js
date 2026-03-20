// @ts-check
import { formatFixedNumber, formatPercentFromUnit, safeNum } from "../core/utils.js";

export const VALIDATION_RULES_VERSION = "13.1.0";

export const VALIDATION_SEVERITY = Object.freeze({
  BLOCKER: "blocker",
  CRITICAL: "critical",
  WARNING: "warning",
  ADVISORY: "advisory",
});

export const VALIDATION_LAYER = Object.freeze({
  REQUIREDNESS: "requiredness",
  STRUCTURAL: "structural_validity",
  CROSS_FIELD: "cross_field_consistency",
  READINESS: "readiness_impact",
});

export const VALIDATION_DOMAIN_META = Object.freeze({
  campaignContext: Object.freeze({
    id: "campaignContext",
    title: "Campaign Context",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "campaign-setup-controls",
  }),
  targetUniverse: Object.freeze({
    id: "targetUniverse",
    title: "Target Universe",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "targeting-lab-universe-inputs",
  }),
  workforce: Object.freeze({
    id: "workforce",
    title: "Workforce",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "operations-hub-workforce",
  }),
  contactProgram: Object.freeze({
    id: "contactProgram",
    title: "Contact Program",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "turnout-contact-channel-inputs",
  }),
  budgetCost: Object.freeze({
    id: "budgetCost",
    title: "Budget / Channel Cost",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "budget-channel-cost-inputs",
  }),
  assumptions: Object.freeze({
    id: "assumptions",
    title: "Assumptions",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "model-assumptions",
  }),
  reporting: Object.freeze({
    id: "reporting",
    title: "Reporting",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "daily-weekly-reporting",
  }),
  resultsAudit: Object.freeze({
    id: "resultsAudit",
    title: "Learning / Audit",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "learning-audit-results-entry",
  }),
  scenarios: Object.freeze({
    id: "scenarios",
    title: "Scenarios",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "scenario-manager",
  }),
  eventsCalendar: Object.freeze({
    id: "eventsCalendar",
    title: "Calendar / Events",
    manualPageId: "campaignDataRequirements",
    manualAnchor: "calendar-events",
  }),
});

function hasText(value){
  return String(value == null ? "" : value).trim().length > 0;
}

function issue(rule, { message, fixPath = "", inputPath = "", data = null } = {}){
  const domainMeta = VALIDATION_DOMAIN_META[rule.domain] || {};
  return {
    issueId: String(rule.id || "").trim(),
    domain: String(rule.domain || "").trim(),
    layer: String(rule.layer || "").trim(),
    severity: String(rule.severity || "").trim(),
    title: String(rule.title || "").trim(),
    message: String(message || "").trim(),
    fixPath: String(fixPath || rule.fixPath || "").trim(),
    inputPath: String(inputPath || rule.inputPath || "").trim(),
    manualPageId: String(rule.manualPageId || domainMeta.manualPageId || "").trim(),
    manualAnchor: String(rule.manualAnchor || domainMeta.manualAnchor || "").trim(),
    moduleId: String(rule.moduleId || "").trim(),
    data,
  };
}

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @typedef {{
 *   state: AnyRecord,
 *   res: AnyRecord,
 *   weeks: number | null,
 *   contextValidation: AnyRecord,
 *   realism: AnyRecord | null,
 *   voterSignals: AnyRecord | null,
 * }} ValidationRuleContext
 */

/**
 * @typedef {{
 *   id: string,
 *   domain: keyof typeof VALIDATION_DOMAIN_META,
 *   layer: string,
 *   severity: string,
 *   title: string,
 *   fixPath?: string,
 *   inputPath?: string,
 *   manualPageId?: string,
 *   manualAnchor?: string,
 *   moduleId?: string,
 *   evaluate: (ctx: ValidationRuleContext) => AnyRecord | null,
 * }} ValidationRule
 */

/**
 * @type {ValidationRule[]}
 */
export const VALIDATION_RULES = Object.freeze([
  {
    id: "campaign_context_missing_campaign",
    domain: "campaignContext",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.BLOCKER,
    title: "Campaign context requires campaign id",
    fixPath: "Controls > Campaign Setup / Controls > Campaign ID",
    inputPath: "state.campaignId",
    evaluate: ({ state }) => {
      if (hasText(state?.campaignId)) return null;
      return issue(VALIDATION_RULES[0], {
        message: "Campaign ID is missing, so campaign-scoped validation and outputs cannot be trusted.",
      });
    },
  },
  {
    id: "campaign_context_missing_office",
    domain: "campaignContext",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Campaign context requires office id",
    fixPath: "Controls > Campaign Setup / Controls > Office ID",
    inputPath: "state.officeId",
    evaluate: ({ state }) => {
      if (hasText(state?.officeId)) return null;
      return issue(VALIDATION_RULES[1], {
        message: "Office ID is missing, so office-scoped state isolation is degraded.",
      });
    },
  },
  {
    id: "campaign_context_structural_invalid",
    domain: "campaignContext",
    layer: VALIDATION_LAYER.STRUCTURAL,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Campaign context failed structural validation",
    fixPath: "Controls > Campaign Setup / Controls",
    inputPath: "contextValidation",
    evaluate: ({ contextValidation }) => {
      if (contextValidation?.ok) return null;
      const missing = Array.isArray(contextValidation?.missing) ? contextValidation.missing : [];
      return issue(VALIDATION_RULES[2], {
        message: `Context validation failed for: ${missing.join(", ") || "unknown fields"}.`,
        data: { missing },
      });
    },
  },
  {
    id: "target_universe_required_universe_size",
    domain: "targetUniverse",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.BLOCKER,
    title: "Target universe needs valid universe size",
    fixPath: "District > Universe size",
    inputPath: "state.universeSize",
    evaluate: ({ res }) => {
      if (res?.validation?.universeOk) return null;
      return issue(VALIDATION_RULES[3], {
        message: "Universe size is missing or invalid, blocking turnout and persuasion projections.",
      });
    },
  },
  {
    id: "target_universe_ballot_totals",
    domain: "targetUniverse",
    layer: VALIDATION_LAYER.STRUCTURAL,
    severity: VALIDATION_SEVERITY.BLOCKER,
    title: "Ballot baseline totals must equal 100%",
    fixPath: "District > Ballot baseline table",
    inputPath: "state.candidates[] + state.undecidedPct",
    evaluate: ({ res }) => {
      if (res?.validation?.candidateTableOk) return null;
      return issue(VALIDATION_RULES[4], {
        message: String(res?.validation?.candidateTableMsg || "Candidate support totals must equal 100%."),
      });
    },
  },
  {
    id: "target_universe_user_split",
    domain: "targetUniverse",
    layer: VALIDATION_LAYER.STRUCTURAL,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "User-defined undecided split must equal 100%",
    fixPath: "District > Undecided mode > User split",
    inputPath: "state.userSplit",
    evaluate: ({ state, res }) => {
      if (String(state?.undecidedMode || "").trim() !== "user_defined") return null;
      if (res?.validation?.userSplitOk) return null;
      return issue(VALIDATION_RULES[5], {
        message: String(res?.validation?.userSplitMsg || "User split totals must equal 100%."),
      });
    },
  },
  {
    id: "workforce_required_organizers",
    domain: "workforce",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Workforce requires organizer count",
    fixPath: "Reach / Operations > Organizer count",
    inputPath: "state.orgCount",
    evaluate: ({ state }) => {
      const orgCount = safeNum(state?.orgCount);
      if (orgCount != null && orgCount > 0) return null;
      return issue(VALIDATION_RULES[6], {
        message: "Organizer count is missing or zero; capacity readiness is degraded.",
      });
    },
  },
  {
    id: "workforce_structural_hours",
    domain: "workforce",
    layer: VALIDATION_LAYER.STRUCTURAL,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Workforce requires organizer hours",
    fixPath: "Reach / Operations > Organizer hours per week",
    inputPath: "state.orgHoursPerWeek",
    evaluate: ({ state }) => {
      const orgHours = safeNum(state?.orgHoursPerWeek);
      if (orgHours != null && orgHours > 0) return null;
      return issue(VALIDATION_RULES[7], {
        message: "Organizer hours are missing or zero, reducing reliability of capacity projections.",
      });
    },
  },
  {
    id: "contact_program_support_rate",
    domain: "contactProgram",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Contact program should include support rate",
    fixPath: "District / Turnout assumptions > Support rate",
    inputPath: "state.supportRatePct",
    evaluate: ({ state }) => {
      const supportRate = safeNum(state?.supportRatePct);
      if (supportRate != null && supportRate >= 0 && supportRate <= 100) return null;
      return issue(VALIDATION_RULES[8], {
        message: "Support rate is missing or out of range, reducing conversion confidence.",
      });
    },
  },
  {
    id: "contact_program_contact_rate",
    domain: "contactProgram",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Contact program should include contact rate",
    fixPath: "District / Turnout assumptions > Contact rate",
    inputPath: "state.contactRatePct",
    evaluate: ({ state }) => {
      const contactRate = safeNum(state?.contactRatePct);
      if (contactRate != null && contactRate >= 0 && contactRate <= 100) return null;
      return issue(VALIDATION_RULES[9], {
        message: "Contact rate is missing or out of range, reducing execution estimate reliability.",
      });
    },
  },
  {
    id: "budget_cost_enabled_channel_required",
    domain: "budgetCost",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.BLOCKER,
    title: "Budget strategy needs at least one enabled channel",
    fixPath: "Turnout / Budget controls > Channel enable toggles",
    inputPath: "state.budget.tactics.*.enabled",
    evaluate: ({ state }) => {
      const tactics = state?.budget?.tactics || {};
      const keys = Object.keys(tactics);
      const enabled = keys.some((key) => !!tactics?.[key]?.enabled);
      if (enabled) return null;
      return issue(VALIDATION_RULES[10], {
        message: "No channel is enabled in budget tactics, so optimizer outputs are blocked.",
      });
    },
  },
  {
    id: "budget_cost_positive_cpa",
    domain: "budgetCost",
    layer: VALIDATION_LAYER.STRUCTURAL,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Enabled channels need positive cost assumptions",
    fixPath: "Turnout / Budget controls > Channel CPA fields",
    inputPath: "state.budget.tactics.*.cpa",
    evaluate: ({ state }) => {
      const tactics = state?.budget?.tactics || {};
      const offenders = [];
      for (const [key, row] of Object.entries(tactics)){
        if (!row?.enabled) continue;
        const cpa = safeNum(row?.cpa);
        if (cpa == null || cpa <= 0){
          offenders.push(key);
        }
      }
      if (!offenders.length) return null;
      return issue(VALIDATION_RULES[11], {
        message: `Enabled channels have non-positive cost assumptions: ${offenders.join(", ")}.`,
        data: { offenders },
      });
    },
  },
  {
    id: "assumptions_turnout_required",
    domain: "assumptions",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Assumptions need turnout baseline inputs",
    fixPath: "District > Turnout baseline (Cycle A/B and band)",
    inputPath: "state.turnoutA, state.turnoutB, state.bandWidth",
    evaluate: ({ res }) => {
      if (res?.validation?.turnoutOk) return null;
      return issue(VALIDATION_RULES[12], {
        message: "Turnout baseline is incomplete, degrading outcome reliability.",
      });
    },
  },
  {
    id: "assumptions_persuasion_required",
    domain: "assumptions",
    layer: VALIDATION_LAYER.REQUIREDNESS,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Assumptions should include persuasion share",
    fixPath: "District > Persuasion %",
    inputPath: "state.persuasionPct",
    evaluate: ({ res }) => {
      if (res?.validation?.persuasionOk) return null;
      return issue(VALIDATION_RULES[13], {
        message: "Persuasion share is missing or invalid.",
      });
    },
  },
  {
    id: "assumptions_realism_gate",
    domain: "assumptions",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Assumptions realism classification is below acceptable threshold",
    fixPath: "District / Turnout / Plan assumptions and capacity inputs",
    inputPath: "state.ui.lastRealismSnapshot",
    evaluate: ({ realism }) => {
      const classification = String(realism?.classification || "").trim().toLowerCase();
      if (!classification || classification === "realistic" || classification === "aggressive"){
        return null;
      }
      return issue(VALIDATION_RULES[14], {
        message: `Realism classification is '${classification}', requiring assumption and capacity review before high-trust use.`,
      });
    },
  },
  {
    id: "reporting_context_provenance",
    domain: "reporting",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.ADVISORY,
    title: "Reporting should include campaign/source provenance",
    fixPath: "District > Source note, Campaign context header",
    inputPath: "state.campaignName, state.sourceNote",
    evaluate: ({ state }) => {
      if (hasText(state?.campaignName) && hasText(state?.sourceNote)) return null;
      return issue(VALIDATION_RULES[15], {
        message: "Campaign name or source note is missing; report explainability is reduced.",
      });
    },
  },
  {
    id: "results_audit_learning_missing",
    domain: "resultsAudit",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.ADVISORY,
    title: "Learning audit has limited observed history",
    fixPath: "Controls / Data > Learning and audit entries",
    inputPath: "state.ui.modelAudit",
    evaluate: ({ state }) => {
      const sampleSize = safeNum(state?.ui?.modelAudit?.sampleSize);
      if (sampleSize != null && sampleSize >= 5) return null;
      return issue(VALIDATION_RULES[16], {
        message: "Model audit sample size is low; calibration confidence may be limited.",
      });
    },
  },
  {
    id: "scenarios_registry_shape",
    domain: "scenarios",
    layer: VALIDATION_LAYER.STRUCTURAL,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Scenario registry should be structurally valid",
    fixPath: "Scenarios > Workspace",
    inputPath: "state.ui.scenarios",
    evaluate: ({ state }) => {
      const reg = state?.ui?.scenarios;
      if (reg && typeof reg === "object" && !Array.isArray(reg)) return null;
      return issue(VALIDATION_RULES[17], {
        message: "Scenario registry is missing or malformed.",
      });
    },
  },
  {
    id: "scenarios_selected_consistency",
    domain: "scenarios",
    layer: VALIDATION_LAYER.CROSS_FIELD,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Selected scenario should exist in registry",
    fixPath: "Scenarios > Compare / Load selection",
    inputPath: "state.ui.scenarioUiSelectedId",
    evaluate: ({ state }) => {
      const reg = state?.ui?.scenarios;
      const selectedId = String(state?.ui?.scenarioUiSelectedId || "").trim();
      if (!selectedId) return null;
      if (reg && typeof reg === "object" && Object.prototype.hasOwnProperty.call(reg, selectedId)) return null;
      return issue(VALIDATION_RULES[18], {
        message: `Selected scenario '${selectedId}' is not present in the scenario registry.`,
      });
    },
  },
  {
    id: "events_calendar_deferred_notice",
    domain: "eventsCalendar",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.ADVISORY,
    title: "Events calendar layer not yet active in this phase set",
    fixPath: "Phase 18.75 implementation queue",
    inputPath: "state.ui.eventCalendar",
    evaluate: ({ state }) => {
      const eventCalendar = state?.ui?.eventCalendar;
      if (eventCalendar && typeof eventCalendar === "object") return null;
      // Advisory only; this is intentionally non-blocking before Phase 18.75.
      return issue(VALIDATION_RULES[19], {
        message: "Events calendar canonical layer is not active yet (non-blocking before Phase 18.75).",
      });
    },
  },
  {
    id: "workforce_role_typing_missing_source",
    domain: "workforce",
    layer: VALIDATION_LAYER.STRUCTURAL,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Workforce role typing metrics missing",
    fixPath: "Operations Pipeline > Role",
    inputPath: "state.ui.twCapOutlookLatest.workforce",
    evaluate: ({ state }) => {
      const workforce = state?.ui?.twCapOutlookLatest?.workforce;
      if (workforce && typeof workforce === "object" && safeNum(workforce?.roleTypingCoveragePct) != null){
        return null;
      }
      return issue(VALIDATION_RULES[20], {
        message: "Workforce role-typing metrics are missing; capacity realism is degraded.",
      });
    },
  },
  {
    id: "workforce_role_typing_incomplete",
    domain: "workforce",
    layer: VALIDATION_LAYER.CROSS_FIELD,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Active workforce role typing incomplete",
    fixPath: "Operations Pipeline > Role",
    inputPath: "state.ui.twCapOutlookLatest.workforce",
    evaluate: ({ state }) => {
      const workforce = state?.ui?.twCapOutlookLatest?.workforce;
      if (!workforce || typeof workforce !== "object") return null;
      const activeHeadcount = safeNum(workforce?.activeHeadcount);
      const missingRoleTypedCount = safeNum(workforce?.missingRoleTypedCount);
      const coverage = safeNum(workforce?.roleTypingCoveragePct);
      if (activeHeadcount == null || activeHeadcount <= 0) return null;
      if ((missingRoleTypedCount == null || missingRoleTypedCount <= 0) && coverage != null && coverage >= 0.999){
        return null;
      }
      const coverageText = coverage == null ? "unknown" : `${formatFixedNumber(coverage * 100, 0, "0")}%`;
      return issue(VALIDATION_RULES[21], {
        message: `Role typing is incomplete for active workforce records (coverage ${coverageText}).`,
        data: {
          activeHeadcount,
          missingRoleTypedCount,
          coverage,
        },
      });
    },
  },
  {
    id: "budget_cost_realism_warning",
    domain: "budgetCost",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Budget costs outside realism band",
    fixPath: "Turnout Budget > CPA",
    inputPath: "state.ui.lastRealismSnapshot.flaggedAssumptions[type=budget]",
    evaluate: ({ realism }) => {
      const assumptions = Array.isArray(realism?.flaggedAssumptions) ? realism.flaggedAssumptions : [];
      const warnRows = assumptions.filter((row) => String(row?.type || "").trim() === "budget" && String(row?.severity || "").trim() === "warn");
      if (!warnRows.length) return null;
      return issue(VALIDATION_RULES[22], {
        message: String(warnRows[0]?.message || "One or more channel costs are outside realistic floors/ceilings."),
      });
    },
  },
  {
    id: "budget_cost_realism_extreme",
    domain: "budgetCost",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.BLOCKER,
    title: "Budget costs exceed extreme bounds",
    fixPath: "Turnout Budget > CPA",
    inputPath: "state.ui.lastRealismSnapshot.flaggedAssumptions[type=budget,severity=bad]",
    evaluate: ({ realism }) => {
      const assumptions = Array.isArray(realism?.flaggedAssumptions) ? realism.flaggedAssumptions : [];
      const badRows = assumptions.filter((row) => String(row?.type || "").trim() === "budget" && String(row?.severity || "").trim() === "bad");
      if (!badRows.length) return null;
      return issue(VALIDATION_RULES[23], {
        message: String(badRows[0]?.message || "At least one channel cost is outside extreme bounds."),
      });
    },
  },
  {
    id: "target_universe_candidate_history_missing",
    domain: "targetUniverse",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Candidate-history ballot baseline records missing",
    fixPath: "District > Candidate history baseline table",
    inputPath: "state.candidateHistory",
    evaluate: ({ res }) => {
      const history = res?.validation?.candidateHistory;
      const recordCount = safeNum(history?.recordCount);
      if (recordCount != null && recordCount > 0) return null;
      return issue({
        id: "target_universe_candidate_history_missing",
        domain: "targetUniverse",
        layer: VALIDATION_LAYER.READINESS,
        severity: VALIDATION_SEVERITY.WARNING,
        title: "Candidate-history ballot baseline records missing",
        fixPath: "District > Candidate history baseline table",
        inputPath: "state.candidateHistory",
      }, {
        message: "No candidate-history records are entered; ballot baseline confidence is downgraded.",
      });
    },
  },
  {
    id: "target_universe_candidate_history_low_confidence",
    domain: "targetUniverse",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Candidate-history ballot baseline confidence is low",
    fixPath: "District > Candidate history baseline table",
    inputPath: "res.validation.candidateHistory",
    evaluate: ({ res }) => {
      const history = res?.validation?.candidateHistory;
      if (!history || typeof history !== "object") return null;
      const recordCount = safeNum(history?.recordCount);
      const confidenceBand = String(history?.confidenceBand || "").trim().toLowerCase();
      if (!(recordCount > 0) || confidenceBand !== "low") return null;
      const incompleteCount = safeNum(history?.incompleteRecordCount);
      return issue({
        id: "target_universe_candidate_history_low_confidence",
        domain: "targetUniverse",
        layer: VALIDATION_LAYER.READINESS,
        severity: VALIDATION_SEVERITY.CRITICAL,
        title: "Candidate-history ballot baseline confidence is low",
        fixPath: "District > Candidate history baseline table",
        inputPath: "res.validation.candidateHistory",
      }, {
        message: `Candidate-history confidence is low; complete required row fields before trusting shifted baseline outputs${incompleteCount ? ` (${formatFixedNumber(incompleteCount, 0, "0")} incomplete row(s)).` : "."}`,
      });
    },
  },
  {
    id: "target_universe_age_segmentation_missing",
    domain: "targetUniverse",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Age segmentation is missing",
    fixPath: "Data > Voter import (DOB/age) or District > Census age distribution",
    inputPath: "state.voterData.rows[].age|dateOfBirth or state.census.ageDistribution",
    evaluate: ({ voterSignals }) => {
      const source = String(voterSignals?.ageSegmentation?.source || "unknown").trim().toLowerCase();
      if (source && source !== "unknown") return null;
      return issue({
        id: "target_universe_age_segmentation_missing",
        domain: "targetUniverse",
        layer: VALIDATION_LAYER.READINESS,
        severity: VALIDATION_SEVERITY.WARNING,
        title: "Age segmentation is missing",
        fixPath: "Data > Voter import (DOB/age) or District > Census age distribution",
        inputPath: "state.voterData.rows[].age|dateOfBirth or state.census.ageDistribution",
      }, {
        message: "Age segmentation is unavailable; turnout opportunity and cohort-risk guidance are degraded.",
      });
    },
  },
  {
    id: "target_universe_age_segmentation_low_coverage",
    domain: "targetUniverse",
    layer: VALIDATION_LAYER.READINESS,
    severity: VALIDATION_SEVERITY.WARNING,
    title: "Age segmentation coverage is low",
    fixPath: "Data > Voter import (DOB/age quality) and District > Census age distribution",
    inputPath: "state.voterData.latestHistoryIntelligence.ageBucketPercents",
    evaluate: ({ voterSignals }) => {
      const source = String(voterSignals?.ageSegmentation?.source || "unknown").trim().toLowerCase();
      if (!source || source === "unknown") return null;
      const coverage = safeNum(voterSignals?.ageSegmentation?.knownAgeCoverageRate);
      if (coverage == null || coverage >= 0.45) return null;
      return issue({
        id: "target_universe_age_segmentation_low_coverage",
        domain: "targetUniverse",
        layer: VALIDATION_LAYER.READINESS,
        severity: VALIDATION_SEVERITY.WARNING,
        title: "Age segmentation coverage is low",
        fixPath: "Data > Voter import (DOB/age quality) and District > Census age distribution",
        inputPath: "state.voterData.latestHistoryIntelligence.ageBucketPercents",
      }, {
        message: `Age cohort coverage is ${formatPercentFromUnit(coverage, 0)}; confidence in age-driven targeting is reduced.`,
      });
    },
  },
  {
    id: "assumptions_age_turnout_conflict",
    domain: "assumptions",
    layer: VALIDATION_LAYER.CROSS_FIELD,
    severity: VALIDATION_SEVERITY.CRITICAL,
    title: "Turnout target conflicts with age-cohort risk profile",
    fixPath: "District > Turnout baseline/target and Data > voter age/frequency coverage",
    inputPath: "state.turnoutBaselinePct + state.turnoutTargetOverridePct + state.voterData.latestHistoryIntelligence",
    evaluate: ({ state, voterSignals }) => {
      const baseline = safeNum(state?.turnoutBaselinePct);
      const target = safeNum(state?.turnoutTargetOverridePct);
      if (baseline == null || target == null) return null;
      const turnoutDelta = target - baseline;
      if (turnoutDelta < 8) return null;

      const totalRows = Math.max(0, safeNum(voterSignals?.totalRows) ?? 0);
      const frequency = voterSignals?.historyIntelligence?.frequencySegments || {};
      const lowFreq = Math.max(0, safeNum(frequency?.lowFrequencyVoters) ?? 0);
      const dropoff = Math.max(0, safeNum(frequency?.dropoffVoters) ?? 0);
      const lowPropensityShare = totalRows > 0
        ? (lowFreq + dropoff) / totalRows
        : null;
      const turnoutRisk = safeNum(voterSignals?.ageSegmentation?.turnoutRiskScore);
      const conflict = (
        (lowPropensityShare != null && lowPropensityShare >= 0.35)
        || (turnoutRisk != null && turnoutRisk >= 0.6)
      );
      if (!conflict) return null;
      return issue({
        id: "assumptions_age_turnout_conflict",
        domain: "assumptions",
        layer: VALIDATION_LAYER.CROSS_FIELD,
        severity: VALIDATION_SEVERITY.CRITICAL,
        title: "Turnout target conflicts with age-cohort risk profile",
        fixPath: "District > Turnout baseline/target and Data > voter age/frequency coverage",
        inputPath: "state.turnoutBaselinePct + state.turnoutTargetOverridePct + state.voterData.latestHistoryIntelligence",
      }, {
        message: `Turnout target lift (${formatFixedNumber(turnoutDelta, 1, "0.0")}pp) conflicts with age/frequency cohort risk profile.`,
        data: {
          turnoutDelta,
          lowPropensityShare,
          turnoutRisk,
        },
      });
    },
  },
]);
