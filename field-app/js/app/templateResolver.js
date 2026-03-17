// @ts-check
import {
  DEFAULT_TEMPLATE_ID,
  LEGACY_RACE_TYPE_TO_TEMPLATE_ID,
  TEMPLATE_DEFAULT_FIELD_KEYS,
  TEMPLATE_DIMENSION_KEYS,
  TEMPLATE_REGISTRY,
  TEMPLATE_REGISTRY_VERSION,
} from "./templateRegistry.js";

const EPSILON = 1e-6;

function cleanString(value){
  return String(value == null ? "" : value).trim();
}

function toFiniteNumber(value){
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function approxEq(a, b, eps = EPSILON){
  return Math.abs(a - b) <= eps;
}

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isBlank(value){
  return value == null || (typeof value === "string" && cleanString(value) === "");
}

function cloneTemplateValue(value){
  if (Array.isArray(value)) return value.slice();
  if (isObject(value)){
    try{
      return structuredClone(value);
    } catch {
      try{
        return JSON.parse(JSON.stringify(value));
      } catch {
        return { ...value };
      }
    }
  }
  return value;
}

function valuesEquivalent(a, b){
  if (a === b) return true;
  const na = toFiniteNumber(a);
  const nb = toFiniteNumber(b);
  if (na != null && nb != null) return approxEq(na, nb);
  if (isBlank(a) && isBlank(b)) return true;
  return cleanString(a) === cleanString(b);
}

function dimensionMatch(a, b){
  for (const key of TEMPLATE_DIMENSION_KEYS){
    if (cleanString(a?.[key]) !== cleanString(b?.[key])) return false;
  }
  return true;
}

export function normalizeLegacyRaceType(value){
  const key = cleanString(value).toLowerCase();
  if (key === "federal" || key === "state_leg" || key === "municipal" || key === "county"){
    return key;
  }
  return "state_leg";
}

export function getTemplateRecord(templateId){
  const id = cleanString(templateId);
  if (id && TEMPLATE_REGISTRY[id]) return TEMPLATE_REGISTRY[id];
  return TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID];
}

export function templateIdForRaceType(raceType){
  const race = normalizeLegacyRaceType(raceType);
  return LEGACY_RACE_TYPE_TO_TEMPLATE_ID[race] || DEFAULT_TEMPLATE_ID;
}

export function normalizeTemplateDimensions(input = {}, fallbackRaceType = "state_leg"){
  const race = normalizeLegacyRaceType(input?.raceType || fallbackRaceType);
  const fallbackTemplate = getTemplateRecord(templateIdForRaceType(race));
  const out = {};
  for (const key of TEMPLATE_DIMENSION_KEYS){
    const value = cleanString(input?.[key]);
    out[key] = value || cleanString(fallbackTemplate?.dimensions?.[key]);
  }
  return out;
}

export function resolveTemplateId(input = {}){
  const explicitId = cleanString(input?.templateId);
  if (explicitId && TEMPLATE_REGISTRY[explicitId]) return explicitId;

  const fallbackRaceType = normalizeLegacyRaceType(input?.raceType);
  const dims = normalizeTemplateDimensions(input, fallbackRaceType);
  for (const record of Object.values(TEMPLATE_REGISTRY)){
    if (dimensionMatch(dims, record?.dimensions || {})) return record.id;
  }
  return templateIdForRaceType(fallbackRaceType);
}

export function resolveTemplateRecord(input = {}){
  const src = isObject(input) ? input : {};
  const meta = isObject(src.templateMeta) ? src.templateMeta : {};
  const raceType = normalizeLegacyRaceType(src.raceType || meta.legacyRaceType || "state_leg");
  const resolvedId = resolveTemplateId({
    templateId: src.templateId || meta.appliedTemplateId,
    raceType,
    officeLevel: src.officeLevel || meta.officeLevel,
    electionType: src.electionType || meta.electionType,
    seatContext: src.seatContext || meta.seatContext,
    partisanshipMode: src.partisanshipMode || meta.partisanshipMode,
    salienceLevel: src.salienceLevel || meta.salienceLevel,
  });
  const template = getTemplateRecord(resolvedId);
  return {
    id: template.id,
    template,
    legacyRaceType: normalizeLegacyRaceType(template?.legacyRaceType || raceType),
    dimensions: { ...(template?.dimensions || {}) },
  };
}

