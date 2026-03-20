// @ts-check
import { getDefaultModelForStage, getDefaultModuleForStage } from "./intelligenceRegistry.js";
import { normalizeIntelligenceMode } from "./intelligenceResolver.js";
import { getDefaultPlaybookForStage } from "./playbookRegistry.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

/**
 * @param {any=} options
 */
export function makeDefaultIntelligenceState(options = {}){
  const src = (options && typeof options === "object") ? options : {};
  const stageId = clean(src.stageId) || "district";
  return {
    mode: "module",
    stageId,
    moduleId: getDefaultModuleForStage(stageId),
    modelId: getDefaultModelForStage(stageId),
    playbookId: getDefaultPlaybookForStage(stageId),
    termId: "",
    messageId: "",
    query: "",
  };
}

/**
 * @param {any=} stateLike
 * @param {any=} options
 */
export function normalizeIntelligenceState(stateLike = {}, options = {}){
  const src = (stateLike && typeof stateLike === "object") ? stateLike : {};
  const fallback = makeDefaultIntelligenceState(options);
  const stageId = clean(src.stageId) || fallback.stageId;
  const mode = normalizeIntelligenceMode(src.mode || fallback.mode);
  const out = {
    mode,
    stageId,
    moduleId: clean(src.moduleId) || getDefaultModuleForStage(stageId),
    modelId: clean(src.modelId) || getDefaultModelForStage(stageId),
    playbookId: clean(src.playbookId) || getDefaultPlaybookForStage(stageId),
    termId: clean(src.termId),
    messageId: clean(src.messageId),
    query: clean(src.query),
  };
  if (mode === "module" && !out.moduleId){
    out.moduleId = getDefaultModuleForStage(stageId);
  }
  if (mode === "model" && !out.modelId){
    out.modelId = getDefaultModelForStage(stageId);
  }
  if (mode === "playbook" && !out.playbookId){
    out.playbookId = getDefaultPlaybookForStage(stageId);
  }
  return out;
}

/**
 * @param {any=} current
 * @param {{ type?: string, payload?: any }=} action
 */
export function reduceIntelligenceState(current = {}, action = {}){
  const state = normalizeIntelligenceState(current);
  const next = { ...state };
  const type = clean(action?.type);
  const payload = (action?.payload && typeof action.payload === "object") ? action.payload : {};

  if (type === "set_stage"){
    const stageId = clean(payload.stageId) || state.stageId;
    next.stageId = stageId;
    if (next.mode === "module" && !clean(payload.keepModuleId)){
      next.moduleId = clean(payload.moduleId) || getDefaultModuleForStage(stageId);
    }
    if (next.mode === "model" && !clean(payload.keepModelId)){
      next.modelId = clean(payload.modelId) || getDefaultModelForStage(stageId);
    }
    if (next.mode === "playbook" && !clean(payload.keepPlaybookId)){
      next.playbookId = clean(payload.playbookId) || getDefaultPlaybookForStage(stageId);
    }
    return normalizeIntelligenceState(next);
  }

  if (type === "set_mode"){
    next.mode = normalizeIntelligenceMode(payload.mode);
    if (next.mode === "module" && !next.moduleId){
      next.moduleId = getDefaultModuleForStage(next.stageId);
    }
    if (next.mode === "model" && !next.modelId){
      next.modelId = getDefaultModelForStage(next.stageId);
    }
    if (next.mode === "playbook" && !next.playbookId){
      next.playbookId = getDefaultPlaybookForStage(next.stageId);
    }
    return normalizeIntelligenceState(next);
  }

  if (type === "open_module"){
    next.mode = "module";
    next.moduleId = clean(payload.moduleId) || next.moduleId || getDefaultModuleForStage(next.stageId);
    return normalizeIntelligenceState(next);
  }

  if (type === "open_glossary"){
    next.mode = "glossary";
    next.termId = clean(payload.termId);
    return normalizeIntelligenceState(next);
  }

  if (type === "open_message"){
    next.mode = "message";
    next.messageId = clean(payload.messageId);
    return normalizeIntelligenceState(next);
  }

  if (type === "open_playbook"){
    next.mode = "playbook";
    next.playbookId = clean(payload.playbookId) || next.playbookId || getDefaultPlaybookForStage(next.stageId);
    return normalizeIntelligenceState(next);
  }

  if (type === "open_model"){
    next.mode = "model";
    next.modelId = clean(payload.modelId) || next.modelId || getDefaultModelForStage(next.stageId);
    return normalizeIntelligenceState(next);
  }

  if (type === "search"){
    next.mode = "search";
    next.query = clean(payload.query);
    return normalizeIntelligenceState(next);
  }

  return state;
}
