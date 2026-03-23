import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnElectionDataApplyBenchmarks" type="button">Apply Downstream Recommendations</button>
    </div>
  `;
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
}
