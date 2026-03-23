import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatQualityScore(value, fallback = "—") {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function renderElectionDataQualityPanelCard({ qualityPanelCard, getCardBody }) {
  getCardBody(qualityPanelCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Quality score</span><strong id="v3ElectionDataQualityScore">—</strong></div>
      <div class="fpe-summary-row"><span>Confidence band</span><strong id="v3ElectionDataQualityBand">unknown</strong></div>
      <div class="fpe-summary-row"><span>Warning count</span><strong id="v3ElectionDataWarningCount">0</strong></div>
      <div class="fpe-summary-row"><span>Error count</span><strong id="v3ElectionDataErrorCount">0</strong></div>
      <div class="fpe-summary-row"><span>Coverage</span><strong id="v3ElectionDataCoverage">0</strong></div>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataQualityStatus">Quality score unavailable.</div>
  `;
}

export function syncElectionDataQualityPanel(canonical, derived) {
  const quality = canonical?.quality && typeof canonical.quality === "object" ? canonical.quality : {};
  const qualitySummary = derived?.qualitySummary && typeof derived.qualitySummary === "object"
    ? derived.qualitySummary
    : {};
  const coverage = derived?.coverage && typeof derived.coverage === "object" ? derived.coverage : {};

  const score = toFinite(qualitySummary.score ?? quality.score, null);
  const confidenceBand = cleanText(qualitySummary.confidenceBand || quality.confidenceBand) || "unknown";
  const warningCount = toFinite(qualitySummary.warningCount, 0) || 0;
  const errorCount = toFinite(qualitySummary.errorCount, 0) || 0;
  const rowCount = toFinite(derived?.importStatus?.rowCount, 0) || 0;

  setText("v3ElectionDataQualityScore", score == null ? "—" : formatQualityScore(score));
  setText("v3ElectionDataQualityBand", confidenceBand);
  setText("v3ElectionDataWarningCount", warningCount.toLocaleString("en-US"));
  setText("v3ElectionDataErrorCount", errorCount.toLocaleString("en-US"));
  setText("v3ElectionDataCoverage", `${(toFinite(coverage.geographyCount, 0) || 0).toLocaleString("en-US")} geographies / ${rowCount.toLocaleString("en-US")} rows`);

  const qualityText = cleanText(derived?.qualityText)
    || (score == null ? "Quality score unavailable." : `Quality ${formatQualityScore(score)} (${confidenceBand}).`);
  setText("v3ElectionDataQualityStatus", qualityText);
}
