// js/core/electionSnapshot.js
// Canonical planning snapshot compiler (pure).
// Does not touch DOM/localStorage/window.

import { buildModelInputFromSnapshot } from "./modelInput.js";
import {
  computeDeterministic,
  deriveNeedVotes,
  deriveWeeksRemainingCeil,
  computeCapacityBreakdown,
} from "./model.js";
import { clamp } from "./utils.js";
import { buildDeterministicExplainMap } from "./explainMap.js";

function toNumDefault(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDoorShareUnit(doorSharePct){
  const n = Number(doorSharePct);
  if (!Number.isFinite(n)) return null;
  return clamp(n, 0, 100) / 100;
}

function toElectionDateIso(dateRaw){
  const s = String(dateRaw || "").trim();
  if (!s) return "";
  if (s.includes("T")) return s;
  return `${s}T00:00:00`;
}

function resolveCapacityDecayFromState(snap){
  const toggles = snap?.intelState?.expertToggles || {};
  const model = toggles?.decayModel || {};
  return {
    enabled: !!toggles.capacityDecayEnabled,
    type: String(model.type || "linear"),
    weeklyDecayPct: Number(model.weeklyDecayPct),
    floorPctOfBaseline: Number(model.floorPctOfBaseline),
  };
}

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
    doorShare: toDoorShareUnit(snap.channelDoorPct),
    doorsPerHour: toNum(snap.doorsPerHour3 ?? snap.doorsPerHour),
    callsPerHour: toNum(snap.callsPerHour3),
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
