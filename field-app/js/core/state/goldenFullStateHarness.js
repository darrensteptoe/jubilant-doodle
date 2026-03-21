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
import { buildMetricProvenanceDiagnostics } from "./metricProvenance.js";
import { makeCanonicalState, normalizeElectionDataSlice } from "./schema.js";
import { DEFAULT_GOLDEN_NOW_ISO } from "./goldenFullStateFixtures.js";

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (Array.isArray(patch)) return clone(patch);
  if (!isObject(patch)) return patch;

  const nextBase = isObject(base) ? clone(base) : {};
  for (const [key, patchValue] of Object.entries(patch)) {
    if (Array.isArray(patchValue)) {
      nextBase[key] = clone(patchValue);
      continue;
    }
    if (isObject(patchValue)) {
      nextBase[key] = deepMerge(nextBase[key], patchValue);
      continue;
    }
    nextBase[key] = patchValue;
  }
  return nextBase;
}

function asDate(value) {
  const candidate = value ? new Date(value) : new Date(DEFAULT_GOLDEN_NOW_ISO);
  if (!Number.isFinite(candidate.getTime())) {
    return new Date(DEFAULT_GOLDEN_NOW_ISO);
  }
  return candidate;
}

function buildMetricsSignature(state, nowDate) {
  const diagnostics = buildMetricProvenanceDiagnostics(state, { nowDate });
  const order = Array.isArray(diagnostics.metricOrder) ? diagnostics.metricOrder : [];
  /** @type {Record<string, any>} */
  const metrics = {};

  order.forEach((metricId) => {
    const row = diagnostics.metrics?.[metricId] || {};
    metrics[metricId] = {
      value: row.value ?? null,
      revisionToken: row.revisionToken || "",
      canonicalSlices: Array.isArray(row.canonicalSlices) ? row.canonicalSlices.slice() : [],
      selector: row.selector || "",
      influences: {
        electionData: !!row.influences?.electionData,
        census: !!row.influences?.census,
        candidateHistory: !!row.influences?.candidateHistory,
      },
    };
  });

  return {
    version: diagnostics.version || "",
    metricOrder: order,
    metrics,
  };
}

export function buildGoldenStateFromFixture(fixture) {
  const nowDate = asDate(fixture?.nowIso);
  const patch = isObject(fixture?.statePatch) ? fixture.statePatch : {};
  /** @type {any} */
  let state = makeCanonicalState({ nowDate });
  state = deepMerge(state, patch);

  if (isObject(patch?.domains?.electionData)) {
    state.domains.electionData = normalizeElectionDataSlice(state.domains.electionData, { nowDate });
  }

  state.updatedAt = nowDate.toISOString();
  return state;
}

export function buildGoldenSignatureFromState(state, fixture) {
  const nowDate = asDate(fixture?.nowIso);
  const districtCanonical = selectDistrictCanonicalView(state);
  const districtDerived = selectDistrictDerivedView(state);
  const electionDataCanonical = selectElectionDataCanonicalView(state);
  const electionDataDerived = selectElectionDataDerivedView(state);
  const targetingCanonical = selectTargetingCanonicalView(state);
  const targetingDerived = selectTargetingDerivedView(state);
  const censusCanonical = selectCensusCanonicalView(state);
  const censusDerived = selectCensusDerivedView(state);
  const weatherRiskCanonical = selectWeatherRiskCanonicalView(state);
  const weatherRiskDerived = selectWeatherRiskDerivedView(state);
  const eventCalendarCanonical = selectEventCalendarCanonicalView(state);
  const eventCalendarDerived = selectEventCalendarDerivedView(state);
  const outcomeCanonical = selectOutcomeCanonicalView(state);
  const outcomeDerived = selectOutcomeDerivedView(state);

  return {
    fixtureId: String(fixture?.id || ""),
    stateMeta: {
      revision: Number(state?.revision || 0),
      updatedAt: String(state?.updatedAt || ""),
      domainRevisions: {
        district: Number(state?.domains?.district?.revision || 0),
        candidateHistory: Number(state?.domains?.candidateHistory?.revision || 0),
        targeting: Number(state?.domains?.targeting?.revision || 0),
        census: Number(state?.domains?.census?.revision || 0),
        electionData: Number(state?.domains?.electionData?.revision || 0),
        outcome: Number(state?.domains?.outcome?.revision || 0),
        weatherRisk: Number(state?.domains?.weatherRisk?.revision || 0),
        eventCalendar: Number(state?.domains?.eventCalendar?.revision || 0),
      },
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
    metrics: buildMetricsSignature(state, nowDate),
    domainSnapshots: {
      forecastArchive: {
        selectedHash: String(state?.domains?.forecastArchive?.selectedHash || ""),
        entryCount: Array.isArray(state?.domains?.forecastArchive?.entries)
          ? state.domains.forecastArchive.entries.length
          : 0,
        summary: clone(state?.domains?.forecastArchive?.summary || {}),
      },
      recovery: clone(state?.domains?.recovery || {}),
      governance: {
        confidenceBand: String(state?.domains?.governance?.confidenceBand || ""),
        topWarning: String(state?.domains?.governance?.topWarning || ""),
        learningRecommendation: String(state?.domains?.governance?.learningRecommendation || ""),
        hasSnapshot: !!state?.domains?.governance?.snapshot,
      },
      audit: {
        hasValidationSnapshot: !!state?.domains?.audit?.validationSnapshot,
        hasRealismSnapshot: !!state?.domains?.audit?.realismSnapshot,
        hasDiagnosticsSnapshot: !!state?.domains?.audit?.diagnosticsSnapshot,
        contractFindingCount: Array.isArray(state?.domains?.audit?.contractFindings)
          ? state.domains.audit.contractFindings.length
          : 0,
      },
      scenarios: {
        activeScenarioId: String(state?.domains?.scenarios?.activeScenarioId || ""),
        selectedScenarioId: String(state?.domains?.scenarios?.selectedScenarioId || ""),
        recordCount: Object.keys(state?.domains?.scenarios?.records || {}).length,
        decisionSessionCount: Object.keys(state?.domains?.scenarios?.decisionSessions || {}).length,
      },
    },
  };
}

export function buildGoldenSignatureForFixture(fixture) {
  const state = buildGoldenStateFromFixture(fixture);
  return buildGoldenSignatureFromState(state, fixture);
}

export function buildGoldenSignatures(fixtures) {
  const rows = Array.isArray(fixtures) ? fixtures : [];
  /** @type {Record<string, any>} */
  const out = {};
  rows.forEach((fixture) => {
    const id = String(fixture?.id || "").trim();
    if (!id) return;
    out[id] = buildGoldenSignatureForFixture(fixture);
  });
  return out;
}
