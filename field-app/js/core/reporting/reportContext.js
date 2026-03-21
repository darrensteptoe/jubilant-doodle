// @ts-check

import { selectCensusCanonicalView } from "../selectors/censusCanonical.js";
import { selectCensusDerivedView } from "../selectors/censusDerived.js";
import { selectDistrictCanonicalView } from "../selectors/districtCanonical.js";
import { selectDistrictDerivedView } from "../selectors/districtDerived.js";
import { selectElectionDataCanonicalView } from "../selectors/electionDataCanonical.js";
import { selectElectionDataDerivedView } from "../selectors/electionDataDerived.js";
import { selectEventCalendarCanonicalView } from "../selectors/eventCalendarCanonical.js";
import { selectEventCalendarDerivedView } from "../selectors/eventCalendarDerived.js";
import { selectOutcomeCanonicalView } from "../selectors/outcomeCanonical.js";
import { selectOutcomeDerivedView } from "../selectors/outcomeDerived.js";
import { selectTargetingCanonicalView } from "../selectors/targetingCanonical.js";
import { selectTargetingDerivedView } from "../selectors/targetingDerived.js";
import { selectWeatherRiskCanonicalView } from "../selectors/weatherRiskCanonical.js";
import { selectWeatherRiskDerivedView } from "../selectors/weatherRiskDerived.js";
import { buildMetricProvenanceDiagnostics } from "../state/metricProvenance.js";
import { migrateLegacyStateToCanonical } from "../state/schema.js";
import { resolveCanonicalReportType } from "./reportTypes.js";

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

