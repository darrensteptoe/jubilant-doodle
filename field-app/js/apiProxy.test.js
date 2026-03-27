import test from "node:test";
import assert from "node:assert/strict";
import { buildApiProxyUrl } from "./apiProxy.js";

function resetProxyConfig() {
  try {
    delete globalThis.__FPE_API_PROXY_BASE__;
  } catch {}
  try {
    delete globalThis.__VICE_CONFIG__;
  } catch {}
}

test("apiProxy: absolute base path keeps /api prefix", () => {
  resetProxyConfig();
  globalThis.__FPE_API_PROXY_BASE__ = "https://example.workers.dev/api";
  const url = buildApiProxyUrl("/weather", [["zip", "60614"]]);
  assert.equal(url, "https://example.workers.dev/api/weather?zip=60614");
});

test("apiProxy: origin-only absolute base defaults to /api namespace", () => {
  resetProxyConfig();
  globalThis.__FPE_API_PROXY_BASE__ = "https://example.workers.dev";
  const url = buildApiProxyUrl("/weather", [
    ["zip", "60614"],
  ]);
  assert.equal(
    url,
    "https://example.workers.dev/api/weather?zip=60614",
  );
});

test("apiProxy: reads API proxy base from __VICE_CONFIG__", () => {
  resetProxyConfig();
  globalThis.__VICE_CONFIG__ = { API_PROXY_BASE: "https://proxy.example.net/api" };
  const url = buildApiProxyUrl("/weather", [["zip", "10001"]]);
  assert.equal(url, "https://proxy.example.net/api/weather?zip=10001");
});
