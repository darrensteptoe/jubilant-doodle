// @ts-check

import { asArray, clone, makeActionResult, mutateDomain } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function entryHash(entry = {}) {
  return cleanText(entry.hash || entry.snapshotHash || entry.id);
}

function recomputeSummary(draft) {
  const entries = asArray(draft.entries);
  draft.summary = {
    total: entries.length,
    staleCount: entries.filter((entry) => cleanText(entry.status) === "stale").length,
    latestAt: entries.length ? cleanText(entries[0]?.recordedAt) : "",
  };
}

export function saveForecastArchiveActual(state, payload, options = {}) {
  const entry = payload?.entry && typeof payload.entry === "object" ? payload.entry : {};
  const hash = entryHash(entry);
  if (!hash) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "missing_hash" });
  }

  const result = mutateDomain(
    state,
    "forecastArchive",
    (draft) => {
      if (!Array.isArray(draft.entries)) draft.entries = [];
      const idx = draft.entries.findIndex((row) => entryHash(row) === hash);
      const normalized = {
        ...clone(entry),
        hash,
        recordedAt: cleanText(entry.recordedAt) || new Date().toISOString(),
      };
      if (idx < 0) {
        draft.entries.unshift(normalized);
      } else {
        draft.entries[idx] = normalized;
      }
      if (!cleanText(draft.selectedHash)) {
        draft.selectedHash = hash;
      }
      recomputeSummary(draft);
      return true;
    },
    { ...options, revisionReason: "forecastArchive.entries.save" },
  );
  return makeActionResult(result, { hash });
}

export function selectForecastArchiveEntry(state, payload, options = {}) {
  const hash = cleanText(payload?.hash);
  if (!hash) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "missing_hash" });
  }

  const result = mutateDomain(
    state,
    "forecastArchive",
    (draft) => {
      if (draft.selectedHash === hash) return false;
      draft.selectedHash = hash;
      return true;
    },
    { ...options, revisionReason: "forecastArchive.select" },
  );
  return makeActionResult(result, { hash });
}

