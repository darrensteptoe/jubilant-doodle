// @ts-check
import { operationsTransitionKey } from "../features/operations/time.js";
import { formatFixedNumber, formatPercentFromUnit, roundWholeNumberByMode } from "../core/utils.js";
export function twCapTextModule(el, text){
  if (el) el.textContent = String(text ?? "");
}

export function twCapNumModule(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function twCapFmtIntModule(v, { fmtInt } = {}){
  const n = roundWholeNumberByMode(v, { mode: "round", fallback: null });
  return n == null ? "—" : fmtInt(n);
}

export function twCapFmt1Module(v){
  return formatFixedNumber(v, 1);
}

export function twCapFmt2Module(v){
  return formatFixedNumber(v, 2);
}

export function twCapFmtSignedModule(v, { fmtInt } = {}){
  const n = roundWholeNumberByMode(v, { mode: "round", fallback: null });
  if (n == null) return "—";
  if (n > 0) return `+${fmtInt(n)}`;
  if (n < 0) return `−${fmtInt(Math.abs(n))}`;
  return "0";
}

export function twCapRatioTextModule(numerator, denominator){
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "—";
  return formatPercentFromUnit(num / den, 1);
}

export function twCapFmtPct01Module(v){
  return formatPercentFromUnit(v, 1);
}

export function twCapMedianModule(values){
  const list = (Array.isArray(values) ? values : [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = roundWholeNumberByMode(list.length / 2, { mode: "floor", fallback: 0 }) ?? 0;
  if (list.length % 2 === 1) return list[mid];
  return (list[mid - 1] + list[mid]) / 2;
}

export function twCapCleanModule(v){
  return String(v == null ? "" : v).trim();
}

export function twCapTransitionKeyModule(from, to){
  return operationsTransitionKey(from, to);
}

export function twCapParseDateModule(value){
  const s = twCapCleanModule(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const dt = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function twCapWeekStartModule(dt){
  const base = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const day = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - day);
  return base;
}

export function twCapIsoUTCModule(dt){
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function twCapLatestRecordByPersonModule(rows, deps = {}){
  const { twCapClean, twCapParseDate } = deps;
  const out = new Map();
  for (const rec of (Array.isArray(rows) ? rows : [])){
    const personId = twCapClean(rec?.personId);
    if (!personId) continue;
    const ts = twCapParseDate(rec?.updatedAt)?.getTime() || twCapParseDate(rec?.createdAt)?.getTime() || 0;
    const prev = out.get(personId);
    const prevTs = prev ? (twCapParseDate(prev?.updatedAt)?.getTime() || twCapParseDate(prev?.createdAt)?.getTime() || 0) : -1;
    if (!prev || ts >= prevTs) out.set(personId, rec);
  }
  return out;
}

export function twCapBuildReadinessStatsModule(onboardingRecords, trainingRecords, deps = {}){
  const {
    twCapLatestRecordByPerson,
    twCapClean,
    twCapParseDate,
    twCapMedian,
    twCapDayMs = 86400000,
    nowMs = Date.now(),
  } = deps;
  const onbByPerson = twCapLatestRecordByPerson(onboardingRecords);
  const trnByPerson = twCapLatestRecordByPerson(trainingRecords);
  const personIds = new Set([...onbByPerson.keys(), ...trnByPerson.keys()]);

  const twoWeeksMs = 14 * twCapDayMs;
  let readyNow = 0;
  let recentReadyCount = 0;
  const cycleDays = [];

  for (const personId of personIds){
    const onb = onbByPerson.get(personId);
    const trn = trnByPerson.get(personId);
    const onbDone = twCapClean(onb?.onboardingStatus) === "completed";
    const trnDone = twCapClean(trn?.completionStatus) === "completed";
    if (!(onbDone && trnDone)) continue;

    readyNow += 1;

    const readyCandidates = [
      twCapParseDate(onb?.completedAt)?.getTime(),
      twCapParseDate(trn?.completedAt)?.getTime(),
    ].filter((v) => Number.isFinite(v));
    const readyMs = readyCandidates.length ? Math.max(...readyCandidates) : NaN;

    if (Number.isFinite(readyMs) && readyMs >= (nowMs - twoWeeksMs)){
      recentReadyCount += 1;
    }

    const docsMs = twCapParseDate(onb?.docsSubmittedAt)?.getTime();
    if (Number.isFinite(docsMs) && Number.isFinite(readyMs) && readyMs >= docsMs){
      cycleDays.push((readyMs - docsMs) / twCapDayMs);
    }
  }

  const recentReadyPerWeek = recentReadyCount / 2;
  const projectedReady14d = readyNow + (recentReadyPerWeek * 2);
  return {
    readyNow,
    recentReadyPerWeek,
    projectedReady14d,
    medianReadyDays: twCapMedian(cycleDays),
  };
}

export function twCapNormalizeForecastConfigModule(raw, deps = {}){
  const { defaultForecastConfig, pipelineStages, twCapTransitionKey, clamp, twCapNum } = deps;
  const src = (raw && typeof raw === "object") ? raw : {};
  const conv = { ...(defaultForecastConfig.stageConversionDefaults || {}), ...(src.stageConversionDefaults || {}) };
  const dur = { ...(defaultForecastConfig.stageDurationDefaultsDays || {}), ...(src.stageDurationDefaultsDays || {}) };
  for (let i = 0; i < pipelineStages.length - 1; i++){
    const key = twCapTransitionKey(pipelineStages[i], pipelineStages[i + 1]);
    conv[key] = clamp(twCapNum(conv[key], 1), 0, 1);
    dur[key] = Math.max(0, twCapNum(dur[key], 0));
  }
  return { stageConversionDefaults: conv, stageDurationDefaultsDays: dur };
}

export function twCapPerOrganizerAttemptsPerWeekModule(effective, deps = {}){
  const { computeCapacityBreakdown, twCapNum, clamp } = deps;
  const c = effective?.capacity || {};
  const one = computeCapacityBreakdown({
    weeks: 1,
    orgCount: 1,
    orgHoursPerWeek: twCapNum(c.orgHoursPerWeek, 0),
    volunteerMult: twCapNum(c.volunteerMult, 0),
    doorShare: (c.doorShare == null) ? null : clamp(twCapNum(c.doorShare, 0), 0, 1),
    doorsPerHour: twCapNum(c.doorsPerHour, 0),
    callsPerHour: twCapNum(c.callsPerHour, 0),
  });
  return Math.max(0, twCapNum(one?.total, 0));
}

export function twCapBaselineAttemptsPerWeekModule(effective, deps = {}){
  const { computeCapacityBreakdown, twCapNum, clamp } = deps;
  const c = effective?.capacity || {};
  const baseline = computeCapacityBreakdown({
    weeks: 1,
    orgCount: twCapNum(c.orgCount, 0),
    orgHoursPerWeek: twCapNum(c.orgHoursPerWeek, 0),
    volunteerMult: twCapNum(c.volunteerMult, 0),
    doorShare: (c.doorShare == null) ? null : clamp(twCapNum(c.doorShare, 0), 0, 1),
    doorsPerHour: twCapNum(c.doorsPerHour, 0),
    callsPerHour: twCapNum(c.callsPerHour, 0),
  });
  return Math.max(0, twCapNum(baseline?.total, 0));
}
