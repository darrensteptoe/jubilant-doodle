// @ts-check

import {
  CANONICAL_DOMAINS,
  CANONICAL_SCHEMA_VERSION,
  migrateLegacyStateToCanonical,
} from "../state/schema.js";
import { assertActionMutationOwnership } from "../state/ownershipAssertions.js";

function nowIso(nowDate = new Date()) {
  const next = nowDate instanceof Date ? nowDate : new Date(nowDate);
  return Number.isFinite(next.getTime()) ? next.toISOString() : new Date().toISOString();
}

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function shouldEnforceModuleBoundary(options = {}) {
  if (options?.enforceBoundary === true) return true;
  if (options?.enforceBoundary === false) return false;
  const globalToggle = globalThis?.__FPE_DEV_BOUNDARY_ASSERTIONS__;
  if (globalToggle === true) return true;
  if (globalToggle === false) return false;
  try {
    return cleanText(process?.env?.NODE_ENV).toLowerCase() === "test";
  } catch {
    return false;
  }
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toBool(value) {
  if (typeof value === "boolean") return value;
  const token = cleanText(value).toLowerCase();
  return token === "true" || token === "1" || token === "yes";
}

export function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function ensureCanonicalState(state, { nowDate = new Date() } = {}) {
  if (
    state
    && typeof state === "object"
    && Number(state.schemaVersion) === CANONICAL_SCHEMA_VERSION
    && state.domains
    && typeof state.domains === "object"
  ) {
    return state;
  }
  return migrateLegacyStateToCanonical(state, { nowDate });
}

export function isScenarioLocked(state) {
  return !!state?.domains?.campaign?.contextLock?.scenario;
}

export function mutateDomain(state, domain, mutateFn, options = {}) {
  const {
    nowDate = new Date(),
    revisionReason = "",
    honorScenarioLock = true,
    actionName = "",
    sourceModule = "",
    sourceSurface = "",
    traceLayer = null,
  } = options;
  const enforceModuleBoundary = shouldEnforceModuleBoundary(options);

  const canonical = ensureCanonicalState(state, { nowDate });
  if (honorScenarioLock && isScenarioLocked(canonical)) {
    return {
      state: canonical,
      changed: false,
      blocked: true,
      reason: "scenario_locked",
      revisionReason,
    };
  }

  const currentDomain = canonical?.domains?.[domain];
  if (!currentDomain || typeof currentDomain !== "object") {
    return {
      state: canonical,
      changed: false,
      blocked: true,
      reason: "invalid_domain",
      revisionReason,
    };
  }

  const draftDomain = clone(currentDomain);
  const shouldCaptureBeforeSnapshot = enforceModuleBoundary
    || (traceLayer && typeof traceLayer.recordMutation === "function");
  const canonicalBeforeSnapshot = shouldCaptureBeforeSnapshot
    ? clone(canonical)
    : canonical;
  const previousRevision = toFinite(canonical.revision, 0) || 0;
  const previousDomainRevision = toFinite(currentDomain.revision, 0) || 0;
  const outcome = mutateFn(draftDomain, canonical);
  if (outcome === false) {
    return {
      state: canonical,
      changed: false,
      blocked: false,
      reason: "no_op",
      revisionReason,
    };
  }

  const next = {
    ...canonical,
    revision: previousRevision + 1,
    updatedAt: nowIso(nowDate),
    domains: {
      ...canonical.domains,
      [domain]: {
        ...draftDomain,
        revision: (toFinite(draftDomain.revision, previousDomainRevision) || 0) + 1,
      },
    },
  };

  if (enforceModuleBoundary) {
    assertActionMutationOwnership({
      beforeState: canonicalBeforeSnapshot,
      afterState: next,
      allowedDomains: [domain],
      actionName: cleanText(actionName) || cleanText(revisionReason) || "mutateDomain",
      canonicalDomains: CANONICAL_DOMAINS,
      allowNoop: false,
    });
  }

  let trace = null;
  if (traceLayer && typeof traceLayer.recordMutation === "function") {
    try {
      trace = traceLayer.recordMutation({
        sourceModule,
        sourceSurface,
        actionName: cleanText(actionName) || cleanText(revisionReason) || "mutateDomain",
        revisionReason,
        touchedDomain: domain,
      canonicalSlice: `domains.${domain}`,
      revisionBefore: previousRevision,
      revisionAfter: toFinite(next.revision, previousRevision),
      domainRevisionBefore: previousDomainRevision,
      domainRevisionAfter: toFinite(next?.domains?.[domain]?.revision, previousDomainRevision),
      beforeState: canonicalBeforeSnapshot,
      afterState: next,
    });
    } catch {
      trace = null;
    }
  }

  return {
    state: next,
    changed: true,
    blocked: false,
    reason: "ok",
    revisionReason,
    trace,
  };
}

export function makeActionResult(result, extra = {}) {
  const payload = {
    state: result.state,
    changed: !!result.changed,
    blocked: !!result.blocked,
    reason: cleanText(result.reason) || "ok",
    ...extra,
  };
  if (result?.trace && typeof result.trace === "object") {
    payload.trace = result.trace;
  }
  return payload;
}
