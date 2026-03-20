// @ts-check

const ALLOWED_BRIDGE_SOURCES = new Set([
  "runtime",
  "bridge.shell",
  "bridge.district",
  "bridge.turnout",
  "bridge.plan",
  "bridge.outcome",
  "bridge.decision",
  "bridge.scenario",
  "bridge.data",
  "bridge.weather",
  "bridge.events",
]);

function clean(value){
  return String(value == null ? "" : value).trim();
}

function hasContext(context){
  return !!clean(context?.campaignId) && !!clean(context?.officeId);
}

/**
 * @param {Record<string, any>} event
 * @param {Record<string, any>} runtime
 * @returns {Array<Record<string, any>>}
 */
export function evaluateBoundaryContracts(event, runtime = {}){
  const findings = [];
  const type = clean(event?.type);

  if (event?.legacyDependency === true){
    findings.push({
      severity: "VIOLATION",
      classification: "warning",
      contract_name: "legacy_shell_dependency_detected",
      contract_type: "Boundary Contracts",
      affected_path: clean(event?.affected_path || event?.affectedPath || "runtime"),
      expected_behavior: "Canonical runtime paths should execute without legacy shell callbacks.",
      observed_behavior: "Event explicitly flagged legacy dependency on an active path.",
      probable_cause: "A transitional bridge or callback is still serving as functional dependency.",
    });
  }

  if (type === "bridge_sync"){
    const source = clean(event?.source);
    if (source && !ALLOWED_BRIDGE_SOURCES.has(source)){
      findings.push({
        severity: "WARNING",
        classification: "warning",
        contract_name: "bridge_sync_unknown_source",
        contract_type: "Boundary Contracts",
        affected_path: "bridge_sync.source",
        expected_behavior: "Bridge sync sources should come from approved canonical bridge paths.",
        observed_behavior: `Bridge sync emitted from unknown source '${source}'.`,
        probable_cause: "A non-canonical bridge/emitter path is dispatching sync events.",
      });
    }
  }

  if (type === "context_update"){
    if (!event?.contextReady || !hasContext(event?.context)){
      findings.push({
        severity: "BLOCKER",
        classification: "blocker",
        contract_name: "context_update_missing_required_scope",
        contract_type: "Boundary Contracts",
        affected_path: "context",
        expected_behavior: "Context updates must resolve campaignId and officeId before dependent flows execute.",
        observed_behavior: "Context update completed with missing required scope.",
        probable_cause: "Context selector write and context validation are out of sync.",
      });
    }
  }

  if (type === "selector_change"){
    const selectedValue = clean(event?.selectedValue);
    const validOptions = Array.isArray(event?.validOptions)
      ? event.validOptions.map((value) => clean(value)).filter(Boolean)
      : [];
    if (selectedValue && validOptions.length && !validOptions.includes(selectedValue)){
      findings.push({
        severity: "VIOLATION",
        classification: "warning",
        contract_name: "invalid_selector_value",
        contract_type: "Boundary Contracts",
        affected_path: clean(event?.affected_path || "selector.value"),
        expected_behavior: "Selector values should come from canonical option sources only.",
        observed_behavior: `Selected value '${selectedValue}' is outside canonical option set.`,
        probable_cause: "Option population/source-of-truth drift produced stale or non-canonical selector values.",
      });
    }
  }

  if (type === "reset_clone_delete_invariant" && event?.ok === false){
    findings.push({
      severity: "BLOCKER",
      classification: "blocker",
      contract_name: "reset_clone_delete_invariant_failure",
      contract_type: "Boundary Contracts",
      affected_path: clean(event?.affected_path || "state.lifecycle"),
      expected_behavior: "Reset/clone/delete operations must preserve scoped identity and state invariants.",
      observed_behavior: clean(event?.observed_behavior) || "Lifecycle invariant check failed.",
      probable_cause: clean(event?.probable_cause) || "Lifecycle mutation path bypassed invariant guards.",
    });
  }

  if (type === "persistence_identity_check" && event?.identityOk === false){
    findings.push({
      severity: "VIOLATION",
      classification: "warning",
      contract_name: "persisted_rehydrated_identity_violation",
      contract_type: "Boundary Contracts",
      affected_path: clean(event?.affected_path || "state.identity"),
      expected_behavior: "Persisted and rehydrated state should preserve campaign/office/scenario identity.",
      observed_behavior: clean(event?.observed_behavior) || "Persisted/rehydrated identity mismatch detected.",
      probable_cause: clean(event?.probable_cause) || "Rehydration or storage key scoping drifted from canonical context path.",
    });
  }

  if (type === "state_rehydrated"){
    const previous = runtime?.lastContext || {};
    const next = event?.context || {};
    const campaignChanged = clean(previous?.campaignId) && clean(next?.campaignId) && clean(previous?.campaignId) !== clean(next?.campaignId);
    const officeChanged = clean(previous?.officeId) && clean(next?.officeId) && clean(previous?.officeId) !== clean(next?.officeId);
    if ((campaignChanged || officeChanged) && !clean(event?.action_name).includes("context")){
      findings.push({
        severity: "VIOLATION",
        classification: "warning",
        contract_name: "state_rehydration_scope_change_without_context_action",
        contract_type: "Boundary Contracts",
        affected_path: "state.scope",
        expected_behavior: "Scope-changing rehydration should happen only through explicit context-switch actions.",
        observed_behavior: "Rehydration changed campaign/office scope without explicit context action labeling.",
        probable_cause: "Hidden bridge or legacy callback is mutating scoped state outside canonical context flow.",
      });
    }
  }

  return findings;
}
