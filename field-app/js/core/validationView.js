// @ts-check

import {
  buildCensusPaceFeasibilitySnapshot,
  evaluateCensusDependencyHealth,
  evaluateFootprintFeasibility,
  evaluateResolutionContract,
} from "./censusModule.js";
import { buildDriftValidationChecklist, buildGovernanceValidationChecklist } from "./modelGovernance.js";
import { formatFixedNumber } from "./utils.js";

function formatValidationNumber(value, digits = 1){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return "—";
  }
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return formatFixedNumber(n, places, "—");
}

function normalizeValidationKind(kind){
  if (kind === "bad") return "bad";
  if (kind === "warn") return "warn";
  return "ok";
}

function dedupeValidationRows(rows){
  const seen = new Set();
  const deduped = [];
  for (const row of rows || []){
    const kind = normalizeValidationKind(row?.kind);
    const text = String(row?.text || "");
    if (!text) continue;
    const key = `${kind}::${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ kind, text });
  }
  return deduped;
}

/**
 * @param {{
 *   state?: Record<string, any> | null,
 *   res?: Record<string, any> | null,
 *   weeks?: unknown,
 *   benchmarkWarnings?: unknown[],
 *   evidenceWarnings?: unknown[],
 *   driftSummary?: Record<string, any> | null,
 *   governance?: Record<string, any> | null,
 *   footprint?: Record<string, any> | null,
 *   resolutionContract?: Record<string, any> | null,
 *   dependencyHealth?: Record<string, any> | null,
 *   censusPaceSnapshot?: Record<string, any> | null,
 * }} args
 */
export function buildValidationChecklistView(args = {}){
  const state = (args?.state && typeof args.state === "object") ? args.state : {};
  const res = (args?.res && typeof args.res === "object") ? args.res : {};
  const validation = (res?.validation && typeof res.validation === "object") ? res.validation : {};
  const items = [];

  const uOk = !!validation.universeOk;
  items.push({
    kind: uOk ? "ok" : "bad",
    text: uOk ? "Universe size set." : "Universe size missing or invalid.",
  });

  const turnoutOk = !!validation.turnoutOk;
  items.push({
    kind: turnoutOk ? "ok" : "warn",
    text: turnoutOk
      ? "Turnout baseline set (2 cycles + band)."
      : "Turnout baseline incomplete. Add Cycle A and Cycle B turnout %.",
  });

  const candOk = !!validation.candidateTableOk;
  items.push({
    kind: candOk ? "ok" : "bad",
    text: candOk
      ? "Candidate + undecided totals = 100%."
      : "Candidate + undecided totals must equal 100%.",
  });

  if (state?.undecidedMode === "user_defined"){
    const splitOk = !!validation.userSplitOk;
    items.push({
      kind: splitOk ? "ok" : "bad",
      text: splitOk
        ? "User-defined undecided split totals = 100%."
        : "User-defined undecided split must total 100% across candidates.",
    });
  }

  const persuasionOk = !!validation.persuasionOk;
  items.push({
    kind: persuasionOk ? "ok" : "warn",
    text: persuasionOk ? "Persuasion % set." : "Persuasion % missing.",
  });

  if (args?.weeks != null){
    items.push({
      kind: "ok",
      text: `Weeks remaining: ${args.weeks} (reference for later phases).`,
    });
  }

  const resolutionContract = (args?.resolutionContract && typeof args.resolutionContract === "object")
    ? args.resolutionContract
    : evaluateResolutionContract();
  if (!resolutionContract?.ok){
    const issueIds = Array.from(new Set([
      ...(Array.isArray(resolutionContract?.missingInOptions) ? resolutionContract.missingInOptions : []),
      ...(Array.isArray(resolutionContract?.unsupportedByNormalize) ? resolutionContract.unsupportedByNormalize : []),
    ]));
    items.push({
      kind: "bad",
      text: `Census resolution contract mismatch (${issueIds.join(", ")}). Refresh runtime before using Census selectors.`,
    });
  }

  const dependencyHealth = (args?.dependencyHealth && typeof args.dependencyHealth === "object")
    ? args.dependencyHealth
    : evaluateCensusDependencyHealth();
  if (!dependencyHealth?.ok || (Array.isArray(dependencyHealth?.issues) && dependencyHealth.issues.some((issue) => issue?.kind === "warn"))){
    for (const issue of Array.isArray(dependencyHealth?.issues) ? dependencyHealth.issues : []){
      items.push({
        kind: issue?.kind === "bad" ? "bad" : "warn",
        text: String(issue?.text || ""),
      });
    }
  }

  const footprint = (args?.footprint && typeof args.footprint === "object")
    ? args.footprint
    : evaluateFootprintFeasibility({ state, res });
  for (const issue of Array.isArray(footprint?.issues) ? footprint.issues : []){
    items.push({
      kind: issue?.kind === "bad" ? "bad" : "warn",
      text: String(issue?.text || ""),
    });
  }
  if (footprint?.alignment?.footprintDefined && footprint?.alignment?.selectionMatches){
    items.push({
      kind: "ok",
      text: "Census selection matches race footprint.",
    });
  }
  if (footprint?.alignment?.footprintDefined && footprint?.alignment?.provenanceAligned){
    items.push({
      kind: "ok",
      text: "Assumption provenance aligned with race footprint.",
    });
  }

  const censusPaceSnapshot = (args?.censusPaceSnapshot && typeof args.censusPaceSnapshot === "object")
    ? args.censusPaceSnapshot
    : buildCensusPaceFeasibilitySnapshot({
        state,
        needVotes: res?.expected?.persuasionNeed,
        weeks: state?.weeksRemaining,
      });
  if (censusPaceSnapshot?.hasRows){
    const pace = censusPaceSnapshot?.pace;
    if (pace?.ready){
      const required = formatValidationNumber(pace.requiredAph);
      const sourceTag = censusPaceSnapshot?.applyMultipliers ? " (Census-adjusted assumptions ON)" : "";
      if (pace?.availableAphRange){
        const low = formatValidationNumber(pace.availableAphRange.low);
        const mid = formatValidationNumber(pace.availableAphRange.mid);
        const high = formatValidationNumber(pace.availableAphRange.high);
        if (pace?.severity === "bad"){
          items.push({
            kind: "bad",
            text: `Census APH feasibility${sourceTag}: required ${required} is above high achievable ${high} (band ${low}/${mid}/${high}).`,
          });
        } else if (pace?.severity === "warn"){
          items.push({
            kind: "warn",
            text: `Census APH feasibility${sourceTag}: required ${required} is near high achievable ${high} (band ${low}/${mid}/${high}).`,
          });
        } else {
          items.push({
            kind: "ok",
            text: `Census APH feasibility${sourceTag}: required ${required} is inside achievable band ${low}/${mid}/${high}.`,
          });
        }
      } else {
        const available = formatValidationNumber(pace?.availableAph);
        items.push({
          kind: pace?.severity === "bad" ? "bad" : (pace?.severity === "warn" ? "warn" : "ok"),
          text: `Census APH feasibility${sourceTag}: required ${required} vs adjusted ${available}.`,
        });
      }
    }
  }

  for (const warning of Array.isArray(args?.benchmarkWarnings) ? args.benchmarkWarnings.slice(0, 4) : []){
    items.push({ kind: "warn", text: String(warning) });
  }
  for (const warning of Array.isArray(args?.evidenceWarnings) ? args.evidenceWarnings.slice(0, 3) : []){
    items.push({ kind: "warn", text: String(warning) });
  }

  for (const row of buildDriftValidationChecklist(args?.driftSummary || null)){
    items.push({
      kind: row?.kind === "warn" ? "warn" : "ok",
      text: String(row?.text || ""),
    });
  }

  if (args?.governance && typeof args.governance === "object"){
    for (const row of buildGovernanceValidationChecklist(args.governance)){
      items.push({
        kind: row?.kind === "bad" ? "bad" : (row?.kind === "warn" ? "warn" : "ok"),
        text: String(row?.text || ""),
      });
    }
  }

  return dedupeValidationRows(items);
}
