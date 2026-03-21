// @ts-check

import { clone, ensureCanonicalState } from "./_core.js";

export function selectWeatherRiskCanonicalView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const weather = canonical.domains?.weatherRisk || {};

  return {
    revision: Number(weather.revision || 0),
    officeZip: weather.officeZip || "",
    overrideZip: weather.overrideZip || "",
    useOverrideZip: !!weather.useOverrideZip,
    selectedZip: weather.selectedZip || "",
    adjustment: clone(weather.adjustment || {}),
  };
}

