import { setText } from "../../surfaceUtils.js";

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

function toTitleWords(value) {
  const text = cleanText(value);
  if (!text) return "";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function formatConfidenceBand(value) {
  const token = cleanText(value).toLowerCase();
  if (!token) return "unknown";
  return token.toUpperCase();
}

function formatQualityScore(value) {
  const score = toFinite(value, null);
  return score == null ? "—" : score.toFixed(2);
}

function uniqueSortedYears(rows) {
  const years = new Set();
  asArray(rows).forEach((row) => {
    const year = toFinite(row?.cycleYear, null);
    if (year != null) {
      years.add(Math.trunc(year));
    }
  });
  return Array.from(years).sort((a, b) => b - a);
}

function deriveTopOfficeHistoricalAnchor(rows) {
  const counts = new Map();
  asArray(rows).forEach((row) => {
    const office = cleanText(row?.office);
    if (!office) return;
    counts.set(office, (counts.get(office) || 0) + 1);
  });
  let topOffice = "";
  let topCount = 0;
  counts.forEach((count, office) => {
    if (count > topCount) {
      topOffice = office;
      topCount = count;
    }
  });
  return { topOffice, topCount };
}

export function deriveElectionDataBenchmarkTrustExplanation(canonical, derived) {
  const benchmarkSummary = derived?.benchmarkSummary && typeof derived.benchmarkSummary === "object"
    ? derived.benchmarkSummary
    : {};
  const qualitySummary = derived?.qualitySummary && typeof derived.qualitySummary === "object"
    ? derived.qualitySummary
    : {};
  const benchmarks = canonical?.benchmarks && typeof canonical.benchmarks === "object"
    ? canonical.benchmarks
    : {};
  const quality = canonical?.quality && typeof canonical.quality === "object"
    ? canonical.quality
    : {};

  const historicalRows = asArray(benchmarks.historicalRaceBenchmarks);
  const comparablePools = asArray(benchmarks.comparableRacePools);
  const turnoutBaselines = asArray(benchmarks.turnoutBaselines);
  const suggestionCount = asArray(benchmarks.benchmarkSuggestions).length;

  const turnoutCount = toFinite(benchmarkSummary.turnoutBaselineCount, turnoutBaselines.length) || 0;
  const historicalCount = toFinite(benchmarkSummary.historicalBenchmarkCount, historicalRows.length) || 0;
  const comparableCount = toFinite(benchmarkSummary.comparablePoolCount, comparablePools.length) || 0;

  const recommendationTargets = benchmarkSummary.recommendationTargets && typeof benchmarkSummary.recommendationTargets === "object"
    ? benchmarkSummary.recommendationTargets
    : {};
  const downstreamReadyCount = (toFinite(recommendationTargets.district, 0) || 0)
    + (toFinite(recommendationTargets.targeting, 0) || 0)
    + (toFinite(recommendationTargets.outcome, 0) || 0);

  const confidenceBand = cleanText(qualitySummary.confidenceBand || quality.confidenceBand || "unknown").toLowerCase();
  const confidenceBandText = formatConfidenceBand(confidenceBand);
  const qualityScore = toFinite(qualitySummary.score ?? quality.score, null);

  const cycleYears = uniqueSortedYears(historicalRows);
  const cycleLabel = cycleYears.length
    ? cycleYears.slice(0, 3).join(", ")
    : "";

  const { topOffice, topCount } = deriveTopOfficeHistoricalAnchor(historicalRows);
  const topOfficeLabel = toTitleWords(topOffice);

  const hasEvidenceSignals = historicalCount > 0 || turnoutCount > 0 || suggestionCount > 0;
  if (!hasEvidenceSignals) {
    return {
      ready: false,
      statusText: "Provenance and trust details appear after benchmark rows are available.",
      drivingText: "",
      qualityText: "",
      comparableText: "",
      scopeText: "",
      readinessText: "",
    };
  }

  let drivingText = "";
  if (historicalCount > 0) {
    if (cycleYears.length > 1) {
      drivingText = `${historicalCount.toLocaleString("en-US")} historical benchmark row(s) across ${cycleYears.length} cycle(s) (${cycleLabel}) anchor this benchmark.`;
    } else if (cycleYears.length === 1) {
      drivingText = `${historicalCount.toLocaleString("en-US")} historical benchmark row(s) from ${cycleYears[0]} anchor this benchmark.`;
    } else {
      drivingText = `${historicalCount.toLocaleString("en-US")} historical benchmark row(s) anchor this benchmark.`;
    }
    if (topOfficeLabel && topCount > 0) {
      drivingText += ` Primary anchor office: ${topOfficeLabel} (${topCount.toLocaleString("en-US")} row(s)).`;
    }
  } else if (turnoutCount > 0) {
    drivingText = `${turnoutCount.toLocaleString("en-US")} turnout baseline row(s) currently drive benchmark calibration.`;
  }

  let qualityTier = "partial";
  if (
    confidenceBand === "high"
    && (qualityScore == null || qualityScore >= 0.8)
    && historicalCount >= 3
    && comparableCount > 0
  ) {
    qualityTier = "strong";
  } else if (
    confidenceBand === "low"
    || confidenceBand === "critical"
    || (qualityScore != null && qualityScore < 0.6)
    || historicalCount <= 0
  ) {
    qualityTier = "weak";
  }

  let qualityText = "";
  if (qualityTier === "strong") {
    qualityText = `Strong benchmark grounding (${confidenceBandText} confidence, quality ${formatQualityScore(qualityScore)}). Safe for advisory calibration with normal validation discipline.`;
  } else if (qualityTier === "weak") {
    qualityText = `Weak benchmark support (${confidenceBandText} confidence, quality ${formatQualityScore(qualityScore)}). Treat guidance as directional until coverage and quality improve.`;
  } else {
    qualityText = `Partial benchmark support (${confidenceBandText} confidence, quality ${formatQualityScore(qualityScore)}). Use for calibration, then verify against live campaign evidence.`;
  }

  let comparableText = "";
  if (comparableCount > 0) {
    const topPool = comparablePools[0] && typeof comparablePools[0] === "object" ? comparablePools[0] : {};
    const poolOffice = toTitleWords(topPool.office);
    const poolType = toTitleWords(topPool.electionType);
    const poolCycleCount = toFinite(topPool.cycleCount, null);
    const poolRaceCount = toFinite(topPool.raceCount, null);
    const detailBits = [];
    if (poolOffice) detailBits.push(poolOffice);
    if (poolType) detailBits.push(poolType);
    if (poolCycleCount != null && poolCycleCount > 0) detailBits.push(`${poolCycleCount} cycle(s)`);
    if (poolRaceCount != null && poolRaceCount > 0) detailBits.push(`${poolRaceCount} race(s)`);
    comparableText = `Comparable coverage: ${comparableCount.toLocaleString("en-US")} pool(s).`
      + (detailBits.length ? ` Top pool: ${detailBits.join(" · ")}.` : "");
  } else if (historicalCount > 0) {
    comparableText = "Comparable pool coverage is thin; recommendation quality is limited by missing comparables.";
  }

  const scopeText = "Benchmark history is calibration context. It does not represent current campaign truth and does not silently override live assumptions.";

  let readinessText = "";
  if (downstreamReadyCount > 0 || historicalCount > 0 || suggestionCount > 0) {
    if (qualityTier === "strong" && comparableCount > 0 && downstreamReadyCount > 0) {
      readinessText = `Ready for downstream advisory use (${downstreamReadyCount.toLocaleString("en-US")} recommendation target(s) available).`;
    } else if (qualityTier === "weak" || comparableCount <= 0) {
      readinessText = "Limited downstream readiness; use benchmark guidance cautiously until quality/comparable coverage improves.";
    } else {
      readinessText = "Partially ready for downstream advisory use; validate key assumptions before acting on recommendations.";
    }
  }

  return {
    ready: true,
    statusText: "Deterministic provenance and trust interpretation from benchmark rows, quality, and comparable coverage.",
    drivingText,
    qualityText,
    comparableText,
    scopeText,
    readinessText,
  };
}

export function renderElectionDataBenchmarksCard({ benchmarksCard, getCardBody }) {
  getCardBody(benchmarksCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Turnout baselines</span><strong id="v3ElectionDataBenchmarkTurnoutCount">0</strong></div>
      <div class="fpe-summary-row"><span>Historical race rows</span><strong id="v3ElectionDataBenchmarkHistoricalCount">0</strong></div>
      <div class="fpe-summary-row"><span>Volatility bands</span><strong id="v3ElectionDataBenchmarkVolatilityCount">0</strong></div>
      <div class="fpe-summary-row"><span>Suggestions</span><strong id="v3ElectionDataBenchmarkSuggestions">0</strong></div>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataBenchmarksStatus">No benchmark rows yet.</div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataDownstreamStatus">No downstream recommendations yet.</div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Provenance & benchmark trust</div>
      <div class="fpe-help fpe-help--flush" id="v3ElectionDataBenchmarkTrustStatus">Provenance and trust details pending.</div>
      <div class="fpe-help fpe-help--flush" id="v3ElectionDataBenchmarkTrustDriving" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3ElectionDataBenchmarkTrustQuality" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3ElectionDataBenchmarkTrustComparable" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3ElectionDataBenchmarkTrustScope" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3ElectionDataBenchmarkTrustReadiness" hidden></div>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnElectionDataApplyBenchmarks" type="button">Apply Downstream Recommendations</button>
    </div>
  `;
}

function syncTrustLine(id, label, text) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const content = cleanText(text);
  el.hidden = !content;
  el.textContent = content ? `${label}: ${content}` : "";
}

export function syncElectionDataBenchmarks(canonical, derived) {
  const summary = derived?.benchmarkSummary && typeof derived.benchmarkSummary === "object"
    ? derived.benchmarkSummary
    : {};

  const turnoutCount = toFinite(summary.turnoutBaselineCount, 0) || 0;
  const historicalCount = toFinite(summary.historicalBenchmarkCount, 0) || 0;
  const volatilityCount = toFinite(summary.volatilityBandCount, 0) || 0;
  const suggestionCount = toFinite(canonical?.benchmarks?.benchmarkSuggestions?.length, 0) || 0;

  setText("v3ElectionDataBenchmarkTurnoutCount", turnoutCount.toLocaleString("en-US"));
  setText("v3ElectionDataBenchmarkHistoricalCount", historicalCount.toLocaleString("en-US"));
  setText("v3ElectionDataBenchmarkVolatilityCount", volatilityCount.toLocaleString("en-US"));
  setText("v3ElectionDataBenchmarkSuggestions", suggestionCount.toLocaleString("en-US"));

  const benchmarkText = cleanText(derived?.benchmarkText)
    || (historicalCount > 0 ? `${historicalCount.toLocaleString("en-US")} benchmark row(s) available.` : "No benchmark rows yet.");
  setText("v3ElectionDataBenchmarksStatus", benchmarkText);

  const recommendationTargets = summary.recommendationTargets && typeof summary.recommendationTargets === "object"
    ? summary.recommendationTargets
    : {};
  const downstreamCount = (toFinite(recommendationTargets.district, 0) || 0)
    + (toFinite(recommendationTargets.targeting, 0) || 0)
    + (toFinite(recommendationTargets.outcome, 0) || 0);
  const downstreamText = cleanText(derived?.downstreamStatusText)
    || (downstreamCount > 0
      ? `${downstreamCount.toLocaleString("en-US")} downstream recommendation target(s) ready.`
      : "No downstream recommendations yet.");
  setText("v3ElectionDataDownstreamStatus", downstreamText);

  const trust = deriveElectionDataBenchmarkTrustExplanation(canonical, derived);
  setText(
    "v3ElectionDataBenchmarkTrustStatus",
    cleanText(trust?.statusText) || "Provenance and trust details unavailable.",
  );
  syncTrustLine("v3ElectionDataBenchmarkTrustDriving", "What is driving this benchmark", trust?.drivingText);
  syncTrustLine("v3ElectionDataBenchmarkTrustQuality", "Benchmark quality", trust?.qualityText);
  syncTrustLine("v3ElectionDataBenchmarkTrustComparable", "Comparable pool / coverage", trust?.comparableText);
  syncTrustLine("v3ElectionDataBenchmarkTrustScope", "What this benchmark can and cannot tell you", trust?.scopeText);
  syncTrustLine("v3ElectionDataBenchmarkTrustReadiness", "Readiness for downstream use", trust?.readinessText);
}
