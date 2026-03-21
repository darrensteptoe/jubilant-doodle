// @ts-check

import { asArray, toFinite } from "./_core.js";
import { selectDistrictCanonicalView } from "./districtCanonical.js";

export function selectDistrictDerivedView(state, options = {}) {
  const canonical = selectDistrictCanonicalView(state, options);
  const candidateRows = canonical.ballot.candidateRefs.order
    .map((id) => canonical.ballot.candidateRefs.byId[id])
    .filter(Boolean);
  const supportSum = candidateRows.reduce((sum, row) => sum + (toFinite(row?.supportPct, 0) || 0), 0);
  const historyRows = asArray(canonical.candidateHistory.records);
  const averageHistoryVoteShare = historyRows.length
    ? historyRows.reduce((sum, row) => sum + (toFinite(row?.voteShare, 0) || 0), 0) / historyRows.length
    : null;
  const turnoutA = toFinite(canonical.form.turnoutA, null);
  const turnoutB = toFinite(canonical.form.turnoutB, null);
  const turnoutGap = turnoutA != null && turnoutB != null ? turnoutB - turnoutA : null;
  const turnoutMean = turnoutA != null && turnoutB != null ? (turnoutA + turnoutB) / 2 : null;

  return {
    supportSnapshot: {
      candidateCount: candidateRows.length,
      supportSumPct: Number(supportSum.toFixed(2)),
      undecidedPct: toFinite(canonical.ballot.undecidedPct, null),
      yourCandidateId: canonical.ballot.yourCandidateId || "",
    },
    turnoutSnapshot: {
      turnoutGap,
      turnoutMean: turnoutMean == null ? null : Number(turnoutMean.toFixed(3)),
      hasTurnoutAnchors: turnoutA != null && turnoutB != null,
      hasWeeksRemainingInput: canonical.form.weeksRemaining !== "",
    },
    historySnapshot: {
      matchedRecordCount: historyRows.length,
      averageVoteSharePct: averageHistoryVoteShare == null ? null : Number(averageHistoryVoteShare.toFixed(3)),
    },
    electionDataSummary: {
      imported: !!canonical.electionDataMeta.importedAt,
      fileName: canonical.electionDataMeta.fileName,
      qualityScore: canonical.electionDataMeta.qualityScore,
      confidenceBand: canonical.electionDataMeta.confidenceBand,
      normalizedRowCount: canonical.electionDataMeta.normalizedRowCount,
    },
    targetingSummary: {
      modelId: canonical.targetingConfig.modelId || "",
      geoLevel: canonical.targetingConfig.geoLevel || "",
      topN: toFinite(canonical.targetingConfig.topN, null),
      onlyRaceFootprint: !!canonical.targetingConfig.onlyRaceFootprint,
    },
    censusSummary: {
      year: canonical.censusConfig.year || "",
      resolution: canonical.censusConfig.resolution || "",
      metricSet: canonical.censusConfig.metricSet || "",
      hasGeographyScope: !!(canonical.censusConfig.stateFips || canonical.censusConfig.countyFips || canonical.censusConfig.placeFips),
    },
  };
}
