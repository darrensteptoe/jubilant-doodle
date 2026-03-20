// @ts-check
import { clampFiniteNumber, formatFixedNumber } from "../core/utils.js";
import { VALIDATION_DOMAIN_META } from "./validationRules.js";

const SEVERITY_WEIGHT = Object.freeze({
  blocker: 30,
  critical: 16,
  warning: 8,
  advisory: 3,
});

const DOMAIN_ORDER = Object.freeze([
  "campaignContext",
  "targetUniverse",
  "workforce",
  "contactProgram",
  "budgetCost",
  "assumptions",
  "reporting",
  "resultsAudit",
  "scenarios",
  "eventsCalendar",
]);

function normalizeSeverity(value){
  const text = String(value || "").trim().toLowerCase();
  if (text === "blocker" || text === "critical" || text === "warning" || text === "advisory"){
    return text;
  }
  return "advisory";
}

function normalizeDomain(value){
  const key = String(value || "").trim();
  return DOMAIN_ORDER.includes(key) ? key : "assumptions";
}

function severityRank(value){
  if (value === "blocker") return 4;
  if (value === "critical") return 3;
  if (value === "warning") return 2;
  return 1;
}

function deriveReadinessBand({ score = 0, blockerCount = 0, criticalCount = 0 } = {}){
  if (blockerCount > 0) return "blocked";
  if (score >= 85 && criticalCount === 0) return "ready";
  if (score >= 70) return "watch";
  if (score >= 50) return "fragile";
  return "blocked";
}

function moduleStatusFromIssues(issues = []){
  const severities = issues.map((row) => normalizeSeverity(row?.severity));
  if (severities.includes("blocker")) return "blocked";
  if (severities.includes("critical") || severities.includes("warning")) return "degraded";
  return "ok";
}

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {{ issues?: AnyRecord[] }} args
 */
export function computeModelReadiness({ issues = [] } = {}){
  const source = Array.isArray(issues) ? issues : [];
  /** @type {AnyRecord[]} */
  const normalized = source.map((row) => ({
    ...row,
    domain: normalizeDomain(row?.domain),
    severity: normalizeSeverity(row?.severity),
  }));

  const counts = {
    blocker: 0,
    critical: 0,
    warning: 0,
    advisory: 0,
  };

  let penalty = 0;
  for (const row of normalized){
    counts[row.severity] += 1;
    penalty += Number(SEVERITY_WEIGHT[row.severity] || 0);
  }
  const score = clampFiniteNumber(100 - penalty, 0, 100);
  const band = deriveReadinessBand({
    score,
    blockerCount: counts.blocker,
    criticalCount: counts.critical,
  });

  const groupedIssues = {};
  const moduleState = {};
  for (const domain of DOMAIN_ORDER){
    groupedIssues[domain] = {
      domain,
      title: String(VALIDATION_DOMAIN_META?.[domain]?.title || domain),
      issues: [],
    };
    moduleState[domain] = "ok";
  }

  for (const row of normalized){
    const domain = row.domain;
    groupedIssues[domain].issues.push(row);
  }

  for (const domain of DOMAIN_ORDER){
    const rows = groupedIssues[domain].issues;
    rows.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    moduleState[domain] = moduleStatusFromIssues(rows);
  }

  const sortedIssues = [...normalized].sort((a, b) => {
    const rank = severityRank(b.severity) - severityRank(a.severity);
    if (rank !== 0) return rank;
    return String(a?.issueId || "").localeCompare(String(b?.issueId || ""));
  });

  return {
    score,
    scoreText: formatFixedNumber(score, 0, "0"),
    band,
    counts,
    groupedIssues,
    moduleState,
    issues: sortedIssues,
  };
}

/**
 * @param {AnyRecord | null | undefined} readiness
 * @param {{ maxIssues?: number }=} options
 */
export function buildModelReadinessValidationRows(readiness, { maxIssues = 4 } = {}){
  const src = readiness && typeof readiness === "object" ? readiness : null;
  if (!src) return [];

  const rows = [];
  const band = String(src.band || "unknown");
  const scoreText = formatFixedNumber(src.score, 0, "—");
  rows.push({
    kind: band === "blocked" ? "bad" : (band === "fragile" ? "warn" : "ok"),
    text: `Model readiness: ${band} (${scoreText}/100).`,
  });

  const issues = Array.isArray(src.issues) ? src.issues : [];
  for (const row of issues.slice(0, Math.max(0, maxIssues))){
    const severity = normalizeSeverity(row?.severity);
    const kind = severity === "blocker" ? "bad" : (severity === "critical" || severity === "warning" ? "warn" : "ok");
    const msg = String(row?.message || row?.title || "").trim();
    if (!msg) continue;
    const fixPath = String(row?.fixPath || "").trim();
    const full = fixPath ? `${msg} Fix: ${fixPath}.` : msg;
    rows.push({ kind, text: full });
  }

  return rows;
}
