// @ts-check

import { CANONICAL_DOMAINS } from "./schema.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeComparable(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparable(item));
  }
  if (isObject(value)) {
    const out = {};
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        out[key] = normalizeComparable(value[key]);
      });
    return out;
  }
  return value;
}

function stableSerialize(value) {
  return JSON.stringify(normalizeComparable(value));
}

function resolvePath(target, path) {
  const token = cleanText(path);
  if (!token) return undefined;
  const parts = token.split(".");
  let cursor = target;
  for (const part of parts) {
    if (!isObject(cursor) && !Array.isArray(cursor)) {
      return undefined;
    }
    cursor = cursor[part];
    if (cursor == null) {
      return cursor;
    }
  }
  return cursor;
}

/**
 * Assert each canonical field has one and only one owner.
 *
 * @param {{
 *   registry?: Array<{ field?: string, domain?: string }>,
 *   canonicalDomains?: string[],
 * }=} args
 * @returns {{
 *   fieldOwners: Record<string, string[]>,
 *   duplicateFields: Array<{ field: string, domains: string[] }>,
 * }}
 */
export function assertUniqueFieldOwnership(args = {}) {
  const {
    registry = [],
    canonicalDomains = CANONICAL_DOMAINS,
  } = args;

  const known = new Set(asArray(canonicalDomains).map((domain) => cleanText(domain)).filter(Boolean));
  /** @type {Record<string, Set<string>>} */
  const ownerSets = {};
  /** @type {string[]} */
  const invalidRows = [];

  asArray(registry).forEach((row, index) => {
    const field = cleanText(row?.field);
    const domain = cleanText(row?.domain);
    if (!field || !domain) {
      invalidRows.push(`row ${index + 1}`);
      return;
    }
    if (!known.has(domain)) {
      throw new Error(
        `[ownership] unknown domain '${domain}' for field '${field}'.`,
      );
    }
    if (!ownerSets[field]) ownerSets[field] = new Set();
    ownerSets[field].add(domain);
  });

  if (invalidRows.length) {
    throw new Error(`[ownership] invalid ownership rows: ${invalidRows.join(", ")}.`);
  }

  const duplicateFields = Object.entries(ownerSets)
    .map(([field, domains]) => ({
      field,
      domains: Array.from(domains).sort(),
    }))
    .filter((entry) => entry.domains.length > 1)
    .sort((a, b) => a.field.localeCompare(b.field));

  if (duplicateFields.length) {
    const summary = duplicateFields
      .map((entry) => `${entry.field} -> ${entry.domains.join(", ")}`)
      .join(" | ");
    throw new Error(`[ownership] duplicate canonical owners detected: ${summary}.`);
  }

  /** @type {Record<string, string[]>} */
  const fieldOwners = {};
  Object.keys(ownerSets)
    .sort((a, b) => a.localeCompare(b))
    .forEach((field) => {
      fieldOwners[field] = Array.from(ownerSets[field]).sort();
    });

  return {
    fieldOwners,
    duplicateFields,
  };
}

/**
 * Assert a write action changed only allowed canonical domains.
 *
 * @param {{
 *   beforeState: Record<string, any>,
 *   afterState: Record<string, any>,
 *   allowedDomains: string[],
 *   actionName?: string,
 *   canonicalDomains?: string[],
 *   allowNoop?: boolean,
 * }} args
 * @returns {{ changedDomains: string[] }}
 */
export function assertActionMutationOwnership(args) {
  const {
    beforeState,
    afterState,
    allowedDomains = [],
    actionName = "unknown_action",
    canonicalDomains = CANONICAL_DOMAINS,
    allowNoop = true,
  } = args || {};

  if (!isObject(beforeState) || !isObject(afterState)) {
    throw new Error(`[ownership] ${actionName}: before/after state must be objects.`);
  }

  const beforeDomains = isObject(beforeState.domains) ? beforeState.domains : {};
  const afterDomains = isObject(afterState.domains) ? afterState.domains : {};
  const domainList = Array.from(new Set(asArray(canonicalDomains).map((domain) => cleanText(domain)).filter(Boolean)));
  const allowed = new Set(asArray(allowedDomains).map((domain) => cleanText(domain)).filter(Boolean));
  const changedDomains = [];

  domainList.forEach((domain) => {
    const beforeDomain = beforeDomains[domain];
    const afterDomain = afterDomains[domain];
    if (stableSerialize(beforeDomain) !== stableSerialize(afterDomain)) {
      changedDomains.push(domain);
    }
  });

  if (!changedDomains.length && !allowNoop) {
    throw new Error(`[ownership] ${actionName}: expected domain mutation but action was a no-op.`);
  }

  const unauthorized = changedDomains.filter((domain) => !allowed.has(domain));
  if (unauthorized.length) {
    throw new Error(
      `[ownership] ${actionName}: unauthorized domain writes -> ${unauthorized.join(", ")}.`,
    );
  }

  return { changedDomains };
}

/**
 * Assert canonical bridge payload does not leak derived-only keys.
 *
 * @param {{
 *   bridgeName?: string,
 *   canonicalView: Record<string, any>,
 *   derivedOnlyKeys?: string[],
 * }} args
 */
export function assertBridgeCanonicalLane(args) {
  const {
    bridgeName = "bridge",
    canonicalView,
    derivedOnlyKeys = [],
  } = args || {};

  if (!isObject(canonicalView)) {
    throw new Error(`[ownership] ${bridgeName}: canonical bridge payload must be an object.`);
  }

  const leaks = asArray(derivedOnlyKeys)
    .map((key) => cleanText(key))
    .filter(Boolean)
    .filter((key) => resolvePath(canonicalView, key) !== undefined);

  if (leaks.length) {
    throw new Error(`[ownership] ${bridgeName}: canonical payload includes derived keys -> ${leaks.join(", ")}.`);
  }
}

/**
 * Assert derived bridge payload does not leak canonical input keys.
 *
 * @param {{
 *   bridgeName?: string,
 *   derivedView: Record<string, any>,
 *   canonicalOnlyKeys?: string[],
 * }} args
 */
export function assertBridgeDerivedLane(args) {
  const {
    bridgeName = "bridge",
    derivedView,
    canonicalOnlyKeys = [],
  } = args || {};

  if (!isObject(derivedView)) {
    throw new Error(`[ownership] ${bridgeName}: derived bridge payload must be an object.`);
  }

  const leaks = asArray(canonicalOnlyKeys)
    .map((key) => cleanText(key))
    .filter(Boolean)
    .filter((key) => resolvePath(derivedView, key) !== undefined);

  if (leaks.length) {
    throw new Error(`[ownership] ${bridgeName}: derived payload includes canonical keys -> ${leaks.join(", ")}.`);
  }
}

/**
 * Assert derived selectors/bridge payloads do not expose editable control truth.
 *
 * @param {{
 *   moduleName?: string,
 *   derivedView: Record<string, any>,
 *   editablePaths: string[],
 * }} args
 */
export function assertDerivedViewDoesNotExposeEditableFields(args) {
  const {
    moduleName = "module",
    derivedView,
    editablePaths = [],
  } = args || {};

  if (!isObject(derivedView)) {
    throw new Error(`[ownership] ${moduleName}: derived view must be an object.`);
  }

  const leakedEditable = asArray(editablePaths)
    .map((path) => cleanText(path))
    .filter(Boolean)
    .filter((path) => resolvePath(derivedView, path) !== undefined);

  if (leakedEditable.length) {
    throw new Error(
      `[ownership] ${moduleName}: derived payload exposes editable control fields -> ${leakedEditable.join(", ")}.`,
    );
  }
}
