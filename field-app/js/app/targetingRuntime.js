// @ts-check
import {
  deriveTargetSignalsForRow,
  listTargetModels,
  scoreTargetRow,
} from "../core/targetModels.js";

const TARGET_GEO_LEVELS = Object.freeze([
  { id: "block_group", label: "Block group" },
  { id: "tract", label: "Tract" },
]);

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

function safeNum(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max){
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function normalizeWeights(input){
  const src = input && typeof input === "object" ? input : {};
  const out = {
    votePotential: Number.isFinite(Number(src.votePotential)) ? Math.max(0, Number(src.votePotential)) : 0.35,
    turnoutOpportunity: Number.isFinite(Number(src.turnoutOpportunity)) ? Math.max(0, Number(src.turnoutOpportunity)) : 0.25,
    persuasionIndex: Number.isFinite(Number(src.persuasionIndex)) ? Math.max(0, Number(src.persuasionIndex)) : 0.20,
    fieldEfficiency: Number.isFinite(Number(src.fieldEfficiency)) ? Math.max(0, Number(src.fieldEfficiency)) : 0.20,
  };
  const total = out.votePotential + out.turnoutOpportunity + out.persuasionIndex + out.fieldEfficiency;
  if (total <= 0){
    return { votePotential: 0.35, turnoutOpportunity: 0.25, persuasionIndex: 0.20, fieldEfficiency: 0.20 };
  }
  out.votePotential /= total;
  out.turnoutOpportunity /= total;
  out.persuasionIndex /= total;
  out.fieldEfficiency /= total;
  return out;
}

function normalizeRows(input){
  const rows = Array.isArray(input) ? input : [];
  return rows.map((row) => {
    const reasons = Array.isArray(row?.reasons) ? row.reasons.map((value) => cleanText(value)).filter((value) => !!value) : [];
    const flags = Array.isArray(row?.flags) ? row.flags.map((value) => cleanText(value)).filter((value) => !!value) : [];
    const scoreByModelSrc = row?.scoreByModel && typeof row.scoreByModel === "object" ? row.scoreByModel : {};
    const modelRanksSrc = row?.modelRanks && typeof row.modelRanks === "object" ? row.modelRanks : {};
    return {
      rank: Number.isFinite(Number(row?.rank)) ? Math.max(1, Math.floor(Number(row.rank))) : 0,
      geoid: cleanText(row?.geoid),
      label: cleanText(row?.label),
      memberCount: Number.isFinite(Number(row?.memberCount)) ? Math.max(1, Math.floor(Number(row.memberCount))) : 1,
      score: Number.isFinite(Number(row?.score)) ? Number(row.score) : 0,
      isTopTarget: !!row?.isTopTarget,
      targetLabel: cleanText(row?.targetLabel),
      reasonText: cleanText(row?.reasonText),
      flagText: cleanText(row?.flagText),
      reasons,
      flags,
      rawSignals: row?.rawSignals && typeof row.rawSignals === "object" ? { ...row.rawSignals } : {},
      componentScores: row?.componentScores && typeof row.componentScores === "object" ? { ...row.componentScores } : {},
      scoreByModel: {
        turnout_opportunity: Number.isFinite(Number(scoreByModelSrc.turnout_opportunity)) ? Number(scoreByModelSrc.turnout_opportunity) : null,
        persuasion_first: Number.isFinite(Number(scoreByModelSrc.persuasion_first)) ? Number(scoreByModelSrc.persuasion_first) : null,
        field_efficiency: Number.isFinite(Number(scoreByModelSrc.field_efficiency)) ? Number(scoreByModelSrc.field_efficiency) : null,
      },
      modelRanks: {
        turnout_opportunity: Number.isFinite(Number(modelRanksSrc.turnout_opportunity)) ? Math.max(1, Math.floor(Number(modelRanksSrc.turnout_opportunity))) : null,
        persuasion_first: Number.isFinite(Number(modelRanksSrc.persuasion_first)) ? Math.max(1, Math.floor(Number(modelRanksSrc.persuasion_first))) : null,
        field_efficiency: Number.isFinite(Number(modelRanksSrc.field_efficiency)) ? Math.max(1, Math.floor(Number(modelRanksSrc.field_efficiency))) : null,
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
    totalRows: Number.isFinite(Number(src.totalRows)) ? Math.max(0, Math.floor(Number(src.totalRows))) : 0,
    topN: Number.isFinite(Number(src.topN)) ? Math.max(1, Math.floor(Number(src.topN))) : 25,
    contextKey: cleanText(src.contextKey),
    ranAt: cleanText(src.ranAt),
    selectedGeoCount: Number.isFinite(Number(src.selectedGeoCount)) ? Math.max(0, Math.floor(Number(src.selectedGeoCount))) : 0,
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
    weights: normalizeWeights(src.weights),
    criteria: normalizeCriteria(src.criteria),
  };
}

export function getTargetModelPreset(modelId){
  const id = cleanText(modelId);
  const key = Object.prototype.hasOwnProperty.call(TARGET_MODEL_PRESETS, id) ? id : "turnout_opportunity";
  return normalizeTargetModelPreset(key, TARGET_MODEL_PRESETS[key]);
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
  const presetWeights = normalizeWeights(preset?.weights);
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
    weights: hasWeights ? normalizeWeights(src.weights) : presetWeights,
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
  const topN = Number.isFinite(Number(config?.topN)) ? Math.max(1, Math.floor(Number(config.topN))) : 25;
  const minHousingUnits = Number.isFinite(Number(config?.minHousingUnits)) ? Math.max(0, Math.floor(Number(config.minHousingUnits))) : 0;
  const minPopulation = Number.isFinite(Number(config?.minPopulation)) ? Math.max(0, Math.floor(Number(config.minPopulation))) : 0;
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
  const weightKey = [
    Number.isFinite(Number(weights.votePotential)) ? Number(weights.votePotential).toFixed(6) : "",
    Number.isFinite(Number(weights.turnoutOpportunity)) ? Number(weights.turnoutOpportunity).toFixed(6) : "",
    Number.isFinite(Number(weights.persuasionIndex)) ? Number(weights.persuasionIndex).toFixed(6) : "",
    Number.isFinite(Number(weights.fieldEfficiency)) ? Number(weights.fieldEfficiency).toFixed(6) : "",
  ].join("/");
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

function minMaxNormalize(values, fallback = 0){
  const nums = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!nums.length){
    return values.map(() => fallback);
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min){
    return values.map(() => 0.5);
  }
  const span = max - min;
  return values.map((value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp((n - min) / span, 0, 1);
  });
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

  const voteNorm = minMaxNormalize(extracted.map((row) => row.rawSignals.votePotentialRaw), 0);
  const turnoutNorm = minMaxNormalize(extracted.map((row) => row.rawSignals.turnoutOpportunityRaw), 0);
  const persuasionNorm = minMaxNormalize(extracted.map((row) => row.rawSignals.persuasionIndexRaw), 0);
  const fieldNorm = minMaxNormalize(extracted.map((row) => row.rawSignals.fieldEfficiencyRaw), 0);
  const coreModelIds = ["turnout_opportunity", "persuasion_first", "field_efficiency"];

  const scored = extracted.map((row, idx) => {
    const components = {
      votePotential: voteNorm[idx],
      turnoutOpportunity: turnoutNorm[idx],
      persuasionIndex: persuasionNorm[idx],
      fieldEfficiency: fieldNorm[idx],
    };
    const selected = scoreTargetRow({
      modelId: cfg.modelId,
      components,
      rawSignals: row.rawSignals,
      config: cfg,
    });
    const scoreByModel = {};
    for (const modelId of coreModelIds){
      const byModel = scoreTargetRow({
        modelId,
        components,
        rawSignals: row.rawSignals,
        config: cfg,
      });
      scoreByModel[modelId] = byModel.score;
    }
    return {
      geoid: row.geoid,
      label: row.label || row.geoid,
      memberCount: Number.isFinite(Number(row.memberCount)) ? Number(row.memberCount) : 1,
      sourceGeoids: Array.isArray(row.sourceGeoids) ? row.sourceGeoids.slice() : [row.geoid],
      score: selected.score,
      componentScores: selected.componentScores,
      reasons: selected.reasons,
      flags: selected.flags,
      targetLabel: cleanText(selected.targetLabel),
      reasonText: selected.reasons.join(" "),
      flagText: selected.flags.join(" "),
      rawSignals: row.rawSignals,
      scoreByModel,
      modelRanks: {
        turnout_opportunity: null,
        persuasion_first: null,
        field_efficiency: null,
      },
      isTurnoutPriority: false,
      isPersuasionPriority: false,
      isEfficiencyPriority: false,
      votesPerOrganizerHour: Number.isFinite(Number(row.rawSignals?.votesPerOrganizerHour))
        ? Number(row.rawSignals.votesPerOrganizerHour)
        : null,
    };
  }).filter((row) => row.score >= cfg.minScore);

  scored.sort((a, b) => b.score - a.score);
  const topN = Math.max(1, Math.floor(cfg.topN));
  const ranked = scored.map((row, index) => ({
    ...row,
    rank: index + 1,
    isTopTarget: index < topN,
  }));
  const corePriorityN = 10;
  const rankByModel = {};
  for (const modelId of coreModelIds){
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
  const headers = [
    "rank",
    "geoid",
    "label",
    "target_label",
    "score",
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
      Number.isFinite(Number(row.score)) ? Number(row.score).toFixed(3) : "",
      Number.isFinite(Number(row.votesPerOrganizerHour)) ? Number(row.votesPerOrganizerHour).toFixed(3) : "",
      Number.isFinite(Number(row.componentScores?.votePotential)) ? Number(row.componentScores.votePotential).toFixed(4) : "",
      Number.isFinite(Number(row.componentScores?.turnoutOpportunity)) ? Number(row.componentScores.turnoutOpportunity).toFixed(4) : "",
      Number.isFinite(Number(row.componentScores?.persuasionIndex)) ? Number(row.componentScores.persuasionIndex).toFixed(4) : "",
      Number.isFinite(Number(row.componentScores?.fieldEfficiency)) ? Number(row.componentScores.fieldEfficiency).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.housingUnits)) ? Number(row.rawSignals.housingUnits).toFixed(0) : "",
      Number.isFinite(Number(row.rawSignals?.population)) ? Number(row.rawSignals.population).toFixed(0) : "",
      Number.isFinite(Number(row.rawSignals?.baPlusShare)) ? Number(row.rawSignals.baPlusShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.age18to34Share)) ? Number(row.rawSignals.age18to34Share).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.povertyShare)) ? Number(row.rawSignals.povertyShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.renterShare)) ? Number(row.rawSignals.renterShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.multiUnitShare)) ? Number(row.rawSignals.multiUnitShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.longCommuteShare)) ? Number(row.rawSignals.longCommuteShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.superCommuteShare)) ? Number(row.rawSignals.superCommuteShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.noInternetShare)) ? Number(row.rawSignals.noInternetShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.citizenShare)) ? Number(row.rawSignals.citizenShare).toFixed(4) : "",
      Number.isFinite(Number(row.rawSignals?.availabilityModifier)) ? Number(row.rawSignals.availabilityModifier).toFixed(4) : "",
      cleanText(row.rawSignals?.densityBand?.label || row.rawSignals?.densityBand?.id),
      Number.isFinite(Number(row.rawSignals?.contactRateModifier)) ? Number(row.rawSignals.contactRateModifier).toFixed(4) : "",
      Number.isFinite(Number(row.modelRanks?.turnout_opportunity)) ? Number(row.modelRanks.turnout_opportunity).toFixed(0) : "",
      Number.isFinite(Number(row.modelRanks?.persuasion_first)) ? Number(row.modelRanks.persuasion_first).toFixed(0) : "",
      Number.isFinite(Number(row.modelRanks?.field_efficiency)) ? Number(row.modelRanks.field_efficiency).toFixed(0) : "",
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
