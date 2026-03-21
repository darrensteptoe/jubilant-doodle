import {
  createFallbackGuardContext,
  guardMissingCanonicalReader,
  guardMissingDerivedReader,
  guardMissingModuleContract,
} from "../../../core/state/fallbackGuards.js";

const DISTRICT_API_KEY = "__FPE_DISTRICT_API__";

const districtGuard = createFallbackGuardContext({
  moduleName: "districtBridge",
});

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

export function getDistrictBridgeApi() {
  const api = asObject(window?.[DISTRICT_API_KEY]);
  if (!api) {
    guardMissingModuleContract(districtGuard, {
      contractName: DISTRICT_API_KEY,
      moduleRef: null,
      requiredMethods: ["getCanonicalView", "getDerivedView"],
    });
    return null;
  }
  return api;
}

export function readDistrictCanonicalBridgeView() {
  const api = getDistrictBridgeApi();
  if (!api) {
    return null;
  }
  try {
    if (typeof api.getCanonicalView === "function") {
      return asObject(api.getCanonicalView());
    }
    guardMissingCanonicalReader(districtGuard, {
      bridgeName: DISTRICT_API_KEY,
      api,
    });
    return null;
  } catch {
    return null;
  }
}

export function readDistrictDerivedBridgeView() {
  const api = getDistrictBridgeApi();
  if (!api) {
    return null;
  }
  try {
    if (typeof api.getDerivedView === "function") {
      return asObject(api.getDerivedView());
    }
    guardMissingDerivedReader(districtGuard, {
      bridgeName: DISTRICT_API_KEY,
      api,
    });
    return null;
  } catch {
    return null;
  }
}

export function callDistrictBridge(method, ...args) {
  const api = getDistrictBridgeApi();
  if (!api || typeof api[method] !== "function") {
    return null;
  }
  try {
    return api[method](...args);
  } catch {
    return null;
  }
}
