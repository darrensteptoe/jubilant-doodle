// @ts-check
// js/core/intelState.js
// Scenario-scoped Intel metadata.
// This layer must not alter deterministic math or MC outputs.
import { clampFiniteNumber, safeNum } from "./utils.js";

export const INTEL_STATE_VERSION = "1.0.0";

const ALLOWED_MC_DISTRIBUTIONS = new Set(["triangular", "uniform", "normal"]);
const ALLOWED_DECAY_MODELS = new Set(["linear"]);
const AI_WRITE_ALLOWED_ROOT_KEYS = new Set([
  "briefs",
  "recommendations",
  "flags",
  "inputCards",
  "intelRequests",
  "observations",
  "classifications",
]);
const AI_FLAG_FORBIDDEN_NUMERIC_KEYS = new Set([
  "actualCR",
  "assumedCR",
  "actualSR",
  "assumedSR",
  "actualAPH",
  "expectedAPH",
  "winProb",
  "median",
  "p10",
  "p50",
  "p90",
]);

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {any}
 */
function deepClone(v){
  try{
    if (typeof structuredClone === "function") return structuredClone(v);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(v));
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const clamp = clampFiniteNumber;

/**
 * @param {unknown} v
 * @param {number | null} fallback
 * @returns {number | null}
 */
function toFiniteNumber(v, fallback){
  const n = safeNum(v);
  return n == null ? fallback : n;
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function toStringOrNull(v){
  if (v == null || v === "") return null;
  return String(v);
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function toBooleanLoose(value, fallback){
  if (typeof value === "boolean") return value;
  if (typeof value === "number"){
    if (!Number.isFinite(value)) return fallback;
    return value !== 0;
  }
  if (typeof value === "string"){
    const text = value.trim().toLowerCase();
    if (!text) return fallback;
    if (text === "true" || text === "1" || text === "yes" || text === "y" || text === "on") return true;
    if (text === "false" || text === "0" || text === "no" || text === "n" || text === "off") return false;
    return fallback;
  }
  return fallback;
}

/**
 * @param {unknown} v
 * @returns {any[]}
 */
function toArray(v){
  return Array.isArray(v) ? v.slice() : [];
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function parseIsoMs(v){
  if (v == null || v === "") return null;
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {any[]} auditRows
 * @returns {string | null}
 */
function deriveLegacyGovernanceBaselineIso(auditRows){
  if (!Array.isArray(auditRows) || !auditRows.length) return null;
  let maxMs = null;
  for (const row of auditRows){
    const ms = parseIsoMs(row?.ts || row?.createdAt || row?.updatedAt);
    if (ms == null) continue;
    if (maxMs == null || ms > maxMs) maxMs = ms;
  }
  return maxMs == null ? null : new Date(maxMs).toISOString();
}

/**
 * @param {unknown} row
 * @returns {{ id: string, label: string, refs: string[], matrix: number[][], notes: string } | null}
 */
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

/**
 * @param {unknown} row
 * @returns {{ id: string, label: string, impacts: Array<{ref:string,delta:number}>, probability: number, notes: string } | null}
 */
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

/**
 * @returns {Record<string, any>}
 */
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
    intelRequests: [],
    correlationModels: [],
    shockScenarios: [],
    workflow: {
      scenarioLocked: false,
      lockReason: "",
      lockedAt: null,
      lockedBy: "",
      governanceBaselineAt: null,
      requireCriticalNote: true,
      requireCriticalEvidence: true,
    },
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

/**
 * @param {unknown} raw
 * @returns {Record<string, any>}
 */
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
  out.intelRequests = toArray(raw.intelRequests);
  const wfIn = isObject(raw.workflow) ? raw.workflow : {};
  const baselineRaw = toStringOrNull(wfIn.governanceBaselineAt);
  const hasGovernanceTrackedRows = out.audit.some((x) => x && x.governanceTracked === true);
  const legacyBaseline = (!baselineRaw && !hasGovernanceTrackedRows)
    ? deriveLegacyGovernanceBaselineIso(out.audit)
    : null;
  out.workflow = {
    ...base.workflow,
    ...wfIn,
    scenarioLocked: toBooleanLoose(wfIn.scenarioLocked, base.workflow.scenarioLocked),
    lockReason: String(wfIn.lockReason || ""),
    lockedAt: toStringOrNull(wfIn.lockedAt),
    lockedBy: String(wfIn.lockedBy || ""),
    governanceBaselineAt: baselineRaw || legacyBaseline,
    requireCriticalNote: toBooleanLoose(wfIn.requireCriticalNote, base.workflow.requireCriticalNote),
    requireCriticalEvidence: toBooleanLoose(wfIn.requireCriticalEvidence, base.workflow.requireCriticalEvidence),
  };
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

/**
 * @param {unknown} intelState
 * @returns {Record<string, any>}
 */
export function cloneIntelState(intelState){
  return normalizeIntelState(deepClone(intelState));
}

/**
 * @param {unknown} payload
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateAiIntelWritePayload(payload){
  const errors = [];
  if (!isObject(payload)){
    return { ok: false, errors: ["AI payload must be an object."] };
  }

  for (const key of Object.keys(payload)){
    if (!AI_WRITE_ALLOWED_ROOT_KEYS.has(String(key))){
      errors.push(`AI payload contains forbidden root key '${key}'.`);
    }
  }

  const checkArray = (key) => {
    if (!(key in payload)) return [];
    const rows = payload[key];
    if (!Array.isArray(rows)){
      errors.push(`AI payload key '${key}' must be an array.`);
      return [];
    }
    return rows;
  };

  const briefs = checkArray("briefs");
  for (let i = 0; i < briefs.length; i += 1){
    const row = briefs[i];
    if (!isObject(row)){
      errors.push(`briefs[${i}] must be an object.`);
      continue;
    }
    if (typeof row.content !== "string" || !row.content.trim()){
      errors.push(`briefs[${i}].content must be a non-empty string.`);
    }
  }

  const recommendations = checkArray("recommendations");
  for (let i = 0; i < recommendations.length; i += 1){
    const row = recommendations[i];
    if (!isObject(row)){
      errors.push(`recommendations[${i}] must be an object.`);
      continue;
    }
    if (typeof row.title !== "string" || !row.title.trim()){
      errors.push(`recommendations[${i}].title must be a non-empty string.`);
    }
    if (row.draftPatch != null && !isObject(row.draftPatch)){
      errors.push(`recommendations[${i}].draftPatch must be an object when present.`);
    }
  }

  const flags = checkArray("flags");
  for (let i = 0; i < flags.length; i += 1){
    const row = flags[i];
    if (!isObject(row)){
      errors.push(`flags[${i}] must be an object.`);
      continue;
    }
    if (typeof row.explanation !== "string" || !row.explanation.trim()){
      errors.push(`flags[${i}].explanation must be a non-empty string.`);
    }
    for (const key of Object.keys(row)){
      if (AI_FLAG_FORBIDDEN_NUMERIC_KEYS.has(String(key))){
        errors.push(`flags[${i}] cannot set numeric drift field '${key}'.`);
      }
    }
  }

  if ("inputCards" in payload){
    const inputCards = payload.inputCards;
    if (!isObject(inputCards)){
      errors.push("inputCards must be an object.");
    } else {
      const ai = inputCards.ai;
      if (!isObject(ai)){
        errors.push("inputCards.ai must be an object.");
      } else if (ai.draftNotes != null && typeof ai.draftNotes !== "string"){
        errors.push("inputCards.ai.draftNotes must be a string when present.");
      }
    }
  }

  const intelRequests = checkArray("intelRequests");
  for (let i = 0; i < intelRequests.length; i += 1){
    const row = intelRequests[i];
    if (!isObject(row)){
      errors.push(`intelRequests[${i}] must be an object.`);
      continue;
    }
    if (!("parsed" in row)){
      errors.push(`intelRequests[${i}] must include parsed.`);
    }
  }

  checkArray("observations");
  checkArray("classifications");

  return {
    ok: errors.length === 0,
    errors,
  };
}
