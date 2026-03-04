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

export function computeElectionSnapshot({
  state,
  nowDate = new Date(),
  toNum = toNumDefault,
} = {}){
  const snap = state || {};
  const modelInput = buildModelInputFromSnapshot(snap, toNum);
  const res = computeDeterministic(modelInput);

  const weeks = deriveWeeksRemainingCeil({
    weeksRemainingOverride: snap.weeksRemaining,
    electionDateISO: toElectionDateIso(snap.electionDate),
    nowDate,
  });

  const needVotes = deriveNeedVotes(res, snap.goalSupportIds);
  const capacityWeekly = computeCapacityBreakdown({
    weeks: 1,
    orgCount: toNum(snap.orgCount),
    orgHoursPerWeek: toNum(snap.orgHoursPerWeek),
    volunteerMult: toNum(snap.volunteerMultBase),
    doorShare: toDoorShareUnit(snap.channelDoorPct),
    doorsPerHour: toNum(snap.doorsPerHour3 ?? snap.doorsPerHour),
    callsPerHour: toNum(snap.callsPerHour3),
  });

  return {
    modelInput,
    res,
    weeks,
    needVotes,
    capacityWeekly,
  };
}
