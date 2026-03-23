import {
  createFallbackGuardContext,
  guardDeprecatedCompatibilityWrapperUsage,
  guardMissingModuleContract,
} from "../../../core/state/fallbackGuards.js";

const DECISION_API_KEY = "__FPE_DECISION_API__";

const eventGuard = createFallbackGuardContext({
  moduleName: "eventCalendarBridge",
});

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function getDecisionBridgeApi() {
  const api = asObject(window?.[DECISION_API_KEY]);
  if (!api) {
    guardMissingModuleContract(eventGuard, {
      contractName: DECISION_API_KEY,
      moduleRef: null,
      requiredMethods: [
        "getView",
        "setEventFilter",
        "setEventDraftField",
        "saveEventDraft",
        "clearEventDraft",
        "loadEventDraft",
        "deleteEvent",
        "setEventApplyToModel",
        "setEventStatus",
      ],
    });
    return null;
  }
  return api;
}

function readDecisionView() {
  const api = getDecisionBridgeApi();
  if (!api || typeof api.getView !== "function") {
    guardMissingModuleContract(eventGuard, {
      contractName: DECISION_API_KEY,
      moduleRef: api,
      requiredMethods: ["getView"],
    });
    return null;
  }
  guardDeprecatedCompatibilityWrapperUsage(eventGuard, {
    wrapperName: "eventCalendarBridge decision getView",
    replacement: "dedicated eventCalendar canonical/derived bridge readers",
  });
  try {
    return asObject(api.getView());
  } catch {
    return null;
  }
}

export function readEventCalendarCanonicalView() {
  const view = readDecisionView();
  if (!view) {
    return null;
  }
  const eventCalendar = view?.warRoom?.eventCalendar;
  return eventCalendar && typeof eventCalendar === "object" ? eventCalendar : null;
}

function callDecisionBridge(method, ...args) {
  const api = getDecisionBridgeApi();
  if (!api || typeof api[method] !== "function") {
    return null;
  }
  try {
    return api[method](...args);
  } catch {
    return null;
  }
}

export function setEventCalendarFilter(field, value) {
  return callDecisionBridge("setEventFilter", field, value);
}

export function setEventCalendarDraftField(field, value) {
  return callDecisionBridge("setEventDraftField", field, value);
}

export function saveEventCalendarDraft() {
  return callDecisionBridge("saveEventDraft");
}

export function clearEventCalendarDraft() {
  return callDecisionBridge("clearEventDraft");
}

export function loadEventCalendarDraft(eventId) {
  return callDecisionBridge("loadEventDraft", eventId);
}

export function deleteEventCalendarEvent(eventId) {
  return callDecisionBridge("deleteEvent", eventId);
}

export function setEventCalendarApplyToModel(eventId, checked) {
  return callDecisionBridge("setEventApplyToModel", eventId, checked);
}

export function setEventCalendarStatus(eventId, status) {
  return callDecisionBridge("setEventStatus", eventId, status);
}
