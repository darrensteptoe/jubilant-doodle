// @ts-check
import { clamp, safeNum } from "./utils.js";
import {
  OFFICE_CONTEXT_CANONICAL_VALUES,
  listCanonicalOfficeContextOptions,
} from "./officeContextLabels.js";

const RECORD_ID_PREFIX = "ch_";

export const CANDIDATE_HISTORY_ELECTION_TYPE_OPTIONS = Object.freeze([
  Object.freeze({ value: "primary", label: "Primary" }),
  Object.freeze({ value: "general", label: "General" }),
  Object.freeze({ value: "special", label: "Special" }),
]);

export const CANDIDATE_HISTORY_INCUMBENCY_OPTIONS = Object.freeze([
  Object.freeze({ value: "incumbent", label: "Incumbent" }),
  Object.freeze({ value: "challenger", label: "Challenger" }),
  Object.freeze({ value: "open", label: "Open seat" }),
]);

export const CANDIDATE_HISTORY_CANONICAL_OFFICE_IDS = Object.freeze(OFFICE_CONTEXT_CANONICAL_VALUES.slice());

export const CANDIDATE_HISTORY_OFFICE_OPTIONS = Object.freeze(
  listCanonicalOfficeContextOptions({ includeBlank: true, blankLabel: "All compatible offices" })
    .map((row) => Object.freeze({ value: row.value, label: row.label })),
);

