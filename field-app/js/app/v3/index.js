import { syncKpis } from "./kpiBridge.js";
import { applyActiveContextToLinks, resolveActiveContext } from "../activeContext.js";
import { bootProbeError, bootProbeMark } from "../bootProbe.js";
import { refreshIntelligenceInteractions } from "../intelligenceInteractions.js?v=20260320-intel-runtime-compat-1";
import { wireV3Nav } from "./nav.js";
import { installV3QaSmokeBridge, runV3QaSmoke } from "./qaGates.js";
import { resolveContextPatchFailureStatus, validateContextScopeDraft } from "./contextScopeDraft.js";
import { renderV3Shell } from "./shell.js";
import { getActiveStageId, getActiveSurfaceId, refreshActiveStage, mountStage } from "./stageMount.js";
import { resolveV3StageId, V3_DEFAULT_STAGE } from "./stageRegistry.js";
import { readMapboxPublicTokenConfig } from "../runtimeConfig.js";
import { APP_VERSION, BUILD_ID } from "../../build.js";
import { CANONICAL_SCHEMA_VERSION } from "../../core/state/schema.js";

try {
  window.__FPE_V3_MODULE_LOADED_AT__ = new Date().toISOString();
} catch {}

const STAGE_KEY = "fpe-ui-v3-stage";
const STAGE_QUERY_PARAM = "stage";
const NAV_BRIDGE_KEY = "__FPE_V3_NAV__";
const SHELL_BRIDGE_KEY = "__FPE_SHELL_API__";
const RUNTIME_DIAGNOSTICS_KEY = "__FPE_RUNTIME_DIAGNOSTICS__";
const RUNTIME_DIAGNOSTICS_VISIBLE_KEY = "fpe-v3-runtime-diag-visible";
const RUNTIME_DIAGNOSTICS_QUERY_PARAM = "runtimeDiag";
const BRIDGE_SYNC_EVENT = "fpe:bridge-sync";
let syncTimer = null;
let syncRafToken = 0;
let pendingForceStageRefresh = false;
let lastBridgeSyncRevision = 0;
let popstateWired = false;
let bridgeSyncWired = false;
let editTrackerWired = false;
let lastUserEditAt = 0;
let contextDraftFeedback = null;

const ACTIVE_EDIT_SYNC_HOLD_MS = 900;

function stageScopeToken() {
  const shellView = readShellBridgeView();
  const campaignId = String(shellView?.campaignId || "").trim();
  const officeId = String(shellView?.officeId || "").trim();
  if (campaignId) {
    return `${campaignId}::${officeId || "all"}`;
  }
  const ctx = resolveActiveContext();
  return `${String(ctx?.campaignId || "default").trim() || "default"}::${String(ctx?.officeId || "").trim() || "all"}`;
}

function stageStorageKey() {
  return `${STAGE_KEY}::${stageScopeToken()}`;
}

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
  try {
    window.__FPE_V3_BOOT_READY__ = false;
  } catch {}
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
    wireBridgeSync();

    installV3QaSmokeBridge();
    wireTopbarBridge();
    wireContextBridge();
    wireEditTracker(root);

    navigateStage(resolveInitialStage(), { persist: true });
    syncRuntimeDiagnostics({ logBoot: true });
    startSyncLoop();
    queueSyncAll({ forceStageRefresh: true });
    bootProbeMark("v3.boot", { phase: "ok" });
    try {
      window.__FPE_V3_BOOT_READY__ = true;
      window.__FPE_V3_BOOT_READY_AT__ = new Date().toISOString();
    } catch {}
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

  const rawStoredStage = localStorage.getItem(stageStorageKey()) || localStorage.getItem(STAGE_KEY);
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

  syncAll({ forceStageRefresh: true });
}

function persistStage(stageId) {
  localStorage.setItem(stageStorageKey(), stageId);
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
  try {
    window.__FPE_V3_NAV_READY_AT__ = new Date().toISOString();
  } catch {}
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
}

function wireBridgeSync() {
  if (bridgeSyncWired) {
    return;
  }
  window.addEventListener(BRIDGE_SYNC_EVENT, onBridgeSyncEvent);
  bridgeSyncWired = true;
}

