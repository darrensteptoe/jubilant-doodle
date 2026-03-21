// @ts-check

import { computeElectionDataBenchmarks } from "../electionData/benchmarks.js";
import { importElectionDataCsv } from "../electionData/importCsv.js";
import { deriveElectionDataColumnMap, normalizeElectionDataColumnMap } from "../electionData/mapColumns.js";
import { normalizeElectionDataRows } from "../electionData/normalizeRows.js";
import {
  buildCandidateReconciliationWarnings,
  reconcileElectionDataCandidateRows,
} from "../electionData/reconcileCandidates.js";
import {
  buildGeographyReconciliationWarnings,
  reconcileElectionDataGeographyRows,
} from "../electionData/reconcileGeographies.js";
import { summarizeElectionDataQuality } from "../electionData/quality.js";
import { normalizeElectionDataSlice } from "../state/schema.js";
import { asArray, clone, makeActionResult, mutateDomain } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toObject(value) {
  return value && typeof value === "object" ? value : {};
}

function assignSlice(draft, slice) {
  Object.keys(draft).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(slice, key)) {
      delete draft[key];
    }
  });
  Object.entries(slice).forEach(([key, value]) => {
    draft[key] = value;
  });
}

function recomputeElectionSlice(draft, nowDate = new Date()) {
  const normalized = normalizeElectionDataSlice(draft, { nowDate });
  normalized.quality = summarizeElectionDataQuality(normalized, { nowDate });
  normalized.benchmarks = computeElectionDataBenchmarks(normalized.normalizedRows, {
    nowDate,
    quality: normalized.quality,
  });
  assignSlice(draft, normalized);
}

function mergeBenchmarks(base, patch, downstream) {
  const normalizedBase = toObject(base);
  const normalizedPatch = toObject(patch);
  const normalizedDownstream = toObject(downstream);

  return {
    ...normalizedBase,
    ...clone(normalizedPatch),
    downstreamRecommendations: {
      ...clone(normalizedBase.downstreamRecommendations || {}),
      ...clone(normalizedDownstream),
      district: {
        ...clone(normalizedBase.downstreamRecommendations?.district || {}),
        ...clone(normalizedDownstream.district || {}),
      },
      targeting: {
        ...clone(normalizedBase.downstreamRecommendations?.targeting || {}),
        ...clone(normalizedDownstream.targeting || {}),
      },
      outcome: {
        ...clone(normalizedBase.downstreamRecommendations?.outcome || {}),
        ...clone(normalizedDownstream.outcome || {}),
      },
    },
  };
}

export function importElectionDataFile(state, payload, options = {}) {
  const nowDate = options.nowDate || new Date();
  const imported = importElectionDataCsv(payload, { nowDate });
  const autoColumnMap = deriveElectionDataColumnMap(imported.rawRows, {
    headers: imported.headers,
  });
  const normalized = normalizeElectionDataRows(imported.rawRows, {
    nowDate,
    headers: imported.headers,
    columnMap: autoColumnMap,
    context: toObject(payload?.context),
    existingSlice: {
      qa: {
        sourceWarnings: imported.warnings,
        errors: imported.errors,
      },
    },
  });

  const result = mutateDomain(
    state,
    "electionData",
    (draft) => {
      draft.import.fileName = imported.importMeta.fileName;
      draft.import.fileSize = imported.importMeta.fileSize;
      draft.import.fileHash = imported.importMeta.fileHash;
      draft.import.importedAt = imported.importMeta.importedAt;
      draft.import.format = cleanText(normalized.format || imported.format).toLowerCase();
      draft.import.status = imported.ok && normalized.ok ? "imported" : "error";
      draft.import.statusText = imported.ok && normalized.ok
        ? `Imported ${asArray(normalized.normalizedRecords).length} normalized rows.`
        : cleanText(imported.errors[0] || normalized.errors[0]) || "Election data import failed.";

      draft.rawRows = clone(imported.rawRows);
      draft.normalizedRows = clone(normalized.normalizedRecords);
      draft.schemaMapping.status = normalized.mapping.mappedColumns.length ? "mapped" : "unmapped";
      draft.schemaMapping.columnMap = clone(normalized.mapping.columnMap);
      draft.schemaMapping.mappedColumns = normalized.mapping.mappedColumns.slice();
      draft.schemaMapping.unmappedColumns = normalized.mapping.unmappedColumns.slice();
      draft.qa.sourceWarnings = Array.from(new Set([
        ...asArray(imported.warnings),
        ...asArray(normalized.warnings),
      ].map((item) => cleanText(item)).filter(Boolean)));
      draft.qa.mappingWarnings = asArray(normalized.mapping.warnings).map((item) => cleanText(item)).filter(Boolean);
      draft.qa.errors = Array.from(new Set([
        ...asArray(imported.errors),
        ...asArray(normalized.errors),
      ].map((item) => cleanText(item)).filter(Boolean)));
      draft.qa.candidateWarnings = [];
      draft.qa.geographyWarnings = [];

      recomputeElectionSlice(draft, nowDate);
      return true;
    },
    { ...options, revisionReason: "electionData.importFile" },
  );

  return makeActionResult(result, {
    importOk: imported.ok && normalized.ok,
    errorCount: asArray(imported.errors).length + asArray(normalized.errors).length,
    warningCount: asArray(imported.warnings).length + asArray(normalized.warnings).length,
  });
}

