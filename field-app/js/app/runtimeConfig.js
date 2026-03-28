const VICE_CONFIG_KEY = "__VICE_CONFIG__";
const MAPBOX_PUBLIC_TOKEN_KEY = "MAPBOX_PUBLIC_TOKEN";
const GOOGLE_MAPS_API_KEY_KEY = "GOOGLE_MAPS_API_KEY";
const MAPBOX_META_NAME = "vice-mapbox-public-token";
const GOOGLE_META_NAME = "vice-google-maps-api-key";
const MAPBOX_ENV_KEY = "VITE_MAPBOX_PUBLIC_TOKEN";
const GOOGLE_ENV_KEY = "VITE_GOOGLE_MAPS_API_KEY";
const VITE_PLACEHOLDER_RE = /^%VITE_[A-Z0-9_]+%$/;

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function isMapboxPublicToken(value) {
  return cleanText(value).toLowerCase().startsWith("pk.");
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

export function resolveViceConfig() {
  const config = ensureViceConfigObject();
  if (!readConfigToken(config, MAPBOX_PUBLIC_TOKEN_KEY)) {
    const fromMeta = readMetaConfigValue(MAPBOX_META_NAME);
    if (fromMeta) {
      config[MAPBOX_PUBLIC_TOKEN_KEY] = fromMeta;
    } else {
      const fromEnv = readEnvConfigValue(MAPBOX_ENV_KEY);
      if (fromEnv) {
        config[MAPBOX_PUBLIC_TOKEN_KEY] = fromEnv;
      }
    }
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
  const token = readConfigToken(resolveViceConfig(), MAPBOX_PUBLIC_TOKEN_KEY);
  return isMapboxPublicToken(token) ? token : "";
}

export function resolveGoogleMapsApiKey() {
  // Keep Google credentials separate from Mapbox.
  // If set in the future, the key must be restricted in Google Cloud by HTTP referrer and API allowlist.
  return readConfigToken(resolveViceConfig(), GOOGLE_MAPS_API_KEY_KEY);
}
