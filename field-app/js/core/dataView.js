// @ts-check

import {
  formatFixedNumber,
  formatPercentFromPct,
  formatStatusWithScoreOutOfHundred,
  formatWholeNumberByMode,
  roundWholeNumberByMode,
} from "./utils.js";
import { formatUpliftSourceLabel } from "./upliftSource.js";
import {
  formatVoterSourceRef,
  inferVoterInputFormat,
  listCanonicalVoterFieldTiers,
  listVoterAdapterOptions,
} from "./voterDataLayer.js";

export const DATA_STATUS_AWAITING_STORAGE = "Awaiting storage";
export const DATA_ARCHIVE_DETAIL_FALLBACK = "No archive snapshot selected.";
export const DATA_LEARNING_LABEL_FALLBACK = "Learning guidance pending.";
export const DATA_LEARNING_RECOMMENDATION_FALLBACK = "Record certified outcomes to unlock calibration guidance.";
export const DATA_VOTER_IMPORT_STATUS_FALLBACK = "No voter import run in this session.";
export const DATA_IMPORT_FILE_STATUS_FALLBACK = "No import file selected.";
export const DATA_BACKUP_SELECTION_FALLBACK = "No backup selected.";

function toFiniteNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asObject(value){
  return value && typeof value === "object" ? value : {};
}

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

/**
 * @param {unknown} rawValue
 * @returns {number | null}
 */
