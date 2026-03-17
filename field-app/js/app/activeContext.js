// @ts-check

export const DEFAULT_CAMPAIGN_ID = "default";
export const DEFAULT_CAMPAIGN_NAME = "";
export const DEFAULT_OFFICE_ID = "";
export const DEFAULT_SCENARIO_ID = "";

const CAMPAIGN_PARAM_KEYS = ["campaign", "campaignId"];
const CAMPAIGN_NAME_PARAM_KEYS = ["campaignName"];
const OFFICE_PARAM_KEYS = ["office", "officeId"];
const SCENARIO_PARAM_KEYS = ["scenario", "scenarioId"];

function clean(value){
  return String(value == null ? "" : value).trim();
}

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSlug(raw, fallback = ""){
  const input = clean(raw).toLowerCase();
  const next = input
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

function normalizeLabel(raw, fallback = ""){
  const input = clean(raw);
  if (!input) return fallback;
  return input.slice(0, 160);
}

function readWindowSearch(){
  try{
    if (typeof window !== "undefined" && window.location){
      return String(window.location.search || "");
    }
  } catch {
    // ignore
  }
  return "";
}

function getParams(search){
  try{
    return new URLSearchParams(String(search || ""));
  } catch {
    return new URLSearchParams("");
  }
}

function pickParam(params, keys){
  for (const key of keys){
    const value = clean(params.get(key));
    if (value) return value;
  }
  return "";
}

function hasParam(params, keys){
  for (const key of keys){
    if (clean(params.get(key))) return true;
  }
  return false;
}

export function normalizeCampaignId(value, fallback = DEFAULT_CAMPAIGN_ID){
  return normalizeSlug(value, normalizeSlug(fallback, DEFAULT_CAMPAIGN_ID));
}

export function normalizeOfficeId(value, fallback = DEFAULT_OFFICE_ID){
  return normalizeSlug(value, normalizeSlug(fallback, DEFAULT_OFFICE_ID));
}

export function normalizeScenarioId(value, fallback = DEFAULT_SCENARIO_ID){
  return normalizeSlug(value, normalizeSlug(fallback, DEFAULT_SCENARIO_ID));
}

/**
 * @param {any} options
 * @returns {{
 *   campaignId: string,
 *   campaignName: string,
 *   officeId: string,
 *   scenarioId: string,
 *   isCampaignLocked: boolean,
 *   isOfficeLocked: boolean,
 *   isScenarioLocked: boolean,
 *   campaignSource: "explicit" | "url" | "fallback" | "default",
 *   officeSource: "explicit" | "url" | "fallback" | "default",
 *   scenarioSource: "explicit" | "url" | "fallback" | "default",
 * }}
 */
export function resolveActiveContext(options = {}){
  const src = isObject(options) ? options : {};
  const fallback = isObject(src.fallback) ? src.fallback : {};
  const search = (src.search != null) ? String(src.search) : readWindowSearch();
  const params = getParams(search);

  const explicitCampaign = clean(src.campaignId);
  const explicitCampaignName = clean(src.campaignName);
  const explicitOffice = clean(src.officeId);
  const explicitScenario = clean(src.scenarioId);

  const urlCampaign = pickParam(params, CAMPAIGN_PARAM_KEYS);
  const urlCampaignName = pickParam(params, CAMPAIGN_NAME_PARAM_KEYS);
  const urlOffice = pickParam(params, OFFICE_PARAM_KEYS);
  const urlScenario = pickParam(params, SCENARIO_PARAM_KEYS);

  const fallbackCampaign = clean(fallback.campaignId);
  const fallbackCampaignName = clean(fallback.campaignName);
  const fallbackOffice = clean(fallback.officeId || fallback.office);
  const fallbackScenario = clean(fallback.scenarioId);

  const campaignSource = explicitCampaign
    ? "explicit"
    : (urlCampaign ? "url" : (fallbackCampaign ? "fallback" : "default"));
  const officeSource = explicitOffice
    ? "explicit"
    : (urlOffice ? "url" : (fallbackOffice ? "fallback" : "default"));
  const scenarioSource = explicitScenario
    ? "explicit"
    : (urlScenario ? "url" : (fallbackScenario ? "fallback" : "default"));

  const campaignRaw = explicitCampaign || urlCampaign || fallbackCampaign || DEFAULT_CAMPAIGN_ID;
  const campaignNameRaw = explicitCampaignName || urlCampaignName || fallbackCampaignName || DEFAULT_CAMPAIGN_NAME;
  const officeRaw = explicitOffice || urlOffice || fallbackOffice || DEFAULT_OFFICE_ID;
  const scenarioRaw = explicitScenario || urlScenario || fallbackScenario || DEFAULT_SCENARIO_ID;

  return {
    campaignId: normalizeCampaignId(campaignRaw, DEFAULT_CAMPAIGN_ID),
    campaignName: normalizeLabel(campaignNameRaw, DEFAULT_CAMPAIGN_NAME),
    officeId: normalizeOfficeId(officeRaw, DEFAULT_OFFICE_ID),
    scenarioId: normalizeScenarioId(scenarioRaw, DEFAULT_SCENARIO_ID),
    isCampaignLocked: hasParam(params, CAMPAIGN_PARAM_KEYS),
    isOfficeLocked: hasParam(params, OFFICE_PARAM_KEYS),
    isScenarioLocked: hasParam(params, SCENARIO_PARAM_KEYS),
    campaignSource,
    officeSource,
    scenarioSource,
  };
}

/**
 * @param {Record<string, any>} target
 * @param {ReturnType<typeof resolveActiveContext>} context
 */
export function applyContextToState(target, context){
  if (!target || typeof target !== "object") return target;
  const ctx = resolveActiveContext({ fallback: context || {} });
  target.campaignId = ctx.campaignId;
  target.campaignName = ctx.campaignName;
  target.officeId = ctx.officeId;
  const scopedScenarioId = normalizeScenarioId(ctx.scenarioId, "");
  if (scopedScenarioId){
    target.scenarioId = scopedScenarioId;
    if (!target.ui || typeof target.ui !== "object"){
      target.ui = {};
    }
    target.ui.activeScenarioId = scopedScenarioId;
    if (!clean(target.ui.scenarioUiSelectedId)){
      target.ui.scenarioUiSelectedId = scopedScenarioId;
    }
  }
  return target;
}

/**
 * @param {Record<string, any>} state
 * @param {any=} options
 */
export function contextFromState(state, options = {}){
  return resolveActiveContext({
    ...(isObject(options) ? options : {}),
    fallback: state || {},
  });
}
