// @ts-check
// Canonical Operations page context helpers (campaign/office scoped).

import { applyActiveContextToLinks, resolveActiveContext } from "../../app/activeContext.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function coerceContext(input = {}){
  const src = isObject(input) ? input : {};
  const fallback = isObject(src.fallback) ? src.fallback : {};
  const resolved = resolveActiveContext({
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    officeId: src.officeId,
    scenarioId: src.scenarioId,
    search: src.search,
    fallback,
  });
  const campaignLocked = (src.isCampaignLocked != null)
    ? !!src.isCampaignLocked
    : ((fallback.isCampaignLocked != null) ? !!fallback.isCampaignLocked : !!resolved.isCampaignLocked);
  const officeLocked = (src.isOfficeLocked != null)
    ? !!src.isOfficeLocked
    : ((fallback.isOfficeLocked != null) ? !!fallback.isOfficeLocked : !!resolved.isOfficeLocked);
  const scenarioLocked = (src.isScenarioLocked != null)
    ? !!src.isScenarioLocked
    : ((fallback.isScenarioLocked != null) ? !!fallback.isScenarioLocked : !!resolved.isScenarioLocked);
  return {
    campaignId: clean(resolved.campaignId),
    campaignName: clean(resolved.campaignName),
    officeId: clean(resolved.officeId),
    scenarioId: clean(resolved.scenarioId),
    isCampaignLocked: campaignLocked,
    isOfficeLocked: officeLocked,
    isScenarioLocked: scenarioLocked,
  };
}

/**
 * Resolve the active campaign/office context for Operations pages.
 * @param {any=} options
 */
export function resolveOperationsContext(options = {}){
  return coerceContext(options);
}

/**
 * Resolve operations context from app state shape (campaign/office/scenario).
 * @param {any=} stateLike
 * @param {any=} options
 */
export function resolveOperationsContextFromState(stateLike = {}, options = {}){
  const state = isObject(stateLike) ? stateLike : {};
  const opts = isObject(options) ? options : {};
  return coerceContext({
    ...opts,
    fallback: {
      campaignId: state.campaignId,
      campaignName: state.campaignName,
      officeId: state.officeId,
      scenarioId: state.scenarioId || state?.ui?.activeScenarioId,
      ...(isObject(opts.fallback) ? opts.fallback : {}),
    },
  });
}

/**
 * Build scoped store options from a context object.
 * @param {any=} context
 * @param {any=} overrides
 */
export function toOperationsStoreOptions(context = {}, overrides = {}){
  const ctx = coerceContext(context);
  const ext = isObject(overrides) ? overrides : {};
  return {
    ...ext,
    campaignId: ctx.campaignId,
    campaignName: ctx.campaignName,
    officeId: ctx.officeId,
    scenarioId: ctx.scenarioId,
  };
}

/**
 * Build scoped operations-store options directly from app state.
 * @param {any=} stateLike
 * @param {any=} overrides
 */
export function toOperationsStoreOptionsFromState(stateLike = {}, overrides = {}){
  const ctx = resolveOperationsContextFromState(stateLike);
  return toOperationsStoreOptions(ctx, overrides);
}

/**
 * Stable cache key for operations scoped context.
 * @param {any=} context
 */
export function makeOperationsContextKey(context = {}){
  const ctx = coerceContext(context);
  return `${ctx.campaignId || "default"}::${ctx.officeId || "all"}`;
}

/**
 * Human-readable context summary.
 * @param {any=} context
 */
export function summarizeOperationsContext(context = {}){
  const ctx = coerceContext(context);
  const campaignLabel = ctx.campaignName || ctx.campaignId || "default";
  const officeLabel = ctx.officeId || "all";
  const locked = (ctx.isCampaignLocked || ctx.isOfficeLocked) ? " (locked)" : "";
  return `Campaign ${campaignLabel} | Office ${officeLabel}${locked}`;
}

/**
 * Whether office entry should be locked in team-entry mode.
 * Locking behavior is driven by URL office param presence.
 * @param {any=} context
 */
export function shouldLockOperationsOfficeField(context = {}){
  const ctx = coerceContext(context);
  return !!ctx.isOfficeLocked;
}

/**
 * Resolve canonical office label for Operations records/forms.
 * URL/context office always wins to prevent cross-office drift.
 * @param {any=} context
 * @param {string=} explicitOffice
 * @param {string=} fallbackOffice
 */
export function resolveOperationsOfficeField(context = {}, explicitOffice = "", fallbackOffice = ""){
  const ctx = coerceContext(context);
  const scopedOffice = clean(ctx.officeId);
  if (scopedOffice) return scopedOffice;
  return clean(explicitOffice) || clean(fallbackOffice);
}

/**
 * Preserve campaign/office context across local Operations navigation links.
 * Adds params only when missing; existing explicit params win.
 * @param {any=} context
 * @param {string=} selector
 */
export function applyOperationsContextToLinks(context = {}, selector = "a[href]"){
  const ctx = coerceContext(context);
  applyActiveContextToLinks(ctx, selector, { includeScenario: false });
}
