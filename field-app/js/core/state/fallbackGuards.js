// @ts-check

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolvePath(target, path) {
  const token = cleanText(path);
  if (!token) return undefined;
  const parts = token.split(".");
  let cursor = target;
  for (const part of parts) {
    if (!cursor || (typeof cursor !== "object" && !Array.isArray(cursor))) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function normalizeRuntimeEnv(runtimeEnv = "") {
  const explicit = cleanText(runtimeEnv).toLowerCase();
  if (explicit) return explicit;
  const globalEnv = cleanText(globalThis?.__FPE_RUNTIME_ENV__).toLowerCase();
  if (globalEnv) return globalEnv;
  try {
    const nodeEnv = cleanText(process?.env?.NODE_ENV).toLowerCase();
    if (nodeEnv) return nodeEnv;
  } catch {
    // no-op
  }
  return "development";
}

function toIssueKey(issue = {}) {
  return [
    cleanText(issue.code),
    cleanText(issue.moduleName),
    cleanText(issue.contractName),
    cleanText(issue.message),
  ].join("|");
}

/**
 * @param {{
 *   moduleName?: string,
 *   runtimeEnv?: string,
 *   strict?: boolean,
 *   dedupe?: boolean,
 *   onIssue?: (issue: Record<string, any>) => void,
 *   logger?: { warn?: (text: string, issue?: Record<string, any>) => void, error?: (text: string, issue?: Record<string, any>) => void },
 * }} options
 */
export function createFallbackGuardContext(options = {}) {
  const moduleName = cleanText(options.moduleName) || "unknown_module";
  const runtimeEnv = normalizeRuntimeEnv(options.runtimeEnv);
  const strict = options.strict == null ? runtimeEnv === "test" : !!options.strict;
  const dedupe = options.dedupe !== false;
  const logger = options.logger && typeof options.logger === "object"
    ? options.logger
    : console;
  const onIssue = typeof options.onIssue === "function" ? options.onIssue : null;
  const seen = new Set();

  function report(issue = {}) {
    const row = {
      code: cleanText(issue.code) || "fallback_guard_issue",
      level: cleanText(issue.level).toLowerCase() === "warn" ? "warn" : "error",
      moduleName: cleanText(issue.moduleName) || moduleName,
      contractName: cleanText(issue.contractName),
      message: cleanText(issue.message) || "Fallback guard issue detected.",
      details: issue.details && typeof issue.details === "object" ? issue.details : {},
      runtimeEnv,
      strict,
      at: new Date().toISOString(),
    };
    const key = toIssueKey(row);
    if (dedupe && seen.has(key)) {
      return row;
    }
    seen.add(key);
    if (onIssue) {
      try {
        onIssue(row);
      } catch {
        // no-op
      }
    }
    const prefix = `[fallback-guard:${row.level}] ${row.moduleName}${row.contractName ? `:${row.contractName}` : ""}`;
    const text = `${prefix} ${row.message}`;

    if (row.level === "warn") {
      if (typeof logger.warn === "function") {
        logger.warn(text, row);
      }
      return row;
    }

    if (strict) {
      const err = new Error(text);
      err.name = "FallbackGuardError";
      throw err;
    }

    if (typeof logger.error === "function") {
      logger.error(text, row);
    }
    return row;
  }

  return {
    moduleName,
    runtimeEnv,
    strict,
    report,
  };
}

export function guardMissingModuleContract(context, {
  contractName = "",
  moduleRef = null,
  requiredMethods = [],
} = {}) {
  const target = moduleRef && typeof moduleRef === "object" ? moduleRef : null;
  const missingMethods = asArray(requiredMethods)
    .map((name) => cleanText(name))
    .filter(Boolean)
    .filter((name) => !target || typeof target[name] !== "function");
  if (target && !missingMethods.length) return null;
  return context.report({
    code: "missing_module_contract",
    level: "error",
    contractName,
    message: target
      ? `Module contract is missing required methods: ${missingMethods.join(", ")}.`
      : "Module contract object is missing.",
    details: { missingMethods },
  });
}

export function guardMissingCanonicalReader(context, {
  bridgeName = "",
  api = null,
} = {}) {
  if (api && typeof api.getCanonicalView === "function") return null;
  return context.report({
    code: "missing_canonical_reader",
    level: "error",
    contractName: bridgeName,
    message: "Missing canonical reader `getCanonicalView()`.",
  });
}

export function guardMissingDerivedReader(context, {
  bridgeName = "",
  api = null,
} = {}) {
  if (api && typeof api.getDerivedView === "function") return null;
  return context.report({
    code: "missing_derived_reader",
    level: "error",
    contractName: bridgeName,
    message: "Missing derived reader `getDerivedView()`.",
  });
}

export function guardDeprecatedCompatibilityWrapperUsage(context, {
  wrapperName = "",
  replacement = "",
} = {}) {
  return context.report({
    code: "deprecated_compatibility_wrapper",
    level: "warn",
    contractName: wrapperName,
    message: replacement
      ? `Deprecated compatibility wrapper in use. Migrate to ${replacement}.`
      : "Deprecated compatibility wrapper in use.",
  });
}

export function guardRequiredSelectorInputs(context, {
  selectorName = "",
  input = null,
  requiredPaths = [],
} = {}) {
  const missing = asArray(requiredPaths)
    .map((path) => cleanText(path))
    .filter(Boolean)
    .filter((path) => resolvePath(input, path) === undefined);
  if (!missing.length) return null;
  return context.report({
    code: "missing_selector_inputs",
    level: "error",
    contractName: selectorName,
    message: `Selector input missing required paths: ${missing.join(", ")}.`,
    details: { missing },
  });
}

export function guardUnknownFieldOwnership(context, {
  field = "",
  ownershipRegistry = [],
} = {}) {
  const target = cleanText(field);
  if (!target) {
    return context.report({
      code: "unknown_field_ownership",
      level: "error",
      message: "Field ownership check requires a non-empty field path.",
    });
  }
  const found = asArray(ownershipRegistry).some((row) => cleanText(row?.field) === target);
  if (found) return null;
  return context.report({
    code: "unknown_field_ownership",
    level: "error",
    message: `Unknown field ownership for '${target}'.`,
  });
}

