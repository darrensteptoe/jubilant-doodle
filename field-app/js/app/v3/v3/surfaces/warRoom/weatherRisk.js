import { formatFixedNumber, roundWholeNumberByMode } from "../../../../core/utils.js";

export function syncWarRoomWeatherRisk(view, helpers = {}) {
  const {
    syncInput,
    syncSelectValue,
    setChecked,
    setDisabled,
    setText,
  } = helpers;

  if (
    typeof syncInput !== "function"
    || typeof syncSelectValue !== "function"
    || typeof setChecked !== "function"
    || typeof setDisabled !== "function"
    || typeof setText !== "function"
  ) {
    return;
  }

  const warRoom = view.warRoom || {};
  const weather = warRoom.weather || {};
  const hasSession = !!view.session;

  syncInput("v3DecisionWeatherOfficeZip", weather.officeZip || "");
  syncInput("v3DecisionWeatherOverrideZip", weather.overrideZip || "");
  syncSelectValue("v3DecisionWeatherMode", weather.mode || "observe_only");
  setChecked("v3DecisionWeatherUseOverride", !!weather.useOverrideZip);

  setDisabled("v3DecisionWeatherOfficeZip", !hasSession);
  setDisabled("v3DecisionWeatherOverrideZip", !hasSession);
  setDisabled("v3DecisionWeatherUseOverride", !hasSession);
  setDisabled("v3DecisionWeatherMode", !hasSession);
  setDisabled("v3BtnDecisionWeatherRefresh", !hasSession);

  setText("v3DecisionWeatherStatus", weather.error ? weather.error : (weather.status || "idle"));
  setText("v3DecisionWeatherFieldRisk", weather.fieldExecutionRisk || "—");
  setText("v3DecisionWeatherTurnoutRisk", weather.electionDayTurnoutRisk || "—");
  setText("v3DecisionWeatherZip", weather.selectedZip || "—");
  setText("v3DecisionWeatherTemp", formatWeatherTempText(weather.current));
  setText("v3DecisionWeatherCondition", formatWeatherConditionText(weather.current));
  setText("v3DecisionWeatherPrecip", formatWeatherPrecipText(weather));
  setText("v3DecisionWeatherRecommendedAction", weather.recommendedAction || "—");
  setText("v3DecisionWeatherAdjustmentBanner", buildWeatherAdjustmentBanner(weather));

  renderWarRoomWeatherForecastRows(weather.forecast3d || []);
}

export function bindWarRoomWeatherRiskEvents(context = {}) {
  const {
    run,
    on,
    valueOf,
    checkedOf,
  } = context;

  if (
    typeof run !== "function"
    || typeof on !== "function"
    || typeof valueOf !== "function"
    || typeof checkedOf !== "function"
  ) {
    return;
  }

  on("v3DecisionWeatherOfficeZip", "input", () => run((api) => api.setWeatherField?.("officeZip", valueOf("v3DecisionWeatherOfficeZip"))));
  on("v3DecisionWeatherOverrideZip", "input", () => run((api) => api.setWeatherField?.("overrideZip", valueOf("v3DecisionWeatherOverrideZip"))));
  on("v3DecisionWeatherUseOverride", "change", () => run((api) => api.setWeatherField?.("useOverrideZip", checkedOf("v3DecisionWeatherUseOverride"))));
  on("v3DecisionWeatherMode", "change", () => run((api) => api.setWeatherMode?.(valueOf("v3DecisionWeatherMode"))));
  on("v3BtnDecisionWeatherRefresh", "click", () => run((api) => api.refreshWeather?.()));
}

export function renderWarRoomWeatherForecastRows(rows) {
  const body = document.getElementById("v3DecisionWeatherForecastTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted" colspan="6">No forecast loaded.</td></tr>';
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");
    const day = document.createElement("td");
    day.textContent = String(row?.dayLabel || "—");
    const condition = document.createElement("td");
    condition.textContent = String(row?.condition || "—");
    const temp = document.createElement("td");
    temp.className = "num";
    const hi = formatWeatherWholeNumber(row?.tempHighF, "F");
    const lo = formatWeatherWholeNumber(row?.tempLowF, "F");
    temp.textContent = `${hi} / ${lo}`;
    const precip = document.createElement("td");
    precip.className = "num";
    precip.textContent = formatWeatherPercent01(row?.precipChance);
    const wind = document.createElement("td");
    wind.className = "num";
    wind.textContent = formatWeatherWholeNumber(row?.windMph, " mph");
    const risk = document.createElement("td");
    risk.textContent = String(row?.riskBadge || "—");
    tr.append(day, condition, temp, precip, wind, risk);
    body.appendChild(tr);
  });
}

function formatWeatherWholeNumber(value, suffix = "") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: null });
  if (rounded == null) return "—";
  return `${rounded}${suffix}`;
}

function formatWeatherPercent01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = roundWholeNumberByMode(n * 100, { mode: "round", fallback: null });
  if (rounded == null) return "—";
  return `${rounded}%`;
}

function formatWeatherTempText(current) {
  const src = current && typeof current === "object" ? current : {};
  const temp = formatWeatherWholeNumber(src?.tempF, "F");
  const feels = formatWeatherWholeNumber(src?.feelsLikeF, "F");
  return `${temp} / ${feels}`;
}

function formatWeatherConditionText(current) {
  const src = current && typeof current === "object" ? current : {};
  const condition = String(src?.condition || "—");
  const wind = formatWeatherWholeNumber(src?.windMph, " mph");
  return `${condition} / ${wind}`;
}

function formatWeatherPrecipText(weather) {
  const src = weather && typeof weather === "object" ? weather : {};
  const precip = formatWeatherPercent01(src?.precipSignal);
  const fetched = String(src?.fetchedAt || "").trim();
  if (!fetched) {
    return `${precip} / not refreshed`;
  }
  return `${precip} / ${fetched}`;
}

function buildWeatherAdjustmentBanner(weather) {
  const src = weather && typeof weather === "object" ? weather : {};
  const mode = String(src?.mode || "observe_only");
  if (mode !== "today_only" || !src?.adjustmentActive) {
    return "Observation-only mode. No model modifiers are active.";
  }
  const mod = src?.modifiers && typeof src.modifiers === "object" ? src.modifiers : {};
  const d = Number(mod?.doorEfficiencyMultiplier || 1);
  const v = Number(mod?.volunteerShowRateMultiplier || 1);
  const t = Number(mod?.electionDayTurnoutRiskBump || 0);
  const date = String(src?.adjustmentDate || "today");
  const doors = formatFixedNumber(d, 2);
  const volunteer = formatFixedNumber(v, 2);
  const turnoutBump = formatFixedNumber(t * 100, 1);
  return `Today-only adjustment active (${date}): doors x${doors}, volunteer show-rate x${volunteer}, turnout risk +${turnoutBump} pts.`;
}
