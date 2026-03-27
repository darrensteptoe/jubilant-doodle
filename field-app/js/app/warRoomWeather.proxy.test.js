import test from "node:test";
import assert from "node:assert/strict";
import { fetchWarRoomWeatherByZip } from "./warRoomWeather.js";

test("weather direct fetch: requires a runtime API key", async () => {
  const result = await fetchWarRoomWeatherByZip("60614", {
    fetchImpl: async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
    apiKey: "",
  });
  assert.equal(result?.ok, false);
  assert.equal(result?.code, "weather_key_missing");
});

test("weather direct fetch: returns clear error when upstream responds with HTML", async () => {
  const result = await fetchWarRoomWeatherByZip("60614", {
    fetchImpl: async () => new Response("<!DOCTYPE html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
    apiKey: "demo-key",
  });
  assert.equal(result?.ok, false);
  assert.equal(result?.code, "weather_upstream_error");
  assert.equal(
    result?.message,
    "Current weather request failed (200): Weather API returned HTML instead of JSON. Check API key and request path.",
  );
});
