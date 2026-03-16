import { syncKpis } from "./kpiBridge.js";
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

function resolveUiMode() {
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get("ui");

  if (urlMode === "legacy") {
    return "legacy";
  }

  if (urlMode === "v3") {
    return "v3";
  }

  return "v3";
}

function bootV3() {
  const root = document.getElementById("app-shell-v3-root");
  const legacy = document.getElementById("app-shell-legacy");

  if (!root) {
    return;
  }

  if (resolveUiMode() !== "v3") {
    uninstallNavigationBridge();
    restoreLegacyRightRail();
    root.hidden = true;
    if (legacy) {
      legacy.hidden = false;
    }
    return;
  }

  try {
    moveLegacyRightRailToHost();
    renderV3Shell(root);

    root.hidden = false;
    if (legacy) {
      legacy.hidden = true;
    }

    installNavigationBridge();
    wireV3Nav((stageId) => {
      navigateStage(stageId, { persist: true });
    });
    wirePopstateBridge();

    installV3QaSmokeBridge();
    wireTopbarBridge();
    wireScenarioBridge();

    navigateStage(resolveInitialStage(), { persist: true });
    startSyncLoop();
  } catch (err) {
    console.error("[v3-shell] failed to boot, reverting to legacy shell", err);
    uninstallNavigationBridge();
    restoreLegacyRightRail();
    root.hidden = true;
    if (legacy) {
      legacy.hidden = false;
    }
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
  const legacyBtn = document.getElementById("v3SwitchLegacy");

  diagnosticsBtn?.addEventListener("click", () => {
    try {
      runV3QaSmoke({ restoreStage: true, logToConsole: true });
    } catch (err) {
      console.warn("[v3-shell] qa smoke failed", err);
    }

    if (!callShellBridge("openDiagnostics")) {
      clickLegacy("btnDiagnostics");
    }
  });
  resetBtn?.addEventListener("click", () => {
    const result = callShellBridge("resetScenario");
    if (!result) {
      clickLegacy("btnResetAll");
    }
  });

  syncTrainingToggle();
  trainingBtn?.addEventListener("click", () => {
    setShellTrainingState(!readShellTrainingState());
    syncTrainingToggle();
  });

  legacyBtn?.addEventListener("click", () => {
    const params = new URLSearchParams(window.location.search);
    params.set("ui", "legacy");
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.location.assign(nextUrl);
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

function moveLegacyRightRailToHost() {
  try {
    const move = window.__FPE_MOVE_LEGACY_RIGHT_RAIL_TO_HOST__;
    if (typeof move === "function") {
      move();
    }
  } catch {}
}

function restoreLegacyRightRail() {
  try {
    const restore = window.__FPE_RESTORE_LEGACY_RIGHT_RAIL__;
    if (typeof restore === "function") {
      restore();
    }
  } catch {}
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
  refreshActiveStage();
  syncScenarioMirror();
  syncTrainingToggle();
}

function syncScenarioMirror() {
  const v3Input = document.getElementById("v3ScenarioName");
  if (!v3Input) {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootV3);
} else {
  bootV3();
}
