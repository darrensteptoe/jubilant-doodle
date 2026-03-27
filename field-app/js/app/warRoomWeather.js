// @ts-check
import {
  WEATHER_MODE_OBSERVE_ONLY,
  WEATHER_MODE_TODAY_ONLY,
  deriveTodayOnlyModifiers,
  deriveWeatherRisk,
  isTodayOnlyAdjustmentActive,
  normalizeZip,
  resolveSelectedZip,
  summarizeThreeDayForecast,
} from "./weatherRiskRules.js";

const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";
const WEATHER_KEY_REQUIRED_ERROR = "Weather API key missing. Enter a key and refresh weather.";
const WEATHER_NON_JSON_ERROR = "Weather API returned HTML instead of JSON. Check API key and request path.";

function isJsonContentType(response){
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  return contentType.includes("application/json") || contentType.includes("+json");
}

export function makeDefaultWarRoomState(){
  return {
    weather: {
      apiKey: "",
      officeZip: "",
      overrideZip: "",
      useOverrideZip: false,
      selectedZip: "",
      status: "idle",
      error: "",
      fetchedAt: "",
      current: null,
      forecast3d: [],
      fieldExecutionRisk: "low",
      electionDayTurnoutRisk: "low",
      recommendedAction: "Set a ZIP to load weather context.",
      precipSignal: 0,
    },
    weatherAdjustment: {
      enabled: false,
      mode: WEATHER_MODE_OBSERVE_ONLY,
      date: "",
      zip: "",
      modifiers: {
        doorEfficiencyMultiplier: 1,
        volunteerShowRateMultiplier: 1,
        electionDayTurnoutRiskBump: 0,
      },
      appliedAt: "",
    },
    weatherAdjustmentLog: [],
  };
}

function pushWeatherLog(state, row){
  if (!state || typeof state !== "object") return;
  if (!Array.isArray(state.weatherAdjustmentLog)){
    state.weatherAdjustmentLog = [];
  }
  state.weatherAdjustmentLog.unshift({
    at: new Date().toISOString(),
    action: String(row?.action || "update"),
    mode: String(row?.mode || ""),
    zip: String(row?.zip || ""),
    note: String(row?.note || ""),
  });
  if (state.weatherAdjustmentLog.length > 60){
    state.weatherAdjustmentLog.length = 60;
  }
}

export function ensureWarRoomStateShape(state, { nowDate = new Date() } = {}){
  if (!state || typeof state !== "object"){
    return makeDefaultWarRoomState();
  }
  if (!state.warRoom || typeof state.warRoom !== "object"){
    state.warRoom = makeDefaultWarRoomState();
  }
  const defaults = makeDefaultWarRoomState();
  state.warRoom.weather = {
    ...defaults.weather,
    ...(state.warRoom.weather && typeof state.warRoom.weather === "object" ? state.warRoom.weather : {}),
  };
  state.warRoom.weather.apiKey = String(state.warRoom.weather.apiKey || "").trim();
  state.warRoom.weather.officeZip = normalizeZip(state.warRoom.weather.officeZip);
  state.warRoom.weather.overrideZip = normalizeZip(state.warRoom.weather.overrideZip);
  state.warRoom.weather.selectedZip = normalizeZip(state.warRoom.weather.selectedZip);
  state.warRoom.weather.useOverrideZip = !!state.warRoom.weather.useOverrideZip;
  if (!Array.isArray(state.warRoom.weather.forecast3d)){
    state.warRoom.weather.forecast3d = [];
  }

  state.warRoom.weatherAdjustment = {
    ...defaults.weatherAdjustment,
    ...(state.warRoom.weatherAdjustment && typeof state.warRoom.weatherAdjustment === "object" ? state.warRoom.weatherAdjustment : {}),
  };
  const adj = state.warRoom.weatherAdjustment;
  if (String(adj.mode || "") !== WEATHER_MODE_TODAY_ONLY){
    adj.mode = WEATHER_MODE_OBSERVE_ONLY;
  }
  if (!adj.enabled){
    adj.mode = WEATHER_MODE_OBSERVE_ONLY;
  }
  if (!adj.modifiers || typeof adj.modifiers !== "object"){
    adj.modifiers = { ...defaults.weatherAdjustment.modifiers };
  }
  adj.zip = normalizeZip(adj.zip);
  if (!Array.isArray(state.warRoom.weatherAdjustmentLog)){
    state.warRoom.weatherAdjustmentLog = [];
  }

  const today = new Date(nowDate).toISOString().slice(0, 10);
  if (adj.enabled && adj.mode === WEATHER_MODE_TODAY_ONLY && String(adj.date || "") !== today){
    adj.enabled = false;
    adj.mode = WEATHER_MODE_OBSERVE_ONLY;
    pushWeatherLog(state.warRoom, {
      action: "auto_expire",
      mode: WEATHER_MODE_OBSERVE_ONLY,
      zip: adj.zip,
      note: "Today-only weather adjustment expired.",
    });
  }

  state.warRoom.weather.selectedZip = resolveSelectedZip(state.warRoom.weather);
  return state.warRoom;
}

