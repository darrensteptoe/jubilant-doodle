// @ts-check

import { detectElectionCsvFormat, parseCsvText } from "../censusModule.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function rowsFromPayload(payload = {}) {
  const rows = payload.rows;
  if (Array.isArray(rows)) {
    return rows.map((row) => (row && typeof row === "object" ? clone(row) : {}));
  }
  return [];
}

function parseCsvRows(payload = {}) {
  const csvText = cleanText(payload.csvText);
  if (!csvText) {
    return {
      ok: true,
      headers: [],
      rows: [],
      errors: [],
      warnings: [],
    };
  }
  const parsed = parseCsvText(csvText);
  return {
    ok: !!parsed?.ok,
    headers: asArray(parsed?.headers).map((header) => cleanText(header)).filter(Boolean),
    rows: asArray(parsed?.rows).map((row) => (row && typeof row === "object" ? clone(row) : {})),
    errors: asArray(parsed?.errors).map((item) => cleanText(item)).filter(Boolean),
    warnings: asArray(parsed?.warnings).map((item) => cleanText(item)).filter(Boolean),
  };
}

function detectFormat(rawRows = [], payload = {}) {
  const hinted = cleanText(payload.format).toLowerCase();
  const headers = asArray(payload.headers).length
    ? asArray(payload.headers).map((header) => cleanText(header)).filter(Boolean)
    : Object.keys(rawRows[0] || {});
  if (hinted === "long" || hinted === "wide") {
    return { format: hinted, headers, detected: null };
  }
  const detected = detectElectionCsvFormat(headers);
  return {
    format: cleanText(detected?.format).toLowerCase() || "long",
    headers,
    detected,
  };
}

export function importElectionDataCsv(payload = {}, options = {}) {
  const nowDate = options.nowDate || new Date();
  const suppliedRows = rowsFromPayload(payload);
  const parsed = suppliedRows.length
    ? {
      ok: true,
      headers: asArray(payload.headers).map((header) => cleanText(header)).filter(Boolean),
      rows: suppliedRows,
      errors: [],
      warnings: [],
    }
    : parseCsvRows(payload);
  const rawRows = parsed.rows;
  const formatInfo = detectFormat(rawRows, {
    ...payload,
    headers: parsed.headers,
  });

  return {
    ok: parsed.ok,
    rawRows,
    headers: formatInfo.headers,
    format: formatInfo.format,
    detected: formatInfo.detected,
    errors: parsed.errors,
    warnings: parsed.warnings,
    importMeta: {
      fileName: cleanText(payload.fileName),
      fileSize: Math.max(0, toFinite(payload.fileSize, 0) || 0),
      fileHash: cleanText(payload.fileHash),
      importedAt: (nowDate instanceof Date ? nowDate : new Date(nowDate)).toISOString(),
    },
  };
}
