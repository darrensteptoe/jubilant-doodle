// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createReachBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const reachBridgeKey = String(deps.reachBridgeKey || "__FPE_REACH_API__");

  const REACH_OVERRIDE_MODE_OPTIONS = Array.isArray(deps.reachOverrideModeOptions)
    ? deps.reachOverrideModeOptions
    : [
      { value: "baseline", label: "Baseline (manual)" },
      { value: "ramp", label: "Ramp projection" },
      { value: "scheduled", label: "Scheduled attempts" },
      { value: "max", label: "Max(ramp, scheduled)" },
    ];
  const REACH_FIELD_RULES = deps.reachFieldRules && typeof deps.reachFieldRules === "object"
    ? deps.reachFieldRules
    : {
      persuasionPct: { min: 0, max: 100, step: 0.1 },
      earlyVoteExp: { min: 0, max: 100, step: 0.1 },
      supportRatePct: { min: 0, max: 100, step: 0.1 },
      contactRatePct: { min: 0, max: 100, step: 0.1 },
      goalSupportIds: { min: 0, max: 10000000, step: 1 },
      hoursPerShift: { min: 0, max: 24, step: 0.5 },
      shiftsPerVolunteerPerWeek: { min: 0, max: 21, step: 0.5 },
    };
  const REACH_NUMERIC_FIELDS = new Set(Object.keys(REACH_FIELD_RULES));

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };
  const getLastRenderCtx = () => {
    const value = call(deps.getLastRenderCtx);
    return value && typeof value === "object" ? value : {};
  };

  const isScenarioLockedForEdits = (...args) => call(deps.isScenarioLockedForEdits, ...args);
  const computeWeeklyOpsContext = (...args) => call(deps.computeWeeklyOpsContext, ...args);
  const computeExecutionSnapshot = (...args) => call(deps.computeExecutionSnapshot, ...args);
  const safeNum = (...args) => call(deps.safeNum, ...args);
  const buildReachWeeklyConstraintView = (...args) => call(deps.buildReachWeeklyConstraintView, ...args) || {};
  const buildReachWeeklyExecutionView = (...args) => call(deps.buildReachWeeklyExecutionView, ...args) || {};
  const buildReachFreshnessView = (...args) => call(deps.buildReachFreshnessView, ...args) || {};
  const buildReachLeversAndActionsView = (...args) => call(deps.buildReachLeversAndActionsView, ...args) || {};
  const computeCapacityBreakdown = (...args) => call(deps.computeCapacityBreakdown, ...args);
  const clamp = (...args) => call(deps.clamp, ...args);
  const computeRealityDrift = (...args) => call(deps.computeRealityDrift, ...args);
  const mutateState = (...args) => call(deps.mutateState, ...args);
  const setState = (...args) => call(deps.setState, ...args);
  const markMcStale = (...args) => call(deps.markMcStale, ...args);
  const applyRollingRateToAssumption = (...args) => call(deps.applyRollingRateToAssumption, ...args);
  const applyAllRollingCalibrations = (...args) => call(deps.applyAllRollingCalibrations, ...args);
  const mergeDailyLogIntoState = (...args) => call(deps.mergeDailyLogIntoState, ...args) || {};
  const exportDailyLog = (...args) => call(deps.exportDailyLog, ...args);
  const getLastAppliedWeeklyAction = (...args) => call(deps.getLastAppliedWeeklyAction, ...args);
  const undoLastWeeklyAction = (...args) => call(deps.undoLastWeeklyAction, ...args);
  const applyWeeklyLeverScenario = (...args) => call(deps.applyWeeklyLeverScenario, ...args);
  const formatWholeNumberByMode = (...args) => call(deps.formatWholeNumberByMode, ...args);
  const roundWholeNumberByMode = (...args) => call(deps.roundWholeNumberByMode, ...args);
  const fmtInt = (...args) => call(deps.fmtInt, ...args);
  const formatPercentFromUnit = (...args) => call(deps.formatPercentFromUnit, ...args);
  const formatFixedNumber = (...args) => call(deps.formatFixedNumber, ...args);

  const getWindowRef = () => {
    if (deps.windowRef && typeof deps.windowRef === "object"){
      return deps.windowRef;
    }
    return typeof window !== "undefined" ? window : null;
  };

  let reachBridgeDailyLogImportMsg = "";
  let reachBridgeApplyMsg = "";
  let reachBridgeCachedLevers = [];
  let reachBridgeCachedContext = null;

  function reachBridgeFmtInt(value, { ceil = false } = {}){
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return formatWholeNumberByMode(n, { mode: ceil ? "ceil" : "round", fallback: "—" });
  }

  function reachBridgeFmtSignedInt(value){
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) || 0;
    if (rounded > 0) return `+${fmtInt(rounded)}`;
    return `${fmtInt(rounded)}`;
  }

  function reachBridgeFmtPctFromRatio(value, digits = 1){
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return formatPercentFromUnit(n, digits, "—");
  }

  function reachBridgeFmtNum1(value){
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return formatFixedNumber(n, 1, "—");
  }

  function reachBridgeFmtISODate(raw){
    try{
      const dt = (raw instanceof Date) ? raw : new Date(raw);
      if (!Number.isFinite(dt.getTime())) return "—";
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return "—";
    }
  }

  function reachBridgeClampNumber(raw, { min = null, max = null, step = null } = {}){
    const text = String(raw ?? "").trim();
    if (!text) return "";
    const n = Number(text);
    if (!Number.isFinite(n)) return null;
    let out = n;
    if (min != null) out = Math.max(min, out);
    if (max != null) out = Math.min(max, out);
    if (step != null && Number.isFinite(step) && step > 0){
      const stepRounded = roundWholeNumberByMode(out / step, { mode: "round", fallback: 0 }) || 0;
      out = stepRounded * step;
    }
    return out;
  }

  function reachBridgeResolveContext(){
    const renderCtx = getLastRenderCtx();
    const currentState = getState();
    const res = renderCtx?.res || null;
    const weeks = Number.isFinite(renderCtx?.weeks) ? renderCtx.weeks : null;
    const weeklyContext = renderCtx?.weeklyContext || ((res && Number.isFinite(weeks)) ? computeWeeklyOpsContext(res, weeks) : null);

    let executionSnapshot = renderCtx?.executionSnapshot || null;
    if (!executionSnapshot && weeklyContext){
      const expectedAPH = (
        weeklyContext?.doorShare != null &&
        weeklyContext?.doorsPerHour != null &&
        weeklyContext?.callsPerHour != null
      )
        ? (weeklyContext.doorShare * weeklyContext.doorsPerHour + (1 - weeklyContext.doorShare) * weeklyContext.callsPerHour)
        : null;
      try{
        executionSnapshot = computeExecutionSnapshot({
          planningSnapshot: { weeks },
          weeklyContext,
          dailyLog: currentState?.ui?.dailyLog || [],
          assumedCR: weeklyContext?.cr ?? null,
          assumedSR: weeklyContext?.sr ?? null,
          expectedAPH,
          windowN: 7,
          safeNumFn: safeNum,
        });
      } catch {
        executionSnapshot = null;
      }
    }

    return {
      state: currentState,
      res,
      weeks,
      weeklyContext,
      executionSnapshot,
    };
  }

  function reachBridgeComputeWeeklyView(weeklyContext, executionSnapshot){
    const ctx = weeklyContext || {};
    const formatInt = (value, options = {}) => {
      if (!Number.isFinite(Number(value))) return "—";
      const mode = options?.ceil ? "ceil" : (options?.floor ? "floor" : "round");
      const n = roundWholeNumberByMode(Number(value), { mode, fallback: 0 }) || 0;
      return reachBridgeFmtInt(n);
    };
    const constraintView = buildReachWeeklyConstraintView(ctx, { formatInt });
    const weeklyExecution = buildReachWeeklyExecutionView({
      ctx,
      logSummary: executionSnapshot?.log || null,
      rollingCR: executionSnapshot?.rolling?.cr,
      formatInt,
      formatDate: reachBridgeFmtISODate,
      clampFn: clamp,
      hideChannelBreakdownWithoutLog: false,
    });

    return {
      goal: reachBridgeFmtInt(ctx?.goal ?? null),
      requiredAttempts: weeklyExecution.requiredAttemptsText,
      requiredConvos: weeklyExecution.requiredConvosText,
      requiredDoors: weeklyExecution.requiredDoorAttemptsText,
      requiredCalls: weeklyExecution.requiredCallAttemptsText,
      impliedConvos: weeklyExecution.impliedConvosText,
      impliedConvosNote: weeklyExecution.impliedConvosNote,
      capacity: reachBridgeFmtInt(ctx?.capTotal, { ceil: true }),
      gap: constraintView.gapText,
      constraint: constraintView.constraint,
      constraintNote: constraintView.constraintNote,
      paceStatus: weeklyExecution.paceStatus,
      paceNote: weeklyExecution.paceNote,
      finishConvos: weeklyExecution.finishConvosText,
      finishAttempts: weeklyExecution.finishAttemptsText,
      actualConvosNote: weeklyExecution.actualConvosNote,
      wkBanner: constraintView.wkBanner,
      wkExecBanner: weeklyExecution.wkExecBanner,
    };
  }

  function reachBridgeComputeFreshnessView(currentState, weeklyContext, executionSnapshot){
    return buildReachFreshnessView({
      state: currentState,
      weeklyContext,
      executionSnapshot,
      safeNumFn: safeNum,
      formatInt: (value, options = {}) => {
        if (!Number.isFinite(Number(value))) return "—";
        const mode = options?.ceil ? "ceil" : (options?.floor ? "floor" : "round");
        const n = roundWholeNumberByMode(Number(value), { mode, fallback: 0 }) || 0;
        return reachBridgeFmtInt(n);
      },
      formatPct: (value) => reachBridgeFmtPctFromRatio(value),
      formatNum1: (value) => reachBridgeFmtNum1(value),
    });
  }

  function reachBridgeBuildLeversAndActions(weeklyContext, executionSnapshot){
    return buildReachLeversAndActionsView({
      weeklyContext: weeklyContext || {},
      executionSnapshot,
      computeCapacityBreakdownFn: (payload) => computeCapacityBreakdown(payload),
      clampFn: clamp,
      computeRealityDriftFn: () => computeRealityDrift(),
      formatInt: (value, options = {}) => {
        if (!Number.isFinite(Number(value))) return "—";
        const mode = options?.ceil ? "ceil" : (options?.floor ? "floor" : "round");
        const n = roundWholeNumberByMode(Number(value), { mode, fallback: 0 }) || 0;
        return reachBridgeFmtInt(n);
      },
      formatNum1: (value) => reachBridgeFmtNum1(value),
    });
  }

  function reachBridgeStateView(){
    const { state: currentState, weeklyContext, executionSnapshot } = reachBridgeResolveContext();
    const weekly = reachBridgeComputeWeeklyView(weeklyContext, executionSnapshot);
    const freshness = reachBridgeComputeFreshnessView(currentState, weeklyContext, executionSnapshot);
    const leversAndActions = reachBridgeBuildLeversAndActions(weeklyContext, executionSnapshot);
    const outlookRaw = (currentState?.ui && typeof currentState.ui === "object")
      ? (currentState.ui.twCapOutlookLatest || null)
      : null;

    const locked = isScenarioLockedForEdits(currentState);
    const overrideEnabled = !!currentState?.twCapOverrideEnabled;
    const summary = {
      goal: weekly.goal,
      requiredAttempts: weekly.requiredAttempts,
      capacity: weekly.capacity,
      gap: weekly.gap,
      constraint: weekly.constraint,
      pace: weekly.paceStatus,
    };

    const leversById = [];
    leversAndActions.bestMoves.forEach((row) => {
      leversById.push({
        id: row.id,
        lever: row.lever,
      });
    });
    leversAndActions.rows.forEach((row) => {
      leversById.push({
        id: row.id,
        lever: row.lever,
      });
    });
    reachBridgeCachedLevers = leversById;
    reachBridgeCachedContext = weeklyContext || null;

    return {
      inputs: {
        persuasionPct: currentState?.persuasionPct ?? "",
        earlyVoteExp: currentState?.earlyVoteExp ?? "",
        supportRatePct: currentState?.supportRatePct ?? "",
        contactRatePct: currentState?.contactRatePct ?? "",
        goalSupportIds: currentState?.goalSupportIds ?? "",
        hoursPerShift: currentState?.hoursPerShift ?? "",
        shiftsPerVolunteerPerWeek: currentState?.shiftsPerVolunteerPerWeek ?? "",
        twCapOverrideEnabled: overrideEnabled,
        twCapOverrideMode: currentState?.twCapOverrideMode || "baseline",
        twCapOverrideHorizonWeeks: currentState?.twCapOverrideHorizonWeeks ?? "",
        dailyLogImportText: currentState?.ui?.dailyLogImportText || "",
      },
      controls: {
        locked,
        twCapOverrideModeDisabled: locked || !overrideEnabled,
        twCapOverrideHorizonWeeksDisabled: locked || !overrideEnabled,
        undoDisabled: !getLastAppliedWeeklyAction(),
      },
      options: {
        twCapOverrideMode: REACH_OVERRIDE_MODE_OPTIONS,
      },
      weekly,
      summary,
      freshness: {
        ...freshness,
        dailyLogImportMsg: reachBridgeDailyLogImportMsg || "",
        applyRollingMsg: reachBridgeApplyMsg || "",
        undoActionMsg: getLastAppliedWeeklyAction()?.label || "",
      },
      levers: {
        intro: leversAndActions.intro,
        foot: leversAndActions.foot,
        bestMovesIntro: leversAndActions.bestMovesIntro,
        showBestMoves: leversAndActions.showBestMoves,
        bestMoves: leversAndActions.bestMoves.map((row) => ({
          id: row.id,
          text: row.text,
        })),
        rows: leversAndActions.rows.map((row) => ({
          id: row.id,
          label: row.label,
          impact: row.impact,
          costUnit: row.costUnit,
          efficiency: row.efficiency,
        })),
      },
      actions: {
        list: leversAndActions.actions,
        note: leversAndActions.actionsNote,
      },
      outlook: {
        status: outlookRaw?.status || "No Operations data.",
        activeSource: outlookRaw?.activeSource || (overrideEnabled ? "Override ON · source unavailable" : "Override OFF"),
        baseline: outlookRaw?.baseline || "—",
        rampTotal: outlookRaw?.rampTotal || "—",
        scheduledTotal: outlookRaw?.scheduledTotal || "—",
        horizon: outlookRaw?.horizon || "—",
        interviewPass: outlookRaw?.interviewPass || "—",
        offerAccept: outlookRaw?.offerAccept || "—",
        onboardingCompletion: outlookRaw?.onboardingCompletion || "—",
        trainingCompletion: outlookRaw?.trainingCompletion || "—",
        compositeSignal: outlookRaw?.compositeSignal || "—",
        readyNow: outlookRaw?.readyNow || "—",
        readyPerWeek: outlookRaw?.readyPerWeek || "—",
        readyIn14d: outlookRaw?.readyIn14d || "—",
        medianReadyDays: outlookRaw?.medianReadyDays || "—",
        hintNote: outlookRaw?.hintNote || "Display-only diagnostics. Add interview/onboarding/training records to unlock hints.",
        basis: outlookRaw?.basis || "Override is OFF by default. When enabled, FPE capacity uses selected Operations source with automatic fallback to baseline if data is unavailable.",
        rows: Array.isArray(outlookRaw?.rows) ? outlookRaw.rows : [],
      },
    };
  }

  function reachBridgeSetField(field, rawValue){
    if (!field || !REACH_NUMERIC_FIELDS.has(field)){
      return { ok: false, code: "invalid_field", view: reachBridgeStateView() };
    }
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }

    const rules = REACH_FIELD_RULES[field] || {};
    const parsed = reachBridgeClampNumber(rawValue, rules);
    if (parsed === null){
      return { ok: false, code: "invalid_value", view: reachBridgeStateView() };
    }

    mutateState((next) => {
      next[field] = parsed;
    });
    markMcStale();
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeSetOverrideEnabled(enabled){
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }
    mutateState((next) => {
      next.twCapOverrideEnabled = !!enabled;
    });
    markMcStale();
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeSetOverrideMode(mode){
    const nextMode = String(mode || "").trim().toLowerCase();
    if (!REACH_OVERRIDE_MODE_OPTIONS.some((opt) => opt.value === nextMode)){
      return { ok: false, code: "invalid_mode", view: reachBridgeStateView() };
    }
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }
    mutateState((next) => {
      next.twCapOverrideMode = nextMode;
    });
    markMcStale();
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeSetOverrideHorizon(rawValue){
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }
    const parsed = reachBridgeClampNumber(rawValue, {
      min: 4,
      max: 52,
      step: 1,
    });
    if (parsed === null){
      return { ok: false, code: "invalid_value", view: reachBridgeStateView() };
    }
    mutateState((next) => {
      next.twCapOverrideHorizonWeeks = parsed;
    });
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeSetDailyLogImportText(value){
    const text = String(value ?? "");
    setState((next) => {
      if (!next.ui || typeof next.ui !== "object") next.ui = {};
      next.ui.dailyLogImportText = text;
    });
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeApplyRolling(kind){
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }
    const drift = computeRealityDrift();
    if (!drift?.hasLog){
      reachBridgeApplyMsg = "No daily log yet";
      return { ok: false, code: "no_log", view: reachBridgeStateView() };
    }
    applyRollingRateToAssumption(kind);
    if (kind === "contact") reachBridgeApplyMsg = "Applied rolling contact-rate calibration.";
    else if (kind === "support") reachBridgeApplyMsg = "Applied rolling support-rate calibration.";
    else if (kind === "productivity") reachBridgeApplyMsg = "Applied rolling productivity calibration.";
    else reachBridgeApplyMsg = "Applied rolling calibration.";
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeApplyRollingAll(){
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }
    const drift = computeRealityDrift();
    if (!drift?.hasLog){
      reachBridgeApplyMsg = "No daily log yet";
      return { ok: false, code: "no_log", view: reachBridgeStateView() };
    }
    applyAllRollingCalibrations();
    reachBridgeApplyMsg = "Applied all rolling calibrations.";
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeImportDailyLog(raw){
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }
    const text = String(raw ?? getState()?.ui?.dailyLogImportText ?? "").trim();
    if (!text){
      reachBridgeDailyLogImportMsg = "Paste JSON first";
      return { ok: false, code: "empty", view: reachBridgeStateView() };
    }
    let parsed = null;
    try{
      parsed = JSON.parse(text);
    } catch {
      reachBridgeDailyLogImportMsg = "Invalid JSON";
      return { ok: false, code: "invalid_json", view: reachBridgeStateView() };
    }
    const result = mergeDailyLogIntoState(parsed) || {};
    reachBridgeDailyLogImportMsg = String(result.msg || (result.ok ? "Imported." : "Import failed."));
    return { ok: !!result.ok, view: reachBridgeStateView() };
  }

  function reachBridgeExportDailyLog(){
    exportDailyLog();
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeUndoLastAction(){
    if (!getLastAppliedWeeklyAction()){
      reachBridgeApplyMsg = "No action to undo.";
      return { ok: false, code: "no_action", view: reachBridgeStateView() };
    }
    undoLastWeeklyAction();
    reachBridgeApplyMsg = "Undid last applied action.";
    return { ok: true, view: reachBridgeStateView() };
  }

  function reachBridgeApplyLever(id){
    if (isScenarioLockedForEdits(getState())){
      return { ok: false, code: "locked", view: reachBridgeStateView() };
    }
    const targetId = String(id || "").trim();
    if (!targetId){
      return { ok: false, code: "missing_id", view: reachBridgeStateView() };
    }
    const match = reachBridgeCachedLevers.find((row) => row.id === targetId);
    if (!match?.lever){
      return { ok: false, code: "not_found", view: reachBridgeStateView() };
    }
    applyWeeklyLeverScenario(match.lever, reachBridgeCachedContext || null);
    reachBridgeApplyMsg = `Applied: ${match.lever.label}`;
    return { ok: true, view: reachBridgeStateView() };
  }

  function installReachBridge(){
    const windowRef = getWindowRef();
    if (!windowRef || typeof windowRef !== "object"){
      return;
    }
    windowRef[reachBridgeKey] = {
      getView: () => reachBridgeStateView(),
      setField: (field, value) => reachBridgeSetField(field, value),
      setOverrideEnabled: (enabled) => reachBridgeSetOverrideEnabled(enabled),
      setOverrideMode: (mode) => reachBridgeSetOverrideMode(mode),
      setOverrideHorizon: (value) => reachBridgeSetOverrideHorizon(value),
      setDailyLogImportText: (value) => reachBridgeSetDailyLogImportText(value),
      importDailyLog: (raw) => reachBridgeImportDailyLog(raw),
      exportDailyLog: () => reachBridgeExportDailyLog(),
      applyRolling: (kind) => reachBridgeApplyRolling(kind),
      applyRollingAll: () => reachBridgeApplyRollingAll(),
      undoLastAction: () => reachBridgeUndoLastAction(),
      applyLever: (id) => reachBridgeApplyLever(id),
    };
  }

  return {
    reachBridgeFmtInt,
    reachBridgeFmtSignedInt,
    reachBridgeFmtPctFromRatio,
    reachBridgeFmtNum1,
    reachBridgeFmtISODate,
    reachBridgeClampNumber,
    reachBridgeResolveContext,
    reachBridgeComputeWeeklyView,
    reachBridgeComputeFreshnessView,
    reachBridgeBuildLeversAndActions,
    reachBridgeStateView,
    reachBridgeSetField,
    reachBridgeSetOverrideEnabled,
    reachBridgeSetOverrideMode,
    reachBridgeSetOverrideHorizon,
    reachBridgeSetDailyLogImportText,
    reachBridgeApplyRolling,
    reachBridgeApplyRollingAll,
    reachBridgeImportDailyLog,
    reachBridgeExportDailyLog,
    reachBridgeUndoLastAction,
    reachBridgeApplyLever,
    installReachBridge,
  };
}
