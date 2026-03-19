// js/core/electionSnapshot.js
// Canonical planning snapshot compiler (pure).
// Does not touch DOM/localStorage/window.
// @ts-check

import { buildModelInputFromSnapshot } from "./modelInput.js";
import {
  computeDeterministic,
  deriveNeedVotes,
  deriveWeeksRemainingCeil,
  computeCapacityBreakdown,
} from "./model.js";
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorShareUnit,
  resolveCanonicalDoorsPerHour,
} from "./throughput.js";
import { buildDeterministicExplainMap } from "./explainMap.js";
import { resolveFeatureFlags } from "./featureFlags.js";

function toNumDefault(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} dateRaw
 * @returns {string}
 */
function toElectionDateIso(dateRaw){
  const s = String(dateRaw || "").trim();
  if (!s) return "";
  if (s.includes("T")) return s;
  return `${s}T00:00:00`;
}

/**
 * @param {Record<string, any>} snap
 * @returns {{
 *   enabled:boolean,
 *   type:string,
 *   weeklyDecayPct:number,
 *   floorPctOfBaseline:number
 * }}
 */
function resolveCapacityDecayFromState(snap){
  const features = resolveFeatureFlags(snap || {});
  const toggles = snap?.intelState?.expertToggles || {};
  const model = toggles?.decayModel || {};
  return {
    enabled: !!features.capacityDecayEnabled,
    type: String(model.type || "linear"),
    weeklyDecayPct: Number(model.weeklyDecayPct),
    floorPctOfBaseline: Number(model.floorPctOfBaseline),
  };
}

/**
 * @param {{
 *   state?:Record<string, any>,
 *   nowDate?:Date,
 *   toNum?:(v: unknown) => number|null
 * }} args
 * @returns {{
 *   modelInput: import("./types").ModelInput,
 *   res: Record<string, any>,
 *   weeks: number|null,
 *   needVotes: number|null,
 *   capacityWeekly: Record<string, any>|null,
 *   capacityDecay: {
 *     enabled:boolean,
 *     type:string,
 *     weeklyDecayPct:number,
 *     floorPctOfBaseline:number
 *   }
 * }}
 */
export function computeElectionSnapshot({
  state,
  nowDate = new Date(),
  toNum = toNumDefault,
} = {}){
  const snap = state || {};
  const modelInput = buildModelInputFromSnapshot(snap, toNum);
  const baseRes = computeDeterministic(modelInput);
  const includeExplain = !!snap?.ui?.training;
  const res = (includeExplain && baseRes && typeof baseRes === "object")
    ? {
        ...baseRes,
        explain: buildDeterministicExplainMap(modelInput, baseRes),
      }
    : baseRes;

  const weeks = deriveWeeksRemainingCeil({
    weeksRemainingOverride: snap.weeksRemaining,
    electionDateISO: toElectionDateIso(snap.electionDate),
    nowDate,
  });

  const needVotes = deriveNeedVotes(res, snap.goalSupportIds);
  const capacityDecay = resolveCapacityDecayFromState(snap);
  const capacityWeekly = computeCapacityBreakdown({
    weeks: 1,
    orgCount: toNum(snap.orgCount),
    orgHoursPerWeek: toNum(snap.orgHoursPerWeek),
    volunteerMult: toNum(snap.volunteerMultBase),
    doorShare: resolveCanonicalDoorShareUnit(snap),
    doorsPerHour: toNum(resolveCanonicalDoorsPerHour(snap, { toNumber: toNum })),
    callsPerHour: toNum(resolveCanonicalCallsPerHour(snap, { toNumber: toNum })),
    capacityDecay,
  });

  return {
    modelInput,
    res,
    weeks,
    needVotes,
    capacityWeekly,
    capacityDecay,
  };
}
