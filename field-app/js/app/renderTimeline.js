// @ts-check
import { resolveFeatureFlags } from "../core/featureFlags.js";

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
      shortfallNetVotes: null,
      constraintType: null
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
  const netVotesTotal = safeNum(totals.netVotes) ?? null;
  const netVotesPerAttempt = (attemptsTotal != null && attemptsTotal > 0 && netVotesTotal != null)
    ? (netVotesTotal / attemptsTotal)
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
    netVotesPerAttempt,
    bindingHint,
    ramp: { enabled: !!state.timelineRampEnabled, mode: state.timelineRampMode || "linear" }
  });

  state.ui.lastTimeline = {
    percentPlanExecutable: tl.percentPlanExecutable ?? null,
    projectedCompletionWeek: tl.projectedCompletionWeek ?? null,
    shortfallAttempts: tl.shortfallAttempts ?? null,
    shortfallNetVotes: tl.shortfallNetVotes ?? null,
    constraintType: tl.constraintType || null
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
    tlShortfallVotesEl.textContent = (tl.shortfallNetVotes == null) ? "—" : fmtInt(Math.round(tl.shortfallNetVotes));
  }

  if (tlWeekListEl){
    if (!tl.weekly || !tl.weekly.length){
      tlWeekListEl.textContent = "—";
    } else {
      tlWeekListEl.textContent = tl.weekly.map(w => `Week ${w.week}: ${fmtInt(Math.round(w.attempts || 0))} attempts`).join("\n");
    }
  }

  if (tl.percentPlanExecutable < 1){
    setBanner("warn", `Timeline feasibility: ${pct}% executable · shortfall ${fmtInt(Math.round(tl.shortfallAttempts || 0))} attempts.`);
  } else {
    hideBanner();
  }
}
