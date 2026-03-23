import {
  createFallbackGuardContext,
  guardDeprecatedCompatibilityWrapperUsage,
  guardMissingModuleContract,
} from "../../../core/state/fallbackGuards.js";

const DECISION_API_KEY = "__FPE_DECISION_API__";

const weatherGuard = createFallbackGuardContext({
  moduleName: "weatherRiskBridge",
});

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function getDecisionBridgeApi() {
  const api = asObject(window?.[DECISION_API_KEY]);
  if (!api) {
    guardMissingModuleContract(weatherGuard, {
      contractName: DECISION_API_KEY,
      moduleRef: null,
      requiredMethods: ["getView", "setWeatherField", "setWeatherMode", "refreshWeather"],
    });
    return null;
  }
  return api;
}

function readDecisionView() {
  const api = getDecisionBridgeApi();
  if (!api || typeof api.getView !== "function") {
    guardMissingModuleContract(weatherGuard, {
      contractName: DECISION_API_KEY,
      moduleRef: api,
      requiredMethods: ["getView"],
    });
    return null;
  }
  guardDeprecatedCompatibilityWrapperUsage(weatherGuard, {
    wrapperName: "weatherRiskBridge decision getView",
    replacement: "dedicated weatherRisk canonical/derived bridge readers",
  });
  try {
    return asObject(api.getView());
  } catch {
    return null;
  }
}

export function readWeatherRiskCanonicalView() {
  const view = readDecisionView();
  if (!view) {
    return null;
  }
  const weather = view?.warRoom?.weather;
  return weather && typeof weather === "object" ? weather : null;
}

export function setWeatherRiskField(field, value) {
  const api = getDecisionBridgeApi();
  if (!api || typeof api.setWeatherField !== "function") {
    return null;
  }
  try {
    return api.setWeatherField(field, value);
  } catch {
    return null;
  }
}

export function setWeatherRiskMode(mode) {
  const api = getDecisionBridgeApi();
  if (!api || typeof api.setWeatherMode !== "function") {
    return null;
  }
  try {
    return api.setWeatherMode(mode);
  } catch {
    return null;
  }
}

export function refreshWeatherRisk() {
  const api = getDecisionBridgeApi();
  if (!api || typeof api.refreshWeather !== "function") {
    return null;
  }
  try {
    return api.refreshWeather();
  } catch {
    return null;
  }
}
