// @ts-check
import { formatFixedNumber, roundWholeNumberByMode } from "./utils.js";

export const CONTROLS_STATUS_AWAITING_REVIEW = "Awaiting review";

/**
 * @param {string} text
 * @returns {number}
 */
function parseLeadingCount(text){
  const match = String(text || "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {{ observed: number, recommendations: number, whatIf: number }}
 */
function intelCounts(intel){
  const src = intel && typeof intel === "object" ? intel : {};
  return {
    observed: Array.isArray(src.observedMetrics) ? src.observedMetrics.length : 0,
    recommendations: Array.isArray(src.recommendations) ? src.recommendations.length : 0,
    whatIf: Array.isArray(src.intelRequests) ? src.intelRequests.length : 0,
  };
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildObservedCountText(intel){
  const { observed } = intelCounts(intel);
  return observed > 0 ? `${observed} observed metric entries captured.` : "0 observed metric entries captured.";
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildRecommendationCountText(intel){
  const { recommendations } = intelCounts(intel);
  return recommendations > 0 ? `${recommendations} active drift recommendations.` : "0 active drift recommendations.";
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildObservedStatusText(intel){
  const { observed } = intelCounts(intel);
  return observed > 0 ? "Observed metrics captured." : "No observed metrics captured yet.";
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildRecommendationStatusText(intel){
  const { recommendations } = intelCounts(intel);
  return recommendations > 0 ? "Drift recommendations ready for review." : "No drift recommendations generated yet.";
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {{ tone: "warn"|"muted", text: string }}
 */
export function buildControlsObservedStatusView(intel){
  const { observed } = intelCounts(intel);
  const baseText = buildObservedStatusText(intel);
  if (observed > 0){
    return { tone: "muted", text: baseText };
  }
  return { tone: "warn", text: `${baseText} Use Capture observed metrics.` };
}

/**
 * @param {{ observedIntel: Record<string, any> | null | undefined, recommendationIntel: Record<string, any> | null | undefined }} inputs
 * @returns {{ tone: "warn"|"ok"|"muted", text: string }}
 */
export function buildControlsRecommendationStatusView(inputs){
  const observedIntel = inputs?.observedIntel;
  const recommendationIntel = inputs?.recommendationIntel;
  const { observed } = intelCounts(observedIntel);
  const { recommendations } = intelCounts(recommendationIntel);
  const baseText = buildRecommendationStatusText(recommendationIntel);
  if (observed <= 0){
    return {
      tone: "warn",
      text: "Capture observed metrics first, then generate drift recommendations.",
    };
  }
  if (recommendations > 0){
    return {
      tone: "ok",
      text: `${baseText} Review before applying assumptions.`,
    };
  }
  return {
    tone: "muted",
    text: baseText,
  };
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildWhatIfCountText(intel){
  const { whatIf } = intelCounts(intel);
  return whatIf > 0 ? `${whatIf} what-if request(s) parsed.` : "0 what-if requests parsed.";
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildWhatIfStatusText(intel){
  const { whatIf } = intelCounts(intel);
  return whatIf > 0 ? "What-if request parsed." : "No what-if requests parsed yet.";
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildWhatIfPreviewTextFromIntel(intel){
  const rows = Array.isArray(intel?.intelRequests) ? intel.intelRequests.slice() : [];
  if (!rows.length){
    return "";
  }
  rows.sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
  const latest = rows[0] || {};
  const summary = String(latest?.summary || "").trim();
  const prompt = String(latest?.prompt || "").trim();
  const status = String(latest?.status || "").trim() || "parsed";
  const lines = [];
  lines.push(`Status: ${status}`);
  if (summary) lines.push(`Summary: ${summary}`);
  if (prompt) lines.push(`Prompt: ${prompt}`);
  return lines.join("\n");
}

/**
 * @param {Record<string, any> | null | undefined} intel
 * @returns {string}
 */
export function buildRecommendationPreviewTextFromIntel(intel){
  const rows = Array.isArray(intel?.recommendations) ? intel.recommendations.slice() : [];
  if (!rows.length){
    return "";
  }
  rows.sort((a, b) => Number(a?.priority ?? 999) - Number(b?.priority ?? 999));
  return rows
    .slice(0, 8)
    .map((row, idx) => {
      const priority = Number.isFinite(Number(row?.priority)) ? `P${Number(row.priority)}` : "P?";
      const title = String(row?.title || `Recommendation ${idx + 1}`).trim();
      const detail = String(row?.detail || "").trim();
      return detail ? `[${priority}] ${title}: ${detail}` : `[${priority}] ${title}`;
    })
    .join("\n");
}

/**
 * @param {number} created
 * @param {number} updated
 * @returns {string}
 */
export function buildControlsObservedCaptureStatus(created, updated){
  const c = asNonNegativeCount(created);
  const u = asNonNegativeCount(updated);
  return `Observed metrics captured (${c} new, ${u} updated).`;
}

/**
 * @param {number} activeCount
 * @returns {string}
 */
export function buildControlsRecommendationRefreshStatus(activeCount){
  const active = asNonNegativeCount(activeCount);
  return active > 0
    ? `Drift recommendations updated (${active} active).`
    : "No active drift recommendations (rolling metrics are within tolerance).";
}

/**
 * @param {number} parsedTargets
 * @param {number} unresolvedSegments
 * @returns {string}
 */
export function buildControlsWhatIfSavedStatus(parsedTargets, unresolvedSegments){
  const parsed = asNonNegativeCount(parsedTargets);
  const unresolved = asNonNegativeCount(unresolvedSegments);
  if (unresolved > 0){
    return `Saved what-if request (${parsed} parsed, ${unresolved} unresolved segment${unresolved === 1 ? "" : "s"}).`;
  }
  return `Saved what-if request (${parsed} parsed target${parsed === 1 ? "" : "s"}).`;
}

/**
 * @returns {string}
 */
export function buildControlsNoActiveRecommendationStatus(){
  return "No active drift recommendation to apply.";
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function asNonNegativeCount(value){
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return roundWholeNumberByMode(n, { mode: "floor", fallback: 0 }) ?? 0;
}

/**
 * @param {unknown} rawValue
 * @returns {number | null}
 */
export function parseControlsOptionalNumber(rawValue){
  const text = String(rawValue || "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatControlsNumber(value){
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "—";
  }
  if (Number.isInteger(n)) return String(n);
  return formatFixedNumber(n, 2, "—");
}

/**
 * @param {unknown} count
 * @param {string} noun
 * @param {string} suffix
 * @returns {string}
 */
export function formatControlsRecordCount(count, noun, suffix){
  const n = Number.isFinite(Number(count)) ? Number(count) : 0;
  const label = n === 1 ? noun : pluralizeControlsNoun(noun);
  return `${n} ${label} ${suffix}.`;
}

/**
 * @param {unknown} iso
 * @param {string=} fallback
 * @returns {string}
 */
export function formatControlsIsoDate(iso, fallback = "—"){
  const text = String(iso || "").trim();
  return text ? text.slice(0, 10) : fallback;
}

/**
 * @param {string} noun
 * @returns {string}
 */
function pluralizeControlsNoun(noun){
  const text = String(noun || "").trim();
  if (!text){
    return "records";
  }
  const parts = text.split(/\s+/);
  const tail = parts.pop() || "";
  const lowerTail = tail.toLowerCase();
  const isConsonantY = lowerTail.endsWith("y") && !/[aeiou]y$/.test(lowerTail);
  const pluralTail = isConsonantY ? `${tail.slice(0, -1)}ies` : `${tail}s`;
  return [...parts, pluralTail].join(" ");
}

/**
 * @param {{ locked: boolean, lockReason: string }} inputs
 * @returns {string}
 */
export function buildControlsScenarioLockStatus(inputs){
  const locked = Boolean(inputs?.locked);
  const reason = String(inputs?.lockReason || "").trim();
  if (!locked){
    return "Scenario lock OFF.";
  }
  return reason ? `Scenario lock ON (${reason}).` : "Scenario lock ON.";
}

/**
 * @param {{ scenarioLocked: boolean, requireCriticalNote: boolean, requireCriticalEvidence: boolean }} inputs
 * @returns {string}
 */
export function buildControlsWorkflowStatus(inputs){
  const lock = Boolean(inputs?.scenarioLocked);
  const requireNote = Boolean(inputs?.requireCriticalNote);
  const requireEvidence = Boolean(inputs?.requireCriticalEvidence);
  if (lock || requireNote || requireEvidence){
    return "Governance controls active.";
  }
  return "Governance controls healthy.";
}

/**
 * @param {{ reference: string }} inputs
 * @returns {string}
 */
export function buildControlsBenchmarkDraftStatus(inputs){
  const reference = String(inputs?.reference || "").trim();
  return reference
    ? "Benchmark ready to save."
    : "Select reference and scope, then save benchmark.";
}

/**
 * @param {{ evidenceRowCount: number, unresolvedAuditCount: number, evidenceTitle: string, evidenceSource: string }} inputs
 * @returns {string}
 */
export function buildControlsEvidenceAttachStatus(inputs){
  const evidenceRows = asNonNegativeCount(inputs?.evidenceRowCount);
  const unresolved = asNonNegativeCount(inputs?.unresolvedAuditCount);
  const title = String(inputs?.evidenceTitle || "").trim();
  const source = String(inputs?.evidenceSource || "").trim();
  if (unresolved === 0){
    return evidenceRows > 0 ? "All critical edits resolved with evidence." : "No unresolved critical edits.";
  }
  if (title && source){
    return "Ready to attach evidence.";
  }
  return "Select an audit item, then attach evidence.";
}

/**
 * @param {number} modelCount
 * @returns {string}
 */
export function buildControlsCorrelationDisabledHint(modelCount){
  const count = asNonNegativeCount(modelCount);
  return count > 0 ? "Correlation models available. Select a model to apply." : "No models yet.";
}

/**
 * @param {{ enabled: boolean, weeklyPct: string }} inputs
 * @returns {string}
 */
export function buildControlsDecayStatus(inputs){
  const enabled = Boolean(inputs?.enabled);
  const weeklyPct = String(inputs?.weeklyPct || "").trim();
  if (!enabled){
    return "Capacity decay OFF.";
  }
  return weeklyPct ? `Capacity decay ON at ${weeklyPct}% weekly.` : "Capacity decay ON.";
}

/**
 * @param {{ enabled: boolean, modelCount: number, selectedModelId: string, selectedModelLabel: string }} inputs
 * @returns {string}
 */
export function buildControlsCorrelationStatus(inputs){
  const enabled = Boolean(inputs?.enabled);
  const count = asNonNegativeCount(inputs?.modelCount);
  const selectedModelId = String(inputs?.selectedModelId || "").trim();
  const selectedModelLabel = String(inputs?.selectedModelLabel || "").trim();
  if (!enabled){
    return count > 0
      ? `Correlation model OFF (${count} model${count === 1 ? "" : "s"} available).`
      : "Correlation model OFF (no models configured).";
  }

  if (count <= 0){
    return "Correlation model ON, but no models are configured.";
  }

  const hasSelection = selectedModelId && selectedModelId.toLowerCase() !== "none";
  if (!hasSelection){
    return `Correlation model ON (${count} model${count === 1 ? "" : "s"} available, select one).`;
  }

  return `Correlation model ON (${selectedModelLabel || selectedModelId}).`;
}

/**
 * @param {number} scenarioCount
 * @returns {string}
 */
export function buildControlsShockScenarioCountText(scenarioCount){
  const count = asNonNegativeCount(scenarioCount);
  return `${count} scenario${count === 1 ? "" : "s"} configured.`;
}

/**
 * @param {{ enabled: boolean, scenarioCount: number }} inputs
 * @returns {string}
 */
export function buildControlsShockStatus(inputs){
  const enabled = Boolean(inputs?.enabled);
  const count = asNonNegativeCount(inputs?.scenarioCount);
  if (!enabled){
    return "Shock scenarios disabled.";
  }
  return count > 0 ? "Shock scenarios enabled and ready." : "Shock scenarios enabled (no scenario set loaded).";
}

/**
 * @param {{ briefKindLabel: string, hasBrief: boolean }} inputs
 * @returns {string}
 */
export function buildControlsCalibrationStatus(inputs){
  const hasBrief = Boolean(inputs?.hasBrief);
  const label = String(inputs?.briefKindLabel || "").trim() || "Calibration";
  return hasBrief ? `${label} brief generated.` : "No calibration brief generated yet.";
}

/**
 * @param {unknown} count
 * @returns {string}
 */
export function buildControlsBenchmarkCountText(count){
  return formatControlsRecordCount(count, "benchmark entry", "configured");
}

/**
 * @param {unknown} count
 * @returns {string}
 */
export function buildControlsMissingEvidenceCountText(count){
  const n = asNonNegativeCount(count);
  if (n > 0){
    return `${n} critical assumption edit(s) missing evidence. Select one below and attach supporting evidence.`;
  }
  return "No critical assumption edits are missing evidence.";
}

/**
 * @param {unknown} count
 * @returns {string}
 */
export function buildControlsMissingNoteCountText(count){
  const n = asNonNegativeCount(count);
  if (n > 0){
    return `${n} critical assumption edit(s) missing note. Add a short note in Evidence notes to resolve.`;
  }
  return "No critical assumption edits are missing notes.";
}

/**
 * @param {{ range?: { min?: unknown, max?: unknown }, severityBands?: { warnAbove?: unknown, hardAbove?: unknown }, source?: { title?: unknown, type?: unknown }, benchmarkKey?: unknown, templateBenchmarkKey?: unknown, raceType?: unknown }} row
 * @returns {{ rangeText: string, severityText: string, sourceText: string, scopeKey: string, scopeSubText: string }}
 */
export function buildControlsBenchmarkTableRowView(row){
  const scopeKey = String(row?.benchmarkKey || row?.templateBenchmarkKey || row?.raceType || "all");
  const scopeSubText = row?.benchmarkKey ? `race: ${String(row?.raceType || "all")}` : "";
  return {
    rangeText: `${formatControlsNumber(row?.range?.min)} .. ${formatControlsNumber(row?.range?.max)}`,
    severityText: `${formatControlsNumber(row?.severityBands?.warnAbove)} / ${formatControlsNumber(row?.severityBands?.hardAbove)}`,
    sourceText: String(row?.source?.title || row?.source?.type || "—"),
    scopeKey,
    scopeSubText,
  };
}

/**
 * @param {Record<string, any> | null | undefined} row
 * @returns {{ value: string, label: string }}
 */
export function buildControlsAuditSelectOption(row){
  const ref = row?.label || row?.ref || row?.key || "critical assumption";
  const ts = formatControlsIsoDate(row?.ts);
  return {
    value: String(row?.id || ""),
    label: `${ts} · ${ref}`,
  };
}

/**
 * @param {Record<string, any> | null | undefined} row
 * @returns {{ title: string, source: string, capturedAt: string, ref: string, id: string }}
 */
export function buildControlsEvidenceRowView(row){
  return {
    title: String(row?.title || "—"),
    source: String(row?.source || "—"),
    capturedAt: formatControlsIsoDate(row?.capturedAt),
    ref: String(row?.ref || "—"),
    id: String(row?.id || "—"),
  };
}

/**
 * @param {unknown} ratio
 * @param {number=} digits
 * @returns {string}
 */
export function formatControlsPercentInputValue(ratio, digits = 1){
  const n = Number(ratio);
  if (!Number.isFinite(n)) return "";
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  const fixed = formatFixedNumber(n * 100, places, "");
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/**
 * @param {{ workflowBaseText: string, integrityScore: unknown, integrityGrade: string, missingEvidenceCount: unknown, missingNoteCount: unknown }} inputs
 * @returns {{ tone: "ok"|"warn"|"bad", text: string }}
 */
export function buildControlsWorkflowIntegrityStatusView(inputs){
  const workflowBaseText = String(inputs?.workflowBaseText || "").trim() || "Governance controls healthy.";
  const score = Number(inputs?.integrityScore);
  const grade = String(inputs?.integrityGrade || "").trim() || "—";
  const missingEvidence = asNonNegativeCount(inputs?.missingEvidenceCount);
  const missingNote = asNonNegativeCount(inputs?.missingNoteCount);
  const scoreText = `Integrity score: ${formatControlsNumber(score)} (${grade}).`;

  if (missingEvidence > 0 || missingNote > 0){
    const parts = [];
    if (missingEvidence > 0) parts.push(`${missingEvidence} missing evidence`);
    if (missingNote > 0) parts.push(`${missingNote} missing note`);
    return {
      tone: Number.isFinite(score) && score < 70 ? "bad" : "warn",
      text: `Open governance items: ${parts.join(", ")}. ${scoreText}`,
    };
  }

  if (Number.isFinite(score) && score >= 85){
    return { tone: "ok", text: `${workflowBaseText}. ${scoreText}` };
  }
  if (Number.isFinite(score) && score >= 70){
    return { tone: "warn", text: `Governance controls mostly healthy. ${scoreText}` };
  }
  return { tone: "bad", text: `Governance attention needed. ${scoreText}` };
}

/**
 * @param {{ enabled: boolean, modelCount: unknown, selectedModelId: string, selectedModelLabel: string }} inputs
 * @returns {{ tone: "ok"|"warn"|"muted", text: string, baseText: string }}
 */
export function buildControlsCorrelationStatusView(inputs){
  const modelCount = asNonNegativeCount(inputs?.modelCount);
  const selectedModelId = String(inputs?.selectedModelId || "").trim();
  const enabled = Boolean(inputs?.enabled);
  const baseText = buildControlsCorrelationStatus({
    enabled,
    modelCount,
    selectedModelId,
    selectedModelLabel: String(inputs?.selectedModelLabel || "").trim(),
  });

  if (modelCount === 0){
    return {
      tone: "warn",
      text: `${baseText}. Add default model or import JSON first.`,
      baseText,
    };
  }

  if (!selectedModelId){
    return {
      tone: enabled ? "warn" : "muted",
      text: enabled
        ? `${baseText}. Choose one of ${modelCount} configured models.`
        : `${baseText}. Select one to prepare correlated shocks.`,
      baseText,
    };
  }

  return {
    tone: enabled ? "ok" : "muted",
    text: enabled
      ? `${baseText}. Re-run Monte Carlo to apply.`
      : `${baseText}. Enable Correlated shocks to apply in Monte Carlo.`,
    baseText,
  };
}

/**
 * @param {{ enabled: boolean, modelCount: unknown, selectedModelId: string, selectedModelLabel: string }} inputs
 * @returns {{ tone: "ok"|"warn"|"muted", text: string }}
 */
export function buildControlsCorrelationHintStatusView(inputs){
  const modelCount = asNonNegativeCount(inputs?.modelCount);
  const selectedModelId = String(inputs?.selectedModelId || "").trim();
  const enabled = Boolean(inputs?.enabled);
  const modelHint = buildControlsCorrelationDisabledHint(modelCount);
  if (modelCount === 0){
    return {
      tone: "warn",
      text: `${modelHint}. Click Add default model or paste JSON and click Import model JSON.`,
    };
  }
  if (!enabled){
    return {
      tone: "muted",
      text: `${modelHint} Enable Correlated shocks to use it in Monte Carlo.`,
    };
  }
  if (!selectedModelId){
    return {
      tone: "warn",
      text: `${buildControlsCorrelationStatus({
        enabled,
        modelCount,
        selectedModelId,
        selectedModelLabel: String(inputs?.selectedModelLabel || "").trim(),
      })}.`,
    };
  }
  return {
    tone: "ok",
    text: "Correlation model is active for the next Monte Carlo run.",
  };
}

/**
 * @param {{ enabled: boolean, weeklyPct: string, modelType: string, floorPct: string }} inputs
 * @returns {{ tone: "ok"|"muted", text: string }}
 */
export function buildControlsDecayStatusView(inputs){
  const enabled = Boolean(inputs?.enabled);
  const weeklyPct = String(inputs?.weeklyPct || "").trim();
  const modelType = String(inputs?.modelType || "linear").trim() || "linear";
  const floorPct = String(inputs?.floorPct || "").trim() || "0";
  const baseText = buildControlsDecayStatus({ enabled, weeklyPct });
  if (!enabled){
    return {
      tone: "muted",
      text: `${baseText} (steady capacity assumption).`,
    };
  }
  return {
    tone: "ok",
    text: `${baseText} (${modelType}, floor ${floorPct}% baseline). Re-run Monte Carlo to apply.`,
  };
}

/**
 * @param {{ enabled: boolean, scenarioCount: unknown }} inputs
 * @returns {{ tone: "ok"|"warn"|"muted", text: string }}
 */
export function buildControlsShockStatusView(inputs){
  const enabled = Boolean(inputs?.enabled);
  const scenarioCount = asNonNegativeCount(inputs?.scenarioCount);
  const baseText = buildControlsShockStatus({ enabled, scenarioCount });
  if (scenarioCount === 0){
    return {
      tone: "warn",
      text: `${baseText}. Add or import one before enabling.`,
    };
  }
  if (enabled){
    return {
      tone: "ok",
      text: `${baseText}. Re-run Monte Carlo to apply.`,
    };
  }
  return {
    tone: "muted",
    text: `${baseText}.`,
  };
}

/**
 * @param {{ briefKindLabel: string, hasBrief: boolean, createdAt: unknown }} inputs
 * @returns {{ tone: "muted", text: string }}
 */
export function buildControlsCalibrationStatusView(inputs){
  const baseText = buildControlsCalibrationStatus({
    briefKindLabel: String(inputs?.briefKindLabel || "").trim(),
    hasBrief: Boolean(inputs?.hasBrief),
  });
  if (inputs?.hasBrief){
    const ts = formatControlsIsoDate(inputs?.createdAt);
    return { tone: "muted", text: `${baseText} Last generated ${ts}.` };
  }
  return { tone: "muted", text: baseText };
}

/**
 * @param {Record<string, any> | null | undefined} recommendation
 * @returns {string}
 */
export function buildControlsApplyTopRecommendationButtonLabel(recommendation){
  if (!recommendation || typeof recommendation !== "object"){
    return "Apply top recommendation";
  }
  const priority = Number(recommendation.priority);
  const priorityText = Number.isFinite(priority) ? `P${priority}` : "top";
  return `Apply ${priorityText} recommendation`;
}

/**
 * @param {Record<string, any> | null | undefined} row
 * @returns {string}
 */
export function formatControlsWhatIfTarget(row){
  const op = String(row?.op || "").trim();
  const label = String(row?.label || row?.key || "assumption");
  const formatSigned = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    if (Number.isInteger(n)) return `${n >= 0 ? "+" : ""}${String(n)}`;
    const fixed = formatFixedNumber(n, 2, "—");
    return `${n >= 0 ? "+" : ""}${fixed}`;
  };
  const formatPlain = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    if (Number.isInteger(n)) return String(n);
    return formatFixedNumber(n, 2, "—");
  };
  if (op === "delta"){
    const n = Number(row?.delta ?? row?.value);
    const value = formatSigned(n);
    return `${label}: ${value}`;
  }
  const n = Number(row?.suggestedValue ?? row?.value);
  const value = formatPlain(n);
  return `${label}: ${value}`;
}

/**
 * @param {Record<string, any> | null | undefined} latestRequest
 * @returns {string}
 */
export function buildControlsWhatIfDetailedPreviewText(latestRequest){
  if (!latestRequest || typeof latestRequest !== "object"){
    return "";
  }
  const targets = Array.isArray(latestRequest?.parsed?.targets) ? latestRequest.parsed.targets : [];
  const unresolved = Array.isArray(latestRequest?.parsed?.unresolvedSegments) ? latestRequest.parsed.unresolvedSegments : [];
  const lines = [
    `Prompt: ${String(latestRequest?.prompt || "")}`,
    `Status: ${String(latestRequest?.status || "parsed")}`,
    `Parsed targets: ${targets.length}`,
  ];
  for (const row of targets.slice(0, 8)){
    lines.push(`- ${formatControlsWhatIfTarget(row)}`);
  }
  if (unresolved.length){
    lines.push(`Unresolved: ${unresolved.length}`);
    for (const row of unresolved.slice(0, 5)){
      lines.push(`- ${String(row?.segment || "segment")} (${String(row?.reason || "unresolved")})`);
    }
  }
  return lines.join("\n");
}

/**
 * @param {{ latestRequest: Record<string, any> | null | undefined, intel: Record<string, any> | null | undefined }} inputs
 * @returns {{ tone: "ok"|"warn"|"muted", text: string }}
 */
export function buildControlsWhatIfStatusView(inputs){
  const latestRequest = inputs?.latestRequest;
  const intel = inputs?.intel;
  if (!latestRequest || typeof latestRequest !== "object"){
    return {
      tone: "muted",
      text: buildWhatIfStatusText(intel),
    };
  }
  if (String(latestRequest?.status || "").trim().toLowerCase() === "partial"){
    const unresolved = asNonNegativeCount(latestRequest?.parsed?.unresolvedCount);
    return {
      tone: "warn",
      text: unresolved
        ? `Latest request parsed with ${unresolved} unresolved segment${unresolved === 1 ? "" : "s"}.`
        : "Latest request parsed with unresolved segments.",
    };
  }
  return {
    tone: "ok",
    text: buildWhatIfStatusText(intel),
  };
}

/**
 * @param {string} lockStatus
 * @param {string} workflowStatus
 * @returns {string}
 */
export function deriveControlsWorkflowCardStatus(lockStatus, workflowStatus){
  const combined = `${lockStatus} ${workflowStatus}`.toLowerCase();
  if (combined.includes("unavailable")){
    return "Unavailable";
  }
  if (combined.includes("lock on")){
    return "Locked";
  }
  if (combined.includes("active")){
    return "Guarded";
  }
  if (combined.includes("healthy")){
    return "Healthy";
  }
  return CONTROLS_STATUS_AWAITING_REVIEW;
}

/**
 * @param {string} missingEvidenceText
 * @param {string} missingNoteText
 * @param {string} evidenceStatus
 * @returns {string}
 */
export function deriveControlsEvidenceCardStatus(missingEvidenceText, missingNoteText, evidenceStatus){
  const missingEvidence = parseLeadingCount(missingEvidenceText);
  const missingNote = parseLeadingCount(missingNoteText);
  const status = String(evidenceStatus || "").toLowerCase();
  if (status.includes("unavailable")){
    return "Unavailable";
  }
  if (missingEvidence > 0 || missingNote > 0){
    return "Needs evidence";
  }
  if (status.includes("ready to attach")){
    return "Ready to attach";
  }
  if (status.includes("resolved") || status.includes("no unresolved")){
    return "Audit clear";
  }
  return "Awaiting audit";
}

/**
 * @param {string} countText
 * @param {string} benchmarkStatus
 * @returns {string}
 */
export function deriveControlsBenchmarkCardStatus(countText, benchmarkStatus){
  const count = parseLeadingCount(countText);
  const status = String(benchmarkStatus || "").toLowerCase();
  if (status.includes("unavailable")){
    return "Unavailable";
  }
  if (count > 0){
    return "Benchmarks set";
  }
  if (status.includes("ready")){
    return "Ready";
  }
  return "Catalog empty";
}

/**
 * @param {string} observedCountText
 * @param {string} recommendationCountText
 * @param {string} recommendationStatus
 * @param {string} whatIfCountText
 * @returns {string}
 */
export function deriveControlsReviewCardStatus(observedCountText, recommendationCountText, recommendationStatus, whatIfCountText){
  const observedCount = parseLeadingCount(observedCountText);
  const recommendationCount = parseLeadingCount(recommendationCountText);
  const whatIfCount = parseLeadingCount(whatIfCountText);
  const recommendation = String(recommendationStatus || "").toLowerCase();
  if (recommendation.includes("unavailable")){
    return "Unavailable";
  }
  if (recommendationCount > 0){
    return "Review ready";
  }
  if (observedCount > 0){
    return "Observed captured";
  }
  if (whatIfCount > 0){
    return "Parser active";
  }
  return "Awaiting feedback";
}

/**
 * @param {string} calibrationStatus
 * @param {string} correlationStatus
 * @param {string} shockStatus
 * @param {string} decayStatus
 * @returns {string}
 */
export function deriveControlsIntegrityCardStatus(calibrationStatus, correlationStatus, shockStatus, decayStatus){
  const calibration = String(calibrationStatus || "").toLowerCase();
  const correlation = String(correlationStatus || "").toLowerCase();
  const shock = String(shockStatus || "").toLowerCase();
  const decay = String(decayStatus || "").toLowerCase();
  const combined = `${calibration} ${correlation} ${shock} ${decay}`;
  if (combined.includes("unavailable")){
    return "Unavailable";
  }
  if (calibration.includes("generated")){
    return "Brief ready";
  }
  if (correlation.includes(" on") || shock.includes("enabled") || decay.includes(" on")){
    return "Sim ready";
  }
  return "Needs brief";
}

/**
 * @param {string} missingEvidenceText
 * @param {string} missingNoteText
 * @param {string} recommendationCountText
 * @param {string} workflowStatus
 * @returns {string}
 */
export function deriveControlsWarningsCardStatus(missingEvidenceText, missingNoteText, recommendationCountText, workflowStatus){
  const missingEvidence = parseLeadingCount(missingEvidenceText);
  const missingNote = parseLeadingCount(missingNoteText);
  const recommendationCount = parseLeadingCount(recommendationCountText);
  const workflow = String(workflowStatus || "").toLowerCase();
  if (workflow.includes("unavailable")){
    return "Unavailable";
  }
  if (missingEvidence > 0 || missingNote > 0){
    return "Action needed";
  }
  if (recommendationCount > 0 || workflow.includes("active")){
    return "Watchlist";
  }
  return "Quiet";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyControlsStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(healthy|audit clear|benchmarks set|review ready|brief ready|sim ready|quiet|ready$)/.test(lower)){
    return "ok";
  }
  if (/(unavailable|needs evidence|action needed|failed|broken)/.test(lower)){
    return "bad";
  }
  if (/(locked|guarded|watchlist|awaiting|needs brief|catalog empty|parser active|observed captured|ready to attach)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