function mapCurrentPayload(payload){
  const src = payload && typeof payload === "object" ? payload : {};
  const weather = Array.isArray(src.weather) ? src.weather[0] : null;
  const rain1h = Number(src?.rain?.["1h"] || 0) || 0;
  const snow1h = Number(src?.snow?.["1h"] || 0) || 0;
  const precipSignal = Math.max(rain1h, snow1h) > 0 ? Math.min(1, Math.max(rain1h, snow1h) / 5) : 0;
  return {
    tempF: Number.isFinite(Number(src?.main?.temp)) ? Number(src.main.temp) : null,
    feelsLikeF: Number.isFinite(Number(src?.main?.feels_like)) ? Number(src.main.feels_like) : null,
    condition: String(weather?.main || weather?.description || "").trim() || "Unknown",
    description: String(weather?.description || "").trim() || "",
    windMph: Number.isFinite(Number(src?.wind?.speed)) ? Number(src.wind.speed) : null,
    precipSignal,
    precipChance: 0,
  };
}

function groupForecastIntoDays(forecastPayload){
  const src = forecastPayload && typeof forecastPayload === "object" ? forecastPayload : {};
  const rows = Array.isArray(src.list) ? src.list : [];
  const bucket = new Map();
  for (const row of rows){
    const dt = Number(row?.dt || 0);
    if (!Number.isFinite(dt) || dt <= 0) continue;
    const date = new Date(dt * 1000);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    if (!bucket.has(key)){
      bucket.set(key, []);
    }
    bucket.get(key).push(row);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const dayKeys = Array.from(bucket.keys()).sort().filter((key) => key > todayKey).slice(0, 3);

  const days = dayKeys.map((key) => {
    const rowsForDay = bucket.get(key) || [];
    const highs = rowsForDay
      .map((row) => Number(row?.main?.temp_max))
      .filter((value) => Number.isFinite(value));
    const lows = rowsForDay
      .map((row) => Number(row?.main?.temp_min))
      .filter((value) => Number.isFinite(value));
    const winds = rowsForDay
      .map((row) => Number(row?.wind?.speed))
      .filter((value) => Number.isFinite(value));
    const pops = rowsForDay
      .map((row) => Number(row?.pop))
      .filter((value) => Number.isFinite(value));
    const firstWeather = rowsForDay.find((row) => Array.isArray(row?.weather) && row.weather[0])?.weather?.[0] || null;
    return {
      dayLabel: new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      date: key,
      condition: String(firstWeather?.main || firstWeather?.description || "").trim() || "Unknown",
      tempHighF: highs.length ? Math.max(...highs) : null,
      tempLowF: lows.length ? Math.min(...lows) : null,
      precipChance: pops.length ? Math.max(...pops) : 0,
      windMph: winds.length ? Math.max(...winds) : null,
    };
  });

  return summarizeThreeDayForecast(days);
}

function normalizeUpstreamStatusCode(responsePayload, fallbackStatus){
  const payloadCode = Number(responsePayload?.cod);
  if (Number.isFinite(payloadCode) && payloadCode >= 100){
    return payloadCode;
  }
  const status = Number(fallbackStatus);
  return Number.isFinite(status) && status >= 100 ? status : 0;
}

async function fetchWeatherUpstreamJson(url, fetchImpl){
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response?.ok){
    const status = Number(response?.status || 0);
    let message = "";
    try{
      const text = String(await response.text()).trim();
      if (text){
        message = text.length > 240 ? `${text.slice(0, 240)}…` : text;
      }
    } catch {}
    if (!message){
      message = String(response?.statusText || "Request failed");
    }
    return { ok: false, status, message };
  }
  if (!isJsonContentType(response)){
    return { ok: false, status: Number(response?.status || 0), message: WEATHER_NON_JSON_ERROR };
  }
  let payload = null;
  try{
    payload = await response.json();
  } catch {
    return { ok: false, status: Number(response?.status || 0), message: WEATHER_NON_JSON_ERROR };
  }
  const providerStatus = normalizeUpstreamStatusCode(payload, response?.status);
  if (providerStatus >= 400){
    return {
      ok: false,
      status: providerStatus,
      message: String(payload?.message || `Weather provider returned ${providerStatus}.`),
    };
  }
  return { ok: true, payload };
}