const ELECTION_TYPE_SET = new Set(CANDIDATE_HISTORY_ELECTION_TYPE_OPTIONS.map((row) => row.value));
const INCUMBENCY_SET = new Set(CANDIDATE_HISTORY_INCUMBENCY_OPTIONS.map((row) => row.value));
const CANDIDATE_HISTORY_CANONICAL_OFFICE_SET = new Set(CANDIDATE_HISTORY_CANONICAL_OFFICE_IDS);
const CANDIDATE_HISTORY_OFFICE_ALIAS_TO_CANONICAL = Object.freeze({
  governor: "statewide_executive",
  gov: "statewide_executive",
  gubernatorial: "statewide_executive",
  "statewide governor": "statewide_executive",
  "statewide executive": "statewide_executive",
  "lt governor": "statewide_executive",
  "lieutenant governor": "statewide_executive",
  "attorney general": "statewide_executive",
  "secretary of state": "statewide_executive",
  comptroller: "statewide_executive",
  treasurer: "statewide_executive",

  "us senate": "statewide_federal",
  "senate statewide": "statewide_federal",
  "statewide federal": "statewide_federal",

  "us house": "congressional_district",
  congress: "congressional_district",
  congressional: "congressional_district",
  "congressional district": "congressional_district",

  "state house": "state_house",
  "state representative": "state_house",
  "state rep": "state_house",
  "lower chamber": "state_house",

  "state senate": "state_senate",
  "upper chamber": "state_senate",

  countywide: "countywide",
  "county executive": "countywide",
  "county clerk": "countywide",
  "county board president": "countywide",

  mayor: "municipal_executive",
  "municipal executive": "municipal_executive",
  "city executive": "municipal_executive",

  "city council": "municipal_legislative",
  alderman: "municipal_legislative",
  alderperson: "municipal_legislative",
  ward: "municipal_legislative",
  "municipal legislative": "municipal_legislative",

  judicial: "judicial_other",
  judge: "judicial_other",
});
const CANDIDATE_HISTORY_OFFICE_LEVEL_TO_CANONICAL = Object.freeze({
  state_legislative_lower: "state_house",
  state_legislative_upper: "state_senate",
});
const CANDIDATE_HISTORY_LEGACY_RACE_BUCKET_TO_CANONICAL = Object.freeze({
  federal: "congressional_district",
  state_leg: "state_house",
  municipal: "municipal_legislative",
  county: "countywide",
});
const REQUIRED_COMPLETENESS_FIELDS = Object.freeze([
  "office",
  "cycleYear",
  "electionType",
  "candidateName",
  "party",
  "incumbencyStatus",
  "voteShare",
  "margin",
  "turnoutContext",
  "repeatCandidate",
  "overUnderPerformancePct",
]);

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function normalizeOfficeToken(value){
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/\bu\s*\.?\s*s\.?\b/g, "us")
    .replace(/[_-]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalOfficeForNormalizedToken(token){
  const direct = CANDIDATE_HISTORY_OFFICE_ALIAS_TO_CANONICAL[token];
  if (direct) return direct;

  if (token.includes("governor") || token.includes("gubernatorial")){
    return "statewide_executive";
  }
  if (token.includes("attorney general") || token.includes("secretary of state") || token.includes("comptroller") || token.includes("treasurer")){
    return "statewide_executive";
  }
  if (token.includes("us senate") || token.includes("senate statewide") || token === "statewide federal"){
    return "statewide_federal";
  }
  if (token.includes("us house") || token === "congress" || token.includes("congressional")){
    return "congressional_district";
  }
  if (token.includes("state house") || token.includes("state representative") || token.includes("state rep") || token.includes("lower chamber")){
    return "state_house";
  }
  if (token.includes("state senate") || token.includes("upper chamber")){
    return "state_senate";
  }
  if (token === "county" || token.includes("countywide") || token.includes("county executive") || token.includes("county clerk") || token.includes("county board president")){
    return "countywide";
  }
  if (token === "mayor" || token.includes("municipal executive") || token.includes("city executive")){
    return "municipal_executive";
  }
  if (token.includes("city council") || token === "alderman" || token === "alderperson" || token === "ward" || token.includes("municipal legislative")){
    return "municipal_legislative";
  }
  if (token === "judicial" || token === "judge"){
    return "judicial_other";
  }
  return "";
}

export function canonicalizeCandidateHistoryOffice(value){
  const raw = cleanText(value);
  if (!raw) return "";
  if (CANDIDATE_HISTORY_CANONICAL_OFFICE_SET.has(raw)){
    return raw;
  }
  const normalizedId = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (CANDIDATE_HISTORY_CANONICAL_OFFICE_SET.has(normalizedId)){
    return normalizedId;
  }
  const fromOfficeLevel = CANDIDATE_HISTORY_OFFICE_LEVEL_TO_CANONICAL[normalizedId];
  if (fromOfficeLevel){
    return fromOfficeLevel;
  }
  const fromLegacyBucket = CANDIDATE_HISTORY_LEGACY_RACE_BUCKET_TO_CANONICAL[normalizedId];
  if (fromLegacyBucket){
    return fromLegacyBucket;
  }
  const token = normalizeOfficeToken(raw);
  const fromToken = canonicalOfficeForNormalizedToken(token);
  if (fromToken){
    return fromToken;
  }
  return raw;
}

function candidateHistoryOfficeComparisonKey(value){
  const canonical = canonicalizeCandidateHistoryOffice(value);
  if (!canonical) return "";
  if (CANDIDATE_HISTORY_CANONICAL_OFFICE_SET.has(canonical)){
    return canonical;
  }
  return normalizeOfficeToken(canonical);
}

function toFinite(value){
  const n = safeNum(value);
  return n == null || !Number.isFinite(n) ? null : n;
}

function clampNumber(value, min, max){
  const n = toFinite(value);
  if (n == null) return null;
  return clamp(n, min, max);
}

function normalizeRecordId(value, fallback){
  const text = cleanText(value || fallback);
  return text;
}

function normalizeCycleYear(value){
  const n = toFinite(value);
  if (n == null) return null;
  const rounded = Math.round(n);
  if (!Number.isFinite(rounded)) return null;
  if (rounded < 1900 || rounded > 2100) return null;
  return rounded;
}

function normalizeElectionType(value){
  const text = cleanText(value).toLowerCase();
  return ELECTION_TYPE_SET.has(text) ? text : "";
}

function normalizeIncumbencyStatus(value){
  const text = cleanText(value).toLowerCase();
  return INCUMBENCY_SET.has(text) ? text : "";
}

function normalizeBoolean(value){
  if (typeof value === "boolean") return value;
  const text = cleanText(value).toLowerCase();
  if (!text) return false;
  if (text === "true" || text === "1" || text === "yes" || text === "y") return true;
  if (text === "false" || text === "0" || text === "no" || text === "n") return false;
  return false;
}

function candidateNameKey(value){
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function requiredFieldPresent(record, key){
  if (key === "repeatCandidate") return typeof record?.repeatCandidate === "boolean";
  if (key === "cycleYear") return Number.isFinite(Number(record?.cycleYear));
  if (key === "voteShare" || key === "margin" || key === "turnoutContext" || key === "overUnderPerformancePct"){
    return Number.isFinite(Number(record?.[key]));
  }
  return cleanText(record?.[key]).length > 0;
}

function recordCompleteness(record){
  if (!record || typeof record !== "object") return 0;
  let present = 0;
  for (const field of REQUIRED_COMPLETENESS_FIELDS){
    if (requiredFieldPresent(record, field)) present += 1;
  }
  return present / REQUIRED_COMPLETENESS_FIELDS.length;
}

function coverageBandFromScore(score){
  const n = toFinite(score) ?? 0;
  if (n >= 0.85) return "high";
  if (n >= 0.65) return "medium";
  if (n > 0) return "low";
  return "none";
}

function confidenceBandFromCoverage(coverageScore, recordCount){
  if ((recordCount || 0) <= 0) return "missing";
  const score = toFinite(coverageScore) ?? 0;
  if (score >= 0.85 && recordCount >= 2) return "high";
  if (score >= 0.65 && recordCount >= 1) return "medium";
  return "low";
}

function referenceYear(records, nowYear){
  const list = Array.isArray(records) ? records : [];
  const years = list
    .map((row) => normalizeCycleYear(row?.cycleYear))
    .filter((value) => Number.isFinite(value));
  if (years.length){
    return Math.max(...years);
  }
  const fallback = normalizeCycleYear(nowYear);
  return fallback != null ? fallback : 2026;
}

function recencyWeight(cycleYear, refYear){
  const y = normalizeCycleYear(cycleYear);
  if (y == null) return 0.45;
  const gap = Math.max(0, refYear - y);
  return 1 / (1 + (0.45 * gap));
}

function derivedRowDelta(record){
  const overUnder = clampNumber(record?.overUnderPerformancePct, -40, 40) ?? 0;
  const incumbencyStatus = normalizeIncumbencyStatus(record?.incumbencyStatus);
  const incumbencyDelta = incumbencyStatus === "incumbent" ? 1.2 : (incumbencyStatus === "challenger" ? -0.4 : 0);
  const repeatDelta = normalizeBoolean(record?.repeatCandidate) ? 0.6 : 0;
  return clamp(overUnder + incumbencyDelta + repeatDelta, -8, 8);
}

function resolveCandidateIdForRecord(record, candidateIndex){
  const explicitId = cleanText(record?.candidateId || record?.id);
  if (explicitId && candidateIndex.idMap.has(explicitId)) return explicitId;
  const nameKey = candidateNameKey(record?.candidateName);
  if (nameKey && candidateIndex.nameMap.has(nameKey)) return candidateIndex.nameMap.get(nameKey);
  return "";
}

function buildCandidateIndex(candidates){
  const rows = Array.isArray(candidates) ? candidates : [];
  const idMap = new Map();
  const nameMap = new Map();
  for (const row of rows){
    const id = cleanText(row?.id);
    const name = cleanText(row?.name);
    if (id){
      idMap.set(id, true);
    }
    const key = candidateNameKey(name || id);
    if (id && key && !nameMap.has(key)){
      nameMap.set(key, id);
    }
  }
  return { idMap, nameMap };
}

function defaultCandidateSummary(candidateId, candidateName){
  return {
    candidateId,
    candidateName: cleanText(candidateName || candidateId),
    recordCount: 0,
    completenessScore: 0,
    coverageBand: "none",
    confidenceBand: "missing",
    averageOverUnderPerformancePct: null,
    turnoutContextAvgPct: null,
    weightedDeltaSupportPct: 0,
    appliedDeltaSupportPct: 0,
    confidenceWeight: 0,
    hasIncumbentSignal: false,
    hasRepeatSignal: false,
    matchedRecordIds: [],
    notes: [],
  };
}

function safeAverage(values){
  const nums = (Array.isArray(values) ? values : [])
    .map((value) => toFinite(value))
    .filter((value) => value != null);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function normalizeParty(value){
  return cleanText(value);
}

export function normalizeCandidateHistoryRecord(record, { uidFn = null } = {}){
  const src = record && typeof record === "object" ? record : {};
  const fallbackId = (typeof uidFn === "function") ? `${RECORD_ID_PREFIX}${uidFn()}` : "";
  return {
    recordId: normalizeRecordId(src.recordId || src.eventId || src.id, fallbackId),
    office: canonicalizeCandidateHistoryOffice(src.office),
    cycleYear: normalizeCycleYear(src.cycleYear ?? src.electionYear ?? src.year),
    electionType: normalizeElectionType(src.electionType),
    candidateId: cleanText(src.candidateId || src.candidate_id),
    candidateName: cleanText(src.candidateName || src.name),
    party: normalizeParty(src.party),
    incumbencyStatus: normalizeIncumbencyStatus(src.incumbencyStatus),
    voteShare: clampNumber(src.voteShare, 0, 100),
    margin: clampNumber(src.margin, -100, 100),
    turnoutContext: clampNumber(src.turnoutContext, 0, 100),
    repeatCandidate: normalizeBoolean(src.repeatCandidate),
    overUnderPerformancePct: clampNumber(src.overUnderPerformancePct ?? src.overUnderPerformance, -40, 40),
  };
}

export function normalizeCandidateHistoryRecords(records, { uidFn = null } = {}){
  const list = Array.isArray(records) ? records : [];
  const out = [];
  const usedIds = new Set();
  list.forEach((row, idx) => {
    const normalized = normalizeCandidateHistoryRecord(row, { uidFn });
    let recordId = cleanText(normalized.recordId);
    if (!recordId || usedIds.has(recordId)){
      if (typeof uidFn === "function"){
        recordId = `${RECORD_ID_PREFIX}${uidFn()}`;
      } else {
        recordId = `${RECORD_ID_PREFIX}row_${idx + 1}`;
      }
    }
    if (usedIds.has(recordId)){
      let attempt = 2;
      while (usedIds.has(`${recordId}_${attempt}`)){
        attempt += 1;
      }
      recordId = `${recordId}_${attempt}`;
    }
    usedIds.add(recordId);
    out.push({
      ...normalized,
      recordId,
    });
  });
  return out;
}

/**
 * @param {{
 *   records?: unknown[],
 *   candidates?: unknown[],
 *   yourCandidateId?: string | null,
 *   office?: string | null,
 *   electionType?: string | null,
 *   nowYear?: number | null,
 * }} args
 */
export function deriveCandidateHistoryBaseline({
  records = [],
  candidates = [],
  yourCandidateId = "",
  office = "",
  electionType = "",
  nowYear = null,
} = {}){
  const normalizedRecords = normalizeCandidateHistoryRecords(records);
  const normalizedCandidates = (Array.isArray(candidates) ? candidates : []).map((row) => ({
    id: cleanText(row?.id),
    name: cleanText(row?.name || row?.id),
    supportPct: clampNumber(row?.supportPct, 0, 100),
  })).filter((row) => row.id);

  const officeFilter = candidateHistoryOfficeComparisonKey(office);
  const electionTypeFilter = normalizeElectionType(electionType);
  const candidateIndex = buildCandidateIndex(normalizedCandidates);
  const refYear = referenceYear(normalizedRecords, nowYear);
  const summaries = new Map();

  for (const candidate of normalizedCandidates){
    summaries.set(candidate.id, defaultCandidateSummary(candidate.id, candidate.name));
  }

  let missingFieldCount = 0;
  let incompleteRecordCount = 0;
  let matchedRecordCount = 0;
  let unmatchedCandidateRecordCount = 0;
  let excludedByOfficeCount = 0;
  let excludedByElectionTypeCount = 0;
  let incumbentEffectPresent = false;
  let repeatEffectPresent = false;
  let deviationPresent = false;
  const completenessValues = [];
  const filteredRecords = [];

  for (const record of normalizedRecords){
    const completeness = recordCompleteness(record);
    completenessValues.push(completeness);
    if (completeness < 1){
      incompleteRecordCount += 1;
      missingFieldCount += Math.round((1 - completeness) * REQUIRED_COMPLETENESS_FIELDS.length);
    }
    const recordOffice = candidateHistoryOfficeComparisonKey(record.office);
    const recordElectionType = normalizeElectionType(record.electionType);
    if (officeFilter && recordOffice && recordOffice !== officeFilter){
      excludedByOfficeCount += 1;
      continue;
    }
    if (electionTypeFilter && recordElectionType && recordElectionType !== electionTypeFilter){
      excludedByElectionTypeCount += 1;
      continue;
    }
    filteredRecords.push(record);
  }

  for (const record of filteredRecords){
    const candidateId = resolveCandidateIdForRecord(record, candidateIndex);
    if (!candidateId){
      unmatchedCandidateRecordCount += 1;
      continue;
    }
    const summary = summaries.get(candidateId);
    if (!summary) continue;
    matchedRecordCount += 1;
    summary.recordCount += 1;
    summary.matchedRecordIds.push(record.recordId);

    const completeness = recordCompleteness(record);
    summary.completenessScore += completeness;

    const rowWeight = recencyWeight(record.cycleYear, refYear);
    const rowDelta = derivedRowDelta(record);
    const incumbencyStatus = normalizeIncumbencyStatus(record.incumbencyStatus);
    const repeat = normalizeBoolean(record.repeatCandidate);
    if (incumbencyStatus === "incumbent") incumbentEffectPresent = true;
    if (repeat) repeatEffectPresent = true;
    if (Math.abs(clampNumber(record.overUnderPerformancePct, -100, 100) ?? 0) >= 2) deviationPresent = true;

    const weightedDelta = (toFinite(summary.weightedDeltaSupportPct) ?? 0) + (rowDelta * rowWeight);
    const weightTotal = (toFinite(summary.confidenceWeight) ?? 0) + rowWeight;
    summary.weightedDeltaSupportPct = weightedDelta;
    summary.confidenceWeight = weightTotal;
    summary.averageOverUnderPerformancePct = safeAverage([
      summary.averageOverUnderPerformancePct,
      clampNumber(record.overUnderPerformancePct, -40, 40),
    ]);
    summary.turnoutContextAvgPct = safeAverage([
      summary.turnoutContextAvgPct,
      clampNumber(record.turnoutContext, 0, 100),
    ]);
    if (incumbencyStatus === "incumbent") summary.hasIncumbentSignal = true;
    if (repeat) summary.hasRepeatSignal = true;
  }

  const overallCoverageScore = completenessValues.length
    ? (completenessValues.reduce((sum, value) => sum + value, 0) / completenessValues.length)
    : 0;
  const overallCoverageBand = coverageBandFromScore(overallCoverageScore);
  const overallConfidenceBand = confidenceBandFromCoverage(overallCoverageScore, filteredRecords.length);
  const byCandidateId = {};
  const adjustmentsByCandidateId = {};

  for (const candidate of normalizedCandidates){
    const summary = summaries.get(candidate.id) || defaultCandidateSummary(candidate.id, candidate.name);
    const rowCount = summary.recordCount;
    const completenessScore = rowCount > 0 ? (summary.completenessScore / rowCount) : 0;
    const confidenceWeight = Math.min(1, completenessScore * Math.min(1, rowCount / 3));
    const weightedDeltaRaw = rowCount > 0 && summary.confidenceWeight > 0
      ? (summary.weightedDeltaSupportPct / summary.confidenceWeight)
      : 0;
    const weightedDeltaSupportPct = clamp(weightedDeltaRaw, -8, 8);
    const appliedDeltaSupportPct = confidenceWeight >= 0.25
      ? clamp(weightedDeltaSupportPct * confidenceWeight, -6, 6)
      : 0;
    const coverageBand = coverageBandFromScore(completenessScore);
    const confidenceBand = confidenceBandFromCoverage(completenessScore, rowCount);

    const notes = [];
    if (!rowCount){
      notes.push("No matched candidate history records.");
    } else if (confidenceWeight < 0.25){
      notes.push("History coverage too weak to apply support shift.");
    } else {
      notes.push(`Applied candidate-history support shift ${appliedDeltaSupportPct >= 0 ? "+" : ""}${appliedDeltaSupportPct.toFixed(2)} pts.`);
    }

    const normalized = {
      ...summary,
      completenessScore,
      coverageBand,
      confidenceBand,
      weightedDeltaSupportPct,
      appliedDeltaSupportPct,
      confidenceWeight,
      notes,
    };
    byCandidateId[candidate.id] = normalized;
    adjustmentsByCandidateId[candidate.id] = appliedDeltaSupportPct;
  }

  const yourId = cleanText(yourCandidateId);
  const yourSummary = yourId ? byCandidateId[yourId] : null;

  const notes = [];
  if (!normalizedRecords.length){
    notes.push("No candidate history records provided.");
  }
  if (excludedByOfficeCount > 0){
    notes.push(`Office mismatch excluded ${excludedByOfficeCount} candidate-history row(s).`);
  }
  if (excludedByElectionTypeCount > 0){
    notes.push(`Election-type mismatch excluded ${excludedByElectionTypeCount} candidate-history row(s).`);
  }
  if (filteredRecords.length && matchedRecordCount <= 0 && unmatchedCandidateRecordCount > 0){
    notes.push(`${unmatchedCandidateRecordCount} candidate-history row(s) passed filters but did not match active candidate name/id.`);
  }
  if (normalizedRecords.length > 0 && filteredRecords.length <= 0 && excludedByOfficeCount <= 0 && excludedByElectionTypeCount <= 0){
    notes.push("No candidate history records matched active office/election filters.");
  }
  if (filteredRecords.length && overallConfidenceBand === "low"){
    notes.push("Candidate history records are incomplete; confidence downgraded.");
  }
  if (incumbentEffectPresent){
    notes.push("Incumbency signal present in candidate history baseline.");
  }
  if (repeatEffectPresent){
    notes.push("Repeat-candidate signal present in candidate history baseline.");
  }
  if (deviationPresent){
    notes.push("Candidate over/underperformance diverges from structural district baseline.");
  }

  return {
    recordCount: normalizedRecords.length,
    filteredRecordCount: filteredRecords.length,
    matchedRecordCount,
    unmatchedCandidateRecordCount,
    excludedByOfficeCount,
    excludedByElectionTypeCount,
    missingFieldCount,
    incompleteRecordCount,
    coverageScore: overallCoverageScore,
    coverageBand: overallCoverageBand,
    confidenceBand: overallConfidenceBand,
    incumbentEffectPresent,
    repeatEffectPresent,
    deviationPresent,
    byCandidateId,
    adjustmentsByCandidateId,
    yourCandidateDeltaSupportPct: toFinite(yourSummary?.appliedDeltaSupportPct) ?? 0,
    notes,
  };
}

/**
 * @param {Array<{ id?: string, name?: string, supportPct?: number | null }>} candidates
 * @param {Record<string, number>} adjustmentsByCandidateId
 */
export function applyCandidateHistorySupportAdjustments(candidates, adjustmentsByCandidateId){
  const list = Array.isArray(candidates) ? candidates : [];
  const adjustments = adjustmentsByCandidateId && typeof adjustmentsByCandidateId === "object"
    ? adjustmentsByCandidateId
    : {};
  const baseSum = list.reduce((sum, row) => sum + (toFinite(row?.supportPct) ?? 0), 0);
  const shifted = list.map((row) => {
    const id = cleanText(row?.id);
    const base = toFinite(row?.supportPct) ?? 0;
    const delta = clampNumber(adjustments[id], -20, 20) ?? 0;
    return {
      ...row,
      supportPct: Math.max(0, base + delta),
    };
  });
  const shiftedSum = shifted.reduce((sum, row) => sum + (toFinite(row?.supportPct) ?? 0), 0);
  if (!(baseSum > 0) || !(shiftedSum > 0)){
    return {
      adjustedCandidates: shifted,
      normalized: false,
    };
  }
  const scale = baseSum / shiftedSum;
  const adjustedCandidates = shifted.map((row) => ({
    ...row,
    supportPct: (toFinite(row?.supportPct) ?? 0) * scale,
  }));
  return {
    adjustedCandidates,
    normalized: true,
  };
}
