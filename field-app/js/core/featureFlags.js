// js/core/featureFlags.js
// Read-only feature resolution for core compute modules.
// Preference: state.features (if present) with legacy fallback fields.
// @ts-check

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const ALLOWED_MC_DISTRIBUTIONS = new Set(["triangular", "uniform", "normal"]);

function resolveBool(primary, fallback){
  if (typeof primary === "boolean") return primary;
  if (typeof fallback === "boolean") return fallback;
  return false;
}

function resolveDistribution(primary, fallback){
  const p = String(primary || "").trim().toLowerCase();
  if (ALLOWED_MC_DISTRIBUTIONS.has(p)) return p;
  const f = String(fallback || "").trim().toLowerCase();
  if (ALLOWED_MC_DISTRIBUTIONS.has(f)) return f;
  return "triangular";
}

/**
 * @param {Record<string, any>|null|undefined} state
 * @returns {{
 *   turnoutModelingEnabled:boolean,
 *   timelineEnabled:boolean,
 *   universeWeightingEnabled:boolean,
 *   mcDistribution:"triangular"|"uniform"|"normal",
 *   correlatedShocks:boolean,
 *   shockScenariosEnabled:boolean,
 *   capacityDecayEnabled:boolean
 * }}
 */
export function resolveFeatureFlags(state){
  const s = isObject(state) ? state : {};
  const f = isObject(s.features) ? s.features : {};
  const turnout = isObject(f.turnout) ? f.turnout : {};
  const timeline = isObject(f.timeline) ? f.timeline : {};
  const universe = isObject(f.universe) ? f.universe : {};
  const risk = isObject(f.risk) ? f.risk : {};
  const capacity = isObject(f.capacity) ? f.capacity : {};
  const sim = isObject(s?.intelState?.simToggles) ? s.intelState.simToggles : {};
  const expert = isObject(s?.intelState?.expertToggles) ? s.intelState.expertToggles : {};

  return {
    turnoutModelingEnabled: resolveBool(turnout.modelingEnabled, s.turnoutEnabled),
    timelineEnabled: resolveBool(timeline.enabled, s.timelineEnabled),
    universeWeightingEnabled: resolveBool(universe.weightingEnabled, s.universeLayerEnabled),
    mcDistribution: resolveDistribution(risk.mcDistribution, sim.mcDistribution),
    correlatedShocks: resolveBool(risk.correlatedShocks, sim.correlatedShocks),
    shockScenariosEnabled: resolveBool(risk.shockScenariosEnabled, sim.shockScenariosEnabled),
    capacityDecayEnabled: resolveBool(capacity.decayEnabled, expert.capacityDecayEnabled),
  };
}
