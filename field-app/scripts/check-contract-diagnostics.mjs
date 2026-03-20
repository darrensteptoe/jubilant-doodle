#!/usr/bin/env node
import { createDiagnosticEngine } from "../diagnostics/diagnosticEngine.js";
import { createDiagnosticStore } from "../diagnostics/diagnosticStore.js";

function assert(condition, message){
  if (!condition){
    throw new Error(message);
  }
}

function collectNames(entries){
  return new Set(entries.map((entry) => String(entry?.contract_name || "")));
}

function main(){
  const store = createDiagnosticStore({ maxEntries: 200 });
  const engine = createDiagnosticEngine({ store });

  engine.observe({
    type: "state_write",
    action_name: "setState",
    changedTopLevel: ["campaignId"],
    changedPaths: ["state.campaignId"],
    context: { campaignId: "il-hd-21", officeId: "west", scenarioId: "baseline" },
  });

  engine.observe({
    type: "commit_ui_update",
    action_name: "commitUIUpdate",
    doRender: false,
    doPersist: true,
    context: { campaignId: "il-hd-21", officeId: "west", scenarioId: "baseline" },
  });

  engine.observe({
    type: "report_composed",
    action_name: "dataBridgeComposeReport",
    reportType: "client",
    context: { campaignId: "il-hd-21", officeId: "west", scenarioId: "baseline" },
    reportContext: { campaignId: "il-hd-21", officeId: "east", scenarioId: "baseline" },
    reportHasCanonicalSnapshot: false,
    reportHasValidation: false,
    reportHasRealism: false,
  });

  const entries = engine.listEntries({ limit: 100 });
  const names = collectNames(entries);
  assert(names.has("set_state_outside_ui_scope"), "missing set_state_outside_ui_scope finding");
  assert(names.has("recompute_missing_after_state_change"), "missing recompute_missing_after_state_change finding");
  assert(names.has("report_context_scope_mismatch"), "missing report_context_scope_mismatch finding");

  const summary = engine.summary();
  assert(Number(summary.total) >= 3, "expected at least 3 diagnostics entries");
  process.stdout.write(
    `contracts-diagnostics-check: ok entries=${summary.total} blockers=${summary.blockers} violations=${summary.violations} warnings=${summary.warnings} info=${summary.info}\n`
  );
}

try{
  main();
} catch (err){
  const message = err?.message ? String(err.message) : String(err || "unknown error");
  process.stderr.write(`contracts-diagnostics-check: fail ${message}\n`);
  process.exit(1);
}