function weatherErrorCodeFromStatus(status){
  const normalized = Number(status);
  if (normalized === 401 || normalized === 403) return "weather_upstream_forbidden";
  if (normalized === 404) return "weather_upstream_not_found";
  if (normalized === 429) return "weather_upstream_rate_limited";
  return "weather_upstream_error";
}

export async function fetchWarRoomWeatherByZip(zip, {
  fetchImpl = globalThis?.fetch,
  apiKey = "",
} = {}){
  const normalizedZip = normalizeZip(zip);
  const normalizedApiKey = String(apiKey || "").trim();
  if (!normalizedZip){
    return { ok: false, code: "invalid_zip", message: "ZIP must be 5 digits." };
  }
  if (!normalizedApiKey){
    return { ok: false, code: "weather_key_missing", message: WEATHER_KEY_REQUIRED_ERROR };
  }
  if (typeof fetchImpl !== "function"){
    return { ok: false, code: "fetch_unavailable", message: "Weather fetch unavailable in this environment." };
  }
  const currentUrl = `${OPENWEATHER_BASE_URL}/weather?zip=${encodeURIComponent(normalizedZip)},US&appid=${encodeURIComponent(normalizedApiKey)}&units=imperial`;
  const forecastUrl = `${OPENWEATHER_BASE_URL}/forecast?zip=${encodeURIComponent(normalizedZip)},US&appid=${encodeURIComponent(normalizedApiKey)}&units=imperial`;
  const [currentResult, forecastResult] = await Promise.all([
    fetchWeatherUpstreamJson(currentUrl, fetchImpl),
    fetchWeatherUpstreamJson(forecastUrl, fetchImpl),
  ]);

  if (!currentResult.ok){
    const status = Number(currentResult?.status || 0);
    return {
      ok: false,
      code: weatherErrorCodeFromStatus(status),
      message: `Current weather request failed (${status || "unknown"}): ${String(currentResult?.message || "Request failed")}`,
    };
  }

  if (!forecastResult.ok){
    const status = Number(forecastResult?.status || 0);
    return {
      ok: false,
      code: weatherErrorCodeFromStatus(status),
      message: `Forecast request failed (${status || "unknown"}): ${String(forecastResult?.message || "Request failed")}`,
    };
  }

  const current = mapCurrentPayload(currentResult.payload);
  const forecast3d = groupForecastIntoDays(forecastResult.payload);
  const today = forecast3d[0] || null;
  const risk = deriveWeatherRisk({ current, today });

  return {
    ok: true,
    zip: normalizedZip,
    fetchedAt: new Date().toISOString(),
    current,
    forecast3d,
    risk,
  };
}

export function applyWeatherObservationToState(state, payload, { nowDate = new Date() } = {}){
  const warRoom = ensureWarRoomStateShape(state, { nowDate });
  const weather = warRoom.weather;
  const src = payload && typeof payload === "object" ? payload : {};

  weather.status = src.ok ? "ok" : "error";
  weather.error = src.ok ? "" : String(src.message || "Weather fetch failed.");
  weather.selectedZip = normalizeZip(src.zip || weather.selectedZip);
  weather.fetchedAt = src.ok ? String(src.fetchedAt || new Date().toISOString()) : weather.fetchedAt;
  weather.current = src.ok ? (src.current || null) : weather.current;
  weather.forecast3d = src.ok ? (Array.isArray(src.forecast3d) ? src.forecast3d : []) : weather.forecast3d;

  const risk = src.ok ? (src.risk || deriveWeatherRisk({ current: weather.current, today: weather.forecast3d?.[0] })) : null;
  weather.fieldExecutionRisk = String(risk?.fieldExecutionRisk || weather.fieldExecutionRisk || "low");
  weather.electionDayTurnoutRisk = String(risk?.electionDayTurnoutRisk || weather.electionDayTurnoutRisk || "low");
  weather.recommendedAction = String(risk?.recommendedAction || weather.recommendedAction || "Set a ZIP to load weather context.");
  weather.precipSignal = Number.isFinite(Number(risk?.precipSignal)) ? Number(risk.precipSignal) : Number(weather.precipSignal || 0);

  return warRoom;
}