export function parseDataOptionalNumber(rawValue){
  const text = cleanText(rawValue);
  if (!text){
    return null;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} scope
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataScopeCampaign(scope, fallback = "default"){
  const src = asObject(scope);
  const campaignId = cleanText(src?.campaignId);
  const campaignName = cleanText(src?.campaignName);
  if (campaignName && campaignId){
    return `${campaignName} (${campaignId})`;
  }
  return campaignName || campaignId || String(fallback || "default");
}

/**
 * @param {unknown} scope
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataScopeOffice(scope, fallback = "all"){
  const src = asObject(scope);
  const officeId = cleanText(src?.officeId);
  return officeId || String(fallback || "all");
}

/**
 * @param {unknown} scope
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataScopeLocks(scope, fallback = "none"){
  const src = asObject(scope);
  const locks = [];
  if (src?.isCampaignLocked) locks.push("campaign");
  if (src?.isOfficeLocked) locks.push("office");
  if (src?.isScenarioLocked) locks.push("scenario");
  return locks.length ? locks.join(", ") : String(fallback || "none");
}

/**
 * @param {unknown} value
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataArchiveCount(value, fallback = "—"){
  const n = toFiniteNumber(value);
  if (n == null) return fallback;
  return formatWholeNumberByMode(Math.max(0, n), { mode: "round", fallback });
}

/**
 * @param {unknown} value
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataSampleCount(value, fallback = "0"){
  const n = toFiniteNumber(value);
  if (n == null) return fallback;
  return formatWholeNumberByMode(Math.max(0, n), { mode: "floor", fallback });
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataArchiveDecimal(value, digits = 2, fallback = "—"){
  const n = toFiniteNumber(value);
  if (n == null) return fallback;
  const placesRaw = roundWholeNumberByMode(Number(digits), { mode: "floor", fallback: 0 }) ?? 0;
  const places = Math.max(0, placesRaw);
  return formatFixedNumber(n, places, fallback);
}

/**
 * @param {unknown} value
 * @param {{ max?: number, digits?: number, fallback?: string }=} options
 * @returns {string}
 */
export function formatDataRatePercent(value, options = {}){
  const n = toFiniteNumber(value);
  if (n == null){
    return String(options?.fallback || "—");
  }
  const max = Number.isFinite(Number(options?.max)) ? Number(options.max) : 1;
  const digitsRaw = roundWholeNumberByMode(Number(options?.digits), { mode: "floor", fallback: 0 }) ?? 0;
  const digits = Math.max(0, digitsRaw);
  const clamped = Math.max(0, Math.min(max, n));
  return `${formatFixedNumber(clamped * 100, digits, "0")}%`;
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataPercentFromPct(value, digits = 1, fallback = "—"){
  return formatPercentFromPct(value, digits, fallback);
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataSignedDecimal(value, digits = 2, fallback = "—"){
  const n = toFiniteNumber(value);
  if (n == null) return fallback;
  const placesRaw = roundWholeNumberByMode(Number(digits), { mode: "floor", fallback: 0 }) ?? 0;
  const places = Math.max(0, placesRaw);
  const out = formatFixedNumber(n, places, fallback);
  return n > 0 ? `+${out}` : out;
}

/**
 * @param {unknown} value
 * @param {string=} fallback
 * @returns {string}
 */
export function formatDataArchiveRecordedAt(value, fallback = "—"){
  const raw = cleanText(value);
  if (!raw) return fallback;
  return raw.replace("T", " ").replace("Z", "");
}

/**
 * @param {unknown} officeId
 * @param {unknown} topChannel
 * @param {{ fallback?: string }=} options
 * @returns {string}
 */
export function buildDataArchiveOfficeWinnerText(officeId, topChannel, options = {}){
  const fallback = String(options?.fallback || "—");
  const office = cleanText(officeId);
  if (!office){
    return fallback;
  }
  const channel = cleanText(topChannel);
  return channel ? `${office} · top ${channel}` : office;
}

/**
 * @param {unknown} adapterId
 * @param {unknown} sourceId
 * @param {string=} fallback
 * @returns {string}
 */
export function buildDataVoterSourceLabel(adapterId, sourceId, fallback = "—"){
  return formatVoterSourceRef(adapterId, sourceId, { fallback });
}

function buildDataArchiveTemplateSummary(entry){
  const row = asObject(entry);
  const templateMeta = asObject(row?.templateMeta);
  const appliedTemplateId = cleanText(templateMeta?.appliedTemplateId || row?.raceType);
  const appliedVersion = cleanText(templateMeta?.appliedVersion);
  if (!appliedTemplateId){
    return "—";
  }
  return appliedVersion ? `${appliedTemplateId} (v${appliedVersion})` : appliedTemplateId;
}

function buildDataArchiveWorkforceSummary(workforce){
  const src = asObject(workforce);
  const organizerRaw = toFiniteNumber(src?.organizerCount);
  const paidRaw = toFiniteNumber(src?.paidCanvasserCount);
  const volunteerRaw = toFiniteNumber(src?.activeVolunteerCount);
  if (organizerRaw == null && paidRaw == null && volunteerRaw == null){
    return "—";
  }
  const organizers = formatDataArchiveCount(src?.organizerCount, "0");
  const paid = formatDataArchiveCount(src?.paidCanvasserCount, "0");
  const volunteers = formatDataArchiveCount(src?.activeVolunteerCount, "0");
  return `Org ${organizers} · Paid ${paid} · Vol ${volunteers}`;
}

function buildDataArchiveBudgetSummary(entry){
  const row = asObject(entry);
  const budget = asObject(row?.budget);
  const optimize = asObject(budget?.optimize);
  const forecast = asObject(row?.forecast);
  const objectiveRaw = cleanText(forecast?.optimizationObjectiveLabel || optimize?.objective);
  const includeOverhead = !!budget?.includeOverhead;
  const overheadAmountRaw = toFiniteNumber(budget?.overheadAmount);
  if (!objectiveRaw && !includeOverhead && overheadAmountRaw == null){
    return "—";
  }
  const objective = objectiveRaw || "objective";
  const overheadAmount = formatDataArchiveCount(budget?.overheadAmount, "0");
  const overheadText = includeOverhead
    ? `overhead on (${overheadAmount})`
    : "overhead off";
  return `${objective} · ${overheadText}`;
}

/**
 * Canonical selected-archive detail summary for Data surfaces.
 * Keeps archive-detail interpretation out of UI render modules.
 *
 * @param {unknown} selectedEntry
 * @returns {{
 *   targetRows: string,
 *   topTargets: string,
 *   targetValueTotal: string,
 *   officePathRows: string,
 *   officeBestByDollar: string,
 *   officeBestByOrganizerHour: string,
 *   officeBestByDollarUpliftExpected: string,
 *   officeBestByDollarUpliftSource: string,
 *   officeBestByOrganizerHourUpliftExpected: string,
 *   officeBestByOrganizerHourUpliftSource: string,
 *   officePathStatus: string,
 *   upliftExpected: string,
 *   upliftLow: string,
 *   upliftBestChannel: string,
 *   upliftSource: string,
 *   upliftUncertaintyBand: string,
 *   upliftSaturationPressure: string,
 *   templateSummary: string,
 *   workforceSummary: string,
 *   budgetSummary: string,
 *   voterRows: string,
 *   voterScopingRule: string,
 *   voterSource: string,
 *   voterGeoCoverage: string,
 *   voterContactableRate: string,
 *   governanceConfidence: string,
 *   governanceExecution: string,
 *   governanceUpliftSource: string,
 *   governanceTopWarning: string,
 *   governanceLearning: string,
 *   governanceRecommendation: string,
 * }}
 */
export function buildDataArchiveSelectedSnapshotView(selectedEntry){
  const entry = asObject(selectedEntry);
  const targeting = asObject(entry?.targeting);
  const execution = asObject(entry?.execution);
  const officePaths = asObject(execution?.officePaths);
  const uplift = asObject(execution?.uplift);
  const governance = asObject(entry?.governance);
  const voter = asObject(entry?.voter);
  const voterSource = buildDataVoterSourceLabel(voter?.adapterId, voter?.sourceId, "—");
  return {
    targetRows: formatDataArchiveCount(targeting?.rowCount),
    topTargets: formatDataArchiveCount(targeting?.topTargetCount),
    targetValueTotal: formatDataArchiveDecimal(targeting?.expectedNetVoteValueTotal, 2),
    officePathRows: formatDataArchiveCount(officePaths?.rowCount),
    officeBestByDollar: buildDataArchiveOfficeWinnerText(
      officePaths?.bestByDollarOfficeId,
      officePaths?.bestByDollarTopChannel,
    ),
    officeBestByOrganizerHour: buildDataArchiveOfficeWinnerText(
      officePaths?.bestByOrganizerHourOfficeId,
      officePaths?.bestByOrganizerHourTopChannel,
    ),
    officeBestByDollarUpliftExpected: formatDataRatePercent(officePaths?.bestByDollarUpliftExpectedMarginalGain, { max: 1.25, digits: 0 }),
    officeBestByDollarUpliftSource: formatUpliftSourceLabel(officePaths?.bestByDollarUpliftSource, { unknownLabel: "—" }),
    officeBestByOrganizerHourUpliftExpected: formatDataRatePercent(officePaths?.bestByOrganizerHourUpliftExpectedMarginalGain, { max: 1.25, digits: 0 }),
    officeBestByOrganizerHourUpliftSource: formatUpliftSourceLabel(officePaths?.bestByOrganizerHourUpliftSource, { unknownLabel: "—" }),
    officePathStatus: cleanText(officePaths?.statusText) || DATA_ARCHIVE_DETAIL_FALLBACK,
    upliftExpected: formatDataRatePercent(uplift?.expectedMarginalGain, { max: 1.25, digits: 0 }),
    upliftLow: formatDataRatePercent(uplift?.lowMarginalGain, { max: 1.25, digits: 0 }),
    upliftBestChannel: cleanText(uplift?.bestChannel) || "—",
    upliftSource: formatUpliftSourceLabel(uplift?.source, { unknownLabel: "—" }),
    upliftUncertaintyBand: cleanText(uplift?.uncertaintyBand) || "unknown",
    upliftSaturationPressure: cleanText(uplift?.saturationPressure) || "unknown",
    templateSummary: buildDataArchiveTemplateSummary(entry),
    workforceSummary: buildDataArchiveWorkforceSummary(entry?.workforce),
    budgetSummary: buildDataArchiveBudgetSummary(entry),
    voterRows: formatDataArchiveCount(voter?.rowCount),
    voterScopingRule: cleanText(voter?.scopingRule) || "—",
    voterSource,
    voterGeoCoverage: formatDataRatePercent(voter?.geoCoverageRate, { max: 1, digits: 0 }),
    voterContactableRate: formatDataRatePercent(voter?.contactableRate, { max: 1, digits: 0 }),
    governanceConfidence: formatStatusWithScoreOutOfHundred(governance?.confidenceBand, governance?.confidenceScore, 1),
    governanceExecution: formatStatusWithScoreOutOfHundred(governance?.executionStatus, governance?.executionScore, 0),
    governanceUpliftSource: formatUpliftSourceLabel(governance?.executionUpliftSource, { unknownLabel: "—" }),
    governanceTopWarning: cleanText(governance?.topWarning) || "—",
    governanceLearning: cleanText(governance?.learningTopSuggestion) || "—",
    governanceRecommendation: cleanText(governance?.learningRecommendation) || "—",
  };
}

/**
 * Canonical live voter-layer summary view for Data surfaces.
 * @param {unknown} voterLayer
 * @returns {{
 *   scopingRule: string,
 *   source: string,
 *   importedAt: string,
 *   rowCount: string,
 *   mappedCanonicalFields: string,
 *   ignoredHeaders: string,
 *   geoCoverage: string,
 *   contactableRate: string,
 *   recentContactRate: string,
 *   conversationRate: string,
 * }}
 */
export function buildDataVoterLayerSnapshotView(voterLayer){
  const src = asObject(voterLayer);
  return {
    scopingRule: cleanText(src?.scopingRule) || "—",
    source: buildDataVoterSourceLabel(src?.adapterId, src?.sourceId, "—"),
    importedAt: formatDataArchiveRecordedAt(src?.importedAt),
    rowCount: formatDataArchiveCount(src?.rowCount),
    mappedCanonicalFields: formatDataArchiveCount(src?.mappedCanonicalFieldCount),
    ignoredHeaders: formatDataArchiveCount(src?.ignoredHeaderCount),
    geoCoverage: formatDataRatePercent(src?.geoCoverageRate, { max: 1, digits: 0 }),
    contactableRate: formatDataRatePercent(src?.contactableRate, { max: 1, digits: 0 }),
    recentContactRate: formatDataRatePercent(src?.recentContactRate, { max: 1, digits: 0 }),
    conversationRate: formatDataRatePercent(src?.conversationRate, { max: 1, digits: 0 }),
  };
}

/**
 * Canonical voter-adapter select options for Data import surfaces.
 * @returns {Array<{ id: string, label: string }>}
 */
export function listDataVoterAdapterOptions(){
  return listVoterAdapterOptions().map((row) => ({
    id: cleanText(row?.id) || "canonical",
    label: cleanText(row?.label) || "Canonical v1",
  }));
}

/**
 * Canonical voter-file format inference for Data import surfaces.
 * @param {unknown} fileName
 * @returns {"auto" | "csv" | "json"}
 */
export function inferDataVoterInputFormat(fileName){
  return inferVoterInputFormat(fileName, { fallback: "auto" });
}

/**
 * Canonical voter-schema guide view for Data import surfaces.
 * @returns {{
 *   requiredFields: string,
 *   recommendedFields: string,
 *   requiredCount: string,
 *   recommendedCount: string,
 * }}
 */
export function buildDataVoterSchemaGuideView(){
  const tiers = listCanonicalVoterFieldTiers();
  const required = Array.isArray(tiers?.required) ? tiers.required : [];
  const recommended = Array.isArray(tiers?.recommended) ? tiers.recommended : [];
  return {
    requiredFields: required.length ? required.join(", ") : "—",
    recommendedFields: recommended.length ? recommended.join(", ") : "—",
    requiredCount: formatDataArchiveCount(required.length, "0"),
    recommendedCount: formatDataArchiveCount(recommended.length, "0"),
  };
}

/**
 * Canonical learning guidance view for Data surfaces.
 *
 * @param {unknown} learningLoop
 * @returns {{
 *   label: string,
 *   recommendation: string,
 *   severity: string,
 * }}
 */
export function buildDataArchiveLearningView(learningLoop){
  const learning = asObject(learningLoop);
  const topSuggestion = asObject(learning?.topSuggestion);
  const label = cleanText(topSuggestion?.label) || DATA_LEARNING_LABEL_FALLBACK;
  const recommendation = cleanText(topSuggestion?.recommendation) || DATA_LEARNING_RECOMMENDATION_FALLBACK;
  const severity = cleanText(topSuggestion?.severity).toLowerCase() || "warn";
  return {
    label,
    recommendation,
    severity,
  };
}

/**
 * Canonical learning-signal snapshot view for Data surfaces.
 * @param {unknown} learningLoop
 * @returns {{
 *   voterRows: string,
 *   voterGeoCoverage: string,
 *   voterContactableRate: string,
 * }}
 */
export function buildDataArchiveLearningSignalsView(learningLoop){
  const learning = asObject(learningLoop);
  const signals = asObject(learning?.signals);
  return {
    voterRows: formatDataArchiveCount(signals?.voterRows),
    voterGeoCoverage: formatDataRatePercent(signals?.voterGeoCoverageRate, { max: 1, digits: 0 }),
    voterContactableRate: formatDataRatePercent(signals?.voterContactableRate, { max: 1, digits: 0 }),
  };
}

/**
 * @param {unknown} summary
 * @param {unknown[]=} rows
 * @returns {{
 *   totalEntries: number,
 *   withActualEntries: number,
 *   pendingEntries: number,
 * }}
 */
export function normalizeDataArchiveSummary(summary, rows = []){
  const src = asObject(summary);
  const list = Array.isArray(rows) ? rows : [];
  const totalEntries = Number.isFinite(Number(src?.totalEntries))
    ? Math.max(0, roundWholeNumberByMode(src.totalEntries, { mode: "floor", fallback: 0 }) ?? 0)
    : list.length;
  const withActualEntries = Number.isFinite(Number(src?.withActualEntries))
    ? Math.max(0, roundWholeNumberByMode(src.withActualEntries, { mode: "floor", fallback: 0 }) ?? 0)
    : list.filter((row) => toFiniteNumber(row?.actualMargin) != null).length;
  return {
    totalEntries,
    withActualEntries: Math.min(totalEntries, withActualEntries),
    pendingEntries: Math.max(0, totalEntries - withActualEntries),
  };
}

/**
 * @param {unknown} summary
 * @param {unknown[]=} rows
 * @returns {string}
 */
export function buildDataArchiveTableSummaryText(summary, rows = []){
  const normalized = normalizeDataArchiveSummary(summary, rows);
  if (!normalized.totalEntries){
    return "No archive records yet.";
  }
  const totalText = formatWholeNumberByMode(normalized.totalEntries, { mode: "round", fallback: "0" });
  const actualText = formatWholeNumberByMode(normalized.withActualEntries, { mode: "round", fallback: "0" });
  const pendingText = formatWholeNumberByMode(normalized.pendingEntries, { mode: "round", fallback: "0" });
  return `Showing ${totalText} archived forecasts (${actualText} with actuals, ${pendingText} pending).`;
}

/**
 * @param {unknown} fileName
 * @param {{ fallback?: string }=} options
 * @returns {string}
 */
export function buildDataImportFileStatus(fileName, options = {}){
  const fallback = String(options?.fallback || DATA_IMPORT_FILE_STATUS_FALLBACK);
  const name = cleanText(fileName);
  return name ? `Selected import: ${name}` : fallback;
}

/**
 * @param {unknown[]} backupOptions
 * @returns {number}
 */
export function countDataBackupOptions(backupOptions){
  return (Array.isArray(backupOptions) ? backupOptions : [])
    .filter((row) => cleanText(row?.value))
    .length;
}

/**
 * @param {unknown[]} backupOptions
 * @param {unknown} selectedValue
 * @param {{ fallback?: string }=} options
 * @returns {string}
 */
export function buildDataRestoreSelectionLabel(backupOptions, selectedValue, options = {}){
  const fallback = String(options?.fallback || DATA_BACKUP_SELECTION_FALLBACK);
  const selected = cleanText(selectedValue);
  if (!selected){
    return fallback;
  }
  const optionsList = Array.isArray(backupOptions) ? backupOptions : [];
  const match = optionsList.find((row) => cleanText(row?.value) === selected);
  return cleanText(match?.label) || fallback;
}

/**
 * @param {boolean} strictEnabled
 * @param {string} hashBanner
 * @param {string} warnBanner
 * @param {number} backupCount
 * @returns {string}
 */
export function deriveDataPolicyCardStatus(strictEnabled, hashBanner, warnBanner, backupCount){
  if (hashBanner || warnBanner){
    return "Check import";
  }
  if (strictEnabled){
    return "Strict mode";
  }
  return backupCount > 0 ? "Restore ready" : "No backups";
}

/**
 * @param {string} importFileStatus
 * @returns {string}
 */
export function deriveDataExchangeCardStatus(importFileStatus){
  const lower = String(importFileStatus || "").toLowerCase();
  if (lower.includes("selected import:")){
    return "File staged";
  }
  return "Ready";
}

/**
 * @param {string} usbStatus
 * @returns {string}
 */
export function deriveDataStorageCardStatus(usbStatus){
  const lower = String(usbStatus || "").toLowerCase();
  if (lower.includes("browser storage")){
    return "Browser storage";
  }
  if (lower.includes("connected") || lower.includes("linked")){
    return "Folder linked";
  }
  if (lower.includes("connect")){
    return "Awaiting folder";
  }
  return "Folder linked";
}

/**
 * @param {string} sampleSizeText
 * @param {string} biasText
 * @param {string} archiveSummary
 * @returns {string}
 */
export function deriveDataAuditCardStatus(sampleSizeText, biasText, archiveSummary){
  const sampleSize = Number(String(sampleSizeText || "").replace(/[^\d.-]/g, ""));
  const bias = String(biasText || "").toLowerCase();
  const summary = String(archiveSummary || "").toLowerCase();
  if (!summary || summary.includes("no archive")){
    return "Awaiting archive";
  }
  if (!Number.isFinite(sampleSize) || sampleSize <= 0){
    return "Archive only";
  }
  if (bias.includes("overestimate") || bias.includes("underestimate")){
    return "Bias watch";
  }
  return "Learning active";
}

/**
 * Canonical audit-card status derivation from archive + model-audit metrics.
 * Keeps status math out of UI text-readback flows.
 *
 * @param {unknown} modelAudit
 * @param {unknown} archiveSummary
 * @returns {string}
 */
export function deriveDataAuditCardStatusFromMetrics(modelAudit, archiveSummary){
  const audit = asObject(modelAudit);
  const summary = asObject(archiveSummary);
  const totalEntries = toFiniteNumber(summary?.totalEntries);
  if (!(totalEntries != null && totalEntries > 0)){
    return "Awaiting archive";
  }
  const sampleSize = toFiniteNumber(audit?.sampleSize);
  if (!(sampleSize != null && sampleSize > 0)){
    return "Archive only";
  }
  const biasDirection = cleanText(audit?.biasDirection).toLowerCase();
  if (biasDirection === "overestimate" || biasDirection === "underestimate"){
    return "Bias watch";
  }
  return "Learning active";
}

/**
 * @param {boolean} strictEnabled
 * @param {boolean} hasHashBanner
 * @param {boolean} hasWarnBanner
 * @param {string} usbStatus
 * @returns {string}
 */
export function deriveDataSummaryCardStatus(strictEnabled, hasHashBanner, hasWarnBanner, usbStatus){
  if (hasHashBanner || hasWarnBanner){
    return "Watch policy";
  }
  const lower = String(usbStatus || "").toLowerCase();
  if (strictEnabled){
    return lower.includes("browser storage") ? "Strict local" : "Strict external";
  }
  return lower.includes("browser storage") ? "Stable" : "External ready";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyDataStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(restore ready|ready|browser storage|folder linked|stable|external ready|learning active|archive only)/.test(lower)){
    return "ok";
  }
  if (/(check import)/.test(lower)){
    return "bad";
  }
  if (/(strict|watch policy|file staged|awaiting folder|no backups|awaiting archive|bias watch)/.test(lower)){
    return "warn";
  }
  return "neutral";
}

/**
 * Canonical Data-surface summary projection.
 * Keeps Data-card status and summary text derivation out of UI render modules.
 *
 * @param {unknown} dataView
 * @returns {{
 *   strictImportText: string,
 *   backupCountText: string,
 *   hashBannerSummary: string,
 *   warnBannerSummary: string,
 *   usbStatusSummary: string,
 *   restoreSelection: string,
 *   importFileSummary: string,
 *   policyCardStatus: string,
 *   exchangeCardStatus: string,
 *   storageCardStatus: string,
 *   auditCardStatus: string,
 *   summaryCardStatus: string,
 * }}
 */
export function buildDataSurfaceSummaryView(dataView){
  const view = asObject(dataView);
  const backupOptions = Array.isArray(view?.backupOptions) ? view.backupOptions : [];
  const backupCount = countDataBackupOptions(backupOptions);
  const strictEnabled = !!view?.strictImport;
  const hashBanner = cleanText(view?.hashBannerText);
  const warnBanner = cleanText(view?.warnBannerText);
  const usbStatus = cleanText(view?.usbStatus) || "Using browser storage only.";
  const importFileSummary = buildDataImportFileStatus(view?.importFileName);
  const archive = asObject(view?.forecastArchive);

  return {
    strictImportText: strictEnabled ? "ON" : "OFF",
    backupCountText: String(backupCount),
    hashBannerSummary: hashBanner || "Hidden",
    warnBannerSummary: warnBanner || "Hidden",
    usbStatusSummary: usbStatus,
    restoreSelection: buildDataRestoreSelectionLabel(backupOptions, view?.selectedBackup),
    importFileSummary,
    policyCardStatus: deriveDataPolicyCardStatus(strictEnabled, hashBanner, warnBanner, backupCount),
    exchangeCardStatus: deriveDataExchangeCardStatus(importFileSummary),
    storageCardStatus: deriveDataStorageCardStatus(usbStatus),
    auditCardStatus: deriveDataAuditCardStatusFromMetrics(archive?.modelAudit, archive?.summary),
    summaryCardStatus: deriveDataSummaryCardStatus(strictEnabled, !!hashBanner, !!warnBanner, usbStatus),
  };
}
