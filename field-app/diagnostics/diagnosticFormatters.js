// @ts-check

function clean(value) {
  return String(value == null ? "" : value).trim();
}

/**
 * @param {string} severity
 * @returns {number}
 */
function severityRank(severity) {
  const raw = clean(severity).toUpperCase();
  if (raw === "BLOCKER") return 3;
  if (raw === "VIOLATION") return 2;
  if (raw === "WARNING") return 1;
  return 0;
}

/**
 * @param {Record<string, any>} summary
 * @returns {"OK"|"WARN"|"BAD"}
 */
function summarizePanelStatus(summary) {
  const blockers = Number(summary?.blockers || 0);
  const violations = Number(summary?.violations || 0);
  const warnings = Number(summary?.warnings || 0);
  if (blockers > 0 || violations > 0) return "BAD";
  if (warnings > 0) return "WARN";
  return "OK";
}

/**
 * @param {Record<string, any>} summary
 * @returns {{ why: string, next: string }}
 */
function panelGuidance(summary) {
  const status = summarizePanelStatus(summary);
  if (status === "BAD") {
    return {
      why: "Contract violations/blockers indicate behavior that can break trust in runtime assumptions or outputs.",
      next: "Resolve blocker/violation entries first, then rerun diagnostics before broad surface testing.",
    };
  }
  if (status === "WARN") {
    return {
      why: "Warnings indicate conditions that can become decision-quality issues if left unresolved.",
      next: "Prioritize warnings tied to active module flows and re-check after targeted fixes.",
    };
  }
  return {
    why: "No active contract findings in the recent window.",
    next: "Maintain diagnostics cadence and keep observing new writes/bridges as changes land.",
  };
}

/**
 * @param {Record<string, any>} entry
 * @returns {string}
 */
export function formatDiagnosticEntry(entry) {
  const severity = clean(entry?.severity) || "INFO";
  const contractType = clean(entry?.contract_type) || "Unknown Contracts";
  const contractName = clean(entry?.contract_name) || "unknown_contract";
  const observed = clean(entry?.observed_behavior) || "No observed behavior text.";
  const expected = clean(entry?.expected_behavior);
  const cause = clean(entry?.probable_cause);
  const affected = clean(entry?.affected_path);
  const context = entry?.context || {};
  const contextText = [clean(context.campaignId), clean(context.officeId), clean(context.scenarioId)]
    .filter(Boolean)
    .join("/");
  const suffix = [
    affected ? `path=${affected}` : "",
    contextText ? `ctx=${contextText}` : "",
  ].filter(Boolean).join(" ");
  const detailBits = [
    expected ? `expected: ${expected}` : "",
    cause ? `likely: ${cause}` : "",
  ].filter(Boolean).join(" | ");

  return `[${severity}] ${contractType} :: ${contractName} -> ${observed}${suffix ? ` (${suffix})` : ""}${detailBits ? ` [${detailBits}]` : ""}`;
}

/**
 * @param {Record<string, any>} summary
 * @returns {string[]}
 */
export function formatDiagnosticSummary(summary) {
  const total = Number(summary?.total || 0);
  const blockers = Number(summary?.blockers || 0);
  const violations = Number(summary?.violations || 0);
  const warnings = Number(summary?.warnings || 0);
  const info = Number(summary?.info || 0);
  const runtime = summary?.runtime || {};
  const stateRevision = Number(runtime?.stateRevision || 0);
  const renderRevision = Number(runtime?.renderRevision || 0);
  const pending = runtime?.pendingStateWrite;
  const pendingText = pending
    ? `pending write rev=${Number(pending.revision || 0)} action=${clean(pending.action) || "unknown"}`
    : "pending write: none";
  const status = summarizePanelStatus(summary);
  const guidance = panelGuidance(summary);

  return [
    "[contract diagnostics]",
    `status: ${status}`,
    `entries=${total} blockers=${blockers} violations=${violations} warnings=${warnings} info=${info}`,
    `runtime: stateRev=${stateRevision} renderRev=${renderRevision} bridgeRev=${Number(runtime?.bridgeRevision || 0)}`,
    pendingText,
    `why this matters: ${guidance.why}`,
    `what to check next: ${guidance.next}`,
  ];
}

/**
 * @param {Array<Record<string, any>>} entries
 * @returns {{ blockers: any[], violations: any[], warnings: any[], info: any[] }}
 */
function groupEntries(entries) {
  const groups = {
    blockers: [],
    violations: [],
    warnings: [],
    info: [],
  };
  for (const row of entries) {
    const sev = clean(row?.severity).toUpperCase();
    if (sev === "BLOCKER") groups.blockers.push(row);
    else if (sev === "VIOLATION") groups.violations.push(row);
    else if (sev === "WARNING") groups.warnings.push(row);
    else groups.info.push(row);
  }
  return groups;
}

/**
 * @param {{
 *   summary: Record<string, any>,
 *   entries: Array<Record<string, any>>,
 *   maxEntries?: number,
 * }} args
 * @returns {string[]}
 */
export function buildDiagnosticPanelLines({ summary, entries, maxEntries = 12 }) {
  const lines = formatDiagnosticSummary(summary || {});
  const rows = Array.isArray(entries) ? entries.slice() : [];
  if (!rows.length) {
    lines.push("recent findings: none recorded");
    return lines;
  }

  const sorted = rows
    .slice()
    .sort((a, b) => severityRank(b?.severity) - severityRank(a?.severity))
    .slice(0, Math.max(0, Number(maxEntries) || 0));
  const grouped = groupEntries(sorted);

  lines.push("recent findings (grouped):");
  if (grouped.blockers.length) {
    lines.push(`- BLOCKERS (${grouped.blockers.length})`);
    grouped.blockers.forEach((entry) => lines.push(`  - ${formatDiagnosticEntry(entry)}`));
  }
  if (grouped.violations.length) {
    lines.push(`- VIOLATIONS (${grouped.violations.length})`);
    grouped.violations.forEach((entry) => lines.push(`  - ${formatDiagnosticEntry(entry)}`));
  }
  if (grouped.warnings.length) {
    lines.push(`- WARNINGS (${grouped.warnings.length})`);
    grouped.warnings.forEach((entry) => lines.push(`  - ${formatDiagnosticEntry(entry)}`));
  }
  if (!grouped.blockers.length && !grouped.violations.length && !grouped.warnings.length && grouped.info.length) {
    lines.push(`- INFO (${grouped.info.length})`);
    grouped.info.forEach((entry) => lines.push(`  - ${formatDiagnosticEntry(entry)}`));
  }
  return lines;
}

