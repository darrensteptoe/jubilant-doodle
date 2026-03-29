// @ts-check
import {
  DEFAULT_TEMPLATE_ID,
  LEGACY_RACE_TYPE_TO_TEMPLATE_ID,
  TEMPLATE_DEFAULT_FIELD_KEYS,
  TEMPLATE_DIMENSION_KEYS,
  TEMPLATE_REGISTRY,
  TEMPLATE_REGISTRY_VERSION,
} from "./templateRegistry.js";
import { safeNum } from "../core/utils.js";

const EPSILON = 1e-6;
const LEGACY_RACE_TYPES = new Set(["federal", "state_leg", "municipal", "county"]);
const LEGACY_TEMPLATE_ID_ALIASES = Object.freeze({
  federal_general_incumbent: "congressional_district",
  state_house_general_open: "state_house",
  mayoral_nonpartisan: "municipal_legislative",
  county_general_open: "countywide",
  special_low_turnout: "state_house",
});

function cleanString(value){
  return String(value == null ? "" : value).trim();
}

function normalizeOfficeLevelToken(value){
  const token = cleanString(value).toLowerCase();
  if (!token) return "";
  if (token === "custom") return "custom_context";
  return token;
}

const toFiniteNumber = safeNum;

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

function knownTemplateId(value){
  const id = cleanString(value);
  if (!id) return "";
  if (TEMPLATE_REGISTRY[id]) return id;
  const canonicalId = cleanString(LEGACY_TEMPLATE_ID_ALIASES[id]);
  return canonicalId && TEMPLATE_REGISTRY[canonicalId] ? canonicalId : "";
}

function inferLegacyRaceType(value){
  const key = cleanString(value).toLowerCase();
  if (!key) return "";
  if (LEGACY_RACE_TYPES.has(key)) return key;

  const template = TEMPLATE_REGISTRY[key];
  if (template?.legacyRaceType && LEGACY_RACE_TYPES.has(template.legacyRaceType)){
    return template.legacyRaceType;
  }

  if (
    key === "federal"
    || key === "us_house"
    || key === "congressional"
    || key === "congressional_district"
    || key === "statewide_federal"
    || key === "statewide_executive"
    || key === "us_senate"
  ) return "federal";

  if (
    key === "state_leg"
    || key === "state_legislative"
    || key === "state_house"
    || key === "state_senate"
    || key === "state_legislative_lower"
    || key === "state_legislative_upper"
  ) return "state_leg";

  if (
    key === "municipal"
    || key === "city"
    || key === "local"
    || key === "ward"
    || key === "municipal_executive"
    || key === "municipal_legislative"
  ) return "municipal";

  if (
    key === "county"
    || key === "countywide"
    || key === "judicial_other"
  ) return "county";

  return "";
}

function resolveTemplateIdFromLegacyRaceType(legacyRaceType, context = {}){
  const raceType = inferLegacyRaceType(legacyRaceType) || normalizeLegacyRaceType(legacyRaceType);
  const officeLevel = normalizeOfficeLevelToken(context?.officeLevel);
  const seatContext = cleanString(context?.seatContext).toLowerCase();

  if (officeLevel === "custom_context") return "custom_context";

  if (raceType === "federal"){
    if (officeLevel === "statewide_federal" || seatContext.includes("senate")){
      return "statewide_federal";
    }
    if (officeLevel === "statewide_executive" || seatContext.includes("governor") || seatContext.includes("executive")){
      return "statewide_executive";
    }
    return "congressional_district";
  }

  if (raceType === "state_leg"){
    if (officeLevel === "state_legislative_upper" || seatContext.includes("senate")){
      return "state_senate";
    }
    return "state_house";
  }

  if (raceType === "municipal"){
    if (officeLevel === "municipal_executive" || seatContext.includes("executive") || seatContext.includes("mayor")){
      return "municipal_executive";
    }
    return "municipal_legislative";
  }

  if (raceType === "county"){
    return "countywide";
  }

  if (officeLevel === "judicial_other") return "judicial_other";
  return LEGACY_RACE_TYPE_TO_TEMPLATE_ID[raceType] || DEFAULT_TEMPLATE_ID;
}

