// js/core/intelState.js
// Scenario-scoped Intel metadata.
// This layer must not alter deterministic math or MC outputs.

export const INTEL_STATE_VERSION = "1.0.0";

const ALLOWED_MC_DISTRIBUTIONS = new Set(["triangular", "uniform", "normal"]);
const ALLOWED_DECAY_MODELS = new Set(["linear"]);

function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepClone(v){
  try{
    if (typeof structuredClone === "function") return structuredClone(v);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(v));
}

function clamp(n, min, max){
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function toFiniteNumber(v, fallback){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStringOrNull(v){
  if (v == null || v === "") return null;
  return String(v);
}

function toArray(v){
  return Array.isArray(v) ? v.slice() : [];
}

function normalizeCorrelationModel(row){
  if (!isObject(row)) return null;
  const refs = toArray(row.refs).map((v) => String(v)).filter(Boolean);
  const matrix = Array.isArray(row.matrix) ? row.matrix : null;
  if (!refs.length || !matrix || matrix.length !== refs.length) return null;
  const normalized = [];
  for (let i = 0; i < matrix.length; i++){
    const r = matrix[i];
    if (!Array.isArray(r) || r.length !== refs.length) return null;
    const nextRow = [];
    for (let j = 0; j < r.length; j++){
      const v = toFiniteNumber(r[j], null);
      if (v == null) return null;
      nextRow.push(clamp(v, -1, 1));
    }
    normalized.push(nextRow);
  }
  return {
    id: row.id ? String(row.id) : "",
    label: row.label ? String(row.label) : "",
    refs,
    matrix: normalized,
    notes: row.notes ? String(row.notes) : "",
  };
}

function normalizeShockScenario(row){
  if (!isObject(row)) return null;
  const id = row.id ? String(row.id) : "";
  const label = row.label ? String(row.label) : "";
  const rawProbability = Number(row.probability);
  if (!Number.isFinite(rawProbability)) return null;
  const probability = clamp(rawProbability, 0, 1);
  const impactsIn = toArray(row.impacts);
  const impacts = [];
  for (const item of impactsIn){
    if (!isObject(item)) continue;
    const ref = item.ref ? String(item.ref) : "";
    const delta = toFiniteNumber(item.delta, null);
    if (!ref || delta == null) continue;
    impacts.push({ ref, delta });
  }
  if (!impacts.length) return null;
  return {
    id,
    label,
    impacts,
    probability,
    notes: row.notes ? String(row.notes) : "",
  };
}

export function makeDefaultIntelState(){
  return {
    version: INTEL_STATE_VERSION,
    refCatalog: {},
    evidence: [],
    benchmarks: [],
    flags: [],
    audit: [],
    briefs: [],
    recommendations: [],
    observedMetrics: [],
    correlationModels: [],
    shockScenarios: [],
    simToggles: {
      mcDistribution: "triangular",
      correlatedShocks: false,
      correlationMatrixId: null,
      shockScenariosEnabled: true,
    },
    expertToggles: {
      capacityDecayEnabled: false,
      decayModel: {
        type: "linear",
        weeklyDecayPct: 0.03,
        floorPctOfBaseline: 0.70,
      },
    },
  };
}

export function normalizeIntelState(raw){
  const base = makeDefaultIntelState();
  if (!isObject(raw)) return base;

  const out = {
    ...base,
    ...raw,
  };

  out.version = String(raw.version || base.version);
  out.refCatalog = isObject(raw.refCatalog) ? { ...raw.refCatalog } : {};
  out.evidence = toArray(raw.evidence);
  out.benchmarks = toArray(raw.benchmarks);
  out.flags = toArray(raw.flags);
  out.audit = toArray(raw.audit);
  out.briefs = toArray(raw.briefs);
  out.recommendations = toArray(raw.recommendations);
  out.observedMetrics = toArray(raw.observedMetrics);
  const shockRows = toArray(raw.shockScenarios);
  const normalizedShock = [];
  for (const row of shockRows){
    const next = normalizeShockScenario(row);
    if (next) normalizedShock.push(next);
  }
  out.shockScenarios = normalizedShock;

  const corrRows = toArray(raw.correlationModels);
  const normalizedCorr = [];
  for (const row of corrRows){
    const next = normalizeCorrelationModel(row);
    if (next) normalizedCorr.push(next);
  }
  out.correlationModels = normalizedCorr;

  const simIn = isObject(raw.simToggles) ? raw.simToggles : {};
  out.simToggles = {
    ...base.simToggles,
    ...simIn,
  };
  out.simToggles.mcDistribution = ALLOWED_MC_DISTRIBUTIONS.has(String(out.simToggles.mcDistribution))
    ? String(out.simToggles.mcDistribution)
    : base.simToggles.mcDistribution;
  out.simToggles.correlatedShocks = !!out.simToggles.correlatedShocks;
  out.simToggles.shockScenariosEnabled = !!out.simToggles.shockScenariosEnabled;
  out.simToggles.correlationMatrixId = toStringOrNull(out.simToggles.correlationMatrixId);

  const expertIn = isObject(raw.expertToggles) ? raw.expertToggles : {};
  const decayIn = isObject(expertIn.decayModel) ? expertIn.decayModel : {};
  out.expertToggles = {
    ...base.expertToggles,
    ...expertIn,
    capacityDecayEnabled: !!expertIn.capacityDecayEnabled,
    decayModel: {
      ...base.expertToggles.decayModel,
      ...decayIn,
    }
  };

  out.expertToggles.decayModel.type = ALLOWED_DECAY_MODELS.has(String(out.expertToggles.decayModel.type))
    ? String(out.expertToggles.decayModel.type)
    : base.expertToggles.decayModel.type;
  out.expertToggles.decayModel.weeklyDecayPct = clamp(
    toFiniteNumber(out.expertToggles.decayModel.weeklyDecayPct, base.expertToggles.decayModel.weeklyDecayPct),
    0,
    1
  );
  out.expertToggles.decayModel.floorPctOfBaseline = clamp(
    toFiniteNumber(out.expertToggles.decayModel.floorPctOfBaseline, base.expertToggles.decayModel.floorPctOfBaseline),
    0,
    1
  );

  return out;
}

export function cloneIntelState(intelState){
  return normalizeIntelState(deepClone(intelState));
}
