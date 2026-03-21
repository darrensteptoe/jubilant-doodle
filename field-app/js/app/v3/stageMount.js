import { V3_DEFAULT_STAGE, getStageById } from "./stageRegistry.js";
import { renderControlsSurface } from "./surfaces/controls.js";
import { renderDataSurface } from "./surfaces/data/index.js";
import { renderWarRoomSurface as renderDecisionLogSurface } from "./surfaces/warRoom/index.js";
import { renderDistrictV2Surface } from "./surfaces/districtV2/index.js";
import { renderElectionDataSurface } from "./surfaces/electionData/index.js";
import { renderOutcomeSurface } from "./surfaces/outcome/index.js";
import { renderPlanSurface } from "./surfaces/plan.js";
import { renderReachSurface } from "./surfaces/reach.js";
import { renderScenariosSurface } from "./surfaces/scenarios.js";
import { renderTurnoutSurface } from "./surfaces/turnout.js";
import { mountIntelligencePanel, refreshIntelligencePanel, setIntelligencePanelStage } from "../intelligenceRenderer.js";
import { installIntelligenceInteractions, refreshIntelligenceInteractions } from "../intelligenceInteractions.js?v=20260320-intel-runtime-compat-1";
import {
  normalizeSurfaceActionRows,
  normalizeSurfaceBlocks,
  normalizeSurfaceEmptyStates,
  normalizeSurfaceInstructionPanels,
  normalizeSurfaceMessages,
  normalizeSurfaceStatusPills
} from "./surfaceUtils.js";

const SURFACE_MAP = {
  controls: renderControlsSurface,
  data: renderDataSurface,
  decisionLog: renderDecisionLogSurface,
  districtV2: renderDistrictV2Surface,
  electionData: renderElectionDataSurface,
  outcome: renderOutcomeSurface,
  plan: renderPlanSurface,
  reach: renderReachSurface,
  scenarios: renderScenariosSurface,
  turnout: renderTurnoutSurface
};

let activeSurfaceRefresh = null;
let activeSurfacePane = null;
let activeStageId = V3_DEFAULT_STAGE;
let activeSurfaceId = "";
const STAGE_SURFACES = new Map();
const RIGHT_RAIL_MODE_KEY = "fpe-v3-right-rail-mode";
const RIGHT_RAIL_MODE_RESULTS = "results";
const RIGHT_RAIL_MODE_MANUAL = "manual";
let activeRightRailMode = readRightRailMode();

export function mountStage(stageId) {
  const stage = getStageById(stageId) || getStageById(V3_DEFAULT_STAGE);
  if (!stage) {
    return;
  }

  activeStageId = stage.id;
  activeSurfaceId = String(stage.surface || "").trim();

  const eyebrow = document.getElementById("v3PageEyebrow");
  const title = document.getElementById("v3PageTitle");
  const subtitle = document.getElementById("v3PageSubtitle");

  if (eyebrow) {
    eyebrow.textContent = stage.group;
  }
  if (title) {
    title.textContent = stage.pageTitle;
  }
  if (subtitle) {
    subtitle.textContent = stage.subtitle;
  }

  document.querySelectorAll(".fpe-nav__item[data-v3-stage]").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.v3Stage === stage.id);
  });

  const mount = document.getElementById("v3SurfaceMount");
  if (!mount) {
    return;
  }

  hideAllSurfacePanes(mount);

  const surfaceState = ensureSurfaceState(stage, mount);
  if (surfaceState && surfaceState.pane) {
    surfaceState.pane.hidden = false;
  }
  activeSurfaceRefresh = surfaceState ? surfaceState.refresh : null;
  activeSurfacePane = surfaceState ? surfaceState.pane : null;

  syncRightRail();
  refreshActiveStage();
}

export function refreshActiveStage() {
  if (typeof activeSurfaceRefresh === "function") {
    activeSurfaceRefresh();
  }
  refreshIntelligencePanel();
  normalizeSurfacePane(activeSurfacePane);
  refreshIntelligenceInteractions();
}

export function getActiveStageId() {
  return activeStageId;
}

export function getActiveSurfaceId() {
  return activeSurfaceId;
}

function syncRightRail() {
  const slot = document.getElementById("v3RightRailSlot");
  if (!slot) {
    return;
  }

  const toggle = ensureRightRailToggle(slot);
  updateRightRailToggle(toggle);

  if (activeRightRailMode === RIGHT_RAIL_MODE_RESULTS) {
    slot.classList.remove("fpe-right-rail-slot--intel");
    hideIntelligenceRail(slot);
    mountLegacyRightRailInSlot(slot, toggle);
    return;
  }

  parkLegacyRightRailInPool();
  mountIntelligenceRailInSlot(slot, toggle);
}

function parkLegacyRightRailInPool() {
  const legacyRail = document.getElementById("legacyResultsSidebar");
  if (!legacyRail) {
    return;
  }
  const pool = document.getElementById("legacyDomPool");
  if (pool instanceof HTMLElement && legacyRail.parentElement !== pool) {
    pool.appendChild(legacyRail);
  }
  legacyRail.hidden = true;
}