function onBridgeSyncEvent(event) {
  if (resolveUiMode() !== "v3") {
    return;
  }
  const revision = Number(event?.detail?.revision);
  if (Number.isFinite(revision) && revision <= lastBridgeSyncRevision) {
    return;
  }
  if (Number.isFinite(revision)) {
    lastBridgeSyncRevision = revision;
  }
  const source = String(event?.detail?.source || "").trim().toLowerCase();
  const reason = String(event?.detail?.reason || "").trim().toLowerCase();
  const activeStageId = getActiveStageId();
  const isScopeCritical = source.startsWith("bridge.shell")
    || source.startsWith("bridge.scenario")
    || reason.includes("context")
    || reason.includes("scope")
    || reason.includes("scenario");
  const isDistrictRuntimeCommit = activeStageId === "district"
    && source === "runtime"
    && reason === "commit_ui_update";
  const forceStageRefresh = isScopeCritical || isDistrictRuntimeCommit || !isActiveElementEditableInV3();
  queueSyncAll({ forceStageRefresh });
}

function wireContextBridge() {
  const scenarioInput = document.getElementById("v3ScenarioName");
  const campaignInput = document.getElementById("v3CampaignId");
  const campaignNameInput = document.getElementById("v3CampaignName");
  const officeInput = document.getElementById("v3OfficeId");

  if (
    !(scenarioInput instanceof HTMLInputElement)
    || !(campaignInput instanceof HTMLInputElement)
    || !(campaignNameInput instanceof HTMLInputElement)
    || !(officeInput instanceof HTMLInputElement)
  ) {
    return;
  }

  syncContextMirror();

  scenarioInput.addEventListener("input", () => {
    setShellScenarioName(scenarioInput.value);
  });

  const clearDraftFeedbackOnEdit = () => {
    if (!contextDraftFeedback) {
      return;
    }
    contextDraftFeedback = null;
    syncContextMirror();
  };
  campaignInput.addEventListener("input", clearDraftFeedbackOnEdit);
  campaignNameInput.addEventListener("input", clearDraftFeedbackOnEdit);
  officeInput.addEventListener("input", clearDraftFeedbackOnEdit);

  const submitScopePatch = () => {
    const validation = validateContextScopeDraft({
      campaignId: campaignInput.value,
      officeId: officeInput.value,
    });
    if (!validation.ok) {
      const firstIssue = validation.issues[0] || {};
      contextDraftFeedback = {
        statusText: String(firstIssue?.message || "Context input is invalid."),
        campaignId: campaignInput.value,
        campaignName: campaignNameInput.value,
        officeId: officeInput.value,
      };
      syncContextMirror();
      return;
    }

    const result = setShellContextPatch({
      campaignId: campaignInput.value,
      campaignName: campaignNameInput.value,
      officeId: officeInput.value,
    });
    if (result?.ok === false) {
      const failure = resolveContextPatchFailureStatus(result);
      contextDraftFeedback = {
        statusText: String(failure?.statusText || "Context update did not apply."),
        campaignId: campaignInput.value,
        campaignName: campaignNameInput.value,
        officeId: officeInput.value,
      };
    } else {
      contextDraftFeedback = null;
    }
    syncContextMirror();
  };

  for (const el of [campaignInput, campaignNameInput, officeInput]) {
    el.addEventListener("change", submitScopePatch);
    el.addEventListener("blur", submitScopePatch);
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitScopePatch();
      }
    });
  }
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

function readShellRuntimeDiagnostics() {
  const value = callShellBridge("getRuntimeDiagnostics");
  return value && typeof value === "object" ? value : null;
}

function normalizePathTail(pathname) {
  const parts = String(pathname || "")
    .split("/")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function readBundleIdentifierFromModuleUrl(moduleUrl) {
  const raw = String(moduleUrl || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw, window.location.href);
    return normalizePathTail(url.pathname);
  } catch {
    return normalizePathTail(raw.split("?")[0]);
  }
}

function readBundleIdentifierFromScripts() {
  const scripts = Array.from(document.querySelectorAll("script[type='module'][src]"));
  const preferred = scripts.find((script) => String(script.getAttribute("src") || "").includes("/assets/"));
  const target = preferred || scripts[scripts.length - 1];
  if (!(target instanceof HTMLScriptElement)) {
    return "";
  }
  return readBundleIdentifierFromModuleUrl(target.getAttribute("src") || "");
}

