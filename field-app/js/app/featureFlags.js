const ALLOWED_MC_DISTRIBUTIONS = new Set(["triangular", "uniform", "normal"]);

function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeDistribution(v, fallback = "triangular"){
  const next = String(v || "").trim().toLowerCase();
  return ALLOWED_MC_DISTRIBUTIONS.has(next) ? next : fallback;
}

export function makeDefaultFeatureFlags(){
  return {
    turnout: { modelingEnabled: false },
    timeline: { enabled: false },
    universe: { weightingEnabled: false },
    risk: {
      mcDistribution: "triangular",
      correlatedShocks: false,
      shockScenariosEnabled: true,
    },
    capacity: { decayEnabled: false },
  };
}

export function normalizeFeatureFlags(raw){
  const base = makeDefaultFeatureFlags();
  const inObj = isObject(raw) ? raw : {};
  const out = {
    ...base,
    ...inObj,
    turnout: { ...base.turnout, ...(isObject(inObj.turnout) ? inObj.turnout : {}) },
    timeline: { ...base.timeline, ...(isObject(inObj.timeline) ? inObj.timeline : {}) },
    universe: { ...base.universe, ...(isObject(inObj.universe) ? inObj.universe : {}) },
    risk: { ...base.risk, ...(isObject(inObj.risk) ? inObj.risk : {}) },
    capacity: { ...base.capacity, ...(isObject(inObj.capacity) ? inObj.capacity : {}) },
  };
  out.turnout.modelingEnabled = !!out.turnout.modelingEnabled;
  out.timeline.enabled = !!out.timeline.enabled;
  out.universe.weightingEnabled = !!out.universe.weightingEnabled;
  out.risk.mcDistribution = normalizeDistribution(out.risk.mcDistribution, base.risk.mcDistribution);
  out.risk.correlatedShocks = !!out.risk.correlatedShocks;
  out.risk.shockScenariosEnabled = !!out.risk.shockScenariosEnabled;
  out.capacity.decayEnabled = !!out.capacity.decayEnabled;
  return out;
}

function ensureIntelContainers(state){
  if (!isObject(state.intelState)) state.intelState = { version: "1.0.0" };
  if (!isObject(state.intelState.simToggles)) state.intelState.simToggles = {};
  if (!isObject(state.intelState.expertToggles)) state.intelState.expertToggles = {};
}

function writeFeaturesFromLegacy(state){
  if (!isObject(state)) return;
  const f = normalizeFeatureFlags(state.features);
  const hasTurnout = typeof state.turnoutEnabled === "boolean";
  const hasTimeline = typeof state.timelineEnabled === "boolean";
  const hasUniverse = typeof state.universeLayerEnabled === "boolean";

  f.turnout.modelingEnabled = hasTurnout ? !!state.turnoutEnabled : f.turnout.modelingEnabled;
  f.timeline.enabled = hasTimeline ? !!state.timelineEnabled : f.timeline.enabled;
  f.universe.weightingEnabled = hasUniverse ? !!state.universeLayerEnabled : f.universe.weightingEnabled;

  const sim = state?.intelState?.simToggles;
  const expert = state?.intelState?.expertToggles;
  f.risk.mcDistribution = normalizeDistribution(sim?.mcDistribution, f.risk.mcDistribution);
  if (typeof sim?.correlatedShocks === "boolean") f.risk.correlatedShocks = !!sim.correlatedShocks;
  if (typeof sim?.shockScenariosEnabled === "boolean") f.risk.shockScenariosEnabled = !!sim.shockScenariosEnabled;
  if (typeof expert?.capacityDecayEnabled === "boolean") f.capacity.decayEnabled = !!expert.capacityDecayEnabled;

  state.features = f;
}

function writeLegacyFromFeatures(state){
  if (!isObject(state)) return;
  const f = normalizeFeatureFlags(state.features);
  state.features = f;

  state.turnoutEnabled = !!f.turnout.modelingEnabled;
  state.timelineEnabled = !!f.timeline.enabled;
  state.universeLayerEnabled = !!f.universe.weightingEnabled;

  ensureIntelContainers(state);
  state.intelState.simToggles.mcDistribution = normalizeDistribution(
    f.risk.mcDistribution,
    state.intelState.simToggles.mcDistribution || "triangular"
  );
  state.intelState.simToggles.correlatedShocks = !!f.risk.correlatedShocks;
  state.intelState.simToggles.shockScenariosEnabled = !!f.risk.shockScenariosEnabled;
  state.intelState.expertToggles.capacityDecayEnabled = !!f.capacity.decayEnabled;
}

export function syncFeatureFlagsFromState(state, { preferFeatures = false } = {}){
  if (!isObject(state)) return makeDefaultFeatureFlags();
  const hasFeaturesInput = isObject(state.features);
  state.features = normalizeFeatureFlags(state.features);
  if (preferFeatures && hasFeaturesInput){
    writeLegacyFromFeatures(state);
    return state.features;
  }
  writeFeaturesFromLegacy(state);
  writeLegacyFromFeatures(state);
  return state.features;
}

