// @ts-check
// js/features/operations/rollups.js
// Deterministic rollups + overlap-safe totals for Operations.

function num(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v){
  return (v == null) ? "" : String(v).trim();
}

function dayKey(dateLike){
  const s = str(dateLike);
  if (!s) return "";
  return s.slice(0, 10);
}

function shiftFingerprint(shift){
  return [
    dayKey(shift?.date),
    str(shift?.personId),
    str(shift?.turfId),
    str(shift?.mode),
  ].join("|");
}

function turfFingerprint(turf){
  return [
    dayKey(turf?.date),
    str(turf?.assignedTo),
    str(turf?.turfId),
    str(turf?.mode),
  ].join("|");
}

export function summarizeShiftProduction(shiftRecords){
  const rows = Array.isArray(shiftRecords) ? shiftRecords : [];
  let attempts = 0;
  let convos = 0;
  let supportIds = 0;
  let hours = 0;

  const seenFingerprints = new Set();
  for (const rec of rows){
    attempts += Math.max(0, num(rec?.attempts, 0));
    convos += Math.max(0, num(rec?.convos, 0));
    supportIds += Math.max(0, num(rec?.supportIds, 0));

    const start = Date.parse(str(rec?.checkInAt) || str(rec?.startAt));
    const end = Date.parse(str(rec?.checkOutAt) || str(rec?.endAt));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start){
      hours += (end - start) / 3600000;
    }

    const fp = shiftFingerprint(rec);
    if (fp) seenFingerprints.add(fp);
  }

  return {
    attempts,
    convos,
    supportIds,
    hours,
    shiftCount: rows.length,
    shiftFingerprints: seenFingerprints,
  };
}

export function summarizeTurfCoverage(turfEvents){
  const rows = Array.isArray(turfEvents) ? turfEvents : [];
  const byPrecinct = new Map();
  const byTurfId = new Map();
  let attempts = 0;
  let canvassed = 0;
  let vbms = 0;

  for (const rec of rows){
    attempts += Math.max(0, num(rec?.attempts, 0));
    canvassed += Math.max(0, num(rec?.canvassed, 0));
    vbms += Math.max(0, num(rec?.vbms, 0));

    const precinct = str(rec?.precinct) || "unassigned";
    byPrecinct.set(precinct, (byPrecinct.get(precinct) || 0) + 1);

    const turfId = str(rec?.turfId) || "unassigned";
    byTurfId.set(turfId, (byTurfId.get(turfId) || 0) + 1);
  }

  return {
    eventCount: rows.length,
    attempts,
    canvassed,
    vbms,
    touchesByPrecinct: Array.from(byPrecinct.entries()).map(([precinct, touches]) => ({ precinct, touches })),
    touchesByTurfId: Array.from(byTurfId.entries()).map(([turfId, touches]) => ({ turfId, touches })),
  };
}

// Source-of-truth rule:
// - Production totals come from shifts.
// - Turf attempts are coverage metrics and excluded from production totals by default.
// - Dedupe counters are returned for transparency.
export function computeOperationalRollups({ shiftRecords, turfEvents, options } = {}){
  const opts = options || {};
  const allowTurfFallback = !!opts.allowTurfFallbackAttempts;
  const shifts = Array.isArray(shiftRecords) ? shiftRecords : [];
  const turf = Array.isArray(turfEvents) ? turfEvents : [];

  const shift = summarizeShiftProduction(shifts);
  const coverage = summarizeTurfCoverage(turf);

  let excludedTurfAttemptRecords = 0;
  let excludedTurfAttempts = 0;
  let includedFallbackAttempts = 0;

  const shiftIds = new Set(shifts.map((s) => str(s?.id)).filter(Boolean));
  const shiftFps = shift.shiftFingerprints;

  for (const rec of turf){
    const turfAttempts = Math.max(0, num(rec?.attempts, 0));
    const linkedShiftId = str(rec?.shiftId);
    const isLinked = linkedShiftId && shiftIds.has(linkedShiftId);
    const isFingerprintMatch = shiftFps.has(turfFingerprint(rec));
    const overlaps = isLinked || isFingerprintMatch;

    if (overlaps){
      excludedTurfAttemptRecords += 1;
      excludedTurfAttempts += turfAttempts;
      continue;
    }

    if (allowTurfFallback && shift.shiftCount === 0){
      includedFallbackAttempts += turfAttempts;
    } else {
      excludedTurfAttemptRecords += 1;
      excludedTurfAttempts += turfAttempts;
    }
  }

  return {
    production: {
      attempts: shift.attempts + includedFallbackAttempts,
      convos: shift.convos,
      supportIds: shift.supportIds,
      hours: shift.hours,
      source: (shift.shiftCount > 0) ? "shift" : (allowTurfFallback ? "turf_fallback" : "shift"),
    },
    coverage,
    dedupe: {
      rule: "shift_primary_turf_coverage",
      excludedTurfAttemptRecords,
      excludedTurfAttempts,
      includedFallbackAttempts,
    },
  };
}


// Canonical operations alias.
export const computeOperationsRollups = computeOperationalRollups;
