// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createOutcomeBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const outcomeBridgeKey = String(deps.outcomeBridgeKey || "__FPE_OUTCOME_API__");

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };

  const setState = (patchFn) => call(deps.setState, patchFn);
  const mutateState = (patchFn) => call(deps.mutateState, patchFn);
  const getLastRenderCtx = () => {
    const value = call(deps.getLastRenderCtx);
    return value && typeof value === "object" ? value : {};
  };

  const getStateSnapshot = (...args) => call(deps.getStateSnapshot, ...args);
  const isScenarioLockedForEdits = (...args) => call(deps.isScenarioLockedForEdits, ...args);
  const normalizeBridgeSelectOptions = (...args) => call(deps.normalizeBridgeSelectOptions, ...args) || [];
  const normalizeBridgeSelectValue = (...args) => call(deps.normalizeBridgeSelectValue, ...args) || "";
  const bridgeSelectOptionsWithSelected = (...args) => call(deps.bridgeSelectOptionsWithSelected, ...args) || [];
  const reachBridgeClampNumber = (...args) => call(deps.reachBridgeClampNumber, ...args);
  const surfaceLeverSpec = (...args) => call(deps.surfaceLeverSpec, ...args);
  const surfaceBaselineValue = (...args) => call(deps.surfaceBaselineValue, ...args);
  const surfaceClamp = (...args) => call(deps.surfaceClamp, ...args);
  const roundWholeNumberByMode = (...args) => call(deps.roundWholeNumberByMode, ...args);
  const safeNum = (...args) => call(deps.safeNum, ...args);
  const canonicalDoorsPerHourFromSnap = (...args) => call(deps.canonicalDoorsPerHourFromSnap, ...args);
  const canonicalCallsPerHourFromSnap = (...args) => call(deps.canonicalCallsPerHourFromSnap, ...args);
  const setCanonicalDoorsPerHour = (...args) => call(deps.setCanonicalDoorsPerHour, ...args);
  const setCanonicalCallsPerHour = (...args) => call(deps.setCanonicalCallsPerHour, ...args);
  const syncMcModeUI = (...args) => call(deps.syncMcModeUI, ...args);
  const markMcStale = (...args) => call(deps.markMcStale, ...args);
  const runMonteCarloNow = (...args) => call(deps.runMonteCarloNow, ...args);
  const computeRealityDrift = (...args) => call(deps.computeRealityDrift, ...args);
  const runRealismEngine = (...args) => call(deps.runRealismEngine, ...args);
  const computeEvidenceWarnings = (...args) => call(deps.computeEvidenceWarnings, ...args);
  const computeModelGovernance = (...args) => call(deps.computeModelGovernance, ...args);
  const buildGovernanceSnapshotView = (...args) => call(deps.buildGovernanceSnapshotView, ...args);
  const withPatchedState = (...args) => call(deps.withPatchedState, ...args);
  const runMonteCarloSim = (...args) => call(deps.runMonteCarloSim, ...args);
  const computeElectionSnapshot = (...args) => call(deps.computeElectionSnapshot, ...args);
  const buildModelInputFromState = (...args) => call(deps.buildModelInputFromState, ...args);
  const derivedWeeksRemaining = (...args) => call(deps.derivedWeeksRemaining, ...args);
  const deriveNeedVotes = (...args) => call(deps.deriveNeedVotes, ...args);
  const buildOutcomeSurfaceSummaryText = (...args) => call(deps.buildOutcomeSurfaceSummaryText, ...args) || "";

  const engine = deps.engine && typeof deps.engine === "object" ? deps.engine : {};

  const getWindowRef = () => {
    if (deps.windowRef && typeof deps.windowRef === "object"){
      return deps.windowRef;
    }
    return typeof window !== "undefined" ? window : null;
  };

  const getDocumentRef = () => {
    if (deps.documentRef && typeof deps.documentRef === "object"){
      return deps.documentRef;
    }
    return typeof document !== "undefined" ? document : null;
  };

  const isHtmlInput = (value) => typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement;
  const isHtmlSelect = (value) => typeof HTMLSelectElement !== "undefined" && value instanceof HTMLSelectElement;

  const OUTCOME_SELECT_OPTIONS = {
    mcMode: [
      { value: "basic", label: "Basic (volatility slider)" },
      { value: "advanced", label: "Advanced (min / mode / max)" },
    ],
    mcVolatility: [
      { value: "low", label: "Low" },
      { value: "med", label: "Medium" },
      { value: "high", label: "High" },
    ],
    surfaceLever: [
      { value: "volunteerMultiplier", label: "Volunteer multiplier" },
      { value: "supportRate", label: "Support rate (%)" },
      { value: "contactRate", label: "Contact rate (%)" },
      { value: "turnoutReliability", label: "Turnout reliability (%)" },
    ],
    surfaceMode: [
      { value: "fast", label: "Fast (2k runs)" },
      { value: "full", label: "Full (10k runs)" },
    ],
  };
  
  const OUTCOME_NUMERIC_RULES = {
    orgCount: { min: 0, max: 10000, step: 1, allowBlank: true },
    orgHoursPerWeek: { min: 0, max: 168, step: 1, allowBlank: true },
    volunteerMultBase: { min: 0, max: 20, step: 0.05, allowBlank: true },
    channelDoorPct: { min: 0, max: 100, step: 1, allowBlank: true },
    doorsPerHour3: { min: 0, max: 1000, step: 1, allowBlank: true },
    callsPerHour3: { min: 0, max: 1000, step: 1, allowBlank: true },
    turnoutReliabilityPct: { min: 0, max: 100, step: 0.5, allowBlank: true },
    mcContactMin: { min: 0, max: 100, step: 0.1, allowBlank: true },
    mcContactMode: { min: 0, max: 100, step: 0.1, allowBlank: true },
    mcContactMax: { min: 0, max: 100, step: 0.1, allowBlank: true },
    mcPersMin: { min: 0, max: 100, step: 0.1, allowBlank: true },
    mcPersMode: { min: 0, max: 100, step: 0.1, allowBlank: true },
    mcPersMax: { min: 0, max: 100, step: 0.1, allowBlank: true },
    mcReliMin: { min: 0, max: 100, step: 0.5, allowBlank: true },
    mcReliMode: { min: 0, max: 100, step: 0.5, allowBlank: true },
    mcReliMax: { min: 0, max: 100, step: 0.5, allowBlank: true },
    mcDphMin: { min: 0, max: 1000, step: 1, allowBlank: true },
    mcDphMode: { min: 0, max: 1000, step: 1, allowBlank: true },
    mcDphMax: { min: 0, max: 1000, step: 1, allowBlank: true },
    mcCphMin: { min: 0, max: 1000, step: 1, allowBlank: true },
    mcCphMode: { min: 0, max: 1000, step: 1, allowBlank: true },
    mcCphMax: { min: 0, max: 1000, step: 1, allowBlank: true },
    mcVolMin: { min: 0, max: 20, step: 0.05, allowBlank: true },
    mcVolMode: { min: 0, max: 20, step: 0.05, allowBlank: true },
    mcVolMax: { min: 0, max: 20, step: 0.05, allowBlank: true },
    surfaceMin: { min: -1000, max: 1000, step: 0.01, allowBlank: true },
    surfaceMax: { min: -1000, max: 1000, step: 0.01, allowBlank: true },
    surfaceSteps: { min: 5, max: 51, step: 1, allowBlank: true },
    surfaceTarget: { min: 50, max: 99, step: 1, allowBlank: true },
  };
  
  const OUTCOME_MODEL_SELECT_FIELDS = new Set(["mcMode", "mcVolatility"]);
  const OUTCOME_SURFACE_SELECT_FIELDS = new Set(["surfaceLever", "surfaceMode"]);
  const OUTCOME_TEXT_FIELDS = new Set(["mcSeed"]);
  const OUTCOME_MODEL_NUMERIC_FIELDS = new Set([
    "orgCount",
    "orgHoursPerWeek",
    "volunteerMultBase",
    "channelDoorPct",
    "doorsPerHour3",
    "callsPerHour3",
    "turnoutReliabilityPct",
    "mcContactMin",
    "mcContactMode",
    "mcContactMax",
    "mcPersMin",
    "mcPersMode",
    "mcPersMax",
    "mcReliMin",
    "mcReliMode",
    "mcReliMax",
    "mcDphMin",
    "mcDphMode",
    "mcDphMax",
    "mcCphMin",
    "mcCphMode",
    "mcCphMax",
    "mcVolMin",
    "mcVolMode",
    "mcVolMax",
  ]);
  const OUTCOME_SURFACE_NUMERIC_FIELDS = new Set([
    "surfaceMin",
    "surfaceMax",
    "surfaceSteps",
    "surfaceTarget",
  ]);
  const OUTCOME_SURFACE_DEFAULTS = {
    surfaceLever: "volunteerMultiplier",
    surfaceMode: "fast",
    surfaceSteps: "21",
    surfaceTarget: "70",
  };
  
  function outcomeBridgeSelectId(field){
    if (field === "mcMode") return "mcMode";
    if (field === "mcVolatility") return "mcVolatility";
    if (field === "surfaceLever") return "surfaceLever";
    if (field === "surfaceMode") return "surfaceMode";
    return "";
  }
  
  function outcomeBridgeControlId(field){
    if (field === "surfaceLever") return "surfaceLever";
    if (field === "surfaceMode") return "surfaceMode";
    if (field === "surfaceMin") return "surfaceMin";
    if (field === "surfaceMax") return "surfaceMax";
    if (field === "surfaceSteps") return "surfaceSteps";
    if (field === "surfaceTarget") return "surfaceTarget";
    return "";
  }
  
  function outcomeBridgeReadSelectOptions(field){
    return normalizeBridgeSelectOptions(OUTCOME_SELECT_OPTIONS[field] || []);
  }
  
  function outcomeBridgeReadLegacyControlValue(field){
    const id = outcomeBridgeControlId(field);
    if (!id){
      return "";
    }
    const documentRef = getDocumentRef();
    const control = documentRef && typeof documentRef.getElementById === "function"
      ? documentRef.getElementById(id)
      : null;
    if (!isHtmlInput(control) && !isHtmlSelect(control)){
      return "";
    }
    return String(control.value ?? "");
  }
  
  function outcomeBridgeDefaultSelectValue(field, preferredValue = ""){
    const options = outcomeBridgeReadSelectOptions(field);
    const preferred = String(preferredValue || "").trim();
    if (preferred && options.some((row) => String(row?.value ?? "") === preferred)){
      return preferred;
    }
    const fallback = String(OUTCOME_SURFACE_DEFAULTS[field] || "").trim();
    if (fallback && options.some((row) => String(row?.value ?? "") === fallback)){
      return fallback;
    }
    return options.length ? String(options[0]?.value ?? "") : "";
  }
  
  function outcomeBridgeResolvedSurfaceInputs(){
    const state = getState();
    const storedInputs = (state?.ui && typeof state.ui === "object" && state.ui.outcomeSurfaceInputs && typeof state.ui.outcomeSurfaceInputs === "object")
      ? state.ui.outcomeSurfaceInputs
      : {};
  
    const rawLever = String(
      storedInputs.surfaceLever ??
      ""
    );
    const surfaceLever = outcomeBridgeDefaultSelectValue("surfaceLever", rawLever);
    const spec = surfaceLeverSpec(surfaceLever) || surfaceLeverSpec(OUTCOME_SURFACE_DEFAULTS.surfaceLever);
  
    const rawMode = String(
      storedInputs.surfaceMode ??
      ""
    );
    const surfaceMode = outcomeBridgeDefaultSelectValue("surfaceMode", rawMode);
  
    const base = spec ? surfaceBaselineValue(spec) : null;
    const defaultMin = spec
      ? surfaceClamp((base != null ? Number(base) * 0.8 : spec.clampLo), spec.clampLo, spec.clampHi)
      : "";
    const defaultMax = spec
      ? surfaceClamp((base != null ? Number(base) * 1.2 : spec.clampHi), spec.clampLo, spec.clampHi)
      : "";
  
    const rawMin = storedInputs.surfaceMin ?? "";
    const minNum = Number(rawMin);
    const surfaceMin = Number.isFinite(minNum) && spec
      ? String(surfaceClamp(minNum, spec.clampLo, spec.clampHi))
      : (defaultMin === "" ? "" : String(defaultMin));
  
    const rawMax = storedInputs.surfaceMax ?? "";
    const maxNum = Number(rawMax);
    const surfaceMax = Number.isFinite(maxNum) && spec
      ? String(surfaceClamp(maxNum, spec.clampLo, spec.clampHi))
      : (defaultMax === "" ? "" : String(defaultMax));
  
    const rawSteps = storedInputs.surfaceSteps ?? "";
    const stepsNum = roundWholeNumberByMode(Number(rawSteps), { mode: "floor", fallback: null });
    const surfaceSteps = Number.isFinite(stepsNum)
      ? String(Math.max(5, Math.min(51, stepsNum)))
      : String(OUTCOME_SURFACE_DEFAULTS.surfaceSteps);
  
    const rawTarget = storedInputs.surfaceTarget ?? "";
    const targetNum = Number(rawTarget);
    const surfaceTarget = Number.isFinite(targetNum)
      ? String(Math.max(50, Math.min(99, roundWholeNumberByMode(targetNum, { mode: "round", fallback: 0 }) || 0)))
      : String(OUTCOME_SURFACE_DEFAULTS.surfaceTarget);
  
    return {
      surfaceLever,
      surfaceMode,
      surfaceMin,
      surfaceMax,
      surfaceSteps,
      surfaceTarget,
    };
  }
  
  function outcomeBridgeSyncLegacyControl(field, value){
    const id = outcomeBridgeControlId(field);
    const documentRef = getDocumentRef();
    const control = id && documentRef && typeof documentRef.getElementById === "function"
      ? documentRef.getElementById(id)
      : null;
    if (!isHtmlInput(control) && !isHtmlSelect(control)){
      return;
    }
    const nextValue = value == null ? "" : String(value);
    if (String(control.value ?? "") === nextValue){
      return;
    }
    control.value = nextValue;
    if (isHtmlInput(control)){
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
  
  function outcomeBridgeWriteSurfaceInputs(nextState, surfaceInputs){
    if (!nextState.ui || typeof nextState.ui !== "object"){
      nextState.ui = {};
    }
    if (!nextState.ui.outcomeSurfaceInputs || typeof nextState.ui.outcomeSurfaceInputs !== "object"){
      nextState.ui.outcomeSurfaceInputs = {};
    }
    const target = nextState.ui.outcomeSurfaceInputs;
    target.surfaceLever = String(surfaceInputs?.surfaceLever ?? "");
    target.surfaceMode = String(surfaceInputs?.surfaceMode ?? "");
    target.surfaceMin = String(surfaceInputs?.surfaceMin ?? "");
    target.surfaceMax = String(surfaceInputs?.surfaceMax ?? "");
    target.surfaceSteps = String(surfaceInputs?.surfaceSteps ?? "");
    target.surfaceTarget = String(surfaceInputs?.surfaceTarget ?? "");
  }
  
  function outcomeBridgeWriteSurfaceCache(nextState, { rows, statusText, summaryText } = {}){
    if (!nextState.ui || typeof nextState.ui !== "object"){
      nextState.ui = {};
    }
    nextState.ui.lastOutcomeSurfaceRows = Array.isArray(rows)
      ? rows.map((row) => ({
          leverValue: row?.leverValue ?? "",
          winProb: Number.isFinite(Number(row?.winProb)) ? Number(row.winProb) : null,
          p10: Number.isFinite(Number(row?.p10)) ? Number(row.p10) : null,
          p50: Number.isFinite(Number(row?.p50)) ? Number(row.p50) : null,
          p90: Number.isFinite(Number(row?.p90)) ? Number(row.p90) : null,
        }))
      : [];
    nextState.ui.lastOutcomeSurfaceStatus = String(statusText || "").trim();
    nextState.ui.lastOutcomeSurfaceSummary = String(summaryText || "").trim();
  }
  
  function outcomeBridgeSetSurfaceComputing(nextState, enabled){
    if (!nextState.ui || typeof nextState.ui !== "object"){
      nextState.ui = {};
    }
    nextState.ui.outcomeSurfaceComputing = !!enabled;
  }
  
  function outcomeBridgeNormalizeSelect(field, rawValue){
    const value = String(rawValue ?? "").trim();
    const options = outcomeBridgeReadSelectOptions(field);
    if (!value){
      return { ok: false, code: "invalid_value", value: "" };
    }
    const valid = options.some((row) => String(row?.value ?? "") === value);
    if (!valid){
      return { ok: false, code: "invalid_value", value: "" };
    }
    return { ok: true, code: "", value };
  }
  
  function outcomeBridgeNormalizeNumber(field, rawValue){
    const rules = OUTCOME_NUMERIC_RULES[field] || {};
    const parsed = reachBridgeClampNumber(rawValue, {
      min: rules.min,
      max: rules.max,
      step: rules.step,
    });
    if (parsed === null){
      return { ok: false, code: "invalid_value", value: null };
    }
    if ((parsed === "" || parsed == null) && rules.allowBlank){
      return { ok: true, code: "", value: "" };
    }
    return { ok: true, code: "", value: parsed };
  }
  
  function outcomeBridgeApplySurfaceField(field, rawValue){
    const current = outcomeBridgeResolvedSurfaceInputs();
    const next = { ...current };
  
    if (OUTCOME_SURFACE_SELECT_FIELDS.has(field)){
      const normalized = outcomeBridgeNormalizeSelect(field, rawValue);
      if (!normalized.ok){
        return { ok: false, code: normalized.code, view: outcomeBridgeCombinedView() };
      }
      next[field] = normalized.value;
      if (field === "surfaceLever"){
        const spec = surfaceLeverSpec(next.surfaceLever) || surfaceLeverSpec(OUTCOME_SURFACE_DEFAULTS.surfaceLever);
        if (spec){
          const base = surfaceBaselineValue(spec);
          const lo = base != null ? Number(base) * 0.8 : spec.clampLo;
          const hi = base != null ? Number(base) * 1.2 : spec.clampHi;
          next.surfaceMin = String(surfaceClamp(lo, spec.clampLo, spec.clampHi));
          next.surfaceMax = String(surfaceClamp(hi, spec.clampLo, spec.clampHi));
        }
      }
      setState((target) => {
        outcomeBridgeWriteSurfaceInputs(target, next);
      });
      outcomeBridgeSyncLegacyControl(field, next[field]);
      if (field === "surfaceLever"){
        outcomeBridgeSyncLegacyControl("surfaceMin", next.surfaceMin);
        outcomeBridgeSyncLegacyControl("surfaceMax", next.surfaceMax);
      }
      return { ok: true, view: outcomeBridgeCombinedView() };
    }
  
    const normalized = outcomeBridgeNormalizeNumber(field, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: outcomeBridgeCombinedView() };
    }
    next[field] = normalized.value === "" ? "" : String(normalized.value);
    setState((target) => {
      outcomeBridgeWriteSurfaceInputs(target, next);
    });
    outcomeBridgeSyncLegacyControl(field, next[field]);
    return { ok: true, view: outcomeBridgeCombinedView() };
  }
  
  function outcomeBridgeCanonicalView(){
    const state = getState();
    const locked = isScenarioLockedForEdits(state);
    const mcModeOptions = outcomeBridgeReadSelectOptions("mcMode");
    const mcVolatilityOptions = outcomeBridgeReadSelectOptions("mcVolatility");
    const surfaceLeverOptions = outcomeBridgeReadSelectOptions("surfaceLever");
    const surfaceModeOptions = outcomeBridgeReadSelectOptions("surfaceMode");
    const mcMode = normalizeBridgeSelectValue(state?.mcMode, mcModeOptions, "basic");
    const mcVolatility = normalizeBridgeSelectValue(state?.mcVolatility, mcVolatilityOptions, "med");
    const surfaceInputsRaw = outcomeBridgeResolvedSurfaceInputs();
    const surfaceLever = normalizeBridgeSelectValue(
      surfaceInputsRaw?.surfaceLever,
      surfaceLeverOptions,
      OUTCOME_SURFACE_DEFAULTS.surfaceLever,
    );
    const surfaceMode = normalizeBridgeSelectValue(
      surfaceInputsRaw?.surfaceMode,
      surfaceModeOptions,
      OUTCOME_SURFACE_DEFAULTS.surfaceMode,
    );
    const surfaceInputs = {
      ...surfaceInputsRaw,
      surfaceLever,
      surfaceMode,
    };
    const surfaceComputing = !!(state?.ui && state.ui.outcomeSurfaceComputing);
  
    return {
      inputs: {
        orgCount: state.orgCount ?? "",
        orgHoursPerWeek: state.orgHoursPerWeek ?? "",
        volunteerMultBase: state.volunteerMultBase ?? "",
        channelDoorPct: state.channelDoorPct ?? "",
        doorsPerHour3: canonicalDoorsPerHourFromSnap(state) ?? "",
        callsPerHour3: canonicalCallsPerHourFromSnap(state) ?? "",
        mcMode,
        mcSeed: state.mcSeed || "",
        mcVolatility,
        turnoutReliabilityPct: state.turnoutReliabilityPct ?? "",
        mcRuns: 10000,
        mcContactMin: state.mcContactMin ?? "",
        mcContactMode: state.mcContactMode ?? "",
        mcContactMax: state.mcContactMax ?? "",
        mcPersMin: state.mcPersMin ?? "",
        mcPersMode: state.mcPersMode ?? "",
        mcPersMax: state.mcPersMax ?? "",
        mcReliMin: state.mcReliMin ?? "",
        mcReliMode: state.mcReliMode ?? "",
        mcReliMax: state.mcReliMax ?? "",
        mcDphMin: state.mcDphMin ?? "",
        mcDphMode: state.mcDphMode ?? "",
        mcDphMax: state.mcDphMax ?? "",
        mcCphMin: state.mcCphMin ?? "",
        mcCphMode: state.mcCphMode ?? "",
        mcCphMax: state.mcCphMax ?? "",
        mcVolMin: state.mcVolMin ?? "",
        mcVolMode: state.mcVolMode ?? "",
        mcVolMax: state.mcVolMax ?? "",
        surfaceLever: surfaceInputs.surfaceLever,
        surfaceMode: surfaceInputs.surfaceMode,
        surfaceMin: surfaceInputs.surfaceMin,
        surfaceMax: surfaceInputs.surfaceMax,
        surfaceSteps: surfaceInputs.surfaceSteps,
        surfaceTarget: surfaceInputs.surfaceTarget,
      },
      options: {
        mcMode: bridgeSelectOptionsWithSelected(mcModeOptions, mcMode),
        mcVolatility: bridgeSelectOptionsWithSelected(mcVolatilityOptions, mcVolatility),
        surfaceLever: bridgeSelectOptionsWithSelected(surfaceLeverOptions, surfaceLever),
        surfaceMode: bridgeSelectOptionsWithSelected(surfaceModeOptions, surfaceMode),
      },
      controls: {
        locked,
        runDisabled: locked,
        rerunDisabled: locked,
        surfaceDisabled: locked || surfaceComputing,
      },
    };
  }
  
  function outcomeBridgeDerivedGovernanceView(){
    const state = getState();
    const lastRenderCtx = getLastRenderCtx();
    const mc = state?.mcLast;
    let governance = (state?.ui && typeof state.ui === "object" && state.ui.lastGovernanceSnapshot && typeof state.ui.lastGovernanceSnapshot === "object")
      ? { ...state.ui.lastGovernanceSnapshot }
      : null;
    try{
      const benchmarkWarnings = (engine?.snapshot?.computeAssumptionBenchmarkWarnings)
        ? engine.snapshot.computeAssumptionBenchmarkWarnings(state, "Benchmark")
        : [];
      const driftSummary = computeRealityDrift();
      const realism = runRealismEngine({
        state,
        res: lastRenderCtx?.res || {},
        weeks: lastRenderCtx?.weeks,
        driftSummary,
      });
      const evidenceWarnings = computeEvidenceWarnings(state, { limit: 3, staleDays: 30 });
      const full = computeModelGovernance({
        state,
        res: lastRenderCtx?.res || {},
        benchmarkWarnings,
        evidenceWarnings,
        driftSummary,
        realism,
      });
      if (full && typeof full === "object"){
        governance = buildGovernanceSnapshotView(full);
      }
    } catch {
      governance = null;
    }
    return governance;
  }
  
  function outcomeBridgeDerivedView(){
    const state = getState();
    const mc = state?.mcLast;
    const ce = mc?.confidenceEnvelope || null;
    const percentiles = ce?.percentiles || {};
    const risk = ce?.risk || {};
    const fragility = risk?.fragility || {};
    const advisor = risk?.advisor || {};
    const mcMeta = (state?.ui && typeof state.ui === "object" && state.ui.mcMeta && typeof state.ui.mcMeta === "object")
      ? state.ui.mcMeta
      : null;
    const governance = outcomeBridgeDerivedGovernanceView();
  
    let mcLastRun = "";
    if (mcMeta?.lastRunAt){
      try{
        mcLastRun = new Date(mcMeta.lastRunAt).toLocaleString();
      } catch {
        mcLastRun = String(mcMeta.lastRunAt || "");
      }
    }
  
    const mcFreshTag = !mc
      ? "MC pending"
      : (mcMeta?.isStale ? "Stale" : "Fresh");
    const mcStaleTag = !mc
      ? "No run yet"
      : (mcMeta?.isStale ? String(mcMeta.staleReason || "inputs changed") : "Current");
  
    const sensitivityRowsRaw = Array.isArray(state?.ui?.lastOutcomeSensitivityRows)
      ? state.ui.lastOutcomeSensitivityRows
      : [];
    const sensitivityRows = sensitivityRowsRaw.map((row) => ({
      label: String(row?.label || ""),
      impact: safeNum(row?.impact),
    }));
  
    const surfaceRowsRaw = Array.isArray(state?.ui?.lastOutcomeSurfaceRows)
      ? state.ui.lastOutcomeSurfaceRows
      : [];
    const surfaceRows = surfaceRowsRaw.map((row) => ({
      leverValue: row?.leverValue ?? "",
      winProb: safeNum(row?.winProb),
      p10: safeNum(row?.p10),
      p50: safeNum(row?.p50),
      p90: safeNum(row?.p90),
    }));
  
    const surfaceStatusText = String(state?.ui?.lastOutcomeSurfaceStatus || "").trim();
    const surfaceSummaryText = String(state?.ui?.lastOutcomeSurfaceSummary || "").trim();
  
    return {
      mc: {
        winProb: safeNum(mc?.winProb),
        p10: safeNum(percentiles?.p10),
        p50: safeNum(percentiles?.p50),
        p90: safeNum(percentiles?.p90),
        riskLabel: String(mc?.riskLabel || "").trim(),
        riskGrade: String(advisor?.grade || "").trim(),
        missRiskLabel: String(mc?.riskLabel || advisor?.grade || "").trim(),
        marginOfSafety: safeNum(risk?.marginOfSafety),
        downsideRiskMass: safeNum(risk?.downsideRiskMass),
        expectedShortfall10: safeNum(risk?.expectedShortfall10),
        requiredShiftP50: safeNum(risk?.breakEven?.requiredShiftP50),
        requiredShiftP10: safeNum(risk?.breakEven?.requiredShiftP10),
        shiftWin60: safeNum(risk?.targets?.shiftWin60),
        shiftWin70: safeNum(risk?.targets?.shiftWin70),
        shiftWin80: safeNum(risk?.targets?.shiftWin80),
        shockLoss10: safeNum(risk?.shocks?.lossProb10),
        shockLoss25: safeNum(risk?.shocks?.lossProb25),
        shockLoss50: safeNum(risk?.shocks?.lossProb50),
        fragilityIndex: safeNum(fragility?.fragilityIndex),
        cliffRisk: safeNum(fragility?.cliffRisk),
        freshTag: mcFreshTag,
        lastRun: mcLastRun,
        staleTag: mcStaleTag,
      },
      governance,
      sensitivityRows,
      surfaceRows,
      surfaceStatusText,
      surfaceSummaryText,
    };
  }
  
  function outcomeBridgeCombinedView(){
    const canonical = outcomeBridgeCanonicalView();
    const derived = outcomeBridgeDerivedView();
    return {
      inputs: canonical?.inputs && typeof canonical.inputs === "object" ? canonical.inputs : {},
      options: canonical?.options && typeof canonical.options === "object" ? canonical.options : {},
      controls: canonical?.controls && typeof canonical.controls === "object"
        ? canonical.controls
        : { locked: false, runDisabled: false, rerunDisabled: false, surfaceDisabled: false },
      mc: derived?.mc && typeof derived.mc === "object" ? derived.mc : {},
      governance: derived?.governance && typeof derived.governance === "object" ? derived.governance : null,
      sensitivityRows: Array.isArray(derived?.sensitivityRows) ? derived.sensitivityRows : [],
      surfaceRows: Array.isArray(derived?.surfaceRows) ? derived.surfaceRows : [],
      surfaceStatusText: String(derived?.surfaceStatusText || "").trim(),
      surfaceSummaryText: String(derived?.surfaceSummaryText || "").trim(),
      canonical,
      derived,
    };
  }
  
  function outcomeBridgeStateView(){
    return outcomeBridgeCombinedView();
  }
  
  function outcomeBridgeBuildSurfaceSummaryText({ spec, result, targetPercent } = {}){
    return buildOutcomeSurfaceSummaryText({
      spec,
      result,
      targetPercent,
    });
  }
  
  function outcomeBridgeSetField(field, rawValue){
    const state = getState();
    const key = String(field || "").trim();
    if (!key){
      return { ok: false, code: "invalid_field", view: outcomeBridgeCombinedView() };
    }
  
    if (OUTCOME_SURFACE_SELECT_FIELDS.has(key) || OUTCOME_SURFACE_NUMERIC_FIELDS.has(key)){
      return outcomeBridgeApplySurfaceField(key, rawValue);
    }
  
    if (!OUTCOME_MODEL_SELECT_FIELDS.has(key) && !OUTCOME_TEXT_FIELDS.has(key) && !OUTCOME_MODEL_NUMERIC_FIELDS.has(key)){
      return { ok: false, code: "invalid_field", view: outcomeBridgeCombinedView() };
    }
  
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: outcomeBridgeCombinedView() };
    }
  
    if (OUTCOME_MODEL_SELECT_FIELDS.has(key)){
      const normalized = outcomeBridgeNormalizeSelect(key, rawValue);
      if (!normalized.ok){
        return { ok: false, code: normalized.code, view: outcomeBridgeCombinedView() };
      }
      mutateState((next) => {
        if (key === "mcMode"){
          next.mcMode = normalized.value;
        } else if (key === "mcVolatility"){
          next.mcVolatility = normalized.value;
        }
      });
      if (key === "mcMode"){
        syncMcModeUI();
      }
      markMcStale();
      return { ok: true, view: outcomeBridgeCombinedView() };
    }
  
    if (OUTCOME_TEXT_FIELDS.has(key)){
      const value = String(rawValue ?? "");
      mutateState((next) => {
        if (key === "mcSeed"){
          next.mcSeed = value;
        }
      });
      markMcStale();
      return { ok: true, view: outcomeBridgeCombinedView() };
    }
  
    const normalized = outcomeBridgeNormalizeNumber(key, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: outcomeBridgeCombinedView() };
    }
    mutateState((next) => {
      const value = normalized.value;
      if (key === "orgCount"){
        next.orgCount = safeNum(value);
      } else if (key === "orgHoursPerWeek"){
        next.orgHoursPerWeek = safeNum(value);
      } else if (key === "volunteerMultBase"){
        next.volunteerMultBase = safeNum(value);
      } else if (key === "channelDoorPct"){
        next.channelDoorPct = safeNum(value);
      } else if (key === "doorsPerHour3"){
        setCanonicalDoorsPerHour(next, value);
      } else if (key === "callsPerHour3"){
        setCanonicalCallsPerHour(next, value);
      } else if (key === "turnoutReliabilityPct"){
        next.turnoutReliabilityPct = safeNum(value);
      } else if (key === "mcContactMin"){
        next.mcContactMin = safeNum(value);
      } else if (key === "mcContactMode"){
        next.mcContactMode = safeNum(value);
      } else if (key === "mcContactMax"){
        next.mcContactMax = safeNum(value);
      } else if (key === "mcPersMin"){
        next.mcPersMin = safeNum(value);
      } else if (key === "mcPersMode"){
        next.mcPersMode = safeNum(value);
      } else if (key === "mcPersMax"){
        next.mcPersMax = safeNum(value);
      } else if (key === "mcReliMin"){
        next.mcReliMin = safeNum(value);
      } else if (key === "mcReliMode"){
        next.mcReliMode = safeNum(value);
      } else if (key === "mcReliMax"){
        next.mcReliMax = safeNum(value);
      } else if (key === "mcDphMin"){
        next.mcDphMin = safeNum(value);
      } else if (key === "mcDphMode"){
        next.mcDphMode = safeNum(value);
      } else if (key === "mcDphMax"){
        next.mcDphMax = safeNum(value);
      } else if (key === "mcCphMin"){
        next.mcCphMin = safeNum(value);
      } else if (key === "mcCphMode"){
        next.mcCphMode = safeNum(value);
      } else if (key === "mcCphMax"){
        next.mcCphMax = safeNum(value);
      } else if (key === "mcVolMin"){
        next.mcVolMin = safeNum(value);
      } else if (key === "mcVolMode"){
        next.mcVolMode = safeNum(value);
      } else if (key === "mcVolMax"){
        next.mcVolMax = safeNum(value);
      }
    });
    markMcStale();
    return { ok: true, view: outcomeBridgeCombinedView() };
  }
  
  function outcomeBridgeRunMc(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: outcomeBridgeCombinedView() };
    }
    runMonteCarloNow();
    return { ok: true, view: outcomeBridgeCombinedView() };
  }
  
  function outcomeBridgeRerunMc(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: outcomeBridgeCombinedView() };
    }
    runMonteCarloNow();
    return { ok: true, view: outcomeBridgeCombinedView() };
  }
  
  function outcomeBridgeComputeSurface(){
    const state = getState();
    const surfaceInputs = outcomeBridgeResolvedSurfaceInputs();
    const spec = surfaceLeverSpec(surfaceInputs.surfaceLever);
    if (!spec){
      setState((next) => {
        outcomeBridgeWriteSurfaceInputs(next, surfaceInputs);
        outcomeBridgeSetSurfaceComputing(next, false);
        outcomeBridgeWriteSurfaceCache(next, {
          rows: [],
          statusText: "Unknown lever.",
          summaryText: String(next?.ui?.lastOutcomeSurfaceSummary || "").trim(),
        });
      });
      return { ok: false, code: "invalid_value", view: outcomeBridgeCombinedView() };
    }
  
    const minV = surfaceClamp(surfaceInputs.surfaceMin, spec.clampLo, spec.clampHi);
    const maxV = surfaceClamp(surfaceInputs.surfaceMax, spec.clampLo, spec.clampHi);
    const lo = Math.min(minV, maxV);
    const hi = Math.max(minV, maxV);
    const steps = Math.max(5, roundWholeNumberByMode(Number(surfaceInputs.surfaceSteps) || 21, { mode: "floor", fallback: 21 }) || 21);
    const runs = surfaceInputs.surfaceMode === "full" ? 10000 : 2000;
    const targetPercent = Number(surfaceInputs.surfaceTarget);
    const targetWinProb = Number.isFinite(targetPercent)
      ? surfaceClamp(targetPercent, 50, 99) / 100
      : 0.70;
  
    setState((next) => {
      outcomeBridgeWriteSurfaceInputs(next, {
        ...surfaceInputs,
        surfaceMin: String(lo),
        surfaceMax: String(hi),
        surfaceSteps: String(steps),
        surfaceTarget: String(roundWholeNumberByMode(targetWinProb * 100, { mode: "round", fallback: 70 }) || 70),
      });
      outcomeBridgeSetSurfaceComputing(next, true);
      outcomeBridgeWriteSurfaceCache(next, {
        rows: [],
        statusText: "Computing…",
        summaryText: String(next?.ui?.lastOutcomeSurfaceSummary || "").trim(),
      });
    });
    outcomeBridgeSyncLegacyControl("surfaceLever", surfaceInputs.surfaceLever);
    outcomeBridgeSyncLegacyControl("surfaceMode", surfaceInputs.surfaceMode);
    outcomeBridgeSyncLegacyControl("surfaceMin", String(lo));
    outcomeBridgeSyncLegacyControl("surfaceMax", String(hi));
    outcomeBridgeSyncLegacyControl("surfaceSteps", String(steps));
    outcomeBridgeSyncLegacyControl("surfaceTarget", String(roundWholeNumberByMode(targetWinProb * 100, { mode: "round", fallback: 70 }) || 70));
  
    try{
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
  
      const seed = state?.mcSeed || "";
      const result = engine.computeSensitivitySurface({
        engine: { withPatchedState, runMonteCarloSim },
        baseline: { res, weeks, needVotes, scenario: snap },
        sweep: {
          leverKey: surfaceInputs.surfaceLever,
          minValue: lo,
          maxValue: hi,
          steps,
        },
        options: { runs, seed, targetWinProb },
      });
  
      const doneStatus = `Done (${runs.toLocaleString()} runs × ${steps} points)`;
      const summaryText = outcomeBridgeBuildSurfaceSummaryText({
        spec,
        result,
        targetPercent: roundWholeNumberByMode(targetWinProb * 100, { mode: "round", fallback: 70 }) || 70,
      });
  
      setState((next) => {
        outcomeBridgeSetSurfaceComputing(next, false);
        outcomeBridgeWriteSurfaceCache(next, {
          rows: Array.isArray(result?.points) ? result.points : [],
          statusText: doneStatus,
          summaryText,
        });
      });
      return { ok: true, view: outcomeBridgeCombinedView() };
    } catch (err){
      const errText = err?.message ? err.message : String(err || "Error");
      setState((next) => {
        outcomeBridgeSetSurfaceComputing(next, false);
        outcomeBridgeWriteSurfaceCache(next, {
          rows: [],
          statusText: errText,
          summaryText: String(next?.ui?.lastOutcomeSurfaceSummary || "").trim(),
        });
      });
      return { ok: false, code: "runtime_error", view: outcomeBridgeCombinedView() };
    }
  }
  
  function installOutcomeBridge(){
    const windowRef = getWindowRef();
    if (!windowRef){
      return;
    }
    windowRef[outcomeBridgeKey] = {
      getCanonicalView: () => outcomeBridgeCanonicalView(),
      getDerivedView: () => outcomeBridgeDerivedView(),
      getView: () => outcomeBridgeCombinedView(),
      setField: (field, value) => outcomeBridgeSetField(field, value),
      runMc: () => outcomeBridgeRunMc(),
      rerunMc: () => outcomeBridgeRerunMc(),
      computeSurface: () => outcomeBridgeComputeSurface(),
    };
  }

  return {
    outcomeBridgeSelectId,
    outcomeBridgeControlId,
    outcomeBridgeReadSelectOptions,
    outcomeBridgeReadLegacyControlValue,
    outcomeBridgeDefaultSelectValue,
    outcomeBridgeResolvedSurfaceInputs,
    outcomeBridgeSyncLegacyControl,
    outcomeBridgeWriteSurfaceInputs,
    outcomeBridgeWriteSurfaceCache,
    outcomeBridgeSetSurfaceComputing,
    outcomeBridgeNormalizeSelect,
    outcomeBridgeNormalizeNumber,
    outcomeBridgeApplySurfaceField,
    outcomeBridgeCanonicalView,
    outcomeBridgeDerivedGovernanceView,
    outcomeBridgeDerivedView,
    outcomeBridgeCombinedView,
    outcomeBridgeStateView,
    outcomeBridgeBuildSurfaceSummaryText,
    outcomeBridgeSetField,
    outcomeBridgeRunMc,
    outcomeBridgeRerunMc,
    outcomeBridgeComputeSurface,
    installOutcomeBridge,
  };
}