function templateIdForOfficeLevel(officeLevel){
  const token = normalizeOfficeLevelToken(officeLevel);
  if (!token) return "";
  for (const record of Object.values(TEMPLATE_REGISTRY)){
    if (normalizeOfficeLevelToken(record?.dimensions?.officeLevel) === token){
      return cleanString(record?.id);
    }
  }
  return "";
}

export function normalizeLegacyRaceType(value){
  const inferred = inferLegacyRaceType(value);
  if (inferred) return inferred;
  return "state_leg";
}

export function getTemplateRecord(templateId){
  const id = cleanString(templateId);
  if (id && TEMPLATE_REGISTRY[id]) return TEMPLATE_REGISTRY[id];
  return TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID];
}

export function templateIdForRaceType(raceType, context = {}){
  const directTemplateId = knownTemplateId(raceType);
  if (directTemplateId) return directTemplateId;

  const inferredLegacyRaceType = inferLegacyRaceType(raceType);
  if (inferredLegacyRaceType){
    return resolveTemplateIdFromLegacyRaceType(inferredLegacyRaceType, context);
  }

  const officeTemplateId = templateIdForOfficeLevel(context?.officeLevel);
  if (officeTemplateId) return officeTemplateId;

  if (cleanString(raceType)) return "custom_context";
  return DEFAULT_TEMPLATE_ID;
}

export function normalizeTemplateDimensions(input = {}, fallbackRaceType = "state_leg"){
  const explicitTemplateId = knownTemplateId(input?.templateId || input?.appliedTemplateId);
  const fallbackTemplate = explicitTemplateId
    ? getTemplateRecord(explicitTemplateId)
    : getTemplateRecord(templateIdForRaceType(fallbackRaceType, input));
  const out = {};
  for (const key of TEMPLATE_DIMENSION_KEYS){
    const value = (key === "officeLevel")
      ? normalizeOfficeLevelToken(input?.[key])
      : cleanString(input?.[key]);
    out[key] = value || cleanString(fallbackTemplate?.dimensions?.[key]);
  }
  return out;
}

export function resolveTemplateId(input = {}){
  const explicitId = knownTemplateId(input?.templateId);
  if (explicitId) return explicitId;

  const raceTemplateId = knownTemplateId(input?.raceType);
  if (raceTemplateId) return raceTemplateId;

  const rawRaceType = cleanString(input?.raceType);
  const inferredRaceType = inferLegacyRaceType(rawRaceType);
  if (rawRaceType && !inferredRaceType){
    const officeTemplateId = templateIdForOfficeLevel(input?.officeLevel);
    if (officeTemplateId) return officeTemplateId;
    return "custom_context";
  }

  const fallbackRaceType = inferredRaceType || normalizeLegacyRaceType(rawRaceType);
  const dims = normalizeTemplateDimensions(input, fallbackRaceType);
  for (const record of Object.values(TEMPLATE_REGISTRY)){
    if (dimensionMatch(dims, record?.dimensions || {})) return record.id;
  }

  return templateIdForRaceType(fallbackRaceType, dims);
}

export function resolveTemplateRecord(input = {}){
  const src = isObject(input) ? input : {};
  const meta = isObject(src.templateMeta) ? src.templateMeta : {};
  const raceToken = cleanString(src.raceType || meta.legacyRaceType || "state_leg");
  const raceType = normalizeLegacyRaceType(raceToken);
  const hasTemplateIdInput = Object.prototype.hasOwnProperty.call(src, "templateId");
  const templateIdToken = hasTemplateIdInput
    ? src.templateId
    : (src.templateId || meta.appliedTemplateId);
  const explicitTemplateId = knownTemplateId(templateIdToken);
  const dimensionInput = {};
  for (const key of TEMPLATE_DIMENSION_KEYS){
    dimensionInput[key] = cleanString(src?.[key]) || cleanString(meta?.[key]);
  }
  const effectiveDimensions = normalizeTemplateDimensions({
    ...dimensionInput,
    ...(explicitTemplateId ? { templateId: explicitTemplateId } : {}),
  }, raceType);

  const resolvedId = resolveTemplateId({
    templateId: explicitTemplateId,
    raceType,
    ...effectiveDimensions,
  });

  const template = getTemplateRecord(resolvedId);
  return {
    id: template.id,
    template,
    legacyRaceType: normalizeLegacyRaceType(template?.legacyRaceType || raceType),
    dimensions: { ...effectiveDimensions },
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
    benchmarkKey: cleanString(resolved.template?.benchmarkKey),
    overriddenFields: [],
  };
}

