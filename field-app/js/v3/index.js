import { syncKpis } from "./kpiBridge.js";
import { wireV3Nav } from "./nav.js";
import { installV3QaSmokeBridge, runV3QaSmoke } from "./qaGates.js";
import { renderV3Shell } from "./shell.js";
import { refreshActiveStage, mountStage } from "./stageMount.js";
import { getStageById, V3_DEFAULT_STAGE } from "./stageRegistry.js";

const STAGE_KEY = "fpe-ui-v3-stage";
const STAGE_QUERY_PARAM = "stage";
let syncTimer = null;

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

  if (!root || !legacy) {
    return;
  }

  if (resolveUiMode() !== "v3") {
    root.hidden = true;
    legacy.hidden = false;
    return;
  }

  try {
    renderV3Shell(root);

    root.hidden = false;
    legacy.hidden = true;

    wireV3Nav((stageId) => {
      navigateStage(stageId, { persist: true });
    });

    installV3QaSmokeBridge();
    wireTopbarBridge();
    wireScenarioBridge();

    navigateStage(resolveInitialStage(), { persist: true });
    startSyncLoop();
  } catch (err) {
    console.error("[v3-shell] failed to boot, reverting to legacy shell", err);
    root.hidden = true;
    legacy.hidden = false;
  }
}

function resolveInitialStage() {
  const params = new URLSearchParams(window.location.search);
  const urlStage = params.get(STAGE_QUERY_PARAM);
  if (urlStage && getStageById(urlStage)) {
    return urlStage;
  }

  const storedStage = localStorage.getItem(STAGE_KEY);
  if (storedStage && getStageById(storedStage)) {
    return storedStage;
  }

  return V3_DEFAULT_STAGE;
}

function navigateStage(stageId, { persist = true } = {}) {
  const resolved = getStageById(stageId) ? stageId : V3_DEFAULT_STAGE;
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

    clickLegacy("btnDiagnostics");
  });
  resetBtn?.addEventListener("click", () => clickLegacy("btnResetAll"));

  syncTrainingToggle();
  trainingBtn?.addEventListener("click", () => {
    setLegacyTrainingState(!readLegacyTrainingState());
    syncTrainingToggle();
  });
  document.getElementById("toggleTraining")?.addEventListener("change", syncTrainingToggle);

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
  const legacyInput = document.getElementById("scenarioName");

  if (!v3Input || !legacyInput) {
    return;
  }

  v3Input.value = legacyInput.value || "";

  v3Input.addEventListener("input", () => {
    if (legacyInput.value === v3Input.value) {
      return;
    }

    legacyInput.value = v3Input.value;
    legacyInput.dispatchEvent(new Event("input", { bubbles: true }));
    legacyInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  legacyInput.addEventListener("input", () => {
    if (v3Input.value !== legacyInput.value) {
      v3Input.value = legacyInput.value;
    }
  });
}

function clickLegacy(id) {
  const el = document.getElementById(id);
  if (el && typeof el.click === "function") {
    el.click();
  }
}

function readLegacyTrainingState() {
  const legacyToggle = document.getElementById("toggleTraining");
  if (!legacyToggle) {
    return document.body.classList.contains("training");
  }

  const enabled = !!legacyToggle.checked;
  if (document.body.classList.contains("training") !== enabled) {
    document.body.classList.toggle("training", enabled);
  }
  return enabled;
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

function syncTrainingToggle() {
  const v3Btn = document.getElementById("v3BtnTraining");
  if (!(v3Btn instanceof HTMLButtonElement)) {
    return;
  }

  const enabled = readLegacyTrainingState();
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
  const legacyInput = document.getElementById("scenarioName");
  if (!v3Input || !legacyInput) {
    return;
  }

  if (v3Input.value !== legacyInput.value) {
    v3Input.value = legacyInput.value;
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
