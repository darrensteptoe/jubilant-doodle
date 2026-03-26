// @ts-check

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqTokens(values) {
  const seen = new Set();
  const out = [];
  asArray(values).forEach((value) => {
    const token = cleanText(value);
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(token);
  });
  return out;
}

function normalizeGeographyToken(value) {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function uniqGeographyTokens(values) {
  const seen = new Set();
  const out = [];
  asArray(values).forEach((value) => {
    const token = normalizeGeographyToken(value);
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(token);
  });
  return out;
}

function formatPct(value, digits = 1) {
  const num = toFinite(value);
  if (num == null) return "—";
  return `${(num * 100).toFixed(digits)}%`;
}

function formatPctPoints(value, digits = 1) {
  const num = toFinite(value);
  if (num == null) return "—";
  return `${num.toFixed(digits)}%`;
}

function shareToPctPoints(value) {
  const num = toFinite(value);
  if (num == null) return null;
  if (num >= 0 && num <= 1) {
    return Number((num * 100).toFixed(4));
  }
  return num;
}

function formatRatioPct(value, digits = 1) {
  const num = toFinite(value);
  if (num == null) return "—";
  return `${(num * 100).toFixed(digits)}%`;
}

function parseCurrentTargetingGeoids(options = {}) {
  const direct = asArray(options.currentGeographyIds);
  if (direct.length) {
    return direct;
  }
  const rows = asArray(options.targetingRows);
  return rows
    .map((row) => row?.geoid || row?.geography || row?.id || "")
    .filter((value) => cleanText(value));
}

function computeOverlap(currentTokens, benchmarkTokens) {
  const benchmarkSet = new Set(benchmarkTokens);
  const overlapCount = currentTokens.filter((token) => benchmarkSet.has(token)).length;
  const currentCount = currentTokens.length;
  const benchmarkCount = benchmarkTokens.length;
  return {
    currentCount,
    benchmarkCount,
    overlapCount,
    overlapRatio: currentCount ? Number((overlapCount / currentCount).toFixed(6)) : null,
    benchmarkCoverageRatio: benchmarkCount ? Number((overlapCount / benchmarkCount).toFixed(6)) : null,
  };
}

function buildOverlapInterpretation(label, overlap) {
  const currentCount = Number(overlap?.currentCount || 0);
  const overlapCount = Number(overlap?.overlapCount || 0);
  const overlapRatio = toFinite(overlap?.overlapRatio);
  if (currentCount <= 0) {
    return `${label} overlap unavailable until targeting rows are present.`;
  }
  if (overlapCount <= 0) {
    return `Current targeting rows do not overlap benchmark ${label.toLowerCase()} geographies.`;
  }
  if (overlapRatio != null && overlapRatio >= 0.6) {
    return `Strong ${label.toLowerCase()} overlap in current targeting rows.`;
  }
  if (overlapRatio != null && overlapRatio >= 0.3) {
    return `Partial ${label.toLowerCase()} overlap; consider whether targeting breadth is intentional.`;
  }
  return `Limited ${label.toLowerCase()} overlap in current targeting rows.`;
}

function readBenchmarkScope(snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : {};
  const benchmarks = data.benchmarks && typeof data.benchmarks === "object" ? data.benchmarks : {};
  const downstream = benchmarks.downstreamRecommendations && typeof benchmarks.downstreamRecommendations === "object"
    ? benchmarks.downstreamRecommendations
    : {};
  const quality = data.quality && typeof data.quality === "object" ? data.quality : {};
  const imported = data.import && typeof data.import === "object" ? data.import : {};
  return {
    benchmarks,
    downstream,
    quality,
    imported,
  };
}

function buildProvenanceText(imported) {
  const fileName = cleanText(imported?.fileName);
  const importedAt = cleanText(imported?.importedAt);
  if (fileName && importedAt) {
    return `Source: imported election benchmark history (${fileName}, ${importedAt}).`;
  }
  if (fileName) {
    return `Source: imported election benchmark history (${fileName}).`;
  }
  if (importedAt) {
    return `Source: imported election benchmark history (${importedAt}).`;
  }
  return "Source: imported/computed election benchmark history.";
}

export function deriveDistrictElectionBenchmarkAdvisory(snapshot) {
  const { benchmarks, downstream, quality, imported } = readBenchmarkScope(snapshot);
  const district = downstream.district && typeof downstream.district === "object" ? downstream.district : {};
  const turnoutRates = asArray(benchmarks.turnoutBaselines)
    .map((row) => shareToPctPoints(row?.turnoutRate))
    .filter((value) => value != null);

  const fallbackAnchor = shareToPctPoints(district.turnoutBaselinePct);
  const turnoutAnchorA = turnoutRates[0] ?? fallbackAnchor;
  const turnoutAnchorB = turnoutRates[1] ?? turnoutRates[0] ?? fallbackAnchor;
  const bandSuggestion = shareToPctPoints(district.volatilityBandWidth);
  const hasTurnoutAnchors = turnoutAnchorA != null && turnoutAnchorB != null;
  const hasBandSuggestion = bandSuggestion != null;
  if (!hasTurnoutAnchors && !hasBandSuggestion) {
    return null;
  }

  const confidenceBand = cleanText(district.confidenceBand || quality.confidenceBand || "unknown");
  const benchmarkCount = toFinite(district.benchmarkCount) ?? asArray(benchmarks.benchmarkSuggestions).length;
  return {
    hasTurnoutAnchors,
    turnoutAnchorA,
    turnoutAnchorB,
    turnoutAnchorText: hasTurnoutAnchors
      ? `A ${formatPctPoints(turnoutAnchorA)} · B ${formatPctPoints(turnoutAnchorB)}`
      : "No benchmark turnout anchors.",
    hasBandSuggestion,
    bandSuggestion,
    bandSuggestionText: hasBandSuggestion ? `±${formatPctPoints(bandSuggestion)}` : "No benchmark band suggestion.",
    confidenceBand: confidenceBand || "unknown",
    benchmarkCount: benchmarkCount != null ? Math.max(0, Math.trunc(benchmarkCount)) : 0,
    provenanceText: buildProvenanceText(imported),
    advisoryText: "Historical benchmark guidance only. Apply explicitly to calibrate turnout assumptions.",
  };
}

export function deriveReachElectionBenchmarkAdvisory(snapshot, options = {}) {
  const { downstream, imported, quality } = readBenchmarkScope(snapshot);
  const targeting = downstream.targeting && typeof downstream.targeting === "object" ? downstream.targeting : {};
  const priorityGeographyIds = uniqTokens(targeting.priorityGeographyIds);
  const turnoutBoostGeoids = uniqTokens(targeting.turnoutBoostGeoids);
  const comparablePoolKey = cleanText(targeting.comparablePoolKey);
  const volatilityFocus = cleanText(targeting.volatilityFocus);
  const hasAny = priorityGeographyIds.length > 0
    || turnoutBoostGeoids.length > 0
    || !!comparablePoolKey
    || !!volatilityFocus;
  if (!hasAny) {
    return null;
  }

  const currentTargetingGeoids = parseCurrentTargetingGeoids(options);
  const currentTokens = uniqGeographyTokens(currentTargetingGeoids);
  const priorityOverlap = computeOverlap(currentTokens, uniqGeographyTokens(priorityGeographyIds));
  const turnoutOverlap = computeOverlap(currentTokens, uniqGeographyTokens(turnoutBoostGeoids));
  const qualityScore = toFinite(quality?.score);
  const confidenceBand = cleanText(quality?.confidenceBand || "unknown");
  const qualityText = qualityScore == null
    ? `Benchmark confidence: ${confidenceBand.toUpperCase()}.`
    : `Benchmark confidence: ${confidenceBand.toUpperCase()} (${qualityScore.toFixed(2)} quality score).`;

  return {
    priorityGeographyIds,
    turnoutBoostGeoids,
    currentTargetingGeoidCount: currentTokens.length,
    comparablePoolKey,
    volatilityFocus,
    priorityText: priorityGeographyIds.length
      ? `${priorityGeographyIds.length} priority geography ID(s): ${priorityGeographyIds.slice(0, 6).join(", ")}`
      : "No priority geography IDs provided.",
    turnoutText: turnoutBoostGeoids.length
      ? `${turnoutBoostGeoids.length} turnout-opportunity GEOID(s): ${turnoutBoostGeoids.slice(0, 6).join(", ")}`
      : "No turnout-opportunity GEOIDs provided.",
    comparableText: comparablePoolKey
      ? `Comparable pool: ${comparablePoolKey}`
      : "Comparable pool key unavailable.",
    volatilityText: volatilityFocus
      ? `Volatility focus: ${volatilityFocus}`
      : "Volatility focus unavailable.",
    priorityOverlapCount: priorityOverlap.overlapCount,
    priorityCoverageRatio: priorityOverlap.overlapRatio,
    turnoutOverlapCount: turnoutOverlap.overlapCount,
    turnoutCoverageRatio: turnoutOverlap.overlapRatio,
    priorityOverlapText: currentTokens.length
      ? `${priorityOverlap.overlapCount}/${priorityOverlap.currentCount} current targeting GEO(s) overlap benchmark priority geographies (${formatRatioPct(priorityOverlap.overlapRatio)}).`
      : "Priority overlap unavailable until targeting rows are present.",
    turnoutOverlapText: currentTokens.length
      ? `${turnoutOverlap.overlapCount}/${turnoutOverlap.currentCount} current targeting GEO(s) overlap benchmark turnout-opportunity geographies (${formatRatioPct(turnoutOverlap.overlapRatio)}).`
      : "Turnout-opportunity overlap unavailable until targeting rows are present.",
    overlapInterpretationText: [
      buildOverlapInterpretation("Priority", priorityOverlap),
      buildOverlapInterpretation("Turnout-opportunity", turnoutOverlap),
    ].join(" "),
    qualityText,
    provenanceText: buildProvenanceText(imported),
    advisoryText: "Advisory context only. No automatic targeting writes are applied from this panel.",
  };
}

export function deriveOutcomeElectionBenchmarkAdvisory(snapshot) {
  const { benchmarks, downstream, quality, imported } = readBenchmarkScope(snapshot);
  const outcome = downstream.outcome && typeof downstream.outcome === "object" ? downstream.outcome : {};
  const comparablePool = asArray(benchmarks.comparableRacePools)[0] || {};
  const confidenceFloor = toFinite(outcome.confidenceFloor);
  const calibrationWindowPct = toFinite(outcome.calibrationWindowPct);
  const volatilityBandWidth = shareToPctPoints(outcome.volatilityBandWidth);
  const comparablePoolKey = cleanText(comparablePool.poolKey);
  const hasAny = confidenceFloor != null
    || calibrationWindowPct != null
    || volatilityBandWidth != null
    || !!comparablePoolKey;
  if (!hasAny) {
    return null;
  }

  const confidenceBand = cleanText(quality.confidenceBand || "unknown");
  const recommendationCount = toFinite(outcome.recommendationCount) ?? asArray(benchmarks.benchmarkSuggestions).length;
  return {
    confidenceFloor,
    calibrationWindowPct,
    volatilityBandWidth,
    comparablePoolKey,
    confidenceBand: confidenceBand || "unknown",
    recommendationCount: recommendationCount != null ? Math.max(0, Math.trunc(recommendationCount)) : 0,
    confidenceFloorText: confidenceFloor == null
      ? "Confidence floor unavailable."
      : `Benchmark confidence floor: ${formatPct(confidenceFloor, 0)}`,
    calibrationText: calibrationWindowPct == null
      ? "Expected range unavailable."
      : `Historical expected turnout window anchor: ${formatPct(calibrationWindowPct, 0)}`,
    volatilityText: volatilityBandWidth == null
      ? "Volatility width unavailable."
      : `Historical volatility width: ±${formatPctPoints(volatilityBandWidth)}`,
    comparableText: comparablePoolKey
      ? `Comparable pool: ${comparablePoolKey}`
      : "Comparable pool unavailable.",
    provenanceText: buildProvenanceText(imported),
    advisoryText: "Benchmark framing only. Outcome probability math remains unchanged.",
  };
}
