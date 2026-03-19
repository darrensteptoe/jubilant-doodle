// @ts-check
import { resolveFeatureFlags } from "../core/featureFlags.js";
import {
  buildTimelineFeasibilityDisplayView,
  buildTimelineStateSnapshot,
  getTimelineFeasibilityObjectiveMeta,
  resolveTimelineObjectiveValuePerAttemptFromTotals,
} from "../core/timeline.js";
import { buildPlanNumberFormatters, buildPlanWeekPreviewText } from "../core/planView.js";
import {
  buildTimelineCapsInputFromState,
  buildTimelineTacticKindsMapFromState,
} from "../core/timelineCapsInput.js";
import { formatPercentFromUnit, roundWholeNumberByMode } from "../core/utils.js";

export function renderTimelineModule(args){
  const {
    els,
    state,
    weeks,
    safeNum,
    fmtInt,
    engine,
  } = args || {};
  const tlPercentEl = els?.tlPercent;
  const tlCompletionWeekEl = els?.tlCompletionWeek;
  const tlShortfallAttemptsEl = els?.tlShortfallAttempts;
  const tlConstraintEl = els?.tlConstraint;
  const tlShortfallVotesEl = els?.tlShortfallVotes;
  const tlWeekListEl = els?.tlWeekList;
  const features = resolveFeatureFlags(state || {});
  const planNumber = buildPlanNumberFormatters(fmtInt);

  if (els?.timelineWeeksAuto) {
    const normalizedWeeks = roundWholeNumberByMode(weeks, { mode: "floor", fallback: null });
    els.timelineWeeksAuto.value = (normalizedWeeks == null) ? "" : String(Math.max(0, normalizedWeeks));
  }

  const enabled = !!features.timelineEnabled;
  const banner = els.tlBanner;
  const setBanner = (kind, text) => {
    if (!banner) return;
    banner.hidden = false;
    banner.className = `banner ${kind}`;
    banner.textContent = text;
  };
  const hideBanner = () => {
    if (!banner) return;
    banner.hidden = true;
    banner.textContent = "";
  };

  if (!enabled){
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.lastTimeline = {
      percentPlanExecutable: null,
      projectedCompletionWeek: null,
      shortfallAttempts: null,
      shortfallObjectiveValue: null,
      shortfallNetVotes: null,
      constraintType: null,
      weeklyPlan: [],
    };

    if (tlPercentEl) tlPercentEl.textContent = "—";
    if (tlCompletionWeekEl) tlCompletionWeekEl.textContent = "—";
    if (tlShortfallAttemptsEl) tlShortfallAttemptsEl.textContent = "—";
    if (tlConstraintEl) tlConstraintEl.textContent = "—";
    if (tlShortfallVotesEl) tlShortfallVotesEl.textContent = "—";
    if (tlWeekListEl) tlWeekListEl.textContent = "—";
    hideBanner();
    return;
  }

  const lastOpt = state.ui?.lastOpt || null;
  const required = (lastOpt && lastOpt.allocation && typeof lastOpt.allocation === "object") ? lastOpt.allocation : {};
  const bindingHint = lastOpt?.binding || "caps";

  const totals = lastOpt?.totals || {};
  const objectiveValuePerAttempt = resolveTimelineObjectiveValuePerAttemptFromTotals({
    attempts: safeNum(totals.attempts),
    netVotes: safeNum(totals.netVotes),
  });

  const tacticKinds = buildTimelineTacticKindsMapFromState(state);
  const timelineCapsInput = buildTimelineCapsInputFromState({
    state,
    weeksRemaining: weeks ?? 0,
    enabled: true,
    tacticKinds,
  });

  const tl = engine.computeTimelineFeasibility({
    ...timelineCapsInput,
    required,
    tacticKinds,
    objectiveValuePerAttempt,
    netVotesPerAttempt: objectiveValuePerAttempt,
    bindingHint,
    ramp: { enabled: !!state.timelineRampEnabled, mode: state.timelineRampMode || "linear" }
  });
  const tlObjectiveMeta = getTimelineFeasibilityObjectiveMeta(tl);
  const weeklyPlan = Array.isArray(tl?.weekly)
    ? tl.weekly.map((row) => ({
      week: safeNum(row?.week) ?? null,
      attempts: safeNum(row?.attempts) ?? null,
    }))
    : [];
  state.ui.lastTimeline = buildTimelineStateSnapshot({
    timelineResult: tl,
    objectiveMeta: tlObjectiveMeta,
    weeklyPlan,
  });

  const displayView = buildTimelineFeasibilityDisplayView({
    timelineResult: tl,
    objectiveMeta: tlObjectiveMeta,
    weeklyPlan,
    formatWhole: planNumber.formatWhole,
    formatPercent: (value) => formatPercentFromUnit(value, 0),
    buildWeekPreviewText: (rows) => buildPlanWeekPreviewText(rows, {
      formatInt: planNumber.formatIntRound,
      fallbackText: "—",
    }),
  });

  if (tlPercentEl) tlPercentEl.textContent = displayView.executableText;
  if (tlCompletionWeekEl) tlCompletionWeekEl.textContent = displayView.projectedCompletionWeekText;
  if (tlShortfallAttemptsEl) tlShortfallAttemptsEl.textContent = displayView.shortfallAttemptsText;
  if (tlConstraintEl) tlConstraintEl.textContent = displayView.constraintText;
  if (tlShortfallVotesEl) tlShortfallVotesEl.textContent = displayView.shortfallObjectiveText;
  if (tlWeekListEl) tlWeekListEl.textContent = displayView.weekPreviewText;

  if (displayView.bannerText){
    setBanner(displayView.bannerKind || "warn", displayView.bannerText);
  } else {
    hideBanner();
  }
}
