// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createTurnoutBridgeRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const turnoutBridgeKey = String(deps.turnoutBridgeKey || "__FPE_TURNOUT_API__");

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };

  const mutateState = (patchFn) => call(deps.mutateState, patchFn);
  const render = (...args) => call(deps.render, ...args);
  const isScenarioLockedForEdits = (...args) => call(deps.isScenarioLockedForEdits, ...args);

  const normalizeBridgeSelectValue = (...args) => call(deps.normalizeBridgeSelectValue, ...args) || "";
  const normalizeBridgeSelectOptions = (...args) => call(deps.normalizeBridgeSelectOptions, ...args) || [];
  const bridgeSelectOptionsWithSelected = (...args) => call(deps.bridgeSelectOptionsWithSelected, ...args) || [];

  const reachBridgeClampNumber = (...args) => call(deps.reachBridgeClampNumber, ...args);
  const safeNum = (...args) => call(deps.safeNum, ...args);
  const syncGotvModeUI = (...args) => call(deps.syncGotvModeUI, ...args);
  const markMcStale = (...args) => call(deps.markMcStale, ...args);

  const getWindowRef = () => {
    if (deps.windowRef && typeof deps.windowRef === "object"){
      return deps.windowRef;
    }
    return typeof window !== "undefined" ? window : null;
  };

  const TURNOUT_SELECT_OPTIONS = {
    gotvMode: [
      { value: "basic", label: "Basic (single lift)" },
      { value: "advanced", label: "Advanced (min/mode/max)" },
    ],
    tacticKind: [
      { value: "persuasion", label: "Persuasion" },
      { value: "gotv", label: "GOTV" },
      { value: "hybrid", label: "Hybrid" },
    ],
  };

  const TURNOUT_NUMERIC_RULES = {
    turnoutBaselinePct: { min: 0, max: 100, step: 0.5, allowBlank: true },
    turnoutTargetOverridePct: { min: 0, max: 100, step: 0.5, allowBlank: true },
    gotvLiftPP: { min: 0, max: 25, step: 0.1, allowBlank: true },
    gotvMaxLiftPP: { min: 0, max: 50, step: 0.5, allowBlank: true },
    gotvLiftMin: { min: 0, max: 25, step: 0.1, allowBlank: true },
    gotvLiftMode: { min: 0, max: 25, step: 0.1, allowBlank: true },
    gotvLiftMax: { min: 0, max: 25, step: 0.1, allowBlank: true },
    gotvMaxLiftPP2: { min: 0, max: 50, step: 0.5, allowBlank: true },
    roiDoorsCpa: { min: 0, max: 1000000, step: 0.01 },
    roiDoorsCr: { min: 0, max: 100, step: 0.1, allowBlank: true },
    roiDoorsSr: { min: 0, max: 100, step: 0.1, allowBlank: true },
    roiPhonesCpa: { min: 0, max: 1000000, step: 0.01 },
    roiPhonesCr: { min: 0, max: 100, step: 0.1, allowBlank: true },
    roiPhonesSr: { min: 0, max: 100, step: 0.1, allowBlank: true },
    roiTextsCpa: { min: 0, max: 1000000, step: 0.01 },
    roiTextsCr: { min: 0, max: 100, step: 0.1, allowBlank: true },
    roiTextsSr: { min: 0, max: 100, step: 0.1, allowBlank: true },
    roiOverheadAmount: { min: 0, max: 1000000000, step: 1 },
  };

  const TURNOUT_BOOLEAN_FIELDS = new Set([
    "turnoutEnabled",
    "gotvDiminishing",
    "roiDoorsEnabled",
    "roiPhonesEnabled",
    "roiTextsEnabled",
    "roiIncludeOverhead",
  ]);

  const TURNOUT_SELECT_FIELDS = new Set([
    "gotvMode",
    "roiDoorsKind",
    "roiPhonesKind",
    "roiTextsKind",
  ]);

  const TURNOUT_NUMERIC_FIELDS = new Set(Object.keys(TURNOUT_NUMERIC_RULES));

  function ensureTurnoutBridgeShape(target){
    if (!target || typeof target !== "object"){
      return;
    }
    if (!target.budget || typeof target.budget !== "object"){
      target.budget = {};
    }
    if (!target.budget.tactics || typeof target.budget.tactics !== "object"){
      target.budget.tactics = {};
    }
    const tactics = target.budget.tactics;
    if (!tactics.doors || typeof tactics.doors !== "object"){
      tactics.doors = { enabled: true, cpa: 0.18, kind: "persuasion" };
    }
    if (!tactics.phones || typeof tactics.phones !== "object"){
      tactics.phones = { enabled: true, cpa: 0.03, kind: "persuasion" };
    }
    if (!tactics.texts || typeof tactics.texts !== "object"){
      tactics.texts = { enabled: false, cpa: 0.02, kind: "persuasion" };
    }
    if (typeof target.turnoutEnabled !== "boolean") target.turnoutEnabled = false;
    if (!Number.isFinite(Number(target.turnoutBaselinePct))) target.turnoutBaselinePct = 55;
    if (target.turnoutTargetOverridePct == null) target.turnoutTargetOverridePct = "";
    if (!target.gotvMode) target.gotvMode = "basic";
    if (!Number.isFinite(Number(target.gotvLiftPP))) target.gotvLiftPP = 1.0;
    if (!Number.isFinite(Number(target.gotvMaxLiftPP))) target.gotvMaxLiftPP = 10;
    if (typeof target.gotvDiminishing !== "boolean") target.gotvDiminishing = false;
    if (!Number.isFinite(Number(target.gotvLiftMin))) target.gotvLiftMin = 0.5;
    if (!Number.isFinite(Number(target.gotvLiftMode))) target.gotvLiftMode = 1.0;
    if (!Number.isFinite(Number(target.gotvLiftMax))) target.gotvLiftMax = 2.0;
    if (!Number.isFinite(Number(target.gotvMaxLiftPP2))) target.gotvMaxLiftPP2 = 10;
    if (typeof target.budget.includeOverhead !== "boolean") target.budget.includeOverhead = false;
    if (!Number.isFinite(Number(target.budget.overheadAmount))) target.budget.overheadAmount = 0;
    target.gotvMode = normalizeBridgeSelectValue(target.gotvMode, TURNOUT_SELECT_OPTIONS.gotvMode, "basic");
    tactics.doors.kind = normalizeBridgeSelectValue(tactics?.doors?.kind, TURNOUT_SELECT_OPTIONS.tacticKind, "persuasion");
    tactics.phones.kind = normalizeBridgeSelectValue(tactics?.phones?.kind, TURNOUT_SELECT_OPTIONS.tacticKind, "persuasion");
    tactics.texts.kind = normalizeBridgeSelectValue(tactics?.texts?.kind, TURNOUT_SELECT_OPTIONS.tacticKind, "persuasion");
  }

  function turnoutBridgeStateView(){
    const state = getState();
    ensureTurnoutBridgeShape(state);
    const tactics = state?.budget?.tactics || {};
    const doors = tactics?.doors || {};
    const phones = tactics?.phones || {};
    const texts = tactics?.texts || {};
    const roiRowsRaw = Array.isArray(state?.ui?.lastRoiRows) ? state.ui.lastRoiRows : [];
    const roiRows = roiRowsRaw.map((row) => ({
      label: String(row?.label || ""),
      cpa: safeNum(row?.cpa),
      costPerNetVote: safeNum(row?.costPerNetVote),
      costPerTurnoutAdjustedNetVote: safeNum(row?.costPerTurnoutAdjustedNetVote),
      totalCost: safeNum(row?.totalCost),
      feasibilityText: String(row?.feasibilityText || ""),
    }));
    const roiBannerText = String(state?.ui?.lastRoiBanner?.text || "").trim();
    const turnoutSummary = state?.ui?.lastTurnout && typeof state.ui.lastTurnout === "object"
      ? state.ui.lastTurnout
      : {};
    const locked = isScenarioLockedForEdits(state);
    const gotvModeOptions = normalizeBridgeSelectOptions(TURNOUT_SELECT_OPTIONS.gotvMode);
    const tacticKindOptions = normalizeBridgeSelectOptions(TURNOUT_SELECT_OPTIONS.tacticKind);
    const gotvMode = normalizeBridgeSelectValue(state?.gotvMode, gotvModeOptions, "basic");
    const roiDoorsKind = normalizeBridgeSelectValue(doors?.kind, tacticKindOptions, "persuasion");
    const roiPhonesKind = normalizeBridgeSelectValue(phones?.kind, tacticKindOptions, "persuasion");
    const roiTextsKind = normalizeBridgeSelectValue(texts?.kind, tacticKindOptions, "persuasion");
    return {
      inputs: {
        turnoutEnabled: !!state.turnoutEnabled,
        turnoutBaselinePct: state.turnoutBaselinePct ?? "",
        turnoutTargetOverridePct: state.turnoutTargetOverridePct ?? "",
        gotvMode,
        gotvDiminishing: !!state.gotvDiminishing,
        gotvLiftPP: state.gotvLiftPP ?? "",
        gotvMaxLiftPP: state.gotvMaxLiftPP ?? "",
        gotvLiftMin: state.gotvLiftMin ?? "",
        gotvLiftMode: state.gotvLiftMode ?? "",
        gotvLiftMax: state.gotvLiftMax ?? "",
        gotvMaxLiftPP2: state.gotvMaxLiftPP2 ?? "",
        roiDoorsEnabled: !!doors.enabled,
        roiDoorsCpa: doors.cpa ?? "",
        roiDoorsKind,
        roiDoorsCr: doors.crPct ?? "",
        roiDoorsSr: doors.srPct ?? "",
        roiPhonesEnabled: !!phones.enabled,
        roiPhonesCpa: phones.cpa ?? "",
        roiPhonesKind,
        roiPhonesCr: phones.crPct ?? "",
        roiPhonesSr: phones.srPct ?? "",
        roiTextsEnabled: !!texts.enabled,
        roiTextsCpa: texts.cpa ?? "",
        roiTextsKind,
        roiTextsCr: texts.crPct ?? "",
        roiTextsSr: texts.srPct ?? "",
        roiOverheadAmount: state?.budget?.overheadAmount ?? "",
        roiIncludeOverhead: !!state?.budget?.includeOverhead,
      },
      controls: {
        locked,
        refreshDisabled: false,
      },
      options: {
        gotvMode: bridgeSelectOptionsWithSelected(gotvModeOptions, gotvMode),
        tacticKind: bridgeSelectOptionsWithSelected(tacticKindOptions, roiDoorsKind),
      },
      roiRows,
      roiBannerText,
      summary: {
        turnoutSummaryText: String(turnoutSummary.summaryText || "").trim(),
        turnoutVotesText: String(turnoutSummary.turnoutVotesText || "").trim(),
        needVotesText: String(turnoutSummary.needVotesText || "").trim(),
      },
    };
  }

  function turnoutBridgeNormalizeSelect(field, rawValue){
    const text = String(rawValue ?? "").trim();
    if (!text){
      return { ok: false, value: "", code: "invalid_value" };
    }
    if (field === "gotvMode"){
      const ok = TURNOUT_SELECT_OPTIONS.gotvMode.some((opt) => String(opt?.value ?? "") === text);
      return ok ? { ok: true, value: text, code: "" } : { ok: false, value: "", code: "invalid_value" };
    }
    if (field === "roiDoorsKind" || field === "roiPhonesKind" || field === "roiTextsKind"){
      const ok = TURNOUT_SELECT_OPTIONS.tacticKind.some((opt) => String(opt?.value ?? "") === text);
      return ok ? { ok: true, value: text, code: "" } : { ok: false, value: "", code: "invalid_value" };
    }
    return { ok: false, value: "", code: "invalid_field" };
  }

  function turnoutBridgeNormalizeNumber(field, rawValue){
    const rules = TURNOUT_NUMERIC_RULES[field] || {};
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

  function turnoutBridgeSetField(field, rawValue){
    const state = getState();
    const key = String(field || "").trim();
    if (!key){
      return { ok: false, code: "invalid_field", view: turnoutBridgeStateView() };
    }
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: turnoutBridgeStateView() };
    }

    let mode = "none";
    if (TURNOUT_BOOLEAN_FIELDS.has(key)) mode = "boolean";
    else if (TURNOUT_SELECT_FIELDS.has(key)) mode = "select";
    else if (TURNOUT_NUMERIC_FIELDS.has(key)) mode = "numeric";
    if (mode === "none"){
      return { ok: false, code: "invalid_field", view: turnoutBridgeStateView() };
    }

    if (mode === "select"){
      const normalized = turnoutBridgeNormalizeSelect(key, rawValue);
      if (!normalized.ok){
        return { ok: false, code: normalized.code, view: turnoutBridgeStateView() };
      }
      mutateState((next) => {
        ensureTurnoutBridgeShape(next);
        if (key === "gotvMode"){
          next.gotvMode = normalized.value;
        } else if (key === "roiDoorsKind"){
          next.budget.tactics.doors.kind = normalized.value;
        } else if (key === "roiPhonesKind"){
          next.budget.tactics.phones.kind = normalized.value;
        } else if (key === "roiTextsKind"){
          next.budget.tactics.texts.kind = normalized.value;
        }
      });
      if (key === "gotvMode"){
        syncGotvModeUI();
      }
      markMcStale();
      return { ok: true, view: turnoutBridgeStateView() };
    }

    if (mode === "boolean"){
      const checked = !!rawValue;
      mutateState((next) => {
        ensureTurnoutBridgeShape(next);
        if (key === "turnoutEnabled"){
          next.turnoutEnabled = checked;
        } else if (key === "gotvDiminishing"){
          next.gotvDiminishing = checked;
        } else if (key === "roiDoorsEnabled"){
          next.budget.tactics.doors.enabled = checked;
        } else if (key === "roiPhonesEnabled"){
          next.budget.tactics.phones.enabled = checked;
        } else if (key === "roiTextsEnabled"){
          next.budget.tactics.texts.enabled = checked;
        } else if (key === "roiIncludeOverhead"){
          next.budget.includeOverhead = checked;
        }
      });
      markMcStale();
      return { ok: true, view: turnoutBridgeStateView() };
    }

    const normalized = turnoutBridgeNormalizeNumber(key, rawValue);
    if (!normalized.ok){
      return { ok: false, code: normalized.code, view: turnoutBridgeStateView() };
    }
    mutateState((next) => {
      ensureTurnoutBridgeShape(next);
      const value = normalized.value;
      if (key === "turnoutBaselinePct"){
        next.turnoutBaselinePct = safeNum(value);
      } else if (key === "turnoutTargetOverridePct"){
        next.turnoutTargetOverridePct = value === "" ? "" : String(value);
      } else if (key === "gotvLiftPP"){
        next.gotvLiftPP = safeNum(value);
      } else if (key === "gotvMaxLiftPP"){
        next.gotvMaxLiftPP = safeNum(value);
      } else if (key === "gotvLiftMin"){
        next.gotvLiftMin = safeNum(value);
      } else if (key === "gotvLiftMode"){
        next.gotvLiftMode = safeNum(value);
      } else if (key === "gotvLiftMax"){
        next.gotvLiftMax = safeNum(value);
      } else if (key === "gotvMaxLiftPP2"){
        next.gotvMaxLiftPP2 = safeNum(value);
      } else if (key === "roiDoorsCpa"){
        next.budget.tactics.doors.cpa = safeNum(value) ?? 0;
      } else if (key === "roiDoorsCr"){
        next.budget.tactics.doors.crPct = safeNum(value);
      } else if (key === "roiDoorsSr"){
        next.budget.tactics.doors.srPct = safeNum(value);
      } else if (key === "roiPhonesCpa"){
        next.budget.tactics.phones.cpa = safeNum(value) ?? 0;
      } else if (key === "roiPhonesCr"){
        next.budget.tactics.phones.crPct = safeNum(value);
      } else if (key === "roiPhonesSr"){
        next.budget.tactics.phones.srPct = safeNum(value);
      } else if (key === "roiTextsCpa"){
        next.budget.tactics.texts.cpa = safeNum(value) ?? 0;
      } else if (key === "roiTextsCr"){
        next.budget.tactics.texts.crPct = safeNum(value);
      } else if (key === "roiTextsSr"){
        next.budget.tactics.texts.srPct = safeNum(value);
      } else if (key === "roiOverheadAmount"){
        next.budget.overheadAmount = safeNum(value) ?? 0;
      }
    });
    markMcStale();
    return { ok: true, view: turnoutBridgeStateView() };
  }

  function turnoutBridgeRefreshRoi(){
    render();
    return { ok: true, view: turnoutBridgeStateView() };
  }

  function installTurnoutBridge(){
    const windowRef = getWindowRef();
    if (!windowRef){
      return;
    }
    windowRef[turnoutBridgeKey] = {
      getView: () => turnoutBridgeStateView(),
      setField: (field, value) => turnoutBridgeSetField(field, value),
      refreshRoi: () => turnoutBridgeRefreshRoi(),
    };
  }

  return {
    ensureTurnoutBridgeShape,
    turnoutBridgeStateView,
    turnoutBridgeNormalizeSelect,
    turnoutBridgeNormalizeNumber,
    turnoutBridgeSetField,
    turnoutBridgeRefreshRoi,
    installTurnoutBridge,
  };
}
