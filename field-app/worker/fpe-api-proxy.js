const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";
const CENSUS_BASE_URL = "https://api.census.gov/data";

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

function safeYear(rawYear, { min, max, fallback } = {}){
  const text = cleanText(rawYear);
  if (!/^\d{4}$/.test(text)) return fallback;
  const year = Number(text);
  if (!Number.isFinite(year)) return fallback;
  if (Number.isFinite(min) && year < min) return fallback;
  if (Number.isFinite(max) && year > max) return fallback;
  return String(year);
}

function isSafeCensusClause(value){
  return /^[A-Za-z0-9_:\-*,(). ]+$/.test(value);
}

function validateCensusQuery(url){
  const getValue = cleanText(url.searchParams.get("get"));
  const forValue = cleanText(url.searchParams.get("for"));
  const inValues = url.searchParams.getAll("in").map((value) => cleanText(value)).filter((value) => !!value);

  if (!getValue || getValue.length > 900 || !isSafeCensusClause(getValue)){
    return { ok: false, code: "invalid_get", message: "Invalid Census get parameter." };
  }
  if (!forValue || forValue.length > 200 || !isSafeCensusClause(forValue)){
    return { ok: false, code: "invalid_for", message: "Invalid Census for parameter." };
  }
  if (inValues.length > 12){
    return { ok: false, code: "invalid_in_count", message: "Too many Census in parameters." };
  }
  for (const clause of inValues){
    if (clause.length > 220 || !isSafeCensusClause(clause)){
      return { ok: false, code: "invalid_in", message: "Invalid Census in parameter." };
    }
  }

  return {
    ok: true,
    getValue,
    forValue,
    inValues,
  };
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
    return errorResponse(502, "weather_fetch_failed", `Current weather request failed: ${currentOut.message}`);
  }
  if (!forecastOut.ok){
    return errorResponse(502, "forecast_fetch_failed", `Forecast request failed: ${forecastOut.message}`);
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

async function handleCensusAcsRequest(request, url, env){
  if (!withinRateLimit(request, "census")){
    return errorResponse(429, "rate_limited", "Too many requests. Please retry shortly.");
  }

  const validation = validateCensusQuery(url);
  if (!validation.ok){
    return errorResponse(400, validation.code, validation.message);
  }

  const currentYear = new Date().getUTCFullYear();
  const year = safeYear(url.searchParams.get("year"), {
    min: 2009,
    max: currentYear,
    fallback: String(Math.max(2009, currentYear - 2)),
  });

  const params = new URLSearchParams();
  params.set("get", validation.getValue);
  params.set("for", validation.forValue);
  for (const clause of validation.inValues){
    params.append("in", clause);
  }
  const censusKey = cleanText(env.CENSUS_API_KEY);
  if (censusKey){
    params.set("key", censusKey);
  }

  const upstreamUrl = `${CENSUS_BASE_URL}/${encodeURIComponent(year)}/acs/acs5?${params.toString()}`;
  const out = await fetchJsonUpstream(upstreamUrl);
  if (!out.ok){
    return errorResponse(502, "census_acs_failed", out.message);
  }
  return jsonResponse(out.payload, 200, { "cache-control": "public, max-age=180" });
}

async function handleCensusGeoRequest(request, url, env){
  if (!withinRateLimit(request, "census")){
    return errorResponse(429, "rate_limited", "Too many requests. Please retry shortly.");
  }

  const validation = validateCensusQuery(url);
  if (!validation.ok){
    return errorResponse(400, validation.code, validation.message);
  }

  const year = safeYear(url.searchParams.get("year"), {
    min: 2010,
    max: new Date().getUTCFullYear(),
    fallback: "2020",
  });

  const params = new URLSearchParams();
  params.set("get", validation.getValue);
  params.set("for", validation.forValue);
  for (const clause of validation.inValues){
    params.append("in", clause);
  }
  const censusKey = cleanText(env.CENSUS_API_KEY);
  if (censusKey){
    params.set("key", censusKey);
  }

  const upstreamUrl = `${CENSUS_BASE_URL}/${encodeURIComponent(year)}/dec/pl?${params.toString()}`;
  const out = await fetchJsonUpstream(upstreamUrl);
  if (!out.ok){
    return errorResponse(502, "census_geo_failed", out.message);
  }
  return jsonResponse(out.payload, 200, { "cache-control": "public, max-age=180" });
}

async function handleCensusVariablesRequest(request, url, env){
  if (!withinRateLimit(request, "census")){
    return errorResponse(429, "rate_limited", "Too many requests. Please retry shortly.");
  }

  const currentYear = new Date().getUTCFullYear();
  const year = safeYear(url.searchParams.get("year"), {
    min: 2009,
    max: currentYear,
    fallback: String(Math.max(2009, currentYear - 2)),
  });

  const params = new URLSearchParams();
  const censusKey = cleanText(env.CENSUS_API_KEY);
  if (censusKey){
    params.set("key", censusKey);
  }

  const suffix = params.toString();
  const upstreamUrl = `${CENSUS_BASE_URL}/${encodeURIComponent(year)}/acs/acs5/variables.json${suffix ? `?${suffix}` : ""}`;
  const out = await fetchJsonUpstream(upstreamUrl);
  if (!out.ok){
    return errorResponse(502, "census_variables_failed", out.message);
  }
  return jsonResponse(out.payload, 200, { "cache-control": "public, max-age=900" });
}

export default {
  async fetch(request, env){
    if (request.method !== "GET"){
      return errorResponse(405, "method_not_allowed", "Only GET is supported.");
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (path === "/api/weather"){
      return handleWeatherRequest(request, url, env);
    }
    if (path === "/api/census/acs"){
      return handleCensusAcsRequest(request, url, env);
    }
    if (path === "/api/census/geo"){
      return handleCensusGeoRequest(request, url, env);
    }
    if (path === "/api/census/variables"){
      return handleCensusVariablesRequest(request, url, env);
    }

    return errorResponse(404, "not_found", "Unknown API route.");
  },
};
