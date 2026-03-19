import { syncKpis } from "./kpiBridge.js";
import { applyActiveContextToLinks, resolveActiveContext } from "../activeContext.js";
import { bootProbeError, bootProbeMark } from "../bootProbe.js";
import { wireV3Nav } from "./nav.js";
import { installV3QaSmokeBridge, runV3QaSmoke } from "./qaGates.js";
import { renderV3Shell } from "./shell.js";
import { getActiveStageId, refreshActiveStage, mountStage } from "./stageMount.js";
import { resolveV3StageId, V3_DEFAULT_STAGE } from "./stageRegistry.js";

const STAGE_KEY = "fpe-ui-v3-stage";
const STAGE_QUERY_PARAM = "stage";
const NAV_BRIDGE_KEY = "__FPE_V3_NAV__";
const SHELL_BRIDGE_KEY = "__FPE_SHELL_API__";
let syncTimer = null;
let popstateWired = false;
let editTrackerWired = false;
let lastUserEditAt = 0;

const ACTIVE_EDIT_SYNC_HOLD_MS = 900;

function resolveUiMode() {
  try {
    const getMode = window.__FPE_GET_UI_MODE__;
    if (typeof getMode === "function") {
      const mode = getMode();
      if (mode === "v3") {
        return mode;
      }
    }
  } catch {}

  return "v3";
}

function bootV3() {
  bootProbeMark("v3.boot", { phase: "start" });
  const root = document.getElementById("app-shell-v3-root");

  if (!root) {
    bootProbeMark("v3.boot", { phase: "skipped", reason: "missing-root" });
    return;
  }

  if (resolveUiMode() !== "v3") {
    uninstallNavigationBridge();
    root.hidden = true;
    bootProbeMark("v3.boot", { phase: "skipped", reason: "ui-mode-not-v3" });
    return;
  }

  try {
    renderV3Shell(root);
    applyActiveContextToLinks(resolveActiveContext(), ".fpe-nav__item[href]");

    root.hidden = false;

    installNavigationBridge();
    wireV3Nav((stageId) => {
      navigateStage(stageId, { persist: true });
    });
    wirePopstateBridge();

    installV3QaSmokeBridge();
    wireTopbarBridge();
    wireScenarioBridge();
    wireEditTracker(root);

    navigateStage(resolveInitialStage(), { persist: true });
    startSyncLoop();
    bootProbeMark("v3.boot", { phase: "ok" });
  } catch (err) {
    bootProbeError("v3.boot", err);
    console.error("[v3-shell] failed to boot", err);
    uninstallNavigationBridge();
    root.hidden = false;
    try {
      const openEmergency = window.__FPE_OPEN_EMERGENCY_DIAGNOSTICS__;
      if (typeof openEmergency === "function") {
        openEmergency();
      }
    } catch {}
  }
}

function resolveInitialStage() {
  const params = new URLSearchParams(window.location.search);
  const rawUrlStage = params.get(STAGE_QUERY_PARAM);
  if (rawUrlStage) {
    return resolveV3StageId(rawUrlStage);
  }

  const rawStoredStage = localStorage.getItem(STAGE_KEY);
  if (rawStoredStage) {
    return resolveV3StageId(rawStoredStage);
  }

  return V3_DEFAULT_STAGE;
}

function navigateStage(stageId, { persist = true } = {}) {
  const resolved = resolveV3StageId(stageId);
  mountStage(resolved);

  if (persist) {
    persistStage(resolved);
  }

  syncAll();
}