export function makeDefaultTemplateMeta(input = {}){
  const resolved = resolveTemplateRecord(input);
  return {
    officeLevel: resolved.dimensions.officeLevel,
    electionType: resolved.dimensions.electionType,
    seatContext: resolved.dimensions.seatContext,
    partisanshipMode: resolved.dimensions.partisanshipMode,
    salienceLevel: resolved.dimensions.salienceLevel,
    appliedTemplateId: resolved.id,
    appliedVersion: cleanString(resolved.template?.version) || TEMPLATE_REGISTRY_VERSION,
    overriddenFields: [],
  };
}

export function normalizeTemplateMeta(metaInput, { raceType = "state_leg", templateId = "" } = {}){
  const meta = isObject(metaInput) ? metaInput : {};
  const resolved = resolveTemplateRecord({
    templateId: cleanString(templateId) || cleanString(meta.appliedTemplateId),
    raceType: raceType || meta.legacyRaceType || "state_leg",
    officeLevel: meta.officeLevel,
    electionType: meta.electionType,
    seatContext: meta.seatContext,
    partisanshipMode: meta.partisanshipMode,
    salienceLevel: meta.salienceLevel,
  });

  const allowedFieldSet = new Set(TEMPLATE_DEFAULT_FIELD_KEYS);
  const overrides = Array.isArray(meta.overriddenFields)
    ? meta.overriddenFields.map((field) => cleanString(field)).filter((field) => allowedFieldSet.has(field))
    : [];

  return {
    officeLevel: cleanString(meta.officeLevel) || resolved.dimensions.officeLevel,
    electionType: cleanString(meta.electionType) || resolved.dimensions.electionType,
    seatContext: cleanString(meta.seatContext) || resolved.dimensions.seatContext,
    partisanshipMode: cleanString(meta.partisanshipMode) || resolved.dimensions.partisanshipMode,
    salienceLevel: cleanString(meta.salienceLevel) || resolved.dimensions.salienceLevel,
    appliedTemplateId: cleanString(meta.appliedTemplateId) || resolved.id,
    appliedVersion: cleanString(meta.appliedVersion) || cleanString(resolved.template?.version) || TEMPLATE_REGISTRY_VERSION,
    overriddenFields: overrides,
  };
}

export function listOverriddenTemplateFields(stateLike, templateInput = null){
  const state = isObject(stateLike) ? stateLike : {};
  const template = templateInput
    ? (isObject(templateInput) && templateInput.defaults ? templateInput : getTemplateRecord(templateInput))
    : resolveTemplateRecord(state).template;
  const defaults = template?.defaults || {};

  const overridden = [];
  for (const field of TEMPLATE_DEFAULT_FIELD_KEYS){
    if (!Object.prototype.hasOwnProperty.call(defaults, field)) continue;
    const expected = defaults[field];
    const current = state[field];
    if (!valuesEquivalent(current, expected)){
      overridden.push(field);
    }
  }
  return overridden;
}

export function syncTemplateMetaFromState(stateLike, options = {}){
  if (!isObject(stateLike)) return null;
  const resolved = resolveTemplateRecord({
    ...stateLike,
    raceType: options?.raceType || stateLike.raceType,
    templateId: options?.templateId || stateLike?.templateMeta?.appliedTemplateId,
  });
  const normalized = normalizeTemplateMeta(stateLike.templateMeta, {
    raceType: resolved.legacyRaceType,
    templateId: resolved.id,
  });
  const overridden = listOverriddenTemplateFields(stateLike, resolved.template);

  stateLike.raceType = resolved.legacyRaceType;
  stateLike.templateMeta = {
    ...normalized,
    officeLevel: resolved.dimensions.officeLevel,
    electionType: resolved.dimensions.electionType,
    seatContext: resolved.dimensions.seatContext,
    partisanshipMode: resolved.dimensions.partisanshipMode,
    salienceLevel: resolved.dimensions.salienceLevel,
    appliedTemplateId: resolved.id,
    appliedVersion: cleanString(resolved.template?.version) || normalized.appliedVersion || TEMPLATE_REGISTRY_VERSION,
    overriddenFields: overridden,
  };
  return stateLike.templateMeta;
}

