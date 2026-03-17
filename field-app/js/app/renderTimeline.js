// @ts-check
import { resolveFeatureFlags } from "../core/featureFlags.js";
import { getTimelineFeasibilityObjectiveMeta } from "../core/timeline.js";

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

  if (els?.timelineWeeksAuto) {
    els.timelineWeeksAuto.value = (weeks == null) ? "" : String(Math.max(0, Math.floor(weeks)));
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
  const attemptsTotal = safeNum(totals.attempts) ?? null;
  const objectiveValueTotal = safeNum(totals.netVotes) ?? null;
  const objectiveValuePerAttempt = (attemptsTotal != null && attemptsTotal > 0 && objectiveValueTotal != null)
    ? (objectiveValueTotal / attemptsTotal)
    : null;

  const activeOverride = safeNum(state.timelineActiveWeeks);

  const tacticKinds = {
    doors: state.budget?.tactics?.doors?.kind || "persuasion",
    phones: state.budget?.tactics?.phones?.kind || "persuasion",
    texts: state.budget?.tactics?.texts?.kind || "persuasion",
  };

  const tl = engine.computeTimelineFeasibility({
    enabled: true,
    weeksRemaining: weeks ?? 0,
    activeWeeksOverride: (activeOverride == null ? null : activeOverride),
    gotvWindowWeeks: safeNum(state.timelineGotvWeeks),
    staffing: {
      staff: safeNum(state.timelineStaffCount) ?? 0,
      volunteers: safeNum(state.timelineVolCount) ?? 0,
      staffHours: safeNum(state.timelineStaffHours) ?? 0,
      volunteerHours: safeNum(state.timelineVolHours) ?? 0,
    },
    throughput: {
      doors: safeNum(state.timelineDoorsPerHour) ?? 0,
      phones: safeNum(state.timelineCallsPerHour) ?? 0,
      texts: safeNum(state.timelineTextsPerHour) ?? 0,
    },
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

  state.ui.lastTimeline = {
    percentPlanExecutable: tl.percentPlanExecutable ?? null,
    projectedCompletionWeek: tl.projectedCompletionWeek ?? null,
    shortfallAttempts: tl.shortfallAttempts ?? null,
    shortfallObjectiveValue: tlObjectiveMeta.shortfallObjectiveValue,
    shortfallNetVotes: tlObjectiveMeta.shortfallObjectiveValue,
    constraintType: tl.constraintType || null,
    weeklyPlan,
  };

  const pct = Math.round((tl.percentPlanExecutable ?? 0) * 100);
  if (tlPercentEl) tlPercentEl.textContent = `${pct}%`;
  if (tlCompletionWeekEl) {
    tlCompletionWeekEl.textContent = (tl.projectedCompletionWeek == null) ? "—" : String(tl.projectedCompletionWeek);
  }
  if (tlShortfallAttemptsEl) {
    tlShortfallAttemptsEl.textContent = fmtInt(Math.round(tl.shortfallAttempts ?? 0));
  }
  if (tlConstraintEl) tlConstraintEl.textContent = tl.constraintType || "—";

  if (tlShortfallVotesEl){
    const shortfallObjectiveValue = tlObjectiveMeta.shortfallObjectiveValue;
    tlShortfallVotesEl.textContent = (shortfallObjectiveValue == null) ? "—" : fmtInt(Math.round(shortfallObjectiveValue));
  }

  if (tlWeekListEl){
    if (!weeklyPlan.length){
      tlWeekListEl.textContent = "—";
    } else {
      tlWeekListEl.textContent = weeklyPlan
        .map((row) => `Week ${row.week}: ${fmtInt(Math.round(row.attempts || 0))} attempts`)
        .join("\n");
    }
  }

  if (tl.percentPlanExecutable < 1){
    setBanner("warn", `Timeline feasibility: ${pct}% executable · shortfall ${fmtInt(Math.round(tl.shortfallAttempts || 0))} attempts.`);
  } else {
    hideBanner();
  }
}