function persistStage(stageId) {
  localStorage.setItem(STAGE_KEY, stageId);
  const params = new URLSearchParams(window.location.search);
  params.set(STAGE_QUERY_PARAM, stageId);
  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

function wirePopstateBridge() {
  if (popstateWired) {
    return;
  }

  window.addEventListener("popstate", onPopstate);
  popstateWired = true;
}

function onPopstate() {
  if (resolveUiMode() !== "v3") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  navigateStage(params.get(STAGE_QUERY_PARAM), { persist: false });
}

function installNavigationBridge() {
  window[NAV_BRIDGE_KEY] = {
    active: true,
    navigateStage: (stageId, options = {}) => {
      navigateStage(stageId, { persist: options.persist !== false });
    },
    resolveStageId: resolveV3StageId,
    getActiveStageId: () => getActiveStageId()
  };
}

function uninstallNavigationBridge() {
  const existing = window[NAV_BRIDGE_KEY];
  if (existing && typeof existing === "object") {
    existing.active = false;
  }
}

function wireTopbarBridge() {
  const diagnosticsBtn = document.getElementById("v3BtnDiagnostics");
  const resetBtn = document.getElementById("v3BtnReset");
  const trainingBtn = document.getElementById("v3BtnTraining");

  diagnosticsBtn?.addEventListener("click", () => {
    try {
      runV3QaSmoke({ restoreStage: true, logToConsole: true });
    } catch (err) {
      console.warn("[v3-shell] qa smoke failed", err);
    }

    if (!callShellBridge("openDiagnostics")) {
      openDiagnosticsFallback();
    }
  });
  resetBtn?.addEventListener("click", () => {
    const result = callShellBridge("resetScenario");
    if (!result) {
      resetScenarioFallback();
    }
  });

  syncTrainingToggle();
  trainingBtn?.addEventListener("click", () => {
    const nextEnabled = !readShellTrainingState();
    setShellTrainingState(nextEnabled);
    syncAll();
  });
}

function wireScenarioBridge() {
  const v3Input = document.getElementById("v3ScenarioName");

  if (!v3Input) {
    return;
  }

  const shellView = readShellBridgeView();
  v3Input.value = shellView?.scenarioName || "";

  v3Input.addEventListener("input", () => {
    if (setShellScenarioName(v3Input.value)) {
      return;
    }
  });
}

function clickLegacy(id) {
  const el = document.getElementById(id);
  if (el && typeof el.click === "function") {
    el.click();
  }
}

function openDiagnosticsFallback() {
  try {
    const openEmergency = window.__FPE_OPEN_EMERGENCY_DIAGNOSTICS__;
    if (typeof openEmergency === "function") {
      openEmergency();
      return;
    }
  } catch {}
  clickLegacy("btnDiagnostics");
}

function resetScenarioFallback() {
  try {
    const reset = window.__FPE_RESET_SCENARIO__;
    if (typeof reset === "function") {
      reset();
      return;
    }
  } catch {}
  clickLegacy("btnResetAll");
}

function readShellBridgeView() {
  try {
    const api = window[SHELL_BRIDGE_KEY];
    if (!api || typeof api.getView !== "function") {
      return null;
    }
    const view = api.getView();
    return view && typeof view === "object" ? view : null;
  } catch {
    return null;
  }
}

function callShellBridge(method, ...args) {
  try {
    const api = window[SHELL_BRIDGE_KEY];
    if (!api || typeof api[method] !== "function") {
      return null;
    }
    return api[method](...args);
  } catch {
    return null;
  }
}

function setLegacyTrainingState(enabled) {
  const normalized = !!enabled;
  document.body.classList.toggle("training", normalized);

  const legacyToggle = document.getElementById("toggleTraining");
  if (!legacyToggle) {
    return;
  }

  legacyToggle.checked = normalized;
  legacyToggle.dispatchEvent(new Event("input", { bubbles: true }));
  legacyToggle.dispatchEvent(new Event("change", { bubbles: true }));
}

function readShellTrainingState() {
  const shellView = readShellBridgeView();
  if (shellView && typeof shellView.trainingEnabled === "boolean") {
    return shellView.trainingEnabled;
  }
  return document.body.classList.contains("training");
}

function setShellTrainingState(enabled) {
  const result = callShellBridge("setTrainingEnabled", !!enabled);
  if (result) {
    return true;
  }
  setLegacyTrainingState(enabled);
  return false;
}

function setShellScenarioName(value) {
  const result = callShellBridge("setScenarioName", value);
  return !!result;
}

function syncTrainingToggle() {
  const v3Btn = document.getElementById("v3BtnTraining");
  if (!(v3Btn instanceof HTMLButtonElement)) {
    return;
  }

  const enabled = readShellTrainingState();
  v3Btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  v3Btn.classList.toggle("is-active", enabled);
}

function syncAll() {
  syncKpis();
  if (canRefreshActiveStage()) {
    refreshActiveStage();
  }
  syncScenarioMirror();
  syncTrainingToggle();
}

function syncScenarioMirror() {
  const v3Input = document.getElementById("v3ScenarioName");
  if (!v3Input) {
    return;
  }

  if (document.activeElement === v3Input) {
    return;
  }

  const shellView = readShellBridgeView();
  const nextValue = shellView?.scenarioName ?? "";
  if (v3Input.value !== nextValue) {
    v3Input.value = nextValue;
  }
}

function startSyncLoop() {
  if (syncTimer) {
    window.clearInterval(syncTimer);
  }

  syncTimer = window.setInterval(syncAll, 1000);
}

function wireEditTracker(root) {
  if (editTrackerWired || !(root instanceof HTMLElement)) {
    return;
  }
  editTrackerWired = true;

  const markEdited = () => {
    lastUserEditAt = Date.now();
  };

  const onEvent = (event) => {
    const target = event?.target;
    if (
      !(target instanceof HTMLInputElement)
      && !(target instanceof HTMLSelectElement)
      && !(target instanceof HTMLTextAreaElement)
    ) {
      return;
    }
    if (!root.contains(target)) {
      return;
    }
    markEdited();
  };

  root.addEventListener("input", onEvent, true);
  root.addEventListener("change", onEvent, true);
}

function isActiveElementEditableInV3() {
  const active = document.activeElement;
  if (
    !(active instanceof HTMLInputElement)
    && !(active instanceof HTMLSelectElement)
    && !(active instanceof HTMLTextAreaElement)
  ) {
    return false;
  }
  const root = document.getElementById("app-shell-v3-root");
  if (!(root instanceof HTMLElement) || !root.contains(active)) {
    return false;
  }
  return !active.disabled && !active.readOnly;
}

function canRefreshActiveStage() {
  if (isActiveElementEditableInV3()) {
    return false;
  }
  if (!lastUserEditAt) {
    return true;
  }
  return (Date.now() - lastUserEditAt) > ACTIVE_EDIT_SYNC_HOLD_MS;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootV3);
} else {
  bootV3();
}
