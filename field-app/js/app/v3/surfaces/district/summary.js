export function createDistrictSection({ eyebrow = "", title = "", description = "" }) {
  const section = document.createElement("section");
  section.className = "fpe-district-section";

  const head = document.createElement("div");
  head.className = "fpe-district-section__head";
  head.innerHTML = `
    ${eyebrow ? `<div class="fpe-district-section__eyebrow">${eyebrow}</div>` : ""}
    ${title ? `<h2 class="fpe-district-section__title">${title}</h2>` : ""}
    ${description ? `<p class="fpe-district-section__desc">${description}</p>` : ""}
  `;

  const body = document.createElement("div");
  body.className = "fpe-district-section__body";

  section.append(head, body);
  return { section, body };
}

export function createDistrictBriefBand() {
  const band = document.createElement("section");
  band.className = "fpe-district-brief";
  band.setAttribute("aria-label", "District brief");
  band.innerHTML = `
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Template</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefTemplate">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Mode</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefMode">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Timeline</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefTimeline">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Universe basis</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefUniverseBasis">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">Weighting</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefWeighting">-</div>
    </div>
    <div class="fpe-district-brief__item">
      <div class="fpe-district-brief__label">ACS context</div>
      <div class="fpe-district-brief__value" id="v3DistrictBriefCensus">-</div>
    </div>
  `;
  return band;
}

export function renderDistrictSummaryCard({ summaryCard, getCardBody }) {
  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Universe</span><strong id="v3DistrictUniverse">-</strong></div>
      <div class="fpe-summary-row"><span>Baseline support total</span><strong id="v3DistrictSupport">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout</span><strong id="v3DistrictTurnout">-</strong></div>
      <div class="fpe-summary-row"><span>Your projected votes</span><strong id="v3DistrictProjected">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3DistrictNeed">-</strong></div>
    </div>
  `;
}
