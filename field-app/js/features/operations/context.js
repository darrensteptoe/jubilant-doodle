// @ts-check
// Canonical Operations page context helpers (campaign/office scoped).

import { resolveActiveContext } from "../../app/activeContext.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function isObject(value){
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function coerceContext(input = {}){
  const src = isObject(input) ? input : {};
  const resolved = resolveActiveContext({
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    officeId: src.officeId,
    scenarioId: src.scenarioId,
    search: src.search,
    fallback: src.fallback,
  });
  return {
    campaignId: clean(resolved.campaignId),
    campaignName: clean(resolved.campaignName),
    officeId: clean(resolved.officeId),
    scenarioId: clean(resolved.scenarioId),
    isCampaignLocked: !!resolved.isCampaignLocked,
    isOfficeLocked: !!resolved.isOfficeLocked,
    isScenarioLocked: !!resolved.isScenarioLocked,
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
  const ctx = coerceContext({ fallback: context });
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
  const ctx = coerceContext({ fallback: context });
  return `${ctx.campaignId || "default"}::${ctx.officeId || "all"}`;
}

/**
 * Human-readable context summary.
 * @param {any=} context
 */
export function summarizeOperationsContext(context = {}){
  const ctx = coerceContext({ fallback: context });
  const campaignLabel = ctx.campaignName || ctx.campaignId || "default";
  const officeLabel = ctx.officeId || "all";
  const locked = (ctx.isCampaignLocked || ctx.isOfficeLocked) ? " (locked)" : "";
  return `Campaign ${campaignLabel} | Office ${officeLabel}${locked}`;
}

function localHtmlUrlFromHref(rawHref){
  if (typeof window === "undefined") return null;
  const href = clean(rawHref);
  if (!href) return null;
  if (href.startsWith("#")) return null;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return null;
  try{
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (!/\.html$/i.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Preserve campaign/office context across local Operations navigation links.
 * Adds params only when missing; existing explicit params win.
 * @param {any=} context
 * @param {string=} selector
 */
export function applyOperationsContextToLinks(context = {}, selector = "a[href]"){
  if (typeof document === "undefined") return;
  const ctx = coerceContext({ fallback: context });
  const anchors = Array.from(document.querySelectorAll(selector));
  for (const anchor of anchors){
    const url = localHtmlUrlFromHref(anchor.getAttribute("href"));
    if (!url) continue;
    if (!url.searchParams.has("campaign") && ctx.campaignId){
      url.searchParams.set("campaign", ctx.campaignId);
    }
    if (!url.searchParams.has("office") && ctx.officeId){
      url.searchParams.set("office", ctx.officeId);
    }
    if (!url.searchParams.has("campaignName") && ctx.campaignName){
      url.searchParams.set("campaignName", ctx.campaignName);
    }
    anchor.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  }
}
