// @ts-check
import {
  computeIntelIntegrityScore,
  listMissingEvidenceAudit,
  listMissingNoteAudit,
} from "./intelControlsRuntime.js";
import { resolveFeatureFlags } from "../core/featureFlags.js";
import { formatFixedNumber, formatPercentFromUnit, formatWholeNumber } from "../core/utils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

/**
 * @param {string[]} lines
 * @param {string} label
 * @param {string} detail
 */
function pushGuidance(lines, label, detail) {
  if (!cleanText(detail)) return;
  lines.push(`${label}: ${detail}`);
}

/**
 * @param {Record<string, any>} tw
 * @returns {{ level: "OK"|"WARN"|"BAD", summary: string, why: string, next: string }}
 */
function assessOperationsStatus(tw) {
  if (!tw?.available) {
    return {
      level: "BAD",
      summary: `Operations telemetry unavailable (${cleanText(tw?.error) || "not initialized"}).`,
      why: "Without operations telemetry, execution assumptions can drift away from observed field reality.",
      next: "Verify operations snapshot initialization, then re-open diagnostics to confirm records and rollups load.",
    };
  }

  const counts = tw?.counts || {};
  const rollups = tw?.rollups || {};
  const production = rollups?.production || {};
  const dedupe = rollups?.dedupe || {};
  const attempts = Number(production?.attempts || 0);
  const convos = Number(production?.convos || 0);
  const supportIds = Number(production?.supportIds || 0);
  const excluded = Number(dedupe?.excludedTurfAttemptRecords || 0);
  const fallback = Number(dedupe?.includedFallbackAttempts || 0);
  const pipeline = Number(counts?.pipelineRecords || 0);
  const hasSource = cleanText(production?.source) && cleanText(production?.source) !== "—";

  if (!hasSource || (attempts <= 0 && pipeline > 0)) {
    return {
      level: "WARN",
      summary: "Operations rollups are present but production signal is weak or not fully sourced.",
      why: "Low production signal can make pacing and throughput assumptions appear cleaner than observed execution.",
      next: "Check operations source mapping and confirm production rows are flowing before decision updates.",
    };
  }

  if (excluded > 0 && fallback <= 0) {
    return {
      level: "WARN",
      summary: "Dedupe exclusions are active without fallback attempts.",
      why: "Aggressive exclusions without fallback can understate contact volume and distort execution diagnostics.",
      next: "Review dedupe rules and verify fallback handling for excluded turf attempts.",
    };
  }

  return {
    level: "OK",
    summary: `Operations telemetry healthy (${attempts} attempts, ${convos} convos, ${supportIds} support IDs).`,
    why: "Observed operations data is available for grounding execution assumptions.",
    next: "Maintain source integrity and keep weekly production snapshots current.",
  };
}

/**
 * @param {string[]} lines
 * @param {Record<string, any>} tw
 * @returns {string[]}
 */
export function appendOperationsDiagnosticsCore(lines, tw) {
  const out = Array.isArray(lines) ? lines.slice() : [];
  out.push("");
  out.push("[operations diagnostics]");

  const status = assessOperationsStatus(tw);
  out.push(`status: ${status.level} — ${status.summary}`);
  pushGuidance(out, "why this matters", status.why);
  pushGuidance(out, "what to check next", status.next);

  if (!tw?.available) {
    return out;
  }

  const c = tw.counts || {};
  const p = tw.rollups?.production || {};
  const d = tw.rollups?.dedupe || {};
  const whole = (value) => formatWholeNumber(value, "0");
  const fixed2 = (value) => formatFixedNumber(value, 2, "0.00");

  out.push("evidence:");
  out.push(`- records: persons=${whole(c.persons || 0)} pipeline=${whole(c.pipelineRecords || 0)} shifts=${whole(c.shiftRecords || 0)} turf=${whole(c.turfEvents || 0)}`);
  out.push(`- production: source=${p.source || "—"} attempts=${whole(p.attempts || 0)} convos=${whole(p.convos || 0)} supportIds=${whole(p.supportIds || 0)} hours=${fixed2(p.hours || 0)}`);
  out.push(`- dedupe: rule=${d.rule || "—"} excludedRecords=${whole(d.excludedTurfAttemptRecords || 0)} excludedAttempts=${whole(d.excludedTurfAttempts || 0)} fallbackIncluded=${whole(d.includedFallbackAttempts || 0)}`);
  return out;
}

/**
 * @param {{
 *   benchmarkWarnings: string[],
 *   missingEvidence: number,
 *   missingNote: number,
 *   integrityScore: number,
 *   driftFlags: string[],
 * }} input
 * @returns {{ level: "OK"|"WARN"|"BAD", summary: string, why: string, next: string }}
 */
function assessModelStatus({ benchmarkWarnings, missingEvidence, missingNote, integrityScore, driftFlags }) {
  const warningCount = Number(benchmarkWarnings?.length || 0);
  const driftCount = Number(driftFlags?.length || 0);
  const missingTotal = Number(missingEvidence || 0) + Number(missingNote || 0);

  if (integrityScore < 60 || missingTotal >= 4) {
    return {
      level: "BAD",
      summary: "Integrity posture is degraded by missing governance support or low confidence score.",
      why: "When governance evidence is incomplete, confidence language and strategic interpretation become unreliable.",
      next: "Close missing evidence/note items first, then rerun diagnostics before escalation or external reporting.",
    };
  }

  if (warningCount > 0 || missingTotal > 0 || driftCount > 0 || integrityScore < 80) {
    return {
      level: "WARN",
      summary: "Model posture is usable but has unresolved caveats that should narrow interpretation.",
      why: "Open caveats can exaggerate certainty and cause overreaction to short-cycle movement.",
      next: "Resolve top warnings and confirm drift interpretation before acting on aggressive scenarios.",
    };
  }

  return {
    level: "OK",
    summary: "Model posture is coherent with current governance, benchmark, and drift signals.",
    why: "Aligned diagnostics improve trust in decision framing and reduce noise-driven pivots.",
    next: "Maintain cadence: keep evidence current and continue weekly diagnostics refresh.",
  };
}

