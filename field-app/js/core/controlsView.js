// @ts-check

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
