// @ts-check
export function createSensitivitySurfaceController({
  els,
  getState,
  getStateSnapshot,
  computeElectionSnapshot,
  safeNum,
  buildModelInputFromState,
  engine,
  derivedWeeksRemaining,
  deriveNeedVotes,
  withPatchedState,
  runMonteCarloSim,
  surfaceLeverSpec,
  surfaceClamp,
  applySurfaceDefaults,
  renderSurfaceStub,
  renderSurfaceResult,
} = {}){
  function writeOutcomeSurfaceCache({ rows, statusText, summaryText } = {}){
    const s = getState();
    if (!s || typeof s !== "object") return;
    if (!s.ui || typeof s.ui !== "object") s.ui = {};
    s.ui.lastOutcomeSurfaceRows = Array.isArray(rows)
      ? rows.map((row) => ({
          leverValue: row?.leverValue ?? "",
          winProb: Number.isFinite(Number(row?.winProb)) ? Number(row.winProb) : null,
          p10: Number.isFinite(Number(row?.p10)) ? Number(row.p10) : null,
          p50: Number.isFinite(Number(row?.p50)) ? Number(row.p50) : null,
          p90: Number.isFinite(Number(row?.p90)) ? Number(row.p90) : null,
        }))
      : [];
    s.ui.lastOutcomeSurfaceStatus = String(statusText || "").trim();
    s.ui.lastOutcomeSurfaceSummary = String(summaryText || "").trim();
  }

  function wireSensitivitySurface(){
    if (!els?.surfaceLever || !els?.btnComputeSurface) return;
    if (els.btnComputeSurface.dataset.wiredSurface === "1") return;
    els.btnComputeSurface.dataset.wiredSurface = "1";

    applySurfaceDefaults();
    renderSurfaceStub();
    writeOutcomeSurfaceCache({
      rows: [],
      statusText: "",
      summaryText: els?.surfaceSummary?.textContent || "",
    });

    els.surfaceLever.addEventListener("change", () => {
      applySurfaceDefaults();
      renderSurfaceStub();
      writeOutcomeSurfaceCache({
        rows: [],
        statusText: "",
        summaryText: els?.surfaceSummary?.textContent || "",
      });
    });

    els.btnComputeSurface.addEventListener("click", async () => {
      try{
        if (els.btnComputeSurface) els.btnComputeSurface.disabled = true;
        if (els.surfaceStatus) els.surfaceStatus.textContent = "Computing…";

        const leverKey = els.surfaceLever.value;
        const spec = surfaceLeverSpec(leverKey);
        if (!spec){
          if (els.surfaceStatus) els.surfaceStatus.textContent = "Unknown lever.";
          writeOutcomeSurfaceCache({
            rows: [],
            statusText: els?.surfaceStatus?.textContent || "Unknown lever.",
            summaryText: els?.surfaceSummary?.textContent || "",
          });
          return;
        }

        const minV = surfaceClamp(els.surfaceMin?.value, spec.clampLo, spec.clampHi);
        const maxV = surfaceClamp(els.surfaceMax?.value, spec.clampLo, spec.clampHi);
        const steps = Math.max(5, Math.floor(Number(els.surfaceSteps?.value) || 21));

        const mode = els.surfaceMode?.value || "fast";
        const runs = (mode === "full") ? 10000 : 2000;

        const tPct = Number(els.surfaceTarget?.value);
        const targetWinProb = Number.isFinite(tPct) ? surfaceClamp(tPct, 50, 99) / 100 : 0.70;

        const snap = getStateSnapshot();
        let planningSnapshot = null;
        try{
          planningSnapshot = computeElectionSnapshot({ state: snap, nowDate: new Date(), toNum: safeNum });
        } catch {
          planningSnapshot = null;
        }
        const modelInput = buildModelInputFromState(snap, safeNum);
        const res = planningSnapshot?.res || engine.computeAll(modelInput);
        const weeks = planningSnapshot?.weeks ?? derivedWeeksRemaining();
        const needVotes = (planningSnapshot?.needVotes != null) ? planningSnapshot.needVotes : deriveNeedVotes(res);

        const state = getState();
        const seed = state?.mcSeed || "";
        const surfaceAccessors = { withPatchedState, runMonteCarloSim };

        const result = engine.computeSensitivitySurface({
          engine: surfaceAccessors,
          baseline: { res, weeks, needVotes, scenario: snap },
          sweep: { leverKey, minValue: minV, maxValue: maxV, steps },
          options: { runs, seed, targetWinProb }
        });

        renderSurfaceResult({ spec, result });

        const doneStatus = `Done (${runs.toLocaleString()} runs × ${steps} points)`;
        if (els.surfaceStatus){
          els.surfaceStatus.textContent = doneStatus;
        }
        writeOutcomeSurfaceCache({
          rows: Array.isArray(result?.points) ? result.points : [],
          statusText: doneStatus,
          summaryText: els?.surfaceSummary?.textContent || "",
        });
      } catch (err){
        renderSurfaceStub();
        const errText = err?.message ? err.message : String(err || "Error");
        if (els.surfaceStatus) els.surfaceStatus.textContent = errText;
        writeOutcomeSurfaceCache({
          rows: [],
          statusText: errText,
          summaryText: els?.surfaceSummary?.textContent || "",
        });
      } finally {
        if (els.btnComputeSurface) els.btnComputeSurface.disabled = false;
      }
    });
  }

  return { wireSensitivitySurface };
}
