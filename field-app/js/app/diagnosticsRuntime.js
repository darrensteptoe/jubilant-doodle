// @ts-check
import { getOperationsMetricsSnapshot } from "../features/operations/metricsCache.js";
import {
  appendOperationsDiagnosticsCore,
  appendModelDiagnosticsCore,
} from "./diagnosticsBuilders.js";

/**
 * @typedef {{
 *   els: Record<string, any>,
 *   engine: Record<string, any>,
 *   buildId: string,
 *   getState: () => Record<string, any>,
 *   computeRealityDrift: (...args: any[]) => any,
 *   recentErrors: Array<Record<string, any>>,
 *   maxErrors?: number,
 * }} DiagnosticsRuntimeControllerDeps
 */

/**
 * @param {DiagnosticsRuntimeControllerDeps=} deps
 */
export function createDiagnosticsRuntimeController({
  els,
  engine,
  buildId,
  getState,
  computeRealityDrift,
  recentErrors,
  maxErrors = 20,
} = {}){
  let diagRenderSeq = 0;

  async function getOperationsDiagnosticsSnapshot(){
    try{
      const snapshot = await getOperationsMetricsSnapshot();
      const counts = snapshot?.counts || {};
      const rollups = snapshot?.rollups || {};

      return {
        available: true,
        counts,
        rollups: {
          production: {
            source: rollups?.production?.source || "—",
            attempts: Number(rollups?.production?.attempts || 0),
            convos: Number(rollups?.production?.convos || 0),
            supportIds: Number(rollups?.production?.supportIds || 0),
            hours: Number(rollups?.production?.hours || 0),
          },
          dedupe: {
            rule: rollups?.dedupe?.rule || "—",
            excludedTurfAttemptRecords: Number(rollups?.dedupe?.excludedTurfAttemptRecords || 0),
            excludedTurfAttempts: Number(rollups?.dedupe?.excludedTurfAttempts || 0),
            includedFallbackAttempts: Number(rollups?.dedupe?.includedFallbackAttempts || 0),
          }
        }
      };
    } catch (e){
      return { available: false, error: e?.message ? String(e.message) : String(e || "unknown") };
    }
  }

  function appendOperationsDiagnostics(lines, tw){
    return appendOperationsDiagnosticsCore(lines, tw);
  }

  function appendModelDiagnostics(lines){
    return appendModelDiagnosticsCore(lines, {
      engine,
      state: getState(),
      computeRealityDrift,
    });
  }

  function updateDiagnosticsUI(){
    try{
      if (!els?.diagErrors) return;
      const lines = recentErrors.map((e) => `[${e.t}] ${e.kind}: ${e.msg}`);
      if (!lines.length) lines.push("(none)");
      els.diagErrors.textContent = lines.join("\n");

      if (!els?.diagModal || els.diagModal.hidden) return;
      const seq = ++diagRenderSeq;
      Promise.resolve()
        .then(() => getOperationsDiagnosticsSnapshot())
        .then((tw) => {
          if (seq !== diagRenderSeq) return;
          const withOps = appendOperationsDiagnostics(lines, tw);
          const merged = appendModelDiagnostics(withOps);
          if (els?.diagErrors) els.diagErrors.textContent = merged.join("\n");
        })
        .catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }

  function recordError(kind, message, extra){
    try{
      const item = {
        t: new Date().toISOString(),
        kind: String(kind || "error"),
        msg: String(message || ""),
        extra: extra && typeof extra === "object" ? extra : undefined
      };
      recentErrors.unshift(item);
      if (recentErrors.length > maxErrors) recentErrors.length = maxErrors;
      updateDiagnosticsUI();
    } catch { /* ignore */ }
  }

  function installGlobalErrorCapture(){
    try{
      window.addEventListener("error", (e) => {
        recordError("error", e?.message || "Unhandled error", {
          filename: e?.filename,
          lineno: e?.lineno,
          colno: e?.colno
        });
      });
      window.addEventListener("unhandledrejection", (e) => {
        const r = e?.reason;
        recordError("unhandledrejection", r?.message || String(r || "Unhandled rejection"));
      });
    } catch { /* ignore */ }
  }

  function updateBuildStamp(){
    try{
      if (els?.buildStamp) els.buildStamp.textContent = `build ${buildId}`;
    } catch { /* ignore */ }
  }

  function updateSelfTestGateBadge(status){
    try{
      if (!els?.selfTestGate) return;
      els.selfTestGate.textContent = status;
      els.selfTestGate.classList.remove("badge-unverified", "badge-verified", "badge-failed");
      if (status === engine?.selfTest?.SELFTEST_GATE?.VERIFIED) els.selfTestGate.classList.add("badge-verified");
      else if (status === engine?.selfTest?.SELFTEST_GATE?.FAILED) els.selfTestGate.classList.add("badge-failed");
      else els.selfTestGate.classList.add("badge-unverified");
    } catch { /* ignore */ }
  }

  function openDiagnostics(){
    try{
      if (!els?.diagModal) return;
      els.diagModal.hidden = false;
      updateDiagnosticsUI();
    } catch { /* ignore */ }
  }

  function closeDiagnostics(){
    try{
      if (els?.diagModal) els.diagModal.hidden = true;
    } catch { /* ignore */ }
  }

  return {
    recordError,
    installGlobalErrorCapture,
    updateBuildStamp,
    updateSelfTestGateBadge,
    openDiagnostics,
    closeDiagnostics,
    getOperationsDiagnosticsSnapshot,
    updateDiagnosticsUI,
  };
}