function extractAssetHash(bundleIdentifier = "") {
  const id = String(bundleIdentifier || "").trim();
  if (!id) {
    return "";
  }
  const match = id.match(/-([a-z0-9]{6,})\.js$/i);
  if (match && match[1]) {
    return String(match[1]).trim();
  }
  const queryMatch = id.match(/[?&](?:v|hash|build)=([^&]+)/i);
  if (queryMatch && queryMatch[1]) {
    return String(queryMatch[1]).trim();
  }
  return "";
}

function readStorageBackendsFromRuntime(runtimeDiagnostics) {
  const fromBridge = runtimeDiagnostics?.storage?.backends;
  const fallback = {
    localStorage: false,
    sessionStorage: false,
    indexedDB: false,
  };
  if (fromBridge && typeof fromBridge === "object") {
    return {
      localStorage: !!fromBridge.localStorage,
      sessionStorage: !!fromBridge.sessionStorage,
      indexedDB: !!fromBridge.indexedDB,
    };
  }
  try {
    fallback.localStorage = typeof window.localStorage !== "undefined";
  } catch {}
  try {
    fallback.sessionStorage = typeof window.sessionStorage !== "undefined";
  } catch {}
  try {
    fallback.indexedDB = typeof window.indexedDB !== "undefined";
  } catch {}
  return fallback;
}

function buildRuntimeDiagnosticsSnapshot() {
  const shellRuntime = readShellRuntimeDiagnostics();
  const mapboxConfig = readMapboxPublicTokenConfig();
  const moduleBundleId = readBundleIdentifierFromModuleUrl(import.meta.url);
  const scriptBundleId = readBundleIdentifierFromScripts();
  const activeBundleId = scriptBundleId || moduleBundleId;
  const activeAssetHash = extractAssetHash(activeBundleId) || extractAssetHash(moduleBundleId);
  const activeStage = String(getActiveStageId() || "").trim() || resolveInitialStage();
  const activeSurfaceId = String(getActiveSurfaceId() || "").trim();
  const districtV2Mounted = !!document.querySelector("[data-district-surface='district_v2']");
  const storageBackends = readStorageBackendsFromRuntime(shellRuntime);
  const stageKeyScoped = stageStorageKey();
  return {
    generatedAt: new Date().toISOString(),
    appVersion: String(shellRuntime?.appVersion || APP_VERSION || "").trim(),
    buildId: String(shellRuntime?.buildId || BUILD_ID || "").trim(),
    canonicalSchemaVersion: Number(CANONICAL_SCHEMA_VERSION || 0) || 0,
    runtimeSchemaVersion: Number(shellRuntime?.runtimeSchemaVersion || 0) || 0,
    activeStateSchemaVersion: Number.isFinite(Number(shellRuntime?.activeStateSchemaVersion))
      ? Number(shellRuntime.activeStateSchemaVersion)
      : null,
    persistedSchemaVersion: Number.isFinite(Number(shellRuntime?.persisted?.schemaVersion))
      ? Number(shellRuntime.persisted.schemaVersion)
      : null,
    moduleBundleId: moduleBundleId || "",
    scriptBundleId: scriptBundleId || "",
    activeBundleId: activeBundleId || "",
    assetHash: activeAssetHash || "",
    stageStorageKey: STAGE_KEY,
    stageStorageKeyScoped: stageKeyScoped,
    activeStage,
    activeSurfaceId,
    districtV2Mounted,
    context: shellRuntime?.context && typeof shellRuntime.context === "object"
      ? shellRuntime.context
      : {},
    storage: {
      backends: storageBackends,
      usage: shellRuntime?.storage?.usage && typeof shellRuntime.storage.usage === "object"
        ? shellRuntime.storage.usage
        : {},
      stateStorageKey: String(shellRuntime?.storage?.stateStorageKey || "").trim(),
      persistedRawBytes: Number(shellRuntime?.storage?.persistedRawBytes || 0) || 0,
    },
    mapbox: {
      status: mapboxConfig?.valid
        ? "ready"
        : (mapboxConfig?.invalidConfigValue ? "invalid" : "missing"),
      source: String(mapboxConfig?.source || "").trim(),
      storageKey: String(mapboxConfig?.storageKey || "").trim(),
    },
    district: shellRuntime?.district && typeof shellRuntime.district === "object"
      ? shellRuntime.district
      : {},
  };
}

