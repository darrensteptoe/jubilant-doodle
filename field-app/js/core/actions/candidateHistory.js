// @ts-check

import { asArray, makeActionResult, mutateDomain, toBool, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeRecord(record, fallbackId = "") {
  return {
    recordId: cleanText(record?.recordId) || fallbackId,
    office: cleanText(record?.office),
    cycleYear: toFinite(record?.cycleYear, null),
    electionType: cleanText(record?.electionType).toLowerCase(),
    candidateName: cleanText(record?.candidateName),
    party: cleanText(record?.party),
    incumbencyStatus: cleanText(record?.incumbencyStatus).toLowerCase(),
    voteShare: toFinite(record?.voteShare, null),
    margin: toFinite(record?.margin, null),
    turnoutContext: toFinite(record?.turnoutContext, null),
    repeatCandidate: toBool(record?.repeatCandidate),
    overUnderPerformancePct: toFinite(record?.overUnderPerformancePct, null),
  };
}

function nextRecordId(records = []) {
  const used = new Set(asArray(records).map((row) => cleanText(row?.recordId)).filter(Boolean));
  let i = 1;
  while (used.has(`history_${i}`)) i += 1;
  return `history_${i}`;
}

function refreshStats(draft) {
  const records = asArray(draft.records);
  draft.matchedRecordCount = records.length;
  draft.coverageBand = records.length ? "partial" : "none";
  draft.confidenceBand = records.length >= 3 ? "high" : records.length >= 1 ? "medium" : "missing";
}

export function addCandidateHistoryRecord(state, payload, options = {}) {
  const result = mutateDomain(
    state,
    "candidateHistory",
    (draft) => {
      if (!Array.isArray(draft.records)) draft.records = [];
      const recordId = cleanText(payload?.recordId) || nextRecordId(draft.records);
      if (draft.records.some((row) => cleanText(row?.recordId) === recordId)) return false;
      draft.records.push(normalizeRecord(payload, recordId));
      refreshStats(draft);
      return true;
    },
    { ...options, revisionReason: "candidateHistory.addRecord" },
  );
  return makeActionResult(result);
}

export function updateCandidateHistoryRecord(state, payload, options = {}) {
  const recordId = cleanText(payload?.recordId);
  const field = cleanText(payload?.field);
  if (!recordId || !field) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_payload" });
  }

  const allowed = new Set([
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
  if (!allowed.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "candidateHistory",
    (draft) => {
      if (!Array.isArray(draft.records)) draft.records = [];
      const idx = draft.records.findIndex((row) => cleanText(row?.recordId) === recordId);
      if (idx < 0) return false;
      const current = normalizeRecord(draft.records[idx], recordId);
      const next = normalizeRecord({ ...current, [field]: payload?.value }, recordId);
      if (current[field] === next[field]) return false;
      draft.records[idx] = next;
      refreshStats(draft);
      return true;
    },
    { ...options, revisionReason: `candidateHistory.${field}` },
  );
  return makeActionResult(result, { recordId, field });
}

export function removeCandidateHistoryRecord(state, payload, options = {}) {
  const recordId = cleanText(payload?.recordId);
  if (!recordId) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_payload" });
  }

  const result = mutateDomain(
    state,
    "candidateHistory",
    (draft) => {
      const before = asArray(draft.records);
      const next = before.filter((row) => cleanText(row?.recordId) !== recordId);
      if (next.length === before.length) return false;
      draft.records = next;
      refreshStats(draft);
      return true;
    },
    { ...options, revisionReason: "candidateHistory.removeRecord" },
  );
  return makeActionResult(result, { recordId });
}

