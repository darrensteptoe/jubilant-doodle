// @ts-check
import {
  deriveTargetSignalsForRow,
  listTargetModels,
} from "../core/targetModels.js";
import { resolveCanonicalWeightProfile } from "../core/targetFeatureEngine.js";
import { TARGET_FEATURE_KEYS } from "../core/targetFeatureRegistry.js";
import {
  TARGET_PRIORITY_MODEL_IDS,
  scoreTargetRows,
} from "../core/targetRankingEngine.js";
import { countTopTargetRows } from "../core/targetingRows.js";
import { clampFiniteNumber, coerceFiniteNumber, formatFixedNumber, roundWholeNumberByMode } from "../core/utils.js";

const TARGET_GEO_LEVELS = Object.freeze([
  { id: "block_group", label: "Block group" },
  { id: "tract", label: "Tract" },
]);

export const TARGETING_STATUS_LOAD_ROWS_FIRST = "Load ACS rows before running targeting.";
export const TARGETING_STATUS_NO_MATCH =
  "Targeting run complete: no rows matched current filters. Relax thresholds and retry.";

const TARGET_MODEL_PRESETS = Object.freeze({
  turnout_opportunity: Object.freeze({
    id: "turnout_opportunity",
    modelId: "turnout_opportunity",
    label: "Turnout Opportunity (Core)",
    description: "Core turnout-opportunity profile.",
    geoLevel: "block_group",
    topN: 50,
    minHousingUnits: 50,
    minPopulation: 120,
    minScore: 0.35,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: true,
      prioritizeRenters: true,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.30,
      turnoutOpportunity: 0.50,
      persuasionIndex: 0.10,
      fieldEfficiency: 0.10,
    },
  }),
  persuasion_first: Object.freeze({
    id: "persuasion_first",
    modelId: "persuasion_first",
    label: "Persuasion First (Core)",
    description: "Core persuasion-first profile.",
    geoLevel: "block_group",
    topN: 40,
    minHousingUnits: 40,
    minPopulation: 100,
    minScore: 0.40,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: false,
      prioritizeRenters: false,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.30,
      turnoutOpportunity: 0.15,
      persuasionIndex: 0.45,
      fieldEfficiency: 0.10,
    },
  }),
  field_efficiency: Object.freeze({
    id: "field_efficiency",
    modelId: "field_efficiency",
    label: "Field Efficiency (Core)",
    description: "Core field-efficiency profile.",
    geoLevel: "block_group",
    topN: 35,
    minHousingUnits: 75,
    minPopulation: 150,
    minScore: 0.50,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: false,
      prioritizeRenters: false,
      avoidHighMultiUnit: true,
      densityFloor: "high",
    },
    weights: {
      votePotential: 0.35,
      turnoutOpportunity: 0.15,
      persuasionIndex: 0.05,
      fieldEfficiency: 0.45,
    },
  }),
  house_v1: Object.freeze({
    id: "house_v1",
    modelId: "house_v1",
    label: "House Model v1 (Core)",
    description: "Balanced core house profile.",
    geoLevel: "block_group",
    topN: 25,
    minHousingUnits: 35,
    minPopulation: 90,
    minScore: 0.38,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: true,
      prioritizeRenters: false,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.35,
      turnoutOpportunity: 0.25,
      persuasionIndex: 0.20,
      fieldEfficiency: 0.20,
    },
  }),
  obama_persuasion: Object.freeze({
    id: "obama_persuasion",
    modelId: "persuasion_first",
    label: "Obama Persuasion",
    description: "Persuasion-heavy targeting window with medium-density guardrails.",
    geoLevel: "block_group",
    topN: 40,
    minHousingUnits: 40,
    minPopulation: 100,
    minScore: 0.40,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: false,
      prioritizeRenters: false,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.30,
      turnoutOpportunity: 0.15,
      persuasionIndex: 0.45,
      fieldEfficiency: 0.10,
    },
  }),
  obama_turnout: Object.freeze({
    id: "obama_turnout",
    modelId: "turnout_opportunity",
    label: "Obama Turnout",
    description: "Mobilization-first profile for turnout expansion.",
    geoLevel: "block_group",
    topN: 50,
    minHousingUnits: 50,
    minPopulation: 120,
    minScore: 0.35,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: true,
      prioritizeRenters: true,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.30,
      turnoutOpportunity: 0.50,
      persuasionIndex: 0.05,
      fieldEfficiency: 0.15,
    },
  }),
  biden_expansion: Object.freeze({
    id: "biden_expansion",
    modelId: "persuasion_first",
    label: "Biden Expansion",
    description: "Vote-bank expansion blend across vote scale, persuasion, and turnout.",
    geoLevel: "block_group",
    topN: 50,
    minHousingUnits: 45,
    minPopulation: 110,
    minScore: 0.36,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: true,
      prioritizeRenters: true,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.40,
      turnoutOpportunity: 0.20,
      persuasionIndex: 0.30,
      fieldEfficiency: 0.10,
    },
  }),
  efficiency_sweep: Object.freeze({
    id: "efficiency_sweep",
    modelId: "field_efficiency",
    label: "Efficiency Sweep",
    description: "Late-cycle high-efficiency sweep with strict field feasibility filters.",
    geoLevel: "block_group",
    topN: 35,
    minHousingUnits: 75,
    minPopulation: 150,
    minScore: 0.50,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: false,
      prioritizeRenters: false,
      avoidHighMultiUnit: true,
      densityFloor: "high",
    },
    weights: {
      votePotential: 0.35,
      turnoutOpportunity: 0.15,
      persuasionIndex: 0.05,
      fieldEfficiency: 0.45,
    },
  }),
  hybrid_model: Object.freeze({
    id: "hybrid_model",
    modelId: "house_v1",
    label: "Hybrid Model",
    description: "Balanced persuasion + turnout + feasibility blend for mixed districts.",
    geoLevel: "block_group",
    topN: 30,
    minHousingUnits: 35,
    minPopulation: 90,
    minScore: 0.38,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    criteria: {
      prioritizeYoung: true,
      prioritizeRenters: false,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.35,
      turnoutOpportunity: 0.25,
      persuasionIndex: 0.20,
      fieldEfficiency: 0.20,
    },
  }),
});

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function floorTargetingInt(value, { min = 0, max = null, fallback = 0 } = {}){
  const rounded = roundWholeNumberByMode(value, { mode: "floor", fallback: null });
  if (rounded == null || !Number.isFinite(rounded)){
    return fallback;
  }
  let out = rounded;
  if (Number.isFinite(min)) out = Math.max(min, out);
  if (max != null && Number.isFinite(max)) out = Math.min(max, out);
  return out;
}

