// @ts-check

const SET_STATE_ALLOWED_ROOT_KEYS = new Set(["ui"]);
const DERIVED_PATH_PREFIXES = [
  "state.ui.lastValidationSnapshot",
  "state.ui.lastRealismSnapshot",
  "state.ui.lastGovernanceSnapshot",
  "state.ui.lastDiagnostics",
  "state.ui.reporting.lastPayload",
];

function asStringList(value){
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function firstContextMissing(context){
  const campaignId = String(context?.campaignId || "").trim();
  const officeId = String(context?.officeId || "").trim();
  if (!campaignId) return "campaignId";
  if (!officeId) return "officeId";
  return "";
}

function hasDerivedPathMutation(paths){
  return paths.some((path) => DERIVED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)));
}

/**
 * @param {Record<string, any>} event
 * @param {Record<string, any>} runtime
 * @returns {Array<Record<string, any>>}
 */
export function evaluateStateContracts(event, runtime = {}){
  const findings = [];
  const eventType = String(event?.type || "");
  if (eventType !== "state_write" && eventType !== "state_rehydrated"){
    return findings;
  }

  const contextMissing = firstContextMissing(event?.context || runtime?.lastContext || {});
  if (contextMissing){
    findings.push({
      severity: "BLOCKER",
      classification: "blocker",
      contract_name: "context_scope_required_for_state_write",
      contract_type: "State Contracts",
      affected_path: `state.${contextMissing}`,
      expected_behavior: "Every critical mutation must stay scoped by campaignId and officeId.",
      observed_behavior: `State mutation executed with missing ${contextMissing}.`,
      probable_cause: "Context selection or rehydration occurred after a write path started.",
    });
  }

  if (eventType === "state_rehydrated"){
    return findings;
  }

  const changedTopLevel = asStringList(event?.changedTopLevel);
  if (String(event?.action_name || "") === "setState"){
    const disallowed = changedTopLevel.filter((key) => !SET_STATE_ALLOWED_ROOT_KEYS.has(key));
    if (disallowed.length){
      findings.push({
        severity: "VIOLATION",
        classification: "warning",
        contract_name: "set_state_outside_ui_scope",
        contract_type: "State Contracts",
        affected_path: disallowed.map((key) => `state.${key}`).join(", "),
        expected_behavior: "setState may mutate only state.ui and never top-level engine state.",
        observed_behavior: `setState changed top-level keys outside ui: ${disallowed.join(", ")}.`,
        probable_cause: "A component-level handler attempted to bypass canonical mutation ownership.",
      });
    }
  }

  const changedPaths = asStringList(event?.changedPaths);
  if (changedPaths.length && hasDerivedPathMutation(changedPaths)){
    findings.push({
      severity: "VIOLATION",
      classification: "warning",
      contract_name: "derived_field_direct_mutation",
      contract_type: "State Contracts",
      affected_path: changedPaths.filter((path) => DERIVED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))).join(", "),
      expected_behavior: "Derived/reporting snapshots must be recomputed, never directly mutated by control handlers.",
      observed_behavior: "Mutation touched derived snapshot/reporting paths directly.",
      probable_cause: "A non-canonical write path is mutating derived state as if it were source input.",
    });
  }

  return findings;
}

