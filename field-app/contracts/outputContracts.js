// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim();
}

function sameScope(lhs, rhs){
  return clean(lhs?.campaignId) === clean(rhs?.campaignId)
    && clean(lhs?.officeId) === clean(rhs?.officeId)
    && clean(lhs?.scenarioId) === clean(rhs?.scenarioId);
}

/**
 * @param {Record<string, any>} event
 * @param {Record<string, any>} runtime
 * @returns {Array<Record<string, any>>}
 */
export function evaluateOutputContracts(event, runtime = {}){
  const findings = [];
  const type = clean(event?.type);

  if (type === "render_complete" && runtime?.pendingStateWrite){
    findings.push({
      severity: "VIOLATION",
      classification: "warning",
      contract_name: "stale_render_after_pending_state_write",
      contract_type: "Render Contracts",
      affected_path: "render",
      expected_behavior: "Render completion should close the pending state write lifecycle cleanly.",
      observed_behavior: "Render completion observed while pending write marker still exists.",
      probable_cause: "Render lifecycle bookkeeping is out of order and can leave stale values in view consumers.",
    });
  }

  if (type !== "report_composed" && type !== "report_exported"){
    return findings;
  }

  const context = event?.context || {};
  const reportContext = event?.reportContext || {};
  if (!sameScope(context, reportContext)){
    findings.push({
      severity: "VIOLATION",
      classification: "warning",
      contract_name: "report_context_scope_mismatch",
      contract_type: "Output Contracts",
      affected_path: "report.context",
      expected_behavior: "Report scope must match active campaign/office/scenario context.",
      observed_behavior: "Report context does not match active runtime context.",
      probable_cause: "Report payload composed/exported from stale or mixed-scope source state.",
    });
  }

  if (type === "report_composed"){
    if (!event?.reportHasCanonicalSnapshot){
      findings.push({
        severity: "WARNING",
        classification: "warning",
        contract_name: "report_missing_canonical_results_snapshot",
        contract_type: "Formula Contracts",
        affected_path: "report.resultsSnapshot",
        expected_behavior: "Reports should be composed from canonical model outputs and snapshots.",
        observed_behavior: "Report composed without canonical results snapshot present.",
        probable_cause: "Report compose ran before canonical compute/snapshot pipeline completed.",
      });
    }
    if (!event?.reportHasValidation || !event?.reportHasRealism){
      findings.push({
        severity: "WARNING",
        classification: "warning",
        contract_name: "report_missing_validation_or_realism_link",
        contract_type: "Output Contracts",
        affected_path: "report.readiness_realism_links",
        expected_behavior: "Report framing should include readiness and realism context when available.",
        observed_behavior: "Report composed without one or more readiness/realism anchors.",
        probable_cause: "Reporting compose path is not fully linked to current diagnostics snapshots.",
      });
    }
  }

  return findings;
}

