import { setText } from "../../surfaceUtils.js";

export function renderDistrictV2SummaryCard({ summaryCard, getCardBody }) {
  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Universe</span><strong id="v3DistrictV2Universe">-</strong></div>
      <div class="fpe-summary-row"><span>Baseline support total</span><strong id="v3DistrictV2Support">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout</span><strong id="v3DistrictV2Turnout">-</strong></div>
      <div class="fpe-summary-row"><span>Turnout band</span><strong id="v3DistrictV2TurnoutBand">-</strong></div>
      <div class="fpe-summary-row"><span>Projected votes</span><strong id="v3DistrictV2Projected">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3DistrictV2Need">-</strong></div>
    </div>
  `;
}

export function syncDistrictV2Summary(snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : null;
  setText("v3DistrictV2Universe", String(data?.universe || "-") || "-");
  setText("v3DistrictV2Support", String(data?.baselineSupport || "-") || "-");
  setText("v3DistrictV2Turnout", String(data?.turnoutExpected || "-") || "-");
  setText("v3DistrictV2TurnoutBand", String(data?.turnoutBand || "-") || "-");
  setText("v3DistrictV2Projected", String(data?.projectedVotes || "-") || "-");
  setText("v3DistrictV2Need", String(data?.persuasionNeed || "-") || "-");
}
