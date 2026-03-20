// @ts-check

import { evaluateFlowContracts } from "../contracts/flowContracts.js";
import { evaluateStateContracts } from "../contracts/stateContracts.js";
import { evaluateOutputContracts } from "../contracts/outputContracts.js";
import { evaluateBoundaryContracts } from "../contracts/boundaryContracts.js";
import { getDiagnosticStore } from "./diagnosticStore.js";

const ENGINE_GLOBAL_KEY = "__FPE_DIAGNOSTIC_ENGINE__";

function normalizeContext(context){
  const src = context && typeof context === "object" ? context : {};
  return {
    campaignId: String(src.campaignId || "").trim(),
    officeId: String(src.officeId || "").trim(),
    scenarioId: String(src.scenarioId || "").trim(),
  };
}

function normalizeStringList(value){
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeEvent(rawEvent, runtime){
  const raw = rawEvent && typeof rawEvent === "object" ? rawEvent : {};
  const fallbackContext = runtime?.lastContext || {};
  return {
    timestamp: String(raw.timestamp || new Date().toISOString()),
    type: String(raw.type || "unknown").trim(),
    action_name: String(raw.action_name || raw.actionName || raw.type || "unknown_action").trim(),
    handler_name: String(raw.handler_name || raw.handlerName || "").trim(),
    module: String(raw.module || "runtime").trim(),
    context: normalizeContext(raw.context || fallbackContext),
    changedTopLevel: normalizeStringList(raw.changedTopLevel),
    changedPaths: normalizeStringList(raw.changedPaths),
    doRender: typeof raw.doRender === "boolean" ? raw.doRender : undefined,
    doPersist: typeof raw.doPersist === "boolean" ? raw.doPersist : undefined,
    immediatePersist: typeof raw.immediatePersist === "boolean" ? raw.immediatePersist : undefined,
    source: String(raw.source || "").trim(),
    reason: String(raw.reason || "").trim(),
    bridgeRevision: Number(raw.bridgeRevision),
    affected_path: String(raw.affected_path || raw.affectedPath || "").trim(),
    contextReady: typeof raw.contextReady === "boolean" ? raw.contextReady : undefined,
    contextMissing: normalizeStringList(raw.contextMissing),
    reportType: String(raw.reportType || "").trim(),
    reportContext: normalizeContext(raw.reportContext || raw.context || fallbackContext),
    reportHasCanonicalSnapshot: !!raw.reportHasCanonicalSnapshot,
    reportHasValidation: !!raw.reportHasValidation,
    reportHasRealism: !!raw.reportHasRealism,
    reportHasGovernance: !!raw.reportHasGovernance,
    requiresValidation: !!raw.requiresValidation,
    validationReady: typeof raw.validationReady === "boolean" ? raw.validationReady : undefined,
    legacyDependency: raw.legacyDependency === true,
    selectedValue: raw.selectedValue,
    validOptions: Array.isArray(raw.validOptions) ? raw.validOptions.slice() : [],
    ok: typeof raw.ok === "boolean" ? raw.ok : undefined,
    identityOk: typeof raw.identityOk === "boolean" ? raw.identityOk : undefined,
    expected_behavior: String(raw.expected_behavior || "").trim(),
    observed_behavior: String(raw.observed_behavior || "").trim(),
    probable_cause: String(raw.probable_cause || "").trim(),
  };
}

function cloneRuntime(runtime){
  return {
    sequence: Number(runtime?.sequence || 0),
    stateRevision: Number(runtime?.stateRevision || 0),
    renderRevision: Number(runtime?.renderRevision || 0),
    bridgeRevision: Number(runtime?.bridgeRevision || 0),
    pendingStateWrite: runtime?.pendingStateWrite ? { ...runtime.pendingStateWrite } : null,
    lastContext: normalizeContext(runtime?.lastContext),
    lastEventType: String(runtime?.lastEventType || ""),
    lastCommitAt: String(runtime?.lastCommitAt || ""),
    lastRenderAt: String(runtime?.lastRenderAt || ""),
    lastBridgeSource: String(runtime?.lastBridgeSource || ""),
  };
}

function applyRuntimeEvent(runtime, event){
  runtime.sequence += 1;
  runtime.lastEventType = event.type;
  runtime.lastContext = normalizeContext(event.context || runtime.lastContext);

  switch (event.type){
    case "state_write":
      runtime.stateRevision += 1;
      runtime.pendingStateWrite = {
        revision: runtime.stateRevision,
        action: event.action_name,
        at: event.timestamp,
      };
      break;
    case "state_rehydrated":
      runtime.stateRevision += 1;
      runtime.pendingStateWrite = {
        revision: runtime.stateRevision,
        action: event.action_name,
        at: event.timestamp,
        rehydrated: true,
      };
      break;
    case "commit_ui_update":
      runtime.lastCommitAt = event.timestamp;
      break;
    case "render_complete":
      runtime.renderRevision = runtime.stateRevision;
      runtime.lastRenderAt = event.timestamp;
      runtime.pendingStateWrite = null;
      break;
    case "bridge_sync":
      if (Number.isFinite(event.bridgeRevision)){
        runtime.bridgeRevision = event.bridgeRevision;
      } else {
        runtime.bridgeRevision += 1;
      }
      runtime.lastBridgeSource = String(event.source || runtime.lastBridgeSource || "");
      break;
    default:
      break;
  }
}

/**
 * @param {{ store?: ReturnType<typeof getDiagnosticStore> }=} options
 */
export function createDiagnosticEngine({ store = getDiagnosticStore() } = {}){
  const runtime = {
    sequence: 0,
    stateRevision: 0,
    renderRevision: 0,
    bridgeRevision: 0,
    pendingStateWrite: null,
    lastContext: normalizeContext({}),
    lastEventType: "",
    lastCommitAt: "",
    lastRenderAt: "",
    lastBridgeSource: "",
  };

  function observe(rawEvent){
    const pre = cloneRuntime(runtime);
    const event = normalizeEvent(rawEvent, pre);
    const findings = [
      ...evaluateStateContracts(event, pre),
      ...evaluateFlowContracts(event, pre),
      ...evaluateOutputContracts(event, pre),
      ...evaluateBoundaryContracts(event, pre),
    ];
    const entries = findings.map((finding) => store.add({
      timestamp: event.timestamp,
      action_name: event.action_name,
      handler_name: event.handler_name,
      module: event.module,
      context: event.context,
      ...finding,
    }));

    applyRuntimeEvent(runtime, event);
    return {
      event,
      findings: entries,
      runtime: cloneRuntime(runtime),
    };
  }

  function listEntries(options){
    return store.list(options);
  }

  function summary(){
    const base = store.summary();
    return {
      ...base,
      runtime: cloneRuntime(runtime),
    };
  }

  function clear(){
    store.clear();
    runtime.sequence = 0;
    runtime.stateRevision = 0;
    runtime.renderRevision = 0;
    runtime.bridgeRevision = 0;
    runtime.pendingStateWrite = null;
    runtime.lastContext = normalizeContext({});
    runtime.lastEventType = "";
    runtime.lastCommitAt = "";
    runtime.lastRenderAt = "";
    runtime.lastBridgeSource = "";
  }

  return {
    observe,
    listEntries,
    summary,
    clear,
    getRuntimeSnapshot: () => cloneRuntime(runtime),
    getStore: () => store,
  };
}

export function getDiagnosticEngine(){
  if (!globalThis[ENGINE_GLOBAL_KEY]){
    globalThis[ENGINE_GLOBAL_KEY] = createDiagnosticEngine();
  }
  return globalThis[ENGINE_GLOBAL_KEY];
}
