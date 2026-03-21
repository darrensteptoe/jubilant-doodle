import { setText } from "../../surfaceUtils.js";

function formatQualityScore(value, fallback = "—") {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function renderDistrictV2ElectionDataCard({ electionDataCard, getCardBody }) {
  getCardBody(electionDataCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Source file</span><strong id="v3DistrictV2ElectionDataFile">-</strong></div>
      <div class="fpe-summary-row"><span>Import time</span><strong id="v3DistrictV2ElectionDataImportedAt">-</strong></div>
      <div class="fpe-summary-row"><span>Normalized rows</span><strong id="v3DistrictV2ElectionDataRows">-</strong></div>
      <div class="fpe-summary-row"><span>Quality score</span><strong id="v3DistrictV2ElectionDataQualityScore">-</strong></div>
      <div class="fpe-summary-row"><span>Confidence band</span><strong id="v3DistrictV2ElectionDataConfidenceBand">-</strong></div>
      <div class="fpe-summary-row"><span>Benchmark suggestions</span><strong id="v3DistrictV2ElectionDataBenchmarks">-</strong></div>
      <div class="fpe-summary-row"><span>Downstream ready</span><strong id="v3DistrictV2ElectionDataDownstreamReady">-</strong></div>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3DistrictV2ElectionDataStatus">No election data normalized yet.</div>
    <div class="fpe-help fpe-help--flush" id="v3DistrictV2ElectionDataQualityText">Quality score unavailable.</div>
    <div class="fpe-help fpe-help--flush" id="v3DistrictV2ElectionDataBenchmarkText">No benchmark suggestions yet.</div>
  `;
}

export function syncDistrictV2ElectionDataSummary(snapshot) {
  const summary = snapshot && typeof snapshot === "object" ? snapshot : null;
  const rows = Number.isFinite(Number(summary?.normalizedRowCount))
    ? Math.max(0, Number(summary.normalizedRowCount))
    : 0;
  const qualityScore = Number.isFinite(Number(summary?.qualityScore))
    ? Number(summary.qualityScore)
    : null;
  const benchmarkCount = Number.isFinite(Number(summary?.benchmarkSuggestionCount))
    ? Math.max(0, Number(summary.benchmarkSuggestionCount))
    : 0;
  const fileName = String(summary?.fileName || "").trim();
  const importedAt = String(summary?.importedAt || "").trim();
  const confidenceBand = String(summary?.confidenceBand || "").trim() || "unknown";
  const downstreamReady = !!summary?.downstreamReady;
  const statusText = String(summary?.statusText || "").trim() || "No election data normalized yet.";
  const qualityText = String(summary?.qualityText || "").trim()
    || (qualityScore == null ? "Quality score unavailable." : `Quality score ${formatQualityScore(qualityScore)} (${confidenceBand}).`);
  const benchmarkText = String(summary?.benchmarkText || "").trim()
    || (benchmarkCount > 0 ? `${benchmarkCount} benchmark suggestion(s) ready.` : "No benchmark suggestions yet.");

  setText("v3DistrictV2ElectionDataFile", fileName || "No file");
  setText("v3DistrictV2ElectionDataImportedAt", importedAt || String(summary?.importedAtText || "").trim() || "Not imported");
  setText("v3DistrictV2ElectionDataRows", rows ? String(rows) : "0");
  setText("v3DistrictV2ElectionDataQualityScore", qualityScore == null ? "—" : formatQualityScore(qualityScore));
  setText("v3DistrictV2ElectionDataConfidenceBand", confidenceBand);
  setText("v3DistrictV2ElectionDataBenchmarks", benchmarkCount ? String(benchmarkCount) : "0");
  setText("v3DistrictV2ElectionDataDownstreamReady", downstreamReady ? "Yes" : "No");
  setText("v3DistrictV2ElectionDataStatus", statusText);
  setText("v3DistrictV2ElectionDataQualityText", qualityText);
  setText("v3DistrictV2ElectionDataBenchmarkText", benchmarkText);
}
