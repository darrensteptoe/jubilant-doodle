const VICE_CONFIG_KEY = "__VICE_CONFIG__";
const MAPBOX_PUBLIC_TOKEN_KEY = "MAPBOX_PUBLIC_TOKEN";
const GOOGLE_MAPS_API_KEY_KEY = "GOOGLE_MAPS_API_KEY";
const MAPBOX_META_NAME = "vice-mapbox-public-token";
const GOOGLE_META_NAME = "vice-google-maps-api-key";
const MAPBOX_ENV_KEY = "VITE_MAPBOX_PUBLIC_TOKEN";
const GOOGLE_ENV_KEY = "VITE_GOOGLE_MAPS_API_KEY";
const VITE_PLACEHOLDER_RE = /^%VITE_[A-Z0-9_]+%$/;
const MAPBOX_TOKEN_INVALID_MESSAGE = "Mapbox token must be a public browser token that starts with pk.";
export const MAPBOX_PUBLIC_TOKEN_STORAGE_KEY = "vice.mapbox.publicToken.v1";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function isMapboxPublicToken(value) {
  return cleanText(value).toLowerCase().startsWith("pk.");
}

function maskMapboxToken(token) {
  const clean = cleanText(token);
  if (!clean) {
    return "Not configured";
  }
  if (clean.length <= 12) {
    return `${clean.slice(0, 4)}…`;
  }
  return `${clean.slice(0, 8)}…${clean.slice(-6)}`;
}

function readMetaConfigValue(name) {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") {
    return "";
  }
  const tag = document.querySelector(`meta[name="${name}"]`);
  const raw = cleanText(tag?.getAttribute?.("content"));
  if (!raw || VITE_PLACEHOLDER_RE.test(raw)) {
    return "";
  }
  return raw;
}

function readConfigToken(config, key) {
  return cleanText(config?.[key]);
}

function readEnvConfigValue(key) {
  try {
    return cleanText(import.meta?.env?.[key]);
  } catch {
    return "";
  }
}

function getTokenStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      return localStorage;
    }
  } catch {}
  return null;
}

function readStoredMapboxPublicToken() {
  const storage = getTokenStorage();
  if (!storage || typeof storage.getItem !== "function") {
    return "";
  }
  try {
    const token = cleanText(storage.getItem(MAPBOX_PUBLIC_TOKEN_STORAGE_KEY));
    return isMapboxPublicToken(token) ? token : "";
  } catch {
    return "";
  }
}

function ensureViceConfigObject() {
  const globalObj = globalThis || {};
  const current = globalObj[VICE_CONFIG_KEY];
  if (current && typeof current === "object") {
    return current;
  }
  const next = {};
  try {
    globalObj[VICE_CONFIG_KEY] = next;
  } catch {}
  return next;
}

function resolveLegacyMapboxTokenCandidate(config) {
  const direct = readConfigToken(config, MAPBOX_PUBLIC_TOKEN_KEY);
  if (isMapboxPublicToken(direct)) {
    return { token: direct, source: "legacy_config" };
  }
  const fromMeta = readMetaConfigValue(MAPBOX_META_NAME);
  if (isMapboxPublicToken(fromMeta)) {
    return { token: fromMeta, source: "legacy_meta" };
  }
  const fromEnv = readEnvConfigValue(MAPBOX_ENV_KEY);
  if (isMapboxPublicToken(fromEnv)) {
    return { token: fromEnv, source: "legacy_env" };
  }
  return { token: "", source: "" };
}

function resolveMapboxTokenCandidate(config) {
  const stored = readStoredMapboxPublicToken();
  if (stored) {
    return { token: stored, source: "saved_storage" };
  }
  return resolveLegacyMapboxTokenCandidate(config);
}

export function resolveViceConfig() {
  const config = ensureViceConfigObject();
  const current = readConfigToken(config, MAPBOX_PUBLIC_TOKEN_KEY);
  if (current && !isMapboxPublicToken(current)) {
    delete config[MAPBOX_PUBLIC_TOKEN_KEY];
  }
  const legacy = resolveLegacyMapboxTokenCandidate(config);
  if (!readConfigToken(config, MAPBOX_PUBLIC_TOKEN_KEY) && legacy.token) {
    config[MAPBOX_PUBLIC_TOKEN_KEY] = legacy.token;
  }
  if (!readConfigToken(config, GOOGLE_MAPS_API_KEY_KEY)) {
    const fromMeta = readMetaConfigValue(GOOGLE_META_NAME);
    if (fromMeta) {
      config[GOOGLE_MAPS_API_KEY_KEY] = fromMeta;
    } else {
      const fromEnv = readEnvConfigValue(GOOGLE_ENV_KEY);
      if (fromEnv) {
        config[GOOGLE_MAPS_API_KEY_KEY] = fromEnv;
      }
    }
  }
  return config;
}

export function resolveMapboxPublicToken() {
  resolveViceConfig();
  const config = ensureViceConfigObject();
  return resolveMapboxTokenCandidate(config).token;
}

export function readMapboxPublicTokenConfig() {
  const config = ensureViceConfigObject();
  const rawConfigValue = readConfigToken(config, MAPBOX_PUBLIC_TOKEN_KEY);
  const invalidConfigValue = !!rawConfigValue && !isMapboxPublicToken(rawConfigValue);
  const candidate = resolveMapboxTokenCandidate(config);
  return {
    token: candidate.token,
    valid: !!candidate.token,
    source: candidate.source,
    maskedToken: maskMapboxToken(candidate.token),
    storageKey: MAPBOX_PUBLIC_TOKEN_STORAGE_KEY,
    invalidConfigValue,
  };
}

export function saveMapboxPublicToken(tokenInput) {
  const token = cleanText(tokenInput);
  if (!isMapboxPublicToken(token)) {
    return {
      ok: false,
      code: "invalid_public_token",
      message: MAPBOX_TOKEN_INVALID_MESSAGE,
    };
  }
  const storage = getTokenStorage();
  if (!storage || typeof storage.setItem !== "function") {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Browser storage is unavailable. Mapbox token could not be saved.",
    };
  }
  try {
    storage.setItem(MAPBOX_PUBLIC_TOKEN_STORAGE_KEY, token);
  } catch {
    return {
      ok: false,
      code: "storage_write_failed",
      message: "Mapbox token save failed. Check browser storage permissions.",
    };
  }
  return {
    ok: true,
    code: "saved",
    source: "saved_storage",
    maskedToken: maskMapboxToken(token),
  };
}

export function clearSavedMapboxPublicToken() {
  const storage = getTokenStorage();
  if (storage && typeof storage.removeItem === "function") {
    try {
      storage.removeItem(MAPBOX_PUBLIC_TOKEN_STORAGE_KEY);
    } catch {}
  }
  return { ok: true, code: "cleared" };
}

export function resolveGoogleMapsApiKey() {
  // Keep Google credentials separate from Mapbox.
  // If set in the future, the key must be restricted in Google Cloud by HTTP referrer and API allowlist.
  return readConfigToken(resolveViceConfig(), GOOGLE_MAPS_API_KEY_KEY);
}