export function applyWeatherModeToState(state, mode, { nowDate = new Date() } = {}){
  const warRoom = ensureWarRoomStateShape(state, { nowDate });
  const weather = warRoom.weather;
  const adjustment = warRoom.weatherAdjustment;
  const nextMode = String(mode || "").trim().toLowerCase() === WEATHER_MODE_TODAY_ONLY
    ? WEATHER_MODE_TODAY_ONLY
    : WEATHER_MODE_OBSERVE_ONLY;

  if (nextMode === WEATHER_MODE_OBSERVE_ONLY){
    adjustment.enabled = false;
    adjustment.mode = WEATHER_MODE_OBSERVE_ONLY;
    adjustment.date = "";
    adjustment.zip = resolveSelectedZip(weather);
    adjustment.modifiers = {
      doorEfficiencyMultiplier: 1,
      volunteerShowRateMultiplier: 1,
      electionDayTurnoutRiskBump: 0,
    };
    adjustment.appliedAt = new Date().toISOString();
    pushWeatherLog(warRoom, {
      action: "mode_change",
      mode: WEATHER_MODE_OBSERVE_ONLY,
      zip: adjustment.zip,
      note: "Observation-only mode enabled.",
    });
    return warRoom;
  }

  const selectedZip = resolveSelectedZip(weather);
  const risk = {
    fieldExecutionRisk: weather.fieldExecutionRisk,
    electionDayTurnoutRisk: weather.electionDayTurnoutRisk,
  };
  const next = deriveTodayOnlyModifiers({ risk, selectedZip, nowDate });
  adjustment.enabled = true;
  adjustment.mode = WEATHER_MODE_TODAY_ONLY;
  adjustment.date = next.date;
  adjustment.zip = next.zip;
  adjustment.modifiers = { ...next.modifiers };
  adjustment.appliedAt = new Date().toISOString();
  pushWeatherLog(warRoom, {
    action: "mode_change",
    mode: WEATHER_MODE_TODAY_ONLY,
    zip: adjustment.zip,
    note: "Today-only weather adjustment enabled.",
  });
  return warRoom;
}

export function buildWarRoomWeatherView(state, { nowDate = new Date() } = {}){
  const warRoom = ensureWarRoomStateShape(state, { nowDate });
  const weather = warRoom.weather;
  const adjustment = warRoom.weatherAdjustment;
  const selectedZip = resolveSelectedZip(weather);
  const adjustmentActive = isTodayOnlyAdjustmentActive(adjustment, nowDate);
  const todayDate = new Date(nowDate).toISOString().slice(0, 10);
  return {
    apiKey: String(weather.apiKey || ""),
    officeZip: weather.officeZip,
    overrideZip: weather.overrideZip,
    useOverrideZip: !!weather.useOverrideZip,
    selectedZip,
    status: String(weather.status || "idle"),
    error: String(weather.error || ""),
    fetchedAt: String(weather.fetchedAt || ""),
    current: weather.current || null,
    forecast3d: Array.isArray(weather.forecast3d) ? weather.forecast3d.slice(0, 3) : [],
    fieldExecutionRisk: String(weather.fieldExecutionRisk || "low"),
    electionDayTurnoutRisk: String(weather.electionDayTurnoutRisk || "low"),
    recommendedAction: String(weather.recommendedAction || ""),
    precipSignal: Number(weather.precipSignal || 0) || 0,
    mode: adjustmentActive ? WEATHER_MODE_TODAY_ONLY : WEATHER_MODE_OBSERVE_ONLY,
    adjustmentActive,
    adjustmentDate: String(adjustment.date || ""),
    adjustmentExpired: !!adjustment.enabled && String(adjustment.date || "") !== todayDate,
    modifiers: adjustment.modifiers || {
      doorEfficiencyMultiplier: 1,
      volunteerShowRateMultiplier: 1,
      electionDayTurnoutRiskBump: 0,
    },
    adjustmentLog: Array.isArray(warRoom.weatherAdjustmentLog) ? warRoom.weatherAdjustmentLog.slice(0, 12) : [],
  };
}