export function buildTargetingRunCompleteStatus(rowCount, topCount, locale = "en-US"){
  const rows = floorTargetingInt(rowCount, { min: 0, fallback: 0 });
  const tops = floorTargetingInt(topCount, { min: 0, fallback: 0 });
  return `Targeting run complete: ${rows.toLocaleString(locale)} rows ranked, ${tops.toLocaleString(locale)} top targets flagged.`;
}

export function countTopTargets(rows){
  return countTopTargetRows(rows);
}

export function applyTargetingRunResult(targetingState, runResult, { locale = "en-US" } = {}){
  const target = targetingState && typeof targetingState === "object" ? targetingState : null;
  const rows = Array.isArray(runResult?.rows) ? runResult.rows : [];
  const meta = runResult?.meta && typeof runResult.meta === "object" ? runResult.meta : null;
  const ranAt = cleanText(runResult?.meta?.ranAt) || new Date().toISOString();
  const topCount = countTopTargets(rows);
  const hasRows = rows.length > 0;
  const statusText = hasRows
    ? buildTargetingRunCompleteStatus(rows.length, topCount, locale)
    : TARGETING_STATUS_NO_MATCH;

  if (target){
    target.lastRows = rows;
    target.lastMeta = meta;
    target.lastRun = ranAt;
  }

  return {
    rows,
    meta,
    ranAt,
    topCount,
    hasRows,
    statusText,
  };
}

export function normalizeTargetRankingModelSlug(value){
  return cleanText(value)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "model";
}

export function normalizeTargetRankingFileStamp(value = ""){
  const src = cleanText(value) || new Date().toISOString();
  return src.replace(/[:.]/g, "-");
}

export function buildTargetRankingExportFilename({
  presetId = "",
  modelId = "",
  extension = "csv",
  stamp = "",
} = {}){
  const ext = cleanText(extension).replace(/^\.+/, "").toLowerCase() || "txt";
  const model = normalizeTargetRankingModelSlug(cleanText(presetId) || cleanText(modelId) || "model");
  const timestamp = normalizeTargetRankingFileStamp(stamp);
  return `target-ranking-${model}-${timestamp}.${ext}`;
}

export function buildTargetRankingPayloadConfig(targetingState){
  const target = targetingState && typeof targetingState === "object" ? targetingState : {};
  return {
    enabled: !!target.enabled,
    presetId: cleanText(target.presetId),
    geoLevel: cleanText(target.geoLevel),
    modelId: cleanText(target.modelId),
    topN: Number(target.topN),
    minHousingUnits: Number(target.minHousingUnits),
    minPopulation: Number(target.minPopulation),
    minScore: Number(target.minScore),
    excludeZeroHousing: !!target.excludeZeroHousing,
    onlyRaceFootprint: !!target.onlyRaceFootprint,
    weights: target.weights && typeof target.weights === "object" ? { ...target.weights } : {},
    criteria: target.criteria && typeof target.criteria === "object" ? { ...target.criteria } : {},
  };
}

const safeNum = coerceFiniteNumber;
const clamp = clampFiniteNumber;

function normalizeWeights(input, modelId = "house_v1"){
  const src = input && typeof input === "object" ? input : {};
  return resolveCanonicalWeightProfile({
    profileId: cleanText(modelId) || "house_v1",
    customWeights: src,
  });
}

