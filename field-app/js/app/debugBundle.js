// @ts-check
/**
 * @typedef {{
 *   getOperationsDiagnosticsSnapshot: () => Promise<Record<string, any>>,
 *   engine: Record<string, any>,
 *   state: Record<string, any>,
 *   APP_VERSION: string,
 *   BUILD_ID: string,
 *   getLastExportHash: () => string | null,
 *   recentErrors: Array<Record<string, any>>,
 *   maxErrors?: number,
 *   computeRealityDrift: () => Record<string, any>,
 *   listMissingEvidenceAudit: (...args: any[]) => any[],
 *   listMissingNoteAudit: (...args: any[]) => any[],
 *   computeIntelIntegrityScore: (...args: any[]) => any,
 *   downloadText: (text: string, fileName: string, mimeType: string) => void,
 * }} DebugBundleDeps
 */

/**
 * @param {DebugBundleDeps=} deps
 */
export async function copyDebugBundleModule(deps = {}){
  const {
    getOperationsDiagnosticsSnapshot,
    engine,
    state,
    APP_VERSION,
    BUILD_ID,
    getLastExportHash,
    recentErrors,
    maxErrors = 20,
    computeRealityDrift,
    listMissingEvidenceAudit,
    listMissingNoteAudit,
    computeIntelIntegrityScore,
    downloadText,
  } = deps || {};

  const tw = await getOperationsDiagnosticsSnapshot();
  const benchmarkWarnings = engine?.snapshot?.computeAssumptionBenchmarkWarnings
    ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
    : [];
  const drift = computeRealityDrift();
  const intel = state?.intelState || {};
  const intelAudit = Array.isArray(intel?.audit) ? intel.audit : [];
  const intelEvidence = Array.isArray(intel?.evidence) ? intel.evidence : [];
  const missingEvidenceAudit = listMissingEvidenceAudit(state, { limit: 2000 });
  const missingNoteAudit = listMissingNoteAudit(state, { limit: 2000 });
  const workflow = intel?.workflow && typeof intel.workflow === "object" ? intel.workflow : {};
  const intelMissingEvidence = missingEvidenceAudit.length;
  const intelMissingNote = missingNoteAudit.length;
  const integrityScore = computeIntelIntegrityScore(state, {
    benchmarkWarnings,
    driftFlags: Array.isArray(drift?.flags) ? drift.flags : [],
    staleDays: 30,
  });

  const bundle = {
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    scenarioName: state?.scenarioName || "",
    lastExportHash: (typeof getLastExportHash === "function") ? (getLastExportHash() || null) : null,
    recentErrors: Array.isArray(recentErrors) ? recentErrors.slice(0, Math.max(1, Number(maxErrors) || 20)) : [],
    operationsDiagnostics: tw,
    modelDiagnostics: {
      benchmarkWarnings,
      integrityScore,
      intelState: {
        version: intel?.version || null,
        missingEvidence: intelMissingEvidence,
        missingNote: intelMissingNote,
        counts: {
          evidence: intelEvidence.length,
          benchmarks: Array.isArray(intel?.benchmarks) ? intel.benchmarks.length : 0,
          flags: Array.isArray(intel?.flags) ? intel.flags.length : 0,
          audit: intelAudit.length,
          briefs: Array.isArray(intel?.briefs) ? intel.briefs.length : 0,
          recommendations: Array.isArray(intel?.recommendations) ? intel.recommendations.length : 0,
          observedMetrics: Array.isArray(intel?.observedMetrics) ? intel.observedMetrics.length : 0,
          intelRequests: Array.isArray(intel?.intelRequests) ? intel.intelRequests.length : 0,
          correlationModels: Array.isArray(intel?.correlationModels) ? intel.correlationModels.length : 0,
          shockScenarios: Array.isArray(intel?.shockScenarios) ? intel.shockScenarios.length : 0,
        },
        workflow: {
          scenarioLocked: !!workflow.scenarioLocked,
          lockReason: workflow.lockReason || "",
          requireCriticalNote: workflow.requireCriticalNote !== false,
          requireCriticalEvidence: workflow.requireCriticalEvidence !== false,
        },
        simToggles: intel?.simToggles || null,
        expertToggles: intel?.expertToggles || null,
      },
      realityDrift: drift?.hasLog ? {
        flags: Array.isArray(drift.flags) ? drift.flags.slice() : [],
        primary: drift.primary || null,
        actualCR: drift.actualCR ?? null,
        assumedCR: drift.assumedCR ?? null,
        actualSR: drift.actualSR ?? null,
        assumedSR: drift.assumedSR ?? null,
        actualAPH: drift.actualAPH ?? null,
        expectedAPH: drift.expectedAPH ?? null,
      } : {
        hasLog: false,
      },
    },
  };

  const text = JSON.stringify(bundle, null, 2);
  try{
    await engine.snapshot.copyTextToClipboard(text);
    alert("Debug bundle copied.");
  } catch {
    downloadText(text, "fpe-debug-bundle.json", "application/json");
  }
}
