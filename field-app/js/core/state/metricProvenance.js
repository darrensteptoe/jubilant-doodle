// @ts-check

import { ensureCanonicalState, toFinite } from "../selectors/_core.js";
import { selectDistrictCanonicalView } from "../selectors/districtCanonical.js";
import { selectDistrictDerivedView } from "../selectors/districtDerived.js";
import { selectTargetingCanonicalView } from "../selectors/targetingCanonical.js";
import { selectTargetingDerivedView } from "../selectors/targetingDerived.js";
import { selectOutcomeDerivedView } from "../selectors/outcomeDerived.js";
import { selectElectionDataDerivedView } from "../selectors/electionDataDerived.js";

const METRIC_KEYS = Object.freeze([
  "baselineSupport",
  "turnoutExpected",
  "persuasionNeed",
  "targetingScore",
  "outcomeConfidence",
  "electionBenchmarkQuality",
]);

function toIso(nowDate = new Date()) {
  const value = nowDate instanceof Date ? nowDate : new Date(nowDate);
  if (Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  return new Date().toISOString();
}

function bool(value) {
  return value === true;
}

function rev(canonical, domain) {
  const n = Number(canonical?.domains?.[domain]?.revision || 0);
  return Number.isFinite(n) ? n : 0;
}

function tokenForDomains(canonical, domains = []) {
  const list = Array.isArray(domains) ? domains : [domains];
  return list
    .map((domain) => `${String(domain)}:${rev(canonical, domain)}`)
    .join("|");
}

function resolveLastRecomputedAt(metricId, token, generatedAt, cache = null) {
  if (!cache || typeof cache.get !== "function" || typeof cache.set !== "function") {
    return generatedAt;
  }
  const prev = cache.get(metricId);
  if (prev && prev.token === token && prev.at) {
    return prev.at;
  }
  cache.set(metricId, { token, at: generatedAt });
  return generatedAt;
}

function computePersuasionNeedVotes(turnoutExpected, baselineSupportPct) {
  const turnout = toFinite(turnoutExpected, null);
  const support = toFinite(baselineSupportPct, null);
  if (turnout == null || support == null) {
    return null;
  }
  const supportUnit = support / 100;
  const need = Math.max(0, (0.5 - supportUnit) * turnout);
  return Math.round(need);
}

function withMetricMeta({
  metricId,
  label,
  value,
  unit,
  selector,
  canonicalSlices,
  domainRevisions,
  influences,
  generatedAt,
  revisionToken,
  lastRecomputeCache = null,
  notes = "",
}) {
  return {
    metricId,
    label,
    value: value == null ? null : value,
    unit: String(unit || "").trim() || null,
    selector,
    canonicalSlices: Array.isArray(canonicalSlices) ? canonicalSlices.slice() : [],
    domainRevisions: domainRevisions && typeof domainRevisions === "object" ? { ...domainRevisions } : {},
    influences: {
      electionData: bool(influences?.electionData),
      census: bool(influences?.census),
      candidateHistory: bool(influences?.candidateHistory),
    },
    revisionToken,
    lastRecomputedAt: resolveLastRecomputedAt(metricId, revisionToken, generatedAt, lastRecomputeCache),
    notes: String(notes || "").trim(),
  };
}

export function buildMetricProvenanceDiagnostics(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const generatedAt = toIso(options.nowDate || new Date());
  const cache = options.lastRecomputeCache || null;

  const districtCanonical = selectDistrictCanonicalView(canonical, options);
  const districtDerived = selectDistrictDerivedView(canonical, options);
  const targetingCanonical = selectTargetingCanonicalView(canonical, options);
  const targetingDerived = selectTargetingDerivedView(canonical, options);
  const outcomeDerived = selectOutcomeDerivedView(canonical, options);
  const electionDerived = selectElectionDataDerivedView(canonical, options);

  const baselineSupport = toFinite(districtDerived?.supportSnapshot?.supportSumPct, null);
  const turnoutExpected = toFinite(districtDerived?.turnoutSnapshot?.turnoutMean, null);
  const matchedHistoryCount = Math.max(
    0,
    Math.trunc(toFinite(districtDerived?.historySnapshot?.matchedRecordCount, 0) || 0),
  );
  const hasElectionImport = bool(districtDerived?.electionDataSummary?.imported);
  const hasCensusScope = bool(districtDerived?.censusSummary?.hasGeographyScope);
  const electionInputReady = bool(targetingDerived?.upstream?.electionInputReady);
  const censusInputReady = bool(targetingDerived?.upstream?.censusInputReady);
  const outcomeRecommendationCount = Math.max(
    0,
    Math.trunc(toFinite(electionDerived?.benchmarkSummary?.recommendationTargets?.outcome, 0) || 0),
  );

  const baselineSupportToken = tokenForDomains(canonical, [
    "district",
    "ballot",
    "candidateHistory",
    "electionData",
    "census",
  ]);
  const turnoutExpectedToken = tokenForDomains(canonical, [
    "district",
    "electionData",
    "census",
  ]);
  const persuasionNeedToken = tokenForDomains(canonical, [
    "district",
    "ballot",
    "candidateHistory",
    "electionData",
    "census",
  ]);
  const targetingScoreToken = tokenForDomains(canonical, [
    "targeting",
    "district",
    "census",
    "electionData",
  ]);
  const outcomeConfidenceToken = tokenForDomains(canonical, [
    "outcome",
    "electionData",
    "census",
    "candidateHistory",
  ]);
  const electionQualityToken = tokenForDomains(canonical, [
    "electionData",
  ]);

  const metrics = {
    baselineSupport: withMetricMeta({
      metricId: "baseline_support",
      label: "Baseline support",
      value: baselineSupport,
      unit: "pct",
      selector: "selectDistrictDerivedView",
      canonicalSlices: [
        "domains.ballot.candidateRefs",
        "domains.ballot.undecidedPct",
        "domains.candidateHistory.records",
        "domains.electionData.quality",
        "domains.census.config",
      ],
      domainRevisions: {
        district: rev(canonical, "district"),
        ballot: rev(canonical, "ballot"),
        candidateHistory: rev(canonical, "candidateHistory"),
        electionData: rev(canonical, "electionData"),
        census: rev(canonical, "census"),
      },
      influences: {
        electionData: hasElectionImport,
        census: hasCensusScope,
        candidateHistory: matchedHistoryCount > 0,
      },
      generatedAt,
      revisionToken: baselineSupportToken,
      lastRecomputeCache: cache,
      notes: `Candidate rows=${districtDerived?.supportSnapshot?.candidateCount || 0}`,
    }),
    turnoutExpected: withMetricMeta({
      metricId: "turnout_expected",
      label: "Turnout expected",
      value: turnoutExpected,
      unit: "pct",
      selector: "selectDistrictDerivedView",
      canonicalSlices: [
        "domains.district.form.turnoutA",
        "domains.district.form.turnoutB",
        "domains.district.form.weeksRemaining",
        "domains.electionData.benchmarks.turnoutBaselines",
      ],
      domainRevisions: {
        district: rev(canonical, "district"),
        electionData: rev(canonical, "electionData"),
        census: rev(canonical, "census"),
      },
      influences: {
        electionData: toFinite(targetingCanonical?.upstreamInputs?.electionData?.baselineTurnoutRate, null) != null || hasElectionImport,
        census: hasCensusScope,
        candidateHistory: false,
      },
      generatedAt,
      revisionToken: turnoutExpectedToken,
      lastRecomputeCache: cache,
      notes: `Turnout anchors present=${bool(districtDerived?.turnoutSnapshot?.hasTurnoutAnchors)}`,
    }),
    persuasionNeed: withMetricMeta({
      metricId: "persuasion_need",
      label: "Persuasion need",
      value: computePersuasionNeedVotes(turnoutExpected, baselineSupport),
      unit: "votes",
      selector: "selectDistrictDerivedView + provenanceFormula.persuasionNeed",
      canonicalSlices: [
        "domains.district.form.turnoutA",
        "domains.district.form.turnoutB",
        "domains.ballot.candidateRefs",
        "domains.candidateHistory.records",
        "domains.electionData.quality",
        "domains.census.config",
      ],
      domainRevisions: {
        district: rev(canonical, "district"),
        ballot: rev(canonical, "ballot"),
        candidateHistory: rev(canonical, "candidateHistory"),
        electionData: rev(canonical, "electionData"),
        census: rev(canonical, "census"),
      },
      influences: {
        electionData: hasElectionImport || electionInputReady,
        census: hasCensusScope,
        candidateHistory: matchedHistoryCount > 0,
      },
      generatedAt,
      revisionToken: persuasionNeedToken,
      lastRecomputeCache: cache,
      notes: "Formula: max(0, (0.5 - baselineSupport/100) * turnoutExpected)",
    }),
    targetingScore: withMetricMeta({
      metricId: "targeting_score",
      label: "Targeting score",
      value: toFinite(targetingDerived?.performance?.averageScore, null),
      unit: "score",
      selector: "selectTargetingDerivedView",
      canonicalSlices: [
        "domains.targeting.config",
        "domains.targeting.runtime.rows",
        "domains.district.form",
        "domains.census.selection",
        "domains.electionData.benchmarks.downstreamRecommendations.targeting",
      ],
      domainRevisions: {
        targeting: rev(canonical, "targeting"),
        district: rev(canonical, "district"),
        census: rev(canonical, "census"),
        electionData: rev(canonical, "electionData"),
      },
      influences: {
        electionData: electionInputReady,
        census: censusInputReady,
        candidateHistory: false,
      },
      generatedAt,
      revisionToken: targetingScoreToken,
      lastRecomputeCache: cache,
      notes: String(targetingDerived?.electionInfluence?.explanationText || "").trim(),
    }),
    outcomeConfidence: withMetricMeta({
      metricId: "outcome_confidence",
      label: "Outcome confidence",
      value: toFinite(outcomeDerived?.mcSummary?.winProb, null),
      unit: "probability",
      selector: "selectOutcomeDerivedView",
      canonicalSlices: [
        "domains.outcome.cache.mcLast",
        "domains.outcome.cache.mcLastHash",
        "domains.electionData.benchmarks.downstreamRecommendations.outcome",
        "domains.census.selection",
        "domains.candidateHistory.records",
      ],
      domainRevisions: {
        outcome: rev(canonical, "outcome"),
        electionData: rev(canonical, "electionData"),
        census: rev(canonical, "census"),
        candidateHistory: rev(canonical, "candidateHistory"),
      },
      influences: {
        electionData: outcomeRecommendationCount > 0,
        census: censusInputReady,
        candidateHistory: matchedHistoryCount > 0,
      },
      generatedAt,
      revisionToken: outcomeConfidenceToken,
      lastRecomputeCache: cache,
      notes: `marginBandWidth=${toFinite(outcomeDerived?.mcSummary?.marginBandWidth, null) ?? "n/a"}`,
    }),
    electionBenchmarkQuality: withMetricMeta({
      metricId: "election_benchmark_quality",
      label: "Election benchmark quality",
      value: toFinite(electionDerived?.qualitySummary?.score, null),
      unit: "score",
      selector: "selectElectionDataDerivedView",
      canonicalSlices: [
        "domains.electionData.quality",
        "domains.electionData.qa",
        "domains.electionData.benchmarks.historicalRaceBenchmarks",
        "domains.electionData.benchmarks.turnoutBaselines",
        "domains.electionData.normalizedRows",
      ],
      domainRevisions: {
        electionData: rev(canonical, "electionData"),
      },
      influences: {
        electionData: true,
        census: false,
        candidateHistory: false,
      },
      generatedAt,
      revisionToken: electionQualityToken,
      lastRecomputeCache: cache,
      notes: `benchmarks=${toFinite(electionDerived?.benchmarkSummary?.historicalBenchmarkCount, 0) || 0}, comparablePools=${toFinite(electionDerived?.benchmarkSummary?.comparablePoolCount, 0) || 0}`,
    }),
  };

  return {
    version: "metric-provenance-v1",
    generatedAt,
    revision: Number(canonical.revision || 0),
    metricOrder: METRIC_KEYS.slice(),
    metrics,
  };
}

export function createMetricProvenanceTracker(options = {}) {
  const lastRecomputeCache = new Map();
  const now = typeof options.now === "function" ? options.now : () => new Date();

  return {
    compute(state, nextOptions = {}) {
      const nowDate = nextOptions.nowDate || now();
      return buildMetricProvenanceDiagnostics(state, {
        ...nextOptions,
        nowDate,
        lastRecomputeCache,
      });
    },
    reset() {
      lastRecomputeCache.clear();
    },
    size() {
      return lastRecomputeCache.size;
    },
  };
}
