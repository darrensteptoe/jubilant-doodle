import test from "node:test";
import assert from "node:assert/strict";
import { fetchWarRoomWeatherByZip } from "./warRoomWeather.js";

test("weather proxy parser: returns clear error when proxy responds with HTML", async () => {
  const result = await fetchWarRoomWeatherByZip("60614", {
    fetchImpl: async () => new Response("<!DOCTYPE html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  });
  assert.equal(result?.ok, false);
  assert.equal(result?.code, "weather_proxy_non_json");
  assert.equal(
    result?.message,
    "API proxy returned HTML instead of JSON. Check Worker route wiring for /api/*.",
  );
});