function normalizeRows(input){
  const rows = Array.isArray(input) ? input : [];
  return rows.map((row) => {
    const reasons = Array.isArray(row?.reasons) ? row.reasons.map((value) => cleanText(value)).filter((value) => !!value) : [];
    const flags = Array.isArray(row?.flags) ? row.flags.map((value) => cleanText(value)).filter((value) => !!value) : [];
    const scoreByModelSrc = row?.scoreByModel && typeof row.scoreByModel === "object" ? row.scoreByModel : {};
    const modelRanksSrc = row?.modelRanks && typeof row.modelRanks === "object" ? row.modelRanks : {};
    return {
      rank: floorTargetingInt(row?.rank, { min: 1, fallback: 0 }),
      geoid: cleanText(row?.geoid),
      label: cleanText(row?.label),
      memberCount: floorTargetingInt(row?.memberCount, { min: 1, fallback: 1 }),
      score: Number.isFinite(Number(row?.score)) ? Number(row.score) : 0,
      baseScore: Number.isFinite(Number(row?.baseScore)) ? Number(row.baseScore) : null,
      targetScore: Number.isFinite(Number(row?.targetScore)) ? Number(row.targetScore) : null,
      expectedNetVoteValue: Number.isFinite(Number(row?.expectedNetVoteValue)) ? Number(row.expectedNetVoteValue) : null,
      upliftExpectedMarginalGain: Number.isFinite(Number(row?.upliftExpectedMarginalGain)) ? Number(row.upliftExpectedMarginalGain) : null,
      upliftBestChannel: cleanText(row?.upliftBestChannel),
      isTopTarget: !!row?.isTopTarget,
      targetLabel: cleanText(row?.targetLabel),
      reasonText: cleanText(row?.reasonText),
      flagText: cleanText(row?.flagText),
      reasons,
      flags,
      explainDrivers: Array.isArray(row?.explainDrivers) ? row.explainDrivers.map((item) => ({
        key: cleanText(item?.key),
        label: cleanText(item?.label),
        text: cleanText(item?.text),
      })) : [],
      rawSignals: row?.rawSignals && typeof row.rawSignals === "object" ? { ...row.rawSignals } : {},
      componentScores: row?.componentScores && typeof row.componentScores === "object" ? { ...row.componentScores } : {},
      scoreByModel: {
        turnout_opportunity: Number.isFinite(Number(scoreByModelSrc.turnout_opportunity)) ? Number(scoreByModelSrc.turnout_opportunity) : null,
        persuasion_first: Number.isFinite(Number(scoreByModelSrc.persuasion_first)) ? Number(scoreByModelSrc.persuasion_first) : null,
        field_efficiency: Number.isFinite(Number(scoreByModelSrc.field_efficiency)) ? Number(scoreByModelSrc.field_efficiency) : null,
      },
      modelRanks: {
        turnout_opportunity: floorTargetingInt(modelRanksSrc.turnout_opportunity, { min: 1, fallback: null }),
        persuasion_first: floorTargetingInt(modelRanksSrc.persuasion_first, { min: 1, fallback: null }),
        field_efficiency: floorTargetingInt(modelRanksSrc.field_efficiency, { min: 1, fallback: null }),
      },
      isTurnoutPriority: !!row?.isTurnoutPriority,
      isPersuasionPriority: !!row?.isPersuasionPriority,
      isEfficiencyPriority: !!row?.isEfficiencyPriority,
      votesPerOrganizerHour: Number.isFinite(Number(row?.votesPerOrganizerHour)) ? Number(row.votesPerOrganizerHour) : null,
    };
  }).filter((row) => !!row.geoid);
}

function normalizeMeta(input){
  const src = input && typeof input === "object" ? input : {};
  return {
    presetId: cleanText(src.presetId),
    presetLabel: cleanText(src.presetLabel),
    modelId: cleanText(src.modelId) || "turnout_opportunity",
    modelLabel: cleanText(src.modelLabel),
    geoLevel: cleanText(src.geoLevel) || "block_group",
    totalRows: floorTargetingInt(src.totalRows, { min: 0, fallback: 0 }),
    topN: floorTargetingInt(src.topN, { min: 1, fallback: 25 }),
    contextKey: cleanText(src.contextKey),
    ranAt: cleanText(src.ranAt),
    selectedGeoCount: floorTargetingInt(src.selectedGeoCount, { min: 0, fallback: 0 }),
  };
}

function normalizeCriteria(input){
  const src = input && typeof input === "object" ? input : {};
  const densityFloorRaw = cleanText(src.densityFloor);
  const densityFloor = ["none", "medium", "high"].includes(densityFloorRaw) ? densityFloorRaw : "none";
  return {
    prioritizeYoung: !!src.prioritizeYoung,
    prioritizeRenters: !!src.prioritizeRenters,
    avoidHighMultiUnit: !!src.avoidHighMultiUnit,
    densityFloor,
  };
}

function normalizeTargetModelPreset(modelId, input){
  const src = input && typeof input === "object" ? input : {};
  const geoLevelRaw = cleanText(src.geoLevel);
  const geoLevel = TARGET_GEO_LEVELS.some((row) => row.id === geoLevelRaw) ? geoLevelRaw : "block_group";
  const coreModelIds = new Set(listTargetModels().map((row) => cleanText(row.id)));
  const resolvedModelIdRaw = cleanText(src.modelId) || cleanText(modelId);
  const resolvedModelId = coreModelIds.has(resolvedModelIdRaw) ? resolvedModelIdRaw : "house_v1";
  return {
    id: cleanText(src.id) || cleanText(modelId) || "house_v1",
    modelId: resolvedModelId,
    label: cleanText(src.label) || cleanText(modelId) || "Model preset",
    description: cleanText(src.description),
    geoLevel,
    topN: Number.isFinite(Number(src.topN)) ? clamp(Number(src.topN), 1, 500) : 25,
    minHousingUnits: Number.isFinite(Number(src.minHousingUnits)) ? Math.max(0, Number(src.minHousingUnits)) : 0,
    minPopulation: Number.isFinite(Number(src.minPopulation)) ? Math.max(0, Number(src.minPopulation)) : 0,
    minScore: Number.isFinite(Number(src.minScore)) ? Math.max(0, Number(src.minScore)) : 0,
    excludeZeroHousing: src.excludeZeroHousing == null ? true : !!src.excludeZeroHousing,
    onlyRaceFootprint: src.onlyRaceFootprint == null ? true : !!src.onlyRaceFootprint,
    weights: normalizeWeights(src.weights, resolvedModelId),
    criteria: normalizeCriteria(src.criteria),
  };
}

