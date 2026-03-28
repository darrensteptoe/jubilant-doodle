// @ts-check
import { getGlossaryTerm, listGlossaryTerms } from "./glossaryRegistry.js";
import { getMessageDefinition, listMessageDefinitions } from "./messageRegistry.js";
import { getDoctrineModule, listDoctrineModules } from "./moduleDoctrineRegistry.js";
import { getModelDefinition, listModelDefinitions } from "./modelRegistry.js";
import { getPlaybookEntry, listPlaybookEntries } from "./playbookRegistry.js";

export const INTELLIGENCE_STAGE_MODULE_DEFAULTS = Object.freeze({
  district: "districtRaceContext",
  map: "mapOperationsGuide",
  "election-data": "dataOperationsGuide",
  reach: "reachOperationsGuide",
  turnout: "turnoutOperationsGuide",
  outcome: "outcomeOperationsGuide",
  plan: "planOperationsGuide",
  scenarios: "scenarioOperationsGuide",
  "decision-log": "warRoomOperationsGuide",
  "war-room": "warRoomOperationsGuide",
  controls: "controlsOperationsGuide",
  data: "dataOperationsGuide",
});

export const INTELLIGENCE_STAGE_MODEL_DEFAULTS = Object.freeze({
  district: "masterTargetingEquation",
  map: "masterTargetingEquation",
  reach: "supportTurnoutMatrix",
  turnout: "contactSaturation",
  outcome: "expectedVoteGain",
  plan: "votePathOptimization",
  scenarios: "masterTargetingEquation",
  "decision-log": "masterTargetingEquation",
  "war-room": "currentFieldEfficiencyScore",
  controls: "masterTargetingEquation",
  data: "supportTurnoutMatrix",
});

/**
 * @param {string=} stageId
 */
export function getDefaultModuleForStage(stageId = ""){
  const id = String(stageId || "").trim().toLowerCase();
  if (!id) return "districtRaceContext";
  return INTELLIGENCE_STAGE_MODULE_DEFAULTS[id] || "districtRaceContext";
}

/**
 * @param {string=} stageId
 */
export function getDefaultModelForStage(stageId = ""){
  const id = String(stageId || "").trim().toLowerCase();
  if (!id) return "masterTargetingEquation";
  return INTELLIGENCE_STAGE_MODEL_DEFAULTS[id] || "masterTargetingEquation";
}

/**
 * @param {"module"|"model"|"glossary"|"message"|"playbook"} type
 * @param {string=} id
 */
export function getIntelligenceEntity(type, id = ""){
  if (type === "module") return getDoctrineModule(id);
  if (type === "model") return getModelDefinition(id);
  if (type === "glossary") return getGlossaryTerm(id);
  if (type === "message") return getMessageDefinition(id);
  if (type === "playbook") return getPlaybookEntry(id);
  return null;
}

export function listIntelligenceEntities(){
  return {
    modules: listDoctrineModules(),
    models: listModelDefinitions(),
    glossary: listGlossaryTerms(),
    messages: listMessageDefinitions(),
    playbook: listPlaybookEntries(),
  };
}
