// @ts-check

import { asArray, clone, ensureCanonicalState, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function selectTargetingCanonicalView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const targeting = canonical.domains?.targeting || {};
  const district = canonical.domains?.district || {};
  const census = canonical.domains?.census || {};
  const electionData = canonical.domains?.electionData || {};
  const censusConfig = census.config && typeof census.config === "object" ? census.config : {};
  const censusSelection = census.selection && typeof census.selection === "object" ? census.selection : {};
  const electionQuality = electionData.quality && typeof electionData.quality === "object" ? electionData.quality : {};
  const electionBenchmarks = electionData.benchmarks && typeof electionData.benchmarks === "object"
    ? electionData.benchmarks
    : {};
  const targetingRecommendations = electionBenchmarks.downstreamRecommendations
    && typeof electionBenchmarks.downstreamRecommendations === "object"
    && electionBenchmarks.downstreamRecommendations.targeting
    && typeof electionBenchmarks.downstreamRecommendations.targeting === "object"
    ? electionBenchmarks.downstreamRecommendations.targeting
    : {};
  const turnoutBoostGeoids = Array.from(new Set(
    asArray(targetingRecommendations.turnoutBoostGeoids)
      .map((token) => cleanText(token))
      .filter(Boolean),
  ));
  const turnoutBaselines = asArray(electionBenchmarks.turnoutBaselines);
  const latestTurnoutBaseline = turnoutBaselines.length
    ? turnoutBaselines[turnoutBaselines.length - 1]
    : null;
  const suggestionCount = asArray(electionBenchmarks.benchmarkSuggestions).length;
  const selectedGeoids = asArray(censusSelection.selectedGeoids).map((token) => cleanText(token)).filter(Boolean);

  return {
    revision: Number(targeting.revision || 0),
    config: clone(targeting.config || {}),
    criteria: clone(targeting.criteria || {}),
    weights: clone(targeting.weights || {}),
    upstreamInputs: {
      district: {
        raceType: cleanText(district?.templateProfile?.raceType),
        electionType: cleanText(district?.templateProfile?.electionType),
        mode: cleanText(district?.form?.mode),
        weeksRemaining: cleanText(district?.form?.weeksRemaining),
        turnoutA: toFinite(district?.form?.turnoutA, null),
        turnoutB: toFinite(district?.form?.turnoutB, null),
        universeSize: toFinite(district?.form?.universeSize, null),
      },
      census: {
        year: cleanText(censusConfig.year),
        resolution: cleanText(censusConfig.resolution),
        metricSet: cleanText(censusConfig.metricSet),
        stateFips: cleanText(censusConfig.stateFips),
        countyFips: cleanText(censusConfig.countyFips),
        placeFips: cleanText(censusConfig.placeFips),
        selectedGeoids,
        selectedGeoidCount: selectedGeoids.length,
        loadedRowCount: Math.max(0, Math.trunc(toFinite(censusSelection.loadedRowCount, 0) || 0)),
        applyAdjustedAssumptions: !!censusConfig.applyAdjustedAssumptions,
      },
      electionData: {
        normalizedRowCount: asArray(electionData.normalizedRows).length,
        qualityScore: toFinite(electionQuality.score, null),
        confidenceBand: cleanText(electionQuality.confidenceBand) || "unknown",
        turnoutBoostGeoids,
        turnoutBoostGeoidCount: turnoutBoostGeoids.length,
        benchmarkSuggestionCount: suggestionCount,
        baselineTurnoutRate: toFinite(latestTurnoutBaseline?.turnoutRate, null),
        hasDownstreamRecommendations: Object.keys(targetingRecommendations).length > 0,
      },
    },
  };
}