export function mapElectionDataColumns(state, payload, options = {}) {
  const nowDate = options.nowDate || new Date();
  const columnMapInput = toObject(payload?.columnMap);

  const result = mutateDomain(
    state,
    "electionData",
    (draft) => {
      const normalizedMap = normalizeElectionDataColumnMap(columnMapInput, {
        headers: Object.keys(draft.rawRows?.[0] || {}),
      });
      const mapped = normalizeElectionDataRows(draft.rawRows, {
        nowDate,
        columnMap: normalizedMap.columnMap,
        existingSlice: draft,
      });

      const currentMapJson = JSON.stringify(toObject(draft.schemaMapping?.columnMap));
      const nextMapJson = JSON.stringify(toObject(mapped.mapping.columnMap));
      const currentRowsJson = JSON.stringify(asArray(draft.normalizedRows));
      const nextRowsJson = JSON.stringify(asArray(mapped.normalizedRecords));
      const changed = currentMapJson !== nextMapJson || currentRowsJson !== nextRowsJson;
      if (!changed) return false;

      draft.schemaMapping.status = mapped.mapping.mappedColumns.length ? "mapped" : "unmapped";
      draft.schemaMapping.columnMap = clone(mapped.mapping.columnMap);
      draft.schemaMapping.mappedColumns = mapped.mapping.mappedColumns.slice();
      draft.schemaMapping.unmappedColumns = mapped.mapping.unmappedColumns.slice();
      draft.normalizedRows = clone(mapped.normalizedRecords);
      draft.qa.mappingWarnings = asArray(mapped.mapping.warnings).map((item) => cleanText(item)).filter(Boolean);
      draft.qa.errors = asArray(mapped.errors).map((item) => cleanText(item)).filter(Boolean);
      draft.qa.sourceWarnings = asArray(mapped.warnings).map((item) => cleanText(item)).filter(Boolean);

      recomputeElectionSlice(draft, nowDate);
      return true;
    },
    { ...options, revisionReason: "electionData.mapColumns" },
  );

  return makeActionResult(result);
}

export function reconcileElectionDataCandidates(state, payload, options = {}) {
  const nowDate = options.nowDate || new Date();
  const mapping = toObject(payload?.mapping);

  const result = mutateDomain(
    state,
    "electionData",
    (draft) => {
      const reconciled = reconcileElectionDataCandidateRows(draft.normalizedRows, mapping);
      if (!reconciled.changed) return false;
      draft.normalizedRows = clone(reconciled.rows);
      draft.qa.candidateWarnings = buildCandidateReconciliationWarnings(reconciled.unresolvedNames);
      recomputeElectionSlice(draft, nowDate);
      return true;
    },
    { ...options, revisionReason: "electionData.reconcileCandidates" },
  );

  return makeActionResult(result);
}

export function reconcileElectionDataGeographies(state, payload, options = {}) {
  const nowDate = options.nowDate || new Date();
  const mapping = toObject(payload?.mapping);

  const result = mutateDomain(
    state,
    "electionData",
    (draft) => {
      const reconciled = reconcileElectionDataGeographyRows(draft.normalizedRows, mapping);
      if (!reconciled.changed) return false;
      draft.normalizedRows = clone(reconciled.rows);
      draft.qa.geographyWarnings = buildGeographyReconciliationWarnings(reconciled.unresolvedGeographies);
      recomputeElectionSlice(draft, nowDate);
      return true;
    },
    { ...options, revisionReason: "electionData.reconcileGeographies" },
  );

  return makeActionResult(result);
}

export function applyElectionBenchmarks(state, payload, options = {}) {
  const nowDate = options.nowDate || new Date();
  const patch = toObject(payload?.benchmarks);
  const downstream = toObject(payload?.downstreamRecommendations);
  const hasPatch = Object.keys(patch).length > 0 || Object.keys(downstream).length > 0;

  const result = mutateDomain(
    state,
    "electionData",
    (draft) => {
      if (!hasPatch) return false;
      recomputeElectionSlice(draft, nowDate);
      draft.benchmarks = mergeBenchmarks(draft.benchmarks, patch, downstream);
      return true;
    },
    { ...options, revisionReason: "electionData.applyBenchmarks" },
  );

  return makeActionResult(result);
}