function renderRuntimeDiagnosticsLine(snapshot) {
  const hashText = snapshot.assetHash || snapshot.buildId || "dev";
  const schemaText = snapshot.persistedSchemaVersion == null
    ? String(snapshot.activeStateSchemaVersion == null ? snapshot.runtimeSchemaVersion : snapshot.activeStateSchemaVersion)
    : String(snapshot.persistedSchemaVersion);
  const storageText = [
    snapshot.storage?.backends?.localStorage ? "localStorage" : null,
    snapshot.storage?.backends?.sessionStorage ? "sessionStorage" : null,
    snapshot.storage?.backends?.indexedDB ? "indexedDB" : null,
  ].filter(Boolean).join(", ") || "none";
  const mapbox = snapshot?.mapbox && typeof snapshot.mapbox === "object"
    ? snapshot.mapbox
    : {};
  const mapboxStatus = String(mapbox?.status || "unknown");
  const mapboxSource = String(mapbox?.source || "").trim();
  const mapboxText = mapboxSource
    ? `${mapboxStatus}/${mapboxSource}`
    : mapboxStatus;
  return [
    `build ${snapshot.buildId || "dev"}`,
    `asset ${hashText}`,
    `stage ${snapshot.activeStage || "unknown"}${snapshot.activeSurfaceId ? `/${snapshot.activeSurfaceId}` : ""}`,
    `districtV2 ${snapshot.districtV2Mounted ? "mounted" : "not-mounted"}`,
    `schema ${schemaText || "unknown"}`,
    `storage ${storageText}`,
    `mapbox ${mapboxText}`,
  ].join(" | ");
}

function isRuntimeDiagnosticsVisible() {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryValue = String(params.get(RUNTIME_DIAGNOSTICS_QUERY_PARAM) || "").trim().toLowerCase();
    if (queryValue === "1" || queryValue === "true" || queryValue === "yes") {
      return true;
    }
    if (queryValue === "0" || queryValue === "false" || queryValue === "no") {
      return false;
    }
  } catch {}

  try {
    const stored = String(window.localStorage.getItem(RUNTIME_DIAGNOSTICS_VISIBLE_KEY) || "").trim().toLowerCase();
    return stored === "1" || stored === "true" || stored === "yes";
  } catch {
    return false;
  }
}

function setRuntimeDiagnosticsVisible(visible) {
  try {
    window.localStorage.setItem(RUNTIME_DIAGNOSTICS_VISIBLE_KEY, visible ? "1" : "0");
  } catch {}
}

function syncRuntimeDiagnostics({ logBoot = false } = {}) {
  const snapshot = buildRuntimeDiagnosticsSnapshot();
  const visible = isRuntimeDiagnosticsVisible();
  try {
    window[RUNTIME_DIAGNOSTICS_KEY] = {
      getSnapshot: () => buildRuntimeDiagnosticsSnapshot(),
      print: () => {
        const next = buildRuntimeDiagnosticsSnapshot();
        console.info("[runtime-parity]", next);
        return next;
      },
      setVisible: (nextVisible) => {
        setRuntimeDiagnosticsVisible(!!nextVisible);
        syncRuntimeDiagnostics({ logBoot: false });
      },
    };
  } catch {}
  const host = document.getElementById("v3RuntimeDiagnostics");
  if (host instanceof HTMLElement) {
    host.hidden = !visible;
    if (visible) {
      host.textContent = renderRuntimeDiagnosticsLine(snapshot);
      host.title = JSON.stringify(snapshot, null, 2);
    } else {
      host.textContent = "";
      host.title = "";
    }
  }
  if (logBoot) {
    console.info("[runtime-parity]", snapshot);
  }
}

function setShellScenarioName(value) {
  const result = callShellBridge("setScenarioName", value);
  return !!result;
}

function setShellContextPatch(patch) {
  const result = callShellBridge("setContext", patch || {});
  return result && typeof result === "object" ? result : null;
}

function syncAll({ forceStageRefresh = false } = {}) {
  syncKpis();
  if (forceStageRefresh || canRefreshActiveStage()) {
    refreshActiveStage();
  }
  syncContextMirror();
  syncRuntimeDiagnostics();
}

