import { syncKpis } from "./kpiBridge.js";
import { wireV3Nav } from "./nav.js";
import { renderV3Shell } from "./shell.js";
import { refreshActiveStage, mountStage } from "./stageMount.js";
import { V3_DEFAULT_STAGE } from "./stageRegistry.js";

const UI_MODE_KEY = "fpe-ui-shell-mode";
let syncTimer = null;

function resolveUiMode() {
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get("ui");

  if (urlMode === "v3") {
    localStorage.setItem(UI_MODE_KEY, "v3");
    return "v3";
  }

  if (urlMode === "legacy") {
    localStorage.setItem(UI_MODE_KEY, "legacy");
    return "legacy";
  }

  const storedMode = localStorage.getItem(UI_MODE_KEY);
  if (storedMode === "legacy") {
    return "legacy";
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
      mountStage(stageId);
      syncAll();
    });

    wireTopbarBridge();
    wireScenarioBridge();

    mountStage(V3_DEFAULT_STAGE);
    syncAll();
    startSyncLoop();
  } catch (err) {
    console.error("[v3-shell] failed to boot, reverting to legacy shell", err);
    root.hidden = true;
    legacy.hidden = false;
  }
}

function wireTopbarBridge() {
  const diagnosticsBtn = document.getElementById("v3BtnDiagnostics");
  const resetBtn = document.getElementById("v3BtnReset");
  const trainingToggle = document.getElementById("v3ToggleTraining");
  const legacyBtn = document.getElementById("v3SwitchLegacy");

  diagnosticsBtn?.addEventListener("click", () => clickLegacy("btnDiagnostics"));
  resetBtn?.addEventListener("click", () => clickLegacy("btnResetAll"));

  trainingToggle?.addEventListener("change", () => {
    const legacyToggle = document.getElementById("toggleTraining");
    if (!legacyToggle) {
      return;
    }

    legacyToggle.checked = trainingToggle.checked;
    legacyToggle.dispatchEvent(new Event("change", { bubbles: true }));
  });

  legacyBtn?.addEventListener("click", () => {
    localStorage.setItem(UI_MODE_KEY, "legacy");
    window.location.reload();
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

function syncAll() {
  syncKpis();
  refreshActiveStage();
  syncScenarioMirror();
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
