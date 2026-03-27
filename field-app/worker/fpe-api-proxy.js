const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";
const PROXY_MARKER_HEADER = "x-fpe-proxy";
const PROXY_MARKER_VALUE = "field-app-40-weather-proxy";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 120;
const rateBuckets = new Map();

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function jsonResponse(payload, status = 200, extraHeaders = {}){
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      [PROXY_MARKER_HEADER]: PROXY_MARKER_VALUE,
      ...extraHeaders,
    },
  });
}

function errorResponse(status, code, message){
  return jsonResponse({ ok: false, code, message }, status, { "cache-control": "no-store" });
}

function normalizePath(pathname){
  const trimmed = cleanText(pathname || "/");
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailing = withLeading.replace(/\/+$/, "");
  return withoutTrailing || "/";
}

function readAllowedOrigins(env){
  const raw = cleanText(env.CORS_ALLOWED_ORIGINS);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => cleanText(part))
    .filter((part) => !!part);
}

function resolveCorsOrigin(request, env){
  const origin = cleanText(request.headers.get("origin"));
  if (!origin) return "";
  const allowList = readAllowedOrigins(env);
  if (!allowList.length) return "";
  if (allowList.includes("*")) return "*";
  return allowList.includes(origin) ? origin : "";
}

function withCors(response, request, env){
  const allowOrigin = resolveCorsOrigin(request, env);
  const headers = new Headers(response.headers || {});
  if (!headers.get(PROXY_MARKER_HEADER)){
    headers.set(PROXY_MARKER_HEADER, PROXY_MARKER_VALUE);
  }
  if (allowOrigin){
    headers.set("access-control-allow-origin", allowOrigin);
    headers.set("access-control-allow-methods", "GET, OPTIONS");
    headers.set("access-control-allow-headers", "Accept, Content-Type");
    const varyValue = headers.get("vary");
    headers.set("vary", varyValue ? `${varyValue}, Origin` : "Origin");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function readClientIp(request){
  const cf = cleanText(request.headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const forwarded = cleanText(request.headers.get("x-forwarded-for"));
  if (!forwarded) return "";
  return cleanText(forwarded.split(",")[0]);
}

function withinRateLimit(request, scope){
  const ip = readClientIp(request);
  if (!ip) return true;
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS){
    rateBuckets.set(key, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_WINDOW){
    return false;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return true;
}

function asFiniteNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapWeatherCurrent(payload){
  const src = payload && typeof payload === "object" ? payload : {};
  const weather = Array.isArray(src.weather) ? src.weather[0] : null;
  const rain1h = asFiniteNumber(src?.rain?.["1h"]) || 0;
  const snow1h = asFiniteNumber(src?.snow?.["1h"]) || 0;
  const precipSignal = Math.max(rain1h, snow1h) > 0 ? Math.min(1, Math.max(rain1h, snow1h) / 5) : 0;
  return {
    tempF: asFiniteNumber(src?.main?.temp),
    feelsLikeF: asFiniteNumber(src?.main?.feels_like),
    condition: cleanText(weather?.main || weather?.description) || "Unknown",
    description: cleanText(weather?.description),
    windMph: asFiniteNumber(src?.wind?.speed),
    precipSignal,
    precipChance: 0,
  };
}

function summarizeForecast3d(forecastPayload){
  const src = forecastPayload && typeof forecastPayload === "object" ? forecastPayload : {};
  const rows = Array.isArray(src.list) ? src.list : [];
  const byDay = new Map();

  for (const row of rows){
    const dt = asFiniteNumber(row?.dt);
    if (dt == null || dt <= 0) continue;
    const date = new Date(dt * 1000);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(row);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const keys = Array.from(byDay.keys()).sort().filter((key) => key > todayKey).slice(0, 3);

  return keys.map((key) => {
    const rowsForDay = byDay.get(key) || [];
    const highs = rowsForDay.map((row) => asFiniteNumber(row?.main?.temp_max)).filter((value) => value != null);
    const lows = rowsForDay.map((row) => asFiniteNumber(row?.main?.temp_min)).filter((value) => value != null);
    const winds = rowsForDay.map((row) => asFiniteNumber(row?.wind?.speed)).filter((value) => value != null);
    const pops = rowsForDay.map((row) => asFiniteNumber(row?.pop)).filter((value) => value != null);
    const weather = rowsForDay.find((row) => Array.isArray(row?.weather) && row.weather[0])?.weather?.[0] || null;
    return {
      dayLabel: new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      date: key,
      condition: cleanText(weather?.main || weather?.description) || "Unknown",
      tempHighF: highs.length ? Math.max(...highs) : null,
      tempLowF: lows.length ? Math.min(...lows) : null,
      precipChance: pops.length ? Math.max(...pops) : 0,
      windMph: winds.length ? Math.max(...winds) : null,
    };
  });
}

async function fetchJsonUpstream(url){
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response?.ok){
    const status = response?.status || 502;
    let text = "";
    try {
      text = cleanText(await response.text());
    } catch {}
    return {
      ok: false,
      status,
      message: text || `Upstream request failed (${status}).`,
    };
  }

  try {
    const payload = await response.json();
    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Upstream response was not valid JSON.",
    };
  }
}

async function handleWeatherRequest(request, url, env){
  if (!withinRateLimit(request, "weather")){
    return errorResponse(429, "rate_limited", "Too many requests. Please retry shortly.");
  }

  const zip = cleanText(url.searchParams.get("zip")).replace(/\D+/g, "").slice(0, 5);
  if (zip.length !== 5){
    return errorResponse(400, "invalid_zip", "ZIP must be 5 digits.");
  }

  const apiKey = cleanText(env.OPENWEATHER_API_KEY);
  if (!apiKey){
    return errorResponse(500, "weather_key_missing", "Weather proxy is not configured.");
  }

  const currentUrl = `${OPENWEATHER_BASE_URL}/weather?zip=${encodeURIComponent(zip)},US&appid=${encodeURIComponent(apiKey)}&units=imperial`;
  const forecastUrl = `${OPENWEATHER_BASE_URL}/forecast?zip=${encodeURIComponent(zip)},US&appid=${encodeURIComponent(apiKey)}&units=imperial`;

  const [currentOut, forecastOut] = await Promise.all([
    fetchJsonUpstream(currentUrl),
    fetchJsonUpstream(forecastUrl),
  ]);

  if (!currentOut.ok){
    if (Number(currentOut.status) === 403){
      return errorResponse(403, "UPSTREAM_FORBIDDEN", "Weather provider rejected the request (403).");
    }
    return errorResponse(502, "UPSTREAM_ERROR", `Current weather request failed: ${currentOut.message}`);
  }
  if (!forecastOut.ok){
    if (Number(forecastOut.status) === 403){
      return errorResponse(403, "UPSTREAM_FORBIDDEN", "Weather provider rejected the forecast request (403).");
    }
    return errorResponse(502, "UPSTREAM_ERROR", `Forecast request failed: ${forecastOut.message}`);
  }

  const current = mapWeatherCurrent(currentOut.payload);
  const forecast3d = summarizeForecast3d(forecastOut.payload);

  return jsonResponse({
    ok: true,
    zip,
    fetchedAt: new Date().toISOString(),
    current,
    forecast3d,
    fetchStatus: "ok",
    source: "openweathermap",
  }, 200, { "cache-control": "public, max-age=180" });
}

export default {
  async fetch(request, env){
    if (request.method === "OPTIONS"){
      return withCors(new Response(null, {
        status: 204,
        headers: {
          [PROXY_MARKER_HEADER]: PROXY_MARKER_VALUE,
        },
      }), request, env);
    }
    if (request.method !== "GET"){
      return withCors(errorResponse(405, "method_not_allowed", "Only GET is supported."), request, env);
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (path === "/api/health"){
      return withCors(jsonResponse({
        ok: true,
        code: "PROXY_OK",
        service: "weather",
        fetchedAt: new Date().toISOString(),
      }), request, env);
    }

    if (path === "/api/weather"){
      return withCors(await handleWeatherRequest(request, url, env), request, env);
    }

    return withCors(errorResponse(404, "not_found", "Unknown API route."), request, env);
  },
};
