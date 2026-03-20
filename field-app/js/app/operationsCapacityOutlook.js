// @ts-check
import { roundWholeNumberByMode } from "../core/utils.js";
export function createOperationsCapacityOutlookController(deps = {}){
  const {
    els,
    getState,
    safeNum,
    clamp,
    getOperationsMetricsSnapshot,
    compileEffectiveInputs,
    twCapBaselineAttemptsPerWeek,
    twCapPerOrganizerAttemptsPerWeek,
    twCapNormalizeForecastConfig,
    twCapBuildReadinessStats,
    twCapText,
    twCapNum,
    twCapFmtInt,
    twCapFmt1,
    twCapFmt2 = twCapFmt1,
    twCapFmtSigned,
    twCapRatioText,
    twCapFmtPct01,
    twCapClean,
    twCapTransitionKey,
    twCapParseDate,
    twCapWeekStart,
    twCapIsoUTC,
    pipelineStages,
    twCapDayMs = 86400000,
    twCapWeekMs = 604800000,
    markMcStale,
    scheduleRender,
  } = deps || {};

  let outlookTimer = null;
  let outlookSeq = 0;
  let outlookLastRunMs = 0;
  let overrideSig = "";
  let overrideCache = {
    ready: false,
    week0: { baseline: null, ramp: null, scheduled: null, max: null },
    horizonWeeks: 0,
    updatedAt: null,
  };

  const writeOutlookSnapshot = (state, snapshot) => {
    if (!state || typeof state !== "object") return;
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.twCapOutlookLatest = snapshot || null;
  };

  const emptyOutlook = (message) => {
    const state = (typeof getState === "function" ? getState() : null) || {};
    overrideSig = "";
    overrideCache = {
      ready: false,
      week0: { baseline: null, ramp: null, scheduled: null, max: null },
      horizonWeeks: 0,
      updatedAt: new Date().toISOString(),
    };
    twCapText(els?.twCapOutlookStatus, message || "No Operations data.");
    twCapText(els?.twCapOutlookActiveSource, state?.twCapOverrideEnabled ? "Override ON (data unavailable; fallback baseline)" : "Override OFF");
    twCapText(els?.twCapOutlookBaseline, "—");
    twCapText(els?.twCapOutlookRampTotal, "—");
    twCapText(els?.twCapOutlookScheduledTotal, "—");
    twCapText(els?.twCapOutlookHorizon, "—");
    twCapText(els?.twDiagInterviewPass, "—");
    twCapText(els?.twDiagOfferAccept, "—");
    twCapText(els?.twDiagOnboardingCompletion, "—");
    twCapText(els?.twDiagTrainingCompletion, "—");
    twCapText(els?.twDiagCompositeSignal, "—");
    twCapText(els?.twDiagReadyNow, "—");
    twCapText(els?.twDiagReadyPerWeek, "—");
    twCapText(els?.twDiagReadyIn14d, "—");
    twCapText(els?.twDiagMedianReadyDays, "—");
    twCapText(els?.twDiagHintNote, "Display-only diagnostics. Add interview/onboarding/training records to unlock hints.");
    writeOutlookSnapshot(state, {
      status: message || "No Operations data.",
      activeSource: state?.twCapOverrideEnabled ? "Override ON (data unavailable; fallback baseline)" : "Override OFF",
      baseline: "—",
      rampTotal: "—",
      scheduledTotal: "—",
      horizon: "—",
      interviewPass: "—",
      offerAccept: "—",
      onboardingCompletion: "—",
      trainingCompletion: "—",
      compositeSignal: "—",
      readyNow: "—",
      readyPerWeek: "—",
      readyIn14d: "—",
      medianReadyDays: "—",
      hintNote: "Display-only diagnostics. Add interview/onboarding/training records to unlock hints.",
      basis: "Override is OFF by default. When enabled, FPE capacity uses selected Operations source with automatic fallback to baseline if data is unavailable.",
      rows: [],
      officeMix: [],
      computedAt: new Date().toISOString(),
    });
    if (els?.twCapOutlookTbody){
      els.twCapOutlookTbody.innerHTML = '<tr><td class="muted" colspan="5">No outlook data.</td></tr>';
    }
  };

  const getOverrideMode = (srcState) => {
    const state = srcState || (typeof getState === "function" ? getState() : null) || {};
    const raw = twCapClean(state?.twCapOverrideMode || "baseline");
    return ["baseline", "ramp", "scheduled", "max"].includes(raw) ? raw : "baseline";
  };

  const resolveOverrideAttempts = (srcState) => {
    const state = srcState || (typeof getState === "function" ? getState() : null) || {};
    if (!state?.twCapOverrideEnabled) return null;
    const mode = getOverrideMode(state);
    if (mode === "baseline"){
      return twCapNum(overrideCache?.week0?.baseline, null);
    }
    if (!overrideCache?.ready) return null;
    const target = twCapNum(overrideCache.week0?.[mode], null);
    return (target == null || !Number.isFinite(target)) ? null : Math.max(0, target);
  };

  const render = async (seq, horizonWeeks) => {
    if (seq !== outlookSeq) return;
    outlookLastRunMs = Date.now();

    twCapText(els.twCapOutlookStatus, "Updating Operations outlook…");

    const sourceState = (typeof getState === "function" ? getState() : null) || {};
    const opsSnapshot = await getOperationsMetricsSnapshot({
      context: {
        campaignId: sourceState.campaignId,
        campaignName: sourceState.campaignName,
        officeId: sourceState.officeId,
      },
    });
    const stores = opsSnapshot?.stores || {};
    const opsRollups = opsSnapshot?.rollups || {};
    const workforce = opsRollups?.workforce || {};
    const officeMix = Array.isArray(opsRollups?.officeMix) ? opsRollups.officeMix : [];
    const pipelineRecords = Array.isArray(stores.pipelineRecords) ? stores.pipelineRecords : [];
    const shiftRecords = Array.isArray(stores.shiftRecords) ? stores.shiftRecords : [];
    const forecastConfigs = Array.isArray(stores.forecastConfigs) ? stores.forecastConfigs : [];
    const interviews = Array.isArray(stores.interviews) ? stores.interviews : [];
    const onboardingRecords = Array.isArray(stores.onboardingRecords) ? stores.onboardingRecords : [];
    const trainingRecords = Array.isArray(stores.trainingRecords) ? stores.trainingRecords : [];
    if (seq !== outlookSeq) return;

    const state = sourceState;
    const effective = compileEffectiveInputs(state);
    const baselineAttempts = twCapBaselineAttemptsPerWeek(effective);
    const perOrganizerAttempts = twCapPerOrganizerAttemptsPerWeek(effective);
    const cfgRaw = (Array.isArray(forecastConfigs) ? forecastConfigs : []).find((x) => String(x?.id) === "default")
      || (Array.isArray(forecastConfigs) ? forecastConfigs[0] : null);
    const cfg = twCapNormalizeForecastConfig(cfgRaw);

    const week0 = twCapWeekStart(new Date());
    const rows = Array.from({ length: horizonWeeks }, (_, i) => ({
      weekStarting: twCapIsoUTC(new Date(week0.getTime() + (i * twCapWeekMs))),
      rampAdds: 0,
      scheduled: 0,
    }));

    let beyondHorizonAdds = 0;
    let openPipeline = 0;
    for (const rec of pipelineRecords){
      const stage = twCapClean(rec?.stage);
      const stageIdx = pipelineStages.indexOf(stage);
      if (stageIdx < 0) continue;
      if (stage === "Active") continue;
      if (twCapClean(rec?.dropoffReason)) continue;
      openPipeline += 1;

      let p = 1;
      let daysToActive = 0;
      for (let i = stageIdx; i < pipelineStages.length - 1; i++){
        const key = twCapTransitionKey(pipelineStages[i], pipelineStages[i + 1]);
        p *= clamp(twCapNum(cfg.stageConversionDefaults[key], 1), 0, 1);
        daysToActive += Math.max(0, twCapNum(cfg.stageDurationDefaultsDays[key], 0));
      }

      const baseDate = twCapParseDate(rec?.stageDates?.[stage]) || twCapParseDate(rec?.updatedAt) || twCapParseDate(rec?.createdAt) || new Date();
      const projected = new Date(baseDate.getTime() + (daysToActive * twCapDayMs));
      const weekStart = twCapWeekStart(projected);
      let idx = roundWholeNumberByMode((weekStart.getTime() - week0.getTime()) / twCapWeekMs, { mode: "floor", fallback: NaN });
      if (!Number.isFinite(idx)) continue;
      if (idx < 0) idx = 0;

      if (idx >= rows.length){
        beyondHorizonAdds += p;
        continue;
      }
      rows[idx].rampAdds += p;
    }

    for (const rec of shiftRecords){
      const dt = twCapParseDate(rec?.date) || twCapParseDate(rec?.checkInAt) || twCapParseDate(rec?.startAt);
      if (!dt) continue;
      const weekStart = twCapWeekStart(dt);
      const idx = roundWholeNumberByMode((weekStart.getTime() - week0.getTime()) / twCapWeekMs, { mode: "floor", fallback: NaN });
      if (!Number.isFinite(idx) || idx < 0 || idx >= rows.length) continue;
      rows[idx].scheduled += Math.max(0, twCapNum(rec?.attempts, 0));
    }

    let cumulativeAdds = 0;
    let scheduledTotal = 0;
    for (const row of rows){
      cumulativeAdds += row.rampAdds;
      row.baseline = baselineAttempts;
      row.ramp = baselineAttempts + (cumulativeAdds * perOrganizerAttempts);
      row.delta = row.scheduled - row.ramp;
      scheduledTotal += row.scheduled;
    }

    const expectedByEnd = rows.length ? rows[rows.length - 1].ramp : baselineAttempts;
    const expectedAddedFte = rows.reduce((acc, r) => acc + (r.rampAdds || 0), 0);
    const pipelineCount = pipelineRecords.length;
    const shiftCount = shiftRecords.length;
    const week0Row = rows[0] || { baseline: baselineAttempts, ramp: baselineAttempts, scheduled: 0 };

    const stageCounts = new Map(pipelineStages.map((s) => [s, 0]));
    for (const rec of pipelineRecords){
      const stage = twCapClean(rec?.stage);
      if (!stageCounts.has(stage)) continue;
      stageCounts.set(stage, Number(stageCounts.get(stage) || 0) + 1);
    }
    const offerExtendedCount = Number(stageCounts.get("Offer Extended") || 0);
    const offerAcceptedCount = Number(stageCounts.get("Offer Accepted") || 0);

    const interviewPassCount = interviews.filter((r) => twCapClean(r?.outcome) === "pass").length;
    const interviewCompleteCount = interviews.filter((r) => {
      const outcome = twCapClean(r?.outcome);
      return outcome && outcome !== "pending";
    }).length;

    const onboardingRows = onboardingRecords;
    const trainingRows = trainingRecords;
    const onboardingCompleted = onboardingRows.filter((r) => twCapClean(r?.onboardingStatus) === "completed").length;
    const trainingCompleted = trainingRows.filter((r) => twCapClean(r?.completionStatus) === "completed").length;

    const interviewPassRate = interviewCompleteCount > 0 ? (interviewPassCount / interviewCompleteCount) : null;
    const offerAcceptRate = offerExtendedCount > 0 ? (offerAcceptedCount / offerExtendedCount) : null;
    const onboardingCompletionRate = onboardingRows.length > 0 ? (onboardingCompleted / onboardingRows.length) : null;
    const trainingCompletionRate = trainingRows.length > 0 ? (trainingCompleted / trainingRows.length) : null;
    const compositeSignals = [interviewPassRate, offerAcceptRate, onboardingCompletionRate, trainingCompletionRate].filter((v) => Number.isFinite(v));
    const compositeRampSignal = compositeSignals.length ? (compositeSignals.reduce((a, b) => a + b, 0) / compositeSignals.length) : null;
    const readiness = twCapBuildReadinessStats(onboardingRows, trainingRows);

    overrideCache = {
      ready: true,
      week0: {
        baseline: twCapNum(week0Row.baseline, baselineAttempts),
        ramp: twCapNum(week0Row.ramp, baselineAttempts),
        scheduled: twCapNum(week0Row.scheduled, 0),
        max: Math.max(twCapNum(week0Row.ramp, baselineAttempts), twCapNum(week0Row.scheduled, 0)),
      },
      horizonWeeks: rows.length,
      updatedAt: new Date().toISOString(),
    };

    const activeMode = getOverrideMode(state);
    const activeSourceLabel = state?.twCapOverrideEnabled
      ? `Override ON · source: ${activeMode}`
      : "Override OFF";
    const expectedAddedText = twCapFmt2(expectedAddedFte);
    const beyondHorizonText = twCapFmt2(beyondHorizonAdds);
    const compositeSignalText = twCapFmtPct01(compositeRampSignal);

    twCapText(els.twCapOutlookActiveSource, activeSourceLabel);
    twCapText(els.twCapOutlookBaseline, twCapFmtInt(baselineAttempts));
    twCapText(els.twCapOutlookRampTotal, twCapFmtInt(expectedByEnd));
    twCapText(els.twCapOutlookScheduledTotal, twCapFmtInt(scheduledTotal));
    twCapText(els.twCapOutlookHorizon, `${rows.length} weeks · +${expectedAddedText} expected active`);
    twCapText(els.twDiagInterviewPass, twCapRatioText(interviewPassCount, interviewCompleteCount));
    twCapText(els.twDiagOfferAccept, twCapRatioText(offerAcceptedCount, offerExtendedCount));
    twCapText(els.twDiagOnboardingCompletion, twCapRatioText(onboardingCompleted, onboardingRows.length));
    twCapText(els.twDiagTrainingCompletion, twCapRatioText(trainingCompleted, trainingRows.length));
    twCapText(els.twDiagCompositeSignal, compositeSignalText);
    twCapText(els.twDiagReadyNow, twCapFmtInt(readiness.readyNow));
    twCapText(els.twDiagReadyPerWeek, twCapFmt1(readiness.recentReadyPerWeek));
    twCapText(els.twDiagReadyIn14d, twCapFmt1(readiness.projectedReady14d));
    twCapText(els.twDiagMedianReadyDays, Number.isFinite(readiness.medianReadyDays) ? twCapFmt1(readiness.medianReadyDays) : "—");
    twCapText(
      els.twDiagHintNote,
      Number.isFinite(compositeRampSignal)
        ? `Display-only diagnostics. Composite ramp signal ${compositeSignalText} (no engine mutation).`
        : "Display-only diagnostics. Add interview/onboarding/training records to unlock hints."
    );
    twCapText(
      els.twCapOutlookStatus,
      `Source: baseline + pipeline + shifts · pipeline open ${openPipeline}/${pipelineCount} · shifts ${shiftCount} · beyond horizon +${beyondHorizonText} expected active`
    );
    twCapText(
      els.twCapOutlookBasis,
      "Override is OFF by default. When enabled, FPE capacity uses selected Operations source with automatic fallback to baseline if data is unavailable."
    );

    writeOutlookSnapshot(state, {
      status: `Source: baseline + pipeline + shifts · pipeline open ${openPipeline}/${pipelineCount} · shifts ${shiftCount} · beyond horizon +${beyondHorizonText} expected active`,
      activeSource: activeSourceLabel,
      baseline: twCapFmtInt(baselineAttempts),
      rampTotal: twCapFmtInt(expectedByEnd),
      scheduledTotal: twCapFmtInt(scheduledTotal),
      horizon: `${rows.length} weeks · +${expectedAddedText} expected active`,
      interviewPass: twCapRatioText(interviewPassCount, interviewCompleteCount),
      offerAccept: twCapRatioText(offerAcceptedCount, offerExtendedCount),
      onboardingCompletion: twCapRatioText(onboardingCompleted, onboardingRows.length),
      trainingCompletion: twCapRatioText(trainingCompleted, trainingRows.length),
      compositeSignal: compositeSignalText,
      readyNow: twCapFmtInt(readiness.readyNow),
      readyPerWeek: twCapFmt1(readiness.recentReadyPerWeek),
      readyIn14d: twCapFmt1(readiness.projectedReady14d),
      medianReadyDays: Number.isFinite(readiness.medianReadyDays) ? twCapFmt1(readiness.medianReadyDays) : "—",
      hintNote: Number.isFinite(compositeRampSignal)
        ? `Display-only diagnostics. Composite ramp signal ${compositeSignalText} (no engine mutation).`
        : "Display-only diagnostics. Add interview/onboarding/training records to unlock hints.",
      basis: "Override is OFF by default. When enabled, FPE capacity uses selected Operations source with automatic fallback to baseline if data is unavailable.",
      rows: rows.map((row) => ({
        weekStarting: row.weekStarting,
        baseline: twCapFmtInt(row.baseline),
        ramp: twCapFmtInt(row.ramp),
        scheduled: twCapFmtInt(row.scheduled),
        delta: twCapFmtSigned(row.delta),
      })),
      workforce: {
        organizerCount: twCapNum(workforce.organizerCount, 0),
        paidCanvasserCount: twCapNum(workforce.paidCanvasserCount, 0),
        activeVolunteerCount: twCapNum(workforce.activeVolunteerCount, 0),
        activeHeadcount: twCapNum(workforce.activeHeadcount, 0),
        missingRoleTypedCount: twCapNum(workforce.missingRoleTypedCount, 0),
        roleTypingCoveragePct: twCapNum(workforce.roleTypingCoveragePct, 1),
        activePaidHeadcount: twCapNum(workforce.activePaidHeadcount, 0),
        activeStipendHeadcount: twCapNum(workforce.activeStipendHeadcount, 0),
        activeVolunteerHeadcount: twCapNum(workforce.activeVolunteerHeadcount, 0),
        volunteerShowRate: twCapNum(workforce.volunteerShowRate, null),
        organizerRecruitmentMultiplier: twCapNum(workforce.organizerRecruitmentMultiplier, 1),
        organizerSupervisionCapacity: twCapNum(workforce.organizerSupervisionCapacity, 0),
        paidCanvasserProductivity: twCapNum(workforce.paidCanvasserProductivity, 1),
        volunteerProductivity: twCapNum(workforce.volunteerProductivity, 1),
        paidRoleMultiplier: twCapNum(workforce.paidRoleMultiplier, 1),
        volunteerRoleMultiplier: twCapNum(workforce.volunteerRoleMultiplier, 1),
        roleCapacityMultiplier: twCapNum(workforce.roleCapacityMultiplier, 1),
      },
      officeMix: officeMix.map((row) => ({
        officeId: twCapClean(row?.officeId) || "unassigned",
        headcount: twCapNum(row?.headcount, 0),
        activeHeadcount: twCapNum(row?.activeHeadcount, 0),
        organizerCount: twCapNum(row?.organizerCount, 0),
        paidCanvasserCount: twCapNum(row?.paidCanvasserCount, 0),
        activeVolunteerCount: twCapNum(row?.activeVolunteerCount, 0),
        volunteerLeadCount: twCapNum(row?.volunteerLeadCount, 0),
        paidHeadcount: twCapNum(row?.paidHeadcount, 0),
        stipendHeadcount: twCapNum(row?.stipendHeadcount, 0),
        volunteerHeadcount: twCapNum(row?.volunteerHeadcount, 0),
      })),
      computedAt: new Date().toISOString(),
    });

    if (state?.twCapOverrideEnabled && activeMode !== "baseline"){
      const sig = JSON.stringify({
        mode: activeMode,
        h: overrideCache.horizonWeeks,
        b: overrideCache.week0?.baseline,
        r: overrideCache.week0?.ramp,
        s: overrideCache.week0?.scheduled,
        m: overrideCache.week0?.max,
      });
      if (sig !== overrideSig){
        overrideSig = sig;
        if (typeof markMcStale === "function") markMcStale();
        if (typeof scheduleRender === "function") scheduleRender();
      }
    } else {
      overrideSig = "";
    }

    if (els.twCapOutlookTbody){
      els.twCapOutlookTbody.innerHTML = "";
      for (const row of rows){
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td>${row.weekStarting}</td>
        <td class="num">${twCapFmtInt(row.baseline)}</td>
        <td class="num">${twCapFmtInt(row.ramp)}</td>
        <td class="num">${twCapFmtInt(row.scheduled)}</td>
        <td class="num">${twCapFmtSigned(row.delta)}</td>
      `;
        els.twCapOutlookTbody.appendChild(tr);
      }
    }
  };

  const schedule = (weeks) => {
    const seq = ++outlookSeq;
    if (outlookTimer) clearTimeout(outlookTimer);

    const state = (typeof getState === "function" ? getState() : null) || {};
    const w = (weeks != null && Number.isFinite(Number(weeks))) ? Number(weeks) : 12;
    const explicitHorizon = safeNum(state?.twCapOverrideHorizonWeeks);
    const rawHorizon = (explicitHorizon != null && Number.isFinite(explicitHorizon)) ? explicitHorizon : (w || 12);
    const horizonWeeksRaw = roundWholeNumberByMode(rawHorizon, { mode: "floor", fallback: 12 }) ?? 12;
    const horizonWeeks = Math.max(4, Math.min(52, horizonWeeksRaw));
    const nowMs = Date.now();
    const throttleMs = Math.max(0, 700 - (nowMs - outlookLastRunMs));
    const delayMs = Math.max(180, throttleMs);

    outlookTimer = setTimeout(() => {
      render(seq, horizonWeeks).catch((e) => {
        if (seq !== outlookSeq) return;
        emptyOutlook(e?.message ? String(e.message) : "Could not compute Operations outlook.");
      });
    }, delayMs);
  };

  return {
    schedule,
    emptyOutlook,
    getOverrideMode,
    resolveOverrideAttempts,
  };
}
