// @ts-check

import {
  applyElectionBenchmarks,
  importElectionDataFile,
  mapElectionDataColumns,
  reconcileElectionDataCandidates,
  reconcileElectionDataGeographies,
} from "../../../core/actions/electionData.js";
import { selectElectionDataCanonicalView } from "../../../core/selectors/electionDataCanonical.js";
import { selectElectionDataDerivedView } from "../../../core/selectors/electionDataDerived.js";
import {
  CANONICAL_SCHEMA_VERSION,
  makeDefaultElectionDataDomain,
  normalizeElectionDataSlice,
} from "../../../core/state/schema.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatScore(value, fallback = "—") {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function nowIso(nowDate = new Date()) {
  const next = nowDate instanceof Date ? nowDate : new Date(nowDate);
  return Number.isFinite(next.getTime()) ? next.toISOString() : new Date().toISOString();
}

function toCanonicalEnvelope(slice, nowDate = new Date()) {
  const electionSlice = normalizeElectionDataSlice(slice, { nowDate });
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    revision: toFinite(electionSlice.revision, 0) || 0,
    updatedAt: nowIso(nowDate),
    domains: {
      electionData: electionSlice,
    },
  };
}

function buildDerivedStatusTexts(canonical, derived) {
  const rowCount = toFinite(derived?.importStatus?.rowCount, 0) || 0;
  const score = toFinite(derived?.qualitySummary?.score, null);
  const confidenceBand = cleanText(derived?.qualitySummary?.confidenceBand) || "unknown";
  const suggestionCount = toFinite(derived?.benchmarkSummary?.historicalBenchmarkCount, 0) || 0;
  const recommendationTargets = toFinite(derived?.benchmarkSummary?.recommendationTargets?.district, 0)
    + toFinite(derived?.benchmarkSummary?.recommendationTargets?.targeting, 0)
    + toFinite(derived?.benchmarkSummary?.recommendationTargets?.outcome, 0);

  return {
    statusText: rowCount > 0
      ? `Normalized ${rowCount} row(s).`
      : "No election rows normalized yet.",
    qualityText: score == null
      ? "Quality score unavailable."
      : `Quality ${formatScore(score)} (${confidenceBand}).`,
    benchmarkText: suggestionCount > 0
      ? `${suggestionCount} benchmark row(s) available.`
      : "No benchmark rows yet.",
    mappingText: cleanText(canonical?.schemaMapping?.status) === "mapped"
      ? `Mapped ${asArray(canonical?.schemaMapping?.mappedColumns).length} column(s).`
      : "Column mapping required.",
    candidateReconciliationText: asArray(canonical?.qa?.candidateWarnings).length
      ? asArray(canonical?.qa?.candidateWarnings)[0]
      : "Candidate reconciliation complete.",
    geographyReconciliationText: asArray(canonical?.qa?.geographyWarnings).length
      ? asArray(canonical?.qa?.geographyWarnings)[0]
      : "Geography reconciliation complete.",
    downstreamStatusText: recommendationTargets > 0
      ? `${recommendationTargets} downstream recommendation target(s) ready.`
      : "No downstream recommendations yet.",
  };
}

function buildPreviewRows(canonical) {
  return asArray(canonical?.normalizedRows)
    .slice(0, 25)
    .map((row) => ({
      rowId: cleanText(row?.rowId),
      cycleYear: toFinite(row?.cycleYear, null),
      office: cleanText(row?.office),
      districtId: cleanText(row?.districtId),
      geographyId: cleanText(row?.geographyId),
      candidateId: cleanText(row?.candidateId),
      candidateName: cleanText(row?.candidateName),
      voteTotal: toFinite(row?.voteTotal, null),
      turnoutTotal: toFinite(row?.turnoutTotal, null),
    }));
}

