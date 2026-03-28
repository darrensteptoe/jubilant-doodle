// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import {
  MAPBOX_PUBLIC_TOKEN_STORAGE_KEY,
  clearSavedMapboxPublicToken,
  readMapboxPublicTokenConfig,
  resolveMapboxPublicToken,
  saveMapboxPublicToken,
} from "./runtimeConfig.js";

function installStorage() {
  const backing = new Map();
  const storage = {
    getItem(key) {
      return backing.has(String(key)) ? backing.get(String(key)) : null;
    },
    setItem(key, value) {
      backing.set(String(key), String(value));
    },
    removeItem(key) {
      backing.delete(String(key));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
  return { backing, storage };
}

function clearGlobals() {
  try {
    delete globalThis.__VICE_CONFIG__;
  } catch {}
  try {
    delete globalThis.localStorage;
  } catch {}
  try {
    delete globalThis.document;
  } catch {}
}

test("runtime config: saveMapboxPublicToken rejects non-public tokens", () => {
  clearGlobals();
  installStorage();

  const result = saveMapboxPublicToken("sk.test_secret_token");
  assert.equal(result?.ok, false);
  assert.equal(result?.code, "invalid_public_token");
  assert.equal(resolveMapboxPublicToken(), "");
});

test("runtime config: saved browser token has highest priority", () => {
  clearGlobals();
  const { backing } = installStorage();
  globalThis.__VICE_CONFIG__ = { MAPBOX_PUBLIC_TOKEN: "pk.legacy_config_value" };

  const save = saveMapboxPublicToken("pk.saved_browser_value");
  assert.equal(save?.ok, true);
  assert.equal(backing.get(MAPBOX_PUBLIC_TOKEN_STORAGE_KEY), "pk.saved_browser_value");
  assert.equal(resolveMapboxPublicToken(), "pk.saved_browser_value");
});

test("runtime config: clear falls back to legacy app config seam", () => {
  clearGlobals();
  const { backing } = installStorage();
  globalThis.__VICE_CONFIG__ = { MAPBOX_PUBLIC_TOKEN: "pk.legacy_config_value" };
  saveMapboxPublicToken("pk.saved_browser_value");

  clearSavedMapboxPublicToken();

  assert.equal(backing.has(MAPBOX_PUBLIC_TOKEN_STORAGE_KEY), false);
  assert.equal(resolveMapboxPublicToken(), "pk.legacy_config_value");
});

test("runtime config: readMapboxPublicTokenConfig reports invalid configured token", () => {
  clearGlobals();
  installStorage();
  globalThis.__VICE_CONFIG__ = { MAPBOX_PUBLIC_TOKEN: "sk.invalid_secret" };

  const status = readMapboxPublicTokenConfig();
  assert.equal(status.valid, false);
  assert.equal(status.invalidConfigValue, true);
  assert.equal(status.token, "");
});

test("runtime config: clear removes saved token when no fallback config exists", () => {
  clearGlobals();
  const { backing } = installStorage();

  const save = saveMapboxPublicToken("pk.saved_browser_value");
  assert.equal(save?.ok, true);
  assert.equal(backing.get(MAPBOX_PUBLIC_TOKEN_STORAGE_KEY), "pk.saved_browser_value");
  assert.equal(resolveMapboxPublicToken(), "pk.saved_browser_value");

  clearSavedMapboxPublicToken();
  assert.equal(backing.has(MAPBOX_PUBLIC_TOKEN_STORAGE_KEY), false);
  assert.equal(resolveMapboxPublicToken(), "");

  const status = readMapboxPublicTokenConfig();
  assert.equal(status.valid, false);
  assert.equal(status.token, "");
  assert.equal(status.source, "");
});