/**
 * @param {string[]} lines
 * @param {{
 *   engine: Record<string, any>,
 *   state: Record<string, any>,
 *   computeRealityDrift: () => Record<string, any>,
 *   bootStatus?: Record<string, any> | null,
 *   bootTrace?: Array<Record<string, any>>,
 * }} args
 * @returns {string[]}
 */
export function appendModelDiagnosticsCore(lines, {
  engine,
  state,
  computeRealityDrift,
  bootStatus = null,
  bootTrace = [],
}) {
  const out = Array.isArray(lines) ? lines.slice() : [];
  const fPct = (v) => formatPercentFromUnit(v, 1);

  out.push("");
  out.push("[model diagnostics]");

  const benchmarkWarnings = engine?.snapshot?.computeAssumptionBenchmarkWarnings
    ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
    : [];

  const intel = state?.intelState || {};
  const features = resolveFeatureFlags(state || {});
  const audit = Array.isArray(intel.audit) ? intel.audit : [];
  const evidence = Array.isArray(intel.evidence) ? intel.evidence : [];
  const intelRequests = Array.isArray(intel.intelRequests) ? intel.intelRequests : [];
  const missingEvidence = listMissingEvidenceAudit(state, { limit: 2000 }).length;
  const missingNote = listMissingNoteAudit(state, { limit: 2000 }).length;
  const drift = computeRealityDrift();
  const driftFlags = Array.isArray(drift?.flags) ? drift.flags : [];
  const integrity = computeIntelIntegrityScore(state, {
    benchmarkWarnings,
    driftFlags,
    staleDays: 30,
  });

  const modelStatus = assessModelStatus({
    benchmarkWarnings,
    missingEvidence,
    missingNote,
    integrityScore: Number(integrity?.score || 0),
    driftFlags,
  });
  out.push(`status: ${modelStatus.level} — ${modelStatus.summary}`);
  pushGuidance(out, "why this matters", modelStatus.why);
  pushGuidance(out, "what to check next", modelStatus.next);

  out.push("governance + integrity:");
  out.push(`- benchmarkWarnings=${benchmarkWarnings.length}`);
  for (const msg of benchmarkWarnings.slice(0, 4)) {
    out.push(`  - ${msg}`);
  }
  out.push(`- auditEntries=${audit.length} evidenceRecords=${evidence.length} intelRequests=${intelRequests.length}`);
  out.push(`- missingEvidence=${missingEvidence} missingNote=${missingNote}`);
  out.push(`- integrityScore=${integrity.score} grade=${integrity.grade}`);
  out.push(`- integrityPenalties: evidence=${integrity.penalties.missingEvidence} note=${integrity.penalties.missingNote} benchmark=${integrity.penalties.benchmarkWarnings} stale=${integrity.penalties.staleEvidence} drift=${integrity.penalties.driftFlags}`);

  out.push("feature posture:");
  out.push(`- turnout=${features.turnoutModelingEnabled ? "on" : "off"} timeline=${features.timelineEnabled ? "on" : "off"} universe=${features.universeWeightingEnabled ? "on" : "off"}`);
  out.push(`- mcDistribution=${features.mcDistribution} correlatedShocks=${features.correlatedShocks ? "on" : "off"} shockScenarios=${features.shockScenariosEnabled ? "on" : "off"} capacityDecay=${features.capacityDecayEnabled ? "on" : "off"}`);

  const bootState = bootStatus && typeof bootStatus === "object" ? bootStatus : null;
  if (bootState) {
    out.push("runtime boot:");
    out.push(`- status=${String(bootState.status || "unknown")}`);
    const bootSource = cleanText(bootState.source);
    const bootWhen = cleanText(bootState.t);
    if (bootSource || bootWhen) {
      out.push(`- source=${bootSource || "—"} when=${bootWhen || "—"}`);
    }
  }

  const traceRows = Array.isArray(bootTrace) ? bootTrace.slice(0, 6) : [];
  if (traceRows.length) {
    out.push("boot trace (recent):");
    for (const row of traceRows) {
      const when = cleanText(row?.t) || "—";
      const step = cleanText(row?.step) || "unknown";
      const phase = cleanText(row?.phase);
      const level = cleanText(row?.level);
      const message = cleanText(row?.message);
      const suffix = [phase, level, message].filter(Boolean).join(" ");
      out.push(`- ${when} ${step}${suffix ? ` (${suffix})` : ""}`);
    }
  }

  out.push("reality drift:");
  if (!drift?.hasLog) {
    out.push("- no daily log data");
    return out;
  }

  out.push(`- rollingCR: actual=${fPct(drift.actualCR)} assumed=${fPct(drift.assumedCR)}`);
  out.push(`- rollingSR: actual=${fPct(drift.actualSR)} assumed=${fPct(drift.assumedSR)}`);
  out.push(`- rollingAPH: actual=${formatFixedNumber(drift.actualAPH, 2)} assumed=${formatFixedNumber(drift.expectedAPH, 2)}`);
  out.push(`- driftFlags: ${driftFlags.length ? driftFlags.join(", ") : "none"}`);
  out.push(`- primaryDrift: ${drift.primary || "none"}`);

  return out;
}

