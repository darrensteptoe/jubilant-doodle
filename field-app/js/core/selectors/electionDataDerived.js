// @ts-check

import { asArray, toFinite } from "./_core.js";
import { selectElectionDataCanonicalView } from "./electionDataCanonical.js";

function countRowsBy(rows, key) {
  const map = new Map();
  asArray(rows).forEach((row) => {
    const token = String(row?.[key] || "").trim();
    if (!token) return;
    map.set(token, (map.get(token) || 0) + 1);
  });
  return map;
}

export function selectElectionDataDerivedView(state, options = {}) {
  const canonical = selectElectionDataCanonicalView(state, options);
  const rows = canonical.normalizedRows;
  const officeCounts = countRowsBy(rows, "office");
  const districtCounts = countRowsBy(rows, "districtId");
  const candidateCount = asArray(canonical.candidateRefs.order).length;
  const geographyCount = asArray(canonical.geographyRefs.order).length;
  const partyCount = asArray(canonical.partyRefs.order).length;
  const ballotsCast = toFinite(canonical.turnoutTotals.ballotsCast, null);
  const validVotes = toFinite(canonical.voteTotals.validVotes, null);
  const voteCompleteness = ballotsCast && ballotsCast > 0 && validVotes != null
    ? validVotes / ballotsCast
    : null;

  return {
    importStatus: {
      status: canonical.import.status || "idle",
      statusText: canonical.import.statusText || "",
      importedAt: canonical.import.importedAt || "",
      fileName: canonical.import.fileName || "",
      rowCount: asArray(rows).length,
    },
    coverage: {
      jurisdictionCount: asArray(canonical.jurisdictionKeys).length,
      geographyCount,
      candidateCount,
      partyCount,
      officeCount: officeCounts.size,
      districtCount: districtCounts.size,
    },
    totals: {
      ballotsCast,
      registeredVoters: toFinite(canonical.turnoutTotals.registeredVoters, null),
      turnoutRate: toFinite(canonical.turnoutTotals.turnoutRate, null),
      validVotes,
      writeIns: toFinite(canonical.voteTotals.writeIns, null),
      undervotes: toFinite(canonical.voteTotals.undervotes, null),
      overvotes: toFinite(canonical.voteTotals.overvotes, null),
      voteCompleteness: voteCompleteness == null ? null : Number(voteCompleteness.toFixed(4)),
    },
    qualitySummary: {
      score: toFinite(canonical.quality.score, null),
      confidenceBand: canonical.quality.confidenceBand || "unknown",
      completenessRatio: toFinite(canonical.quality.completenessRatio, null),
      warningCount: toFinite(canonical.quality.warningCount, 0) || 0,
      sourceWarningCount: asArray(canonical.qa.sourceWarnings).length,
      mappingWarningCount: asArray(canonical.qa.mappingWarnings).length,
      errorCount: asArray(canonical.qa.errors).length,
    },
    benchmarkSummary: {
      turnoutBaselineCount: asArray(canonical.benchmarks.turnoutBaselines).length,
      historicalBenchmarkCount: asArray(canonical.benchmarks.historicalRaceBenchmarks).length,
      comparablePoolCount: asArray(canonical.benchmarks.comparableRacePools).length,
      volatilityBandCount: asArray(canonical.benchmarks.volatilityBands).length,
      recommendationTargets: {
        district: Object.keys(canonical.benchmarks.downstreamRecommendations?.district || {}).length,
        targeting: Object.keys(canonical.benchmarks.downstreamRecommendations?.targeting || {}).length,
        outcome: Object.keys(canonical.benchmarks.downstreamRecommendations?.outcome || {}).length,
      },
    },
  };
}

