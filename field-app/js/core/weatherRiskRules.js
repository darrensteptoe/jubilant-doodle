// @ts-check

export const WEATHER_MODE_OBSERVE_ONLY = "observe_only";
export const WEATHER_MODE_TODAY_ONLY = "today_only";

export function normalizeZip(raw){
  const digits = String(raw || "").replace(/\D+/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "";
}

export function resolveSelectedZip(weatherState = {}){
  const officeZip = normalizeZip(weatherState?.officeZip);
  const overrideZip = normalizeZip(weatherState?.overrideZip);
  const useOverrideZip = !!weatherState?.useOverrideZip;
  if (useOverrideZip && overrideZip){
    return overrideZip;
  }
  return officeZip || "";
}

function percentileToSignal(pop){
  const value = Number(pop);
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function classifyRiskScore(score){
  if (score >= 6) return "high";
  if (score >= 3) return "moderate";
  return "low";
}

function quickRiskBadge(score){
  if (score >= 7) return "High risk";
  if (score >= 4) return "Moderate risk";
  return "Low risk";
}

export function deriveWeatherRisk({
  current = null,
  today = null,
} = {}){
  const src = current && typeof current === "object" ? current : {};
  const todaySrc = today && typeof today === "object" ? today : {};

  const windMph = Number(src.windMph ?? todaySrc.windMph ?? 0) || 0;
  const precipChance = Number(todaySrc.precipChance ?? src.precipChance ?? 0) || 0;
  const precipSignal = Number(src.precipSignal ?? todaySrc.precipSignal ?? 0) || 0;
  const condition = String(src.condition || todaySrc.condition || "").toLowerCase();
  const tempF = Number(src.tempF ?? 0) || 0;

  let fieldScore = 0;
  let turnoutScore = 0;

  if (windMph >= 20) fieldScore += 2;
  else if (windMph >= 12) fieldScore += 1;

  if (precipChance >= 0.6 || precipSignal >= 0.6) {
    fieldScore += 3;
    turnoutScore += 2;
  } else if (precipChance >= 0.3 || precipSignal >= 0.3){
    fieldScore += 1;
    turnoutScore += 1;
  }

  if (/thunder|storm|snow|sleet|freezing/.test(condition)){
    fieldScore += 2;
    turnoutScore += 2;
  } else if (/rain|drizzle|shower/.test(condition)){
    fieldScore += 1;
    turnoutScore += 1;
  }

  if (tempF <= 20 || tempF >= 95){
    fieldScore += 1;
    turnoutScore += 1;
  }

  const fieldExecutionRisk = classifyRiskScore(fieldScore);
  const electionDayTurnoutRisk = classifyRiskScore(turnoutScore);

  let recommendedAction = "Operate normal field plan; monitor weather each shift.";
  if (fieldExecutionRisk === "moderate" || electionDayTurnoutRisk === "moderate"){
    recommendedAction = "Tighten route plans, confirm volunteer comms, and keep backup indoor contact plan ready.";
  }
  if (fieldExecutionRisk === "high" || electionDayTurnoutRisk === "high"){
    recommendedAction = "Shift to weather-resilient channels for today, reduce door expectations, and escalate turnout mitigation.";
  }

  return {
    fieldExecutionRisk,
    electionDayTurnoutRisk,
    recommendedAction,
    precipSignal: Math.max(precipSignal, precipChance),
  };
}

export function deriveTodayOnlyModifiers({
  risk = null,
  selectedZip = "",
  nowDate = new Date(),
} = {}){
  const riskView = risk && typeof risk === "object" ? risk : {};
  const fieldRisk = String(riskView.fieldExecutionRisk || "low");
  const turnoutRisk = String(riskView.electionDayTurnoutRisk || "low");

  let doorEfficiencyMultiplier = 1;
  let volunteerShowRateMultiplier = 1;
  let electionDayTurnoutRiskBump = 0;

  if (fieldRisk === "moderate" || turnoutRisk === "moderate"){
    doorEfficiencyMultiplier = 0.92;
    volunteerShowRateMultiplier = 0.94;
    electionDayTurnoutRiskBump = 0.02;
  }
  if (fieldRisk === "high" || turnoutRisk === "high"){
    doorEfficiencyMultiplier = 0.82;
    volunteerShowRateMultiplier = 0.88;
    electionDayTurnoutRiskBump = 0.06;
  }

  const isoDate = new Date(nowDate);
  const date = Number.isNaN(isoDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : isoDate.toISOString().slice(0, 10);

  return {
    enabled: true,
    date,
    zip: normalizeZip(selectedZip),
    mode: WEATHER_MODE_TODAY_ONLY,
    modifiers: {
      doorEfficiencyMultiplier,
      volunteerShowRateMultiplier,
      electionDayTurnoutRiskBump,
    },
  };
}

export function isTodayOnlyAdjustmentActive(adjustment = null, nowDate = new Date()){
  const src = adjustment && typeof adjustment === "object" ? adjustment : {};
  if (!src.enabled) return false;
  if (String(src.mode || "") !== WEATHER_MODE_TODAY_ONLY) return false;
  const today = new Date(nowDate).toISOString().slice(0, 10);
  return String(src.date || "") === today;
}

export function summarizeThreeDayForecast(days = []){
  const list = Array.isArray(days) ? days : [];
  return list.slice(0, 3).map((day) => {
    const src = day && typeof day === "object" ? day : {};
    const precipChance = percentileToSignal(src.precipChance);
    let score = 0;
    const wind = Number(src.windMph || 0) || 0;
    if (wind >= 20) score += 2;
    else if (wind >= 12) score += 1;
    if (precipChance >= 0.6) score += 3;
    else if (precipChance >= 0.3) score += 1;
    if (/storm|snow|sleet|thunder/.test(String(src.condition || "").toLowerCase())) score += 2;
    else if (/rain|drizzle|shower/.test(String(src.condition || "").toLowerCase())) score += 1;

    return {
      dayLabel: String(src.dayLabel || "—"),
      condition: String(src.condition || "—"),
      tempHighF: Number.isFinite(Number(src.tempHighF)) ? Number(src.tempHighF) : null,
      tempLowF: Number.isFinite(Number(src.tempLowF)) ? Number(src.tempLowF) : null,
      precipChance,
      precipSignal: precipChance,
      windMph: Number.isFinite(Number(src.windMph)) ? Number(src.windMph) : null,
      riskBadge: quickRiskBadge(score),
    };
  });
}