export function createElectionDataBridge(options = {}) {
  const getState = typeof options.getState === "function" ? options.getState : () => ({});
  const mutateState = typeof options.mutateState === "function" ? options.mutateState : null;
  const isScenarioLocked = typeof options.isScenarioLocked === "function" ? options.isScenarioLocked : () => false;

  function readSlice(nowDate = new Date()) {
    const state = getState();
    const raw = state?.electionData && typeof state.electionData === "object"
      ? state.electionData
      : makeDefaultElectionDataDomain(nowDate);
    return normalizeElectionDataSlice(raw, { nowDate });
  }

  function writeSlice(nextSlice) {
    if (typeof mutateState !== "function") return false;
    const normalized = normalizeElectionDataSlice(nextSlice, { nowDate: new Date() });
    mutateState((next) => {
      next.electionData = clone(normalized);
    });
    return true;
  }

  function canonicalView(nowDate = new Date()) {
    return selectElectionDataCanonicalView(toCanonicalEnvelope(readSlice(nowDate), nowDate));
  }

  function derivedView(nowDate = new Date()) {
    const canonical = canonicalView(nowDate);
    const derived = selectElectionDataDerivedView(toCanonicalEnvelope(canonical, nowDate));
    const status = buildDerivedStatusTexts(canonical, derived);
    return {
      ...derived,
      ...status,
      normalizedPreviewRows: buildPreviewRows(canonical),
    };
  }

  function combinedView(nowDate = new Date()) {
    const canonical = canonicalView(nowDate);
    const derived = derivedView(nowDate);
    return {
      import: canonical.import,
      schemaMapping: canonical.schemaMapping,
      rawRows: canonical.rawRows,
      normalizedRows: canonical.normalizedRows,
      qa: canonical.qa,
      quality: canonical.quality,
      benchmarks: canonical.benchmarks,
      importStatus: derived.importStatus,
      coverage: derived.coverage,
      totals: derived.totals,
      qualitySummary: derived.qualitySummary,
      benchmarkSummary: derived.benchmarkSummary,
      statusText: derived.statusText,
      qualityText: derived.qualityText,
      benchmarkText: derived.benchmarkText,
      mappingText: derived.mappingText,
      candidateReconciliationText: derived.candidateReconciliationText,
      geographyReconciliationText: derived.geographyReconciliationText,
      downstreamStatusText: derived.downstreamStatusText,
      normalizedPreviewRows: derived.normalizedPreviewRows,
      canonical,
      derived,
    };
  }

  function runAction(actionFn, payload, code) {
    if (isScenarioLocked()) {
      return {
        ok: false,
        changed: false,
        code: "locked",
        reason: "scenario_locked",
        view: combinedView(),
      };
    }

    const nowDate = new Date();
    const envelope = toCanonicalEnvelope(readSlice(nowDate), nowDate);
    const result = actionFn(envelope, payload, { nowDate });
    const nextSlice = result?.state?.domains?.electionData;
    if (result?.changed && nextSlice) {
      writeSlice(nextSlice);
    }
    return {
      ok: !result?.blocked,
      changed: !!result?.changed,
      blocked: !!result?.blocked,
      code: cleanText(code || result?.reason || "ok") || "ok",
      reason: cleanText(result?.reason || "ok") || "ok",
      view: combinedView(),
    };
  }

  return {
    getCanonicalView: () => canonicalView(),
    getDerivedView: () => derivedView(),
    getView: () => combinedView(),
    importFile: (payload) => runAction(importElectionDataFile, payload, "import"),
    mapColumns: (payload) => runAction(mapElectionDataColumns, payload, "map_columns"),
    reconcileCandidates: (payload) => runAction(reconcileElectionDataCandidates, payload, "reconcile_candidates"),
    reconcileGeographies: (payload) => runAction(reconcileElectionDataGeographies, payload, "reconcile_geographies"),
    applyBenchmarks: (payload) => runAction(applyElectionBenchmarks, payload, "apply_benchmarks"),
  };
}
