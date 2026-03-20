// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim();
}

/**
 * @param {Record<string, any>} entry
 * @returns {string}
 */
export function formatDiagnosticEntry(entry){
  const severity = clean(entry?.severity) || "INFO";
  const contractType = clean(entry?.contract_type) || "Unknown Contracts";
  const contractName = clean(entry?.contract_name) || "unknown_contract";
  const observed = clean(entry?.observed_behavior) || "No observed behavior text.";
  const affected = clean(entry?.affected_path);
  const context = entry?.context || {};
  const contextText = [clean(context.campaignId), clean(context.officeId), clean(context.scenarioId)]
    .filter(Boolean)
    .join("/");
  const suffix = [
    affected ? `path=${affected}` : "",
    contextText ? `ctx=${contextText}` : "",
  ].filter(Boolean).join(" ");
  return `[${severity}] [${contractType}] ${contractName}: ${observed}${suffix ? ` (${suffix})` : ""}`;
}

/**
 * @param {Record<string, any>} summary
 * @returns {string[]}
 */
export function formatDiagnosticSummary(summary){
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

  return [
    "[contract diagnostics]",
    `entries=${total} blockers=${blockers} violations=${violations} warnings=${warnings} info=${info}`,
    `runtime: stateRev=${stateRevision} renderRev=${renderRevision} bridgeRev=${Number(runtime?.bridgeRevision || 0)}`,
    pendingText,
  ];
}

/**
 * @param {{
 *   summary: Record<string, any>,
 *   entries: Array<Record<string, any>>,
 *   maxEntries?: number,
 * }} args
 * @returns {string[]}
 */
export function buildDiagnosticPanelLines({ summary, entries, maxEntries = 12 }){
  const lines = formatDiagnosticSummary(summary || {});
  const rows = Array.isArray(entries) ? entries.slice(0, Math.max(0, Number(maxEntries) || 0)) : [];
  if (!rows.length){
    lines.push("no contract findings recorded");
    return lines;
  }

  lines.push("recent findings:");
  for (const entry of rows){
    lines.push(`- ${formatDiagnosticEntry(entry)}`);
  }
  return lines;
}

