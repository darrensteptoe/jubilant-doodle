// @ts-check
import {
  DEFAULT_CAMPAIGN_ID,
  normalizeCampaignId,
  normalizeOfficeId,
  normalizeScenarioId,
  resolveActiveContext,
} from "../app/activeContext.js";

export const CONTEXT_STORAGE_ROOT = "fpe";
const DEFAULT_OFFICE_SCOPE = "all";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function normalizeSegment(value, fallback = ""){
  const raw = clean(value).toLowerCase();
  const next = raw
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next || fallback;
}

function cleanModuleSegment(value){
  return normalizeSegment(value, "app");
}

function cleanKeySegment(value){
  return normalizeSegment(value, "state");
}

/**
 * Canonical resolver for campaign/office/scenario context with lock metadata.
 * @param {any=} options
 */
export function resolveCampaignContext(options = {}){
  const src = (options && typeof options === "object") ? options : {};
  return resolveActiveContext({
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    officeId: src.officeId,
    scenarioId: src.scenarioId,
    search: src.search,
    fallback: src.fallback,
  });
}

/**
 * Stable context token for caches/selectors.
 * @param {any=} context
 * @param {{ includeScenario?: boolean }=} options
 */
export function makeCampaignContextScopeKey(context = {}, options = {}){
  const ctx = resolveCampaignContext({ fallback: context });
  const includeScenario = !!(options && typeof options === "object" && options.includeScenario);
  const base = `${ctx.campaignId || DEFAULT_CAMPAIGN_ID}::${ctx.officeId || DEFAULT_OFFICE_SCOPE}`;
  if (!includeScenario) return base;
  const sid = normalizeScenarioId(ctx.scenarioId, "");
  return sid ? `${base}::${sid}` : base;
}

/**
 * Context readiness check for context-dependent execution.
 * Validation here is structural only (not realism/plausibility).
 * @param {any=} context
 * @param {{ requireOffice?: boolean, requireScenario?: boolean }=} options
 */
export function validateCampaignContext(context = {}, options = {}){
  const ctx = resolveCampaignContext({ fallback: context });
  const opts = (options && typeof options === "object") ? options : {};
  const missing = [];
  if (!clean(ctx.campaignId)){
    missing.push("campaignId");
  }
  if (opts.requireOffice && !clean(ctx.officeId)){
    missing.push("officeId");
  }
  if (opts.requireScenario && !clean(ctx.scenarioId)){
    missing.push("scenarioId");
  }
  return {
    ok: missing.length === 0,
    missing,
    context: ctx,
  };
}

/**
 * Build namespaced local storage path:
 * fpe/{campaignId}/{officeId}/{module}/{key}
 * Optional scenario scope inserts: /scenario/{scenarioId}/ before key.
 * @param {any=} context
 * @param {{
 *   module?: string,
 *   key?: string,
 *   includeScenario?: boolean,
 *   officeFallback?: string,
 * }=} options
 */
export function makeCampaignStoragePath(context = {}, options = {}){
  const ctx = resolveCampaignContext({ fallback: context });
  const opts = (options && typeof options === "object") ? options : {};
  const moduleName = cleanModuleSegment(opts.module || "app");
  const keyName = cleanKeySegment(opts.key || "state");
  const officeFallback = clean(opts.officeFallback) || DEFAULT_OFFICE_SCOPE;
  const campaignId = normalizeCampaignId(ctx.campaignId, DEFAULT_CAMPAIGN_ID);
  const officeId = normalizeOfficeId(ctx.officeId, "") || normalizeSegment(officeFallback, DEFAULT_OFFICE_SCOPE);
  const includeScenario = !!opts.includeScenario;
  const scenarioId = includeScenario ? normalizeScenarioId(ctx.scenarioId, "") : "";
  if (scenarioId){
    return `${CONTEXT_STORAGE_ROOT}/${campaignId}/${officeId}/${moduleName}/scenario/${scenarioId}/${keyName}`;
  }
  return `${CONTEXT_STORAGE_ROOT}/${campaignId}/${officeId}/${moduleName}/${keyName}`;
}

