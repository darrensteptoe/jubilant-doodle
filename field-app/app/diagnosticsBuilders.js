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

  out.push(`records: persons=${Number(c.persons || 0)} pipeline=${Number(c.pipelineRecords || 0)} shifts=${Number(c.shiftRecords || 0)} turf=${Number(c.turfEvents || 0)}`);
  out.push(`productionSource: ${p.source || "—"}`);
  out.push(`productionTotals: attempts=${Math.round(Number(p.attempts || 0))} convos=${Math.round(Number(p.convos || 0))} supportIds=${Math.round(Number(p.supportIds || 0))} hours=${Number(p.hours || 0).toFixed(2)}`);
  out.push(`dedupeRule: ${d.rule || "—"}`);
  out.push(`dedupe: excludedTurfRecords=${Math.round(Number(d.excludedTurfAttemptRecords || 0))} excludedTurfAttempts=${Math.round(Number(d.excludedTurfAttempts || 0))} fallbackIncluded=${Math.round(Number(d.includedFallbackAttempts || 0))}`);
  return out;
}

export function appendModelDiagnosticsCore(lines, {
  engine,
  state,
  computeRealityDrift,
}){
  const out = Array.isArray(lines) ? lines.slice() : [];
  const fPct = (v) => (v == null || !isFinite(v)) ? "—" : `${(v * 100).toFixed(1)}%`;

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
  const audit = Array.isArray(intel.audit) ? intel.audit : [];
  const evidence = Array.isArray(intel.evidence) ? intel.evidence : [];
  const missingEvidence = audit.filter((x) =>
    x &&
    x.requiresEvidence === true &&
    !x.evidenceId &&
    String(x.status || "").toLowerCase() !== "resolved"
  ).length;
  out.push(`intelAuditEntries: ${audit.length}`);
  out.push(`intelEvidenceRecords: ${evidence.length}`);
  out.push(`intelMissingEvidence: ${missingEvidence}`);

  const drift = computeRealityDrift();
  if (!drift?.hasLog){
    out.push("realityDrift: no daily log data");
    return out;
  }

  out.push(`rollingCR: actual=${fPct(drift.actualCR)} assumed=${fPct(drift.assumedCR)}`);
  out.push(`rollingSR: actual=${fPct(drift.actualSR)} assumed=${fPct(drift.assumedSR)}`);
  out.push(`rollingAPH: actual=${(drift.actualAPH == null || !isFinite(drift.actualAPH)) ? "—" : drift.actualAPH.toFixed(2)} assumed=${(drift.expectedAPH == null || !isFinite(drift.expectedAPH)) ? "—" : drift.expectedAPH.toFixed(2)}`);
  out.push(`driftFlags: ${drift.flags.length ? drift.flags.join(", ") : "none"}`);
  out.push(`primaryDrift: ${drift.primary || "none"}`);

  return out;
}