function asDate(value) {
  const dt = value instanceof Date ? value : new Date(value || Date.now());
  if (!Number.isFinite(dt.getTime())) {
    return new Date();
  }
  return dt;
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function normalizeMetricValueMap(metricDiagnostics = {}) {
  const order = asArray(metricDiagnostics.metricOrder);
  const rows = metricDiagnostics.metrics && typeof metricDiagnostics.metrics === "object"
    ? metricDiagnostics.metrics
    : {};
  /** @type {Record<string, any>} */
  const out = {};
  order.forEach((id) => {
    const row = rows[id] || {};
    out[id] = {
      value: row.value ?? null,
      selector: cleanText(row.selector),
      revisionToken: cleanText(row.revisionToken),
      canonicalSlices: asArray(row.canonicalSlices).map((token) => cleanText(token)).filter(Boolean),
      influences: {
        electionData: !!row?.influences?.electionData,
        census: !!row?.influences?.census,
        candidateHistory: !!row?.influences?.candidateHistory,
      },
      lastRecomputedAt: cleanText(row.lastRecomputedAt),
    };
  });
  return out;
}

function readPriorMetricMap(comparison = {}) {
  const prior = comparison?.priorReport;
  if (!prior || typeof prior !== "object") return {};

  const direct = prior.metrics && typeof prior.metrics === "object" ? prior.metrics : null;
  if (direct && direct.metrics && typeof direct.metrics === "object") {
    return direct.metrics;
  }

  const selectorSnapshot = prior.selectorSnapshot && typeof prior.selectorSnapshot === "object"
    ? prior.selectorSnapshot
    : null;
  if (selectorSnapshot && selectorSnapshot.metrics && typeof selectorSnapshot.metrics === "object") {
    return selectorSnapshot.metrics;
  }

  return {};
}

function deriveDirection(delta) {
  if (!Number.isFinite(delta) || delta === 0) return "flat";
  return delta > 0 ? "up" : "down";
}

function buildComparisonSummary(currentMetrics = {}, comparison = {}) {
  const priorMetricMap = readPriorMetricMap(comparison);
  const priorScenario = comparison?.priorScenario && typeof comparison.priorScenario === "object"
    ? comparison.priorScenario
    : null;
  const priorWeek = comparison?.priorWeek && typeof comparison.priorWeek === "object"
    ? comparison.priorWeek
    : null;
  const priorElectionImport = comparison?.priorElectionImport && typeof comparison.priorElectionImport === "object"
    ? comparison.priorElectionImport
    : null;

  /** @type {Array<Record<string, any>>} */
  const trends = [];
  for (const metricId of Object.keys(currentMetrics)) {
    const current = toFinite(currentMetrics?.[metricId]?.value, null);
    const previous = toFinite(priorMetricMap?.[metricId]?.value, null);
    if (current == null || previous == null) continue;
    const delta = Number((current - previous).toFixed(6));
    trends.push({
      metricId,
      current,
      previous,
      delta,
      direction: deriveDirection(delta),
    });
  }

  return {
    hasComparison: trends.length > 0 || !!priorScenario || !!priorWeek || !!priorElectionImport,
    trendRows: trends,
    reference: {
      priorReportGeneratedAt: cleanText(comparison?.priorReport?.generatedAt),
      priorScenarioId: cleanText(priorScenario?.scenarioId),
      priorWeekLabel: cleanText(priorWeek?.label),
      priorElectionImportId: cleanText(priorElectionImport?.importId),
    },
  };
}

export function buildReportContext({
  reportType = "internal_full",
  state = {},
  resultsSnapshot = null,
  comparison = null,
  nowDate = null,
} = {}) {
  const resolvedNow = asDate(nowDate);
  const canonicalReportType = resolveCanonicalReportType(reportType);
  const canonicalState = migrateLegacyStateToCanonical(state, { nowDate: resolvedNow });

  const districtCanonical = selectDistrictCanonicalView(canonicalState);
  const districtDerived = selectDistrictDerivedView(canonicalState);
  const electionDataCanonical = selectElectionDataCanonicalView(canonicalState);
  const electionDataDerived = selectElectionDataDerivedView(canonicalState);
  const targetingCanonical = selectTargetingCanonicalView(canonicalState);
  const targetingDerived = selectTargetingDerivedView(canonicalState);
  const censusCanonical = selectCensusCanonicalView(canonicalState);
  const censusDerived = selectCensusDerivedView(canonicalState);
  const weatherRiskCanonical = selectWeatherRiskCanonicalView(canonicalState);
  const weatherRiskDerived = selectWeatherRiskDerivedView(canonicalState);
  const eventCalendarCanonical = selectEventCalendarCanonicalView(canonicalState);
  const eventCalendarDerived = selectEventCalendarDerivedView(canonicalState);
  const outcomeCanonical = selectOutcomeCanonicalView(canonicalState);
  const outcomeDerived = selectOutcomeDerivedView(canonicalState);
  const metricDiagnostics = buildMetricProvenanceDiagnostics(canonicalState, { nowDate: resolvedNow });

  const metrics = normalizeMetricValueMap(metricDiagnostics);
  const comparisonSummary = buildComparisonSummary(metrics, comparison || {});

  const campaignDomain = canonicalState?.domains?.campaign || {};
  const scenariosDomain = canonicalState?.domains?.scenarios || {};
  const governanceDomain = canonicalState?.domains?.governance || {};
  const auditDomain = canonicalState?.domains?.audit || {};
  const archiveDomain = canonicalState?.domains?.forecastArchive || {};
  const recoveryDomain = canonicalState?.domains?.recovery || {};

  const benchmarkRecommendations = electionDataCanonical?.benchmarks?.downstreamRecommendations || {};
  const reportContext = {
    reportType: canonicalReportType,
    generatedAt: resolvedNow.toISOString(),
    context: {
      campaignId: cleanText(campaignDomain.campaignId),
      campaignName: cleanText(campaignDomain.campaignName),
      officeId: cleanText(campaignDomain.officeId),
      scenarioId: cleanText(scenariosDomain.activeScenarioId || scenariosDomain.selectedScenarioId),
      scenarioName: cleanText(campaignDomain.scenarioName),
    },
    selectorRefs: {
      canonical: [
        "selectDistrictCanonicalView",
        "selectElectionDataCanonicalView",
        "selectTargetingCanonicalView",
        "selectCensusCanonicalView",
        "selectWeatherRiskCanonicalView",
        "selectEventCalendarCanonicalView",
        "selectOutcomeCanonicalView",
      ],
      derived: [
        "selectDistrictDerivedView",
        "selectElectionDataDerivedView",
        "selectTargetingDerivedView",
        "selectCensusDerivedView",
        "selectWeatherRiskDerivedView",
        "selectEventCalendarDerivedView",
        "selectOutcomeDerivedView",
      ],
      metrics: "buildMetricProvenanceDiagnostics",
    },
    selectors: {
      districtCanonical,
      districtDerived,
      electionDataCanonical,
      electionDataDerived,
      targetingCanonical,
      targetingDerived,
      censusCanonical,
      censusDerived,
      weatherRiskCanonical,
      weatherRiskDerived,
      eventCalendarCanonical,
      eventCalendarDerived,
      outcomeCanonical,
      outcomeDerived,
    },
    metrics: {
      order: asArray(metricDiagnostics.metricOrder),
      metrics,
      comparison: comparisonSummary,
    },
    electionDataInfluence: {
      qualityScore: toFinite(electionDataDerived?.qualitySummary?.score, null),
      confidenceBand: cleanText(electionDataDerived?.qualitySummary?.confidenceBand) || "unknown",
      comparablePoolCount: toFinite(electionDataDerived?.benchmarkSummary?.comparablePoolCount, 0) || 0,
      turnoutBaselineCount: toFinite(electionDataDerived?.benchmarkSummary?.turnoutBaselineCount, 0) || 0,
      historicalBenchmarkCount: toFinite(electionDataDerived?.benchmarkSummary?.historicalBenchmarkCount, 0) || 0,
      recommendationTargets: clone(electionDataDerived?.benchmarkSummary?.recommendationTargets || {}),
      downstreamRecommendations: clone(benchmarkRecommendations),
      importStatus: cleanText(electionDataDerived?.importStatus?.status),
      importedAt: cleanText(electionDataDerived?.importStatus?.importedAt),
      rowCount: toFinite(electionDataDerived?.importStatus?.rowCount, 0) || 0,
    },
    operations: {
      weatherRisk: {
        fieldExecutionRisk: cleanText(weatherRiskDerived?.riskSummary?.fieldExecutionRisk || weatherRiskCanonical?.fieldExecutionRisk),
        electionDayTurnoutRisk: cleanText(weatherRiskDerived?.riskSummary?.electionDayTurnoutRisk || weatherRiskCanonical?.electionDayTurnoutRisk),
        recommendedAction: cleanText(weatherRiskDerived?.riskSummary?.recommendedAction || weatherRiskCanonical?.recommendedAction),
        selectedZip: cleanText(weatherRiskCanonical?.selectedZip),
      },
      eventCalendar: {
        totalEvents: toFinite(eventCalendarDerived?.summary?.totalEvents, 0) || 0,
        appliedEvents: toFinite(eventCalendarDerived?.summary?.appliedEvents, 0) || 0,
        openFollowUps: toFinite(eventCalendarDerived?.summary?.openFollowUps, 0) || 0,
        upcoming: clone(eventCalendarDerived?.upcomingEvents || []),
      },
    },
    assurance: {
      governance: {
        confidenceBand: cleanText(governanceDomain?.confidenceBand),
        topWarning: cleanText(governanceDomain?.topWarning),
        learningRecommendation: cleanText(governanceDomain?.learningRecommendation),
        hasSnapshot: !!governanceDomain?.snapshot,
      },
      audit: {
        hasValidationSnapshot: !!auditDomain?.validationSnapshot,
        hasRealismSnapshot: !!auditDomain?.realismSnapshot,
        hasDiagnosticsSnapshot: !!auditDomain?.diagnosticsSnapshot,
        contractFindingCount: asArray(auditDomain?.contractFindings).length,
      },
      recovery: {
        strictImport: !!recoveryDomain?.strictImport,
        usbConnected: !!recoveryDomain?.usbConnected,
        lastBackupRestoreAt: cleanText(recoveryDomain?.lastBackupRestoreAt),
        lastWarning: cleanText(recoveryDomain?.lastWarning),
      },
    },
    archive: {
      selectedHash: cleanText(archiveDomain?.selectedHash),
      entryCount: asArray(archiveDomain?.entries).length,
      summary: clone(archiveDomain?.summary || {}),
    },
    sourceReferences: {
      snapshotHash: cleanText(resultsSnapshot?.snapshotHash),
      schemaVersion: cleanText(resultsSnapshot?.schemaVersion),
      appVersion: cleanText(resultsSnapshot?.appVersion),
      buildId: cleanText(resultsSnapshot?.buildId),
    },
  };

  return reportContext;
}
