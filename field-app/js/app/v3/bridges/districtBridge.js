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

function isDistrictBridgeDebugEnabled() {
  try {
    const params = new URLSearchParams(window?.location?.search || "");
    const traceToken = String(params.get("districtDomTrace") || "").trim().toLowerCase();
    const binderToken = String(params.get("districtBinderAudit") || "").trim().toLowerCase();
    return (
      traceToken === "1"
      || traceToken === "true"
      || traceToken === "yes"
      || binderToken === "1"
      || binderToken === "true"
      || binderToken === "yes"
    );
  } catch {
    return false;
  }
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
    if (isDistrictBridgeDebugEnabled()) {
      const payload = {
        eventType: "missing_method",
        method,
        hasApi: !!api,
        availableMethods: api && typeof api === "object" ? Object.keys(api).slice(0, 24) : [],
      };
      console.warn("[district_bridge_call]", payload);
      try {
        console.warn(`[district_bridge_call] ${JSON.stringify(payload)}`);
      } catch {
        // no-op
      }
    }
    return null;
  }
  try {
    return api[method](...args);
  } catch (error) {
    if (isDistrictBridgeDebugEnabled()) {
      const payload = {
        eventType: "method_throw",
        method,
        errorName: String(error?.name || ""),
        message: String(error?.message || error || ""),
        stack: String(error?.stack || ""),
      };
      console.error("[district_bridge_call]", payload);
      try {
        console.error(`[district_bridge_call] ${JSON.stringify(payload)}`);
      } catch {
        // no-op
      }
    }
    return null;
  }
}
