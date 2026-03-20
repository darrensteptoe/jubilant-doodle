// @ts-check
import { listPlaybookEntries } from "./playbookRegistry.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function normalizeSignalToken(value){
  return clean(value).toLowerCase();
}

function toFiniteOrNull(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSignalKey(value){
  return clean(value).replace(/\[(\w+)\]/g, ".$1");
}

function resolveSignalValue(signals, rawPath){
  const path = normalizeSignalKey(rawPath);
  if (!path) return null;
  const direct = signals?.[path];
  if (direct != null){
    return direct;
  }
  const parts = path.split(".").map((part) => clean(part)).filter(Boolean);
  if (!parts.length) return null;
  let cursor = signals;
  for (const part of parts){
    if (!cursor || typeof cursor !== "object"){
      return null;
    }
    cursor = cursor[part];
  }
  return cursor == null ? null : cursor;
}

function toValueList(rule){
  if (Array.isArray(rule?.values)){
    return rule.values.map((value) => value).filter((value) => value != null);
  }
  if (rule && Object.prototype.hasOwnProperty.call(rule, "value")){
    return [rule.value];
  }
  return [];
}

function compareRule(actualRaw, rule){
  const op = normalizeSignalToken(rule?.op || "eq");
  const values = toValueList(rule);
  const actualNum = toFiniteOrNull(actualRaw);
  const actualText = normalizeSignalToken(actualRaw);
  if (op === "truthy"){
    return !!actualRaw;
  }
  if (op === "falsy"){
    return !actualRaw;
  }
  if (op === "in" || op === "not_in"){
    const normalizedValues = values.map((value) => normalizeSignalToken(value)).filter(Boolean);
    const found = normalizedValues.includes(actualText);
    return op === "in" ? found : !found;
  }
  if (op === "includes"){
    const haystack = clean(actualRaw).toLowerCase();
    const needle = normalizeSignalToken(values[0]);
    return !!needle && haystack.includes(needle);
  }
  if (op === "eq"){
    const expected = values[0];
    if (expected == null) return false;
    const expectedNum = toFiniteOrNull(expected);
    if (expectedNum != null && actualNum != null){
      return actualNum === expectedNum;
    }
    return actualText === normalizeSignalToken(expected);
  }
  if (op === "neq"){
    const expected = values[0];
    if (expected == null) return true;
    const expectedNum = toFiniteOrNull(expected);
    if (expectedNum != null && actualNum != null){
      return actualNum !== expectedNum;
    }
    return actualText !== normalizeSignalToken(expected);
  }
  if (op === "gt" || op === "gte" || op === "lt" || op === "lte"){
    const expectedNum = toFiniteOrNull(values[0]);
    if (actualNum == null || expectedNum == null){
      return false;
    }
    if (op === "gt") return actualNum > expectedNum;
    if (op === "gte") return actualNum >= expectedNum;
    if (op === "lt") return actualNum < expectedNum;
    return actualNum <= expectedNum;
  }
  return false;
}

export function normalizePlaybookSignals(raw = {}){
  const src = (raw && typeof raw === "object") ? raw : {};
  return {
    stageId: normalizeSignalToken(src.stageId),
    readinessBand: normalizeSignalToken(src.readinessBand),
    readinessScore: toFiniteOrNull(src.readinessScore),
    realismClassification: normalizeSignalToken(src.realismClassification),
    realismStatus: normalizeSignalToken(src.realismStatus),
    governanceConfidenceBand: normalizeSignalToken(src.governanceConfidenceBand),
    governanceTopWarning: clean(src.governanceTopWarning),
    assumptionDriftDetected: !!src.assumptionDriftDetected,
    saturationPressure: normalizeSignalToken(src.saturationPressure),
    decisionPressureLevel: normalizeSignalToken(src.decisionPressureLevel),
    decisionItemsCount: toFiniteOrNull(src.decisionItemsCount),
    watchItemsCount: toFiniteOrNull(src.watchItemsCount),
    optimizerCheapChannelRisk: !!src.optimizerCheapChannelRisk,
    optimizerTopChannelShare: toFiniteOrNull(src.optimizerTopChannelShare),
    persuasionPct: toFiniteOrNull(src.persuasionPct),
    roleTypingCoveragePct: toFiniteOrNull(src.roleTypingCoveragePct),
    volunteerScale: toFiniteOrNull(src.volunteerScale),
    capacitySeverity: normalizeSignalToken(src.capacitySeverity),
    capacityRatioRequiredToAvailable: toFiniteOrNull(src.capacityRatioRequiredToAvailable),
    weatherFieldExecutionRisk: normalizeSignalToken(src.weatherFieldExecutionRisk),
    weatherElectionDayTurnoutRisk: normalizeSignalToken(src.weatherElectionDayTurnoutRisk),
    weatherMode: normalizeSignalToken(src.weatherMode),
    appliedCampaignEvents: toFiniteOrNull(src.appliedCampaignEvents),
    todayCampaignEvents: toFiniteOrNull(src.todayCampaignEvents),
    todayExpectedVolunteers: toFiniteOrNull(src.todayExpectedVolunteers),
  };
}

export function evaluatePlaybookTrigger(entry, rawSignals = {}){
  const triggerRules = Array.isArray(entry?.triggerRules) ? entry.triggerRules : [];
  const triggerMode = normalizeSignalToken(entry?.triggerMatch || "all") === "any" ? "any" : "all";
  const minMatchesRaw = Number.parseInt(String(entry?.minimumMatchedRules ?? ""), 10);
  const minimumMatchedRules = Number.isFinite(minMatchesRaw) ? Math.max(1, minMatchesRaw) : 1;
  const signals = normalizePlaybookSignals(rawSignals);
  if (!triggerRules.length){
    return {
      matched: false,
      triggerMode,
      minimumMatchedRules,
      totalRules: 0,
      matchedRules: [],
      failedRules: [],
      score: 0,
      signals,
    };
  }
  const matchedRules = [];
  const failedRules = [];
  for (const rule of triggerRules){
    const signal = clean(rule?.signal);
    const actualValue = resolveSignalValue(signals, signal);
    const matched = compareRule(actualValue, rule);
    const row = {
      signal,
      label: clean(rule?.label) || signal,
      op: normalizeSignalToken(rule?.op || "eq"),
      expected: toValueList(rule),
      actualValue,
    };
    if (matched){
      matchedRules.push(row);
    } else {
      failedRules.push(row);
    }
  }

  const matchedCount = matchedRules.length;
  const totalRules = triggerRules.length;
  const hasMinimum = matchedCount >= minimumMatchedRules;
  const matched = triggerMode === "all" ? (matchedCount === totalRules && hasMinimum) : hasMinimum;
  return {
    matched,
    triggerMode,
    minimumMatchedRules,
    totalRules,
    matchedRules,
    failedRules,
    score: totalRules > 0 ? (matchedCount / totalRules) : 0,
    signals,
  };
}

export function resolveTriggeredPlaybookEntries(rawSignals = {}, {
  entries = listPlaybookEntries(),
  limit = 5,
} = {}){
  const rows = Array.isArray(entries) ? entries : [];
  const out = [];
  for (const entry of rows){
    const result = evaluatePlaybookTrigger(entry, rawSignals);
    if (!result.matched) continue;
    out.push({
      id: clean(entry?.id),
      title: clean(entry?.title) || clean(entry?.id),
      score: result.score,
      matchedRules: result.matchedRules,
      entry,
    });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });
  const normalizedLimit = Number.parseInt(String(limit ?? ""), 10);
  return out.slice(0, Number.isFinite(normalizedLimit) ? Math.max(1, normalizedLimit) : 1);
}

export function resolvePlaybookIdForSignals(rawSignals = {}, {
  entries = listPlaybookEntries(),
  fallbackId = "lowConfidenceHighPressure",
} = {}){
  const matches = resolveTriggeredPlaybookEntries(rawSignals, { entries, limit: 1 });
  if (matches.length && clean(matches[0]?.id)){
    return clean(matches[0].id);
  }
  return clean(fallbackId) || "lowConfidenceHighPressure";
}

export function formatPlaybookTriggerSummary(triggerResult){
  const result = triggerResult && typeof triggerResult === "object" ? triggerResult : {};
  const matchedRules = Array.isArray(result.matchedRules) ? result.matchedRules : [];
  if (!matchedRules.length){
    return "";
  }
  const bits = matchedRules.slice(0, 4).map((row) => {
    const label = clean(row?.label) || clean(row?.signal);
    const actualValue = row?.actualValue;
    const valueText = actualValue == null ? "set" : String(actualValue);
    return `${label}: ${valueText}`;
  }).filter(Boolean);
  if (!bits.length){
    return "";
  }
  return `Current-state trigger match: ${bits.join(" | ")}.`;
}
