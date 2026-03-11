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
      votesPerOrganizerHour: Number.isFinite(Number(row?.votesPerOrganizerHour)) ? Number(row.votesPerOrganizerHour) : null,
    };
  }).filter((row) => !!row.geoid);
}

function normalizeMeta(input){
  const src = input && typeof input === "object" ? input : {};
  return {
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

export function makeDefaultTargetingState(){
  return {
    enabled: true,
    geoLevel: "block_group",
    modelId: "turnout_opportunity",
    topN: 25,
    minHousingUnits: 25,
    minPopulation: 0,
    minScore: 0,
    excludeZeroHousing: true,
    onlyRaceFootprint: true,
    weights: {
      votePotential: 0.35,
      turnoutOpportunity: 0.25,
      persuasionIndex: 0.20,
      fieldEfficiency: 0.20,
    },
    criteria: {
      prioritizeYoung: true,
      prioritizeRenters: false,
      avoidHighMultiUnit: false,
      densityFloor: "none",
    },
    lastRun: "",
    lastRows: [],
    lastMeta: null,
  };
}

export function normalizeTargetingState(input){
  const base = makeDefaultTargetingState();
  const src = input && typeof input === "object" ? input : {};
  const modelIds = new Set(listTargetModels().map((row) => row.id));
  const geoLevelRaw = cleanText(src.geoLevel);
  const geoLevel = TARGET_GEO_LEVELS.some((row) => row.id === geoLevelRaw) ? geoLevelRaw : base.geoLevel;
  const modelIdRaw = cleanText(src.modelId);
  const modelId = modelIds.has(modelIdRaw) ? modelIdRaw : base.modelId;
  return {
    ...base,
    ...src,
    enabled: src.enabled == null ? base.enabled : !!src.enabled,
    geoLevel,
    modelId,
    topN: Number.isFinite(Number(src.topN)) ? clamp(Number(src.topN), 1, 500) : base.topN,
    minHousingUnits: Number.isFinite(Number(src.minHousingUnits)) ? Math.max(0, Number(src.minHousingUnits)) : base.minHousingUnits,
    minPopulation: Number.isFinite(Number(src.minPopulation)) ? Math.max(0, Number(src.minPopulation)) : base.minPopulation,
    minScore: Number.isFinite(Number(src.minScore)) ? Math.max(0, Number(src.minScore)) : base.minScore,
    excludeZeroHousing: src.excludeZeroHousing == null ? base.excludeZeroHousing : !!src.excludeZeroHousing,
    onlyRaceFootprint: src.onlyRaceFootprint == null ? base.onlyRaceFootprint : !!src.onlyRaceFootprint,
    weights: normalizeWeights(src.weights),
    criteria: normalizeCriteria(src.criteria),
    lastRun: cleanText(src.lastRun),
    lastRows: normalizeRows(src.lastRows),
    lastMeta: src.lastMeta ? normalizeMeta(src.lastMeta) : null,
  };
}

export function listTargetGeoLevels(){
  return TARGET_GEO_LEVELS.map((row) => ({ ...row }));
}

export function listTargetModelOptions(){
  return listTargetModels();
}

export function computeTargetingContextKey({ state, censusState, config } = {}){
  const modelIds = new Set(listTargetModels().map((row) => row.id));
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

  const scored = extracted.map((row, idx) => {
    const components = {
      votePotential: voteNorm[idx],
      turnoutOpportunity: turnoutNorm[idx],
      persuasionIndex: persuasionNorm[idx],
      fieldEfficiency: fieldNorm[idx],
    };
    const score = scoreTargetRow({
      modelId: cfg.modelId,
      components,
      rawSignals: row.rawSignals,
      config: cfg,
    });
    return {
      geoid: row.geoid,
      label: row.label || row.geoid,
      memberCount: Number.isFinite(Number(row.memberCount)) ? Number(row.memberCount) : 1,
      sourceGeoids: Array.isArray(row.sourceGeoids) ? row.sourceGeoids.slice() : [row.geoid],
      score: score.score,
      componentScores: score.componentScores,
      reasons: score.reasons,
      flags: score.flags,
      targetLabel: cleanText(score.targetLabel),
      reasonText: score.reasons.join(" "),
      flagText: score.flags.join(" "),
      rawSignals: row.rawSignals,
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

  const model = listTargetModels().find((row) => row.id === cfg.modelId) || listTargetModels()[0] || { id: cfg.modelId, label: cfg.modelId };
  const meta = {
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