export function getTargetModelPreset(modelId){
  const id = cleanText(modelId);
  const key = Object.prototype.hasOwnProperty.call(TARGET_MODEL_PRESETS, id) ? id : "turnout_opportunity";
  return normalizeTargetModelPreset(key, TARGET_MODEL_PRESETS[key]);
}

export function getTargetingBridgeDefaults(presetId = "turnout_opportunity"){
  const fallback = getTargetModelPreset("turnout_opportunity");
  const preset = getTargetModelPreset(presetId);
  const source = preset && typeof preset === "object" ? preset : fallback;
  const criteria = source?.criteria && typeof source.criteria === "object" ? source.criteria : fallback.criteria;
  const weights = source?.weights && typeof source.weights === "object" ? source.weights : fallback.weights;
  return {
    presetId: cleanText(source?.id) || cleanText(fallback?.id) || "turnout_opportunity",
    geoLevel: cleanText(source?.geoLevel) || cleanText(fallback?.geoLevel) || "block_group",
    modelId: cleanText(source?.modelId) || cleanText(fallback?.modelId) || "turnout_opportunity",
    topN: Number.isFinite(Number(source?.topN)) ? Number(source.topN) : Number(fallback?.topN),
    minHousingUnits: Number.isFinite(Number(source?.minHousingUnits)) ? Number(source.minHousingUnits) : Number(fallback?.minHousingUnits),
    minPopulation: Number.isFinite(Number(source?.minPopulation)) ? Number(source.minPopulation) : Number(fallback?.minPopulation),
    minScore: Number.isFinite(Number(source?.minScore)) ? Number(source.minScore) : Number(fallback?.minScore),
    onlyRaceFootprint: source?.onlyRaceFootprint == null
      ? (fallback?.onlyRaceFootprint == null ? true : !!fallback.onlyRaceFootprint)
      : !!source.onlyRaceFootprint,
    prioritizeYoung: criteria?.prioritizeYoung == null ? false : !!criteria.prioritizeYoung,
    prioritizeRenters: criteria?.prioritizeRenters == null ? false : !!criteria.prioritizeRenters,
    avoidHighMultiUnit: criteria?.avoidHighMultiUnit == null ? false : !!criteria.avoidHighMultiUnit,
    densityFloor: cleanText(criteria?.densityFloor) || "none",
    weightVotePotential: Number.isFinite(Number(weights?.votePotential)) ? Number(weights.votePotential) : 0,
    weightTurnoutOpportunity: Number.isFinite(Number(weights?.turnoutOpportunity)) ? Number(weights.turnoutOpportunity) : 0,
    weightPersuasionIndex: Number.isFinite(Number(weights?.persuasionIndex)) ? Number(weights.persuasionIndex) : 0,
    weightFieldEfficiency: Number.isFinite(Number(weights?.fieldEfficiency)) ? Number(weights.fieldEfficiency) : 0,
  };
}

export function applyTargetingFieldPatch(targetingState, field, rawValue){
  const target = targetingState && typeof targetingState === "object" ? targetingState : null;
  const key = cleanText(field);
  if (!target || !key){
    return false;
  }

  target.criteria = target.criteria && typeof target.criteria === "object" ? target.criteria : {};
  target.weights = target.weights && typeof target.weights === "object" ? target.weights : {};

  if (key === "geoLevel"){
    const value = cleanText(rawValue);
    if (!value) return false;
    target.geoLevel = value;
    return true;
  }
  if (key === "topN"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.topN = floorTargetingInt(value, { min: 1, max: 500, fallback: null });
    if (!Number.isFinite(target.topN)) return false;
    return true;
  }
  if (key === "minHousingUnits"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.minHousingUnits = floorTargetingInt(value, { min: 0, fallback: null });
    if (!Number.isFinite(target.minHousingUnits)) return false;
    return true;
  }
  if (key === "minPopulation"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.minPopulation = floorTargetingInt(value, { min: 0, fallback: null });
    if (!Number.isFinite(target.minPopulation)) return false;
    return true;
  }
  if (key === "minScore"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.minScore = Math.max(0, value);
    return true;
  }
  if (key === "onlyRaceFootprint"){
    target.onlyRaceFootprint = !!rawValue;
    return true;
  }
  if (key === "prioritizeYoung"){
    target.criteria.prioritizeYoung = !!rawValue;
    return true;
  }
  if (key === "prioritizeRenters"){
    target.criteria.prioritizeRenters = !!rawValue;
    return true;
  }
  if (key === "avoidHighMultiUnit"){
    target.criteria.avoidHighMultiUnit = !!rawValue;
    return true;
  }
  if (key === "densityFloor"){
    const value = cleanText(rawValue);
    target.criteria.densityFloor = ["none", "medium", "high"].includes(value) ? value : "none";
    return true;
  }
  if (key === "weightVotePotential"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.weights.votePotential = Math.max(0, value);
    return true;
  }
  if (key === "weightTurnoutOpportunity"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.weights.turnoutOpportunity = Math.max(0, value);
    return true;
  }
  if (key === "weightPersuasionIndex"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.weights.persuasionIndex = Math.max(0, value);
    return true;
  }
  if (key === "weightFieldEfficiency"){
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return false;
    target.weights.fieldEfficiency = Math.max(0, value);
    return true;
  }
  return false;
}

