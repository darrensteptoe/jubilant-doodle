// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiagnosticPanelLines,
  formatDiagnosticEntry,
  formatDiagnosticSummary,
} from "./diagnosticFormatters.js";

test("diagnostic formatters: summary includes status and guidance", () => {
  const lines = formatDiagnosticSummary({
    total: 4,
    blockers: 1,
    violations: 1,
    warnings: 1,
    info: 1,
    runtime: {
      stateRevision: 7,
      renderRevision: 6,
      bridgeRevision: 3,
      pendingStateWrite: { revision: 7, action: "setField" },
    },
  });

  assert.match(lines.join("\n"), /status:\s+BAD/);
  assert.match(lines.join("\n"), /why this matters:/);
  assert.match(lines.join("\n"), /what to check next:/);
  assert.match(lines.join("\n"), /pending write rev=7 action=setField/);
});

test("diagnostic formatters: entry formatting includes expected and cause when present", () => {
  const text = formatDiagnosticEntry({
    severity: "WARNING",
    contract_type: "Flow Contracts",
    contract_name: "render_after_write",
    observed_behavior: "render skipped",
    expected_behavior: "render should run after write",
    probable_cause: "commit path exited early",
    affected_path: "state.domains.campaign",
    context: { campaignId: "c1", officeId: "o1", scenarioId: "s1" },
  });

  assert.match(text, /\[WARNING\]/);
  assert.match(text, /Flow Contracts :: render_after_write/);
  assert.match(text, /expected: render should run after write/);
  assert.match(text, /likely: commit path exited early/);
  assert.match(text, /path=state\.domains\.campaign/);
  assert.match(text, /ctx=c1\/o1\/s1/);
});

test("diagnostic formatters: panel lines group findings by severity", () => {
  const lines = buildDiagnosticPanelLines({
    summary: { total: 3, blockers: 1, violations: 1, warnings: 1, info: 0, runtime: {} },
    entries: [
      { severity: "WARNING", contract_type: "Flow", contract_name: "flow_warn", observed_behavior: "warn case" },
      { severity: "BLOCKER", contract_type: "State", contract_name: "state_block", observed_behavior: "blocker case" },
      { severity: "VIOLATION", contract_type: "Output", contract_name: "output_violation", observed_behavior: "violation case" },
    ],
    maxEntries: 10,
  });

  const text = lines.join("\n");
  assert.match(text, /recent findings \(grouped\):/);
  assert.match(text, /- BLOCKERS \(1\)/);
  assert.match(text, /- VIOLATIONS \(1\)/);
  assert.match(text, /- WARNINGS \(1\)/);
});

test("diagnostic formatters: panel lines report empty findings safely", () => {
  const lines = buildDiagnosticPanelLines({
    summary: { total: 0, blockers: 0, violations: 0, warnings: 0, info: 0, runtime: {} },
    entries: [],
    maxEntries: 5,
  });
  assert.match(lines.join("\n"), /recent findings: none recorded/);
});

