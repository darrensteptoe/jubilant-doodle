import test from "node:test";
import assert from "node:assert/strict";
import worker from "./fpe-api-proxy.js";

test("worker proxy: OPTIONS responds with CORS headers for allowed origin", async () => {
  const request = new Request("https://proxy.example.net/api/weather?zip=60614", {
    method: "OPTIONS",
    headers: { Origin: "https://darrensteptoe.github.io" },
  });
  const response = await worker.fetch(request, {
    CORS_ALLOWED_ORIGINS: "http://localhost:5173,https://darrensteptoe.github.io",
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://darrensteptoe.github.io");
});

test("worker proxy: GET error responses include CORS headers for allowed origin", async () => {
  const request = new Request("https://proxy.example.net/api/weather?zip=bad", {
    method: "GET",
    headers: { Origin: "http://localhost:5173" },
  });
  const response = await worker.fetch(request, {
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const payload = await response.json();
  assert.equal(payload?.code, "invalid_zip");
});