function mountLegacyRightRailInSlot(slot, anchor) {
  const legacyRail = document.getElementById("legacyResultsSidebar");
  if (!(legacyRail instanceof HTMLElement) || !(slot instanceof HTMLElement)) {
    return;
  }
  if (legacyRail.parentElement !== slot) {
    slot.appendChild(legacyRail);
  }
  if (anchor instanceof HTMLElement && anchor.nextSibling !== legacyRail) {
    slot.insertBefore(legacyRail, anchor.nextSibling);
  }
  legacyRail.hidden = false;
}

function hideIntelligenceRail(slot) {
  const panel = slot?.querySelector?.("#v3IntelligencePanel");
  if (panel instanceof HTMLElement) {
    panel.hidden = true;
  }
}

function mountIntelligenceRailInSlot(slot, anchor) {
  mountIntelligencePanel({ slot, stageId: activeStageId });
  setIntelligencePanelStage(activeStageId);
  installIntelligenceInteractions();
  const panel = slot.querySelector("#v3IntelligencePanel");
  if (!(panel instanceof HTMLElement)) {
    return;
  }
  panel.hidden = false;
  if (anchor instanceof HTMLElement && anchor.nextSibling !== panel) {
    slot.insertBefore(panel, anchor.nextSibling);
  }
}

function normalizeRightRailMode(raw) {
  const token = String(raw == null ? "" : raw).trim().toLowerCase();
  return token === RIGHT_RAIL_MODE_MANUAL ? RIGHT_RAIL_MODE_MANUAL : RIGHT_RAIL_MODE_RESULTS;
}

function readRightRailMode() {
  try {
    return normalizeRightRailMode(window.localStorage.getItem(RIGHT_RAIL_MODE_KEY));
  } catch {
    return RIGHT_RAIL_MODE_RESULTS;
  }
}

function persistRightRailMode(mode) {
  try {
    window.localStorage.setItem(RIGHT_RAIL_MODE_KEY, normalizeRightRailMode(mode));
  } catch {}
}

function ensureRightRailToggle(slot) {
  let toggle = slot.querySelector("#v3RightRailToggle");
  if (!(toggle instanceof HTMLElement)) {
    toggle = document.createElement("div");
    toggle.id = "v3RightRailToggle";
    toggle.className = "fpe-right-rail-toggle";
    toggle.setAttribute("role", "tablist");
    toggle.setAttribute("aria-label", "Right rail view");
    toggle.innerHTML = `
      <button class="fpe-right-rail-toggle__btn" data-v3-right-rail-mode="results" type="button">Results</button>
      <button class="fpe-right-rail-toggle__btn" data-v3-right-rail-mode="manual" type="button">Manual</button>
    `;
    toggle.addEventListener("click", onRightRailToggleClick);
    slot.insertBefore(toggle, slot.firstChild || null);
  } else if (slot.firstElementChild !== toggle) {
    slot.insertBefore(toggle, slot.firstChild || null);
  }
  return toggle;
}

function updateRightRailToggle(toggle) {
  if (!(toggle instanceof HTMLElement)) {
    return;
  }
  toggle.querySelectorAll("[data-v3-right-rail-mode]").forEach((node) => {
    if (!(node instanceof HTMLButtonElement)) {
      return;
    }
    const mode = normalizeRightRailMode(node.getAttribute("data-v3-right-rail-mode"));
    const active = mode === activeRightRailMode;
    node.classList.toggle("is-active", active);
    node.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function onRightRailToggleClick(event) {
  const target = event?.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const button = target.closest("[data-v3-right-rail-mode]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  const nextMode = normalizeRightRailMode(button.getAttribute("data-v3-right-rail-mode"));
  if (nextMode === activeRightRailMode) {
    return;
  }
  activeRightRailMode = nextMode;
  persistRightRailMode(activeRightRailMode);
  syncRightRail();
  refreshActiveStage();
}

function ensureSurfaceState(stage, mount) {
  const existing = STAGE_SURFACES.get(stage.id);
  if (existing) {
    if (existing.pane.parentElement !== mount) {
      mount.appendChild(existing.pane);
    }
    return existing;
  }

  const pane = document.createElement("div");
  pane.className = "fpe-surface-pane";
  pane.dataset.v3Stage = stage.id;
  pane.hidden = true;
  mount.appendChild(pane);

  const renderer = SURFACE_MAP[stage.surface];
  const rendered = typeof renderer === "function" ? renderer(pane, stage) : null;
  normalizeSurfacePane(pane);
  const refresh =
    typeof rendered === "function"
      ? rendered
      : rendered && typeof rendered.refresh === "function"
        ? rendered.refresh
        : null;

  const state = { pane, refresh };
  STAGE_SURFACES.set(stage.id, state);
  return state;
}

function hideAllSurfacePanes(mount) {
  mount.querySelectorAll(".fpe-surface-pane").forEach((pane) => {
    pane.hidden = true;
  });
}

function normalizeSurfacePane(pane) {
  if (!(pane instanceof HTMLElement)) {
    return;
  }
  normalizeSurfaceActionRows(pane);
  normalizeSurfaceBlocks(pane);
  normalizeSurfaceMessages(pane);
  normalizeSurfaceStatusPills(pane);
  normalizeSurfaceEmptyStates(pane);
  normalizeSurfaceInstructionPanels(pane);
}
