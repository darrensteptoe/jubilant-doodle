// @ts-check
import {
  computeIntelIntegrityScore,
  listMissingEvidenceAudit,
  listMissingNoteAudit,
} from "./intelControlsRuntime.js";
import { resolveFeatureFlags } from "../core/featureFlags.js";
import { formatFixedNumber, formatPercentFromUnit, formatWholeNumber } from "../core/utils.js";

/**
 * @param {string[]} lines
 * @param {Record<string, any>} tw
 * @returns {string[]}
 */
export function appendOperationsDiagnosticsCore(lines, tw){
  const out = Array.isArray(lines) ? lines.slice() : [];
  out.push("");
  out.push("[operations diagnostics]");
  if (!tw?.available){
    out.push(`status: unavailable (${tw?.error || "not initialized"})`);
    return out;
  }

  const c = tw.counts || {};
  const p = tw.rollups?.production || {};
  const d = tw.rollups?.dedupe || {};
  const whole = (value) => formatWholeNumber(value, "0");
  const fixed2 = (value) => formatFixedNumber(value, 2, "0.00");

  out.push(`records: persons=${whole(c.persons || 0)} pipeline=${whole(c.pipelineRecords || 0)} shifts=${whole(c.shiftRecords || 0)} turf=${whole(c.turfEvents || 0)}`);
  out.push(`productionSource: ${p.source || "—"}`);
  out.push(`productionTotals: attempts=${whole(p.attempts || 0)} convos=${whole(p.convos || 0)} supportIds=${whole(p.supportIds || 0)} hours=${fixed2(p.hours || 0)}`);
  out.push(`dedupeRule: ${d.rule || "—"}`);
  out.push(`dedupe: excludedTurfRecords=${whole(d.excludedTurfAttemptRecords || 0)} excludedTurfAttempts=${whole(d.excludedTurfAttempts || 0)} fallbackIncluded=${whole(d.includedFallbackAttempts || 0)}`);
  return out;
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
}){
  const out = Array.isArray(lines) ? lines.slice() : [];
  const fPct = (v) => formatPercentFromUnit(v, 1);

  out.push("");
  out.push("[model diagnostics]");

  const benchmarkWarnings = engine?.snapshot?.computeAssumptionBenchmarkWarnings
    ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
    : [];
  out.push(`benchmarkWarnings: ${benchmarkWarnings.length}`);
  for (const msg of benchmarkWarnings.slice(0, 4)){
    out.push(`- ${msg}`);
  }

  const intel = state?.intelState || {};
  const features = resolveFeatureFlags(state || {});
  const audit = Array.isArray(intel.audit) ? intel.audit : [];
  const evidence = Array.isArray(intel.evidence) ? intel.evidence : [];
  const intelRequests = Array.isArray(intel.intelRequests) ? intel.intelRequests : [];
  const missingEvidence = listMissingEvidenceAudit(state, { limit: 2000 }).length;
  const missingNote = listMissingNoteAudit(state, { limit: 2000 }).length;
  const drift = computeRealityDrift();
  const integrity = computeIntelIntegrityScore(state, {
    benchmarkWarnings,
    driftFlags: Array.isArray(drift?.flags) ? drift.flags : [],
    staleDays: 30,
  });
  out.push(`intelAuditEntries: ${audit.length}`);
  out.push(`intelEvidenceRecords: ${evidence.length}`);
  out.push(`intelRequests: ${intelRequests.length}`);
  out.push(`intelMissingEvidence: ${missingEvidence}`);
  out.push(`intelMissingNote: ${missingNote}`);
  out.push(`featuresResolved: turnout=${features.turnoutModelingEnabled ? "on" : "off"} timeline=${features.timelineEnabled ? "on" : "off"} universe=${features.universeWeightingEnabled ? "on" : "off"} mcDist=${features.mcDistribution} corr=${features.correlatedShocks ? "on" : "off"} shock=${features.shockScenariosEnabled ? "on" : "off"} decay=${features.capacityDecayEnabled ? "on" : "off"}`);
  out.push(`intelIntegrityScore: ${integrity.score} (${integrity.grade})`);
  out.push(`intelIntegrityPenalties: evidence=${integrity.penalties.missingEvidence} note=${integrity.penalties.missingNote} benchmark=${integrity.penalties.benchmarkWarnings} stale=${integrity.penalties.staleEvidence} drift=${integrity.penalties.driftFlags}`);

  const bootState = bootStatus && typeof bootStatus === "object" ? bootStatus : null;
  if (bootState){
    out.push(`bootStatus: ${String(bootState.status || "unknown")}`);
    const bootSource = String(bootState.source || "").trim();
    const bootWhen = String(bootState.t || "").trim();
    if (bootSource || bootWhen){
      out.push(`bootMeta: source=${bootSource || "—"} when=${bootWhen || "—"}`);
    }
  }
  const traceRows = Array.isArray(bootTrace) ? bootTrace.slice(0, 6) : [];
  if (traceRows.length){
    out.push("bootTraceRecent:");
    for (const row of traceRows){
      const when = String(row?.t || "").trim() || "—";
      const step = String(row?.step || "").trim() || "unknown";
      const phase = String(row?.phase || "").trim();
      const level = String(row?.level || "").trim();
      const message = String(row?.message || "").trim();
      const suffix = [phase, level, message].filter(Boolean).join(" ");
      out.push(`- ${when} ${step}${suffix ? ` (${suffix})` : ""}`);
    }
  }

  if (!drift?.hasLog){
    out.push("realityDrift: no daily log data");
    return out;
  }

  out.push(`rollingCR: actual=${fPct(drift.actualCR)} assumed=${fPct(drift.assumedCR)}`);
  out.push(`rollingSR: actual=${fPct(drift.actualSR)} assumed=${fPct(drift.assumedSR)}`);
  out.push(`rollingAPH: actual=${formatFixedNumber(drift.actualAPH, 2)} assumed=${formatFixedNumber(drift.expectedAPH, 2)}`);
  out.push(`driftFlags: ${drift.flags.length ? drift.flags.join(", ") : "none"}`);
  out.push(`primaryDrift: ${drift.primary || "none"}`);

  return out;
}
