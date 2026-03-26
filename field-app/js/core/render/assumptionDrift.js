// @ts-check
import { buildDecisionDriftSnapshotView } from "../../core/decisionView.js";
import { summarizeExecutionDailyLog } from "../../core/executionSnapshot.js";
import { fmtInt } from "../../core/utils.js";

export function renderAssumptionDriftPanel({
  els,
  state,
  res,
  weeks,
  safeNum,
  computeWeeklyOpsContext,
  ctx,
  executionSnapshot
}){
  const driftStatusTagEl = els?.driftStatusTag;
  const driftReqEl = els?.driftReq;
  const driftActualEl = els?.driftActual;
  const driftDeltaEl = els?.driftDelta;
  const driftSlipBannerEl = els?.driftSlipBanner;
  if (!driftStatusTagEl && !driftReqEl && !driftActualEl && !driftDeltaEl && !driftSlipBannerEl) return;

  const opsCtx = ctx || computeWeeklyOpsContext(res, weeks);
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;
  const hasLog = executionSnapshot ? !!executionSnapshot?.log?.hasLog : !!(log && log.length);
  let sumAttempts7 = executionSnapshot?.log?.sumAttemptsWindow;
  let sumAttemptsAll = executionSnapshot?.log?.sumAttemptsAll;
  if (hasLog && !(sumAttempts7 != null && isFinite(sumAttempts7) && sumAttemptsAll != null && isFinite(sumAttemptsAll))){
    const summary = summarizeExecutionDailyLog({
      dailyLog: log,
      windowN: 7,
      safeNumFn: safeNum,
    });
    sumAttempts7 = summary.sumAttemptsWindow;
    sumAttemptsAll = summary.sumAttemptsAll;
  }

  const decisionDrift = buildDecisionDriftSnapshotView({
    executionSnapshot: {
      ...(executionSnapshot || {}),
      log: {
        ...(executionSnapshot?.log || {}),
        hasLog,
        sumAttemptsWindow: sumAttempts7,
        sumAttemptsAll: sumAttemptsAll,
      },
    },
    weeklyContext: opsCtx,
    formatInt: fmtInt,
    weeksRemaining: weeks,
  });
  if (driftReqEl) driftReqEl.textContent = decisionDrift.reqText || "—";
  if (driftActualEl) driftActualEl.textContent = decisionDrift.actualText || "—";
  if (driftDeltaEl) driftDeltaEl.textContent = decisionDrift.deltaText || "—";
  if (driftStatusTagEl){
    driftStatusTagEl.className = decisionDrift.cls ? `tag ${decisionDrift.cls}` : "tag";
    driftStatusTagEl.textContent = decisionDrift.tag || "—";
  }
  if (driftSlipBannerEl){
    driftSlipBannerEl.className = decisionDrift.cls ? `banner ${decisionDrift.cls}` : "banner";
    driftSlipBannerEl.textContent = decisionDrift.banner || "At current pace, projected slip unavailable under current inputs.";
  }
}
