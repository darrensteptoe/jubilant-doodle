// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createPlanBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const planBridgeKey = String(deps.planBridgeKey || "__FPE_PLAN_API__");

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };

  const mutateState = (patchFn) => call(deps.mutateState, patchFn);
  const render = (...args) => call(deps.render, ...args);
  const isScenarioLockedForEdits = (...args) => call(deps.isScenarioLockedForEdits, ...args);

  const normalizeBridgeSelectOptions = (...args) => call(deps.normalizeBridgeSelectOptions, ...args) || [];
  const normalizeBridgeSelectValue = (...args) => call(deps.normalizeBridgeSelectValue, ...args) || "";
  const bridgeSelectOptionsWithSelected = (...args) => call(deps.bridgeSelectOptionsWithSelected, ...args) || [];

  const normalizeOptimizationObjective = (...args) => call(deps.normalizeOptimizationObjective, ...args) || "net";
  const getOptimizationObjectiveCopy = (...args) => call(deps.getOptimizationObjectiveCopy, ...args) || "";
  const buildCanonicalPlanSummaryView = (...args) => call(deps.buildCanonicalPlanSummaryView, ...args) || {};
  const normalizePlanOptimizerRows = (...args) => call(deps.normalizePlanOptimizerRows, ...args) || [];
  const getTimelineFeasibilityObjectiveMeta = (...args) => call(deps.getTimelineFeasibilityObjectiveMeta, ...args) || {};
  const getTimelineObjectiveMeta = (...args) => call(deps.getTimelineObjectiveMeta, ...args) || {};

  const formatWholeNumberByMode = (...args) => call(deps.formatWholeNumberByMode, ...args);
  const formatPlanWhole = (...args) => call(deps.formatPlanWhole, ...args);
  const formatPlanCurrency = (...args) => call(deps.formatPlanCurrency, ...args);
  const formatPlanPercentUnit = (...args) => call(deps.formatPlanPercentUnit, ...args);

  const reachBridgeClampNumber = (...args) => call(deps.reachBridgeClampNumber, ...args);
  const safeNum = (...args) => call(deps.safeNum, ...args);

  const getWindowRef = () => {
    if (deps.windowRef && typeof deps.windowRef === "object"){
      return deps.windowRef;
    }
    return typeof window !== "undefined" ? window : null;
  };

  const PLAN_SELECT_OPTIONS = {
    optMode: [
      { value: "budget", label: "Budget constrained" },
      { value: "goal", label: "Goal constrained" },
    ],
    optObjective: [
      { value: "net", label: "Max net votes" },
      { value: "reach", label: "Max reach" },
      { value: "cost", label: "Min cost" },
    ],
    tlOptObjective: [
      { value: "max_net", label: "Max net votes" },
      { value: "max_support_ids", label: "Max support IDs" },
      { value: "min_cost", label: "Min cost to target" },
    ],
    timelineRampMode: [
      { value: "linear", label: "Linear" },
      { value: "backloaded", label: "Backloaded" },
      { value: "frontloaded", label: "Frontloaded" },
    ],
  };

  const PLAN_NUMERIC_RULES = {
    optBudget: { min: 0, max: 100000000, step: 1 },
    optStep: { min: 1, max: 1000000, step: 1 },
    timelineActiveWeeks: { min: 0, max: 520, step: 1, allowBlank: true },
    timelineGotvWeeks: { min: 0, max: 52, step: 1, allowBlank: true },
    timelineStaffCount: { min: 0, max: 10000, step: 1 },
    timelineStaffHours: { min: 0, max: 168, step: 1 },
    timelineVolCount: { min: 0, max: 100000, step: 1 },
    timelineVolHours: { min: 0, max: 168, step: 1 },
    timelineDoorsPerHour: { min: 0, max: 1000, step: 1 },
    timelineCallsPerHour: { min: 0, max: 1000, step: 1 },
    timelineTextsPerHour: { min: 0, max: 5000, step: 1 },
  };

  const PLAN_BOOLEAN_FIELDS = new Set([
    "tlOptEnabled",
    "optUseDecay",
    "timelineEnabled",
    "timelineRampEnabled",
  ]);

  const PLAN_SELECT_FIELDS = new Set([
    "optMode",
    "optObjective",
    "tlOptObjective",
    "timelineRampMode",
  ]);

  const PLAN_NUMERIC_FIELDS = new Set(Object.keys(PLAN_NUMERIC_RULES));

  function ensurePlanBridgeShape(target){
    if (!target || typeof target !== "object"){
      return;
    }
    if (!target.budget || typeof target.budget !== "object"){
      target.budget = {};
    }
    if (!target.budget.optimize || typeof target.budget.optimize !== "object"){
      target.budget.optimize = {};
    }
    const optimize = target.budget.optimize;
    optimize.mode = normalizeBridgeSelectValue(optimize.mode, PLAN_SELECT_OPTIONS.optMode, "budget");
    optimize.objective = normalizeBridgeSelectValue(
      normalizeOptimizationObjective(optimize.objective, "net"),
      PLAN_SELECT_OPTIONS.optObjective,
      "net",
    );
    if (typeof optimize.tlConstrainedEnabled !== "boolean") optimize.tlConstrainedEnabled = false;
    optimize.tlConstrainedObjective = normalizeBridgeSelectValue(
      optimize.tlConstrainedObjective,
      PLAN_SELECT_OPTIONS.tlOptObjective,
      "max_net",
    );
    if (!Number.isFinite(Number(optimize.budgetAmount))) optimize.budgetAmount = 10000;
    if (!Number.isFinite(Number(optimize.step))) optimize.step = 25;
    if (typeof optimize.useDecay !== "boolean") optimize.useDecay = false;
    if (typeof target.timelineEnabled !== "boolean") target.timelineEnabled = false;
    if (target.timelineActiveWeeks == null) target.timelineActiveWeeks = "";
    if (target.timelineGotvWeeks == null) target.timelineGotvWeeks = "";
    if (!Number.isFinite(Number(target.timelineStaffCount))) target.timelineStaffCount = 0;
    if (!Number.isFinite(Number(target.timelineStaffHours))) target.timelineStaffHours = 0;
    if (!Number.isFinite(Number(target.timelineVolCount))) target.timelineVolCount = 0;
    if (!Number.isFinite(Number(target.timelineVolHours))) target.timelineVolHours = 0;
    if (typeof target.timelineRampEnabled !== "boolean") target.timelineRampEnabled = false;
    target.timelineRampMode = normalizeBridgeSelectValue(target.timelineRampMode, PLAN_SELECT_OPTIONS.timelineRampMode, "linear");
    if (!Number.isFinite(Number(target.timelineDoorsPerHour))) target.timelineDoorsPerHour = 30;
    if (!Number.isFinite(Number(target.timelineCallsPerHour))) target.timelineCallsPerHour = 20;
    if (!Number.isFinite(Number(target.timelineTextsPerHour))) target.timelineTextsPerHour = 120;
  }

  function planBridgeBuildSummaryView(){
    const state = getState();
    const objectiveCopy = getOptimizationObjectiveCopy(state?.budget?.optimize?.objective, "net");
    const conversion = state?.ui?.lastConversion && typeof state.ui.lastConversion === "object"
      ? state.ui.lastConversion
      : {};
    const timeline = state?.ui?.lastTimeline && typeof state.ui.lastTimeline === "object"
      ? state.ui.lastTimeline
      : {};
    const timelineObjectiveMeta = getTimelineFeasibilityObjectiveMeta(timeline);
    const tlMeta = state?.ui?.lastTlMeta && typeof state.ui.lastTlMeta === "object"
      ? state.ui.lastTlMeta
      : {};
    const tlObjectiveMeta = getTimelineObjectiveMeta(tlMeta);
    const lastSummary = state?.ui?.lastSummary && typeof state.ui.lastSummary === "object"
      ? state.ui.lastSummary
      : {};
    const upliftSummary = lastSummary?.upliftSummary && typeof lastSummary.upliftSummary === "object"
      ? lastSummary.upliftSummary
      : {};
    const lastOptTotals = state?.ui?.lastOpt?.totals && typeof state.ui.lastOpt.totals === "object"
      ? state.ui.lastOpt.totals
      : {};
    const lastOpt = state?.ui?.lastOpt && typeof state.ui.lastOpt === "object"
      ? state.ui.lastOpt
      : {};
    const diagnostics = state?.ui?.lastDiagnostics && typeof state.ui.lastDiagnostics === "object"
      ? state.ui.lastDiagnostics
      : {};
    return buildCanonicalPlanSummaryView({
      objectiveCopy,
      conversion,
      timeline,
      timelineObjectiveMeta,
      tlMeta,
      tlObjectiveMeta,
      lastSummary,
      upliftSummary,
      lastOptTotals,
      lastOpt,
      diagnostics,
      formatInt: (value) => formatWholeNumberByMode(value, { mode: "round", fallback: "—" }),
      formatWhole: formatPlanWhole,
      formatCurrency: formatPlanCurrency,
      formatPercentUnit: formatPlanPercentUnit,
    });
  }

  function planBridgeStateView(){
    const state = getState();
    ensurePlanBridgeShape(state);
    const optimize = state?.budget?.optimize || {};
    const optimizerRowsRaw = Array.isArray(state?.ui?.lastPlanRows) ? state.ui.lastPlanRows : [];
    const optimizerRows = normalizePlanOptimizerRows(optimizerRowsRaw);
    const locked = isScenarioLockedForEdits(state);
    const optModeOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.optMode);
    const optObjectiveOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.optObjective);
    const tlOptObjectiveOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.tlOptObjective);
    const timelineRampModeOptions = normalizeBridgeSelectOptions(PLAN_SELECT_OPTIONS.timelineRampMode);
    const optMode = normalizeBridgeSelectValue(optimize?.mode, optModeOptions, "budget");
    const optObjective = normalizeBridgeSelectValue(optimize?.objective, optObjectiveOptions, "net");
    const tlOptObjective = normalizeBridgeSelectValue(optimize?.tlConstrainedObjective, tlOptObjectiveOptions, "max_net");
    const timelineRampMode = normalizeBridgeSelectValue(state?.timelineRampMode, timelineRampModeOptions, "linear");
    return {
      inputs: {
        optMode,
        optObjective,
        tlOptEnabled: !!optimize.tlConstrainedEnabled,
        tlOptObjective,
        optBudget: optimize.budgetAmount ?? "",
        optStep: optimize.step ?? "",
        optUseDecay: !!optimize.useDecay,
        timelineEnabled: !!state.timelineEnabled,
        timelineActiveWeeks: state.timelineActiveWeeks ?? "",
        timelineGotvWeeks: state.timelineGotvWeeks ?? "",
        timelineStaffCount: state.timelineStaffCount ?? "",
        timelineStaffHours: state.timelineStaffHours ?? "",
        timelineVolCount: state.timelineVolCount ?? "",
        timelineVolHours: state.timelineVolHours ?? "",
        timelineRampEnabled: !!state.timelineRampEnabled,
        timelineRampMode,
        timelineDoorsPerHour: state.timelineDoorsPerHour ?? "",
        timelineCallsPerHour: state.timelineCallsPerHour ?? "",
        timelineTextsPerHour: state.timelineTextsPerHour ?? "",
      },
      controls: {
        locked,
        runDisabled: locked,
      },
      options: {
        optMode: bridgeSelectOptionsWithSelected(optModeOptions, optMode),
        optObjective: bridgeSelectOptionsWithSelected(optObjectiveOptions, optObjective),
        tlOptObjective: bridgeSelectOptionsWithSelected(tlOptObjectiveOptions, tlOptObjective),
        timelineRampMode: bridgeSelectOptionsWithSelected(timelineRampModeOptions, timelineRampMode),
      },
      optimizerRows,
      summary: planBridgeBuildSummaryView(),
    };
  }

  function planBridgeNormalizeSelect(field, rawValue){
    const options = PLAN_SELECT_OPTIONS[field];
    const text = String(rawValue ?? "").trim();
    if (!Array.isArray(options) || !options.length){
      return { ok: false, value: "", code: "invalid_field" };
    }
    if (options.some((opt) => String(opt?.value ?? "") === text)){
      return { ok: true, value: text, code: "" };
    }
    return { ok: false, value: "", code: "invalid_value" };
  }

  function planBridgeNormalizeNumber(field, rawValue){
    const rules = PLAN_NUMERIC_RULES[field] || {};
    const parsed = reachBridgeClampNumber(rawValue, {
      min: rules.min,
      max: rules.max,
      step: rules.step,
    });
    if (parsed === null){
      return { ok: false, value: null, code: "invalid_value" };
    }
    if ((parsed === "" || parsed == null) && rules.allowBlank){
      return { ok: true, value: "", code: "" };
    }
    return { ok: true, value: parsed, code: "" };
  }

  function planBridgeSetField(field, rawValue){
    const state = getState();
    const key = String(field || "").trim();
    if (!key){
      return { ok: false, code: "invalid_field", view: planBridgeStateView() };
    }
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: planBridgeStateView() };
    }

    let mode = "none";
    if (PLAN_BOOLEAN_FIELDS.has(key)) mode = "boolean";
    else if (PLAN_SELECT_FIELDS.has(key)) mode = "select";
    else if (PLAN_NUMERIC_FIELDS.has(key)) mode = "numeric";
    if (mode === "none"){
      return { ok: false, code: "invalid_field", view: planBridgeStateView() };
    }

    if (mode === "select"){
      const normalized = planBridgeNormalizeSelect(key, rawValue);
      if (!normalized.ok){
        return { ok: false, code: normalized.code, view: planBridgeStateView() };
      }
      mutateState((next) => {
        ensurePlanBridgeShape(next);
        if (key === "optMode"){
          next.budget.optimize.mode = normalized.value;
        } else if (key === "optObjective"){
          next.budget.optimize.objective = normalized.value;
        } else if (key === "tlOptObjective"){
          next.budget.optimize.tlConstrainedObjective = normalized.value;
        } else if (key === "timelineRampMode"){
          next.timelineRampMode = normalized.value;
        }
      });
      return { ok: true, view: planBridgeStateView() };
    }

    if (mode === "boolean"){
      const checked = !!rawValue;
      mutateState((next) => {
        ensurePlanBridgeShape(next);
        if (key === "tlOptEnabled"){
          next.budget.optimize.tlConstrainedEnabled = checked;
        } else if (key === "optUseDecay"){
          next.budget.optimize.useDecay = checked;
        } else if (key === "timelineEnabled"){
          next.timelineEnabled = checked;
        } else if (key === "timelineRampEnabled"){
          next.timelineRampEnabled = checked;
        }
      });
      return { ok: true, view: planBridgeStateView() };
    }

    const normalized = planBridgeNormalizeNumber(key, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: planBridgeStateView() };
    }
    mutateState((next) => {
      ensurePlanBridgeShape(next);
      const value = normalized.value;
      if (key === "optBudget"){
        next.budget.optimize.budgetAmount = safeNum(value) ?? 0;
      } else if (key === "optStep"){
        next.budget.optimize.step = safeNum(value) ?? 25;
      } else if (key === "timelineActiveWeeks"){
        next.timelineActiveWeeks = value === "" ? "" : String(value);
      } else if (key === "timelineGotvWeeks"){
        next.timelineGotvWeeks = safeNum(value);
      } else if (key === "timelineStaffCount"){
        next.timelineStaffCount = safeNum(value) ?? 0;
      } else if (key === "timelineStaffHours"){
        next.timelineStaffHours = safeNum(value) ?? 0;
      } else if (key === "timelineVolCount"){
        next.timelineVolCount = safeNum(value) ?? 0;
      } else if (key === "timelineVolHours"){
        next.timelineVolHours = safeNum(value) ?? 0;
      } else if (key === "timelineDoorsPerHour"){
        next.timelineDoorsPerHour = safeNum(value) ?? 0;
      } else if (key === "timelineCallsPerHour"){
        next.timelineCallsPerHour = safeNum(value) ?? 0;
      } else if (key === "timelineTextsPerHour"){
        next.timelineTextsPerHour = safeNum(value) ?? 0;
      }
    });
    return { ok: true, view: planBridgeStateView() };
  }

  function planBridgeRunOptimize(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: planBridgeStateView() };
    }
    render();
    return { ok: true, view: planBridgeStateView() };
  }

  function installPlanBridge(){
    const windowRef = getWindowRef();
    if (!windowRef){
      return;
    }
    windowRef[planBridgeKey] = {
      getView: () => planBridgeStateView(),
      setField: (field, value) => planBridgeSetField(field, value),
      runOptimize: () => planBridgeRunOptimize(),
    };
  }

  return {
    ensurePlanBridgeShape,
    planBridgeBuildSummaryView,
    planBridgeStateView,
    planBridgeNormalizeSelect,
    planBridgeNormalizeNumber,
    planBridgeSetField,
    planBridgeRunOptimize,
    installPlanBridge,
  };
}
