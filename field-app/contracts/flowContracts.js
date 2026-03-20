// @ts-check

/**
 * @param {Record<string, any>} event
 * @param {Record<string, any>} runtime
 * @returns {Array<Record<string, any>>}
 */
export function evaluateFlowContracts(event, runtime = {}){
  const findings = [];
  const type = String(event?.type || "");
  const pending = runtime?.pendingStateWrite || null;

  if (type === "state_write" && pending){
    findings.push({
      severity: "WARNING",
      classification: "warning",
      contract_name: "state_write_before_previous_recompute",
      contract_type: "Flow Contracts",
      affected_path: "state.*",
      expected_behavior: "State writes should complete recompute/render flow before another write begins.",
      observed_behavior: `New write started while prior write from ${String(pending.action || "unknown")} is still pending recompute.`,
      probable_cause: "Back-to-back control events are mutating state faster than canonical recompute/render flow is closing.",
    });
  }

  if (type === "commit_ui_update" && pending && event?.doRender !== true){
    findings.push({
      severity: "VIOLATION",
      classification: "warning",
      contract_name: "recompute_missing_after_state_change",
      contract_type: "Flow Contracts",
      affected_path: "commit_ui_update.render",
      expected_behavior: "Critical state changes should schedule render/recompute through commitUIUpdate(render=true).",
      observed_behavior: "commitUIUpdate executed with render disabled while state write was pending.",
      probable_cause: "Handler or bridge path suppressed render and risks stale downstream views.",
    });
  }

  if (type === "bridge_sync" && pending){
    findings.push({
      severity: "WARNING",
      classification: "warning",
      contract_name: "bridge_sync_before_render_completion",
      contract_type: "Flow Contracts",
      affected_path: "bridge_sync",
      expected_behavior: "Bridge sync should follow a completed recompute/render cycle for the triggering state write.",
      observed_behavior: "Bridge sync dispatched while a state write is still pending render completion.",
      probable_cause: "Out-of-order dispatch can create stale reads for bridge consumers.",
    });
  }

  if (event?.requiresValidation === true && event?.validationReady === false){
    findings.push({
      severity: "VIOLATION",
      classification: "warning",
      contract_name: "validation_bypass_on_critical_action",
      contract_type: "Flow Contracts",
      affected_path: "validation.readiness",
      expected_behavior: "Critical actions should not proceed when validation readiness is unavailable or failing.",
      observed_behavior: "Critical action proceeded while validation readiness was false.",
      probable_cause: "Handler path omitted validation gate before executing downstream compute/output actions.",
    });
  }

  return findings;
}
