import { V3_DEFAULT_STAGE, getStageById } from "./stageRegistry.js";
import { renderControlsSurface } from "./surfaces/controls.js";
import { renderDataSurface } from "./surfaces/data.js";
import { renderDecisionLogSurface } from "./surfaces/decisionLog.js";
import { renderDistrictSurface } from "./surfaces/district.js";
import { renderOutcomeSurface } from "./surfaces/outcome.js";
import { renderPlanSurface } from "./surfaces/plan.js";
import { renderReachSurface } from "./surfaces/reach.js";
import { renderScenariosSurface } from "./surfaces/scenarios.js";
import { renderTurnoutSurface } from "./surfaces/turnout.js";
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
  district: renderDistrictSurface,
  outcome: renderOutcomeSurface,
  plan: renderPlanSurface,
  reach: renderReachSurface,
  scenarios: renderScenariosSurface,
  turnout: renderTurnoutSurface
};

let activeSurfaceRefresh = null;
let activeSurfacePane = null;
let activeStageId = V3_DEFAULT_STAGE;
const STAGE_SURFACES = new Map();

export function mountStage(stageId) {
  const stage = getStageById(stageId) || getStageById(V3_DEFAULT_STAGE);
  if (!stage) {
    return;
  }

  activeStageId = stage.id;

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

  syncLegacyRightRail();
  refreshActiveStage();
}

export function refreshActiveStage() {
  if (typeof activeSurfaceRefresh === "function") {
    activeSurfaceRefresh();
  }
  normalizeSurfacePane(activeSurfacePane);
}

export function getActiveStageId() {
  return activeStageId;
}

function syncLegacyRightRail() {
  const slot = document.getElementById("v3RightRailSlot");
  if (!slot) {
    return;
  }

  const legacyRail = document.getElementById("legacyResultsSidebar");
  if (!legacyRail) {
    return;
  }

  if (legacyRail.parentElement !== slot) {
    slot.appendChild(legacyRail);
  }
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