export function normalizeTemplateApplyMode(mode, { force = false } = {}){
  if (force) return "all";
  const key = cleanString(mode).toLowerCase();
  if (key === "all" || key === "empty" || key === "untouched") return key;
  return "untouched";
}

export function applyTemplateDefaultsToState(stateLike, options = {}){
  if (!isObject(stateLike)){
    return { ok: false, code: "invalid_state", templateId: DEFAULT_TEMPLATE_ID, mode: "untouched", updatedFields: [], skippedFields: [] };
  }

  const currentResolved = resolveTemplateRecord(stateLike);
  const currentOverrides = new Set(listOverriddenTemplateFields(stateLike, currentResolved.template));
  const hasRaceOverride = cleanString(options?.raceType) !== "";
  const hasDimensionOverride = TEMPLATE_DIMENSION_KEYS.some((key) => cleanString(options?.[key]) !== "");
  const applyMode = normalizeTemplateApplyMode(options?.mode, { force: !!options?.force });

  const nextResolved = resolveTemplateRecord({
    raceType: hasRaceOverride ? options.raceType : currentResolved.legacyRaceType,
    templateId: cleanString(options?.templateId) || ((hasRaceOverride || hasDimensionOverride) ? "" : currentResolved.id),
    officeLevel: options?.officeLevel,
    electionType: options?.electionType,
    seatContext: options?.seatContext,
    partisanshipMode: options?.partisanshipMode,
    salienceLevel: options?.salienceLevel,
  });

  const defaults = nextResolved.template?.defaults || {};
  const updatedFields = [];
  const skippedFields = [];
  for (const field of TEMPLATE_DEFAULT_FIELD_KEYS){
    if (!Object.prototype.hasOwnProperty.call(defaults, field)) continue;
    const current = stateLike[field];
    let shouldApply = false;
    if (applyMode === "all"){
      shouldApply = true;
    } else if (applyMode === "empty"){
      shouldApply = isBlank(current);
    } else {
      shouldApply = isBlank(current) || !currentOverrides.has(field);
    }

    if (shouldApply){
      stateLike[field] = cloneTemplateValue(defaults[field]);
      updatedFields.push(field);
    } else {
      skippedFields.push(field);
    }
  }

  stateLike.raceType = nextResolved.legacyRaceType;
  const overridden = listOverriddenTemplateFields(stateLike, nextResolved.template);
  stateLike.templateMeta = {
    officeLevel: nextResolved.dimensions.officeLevel,
    electionType: nextResolved.dimensions.electionType,
    seatContext: nextResolved.dimensions.seatContext,
    partisanshipMode: nextResolved.dimensions.partisanshipMode,
    salienceLevel: nextResolved.dimensions.salienceLevel,
    appliedTemplateId: nextResolved.id,
    appliedVersion: cleanString(nextResolved.template?.version) || TEMPLATE_REGISTRY_VERSION,
    overriddenFields: overridden,
  };

  return {
    ok: true,
    templateId: nextResolved.id,
    mode: applyMode,
    updatedFields,
    skippedFields,
  };
}

export function deriveAssumptionsProfileFromState(stateLike){
  const state = isObject(stateLike) ? stateLike : {};
  const resolved = resolveTemplateRecord(state);
  const overridden = listOverriddenTemplateFields(state, resolved.template);
  const explicit = cleanString(state?.ui?.assumptionsProfile);
  if (explicit === "template" || explicit === "custom"){
    if (explicit === "template" && overridden.length > 0) return "custom";
    return explicit;
  }
  return overridden.length === 0 ? "template" : "custom";
}

export function getTemplateLabelForTemplateId(templateId, { detailed = false } = {}){
  const template = getTemplateRecord(templateId);
  if (detailed) return cleanString(template?.label) || cleanString(template?.legacyLabel) || "Template";
  return cleanString(template?.legacyLabel) || cleanString(template?.label) || "Template";
}

export function getTemplateLabelForRaceType(raceType, { detailed = false } = {}){
  const templateId = templateIdForRaceType(raceType);
  return getTemplateLabelForTemplateId(templateId, { detailed });
}

export function getTemplateLabelForState(stateLike, { detailed = false } = {}){
  const resolved = resolveTemplateRecord(stateLike);
  return getTemplateLabelForTemplateId(resolved.id, { detailed });
}