export function normalizeTemplateMeta(metaInput, { raceType = "state_leg", templateId = "" } = {}){
  const meta = isObject(metaInput) ? metaInput : {};
  const resolved = resolveTemplateRecord({
    templateId: cleanString(templateId) || cleanString(meta.appliedTemplateId) || cleanString(raceType),
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
    officeLevel: normalizeOfficeLevelToken(meta.officeLevel) || resolved.dimensions.officeLevel,
    electionType: cleanString(meta.electionType) || resolved.dimensions.electionType,
    seatContext: cleanString(meta.seatContext) || resolved.dimensions.seatContext,
    partisanshipMode: cleanString(meta.partisanshipMode) || resolved.dimensions.partisanshipMode,
    salienceLevel: cleanString(meta.salienceLevel) || resolved.dimensions.salienceLevel,
    appliedTemplateId: cleanString(meta.appliedTemplateId) || resolved.id,
    appliedVersion: cleanString(meta.appliedVersion) || cleanString(resolved.template?.version) || TEMPLATE_REGISTRY_VERSION,
    benchmarkKey: cleanString(meta.benchmarkKey) || cleanString(resolved.template?.benchmarkKey),
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
    benchmarkKey: cleanString(resolved.template?.benchmarkKey) || normalized.benchmarkKey,
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
  const requestedTemplateId = cleanString(options?.templateId);
  const hasRaceOverride = cleanString(options?.raceType) !== "";
  const hasDimensionOverride = TEMPLATE_DIMENSION_KEYS.some((key) => cleanString(options?.[key]) !== "");
  const applyMode = normalizeTemplateApplyMode(options?.mode, { force: !!options?.force });
  const preserveCustomTemplateIdentity = !requestedTemplateId
    && !hasRaceOverride
    && hasDimensionOverride
    && currentResolved.id === "custom_context";
  const templateIdForResolution = requestedTemplateId
    || ((hasRaceOverride || (hasDimensionOverride && !preserveCustomTemplateIdentity)) ? "" : currentResolved.id);
  const templateMetaForResolution = hasRaceOverride ? null : stateLike.templateMeta;

  const nextResolved = resolveTemplateRecord({
    templateMeta: templateMetaForResolution,
    raceType: hasRaceOverride ? options.raceType : currentResolved.legacyRaceType,
    templateId: templateIdForResolution,
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
    benchmarkKey: cleanString(nextResolved.template?.benchmarkKey),
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

export function getTemplateSelectionIdForState(stateLike){
  const state = isObject(stateLike) ? stateLike : {};
  const fromMeta = knownTemplateId(state?.templateMeta?.appliedTemplateId);
  if (fromMeta) return fromMeta;
  const fromRaceType = knownTemplateId(state?.raceType);
  if (fromRaceType) return fromRaceType;
  return resolveTemplateRecord(state).id;
}

export function getTemplateLabelForTemplateId(templateId, { detailed = false } = {}){
  const template = getTemplateRecord(templateId);
  if (detailed) return cleanString(template?.label) || cleanString(template?.legacyLabel) || "Template";
  return cleanString(template?.label) || cleanString(template?.legacyLabel) || "Template";
}

export function getTemplateLabelForRaceType(raceType, { detailed = false } = {}){
  const templateId = templateIdForRaceType(raceType);
  return getTemplateLabelForTemplateId(templateId, { detailed });
}

export function getTemplateLabelForState(stateLike, { detailed = false } = {}){
  const resolved = resolveTemplateRecord(stateLike);
  return getTemplateLabelForTemplateId(resolved.id, { detailed });
}
