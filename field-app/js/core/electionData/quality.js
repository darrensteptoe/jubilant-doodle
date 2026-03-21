// @ts-check

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

function nowIso(nowDate = new Date()) {
  const next = nowDate instanceof Date ? nowDate : new Date(nowDate);
  return Number.isFinite(next.getTime()) ? next.toISOString() : new Date().toISOString();
}

function countCompleteRows(rows = []) {
  let complete = 0;
  asArray(rows).forEach((row) => {
    const hasGeography = !!cleanText(row?.geographyId || row?.precinctId || row?.districtId);
    const hasCandidate = !!cleanText(row?.candidateId || row?.candidateName || row?.candidate);
    const hasVotes = toFinite(row?.voteTotal ?? row?.votes, null) != null;
    if (hasGeography && hasCandidate && hasVotes) {
      complete += 1;
    }
  });
  return complete;
}

export function computeElectionDataQuality(rows = [], qa = {}, options = {}) {
  const nowDate = options.nowDate || new Date();
  const totalRows = asArray(rows).length;
  if (!totalRows) {
    return {
      score: null,
      confidenceBand: "unknown",
      completenessRatio: 0,
      warningCount: 0,
      computedAt: nowIso(nowDate),
    };
  }

  const warningCount = [
    ...asArray(qa?.sourceWarnings),
    ...asArray(qa?.geographyWarnings),
    ...asArray(qa?.candidateWarnings),
    ...asArray(qa?.mappingWarnings),
    ...asArray(qa?.errors),
  ].map((item) => cleanText(item)).filter(Boolean).length;

  const completenessRatioRaw = countCompleteRows(rows) / totalRows;
  const warningPenalty = Math.min(0.35, warningCount * 0.04);
  const scoreRaw = Math.max(0, Math.min(1, completenessRatioRaw - warningPenalty));
  const score = Number(scoreRaw.toFixed(4));

  return {
    score,
    confidenceBand: score >= 0.85 ? "high" : score >= 0.6 ? "medium" : "low",
    completenessRatio: Number(completenessRatioRaw.toFixed(4)),
    warningCount,
    computedAt: nowIso(nowDate),
  };
}

export function summarizeElectionDataQuality(slice = {}, options = {}) {
  const rows = asArray(slice?.normalizedRows);
  const qa = slice?.qa && typeof slice.qa === "object" ? slice.qa : {};
  return computeElectionDataQuality(rows, qa, options);
}
