// @ts-check

import { asArray, ensureCanonicalState, toFinite } from "./_core.js";

export function selectWeatherRiskDerivedView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const weather = canonical.domains?.weatherRisk || {};
  const forecast3d = asArray(weather.forecast3d);
  const precipValues = forecast3d.map((row) => toFinite(row?.precipProbability, null)).filter((v) => v != null);
  const maxPrecipProbability = precipValues.length ? Math.max(...precipValues) : null;

  return {
    status: {
      status: weather.status || "idle",
      error: weather.error || "",
      fetchedAt: weather.fetchedAt || "",
      selectedZip: weather.selectedZip || "",
    },
    riskSummary: {
      fieldExecutionRisk: weather.fieldExecutionRisk || "low",
      electionDayTurnoutRisk: weather.electionDayTurnoutRisk || "low",
      recommendedAction: weather.recommendedAction || "",
      precipSignal: toFinite(weather.precipSignal, 0) || 0,
      maxPrecipProbability,
    },
    forecastSummary: {
      forecastDays: forecast3d.length,
      hasCurrentObservation: !!weather.current,
      adjustmentLogCount: asArray(weather?.adjustment?.log).length,
      adjustmentMode: weather?.adjustment?.mode || "observe_only",
      adjustmentEnabled: !!weather?.adjustment?.enabled,
    },
  };
}