export function resetTargetingWeightsToPreset(targetingState, presetId = ""){
  const target = targetingState && typeof targetingState === "object" ? targetingState : null;
  if (!target){
    return { ok: false, preset: null, weights: null };
  }
  const resolvedPresetId = cleanText(presetId) || cleanText(target.presetId) || cleanText(target.modelId) || "turnout_opportunity";
  const preset = getTargetModelPreset(resolvedPresetId);
  const modelId = cleanText(preset?.modelId) || cleanText(target.modelId) || "house_v1";
  const weights = resolveCanonicalWeightProfile({
    profileId: modelId,
    customWeights: preset?.weights && typeof preset.weights === "object" ? preset.weights : {},
  });
  target.weights = { ...weights };
  return { ok: true, preset, weights: { ...target.weights } };
}

export function applyTargetModelPreset(targetingState, modelId){
  const target = targetingState && typeof targetingState === "object"
    ? targetingState
    : makeDefaultTargetingState();
  const preset = getTargetModelPreset(modelId);
  target.presetId = preset.id;
  target.modelId = preset.modelId;
  target.geoLevel = preset.geoLevel;
  target.topN = preset.topN;
  target.minHousingUnits = preset.minHousingUnits;
  target.minPopulation = preset.minPopulation;
  target.minScore = preset.minScore;
  target.excludeZeroHousing = preset.excludeZeroHousing;
  target.onlyRaceFootprint = preset.onlyRaceFootprint;
  target.weights = { ...preset.weights };
  target.criteria = { ...preset.criteria };
  return { targeting: target, preset };
}

export function makeDefaultTargetingState(){
  const preset = getTargetModelPreset("turnout_opportunity");
  return {
    enabled: true,
    presetId: preset.id,
    geoLevel: preset.geoLevel,
    modelId: preset.modelId,
    topN: preset.topN,
    minHousingUnits: preset.minHousingUnits,
    minPopulation: preset.minPopulation,
    minScore: preset.minScore,
    excludeZeroHousing: !!preset.excludeZeroHousing,
    onlyRaceFootprint: !!preset.onlyRaceFootprint,
    weights: { ...preset.weights },
    criteria: { ...preset.criteria },
    lastRun: "",
    lastRows: [],
    lastMeta: null,
  };
}

export function normalizeTargetingState(input){
  const base = makeDefaultTargetingState();
  const src = input && typeof input === "object" ? input : {};
  const modelIds = new Set(listTargetModels().map((row) => row.id));
  const presetIds = new Set(Object.keys(TARGET_MODEL_PRESETS).map((id) => cleanText(id)));
  const presetIdRaw = cleanText(src.presetId);
  const modelIdRaw = cleanText(src.modelId);
  const presetId = presetIds.has(presetIdRaw)
    ? presetIdRaw
    : (presetIds.has(modelIdRaw) ? modelIdRaw : cleanText(base.presetId));
  const preset = getTargetModelPreset(presetId);
  const geoLevelRaw = cleanText(src.geoLevel);
  const geoLevel = TARGET_GEO_LEVELS.some((row) => row.id === geoLevelRaw)
    ? geoLevelRaw
    : cleanText(preset?.geoLevel || base.geoLevel);
  const modelId = modelIds.has(modelIdRaw)
    ? modelIdRaw
    : (modelIds.has(cleanText(preset?.modelId)) ? cleanText(preset.modelId) : base.modelId);
  const hasTopN = Number.isFinite(Number(src.topN));
  const hasMinHousingUnits = Number.isFinite(Number(src.minHousingUnits));
  const hasMinPopulation = Number.isFinite(Number(src.minPopulation));
  const hasMinScore = Number.isFinite(Number(src.minScore));
  const hasExcludeZeroHousing = src.excludeZeroHousing != null;
  const hasOnlyRaceFootprint = src.onlyRaceFootprint != null;
  const hasWeights = !!(src.weights && typeof src.weights === "object" && Object.keys(src.weights).length);
  const hasCriteria = !!(src.criteria && typeof src.criteria === "object" && Object.keys(src.criteria).length);
  const presetWeights = normalizeWeights(preset?.weights, modelId);
  const presetCriteria = normalizeCriteria(preset?.criteria);
  return {
    ...base,
    ...src,
    enabled: src.enabled == null ? base.enabled : !!src.enabled,
    presetId,
    geoLevel,
    modelId,
    topN: hasTopN ? clamp(Number(src.topN), 1, 500) : (preset?.topN ?? base.topN),
    minHousingUnits: hasMinHousingUnits ? Math.max(0, Number(src.minHousingUnits)) : (preset?.minHousingUnits ?? base.minHousingUnits),
    minPopulation: hasMinPopulation ? Math.max(0, Number(src.minPopulation)) : (preset?.minPopulation ?? base.minPopulation),
    minScore: hasMinScore ? Math.max(0, Number(src.minScore)) : (preset?.minScore ?? base.minScore),
    excludeZeroHousing: hasExcludeZeroHousing ? !!src.excludeZeroHousing : (preset?.excludeZeroHousing ?? base.excludeZeroHousing),
    onlyRaceFootprint: hasOnlyRaceFootprint ? !!src.onlyRaceFootprint : (preset?.onlyRaceFootprint ?? base.onlyRaceFootprint),
    weights: hasWeights ? normalizeWeights(src.weights, modelId) : presetWeights,
    criteria: hasCriteria ? normalizeCriteria(src.criteria) : presetCriteria,
    lastRun: cleanText(src.lastRun),
    lastRows: normalizeRows(src.lastRows),
    lastMeta: src.lastMeta ? normalizeMeta(src.lastMeta) : null,
  };
}

