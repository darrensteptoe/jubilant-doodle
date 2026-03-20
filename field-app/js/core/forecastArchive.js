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
import { normalizeUpliftSource } from "./upliftSource.js";
import { VOTER_LAYER_SCOPING_RULE } from "./voterDataLayer.js";
import { coerceFiniteNumber } from "./utils.js";
import { summarizeTargetingRows } from "./targetingRows.js";

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

const safeNum = coerceFiniteNumber;

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function toObject(value){
  return value && typeof value === "object" ? value : {};
}

function cloneArchivePayload(value){
  if (value == null) return value;
  try{
    return structuredClone(value);
  } catch {
    try{
      return JSON.parse(JSON.stringify(value));
    } catch {
      const row = toObject(value);
      return { ...row };
    }
  }
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

function archiveOfficeScopeToken(context = {}){
  const officeId = normalizeOfficeId(context?.officeId, "");
  return officeId || "all";
}

function makeForecastArchiveLegacyCampaignKey(context = {}){
  const campaignId = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  return `${ARCHIVE_KEY_BASE}::${campaignId}`;
}

function parseArchiveRows(raw){
  try{
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function listCampaignArchiveKeys(store, campaignId){
  const keys = [];
  if (!store || typeof store.length !== "number" || typeof store.key !== "function"){
    return keys;
  }
  const prefix = `${ARCHIVE_KEY_BASE}::${campaignId}::`;
  for (let i = 0; i < store.length; i += 1){
    const key = String(store.key(i) || "");
    if (key.startsWith(prefix)){
      keys.push(key);
    }
  }
  return keys;
}

function dedupeArchiveRows(rows){
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const out = [];
  for (const row of list){
    const archiveId = cleanText(row?.archiveId);
    const snapshotHash = cleanText(row?.snapshotHash);
    const recordedAt = cleanText(row?.recordedAt);
    const token = archiveId || `${snapshotHash}::${recordedAt}`;
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(row);
  }
  out.sort((a, b) => {
    const aa = cleanText(a?.recordedAt);
    const bb = cleanText(b?.recordedAt);
    if (aa === bb) return 0;
    return aa > bb ? -1 : 1;
  });
  return out;
}

function recordMatchesArchiveScope(record, context = {}){
  const row = record && typeof record === "object" ? record : {};
  const ctxCampaignId = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  const rowCampaignId = normalizeCampaignId(row?.campaignId, DEFAULT_CAMPAIGN_ID);
  if (rowCampaignId !== ctxCampaignId){
    return false;
  }
  const ctxOfficeId = normalizeOfficeId(context?.officeId, "");
  if (!ctxOfficeId){
    return true;
  }
  const rowOfficeId = normalizeOfficeId(row?.officeId, "");
  return rowOfficeId === ctxOfficeId;
}

function buildTargetingArchiveSnapshot(stateLike = {}){
  const targeting = toObject(stateLike?.targeting);
  const rows = Array.isArray(targeting?.lastRows) ? targeting.lastRows : [];
  const summary = summarizeTargetingRows(rows, { topListLimit: 20 });

  return {
    presetId: cleanText(targeting?.presetId),
    modelId: cleanText(targeting?.modelId),
    topN: safeNum(targeting?.topN),
    lastRun: cleanText(targeting?.lastRun),
    contextKey: cleanText(targeting?.lastMeta?.contextKey),
    rowCount: summary.rowCount,
    topTargetCount: summary.topTargetCount,
    meanScore: summary.meanScore,
    topMeanScore: summary.topMeanScore,
    expectedNetVoteValueTotal: summary.expectedNetVoteValueTotal,
    topExpectedNetVoteValueTotal: summary.topExpectedNetVoteValueTotal,
    topGeoids: summary.topGeoids,
    topLabels: summary.topLabels,
  };
}

function buildOfficePathArchiveSnapshot(stateLike = {}){
  const lastSummary = toObject(stateLike?.ui?.lastSummary);
  const officePaths = toObject(lastSummary?.officePaths);
  const rows = Array.isArray(officePaths?.rows) ? officePaths.rows : [];
  const officeIds = [];
  const topChannels = [];
  let objectiveValueTotal = 0;
  let objectiveValueCount = 0;

  for (const row of rows){
    const officeId = cleanText(row?.officeId);
    if (officeId && officeIds.length < 20) officeIds.push(officeId);
    const topChannel = cleanText(row?.topChannel);
    if (topChannel && topChannels.length < 20) topChannels.push(topChannel);
    const objectiveValue = safeNum(row?.objectiveValue);
    if (objectiveValue != null){
      objectiveValueTotal += objectiveValue;
      objectiveValueCount += 1;
    }
  }

  const bestByDollar = toObject(officePaths?.bestByDollar);
  const bestByOrganizerHour = toObject(officePaths?.bestByOrganizerHour);
  return {
    statusText: cleanText(officePaths?.statusText),
    rowCount: rows.length,
    objectiveValueTotal: objectiveValueCount > 0 ? objectiveValueTotal : null,
    bestByDollarOfficeId: cleanText(bestByDollar?.officeId),
    bestByDollarTopChannel: cleanText(bestByDollar?.topChannel),
    bestByDollarUpliftExpectedMarginalGain: safeNum(bestByDollar?.upliftExpectedMarginalGain),
    bestByDollarUpliftLowMarginalGain: safeNum(bestByDollar?.upliftLowMarginalGain),
    bestByDollarUpliftUncertaintyBand: cleanText(bestByDollar?.upliftUncertaintyBand),
    bestByDollarUpliftSaturationPressure: cleanText(bestByDollar?.upliftSaturationPressure),
    bestByDollarUpliftSource: normalizeUpliftSource(bestByDollar?.upliftSource),
    bestByOrganizerHourOfficeId: cleanText(bestByOrganizerHour?.officeId),
    bestByOrganizerHourTopChannel: cleanText(bestByOrganizerHour?.topChannel),
    bestByOrganizerHourUpliftExpectedMarginalGain: safeNum(bestByOrganizerHour?.upliftExpectedMarginalGain),
    bestByOrganizerHourUpliftLowMarginalGain: safeNum(bestByOrganizerHour?.upliftLowMarginalGain),
    bestByOrganizerHourUpliftUncertaintyBand: cleanText(bestByOrganizerHour?.upliftUncertaintyBand),
    bestByOrganizerHourUpliftSaturationPressure: cleanText(bestByOrganizerHour?.upliftSaturationPressure),
    bestByOrganizerHourUpliftSource: normalizeUpliftSource(bestByOrganizerHour?.upliftSource),
    officeIds,
    topChannels,
  };
}

function buildExecutionUpliftArchiveSnapshot(stateLike = {}){
  const lastSummary = toObject(stateLike?.ui?.lastSummary);
  const uplift = toObject(lastSummary?.upliftSummary);
  return {
    source: normalizeUpliftSource(uplift?.source),
    bestChannel: cleanText(uplift?.bestChannel),
    expectedMarginalGain: safeNum(uplift?.weightedExpectedMarginalGain),
    lowMarginalGain: safeNum(uplift?.weightedLowMarginalGain),
    uncertaintySpread: safeNum(uplift?.uncertaintySpread),
    uncertaintyBand: cleanText(uplift?.uncertaintyBand),
    saturationUtilization: safeNum(uplift?.weightedSaturationUtilization),
    saturationPressure: cleanText(uplift?.saturationPressure),
  };
}

function toUnitRatio(numerator, denominator){
  const n = safeNum(numerator);
  const d = safeNum(denominator);
  if (n == null || d == null || d <= 0){
    return 0;
  }
  return Math.min(1, Math.max(0, n / d));
}

function buildVoterArchiveSnapshot(stateLike = {}){
  const voterData = toObject(stateLike?.voterData);
  const manifest = toObject(voterData?.manifest);
  const summary = toObject(voterData?.latestUniverseSummary);
  const ledger = toObject(voterData?.latestContactLedger);
  const historyIntel = toObject(voterData?.latestHistoryIntelligence);
  const frequencySegments = toObject(historyIntel?.frequencySegments);
  const universes = toObject(historyIntel?.universes);
  const ageSummary = toObject(historyIntel?.age);
  const ageBucketCounts = toObject(historyIntel?.ageBucketCounts);
  const ageBucketPercents = toObject(historyIntel?.ageBucketPercents);
  const rowCountFromSummary = safeNum(summary?.totalVoters);
  const rowCountFromLedger = safeNum(ledger?.totalRows);
  const rowCountFallback = Array.isArray(voterData?.rows) ? voterData.rows.length : 0;
  const rowCount = rowCountFromSummary ?? rowCountFromLedger ?? rowCountFallback;
  const mappedPrecinct = safeNum(summary?.mappedToPrecinct);
  const mappedTract = safeNum(summary?.mappedToTract);
  const mappedBlockGroup = safeNum(summary?.mappedToBlockGroup);
  const mappedPrecinctRate = toUnitRatio(mappedPrecinct, rowCount);
  const mappedTractRate = toUnitRatio(mappedTract, rowCount);
  const mappedBlockGroupRate = toUnitRatio(mappedBlockGroup, rowCount);
  return {
    scopingRule: VOTER_LAYER_SCOPING_RULE,
    adapterId: cleanText(manifest?.adapterId),
    sourceId: cleanText(manifest?.sourceId),
    importedAt: cleanText(manifest?.importedAt),
    mappedCanonicalFieldCount: Array.isArray(manifest?.mappedCanonicalFields)
      ? manifest.mappedCanonicalFields.length
      : null,
    ignoredHeaderCount: safeNum(manifest?.ignoredHeaderCount),
    rowCount,
    contactableVoters: safeNum(summary?.contactableVoters),
    mappedToPrecinct: mappedPrecinct,
    mappedToTract: mappedTract,
    mappedToBlockGroup: mappedBlockGroup,
    geoCoverageRate: Math.max(mappedBlockGroupRate, mappedTractRate, mappedPrecinctRate),
    contactableRate: toUnitRatio(summary?.contactableVoters, rowCount),
    recentContactRate: toUnitRatio(ledger?.recentlyContacted, rowCount),
    conversationRate: toUnitRatio(ledger?.totalConversations, ledger?.totalAttempts),
    supportIdentifiedRate: toUnitRatio(ledger?.supportIdentifiedCount, rowCount),
    superVotersCount: safeNum(frequencySegments?.superVoters),
    highFrequencyVotersCount: safeNum(frequencySegments?.highFrequencyVoters),
    mediumFrequencyVotersCount: safeNum(frequencySegments?.mediumFrequencyVoters),
    lowFrequencyVotersCount: safeNum(frequencySegments?.lowFrequencyVoters),
    dropoffVotersCount: safeNum(frequencySegments?.dropoffVoters),
    persuasionUniverseCount: safeNum(universes?.persuasionUniverse),
    mobilizationUniverseCount: safeNum(universes?.mobilizationUniverse),
    baseUniverseCount: safeNum(universes?.baseUniverse),
    ignoreUniverseCount: safeNum(universes?.ignoreUniverse),
    ageSource: cleanText(ageSummary?.source),
    ageKnownCoverageRate: safeNum(ageSummary?.knownAgeCoverageRate),
    ageOpportunityScore: safeNum(ageSummary?.opportunityScore),
    ageTurnoutRiskScore: safeNum(ageSummary?.turnoutRiskScore),
    ageOpportunityBucket: cleanText(ageSummary?.opportunityBucketLabel),
    ageTurnoutRiskBucket: cleanText(ageSummary?.turnoutRiskBucketLabel),
    ageBucketCounts: Object.keys(ageBucketCounts).length ? cloneArchivePayload(ageBucketCounts) : {},
    ageBucketPercents: Object.keys(ageBucketPercents).length ? cloneArchivePayload(ageBucketPercents) : {},
  };
}

export function makeForecastArchiveKey(context = {}){
  const campaignId = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  const officeToken = archiveOfficeScopeToken(context);
  return `${ARCHIVE_KEY_BASE}::${campaignId}::${officeToken}`;
}

export function readForecastArchive(context = {}, storageOverride){
  const store = resolveStorage(storageOverride);
  const key = makeForecastArchiveKey(context);
  const campaignId = normalizeCampaignId(context?.campaignId, DEFAULT_CAMPAIGN_ID);
  const officeId = normalizeOfficeId(context?.officeId, "");
  try{
    const collected = [];
    const scopedRows = parseArchiveRows(store.getItem(key));
    if (scopedRows.length){
      collected.push(...scopedRows);
    }

    // All-office context can aggregate office-scoped keys for the same campaign.
    if (!officeId){
      const officeScopedKeys = listCampaignArchiveKeys(store, campaignId);
      for (const campaignKey of officeScopedKeys){
        if (campaignKey === key) continue;
        collected.push(...parseArchiveRows(store.getItem(campaignKey)));
      }
    }

    // Compatibility read for pre-office-scope archive keys.
    collected.push(...parseArchiveRows(store.getItem(makeForecastArchiveLegacyCampaignKey(context))));

    if (!collected.length) return [];
    const scopedRowsOnly = collected.filter((row) => recordMatchesArchiveScope(row, context));
    return dedupeArchiveRows(scopedRowsOnly);
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
    governance: src.governance && typeof src.governance === "object" ? cloneArchivePayload(src.governance) : {},
    voter: src.voter && typeof src.voter === "object" ? cloneArchivePayload(src.voter) : {},
    execution: src.execution && typeof src.execution === "object" ? cloneArchivePayload(src.execution) : {},
    targeting: src.targeting && typeof src.targeting === "object" ? cloneArchivePayload(src.targeting) : {},
    budget: src.budget && typeof src.budget === "object" ? cloneArchivePayload(src.budget) : {},
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

/**
 * Canonical archive table row projection for Data surfaces.
 * Keeps row-level shaping out of runtime glue/render layers.
 *
 * @param {unknown[]} entries
 * @param {{ limit?: number }=} options
 * @returns {Array<{
 *   snapshotHash: string,
 *   recordedAt: string,
 *   scenarioName: string,
 *   forecastMargin: number|null,
 *   actualMargin: number|null,
 *   hasActual: boolean,
 *   targetingRowCount: number|null,
 *   officePathRowCount: number|null,
 *   notes: string,
 * }>}
 */
export function buildForecastArchiveTableRows(entries = [], options = {}){
  const list = Array.isArray(entries) ? entries : [];
  const limit = Math.max(0, Number(options?.limit) || 40);
  return list.slice(0, limit).map((entry) => {
    const marginSummary = buildForecastArchiveMarginSummary(entry);
    return {
      snapshotHash: cleanText(entry?.snapshotHash),
      recordedAt: cleanText(entry?.recordedAt),
      scenarioName: cleanText(entry?.scenarioName) || cleanText(entry?.scenarioId),
      forecastMargin: marginSummary.forecastMargin,
      actualMargin: marginSummary.actualMargin,
      hasActual: marginSummary.hasActualMargin,
      targetingRowCount: safeNum(entry?.targeting?.rowCount),
      officePathRowCount: safeNum(entry?.execution?.officePaths?.rowCount),
      notes: cleanText(entry?.notes),
    };
  });
}

/**
 * Canonical selected-archive projection for Data surfaces.
 * Keeps selected-entry shaping out of runtime glue/render layers.
 *
 * @param {unknown} entry
 * @returns {{
 *   snapshotHash: string,
 *   recordedAt: string,
 *   scenarioName: string,
 *   forecast: {
 *     margin: number|null,
 *     yourVotes: number|null,
 *     winThreshold: number|null,
 *     turnoutVotes: number|null,
 *   },
 *   actual: {
 *     margin: number|null,
 *     yourVotes: number|null,
 *     winThreshold: number|null,
 *     turnoutVotes: number|null,
 *     voteSharePct: number|null,
 *     winner: string,
 *     resultDate: string,
 *   },
 *   variance: {
 *     errorMargin: number|null,
 *   },
 *   templateMeta: {
 *     appliedTemplateId: string,
 *     appliedVersion: string,
 *   },
 *   workforce: {
 *     organizerCount: number|null,
 *     paidCanvasserCount: number|null,
 *     activeVolunteerCount: number|null,
 *   },
 *   budget: {
 *     includeOverhead: boolean,
 *     overheadAmount: number|null,
 *     objective: string,
 *     objectiveLabel: string,
 *   },
 *   execution: {
 *     officePaths: {
 *       statusText: string,
 *       rowCount: number|null,
 *       objectiveValueTotal: number|null,
 *       bestByDollarOfficeId: string,
 *       bestByDollarTopChannel: string,
 *       bestByDollarUpliftExpectedMarginalGain: number|null,
 *       bestByDollarUpliftLowMarginalGain: number|null,
 *       bestByDollarUpliftUncertaintyBand: string,
 *       bestByDollarUpliftSaturationPressure: string,
 *       bestByDollarUpliftSource: string,
 *       bestByOrganizerHourOfficeId: string,
 *       bestByOrganizerHourTopChannel: string,
 *       bestByOrganizerHourUpliftExpectedMarginalGain: number|null,
 *       bestByOrganizerHourUpliftLowMarginalGain: number|null,
 *       bestByOrganizerHourUpliftUncertaintyBand: string,
 *       bestByOrganizerHourUpliftSaturationPressure: string,
 *       bestByOrganizerHourUpliftSource: string,
 *       officeIds: string[],
 *       topChannels: string[],
 *     },
 *     uplift: {
 *       source: string,
 *       bestChannel: string,
 *       expectedMarginalGain: number|null,
 *       lowMarginalGain: number|null,
 *       uncertaintySpread: number|null,
 *       uncertaintyBand: string,
 *       saturationUtilization: number|null,
 *       saturationPressure: string,
 *     },
 *   },
 *   targeting: {
 *     presetId: string,
 *     modelId: string,
 *     rowCount: number|null,
 *     topTargetCount: number|null,
 *     expectedNetVoteValueTotal: number|null,
 *     topExpectedNetVoteValueTotal: number|null,
 *   },
 *   governance: {
 *     realismStatus: string,
 *     realismScore: number|null,
 *     dataQualityStatus: string,
 *     dataQualityScore: number|null,
 *     confidenceBand: string,
 *     confidenceScore: number|null,
 *     executionStatus: string,
 *     executionScore: number|null,
 *     executionTimelineExecutablePct: number|null,
 *     executionShortfallAttempts: number|null,
 *     executionUpliftSource: string,
 *     topWarning: string,
 *     topSensitivityDriver: string,
 *     learningSampleSize: number|null,
 *     learningTopSuggestion: string,
 *     learningRecommendation: string,
 *   },
 *   voter: {
 *     scopingRule: string,
 *     adapterId: string,
 *     sourceId: string,
 *     importedAt: string,
 *     rowCount: number|null,
 *     contactableVoters: number|null,
 *     mappedToPrecinct: number|null,
 *     mappedToTract: number|null,
 *     mappedToBlockGroup: number|null,
 *     geoCoverageRate: number|null,
 *     contactableRate: number|null,
 *   },
 *   notes: string,
 * } | null}
 */
export function buildForecastArchiveSelectedEntryView(entry){
  const row = toObject(entry);
  const snapshotHash = cleanText(row?.snapshotHash);
  if (!snapshotHash){
    return null;
  }
  const forecast = toObject(row?.forecast);
  const actual = toObject(row?.actual);
  const execution = toObject(row?.execution);
  const officePaths = toObject(execution?.officePaths);
  const uplift = toObject(execution?.uplift);
  const targeting = toObject(row?.targeting);
  const templateMeta = toObject(row?.templateMeta);
  const workforce = toObject(row?.workforce);
  const budget = toObject(row?.budget);
  const budgetOptimize = toObject(budget?.optimize);
  const governance = toObject(row?.governance);
  const voter = toObject(row?.voter);
  const marginSummary = buildForecastArchiveMarginSummary(row);
  return {
    snapshotHash,
    recordedAt: cleanText(row?.recordedAt),
    scenarioName: cleanText(row?.scenarioName) || cleanText(row?.scenarioId),
    forecast: {
      margin: marginSummary.forecastMargin,
      yourVotes: safeNum(forecast?.yourVotes),
      winThreshold: safeNum(forecast?.winThreshold),
      turnoutVotes: safeNum(forecast?.turnoutVotes),
    },
    actual: {
      margin: marginSummary.actualMargin,
      yourVotes: safeNum(actual?.yourVotes),
      winThreshold: safeNum(actual?.winThreshold),
      turnoutVotes: safeNum(actual?.turnoutVotes),
      voteSharePct: safeNum(actual?.voteSharePct),
      winner: cleanText(actual?.winner),
      resultDate: cleanText(actual?.resultDate),
    },
    variance: {
      errorMargin: marginSummary.errorMargin,
    },
    templateMeta: {
      appliedTemplateId: cleanText(templateMeta?.appliedTemplateId || row?.raceType),
      appliedVersion: cleanText(templateMeta?.appliedVersion),
    },
    workforce: {
      organizerCount: safeNum(workforce?.organizerCount),
      paidCanvasserCount: safeNum(workforce?.paidCanvasserCount),
      activeVolunteerCount: safeNum(workforce?.activeVolunteerCount),
    },
    budget: {
      includeOverhead: !!budget?.includeOverhead,
      overheadAmount: safeNum(budget?.overheadAmount),
      objective: cleanText(budgetOptimize?.objective),
      objectiveLabel: cleanText(forecast?.optimizationObjectiveLabel),
    },
    execution: {
      officePaths: {
        statusText: cleanText(officePaths?.statusText),
        rowCount: safeNum(officePaths?.rowCount),
        objectiveValueTotal: safeNum(officePaths?.objectiveValueTotal),
        bestByDollarOfficeId: cleanText(officePaths?.bestByDollarOfficeId),
        bestByDollarTopChannel: cleanText(officePaths?.bestByDollarTopChannel),
        bestByDollarUpliftExpectedMarginalGain: safeNum(officePaths?.bestByDollarUpliftExpectedMarginalGain),
        bestByDollarUpliftLowMarginalGain: safeNum(officePaths?.bestByDollarUpliftLowMarginalGain),
        bestByDollarUpliftUncertaintyBand: cleanText(officePaths?.bestByDollarUpliftUncertaintyBand),
        bestByDollarUpliftSaturationPressure: cleanText(officePaths?.bestByDollarUpliftSaturationPressure),
        bestByDollarUpliftSource: normalizeUpliftSource(officePaths?.bestByDollarUpliftSource),
        bestByOrganizerHourOfficeId: cleanText(officePaths?.bestByOrganizerHourOfficeId),
        bestByOrganizerHourTopChannel: cleanText(officePaths?.bestByOrganizerHourTopChannel),
        bestByOrganizerHourUpliftExpectedMarginalGain: safeNum(officePaths?.bestByOrganizerHourUpliftExpectedMarginalGain),
        bestByOrganizerHourUpliftLowMarginalGain: safeNum(officePaths?.bestByOrganizerHourUpliftLowMarginalGain),
        bestByOrganizerHourUpliftUncertaintyBand: cleanText(officePaths?.bestByOrganizerHourUpliftUncertaintyBand),
        bestByOrganizerHourUpliftSaturationPressure: cleanText(officePaths?.bestByOrganizerHourUpliftSaturationPressure),
        bestByOrganizerHourUpliftSource: normalizeUpliftSource(officePaths?.bestByOrganizerHourUpliftSource),
        officeIds: Array.isArray(officePaths?.officeIds)
          ? officePaths.officeIds.map((value) => cleanText(value)).filter(Boolean)
          : [],
        topChannels: Array.isArray(officePaths?.topChannels)
          ? officePaths.topChannels.map((value) => cleanText(value)).filter(Boolean)
          : [],
      },
      uplift: {
        source: normalizeUpliftSource(uplift?.source),
        bestChannel: cleanText(uplift?.bestChannel),
        expectedMarginalGain: safeNum(uplift?.expectedMarginalGain),
        lowMarginalGain: safeNum(uplift?.lowMarginalGain),
        uncertaintySpread: safeNum(uplift?.uncertaintySpread),
        uncertaintyBand: cleanText(uplift?.uncertaintyBand),
        saturationUtilization: safeNum(uplift?.saturationUtilization),
        saturationPressure: cleanText(uplift?.saturationPressure),
      },
    },
    targeting: {
      presetId: cleanText(targeting?.presetId),
      modelId: cleanText(targeting?.modelId),
      rowCount: safeNum(targeting?.rowCount),
      topTargetCount: safeNum(targeting?.topTargetCount),
      expectedNetVoteValueTotal: safeNum(targeting?.expectedNetVoteValueTotal),
      topExpectedNetVoteValueTotal: safeNum(targeting?.topExpectedNetVoteValueTotal),
    },
    governance: {
      realismStatus: cleanText(governance?.realismStatus),
      realismScore: safeNum(governance?.realismScore),
      dataQualityStatus: cleanText(governance?.dataQualityStatus),
      dataQualityScore: safeNum(governance?.dataQualityScore),
      confidenceBand: cleanText(governance?.confidenceBand),
      confidenceScore: safeNum(governance?.confidenceScore),
      executionStatus: cleanText(governance?.executionStatus),
      executionScore: safeNum(governance?.executionScore),
      executionTimelineExecutablePct: safeNum(governance?.executionTimelineExecutablePct),
      executionShortfallAttempts: safeNum(governance?.executionShortfallAttempts),
      executionUpliftSource: normalizeUpliftSource(governance?.executionUpliftSource),
      topWarning: cleanText(governance?.topWarning),
      topSensitivityDriver: cleanText(governance?.topSensitivityDriver),
      learningSampleSize: safeNum(governance?.learningSampleSize),
      learningTopSuggestion: cleanText(governance?.learningTopSuggestion),
      learningRecommendation: cleanText(governance?.learningRecommendation),
    },
    voter: {
      scopingRule: cleanText(voter?.scopingRule || VOTER_LAYER_SCOPING_RULE),
      adapterId: cleanText(voter?.adapterId),
      sourceId: cleanText(voter?.sourceId),
      importedAt: cleanText(voter?.importedAt),
      rowCount: safeNum(voter?.rowCount),
      contactableVoters: safeNum(voter?.contactableVoters),
      mappedToPrecinct: safeNum(voter?.mappedToPrecinct),
      mappedToTract: safeNum(voter?.mappedToTract),
      mappedToBlockGroup: safeNum(voter?.mappedToBlockGroup),
      geoCoverageRate: safeNum(voter?.geoCoverageRate),
      contactableRate: safeNum(voter?.contactableRate),
      recentContactRate: safeNum(voter?.recentContactRate),
      conversationRate: safeNum(voter?.conversationRate),
      supportIdentifiedRate: safeNum(voter?.supportIdentifiedRate),
      superVotersCount: safeNum(voter?.superVotersCount),
      highFrequencyVotersCount: safeNum(voter?.highFrequencyVotersCount),
      mediumFrequencyVotersCount: safeNum(voter?.mediumFrequencyVotersCount),
      lowFrequencyVotersCount: safeNum(voter?.lowFrequencyVotersCount),
      dropoffVotersCount: safeNum(voter?.dropoffVotersCount),
      persuasionUniverseCount: safeNum(voter?.persuasionUniverseCount),
      mobilizationUniverseCount: safeNum(voter?.mobilizationUniverseCount),
      baseUniverseCount: safeNum(voter?.baseUniverseCount),
      ignoreUniverseCount: safeNum(voter?.ignoreUniverseCount),
      ageSource: cleanText(voter?.ageSource),
      ageKnownCoverageRate: safeNum(voter?.ageKnownCoverageRate),
      ageOpportunityScore: safeNum(voter?.ageOpportunityScore),
      ageTurnoutRiskScore: safeNum(voter?.ageTurnoutRiskScore),
      ageOpportunityBucket: cleanText(voter?.ageOpportunityBucket),
      ageTurnoutRiskBucket: cleanText(voter?.ageTurnoutRiskBucket),
      ageBucketCounts: voter?.ageBucketCounts && typeof voter.ageBucketCounts === "object"
        ? cloneArchivePayload(voter.ageBucketCounts)
        : {},
      ageBucketPercents: voter?.ageBucketPercents && typeof voter.ageBucketPercents === "object"
        ? cloneArchivePayload(voter.ageBucketPercents)
        : {},
    },
    notes: cleanText(row?.notes),
  };
}

/**
 * Canonical archive timestamp display formatter used by archive option labels.
 *
 * @param {unknown} value
 * @param {string=} fallback
 * @returns {string}
 */
export function formatForecastArchiveRecordedAt(value, fallback = ""){
  const raw = cleanText(value);
  if (!raw) return fallback;
  return raw.replace("T", " ").replace("Z", "");
}

/**
 * Canonical archive select-option projection for Data surfaces.
 *
 * @param {unknown[]} entries
 * @returns {Array<{ value: string, label: string }>}
 */
export function buildForecastArchiveOptions(entries = []){
  const rows = Array.isArray(entries) ? entries : [];
  return rows.map((entry, idx) => {
    const hash = cleanText(entry?.snapshotHash);
    const whenLabel = formatForecastArchiveRecordedAt(entry?.recordedAt, "");
    const scenario = cleanText(entry?.scenarioName) || cleanText(entry?.scenarioId);
    const label = `${whenLabel}${scenario ? ` — ${scenario}` : ""}`.trim() || `Forecast ${idx + 1}`;
    return {
      value: hash,
      label,
    };
  }).filter((row) => !!row.value);
}

/**
 * Canonical archive selection resolver.
 *
 * @param {{
 *   preferredHash?: unknown,
 *   options?: Array<{ value?: unknown }>,
 *   lookup?: Map<string, any> | null,
 * }} input
 * @returns {string}
 */
export function resolveForecastArchiveSelectedHash({
  preferredHash = "",
  options = [],
  lookup = null,
} = {}){
  const preferred = cleanText(preferredHash);
  if (preferred){
    if (lookup && typeof lookup.has === "function"){
      if (lookup.has(preferred)) return preferred;
    } else if (Array.isArray(options) && options.some((opt) => cleanText(opt?.value) === preferred)){
      return preferred;
    }
  }
  return cleanText(options?.[0]?.value);
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
      ballotBaseline: {
        candidateHistoryRecordCount: safeNum(res?.validation?.candidateHistory?.recordCount),
        candidateHistoryCoverageBand: cleanText(res?.validation?.candidateHistory?.coverageBand),
        candidateHistoryConfidenceBand: cleanText(res?.validation?.candidateHistory?.confidenceBand),
        candidateHistoryYourVotesDelta: safeNum(res?.expected?.candidateHistoryImpact?.yourVotesDelta),
      },
    },
    workforce: s?.ui?.twCapOutlookLatest?.workforce || {},
    governance: s?.ui?.lastGovernanceSnapshot && typeof s.ui.lastGovernanceSnapshot === "object"
      ? { ...s.ui.lastGovernanceSnapshot }
      : {},
    voter: buildVoterArchiveSnapshot(s),
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
      officePaths: buildOfficePathArchiveSnapshot(s),
      uplift: buildExecutionUpliftArchiveSnapshot(s),
    },
    targeting: buildTargetingArchiveSnapshot(s),
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
