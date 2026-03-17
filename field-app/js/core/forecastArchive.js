// @ts-check
import {
  DEFAULT_CAMPAIGN_ID,
  normalizeCampaignId,
  normalizeOfficeId,
  normalizeScenarioId,
} from "../app/activeContext.js";
import { getOptimizationObjectiveCopy } from "./turnout.js";
import { getTimelineFeasibilityObjectiveMeta } from "./timeline.js";
import { getTimelineObjectiveMeta } from "./timelineOptimizer.js";

const ARCHIVE_KEY_BASE = "dsc_field_forecast_archive_v1";
const DEFAULT_MAX_ENTRIES = 300;
const FORECAST_ARCHIVE_NUMERIC_KEYS = ["margin", "yourVotes", "winThreshold", "turnoutVotes", "voteSharePct"];
const FORECAST_ARCHIVE_FORECAST_NUMERIC_KEYS = [
  ...FORECAST_ARCHIVE_NUMERIC_KEYS,
  "weeksRemaining",
  "turnoutExpectedPct",
  "persuasionNeed",
  "winProb",
  "p10Margin",
  "p50Margin",
  "p90Margin",
  "objectiveValue",
  "objectiveValueAliasNetVotes",
  "forecastCost",
  "goalObjectiveValue",
  "maxAchievableObjectiveValue",
  "remainingGapObjectiveValue",
  "shortfallObjectiveValue",
];