function queueSyncAll({ forceStageRefresh = false } = {}) {
  if (forceStageRefresh) {
    pendingForceStageRefresh = true;
  }
  if (syncRafToken) {
    return;
  }
  const run = () => {
    syncRafToken = 0;
    const shouldForce = pendingForceStageRefresh;
    pendingForceStageRefresh = false;
    syncAll({ forceStageRefresh: shouldForce });
  };
  if (typeof window.requestAnimationFrame === "function") {
    syncRafToken = window.requestAnimationFrame(run);
    return;
  }
  syncRafToken = window.setTimeout(run, 0);
}

function syncContextMirror() {
  const scenarioInput = document.getElementById("v3ScenarioName");
  const campaignInput = document.getElementById("v3CampaignId");
  const campaignNameInput = document.getElementById("v3CampaignName");
  const officeInput = document.getElementById("v3OfficeId");
  const statusEl = document.getElementById("v3ContextStatus");
  if (
    !(scenarioInput instanceof HTMLInputElement)
    || !(campaignInput instanceof HTMLInputElement)
    || !(campaignNameInput instanceof HTMLInputElement)
    || !(officeInput instanceof HTMLInputElement)
  ) {
    return;
  }

  const shellView = readShellBridgeView();
  if (!shellView || typeof shellView !== "object") {
    return;
  }
  const active = document.activeElement;
  const activeIs = (el) => active instanceof HTMLElement && active === el;

  const nextScenario = String(shellView?.scenarioName ?? "");
  const nextCampaign = String(shellView?.campaignId ?? "");
  const nextCampaignName = String(shellView?.campaignName ?? "");
  const nextOffice = String(shellView?.officeId ?? "");
  const draft = contextDraftFeedback && typeof contextDraftFeedback === "object"
    ? contextDraftFeedback
    : null;
  const campaignLocked = !!shellView?.isCampaignLocked;
  const officeLocked = !!shellView?.isOfficeLocked;

  if (!activeIs(scenarioInput) && scenarioInput.value !== nextScenario) {
    scenarioInput.value = nextScenario;
  }
  const mirrorCampaign = draft ? String(draft.campaignId ?? nextCampaign) : nextCampaign;
  const mirrorCampaignName = draft ? String(draft.campaignName ?? nextCampaignName) : nextCampaignName;
  const mirrorOffice = draft ? String(draft.officeId ?? nextOffice) : nextOffice;

  if (!activeIs(campaignInput) && campaignInput.value !== mirrorCampaign) {
    campaignInput.value = mirrorCampaign;
  }
  if (!activeIs(campaignNameInput) && campaignNameInput.value !== mirrorCampaignName) {
    campaignNameInput.value = mirrorCampaignName;
  }
  if (!activeIs(officeInput) && officeInput.value !== mirrorOffice) {
    officeInput.value = mirrorOffice;
  }

  campaignInput.disabled = campaignLocked;
  campaignNameInput.disabled = campaignLocked;
  officeInput.disabled = officeLocked;

  const missing = Array.isArray(shellView?.contextMissing) ? shellView.contextMissing : [];
  let statusText = "";
  let statusMessageId = "";
  if (draft?.statusText){
    statusText = String(draft.statusText);
  } else if (missing.length){
    statusText = `Context missing: ${missing.join(", ")}.`;
    statusMessageId = "contextMissing";
  } else if (campaignLocked || officeLocked){
    const locked = [];
    if (campaignLocked) locked.push("campaign");
    if (officeLocked) locked.push("office");
    statusText = `Context locked by URL: ${locked.join(" + ")}.`;
    statusMessageId = campaignLocked && officeLocked
      ? "contextLocked"
      : (campaignLocked ? "campaignLocked" : "officeLocked");
  } else {
    statusText = "Campaign and office scope controls isolate local state across teams.";
  }
  if (statusEl){
    if (statusEl.textContent !== statusText){
      statusEl.textContent = statusText;
    }
    if (statusMessageId){
      statusEl.setAttribute("data-intel-message", statusMessageId);
    } else {
      statusEl.removeAttribute("data-intel-message");
      statusEl.classList.remove("fpe-intel-anchor");
      if (statusEl.getAttribute("role") === "button"){
        statusEl.removeAttribute("role");
      }
      statusEl.removeAttribute("tabindex");
    }
  }
  refreshIntelligenceInteractions();
}

function startSyncLoop() {
  if (syncTimer) {
    window.clearInterval(syncTimer);
  }

  syncTimer = window.setInterval(() => {
    queueSyncAll();
  }, 2500);
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
