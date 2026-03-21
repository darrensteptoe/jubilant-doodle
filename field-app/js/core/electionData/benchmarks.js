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

function clamp01(value) {
  const n = toFinite(value, null);
  if (n == null) return null;
  return Math.max(0, Math.min(1, n));
}

function toShare(numerator, denominator) {
  const n = toFinite(numerator, null);
  const d = toFinite(denominator, null);
  if (n == null || d == null || d <= 0) return null;
  return clamp01(n / d);
}

function mean(values = []) {
  const nums = asArray(values).map((value) => toFinite(value, null)).filter((value) => value != null);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function stddev(values = []) {
  const nums = asArray(values).map((value) => toFinite(value, null)).filter((value) => value != null);
  if (!nums.length) return null;
  const avg = mean(nums);
  if (avg == null) return null;
  const variance = nums.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function median(values = []) {
  const nums = asArray(values)
    .map((value) => toFinite(value, null))
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  if (!nums.length) return null;
  const middle = Math.floor(nums.length / 2);
  if (nums.length % 2 === 0) {
    return (nums[middle - 1] + nums[middle]) / 2;
  }
  return nums[middle];
}

function round4(value) {
  const n = toFinite(value, null);
  return n == null ? null : Number(n.toFixed(4));
}

function deriveCycleYear(row) {
  const cycleYear = toFinite(row?.cycleYear, null);
  if (cycleYear != null) return cycleYear;
  const isoDate = cleanText(row?.electionDate);
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.getUTCFullYear();
}

function deriveCandidateId(row) {
  const existing = cleanText(row?.candidateId);
  if (existing) return existing;
  const nameToken = cleanText(row?.candidateName || row?.candidate)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return nameToken ? `cand_${nameToken}` : "cand_unknown";
}

function derivePartyId(row) {
  const existing = cleanText(row?.partyId);
  if (existing) return existing;
  const partyToken = cleanText(row?.partyName || row?.party)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return partyToken ? `party_${partyToken}` : "";
}

function deriveGeographyId(row) {
  return cleanText(row?.geographyId || row?.precinctId || row?.precinct_id || row?.wardId || row?.districtId);
}

function raceKeyFromRow(row) {
  const cycleYear = deriveCycleYear(row);
  const office = cleanText(row?.office) || "unknown_office";
  const districtId = cleanText(row?.districtId || row?.district_id) || "unknown_district";
  const electionType = cleanText(row?.electionType).toLowerCase() || "unknown";
  return `${cycleYear ?? "unknown"}|${office}|${districtId}|${electionType}`;
}

function buildRaceGroups(rows = []) {
  const groups = new Map();

  asArray(rows).forEach((row) => {
    const voteTotal = toFinite(row?.voteTotal ?? row?.votes, null);
    if (voteTotal == null || voteTotal < 0) return;

    const key = raceKeyFromRow(row);
    const cycleYear = deriveCycleYear(row);
    const office = cleanText(row?.office);
    const districtId = cleanText(row?.districtId || row?.district_id);
    const electionType = cleanText(row?.electionType).toLowerCase();
    const jurisdictionKey = cleanText(row?.jurisdictionKey);
    const ballotsCast = toFinite(row?.turnoutTotal ?? row?.total_votes_precinct, null);
    const registeredVoters = toFinite(row?.registeredVoters ?? row?.registered_voters, null);
    const candidateId = deriveCandidateId(row);
    const candidateName = cleanText(row?.candidateName || row?.candidate) || candidateId;
    const partyId = derivePartyId(row);
    const partyName = cleanText(row?.partyName || row?.party);

    if (!groups.has(key)) {
      groups.set(key, {
        raceKey: key,
        cycleYear,
        office,
        districtId,
        electionType,
        jurisdictionKey,
        totalVotes: 0,
        ballotsCast: null,
        registeredVoters: null,
        candidateVotes: new Map(),
        candidateMeta: new Map(),
        partyVotes: new Map(),
        rowCount: 0,
      });
    }

    const group = groups.get(key);
    group.totalVotes += voteTotal;
    group.rowCount += 1;

    if (ballotsCast != null) {
      group.ballotsCast = group.ballotsCast == null ? ballotsCast : Math.max(group.ballotsCast, ballotsCast);
    }
    if (registeredVoters != null) {
      group.registeredVoters = group.registeredVoters == null ? registeredVoters : Math.max(group.registeredVoters, registeredVoters);
    }

    group.candidateVotes.set(candidateId, (group.candidateVotes.get(candidateId) || 0) + voteTotal);
    if (!group.candidateMeta.has(candidateId)) {
      group.candidateMeta.set(candidateId, {
        candidateId,
        candidateName,
        partyId,
        partyName,
      });
    }

    if (partyId) {
      group.partyVotes.set(partyId, (group.partyVotes.get(partyId) || 0) + voteTotal);
    }
  });

  return groups;
}

function buildHistoricalRaceBenchmarks(raceGroups = new Map()) {
  const out = [];

  for (const group of raceGroups.values()) {
    const candidateRows = Array.from(group.candidateVotes.entries())
      .map(([candidateId, votes]) => {
        const meta = group.candidateMeta.get(candidateId) || {};
        return {
          candidateId,
          candidateName: cleanText(meta.candidateName) || candidateId,
          partyId: cleanText(meta.partyId),
          partyName: cleanText(meta.partyName),
          votes,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.candidateName.localeCompare(b.candidateName));

    const top = candidateRows[0] || null;
    const second = candidateRows[1] || null;
    const leaderVoteShare = toShare(top?.votes, group.totalVotes);
    const marginShare = top && second
      ? toShare(top.votes - second.votes, group.totalVotes)
      : null;

    out.push({
      raceKey: group.raceKey,
      cycleYear: group.cycleYear,
      office: group.office,
      districtId: group.districtId,
      electionType: group.electionType,
      jurisdictionKey: group.jurisdictionKey,
      totalVotes: Math.max(0, group.totalVotes),
      ballotsCast: group.ballotsCast == null ? Math.max(0, group.totalVotes) : group.ballotsCast,
      registeredVoters: group.registeredVoters,
      turnoutRate: toShare(group.ballotsCast == null ? group.totalVotes : group.ballotsCast, group.registeredVoters),
      leaderCandidateId: cleanText(top?.candidateId),
      leaderCandidateName: cleanText(top?.candidateName),
      leaderPartyId: cleanText(top?.partyId),
      leaderPartyName: cleanText(top?.partyName),
      leaderVoteShare: round4(leaderVoteShare),
      marginShare: round4(marginShare),
      candidateCount: candidateRows.length,
    });
  }

  out.sort((a, b) => {
    const yearDiff = (toFinite(b.cycleYear, 0) || 0) - (toFinite(a.cycleYear, 0) || 0);
    if (yearDiff !== 0) return yearDiff;
    const officeDiff = cleanText(a.office).localeCompare(cleanText(b.office));
    if (officeDiff !== 0) return officeDiff;
    return cleanText(a.districtId).localeCompare(cleanText(b.districtId));
  });

  return out;
}

function buildTurnoutBaselines(historicalRaceBenchmarks = []) {
  const byCycle = new Map();

  asArray(historicalRaceBenchmarks).forEach((row) => {
    const cycleYear = toFinite(row?.cycleYear, null);
    const electionType = cleanText(row?.electionType) || "unknown";
    const key = `${cycleYear ?? "unknown"}|${electionType}`;
    if (!byCycle.has(key)) {
      byCycle.set(key, {
        cycleYear,
        electionType,
        ballotsCast: 0,
        registeredVoters: 0,
        raceCount: 0,
      });
    }
    const target = byCycle.get(key);
    target.raceCount += 1;
    target.ballotsCast += Math.max(0, toFinite(row?.ballotsCast, 0) || 0);
    target.registeredVoters += Math.max(0, toFinite(row?.registeredVoters, 0) || 0);
  });

  const out = Array.from(byCycle.values()).map((row) => ({
    cycleYear: row.cycleYear,
    electionType: row.electionType,
    ballotsCast: row.ballotsCast,
    registeredVoters: row.registeredVoters || null,
    turnoutRate: toShare(row.ballotsCast, row.registeredVoters),
    raceCount: row.raceCount,
  }));

  out.sort((a, b) => {
    const yearDiff = (toFinite(b.cycleYear, 0) || 0) - (toFinite(a.cycleYear, 0) || 0);
    if (yearDiff !== 0) return yearDiff;
    return cleanText(a.electionType).localeCompare(cleanText(b.electionType));
  });

  return out;
}

function buildVolatilityBands(historicalRaceBenchmarks = []) {
  const groups = new Map();

  asArray(historicalRaceBenchmarks).forEach((row) => {
    const office = cleanText(row?.office) || "unknown";
    const districtId = cleanText(row?.districtId) || "unknown";
    const key = `${office}|${districtId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        poolKey: key,
        office,
        districtId,
        shares: [],
      });
    }
    const share = toFinite(row?.leaderVoteShare, null);
    if (share != null) {
      groups.get(key).shares.push(share);
    }
  });

  const out = [];
  for (const group of groups.values()) {
    const avg = mean(group.shares);
    const sd = stddev(group.shares) || 0;
    const low = avg == null ? null : Math.max(0, avg - sd);
    const high = avg == null ? null : Math.min(1, avg + sd);
    out.push({
      poolKey: group.poolKey,
      office: group.office,
      districtId: group.districtId,
      sampleCount: group.shares.length,
      centerShare: round4(avg),
      bandLowShare: round4(low),
      bandHighShare: round4(high),
      width: round4(high == null || low == null ? null : high - low),
    });
  }

  out.sort((a, b) => {
    const sampleDiff = (toFinite(b.sampleCount, 0) || 0) - (toFinite(a.sampleCount, 0) || 0);
    if (sampleDiff !== 0) return sampleDiff;
    return cleanText(a.poolKey).localeCompare(cleanText(b.poolKey));
  });

  return out;
}

function buildPartyBaselineContext(raceGroups = new Map()) {
  const byParty = new Map();
  let totalVotes = 0;

  for (const group of raceGroups.values()) {
    for (const [partyId, votes] of group.partyVotes.entries()) {
      totalVotes += votes;
      byParty.set(partyId, (byParty.get(partyId) || 0) + votes);
    }
  }

  const out = Array.from(byParty.entries())
    .map(([partyId, voteTotal]) => ({
      partyId,
      partyName: partyId.replace(/^party_/, "").toUpperCase(),
      voteTotal,
      voteShare: round4(toShare(voteTotal, totalVotes)),
    }))
    .sort((a, b) => b.voteTotal - a.voteTotal || cleanText(a.partyId).localeCompare(cleanText(b.partyId)));

  return out;
}

function buildComparableRacePools(historicalRaceBenchmarks = []) {
  const pools = new Map();

  asArray(historicalRaceBenchmarks).forEach((row) => {
    const office = cleanText(row?.office) || "unknown";
    const electionType = cleanText(row?.electionType) || "unknown";
    const key = `${office}|${electionType}`;
    if (!pools.has(key)) {
      pools.set(key, {
        poolKey: key,
        office,
        electionType,
        cycleYears: new Set(),
        raceCount: 0,
      });
    }
    const pool = pools.get(key);
    const year = toFinite(row?.cycleYear, null);
    if (year != null) {
      pool.cycleYears.add(year);
    }
    pool.raceCount += 1;
  });

  const out = Array.from(pools.values())
    .map((pool) => {
      const years = Array.from(pool.cycleYears).sort((a, b) => b - a);
      return {
        poolKey: pool.poolKey,
        office: pool.office,
        electionType: pool.electionType,
        raceCount: pool.raceCount,
        cycleCount: years.length,
        cycleYears: years,
      };
    })
    .sort((a, b) => b.raceCount - a.raceCount || cleanText(a.poolKey).localeCompare(cleanText(b.poolKey)));

  return out;
}

function buildRepeatCandidatePerformance(raceGroups = new Map()) {
  const candidates = new Map();

  for (const group of raceGroups.values()) {
    const totalVotes = Math.max(0, toFinite(group.totalVotes, 0) || 0);
    if (!totalVotes) continue;

    for (const [candidateId, votes] of group.candidateVotes.entries()) {
      const meta = group.candidateMeta.get(candidateId) || {};
      const share = votes / totalVotes;
      if (!candidates.has(candidateId)) {
        candidates.set(candidateId, {
          candidateId,
          candidateName: cleanText(meta.candidateName) || candidateId,
          partyId: cleanText(meta.partyId),
          partyName: cleanText(meta.partyName),
          shares: [],
        });
      }
      candidates.get(candidateId).shares.push({
        cycleYear: toFinite(group.cycleYear, null),
        voteShare: share,
      });
    }
  }

  const out = [];
  for (const candidate of candidates.values()) {
    const shares = candidate.shares
      .filter((row) => row.cycleYear != null)
      .sort((a, b) => (toFinite(b.cycleYear, 0) || 0) - (toFinite(a.cycleYear, 0) || 0));
    const years = Array.from(new Set(shares.map((row) => row.cycleYear)));
    if (years.length < 2) continue;

    const avgShare = mean(shares.map((row) => row.voteShare));
    const latestShare = toFinite(shares[0]?.voteShare, null);
    const overUnder = (latestShare == null || avgShare == null) ? null : latestShare - avgShare;

    out.push({
      candidateId: candidate.candidateId,
      candidateName: candidate.candidateName,
      partyId: candidate.partyId,
      partyName: candidate.partyName,
      cycleCount: years.length,
      cycleYears: years.sort((a, b) => b - a),
      averageVoteShare: round4(avgShare),
      latestVoteShare: round4(latestShare),
      overUnderPerformance: round4(overUnder),
    });
  }

  out.sort((a, b) => {
    const deltaA = Math.abs(toFinite(a.overUnderPerformance, 0) || 0);
    const deltaB = Math.abs(toFinite(b.overUnderPerformance, 0) || 0);
    if (deltaB !== deltaA) return deltaB - deltaA;
    return cleanText(a.candidateName).localeCompare(cleanText(b.candidateName));
  });

  return out;
}

function buildPrecinctPerformanceDistributions(rows = []) {
  const byGeo = new Map();

  asArray(rows).forEach((row) => {
    const geographyId = deriveGeographyId(row);
    if (!geographyId) return;

    const voteTotal = toFinite(row?.voteTotal ?? row?.votes, null);
    const turnoutTotal = toFinite(row?.turnoutTotal ?? row?.total_votes_precinct, null);
    const share = toShare(voteTotal, turnoutTotal);
    if (share == null) return;

    if (!byGeo.has(geographyId)) {
      byGeo.set(geographyId, {
        geographyId,
        districtId: cleanText(row?.districtId || row?.district_id),
        jurisdictionKey: cleanText(row?.jurisdictionKey),
        shares: [],
      });
    }

    byGeo.get(geographyId).shares.push(share);
  });

  const out = Array.from(byGeo.values())
    .map((geo) => ({
      geographyId: geo.geographyId,
      districtId: geo.districtId,
      jurisdictionKey: geo.jurisdictionKey,
      sampleCount: geo.shares.length,
      minShare: round4(Math.min(...geo.shares)),
      medianShare: round4(median(geo.shares)),
      maxShare: round4(Math.max(...geo.shares)),
      averageShare: round4(mean(geo.shares)),
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount || cleanText(a.geographyId).localeCompare(cleanText(b.geographyId)));

  return out;
}

function buildGeographyRollups(rows = []) {
  const rollups = new Map();

  asArray(rows).forEach((row) => {
    const geographyId = deriveGeographyId(row);
    if (!geographyId) return;

    if (!rollups.has(geographyId)) {
      rollups.set(geographyId, {
        geographyId,
        districtId: cleanText(row?.districtId || row?.district_id),
        jurisdictionKey: cleanText(row?.jurisdictionKey),
        validVotes: 0,
        ballotsCast: null,
        registeredVoters: null,
        rowCount: 0,
      });
    }

    const rollup = rollups.get(geographyId);
    const voteTotal = toFinite(row?.voteTotal ?? row?.votes, 0) || 0;
    const ballotsCast = toFinite(row?.turnoutTotal ?? row?.total_votes_precinct, null);
    const registeredVoters = toFinite(row?.registeredVoters ?? row?.registered_voters, null);

    rollup.validVotes += Math.max(0, voteTotal);
    rollup.rowCount += 1;

    if (ballotsCast != null) {
      rollup.ballotsCast = rollup.ballotsCast == null ? ballotsCast : Math.max(rollup.ballotsCast, ballotsCast);
    }
    if (registeredVoters != null) {
      rollup.registeredVoters = rollup.registeredVoters == null
        ? registeredVoters
        : Math.max(rollup.registeredVoters, registeredVoters);
    }
  });

  const out = Array.from(rollups.values())
    .map((row) => ({
      geographyId: row.geographyId,
      districtId: row.districtId,
      jurisdictionKey: row.jurisdictionKey,
      validVotes: row.validVotes,
      ballotsCast: row.ballotsCast == null ? row.validVotes : row.ballotsCast,
      registeredVoters: row.registeredVoters,
      turnoutRate: toShare(row.ballotsCast == null ? row.validVotes : row.ballotsCast, row.registeredVoters),
      rowCount: row.rowCount,
    }))
    .sort((a, b) => {
      const ballotsDiff = (toFinite(b.ballotsCast, 0) || 0) - (toFinite(a.ballotsCast, 0) || 0);
      if (ballotsDiff !== 0) return ballotsDiff;
      return cleanText(a.geographyId).localeCompare(cleanText(b.geographyId));
    });

  return out;
}

function buildBenchmarkSuggestions({
  turnoutBaselines,
  volatilityBands,
  partyBaselineContext,
  repeatCandidatePerformance,
  quality,
}) {
  const suggestions = [];

  const latestTurnout = asArray(turnoutBaselines)[0] || null;
  if (latestTurnout && toFinite(latestTurnout.turnoutRate, null) != null) {
    suggestions.push({
      id: "turnout_baseline",
      type: "turnout_calibration",
      title: "Turnout baseline available",
      detail: "Apply latest turnout baseline to district and outcome calibration inputs.",
      value: round4(latestTurnout.turnoutRate),
      target: "district",
      priority: "high",
    });
  }

  const widestBand = asArray(volatilityBands)
    .slice()
    .sort((a, b) => (toFinite(b.width, 0) || 0) - (toFinite(a.width, 0) || 0))[0];
  if (widestBand && toFinite(widestBand.width, 0) >= 0.1) {
    suggestions.push({
      id: "volatility_guardrail",
      type: "volatility_guardrail",
      title: "High race volatility",
      detail: `Volatility width ${round4(widestBand.width)} in ${widestBand.office} ${widestBand.districtId}.`,
      value: round4(widestBand.width),
      target: "outcome",
      priority: "medium",
    });
  }

  const topParty = asArray(partyBaselineContext)[0] || null;
  if (topParty && toFinite(topParty.voteShare, 0) >= 0.5) {
    suggestions.push({
      id: "party_context",
      type: "party_baseline",
      title: "Party baseline concentration",
      detail: `Party ${topParty.partyName || topParty.partyId} leads with ${round4(topParty.voteShare)} share.`,
      value: round4(topParty.voteShare),
      target: "targeting",
      priority: "medium",
    });
  }

  const repeatDelta = asArray(repeatCandidatePerformance)
    .find((row) => Math.abs(toFinite(row?.overUnderPerformance, 0) || 0) >= 0.03);
  if (repeatDelta) {
    suggestions.push({
      id: "repeat_candidate_shift",
      type: "candidate_shift",
      title: "Repeat-candidate performance shift",
      detail: `${repeatDelta.candidateName} shifted by ${round4(repeatDelta.overUnderPerformance)} vs. average trend.`,
      value: round4(repeatDelta.overUnderPerformance),
      target: "district",
      priority: "medium",
    });
  }

  if (cleanText(quality?.confidenceBand) === "low") {
    suggestions.push({
      id: "quality_reconciliation",
      type: "qa_reconciliation",
      title: "Data quality reconciliation needed",
      detail: "Low confidence election data should not be applied without reconciliation.",
      value: round4(quality?.score),
      target: "electionData",
      priority: "high",
    });
  }

  return suggestions;
}

function buildDownstreamRecommendations({
  turnoutBaselines,
  volatilityBands,
  partyBaselineContext,
  comparableRacePools,
  geographyRollups,
  quality,
  benchmarkSuggestions,
  historicalRaceBenchmarks,
}) {
  const latestTurnout = asArray(turnoutBaselines)[0] || {};
  const topVolatility = asArray(volatilityBands)[0] || {};
  const topParty = asArray(partyBaselineContext)[0] || {};
  const topPool = asArray(comparableRacePools)[0] || {};
  const topHistorical = asArray(historicalRaceBenchmarks)[0] || {};
  const topGeoids = asArray(geographyRollups)
    .slice(0, 5)
    .map((row) => cleanText(row?.geographyId))
    .filter(Boolean);

  const score = toFinite(quality?.score, null);
  const width = toFinite(topVolatility?.width, null);
  const confidenceFloor = score == null
    ? null
    : round4(Math.max(0.2, Math.min(0.9, score - (width == null ? 0.05 : width / 2))));

  return {
    district: {
      turnoutBaselinePct: round4(latestTurnout.turnoutRate),
      baselineSupportHint: round4(topHistorical.leaderVoteShare),
      volatilityBandWidth: round4(width),
      partyBaselineLeader: cleanText(topParty.partyId),
      confidenceBand: cleanText(quality?.confidenceBand) || "unknown",
      benchmarkCount: asArray(benchmarkSuggestions).length,
    },
    targeting: {
      turnoutBoostGeoids: topGeoids,
      priorityGeographyIds: topGeoids,
      comparablePoolKey: cleanText(topPool.poolKey),
      volatilityFocus: cleanText(topVolatility.poolKey),
    },
    outcome: {
      confidenceFloor,
      calibrationWindowPct: round4(latestTurnout.turnoutRate),
      volatilityBandWidth: round4(width),
      recommendationCount: asArray(benchmarkSuggestions).length,
    },
  };
}

export function computeElectionDataBenchmarks(normalizedRows = [], options = {}) {
  const rows = asArray(normalizedRows);
  const raceGroups = buildRaceGroups(rows);
  const historicalRaceBenchmarks = buildHistoricalRaceBenchmarks(raceGroups);
  const turnoutBaselines = buildTurnoutBaselines(historicalRaceBenchmarks);
  const volatilityBands = buildVolatilityBands(historicalRaceBenchmarks);
  const partyBaselineContext = buildPartyBaselineContext(raceGroups);
  const comparableRacePools = buildComparableRacePools(historicalRaceBenchmarks);
  const repeatCandidatePerformance = buildRepeatCandidatePerformance(raceGroups);
  const precinctPerformanceDistributions = buildPrecinctPerformanceDistributions(rows);
  const geographyRollups = buildGeographyRollups(rows);
  const quality = options?.quality && typeof options.quality === "object" ? options.quality : {};

  const benchmarkSuggestions = buildBenchmarkSuggestions({
    turnoutBaselines,
    volatilityBands,
    partyBaselineContext,
    repeatCandidatePerformance,
    quality,
  });

  const downstreamRecommendations = buildDownstreamRecommendations({
    turnoutBaselines,
    volatilityBands,
    partyBaselineContext,
    comparableRacePools,
    geographyRollups,
    quality,
    benchmarkSuggestions,
    historicalRaceBenchmarks,
  });

  return {
    historicalRaceBenchmarks,
    turnoutBaselines,
    volatilityBands,
    partyBaselineContext,
    comparableRacePools,
    repeatCandidatePerformance,
    precinctPerformanceDistributions,
    geographyRollups,
    benchmarkSuggestions,
    downstreamRecommendations,
  };
}