function safeNum(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function toObject(value){
  return value && typeof value === "object" ? value : {};
}

function normalizeForecastArchiveMetrics(src = {}){
  const input = src && typeof src === "object" ? src : {};
  const out = {};
  for (const key of FORECAST_ARCHIVE_NUMERIC_KEYS){
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const n = safeNum(input[key]);
    if (n != null) out[key] = n;
  }
  return out;
}

export function resolveForecastArchiveMargin(record){
  const src = record && typeof record === "object" ? record : {};
  const explicit = safeNum(src.margin);
  if (explicit != null) return explicit;
  const yourVotes = safeNum(src.yourVotes);
  const winThreshold = safeNum(src.winThreshold);
  if (yourVotes != null && winThreshold != null){
    return yourVotes - winThreshold;
  }
  return null;
}

export function buildForecastArchiveMarginSummary(entry = {}){
  const row = entry && typeof entry === "object" ? entry : {};
  const forecast = row?.forecast && typeof row.forecast === "object" ? row.forecast : {};
  const actual = row?.actual && typeof row.actual === "object" ? row.actual : {};
  const forecastMargin = resolveForecastArchiveMargin(forecast);
  const actualMargin = resolveForecastArchiveMargin(actual);
  const errorMargin = (forecastMargin != null && actualMargin != null)
    ? (actualMargin - forecastMargin)
    : null;
  return {
    forecastMargin,
    actualMargin,
    errorMargin,
    hasActualMargin: actualMargin != null,
  };
}

export function normalizeForecastArchiveForecast(forecast){
  const src = forecast && typeof forecast === "object" ? forecast : {};
  const out = { ...src };
  for (const key of FORECAST_ARCHIVE_FORECAST_NUMERIC_KEYS){
    if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
    const n = safeNum(out[key]);
    if (n == null){
      delete out[key];
    } else {
      out[key] = n;
    }
  }
  return out;
}

export function normalizeForecastArchiveActual(actual){
  const src = actual && typeof actual === "object" ? actual : {};
  const out = normalizeForecastArchiveMetrics(src);
  const winner = cleanText(src.winner);
  if (winner) out.winner = winner;
  const resultDate = cleanText(src.resultDate);
  if (resultDate) out.resultDate = resultDate;
  return out;
}

export function buildForecastArchiveContext(source = {}, overrides = {}){
  const src = toObject(source);
  const ext = toObject(overrides);
  const srcUi = toObject(src.ui);
  const extUi = toObject(ext.ui);
  const campaignId = normalizeCampaignId(
    ext.campaignId ?? src.campaignId,
    DEFAULT_CAMPAIGN_ID,
  );
  const campaignName = cleanText(ext.campaignName ?? src.campaignName);
  const officeId = normalizeOfficeId(
    ext.officeId ?? src.officeId,
    "",
  );
  const scenarioId = normalizeScenarioId(
    ext.scenarioId
      ?? src.scenarioId
      ?? extUi.activeScenarioId
      ?? srcUi.activeScenarioId,
    "",
  );
  return {
    campaignId,
    campaignName,
    officeId,
    scenarioId,
  };
}

function isStorageLike(value){
  return !!value
    && typeof value === "object"
    && typeof value.getItem === "function"
    && typeof value.setItem === "function"
    && typeof value.removeItem === "function";
}

function getDefaultStorage(){
  if (typeof localStorage !== "undefined") return localStorage;
  return {
    getItem(){ return null; },
    setItem(){},
    removeItem(){},
  };
}

function resolveStorage(storageOverride){
  return isStorageLike(storageOverride) ? storageOverride : getDefaultStorage();
}

export function makeForecastArchiveKey(context = {}){
  const campaignId = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  return `${ARCHIVE_KEY_BASE}::${campaignId}`;
}

export function readForecastArchive(context = {}, storageOverride){
  const store = resolveStorage(storageOverride);
  const key = makeForecastArchiveKey(context);
  try{
    const raw = store.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function writeForecastArchive(entries, context = {}, storageOverride){
  const store = resolveStorage(storageOverride);
  const key = makeForecastArchiveKey(context);
  const list = Array.isArray(entries) ? entries : [];
  try{
    store.setItem(key, JSON.stringify(list));
    return { ok: true, count: list.length };
  } catch (err){
    return {
      ok: false,
      error: cleanText(err?.message) || "archive_write_failed",
    };
  }
}

export function appendForecastArchiveEntry(entry, context = {}, storageOverride, { maxEntries = DEFAULT_MAX_ENTRIES } = {}){
  const normalized = normalizeForecastArchiveEntry(entry, context);
  if (!normalized) return { ok: false, error: "invalid_entry" };
  const prev = readForecastArchive(context, storageOverride);
  const deduped = prev.filter((row) => String(row?.snapshotHash || "") !== String(normalized.snapshotHash || ""));
  const next = [normalized, ...deduped].slice(0, Math.max(10, Number(maxEntries) || DEFAULT_MAX_ENTRIES));
  const write = writeForecastArchive(next, context, storageOverride);
  return write.ok ? { ok: true, count: next.length, entry: normalized } : write;
}

export function updateForecastArchiveActual({
  snapshotHash,
  actual,
  notes = "",
} = {}, context = {}, storageOverride){
  const hash = cleanText(snapshotHash);
  if (!hash) return { ok: false, error: "missing_snapshot_hash" };
  const prev = readForecastArchive(context, storageOverride);
  const idx = prev.findIndex((row) => cleanText(row?.snapshotHash) === hash);
  if (idx < 0){
    return { ok: false, error: "entry_not_found" };
  }
  const existing = prev[idx] && typeof prev[idx] === "object" ? prev[idx] : {};
  const nextRow = normalizeForecastArchiveEntry({
    ...existing,
    actual: normalizeForecastArchiveActual(actual),
    notes: cleanText(notes) || cleanText(existing.notes),
  }, context);
  if (!nextRow){
    return { ok: false, error: "invalid_entry" };
  }
  const next = prev.slice();
  next[idx] = nextRow;
  const write = writeForecastArchive(next, context, storageOverride);
  return write.ok ? { ok: true, entry: nextRow, count: next.length } : write;
}

export function normalizeForecastArchiveEntry(entry, context = {}){
  const src = entry && typeof entry === "object" ? entry : null;
  if (!src) return null;
  const resolvedContext = buildForecastArchiveContext(src, context);
  const campaignId = resolvedContext.campaignId;
  const scenarioId = resolvedContext.scenarioId;
  const snapshotHash = cleanText(src.snapshotHash);
  if (!snapshotHash) return null;
  const recordedAt = cleanText(src.recordedAt) || new Date().toISOString();
  const archiveId = cleanText(src.archiveId) || `${snapshotHash}:${recordedAt}`;
  const normalizedForecast = normalizeForecastArchiveForecast(src.forecast);
  const normalizedActual = normalizeForecastArchiveActual(src.actual);
  const marginSummary = buildForecastArchiveMarginSummary({
    forecast: normalizedForecast,
    actual: normalizedActual,
  });
  return {
    archiveId,
    recordedAt,
    campaignId,
    campaignName: resolvedContext.campaignName,
    officeId: resolvedContext.officeId,
    scenarioId,
    scenarioName: cleanText(src.scenarioName),
    snapshotHash,
    templateMeta: src.templateMeta && typeof src.templateMeta === "object" ? { ...src.templateMeta } : {},
    assumptions: src.assumptions && typeof src.assumptions === "object" ? { ...src.assumptions } : {},
    workforce: src.workforce && typeof src.workforce === "object" ? { ...src.workforce } : {},
    execution: src.execution && typeof src.execution === "object" ? structuredClone(src.execution) : {},
    targeting: src.targeting && typeof src.targeting === "object" ? { ...src.targeting } : {},
    budget: src.budget && typeof src.budget === "object" ? { ...src.budget } : {},
    forecast: normalizedForecast,
    actual: Object.keys(normalizedActual).length ? normalizedActual : null,
    variance: {
      forecastMargin: marginSummary.forecastMargin,
      actualMargin: marginSummary.actualMargin,
      errorMargin: marginSummary.errorMargin,
    },
    notes: cleanText(src.notes),
  };
}

export function summarizeForecastArchive(entries = []){
  const rows = Array.isArray(entries) ? entries : [];
  const totalEntries = rows.length;
  let withActualEntries = 0;
  let withActualMarginEntries = 0;
  let latestRecordedAt = "";
  for (const row of rows){
    const recordedAt = cleanText(row?.recordedAt);
    if (recordedAt && (!latestRecordedAt || recordedAt > latestRecordedAt)){
      latestRecordedAt = recordedAt;
    }
    const actual = row?.actual && typeof row.actual === "object" ? row.actual : null;
    if (actual && Object.keys(actual).length){
      withActualEntries += 1;
      if (resolveForecastArchiveMargin(actual) != null){
        withActualMarginEntries += 1;
      }
    }
  }
  const pendingActualEntries = Math.max(0, totalEntries - withActualEntries);
  return {
    totalEntries,
    withActualEntries,
    withActualMarginEntries,
    pendingActualEntries,
    latestRecordedAt,
  };
}

export function buildForecastArchiveEntry({ state = {}, renderCtx = null, snapshot = null } = {}){
  const s = state && typeof state === "object" ? state : {};
  const res = renderCtx?.res && typeof renderCtx.res === "object" ? renderCtx.res : {};
  const objectiveCopy = getOptimizationObjectiveCopy(s?.budget?.optimize?.objective, "net");
  const forecastSummary = s?.ui?.lastSummary && typeof s.ui.lastSummary === "object" ? s.ui.lastSummary : {};
  const timelineObjectiveMeta = getTimelineObjectiveMeta(
    s?.ui?.lastTlMeta && typeof s.ui.lastTlMeta === "object" ? s.ui.lastTlMeta : {}
  );
  const timelineFeasibilityMeta = getTimelineFeasibilityObjectiveMeta(
    s?.ui?.lastTimeline && typeof s.ui.lastTimeline === "object" ? s.ui.lastTimeline : {}
  );
  const lastWeeklyOps = s?.ui?.lastWeeklyOps && typeof s.ui.lastWeeklyOps === "object" ? s.ui.lastWeeklyOps : {};
  const lastConversion = s?.ui?.lastConversion && typeof s.ui.lastConversion === "object" ? s.ui.lastConversion : {};
  const lastTimeline = s?.ui?.lastTimeline && typeof s.ui.lastTimeline === "object" ? s.ui.lastTimeline : {};
  const scenarioId = normalizeScenarioId(s?.ui?.activeScenarioId, "");
  const snapshotHash = cleanText(snapshot?.snapshotHash || s?.ui?.lastSnapshotHash);
  if (!snapshotHash) return null;
  return normalizeForecastArchiveEntry({
    archiveId: `${snapshotHash}:${new Date().toISOString()}`,
    recordedAt: new Date().toISOString(),
    campaignId: s.campaignId,
    campaignName: s.campaignName,
    officeId: s.officeId,
    scenarioId,
    scenarioName: s.scenarioName,
    snapshotHash,
    templateMeta: s.templateMeta || {},
    assumptions: {
      raceType: s.raceType,
      persuasionPct: safeNum(s.persuasionPct),
      earlyVoteExp: safeNum(s.earlyVoteExp),
      supportRatePct: safeNum(s.supportRatePct),
      contactRatePct: safeNum(s.contactRatePct),
      turnoutReliabilityPct: safeNum(s.turnoutReliabilityPct),
      bandWidth: safeNum(s.bandWidth),
    },
    workforce: s?.ui?.twCapOutlookLatest?.workforce || {},
    execution: {
      weeklyOps: {
        goal: safeNum(lastWeeklyOps.goal),
        weeks: safeNum(lastWeeklyOps.weeks),
        attemptsPerWeek: safeNum(lastWeeklyOps.attemptsPerWeek),
        capacityPerWeek: safeNum(lastWeeklyOps.capacityPerWeek),
        gapPerWeek: safeNum(lastWeeklyOps.gapPerWeek),
        constraint: cleanText(lastWeeklyOps.constraint),
        note: cleanText(lastWeeklyOps.note),
        bannerText: cleanText(lastWeeklyOps?.banner?.text),
      },
      conversion: {
        goalObjectiveValue: safeNum(lastConversion.goalObjectiveValue),
        conversationsNeeded: safeNum(lastConversion.conversationsNeeded),
        doorsNeeded: safeNum(lastConversion.doorsNeeded),
        shiftsPerWeek: safeNum(lastConversion.shiftsPerWeek),
        volunteersNeeded: safeNum(lastConversion.volunteersNeeded),
        feasibilityText: cleanText(lastConversion?.feasibility?.text),
      },
      timeline: {
        percentPlanExecutable: safeNum(lastTimeline.percentPlanExecutable),
        projectedCompletionWeek: safeNum(lastTimeline.projectedCompletionWeek),
        shortfallAttempts: safeNum(lastTimeline.shortfallAttempts),
        shortfallObjectiveValue: safeNum(lastTimeline.shortfallObjectiveValue),
        constraintType: cleanText(lastTimeline.constraintType),
      },
    },
    targeting: {
      presetId: cleanText(s?.targeting?.presetId),
      modelId: cleanText(s?.targeting?.modelId),
      topN: safeNum(s?.targeting?.topN),
      lastRun: cleanText(s?.targeting?.lastRun),
      contextKey: cleanText(s?.targeting?.lastMeta?.contextKey),
    },
    budget: {
      includeOverhead: !!s?.budget?.includeOverhead,
      overheadAmount: safeNum(s?.budget?.overheadAmount),
      tactics: s?.budget?.tactics && typeof s.budget.tactics === "object" ? structuredClone(s.budget.tactics) : {},
      optimize: s?.budget?.optimize && typeof s.budget.optimize === "object" ? { ...s.budget.optimize } : {},
    },
    forecast: {
      weeksRemaining: safeNum(renderCtx?.weeks),
      turnoutExpectedPct: safeNum(res?.turnout?.expectedPct),
      turnoutVotes: safeNum(res?.expected?.turnoutVotes),
      winThreshold: safeNum(res?.expected?.winThreshold),
      yourVotes: safeNum(res?.expected?.yourVotes),
      persuasionNeed: safeNum(res?.expected?.persuasionNeed),
      winProb: safeNum(s?.mcLast?.winProb),
      p10Margin: safeNum(s?.mcLast?.confidenceEnvelope?.percentiles?.p10),
      p50Margin: safeNum(s?.mcLast?.confidenceEnvelope?.percentiles?.p50),
      p90Margin: safeNum(s?.mcLast?.confidenceEnvelope?.percentiles?.p90),
      optimizationObjective: cleanText(objectiveCopy?.value || "net"),
      optimizationObjectiveLabel: cleanText(objectiveCopy?.label || "Net Votes"),
      objectiveValue: safeNum(forecastSummary?.objectiveValue),
      objectiveValueAliasNetVotes: safeNum(forecastSummary?.netVotes),
      forecastCost: safeNum(forecastSummary?.cost),
      goalObjectiveValue: safeNum(timelineObjectiveMeta?.goalObjectiveValue),
      maxAchievableObjectiveValue: safeNum(timelineObjectiveMeta?.maxAchievableObjectiveValue),
      remainingGapObjectiveValue: safeNum(timelineObjectiveMeta?.remainingGapObjectiveValue),
      shortfallObjectiveValue: safeNum(timelineFeasibilityMeta?.shortfallObjectiveValue),
    },
  }, {
    campaignId: s.campaignId,
    campaignName: s.campaignName,
    officeId: s.officeId,
    scenarioId,
  });
}
