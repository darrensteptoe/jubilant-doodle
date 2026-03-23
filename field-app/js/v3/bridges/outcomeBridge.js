import {
  createFallbackGuardContext,
  guardMissingCanonicalReader,
  guardMissingDerivedReader,
  guardMissingModuleContract,
} from "../../../core/state/fallbackGuards.js";

const OUTCOME_API_KEY = "__FPE_OUTCOME_API__";

const outcomeGuard = createFallbackGuardContext({
  moduleName: "outcomeBridge",
});

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

export function getOutcomeBridgeApi() {
  const api = asObject(window?.[OUTCOME_API_KEY]);
  if (!api) {
    guardMissingModuleContract(outcomeGuard, {
      contractName: OUTCOME_API_KEY,
      moduleRef: null,
      requiredMethods: ["getCanonicalView", "getDerivedView"],
    });
    return null;
  }
  return api;
}

export function readOutcomeCanonicalBridgeView() {
  const api = getOutcomeBridgeApi();
  if (!api) {
    return null;
  }
  try {
    if (typeof api.getCanonicalView === "function") {
      return asObject(api.getCanonicalView());
    }
    guardMissingCanonicalReader(outcomeGuard, {
      bridgeName: OUTCOME_API_KEY,
      api,
    });
    return null;
  } catch {
    return null;
  }
}

export function readOutcomeDerivedBridgeView() {
  const api = getOutcomeBridgeApi();
  if (!api) {
    return null;
  }
  try {
    if (typeof api.getDerivedView === "function") {
      return asObject(api.getDerivedView());
    }
    guardMissingDerivedReader(outcomeGuard, {
      bridgeName: OUTCOME_API_KEY,
      api,
    });
    return null;
  } catch {
    return null;
  }
}

function callOutcomeBridge(method, ...args) {
  const api = getOutcomeBridgeApi();
  if (!api || typeof api[method] !== "function") {
    return null;
  }
  try {
    return api[method](...args);
  } catch {
    return null;
  }
}

export function setOutcomeBridgeField(field, value) {
  return callOutcomeBridge("setField", field, value);
}

export function runOutcomeBridgeMc() {
  return callOutcomeBridge("runMc");
}

export function rerunOutcomeBridgeMc() {
  return callOutcomeBridge("rerunMc");
}

export function computeOutcomeBridgeSurface() {
  return callOutcomeBridge("computeSurface");
}
