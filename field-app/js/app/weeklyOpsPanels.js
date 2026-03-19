// @ts-check
import {
  buildReachIntFormatter,
  buildReachWeeklyConstraintView,
  buildReachWeeklyExecutionView,
} from "../core/reachView.js";
export function renderWeeklyExecutionStatusModule(args){
  const {
    els,
    ctx,
    fmtInt,
    computeLastNLogSums,
    setTag,
    fmtISODate,
    clamp,
  } = args || {};
  const last7 = computeLastNLogSums(7);
  const reachInt = buildReachIntFormatter(fmtInt);
  const weekly = buildReachWeeklyExecutionView({
    ctx,
    logSummary: last7,
    formatInt: reachInt,
    formatDate: fmtISODate,
    clampFn: clamp,
    hideChannelBreakdownWithoutLog: true,
  });

  if (els.wkReqConvosWeek) els.wkReqConvosWeek.textContent = weekly.requiredConvosText;
  if (els.wkReqAttemptsWeek) els.wkReqAttemptsWeek.textContent = weekly.requiredAttemptsText;
  if (els.wkActConvos7) els.wkActConvos7.textContent = weekly.actualConvosText;
  if (els.wkActAttempts7) els.wkActAttempts7.textContent = weekly.actualAttemptsText;
  if (els.wkGapConvos) els.wkGapConvos.textContent = weekly.gapConvosText;
  if (els.wkGapAttempts) els.wkGapAttempts.textContent = weekly.gapAttemptsText;
  if (els.wkActConvosNote) els.wkActConvosNote.textContent = weekly.actualConvosNote;
  if (els.wkActAttemptsNote) els.wkActAttemptsNote.textContent = weekly.actualAttemptsNote;
  if (els.wkReqDoorAttemptsWeek) els.wkReqDoorAttemptsWeek.textContent = weekly.requiredDoorAttemptsText;
  if (els.wkReqCallAttemptsWeek) els.wkReqCallAttemptsWeek.textContent = weekly.requiredCallAttemptsText;
  if (els.wkImpliedConvosWeek) els.wkImpliedConvosWeek.textContent = weekly.impliedConvosText;
  if (els.wkImpliedConvosNote) els.wkImpliedConvosNote.textContent = weekly.impliedConvosNote;
  if (els.wkFinishConvos) els.wkFinishConvos.textContent = weekly.finishConvosText;
  if (els.wkFinishAttempts) els.wkFinishAttempts.textContent = weekly.finishAttemptsText;
  if (els.wkPaceStatus) els.wkPaceStatus.textContent = weekly.paceStatus;
  if (els.wkPaceNote) els.wkPaceNote.textContent = weekly.paceNote;

  setTag(els.wkConvosPaceTag, weekly.convosPace.kind, weekly.convosPace.label);
  setTag(els.wkAttemptsPaceTag, weekly.attemptsPace.kind, weekly.attemptsPace.label);

  if (els.wkExecBanner){
    els.wkExecBanner.hidden = !weekly.wkExecBanner.show;
    els.wkExecBanner.classList.remove("ok", "warn", "bad");
    if (weekly.wkExecBanner.show){
      els.wkExecBanner.classList.add(weekly.wkExecBanner.kind || "warn");
      els.wkExecBanner.textContent = weekly.wkExecBanner.text || "";
    } else {
      els.wkExecBanner.classList.add("warn");
      els.wkExecBanner.textContent = "";
    }
  }
}

export function renderWeeklyOpsModule(args){
  const {
    els,
    state,
    res,
    weeks,
    ctx,
    fmtInt,
    computeWeeklyOpsContext,
    renderWeeklyExecutionStatus,
  } = args || {};

  const context = ctx || computeWeeklyOpsContext(res, weeks) || {};
  const goal = context.goal ?? 0;
  const sr = context.sr;
  const cr = context.cr;
  const convosPerWeek = context.convosPerWeek;
  const attemptsPerWeek = context.attemptsPerWeek;
  const cap = context.cap;
  const capTotal = context.capTotal;
  const reachInt = buildReachIntFormatter(fmtInt);

  const fmtMaybeInt = (v) => reachInt(v, { ceil: true });
  const fmtMaybe = (v) => reachInt(v);
  const constraintView = buildReachWeeklyConstraintView(context, { formatInt: reachInt });

  if (els.wkGoal) els.wkGoal.textContent = reachInt(goal);

  if (els.wkConvosPerWeek) els.wkConvosPerWeek.textContent = fmtMaybeInt(convosPerWeek);
  if (els.wkAttemptsPerWeek) els.wkAttemptsPerWeek.textContent = fmtMaybeInt(attemptsPerWeek);

  if (els.wkCapacityPerWeek) els.wkCapacityPerWeek.textContent = fmtMaybeInt(capTotal);
  if (els.wkCapacityBreakdown){
    if (cap && cap.doors != null && cap.phones != null){
      els.wkCapacityBreakdown.textContent = `${fmtMaybe(cap.doors)} doors + ${fmtMaybe(cap.phones)} calls`;
    } else {
      els.wkCapacityBreakdown.textContent = "—";
    }
  }

  if (els.wkGapPerWeek){
    els.wkGapPerWeek.textContent = constraintView.gapText;
  }
  const constraint = constraintView.constraint;
  const note = constraintView.constraintNote;
  const bannerShow = !!constraintView.wkBanner.show;
  const bannerKind = constraintView.wkBanner.kind || "warn";
  const bannerMsg = constraintView.wkBanner.text || "";

  if (els.wkConstraint) els.wkConstraint.textContent = constraint;
  if (els.wkConstraintNote) els.wkConstraintNote.textContent = note;

  if (els.wkBanner){
    els.wkBanner.hidden = !bannerShow;
    if (bannerShow){
      els.wkBanner.classList.remove("ok", "warn", "bad");
      els.wkBanner.classList.add(bannerKind);
      els.wkBanner.textContent = bannerMsg;
    }
  }

  if (!state?.ui || typeof state.ui !== "object") {
    // keep render path side-effect free when state is not injected
  } else {
    state.ui.lastWeeklyOps = {
      goal,
      weeks,
      supportRate: sr,
      contactRate: cr,
      conversationsPerWeek: convosPerWeek,
      attemptsPerWeek,
      capacityPerWeek: capTotal,
      capacityByTactic: {
        doors: cap?.doors ?? null,
        phones: cap?.phones ?? null,
      },
      gapPerWeek: context.gap,
      constraint,
      note,
      banner: {
        shown: !!bannerShow,
        kind: bannerKind || "",
        text: bannerMsg || "",
      },
    };
  }

  renderWeeklyExecutionStatus(context);
}
