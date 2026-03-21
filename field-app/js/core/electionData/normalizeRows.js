// @ts-check

import { normalizeElectionCsvRows } from "../censusModule.js";
import { normalizeElectionDataSlice } from "../state/schema.js";
import { applyElectionDataColumnMap } from "./mapColumns.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
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

function mergeQaState(baseQa = {}, normalized = {}, mappingWarnings = []) {
  const sourceWarnings = [
    ...asArray(baseQa.sourceWarnings),
    ...asArray(normalized.warnings),
  ].map((item) => cleanText(item)).filter(Boolean);
  const errors = [
    ...asArray(baseQa.errors),
    ...asArray(normalized.errors),
  ].map((item) => cleanText(item)).filter(Boolean);

  return {
    sourceWarnings,
    geographyWarnings: asArray(baseQa.geographyWarnings).map((item) => cleanText(item)).filter(Boolean),
    candidateWarnings: asArray(baseQa.candidateWarnings).map((item) => cleanText(item)).filter(Boolean),
    mappingWarnings: [
      ...asArray(baseQa.mappingWarnings),
      ...asArray(mappingWarnings),
    ].map((item) => cleanText(item)).filter(Boolean),
    errors,
  };
}

export function normalizeElectionDataRows(rawRows = [], options = {}) {
  const nowDate = options.nowDate || new Date();
  const context = options?.context && typeof options.context === "object" ? options.context : {};
  const existingSlice = options?.existingSlice && typeof options.existingSlice === "object"
    ? options.existingSlice
    : {};
  const baseRows = asArray(rawRows).map((row) => (row && typeof row === "object" ? clone(row) : {}));

  const mapped = applyElectionDataColumnMap(baseRows, options.columnMap || {}, {
    headers: options.headers,
  });

  const mappedRows = mapped.mappedRows;
  const headers = asArray(options.headers).length
    ? asArray(options.headers).map((header) => cleanText(header)).filter(Boolean)
    : Object.keys(mappedRows[0] || {});

  const normalized = normalizeElectionCsvRows(mappedRows, {
    headers,
    context,
  });

  const qa = mergeQaState(existingSlice?.qa || {}, normalized, mapped.warnings);

  const normalizedSlice = normalizeElectionDataSlice(
    {
      ...existingSlice,
      rawRows: baseRows,
      normalizedRows: asArray(normalized.records).map((row) => clone(row)),
      qa,
      schemaMapping: {
        ...(existingSlice?.schemaMapping && typeof existingSlice.schemaMapping === "object"
          ? existingSlice.schemaMapping
          : {}),
        status: mapped.mappedColumns.length ? "mapped" : "unmapped",
        columnMap: clone(mapped.columnMap),
        mappedColumns: mapped.mappedColumns.slice(),
        unmappedColumns: mapped.unmappedColumns.slice(),
      },
    },
    { nowDate },
  );

  return {
    ok: !!normalized.ok,
    format: cleanText(normalized.format).toLowerCase(),
    normalizedRecords: asArray(normalized.records).map((row) => clone(row)),
    errors: asArray(normalized.errors).map((item) => cleanText(item)).filter(Boolean),
    warnings: asArray(normalized.warnings).map((item) => cleanText(item)).filter(Boolean),
    mapping: {
      columnMap: mapped.columnMap,
      mappedColumns: mapped.mappedColumns,
      unmappedColumns: mapped.unmappedColumns,
      warnings: mapped.warnings,
    },
    slice: normalizedSlice,
  };
}
