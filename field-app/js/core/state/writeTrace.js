// @ts-check

import { resolveRecomputeInvalidations } from "./recomputeInvalidationMap.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toIso(nowDate = new Date()) {
  const next = nowDate instanceof Date ? nowDate : new Date(nowDate);
  return Number.isFinite(next.getTime()) ? next.toISOString() : new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueSorted(values = []) {
  return Array.from(new Set(asArray(values).map((value) => cleanText(value)).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
}

function deriveChangedTopLevelDomains(beforeState, afterState) {
  const beforeDomains = beforeState?.domains && typeof beforeState.domains === "object" ? beforeState.domains : {};
  const afterDomains = afterState?.domains && typeof afterState.domains === "object" ? afterState.domains : {};
  const names = new Set([
    ...Object.keys(beforeDomains),
    ...Object.keys(afterDomains),
  ]);
  return Array.from(names)
    .filter((domain) => JSON.stringify(beforeDomains[domain]) !== JSON.stringify(afterDomains[domain]))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Create a write-path trace recorder for mutation/debug diagnostics.
 * Quiet by default unless enabled.
 *
 * @param {{
 *   enabled?: boolean,
 *   maxEntries?: number,
 *   nowDate?: Date,
 * }=} options
 */
export function createWriteTraceLayer(options = {}) {
  const enabled = !!options.enabled;
  const maxEntries = Math.max(1, Math.trunc(toFinite(options.maxEntries, 200)));
  /** @type {Array<Record<string, any>>} */
  const entries = [];
  let sequence = 0;

  function nextId() {
    sequence += 1;
    return `trace_${sequence}`;
  }

  function list(limit = maxEntries) {
    const take = Math.max(0, Math.trunc(toFinite(limit, maxEntries)));
    if (take <= 0) return [];
    return entries.slice(0, take).map((entry) => ({
      ...entry,
      invalidation: {
        ...entry.invalidation,
        selectors: asArray(entry?.invalidation?.selectors).slice(),
        modules: asArray(entry?.invalidation?.modules).slice(),
        bridges: asArray(entry?.invalidation?.bridges).slice(),
      },
      dirtyDomains: asArray(entry?.dirtyDomains).slice(),
    }));
  }

  function clear() {
    entries.length = 0;
  }

  /**
   * Record one mutation trace entry when enabled.
   *
   * @param {{
   *   sourceModule?: string,
   *   sourceSurface?: string,
   *   actionName?: string,
   *   revisionReason?: string,
   *   touchedDomain?: string,
   *   canonicalSlice?: string,
   *   revisionBefore?: number,
   *   revisionAfter?: number,
   *   domainRevisionBefore?: number,
   *   domainRevisionAfter?: number,
   *   beforeState?: Record<string, any>,
   *   afterState?: Record<string, any>,
   *   nowDate?: Date,
   * }} payload
   */
  function recordMutation(payload = {}) {
    if (!enabled) return null;

    const actionName = cleanText(payload.actionName) || "mutation";
    const touchedDomain = cleanText(payload.touchedDomain);
    const revisionReason = cleanText(payload.revisionReason);
    const invalidation = resolveRecomputeInvalidations({
      domain: touchedDomain,
      actionName,
      revisionReason,
    });
    const dirtyDomains = deriveChangedTopLevelDomains(payload.beforeState, payload.afterState);

    const entry = {
      traceId: nextId(),
      at: toIso(payload.nowDate || options.nowDate || new Date()),
      source: {
        module: cleanText(payload.sourceModule) || "unknown_module",
        surface: cleanText(payload.sourceSurface) || "unknown_surface",
      },
      actionName,
      revisionReason,
      canonicalSlice: cleanText(payload.canonicalSlice) || (touchedDomain ? `domains.${touchedDomain}` : ""),
      touchedDomain,
      revision: {
        before: toFinite(payload.revisionBefore, 0),
        after: toFinite(payload.revisionAfter, 0),
      },
      domainRevision: {
        before: toFinite(payload.domainRevisionBefore, 0),
        after: toFinite(payload.domainRevisionAfter, 0),
      },
      invalidation: {
        selectors: uniqueSorted(invalidation.selectors),
        modules: uniqueSorted(invalidation.modules),
        bridges: uniqueSorted(invalidation.bridges),
      },
      dirtyDomains: uniqueSorted(dirtyDomains),
    };

    entries.unshift(entry);
    if (entries.length > maxEntries) {
      entries.length = maxEntries;
    }
    return {
      ...entry,
      invalidation: {
        ...entry.invalidation,
        selectors: entry.invalidation.selectors.slice(),
        modules: entry.invalidation.modules.slice(),
        bridges: entry.invalidation.bridges.slice(),
      },
      dirtyDomains: entry.dirtyDomains.slice(),
    };
  }

  return {
    enabled,
    maxEntries,
    recordMutation,
    list,
    clear,
  };
}