export function listTargetGeoLevels(){
  return TARGET_GEO_LEVELS.map((row) => ({ ...row }));
}

export function listTargetModelOptions(){
  const preferredOrder = [
    "obama_persuasion",
    "obama_turnout",
    "biden_expansion",
    "efficiency_sweep",
    "hybrid_model",
    "turnout_opportunity",
    "persuasion_first",
    "field_efficiency",
    "house_v1",
  ];
  const seen = new Set();
  const ordered = [];
  for (const id of preferredOrder){
    if (Object.prototype.hasOwnProperty.call(TARGET_MODEL_PRESETS, id) && !seen.has(id)){
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of Object.keys(TARGET_MODEL_PRESETS)){
    if (!seen.has(id)){
      ordered.push(id);
      seen.add(id);
    }
  }
  return ordered.map((id) => {
    const preset = normalizeTargetModelPreset(id, TARGET_MODEL_PRESETS[id]);
    return {
      id: preset.id,
      label: preset.label,
      description: preset.description || `Preset mapped to ${preset.modelId}.`,
      modelId: preset.modelId,
    };
  });
}

export function computeTargetingContextKey({ state, censusState, config } = {}){
  const modelIds = new Set(listTargetModels().map((row) => row.id));
  const presetIds = new Set(Object.keys(TARGET_MODEL_PRESETS).map((id) => cleanText(id)));
  const presetIdRaw = cleanText(config?.presetId);
  const presetId = presetIds.has(presetIdRaw) ? presetIdRaw : "";
  const geoLevelRaw = cleanText(config?.geoLevel);
  const geoLevel = TARGET_GEO_LEVELS.some((row) => row.id === geoLevelRaw) ? geoLevelRaw : "block_group";
  const modelIdRaw = cleanText(config?.modelId);
  const modelId = modelIds.has(modelIdRaw) ? modelIdRaw : "turnout_opportunity";
  const topN = floorTargetingInt(config?.topN, { min: 1, fallback: 25 });
  const minHousingUnits = floorTargetingInt(config?.minHousingUnits, { min: 0, fallback: 0 });
  const minPopulation = floorTargetingInt(config?.minPopulation, { min: 0, fallback: 0 });
  const minScore = Number.isFinite(Number(config?.minScore)) ? Math.max(0, Number(config.minScore)) : 0;
  const excludeZeroHousing = config?.excludeZeroHousing == null ? true : !!config.excludeZeroHousing;
  const onlyRaceFootprint = config?.onlyRaceFootprint == null ? true : !!config.onlyRaceFootprint;
  const criteria = config?.criteria && typeof config.criteria === "object" ? config.criteria : {};
  const densityFloorRaw = cleanText(criteria.densityFloor);
  const densityFloor = ["none", "medium", "high"].includes(densityFloorRaw) ? densityFloorRaw : "none";
  const prioritizeYoung = !!criteria.prioritizeYoung;
  const prioritizeRenters = !!criteria.prioritizeRenters;
  const avoidHighMultiUnit = !!criteria.avoidHighMultiUnit;
  const weights = config?.weights && typeof config.weights === "object" ? config.weights : {};
  const canonicalWeights = resolveCanonicalWeightProfile({ profileId: modelId, customWeights: weights });
  const weightKey = TARGET_FEATURE_KEYS
    .map((key) => formatFixedNumber(canonicalWeights?.[key] ?? 0, 6, "0.000000"))
    .join("/");
  const s = censusState && typeof censusState === "object" ? censusState : {};
  const selectedGeoids = Array.isArray(s.selectedGeoids) ? s.selectedGeoids.map((id) => cleanText(id)).filter((id) => !!id).sort((a, b) => a.localeCompare(b)) : [];
  const raceFootprint = state?.raceFootprint && typeof state.raceFootprint === "object" ? state.raceFootprint : null;
  const fp = Array.isArray(raceFootprint?.geoids)
    ? raceFootprint.geoids.map((id) => cleanText(id)).filter((id) => !!id).sort((a, b) => a.localeCompare(b)).join(",")
    : "";
  return [
    cleanText(s.activeRowsKey),
    cleanText(s.year),
    cleanText(s.resolution),
    cleanText(s.metricSet),
    presetId,
    geoLevel,
    modelId,
    String(topN),
    String(minHousingUnits),
    String(minPopulation),
    String(minScore),
    excludeZeroHousing ? "1" : "0",
    onlyRaceFootprint ? "1" : "0",
    prioritizeYoung ? "1" : "0",
    prioritizeRenters ? "1" : "0",
    avoidHighMultiUnit ? "1" : "0",
    densityFloor,
    weightKey,
    selectedGeoids.join(","),
    fp,
  ].join("|");
}

function addRowValues(target, source){
  const src = source && typeof source === "object" ? source : {};
  const out = target && typeof target === "object" ? target : {};
  for (const [key, value] of Object.entries(src)){
    const n = safeNum(value);
    if (n == null) continue;
    out[key] = (safeNum(out[key]) ?? 0) + n;
  }
  return out;
}

function aggregateRowsToTracts(rows){
  const grouped = new Map();
  for (const row of rows || []){
    const geoid = cleanText(row?.geoid);
    if (!geoid || geoid.length < 11) continue;
    const tract = geoid.slice(0, 11);
    const hit = grouped.get(tract) || {
      geoid: tract,
      label: `Tract ${tract}`,
      values: {},
      memberCount: 0,
      sourceGeoids: [],
    };
    hit.values = addRowValues(hit.values, row?.values);
    hit.memberCount += 1;
    hit.sourceGeoids.push(geoid);
    grouped.set(tract, hit);
  }
  return Array.from(grouped.values()).sort((a, b) => a.geoid.localeCompare(b.geoid));
}

function keepByDensityFloor(signal, densityFloor){
  const floor = cleanText(densityFloor);
  if (!floor || floor === "none") return true;
  const band = cleanText(signal?.densityBand?.id);
  if (floor === "medium"){
    return band !== "low_density";
  }
  if (floor === "high"){
    return band === "high_density" || band === "medium_high_density";
  }
  return true;
}

function matchRaceFootprintFilter(row, state){
  const footprint = state?.raceFootprint && typeof state.raceFootprint === "object" ? state.raceFootprint : null;
  const geoids = Array.isArray(footprint?.geoids) ? footprint.geoids.map((id) => cleanText(id)).filter((id) => !!id) : [];
  if (!geoids.length){
    return true;
  }
  const lookup = new Set(geoids);
  const geoid = cleanText(row?.geoid);
  if (lookup.has(geoid)){
    return true;
  }
  if (geoid.length === 11){
    for (const candidate of lookup){
      if (candidate.slice(0, 11) === geoid) return true;
    }
  }
  return false;
}

function runRowsForContext(rowsByGeoid, censusState, cfg, state){
  const rowsMap = rowsByGeoid && typeof rowsByGeoid === "object" ? rowsByGeoid : {};
  const selectedGeoids = Array.isArray(censusState?.selectedGeoids)
    ? censusState.selectedGeoids.map((id) => cleanText(id)).filter((id) => !!id)
    : [];
  const selection = selectedGeoids.length ? selectedGeoids : Object.keys(rowsMap);
  const sourceRows = selection
    .map((geoid) => rowsMap[geoid])
    .filter((row) => row && typeof row === "object");

  const rows = cfg.geoLevel === "tract"
    ? aggregateRowsToTracts(sourceRows)
    : sourceRows.map((row) => ({
        geoid: cleanText(row?.geoid),
        label: cleanText(row?.label || row?.name || row?.geoid),
        values: row?.values && typeof row.values === "object" ? row.values : {},
        memberCount: 1,
        sourceGeoids: [cleanText(row?.geoid)],
      }));

  return rows.filter((row) => {
    if (!row?.geoid) return false;
    if (cfg.onlyRaceFootprint && !matchRaceFootprintFilter(row, state)) return false;
    return true;
  });
}

export function runTargetRanking({ state, censusState, rowsByGeoid } = {}){
  const cfg = normalizeTargetingState(state?.targeting);
  const census = censusState && typeof censusState === "object"
    ? censusState
    : (state?.census && typeof state.census === "object" ? state.census : {});
  const mapRows = rowsByGeoid && typeof rowsByGeoid === "object" ? rowsByGeoid : (census.rowsByGeoid || {});
  const candidateRows = runRowsForContext(mapRows, census, cfg, state);

  const extracted = [];
  for (const row of candidateRows){
    const signal = deriveTargetSignalsForRow(row, state, cfg);
    if (cfg.excludeZeroHousing && signal.housingUnits <= 0) continue;
    if (signal.housingUnits < cfg.minHousingUnits) continue;
    if (signal.population < cfg.minPopulation) continue;
    if (!keepByDensityFloor(signal, cfg.criteria.densityFloor)) continue;
    if (cfg.criteria.avoidHighMultiUnit && signal.multiUnitShare >= 0.70) continue;
    extracted.push({
      ...row,
      rawSignals: signal,
    });
  }

  const scored = scoreTargetRows({
    rows: extracted,
    modelId: cfg.modelId,
    state,
    config: cfg,
    priorityModelIds: TARGET_PRIORITY_MODEL_IDS,
  });

  scored.sort((a, b) => b.score - a.score);
  const topN = floorTargetingInt(cfg.topN, { min: 1, fallback: 1 });
  const ranked = scored.map((row, index) => ({
    ...row,
    rank: index + 1,
    isTopTarget: index < topN,
  }));
  const corePriorityN = 10;
  const rankByModel = {};
  for (const modelId of TARGET_PRIORITY_MODEL_IDS){
    const sorted = ranked.slice().sort((a, b) => {
      const aScore = Number(a?.scoreByModel?.[modelId]);
      const bScore = Number(b?.scoreByModel?.[modelId]);
      const aa = Number.isFinite(aScore) ? aScore : -Infinity;
      const bb = Number.isFinite(bScore) ? bScore : -Infinity;
      return bb - aa;
    });
    const map = new Map();
    for (let i = 0; i < sorted.length; i += 1){
      map.set(sorted[i].geoid, i + 1);
    }
    rankByModel[modelId] = map;
  }
  for (const row of ranked){
    const turnoutRank = rankByModel.turnout_opportunity?.get(row.geoid) ?? null;
    const persuasionRank = rankByModel.persuasion_first?.get(row.geoid) ?? null;
    const efficiencyRank = rankByModel.field_efficiency?.get(row.geoid) ?? null;
    row.modelRanks = {
      turnout_opportunity: turnoutRank,
      persuasion_first: persuasionRank,
      field_efficiency: efficiencyRank,
    };
    row.isTurnoutPriority = Number.isFinite(Number(turnoutRank)) && Number(turnoutRank) <= corePriorityN;
    row.isPersuasionPriority = Number.isFinite(Number(persuasionRank)) && Number(persuasionRank) <= corePriorityN;
    row.isEfficiencyPriority = Number.isFinite(Number(efficiencyRank)) && Number(efficiencyRank) <= corePriorityN;
  }

  const model = listTargetModels().find((row) => row.id === cfg.modelId) || listTargetModels()[0] || { id: cfg.modelId, label: cfg.modelId };
  const preset = getTargetModelPreset(cfg.presetId || cfg.modelId);
  const meta = {
    presetId: cleanText(preset?.id) || cleanText(cfg.presetId) || cleanText(cfg.modelId),
    presetLabel: cleanText(preset?.label) || cleanText(cfg.presetId) || cleanText(cfg.modelId),
    modelId: model.id,
    modelLabel: model.label,
    geoLevel: cfg.geoLevel,
    totalRows: ranked.length,
    topN,
    contextKey: computeTargetingContextKey({ state, censusState: census, config: cfg }),
    selectedGeoCount: Array.isArray(census.selectedGeoids) ? census.selectedGeoids.length : 0,
    ranAt: new Date().toISOString(),
  };

  return {
    rows: ranked,
    meta,
    config: cfg,
  };
}

function csvEscape(value){
  const text = String(value == null ? "" : value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function buildTargetRankingCsv(rows){
  const list = Array.isArray(rows) ? rows : [];
  const fixed = (value, digits) => formatFixedNumber(value, digits, "");
  const headers = [
    "rank",
    "geoid",
    "label",
    "target_label",
    "score",
    "base_score",
    "target_score",
    "expected_net_vote_value",
    "uplift_expected_marginal_gain",
    "uplift_best_channel",
    "votes_per_organizer_hour",
    "vote_potential",
    "turnout_opportunity",
    "persuasion_index",
    "field_efficiency",
    "housing_units",
    "population",
    "ba_plus_share",
    "age_18_34_share",
    "poverty_share",
    "renter_share",
    "multi_unit_share",
    "long_commute_share",
    "super_commute_share",
    "no_internet_share",
    "citizen_share",
    "availability_modifier",
    "density_band",
    "contact_modifier",
    "turnout_rank",
    "persuasion_rank",
    "efficiency_rank",
    "is_top_target",
    "is_turnout_priority",
    "is_persuasion_priority",
    "is_efficiency_priority",
    "reasons",
    "flags",
  ];
  const out = [headers.join(",")];
  for (const row of list){
    const values = [
      row.rank,
      row.geoid,
      row.label,
      cleanText(row.targetLabel),
      fixed(row.score, 3),
      fixed(row.baseScore, 3),
      fixed(row.targetScore, 3),
      fixed(row.expectedNetVoteValue, 3),
      fixed(row.upliftExpectedMarginalGain, 4),
      cleanText(row.upliftBestChannel),
      fixed(row.votesPerOrganizerHour, 3),
      fixed(row.componentScores?.votePotential, 4),
      fixed(row.componentScores?.turnoutOpportunity, 4),
      fixed(row.componentScores?.persuasionIndex, 4),
      fixed(row.componentScores?.fieldEfficiency, 4),
      fixed(row.rawSignals?.housingUnits, 0),
      fixed(row.rawSignals?.population, 0),
      fixed(row.rawSignals?.baPlusShare, 4),
      fixed(row.rawSignals?.age18to34Share, 4),
      fixed(row.rawSignals?.povertyShare, 4),
      fixed(row.rawSignals?.renterShare, 4),
      fixed(row.rawSignals?.multiUnitShare, 4),
      fixed(row.rawSignals?.longCommuteShare, 4),
      fixed(row.rawSignals?.superCommuteShare, 4),
      fixed(row.rawSignals?.noInternetShare, 4),
      fixed(row.rawSignals?.citizenShare, 4),
      fixed(row.rawSignals?.availabilityModifier, 4),
      cleanText(row.rawSignals?.densityBand?.label || row.rawSignals?.densityBand?.id),
      fixed(row.rawSignals?.contactRateModifier, 4),
      fixed(row.modelRanks?.turnout_opportunity, 0),
      fixed(row.modelRanks?.persuasion_first, 0),
      fixed(row.modelRanks?.field_efficiency, 0),
      row.isTopTarget ? "1" : "0",
      row.isTurnoutPriority ? "1" : "0",
      row.isPersuasionPriority ? "1" : "0",
      row.isEfficiencyPriority ? "1" : "0",
      Array.isArray(row.reasons) ? row.reasons.join(" | ") : "",
      Array.isArray(row.flags) ? row.flags.join(" | ") : "",
    ];
    out.push(values.map(csvEscape).join(","));
  }
  return out.join("\n");
}

export function buildTargetRankingPayload({ rows, meta, config } = {}){
  return {
    exportedAt: new Date().toISOString(),
    meta: normalizeMeta(meta),
    config: normalizeTargetingState(config || {}),
    rows: normalizeRows(rows),
  };
}
